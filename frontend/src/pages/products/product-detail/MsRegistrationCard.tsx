/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect } from 'react';
import { Shield, ExternalLink, Plus, X } from 'lucide-react';
import type { Product } from './shared';

export default function MsRegistrationCard({ product }: { product: Product }) {
  const [registration, setRegistration] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [authorities, setAuthorities] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch(`/api/products/${product.id}/ms-registration`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRegistration(d.registration); })
      .catch(() => {});
  }, [product.id]);

  return (
    <div className="pd-card">
      <div className="pd-card-header">
        <Shield size={18} />
        <h3>Market Surveillance Registration</h3>
        {registration && (
          <span className={`pd-nb-status pd-nb-status-${registration.status}`}>
            {registration.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {!registration && !showForm && (
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
            Critical products must be registered with the relevant market surveillance authority before being placed on the EU market (CRA Art.&nbsp;20).
          </p>
          <button
            className="pd-nb-start-btn"
            onClick={() => {
              setShowForm(true);
              fetch('/api/market-surveillance-authorities?cra_designated=true')
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d?.authorities) setAuthorities(d.authorities); })
                .catch(() => {});
            }}
          >
            <Plus size={14} /> Start tracking registration
          </button>
        </div>
      )}

      {showForm && !registration && (
        <form
          className="pd-nb-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const token = localStorage.getItem('session_token');
            const authorityId = formData.get('authority_id') as string;
            const selectedAuth = authorities.find((a: any) => a.id === authorityId);
            const body: any = {
              authority_id: authorityId || null,
              authority_name: selectedAuth?.name || (formData.get('authority_name') as string) || null,
              authority_country: selectedAuth?.country || (formData.get('authority_country') as string) || null,
              notes: formData.get('notes') || null,
            };
            const res = await fetch(`/api/products/${product.id}/ms-registration`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(body),
            });
            if (res.ok) {
              const data = await res.json();
              setRegistration(data.registration);
              setShowForm(false);
            }
          }}
        >
          <div className="pd-nb-form-row">
            <label>Authority (from directory)</label>
            <select name="authority_id" defaultValue="">
              <option value="">— Select or enter manually below —</option>
              {authorities.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name} ({a.country})</option>
              ))}
            </select>
          </div>
          <div className="pd-nb-form-row">
            <label>Authority name (if not in directory)</label>
            <input type="text" name="authority_name" placeholder="e.g. BNetzA" />
          </div>
          <div className="pd-nb-form-row">
            <label>Country</label>
            <input type="text" name="authority_country" placeholder="e.g. DE" maxLength={5} />
          </div>
          <div className="pd-nb-form-row">
            <label>Notes</label>
            <input type="text" name="notes" placeholder="Optional notes..." />
          </div>
          <div className="pd-nb-form-actions">
            <button type="submit" className="pd-nb-save-btn">Create</button>
            <button type="button" className="pd-nb-cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {registration && (
        <div className="pd-nb-details">
          {(registration.msa_name || registration.authority_name) && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Authority</span>
              <span className="pd-detail-value">
                {registration.msa_name || registration.authority_name}
                {(registration.msa_country || registration.authority_country) &&
                  ` (${registration.msa_country || registration.authority_country})`}
                {registration.msa_website && (
                  <a href={registration.msa_website} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>
                    <ExternalLink size={12} />
                  </a>
                )}
              </span>
            </div>
          )}
          {registration.submission_date && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Submitted</span>
              <span className="pd-detail-value">{new Date(registration.submission_date).toLocaleDateString()}</span>
            </div>
          )}
          {registration.registration_number && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Registration no.</span>
              <span className="pd-detail-value">{registration.registration_number}</span>
            </div>
          )}
          {registration.registration_date && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Registered</span>
              <span className="pd-detail-value">{new Date(registration.registration_date).toLocaleDateString()}</span>
            </div>
          )}
          {registration.renewal_date && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Renewal due</span>
              <span className="pd-detail-value">{new Date(registration.renewal_date).toLocaleDateString()}</span>
            </div>
          )}
          {registration.notes && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Notes</span>
              <span className="pd-detail-value">{registration.notes}</span>
            </div>
          )}
          <div className="pd-nb-form-actions" style={{ marginTop: 12 }}>
            <select
              className="pd-nb-status-select"
              value={registration.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                const token = localStorage.getItem('session_token');
                const res = await fetch(`/api/products/${product.id}/ms-registration`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ status: newStatus }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setRegistration(data.registration);
                }
              }}
            >
              <option value="planning">Planning</option>
              <option value="preparing">Preparing</option>
              <option value="submitted">Submitted</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="registered">Registered</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              className="pd-nb-cancel-btn"
              onClick={async () => {
                if (!confirm('Remove registration tracking for this product?')) return;
                const token = localStorage.getItem('session_token');
                const res = await fetch(`/api/products/${product.id}/ms-registration`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) setRegistration(null);
              }}
            >
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
