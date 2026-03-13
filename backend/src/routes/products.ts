import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { logProductActivity } from '../services/activity-log.js';
import { cleanupProductEscrow } from '../services/escrow-service.js';
import { ensureObligations, computeDerivedStatuses } from '../services/obligation-engine.js';
import { ensureSections } from './technical-file/shared.js';
import { generateCycloneDX } from '../services/sbom-service.js';
import { generateComplianceSnapshot } from '../services/compliance-snapshot.js';
import { uploadToGlacier } from '../services/cold-storage.js';
import { createLedgerEntry } from '../services/retention-ledger.js';

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
      // Log but don't block – table might not exist in all environments
      console.error(`[CLEANUP] Failed: ${sql.slice(0, 60)}... – ${err.message}`);
    }
  }
}

// ─── GET /api/products – List products for the user's org ────────────
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


// ─── GET /api/products/:id/export – Download ZIP data export ─────────
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


// ─── GET /api/products/:id – Get single product ─────────────────────
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
      provider: p.provider || '',
      instanceUrl: p.instanceUrl || '',
      distributionModel: p.distributionModel || null,
      lifecycleStatus: p.lifecycleStatus || 'pre_production',
      marketPlacementDate: p.marketPlacementDate || null,
      status: p.status || 'active',
      createdAt: p.createdAt?.toString() || '',
      updatedAt: p.updatedAt?.toString() || '',
    });
  } finally {
    await session.close();
  }
});

// ─── POST /api/products – Create product ─────────────────────────────
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { name, description, version, productType, craCategory, repoUrl, distributionModel, provider, instanceUrl, lifecycleStatus, marketPlacementDate } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Product name is required' });
    return;
  }

  const validTypes = ['firmware', 'saas', 'library', 'desktop_app', 'mobile_app', 'iot_device', 'embedded', 'other'];
  const validCategories = ['default', 'important_i', 'important_ii', 'critical'];
  const validLifecycles = ['pre_production', 'on_market', 'end_of_life'];

  // Auto-set market placement date when lifecycle is on_market and no date provided
  const resolvedLifecycle = validLifecycles.includes(lifecycleStatus) ? lifecycleStatus : 'pre_production';
  const resolvedMarketDate = marketPlacementDate || (resolvedLifecycle === 'on_market' ? new Date().toISOString().split('T')[0] : null);

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
         lifecycleStatus: $lifecycleStatus,
         marketPlacementDate: $marketPlacementDate,
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
        lifecycleStatus: resolvedLifecycle,
        marketPlacementDate: resolvedMarketDate,
        provider: provider?.trim() || '',
        instanceUrl: instanceUrl?.trim() || '',
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

    // Activity log – product creation
    logProductActivity({
      productId, orgId, userId, userEmail,
      action: 'product_created',
      entityType: 'product',
      entityId: productId,
      summary: `Created product "${name.trim()}"`,
      newValues: { name: name.trim(), craCategory, productType, repoUrl: repoUrl?.trim() || null },
    }).catch(() => {});

    // Auto-populate stakeholder contacts if requested
    if (req.body.autoAssignContacts) {
      try {
        const orgNameResult = await session.run(
          'MATCH (o:Organisation {id: $orgId}) RETURN o.name AS orgName',
          { orgId }
        );
        const orgName = orgNameResult.records[0]?.get('orgName') || '';

        // Ensure org-level + product-level stakeholder rows exist (single batch INSERT)
        await pool.query(
          `INSERT INTO stakeholders (org_id, product_id, role_key) VALUES
           ($1, NULL, 'manufacturer_contact'), ($1, NULL, 'authorised_representative'), ($1, NULL, 'compliance_officer'),
           ($1, $2, 'security_contact'), ($1, $2, 'technical_file_owner'), ($1, $2, 'incident_response_lead')
           ON CONFLICT DO NOTHING`,
          [orgId, productId]
        );

        // Fill org-level roles (only where email is currently empty – never overwrite)
        await pool.query(
          `UPDATE stakeholders SET email = $1, organisation = $2, updated_by = $3, updated_at = NOW()
           WHERE org_id = $4 AND product_id IS NULL AND email = ''`,
          [userEmail, orgName, userEmail, orgId]
        );
        // Fill product-level roles
        await pool.query(
          `UPDATE stakeholders SET email = $1, organisation = $2, updated_by = $3, updated_at = NOW()
           WHERE org_id = $4 AND product_id = $5 AND email = ''`,
          [userEmail, orgName, userEmail, orgId, productId]
        );
      } catch (err: any) {
        console.error('[PRODUCT] Auto-assign contacts failed (non-blocking):', err.message);
      }
    }

    res.status(201).json({
      id: productId,
      name: name.trim(),
      description: description?.trim() || '',
      version: version?.trim() || '',
      productType: validTypes.includes(productType) ? productType : 'other',
      craCategory: validCategories.includes(craCategory) ? craCategory : 'default',
      repoUrl: repoUrl?.trim() || '',
      distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      lifecycleStatus: resolvedLifecycle,
      marketPlacementDate: resolvedMarketDate,
      provider: provider?.trim() || '',
      instanceUrl: instanceUrl?.trim() || '',
      status: 'active',
    });
  } catch (err) {
    console.error('Failed to create product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  } finally {
    await session.close();
  }
});

// ─── PUT /api/products/:id – Update product ─────────────────────────
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { name, description, version, productType, craCategory, repoUrl, distributionModel, provider, instanceUrl, lifecycleStatus, marketPlacementDate } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Product name is required' }); return; }

  const validLifecycles = ['pre_production', 'on_market', 'end_of_life'];
  const productId = req.params.id as string;
  const session = getDriver().session();
  try {
    // Capture old values for audit trail
    const oldResult = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory, p.repoUrl AS repoUrl,
              p.distributionModel AS distributionModel, p.productType AS productType,
              p.lifecycleStatus AS lifecycleStatus, p.marketPlacementDate AS marketPlacementDate`,
      { orgId, productId }
    );
    const oldProps = oldResult.records.length > 0 ? {
      name: oldResult.records[0].get('name'),
      craCategory: oldResult.records[0].get('craCategory'),
      repoUrl: oldResult.records[0].get('repoUrl'),
      distributionModel: oldResult.records[0].get('distributionModel'),
      productType: oldResult.records[0].get('productType'),
      lifecycleStatus: oldResult.records[0].get('lifecycleStatus'),
      marketPlacementDate: oldResult.records[0].get('marketPlacementDate'),
    } : null;

    // Auto-set market placement date when transitioning to on_market (if not already set)
    const newLifecycle = validLifecycles.includes(lifecycleStatus) ? lifecycleStatus : null;
    const transitioningToOnMarket = newLifecycle === 'on_market' && oldProps?.lifecycleStatus !== 'on_market';
    let resolvedMarketDate = marketPlacementDate || null;
    if (transitioningToOnMarket && !resolvedMarketDate && !oldProps?.marketPlacementDate) {
      resolvedMarketDate = new Date().toISOString().split('T')[0];
    } else if (!resolvedMarketDate && oldProps?.marketPlacementDate) {
      resolvedMarketDate = oldProps.marketPlacementDate;
    }

    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       SET p.name = $name, p.description = $description, p.version = $version,
           p.productType = $productType, p.craCategory = $craCategory,
           p.repoUrl = $repoUrl, p.distributionModel = $distributionModel,
           p.lifecycleStatus = $lifecycleStatus,
           p.marketPlacementDate = $marketPlacementDate,
           p.provider = $provider, p.instanceUrl = $instanceUrl,
           p.updatedAt = datetime()
       RETURN p`,
      {
        orgId,
        productId,
        name: name.trim(),
        description: description?.trim() || '',
        version: version?.trim() || '',
        productType: productType || 'other',
        craCategory: craCategory || 'default',
        repoUrl: repoUrl?.trim() || '',
        distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
        lifecycleStatus: newLifecycle,
        marketPlacementDate: resolvedMarketDate,
        provider: provider?.trim() || '',
        instanceUrl: instanceUrl?.trim() || '',
      }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Activity log – product updates with diff
    if (oldProps) {
      const changes: Record<string, any> = {};
      const oldVals: Record<string, any> = {};
      const newName = name.trim();
      const newCategory = craCategory || 'default';
      const newRepoUrl = repoUrl?.trim() || '';
      const newDistModel = VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null;
      const newProductType = productType || 'other';

      if (oldProps.name !== newName) { oldVals.name = oldProps.name; changes.name = newName; }
      if (oldProps.craCategory !== newCategory) { oldVals.craCategory = oldProps.craCategory; changes.craCategory = newCategory; }
      if ((oldProps.repoUrl || '') !== newRepoUrl) { oldVals.repoUrl = oldProps.repoUrl; changes.repoUrl = newRepoUrl; }
      if (oldProps.distributionModel !== newDistModel) { oldVals.distributionModel = oldProps.distributionModel; changes.distributionModel = newDistModel; }
      if (oldProps.productType !== newProductType) { oldVals.productType = oldProps.productType; changes.productType = newProductType; }
      if (oldProps.lifecycleStatus !== newLifecycle) { oldVals.lifecycleStatus = oldProps.lifecycleStatus; changes.lifecycleStatus = newLifecycle; }
      if ((oldProps.marketPlacementDate || null) !== resolvedMarketDate) { oldVals.marketPlacementDate = oldProps.marketPlacementDate; changes.marketPlacementDate = resolvedMarketDate; }

      if (Object.keys(changes).length > 0) {
        const changedFields = Object.keys(changes).join(', ');
        logProductActivity({
          productId, orgId, userId, userEmail,
          action: 'product_updated',
          entityType: 'product',
          entityId: productId,
          summary: `Updated product: ${changedFields}`,
          oldValues: oldVals,
          newValues: changes,
        }).catch(() => {});
      }
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
      provider: p.provider || '',
      instanceUrl: p.instanceUrl || '',
      distributionModel: p.distributionModel || null,
      lifecycleStatus: p.lifecycleStatus || 'pre_production',
      marketPlacementDate: p.marketPlacementDate || null,
    });

    // Auto-trigger evidence vault snapshot when product transitions to on_market
    if (transitioningToOnMarket) {
      (async () => {
        try {
          // Get the latest product version for release tracking
          const versionResult = await pool.query(
            `SELECT id, cranis_version FROM product_versions
             WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [productId]
          );
          const releaseId = versionResult.rows[0]?.id || null;
          const releaseVersion = versionResult.rows[0]?.cranis_version || null;

          // Create the snapshot record
          const insertResult = await pool.query(
            `INSERT INTO compliance_snapshots (org_id, product_id, created_by, filename, status, trigger_type, release_id, release_version)
             VALUES ($1, $2, $3, 'pending', 'generating', 'lifecycle_on_market', $4, $5)
             RETURNING id`,
            [orgId, productId, userId, releaseId, releaseVersion]
          );
          const snapshotId = insertResult.rows[0].id;

          const result = await generateComplianceSnapshot(orgId, productId, userId, snapshotId);

          await pool.query(
            `UPDATE compliance_snapshots
             SET filename = $1, size_bytes = $2, content_hash = $3, status = 'complete', metadata = $4,
                 rfc3161_token = $6, rfc3161_tsa_url = $7, rfc3161_timestamp = CASE WHEN $6 IS NOT NULL THEN NOW() ELSE NULL END,
                 signature = $8, signature_algorithm = $9, signature_key_id = $10
             WHERE id = $5`,
            [result.filename, result.sizeBytes, result.contentHash, JSON.stringify(result.metadata), snapshotId,
             result.rfc3161Token, result.rfc3161TsaUrl,
             result.signature, result.signatureAlgorithm, result.signatureKeyId]
          );

          logProductActivity({
            productId, orgId, userId, userEmail,
            action: 'evidence_vault_release_archived',
            entityType: 'compliance_snapshot',
            entityId: snapshotId,
            summary: `Auto-generated evidence vault snapshot on market placement${releaseVersion ? ` (v${releaseVersion})` : ''}`,
            metadata: { filename: result.filename, sizeBytes: result.sizeBytes, triggerType: 'lifecycle_on_market', releaseVersion },
          }).catch(() => {});

          // Upload to cold storage
          uploadToGlacier(orgId, productId, result.filename, result.filepath, snapshotId)
            .catch(err => console.error('[PRODUCT] Glacier upload failed:', err));

          // Create retention reserve ledger entry + funding certificate
          createLedgerEntry({
            orgId, productId, snapshotId,
            archiveHash: result.contentHash,
            archiveSizeBytes: result.sizeBytes,
            releaseVersion,
            coldStorageKey: `${orgId}/${productId}/${result.filename}`,
          }).catch(err => console.error('[PRODUCT] Ledger entry failed:', err));

          console.log(`[PRODUCT] Auto-generated evidence vault snapshot for product ${productId} on market placement`);
        } catch (err: any) {
          console.error('[PRODUCT] Auto evidence vault snapshot failed (non-blocking):', err.message);
        }
      })();
    }
  } finally {
    await session.close();
  }
});

// ─── DELETE /api/products/:id – Delete product with full cleanup ─────
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

// POST /api/products/:productId/onboard – One-click compliance setup wizard
// Provisions obligations, tech file sections, and stakeholder roles in one pass.
// The frontend wizard chains batch-fill and batch-evidence calls separately.
router.post('/:productId/onboard', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const productId = req.params.productId as string;

  try {
    const orgId = await getUserOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product + get metadata
    const session = getDriver().session();
    let productName: string;
    let craCategory: string | null;
    let craRole: string = 'manufacturer';
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.name AS name, p.craCategory AS craCategory, o.craRole AS craRole`,
        { orgId, productId }
      );
      if (result.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      productName = result.records[0].get('name') || productId;
      craCategory = result.records[0].get('craCategory') || null;
      craRole = result.records[0].get('craRole') || 'manufacturer';
    } finally {
      await session.close();
    }

    const provisioned: { step: string; action: string; detail?: string }[] = [];

    // 1. Ensure obligations
    await ensureObligations(orgId, productId, craCategory, craRole);
    const obCount = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM obligations WHERE org_id = $1 AND product_id = $2',
      [orgId, productId]
    );
    provisioned.push({ step: 'obligations', action: 'ensured', detail: `${obCount.rows[0].cnt} obligations` });

    // 2. Ensure tech file sections
    await ensureSections(productId);
    const secCount = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM technical_file_sections WHERE product_id = $1',
      [productId]
    );
    provisioned.push({ step: 'technical_file', action: 'ensured', detail: `${secCount.rows[0].cnt} sections` });

    // 3. Ensure stakeholder roles
    const orgSession = getDriver().session();
    let orgName = '';
    try {
      const orgResult = await orgSession.run('MATCH (o:Organisation {id: $orgId}) RETURN o.name AS name', { orgId });
      orgName = orgResult.records[0]?.get('name') || '';
    } finally {
      await orgSession.close();
    }
    await pool.query(
      `INSERT INTO stakeholders (org_id, product_id, role_key) VALUES
       ($1, NULL, 'manufacturer_contact'), ($1, NULL, 'authorised_representative'), ($1, NULL, 'compliance_officer'),
       ($1, $2, 'security_contact'), ($1, $2, 'technical_file_owner'), ($1, $2, 'incident_response_lead')
       ON CONFLICT DO NOTHING`,
      [orgId, productId]
    );
    await pool.query(
      `UPDATE stakeholders SET email = $1, organisation = $2, updated_by = $3, updated_at = NOW()
       WHERE org_id = $4 AND product_id IS NULL AND (email IS NULL OR email = '')`,
      [userEmail, orgName, userEmail, orgId]
    );
    await pool.query(
      `UPDATE stakeholders SET email = $1, organisation = $2, updated_by = $3, updated_at = NOW()
       WHERE org_id = $4 AND product_id = $5 AND (email IS NULL OR email = '')`,
      [userEmail, orgName, userEmail, orgId, productId]
    );
    provisioned.push({ step: 'stakeholders', action: 'ensured', detail: '6 roles (3 org + 3 product)' });

    // 4. Compute derived obligation statuses
    const categoryMap: Record<string, string | null> = { [productId]: craCategory || 'default' };
    await computeDerivedStatuses([productId], orgId, categoryMap, craRole);
    provisioned.push({ step: 'derived_statuses', action: 'computed' });

    // Activity log
    logProductActivity({
      productId, orgId, userId, userEmail,
      action: 'product_onboarded',
      entityType: 'product',
      entityId: productId,
      summary: `Onboarding wizard completed for "${productName}"`,
      metadata: { steps: provisioned.length },
    }).catch(() => {});

    const reqData = extractRequestData(req);
    recordEvent({
      userId, email: userEmail,
      eventType: 'product_onboarded',
      ...reqData,
      metadata: { productId, stepsCompleted: provisioned.length },
    }).catch(() => {});

    res.json({
      provisioned,
      summary: {
        stepsCompleted: provisioned.length,
        obligations: obCount.rows[0].cnt,
        sections: secCount.rows[0].cnt,
      },
    });
  } catch (err) {
    console.error('[ONBOARD] Failed:', err);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;
