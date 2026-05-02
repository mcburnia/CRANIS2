/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Package, AlertTriangle, GitBranch, CheckCircle2,
  RefreshCw, Users, Loader2, Download, Info, X,
} from 'lucide-react';
import type { GitHubData, SBOMData } from './shared';
import { LANGUAGE_COLORS, providerLabel } from './shared';
import ProviderIcon from './ProviderIcon';

export default function DependenciesTab({ ghData, sbomData, sbomLoading, onConnect, onSync, syncing, onRefreshSBOM, repoProvider, isProviderConnected }: {
  ghData: GitHubData; sbomData: SBOMData; sbomLoading: boolean;
  onConnect: (provider?: string) => void; onSync: () => void; syncing: boolean; onRefreshSBOM: () => void;
  repoProvider: string;
  isProviderConnected: boolean;
}) {
  const pLabel = providerLabel(repoProvider);

  if (!isProviderConnected) {
    return (
      <div className="pd-placeholder">
        <ProviderIcon provider={repoProvider} size={48} />
        <h3>Connect {pLabel} to Discover Dependencies</h3>
        <p>Connect your {pLabel} account to scan the repository for dependencies, generate SBOMs, and identify contributors. The CRA requires a machine-readable SBOM (Article 13(11)).</p>
        <button className="btn btn-primary" onClick={() => onConnect(repoProvider)}>
          <ProviderIcon provider={repoProvider} size={18} /> Connect {pLabel}
        </button>
      </div>
    );
  }

  if (!ghData.synced) {
    return (
      <div className="pd-placeholder">
        <RefreshCw size={48} strokeWidth={1} />
        <h3>Sync Repository</h3>
        <p>Your {pLabel} account is connected. Sync the repository to generate the SBOM, discover languages, and identify contributors.</p>
        <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
          {syncing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
          {syncing ? 'Syncing...' : 'Sync Repository'}
        </button>
      </div>
    );
  }

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHashInfo, setShowHashInfo] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ totalDependencies: number; enrichedDependencies: number; enrichmentComplete: boolean; gaps?: { noVersion: number; unsupportedEcosystem: number; notFound: number; fetchError: number; pending: number }; lockfileResolved?: number; lastEnrichedAt?: string } | null>(null);
  const productId = useParams().productId;

  // Fetch hash enrichment status when SBOM is available
  useEffect(() => {
    if (sbomData.hasSBOM && productId) {
      const token = localStorage.getItem('session_token');
      fetch(`/api/sbom/${productId}/export/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setExportStatus(data); })
        .catch(() => {});
    }
  }, [sbomData.hasSBOM, productId]);

  async function handleExport(format: 'cyclonedx' | 'spdx') {
    setShowExportMenu(false);
    const token = localStorage.getItem('session_token');
    try {
      const res = await fetch(`/api/sbom/${productId}/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Export failed');
        return;
      }
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `sbom-${format}.json`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export SBOM');
    }
  }

  return (
    <div className="deps-content">
      {/* SBOM Section */}
      {sbomData.hasSBOM && sbomData.packages && sbomData.packages.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Package size={18} />
            <h3>Software Bill of Materials ({sbomData.packageCount} packages)</h3>
            <div className="sbom-header-actions">
              {sbomData.isStale && <span className="sbom-stale-badge">Outdated</span>}
              {exportStatus && (
                <div className="sbom-hash-info-wrapper">
                  <button className={`sbom-hash-badge ${exportStatus.enrichmentComplete ? 'hash-complete' : 'hash-partial'}`} onClick={() => setShowHashInfo(!showHashInfo)}>
                    {exportStatus.enrichmentComplete ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    Hashes: {exportStatus.enrichedDependencies}/{exportStatus.totalDependencies}
                    <Info size={11} />
                  </button>
                  {showHashInfo && (
                    <div className="sbom-hash-info-panel">
                      <div className="sbom-hash-info-header">
                        <strong>SBOM Compliance Status</strong>
                        <button className="sbom-hash-info-close" onClick={() => setShowHashInfo(false)}><X size={14} /></button>
                      </div>
                      <p>CRA Article 13 requires SBOMs with cryptographic hashes for all components. <strong>{exportStatus.enrichedDependencies}</strong> of <strong>{exportStatus.totalDependencies}</strong> have verified hashes.</p>
                      {exportStatus.gaps && (Number(exportStatus.gaps.noVersion || 0) + Number(exportStatus.gaps.unsupportedEcosystem || 0) + Number(exportStatus.gaps.notFound || 0) + Number(exportStatus.gaps.fetchError || 0) + Number(exportStatus.gaps.pending || 0)) > 0 && (
                        <div className="gap-breakdown">
                          {exportStatus.gaps.noVersion > 0 && (
                            <div className="gap-row gap-warning">
                              <AlertTriangle size={13} />
                              <span><strong>{exportStatus.gaps.noVersion}</strong> missing version</span>
                              <span className="gap-action">Lockfile resolution recommended</span>
                            </div>
                          )}
                          {exportStatus.gaps.unsupportedEcosystem > 0 && (
                            <div className="gap-row gap-info">
                              <Info size={13} />
                              <span><strong>{exportStatus.gaps.unsupportedEcosystem}</strong> unsupported ecosystem</span>
                              <span className="gap-action">npm and PyPI supported</span>
                            </div>
                          )}
                          {exportStatus.gaps.notFound > 0 && (
                            <div className="gap-row gap-warning">
                              <AlertTriangle size={13} />
                              <span><strong>{exportStatus.gaps.notFound}</strong> not found in registry</span>
                              <span className="gap-action">May be private packages</span>
                            </div>
                          )}
                          {exportStatus.gaps.fetchError > 0 && (
                            <div className="gap-row gap-error">
                              <AlertTriangle size={13} />
                              <span><strong>{exportStatus.gaps.fetchError}</strong> registry errors</span>
                              <span className="gap-action">Will retry on next sync</span>
                            </div>
                          )}
                          {(exportStatus.gaps.pending ?? 0) > 0 && (
                            <div className="gap-row gap-info">
                              <Info size={13} />
                              <span><strong>{exportStatus.gaps.pending}</strong> pending enrichment</span>
                              <span className="gap-action">Will process on next sync</span>
                            </div>
                          )}
                        </div>
                      )}
                      {Number(exportStatus.lockfileResolved) > 0 && (
                        <div className="gap-row gap-success">
                          <CheckCircle2 size={13} />
                          <span><strong>{exportStatus.lockfileResolved}</strong> versions resolved from lockfile</span>
                        </div>
                      )}
                      <p>Hash coverage is noted in both CycloneDX and SPDX export metadata. Gaps are flagged as compliance risks.</p>
                    </div>
                  )}
                </div>
              )}
              <div className="sbom-export-dropdown">
                <button className="pd-sync-btn sbom-export-btn" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download size={14} /> Export SBOM
                </button>
                {showExportMenu && (
                  <div className="sbom-export-menu">
                    <button onClick={() => handleExport('cyclonedx')}>CycloneDX 1.6 (JSON)</button>
                    <button onClick={() => handleExport('spdx')}>SPDX 2.3 (JSON)</button>
                  </div>
                )}
              </div>
              <button className="pd-sync-btn" onClick={onRefreshSBOM} disabled={sbomLoading}>
                {sbomLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                {sbomLoading ? 'Refreshing...' : 'Refresh SBOM'}
              </button>
            </div>
          </div>
          {sbomData.syncedAt && (
            <div className="sbom-meta">
              <span>SPDX {sbomData.spdxVersion}</span>
              <span>Last synced: {new Date(sbomData.syncedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          <div className="sbom-table-wrapper">
            <table className="sbom-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Version</th>
                  <th>Ecosystem</th>
                  <th>License</th>
                </tr>
              </thead>
              <tbody>
                {sbomData.packages.map((pkg, i) => (
                  <tr key={i}>
                    <td className="sbom-pkg-name">{pkg.name}</td>
                    <td className="sbom-pkg-version">{pkg.version || '–'}</td>
                    <td><span className={`sbom-ecosystem sbom-eco-${pkg.ecosystem}`}>{pkg.ecosystem}</span></td>
                    <td className="sbom-pkg-license">{pkg.license === 'NOASSERTION' ? '–' : pkg.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No SBOM yet but synced */}
      {!sbomData.hasSBOM && ghData.synced && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <Package size={18} />
            <h3>No SBOM Available</h3>
          </div>
          <p className="gh-connect-desc">
            No dependency data was found for this repository. Ensure the repository contains a lockfile
            (package-lock.json, yarn.lock, Pipfile.lock, poetry.lock, go.sum, Cargo.lock, or Gemfile.lock).
          </p>
          {repoProvider !== 'github' && (
            <div className="pd-codeberg-sbom-note">
              <Info size={14} />
              <span>{providerLabel(repoProvider)} repos use lockfile-based SBOM generation. If no lockfile is found, source imports will be scanned automatically. Push a lockfile for best results.</span>
            </div>
          )}
          <button className="pd-sync-btn" onClick={onRefreshSBOM} disabled={sbomLoading}>
            {sbomLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            {repoProvider !== 'github' ? 'Generate SBOM' : 'Try Again'}
          </button>
        </div>
      )}

      {/* Languages */}
      {ghData.languages && ghData.languages.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <GitBranch size={18} />
            <h3>Languages</h3>
          </div>
          <div className="gh-lang-bar">
            {ghData.languages.map(l => (
              <div
                key={l.language}
                className="gh-lang-segment"
                style={{ width: `${l.percentage}%`, background: LANGUAGE_COLORS[l.language] || '#8b8d98' }}
                title={`${l.language}: ${l.percentage}%`}
              />
            ))}
          </div>
          <div className="gh-lang-legend">
            {ghData.languages.map(l => (
              <span key={l.language} className="gh-lang-item">
                <span className="gh-lang-dot" style={{ background: LANGUAGE_COLORS[l.language] || '#8b8d98' }}></span>
                {l.language} <span className="gh-lang-pct">{l.percentage}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contributors */}
      {ghData.contributors && ghData.contributors.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Users size={18} />
            <h3>Contributors ({ghData.contributors.length})</h3>
          </div>
          <div className="gh-contributors-grid">
            {ghData.contributors.map(c => (
              <a key={c.githubId} href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="gh-contributor">
                <img src={c.avatarUrl} alt={c.login} className="gh-contributor-avatar" />
                <div className="gh-contributor-info">
                  <span className="gh-contributor-name">{c.login}</span>
                  <span className="gh-contributor-commits">{c.contributions} commit{c.contributions !== 1 ? 's' : ''}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
