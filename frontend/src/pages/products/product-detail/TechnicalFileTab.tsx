/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect } from 'react';
import {
  Shield, FileText, CheckCircle2, Clock, ChevronRight, Loader2, Download, Save, Info, AlertTriangle, Sparkles, Wand2,
} from 'lucide-react';
import HelpTip from '../../../components/HelpTip';
import BatchFillWizard from '../../../components/BatchFillWizard';
import type { TechFileData, TechFileSection } from './shared';
import { TECHFILE_HELP, timeAgo } from './shared';

const ROLE_TF_GUIDANCE: Record<string, string> = {
  importer: 'As an importer, you are not required to author the technical file — that is the manufacturer\u2019s responsibility. Use this section to verify that the manufacturer has prepared the required documentation and that it is accessible upon request by market surveillance authorities (CRA Art. 18(2), 18(10)).',
  distributor: 'As a distributor, you are not required to author the technical file — that is the manufacturer\u2019s responsibility. Use this section to verify that the required documentation exists and that the product bears the CE marking (CRA Art. 19(1)).',
};

export default function TechnicalFileTab({ productId, techFileData, loading, onUpdate }: {
  productId: string; techFileData: TechFileData; loading: boolean; onUpdate: () => void;
}) {
  const [orgCraRole, setOrgCraRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) return;
    fetch('/api/org', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.craRole) setOrgCraRole(data.craRole); })
      .catch(() => {});
  }, []);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [downloadingCvd, setDownloadingCvd] = useState(false);
  const [editContent, setEditContent] = useState<Record<string, any>>({});
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  const [autoFilledSections, setAutoFilledSections] = useState<Set<string>>(new Set());
  const [aiSuggesting, setAiSuggesting] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [generatingRiskAssessment, setGeneratingRiskAssessment] = useState(false);
  const [showBatchFill, setShowBatchFill] = useState(false);

  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'var(--green)', text: 'Complete' },
    in_progress: { icon: Clock, color: 'var(--amber)', text: 'In Progress' },
    not_started: { icon: Clock, color: 'var(--muted)', text: 'Not Started' },
  };

  function toggleSection(key: string, section: TechFileSection) {
    if (expandedSection === key) {
      setExpandedSection(null);
    } else {
      setExpandedSection(key);
      if (!editContent[key]) {
        setEditContent(prev => ({ ...prev, [key]: section.content }));
        setEditNotes(prev => ({ ...prev, [key]: section.notes || '' }));
        setEditStatus(prev => ({ ...prev, [key]: section.status }));
      }
    }
  }

  async function handleSave(sectionKey: string) {
    setSaving(sectionKey);
    try {
      const res = await fetch(`/api/technical-file/${productId}/${sectionKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('session_token')}`,
        },
        body: JSON.stringify({
          content: editContent[sectionKey],
          notes: editNotes[sectionKey],
          status: editStatus[sectionKey],
        }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to save section:', err);
    } finally {
      setSaving(null);
    }
  }

  async function handleDownloadDoc() {
    setDownloadingDoc(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/technical-file/${productId}/declaration-of-conformity/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'eu-declaration-of-conformity.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate EU Declaration of Conformity. Please try again.');
    } finally {
      setDownloadingDoc(false);
    }
  }

  async function handleDownloadCvd() {
    setDownloadingCvd(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/technical-file/${productId}/cvd-policy/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'cvd-policy.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate CVD Policy. Please try again.');
    } finally {
      setDownloadingCvd(false);
    }
  }

  // Sections that support auto-fill from platform data
  const AUTO_FILL_SECTIONS = ['product_description', 'vulnerability_handling', 'standards_applied', 'test_reports'];

  async function handleAutoFill(sectionKey: string) {
    setLoadingSuggestion(sectionKey);
    try {
      let data = suggestions;
      if (!data) {
        const token = localStorage.getItem('session_token');
        const res = await fetch(`/api/technical-file/${productId}/suggestions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch suggestions');
        data = await res.json();
        setSuggestions(data);
      }

      const sectionSuggestion = data?.sections?.[sectionKey];
      if (!sectionSuggestion) return;

      setEditContent(prev => {
        const current = prev[sectionKey] || {};

        if (sectionKey === 'product_description' || sectionKey === 'vulnerability_handling') {
          // Merge suggested fields – only populate empty values
          const currentFields = current.fields || {};
          const suggestedFields = sectionSuggestion.fields || {};
          const mergedFields = { ...currentFields };
          for (const [k, v] of Object.entries(suggestedFields)) {
            if (!mergedFields[k]) mergedFields[k] = v as string;
          }
          return { ...prev, [sectionKey]: { ...current, fields: mergedFields } };
        }

        if (sectionKey === 'standards_applied') {
          // Only apply if standards list is currently empty
          const currentStandards = current.standards || [];
          if (currentStandards.length === 0) {
            return { ...prev, [sectionKey]: { ...current, standards: sectionSuggestion.standards || [] } };
          }
          return prev;
        }

        if (sectionKey === 'test_reports') {
          // Only apply if reports list is currently empty
          const currentReports = current.reports || [];
          if (currentReports.length === 0) {
            return { ...prev, [sectionKey]: { ...current, reports: sectionSuggestion.reports || [] } };
          }
          return prev;
        }

        return prev;
      });

      setAutoFilledSections(prev => new Set([...prev, sectionKey]));
    } catch {
      // Silently ignore – auto-fill is best-effort
    } finally {
      setLoadingSuggestion(null);
    }
  }

  async function handleAiSuggest(sectionKey: string) {
    setAiSuggesting(sectionKey);
    setAiError(null);
    setShowUpgradeBanner(false);
    try {
      const token = localStorage.getItem('session_token');
      const existingContent = editContent[sectionKey] ? JSON.stringify(editContent[sectionKey]) : undefined;
      const res = await fetch('/api/copilot/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, sectionKey, type: 'technical_file', existingContent }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setShowUpgradeBanner(true);
          return;
        }
      }
      if (!res.ok) throw new Error('Failed to generate suggestion');

      const data = await res.json();
      const suggestion = data.suggestion;

      // Parse JSON response – the service returns structured JSON for tech file sections
      try {
        // Strip markdown code fences if present
        const cleaned = suggestion.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        setEditContent(prev => {
          const current = prev[sectionKey] || {};

          if (parsed.fields) {
            // Sections with field structure (product_description, design_development, etc.)
            const currentFields = current.fields || {};
            const mergedFields = { ...currentFields };
            for (const [k, v] of Object.entries(parsed.fields)) {
              if (!mergedFields[k]) mergedFields[k] = v as string;
            }
            return { ...prev, [sectionKey]: { ...current, fields: mergedFields } };
          }
          if (parsed.standards) {
            const currentStandards = current.standards || [];
            if (currentStandards.length === 0) {
              return { ...prev, [sectionKey]: { ...current, standards: parsed.standards } };
            }
            return prev;
          }
          if (parsed.reports) {
            const currentReports = current.reports || [];
            if (currentReports.length === 0) {
              return { ...prev, [sectionKey]: { ...current, reports: parsed.reports } };
            }
            return prev;
          }

          // Direct field mapping (e.g. { intended_purpose: "...", ... })
          const currentFields = current.fields || {};
          const mergedFields = { ...currentFields };
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && !mergedFields[k]) mergedFields[k] = v;
          }
          return { ...prev, [sectionKey]: { ...current, fields: mergedFields } };
        });
      } catch {
        // If JSON parsing fails, put raw text into notes
        setEditNotes(prev => ({
          ...prev,
          [sectionKey]: prev[sectionKey] ? prev[sectionKey] + '\n\n' + suggestion : suggestion,
        }));
      }
    } catch (err: any) {
      setAiError(err.message || 'AI suggestion failed');
    } finally {
      setAiSuggesting(null);
    }
  }

  async function handleGenerateRiskAssessment() {
    setGeneratingRiskAssessment(true);
    setAiError(null);
    setShowUpgradeBanner(false);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/copilot/generate-risk-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId }),
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setShowUpgradeBanner(true);
          return;
        }
      }
      if (!res.ok) throw new Error('Failed to generate risk assessment');

      const data = await res.json();

      setEditContent(prev => {
        const current = prev['risk_assessment'] || {};
        const currentFields = current.fields || {};
        const mergedFields = { ...currentFields };

        // Only populate empty fields (non-destructive)
        if (!mergedFields.methodology) mergedFields.methodology = data.fields.methodology;
        if (!mergedFields.threat_model) mergedFields.threat_model = data.fields.threat_model;
        if (!mergedFields.risk_register) mergedFields.risk_register = data.fields.risk_register;

        // Populate Annex I requirements
        let annexReqs = current.annex_i_requirements || [];
        if (data.annexIRequirements && Array.isArray(data.annexIRequirements) && annexReqs.length > 0) {
          annexReqs = annexReqs.map((existing: any) => {
            const generated = data.annexIRequirements.find((g: any) => g.ref === existing.ref);
            if (!generated) return existing;
            return {
              ...existing,
              applicable: generated.applicable,
              justification: existing.justification || generated.justification,
              evidence: existing.evidence || generated.evidence,
            };
          });
        }

        return {
          ...prev,
          risk_assessment: { ...current, fields: mergedFields, annex_i_requirements: annexReqs },
        };
      });
    } catch (err: any) {
      setAiError(err.message || 'Risk assessment generation failed');
    } finally {
      setGeneratingRiskAssessment(false);
    }
  }


  function renderFieldEditor(sectionKey: string, fields: Record<string, string>, fieldLabels?: Record<string, string>) {
    const labels: Record<string, string> = fieldLabels || {
      intended_purpose: 'Intended Purpose',
      versions_affecting_compliance: 'Software Versions Affecting Compliance',
      market_availability: 'Market Availability',
      user_instructions_reference: 'User Information & Instructions (Annex II)',
      architecture_description: 'System Architecture Description',
      component_interactions: 'Component Interactions & Integration',
      sdlc_process: 'Secure Development Lifecycle (SDLC)',
      production_monitoring: 'Production & Monitoring Processes',
      disclosure_policy_url: 'Coordinated Vulnerability Disclosure Policy URL',
      reporting_contact: 'Vulnerability Reporting Contact',
      update_distribution_mechanism: 'Secure Update Distribution Mechanism',
      security_update_policy: 'Security Update Policy',
      sbom_reference: 'SBOM Reference',
      methodology: 'Risk Assessment Methodology',
      threat_model: 'Threat Model / Attack Surface Analysis',
      risk_register: 'Risk Register',
      start_date: 'Support Period Start Date',
      end_date: 'Support Period End Date',
      rationale: 'Rationale for Support Period',
      communication_plan: 'End-of-Support Communication Plan',
      assessment_module: 'Conformity Assessment Module (A / B+C / H)',
      notified_body: 'Notified Body (if applicable)',
      certificate_reference: 'Certificate Reference',
      ce_marking_date: 'CE Marking Date',
      declaration_text: 'Declaration Text',
    };

    return Object.entries(fields).map(([fieldKey, _]) => {
      const currentContent = editContent[sectionKey] || {};
      const currentFields = currentContent.fields || {};
      const value = currentFields[fieldKey] || '';
      const isDateField = fieldKey.includes('date') && !fieldKey.includes('update');
      const isUrlField = fieldKey.includes('url');
      const isReadOnly = fieldKey === 'sbom_reference';

      return (
        <div key={fieldKey} className="tf-field">
          <label className="tf-field-label">{labels[fieldKey] || fieldKey}</label>
          {isReadOnly ? (
            <div className="tf-field-readonly">{value}</div>
          ) : isDateField ? (
            <input
              type="date"
              className="tf-field-input"
              value={value}
              onChange={(e) => {
                const updated = { ...currentContent, fields: { ...currentFields, [fieldKey]: e.target.value } };
                setEditContent(prev => ({ ...prev, [sectionKey]: updated }));
              }}
            />
          ) : (
            <textarea
              className={`tf-field-textarea ${isUrlField ? 'tf-field-url' : ''}`}
              rows={isUrlField ? 1 : 4}
              placeholder={isUrlField ? 'https://...' : `Enter ${(labels[fieldKey] || fieldKey).toLowerCase()}...`}
              value={value}
              onChange={(e) => {
                const updated = { ...currentContent, fields: { ...currentFields, [fieldKey]: e.target.value } };
                setEditContent(prev => ({ ...prev, [sectionKey]: updated }));
              }}
            />
          )}
        </div>
      );
    });
  }

  function renderAnnexIChecklist(sectionKey: string) {
    const currentContent = editContent[sectionKey] || {};
    const reqs = currentContent.annex_i_requirements || [];
    if (!reqs.length) return null;

    return (
      <div className="tf-annex-checklist">
        <h4 className="tf-subsection-title">Annex I Part I – Essential Requirements Checklist</h4>
        <p className="tf-subsection-desc">For each requirement, indicate whether it is applicable and provide evidence or justification.</p>
        <div className="tf-annex-list">
          {reqs.map((req: any, idx: number) => (
            <div key={req.ref} className={`tf-annex-item ${req.applicable ? '' : 'tf-annex-na'}`}>
              <div className="tf-annex-header">
                <span className="tf-annex-ref">{req.ref}</span>
                <span className="tf-annex-title">{req.title}</span>
                <label className="tf-annex-toggle">
                  <input
                    type="checkbox"
                    checked={req.applicable}
                    onChange={(e) => {
                      const updated = [...reqs];
                      updated[idx] = { ...updated[idx], applicable: e.target.checked };
                      setEditContent(prev => ({
                        ...prev,
                        [sectionKey]: { ...currentContent, annex_i_requirements: updated }
                      }));
                    }}
                  />
                  Applicable
                </label>
              </div>
              {req.applicable ? (
                <textarea
                  className="tf-field-textarea"
                  rows={2}
                  placeholder="Describe how this requirement is met..."
                  value={req.evidence || ''}
                  onChange={(e) => {
                    const updated = [...reqs];
                    updated[idx] = { ...updated[idx], evidence: e.target.value };
                    setEditContent(prev => ({
                      ...prev,
                      [sectionKey]: { ...currentContent, annex_i_requirements: updated }
                    }));
                  }}
                />
              ) : (
                <textarea
                  className="tf-field-textarea"
                  rows={2}
                  placeholder="Justify why this requirement is not applicable..."
                  value={req.justification || ''}
                  onChange={(e) => {
                    const updated = [...reqs];
                    updated[idx] = { ...updated[idx], justification: e.target.value };
                    setEditContent(prev => ({
                      ...prev,
                      [sectionKey]: { ...currentContent, annex_i_requirements: updated }
                    }));
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading && techFileData.sections.length === 0) {
    return (
      <div className="pd-placeholder">
        <Loader2 size={48} strokeWidth={1} className="spin" />
        <h3>Loading Technical File...</h3>
      </div>
    );
  }

  return (
    <div className="pd-techfile">
      <div className="pd-section-intro">
        <FileText size={20} />
        <div>
          <h3>Technical Documentation</h3>
          <p>{orgCraRole && ROLE_TF_GUIDANCE[orgCraRole]
            ? ROLE_TF_GUIDANCE[orgCraRole]
            : 'The technical file must be compiled before placing the product on the EU market (CRA Annex VII, Article 31). Click each section to expand and edit.'}</p>
        </div>
        <div className="tf-progress-summary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn tf-batch-fill-btn"
            onClick={() => setShowBatchFill(true)}
            title="Auto-populate all empty fields from platform data"
          >
            <Wand2 size={14} />
            Batch Fill
          </button>
          <span className="tf-progress-count">{techFileData.progress.completed}/{techFileData.progress.total} complete</span>
        </div>
      </div>
      <div className="pd-techfile-list">
        {techFileData.sections.map((section) => {
          const isExpanded = expandedSection === section.sectionKey;
          const cfg = statusConfig[section.status];
          const StatusIcon = cfg.icon;
          const currentStatus = editStatus[section.sectionKey] || section.status;

          return (
            <div key={section.sectionKey} className={`pd-techfile-item ${isExpanded ? 'tf-expanded' : ''}`}>
              <div className="tf-item-header" onClick={() => toggleSection(section.sectionKey, section)}>
                <div className="pd-techfile-status">
                  <StatusIcon size={16} style={{ color: cfg.color }} />
                </div>
                <div className="pd-techfile-content">
                  <h4>{section.title} <HelpTip text={TECHFILE_HELP[section.sectionKey] || ''} /></h4>
                  <p>{section.craReference}{section.updatedAt ? ` · Updated ${timeAgo(section.updatedAt)}` : ''}</p>
                </div>
                <ChevronRight size={16} className={`tf-chevron ${isExpanded ? 'tf-chevron-open' : ''}`} />
              </div>

              {isExpanded && (
                <div className="tf-editor">
                  <div className="tf-guidance">
                    <Shield size={14} />
                    <span>{section.content?.guidance || 'Complete this section per the CRA requirements.'}</span>
                  </div>

                  {/* Auto-fill banner – shown after auto-fill is applied */}
                  {autoFilledSections.has(section.sectionKey) && (
                    <div className="tf-autofill-banner">
                      <Sparkles size={13} />
                      <span>Platform data auto-filled. Review each field before saving.</span>
                    </div>
                  )}

                  {/* AI suggesting overlay */}
                  {aiSuggesting === section.sectionKey && (
                    <div className="ai-suggesting-banner">
                      <Loader2 size={14} className="spin" />
                      <span>Generating draft with AI. This may take a few seconds…</span>
                    </div>
                  )}

                  {/* Risk assessment generation overlay */}
                  {generatingRiskAssessment && section.sectionKey === 'risk_assessment' && (
                    <div className="ai-suggesting-banner">
                      <Loader2 size={14} className="spin" />
                      <span>Generating comprehensive risk assessment with AI. This may take 15–30 seconds…</span>
                    </div>
                  )}

                  {/* Upgrade banner */}
                  {showUpgradeBanner && expandedSection === section.sectionKey && (
                    <div className="ai-upgrade-banner">
                      <Info size={14} />
                      <span>AI Suggest requires the <strong>Pro</strong> plan or higher. <a href="/billing">Upgrade now</a></span>
                    </div>
                  )}

                  {/* AI error message */}
                  {aiError && expandedSection === section.sectionKey && (
                    <div className="ai-error-banner">
                      <AlertTriangle size={14} />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {/* Status selector */}
                  <div className="tf-status-row">
                    <label className="tf-field-label">Section Status</label>
                    <select
                      className="tf-status-select"
                      value={currentStatus}
                      onChange={(e) => setEditStatus(prev => ({ ...prev, [section.sectionKey]: e.target.value }))}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Complete</option>
                    </select>
                  </div>

                  {/* Field editors */}
                  {section.content?.fields && (
                    <div className="tf-fields">
                      {renderFieldEditor(section.sectionKey, section.content.fields)}
                    </div>
                  )}

                  {/* Annex I checklist for risk assessment */}
                  {section.sectionKey === 'risk_assessment' && renderAnnexIChecklist(section.sectionKey)}

                  {/* Notes */}
                  <div className="tf-field">
                    <label className="tf-field-label">Internal Notes</label>
                    <textarea
                      className="tf-field-textarea"
                      rows={3}
                      placeholder="Add any internal notes or comments..."
                      value={editNotes[section.sectionKey] || ''}
                      onChange={(e) => setEditNotes(prev => ({ ...prev, [section.sectionKey]: e.target.value }))}
                    />
                  </div>

                  {/* Save button + action buttons */}
                  <div className="tf-actions">
                    <button
                      className="btn btn-primary tf-save-btn"
                      onClick={() => handleSave(section.sectionKey)}
                      disabled={saving === section.sectionKey}
                    >
                      {saving === section.sectionKey ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                      {saving === section.sectionKey ? 'Saving...' : 'Save Section'}
                    </button>
                    {AUTO_FILL_SECTIONS.includes(section.sectionKey) && (
                      <button
                        className="btn tf-autofill-btn"
                        onClick={() => handleAutoFill(section.sectionKey)}
                        disabled={loadingSuggestion === section.sectionKey}
                        title="Pre-fill empty fields using data already in the platform (non-destructive)"
                      >
                        {loadingSuggestion === section.sectionKey
                          ? <Loader2 size={14} className="spin" />
                          : <Sparkles size={14} />}
                        {loadingSuggestion === section.sectionKey ? 'Filling…' : 'Auto-fill'}
                      </button>
                    )}
                    <button
                      className="btn ai-suggest-btn"
                      onClick={() => handleAiSuggest(section.sectionKey)}
                      disabled={aiSuggesting === section.sectionKey}
                      title="Generate AI-drafted content using your product data (Pro plan)"
                    >
                      {aiSuggesting === section.sectionKey
                        ? <Loader2 size={14} className="spin" />
                        : <Sparkles size={14} />}
                      {aiSuggesting === section.sectionKey ? 'Generating…' : 'AI Suggest'}
                    </button>
                    {section.sectionKey === 'risk_assessment' && (
                      <button
                        className="btn ai-suggest-btn"
                        onClick={handleGenerateRiskAssessment}
                        disabled={generatingRiskAssessment}
                        title="Generate a full AI-drafted risk assessment from your product data (Pro plan)"
                      >
                        {generatingRiskAssessment
                          ? <Loader2 size={14} className="spin" />
                          : <Sparkles size={14} />}
                        {generatingRiskAssessment ? 'Generating…' : 'Generate Full Assessment'}
                      </button>
                    )}
                    {section.sectionKey === 'declaration_of_conformity' && (
                      <button
                        className="btn tf-doc-download-btn"
                        onClick={handleDownloadDoc}
                        disabled={downloadingDoc}
                        title="Download EU Declaration of Conformity as PDF"
                      >
                        {downloadingDoc ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        {downloadingDoc ? 'Generating…' : 'Download EU DoC PDF'}
                      </button>
                    )}
                    {section.sectionKey === 'vulnerability_handling' && (
                      <button
                        className="btn tf-doc-download-btn"
                        onClick={handleDownloadCvd}
                        disabled={downloadingCvd}
                        title="Download Coordinated Vulnerability Disclosure policy as PDF"
                      >
                        {downloadingCvd ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        {downloadingCvd ? 'Generating…' : 'Download CVD Policy'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showBatchFill && (
        <BatchFillWizard
          productId={productId}
          onClose={() => setShowBatchFill(false)}
          onComplete={onUpdate}
        />
      )}
    </div>
  );
}
