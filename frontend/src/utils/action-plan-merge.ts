/**
 * Action Plan Merge Utility
 *
 * Merges the 7-step compliance checklist and compliance gap analysis
 * into a unified, sequenced action plan for guided readiness workflows.
 *
 * Phase 1: Foundational checklist steps (always shown first, in order)
 * Phase 2: Detail work from compliance gaps (deduplicated against Phase 1)
 * Advisory: External actions that cannot be completed in-platform
 */

// ── Types ──

export interface ActionPlanStep {
  id: string;
  phase: 1 | 2;
  type: 'platform' | 'advisory';
  title: string;
  description: string;
  whyItMatters: string;
  craReference: string;
  complete: boolean;
  estimatedReadinessGain: number;
  actionLabel?: string;
  actionTab?: string;
  actionPath?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  stepNumber?: number;
}

export interface ChecklistStep {
  id: string;
  step: number;
  title: string;
  description: string;
  complete: boolean;
  actionLabel: string;
  actionTab: string | null;
  actionPath: string | null;
}

export interface ChecklistData {
  productId: string;
  productName: string;
  stepsComplete: number;
  stepsTotal: number;
  complete: boolean;
  steps: ChecklistStep[];
}

export interface ComplianceGap {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  action: string;
  craReference: string;
  actionTab?: string;
  actionPath?: string;
}

export interface GapProgress {
  obligationsMet: number;
  obligationsTotal: number;
  techFileSections: number;
  techFileTotal: number;
  openVulns: number;
  hasSbom: boolean;
  sbomStale: boolean;
}

export interface ComplianceGapData {
  productId: string;
  productName: string;
  craCategory: string;
  gaps: ComplianceGap[];
  progress: GapProgress;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ── CRA article explanations for Phase 1 steps ──

const CHECKLIST_WHY: Record<string, { why: string; ref: string }> = {
  connect_repo: {
    why: 'CRA Article 13(11) requires a Software Bill of Materials identifying all components. Connecting your repository generates this automatically.',
    ref: 'Art. 13(11)',
  },
  set_category: {
    why: 'Your CRA category determines which conformity assessment route applies and which obligations are relevant to your product.',
    ref: 'Art. 6–9',
  },
  triage_findings: {
    why: 'CRA Article 13(5) prohibits placing products with known exploitable vulnerabilities on the market. All findings must be resolved.',
    ref: 'Art. 13(5)',
  },
  technical_file: {
    why: 'CRA Annex VII requires a technical file documenting product description, vulnerability handling, and risk assessment before market placement.',
    ref: 'Annex VII',
  },
  stakeholders: {
    why: 'A manufacturer contact (Art. 13) and security contact (Art. 14) must be identified for the EU Declaration of Conformity and vulnerability coordination.',
    ref: 'Art. 13, Art. 14',
  },
  eu_doc: {
    why: 'CRA Article 16 requires drawing up an EU Declaration of Conformity before placing the product on the market.',
    ref: 'Art. 16',
  },
  compliance_package: {
    why: 'A complete compliance package (SBOM, vulnerability summary, technical file, and DoC) provides audit-ready evidence of CRA compliance.',
    ref: 'Art. 13, Annex VII',
  },
};

// ── Gap categories that map to checklist steps ──

const GAP_TO_CHECKLIST: Record<string, string> = {
  sbom: 'connect_repo',
  vulnerabilities: 'triage_findings',
  technical_file: 'technical_file',
  stakeholders: 'stakeholders',
};

// ── Advisory steps ──

function getAdvisorySteps(craCategory: string): { afterStep: string; step: Omit<ActionPlanStep, 'estimatedReadinessGain'> }[] {
  const advisories: { afterStep: string; step: Omit<ActionPlanStep, 'estimatedReadinessGain'> }[] = [];

  advisories.push({
    afterStep: 'technical_file',
    step: {
      id: 'advisory_pen_test',
      phase: 1,
      type: 'advisory',
      title: 'Consider penetration testing',
      description: 'Independent security testing strengthens your risk assessment and provides evidence of due diligence under Annex I. This is performed externally — engage a qualified testing provider.',
      whyItMatters: 'Annex I Part I requires demonstrating that the product is designed and developed with an appropriate level of cybersecurity. Penetration testing provides independent evidence.',
      craReference: 'Annex I, Part I',
      complete: false,
      category: 'advisory',
    },
  });

  if (craCategory === 'important_ii' || craCategory === 'critical') {
    advisories.push({
      afterStep: 'eu_doc',
      step: {
        id: 'advisory_notified_body',
        phase: 1,
        type: 'advisory',
        title: 'Engage a notified body for conformity assessment',
        description: `Products classified as ${craCategory === 'critical' ? 'Critical' : 'Important Class II'} require third-party conformity assessment by a notified body. Contact a designated body to begin the assessment process.`,
        whyItMatters: 'CRA Article 32 requires Important Class II and Critical products to undergo conformity assessment by a notified body, rather than self-assessment.',
        craReference: 'Art. 32',
        complete: false,
        category: 'advisory',
      },
    });
  }

  return advisories;
}

// ── Main merge function ──

export function mergeActionPlan(
  checklist: ChecklistData,
  gapData: ComplianceGapData
): ActionPlanStep[] {
  const totalObligations = gapData.progress.obligationsTotal || 1;
  const gainPerObligation = Math.max(1, Math.round(100 / totalObligations));

  const steps: ActionPlanStep[] = [];

  // Phase 1: Checklist steps
  const completedChecklistIds = new Set(
    checklist.steps.filter(s => s.complete).map(s => s.id)
  );

  const advisories = getAdvisorySteps(gapData.craCategory);

  for (const cs of checklist.steps) {
    const whyInfo = CHECKLIST_WHY[cs.id] || { why: cs.description, ref: '' };

    steps.push({
      id: cs.id,
      phase: 1,
      type: 'platform',
      title: cs.title,
      description: cs.description,
      whyItMatters: whyInfo.why,
      craReference: whyInfo.ref,
      complete: cs.complete,
      estimatedReadinessGain: cs.complete ? 0 : gainPerObligation * 2,
      actionLabel: cs.actionLabel,
      actionTab: cs.actionTab || undefined,
      actionPath: cs.actionPath || undefined,
      category: cs.id,
      stepNumber: cs.step,
    });

    // Insert advisory steps after the relevant checklist step
    for (const adv of advisories) {
      if (adv.afterStep === cs.id) {
        steps.push({
          ...adv.step,
          estimatedReadinessGain: 0,
        });
      }
    }
  }

  // Phase 2: Gaps not covered by Phase 1
  // A gap is "covered" if it maps to an incomplete checklist step
  // (the checklist step already guides the user to fix it)
  // A gap is "surfaced" if it maps to a completed checklist step
  // (it's a refinement — e.g. "SBOM stale" when repo is connected)
  for (const gap of gapData.gaps) {
    const mappedChecklistId = GAP_TO_CHECKLIST[gap.category];

    if (mappedChecklistId) {
      // Skip if the checklist step for this category is still incomplete
      if (!completedChecklistIds.has(mappedChecklistId)) continue;
    }

    // Skip obligation gaps that are just "in progress" status
    if (gap.category === 'obligations' && gap.priority === 'low') continue;

    steps.push({
      id: `phase2-${gap.id}`,
      phase: 2,
      type: 'platform',
      title: gap.title,
      description: gap.description,
      whyItMatters: `${gap.action}. Required under ${gap.craReference}.`,
      craReference: gap.craReference,
      complete: false,
      estimatedReadinessGain: gainPerObligation,
      actionLabel: gap.actionTab ? `Go to ${formatTabLabel(gap.actionTab)}` : gap.actionPath ? 'Go to page' : undefined,
      actionTab: gap.actionTab,
      actionPath: gap.actionPath,
      priority: gap.priority,
      category: gap.category,
    });
  }

  return steps;
}

function formatTabLabel(tab: string): string {
  return tab
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Summary helpers ──

export function getActionPlanSummary(steps: ActionPlanStep[]) {
  const total = steps.filter(s => s.type === 'platform').length;
  const completed = steps.filter(s => s.type === 'platform' && s.complete).length;
  const remaining = total - completed;
  const phase1Remaining = steps.filter(s => s.phase === 1 && s.type === 'platform' && !s.complete).length;
  const phase2Remaining = steps.filter(s => s.phase === 2 && s.type === 'platform' && !s.complete).length;

  return { total, completed, remaining, phase1Remaining, phase2Remaining };
}
