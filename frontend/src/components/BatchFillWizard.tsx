/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState } from 'react';
import {
  Sparkles, Loader2, CheckCircle2, XCircle, SkipForward, ArrowRight, X, FileText, Shield,
} from 'lucide-react';

interface BatchFillResult {
  sectionKey: string;
  action: string;
  fieldsPopulated: number;
}

interface EvidenceResult {
  obligationKey: string;
  action: string;
}

const SECTION_LABELS: Record<string, string> = {
  product_description: 'Product Description',
  vulnerability_handling: 'Vulnerability Handling',
  standards_applied: 'Standards Applied',
  test_reports: 'Test Reports',
};

const OBLIGATION_LABELS: Record<string, string> = {
  art_13: 'Art. 13 – General Requirements',
  art_13_3: 'Art. 13(3) – Component Currency',
  art_13_5: 'Art. 13(5) – No Known Exploitable Vulnerabilities',
  art_13_6: 'Art. 13(6) – Vulnerability Handling',
  art_13_7: 'Art. 13(7) – Automatic Security Updates',
  art_13_8: 'Art. 13(8) – Free Security Patches',
  art_13_9: 'Art. 13(9) – Separate Security Updates',
  art_13_10: 'Art. 13(10) – Documentation Retention',
  art_13_11: 'Art. 13(11) – SBOM',
  art_13_12: 'Art. 13(12) – Security Contact',
  art_13_13: 'Art. 13(13) – Product Identification',
  art_13_14: 'Art. 13(14) – User Instructions',
  art_13_15: 'Art. 13(15) – End-of-Support Notice',
  art_14: 'Art. 14 – ENISA Reporting',
  art_16: 'Art. 16 – EU Declaration of Conformity',
  annex_i_part_i: 'Annex I Part I – Essential Requirements',
  annex_i_part_ii: 'Annex I Part II – Vulnerability Handling',
  art_20: 'Art. 20 – Market Surveillance Registration',
  art_32: 'Art. 32 – Conformity Assessment',
  art_32_3: 'Art. 32(3) – Third-Party Assessment',
};

type WizardStep = 'confirm' | 'running' | 'done';

export default function BatchFillWizard({ productId, onClose, onComplete }: {
  productId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<WizardStep>('confirm');
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [techResults, setTechResults] = useState<BatchFillResult[] | null>(null);
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[] | null>(null);
  const [techProgress, setTechProgress] = useState<{ total: number; completed: number; inProgress: number; not_started: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runBatchFill() {
    setStep('running');
    setError(null);
    const token = localStorage.getItem('session_token');

    try {
      // Step 1: Batch-fill technical file sections
      const techRes = await fetch(`/api/technical-file/${productId}/batch-fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!techRes.ok) {
        const data = await techRes.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to batch-fill technical file');
      }
      const techData = await techRes.json();
      setTechResults(techData.results);
      setTechProgress(techData.progress);

      // Step 2: Optionally batch-fill obligation evidence
      if (includeEvidence) {
        const evRes = await fetch(`/api/obligations/${productId}/batch-evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
        if (!evRes.ok) {
          const data = await evRes.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to generate obligation evidence');
        }
        const evData = await evRes.json();
        setEvidenceResults(evData.results);
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Batch fill failed');
      setStep('done');
    }
  }

  function handleDone() {
    onComplete();
    onClose();
  }

  const techFilled = techResults?.filter(r => r.action === 'filled').length || 0;
  const techFieldsTotal = techResults?.reduce((sum, r) => sum + r.fieldsPopulated, 0) || 0;
  const evidenceFilled = evidenceResults?.filter(r => r.action === 'filled').length || 0;

  return (
    <div className="bf-overlay" onClick={onClose}>
      <div className="bf-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bf-header">
          <div className="bf-header-left">
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <h3>Batch Fill Wizard</h3>
          </div>
          <button className="bf-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="bf-body">
            <p className="bf-description">
              This wizard auto-populates empty technical file fields and obligation evidence notes
              using data already in the platform. It never overwrites existing content.
            </p>

            <div className="bf-scope-card">
              <div className="bf-scope-row">
                <FileText size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <strong>Technical file sections</strong>
                  <span className="bf-scope-detail">Product description, vulnerability handling, standards, and test reports</span>
                </div>
              </div>
            </div>

            <label className="bf-checkbox-label">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={e => setIncludeEvidence(e.target.checked)}
              />
              <Shield size={16} style={{ color: 'var(--green)' }} />
              <div>
                <strong>Also generate obligation evidence notes</strong>
                <span className="bf-scope-detail">Populates empty evidence fields for all 19 CRA obligations using scan, SBOM, and stakeholder data</span>
              </div>
            </label>

            <div className="bf-info">
              No AI involved. All content is derived deterministically from your existing platform data.
            </div>

            <div className="bf-actions">
              <button className="bf-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="bf-btn-primary" onClick={runBatchFill}>
                <Sparkles size={16} />
                Run Batch Fill
              </button>
            </div>
          </div>
        )}

        {/* Step: Running */}
        {step === 'running' && (
          <div className="bf-body bf-running">
            <Loader2 size={32} className="bf-spinner" />
            <p>Applying auto-fill across all sections{includeEvidence ? ' and obligations' : ''}...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="bf-body">
            {error ? (
              <div className="bf-error">
                <XCircle size={20} />
                <span>{error}</span>
              </div>
            ) : (
              <>
                <div className="bf-success-header">
                  <CheckCircle2 size={24} style={{ color: 'var(--green)' }} />
                  <div>
                    <strong>Batch fill complete</strong>
                    {techProgress && (
                      <span className="bf-progress-note">
                        Technical file: {techProgress.completed}/{techProgress.completed + techProgress.inProgress + techProgress.not_started} sections complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Technical file results */}
                {techResults && techResults.length > 0 && (
                  <div className="bf-results-section">
                    <h4><FileText size={14} /> Technical File</h4>
                    <div className="bf-results-list">
                      {techResults.map(r => (
                        <div key={r.sectionKey} className="bf-result-row">
                          <ResultIcon action={r.action} />
                          <span className="bf-result-label">{SECTION_LABELS[r.sectionKey] || r.sectionKey}</span>
                          <span className="bf-result-action">
                            {r.action === 'filled' ? `${r.fieldsPopulated} field${r.fieldsPopulated === 1 ? '' : 's'} populated` :
                             r.action === 'already_complete' ? 'Already complete' :
                             r.action === 'no_empty_fields' ? 'All fields populated' :
                             r.action === 'skipped' ? 'Skipped' : r.action}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="bf-result-summary">
                      {techFilled} section{techFilled === 1 ? '' : 's'} updated, {techFieldsTotal} field{techFieldsTotal === 1 ? '' : 's'} populated
                    </div>
                  </div>
                )}

                {/* Obligation evidence results */}
                {evidenceResults && evidenceResults.length > 0 && (
                  <div className="bf-results-section">
                    <h4><Shield size={14} /> Obligation Evidence</h4>
                    <div className="bf-results-list bf-results-compact">
                      {evidenceResults.filter(r => r.action === 'filled').map(r => (
                        <div key={r.obligationKey} className="bf-result-row">
                          <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                          <span className="bf-result-label">{OBLIGATION_LABELS[r.obligationKey] || r.obligationKey}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bf-result-summary">
                      {evidenceFilled} of {evidenceResults.length} obligation{evidenceResults.length === 1 ? '' : 's'} received evidence notes
                      {evidenceResults.filter(r => r.action === 'has_notes').length > 0 &&
                        ` (${evidenceResults.filter(r => r.action === 'has_notes').length} already had notes)`
                      }
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="bf-actions">
              <button className="bf-btn-primary" onClick={handleDone}>
                Done
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultIcon({ action }: { action: string }) {
  if (action === 'filled') return <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />;
  if (action === 'already_complete' || action === 'no_empty_fields') return <CheckCircle2 size={14} style={{ color: 'var(--muted)' }} />;
  if (action === 'skipped') return <SkipForward size={14} style={{ color: 'var(--muted)' }} />;
  return <XCircle size={14} style={{ color: 'var(--muted)' }} />;
}
