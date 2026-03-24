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
  // Detect provider from headers.
  // Forgejo/Gitea webhooks send GitHub-compatible headers (X-GitHub-Event, X-Hub-Signature-256)
  // so we also check for Gitea/Forgejo-specific headers to identify the provider.
  // Bitbucket webhooks use X-Event-Key and X-Request-UUID headers.
  const isBitbucket = !!req.headers['x-event-key'] && !!req.headers['x-request-uuid'];
  const isForgejo = !isBitbucket && (!!req.headers['x-forgejo-event'] || !!req.headers['x-gitea-event']
    || !!req.headers['x-gitea-delivery'] || !!req.headers['x-forgejo-delivery']);
  const isGitHub = !isBitbucket && !isForgejo && !!req.headers['x-github-event'];
  let webhookProvider: RepoProvider = isBitbucket ? 'bitbucket' : isForgejo ? 'codeberg' : 'github';

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }

  // Bitbucket Cloud webhooks don't support HMAC signatures.
  // We verify by checking the X-Request-UUID header is present and the payload structure.
  if (isBitbucket) {
    const eventKey = req.headers['x-event-key'] as string;
    if (eventKey !== 'repo:push') {
      logger.info(`[WEBHOOK] Ignoring Bitbucket event: ${eventKey}`);
      res.json({ status: 'ignored', event: eventKey });
      return;
    }

    // Extract repo URL from Bitbucket payload
    const bbRepoUrl = req.body?.repository?.links?.html?.href
      || (req.body?.repository?.full_name ? `https://bitbucket.org/${req.body.repository.full_name}` : null);

    if (!bbRepoUrl) {
      res.status(400).json({ error: 'Missing repository URL' });
      return;
    }

    // Verify this repo is actually tracked by CRANIS2 (prevents spoofed webhooks)
    const neo4jVerify = getDriver().session();
    try {
      const verifyResult = await neo4jVerify.run(
        `MATCH (p:Product)-[:HAS_REPO]->(r:Repository)
         WHERE r.url = $repoUrl OR r.url = $repoUrlGit
         RETURN count(p) AS cnt`,
        { repoUrl: bbRepoUrl, repoUrlGit: bbRepoUrl + '.git' }
      );
      const cnt = verifyResult.records[0]?.get('cnt')?.toNumber?.() || verifyResult.records[0]?.get('cnt') || 0;
      if (cnt === 0) {
        logger.warn(`[WEBHOOK] Bitbucket webhook for untracked repo: ${bbRepoUrl}`);
        res.status(401).json({ error: 'Repository not tracked' });
        return;
      }
    } finally {
      await neo4jVerify.close();
    }

    // Process Bitbucket push — normalise payload to match GitHub flow below
    const repoUrl = bbRepoUrl;
    logger.info(`[WEBHOOK] Push event from bitbucket for ${repoUrl}`);

    const neo4jSession = getDriver().session();
    try {
      const result = await neo4jSession.run(
        `MATCH (p:Product)-[:HAS_REPO]->(r:Repository)
         WHERE r.url = $repoUrl OR r.url = $repoUrlGit
         RETURN p.id as productId`,
        { repoUrl, repoUrlGit: repoUrl + '.git' }
      );

      for (const record of result.records) {
        const productId = record.get('productId');
        await pool.query(`UPDATE product_sboms SET is_stale = TRUE WHERE product_id = $1`, [productId]);
        await neo4jSession.run(
          `MATCH (p:Product {id: $productId})-[:HAS_SBOM]->(sbom:SBOM) SET sbom.isStale = true`,
          { productId }
        );
        logger.info(`[WEBHOOK] Marked SBOM stale for product: ${productId}`);

        // Store push event
        try {
          const changes = req.body?.push?.changes || [];
          const latestChange = changes[0];
          const newTarget = latestChange?.new?.target;
          const pusherName = req.body?.actor?.display_name || req.body?.actor?.nickname || 'unknown';
          const pushBranch = latestChange?.new?.name || null;
          const pushRef = pushBranch ? `refs/heads/${pushBranch}` : null;
          const commitCount = latestChange?.commits?.length || 0;
          const headMessage = newTarget?.message || null;
          const headSha = newTarget?.hash || null;

          await pool.query(
            `INSERT INTO repo_push_events (product_id, pusher_name, pusher_email, ref, branch, commit_count, head_commit_message, head_commit_sha, provider)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [productId, pusherName, null, pushRef, pushBranch, commitCount, headMessage, headSha, 'bitbucket']
          );
        } catch (pushErr: any) {
          console.error('[WEBHOOK] Failed to store Bitbucket push event:', pushErr.message);
        }

        // Audit event
        try {
          await pool.query(
            `INSERT INTO user_events (event_type, ip_address, user_agent, metadata)
             VALUES ($1, $2, $3, $4)`,
            ['webhook_sbom_stale', req.ip || null, req.headers['user-agent'] || 'Bitbucket-Webhooks', JSON.stringify({ productId, repoUrl, event: 'push' })]
          );
        } catch (telErr: any) {
          console.error('[WEBHOOK] Failed to record audit event:', telErr.message);
        }

        // Stale SBOM notification + email
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
                body: 'A push to the Bitbucket repository was detected. The SBOM needs to be re-synced.',
                link: '/products/' + productId + '?tab=dependencies',
                metadata: { productId, productName, repoUrl, event: 'push' },
              });
              sendSbomStaleEmail(webhookOrgId, productName, productId).catch(() => {});
            }
          }
        } catch (notifErr: any) {
          console.error('[WEBHOOK] Failed to create stale SBOM notification:', notifErr.message);
        }
      }

      res.json({ status: 'ok', productsUpdated: result.records.length });
    } catch (err: any) {
      console.error('[WEBHOOK] Error processing Bitbucket push event:', err);
      res.status(500).json({ error: 'Internal error processing webhook' });
    } finally {
      await neo4jSession.close();
    }
    return;
  }

  // ── GitHub / Codeberg / Forgejo webhook handling ──────────────────

  // Verify HMAC signature
  const signature = (req.headers['x-hub-signature-256'] || req.headers['x-forgejo-signature'] || req.headers['x-gitea-signature']) as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const sigToCompare = signature.startsWith('sha256=') ? signature : `sha256=${signature}`;

  // Try the primary secret first, then fall back to the alternate secret.
  // Forgejo sends GitHub-compatible headers, making it indistinguishable from
  // GitHub by headers alone. If the primary secret fails, try the other provider's
  // secret before rejecting — this handles Forgejo webhooks that arrive with
  // GitHub headers but were created with the Codeberg/Forgejo secret.
  const secrets: Array<{ secret: string; provider: RepoProvider }> = [];
  const primarySecret = webhookProvider === 'codeberg'
    ? process.env.CODEBERG_WEBHOOK_SECRET
    : process.env.GITHUB_WEBHOOK_SECRET;
  const alternateSecret = webhookProvider === 'codeberg'
    ? process.env.GITHUB_WEBHOOK_SECRET
    : process.env.CODEBERG_WEBHOOK_SECRET;
  if (primarySecret) secrets.push({ secret: primarySecret, provider: webhookProvider });
  if (alternateSecret && alternateSecret !== primarySecret) {
    secrets.push({ secret: alternateSecret, provider: webhookProvider === 'codeberg' ? 'github' : 'codeberg' });
  }

  if (secrets.length === 0) {
    console.error(`[WEBHOOK] No webhook secrets configured`);
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  let verified = false;
  for (const { secret, provider } of secrets) {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sigToCompare.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sigToCompare), Buffer.from(expected))) {
      verified = true;
      webhookProvider = provider;
      break;
    }
  }

  if (!verified) {
    logger.warn(`[WEBHOOK] Invalid signature (tried ${secrets.length} secret(s))`);
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
              body: `A push to the ${webhookProvider === 'codeberg' ? 'Codeberg' : webhookProvider === 'bitbucket' ? 'Bitbucket' : 'GitHub'} repository was detected. The SBOM needs to be re-synced.`,
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
