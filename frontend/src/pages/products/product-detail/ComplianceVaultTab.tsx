import { useState, useEffect, useCallback } from 'react';
import {
  Archive, Download, Trash2, Loader2, CheckCircle, XCircle,
  Clock, FileText, Shield, ShieldCheck, AlertTriangle, Package, CloudOff, Cloud, Stamp, Zap, Lock,
  CalendarClock, ToggleLeft, ToggleRight,
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
  cold_storage_status: 'pending' | 'archived' | 'failed' | null;
  cold_storage_uploaded_at: string | null;
  rfc3161_timestamped: boolean;
  rfc3161_timestamp: string | null;
  cranis2_signed: boolean;
  signature_algorithm: string | null;
  signature_key_id: string | null;
  retention_end_date: string | null;
  legal_hold: boolean;
  retention_active: boolean;
  trigger_type: string | null;
  release_version: string | null;
  created_at: string;
  created_by_email: string | null;
}

interface SnapshotSchedule {
  id: string;
  schedule_type: 'quarterly' | 'monthly' | 'weekly';
  enabled: boolean;
  next_run_date: string | null;
  last_run_at: string | null;
  last_snapshot_id: string | null;
  created_at: string;
  updated_at: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '–';
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

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function isLocalFileExpired(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created > 24 * 60 * 60 * 1000;
}

function calculateRetentionEndDate(marketPlacementDate: string | null, supportEndDate: string | null): string | null {
  if (!marketPlacementDate) return null;
  const tenYears = new Date(marketPlacementDate);
  tenYears.setFullYear(tenYears.getFullYear() + 10);
  if (supportEndDate) {
    const supportEnd = new Date(supportEndDate);
    return supportEnd > tenYears ? supportEnd.toISOString().split('T')[0] : tenYears.toISOString().split('T')[0];
  }
  return tenYears.toISOString().split('T')[0];
}

function formatRetentionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

interface ComplianceVaultProps {
  productId: string;
  marketPlacementDate?: string | null;
  supportEndDate?: string | null;
  lifecycleStatus?: string;
}

export default function ComplianceVaultTab({ productId, marketPlacementDate, supportEndDate, lifecycleStatus }: ComplianceVaultProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pollingId, setPollingId] = useState<string | null>(null);

  // Schedule state
  const [schedule, setSchedule] = useState<SnapshotSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleType, setScheduleType] = useState<string>('quarterly');

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

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/snapshot-schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
        if (data.schedule) {
          setScheduleType(data.schedule.schedule_type);
        }
      }
    } catch {
      /* silent */
    } finally {
      setScheduleLoading(false);
    }
  }, [productId, token]);

  useEffect(() => {
    fetchSnapshots();
    fetchSchedule();
  }, [fetchSnapshots, fetchSchedule]);

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
        setSnapshots(prev => [{
          id: data.id,
          filename: 'Generating...',
          size_bytes: null,
          content_hash: null,
          status: 'generating',
          error_message: null,
          metadata: null,
          cold_storage_status: null,
          cold_storage_uploaded_at: null,
          rfc3161_timestamped: false,
          rfc3161_timestamp: null,
          cranis2_signed: false,
          signature_algorithm: null,
          signature_key_id: null,
          retention_end_date: null,
          legal_hold: false,
          retention_active: false,
          trigger_type: null,
          release_version: null,
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
    } else if (res.status === 410) {
      setError('This snapshot has expired locally. Generate a new snapshot if needed.');
      fetchSnapshots();
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
      } else if (res.status === 409) {
        const data = await res.json();
        setError(data.message || 'Cannot delete. Retention period active or legal hold in place.');
      }
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }

  async function handleScheduleToggle() {
    setScheduleSaving(true);
    try {
      if (schedule?.enabled) {
        // Disable
        const res = await fetch(`/api/products/${productId}/snapshot-schedule`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule_type: schedule.schedule_type, enabled: false }),
        });
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule);
        }
      } else {
        // Enable with selected type
        const res = await fetch(`/api/products/${productId}/snapshot-schedule`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule_type: scheduleType, enabled: true }),
        });
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule);
        }
      }
    } catch {
      /* silent */
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleScheduleTypeChange(newType: string) {
    setScheduleType(newType);
    if (!schedule?.enabled) return; // Only save if currently enabled
    setScheduleSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}/snapshot-schedule`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_type: newType, enabled: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSchedule(data.schedule);
      }
    } catch {
      /* silent */
    } finally {
      setScheduleSaving(false);
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle size={16} className="cv-status-complete" />;
      case 'failed': return <XCircle size={16} className="cv-status-failed" />;
      default: return <Loader2 size={16} className="spin cv-status-generating" />;
    }
  };

  const localExpired = (snapshot: Snapshot) =>
    snapshot.status === 'complete' && isLocalFileExpired(snapshot.created_at);

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
            Downloads are available for 24 hours. Archives are automatically preserved in cold storage.
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
          Archives are automatically preserved in cold storage for long-term audit retention.
        </span>
      </div>

      {/* Retention period info */}
      {(() => {
        const retentionEnd = calculateRetentionEndDate(marketPlacementDate || null, supportEndDate || null);
        if (retentionEnd) {
          const remaining = daysUntil(retentionEnd);
          const years = Math.floor(remaining / 365);
          const months = Math.floor((remaining % 365) / 30);
          return (
            <div className="cv-retention-info">
              <Shield size={14} />
              <span>
                <strong>Retention period:</strong> Until {formatRetentionDate(retentionEnd)}
                {remaining > 0 ? ` (${years > 0 ? `${years}y ` : ''}${months}m remaining)` : ' (expired)'}
                {marketPlacementDate && <> · Market placement: {formatRetentionDate(marketPlacementDate)}</>}
              </span>
            </div>
          );
        }
        if (lifecycleStatus === 'pre_production') {
          return (
            <div className="cv-retention-info cv-retention-pending">
              <Clock size={14} />
              <span>
                Retention period will begin when the product is placed on the market.
                The market placement date is set automatically when you change the lifecycle stage to "On market".
              </span>
            </div>
          );
        }
        return null;
      })()}

      {/* Automated scheduling */}
      {!scheduleLoading && (
        <div className="cv-schedule-section">
          <div className="cv-schedule-header">
            <div className="cv-schedule-title">
              <CalendarClock size={14} />
              <strong>Automated Snapshots</strong>
            </div>
            <div className="cv-schedule-controls">
              <select
                className="cv-schedule-select"
                value={scheduleType}
                onChange={(e) => handleScheduleTypeChange(e.target.value)}
                disabled={scheduleSaving}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
              <button
                className={`cv-schedule-toggle ${schedule?.enabled ? 'cv-schedule-active' : ''}`}
                onClick={handleScheduleToggle}
                disabled={scheduleSaving}
                title={schedule?.enabled ? 'Disable automated snapshots' : 'Enable automated snapshots'}
              >
                {scheduleSaving ? (
                  <Loader2 size={16} className="spin" />
                ) : schedule?.enabled ? (
                  <><ToggleRight size={16} /> Enabled</>
                ) : (
                  <><ToggleLeft size={16} /> Disabled</>
                )}
              </button>
            </div>
          </div>
          {schedule?.enabled && schedule.next_run_date && (
            <div className="cv-schedule-info">
              Next snapshot: <strong>{formatShortDate(schedule.next_run_date)}</strong>
              {schedule.last_run_at && <> · Last run: {formatDate(schedule.last_run_at)}</>}
            </div>
          )}
        </div>
      )}

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
                  {snapshot.status === 'complete' && !localExpired(snapshot) && (
                    <button className="cv-action-btn cv-download-btn" onClick={() => handleDownload(snapshot)} title="Download">
                      <Download size={14} /> Download
                    </button>
                  )}
                  {snapshot.status === 'complete' && localExpired(snapshot) && (
                    <span className="cv-expired-badge" title="Local file has expired after 24 hours. Generate a new snapshot if needed.">
                      <CloudOff size={12} /> Download expired
                    </span>
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
                {snapshot.cold_storage_status === 'archived' && (
                  <span className="cv-cold-badge">
                    <Cloud size={12} /> Archived
                  </span>
                )}
                {snapshot.cold_storage_status === 'pending' && snapshot.status === 'complete' && (
                  <span className="cv-cold-badge cv-cold-pending">
                    <Cloud size={12} /> Archiving...
                  </span>
                )}
                {snapshot.rfc3161_timestamped && (
                  <span className="cv-cold-badge cv-rfc3161-badge">
                    <Stamp size={12} /> RFC 3161
                  </span>
                )}
                {snapshot.cranis2_signed && (
                  <span className="cv-cold-badge cv-signed-badge" title={`Signed with ${snapshot.signature_algorithm || 'Ed25519'} (key: ${snapshot.signature_key_id || '–'})`}>
                    <ShieldCheck size={12} /> Signed
                  </span>
                )}
                {(snapshot.retention_active || snapshot.legal_hold) && (
                  <span className="cv-cold-badge cv-retention-lock-badge" title={
                    snapshot.legal_hold
                      ? 'Under legal hold. Deletion blocked'
                      : `Retention until ${snapshot.retention_end_date}. Deletion blocked`
                  }>
                    <Lock size={12} /> {snapshot.legal_hold ? 'Legal hold' : 'Retention lock'}
                  </span>
                )}
                {snapshot.trigger_type === 'lifecycle_on_market' && (
                  <span className="cv-cold-badge cv-trigger-badge">
                    <Zap size={12} /> Market release
                  </span>
                )}
                {snapshot.trigger_type === 'scheduled' && (
                  <span className="cv-cold-badge cv-trigger-badge">
                    <CalendarClock size={12} /> Scheduled
                  </span>
                )}
                {snapshot.release_version && (
                  <span className="cv-cold-badge">v{snapshot.release_version}</span>
                )}
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
