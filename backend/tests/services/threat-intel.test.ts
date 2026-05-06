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
 * P10a-1 — Threat-intel ingestion: pure-function unit tests.
 *
 * Covers the deterministic parsing layer of services/threat-intel.ts:
 *   - CVE id validation
 *   - empty-string and whitespace handling
 *   - date parsing (ISO + free-form dates from CISA's feed)
 *   - KEV entry → row mapping (including ransomware-flag derivation,
 *     missing fields, malformed cwes)
 *   - EPSS CSV line parsing (data rows, headers, comments, blanks,
 *     malformed numbers, invalid CVE ids)
 *   - EPSS metadata extraction (model_version, score_date)
 *
 * These functions are the only place data quality from external feeds
 * gets enforced before it lands in the local database, so they are the
 * highest-leverage thing to unit-test deterministically.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidCveId,
  nullIfEmpty,
  parseDateOrNull,
  parseKevEntry,
  parseEpssDataLine,
  extractEpssMetadata,
  emptyEnrichment,
  mapEnrichmentRow,
  dedupeCveIds,
  applyThreatIntelPriority,
  DEFAULT_THREAT_INTEL_POLICY,
} from '../../src/services/threat-intel.js';
import type { FindingEnrichment } from '../../src/services/threat-intel.js';

describe('isValidCveId', () => {
  it('accepts a canonical 4-digit-suffix CVE', () => {
    expect(isValidCveId('CVE-2021-44228')).toBe(true);
  });

  it('accepts a 7-digit-suffix CVE (modern format)', () => {
    expect(isValidCveId('CVE-2024-1234567')).toBe(true);
  });

  it('rejects malformed CVE ids', () => {
    expect(isValidCveId('cve-2021-44228')).toBe(false); // lowercase
    expect(isValidCveId('CVE-21-44228')).toBe(false);   // wrong year width
    expect(isValidCveId('CVE-2021-123')).toBe(false);   // suffix too short
    expect(isValidCveId('CVE-2021')).toBe(false);
    expect(isValidCveId('GHSA-xxxx-yyyy-zzzz')).toBe(false);
  });

  it('rejects nullish input safely', () => {
    expect(isValidCveId(null)).toBe(false);
    expect(isValidCveId(undefined)).toBe(false);
    expect(isValidCveId('')).toBe(false);
  });
});

describe('nullIfEmpty', () => {
  it('returns null for empty / whitespace / nullish', () => {
    expect(nullIfEmpty(null)).toBe(null);
    expect(nullIfEmpty(undefined)).toBe(null);
    expect(nullIfEmpty('')).toBe(null);
    expect(nullIfEmpty('   ')).toBe(null);
  });

  it('trims surrounding whitespace and preserves non-empty content', () => {
    expect(nullIfEmpty('  hello  ')).toBe('hello');
    expect(nullIfEmpty('Apache Log4j')).toBe('Apache Log4j');
  });
});

describe('parseDateOrNull', () => {
  it('returns ISO date for valid input', () => {
    expect(parseDateOrNull('2021-12-10')).toBe('2021-12-10');
    expect(parseDateOrNull('2021-12-10T00:00:00Z')).toBe('2021-12-10');
  });

  it('returns null for invalid or empty input', () => {
    expect(parseDateOrNull('not a date')).toBe(null);
    expect(parseDateOrNull('')).toBe(null);
    expect(parseDateOrNull(undefined)).toBe(null);
    expect(parseDateOrNull(null)).toBe(null);
  });
});

describe('parseKevEntry', () => {
  const sampleKev = {
    cveID: 'CVE-2021-44228',
    vendorProject: 'Apache',
    product: 'Log4j2',
    vulnerabilityName: 'Apache Log4j2 Remote Code Execution Vulnerability',
    dateAdded: '2021-12-10',
    shortDescription: 'Apache Log4j2 contains a JNDI lookup vulnerability...',
    requiredAction: 'Apply updates per vendor instructions.',
    dueDate: '2021-12-24',
    knownRansomwareCampaignUse: 'Known',
    notes: '',
    cwes: ['CWE-20', 'CWE-400'],
  };

  it('maps a fully-populated entry to all expected columns', () => {
    const row = parseKevEntry(sampleKev);
    expect(row).not.toBe(null);
    expect(row!.cveId).toBe('CVE-2021-44228');
    expect(row!.vendorProject).toBe('Apache');
    expect(row!.product).toBe('Log4j2');
    expect(row!.dateAdded).toBe('2021-12-10');
    expect(row!.dueDate).toBe('2021-12-24');
    expect(row!.knownRansomwareUse).toBe(true);
    expect(row!.cwes).toEqual(['CWE-20', 'CWE-400']);
  });

  it('treats absent / "Unknown" ransomware-campaign-use as false', () => {
    expect(parseKevEntry({ ...sampleKev, knownRansomwareCampaignUse: 'Unknown' })!.knownRansomwareUse).toBe(false);
    expect(parseKevEntry({ ...sampleKev, knownRansomwareCampaignUse: undefined })!.knownRansomwareUse).toBe(false);
    expect(parseKevEntry({ ...sampleKev, knownRansomwareCampaignUse: '' })!.knownRansomwareUse).toBe(false);
  });

  it('rejects entries with missing or malformed cveID', () => {
    expect(parseKevEntry({ ...sampleKev, cveID: '' as any })).toBe(null);
    expect(parseKevEntry({ ...sampleKev, cveID: 'invalid' as any })).toBe(null);
    expect(parseKevEntry({} as any)).toBe(null);
  });

  it('coerces missing / non-array cwes to empty array (never undefined)', () => {
    expect(parseKevEntry({ ...sampleKev, cwes: undefined })!.cwes).toEqual([]);
    expect(parseKevEntry({ ...sampleKev, cwes: 'CWE-20' as any })!.cwes).toEqual([]);
  });

  it('normalises empty notes / vendor / product to null (not empty string)', () => {
    const row = parseKevEntry({
      ...sampleKev,
      notes: '',
      vendorProject: '   ',
      product: undefined,
    });
    expect(row!.notes).toBe(null);
    expect(row!.vendorProject).toBe(null);
    expect(row!.product).toBe(null);
  });
});

describe('parseEpssDataLine', () => {
  it('parses a valid data row', () => {
    const row = parseEpssDataLine('CVE-2021-44228,0.97534,0.99987');
    expect(row).toEqual({ cve: 'CVE-2021-44228', score: 0.97534, percentile: 0.99987 });
  });

  it('skips comment lines', () => {
    expect(parseEpssDataLine('#model_version:v2024.06.10,score_date:2026-05-06T00:00:00+0000')).toBe(null);
  });

  it('skips the column-header row', () => {
    expect(parseEpssDataLine('cve,epss,percentile')).toBe(null);
    expect(parseEpssDataLine('CVE,EPSS,PERCENTILE')).toBe(null);
  });

  it('skips empty lines', () => {
    expect(parseEpssDataLine('')).toBe(null);
  });

  it('rejects rows with too few columns', () => {
    expect(parseEpssDataLine('CVE-2021-44228')).toBe(null);
    expect(parseEpssDataLine('CVE-2021-44228,0.97')).toBe(null);
  });

  it('rejects rows with non-numeric score / percentile', () => {
    expect(parseEpssDataLine('CVE-2021-44228,N/A,0.99')).toBe(null);
    expect(parseEpssDataLine('CVE-2021-44228,0.97,not-a-number')).toBe(null);
  });

  it('rejects rows whose CVE id is malformed', () => {
    expect(parseEpssDataLine('NOT-A-CVE,0.5,0.5')).toBe(null);
  });
});

describe('extractEpssMetadata', () => {
  it('extracts model_version and score_date from a canonical comment', () => {
    const meta = extractEpssMetadata('#model_version:v2024.06.10,score_date:2026-05-06T00:00:00+0000');
    expect(meta.modelVersion).toBe('v2024.06.10');
    expect(meta.scoredAt).toBe('2026-05-06');
  });

  it('handles equals-sign as separator (older feed format)', () => {
    const meta = extractEpssMetadata('#model_version=v2024.06.10');
    expect(meta.modelVersion).toBe('v2024.06.10');
    expect(meta.scoredAt).toBe(null);
  });

  it('returns nulls for non-comment lines', () => {
    expect(extractEpssMetadata('CVE-2021-44228,0.97,0.99')).toEqual({ modelVersion: null, scoredAt: null });
    expect(extractEpssMetadata('')).toEqual({ modelVersion: null, scoredAt: null });
  });
});

describe('emptyEnrichment', () => {
  it('returns an inert default with all fields safely false / null', () => {
    const e = emptyEnrichment();
    expect(e).toEqual({
      kevListed: false,
      kevDueDate: null,
      kevKnownRansomware: false,
      epssScore: null,
      epssPercentile: null,
    });
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = emptyEnrichment();
    const b = emptyEnrichment();
    a.kevListed = true;
    expect(b.kevListed).toBe(false); // mutating a must not leak into b
  });
});

describe('mapEnrichmentRow', () => {
  it('maps a fully-populated row (KEV + EPSS hits, dueDate as Date)', () => {
    const result = mapEnrichmentRow({
      kev_listed: true,
      kev_due_date: new Date('2021-12-24T00:00:00Z'),
      kev_known_ransomware: true,
      epss_score: '0.9753', // pg returns NUMERIC as string
      epss_percentile: '0.9999',
    });
    expect(result).toEqual({
      kevListed: true,
      kevDueDate: '2021-12-24',
      kevKnownRansomware: true,
      epssScore: 0.9753,
      epssPercentile: 0.9999,
    });
  });

  it('maps a row that hit only KEV (no EPSS data)', () => {
    const result = mapEnrichmentRow({
      kev_listed: true,
      kev_due_date: new Date('2024-06-01T00:00:00Z'),
      kev_known_ransomware: false,
      epss_score: null,
      epss_percentile: null,
    });
    expect(result.kevListed).toBe(true);
    expect(result.kevDueDate).toBe('2024-06-01');
    expect(result.epssScore).toBe(null);
    expect(result.epssPercentile).toBe(null);
  });

  it('maps a row that hit only EPSS (no KEV listing)', () => {
    const result = mapEnrichmentRow({
      kev_listed: false,
      kev_due_date: null,
      kev_known_ransomware: false,
      epss_score: '0.0123',
      epss_percentile: '0.4567',
    });
    expect(result.kevListed).toBe(false);
    expect(result.kevDueDate).toBe(null);
    expect(result.kevKnownRansomware).toBe(false);
    expect(result.epssScore).toBeCloseTo(0.0123);
    expect(result.epssPercentile).toBeCloseTo(0.4567);
  });

  it('handles a row that missed both caches', () => {
    const result = mapEnrichmentRow({
      kev_listed: false,
      kev_due_date: null,
      kev_known_ransomware: false,
      epss_score: null,
      epss_percentile: null,
    });
    expect(result).toEqual(emptyEnrichment());
  });

  it('coerces non-boolean truthy values for safety (e.g. "t" string from raw drivers)', () => {
    // mapEnrichmentRow only treats strict === true as KEV-listed; a string "t"
    // or a 1 must NOT escalate to true, since the SQL query always returns a
    // proper boolean. This keeps callers safe if a raw driver layer ever
    // changes its boolean coercion.
    expect(mapEnrichmentRow({ kev_listed: 't' as any, kev_due_date: null, kev_known_ransomware: 1 as any, epss_score: null, epss_percentile: null }).kevListed).toBe(false);
    expect(mapEnrichmentRow({ kev_listed: 't' as any, kev_due_date: null, kev_known_ransomware: 1 as any, epss_score: null, epss_percentile: null }).kevKnownRansomware).toBe(false);
  });

  it('truncates string ISO dates to YYYY-MM-DD', () => {
    const result = mapEnrichmentRow({
      kev_listed: true,
      kev_due_date: '2021-12-24T15:30:00Z',
      kev_known_ransomware: false,
      epss_score: null,
      epss_percentile: null,
    });
    expect(result.kevDueDate).toBe('2021-12-24');
  });
});

describe('dedupeCveIds', () => {
  it('filters out non-CVE ids (GHSA, malformed) and dedupes', () => {
    const input = [
      'CVE-2021-44228',
      'CVE-2021-44228', // duplicate — must dedupe
      'GHSA-jfh8-c2jp-5v3q', // GHSA — must drop
      'CVE-2024-1234567',
      'not a real id', // malformed — must drop
      '',
    ];
    const result = dedupeCveIds(input);
    expect(result.sort()).toEqual(['CVE-2021-44228', 'CVE-2024-1234567']);
  });

  it('returns empty array for empty / nullish input', () => {
    expect(dedupeCveIds([])).toEqual([]);
    expect(dedupeCveIds(null as any)).toEqual([]);
    expect(dedupeCveIds(undefined as any)).toEqual([]);
  });

  it('returns empty array when no input ids are valid CVEs', () => {
    expect(dedupeCveIds(['GHSA-jfh8-c2jp-5v3q', 'GHSA-vwcq-pjj7-rhpv'])).toEqual([]);
  });
});

describe('applyThreatIntelPriority', () => {
  function enr(overrides: Partial<FindingEnrichment> = {}): FindingEnrichment {
    return { ...emptyEnrichment(), ...overrides };
  }

  it('leaves severity unchanged and emits no prefix when enrichment is empty', () => {
    const result = applyThreatIntelPriority({ severity: 'medium', cvssScore: 5.5 }, enr());
    expect(result.severity).toBe('medium');
    expect(result.prefixLines).toEqual([]);
  });

  it('KEV-listed bumps any starting severity straight to critical', () => {
    for (const start of ['low', 'medium', 'high', 'critical'] as const) {
      const result = applyThreatIntelPriority(
        { severity: start, cvssScore: 5.0 },
        enr({ kevListed: true, kevDueDate: '2021-12-24', kevKnownRansomware: true })
      );
      expect(result.severity).toBe('critical');
      expect(result.prefixLines.length).toBe(1);
      expect(result.prefixLines[0]).toContain('CISA KEV-listed');
      expect(result.prefixLines[0]).toContain('2021-12-24');
      expect(result.prefixLines[0]).toContain('ransomware');
      expect(result.prefixLines[0]).toContain('CRA Art. 14');
    }
  });

  it('KEV-listed without due date or ransomware emits a clean prefix', () => {
    const result = applyThreatIntelPriority(
      { severity: 'medium', cvssScore: 5.0 },
      enr({ kevListed: true })
    );
    expect(result.severity).toBe('critical');
    expect(result.prefixLines[0]).toContain('CISA KEV-listed');
    expect(result.prefixLines[0]).not.toContain('federal due date');
    expect(result.prefixLines[0]).not.toContain('ransomware');
  });

  it('EPSS ≥ 0.9 (no KEV) bumps severity exactly one tier', () => {
    expect(applyThreatIntelPriority({ severity: 'low', cvssScore: 3.0 }, enr({ epssScore: 0.95, epssPercentile: 0.99 })).severity).toBe('medium');
    expect(applyThreatIntelPriority({ severity: 'medium', cvssScore: 5.0 }, enr({ epssScore: 0.95, epssPercentile: 0.99 })).severity).toBe('high');
    expect(applyThreatIntelPriority({ severity: 'high', cvssScore: 7.5 }, enr({ epssScore: 0.95, epssPercentile: 0.99 })).severity).toBe('critical');
  });

  it('EPSS ≥ 0.9 caps at critical (already-critical stays critical)', () => {
    const result = applyThreatIntelPriority({ severity: 'critical', cvssScore: 9.5 }, enr({ epssScore: 0.99, epssPercentile: 0.999 }));
    expect(result.severity).toBe('critical');
  });

  it('EPSS bump emits an EPSS-evidence prefix line with score and percentile', () => {
    const result = applyThreatIntelPriority(
      { severity: 'medium', cvssScore: 5.0 },
      enr({ epssScore: 0.9234, epssPercentile: 0.9876 })
    );
    expect(result.prefixLines.length).toBe(1);
    expect(result.prefixLines[0]).toContain('EPSS 0.9234');
    expect(result.prefixLines[0]).toContain('98.8th percentile');
    expect(result.prefixLines[0]).toContain('Prioritise remediation');
  });

  it('EPSS < 0.01 + CVSS < 4.0 (no KEV) caps severity at low and emits a deprioritise prefix', () => {
    const result = applyThreatIntelPriority(
      { severity: 'medium', cvssScore: 3.5 },
      enr({ epssScore: 0.0005, epssPercentile: 0.05 })
    );
    expect(result.severity).toBe('low');
    expect(result.prefixLines[0]).toContain('Low exploitation probability');
    expect(result.prefixLines[0]).toContain('EPSS 0.0005');
    expect(result.prefixLines[0]).toContain('low CVSS (3.5)');
  });

  it('EPSS < 0.01 but CVSS ≥ 4.0 leaves severity unchanged (deprioritise gate is conjunctive)', () => {
    const result = applyThreatIntelPriority(
      { severity: 'medium', cvssScore: 5.5 },
      enr({ epssScore: 0.0005, epssPercentile: 0.05 })
    );
    expect(result.severity).toBe('medium');
    expect(result.prefixLines).toEqual([]);
  });

  it('KEV beats deprioritise: low EPSS does not undo a KEV bump', () => {
    const result = applyThreatIntelPriority(
      { severity: 'medium', cvssScore: 3.0 },
      enr({ kevListed: true, epssScore: 0.0005, epssPercentile: 0.05 })
    );
    expect(result.severity).toBe('critical');
    expect(result.prefixLines[0]).toContain('CISA KEV-listed');
    // Deprioritise prefix must not appear when KEV is listed
    expect(result.prefixLines.some(l => l.includes('Low exploitation probability'))).toBe(false);
  });

  it('EPSS just below the bump threshold (0.89) does not bump', () => {
    const result = applyThreatIntelPriority(
      { severity: 'medium', cvssScore: 5.5 },
      enr({ epssScore: 0.89, epssPercentile: 0.89 })
    );
    expect(result.severity).toBe('medium');
    expect(result.prefixLines).toEqual([]);
  });

  it('respects a custom policy override', () => {
    const policy = { epssBumpThreshold: 0.5, epssDeprioritiseThreshold: 0.05 };
    expect(applyThreatIntelPriority({ severity: 'low', cvssScore: 3.0 }, enr({ epssScore: 0.55, epssPercentile: 0.7 }), policy).severity).toBe('medium');
    // Same input under default policy (0.9 threshold) wouldn't bump
    expect(applyThreatIntelPriority({ severity: 'low', cvssScore: 3.0 }, enr({ epssScore: 0.55, epssPercentile: 0.7 })).severity).toBe('low');
  });

  it('default policy thresholds match the documented values (0.9 / 0.01)', () => {
    expect(DEFAULT_THREAT_INTEL_POLICY.epssBumpThreshold).toBe(0.9);
    expect(DEFAULT_THREAT_INTEL_POLICY.epssDeprioritiseThreshold).toBe(0.01);
  });

  it('treats unknown / blank starting severity as medium for ranking purposes', () => {
    expect(applyThreatIntelPriority({ severity: '' as any, cvssScore: null }, enr({ kevListed: true })).severity).toBe('critical');
    expect(applyThreatIntelPriority({ severity: 'unknown' as any, cvssScore: null }, enr({ epssScore: 0.95, epssPercentile: 0.99 })).severity).toBe('high');
  });
});
