/**
 * Conformity Assessment Module Selector
 *
 * Determines the applicable conformity assessment procedure (Module A, B+C, or H)
 * based on the product's CRA category, per Articles 32–33 and Annex VIII.
 *
 * CRA Conformity Assessment Modules:
 *   Module A  – Internal control (self-assessment by manufacturer)
 *   Module B  – EU-type examination (notified body examines type)
 *   Module C  – Conformity to type (manufacturer ensures production matches type)
 *   Module H  – Full quality assurance (notified body approves quality system)
 *
 * Decision rules (CRA Art. 32):
 *   Default       → Module A only
 *   Important I   → Module A if harmonised standards fully applied, otherwise B+C
 *   Important II  → B+C mandatory (third-party type examination)
 *   Critical      → Module H mandatory (or EU cybersecurity certification scheme per Art. 32(3))
 */

export interface ConformityModule {
  id: string;
  name: string;
  fullName: string;
  description: string;
  legalBasis: string;
  requiresNotifiedBody: boolean;
}

export interface ConformityAssessmentResult {
  category: string;
  categoryLabel: string;
  applicableModules: ConformityModule[];
  primaryModule: ConformityModule;
  condition: string | null;
  requirements: string[];
  technicalFileActions: string[];
  estimatedTimeline: string;
  regulatoryNotes: string[];
}

// ─── Module definitions ──────────────────────────────────────

const MODULE_A: ConformityModule = {
  id: 'module_a',
  name: 'Module A',
  fullName: 'Module A – Internal Control',
  description: 'The manufacturer carries out an internal assessment of conformity. No notified body involvement required. The manufacturer draws up the technical documentation, ensures the manufacturing process complies, and issues the EU Declaration of Conformity.',
  legalBasis: 'CRA Annex VIII, Part I',
  requiresNotifiedBody: false,
};

const MODULE_B: ConformityModule = {
  id: 'module_b',
  name: 'Module B',
  fullName: 'Module B – EU-Type Examination',
  description: 'A notified body examines the technical design of the product and verifies it meets the essential cybersecurity requirements. Results in an EU-type examination certificate.',
  legalBasis: 'CRA Annex VIII, Part II',
  requiresNotifiedBody: true,
};

const MODULE_C: ConformityModule = {
  id: 'module_c',
  name: 'Module C',
  fullName: 'Module C – Conformity to Type',
  description: 'The manufacturer ensures that each product conforms to the type described in the EU-type examination certificate. Used in combination with Module B.',
  legalBasis: 'CRA Annex VIII, Part III',
  requiresNotifiedBody: false,
};

const MODULE_H: ConformityModule = {
  id: 'module_h',
  name: 'Module H',
  fullName: 'Module H – Full Quality Assurance',
  description: 'A notified body assesses and approves the manufacturer\'s full quality assurance system for design, production, and testing. The most rigorous assessment path.',
  legalBasis: 'CRA Annex VIII, Part IV',
  requiresNotifiedBody: true,
};

// ─── Category labels ──────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  default: 'Default',
  important_i: 'Important Class I',
  important_ii: 'Important Class II',
  critical: 'Critical',
};

// ─── Decision logic ──────────────────────────────────────

export function getConformityAssessment(
  category: string,
  harmonisedStandardsApplied: boolean = false
): ConformityAssessmentResult {
  const normalisedCategory = normaliseCategory(category);

  switch (normalisedCategory) {
    case 'default':
      return buildDefaultResult(harmonisedStandardsApplied);
    case 'important_i':
      return buildImportantIResult(harmonisedStandardsApplied);
    case 'important_ii':
      return buildImportantIIResult();
    case 'critical':
      return buildCriticalResult();
    default:
      return buildDefaultResult(harmonisedStandardsApplied);
  }
}

function normaliseCategory(category: string): string {
  const mapping: Record<string, string> = {
    'default': 'default',
    'important_i': 'important_i',
    'important_ii': 'important_ii',
    'critical': 'critical',
    'category-1': 'important_i',
    'class_i': 'important_i',
    'category-2': 'important_ii',
    'class_ii': 'important_ii',
  };
  return mapping[category] || 'default';
}

function buildDefaultResult(_harmonisedStandardsApplied: boolean): ConformityAssessmentResult {
  return {
    category: 'default',
    categoryLabel: CATEGORY_LABELS.default,
    applicableModules: [MODULE_A],
    primaryModule: MODULE_A,
    condition: null,
    requirements: [
      'Complete technical documentation per Annex VII',
      'Perform internal conformity assessment',
      'Draw up EU Declaration of Conformity per Annex VI',
      'Affix CE marking to the product',
    ],
    technicalFileActions: [
      'Complete all 8 technical file sections',
      'Document vulnerability handling process',
      'Include SBOM in machine-readable format',
      'Record the conformity assessment procedure used (Module A)',
    ],
    estimatedTimeline: '2–4 weeks (internal assessment)',
    regulatoryNotes: [
      'No notified body involvement required.',
      'The manufacturer bears full responsibility for conformity.',
      'Technical documentation must be retained for 10 years after market placement (Art. 13(10)).',
    ],
  };
}

function buildImportantIResult(harmonisedStandardsApplied: boolean): ConformityAssessmentResult {
  if (harmonisedStandardsApplied) {
    return {
      category: 'important_i',
      categoryLabel: CATEGORY_LABELS.important_i,
      applicableModules: [MODULE_A],
      primaryModule: MODULE_A,
      condition: 'Harmonised standards fully applied: self-assessment permitted.',
      requirements: [
        'Apply all relevant harmonised standards (EN 18031-1, EN 18031-2, EN 18031-3 where applicable)',
        'Document which standards were applied and how each requirement is met',
        'Complete technical documentation per Annex VII',
        'Perform internal conformity assessment under Module A',
        'Draw up EU Declaration of Conformity referencing the applied standards',
        'Affix CE marking to the product',
      ],
      technicalFileActions: [
        'Complete all 8 technical file sections',
        'List all harmonised standards applied in Section 6 (Standards Applied)',
        'Provide evidence of compliance with each standard requirement',
        'Include SBOM in machine-readable format',
        'Record the conformity assessment procedure used (Module A with harmonised standards)',
      ],
      estimatedTimeline: '4–8 weeks (internal assessment with standards documentation)',
      regulatoryNotes: [
        'Self-assessment (Module A) is permitted because harmonised standards are fully applied.',
        'If harmonised standards are revised or withdrawn, the assessment may need to be repeated.',
        'The manufacturer must monitor the Official Journal for changes to referenced standards.',
        'Art. 32(2): Where harmonised standards have not been applied, or only partially, the manufacturer must use Module B+C.',
      ],
    };
  }

  // No harmonised standards → Module B+C required
  return {
    category: 'important_i',
    categoryLabel: CATEGORY_LABELS.important_i,
    applicableModules: [MODULE_B, MODULE_C],
    primaryModule: MODULE_B,
    condition: 'Harmonised standards NOT fully applied: third-party assessment required.',
    requirements: [
      'Engage a notified body for EU-type examination (Module B)',
      'Submit technical documentation to the notified body',
      'Obtain EU-type examination certificate',
      'Ensure production conformity to the certified type (Module C)',
      'Draw up EU Declaration of Conformity referencing the certificate',
      'Affix CE marking with notified body identification number',
    ],
    technicalFileActions: [
      'Complete all 8 technical file sections',
      'Prepare technical file for notified body submission',
      'Document why harmonised standards were not fully applied',
      'Include SBOM in machine-readable format',
      'Record the conformity assessment procedure used (Module B+C)',
      'Store notified body certificate and reference number',
    ],
    estimatedTimeline: '3–6 months (notified body examination)',
    regulatoryNotes: [
      'A notified body must examine the product type and issue a certificate.',
      'Alternatively, fully applying harmonised standards would allow Module A (self-assessment).',
      'The manufacturer should check if relevant harmonised standards exist, as this may reduce cost and time.',
      'Art. 32(2): Important Class I products that do not apply harmonised standards must use Module B+C or Module H.',
    ],
  };
}

function buildImportantIIResult(): ConformityAssessmentResult {
  return {
    category: 'important_ii',
    categoryLabel: CATEGORY_LABELS.important_ii,
    applicableModules: [MODULE_B, MODULE_C, MODULE_H],
    primaryModule: MODULE_B,
    condition: 'Third-party conformity assessment is mandatory regardless of harmonised standards.',
    requirements: [
      'Engage a notified body for either EU-type examination (Module B+C) or full quality assurance (Module H)',
      'Submit technical documentation to the notified body',
      'For Module B+C: obtain EU-type examination certificate and maintain production conformity',
      'For Module H: implement and maintain a notified-body-approved quality assurance system',
      'Draw up EU Declaration of Conformity referencing the certificate or approval',
      'Affix CE marking with notified body identification number',
    ],
    technicalFileActions: [
      'Complete all 8 technical file sections to notified body submission standard',
      'Prepare comprehensive technical file package',
      'Document security by design decisions and risk assessment',
      'Include complete SBOM history in machine-readable format',
      'Record the conformity assessment procedure used (Module B+C or Module H)',
      'Store notified body certificate/approval and reference number',
    ],
    estimatedTimeline: '4–9 months (notified body examination or quality system approval)',
    regulatoryNotes: [
      'Third-party assessment is mandatory. Self-assessment (Module A) is NOT permitted for Important Class II.',
      'The manufacturer may choose between Module B+C (type examination) or Module H (full quality assurance).',
      'Module H may be more efficient for manufacturers with multiple product variants.',
      'Applying harmonised standards does NOT exempt Important Class II from third-party assessment.',
      'Art. 32(3): The use of a European cybersecurity certification scheme may satisfy this requirement.',
    ],
  };
}

function buildCriticalResult(): ConformityAssessmentResult {
  return {
    category: 'critical',
    categoryLabel: CATEGORY_LABELS.critical,
    applicableModules: [MODULE_H],
    primaryModule: MODULE_H,
    condition: 'Full quality assurance with notified body approval is mandatory.',
    requirements: [
      'Engage a notified body for full quality assurance system assessment (Module H)',
      'Implement a comprehensive quality management system covering design, production, testing, and post-market surveillance',
      'Submit quality system documentation and technical file to the notified body',
      'Obtain notified body approval of the quality assurance system',
      'Maintain the quality system under periodic notified body surveillance',
      'Draw up EU Declaration of Conformity referencing the approval',
      'Affix CE marking with notified body identification number',
      'Register with the relevant market surveillance authority (Art. 20)',
    ],
    technicalFileActions: [
      'Complete all 8 technical file sections to the highest standard',
      'Prepare quality management system documentation',
      'Document comprehensive security risk assessment with threat modelling',
      'Include complete SBOM history with all versions in machine-readable format',
      'Document post-market monitoring procedures',
      'Record the conformity assessment procedure used (Module H)',
      'Store notified body approval, surveillance reports, and reference numbers',
      'Prepare market surveillance registration documentation',
    ],
    estimatedTimeline: '6–12 months (quality system approval and ongoing surveillance)',
    regulatoryNotes: [
      'Module H (full quality assurance) is mandatory for Critical category products.',
      'The notified body conducts initial assessment AND periodic surveillance of the quality system.',
      'Art. 32(3): A European cybersecurity certification scheme at assurance level "high" may be used as an alternative.',
      'Market surveillance registration (Art. 20) is also required for critical products.',
      'This is the most rigorous assessment path. Plan accordingly.',
      'Quality system changes must be notified to the notified body for approval.',
    ],
  };
}

// ─── Public page helper (no auth required) ──────────────────

export interface PublicAssessmentInput {
  productType: string;
  category: string;
  harmonisedStandardsApplied: boolean;
}

export function getPublicConformityAssessment(input: PublicAssessmentInput): ConformityAssessmentResult {
  return getConformityAssessment(input.category, input.harmonisedStandardsApplied);
}

// ─── Export all modules for reference ──────────────────

export const CONFORMITY_MODULES = {
  MODULE_A,
  MODULE_B,
  MODULE_C,
  MODULE_H,
};
