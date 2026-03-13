import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { decrypt } from '../utils/encryption.js';
import { createNotification } from './notifications.js';
import { runPlatformScan } from './vulnerability-scanner.js';
import { syncVulnDatabases } from './vuln-db-sync.js';
import {
  getRepo as githubGetRepo, getContributors as githubGetContributors,
  getLanguages as githubGetLanguages, getSBOM as githubGetSBOM,
  getReleases as githubGetReleases, getTags as githubGetTags,
  parseRepoUrl as githubParseRepoUrl,
} from '../services/github.js';
import type { GitHubRelease } from '../services/github.js';
import * as repoProvider from '../services/repo-provider.js';
import type { RepoProvider, NormalisedRelease } from '../services/repo-provider.js';
import { enrichDependencyHashes } from './hash-enrichment.js';
import { enrichDependencyLicenses } from './license-enrichment.js';
import { resolveLockfileVersions } from './lockfile-resolver.js';
import { generateSBOMFromLockfiles } from './lockfile-sbom-generator.js';
import { generateSBOMFromImports } from './import-scanner.js';
import { sendComplianceGapNotification } from './notifications.js';
import { sendScanFailedEmail, sendComplianceGapEmail, sendDeadlineAlertEmail, sendSupportEndAlertEmail, sendCraMilestoneAlertEmail, sendComplianceStallAlertEmail } from './alert-emails.js';
import { scanProductLicenses } from './license-scanner.js';
import { createSnapshot } from './ip-proof.js';
import { createDeadlineCard, createComplianceStallCard, resolveCardsByPrefix } from './trello.js';
import { extractPackageInfo } from './repo-helpers.js';
import { checkTrialExpiry, checkPaymentGrace } from './billing.js';
import { ensureWebhook } from './webhook.js';
import { runAllEscrowDeposits } from './escrow-service.js';
import { logger } from '../utils/logger.js';
import { DEADLINES } from '../routes/compliance-checklist.js';
import {
  getApplicableObligations, ensureObligations,
  computeDerivedStatuses, higherStatus,
} from './obligation-engine.js';


// How often to check for stale SBOMs (default: every hour)
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Hour of the day to run auto-sync (0-23, default: 2 AM)
const AUTO_SYNC_HOUR = 2;

// Hour of the day to run platform-wide vulnerability scan (0-23, default: 3 AM — after SBOM sync)
const VULN_SCAN_HOUR = 3;

// Hour of the day to run billing checks (0-23, default: 4 AM — after other tasks)
const BILLING_CHECK_HOUR = 4;
const ESCROW_DEPOSIT_HOUR = 5;

// Hour of the day to run webhook health checks (0-23, default: 6 AM — after SBOM sync refreshes lastPush)
const WEBHOOK_HEALTH_HOUR = 6;

// Hour of the day to sync vulnerability databases (0-23, default: 1 AM — before SBOM sync)
const VULN_DB_SYNC_HOUR = 1;

// Hour of the day to check for approaching end-of-support dates (0-23, default: 7 AM)
const SUPPORT_CHECK_HOUR = 7;

// Hour of the day to check CRA milestone + compliance stall alerts (0-23, default: 8 AM)
const SMART_DEADLINE_HOUR = 8;

// Hour of the day to run scheduled snapshots (0-23, default: 9 AM)
const SNAPSHOT_SCHEDULE_HOUR = 9;

// Hour of the day to check retention expiry (0-23, default: 9 AM — runs after scheduled snapshots)
const RETENTION_EXPIRY_HOUR = 9;

// Hour of the day to run monthly reserve sufficiency check (0-23, default: 10 AM — 1st of month only)
const RESERVE_SUFFICIENCY_HOUR = 10;

let lastSyncDate = '';
let lastVulnScanDate = '';
let lastVulnDbSyncDate = '';
let lastBillingCheckDate = '';
let lastEscrowDepositDate = '';
let lastWebhookHealthDate = '';
let lastSupportCheckDate = '';
let lastSmartDeadlineDate = '';
let lastSnapshotScheduleDate = '';
let lastRetentionExpiryDate = '';
let lastReserveSufficiencyMonth = '';

async function getProductRepoToken(productId: string, forProvider?: RepoProvider): Promise<{ token: string; userId: string; provider: RepoProvider; instanceUrl: string | null } | null> {
  // Find the user who owns this product (via org) and has a repo connection
  const neo4jSession = getDriver().session();
  try {
    // Also get repoUrl so we can auto-detect provider
    const result = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation)<-[:BELONGS_TO]-(u:User)
       RETURN u.id as userId, p.repoUrl as repoUrl`,
      { productId }
    );
    if (result.records.length === 0) return null;

    const repoUrl = result.records[0].get('repoUrl');

    // Auto-detect provider from repoUrl (supports cloud + self-hosted)
    // First try cloud providers
    let detectedProvider = forProvider || (repoUrl ? repoProvider.detectProvider(repoUrl) : null);

    // Try cloud providers first
    if (detectedProvider) {
      for (const record of result.records) {
        const userId = record.get('userId');
        const tokenResult = await pool.query(
          `SELECT access_token_encrypted, instance_url FROM repo_connections WHERE user_id = $1 AND provider = $2`,
          [userId, detectedProvider]
        );
        if (tokenResult.rows.length > 0) {
          return {
            token: decrypt(tokenResult.rows[0].access_token_encrypted),
            userId,
            provider: detectedProvider,
            instanceUrl: tokenResult.rows[0].instance_url || null,
          };
        }
      }
    }

    // If no cloud provider matched, try self-hosted by matching instance_url hostname
    if (!detectedProvider && repoUrl) {
      let repoHostname;
      try {
        repoHostname = new URL(repoUrl.includes('://') ? repoUrl : `https://${repoUrl}`).hostname;
      } catch { /* ignore */ }

      if (repoHostname) {
        for (const record of result.records) {
          const userId = record.get('userId');
          const allConns = await pool.query(
            `SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1 AND instance_url IS NOT NULL`,
            [userId]
          );
          for (const row of allConns.rows) {
            try {
              if (new URL(row.instance_url).hostname === repoHostname) {
                return {
                  token: decrypt(row.access_token_encrypted),
                  userId,
                  provider: row.provider as RepoProvider,
                  instanceUrl: row.instance_url,
                };
              }
            } catch { continue; }
          }
        }
      }
    }

    // Final fallback: default to github
    if (!detectedProvider) detectedProvider = 'github';
    for (const record of result.records) {
      const userId = record.get('userId');
      const tokenResult = await pool.query(
        `SELECT access_token_encrypted FROM repo_connections WHERE user_id = $1 AND provider = $2`,
        [userId, detectedProvider]
      );
      if (tokenResult.rows.length > 0) {
        return {
          token: decrypt(tokenResult.rows[0].access_token_encrypted),
          userId,
          provider: detectedProvider,
          instanceUrl: null,
        };
      }
    }
    return null;
  } finally {
    await neo4jSession.close();
  }
}
// Backward compat alias
const getProductGitHubToken = getProductRepoToken;

async function autoSyncProduct(productId: string): Promise<boolean> {
  logger.info(`[AUTO-SYNC] Syncing product ${productId}`);
  const syncStartedAt = new Date();
  const syncStartMs = Date.now();

  const auth = await getProductRepoToken(productId);
  if (!auth) {
    logger.info(`[AUTO-SYNC] No repo token found for product ${productId}`);
    return false;
  }

  const neo4jSession = getDriver().session();
  try {
    // Get repo URL from product
    const productResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation) RETURN p.repoUrl as repoUrl, p.name as name, o.id as orgId`,
      { productId }
    );
    if (productResult.records.length === 0) return false;

    const repoUrl = productResult.records[0].get('repoUrl');
    const schedulerProductName = productResult.records[0].get("name") || "Unknown";    const schedulerOrgId = productResult.records[0].get("orgId");
    if (!repoUrl) return false;

    const syncProvider = auth.provider;
    const syncInstanceUrl = auth.instanceUrl;
    const parsed = repoProvider.parseRepoUrl(syncProvider, repoUrl);
    if (!parsed) return false;

    // Fetch all data from provider
    const [repoData, contributors, languages, sbomData, releases, tags] = await Promise.all([
      repoProvider.getRepo(syncProvider, auth.token, parsed.owner, parsed.repo, syncInstanceUrl || undefined),
      repoProvider.getContributors(syncProvider, auth.token, parsed.owner, parsed.repo, syncInstanceUrl || undefined),
      repoProvider.getLanguages(syncProvider, auth.token, parsed.owner, parsed.repo, syncInstanceUrl || undefined),
      repoProvider.getSBOM(syncProvider, auth.token, parsed.owner, parsed.repo),
      repoProvider.getReleases(syncProvider, auth.token, parsed.owner, parsed.repo, syncInstanceUrl || undefined),
      repoProvider.getTags(syncProvider, auth.token, parsed.owner, parsed.repo, syncInstanceUrl || undefined),
    ]);

    // Store repo data in Neo4j
    await neo4jSession.run(
      `MERGE (r:Repository {url: $url})
       ON CREATE SET r.createdAt = datetime()
       SET r.owner = $owner, r.name = $name, r.fullName = $fullName,
           r.description = $description, r.language = $language,
           r.stars = $stars, r.forks = $forks, r.openIssues = $openIssues,
           r.visibility = $visibility, r.defaultBranch = $defaultBranch,
           r.lastPush = $lastPush, r.isPrivate = $isPrivate,
           r.languages = $languagesJson, r.provider = $provider, r.syncedAt = datetime()
       WITH r
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_REPO]->(r)`,
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
        provider: syncProvider,
        productId,
      }
    );

    // Auto-register push webhook (non-blocking — must not fail the sync)
    ensureWebhook(syncProvider, auth.token, parsed.owner, parsed.repo, repoUrl, syncInstanceUrl || undefined)
      .catch(err => console.error(`[AUTO-SYNC] Webhook registration failed (non-blocking): ${err.message}`));

    // Lockfile fallback: if provider API has no SBOM (e.g. Codeberg), generate from lockfiles
    let effectiveSbomData = sbomData;
    let schedulerSbomSource = 'api';
    if (!effectiveSbomData) {
      logger.info(`[SCHEDULER] No API SBOM for ${parsed.owner}/${parsed.repo} — trying lockfile fallback...`);
      const lockfileResult = await generateSBOMFromLockfiles(
        parsed.owner, parsed.repo, repoData.default_branch,
        syncProvider, auth.token, repoUrl, syncInstanceUrl || undefined
      );
      if (lockfileResult) {
        effectiveSbomData = lockfileResult.sbom as any;
        schedulerSbomSource = `lockfile:${lockfileResult.lockfileUsed}`;
        logger.info(`[SCHEDULER] Lockfile SBOM: ${lockfileResult.lockfileUsed} (${lockfileResult.totalDependencies} deps)`);
      }
    }

    // Tier 3: Source import scanning
    if (!effectiveSbomData) {
      logger.info(`[SCHEDULER] No lockfile — trying import scan (Tier 3) for ${parsed.owner}/${parsed.repo}...`);
      try {
        const importResult = await generateSBOMFromImports(
          parsed.owner, parsed.repo, repoData.default_branch,
          syncProvider, auth.token, repoUrl, syncInstanceUrl || undefined
        );
        if (importResult) {
          effectiveSbomData = { sbom: importResult.sbom } as any;
          schedulerSbomSource = `import-scan:${importResult.languagesDetected.join('+')}`;
          logger.info(`[SCHEDULER] Import scan: ${importResult.languagesDetected.join(', ')} — ${importResult.totalPackages} packages`);
        }
      } catch (err: any) {
        console.error(`[SCHEDULER] Import scan failed: ${err.message}`);
      }
    }

    // Store SBOM if available (this also sets is_stale = FALSE)
    if (effectiveSbomData) {
      // Inline storeSBOM logic for Postgres
      const packages = effectiveSbomData.sbom?.packages || [];
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, synced_at, sbom_source)
         VALUES ($1, $2, $3, $4, FALSE, NOW(), $5)
         ON CONFLICT (product_id) DO UPDATE SET
           spdx_json = $2, spdx_version = $3, package_count = $4, is_stale = FALSE, synced_at = NOW(), sbom_source = $5`,
        [productId, JSON.stringify(effectiveSbomData), effectiveSbomData.sbom?.spdxVersion, packages.length, schedulerSbomSource]
      );

      // Update Neo4j SBOM node
      await neo4jSession.run(
        `MATCH (p:Product {id: $productId})
         MERGE (p)-[:HAS_SBOM]->(sbom:SBOM {productId: $productId})
         SET sbom.spdxVersion = $spdxVersion, sbom.packageCount = $packageCount,
             sbom.isStale = false, sbom.syncedAt = datetime()`,
        { productId, spdxVersion: effectiveSbomData.sbom?.spdxVersion, packageCount: packages.length }
      );

      // Post-SBOM compliance pipeline (non-blocking)
      const extractedPackages = packages
        .filter((p: any) => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.'))
        .map((p: any) => extractPackageInfo(p));
      const schedToken = auth.token;
      const schedProductId = productId;
      const schedOrgId = schedulerOrgId;
      const schedProductName = schedulerProductName;
      (async () => {
        try {
          if (schedToken) {
            await resolveLockfileVersions(schedProductId, schedToken);
          }
          const enrichResult = await enrichDependencyHashes(schedProductId, extractedPackages);
          const totalDeps = enrichResult.enriched + enrichResult.gaps.noVersion + enrichResult.gaps.unsupportedEcosystem + enrichResult.gaps.notFound + enrichResult.gaps.fetchError;
          if (schedOrgId) {
            await sendComplianceGapNotification(schedProductId, schedOrgId, schedProductName, enrichResult.gaps, totalDeps);

            // Email alert for compliance gaps (>10% threshold)
            const gapCount = enrichResult.gaps.noVersion + enrichResult.gaps.unsupportedEcosystem + enrichResult.gaps.notFound + enrichResult.gaps.fetchError;
            const gapPct = totalDeps > 0 ? Math.round((gapCount / totalDeps) * 100) : 0;
            if (gapPct > 10) {
              sendComplianceGapEmail(schedOrgId, schedProductName, gapPct, totalDeps, schedProductId).catch(() => {});
            }
          }
          // Auto license enrichment + scan + IP proof timestamp after SBOM enrichment
          if (schedOrgId) {
            try {
              await enrichDependencyLicenses(schedProductId, extractedPackages);
              logger.debug("[AUTO-SYNC] License enrichment completed for", schedProductId);
            } catch (leErr: any) {
              console.error("[AUTO-SYNC] License enrichment failed:", leErr.message);
            }
            try {
              await scanProductLicenses(schedProductId, schedOrgId);
              logger.debug("[AUTO-SYNC] License scan completed for", schedProductId);
            } catch (lsErr: any) {
              console.error("[AUTO-SYNC] License scan failed:", lsErr.message);
            }
            try {
              await createSnapshot(schedProductId, schedOrgId, null, 'sync');
              logger.debug("[AUTO-SYNC] IP proof snapshot created for", schedProductId);
            } catch (ipErr: any) {
              console.error("[AUTO-SYNC] IP proof snapshot failed:", ipErr.message);
            }
          }
        } catch (err: any) {
          console.error("[AUTO-SYNC] Post-SBOM pipeline failed:", err.message);
        }
      })();
    }

    // Store GitHub releases
    const publishedReleases = releases.filter((r: NormalisedRelease) => !r.draft);
    for (const rel of publishedReleases) {
      await pool.query(
        `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_release_body, github_commit_sha, is_prerelease, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'github_release', $8)
         ON CONFLICT DO NOTHING`,
        [productId, rel.tag_name, rel.tag_name, rel.name || rel.tag_name, rel.body || '',
         rel.target_commitish, rel.prerelease, rel.published_at]
      );
    }

    // Generate CRANIS2 auto-version
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const counterResult = await pool.query(
      `SELECT cranis_version FROM product_versions
       WHERE product_id = $1 AND source = 'sync' AND cranis_version LIKE $2
       ORDER BY cranis_version DESC LIMIT 1`,
      [productId, today + '.%']
    );
    let counter = 1;
    if (counterResult.rows.length > 0) {
      const lastCounter = parseInt(counterResult.rows[0].cranis_version.split('.').pop() || '0', 10);
      counter = lastCounter + 1;
    }
    const cranisVersion = `${today}.${String(counter).padStart(4, '0')}`;

    const latestTagSha = tags.length > 0 ? tags[0].commit.sha : null;
    const latestRelease = publishedReleases.length > 0 ? publishedReleases[0] : null;

    await pool.query(
      `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_commit_sha, source)
       VALUES ($1, $2, $3, $4, $5, 'sync')`,
      [productId, cranisVersion, latestRelease?.tag_name || null, latestRelease?.name || null, latestTagSha]
    );

    // Update product version
    await neo4jSession.run(
      `MATCH (p:Product {id: $productId}) SET p.version = $version`,
      { productId, version: cranisVersion }
    );

    // Record sync duration
    const syncDurationSeconds = (Date.now() - syncStartMs) / 1000;
    logger.info(`[AUTO-SYNC] Completed: ${productId} → ${cranisVersion} (${syncDurationSeconds.toFixed(2)}s)`);
    await pool.query(
      `INSERT INTO sync_history (product_id, sync_type, started_at, duration_seconds, package_count, contributor_count, release_count, cranis_version, triggered_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [productId, 'auto', syncStartedAt, syncDurationSeconds, effectiveSbomData?.sbom?.packages?.length || 0, 0, publishedReleases.length, cranisVersion, 'scheduler', 'success']
    );
    return true;
  } catch (err: any) {
    const syncDurationSeconds = (Date.now() - syncStartMs) / 1000;
    console.error(`[AUTO-SYNC] Error syncing product ${productId} (${syncDurationSeconds.toFixed(2)}s):`, err.message);
    await pool.query(
      `INSERT INTO sync_history (product_id, sync_type, started_at, duration_seconds, triggered_by, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [productId, 'auto', syncStartedAt, syncDurationSeconds, 'scheduler', 'error', err.message]
    ).catch(() => {});

    // Create sync_failed notification
    const failSession = getDriver().session();
    try {
      const failResult = await failSession.run(
        `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation)
         RETURN o.id AS orgId, p.name AS productName`,
        { productId }
      );
      if (failResult.records.length > 0) {
        const orgId = failResult.records[0].get('orgId');
        const productName = failResult.records[0].get('productName') || 'Unknown product';
        createNotification({
          orgId,
          type: 'sync_failed',
          severity: 'high',
          title: `Auto-sync failed for ${productName}`,
          body: err.message || 'An error occurred during automatic synchronisation',
          link: `/products/${productId}`,
          metadata: { productId, errorMessage: err.message },
        }).catch(() => {});

        // Email alert for scan failure
        sendScanFailedEmail(orgId, productName, err.message || 'Unknown error', productId).catch(() => {});
      }
    } catch (_notifErr) {
      // Notification failure should never mask the real error
    } finally {
      await failSession.close();
    }

    return false;
  } finally {
    await neo4jSession.close();
  }
}

async function runDailySync(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastSyncDate === todayStr) return; // Already ran today

  const now = new Date();
  if (now.getHours() < AUTO_SYNC_HOUR) return; // Not yet time

  logger.info('[AUTO-SYNC] Starting daily sync check...');
  lastSyncDate = todayStr;

  try {
    const result = await pool.query(
      `SELECT product_id FROM product_sboms WHERE is_stale = TRUE`
    );

    if (result.rows.length === 0) {
      logger.info('[AUTO-SYNC] No stale SBOMs found');
      return;
    }

    logger.info(`[AUTO-SYNC] Found ${result.rows.length} stale product(s)`);

    for (const row of result.rows) {
      await autoSyncProduct(row.product_id);
    }

    logger.info('[AUTO-SYNC] Daily sync complete');
  } catch (err: any) {
    console.error('[AUTO-SYNC] Error during daily sync:', err.message);
  }
}


async function runDailyVulnScan(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastVulnScanDate === todayStr) return; // Already ran today

  const now = new Date();
  if (now.getHours() < VULN_SCAN_HOUR) return; // Not yet time

  lastVulnScanDate = todayStr;
  logger.info('[VULN-SCHEDULER] Starting daily platform vulnerability scan...');

  try {
    const result = await runPlatformScan('scheduler', 'scheduled');
    logger.info('[VULN-SCHEDULER] Daily scan complete: run ' + result.runId + ', ' + result.totalFindings + ' findings');
  } catch (err: any) {
    console.error('[VULN-SCHEDULER] Daily vulnerability scan failed:', err.message);
  }
}


async function runDailyVulnDbSync(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastVulnDbSyncDate === todayStr) return; // Already ran today

  const now = new Date();
  if (now.getHours() < VULN_DB_SYNC_HOUR) return; // Not yet time

  lastVulnDbSyncDate = todayStr;
  logger.info('[VULN-DB-SCHEDULER] Starting daily vulnerability database sync...');

  try {
    await syncVulnDatabases();
    logger.info('[VULN-DB-SCHEDULER] Daily DB sync complete');
  } catch (err: any) {
    console.error('[VULN-DB-SCHEDULER] Daily DB sync failed:', err.message);
  }
}




async function runDailyBillingChecks(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastBillingCheckDate === todayStr) return; // Already ran today

  const now = new Date();
  if (now.getHours() < BILLING_CHECK_HOUR) return; // Not yet time

  lastBillingCheckDate = todayStr;
  logger.info('[BILLING-SCHEDULER] Starting daily billing checks...');

  try {
    await checkTrialExpiry();
    await checkPaymentGrace();
    logger.info('[BILLING-SCHEDULER] Daily billing checks complete');
  } catch (err: any) {
    console.error('[BILLING-SCHEDULER] Daily billing checks failed:', err.message);
  }
}

async function checkCraDeadlines(): Promise<void> {
  try {
    // Find reports with approaching or overdue deadlines
    const result = await pool.query(
      `SELECT r.id, r.org_id, r.product_id, r.report_type, r.status,
              r.early_warning_deadline, r.notification_deadline, r.final_report_deadline,
              r.created_by
       FROM cra_reports r
       WHERE r.status NOT IN ('closed', 'final_report_sent')`
    );

    if (result.rows.length === 0) return;

    const now = new Date();

    // Get product names from Neo4j
    const driver = getDriver();
    const session = driver.session();
    const productNames: Record<string, string> = {};
    try {
      const productIds = [...new Set(result.rows.map((r: any) => r.product_id))];
      const neo = await session.run(
        'UNWIND $ids AS pid MATCH (p:Product {id: pid}) RETURN p.id AS id, p.name AS name',
        { ids: productIds }
      );
      for (const rec of neo.records) {
        productNames[rec.get('id')] = rec.get('name');
      }
    } finally {
      await session.close();
    }

    for (const row of result.rows) {
      let deadline: Date | null = null;
      let stageName = '';

      if (row.status === 'draft' && row.early_warning_deadline) {
        deadline = new Date(row.early_warning_deadline);
        stageName = 'Early Warning';
      } else if (row.status === 'early_warning_sent' && row.notification_deadline) {
        deadline = new Date(row.notification_deadline);
        stageName = 'Full Notification';
      } else if (row.status === 'notification_sent' && row.final_report_deadline) {
        deadline = new Date(row.final_report_deadline);
        stageName = 'Final Report';
      }

      if (!deadline) continue;

      const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      const productName = productNames[row.product_id] || 'Unknown Product';

      // Notification thresholds: 12h, 4h, 1h before, and overdue
      let shouldNotify = false;
      let severity: 'info' | 'medium' | 'high' | 'critical' = 'info';

      if (hoursRemaining < 0) {
        shouldNotify = true;
        severity = 'critical';
      } else if (hoursRemaining <= 1) {
        shouldNotify = true;
        severity = 'high';
      } else if (hoursRemaining <= 4) {
        shouldNotify = true;
        severity = 'medium';
      } else if (hoursRemaining <= 12) {
        shouldNotify = true;
        severity = 'info';
      }

      if (!shouldNotify) continue;

      // Debounce: check if we already sent a notification at this severity level recently
      const recentNotif = await pool.query(
        `SELECT id FROM notifications
         WHERE type = 'cra_deadline' AND metadata->>'reportId' = $1 AND severity = $2
           AND created_at > NOW() - INTERVAL '4 hours'
         LIMIT 1`,
        [row.id, severity]
      );

      if (recentNotif.rows.length > 0) continue;

      const isOverdue = hoursRemaining < 0;
      const timeStr = isOverdue
        ? `${Math.ceil(Math.abs(hoursRemaining))}h overdue`
        : hoursRemaining < 1 ? `${Math.ceil(hoursRemaining * 60)}m remaining` : `${Math.ceil(hoursRemaining)}h remaining`;

      const title = isOverdue
        ? `OVERDUE: ${stageName} for ${productName}`
        : `${stageName} deadline approaching for ${productName}`;
      const body = `CRA Article 14 ${stageName} ${isOverdue ? 'was due' : 'is due'} — ${timeStr}. ${isOverdue ? 'Submit immediately to remain compliant.' : 'Prepare and submit before the deadline.'}`;

      // Send to report creator
      if (row.created_by) {
        await createNotification({
          orgId: row.org_id,
          userId: row.created_by,
          type: 'cra_deadline',
          severity,
          title,
          body,
          link: '/vulnerability-reports/' + row.id,
          metadata: { reportId: row.id, stageName, hoursRemaining: Math.round(hoursRemaining), productId: row.product_id },
        });
      }

      // Broadcast for org
      await createNotification({
        orgId: row.org_id,
        type: 'cra_deadline',
        severity,
        title,
        body,
        link: '/vulnerability-reports/' + row.id,
        metadata: { reportId: row.id, stageName, hoursRemaining: Math.round(hoursRemaining), productId: row.product_id },
      });

      // Email alert at 12h and 1h thresholds (and overdue)
      if (hoursRemaining <= 1 || (hoursRemaining > 4 && hoursRemaining <= 12) || hoursRemaining < 0) {
        sendDeadlineAlertEmail(row.org_id, stageName, Math.max(0, Math.round(hoursRemaining)), row.id).catch(() => {});
      }

      logger.info('[CRA-DEADLINE] ' + (isOverdue ? 'OVERDUE' : 'Approaching') + ': ' + stageName + ' for ' + productName + ' (' + timeStr + ')');
    }
  } catch (err: any) {
    console.error('[CRA-DEADLINE] Error checking deadlines:', err.message);
  }
}

async function runDailyEscrowDeposits(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastEscrowDepositDate === todayStr) return;

  const now = new Date();
  if (now.getHours() < ESCROW_DEPOSIT_HOUR) return;

  lastEscrowDepositDate = todayStr;
  logger.info('[ESCROW-SCHEDULER] Starting daily escrow deposits...');

  try {
    await runAllEscrowDeposits();
    logger.info('[ESCROW-SCHEDULER] Daily escrow deposits complete');
  } catch (err: any) {
    console.error('[ESCROW-SCHEDULER] Daily escrow deposits failed:', err.message);
  }
}

async function runDailyWebhookHealthCheck(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastWebhookHealthDate === todayStr) return;

  const now = new Date();
  if (now.getHours() < WEBHOOK_HEALTH_HOUR) return;

  lastWebhookHealthDate = todayStr;
  logger.info('[WEBHOOK-HEALTH] Starting daily webhook health check...');

  const driver = getDriver();
  const session = driver.session();

  try {
    // 1. Get all products with connected repos from Neo4j
    const neo4jResult = await session.run(
      `MATCH (p:Product)-[:BELONGS_TO]->(o:Organisation), (p)-[:HAS_REPO]->(r:Repository)
       RETURN p.id AS productId, p.name AS productName, o.id AS orgId,
              r.url AS repoUrl, r.webhookId AS webhookId,
              r.lastPush AS lastPush, r.provider AS provider`
    );

    if (neo4jResult.records.length === 0) {
      logger.info('[WEBHOOK-HEALTH] No products with repos found');
      return;
    }

    // 2. Get most recent push event per product from Postgres
    const productIds = neo4jResult.records.map(r => r.get('productId'));
    const pushEventsResult = await pool.query(
      `SELECT product_id, MAX(created_at) AS last_event
       FROM repo_push_events
       WHERE product_id = ANY($1)
       GROUP BY product_id`,
      [productIds]
    );
    const lastEventMap = new Map<string, Date>();
    for (const row of pushEventsResult.rows) {
      lastEventMap.set(row.product_id, new Date(row.last_event));
    }

    // 3. Detect issues
    const issues: Array<{ productId: string; productName: string; orgId: string; repoUrl: string; issueType: string }> = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const record of neo4jResult.records) {
      const productId = record.get('productId');
      const productName = record.get('productName') || 'Unknown';
      const orgId = record.get('orgId');
      const repoUrl = record.get('repoUrl');
      const webhookId = record.get('webhookId');
      const lastPushRaw = record.get('lastPush');

      if (!webhookId) {
        issues.push({ productId, productName, orgId, repoUrl, issueType: 'no_webhook' });
        continue;
      }

      // Check for silent webhook: provider reports recent push but no event received
      if (lastPushRaw) {
        const lastPush = new Date(typeof lastPushRaw === 'string' ? lastPushRaw : lastPushRaw.toString());
        if (lastPush > sevenDaysAgo) {
          const lastEvent = lastEventMap.get(productId);
          if (!lastEvent || lastEvent < lastPush) {
            issues.push({ productId, productName, orgId, repoUrl, issueType: 'webhook_silent' });
          }
        }
      }
    }

    if (issues.length === 0) {
      logger.info(`[WEBHOOK-HEALTH] All ${neo4jResult.records.length} product(s) healthy`);
      return;
    }

    logger.info(`[WEBHOOK-HEALTH] Found ${issues.length} issue(s):`);

    // 4. Create notifications for platform admins (debounced)
    const admins = await pool.query('SELECT id, org_id FROM users WHERE is_platform_admin = true');

    for (const issue of issues) {
      const issueLabel = issue.issueType === 'no_webhook' ? 'Webhook not registered' : 'Webhook silent — pushes not received';
      logger.debug(`[WEBHOOK-HEALTH]   ${issue.productName}: ${issueLabel} (${issue.repoUrl})`);

      // Debounce: skip if unread notification already exists for this product
      const existing = await pool.query(
        `SELECT id FROM notifications
         WHERE type = 'webhook_health_warning' AND is_read = false
           AND metadata->>'productId' = $1
         LIMIT 1`,
        [issue.productId]
      );
      if (existing.rows.length > 0) continue;

      // Create notification for each platform admin
      for (const admin of admins.rows) {
        await createNotification({
          orgId: admin.org_id,
          userId: admin.id,
          type: 'webhook_health_warning',
          severity: 'medium',
          title: `Webhook issue: ${issue.productName}`,
          body: `Repository ${issue.repoUrl} — ${issueLabel}`,
          link: '/admin/system',
          metadata: { productId: issue.productId, repoUrl: issue.repoUrl, issueType: issue.issueType },
        });
      }
    }

    logger.info('[WEBHOOK-HEALTH] Daily check complete');
  } catch (err: any) {
    console.error('[WEBHOOK-HEALTH] Error during health check:', err.message);
  } finally {
    await session.close();
  }
}

async function checkSupportPeriodExpiry(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastSupportCheckDate === todayStr) return;

  const now = new Date();
  if (now.getUTCHours() < SUPPORT_CHECK_HOUR) return;

  lastSupportCheckDate = todayStr;
  logger.info('[SUPPORT-CHECK] Starting daily support period expiry check...');

  try {
    // Get all products with a non-empty support period end_date
    const result = await pool.query(
      `SELECT product_id,
              content->'fields'->>'end_date' AS end_date
       FROM technical_file_sections
       WHERE section_key = 'support_period'
         AND content->'fields'->>'end_date' IS NOT NULL
         AND content->'fields'->>'end_date' != ''`
    );

    if (result.rows.length === 0) {
      logger.info('[SUPPORT-CHECK] No products with support end dates');
      return;
    }

    // Get product names + org IDs from Neo4j
    const driver = getDriver();
    const session = driver.session();
    const productIds = result.rows.map((r: any) => r.product_id);
    const productInfo: Record<string, { name: string; orgId: string }> = {};

    try {
      const neo = await session.run(
        `UNWIND $ids AS pid
         MATCH (p:Product {id: pid})-[:BELONGS_TO]->(o:Organisation)
         RETURN p.id AS id, p.name AS name, o.id AS orgId`,
        { ids: productIds }
      );
      for (const rec of neo.records) {
        productInfo[rec.get('id')] = { name: rec.get('name') || 'Unknown', orgId: rec.get('orgId') };
      }
    } finally {
      await session.close();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholds = [90, 60, 30, 7, 0];
    let alertsSent = 0;

    for (const row of result.rows) {
      const endDate = new Date(row.end_date);
      if (isNaN(endDate.getTime())) continue;
      endDate.setHours(0, 0, 0, 0);

      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const info = productInfo[row.product_id];
      if (!info) continue;

      // Check each threshold — trigger if days remaining is at or below the threshold
      for (const threshold of thresholds) {
        if (daysRemaining <= threshold) {
          // Create bell notification (debounced by checking for existing unread)
          const existingNotif = await pool.query(
            `SELECT id FROM notifications
             WHERE type = 'support_period_expiry' AND is_read = false
               AND metadata->>'productId' = $1
               AND metadata->>'threshold' = $2
             LIMIT 1`,
            [row.product_id, String(threshold)]
          );

          if (existingNotif.rows.length === 0) {
            const isExpired = daysRemaining <= 0;
            const timeLabel = isExpired
              ? `ended ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} ago`
              : daysRemaining === 0 ? 'ends today'
              : `ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
            const severity = isExpired ? 'critical' : daysRemaining <= 7 ? 'high' : 'medium';

            await createNotification({
              orgId: info.orgId,
              type: 'support_period_expiry',
              severity,
              title: `Support period ${isExpired ? 'ended' : 'ending soon'}: ${info.name}`,
              body: `The support period for ${info.name} ${timeLabel}. CRA Article 13(8) requires security patches for the full support period.`,
              link: `/products/${row.product_id}?tab=technical-file`,
              metadata: { productId: row.product_id, threshold: String(threshold), daysRemaining },
            });

            // Send email alert
            sendSupportEndAlertEmail(info.orgId, info.name, daysRemaining, row.product_id).catch(() => {});
            alertsSent++;
          }

          // Only trigger the tightest matching threshold per product
          break;
        }
      }
    }

    logger.info(`[SUPPORT-CHECK] Check complete — ${result.rows.length} product(s) checked, ${alertsSent} alert(s) sent`);
  } catch (err: any) {
    console.error('[SUPPORT-CHECK] Error checking support period expiry:', err.message);
  }
}

async function checkSmartDeadlineAlerts(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastSmartDeadlineDate === todayStr) return;

  const now = new Date();
  if (now.getUTCHours() < SMART_DEADLINE_HOUR) return;

  lastSmartDeadlineDate = todayStr;
  logger.info('[SMART-DEADLINE] Starting daily CRA milestone + compliance stall check...');

  try {
    // ── Part A: CRA Milestone Alerts ──────────────────────────────

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const milestoneThresholds = [90, 60, 30];

    // Get all orgs
    const orgResult = await pool.query('SELECT DISTINCT org_id FROM users WHERE org_id IS NOT NULL');
    const orgIds = orgResult.rows.map((r: any) => r.org_id);

    let milestoneAlertsSent = 0;

    for (const deadline of DEADLINES) {
      const target = new Date(deadline.date);
      target.setHours(0, 0, 0, 0);
      const daysRemaining = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Only alert for future milestones
      if (daysRemaining < 0) continue;

      for (const threshold of milestoneThresholds) {
        if (daysRemaining <= threshold) {
          // Alert each org
          for (const orgId of orgIds) {
            // Dedup: check for existing unread notification at this threshold
            const existing = await pool.query(
              `SELECT id FROM notifications
               WHERE type = 'cra_milestone' AND is_read = false
                 AND metadata->>'milestoneId' = $1
                 AND metadata->>'threshold' = $2
                 AND org_id = $3
               LIMIT 1`,
              [deadline.id, String(threshold), orgId]
            );
            if (existing.rows.length > 0) continue;

            const severity = threshold <= 30 ? 'high' : threshold <= 60 ? 'medium' : 'info';

            await createNotification({
              orgId,
              type: 'cra_milestone',
              severity,
              title: `CRA deadline in ${daysRemaining} days: ${deadline.label}`,
              body: `The ${deadline.label} deadline (${deadline.date}) is ${daysRemaining} days away. Review your compliance readiness.`,
              link: '/products',
              metadata: { milestoneId: deadline.id, threshold: String(threshold), daysRemaining },
            });

            sendCraMilestoneAlertEmail(orgId, deadline.label, daysRemaining, deadline.id).catch(() => {});
            createDeadlineCard(orgId, deadline.label, daysRemaining, deadline.id).catch(() => {});
            milestoneAlertsSent++;
          }

          // Only trigger tightest matching threshold per milestone
          break;
        }
      }
    }

    // ── Part B: Compliance Stall Detection ────────────────────────

    const driver = getDriver();
    const session = driver.session();
    let stallAlertsSent = 0;

    try {
      // Get all products with their org IDs and categories
      const productResult = await session.run(
        `MATCH (p:Product)-[:BELONGS_TO]->(o:Organisation)
         RETURN p.id AS id, p.name AS name, o.id AS orgId, p.craCategory AS category`
      );

      if (productResult.records.length > 0) {
        const products = productResult.records.map(r => ({
          id: r.get('id'),
          name: r.get('name') || 'Unknown',
          orgId: r.get('orgId'),
          category: r.get('category') || null,
        }));
        const productIds = products.map(p => p.id);

        // Get last obligation update per product
        const lastUpdateResult = await pool.query(
          `SELECT product_id, MAX(updated_at) AS last_update
           FROM obligations
           WHERE product_id = ANY($1)
           GROUP BY product_id`,
          [productIds]
        );
        const lastUpdateMap: Record<string, Date> = {};
        for (const row of lastUpdateResult.rows) {
          lastUpdateMap[row.product_id] = new Date(row.last_update);
        }

        // Compute readiness per product (reuse obligation engine)
        const categoryMap: Record<string, string | null> = {};
        const orgMap: Record<string, string> = {};
        for (const p of products) {
          categoryMap[p.id] = p.category;
          orgMap[p.id] = p.orgId;
        }

        // Group products by org for ensureObligations
        for (const p of products) {
          await ensureObligations(p.orgId, p.id, p.category);
        }

        const obResult = await pool.query(
          `SELECT product_id, obligation_key, status
           FROM obligations WHERE product_id = ANY($1)`,
          [productIds]
        );

        const derivedMap = await computeDerivedStatuses(productIds, Object.values(orgMap)[0] || '', categoryMap);

        // Compute per-product readiness
        const obByProduct: Record<string, { key: string; effectiveStatus: string }[]> = {};
        for (const row of obResult.rows) {
          if (!obByProduct[row.product_id]) obByProduct[row.product_id] = [];
          const derivedStatus = derivedMap[row.product_id]?.[row.obligation_key]?.status ?? null;
          const effectiveStatus = higherStatus(row.status, derivedStatus);
          obByProduct[row.product_id].push({ key: row.obligation_key, effectiveStatus });
        }

        for (const p of products) {
          const obligations = obByProduct[p.id] || [];
          const applicable = getApplicableObligations(p.category);
          const total = applicable.length;
          const met = obligations.filter(o => o.effectiveStatus === 'met').length;
          const readiness = total > 0 ? Math.round((met / total) * 100) : 0;

          // Skip products at 100% readiness or with no obligations
          if (readiness >= 100 || total === 0) {
            // Resolve any existing stall cards — product is now compliant
            if (readiness >= 100) {
              resolveCardsByPrefix(p.orgId, `stall:${p.id}:`, `Product reached 100% CRA readiness.`).catch(() => {});
            }
            continue;
          }

          // Check for stall (>7 days since last update)
          const lastUpdate = lastUpdateMap[p.id];
          if (!lastUpdate) continue; // No obligations updated yet — don't nag

          const daysSinceUpdate = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceUpdate <= 7) {
            // Stall cleared — obligations were updated recently, resolve any stall cards
            resolveCardsByPrefix(p.orgId, `stall:${p.id}:`, `Compliance progress resumed — obligations updated ${daysSinceUpdate} day(s) ago.`).catch(() => {});
            continue;
          }

          // Dedup: check for existing unread notification
          const existing = await pool.query(
            `SELECT id FROM notifications
             WHERE type = 'compliance_stall' AND is_read = false
               AND metadata->>'productId' = $1
             LIMIT 1`,
            [p.id]
          );
          if (existing.rows.length > 0) continue;

          await createNotification({
            orgId: p.orgId,
            type: 'compliance_stall',
            severity: 'medium',
            title: `Compliance progress stalled: ${p.name}`,
            body: `No obligation updates for ${daysSinceUpdate} days. Current CRA readiness: ${readiness}%. Review and update your obligations.`,
            link: `/products/${p.id}?tab=obligations`,
            metadata: { productId: p.id, daysSinceUpdate, readiness },
          });

          sendComplianceStallAlertEmail(p.orgId, p.name, daysSinceUpdate, readiness, p.id).catch(() => {});
          createComplianceStallCard(p.orgId, p.id, p.name, daysSinceUpdate, readiness).catch(() => {});
          stallAlertsSent++;
        }
      }
    } finally {
      await session.close();
    }

    logger.info(`[SMART-DEADLINE] Check complete — ${milestoneAlertsSent} milestone alert(s), ${stallAlertsSent} stall alert(s) sent`);
  } catch (err: any) {
    console.error('[SMART-DEADLINE] Error during smart deadline check:', err.message);
  }
}

// ── F1: Run scheduled compliance snapshots ───────────────────────
async function runScheduledSnapshots(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastSnapshotScheduleDate === todayStr) return;

  const now = new Date();
  if (now.getUTCHours() < SNAPSHOT_SCHEDULE_HOUR) return;

  lastSnapshotScheduleDate = todayStr;
  logger.info('[SNAPSHOT-SCHEDULE] Checking for due scheduled snapshots...');

  try {
    const { generateComplianceSnapshot } = await import('../services/compliance-snapshot.js');
    const { uploadToGlacier } = await import('../services/cold-storage.js');
    const { createLedgerEntry } = await import('../services/retention-ledger.js');
    const { calculateNextRunDate } = await import('../routes/compliance-snapshots.js');

    // Find all enabled schedules where next_run_date <= today
    const due = await pool.query(
      `SELECT ss.*, u.email AS creator_email
       FROM snapshot_schedules ss
       LEFT JOIN users u ON u.id = ss.created_by
       WHERE ss.enabled = TRUE AND ss.next_run_date <= $1`,
      [todayStr]
    );

    if (due.rows.length === 0) {
      logger.info('[SNAPSHOT-SCHEDULE] No scheduled snapshots due today');
      return;
    }

    logger.info(`[SNAPSHOT-SCHEDULE] ${due.rows.length} scheduled snapshot(s) due`);

    for (const schedule of due.rows) {
      try {
        // Verify product still exists
        const driver = getDriver();
        const session = driver.session();
        let productExists = false;
        try {
          const check = await session.run(
            'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id',
            { orgId: schedule.org_id, productId: schedule.product_id }
          );
          productExists = check.records.length > 0;
        } finally {
          await session.close();
        }

        if (!productExists) {
          logger.info(`[SNAPSHOT-SCHEDULE] Product ${schedule.product_id} no longer exists — disabling schedule`);
          await pool.query('UPDATE snapshot_schedules SET enabled = FALSE, updated_at = NOW() WHERE id = $1', [schedule.id]);
          continue;
        }

        // Create snapshot record
        const insertResult = await pool.query(
          `INSERT INTO compliance_snapshots (org_id, product_id, created_by, filename, status, trigger_type)
           VALUES ($1, $2, $3, 'pending', 'generating', 'scheduled')
           RETURNING id`,
          [schedule.org_id, schedule.product_id, schedule.created_by]
        );
        const snapshotId = insertResult.rows[0].id;

        // Generate snapshot
        const result = await generateComplianceSnapshot(
          schedule.org_id, schedule.product_id, schedule.created_by || null, snapshotId
        );

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

        // Update schedule: advance next_run_date, record last run
        const nextDate = calculateNextRunDate(schedule.schedule_type);
        await pool.query(
          `UPDATE snapshot_schedules
           SET last_run_at = NOW(), last_snapshot_id = $1, next_run_date = $2, updated_at = NOW()
           WHERE id = $3`,
          [snapshotId, nextDate, schedule.id]
        );

        // Activity log
        const { logProductActivity } = await import('../services/activity-log.js');
        logProductActivity({
          productId: schedule.product_id,
          orgId: schedule.org_id,
          userId: schedule.created_by,
          userEmail: schedule.creator_email || 'system',
          action: 'compliance_snapshot_generated',
          entityType: 'compliance_snapshot',
          entityId: snapshotId,
          summary: `Scheduled ${schedule.schedule_type} compliance snapshot generated (${(result.sizeBytes / 1024).toFixed(0)} KB)`,
          metadata: { filename: result.filename, sizeBytes: result.sizeBytes, triggerType: 'scheduled', scheduleType: schedule.schedule_type },
        }).catch(() => {});

        // Upload to cold storage (non-blocking)
        uploadToGlacier(schedule.org_id, schedule.product_id, result.filename, result.filepath, snapshotId)
          .catch(err => console.error('[SNAPSHOT-SCHEDULE] Glacier upload failed:', err));

        // Create retention ledger entry (non-blocking)
        createLedgerEntry({
          orgId: schedule.org_id, productId: schedule.product_id, snapshotId,
          archiveHash: result.contentHash, archiveSizeBytes: result.sizeBytes,
          releaseVersion: null,
          coldStorageKey: `${schedule.org_id}/${schedule.product_id}/${result.filename}`,
        }).catch(err => console.error('[SNAPSHOT-SCHEDULE] Ledger entry failed:', err));

        logger.info(`[SNAPSHOT-SCHEDULE] Generated snapshot for product ${schedule.product_id} (${schedule.schedule_type})`);
      } catch (err: any) {
        console.error(`[SNAPSHOT-SCHEDULE] Failed for product ${schedule.product_id}:`, err.message);
        // Mark snapshot as failed if record was created
        // Don't disable the schedule — will retry next cycle
      }
    }
  } catch (err: any) {
    console.error('[SNAPSHOT-SCHEDULE] Error:', err.message);
  }
}

// ── Snapshot local file cleanup (24-hour expiry) ─────────────────────────
// ── E3: Check for snapshots past retention end date ──────────────
async function checkRetentionExpiry(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastRetentionExpiryDate === todayStr) return;

  const now = new Date();
  if (now.getUTCHours() < RETENTION_EXPIRY_HOUR) return;

  lastRetentionExpiryDate = todayStr;
  logger.info('[RETENTION-EXPIRY] Starting daily retention expiry check...');

  try {
    // Find snapshots where retention period has ended and status is still 'complete'
    const result = await pool.query(
      `SELECT cs.id, cs.product_id, cs.org_id, cs.filename, cs.retention_end_date
       FROM compliance_snapshots cs
       WHERE cs.retention_end_date IS NOT NULL
         AND cs.retention_end_date < CURRENT_DATE
         AND cs.status = 'complete'
         AND cs.legal_hold = FALSE`
    );

    if (result.rows.length === 0) {
      logger.info('[RETENTION-EXPIRY] No snapshots past retention end date');
      return;
    }

    // Mark as retention_complete (do NOT auto-delete)
    const ids = result.rows.map((r: any) => r.id);
    await pool.query(
      `UPDATE compliance_snapshots SET status = 'retention_complete' WHERE id = ANY($1)`,
      [ids]
    );

    logger.info(`[RETENTION-EXPIRY] Marked ${ids.length} snapshot(s) as retention_complete`);

    // Notify platform admins
    const admins = await pool.query('SELECT id, org_id FROM users WHERE is_platform_admin = true');

    for (const admin of admins.rows) {
      // Debounce: one notification per day
      const existing = await pool.query(
        `SELECT id FROM notifications
         WHERE type = 'retention_expiry' AND is_read = false
           AND user_id = $1
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [admin.id]
      );
      if (existing.rows.length > 0) continue;

      await createNotification({
        orgId: admin.org_id,
        userId: admin.id,
        type: 'retention_expiry',
        severity: 'info',
        title: `${ids.length} snapshot(s) past retention end date`,
        body: `${ids.length} compliance snapshot(s) have completed their CRA Art. 13(10) retention period and are now eligible for review. No automatic deletion has been performed.`,
        link: '/admin/retention-ledger',
        metadata: { snapshotIds: ids, date: todayStr },
      });
    }
  } catch (err: any) {
    console.error('[RETENTION-EXPIRY] Error:', err.message);
  }
}

// ── E4: Monthly reserve sufficiency monitoring ──────────────────
async function checkReserveSufficiency(): Promise<void> {
  const now = new Date();

  // Only run on the 1st of the month
  if (now.getUTCDate() !== 1) return;

  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM
  if (lastReserveSufficiencyMonth === monthStr) return;
  if (now.getUTCHours() < RESERVE_SUFFICIENCY_HOUR) return;

  lastReserveSufficiencyMonth = monthStr;
  logger.info('[RESERVE-SUFFICIENCY] Starting monthly reserve sufficiency check...');

  try {
    const { calculateRetentionCost, calculateRetentionMonths } = await import('./retention-costing.js');
    const driver = getDriver();
    const session = driver.session();

    try {
      // Get all active ledger entries with their current archive sizes
      const entries = await pool.query(
        `SELECT rl.id, rl.org_id, rl.product_id, rl.archive_size_bytes,
                rl.funded_amount_eur, rl.retention_start_date, rl.retention_end_date
         FROM retention_reserve_ledger rl
         WHERE rl.status = 'allocated'`
      );

      if (entries.rows.length === 0) {
        logger.info('[RESERVE-SUFFICIENCY] No allocated entries to check');
        return;
      }

      let shortfalls = 0;
      const shortfallDetails: Array<{ ledgerId: string; orgId: string; productId: string; funded: number; required: number; gap: number }> = [];

      for (const entry of entries.rows) {
        // Recalculate remaining retention months from now
        const endDate = entry.retention_end_date;
        if (!endDate) continue;

        const end = new Date(endDate);
        const remainingMonths = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
        if (remainingMonths === 0) continue;

        const recalculated = calculateRetentionCost(parseInt(entry.archive_size_bytes), remainingMonths);
        const funded = parseFloat(entry.funded_amount_eur);
        const gap = recalculated.fundedAmount - funded;
        const gapPercent = funded > 0 ? (gap / funded) * 100 : 100;

        // Flag shortfalls >20%
        if (gapPercent > 20) {
          shortfalls++;
          shortfallDetails.push({
            ledgerId: entry.id,
            orgId: entry.org_id,
            productId: entry.product_id,
            funded,
            required: recalculated.fundedAmount,
            gap,
          });
        }
      }

      if (shortfalls === 0) {
        logger.info(`[RESERVE-SUFFICIENCY] All ${entries.rows.length} allocated entries are within 20% tolerance`);
        return;
      }

      logger.info(`[RESERVE-SUFFICIENCY] ${shortfalls} entries have reserve shortfalls >20%`);

      // Notify platform admins
      const admins = await pool.query('SELECT id, org_id FROM users WHERE is_platform_admin = true');
      const totalGap = shortfallDetails.reduce((sum, d) => sum + d.gap, 0);

      for (const admin of admins.rows) {
        await createNotification({
          orgId: admin.org_id,
          userId: admin.id,
          type: 'reserve_shortfall',
          severity: 'high',
          title: `Reserve shortfall: ${shortfalls} entries underfunded`,
          body: `Monthly reserve check found ${shortfalls} retention ledger entries where recalculated costs exceed funded amounts by >20%. Total estimated shortfall: €${totalGap.toFixed(2)}. Review in Admin → Retention Ledger.`,
          link: '/admin/retention-ledger',
          metadata: { shortfallCount: shortfalls, totalGap: totalGap.toFixed(2), month: monthStr },
        });
      }
    } finally {
      await session.close();
    }
  } catch (err: any) {
    console.error('[RESERVE-SUFFICIENCY] Error:', err.message);
  }
}

async function cleanupExpiredSnapshots(): Promise<void> {
  try {
    // Find snapshots older than 24 hours that are complete and still have a local file
    const result = await pool.query(
      `SELECT id, org_id, product_id, filename
       FROM compliance_snapshots
       WHERE status = 'complete'
         AND created_at < NOW() - INTERVAL '24 hours'`
    );

    if (result.rows.length === 0) return;

    const { deleteSnapshotFile, getSnapshotPath } = await import('../services/compliance-snapshot.js');
    const { stat } = await import('node:fs/promises');
    let cleaned = 0;

    for (const row of result.rows) {
      const filepath = getSnapshotPath(row.org_id, row.product_id, row.filename);
      try {
        await stat(filepath);
        // File still exists — delete it
        await deleteSnapshotFile(row.org_id, row.product_id, row.filename);
        cleaned++;
      } catch {
        // File already gone — nothing to do
      }
    }

    if (cleaned > 0) {
      logger.info(`[SNAPSHOT-CLEANUP] Purged ${cleaned} local snapshot file(s) older than 24 hours`);
    }
  } catch (err: any) {
    console.error('[SNAPSHOT-CLEANUP] Error during cleanup:', err.message);
  }
}

export function startScheduler(): void {
  logger.info('[SCHEDULER] Started — checking every ' + (CHECK_INTERVAL_MS / 60000) + ' minutes, vuln DB sync at ' + VULN_DB_SYNC_HOUR + ':00, SBOM sync at ' + AUTO_SYNC_HOUR + ':00, vuln scan at ' + VULN_SCAN_HOUR + ':00, billing checks at ' + BILLING_CHECK_HOUR + ':00, CRA deadline checks every hour, escrow deposits at ' + ESCROW_DEPOSIT_HOUR + ':00, webhook health at ' + WEBHOOK_HEALTH_HOUR + ':00, support period checks at ' + SUPPORT_CHECK_HOUR + ':00, smart deadline alerts at ' + SMART_DEADLINE_HOUR + ':00, scheduled snapshots at ' + SNAPSHOT_SCHEDULE_HOUR + ':00, retention expiry at ' + RETENTION_EXPIRY_HOUR + ':00, reserve sufficiency on 1st at ' + RESERVE_SUFFICIENCY_HOUR + ':00');

  // Run check periodically — all three have hour-gating and date-tracking
  setInterval(() => {
    runDailyVulnDbSync().catch(err => console.error('[SCHEDULER] Uncaught error in DB sync:', err));
    runDailySync().catch(err => console.error('[SCHEDULER] Uncaught error in SBOM sync:', err));
    runDailyVulnScan().catch(err => console.error('[SCHEDULER] Uncaught error in vuln scan:', err));
    runDailyBillingChecks().catch(err => console.error('[SCHEDULER] Uncaught error in billing checks:', err));
    checkCraDeadlines().catch(err => console.error("[SCHEDULER] Uncaught error in CRA deadline check:", err));
    runDailyEscrowDeposits().catch(err => console.error('[SCHEDULER] Uncaught error in escrow deposits:', err));
    runDailyWebhookHealthCheck().catch(err => console.error('[SCHEDULER] Uncaught error in webhook health:', err));
    checkSupportPeriodExpiry().catch(err => console.error('[SCHEDULER] Uncaught error in support period check:', err));
    checkSmartDeadlineAlerts().catch(err => console.error('[SCHEDULER] Uncaught error in smart deadline check:', err));
    cleanupExpiredSnapshots().catch(err => console.error('[SCHEDULER] Uncaught error in snapshot cleanup:', err));
    runScheduledSnapshots().catch(err => console.error('[SCHEDULER] Uncaught error in scheduled snapshots:', err));
    checkRetentionExpiry().catch(err => console.error('[SCHEDULER] Uncaught error in retention expiry check:', err));
    checkReserveSufficiency().catch(err => console.error('[SCHEDULER] Uncaught error in reserve sufficiency check:', err));
  }, CHECK_INTERVAL_MS);
}
