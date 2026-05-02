/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * CategoryRecommendationService
 * Handles deterministic risk scoring and CRA category recommendations
 */

import pool from '../db/pool.js';
import type {
  CategoryRecommendation,
  DeterministicRecommendation,
  AttributeScore,
  CategoryRecommendationRequest,
} from '../types/category-recommendation.js';

class CategoryRecommendationService {
  /**
   * Compute deterministic recommendation for a product
   * Returns score breakdown and recommended CRA category
   */
  async computeRecommendation(
    productId: string,
    attributeValues: { [attributeKey: string]: string } = {}
  ): Promise<DeterministicRecommendation> {
    const client = await pool.connect();
    try {
      // Get all attributes and their values
      const attrsResult = await client.query(`
        SELECT 
          a.id, a.attribute_key, a.name,
          v.id AS value_id, v.label, v.score, v.reasoning
        FROM category_rule_attributes a
        LEFT JOIN category_rule_attribute_values v ON a.id = v.attribute_id
        ORDER BY a.attribute_key, v.score
      `);

      // Build attribute map: { attribute_key -> [values] }
      const attributeMap: {
        [key: string]: {
          id: string;
          name: string;
          values: Array<{ id: string; label: string; score: number; reasoning: string }>;
        };
      } = {};

      for (const row of attrsResult.rows) {
        if (!attributeMap[row.attribute_key]) {
          attributeMap[row.attribute_key] = {
            id: row.id,
            name: row.name,
            values: [],
          };
        }
        if (row.value_id) {
          attributeMap[row.attribute_key].values.push({
            id: row.value_id,
            label: row.label,
            score: parseFloat(row.score),
            reasoning: row.reasoning,
          });
        }
      }

      // Score each attribute
      const attributeScores: AttributeScore[] = [];
      let totalScore = 0;

      for (const [key, attr] of Object.entries(attributeMap)) {
        const selectedLabel = attributeValues[key] || attr.values[0].label;
        const selectedValue = attr.values.find((v) => v.label === selectedLabel) || attr.values[0];

        attributeScores.push({
          attributeKey: key,
          attributeName: attr.name,
          selectedValueId: selectedValue.id,
          selectedLabel: selectedValue.label,
          score: selectedValue.score,
          reasoning: selectedValue.reasoning,
        });

        totalScore += selectedValue.score;
      }

      // Normalize to 0.0–1.0
      const normalizedScore =
        attributeScores.length > 0
          ? totalScore / attributeScores.length
          : 0;

      // Determine recommended category
      const thresholdResult = await client.query(`
        SELECT category_key, category_name
        FROM category_thresholds
        WHERE $1 >= min_score AND $1 < max_score
        ORDER BY min_score DESC
        LIMIT 1
      `, [normalizedScore]);

      const recommendedCategory =
        thresholdResult.rows.length > 0
          ? thresholdResult.rows[0].category_key
          : 'default';

      // Build reasoning object
      const reasoning: {
        [key: string]: {
          selectedValue: string;
          score: number;
          reasoning: string;
        };
      } = {};
      for (const score of attributeScores) {
        reasoning[score.attributeKey] = {
          selectedValue: score.selectedLabel,
          score: score.score,
          reasoning: score.reasoning,
        };
      }

      return {
        totalScore: normalizedScore,
        attributeScores,
        recommendedCategory,
        reasoning,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Store a recommendation in the audit trail
   */
  async storeRecommendation(
    orgId: string,
    productId: string,
    userId: string | undefined,
    deterministic: DeterministicRecommendation,
    confidenceScore?: number,
    aiAugmentation?: unknown
  ): Promise<CategoryRecommendation> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO category_recommendations (
          org_id, product_id, user_id, deterministic_score,
          deterministic_reasoning, recommended_category, confidence_score,
          ai_augmentation, user_action
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        orgId,
        productId,
        userId || null,
        deterministic.totalScore,
        JSON.stringify(deterministic.reasoning),
        deterministic.recommendedCategory,
        confidenceScore || null,
        JSON.stringify(aiAugmentation) || null,
        'pending',
      ]);

      return this.rowToRecommendation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get recommendation history for a product
   */
  async getRecommendationHistory(productId: string, limit = 10): Promise<CategoryRecommendation[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM category_recommendations
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [productId, limit]);

      return result.rows.map((row) => this.rowToRecommendation(row));
    } finally {
      client.release();
    }
  }

  /**
   * Get latest recommendation for a product
   */
  async getLatestRecommendation(productId: string): Promise<CategoryRecommendation | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM category_recommendations
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [productId]);

      return result.rows.length > 0 ? this.rowToRecommendation(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  /**
   * Record user action on a recommendation (accept/override/dismiss)
   */
  async recordUserAction(
    recommendationId: string,
    userId: string,
    action: 'accepted' | 'overridden' | 'dismissed',
    finalCategory?: string
  ): Promise<CategoryRecommendation> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE category_recommendations
        SET user_action = $2, final_category = $3, finalized_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [recommendationId, action, finalCategory || null]);

      // Log access
      await client.query(`
        INSERT INTO recommendation_access_log (recommendation_id, user_id, user_email, action)
        SELECT $1, $2, email, $3 FROM users WHERE id = $2
      `, [recommendationId, userId, action]);

      return this.rowToRecommendation(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Convert database row to typed object
   */
  private rowToRecommendation(row: any): CategoryRecommendation {
    return {
      id: row.id,
      orgId: row.org_id,
      productId: row.product_id,
      userId: row.user_id,
      createdAt: row.created_at,
      deterministicScore: parseFloat(row.deterministic_score),
      deterministicReasoning: typeof row.deterministic_reasoning === 'string'
        ? JSON.parse(row.deterministic_reasoning)
        : row.deterministic_reasoning,
      recommendedCategory: row.recommended_category,
      confidenceScore: row.confidence_score ? parseFloat(row.confidence_score) : undefined,
      aiAugmentation: row.ai_augmentation
        ? (typeof row.ai_augmentation === 'string' ? JSON.parse(row.ai_augmentation) : row.ai_augmentation)
        : undefined,
      userAction: row.user_action,
      finalCategory: row.final_category,
      finalizedAt: row.finalized_at,
    };
  }
}

export default new CategoryRecommendationService();
