/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * CryptoInventoryTab — Cryptographic Standards & Quantum Readiness Inventory.
 *
 * Scans SBOM dependencies against a registry of known crypto libraries.
 * Findings are classified into three tiers:
 *   Broken (immediate action) | Quantum-vulnerable (plan migration) | Quantum-safe (no action)
 */

import { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, Loader2, Download, RefreshCw,
  ChevronDown, ChevronRight, Lock, Info,
} from 'lucide-react';

interface CryptoAlgorithm {
  name: string;
  type: string;
  tier: 'broken' | 'quantum_vulnerable' | 'quantum_safe';
  strengthBits?: number;
  fipsApproved: boolean;
  nistStatus: string;
  remediation?: string;
}

interface CryptoFinding {
  dependencyName: string;
  dependencyVersion: string;
  dependencyPurl: string;
  dependencyEcosystem: string;
  libraryDescription: string;
  algorithms: CryptoAlgorithm[];
  worstTier: 'broken' | 'quantum_vulnerable' | 'quantum_safe';
}

interface CryptoInventoryData {
  scanned: boolean;
  productId: string;
  scannedAt?: string;
  totalDependencies?: number;
  cryptoLibrariesFound?: number;
  registrySize: number;
  findings?: CryptoFinding[];
  summary?: {
    broken: number;
    quantumVulnerable: number;
    quantumSafe: number;
    totalAlgorithms: number;
  };
}

const TIER_CONFIG = {
  broken: {
    label: 'Broken',
    sublabel: 'Immediate action required',
    colour: 'var(--error, #ef4444)',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    icon: AlertTriangle,
  },
  quantum_vulnerable: {
    label: 'Quantum-Vulnerable',
    sublabel: 'Plan PQC migration',
    colour: 'var(--warning, #f59e0b)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    icon: Shield,
  },
  quantum_safe: {
    label: 'Quantum-Safe',
    sublabel: 'No action needed',
    colour: 'var(--success, #22c55e)',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    icon: CheckCircle2,
  },
};

const ALGO_TYPE_LABELS: Record<string, string> = {
  symmetric: 'Symmetric',
  asymmetric: 'Asymmetric',
  hash: 'Hash',
  kdf: 'KDF',
  mac: 'MAC',
  protocol: 'Protocol',
  pqc: 'Post-Quantum',
};

export default function CryptoInventoryTab({ productId }: { productId: string }) {
  const [data, setData] = useState<CryptoInventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  const token = localStorage.getItem('session_token');

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/products/${productId}/crypto-inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [productId]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`/api/products/${productId}/crypto-inventory/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/products/${productId}/crypto-inventory/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'crypto-inventory.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const toggleFinding = (purl: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      next.has(purl) ? next.delete(purl) : next.add(purl);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loader2 size={24} className="spin" />
      </div>
    );
  }

  // Not yet scanned
  if (!data?.scanned) {
    return (
      <div className="pd-placeholder">
        <Lock size={48} style={{ opacity: 0.5 }} />
        <h3>Cryptographic Standards & Quantum Readiness</h3>
        <p>
          Scan your dependencies against a registry of {data?.registrySize || '45+'} known cryptographic
          libraries to identify deprecated algorithms (SHA-1, MD5, DES) and quantum-vulnerable
          primitives (RSA, ECDSA, ECDH) that will need migration to post-quantum standards.
        </p>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
          CRA Annex I, Part I, §3 requires state-of-the-art cryptographic mechanisms.
        </p>
        <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
          {scanning ? <><Loader2 size={16} className="spin" /> Scanning...</> : <><Lock size={16} /> Run Crypto Scan</>}
        </button>
      </div>
    );
  }

  const { summary, findings = [], totalDependencies = 0, cryptoLibrariesFound = 0, scannedAt, registrySize } = data;

  const brokenFindings = findings.filter(f => f.worstTier === 'broken');
  const qvFindings = findings.filter(f => f.worstTier === 'quantum_vulnerable');
  const qsFindings = findings.filter(f => f.worstTier === 'quantum_safe');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            <Lock size={18} style={{ marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
            Cryptographic Standards & Quantum Readiness
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
            {cryptoLibrariesFound} crypto {cryptoLibrariesFound === 1 ? 'library' : 'libraries'} found
            in {totalDependencies} {totalDependencies === 1 ? 'dependency' : 'dependencies'}
            {scannedAt && <> — scanned {new Date(scannedAt).toLocaleDateString()}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleScan} disabled={scanning} title="Re-scan">
            {scanning ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Re-scan
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} title="Export Markdown report">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {(['broken', 'quantum_vulnerable', 'quantum_safe'] as const).map(tier => {
            const config = TIER_CONFIG[tier];
            const count = tier === 'broken' ? summary.broken : tier === 'quantum_vulnerable' ? summary.quantumVulnerable : summary.quantumSafe;
            const Icon = config.icon;
            return (
              <div key={tier} style={{
                background: config.bg,
                border: `1px solid ${config.border}`,
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Icon size={24} style={{ color: config.colour, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: config.colour }}>{count}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{config.label}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{config.sublabel}</div>
                </div>
              </div>
            );
          })}
          <div style={{
            background: 'rgba(96,165,250,0.08)',
            border: '1px solid rgba(96,165,250,0.25)',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <Info size={24} style={{ color: 'var(--primary, #60a5fa)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary, #60a5fa)' }}>{summary.totalAlgorithms}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Algorithms</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Unique detected</div>
            </div>
          </div>
        </div>
      )}

      {/* No crypto findings */}
      {findings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.7 }}>
          <CheckCircle2 size={32} style={{ color: 'var(--success, #22c55e)', marginBottom: '0.5rem' }} />
          <p>No known cryptographic libraries detected in your dependencies.</p>
          <p style={{ fontSize: '0.85rem' }}>
            Registry covers {registrySize} libraries. If your product uses crypto via platform APIs
            (e.g. Node.js <code>crypto</code> module), those are not detected via SBOM scanning.
          </p>
        </div>
      )}

      {/* Tier sections */}
      {brokenFindings.length > 0 && (
        <TierSection tier="broken" findings={brokenFindings} expandedFindings={expandedFindings} onToggle={toggleFinding} />
      )}
      {qvFindings.length > 0 && (
        <TierSection tier="quantum_vulnerable" findings={qvFindings} expandedFindings={expandedFindings} onToggle={toggleFinding} />
      )}
      {qsFindings.length > 0 && (
        <TierSection tier="quantum_safe" findings={qsFindings} expandedFindings={expandedFindings} onToggle={toggleFinding} />
      )}

      {/* CRA reference footer */}
      <div style={{
        fontSize: '0.8rem',
        opacity: 0.6,
        borderTop: '1px solid var(--border, rgba(255,255,255,0.1))',
        paddingTop: '1rem',
        lineHeight: 1.6,
      }}>
        <strong>CRA references:</strong> Art. 13(3) component currency, Annex I Part I §3 state-of-the-art cryptography.{' '}
        <strong>NIST:</strong> SP 800-131A Rev 2 (algorithm transitions), FIPS 203/204/205 (ML-KEM, ML-DSA, SLH-DSA).{' '}
        Registry: {registrySize} libraries across 8 ecosystems.
      </div>
    </div>
  );
}

// ─── Tier Section ────────────────────────────────────────────────────

function TierSection({ tier, findings, expandedFindings, onToggle }: {
  tier: 'broken' | 'quantum_vulnerable' | 'quantum_safe';
  findings: CryptoFinding[];
  expandedFindings: Set<string>;
  onToggle: (purl: string) => void;
}) {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  return (
    <div style={{
      border: `1px solid ${config.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        background: config.bg,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: `1px solid ${config.border}`,
      }}>
        <Icon size={16} style={{ color: config.colour }} />
        <span style={{ fontWeight: 600, color: config.colour }}>{config.label}</span>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          — {findings.length} {findings.length === 1 ? 'library' : 'libraries'} ({config.sublabel.toLowerCase()})
        </span>
      </div>

      {findings.map(finding => {
        const isExpanded = expandedFindings.has(finding.dependencyPurl);
        const brokenAlgs = finding.algorithms.filter(a => a.tier === 'broken');
        const qvAlgs = finding.algorithms.filter(a => a.tier === 'quantum_vulnerable');
        const safeAlgs = finding.algorithms.filter(a => a.tier === 'quantum_safe');

        return (
          <div key={finding.dependencyPurl} style={{ borderBottom: `1px solid ${config.border}` }}>
            <button
              onClick={() => onToggle(finding.dependencyPurl)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                textAlign: 'left',
                fontSize: '0.9rem',
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ fontWeight: 600 }}>{finding.dependencyName}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{finding.dependencyVersion}</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.06)',
                marginLeft: 'auto',
              }}>
                {finding.dependencyEcosystem}
              </span>
            </button>

            {isExpanded && (
              <div style={{ padding: '0 1rem 1rem 2.5rem' }}>
                <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: '0 0 0.75rem' }}>{finding.libraryDescription}</p>

                {brokenAlgs.length > 0 && (
                  <AlgorithmGroup label="Broken" colour="var(--error, #ef4444)" algorithms={brokenAlgs} />
                )}
                {qvAlgs.length > 0 && (
                  <AlgorithmGroup label="Quantum-Vulnerable" colour="var(--warning, #f59e0b)" algorithms={qvAlgs} />
                )}
                {safeAlgs.length > 0 && (
                  <AlgorithmGroup label="Quantum-Safe" colour="var(--success, #22c55e)" algorithms={safeAlgs} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Algorithm Group ─────────────────────────────────────────────────

function AlgorithmGroup({ label, colour, algorithms }: {
  label: string;
  colour: string;
  algorithms: CryptoAlgorithm[];
}) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colour, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {algorithms.map(alg => (
          <div key={alg.name} style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            fontSize: '0.85rem',
            padding: '0.25rem 0',
          }}>
            <span style={{ fontWeight: 600 }}>{alg.name}</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '1px 4px',
              borderRadius: '3px',
              background: 'rgba(255,255,255,0.06)',
            }}>
              {ALGO_TYPE_LABELS[alg.type] || alg.type}
            </span>
            {alg.strengthBits && (
              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{alg.strengthBits}-bit</span>
            )}
            {alg.fipsApproved && (
              <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34,197,94,0.15)', color: 'var(--success, #22c55e)' }}>FIPS</span>
            )}
            {alg.remediation && (
              <span style={{ fontSize: '0.75rem', opacity: 0.7, fontStyle: 'italic' }}>→ {alg.remediation}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
