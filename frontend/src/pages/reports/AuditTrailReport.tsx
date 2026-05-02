/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePageMeta } from '../../hooks/usePageMeta';

interface UserEvent {
  id: string;
  eventType: string;
  userEmail: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface ComplianceStage {
  id: string;
  stage: string;
  reportType: string;
  productId: string;
  submittedBy: string;
  submittedAt: string;
}

interface SyncEntry {
  id: string;
  productId: string;
  syncType: string;
  startedAt: string;
  durationSeconds: number;
  packageCount: number;
  contributorCount: number;
  status: string;
  triggeredBy: string | null;
  errorMessage: string | null;
}

interface ReportData {
  userEvents: UserEvent[];
  complianceStages: ComplianceStage[];
  syncHistory: SyncEntry[];
  generatedAt: string;
}

const CATEGORIES = [
  { value: '', label: 'All events' },
  { value: 'auth', label: 'Authentication' },
  { value: 'vulnerability', label: 'Vulnerability' },
  { value: 'compliance', label: 'Compliance stages' },
  { value: 'data_export', label: 'Data exports' },
  { value: 'sync', label: 'Repository syncs' },
];

function defaultFrom() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string | null) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    login: 'Login',
    register: 'Account registered',
    login_failed_bad_token: 'Failed login (bad token)',
    login_failed_unverified: 'Failed login (unverified)',
    login_failed_no_account: 'Failed login (no account)',
    vulnerability_scan_triggered: 'Vulnerability scan triggered',
    vulnerability_finding_updated: 'Finding status updated',
    github_repo_synced: 'Repository synced',
    sbom_refreshed: 'SBOM refreshed',
    github_connected: 'Repository connected',
    webhook_sbom_stale: 'SBOM marked stale (webhook)',
    sbom_export: 'SBOM exported',
    due_diligence_export: 'Due diligence exported',
    report_export: 'Report exported',
    org_created: 'Organisation created',
    email_verified: 'Email verified',
  };
  return labels[type] ?? type;
}

export default function AuditTrailReport() {
  usePageMeta();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [category, setCategory] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'md' | 'csv' | null>(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from, to });
      if (category) params.set('category', category);
      const res = await fetch(`/api/reports/audit-trail?${params}`, { headers });
      if (!res.ok) throw new Error('Failed to load report data');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function download(format: 'md' | 'csv') {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format, from, to });
      if (category) params.set('category', category);
      const res = await fetch(`/api/reports/audit-trail/export?${params}`, { headers });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${from}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  const totalEvents = data
    ? data.userEvents.length + data.complianceStages.length + data.syncHistory.length
    : 0;

  return (
    <>
      <PageHeader title="Audit Trail">
        <Link to="/reports" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)', textDecoration: 'none', fontSize: '0.875rem' }}>
          <ArrowLeft size={14} /> All Reports
        </Link>
      </PageHeader>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          To
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Category
          <select value={category} onChange={e => setCategory(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem' }}>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <button onClick={generate} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: loading ? 0.7 : 1 }}>
          {loading ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
          Generate Report
        </button>

        {data && (
          <>
            <button onClick={() => download('md')} disabled={exporting !== null}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
              {exporting === 'md' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
              Download Report
            </button>
            <button onClick={() => download('csv')} disabled={exporting !== null}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
              {exporting === 'csv' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
              Download CSV
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--red)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {data && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {totalEvents} events · Generated {fmtDate(data.generatedAt)}
          </p>

          {/* User events */}
          {data.userEvents.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>
                User Activity <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.85rem' }}>({data.userEvents.length})</span>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--surface-raised, var(--surface))' }}>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Timestamp', 'User', 'Event', 'IP Address'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.userEvents.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{fmtDate(e.createdAt)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>{e.userEmail}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>{eventLabel(e.eventType)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', fontSize: '0.8rem' }}>{e.ipAddress ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Compliance stages */}
          {data.complianceStages.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>
                ENISA Report Stages <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.85rem' }}>({data.complianceStages.length})</span>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Timestamp', 'Submitted By', 'Stage', 'Report Type'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.complianceStages.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{fmtDate(s.submittedAt)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>{s.submittedBy}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>
                          <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.8rem', background: 'var(--accent-subtle, rgba(99,102,241,0.1))', color: 'var(--accent)' }}>
                            {s.stage.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)' }}>{s.reportType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sync history */}
          {data.syncHistory.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>
                Repository Syncs <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.85rem' }}>({data.syncHistory.length})</span>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Timestamp', 'Product', 'Type', 'Duration', 'Packages', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.syncHistory.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{fmtDate(s.startedAt)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)', fontSize: '0.8rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.productId}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)' }}>{s.syncType}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)' }}>{s.durationSeconds}s</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>{s.packageCount}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span style={{
                            display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.8rem',
                            background: s.status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: s.status === 'success' ? 'var(--green)' : 'var(--red)',
                          }}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalEvents === 0 && (
            <p style={{ color: 'var(--muted)' }}>No events found for this period and filter combination.</p>
          )}
        </div>
      )}
    </>
  );
}
