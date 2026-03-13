/**
 * Supplier Due Diligence Questionnaire Routes
 *
 * POST /:productId/supplier-questionnaires/generate – Identify risky deps + generate questionnaires
 * GET  /:productId/supplier-questionnaires – List all for product
 * GET  /:productId/supplier-questionnaires/:id – Get single questionnaire
 * PATCH /:productId/supplier-questionnaires/:id/status – Update status
 * GET  /:productId/supplier-questionnaires/export/pdf – PDF export
 * GET  /:productId/supplier-questionnaires/export/csv – CSV export
 *
 * Mount at: app.use('/api/products', supplierDueDiligenceRoutes)
 */

import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import {
  identifyRiskyDependencies,
  generateQuestionnaire,
  storeQuestionnaire,
  listQuestionnaires,
  getQuestionnaire,
  updateQuestionnaireStatus,
  deleteQuestionnaires,
} from '../services/supplier-due-diligence.js';

const router = Router();

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

async function verifyProductAccess(orgId: string, productId: string): Promise<{ id: string; name: string; craCategory: string | null } | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;
    const p = result.records[0].get('p').properties;
    return { id: p.id, name: p.name, craCategory: p.craCategory || null };
  } finally {
    await session.close();
  }
}

/**
 * POST /:productId/supplier-questionnaires/generate
 * Identify risky dependencies and generate due diligence questionnaires
 */
router.post(
  '/:productId/supplier-questionnaires/generate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      // Identify risky dependencies (includes supplier enrichment)
      const { dependencies: riskyDeps, enrichmentStats } = await identifyRiskyDependencies(productId, orgId);

      if (riskyDeps.length === 0) {
        return res.json({
          generated: 0,
          skipped: 0,
          questionnaires: [],
          riskyDependencies: [],
          enrichment: enrichmentStats,
        });
      }

      // Check for existing questionnaires to avoid duplicates
      const existing = await listQuestionnaires(productId, orgId);
      const existingNames = new Set(existing.map(q => `${q.dependencyName}@${q.dependencyVersion}`));

      const questionnaires = [];
      let skipped = 0;

      for (const dep of riskyDeps) {
        const key = `${dep.name}@${dep.version}`;
        if (existingNames.has(key)) {
          skipped++;
          continue;
        }

        // Generate template-based questionnaire (deterministic, no AI)
        const { content } = generateQuestionnaire(dep, product.name, product.craCategory);

        // Store in DB
        const stored = await storeQuestionnaire(orgId, productId, userId, dep, content);
        questionnaires.push(stored);
      }

      res.json({
        generated: questionnaires.length,
        skipped,
        questionnaires,
        riskyDependencies: riskyDeps,
        enrichment: enrichmentStats,
      });
    } catch (error) {
      console.error('[SUPPLIER-DD] Error:', error);
      res.status(500).json({ error: 'Failed to generate questionnaires' });
    }
  }
);

/**
 * GET /:productId/supplier-questionnaires
 * List all questionnaires for a product
 */
router.get(
  '/:productId/supplier-questionnaires',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const questionnaires = await listQuestionnaires(productId, orgId);
      res.json(questionnaires);
    } catch (error) {
      console.error('[SUPPLIER-DD] Error:', error);
      res.status(500).json({ error: 'Failed to list questionnaires' });
    }
  }
);

/**
 * GET /:productId/supplier-questionnaires/export/pdf
 * Export all questionnaires as PDF
 */
router.get(
  '/:productId/supplier-questionnaires/export/pdf',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const questionnaires = await listQuestionnaires(productId, orgId);
      if (questionnaires.length === 0) {
        return res.status(404).json({ error: 'No questionnaires to export' });
      }

      // Build PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      const stream = new PassThrough();
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.pipe(stream);

      const pageWidth = doc.page.width - 100;

      // Cover page
      doc.moveDown(6);
      doc.fontSize(24).fillColor('#6366f1').text('Supplier Due Diligence Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor('#6b7280').text('CRA Art. 13(5) – Third-Party Component Assessment', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(12).fillColor('#374151').text(product.name, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(10).fillColor('#6b7280').text(
        `Generated: ${new Date().toISOString().split('T')[0]} | ${questionnaires.length} component(s) assessed`,
        { align: 'center' }
      );

      // Each questionnaire
      for (const q of questionnaires) {
        doc.addPage();

        // Header
        doc.fontSize(16).fillColor('#6366f1').text(q.dependencyName, 50, 50);
        doc.moveDown(0.2);
        doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#6366f1').lineWidth(1).stroke();
        doc.moveDown(0.5);

        // Metadata
        doc.fontSize(9).fillColor('#6b7280');
        doc.text(`Version: ${q.dependencyVersion || 'N/A'} | Ecosystem: ${q.dependencyEcosystem || 'N/A'} | Licence: ${q.dependencyLicense || 'N/A'} | Supplier: ${q.dependencySupplier || 'Unknown'}`);
        doc.moveDown(0.3);

        // Risk flags
        doc.fontSize(9).fillColor('#dc2626');
        for (const flag of q.riskFlags) {
          doc.text(`⚠ ${flag.detail}`);
        }
        doc.moveDown(0.5);

        // Summary + risk assessment
        const content = q.questionnaireContent;
        if (content.summary) {
          doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text('Summary');
          doc.font('Helvetica').fontSize(9).fillColor('#374151').text(content.summary);
          doc.moveDown(0.4);
        }
        if (content.riskAssessment) {
          doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text('Risk Assessment');
          doc.font('Helvetica').fontSize(9).fillColor('#374151').text(content.riskAssessment);
          doc.moveDown(0.4);
        }

        // Questions
        if (content.questions && content.questions.length > 0) {
          doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text('Due Diligence Questions');
          doc.font('Helvetica');
          doc.moveDown(0.3);

          for (const question of content.questions) {
            if (doc.y > doc.page.height - 100) doc.addPage();

            doc.fontSize(9).fillColor('#6366f1').font('Helvetica-Bold').text(
              `[${question.category.replace(/_/g, ' ').toUpperCase()}]${question.craReference ? ` – ${question.craReference}` : ''}`
            );
            doc.font('Helvetica').fontSize(9).fillColor('#111827').text(question.question);
            doc.fontSize(8).fillColor('#6b7280').text(`Rationale: ${question.rationale}`);
            doc.moveDown(0.4);
          }
        }

        // Recommended actions
        if (content.recommendedActions && content.recommendedActions.length > 0) {
          if (doc.y > doc.page.height - 100) doc.addPage();
          doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold').text('Recommended Actions');
          doc.font('Helvetica');
          doc.moveDown(0.2);
          for (const action of content.recommendedActions) {
            doc.fontSize(9).fillColor('#374151').text(`• ${action}`);
          }
        }
      }

      // Finalise
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
        doc.end();
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="supplier-due-diligence-${productId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[SUPPLIER-DD] PDF export error:', error);
      res.status(500).json({ error: 'Failed to export PDF' });
    }
  }
);

/**
 * GET /:productId/supplier-questionnaires/export/csv
 * Export all questionnaires as CSV
 */
router.get(
  '/:productId/supplier-questionnaires/export/csv',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const product = await verifyProductAccess(orgId, productId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const questionnaires = await listQuestionnaires(productId, orgId);
      if (questionnaires.length === 0) {
        return res.status(404).json({ error: 'No questionnaires to export' });
      }

      const escCsv = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;

      const headers = ['Dependency', 'Version', 'Ecosystem', 'Licence', 'Supplier', 'Risk Flags', 'Category', 'Question', 'Rationale', 'CRA Reference', 'Status'];
      const rows: string[] = [headers.join(',')];

      for (const q of questionnaires) {
        const flags = q.riskFlags.map(f => f.detail).join('; ');
        const content = q.questionnaireContent;

        if (content.questions && content.questions.length > 0) {
          for (const question of content.questions) {
            rows.push([
              escCsv(q.dependencyName),
              escCsv(q.dependencyVersion || ''),
              escCsv(q.dependencyEcosystem || ''),
              escCsv(q.dependencyLicense || ''),
              escCsv(q.dependencySupplier || ''),
              escCsv(flags),
              escCsv(question.category),
              escCsv(question.question),
              escCsv(question.rationale),
              escCsv(question.craReference || ''),
              escCsv(q.status),
            ].join(','));
          }
        } else {
          rows.push([
            escCsv(q.dependencyName),
            escCsv(q.dependencyVersion || ''),
            escCsv(q.dependencyEcosystem || ''),
            escCsv(q.dependencyLicense || ''),
            escCsv(q.dependencySupplier || ''),
            escCsv(flags),
            escCsv(''),
            escCsv(content.summary || ''),
            escCsv(''),
            escCsv(''),
            escCsv(q.status),
          ].join(','));
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="supplier-due-diligence-${productId}.csv"`);
      res.send(rows.join('\n'));
    } catch (error) {
      console.error('[SUPPLIER-DD] CSV export error:', error);
      res.status(500).json({ error: 'Failed to export CSV' });
    }
  }
);

/**
 * GET /:productId/supplier-questionnaires/:id
 * Get a single questionnaire
 */
router.get(
  '/:productId/supplier-questionnaires/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const questionnaire = await getQuestionnaire(id, orgId);
      if (!questionnaire) return res.status(404).json({ error: 'Questionnaire not found' });

      res.json(questionnaire);
    } catch (error) {
      console.error('[SUPPLIER-DD] Error:', error);
      res.status(500).json({ error: 'Failed to get questionnaire' });
    }
  }
);

/**
 * PATCH /:productId/supplier-questionnaires/:id/status
 * Update questionnaire status
 */
router.patch(
  '/:productId/supplier-questionnaires/:id/status',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body;
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const validStatuses = ['generated', 'sent', 'responded', 'reviewed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updated = await updateQuestionnaireStatus(id, orgId, status);
      if (!updated) return res.status(404).json({ error: 'Questionnaire not found' });

      res.json(updated);
    } catch (error) {
      console.error('[SUPPLIER-DD] Error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

export default router;
