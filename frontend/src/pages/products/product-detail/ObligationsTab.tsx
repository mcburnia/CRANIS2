import { useState, useEffect } from 'react';
import {
  Shield, ChevronRight, ChevronDown, Loader2, Download, Save, Info, AlertTriangle, Sparkles,
} from 'lucide-react';
import type { Product } from './shared';
import { CATEGORY_INFO } from './shared';

type ObligationRecord = {
  id: string;
  obligationKey: string;
  article: string;
  title: string;
  description: string;
  status: string;
  derivedStatus: string | null;
  derivedReason: string | null;
  effectiveStatus: string;
  notes: string;
};

const STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, met: 2 };
function maxStatus(a: string, b: string | null): string {
  if (!b) return a;
  return (STATUS_ORDER[a] ?? 0) >= (STATUS_ORDER[b] ?? 0) ? a : b;
}

export default function ObligationsTab({ product }: { product: Product }) {
  const [obligations, setObligations] = useState<ObligationRecord[]>([]);
  const [obLoading, setObLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exportingObl, setExportingObl] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [obAiSuggesting, setObAiSuggesting] = useState<string | null>(null);
  const [obShowUpgrade, setObShowUpgrade] = useState(false);
  const [obAiError, setObAiError] = useState<string | null>(null);
  const token = localStorage.getItem('session_token');

  async function handleExportObl(format: 'pdf' | 'csv') {
    setExportingObl(format);
    try {
      const res = await fetch(`/api/products/${product.id}/reports/obligations?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `obligations-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export obligation report.');
    } finally {
      setExportingObl(null);
    }
  }

  async function fetchObligations() {
    try {
      const res = await fetch(`/api/obligations/${product.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setObligations(data.obligations);
      }
    } catch (err) {
      console.error('Failed to fetch obligations:', err);
    } finally {
      setObLoading(false);
    }
  }

  useEffect(() => { fetchObligations(); }, [product.id]);

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/obligations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setObligations(prev => prev.map(o => o.id === id
          ? { ...o, status: newStatus, effectiveStatus: maxStatus(newStatus, o.derivedStatus) }
          : o));
      }
    } catch (err) {
      console.error('Failed to update obligation:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveNotes(ob: ObligationRecord) {
    setSavingNotes(ob.id);
    try {
      const res = await fetch(`/api/obligations/${ob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: editingNotes[ob.id] ?? ob.notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setObligations(prev => prev.map(o => o.id === ob.id ? { ...o, notes: updated.notes ?? editingNotes[ob.id] ?? ob.notes } : o));
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNotes(null);
    }
  }

  async function handleObAiSuggest(ob: ObligationRecord) {
    setObAiSuggesting(ob.id);
    setObAiError(null);
    setObShowUpgrade(false);
    try {
      const existingNotes = editingNotes[ob.id] ?? ob.notes;
      const res = await fetch('/api/copilot/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: product.id,
          sectionKey: ob.obligationKey,
          type: 'obligation',
          existingContent: existingNotes || undefined,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setObShowUpgrade(true);
          return;
        }
      }
      if (!res.ok) throw new Error('Failed to generate suggestion');

      const data = await res.json();
      setEditingNotes(prev => ({ ...prev, [ob.id]: data.suggestion }));
      // Auto-expand notes if not already
      setExpandedNotes(ob.id);
    } catch (err: any) {
      setObAiError(err.message || 'AI suggestion failed');
    } finally {
      setObAiSuggesting(null);
    }
  }

  if (obLoading) {
    return <div className="pd-obligations"><p style={{ color: 'var(--muted)' }}>Loading obligations...</p></div>;
  }

  return (
    <div className="pd-obligations">
      <div className="pd-section-intro">
        <Shield size={20} />
        <div>
          <h3>CRA Obligations for {CATEGORY_INFO[product.craCategory]?.label || 'Default'} Products</h3>
          <p>These are the key regulatory obligations under the EU Cyber Resilience Act that apply to your product. Use the dropdown to set your manual compliance status, or let the platform auto-detect progress from your data.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="tf-doc-download-btn" onClick={() => handleExportObl('pdf')} disabled={!!exportingObl}>
          {exportingObl === 'pdf' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {exportingObl === 'pdf' ? 'Generating...' : 'Export PDF'}
        </button>
        <button className="tf-doc-download-btn" onClick={() => handleExportObl('csv')} disabled={!!exportingObl}>
          {exportingObl === 'csv' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {exportingObl === 'csv' ? 'Generating...' : 'Export CSV'}
        </button>
      </div>
      <p className="pd-ob-legend">
        <span className="pd-ob-legend-dot" /> Manual&nbsp;&nbsp;&nbsp;
        <span className="pd-ob-auto-badge">auto</span> Auto-detected from platform data
      </p>
      <div className="pd-obligations-list">
        {obligations.map((ob) => {
          const isAutoAdvanced = ob.derivedStatus && ob.effectiveStatus !== ob.status;
          const isPlatformConfirmed = ob.derivedStatus && ob.derivedStatus === ob.status && ob.status !== 'not_started';
          return (
            <div key={ob.id} className="pd-obligation-card">
              <div className="pd-obligation-header">
                <span className="pd-obligation-article">{ob.article}</span>
                <div className="pd-ob-status-group">
                  {isAutoAdvanced && (
                    <span
                      className="pd-ob-auto-badge"
                      title={ob.derivedReason || 'Auto-detected from platform data'}
                    >
                      auto: {ob.effectiveStatus === 'met' ? 'Met' : 'In Progress'}
                    </span>
                  )}
                  {isPlatformConfirmed && (
                    <span
                      className="pd-ob-confirmed"
                      title={ob.derivedReason || 'Confirmed by platform data'}
                    >✓ confirmed</span>
                  )}
                  <select
                    className={`pd-obligation-status status-${ob.status}`}
                    value={ob.status}
                    disabled={updatingId === ob.id}
                    onChange={e => handleStatusChange(ob.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="met">Met</option>
                  </select>
                </div>
              </div>
              <h4>{ob.title}</h4>
              <p>{ob.description}</p>
              {ob.derivedReason && ob.derivedStatus && (
                <p className="pd-ob-derived-reason">{ob.derivedReason}</p>
              )}

              {/* Notes toggle + AI Suggest */}
              <div className="ob-notes-toggle-row">
                <button
                  className="ob-notes-toggle"
                  onClick={() => {
                    if (expandedNotes === ob.id) {
                      setExpandedNotes(null);
                    } else {
                      setExpandedNotes(ob.id);
                      if (editingNotes[ob.id] === undefined) {
                        setEditingNotes(prev => ({ ...prev, [ob.id]: ob.notes || '' }));
                      }
                    }
                  }}
                >
                  {expandedNotes === ob.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Evidence Notes {ob.notes ? '(has content)' : ''}
                </button>
                <button
                  className="btn ai-suggest-btn ai-suggest-btn-sm"
                  onClick={() => handleObAiSuggest(ob)}
                  disabled={obAiSuggesting === ob.id}
                  title="Generate AI-drafted evidence notes (Pro plan)"
                >
                  {obAiSuggesting === ob.id
                    ? <Loader2 size={12} className="spin" />
                    : <Sparkles size={12} />}
                  {obAiSuggesting === ob.id ? 'Generating…' : 'AI Suggest'}
                </button>
              </div>

              {expandedNotes === ob.id && (
                <div className="ob-notes-editor">
                  {obAiSuggesting === ob.id && (
                    <div className="ai-suggesting-banner">
                      <Loader2 size={14} className="spin" />
                      <span>Generating evidence notes with AI…</span>
                    </div>
                  )}
                  {obShowUpgrade && expandedNotes === ob.id && (
                    <div className="ai-upgrade-banner">
                      <Info size={14} />
                      <span>AI Suggest requires the <strong>Pro</strong> plan. <a href="/billing">Upgrade now</a></span>
                    </div>
                  )}
                  {obAiError && expandedNotes === ob.id && (
                    <div className="ai-error-banner">
                      <AlertTriangle size={14} />
                      <span>{obAiError}</span>
                    </div>
                  )}
                  <textarea
                    className="ob-notes-textarea"
                    rows={5}
                    placeholder="Document how this obligation is met — evidence, references, compliance notes…"
                    value={editingNotes[ob.id] ?? ob.notes ?? ''}
                    onChange={(e) => setEditingNotes(prev => ({ ...prev, [ob.id]: e.target.value }))}
                  />
                  <div className="ob-notes-actions">
                    <button
                      className="btn btn-primary ob-notes-save"
                      onClick={() => handleSaveNotes(ob)}
                      disabled={savingNotes === ob.id}
                    >
                      {savingNotes === ob.id ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                      {savingNotes === ob.id ? 'Saving…' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
