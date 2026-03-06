/**
 * Supplier Due Diligence Questionnaire Types
 */

export type RiskFlagType = 'copyleft_license' | 'known_vulnerability' | 'no_supplier_info' | 'high_severity_vuln';

export interface RiskFlag {
  type: RiskFlagType;
  detail: string;
}

export interface RiskyDependency {
  name: string;
  version: string | null;
  purl: string | null;
  ecosystem: string | null;
  license: string | null;
  supplier: string | null;
  riskFlags: RiskFlag[];
  vulnCount?: number;
  highestSeverity?: string;
}

export interface QuestionnaireQuestion {
  id: string;
  category: string;
  question: string;
  rationale: string;
  craReference?: string;
}

export interface QuestionnaireContent {
  summary: string;
  riskAssessment: string;
  questions: QuestionnaireQuestion[];
  recommendedActions: string[];
}

export interface SupplierQuestionnaire {
  id: string;
  orgId: string;
  productId: string;
  dependencyName: string;
  dependencyVersion: string | null;
  dependencyPurl: string | null;
  dependencyEcosystem: string | null;
  dependencyLicense: string | null;
  dependencySupplier: string | null;
  riskFlags: RiskFlag[];
  questionnaireContent: QuestionnaireContent;
  status: 'generated' | 'sent' | 'responded' | 'reviewed';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateQuestionnairesResponse {
  generated: number;
  skipped: number;
  questionnaires: SupplierQuestionnaire[];
  riskyDependencies: RiskyDependency[];
}
