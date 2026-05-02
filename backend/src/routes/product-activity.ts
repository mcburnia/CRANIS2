/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// GET /api/products/:productId/activity
router.get('/:productId/activity', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) {
      res.status(403).json({ error: 'No organisation found' });
      return;
    }

    // Verify product belongs to org
    const neo4jSession = getDriver().session();
    try {
      const result = await neo4jSession.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.id AS id`,
        { orgId, productId }
      );
      if (result.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    } finally {
      await neo4jSession.close();
    }

    // Parse query params
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const actionFilter = req.query.action as string || null;
    const entityTypeFilter = req.query.entity_type as string || null;

    // Build query
    const conditions = ['product_id = $1'];
    const params: any[] = [productId];
    let paramIdx = 2;

    if (actionFilter) {
      conditions.push(`action = $${paramIdx}`);
      params.push(actionFilter);
      paramIdx++;
    }
    if (entityTypeFilter) {
      conditions.push(`entity_type = $${paramIdx}`);
      params.push(entityTypeFilter);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const [countResult, activityResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM product_activity_log WHERE ${where}`, params),
      pool.query(
        `SELECT id, product_id, org_id, user_id, user_email, action, entity_type, entity_id,
                summary, old_values, new_values, metadata, created_at
         FROM product_activity_log
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset]
      ),
    ]);

    const total = countResult.rows[0]?.total || 0;

    const activities = activityResult.rows.map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      userId: row.user_id,
      userEmail: row.user_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      summary: row.summary,
      oldValues: row.old_values,
      newValues: row.new_values,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));

    // Get distinct actions and entity types for filter dropdowns
    const filtersResult = await pool.query(
      `SELECT DISTINCT action, entity_type FROM product_activity_log WHERE product_id = $1`,
      [productId]
    );

    const actions = [...new Set(filtersResult.rows.map((r: any) => r.action))].sort();
    const entityTypes = [...new Set(filtersResult.rows.map((r: any) => r.entity_type))].sort();

    res.json({ activities, total, limit, offset, filters: { actions, entityTypes } });
  } catch (err) {
    console.error('Failed to fetch product activity:', err);
    res.status(500).json({ error: 'Failed to fetch product activity' });
  }
});

export default router;
