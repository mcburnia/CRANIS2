import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { setupProductEscrow, runEscrowDeposit } from '../services/escrow-service.js';

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

// Helper: verify product belongs to org and return product name + org name
async function verifyProductOwnership(orgId: string, productId: string): Promise<{ owned: boolean; productName?: string; orgName?: string }> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS productName, o.name AS orgName`,
      { orgId, productId }
    );
    if (result.records.length === 0) return { owned: false };
    return {
      owned: true,
      productName: result.records[0].get('productName'),
      orgName: result.records[0].get('orgName'),
    };
  } finally {
    await session.close();
  }
}

// ─── GET /:productId/config ─────────────────────────────────────────
// Get escrow config + toggle states for a product
router.get('/:productId/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { owned } = await verifyProductOwnership(orgId, productId);
    if (!owned) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await pool.query(
      'SELECT * FROM escrow_configs WHERE product_id = $1',
      [productId]
    );

    if (result.rows.length === 0) {
      res.json({ configured: false });
      return;
    }

    const config = result.rows[0];
    res.json({
      configured: true,
      id: config.id,
      enabled: config.enabled,
      setupCompleted: config.setup_completed,
      forgejoOrg: config.forgejo_org,
      forgejoRepo: config.forgejo_repo,
      toggles: {
        includeSbomCyclonedx: config.include_sbom_cyclonedx,
        includeSbomSpdx: config.include_sbom_spdx,
        includeVulnReport: config.include_vuln_report,
        includeLicenseAudit: config.include_license_audit,
        includeIpProof: config.include_ip_proof,
        includeCraDocs: config.include_cra_docs,
        includeTimeline: config.include_timeline,
      },
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    });
  } catch (err) {
    console.error('Escrow config fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch escrow config' });
  }
});

// ─── PUT /:productId/config ─────────────────────────────────────────
// Update toggles, enable/disable escrow
router.put('/:productId/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { owned } = await verifyProductOwnership(orgId, productId);
    if (!owned) { res.status(404).json({ error: 'Product not found' }); return; }

    const { enabled, toggles } = req.body;

    // Build update SET clause dynamically
    const sets: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (typeof enabled === 'boolean') {
      sets.push(`enabled = $${paramIndex++}`);
      values.push(enabled);
    }

    if (toggles) {
      const toggleMap: Record<string, string> = {
        includeSbomCyclonedx: 'include_sbom_cyclonedx',
        includeSbomSpdx: 'include_sbom_spdx',
        includeVulnReport: 'include_vuln_report',
        includeLicenseAudit: 'include_license_audit',
        includeIpProof: 'include_ip_proof',
        includeCraDocs: 'include_cra_docs',
        includeTimeline: 'include_timeline',
      };
      for (const [key, col] of Object.entries(toggleMap)) {
        if (typeof toggles[key] === 'boolean') {
          sets.push(`${col} = $${paramIndex++}`);
          values.push(toggles[key]);
        }
      }
    }

    values.push(productId);
    const result = await pool.query(
      `UPDATE escrow_configs SET ${sets.join(', ')} WHERE product_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Escrow not configured for this product' });
      return;
    }

    res.json({ success: true });

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'escrow_config_updated',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, enabled, toggles },
    }).catch(() => {});

  } catch (err) {
    console.error('Escrow config update failed:', err);
    res.status(500).json({ error: 'Failed to update escrow config' });
  }
});

// ─── POST /:productId/setup ─────────────────────────────────────────
// Create Forgejo org + repo and enable escrow for this product
router.post('/:productId/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { owned, productName, orgName } = await verifyProductOwnership(orgId, productId);
    if (!owned) { res.status(404).json({ error: 'Product not found' }); return; }

    // Check not already set up
    const existing = await pool.query(
      'SELECT setup_completed FROM escrow_configs WHERE product_id = $1',
      [productId]
    );
    if (existing.rows[0]?.setup_completed) {
      res.status(400).json({ error: 'Escrow already configured for this product' });
      return;
    }

    const result = await setupProductEscrow(
      orgId, productId,
      orgName || 'unknown-org',
      productName || 'unknown-product'
    );

    // Trigger initial deposit
    runEscrowDeposit(productId, orgId, 'initial_setup').catch(err => {
      console.error('[ESCROW] Initial deposit failed:', err.message);
    });

    res.json({
      success: true,
      forgejoOrg: result.forgejoOrg,
      forgejoRepo: result.forgejoRepo,
    });

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'escrow_setup_completed',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, forgejoOrg: result.forgejoOrg, forgejoRepo: result.forgejoRepo },
    }).catch(() => {});

  } catch (err: any) {
    console.error('Escrow setup failed:', err);
    res.status(500).json({ error: err.message || 'Failed to set up escrow' });
  }
});

// ─── POST /:productId/deposit ───────────────────────────────────────
// Trigger a manual deposit
router.post('/:productId/deposit', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { owned } = await verifyProductOwnership(orgId, productId);
    if (!owned) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await runEscrowDeposit(productId, orgId, 'manual');

    res.json({
      success: result.status === 'completed',
      depositId: result.depositId,
      status: result.status,
      artifactCount: result.artifactCount,
      error: result.error,
    });

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'escrow_manual_deposit',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, depositId: result.depositId, status: result.status },
    }).catch(() => {});

  } catch (err) {
    console.error('Escrow manual deposit failed:', err);
    res.status(500).json({ error: 'Failed to trigger deposit' });
  }
});

// ─── GET /:productId/deposits ───────────────────────────────────────
// List deposit history (paginated)
router.get('/:productId/deposits', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { owned } = await verifyProductOwnership(orgId, productId);
    if (!owned) { res.status(404).json({ error: 'Product not found' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [deposits, countResult] = await Promise.all([
      pool.query(
        `SELECT id, status, trigger, commit_sha, artifacts_included, artifact_count,
                error_message, started_at, completed_at, created_at
         FROM escrow_deposits WHERE product_id = $1 AND org_id = $2
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [productId, orgId, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) FROM escrow_deposits WHERE product_id = $1 AND org_id = $2',
        [productId, orgId]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      deposits: deposits.rows.map(d => ({
        id: d.id,
        status: d.status,
        trigger: d.trigger,
        commitSha: d.commit_sha,
        artifactsIncluded: d.artifacts_included,
        artifactCount: d.artifact_count,
        errorMessage: d.error_message,
        startedAt: d.started_at,
        completedAt: d.completed_at,
        createdAt: d.created_at,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Escrow deposits fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
});

// ─── GET /:productId/status ─────────────────────────────────────────
// Quick status: enabled, last deposit, repo URL
router.get('/:productId/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { owned } = await verifyProductOwnership(orgId, productId);
    if (!owned) { res.status(404).json({ error: 'Product not found' }); return; }

    const config = await pool.query(
      'SELECT enabled, setup_completed, forgejo_org, forgejo_repo FROM escrow_configs WHERE product_id = $1',
      [productId]
    );

    if (config.rows.length === 0) {
      res.json({ configured: false, enabled: false });
      return;
    }

    const c = config.rows[0];
    const lastDeposit = await pool.query(
      `SELECT status, completed_at, artifact_count FROM escrow_deposits
       WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [productId]
    );

    const totalDeposits = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'completed') as completed,
              COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM escrow_deposits WHERE product_id = $1`,
      [productId]
    );

    const forgejoUrl = process.env.FORGEJO_URL || 'http://forgejo:3000';
    const publicForgejoUrl = 'https://escrow.cranis2.dev';

    res.json({
      configured: true,
      enabled: c.enabled,
      setupCompleted: c.setup_completed,
      repoUrl: `${publicForgejoUrl}/${c.forgejo_org}/${c.forgejo_repo}`,
      forgejoOrg: c.forgejo_org,
      forgejoRepo: c.forgejo_repo,
      lastDeposit: lastDeposit.rows[0] ? {
        status: lastDeposit.rows[0].status,
        completedAt: lastDeposit.rows[0].completed_at,
        artifactCount: lastDeposit.rows[0].artifact_count,
      } : null,
      stats: {
        total: parseInt(totalDeposits.rows[0].total),
        completed: parseInt(totalDeposits.rows[0].completed),
        failed: parseInt(totalDeposits.rows[0].failed),
      },
    });
  } catch (err) {
    console.error('Escrow status fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch escrow status' });
  }
});

export default router;
