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
  generateRnDEvidenceReport, getLatestReport, generateRegulationReport,
  REPORT_TYPES, listReports,
} from '../services/see-report-generator.js';
import {
  runEvolutionAnalysis, getEvolutionData,
} from '../services/see-evolution.js';
import {
  buildEvidenceGraph, getGraphSummary, queryProvenance,
} from '../services/see-graph.js';
import {
  startSession, recordTurn, endSession, listSessions,
  getSessionTurns, getCompetenceProfile,
} from '../services/see-session.js';

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

// ═══════════════════════════════════════════════════════════════════
// Phase E: Architecture & Test Evolution
// ═══════════════════════════════════════════════════════════════════

router.post(
  '/:productId/see/evolution/analyse',
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

      const result = await runEvolutionAnalysis(productId);
      res.json({ ...result, analysed: true });
    } catch (err: any) {
      console.error(`[SEE] Evolution analysis error: ${err.message}`);
      res.status(500).json({ error: 'Evolution analysis failed', message: err.message });
    }
  }
);

router.get(
  '/:productId/see/evolution',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const result = await getEvolutionData(productId);
      if (!result) return res.json({ productId, analysed: false });
      res.json({ ...result, analysed: true });
    } catch (err: any) {
      console.error(`[SEE] Evolution data error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve evolution data' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase F: Evidence Graph & Provenance Queries
// ═══════════════════════════════════════════════════════════════════

router.post(
  '/:productId/see/graph/build',
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

      const summary = await buildEvidenceGraph(productId);
      res.json(summary);
    } catch (err: any) {
      console.error(`[SEE] Graph build error: ${err.message}`);
      res.status(500).json({ error: 'Graph build failed', message: err.message });
    }
  }
);

router.get(
  '/:productId/see/graph',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const summary = await getGraphSummary(productId);
      res.json(summary);
    } catch (err: any) {
      console.error(`[SEE] Graph summary error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve graph summary' });
    }
  }
);

router.get(
  '/:productId/see/graph/query/:queryType',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const queryType = req.params.queryType as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const validQueries = ['developer-contributions', 'module-structure', 'dependency-exposure', 'experiment-timeline', 'architecture-timeline'];
      if (!validQueries.includes(queryType)) {
        return res.status(400).json({ error: 'Invalid query type', validQueries });
      }

      const result = await queryProvenance(productId, queryType);
      res.json(result);
    } catch (err: any) {
      console.error(`[SEE] Provenance query error: ${err.message}`);
      res.status(500).json({ error: 'Query failed', message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase G: Multi-Regulation Reports
// ═══════════════════════════════════════════════════════════════════

// ─── GET /:productId/see/reports/types ───────────────────────────────

router.get(
  '/:productId/see/reports/types',
  requireAuth,
  async (_req: Request, res: Response) => {
    res.json({ reportTypes: REPORT_TYPES });
  }
);

// ─── POST /:productId/see/reports/generate/:reportType ──────────────

router.post(
  '/:productId/see/reports/generate/:reportType',
  requireAuth,
  requirePlan('pro'),
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const reportType = req.params.reportType as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      if (!REPORT_TYPES[reportType]) {
        return res.status(400).json({ error: 'Invalid report type', validTypes: Object.keys(REPORT_TYPES) });
      }

      const report = await generateRegulationReport(productId, orgId, product.name, reportType);
      res.json(report);
    } catch (err: any) {
      console.error(`[SEE] Report generation error: ${err.message}`);
      res.status(500).json({ error: 'Report generation failed', message: err.message });
    }
  }
);

// ─── GET /:productId/see/reports/export/:reportType ─────────────────

router.get(
  '/:productId/see/reports/export/:reportType',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const reportType = req.params.reportType as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      let report = await getLatestReport(productId, reportType);
      if (!report) {
        report = await generateRegulationReport(productId, orgId, product.name, reportType);
      }

      const typeLabel = REPORT_TYPES[reportType]?.label || reportType;
      const filename = `see-${reportType}-${product.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(report.contentMd);
    } catch (err: any) {
      console.error(`[SEE] Report export error: ${err.message}`);
      res.status(500).json({ error: 'Export failed' });
    }
  }
);

// ─── GET /:productId/see/reports ────────────────────────────────────

router.get(
  '/:productId/see/reports',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const reports = await listReports(productId);
      res.json({ productId, reports, reportTypes: REPORT_TYPES });
    } catch (err: any) {
      console.error(`[SEE] Reports list error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve reports' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// Phase H: Development Session Capture
// ═══════════════════════════════════════════════════════════════════

// ─── POST /:productId/see/sessions/start ────────────────────────────

router.post(
  '/:productId/see/sessions/start',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const { developerName, developerEmail } = req.body;
      const session = await startSession(productId, orgId, developerName || '', developerEmail || '');
      res.json(session);
    } catch (err: any) {
      console.error(`[SEE] Session start error: ${err.message}`);
      res.status(500).json({ error: 'Failed to start session' });
    }
  }
);

// ─── POST /:productId/see/sessions/:sessionId/record ────────────────

router.post(
  '/:productId/see/sessions/:sessionId/record',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { role, content, toolCalls } = req.body;
      if (!role || !content) return res.status(400).json({ error: 'role and content are required' });

      const sessionId = req.params.sessionId as string;
      const result = await recordTurn(sessionId, role, content, toolCalls);
      res.json(result);
    } catch (err: any) {
      console.error(`[SEE] Record turn error: ${err.message}`);
      res.status(500).json({ error: err.message || 'Failed to record turn' });
    }
  }
);

// ─── POST /:productId/see/sessions/:sessionId/end ───────────────────

router.post(
  '/:productId/see/sessions/:sessionId/end',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const session = await endSession(sessionId);
      res.json(session);
    } catch (err: any) {
      console.error(`[SEE] Session end error: ${err.message}`);
      res.status(500).json({ error: 'Failed to end session' });
    }
  }
);

// ─── GET /:productId/see/sessions ───────────────────────────────────

router.get(
  '/:productId/see/sessions',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const sessions = await listSessions(productId);
      res.json({ productId, sessions });
    } catch (err: any) {
      console.error(`[SEE] Sessions list error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
  }
);

// ─── GET /:productId/see/sessions/:sessionId/turns ──────────────────

router.get(
  '/:productId/see/sessions/:sessionId/turns',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const sessionId = req.params.sessionId as string;
      const turns = await getSessionTurns(sessionId);
      res.json({ sessionId, turns });
    } catch (err: any) {
      console.error(`[SEE] Turns error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve turns' });
    }
  }
);

// ─── GET /:productId/see/competence ─────────────────────────────────

router.get(
  '/:productId/see/competence',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const profile = await getCompetenceProfile(productId);
      res.json(profile);
    } catch (err: any) {
      console.error(`[SEE] Competence error: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve competence profile' });
    }
  }
);

// ─── GET /:productId/see/hooks-config ───────────────────────────────
// Returns a ready-to-use Claude Code hooks configuration

router.get(
  '/:productId/see/hooks-config',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const productId = req.params.productId as string;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      // Get user's API key (first active one)
      const keyResult = await pool.query(
        `SELECT key_prefix FROM api_keys WHERE org_id = $1 AND revoked_at IS NULL LIMIT 1`,
        [orgId]
      );

      const baseUrl = req.headers.host?.includes('localhost')
        ? `http://localhost:3001`
        : `https://${req.headers.host}`;

      const config = {
        description: 'CRANIS2 Software Evidence Engine — session capture hooks for Claude Code',
        setup: {
          step1: 'Copy the hooks configuration below into your project\'s .claude/hooks.json file',
          step2: 'Set the CRANIS2_API_KEY environment variable to your API key',
          step3: 'Set CRANIS2_SESSION_ID after calling the start-session endpoint',
          note: 'The hook fires after each assistant response and records the conversation turn',
        },
        startSessionCommand: `curl -s -X POST ${baseUrl}/api/products/${productId}/see/sessions/start -H 'Authorization: Bearer YOUR_API_KEY' -H 'Content-Type: application/json' -d '{"developerName":"Your Name","developerEmail":"you@example.com"}'`,
        hooksJson: {
          hooks: {
            assistant_response: [
              {
                command: `curl -s -X POST ${baseUrl}/api/products/${productId}/see/sessions/\${CRANIS2_SESSION_ID}/record -H 'Authorization: Bearer \${CRANIS2_API_KEY}' -H 'Content-Type: application/json' -d '{"role":"assistant","content":"$CLAUDE_RESPONSE"}'`,
                timeout: 5000,
              }
            ],
          },
        },
        endSessionCommand: `curl -s -X POST ${baseUrl}/api/products/${productId}/see/sessions/SESSION_ID/end -H 'Authorization: Bearer YOUR_API_KEY'`,
        apiKeyHint: keyResult.rows.length > 0
          ? `You have an API key starting with ${keyResult.rows[0].key_prefix}...`
          : 'No API keys found. Create one from Settings → Integrations.',
      };

      res.json(config);
    } catch (err: any) {
      console.error(`[SEE] Hooks config error: ${err.message}`);
      res.status(500).json({ error: 'Failed to generate hooks config' });
    }
  }
);

export default router;
