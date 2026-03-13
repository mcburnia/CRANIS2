import { useState } from 'react';
import {
  Rocket, CheckCircle2, Loader2, X, FileText, Shield, Users, Wand2,
} from 'lucide-react';

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function OnboardingWizard({ productId, productName, onClose, onComplete }: Props) {
  const [step, setStep] = useState<'configure' | 'running' | 'done'>('configure');
  const [autofillTechFile, setAutofillTechFile] = useState(true);
  const [autofillEvidence, setAutofillEvidence] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  const token = localStorage.getItem('session_token');

  const handleRun = async () => {
    setStep('running');
    setError(null);

    try {
      // Step 1: Core provisioning
      setProgress('Provisioning obligations, technical file, and stakeholders...');
      const onboardRes = await fetch(`/api/products/${productId}/onboard`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!onboardRes.ok) {
        const data = await onboardRes.json();
        setError(data.error || 'Onboarding failed');
        setStep('configure');
        return;
      }
      const onboardData = await onboardRes.json();

      let batchFillSummary = null;
      let batchEvidenceSummary = null;

      // Step 2: Optional batch-fill
      if (autofillTechFile) {
        setProgress('Auto-filling technical file sections...');
        try {
          const bfRes = await fetch(`/api/technical-file/${productId}/batch-fill`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (bfRes.ok) {
            const bfData = await bfRes.json();
            batchFillSummary = bfData.summary;
          }
        } catch { /* non-blocking */ }
      }

      // Step 3: Optional batch-evidence
      if (autofillEvidence) {
        setProgress('Generating obligation evidence notes...');
        try {
          const beRes = await fetch(`/api/obligations/${productId}/batch-evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (beRes.ok) {
            const beData = await beRes.json();
            batchEvidenceSummary = beData.summary;
          }
        } catch { /* non-blocking */ }
      }

      setResult({
        ...onboardData,
        batchFillSummary,
        batchEvidenceSummary,
      });
      setStep('done');
    } catch {
      setError('Failed to connect to server');
      setStep('configure');
    }
  };

  return (
    <div className="bf-overlay" onClick={onClose}>
      <div className="bf-modal ob-modal" onClick={e => e.stopPropagation()}>
        <div className="bf-header">
          <Rocket size={20} />
          <h3>Set Up for Compliance</h3>
          <button className="bf-close" onClick={onClose}><X size={18} /></button>
        </div>

        {step === 'configure' && (
          <>
            <div className="bf-body">
              <p className="ob-intro">
                This wizard will set up <strong>{productName}</strong> for CRA compliance in one step.
                It provisions all required structures and optionally pre-fills content from your platform data.
              </p>

              {error && (
                <div className="pst-error" style={{ marginBottom: '0.75rem' }}>
                  {error}
                </div>
              )}

              <div className="ob-steps-preview">
                <div className="ob-step-item">
                  <Shield size={16} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div className="ob-step-title">Create CRA obligations</div>
                    <div className="ob-step-desc">Provision all applicable obligations based on your CRA category, with derived status computation</div>
                  </div>
                </div>
                <div className="ob-step-item">
                  <FileText size={16} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div className="ob-step-title">Create technical file sections</div>
                    <div className="ob-step-desc">Set up all 8 Annex VII sections with CRA guidance text</div>
                  </div>
                </div>
                <div className="ob-step-item">
                  <Users size={16} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div className="ob-step-title">Assign stakeholder roles</div>
                    <div className="ob-step-desc">Create org-level and product-level compliance contacts, pre-filled with your email</div>
                  </div>
                </div>
              </div>

              <div className="ob-options">
                <label className="ob-option">
                  <input type="checkbox" checked={autofillTechFile} onChange={e => setAutofillTechFile(e.target.checked)} />
                  <Wand2 size={14} />
                  <span>Auto-fill technical file from platform data</span>
                </label>
                <label className="ob-option">
                  <input type="checkbox" checked={autofillEvidence} onChange={e => setAutofillEvidence(e.target.checked)} />
                  <Wand2 size={14} />
                  <span>Generate obligation evidence notes</span>
                </label>
              </div>
            </div>

            <div className="bf-footer">
              <button className="bf-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="bf-btn-primary" onClick={handleRun}>
                <Rocket size={14} /> Set Up Now
              </button>
            </div>
          </>
        )}

        {step === 'running' && (
          <div className="bf-body bf-running">
            <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }} />
            <p>{progress}</p>
          </div>
        )}

        {step === 'done' && result && (
          <>
            <div className="bf-body">
              <div className="ob-done-header">
                <CheckCircle2 size={36} style={{ color: 'var(--green)' }} />
                <h4>{productName} is ready for compliance</h4>
              </div>

              <div className="ob-done-grid">
                {result.provisioned.map((p: any, i: number) => (
                  <div key={i} className="ob-done-item">
                    <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                    <span className="ob-done-step">{stepLabel(p.step)}</span>
                    {p.detail && <span className="ob-done-detail">{p.detail}</span>}
                  </div>
                ))}
                {result.batchFillSummary && (
                  <div className="ob-done-item">
                    <Wand2 size={14} style={{ color: 'var(--accent)' }} />
                    <span className="ob-done-step">Technical file auto-filled</span>
                    <span className="ob-done-detail">{result.batchFillSummary.sectionsFilled} sections, {result.batchFillSummary.totalFieldsPopulated} fields</span>
                  </div>
                )}
                {result.batchEvidenceSummary && (
                  <div className="ob-done-item">
                    <Wand2 size={14} style={{ color: 'var(--accent)' }} />
                    <span className="ob-done-step">Obligation evidence generated</span>
                    <span className="ob-done-detail">{result.batchEvidenceSummary.obligationsFilled} obligations</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bf-footer">
              <div />
              <button className="bf-btn-primary" onClick={() => { onComplete(); onClose(); }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function stepLabel(step: string): string {
  const labels: Record<string, string> = {
    obligations: 'CRA obligations provisioned',
    technical_file: 'Technical file sections created',
    stakeholders: 'Stakeholder roles assigned',
    derived_statuses: 'Obligation statuses computed',
  };
  return labels[step] || step;
}
