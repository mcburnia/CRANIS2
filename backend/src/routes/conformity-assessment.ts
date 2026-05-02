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
 * Conformity Assessment Routes
 *
 * GET  /api/conformity-assessment/:category       – Public: get assessment for a CRA category
 * GET  /api/products/:productId/conformity-assessment – Authenticated: get assessment for a product
 *
 * The public endpoint requires no auth and is used by the welcome site lead-gen tool.
 * The product endpoint auto-populates from the product's CRA category and technical file.
 */

import express from 'express';
import type { Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import {
  getConformityAssessment,
  getPublicConformityAssessment,
  CONFORMITY_MODULES,
} from '../services/conformity-assessment.js';

// ─── Public router (no auth) ──────────────────────────────────

export const publicConformityRouter = express.Router();

/**
 * GET /api/conformity-assessment/modules/all
 * Public endpoint – returns all module definitions for reference.
 * Must be registered BEFORE /:category to avoid route conflict.
 */
publicConformityRouter.get('/modules/all', (_req: Request, res: Response) => {
  return res.json({
    modules: [
      CONFORMITY_MODULES.MODULE_A,
      CONFORMITY_MODULES.MODULE_B,
      CONFORMITY_MODULES.MODULE_C,
      CONFORMITY_MODULES.MODULE_H,
    ],
  });
});

/**
 * GET /api/conformity-assessment/:category
 * Public endpoint – no auth required. Used by welcome site interactive tool.
 */
publicConformityRouter.get('/:category', (req: Request, res: Response) => {
  const category = req.params.category as string;
  const harmonisedStandards = req.query.harmonisedStandards === 'true';

  const validCategories = ['default', 'important_i', 'important_ii', 'critical'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      error: 'Invalid CRA category',
      validCategories,
    });
  }

  const result = getPublicConformityAssessment({
    productType: 'general',
    category,
    harmonisedStandardsApplied: harmonisedStandards,
  });

  return res.json(result);
});

// ─── Product router (authenticated) ──────────────────────────

export const productConformityRouter = express.Router();

/**
 * GET /api/products/:productId/conformity-assessment
 * Authenticated – returns assessment based on the product's actual CRA category
 * and whether harmonised standards are documented in the technical file.
 */
productConformityRouter.get('/:productId/conformity-assessment', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const token = authHeader.slice(7);
    let payload;
    try {
      payload = verifySessionToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid session' });
    }
    if (!payload) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Look up org from user
    const userResult = await pool.query('SELECT org_id FROM users WHERE id = $1', [payload.userId]);
    const orgId = userResult.rows[0]?.org_id;
    if (!orgId) {
      return res.status(403).json({ error: 'No organisation found' });
    }

    const { productId } = req.params;

    // Get product's CRA category from Neo4j
    const driver = getDriver();
    const neo4jSession = driver.session();
    let craCategory = 'default';
    let productName = '';

    try {
      const graphResult = await neo4jSession.run(
        `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation {id: $orgId})
         RETURN p.craCategory AS category, p.name AS name`,
        { productId, orgId }
      );

      if (graphResult.records.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      craCategory = graphResult.records[0].get('category') || 'default';
      productName = graphResult.records[0].get('name') || '';
    } finally {
      await neo4jSession.close();
    }

    // Check if harmonised standards are documented in the technical file.
    // Ownership is already validated by the Neo4j MATCH above; technical_file_sections
    // keys on product_id (table has no org_id column).
    const tfResult = await pool.query(
      `SELECT content FROM technical_file_sections
       WHERE product_id = $1 AND section_key = 'standards_applied'`,
      [productId]
    );

    let harmonisedStandardsApplied = false;
    if (tfResult.rows.length > 0 && tfResult.rows[0].content) {
      const content = JSON.stringify(tfResult.rows[0].content).toLowerCase();
      harmonisedStandardsApplied =
        content.includes('en 18031') ||
        content.includes('etsi en 303 645') ||
        content.includes('iso/iec 15408') ||
        content.includes('harmonised standard');
    }

    const result = getConformityAssessment(craCategory, harmonisedStandardsApplied);

    return res.json({
      ...result,
      productName,
      productId,
      harmonisedStandardsDetected: harmonisedStandardsApplied,
    });
  } catch (err: any) {
    console.error('[CONFORMITY-ASSESSMENT] Error:', err);
    return res.status(500).json({ error: 'Failed to determine conformity assessment' });
  }
});
