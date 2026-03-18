import { useState, useEffect, useCallback } from 'react';
import { Mail, ShieldAlert, Loader2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminWelcomeLeadsPage.css';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  position: string | null;
  status: string;
  lead_notified: boolean;
  lead_notify_error: string | null;
  ip: string | null;
  country: string | null;
  user_agent: string | null;
  created_at: string;
  verified_at: string | null;
  updated_at: string;
}

interface ContactStats {
  total: string;
  pending: string;
  verified: string;
  notified: string;
  failed: string;
}

interface DisposableEntry {
  id: string;
  email: string;
  name: string | null;
  domain: string;
  ip: string | null;
  country: string | null;
  user_agent: string | null;
  source: string;
  created_at: string;
}

interface DomainStat {
  domain: string;
  count: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

type TabId = 'submissions' | 'honeypot';

const STATUS_BADGE: Record<string, string> = {
  pending_verification: 'awl-badge-amber',
  verified: 'awl-badge-blue',
  lead_notified: 'awl-badge-green',
  lead_failed: 'awl-badge-red',
};

const STATUS_LABELS: Record<string, string> = {
  pending_verification: 'Pending',
  verified: 'Verified',
  lead_notified: 'Notified',
  lead_failed: 'Failed',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminWelcomeLeadsPage() {
  usePageMeta();
  const [activeTab, setActiveTab] = useState<TabId>('submissions');
  const [loading, setLoading] = useState(true);

  // Submissions state
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [subPagination, setSubPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [emailSearch, setEmailSearch] = useState('');

  // Honeypot state
  const [entries, setEntries] = useState<DisposableEntry[]>([]);
  const [domainStats, setDomainStats] = useState<DomainStat[]>([]);
  const [hpPagination, setHpPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, pages: 0 });
  const [sourceFilter, setSourceFilter] = useState('');

  const token = localStorage.getItem('session_token');

  const fetchSubmissions = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (emailSearch) params.set('email', emailSearch);

      const res = await fetch(`/api/admin/contact-submissions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions);
        setStats(data.stats);
        setSubPagination(data.pagination);
      }
    } catch { /* silent */ }
  }, [token, statusFilter, emailSearch]);

  const fetchHoneypot = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (sourceFilter) params.set('source', sourceFilter);

      const res = await fetch(`/api/admin/disposable-email-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setDomainStats(data.domainStats);
        setHpPagination(data.pagination);
      }
    } catch { /* silent */ }
  }, [token, sourceFilter]);

  useEffect(() => {
    Promise.all([fetchSubmissions(), fetchHoneypot()]).finally(() => setLoading(false));
  }, [fetchSubmissions, fetchHoneypot]);

  if (loading) {
    return (
      <div className="awl-loading">
        <Loader2 size={32} className="spin" />
        <span>Loading welcome leads data...</span>
      </div>
    );
  }

  return (
    <div className="awl-page">
      <PageHeader title="Welcome Leads" />

      {stats && (
        <div className="stat-grid">
          <StatCard label="Total Submissions" value={parseInt(stats.total)} color="blue" />
          <StatCard label="Pending Verification" value={parseInt(stats.pending)} color="amber" />
          <StatCard label="Lead Notified" value={parseInt(stats.notified)} color="green" />
          <StatCard label="Notification Failed" value={parseInt(stats.failed)} color="red" />
        </div>
      )}

      <div className="awl-tabs">
        <button className={`awl-tab ${activeTab === 'submissions' ? 'active' : ''}`} onClick={() => setActiveTab('submissions')}>
          <Mail size={14} /> Contact Submissions
        </button>
        <button className={`awl-tab ${activeTab === 'honeypot' ? 'active' : ''}`} onClick={() => setActiveTab('honeypot')}>
          <ShieldAlert size={14} /> Disposable Email Log
        </button>
      </div>

      {activeTab === 'submissions' && (
        <>
          <div className="awl-filters">
            <input
              className="awl-search"
              type="text"
              placeholder="Search by email..."
              value={emailSearch}
              onChange={e => setEmailSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchSubmissions(1)}
            />
            {['', 'pending_verification', 'verified', 'lead_notified', 'lead_failed'].map(s => (
              <button
                key={s}
                className={`awl-filter-btn ${statusFilter === s ? 'active' : ''}`}
                onClick={() => { setStatusFilter(s); }}
              >
                {s ? (STATUS_LABELS[s] || s) : 'All'}
              </button>
            ))}
          </div>

          <div className="awl-table-wrap">
            <table className="awl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Country</th>
                  <th>Lead Error</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr><td colSpan={7} className="awl-empty">No submissions found</td></tr>
                ) : submissions.map(sub => (
                  <tr key={sub.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(sub.created_at)}</td>
                    <td>{sub.name}</td>
                    <td className="awl-mono">{sub.email}</td>
                    <td>{sub.position || '–'}</td>
                    <td>
                      <span className={`awl-badge ${STATUS_BADGE[sub.status] || 'awl-badge-muted'}`}>
                        {STATUS_LABELS[sub.status] || sub.status}
                      </span>
                    </td>
                    <td>{sub.country || '–'}</td>
                    <td className="awl-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {sub.lead_notify_error || '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="awl-pagination">
            <span>
              Showing {submissions.length} of {subPagination.total} submissions
              {subPagination.pages > 1 && ` · Page ${subPagination.page} of ${subPagination.pages}`}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={subPagination.page <= 1}
                onClick={() => fetchSubmissions(subPagination.page - 1)}
              >
                Previous
              </button>
              <button
                disabled={subPagination.page >= subPagination.pages}
                onClick={() => fetchSubmissions(subPagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'honeypot' && (
        <>
          {domainStats.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
                Top Disposable Domains
              </h3>
              <div className="awl-domain-grid">
                {domainStats.map(d => (
                  <div key={d.domain} className="awl-domain-card">
                    <span className="awl-domain-name">{d.domain}</span>
                    <span className="awl-domain-count">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="awl-filters">
            {['', 'contact', 'subscribe'].map(s => (
              <button
                key={s}
                className={`awl-filter-btn ${sourceFilter === s ? 'active' : ''}`}
                onClick={() => { setSourceFilter(s); }}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Sources'}
              </button>
            ))}
          </div>

          <div className="awl-table-wrap">
            <table className="awl-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Domain</th>
                  <th>Source</th>
                  <th>Country</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={7} className="awl-empty">No disposable email attempts detected</td></tr>
                ) : entries.map(entry => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(entry.created_at)}</td>
                    <td className="awl-mono">{entry.email}</td>
                    <td>{entry.name || '–'}</td>
                    <td className="awl-mono">{entry.domain}</td>
                    <td>
                      <span className={`awl-badge ${entry.source === 'contact' ? 'awl-badge-blue' : 'awl-badge-amber'}`}>
                        {entry.source}
                      </span>
                    </td>
                    <td>{entry.country || '–'}</td>
                    <td className="awl-mono" style={{ fontSize: '0.72rem' }}>{entry.ip || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="awl-pagination">
            <span>
              Showing {entries.length} of {hpPagination.total} entries
              {hpPagination.pages > 1 && ` · Page ${hpPagination.page} of ${hpPagination.pages}`}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                disabled={hpPagination.page <= 1}
                onClick={() => fetchHoneypot(hpPagination.page - 1)}
              >
                Previous
              </button>
              <button
                disabled={hpPagination.page >= hpPagination.pages}
                onClick={() => fetchHoneypot(hpPagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
