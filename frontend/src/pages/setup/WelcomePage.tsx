/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle, ArrowRight, Package, Shield, BarChart3,
  Lock, Bell, Users,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';

const highlights = [
  { icon: Package, label: 'Automated SBOMs', desc: '28 lockfile formats, 26 languages' },
  { icon: Shield, label: 'CRA Technical File', desc: 'Auto-populated Annex VII documentation' },
  { icon: BarChart3, label: 'Obligation Tracking', desc: '19 CRA & NIS2 requirements mapped' },
  { icon: Lock, label: 'Evidence Vault', desc: 'RFC 3161 timestamps, 10-year retention' },
  { icon: Bell, label: 'ENISA Reporting', desc: '24h / 72h / 14-day deadline alerts' },
  { icon: Users, label: 'AI Copilot', desc: 'Suggestions, triage, risk assessments' },
];

export default function WelcomePage() {
  usePageMeta();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const session = searchParams.get('session');
    if (session) {
      localStorage.setItem('session_token', session);
      // Clean the URL
      window.history.replaceState({}, '', '/welcome');
    }
  }, [searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ textAlign: 'center', maxWidth: '600px' }}>
        <div className="logo" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '2rem' }}>
          CRANIS<span style={{ color: 'var(--accent)' }}>2</span>
        </div>

        <div className="auth-card" style={{ padding: '2.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <CheckCircle size={56} color="var(--green)" />
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Welcome to CRANIS2!
          </h1>

          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            Your email has been verified and your account is ready.
            Set up your organisation to start building CRA and NIS2
            compliance evidence across your software products.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            marginBottom: '2rem',
            textAlign: 'left',
          }}>
            {highlights.map((h) => (
              <div key={h.label} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.6rem 0.75rem',
                background: 'var(--bg)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <h.icon size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{h.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.4 }}>{h.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/setup/org"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            Set Up Your Organisation <ArrowRight size={18} />
          </Link>

          <div style={{ marginTop: '1.5rem' }}>
            <Link
              to="/dashboard"
              style={{ color: 'var(--muted)', fontSize: '0.85rem' }}
            >
              Skip for now and go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
