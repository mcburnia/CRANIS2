/**
 * SoftwareEvidenceTab — Software Evidence Engine: Effort & Cost Estimation.
 *
 * Phase A: consent, LOC analysis, effort/cost estimates, executive summary, Markdown export.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, Shield, Loader2, Download, RefreshCw,
  FileCode, Users, Clock, DollarSign, AlertTriangle, CheckCircle2, Lock,
} from 'lucide-react';

interface EffortEstimate {
  low: number;
  mid: number;
  high: number;
}

interface LanguageData {
  loc: number;
  files: number;
  productionLoc: number;
  testLoc: number;
}

interface SEEData {
  scanned: boolean;
  id?: string;
  productId: string;
  scanStatus?: string;
  createdAt?: string;
  totalFiles?: number;
  totalLoc?: number;
  productionLoc?: number;
  testLoc?: number;
  configLoc?: number;
  generatedLoc?: number;
  vendorLoc?: number;
  docsLoc?: number;
  languageBreakdown?: Record<string, LanguageData>;
  effortMonths?: EffortEstimate;
  costEur?: EffortEstimate;
  teamSize?: EffortEstimate;
  rebuildMonths?: EffortEstimate;
  complexityCategory?: string;
  complexityMultiplier?: number;
  executiveSummary?: string;
  message?: string;
}

interface ConsentData {
  productId: string;
  sourceCodeConsent: boolean;
}

export default function SoftwareEvidenceTab({ productId }: { productId: string }) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [data, setData] = useState<SEEData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [consentUpdating, setConsentUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` } as Record<string, string>;

  const fetchConsent = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/see/consent`, { headers });
      if (res.ok) {
        const d: ConsentData = await res.json();
        setConsent(d.sourceCodeConsent);
      }
    } catch { /* ignore */ }
  }, [productId]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/see/estimate`, { headers });
      if (res.ok) {
        const d: SEEData = await res.json();
        setData(d);
      }
    } catch { /* ignore */ }
  }, [productId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchConsent(), fetchData()]).finally(() => setLoading(false));
  }, [fetchConsent, fetchData]);

  const handleConsentToggle = async () => {
    setConsentUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/see/consent`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: !consent }),
      });
      if (res.ok) {
        const d: ConsentData = await res.json();
        setConsent(d.sourceCodeConsent);
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to update consent');
      }
    } catch {
      setError('Failed to update consent');
    } finally {
      setConsentUpdating(false);
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/see/estimate`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const d: SEEData = await res.json();
        setData(d);
      } else {
        const err = await res.json();
        setError(err.message || err.error || 'Scan failed');
      }
    } catch {
      setError('Scan failed — check the repository connection');
    } finally {
      setScanning(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/products/${productId}/see/estimate/export`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 40, color: 'var(--text-3)' }}>
        <Loader2 size={16} className="spin" /> Loading Software Evidence Engine...
      </div>
    );
  }

  // ── Consent prompt ──────────────────────────────────────────────────
  if (!consent) {
    return (
      <div style={{ padding: '40px 0' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 32, maxWidth: 640, margin: '0 auto', textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#FAEEDA',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Lock size={24} color="#BA7517" />
          </div>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Source Code Analysis Requires Consent
          </h3>
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8 }}>
            The Software Evidence Engine analyses your repository's file structure and source code to estimate
            development effort and cost. This supports R&D tax credit evidence, due diligence, and compliance documentation.
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
            Source code is read via API for analysis but never stored. Only aggregated metrics (line counts,
            language breakdown, effort estimates) are retained. Results are stored immutably for audit purposes.
          </p>
          <button
            onClick={handleConsentToggle}
            disabled={consentUpdating}
            style={{
              background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', opacity: consentUpdating ? 0.6 : 1,
            }}
          >
            {consentUpdating ? 'Enabling...' : 'Enable Source Code Analysis'}
          </button>
          {error && <p style={{ color: 'var(--coral)', marginTop: 12, fontSize: 13 }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── No scan yet ─────────────────────────────────────────────────────
  if (!data?.scanned) {
    return (
      <div style={{ padding: '40px 0' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 32, maxWidth: 640, margin: '0 auto', textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#E1F5EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Calculator size={24} color="var(--teal)" />
          </div>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Ready to Analyse
          </h3>
          <p style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24 }}>
            Source code analysis is enabled. Run an estimate to analyse your repository's file structure,
            measure logical lines of code, and calculate engineering effort and cost ranges.
          </p>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{
              background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', opacity: scanning ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {scanning ? <><Loader2 size={14} className="spin" /> Analysing repository...</> : 'Run Effort Estimate'}
          </button>
          {error && <p style={{ color: 'var(--coral)', marginTop: 12, fontSize: 13 }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────
  const {
    totalLoc = 0, productionLoc = 0, testLoc = 0, configLoc = 0,
    generatedLoc = 0, vendorLoc = 0, docsLoc = 0, totalFiles = 0,
    languageBreakdown = {}, effortMonths, costEur, teamSize, rebuildMonths,
    complexityCategory, complexityMultiplier, executiveSummary, createdAt,
  } = data;

  const languages = Object.entries(languageBreakdown)
    .filter(([lang]) => !['JSON', 'YAML', 'XML', 'TOML'].includes(lang))
    .sort((a, b) => b[1].loc - a[1].loc);

  const testRatio = totalLoc > 0 ? Math.round(testLoc / totalLoc * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 16, fontWeight: 700, margin: 0 }}>
            Effort & Cost Estimate
          </h3>
          {createdAt && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Last analysed: {new Date(createdAt).toLocaleDateString('en-GB')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRunScan} disabled={scanning} style={btnStyle}>
            {scanning ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            {scanning ? 'Analysing...' : 'Re-analyse'}
          </button>
          <button onClick={handleExport} style={btnStyle}>
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FAECE7', border: '1px solid var(--coral)', borderRadius: 8, padding: '10px 16px', color: '#711E08', fontSize: 13 }}>
          <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <SummaryCard icon={<FileCode size={18} />} label="Production LOC" value={productionLoc.toLocaleString()} sub={`${totalLoc.toLocaleString()} total`} colour="#E1F5EE" />
        <SummaryCard icon={<Clock size={18} />} label="Effort Estimate" value={effortMonths ? `${effortMonths.low}–${effortMonths.high}` : '–'} sub="engineer-months" colour="#EEEDFE" />
        <SummaryCard icon={<DollarSign size={18} />} label="Cost Estimate" value={costEur ? `€${(costEur.low / 1000).toFixed(0)}k–€${(costEur.high / 1000).toFixed(0)}k` : '–'} sub="EUR range" colour="#FAEEDA" />
        <SummaryCard icon={<Users size={18} />} label="Team / Rebuild" value={teamSize ? `${teamSize.low}–${teamSize.high} people` : '–'} sub={rebuildMonths ? `${rebuildMonths.low}–${rebuildMonths.high} months` : ''} colour="#E6F1FB" />
      </div>

      {/* Complexity badge */}
      {complexityCategory && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Shield size={16} color="var(--teal)" />
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'var(--text-2)' }}>
            Complexity: <strong style={{ color: 'var(--text)' }}>{complexityCategory}</strong> ({complexityMultiplier}x multiplier)
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
            {totalFiles.toLocaleString()} files · {testRatio}% test code
          </span>
        </div>
      )}

      {/* Executive summary */}
      {executiveSummary && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20,
        }}>
          <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
            Executive Summary
          </h4>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-2)', whiteSpace: 'pre-line' }}>
            {executiveSummary}
          </p>
        </div>
      )}

      {/* Language breakdown */}
      {languages.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20,
        }}>
          <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
            Language Breakdown
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Outfit, sans-serif' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Language</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Files</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Production LOC</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Test LOC</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {languages.map(([lang, d]) => (
                <tr key={lang} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><strong>{lang}</strong></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{d.files}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{d.productionLoc.toLocaleString()}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{d.testLoc.toLocaleString()}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{totalLoc > 0 ? Math.round(d.loc / totalLoc * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Code classification */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20,
      }}>
        <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
          Code Classification
        </h4>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ClassificationBar label="Production" value={productionLoc} total={totalLoc} colour="var(--teal)" />
          <ClassificationBar label="Test" value={testLoc} total={totalLoc} colour="#534AB7" />
          <ClassificationBar label="Config" value={configLoc} total={totalLoc} colour="#BA7517" />
          <ClassificationBar label="Generated/Vendor" value={generatedLoc + vendorLoc} total={totalLoc} colour="var(--text-3)" />
          <ClassificationBar label="Documentation" value={docsLoc} total={totalLoc} colour="#185FA5" />
        </div>
      </div>

      {/* Consent revoke */}
      <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <CheckCircle2 size={12} /> Source code analysis enabled.
        <button
          onClick={handleConsentToggle}
          disabled={consentUpdating}
          style={{ background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
        >
          Revoke consent
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, colour }: { icon: React.ReactNode; label: string; value: string; sub: string; colour: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: colour,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)',
        }}>
          {icon}
        </div>
        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
      </div>
      <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
      <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>
    </div>
  );
}

function ClassificationBar({ label, value, total, colour }: { label: string; value: number; total: number; colour: string }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0;
  return (
    <div style={{ flex: '1 1 120px', minWidth: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span style={{ color: 'var(--text-3)' }}>{value.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: 'var(--gray-lt)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: colour, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '6px 14px', fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)',
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11,
  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px', color: 'var(--text-2)',
};
