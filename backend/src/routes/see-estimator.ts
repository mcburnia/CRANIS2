/**
 * SEE Estimator Routes — Software Evidence Engine effort & cost estimation.
 *
 * POST /:productId/see/consent           – Set/revoke source code consent
 * GET  /:productId/see/consent           – Get consent status
 * POST /:productId/see/estimate          – Run effort estimation scan
 * GET  /:productId/see/estimate          – Get latest estimation result
 * GET  /:productId/see/estimate/history  – Get scan history
 * GET  /:productId/see/estimate/export   – Export Markdown report
 *
 * Mount at: app.use('/api/products', seeEstimatorRoutes)
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { requirePlan } from '../middleware/requirePlan.js';
import {
  runEstimateScan, getLatestScan, getScanHistory,
  getSourceCodeConsent, setSourceCodeConsent,
  generateEstimateReport,
} from '../services/see-estimator.js';

const router = Router();

// ─── Auth middleware ────────────────────────────────────────────────

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

// ─── POST /:productId/see/consent ───────────────────────────────────

router.post(
  '/:productId/see/consent',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const { consent } = req.body;
      if (typeof consent !== 'boolean') return res.status(400).json({ error: 'consent must be a boolean' });

      await setSourceCodeConsent(productId, orgId, consent);
      res.json({ productId, sourceCodeConsent: consent });
    } catch (err: any) {
      console.error(`[SEE] Consent error: ${err.message}`);
      res.status(500).json({ error: 'Failed to update consent' });
    }
  }
);

// ─── GET /:productId/see/consent ────────────────────────────────────

router.get(
  '/:productId/see/consent',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const consent = await getSourceCodeConsent(productId, orgId);
      res.json({ productId, sourceCodeConsent: consent });
    } catch (err: any) {
      console.error(`[SEE] Get consent error: ${err.message}`);
      res.status(500).json({ error: 'Failed to get consent status' });
    }
  }
);

// ─── POST /:productId/see/estimate ──────────────────────────────────

router.post(
  '/:productId/see/estimate',
  requireAuth,
  requirePlan('pro'),
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      // Check consent
      const consent = await getSourceCodeConsent(productId, orgId);
      if (!consent) {
        return res.status(403).json({
          error: 'source_code_consent_required',
          message: 'Source code analysis requires explicit consent. Enable it from the Software Evidence tab.',
        });
      }

      const result = await runEstimateScan(productId, orgId, userId);
      res.json({ ...result, scanned: true });
    } catch (err: any) {
      console.error(`[SEE] Estimate scan error: ${err.message}`);
      res.status(500).json({ error: 'Effort estimation scan failed', message: err.message });
    }
  }
);

// ─── GET /:productId/see/estimate ───────────────────────────────────

router.get(
  '/:productId/see/estimate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
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
          message: 'No effort estimation has been run for this product yet.',
        });
      }

      res.json({ ...scan, scanned: true });
    } catch (err: any) {
      console.error(`[SEE] Get estimate error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve estimate' });
    }
  }
);

// ─── GET /:productId/see/estimate/history ───────────────────────────

router.get(
  '/:productId/see/estimate/history',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const history = await getScanHistory(productId);
      res.json({ productId, runs: history });
    } catch (err: any) {
      console.error(`[SEE] History error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve scan history' });
    }
  }
);

// ─── GET /:productId/see/estimate/export ────────────────────────────

router.get(
  '/:productId/see/estimate/export',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      let scan = await getLatestScan(productId);
      if (!scan) {
        return res.status(404).json({ error: 'No estimation available. Run an estimate first.' });
      }

      const markdown = generateEstimateReport(scan, product.name);
      const filename = `see-estimate-${product.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(markdown);
    } catch (err: any) {
      console.error(`[SEE] Export error: ${err.message}`);
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

export default router;
