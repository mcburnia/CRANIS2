import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePageMeta } from '../../hooks/usePageMeta';

interface ProductRow {
  id: string;
  name: string;
  craCategory: string | null;
  obligations: { total: number; met: number; inProgress: number; notStarted: number };
  technicalFile: { totalSections: number; completeSections: number; percentComplete: number };
  vulnerabilities: { lastScannedAt: string; total: number; critical: number; high: number; medium: number; low: number } | null;
  craReports: { total: number; draft: number; submitted: number };
}

interface ReportData {
  orgName: string;
  generatedAt: string;
  products: ProductRow[];
}

function craLabel(cat: string | null) {
  const labels: Record<string, string> = {
    default: 'Default',
    important_i: 'Important I',
    important_ii: 'Important II',
    critical: 'Critical',
  };
  return labels[cat ?? 'default'] ?? cat ?? 'Default';
}

function fmtDate(d: string | null) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function defaultFrom() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function ComplianceSummaryReport() {
  usePageMeta();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState('');

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/compliance-summary?from=${from}&to=${to}`, { headers });
      if (!res.ok) throw new Error('Failed to load report data');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  async function download(format: 'pdf' | 'csv') {
    setExporting(format);
    try {
      const res = await fetch(
        `/api/reports/compliance-summary/export?format=${format}&from=${from}&to=${to}`,
        { headers }
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-summary-${from}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <PageHeader title="Compliance Summary">
        <Link to="/reports" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)', textDecoration: 'none', fontSize: '0.875rem' }}>
          <ArrowLeft size={14} /> All Reports
        </Link>
      </PageHeader>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
          To
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.875rem' }} />
        </label>
        <button onClick={generate} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: loading ? 0.7 : 1 }}>
          {loading ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
          Generate Report
        </button>

        {data && (
          <>
            <button onClick={() => download('pdf')} disabled={exporting !== null}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
              {exporting === 'pdf' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
              Download PDF
            </button>
            <button onClick={() => download('csv')} disabled={exporting !== null}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: exporting ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
              {exporting === 'csv' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
              Download CSV
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--red)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {data && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {data.orgName} · Period: {fmtDate(from)} – {fmtDate(to)} · Generated {fmtDate(data.generatedAt)}
          </p>

          {data.products.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No products found for this organisation.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Product', 'CRA Category', 'Obligations', 'Tech File', 'Vulns (C/H)', 'CRA Reports'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.products.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 500, color: 'var(--text)' }}>{p.name}</td>
                      <td style={{ padding: '0.75rem', color: 'var(--muted)' }}>{craLabel(p.craCategory)}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ color: 'var(--text)' }}>{p.obligations.met}/{p.obligations.total} met</span>
                        {p.obligations.inProgress > 0 && (
                          <span style={{ marginLeft: 6, fontSize: '0.8rem', color: 'var(--amber)' }}>
                            {p.obligations.inProgress} in progress
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${p.technicalFile.percentComplete}%`, height: '100%', background: p.technicalFile.percentComplete === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 3 }} />
                          </div>
                          <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{p.technicalFile.percentComplete}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {p.vulnerabilities ? (
                          <span>
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{p.vulnerabilities.critical}</span>
                            {' / '}
                            <span style={{ color: '#f97316', fontWeight: 600 }}>{p.vulnerabilities.high}</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>No scan</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                        {p.craReports.total > 0
                          ? `${p.craReports.total} (${p.craReports.draft} draft)`
                          : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-product detail cards */}
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.products.map(p => (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', background: 'var(--surface)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' }}>
                  {p.name} <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.85rem' }}>– {craLabel(p.craCategory)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>Obligations</div>
                    <div style={{ color: 'var(--text)' }}>
                      {p.obligations.met} met · {p.obligations.inProgress} in progress · {p.obligations.notStarted} not started
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>Technical File</div>
                    <div style={{ color: 'var(--text)' }}>
                      {p.technicalFile.completeSections}/{p.technicalFile.totalSections} sections ({p.technicalFile.percentComplete}%)
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>Vulnerability Posture</div>
                    {p.vulnerabilities ? (
                      <div style={{ color: 'var(--text)' }}>
                        C:{p.vulnerabilities.critical} H:{p.vulnerabilities.high} M:{p.vulnerabilities.medium} L:{p.vulnerabilities.low}
                        <span style={{ color: 'var(--muted)', marginLeft: 6 }}>({fmtDate(p.vulnerabilities.lastScannedAt)})</span>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted)' }}>No scan in period</div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>ENISA Reports</div>
                    <div style={{ color: 'var(--text)' }}>
                      {p.craReports.total > 0
                        ? `${p.craReports.total} total · ${p.craReports.draft} draft · ${p.craReports.submitted} submitted`
                        : 'None in period'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
