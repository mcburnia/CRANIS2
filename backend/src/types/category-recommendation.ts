/**
 * CRA Category Recommendation System Types
 * ISO 42001 Compliant – Deterministic + Probabilistic with full audit trails
 */

export interface CategoryRuleAttribute {
  id: string;
  attributeKey: string;
  name: string;
  description: string;
  regulatoryBasis: string;
  minScore: number; // 0.0
  maxScore: number; // 1.0
  isLocked: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  createdAt: Date;
}

export interface CategoryRuleAttributeValue {
  id: string;
  attributeId: string;
  label: string;
  description?: string;
  score: number; // 0.0–1.0
  reasoning?: string;
  createdAt: Date;
}

export interface CategoryThreshold {
  id: string;
  categoryKey: string; // 'default', 'important_i', 'important_ii', 'critical'
  categoryName: string;
  minScore: number;
  maxScore: number;
  reasoning: string;
  isLocked: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  createdAt: Date;
}

/**
 * Deterministic scoring for a single attribute
 */
export interface AttributeScore {
  attributeKey: string;
  attributeName: string;
  selectedValueId: string;
  selectedLabel: string;
  score: number;
  reasoning: string;
}

/**
 * Deterministic recommendation output
 */
export interface DeterministicRecommendation {
  totalScore: number; // Sum of all attribute scores normalized to 0.0–1.0
  attributeScores: AttributeScore[];
  recommendedCategory: string; // The CRA class
  reasoning: {
    [attributeKey: string]: {
      selectedValue: string;
      score: number;
      reasoning: string;
    };
  };
}

/**
 * AI Augmentation via Claude
 */
export interface AIAugmentation {
  claudeInput: string; // Verbatim prompt sent
  claudeResponse: string; // Full response
  adjustmentApplied: number; // ±0.1–0.2
  explainedReason: string;
  confidence: number; // 0.0–1.0
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Full category recommendation record (for audit trail)
 */
export interface CategoryRecommendation {
  id: string;
  orgId: string;
  productId: string;
  userId?: string;
  createdAt: Date;
  deterministicScore: number;
  deterministicReasoning: {
    [attributeKey: string]: {
      selectedValue: string;
      score: number;
      reasoning: string;
    };
  };
  recommendedCategory: string;
  confidenceScore?: number; // After AI augmentation
  aiAugmentation?: AIAugmentation;
  userAction?: 'accepted' | 'overridden' | 'dismissed' | 'pending';
  finalCategory?: string; // What user actually set
  finalizedAt?: Date;
}

/**
 * Rule change tracking for admin modifications
 */
export interface CategoryRuleChange {
  id: string;
  changeType: 'attribute_created' | 'attribute_updated' | 'attribute_deleted' | 'threshold_updated';
  entityType: 'attribute' | 'threshold';
  entityId: string;
  changedBy: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  aiAssessment?: {
    regulatoryAlignment: 'aligned' | 'misaligned' | 'review_required';
    reasoning: string;
    suggestedCorrections?: unknown[];
  };
  regulatoryAlignment?: 'aligned' | 'misaligned' | 'review_required';
  isOverride: boolean;
  overrideReason?: string;
  createdAt: Date;
}

/**
 * Access log entry for audit trail
 */
export interface RecommendationAccessLog {
  id: string;
  recommendationId: string;
  userId: string;
  userEmail: string;
  action: 'viewed' | 'exported' | 'accepted' | 'overridden' | 'dismissed';
  accessedAt: Date;
}

/**
 * Request body for getting a recommendation
 */
export interface CategoryRecommendationRequest {
  productId: string;
  attributeValues?: {
    [attributeKey: string]: string; // Selected value label
  };
}

/**
 * Response body for a recommendation
 */
export interface CategoryRecommendationResponse {
  recommendation: DeterministicRecommendation;
  aiAugmentation?: {
    appliedAdjustment: number;
    explainedReason: string;
    finalConfidence: number;
  };
  actionUrl: string; // Where to accept/override
}

/**
 * Admin endpoint response for rule changes
 */
export interface RuleChangeValidationResponse {
  isValid: boolean;
  regulatoryAlignment: 'aligned' | 'misaligned' | 'review_required';
  claudeAssessment?: {
    reasoning: string;
    suggestedCorrections?: string[];
  };
  requiresOverrideConfirmation: boolean;
  message: string;
}
