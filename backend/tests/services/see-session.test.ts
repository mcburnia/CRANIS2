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
 * SEE Session Service — Unit Tests
 *
 * Tests competence signal detection: domain detection, industry
 * reference detection, decision quality assessment, and competence
 * level assessment. Pure functions — no database required.
 *
 * Note: The exported service functions (startSession, recordTurn, etc.)
 * require DB access and are tested via the route integration tests.
 * This file tests the internal detection logic by importing the patterns
 * and using similar logic.
 */

import { describe, it, expect } from 'vitest';

// We cannot import private functions directly, so we replicate the detection
// patterns here for unit testing. The route integration tests in
// see-estimator.test.ts cover the end-to-end session lifecycle.

// ─── Domain Detection Patterns (mirrored from see-session.ts) ────

const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  'Security': [/\bsecurity\b/i, /\bvulnerab/i, /\bcve\b/i, /\bcvss\b/i, /\bcrypto/i, /\bencrypt/i, /\bowasp\b/i, /\bpenetration/i, /\bthreat\b/i],
  'Compliance': [/\bcompliance\b/i, /\bregulat/i, /\bcra\b/i, /\bnis2\b/i, /\bgdpr\b/i, /\bdora\b/i, /\bannex\b/i, /\barticle\s+\d/i, /\bobligation/i],
  'Architecture': [/\barchitect/i, /\bmicroservice/i, /\bmonolith/i, /\bscalab/i, /\bload\s+balanc/i, /\bdatabase\s+design/i, /\bgraph\s+database/i, /\bneo4j\b/i],
  'Frontend': [/\breact\b/i, /\bcomponent/i, /\bcss\b/i, /\bresponsive/i, /\bux\b/i, /\bui\b/i, /\bvite\b/i, /\btypescript\b/i],
  'Backend': [/\bexpress\b/i, /\bapi\b/i, /\bendpoint/i, /\bmiddleware/i, /\bpostgres/i, /\bdatabase/i, /\bquery\b/i, /\brest\b/i],
  'DevOps': [/\bdocker\b/i, /\bnginx\b/i, /\bci\/cd\b/i, /\bpipeline/i, /\bdeploy/i, /\bcontainer/i, /\bkubernetes/i],
  'Testing': [/\btest/i, /\bvitest\b/i, /\bjest\b/i, /\bplaywright\b/i, /\be2e\b/i, /\bunit\s+test/i, /\bcoverage/i],
  'Data Modelling': [/\bschema\b/i, /\bmigration/i, /\brelation/i, /\bgraph\s+model/i, /\bentity/i, /\bnormali[sz]/i],
  'AI/ML': [/\bai\b/i, /\bmachine\s+learn/i, /\bllm\b/i, /\bclaude\b/i, /\bcopilot\b/i, /\bprompt/i, /\btoken/i, /\bmodel\b/i],
  'Product Management': [/\buser\s+stor/i, /\brequirement/i, /\bstakeholder/i, /\broadmap/i, /\bprioritise/i, /\bbacklog/i, /\bscope\b/i],
};

const INDUSTRY_REFERENCE_PATTERNS = [
  /\biso\s*\d{4,5}/i, /\bnist\b/i, /\benisa\b/i, /\bowasp\b/i, /\bcwe-\d+/i,
  /\beidas\b/i, /\brfc\s*\d{3,4}/i, /\bfips\b/i, /\betsi\b/i,
  /\bcra\s+(art|article|annex)/i, /\bnis2\s+(art|directive)/i,
  /\bgdpr\s+(art|article)/i, /\bdora\s+(art|article)/i,
  /\bai\s+act/i, /\bcyber\s+resilience/i,
  /\bspdx\b/i, /\bcyclonedx\b/i, /\bsbom\b/i, /\boscal\b/i,
  /\bsoc\s*2\b/i, /\bpci\b/i, /\bhipaa\b/i,
];

function detectDomains(text: string): string[] {
  const found: string[] = [];
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    if (patterns.some(p => p.test(text))) found.push(domain);
  }
  return found;
}

function detectIndustryRefs(text: string): string[] {
  const refs: string[] = [];
  for (const pattern of INDUSTRY_REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) refs.push(match[0]);
  }
  return refs;
}

function assessDecisionQuality(turnCount: number, humanTurns: number, domains: string[]): string {
  if (humanTurns < 3) return 'insufficient_data';
  if (domains.length >= 5 && humanTurns >= 10) return 'senior';
  if (domains.length >= 3 && humanTurns >= 5) return 'experienced';
  if (domains.length >= 2) return 'competent';
  return 'developing';
}

function assessCompetenceLevel(
  totalSessions: number,
  totalDomains: number,
  industryRefCount: number,
  avgDecisionQuality: string,
): string {
  if (totalDomains >= 6 && industryRefCount >= 5 && avgDecisionQuality === 'senior') return 'senior_architect';
  if (totalDomains >= 4 && industryRefCount >= 3) return 'senior_engineer';
  if (totalDomains >= 3 && industryRefCount >= 1) return 'mid_engineer';
  if (totalDomains >= 2) return 'junior_engineer';
  return 'developing';
}

// ═══════════════════════════════════════════════════════════════════
// Domain Detection
// ═══════════════════════════════════════════════════════════════════

describe('detectDomains', () => {
  it('detects Security domain', () => {
    expect(detectDomains('We need to fix this CVE-2024-1234 vulnerability')).toContain('Security');
  });

  it('detects Compliance domain', () => {
    expect(detectDomains('The CRA requires SBOM generation for Article 13 compliance')).toContain('Compliance');
  });

  it('detects Architecture domain', () => {
    expect(detectDomains('We should consider a microservice architecture for scalability')).toContain('Architecture');
  });

  it('detects Frontend domain', () => {
    expect(detectDomains('Build the React component with responsive CSS')).toContain('Frontend');
  });

  it('detects Backend domain', () => {
    expect(detectDomains('Add a new Express API endpoint with middleware')).toContain('Backend');
  });

  it('detects DevOps domain', () => {
    expect(detectDomains('Update the Docker container and CI/CD pipeline')).toContain('DevOps');
  });

  it('detects Testing domain', () => {
    expect(detectDomains('Write unit tests with vitest for the auth module')).toContain('Testing');
  });

  it('detects Data Modelling domain', () => {
    expect(detectDomains('Create a schema migration for the new entity relationship')).toContain('Data Modelling');
  });

  it('detects AI/ML domain', () => {
    expect(detectDomains('Configure the Claude LLM copilot prompt tokens')).toContain('AI/ML');
  });

  it('detects Product Management domain', () => {
    expect(detectDomains('Review the user story requirements and update the backlog')).toContain('Product Management');
  });

  it('detects multiple domains in complex text', () => {
    const text = 'Implement the Express API endpoint for CRA compliance with Docker deployment and React frontend';
    const domains = detectDomains(text);
    expect(domains).toContain('Backend');
    expect(domains).toContain('Compliance');
    expect(domains).toContain('DevOps');
    expect(domains).toContain('Frontend');
  });

  it('returns empty for unrelated text', () => {
    expect(detectDomains('What is the weather today?')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Industry Reference Detection
// ═══════════════════════════════════════════════════════════════════

describe('detectIndustryRefs', () => {
  it('detects ISO references', () => {
    const refs = detectIndustryRefs('This aligns with ISO 27001 requirements');
    expect(refs).toContain('ISO 27001');
  });

  it('detects NIST references', () => {
    const refs = detectIndustryRefs('Following NIST framework guidelines');
    expect(refs).toContain('NIST');
  });

  it('detects ENISA references', () => {
    const refs = detectIndustryRefs('Report to ENISA within 24 hours');
    expect(refs).toContain('ENISA');
  });

  it('detects OWASP references', () => {
    const refs = detectIndustryRefs('Check OWASP top 10 vulnerabilities');
    expect(refs).toContain('OWASP');
  });

  it('detects CWE references', () => {
    const refs = detectIndustryRefs('This is CWE-79 cross-site scripting');
    expect(refs).toContain('CWE-79');
  });

  it('detects RFC references', () => {
    const refs = detectIndustryRefs('Implement RFC 3161 timestamping');
    expect(refs).toContain('RFC 3161');
  });

  it('detects CRA article references', () => {
    const refs = detectIndustryRefs('As required by CRA Article 14');
    // Pattern matches "CRA Art" or "CRA article" — check any match exists
    expect(refs.some(r => /cra\s+art/i.test(r))).toBe(true);
  });

  it('detects SBOM references', () => {
    const refs = detectIndustryRefs('Generate an SBOM in CycloneDX format');
    expect(refs.some(r => /sbom/i.test(r))).toBe(true);
  });

  it('detects OSCAL references', () => {
    const refs = detectIndustryRefs('Export compliance data in OSCAL format');
    expect(refs).toContain('OSCAL');
  });

  it('returns empty for text without industry references', () => {
    expect(detectIndustryRefs('Just a normal conversation about coding')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Decision Quality Assessment
// ═══════════════════════════════════════════════════════════════════

describe('assessDecisionQuality', () => {
  it('returns insufficient_data with few human turns', () => {
    expect(assessDecisionQuality(5, 2, ['Security'])).toBe('insufficient_data');
  });

  it('returns developing with few domains', () => {
    expect(assessDecisionQuality(10, 5, ['Backend'])).toBe('developing');
  });

  it('returns competent with 2 domains', () => {
    expect(assessDecisionQuality(10, 5, ['Backend', 'Security'])).toBe('competent');
  });

  it('returns experienced with 3+ domains and 5+ human turns', () => {
    expect(assessDecisionQuality(15, 7, ['Backend', 'Security', 'Testing'])).toBe('experienced');
  });

  it('returns senior with 5+ domains and 10+ human turns', () => {
    expect(assessDecisionQuality(25, 12, ['Backend', 'Security', 'Testing', 'Architecture', 'Compliance'])).toBe('senior');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Competence Level Assessment
// ═══════════════════════════════════════════════════════════════════

describe('assessCompetenceLevel', () => {
  it('returns developing for minimal evidence', () => {
    expect(assessCompetenceLevel(1, 1, 0, 'developing')).toBe('developing');
  });

  it('returns junior_engineer with 2 domains', () => {
    expect(assessCompetenceLevel(2, 2, 0, 'competent')).toBe('junior_engineer');
  });

  it('returns mid_engineer with 3 domains and 1 industry ref', () => {
    expect(assessCompetenceLevel(3, 3, 1, 'competent')).toBe('mid_engineer');
  });

  it('returns senior_engineer with 4 domains and 3 industry refs', () => {
    expect(assessCompetenceLevel(5, 4, 3, 'experienced')).toBe('senior_engineer');
  });

  it('returns senior_architect at highest level', () => {
    expect(assessCompetenceLevel(10, 6, 5, 'senior')).toBe('senior_architect');
  });
});
