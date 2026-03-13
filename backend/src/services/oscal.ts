/**
 * OSCAL (Open Security Controls Assessment Language) Export Service
 *
 * Generates NIST OSCAL 1.1.2 compliant JSON documents that map CRANIS2's
 * CRA compliance data into machine-readable formats consumable by any
 * OSCAL-compatible GRC tool (ServiceNow, Vanta, Drata, OneTrust, etc.).
 *
 * Four document types:
 *   - Catalog:              19 CRA obligations as OSCAL controls
 *   - Profile:              Which controls apply based on CRA category
 *   - Assessment Results:   Obligation statuses, vuln posture, tech file completeness
 *   - Component Definition: Product metadata, SBOM summary, dependencies
 */

import { v5 as uuidv5 } from 'uuid';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import {
  OBLIGATIONS,
  getApplicableObligations,
  computeDerivedStatuses,
  higherStatus,
} from './obligation-engine.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const OSCAL_VERSION = '1.1.2';
const CRANIS2_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS namespace for deterministic UUIDs
const CRA_REGULATION_REF = 'REGULATION (EU) 2024/2847 — Cyber Resilience Act';

/** Deterministic UUID v5 from a seed string */
function oscalUuid(seed: string): string {
  return uuidv5(seed, CRANIS2_NAMESPACE);
}

/** OSCAL metadata block */
function oscalMetadata(title: string, version: string = '1.0.0') {
  return {
    title,
    'last-modified': new Date().toISOString(),
    version,
    'oscal-version': OSCAL_VERSION,
    roles: [
      { id: 'tool', title: 'Compliance Tool' },
    ],
    parties: [
      {
        uuid: oscalUuid('cranis2-party'),
        type: 'organization',
        name: 'CRANIS2',
      },
    ],
    'responsible-parties': [
      {
        'role-id': 'tool',
        'party-uuids': [oscalUuid('cranis2-party')],
      },
    ],
  };
}

/** Map obligation key to a stable OSCAL control ID (e.g. art_13_6 → cra-art-13-6) */
function controlId(obligationKey: string): string {
  return `cra-${obligationKey.replace(/_/g, '-')}`;
}

/** Group obligations by top-level article for catalog grouping */
function groupObligations(): Record<string, typeof OBLIGATIONS> {
  const groups: Record<string, typeof OBLIGATIONS> = {};
  for (const ob of OBLIGATIONS) {
    // Extract top-level group: "Art. 13" from "Art. 13(6)", "Annex I, Part I" stays as-is
    const groupKey = ob.article.replace(/\(.*\)/, '').trim();
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(ob);
  }
  return groups;
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export function buildCraCatalog() {
  const groups = groupObligations();

  const oscalGroups = Object.entries(groups).map(([groupTitle, obligations]) => ({
    id: oscalUuid(`group-${groupTitle}`),
    title: `${CRA_REGULATION_REF} — ${groupTitle}`,
    controls: obligations.map(ob => ({
      id: controlId(ob.key),
      title: `${ob.article}: ${ob.title}`,
      props: [
        { name: 'cra-article', value: ob.article },
        { name: 'cra-obligation-key', value: ob.key },
        { name: 'applies-to', value: ob.appliesTo.join(', ') },
        { name: 'applies-to-roles', value: ob.appliesToRoles.join(', ') },
      ],
      parts: [
        {
          id: `${controlId(ob.key)}-desc`,
          name: 'statement',
          prose: ob.description,
        },
      ],
    })),
  }));

  return {
    catalog: {
      uuid: oscalUuid('cra-catalog-v1'),
      metadata: oscalMetadata('EU Cyber Resilience Act — Obligation Catalog'),
      groups: oscalGroups,
    },
  };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export function buildCraProfile(craCategory: string, craRole?: string) {
  const applicable = getApplicableObligations(craCategory, craRole);

  return {
    profile: {
      uuid: oscalUuid(`cra-profile-${craCategory}`),
      metadata: oscalMetadata(
        `CRA Profile — ${formatCategory(craCategory)}`,
      ),
      imports: [
        {
          href: '#cra-catalog',
          'include-controls': [
            {
              'with-ids': applicable.map(ob => controlId(ob.key)),
            },
          ],
        },
      ],
      merge: {
        'as-is': true,
      },
    },
  };
}

// ─── Assessment Results ──────────────────────────────────────────────────────

export async function buildAssessmentResults(
  productId: string,
  orgId: string,
  product: { name: string; craCategory: string; craRole?: string },
) {
  const craCategory = product.craCategory || 'default';
  const applicable = getApplicableObligations(craCategory, product.craRole);

  // Fetch obligation statuses (manual + derived)
  const [obligationsResult, categoryMap] = await Promise.all([
    pool.query(
      `SELECT obligation_key, status, notes, updated_at
       FROM obligations
       WHERE org_id = $1 AND product_id = $2`,
      [orgId, productId],
    ),
    Promise.resolve({ [productId]: craCategory }),
  ]);

  const manualStatuses: Record<string, { status: string; notes: string; updatedAt: string | null }> = {};
  for (const row of obligationsResult.rows) {
    manualStatuses[row.obligation_key] = {
      status: row.status,
      notes: row.notes || '',
      updatedAt: row.updated_at?.toISOString?.() || row.updated_at || null,
    };
  }

  const derivedMap = await computeDerivedStatuses([productId], orgId, categoryMap, product.craRole);
  const derived = derivedMap[productId] ?? {};

  // Vulnerability summary
  const vulnResult = await pool.query(
    `SELECT severity, COUNT(*)::int AS count
     FROM vulnerability_findings
     WHERE product_id = $1 AND org_id = $2 AND status IN ('open', 'acknowledged')
     GROUP BY severity`,
    [productId, orgId],
  );
  const vulnCounts: Record<string, number> = {};
  let totalOpenVulns = 0;
  for (const row of vulnResult.rows) {
    vulnCounts[row.severity] = row.count;
    totalOpenVulns += row.count;
  }

  // Build findings
  const findings = applicable.map(ob => {
    const manual = manualStatuses[ob.key]?.status || 'not_started';
    const derivedStatus = derived[ob.key]?.status || null;
    const effective = higherStatus(manual, derivedStatus);

    const state = effective === 'met' ? 'satisfied' : 'not-satisfied';

    const observations: any[] = [];

    // Manual status observation
    if (manualStatuses[ob.key]) {
      observations.push({
        uuid: oscalUuid(`obs-manual-${productId}-${ob.key}`),
        title: `Manual assessment: ${ob.article}`,
        description: manualStatuses[ob.key].notes || `Manual status: ${manual}`,
        methods: ['EXAMINE'],
        collected: manualStatuses[ob.key].updatedAt || new Date().toISOString(),
      });
    }

    // Derived status observation
    if (derived[ob.key]) {
      observations.push({
        uuid: oscalUuid(`obs-derived-${productId}-${ob.key}`),
        title: `Automated assessment: ${ob.article}`,
        description: derived[ob.key].reason,
        methods: ['TEST'],
        collected: new Date().toISOString(),
      });
    }

    return {
      uuid: oscalUuid(`finding-${productId}-${ob.key}`),
      title: `${ob.article}: ${ob.title}`,
      target: {
        type: 'objective-id',
        'target-id': controlId(ob.key),
        status: { state },
        props: [
          { name: 'manual-status', value: manual },
          ...(derivedStatus ? [{ name: 'derived-status', value: derivedStatus }] : []),
          { name: 'effective-status', value: effective },
        ],
      },
      'related-observations': observations.map(o => ({ 'observation-uuid': o.uuid })),
    };
  });

  // Collect all observations into a flat list
  const allObservations: any[] = [];
  for (const ob of applicable) {
    const manual = manualStatuses[ob.key];
    if (manual) {
      allObservations.push({
        uuid: oscalUuid(`obs-manual-${productId}-${ob.key}`),
        title: `Manual assessment: ${ob.article}`,
        description: manual.notes || `Manual status: ${manual.status}`,
        methods: ['EXAMINE'],
        collected: manual.updatedAt || new Date().toISOString(),
      });
    }
    if (derived[ob.key]) {
      allObservations.push({
        uuid: oscalUuid(`obs-derived-${productId}-${ob.key}`),
        title: `Automated assessment: ${ob.article}`,
        description: derived[ob.key].reason,
        methods: ['TEST'],
        collected: new Date().toISOString(),
      });
    }
  }

  // Vulnerability posture observation
  allObservations.push({
    uuid: oscalUuid(`obs-vulns-${productId}`),
    title: 'Vulnerability posture',
    description: totalOpenVulns === 0
      ? 'No open vulnerability findings'
      : `${totalOpenVulns} open findings: ${Object.entries(vulnCounts).map(([s, c]) => `${c} ${s}`).join(', ')}`,
    methods: ['TEST'],
    collected: new Date().toISOString(),
    props: [
      { name: 'total-open', value: String(totalOpenVulns) },
      ...Object.entries(vulnCounts).map(([sev, count]) => ({
        name: `open-${sev}`, value: String(count),
      })),
    ],
  });

  const metCount = findings.filter(f => f.target.status.state === 'satisfied').length;

  return {
    'assessment-results': {
      uuid: oscalUuid(`ar-${productId}`),
      metadata: oscalMetadata(
        `CRA Assessment Results — ${product.name}`,
      ),
      'import-ap': {
        href: '#cra-profile',
      },
      results: [
        {
          uuid: oscalUuid(`result-${productId}`),
          title: `CRA Compliance Assessment — ${product.name}`,
          start: new Date().toISOString(),
          props: [
            { name: 'product-id', value: productId },
            { name: 'product-name', value: product.name },
            { name: 'cra-category', value: craCategory },
            { name: 'obligations-met', value: String(metCount) },
            { name: 'obligations-total', value: String(applicable.length) },
            { name: 'open-vulnerabilities', value: String(totalOpenVulns) },
          ],
          observations: allObservations,
          findings,
        },
      ],
    },
  };
}

// ─── Component Definition ────────────────────────────────────────────────────

export async function buildComponentDefinition(
  productId: string,
  orgId: string,
  product: { name: string; version?: string; description?: string; craCategory: string; productType?: string; craRole?: string },
) {
  const craCategory = product.craCategory || 'default';
  const applicable = getApplicableObligations(craCategory, product.craRole);

  // SBOM data
  const sbomResult = await pool.query(
    `SELECT package_count, synced_at, is_stale FROM product_sboms WHERE product_id = $1`,
    [productId],
  );
  const sbom = sbomResult.rows[0] || null;

  // Dependency summary
  let dependencies: any[] = [];
  if (sbom) {
    const depResult = await pool.query(
      `SELECT name, version, ecosystem, license FROM product_dependencies
       WHERE product_id = $1
       ORDER BY name ASC
       LIMIT 500`,
      [productId],
    );
    dependencies = depResult.rows;
  }

  return {
    'component-definition': {
      uuid: oscalUuid(`cd-${productId}`),
      metadata: oscalMetadata(
        `CRA Component Definition — ${product.name}`,
      ),
      components: [
        {
          uuid: oscalUuid(`component-${productId}`),
          type: 'software',
          title: product.name,
          description: product.description || `Software product: ${product.name}`,
          props: [
            { name: 'product-id', value: productId },
            { name: 'cra-category', value: craCategory },
            ...(product.version ? [{ name: 'version', value: product.version }] : []),
            ...(product.productType ? [{ name: 'product-type', value: product.productType }] : []),
            { name: 'sbom-available', value: sbom ? 'true' : 'false' },
            ...(sbom ? [
              { name: 'sbom-package-count', value: String(sbom.package_count) },
              { name: 'sbom-stale', value: String(sbom.is_stale) },
              { name: 'sbom-synced-at', value: sbom.synced_at?.toISOString?.() || String(sbom.synced_at) },
            ] : []),
            { name: 'dependency-count', value: String(dependencies.length) },
          ],
          'control-implementations': [
            {
              uuid: oscalUuid(`ci-${productId}`),
              source: '#cra-catalog',
              description: `CRA control implementation for ${product.name}`,
              'implemented-requirements': applicable.map(ob => ({
                uuid: oscalUuid(`ir-${productId}-${ob.key}`),
                'control-id': controlId(ob.key),
                description: ob.description,
              })),
            },
          ],
          protocols: dependencies.length > 0 ? undefined : undefined,
        },
      ],
      'back-matter': dependencies.length > 0 ? {
        resources: [
          {
            uuid: oscalUuid(`deps-${productId}`),
            title: 'Software Dependencies (SBOM Summary)',
            description: `${dependencies.length} dependencies from SBOM`,
            props: dependencies.slice(0, 100).map((dep, i) => ({
              name: `dependency-${i}`,
              value: `${dep.name}@${dep.version || 'unknown'} (${dep.ecosystem || 'unknown'})${dep.license ? ` [${dep.license}]` : ''}`,
            })),
          },
        ],
      } : undefined,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCategory(cat: string): string {
  switch (cat) {
    case 'default': return 'Default';
    case 'important_i': return 'Important Class I';
    case 'important_ii': return 'Important Class II';
    case 'critical': return 'Critical';
    default: return cat;
  }
}
