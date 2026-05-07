/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import './LoginPage.css';

interface PasswordCheck {
  label: string;
  satisfied: boolean;
}

function checkPassword(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', satisfied: pw.length >= 8 },
    { label: 'One uppercase letter', satisfied: /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', satisfied: /[a-z]/.test(pw) },
    { label: 'One number', satisfied: /\d/.test(pw) },
    { label: 'One special character', satisfied: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export default function ResetPasswordPage() {
  usePageMeta();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() => checkPassword(password), [password]);
  const allSatisfied = checks.every((c) => c.satisfied);
  const passwordsMatch = password.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is missing its token. Request a new one from the forgot-password page.');
      return;
    }
    if (!allSatisfied) {
      setError('Please choose a stronger password.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not reset password.');
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="logo">CRANIS<span>2</span></div>
          <div className="subtitle">Password updated</div>
          <div className="auth-card">
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Your password has been reset. For your security, all other sessions have been signed out. Redirecting
              you to the sign-in page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="logo">CRANIS<span>2</span></div>
        <div className="subtitle">Choose a new password</div>
        <div className="auth-card">
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', fontSize: '0.85rem' }}>
              {checks.map((c) => (
                <li
                  key={c.label}
                  style={{
                    color: c.satisfied ? 'var(--green)' : 'var(--muted)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {c.satisfied ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>

            <div className="form-group">
              <label>Confirm new password</label>
              <input
                type="password"
                className="form-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
              {confirm.length > 0 && !passwordsMatch && (
                <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Passwords do not match.
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!allSatisfied || !passwordsMatch || loading}
            >
              {loading ? 'Updating...' : 'Update password'}
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
