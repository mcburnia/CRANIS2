/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Webhook lifecycle – auto-register and cleanup push-event webhooks.
 *
 * Called after a successful repo sync (manual or scheduled) to ensure
 * the provider will POST push events to our webhook endpoint, keeping
 * SBOMs up to date automatically.
 */

import { getDriver } from '../db/neo4j.js';
import * as provider from './repo-provider.js';
import { logger } from '../utils/logger.js';
import type { RepoProvider } from './repo-provider.js';

const APP_BASE_URL = process.env.FRONTEND_URL || 'https://dev.cranis2.dev';
const WEBHOOK_CALLBACK = `${APP_BASE_URL}/api/github/webhook`;

/**
 * Ensure a push-event webhook exists for the given repository.
 * Idempotent – skips if the Repository node already stores a webhookId.
 * Non-blocking – logs errors but never throws (caller must not fail).
 */
export async function ensureWebhook(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string,
  repoUrl: string,
  instanceUrl?: string
): Promise<void> {
  // GitLab not yet supported
  if (prov === 'gitlab') return;

  const secret = provider.getWebhookSecret(prov);
  if (!secret) {
    logger.warn(`[WEBHOOK] No webhook secret configured for ${prov} – skipping auto-registration`);
    return;
  }

  const session = getDriver().session();
  try {
    // Check if webhook already registered
    const existing = await session.run(
      `MATCH (r:Repository {url: $url}) RETURN r.webhookId AS webhookId`,
      { url: repoUrl }
    );
    const currentId = existing.records[0]?.get('webhookId');
    if (currentId) {
      logger.info(`[WEBHOOK] Already registered (id=${currentId}) for ${owner}/${repo} – skipping`);
      return;
    }

    // Register webhook with provider
    logger.info(`[WEBHOOK] Registering push webhook for ${prov}:${owner}/${repo} → ${WEBHOOK_CALLBACK}`);
    const webhookId = await provider.createWebhook(prov, token, owner, repo, WEBHOOK_CALLBACK, secret, instanceUrl);

    if (!webhookId) {
      logger.warn(`[WEBHOOK] Provider returned no webhook ID for ${owner}/${repo}`);
      return;
    }

    // Store webhook ID on Repository node
    await session.run(
      `MATCH (r:Repository {url: $url}) SET r.webhookId = $webhookId`,
      { url: repoUrl, webhookId: String(webhookId) }
    );
    logger.info(`[WEBHOOK] Registered webhook id=${webhookId} for ${prov}:${owner}/${repo}`);
  } catch (err: any) {
    // Non-blocking – log but don't throw
    console.error(`[WEBHOOK] Failed to register webhook for ${owner}/${repo}: ${err.message}`);
  } finally {
    await session.close();
  }
}

/**
 * Remove all webhooks for repositories owned by a user for a given provider.
 * Called when a user disconnects their repo connection.
 * Best-effort – logs errors but does not throw.
 */
export async function removeWebhooksForUser(
  prov: RepoProvider,
  token: string,
  userId: string,
  instanceUrl?: string
): Promise<void> {
  if (prov === 'gitlab') return;

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:REPO_CONNECTED]->(r:Repository)
       WHERE r.provider = $provider AND r.webhookId IS NOT NULL
       RETURN r.url AS url, r.webhookId AS webhookId, r.owner AS owner, r.name AS name`,
      { userId, provider: prov }
    );

    for (const record of result.records) {
      const webhookId = parseInt(record.get('webhookId'), 10);
      const repoOwner = record.get('owner');
      const repoName = record.get('name');
      const repoUrl = record.get('url');

      if (!webhookId || !repoOwner || !repoName) continue;

      try {
        await provider.deleteWebhook(prov, token, repoOwner, repoName, webhookId, instanceUrl);
        await session.run(
          `MATCH (r:Repository {url: $url}) REMOVE r.webhookId`,
          { url: repoUrl }
        );
        logger.info(`[WEBHOOK] Removed webhook id=${webhookId} from ${prov}:${repoOwner}/${repoName}`);
      } catch (err: any) {
        console.error(`[WEBHOOK] Failed to remove webhook from ${repoOwner}/${repoName}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[WEBHOOK] Failed to query repos for webhook cleanup: ${err.message}`);
  } finally {
    await session.close();
  }
}
