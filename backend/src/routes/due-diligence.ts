import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { gatherReportData, generatePDF, generateFindingsCSV, generateDueDiligenceZIP } from '../services/due-diligence.js';
import { generateCycloneDX } from '../services/sbom-service.js';

const router = Router();

// Auth middleware (per-route file, follows project pattern)
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

// Helper: get user's org_id
async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// Helper: verify product belongs to org
async function verifyProductOwnership(orgId: string, productId: string): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id`,
      { orgId, productId }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}

// ─── GET /:productId/preview ────────────────────────────────────────
// Returns gathered data as JSON for the frontend preview
router.get('/:productId/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;

    if (!(await verifyProductOwnership(orgId, productId))) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const data = await gatherReportData(orgId, productId);
    res.json(data);

    // Telemetry (non-blocking)
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'due_diligence_previewed',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId },
    }).catch(() => {});

  } catch (err) {
    console.error('Due diligence preview failed:', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// ─── GET /:productId/export ─────────────────────────────────────────
// Generates and returns the ZIP package
router.get('/:productId/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;

    if (!(await verifyProductOwnership(orgId, productId))) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Gather all report data
    const data = await gatherReportData(orgId, productId);

    // Generate PDF
    const pdfBuffer = await generatePDF(data);

    // Generate CycloneDX SBOM
    let sbomJson: any = null;
    try {
      const result = await generateCycloneDX(orgId, productId);
      sbomJson = result.cyclonedx;
    } catch {
      // SBOM may not be available — include a placeholder
      sbomJson = {
        note: 'SBOM not available. Sync the repository first.',
        generatedAt: data.generatedAt,
      };
    }

    // Generate CSV
    const csv = generateFindingsCSV(data.licenseFindings);

    // Assemble ZIP
    const zipBuffer = generateDueDiligenceZIP(data, pdfBuffer, sbomJson, csv);

    // Send response
    const safeName = (data.product.name || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `due-diligence-${safeName}-${dateStr}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(zipBuffer);

    // Telemetry (non-blocking)
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'due_diligence_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: {
        productId,
        pdfSizeBytes: pdfBuffer.length,
        zipSizeBytes: zipBuffer.length,
        findingsCount: data.licenseFindings.length,
      },
    }).catch(() => {});

  } catch (err) {
    console.error('Due diligence export failed:', err);
    res.status(500).json({ error: 'Failed to generate due diligence package' });
  }
});

export default router;
