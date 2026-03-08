import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { Download, FileText, Loader2 } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './DocumentTemplatesPage.css';

interface DocumentTemplate {
  id: string;
  title: string;
  craArticle: string;
  description: string;
  techFileSection: string;
  filename: string;
}

function authHeaders() {
  const token = localStorage.getItem('session_token');
  return { Authorization: `Bearer ${token}` };
}

export default function DocumentTemplatesPage() {
  usePageMeta({ title: 'Document Templates' });
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/document-templates', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { setTemplates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDownload(template: DocumentTemplate) {
    setDownloading(template.id);
    try {
      const res = await fetch(`/api/document-templates/${template.id}/download`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download failed:', err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="document-templates-page">
      <PageHeader title="Document Templates" />
      <p className="dt-intro">
        Download CRA compliance document templates to help meet your regulatory obligations.
        Each template includes instructions on how to populate it and where to store the
        completed document within your CRANIS2 Tech File.
      </p>

      {loading ? (
        <div className="dt-loading"><Loader2 className="spin" size={20} /> Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="dt-empty">No templates available yet.</div>
      ) : (
        <div className="dt-grid">
          {templates.map(t => (
            <div key={t.id} className="dt-card">
              <div className="dt-card-icon"><FileText size={28} /></div>
              <div className="dt-card-body">
                <h3 className="dt-card-title">{t.title}</h3>
                <div className="dt-card-meta">
                  <span className="dt-badge dt-badge-article">{t.craArticle}</span>
                  <span className="dt-badge dt-badge-section">{t.techFileSection}</span>
                </div>
                <p className="dt-card-desc">{t.description}</p>
                <div className="dt-card-footer">
                  <span className="dt-card-format">Markdown (.md)</span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDownload(t)}
                    disabled={downloading === t.id}
                  >
                    {downloading === t.id ? (
                      <><Loader2 size={14} className="spin" /> Downloading…</>
                    ) : (
                      <><Download size={14} /> Download Template</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
