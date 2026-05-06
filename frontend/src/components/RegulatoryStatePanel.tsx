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
 * P10c — Per-product CRA Art. 14 "regulatory state" panel.
 *
 * Renders a prominent banner summarising open Art. 14 obligations for a
 * product: count of overdue / urgent / approaching reports plus a
 * single-line headline for the soonest deadline. Renders nothing when
 * the product has no open obligations (zero visual noise on healthy
 * products).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Shield, ShieldAlert, ChevronRight } from 'lucide-react';

interface RegulatoryStateReport {
  reportId: string;
  reportType: 'vulnerability' | 'incident';
  status: string;
  awarenessAt: string | null;
  activelyExploited: boolean;
  autoTriggered: boolean;
  awarenessAttestedAt: string | null;
  linkedFindingId: string | null;
  nextDeadline: string | null;
  stage: string | null;
  stageLabel: string | null;
  hoursRemaining: { value: number; label: string } | null;
  isOverdue: boolean;
}

interface RegulatoryState {
  reports: RegulatoryStateReport[];
  soonest: RegulatoryStateReport | null;
  summary: {
    total: number;
    overdue: number;
    urgent: number;
    approaching: number;
    autoTriggered: number;
    activelyExploited: number;
  };
}

export default function RegulatoryStatePanel({ productId }: { productId: string }) {
  const [state, setState] = useState<RegulatoryState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch(`/api/cra-reports/regulatory-state/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setState(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading || !state || state.reports.length === 0) return null;

  const { soonest, summary, reports } = state;

  // Top-level urgency drives the banner colour. Overdue → red, urgent (≤4h)
  // → red, approaching (≤24h) → amber, otherwise blue.
  let bannerColour = '#3b82f6'; // blue
  let bannerBg = 'rgba(59, 130, 246, 0.08)';
  let bannerBorder = 'rgba(59, 130, 246, 0.4)';
  let Icon = Shield;

  if (summary.overdue > 0 || summary.urgent > 0) {
    bannerColour = '#dc2626';
    bannerBg = 'rgba(220, 38, 38, 0.08)';
    bannerBorder = 'rgba(220, 38, 38, 0.4)';
    Icon = ShieldAlert;
  } else if (summary.approaching > 0) {
    bannerColour = '#f59e0b';
    bannerBg = 'rgba(245, 158, 11, 0.08)';
    bannerBorder = 'rgba(245, 158, 11, 0.4)';
    Icon = AlertTriangle;
  }

  return (
    <div
      className="pd-card"
      style={{
        background: bannerBg,
        border: '1px solid ' + bannerBorder,
        borderLeft: '4px solid ' + bannerColour,
        gridColumn: '1 / -1',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <Icon size={22} color={bannerColour} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <strong style={{ color: bannerColour, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              CRA Art. 14 Regulatory State
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              · {summary.total} open {summary.total === 1 ? 'report' : 'reports'}
              {summary.activelyExploited > 0 && ' · ' + summary.activelyExploited + ' actively exploited'}
              {summary.autoTriggered > 0 && ' · ' + summary.autoTriggered + ' auto-triggered'}
            </span>
          </div>

          {soonest && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.5rem' }}>
              {soonest.isOverdue ? (
                <strong style={{ color: '#dc2626' }}>OVERDUE: </strong>
              ) : (
                <strong>{soonest.hoursRemaining?.label}: </strong>
              )}
              {soonest.stageLabel}
              {' for '}
              <Link to={'/vulnerability-reports/' + soonest.reportId} style={{ color: bannerColour, textDecoration: 'none' }}>
                report {soonest.reportId.slice(0, 8)}
              </Link>
              {' '}<ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
            </div>
          )}

          {/* Compact summary chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.7rem', marginBottom: '0.5rem' }}>
            {summary.overdue > 0 && (
              <span style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', padding: '0.1rem 0.5rem', borderRadius: '3px', fontWeight: 600 }}>
                {summary.overdue} overdue
              </span>
            )}
            {summary.urgent > 0 && (
              <span style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', padding: '0.1rem 0.5rem', borderRadius: '3px', fontWeight: 600 }}>
                {summary.urgent} urgent (≤4h)
              </span>
            )}
            {summary.approaching > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '0.1rem 0.5rem', borderRadius: '3px', fontWeight: 600 }}>
                {summary.approaching} approaching (≤24h)
              </span>
            )}
          </div>

          {/* Per-report list (collapsed if many) */}
          {reports.length > 1 && (
            <details style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', color: bannerColour, fontWeight: 500 }}>
                All {reports.length} open reports
              </summary>
              <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem' }}>
                {reports.map(r => (
                  <li key={r.reportId} style={{ marginBottom: '0.3rem' }}>
                    <Link to={'/vulnerability-reports/' + r.reportId} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                      <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />
                      {r.stageLabel || r.status}
                      {' — '}
                      <span style={{ color: r.isOverdue ? '#dc2626' : 'var(--muted)' }}>
                        {r.hoursRemaining?.label || 'no deadline'}
                      </span>
                      {r.activelyExploited && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '3px', background: 'rgba(220,38,38,0.15)', color: '#dc2626', fontWeight: 700 }}>
                          ACTIVELY EXPLOITED
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
