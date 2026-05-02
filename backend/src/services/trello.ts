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
 * Trello Integration Service
 *
 * Creates Trello cards for compliance events (vulnerabilities, obligations,
 * deadlines, compliance gaps). Per-org API credentials, per-product board
 * mapping, deduplication via trello_card_log.
 *
 * Trello REST API docs: https://developer.atlassian.com/cloud/trello/rest/
 */

import pool from '../db/pool.js';

// ── Types ──

export interface TrelloIntegration {
  orgId: string;
  apiKey: string;
  apiToken: string;
  enabled: boolean;
}

export interface TrelloProductBoard {
  orgId: string;
  productId: string;
  boardId: string;
  boardName: string | null;
  listVuln: string | null;
  listObligations: string | null;
  listDeadlines: string | null;
  listGaps: string | null;
}

export type TrelloEventType =
  | 'vulnerability_found'
  | 'obligation_changed'
  | 'cra_deadline'
  | 'compliance_stall'
  | 'compliance_gap';

interface TrelloCardPayload {
  name: string;
  desc: string;
  idList: string;
  due?: string;
  idLabels?: string[];
}

interface TrelloCard {
  id: string;
  url: string;
  name: string;
}

// ── Trello API helpers ──

const TRELLO_BASE = 'https://api.trello.com/1';

async function trelloFetch<T>(
  path: string,
  apiKey: string,
  apiToken: string,
  options: { method?: string; body?: object } = {}
): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TRELLO_BASE}${path}${sep}key=${apiKey}&token=${apiToken}`;
  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Trello API ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

// ── Public API ──

/** Get org's Trello integration credentials */
export async function getIntegration(orgId: string): Promise<TrelloIntegration | null> {
  const r = await pool.query(
    'SELECT org_id, api_key, api_token, enabled FROM trello_integrations WHERE org_id = $1',
    [orgId]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return { orgId: row.org_id, apiKey: row.api_key, apiToken: row.api_token, enabled: row.enabled };
}

/** Save or update org's Trello credentials */
export async function saveIntegration(orgId: string, apiKey: string, apiToken: string): Promise<void> {
  await pool.query(
    `INSERT INTO trello_integrations (org_id, api_key, api_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (org_id) DO UPDATE SET api_key = $2, api_token = $3, updated_at = NOW()`,
    [orgId, apiKey, apiToken]
  );
}

/** Delete org's Trello integration */
export async function deleteIntegration(orgId: string): Promise<void> {
  await pool.query('DELETE FROM trello_product_boards WHERE org_id = $1', [orgId]);
  await pool.query('DELETE FROM trello_integrations WHERE org_id = $1', [orgId]);
}

/** Toggle integration enabled/disabled */
export async function setEnabled(orgId: string, enabled: boolean): Promise<void> {
  await pool.query(
    'UPDATE trello_integrations SET enabled = $2, updated_at = NOW() WHERE org_id = $1',
    [orgId, enabled]
  );
}

/** Get product board mapping */
export async function getProductBoard(orgId: string, productId: string): Promise<TrelloProductBoard | null> {
  const r = await pool.query(
    `SELECT org_id, product_id, board_id, board_name,
            list_vuln, list_obligations, list_deadlines, list_gaps
     FROM trello_product_boards WHERE org_id = $1 AND product_id = $2`,
    [orgId, productId]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  return {
    orgId: row.org_id,
    productId: row.product_id,
    boardId: row.board_id,
    boardName: row.board_name,
    listVuln: row.list_vuln,
    listObligations: row.list_obligations,
    listDeadlines: row.list_deadlines,
    listGaps: row.list_gaps,
  };
}

/** Get all product boards for an org */
export async function getOrgProductBoards(orgId: string): Promise<TrelloProductBoard[]> {
  const r = await pool.query(
    `SELECT org_id, product_id, board_id, board_name,
            list_vuln, list_obligations, list_deadlines, list_gaps
     FROM trello_product_boards WHERE org_id = $1`,
    [orgId]
  );
  return r.rows.map(row => ({
    orgId: row.org_id,
    productId: row.product_id,
    boardId: row.board_id,
    boardName: row.board_name,
    listVuln: row.list_vuln,
    listObligations: row.list_obligations,
    listDeadlines: row.list_deadlines,
    listGaps: row.list_gaps,
  }));
}

/** Save or update a product's board mapping */
export async function saveProductBoard(
  orgId: string,
  productId: string,
  boardId: string,
  boardName: string | null,
  lists: { vuln?: string; obligations?: string; deadlines?: string; gaps?: string }
): Promise<void> {
  await pool.query(
    `INSERT INTO trello_product_boards (org_id, product_id, board_id, board_name, list_vuln, list_obligations, list_deadlines, list_gaps)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (org_id, product_id) DO UPDATE SET
       board_id = $3, board_name = $4,
       list_vuln = $5, list_obligations = $6, list_deadlines = $7, list_gaps = $8,
       updated_at = NOW()`,
    [orgId, productId, boardId, boardName, lists.vuln || null, lists.obligations || null, lists.deadlines || null, lists.gaps || null]
  );
}

/** Delete a product's board mapping */
export async function deleteProductBoard(orgId: string, productId: string): Promise<void> {
  await pool.query(
    'DELETE FROM trello_product_boards WHERE org_id = $1 AND product_id = $2',
    [orgId, productId]
  );
}

// ── Trello API proxy helpers ──

/** List boards the user has access to */
export async function listBoards(apiKey: string, apiToken: string): Promise<{ id: string; name: string }[]> {
  return trelloFetch<{ id: string; name: string }[]>(
    '/members/me/boards?fields=id,name',
    apiKey,
    apiToken
  );
}

/** List lists on a board */
export async function listBoardLists(
  apiKey: string,
  apiToken: string,
  boardId: string
): Promise<{ id: string; name: string }[]> {
  return trelloFetch<{ id: string; name: string }[]>(
    `/boards/${boardId}/lists?fields=id,name`,
    apiKey,
    apiToken
  );
}

/** Create a list on a board */
export async function createBoardList(
  apiKey: string,
  apiToken: string,
  boardId: string,
  name: string
): Promise<{ id: string; name: string }> {
  return trelloFetch<{ id: string; name: string }>(
    '/lists',
    apiKey,
    apiToken,
    { method: 'POST', body: { name, idBoard: boardId } }
  );
}

/** Create default CRANIS2 lists on a board (skips any that already exist) */
export async function createDefaultLists(
  apiKey: string,
  apiToken: string,
  boardId: string
): Promise<{ id: string; name: string }[]> {
  const defaults = [
    'CRA Vulnerabilities',
    'CRA Obligations',
    'CRA Deadlines',
    'CRA Gaps / Stalls',
  ];

  const existing = await listBoardLists(apiKey, apiToken, boardId);
  const existingNames = new Set(existing.map(l => l.name));

  const created: { id: string; name: string }[] = [...existing];
  for (const name of defaults) {
    if (!existingNames.has(name)) {
      const list = await createBoardList(apiKey, apiToken, boardId, name);
      created.push(list);
    }
  }
  return created;
}

/** List labels on a board */
export async function listBoardLabels(
  apiKey: string,
  apiToken: string,
  boardId: string
): Promise<{ id: string; name: string; color: string }[]> {
  return trelloFetch<{ id: string; name: string; color: string }[]>(
    `/boards/${boardId}/labels?fields=id,name,color`,
    apiKey,
    apiToken
  );
}

// ── Card creation with deduplication ──

/** Create a Trello card (low-level) */
async function createCard(
  apiKey: string,
  apiToken: string,
  payload: TrelloCardPayload
): Promise<TrelloCard> {
  return trelloFetch<TrelloCard>(
    '/cards',
    apiKey,
    apiToken,
    { method: 'POST', body: payload }
  );
}

/**
 * Create a card if one hasn't already been created for this event.
 * Returns the card URL if created, or null if deduplicated.
 */
async function ensureCard(
  orgId: string,
  productId: string,
  eventKey: string,
  eventType: TrelloEventType,
  apiKey: string,
  apiToken: string,
  payload: TrelloCardPayload
): Promise<string | null> {
  // Check deduplication
  const existing = await pool.query(
    'SELECT card_url FROM trello_card_log WHERE event_key = $1',
    [eventKey]
  );
  if (existing.rows.length > 0) return null;

  const card = await createCard(apiKey, apiToken, payload);

  await pool.query(
    `INSERT INTO trello_card_log (org_id, product_id, event_key, card_id, card_url, event_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (event_key) DO NOTHING`,
    [orgId, productId, eventKey, card.id, card.url, eventType]
  );

  return card.url;
}

/**
 * Add a comment to an existing Trello card.
 */
async function addCardComment(
  apiKey: string,
  apiToken: string,
  cardId: string,
  text: string
): Promise<void> {
  await trelloFetch<unknown>(
    `/cards/${cardId}/actions/comments`,
    apiKey,
    apiToken,
    { method: 'POST', body: { text } }
  );
}

/**
 * Resolve a Trello card by event key: add a comment explaining the resolution
 * and mark it as resolved in our log. The card stays on the board – the board
 * admin decides when to archive or remove it.
 */
export async function resolveCard(
  orgId: string,
  eventKey: string,
  reason: string
): Promise<void> {
  const row = await pool.query(
    'SELECT card_id, resolved_at FROM trello_card_log WHERE event_key = $1',
    [eventKey]
  );
  if (row.rows.length === 0 || row.rows[0].resolved_at) return; // Not found or already resolved

  const integration = await getIntegration(orgId);
  if (!integration?.enabled) return;

  const cardId = row.rows[0].card_id;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  await addCardComment(
    integration.apiKey,
    integration.apiToken,
    cardId,
    `✅ **Resolved in CRANIS2** (${timestamp})\n\n${reason}`
  );

  await pool.query(
    'UPDATE trello_card_log SET resolved_at = NOW() WHERE event_key = $1',
    [eventKey]
  );
}

/**
 * Resolve all unresolved cards matching a prefix (e.g. all vuln cards for a product).
 * Non-blocking convenience wrapper.
 */
export async function resolveCardsByPrefix(
  orgId: string,
  eventKeyPrefix: string,
  reason: string
): Promise<void> {
  const rows = await pool.query(
    'SELECT event_key FROM trello_card_log WHERE event_key LIKE $1 AND resolved_at IS NULL',
    [eventKeyPrefix + '%']
  );
  for (const r of rows.rows) {
    await resolveCard(orgId, r.event_key, reason).catch(() => {});
  }
}

// ── Event-specific card builders ──

/**
 * Create a card for a new vulnerability finding.
 * Called from vulnerability-scanner after new critical/high findings.
 */
export async function createVulnerabilityCard(
  orgId: string,
  productId: string,
  productName: string,
  finding: {
    id: string;
    title: string;
    severity: string;
    dependencyName: string;
    fixedVersion?: string;
  }
): Promise<void> {
  const integration = await getIntegration(orgId);
  if (!integration?.enabled) return;

  const board = await getProductBoard(orgId, productId);
  if (!board?.listVuln) return;

  const eventKey = `vuln:${productId}:${finding.id}`;
  const severityEmoji = finding.severity === 'critical' ? '🔴' : finding.severity === 'high' ? '🟠' : '🟡';

  await ensureCard(
    orgId, productId, eventKey, 'vulnerability_found',
    integration.apiKey, integration.apiToken,
    {
      name: `${severityEmoji} [${finding.severity.toUpperCase()}] ${finding.title}`,
      desc: [
        `**Product:** ${productName}`,
        `**Severity:** ${finding.severity}`,
        `**Dependency:** ${finding.dependencyName}`,
        finding.fixedVersion ? `**Fix:** Upgrade to ${finding.fixedVersion}` : '',
        '',
        `CRA Art. 13(5) prohibits placing products with known exploitable vulnerabilities on the market.`,
        '',
        `_Created by CRANIS2_`,
      ].filter(Boolean).join('\n'),
      idList: board.listVuln!,
    }
  ).catch(() => {}); // Non-blocking
}

/**
 * Create a card for an obligation status change.
 * Called from obligations route on status update.
 */
export async function createObligationCard(
  orgId: string,
  productId: string,
  productName: string,
  obligationKey: string,
  obligationTitle: string,
  newStatus: string,
  article: string
): Promise<void> {
  const integration = await getIntegration(orgId);
  if (!integration?.enabled) return;

  const board = await getProductBoard(orgId, productId);
  if (!board?.listObligations) return;

  // Only create cards for status changes to in_progress (new work started)
  if (newStatus !== 'in_progress') return;

  const eventKey = `obligation:${productId}:${obligationKey}:${newStatus}`;

  await ensureCard(
    orgId, productId, eventKey, 'obligation_changed',
    integration.apiKey, integration.apiToken,
    {
      name: `📋 ${article}: ${obligationTitle}`,
      desc: [
        `**Product:** ${productName}`,
        `**Obligation:** ${article} – ${obligationTitle}`,
        `**Status:** ${newStatus}`,
        '',
        `Work has begun on this CRA obligation. Complete and mark as "met" when done.`,
        '',
        `_Created by CRANIS2_`,
      ].join('\n'),
      idList: board.listObligations!,
    }
  ).catch(() => {});
}

/**
 * Create a card for a CRA deadline approaching.
 * Called from scheduler when milestone alerts fire.
 */
export async function createDeadlineCard(
  orgId: string,
  deadlineLabel: string,
  daysRemaining: number,
  deadlineId: string
): Promise<void> {
  const integration = await getIntegration(orgId);
  if (!integration?.enabled) return;

  // Deadline cards go to the first product board that has a deadlines list
  const boards = await getOrgProductBoards(orgId);
  const board = boards.find(b => b.listDeadlines);
  if (!board) return;

  const eventKey = `deadline:${orgId}:${deadlineId}:${daysRemaining}d`;

  await ensureCard(
    orgId, board.productId, eventKey, 'cra_deadline',
    integration.apiKey, integration.apiToken,
    {
      name: `⏰ ${deadlineLabel} – ${daysRemaining} days remaining`,
      desc: [
        `**Deadline:** ${deadlineLabel}`,
        `**Days remaining:** ${daysRemaining}`,
        '',
        `This CRA compliance deadline is approaching. Ensure all required actions are completed.`,
        '',
        `_Created by CRANIS2_`,
      ].join('\n'),
      idList: board.listDeadlines!,
    }
  ).catch(() => {});
}

/**
 * Create a card for a compliance stall alert.
 * Called from scheduler when products stall.
 */
export async function createComplianceStallCard(
  orgId: string,
  productId: string,
  productName: string,
  daysSinceUpdate: number,
  readiness: number
): Promise<void> {
  const integration = await getIntegration(orgId);
  if (!integration?.enabled) return;

  const board = await getProductBoard(orgId, productId);
  if (!board?.listGaps) return;

  // Weekly dedup – one per product per ISO week
  const now = new Date();
  const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
  const eventKey = `stall:${productId}:${now.getFullYear()}-W${weekNum}`;

  await ensureCard(
    orgId, productId, eventKey, 'compliance_stall',
    integration.apiKey, integration.apiToken,
    {
      name: `⚠️ ${productName} – compliance stalled (${readiness}% ready)`,
      desc: [
        `**Product:** ${productName}`,
        `**CRA Readiness:** ${readiness}%`,
        `**Days since last update:** ${daysSinceUpdate}`,
        '',
        `No obligation updates in ${daysSinceUpdate} days. Review the product's compliance status and take action.`,
        '',
        `_Created by CRANIS2_`,
      ].join('\n'),
      idList: board.listGaps!,
    }
  ).catch(() => {});
}

/**
 * Send a test card to verify the integration works.
 */
export async function sendTestCard(
  apiKey: string,
  apiToken: string,
  listId: string
): Promise<TrelloCard> {
  return createCard(apiKey, apiToken, {
    name: '✅ CRANIS2 Test Card',
    desc: 'This is a test card from CRANIS2 to verify your Trello integration is working correctly.\n\nYou can safely delete this card.',
    idList: listId,
  });
}
