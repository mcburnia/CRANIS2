/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, ScrollText, ArrowRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePageMeta } from '../../hooks/usePageMeta';

const REPORTS = [
  {
    to: '/reports/compliance-summary',
    icon: ShieldCheck,
    title: 'Compliance Summary',
    description:
      'Point-in-time snapshot of CRA obligations progress, technical file completion, open vulnerabilities, and ENISA report status across all products.',
  },
  {
    to: '/reports/vulnerability-trends',
    icon: AlertTriangle,
    title: 'Vulnerability Trends',
    description:
      'Time-series analysis of vulnerability scan history, finding severity over time, status progression, and ecosystem breakdown.',
  },
  {
    to: '/reports/audit-trail',
    icon: ScrollText,
    title: 'Audit Trail',
    description:
      'Tamper-evident log of user activity, ENISA report stage submissions, and repository syncs for audit and process-control evidence.',
  },
];

export default function ReportsPage() {
  usePageMeta();
  return (
    <>
      <PageHeader title="Reports" />
      <p style={{ color: 'var(--muted)', marginTop: '-0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Export compliance, vulnerability, and audit data as PDF or CSV.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680 }}>
        {REPORTS.map(({ to, icon: Icon, title, description }) => (
          <Link
            key={to}
            to={to}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              padding: '1.25rem 1.5rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              textDecoration: 'none',
              color: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--accent-subtle, rgba(99,102,241,0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Icon size={20} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.25rem' }}>
                {title}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                {description}
              </div>
            </div>
            <ArrowRight size={16} color="var(--muted)" style={{ flexShrink: 0, marginTop: 4 }} />
          </Link>
        ))}
      </div>
    </>
  );
}
