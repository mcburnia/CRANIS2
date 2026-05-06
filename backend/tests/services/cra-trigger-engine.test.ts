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
 * P10b-1 — CRA Art. 14 trigger engine: pure-function unit tests.
 *
 * Covers the deterministic decision layer of cra-trigger-engine.ts:
 *   - parseTriggerPolicy (defaults, malformed inputs, valid overrides)
 *   - buildTriggerReason (KEV vs EPSS precedence, alert_only behaviour,
 *     threshold boundaries, no-signal case)
 *   - calculateAwarenessDeadlines (24h / 72h / 14-day windows)
 *   - buildNotificationBody (KEV vs EPSS phrasing, with / without report)
 *
 * Engine integration (DB writes, notifications, refreshThreatIntel
 * wire-up) is exercised end-to-end via the test backend; this file
 * stays pure so it runs fast and never hits the network.
 */

import { describe, it, expect } from 'vitest';
import {
  parseTriggerPolicy,
  DEFAULT_CRA_TRIGGER_POLICY,
  buildTriggerReason,
  calculateAwarenessDeadlines,
  buildNotificationBody,
  buildAwarenessEvidence,
  hashAwarenessEvidence,
  canonicalJson,
} from '../../src/services/cra-trigger-engine.js';
import type { CraTriggerPolicy, TriggerReason, EvidenceFinding } from '../../src/services/cra-trigger-engine.js';

describe('parseTriggerPolicy', () => {
  it('returns sensible defaults for an empty settings object', () => {
    expect(parseTriggerPolicy({})).toEqual(DEFAULT_CRA_TRIGGER_POLICY);
    expect(parseTriggerPolicy({}).enabled).toBe(true);
    expect(parseTriggerPolicy({}).kevAction).toBe('trigger');
    expect(parseTriggerPolicy({}).epssThreshold).toBe(0.95);
  });

  it('respects an explicit "enabled = false" kill-switch', () => {
    const policy = parseTriggerPolicy({ 'cra_trigger.enabled': false });
    expect(policy.enabled).toBe(false);
  });

  it('accepts kev_action = "alert_only" and rejects junk values', () => {
    expect(parseTriggerPolicy({ 'cra_trigger.kev_action': 'alert_only' }).kevAction).toBe('alert_only');
    expect(parseTriggerPolicy({ 'cra_trigger.kev_action': 'trigger' }).kevAction).toBe('trigger');
    expect(parseTriggerPolicy({ 'cra_trigger.kev_action': 'banana' }).kevAction).toBe('trigger');
    expect(parseTriggerPolicy({ 'cra_trigger.kev_action': null }).kevAction).toBe('trigger');
  });

  it('accepts a valid epss_threshold in [0, 1] and falls back to default for anything else', () => {
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': 0.5 }).epssThreshold).toBe(0.5);
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': 0.0 }).epssThreshold).toBe(0.0);
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': 1.0 }).epssThreshold).toBe(1.0);
    // Out of range or non-numeric → fallback to 0.95
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': 1.5 }).epssThreshold).toBe(0.95);
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': -0.1 }).epssThreshold).toBe(0.95);
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': '0.5' }).epssThreshold).toBe(0.95);
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': null }).epssThreshold).toBe(0.95);
    expect(parseTriggerPolicy({ 'cra_trigger.epss_threshold': NaN }).epssThreshold).toBe(0.95);
  });
});

describe('buildTriggerReason', () => {
  const policy: CraTriggerPolicy = { ...DEFAULT_CRA_TRIGGER_POLICY };

  it('returns null when neither KEV nor EPSS meets the threshold', () => {
    expect(buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: 0.5, epssPercentile: 0.5,
    }, policy)).toBe(null);
  });

  it('returns null when EPSS is null and KEV not listed', () => {
    expect(buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: null, epssPercentile: null,
    }, policy)).toBe(null);
  });

  it('triggers on KEV listing regardless of EPSS', () => {
    const reason = buildTriggerReason({
      kevListed: true, kevDueDate: '2021-12-24', kevKnownRansomware: true,
      epssScore: 0.0001, epssPercentile: 0.05,
    }, policy);
    expect(reason).not.toBe(null);
    expect(reason!.source).toBe('kev');
    expect(reason!.action).toBe('trigger');
    expect(reason!.kev?.dueDate).toBe('2021-12-24');
    expect(reason!.kev?.knownRansomware).toBe(true);
  });

  it('downgrades KEV path to alert_only when policy says so', () => {
    const alertPolicy: CraTriggerPolicy = { ...policy, kevAction: 'alert_only' };
    const reason = buildTriggerReason({
      kevListed: true, kevDueDate: null, kevKnownRansomware: false,
      epssScore: null, epssPercentile: null,
    }, alertPolicy);
    expect(reason).not.toBe(null);
    expect(reason!.source).toBe('kev');
    expect(reason!.action).toBe('alert_only');
  });

  it('triggers on EPSS at or above threshold (boundary check)', () => {
    const reason = buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: 0.95, epssPercentile: 0.99,
    }, policy);
    expect(reason).not.toBe(null);
    expect(reason!.source).toBe('epss');
    expect(reason!.action).toBe('trigger');
    expect(reason!.epss?.score).toBe(0.95);
    expect(reason!.epss?.threshold).toBe(0.95);
  });

  it('does not trigger on EPSS just below the threshold', () => {
    expect(buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: 0.9499, epssPercentile: 0.99,
    }, policy)).toBe(null);
  });

  it('respects a custom EPSS threshold', () => {
    const tightPolicy: CraTriggerPolicy = { ...policy, epssThreshold: 0.5 };
    const reason = buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: 0.55, epssPercentile: 0.7,
    }, tightPolicy);
    expect(reason).not.toBe(null);
    expect(reason!.source).toBe('epss');
    expect(reason!.epss?.threshold).toBe(0.5);
  });

  it('rejects a non-finite EPSS score (defensive against bad data)', () => {
    expect(buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: NaN, epssPercentile: null,
    }, policy)).toBe(null);
    expect(buildTriggerReason({
      kevListed: false, kevDueDate: null, kevKnownRansomware: false,
      epssScore: Infinity, epssPercentile: null,
    }, policy)).toBe(null);
  });
});

describe('calculateAwarenessDeadlines', () => {
  it('produces 24h / 72h / 14-day deadlines from an awareness moment', () => {
    const awarenessAt = new Date('2026-05-06T10:00:00.000Z');
    const d = calculateAwarenessDeadlines(awarenessAt);
    expect(d.earlyWarning.toISOString()).toBe('2026-05-07T10:00:00.000Z');
    expect(d.notification.toISOString()).toBe('2026-05-09T10:00:00.000Z');
    expect(d.finalReport.toISOString()).toBe('2026-05-20T10:00:00.000Z');
  });

  it('handles awareness near a month / year boundary correctly', () => {
    const awarenessAt = new Date('2026-12-30T23:59:00.000Z');
    const d = calculateAwarenessDeadlines(awarenessAt);
    expect(d.earlyWarning.toISOString()).toBe('2026-12-31T23:59:00.000Z');
    expect(d.notification.toISOString()).toBe('2027-01-02T23:59:00.000Z');
    expect(d.finalReport.toISOString()).toBe('2027-01-13T23:59:00.000Z');
  });

  it('returns three independent Date instances (no shared mutation)', () => {
    const awarenessAt = new Date('2026-05-06T10:00:00.000Z');
    const d = calculateAwarenessDeadlines(awarenessAt);
    d.earlyWarning.setUTCFullYear(2099);
    expect(d.notification.toISOString()).toBe('2026-05-09T10:00:00.000Z'); // unaffected
  });
});

describe('buildNotificationBody', () => {
  function kevReason(overrides?: Partial<NonNullable<TriggerReason['kev']>>): TriggerReason {
    return {
      source: 'kev',
      action: 'trigger',
      kev: { dueDate: '2021-12-24', knownRansomware: true, ...overrides },
    };
  }

  function epssReason(score = 0.97, threshold = 0.95): TriggerReason {
    return {
      source: 'epss',
      action: 'trigger',
      epss: { score, percentile: 0.99, threshold },
    };
  }

  it('KEV body names CISA KEV, due date, ransomware, and 24-hour clock when a report exists', () => {
    const body = buildNotificationBody(
      { sourceId: 'CVE-2021-44228', productId: 'p-1' },
      kevReason(),
      'r-1'
    );
    expect(body).toContain('CVE-2021-44228');
    expect(body).toContain('CISA');
    expect(body).toContain('Known Exploited Vulnerabilities');
    expect(body).toContain('2021-12-24');
    expect(body).toContain('ransomware');
    expect(body).toContain('24-hour ENISA early-warning');
  });

  it('KEV body without due date / ransomware skips those clauses cleanly', () => {
    const body = buildNotificationBody(
      { sourceId: 'CVE-2024-12345', productId: 'p-1' },
      kevReason({ dueDate: null, knownRansomware: false }),
      'r-2'
    );
    expect(body).toContain('CVE-2024-12345');
    expect(body).toContain('CISA');
    expect(body).not.toContain('CISA federal due date');
    expect(body).not.toContain('ransomware');
  });

  it('EPSS body names the score, threshold, and exploitation framing', () => {
    const body = buildNotificationBody(
      { sourceId: 'CVE-2026-00001', productId: 'p-3' },
      epssReason(0.9712, 0.95),
      'r-3'
    );
    expect(body).toContain('CVE-2026-00001');
    expect(body).toContain('EPSS score 0.9712');
    expect(body).toContain('threshold 0.95');
    expect(body).toContain('30 days');
  });

  it('alert_only body (no report) wording differs from triggered body', () => {
    const triggeredBody = buildNotificationBody(
      { sourceId: 'CVE-X', productId: 'p' },
      kevReason(),
      'r-id'
    );
    const alertBody = buildNotificationBody(
      { sourceId: 'CVE-X', productId: 'p' },
      kevReason(),
      null
    );
    expect(triggeredBody).toContain('auto-created');
    expect(triggeredBody).toContain('clock has started');
    expect(alertBody).toContain('Awareness recorded');
    expect(alertBody).not.toContain('auto-created');
  });
});

describe('canonicalJson (P10b-2)', () => {
  it('produces identical output for objects with different key insertion orders', () => {
    const a = { z: 1, a: { y: 2, x: 3 } };
    const b = { a: { x: 3, y: 2 }, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('preserves array order (only object keys are sorted)', () => {
    expect(canonicalJson({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}');
  });

  it('handles null / number / string / boolean primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson(true)).toBe('true');
  });

  it('emits compact JSON (no whitespace between tokens)', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });
});

describe('buildAwarenessEvidence + hashAwarenessEvidence (P10b-2)', () => {
  const baseFinding: EvidenceFinding = {
    id: 'f-1',
    source: 'nvd',
    sourceId: 'CVE-2021-44228',
    severity: 'critical',
    cvssScore: 10.0,
    dependencyPurl: 'pkg:maven/log4j-core@2.14.0',
    kevListed: true,
    kevDueDate: '2021-12-24',
    kevKnownRansomware: true,
    epssScore: 0.9753,
    epssPercentile: 0.9999,
  };
  const baseReason: TriggerReason = {
    source: 'kev',
    action: 'trigger',
    kev: { dueDate: '2021-12-24', knownRansomware: true },
  };
  const awarenessAt = new Date('2026-05-06T10:00:00.000Z');

  it('produces a complete document with all evidence fields', () => {
    const ev = buildAwarenessEvidence({
      awarenessAt,
      orgId: 'org-1',
      productId: 'prod-1',
      finding: baseFinding,
      reason: baseReason,
    });
    expect(ev.schema_version).toBe('1');
    expect(ev.awareness_at).toBe('2026-05-06T10:00:00.000Z');
    expect(ev.org_id).toBe('org-1');
    expect(ev.product_id).toBe('prod-1');
    expect(ev.finding.id).toBe('f-1');
    expect(ev.finding.source_id).toBe('CVE-2021-44228');
    expect(ev.finding.kev_listed).toBe(true);
    expect(ev.finding.epss_score).toBe(0.9753);
    expect(ev.trigger_reason.source).toBe('kev');
  });

  it('produces a deterministic hash — same inputs → same hash', () => {
    const ev1 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: baseFinding, reason: baseReason });
    const ev2 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: baseFinding, reason: baseReason });
    expect(hashAwarenessEvidence(ev1)).toBe(hashAwarenessEvidence(ev2));
    expect(hashAwarenessEvidence(ev1)).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it('produces a different hash when the awareness moment changes', () => {
    const ev1 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: baseFinding, reason: baseReason });
    const ev2 = buildAwarenessEvidence({
      awarenessAt: new Date('2026-05-06T10:00:01.000Z'),
      orgId: 'o', productId: 'p', finding: baseFinding, reason: baseReason,
    });
    expect(hashAwarenessEvidence(ev1)).not.toBe(hashAwarenessEvidence(ev2));
  });

  it('produces a different hash when the finding state changes (CVSS bumped)', () => {
    const ev1 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: baseFinding, reason: baseReason });
    const ev2 = buildAwarenessEvidence({
      awarenessAt, orgId: 'o', productId: 'p',
      finding: { ...baseFinding, cvssScore: 9.5 },
      reason: baseReason,
    });
    expect(hashAwarenessEvidence(ev1)).not.toBe(hashAwarenessEvidence(ev2));
  });

  it('produces a different hash when the trigger reason changes (KEV → EPSS)', () => {
    const ev1 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: baseFinding, reason: baseReason });
    const epssReason: TriggerReason = {
      source: 'epss',
      action: 'trigger',
      epss: { score: 0.97, percentile: 0.99, threshold: 0.95 },
    };
    const ev2 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: baseFinding, reason: epssReason });
    expect(hashAwarenessEvidence(ev1)).not.toBe(hashAwarenessEvidence(ev2));
  });

  it('produces the SAME hash regardless of finding-field iteration order in source data', () => {
    // Even if upstream code constructs the finding object with keys in a
    // different order, the canonicalisation guarantees a stable hash.
    const findingForward: EvidenceFinding = {
      id: 'f', source: 'nvd', sourceId: 'CVE-X', severity: 'high',
      cvssScore: 8.0, dependencyPurl: 'p', kevListed: false, kevDueDate: null,
      kevKnownRansomware: false, epssScore: 0.96, epssPercentile: 0.99,
    };
    // Same logical content, different literal order
    const findingReverse = {
      epssPercentile: 0.99, epssScore: 0.96, kevKnownRansomware: false,
      kevDueDate: null, kevListed: false, dependencyPurl: 'p', cvssScore: 8.0,
      severity: 'high', sourceId: 'CVE-X', source: 'nvd', id: 'f',
    } as EvidenceFinding;

    const reason: TriggerReason = {
      source: 'epss',
      action: 'trigger',
      epss: { score: 0.96, percentile: 0.99, threshold: 0.95 },
    };
    const ev1 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: findingForward, reason });
    const ev2 = buildAwarenessEvidence({ awarenessAt, orgId: 'o', productId: 'p', finding: findingReverse, reason });
    expect(hashAwarenessEvidence(ev1)).toBe(hashAwarenessEvidence(ev2));
  });
});
