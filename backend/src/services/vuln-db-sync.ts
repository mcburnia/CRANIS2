import pool from '../db/pool.js';
import { createNotification } from './notifications.js';
import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import AdmZip from 'adm-zip';

// --- Constants ---

const OSV_BUCKET_URL = 'https://osv-vulnerabilities.storage.googleapis.com';

const ECOSYSTEMS = [
  'npm', 'PyPI', 'Maven', 'Go', 'NuGet',
  'crates.io', 'Packagist', 'RubyGems',
] as const;

type OSVEcosystem = typeof ECOSYSTEMS[number];

// NVD community feeds from fkie-cad (files are .json.xz compressed)
const NVD_FEEDS_BASE = 'https://github.com/fkie-cad/nvd-json-data-feeds/releases/latest/download';
const NVD_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

const UPSERT_BATCH_SIZE = 500;
const TEMP_DIR = '/tmp/cranis2-vuln-db';
const FULL_SYNC_INTERVAL_DAYS = 7;

// --- Interfaces ---

interface OSVAdvisory {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package: {
      ecosystem: string;
      name: string;
      purl?: string;
    };
    ranges?: Array<{
      type: string;
      events: Array<Record<string, string>>;
      repo?: string;
    }>;
    versions?: string[];
    database_specific?: Record<string, unknown>;
  }>;
  references?: Array<{ type: string; url: string }>;
  published?: string;
  modified?: string;
  withdrawn?: string;
  database_specific?: {
    severity?: string;
    [key: string]: unknown;
  };
}

interface ParsedAdvisoryRow {
  source: string;
  advisory_id: string;
  ecosystem: string;
  package_name: string;
  package_purl: string | null;
  severity: string | null;
  cvss_score: number | null;
  cvss_vector: string | null;
  title: string | null;
  description: string | null;
  affected_ranges: unknown[];
  affected_versions: string[];
  fixed_version: string | null;
  aliases: string[];
  references_json: unknown[];
  published_at: string | null;
  modified_at: string | null;
  withdrawn_at: string | null;
}

// --- OSV Parsing ---

function extractSeverityFromOSV(advisory: OSVAdvisory): { severity: string | null; cvssScore: number | null; cvssVector: string | null } {
  // Try database_specific.severity first
  const dbSeverity = advisory.database_specific?.severity;
  if (typeof dbSeverity === 'string') {
    return { severity: dbSeverity.toLowerCase(), cvssScore: null, cvssVector: null };
  }

  // Try CVSS from severity array
  if (advisory.severity && advisory.severity.length > 0) {
    for (const s of advisory.severity) {
      if ((s.type === 'CVSS_V3' || s.type === 'CVSS_V4') && s.score) {
        const vector = s.score;
        const numScore = extractCVSSNumericScore(vector);
        const severity = numScore !== null ? mapCVSStoSeverity(numScore) : 'medium';
        return { severity, cvssScore: numScore, cvssVector: vector };
      }
    }
  }

  return { severity: null, cvssScore: null, cvssVector: null };
}

function extractCVSSNumericScore(vector: string): number | null {
  if (!vector.startsWith('CVSS:3') && !vector.startsWith('CVSS:4')) return null;
  const parts = vector.split('/');
  let score = 0;
  for (const part of parts) {
    if (part.startsWith('AV:N')) score += 2;
    else if (part.startsWith('AV:A')) score += 1.5;
    if (part.startsWith('AC:L')) score += 1;
    if (part.startsWith('PR:N')) score += 1;
    if (part.startsWith('UI:N')) score += 0.5;
    if (part.startsWith('C:H')) score += 1.5;
    if (part.startsWith('I:H')) score += 1.5;
    if (part.startsWith('A:H')) score += 1.5;
  }
  return Math.min(Math.round(score * 10) / 10, 10.0);
}

function mapCVSStoSeverity(score: number | undefined | null): string {
  if (!score) return 'medium';
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

function extractFixedVersion(affected: NonNullable<OSVAdvisory['affected']>[0]): string | null {
  if (!affected?.ranges) return null;
  for (const range of affected.ranges) {
    if (range.events) {
      for (const event of range.events) {
        if (event.fixed) return event.fixed;
      }
    }
  }
  return null;
}

function parseOSVAdvisory(advisory: OSVAdvisory): ParsedAdvisoryRow[] {
  const rows: ParsedAdvisoryRow[] = [];
  if (!advisory.affected || advisory.affected.length === 0) return rows;

  const { severity, cvssScore, cvssVector } = extractSeverityFromOSV(advisory);
  const aliases = advisory.aliases || [];
  const refs = (advisory.references || []).map(r => ({ type: r.type, url: r.url }));
  const source = advisory.id.startsWith('GHSA-') ? 'github' : 'osv';

  for (const affected of advisory.affected) {
    if (!affected.package?.name || !affected.package?.ecosystem) continue;

    const fixedVersion = extractFixedVersion(affected);

    rows.push({
      source,
      advisory_id: advisory.id,
      ecosystem: affected.package.ecosystem,
      package_name: affected.package.name,
      package_purl: affected.package.purl || null,
      severity,
      cvss_score: cvssScore,
      cvss_vector: cvssVector,
      title: advisory.summary || advisory.id,
      description: (advisory.details || '').substring(0, 4000),
      affected_ranges: affected.ranges || [],
      affected_versions: affected.versions || [],
      fixed_version: fixedVersion,
      aliases,
      references_json: refs,
      published_at: advisory.published || null,
      modified_at: advisory.modified || null,
      withdrawn_at: advisory.withdrawn || null,
    });
  }

  return rows;
}

// --- Batch Upsert ---

function deduplicateRows(rows: ParsedAdvisoryRow[]): ParsedAdvisoryRow[] {
  // Deduplicate by unique key (source, advisory_id, ecosystem, package_name)
  // Merge affected_ranges and affected_versions from duplicates
  const map = new Map<string, ParsedAdvisoryRow>();

  for (const row of rows) {
    const key = row.source + '|' + row.advisory_id + '|' + row.ecosystem + '|' + row.package_name;
    const existing = map.get(key);
    if (existing) {
      // Merge ranges and versions from duplicate entry
      existing.affected_ranges = [...existing.affected_ranges, ...row.affected_ranges];
      existing.affected_versions = [...new Set([...existing.affected_versions, ...row.affected_versions])];
      // Keep the fixed_version if we didn't have one
      if (!existing.fixed_version && row.fixed_version) {
        existing.fixed_version = row.fixed_version;
      }
    } else {
      // Clone to avoid mutating the original
      map.set(key, { ...row, affected_ranges: [...row.affected_ranges], affected_versions: [...row.affected_versions] });
    }
  }

  return Array.from(map.values());
}

async function batchUpsertAdvisories(rows: ParsedAdvisoryRow[], syncBatchId: string): Promise<number> {
  if (rows.length === 0) return 0;

  // Deduplicate to prevent "ON CONFLICT DO UPDATE cannot affect row a second time"
  const dedupedRows = deduplicateRows(rows);
  let totalUpserted = 0;

  for (let i = 0; i < dedupedRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = dedupedRows.slice(i, i + UPSERT_BATCH_SIZE);

    // Build parameterized VALUES clause
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const row of batch) {
      placeholders.push(
        '(' + Array.from({ length: 21 }, () => '$' + (paramIndex++)).join(', ') + ')'
      );
      values.push(
        row.source, row.advisory_id, row.ecosystem, row.package_name, row.package_purl,
        row.severity, row.cvss_score, row.cvss_vector, row.title, row.description,
        JSON.stringify(row.affected_ranges), JSON.stringify(row.affected_versions),
        row.fixed_version, JSON.stringify(row.aliases), JSON.stringify(row.references_json),
        row.published_at, row.modified_at, row.withdrawn_at,
        syncBatchId,
        new Date().toISOString(), new Date().toISOString()
      );
    }

    const sql = 'INSERT INTO vuln_db_advisories ' +
      '(source, advisory_id, ecosystem, package_name, package_purl, ' +
      'severity, cvss_score, cvss_vector, title, description, ' +
      'affected_ranges, affected_versions, fixed_version, aliases, references_json, ' +
      'published_at, modified_at, withdrawn_at, sync_batch_id, created_at, updated_at) ' +
      'VALUES ' + placeholders.join(', ') + ' ' +
      'ON CONFLICT (source, advisory_id, ecosystem, package_name) DO UPDATE SET ' +
      'severity = EXCLUDED.severity, cvss_score = EXCLUDED.cvss_score, ' +
      'cvss_vector = EXCLUDED.cvss_vector, title = EXCLUDED.title, ' +
      'description = EXCLUDED.description, affected_ranges = EXCLUDED.affected_ranges, ' +
      'affected_versions = EXCLUDED.affected_versions, fixed_version = EXCLUDED.fixed_version, ' +
      'aliases = EXCLUDED.aliases, references_json = EXCLUDED.references_json, ' +
      'modified_at = EXCLUDED.modified_at, withdrawn_at = EXCLUDED.withdrawn_at, ' +
      'sync_batch_id = EXCLUDED.sync_batch_id, updated_at = NOW()';

    await pool.query(sql, values);
    totalUpserted += batch.length;
  }

  return totalUpserted;
}

// --- OSV Ecosystem Sync ---

async function fullSyncOSVEcosystem(ecosystem: OSVEcosystem, syncBatchId: string): Promise<{ advisoryCount: number; packageNames: Set<string>; latestModified: Date | null }> {
  const zipUrl = OSV_BUCKET_URL + '/' + ecosystem + '/all.zip';
  console.log('[VULN-DB] Downloading ' + zipUrl);

  // Ensure temp dirs exist
  const ecoDir = join(TEMP_DIR, ecosystem);
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
  if (existsSync(ecoDir)) rmSync(ecoDir, { recursive: true });
  mkdirSync(ecoDir, { recursive: true });
  const zipPath = join(TEMP_DIR, ecosystem + '-all.zip');

  // Download ZIP to disk
  const resp = await fetch(zipUrl);
  if (!resp.ok) throw new Error('Failed to download ' + zipUrl + ': ' + resp.status);

  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(zipPath, buffer);
  const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  console.log('[VULN-DB] Downloaded ' + ecosystem + ' (' + fileSizeMB + 'MB), extracting...');

  // Extract using native unzip (fast, low memory)
  execSync('unzip -q -o ' + zipPath + ' -d ' + ecoDir, { timeout: 300000 });
  console.log('[VULN-DB] Extracted ' + ecosystem + ', processing JSON files...');

  // Remove ZIP to free disk space
  try { rmSync(zipPath); } catch { /* ignore */ }

  // Process JSON files one by one
  const files = readdirSync(ecoDir).filter(f => f.endsWith('.json'));
  const packageNames = new Set<string>();
  let latestModified: Date | null = null;
  let parsedCount = 0;
  let batchRows: ParsedAdvisoryRow[] = [];
  let totalUpserted = 0;

  let errorCount = 0;

  for (const file of files) {
    try {
      const jsonStr = readFileSync(join(ecoDir, file), 'utf8');
      const advisory = JSON.parse(jsonStr) as OSVAdvisory;
      const rows = parseOSVAdvisory(advisory);

      for (const row of rows) {
        packageNames.add(row.package_name);
        if (row.modified_at) {
          const modDate = new Date(row.modified_at);
          if (!latestModified || modDate > latestModified) {
            latestModified = modDate;
          }
        }
        batchRows.push(row);
      }

      parsedCount++;

      // Flush batch to Postgres
      if (batchRows.length >= UPSERT_BATCH_SIZE) {
        totalUpserted += await batchUpsertAdvisories(batchRows, syncBatchId);
        batchRows = [];
      }

      if (parsedCount % 2000 === 0) {
        console.log('[VULN-DB] ' + ecosystem + ': parsed ' + parsedCount + '/' + files.length + ' advisories, upserted ' + totalUpserted + ' rows');
      }
    } catch (err: any) {
      errorCount++;
      if (errorCount <= 5) {
        console.error('[VULN-DB] Error processing ' + file + ': ' + (err.message || err));
      }
      // On batch upsert errors, clear the batch to avoid infinite retries
      batchRows = [];
    }
  }

  // Flush remaining rows
  if (batchRows.length > 0) {
    totalUpserted += await batchUpsertAdvisories(batchRows, syncBatchId);
  }

  console.log('[VULN-DB] ' + ecosystem + ': parsed ' + parsedCount + ' advisories, upserted ' + totalUpserted + ' rows total');

  // Clean up stale rows not in this batch
  const deleteResult = await pool.query(
    'DELETE FROM vuln_db_advisories WHERE ecosystem = $1 AND sync_batch_id != $2',
    [ecosystem, syncBatchId]
  );
  if (deleteResult.rowCount && deleteResult.rowCount > 0) {
    console.log('[VULN-DB] ' + ecosystem + ': cleaned up ' + deleteResult.rowCount + ' stale rows');
  }

  // Clean up temp directory
  try { rmSync(ecoDir, { recursive: true }); } catch { /* ignore */ }

  return { advisoryCount: parsedCount, packageNames, latestModified };
}

async function incrementalSyncOSVEcosystem(ecosystem: OSVEcosystem, lastMarker: Date, syncBatchId: string): Promise<{ advisoryCount: number; packageNames: Set<string>; latestModified: Date | null }> {
  const csvUrl = OSV_BUCKET_URL + '/' + ecosystem + '/modified_id.csv';
  console.log('[VULN-DB] Fetching incremental changes: ' + csvUrl);

  const resp = await fetch(csvUrl);
  if (!resp.ok) throw new Error('Failed to fetch ' + csvUrl + ': ' + resp.status);

  const csvText = await resp.text();
  const lines = csvText.trim().split('\n');

  // Parse CSV: each line is "ISO_DATE,advisory_id"
  const modifiedIds: string[] = [];
  let latestModified: Date | null = null;

  for (const line of lines) {
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const dateStr = line.substring(0, commaIdx).trim();
    const advisoryId = line.substring(commaIdx + 1).trim();
    const date = new Date(dateStr);

    if (date <= lastMarker) break; // CSV is reverse-chronological
    modifiedIds.push(advisoryId);
    if (!latestModified || date > latestModified) latestModified = date;
  }

  console.log('[VULN-DB] ' + ecosystem + ': ' + modifiedIds.length + ' modified advisories since ' + lastMarker.toISOString());

  if (modifiedIds.length === 0) {
    return { advisoryCount: 0, packageNames: new Set(), latestModified: null };
  }

  // Fetch individual advisory JSONs (throttled to 10 concurrent)
  const allRows: ParsedAdvisoryRow[] = [];
  const packageNames = new Set<string>();
  const concurrencyLimit = 10;

  for (let i = 0; i < modifiedIds.length; i += concurrencyLimit) {
    const batch = modifiedIds.slice(i, i + concurrencyLimit);
    const promises = batch.map(async (id) => {
      try {
        const url = OSV_BUCKET_URL + '/' + ecosystem + '/' + id + '.json';
        const r = await fetch(url);
        if (!r.ok) return;
        const advisory = await r.json() as OSVAdvisory;
        return parseOSVAdvisory(advisory);
      } catch {
        return undefined;
      }
    });

    const results = await Promise.all(promises);
    for (const rows of results) {
      if (rows) {
        allRows.push(...rows);
        for (const row of rows) packageNames.add(row.package_name);
      }
    }
  }

  // Upsert (with sync_batch_id for rows we touched)
  const upserted = await batchUpsertAdvisories(allRows, syncBatchId);
  console.log('[VULN-DB] ' + ecosystem + ': upserted ' + upserted + ' incremental rows');

  // Update sync_batch_id on ALL existing rows for this ecosystem (so they survive weekly cleanup)
  await pool.query(
    'UPDATE vuln_db_advisories SET sync_batch_id = $1 WHERE ecosystem = $2 AND sync_batch_id != $1',
    [syncBatchId, ecosystem]
  );

  return { advisoryCount: modifiedIds.length, packageNames, latestModified };
}

async function syncOSVEcosystem(ecosystem: OSVEcosystem): Promise<{ advisoryCount: number; packageCount: number }> {
  console.log('[VULN-DB] Syncing ecosystem: ' + ecosystem);
  const startTime = Date.now();
  const syncBatchId = randomUUID();

  // Check existing sync status
  const statusResult = await pool.query(
    'SELECT last_modified_marker, last_full_sync_at FROM vuln_db_sync_status WHERE ecosystem = $1',
    [ecosystem]
  );
  const lastMarker = statusResult.rows[0]?.last_modified_marker
    ? new Date(statusResult.rows[0].last_modified_marker)
    : null;
  const lastFullSync = statusResult.rows[0]?.last_full_sync_at
    ? new Date(statusResult.rows[0].last_full_sync_at)
    : null;

  // Determine if we need a full sync
  const daysSinceFullSync = lastFullSync
    ? (Date.now() - lastFullSync.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const needsFullSync = !lastMarker || daysSinceFullSync >= FULL_SYNC_INTERVAL_DAYS;

  // Mark as running
  await pool.query(
    "INSERT INTO vuln_db_sync_status (ecosystem, status, updated_at) VALUES ($1, 'running', NOW()) " +
    "ON CONFLICT (ecosystem) DO UPDATE SET status = 'running', updated_at = NOW()",
    [ecosystem]
  );

  let advisoryCount = 0;
  let packageNames = new Set<string>();
  let latestModified: Date | null = null;

  if (needsFullSync) {
    console.log('[VULN-DB] ' + ecosystem + ': performing FULL sync' + (lastFullSync ? ' (last full: ' + daysSinceFullSync.toFixed(1) + ' days ago)' : ' (first sync)'));
    const result = await fullSyncOSVEcosystem(ecosystem, syncBatchId);
    advisoryCount = result.advisoryCount;
    packageNames = result.packageNames;
    latestModified = result.latestModified;
  } else {
    console.log('[VULN-DB] ' + ecosystem + ': performing incremental sync (last modified: ' + lastMarker!.toISOString() + ')');
    const result = await incrementalSyncOSVEcosystem(ecosystem, lastMarker!, syncBatchId);
    advisoryCount = result.advisoryCount;
    packageNames = result.packageNames;
    latestModified = result.latestModified || lastMarker;
  }

  const durationSeconds = (Date.now() - startTime) / 1000;

  // Get actual counts from DB
  const countResult = await pool.query(
    'SELECT COUNT(*) as total, COUNT(DISTINCT package_name) as packages FROM vuln_db_advisories WHERE ecosystem = $1',
    [ecosystem]
  );
  const totalAdvisories = parseInt(countResult.rows[0].total, 10);
  const totalPackages = parseInt(countResult.rows[0].packages, 10);

  // Update sync status
  await pool.query(
    "UPDATE vuln_db_sync_status SET status = 'completed', last_sync_at = NOW(), " +
    'last_modified_marker = COALESCE($2, last_modified_marker), ' +
    (needsFullSync ? 'last_full_sync_at = NOW(), ' : '') +
    'advisory_count = $3, package_count = $4, duration_seconds = $5, error_message = NULL, updated_at = NOW() ' +
    'WHERE ecosystem = $1',
    [ecosystem, latestModified?.toISOString() || null, totalAdvisories, totalPackages, durationSeconds.toFixed(2)]
  );

  console.log('[VULN-DB] ' + ecosystem + ': done in ' + durationSeconds.toFixed(1) + 's — ' + totalAdvisories + ' advisories, ' + totalPackages + ' packages');
  return { advisoryCount: totalAdvisories, packageCount: totalPackages };
}

// --- NVD Sync ---

interface NVDCVEItem {
  id: string;
  descriptions?: Array<{ lang: string; value: string }>;
  metrics?: {
    cvssMetricV31?: Array<{ cvssData: { baseScore: number; baseSeverity: string; vectorString: string } }>;
    cvssMetricV30?: Array<{ cvssData: { baseScore: number; baseSeverity: string; vectorString: string } }>;
    cvssMetricV2?: Array<{ cvssData: { baseScore: number; baseSeverity?: string; vectorString?: string } }>;
  };
  configurations?: Array<{
    nodes: Array<{
      cpeMatch: Array<{
        vulnerable: boolean;
        criteria: string;
        versionStartIncluding?: string;
        versionEndExcluding?: string;
        versionEndIncluding?: string;
      }>;
    }>;
  }>;
  references?: Array<{ url: string; source?: string }>;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
}

async function batchUpsertNVD(items: NVDCVEItem[], syncBatchId: string): Promise<number> {
  if (items.length === 0) return 0;
  let totalUpserted = 0;

  for (let i = 0; i < items.length; i += UPSERT_BATCH_SIZE) {
    const batch = items.slice(i, i + UPSERT_BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const item of batch) {
      if (!item?.id) continue;

      // Skip REJECTED CVEs
      if (item.vulnStatus === 'Rejected') continue;

      const description = item.descriptions?.find(d => d.lang === 'en')?.value || '';
      const cvssData = item.metrics?.cvssMetricV31?.[0]?.cvssData ||
                       item.metrics?.cvssMetricV30?.[0]?.cvssData;
      const cvssV2 = item.metrics?.cvssMetricV2?.[0]?.cvssData;

      const severity = cvssData?.baseSeverity?.toLowerCase() ||
                       (cvssV2?.baseScore ? mapCVSStoSeverity(cvssV2.baseScore) : null);
      const cvssScore = cvssData?.baseScore || cvssV2?.baseScore || null;
      const cvssVector = cvssData?.vectorString || cvssV2?.vectorString || null;

      // Extract CPE matches for version range info
      const cpeMatches: unknown[] = [];
      const versionParts: string[] = [];
      for (const config of item.configurations || []) {
        for (const node of config.nodes || []) {
          for (const match of node.cpeMatch || []) {
            if (match.vulnerable) {
              cpeMatches.push(match);
              const parts: string[] = [];
              if (match.versionStartIncluding) parts.push('>= ' + match.versionStartIncluding);
              if (match.versionEndExcluding) parts.push('< ' + match.versionEndExcluding);
              if (match.versionEndIncluding) parts.push('<= ' + match.versionEndIncluding);
              if (parts.length > 0) versionParts.push(parts.join(' '));
            }
          }
        }
      }

      // Extract fix version from references
      let fixedVersion = '';
      const refs = (item.references || []).map(r => ({ url: r.url, source: r.source }));
      for (const ref of refs) {
        const tagMatch = ref.url.match(/\/releases\/tag\/v?(\d+\.\d+\.\d+[\w.-]*)/);
        if (tagMatch) { fixedVersion = tagMatch[1]; break; }
      }

      placeholders.push(
        '(' + Array.from({ length: 16 }, () => '$' + (paramIndex++)).join(', ') + ')'
      );
      values.push(
        item.id, description, severity, cvssScore, cvssVector,
        JSON.stringify(cvssData || cvssV2 || {}),
        JSON.stringify(cpeMatches), JSON.stringify(refs),
        versionParts.join(' | '), fixedVersion || null,
        item.published || null, item.lastModified || null,
        item.vulnStatus || null, syncBatchId,
        new Date().toISOString(), new Date().toISOString()
      );
    }

    if (placeholders.length === 0) continue;

    const sql = 'INSERT INTO vuln_db_nvd ' +
      '(cve_id, description, severity, cvss_score, cvss_vector, cvss_data, ' +
      'cpe_matches, references_json, affected_versions, fixed_version, ' +
      'published_at, modified_at, vuln_status, sync_batch_id, created_at, updated_at) ' +
      'VALUES ' + placeholders.join(', ') + ' ' +
      'ON CONFLICT (cve_id) DO UPDATE SET ' +
      'description = EXCLUDED.description, severity = EXCLUDED.severity, ' +
      'cvss_score = EXCLUDED.cvss_score, cvss_vector = EXCLUDED.cvss_vector, ' +
      'cvss_data = EXCLUDED.cvss_data, cpe_matches = EXCLUDED.cpe_matches, ' +
      'references_json = EXCLUDED.references_json, affected_versions = EXCLUDED.affected_versions, ' +
      'fixed_version = EXCLUDED.fixed_version, modified_at = EXCLUDED.modified_at, ' +
      'vuln_status = EXCLUDED.vuln_status, sync_batch_id = EXCLUDED.sync_batch_id, updated_at = NOW()';

    await pool.query(sql, values);
    totalUpserted += placeholders.length;
  }

  return totalUpserted;
}

async function downloadAndProcessNVDFeed(feedName: string, nvdDir: string, syncBatchId: string): Promise<number> {
  const xzUrl = NVD_FEEDS_BASE + '/' + feedName + '.json.xz';
  console.log('[VULN-DB] NVD: downloading ' + feedName + '.json.xz ...');

  const resp = await fetch(xzUrl, { redirect: 'follow' });
  if (!resp.ok) {
    console.error('[VULN-DB] NVD: failed to download ' + feedName + ': ' + resp.status);
    return 0;
  }

  // Save compressed file to disk
  const xzPath = join(nvdDir, feedName + '.json.xz');
  const jsonPath = join(nvdDir, feedName + '.json');
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(xzPath, buffer);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  console.log('[VULN-DB] NVD: downloaded ' + feedName + ' (' + sizeMB + 'MB), decompressing...');

  // Decompress using native xz command
  execSync('xz -d -f ' + xzPath, { timeout: 300000 });

  // Read and parse JSON
  const jsonStr = readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(jsonStr) as { cve_items?: NVDCVEItem[]; vulnerabilities?: NVDCVEItem[] };

  // Clean up JSON file
  try { rmSync(jsonPath); } catch { /* ignore */ }

  // Support both fkie-cad format (cve_items) and NVD API format (vulnerabilities)
  const items = data.cve_items || data.vulnerabilities || [];
  if (items.length === 0) {
    console.log('[VULN-DB] NVD ' + feedName + ': no vulnerabilities found');
    return 0;
  }

  const upserted = await batchUpsertNVD(items, syncBatchId);
  console.log('[VULN-DB] NVD ' + feedName + ': ' + upserted + ' CVEs upserted (of ' + items.length + ' entries)');
  return upserted;
}

async function syncNVDData(): Promise<{ cveCount: number }> {
  console.log('[VULN-DB] Starting NVD sync...');
  const startTime = Date.now();
  const syncBatchId = randomUUID();

  // Check sync status
  const statusResult = await pool.query(
    "SELECT last_sync_at, last_full_sync_at FROM vuln_db_sync_status WHERE ecosystem = 'nvd'"
  );
  const lastSync = statusResult.rows[0]?.last_sync_at
    ? new Date(statusResult.rows[0].last_sync_at)
    : null;
  const lastFullSync = statusResult.rows[0]?.last_full_sync_at
    ? new Date(statusResult.rows[0].last_full_sync_at)
    : null;

  const daysSinceFullSync = lastFullSync
    ? (Date.now() - lastFullSync.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  const needsFullSync = !lastSync || daysSinceFullSync >= FULL_SYNC_INTERVAL_DAYS;

  // Mark as running
  await pool.query(
    "INSERT INTO vuln_db_sync_status (ecosystem, status, updated_at) VALUES ('nvd', 'running', NOW()) " +
    "ON CONFLICT (ecosystem) DO UPDATE SET status = 'running', updated_at = NOW()"
  );

  let totalUpserted = 0;

  try {
    // Ensure NVD temp dir exists
    const nvdDir = join(TEMP_DIR, 'nvd');
    if (!existsSync(nvdDir)) mkdirSync(nvdDir, { recursive: true });

    if (needsFullSync) {
      console.log('[VULN-DB] NVD: performing FULL sync (years ' + NVD_YEARS[0] + '-' + NVD_YEARS[NVD_YEARS.length - 1] + ')');

      for (const year of NVD_YEARS) {
        try {
          const upserted = await downloadAndProcessNVDFeed('CVE-' + year, nvdDir, syncBatchId);
          totalUpserted += upserted;
        } catch (err: any) {
          console.error('[VULN-DB] NVD CVE-' + year + ' error:', err.message);
        }
      }

      // Clean up stale CVEs not in this batch
      const deleteResult = await pool.query(
        "DELETE FROM vuln_db_nvd WHERE sync_batch_id != $1",
        [syncBatchId]
      );
      if (deleteResult.rowCount && deleteResult.rowCount > 0) {
        console.log('[VULN-DB] NVD: cleaned up ' + deleteResult.rowCount + ' stale CVEs');
      }

    } else {
      // Incremental: fetch Modified + Recent
      for (const feedName of ['CVE-Modified', 'CVE-Recent']) {
        try {
          const upserted = await downloadAndProcessNVDFeed(feedName, nvdDir, syncBatchId);
          totalUpserted += upserted;
        } catch (err: any) {
          console.error('[VULN-DB] NVD ' + feedName + ' error:', err.message);
        }
      }

      // For incremental, update sync_batch_id on ALL existing NVD rows
      await pool.query(
        "UPDATE vuln_db_nvd SET sync_batch_id = $1 WHERE sync_batch_id != $1",
        [syncBatchId]
      );
    }

    // Clean up NVD temp dir
    try { rmSync(nvdDir, { recursive: true }); } catch { /* ignore */ }

    // Update full-text search vector
    await pool.query(
      "UPDATE vuln_db_nvd SET description_tsv = to_tsvector('english', COALESCE(description, '')) WHERE description_tsv IS NULL"
    );

    // Rebuild flattened CPE index for fast vulnerability scanning
    console.log('[VULN-DB] NVD: rebuilding CPE index...');
    await pool.query("TRUNCATE vuln_db_nvd_cpe_index");
    await pool.query(`
      INSERT INTO vuln_db_nvd_cpe_index (cve_id, vendor, product, target_sw, version_exact, version_start_incl, version_start_excl, version_end_incl, version_end_excl)
      SELECT
        n.cve_id,
        split_part(m->>'criteria', ':', 4) as vendor,
        lower(replace(split_part(m->>'criteria', ':', 5), E'\\\\', '')) as product,
        lower(replace(split_part(m->>'criteria', ':', 11), E'\\\\', '')) as target_sw,
        CASE WHEN split_part(m->>'criteria', ':', 6) != '*' THEN split_part(m->>'criteria', ':', 6) END as version_exact,
        m->>'versionStartIncluding' as version_start_incl,
        m->>'versionStartExcluding' as version_start_excl,
        m->>'versionEndIncluding' as version_end_incl,
        m->>'versionEndExcluding' as version_end_excl
      FROM vuln_db_nvd n,
           jsonb_array_elements(n.cpe_matches) AS m
      WHERE jsonb_array_length(n.cpe_matches) > 0
        AND (m->>'vulnerable')::boolean = true
    `);

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM vuln_db_nvd');
    const cveCount = parseInt(countResult.rows[0].total, 10);
    const durationSeconds = (Date.now() - startTime) / 1000;

    // Update sync status
    await pool.query(
      "UPDATE vuln_db_sync_status SET status = 'completed', last_sync_at = NOW(), " +
      (needsFullSync ? "last_full_sync_at = NOW(), " : '') +
      "advisory_count = $1, duration_seconds = $2, error_message = NULL, updated_at = NOW() " +
      "WHERE ecosystem = 'nvd'",
      [cveCount, durationSeconds.toFixed(2)]
    );

    console.log('[VULN-DB] NVD: done in ' + durationSeconds.toFixed(1) + 's — ' + cveCount + ' CVEs total, ' + totalUpserted + ' upserted this run');
    return { cveCount };

  } catch (err: any) {
    const durationSeconds = (Date.now() - startTime) / 1000;
    await pool.query(
      "UPDATE vuln_db_sync_status SET status = 'error', error_message = $1, duration_seconds = $2, updated_at = NOW() WHERE ecosystem = 'nvd'",
      [err.message, durationSeconds.toFixed(2)]
    ).catch(() => {});
    throw err;
  }
}

// --- Top-level orchestrator ---

export async function syncVulnDatabases(): Promise<void> {
  console.log('[VULN-DB] ========== Starting vulnerability database sync ==========');
  const startTime = Date.now();
  const errors: string[] = [];

  // 1. Sync OSV ecosystems
  for (const ecosystem of ECOSYSTEMS) {
    try {
      await syncOSVEcosystem(ecosystem);
    } catch (err: any) {
      console.error('[VULN-DB] Error syncing ' + ecosystem + ':', err.message);
      errors.push(ecosystem + ': ' + err.message);
      await pool.query(
        "UPDATE vuln_db_sync_status SET status = 'error', error_message = $2, updated_at = NOW() WHERE ecosystem = $1",
        [ecosystem, err.message]
      ).catch(() => {});
    }
  }

  // 2. Sync NVD
  try {
    await syncNVDData();
  } catch (err: any) {
    console.error('[VULN-DB] Error syncing NVD:', err.message);
    errors.push('nvd: ' + err.message);
  }

  const durationSeconds = (Date.now() - startTime) / 1000;
  console.log('[VULN-DB] ========== Sync complete in ' + durationSeconds.toFixed(1) + 's ==========');

  // Notify admins on errors
  if (errors.length > 0) {
    const admins = await pool.query('SELECT id, org_id FROM users WHERE is_platform_admin = TRUE');
    for (const admin of admins.rows) {
      await createNotification({
        orgId: admin.org_id,
        userId: admin.id,
        type: 'vuln_db_sync_error',
        severity: 'medium',
        title: 'Vulnerability database sync had errors',
        body: 'Failed sources: ' + errors.join('; '),
        link: '/admin/vuln-scan',
        metadata: { errors, durationSeconds },
      }).catch(() => {});
    }
  }
}

// --- Admin stats ---

export interface VulnDbStats {
  ecosystems: Array<{
    ecosystem: string;
    advisoryCount: number;
    packageCount: number;
    lastSyncAt: string | null;
    lastFullSyncAt: string | null;
    status: string;
    durationSeconds: number | null;
    errorMessage: string | null;
  }>;
  totalAdvisories: number;
  totalCVEs: number;
}

export async function getVulnDbStats(): Promise<VulnDbStats> {
  const result = await pool.query(
    'SELECT ecosystem, advisory_count, package_count, last_sync_at, last_full_sync_at, status, duration_seconds, error_message ' +
    'FROM vuln_db_sync_status ORDER BY ecosystem'
  );

  const ecosystems = result.rows.map((r: any) => ({
    ecosystem: r.ecosystem,
    advisoryCount: r.advisory_count || 0,
    packageCount: r.package_count || 0,
    lastSyncAt: r.last_sync_at,
    lastFullSyncAt: r.last_full_sync_at,
    status: r.status,
    durationSeconds: r.duration_seconds ? parseFloat(r.duration_seconds) : null,
    errorMessage: r.error_message,
  }));

  const nvdEntry = ecosystems.find(e => e.ecosystem === 'nvd');
  const osvEntries = ecosystems.filter(e => e.ecosystem !== 'nvd');

  return {
    ecosystems,
    totalAdvisories: osvEntries.reduce((sum, e) => sum + e.advisoryCount, 0),
    totalCVEs: nvdEntry?.advisoryCount || 0,
  };
}
