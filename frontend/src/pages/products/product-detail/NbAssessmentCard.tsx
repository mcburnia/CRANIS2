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
import { Building2, ExternalLink, Plus, X } from 'lucide-react';
import type { Product } from './shared';

export default function NbAssessmentCard({ product }: { product: Product }) {
  const [assessment, setAssessment] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [bodies, setBodies] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch(`/api/products/${product.id}/nb-assessment`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAssessment(d.assessment); })
      .catch(() => {});
  }, [product.id]);

  return (
    <div className="pd-card">
      <div className="pd-card-header">
        <Building2 size={18} />
        <h3>Notified Body Assessment</h3>
        {assessment && (
          <span className={`pd-nb-status pd-nb-status-${assessment.status}`}>
            {assessment.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {!assessment && !showForm && (
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
            {product.craCategory === 'critical'
              ? 'Critical products require Module H (full quality assurance) by a notified body.'
              : 'Important II products require Module B+C (EU-type examination) by a notified body.'}
          </p>
          <button
            className="pd-nb-start-btn"
            onClick={() => {
              setShowForm(true);
              const token = localStorage.getItem('session_token');
              fetch('/api/notified-bodies', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                .then(r => r.ok ? r.json() : null)
                .then(d => { if (d?.bodies) setBodies(d.bodies); })
                .catch(() => {});
            }}
          >
            <Plus size={14} /> Start tracking assessment
          </button>
        </div>
      )}

      {showForm && !assessment && (
        <form
          className="pd-nb-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const token = localStorage.getItem('session_token');
            const body = {
              module: formData.get('module'),
              notified_body_id: formData.get('notified_body_id') || null,
              notes: formData.get('notes') || null,
            };
            const res = await fetch(`/api/products/${product.id}/nb-assessment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(body),
            });
            if (res.ok) {
              const data = await res.json();
              setAssessment(data.assessment);
              setShowForm(false);
            }
          }}
        >
          <div className="pd-nb-form-row">
            <label>Module</label>
            <select name="module" defaultValue={product.craCategory === 'critical' ? 'H' : 'B'} required>
              <option value="B">Module B — EU-Type Examination</option>
              <option value="C">Module C — Conformity to Type</option>
              <option value="H">Module H — Full Quality Assurance</option>
            </select>
          </div>
          <div className="pd-nb-form-row">
            <label>Notified body (optional)</label>
            <select name="notified_body_id" defaultValue="">
              <option value="">— Select later —</option>
              {bodies.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} ({b.country})</option>
              ))}
            </select>
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

      {assessment && (
        <div className="pd-nb-details">
          <div className="pd-detail-row">
            <span className="pd-detail-label">Module</span>
            <span className="pd-detail-value">Module {assessment.module}</span>
          </div>
          {assessment.body_name && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Notified body</span>
              <span className="pd-detail-value">
                {assessment.body_name} ({assessment.body_country})
                {assessment.body_website && (
                  <a href={assessment.body_website} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>
                    <ExternalLink size={12} />
                  </a>
                )}
              </span>
            </div>
          )}
          {assessment.submitted_date && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Submitted</span>
              <span className="pd-detail-value">{new Date(assessment.submitted_date).toLocaleDateString()}</span>
            </div>
          )}
          {assessment.expected_completion && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Expected completion</span>
              <span className="pd-detail-value">{new Date(assessment.expected_completion).toLocaleDateString()}</span>
            </div>
          )}
          {assessment.certificate_number && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Certificate</span>
              <span className="pd-detail-value">
                {assessment.certificate_number}
                {assessment.certificate_expiry && ` (expires ${new Date(assessment.certificate_expiry).toLocaleDateString()})`}
              </span>
            </div>
          )}
          {assessment.notes && (
            <div className="pd-detail-row">
              <span className="pd-detail-label">Notes</span>
              <span className="pd-detail-value">{assessment.notes}</span>
            </div>
          )}
          <div className="pd-nb-form-actions" style={{ marginTop: 12 }}>
            <select
              className="pd-nb-status-select"
              value={assessment.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                const token = localStorage.getItem('session_token');
                const res = await fetch(`/api/products/${product.id}/nb-assessment`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ status: newStatus }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setAssessment(data.assessment);
                }
              }}
            >
              <option value="planning">Planning</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under review</option>
              <option value="additional_info_requested">Info requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              className="pd-nb-cancel-btn"
              onClick={async () => {
                if (!confirm('Remove assessment tracking for this product?')) return;
                const token = localStorage.getItem('session_token');
                const res = await fetch(`/api/products/${product.id}/nb-assessment`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) setAssessment(null);
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
