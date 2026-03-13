import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { createNotification } from '../../services/notifications.js';
import { sendSbomStaleEmail } from '../../services/alert-emails.js';
import { logger } from '../../utils/logger.js';
import type { RepoProvider } from '../../services/repo-provider.js';

const router = Router();

// ─── POST /api/github/webhook ─────────────────────────────────────
// Receive push events from GitHub or Codeberg and mark SBOM as stale
router.post('/webhook', async (req: Request, res: Response) => {
  // Detect provider from headers
  const isGitHub = !!req.headers['x-github-event'];
  const isForgejo = !!req.headers['x-forgejo-event'] || !!req.headers['x-gitea-event'];
  const webhookProvider: RepoProvider = isForgejo ? 'codeberg' : 'github';

  const webhookSecret = webhookProvider === 'codeberg'
    ? process.env.CODEBERG_WEBHOOK_SECRET
    : process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(`[WEBHOOK] No ${webhookProvider.toUpperCase()}_WEBHOOK_SECRET configured`);
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  // Verify HMAC signature
  const signature = (req.headers['x-hub-signature-256'] || req.headers['x-forgejo-signature']) as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }

  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const sigToCompare = signature.startsWith('sha256=') ? signature : `sha256=${signature}`;
  if (!crypto.timingSafeEqual(Buffer.from(sigToCompare), Buffer.from(expectedSignature))) {
    logger.warn(`[WEBHOOK] Invalid ${webhookProvider} signature`);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Only process push events
  const event = (req.headers['x-github-event'] || req.headers['x-forgejo-event'] || req.headers['x-gitea-event']) as string;
  if (event !== 'push') {
    logger.info(`[WEBHOOK] Ignoring ${webhookProvider} event: ${event}`);
    res.json({ status: 'ignored', event });
    return;
  }

  const repoUrl = req.body?.repository?.html_url;
  if (!repoUrl) {
    res.status(400).json({ error: 'Missing repository URL' });
    return;
  }

  logger.info(`[WEBHOOK] Push event from ${webhookProvider} for ${repoUrl}`);

  // Find product(s) linked to this repo
  const neo4jSession = getDriver().session();
  try {
    const result = await neo4jSession.run(
      `MATCH (p:Product)-[:HAS_REPO]->(r:Repository)
       WHERE r.url = $repoUrl OR r.url = $repoUrlGit
       RETURN p.id as productId`,
      { repoUrl, repoUrlGit: repoUrl + '.git' }
    );

    if (result.records.length === 0) {
      logger.info(`[WEBHOOK] No product found for repo: ${repoUrl}`);
      res.json({ status: 'no_match', repoUrl });
      return;
    }

    // Mark SBOM as stale for each matching product
    for (const record of result.records) {
      const productId = record.get('productId');

      // Update Postgres
      await pool.query(
        `UPDATE product_sboms SET is_stale = TRUE WHERE product_id = $1`,
        [productId]
      );

      // Update Neo4j
      await neo4jSession.run(
        `MATCH (p:Product {id: $productId})-[:HAS_SBOM]->(sbom:SBOM)
         SET sbom.isStale = true`,
        { productId }
      );

      logger.info(`[WEBHOOK] Marked SBOM stale for product: ${productId}`);

      // Store push event details for the activity feed
      try {
        const pusherName = req.body?.pusher?.name || req.body?.pusher?.login || 'unknown';
        const pusherEmail = req.body?.pusher?.email || null;
        const pushRef = req.body?.ref || null;
        const pushBranch = pushRef?.replace('refs/heads/', '') || null;
        const commitCount = Array.isArray(req.body?.commits) ? req.body.commits.length : 0;
        const headCommitMessage = req.body?.head_commit?.message || req.body?.commits?.[0]?.message || null;
        const headCommitSha = req.body?.after || req.body?.head_commit?.id || null;

        await pool.query(
          `INSERT INTO repo_push_events (product_id, pusher_name, pusher_email, ref, branch, commit_count, head_commit_message, head_commit_sha, provider)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [productId, pusherName, pusherEmail, pushRef, pushBranch, commitCount, headCommitMessage, headCommitSha, webhookProvider]
        );
      } catch (pushErr: any) {
        console.error('[WEBHOOK] Failed to store push event:', pushErr.message);
      }

      // Record telemetry (system event – no user, insert directly)
      try {
        await pool.query(
          `INSERT INTO user_events (event_type, ip_address, user_agent, metadata)
           VALUES ($1, $2, $3, $4)`,
          ['webhook_sbom_stale', req.ip || null, req.headers['user-agent'] || 'GitHub-Hookshot', JSON.stringify({ productId, repoUrl, event: 'push' })]
        );
        logger.info(`[WEBHOOK] Audit event recorded for product: ${productId}`);
      } catch (telErr: any) {
        console.error('[WEBHOOK] Failed to record audit event:', telErr.message);
      }

      // Create notification for stale SBOM
      try {
        const orgResult = await neo4jSession.run(
          'MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation) RETURN o.id AS orgId, p.name AS name',
          { productId }
        );
        if (orgResult.records.length > 0) {
          const webhookOrgId = orgResult.records[0].get('orgId');
          const productName = orgResult.records[0].get('name') || productId;
          if (webhookOrgId) {
            await createNotification({
              orgId: webhookOrgId,
              userId: null,
              type: 'sbom_stale',
              severity: 'medium',
              title: 'SBOM is now stale for ' + productName,
              body: `A push to the ${webhookProvider === 'codeberg' ? 'Codeberg' : 'GitHub'} repository was detected. The SBOM needs to be re-synced.`,
              link: '/products/' + productId + '?tab=dependencies',
              metadata: { productId, productName, repoUrl, event: 'push' },
            });

            // Email alert for stale SBOM
            sendSbomStaleEmail(webhookOrgId, productName, productId).catch(() => {});
          }
        }
      } catch (notifErr: any) {
        console.error('[WEBHOOK] Failed to create stale SBOM notification:', notifErr.message);
      }
    }

    res.json({ status: 'ok', productsUpdated: result.records.length });
  } catch (err: any) {
    console.error('[WEBHOOK] Error processing push event:', err);
    res.status(500).json({ error: 'Internal error processing webhook' });
  } finally {
    await neo4jSession.close();
  }
});

export default router;
