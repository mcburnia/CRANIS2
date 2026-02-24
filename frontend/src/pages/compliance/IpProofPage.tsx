import { useState, useEffect } from 'react';
import { Fingerprint, ShieldCheck, Download, ChevronDown, ChevronRight, CheckCircle2, XCircle, Hash } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './IpProofPage.css';

interface ProductSummary {
  productId: string;
  productName: string;
  totalSnapshots: number;
  latestSnapshot: string | null;
  hasRfc3161: boolean;
  otsConfirmed: boolean;
  verifiedCount: number;
}

interface Totals {
  totalSnapshots: number;
  latestProof: string | null;
  productsProtected: number;
  totalRfc3161: number;
  totalOtsConfirmed: number;
  totalVerified: number;
}

interface Snapshot {
  id: string;
  snapshot_type: string;
  content_hash: string;
  content_summary: { packageCount: number; version: string | null; depCount: number; hashCount: number };
  rfc3161_tsa_url: string | null;
  has_rfc3161: boolean;
  ots_bitcoin_block: number | null;
  ots_confirmed_at: string | null;
  verified: boolean;
  created_at: string;
  created_by: string | null;
  createdByEmail: string | null;
}

const getToken = () => localStorage.getItem('session_token');

export default function IpProofPage() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  async function fetchOverview() {
    try {
      const res = await fetch('/api/ip-proof/overview', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTotals(data.totals);
      setProducts(data.products);
    } catch (err) {
      console.error('Failed to fetch IP proof overview:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSnapshots(productId: string) {
    setSnapshotsLoading(true);
    try {
      const res = await fetch(`/api/ip-proof/${productId}/snapshots`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setSnapshots(data.snapshots);
    } catch (err) {
      console.error('Failed to fetch snapshots:', err);
    } finally {
      setSnapshotsLoading(false);
    }
  }

  async function createNewSnapshot(productId: string) {
    setCreatingSnapshot(productId);
    try {
      const res = await fetch(`/api/ip-proof/${productId}/snapshot`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snapshotType: 'manual' }),
      });
      if (!res.ok) throw new Error('Failed to create snapshot');
      await fetchOverview();
      if (expandedProduct === productId) {
        await fetchSnapshots(productId);
      }
    } catch (err) {
      console.error('Failed to create snapshot:', err);
    } finally {
      setCreatingSnapshot(null);
    }
  }

  async function verifySnapshotAction(snapshotId: string) {
    setVerifying(snapshotId);
    try {
      const res = await fetch(`/api/ip-proof/snapshot/${snapshotId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to verify');
      if (expandedProduct) await fetchSnapshots(expandedProduct);
    } catch (err) {
      console.error('Failed to verify snapshot:', err);
    } finally {
      setVerifying(null);
    }
  }

  function downloadProof(snapshotId: string) {
    const link = document.createElement('a');
    link.href = `/api/ip-proof/snapshot/${snapshotId}/export`;
    link.setAttribute('download', '');
    // Need auth header - use fetch instead
    fetch(`/api/ip-proof/snapshot/${snapshotId}/export`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(res => res.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ip-proof-${snapshotId.substring(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(err => console.error('Failed to download proof:', err));
  }

  function toggleProduct(productId: string) {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      setSnapshots([]);
    } else {
      setExpandedProduct(productId);
      fetchSnapshots(productId);
    }
  }

  function formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function typeBadge(type: string) {
    const map: Record<string, { label: string; className: string }> = {
      manual: { label: 'Manual', className: 'ipp-type ipp-type-manual' },
      sync: { label: 'Auto (Sync)', className: 'ipp-type ipp-type-sync' },
      release: { label: 'Release', className: 'ipp-type ipp-type-release' },
    };
    const info = map[type] || { label: type, className: 'ipp-type' };
    return <span className={info.className}>{info.label}</span>;
  }

  if (loading) return <div className="ipp-page"><div className="ipp-loading">Loading IP proof data...</div></div>;

  return (
    <div className="ipp-page">
      <PageHeader title="IP Proof" />

      <div className="ipp-info-banner">
        <Fingerprint size={18} />
        <div>
          <strong>Ownership Timestamping</strong> — Creates cryptographically signed, legally recognised (EU eIDAS) proof that your software composition existed at a specific point in time. Each snapshot captures your full SBOM and gets timestamped by a trusted third-party authority (FreeTSA.org). Use this to prove prior art in IP disputes.
        </div>
      </div>

      {totals && (
        <div className="stats">
          <StatCard label="Total Snapshots" value={totals.totalSnapshots} color="blue" />
          <StatCard label="Latest Proof" value={totals.latestProof ? formatDate(totals.latestProof) : 'None'} color="green" />
          <StatCard label="Products Protected" value={totals.productsProtected} color="green" sub={`of ${products.length} total`} />
          <StatCard label="RFC 3161 Signed" value={totals.totalRfc3161} color="blue" sub={totals.totalVerified > 0 ? `${totals.totalVerified} verified` : 'Not yet verified'} />
        </div>
      )}

      <div className="ipp-products">
        <h3>Products</h3>
        {products.length === 0 ? (
          <div className="ipp-empty">No products found. Add a product to start creating IP proof snapshots.</div>
        ) : (
          <table className="ipp-table">
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Snapshots</th>
                <th>Latest</th>
                <th>RFC 3161</th>
                <th>Bitcoin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <>{/* Fragment for product row + expansion */}
                  <tr key={p.productId} className={`ipp-product-row ${expandedProduct === p.productId ? 'ipp-expanded' : ''}`} onClick={() => toggleProduct(p.productId)}>
                    <td className="ipp-expand-icon">
                      {expandedProduct === p.productId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="ipp-product-name">{p.productName}</td>
                    <td>{p.totalSnapshots || '—'}</td>
                    <td className="ipp-cell-muted">{formatDate(p.latestSnapshot)}</td>
                    <td>{p.hasRfc3161 ? <CheckCircle2 size={16} className="ipp-icon-green" /> : <XCircle size={16} className="ipp-icon-muted" />}</td>
                    <td>{p.otsConfirmed ? <CheckCircle2 size={16} className="ipp-icon-green" /> : <span className="ipp-cell-muted">—</span>}</td>
                    <td>
                      <button
                        className="ipp-create-btn"
                        onClick={(e) => { e.stopPropagation(); createNewSnapshot(p.productId); }}
                        disabled={creatingSnapshot === p.productId}
                      >
                        <Fingerprint size={14} />
                        {creatingSnapshot === p.productId ? 'Creating...' : 'Timestamp'}
                      </button>
                    </td>
                  </tr>
                  {expandedProduct === p.productId && (
                    <tr key={`${p.productId}-detail`}>
                      <td colSpan={7} className="ipp-snapshots-cell">
                        <div className="ipp-snapshots-panel">
                          <h4>Proof History — {p.productName}</h4>

                          {snapshotsLoading ? (
                            <div className="ipp-loading">Loading snapshots...</div>
                          ) : snapshots.length === 0 ? (
                            <div className="ipp-empty">No snapshots yet. Click "Timestamp" to create your first proof.</div>
                          ) : (
                            <div className="ipp-snapshot-list">
                              {snapshots.map(s => (
                                <div key={s.id} className="ipp-snapshot-card">
                                  <div className="ipp-snap-header">
                                    <div className="ipp-snap-meta">
                                      {typeBadge(s.snapshot_type)}
                                      <span className="ipp-snap-date">{formatDateTime(s.created_at)}</span>
                                      {s.createdByEmail && <span className="ipp-snap-by">by {s.createdByEmail}</span>}
                                    </div>
                                    <div className="ipp-snap-actions">
                                      <button
                                        className="ipp-action-btn"
                                        onClick={() => verifySnapshotAction(s.id)}
                                        disabled={verifying === s.id}
                                      >
                                        <ShieldCheck size={14} />
                                        {verifying === s.id ? 'Verifying...' : 'Verify'}
                                      </button>
                                      <button className="ipp-action-btn ipp-download" onClick={() => downloadProof(s.id)}>
                                        <Download size={14} /> Export
                                      </button>
                                    </div>
                                  </div>

                                  <div className="ipp-snap-details">
                                    <div className="ipp-snap-hash">
                                      <Hash size={14} />
                                      <code>{s.content_hash}</code>
                                    </div>
                                    <div className="ipp-snap-stats">
                                      <span>{s.content_summary?.depCount || 0} deps</span>
                                      <span>{s.content_summary?.hashCount || 0} hashes</span>
                                      {s.content_summary?.version && <span>v{s.content_summary.version}</span>}
                                    </div>
                                  </div>

                                  <div className="ipp-snap-status">
                                    <div className={`ipp-proof-badge ${s.has_rfc3161 ? 'ipp-proof-yes' : 'ipp-proof-no'}`}>
                                      {s.has_rfc3161 ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                      RFC 3161 {s.has_rfc3161 ? 'Signed' : 'Failed'}
                                    </div>
                                    {s.verified && (
                                      <div className="ipp-proof-badge ipp-proof-verified">
                                        <ShieldCheck size={12} /> Verified
                                      </div>
                                    )}
                                    {s.ots_bitcoin_block && (
                                      <div className="ipp-proof-badge ipp-proof-btc">
                                        BTC Block #{s.ots_bitcoin_block}
                                      </div>
                                    )}
                                    {s.rfc3161_tsa_url && (
                                      <span className="ipp-tsa-url">TSA: {s.rfc3161_tsa_url}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
