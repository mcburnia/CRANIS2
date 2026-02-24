import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

// Auth middleware (per-route file, follows project pattern)
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  (req as any).userId = payload.userId;
  (req as any).email = payload.email;
  next();
}

// Helper: get user's org_id
async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// Helper: extract Neo4j integer safely
function toNumber(val: any): number {
  if (val && typeof val.toNumber === 'function') return val.toNumber();
  return typeof val === 'number' ? val : parseInt(val) || 0;
}

// Helper: query gap breakdown from Neo4j for a product
// Categorises directly from dep properties (not hashGapReason) so gaps
// are always accurate even for deps not processed by the enrichment pipeline.
async function queryGapBreakdown(neo4jSession: any, productId: string) {
  const result = await neo4jSession.run(
    `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
     RETURN count(d) AS total,
            count(d.hash) AS enriched,
            count(CASE WHEN d.hash IS NULL AND (d.version IS NULL OR d.version = '') THEN 1 END) AS noVersion,
            count(CASE WHEN d.hash IS NULL AND d.version IS NOT NULL AND d.version <> '' AND NOT d.ecosystem IN ['npm', 'pip', 'pypi'] THEN 1 END) AS unsupportedEcosystem,
            count(CASE WHEN d.hash IS NULL AND d.version IS NOT NULL AND d.version <> '' AND d.ecosystem IN ['npm', 'pip', 'pypi'] AND d.hashGapReason = 'not_found' THEN 1 END) AS notFound,
            count(CASE WHEN d.hash IS NULL AND d.version IS NOT NULL AND d.version <> '' AND d.ecosystem IN ['npm', 'pip', 'pypi'] AND d.hashGapReason = 'fetch_error' THEN 1 END) AS fetchError,
            count(CASE WHEN d.hash IS NULL AND d.version IS NOT NULL AND d.version <> '' AND d.ecosystem IN ['npm', 'pip', 'pypi'] AND (d.hashGapReason IS NULL OR NOT d.hashGapReason IN ['not_found', 'fetch_error']) THEN 1 END) AS pending,
            count(CASE WHEN d.versionSource = 'lockfile' THEN 1 END) AS lockfileResolved,
            max(d.hashEnrichedAt) AS lastEnrichedAt`,
    { productId }
  );

  const record = result.records[0];
  return {
    total: toNumber(record.get('total')),
    enriched: toNumber(record.get('enriched')),
    noVersion: toNumber(record.get('noVersion')),
    unsupportedEcosystem: toNumber(record.get('unsupportedEcosystem')),
    notFound: toNumber(record.get('notFound')),
    fetchError: toNumber(record.get('fetchError')),
    pending: toNumber(record.get('pending')),
    lockfileResolved: toNumber(record.get('lockfileResolved')),
    lastEnrichedAt: record.get('lastEnrichedAt') || null,
  };
}

// Helper: build compliance risk note for export metadata
function buildComplianceRiskNote(g: ReturnType<typeof Object>, total: number, enriched: number): string {
  const gapCount = total - enriched;
  if (gapCount === 0) {
    return 'All components have verified cryptographic hashes. SBOM meets CRA Article 13 hash requirements.';
  }

  const parts: string[] = [];
  parts.push(`${gapCount} of ${total} components have SBOM compliance gaps requiring action under CRA Article 13.`);

  const gaps = g as any;
  if (gaps.noVersion > 0) {
    parts.push(`${gaps.noVersion} missing version information (lockfile resolution recommended).`);
  }
  if (gaps.unsupportedEcosystem > 0) {
    parts.push(`${gaps.unsupportedEcosystem} use ecosystems not yet supported for hash verification.`);
  }
  if (gaps.notFound > 0) {
    parts.push(`${gaps.notFound} not found in their package registry.`);
  }
  if (gaps.fetchError > 0) {
    parts.push(`${gaps.fetchError} had registry fetch errors (will retry on next sync).`);
  }
  if (gaps.pending > 0) {
    parts.push(`${gaps.pending} eligible for enrichment (will be processed on next sync).`);
  }

  return parts.join(' ');
}

// ─── GET /api/sbom/:productId/export/cyclonedx ──────────────────────
// Export SBOM as CycloneDX 1.6 JSON
router.get('/:productId/export/cyclonedx', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) {
    res.status(403).json({ error: 'No organisation found' });
    return;
  }

  const productId = req.params.productId as string;
  const neo4jSession = getDriver().session();

  try {
    // 1. Verify product belongs to user's org and get product + org data
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p, o`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const product = productResult.records[0].get('p').properties;
    const org = productResult.records[0].get('o').properties;

    // 2. Check SBOM exists
    const sbomRow = await pool.query(
      'SELECT spdx_json FROM product_sboms WHERE product_id = $1',
      [productId]
    );
    if (sbomRow.rows.length === 0) {
      res.status(404).json({ error: 'No SBOM available. Sync the repository first.' });
      return;
    }

    // 3. Get all dependencies for this product from Neo4j
    const depsResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d ORDER BY d.name`,
      { productId }
    );

    // 4. Get SPDX relationships from raw JSON for dependency tree
    const spdxJson = typeof sbomRow.rows[0].spdx_json === 'string'
      ? JSON.parse(sbomRow.rows[0].spdx_json)
      : sbomRow.rows[0].spdx_json;
    const relationships = spdxJson?.sbom?.relationships || [];
    const spdxPackages = spdxJson?.sbom?.packages || [];

    // Build SPDXID -> purl map for resolving relationships
    const spdxIdToPurl = new Map<string, string>();
    for (const pkg of spdxPackages) {
      const purlRef = pkg.externalRefs?.find((r: any) => r.referenceType === 'purl');
      if (purlRef && pkg.SPDXID) {
        spdxIdToPurl.set(pkg.SPDXID, purlRef.referenceLocator);
      }
    }

    // 5. Build CycloneDX components
    const components = depsResult.records.map(record => {
      const d = record.get('d').properties;
      const component: any = {
        type: 'library',
        name: d.name,
        version: d.version || '',
        purl: d.purl,
        'bom-ref': d.purl,
      };

      // Add hashes if enriched
      if (d.hash && d.hashAlgorithm) {
        component.hashes = [{
          alg: d.hashAlgorithm,
          content: d.hash,
        }];
      }

      // Add license
      if (d.license && d.license !== 'NOASSERTION') {
        component.licenses = [{ license: { id: d.license } }];
      }

      // Add supplier
      if (d.supplier) {
        component.supplier = { name: d.supplier };
      }

      return component;
    });

    // 6. Build dependency tree from SPDX relationships
    const dependencyMap = new Map<string, string[]>();
    for (const rel of relationships) {
      if (rel.relationshipType === 'DEPENDS_ON') {
        const fromPurl = spdxIdToPurl.get(rel.spdxElementId);
        const toPurl = spdxIdToPurl.get(rel.relatedSpdxElement);
        if (fromPurl && toPurl) {
          if (!dependencyMap.has(fromPurl)) dependencyMap.set(fromPurl, []);
          dependencyMap.get(fromPurl)!.push(toPurl);
        }
      }
    }

    const dependencies = Array.from(dependencyMap.entries()).map(([ref, dependsOn]) => ({
      ref,
      dependsOn,
    }));

    // 7. Build manufacturer contact info
    const contacts: any[] = [];
    if (org.contactEmail || org.contactPhone) {
      contacts.push({
        name: org.name,
        ...(org.contactEmail ? { email: org.contactEmail } : {}),
        ...(org.contactPhone ? { phone: org.contactPhone } : {}),
      });
    }

    // 8. Query gap breakdown for compliance metadata
    const gapData = await queryGapBreakdown(neo4jSession, productId);
    const hashCount = gapData.enriched;
    const pct = components.length > 0 ? Math.round((hashCount / components.length) * 100) : 0;

    // 9. Assemble CycloneDX 1.6 document
    const cyclonedx: any = {
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      serialNumber: `urn:uuid:${uuidv4()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: {
          components: [{
            type: 'application',
            name: 'CRANIS2',
            version: '1.0.0',
            description: 'CRA/NIS2 Compliance Platform',
          }],
        },
        component: {
          type: 'application',
          name: product.name,
          version: product.version || '',
          ...(product.description ? { description: product.description } : {}),
        },
        manufacture: {
          name: org.name,
          ...(org.website ? { url: [org.website] } : {}),
          ...(contacts.length > 0 ? { contact: contacts } : {}),
        },
        properties: [
          {
            name: 'cranis2:hash-coverage',
            value: `${hashCount}/${components.length}`,
          },
          {
            name: 'cranis2:hash-coverage-percentage',
            value: `${pct}%`,
          },
          {
            name: 'cranis2:compliance-risk-note',
            value: buildComplianceRiskNote(gapData, components.length, hashCount),
          },
          {
            name: 'cranis2:compliance-gaps',
            value: JSON.stringify({
              noVersion: gapData.noVersion,
              unsupportedEcosystem: gapData.unsupportedEcosystem,
              notFound: gapData.notFound,
              fetchError: gapData.fetchError,
              pending: gapData.pending,
            }),
          },
        ],
      },
      components,
      dependencies,
    };

    // 10. Send as downloadable JSON
    const safeName = (product.name || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const version = product.version || 'latest';
    const filename = `${safeName}-${version}-cyclonedx-1.6.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(cyclonedx, null, 2));

    // Record telemetry (non-blocking)
    const reqData = extractRequestData(req);
    recordEvent({
      userId,
      email: (req as any).email,
      eventType: 'sbom_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, format: 'cyclonedx-1.6', componentCount: components.length },
    }).catch(() => {});

  } catch (err) {
    console.error('CycloneDX export failed:', err);
    res.status(500).json({ error: 'Failed to export CycloneDX SBOM' });
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/sbom/:productId/export/spdx ───────────────────────────
// Export SBOM as enriched SPDX 2.3 JSON
router.get('/:productId/export/spdx', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) {
    res.status(403).json({ error: 'No organisation found' });
    return;
  }

  const productId = req.params.productId as string;
  const neo4jSession = getDriver().session();

  try {
    // 1. Verify product belongs to user's org
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p, o`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const product = productResult.records[0].get('p').properties;
    const org = productResult.records[0].get('o').properties;

    // 2. Get stored SPDX JSON from Postgres
    const sbomRow = await pool.query(
      'SELECT spdx_json FROM product_sboms WHERE product_id = $1',
      [productId]
    );

    if (sbomRow.rows.length === 0) {
      res.status(404).json({ error: 'No SBOM available. Sync the repository first.' });
      return;
    }

    const spdxData = typeof sbomRow.rows[0].spdx_json === 'string'
      ? JSON.parse(sbomRow.rows[0].spdx_json)
      : sbomRow.rows[0].spdx_json;

    // Deep clone to avoid mutating cached JSONB
    const enrichedSpdx = JSON.parse(JSON.stringify(spdxData));
    const sbom = enrichedSpdx.sbom;

    // 3. Get hash data from Neo4j for enrichment
    const depsResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       WHERE d.hash IS NOT NULL
       RETURN d.purl AS purl, d.hash AS hash, d.hashAlgorithm AS alg, d.downloadUrl AS downloadUrl`,
      { productId }
    );

    const hashMap = new Map<string, { hash: string; alg: string; downloadUrl: string }>();
    for (const record of depsResult.records) {
      hashMap.set(record.get('purl'), {
        hash: record.get('hash'),
        alg: record.get('alg'),
        downloadUrl: record.get('downloadUrl') || '',
      });
    }

    // 4. Enrich SPDX packages with hashes and download URLs
    if (sbom.packages) {
      for (const pkg of sbom.packages) {
        const purlRef = pkg.externalRefs?.find((r: any) => r.referenceType === 'purl');
        if (purlRef) {
          const hashInfo = hashMap.get(purlRef.referenceLocator);
          if (hashInfo) {
            // Add checksum to package (SPDX 2.3 uses checksums array)
            if (!pkg.checksums) pkg.checksums = [];
            pkg.checksums.push({
              algorithm: hashInfo.alg,
              checksumValue: hashInfo.hash,
            });

            // Update downloadLocation if we have better data
            if (hashInfo.downloadUrl && (!pkg.downloadLocation || pkg.downloadLocation === 'NOASSERTION')) {
              pkg.downloadLocation = hashInfo.downloadUrl;
            }
          }
        }
      }
    }

    // 5. Query gap breakdown for compliance metadata
    const gapData = await queryGapBreakdown(neo4jSession, productId);
    const spdxHashCount = Array.from(hashMap.keys()).length;
    const spdxTotalPkgs = (sbom.packages || []).filter((p: any) => p.SPDXID !== 'SPDXRef-DOCUMENT').length;

    // 6. Enrich creator info with compliance-risk framing
    if (sbom.creationInfo) {
      if (!sbom.creationInfo.creators) sbom.creationInfo.creators = [];
      sbom.creationInfo.creators.push('Tool: CRANIS2-1.0.0');
      sbom.creationInfo.creators.push(`Organization: ${org.name}`);
      sbom.creationInfo.created = new Date().toISOString();

      const pct = spdxTotalPkgs > 0 ? Math.round((spdxHashCount / spdxTotalPkgs) * 100) : 0;
      const gapCount = spdxTotalPkgs - spdxHashCount;

      if (gapCount === 0) {
        sbom.creationInfo.comment = `SBOM enriched by CRANIS2. Hash coverage: ${spdxHashCount}/${spdxTotalPkgs} (100%). All packages have verified cryptographic hashes sourced from package registries (npm SHA-512, PyPI SHA-256).`;
      } else {
        const parts: string[] = [];
        parts.push(`SBOM enriched by CRANIS2. Hash coverage: ${spdxHashCount}/${spdxTotalPkgs} (${pct}%).`);
        parts.push(`WARNING: ${gapCount} packages have compliance gaps that may not meet CRA Article 13 SBOM requirements.`);
        parts.push(`Gap breakdown: ${gapData.noVersion} missing versions, ${gapData.unsupportedEcosystem} unsupported ecosystems, ${gapData.notFound} not found, ${gapData.fetchError} fetch errors, ${gapData.pending} pending enrichment.`);
        sbom.creationInfo.comment = parts.join(' ');
      }
    }

    // 7. Send as downloadable JSON
    const safeName = (product.name || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const version = product.version || 'latest';
    const filename = `${safeName}-${version}-spdx-2.3.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(enrichedSpdx, null, 2));

    // Record telemetry (non-blocking)
    const reqData = extractRequestData(req);
    recordEvent({
      userId,
      email: (req as any).email,
      eventType: 'sbom_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, format: 'spdx-2.3', packageCount: sbom.packages?.length || 0 },
    }).catch(() => {});

  } catch (err) {
    console.error('SPDX export failed:', err);
    res.status(500).json({ error: 'Failed to export SPDX SBOM' });
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/sbom/:productId/export/status ─────────────────────────
// Returns hash enrichment status with categorised gap breakdown
router.get('/:productId/export/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) {
    res.status(403).json({ error: 'No organisation found' });
    return;
  }

  const productId = req.params.productId as string;
  const neo4jSession = getDriver().session();

  try {
    // Verify product belongs to user's org
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.id`,
      { orgId, productId }
    );

    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Query categorised gap breakdown
    const gapData = await queryGapBreakdown(neo4jSession, productId);

    // Check if SBOM exists
    const sbomRow = await pool.query(
      'SELECT synced_at FROM product_sboms WHERE product_id = $1',
      [productId]
    );

    res.json({
      hasSBOM: sbomRow.rows.length > 0,
      sbomSyncedAt: sbomRow.rows[0]?.synced_at || null,
      totalDependencies: gapData.total,
      enrichedDependencies: gapData.enriched,
      enrichmentComplete: gapData.total > 0 && gapData.enriched >= gapData.total,
      gaps: {
        noVersion: gapData.noVersion,
        unsupportedEcosystem: gapData.unsupportedEcosystem,
        notFound: gapData.notFound,
        fetchError: gapData.fetchError,
        pending: gapData.pending,
      },
      lockfileResolved: gapData.lockfileResolved,
      lastEnrichedAt: gapData.lastEnrichedAt,
    });
  } catch (err) {
    console.error('Export status check failed:', err);
    res.status(500).json({ error: 'Failed to check export status' });
  } finally {
    await neo4jSession.close();
  }
});

export default router;
