import { useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, Loader2, X, ArrowRight,
  Ban, Eye, Wrench, ChevronDown, ChevronRight,
} from 'lucide-react';

interface Finding {
  id: string;
  title: string;
  severity: string;
  source_id: string;
  dependency_name: string;
  dependency_version: string;
  fixed_version: string | null;
  description: string;
  mitigation: string;
  status: string;
}

interface TriageDecision {
  findingId: string;
  action: 'dismiss' | 'acknowledge' | 'mitigate' | 'skip';
  reason?: string;
}

interface Props {
  productId: string;
  findings: Finding[];
  onClose: () => void;
  onComplete: () => void;
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const severityColor: Record<string, string> = { critical: '#dc2626', high: '#f97316', medium: 'var(--amber)', low: '#3b82f6' };

function suggestAction(f: Finding): { action: TriageDecision['action']; reason: string } {
  if (f.fixed_version) {
    return { action: 'mitigate', reason: `Update ${f.dependency_name} to ${f.fixed_version}` };
  }
  if (f.severity === 'low') {
    return { action: 'acknowledge', reason: 'Low severity, no fix available - monitor for updates' };
  }
  return { action: 'acknowledge', reason: 'No fix available yet - acknowledge and monitor' };
}

export default function PostScanTriageWizard({ productId, findings, onClose, onComplete }: Props) {
  const triageableFindings = findings
    .filter(f => f.status === 'open' || f.status === 'acknowledged')
    .sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  const [step, setStep] = useState<'review' | 'applying' | 'done'>('review');
  const [decisions, setDecisions] = useState<Record<string, TriageDecision>>(() => {
    const init: Record<string, TriageDecision> = {};
    for (const f of triageableFindings) {
      const suggestion = suggestAction(f);
      init[f.id] = { findingId: f.id, action: suggestion.action, reason: suggestion.reason };
    }
    return init;
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const setAction = (findingId: string, action: TriageDecision['action'], reason?: string) => {
    setDecisions(prev => ({ ...prev, [findingId]: { findingId, action, reason: reason || prev[findingId]?.reason } }));
  };

  const handleApply = async () => {
    setStep('applying');
    setError(null);
    try {
      const decisionList = Object.values(decisions);
      const res = await fetch(`/api/risk-findings/${productId}/batch-triage`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: decisionList }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to apply triage decisions');
        setStep('review');
        return;
      }
      const data = await res.json();
      setResult(data);
      setStep('done');
    } catch {
      setError('Failed to connect to server');
      setStep('review');
    }
  };

  const actionCounts = Object.values(decisions).reduce((acc, d) => {
    acc[d.action] = (acc[d.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bf-overlay" onClick={onClose}>
      <div className="bf-modal pst-modal" onClick={e => e.stopPropagation()}>
        <div className="bf-header">
          <Shield size={20} />
          <h3>Triage Findings</h3>
          <button className="bf-close" onClick={onClose}><X size={18} /></button>
        </div>

        {step === 'review' && (
          <>
            <div className="bf-body">
              {triageableFindings.length === 0 ? (
                <div className="pst-empty">
                  <CheckCircle2 size={32} style={{ color: 'var(--green)' }} />
                  <p>No open findings to triage. All findings have been handled.</p>
                </div>
              ) : (
                <>
                  <p className="pst-intro">
                    {triageableFindings.length} open finding{triageableFindings.length !== 1 ? 's' : ''} to review.
                    Each has a suggested action based on available fix data. Adjust as needed, then apply.
                  </p>

                  {error && (
                    <div className="pst-error">
                      <AlertTriangle size={14} /> {error}
                    </div>
                  )}

                  <div className="pst-findings-list">
                    {triageableFindings.map(f => {
                      const dec = decisions[f.id];
                      const expanded = expandedIds.has(f.id);
                      return (
                        <div key={f.id} className={`pst-finding ${dec?.action === 'skip' ? 'pst-skipped' : ''}`}>
                          <div className="pst-finding-header" onClick={() => toggleExpand(f.id)}>
                            <span className="pst-severity" style={{ background: `${severityColor[f.severity]}22`, color: severityColor[f.severity] }}>
                              {f.severity}
                            </span>
                            <div className="pst-finding-info">
                              <div className="pst-finding-title">{f.title.substring(0, 100)}</div>
                              <div className="pst-finding-meta">
                                <span>{f.source_id}</span>
                                <span>{f.dependency_name}@{f.dependency_version}</span>
                                {f.fixed_version && <span className="pst-fix-available">Fix: {f.fixed_version}</span>}
                              </div>
                            </div>
                            <span className="pst-expand-icon">
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                          </div>

                          {expanded && f.description && (
                            <div className="pst-finding-desc">{f.description.substring(0, 300)}</div>
                          )}

                          <div className="pst-actions">
                            {dec?.reason && (
                              <div className="pst-suggestion">{dec.reason}</div>
                            )}
                            <div className="pst-action-btns">
                              <button
                                className={`pst-action-btn ${dec?.action === 'dismiss' ? 'active' : ''}`}
                                onClick={() => setAction(f.id, 'dismiss', dec?.reason)}
                                title="Dismiss - not applicable or accepted risk"
                              >
                                <Ban size={13} /> Dismiss
                              </button>
                              <button
                                className={`pst-action-btn ${dec?.action === 'acknowledge' ? 'active' : ''}`}
                                onClick={() => setAction(f.id, 'acknowledge', dec?.reason)}
                                title="Acknowledge - noted, under review"
                              >
                                <Eye size={13} /> Acknowledge
                              </button>
                              <button
                                className={`pst-action-btn ${dec?.action === 'mitigate' ? 'active' : ''}`}
                                onClick={() => setAction(f.id, 'mitigate', f.fixed_version ? `Update ${f.dependency_name} to ${f.fixed_version}` : dec?.reason)}
                                title="Mitigate - fix applied or workaround in place"
                              >
                                <Wrench size={13} /> Mitigate
                              </button>
                              <button
                                className={`pst-action-btn pst-skip-btn ${dec?.action === 'skip' ? 'active' : ''}`}
                                onClick={() => setAction(f.id, 'skip')}
                                title="Skip - decide later"
                              >
                                <ArrowRight size={13} /> Skip
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="bf-footer">
              <div className="pst-summary-bar">
                {actionCounts.dismiss ? <span className="pst-count dismiss">{actionCounts.dismiss} dismiss</span> : null}
                {actionCounts.acknowledge ? <span className="pst-count acknowledge">{actionCounts.acknowledge} acknowledge</span> : null}
                {actionCounts.mitigate ? <span className="pst-count mitigate">{actionCounts.mitigate} mitigate</span> : null}
                {actionCounts.skip ? <span className="pst-count skip">{actionCounts.skip} skip</span> : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="bf-btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  className="bf-btn-primary"
                  onClick={handleApply}
                  disabled={triageableFindings.length === 0 || Object.values(decisions).every(d => d.action === 'skip')}
                >
                  Apply Decisions <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'applying' && (
          <div className="bf-body bf-running">
            <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }} />
            <p>Applying triage decisions...</p>
          </div>
        )}

        {step === 'done' && result && (
          <>
            <div className="bf-body">
              <div className="pst-done-header">
                <CheckCircle2 size={32} style={{ color: 'var(--green)' }} />
                <h4>Triage Complete</h4>
              </div>

              <div className="pst-done-stats">
                <div className="pst-stat">
                  <span className="pst-stat-num">{result.summary.applied}</span>
                  <span className="pst-stat-label">Applied</span>
                </div>
                <div className="pst-stat">
                  <span className="pst-stat-num">{result.summary.skipped}</span>
                  <span className="pst-stat-label">Skipped</span>
                </div>
                <div className="pst-stat">
                  <span className="pst-stat-num">{result.summary.total}</span>
                  <span className="pst-stat-label">Total</span>
                </div>
              </div>

              <div className="pst-results-list">
                {result.results.filter((r: any) => r.applied).map((r: any) => (
                  <div key={r.findingId} className="pst-result-row applied">
                    <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                    <span className="pst-result-action">{r.action}</span>
                    <span className="pst-result-id">{r.findingId.substring(0, 8)}...</span>
                  </div>
                ))}
                {result.results.filter((r: any) => !r.applied && r.action !== 'skip').map((r: any) => (
                  <div key={r.findingId} className="pst-result-row failed">
                    <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
                    <span className="pst-result-action">{r.action}</span>
                    <span className="pst-result-id">{r.findingId.substring(0, 8)}... (not found)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bf-footer">
              <div />
              <button className="bf-btn-primary" onClick={() => { onComplete(); onClose(); }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
