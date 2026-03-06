/**
 * CategoryRuleValidator
 * Handles validation and audit logging for category rule modifications
 * Ensures changes are aligned with regulatory requirements
 */

import pool from '../db/pool.js';
import categoryAIAugmentationService from './category-ai-augmentation.js';
import type { CategoryRuleChange, RuleChangeValidationResponse } from '../types/category-recommendation.js';

class CategoryRuleValidator {
  /**
   * Validate and record a rule attribute change
   */
  async validateAttributeChange(
    attributeId: string,
    oldValues: { name?: string; description?: string; regulatoryBasis?: string; score?: number },
    newValues: { name?: string; description?: string; regulatoryBasis?: string; score?: number },
    changedBy: string
  ): Promise<{ isValid: boolean; assessment: RuleChangeValidationResponse; requiresConfirmation: boolean }> {
    // Get the attribute to check if it's locked
    const client = await pool.connect();
    try {
      const attrResult = await client.query(
        `SELECT is_locked FROM category_rule_attributes WHERE id = $1`,
        [attributeId]
      );

      if (attrResult.rows.length === 0) {
        return {
          isValid: false,
          assessment: {
            isValid: false,
            regulatoryAlignment: 'misaligned',
            requiresOverrideConfirmation: true,
            message: 'Attribute not found',
          },
          requiresConfirmation: false,
        };
      }

      const isLocked = attrResult.rows[0].is_locked;

      // If locked, require override confirmation
      if (isLocked && Object.keys(newValues).length > 0) {
        return {
          isValid: false,
          assessment: {
            isValid: false,
            regulatoryAlignment: 'misaligned',
            requiresOverrideConfirmation: true,
            message: 'This attribute is locked to the regulatory baseline. Modifications require explicit override confirmation.',
          },
          requiresConfirmation: true,
        };
      }

      // Assess for regulatory alignment
      const assessment = await categoryAIAugmentationService.assessRuleChangeForAlignment(
        'attribute_update',
        oldValues,
        newValues
      );

      return {
        isValid: assessment.isValid,
        assessment,
        requiresConfirmation: !assessment.isValid,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Record a rule change in the audit trail
   */
  async recordRuleChange(
    changeType: string,
    entityType: 'attribute' | 'threshold',
    entityId: string,
    changedBy: string,
    oldValues: unknown,
    newValues: unknown,
    assessment: RuleChangeValidationResponse,
    isOverride = false,
    overrideReason?: string
  ): Promise<CategoryRuleChange> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO category_rule_changes (
          change_type, entity_type, entity_id, changed_by,
          old_values, new_values, ai_assessment, regulatory_alignment,
          is_override, override_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        changeType,
        entityType,
        entityId,
        changedBy,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        JSON.stringify(assessment.claudeAssessment),
        assessment.regulatoryAlignment,
        isOverride,
        overrideReason || null,
      ]);

      return this.rowToRuleChange(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Get rule change history for audit purposes
   */
  async getRuleChangeHistory(
    entityType?: 'attribute' | 'threshold',
    limit = 50
  ): Promise<CategoryRuleChange[]> {
    const client = await pool.connect();
    try {
      let query = `SELECT * FROM category_rule_changes`;
      const params: unknown[] = [];

      if (entityType) {
        query += ` WHERE entity_type = $1`;
        params.push(entityType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await client.query(query, params);
      return result.rows.map((row) => this.rowToRuleChange(row));
    } finally {
      client.release();
    }
  }

  /**
   * Convert database row to typed object
   */
  private rowToRuleChange(row: any): CategoryRuleChange {
    return {
      id: row.id,
      changeType: row.change_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      changedBy: row.changed_by,
      oldValues: JSON.parse(row.old_values || '{}'),
      newValues: JSON.parse(row.new_values || '{}'),
      aiAssessment: row.ai_assessment ? JSON.parse(row.ai_assessment) : undefined,
      regulatoryAlignment: row.regulatory_alignment,
      isOverride: row.is_override,
      overrideReason: row.override_reason,
      createdAt: row.created_at,
    };
  }
}

export default new CategoryRuleValidator();
