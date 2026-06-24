/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

type Tab = 'profile' | 'security' | 'danger';

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
        <button
          onClick={() => setTab('danger')}
          className="btn"
          style={{
            borderRadius: 0,
            background: 'transparent',
            borderBottom: tab === 'danger' ? '2px solid var(--red)' : '2px solid transparent',
            color: tab === 'danger' ? 'var(--red)' : 'var(--muted)',
            padding: '0.5rem 1rem',
          }}
        >
          Close account
        </button>
      </div>

      {tab === 'profile' && <ProfileTab account={account} onUpdated={reload} />}
      {tab === 'security' && (
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
      {tab === 'danger' && (
        <DangerTab
          onClosed={() => {
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
  // Existing user records may have a locale-style code stored from
  // navigator.language (e.g. "en-GB"), but the validator accepts bare
  // 2-letter codes only. Normalise on load: strip the region suffix and
  // fall back to "en" if the result is not in the supported set.
  const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
  const initialLanguage = (() => {
    const raw = account.preferredLanguage ?? '';
    const base = raw.split('-')[0].toLowerCase();
    return SUPPORTED_CODES.includes(base) ? base : 'en';
  })();
  const [displayName, setDisplayName] = useState(account.displayName ?? '');
  const [language, setLanguage] = useState(initialLanguage);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // The existing value may be locale-style; treat the form as dirty when the
  // submitted language differs from the persisted one OR when the persisted
  // value needs normalisation (so "Save changes" is enabled to fix the data).
  const dirty =
    displayName !== (account.displayName ?? '') ||
    language !== account.preferredLanguage;

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

// ─── Danger zone (export / close / delete) ───────────────────────────────

type DangerAction = 'close' | 'delete';

function DangerTab({ onClosed }: { onClosed: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [action, setAction] = useState<DangerAction | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const exportData = async () => {
    setExporting(true);
    setExportMsg('');
    try {
      const res = await authedFetch('/api/account/data-export');
      if (!res.ok) {
        setExportMsg('Export failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cranis2-account-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('Your data export has downloaded.');
    } catch {
      setExportMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const res =
        action === 'close'
          ? await authedFetch('/api/account/close', { method: 'POST', body: JSON.stringify({ password }) })
          : await authedFetch('/api/account', { method: 'DELETE', body: JSON.stringify({ password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      setDone(data.message || 'Done.');
      // Both flows end the session: close → read-only relogin; delete → erased.
      setTimeout(onClosed, 2500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>All done</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{done}</p>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Signing you out…</p>
      </section>
    );
  }

  const card: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '1.25rem',
    marginBottom: '1rem',
    background: 'var(--surface)',
  };

  return (
    <section>
      {/* Export */}
      <div style={card}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Export your data</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
          Download a copy of your products, SBOMs, compliance documents and audit history (JSON). We recommend doing this before closing your account.
        </p>
        <button className="btn" onClick={exportData} disabled={exporting}>
          {exporting ? 'Preparing…' : 'Download my data'}
        </button>
        {exportMsg && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{exportMsg}</p>}
      </div>

      {/* Close (soft) */}
      <div style={card}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Close my account</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
          Cancels billing and stops all reminder emails. Your account becomes read-only and your data is{' '}
          <strong>kept for 12 months</strong> — sign back in and resubscribe any time to pick up exactly where you left off.
        </p>
        {action !== 'close' ? (
          <button className="btn" onClick={() => { setAction('close'); setError(''); setPassword(''); }}>
            Close account
          </button>
        ) : (
          <ConfirmBox
            label="Confirm with your password to close the account"
            cta="Close my account"
            ctaColor="var(--amber)"
            password={password}
            setPassword={setPassword}
            busy={busy}
            error={error}
            onConfirm={confirm}
            onCancel={() => setAction(null)}
          />
        )}
      </div>

      {/* Delete (hard) */}
      <div style={{ ...card, borderColor: 'var(--red)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem', color: 'var(--red)' }}>Delete permanently</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '0.75rem' }}>
          Permanently erase your personal data and (if you are the organisation's only admin) the entire organisation. This{' '}
          <strong>cannot be undone</strong>. Records required by EU law are anonymised and retained (CRA: 10 years; tax: 7 years) and can no longer identify you.
        </p>
        {action !== 'delete' ? (
          <button
            className="btn"
            style={{ background: 'var(--red)', color: '#fff' }}
            onClick={() => { setAction('delete'); setError(''); setPassword(''); }}
          >
            Delete my account permanently
          </button>
        ) : (
          <ConfirmBox
            label="Confirm with your password to permanently erase your data"
            cta="Permanently delete"
            ctaColor="var(--red)"
            password={password}
            setPassword={setPassword}
            busy={busy}
            error={error}
            onConfirm={confirm}
            onCancel={() => setAction(null)}
          />
        )}
      </div>
    </section>
  );
}

function ConfirmBox(props: {
  label: string; cta: string; ctaColor: string;
  password: string; setPassword: (v: string) => void;
  busy: boolean; error: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
        {props.label}
      </label>
      <input
        type="password"
        className="form-input"
        autoComplete="current-password"
        value={props.password}
        onChange={(e) => props.setPassword(e.target.value)}
        style={{ marginBottom: '0.75rem' }}
      />
      {props.error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{props.error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn"
          style={{ background: props.ctaColor, color: '#fff' }}
          disabled={props.busy || !props.password}
          onClick={props.onConfirm}
        >
          {props.busy ? 'Working…' : props.cta}
        </button>
        <button className="btn" onClick={props.onCancel} disabled={props.busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
