import {
  Cpu, Cloud, BookOpen, Monitor, Smartphone, Radio, Box,
} from 'lucide-react';

// ── Provider Icons (SVG components) ──────────────────────────
// These are re-exported from their own file to keep SVG out of the main page

export { default as CodebergIcon } from './CodebergIcon';
export { default as GitLabIcon } from './GitLabIcon';
export { default as ForgeIcon } from './ForgeIcon';
export { default as ProviderIcon } from './ProviderIcon';

// ── Provider helpers ─────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub', codeberg: 'Codeberg', gitea: 'Gitea', forgejo: 'Forgejo', gitlab: 'GitLab',
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

// ── CRA constants ────────────────────────────────────────────

export const CRA_CATEGORY_HELP = 'The CRA defines four product categories with increasing obligations. Default: standard cybersecurity requirements (self-assessment, Module A). Important Class I: products with higher risk. Must use harmonised standards or third-party assessment. Important Class II: critical infrastructure products. Mandatory third-party conformity assessment (Module B+C or H). Critical: highest risk. Requires EU cybersecurity certification per Article 8(6).';

export const TECHFILE_HELP: Record<string, string> = {
  product_description: 'Describe your product\'s intended purpose, software versions affecting cybersecurity compliance, how it is made available on the market, and reference user instructions per Annex II. Satisfies Annex VII §1.',
  design_development: 'Document system architecture, how software components interact and integrate, and your SDLC process including production monitoring. Satisfies Annex VII §2(a).',
  vulnerability_handling: 'Document your coordinated vulnerability disclosure (CVD) policy, reporting contact, secure update distribution, and reference to your SBOM. Satisfies Annex VII §2(b).',
  risk_assessment: 'Perform and document a cybersecurity risk assessment considering intended and foreseeable use. Must address each Annex I Part I essential requirement. Satisfies Annex VII §3 and Article 13(2).',
  support_period: 'Determine and document the support period (minimum 5 years or expected product lifetime). Include rationale and communication plan. Satisfies Annex VII §4 and Article 13(8).',
  standards_applied: 'List harmonised standards (EU Official Journal), common specifications per Article 27(2), or EU cybersecurity certification schemes. Specify which parts are applied. Satisfies Annex VII §5.',
  test_reports: 'Attach penetration testing, static/dynamic analysis, vulnerability scan results, and any third-party audit reports demonstrating conformity with Annex I. Satisfies Annex VII §6.',
  declaration_of_conformity: 'The formal EU Declaration of Conformity per Article 28 and Annex VI. Specify the conformity assessment module (A, B+C, or H), notified body details if applicable, and CE marking date. Satisfies Annex VII §7.',
};

// ── Product types ────────────────────────────────────────────

export const PRODUCT_TYPES = [
  { value: 'firmware', label: 'Firmware', icon: Cpu },
  { value: 'saas', label: 'SaaS / Web App', icon: Cloud },
  { value: 'library', label: 'Library / SDK', icon: BookOpen },
  { value: 'desktop_app', label: 'Desktop Application', icon: Monitor },
  { value: 'mobile_app', label: 'Mobile App', icon: Smartphone },
  { value: 'iot_device', label: 'IoT Device', icon: Radio },
  { value: 'embedded', label: 'Embedded System', icon: Cpu },
  { value: 'other', label: 'Other', icon: Box },
];

export const TYPE_LABELS: Record<string, string> = Object.fromEntries(PRODUCT_TYPES.map(t => [t.value, t.label]));

export const CATEGORY_INFO: Record<string, { label: string; color: string; desc: string }> = {
  default: { label: 'Default', color: 'var(--accent)', desc: 'Standard CRA obligations apply. Self-assessment is sufficient.' },
  important_i: { label: 'Important I', color: 'var(--amber)', desc: 'Important product with digital elements. Self-assessment possible under certain conditions.' },
  important_ii: { label: 'Important II', color: 'var(--orange, var(--amber))', desc: 'Important product with higher risk. Third-party assessment may be required.' },
  critical: { label: 'Critical', color: 'var(--red)', desc: 'Critical product. Third-party conformity assessment required.' },
};

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', 'C++': '#f34b7d', C: '#555555',
  'C#': '#178600', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Dockerfile: '#384d54',
};

// ── Utility functions ────────────────────────────────────────

export function getTypeIcon(type: string) {
  const found = PRODUCT_TYPES.find(t => t.value === type);
  return found?.icon || Box;
}

export function formatDate(iso: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

// ── Interfaces ───────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  productType: string;
  craCategory: string;
  repoUrl: string;
  provider: string;
  instanceUrl: string;
  distributionModel: string | null;
  lifecycleStatus: string;
  marketPlacementDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepoConnection {
  provider: string;
  username: string;
  avatarUrl: string;
  scope: string;
  connectedAt: string;
}

export interface GitHubStatus {
  connected: boolean;
  githubUsername?: string;
  githubAvatarUrl?: string;
  connections?: RepoConnection[];
}

export interface RepoData {
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  visibility: string;
  defaultBranch: string;
  lastPush: string;
  isPrivate: boolean;
  syncedAt?: string;
}

export interface ContributorData {
  login: string;
  githubId: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

export interface LanguageData {
  language: string;
  bytes: number;
  percentage: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  selfHosted: boolean;
  oauthSupported: boolean;
  supportsApiSbom: boolean;
}

export interface SBOMPackage {
  purl: string;
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  supplier: string;
}

export interface SBOMData {
  hasSBOM: boolean;
  spdxVersion?: string;
  packageCount?: number;
  isStale?: boolean;
  syncedAt?: string;
  packages?: SBOMPackage[];
}

export interface TechFileSection {
  sectionKey: string;
  title: string;
  content: any;
  notes: string;
  status: 'not_started' | 'in_progress' | 'completed';
  craReference: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface TechFileData {
  sections: TechFileSection[];
  progress: { total: number; completed: number; inProgress: number; notStarted: number };
}

export interface VersionEntry {
  cranisVersion: string;
  githubTag: string | null;
  releaseName: string | null;
  source: 'sync' | 'github_release' | 'manual';
  createdAt: string;
  isPrerelease: boolean;
}

export interface SyncHistoryEntry {
  syncType: 'manual' | 'auto';
  startedAt: string;
  durationSeconds: number;
  packageCount: number;
  contributorCount: number;
  releaseCount: number;
  cranisVersion: string | null;
  triggeredBy: string | null;
  status: 'success' | 'error';
  errorMessage: string | null;
}

export interface SyncStats {
  totalSyncs: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
}

export interface PushEvent {
  id: string;
  pusherName: string;
  pusherEmail: string | null;
  ref: string | null;
  branch: string | null;
  commitCount: number;
  headCommitMessage: string | null;
  headCommitSha: string | null;
  provider: string;
  createdAt: string;
}

export interface GitHubData {
  synced: boolean;
  provider?: string;
  repo?: RepoData;
  contributors?: ContributorData[];
  languages?: LanguageData[];
}

export type TabKey = 'overview' | 'obligations' | 'technical-file' | 'activity' | 'risk-findings' | 'dependencies' | 'supply-chain' | 'crypto-inventory' | 'compliance-vault';
