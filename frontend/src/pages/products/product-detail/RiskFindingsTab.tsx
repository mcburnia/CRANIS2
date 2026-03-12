import { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, Loader2, Download, X, RefreshCw, Info, Sparkles, Copy, Check,
} from 'lucide-react';

export default function RiskFindingsTab({ productId }: { productId: string }) {
  const [findings, setFindings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [lastScan, setLastScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [exportingVuln, setExportingVuln] = useState<string | null>(null);

  // AI Triage state
  const [triaging, setTriaging] = useState(false);
  const [triagingSingle, setTriagingSingle] = useState<string | null>(null);
  const [triageSuggestions, setTriageSuggestions] = useState<Record<string, any>>({});
  const [triageError, setTriageError] = useState<string | null>(null);
  const [showTriageUpgrade, setShowTriageUpgrade] = useState(false);
  const [bulkAutoApply, setBulkAutoApply] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');

  async function handleExportVuln(format: 'pdf' | 'csv') {
    setExportingVuln(format);
    try {
      const res = await fetch(`/api/products/${productId}/reports/vulnerabilities?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `vuln-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export vulnerability report.');
    } finally {
      setExportingVuln(null);
    }
  }

  // AI Triage — bulk (all open findings)
  const handleTriageAll = async () => {
    setTriaging(true);
    setTriageError(null);
    setShowTriageUpgrade(false);
    try {
      const res = await fetch('/api/copilot/triage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, autoApply: bulkAutoApply }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setShowTriageUpgrade(true);
        } else {
          setTriageError(data.error || 'Access denied');
        }
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setTriageError(data.error || 'Triage failed');
        return;
      }
      const data = await res.json();
      const map: Record<string, any> = {};
      for (const s of data.suggestions || []) {
        map[s.findingId] = s;
      }
      setTriageSuggestions(prev => ({ ...prev, ...map }));
      if (data.autoApplied > 0) {
        fetchFindings();
      }
    } catch {
      setTriageError('Failed to connect to AI triage service');
    } finally {
      setTriaging(false);
    }
  };

  // AI Triage — single finding
  const handleTriageSingle = async (findingId: string) => {
    setTriagingSingle(findingId);
    setTriageError(null);
    setShowTriageUpgrade(false);
    try {
      const res = await fetch('/api/copilot/triage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, findingIds: [findingId] }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setShowTriageUpgrade(true);
        } else {
          setTriageError(data.error || 'Access denied');
        }
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setTriageError(data.error || 'Triage failed');
        return;
      }
      const data = await res.json();
      for (const s of data.suggestions || []) {
        setTriageSuggestions(prev => ({ ...prev, [s.findingId]: s }));
      }
    } catch {
      setTriageError('Failed to connect to AI triage service');
    } finally {
      setTriagingSingle(null);
    }
  };

  // Accept triage suggestion — update finding status
  const handleAcceptTriage = async (findingId: string, suggestion: any) => {
    const statusMap: Record<string, string> = {
      dismiss: 'dismissed',
      acknowledge: 'acknowledged',
      escalate_mitigate: 'mitigated',
    };
    const newStatus = statusMap[suggestion.suggestedAction] || 'acknowledged';
    const reason = suggestion.dismissReason || suggestion.reasoning?.substring(0, 200) || '';
    await fetch(`/api/risk-findings/${findingId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, reason }),
    });
    setTriageSuggestions(prev => { const next = { ...prev }; delete next[findingId]; return next; });
    fetchFindings();
  };

  // Reject triage suggestion — just remove the card
  const handleRejectTriage = (findingId: string) => {
    setTriageSuggestions(prev => { const next = { ...prev }; delete next[findingId]; return next; });
  };

  const fetchFindings = () => {
    fetch(`/api/risk-findings/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setFindings(d.findings || []); setSummary(d.summary || null); setLastScan(d.lastScan || null); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchFindings(); }, [productId]);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const resp = await fetch(`/api/risk-findings/${productId}/scan`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (resp.status === 409) {
        // Already running — just poll the existing scan
        const existing = await resp.json();
        if (existing.scanId) {
          let done = false; let attempts = 0;
          while (!done && attempts < 60) {
            await new Promise(r => setTimeout(r, 3000));
            const poll = await fetch(`/api/risk-findings/scan/${existing.scanId}`, { headers: { Authorization: `Bearer ${token}` } });
            const pollData = await poll.json();
            if (pollData.status === 'completed' || pollData.status === 'failed') done = true;
            attempts++;
          }
        }
      } else {
        const result = await resp.json();
        if (result.scanId) {
          let done = false; let attempts = 0;
          while (!done && attempts < 60) {
            await new Promise(r => setTimeout(r, 3000));
            const poll = await fetch(`/api/risk-findings/scan/${result.scanId}`, { headers: { Authorization: `Bearer ${token}` } });
            const pollData = await poll.json();
            if (pollData.status === 'completed' || pollData.status === 'failed') done = true;
            attempts++;
          }
        }
      }
    } catch (err) { console.error('Scan failed', err); }
    setScanning(false);
    fetchFindings();
  };

  const handleDismiss = async (findingId: string) => {
    const reason = prompt('What action was taken to mitigate this vulnerability?');
    await fetch(`/api/risk-findings/${findingId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', reason: reason || '' }),
    });
    fetchFindings();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  if (loading) return <div className="pd-placeholder"><p>Loading risk findings...</p></div>;

  const severityColor: Record<string, string> = { critical: '#dc2626', high: '#f97316', medium: 'var(--amber)', low: '#3b82f6' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          {summary && (
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {summary.total} findings ({summary.open} open{summary.resolved > 0 ? ', ' + summary.resolved + ' resolved' : ''}{summary.mitigated > 0 ? ', ' + summary.mitigated + ' mitigated' : ''}{summary.dismissed > 0 ? ', ' + summary.dismissed + ' dismissed' : ''})
              {summary.open > 0 ? <>&mdash;
              {summary.critical > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}> {summary.critical} critical</span>}
              {summary.high > 0 && <span style={{ color: '#f97316', fontWeight: 600 }}> {summary.high} high</span>}
              {summary.medium > 0 && <span style={{ color: 'var(--amber)' }}> {summary.medium} medium</span>}
              {summary.low > 0 && <span style={{ color: '#3b82f6' }}> {summary.low} low</span>}
              </> : summary.total > 0 ? <span style={{ color: 'var(--green)', fontWeight: 500 }}> &mdash; All findings handled</span> : null}
            </span>
          )}
          {lastScan && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '1rem' }}>Last scan: {new Date(lastScan.completed_at).toLocaleString()}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="ai-triage-auto-label" title="Automatically dismiss findings where AI confidence is 85%+">
            <input type="checkbox" checked={bulkAutoApply} onChange={e => setBulkAutoApply(e.target.checked)} />
            Auto-dismiss
          </label>
          <button className="btn ai-triage-all-btn" onClick={handleTriageAll} disabled={triaging || findings.filter(f => f.status === 'open' || f.status === 'acknowledged').length === 0}>
            {triaging ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {triaging ? 'Triaging…' : 'AI Triage All'}
          </button>
          <button className="tf-doc-download-btn" onClick={() => handleExportVuln('csv')} disabled={!!exportingVuln}>
            {exportingVuln === 'csv' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {exportingVuln === 'csv' ? 'Generating...' : 'Export CSV'}
          </button>
          <button onClick={handleScan} disabled={scanning}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: scanning ? 0.6 : 1 }}>
            {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {showTriageUpgrade && (
        <div className="ai-upgrade-banner" style={{ marginBottom: '0.75rem' }}>
          <Info size={14} />
          <span>AI Triage requires the <strong>Pro</strong> plan. <a href="/billing">Upgrade now</a></span>
          <button onClick={() => setShowTriageUpgrade(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={14} /></button>
        </div>
      )}

      {triageError && (
        <div className="ai-error-banner" style={{ marginBottom: '0.75rem' }}>
          <AlertTriangle size={14} />
          <span>{triageError}</span>
          <button onClick={() => setTriageError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={14} /></button>
        </div>
      )}

      {findings.length === 0 && !lastScan && (
        <div className="pd-placeholder">
          <Shield size={48} strokeWidth={1} />
          <h3>No Risk Findings Yet</h3>
          <p>Click "Scan Now" to scan this product's dependencies against the local vulnerability database.</p>
        </div>
      )}

      {findings.length === 0 && lastScan && (
        <div className="pd-placeholder" style={{ color: 'var(--green)' }}>
          <Shield size={48} strokeWidth={1} />
          <h3>No Vulnerabilities Found</h3>
          <p>The last scan found no known vulnerabilities in your dependencies.</p>
        </div>
      )}

      {findings.map(f => (
        <div key={f.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.6rem 0' }}>
          <div onClick={() => toggleExpand(f.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase' as const, background: `${severityColor[f.severity]}33`, color: severityColor[f.severity], minWidth: '55px', textAlign: 'center' as const }}>{f.severity}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{f.title.substring(0, 120)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <span>{f.source_id}</span>
                <span>{f.dependency_name}@{f.dependency_version}</span>
                {f.fixed_version && <span>Fix: {f.fixed_version}</span>}
                {f.status === 'dismissed' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Dismissed</span>}
                {f.status === 'resolved' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Resolved</span>}
                {f.status === 'mitigated' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Mitigated</span>}
                {f.status === 'acknowledged' && <span style={{ color: 'var(--amber)', fontWeight: 500 }}>⚠ Acknowledged</span>}
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--accent)", cursor: "pointer" }}>{expandedIds.has(f.id) ? <><ChevronDown size={14} /> Close</> : <><ChevronRight size={14} /> View</>}</span>
          </div>
          {expandedIds.has(f.id) && (
            <div style={{ paddingLeft: '4rem', paddingTop: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {f.mitigation && (
                <div style={{ background: 'rgba(100, 149, 237, 0.08)', border: '1px solid rgba(100, 149, 237, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase' as const }}>Recommended Action</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{f.mitigation}</div>
                </div>
              )}
              {!f.mitigation && f.fixed_version && (
                <div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.3rem', textTransform: 'uppercase' as const }}>Fix Available</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Upgrade {f.dependency_name} to version {f.fixed_version} or later.</div>
                </div>
              )}
              <p>{f.description?.substring(0, 500)}</p>
              {f.status === 'dismissed' && (<div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.2rem' }}>✓ DISMISSED</div>{f.dismissed_reason && <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{f.dismissed_reason}</div>}{f.dismissed_at && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>on {new Date(f.dismissed_at).toLocaleDateString()}</div>}</div>)}
              {f.status === 'resolved' && (<div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.2rem' }}>✓ RESOLVED</div>{f.mitigation_notes && <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{f.mitigation_notes}</div>}{f.resolved_at && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>on {new Date(f.resolved_at).toLocaleDateString()}</div>}</div>)}
              {f.status === 'mitigated' && (<div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.2rem' }}>✓ MITIGATED</div>{f.mitigation_notes && <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{f.mitigation_notes}</div>}</div>)}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(f.status === 'open' || f.status === 'acknowledged') && <button onClick={() => handleDismiss(f.id)} style={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', color: 'var(--green)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={13} /> Mark as Mitigated</button>}
                {(f.status === 'open' || f.status === 'acknowledged') && !triageSuggestions[f.id] && (
                  <button className="btn ai-triage-single-btn" onClick={() => handleTriageSingle(f.id)} disabled={triagingSingle === f.id}>
                    {triagingSingle === f.id ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                    {triagingSingle === f.id ? 'Triaging…' : 'AI Triage'}
                  </button>
                )}
                <a href={"/vulnerability-reports?create=true&productId=" + productId + "&findingId=" + f.id} style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: 'var(--purple)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}><Shield size={13} /> Report to ENISA</a>
              </div>

              {/* AI Triage suggestion card */}
              {triageSuggestions[f.id] && (
                <div className="ai-triage-suggestion">
                  <div className="ai-triage-header">
                    <Sparkles size={14} />
                    <span className="ai-triage-title">AI Triage Suggestion</span>
                    <span className={`ai-triage-confidence ${triageSuggestions[f.id].confidence >= 0.85 ? 'high' : triageSuggestions[f.id].confidence >= 0.6 ? 'medium' : 'low'}`}>
                      {Math.round(triageSuggestions[f.id].confidence * 100)}% confidence
                    </span>
                    {triageSuggestions[f.id].automatable && <span className="ai-auto-badge">Auto</span>}
                    {triageSuggestions[f.id].autoApplied && <span className="ai-auto-badge applied">Applied</span>}
                  </div>
                  <div className="ai-triage-action-label">
                    Suggested: <strong>{triageSuggestions[f.id].suggestedAction === 'dismiss' ? 'Dismiss' : triageSuggestions[f.id].suggestedAction === 'acknowledge' ? 'Acknowledge' : 'Escalate & Mitigate'}</strong>
                  </div>
                  <div className="ai-triage-reasoning">{triageSuggestions[f.id].reasoning}</div>
                  {triageSuggestions[f.id].mitigationCommand && (
                    <div className="ai-triage-cmd">
                      <code>{triageSuggestions[f.id].mitigationCommand}</code>
                      <button
                        className="ai-triage-copy-btn"
                        title="Copy command"
                        onClick={() => {
                          navigator.clipboard.writeText(triageSuggestions[f.id].mitigationCommand);
                          setCopiedCmd(f.id);
                          setTimeout(() => setCopiedCmd(null), 2000);
                        }}
                      >
                        {copiedCmd === f.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}
                  {!triageSuggestions[f.id].autoApplied && (
                    <div className="ai-triage-actions">
                      <button className="ai-triage-accept" onClick={() => handleAcceptTriage(f.id, triageSuggestions[f.id])}>
                        <CheckCircle2 size={13} /> Accept
                      </button>
                      <button className="ai-triage-reject" onClick={() => handleRejectTriage(f.id)}>
                        <X size={13} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
