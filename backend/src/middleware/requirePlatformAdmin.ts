import { Request, Response } from 'express';
import { verifySessionToken } from '../utils/token.js';
import pool from '../db/pool.js';

export async function requirePlatformAdmin(req: Request, res: Response, next: Function) {
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

    // Always check DB for platform admin status (never trust token claims alone)
    const result = await pool.query(
      'SELECT id, email, is_platform_admin FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (!result.rows[0].is_platform_admin) {
      res.status(403).json({ error: 'Platform admin access required' });
      return;
    }

    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
