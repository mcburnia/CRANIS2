/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import './LoginPage.css';

export default function ForgotPasswordPage() {
  usePageMeta();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Backend returns 200 with the same body whether the email exists or
      // not — do not reveal account state. The only way to fail meaningfully
      // here is a network error.
      if (!res.ok) {
        setError('Could not submit request. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="logo">CRANIS<span>2</span></div>
          <div className="subtitle">Check your email</div>
          <div className="auth-card">
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem' }}>
              If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>, we have sent a password
              reset link to that address. The link expires in 60 minutes.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Did not receive an email? Check your spam folder, or try again in a few minutes — repeated requests
              are rate-limited.
            </p>
            <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
              <Link to="/login">Back to sign in</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo">CRANIS<span>2</span></div>
        <div className="subtitle">Reset your password</div>
        <div className="auth-card">
          {error && <div className="form-error">{error}</div>}

          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            Enter the email address associated with your account and we will send you a link to set a new password.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!email || loading}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>

          <div className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
