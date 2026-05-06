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
 * P10d — submission-attestation pure helpers: unit tests.
 *
 * Covers the deterministic evidence-document layer used by
 * stage-submission to anchor a regulator-bound transmission to a
 * tamper-evident hash:
 *   - buildSubmissionEvidence (complete-document construction)
 *   - hashSubmissionEvidence (determinism, content-sensitivity)
 *
 * The TSA round-trip itself (stampSubmissionAttestation) is not unit-
 * tested here — it depends on FreeTSA being reachable. The route-level
 * end-to-end behaviour is covered by the existing cra-reports route
 * tests, which now pass `authorise: true` and check that the response
 * surfaces the new attestation fields.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSubmissionEvidence,
  hashSubmissionEvidence,
} from '../../src/services/submission-attestation.js';
import type { BuildSubmissionEvidenceParams } from '../../src/services/submission-attestation.js';

function baseParams(overrides: Partial<BuildSubmissionEvidenceParams> = {}): BuildSubmissionEvidenceParams {
  return {
    submittedAt: new Date('2026-05-06T10:00:00.000Z'),
    reportId: 'r-abc-123',
    stage: 'early_warning',
    content: { summary: 'Test summary', vulnerabilityDetails: 'Test details' },
    userId: 'u-xyz-789',
    email: 'submitter@example.com',
    ip: '198.51.100.42',
    userAgent: 'Mozilla/5.0 (test)',
    ...overrides,
  };
}

describe('buildSubmissionEvidence', () => {
  it('produces a complete document with all required fields', () => {
    const ev = buildSubmissionEvidence(baseParams());
    expect(ev.schema_version).toBe('1');
    expect(ev.submitted_at).toBe('2026-05-06T10:00:00.000Z');
    expect(ev.report_id).toBe('r-abc-123');
    expect(ev.stage).toBe('early_warning');
    expect(ev.content).toEqual({ summary: 'Test summary', vulnerabilityDetails: 'Test details' });
    expect(ev.authorised_by.user_id).toBe('u-xyz-789');
    expect(ev.authorised_by.email).toBe('submitter@example.com');
    expect(ev.authorised_by.ip).toBe('198.51.100.42');
    expect(ev.authorised_by.user_agent).toBe('Mozilla/5.0 (test)');
  });

  it('preserves null IP and user-agent (e.g. when extractRequestData returned "unknown")', () => {
    const ev = buildSubmissionEvidence(baseParams({ ip: null, userAgent: null }));
    expect(ev.authorised_by.ip).toBe(null);
    expect(ev.authorised_by.user_agent).toBe(null);
  });
});

describe('hashSubmissionEvidence', () => {
  it('produces a deterministic SHA-256 hex hash for identical inputs', () => {
    const a = buildSubmissionEvidence(baseParams());
    const b = buildSubmissionEvidence(baseParams());
    const ha = hashSubmissionEvidence(a);
    const hb = hashSubmissionEvidence(b);
    expect(ha).toBe(hb);
    expect(ha).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the content changes (audit-trail integrity)', () => {
    const a = buildSubmissionEvidence(baseParams());
    const b = buildSubmissionEvidence(baseParams({ content: { summary: 'DIFFERENT' } }));
    expect(hashSubmissionEvidence(a)).not.toBe(hashSubmissionEvidence(b));
  });

  it('changes when the stage changes', () => {
    const a = buildSubmissionEvidence(baseParams({ stage: 'early_warning' }));
    const b = buildSubmissionEvidence(baseParams({ stage: 'notification' }));
    expect(hashSubmissionEvidence(a)).not.toBe(hashSubmissionEvidence(b));
  });

  it('changes when the authoriser identity changes', () => {
    const a = buildSubmissionEvidence(baseParams({ email: 'alice@example.com' }));
    const b = buildSubmissionEvidence(baseParams({ email: 'bob@example.com' }));
    expect(hashSubmissionEvidence(a)).not.toBe(hashSubmissionEvidence(b));
  });

  it('changes when the submission moment changes (1-second granularity)', () => {
    const a = buildSubmissionEvidence(baseParams({ submittedAt: new Date('2026-05-06T10:00:00.000Z') }));
    const b = buildSubmissionEvidence(baseParams({ submittedAt: new Date('2026-05-06T10:00:01.000Z') }));
    expect(hashSubmissionEvidence(a)).not.toBe(hashSubmissionEvidence(b));
  });

  it('produces the SAME hash regardless of content key insertion order', () => {
    const forward = buildSubmissionEvidence(baseParams({ content: { a: 1, b: 2, c: 3 } }));
    const reverse = buildSubmissionEvidence(baseParams({ content: { c: 3, b: 2, a: 1 } }));
    expect(hashSubmissionEvidence(forward)).toBe(hashSubmissionEvidence(reverse));
  });

  it('produces a hash that an external verifier can re-derive from the stored JSON', () => {
    // This is the core legal-defensibility property: an auditor with the
    // stored evidence document can recompute the hash and check it matches
    // what the TSA token was anchored to. We verify that round-tripping
    // through JSON.parse / re-build / re-hash produces the same result.
    const original = buildSubmissionEvidence(baseParams());
    const originalHash = hashSubmissionEvidence(original);

    // Simulate "stored JSON" — it goes through Postgres JSONB which loses
    // key insertion order; the canonicalisation is what saves us.
    const persisted = JSON.parse(JSON.stringify(original));
    const reBuilt = buildSubmissionEvidence({
      submittedAt: new Date(persisted.submitted_at),
      reportId: persisted.report_id,
      stage: persisted.stage,
      content: persisted.content,
      userId: persisted.authorised_by.user_id,
      email: persisted.authorised_by.email,
      ip: persisted.authorised_by.ip,
      userAgent: persisted.authorised_by.user_agent,
    });
    expect(hashSubmissionEvidence(reBuilt)).toBe(originalHash);
  });
});
