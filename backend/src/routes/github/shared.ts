/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Request, Response } from 'express';
import pool from '../../db/pool.js';
import { verifySessionToken } from '../../utils/token.js';
import type { RepoProvider } from '../../services/repo-provider.js';

// In-memory stores with automatic cleanup
// OAuth state tokens for CSRF protection
export const pendingStates = new Map<string, { userId: string; expiresAt: number; provider: RepoProvider }>();
// Connection tokens – short-lived, single-use tokens for initiating OAuth
export const connectionTokens = new Map<string, { userId: string; expiresAt: number; provider: RepoProvider }>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
  for (const [key, val] of connectionTokens) {
    if (val.expiresAt < now) connectionTokens.delete(key);
  }
}, 5 * 60 * 1000);

// Auth middleware
export async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Org-admin middleware — connecting and disconnecting the organisation's repo
// integration is an org-wide action; only admins may change it. Members can
// still read status and trigger syncs (those use requireAuth only).
export async function requireOrgAdmin(req: Request, res: Response, next: Function) {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }
  try {
    const result = await pool.query('SELECT org_role FROM users WHERE id = $1', [userId]);
    if (result.rows[0]?.org_role !== 'admin') {
      res.status(403).json({
        error: 'Organisation admin required',
        message: 'Connecting or disconnecting a repository provider is restricted to organisation admins.',
      });
      return;
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify role', message: err.message });
  }
}
