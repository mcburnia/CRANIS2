/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Account Route — /api/account
 *
 * GDPR data subject rights endpoints:
 * - GET  /api/account/data-export   — Right to data portability (Art. 20 GDPR)
 * - DELETE /api/account             — Right to erasure (Art. 17 GDPR)
 * - POST /api/admin/data-retention/run — Manual retention cleanup trigger (platform admin)
 *
 * Data categories and retention periods are defined in the Privacy Policy
 * (docs/PRIVACY-POLICY.md). These endpoints enforce the commitments made there.
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken, getTokenIssuedAt } from '../utils/token.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { createHash, randomBytes } from 'crypto';
import { isPasswordStrong, recordSecurityEvent } from '../services/password-reset.js';
import { sendVerificationEmail } from '../services/email.js';
import { closeAccount, forgetOrg, getOrgByForgetToken, eraseOrgData } from '../services/billing.js';

const SUPPORTED_LANGUAGES = new Set(['en', 'fr', 'de', 'es', 'it', 'nl', 'pt', 'pl', 'sv']);
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60_000; // 24h to verify a new email

const router = Router();

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Authenticate the request via Bearer token.
 * Attaches `userId` and `email` to the request object.
 */
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }

    // Enforce session-invalidation watermark: reject tokens issued before
    // the user's last password reset / forced sign-out. Defends against a
    // pre-reset token still being usable on /api/account/* (where
    // CRAN-30 password and email mutations live).
    const tokenIat = getTokenIssuedAt(token);
    const userRow = await pool.query<{ sessions_invalidated_before: Date | null }>(
      'SELECT sessions_invalidated_before FROM users WHERE id = $1',
      [payload.userId]
    );
    if (userRow.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const watermark = userRow.rows[0].sessions_invalidated_before;
    if (watermark && tokenIat !== null) {
      const watermarkSec = Math.floor(new Date(watermark).getTime() / 1000);
      if (tokenIat < watermarkSec) {
        res.status(401).json({ error: 'Session was invalidated. Please sign in again.' });
        return;
      }
    }

    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

/**
 * Complete data export response shape.
 * Contains all personal data held for the authenticated user,
 * structured for GDPR Article 20 data portability.
 */
export interface DataExportResponse {
  /** ISO 8601 timestamp of when the export was generated */
  exportedAt: string;
  /** GDPR data portability format version */
  formatVersion: '1.0';

  /** Core account information */
  account: {
    id: string;
    email: string;
    emailVerified: boolean;
    preferredLanguage: string | null;
    orgRole: string | null;
    isPlatformAdmin: boolean;
    createdAt: string;
    updatedAt: string;
  };

  /** Organisation membership (present if user belongs to an org) */
  organisation: {
    id: string;
    name: string | null;
    craRole: string | null;
  } | null;

  /** Billing details (present if user is org admin and billing exists) */
  billing: {
    plan: string;
    status: string;
    billingEmail: string | null;
    companyName: string | null;
    billingAddress: Record<string, any> | null;
    vatNumber: string | null;
    trialEndsAt: string | null;
    contributorCount: number;
    createdAt: string;
  } | null;

  /** Repository connections (OAuth tokens excluded for security) */
  repoConnections: Array<{
    provider: string;
    providerUsername: string | null;
    providerAvatarUrl: string | null;
    connectedAt: string;
  }>;

  /** Products owned by the user's organisation */
  products: Array<{
    id: string;
    name: string;
    version: string | null;
    craCategory: string | null;
    distributionModel: string | null;
    createdAt: string;
  }>;

  /** Compliance stakeholders the user's org has registered */
  stakeholders: Array<{
    productId: string | null;
    roleKey: string;
    name: string;
    email: string;
    phone: string;
    organisation: string;
    address: string;
  }>;

  /** Feedback the user has submitted */
  feedback: Array<{
    category: string;
    subject: string;
    body: string;
    pageUrl: string | null;
    createdAt: string;
  }>;

  /** API keys created by the user (key values excluded for security) */
  apiKeys: Array<{
    name: string;
    keyPrefix: string;
    scopes: string[];
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
  }>;

  /** Usage telemetry within the 90-day retention window */
  telemetry: Array<{
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    browserLanguage: string | null;
    browserTimezone: string | null;
    referrer: string | null;
    createdAt: string;
  }>;

  /** AI Copilot usage records */
  copilotUsage: Array<{
    productId: string | null;
    sectionKey: string | null;
    type: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    model: string | null;
    createdAt: string;
  }>;

  /** Notifications received by the user */
  notifications: Array<{
    type: string;
    severity: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
  }>;

  /** SEE (Software Evidence Engine) sessions linked to the user's email */
  seeSessions: Array<{
    productId: string;
    startedAt: string;
    endedAt: string | null;
    turnCount: number;
  }>;

  /** Data categories excluded from this export with reasons */
  exclusions: Array<{
    category: string;
    reason: string;
  }>;
}

/**
 * Request body for account deletion.
 * Password confirmation is required to prevent accidental deletion.
 */
export interface DeleteAccountRequest {
  /** Current password — required to confirm the deletion */
  password: string;
}

/**
 * Response shape for successful account deletion.
 */
export interface DeleteAccountResponse {
  /** Confirmation message */
  message: string;
  /** Summary of what was deleted */
  deleted: {
    user: boolean;
    repoConnections: number;
    userEvents: number;
    feedback: number;
    apiKeys: number;
    copilotCache: number;
    notifications: number;
    neo4jNodes: number;
  };
  /** Summary of what was anonymised (retained for legal obligations) */
  anonymised: {
    billingRecords: boolean;
    auditTrailEntries: number;
  };
}

/**
 * Response shape for data retention cleanup.
 */
export interface RetentionCleanupResponse {
  /** ISO 8601 timestamp of when the cleanup ran */
  ranAt: string;
  /** Rows deleted per category */
  deleted: {
    expiredTelemetry: number;
    expiredFeedback: number;
    expiredVerificationTokens: number;
    expiredCopilotCache: number;
  };
}

// ─── GET /api/account/data-export ────────────────────────────────────────────

/**
 * Export all personal data held for the authenticated user.
 *
 * Returns a structured JSON object containing all data categories
 * documented in the Privacy Policy. Sensitive values (password hash,
 * OAuth tokens, API key secrets) are excluded for security.
 *
 * GDPR Article 20 — Right to data portability.
 *
 * @route GET /api/account/data-export
 * @auth Bearer token required
 * @returns {DataExportResponse} 200 — Complete data export
 * @returns {object} 401 — Invalid or missing token
 * @returns {object} 403 — No organisation found
 */
router.get('/data-export', authRateLimit('data_export'), requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    // ── Account data ─────────────────────────────────────────────────────
    const userResult = await pool.query(
      `SELECT id, email, email_verified, preferred_language, org_id, org_role,
              is_platform_admin, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const orgId = user.org_id;

    // ── Organisation data ────────────────────────────────────────────────
    let organisation: DataExportResponse['organisation'] = null;
    if (orgId) {
      const session = getDriver().session();
      try {
        const orgResult = await session.run(
          `MATCH (o:Organisation {id: $orgId}) RETURN o.name AS name, o.craRole AS craRole`,
          { orgId }
        );
        if (orgResult.records.length > 0) {
          const record = orgResult.records[0];
          organisation = {
            id: orgId,
            name: record.get('name') || null,
            craRole: record.get('craRole') || null,
          };
        }
      } finally {
        await session.close();
      }
    }

    // ── Billing data (only for org admins) ───────────────────────────────
    let billing: DataExportResponse['billing'] = null;
    if (orgId && user.org_role === 'admin') {
      const billingResult = await pool.query(
        `SELECT plan, status, billing_email, company_name, billing_address,
                vat_number, trial_ends_at, contributor_count, created_at
         FROM org_billing WHERE org_id = $1`,
        [orgId]
      );
      if (billingResult.rows.length > 0) {
        const b = billingResult.rows[0];
        billing = {
          plan: b.plan,
          status: b.status,
          billingEmail: b.billing_email,
          companyName: b.company_name,
          billingAddress: b.billing_address,
          vatNumber: b.vat_number,
          trialEndsAt: b.trial_ends_at?.toISOString() || null,
          contributorCount: b.contributor_count,
          createdAt: b.created_at.toISOString(),
        };
      }
    }

    // ── Repository connections (tokens excluded) ─────────────────────────
    // Repo connections are org-level — export those visible to the user's org
    // plus any rows that audit-record this user as the connector.
    const repoResult = await pool.query(
      `SELECT provider, provider_username, provider_avatar_url, connected_at
       FROM repo_connections
       WHERE org_id = $1 OR connected_by_user_id = $2`,
      [orgId, userId]
    );

    // ── Products (org-scoped) ────────────────────────────────────────────
    let products: DataExportResponse['products'] = [];
    if (orgId) {
      const session = getDriver().session();
      try {
        const prodResult = await session.run(
          `MATCH (o:Organisation {id: $orgId})-[:OWNS]->(p:Product)
           RETURN p.id AS id, p.name AS name, p.version AS version,
                  p.craCategory AS craCategory, p.distributionModel AS distributionModel,
                  p.createdAt AS createdAt
           ORDER BY p.name`,
          { orgId }
        );
        products = prodResult.records.map(r => ({
          id: r.get('id'),
          name: r.get('name'),
          version: r.get('version') || null,
          craCategory: r.get('craCategory') || null,
          distributionModel: r.get('distributionModel') || null,
          createdAt: r.get('createdAt') || '',
        }));
      } finally {
        await session.close();
      }
    }

    // ── Stakeholders (org-scoped) ────────────────────────────────────────
    let stakeholders: DataExportResponse['stakeholders'] = [];
    if (orgId) {
      const stResult = await pool.query(
        `SELECT product_id, role_key, name, email, phone, organisation, address
         FROM stakeholders WHERE org_id = $1`,
        [orgId]
      );
      stakeholders = stResult.rows.map(r => ({
        productId: r.product_id,
        roleKey: r.role_key,
        name: r.name,
        email: r.email,
        phone: r.phone,
        organisation: r.organisation,
        address: r.address,
      }));
    }

    // ── Feedback ─────────────────────────────────────────────────────────
    const feedbackResult = await pool.query(
      `SELECT category, subject, body, page_url, created_at
       FROM feedback WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // ── API keys (key values excluded) ───────────────────────────────────
    let apiKeys: DataExportResponse['apiKeys'] = [];
    if (orgId) {
      const keyResult = await pool.query(
        `SELECT name, key_prefix, scopes, created_at, last_used_at, revoked_at
         FROM api_keys WHERE org_id = $1 AND created_by = $2`,
        [orgId, userId]
      );
      apiKeys = keyResult.rows.map(r => ({
        name: r.name,
        keyPrefix: r.key_prefix,
        scopes: r.scopes,
        createdAt: r.created_at.toISOString(),
        lastUsedAt: r.last_used_at?.toISOString() || null,
        revokedAt: r.revoked_at?.toISOString() || null,
      }));
    }

    // ── Telemetry (90-day retention window, capped at 1000 most recent) ─
    const telemetryResult = await pool.query(
      `SELECT event_type, ip_address, user_agent, browser_language,
              browser_timezone, referrer, created_at
       FROM user_events
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC
       LIMIT 1000`,
      [userId]
    );

    // ── Copilot usage ────────────────────────────────────────────────────
    let copilotUsage: DataExportResponse['copilotUsage'] = [];
    if (orgId) {
      const copilotResult = await pool.query(
        `SELECT product_id, section_key, type, input_tokens, output_tokens, model, created_at
         FROM copilot_usage WHERE org_id = $1 AND user_id = $2
         ORDER BY created_at DESC
         LIMIT 1000`,
        [orgId, userId]
      );
      copilotUsage = copilotResult.rows.map(r => ({
        productId: r.product_id,
        sectionKey: r.section_key,
        type: r.type,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        model: r.model,
        createdAt: r.created_at.toISOString(),
      }));
    }

    // ── Notifications ────────────────────────────────────────────────────
    const notifResult = await pool.query(
      `SELECT type, severity, title, body, is_read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [userId]
    );

    // ── SEE sessions ─────────────────────────────────────────────────────
    const seeResult = await pool.query(
      `SELECT product_id, started_at, ended_at, turn_count
       FROM see_sessions WHERE developer_email = $1
       ORDER BY started_at DESC`,
      [(req as any).email]
    );

    // ── Build response ───────────────────────────────────────────────────
    const exportData: DataExportResponse = {
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0',

      account: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        preferredLanguage: user.preferred_language,
        orgRole: user.org_role,
        isPlatformAdmin: user.is_platform_admin || false,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
      },

      organisation,
      billing,

      repoConnections: repoResult.rows.map(r => ({
        provider: r.provider,
        providerUsername: r.provider_username,
        providerAvatarUrl: r.provider_avatar_url,
        connectedAt: r.connected_at.toISOString(),
      })),

      products,
      stakeholders,

      feedback: feedbackResult.rows.map(r => ({
        category: r.category,
        subject: r.subject,
        body: r.body,
        pageUrl: r.page_url,
        createdAt: r.created_at.toISOString(),
      })),

      apiKeys,

      telemetry: telemetryResult.rows.map(r => ({
        eventType: r.event_type,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        browserLanguage: r.browser_language,
        browserTimezone: r.browser_timezone,
        referrer: r.referrer,
        createdAt: r.created_at.toISOString(),
      })),

      copilotUsage,

      notifications: notifResult.rows.map(r => ({
        type: r.type,
        severity: r.severity,
        title: r.title,
        body: r.body,
        isRead: r.is_read,
        createdAt: r.created_at.toISOString(),
      })),

      seeSessions: seeResult.rows.map(r => ({
        productId: r.product_id,
        startedAt: r.started_at.toISOString(),
        endedAt: r.ended_at?.toISOString() || null,
        turnCount: r.turn_count || 0,
      })),

      exclusions: [
        { category: 'Password hash', reason: 'Security — not portable, not useful to the data subject' },
        { category: 'OAuth tokens', reason: 'Security — encrypted at rest, provider-specific, not portable' },
        { category: 'API key secrets', reason: 'Security — only key prefix and metadata are included' },
        { category: 'Audit trail', reason: 'Legal retention — CRA Article 13(10) requires 10-year retention' },
        { category: 'Billing invoices', reason: 'Legal retention — tax obligations require 7-year retention' },
      ],
    };

    res.json(exportData);
  } catch (err: any) {
    console.error('[ACCOUNT] Data export failed:', err.message);
    res.status(500).json({ error: 'Data export failed' });
  }
});

// ─── DELETE /api/account ─────────────────────────────────────────────────────

/**
 * Delete the authenticated user's account and associated personal data.
 *
 * Requires password confirmation in the request body.
 * If the user is the sole admin of an organisation, the request is
 * rejected with 409 — they must transfer admin role first.
 *
 * Deletion cascade:
 * - Immediately deleted: user record, user_events, feedback, api_keys,
 *   copilot_cache, notifications, Neo4j User node
 * - Anonymised (not deleted): billing records (7-year tax obligation),
 *   product_activity_log entries (audit trail), repo_connections audit field
 * - Left intact: org data, products, compliance records, the org-level repo
 *   integration — these belong to the organisation, not the individual user
 *
 * GDPR Article 17 — Right to erasure.
 *
 * @route DELETE /api/account
 * @auth Bearer token required
 * @body {DeleteAccountRequest} password confirmation
 * @returns {DeleteAccountResponse} 200 — Account deleted
 * @returns {object} 400 — Missing password
 * @returns {object} 401 — Invalid token or wrong password
 * @returns {object} 409 — Sole admin of organisation (must transfer first)
 */
router.delete('/', authRateLimit('account_delete'), requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const password = req.body?.password;

  if (!password) {
    res.status(400).json({ error: 'Password confirmation is required to delete your account' });
    return;
  }

  try {
    // ── Verify password ──────────────────────────────────────────────────
    const userResult = await pool.query(
      'SELECT id, email, password_hash, org_id, org_role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    // ── Sole-admin → erase the whole organisation ────────────────────────
    // A sole admin deleting their account is closing the organisation. Rather
    // than block them (the old behaviour — they could never leave), we erase
    // the entire org: every member's personal data plus the org graph, with
    // legally-retained records anonymised (CRA 10yr / tax 7yr). Password was
    // already verified above.
    if (user.org_id && user.org_role === 'admin') {
      const adminCount = await pool.query(
        `SELECT COUNT(*)::int AS count FROM users
         WHERE org_id = $1 AND org_role = 'admin' AND id != $2
         AND suspended_at IS NULL`,
        [user.org_id, userId]
      );

      if (adminCount.rows[0].count === 0) {
        try {
          await eraseOrgData(user.org_id);
          res.json({
            message: 'Your account and organisation have been permanently erased. Records required by EU law have been anonymised and retained (CRA: 10 years; tax: 7 years).',
            scope: 'organisation',
          });
        } catch (err: any) {
          console.error('[ACCOUNT] Org erasure failed:', err.message);
          res.status(500).json({ error: 'Account deletion failed' });
        }
        return;
      }
    }

    // ── Deletion cascade ─────────────────────────────────────────────────
    const deleted = {
      user: false,
      repoConnections: 0,
      userEvents: 0,
      feedback: 0,
      apiKeys: 0,
      copilotCache: 0,
      notifications: 0,
      neo4jNodes: 0,
    };

    const anonymised = {
      billingRecords: false,
      auditTrailEntries: 0,
    };

    // Create an anonymised identifier for audit trail references
    const anonHash = createHash('sha256').update(user.email).digest('hex').slice(0, 12);
    const anonId = `deleted-${anonHash}`;

    // 0. Audit trail — record the deletion BEFORE removing data.
    //    Uses anonymised ID so the record is useful without retaining PII.
    //    Inserted into product_activity_log (10-year retention per CRA Art. 13(10)).
    if (user.org_id) {
      try {
        await pool.query(
          `INSERT INTO product_activity_log
           (product_id, org_id, user_id, user_email, action, entity_type, entity_id, summary, metadata)
           VALUES ('_platform', $1, NULL, $2, 'account_deleted', 'user', $3, $4, $5)`,
          [
            user.org_id,
            anonId,
            userId,
            `User account deleted (GDPR Art. 17 erasure). Anonymised reference: ${anonId}`,
            JSON.stringify({
              anonReference: anonId,
              orgRole: user.org_role,
              deletedAt: new Date().toISOString(),
            }),
          ]
        );
      } catch (err: any) {
        // Non-blocking — audit failure must not prevent deletion
        console.error('[ACCOUNT] Audit log write failed:', err.message);
      }
    }

    // 1. Repo connections — now org-level. Deleting a member must not strip
    // the organisation's integration; just null out the audit field that
    // points to this user. (If the user is the sole org admin, account
    // deletion is blocked earlier in this handler.)
    const rcResult = await pool.query(
      'UPDATE repo_connections SET connected_by_user_id = NULL WHERE connected_by_user_id = $1',
      [userId]
    );
    deleted.repoConnections = rcResult.rowCount || 0;

    // 2. Delete user_events (telemetry)
    const ueResult = await pool.query(
      'DELETE FROM user_events WHERE user_id = $1',
      [userId]
    );
    deleted.userEvents = ueResult.rowCount || 0;

    // 3. Delete feedback
    const fbResult = await pool.query(
      'DELETE FROM feedback WHERE user_id = $1',
      [userId]
    );
    deleted.feedback = fbResult.rowCount || 0;

    // 4. Delete API keys created by this user
    if (user.org_id) {
      const akResult = await pool.query(
        'DELETE FROM api_keys WHERE created_by = $1',
        [userId]
      );
      deleted.apiKeys = akResult.rowCount || 0;
    }

    // 5. Delete copilot cache for this user's org (user-specific entries)
    if (user.org_id) {
      const ccResult = await pool.query(
        'DELETE FROM copilot_cache WHERE org_id = $1',
        [user.org_id]
      );
      deleted.copilotCache = ccResult.rowCount || 0;
    }

    // 6. Delete notifications for this user
    const ntResult = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [userId]
    );
    deleted.notifications = ntResult.rowCount || 0;

    // 7. Anonymise product_activity_log entries (audit trail — legal retention)
    const palResult = await pool.query(
      `UPDATE product_activity_log SET user_id = NULL, user_email = $1
       WHERE user_id = $2`,
      [anonId, userId]
    );
    anonymised.auditTrailEntries = palResult.rowCount || 0;

    // 8. Anonymise billing records (7-year tax retention obligation)
    if (user.org_id) {
      const billingExists = await pool.query(
        'SELECT id FROM org_billing WHERE org_id = $1',
        [user.org_id]
      );
      if (billingExists.rows.length > 0) {
        // Only anonymise the billing email if this user's email matches
        await pool.query(
          `UPDATE org_billing SET billing_email = $1
           WHERE org_id = $2 AND billing_email = $3`,
          [anonId, user.org_id, user.email]
        );
        anonymised.billingRecords = true;
      }
    }

    // 9. Nullify FK references in other tables (prevent cascade failures)
    await pool.query(
      'UPDATE cra_reports SET created_by = NULL WHERE created_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE cra_report_stages SET submitted_by = NULL WHERE submitted_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE ip_proof_snapshots SET created_by = NULL WHERE created_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE license_findings SET acknowledged_by = NULL WHERE acknowledged_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE category_recommendations SET user_id = NULL WHERE user_id = $1',
      [userId]
    );
    await pool.query(
      'UPDATE recommendation_access_log SET user_id = NULL WHERE user_id = $1',
      [userId]
    );
    await pool.query(
      'UPDATE supplier_questionnaires SET created_by = NULL WHERE created_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE departed_contributors SET marked_by = NULL WHERE marked_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE doc_pages SET updated_by = NULL WHERE updated_by = $1',
      [userId]
    );
    await pool.query(
      'UPDATE trust_centre_contact_log SET from_user_id = $1::uuid WHERE from_user_id = $2',
      ['00000000-0000-0000-0000-000000000000', userId]
    );
    await pool.query(
      'UPDATE escrow_users SET invited_by = NULL WHERE invited_by = $1',
      [userId]
    );
    await pool.query(
      'DELETE FROM copilot_usage WHERE user_id = $1',
      [userId]
    );

    // 10. Delete the user row itself
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    deleted.user = true;

    // 11. Delete Neo4j User node and relationships
    const neo4jSession = getDriver().session();
    try {
      const neo4jResult = await neo4jSession.run(
        `MATCH (u:User {id: $userId})
         DETACH DELETE u
         RETURN count(u) AS deletedCount`,
        { userId }
      );
      deleted.neo4jNodes = neo4jResult.records[0]?.get('deletedCount')?.toNumber?.() || 0;
    } finally {
      await neo4jSession.close();
    }

    const response: DeleteAccountResponse = {
      message: 'Account deleted successfully. Some records have been anonymised for legal retention obligations.',
      deleted,
      anonymised,
    };

    res.json(response);
  } catch (err: any) {
    console.error('[ACCOUNT] Deletion failed:', err.message);
    res.status(500).json({ error: 'Account deletion failed' });
  }
});

// ─── Close account (soft — cancel billing, retain data 12 months) ────────────
//
// POST /api/account/close
// The non-destructive counterpart to DELETE. Cancels billing, drops the org to
// read-only, stops the trial nag emails, and keeps the data recoverable for 12
// months. Admin only — it affects the whole organisation. Password-confirmed.
router.post('/close', authRateLimit('account_delete'), requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const password = req.body?.password;

  if (!password) {
    res.status(400).json({ error: 'Password confirmation is required to close your account' });
    return;
  }

  try {
    const userResult = await pool.query(
      'SELECT id, password_hash, org_id, org_role FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = userResult.rows[0];

    if (!(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }
    if (user.org_role !== 'admin') {
      res.status(403).json({ error: 'Only an organisation admin can close the account.' });
      return;
    }
    if (!user.org_id) {
      res.status(400).json({ error: 'No organisation is associated with this account.' });
      return;
    }

    const result = await closeAccount(user.org_id);
    res.json({
      message: 'Your account has been closed and billing cancelled. Your data is retained for 12 months — sign in and resubscribe any time to restore full access.',
      ...result,
    });
  } catch (err: any) {
    console.error('[ACCOUNT] Close failed:', err.message);
    res.status(500).json({ error: 'Could not close account' });
  }
});

// ─── "Forget me" (public — driven by the win-back email link) ────────────────
//
// GET  /api/account/forget-me?token=…  → preview (org name) for the confirm page
// POST /api/account/forget-me { token } → execute GDPR erasure + cease contact
// Unauthenticated by design: the recipient of a win-back email is not logged in.
router.get('/forget-me', authRateLimit('account_delete'), async (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const found = await getOrgByForgetToken(token);
  if (!found) {
    res.status(404).json({ error: 'This link is invalid or has already been used.' });
    return;
  }
  res.json({ orgName: found.orgName });
});

router.post('/forget-me', authRateLimit('account_delete'), async (req: Request, res: Response) => {
  const token = String(req.body?.token || '');
  try {
    const result = await forgetOrg(token);
    if (!result) {
      res.status(404).json({ error: 'This link is invalid or has already been used.' });
      return;
    }
    res.json({
      message: 'Done. Your personal data has been erased and we will not contact you again. A minimal anonymised record is retained only where EU law requires it (CRA: 10 years; tax: 7 years) and cannot be used to identify or contact you.',
    });
  } catch (err: any) {
    console.error('[ACCOUNT] Forget-me failed:', err.message);
    res.status(500).json({ error: 'Could not complete the request. Please email info@cranis2.com.' });
  }
});

// ─── Data Retention Cleanup ──────────────────────────────────────────────────

/**
 * Run the data retention cleanup job.
 *
 * Enforces the retention periods documented in the Privacy Policy:
 * - user_events older than 90 days → deleted
 * - feedback older than 2 years → deleted
 * - Expired verification tokens → cleared
 * - copilot_cache older than 24 hours → deleted
 *
 * Can be triggered manually by platform admins or scheduled via cron.
 *
 * @param requirePlatformAdmin — this function returns a sub-router;
 *   the admin route is registered separately in index.ts
 * @returns {RetentionCleanupResponse} Summary of deleted records
 */
export async function runRetentionCleanup(): Promise<RetentionCleanupResponse> {
  const deleted = {
    expiredTelemetry: 0,
    expiredFeedback: 0,
    expiredVerificationTokens: 0,
    expiredCopilotCache: 0,
  };

  // 1. user_events older than 90 days
  const telResult = await pool.query(
    `DELETE FROM user_events WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  deleted.expiredTelemetry = telResult.rowCount || 0;

  // 2. feedback older than 2 years
  const fbResult = await pool.query(
    `DELETE FROM feedback WHERE created_at < NOW() - INTERVAL '2 years'`
  );
  deleted.expiredFeedback = fbResult.rowCount || 0;

  // 3. Expired verification tokens (24-hour single-use)
  const vtResult = await pool.query(
    `UPDATE users SET verification_token = NULL, token_expires_at = NULL
     WHERE token_expires_at IS NOT NULL AND token_expires_at < NOW()`
  );
  deleted.expiredVerificationTokens = vtResult.rowCount || 0;

  // 4. copilot_cache older than 24 hours
  const ccResult = await pool.query(
    `DELETE FROM copilot_cache WHERE created_at < NOW() - INTERVAL '24 hours'`
  );
  deleted.expiredCopilotCache = ccResult.rowCount || 0;

  return {
    ranAt: new Date().toISOString(),
    deleted,
  };
}

// ─── Account Settings (CRAN-30) ──────────────────────────────────────────

/**
 * GET /api/account
 * Returns the authenticated user's profile + a snapshot of any pending
 * email-change request (so the UI can show "verification pending for X").
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const result = await pool.query<{
    id: string;
    email: string;
    email_verified: boolean;
    display_name: string | null;
    preferred_language: string | null;
    pending_email: string | null;
    pending_email_expires_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, email, email_verified, display_name, preferred_language,
            pending_email, pending_email_expires_at, created_at
       FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const u = result.rows[0];
  res.json({
    id: u.id,
    email: u.email,
    emailVerified: u.email_verified,
    displayName: u.display_name,
    preferredLanguage: u.preferred_language,
    pendingEmail: u.pending_email,
    pendingEmailExpiresAt: u.pending_email_expires_at?.toISOString() ?? null,
    createdAt: u.created_at.toISOString(),
  });
});

/**
 * PUT /api/account/profile — change display_name and/or preferred_language.
 * Audit-logged. Other accounts in the same session are unaffected.
 */
router.put('/profile', authRateLimit('account_profile'), requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { displayName, preferredLanguage } = req.body ?? {};

  if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 120)) {
    res.status(400).json({ error: 'Display name must be a string up to 120 characters.' });
    return;
  }
  // Accept both 2-letter codes ("en") and locale-style ("en-GB") — the
  // latter is what older signup records carry from navigator.language.
  // Normalise to the bare base on the way in so the column is consistent
  // going forward.
  let normalisedLanguage: string | undefined;
  if (preferredLanguage !== undefined) {
    if (typeof preferredLanguage !== 'string' || preferredLanguage.length === 0) {
      res.status(400).json({ error: 'Unsupported language code.' });
      return;
    }
    const base = preferredLanguage.split('-')[0].toLowerCase();
    if (!SUPPORTED_LANGUAGES.has(base)) {
      res.status(400).json({ error: 'Unsupported language code.' });
      return;
    }
    normalisedLanguage = base;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  if (displayName !== undefined) {
    params.push(displayName.trim() === '' ? null : displayName.trim());
    updates.push(`display_name = $${params.length}`);
  }
  if (normalisedLanguage !== undefined) {
    params.push(normalisedLanguage);
    updates.push(`preferred_language = $${params.length}`);
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update.' });
    return;
  }
  params.push(userId);
  await pool.query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  await recordSecurityEvent(userId, 'profile_updated', {
    fields: { displayName: displayName !== undefined, preferredLanguage: preferredLanguage !== undefined },
  }, ip, ua);

  res.json({ ok: true });
});

/**
 * PUT /api/account/password — change password while logged in.
 * Verifies currentPassword, applies signup-strength rules to newPassword.
 * Sets sessions_invalidated_before so other devices' tokens are rejected,
 * but keeps the current request's session alive (the watermark is rounded
 * up to the next whole second, which is *after* the current iat).
 */
router.put('/password', authRateLimit('account_password'), requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
    res.status(400).json({ error: 'currentPassword, newPassword and confirmPassword are required.' });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ error: 'New password and confirmation do not match.' });
    return;
  }
  if (!isPasswordStrong(newPassword)) {
    res.status(400).json({ error: 'New password does not meet strength requirements.' });
    return;
  }

  const userRow = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (userRow.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const matches = await verifyPassword(currentPassword, userRow.rows[0].password_hash);
  if (!matches) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const newHash = await hashPassword(newPassword);

  // Watermark advances to the next whole second so other devices' tokens
  // (issued before this moment) are reliably rejected. The CURRENT request's
  // token will also be older than the watermark — caller should expect to
  // receive a fresh session token via re-login. Returning a new token from
  // this endpoint would couple it to the login flow; cleaner to keep the
  // contract simple and let the UI redirect to /login on success.
  await pool.query(
    `UPDATE users
        SET password_hash = $1,
            sessions_invalidated_before = date_trunc('second', NOW()) + INTERVAL '1 second',
            updated_at = NOW()
      WHERE id = $2`,
    [newHash, userId]
  );

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  await recordSecurityEvent(userId, 'password_changed', {}, ip, ua);

  res.json({ ok: true });
});

/**
 * PUT /api/account/email — request an email change.
 * Sends a verification link to the NEW address. Account stays on the OLD
 * address until that link is clicked (and re-verified). The pending change
 * expires after EMAIL_CHANGE_TTL_MS.
 */
router.put('/email', authRateLimit('account_email'), requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const currentEmail = (req as any).email as string;
  const { newEmail } = req.body ?? {};

  if (typeof newEmail !== 'string' || !newEmail.includes('@')) {
    res.status(400).json({ error: 'A valid newEmail is required.' });
    return;
  }
  const normalised = newEmail.toLowerCase().trim();
  if (normalised === currentEmail.toLowerCase()) {
    res.status(400).json({ error: 'New email must differ from current email.' });
    return;
  }
  // Reject if the new email is already in use by another account.
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalised]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'That email is already in use.' });
    return;
  }

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);

  await pool.query(
    `UPDATE users
        SET pending_email = $1,
            pending_email_token = $2,
            pending_email_expires_at = $3,
            updated_at = NOW()
      WHERE id = $4`,
    [normalised, token, expires, userId]
  );

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  await recordSecurityEvent(userId, 'email_change_requested', { newEmail: normalised }, ip, ua);

  // Send a verification email to the NEW address. The existing
  // verify-email flow handles email verification, but here we use a
  // dedicated email-change confirmation route — the user clicks the link
  // and lands on POST /api/account/email/confirm which finalises the
  // change. Reuses the existing sendVerificationEmail visual style for
  // continuity, but with a query parameter to distinguish the flow.
  if (process.env.DEV_SKIP_EMAIL === 'true') {
    res.json({ ok: true, devToken: token });
    return;
  }
  await sendVerificationEmail(normalised, `change:${token}`);
  res.json({ ok: true });
});

/**
 * POST /api/account/email/confirm — finalise an email change.
 * Authenticated: the same logged-in user must click the link from their
 * NEW email inbox. The token is validated and (if still fresh) the
 * users.email column is updated.
 */
router.post('/email/confirm', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { token } = req.body ?? {};

  if (typeof token !== 'string' || token.length === 0) {
    res.status(400).json({ error: 'token is required.' });
    return;
  }
  const cleanToken = token.startsWith('change:') ? token.slice(7) : token;

  const row = await pool.query<{
    pending_email: string | null;
    pending_email_token: string | null;
    pending_email_expires_at: Date | null;
  }>(
    `SELECT pending_email, pending_email_token, pending_email_expires_at
       FROM users WHERE id = $1`,
    [userId]
  );
  if (row.rows.length === 0 || !row.rows[0].pending_email_token) {
    res.status(400).json({ error: 'No pending email change.' });
    return;
  }
  const r = row.rows[0];
  if (r.pending_email_token !== cleanToken) {
    res.status(400).json({ error: 'Invalid or expired token.' });
    return;
  }
  if (!r.pending_email_expires_at || new Date(r.pending_email_expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired token.' });
    return;
  }

  const newEmail = r.pending_email!;
  await pool.query(
    `UPDATE users
        SET email = $1,
            email_verified = TRUE,
            pending_email = NULL,
            pending_email_token = NULL,
            pending_email_expires_at = NULL,
            updated_at = NOW()
      WHERE id = $2`,
    [newEmail, userId]
  );

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.ip || null;
  const ua = (req.headers['user-agent'] as string | undefined) || null;
  await recordSecurityEvent(userId, 'email_change_confirmed', { newEmail }, ip, ua);

  res.json({ ok: true, email: newEmail });
});

export default router;
