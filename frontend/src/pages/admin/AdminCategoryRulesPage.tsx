/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * AdminCategoryRulesPage
 * Admin panel for viewing and editing CRA category rule attributes and thresholds
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Lock, Edit2, Save, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import '../../components/styles/admin-category-rules.css';

interface RuleAttribute {
  id: string;
  attribute_key: string;
  name: string;
  description: string;
  regulatory_basis: string;
  is_locked: boolean;
  last_modified_by?: string;
  last_modified_at?: string;
  values: Array<{ id: string; label: string; score: number; reasoning: string }>;
}

interface CategoryThreshold {
  id: string;
  category_key: string;
  category_name: string;
  min_score: number;
  max_score: number;
  reasoning: string;
  is_locked: boolean;
}

interface RuleChange {
  id: string;
  change_type: string;
  entity_type: string;
  entity_id: string;
  changed_by: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ai_assessment?: any;
  regulatory_alignment: string;
  is_override: boolean;
  override_reason?: string;
  created_at: string;
}

export default function AdminCategoryRulesPage() {
  const [attributes, setAttributes] = useState<RuleAttribute[]>([]);
  const [thresholds, setThresholds] = useState<CategoryThreshold[]>([]);
  const [auditHistory, setAuditHistory] = useState<RuleChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [overrideConfirm, setOverrideConfirm] = useState<{
    show: boolean;
    attrId?: string;
    assessment?: any;
    overrideConfirmed?: boolean;
    overrideReason?: string;
  }>({
    show: false,
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const [rulesRes, auditRes] = await Promise.all([
        fetch('/api/admin/category-rules'),
        fetch('/api/admin/category-rules-audit?limit=20'),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setAttributes(data.attributes);
        setThresholds(data.thresholds);
      }

      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditHistory(data);
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditAttribute = (attr: RuleAttribute) => {
    setEditingAttrId(attr.id);
    setEditValues({
      name: attr.name,
      description: attr.description,
      regulatoryBasis: attr.regulatory_basis,
    });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingAttrId(null);
    setEditValues({});
    setSaveError(null);
    setOverrideConfirm({ show: false });
  };

  const saveAttribute = async (attrId: string, skipValidation = false) => {
    setSaveError(null);

    try {
      const response = await fetch(`/api/admin/category-rules/attributes/${attrId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editValues,
          confirmOverride: skipValidation,
          overrideReason: overrideConfirm.overrideReason || '',
        }),
      });

      if (response.status === 422) {
        // Regulatory alignment check failed
        const data = await response.json();
        setOverrideConfirm({
          show: true,
          attrId,
          assessment: data.validation,
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to save attribute');
      }

      // Reload rules and clear editing state
      await loadRules();
      setEditingAttrId(null);
      setEditValues({});
      setOverrideConfirm({ show: false });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Category Rules (CRA)" />
        <div className="acr-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="acr-container">
      <PageHeader title="Category Rules (CRA)" />

      <div className="acr-grid">
        {/* Attributes Section */}
        <section className="acr-section">
          <h2>Risk Attributes</h2>
          <div className="acr-attributes-list">
            {attributes.map((attr) => (
              <div key={attr.id} className="acr-attribute-card">
                <div className="acr-attr-header">
                  <div className="acr-attr-title">
                    <h3>{attr.name}</h3>
                    {attr.is_locked && (
                      <span className="acr-locked-badge">
                        <Lock size={14} /> Regulatory baseline
                      </span>
                    )}
                  </div>
                  {!editingAttrId && (
                    <button
                      className="acr-edit-btn"
                      onClick={() => startEditAttribute(attr)}
                      disabled={attr.is_locked}
                      title={attr.is_locked ? 'Locked to regulatory baseline' : 'Edit attribute'}
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>

                {editingAttrId === attr.id ? (
                  <div className="acr-edit-form">
                    <div className="acr-form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={editValues.name || ''}
                        onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                      />
                    </div>
                    <div className="acr-form-group">
                      <label>Description</label>
                      <textarea
                        value={editValues.description || ''}
                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="acr-form-group">
                      <label>Regulatory Basis (CRA reference)</label>
                      <input
                        type="text"
                        value={editValues.regulatoryBasis || ''}
                        onChange={(e) => setEditValues({ ...editValues, regulatoryBasis: e.target.value })}
                      />
                    </div>

                    {saveError && (
                      <div className="acr-error">
                        <AlertCircle size={16} /> {saveError}
                      </div>
                    )}

                    {overrideConfirm.show && overrideConfirm.attrId === attr.id && (
                      <div className="acr-override-warning">
                        <AlertCircle size={16} />
                        <div className="acr-warning-content">
                          <strong>Regulatory Alignment Check</strong>
                          <p>{overrideConfirm.assessment?.message}</p>
                          {overrideConfirm.assessment?.claudeAssessment?.suggestedCorrections && (
                            <div className="acr-suggestions">
                              <strong>Suggestions:</strong>
                              <ul>
                                {overrideConfirm.assessment.claudeAssessment.suggestedCorrections.map(
                                  (suggestion: string, i: number) => (
                                    <li key={i}>{suggestion}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                          <div className="acr-override-inputs">
                            <label>
                              <input
                                type="checkbox"
                                checked={overrideConfirm.overrideConfirmed || false}
                                onChange={(e) =>
                                  setOverrideConfirm({
                                    ...overrideConfirm,
                                    overrideConfirmed: e.target.checked,
                                  })
                                }
                              />
                              I understand the regulatory risks and confirm this change
                            </label>
                            <input
                              type="text"
                              placeholder="Reason for override (optional)"
                              value={overrideConfirm.overrideReason || ''}
                              onChange={(e) =>
                                setOverrideConfirm({
                                  ...overrideConfirm,
                                  overrideReason: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="acr-form-actions">
                      <button
                        className="acr-btn-cancel"
                        onClick={cancelEdit}
                      >
                        <X size={16} /> Cancel
                      </button>
                      <button
                        className="acr-btn-save"
                        onClick={() => saveAttribute(attr.id, overrideConfirm.overrideConfirmed)}
                        disabled={overrideConfirm.show && !overrideConfirm.overrideConfirmed}
                      >
                        <Save size={16} /> {overrideConfirm.show ? 'Confirm Override' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="acr-description">{attr.description}</p>
                    <p className="acr-regulatory-basis">
                      <strong>Regulatory Basis:</strong> {attr.regulatory_basis}
                    </p>

                    <div className="acr-values">
                      <strong>Scoring Options:</strong>
                      <div className="acr-values-list">
                        {attr.values.map((val) => (
                          <div key={val.id} className="acr-value">
                            <span className="acr-value-label">{val.label}</span>
                            <span className="acr-value-score">{(val.score * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {attr.last_modified_at && (
                      <p className="acr-meta">
                        Modified by {attr.last_modified_by} on{' '}
                        {new Date(attr.last_modified_at).toLocaleDateString()}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Thresholds Section */}
        <section className="acr-section">
          <h2>Category Thresholds</h2>
          <div className="acr-thresholds-list">
            {thresholds.map((threshold) => (
              <div key={threshold.id} className={`acr-threshold-card acr-threshold-${threshold.category_key}`}>
                <h3>{threshold.category_name}</h3>
                <div className="acr-threshold-range">
                  <span>{(threshold.min_score * 100).toFixed(1)}%</span>
                  <span className="acr-threshold-dash">–</span>
                  <span>{(threshold.max_score * 100).toFixed(1)}%</span>
                </div>
                <p className="acr-threshold-reasoning">{threshold.reasoning}</p>
                {threshold.is_locked && (
                  <p className="acr-threshold-locked">
                    <Lock size={12} /> Locked to regulatory baseline
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Audit History */}
      <section className="acr-section acr-audit-section">
        <h2>Rule Change Audit Trail</h2>
        <div className="acr-audit-list">
          {auditHistory.length === 0 ? (
            <p className="acr-empty">No rule changes yet</p>
          ) : (
            auditHistory.map((change) => (
              <div key={change.id} className="acr-audit-entry">
                <div className="acr-audit-header">
                  <strong>{change.change_type.replace(/_/g, ' ')}</strong>
                  <span className={`acr-alignment acr-alignment-${change.regulatory_alignment}`}>
                    {change.regulatory_alignment.replace(/_/g, ' ')}
                  </span>
                  {change.is_override && <span className="acr-override-badge">OVERRIDE</span>}
                </div>
                <p className="acr-audit-meta">
                  {change.changed_by} · {new Date(change.created_at).toLocaleDateString()}
                </p>
                {change.ai_assessment && (
                  <div className="acr-ai-assessment">
                    <strong>AI Assessment:</strong>
                    <p>{change.ai_assessment.reasoning}</p>
                  </div>
                )}
                {change.override_reason && (
                  <p className="acr-override-reason">
                    <strong>Override Reason:</strong> {change.override_reason}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
