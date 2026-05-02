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
 * Crypto Inventory Routes — cryptographic standards & quantum readiness scanning.
 *
 * GET  /:productId/crypto-inventory         – Get latest scan (or 404 if not scanned)
 * POST /:productId/crypto-inventory/scan    – Run / re-run crypto scan
 * GET  /:productId/crypto-inventory/export  – Export Markdown report
 *
 * Mount at: app.use('/api/products', cryptoInventoryRoutes)
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { scanProductCrypto, getLatestScan, generateCryptoReport, REGISTRY_SIZE } from '../services/crypto-inventory.js';

const router = Router();

// ─── Auth middleware (same pattern as other product routes) ──────────

async function requireAuth(req: Request, res: Response, next: Function) {
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

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

async function verifyProductAccess(orgId: string, productId: string): Promise<{ id: string; name: string } | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;
    const p = result.records[0].get('p').properties;
    return { id: p.id, name: p.name };
  } finally {
    await session.close();
  }
}

// ─── GET /:productId/crypto-inventory ──────────────────────────────

router.get(
  '/:productId/crypto-inventory',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const scan = await getLatestScan(productId);
      if (!scan) {
        return res.json({
          productId,
          scanned: false,
          registrySize: REGISTRY_SIZE,
          message: 'No crypto scan has been run for this product yet. Use POST to trigger a scan.',
        });
      }

      res.json({ ...scan, scanned: true, registrySize: REGISTRY_SIZE });
    } catch (err: any) {
      console.error(`[CRYPTO] GET error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve crypto inventory' });
    }
  }
);

// ─── POST /:productId/crypto-inventory/scan ─────────────────────────

router.post(
  '/:productId/crypto-inventory/scan',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const result = await scanProductCrypto(productId, orgId);
      res.json({ ...result, scanned: true, registrySize: REGISTRY_SIZE });
    } catch (err: any) {
      console.error(`[CRYPTO] Scan error: ${err.message}`);
      res.status(500).json({ error: 'Crypto scan failed' });
    }
  }
);

// ─── GET /:productId/crypto-inventory/export ────────────────────────

router.get(
  '/:productId/crypto-inventory/export',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      let scan = await getLatestScan(productId);
      if (!scan) {
        // Auto-scan if not yet scanned
        scan = await scanProductCrypto(productId, orgId);
      }

      const markdown = generateCryptoReport(scan, product.name);
      const filename = `crypto-inventory-${product.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(markdown);
    } catch (err: any) {
      console.error(`[CRYPTO] Export error: ${err.message}`);
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

export default router;
