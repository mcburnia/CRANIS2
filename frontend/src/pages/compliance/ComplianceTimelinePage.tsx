import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  ArrowLeft, Loader2, Shield, Scale, Fingerprint,
  Tag, FileWarning, BarChart3
} from 'lucide-react';
import './ComplianceTimelinePage.css';

/* ── Types ────────────────────────────────────────────────── */

interface Product { id: string; name: string; }

interface VulnScan {
  id: string;
  completedAt: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  source: string;
  triggeredBy: string;
}

interface LicenseScan {
  id: string;
  completedAt: string;
  totalDeps: number;
  permissiveCount: number;
  copyleftCount: number;
  unknownCount: number;
  criticalCount: number;
}

interface CraReport {
  id: string;
  reportType: string;
  status: string;
  awarenessAt: string | null;
  createdAt: string;
  earlyWarningDeadline: string | null;
  notificationDeadline: string | null;
  finalReportDeadline: string | null;
  stages: Array<{ stage: string; submittedAt: string }> | null;
}

interface IpSnapshot {
  id: string;
  snapshotType: string;
  verified: boolean;
  createdAt: string;
}

interface Version {
  id: string;
  cranisVersion: string;
  githubTag: string | null;
  source: string;
  createdAt: string;
}

interface TimelineData {
  productId: string;
  productName: string;
  timeRange: { earliest: string | null; latest: string | null };
  vulnerabilityScans: VulnScan[];
  licenseScans: LicenseScan[];
  craReports: CraReport[];
  ipProofSnapshots: IpSnapshot[];
  versions: Version[];
}

/* ── Helpers ──────────────────────────────────────────────── */

const COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#8b8d98',
  permissive: '#22c55e',
  copyleft: '#f59e0b',
  unknown: '#ef4444',
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatChartDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ── Custom Tooltip ───────────────────────────────────────── */

function VulnTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ct-tooltip">
      <p className="ct-tooltip-date">{formatDateTime(label)}</p>
      {payload.map((p: any) => (
        <div className="ct-tooltip-row" key={p.dataKey}>
          <span className="ct-tooltip-dot" style={{ background: p.color }} />
          <span className="ct-tooltip-label">{p.name}</span>
          <span className="ct-tooltip-value">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function LicenseTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ct-tooltip">
      <p className="ct-tooltip-date">{formatDateTime(label)}</p>
      {payload.map((p: any) => (
        <div className="ct-tooltip-row" key={p.dataKey}>
          <span className="ct-tooltip-dot" style={{ background: p.color }} />
          <span className="ct-tooltip-label">{p.name}</span>
          <span className="ct-tooltip-value">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Event builders ───────────────────────────────────────── */

interface TimelineEvent {
  id: string;
  type: 'cra' | 'ip' | 'version';
  date: string;
  label: string;
  meta: string;
  badge?: { text: string; className: string };
}

function buildEvents(data: TimelineData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const r of data.craReports) {
    events.push({
      id: `cra-${r.id}`,
      type: 'cra',
      date: r.createdAt,
      label: `CRA ${r.reportType} report created`,
      meta: `Status: ${r.status.replace(/_/g, ' ')}`,
    });
    if (r.stages) {
      for (const s of r.stages) {
        events.push({
          id: `cra-stage-${r.id}-${s.stage}`,
          type: 'cra',
          date: s.submittedAt,
          label: `${s.stage.replace(/_/g, ' ')} submitted`,
          meta: `Report: ${r.reportType}`,
        });
      }
    }
  }

  for (const s of data.ipProofSnapshots) {
    events.push({
      id: `ip-${s.id}`,
      type: 'ip',
      date: s.createdAt,
      label: `IP proof snapshot (${s.snapshotType})`,
      meta: formatDateTime(s.createdAt),
      badge: s.verified
        ? { text: 'Verified', className: 'verified' }
        : { text: 'Unverified', className: 'unverified' },
    });
  }

  for (const v of data.versions) {
    events.push({
      id: `ver-${v.id}`,
      type: 'version',
      date: v.createdAt,
      label: `Version ${v.cranisVersion}${v.githubTag ? ` (${v.githubTag})` : ''}`,
      meta: v.source === 'github_release' ? 'GitHub release' : 'Auto-versioned',
    });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events;
}

const EVENT_ICONS: Record<string, typeof Shield> = {
  cra: FileWarning,
  ip: Fingerprint,
  version: Tag,
};

/* ── Component ────────────────────────────────────────────── */

export default function ComplianceTimelinePage() {
  const { productId } = useParams<{ productId: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState(productId || '');
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch products if no productId in URL
  useEffect(() => {
    if (productId) return;
    fetch('/api/products', { headers })
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  // Load timeline data
  const loadTimeline = useCallback(async (pid: string) => {
    if (!pid) { setData(null); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/compliance-timeline/${pid}`, { headers });
      if (!res.ok) throw new Error('Failed to load timeline');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || 'Failed to load timeline');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load when productId changes
  useEffect(() => {
    if (selectedProduct) loadTimeline(selectedProduct);
  }, [selectedProduct]);

  // Derived data
  const vulnChartData = data?.vulnerabilityScans.map(s => ({
    date: s.completedAt,
    critical: s.criticalCount,
    high: s.highCount,
    medium: s.mediumCount,
    low: s.lowCount,
  })) || [];

  const licenseChartData = data?.licenseScans.map(s => ({
    date: s.completedAt,
    permissive: s.permissiveCount,
    copyleft: s.copyleftCount,
    unknown: s.unknownCount,
  })) || [];

  const events = data ? buildEvents(data) : [];

  // Stat computations
  const lastVuln = data?.vulnerabilityScans[data.vulnerabilityScans.length - 1];
  const lastLicense = data?.licenseScans[data.licenseScans.length - 1];
  const critHigh = lastVuln ? lastVuln.criticalCount + lastVuln.highCount : 0;
  const permPct = lastLicense && lastLicense.totalDeps > 0
    ? Math.round((lastLicense.permissiveCount / lastLicense.totalDeps) * 100)
    : 0;

  return (
    <>
      {productId && (
        <Link to={`/products/${productId}`} className="ct-back">
          <ArrowLeft size={14} /> Back to product
        </Link>
      )}

      <PageHeader
        title={data ? `Compliance Timeline — ${data.productName}` : 'Compliance Timeline'}
      />

      {/* Product selector (when no productId in URL) */}
      {!productId && (
        <div className="ct-product-select">
          <label htmlFor="ct-product">Select product</label>
          <select
            id="ct-product"
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
          >
            <option value="">Choose a product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="ct-error">{error}</div>}

      {loading && (
        <div className="ct-loading">
          <Loader2 size={20} className="ct-spin" /> Loading timeline...
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stat cards */}
          <div className="ct-stats stats">
            <StatCard
              label="Vulnerability Scans"
              value={data.vulnerabilityScans.length}
              color="blue"
              sub={lastVuln ? `Latest: ${formatDate(lastVuln.completedAt)}` : undefined}
            />
            <StatCard
              label="Critical + High"
              value={critHigh}
              color={critHigh === 0 ? 'green' : critHigh <= 5 ? 'amber' : 'red'}
              sub={lastVuln ? `of ${lastVuln.findingsCount} total findings` : undefined}
            />
            <StatCard
              label="License Health"
              value={lastLicense ? `${permPct}%` : '—'}
              color={permPct >= 90 ? 'green' : permPct >= 70 ? 'amber' : 'red'}
              sub={lastLicense ? `${lastLicense.permissiveCount} of ${lastLicense.totalDeps} permissive` : undefined}
            />
            <StatCard
              label="CRA Reports"
              value={data.craReports.length}
              color={data.craReports.length === 0 ? 'green' : 'amber'}
              sub={data.craReports.length > 0 ? `${data.craReports.filter(r => r.status !== 'closed').length} active` : 'No reports'}
            />
          </div>

          <div className="ct-charts">
            {/* Vulnerability Trend */}
            <div className="ct-chart-section">
              <div className="ct-chart-header">
                <h3 className="ct-chart-title">Vulnerability Trend</h3>
                <span className="ct-chart-subtitle">Severity breakdown per scan</span>
              </div>

              {vulnChartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={vulnChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      stroke="#8b8d98"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#8b8d98"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<VulnTooltip />} />
                    <Area type="monotone" dataKey="critical" name="Critical" stackId="1" stroke={COLORS.critical} fill={COLORS.critical} fillOpacity={0.6} />
                    <Area type="monotone" dataKey="high" name="High" stackId="1" stroke={COLORS.high} fill={COLORS.high} fillOpacity={0.5} />
                    <Area type="monotone" dataKey="medium" name="Medium" stackId="1" stroke={COLORS.medium} fill={COLORS.medium} fillOpacity={0.4} />
                    <Area type="monotone" dataKey="low" name="Low" stackId="1" stroke={COLORS.low} fill={COLORS.low} fillOpacity={0.3} />
                    {data.versions.map(v => (
                      <ReferenceLine
                        key={v.id}
                        x={v.createdAt}
                        stroke="#a855f7"
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={{ value: v.cranisVersion, position: 'top', fill: '#a855f7', fontSize: 10 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="ct-chart-empty">
                  <BarChart3 size={32} />
                  <p>
                    {vulnChartData.length === 0
                      ? 'No vulnerability scans yet. Run a scan to see trends.'
                      : 'Not enough data points to show a trend. Run more scans.'}
                  </p>
                </div>
              )}
            </div>

            {/* License Compliance Trend */}
            <div className="ct-chart-section">
              <div className="ct-chart-header">
                <h3 className="ct-chart-title">License Compliance Trend</h3>
                <span className="ct-chart-subtitle">Category breakdown per scan</span>
              </div>

              {licenseChartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={licenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartDate}
                      stroke="#8b8d98"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#8b8d98"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<LicenseTooltip />} />
                    <Area type="monotone" dataKey="permissive" name="Permissive" stackId="1" stroke={COLORS.permissive} fill={COLORS.permissive} fillOpacity={0.5} />
                    <Area type="monotone" dataKey="copyleft" name="Copyleft" stackId="1" stroke={COLORS.copyleft} fill={COLORS.copyleft} fillOpacity={0.5} />
                    <Area type="monotone" dataKey="unknown" name="Unknown" stackId="1" stroke={COLORS.unknown} fill={COLORS.unknown} fillOpacity={0.4} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="ct-chart-empty">
                  <Scale size={32} />
                  <p>
                    {licenseChartData.length === 0
                      ? 'No license scans yet. Run a scan to see trends.'
                      : 'Not enough data points to show a trend. Run more scans.'}
                  </p>
                </div>
              )}
            </div>

            {/* Compliance Events */}
            <div className="ct-events-section">
              <h3 className="ct-events-title">Compliance Events</h3>

              {events.length > 0 ? (
                <div className="ct-events-list">
                  {events.map(evt => {
                    const Icon = EVENT_ICONS[evt.type];
                    return (
                      <div className="ct-event" key={evt.id}>
                        <div className={`ct-event-dot ${evt.type}`}>
                          <Icon size={14} />
                        </div>
                        <div className="ct-event-body">
                          <div className="ct-event-label">
                            {evt.label}
                            {evt.badge && (
                              <span className={`ct-event-badge ${evt.badge.className}`}>
                                {evt.badge.text}
                              </span>
                            )}
                          </div>
                          <div className="ct-event-meta">{formatDateTime(evt.date)}{evt.meta ? ` — ${evt.meta}` : ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ct-events-empty">No compliance events recorded yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
