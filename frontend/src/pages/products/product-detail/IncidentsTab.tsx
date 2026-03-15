import { useState, useEffect } from 'react';
import {
  AlertTriangle, Plus, Loader2, X, ChevronDown, ChevronRight,
  ExternalLink, Clock,
} from 'lucide-react';
import { formatDateTime } from './shared';

// ── Types ────────────────────────────────────────────────────────────

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  phase: string;
  detected_at: string;
  contained_at: string | null;
  resolved_at: string | null;
  review_completed_at: string | null;
  incident_lead: string | null;
  root_cause: string | null;
  lessons_learned: string | null;
  impact_summary: string | null;
  linked_report_id: string | null;
  linked_field_issue_id: string | null;
  created_at: string;
}

interface TimelineEntry {
  id: string;
  event_type: string;
  description: string;
  created_by: string | null;
  created_at: string;
}

interface IncidentSummary {
  total: number;
  active: number;
  byPhase: { phase: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  avgResolutionHours: number | null;
}

// ── Constants ────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  P1: { label: 'P1 — Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  P2: { label: 'P2 — High',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  P3: { label: 'P3 — Medium',   color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  P4: { label: 'P4 — Low',      color: '#6b7280', bg: 'rgba(107,114,128,0.10)' },
};

const PHASE_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  detection:    { label: 'Detection',    color: '#ef4444', order: 0 },
  assessment:   { label: 'Assessment',   color: '#f59e0b', order: 1 },
  containment:  { label: 'Containment',  color: '#d97706', order: 2 },
  remediation:  { label: 'Remediation',  color: '#3b82f6', order: 3 },
  recovery:     { label: 'Recovery',     color: '#8b5cf6', order: 4 },
  review:       { label: 'Review',       color: '#22c55e', order: 5 },
  closed:       { label: 'Closed',       color: '#6b7280', order: 6 },
};

const PHASES = ['detection', 'assessment', 'containment', 'remediation', 'recovery', 'review', 'closed'] as const;

const TIMELINE_ICONS: Record<string, string> = {
  phase_change: '\u2192',
  note: '\uD83D\uDCDD',
  escalation: '\u26A0\uFE0F',
  action_taken: '\u2705',
  evidence_attached: '\uD83D\uDCCE',
};

export default function IncidentsTab({ productId }: { productId: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [filterPhase, setFilterPhase] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchIncidents() {
    const params = new URLSearchParams();
    if (filterPhase) params.set('phase', filterPhase);
    if (filterSeverity) params.set('severity', filterSeverity);
    const qs = params.toString() ? '?' + params.toString() : '';
    const [listRes, summaryRes] = await Promise.all([
      fetch(`/api/products/${productId}/incidents${qs}`, { headers }),
      fetch(`/api/products/${productId}/incidents/summary`, { headers }),
    ]);
    if (listRes.ok) {
      const data = await listRes.json();
      setIncidents(data.incidents);
    }
    if (summaryRes.ok) {
      const data = await summaryRes.json();
      setSummary(data);
    }
    setLoading(false);
  }

  async function fetchDetail(id: string) {
    const res = await fetch(`/api/products/${productId}/incidents/${id}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setSelectedIncident(data.incident);
      setTimeline(data.timeline);
    }
  }

  useEffect(() => { fetchIncidents(); }, [productId, filterPhase, filterSeverity]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/products/${productId}/incidents`, {
      method: 'POST', headers,
      body: JSON.stringify({
        title: fd.get('title'),
        description: fd.get('description') || null,
        severity: fd.get('severity'),
        incident_lead: fd.get('incident_lead') || null,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      fetchIncidents();
    }
  }

  async function handlePhaseChange(id: string, newPhase: string) {
    const res = await fetch(`/api/products/${productId}/incidents/${id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ phase: newPhase }),
    });
    if (res.ok) {
      fetchIncidents();
      if (selectedId === id) fetchDetail(id);
    }
  }

  async function handleEscalate(id: string) {
    const csirt = prompt('CSIRT country code (e.g. DE, FR):');
    if (!csirt) return;
    const res = await fetch(`/api/products/${productId}/incidents/${id}/escalate`, {
      method: 'POST', headers,
      body: JSON.stringify({ csirt_country: csirt.toUpperCase(), report_type: 'incident' }),
    });
    if (res.ok) {
      fetchIncidents();
      if (selectedId === id) fetchDetail(id);
    } else {
      const err = await res.json();
      alert(err.error || 'Escalation failed');
    }
  }

  async function handleAddNote(id: string) {
    const desc = prompt('Timeline note:');
    if (!desc) return;
    await fetch(`/api/products/${productId}/incidents/${id}/timeline`, {
      method: 'POST', headers,
      body: JSON.stringify({ event_type: 'note', description: desc }),
    });
    if (selectedId === id) fetchDetail(id);
  }

  async function handleUpdateReview(id: string, fields: Record<string, string>) {
    await fetch(`/api/products/${productId}/incidents/${id}`, {
      method: 'PUT', headers,
      body: JSON.stringify(fields),
    });
    fetchIncidents();
    if (selectedId === id) fetchDetail(id);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this incident? This cannot be undone.')) return;
    const res = await fetch(`/api/products/${productId}/incidents/${id}`, {
      method: 'DELETE', headers,
    });
    if (res.ok) {
      setSelectedId(null);
      setSelectedIncident(null);
      fetchIncidents();
    } else {
      const err = await res.json();
      alert(err.error || 'Delete failed');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="spin" size={24} /></div>;

  // ── Detail view ──────────────────────────────────────────────

  if (selectedId && selectedIncident) {
    const sev = SEVERITY_CONFIG[selectedIncident.severity] || SEVERITY_CONFIG.P3;
    const ph = PHASE_CONFIG[selectedIncident.phase] || PHASE_CONFIG.detection;

    return (
      <div className="fi-detail">
        <button className="fi-back-btn" onClick={() => { setSelectedId(null); setSelectedIncident(null); }}>
          <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} /> Back to list
        </button>

        <div className="fi-detail-header">
          <h2>{selectedIncident.title}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="fi-badge" style={{ background: sev.bg, color: sev.color }}>{sev.label}</span>
            <span className="fi-badge" style={{ background: 'rgba(107,114,128,0.1)', color: ph.color }}>{ph.label}</span>
          </div>
        </div>

        {selectedIncident.description && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
            {selectedIncident.description}
          </p>
        )}

        {/* Phase progression */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
          {PHASES.map((p) => {
            const conf = PHASE_CONFIG[p];
            const current = PHASE_CONFIG[selectedIncident.phase];
            const isActive = conf.order <= current.order;
            const isCurrent = p === selectedIncident.phase;
            return (
              <div key={p} style={{
                flex: 1, minWidth: 80, padding: '6px 8px', borderRadius: 6, textAlign: 'center',
                fontSize: 11, fontWeight: isCurrent ? 700 : 500,
                background: isActive ? conf.color + '18' : '#f3f4f6',
                color: isActive ? conf.color : '#9ca3af',
                border: isCurrent ? `2px solid ${conf.color}` : '2px solid transparent',
              }}>
                {conf.label}
              </div>
            );
          })}
        </div>

        {/* Details grid */}
        <div className="fi-detail-grid">
          <div className="fi-detail-row"><span className="fi-detail-label">Detected</span><span>{formatDateTime(selectedIncident.detected_at)}</span></div>
          {selectedIncident.incident_lead && <div className="fi-detail-row"><span className="fi-detail-label">Lead</span><span>{selectedIncident.incident_lead}</span></div>}
          {selectedIncident.contained_at && <div className="fi-detail-row"><span className="fi-detail-label">Contained</span><span>{formatDateTime(selectedIncident.contained_at)}</span></div>}
          {selectedIncident.resolved_at && <div className="fi-detail-row"><span className="fi-detail-label">Resolved</span><span>{formatDateTime(selectedIncident.resolved_at)}</span></div>}
          {selectedIncident.review_completed_at && <div className="fi-detail-row"><span className="fi-detail-label">Review completed</span><span>{formatDateTime(selectedIncident.review_completed_at)}</span></div>}
          {selectedIncident.root_cause && <div className="fi-detail-row"><span className="fi-detail-label">Root cause</span><span>{selectedIncident.root_cause}</span></div>}
          {selectedIncident.impact_summary && <div className="fi-detail-row"><span className="fi-detail-label">Impact</span><span>{selectedIncident.impact_summary}</span></div>}
          {selectedIncident.lessons_learned && <div className="fi-detail-row"><span className="fi-detail-label">Lessons learned</span><span>{selectedIncident.lessons_learned}</span></div>}
          {selectedIncident.linked_report_id && <div className="fi-detail-row"><span className="fi-detail-label">ENISA report</span><span style={{ color: '#a855f7' }}>Linked <ExternalLink size={12} /></span></div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {selectedIncident.phase !== 'closed' && (
            <select
              className="fi-status-select"
              value={selectedIncident.phase}
              onChange={(e) => handlePhaseChange(selectedIncident.id, e.target.value)}
            >
              {PHASES.map(p => (
                <option key={p} value={p} disabled={PHASE_CONFIG[p].order < PHASE_CONFIG[selectedIncident.phase].order}>
                  {PHASE_CONFIG[p].label}
                </option>
              ))}
            </select>
          )}
          <button className="fi-action-btn" onClick={() => handleAddNote(selectedIncident.id)}>Add note</button>
          {!selectedIncident.linked_report_id && (
            <button className="fi-action-btn fi-action-btn-warn" onClick={() => handleEscalate(selectedIncident.id)}>
              Escalate to ENISA
            </button>
          )}
          {selectedIncident.phase === 'review' && (
            <button className="fi-action-btn" onClick={() => {
              const rc = prompt('Root cause:', selectedIncident.root_cause || '');
              if (rc === null) return;
              const ll = prompt('Lessons learned:', selectedIncident.lessons_learned || '');
              if (ll === null) return;
              const imp = prompt('Impact summary:', selectedIncident.impact_summary || '');
              if (imp === null) return;
              handleUpdateReview(selectedIncident.id, { root_cause: rc, lessons_learned: ll, impact_summary: imp });
            }}>
              Document review
            </button>
          )}
          {selectedIncident.phase === 'detection' && (
            <button className="fi-action-btn fi-action-btn-danger" onClick={() => handleDelete(selectedIncident.id)}>
              <X size={12} /> Delete
            </button>
          )}
        </div>

        {/* Timeline */}
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>
          <Clock size={14} /> Timeline ({timeline.length} entries)
        </h3>
        <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: 16 }}>
          {timeline.map(t => (
            <div key={t.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {TIMELINE_ICONS[t.event_type] || '\u2022'} {formatDateTime(t.created_at)}
                {t.created_by && <span> — {t.created_by}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#111827', marginTop: 2 }}>{t.description}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────

  return (
    <div>
      {/* Summary bar */}
      {summary && summary.total > 0 && (
        <div className="fi-summary-bar">
          <div className="fi-summary-stat">
            <span className="fi-summary-value">{summary.total}</span>
            <span className="fi-summary-label">Total</span>
          </div>
          <div className="fi-summary-stat">
            <span className="fi-summary-value" style={{ color: summary.active > 0 ? '#ef4444' : '#22c55e' }}>{summary.active}</span>
            <span className="fi-summary-label">Active</span>
          </div>
          {summary.avgResolutionHours !== null && (
            <div className="fi-summary-stat">
              <span className="fi-summary-value">{summary.avgResolutionHours < 24 ? `${summary.avgResolutionHours}h` : `${Math.round(summary.avgResolutionHours / 24)}d`}</span>
              <span className="fi-summary-label">Avg resolution</span>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="fi-toolbar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} className="fi-filter-select">
            <option value="">All phases</option>
            {PHASES.map(p => <option key={p} value={p}>{PHASE_CONFIG[p].label}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="fi-filter-select">
            <option value="">All severities</option>
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button className="fi-create-btn" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New incident
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form className="fi-create-form" onSubmit={handleCreate}>
          <div className="fi-form-row">
            <label>Title *</label>
            <input type="text" name="title" required placeholder="Brief incident description" />
          </div>
          <div className="fi-form-row">
            <label>Description</label>
            <textarea name="description" rows={3} placeholder="What was detected? Initial observations..." />
          </div>
          <div className="fi-form-row-inline">
            <div className="fi-form-row">
              <label>Severity</label>
              <select name="severity" defaultValue="P3">
                {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="fi-form-row">
              <label>Incident lead</label>
              <input type="text" name="incident_lead" placeholder="email or name" />
            </div>
          </div>
          <div className="fi-form-actions">
            <button type="submit" className="fi-save-btn">Create incident</button>
            <button type="button" className="fi-cancel-btn" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Incident list */}
      {incidents.length === 0 ? (
        <div className="fi-empty">
          <AlertTriangle size={32} style={{ color: '#d1d5db', marginBottom: 8 }} />
          <p>No incidents recorded for this product.</p>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>
            Create an incident to begin tracking your internal response lifecycle.
          </p>
        </div>
      ) : (
        <div className="fi-list">
          {incidents.map(inc => {
            const sev = SEVERITY_CONFIG[inc.severity] || SEVERITY_CONFIG.P3;
            const ph = PHASE_CONFIG[inc.phase] || PHASE_CONFIG.detection;
            return (
              <div key={inc.id} className="fi-row" onClick={() => setSelectedId(inc.id)}>
                <div className="fi-row-main">
                  <span className="fi-badge" style={{ background: sev.bg, color: sev.color, minWidth: 28, textAlign: 'center' }}>
                    {inc.severity}
                  </span>
                  <div className="fi-row-title">
                    <span className="fi-row-name">{inc.title}</span>
                    <span className="fi-row-meta">{formatDateTime(inc.detected_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="fi-badge" style={{ background: ph.color + '18', color: ph.color }}>
                    {ph.label}
                  </span>
                  {inc.linked_report_id && (
                    <span className="fi-badge" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }} title="Escalated to ENISA">
                      ENISA
                    </span>
                  )}
                  <ChevronRight size={14} style={{ color: '#9ca3af' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
