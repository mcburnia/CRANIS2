import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { Package, Users, ScrollText, ShieldAlert, Circle, ChevronRight, ClipboardCheck, Grid3X3, AlertTriangle, FileText, Shield, Clock, ArrowRight, Building2 } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './DashboardPage.css';

interface DashboardProduct {
  id: string;
  name: string;
  category: string | null;
  lifecycleStatus: string;
  repoConnected: boolean;
  repoFullName: string | null;
  sbomPackageCount: number;
  sbomIsStale: boolean;
  contributorCount: number;
  techFileProgress: number;
  techFileSections: { total: number; completed: number };
  lastSync: string | null;
  riskFindings: { total: number; critical: number; high: number; open: number };
  craReadiness: { met: number; total: number; readiness: number };
  supportStatus: { status: string; daysRemaining: number | null; endDate: string | null };
  nbAssessment: { status: string; module: string; certificateNumber: string | null } | null;
  msRegistration: { status: string; registrationNumber: string | null } | null;
}

interface DashboardStats {
  totalProducts: number;
  connectedRepos: number;
  totalContributors: number;
  totalDependencies: number;
  staleSboms: number;
}

interface ActivityItem {
  eventType: string;
  userEmail: string;
  createdAt: string;
  metadata: Record<string, any> | null;
}

interface RiskFindingsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  dismissed: number;
  lastScanAt: string | null;
}

interface DashboardData {
  products: DashboardProduct[];
  stats: DashboardStats;
  riskFindings: RiskFindingsSummary;
  recentActivity: ActivityItem[];
  overallReadiness: number;
}

interface ChecklistStep {
  id: string;
  step: number;
  title: string;
  description: string;
  complete: boolean;
  actionLabel: string;
  actionTab: string | null;
  actionPath: string | null;
}

interface ChecklistDeadline {
  id: string;
  label: string;
  date: string;
  daysRemaining: number;
}

interface ProductChecklist {
  productId: string;
  productName: string;
  stepsComplete: number;
  stepsTotal: number;
  complete: boolean;
  deadlines: ChecklistDeadline[];
  steps: ChecklistStep[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatCategory(cat: string | null): { label: string; color: string } {
  if (!cat) return { label: 'Unclassified', color: 'muted' };
  // Normalise legacy values from before the category standardisation
  const normalised = cat === 'category-1' || cat === 'class_i' ? 'important_i'
    : cat === 'category-2' || cat === 'class_ii' ? 'important_ii'
    : cat;
  switch (normalised) {
    case 'default': return { label: 'Default', color: 'green' };
    case 'important_i': return { label: 'Important I', color: 'amber' };
    case 'important_ii': return { label: 'Important II', color: 'orange' };
    case 'critical': return { label: 'Critical', color: 'red' };
    default: return { label: 'Unclassified', color: 'muted' };
  }
}

function getStatusBadge(progress: number): { label: string; color: string } {
  if (progress === 0) return { label: 'Not Started', color: 'red' };
  if (progress >= 100) return { label: 'Complete', color: 'green' };
  return { label: 'In Progress', color: 'amber' };
}

function getSupportBadge(ss: { status: string; daysRemaining: number | null }): { label: string; color: string; sub?: string } {
  switch (ss.status) {
    case 'active': return { label: 'Active', color: 'green', sub: ss.daysRemaining != null ? `${ss.daysRemaining}d remaining` : undefined };
    case 'ending_soon': return { label: 'Ending Soon', color: 'amber', sub: ss.daysRemaining != null ? `${ss.daysRemaining}d remaining` : undefined };
    case 'ended': return { label: 'Ended', color: 'red', sub: ss.daysRemaining != null ? `${Math.abs(ss.daysRemaining)}d ago` : undefined };
    default: return { label: 'Not Set', color: 'muted' };
  }
}

function getActivityDotColor(eventType: string): string {
  if (eventType === 'login' || eventType === 'register') return 'blue';
  if (['github_repo_synced', 'sbom_refreshed', 'github_connected'].includes(eventType)) return 'green';
  if (eventType === 'webhook_sbom_stale') return 'amber';
  if (eventType === 'vulnerability_scan_triggered') return 'amber';
  if (eventType === 'vulnerability_finding_updated') return 'green';
  if (eventType.startsWith('login_failed')) return 'red';
  return 'blue';
}

function getActivityText(item: ActivityItem): string {
  const product = item.metadata?.productName;
  switch (item.eventType) {
    case 'github_repo_synced': return `Synced repository ${product || 'unknown'}`;
    case 'login': return `${item.userEmail} logged in`;
    case 'register': return 'Account registered';
    case 'webhook_sbom_stale': return 'SBOM marked as stale via webhook';
    case 'sbom_refreshed': return `SBOM refreshed for ${product || 'unknown'}`;
    case 'product_created': return `Product ${product || 'unknown'} created`;
    case 'github_connected': return 'GitHub connected';
    case 'org_created': return 'Organisation created';
    case 'login_failed_bad_password': return 'Failed login attempt';
    case 'vulnerability_scan_triggered': return `Vulnerability scan started for ${item.metadata?.productId ? 'product' : 'all products'}`;
    case 'vulnerability_finding_updated': return `Vulnerability finding ${item.metadata?.status || 'updated'}`;
    default: return item.eventType.replace(/_/g, ' ');
  }
}

function getReadinessColour(pct: number): string {
  if (pct >= 67) return 'green';
  if (pct >= 34) return 'amber';
  return 'red';
}

function getReadinessLabel(pct: number, lifecycle?: string): string {
  const isPreProd = !lifecycle || lifecycle === 'pre_production';
  if (pct >= 100) return isPreProd ? 'Ready for market placement' : 'Fully compliant';
  if (pct >= 90) return isPreProd ? 'Nearly ready' : 'Nearly compliant';
  if (pct >= 67) return isPreProd ? 'Good progress' : 'Good progress';
  if (pct >= 34) return isPreProd ? 'Preparing' : 'In progress';
  if (pct > 0) return isPreProd ? 'Getting started' : 'Attention needed';
  return isPreProd ? 'Not started' : 'Not started';
}

function getNbAssessmentBadge(nb: DashboardProduct['nbAssessment'], category: string | null): { label: string; color: string } | null {
  const requiresNb = category === 'important_ii' || category === 'critical';
  if (!requiresNb) return null;
  if (!nb) return { label: 'Required', color: 'red' };
  switch (nb.status) {
    case 'approved': return { label: 'Approved', color: 'green' };
    case 'submitted':
    case 'under_review':
    case 'additional_info_requested': return { label: nb.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: 'amber' };
    case 'rejected': return { label: 'Rejected', color: 'red' };
    case 'planning': return { label: 'Planning', color: 'amber' };
    default: return { label: 'Required', color: 'red' };
  }
}

function getMsRegistrationBadge(ms: DashboardProduct['msRegistration'], category: string | null): { label: string; color: string } | null {
  if (category !== 'critical') return null;
  if (!ms) return { label: 'Required', color: 'red' };
  switch (ms.status) {
    case 'registered': return { label: 'Registered', color: 'green' };
    case 'submitted':
    case 'acknowledged': return { label: ms.status.replace(/\b\w/g, c => c.toUpperCase()), color: 'amber' };
    case 'rejected': return { label: 'Rejected', color: 'red' };
    case 'planning':
    case 'preparing': return { label: ms.status.replace(/\b\w/g, c => c.toUpperCase()), color: 'amber' };
    default: return { label: 'Required', color: 'red' };
  }
}

function getLifecycleBadge(lifecycle: string): { label: string; color: string } {
  switch (lifecycle) {
    case 'on_market': return { label: 'On Market', color: 'green' };
    case 'end_of_life': return { label: 'End of Life', color: 'amber' };
    default: return { label: 'Pre-production', color: 'blue' };
  }
}

export default function DashboardPage() {
  usePageMeta();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<ProductChecklist[]>([]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const token = localStorage.getItem('session_token');
        const res = await fetch('/api/dashboard/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
          // Fetch checklists for each product in parallel (max 5)
          if (json.products && json.products.length > 0) {
            const productSlice = json.products.slice(0, 5);
            const results = await Promise.allSettled(
              productSlice.map((p: DashboardProduct) =>
                fetch(`/api/products/${p.id}/compliance-checklist`, {
                  headers: { Authorization: `Bearer ${token}` },
                }).then(r => r.ok ? r.json() : null)
              )
            );
            setChecklists(
              results
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => (r as PromiseFulfilledResult<ProductChecklist>).value)
            );
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="welcome-banner">
          <h2>Loading dashboard...</h2>
          <p>Fetching your latest data</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="welcome-banner">
          <h2>Unable to load dashboard</h2>
          <p>Please try refreshing the page</p>
        </div>
      </>
    );
  }

  const { products, stats, riskFindings, recentActivity } = data;

  // Find most recent sync across all products
  const lastSyncDates = products.map(p => p.lastSync).filter(Boolean) as string[];
  const mostRecentSync = lastSyncDates.length > 0
    ? new Date(Math.max(...lastSyncDates.map(d => new Date(d).getTime())))
    : null;
  const syncTimestamp = mostRecentSync
    ? `Last sync: ${mostRecentSync.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC`
    : undefined;

  // Welcome banner message
  let bannerTitle = '';
  let bannerText = '';
  if (stats.totalProducts === 0) {
    bannerTitle = 'Get started';
    bannerText = 'Add your first product to begin tracking CRA compliance.';
  } else if (stats.connectedRepos === 0) {
    bannerTitle = `${stats.totalProducts} product${stats.totalProducts > 1 ? 's' : ''} added`;
    bannerText = 'Connect your GitHub repositories to start syncing dependencies and contributors.';
  } else {
    bannerTitle = `${stats.totalProducts} product${stats.totalProducts > 1 ? 's' : ''} tracked`;
    bannerText = `${stats.connectedRepos} repositor${stats.connectedRepos > 1 ? 'ies' : 'y'} connected. ${stats.totalDependencies} dependencies and ${stats.totalContributors} contributor${stats.totalContributors !== 1 ? 's' : ''} tracked.`;
  }

  return (
    <>
      <PageHeader title="Dashboard" timestamp={syncTimestamp} />

      {stats.totalProducts > 0 ? (
        <div className="readiness-banner">
          <div className="readiness-gauge">
            <svg viewBox="0 0 120 120" className="readiness-ring">
              <circle cx="60" cy="60" r="52" className="readiness-ring-bg" />
              <circle cx="60" cy="60" r="52"
                className={`readiness-ring-fill ${getReadinessColour(data.overallReadiness)}`}
                strokeDasharray={`${(data.overallReadiness / 100) * 327} 327`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="readiness-pct">{data.overallReadiness}%</div>
          </div>
          <div className="readiness-info">
            <h2>CRA Readiness</h2>
            <p className="readiness-sub">{getReadinessLabel(data.overallReadiness, products.some(p => p.lifecycleStatus === 'on_market') ? 'on_market' : undefined)}</p>
            <p className="readiness-detail">{bannerText}</p>
            {data.overallReadiness < 100 && products.length > 0 && (() => {
              const incompleteProducts = products.filter(p => (p.craReadiness?.readiness ?? 0) < 100);
              if (incompleteProducts.length === 0) return null;
              if (incompleteProducts.length === 1) {
                const p = incompleteProducts[0];
                const cl = checklists.find(c => c.productId === p.id);
                const remaining = cl ? cl.stepsTotal - cl.stepsComplete : 0;
                return (
                  <Link to={`/products/${p.id}/action-plan`} className="readiness-cta">
                    <ArrowRight size={14} />
                    {remaining > 0 ? `${remaining} action${remaining !== 1 ? 's' : ''} to reach 100%` : 'View action plan'}
                  </Link>
                );
              }
              return (
                <div className="readiness-cta-list">
                  {incompleteProducts.slice(0, 3).map(p => {
                    const lc = getLifecycleBadge(p.lifecycleStatus);
                    return (
                      <Link key={p.id} to={`/products/${p.id}/action-plan`} className="readiness-cta">
                        <ArrowRight size={14} />
                        {p.name}
                        <span className={`badge ${lc.color}`} style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem', marginLeft: '0.2rem' }}>{lc.label}</span>
                      </Link>
                    );
                  })}
                  {incompleteProducts.length > 3 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>+{incompleteProducts.length - 3} more</span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="welcome-banner">
          <h2>{bannerTitle}</h2>
          <p>{bannerText}</p>
        </div>
      )}

      <div className="stats">
        <StatCard label="Products" value={stats.totalProducts} color="blue" sub={`${stats.connectedRepos} with repos`} />
        <StatCard label="Connected Repos" value={stats.connectedRepos} color="blue" sub={stats.staleSboms > 0 ? `${stats.staleSboms} stale` : 'all fresh'} />
        <StatCard label="Contributors" value={stats.totalContributors} color="amber" />
        <StatCard label="Dependencies" value={stats.totalDependencies} color="green" sub={`across ${stats.connectedRepos} repo${stats.connectedRepos !== 1 ? 's' : ''}`} />
        <StatCard label="Risk Findings" value={riskFindings.total} color={riskFindings.critical > 0 ? 'red' : riskFindings.high > 0 ? 'amber' : 'green'} sub={riskFindings.total > 0 ? `${riskFindings.open} open` : riskFindings.lastScanAt ? 'none found' : 'not scanned yet'} />
      </div>

      <div className="section">
        <h3><Package size={18} /> Products & Compliance</h3>
        {products.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No products yet. <Link to="/products">Add your first product</Link>.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>CRA Category</th>
                <th>Technical File</th>
                <th>CRA Readiness</th>
                <th>Support</th>
                <th>NB Assessment</th>
                {products.some(p => p.category === 'critical') && <th>MS Registration</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const cat = formatCategory(p.category);
                const status = getStatusBadge(p.techFileProgress);
                const progressColor = p.techFileProgress === 0 ? 'red' : p.techFileProgress >= 100 ? 'green' : 'amber';
                const readinessColour = getReadinessColour(p.craReadiness?.readiness ?? 0);
                const readinessPct = p.craReadiness?.readiness ?? 0;
                const support = getSupportBadge(p.supportStatus || { status: 'not_set', daysRemaining: null });
                return (
                  <tr key={p.id}>
                    <td><Link to={`/products/${p.id}`}><strong>{p.name}</strong></Link></td>
                    <td><span className={`badge ${cat.color}`}>{cat.label}</span></td>
                    <td>
                      <div className="progress-bar"><div className={`progress-fill ${progressColor}`} style={{ width: `${Math.max(p.techFileProgress, 2)}%` }} /></div>
                      <span className="progress-text">{p.techFileProgress}%</span>
                    </td>
                    <td>
                      <div className="progress-bar"><div className={`progress-fill ${readinessColour}`} style={{ width: `${Math.max(readinessPct, 2)}%` }} /></div>
                      <span className="progress-text">
                        {readinessPct}% <span className="readiness-fraction">({p.craReadiness?.met ?? 0}/{p.craReadiness?.total ?? 0})</span>
                        {readinessPct < 100 && (
                          <Link to={`/products/${p.id}/action-plan`} className="readiness-plan-link">Action Plan</Link>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${support.color}`}>{support.label}</span>
                      {support.sub && <div className="support-sub">{support.sub}</div>}
                    </td>
                    <td>
                      {(() => {
                        const nb = getNbAssessmentBadge(p.nbAssessment, p.category);
                        if (!nb) return <span style={{ color: 'var(--muted)' }}>{'\u2014'}</span>;
                        return <span className={`badge ${nb.color}`}>{nb.label}</span>;
                      })()}
                    </td>
                    {products.some(pr => pr.category === 'critical') && (
                      <td>
                        {(() => {
                          const ms = getMsRegistrationBadge(p.msRegistration, p.category);
                          if (!ms) return <span style={{ color: 'var(--muted)' }}>{'\u2014'}</span>;
                          return <span className={`badge ${ms.color}`}>{ms.label}</span>;
                        })()}
                      </td>
                    )}
                    <td><span className={`badge ${status.color}`}>{status.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Compliance Heat Map ─────────────────────────────────── */}
      {products.length >= 2 && (
        <div className="section">
          <h3><Grid3X3 size={18} /> Compliance Heat Map</h3>
          {(() => {
            const sorted = [...products].sort((a, b) => (a.craReadiness?.readiness ?? 0) - (b.craReadiness?.readiness ?? 0));
            const anyRequiresNb = sorted.some(p => p.category === 'important_ii' || p.category === 'critical');
            const anyRequiresMs = sorted.some(p => p.category === 'critical');

            function cellColour(pct: number): string {
              if (pct >= 67) return 'hm-green';
              if (pct >= 34) return 'hm-amber';
              return 'hm-red';
            }

            function vulnColour(p: DashboardProduct): string {
              const severe = (p.riskFindings?.critical ?? 0) + (p.riskFindings?.high ?? 0);
              if (severe === 0) return 'hm-green';
              if (severe <= 3) return 'hm-amber';
              return 'hm-red';
            }

            function sbomColour(p: DashboardProduct): string {
              if (!p.sbomPackageCount || p.sbomPackageCount === 0) return 'hm-red';
              if (p.sbomIsStale) return 'hm-amber';
              return 'hm-green';
            }

            function supportColour(p: DashboardProduct): string {
              const s = p.supportStatus?.status;
              if (s === 'active') return 'hm-green';
              if (s === 'ending_soon') return 'hm-amber';
              if (s === 'ended') return 'hm-red';
              return 'hm-red';
            }

            function sbomLabel(p: DashboardProduct): string {
              if (!p.sbomPackageCount || p.sbomPackageCount === 0) return 'Missing';
              if (p.sbomIsStale) return 'Stale';
              return 'Fresh';
            }

            function supportLabel(p: DashboardProduct): string {
              const s = p.supportStatus?.status;
              if (s === 'active') return 'Active';
              if (s === 'ending_soon') return 'Ending';
              if (s === 'ended') return 'Ended';
              return 'Not Set';
            }

            // Top blockers
            const blockers: { icon: typeof AlertTriangle; colour: string; text: string; products: DashboardProduct[] }[] = [];

            const criticalGaps = sorted.filter(p => (p.craReadiness?.readiness ?? 0) < 34);
            if (criticalGaps.length > 0) blockers.push({ icon: Shield, colour: 'red', text: `${criticalGaps.length} product${criticalGaps.length > 1 ? 's' : ''} with critical compliance gaps (<34%)`, products: criticalGaps });

            const critVulns = sorted.filter(p => (p.riskFindings?.critical ?? 0) > 0);
            if (critVulns.length > 0) blockers.push({ icon: AlertTriangle, colour: 'red', text: `${critVulns.length} product${critVulns.length > 1 ? 's' : ''} with critical vulnerabilities`, products: critVulns });

            const expiredSupport = sorted.filter(p => p.supportStatus?.status === 'ended');
            if (expiredSupport.length > 0) blockers.push({ icon: Clock, colour: 'amber', text: `${expiredSupport.length} product${expiredSupport.length > 1 ? 's' : ''} with expired support periods`, products: expiredSupport });

            const staleSboms = sorted.filter(p => p.sbomIsStale || !p.sbomPackageCount || p.sbomPackageCount === 0);
            if (staleSboms.length > 0) blockers.push({ icon: ScrollText, colour: 'amber', text: `${staleSboms.length} product${staleSboms.length > 1 ? 's' : ''} with missing or stale SBOMs`, products: staleSboms });

            const lowTechFile = sorted.filter(p => p.techFileProgress < 34);
            if (lowTechFile.length > 0) blockers.push({ icon: FileText, colour: 'amber', text: `${lowTechFile.length} product${lowTechFile.length > 1 ? 's' : ''} need technical file attention (<34%)`, products: lowTechFile });

            const nbNeeded = sorted.filter(p => {
              const req = p.category === 'important_ii' || p.category === 'critical';
              return req && (!p.nbAssessment || p.nbAssessment.status !== 'approved');
            });
            if (nbNeeded.length > 0) blockers.push({ icon: Building2, colour: 'amber', text: `${nbNeeded.length} product${nbNeeded.length > 1 ? 's' : ''} awaiting notified body assessment`, products: nbNeeded });

            const msNeeded = sorted.filter(p => p.category === 'critical' && (!p.msRegistration || p.msRegistration.status !== 'registered'));
            if (msNeeded.length > 0) blockers.push({ icon: Shield, colour: 'amber', text: `${msNeeded.length} critical product${msNeeded.length > 1 ? 's' : ''} awaiting market surveillance registration`, products: msNeeded });

            return (
              <>
                <div className="hm-grid" role="table">
                  <div className="hm-header-row" role="row">
                    <div className="hm-corner" role="columnheader">Product</div>
                    <div className="hm-col-header" role="columnheader">CRA Readiness</div>
                    <div className="hm-col-header" role="columnheader">Technical File</div>
                    <div className="hm-col-header" role="columnheader">Vulnerabilities</div>
                    <div className="hm-col-header" role="columnheader">SBOM Health</div>
                    <div className="hm-col-header" role="columnheader">Support Period</div>
                    {anyRequiresNb && <div className="hm-col-header" role="columnheader">NB Assessment</div>}
                    {anyRequiresMs && <div className="hm-col-header" role="columnheader">MS Registration</div>}
                  </div>
                  {sorted.map(p => {
                    const readiness = p.craReadiness?.readiness ?? 0;
                    const severe = (p.riskFindings?.critical ?? 0) + (p.riskFindings?.high ?? 0);
                    const cat = formatCategory(p.category);
                    return (
                      <div key={p.id} className="hm-row" role="row">
                        <div className="hm-product" role="rowheader">
                          <Link to={`/products/${p.id}`}>{p.name}</Link>
                          <span className={`badge ${cat.color} hm-cat-badge`}>{cat.label}</span>
                        </div>
                        <div className={`hm-cell ${cellColour(readiness)}`} role="cell">{readiness}%</div>
                        <div className={`hm-cell ${cellColour(p.techFileProgress)}`} role="cell">{p.techFileProgress}%</div>
                        <div className={`hm-cell ${vulnColour(p)}`} role="cell">{severe === 0 ? 'None' : severe}</div>
                        <div className={`hm-cell ${sbomColour(p)}`} role="cell">{sbomLabel(p)}</div>
                        <div className={`hm-cell ${supportColour(p)}`} role="cell">{supportLabel(p)}</div>
                        {anyRequiresNb && (() => {
                          const nb = getNbAssessmentBadge(p.nbAssessment, p.category);
                          if (!nb) return <div className="hm-cell hm-muted" role="cell">{'\u2014'}</div>;
                          const hmColor = nb.color === 'green' ? 'hm-green' : nb.color === 'red' ? 'hm-red' : 'hm-amber';
                          return <div className={`hm-cell ${hmColor}`} role="cell">{nb.label}</div>;
                        })()}
                        {anyRequiresMs && (() => {
                          const ms = getMsRegistrationBadge(p.msRegistration, p.category);
                          if (!ms) return <div className="hm-cell hm-muted" role="cell">{'\u2014'}</div>;
                          const hmColor = ms.color === 'green' ? 'hm-green' : ms.color === 'red' ? 'hm-red' : 'hm-amber';
                          return <div className={`hm-cell ${hmColor}`} role="cell">{ms.label}</div>;
                        })()}
                      </div>
                    );
                  })}
                </div>

                {blockers.length > 0 && (
                  <div className="hm-blockers">
                    <h4>Top Blockers</h4>
                    {blockers.map((b, i) => (
                      <div key={i} className={`hm-blocker hm-blocker-${b.colour}`}>
                        <b.icon size={14} />
                        <span className="hm-blocker-text">{b.text}</span>
                        <span className="hm-blocker-products">
                          {b.products.slice(0, 3).map((p, j) => (
                            <span key={p.id}>
                              {j > 0 && ', '}
                              <Link to={`/products/${p.id}`}>{p.name}</Link>
                            </span>
                          ))}
                          {b.products.length > 3 && ` +${b.products.length - 3} more`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div className="section">
        <h3><ShieldAlert size={18} /> Dependency Risk Findings</h3>
        {riskFindings.total === 0 && !riskFindings.lastScanAt ? (
          <div className="risk-card">
            <div className="risk-header">
              <div className="risk-title">No Scans Yet</div>
            </div>
            <div className="risk-detail">Go to <Link to="/risk-findings">Risk Findings</Link> and click "Scan All Products" to check your dependencies for known vulnerabilities.</div>
          </div>
        ) : riskFindings.total === 0 ? (
          <div className="risk-card" style={{ borderColor: 'var(--green)' }}>
            <div className="risk-header">
              <div className="risk-title" style={{ color: 'var(--green)' }}>All Clear</div>
            </div>
            <div className="risk-detail">No known vulnerabilities found across your dependencies. Last scan: {riskFindings.lastScanAt ? new Date(riskFindings.lastScanAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never'}.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {riskFindings.critical > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px', borderColor: '#dc2626' }}><div className="risk-header"><div className="risk-title" style={{ color: '#dc2626', fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.critical}</div></div><div className="risk-detail" style={{ color: '#dc2626' }}>Critical</div></div>}
              {riskFindings.high > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px', borderColor: '#f97316' }}><div className="risk-header"><div className="risk-title" style={{ color: '#f97316', fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.high}</div></div><div className="risk-detail" style={{ color: '#f97316' }}>High</div></div>}
              {riskFindings.medium > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px' }}><div className="risk-header"><div className="risk-title" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.medium}</div></div><div className="risk-detail">Medium</div></div>}
              {riskFindings.low > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px' }}><div className="risk-header"><div className="risk-title" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.low}</div></div><div className="risk-detail">Low</div></div>}
            </div>
            <table>
              <thead>
                <tr><th>Product</th><th>Findings</th><th>Critical</th><th>High</th><th>Open</th></tr>
              </thead>
              <tbody>
                {products.filter(p => p.riskFindings && p.riskFindings.total > 0).map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/products/${p.id}?tab=risk-findings`}>{p.name}</Link></td>
                    <td>{p.riskFindings.total}</td>
                    <td>{p.riskFindings.critical > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{p.riskFindings.critical}</span> : <span style={{ color: 'var(--muted)' }}>0</span>}</td>
                    <td>{p.riskFindings.high > 0 ? <span style={{ color: '#f97316', fontWeight: 600 }}>{p.riskFindings.high}</span> : <span style={{ color: 'var(--muted)' }}>0</span>}</td>
                    <td>{p.riskFindings.open}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              {riskFindings.dismissed > 0 && <span>{riskFindings.dismissed} dismissed. </span>}
              Last scan: {riskFindings.lastScanAt ? new Date(riskFindings.lastScanAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never'}.
              {' '}<Link to="/risk-findings" style={{ color: 'var(--accent)' }}>View all findings</Link>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h3><Users size={18} /> Contributor Overview</h3>
        {products.filter(p => p.repoConnected).length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Connect a GitHub repository to see contributor data.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Product</th><th>Contributors</th><th>Last Sync</th></tr>
            </thead>
            <tbody>
              {products.filter(p => p.repoConnected).map(p => (
                <tr key={p.id}>
                  <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                  <td>{p.contributorCount}</td>
                  <td>{p.lastSync ? timeAgo(p.lastSync) : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CRA Compliance Checklist ────────────────────────────── */}
      {checklists.length > 0 && !checklists.every(c => c.complete) && (
        <div className="section">
          <h3><ClipboardCheck size={18} /> CRA Compliance Checklist</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Track your path from connected repo to audit-ready.
            {' '}<span style={{ color: 'var(--amber)', fontWeight: 600 }}>
              {checklists[0]?.deadlines.find(d => d.id === 'incident_reporting')?.daysRemaining} days
            </span>{' '}to incident reporting deadline (11 Sep 2026).
            {' '}<span style={{ color: 'var(--muted)' }}>
              {checklists[0]?.deadlines.find(d => d.id === 'full_compliance')?.daysRemaining} days
            </span>{' '}to full compliance (11 Dec 2027).
          </p>
          {checklists.map(cl => {
            if (cl.complete) return null;
            const nextStep = cl.steps.find(s => !s.complete);
            const progressPct = Math.round((cl.stepsComplete / cl.stepsTotal) * 100);
            return (
              <div key={cl.productId} className="dash-checklist-card">
                <div className="dash-cl-header">
                  <span className="dash-cl-name">{cl.productName}</span>
                  <span className="dash-cl-count">{cl.stepsComplete}/{cl.stepsTotal} steps complete</span>
                </div>
                <div className="dash-cl-bar-wrap">
                  <div className="dash-cl-bar">
                    <div className="dash-cl-bar-fill" style={{ width: `${Math.max(progressPct, 2)}%` }} />
                  </div>
                  <span className="dash-cl-pct">{progressPct}%</span>
                </div>
                {/* Step dots */}
                <div className="dash-cl-steps">
                  {cl.steps.map(s => (
                    <span key={s.id} className={`dash-cl-dot ${s.complete ? 'done' : 'todo'}`} title={s.title} />
                  ))}
                </div>
                {/* Next action */}
                {nextStep && (
                  <div className="dash-cl-next">
                    <Circle size={13} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                    <span>
                      <strong>Next: </strong>{nextStep.title}
                    </span>
                    <button
                      className="dash-cl-action"
                      onClick={() => {
                        if (nextStep.actionPath) {
                          navigate(nextStep.actionPath);
                        } else {
                          navigate(`/products/${cl.productId}${nextStep.actionTab ? `?tab=${nextStep.actionTab}` : ''}`);
                        }
                      }}
                    >
                      {nextStep.actionLabel} <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {checklists.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Showing {checklists.filter(c => !c.complete).length} product{checklists.filter(c => !c.complete).length !== 1 ? 's' : ''} with outstanding steps.
            </div>
          )}
        </div>
      )}

      <div className="section">
        <h3><ScrollText size={18} /> Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No activity yet.</p>
        ) : (
          <div className="activity-feed">
            {recentActivity.map((item, i) => (
              <div key={i} className="activity-item">
                <div className={`activity-dot ${getActivityDotColor(item.eventType)}`} />
                <div className="activity-content">
                  <div className="activity-text">{getActivityText(item)}</div>
                  <div className="activity-time">{new Date(item.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
