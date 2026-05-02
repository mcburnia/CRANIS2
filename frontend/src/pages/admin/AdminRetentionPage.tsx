/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Archive, Shield, AlertTriangle, DollarSign, Lock, Unlock,
  Loader2, Building2, Package, TrendingUp, CreditCard, CheckCircle,
  Banknote, CheckSquare, Square,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import HelpTip from '../../components/HelpTip';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminRetentionPage.css';

interface RetentionSummary {
  totalEntries: number;
  allocatedCount: number;
  fundedCount: number;
  releasedCount: number;
  totalEstimatedCost: number;
  totalFundedAmount: number;
  outstandingAmount: number;
  transferredAmount: number;
  totalArchiveBytes: number;
  orgCount: number;
  productCount: number;
}

interface LedgerEntry {
  id: string;
  org_id: string;
  product_id: string;
  snapshot_id: string;
  archive_hash: string;
  archive_size_bytes: string;
  estimated_cost_eur: string;
  funded_amount_eur: string;
  costing_model_version: string;
  retention_start_date: string;
  retention_end_date: string;
  wise_transaction_ref: string | null;
  certificate_hash: string | null;
  status: 'allocated' | 'funded' | 'released';
  notes: string | null;
  snapshot_filename: string | null;
  cold_storage_status: string | null;
  created_at: string;
}

interface ExpiryWarning {
  id: string;
  product_id: string;
  org_id: string;
  filename: string;
  retention_end_date: string;
  legal_hold: boolean;
  days_until_expiry: number;
}

interface SnapshotRow {
  id: string;
  product_id: string;
  org_id: string;
  filename: string;
  size_bytes: number | null;
  status: string;
  retention_end_date: string | null;
  legal_hold: boolean;
  cold_storage_status: string | null;
  trigger_type: string | null;
  created_at: string;
  estimated_cost_eur: string | null;
  funded_amount_eur: string | null;
  wise_transaction_ref: string | null;
  ledger_status: string | null;
}

interface CostForecast {
  quarter: string;
  activeEntries: number;
  totalBytes: number;
  estimatedCostEur: number;
}

type TabId = 'overview' | 'ledger' | 'funding' | 'snapshots' | 'forecast';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export default function AdminRetentionPage() {
  usePageMeta();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RetentionSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [warnings, setWarnings] = useState<ExpiryWarning[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [forecast, setForecast] = useState<CostForecast[]>([]);
  const [wiseModal, setWiseModal] = useState<string | null>(null);
  const [wiseRef, setWiseRef] = useState('');
  const [wiseSaving, setWiseSaving] = useState(false);
  const [holdSaving, setHoldSaving] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkRef, setBulkRef] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const token = localStorage.getItem('session_token');

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, ledgerRes, warningsRes, snapshotsRes, forecastRes] = await Promise.all([
        fetch('/api/admin/retention-ledger/summary', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/retention-ledger', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/retention-ledger/expiry-warnings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/retention-ledger/snapshots', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/retention-ledger/cost-forecast', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (ledgerRes.ok) { const d = await ledgerRes.json(); setLedger(d.entries); }
      if (warningsRes.ok) { const d = await warningsRes.json(); setWarnings(d.warnings); }
      if (snapshotsRes.ok) { const d = await snapshotsRes.json(); setSnapshots(d.snapshots); }
      if (forecastRes.ok) { const d = await forecastRes.json(); setForecast(d.forecast); }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleWiseSave(entryId: string) {
    if (!wiseRef.trim()) return;
    setWiseSaving(true);
    try {
      const res = await fetch(`/api/admin/retention-ledger/${entryId}/wise-ref`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ wise_transaction_ref: wiseRef }),
      });
      if (res.ok) {
        setWiseModal(null);
        setWiseRef('');
        fetchData();
      }
    } catch {
      /* silent */
    } finally {
      setWiseSaving(false);
    }
  }

  async function handleToggleLegalHold(snapshotId: string, currentHold: boolean) {
    setHoldSaving(snapshotId);
    try {
      const res = await fetch(`/api/admin/retention-ledger/${snapshotId}/legal-hold`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ legal_hold: !currentHold }),
      });
      if (res.ok) fetchData();
    } catch {
      /* silent */
    } finally {
      setHoldSaving(null);
    }
  }

  const allocatedEntries = ledger.filter(e => e.status === 'allocated');

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === allocatedEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allocatedEntries.map(e => e.id)));
    }
  }

  async function handleBulkFund() {
    if (!bulkRef.trim() || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch('/api/admin/retention-ledger/bulk-fund', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_ids: Array.from(selectedIds), wise_transaction_ref: bulkRef }),
      });
      if (res.ok) {
        setBulkModal(false);
        setBulkRef('');
        setSelectedIds(new Set());
        fetchData();
      }
    } catch {
      /* silent */
    } finally {
      setBulkSaving(false);
    }
  }

  const selectedTotal = allocatedEntries
    .filter(e => selectedIds.has(e.id))
    .reduce((sum, e) => sum + parseFloat(e.funded_amount_eur), 0);

  if (loading) {
    return (
      <div className="aretention-loading">
        <Loader2 size={32} className="spin" />
        <span>Loading retention data...</span>
      </div>
    );
  }

  const STATUS_BADGE: Record<string, string> = {
    allocated: 'aretention-badge-amber',
    funded: 'aretention-badge-green',
    released: 'aretention-badge-muted',
  };

  return (
    <div className="aretention-page">
      <PageHeader title="Retention Dashboard" />

      {/* Summary cards */}
      {summary && (
        <div className="stat-grid">
          <StatCard label="Total Snapshots" value={summary.totalEntries} color="blue" sub={`${summary.orgCount} orgs · ${summary.productCount} products`} />
          <StatCard label="Allocated" value={formatEur(summary.outstandingAmount)} color="amber" sub={`${summary.allocatedCount} entries awaiting transfer`} />
          <StatCard label="Funded" value={formatEur(summary.transferredAmount)} color="green" sub={`${summary.fundedCount} entries transferred via Wise`} />
          <StatCard label="Total Archive Size" value={formatBytes(summary.totalArchiveBytes)} color="blue" sub={`Est. cost: ${formatEur(summary.totalEstimatedCost)}`} />
        </div>
      )}

      {/* Guidance note */}
      <div className="aretention-guidance">
        <HelpTip text="Allocated = reserved but not yet transferred. Funded = Wise transfer recorded. Released = retention period ended." size={14} />
        <span>Hover over column headers for explanations of each field.</span>
      </div>

      {/* Expiry warnings banner */}
      {warnings.length > 0 && (
        <div className="aretention-warning-banner">
          <AlertTriangle size={16} />
          <span>
            <strong>{warnings.length} snapshot{warnings.length > 1 ? 's' : ''}</strong> approaching retention end date (within 90 days).
            {' '}Earliest: <strong>{warnings[0]?.filename}</strong> expires {formatDate(warnings[0]?.retention_end_date)}.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="aretention-tabs">
        {([
          { id: 'overview' as TabId, label: 'Overview', icon: Archive },
          { id: 'ledger' as TabId, label: 'Reserve Ledger', icon: DollarSign },
          { id: 'funding' as TabId, label: 'Funding Run', icon: Banknote },
          { id: 'snapshots' as TabId, label: 'Snapshots & Holds', icon: Shield },
          { id: 'forecast' as TabId, label: 'Cost Forecast', icon: TrendingUp },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`aretention-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="aretention-section">
          <h3>Retention Reserve Overview</h3>
          <p className="aretention-description">
            CRA Art. 13(10) requires technical documentation to be retained for at least 10 years.
            CRANIS2 calculates retention costs upfront and reserves funds via quarterly Wise transfers
            to a Scaleway Glacier cold storage account.
          </p>

          <div className="aretention-overview-grid">
            <div className="aretention-overview-card">
              <h4><Building2 size={16} /> Organisations</h4>
              <div className="aretention-overview-value">{summary?.orgCount || 0}</div>
              <div className="aretention-overview-sub">With active retention entries</div>
            </div>
            <div className="aretention-overview-card">
              <h4><Package size={16} /> Products</h4>
              <div className="aretention-overview-value">{summary?.productCount || 0}</div>
              <div className="aretention-overview-sub">Under retention</div>
            </div>
            <div className="aretention-overview-card">
              <h4><Archive size={16} /> Snapshots</h4>
              <div className="aretention-overview-value">{summary?.totalEntries || 0}</div>
              <div className="aretention-overview-sub">In retention reserve</div>
            </div>
            <div className="aretention-overview-card">
              <h4><CreditCard size={16} /> Total Funded</h4>
              <div className="aretention-overview-value">{formatEur(summary?.totalFundedAmount || 0)}</div>
              <div className="aretention-overview-sub">Via Wise transfers</div>
            </div>
          </div>

          {/* Expiry warnings list */}
          {warnings.length > 0 && (
            <>
              <h3 style={{ marginTop: '1.5rem' }}><AlertTriangle size={16} /> Approaching Retention End</h3>
              <div className="aretention-table-wrap">
                <table className="aretention-table">
                  <thead>
                    <tr>
                      <th>Snapshot</th>
                      <th>Product</th>
                      <th>Retention End</th>
                      <th>Days Left</th>
                      <th>Legal Hold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warnings.map(w => (
                      <tr key={w.id} className={w.days_until_expiry <= 30 ? 'aretention-row-urgent' : ''}>
                        <td className="aretention-mono">{w.filename}</td>
                        <td className="aretention-mono">{w.product_id.slice(0, 8)}...</td>
                        <td>{formatDate(w.retention_end_date)}</td>
                        <td>
                          <span className={`aretention-days ${w.days_until_expiry <= 30 ? 'aretention-days-urgent' : ''}`}>
                            {w.days_until_expiry}d
                          </span>
                        </td>
                        <td>{w.legal_hold ? <Lock size={14} /> : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="aretention-section">
          <h3>Reserve Ledger</h3>
          <p className="aretention-description">
            Each compliance snapshot creates a ledger entry with the estimated cold storage cost
            for the full retention period. Record Wise transaction references when quarterly
            transfers are completed.
          </p>
          <div className="aretention-table-wrap">
            <table className="aretention-table">
              <thead>
                <tr>
                  <th>Snapshot</th>
                  <th>Size</th>
                  <th>Estimated <HelpTip text="Projected cold storage cost for the full retention period, calculated at snapshot creation using Scaleway Glacier rates with a 2x buffer." /></th>
                  <th>Funded <HelpTip text="Amount reserved for this snapshot's retention. Matches the estimated cost at time of creation." /></th>
                  <th>Retention <HelpTip text="Start and end dates for the CRA Art. 13(10) retention period. Typically 10 years from market placement, or until end-of-support if later." /></th>
                  <th>Status <HelpTip text="Allocated = funds reserved but not yet transferred. Funded = Wise transfer completed. Released = retention period ended." /></th>
                  <th>Wise Ref <HelpTip text="Transaction reference from the quarterly Wise transfer that funded this retention entry." /></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={8} className="aretention-empty">No ledger entries yet</td></tr>
                ) : ledger.map(entry => (
                  <tr key={entry.id}>
                    <td className="aretention-mono">{entry.snapshot_filename || entry.snapshot_id.slice(0, 8)}</td>
                    <td>{formatBytes(parseInt(entry.archive_size_bytes))}</td>
                    <td>{formatEur(parseFloat(entry.estimated_cost_eur))}</td>
                    <td>{formatEur(parseFloat(entry.funded_amount_eur))}</td>
                    <td>
                      {entry.retention_start_date && entry.retention_end_date
                        ? `${formatDate(entry.retention_start_date)} – ${formatDate(entry.retention_end_date)}`
                        : '–'}
                    </td>
                    <td>
                      <span className={`aretention-badge ${STATUS_BADGE[entry.status] || ''}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="aretention-mono">{entry.wise_transaction_ref || '–'}</td>
                    <td>
                      {entry.status === 'allocated' && (
                        <button
                          className="aretention-btn-sm"
                          onClick={() => { setWiseModal(entry.id); setWiseRef(''); }}
                        >
                          Record Transfer
                        </button>
                      )}
                      {entry.status === 'funded' && (
                        <span className="aretention-funded-check"><CheckCircle size={14} /></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'funding' && (
        <div className="aretention-section">
          <h3><Banknote size={16} /> Funding Run</h3>
          <p className="aretention-description">
            Select allocated entries to mark as funded after completing a Wise transfer.
            Use "Select All" to fund everything in one go, or pick individual entries.
          </p>

          {allocatedEntries.length === 0 ? (
            <div className="aretention-funding-empty">
              <CheckCircle size={32} />
              <p>All entries are funded. Nothing to transfer.</p>
            </div>
          ) : (
            <>
              <div className="aretention-funding-toolbar">
                <button className="aretention-btn-sm" onClick={toggleSelectAll}>
                  {selectedIds.size === allocatedEntries.length ? <CheckSquare size={14} /> : <Square size={14} />}
                  {selectedIds.size === allocatedEntries.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="aretention-funding-count">
                  {selectedIds.size} of {allocatedEntries.length} selected
                  {selectedIds.size > 0 && <> · <strong>{formatEur(selectedTotal)}</strong> to transfer</>}
                </span>
              </div>

              <div className="aretention-table-wrap">
                <table className="aretention-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Snapshot</th>
                      <th>Product</th>
                      <th>Size</th>
                      <th>Amount <HelpTip text="The funded amount for this snapshot's full retention period." /></th>
                      <th>Retention <HelpTip text="Start and end dates for the 10-year CRA retention period." /></th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocatedEntries.map(entry => (
                      <tr
                        key={entry.id}
                        className={selectedIds.has(entry.id) ? 'aretention-row-selected' : ''}
                        onClick={() => toggleSelected(entry.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          {selectedIds.has(entry.id)
                            ? <CheckSquare size={16} className="aretention-check-active" />
                            : <Square size={16} className="aretention-check-idle" />}
                        </td>
                        <td className="aretention-mono">{entry.snapshot_filename || entry.snapshot_id.slice(0, 8)}</td>
                        <td className="aretention-mono">{entry.product_id.slice(0, 12)}...</td>
                        <td>{formatBytes(parseInt(entry.archive_size_bytes))}</td>
                        <td><strong>{formatEur(parseFloat(entry.funded_amount_eur))}</strong></td>
                        <td>
                          {entry.retention_start_date && entry.retention_end_date
                            ? `${formatDate(entry.retention_start_date)} – ${formatDate(entry.retention_end_date)}`
                            : '–'}
                        </td>
                        <td>{formatDate(entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sticky action bar */}
              {selectedIds.size > 0 && (
                <div className="aretention-funding-bar">
                  <span>
                    <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'entry' : 'entries'} selected
                    · Total: <strong>{formatEur(selectedTotal)}</strong>
                  </span>
                  <button
                    className="aretention-btn-primary"
                    onClick={() => { setBulkModal(true); setBulkRef(''); }}
                  >
                    <CreditCard size={14} /> Record Transfer
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'snapshots' && (
        <div className="aretention-section">
          <h3>Snapshots &amp; Legal Holds</h3>
          <p className="aretention-description">
            Manage legal holds on compliance snapshots. A snapshot under legal hold cannot be
            deleted, regardless of retention end date.
          </p>
          <div className="aretention-table-wrap">
            <table className="aretention-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Trigger <HelpTip text="How the snapshot was created: manual (user-initiated), scheduled (automated), or lifecycle_on_market (auto-triggered when a product is placed on the market)." /></th>
                  <th>Retention End <HelpTip text="When the CRA Art. 13(10) retention period expires. Empty if the product has no market placement date set." /></th>
                  <th>Cold Storage <HelpTip text="Whether the snapshot archive has been uploaded to Scaleway Glacier for long-term preservation. Local copies expire after 24 hours." /></th>
                  <th>Legal Hold <HelpTip text="A legal hold prevents deletion of this snapshot regardless of retention status. Use for regulatory investigations, audits, or litigation preservation." /></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.length === 0 ? (
                  <tr><td colSpan={7} className="aretention-empty">No snapshots</td></tr>
                ) : snapshots.map(s => (
                  <tr key={s.id} className={s.legal_hold ? 'aretention-row-hold' : ''}>
                    <td className="aretention-mono">{s.filename}</td>
                    <td>{s.size_bytes ? formatBytes(s.size_bytes) : '–'}</td>
                    <td><span className="aretention-badge aretention-badge-blue">{s.trigger_type || 'manual'}</span></td>
                    <td>{s.retention_end_date ? formatDate(s.retention_end_date) : '–'}</td>
                    <td>
                      <span className={`aretention-badge ${s.cold_storage_status === 'archived' ? 'aretention-badge-green' : 'aretention-badge-amber'}`}>
                        {s.cold_storage_status || 'pending'}
                      </span>
                    </td>
                    <td>
                      {s.legal_hold ? (
                        <span className="aretention-hold-active"><Lock size={14} /> Active</span>
                      ) : '–'}
                    </td>
                    <td>
                      <button
                        className={`aretention-btn-sm ${s.legal_hold ? 'aretention-btn-danger' : ''}`}
                        onClick={() => handleToggleLegalHold(s.id, s.legal_hold)}
                        disabled={holdSaving === s.id}
                      >
                        {holdSaving === s.id ? (
                          <Loader2 size={14} className="spin" />
                        ) : s.legal_hold ? (
                          <><Unlock size={14} /> Release</>
                        ) : (
                          <><Lock size={14} /> Hold</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="aretention-section">
          <h3>Cost Forecast</h3>
          <p className="aretention-description">
            Projected quarterly cold storage costs based on current archive sizes and retention
            periods. Uses Scaleway Glacier rate (€0.00254/GB/month) with 2x buffer.
          </p>
          <div className="aretention-table-wrap">
            <table className="aretention-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Active Entries <HelpTip text="Number of ledger entries with retention periods that overlap this quarter." /></th>
                  <th>Total Storage <HelpTip text="Combined size of all archives under active retention during this quarter." /></th>
                  <th>Estimated Cost <HelpTip text="Projected quarterly cost using Scaleway Glacier rate (€0.00254/GB/month) with a 2x buffer for price changes and operational overhead." /></th>
                </tr>
              </thead>
              <tbody>
                {forecast.map(q => (
                  <tr key={q.quarter}>
                    <td><strong>{q.quarter}</strong></td>
                    <td>{q.activeEntries}</td>
                    <td>{q.totalBytes > 0 ? formatBytes(q.totalBytes) : '–'}</td>
                    <td>{formatEur(q.estimatedCostEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wise transaction ref modal */}
      {wiseModal && (
        <div className="aretention-modal-overlay" onClick={() => setWiseModal(null)}>
          <div className="aretention-modal" onClick={e => e.stopPropagation()}>
            <h3>Record Wise Transfer</h3>
            <p>Enter the Wise transaction reference for this quarterly retention reserve transfer.</p>
            <input
              className="aretention-input"
              type="text"
              placeholder="e.g. TRANSFER-12345678"
              value={wiseRef}
              onChange={e => setWiseRef(e.target.value)}
              autoFocus
            />
            <div className="aretention-modal-actions">
              <button className="aretention-btn-cancel" onClick={() => setWiseModal(null)}>Cancel</button>
              <button
                className="aretention-btn-primary"
                onClick={() => handleWiseSave(wiseModal)}
                disabled={!wiseRef.trim() || wiseSaving}
              >
                {wiseSaving ? <Loader2 size={14} className="spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk fund modal */}
      {bulkModal && (
        <div className="aretention-modal-overlay" onClick={() => setBulkModal(false)}>
          <div className="aretention-modal" onClick={e => e.stopPropagation()}>
            <h3>Record Bulk Transfer</h3>
            <p>
              Enter the Wise transaction reference for this transfer.
              This will mark <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'entry' : 'entries'} as
              funded, totalling <strong>{formatEur(selectedTotal)}</strong>.
            </p>
            <input
              className="aretention-input"
              type="text"
              placeholder="e.g. TRANSFER-12345678"
              value={bulkRef}
              onChange={e => setBulkRef(e.target.value)}
              autoFocus
            />
            <div className="aretention-modal-actions">
              <button className="aretention-btn-cancel" onClick={() => setBulkModal(false)}>Cancel</button>
              <button
                className="aretention-btn-primary"
                onClick={handleBulkFund}
                disabled={!bulkRef.trim() || bulkSaving}
              >
                {bulkSaving ? <Loader2 size={14} className="spin" /> : <><CheckCircle size={14} /> Confirm</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
