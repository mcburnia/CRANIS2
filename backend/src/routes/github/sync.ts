import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';
import { sendComplianceGapNotification } from '../../services/notifications.js';
import { enrichDependencyHashes } from '../../services/hash-enrichment.js';
import { enrichDependencyLicenses } from '../../services/license-enrichment.js';
import { scanProductLicenses } from '../../services/license-scanner.js';
import { createSnapshot } from '../../services/ip-proof.js';
import { resolveLockfileVersions } from '../../services/lockfile-resolver.js';
import { generateSBOMFromLockfiles } from '../../services/lockfile-sbom-generator.js';
import { generateSBOMFromImports } from '../../services/import-scanner.js';
import * as provider from '../../services/repo-provider.js';
import type { NormalisedRelease } from '../../services/repo-provider.js';
import type { SpdxPackage } from '../../services/github.js';
import { evaluateOrganisation, applyClassification, getClassification } from '../../services/trust-classification.js';
import { createRepo as codebergCreateRepo } from '../../services/codeberg.js';
import { ensureWebhook } from '../../services/webhook.js';
import { logger } from '../../utils/logger.js';
import { logProductActivity } from '../../services/activity-log.js';
import {
  getUserOrgId,
  getUserRepoToken,
  getUserRepoConnection,
  resolveRepoConnection,
  extractPackageInfo,
  storeSBOM,
} from '../../services/repo-helpers.js';
import { requireAuth } from './shared.js';

const router = Router();

// ─── POST /api/github/sync/:productId ──────────────────────────
// Sync repo data + SBOM from GitHub (READ-ONLY API calls)
router.post('/sync/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
  const neo4jSession = getDriver().session();

  try {
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.repoUrl AS repoUrl, p.name AS productName`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const repoUrl = productResult.records[0].get('repoUrl');
    const productName = productResult.records[0].get('productName');

    if (!repoUrl) {
      res.status(400).json({ error: 'Product has no repository URL configured' });
      return;
    }

    // Resolve provider + token from repo URL (supports cloud + self-hosted)
    const repoConn = await resolveRepoConnection(userId, repoUrl);
    if (!repoConn) {
      res.status(400).json({ error: 'No provider connection found for this repository URL. Please connect your account first.' });
      return;
    }
    const detectedProvider = repoConn.provider;
    const parsed = { owner: repoConn.owner, repo: repoConn.repo };
    const repoToken = repoConn.token;
    const repoInstanceUrl = repoConn.instanceUrl;

    const syncStartedAt = new Date();
    const syncStartMs = Date.now();

    // Fetch ALL data from provider in parallel (ALL READ-ONLY GET requests)
    logger.info(`[SYNC] Fetching data from ${detectedProvider} for`, parsed.owner, parsed.repo);
    const [repoData, contributors, languages, sbomData, releases, tags] = await Promise.all([
      provider.getRepo(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getContributors(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getLanguages(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getSBOM(detectedProvider, repoToken, parsed.owner, parsed.repo),
      provider.getReleases(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getTags(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
    ]);

    // Store repo data in Neo4j
    await neo4jSession.run(
      `MERGE (r:Repository {url: $url})
       ON CREATE SET r.createdAt = datetime()
       SET r.owner = $owner,
           r.name = $name,
           r.fullName = $fullName,
           r.description = $description,
           r.language = $language,
           r.stars = $stars,
           r.forks = $forks,
           r.openIssues = $openIssues,
           r.visibility = $visibility,
           r.defaultBranch = $defaultBranch,
           r.lastPush = $lastPush,
           r.isPrivate = $isPrivate,
           r.languages = $languagesJson,
           r.provider = $provider,
           r.syncedAt = datetime()

       WITH r
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_REPO]->(r)

       WITH r
       MATCH (u:User {id: $userId})
       MERGE (u)-[:REPO_CONNECTED]->(r)`,
      {
        url: repoData.html_url,
        owner: parsed.owner,
        name: parsed.repo,
        fullName: repoData.full_name,
        description: repoData.description || '',
        language: repoData.language || '',
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        visibility: repoData.visibility,
        defaultBranch: repoData.default_branch,
        lastPush: repoData.pushed_at,
        isPrivate: repoData.private,
        languagesJson: JSON.stringify(languages),
        provider: detectedProvider,
        productId,
        userId,
      }
    );

    // Auto-register push webhook (non-blocking – must not fail the sync)
    ensureWebhook(detectedProvider, repoToken, parsed.owner, parsed.repo, repoData.html_url, repoInstanceUrl || undefined)
      .catch(err => console.error(`[SYNC] Webhook registration failed (non-blocking): ${err.message}`));

    // Abuse protection: if a private repo is connected, ensure org is classified as commercial
    if (repoData.private) {
      (async () => {
        try {
          const current = await getClassification(orgId);
          if (current && current.trust_classification !== 'commercial' && current.trust_classification !== 'review_required') {
            const evaluation = await evaluateOrganisation(orgId);
            await applyClassification(orgId, evaluation, 'automatic');
            console.log(`[TRUST] Private repo connected — org ${orgId} reclassified to ${evaluation.classification}`);
          }
        } catch (err: any) {
          console.error('[TRUST] Private repo abuse check failed:', err.message);
        }
      })();
    }

    // Store contributors in Neo4j
    for (const contrib of contributors) {
      await neo4jSession.run(
        `MATCH (r:Repository {url: $repoUrl})
         MERGE (c:Contributor {githubId: $githubId})
         ON CREATE SET c.createdAt = datetime()
         SET c.githubLogin = $login,
             c.avatarUrl = $avatarUrl,
             c.profileUrl = $profileUrl,
             c.contributions = $contributions
         MERGE (r)-[rel:HAS_CONTRIBUTOR]->(c)
         SET rel.contributions = $contributions, rel.syncedAt = datetime()`,
        {
          repoUrl: repoData.html_url,
          githubId: contrib.id,
          login: contrib.login,
          avatarUrl: contrib.avatar_url,
          profileUrl: contrib.html_url,
          contributions: contrib.contributions,
        }
      );
    }

    // Lockfile fallback: if provider API has no SBOM (e.g. Codeberg), generate from lockfiles
    let effectiveSbomData = sbomData;
    let sbomSource = 'api';
    if (!effectiveSbomData) {
      logger.info("[SYNC] No API SBOM – trying lockfile fallback...");
      const lockfileResult = await generateSBOMFromLockfiles(
        parsed.owner, parsed.repo, repoData.default_branch,
        detectedProvider, repoToken, repoData.html_url, repoInstanceUrl || undefined
      );
      if (lockfileResult) {
        effectiveSbomData = lockfileResult.sbom as any;
        sbomSource = `lockfile:${lockfileResult.lockfileUsed}`;
        logger.info(`[SYNC] Lockfile SBOM generated from ${lockfileResult.lockfileUsed}: ${lockfileResult.totalDependencies} dependencies`);
      }
    }

    // Tier 3: Source import scanning (if no API SBOM and no lockfile found)
    if (!effectiveSbomData) {
      logger.info("[SYNC] No lockfile SBOM – trying import scan (Tier 3)...");
      try {
        const importResult = await generateSBOMFromImports(
          parsed.owner, parsed.repo, repoData.default_branch,
          detectedProvider, repoToken, repoData.html_url, repoInstanceUrl || undefined
        );
        if (importResult) {
          effectiveSbomData = { sbom: importResult.sbom } as any;
          const langTag = importResult.languagesDetected.join('+');
          sbomSource = `import-scan:${langTag}`.slice(0, 255);
          logger.info(`[SYNC] Import scan SBOM: ${importResult.languagesDetected.join(', ')} – ${importResult.totalPackages} packages (confidence: ${importResult.confidence})`);
        }
      } catch (err: any) {
        console.error(`[SYNC] Import scan failed: ${err.message}`);
      }
    }

    // Store SBOM in Postgres + Neo4j (if available)
    let sbomResult: { packageCount: number; packages: any[] } | null = null;
    logger.info("[SYNC] SBOM result:", effectiveSbomData ? `Found ${effectiveSbomData.sbom?.packages?.length || 0} packages` : "null - no SBOM available");
    if (effectiveSbomData) {
      sbomResult = await storeSBOM(productId, effectiveSbomData, neo4jSession, sbomSource);

      // Post-SBOM compliance pipeline (non-blocking)
      if (sbomResult) {
        const pipelinePackages = sbomResult.packages;
        const pipelineProductId = productId;
        const pipelineOrgId = orgId;
        const pipelineProductName = productName;
        const pipelineUserId = userId;
        const pipelineGhToken = repoToken;
        (async () => {
          try {
            // 1. Resolve version gaps from lockfile
            if (pipelineGhToken) {
              await resolveLockfileVersions(pipelineProductId, pipelineGhToken);
            }
            // 2. Enrich hashes (newly-versioned deps now eligible)
            const enrichResult = await enrichDependencyHashes(pipelineProductId, pipelinePackages);
            // 3. Send compliance gap notifications
            const totalDeps = enrichResult.enriched + enrichResult.gaps.noVersion + enrichResult.gaps.unsupportedEcosystem + enrichResult.gaps.notFound + enrichResult.gaps.fetchError;
            await sendComplianceGapNotification(pipelineProductId, pipelineOrgId, pipelineProductName, enrichResult.gaps, totalDeps);
            // 4. Enrich licenses from npm registry (for NOASSERTION deps)
            await enrichDependencyLicenses(pipelineProductId, pipelinePackages);
            // 5. Auto license scan
            if (pipelineOrgId) {
              try {
                await scanProductLicenses(pipelineProductId, pipelineOrgId);
                logger.debug("[SYNC] License scan completed for", pipelineProductId);
              } catch (lsErr: any) {
                console.error("[SYNC] License scan failed:", lsErr.message);
              }
              // 6. IP proof timestamp
              try {
                await createSnapshot(pipelineProductId, pipelineOrgId, pipelineUserId, 'sync');
                logger.debug("[SYNC] IP proof snapshot created for", pipelineProductId);
              } catch (ipErr: any) {
                console.error("[SYNC] IP proof snapshot failed:", ipErr.message);
              }
              // 7. Trust classification re-evaluation
              try {
                const evaluation = await evaluateOrganisation(pipelineOrgId);
                await applyClassification(pipelineOrgId, evaluation, 'automatic');
                logger.debug("[SYNC] Trust classification updated for org", pipelineOrgId, "→", evaluation.classification);
              } catch (tcErr: any) {
                console.error("[SYNC] Trust classification update failed:", tcErr.message);
              }
            }
          } catch (err: any) {
            console.error("[SYNC] Post-SBOM pipeline failed:", err.message);
          }
        })();
      }
    }

    // ── Store GitHub releases in product_versions ──
    const publishedReleases = releases.filter((r: NormalisedRelease) => !r.draft);
    for (const rel of publishedReleases) {
      await pool.query(
        `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_release_body, github_commit_sha, is_prerelease, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'github_release', $8)
         ON CONFLICT DO NOTHING`,
        [
          productId,
          rel.tag_name,
          rel.tag_name,
          rel.name || rel.tag_name,
          rel.body || '',
          rel.target_commitish,
          rel.prerelease,
          rel.published_at,
        ]
      );
    }

    // ── Generate CRANIS2 auto-version (YYYY.MM.DD.NNNN) ──
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const counterResult = await pool.query(
      `SELECT cranis_version FROM product_versions
       WHERE product_id = $1 AND source = 'sync' AND cranis_version LIKE $2
       ORDER BY cranis_version DESC LIMIT 1`,
      [productId, today + '.%']
    );
    let counter = 1;
    if (counterResult.rows.length > 0) {
      const lastVersion = counterResult.rows[0].cranis_version;
      const lastCounter = parseInt(lastVersion.split('.').pop() || '0', 10);
      counter = lastCounter + 1;
    }
    const cranisVersion = `${today}.${String(counter).padStart(4, '0')}`;

    // Find latest tag's commit SHA if available
    const latestTagSha = tags.length > 0 ? tags[0].commit.sha : null;
    const latestRelease = publishedReleases.length > 0 ? publishedReleases[0] : null;

    await pool.query(
      `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_commit_sha, source)
       VALUES ($1, $2, $3, $4, $5, 'sync')`,
      [
        productId,
        cranisVersion,
        latestRelease?.tag_name || null,
        latestRelease?.name || null,
        latestTagSha,
      ]
    );

    // Update Product node version in Neo4j
    await neo4jSession.run(
      `MATCH (p:Product {id: $productId}) SET p.version = $version`,
      { productId, version: cranisVersion }
    );
    logger.info(`[SYNC] CRANIS2 version: ${cranisVersion}, GitHub releases: ${publishedReleases.length}, tags: ${tags.length}`);

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'github_repo_synced',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: {
        productId,
        productName,
        repoFullName: repoData.full_name,
        contributors: contributors.length,
        languages: Object.keys(languages).length,
        sbomPackages: sbomResult?.packageCount || 0,
      },
    });

    // Activity log – repo sync
    logProductActivity({
      productId, orgId, userId, userEmail,
      action: 'repo_synced',
      entityType: 'repository',
      entityId: repoData.full_name,
      summary: `Synced repository ${repoData.full_name} (${sbomResult?.packageCount || 0} packages)`,
      newValues: { packageCount: sbomResult?.packageCount || 0, contributors: contributors.length, version: cranisVersion },
    }).catch(() => {});

    // Record sync duration
    const syncDurationSeconds = (Date.now() - syncStartMs) / 1000;
    logger.info(`[SYNC] Duration: ${syncDurationSeconds.toFixed(2)}s for ${parsed.owner}/${parsed.repo}`);
    await pool.query(
      `INSERT INTO sync_history (product_id, sync_type, started_at, duration_seconds, package_count, contributor_count, release_count, cranis_version, triggered_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [productId, 'manual', syncStartedAt, syncDurationSeconds, sbomResult?.packageCount || 0, contributors.length, publishedReleases.length, cranisVersion, userEmail, 'success']
    );

    // Build response
    const totalBytes = Object.values(languages).reduce((sum, b) => sum + b, 0);
    const languageBreakdown = Object.entries(languages)
      .map(([lang, bytes]) => ({ language: lang, bytes, percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0 }))
      .sort((a, b) => b.bytes - a.bytes);

    res.json({
      provider: detectedProvider,
      repo: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        url: repoData.html_url,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        visibility: repoData.visibility,
        defaultBranch: repoData.default_branch,
        lastPush: repoData.pushed_at,
        isPrivate: repoData.private,
      },
      contributors: contributors.map(c => ({
        login: c.login,
        githubId: c.id,
        avatarUrl: c.avatar_url,
        profileUrl: c.html_url,
        contributions: c.contributions,
      })),
      languages: languageBreakdown,
      sbom: sbomResult ? {
        packageCount: sbomResult.packageCount,
        syncedAt: new Date().toISOString(),
        isStale: false,
      } : null,
      version: cranisVersion,
      releases: publishedReleases.map((r: any) => ({
        tagName: r.tag_name,
        name: r.name,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        url: r.html_url,
      })),
    });
  } catch (err: any) {
    console.error('GitHub sync error:', err);
    if (err.message?.includes('404')) {
      res.status(404).json({ error: 'Repository not found. Check the URL and ensure your account has access.' });
    } else if (err.message?.includes('401') || err.message?.includes('403')) {
      res.status(403).json({ error: 'GitHub access denied. Your token may have expired. Try reconnecting.' });
    } else {
      res.status(500).json({ error: 'Failed to sync repository' });
    }
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/github/sbom/:productId ────────────────────────────
// Get cached SBOM data (from Postgres, no GitHub API call)
router.get('/sbom/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id`,
      { orgId, productId }
    );
    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
  } finally {
    await neo4jSession.close();
  }

  // Get SBOM from Postgres
  const result = await pool.query(
    'SELECT spdx_json, spdx_version, package_count, is_stale, synced_at FROM product_sboms WHERE product_id = $1',
    [productId]
  );

  if (result.rows.length === 0) {
    res.json({ hasSBOM: false });
    return;
  }

  const row = result.rows[0];
  const sbomData = typeof row.spdx_json === 'string' ? JSON.parse(row.spdx_json) : row.spdx_json;

  // Parse packages for the frontend
  const packages = (sbomData?.sbom?.packages || [])
    .filter((p: SpdxPackage) => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.'))
    .map((p: SpdxPackage) => extractPackageInfo(p));

  res.json({
    hasSBOM: true,
    spdxVersion: row.spdx_version,
    packageCount: row.package_count,
    isStale: row.is_stale,
    syncedAt: row.synced_at,
    packages,
  });
});

// ─── POST /api/github/sbom/:productId ───────────────────────────
// Refresh SBOM only (without full repo sync)
router.post('/sbom/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
  const neo4jSession = getDriver().session();

  try {
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.repoUrl AS repoUrl, p.name AS productName`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const repoUrl = productResult.records[0].get('repoUrl');
    const productName = productResult.records[0].get('productName');

    if (!repoUrl) {
      res.status(400).json({ error: 'Product has no repository URL configured' });
      return;
    }

    // Resolve provider + token (supports cloud + self-hosted)
    const sbomConn = await resolveRepoConnection(userId, repoUrl);
    if (!sbomConn) {
      res.status(400).json({ error: 'No provider connection found for this repository.' });
      return;
    }
    const sbomProvider = sbomConn.provider;
    const parsed = { owner: sbomConn.owner, repo: sbomConn.repo };
    const sbomToken = sbomConn.token;
    const sbomInstanceUrl = sbomConn.instanceUrl;

    let sbomData = await provider.getSBOM(sbomProvider, sbomToken, parsed.owner, parsed.repo);
    let refreshSbomSource = 'api';
    // Fetch default branch for fallback SBOM generation
    const repoNode = await neo4jSession.run(
      'MATCH (p:Product {id: $productId})-[:HAS_REPO]->(r:Repository) RETURN r.defaultBranch as defaultBranch',
      { productId }
    );
    const defaultBranch = repoNode.records[0]?.get('defaultBranch') || 'main';
    if (!sbomData) {
      // Lockfile fallback: generate SBOM from lockfiles
      logger.info("[SBOM-REFRESH] No API SBOM – trying lockfile fallback...");
      const lockfileResult = await generateSBOMFromLockfiles(
        parsed.owner, parsed.repo, defaultBranch,
        sbomProvider, sbomToken, repoUrl
      );
      if (lockfileResult) {
        sbomData = lockfileResult.sbom as any;
        refreshSbomSource = `lockfile:${lockfileResult.lockfileUsed}`;
        logger.info(`[SBOM-REFRESH] Lockfile SBOM: ${lockfileResult.lockfileUsed} (${lockfileResult.totalDependencies} deps)`);
      }
    }
    // Tier 3: Source import scanning
    if (!sbomData) {
      logger.info("[SBOM-REFRESH] No lockfile SBOM – trying import scan (Tier 3)...");
      try {
        const importResult = await generateSBOMFromImports(
          parsed.owner, parsed.repo, defaultBranch,
          sbomProvider, sbomToken, repoUrl
        );
        if (importResult) {
          sbomData = { sbom: importResult.sbom } as any;
          refreshSbomSource = `import-scan:${importResult.languagesDetected.join('+')}`;
          logger.info(`[SBOM-REFRESH] Import scan: ${importResult.languagesDetected.join(', ')} – ${importResult.totalPackages} packages`);
        }
      } catch (err: any) {
        console.error(`[SBOM-REFRESH] Import scan failed: ${err.message}`);
      }
    }
    if (!sbomData) {
      res.status(404).json({ error: 'No dependency data available for this repository. No lockfile or source imports found.' });
      return;
    }

    const sbomResult = await storeSBOM(productId, sbomData, neo4jSession, refreshSbomSource);

    // Post-SBOM compliance pipeline (non-blocking)
    const refreshPackages = sbomResult.packages;
    const refreshGhToken = sbomToken;
    (async () => {
      try {
        if (refreshGhToken) {
          await resolveLockfileVersions(productId, refreshGhToken);
        }
        const enrichResult = await enrichDependencyHashes(productId, refreshPackages);
        const totalDeps = enrichResult.enriched + enrichResult.gaps.noVersion + enrichResult.gaps.unsupportedEcosystem + enrichResult.gaps.notFound + enrichResult.gaps.fetchError;
        await sendComplianceGapNotification(productId, orgId, productName, enrichResult.gaps, totalDeps);
        // 4. Enrich licenses from npm registry (for NOASSERTION deps)
        await enrichDependencyLicenses(productId, refreshPackages);
        // 5. Auto license scan
        try {
          await scanProductLicenses(productId, orgId);
          logger.debug("[SBOM-REFRESH] License scan completed for", productId);
        } catch (lsErr: any) {
          console.error("[SBOM-REFRESH] License scan failed:", lsErr.message);
        }
        // 6. IP proof timestamp
        try {
          await createSnapshot(productId, orgId, userId, 'sync');
          logger.debug("[SBOM-REFRESH] IP proof snapshot created for", productId);
        } catch (ipErr: any) {
          console.error("[SBOM-REFRESH] IP proof snapshot failed:", ipErr.message);
        }
      } catch (err: any) {
        console.error("[SBOM-REFRESH] Post-SBOM pipeline failed:", err.message);
      }
    })();

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'sbom_refreshed',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { productId, productName, packageCount: sbomResult.packageCount },
    });

    res.json({
      hasSBOM: true,
      packageCount: sbomResult.packageCount,
      isStale: false,
      syncedAt: new Date().toISOString(),
      packages: sbomResult.packages,
    });
  } catch (err: any) {
    console.error('SBOM refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh SBOM' });
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/github/versions/:productId ─────────────────────────
// Get version history for a product
router.get('/versions/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const result = await pool.query(
      `SELECT cranis_version, github_tag, github_release_name, github_release_body,
              github_commit_sha, is_prerelease, source, created_at
       FROM product_versions
       WHERE product_id = $1
       ORDER BY created_at DESC`,
      [productId]
    );

    res.json({
      versions: result.rows.map((row: any) => ({
        cranisVersion: row.cranis_version,
        githubTag: row.github_tag,
        releaseName: row.github_release_name,
        releaseBody: row.github_release_body,
        commitSha: row.github_commit_sha,
        isPrerelease: row.is_prerelease,
        source: row.source,
        createdAt: row.created_at,
      })),
    });
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/github/sync-history/:productId ─────────────────────
// Get sync duration history for a product
router.get('/sync-history/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  const neo4jSession = getDriver().session();
  try {
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const result = await pool.query(
      `SELECT sync_type, started_at, duration_seconds, package_count,
              contributor_count, release_count, cranis_version,
              triggered_by, status, error_message, created_at
       FROM sync_history
       WHERE product_id = $1
       ORDER BY started_at DESC
       LIMIT 50`,
      [productId]
    );

    // Also get aggregate stats
    const stats = await pool.query(
      `SELECT
         COUNT(*) as total_syncs,
         ROUND(AVG(duration_seconds)::numeric, 2) as avg_duration,
         ROUND(MIN(duration_seconds)::numeric, 2) as min_duration,
         ROUND(MAX(duration_seconds)::numeric, 2) as max_duration,
         COUNT(*) FILTER (WHERE status = 'error') as error_count
       FROM sync_history
       WHERE product_id = $1`,
      [productId]
    );

    res.json({
      history: result.rows.map((row: any) => ({
        syncType: row.sync_type,
        startedAt: row.started_at,
        durationSeconds: parseFloat(row.duration_seconds),
        packageCount: row.package_count,
        contributorCount: row.contributor_count,
        releaseCount: row.release_count,
        cranisVersion: row.cranis_version,
        triggeredBy: row.triggered_by,
        status: row.status,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
      stats: stats.rows[0] ? {
        totalSyncs: parseInt(stats.rows[0].total_syncs),
        avgDuration: parseFloat(stats.rows[0].avg_duration) || 0,
        minDuration: parseFloat(stats.rows[0].min_duration) || 0,
        maxDuration: parseFloat(stats.rows[0].max_duration) || 0,
        errorCount: parseInt(stats.rows[0].error_count),
      } : null,
    });
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/github/push-events/:productId ───────────────────────
// Return recent push events received via webhook for a product
router.get('/push-events/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id`,
      { orgId, productId }
    );
    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
  } finally {
    await neo4jSession.close();
  }

  const result = await pool.query(
    `SELECT id, pusher_name, pusher_email, ref, branch, commit_count,
            head_commit_message, head_commit_sha, provider, created_at
     FROM repo_push_events
     WHERE product_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [productId]
  );

  res.json(result.rows.map((row: any) => ({
    id: row.id,
    pusherName: row.pusher_name,
    pusherEmail: row.pusher_email,
    ref: row.ref,
    branch: row.branch,
    commitCount: row.commit_count,
    headCommitMessage: row.head_commit_message,
    headCommitSha: row.head_commit_sha,
    provider: row.provider,
    createdAt: row.created_at,
  })));
});

// ─── GET /api/github/repo/:productId ────────────────────────────
router.get('/repo/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
  const session = getDriver().session();

  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:HAS_REPO]->(r:Repository)
       OPTIONAL MATCH (r)-[hc:HAS_CONTRIBUTOR]->(c:Contributor)
       RETURN r, collect({
         login: c.githubLogin,
         githubId: c.githubId,
         avatarUrl: c.avatarUrl,
         profileUrl: c.profileUrl,
         contributions: hc.contributions
       }) AS contributors`,
      { orgId, productId }
    );

    if (result.records.length === 0) {
      res.json({ synced: false });
      return;
    }

    const r = result.records[0].get('r').properties;
    const contributors = result.records[0].get('contributors')
      .filter((c: any) => c.login !== null)
      .sort((a: any, b: any) => (b.contributions || 0) - (a.contributions || 0));

    let languages: { language: string; bytes: number; percentage: number }[] = [];
    try {
      const langObj = JSON.parse(r.languages || '{}');
      const totalBytes = Object.values(langObj).reduce((sum: number, b: any) => sum + (b as number), 0);
      languages = Object.entries(langObj)
        .map(([lang, bytes]) => ({
          language: lang,
          bytes: bytes as number,
          percentage: totalBytes > 0 ? Math.round(((bytes as number) / totalBytes) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.bytes - a.bytes);
    } catch { /* silent */ }

    res.json({
      synced: true,
      provider: r.provider || 'github',
      repo: {
        name: r.name,
        fullName: r.fullName,
        description: r.description || '',
        url: r.url,
        language: r.language || '',
        stars: typeof r.stars === 'object' ? r.stars.toNumber?.() ?? r.stars : r.stars,
        forks: typeof r.forks === 'object' ? r.forks.toNumber?.() ?? r.forks : r.forks,
        openIssues: typeof r.openIssues === 'object' ? r.openIssues.toNumber?.() ?? r.openIssues : r.openIssues,
        visibility: r.visibility,
        defaultBranch: r.defaultBranch,
        lastPush: r.lastPush,
        isPrivate: r.isPrivate,
        syncedAt: r.syncedAt?.toString() || '',
      },
      contributors: contributors.map((c: any) => ({
        ...c,
        contributions: typeof c.contributions === 'object' ? c.contributions.toNumber?.() ?? c.contributions : c.contributions,
      })),
      languages,
    });
  } finally {
    await session.close();
  }
});

// ─── POST /api/github/codeberg/create-repo ──────────────────────
// Create a new repo on Codeberg for EU-sovereign hosting
router.post('/codeberg/create-repo', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, description, isPrivate } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Repository name is required' });
    return;
  }

  const codebergToken = await getUserRepoToken(userId, 'codeberg');
  if (!codebergToken) {
    res.status(400).json({ error: 'Codeberg not connected. Please connect your Codeberg account first.' });
    return;
  }

  try {
    const repo = await codebergCreateRepo(codebergToken, name, description || '', !!isPrivate);
    res.json({
      url: repo.html_url,
      fullName: repo.full_name,
      name: repo.name,
      isPrivate: repo.private,
    });
  } catch (err: any) {
    console.error('Codeberg repo creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create Codeberg repository' });
  }
});

export default router;
