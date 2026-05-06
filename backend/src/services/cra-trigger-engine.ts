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
 * P10b — Automated CRA Article 14 trigger engine.
 *
 * Detects findings that meet the platform's "actively exploited" threshold
 * (CISA KEV listing or EPSS at or above the configured EPSS threshold) and
 * auto-creates a draft CRA Art. 14 vulnerability report against each one,
 * with deadlines computed from a NOW() awareness timestamp. Sends a critical
 * bell notification to the org so the manufacturer is unambiguously aware
 * that the 24-hour ENISA early-warning clock has started.
 *
 * Why this matters legally: CRA Art. 14 requires manufacturers to notify
 * the relevant CSIRT and ENISA within 24 hours of "becoming aware" of an
 * actively-exploited vulnerability. Once CRANIS2's threat-intel data
 * matches a manufacturer's product, the manufacturer's organisation has,
 * via this platform, become aware. The trigger engine records that moment
 * with a tamper-resistant timestamp and an explicit "trigger_reason" so the
 * compliance record can later be audited.
 *
 * Design rules:
 *   - Idempotent: running the engine twice never creates duplicate reports
 *     for the same finding (enforced by a unique index plus an explicit
 *     pre-insert check). Running it nightly or after every scan is safe.
 *   - Configurable: trigger_policy lives in platform_settings so an
 *     operator can flip kev_action between 'trigger' and 'alert_only'
 *     and tune the EPSS threshold without a code change.
 *   - Non-fatal: per-finding errors are caught and logged; one bad finding
 *     does not abort the engine for everyone else.
 *   - Pure-helper-friendly: the policy parser, candidate evaluator, and
 *     reason builder are exported pure functions so they can be unit-tested
 *     deterministically without touching the database.
 *
 * Awareness-timestamp tamper-resistance (RFC3161 TSA stamping) is added in
 * the next commit (P10b-2). The engine works without it; the stamp is a
 * defence-in-depth layer for the legal record.
 */

import pool from '../db/pool.js';
import { createHash } from 'crypto';
import { createNotification } from './notifications.js';
import { requestTimestamp, getTsaUrl } from './rfc3161.js';

// --- Policy ---

export interface CraTriggerPolicy {
  enabled: boolean;
  kevAction: 'trigger' | 'alert_only';
  epssThreshold: number;
}

export const DEFAULT_CRA_TRIGGER_POLICY: CraTriggerPolicy = {
  enabled: true,
  kevAction: 'trigger',
  epssThreshold: 0.95,
};

/**
 * Pure parser for trigger-policy settings. Accepts a record keyed by full
 * setting keys (e.g. 'cra_trigger.enabled') with already-parsed JSONB
 * values, and returns a canonical CraTriggerPolicy with safe defaults
 * for anything missing or malformed. Exported for unit tests.
 */
export function parseTriggerPolicy(settings: Record<string, unknown>): CraTriggerPolicy {
  const enabledRaw = settings['cra_trigger.enabled'];
  const enabled = enabledRaw === false ? false : true; // default: enabled

  const actionRaw = settings['cra_trigger.kev_action'];
  const kevAction: CraTriggerPolicy['kevAction'] =
    actionRaw === 'alert_only' ? 'alert_only' : 'trigger';

  const thresholdRaw = settings['cra_trigger.epss_threshold'];
  let epssThreshold = DEFAULT_CRA_TRIGGER_POLICY.epssThreshold;
  if (typeof thresholdRaw === 'number' && Number.isFinite(thresholdRaw) && thresholdRaw >= 0 && thresholdRaw <= 1) {
    epssThreshold = thresholdRaw;
  }

  return { enabled, kevAction, epssThreshold };
}

export async function loadTriggerPolicy(): Promise<CraTriggerPolicy> {
  const result = await pool.query(
    `SELECT key, value FROM platform_settings WHERE key LIKE 'cra_trigger.%'`
  );
  const settings: Record<string, unknown> = {};
  for (const r of result.rows) settings[r.key] = r.value;
  return parseTriggerPolicy(settings);
}

// --- Candidate selection ---

export interface CandidateFinding {
  findingId: string;
  orgId: string;
  productId: string;
  severity: string;
  cvssScore: number | null;
  sourceId: string;
  title: string;
  kevListed: boolean;
  kevDueDate: string | null;
  kevKnownRansomware: boolean;
  epssScore: number | null;
  epssPercentile: number | null;
}

export type TriggerSource = 'kev' | 'epss';

export interface TriggerReason {
  source: TriggerSource;
  /** Action the policy mandates: 'trigger' creates a report, 'alert_only' notifies. */
  action: 'trigger' | 'alert_only';
  kev?: { dueDate: string | null; knownRansomware: boolean };
  epss?: { score: number; percentile: number | null; threshold: number };
}

/**
 * Pure decision function: given a finding's threat-intel state and the
 * current trigger policy, decide whether to act and how.
 *
 * KEV listing always wins over EPSS (KEV is the stronger signal). When
 * the policy's kevAction is 'alert_only', a KEV-listed finding still
 * produces a TriggerReason but with action='alert_only', so the caller
 * notifies without creating a report. Returns null when no signal meets
 * the threshold.
 */
export function buildTriggerReason(
  finding: Pick<CandidateFinding, 'kevListed' | 'kevDueDate' | 'kevKnownRansomware' | 'epssScore' | 'epssPercentile'>,
  policy: CraTriggerPolicy,
): TriggerReason | null {
  if (finding.kevListed) {
    return {
      source: 'kev',
      action: policy.kevAction,
      kev: {
        dueDate: finding.kevDueDate,
        knownRansomware: finding.kevKnownRansomware,
      },
    };
  }
  if (
    finding.epssScore !== null &&
    Number.isFinite(finding.epssScore) &&
    finding.epssScore >= policy.epssThreshold
  ) {
    return {
      source: 'epss',
      action: 'trigger',
      epss: {
        score: finding.epssScore,
        percentile: finding.epssPercentile,
        threshold: policy.epssThreshold,
      },
    };
  }
  return null;
}

// --- Deadline helpers ---

const HOURS_24_MS = 24 * 60 * 60 * 1000;
const HOURS_72_MS = 72 * 60 * 60 * 1000;
const DAYS_14_MS = 14 * 24 * 60 * 60 * 1000;

export function calculateAwarenessDeadlines(awarenessAt: Date) {
  return {
    earlyWarning: new Date(awarenessAt.getTime() + HOURS_24_MS),
    notification: new Date(awarenessAt.getTime() + HOURS_72_MS),
    finalReport: new Date(awarenessAt.getTime() + DAYS_14_MS),
  };
}

// --- Notification body ---

export function buildNotificationBody(
  finding: Pick<CandidateFinding, 'sourceId' | 'productId'>,
  reason: TriggerReason,
  reportId: string | null,
): string {
  const parts: string[] = [];

  if (reason.source === 'kev') {
    parts.push(finding.sourceId + ' is listed in CISA’s Known Exploited Vulnerabilities catalogue.');
    if (reason.kev?.dueDate) parts.push('CISA federal due date: ' + reason.kev.dueDate + '.');
    if (reason.kev?.knownRansomware) parts.push('Used in observed ransomware campaigns.');
  } else {
    const score = reason.epss?.score ?? 0;
    const threshold = reason.epss?.threshold ?? 0;
    parts.push(finding.sourceId + ' has EPSS score ' + score.toFixed(4) + ' (threshold ' + threshold + ') — high probability of exploitation in the next 30 days.');
  }

  if (reportId) {
    parts.push('A draft CRA Art. 14 vulnerability report has been auto-created. The 24-hour ENISA early-warning notification clock has started.');
  } else {
    parts.push('Awareness recorded. Decide whether to escalate to a CRA Art. 14 vulnerability report.');
  }
  return parts.join(' ');
}

// --- Awareness evidence (P10b-2) ---

/**
 * Canonical evidence document hashed and submitted to the RFC 3161 TSA.
 * The schema_version field guards against future breaking changes — a
 * verifier reading a legacy attestation can still decode it correctly.
 *
 * Field selection rationale: every field that materially defines the
 * regulatory situation at the awareness moment must be in the document,
 * so a future audit can reconstruct exactly what CRANIS2 told the
 * manufacturer about. The TSA-signed hash binds the entire snapshot to
 * a verifiable wall-clock moment.
 */
export interface AwarenessEvidence {
  schema_version: '1';
  awareness_at: string; // ISO 8601 UTC
  org_id: string;
  product_id: string;
  finding: {
    id: string;
    source: string;
    source_id: string;
    severity: string;
    cvss_score: number | null;
    dependency_purl: string;
    kev_listed: boolean;
    kev_due_date: string | null;
    kev_known_ransomware: boolean;
    epss_score: number | null;
    epss_percentile: number | null;
  };
  trigger_reason: TriggerReason;
}

/**
 * Stable JSON serialisation: keys sorted at every nesting level, no
 * incidental whitespace. This guarantees the SHA-256 hash is a function
 * of the *content* and not of insertion order or formatting choices.
 */
export function canonicalJson(value: unknown): string {
  function sortKeys(v: unknown): unknown {
    if (v === null || typeof v !== 'object' || v instanceof Date) return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  }
  return JSON.stringify(sortKeys(value));
}

export interface EvidenceFinding {
  id: string;
  source: string;
  sourceId: string;
  severity: string;
  cvssScore: number | null;
  dependencyPurl: string;
  kevListed: boolean;
  kevDueDate: string | null;
  kevKnownRansomware: boolean;
  epssScore: number | null;
  epssPercentile: number | null;
}

/**
 * Build the canonical awareness-evidence document. Pure function — every
 * input is captured explicitly, no NOW()-style implicit time, no DB
 * lookups. Same inputs → byte-identical output → same SHA-256.
 */
export function buildAwarenessEvidence(params: {
  awarenessAt: Date;
  orgId: string;
  productId: string;
  finding: EvidenceFinding;
  reason: TriggerReason;
}): AwarenessEvidence {
  const { awarenessAt, orgId, productId, finding, reason } = params;
  return {
    schema_version: '1',
    awareness_at: awarenessAt.toISOString(),
    org_id: orgId,
    product_id: productId,
    finding: {
      id: finding.id,
      source: finding.source,
      source_id: finding.sourceId,
      severity: finding.severity,
      cvss_score: finding.cvssScore,
      dependency_purl: finding.dependencyPurl,
      kev_listed: finding.kevListed,
      kev_due_date: finding.kevDueDate,
      kev_known_ransomware: finding.kevKnownRansomware,
      epss_score: finding.epssScore,
      epss_percentile: finding.epssPercentile,
    },
    trigger_reason: reason,
  };
}

export function hashAwarenessEvidence(evidence: AwarenessEvidence): string {
  return createHash('sha256').update(canonicalJson(evidence), 'utf8').digest('hex');
}

/**
 * Submit the awareness-evidence hash to the configured RFC 3161 TSA and
 * persist the returned token onto the report row. Non-blocking: a TSA
 * failure logs and returns false — the report still exists with its
 * evidence document and hash, and the next engine pass's backfill loop
 * will retry.
 */
async function stampAwarenessAttestation(reportId: string, evidenceHash: string): Promise<boolean> {
  try {
    const tsaUrl = getTsaUrl();
    const token = await requestTimestamp(evidenceHash, tsaUrl);
    await pool.query(
      `UPDATE cra_reports
       SET awareness_tsa_token = $1::bytea,
           awareness_tsa_url = $2,
           awareness_attested_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [token, tsaUrl, reportId]
    );
    console.log(
      '[CRA-TRIGGER] TSA attestation completed for report ' + reportId.slice(0, 8) +
      ' (' + token.length + ' bytes from ' + tsaUrl + ')'
    );
    return true;
  } catch (err: any) {
    console.error(
      '[CRA-TRIGGER] TSA attestation failed (non-blocking) for report ' + reportId + ': ' +
      (err?.message || err)
    );
    return false;
  }
}

/**
 * Retry RFC 3161 stamping for any auto-triggered report that has an
 * evidence hash but no token yet. Bounded by the LIMIT so a long-running
 * outage doesn't make a single engine pass try to stamp thousands of
 * reports at once.
 */
async function backfillMissingAttestations(): Promise<{ stamped: number; failures: number }> {
  const pending = await pool.query(
    `SELECT id, awareness_evidence_hash
     FROM cra_reports
     WHERE auto_triggered = TRUE
       AND awareness_evidence_hash IS NOT NULL
       AND awareness_tsa_token IS NULL
     ORDER BY created_at ASC
     LIMIT 50`
  );

  let stamped = 0;
  let failures = 0;
  for (const row of pending.rows) {
    const ok = await stampAwarenessAttestation(row.id, row.awareness_evidence_hash);
    if (ok) stamped++;
    else failures++;
  }
  if (pending.rows.length > 0) {
    console.log('[CRA-TRIGGER] Backfill: ' + stamped + ' stamped, ' + failures + ' still pending');
  }
  return { stamped, failures };
}

// --- Engine entry point ---

export interface TriggerRunResult {
  created: number;
  alerted: number;
  attestationsStamped: number;
  attestationsPending: number;
  errors: string[];
}

/**
 * Run one pass of the trigger engine. Idempotent — running on a quiet day
 * is a no-op; running after a KEV refresh that added a new entry will
 * create exactly one report per affected finding (the unique index +
 * pre-insert check protect against concurrent runs and re-runs).
 */
export async function runCraTriggerEngine(): Promise<TriggerRunResult> {
  const policy = await loadTriggerPolicy();
  if (!policy.enabled) {
    console.log('[CRA-TRIGGER] Engine disabled via platform_settings; skipping');
    return { created: 0, alerted: 0, attestationsStamped: 0, attestationsPending: 0, errors: [] };
  }

  console.log(
    '[CRA-TRIGGER] Engine starting (kevAction=' + policy.kevAction +
    ', epssThreshold=' + policy.epssThreshold + ')'
  );

  // Find open / acknowledged actively-exploited findings without an existing
  // auto-triggered report. Resolved / dismissed findings are excluded — the
  // manufacturer has already taken a decision on those, so re-triggering
  // would be noise. Includes source + dependency_purl so the awareness-
  // evidence document is complete (P10b-2).
  const candidates = await pool.query(
    `SELECT vf.id AS finding_id, vf.org_id, vf.product_id, vf.severity, vf.cvss_score,
            vf.source, vf.source_id, vf.title, vf.dependency_purl,
            vf.kev_listed, vf.kev_due_date, vf.kev_known_ransomware,
            vf.epss_score, vf.epss_percentile
     FROM vulnerability_findings vf
     LEFT JOIN cra_reports cr
            ON cr.linked_finding_id = vf.id AND cr.auto_triggered = TRUE
     WHERE vf.status IN ('open', 'acknowledged')
       AND cr.id IS NULL
       AND (vf.kev_listed = TRUE OR (vf.epss_score IS NOT NULL AND vf.epss_score >= $1))`,
    [policy.epssThreshold]
  );

  let created = 0;
  let alerted = 0;
  let attestationsStamped = 0;
  const errors: string[] = [];

  for (const row of candidates.rows) {
    const finding: CandidateFinding & { source: string; dependencyPurl: string } = {
      findingId: row.finding_id,
      orgId: row.org_id,
      productId: row.product_id,
      severity: row.severity,
      cvssScore: row.cvss_score !== null && row.cvss_score !== undefined ? parseFloat(row.cvss_score) : null,
      sourceId: row.source_id,
      title: row.title,
      source: row.source ?? '',
      dependencyPurl: row.dependency_purl ?? '',
      kevListed: row.kev_listed === true,
      kevDueDate: row.kev_due_date instanceof Date
        ? row.kev_due_date.toISOString().slice(0, 10)
        : (row.kev_due_date ?? null),
      kevKnownRansomware: row.kev_known_ransomware === true,
      epssScore: row.epss_score !== null && row.epss_score !== undefined ? parseFloat(row.epss_score) : null,
      epssPercentile: row.epss_percentile !== null && row.epss_percentile !== undefined ? parseFloat(row.epss_percentile) : null,
    };

    const reason = buildTriggerReason(finding, policy);
    if (!reason) continue;

    try {
      let reportId: string | null = null;
      let evidenceHash: string | null = null;
      if (reason.action === 'trigger') {
        const result = await createTriggerReport(finding, reason);
        reportId = result.reportId;
        evidenceHash = result.evidenceHash;
        if (reportId && result.created) created++;
      } else {
        alerted++;
      }
      await sendTriggerNotification(finding, reason, reportId);

      // Best-effort RFC 3161 attestation. Failure is non-blocking — the
      // backfill loop on the next engine pass retries.
      if (reportId && evidenceHash) {
        const ok = await stampAwarenessAttestation(reportId, evidenceHash);
        if (ok) attestationsStamped++;
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      errors.push(finding.findingId + ': ' + message);
      console.error('[CRA-TRIGGER] Error for finding ' + finding.findingId + ':', message);
    }
  }

  // Retry stamping for any earlier reports whose TSA round-trip failed.
  const backfill = await backfillMissingAttestations();
  attestationsStamped += backfill.stamped;

  console.log(
    '[CRA-TRIGGER] Complete: ' + created + ' reports created, ' +
    alerted + ' alerts only, ' + attestationsStamped + ' attestations stamped, ' +
    backfill.failures + ' attestations still pending, ' + errors.length + ' errors'
  );
  return {
    created,
    alerted,
    attestationsStamped,
    attestationsPending: backfill.failures,
    errors,
  };
}

interface CreateTriggerReportResult {
  reportId: string | null;
  evidenceHash: string | null;
  /** True if this call inserted a fresh row; false if a concurrent run had already inserted. */
  created: boolean;
}

async function createTriggerReport(
  finding: CandidateFinding & { source: string; dependencyPurl: string },
  reason: TriggerReason,
): Promise<CreateTriggerReportResult> {
  const awarenessAt = new Date();
  const deadlines = calculateAwarenessDeadlines(awarenessAt);

  // Pull org-level CSIRT country if configured (mirrors the manual route)
  const orgBilling = await pool.query(
    'SELECT csirt_country FROM org_billing WHERE org_id = $1',
    [finding.orgId]
  );
  const csirtCountry = orgBilling.rows[0]?.csirt_country ?? null;

  // Build the canonical awareness-evidence document and its hash. The hash
  // is what gets RFC 3161-stamped (asynchronously); the document is stored
  // alongside so a verifier can later recompute the hash and check the
  // TSA token's content reference.
  const evidence = buildAwarenessEvidence({
    awarenessAt,
    orgId: finding.orgId,
    productId: finding.productId,
    finding: {
      id: finding.findingId,
      source: finding.source,
      sourceId: finding.sourceId,
      severity: finding.severity,
      cvssScore: finding.cvssScore,
      dependencyPurl: finding.dependencyPurl,
      kevListed: finding.kevListed,
      kevDueDate: finding.kevDueDate,
      kevKnownRansomware: finding.kevKnownRansomware,
      epssScore: finding.epssScore,
      epssPercentile: finding.epssPercentile,
    },
    reason,
  });
  const evidenceHash = hashAwarenessEvidence(evidence);

  const result = await pool.query(
    `INSERT INTO cra_reports (
       org_id, product_id, report_type, status, awareness_at,
       early_warning_deadline, notification_deadline, final_report_deadline,
       csirt_country, linked_finding_id, sensitivity_tlp, created_by,
       actively_exploited, auto_triggered, trigger_reason,
       awareness_evidence_json, awareness_evidence_hash
     ) VALUES ($1, $2, 'vulnerability', 'draft', $3, $4, $5, $6, $7, $8, 'AMBER', NULL, TRUE, TRUE, $9::jsonb, $10::jsonb, $11)
     ON CONFLICT (linked_finding_id) WHERE auto_triggered = TRUE AND linked_finding_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      finding.orgId, finding.productId, awarenessAt,
      deadlines.earlyWarning, deadlines.notification, deadlines.finalReport,
      csirtCountry, finding.findingId, JSON.stringify(reason),
      JSON.stringify(evidence), evidenceHash,
    ]
  );

  if (result.rows.length === 0) {
    // Concurrent run already inserted the report — fetch the existing id +
    // hash so the notification can still link to it and the caller can
    // skip its own stamping (the concurrent run is responsible for that).
    const existing = await pool.query(
      `SELECT id, awareness_evidence_hash FROM cra_reports
       WHERE linked_finding_id = $1 AND auto_triggered = TRUE LIMIT 1`,
      [finding.findingId]
    );
    const row = existing.rows[0];
    return {
      reportId: row?.id ?? null,
      evidenceHash: row?.awareness_evidence_hash ?? null,
      created: false,
    };
  }

  return { reportId: result.rows[0].id, evidenceHash, created: true };
}

async function sendTriggerNotification(
  finding: CandidateFinding,
  reason: TriggerReason,
  reportId: string | null,
): Promise<void> {
  const title = reportId
    ? 'CRA Art. 14: incident auto-created — actively exploited vulnerability'
    : 'CRA Art. 14: actively exploited vulnerability detected';

  const body = buildNotificationBody(finding, reason, reportId);

  await createNotification({
    orgId: finding.orgId,
    type: 'cra_trigger',
    severity: 'critical',
    title,
    body,
    link: reportId ? '/vulnerability-reports/' + reportId : '/products/' + finding.productId,
    metadata: {
      findingId: finding.findingId,
      productId: finding.productId,
      reason,
      reportId,
    },
  }).catch((err: any) => console.error('[CRA-TRIGGER] Notification failed:', err?.message || err));
}
