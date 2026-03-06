/**
 * CRA Category Recommendation Types
 * Shared types for category recommendation system
 */

export interface AttributeScore {
  attributeKey: string;
  attributeName: string;
  selectedValueId: string;
  selectedLabel: string;
  score: number;
  reasoning: string;
}

export interface DeterministicRecommendation {
  totalScore: number;
  attributeScores: AttributeScore[];
  recommendedCategory: string;
  reasoning: {
    [attributeKey: string]: {
      selectedValue: string;
      score: number;
      reasoning: string;
    };
  };
}

export interface AIAugmentation {
  appliedAdjustment: number;
  explainedReason: string;
  finalConfidence: number;
}

export interface CategoryRecommendationResponse {
  recommendation: DeterministicRecommendation;
  aiAugmentation?: AIAugmentation;
  actionUrl: string;
}

export interface RuleAttribute {
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

export interface CategoryThreshold {
  id: string;
  category: string;
  min_score: number;
  max_score: number;
  reasoning: string;
}

export interface RuleChange {
  id: string;
  change_type: string;
  entity_type: string;
  entity_id: string;
  changed_by: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ai_assessment?: string;
  regulatory_alignment: 'aligned' | 'misaligned' | 'review_required';
  is_override: boolean;
  override_reason?: string;
  created_at: string;
}
