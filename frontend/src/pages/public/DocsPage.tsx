import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Book, HelpCircle, ChevronRight, ArrowUp, Menu, X, Loader, Shield, Code } from 'lucide-react';
import GithubSlugger from 'github-slugger';
import { usePageMeta } from '../../hooks/usePageMeta';
import './DocsPage.css';

/* ── Types ── */

interface TocItem {
  level: number;
  text: string;
  id: string;
}

/* ── Heading parser ── */

function parseHeadings(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const headings: TocItem[] = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      /* Strip markdown inline formatting for display */
      const text = match[2]
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .trim();
      const id = slugger.slug(text);
      headings.push({ level, text, id });
    }
  }
  return headings;
}

/* ── Component ── */

export default function DocsPage() {
  usePageMeta();
  const location = useLocation();
  const { slug: routeSlug } = useParams<{ slug?: string }>();

  /* Map route to API slug */
  const slug = routeSlug || 'user-guide';
  const isFaq = slug === 'faq';
  const isLegal = slug === 'privacy-policy' || slug === 'terms-of-service';

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  /* Fetch content from API */
  useEffect(() => {
    setLoading(true);
    fetch(`/api/docs/${slug}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content || '');
        setLoading(false);
      })
      .catch(() => {
        setContent('');
        setLoading(false);
      });
  }, [slug]);

  const headings = useMemo(() => parseHeadings(content), [content]);

  /* Only show h2 + h3 in the TOC (h1 is the page title) */
  const tocItems = useMemo(() => headings.filter((h) => h.level >= 2), [headings]);

  const [activeId, setActiveId] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'admin' | 'contributor'>('all');

  /* Scroll to hash on mount or route change */
  useEffect(() => {
    if (loading) return;
    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 150);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.hash, location.pathname, loading]);

  /* Track which heading is in view via IntersectionObserver */
  useEffect(() => {
    if (loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );

    const headingEls = document.querySelectorAll(
      '.doc-content h1[id], .doc-content h2[id], .doc-content h3[id]',
    );
    headingEls.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [content, loading]);

  /* Close mobile TOC on route change */
  useEffect(() => {
    setTocOpen(false);
  }, [location.pathname]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="doc-page">
      {/* ── Top navigation ── */}
      <nav className="doc-nav">
        <Link to="/" className="doc-nav-logo">
          CRANIS<span>2</span>
        </Link>

        <div className="doc-nav-tabs">
          <Link
            to="/docs"
            className={`doc-nav-tab${slug === 'user-guide' ? ' doc-nav-tab-active' : ''}`}
          >
            <Book size={16} />
            User Guide
          </Link>
          <Link
            to="/docs/faq"
            className={`doc-nav-tab${isFaq ? ' doc-nav-tab-active' : ''}`}
          >
            <HelpCircle size={16} />
            FAQ
          </Link>
        </div>

        <div className="doc-nav-links">
          <Link to="/trust-centre">Trust Centre</Link>
          <Link to="/login">Log In</Link>
          <Link to="/signup" className="btn btn-primary">
            Try CRANIS2
          </Link>
        </div>

        <button
          className="doc-toc-toggle"
          onClick={() => setTocOpen(!tocOpen)}
          aria-label="Toggle table of contents"
        >
          {tocOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* ── Layout: sidebar + content ── */}
      <div className="doc-layout">
        {/* TOC sidebar */}
        <aside className={`doc-toc${tocOpen ? ' doc-toc-open' : ''}`}>
          <div className="doc-toc-header">
            {isFaq ? 'FAQ Topics' : slug === 'privacy-policy' ? 'Privacy Policy' : slug === 'terms-of-service' ? 'Terms of Service' : 'Contents'}
          </div>

          {/* Audience filter (User Guide only) */}
          {!isFaq && !isLegal && (
            <div className="doc-audience-filter">
              <button
                className={`doc-audience-btn${audienceFilter === 'all' ? ' doc-audience-active' : ''}`}
                onClick={() => setAudienceFilter('all')}
              >
                All
              </button>
              <button
                className={`doc-audience-btn${audienceFilter === 'admin' ? ' doc-audience-active' : ''}`}
                onClick={() => setAudienceFilter('admin')}
              >
                <Shield size={12} /> Admin
              </button>
              <button
                className={`doc-audience-btn${audienceFilter === 'contributor' ? ' doc-audience-active' : ''}`}
                onClick={() => setAudienceFilter('contributor')}
              >
                <Code size={12} /> Contributor
              </button>
            </div>
          )}

          <nav className="doc-toc-nav">
            {tocItems.map((h) => {
              /* Apply audience filtering for User Guide TOC group headings */
              if (!isFaq && audienceFilter !== 'all' && h.level === 3) {
                const lower = h.text.toLowerCase();
                if (audienceFilter === 'admin' && lower.includes('(contributor)')) return null;
                if (audienceFilter === 'contributor' && lower.includes('(admin)')) return null;
              }
              return (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className={`doc-toc-item doc-toc-level-${h.level}${
                    activeId === h.id ? ' doc-toc-active' : ''
                  }`}
                  onClick={() => setTocOpen(false)}
                >
                  {h.level === 3 && (
                    <ChevronRight size={12} className="doc-toc-chevron" />
                  )}
                  {h.text}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Overlay for mobile TOC */}
        {tocOpen && (
          <div className="doc-toc-overlay" onClick={() => setTocOpen(false)} />
        )}

        {/* Main content */}
        <main className="doc-content">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
              <Loader size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
              {content}
            </ReactMarkdown>
          )}
        </main>
      </div>

      {/* Back to top */}
      <button className="doc-back-to-top" onClick={scrollToTop} title="Back to top">
        <ArrowUp size={20} />
      </button>

      {/* Footer */}
      <footer className="doc-footer">
        CRANIS2 &copy; 2026 &middot; Software Compliance &amp; Governance Platform
        &middot; EU hosted, customer-owned evidence
        <div className="doc-footer-links">
          <Link to="/docs/privacy-policy">Privacy Policy</Link>
          <span>&middot;</span>
          <Link to="/docs/terms-of-service">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
