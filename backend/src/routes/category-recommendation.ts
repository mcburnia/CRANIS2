/**
 * POST /:productId/category-recommendation — Get AI recommendation
 * GET /:productId/category-recommendation-history — View history
 * POST /:productId/category-recommendation/:recId/action — Accept/override/dismiss
 * Admin: GET /admin/category-rules — View all rules
 * Admin: PUT /admin/category-rules/attributes/:attributeId — Edit attribute
 * Admin: PUT /admin/category-rules/thresholds/:categoryKey — Edit threshold
 * Admin: GET /admin/category-rules-audit — View change history
 *
 * Mount at: app.use('/api/products', categoryRecommendationRoutes)
 * Mount at: app.use('/api/admin', ...admin routes handled by admin.ts)
 */

import express from 'express';
import requireAuth from '../middleware/requireAuth.js';
import requirePlatformAdmin from '../middleware/requirePlatformAdmin.js';
import pool from '../db/pool.js';
import categoryRecommendationService from '../services/category-recommendation.js';
import categoryAIAugmentationService from '../services/category-ai-augmentation.js';
import categoryRuleValidator from '../services/category-rule-validator.js';
import type { Request, Response } from 'express';
import type {
  CategoryRecommendationRequest,
  CategoryRecommendationResponse,
  RuleChangeValidationResponse,
} from '../types/category-recommendation.js';

const router = express.Router();

/**
 * POST /:productId/category-recommendation
 * Get a new category recommendation for a product (deterministic + AI augmented)
 */
router.post(
  '/:productId/category-recommendation',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const { attributeValues } = req.body as CategoryRecommendationRequest;

      const userId = req.user?.id;
      const orgId = req.user?.orgId;

      if (!orgId) {
        return res.status(400).json({ error: 'No organisation context' });
      }

      // Verify product belongs to org
      const client = await pool.connect();
      let product: any;
      try {
        const productCheck = await client.query(
          `SELECT id, name, description FROM products WHERE id = $1 AND org_id = $2`,
          [productId, orgId]
        );

        if (productCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }

        product = productCheck.rows[0];
      } finally {
        client.release();
      }

      // Compute deterministic recommendation
      const deterministic = await categoryRecommendationService.computeRecommendation(
        productId,
        attributeValues
      );

      // Augment with AI assessment
      const aiAugmentation = await categoryAIAugmentationService.augmentRecommendation(
        product.name,
        product.description || '',
        deterministic
      );

      const finalConfidence = aiAugmentation ? aiAugmentation.confidence : undefined;

      // Store in audit trail
      const recommendation = await categoryRecommendationService.storeRecommendation(
        orgId,
        productId,
        userId,
        deterministic,
        finalConfidence,
        aiAugmentation
      );

      const response: CategoryRecommendationResponse = {
        recommendation: deterministic,
        aiAugmentation: aiAugmentation
          ? {
              appliedAdjustment: aiAugmentation.adjustmentApplied,
              explainedReason: aiAugmentation.explainedReason,
              finalConfidence: aiAugmentation.confidence,
            }
          : undefined,
        actionUrl: `/api/products/${productId}/category-recommendation/${recommendation.id}/action`,
      };

      res.json(response);
    } catch (error) {
      console.error('[CategoryRec] Error:', error);
      res.status(500).json({ error: 'Failed to generate recommendation' });
    }
  }
);

/**
 * GET /:productId/category-recommendation-history
 * View past recommendations for a product
 */
router.get(
  '/:productId/category-recommendation-history',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const orgId = req.user?.orgId;

      if (!orgId) {
        return res.status(400).json({ error: 'No organisation context' });
      }

      // Verify product belongs to org
      const client = await pool.connect();
      try {
        const productCheck = await client.query(
          `SELECT id FROM products WHERE id = $1 AND org_id = $2`,
          [productId, orgId]
        );

        if (productCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }
      } finally {
        client.release();
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const history = await categoryRecommendationService.getRecommendationHistory(productId, limit);

      res.json(history);
    } catch (error) {
      console.error('[CategoryRec] Error:', error);
      res.status(500).json({ error: 'Failed to retrieve history' });
    }
  }
);

/**
 * POST /:productId/category-recommendation/:recId/action
 * User accepts, overrides, or dismisses a recommendation
 */
router.post(
  '/:productId/category-recommendation/:recId/action',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, recId } = req.params;
      const { action, finalCategory } = req.body as {
        action: 'accepted' | 'overridden' | 'dismissed';
        finalCategory?: string;
      };

      const userId = req.user?.id;
      const orgId = req.user?.orgId;

      if (!orgId || !userId) {
        return res.status(400).json({ error: 'Invalid user context' });
      }

      if (!['accepted', 'overridden', 'dismissed'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      // Verify recommendation belongs to this org and product
      const client = await pool.connect();
      try {
        const recCheck = await client.query(
          `SELECT id FROM category_recommendations WHERE id = $1 AND org_id = $2 AND product_id = $3`,
          [recId, orgId, productId]
        );

        if (recCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Recommendation not found' });
        }
      } finally {
        client.release();
      }

      // Record user action
      const updated = await categoryRecommendationService.recordUserAction(
        recId,
        userId,
        action,
        finalCategory
      );

      // If accepted, also update the product's CRA category
      if (action === 'accepted' && finalCategory) {
        await pool.query(`UPDATE products SET cra_category = $1 WHERE id = $2`, [finalCategory, productId]);
      }

      res.json(updated);
    } catch (error) {
      console.error('[CategoryRec] Error:', error);
      res.status(500).json({ error: 'Failed to record action' });
    }
  }
);

// ── Admin Routes (exported separately for admin router) ──

/**
 * Get all category rule attributes and thresholds
 */
export async function getCategoryRules(req: Request, res: Response) {
  try {
    const client = await pool.connect();
    try {
      const attrsResult = await client.query(`
        SELECT a.id, a.attribute_key, a.name, a.description, a.regulatory_basis,
               a.is_locked, a.last_modified_by, a.last_modified_at,
               json_agg(
                 json_build_object(
                   'id', v.id, 'label', v.label, 'score', v.score, 'reasoning', v.reasoning
                 )
                 ORDER BY v.score
               ) FILTER (WHERE v.id IS NOT NULL) AS values
        FROM category_rule_attributes a
        LEFT JOIN category_rule_attribute_values v ON a.id = v.attribute_id
        GROUP BY a.id
        ORDER BY a.attribute_key
      `);

      const thresholdsResult = await client.query(`
        SELECT * FROM category_thresholds ORDER BY min_score
      `);

      res.json({
        attributes: attrsResult.rows,
        thresholds: thresholdsResult.rows,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[CategoryRec] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve rules' });
  }
}

/**
 * Modify a category rule attribute (with AI validation)
 */
export async function updateCategoryAttribute(req: Request, res: Response) {
  try {
    const { attributeId } = req.params;
    const { name, description, regulatoryBasis } = req.body;
    const changedBy = req.user?.email;

    if (!changedBy) {
      return res.status(400).json({ error: 'No user context' });
    }

    // Get current values for comparison
    const client = await pool.connect();
    let oldValues: Record<string, any> = {};
    try {
      const currentResult = await client.query(
        `SELECT name, description, regulatory_basis FROM category_rule_attributes WHERE id = $1`,
        [attributeId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Attribute not found' });
      }

      oldValues = currentResult.rows[0];
    } finally {
      client.release();
    }

    const newValues = { name, description, regulatoryBasis };

    // Validate for regulatory alignment
    const validation = await categoryRuleValidator.validateAttributeChange(
      attributeId,
      oldValues as any,
      newValues as any,
      changedBy
    );

    // If not valid and no override, reject
    if (!validation.isValid && !req.body.confirmOverride) {
      return res.status(422).json({
        validation: validation.assessment,
        requiresOverride: validation.requiresConfirmation,
      });
    }

    // Update the attribute
    const updateClient = await pool.connect();
    try {
      const updateQuery = `
        UPDATE category_rule_attributes
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            regulatory_basis = COALESCE($3, regulatory_basis),
            last_modified_by = $4,
            last_modified_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
      const result = await updateClient.query(updateQuery, [
        name || null,
        description || null,
        regulatoryBasis || null,
        changedBy,
        attributeId,
      ]);

      // Record the change
      await categoryRuleValidator.recordRuleChange(
        'attribute_updated',
        'attribute',
        attributeId,
        changedBy,
        oldValues,
        newValues,
        validation.assessment,
        req.body.confirmOverride || false,
        req.body.overrideReason
      );

      res.json(result.rows[0]);
    } finally {
      updateClient.release();
    }
  } catch (error) {
    console.error('[CategoryRec] Error:', error);
    res.status(500).json({ error: 'Failed to update attribute' });
  }
}

/**
 * View audit trail of rule changes
 */
export async function getCategoryRulesAudit(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await categoryRuleValidator.getRuleChangeHistory(undefined, limit);
    res.json(history);
  } catch (error) {
    console.error('[CategoryRec] Error:', error);
    res.status(500).json({ error: 'Failed to retrieve audit history' });
  }
}

export default router;
