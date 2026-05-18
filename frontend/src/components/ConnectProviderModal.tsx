/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { createPortal } from 'react-dom';
import { X, ExternalLink, ShieldCheck, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import './ConnectProviderModal.css';

interface Props {
  provider: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ProviderCopy {
  label: string;
  consentHeading: string;
  scopeNotes: { title: string; detail: string; read: boolean }[];
  revokeUrl: string;
  revokeLabel: string;
}

const COPY: Record<string, ProviderCopy> = {
  github: {
    label: 'GitHub',
    consentHeading: 'Authorize cranis2 — CRANIS2',
    scopeNotes: [
      { title: 'read:user', detail: 'Verifies the connecting user’s identity (username, email, avatar). No profile changes.', read: true },
      { title: 'repo', detail: 'GitHub’s scope model bundles repository read access with webhook management under the single "repo" scope. CRANIS2 uses it to read repository metadata, file contents, contributors, releases, and to register webhooks for push notifications. CRANIS2 will never commit, push, branch, or modify any code in your repositories.', read: true },
    ],
    revokeUrl: 'https://github.com/settings/applications',
    revokeLabel: 'github.com → Settings → Applications → Authorized OAuth Apps',
  },
  codeberg: {
    label: 'Codeberg',
    consentHeading: 'Authorize CRANIS2',
    scopeNotes: [
      { title: 'read:user', detail: 'Verifies the connecting user’s identity.', read: true },
      { title: 'read:repository', detail: 'Reads repository metadata, file contents, contributors and releases. No write access requested.', read: true },
    ],
    revokeUrl: 'https://codeberg.org/user/settings/applications',
    revokeLabel: 'codeberg.org → Settings → Applications',
  },
  bitbucket: {
    label: 'Bitbucket',
    consentHeading: 'Grant access to CRANIS2',
    scopeNotes: [
      { title: 'account', detail: 'Verifies the connecting user’s identity.', read: true },
      { title: 'repository', detail: 'Reads repository metadata, file contents and contributors. No write access requested.', read: true },
      { title: 'webhook', detail: 'Registers webhooks so CRANIS2 can react to pushes. Webhooks notify CRANIS2 — they do not modify code.', read: true },
    ],
    revokeUrl: 'https://bitbucket.org/account/settings/app-authorizations/',
    revokeLabel: 'bitbucket.org → Personal settings → App authorisations',
  },
};

function providerCopy(id: string): ProviderCopy {
  return COPY[id] || {
    label: id,
    consentHeading: `Authorize CRANIS2 — ${id}`,
    scopeNotes: [
      { title: 'read', detail: 'CRANIS2 requests read-only access to repository metadata and contents.', read: true },
    ],
    revokeUrl: '',
    revokeLabel: 'your provider’s account settings',
  };
}

export default function ConnectProviderModal({ provider, onConfirm, onCancel }: Props) {
  const copy = providerCopy(provider);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onCancel();
  }

  return createPortal(
    <div className="cpm-overlay" onClick={handleOverlayClick}>
      <div className="cpm-modal" role="dialog" aria-modal="true" aria-labelledby="cpm-title">
        <div className="cpm-header">
          <h3 id="cpm-title">Connect {copy.label}</h3>
          <button className="cpm-close-btn" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="cpm-body">
          <p className="cpm-lede">
            You’re about to authorise CRANIS2 to read repository data from your organisation’s {copy.label} account. This connection is shared across every member of your CRANIS2 organisation.
          </p>

          <div className="cpm-section">
            <div className="cpm-section-head">
              <ExternalLink size={14} /> <strong>What you’ll see next</strong>
            </div>
            <p>
              A {copy.label} window will open asking you to confirm: <span className="cpm-consent-quote">“{copy.consentHeading}”</span>. After you approve, the window closes automatically and the connection appears here.
            </p>
          </div>

          <div className="cpm-section">
            <div className="cpm-section-head">
              <ShieldCheck size={14} /> <strong>What CRANIS2 asks for and why</strong>
            </div>
            <ul className="cpm-scopes">
              {copy.scopeNotes.map(s => (
                <li key={s.title} className="cpm-scope">
                  <code>{s.title}</code>
                  <span>{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="cpm-section cpm-promise">
            <div className="cpm-promise-row"><Eye size={14} /> CRANIS2 <strong>reads</strong> repository metadata, file contents (for SBOM extraction), contributors and releases.</div>
            <div className="cpm-promise-row"><EyeOff size={14} /> CRANIS2 will <strong>never commit, push, branch, tag, open issues or pull requests, or modify code or settings</strong> in your repositories.</div>
          </div>

          {copy.revokeUrl && (
            <div className="cpm-section cpm-revoke">
              <AlertCircle size={14} />
              <span>
                You can revoke this access at any time at{' '}
                <a href={copy.revokeUrl} target="_blank" rel="noopener noreferrer">{copy.revokeLabel}</a>.
              </span>
            </div>
          )}
        </div>

        <div className="cpm-footer">
          <button className="cpm-cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="cpm-continue-btn" onClick={onConfirm}>
            Continue to {copy.label} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
