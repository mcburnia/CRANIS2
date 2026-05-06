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
 * P10d — Submission authorisation attestation.
 *
 * Outbound counterpart to P10b-2's awareness attestation. When a user
 * submits a CRA Art. 14 stage (early warning / notification / final
 * report) to ENISA or the CSIRT via CRANIS2, this module:
 *
 *   1. Captures an explicit authorisation record: who submitted, from
 *      what session (IP + user-agent), at what wall-clock moment, and
 *      what content. The full content is in the document, so a verifier
 *      can later reconstruct exactly what was sent.
 *   2. Builds a canonical JSON evidence document (stable key order, no
 *      whitespace) and SHA-256 hashes it.
 *   3. Submits the hash to the configured RFC 3161 TSA for a signed
 *      timestamp token. Non-blocking: a TSA failure logs and returns
 *      false — the stage row already exists with its evidence document
 *      and hash, so the next backfill pass retries.
 *
 * Together these make "user X authorised submission of stage Y of
 * report Z at moment T with content C" a tamper-evident assertion
 * verifiable independently of CRANIS2's own clock or database.
 *
 * Human-in-the-loop guarantee: this module is only invoked by the
 * stage-submit route handler, which only runs in response to an
 * explicit POST request from an authenticated user. The trigger engine
 * (P10b) never auto-submits — it can only auto-create reports.
 */

import pool from '../db/pool.js';
import { createHash } from 'crypto';
import { canonicalJson } from './cra-trigger-engine.js';
import { requestTimestamp, getTsaUrl } from './rfc3161.js';

export interface SubmissionEvidence {
  schema_version: '1';
  submitted_at: string; // ISO 8601 UTC
  report_id: string;
  stage: string;
  content: Record<string, unknown>;
  authorised_by: {
    user_id: string | null;
    email: string;
    ip: string | null;
    user_agent: string | null;
  };
}

export interface BuildSubmissionEvidenceParams {
  submittedAt: Date;
  reportId: string;
  stage: string;
  content: Record<string, unknown>;
  userId: string | null;
  email: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Build the canonical authorisation-evidence document. Pure function —
 * every input is captured explicitly, no NOW() implicit time. Same
 * inputs → byte-identical output → same SHA-256.
 */
export function buildSubmissionEvidence(params: BuildSubmissionEvidenceParams): SubmissionEvidence {
  return {
    schema_version: '1',
    submitted_at: params.submittedAt.toISOString(),
    report_id: params.reportId,
    stage: params.stage,
    content: params.content,
    authorised_by: {
      user_id: params.userId,
      email: params.email,
      ip: params.ip,
      user_agent: params.userAgent,
    },
  };
}

export function hashSubmissionEvidence(evidence: SubmissionEvidence): string {
  return createHash('sha256').update(canonicalJson(evidence), 'utf8').digest('hex');
}

/**
 * Submit the submission-evidence hash to the configured RFC 3161 TSA
 * and persist the returned token onto the stage row. Non-blocking — a
 * TSA failure logs and returns false. The stage already exists with
 * its evidence document and hash; backfillPendingSubmissionAttestations
 * (called from a scheduled job) retries on the next pass.
 */
export async function stampSubmissionAttestation(stageId: string, evidenceHash: string): Promise<boolean> {
  try {
    const tsaUrl = getTsaUrl();
    const token = await requestTimestamp(evidenceHash, tsaUrl);
    await pool.query(
      `UPDATE cra_report_stages
       SET submission_tsa_token = $1::bytea,
           submission_tsa_url = $2,
           submission_attested_at = NOW()
       WHERE id = $3`,
      [token, tsaUrl, stageId]
    );
    console.log(
      '[CRA-SUBMIT] TSA attestation completed for stage ' + stageId.slice(0, 8) +
      ' (' + token.length + ' bytes from ' + tsaUrl + ')'
    );
    return true;
  } catch (err: any) {
    console.error(
      '[CRA-SUBMIT] TSA attestation failed (non-blocking) for stage ' + stageId + ': ' +
      (err?.message || err)
    );
    return false;
  }
}

/**
 * Retry RFC 3161 stamping for any submitted stage that has an evidence
 * hash but no token yet. Bounded by LIMIT so a long TSA outage doesn't
 * make a single pass try to stamp thousands of rows at once.
 */
export async function backfillPendingSubmissionAttestations(): Promise<{ stamped: number; failures: number }> {
  const pending = await pool.query(
    `SELECT id, submission_evidence_hash
     FROM cra_report_stages
     WHERE submission_evidence_hash IS NOT NULL
       AND submission_tsa_token IS NULL
     ORDER BY submitted_at ASC
     LIMIT 50`
  );

  let stamped = 0;
  let failures = 0;
  for (const row of pending.rows) {
    const ok = await stampSubmissionAttestation(row.id, row.submission_evidence_hash);
    if (ok) stamped++;
    else failures++;
  }
  if (pending.rows.length > 0) {
    console.log('[CRA-SUBMIT] Backfill: ' + stamped + ' stamped, ' + failures + ' still pending');
  }
  return { stamped, failures };
}
