import { useState, useEffect, useCallback } from 'react';
import {
  Archive, Download, Trash2, Loader2, CheckCircle, XCircle,
  Clock, FileText, Shield, AlertTriangle, Package,
} from 'lucide-react';

interface Snapshot {
  id: string;
  filename: string;
  size_bytes: number | null;
  content_hash: string | null;
  status: 'generating' | 'complete' | 'failed';
  error_message: string | null;
  metadata: {
    techFile?: { sectionCount: number; completedCount: number };
    sbom?: { packageCount: number };
    vulns?: { total: number; open: number; critical: number; high: number };
    obligations?: { total: number; met: number; in_progress: number; not_started: number };
    activityCount?: number;
    generatedAt?: string;
  } | null;
  created_at: string;
  created_by_email: string | null;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ComplianceVaultTab({ productId }: { productId: string }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pollingId, setPollingId] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/compliance-snapshots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [productId, token]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Poll for generation status
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/products/${productId}/compliance-snapshots/${pollingId}/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'complete' || data.status === 'failed') {
            setPollingId(null);
            setGenerating(false);
            fetchSnapshots();
          }
        }
      } catch {
        /* retry on next interval */
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pollingId, productId, token, fetchSnapshots]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/products/${productId}/compliance-snapshots`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok || res.status === 202) {
        const data = await res.json();
        setPollingId(data.id);
        // Add a placeholder to the list
        setSnapshots(prev => [{
          id: data.id,
          filename: 'Generating...',
          size_bytes: null,
          content_hash: null,
          status: 'generating',
          error_message: null,
          metadata: null,
          created_at: new Date().toISOString(),
          created_by_email: null,
        }, ...prev]);
      } else {
        setError('Failed to generate snapshot');
        setGenerating(false);
      }
    } catch {
      setError('Failed to generate snapshot');
      setGenerating(false);
    }
  }

  async function handleDownload(snapshot: Snapshot) {
    const res = await fetch(
      `/api/products/${productId}/compliance-snapshots/${snapshot.id}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = snapshot.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleDelete(snapshot: Snapshot) {
    if (!confirm(`Delete snapshot ${snapshot.filename}?`)) return;
    setDeletingId(snapshot.id);
    try {
      const res = await fetch(
        `/api/products/${productId}/compliance-snapshots/${snapshot.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setSnapshots(prev => prev.filter(s => s.id !== snapshot.id));
      }
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle size={16} className="cv-status-complete" />;
      case 'failed': return <XCircle size={16} className="cv-status-failed" />;
      default: return <Loader2 size={16} className="spin cv-status-generating" />;
    }
  };

  if (loading) {
    return (
      <div className="cv-loading">
        <Loader2 size={24} className="spin" />
        <span>Loading compliance vault...</span>
      </div>
    );
  }

  return (
    <div className="cv-container">
      {/* Header */}
      <div className="cv-header">
        <div className="cv-header-text">
          <h3><Archive size={20} /> Compliance Vault</h3>
          <p className="cv-description">
            Generate self-contained compliance archives for audit readiness.
            Each snapshot includes your technical file, EU Declaration of Conformity,
            SBOMs, vulnerability evidence, obligation statuses, and a SHA-256 integrity manifest.
            All human-readable documents are in Markdown; machine-readable data in JSON.
          </p>
        </div>
        <button
          className="cv-generate-btn"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <Loader2 size={16} className="spin" /> : <Archive size={16} />}
          {generating ? 'Generating...' : 'Generate Snapshot'}
        </button>
      </div>

      {error && (
        <div className="cv-error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* CRA reference */}
      <div className="cv-cra-note">
        <FileText size={14} />
        <span>
          <strong>Art. 13(10):</strong> Technical documentation and the EU declaration of conformity
          shall be retained for at least 10 years after the product is placed on the market.
        </span>
      </div>

      {/* Snapshots list */}
      {snapshots.length === 0 ? (
        <div className="cv-empty">
          <Archive size={40} className="cv-empty-icon" />
          <h4>No snapshots yet</h4>
          <p>Generate your first compliance snapshot to create an audit-ready archive.</p>
        </div>
      ) : (
        <div className="cv-snapshots-list">
          {snapshots.map(snapshot => (
            <div key={snapshot.id} className={`cv-snapshot-card cv-snapshot-${snapshot.status}`}>
              <div className="cv-snapshot-header">
                <div className="cv-snapshot-status">
                  {statusIcon(snapshot.status)}
                  <span className="cv-snapshot-filename">
                    {snapshot.status === 'generating' ? 'Generating snapshot...' : snapshot.filename}
                  </span>
                </div>
                <div className="cv-snapshot-actions">
                  {snapshot.status === 'complete' && (
                    <button className="cv-action-btn cv-download-btn" onClick={() => handleDownload(snapshot)} title="Download">
                      <Download size={14} /> Download
                    </button>
                  )}
                  {snapshot.status !== 'generating' && (
                    <button
                      className="cv-action-btn cv-delete-btn"
                      onClick={() => handleDelete(snapshot)}
                      disabled={deletingId === snapshot.id}
                      title="Delete"
                    >
                      {deletingId === snapshot.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="cv-snapshot-meta">
                <span><Clock size={12} /> {formatDate(snapshot.created_at)}</span>
                {snapshot.size_bytes && <span>{formatBytes(snapshot.size_bytes)}</span>}
                {snapshot.created_by_email && <span>by {snapshot.created_by_email}</span>}
              </div>

              {snapshot.status === 'failed' && snapshot.error_message && (
                <div className="cv-snapshot-error">{snapshot.error_message}</div>
              )}

              {snapshot.status === 'complete' && snapshot.metadata && (
                <div className="cv-snapshot-summary">
                  <div className="cv-stat">
                    <FileText size={14} />
                    <span>Tech file: {snapshot.metadata.techFile?.completedCount || 0}/{snapshot.metadata.techFile?.sectionCount || 0} sections</span>
                  </div>
                  <div className="cv-stat">
                    <Package size={14} />
                    <span>SBOM: {snapshot.metadata.sbom?.packageCount || 0} components</span>
                  </div>
                  <div className="cv-stat">
                    <AlertTriangle size={14} />
                    <span>Vulnerabilities: {snapshot.metadata.vulns?.total || 0} ({snapshot.metadata.vulns?.open || 0} open)</span>
                  </div>
                  <div className="cv-stat">
                    <Shield size={14} />
                    <span>Obligations: {snapshot.metadata.obligations?.met || 0}/{snapshot.metadata.obligations?.total || 0} met</span>
                  </div>
                </div>
              )}

              {snapshot.content_hash && (
                <div className="cv-snapshot-hash">
                  SHA-256: <code>{snapshot.content_hash}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
