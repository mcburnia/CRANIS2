/**
 * License Compatibility Matrix
 * 
 * Pure-function rules engine that determines whether a dependency's license
 * is compatible with the product's distribution model. No database dependencies.
 */

// ── Types ──

export type DistributionModel =
  | 'proprietary_binary'
  | 'saas_hosted'
  | 'source_available'
  | 'library_component'
  | 'internal_only';

export type LicenseCategory =
  | 'permissive'
  | 'copyleft_strong'
  | 'copyleft_weak'
  | 'unknown'
  | 'no_assertion';

export type CompatibilityVerdict = 'compatible' | 'incompatible' | 'review_needed';

export interface CompatibilityResult {
  verdict: CompatibilityVerdict;
  reason: string;
  rule: string;
}

export const VALID_DISTRIBUTION_MODELS: DistributionModel[] = [
  'proprietary_binary',
  'saas_hosted',
  'source_available',
  'library_component',
  'internal_only',
];

export const DISTRIBUTION_MODEL_LABELS: Record<DistributionModel, string> = {
  proprietary_binary: 'Proprietary Binary',
  saas_hosted: 'SaaS / Cloud Hosted',
  source_available: 'Source Available',
  library_component: 'Library / Component',
  internal_only: 'Internal Only',
};

// ── Network-triggered copyleft (AGPL/SSPL) ──

const NETWORK_COPYLEFT = new Set([
  'AGPL-1.0-only', 'AGPL-1.0-or-later',
  'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'SSPL-1.0',
]);

function extractLicenseIds(spdxExpression: string): string[] {
  return spdxExpression
    .replace(/[()]/g, ' ')
    .replace(/\b(AND|OR|WITH)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(id => id.length > 0 && id !== '+');
}

function hasNetworkCopyleft(spdxExpression: string): boolean {
  return extractLicenseIds(spdxExpression).some(id => NETWORK_COPYLEFT.has(id));
}

// ── FSF / SPDX cross-license incompatibilities ──

interface LicenseConflict {
  a: string;
  b: string;
  reason: string;
}

const CROSS_LICENSE_CONFLICTS: LicenseConflict[] = [
  { a: 'GPL-2.0-only', b: 'Apache-2.0', reason: 'GPL-2.0-only is incompatible with Apache-2.0 due to patent clause conflicts. GPL-3.0 resolves this.' },
  { a: 'GPL-2.0', b: 'Apache-2.0', reason: 'GPL-2.0 is incompatible with Apache-2.0 due to patent clause conflicts. GPL-3.0 resolves this.' },
  { a: 'GPL-2.0-only', b: 'CDDL-1.0', reason: 'GPL-2.0 and CDDL-1.0 have conflicting copyleft requirements and cannot be combined.' },
  { a: 'GPL-2.0', b: 'CDDL-1.0', reason: 'GPL-2.0 and CDDL-1.0 have conflicting copyleft requirements and cannot be combined.' },
  { a: 'GPL-2.0-only', b: 'MPL-1.1', reason: 'GPL-2.0 and MPL-1.1 are incompatible without explicit dual-licensing.' },
  { a: 'GPL-2.0', b: 'MPL-1.1', reason: 'GPL-2.0 and MPL-1.1 are incompatible without explicit dual-licensing.' },
  { a: 'EPL-1.0', b: 'GPL-2.0-only', reason: 'EPL-1.0 and GPL-2.0 have incompatible patent and distribution terms.' },
  { a: 'EPL-1.0', b: 'GPL-2.0', reason: 'EPL-1.0 and GPL-2.0 have incompatible patent and distribution terms.' },
  { a: 'EPL-1.0', b: 'GPL-3.0-only', reason: 'EPL-1.0 and GPL-3.0 have incompatible copyleft terms.' },
  { a: 'EPL-1.0', b: 'GPL-3.0', reason: 'EPL-1.0 and GPL-3.0 have incompatible copyleft terms.' },
  { a: 'EUPL-1.2', b: 'GPL-2.0-only', reason: 'EUPL-1.2 is compatible with GPL-3.0 but not GPL-2.0-only.' },
  { a: 'EUPL-1.2', b: 'GPL-2.0', reason: 'EUPL-1.2 is compatible with GPL-3.0 but not GPL-2.0-only.' },
  { a: 'CDDL-1.0', b: 'GPL-3.0-only', reason: 'CDDL-1.0 and GPL-3.0 have conflicting copyleft requirements.' },
  { a: 'CDDL-1.0', b: 'GPL-3.0', reason: 'CDDL-1.0 and GPL-3.0 have conflicting copyleft requirements.' },
];

// ── Core compatibility check ──

export function checkCompatibility(
  distributionModel: DistributionModel,
  licenseCategory: LicenseCategory,
  licenseSpdx: string,
  dependencyDepth: string
): CompatibilityResult {
  const depth = dependencyDepth === 'direct' ? 'direct' : 'transitive';

  // Unknown / no assertion → always review
  if (licenseCategory === 'unknown' || licenseCategory === 'no_assertion') {
    return {
      verdict: 'review_needed',
      reason: `Licence "${licenseSpdx || 'not declared'}" is not recognised. Manual review needed to determine compatibility with ${DISTRIBUTION_MODEL_LABELS[distributionModel]} distribution.`,
      rule: 'unknown_licence',
    };
  }

  // Permissive → always compatible
  if (licenseCategory === 'permissive') {
    return {
      verdict: 'compatible',
      reason: `Permissive licence — no distribution restrictions for ${DISTRIBUTION_MODEL_LABELS[distributionModel]} products.`,
      rule: 'permissive_always_ok',
    };
  }

  // ── Internal only: everything is fine ──
  if (distributionModel === 'internal_only') {
    return {
      verdict: 'compatible',
      reason: `Internal-only use — no external distribution means copyleft obligations are not triggered.`,
      rule: 'internal_no_distribution',
    };
  }

  // ── SaaS / hosted ──
  if (distributionModel === 'saas_hosted') {
    if (hasNetworkCopyleft(licenseSpdx)) {
      return {
        verdict: 'incompatible',
        reason: `${licenseSpdx} triggers copyleft obligations for network/SaaS use (AGPL/SSPL). Source code must be provided to users even without binary distribution.`,
        rule: 'saas_network_copyleft',
      };
    }
    // Regular copyleft (strong or weak) is fine for SaaS — no distribution occurs
    return {
      verdict: 'compatible',
      reason: `SaaS/hosted distribution does not trigger copyleft obligations for ${licenseSpdx} — no binary or source is distributed to end users.`,
      rule: 'saas_no_distribution',
    };
  }

  // ── Source available ──
  if (distributionModel === 'source_available') {
    // Source is already shared, so copyleft source-disclosure is satisfied
    if (hasNetworkCopyleft(licenseSpdx)) {
      return {
        verdict: 'compatible',
        reason: `Source-available distribution satisfies ${licenseSpdx} requirements — source code is already provided.`,
        rule: 'source_available_satisfies_copyleft',
      };
    }
    return {
      verdict: 'compatible',
      reason: `Source-available distribution satisfies copyleft requirements for ${licenseSpdx} — source code disclosure is already part of your distribution model.`,
      rule: 'source_available_satisfies_copyleft',
    };
  }

  // ── Proprietary binary ──
  if (distributionModel === 'proprietary_binary') {
    if (licenseCategory === 'copyleft_strong') {
      if (hasNetworkCopyleft(licenseSpdx)) {
        return {
          verdict: 'incompatible',
          reason: `${licenseSpdx} requires source code disclosure. Incompatible with proprietary binary distribution.`,
          rule: 'proprietary_strong_copyleft',
        };
      }
      return {
        verdict: 'incompatible',
        reason: `${licenseSpdx} requires source code disclosure when distributing binaries. Proprietary binary distribution is incompatible unless the dependency is replaced or the product is relicensed.`,
        rule: 'proprietary_strong_copyleft',
      };
    }
    if (licenseCategory === 'copyleft_weak') {
      return {
        verdict: 'review_needed',
        reason: `${licenseSpdx} is weak copyleft — compatible if dynamically linked (separate shared library). Static linking or modification of the library would require sharing those modifications.`,
        rule: 'proprietary_weak_copyleft_linking',
      };
    }
  }

  // ── Library / component ──
  if (distributionModel === 'library_component') {
    if (licenseCategory === 'copyleft_strong') {
      return {
        verdict: 'incompatible',
        reason: `${licenseSpdx} is strong copyleft. Distributing this as part of a library/component forces downstream consumers to also comply with copyleft terms, which may make your component unusable in proprietary projects.`,
        rule: 'library_strong_copyleft_downstream',
      };
    }
    if (licenseCategory === 'copyleft_weak') {
      return {
        verdict: 'review_needed',
        reason: `${licenseSpdx} is weak copyleft. Downstream consumers of your library may need to comply with ${licenseSpdx} terms for this ${depth} dependency. Review linking and distribution requirements.`,
        rule: 'library_weak_copyleft_downstream',
      };
    }
  }

  // Fallback (shouldn't be reached)
  return {
    verdict: 'review_needed',
    reason: `Could not determine compatibility of ${licenseSpdx} (${licenseCategory}) with ${DISTRIBUTION_MODEL_LABELS[distributionModel]} distribution.`,
    rule: 'fallback_unknown',
  };
}

// ── Batch check for a product's findings ──

export function checkProductCompatibility(
  distributionModel: DistributionModel,
  findings: Array<{
    dependencyPurl: string;
    licenseDeclared: string;
    licenseCategory: LicenseCategory;
    dependencyDepth: string;
  }>
): Map<string, CompatibilityResult> {
  const results = new Map<string, CompatibilityResult>();
  for (const f of findings) {
    results.set(
      f.dependencyPurl,
      checkCompatibility(distributionModel, f.licenseCategory, f.licenseDeclared, f.dependencyDepth)
    );
  }
  return results;
}

// ── Cross-license conflict detection ──

export function checkCrossLicenseConflicts(
  licenseSpdxList: string[]
): Array<{ licenseA: string; licenseB: string; reason: string }> {
  // Extract all individual license IDs from all expressions
  const allIds = new Set<string>();
  for (const expr of licenseSpdxList) {
    for (const id of extractLicenseIds(expr)) {
      allIds.add(id);
    }
  }

  const conflicts: Array<{ licenseA: string; licenseB: string; reason: string }> = [];
  for (const conflict of CROSS_LICENSE_CONFLICTS) {
    if (allIds.has(conflict.a) && allIds.has(conflict.b)) {
      conflicts.push({ licenseA: conflict.a, licenseB: conflict.b, reason: conflict.reason });
    }
  }
  return conflicts;
}
