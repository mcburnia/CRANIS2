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
 * P10c — Pure helpers for CRA Art. 14 "regulatory state" derivation.
 *
 * Used by the /api/cra-reports/regulatory-state/:productId endpoint.
 * Extracted to its own module so it is unit-testable independently of
 * the database / Express layer.
 */

export interface ReportRow {
  id: string;
  report_type: 'vulnerability' | 'incident' | string;
  status: string;
  awareness_at: string | Date | null;
  early_warning_deadline: string | Date | null;
  notification_deadline: string | Date | null;
  final_report_deadline: string | Date | null;
  actively_exploited?: boolean | null;
  auto_triggered?: boolean | null;
  awareness_attested_at?: string | Date | null;
  linked_finding_id?: string | null;
  created_at?: string | Date | null;
}

export interface DerivedReportState {
  reportId: string;
  reportType: string;
  status: string;
  awarenessAt: string | Date | null;
  activelyExploited: boolean;
  autoTriggered: boolean;
  awarenessAttestedAt: string | Date | null | undefined;
  linkedFindingId: string | null | undefined;
  nextDeadline: string | null;
  stage: 'early_warning' | 'notification' | 'final_report' | null;
  stageLabel: string | null;
  hoursRemaining: { value: number; label: string } | null;
  isOverdue: boolean;
}

/**
 * Format a hours-remaining number into a friendly label.
 *
 * - Negative → "Xh overdue" (or "Xd overdue" past 24h)
 * - < 1h → "Xm remaining"
 * - 1h–48h → "Xh remaining"
 * - ≥ 48h → "Xd remaining"
 */
export function formatHoursRemaining(value: number): string {
  if (value < 0) {
    const overdueHours = Math.abs(value);
    return overdueHours < 24
      ? Math.ceil(overdueHours) + 'h overdue'
      : Math.ceil(overdueHours / 24) + 'd overdue';
  }
  if (value < 1) return Math.ceil(value * 60) + 'm remaining';
  if (value < 48) return Math.ceil(value) + 'h remaining';
  return Math.ceil(value / 24) + 'd remaining';
}

/**
 * Pure transformation: take a cra_reports row + a "now" instant, return
 * the frontend-facing derived state with the correct stage, deadline,
 * and remaining-time label for the report's current status.
 *
 * Status → stage mapping mirrors the existing checkCraDeadlines logic
 * in scheduler.ts: a report in 'draft' is working toward Early Warning
 * (24h), 'early_warning_sent' toward Full Notification (72h), and
 * 'notification_sent' toward Final Report (14 days for a vulnerability,
 * 1 month for an incident).
 */
export function deriveReportState(row: ReportRow, now: Date): DerivedReportState {
  let nextDeadline: Date | null = null;
  let stage: DerivedReportState['stage'] = null;
  let stageLabel: string | null = null;

  if (row.status === 'draft' && row.early_warning_deadline) {
    nextDeadline = new Date(row.early_warning_deadline as any);
    stage = 'early_warning';
    stageLabel = 'Early Warning (24h)';
  } else if (row.status === 'early_warning_sent' && row.notification_deadline) {
    nextDeadline = new Date(row.notification_deadline as any);
    stage = 'notification';
    stageLabel = 'Full Notification (72h)';
  } else if (row.status === 'notification_sent' && row.final_report_deadline) {
    nextDeadline = new Date(row.final_report_deadline as any);
    stage = 'final_report';
    stageLabel = row.report_type === 'incident'
      ? 'Final Report (1 month)'
      : 'Final Report (14 days)';
  }

  let hoursRemaining: { value: number; label: string } | null = null;
  if (nextDeadline) {
    const value = (nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    hoursRemaining = { value, label: formatHoursRemaining(value) };
  }

  return {
    reportId: row.id,
    reportType: row.report_type,
    status: row.status,
    awarenessAt: row.awareness_at,
    activelyExploited: row.actively_exploited === true,
    autoTriggered: row.auto_triggered === true,
    awarenessAttestedAt: row.awareness_attested_at ?? null,
    linkedFindingId: row.linked_finding_id ?? null,
    nextDeadline: nextDeadline ? nextDeadline.toISOString() : null,
    stage,
    stageLabel,
    hoursRemaining,
    isOverdue: hoursRemaining ? hoursRemaining.value < 0 : false,
  };
}

export interface RegulatoryStateSummary {
  total: number;
  overdue: number;
  urgent: number;
  approaching: number;
  autoTriggered: number;
  activelyExploited: number;
}

/**
 * Roll up an array of derived report states into per-product summary
 * counts. Buckets:
 *
 *   - overdue       hoursRemaining < 0
 *   - urgent        0 ≤ hoursRemaining ≤ 4
 *   - approaching   4 < hoursRemaining ≤ 24
 *
 *   - autoTriggered (independent of urgency) — engine-created reports
 *   - activelyExploited (independent of urgency) — KEV / EPSS-flagged
 */
export function summariseRegulatoryState(reports: DerivedReportState[]): RegulatoryStateSummary {
  return {
    total: reports.length,
    overdue: reports.filter(r => r.hoursRemaining !== null && r.hoursRemaining.value < 0).length,
    urgent: reports.filter(r => r.hoursRemaining !== null && r.hoursRemaining.value >= 0 && r.hoursRemaining.value <= 4).length,
    approaching: reports.filter(r => r.hoursRemaining !== null && r.hoursRemaining.value > 4 && r.hoursRemaining.value <= 24).length,
    autoTriggered: reports.filter(r => r.autoTriggered).length,
    activelyExploited: reports.filter(r => r.activelyExploited).length,
  };
}

/**
 * Pick the soonest deadline from a list of derived report states.
 * Negative (overdue) hoursRemaining count as "smallest" so an overdue
 * report always wins over a future one. Returns null if no report has
 * a computable deadline.
 */
export function findSoonestReport(reports: DerivedReportState[]): DerivedReportState | null {
  let soonest: DerivedReportState | null = null;
  for (const r of reports) {
    if (!r.hoursRemaining) continue;
    if (!soonest) { soonest = r; continue; }
    if (r.hoursRemaining.value < soonest.hoursRemaining!.value) soonest = r;
  }
  return soonest;
}
