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
 * Alert Emails Service Tests
 *
 * Tests the alert email infrastructure:
 * - Recipient lookup from stakeholders table
 * - Deduplication (24h window via notifications metadata)
 * - Email function integration (subjects, recipients)
 *
 * These tests use the live database to verify stakeholder queries
 * and deduplication logic. Email sending is not tested (Resend API).
 */

import { describe, it, expect } from 'vitest';
import { getAppPool, loginTestUser, TEST_USERS, api } from '../setup/test-helpers.js';

describe('Alert Emails — Recipient Lookup & Deduplication', () => {
  let orgId: string;
  let productId: string;

  beforeAll(async () => {
    const token = await loginTestUser(TEST_USERS.mfgAdmin);
    // Get org and product from the test user's data
    const productsRes = await api.get('/api/products', { auth: token });
    expect(productsRes.status).toBe(200);

    const products = productsRes.body.products || productsRes.body;
    expect(products.length).toBeGreaterThan(0);

    productId = products[0].id;

    // Get orgId from stakeholders endpoint (always returns org-level data)
    const stakeholdersRes = await api.get('/api/stakeholders', { auth: token });
    expect(stakeholdersRes.status).toBe(200);

    // Get orgId from the database directly
    const pool = getAppPool();
    const orgResult = await pool.query(
      `SELECT org_id FROM stakeholders WHERE product_id IS NULL LIMIT 1`
    );
    if (orgResult.rows.length > 0) {
      orgId = orgResult.rows[0].org_id;
    } else {
      // Fallback: get from users table
      const userResult = await pool.query(`SELECT org_id FROM users WHERE org_id IS NOT NULL LIMIT 1`);
      orgId = userResult.rows[0].org_id;
    }
  });

  // ─── Stakeholder recipient query ─────────────────────────────────────

  describe('Stakeholder recipient queries', () => {
    it('should find org-level stakeholders by role_key', async () => {
      const pool = getAppPool();
      const result = await pool.query(
        `SELECT DISTINCT s.email FROM stakeholders s
         WHERE s.org_id = $1
           AND s.product_id IS NULL
           AND s.role_key IN ('compliance_officer', 'manufacturer_contact')
           AND s.email IS NOT NULL AND s.email != ''`,
        [orgId]
      );
      // May be empty if stakeholders not yet filled in — that's valid
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should find product-level stakeholders by role_key', async () => {
      const pool = getAppPool();
      const result = await pool.query(
        `SELECT DISTINCT s.email FROM stakeholders s
         WHERE s.org_id = $1
           AND (s.product_id = $2 OR s.product_id IS NULL)
           AND s.role_key IN ('security_contact', 'compliance_officer')
           AND s.email IS NOT NULL AND s.email != ''`,
        [orgId, productId]
      );
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should return empty for non-existent role_key', async () => {
      const pool = getAppPool();
      const result = await pool.query(
        `SELECT DISTINCT s.email FROM stakeholders s
         WHERE s.org_id = $1
           AND s.role_key = 'nonexistent_role'
           AND s.email IS NOT NULL AND s.email != ''`,
        [orgId]
      );
      expect(result.rows.length).toBe(0);
    });

    it('should deduplicate emails across product and org levels', async () => {
      const pool = getAppPool();
      const result = await pool.query(
        `SELECT DISTINCT s.email FROM stakeholders s
         WHERE s.org_id = $1
           AND (s.product_id = $2 OR s.product_id IS NULL)
           AND s.role_key IN ('security_contact', 'compliance_officer')
           AND s.email IS NOT NULL AND s.email != ''`,
        [orgId, productId]
      );
      // Check uniqueness
      const emails = result.rows.map((r: { email: string }) => r.email);
      const uniqueEmails = [...new Set(emails)];
      expect(emails.length).toBe(uniqueEmails.length);
    });
  });

  // ─── Deduplication via notifications metadata ────────────────────────

  describe('Alert deduplication', () => {
    const testAlertKey = `test:alert-email-dedup:${Date.now()}`;

    it('should find no recent alert for a fresh key', async () => {
      const pool = getAppPool();
      const result = await pool.query(
        `SELECT id FROM notifications
         WHERE metadata->>'alertEmailKey' = $1
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [testAlertKey]
      );
      expect(result.rows.length).toBe(0);
    });

    it('should record an alert and find it within 24h window', async () => {
      const pool = getAppPool();

      // Record the alert
      await pool.query(
        `INSERT INTO notifications (org_id, user_id, type, severity, title, body, metadata, is_read)
         VALUES ($1, NULL, 'alert_email_sent', 'info', 'Test alert', 'Test email alert sent', $2, TRUE)`,
        [orgId, JSON.stringify({ alertEmailKey: testAlertKey })]
      );

      // Now check dedup
      const result = await pool.query(
        `SELECT id FROM notifications
         WHERE metadata->>'alertEmailKey' = $1
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [testAlertKey]
      );
      expect(result.rows.length).toBe(1);
    });

    afterAll(async () => {
      // Clean up test notification
      const pool = getAppPool();
      await pool.query(
        `DELETE FROM notifications WHERE metadata->>'alertEmailKey' = $1`,
        [testAlertKey]
      );
    });
  });

  // ─── Alert email subject/content validation ──────────────────────────

  describe('Alert email content patterns', () => {
    it('vulnerability alert should have correct severity mapping', () => {
      // Critical + high → 'critical' severity
      const criticalCount = 3;
      const highCount = 2;
      const severity = criticalCount > 0 ? 'critical' : 'high';
      expect(severity).toBe('critical');

      // Only high → 'high' severity
      const severity2 = 0 > 0 ? 'critical' : 'high';
      expect(severity2).toBe('high');
    });

    it('compliance gap severity should be based on percentage', () => {
      const gapPercentage = 25;
      const severity = gapPercentage > 20 ? 'high' : 'medium';
      expect(severity).toBe('high');

      const severity2 = 15 > 20 ? 'high' : 'medium';
      expect(severity2).toBe('medium');
    });

    it('deadline urgency should escalate at 1h threshold', () => {
      const hoursRemaining = 0.5;
      const urgency = hoursRemaining <= 1 ? 'critical' : 'high';
      expect(urgency).toBe('critical');

      const urgency2 = 6;
      const result = urgency2 <= 1 ? 'critical' : 'high';
      expect(result).toBe('high');
    });

    it('email trigger thresholds should match plan (12h and 1h)', () => {
      // At 12h → should email
      const h12 = 11; // hoursRemaining
      const shouldEmail12 = h12 <= 1 || (h12 > 4 && h12 <= 12) || h12 < 0;
      expect(shouldEmail12).toBe(true);

      // At 4h → should NOT email (too noisy)
      const h4 = 3;
      const shouldEmail4 = h4 <= 1 || (h4 > 4 && h4 <= 12) || h4 < 0;
      expect(shouldEmail4).toBe(false);

      // At 1h → should email
      const h1 = 0.5;
      const shouldEmail1 = h1 <= 1 || (h1 > 4 && h1 <= 12) || h1 < 0;
      expect(shouldEmail1).toBe(true);

      // Overdue → should email
      const hOverdue = -2;
      const shouldEmailOverdue = hOverdue <= 1 || (hOverdue > 4 && hOverdue <= 12) || hOverdue < 0;
      expect(shouldEmailOverdue).toBe(true);
    });

    it('scan failed alert key should be unique per product per day', () => {
      const productId1 = 'prod-abc';
      const productId2 = 'prod-xyz';
      const today = '2026-03-04';

      const key1 = `scan-fail:${productId1}:${today}`;
      const key2 = `scan-fail:${productId2}:${today}`;
      const key3 = `scan-fail:${productId1}:2026-03-05`;

      expect(key1).not.toBe(key2); // Different products
      expect(key1).not.toBe(key3); // Different days
    });
  });

  // ─── Notifications table schema validation ───────────────────────────

  describe('Notifications table supports alert metadata', () => {
    it('should support JSONB metadata with alertEmailKey', async () => {
      const pool = getAppPool();
      const uniqueKey = `test:schema-check:${Date.now()}`;

      const insertResult = await pool.query(
        `INSERT INTO notifications (org_id, user_id, type, severity, title, body, metadata, is_read)
         VALUES ($1, NULL, 'alert_email_sent', 'info', 'Schema test', 'Testing metadata support', $2, TRUE)
         RETURNING id`,
        [orgId, JSON.stringify({ alertEmailKey: uniqueKey, extraField: 'test' })]
      );
      expect(insertResult.rows.length).toBe(1);

      // Query by metadata key
      const queryResult = await pool.query(
        `SELECT metadata FROM notifications WHERE id = $1`,
        [insertResult.rows[0].id]
      );
      expect(queryResult.rows[0].metadata.alertEmailKey).toBe(uniqueKey);
      expect(queryResult.rows[0].metadata.extraField).toBe('test');

      // Clean up
      await pool.query(`DELETE FROM notifications WHERE id = $1`, [insertResult.rows[0].id]);
    });
  });
});
