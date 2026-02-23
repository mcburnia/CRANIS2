import { useState, useEffect } from 'react';
import { MessageSquare, Bug, Lightbulb, Loader, ChevronLeft, ChevronRight, CheckCircle2, Eye, Clock } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminFeedbackPage.css';

interface FeedbackItem {
  id: string;
  email: string;
  category: string;
  subject: string;
  body: string;
  page_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const CAT_ICONS: Record<string, typeof MessageSquare> = { feedback: MessageSquare, bug: Bug, feature: Lightbulb };
const CAT_COLORS: Record<string, string> = { feedback: 'var(--accent)', bug: 'var(--red)', feature: 'var(--amber)' };
const STATUS_COLORS: Record<string, string> = { new: 'var(--accent)', reviewed: 'var(--amber)', resolved: 'var(--green)' };

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

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ new: 0, reviewed: 0, resolved: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { fetchFeedback(1); }, [filterStatus]);

  async function fetchFeedback(page: number) {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/admin/feedback?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(data.feedback);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch { /* */ }
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    const token = localStorage.getItem('session_token');
    await fetch(`/api/admin/feedback/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchFeedback(pagination.page);
  }

  return (
    <div className="admin-feedback">
      <PageHeader title="User Feedback" />

      <div className="afb-stat-cards">
        <StatCard label="New" value={summary.new || 0} color={summary.new > 0 ? 'blue' : undefined} />
        <StatCard label="Reviewed" value={summary.reviewed || 0} />
        <StatCard label="Resolved" value={summary.resolved || 0} color="green" />
        <StatCard label="Total" value={pagination.total} />
      </div>

      <div className="afb-controls">
        <select className="afb-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="afb-list">
        {loading ? (
          <div className="afb-loading"><Loader size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--purple)' }} /></div>
        ) : items.length === 0 ? (
          <div className="afb-empty">No feedback yet</div>
        ) : (
          items.map(item => {
            const CatIcon = CAT_ICONS[item.category] || MessageSquare;
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} className={`afb-item ${isExpanded ? 'expanded' : ''}`}>
                <div className="afb-item-header" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                  <CatIcon size={16} style={{ color: CAT_COLORS[item.category], flexShrink: 0 }} />
                  <span className="afb-cat-badge" style={{ color: CAT_COLORS[item.category], background: `color-mix(in srgb, ${CAT_COLORS[item.category]} 12%, transparent)` }}>
                    {item.category}
                  </span>
                  <span className="afb-subject">{item.subject}</span>
                  <span className="afb-email">{item.email}</span>
                  <span className="afb-time" title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</span>
                  <span className="afb-status-badge" style={{ color: STATUS_COLORS[item.status], background: `color-mix(in srgb, ${STATUS_COLORS[item.status]} 12%, transparent)` }}>
                    {item.status}
                  </span>
                </div>
                {isExpanded && (
                  <div className="afb-item-body">
                    <div className="afb-body-text">{item.body}</div>
                    {item.page_url && <div className="afb-page-url">Page: {item.page_url}</div>}
                    <div className="afb-item-actions">
                      {item.status === 'new' && (
                        <button className="afb-action-btn reviewed" onClick={() => updateStatus(item.id, 'reviewed')}>
                          <Eye size={13} /> Mark Reviewed
                        </button>
                      )}
                      {item.status !== 'resolved' && (
                        <button className="afb-action-btn resolved" onClick={() => updateStatus(item.id, 'resolved')}>
                          <CheckCircle2 size={13} /> Mark Resolved
                        </button>
                      )}
                      {item.status === 'resolved' && (
                        <button className="afb-action-btn reopen" onClick={() => updateStatus(item.id, 'new')}>
                          <Clock size={13} /> Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="afb-pagination">
          <button className="afb-page-btn" disabled={pagination.page <= 1} onClick={() => fetchFeedback(pagination.page - 1)}>
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="afb-page-info">Page {pagination.page} of {pagination.totalPages}</span>
          <button className="afb-page-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchFeedback(pagination.page + 1)}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
