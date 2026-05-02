/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Supplier Due Diligence Service
 * Identifies risky third-party dependencies and generates template-based
 * due diligence questionnaires per CRA Art. 13(5).
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import type {
  RiskFlag,
  RiskFlagType,
  RiskyDependency,
  QuestionnaireContent,
  QuestionnaireQuestion,
  SupplierQuestionnaire,
} from '../types/supplier-due-diligence.js';

export interface EnrichmentStats {
  totalMissing: number;
  resolved: number;
  cached: number;
  fetched: number;
  failed: number;
}

// Copyleft licence families that trigger due diligence
const COPYLEFT_LICENSES = [
  'GPL', 'GPLv2', 'GPLv3', 'GPL-2.0', 'GPL-3.0',
  'LGPL', 'LGPLv2', 'LGPLv3', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
  'AGPL', 'AGPLv3', 'AGPL-3.0',
  'MPL', 'MPL-2.0',
  'EUPL', 'EUPL-1.1', 'EUPL-1.2',
  'CPAL', 'CPAL-1.0',
  'OSL', 'OSL-3.0',
];

function isCopyleftLicense(license: string | null): boolean {
  if (!license) return false;
  const upper = license.toUpperCase().replace(/-ONLY|-OR-LATER/g, '');
  return COPYLEFT_LICENSES.some(cl => upper.includes(cl.toUpperCase()));
}

// ── Registry enrichment ──

const REGISTRY_TIMEOUT = 5000; // 5s per lookup

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'CRANIS2/1.0 (supply-chain-audit)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupNpmSupplier(name: string): Promise<string | null> {
  const data = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!data) return null;

  const parts: string[] = [];

  // Author
  if (data.author) {
    if (typeof data.author === 'string') {
      parts.push(data.author);
    } else if (data.author.name) {
      parts.push(data.author.email ? `${data.author.name} <${data.author.email}>` : data.author.name);
    }
  }

  // Maintainers (if no author or different from author)
  if (parts.length === 0 && data.maintainers && Array.isArray(data.maintainers) && data.maintainers.length > 0) {
    const maint = data.maintainers.slice(0, 3).map((m: any) => m.name || m.email).filter(Boolean);
    if (maint.length > 0) parts.push(maint.join(', '));
  }

  // Repository org (e.g. "github.com/unified-collective/...")
  if (data.repository?.url) {
    const repoUrl = data.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
    const ghMatch = repoUrl.match(/github\.com\/([^/]+)\//);
    if (ghMatch && !parts.some(p => p.toLowerCase().includes(ghMatch[1].toLowerCase()))) {
      parts.push(`(${ghMatch[1]})`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

async function lookupPypiSupplier(name: string): Promise<string | null> {
  const data = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
  if (!data?.info) return null;

  const parts: string[] = [];
  if (data.info.author) {
    parts.push(data.info.author_email
      ? `${data.info.author} <${data.info.author_email}>`
      : data.info.author);
  }
  if (data.info.maintainer && data.info.maintainer !== data.info.author) {
    parts.push(data.info.maintainer);
  }

  return parts.length > 0 ? parts.join(' / ') : null;
}

async function lookupCratesSupplier(name: string): Promise<string | null> {
  const data = await fetchJson(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`);
  if (!data?.crate) return null;

  const parts: string[] = [];
  if (data.crate.repository) {
    const ghMatch = data.crate.repository.match(/github\.com\/([^/]+)\//);
    if (ghMatch) parts.push(ghMatch[1]);
  }
  if (data.crate.homepage && parts.length === 0) {
    parts.push(data.crate.homepage);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

const CACHE_MAX_AGE_DAYS = 30;

function normaliseEcosystem(ecosystem: string | null): string | null {
  if (!ecosystem) return null;
  const eco = ecosystem.toLowerCase();
  if (eco === 'npm' || eco === 'node' || eco === 'javascript' || eco === 'typescript') return 'npm';
  if (eco === 'pypi' || eco === 'python' || eco === 'pip') return 'pypi';
  if (eco === 'crates.io' || eco === 'cargo' || eco === 'rust') return 'crates.io';
  return null;
}

function getRegistryLookup(ecosystem: string): ((name: string) => Promise<string | null>) | null {
  if (ecosystem === 'npm') return lookupNpmSupplier;
  if (ecosystem === 'pypi') return lookupPypiSupplier;
  if (ecosystem === 'crates.io') return lookupCratesSupplier;
  return null;
}

/**
 * Check the shared Postgres cache for supplier data.
 * Returns a map of packageName → supplier for fresh cache hits.
 */
async function getCachedSuppliers(
  packages: Array<{ ecosystem: string; name: string }>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (packages.length === 0) return result;

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - CACHE_MAX_AGE_DAYS);

  // Batch query all at once
  const ecosystems = packages.map(p => p.ecosystem);
  const names = packages.map(p => p.name);

  const res = await pool.query(
    `SELECT ecosystem, package_name, supplier
     FROM registry_supplier_cache
     WHERE (ecosystem, package_name) IN (
       SELECT UNNEST($1::text[]), UNNEST($2::text[])
     )
     AND fetched_at > $3
     AND supplier IS NOT NULL`,
    [ecosystems, names, staleDate]
  );

  for (const row of res.rows) {
    result.set(`${row.ecosystem}:${row.package_name}`, row.supplier);
  }

  return result;
}

/**
 * Write supplier lookup results to the shared cache.
 */
async function setCachedSuppliers(
  entries: Array<{ ecosystem: string; name: string; supplier: string | null }>
): Promise<void> {
  if (entries.length === 0) return;

  // Upsert in batches
  for (const entry of entries) {
    await pool.query(
      `INSERT INTO registry_supplier_cache (ecosystem, package_name, supplier, fetched_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (ecosystem, package_name)
       DO UPDATE SET supplier = $3, fetched_at = NOW()`,
      [entry.ecosystem, entry.name, entry.supplier]
    ).catch(() => {}); // Non-blocking
  }
}

/**
 * Enrich dependencies that have no supplier info by querying package registries.
 * Uses a shared Postgres cache (30-day TTL) so lookups benefit all products/orgs.
 * Updates Neo4j Dependency nodes with discovered supplier data.
 */
export async function enrichSupplierData(
  deps: Array<{ name: string; version: string | null; ecosystem: string | null; supplier: string | null }>,
  productId: string,
  orgId: string
): Promise<{ enriched: Map<string, string>; stats: EnrichmentStats }> {
  const missing = deps.filter(d => !d.supplier || d.supplier.trim() === '');
  const enriched = new Map<string, string>();
  let resolved = 0;
  let failed = 0;

  // Normalise ecosystems and filter to supported registries
  const lookupCandidates = missing
    .map(d => ({ ...d, normEco: normaliseEcosystem(d.ecosystem) }))
    .filter(d => d.normEco !== null) as Array<typeof missing[number] & { normEco: string }>;

  const unsupported = missing.length - lookupCandidates.length;
  failed += unsupported;

  // Check shared cache first
  const cacheKeys = lookupCandidates.map(d => ({ ecosystem: d.normEco, name: d.name }));
  const cached = await getCachedSuppliers(cacheKeys);

  const needsFetch: typeof lookupCandidates = [];
  for (const dep of lookupCandidates) {
    const cacheKey = `${dep.normEco}:${dep.name}`;
    if (cached.has(cacheKey)) {
      enriched.set(dep.name, cached.get(cacheKey)!);
      resolved++;
    } else {
      needsFetch.push(dep);
    }
  }

  const cacheHits = resolved;

  // Fetch remaining from live registries in parallel batches
  const BATCH_SIZE = 10;
  const newCacheEntries: Array<{ ecosystem: string; name: string; supplier: string | null }> = [];

  // Deduplicate by name (same package may appear with different versions)
  const uniqueByName = new Map<string, typeof needsFetch[number]>();
  for (const dep of needsFetch) {
    if (!uniqueByName.has(dep.name)) uniqueByName.set(dep.name, dep);
  }
  const uniqueFetch = Array.from(uniqueByName.values());

  for (let batchStart = 0; batchStart < uniqueFetch.length; batchStart += BATCH_SIZE) {
    const batch = uniqueFetch.slice(batchStart, batchStart + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (dep) => {
        const lookup = getRegistryLookup(dep.normEco);
        if (!lookup) return { dep, supplier: null as string | null, noLookup: true };
        const supplier = await lookup(dep.name);
        return { dep, supplier, noLookup: false };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { dep, supplier, noLookup } = result.value;
        if (noLookup) { failed++; continue; }
        newCacheEntries.push({ ecosystem: dep.normEco, name: dep.name, supplier });
        if (supplier) {
          enriched.set(dep.name, supplier);
          resolved++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    }

    // Small delay between batches to be a good API citizen
    if (batchStart + BATCH_SIZE < uniqueFetch.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Write new results to shared cache (non-blocking)
  setCachedSuppliers(newCacheEntries).catch(() => {});

  // Persist enriched supplier data to Neo4j
  if (enriched.size > 0) {
    const neo4jSession = getDriver().session();
    try {
      for (const [depName, supplier] of enriched) {
        await neo4jSession.run(
          `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency {name: $depName})
           SET d.supplier = $supplier, d.supplierEnrichedAt = datetime()`,
          { orgId, productId, depName, supplier }
        );
      }
    } finally {
      await neo4jSession.close();
    }
  }

  console.log(`[SUPPLIER-DD] Enrichment: ${resolved}/${missing.length} resolved (${cacheHits} cached, ${resolved - cacheHits} live, ${failed} unresolved)`);

  return {
    enriched,
    stats: { totalMissing: missing.length, resolved, cached: cacheHits, fetched: resolved - cacheHits, failed },
  };
}

/**
 * Identify dependencies with supply chain risk flags
 */
export async function identifyRiskyDependencies(
  productId: string,
  orgId: string
): Promise<{ dependencies: RiskyDependency[]; enrichmentStats: EnrichmentStats }> {
  // Get dependencies from Neo4j
  const neo4jSession = getDriver().session();
  let deps: Array<{
    name: string;
    version: string | null;
    purl: string | null;
    ecosystem: string | null;
    license: string | null;
    supplier: string | null;
  }> = [];

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d.name AS name, d.version AS version, d.purl AS purl,
              d.ecosystem AS ecosystem, d.license AS license, d.supplier AS supplier`,
      { orgId, productId }
    );
    deps = result.records.map(r => ({
      name: r.get('name'),
      version: r.get('version') || null,
      purl: r.get('purl') || null,
      ecosystem: r.get('ecosystem') || null,
      license: r.get('license') || null,
      supplier: r.get('supplier') || null,
    }));
  } finally {
    await neo4jSession.close();
  }

  if (deps.length === 0) return { dependencies: [], enrichmentStats: { totalMissing: 0, resolved: 0, cached: 0, fetched: 0, failed: 0 } };

  // Enrich missing supplier data from package registries
  const { enriched, stats: enrichmentStats } = await enrichSupplierData(deps, productId, orgId);

  // Apply enriched data to deps in memory (Neo4j already updated)
  for (const dep of deps) {
    if ((!dep.supplier || dep.supplier.trim() === '') && enriched.has(dep.name)) {
      dep.supplier = enriched.get(dep.name)!;
    }
  }

  // Get vulnerability findings for these dependencies
  const vulnResult = await pool.query(
    `SELECT dependency_name, dependency_version, severity, COUNT(*) AS count
     FROM vulnerability_findings
     WHERE product_id = $1 AND status IN ('open', 'acknowledged')
     GROUP BY dependency_name, dependency_version, severity`,
    [productId]
  );

  // Build vuln lookup: depName -> { severity -> count }
  const vulnMap = new Map<string, Map<string, number>>();
  for (const row of vulnResult.rows) {
    const key = row.dependency_name;
    if (!vulnMap.has(key)) vulnMap.set(key, new Map());
    vulnMap.get(key)!.set(row.severity, parseInt(row.count));
  }

  // Flag risky dependencies
  const risky: RiskyDependency[] = [];

  for (const dep of deps) {
    const flags: RiskFlag[] = [];

    // Check copyleft licence
    if (isCopyleftLicense(dep.license)) {
      flags.push({
        type: 'copyleft_license',
        detail: `Copyleft licence detected: ${dep.license}`,
      });
    }

    // Check known vulnerabilities
    const depVulns = vulnMap.get(dep.name);
    if (depVulns) {
      const totalVulns = Array.from(depVulns.values()).reduce((a, b) => a + b, 0);
      const hasCriticalOrHigh = (depVulns.get('critical') || 0) + (depVulns.get('high') || 0) > 0;

      if (hasCriticalOrHigh) {
        flags.push({
          type: 'high_severity_vuln',
          detail: `${depVulns.get('critical') || 0} critical, ${depVulns.get('high') || 0} high severity vulnerabilities`,
        });
      } else if (totalVulns > 0) {
        flags.push({
          type: 'known_vulnerability',
          detail: `${totalVulns} open vulnerability finding(s)`,
        });
      }
    }

    // Check missing supplier info
    if (!dep.supplier || dep.supplier.trim() === '') {
      flags.push({
        type: 'no_supplier_info',
        detail: 'No supplier/maintainer information available',
      });
    }

    if (flags.length > 0) {
      const vulnSeverities = depVulns ? Array.from(depVulns.entries()) : [];
      const highestSev = vulnSeverities.length > 0
        ? (['critical', 'high', 'medium', 'low'].find(s => (depVulns?.get(s) || 0) > 0) || undefined)
        : undefined;

      risky.push({
        name: dep.name,
        version: dep.version,
        purl: dep.purl,
        ecosystem: dep.ecosystem,
        license: dep.license,
        supplier: dep.supplier,
        riskFlags: flags,
        vulnCount: depVulns ? Array.from(depVulns.values()).reduce((a, b) => a + b, 0) : 0,
        highestSeverity: highestSev,
      });
    }
  }

  // Sort by risk: high severity vulns first, then copyleft, then no supplier
  risky.sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const aSev = severityOrder[a.highestSeverity || ''] || 0;
    const bSev = severityOrder[b.highestSeverity || ''] || 0;
    if (aSev !== bSev) return bSev - aSev;
    return b.riskFlags.length - a.riskFlags.length;
  });

  return { dependencies: risky, enrichmentStats };
}

// ── Question templates by risk flag type ──

const QUESTION_TEMPLATES: Record<RiskFlagType, QuestionnaireQuestion[]> = {
  copyleft_license: [
    {
      id: 'cl1',
      category: 'licence_compliance',
      question: 'Please confirm the exact licence terms under which this component is distributed, including any dual-licensing options or commercial licence alternatives.',
      rationale: 'CRA Art. 13(5) requires manufacturers to exercise due diligence on integrated components, including understanding licence obligations that may affect distribution.',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'cl2',
      category: 'licence_compliance',
      question: 'Does the use of this component as a dependency (without modification) trigger copyleft obligations on the incorporating product?',
      rationale: 'Understanding the scope of copyleft is essential for assessing whether the product\'s own source code must be disclosed.',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'cl3',
      category: 'licence_compliance',
      question: 'Are there any additional licence terms, contributor licence agreements, or patent grants that apply to this component?',
      rationale: 'Complete licence identification is required for the technical documentation under CRA Annex II.',
      craReference: 'Annex II',
    },
    {
      id: 'cl4',
      category: 'supply_chain',
      question: 'Is the component available under an alternative (non-copyleft) licence for commercial use? If so, what are the terms?',
      rationale: 'Identifying alternatives supports risk mitigation and supply chain planning.',
      craReference: 'Art. 13(5)',
    },
  ],
  known_vulnerability: [
    {
      id: 'kv1',
      category: 'vulnerability_management',
      question: 'What is your process for triaging, patching, and disclosing security vulnerabilities in this component?',
      rationale: 'CRA Art. 13(6) requires manufacturers to ensure components are maintained with effective vulnerability handling.',
      craReference: 'Art. 13(6)',
    },
    {
      id: 'kv2',
      category: 'vulnerability_management',
      question: 'What is the typical time-to-fix for reported security vulnerabilities, and do you differentiate by severity?',
      rationale: 'Timely remediation is a core CRA requirement; manufacturers must verify their suppliers can deliver patches promptly.',
      craReference: 'Art. 13(6)',
    },
    {
      id: 'kv3',
      category: 'security_practices',
      question: 'Do you maintain a security advisory channel (e.g. GitHub Security Advisories, mailing list) for this component?',
      rationale: 'Manufacturers need a reliable notification mechanism to meet their own CRA vulnerability monitoring obligations.',
      craReference: 'Art. 13(6)',
    },
    {
      id: 'kv4',
      category: 'vulnerability_management',
      question: 'Are there currently any known but unpatched vulnerabilities in this component? If so, what mitigations do you recommend?',
      rationale: 'Manufacturers must document known residual risks and apply mitigations where patches are unavailable.',
      craReference: 'Art. 13(5)',
    },
  ],
  high_severity_vuln: [
    {
      id: 'hv1',
      category: 'vulnerability_management',
      question: 'This component has critical or high severity vulnerabilities on record. What is the planned timeline for releasing patches for these issues?',
      rationale: 'CRA Art. 13(6) requires that known vulnerabilities are addressed without delay, particularly those of critical or high severity.',
      craReference: 'Art. 13(6)',
    },
    {
      id: 'hv2',
      category: 'vulnerability_management',
      question: 'Can you provide a security advisory or impact assessment for the critical/high severity vulnerabilities affecting this component?',
      rationale: 'Manufacturers must assess the impact of third-party vulnerabilities on their own product\'s security posture.',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'hv3',
      category: 'security_practices',
      question: 'What compensating controls or workarounds are available while patches for the high/critical vulnerabilities are pending?',
      rationale: 'CRA requires manufacturers to apply mitigations where vulnerabilities cannot be immediately resolved.',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'hv4',
      category: 'security_practices',
      question: 'Does this component undergo regular security audits or penetration testing? If so, when was the last assessment?',
      rationale: 'Evidence of security testing supports the manufacturer\'s conformity assessment obligations under CRA.',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'hv5',
      category: 'vulnerability_management',
      question: 'Do you have a coordinated vulnerability disclosure (CVD) policy in place for this component?',
      rationale: 'CRA Art. 13(6) expects components to be supported by responsible disclosure processes.',
      craReference: 'Art. 13(6)',
    },
  ],
  no_supplier_info: [
    {
      id: 'ns1',
      category: 'supply_chain',
      question: 'Please identify the organisation or individual(s) responsible for maintaining this component, including contact details for security-related communications.',
      rationale: 'CRA Art. 13(5) requires manufacturers to identify the suppliers of integrated components and maintain communication channels.',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'ns2',
      category: 'supply_chain',
      question: 'Is this component actively maintained? What is the expected support period and release cadence?',
      rationale: 'Manufacturers must verify that dependencies will receive updates throughout the product\'s support period per CRA Art. 13(8).',
      craReference: 'Art. 13(8)',
    },
    {
      id: 'ns3',
      category: 'supply_chain',
      question: 'Where is the canonical source repository for this component, and how can its authenticity be verified?',
      rationale: 'Component provenance verification is essential for supply chain integrity under CRA Art. 13(5).',
      craReference: 'Art. 13(5)',
    },
    {
      id: 'ns4',
      category: 'update_cadence',
      question: 'How frequently are new releases published, and is there a documented end-of-life or deprecation policy?',
      rationale: 'Understanding the maintenance trajectory helps manufacturers plan for component replacement if support ceases.',
      craReference: 'Art. 13(8)',
    },
  ],
};

// Common questions added to every questionnaire
const COMMON_QUESTIONS: QuestionnaireQuestion[] = [
  {
    id: 'c1',
    category: 'security_practices',
    question: 'Does this component include a Software Bill of Materials (SBOM) identifying its own transitive dependencies?',
    rationale: 'CRA Art. 13(5) requires manufacturers to document the components within their products, including transitive dependencies.',
    craReference: 'Art. 13(5)',
  },
  {
    id: 'c2',
    category: 'update_cadence',
    question: 'What is the recommended process for receiving and applying security updates for this component?',
    rationale: 'Manufacturers must ensure timely application of security updates per CRA Art. 13(8).',
    craReference: 'Art. 13(8)',
  },
];

// Recommended actions by risk flag type
const RECOMMENDED_ACTIONS: Record<RiskFlagType, string[]> = {
  copyleft_license: [
    'Review the copyleft licence terms with legal counsel to determine obligations when distributing the product.',
    'Evaluate whether an alternative component with a permissive licence could serve the same purpose.',
    'Document the licence compliance strategy in the product\'s technical file (CRA Annex II).',
  ],
  known_vulnerability: [
    'Monitor the component\'s security advisories and apply patches as they become available.',
    'Assess whether the vulnerabilities are exploitable in the context of your product.',
    'Document any accepted risks and compensating controls in the risk assessment.',
  ],
  high_severity_vuln: [
    'Prioritise patching or replacing this component – critical/high severity vulnerabilities represent an immediate risk.',
    'If no patch is available, implement compensating controls and document the residual risk.',
    'Consider whether this component should be replaced with a more actively maintained alternative.',
    'Report the vulnerability through your coordinated vulnerability disclosure process if not already public.',
  ],
  no_supplier_info: [
    'Attempt to identify the component maintainer through the package registry, source repository, or community channels.',
    'Evaluate whether the component is a candidate for replacement with a better-documented alternative.',
    'Document the unknown supplier status in the product\'s technical file as a supply chain risk.',
    'Consider forking the component if it is unmaintained, to ensure continued security support.',
  ],
};

/**
 * Generate a deterministic due diligence questionnaire based on risk flag templates.
 * No AI/LLM dependency – questions are derived from CRA regulation text.
 */
export function generateQuestionnaire(
  dep: RiskyDependency,
  _productName: string,
  _craCategory: string | null
): { content: QuestionnaireContent } {
  const flagTypes = new Set(dep.riskFlags.map(f => f.type));

  // Build summary from risk flags
  const summaryParts: string[] = [];
  if (flagTypes.has('high_severity_vuln')) {
    summaryParts.push(`has critical or high severity vulnerabilities on record (${dep.vulnCount || 0} open findings)`);
  } else if (flagTypes.has('known_vulnerability')) {
    summaryParts.push(`has ${dep.vulnCount || 0} open vulnerability finding(s)`);
  }
  if (flagTypes.has('copyleft_license')) {
    summaryParts.push(`is distributed under a copyleft licence (${dep.license})`);
  }
  if (flagTypes.has('no_supplier_info')) {
    summaryParts.push('has no identified supplier or maintainer');
  }

  const summary = `Due diligence is required for ${dep.name}@${dep.version || 'unknown'} because this component ${summaryParts.join(', and ')}. `
    + 'Under CRA Art. 13(5), manufacturers must exercise due diligence when integrating third-party components to ensure the product meets essential cybersecurity requirements.';

  // Build risk assessment
  const riskLevel = flagTypes.has('high_severity_vuln') ? 'high'
    : (flagTypes.size >= 2 || flagTypes.has('known_vulnerability')) ? 'medium'
    : 'low-to-medium';
  const riskAssessment = `This dependency presents a ${riskLevel} supply chain risk based on ${dep.riskFlags.length} identified risk flag(s). `
    + `${dep.riskFlags.map(f => f.detail).join('. ')}. `
    + 'These factors must be addressed through supplier engagement or compensating controls before the product can be considered compliant with CRA essential requirements.';

  // Collect questions – flag-specific first, then common
  const questions: QuestionnaireQuestion[] = [];
  let qIndex = 1;

  for (const flagType of flagTypes) {
    const templateQs = QUESTION_TEMPLATES[flagType] || [];
    for (const tq of templateQs) {
      questions.push({ ...tq, id: `q${qIndex++}` });
    }
  }

  for (const cq of COMMON_QUESTIONS) {
    questions.push({ ...cq, id: `q${qIndex++}` });
  }

  // Collect recommended actions
  const recommendedActions: string[] = [];
  for (const flagType of flagTypes) {
    const actions = RECOMMENDED_ACTIONS[flagType] || [];
    recommendedActions.push(...actions);
  }

  return {
    content: { summary, riskAssessment, questions, recommendedActions },
  };
}

/**
 * Store a questionnaire in the database
 */
export async function storeQuestionnaire(
  orgId: string,
  productId: string,
  userId: string,
  dep: RiskyDependency,
  content: QuestionnaireContent
): Promise<SupplierQuestionnaire> {
  const result = await pool.query(`
    INSERT INTO supplier_questionnaires (
      org_id, product_id, dependency_name, dependency_version, dependency_purl,
      dependency_ecosystem, dependency_license, dependency_supplier,
      risk_flags, questionnaire_content, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'generated', $11)
    RETURNING *
  `, [
    orgId, productId, dep.name, dep.version, dep.purl,
    dep.ecosystem, dep.license, dep.supplier,
    JSON.stringify(dep.riskFlags), JSON.stringify(content), userId,
  ]);

  return rowToQuestionnaire(result.rows[0]);
}

/**
 * List questionnaires for a product
 */
export async function listQuestionnaires(
  productId: string,
  orgId: string
): Promise<SupplierQuestionnaire[]> {
  const result = await pool.query(
    `SELECT * FROM supplier_questionnaires WHERE product_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
    [productId, orgId]
  );
  return result.rows.map(rowToQuestionnaire);
}

/**
 * Get a single questionnaire
 */
export async function getQuestionnaire(
  id: string,
  orgId: string
): Promise<SupplierQuestionnaire | null> {
  const result = await pool.query(
    `SELECT * FROM supplier_questionnaires WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  return result.rows.length > 0 ? rowToQuestionnaire(result.rows[0]) : null;
}

/**
 * Update questionnaire status
 */
export async function updateQuestionnaireStatus(
  id: string,
  orgId: string,
  status: 'generated' | 'sent' | 'responded' | 'reviewed'
): Promise<SupplierQuestionnaire | null> {
  const result = await pool.query(
    `UPDATE supplier_questionnaires SET status = $3, updated_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId, status]
  );
  return result.rows.length > 0 ? rowToQuestionnaire(result.rows[0]) : null;
}

/**
 * Delete all questionnaires for a product (for regeneration)
 */
export async function deleteQuestionnaires(
  productId: string,
  orgId: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM supplier_questionnaires WHERE product_id = $1 AND org_id = $2`,
    [productId, orgId]
  );
  return result.rowCount || 0;
}

function rowToQuestionnaire(row: any): SupplierQuestionnaire {
  return {
    id: row.id,
    orgId: row.org_id,
    productId: row.product_id,
    dependencyName: row.dependency_name,
    dependencyVersion: row.dependency_version,
    dependencyPurl: row.dependency_purl,
    dependencyEcosystem: row.dependency_ecosystem,
    dependencyLicense: row.dependency_license,
    dependencySupplier: row.dependency_supplier,
    riskFlags: typeof row.risk_flags === 'string' ? JSON.parse(row.risk_flags) : (row.risk_flags || []),
    questionnaireContent: typeof row.questionnaire_content === 'string'
      ? JSON.parse(row.questionnaire_content)
      : (row.questionnaire_content || {}),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
