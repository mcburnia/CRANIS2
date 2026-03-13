/**
 * SupplyChainTab
 * Shows supplier due diligence questionnaires for third-party dependencies.
 * Identifies risky deps (copyleft, vulns, no supplier) and generates due diligence questionnaires.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle, Sparkles, Download, FileText, ChevronDown, ChevronRight,
  Shield, Loader2, CheckCircle2, Send, Eye, Clock, Info, X,
  ArrowRight, Search, FileCheck, Mail, ClipboardCheck,
} from 'lucide-react';
import './styles/supply-chain-tab.css';

interface RiskFlag {
  type: string;
  detail: string;
}

interface Question {
  id: string;
  category: string;
  question: string;
  rationale: string;
  craReference?: string;
}

interface QuestionnaireContent {
  summary: string;
  riskAssessment: string;
  questions: Question[];
  recommendedActions: string[];
}

interface Questionnaire {
  id: string;
  dependencyName: string;
  dependencyVersion: string | null;
  dependencyEcosystem: string | null;
  dependencyLicense: string | null;
  dependencySupplier: string | null;
  riskFlags: RiskFlag[];
  questionnaireContent: QuestionnaireContent;
  status: string;
  createdAt: string;
}

interface SupplyChainTabProps {
  productId: string;
}

const statusConfig: Record<string, { icon: typeof Clock; label: string; colour: string; guidance: string }> = {
  generated: {
    icon: Clock,
    label: 'Generated',
    colour: 'var(--warning)',
    guidance: 'Review the questions below, then export or copy them and send to the supplier or maintainer of this component.',
  },
  sent: {
    icon: Send,
    label: 'Sent',
    colour: 'var(--info, #3b82f6)',
    guidance: 'Questionnaire has been sent to the supplier. Update the status when you receive their response.',
  },
  responded: {
    icon: Eye,
    label: 'Responded',
    colour: 'var(--accent)',
    guidance: 'The supplier has responded. Review their answers and assess whether the risks are adequately addressed.',
  },
  reviewed: {
    icon: CheckCircle2,
    label: 'Reviewed',
    colour: 'var(--success)',
    guidance: 'Due diligence for this component is complete. This evidence is ready for your technical file.',
  },
};

const flagExplanations: Record<string, { label: string; colour: string; explanation: string }> = {
  copyleft_license: {
    label: 'Copyleft',
    colour: '#f59e0b',
    explanation: 'This component uses a copyleft licence (e.g. GPL, AGPL) which may impose obligations on how you distribute your product. CRA Art. 13(5) requires you to understand these obligations.',
  },
  known_vulnerability: {
    label: 'Vulnerability',
    colour: '#ef4444',
    explanation: 'This component has known security vulnerabilities. CRA Art. 13(6) requires manufacturers to address known vulnerabilities without delay.',
  },
  high_severity_vuln: {
    label: 'High/Critical Vuln',
    colour: '#dc2626',
    explanation: 'This component has high or critical severity vulnerabilities that pose an immediate risk. CRA Art. 13(6) requires prompt remediation of exploitable vulnerabilities.',
  },
  no_supplier_info: {
    label: 'No Supplier',
    colour: '#6b7280',
    explanation: 'No supplier or maintainer information is available for this component. CRA Art. 13(5) requires you to identify and verify the provenance of third-party components.',
  },
};

const craReferenceExplanations: Record<string, string> = {
  'Art. 13(3)': 'Manufacturers shall keep their products secure throughout the support period, including providing security updates.',
  'Art. 13(5)': 'Manufacturers shall exercise due diligence when integrating third-party components, ensuring they do not compromise product security.',
  'Art. 13(6)': 'Manufacturers shall identify and document vulnerabilities, including in third-party components, and apply timely remediation.',
  'Art. 13(7)': 'Manufacturers shall share relevant information about vulnerabilities with component suppliers.',
  'Art. 13(8)': 'Manufacturers shall ensure components are integrated with appropriate security configuration.',
};

export default function SupplyChainTab({ productId }: SupplyChainTabProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [generateResult, setGenerateResult] = useState<{
    generated: number;
    skipped: number;
    enrichment?: { totalMissing: number; resolved: number; cached: number; fetched: number; failed: number };
  } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const token = localStorage.getItem('session_token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchQuestionnaires = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/supplier-questionnaires`, { headers });
      if (!res.ok) throw new Error('Failed to load questionnaires');
      const data = await res.json();
      setQuestionnaires(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuestionnaires(); }, [productId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGenerateResult(null);
    try {
      const res = await fetch(`/api/products/${productId}/supplier-questionnaires/generate`, {
        method: 'POST',
        headers,
      });
      if (res.status === 403) {
        setError('You do not have permission to perform this action.');
        return;
      }
      if (!res.ok) throw new Error('Failed to generate questionnaires');
      const data = await res.json();
      setGenerateResult({ generated: data.generated, skipped: data.skipped, enrichment: data.enrichment });
      await fetchQuestionnaires();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/supplier-questionnaires/${id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await fetchQuestionnaires();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExporting(format);
    try {
      const res = await fetch(`/api/products/${productId}/supplier-questionnaires/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supplier-due-diligence-${productId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Workflow progress stats
  const statusCounts = questionnaires.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalQ = questionnaires.length;
  const reviewedCount = statusCounts['reviewed'] || 0;
  const completionPct = totalQ > 0 ? Math.round((reviewedCount / totalQ) * 100) : 0;

  // Next action hint
  const getNextAction = (): string | null => {
    if (totalQ === 0) return null;
    const generated = statusCounts['generated'] || 0;
    const sent = statusCounts['sent'] || 0;
    const responded = statusCounts['responded'] || 0;
    if (generated > 0) return `${generated} questionnaire${generated > 1 ? 's' : ''} ready to review and send to suppliers`;
    if (sent > 0) return `${sent} questionnaire${sent > 1 ? 's' : ''} awaiting supplier response`;
    if (responded > 0) return `${responded} supplier response${responded > 1 ? 's' : ''} to review`;
    if (reviewedCount === totalQ) return 'All due diligence reviews complete. Evidence ready for your technical file.';
    return null;
  };

  if (loading) {
    return (
      <div className="sc-loading">
        <Loader2 className="sc-spinner" size={24} />
        <p>Loading supply chain data...</p>
      </div>
    );
  }

  return (
    <div className="sc-tab">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-header-left">
          <Shield size={20} />
          <div>
            <h3>Supplier Due Diligence</h3>
            <p className="sc-subtitle">CRA Art. 13(5) – Third-party component risk assessment</p>
          </div>
        </div>
        <div className="sc-header-actions">
          <button className="sc-btn sc-btn-ghost" onClick={() => setShowInfoPanel(!showInfoPanel)} title="About this assessment">
            <Info size={16} /> {showInfoPanel ? 'Hide guide' : 'How it works'}
          </button>
          {questionnaires.length > 0 && (
            <>
              <button className="sc-btn sc-btn-outline" onClick={() => handleExport('csv')} disabled={!!exporting}>
                {exporting === 'csv' ? <Loader2 className="sc-spinner" size={14} /> : <Download size={14} />} CSV
              </button>
              <button className="sc-btn sc-btn-outline" onClick={() => handleExport('pdf')} disabled={!!exporting}>
                {exporting === 'pdf' ? <Loader2 className="sc-spinner" size={14} /> : <FileText size={14} />} PDF
              </button>
            </>
          )}
          <button
            className="sc-btn sc-btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="sc-spinner" size={14} /> Analysing...</>
            ) : (
              <><Sparkles size={14} /> {questionnaires.length > 0 ? 'Re-scan Dependencies' : 'Scan Dependencies'}</>
            )}
          </button>
        </div>
      </div>

      {/* Info panel */}
      {showInfoPanel && (
        <div className="sc-info-panel">
          <div className="sc-info-header">
            <h4>Why supplier due diligence?</h4>
            <button className="sc-info-close" onClick={() => setShowInfoPanel(false)}><X size={16} /></button>
          </div>
          <p className="sc-info-text">
            The EU Cyber Resilience Act (CRA) Article 13(5) requires manufacturers to <strong>exercise due diligence when integrating third-party components</strong> into
            their products. This means you must assess the security posture of your dependencies and document that assessment as evidence for your technical file.
          </p>
          <p className="sc-info-text">
            This tool automates the process by scanning your product's dependency tree, identifying components that pose supply chain risks, and generating
            targeted questionnaires that you send to the suppliers or maintainers of those components.
          </p>
          <div className="sc-workflow-steps">
            <div className="sc-workflow-step">
              <div className="sc-step-icon"><Search size={20} /></div>
              <div className="sc-step-content">
                <strong>1. Scan</strong>
                <p>Analyse your dependencies for supply chain risks: copyleft licences, known vulnerabilities, and missing supplier information.</p>
              </div>
            </div>
            <div className="sc-workflow-step">
              <div className="sc-step-icon"><FileCheck size={20} /></div>
              <div className="sc-step-content">
                <strong>2. Review</strong>
                <p>Targeted questions are generated for each risky component based on its risk flags. Review them and adjust if needed before sending.</p>
              </div>
            </div>
            <div className="sc-workflow-step">
              <div className="sc-step-icon"><Mail size={20} /></div>
              <div className="sc-step-content">
                <strong>3. Send</strong>
                <p>Export the questionnaire as PDF or CSV and send it to the supplier. Update the status to track progress.</p>
              </div>
            </div>
            <div className="sc-workflow-step">
              <div className="sc-step-icon"><ClipboardCheck size={20} /></div>
              <div className="sc-step-content">
                <strong>4. Document</strong>
                <p>Once the supplier responds, review their answers and mark as complete. The full audit trail becomes part of your CRA technical file.</p>
              </div>
            </div>
          </div>
          <p className="sc-info-audit">
            <strong>For auditors:</strong> The exported PDF contains the complete evidence trail: which components were assessed, what risks were identified,
            what questions were asked, and how the supplier responded. This demonstrates CRA Art. 13(5) compliance.
          </p>
        </div>
      )}

      {/* Errors / Results */}
      {error && (
        <div className="sc-alert sc-alert-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {generateResult && (
        <div className="sc-alert sc-alert-success">
          <CheckCircle2 size={16} />
          <div className="sc-alert-content">
            <span>
              Generated {generateResult.generated} questionnaire(s)
              {generateResult.skipped > 0 && `, skipped ${generateResult.skipped} (already exist)`}
              {generateResult.generated === 0 && generateResult.skipped === 0 && '. No risky dependencies found. All components passed the risk check.'}
            </span>
            {generateResult.enrichment && generateResult.enrichment.totalMissing > 0 && (
              <span className="sc-enrichment-note">
                Supplier lookup: resolved {generateResult.enrichment.resolved} of {generateResult.enrichment.totalMissing} unknown suppliers
                {(() => {
                  const parts = [];
                  if (generateResult.enrichment!.cached > 0) parts.push(`${generateResult.enrichment!.cached} cached`);
                  if (generateResult.enrichment!.fetched > 0) parts.push(`${generateResult.enrichment!.fetched} from registries`);
                  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
                })()}
                {generateResult.enrichment.failed > 0 && ` (${generateResult.enrichment.failed} could not be found)`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Workflow progress banner */}
      {totalQ > 0 && (
        <div className="sc-progress-banner">
          <div className="sc-progress-summary">
            <div className="sc-progress-stats">
              <span className="sc-progress-total">{totalQ} component{totalQ !== 1 ? 's' : ''} assessed</span>
              <div className="sc-progress-badges">
                {statusCounts['generated'] > 0 && (
                  <span className="sc-progress-badge" style={{ color: 'var(--warning)' }}>
                    <Clock size={12} /> {statusCounts['generated']} Generated
                  </span>
                )}
                {statusCounts['sent'] > 0 && (
                  <span className="sc-progress-badge" style={{ color: 'var(--info, #3b82f6)' }}>
                    <Send size={12} /> {statusCounts['sent']} Sent
                  </span>
                )}
                {statusCounts['responded'] > 0 && (
                  <span className="sc-progress-badge" style={{ color: 'var(--accent)' }}>
                    <Eye size={12} /> {statusCounts['responded']} Responded
                  </span>
                )}
                {statusCounts['reviewed'] > 0 && (
                  <span className="sc-progress-badge" style={{ color: 'var(--success)' }}>
                    <CheckCircle2 size={12} /> {statusCounts['reviewed']} Reviewed
                  </span>
                )}
              </div>
            </div>
            <div className="sc-progress-bar-container">
              <div className="sc-progress-bar" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="sc-progress-footer">
              <span className="sc-progress-pct">{completionPct}% complete</span>
              {getNextAction() && (
                <span className="sc-progress-next">
                  <ArrowRight size={12} /> {getNextAction()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {questionnaires.length === 0 && !generating && (
        <div className="sc-empty">
          <Shield size={48} />
          <h4>No due diligence assessments yet</h4>
          <p>
            The CRA requires you to verify the security posture of every third-party component in your product.
            Click <strong>"Scan Dependencies"</strong> to begin.
          </p>
          <div className="sc-empty-steps">
            <div className="sc-empty-step">
              <Search size={18} />
              <span>Your dependency tree is scanned for risks</span>
            </div>
            <div className="sc-empty-step-arrow"><ArrowRight size={14} /></div>
            <div className="sc-empty-step">
              <FileCheck size={18} />
              <span>Targeted questions are generated per risk type</span>
            </div>
            <div className="sc-empty-step-arrow"><ArrowRight size={14} /></div>
            <div className="sc-empty-step">
              <Mail size={18} />
              <span>You send them to suppliers and track responses</span>
            </div>
          </div>
          <p className="sc-empty-note">
            Components are flagged for: copyleft licences, known vulnerabilities, and missing supplier information.
            Only risky components generate questionnaires. Low-risk dependencies are automatically cleared.
          </p>
        </div>
      )}

      {/* Questionnaire cards */}
      {questionnaires.length > 0 && (
        <div className="sc-list">
          <div className="sc-list-header">
            <span className="sc-col-dep">Dependency</span>
            <span className="sc-col-risk">Risk Flags</span>
            <span className="sc-col-questions">Questions</span>
            <span className="sc-col-status">Status</span>
          </div>

          {questionnaires.map(q => {
            const isExpanded = expandedIds.has(q.id);
            const statusInfo = statusConfig[q.status] || statusConfig.generated;
            const StatusIcon = statusInfo.icon;

            return (
              <div key={q.id} className={`sc-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="sc-card-header" onClick={() => toggleExpand(q.id)}>
                  <div className="sc-col-dep">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <strong>{q.dependencyName}</strong>
                      <span className="sc-dep-meta">
                        {q.dependencyVersion && `v${q.dependencyVersion}`}
                        {q.dependencyEcosystem && ` · ${q.dependencyEcosystem}`}
                        {q.dependencyLicense && ` · ${q.dependencyLicense}`}
                      </span>
                    </div>
                  </div>
                  <div className="sc-col-risk">
                    {q.riskFlags.map((flag, i) => {
                      const info = flagExplanations[flag.type] || { label: flag.type, colour: '#6b7280', explanation: '' };
                      return (
                        <span key={i} className="sc-risk-badge" style={{ background: info.colour }} title={info.explanation}>
                          {info.label}
                        </span>
                      );
                    })}
                  </div>
                  <div className="sc-col-questions">
                    {q.questionnaireContent.questions?.length || 0}
                  </div>
                  <div className="sc-col-status">
                    <span className="sc-status-badge" style={{ color: statusInfo.colour }}>
                      <StatusIcon size={14} /> {statusInfo.label}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="sc-card-body">
                    {/* Status guidance */}
                    <div className="sc-guidance">
                      <Info size={14} />
                      <span>{statusInfo.guidance}</span>
                    </div>

                    {/* Risk flag explanations */}
                    {q.riskFlags.length > 0 && (
                      <div className="sc-section">
                        <h5>Why this component was flagged</h5>
                        <div className="sc-flag-explanations">
                          {q.riskFlags.map((flag, i) => {
                            const info = flagExplanations[flag.type] || { label: flag.type, colour: '#6b7280', explanation: flag.detail };
                            return (
                              <div key={i} className="sc-flag-detail">
                                <span className="sc-flag-badge-sm" style={{ background: info.colour }}>{info.label}</span>
                                <span className="sc-flag-text">{info.explanation}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Summary & Risk */}
                    {q.questionnaireContent.summary && (
                      <div className="sc-section">
                        <h5>Summary</h5>
                        <p>{q.questionnaireContent.summary}</p>
                      </div>
                    )}
                    {q.questionnaireContent.riskAssessment && (
                      <div className="sc-section">
                        <h5>Risk Assessment</h5>
                        <p>{q.questionnaireContent.riskAssessment}</p>
                      </div>
                    )}

                    {/* Questions */}
                    {q.questionnaireContent.questions && q.questionnaireContent.questions.length > 0 && (
                      <div className="sc-section">
                        <h5>Due Diligence Questions</h5>
                        <p className="sc-section-hint">These questions should be sent to the supplier or maintainer of this component. Export as PDF for a ready-to-send document.</p>
                        <div className="sc-questions">
                          {q.questionnaireContent.questions.map((question, i) => (
                            <div key={question.id || i} className="sc-question">
                              <div className="sc-q-header">
                                <span className="sc-q-category">{question.category.replace(/_/g, ' ')}</span>
                                {question.craReference && (
                                  <span className="sc-q-ref" title={craReferenceExplanations[question.craReference] || ''}>{question.craReference}</span>
                                )}
                              </div>
                              <p className="sc-q-text">{question.question}</p>
                              <p className="sc-q-rationale">{question.rationale}</p>
                              {question.craReference && craReferenceExplanations[question.craReference] && (
                                <p className="sc-q-cra-note">{question.craReference}: {craReferenceExplanations[question.craReference]}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended actions */}
                    {q.questionnaireContent.recommendedActions && q.questionnaireContent.recommendedActions.length > 0 && (
                      <div className="sc-section">
                        <h5>Recommended Actions</h5>
                        <p className="sc-section-hint">Steps your team should take regardless of the supplier's response.</p>
                        <ul className="sc-actions-list">
                          {q.questionnaireContent.recommendedActions.map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Status control */}
                    <div className="sc-status-control">
                      <div className="sc-status-left">
                        <span>Workflow status:</span>
                        <select
                          value={q.status}
                          onChange={(e) => handleStatusChange(q.id, e.target.value)}
                        >
                          <option value="generated">Generated – Ready to review</option>
                          <option value="sent">Sent – Awaiting supplier response</option>
                          <option value="responded">Responded – Supplier replied</option>
                          <option value="reviewed">Reviewed – Due diligence complete</option>
                        </select>
                      </div>
                      <div className="sc-status-hint">
                        Update this as you progress through the due diligence workflow. Each status change is recorded for audit purposes.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
