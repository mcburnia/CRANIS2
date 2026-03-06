/**
 * SupplyChainTab
 * Shows supplier due diligence questionnaires for third-party dependencies.
 * Identifies risky deps (copyleft, vulns, no supplier) and generates AI questionnaires.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle, Sparkles, Download, FileText, ChevronDown, ChevronRight,
  Shield, Loader2, CheckCircle2, Send, Eye, Clock,
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

const statusConfig: Record<string, { icon: typeof Clock; label: string; colour: string }> = {
  generated: { icon: Clock, label: 'Generated', colour: 'var(--warning)' },
  sent: { icon: Send, label: 'Sent', colour: 'var(--info, #3b82f6)' },
  responded: { icon: Eye, label: 'Responded', colour: 'var(--accent)' },
  reviewed: { icon: CheckCircle2, label: 'Reviewed', colour: 'var(--success)' },
};

const flagLabels: Record<string, { label: string; colour: string }> = {
  copyleft_license: { label: 'Copyleft', colour: '#f59e0b' },
  known_vulnerability: { label: 'Vulnerability', colour: '#ef4444' },
  high_severity_vuln: { label: 'High/Critical Vuln', colour: '#dc2626' },
  no_supplier_info: { label: 'No Supplier', colour: '#6b7280' },
};

export default function SupplyChainTab({ productId }: SupplyChainTabProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [generateResult, setGenerateResult] = useState<{ generated: number; skipped: number } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

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
        setError('Supplier due diligence requires a Pro plan subscription.');
        return;
      }
      if (!res.ok) throw new Error('Failed to generate questionnaires');
      const data = await res.json();
      setGenerateResult({ generated: data.generated, skipped: data.skipped });
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
            <p className="sc-subtitle">CRA Art. 13(5) — Third-party component risk assessment</p>
          </div>
        </div>
        <div className="sc-header-actions">
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
          <span>
            Generated {generateResult.generated} questionnaire(s)
            {generateResult.skipped > 0 && `, skipped ${generateResult.skipped} (already exist)`}
            {generateResult.generated === 0 && generateResult.skipped === 0 && ' — no risky dependencies found'}
          </span>
        </div>
      )}

      {/* Empty state */}
      {questionnaires.length === 0 && !generating && (
        <div className="sc-empty">
          <Shield size={48} />
          <h4>No due diligence questionnaires yet</h4>
          <p>
            Click "Scan Dependencies" to identify third-party components with supply chain risks
            (copyleft licences, known vulnerabilities, missing supplier information) and generate
            AI-powered due diligence questionnaires.
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
                      const info = flagLabels[flag.type] || { label: flag.type, colour: '#6b7280' };
                      return (
                        <span key={i} className="sc-risk-badge" style={{ background: info.colour }}>
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
                        <div className="sc-questions">
                          {q.questionnaireContent.questions.map((question, i) => (
                            <div key={question.id || i} className="sc-question">
                              <div className="sc-q-header">
                                <span className="sc-q-category">{question.category.replace(/_/g, ' ')}</span>
                                {question.craReference && (
                                  <span className="sc-q-ref">{question.craReference}</span>
                                )}
                              </div>
                              <p className="sc-q-text">{question.question}</p>
                              <p className="sc-q-rationale">{question.rationale}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended actions */}
                    {q.questionnaireContent.recommendedActions && q.questionnaireContent.recommendedActions.length > 0 && (
                      <div className="sc-section">
                        <h5>Recommended Actions</h5>
                        <ul className="sc-actions-list">
                          {q.questionnaireContent.recommendedActions.map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Status control */}
                    <div className="sc-status-control">
                      <span>Status:</span>
                      <select
                        value={q.status}
                        onChange={(e) => handleStatusChange(q.id, e.target.value)}
                      >
                        <option value="generated">Generated</option>
                        <option value="sent">Sent to Supplier</option>
                        <option value="responded">Supplier Responded</option>
                        <option value="reviewed">Reviewed</option>
                      </select>
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
