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
