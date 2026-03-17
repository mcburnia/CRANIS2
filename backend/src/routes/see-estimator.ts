/**
 * SEE Routes — Software Evidence Engine.
 *
 * Phase A (effort estimation):
 * POST /:productId/see/consent           – Set/revoke source code consent
 * GET  /:productId/see/consent           – Get consent status
 * POST /:productId/see/estimate          – Run effort estimation scan
 * GET  /:productId/see/estimate          – Get latest estimation result
 * GET  /:productId/see/estimate/history  – Get scan history
 * GET  /:productId/see/estimate/export   – Export Markdown report
 *
 * Phase B (commits & attribution):
 * POST /:productId/see/commits/ingest    – Ingest commit history
 * GET  /:productId/see/commits           – Get commit summary
 * GET  /:productId/see/developers        – Get developer attribution
 * GET  /:productId/see/commits/activity  – Get monthly commit activity
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
import {
  ingestCommits, getCommitSummary, getDeveloperAttribution, getCommitActivity,
} from '../services/see-commit-ingestor.js';
import {
  runBranchAnalysis, getBranchAnalysis,
} from '../services/see-classifier.js';
import {
  detectExperiments, getExperiments,
} from '../services/see-experiment-detector.js';
import {
  generateRnDEvidenceReport, getLatestReport,
} from '../services/see-report-generator.js';

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

// ═══════════════════════════════════════════════════════════════════
// Phase B: Commit History & Developer Attribution
// ═══════════════════════════════════════════════════════════════════

// ─── POST /:productId/see/commits/ingest ────────────────────────────

router.post(
  '/:productId/see/commits/ingest',
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

      const consent = await getSourceCodeConsent(productId, orgId);
      if (!consent) {
        return res.status(403).json({
          error: 'source_code_consent_required',
          message: 'Source code analysis requires explicit consent.',
        });
      }

      const summary = await ingestCommits(productId, orgId, userId);
      res.json(summary);
    } catch (err: any) {
      console.error(`[SEE] Commit ingest error: ${err.message}`);
      res.status(500).json({ error: 'Commit ingestion failed', message: err.message });
    }
  }
);

// ─── GET /:productId/see/commits ────────────────────────────────────

router.get(
  '/:productId/see/commits',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const summary = await getCommitSummary(productId);
      res.json(summary);
    } catch (err: any) {
      console.error(`[SEE] Commits error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve commit data' });
    }
  }
);

// ─── GET /:productId/see/developers ─────────────────────────────────

router.get(
  '/:productId/see/developers',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const developers = await getDeveloperAttribution(productId);
      res.json({ productId, developers });
    } catch (err: any) {
      console.error(`[SEE] Developers error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve developer data' });
    }
  }
);

// ─── GET /:productId/see/commits/activity ───────────────────────────

router.get(
  '/:productId/see/commits/activity',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const activity = await getCommitActivity(productId);
      res.json({ productId, activity });
    } catch (err: any) {
      console.error(`[SEE] Activity error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve commit activity' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase C: Branch Analysis & Commit Classification
// ═══════════════════════════════════════════════════════════════════

// ─── POST /:productId/see/branches/analyse ──────────────────────────

router.post(
  '/:productId/see/branches/analyse',
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

      const consent = await getSourceCodeConsent(productId, orgId);
      if (!consent) {
        return res.status(403).json({ error: 'source_code_consent_required' });
      }

      const result = await runBranchAnalysis(productId, orgId, userId);
      res.json(result);
    } catch (err: any) {
      console.error(`[SEE] Branch analysis error: ${err.message}`);
      res.status(500).json({ error: 'Branch analysis failed', message: err.message });
    }
  }
);

// ─── GET /:productId/see/branches ───────────────────────────────────

router.get(
  '/:productId/see/branches',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const analysis = await getBranchAnalysis(productId);
      if (!analysis) {
        return res.json({ productId, analysed: false, message: 'No branch analysis available. Run analysis first.' });
      }

      res.json({ ...analysis, analysed: true });
    } catch (err: any) {
      console.error(`[SEE] Branches error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve branch data' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase D: Experimentation Detection & R&D Evidence Report
// ═══════════════════════════════════════════════════════════════════

// ─── POST /:productId/see/experiments/detect ────────────────────────

router.post(
  '/:productId/see/experiments/detect',
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

      const result = await detectExperiments(productId);
      res.json(result);
    } catch (err: any) {
      console.error(`[SEE] Experiment detection error: ${err.message}`);
      res.status(500).json({ error: 'Experiment detection failed', message: err.message });
    }
  }
);

// ─── GET /:productId/see/experiments ────────────────────────────────

router.get(
  '/:productId/see/experiments',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const result = await getExperiments(productId);
      if (!result) return res.json({ productId, detected: false });
      res.json({ ...result, detected: true });
    } catch (err: any) {
      console.error(`[SEE] Experiments error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve experiments' });
    }
  }
);

// ─── POST /:productId/see/reports/rnd ───────────────────────────────

router.post(
  '/:productId/see/reports/rnd',
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

      const report = await generateRnDEvidenceReport(productId, orgId, product.name);
      res.json(report);
    } catch (err: any) {
      console.error(`[SEE] Report generation error: ${err.message}`);
      res.status(500).json({ error: 'Report generation failed', message: err.message });
    }
  }
);

// ─── GET /:productId/see/reports/rnd/export ─────────────────────────

router.get(
  '/:productId/see/reports/rnd/export',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      let report = await getLatestReport(productId, 'rnd_tax');
      if (!report) {
        // Auto-generate if not yet generated
        report = await generateRnDEvidenceReport(productId, orgId, product.name);
      }

      const filename = `rnd-evidence-${product.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(report.contentMd);
    } catch (err: any) {
      console.error(`[SEE] Report export error: ${err.message}`);
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

export default router;
