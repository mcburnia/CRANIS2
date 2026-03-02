import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { FileText, Save, Loader, Check, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminDocsPage.css';

interface DocPage {
  slug: string;
  title: string;
  content: string;
  updated_at: string | null;
  updated_by_email: string | null;
}

interface DocListItem {
  slug: string;
  title: string;
  updated_at: string | null;
}

export default function AdminDocsPage() {
  usePageMeta();
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [activeSlug, setActiveSlug] = useState('user-guide');
  const [doc, setDoc] = useState<DocPage | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const token = localStorage.getItem('session_token');

  // Fetch doc list
  useEffect(() => {
    fetch('/api/docs')
      .then(r => r.json())
      .then(data => setDocs(data.docs || []))
      .catch(() => {});
  }, []);

  // Fetch selected doc
  useEffect(() => {
    setLoading(true);
    setSaveStatus('idle');
    fetch(`/api/docs/${activeSlug}`)
      .then(r => r.json())
      .then(data => {
        setDoc(data);
        setEditTitle(data.title || '');
        setEditContent(data.content || '');
        setHasChanges(false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeSlug]);

  // Track unsaved changes
  useEffect(() => {
    if (!doc) return;
    const changed = editTitle !== doc.title || editContent !== doc.content;
    setHasChanges(changed);
  }, [editTitle, editContent, doc]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (saving || !hasChanges) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/docs/${activeSlug}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json();
      setDoc(prev => prev ? { ...prev, title: editTitle, content: editContent, updated_at: updated.updated_at } : prev);
      setHasChanges(false);
      setSaveStatus('success');
      // Update the doc list title
      setDocs(prev => prev.map(d => d.slug === activeSlug ? { ...d, title: editTitle, updated_at: updated.updated_at } : d));
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
    setSaving(false);
  }, [saving, hasChanges, activeSlug, editTitle, editContent, token]);

  // Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Handle tab switching with unsaved changes
  const switchDoc = (slug: string) => {
    if (slug === activeSlug) return;
    if (hasChanges) {
      const confirm = window.confirm('You have unsaved changes. Discard and switch page?');
      if (!confirm) return;
    }
    setActiveSlug(slug);
  };

  return (
    <div className="admin-docs">
      <PageHeader title="Documentation" />

      {/* Doc selector tabs */}
      <div className="adoc-tabs">
        {docs.map(d => (
          <button
            key={d.slug}
            className={`adoc-tab${activeSlug === d.slug ? ' adoc-tab-active' : ''}`}
            onClick={() => switchDoc(d.slug)}
          >
            <FileText size={15} />
            {d.title}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="adoc-loading">
          <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--purple)' }} />
        </div>
      ) : (
        <>
          {/* Title editor */}
          <div className="adoc-title-row">
            <label className="adoc-title-label">Page Title</label>
            <input
              className="adoc-title-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Page title..."
            />
          </div>

          {/* Toolbar */}
          <div className="adoc-toolbar">
            <div className="adoc-toolbar-left">
              <span className="adoc-label-editor">Markdown</span>
              <span className="adoc-label-preview">Preview</span>
            </div>
            <div className="adoc-toolbar-right">
              {doc?.updated_at && (
                <span className="adoc-last-updated">
                  Last saved: {new Date(doc.updated_at).toLocaleString()}
                  {doc.updated_by_email && ` by ${doc.updated_by_email}`}
                </span>
              )}
              {hasChanges && (
                <span className="adoc-unsaved-badge">
                  <AlertCircle size={13} /> Unsaved changes
                </span>
              )}
              <button
                className={`adoc-save-btn${saveStatus === 'success' ? ' success' : saveStatus === 'error' ? ' error' : ''}`}
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? (
                  <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                ) : saveStatus === 'success' ? (
                  <><Check size={14} /> Saved</>
                ) : (
                  <><Save size={14} /> Save</>
                )}
              </button>
            </div>
          </div>

          {/* Split-pane editor + preview */}
          <div className="adoc-split">
            <div className="adoc-editor-pane">
              <textarea
                ref={textareaRef}
                className="adoc-textarea"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                spellCheck={false}
                placeholder="Write your markdown here..."
              />
            </div>
            <div className="adoc-preview-pane">
              <div className="doc-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                  {editContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
