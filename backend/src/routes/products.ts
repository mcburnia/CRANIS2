import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { cleanupProductEscrow } from '../services/escrow-service.js';
import { generateCycloneDX } from '../services/sbom-service.js';

const router = Router();

const VALID_DIST_MODELS = ['proprietary_binary', 'saas_hosted', 'source_available', 'library_component', 'internal_only'];

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

// Helper: get user's org_id
async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// ─── Postgres cleanup helper ─────────────────────────────────────────
// Deletes all Postgres rows for a product in FK-safe order
async function cleanupProductPostgres(productId: string, orgId: string): Promise<void> {
  const tables = [
    // FK children first
    { sql: `DELETE FROM cra_report_stages WHERE report_id IN (SELECT id FROM cra_reports WHERE product_id = $1 AND org_id = $2)`, params: [productId, orgId] },
    { sql: `DELETE FROM cra_reports WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM vulnerability_findings WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM vulnerability_scans WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM license_findings WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM license_scans WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM ip_proof_snapshots WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM product_sboms WHERE product_id = $1`, params: [productId] },
    { sql: `DELETE FROM technical_file_sections WHERE product_id = $1`, params: [productId] },
    { sql: `DELETE FROM product_versions WHERE product_id = $1`, params: [productId] },
    { sql: `DELETE FROM sync_history WHERE product_id = $1`, params: [productId] },
    { sql: `DELETE FROM obligations WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
    { sql: `DELETE FROM stakeholders WHERE product_id = $1 AND org_id = $2`, params: [productId, orgId] },
  ];

  for (const { sql, params } of tables) {
    try {
      const result = await pool.query(sql, params);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`[CLEANUP] Deleted ${result.rowCount} rows: ${sql.split(' FROM ')[1]?.split(' WHERE')[0]}`);
      }
    } catch (err: any) {
      // Log but don't block — table might not exist in all environments
      console.error(`[CLEANUP] Failed: ${sql.slice(0, 60)}... — ${err.message}`);
    }
  }
}

// ─── GET /api/products — List products for the user's org ────────────
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
       RETURN p ORDER BY p.createdAt DESC`,
      { orgId }
    );

    const products = result.records.map(r => {
      const p = r.get('p').properties;
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        version: p.version || '',
        productType: p.productType || '',
        craCategory: p.craCategory || 'default',
        repoUrl: p.repoUrl || '',
        distributionModel: p.distributionModel || null,
        status: p.status || 'active',
        createdAt: p.createdAt?.toString() || '',
      };
    });

    res.json({ products });
  } finally {
    await session.close();
  }
});


// ─── GET /api/products/:id/export — Download ZIP data export ─────────
// IMPORTANT: this route MUST come before /:id to avoid param conflict
router.get('/:id/export', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.id as string;

  // Verify ownership and get product data from Neo4j
  const session = getDriver().session();
  let productData: any = null;
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p`,
      { orgId, productId }
    );
    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const p = result.records[0].get('p').properties;
    productData = {
      id: p.id, name: p.name, description: p.description || '',
      version: p.version || '', productType: p.productType || '',
      craCategory: p.craCategory || 'default', repoUrl: p.repoUrl || '',
      distributionModel: p.distributionModel || null, status: p.status || 'active',
      createdAt: p.createdAt?.toString() || '', updatedAt: p.updatedAt?.toString() || '',
    };
  } finally {
    await session.close();
  }

  const slugName = (productData.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

  try {
    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slugName}-export.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Product metadata
    archive.append(JSON.stringify(productData, null, 2), { name: 'product.json' });

    // SBOMs
    const sbomResult = await pool.query(
      'SELECT spdx_json, package_count, synced_at FROM product_sboms WHERE product_id = $1',
      [productId]
    );
    if (sbomResult.rows[0]?.spdx_json) {
      archive.append(JSON.stringify(sbomResult.rows[0].spdx_json, null, 2), { name: 'sbom/sbom-spdx.json' });
    }
    try {
      const { cyclonedx } = await generateCycloneDX(orgId, productId);
      archive.append(JSON.stringify(cyclonedx, null, 2), { name: 'sbom/sbom-cyclonedx.json' });
    } catch { /* no cyclonedx data */ }

    // Vulnerability scans + findings
    const vulnScans = await pool.query(
      `SELECT id, status, source, findings_count, critical_count, high_count, medium_count, low_count,
              started_at, completed_at, created_at
       FROM vulnerability_scans WHERE product_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [productId, orgId]
    );
    if (vulnScans.rows.length > 0) {
      archive.append(JSON.stringify(vulnScans.rows, null, 2), { name: 'vulnerability-scans/scans.json' });
    }

    const vulnFindings = await pool.query(
      `SELECT source, source_id, severity, cvss_score, title, status,
              dependency_name, dependency_version, dependency_purl, fixed_version, created_at
       FROM vulnerability_findings WHERE product_id = $1 AND org_id = $2
       ORDER BY severity, dependency_name`,
      [productId, orgId]
    );
    if (vulnFindings.rows.length > 0) {
      archive.append(JSON.stringify(vulnFindings.rows, null, 2), { name: 'vulnerability-scans/findings.json' });
    }

    // License scans + findings
    const licenseScans = await pool.query(
      `SELECT id, status, total_deps, permissive_count, copyleft_count, unknown_count, critical_count,
              started_at, completed_at, created_at
       FROM license_scans WHERE product_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [productId, orgId]
    );
    if (licenseScans.rows.length > 0) {
      archive.append(JSON.stringify(licenseScans.rows, null, 2), { name: 'license-scans/scans.json' });
    }

    const licenseFindings = await pool.query(
      `SELECT dependency_name, dependency_version, dependency_purl, license_declared,
              license_category, risk_level, status, compatibility_verdict, created_at
       FROM license_findings WHERE product_id = $1 AND org_id = $2
       ORDER BY risk_level DESC, dependency_name`,
      [productId, orgId]
    );
    if (licenseFindings.rows.length > 0) {
      archive.append(JSON.stringify(licenseFindings.rows, null, 2), { name: 'license-scans/findings.json' });
    }

    // IP proof snapshots
    const ipProof = await pool.query(
      `SELECT id, snapshot_type, content_hash, content_summary, verified, created_at
       FROM ip_proof_snapshots WHERE product_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [productId, orgId]
    );
    if (ipProof.rows.length > 0) {
      archive.append(JSON.stringify(ipProof.rows, null, 2), { name: 'ip-proof/snapshots.json' });
    }

    // CRA obligations
    const obligations = await pool.query(
      'SELECT key, status, updated_at FROM obligations WHERE product_id = $1 AND org_id = $2',
      [productId, orgId]
    );
    if (obligations.rows.length > 0) {
      archive.append(JSON.stringify(obligations.rows, null, 2), { name: 'cra/obligations.json' });
    }

    // CRA reports
    const reports = await pool.query(
      `SELECT id, report_type, status, created_at, updated_at
       FROM cra_reports WHERE product_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [productId, orgId]
    );
    if (reports.rows.length > 0) {
      archive.append(JSON.stringify(reports.rows, null, 2), { name: 'cra/reports.json' });
    }

    // Technical file sections
    const techFile = await pool.query(
      `SELECT section_key, title, content, notes, status, cra_reference, updated_at
       FROM technical_file_sections WHERE product_id = $1
       ORDER BY section_key`,
      [productId]
    );
    if (techFile.rows.length > 0) {
      archive.append(JSON.stringify(techFile.rows, null, 2), { name: 'cra/technical-file.json' });
    }

    // Escrow data
    const escrowConfig = await pool.query(
      'SELECT * FROM escrow_configs WHERE product_id = $1',
      [productId]
    );
    if (escrowConfig.rows.length > 0) {
      archive.append(JSON.stringify(escrowConfig.rows[0], null, 2), { name: 'escrow/config.json' });

      const escrowDeposits = await pool.query(
        `SELECT id, status, trigger, commit_sha, artifacts_included, artifact_count,
                error_message, started_at, completed_at, created_at
         FROM escrow_deposits WHERE product_id = $1
         ORDER BY created_at DESC`,
        [productId]
      );
      if (escrowDeposits.rows.length > 0) {
        archive.append(JSON.stringify(escrowDeposits.rows, null, 2), { name: 'escrow/deposits.json' });
      }

      const escrowUsers = await pool.query(
        `SELECT email, display_name, forgejo_username, role, permission, status, created_at, revoked_at
         FROM escrow_users WHERE product_id = $1`,
        [productId]
      );
      if (escrowUsers.rows.length > 0) {
        archive.append(JSON.stringify(escrowUsers.rows, null, 2), { name: 'escrow/users.json' });
      }
    }

    // Product versions
    const versions = await pool.query(
      'SELECT cranis_version, github_tag, github_commit_sha, created_at FROM product_versions WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    );
    if (versions.rows.length > 0) {
      archive.append(JSON.stringify(versions.rows, null, 2), { name: 'versions.json' });
    }

    // Sync history
    const syncHistory = await pool.query(
      'SELECT sync_type, status, duration_seconds, error_message, created_at FROM sync_history WHERE product_id = $1 ORDER BY created_at DESC',
      [productId]
    );
    if (syncHistory.rows.length > 0) {
      archive.append(JSON.stringify(syncHistory.rows, null, 2), { name: 'sync-history.json' });
    }

    // Stakeholders (product-specific only)
    const stakeholders = await pool.query(
      'SELECT role_key, name, email, created_at FROM stakeholders WHERE product_id = $1 AND org_id = $2',
      [productId, orgId]
    );
    if (stakeholders.rows.length > 0) {
      archive.append(JSON.stringify(stakeholders.rows, null, 2), { name: 'stakeholders.json' });
    }

    await archive.finalize();

  } catch (err: any) {
    console.error('Product export failed:', err);
    // If headers already sent, we can't send JSON error
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export' });
    }
  }
});


// ─── GET /api/products/:id — Get single product ─────────────────────
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p`,
      { orgId, productId: req.params.id }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const p = result.records[0].get('p').properties;
    res.json({
      id: p.id,
      name: p.name,
      description: p.description || '',
      version: p.version || '',
      productType: p.productType || '',
      craCategory: p.craCategory || 'default',
      repoUrl: p.repoUrl || '',
      distributionModel: p.distributionModel || null,
      status: p.status || 'active',
      createdAt: p.createdAt?.toString() || '',
      updatedAt: p.updatedAt?.toString() || '',
    });
  } finally {
    await session.close();
  }
});

// ─── POST /api/products — Create product ─────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { name, description, version, productType, craCategory, repoUrl, distributionModel } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Product name is required' });
    return;
  }

  const validTypes = ['firmware', 'saas', 'library', 'desktop_app', 'mobile_app', 'iot_device', 'embedded', 'other'];
  const validCategories = ['default', 'class_i', 'class_ii'];

  const productId = uuidv4();
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (o:Organisation {id: $orgId})
       CREATE (p:Product {
         id: $productId,
         name: $name,
         description: $description,
         version: $version,
         productType: $productType,
         craCategory: $craCategory,
         repoUrl: $repoUrl,
         distributionModel: $distributionModel,
         status: 'active',
         createdAt: datetime(),
         updatedAt: datetime()
       })
       CREATE (p)-[:BELONGS_TO]->(o)
       RETURN p`,
      {
        orgId,
        productId,
        name: name.trim(),
        description: description?.trim() || '',
        version: version?.trim() || '',
        productType: validTypes.includes(productType) ? productType : 'other',
        craCategory: validCategories.includes(craCategory) ? craCategory : 'default',
        repoUrl: repoUrl?.trim() || '',
        distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      }
    );

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'product_created',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { productId, productName: name.trim(), productType, craCategory, repoUrl: repoUrl?.trim() || '' },
    });

    res.status(201).json({
      id: productId,
      name: name.trim(),
      description: description?.trim() || '',
      version: version?.trim() || '',
      productType: validTypes.includes(productType) ? productType : 'other',
      craCategory: validCategories.includes(craCategory) ? craCategory : 'default',
      repoUrl: repoUrl?.trim() || '',
      distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      status: 'active',
    });
  } catch (err) {
    console.error('Failed to create product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  } finally {
    await session.close();
  }
});

// ─── PUT /api/products/:id — Update product ─────────────────────────
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { name, description, version, productType, craCategory, repoUrl, distributionModel } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Product name is required' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       SET p.name = $name, p.description = $description, p.version = $version,
           p.productType = $productType, p.craCategory = $craCategory,
           p.repoUrl = $repoUrl, p.distributionModel = $distributionModel,
           p.updatedAt = datetime()
       RETURN p`,
      {
        orgId,
        productId: req.params.id,
        name: name.trim(),
        description: description?.trim() || '',
        version: version?.trim() || '',
        productType: productType || 'other',
        craCategory: craCategory || 'default',
        repoUrl: repoUrl?.trim() || '',
        distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const p = result.records[0].get('p').properties;
    res.json({
      id: p.id,
      name: p.name,
      description: p.description || '',
      version: p.version || '',
      productType: p.productType || '',
      craCategory: p.craCategory || 'default',
      repoUrl: p.repoUrl || '',
      distributionModel: p.distributionModel || null,
    });
  } finally {
    await session.close();
  }
});

// ─── DELETE /api/products/:id — Delete product with full cleanup ─────
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.id as string;

  // Verify product exists and belongs to org
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS productName`,
      { orgId, productId }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const productName = result.records[0].get('productName');

    // 1. Escrow cleanup (final deposit + preserve Forgejo repo + clean Postgres escrow tables)
    try {
      await cleanupProductEscrow(productId, orgId);
    } catch (err: any) {
      console.error(`[DELETE] Escrow cleanup failed for ${productId}:`, err.message);
    }

    // 2. Clean up all other Postgres tables
    try {
      await cleanupProductPostgres(productId, orgId);
    } catch (err: any) {
      console.error(`[DELETE] Postgres cleanup failed for ${productId}:`, err.message);
    }

    // 3. Delete from Neo4j
    await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       DETACH DELETE p`,
      { orgId, productId }
    );

    // 4. Telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'product_deleted',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { productId, productName },
    });

    console.log(`[DELETE] Product ${productName} (${productId}) fully deleted`);
    res.json({ message: 'Product deleted' });
  } finally {
    await session.close();
  }
});

export default router;
