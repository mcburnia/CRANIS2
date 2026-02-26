import crypto from "crypto";
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { generateCycloneDX } from './sbom-service.js';
import { createNotification } from './notifications.js';

const FORGEJO_URL = process.env.FORGEJO_URL || 'http://forgejo:3000';
const FORGEJO_TOKEN = process.env.FORGEJO_ADMIN_TOKEN || '';

// ─── Forgejo API helpers ─────────────────────────────────────────────

async function forgejoApi(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${FORGEJO_URL}/api/v1${path}`, {
    method,
    headers: {
      'Authorization': `token ${FORGEJO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // 409 = already exists (org or repo), treat as success
    if (res.status === 409) return null;
    throw new Error(`Forgejo API ${method} ${path}: ${res.status} ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return null;
}

async function ensureForgejoOrg(orgName: string, displayName: string): Promise<void> {
  await forgejoApi('POST', '/orgs', {
    username: orgName,
    full_name: displayName,
    visibility: 'private',
  });
}

async function ensureForgejoRepo(orgName: string, repoName: string): Promise<void> {
  await forgejoApi('POST', `/orgs/${orgName}/repos`, {
    name: repoName,
    private: true,
    auto_init: true,
    default_branch: 'main',
    description: 'CRANIS2 Compliance Escrow — automated CRA artifact deposits',
  });
}

async function getFileSha(org: string, repo: string, path: string): Promise<string | null> {
  try {
    const data = await forgejoApi('GET', `/repos/${org}/${repo}/contents/${path}`);
    return data?.sha || null;
  } catch {
    return null;
  }
}

async function pushFile(
  org: string, repo: string, filePath: string,
  content: string, message: string
): Promise<string | null> {
  const b64 = Buffer.from(content, 'utf-8').toString('base64');
  const sha = await getFileSha(org, repo, filePath);

  const body: any = { content: b64, message };
  if (sha) body.sha = sha; // update existing file

  const method = sha ? 'PUT' : 'POST';
  const data = await forgejoApi(method, `/repos/${org}/${repo}/contents/${filePath}`, body);
  return data?.content?.sha || null;
}

// ─── Slug helpers ────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ─── Setup ───────────────────────────────────────────────────────────

export async function setupProductEscrow(
  orgId: string, productId: string,
  orgDisplayName: string, productName: string
): Promise<{ forgejoOrg: string; forgejoRepo: string }> {
  const forgejoOrg = slugify(orgDisplayName);
  const forgejoRepo = `${slugify(productName)}-escrow`;

  // Create Forgejo org + repo
  await ensureForgejoOrg(forgejoOrg, orgDisplayName);
  await ensureForgejoRepo(forgejoOrg, forgejoRepo);

  // Upsert escrow config
  await pool.query(
    `INSERT INTO escrow_configs (org_id, product_id, forgejo_org, forgejo_repo, setup_completed, enabled)
     VALUES ($1, $2, $3, $4, true, true)
     ON CONFLICT (product_id) DO UPDATE SET
       forgejo_org = $3, forgejo_repo = $4, setup_completed = true,
       enabled = true, updated_at = NOW()`,
    [orgId, productId, forgejoOrg, forgejoRepo]
  );

  return { forgejoOrg, forgejoRepo };
}

// ─── Artifact collection ─────────────────────────────────────────────

interface EscrowConfig {
  id: string;
  org_id: string;
  product_id: string;
  forgejo_org: string;
  forgejo_repo: string;
  include_sbom_cyclonedx: boolean;
  include_sbom_spdx: boolean;
  include_vuln_report: boolean;
  include_license_audit: boolean;
  include_ip_proof: boolean;
  include_cra_docs: boolean;
  include_timeline: boolean;
}

async function collectArtifacts(
  orgId: string, productId: string, config: EscrowConfig
): Promise<Map<string, string>> {
  const artifacts = new Map<string, string>();
  const included: string[] = [];

  // SBOM CycloneDX
  if (config.include_sbom_cyclonedx) {
    try {
      const { cyclonedx } = await generateCycloneDX(orgId, productId);
      artifacts.set('sbom/sbom-cyclonedx.json', JSON.stringify(cyclonedx, null, 2));
      included.push('sbom-cyclonedx');
    } catch (err) {
      console.error(`[ESCROW] CycloneDX SBOM failed for ${productId}:`, err);
    }
  }

  // SBOM SPDX
  if (config.include_sbom_spdx) {
    try {
      const result = await pool.query(
        'SELECT spdx_json FROM product_sboms WHERE product_id = $1 ORDER BY synced_at DESC LIMIT 1',
        [productId]
      );
      if (result.rows[0]?.spdx_json) {
        artifacts.set('sbom/sbom-spdx.json', JSON.stringify(result.rows[0].spdx_json, null, 2));
        included.push('sbom-spdx');
      }
    } catch (err) {
      console.error(`[ESCROW] SPDX SBOM failed for ${productId}:`, err);
    }
  }

  // Vulnerability report
  if (config.include_vuln_report) {
    try {
      const scan = await pool.query(
        `SELECT id, completed_at, findings_count, critical_count, high_count, medium_count, low_count
         FROM vulnerability_scans WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [productId, orgId]
      );
      if (scan.rows[0]) {
        const findings = await pool.query(
          `SELECT source, source_id, severity, cvss_score, title, status,
                  dependency_name, dependency_version, fixed_version
           FROM vulnerability_findings
           WHERE product_id = $1 AND org_id = $2 AND status != 'auto_resolved'
           ORDER BY severity, dependency_name`,
          [productId, orgId]
        );
        artifacts.set('vulnerability-report/latest-scan.json', JSON.stringify({
          scanId: scan.rows[0].id,
          completedAt: scan.rows[0].completed_at,
          summary: {
            total: scan.rows[0].findings_count,
            critical: scan.rows[0].critical_count,
            high: scan.rows[0].high_count,
            medium: scan.rows[0].medium_count,
            low: scan.rows[0].low_count,
          },
          findings: findings.rows,
        }, null, 2));
        included.push('vuln-report');
      }
    } catch (err) {
      console.error(`[ESCROW] Vulnerability report failed for ${productId}:`, err);
    }
  }

  // License audit
  if (config.include_license_audit) {
    try {
      const scan = await pool.query(
        `SELECT id, completed_at, total_deps, permissive_count, copyleft_count, unknown_count, critical_count
         FROM license_scans WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [productId, orgId]
      );
      if (scan.rows[0]) {
        const findings = await pool.query(
          `SELECT dependency_name, dependency_version, license_declared,
                  license_category, risk_level, status, compatibility_verdict
           FROM license_findings
           WHERE product_id = $1 AND org_id = $2
           ORDER BY risk_level DESC, dependency_name`,
          [productId, orgId]
        );
        artifacts.set('license-audit/license-scan.json', JSON.stringify({
          scanId: scan.rows[0].id,
          completedAt: scan.rows[0].completed_at,
          summary: {
            totalDeps: scan.rows[0].total_deps,
            permissive: scan.rows[0].permissive_count,
            copyleft: scan.rows[0].copyleft_count,
            unknown: scan.rows[0].unknown_count,
            critical: scan.rows[0].critical_count,
          },
          findings: findings.rows,
        }, null, 2));
        included.push('license-audit');
      }
    } catch (err) {
      console.error(`[ESCROW] License audit failed for ${productId}:`, err);
    }
  }

  // IP proof
  if (config.include_ip_proof) {
    try {
      const result = await pool.query(
        `SELECT id, snapshot_type, content_hash, content_summary, verified, created_at
         FROM ip_proof_snapshots WHERE product_id = $1 AND org_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [productId, orgId]
      );
      if (result.rows[0]) {
        artifacts.set('ip-proof/latest-snapshot.json', JSON.stringify({
          snapshotId: result.rows[0].id,
          snapshotType: result.rows[0].snapshot_type,
          contentHash: result.rows[0].content_hash,
          contentSummary: result.rows[0].content_summary,
          verified: result.rows[0].verified,
          createdAt: result.rows[0].created_at,
        }, null, 2));
        included.push('ip-proof');
      }
    } catch (err) {
      console.error(`[ESCROW] IP proof failed for ${productId}:`, err);
    }
  }

  // CRA documentation
  if (config.include_cra_docs) {
    try {
      const obligations = await pool.query(
        'SELECT key, status FROM obligations WHERE org_id = $1 AND product_id = $2',
        [orgId, productId]
      );
      const reports = await pool.query(
        `SELECT id, report_type, status, created_at FROM cra_reports
         WHERE product_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
        [productId, orgId]
      );
      artifacts.set('cra-documentation/conformity-checklist.json', JSON.stringify({
        generatedAt: new Date().toISOString(),
        obligations: obligations.rows,
        reports: reports.rows,
      }, null, 2));
      included.push('cra-docs');
    } catch (err) {
      console.error(`[ESCROW] CRA docs failed for ${productId}:`, err);
    }
  }

  // Compliance timeline
  if (config.include_timeline) {
    try {
      const [vulnScans, licenseScans, versions] = await Promise.all([
        pool.query(
          `SELECT completed_at, findings_count, critical_count, high_count, medium_count, low_count
           FROM vulnerability_scans WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
           ORDER BY completed_at ASC`,
          [productId, orgId]
        ),
        pool.query(
          `SELECT completed_at, total_deps, permissive_count, copyleft_count, unknown_count
           FROM license_scans WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
           ORDER BY completed_at ASC`,
          [productId, orgId]
        ),
        pool.query(
          'SELECT cranis_version, github_tag, created_at FROM product_versions WHERE product_id = $1 ORDER BY created_at ASC',
          [productId]
        ),
      ]);
      artifacts.set('timeline/compliance-timeline.json', JSON.stringify({
        generatedAt: new Date().toISOString(),
        vulnerabilityScans: vulnScans.rows,
        licenseScans: licenseScans.rows,
        versions: versions.rows,
      }, null, 2));
      included.push('timeline');
    } catch (err) {
      console.error(`[ESCROW] Timeline failed for ${productId}:`, err);
    }
  }

  return artifacts;
}

// ─── Generate manifest + README ──────────────────────────────────────

function generateManifest(productName: string, artifacts: Map<string, string>): string {
  const files: Record<string, { size: number; sha256: string }> = {};
  for (const [path, content] of artifacts) {
    
    files[path] = {
      size: Buffer.byteLength(content, 'utf-8'),
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    };
  }
  return JSON.stringify({
    generator: 'CRANIS2 Escrow Orchestrator',
    version: '1.0.0',
    productName,
    depositedAt: new Date().toISOString(),
    artifactCount: artifacts.size,
    files,
  }, null, 2);
}

function generateReadme(productName: string, artifacts: Map<string, string>): string {
  const lines = [
    `# ${productName} — Escrow Deposit`,
    '',
    `> Auto-generated by [CRANIS2](https://cranis2.dev) on ${new Date().toISOString().split('T')[0]}`,
    '',
    '## Contents',
    '',
  ];
  for (const path of [...artifacts.keys()].sort()) {
    lines.push(`- \`${path}\``);
  }
  lines.push('', '## About', '', 'This repository contains automated compliance artifact deposits from CRANIS2.');
  lines.push('It serves as an escrow deposit, data portability archive, and CRA compliance record.');
  lines.push('', '---', '', '*This file is auto-generated. Do not edit manually.*');
  return lines.join('\n');
}

// ─── Run deposit ─────────────────────────────────────────────────────

interface DepositResult {
  depositId: string;
  status: 'completed' | 'failed';
  artifactCount: number;
  error?: string;
}

export async function runEscrowDeposit(
  productId: string, orgId: string, trigger: string = 'scheduled'
): Promise<DepositResult> {
  // Load config
  const configResult = await pool.query(
    'SELECT * FROM escrow_configs WHERE product_id = $1 AND enabled = true AND setup_completed = true',
    [productId]
  );
  if (configResult.rows.length === 0) {
    return { depositId: '', status: 'failed', artifactCount: 0, error: 'Escrow not configured' };
  }
  const config = configResult.rows[0] as EscrowConfig;

  // Create deposit record
  const depositResult = await pool.query(
    `INSERT INTO escrow_deposits (org_id, product_id, escrow_config_id, status, trigger, started_at)
     VALUES ($1, $2, $3, 'running', $4, NOW()) RETURNING id`,
    [orgId, productId, config.id, trigger]
  );
  const depositId = depositResult.rows[0].id;

  try {
    // Get product name from Neo4j
    const session = getDriver().session();
    let productName = productId;
    try {
      const result = await session.run(
        'MATCH (p:Product {id: $productId}) RETURN p.name AS name',
        { productId }
      );
      if (result.records.length > 0) productName = result.records[0].get('name');
    } finally {
      await session.close();
    }

    // Collect artifacts
    const artifacts = await collectArtifacts(orgId, productId, config);

    if (artifacts.size === 0) {
      throw new Error('No artifacts collected — nothing to deposit');
    }

    // Add manifest + README
    const manifest = generateManifest(productName, artifacts);
    artifacts.set('escrow-manifest.json', manifest);
    const readme = generateReadme(productName, artifacts);
    artifacts.set('README.md', readme);

    // Push all files to Forgejo
    const commitMsg = `Escrow deposit ${new Date().toISOString().split('T')[0]} [${trigger}]`;
    let lastSha: string | null = null;
    const artifactNames: string[] = [];

    for (const [filePath, content] of artifacts) {
      lastSha = await pushFile(config.forgejo_org, config.forgejo_repo, filePath, content, commitMsg);
      artifactNames.push(filePath);
    }

    // Update deposit record
    await pool.query(
      `UPDATE escrow_deposits SET
        status = 'completed', commit_sha = $2, artifacts_included = $3,
        artifact_count = $4, completed_at = NOW()
       WHERE id = $1`,
      [depositId, lastSha, artifactNames, artifactNames.length]
    );

    // Notify
    createNotification({
      orgId,
      type: 'escrow_deposit_completed',
      severity: 'info',
      title: `Escrow deposit completed for ${productName}`,
      body: `${artifactNames.length} artifacts deposited to escrow repository.`,
      link: `/products/${productId}/escrow`,
      metadata: { depositId, artifactCount: artifactNames.length, trigger },
    }).catch(() => {});

    return { depositId, status: 'completed', artifactCount: artifactNames.length };

  } catch (err: any) {
    const errorMsg = err.message || 'Unknown error';
    console.error(`[ESCROW] Deposit failed for ${productId}:`, errorMsg);

    await pool.query(
      `UPDATE escrow_deposits SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
      [depositId, errorMsg]
    );

    createNotification({
      orgId,
      type: 'escrow_deposit_failed',
      severity: 'high',
      title: `Escrow deposit failed for product`,
      body: errorMsg,
      link: `/products/${productId}/escrow`,
      metadata: { depositId, error: errorMsg },
    }).catch(() => {});

    return { depositId, status: 'failed', artifactCount: 0, error: errorMsg };
  }
}

// ─── Bulk deposits (for scheduler) ───────────────────────────────────

export async function runAllEscrowDeposits(): Promise<void> {
  const configs = await pool.query(
    'SELECT product_id, org_id FROM escrow_configs WHERE enabled = true AND setup_completed = true'
  );

  console.log(`[ESCROW] Running deposits for ${configs.rows.length} products`);

  for (const row of configs.rows) {
    try {
      const result = await runEscrowDeposit(row.product_id, row.org_id, 'scheduled');
      console.log(`[ESCROW] ${row.product_id}: ${result.status} (${result.artifactCount} artifacts)`);
    } catch (err: any) {
      console.error(`[ESCROW] ${row.product_id}: failed —`, err.message);
    }
  }
}
