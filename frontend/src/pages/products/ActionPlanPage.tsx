/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { ArrowLeft, CheckCircle2, Circle, Info, ChevronRight, ChevronDown } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  mergeActionPlan,
  getActionPlanSummary,
  type ActionPlanStep,
  type ChecklistData,
  type ComplianceGapData,
} from '../../utils/action-plan-merge';
import './ActionPlanPage.css';

function getReadinessColour(pct: number): string {
  if (pct >= 67) return 'green';
  if (pct >= 34) return 'amber';
  return 'red';
}

function getReadinessLabel(pct: number, lifecycle?: string): string {
  const isPreProd = !lifecycle || lifecycle === 'pre_production';
  if (pct >= 100) return isPreProd ? 'Ready for market placement' : 'Fully compliant';
  if (pct >= 90) return isPreProd ? 'Nearly ready' : 'Nearly compliant';
  if (pct >= 67) return isPreProd ? 'Good progress' : 'Good progress';
  if (pct >= 34) return isPreProd ? 'Preparing' : 'In progress';
  if (pct > 0) return isPreProd ? 'Getting started' : 'Attention needed';
  return 'Not started';
}

function getLifecycleLabel(lifecycle: string): string {
  switch (lifecycle) {
    case 'on_market': return 'On Market';
    case 'end_of_life': return 'End of Life';
    default: return 'Pre-production';
  }
}

function getLifecycleColour(lifecycle: string): string {
  switch (lifecycle) {
    case 'on_market': return 'green';
    case 'end_of_life': return 'amber';
    default: return 'blue';
  }
}

export default function ActionPlanPage() {
  usePageMeta();
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [gapData, setGapData] = useState<ComplianceGapData | null>(null);
  const [lifecycleStatus, setLifecycleStatus] = useState<string>('pre_production');
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showAllPhase2, setShowAllPhase2] = useState(false);

  const fetchData = useCallback(async () => {
    if (!productId) return;
    const token = localStorage.getItem('session_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [clRes, gapRes, prodRes] = await Promise.all([
        fetch(`/api/products/${productId}/compliance-checklist`, { headers }),
        fetch(`/api/products/${productId}/compliance-gaps`, { headers }),
        fetch(`/api/products/${productId}`, { headers }),
      ]);

      if (clRes.ok) setChecklist(await clRes.json());
      if (gapRes.ok) setGapData(await gapRes.json());
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setLifecycleStatus(prodData.lifecycleStatus || 'pre_production');
      }
    } catch (err) {
      console.error('Failed to fetch action plan data:', err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch when page regains focus (user returns from completing an action)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchData();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  if (loading) {
    return (
      <>
        <PageHeader title="Action Plan" />
        <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading action plan...</div>
      </>
    );
  }

  if (!checklist || !gapData) {
    return (
      <>
        <PageHeader title="Action Plan" />
        <div style={{ padding: '2rem', color: 'var(--muted)' }}>Unable to load action plan data.</div>
      </>
    );
  }

  const steps = mergeActionPlan(checklist, gapData);
  const summary = getActionPlanSummary(steps);
  const readinessPct = Math.round(
    (gapData.progress.obligationsMet / (gapData.progress.obligationsTotal || 1)) * 100
  );

  // Auto-expand the first incomplete platform step
  const firstIncomplete = steps.find(s => s.type === 'platform' && !s.complete);
  const activeExpanded = expandedStep ?? firstIncomplete?.id ?? null;

  // Split into phases
  const phase1Steps = steps.filter(s => s.phase === 1);
  const phase2Steps = steps.filter(s => s.phase === 2);
  const visiblePhase2 = showAllPhase2 ? phase2Steps : phase2Steps.slice(0, 10);
  const hiddenPhase2Count = phase2Steps.length - visiblePhase2.length;

  function getStepState(step: ActionPlanStep): string {
    if (step.type === 'advisory') return 'advisory';
    if (step.complete) return 'done';
    if (step.id === firstIncomplete?.id) return 'current';
    return 'upcoming';
  }

  function handleStepClick(stepId: string) {
    setExpandedStep(activeExpanded === stepId ? null : stepId);
  }

  function handleAction(step: ActionPlanStep) {
    if (step.actionPath) {
      navigate(step.actionPath);
    } else if (step.actionTab) {
      navigate(`/products/${productId}?tab=${step.actionTab}`);
    }
  }

  function renderStepNode(step: ActionPlanStep) {
    const state = getStepState(step);
    const isExpanded = activeExpanded === step.id;

    return (
      <div
        key={step.id}
        className={`ap-step ${state} ${isExpanded ? 'expanded' : ''}`}
      >
        <div
          className="ap-step-header"
          onClick={() => handleStepClick(step.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleStepClick(step.id); }}
        >
          <div className="ap-node">
            <div className="ap-node-dot">
              {state === 'done' && <CheckCircle2 size={14} />}
              {state === 'current' && <Circle size={10} fill="white" />}
              {state === 'upcoming' && <Circle size={10} />}
              {state === 'advisory' && <Info size={14} />}
            </div>
          </div>

          <span className="ap-step-title">
            {step.stepNumber && <span style={{ color: 'var(--muted)', marginRight: '0.4rem' }}>{step.stepNumber}.</span>}
            {step.title}
          </span>

          <div className="ap-step-badges">
            {step.priority && step.priority !== 'low' && (
              <span className={`ap-priority-badge ${step.priority}`}>{step.priority}</span>
            )}
            {step.estimatedReadinessGain > 0 && (
              <span className={`ap-gain-badge ${state === 'done' ? 'earned' : 'potential'}`}>
                {state === 'done' ? '✓' : '+'}{step.estimatedReadinessGain}%
              </span>
            )}
          </div>

          <ChevronRight size={14} className="ap-step-chevron" />
        </div>

        {isExpanded && (
          <div className="ap-wizard">
            <div className="ap-wizard-card">
              {step.type === 'advisory' ? (
                <>
                  <div className="ap-wizard-advisory-note">{step.description}</div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <div className="ap-wizard-why">
                      <strong>Why it matters: </strong>{step.whyItMatters}
                      {step.craReference && (
                        <span className="ap-wizard-ref"> – {step.craReference}</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="ap-wizard-what">{step.description}</div>
                  <div className="ap-wizard-why">
                    <strong>Why it matters: </strong>{step.whyItMatters}
                    {step.craReference && (
                      <span className="ap-wizard-ref"> – {step.craReference}</span>
                    )}
                  </div>
                  {!step.complete && step.actionLabel && (
                    <div className="ap-wizard-actions">
                      <button
                        className="ap-wizard-btn"
                        onClick={(e) => { e.stopPropagation(); handleAction(step); }}
                      >
                        {step.actionLabel} <ChevronRight size={13} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const allComplete = summary.remaining === 0;

  return (
    <>
      <PageHeader title="Action Plan" />

      <Link to={`/products/${productId}`} className="ap-back">
        <ArrowLeft size={14} /> Back to product
      </Link>

      {/* Readiness header */}
      <div className="ap-header">
        <div className="ap-gauge">
          <svg viewBox="0 0 120 120" className="ap-ring">
            <circle cx="60" cy="60" r="52" className="ap-ring-bg" />
            <circle cx="60" cy="60" r="52"
              className={`ap-ring-fill ${getReadinessColour(readinessPct)}`}
              strokeDasharray={`${(readinessPct / 100) * 327} 327`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="ap-pct">{readinessPct}%</div>
        </div>
        <div className="ap-header-info">
          <h2>CRA Action Plan – {checklist.productName}</h2>
          <p className="ap-header-sub">
            {getReadinessLabel(readinessPct, lifecycleStatus)}
            <span className={`badge ${getLifecycleColour(lifecycleStatus)}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', marginLeft: '0.6rem', verticalAlign: 'middle' }}>
              {getLifecycleLabel(lifecycleStatus)}
            </span>
          </p>
          <p className="ap-header-detail">
            {allComplete
              ? lifecycleStatus === 'pre_production'
                ? 'All platform actions complete. Your product is ready for market placement.'
                : 'All platform actions complete. Your product is audit-ready.'
              : lifecycleStatus === 'pre_production'
                ? `${summary.remaining} action${summary.remaining !== 1 ? 's' : ''} to complete before market placement. ${gapData.progress.obligationsMet}/${gapData.progress.obligationsTotal} obligations met.`
                : `${summary.remaining} action${summary.remaining !== 1 ? 's' : ''} remaining to reach full readiness. ${gapData.progress.obligationsMet}/${gapData.progress.obligationsTotal} obligations met.`
            }
          </p>
        </div>
      </div>

      {/* Phase 1: Foundational Steps */}
      <div className="ap-phase-label">Foundational Steps</div>

      <div className="ap-pipeline">
        {phase1Steps.map(renderStepNode)}
      </div>

      {/* Phase 2: Detail Work */}
      {phase2Steps.length > 0 && (
        <>
          <div className="ap-phase-label">Detail Work – address remaining gaps</div>
          <div className="ap-pipeline">
            {visiblePhase2.map(renderStepNode)}
          </div>

          {hiddenPhase2Count > 0 && (
            <button className="ap-show-more" onClick={() => setShowAllPhase2(true)}>
              <ChevronDown size={14} />
              Show {hiddenPhase2Count} more action{hiddenPhase2Count !== 1 ? 's' : ''}
            </button>
          )}
        </>
      )}

      {/* All complete celebration */}
      {allComplete && (
        <div className="ap-complete-card">
          <h3>All Actions Complete</h3>
          <p>
            Your product has met all trackable CRA obligations.
            Review any advisory steps above for external actions that may still be required.
          </p>
        </div>
      )}
    </>
  );
}
