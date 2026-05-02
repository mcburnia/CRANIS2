/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle, Plus, Loader2, X, ChevronDown, Filter,
} from 'lucide-react';
import { formatDate, formatDateTime } from './shared';

// ── Types ────────────────────────────────────────────────────────────

interface FieldIssue {
  id: string;
  title: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  status: string;
  resolution: string | null;
  affected_versions: string | null;
  fixed_in_version: string | null;
  linked_finding_id: string | null;
  reporter_email: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IssueSummary {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  avgResolutionDays: number | null;
}

// ── Constants ────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'var(--error, #ef4444)', bg: 'rgba(239,68,68,0.12)' },
  high:     { label: 'High',     color: 'var(--warning, #f59e0b)', bg: 'rgba(245,158,11,0.12)' },
  medium:   { label: 'Medium',   color: 'var(--amber, #d97706)', bg: 'rgba(217,119,6,0.10)' },
  low:      { label: 'Low',      color: 'var(--muted, #6b7280)', bg: 'rgba(107,114,128,0.10)' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:            { label: 'Open',            color: 'var(--error, #ef4444)' },
  investigating:   { label: 'Investigating',   color: 'var(--warning, #f59e0b)' },
  fix_in_progress: { label: 'Fix in Progress', color: 'var(--amber, #d97706)' },
  resolved:        { label: 'Resolved',        color: 'var(--success, #22c55e)' },
  closed:          { label: 'Closed',          color: 'var(--muted, #6b7280)' },
};

const SOURCE_LABELS: Record<string, string> = {
  customer_report:     'Customer Report',
  internal_testing:    'Internal Testing',
  market_surveillance: 'Market Surveillance',
  vulnerability_scan:  'Vulnerability Scan',
  security_researcher: 'Security Researcher',
  other:               'Other',
};

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const SOURCES = ['customer_report', 'internal_testing', 'market_surveillance', 'vulnerability_scan', 'security_researcher', 'other'] as const;
const STATUSES = ['open', 'investigating', 'fix_in_progress', 'resolved', 'closed'] as const;

// ── Component ────────────────────────────────────────────────────────

export default function FieldIssuesTab({ productId }: { productId: string }) {
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [summary, setSummary] = useState<IssueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState<FieldIssue | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');

  // ── Fetch data ───────────────────────────────────────────────────

  async function fetchIssues() {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterSeverity) params.set('severity', filterSeverity);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [issuesRes, summaryRes] = await Promise.all([
        fetch(`/api/products/${productId}/field-issues${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/products/${productId}/field-issues/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(data.issues);
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchIssues(); }, [productId, filterStatus, filterSeverity]);

  // ── Create / Update ──────────────────────────────────────────────

  async function handleSave(form: Record<string, any>) {
    const isEdit = !!editingIssue;
    const url = isEdit
      ? `/api/products/${productId}/field-issues/${editingIssue!.id}`
      : `/api/products/${productId}/field-issues`;

    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setShowModal(false);
      setEditingIssue(null);
      fetchIssues();
    }
  }

  async function handleDelete(issueId: string) {
    if (!confirm('Delete this field issue? This cannot be undone.')) return;
    const res = await fetch(`/api/products/${productId}/field-issues/${issueId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchIssues();
  }

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <SummaryCard label="Total Issues" value={summary.total} color="var(--foreground)" />
          <SummaryCard label="Open" value={summary.byStatus.open || 0} color="var(--error, #ef4444)" />
          <SummaryCard label="Investigating" value={summary.byStatus.investigating || 0} color="var(--warning, #f59e0b)" />
          <SummaryCard label="In Progress" value={summary.byStatus.fix_in_progress || 0} color="var(--amber, #d97706)" />
          <SummaryCard label="Resolved" value={(summary.byStatus.resolved || 0) + (summary.byStatus.closed || 0)} color="var(--success, #22c55e)" />
          <SummaryCard
            label="Avg Resolution"
            value={summary.avgResolutionDays != null ? `${summary.avgResolutionDays}d` : '–'}
            color="var(--primary)"
          />
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={14} style={{ color: 'var(--muted)' }} />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.85rem' }}
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.85rem' }}
          >
            <option value="">All Severities</option>
            {SEVERITIES.map(s => (
              <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setEditingIssue(null); setShowModal(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <Plus size={14} /> Report Issue
        </button>
      </div>

      {/* Issue list */}
      {issues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>
          <AlertTriangle size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ margin: 0, fontWeight: 500 }}>No field issues recorded</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Track post-market issues, customer reports, and corrective actions here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {issues.map(issue => (
            <IssueRow
              key={issue.id}
              issue={issue}
              expanded={expandedId === issue.id}
              onToggle={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
              onEdit={() => { setEditingIssue(issue); setShowModal(true); }}
              onDelete={() => handleDelete(issue.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <IssueModal
          issue={editingIssue}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingIssue(null); }}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)',
      background: 'var(--surface)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

function IssueRow({ issue, expanded, onToggle, onEdit, onDelete }: {
  issue: FieldIssue;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
  const stat = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <ChevronDown
          size={14}
          style={{
            color: 'var(--muted)', transition: 'transform 0.15s',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <span style={{
          display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px',
          fontSize: '0.7rem', fontWeight: 600, color: sev.color, background: sev.bg,
        }}>
          {sev.label}
        </span>
        <span style={{ flex: 1, fontWeight: 500, fontSize: '0.9rem' }}>{issue.title}</span>
        <span style={{
          display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px',
          fontSize: '0.7rem', fontWeight: 500, color: stat.color,
          border: `1px solid ${stat.color}`, opacity: 0.85,
        }}>
          {stat.label}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {formatDate(issue.created_at)}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '0.75rem 1rem 1rem 2.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem',
        }}>
          {issue.description && (
            <p style={{ margin: 0, color: 'var(--foreground)', lineHeight: 1.5 }}>{issue.description}</p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
            <span><strong>Source:</strong> {SOURCE_LABELS[issue.source] || issue.source}</span>
            {issue.affected_versions && <span><strong>Affected:</strong> {issue.affected_versions}</span>}
            {issue.fixed_in_version && <span><strong>Fixed in:</strong> {issue.fixed_in_version}</span>}
            {issue.reporter_email && <span><strong>Reported by:</strong> {issue.reporter_email}</span>}
            {issue.resolved_at && <span><strong>Resolved:</strong> {formatDateTime(issue.resolved_at)}</span>}
          </div>

          {issue.resolution && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(34,197,94,0.06)', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.15)' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--success, #22c55e)' }}>Resolution:</strong>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--foreground)' }}>{issue.resolution}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={onDelete} style={{ color: 'var(--error, #ef4444)' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueModal({ issue, onSave, onClose }: {
  issue: FieldIssue | null;
  onSave: (form: Record<string, any>) => void;
  onClose: () => void;
}) {
  const isEdit = !!issue;
  const [form, setForm] = useState({
    title: issue?.title || '',
    description: issue?.description || '',
    severity: issue?.severity || 'medium',
    source: issue?.source || 'internal_testing',
    status: issue?.status || 'open',
    resolution: issue?.resolution || '',
    affected_versions: issue?.affected_versions || '',
    fixed_in_version: issue?.fixed_in_version || '',
  });

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, any> = { ...form };
    // Strip empty strings to avoid overwriting with blanks
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = k === 'title' ? '' : undefined;
    }
    // Always send title
    payload.title = form.title;
    onSave(payload);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--background)', borderRadius: '12px', padding: '1.5rem',
          width: '100%', maxWidth: '540px', maxHeight: '90vh', overflow: 'auto',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{isEdit ? 'Edit Field Issue' : 'Report Field Issue'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            Title *
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
              style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              placeholder="Brief description of the issue"
            />
          </label>

          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            Description
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', resize: 'vertical' }}
              placeholder="Detailed description, steps to reproduce, impact..."
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              Severity
              <select
                value={form.severity}
                onChange={e => set('severity', e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              Source
              <select
                value={form.source}
                onChange={e => set('source', e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
              </select>
            </label>
          </div>

          {isEdit && (
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              Status
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </label>
          )}

          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            Affected Versions
            <input
              type="text"
              value={form.affected_versions}
              onChange={e => set('affected_versions', e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
              placeholder="e.g. 2.3.0, 2.3.1"
            />
          </label>

          {isEdit && (
            <>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                Fixed in Version
                <input
                  type="text"
                  value={form.fixed_in_version}
                  onChange={e => set('fixed_in_version', e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                  placeholder="e.g. 2.4.0"
                />
              </label>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                Resolution
                <textarea
                  value={form.resolution}
                  onChange={e => set('resolution', e.target.value)}
                  rows={2}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', resize: 'vertical' }}
                  placeholder="How was the issue resolved?"
                />
              </label>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Create Issue'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
