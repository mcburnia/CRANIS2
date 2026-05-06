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
 * P10c — regulatory-state pure helpers: unit tests.
 *
 * Covers the deterministic derivation layer behind the
 * /api/cra-reports/regulatory-state/:productId endpoint:
 *   - formatHoursRemaining (units, overdue branch, < 1h branch)
 *   - deriveReportState (status → stage mapping, deadline maths, overdue flag)
 *   - summariseRegulatoryState (overdue / urgent / approaching buckets)
 *   - findSoonestReport (overdue beats future; ties handled deterministically)
 */

import { describe, it, expect } from 'vitest';
import {
  formatHoursRemaining,
  deriveReportState,
  summariseRegulatoryState,
  findSoonestReport,
} from '../../src/services/regulatory-state.js';
import type { ReportRow, DerivedReportState } from '../../src/services/regulatory-state.js';

describe('formatHoursRemaining', () => {
  it('formats negative (overdue) values < 24h as "Xh overdue"', () => {
    expect(formatHoursRemaining(-0.5)).toBe('1h overdue');
    expect(formatHoursRemaining(-3)).toBe('3h overdue');
    expect(formatHoursRemaining(-23.9)).toBe('24h overdue');
  });

  it('formats negative values ≥ 24h as "Xd overdue"', () => {
    expect(formatHoursRemaining(-25)).toBe('2d overdue'); // ceil(25/24) = 2
    expect(formatHoursRemaining(-72)).toBe('3d overdue');
  });

  it('formats < 1h positive values as minutes', () => {
    expect(formatHoursRemaining(0.5)).toBe('30m remaining');
    expect(formatHoursRemaining(0.75)).toBe('45m remaining');
  });

  it('formats 1h–48h positive values as hours', () => {
    expect(formatHoursRemaining(1)).toBe('1h remaining');
    expect(formatHoursRemaining(22.4)).toBe('23h remaining');
    expect(formatHoursRemaining(47.9)).toBe('48h remaining');
  });

  it('formats ≥ 48h as days', () => {
    expect(formatHoursRemaining(48)).toBe('2d remaining'); // ceil(48/24) = 2
    expect(formatHoursRemaining(72)).toBe('3d remaining');
    expect(formatHoursRemaining(336)).toBe('14d remaining');
  });
});

describe('deriveReportState', () => {
  const now = new Date('2026-05-06T10:00:00.000Z');

  function row(over: Partial<ReportRow> = {}): ReportRow {
    return {
      id: 'r-1',
      report_type: 'vulnerability',
      status: 'draft',
      awareness_at: '2026-05-06T08:00:00.000Z',
      early_warning_deadline: '2026-05-07T08:00:00.000Z',
      notification_deadline: '2026-05-09T08:00:00.000Z',
      final_report_deadline: '2026-05-20T08:00:00.000Z',
      actively_exploited: false,
      auto_triggered: false,
      awareness_attested_at: null,
      linked_finding_id: null,
      ...over,
    };
  }

  it('maps status=draft to the early-warning stage with 24h label', () => {
    const s = deriveReportState(row(), now);
    expect(s.stage).toBe('early_warning');
    expect(s.stageLabel).toBe('Early Warning (24h)');
    expect(s.nextDeadline).toBe('2026-05-07T08:00:00.000Z');
    expect(s.hoursRemaining?.value).toBeCloseTo(22, 1);
    expect(s.hoursRemaining?.label).toBe('22h remaining');
    expect(s.isOverdue).toBe(false);
  });

  it('maps status=early_warning_sent to the notification stage with 72h label', () => {
    const s = deriveReportState(row({ status: 'early_warning_sent' }), now);
    expect(s.stage).toBe('notification');
    expect(s.stageLabel).toBe('Full Notification (72h)');
    expect(s.nextDeadline).toBe('2026-05-09T08:00:00.000Z');
  });

  it('maps status=notification_sent for a vulnerability report to "Final Report (14 days)"', () => {
    const s = deriveReportState(row({ status: 'notification_sent', report_type: 'vulnerability' }), now);
    expect(s.stage).toBe('final_report');
    expect(s.stageLabel).toBe('Final Report (14 days)');
  });

  it('maps status=notification_sent for an incident report to "Final Report (1 month)"', () => {
    const s = deriveReportState(row({ status: 'notification_sent', report_type: 'incident' }), now);
    expect(s.stage).toBe('final_report');
    expect(s.stageLabel).toBe('Final Report (1 month)');
  });

  it('returns null stage / no deadline for a status with no upcoming stage (e.g. final_report_sent)', () => {
    const s = deriveReportState(row({ status: 'final_report_sent' }), now);
    expect(s.stage).toBe(null);
    expect(s.stageLabel).toBe(null);
    expect(s.nextDeadline).toBe(null);
    expect(s.hoursRemaining).toBe(null);
    expect(s.isOverdue).toBe(false);
  });

  it('flags an overdue deadline correctly', () => {
    const lateNow = new Date('2026-05-08T10:00:00.000Z');
    const s = deriveReportState(row(), lateNow);
    expect(s.isOverdue).toBe(true);
    expect(s.hoursRemaining?.value).toBeCloseTo(-26, 1);
    expect(s.hoursRemaining?.label).toBe('2d overdue');
  });

  it('passes through actively_exploited / auto_triggered flags as booleans', () => {
    const s = deriveReportState(row({ actively_exploited: true, auto_triggered: true }), now);
    expect(s.activelyExploited).toBe(true);
    expect(s.autoTriggered).toBe(true);
  });
});

describe('summariseRegulatoryState', () => {
  function s(overrides: Partial<DerivedReportState> = {}): DerivedReportState {
    return {
      reportId: 'r', reportType: 'vulnerability', status: 'draft',
      awarenessAt: null, activelyExploited: false, autoTriggered: false,
      awarenessAttestedAt: null, linkedFindingId: null,
      nextDeadline: null, stage: null, stageLabel: null,
      hoursRemaining: null, isOverdue: false,
      ...overrides,
    };
  }

  it('counts overdue / urgent / approaching into the right buckets', () => {
    const reports: DerivedReportState[] = [
      s({ hoursRemaining: { value: -3, label: '' }, isOverdue: true }),       // overdue
      s({ hoursRemaining: { value: 1, label: '' } }),                          // urgent
      s({ hoursRemaining: { value: 4, label: '' } }),                          // urgent (boundary)
      s({ hoursRemaining: { value: 4.1, label: '' } }),                        // approaching
      s({ hoursRemaining: { value: 24, label: '' } }),                         // approaching (boundary)
      s({ hoursRemaining: { value: 24.1, label: '' } }),                       // beyond approaching
      s({ hoursRemaining: null }),                                              // no deadline
    ];
    const summary = summariseRegulatoryState(reports);
    expect(summary.total).toBe(7);
    expect(summary.overdue).toBe(1);
    expect(summary.urgent).toBe(2);
    expect(summary.approaching).toBe(2);
  });

  it('counts autoTriggered and activelyExploited independently of urgency', () => {
    const reports: DerivedReportState[] = [
      s({ autoTriggered: true, activelyExploited: true }),
      s({ autoTriggered: true }),
      s({ activelyExploited: true }),
      s({}),
    ];
    const summary = summariseRegulatoryState(reports);
    expect(summary.autoTriggered).toBe(2);
    expect(summary.activelyExploited).toBe(2);
    expect(summary.total).toBe(4);
  });

  it('returns zero counts for an empty input', () => {
    expect(summariseRegulatoryState([])).toEqual({
      total: 0, overdue: 0, urgent: 0, approaching: 0,
      autoTriggered: 0, activelyExploited: 0,
    });
  });
});

describe('findSoonestReport', () => {
  function s(reportId: string, hoursValue: number | null): DerivedReportState {
    return {
      reportId, reportType: 'vulnerability', status: 'draft',
      awarenessAt: null, activelyExploited: false, autoTriggered: false,
      awarenessAttestedAt: null, linkedFindingId: null,
      nextDeadline: null, stage: null, stageLabel: null,
      hoursRemaining: hoursValue === null ? null : { value: hoursValue, label: '' },
      isOverdue: hoursValue !== null && hoursValue < 0,
    };
  }

  it('returns null when no report has a deadline', () => {
    expect(findSoonestReport([s('a', null), s('b', null)])).toBe(null);
  });

  it('returns null for an empty input', () => {
    expect(findSoonestReport([])).toBe(null);
  });

  it('returns the report with the smallest hoursRemaining', () => {
    const result = findSoonestReport([
      s('a', 22),
      s('b', 1),
      s('c', 100),
    ]);
    expect(result?.reportId).toBe('b');
  });

  it('ranks an overdue report (negative hours) ahead of any future report', () => {
    const result = findSoonestReport([
      s('a', 22),
      s('b', -3), // overdue 3 hours
      s('c', 1),
    ]);
    expect(result?.reportId).toBe('b');
  });

  it('skips reports with null hoursRemaining', () => {
    const result = findSoonestReport([
      s('a', null),
      s('b', 5),
      s('c', null),
    ]);
    expect(result?.reportId).toBe('b');
  });
});
