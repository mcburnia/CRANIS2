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
 * Public "forget me" page — the landing target for the link in win-back
 * emails. Resolves the opaque token to an org name, explains exactly what
 * erasure means (including the legally-mandated anonymised retention), and on
 * confirmation triggers GDPR Art. 17 erasure + permanent opt-out of contact.
 */

import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import './LoginPage.css';

type Phase = 'loading' | 'confirm' | 'done' | 'invalid';

export default function ForgetMePage() {
  usePageMeta();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [orgName, setOrgName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setPhase('invalid'); return; }
      try {
        const res = await fetch(`/api/account/forget-me?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) { setPhase('invalid'); return; }
        const data = await res.json();
        setOrgName(data.orgName || 'your organisation');
        setPhase('confirm');
      } catch {
        if (!cancelled) setPhase('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const confirm = async () => {
    setWorking(true);
    setError('');
    try {
      const res = await fetch('/api/account/forget-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please email info@cranis2.com.');
        return;
      }
      setMessage(data.message || 'Your data has been erased.');
      setPhase('done');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo">CRANIS<span>2</span></div>

        {phase === 'loading' && (
          <>
            <div className="subtitle">Checking your link…</div>
            <div className="auth-card">
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>One moment.</p>
            </div>
          </>
        )}

        {phase === 'invalid' && (
          <>
            <div className="subtitle">Link not valid</div>
            <div className="auth-card">
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                This link is invalid or has already been used. If you've already asked us to forget you,
                there's nothing more to do — you won't hear from us again. Otherwise, email{' '}
                <a href="mailto:info@cranis2.com" style={{ color: 'var(--accent)' }}>info@cranis2.com</a>.
              </p>
              <div className="auth-footer"><Link to="/">Back to home</Link></div>
            </div>
          </>
        )}

        {phase === 'confirm' && (
          <>
            <div className="subtitle">Forget me &amp; erase my data</div>
            <div className="auth-card">
              <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                You're about to permanently erase the personal data held for{' '}
                <strong>{orgName}</strong> and stop all contact from CRANIS2.
              </p>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                This cannot be undone. A minimal, anonymised record is retained only where EU law requires it
                (CRA: 10&nbsp;years; tax: 7&nbsp;years) and can no longer be used to identify or contact you.
              </p>
              {error && <div className="form-error">{error}</div>}
              <button
                className="btn btn-primary"
                style={{ width: '100%', background: 'var(--red)' }}
                disabled={working}
                onClick={confirm}
              >
                {working ? 'Erasing…' : 'Yes, forget me and erase my data'}
              </button>
              <div className="auth-footer">
                <Link to="/">No, keep my account</Link>
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="subtitle">Done</div>
            <div className="auth-card">
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{message}</p>
              <div className="auth-footer"><Link to="/">Back to home</Link></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
