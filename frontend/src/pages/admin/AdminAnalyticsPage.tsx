import { useState, useEffect } from 'react';
import {
  BarChart3, Loader, TrendingUp, Globe, CreditCard, FileCheck, Users, Building2,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminAnalyticsPage.css';

/* ── Types ────────────────────────────────────────────────────────────────── */

interface Snapshot {
  totalUsers: number;
  totalOrgs: number;
  totalProducts: number;
  connectedRepos: number;
  productsWithSboms: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalContributors: number;
  launchSubscribers: number;
}

interface WeekPoint { week: string; signups: number }
interface MonthPoint { month: string; total: number }

interface AnalyticsData {
  snapshot: Snapshot;
  growth: {
    weeklySignups: WeekPoint[];
    cumulativeUsers: MonthPoint[];
  };
  revenue: {
    mrrCents: number;
    byPlan: Record<string, { count: number; revenue: number }>;
    byStatus: Record<string, number>;
  };
  market: {
    countries: Array<{ country: string; count: number }>;
    industries: Array<{ industry: string; count: number }>;
    roles: Array<{ role: string; count: number }>;
    companySizes: Array<{ size: string; count: number }>;
  };
  assessments: {
    cra: {
      total: number; completed: number;
      byCategory: Array<{ category: string; count: number }>;
      byWeek: Array<{ week: string; count: number }>;
    };
    nis2: {
      total: number; completed: number;
      byEntityClass: Array<{ entityClass: string; count: number }>;
      byWeek: Array<{ week: string; count: number }>;
    };
  };
}

/* ── Colours ──────────────────────────────────────────────────────────────── */

const CHART_COLOURS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

function formatEur(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function formatWeek(val: unknown): string {
  const d = new Date(String(val));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMonth(val: unknown): string {
  const d = new Date(String(val));
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function AdminAnalyticsPage() {
  usePageMeta();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('session_token');
        const res = await fetch('/api/admin/analytics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch');
        setData(await res.json());
      } catch {
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="admin-analytics">
        <PageHeader title="Platform Analytics" />
        <div className="aa-loading"><Loader size={32} className="aa-spinner" /></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-analytics">
        <PageHeader title="Platform Analytics" />
        <div className="aa-error">{error || 'No data available'}</div>
      </div>
    );
  }

  const { snapshot: s, growth, revenue, market, assessments } = data;
  const totalAssessments = assessments.cra.completed + assessments.nis2.completed;

  return (
    <div className="admin-analytics">
      <PageHeader title="Platform Analytics" />

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className="aa-kpi-cards">
        <StatCard label="Total Users" value={s.totalUsers} />
        <StatCard label="Organisations" value={s.totalOrgs} />
        <StatCard label="Products" value={s.totalProducts} />
        <StatCard label="Connected Repos" value={s.connectedRepos} />
        <StatCard label="MRR" value={formatEur(revenue.mrrCents)} />
        <StatCard label="Assessment Completions" value={totalAssessments} />
      </div>

      {/* ── Charts row 1: Signups + Cumulative ─────────────────────────── */}
      <div className="aa-charts-row">
        <div className="aa-card">
          <div className="aa-card-header">
            <BarChart3 size={18} />
            <h3>Weekly Signups (26 weeks)</h3>
          </div>
          <div className="aa-card-body">
            {growth.weeklySignups.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={growth.weeklySignups}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tickFormatter={formatWeek} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem' }} labelFormatter={formatWeek} />
                  <Bar dataKey="signups" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="aa-empty">No signup data yet</div>}
          </div>
        </div>

        <div className="aa-card">
          <div className="aa-card-header">
            <TrendingUp size={18} />
            <h3>Cumulative Users</h3>
          </div>
          <div className="aa-card-body">
            {growth.cumulativeUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={growth.cumulativeUsers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem' }} labelFormatter={formatMonth} />
                  <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="aa-empty">No user data yet</div>}
          </div>
        </div>
      </div>

      {/* ── Charts row 2: Revenue + Assessments ────────────────────────── */}
      <div className="aa-charts-row">
        <div className="aa-card">
          <div className="aa-card-header">
            <CreditCard size={18} />
            <h3>Revenue Breakdown</h3>
          </div>
          <div className="aa-card-body">
            <div className="aa-metric-row">
              <span className="aa-metric-label">Monthly Recurring Revenue</span>
              <span className="aa-metric-value aa-purple">{formatEur(revenue.mrrCents)}</span>
            </div>
            <div className="aa-metric-row">
              <span className="aa-metric-label">Billable Contributors</span>
              <span className="aa-metric-value">{s.totalContributors}</span>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>By Plan</div>
            {Object.entries(revenue.byPlan).map(([plan, info]) => (
              <div className="aa-metric-row" key={plan}>
                <span className="aa-metric-label" style={{ textTransform: 'capitalize' }}>{plan}</span>
                <span className="aa-metric-value">{info.count} orgs &middot; {formatEur(info.revenue)}/mo</span>
              </div>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>By Status</div>
            {Object.entries(revenue.byStatus).map(([status, count]) => (
              <div className="aa-metric-row" key={status}>
                <span className="aa-metric-label" style={{ textTransform: 'capitalize' }}>{status}</span>
                <span className="aa-metric-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="aa-card">
          <div className="aa-card-header">
            <FileCheck size={18} />
            <h3>Assessment Completions</h3>
          </div>
          <div className="aa-card-body">
            <div className="aa-metric-row">
              <span className="aa-metric-label">CRA Assessments</span>
              <span className="aa-metric-value">{assessments.cra.completed} / {assessments.cra.total} started</span>
            </div>
            <div className="aa-metric-row">
              <span className="aa-metric-label">NIS2 Assessments</span>
              <span className="aa-metric-value">{assessments.nis2.completed} / {assessments.nis2.total} started</span>
            </div>
            <div className="aa-metric-row">
              <span className="aa-metric-label">Launch List Subscribers</span>
              <span className="aa-metric-value aa-purple">{s.launchSubscribers}</span>
            </div>
            {assessments.cra.byCategory.length > 0 && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>CRA Categories</div>
                {assessments.cra.byCategory.map(c => (
                  <div className="aa-metric-row" key={c.category}>
                    <span className="aa-metric-label" style={{ textTransform: 'capitalize' }}>{c.category?.replace(/_/g, ' ') || 'Unknown'}</span>
                    <span className="aa-metric-value">{c.count}</span>
                  </div>
                ))}
              </>
            )}
            {assessments.nis2.byEntityClass.length > 0 && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>NIS2 Entity Classes</div>
                {assessments.nis2.byEntityClass.map(c => (
                  <div className="aa-metric-row" key={c.entityClass}>
                    <span className="aa-metric-label" style={{ textTransform: 'capitalize' }}>{c.entityClass?.replace(/_/g, ' ') || 'Unknown'}</span>
                    <span className="aa-metric-value">{c.count}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Tables row: Countries + Industries ─────────────────────────── */}
      <div className="aa-charts-row">
        <div className="aa-card">
          <div className="aa-card-header">
            <Globe size={18} />
            <h3>Countries</h3>
          </div>
          <div className="aa-card-body">
            {market.countries.length > 0 ? (
              <table className="aa-table">
                <thead><tr><th>Country</th><th style={{ textAlign: 'right' }}>Orgs</th></tr></thead>
                <tbody>
                  {market.countries.map(c => (
                    <tr key={c.country}><td>{c.country}</td><td className="aa-num">{c.count}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="aa-empty">No country data yet</div>}
          </div>
        </div>

        <div className="aa-card">
          <div className="aa-card-header">
            <Building2 size={18} />
            <h3>Industries</h3>
          </div>
          <div className="aa-card-body">
            {market.industries.length > 0 ? (
              <table className="aa-table">
                <thead><tr><th>Industry</th><th style={{ textAlign: 'right' }}>Orgs</th></tr></thead>
                <tbody>
                  {market.industries.map(i => (
                    <tr key={i.industry}><td>{i.industry}</td><td className="aa-num">{i.count}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="aa-empty">No industry data yet</div>}
          </div>
        </div>
      </div>

      {/* ── Tables row: Roles + Company Sizes ──────────────────────────── */}
      <div className="aa-charts-row">
        <div className="aa-card">
          <div className="aa-card-header">
            <Users size={18} />
            <h3>Operator Roles</h3>
          </div>
          <div className="aa-card-body">
            {market.roles.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={market.roles} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={65} label={({ name }) => formatRole(String(name || ''))}>
                      {market.roles.map((_, i) => <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <table className="aa-table">
                  <thead><tr><th>Role</th><th style={{ textAlign: 'right' }}>Orgs</th></tr></thead>
                  <tbody>
                    {market.roles.map(r => (
                      <tr key={r.role}><td>{formatRole(r.role)}</td><td className="aa-num">{r.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : <div className="aa-empty">No role data yet</div>}
          </div>
        </div>

        <div className="aa-card">
          <div className="aa-card-header">
            <Building2 size={18} />
            <h3>Company Sizes</h3>
          </div>
          <div className="aa-card-body">
            {market.companySizes.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={market.companySizes} dataKey="count" nameKey="size" cx="50%" cy="50%" outerRadius={65} label={({ name }) => String(name || '')}>
                      {market.companySizes.map((_, i) => <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <table className="aa-table">
                  <thead><tr><th>Size</th><th style={{ textAlign: 'right' }}>Orgs</th></tr></thead>
                  <tbody>
                    {market.companySizes.map(s => (
                      <tr key={s.size}><td>{s.size}</td><td className="aa-num">{s.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : <div className="aa-empty">No company size data yet</div>}
          </div>
        </div>
      </div>

      {/* ── Activity snapshot ──────────────────────────────────────────── */}
      <div className="aa-charts-row">
        <div className="aa-card aa-full-width">
          <div className="aa-card-header">
            <TrendingUp size={18} />
            <h3>Platform Snapshot</h3>
          </div>
          <div className="aa-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <div className="aa-metric-label">Active Users (7d)</div>
              <div className="aa-metric-value">{s.activeUsers7d}</div>
            </div>
            <div>
              <div className="aa-metric-label">Active Users (30d)</div>
              <div className="aa-metric-value">{s.activeUsers30d}</div>
            </div>
            <div>
              <div className="aa-metric-label">Products with SBOMs</div>
              <div className="aa-metric-value">{s.productsWithSboms}</div>
            </div>
            <div>
              <div className="aa-metric-label">Billable Contributors</div>
              <div className="aa-metric-value">{s.totalContributors}</div>
            </div>
            <div>
              <div className="aa-metric-label">Launch List Subscribers</div>
              <div className="aa-metric-value">{s.launchSubscribers}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
