/**
 * ConformityAssessmentCard
 *
 * Displays the applicable conformity assessment module(s) for a product
 * based on its CRA category. Auto-populates from the product's data.
 */

import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import './styles/conformity-assessment.css';

interface ConformityModule {
  id: string;
  name: string;
  fullName: string;
  description: string;
  legalBasis: string;
  requiresNotifiedBody: boolean;
}

interface ConformityAssessmentData {
  category: string;
  categoryLabel: string;
  applicableModules: ConformityModule[];
  primaryModule: ConformityModule;
  condition: string | null;
  requirements: string[];
  technicalFileActions: string[];
  estimatedTimeline: string;
  regulatoryNotes: string[];
  productName: string;
  productId: string;
  harmonisedStandardsDetected: boolean;
}

interface Props {
  productId: string;
  craCategory: string;
  onSwitchTab?: (tab: string) => void;
}

export default function ConformityAssessmentCard({ productId, craCategory, onSwitchTab }: Props) {
  const [data, setData] = useState<ConformityAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch(`/api/products/${productId}/conformity-assessment`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, craCategory]);

  if (loading || !data) return null;

  const needsNotifiedBody = data.primaryModule.requiresNotifiedBody;
  const moduleCount = data.applicableModules.length;

  return (
    <div className={`ca-card ${needsNotifiedBody ? 'ca-card-warning' : 'ca-card-ok'}`}>
      <div className="ca-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="ca-header-left">
          {needsNotifiedBody
            ? <AlertTriangle size={18} className="ca-icon-warning" />
            : <CheckCircle2 size={18} className="ca-icon-ok" />
          }
          <h3>Conformity Assessment</h3>
          <span className="ca-module-badge">
            {data.primaryModule.name}
            {moduleCount > 1 && ` +${moduleCount - 1}`}
          </span>
        </div>
        <div className="ca-header-right">
          {needsNotifiedBody && (
            <span className="ca-nb-badge">Notified Body Required</span>
          )}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Summary — always visible */}
      <div className="ca-summary">
        <div className="ca-summary-module">
          <strong>{data.primaryModule.fullName}</strong>
          <span className="ca-summary-timeline">{data.estimatedTimeline}</span>
        </div>
        {data.condition && (
          <div className={`ca-condition ${needsNotifiedBody ? 'ca-condition-warning' : 'ca-condition-ok'}`}>
            {data.condition}
          </div>
        )}
        {data.harmonisedStandardsDetected && data.category === 'important_i' && (
          <div className="ca-condition ca-condition-ok">
            <CheckCircle2 size={14} /> Harmonised standards detected in your technical file — self-assessment permitted.
          </div>
        )}
        {!data.harmonisedStandardsDetected && data.category === 'important_i' && (
          <div className="ca-condition ca-condition-warning">
            <AlertTriangle size={14} /> No harmonised standards detected. Apply EN 18031 to qualify for self-assessment (Module A), or proceed with third-party examination (Module B+C).
            {onSwitchTab && (
              <button className="ca-link-btn" onClick={() => onSwitchTab('technical-file')}>
                Update Standards Applied →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="ca-details">
          {/* Applicable modules */}
          <div className="ca-section">
            <h4>Applicable Module{moduleCount > 1 ? 's' : ''}</h4>
            <div className="ca-modules-list">
              {data.applicableModules.map(mod => (
                <div key={mod.id} className={`ca-module-item ${mod.id === data.primaryModule.id ? 'ca-module-primary' : ''}`}>
                  <div className="ca-module-name">
                    <Shield size={14} />
                    {mod.fullName}
                    {mod.requiresNotifiedBody && <span className="ca-nb-tag">NB</span>}
                  </div>
                  <div className="ca-module-desc">{mod.description}</div>
                  <div className="ca-module-basis">{mod.legalBasis}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="ca-section">
            <h4>What You Need to Do</h4>
            <ol className="ca-requirements">
              {data.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ol>
          </div>

          {/* Technical file actions */}
          <div className="ca-section">
            <h4>Technical File Actions</h4>
            <ul className="ca-actions">
              {data.technicalFileActions.map((action, i) => (
                <li key={i}>
                  <CheckCircle2 size={12} />
                  {action}
                </li>
              ))}
            </ul>
            {onSwitchTab && (
              <button className="ca-go-techfile" onClick={() => onSwitchTab('technical-file')}>
                Open Technical File →
              </button>
            )}
          </div>

          {/* Regulatory notes */}
          <div className="ca-section ca-section-notes">
            <h4>Regulatory Notes</h4>
            <ul className="ca-notes">
              {data.regulatoryNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
