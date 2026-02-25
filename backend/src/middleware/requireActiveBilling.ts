import { Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';

/**
 * Global billing gate middleware for write operations.
 * Extracts JWT from Authorization header to identify the user/org,
 * then checks billing status. Blocks POST/PUT/DELETE when org is
 * in read_only, suspended, or cancelled state.
 *
 * Runs BEFORE per-route auth, so it peeks at the JWT independently.
 * Fails open on any error (doesn't block users due to billing check failures).
 */
export async function requireActiveBilling(req: Request, res: Response, next: Function) {
  // Try to extract userId from JWT (may not be set yet by route-level auth)
  let userId = (req as any).userId;

  if (!userId) {
    // Peek at the Authorization header to extract userId
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      // No auth header — let route-level auth handle the 401
      next();
      return;
    }
    try {
      const token = authHeader.split(' ')[1];
      const payload = verifySessionToken(token);
      if (payload?.userId) {
        userId = payload.userId;
      }
    } catch {
      // Invalid token — let route-level auth handle the 401
      next();
      return;
    }
  }

  if (!userId) {
    next();
    return;
  }

  try {
    // Get org_id from user
    const userResult = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
    const orgId = userResult.rows[0]?.org_id;
    if (!orgId) {
      next();
      return;
    }

    // Check billing status
    const billing = await pool.query(
      'SELECT status, exempt FROM org_billing WHERE org_id = $1',
      [orgId]
    );
    const row = billing.rows[0];

    // No billing record = allow (record gets auto-created on /billing/status)
    if (!row) {
      next();
      return;
    }

    // Exempt orgs always pass
    if (row.exempt) {
      next();
      return;
    }

    const status = row.status;

    // Active statuses that allow full access
    if (['trial', 'active'].includes(status)) {
      next();
      return;
    }

    // Past due gets a grace period — allow writes during grace
    if (status === 'past_due') {
      next();
      return;
    }

    // Restricted statuses — block write operations
    if (status === 'read_only') {
      res.status(403).json({
        error: 'billing_restricted',
        status: 'read_only',
        message: 'Your account is in read-only mode due to a billing issue. Please update your payment method to restore full access.',
      });
      return;
    }

    if (status === 'suspended') {
      res.status(403).json({
        error: 'billing_restricted',
        status: 'suspended',
        message: 'Your account has been suspended due to non-payment. Please contact support or update your payment method.',
      });
      return;
    }

    if (status === 'cancelled') {
      res.status(403).json({
        error: 'billing_restricted',
        status: 'cancelled',
        message: 'Your subscription has been cancelled. Please resubscribe to restore access.',
      });
      return;
    }

    // Unknown status — allow (fail open for safety)
    next();
  } catch (err) {
    console.error('[BILLING GATE] Error checking billing status:', err);
    // Fail open — don't block users due to billing check errors
    next();
  }
}

export default requireActiveBilling;
