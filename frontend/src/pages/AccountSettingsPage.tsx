/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

type Tab = 'profile' | 'security';

const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pt', label: 'Português' },
  { code: 'pl', label: 'Polski' },
  { code: 'sv', label: 'Svenska' },
];

interface AccountInfo {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  preferredLanguage: string | null;
  pendingEmail: string | null;
  pendingEmailExpiresAt: string | null;
  createdAt: string;
}

function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('session_token');
  return fetch(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

function checkPasswordStrength(pw: string): { label: string; ok: boolean }[] {
  return [
    { label: 'At least 8 characters', ok: pw.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'One number', ok: /\d/.test(pw) },
    { label: 'One special character', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export default function AccountSettingsPage() {
  usePageMeta();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('profile');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await authedFetch('/api/account');
      if (res.ok) {
        setAccount(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading || !account) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--muted)' }}>Loading account…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>Account settings</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Update your profile, change your password, or update your email address.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setTab('profile')}
          className="btn"
          style={{
            borderRadius: 0,
            background: 'transparent',
            borderBottom: tab === 'profile' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'profile' ? 'var(--text)' : 'var(--muted)',
            padding: '0.5rem 1rem',
          }}
        >
          Profile
        </button>
        <button
          onClick={() => setTab('security')}
          className="btn"
          style={{
            borderRadius: 0,
            background: 'transparent',
            borderBottom: tab === 'security' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'security' ? 'var(--text)' : 'var(--muted)',
            padding: '0.5rem 1rem',
          }}
        >
          Security
        </button>
      </div>

      {tab === 'profile' ? (
        <ProfileTab account={account} onUpdated={reload} />
      ) : (
        <SecurityTab
          account={account}
          onUpdated={reload}
          onPasswordChanged={() => {
            // Watermark invalidates the current token. Sign out cleanly.
            logout();
            navigate('/login');
          }}
        />
      )}
    </div>
  );
}

// ─── Profile tab ─────────────────────────────────────────────────────────

function ProfileTab({ account, onUpdated }: { account: AccountInfo; onUpdated: () => void }) {
  const [displayName, setDisplayName] = useState(account.displayName ?? '');
  const [language, setLanguage] = useState(account.preferredLanguage ?? 'en');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const dirty = displayName !== (account.displayName ?? '') || language !== (account.preferredLanguage ?? 'en');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      const res = await authedFetch('/api/account/profile', {
        method: 'PUT',
        body: JSON.stringify({ displayName, preferredLanguage: language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save changes.');
        return;
      }
      setSuccess('Profile updated.');
      onUpdated();
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 480 }}>
      {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ color: 'var(--green)', fontSize: '0.9rem', marginBottom: '1rem' }}>{success}</div>}

      <div className="form-group">
        <label>Display name</label>
        <input
          className="form-input"
          maxLength={120}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How you would like to be addressed"
        />
      </div>

      <div className="form-group">
        <label>Preferred language</label>
        <select
          className="form-input"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

// ─── Security tab ────────────────────────────────────────────────────────

function SecurityTab({
  account,
  onUpdated,
  onPasswordChanged,
}: {
  account: AccountInfo;
  onUpdated: () => void;
  onPasswordChanged: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 480 }}>
      <ChangePasswordSection onPasswordChanged={onPasswordChanged} />
      <ChangeEmailSection account={account} onUpdated={onUpdated} />
    </div>
  );
}

function ChangePasswordSection({ onPasswordChanged }: { onPasswordChanged: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const checks = useMemo(() => checkPasswordStrength(next), [next]);
  const allOk = checks.every((c) => c.ok);
  const matches = next.length > 0 && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await authedFetch('/api/account/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not change password.');
        return;
      }
      // Watermark advanced; current session is now invalid. Sign out + redirect.
      onPasswordChanged();
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Change password</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        After a successful change, every other device signed in to this account will be signed out.
        You will be returned to the sign-in page to log in with your new password.
      </p>
      <form onSubmit={submit}>
        {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        <div className="form-group">
          <label>Current password</label>
          <input type="password" className="form-input" value={current}
            onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </div>
        <div className="form-group">
          <label>New password</label>
          <input type="password" className="form-input" value={next}
            onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0', fontSize: '0.85rem' }}>
          {checks.map((c) => (
            <li key={c.label} style={{ color: c.ok ? 'var(--green)' : 'var(--muted)', marginBottom: '0.25rem' }}>
              {c.ok ? '✓' : '○'} {c.label}
            </li>
          ))}
        </ul>
        <div className="form-group">
          <label>Confirm new password</label>
          <input type="password" className="form-input" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          {confirm.length > 0 && !matches && (
            <div style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Passwords do not match.
            </div>
          )}
        </div>
        <button type="submit" className="btn btn-primary"
          disabled={!current || !allOk || !matches || saving}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </section>
  );
}

function ChangeEmailSection({ account, onUpdated }: { account: AccountInfo; onUpdated: () => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      const res = await authedFetch('/api/account/email', {
        method: 'PUT',
        body: JSON.stringify({ newEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not request email change.');
        return;
      }
      setSuccess(`A verification link has been sent to ${newEmail}. Your account stays on ${account.email} until you click that link.`);
      setNewEmail('');
      onUpdated();
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Change email address</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Current address: <strong style={{ color: 'var(--text)' }}>{account.email}</strong>.
        We will send a verification link to the new address. Your account stays on the current email
        until that link is clicked.
      </p>
      {account.pendingEmail && (
        <div style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8,
          padding: '0.75rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
        }}>
          <strong style={{ color: 'var(--amber)' }}>Verification pending:</strong>{' '}
          <span style={{ color: 'var(--muted)' }}>
            We sent a link to <strong style={{ color: 'var(--text)' }}>{account.pendingEmail}</strong>.
            Click it from that inbox to finalise the change.
          </span>
        </div>
      )}
      <form onSubmit={submit}>
        {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div style={{ color: 'var(--green)', fontSize: '0.9rem', marginBottom: '1rem' }}>{success}</div>}
        <div className="form-group">
          <label>New email address</label>
          <input type="email" className="form-input" value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)} placeholder="new@example.com" required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!newEmail || saving}>
          {saving ? 'Sending link…' : 'Send verification link'}
        </button>
      </form>
    </section>
  );
}
