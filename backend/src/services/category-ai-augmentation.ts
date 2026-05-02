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
 * CategoryAIAugmentationService
 * Handles Claude API calls for:
 * 1. Augmenting deterministic recommendations with probabilistic reasoning
 * 2. Assessing rule changes for regulatory alignment
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AIAugmentation,
  DeterministicRecommendation,
  RuleChangeValidationResponse,
} from '../types/category-recommendation.js';

const client = new Anthropic();

class CategoryAIAugmentationService {
  /**
   * Augment a deterministic recommendation with AI assessment
   * Ask Claude if product description suggests higher/lower risk
   */
  async augmentRecommendation(
    productName: string,
    productDescription: string,
    deterministic: DeterministicRecommendation
  ): Promise<AIAugmentation | null> {
    if (!productDescription) {
      return null;
    }

    const prompt = `You are a CRA (EU Cyber Resilience Act) compliance expert. A product has been analysed using deterministic rules and scored ${deterministic.totalScore.toFixed(2)} / 1.0, recommending the "${deterministic.recommendedCategory}" CRA class.

Product:
- Name: ${productName}
- Description: ${productDescription}

Deterministic factors identified:
${deterministic.attributeScores.map((s) => `- ${s.attributeName}: ${s.selectedLabel} (score ${s.score})`).join('\n')}

Please assess:
1. Does the product description reveal any risk factors NOT captured by the deterministic attributes?
2. Should the risk score be adjusted UP or DOWN? By how much (±0.0 to ±0.2)?
3. What is your confidence in this adjustment (0.0–1.0)?

Respond in JSON format:
{
  "adjustmentApplied": <number between -0.2 and 0.2>,
  "explainedReason": "<brief explanation>",
  "confidence": <number 0.0-1.0>,
  "suggestedCategory": "<optional new category if adjustment is significant>"
}`;

    try {
      const claudeInput = prompt;
      const response = await client.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 500,
        temperature: 0.3, // Low temperature for deterministic assessment
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const claudeText =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const claudeResponse = claudeText;

      // Parse Claude's JSON response
      const jsonMatch = claudeText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const assessment = JSON.parse(jsonMatch[0]);

      return {
        claudeInput,
        claudeResponse,
        adjustmentApplied: assessment.adjustmentApplied || 0,
        explainedReason: assessment.explainedReason || '',
        confidence: assessment.confidence || 0,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      };
    } catch (error) {
      console.error('[CategoryAI] Error augmenting recommendation:', error);
      return null;
    }
  }

  /**
   * Assess a rule change for regulatory alignment
   * Used by admin endpoints when modifying category rules
   */
  async assessRuleChangeForAlignment(
    changeType: string,
    oldValues: unknown,
    newValues: unknown
  ): Promise<RuleChangeValidationResponse> {
    const prompt = `You are a CRA (EU Cyber Resilience Act) compliance expert reviewing an administrative change to risk scoring rules.

Change Type: ${changeType}
Old Values: ${JSON.stringify(oldValues, null, 2)}
New Values: ${JSON.stringify(newValues, null, 2)}

Please assess:
1. Is this change aligned with CRA regulatory requirements (Articles 3–4 on product classification)?
2. Could this change inadvertently miscategorise products and create compliance exposure?
3. Is there any conflict with ISO 42001 (AI governance) requirements?

Respond in JSON format:
{
  "regulatoryAlignment": "aligned|misaligned|review_required",
  "reasoning": "<detailed explanation>",
  "suggestedCorrections": ["<correction 1>", "<correction 2>"],
  "requiresOverride": <boolean>
}`;

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 800,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const claudeText =
        response.content[0].type === 'text' ? response.content[0].text : '';

      // Parse Claude's JSON response
      const jsonMatch = claudeText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          isValid: false,
          regulatoryAlignment: 'review_required',
          requiresOverrideConfirmation: true,
          message: 'Unable to parse AI assessment',
        };
      }

      const assessment = JSON.parse(jsonMatch[0]);

      return {
        isValid: assessment.regulatoryAlignment === 'aligned',
        regulatoryAlignment: assessment.regulatoryAlignment,
        claudeAssessment: {
          reasoning: assessment.reasoning,
          suggestedCorrections: assessment.suggestedCorrections,
        },
        requiresOverrideConfirmation: assessment.requiresOverride,
        message: assessment.reasoning,
      };
    } catch (error) {
      console.error('[CategoryAI] Error assessing rule change:', error);
      return {
        isValid: false,
        regulatoryAlignment: 'review_required',
        requiresOverrideConfirmation: true,
        message: 'Error during AI assessment: ' + (error instanceof Error ? error.message : String(error)),
      };
    }
  }
}

export default new CategoryAIAugmentationService();
