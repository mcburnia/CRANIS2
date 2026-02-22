import { useState, useEffect } from 'react';
import { Building2, Users, Package, AlertTriangle, ChevronDown, ChevronRight, Shield, FileText, Loader, Search, ExternalLink, CheckCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminOrgsPage.css';

interface OrgVulns { total: number; critical: number; high: number; open: number }
interface OrgObligations { total: number; met: number }

interface Org {
  id: string;
  name: string;
  country: string | null;
  craRole: string | null;
  industry: string | null;
  companySize: string | null;
  createdAt: string | null;
  productCount: number;
  repoCount: number;
  userCount: number;
  lastActivity: string | null;
  vulnerabilities: OrgVulns;
  obligations: OrgObligations;
}

interface OrgDetailUser {
  id: string;
  email: string;
  orgRole: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  createdAt: string;
}

interface OrgDetailProduct {
  id: string;
  name: string;
  category: string;
  lifecycle: string | null;
  repoFullName: string | null;
  hasRepo: boolean;
  contributors: number;
  dependencies: number;
  vulnerabilities: OrgVulns;
  techFile: { total: number; completed: number };
}

interface OrgDetail {
  org: { id: string; name: string; country: string; craRole: string; industry: string; companySize: string; createdAt: string };
  users: OrgDetailUser[];
  products: OrgDetailProduct[];
  recentEvents: { eventType: string; createdAt: string; userEmail: string; metadata: any }[];
}

const CRA_ROLE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  importer: 'Importer',
  distributor: 'Distributor',
  open_source_steward: 'Open Source Steward',
};

const CATEGORY_LABELS: Record<string, string> = {
  default: 'Default',
  class_i: 'Class I',
  class_ii: 'Class II',
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [totals, setTotals] = useState({ totalOrgs: 0, totalUsers: 0, totalProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);

  async function fetchOrgs() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/orgs', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrgs(data.orgs);
      setTotals(data.totals);
    } catch {
      setError('Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOrg(orgId: string) {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      setOrgDetail(null);
      return;
    }
    setExpandedOrg(orgId);
    setDetailLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/orgs/${orgId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrgDetail(data);
    } catch {
      setOrgDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.country || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.craRole || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="ao-loading"><Loader size={32} className="ao-spinner" /></div>;
  if (error) return <div className="ao-error">{error}</div>;

  return (
    <div className="admin-orgs">
      <PageHeader title="Organisation Management" />

      <div className="ao-stat-cards">
        <StatCard label="Organisations" value={totals.totalOrgs} color="blue" />
        <StatCard label="Total Users" value={totals.totalUsers} />
        <StatCard label="Total Products" value={totals.totalProducts} />
      </div>

      <div className="ao-search-bar">
        <Search size={16} className="ao-search-icon" />
        <input
          type="text"
          placeholder="Search by name, country, or CRA role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ao-search-input"
        />
      </div>

      <div className="ao-org-list">
        {filtered.length === 0 && (
          <div className="ao-empty">No organisations found</div>
        )}
        {filtered.map(org => (
          <div key={org.id} className={`ao-org-card ${expandedOrg === org.id ? 'ao-expanded' : ''}`}>
            <div className="ao-org-header" onClick={() => toggleOrg(org.id)}>
              <div className="ao-org-expand">
                {expandedOrg === org.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>
              <div className="ao-org-info">
                <div className="ao-org-name">
                  <Building2 size={16} />
                  {org.name}
                </div>
                <div className="ao-org-meta">
                  {org.craRole && <span className="ao-tag ao-tag-role">{CRA_ROLE_LABELS[org.craRole] || org.craRole}</span>}
                  {org.country && <span className="ao-tag">{org.country}</span>}
                  {org.industry && <span className="ao-tag">{org.industry}</span>}
                  {org.companySize && <span className="ao-tag">{org.companySize}</span>}
                </div>
              </div>
              <div className="ao-org-stats">
                <div className="ao-mini-stat" title="Users">
                  <Users size={14} /> {org.userCount}
                </div>
                <div className="ao-mini-stat" title="Products">
                  <Package size={14} /> {org.productCount}
                </div>
                {org.vulnerabilities.open > 0 && (
                  <div className="ao-mini-stat ao-vuln-stat" title="Open vulnerabilities">
                    <AlertTriangle size={14} /> {org.vulnerabilities.open}
                  </div>
                )}
                <div className="ao-mini-stat ao-activity" title="Last activity">
                  {timeAgo(org.lastActivity)}
                </div>
              </div>
            </div>

            {expandedOrg === org.id && (
              <div className="ao-org-detail">
                {detailLoading ? (
                  <div className="ao-detail-loading"><Loader size={20} className="ao-spinner" /></div>
                ) : orgDetail ? (
                  <div className="ao-detail-grid">
                    {/* Users section */}
                    <div className="ao-detail-section">
                      <h4><Users size={16} /> Users ({orgDetail.users.length})</h4>
                      <div className="ao-detail-table">
                        {orgDetail.users.map(u => (
                          <div key={u.id} className="ao-user-row">
                            <span className="ao-user-email">{u.email}</span>
                            <span className="ao-user-role">{u.orgRole}</span>
                            {u.isPlatformAdmin && <span className="ao-badge ao-badge-admin"><Shield size={12} /> Admin</span>}
                            {u.emailVerified && <span className="ao-badge ao-badge-verified"><CheckCircle size={12} /></span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Products section */}
                    <div className="ao-detail-section">
                      <h4><Package size={16} /> Products ({orgDetail.products.length})</h4>
                      <div className="ao-detail-table">
                        {orgDetail.products.map(p => (
                          <div key={p.id} className="ao-product-row">
                            <div className="ao-product-main">
                              <span className="ao-product-name">{p.name}</span>
                              <span className={`ao-cat-badge ao-cat-${p.category}`}>{CATEGORY_LABELS[p.category] || p.category}</span>
                              {p.lifecycle && <span className="ao-tag ao-tag-sm">{p.lifecycle}</span>}
                            </div>
                            <div className="ao-product-stats">
                              {p.hasRepo && (
                                <span className="ao-ps-item" title="Repository">
                                  <ExternalLink size={12} /> {p.repoFullName}
                                </span>
                              )}
                              <span className="ao-ps-item" title="Contributors">{p.contributors} contrib</span>
                              <span className="ao-ps-item" title="Dependencies">{p.dependencies} deps</span>
                              <span className="ao-ps-item" title="Tech file progress">
                                <FileText size={12} /> {p.techFile.completed}/{p.techFile.total}
                              </span>
                              {p.vulnerabilities.open > 0 && (
                                <span className="ao-ps-item ao-ps-vuln">
                                  <AlertTriangle size={12} /> {p.vulnerabilities.open} open
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {orgDetail.products.length === 0 && (
                          <div className="ao-empty-detail">No products registered</div>
                        )}
                      </div>
                    </div>

                    {/* Recent events */}
                    <div className="ao-detail-section ao-detail-full">
                      <h4>Recent Activity ({orgDetail.recentEvents.length})</h4>
                      <div className="ao-events-list">
                        {orgDetail.recentEvents.slice(0, 10).map((ev, i) => (
                          <div key={i} className="ao-event-row">
                            <span className="ao-event-type">{ev.eventType.replace(/_/g, ' ')}</span>
                            <span className="ao-event-user">{ev.userEmail}</span>
                            <span className="ao-event-time">{timeAgo(ev.createdAt)}</span>
                          </div>
                        ))}
                        {orgDetail.recentEvents.length === 0 && (
                          <div className="ao-empty-detail">No recent activity</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ao-detail-loading">Failed to load details</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
