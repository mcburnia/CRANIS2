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
 * Product Activity Log – audit trail for compliance evidence.
 *
 * Records product-level changes with before/after values.
 * Non-blocking: never throws, always logs failures.
 */
import pool from '../db/pool.js';

export interface ActivityLogEntry {
  productId: string;
  orgId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

/**
 * Log a product-level activity event. Non-blocking – never throws.
 */
export async function logProductActivity(data: ActivityLogEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO product_activity_log
       (product_id, org_id, user_id, user_email, action, entity_type, entity_id, summary, old_values, new_values, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.productId,
        data.orgId,
        data.userId || null,
        data.userEmail || null,
        data.action,
        data.entityType,
        data.entityId || null,
        data.summary,
        data.oldValues ? JSON.stringify(data.oldValues) : null,
        data.newValues ? JSON.stringify(data.newValues) : null,
        JSON.stringify(data.metadata || {}),
      ]
    );
  } catch (err) {
    console.error('[ACTIVITY-LOG] Failed to log activity:', (err as Error).message);
  }
}
