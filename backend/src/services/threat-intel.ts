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
 * P10a — Threat-intelligence enrichment ingestion (CISA KEV + FIRST EPSS).
 *
 * KEV: ~1,300 entries, weekday updates, JSON, free, no API key.
 *      Source: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 *
 * EPSS: ~270k entries, daily, gzipped CSV, free, no API key.
 *       Source: https://epss.cyentia.com/epss_scores-current.csv.gz
 *
 * Both refreshes are idempotent and use the sync_batch_id pattern so a
 * full snapshot becomes atomic: upsert with new batch id, then delete
 * rows whose batch id does not match (handles KEV's occasional removals
 * and stale EPSS entries).
 */

import pool from '../db/pool.js';
import { createNotification } from './notifications.js';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';

// --- Constants ---

const KEV_FEED_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const EPSS_FEED_URL = 'https://epss.cyentia.com/epss_scores-current.csv.gz';
const UPSERT_BATCH_SIZE = 500;
const USER_AGENT = 'CRANIS2/1.0 (+https://cranis2.com)';
const FETCH_TIMEOUT_MS = 60_000;

// --- KEV feed shape (CISA-published JSON) ---

interface KevEntry {
  cveID: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
  cwes?: string[];
}

interface KevFeed {
  title?: string;
  catalogVersion?: string;
  dateReleased?: string;
  count?: number;
  vulnerabilities?: KevEntry[];
}

// --- Pure parsing helpers (exported for unit tests) ---

export function isValidCveId(cve: string | null | undefined): boolean {
  return typeof cve === 'string' && /^CVE-\d{4}-\d{4,}$/.test(cve);
}

export function nullIfEmpty(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function parseDateOrNull(value: string | undefined | null): string | null {
  const v = nullIfEmpty(value);
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export interface ParsedKevRow {
  cveId: string;
  vendorProject: string | null;
  product: string | null;
  vulnerabilityName: string | null;
  dateAdded: string | null;
  shortDescription: string | null;
  requiredAction: string | null;
  dueDate: string | null;
  knownRansomwareUse: boolean;
  notes: string | null;
  cwes: string[];
}

export function parseKevEntry(e: KevEntry): ParsedKevRow | null {
  if (!isValidCveId(e?.cveID)) return null;
  return {
    cveId: e.cveID,
    vendorProject: nullIfEmpty(e.vendorProject),
    product: nullIfEmpty(e.product),
    vulnerabilityName: nullIfEmpty(e.vulnerabilityName),
    dateAdded: parseDateOrNull(e.dateAdded),
    shortDescription: nullIfEmpty(e.shortDescription),
    requiredAction: nullIfEmpty(e.requiredAction),
    dueDate: parseDateOrNull(e.dueDate),
    knownRansomwareUse: (e.knownRansomwareCampaignUse || '').toLowerCase() === 'known',
    notes: nullIfEmpty(e.notes),
    cwes: Array.isArray(e.cwes) ? e.cwes : [],
  };
}

export interface ParsedEpssRow {
  cve: string;
  score: number;
  percentile: number;
}

/**
 * Parse a single EPSS CSV data line. Returns null for headers, comments,
 * blank lines, malformed rows, and rows whose CVE id is invalid.
 */
export function parseEpssDataLine(line: string): ParsedEpssRow | null {
  if (!line || line.length === 0) return null;
  if (line.startsWith('#')) return null;
  if (line.toLowerCase().startsWith('cve,')) return null; // column header
  const parts = line.split(',');
  if (parts.length < 3) return null;
  const cve = parts[0]?.trim();
  const score = parseFloat(parts[1]);
  const percentile = parseFloat(parts[2]);
  if (!isValidCveId(cve) || !Number.isFinite(score) || !Number.isFinite(percentile)) return null;
  return { cve, score, percentile };
}

/**
 * Extract model_version and score_date from an EPSS feed comment line.
 * The CSV ships a `#model_version:vYYYY.MM.DD,score_date:YYYY-MM-DDT...`
 * header as the first line.
 */
export function extractEpssMetadata(line: string): { modelVersion: string | null; scoredAt: string | null } {
  const result = { modelVersion: null as string | null, scoredAt: null as string | null };
  if (!line || !line.startsWith('#')) return result;
  const mv = line.match(/model_version[=:]\s*([^,\s]+)/i);
  const sd = line.match(/score_date[=:]\s*([0-9TZ:+\-]+)/i);
  if (mv) result.modelVersion = mv[1];
  if (sd) result.scoredAt = parseDateOrNull(sd[1]);
  return result;
}

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function markStatus(ecosystem: string, status: string, extra?: { errorMessage?: string | null }): Promise<void> {
  await pool.query(
    `INSERT INTO vuln_db_sync_status (ecosystem, status, error_message, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (ecosystem) DO UPDATE
     SET status = EXCLUDED.status,
         error_message = EXCLUDED.error_message,
         updated_at = NOW()`,
    [ecosystem, status, extra?.errorMessage ?? null]
  );
}

// --- KEV refresh ---

export async function refreshKev(): Promise<{ count: number; durationSeconds: number }> {
  const startTime = Date.now();
  const syncBatchId = randomUUID();

  console.log('[THREAT-INTEL] KEV refresh starting (batch ' + syncBatchId.slice(0, 8) + ')');
  await markStatus('kev', 'syncing');

  try {
    const res = await fetchWithTimeout(KEV_FEED_URL);
    if (!res.ok) throw new Error('KEV fetch failed: HTTP ' + res.status + ' ' + res.statusText);

    const feed = (await res.json()) as KevFeed;
    const entries = Array.isArray(feed.vulnerabilities) ? feed.vulnerabilities : [];

    if (entries.length === 0) {
      throw new Error('KEV feed returned zero vulnerabilities — refusing to apply (would wipe local cache)');
    }

    let upserted = 0;
    for (let i = 0; i < entries.length; i += UPSERT_BATCH_SIZE) {
      const batch = entries.slice(i, i + UPSERT_BATCH_SIZE);
      upserted += await upsertKevBatch(batch, syncBatchId);
    }

    // Remove rows that were not present in this batch (KEV occasionally retracts entries)
    const removed = await pool.query(
      'DELETE FROM vuln_db_kev WHERE sync_batch_id IS DISTINCT FROM $1',
      [syncBatchId]
    );

    const durationSeconds = (Date.now() - startTime) / 1000;
    await pool.query(
      `UPDATE vuln_db_sync_status
       SET status = 'completed', last_sync_at = NOW(), last_full_sync_at = NOW(),
           advisory_count = $2, duration_seconds = $3, error_message = NULL, updated_at = NOW()
       WHERE ecosystem = 'kev'`,
      [upserted, durationSeconds]
    );

    console.log(
      '[THREAT-INTEL] KEV refresh complete: ' + upserted + ' upserted, ' +
      (removed.rowCount || 0) + ' retracted in ' + durationSeconds.toFixed(1) + 's'
    );

    return { count: upserted, durationSeconds };
  } catch (err: any) {
    const message = err?.message || String(err);
    await markStatus('kev', 'error', { errorMessage: message });
    console.error('[THREAT-INTEL] KEV refresh failed: ' + message);
    throw err;
  }
}

async function upsertKevBatch(batch: KevEntry[], syncBatchId: string): Promise<number> {
  const parsed: ParsedKevRow[] = [];
  for (const entry of batch) {
    const row = parseKevEntry(entry);
    if (row) parsed.push(row);
  }
  if (parsed.length === 0) return 0;

  const values: any[] = [];
  const placeholders: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    const base = i * 12;
    placeholders.push(
      '($' + (base + 1) + ', $' + (base + 2) + ', $' + (base + 3) + ', $' + (base + 4) + ', $' +
      (base + 5) + ', $' + (base + 6) + ', $' + (base + 7) + ', $' + (base + 8) + ', $' +
      (base + 9) + ', $' + (base + 10) + ', $' + (base + 11) + ', $' + (base + 12) + ')'
    );
    values.push(
      r.cveId,
      r.vendorProject,
      r.product,
      r.vulnerabilityName,
      r.dateAdded,
      r.shortDescription,
      r.requiredAction,
      r.dueDate,
      r.knownRansomwareUse,
      r.notes,
      JSON.stringify(r.cwes),
      syncBatchId
    );
  }

  await pool.query(
    'INSERT INTO vuln_db_kev (cve_id, vendor_project, product, vulnerability_name, date_added, ' +
    'short_description, required_action, due_date, known_ransomware_use, notes, cwes, sync_batch_id) ' +
    'VALUES ' + placeholders.join(', ') + ' ' +
    'ON CONFLICT (cve_id) DO UPDATE SET ' +
    'vendor_project = EXCLUDED.vendor_project, product = EXCLUDED.product, ' +
    'vulnerability_name = EXCLUDED.vulnerability_name, date_added = EXCLUDED.date_added, ' +
    'short_description = EXCLUDED.short_description, required_action = EXCLUDED.required_action, ' +
    'due_date = EXCLUDED.due_date, known_ransomware_use = EXCLUDED.known_ransomware_use, ' +
    'notes = EXCLUDED.notes, cwes = EXCLUDED.cwes, sync_batch_id = EXCLUDED.sync_batch_id, ' +
    'ingested_at = NOW()',
    values
  );

  return parsed.length;
}

// --- EPSS refresh ---

export async function refreshEpss(): Promise<{ count: number; durationSeconds: number }> {
  const startTime = Date.now();
  const syncBatchId = randomUUID();

  console.log('[THREAT-INTEL] EPSS refresh starting (batch ' + syncBatchId.slice(0, 8) + ')');
  await markStatus('epss', 'syncing');

  try {
    const res = await fetchWithTimeout(EPSS_FEED_URL, FETCH_TIMEOUT_MS * 3);
    if (!res.ok) throw new Error('EPSS fetch failed: HTTP ' + res.status + ' ' + res.statusText);
    if (!res.body) throw new Error('EPSS fetch returned empty body');

    const nodeStream = Readable.fromWeb(res.body as any);
    const gunzip = nodeStream.pipe(createGunzip());
    const lines = createInterface({ input: gunzip, crlfDelay: Infinity });

    let modelVersion: string | null = null;
    let scoredAt: string | null = null;
    let buffer: ParsedEpssRow[] = [];
    let totalUpserted = 0;

    for await (const line of lines) {
      if (line.length === 0) continue;

      if (line.startsWith('#')) {
        const meta = extractEpssMetadata(line);
        if (meta.modelVersion) modelVersion = meta.modelVersion;
        if (meta.scoredAt) scoredAt = meta.scoredAt;
        continue;
      }

      const row = parseEpssDataLine(line);
      if (!row) continue;
      buffer.push(row);

      if (buffer.length >= UPSERT_BATCH_SIZE) {
        totalUpserted += await upsertEpssBatch(buffer, modelVersion, scoredAt, syncBatchId);
        buffer = [];
      }
    }

    if (buffer.length > 0) {
      totalUpserted += await upsertEpssBatch(buffer, modelVersion, scoredAt, syncBatchId);
    }

    if (totalUpserted === 0) {
      throw new Error('EPSS feed yielded zero rows — refusing to apply (would wipe local cache)');
    }

    // Remove rows whose CVE was not present in today's snapshot
    const removed = await pool.query(
      'DELETE FROM vuln_db_epss WHERE sync_batch_id IS DISTINCT FROM $1',
      [syncBatchId]
    );

    const durationSeconds = (Date.now() - startTime) / 1000;
    await pool.query(
      `UPDATE vuln_db_sync_status
       SET status = 'completed', last_sync_at = NOW(), last_full_sync_at = NOW(),
           advisory_count = $2, duration_seconds = $3, error_message = NULL, updated_at = NOW()
       WHERE ecosystem = 'epss'`,
      [totalUpserted, durationSeconds]
    );

    console.log(
      '[THREAT-INTEL] EPSS refresh complete: ' + totalUpserted + ' upserted, ' +
      (removed.rowCount || 0) + ' removed in ' + durationSeconds.toFixed(1) + 's' +
      (modelVersion ? ' (model ' + modelVersion + ')' : '')
    );

    return { count: totalUpserted, durationSeconds };
  } catch (err: any) {
    const message = err?.message || String(err);
    await markStatus('epss', 'error', { errorMessage: message });
    console.error('[THREAT-INTEL] EPSS refresh failed: ' + message);
    throw err;
  }
}

async function upsertEpssBatch(
  batch: ParsedEpssRow[],
  modelVersion: string | null,
  scoredAt: string | null,
  syncBatchId: string
): Promise<number> {
  if (batch.length === 0) return 0;

  const values: any[] = [];
  const placeholders: string[] = [];
  for (let i = 0; i < batch.length; i++) {
    const e = batch[i];
    const base = i * 6;
    placeholders.push(
      '($' + (base + 1) + ', $' + (base + 2) + ', $' + (base + 3) + ', $' +
      (base + 4) + ', $' + (base + 5) + ', $' + (base + 6) + ')'
    );
    values.push(e.cve, e.score, e.percentile, modelVersion, scoredAt, syncBatchId);
  }

  await pool.query(
    'INSERT INTO vuln_db_epss (cve_id, score, percentile, model_version, scored_at, sync_batch_id) ' +
    'VALUES ' + placeholders.join(', ') + ' ' +
    'ON CONFLICT (cve_id) DO UPDATE SET ' +
    'score = EXCLUDED.score, percentile = EXCLUDED.percentile, ' +
    'model_version = EXCLUDED.model_version, scored_at = EXCLUDED.scored_at, ' +
    'sync_batch_id = EXCLUDED.sync_batch_id, ingested_at = NOW()',
    values
  );

  return batch.length;
}

// --- Orchestrator (called by scheduler) ---

export async function refreshThreatIntel(): Promise<void> {
  console.log('[THREAT-INTEL] ========== Starting threat-intel refresh ==========');
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    await refreshKev();
  } catch (err: any) {
    errors.push('kev: ' + (err?.message || err));
  }

  try {
    await refreshEpss();
  } catch (err: any) {
    errors.push('epss: ' + (err?.message || err));
  }

  const durationSeconds = (Date.now() - startTime) / 1000;
  console.log('[THREAT-INTEL] ========== Refresh complete in ' + durationSeconds.toFixed(1) + 's ==========');

  if (errors.length > 0) {
    const admins = await pool.query('SELECT id, org_id FROM users WHERE is_platform_admin = TRUE').catch(() => ({ rows: [] }));
    for (const admin of admins.rows) {
      await createNotification({
        orgId: admin.org_id,
        userId: admin.id,
        type: 'threat_intel_sync_error',
        severity: 'medium',
        title: 'Threat-intelligence refresh had errors',
        body: 'Failed sources: ' + errors.join('; '),
        link: '/admin/vuln-scan',
        metadata: { errors, durationSeconds },
      }).catch(() => {});
    }
  }
}

// --- Admin stats ---

export interface ThreatIntelStats {
  kev: {
    totalEntries: number;
    entriesAddedLast30Days: number;
    ransomwareLinkedEntries: number;
    overdueWithUnresolvedFindings: number;
    lastSyncAt: string | null;
    status: string;
    durationSeconds: number | null;
    errorMessage: string | null;
  };
  epss: {
    totalEntries: number;
    highRiskEntries: number;
    modelVersion: string | null;
    scoredAt: string | null;
    lastSyncAt: string | null;
    status: string;
    durationSeconds: number | null;
    errorMessage: string | null;
  };
}

export async function getThreatIntelStats(): Promise<ThreatIntelStats> {
  const [kevSync, epssSync, kevTotal, kevRecent, kevRansomware, epssTotal, epssHigh, epssMeta] = await Promise.all([
    pool.query("SELECT * FROM vuln_db_sync_status WHERE ecosystem = 'kev'"),
    pool.query("SELECT * FROM vuln_db_sync_status WHERE ecosystem = 'epss'"),
    pool.query('SELECT COUNT(*)::INT AS n FROM vuln_db_kev'),
    pool.query("SELECT COUNT(*)::INT AS n FROM vuln_db_kev WHERE date_added >= NOW() - INTERVAL '30 days'"),
    pool.query('SELECT COUNT(*)::INT AS n FROM vuln_db_kev WHERE known_ransomware_use = TRUE'),
    pool.query('SELECT COUNT(*)::INT AS n FROM vuln_db_epss'),
    pool.query('SELECT COUNT(*)::INT AS n FROM vuln_db_epss WHERE score >= 0.9'),
    pool.query('SELECT model_version, scored_at FROM vuln_db_epss ORDER BY scored_at DESC NULLS LAST LIMIT 1'),
  ]);

  const ks = kevSync.rows[0];
  const es = epssSync.rows[0];
  const epssMetaRow = epssMeta.rows[0];

  return {
    kev: {
      totalEntries: kevTotal.rows[0].n,
      entriesAddedLast30Days: kevRecent.rows[0].n,
      ransomwareLinkedEntries: kevRansomware.rows[0].n,
      overdueWithUnresolvedFindings: 0, // populated once finding-level enrichment lands in P10a-2
      lastSyncAt: ks?.last_sync_at ?? null,
      status: ks?.status ?? 'pending',
      durationSeconds: ks?.duration_seconds ? parseFloat(ks.duration_seconds) : null,
      errorMessage: ks?.error_message ?? null,
    },
    epss: {
      totalEntries: epssTotal.rows[0].n,
      highRiskEntries: epssHigh.rows[0].n,
      modelVersion: epssMetaRow?.model_version ?? null,
      scoredAt: epssMetaRow?.scored_at ?? null,
      lastSyncAt: es?.last_sync_at ?? null,
      status: es?.status ?? 'pending',
      durationSeconds: es?.duration_seconds ? parseFloat(es.duration_seconds) : null,
      errorMessage: es?.error_message ?? null,
    },
  };
}
