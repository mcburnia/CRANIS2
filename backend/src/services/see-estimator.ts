/**
 * SEE Estimator Service — Software Evidence Engine Phase A
 *
 * File classification, LOC counting, and effort/cost estimation.
 * Deterministic — no AI, pure analysis and parametric estimation.
 *
 * Primary use case: R&D tax credit evidence.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { listRepoFiles, getFileContent } from './repo-provider.js';
import { resolveRepoConnection } from './repo-helpers.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export type FileClassification = 'production' | 'test' | 'config' | 'generated' | 'vendor' | 'docs';

export interface ClassifiedFile {
  path: string;
  language: string | null;
  classification: FileClassification;
  loc: number;
}

export interface LanguageBreakdown {
  [language: string]: { loc: number; files: number; productionLoc: number; testLoc: number };
}

export interface EffortEstimate {
  low: number;
  mid: number;
  high: number;
}

export interface SEEAnalysisResult {
  id: string;
  productId: string;
  scanStatus: string;
  completedAt: string | null;
  createdAt: string;
  // Code metrics
  totalFiles: number;
  totalLoc: number;
  productionLoc: number;
  testLoc: number;
  configLoc: number;
  generatedLoc: number;
  vendorLoc: number;
  docsLoc: number;
  languageBreakdown: LanguageBreakdown;
  // Effort/cost
  effortMonths: EffortEstimate;
  costEur: EffortEstimate;
  teamSize: EffortEstimate;
  rebuildMonths: EffortEstimate;
  // Complexity
  complexityCategory: string;
  complexityMultiplier: number;
  // Assumptions
  assumptions: Record<string, any>;
  // Summary
  executiveSummary: string;
}

// ─── File Classification ────────────────────────────────────────────

const TEST_PATTERNS = [
  /[/\\]tests?[/\\]/i,
  /[/\\]__tests__[/\\]/i,
  /[/\\]spec[/\\]/i,
  /[/\\]__mocks__[/\\]/i,
  /[/\\]fixtures[/\\]/i,
  /[/\\]test-helpers?[/\\]/i,
  /\.test\.[a-z]+$/i,
  /\.spec\.[a-z]+$/i,
  /_test\.(go|py|rb)$/i,
  /test_[^/\\]+\.py$/i,
  /[/\\]conftest\.py$/i,
  /[/\\]jest\.[a-z.]+$/i,
  /[/\\]vitest\.[a-z.]+$/i,
  /[/\\]cypress[/\\]/i,
  /[/\\]playwright[/\\]/i,
  /[/\\]e2e[/\\]/i,
];

const CONFIG_PATTERNS = [
  /^\./, // dotfiles at root
  /[/\\]\.[^/\\]+$/, // dotfiles anywhere
  /\.config\.[a-z]+$/i,
  /tsconfig[^/\\]*\.json$/i,
  /package\.json$/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /Cargo\.toml$/i,
  /Cargo\.lock$/i,
  /go\.mod$/i,
  /go\.sum$/i,
  /Gemfile$/i,
  /Gemfile\.lock$/i,
  /requirements\.txt$/i,
  /Pipfile$/i,
  /Pipfile\.lock$/i,
  /pyproject\.toml$/i,
  /composer\.json$/i,
  /composer\.lock$/i,
  /Makefile$/i,
  /CMakeLists\.txt$/i,
  /Dockerfile$/i,
  /docker-compose[^/\\]*\.ya?ml$/i,
  /\.github[/\\]/i,
  /\.gitlab-ci\.ya?ml$/i,
  /\.circleci[/\\]/i,
  /\.travis\.ya?ml$/i,
  /Jenkinsfile$/i,
  /\.editorconfig$/i,
  /\.eslintrc/i,
  /\.prettierrc/i,
  /\.husky[/\\]/i,
  /terraform[/\\]/i,
  /\.tf$/i,
  /ansible[/\\]/i,
  /helm[/\\]/i,
  /k8s[/\\]/i,
  /kubernetes[/\\]/i,
];

const GENERATED_PATTERNS = [
  /[/\\]node_modules[/\\]/i,
  /[/\\]dist[/\\]/i,
  /[/\\]build[/\\]/i,
  /[/\\]\.next[/\\]/i,
  /[/\\]\.nuxt[/\\]/i,
  /[/\\]out[/\\]/i,
  /[/\\]target[/\\]/i,
  /[/\\]coverage[/\\]/i,
  /[/\\]\.cache[/\\]/i,
  /[/\\]__pycache__[/\\]/i,
  /[/\\]generated[/\\]/i,
  /[/\\]__generated__[/\\]/i,
  /[/\\]\.dart_tool[/\\]/i,
  /\.min\.[a-z]+$/i,
  /\.bundle\.[a-z]+$/i,
  /\.compiled\.[a-z]+$/i,
  /\.map$/i,
  /\.lock$/i,
];

const VENDOR_PATTERNS = [
  /[/\\]vendor[/\\]/i,
  /[/\\]third_party[/\\]/i,
  /[/\\]extern[/\\]/i,
  /[/\\]deps[/\\]/i,
  /[/\\]lib[/\\].*[/\\]vendor[/\\]/i,
];

const DOCS_PATTERNS = [
  /[/\\]docs?[/\\]/i,
  /\.md$/i,
  /\.rst$/i,
  /\.txt$/i,
  /LICENSE/i,
  /CHANGELOG/i,
  /CONTRIBUTING/i,
  /AUTHORS/i,
  /\.adoc$/i,
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.db', '.sqlite', '.sqlite3',
  '.wasm', '.class', '.pyc', '.pyo',
]);

export function classifyFile(filepath: string): FileClassification {
  // Order matters: more specific patterns first
  if (GENERATED_PATTERNS.some(p => p.test(filepath))) return 'generated';
  if (VENDOR_PATTERNS.some(p => p.test(filepath))) return 'vendor';
  if (TEST_PATTERNS.some(p => p.test(filepath))) return 'test';
  if (DOCS_PATTERNS.some(p => p.test(filepath))) return 'docs';
  if (CONFIG_PATTERNS.some(p => p.test(filepath))) return 'config';
  return 'production';
}

// ─── Language Detection ─────────────────────────────────────────────

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.cs': 'C#',
  '.c': 'C', '.h': 'C',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
  '.swift': 'Swift',
  '.php': 'PHP',
  '.scala': 'Scala',
  '.dart': 'Dart',
  '.lua': 'Lua',
  '.r': 'R', '.R': 'R',
  '.m': 'Objective-C', '.mm': 'Objective-C',
  '.ex': 'Elixir', '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.clj': 'Clojure', '.cljs': 'Clojure',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.html': 'HTML', '.htm': 'HTML',
  '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
  '.sql': 'SQL',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.ps1': 'PowerShell',
  '.yml': 'YAML', '.yaml': 'YAML',
  '.json': 'JSON',
  '.xml': 'XML',
  '.toml': 'TOML',
  '.proto': 'Protocol Buffers',
  '.graphql': 'GraphQL', '.gql': 'GraphQL',
  '.tf': 'Terraform',
  '.sol': 'Solidity',
};

export function detectLanguage(filepath: string): string | null {
  const ext = filepath.substring(filepath.lastIndexOf('.')).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
}

function isBinaryFile(filepath: string): boolean {
  const ext = filepath.substring(filepath.lastIndexOf('.')).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// ─── LOC Counting ───────────────────────────────────────────────────

const COMMENT_PATTERNS: Record<string, RegExp[]> = {
  'TypeScript':  [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'JavaScript':  [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'Python':      [/^\s*#/, /^\s*"""/, /^\s*'''/],
  'Ruby':        [/^\s*#/],
  'Go':          [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'Rust':        [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'Java':        [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'C':           [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'C++':         [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'C#':          [/^\s*\/\//, /^\s*\/?\*/, /^\s*\*\//],
  'PHP':         [/^\s*\/\//, /^\s*#/, /^\s*\/?\*/, /^\s*\*\//],
  'Shell':       [/^\s*#/],
  'HTML':        [/^\s*<!--/, /^\s*-->/],
  'CSS':         [/^\s*\/?\*/, /^\s*\*\//],
  'SQL':         [/^\s*--/],
};

export function countLOC(content: string, language: string | null): number {
  const lines = content.split('\n');
  const commentPats = language ? (COMMENT_PATTERNS[language] || []) : [];

  let loc = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue; // blank line
    if (commentPats.some(p => p.test(trimmed))) continue; // comment
    loc++;
  }
  return loc;
}

// ─── Complexity Detection ───────────────────────────────────────────

interface ComplexitySignals {
  hasDocker: boolean;
  hasCICD: boolean;
  hasIaC: boolean;
  hasDatabase: boolean;
  hasMultipleLanguages: boolean;
  hasAPIRoutes: boolean;
  hasGraphDB: boolean;
  hasTestSuite: boolean;
  languageCount: number;
  moduleCount: number;
}

function detectComplexitySignals(files: string[]): ComplexitySignals {
  const signals: ComplexitySignals = {
    hasDocker: false,
    hasCICD: false,
    hasIaC: false,
    hasDatabase: false,
    hasMultipleLanguages: false,
    hasAPIRoutes: false,
    hasGraphDB: false,
    hasTestSuite: false,
    languageCount: 0,
    moduleCount: 0,
  };

  const languages = new Set<string>();
  const topDirs = new Set<string>();

  for (const f of files) {
    if (/Dockerfile/i.test(f) || /docker-compose/i.test(f)) signals.hasDocker = true;
    if (/\.github[/\\]workflows/i.test(f) || /\.gitlab-ci/i.test(f) || /Jenkinsfile/i.test(f)) signals.hasCICD = true;
    if (/terraform/i.test(f) || /\.tf$/i.test(f) || /ansible/i.test(f) || /helm/i.test(f)) signals.hasIaC = true;
    if (/migration/i.test(f) || /schema\.sql/i.test(f) || /\.sql$/i.test(f)) signals.hasDatabase = true;
    if (/routes?[/\\]/i.test(f) || /controllers?[/\\]/i.test(f) || /api[/\\]/i.test(f)) signals.hasAPIRoutes = true;
    if (/neo4j/i.test(f) || /graph/i.test(f) || /cypher/i.test(f)) signals.hasGraphDB = true;
    if (TEST_PATTERNS.some(p => p.test(f))) signals.hasTestSuite = true;

    const lang = detectLanguage(f);
    if (lang && !['JSON', 'YAML', 'TOML', 'XML'].includes(lang)) languages.add(lang);

    const parts = f.split(/[/\\]/);
    if (parts.length > 1) topDirs.add(parts[0]);
  }

  signals.languageCount = languages.size;
  signals.hasMultipleLanguages = languages.size >= 3;
  signals.moduleCount = topDirs.size;

  return signals;
}

type ComplexityCategory = 'simple' | 'standard' | 'multi_tier' | 'distributed' | 'regulated' | 'specialised';

const COMPLEXITY_MULTIPLIERS: Record<ComplexityCategory, number> = {
  simple: 1.0,
  standard: 1.1,
  multi_tier: 1.2,
  distributed: 1.3,
  regulated: 1.4,
  specialised: 1.5,
};

function inferComplexity(signals: ComplexitySignals): { category: ComplexityCategory; multiplier: number } {
  let score = 0;

  // Standard web app signals (common, low weight)
  if (signals.hasDocker) score += 1;
  if (signals.hasCICD) score += 1;
  if (signals.hasDatabase) score += 1;
  if (signals.hasAPIRoutes) score += 1;
  if (signals.hasTestSuite) score += 1;

  // Genuine complexity signals (higher weight)
  if (signals.hasIaC) score += 2;
  if (signals.hasGraphDB) score += 2;
  if (signals.hasMultipleLanguages) score += 1;
  if (signals.languageCount >= 5) score += 1;
  if (signals.moduleCount >= 15) score += 1;

  let category: ComplexityCategory;
  if (score <= 3) category = 'simple';
  else if (score <= 5) category = 'standard';
  else if (score <= 7) category = 'multi_tier';
  else if (score <= 9) category = 'distributed';
  else if (score <= 11) category = 'regulated';
  else category = 'specialised';

  return { category, multiplier: COMPLEXITY_MULTIPLIERS[category] };
}

// ─── Effort / Cost Calculation ──────────────────────────────────────

const DEFAULT_ASSUMPTIONS = {
  // LOC per engineer-month (fully tested, production-ready)
  // These reflect modern development with frameworks, libraries, and tooling.
  // Traditional COCOMO estimates (200-500) assumed 1990s practices.
  locPerMonthLow: 800,     // complex/regulated domain, thorough testing
  locPerMonthMid: 1500,    // typical commercial SaaS with modern tooling
  locPerMonthHigh: 3000,   // greenfield, well-understood domain, AI-assisted

  // Daily cost in EUR
  dailyRateLow: 400,       // junior/nearshore
  dailyRateMid: 650,       // mid-senior
  dailyRateHigh: 950,      // senior specialist

  // Working days per month
  workingDaysPerMonth: 20,

  // Test code effort weight (tests are simpler per line but represent real effort)
  testCodeWeight: 0.3,

  // Language effort adjusters (higher = less effort per line, i.e. more LOC per unit of effort)
  // A value of 2.0 means this language produces 2x LOC for the same effort, so its LOC is
  // divided by 2.0 to get "effort-equivalent LOC".
  languageAdjusters: {
    'C': 0.5, 'C++': 0.5, 'Assembly': 0.3,
    'Java': 0.8, 'C#': 0.8, 'Kotlin': 0.9,
    'Go': 0.8, 'Rust': 0.7,
    'Python': 1.0, 'Ruby': 1.0, 'PHP': 1.0,
    'TypeScript': 1.0, 'JavaScript': 1.0,
    'HTML': 5.0, 'CSS': 4.0, 'SCSS': 3.0, 'Sass': 3.0, 'Less': 3.0,
    'SQL': 2.0,
    'Shell': 2.5,
    'YAML': 8.0, 'JSON': 10.0, 'XML': 8.0, 'TOML': 8.0,
    'Vue': 1.2, 'Svelte': 1.2,
    'GraphQL': 3.0, 'Protocol Buffers': 3.0,
    'Terraform': 2.0,
  } as Record<string, number>,
};

function calculateEffort(
  languageBreakdown: LanguageBreakdown,
  testLoc: number,
  complexity: { category: ComplexityCategory; multiplier: number },
  assumptions: typeof DEFAULT_ASSUMPTIONS,
): {
  effortMonths: EffortEstimate;
  costEur: EffortEstimate;
  teamSize: EffortEstimate;
  rebuildMonths: EffortEstimate;
} {
  // Calculate language-adjusted effective LOC
  let adjustedLoc = 0;
  for (const [lang, data] of Object.entries(languageBreakdown)) {
    const adjuster = assumptions.languageAdjusters[lang] || 1.0;
    adjustedLoc += data.productionLoc / adjuster;
  }

  // Add weighted test LOC
  adjustedLoc += testLoc * assumptions.testCodeWeight;

  // Apply complexity multiplier
  adjustedLoc *= complexity.multiplier;

  // Effort in engineer-months (three scenarios)
  const effortMonths: EffortEstimate = {
    high: Math.round(adjustedLoc / assumptions.locPerMonthLow * 10) / 10,
    mid: Math.round(adjustedLoc / assumptions.locPerMonthMid * 10) / 10,
    low: Math.round(adjustedLoc / assumptions.locPerMonthHigh * 10) / 10,
  };

  // Cost in EUR
  const costEur: EffortEstimate = {
    low: Math.round(effortMonths.low * assumptions.workingDaysPerMonth * assumptions.dailyRateLow),
    mid: Math.round(effortMonths.mid * assumptions.workingDaysPerMonth * assumptions.dailyRateMid),
    high: Math.round(effortMonths.high * assumptions.workingDaysPerMonth * assumptions.dailyRateHigh),
  };

  // Team size estimate — scale with effort rather than fixed duration
  // Small projects (< 12 months effort): 1-2 people
  // Medium projects (12-48 months): 2-5 people
  // Large projects (48+ months): 5+ people
  const teamSize: EffortEstimate = {
    low: Math.max(1, Math.ceil(effortMonths.low / 12)),
    mid: Math.max(1, Math.ceil(effortMonths.mid / 12)),
    high: Math.max(1, Math.ceil(effortMonths.high / 12)),
  };

  // Rebuild duration (Brooks's law efficiency: 1 / (1 + 0.1 * (team - 1)))
  const rebuildMonths: EffortEstimate = {
    low: Math.round(effortMonths.low / teamSize.low * (1 + 0.1 * (teamSize.low - 1)) * 10) / 10,
    mid: Math.round(effortMonths.mid / teamSize.mid * (1 + 0.1 * (teamSize.mid - 1)) * 10) / 10,
    high: Math.round(effortMonths.high / teamSize.high * (1 + 0.1 * (teamSize.high - 1)) * 10) / 10,
  };

  return { effortMonths, costEur, teamSize, rebuildMonths };
}

// ─── Executive Summary Generator ────────────────────────────────────

function generateExecutiveSummary(
  productName: string,
  totalLoc: number,
  productionLoc: number,
  testLoc: number,
  languageBreakdown: LanguageBreakdown,
  complexity: { category: ComplexityCategory; multiplier: number },
  effortMonths: EffortEstimate,
  costEur: EffortEstimate,
  teamSize: EffortEstimate,
): string {
  const languages = Object.keys(languageBreakdown).filter(l => !['JSON', 'YAML', 'XML', 'TOML'].includes(l));
  const primaryLang = languages.length > 0 ? languages.sort((a, b) =>
    (languageBreakdown[b]?.productionLoc || 0) - (languageBreakdown[a]?.productionLoc || 0)
  )[0] : 'unknown';

  const testRatio = totalLoc > 0 ? Math.round(testLoc / totalLoc * 100) : 0;

  const complexityLabel: Record<ComplexityCategory, string> = {
    simple: 'a relatively simple',
    standard: 'a standard commercial',
    multi_tier: 'a multi-tier',
    distributed: 'a distributed',
    regulated: 'a regulated and compliance-oriented',
    specialised: 'a highly specialised',
  };

  const effortYearsLow = Math.round(effortMonths.low / 12 * 10) / 10;
  const effortYearsHigh = Math.round(effortMonths.high / 12 * 10) / 10;

  return `This repository contains approximately ${totalLoc.toLocaleString()} logical lines of code, of which ${productionLoc.toLocaleString()} are production code and ${testLoc.toLocaleString()} are test code (${testRatio}% test coverage by volume). The primary language is ${primaryLang}, with ${languages.length} programming languages in use.

The codebase represents ${complexityLabel[complexity.category]} software system (complexity multiplier: ${complexity.multiplier}x).

Based on industry productivity benchmarks, the estimated engineering effort to build this system from scratch ranges from ${effortMonths.low} to ${effortMonths.high} engineer-months (${effortYearsLow} to ${effortYearsHigh} engineer-years). At prevailing European developer rates, this represents an estimated development cost of EUR ${costEur.low.toLocaleString()} to EUR ${costEur.high.toLocaleString()}.

A rebuild with a team of ${teamSize.low} to ${teamSize.high} engineers would likely take ${Math.round(effortMonths.low / teamSize.low)} to ${Math.round(effortMonths.high / teamSize.high)} months.

These estimates assume fully tested, production-ready code delivered by experienced engineers. Actual costs may vary based on team composition, domain expertise, regulatory requirements, and organisational factors. All assumptions and calculation methodology are documented in the detailed report.`;
}

// ─── Markdown Report ────────────────────────────────────────────────

export function generateEstimateReport(result: SEEAnalysisResult, productName: string): string {
  const lines: string[] = [];

  lines.push(`# Software Evidence Engine — Effort & Cost Estimate`);
  lines.push(`## ${productName}`);
  lines.push(``);
  lines.push(`**Generated:** ${new Date(result.createdAt).toISOString().split('T')[0]}`);
  lines.push(`**Scan ID:** ${result.id}`);
  lines.push(`**Status:** ${result.scanStatus}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Executive Summary`);
  lines.push(``);
  lines.push(result.executiveSummary);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Methodology
  lines.push(`## Methodology`);
  lines.push(``);
  lines.push(`This estimate is produced deterministically from repository analysis. No artificial intelligence is used in the calculation. The methodology follows industry-standard parametric estimation practices.`);
  lines.push(``);
  lines.push(`1. **Source code measurement:** Logical lines of code (LOC) are counted after excluding blank lines and comments. Files are classified as production, test, configuration, generated, vendor, or documentation.`);
  lines.push(`2. **Language weighting:** Each language is weighted by a productivity adjustment factor reflecting the effort per line relative to a baseline.`);
  lines.push(`3. **Complexity adjustment:** A complexity multiplier is applied based on detected architectural signals (CI/CD, infrastructure-as-code, multi-language, database, API complexity).`);
  lines.push(`4. **Effort estimation:** Language-adjusted LOC is divided by productivity benchmarks to produce three scenarios (low, mid, high effort).`);
  lines.push(`5. **Cost estimation:** Effort is multiplied by prevailing European developer rates across three cost tiers.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Code metrics
  lines.push(`## Code Metrics`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total logical LOC | ${result.totalLoc.toLocaleString()} |`);
  lines.push(`| Production LOC | ${result.productionLoc.toLocaleString()} |`);
  lines.push(`| Test LOC | ${result.testLoc.toLocaleString()} |`);
  lines.push(`| Configuration LOC | ${result.configLoc.toLocaleString()} |`);
  lines.push(`| Generated/vendor LOC | ${(result.generatedLoc + result.vendorLoc).toLocaleString()} |`);
  lines.push(`| Documentation LOC | ${result.docsLoc.toLocaleString()} |`);
  lines.push(`| Total files analysed | ${result.totalFiles.toLocaleString()} |`);
  lines.push(``);

  // Language breakdown
  lines.push(`## Language Breakdown`);
  lines.push(``);
  lines.push(`| Language | Files | Production LOC | Test LOC | % of Total |`);
  lines.push(`|----------|-------|---------------|----------|-----------|`);
  const sorted = Object.entries(result.languageBreakdown)
    .filter(([lang]) => !['JSON', 'YAML', 'XML', 'TOML'].includes(lang))
    .sort((a, b) => b[1].loc - a[1].loc);
  for (const [lang, data] of sorted) {
    const pct = result.totalLoc > 0 ? Math.round(data.loc / result.totalLoc * 100) : 0;
    lines.push(`| ${lang} | ${data.files} | ${data.productionLoc.toLocaleString()} | ${data.testLoc.toLocaleString()} | ${pct}% |`);
  }
  lines.push(``);

  // Complexity
  lines.push(`## Complexity Assessment`);
  lines.push(``);
  lines.push(`| Factor | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Category | ${result.complexityCategory} |`);
  lines.push(`| Multiplier | ${result.complexityMultiplier}x |`);
  lines.push(``);

  // Effort
  lines.push(`## Effort Estimate`);
  lines.push(``);
  lines.push(`| Scenario | Engineer-months | Engineer-years | Team size | Rebuild duration |`);
  lines.push(`|----------|----------------|---------------|-----------|-----------------|`);
  lines.push(`| Low | ${result.effortMonths.low} | ${(result.effortMonths.low / 12).toFixed(1)} | ${result.teamSize.low} | ${result.rebuildMonths.low} months |`);
  lines.push(`| Mid | ${result.effortMonths.mid} | ${(result.effortMonths.mid / 12).toFixed(1)} | ${result.teamSize.mid} | ${result.rebuildMonths.mid} months |`);
  lines.push(`| High | ${result.effortMonths.high} | ${(result.effortMonths.high / 12).toFixed(1)} | ${result.teamSize.high} | ${result.rebuildMonths.high} months |`);
  lines.push(``);

  // Cost
  lines.push(`## Cost Estimate`);
  lines.push(``);
  lines.push(`| Scenario | Daily rate | Total cost (EUR) |`);
  lines.push(`|----------|-----------|-----------------|`);
  lines.push(`| Low | EUR ${result.assumptions.dailyRateLow}/day | EUR ${result.costEur.low.toLocaleString()} |`);
  lines.push(`| Mid | EUR ${result.assumptions.dailyRateMid}/day | EUR ${result.costEur.mid.toLocaleString()} |`);
  lines.push(`| High | EUR ${result.assumptions.dailyRateHigh}/day | EUR ${result.costEur.high.toLocaleString()} |`);
  lines.push(``);

  // Assumptions
  lines.push(`## Assumptions`);
  lines.push(``);
  lines.push(`| Assumption | Value |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Productivity (low scenario) | ${result.assumptions.locPerMonthLow} LOC/engineer-month |`);
  lines.push(`| Productivity (mid scenario) | ${result.assumptions.locPerMonthMid} LOC/engineer-month |`);
  lines.push(`| Productivity (high scenario) | ${result.assumptions.locPerMonthHigh} LOC/engineer-month |`);
  lines.push(`| Working days per month | ${result.assumptions.workingDaysPerMonth} |`);
  lines.push(`| Test code effort weight | ${result.assumptions.testCodeWeight}x |`);
  lines.push(`| Complexity multiplier | ${result.complexityMultiplier}x |`);
  lines.push(``);
  lines.push(`These are industry benchmark assumptions. Actual productivity varies by team, domain, and organisational factors.`);
  lines.push(``);

  // Caveats
  lines.push(`## Caveats and Limitations`);
  lines.push(``);
  lines.push(`- This estimate is based on source code analysis only. It does not account for product design, project management, stakeholder coordination, or non-coding engineering activities.`);
  lines.push(`- Generated and vendor code has been excluded from the calculation.`);
  lines.push(`- Comment lines and blank lines are excluded from LOC counts.`);
  lines.push(`- The estimate assumes a from-scratch rebuild. Incremental development or maintenance costs differ significantly.`);
  lines.push(`- Team size estimates assume an 18-month baseline project duration.`);
  lines.push(`- Rebuild duration includes a Brooks's law efficiency adjustment for team scaling.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`*Generated by CRANIS2 Software Evidence Engine. All calculations are deterministic and reproducible from the same repository state.*`);

  return lines.join('\n');
}

// ─── Main Scan Orchestrator ─────────────────────────────────────────

const MAX_FILES_FOR_CONTENT = 2000;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_TOTAL_CONTENT = 50 * 1024 * 1024; // 50MB
const CONCURRENT_FETCHES = 10;

export async function runEstimateScan(
  productId: string,
  orgId: string,
  userId: string,
): Promise<SEEAnalysisResult> {
  // Get repo connection from Neo4j
  const driver = getDriver();
  const neo4jSession = driver.session();
  let repoUrl = '';
  let defaultBranch = '';
  let productName = '';

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
       RETURN p.name AS name, r.url AS repoUrl, r.defaultBranch AS branch`,
      { orgId, productId }
    );
    if (result.records.length === 0) throw new Error('Product not found');
    const rec = result.records[0];
    productName = rec.get('name') || 'Unknown';
    repoUrl = rec.get('repoUrl') || '';
    defaultBranch = rec.get('branch') || 'main';
  } finally {
    await neo4jSession.close();
  }

  if (!repoUrl) throw new Error('No repository connected to this product');

  // Resolve repo connection (token, provider, owner, repo)
  const conn = await resolveRepoConnection(userId, repoUrl);
  if (!conn) throw new Error('Cannot resolve repository connection. Ensure the repository is connected.');

  const { token, provider, owner, repo, instanceUrl } = conn;

  // Create the analysis run record
  const runResult = await pool.query(
    `INSERT INTO see_analysis_runs (product_id, org_id, repo_url, repo_provider, default_branch, scan_status)
     VALUES ($1, $2, $3, $4, $5, 'running') RETURNING id`,
    [productId, orgId, repoUrl, provider, defaultBranch]
  );
  const runId = runResult.rows[0].id;

  try {
    // Fetch file tree
    logger.info(`[SEE] Starting estimate scan for product ${productId}, run ${runId}`);
    const files = await listRepoFiles(provider, token, owner, repo, defaultBranch, instanceUrl || undefined);
    if (!files || files.length === 0) throw new Error('No files found in repository');

    // Filter out binary files
    const sourceFiles = files.filter((f: string) => !isBinaryFile(f));

    // Classify all files by path
    const classified: ClassifiedFile[] = sourceFiles.map((f: string) => ({
      path: f,
      language: detectLanguage(f),
      classification: classifyFile(f),
      loc: 0,
    }));

    // Detect complexity from file paths
    const complexity = inferComplexity(detectComplexitySignals(sourceFiles));

    // Fetch content and count LOC for source files (skip generated/vendor)
    const filesToFetch = classified
      .filter(f => f.classification !== 'generated' && f.classification !== 'vendor' && f.language)
      .slice(0, MAX_FILES_FOR_CONTENT);

    let totalContentBytes = 0;
    const fetchBatches: ClassifiedFile[][] = [];
    for (let i = 0; i < filesToFetch.length; i += CONCURRENT_FETCHES) {
      fetchBatches.push(filesToFetch.slice(i, i + CONCURRENT_FETCHES));
    }

    for (const batch of fetchBatches) {
      if (totalContentBytes >= MAX_TOTAL_CONTENT) break;

      await Promise.allSettled(
        batch.map(async (f) => {
          try {
            const content = await getFileContent(provider, token, owner, repo, defaultBranch, f.path, instanceUrl || undefined);
            if (!content || content.length > MAX_FILE_SIZE) return;
            totalContentBytes += content.length;
            f.loc = countLOC(content, f.language);
          } catch {
            // Skip files we cannot fetch
          }
        })
      );
    }

    // Aggregate metrics
    const languageBreakdown: LanguageBreakdown = {};
    let totalLoc = 0, productionLoc = 0, testLoc = 0, configLoc = 0;
    let generatedLoc = 0, vendorLoc = 0, docsLoc = 0;

    for (const f of classified) {
      totalLoc += f.loc;
      switch (f.classification) {
        case 'production': productionLoc += f.loc; break;
        case 'test': testLoc += f.loc; break;
        case 'config': configLoc += f.loc; break;
        case 'generated': generatedLoc += f.loc; break;
        case 'vendor': vendorLoc += f.loc; break;
        case 'docs': docsLoc += f.loc; break;
      }

      if (f.language && f.loc > 0) {
        if (!languageBreakdown[f.language]) {
          languageBreakdown[f.language] = { loc: 0, files: 0, productionLoc: 0, testLoc: 0 };
        }
        languageBreakdown[f.language].loc += f.loc;
        languageBreakdown[f.language].files += 1;
        if (f.classification === 'production') languageBreakdown[f.language].productionLoc += f.loc;
        if (f.classification === 'test') languageBreakdown[f.language].testLoc += f.loc;
      }
    }

    // Calculate effort and cost
    const assumptions = { ...DEFAULT_ASSUMPTIONS };
    const { effortMonths, costEur, teamSize, rebuildMonths } = calculateEffort(
      languageBreakdown, testLoc, complexity, assumptions
    );

    // Generate executive summary
    const executiveSummary = generateExecutiveSummary(
      productName, totalLoc, productionLoc, testLoc,
      languageBreakdown, complexity, effortMonths, costEur, teamSize
    );

    // Store file detail (top 500 by LOC for the report, not all files)
    const fileDetail = classified
      .filter(f => f.loc > 0)
      .sort((a, b) => b.loc - a.loc)
      .slice(0, 500)
      .map(f => ({ path: f.path, language: f.language, classification: f.classification, loc: f.loc }));

    // Update the run record
    await pool.query(
      `UPDATE see_analysis_runs SET
        total_files = $2, total_loc = $3, production_loc = $4, test_loc = $5,
        config_loc = $6, generated_loc = $7, vendor_loc = $8, docs_loc = $9,
        language_breakdown = $10, file_detail = $11,
        effort_low_months = $12, effort_mid_months = $13, effort_high_months = $14,
        cost_low_eur = $15, cost_mid_eur = $16, cost_high_eur = $17,
        team_size_low = $18, team_size_mid = $19, team_size_high = $20,
        rebuild_months_low = $21, rebuild_months_mid = $22, rebuild_months_high = $23,
        complexity_category = $24, complexity_multiplier = $25,
        assumptions = $26, executive_summary = $27,
        scan_status = 'completed', completed_at = NOW()
      WHERE id = $1`,
      [
        runId,
        sourceFiles.length, totalLoc, productionLoc, testLoc,
        configLoc, generatedLoc, vendorLoc, docsLoc,
        JSON.stringify(languageBreakdown), JSON.stringify(fileDetail),
        effortMonths.low, effortMonths.mid, effortMonths.high,
        costEur.low, costEur.mid, costEur.high,
        teamSize.low, teamSize.mid, teamSize.high,
        rebuildMonths.low, rebuildMonths.mid, rebuildMonths.high,
        complexity.category, complexity.multiplier,
        JSON.stringify(assumptions), executiveSummary,
      ]
    );

    logger.info(`[SEE] Estimate scan completed for product ${productId}, run ${runId}: ${totalLoc} LOC, ${productionLoc} production`);

    return mapRunToResult(runId, productId, sourceFiles.length, totalLoc, productionLoc, testLoc,
      configLoc, generatedLoc, vendorLoc, docsLoc, languageBreakdown,
      effortMonths, costEur, teamSize, rebuildMonths,
      complexity, assumptions, executiveSummary);

  } catch (err: any) {
    // Mark run as failed
    await pool.query(
      `UPDATE see_analysis_runs SET scan_status = 'failed', error_message = $2 WHERE id = $1`,
      [runId, err.message]
    );
    throw err;
  }
}

// ─── Get Latest Scan ────────────────────────────────────────────────

export async function getLatestScan(productId: string): Promise<SEEAnalysisResult | null> {
  const result = await pool.query(
    `SELECT * FROM see_analysis_runs
     WHERE product_id = $1 AND scan_status = 'completed'
     ORDER BY created_at DESC LIMIT 1`,
    [productId]
  );
  if (result.rows.length === 0) return null;
  return rowToResult(result.rows[0]);
}

export async function getScanHistory(productId: string): Promise<Array<{ id: string; createdAt: string; totalLoc: number; productionLoc: number; scanStatus: string }>> {
  const result = await pool.query(
    `SELECT id, created_at, total_loc, production_loc, scan_status
     FROM see_analysis_runs WHERE product_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [productId]
  );
  return result.rows.map(r => ({
    id: r.id,
    createdAt: r.created_at,
    totalLoc: r.total_loc,
    productionLoc: r.production_loc,
    scanStatus: r.scan_status,
  }));
}

// ─── Consent ────────────────────────────────────────────────────────

export async function getSourceCodeConsent(productId: string, orgId: string): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.sourceCodeConsent AS consent`,
      { orgId, productId }
    );
    if (result.records.length === 0) return false;
    return result.records[0].get('consent') === true;
  } finally {
    await session.close();
  }
}

export async function setSourceCodeConsent(productId: string, orgId: string, consent: boolean): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       SET p.sourceCodeConsent = $consent`,
      { orgId, productId, consent }
    );
  } finally {
    await session.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function rowToResult(row: any): SEEAnalysisResult {
  return {
    id: row.id,
    productId: row.product_id,
    scanStatus: row.scan_status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    totalFiles: row.total_files,
    totalLoc: row.total_loc,
    productionLoc: row.production_loc,
    testLoc: row.test_loc,
    configLoc: row.config_loc,
    generatedLoc: row.generated_loc,
    vendorLoc: row.vendor_loc,
    docsLoc: row.docs_loc,
    languageBreakdown: row.language_breakdown || {},
    effortMonths: { low: parseFloat(row.effort_low_months), mid: parseFloat(row.effort_mid_months), high: parseFloat(row.effort_high_months) },
    costEur: { low: parseFloat(row.cost_low_eur), mid: parseFloat(row.cost_mid_eur), high: parseFloat(row.cost_high_eur) },
    teamSize: { low: row.team_size_low, mid: row.team_size_mid, high: row.team_size_high },
    rebuildMonths: { low: parseFloat(row.rebuild_months_low), mid: parseFloat(row.rebuild_months_mid), high: parseFloat(row.rebuild_months_high) },
    complexityCategory: row.complexity_category,
    complexityMultiplier: parseFloat(row.complexity_multiplier),
    assumptions: row.assumptions || {},
    executiveSummary: row.executive_summary || '',
  };
}

function mapRunToResult(
  id: string, productId: string,
  totalFiles: number, totalLoc: number, productionLoc: number, testLoc: number,
  configLoc: number, generatedLoc: number, vendorLoc: number, docsLoc: number,
  languageBreakdown: LanguageBreakdown,
  effortMonths: EffortEstimate, costEur: EffortEstimate,
  teamSize: EffortEstimate, rebuildMonths: EffortEstimate,
  complexity: { category: ComplexityCategory; multiplier: number },
  assumptions: typeof DEFAULT_ASSUMPTIONS,
  executiveSummary: string,
): SEEAnalysisResult {
  return {
    id, productId,
    scanStatus: 'completed',
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    totalFiles, totalLoc, productionLoc, testLoc, configLoc, generatedLoc, vendorLoc, docsLoc,
    languageBreakdown, effortMonths, costEur, teamSize, rebuildMonths,
    complexityCategory: complexity.category,
    complexityMultiplier: complexity.multiplier,
    assumptions, executiveSummary,
  };
}
