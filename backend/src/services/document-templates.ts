/**
 * Document Templates Service
 *
 * Provides CRA compliance document templates that users can download,
 * populate with their product-specific details, and upload to their Tech File.
 *
 * Templates use {{PLACEHOLDER}} syntax for user-replaceable values.
 * The generate flow auto-populates from product/org data and marks
 * remaining fields with [REVIEW] markers.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';

export interface DocumentTemplate {
  id: string;
  title: string;
  craArticle: string;
  description: string;
  techFileSection: string;
  filename: string;
}

export interface GenerateContext {
  productId: string;
  orgId: string;
  /** Optional overrides from the user */
  versionFormat?: string;
  securitySuffix?: string;
}

interface PopulatedData {
  productName: string;
  orgName: string;
  distributionModel: string;
  version: string;
  stakeholders: Record<string, { name: string; email: string }>;
}

/** Template catalogue — metadata only (no content) */
export const TEMPLATE_CATALOGUE: DocumentTemplate[] = [
  {
    id: 'versioning-security-release-policy',
    title: 'Versioning & Security Release Policy',
    craArticle: 'Article 13(9)',
    description: 'Defines how your organisation separates security updates from feature releases. Covers versioning scheme, branching strategy, security release procedure, response timelines, user communication, and evidence retention. Required to demonstrate that security patches can be deployed independently of functionality changes.',
    techFileSection: 'Art. 13 — Security Properties',
    filename: 'versioning-and-security-release-policy.md',
  },
  {
    id: 'cvd-policy',
    title: 'Coordinated Vulnerability Disclosure Policy',
    craArticle: 'Article 13(6)',
    description: 'Public-facing policy describing how external security researchers can report vulnerabilities, what to expect during the handling process, response timelines, safe harbour provisions, and recognition. Required to demonstrate a documented and accessible CVD process aligned with ISO 29147.',
    techFileSection: 'Art. 13 — Security Properties',
    filename: 'coordinated-vulnerability-disclosure-policy.md',
  },
  {
    id: 'vulnerability-handling-process',
    title: 'Vulnerability Handling Process',
    craArticle: 'Article 13(5)',
    description: 'Internal process for managing the full vulnerability lifecycle — detection, triage, remediation, verification, and disclosure. Covers tooling integration, severity-based response timelines, and evidence retention. References CRANIS2 AI-assisted triage and IDE-based remediation via MCP tools.',
    techFileSection: 'Art. 13 — Security Properties',
    filename: 'vulnerability-handling-process.md',
  },
  {
    id: 'security-update-procedure',
    title: 'Security Update Procedure',
    craArticle: 'Article 13(8)',
    description: 'Defines how security updates are developed, tested, and deployed free of charge. Covers update types, development workflow, testing requirements, deployment procedures, and the CRA requirement to provide security updates without cost to the user.',
    techFileSection: 'Art. 13 — Security Properties',
    filename: 'security-update-procedure.md',
  },
  {
    id: 'incident-response-plan',
    title: 'Incident Response Plan',
    craArticle: 'Article 14',
    description: 'ENISA notification procedures for actively exploited vulnerabilities and severe incidents. Covers the three-stage reporting process (early warning, notification, final report), internal response procedures, stakeholder communication, and post-incident review.',
    techFileSection: 'Art. 14 — Incident Response',
    filename: 'incident-response-plan.md',
  },
  {
    id: 'end-of-support-policy',
    title: 'End-of-Support Policy',
    craArticle: 'Article 13(15)',
    description: 'Defines the support period commitment for your product, the obligations that apply during that period, the wind-down process, user notification procedures, and post-support responsibilities. Ensures transparent communication of the support lifecycle.',
    techFileSection: 'Art. 13 — Support & Maintenance',
    filename: 'end-of-support-policy.md',
  },
  {
    id: 'secure-development-lifecycle',
    title: 'Secure Development Lifecycle',
    craArticle: 'Annex I, Part I',
    description: 'Security-by-design practices covering threat modelling, secure coding standards, dependency management, SBOM generation, testing requirements, and compliance verification. Demonstrates that security is integrated throughout the product development process.',
    techFileSection: 'Annex I — Design & Development',
    filename: 'secure-development-lifecycle.md',
  },
];

/** Returns the full Markdown content for a given template ID */
export function getTemplateContent(id: string): string | null {
  const fn = templateContentMap[id];
  return fn ? fn() : null;
}

/** Generates a pre-filled template for a specific product */
export async function generateTemplateForProduct(id: string, ctx: GenerateContext): Promise<string | null> {
  const rawContent = getTemplateContent(id);
  if (!rawContent) return null;

  const data = await fetchProductData(ctx.productId, ctx.orgId);
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const deliveryModel = mapDistributionModel(data.distributionModel);
  const versionFormat = ctx.versionFormat || inferVersionFormat(data.version);
  const securitySuffix = ctx.securitySuffix || '-sec1';

  // Find the tech file section for this template (for the auto-gen notice)
  const templateMeta = TEMPLATE_CATALOGUE.find(t => t.id === id);
  const techSection = templateMeta?.techFileSection || 'the appropriate section';

  // Replace placeholders
  let content = rawContent
    .replace(/\{\{PRODUCT_NAME\}\}/g, data.productName)
    .replace(/\{\{ORG_NAME\}\}/g, data.orgName)
    .replace(/\{\{EFFECTIVE_DATE\}\}/g, today)
    .replace(/\{\{VERSION_FORMAT\}\}/g, versionFormat)
    .replace(/\{\{SECURITY_SUFFIX\}\}/g, securitySuffix)
    .replace(/\{\{DELIVERY_MODEL\}\}/g, deliveryModel);

  // Replace stakeholder placeholders
  const stakeholderPlaceholders: Record<string, string> = {
    'SECURITY_CONTACT': formatStakeholder(data.stakeholders['security_contact'], 'security contact'),
    'MANUFACTURER_CONTACT': formatStakeholder(data.stakeholders['manufacturer_contact'], 'manufacturer contact'),
    'COMPLIANCE_OFFICER': formatStakeholder(data.stakeholders['compliance_officer'], 'compliance officer'),
    'TECHNICAL_FILE_OWNER': formatStakeholder(data.stakeholders['technical_file_owner'], 'technical file owner'),
    'INCIDENT_RESPONSE_LEAD': formatStakeholder(data.stakeholders['incident_response_lead'], 'incident response lead'),
  };
  for (const [key, value] of Object.entries(stakeholderPlaceholders)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Replace the generic roles table with populated version (versioning template)
  content = content.replace(
    /\| Role \| Responsibility \|[\s\S]*?\| \*\*Compliance Officer\*\* \|[^\n]*\n\n> \*\*Note:\*\* Adapt the roles above to match your actual team structure\./,
    buildRolesTable(data.stakeholders)
  );

  // Replace the instructions block generically (all templates use the same header)
  content = content.replace(
    /> \*\*INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING\*\*[\s\S]*?\n\n---/,
    `> **REVIEW BEFORE FINALISING**
>
> This document was auto-generated by CRANIS2 from your product and
> organisation data. Fields marked with **[REVIEW]** need your attention.
>
> **Next steps:**
> 1. Review all sections — particularly timelines, roles, and process details
> 2. Adjust any [REVIEW] fields to match your actual process
> 3. Have the document reviewed and approved by the appropriate stakeholders
>
> **Where to store the completed document:**
> Paste the finalised content into your product's **Tech File** in
> CRANIS2 under the **${techSection}** section.

---`
  );

  // Select the correct delivery model section (for templates that include model-specific content)
  const modelLower = deliveryModel.toLowerCase();
  if (modelLower.includes('saas') || modelLower.includes('hosted')) {
    content = content.replace(
      /> \*\*Note:\*\* Complete this section based on your delivery model \([^)]*\)\.\n\n/g, ''
    );
    content = content.replace(
      /\*\*For on-premises \/ distributed products:\*\*\n(?:[^\n]*\n){1,3}\n/g, ''
    );
  } else if (modelLower.includes('on-premises') || modelLower.includes('binary') || modelLower.includes('embedded')) {
    content = content.replace(
      /> \*\*Note:\*\* Complete this section based on your delivery model \([^)]*\)\.\n\n/g, ''
    );
    content = content.replace(
      /\*\*For SaaS products:\*\*\n(?:[^\n]*\n){1,3}\n/g, ''
    );
  }

  return content;
}

function formatStakeholder(person: { name: string; email: string } | undefined, fallback: string): string {
  if (!person || (!person.name && !person.email)) return `[REVIEW: assign ${fallback}]`;
  if (person.name && person.email) return `${person.name} (${person.email})`;
  return person.name || person.email;
}

// ─── Data fetching ──────────────────────────────────────────────────────────────

async function fetchProductData(productId: string, orgId: string): Promise<PopulatedData | null> {
  const session = getDriver().session();
  try {
    // Fetch product and org from Neo4j
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS productName, p.version AS version, p.distributionModel AS distributionModel,
              o.name AS orgName`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;

    const rec = result.records[0];

    // Fetch stakeholders from Postgres
    const stakeholderResult = await pool.query(
      `SELECT role_key, name, email FROM stakeholders
       WHERE org_id = $1 AND (product_id = $2 OR product_id IS NULL)
         AND email IS NOT NULL AND email != ''
       ORDER BY product_id DESC NULLS LAST`,
      [orgId, productId]
    );

    const stakeholders: Record<string, { name: string; email: string }> = {};
    for (const row of stakeholderResult.rows) {
      // Product-level overrides org-level (ordered by product_id DESC NULLS LAST)
      if (!stakeholders[row.role_key]) {
        stakeholders[row.role_key] = { name: row.name || '', email: row.email || '' };
      }
    }

    return {
      productName: rec.get('productName') || '',
      orgName: rec.get('orgName') || '',
      distributionModel: rec.get('distributionModel') || '',
      version: rec.get('version') || '',
      stakeholders,
    };
  } finally {
    await session.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mapDistributionModel(model: string): string {
  const map: Record<string, string> = {
    saas_hosted: 'SaaS (centrally hosted)',
    proprietary_binary: 'On-premises (distributed binary)',
    source_available: 'Source-available (distributed)',
    library_component: 'Library / component (distributed via package registry)',
    internal_only: 'Internal use only',
  };
  return map[model] || model || '[REVIEW: specify delivery model]';
}

function inferVersionFormat(version: string): string {
  if (!version) return '[REVIEW: e.g. MAJOR.MINOR.PATCH or YYYY.MM.DD.NNNN]';
  // Detect common patterns
  if (/^\d{4}\.\d{2}\.\d{2}/.test(version)) return 'YYYY.MM.DD.NNNN';
  if (/^\d+\.\d+\.\d+$/.test(version)) return 'MAJOR.MINOR.PATCH';
  if (/^\d+\.\d+$/.test(version)) return 'MAJOR.MINOR';
  return version + ' [REVIEW]';
}

function buildRolesTable(stakeholders: Record<string, { name: string; email: string }>): string {
  const sec = stakeholders['security_contact'];
  const mfr = stakeholders['manufacturer_contact'];
  const compliance = stakeholders['compliance_officer'];
  const techFile = stakeholders['technical_file_owner'];
  const incident = stakeholders['incident_response_lead'];

  function formatPerson(role: { name: string; email: string } | undefined, fallback: string): string {
    if (!role || (!role.name && !role.email)) return `[REVIEW: assign ${fallback}]`;
    if (role.name && role.email) return `${role.name} (${role.email})`;
    return role.name || role.email;
  }

  return `| Role | Assigned to | Responsibility |
|---|---|---|
| **Product Owner** | ${formatPerson(techFile, 'technical file owner')} | Classifies each release; approves mixed releases (exceptional cases only) |
| **Security Lead** | ${formatPerson(sec, 'security contact')} | Triages vulnerabilities; validates fix completeness; reviews security-only releases |
| **Engineering Team** | ${formatPerson(mfr, 'manufacturer contact')} | Develops fixes on isolated branches; ensures no feature code in security releases |
| **Incident Response** | ${formatPerson(incident, 'incident response lead')} | Coordinates response to actively exploited vulnerabilities; manages disclosure timeline |
| **Compliance Officer** | ${formatPerson(compliance, 'compliance officer')} | Verifies this policy is followed; maintains evidence for CRA technical file |`;
}

// ─── Template content generators ───────────────────────────────────────────────

const templateContentMap: Record<string, () => string> = {
  'versioning-security-release-policy': () => VERSIONING_POLICY_TEMPLATE,
  'cvd-policy': () => CVD_POLICY_TEMPLATE,
  'vulnerability-handling-process': () => VULNERABILITY_HANDLING_TEMPLATE,
  'security-update-procedure': () => SECURITY_UPDATE_TEMPLATE,
  'incident-response-plan': () => INCIDENT_RESPONSE_TEMPLATE,
  'end-of-support-policy': () => END_OF_SUPPORT_TEMPLATE,
  'secure-development-lifecycle': () => SECURE_DEV_LIFECYCLE_TEMPLATE,
};

// ─── Versioning & Security Release Policy ──────────────────────────────────────

const VERSIONING_POLICY_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(9).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual release process
> 3. Remove or modify any sections that do not apply to your delivery model
> 4. Have the document reviewed and approved by your Product Owner and
>    Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 — Security Properties** section. This
> ensures it is included in your CRA compliance evidence package and
> linked to your product's compliance status.
>
> The completed document should also be retained in your internal document
> management system as a controlled policy document.
>
> **Placeholders in this template:**
> - \`{{PRODUCT_NAME}}\` — Your product's name
> - \`{{ORG_NAME}}\` — Your organisation's name
> - \`{{EFFECTIVE_DATE}}\` — The date this policy takes effect
> - \`{{VERSION_FORMAT}}\` — Your versioning scheme (e.g. SemVer, date-based, CalVer)
> - \`{{SECURITY_SUFFIX}}\` — The suffix you use for security-only releases (e.g. -sec1, .patch1)
> - \`{{DELIVERY_MODEL}}\` — SaaS, on-premises, hybrid, embedded, etc.

---

# Versioning & Security Release Policy

**Document Owner:** Product & Engineering Lead
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(9) — Separation of security and functionality updates
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the release process

---

## 1. Purpose

This policy defines how {{ORG_NAME}} distinguishes security updates from feature updates for {{PRODUCT_NAME}}, ensuring that security patches can be developed, tested, and deployed independently of functionality changes. It satisfies the requirement under EU Cyber Resilience Act Article 13(9) that manufacturers provide security updates separately from functionality updates where technically feasible.

---

## 2. Scope

This policy applies to:

- All production releases of {{PRODUCT_NAME}} (all components and services)
- All personnel involved in development, review, and deployment
- All dependencies managed within the Software Bill of Materials (SBOM)

---

## 3. Versioning Scheme

### 3.1 Format

{{PRODUCT_NAME}} uses the following versioning scheme:

\`\`\`
{{VERSION_FORMAT}}[{{SECURITY_SUFFIX}}]
\`\`\`

| Segment | Meaning |
|---|---|
| \`{{VERSION_FORMAT}}\` | Standard version identifier for the release |
| \`{{SECURITY_SUFFIX}}\` | **Security-only release suffix**. Present only when the release contains exclusively security fixes. |

### 3.2 Examples

| Version | Classification |
|---|---|
| \`1.2.0\` | Feature release (may include non-critical security improvements alongside features) |
| \`1.2.0{{SECURITY_SUFFIX}}\` | Security-only release — contains only vulnerability fixes |
| \`1.3.0\` | Feature release |
| \`1.3.0{{SECURITY_SUFFIX}}\` | Security hotfix issued against the \`1.3.0\` baseline |

> **Note:** Update the examples above to match your actual versioning scheme.

### 3.3 Classification Rules

Every release MUST be classified as one of the following:

| Classification | Definition | Version suffix |
|---|---|---|
| **Security-only** | Contains exclusively security fixes (vulnerability patches, dependency upgrades addressing CVEs, security configuration changes). No new features, no behavioural changes. | \`{{SECURITY_SUFFIX}}\` |
| **Feature** | Contains new functionality, enhancements, refactoring, or non-security bug fixes. May include minor security hardening that does not address a known vulnerability. | No suffix |
| **Mixed** | Contains both security fixes and feature changes. Mixed releases should be avoided where possible. When unavoidable, the security fixes MUST be documented separately in the release notes and the release MUST be preceded or accompanied by a security-only release containing the same fixes. | No suffix (but release notes must itemise security content) |

The **Product Owner** is responsible for classifying each release before deployment.

---

## 4. Security Release Procedure

### 4.1 Trigger

A security-only release is triggered when any of the following occur:

- A vulnerability rated **Critical** or **High** (CVSS ≥ 7.0) is identified in {{PRODUCT_NAME}} code or its dependencies
- A vulnerability rated **Medium** (CVSS 4.0–6.9) that is actively exploited or has a public exploit available
- A security advisory from a dependency maintainer recommends immediate update
- A penetration test or security audit identifies a finding requiring remediation

### 4.2 Process

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  1. IDENTIFICATION                                              │
│     Vulnerability detected (scanner, advisory, audit, report)   │
│                           │                                     │
│  2. TRIAGE                ▼                                     │
│     Classify severity, assess exploitability, determine scope   │
│                           │                                     │
│  3. ISOLATION             ▼                                     │
│     Create hotfix branch from current production baseline       │
│     Cherry-pick or develop ONLY the security fix                │
│     No feature code included                                    │
│                           │                                     │
│  4. REVIEW & TEST         ▼                                     │
│     Code review (security-focused)                              │
│     Run full regression suite                                   │
│     Verify fix resolves the vulnerability                       │
│     Verify no functional regressions introduced                 │
│                           │                                     │
│  5. CLASSIFICATION        ▼                                     │
│     Product Owner confirms security-only classification         │
│     Version tagged with security suffix                         │
│                           │                                     │
│  6. DEPLOYMENT            ▼                                     │
│     Deploy to production via standard pipeline                  │
│     SBOM regenerated automatically                              │
│                           │                                     │
│  7. COMMUNICATION         ▼                                     │
│     Release notes published (see Section 5)                     │
│     Affected users notified                                     │
│     Changelog updated                                           │
│                           │                                     │
│  8. EVIDENCE              ▼                                     │
│     Commit history, test results, and classification archived   │
│     Vulnerability status updated in tracker                     │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.3 Timelines

| Severity | Target fix deployment |
|---|---|
| Critical (CVSS ≥ 9.0) | Within 24 hours of confirmation |
| High (CVSS 7.0–8.9) | Within 72 hours of confirmation |
| Medium (CVSS 4.0–6.9, actively exploited) | Within 5 working days |
| Medium (CVSS 4.0–6.9, no known exploit) | Next scheduled release or within 30 days |
| Low (CVSS < 4.0) | Next scheduled release |

### 4.4 Independence from feature work

Security-only releases:

- **MUST NOT** include any feature changes, refactoring, or non-security bug fixes
- **MUST NOT** require users to accept new terms, configurations, or behavioural changes
- **MUST** be deployable independently of any in-progress feature work
- **MUST** be tested against the current production baseline, not a development branch

### 4.5 Branching Strategy

{{PRODUCT_NAME}} follows a branching model with a dedicated security hotfix lane. The \`main\` branch always represents the current production state.

\`\`\`
main (always = production, always deployable)
  │
  ├── feature/new-feature-name         ← new work, branched from main
  ├── feature/another-feature          ← new work, branched from main
  │
  └── sec/CVE-2026-XXXX               ← security fix, branched from main
        fix → test → merge back to main  ← deployed independently of features
        then merged forward into open feature branches
\`\`\`

#### Feature branches

1. Branch from \`main\` when starting new feature work
2. Develop and test on the feature branch
3. Merge back to \`main\` via pull request when the feature is complete, reviewed, and approved
4. Tag \`main\` with a standard version
5. Deploy from \`main\`

#### Security fix branches

1. Branch from \`main\` (the live production baseline) — name the branch \`sec/<CVE-ID>\` or \`sec/<finding-ref>\`
2. Apply **only** the security fix — no feature code, no refactoring, no unrelated changes
3. Test against the production baseline (full regression suite)
4. Merge back to \`main\` via pull request with security-focused review
5. Tag \`main\` with the security suffix (e.g. \`1.2.0{{SECURITY_SUFFIX}}\`)
6. Deploy immediately from \`main\`
7. Merge \`main\` forward into all open feature branches so they inherit the fix

#### Key principles

- **\`main\` is always deployable** — it represents exactly what is live in production
- **Security fixes never wait for feature work** — they are branched from and merged back to \`main\` independently
- **Feature branches never block security releases** — the security lane operates in parallel
- **Feature branches stay current** — after every security merge to \`main\`, open feature branches rebase or merge from \`main\` to pick up the fix
- **No mixed merges** — a security branch must not include feature commits, and vice versa

---

## 5. User Communication & Transparency

### 5.1 Release notes

Every release MUST include release notes that clearly state:

- The **classification** (Security-only, Feature, or Mixed)
- For security-only releases: the CVE identifiers or internal finding references addressed
- A plain-language summary of what was fixed and why it matters
- Whether any user action is required

### 5.2 Security update labelling

Security-only releases are identified through:

- The \`{{SECURITY_SUFFIX}}\` version suffix
- A **[SECURITY]** tag in the release notes title
- A distinct visual indicator in any update notification or changelog
- Separate grouping in the changelog (security fixes listed before feature changes)

### 5.3 Notification channels

| Channel | Used for |
|---|---|
| In-app notification / email | All security-only releases |
| Direct notification to administrators | Critical and High severity security releases |
| Changelog / release notes page | All releases |
| Status page | Releases addressing actively exploited vulnerabilities |

> **Note:** Adapt the channels above to match your actual notification infrastructure.

### 5.4 Delivery model considerations

> **Note:** Complete this section based on your delivery model ({{DELIVERY_MODEL}}).

**For SaaS products:**
Users do not manually apply updates; all releases are deployed centrally. This means users are never forced to accept feature changes in order to receive a security fix, and they are always on the latest secure version.

**For on-premises / distributed products:**
Security-only releases are published to the same distribution channel as feature releases but are clearly labelled. Users can apply security patches without upgrading to the latest feature release. Update instructions specify the minimum steps required for the security fix only.

---

## 6. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** | Classifies each release; approves mixed releases (exceptional cases only) |
| **Security Lead** | Triages vulnerabilities; validates fix completeness; reviews security-only releases |
| **Engineering Team** | Develops fixes on isolated branches; ensures no feature code in security releases |
| **Operations** | Deploys releases; monitors post-deployment health; triggers rollback if needed |
| **Compliance Officer** | Verifies this policy is followed; maintains evidence for CRA technical file |

> **Note:** Adapt the roles above to match your actual team structure.

---

## 7. Evidence & Audit Trail

The following artefacts are retained for each security-only release as evidence of Art. 13(9) compliance:

| Artefact | Retention |
|---|---|
| Git commit history (isolated hotfix branch) | Indefinite (version control) |
| Release classification record | Minimum 10 years (CRA support period) |
| Release notes with [SECURITY] tag | Minimum 10 years |
| Test results (regression suite) | Minimum 5 years |
| Vulnerability tracker status change | Indefinite (platform database) |
| SBOM diff (before/after) | Minimum 10 years |
| Deployment log | Minimum 5 years |

---

## 8. Policy on Mixed Releases

Mixed releases (containing both security fixes and feature changes) are **strongly discouraged**. When a mixed release is unavoidable:

1. The security fixes MUST also be available as a standalone security-only release (deployed first or concurrently)
2. The release notes MUST separately itemise all security fixes under a dedicated **Security** section
3. The Product Owner MUST document the justification for combining the changes
4. The justification is retained as part of the compliance evidence

---

## 9. Exceptions

Any deviation from this policy requires:

- Written approval from the Product Owner and Security Lead
- A documented justification explaining why the deviation was necessary
- A remediation plan to return to standard process
- Recording in the compliance evidence archive

---

## 10. Review & Revision

This policy is reviewed:

- **Annually** as part of the regular compliance review cycle
- **Upon significant change** to the release pipeline, deployment architecture, or delivery model
- **Upon regulatory guidance** from ENISA or national authorities clarifying Art. 13(9) expectations

All revisions are tracked with date, author, and summary of changes.

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes versioning scheme, security release process, and Art. 13(9) evidence framework |
`;

// ─── Coordinated Vulnerability Disclosure Policy ────────────────────────────────

const CVD_POLICY_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(6).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual disclosure process
> 3. Publish this policy on your public-facing website or security page
> 4. Have the document reviewed and approved by your Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 — Security Properties** section. The policy
> should also be published at a publicly accessible URL.

---

# Coordinated Vulnerability Disclosure Policy

**Document Owner:** {{SECURITY_CONTACT}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(6) — Coordinated vulnerability disclosure
**Standard Alignment:** ISO/IEC 29147:2018
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the handling process

---

## 1. Purpose

This policy describes how {{ORG_NAME}} receives, handles, and discloses security vulnerabilities reported by external parties in {{PRODUCT_NAME}}. It satisfies the requirement under EU Cyber Resilience Act Article 13(6) that manufacturers maintain a documented and accessible coordinated vulnerability disclosure (CVD) process.

---

## 2. Scope

This policy applies to:

- All versions of {{PRODUCT_NAME}} currently within the support period
- All components, dependencies, and services that form part of the product
- Reports received from security researchers, users, partners, and automated tools

---

## 3. Reporting a Vulnerability

### 3.1 Reporting Channels

| Channel | Details |
|---|---|
| **Email** | security@[REVIEW: your-domain.com] |
| **Web form** | [REVIEW: URL to your security reporting page] |
| **PGP key** | [REVIEW: PGP key fingerprint or link to public key] |

> **Note:** At least one channel must be available 24/7.

### 3.2 What to Include

Please include in your report:

- Description of the vulnerability
- Steps to reproduce (proof of concept if possible)
- Affected product version(s)
- Potential impact assessment
- Your contact details for follow-up (optional but recommended)

### 3.3 Encryption

We strongly encourage encrypting vulnerability reports using our PGP key.

---

## 4. Handling Process

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  1. RECEIPT                                                      │
│     Report received via designated channel                       │
│     Acknowledgement sent within 72 hours                         │
│                           │                                      │
│  2. TRIAGE                ▼                                      │
│     Report logged in CRANIS2. AI-assisted triage assigns an      │
│     initial severity and recommended disposition. The security   │
│     team reviews and confirms the classification before          │
│     proceeding — no automated action is taken without human      │
│     approval.                                                    │
│                           │                                      │
│  3. INVESTIGATION         ▼                                      │
│     Root cause analysis and impact assessment                    │
│     Affected versions and components identified                  │
│                           │                                      │
│  4. REMEDIATION           ▼                                      │
│     Fix developed, tested, and verified                          │
│     CRANIS2 MCP tools provide ecosystem-specific mitigation      │
│     commands for developer remediation; fixes are reviewed and   │
│     approved by the security team before deployment.             │
│                           │                                      │
│  5. DISCLOSURE            ▼                                      │
│     Coordinated with reporter on disclosure timeline             │
│     Security advisory published                                  │
│     ENISA notified if required under Article 14                  │
│                           │                                      │
│  6. CLOSE-OUT             ▼                                      │
│     Reporter notified of resolution                              │
│     Evidence archived in compliance record                       │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 5. Response Timelines

| Milestone | Target |
|---|---|
| Acknowledgement of receipt | Within 72 hours |
| Initial triage and severity assessment | Within 5 working days |
| Status update to reporter | At least every 14 days |
| Fix development and testing | Severity-dependent (see below) |
| Coordinated disclosure | Within 90 days of report, unless mutually extended |

### Severity-Based Remediation Targets

| Severity | Fix deployment target |
|---|---|
| Critical (CVSS ≥ 9.0) | Within 24 hours of fix validation |
| High (CVSS 7.0–8.9) | Within 72 hours of fix validation |
| Medium (CVSS 4.0–6.9) | Within 30 days |
| Low (CVSS < 4.0) | Next scheduled release |

---

## 6. Safe Harbour

{{ORG_NAME}} commits to the following for good-faith security researchers:

- **No legal action** — We will not pursue legal action against researchers who report vulnerabilities in accordance with this policy
- **No negative consequences** — Researchers who act in good faith will not be subject to penalties
- **Good faith defined** — Avoiding privacy violations, data destruction, and service disruption; not accessing or modifying other users' data; providing reasonable time to remediate before disclosure

---

## 7. Recognition

We value the contribution of security researchers. With the reporter's consent:

- Reporters are credited in security advisories
- Reporters are listed on our [REVIEW: security acknowledgements page or hall of fame]
- [REVIEW: describe any bug bounty programme if applicable, or state "{{ORG_NAME}} does not currently operate a bug bounty programme"]

---

## 8. ENISA Notification

Where a reported vulnerability meets the criteria in CRA Article 14 (actively exploited vulnerability or severe incident), {{ORG_NAME}} will notify ENISA through the designated single reporting platform within the required timelines:

- **Early warning:** Within 24 hours of becoming aware
- **Vulnerability notification:** Within 72 hours
- **Final report:** Within 14 days of remediation

CRANIS2's AI incident report drafter assists in generating the required notification content, grounded in product data and linked findings. The incident lead reviews, edits, and explicitly approves all content before submission.

---

## 9. Contact

For any questions about this policy, contact: {{SECURITY_CONTACT}}

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes CVD process aligned with ISO 29147 and CRA Art. 13(6) |
`;

// ─── Vulnerability Handling Process ─────────────────────────────────────────────

const VULNERABILITY_HANDLING_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(5).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual vulnerability
>    management process
> 3. Have the document reviewed and approved by your Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 — Security Properties** section.

---

# Vulnerability Handling Process

**Document Owner:** {{SECURITY_CONTACT}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(5) — Effective handling of vulnerabilities
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the handling process

---

## 1. Purpose

This document defines how {{ORG_NAME}} detects, triages, remediates, verifies, and discloses vulnerabilities in {{PRODUCT_NAME}} throughout its support period. It satisfies the requirement under EU Cyber Resilience Act Article 13(5) that manufacturers ensure effective handling of vulnerabilities, including a documented vulnerability handling process.

---

## 2. Scope

This process applies to:

- All components of {{PRODUCT_NAME}} (proprietary code and third-party dependencies)
- Vulnerabilities identified through any channel (automated scanning, external reports, internal testing, public advisories)
- The entire vulnerability lifecycle from detection to closure

---

## 3. Detection

### 3.1 Automated Monitoring

CRANIS2 continuously monitors {{PRODUCT_NAME}}'s dependencies via SBOM analysis and vulnerability database matching. Detection sources include:

| Source | Frequency | Coverage |
|---|---|---|
| SBOM dependency scan | On every code push (via webhook) and daily scheduled scan | All direct and transitive dependencies |
| CVE/NVD database matching | Continuous (vulnerability database updates) | Known CVEs against SBOM components |
| Repository code scanning | Per commit (via CI pipeline) | Proprietary code vulnerabilities |
| External vulnerability reports | Continuous (via CVD policy channels) | Reported by researchers, users, partners |
| Penetration testing | [REVIEW: frequency, e.g. annually or bi-annually] | Application and infrastructure |

### 3.2 SBOM as Foundation

The Software Bill of Materials is the authoritative record of all components in {{PRODUCT_NAME}}. CRANIS2 auto-generates and maintains the SBOM from repository data. Vulnerability detection accuracy depends on SBOM currency — stale SBOMs trigger alerts for re-scanning.

---

## 4. Triage

### 4.1 AI-Assisted Classification

When a vulnerability is detected, CRANIS2's AI auto-triage analyses the finding in context and assigns:

- A **severity classification** based on CVSS score, exploitability, and product-specific exposure
- A **recommended disposition**: dismiss (false positive/not applicable), acknowledge (monitor), or escalate (requires remediation)
- A **confidence score** indicating the reliability of the recommendation

**Human-in-the-loop requirement:** A qualified member of the security team must review and approve or override the AI recommendation before any disposition is applied. The AI never automatically dismisses, resolves, or escalates a finding without human confirmation.

### 4.2 Severity Levels

| Level | CVSS Range | Response Requirement |
|---|---|---|
| Critical | 9.0–10.0 | Immediate response — fix within 24 hours |
| High | 7.0–8.9 | Urgent — fix within 72 hours |
| Medium | 4.0–6.9 | Scheduled — fix within 30 days |
| Low | 0.1–3.9 | Next release — address in normal cycle |
| Informational | 0.0 | Log and monitor |

### 4.3 Contextual Factors

The security team considers the following when reviewing triage recommendations:

- Is the vulnerable component reachable in the product's execution path?
- Are there mitigating controls (WAF, input validation, sandboxing)?
- Is the vulnerability actively exploited in the wild?
- Does the CRA category of {{PRODUCT_NAME}} impose stricter requirements?

---

## 5. Remediation

### 5.1 Fix Development

Remediation follows the approach appropriate to the vulnerability type:

| Type | Approach |
|---|---|
| Dependency vulnerability | Upgrade to patched version; CRANIS2 MCP tools provide ecosystem-specific commands (e.g. \`npm audit fix\`, \`pip install --upgrade\`) directly in the developer's IDE |
| Proprietary code vulnerability | Develop fix on isolated security branch (see Versioning & Security Release Policy) |
| Configuration vulnerability | Update configuration; document change |
| Design vulnerability | Architectural review and redesign where necessary |

**Human-in-the-loop requirement:** Developers review all suggested mitigation commands and fixes before applying them. Automated suggestions are guidance — the developer confirms appropriateness for the specific codebase context.

### 5.2 Remediation Tracking

All vulnerabilities are tracked in CRANIS2 with:

- Finding status (open → in progress → resolved / dismissed)
- Assigned owner
- Remediation deadline based on severity
- Evidence of fix (commit reference, test results)

---

## 6. Verification

### 6.1 Fix Validation

Before closing a vulnerability:

1. The fix is code-reviewed with a security focus
2. Regression tests confirm no functional breakage
3. CRANIS2's MCP \`verify_fix\` tool triggers an SBOM rescan, compares before/after dependency states, and confirms whether the vulnerability has been resolved
4. A team member reviews the verification result and approves closure

**Human-in-the-loop requirement:** The \`verify_fix\` tool provides an automated check, but a qualified team member must review the result and explicitly approve closure. Automated verification alone is not sufficient.

### 6.2 CI/CD Compliance Gate

CRANIS2's CI/CD compliance gate can be configured to block deployments when unresolved critical or high vulnerabilities exist, ensuring that known-vulnerable code is not released to production.

---

## 7. Disclosure

### 7.1 Internal Disclosure

All resolved vulnerabilities are recorded in the product's compliance evidence with:

- CVE identifier (if assigned)
- Severity and CVSS score
- Affected versions
- Fix version and deployment date
- Root cause summary

### 7.2 External Disclosure

External disclosure follows the Coordinated Vulnerability Disclosure Policy (Art. 13(6)):

- Security advisories published for Critical and High vulnerabilities
- ENISA notified where required under Article 14
- Users notified via appropriate channels

---

## 8. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Vulnerability finding record (including AI triage recommendation and human decision) | Minimum 10 years |
| Remediation evidence (commits, test results, SBOM diff) | Minimum 10 years |
| Triage decision log | Minimum 10 years |
| Disclosure records | Minimum 10 years |
| Scan results and SBOM snapshots | Minimum 5 years |

---

## 9. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Security Lead** ({{SECURITY_CONTACT}}) | Owns the vulnerability handling process; reviews all triage decisions; approves closures |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Develops and tests fixes; applies mitigation commands; verifies remediation |
| **Incident Response Lead** ({{INCIDENT_RESPONSE_LEAD}}) | Escalates to ENISA when Article 14 thresholds are met |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures process is followed; maintains evidence for CRA technical file |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes vulnerability handling process for CRA Art. 13(5) compliance |
`;

// ─── Security Update Procedure ──────────────────────────────────────────────────

const SECURITY_UPDATE_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(8).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual update process
> 3. Have the document reviewed and approved by your Product Owner and
>    Engineering Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 — Security Properties** section.

---

# Security Update Procedure

**Document Owner:** {{TECHNICAL_FILE_OWNER}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(8) — Security updates provided free of charge
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the update process

---

## 1. Purpose

This procedure defines how {{ORG_NAME}} develops, tests, deploys, and communicates security updates for {{PRODUCT_NAME}}. It satisfies the requirements under EU Cyber Resilience Act Article 13(8) that manufacturers provide security updates without delay and free of charge for the duration of the support period.

---

## 2. Scope

This procedure applies to:

- All security updates for {{PRODUCT_NAME}} during the support period
- All update delivery channels (automatic, manual, package registry)
- All personnel involved in developing, approving, and deploying security updates

---

## 3. Free-of-Charge Requirement

In accordance with CRA Article 13(8), {{ORG_NAME}} commits that:

- All security updates for {{PRODUCT_NAME}} are provided **free of charge** to all users
- Security updates are **never** bundled behind paid upgrades, premium tiers, or service contracts
- Users are **never** required to purchase a new version or subscription to receive security fixes
- This commitment applies for the entire duration of the support period (see End-of-Support Policy)

---

## 4. Update Types

| Type | Description | Delivery |
|---|---|---|
| **Security-only update** | Contains exclusively vulnerability fixes. No feature changes. | Priority deployment — severity-based timeline |
| **Dependency update** | Upgrades third-party components to address known CVEs | Included in security-only updates or scheduled releases |
| **Configuration update** | Security-relevant configuration changes | Documented and communicated with update instructions |
| **Emergency hotfix** | Critical/actively exploited vulnerability requiring immediate response | Expedited deployment within 24 hours |

---

## 5. Development Process

### 5.1 Trigger

A security update is initiated when:

- A vulnerability is triaged and confirmed for remediation (per the Vulnerability Handling Process)
- A dependency advisory recommends immediate update
- A penetration test or audit finding requires a code change

### 5.2 Workflow

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  1. FINDING CONFIRMED                                            │
│     Vulnerability triaged and assigned for remediation            │
│                           │                                      │
│  2. FIX DEVELOPMENT       ▼                                      │
│     Security branch created from production baseline              │
│     CRANIS2 MCP tools suggest ecosystem-specific mitigation       │
│     commands in the developer's IDE. Developer reviews and        │
│     applies the appropriate fix.                                  │
│                           │                                      │
│  3. TESTING               ▼                                      │
│     Security-focused code review                                  │
│     Full regression test suite                                    │
│     CRANIS2 CI/CD compliance gate validates readiness             │
│                           │                                      │
│  4. APPROVAL              ▼                                      │
│     Security Lead confirms fix completeness                       │
│     Product Owner approves release classification                 │
│                           │                                      │
│  5. DEPLOYMENT             ▼                                      │
│     Update published to distribution channel                      │
│     SBOM regenerated automatically by CRANIS2                     │
│                           │                                      │
│  6. VERIFICATION           ▼                                      │
│     CRANIS2 MCP verify_fix triggers SBOM rescan and confirms      │
│     the vulnerability is resolved. A team member reviews the      │
│     verification result before closing the finding.               │
│                           │                                      │
│  7. COMMUNICATION          ▼                                      │
│     Security advisory published                                   │
│     Users notified via designated channels                        │
│     ENISA notified if required under Article 14                   │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 6. Testing Requirements

Every security update must pass:

| Test | Purpose |
|---|---|
| Unit tests | Verify the fix addresses the vulnerability |
| Regression suite | Confirm no functional breakage |
| Integration tests | Validate component interactions |
| SBOM validation | Confirm dependency changes are reflected |
| CI/CD compliance gate | Verify CRA readiness threshold is met |

---

## 7. Deployment Timelines

| Severity | Target deployment |
|---|---|
| Critical (CVSS ≥ 9.0) or actively exploited | Within 24 hours of fix validation |
| High (CVSS 7.0–8.9) | Within 72 hours of fix validation |
| Medium (CVSS 4.0–6.9) | Within 30 days |
| Low (CVSS < 4.0) | Next scheduled release |

---

## 8. User Communication

### 8.1 Notification

Users are notified of security updates through:

| Channel | Content |
|---|---|
| Security advisory | CVE IDs, severity, affected versions, fix version, upgrade instructions |
| Release notes | [SECURITY] tag, plain-language summary |
| Email / in-app notification | Critical and High severity updates |
| Changelog | All security updates with dedicated section |

### 8.2 Update Instructions

Every security update includes clear instructions for users to apply the update. For dependency updates, CRANIS2 provides ecosystem-specific commands (e.g. \`npm update\`, \`pip install --upgrade\`).

---

## 9. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Security update release record | Minimum 10 years |
| Test results | Minimum 5 years |
| User notification records | Minimum 10 years |
| SBOM before/after update | Minimum 10 years |
| ENISA notification (if applicable) | Minimum 10 years |

---

## 10. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** ({{TECHNICAL_FILE_OWNER}}) | Approves release classification; owns deployment decision |
| **Security Lead** ({{SECURITY_CONTACT}}) | Confirms fix completeness; reviews verification results |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Develops and tests fixes; applies CRANIS2 mitigation suggestions after review |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Verifies free-of-charge provision; maintains evidence |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes security update procedure for CRA Art. 13(8) compliance |
`;

// ─── Incident Response Plan ─────────────────────────────────────────────────────

const INCIDENT_RESPONSE_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 14.
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual incident
>    response process
> 3. Have the document reviewed and approved by your Incident Response Lead
>    and Compliance Officer
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 14 — Incident Response** section.

---

# Incident Response Plan

**Document Owner:** {{INCIDENT_RESPONSE_LEAD}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 14 — Reporting obligations
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or after every major incident

---

## 1. Purpose

This plan defines how {{ORG_NAME}} responds to security incidents affecting {{PRODUCT_NAME}} and fulfils the notification obligations under EU Cyber Resilience Act Article 14. It covers incident detection, classification, containment, ENISA reporting (three-stage process), stakeholder communication, and post-incident review.

---

## 2. Scope

This plan applies to:

- Actively exploited vulnerabilities in {{PRODUCT_NAME}}
- Severe incidents that impact the security of {{PRODUCT_NAME}} or its users
- Incidents affecting third-party components within the product's SBOM
- All personnel involved in incident response

### 2.1 Article 14 Reporting Triggers

Notification to ENISA is required when:

- An **actively exploited vulnerability** is identified in {{PRODUCT_NAME}}
- A **severe incident** impacts the security of {{PRODUCT_NAME}} with significant effect on users

---

## 3. Incident Classification

| Level | Definition | Response |
|---|---|---|
| **P1 — Critical** | Actively exploited vulnerability or data breach affecting users | Immediate response; ENISA notification required |
| **P2 — High** | Severe vulnerability with public exploit available, no confirmed exploitation | Urgent response; assess ENISA notification requirement |
| **P3 — Medium** | Significant vulnerability without known exploitation | Scheduled response; monitor for escalation |
| **P4 — Low** | Minor security issue with limited impact | Normal process; document and address |

---

## 4. ENISA Notification Process

### 4.1 Three-Stage Reporting

CRA Article 14 requires a three-stage notification process through ENISA's single reporting platform:

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: EARLY WARNING              Deadline: 24 hours         │
│                                                                  │
│  Notify ENISA within 24 hours of becoming aware of an actively   │
│  exploited vulnerability or severe incident.                     │
│                                                                  │
│  Content:                                                        │
│  • Nature of the incident/vulnerability                          │
│  • Affected product and versions                                 │
│  • Initial severity assessment                                   │
│  • Whether the vulnerability is being actively exploited         │
│  • Any immediate mitigating measures taken                        │
│                           │                                      │
│  STAGE 2: NOTIFICATION               Deadline: 72 hours         │
│                           ▼                                      │
│  Follow-up notification within 72 hours with more detail.        │
│                                                                  │
│  Content:                                                        │
│  • Updated severity and impact assessment                        │
│  • Root cause analysis (if available)                             │
│  • Affected user base scope                                      │
│  • Corrective measures taken or planned                           │
│  • Indicators of compromise (if applicable)                      │
│                           │                                      │
│  STAGE 3: FINAL REPORT               Deadline: 14 days          │
│                           ▼                                      │
│  Comprehensive final report within 14 days of remediation.       │
│                                                                  │
│  Content:                                                        │
│  • Detailed root cause analysis                                  │
│  • Timeline of events                                            │
│  • Total impact assessment                                       │
│  • Remediation actions taken                                     │
│  • Lessons learned and preventive measures                       │
│  • Cross-border impact (if any)                                  │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 AI-Assisted Report Drafting

CRANIS2's AI incident report drafter generates content for each ENISA notification stage, grounded in:

- Product data (name, version, category, SBOM)
- Linked vulnerability findings and their triage history
- Content from previous reporting stages (ensuring consistency)

**Human-in-the-loop requirement:** The AI generates a draft. The incident lead must review the content, verify factual accuracy, edit where necessary, and explicitly approve the report before submission to ENISA. The AI draft is a starting point — the incident lead owns the final content.

### 4.3 CSIRT Notification

Reports are submitted to the CSIRT of the Member State where {{ORG_NAME}} is established. CRANIS2 tracks the organisation's CSIRT country to ensure reports are directed correctly.

---

## 5. Internal Response Procedure

### 5.1 Response Phases

| Phase | Actions | Timeline |
|---|---|---|
| **Detection** | Incident identified via monitoring, user report, or vulnerability scan | Continuous |
| **Assessment** | Classify severity; determine ENISA notification requirement; CRANIS2 AI risk assessment provides initial threat analysis for security team review and validation | Within 1 hour |
| **Containment** | Isolate affected systems; apply temporary mitigations | Within 2 hours (P1) |
| **Remediation** | Develop and deploy fix; verify resolution | Severity-dependent |
| **Communication** | Notify affected parties; publish advisory | Per communication plan |
| **Recovery** | Restore normal operations; verify no residual impact | Post-fix |
| **Review** | Post-incident review; update procedures; archive evidence | Within 14 days |

### 5.2 Incident Commander

For P1 and P2 incidents, the Incident Response Lead assumes the role of Incident Commander with authority to:

- Mobilise the response team
- Authorise emergency deployments
- Approve external communications
- Initiate ENISA notification

---

## 6. Communication Plan

### 6.1 Internal Communication

| Audience | Channel | Timing |
|---|---|---|
| Response team | [REVIEW: e.g. dedicated Slack channel, Teams] | Immediately on detection |
| Executive leadership | Direct notification | Within 2 hours (P1/P2) |
| All engineering staff | Internal advisory | Within 24 hours (P1/P2) |

### 6.2 External Communication

| Audience | Channel | Timing |
|---|---|---|
| ENISA / CSIRT | Single reporting platform | Per Article 14 timelines |
| Affected users | Email / in-app notification | After containment, before public disclosure |
| General public | Security advisory page | After fix deployment |
| Media (if applicable) | Press statement | As determined by incident commander |

---

## 7. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Incident timeline and log | Minimum 10 years |
| ENISA notification copies (all three stages) | Minimum 10 years |
| Root cause analysis | Minimum 10 years |
| Communication records | Minimum 10 years |
| Post-incident review report | Minimum 10 years |
| SBOM snapshots (pre/post incident) | Minimum 10 years |

---

## 8. Post-Incident Review

Within 14 days of incident resolution, the response team conducts a post-incident review covering:

- Timeline accuracy — was the response timely?
- ENISA notification compliance — were all deadlines met?
- Communication effectiveness — were stakeholders informed appropriately?
- Root cause — what allowed the incident to occur?
- Process improvements — what should change?
- Training needs — does the team need additional preparation?

Findings are documented and used to update this plan.

---

## 9. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Incident Response Lead** ({{INCIDENT_RESPONSE_LEAD}}) | Owns incident response; acts as incident commander; authorises ENISA submissions |
| **Security Lead** ({{SECURITY_CONTACT}}) | Leads technical investigation; validates root cause analysis |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Develops and deploys fixes; provides technical context |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures ENISA notification compliance; maintains evidence |
| **Product Owner** ({{TECHNICAL_FILE_OWNER}}) | Approves external communications; manages user impact |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes incident response plan for CRA Art. 14 compliance |
`;

// ─── End-of-Support Policy ──────────────────────────────────────────────────────

const END_OF_SUPPORT_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(15).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual support lifecycle
> 3. Have the document reviewed and approved by your Product Owner and
>    Compliance Officer
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 — Support & Maintenance** section.

---

# End-of-Support Policy

**Document Owner:** {{TECHNICAL_FILE_OWNER}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(15) — Support period and end-of-support obligations
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon change to the support period

---

## 1. Purpose

This policy defines the support period for {{PRODUCT_NAME}}, the obligations that apply during that period, the process for winding down support, and the notification procedures for users. It satisfies the requirements under CRA Article 13(15) that manufacturers clearly communicate the expected support period and ensure users are informed when support ends.

---

## 2. Support Period

### 2.1 Commitment

{{ORG_NAME}} commits to providing security updates and vulnerability handling for {{PRODUCT_NAME}} for a minimum period of:

**[REVIEW: specify support period, e.g. "5 years from the date of market placement" or "until 31 December 2031"]**

This period is proportionate to the expected product lifetime and reflects the requirements of CRA Article 13(8).

### 2.2 CRA Minimum

The CRA requires that the support period is at least 5 years, unless the expected product lifetime is shorter. The support period must be clearly stated at the time of market placement.

### 2.3 Support Period Tracking

CRANIS2 tracks the support period expiry date and automatically sends alerts at **90, 60, 30, 7, and 0 days** before the end-of-support date. These alerts are delivered to all designated compliance stakeholders via email and in-app notifications.

The obligation engine automatically derives support-period-dependent obligations (Articles 13(7) and 13(8)) and adjusts compliance status accordingly.

---

## 3. Obligations During the Support Period

During the support period, {{ORG_NAME}} commits to:

| Obligation | CRA Reference | Description |
|---|---|---|
| Security updates | Art. 13(8) | Free-of-charge security updates for all identified vulnerabilities |
| Vulnerability handling | Art. 13(5) | Effective handling of all reported and detected vulnerabilities |
| SBOM maintenance | Art. 13(5) | Up-to-date Software Bill of Materials |
| ENISA reporting | Art. 14 | Notification of actively exploited vulnerabilities |
| User communication | Art. 13(15) | Transparent communication about security status |
| CVD process | Art. 13(6) | Active coordinated vulnerability disclosure channel |

---

## 4. End-of-Support Procedure

### 4.1 Decision Process

The decision to end support is made by [REVIEW: e.g. the Product Owner in consultation with the Compliance Officer] and must consider:

- Remaining user base size
- Availability of successor products or migration paths
- Outstanding vulnerability obligations
- Regulatory requirements

### 4.2 Wind-Down Timeline

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  12 MONTHS BEFORE END-OF-SUPPORT                                 │
│  • Public announcement of end-of-support date                    │
│  • Migration guidance published                                  │
│  • Users notified via all communication channels                 │
│                           │                                      │
│  6 MONTHS BEFORE          ▼                                      │
│  • Reminder notifications sent                                   │
│  • Migration support offered                                     │
│  • Final feature release (if applicable)                         │
│                           │                                      │
│  3 MONTHS BEFORE          ▼                                      │
│  • Final reminder notifications                                  │
│  • Support team prepares for transition                           │
│  • Knowledge base updated with end-of-support FAQ                │
│                           │                                      │
│  END-OF-SUPPORT DATE      ▼                                      │
│  • Security update obligation ends                                │
│  • Product status changed to "End of Life" in CRANIS2            │
│  • Final security advisory published                              │
│  • CVD channel remains active for 6 months post-support          │
│                           │                                      │
│  6 MONTHS AFTER           ▼                                      │
│  • CVD channel closed                                             │
│  • Final compliance evidence archived                             │
│  • End-of-support process formally concluded                      │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 5. User Notification

### 5.1 Communication Channels

| Channel | Timing | Content |
|---|---|---|
| Email notification | 12, 6, 3, 1 month(s) before | End-of-support date, migration options, impact |
| In-app notification | 12, 6, 3, 1 month(s) before | End-of-support banner with action items |
| Product documentation | 12 months before | End-of-support FAQ and migration guide |
| Security advisory page | On end-of-support date | Final advisory stating support has ended |

### 5.2 CRANIS2 Automated Alerts

CRANIS2 automatically sends alerts to designated stakeholders at 90, 60, 30, 7, and 0 days before the end-of-support date. These alerts ensure that no end-of-support milestone is missed and provide time to complete the wind-down procedure.

---

## 6. Post-Support Responsibilities

After the support period ends:

| Responsibility | Duration | Description |
|---|---|---|
| CVD channel | 6 months post-support | Accept and acknowledge vulnerability reports, but no obligation to fix |
| Evidence retention | 10 years | Maintain all compliance evidence, ENISA notifications, and audit trail |
| Public notice | Indefinite | Product marked as "End of Life" with clear notice that security updates are no longer provided |
| SBOM availability | 10 years | Final SBOM remains available for audit purposes |

---

## 7. Successor Products

Where {{ORG_NAME}} offers a successor product, the end-of-support notification includes:

- Name and version of the successor product
- Migration path and instructions
- Any data migration tools or assistance available
- Timeline for migration support
- Whether the successor product's support period covers the same use cases

---

## 8. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Support period declaration | Minimum 10 years |
| User notification records | Minimum 10 years |
| End-of-support announcement | Minimum 10 years |
| Final SBOM | Minimum 10 years |
| Migration guidance documentation | Minimum 5 years |

---

## 9. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** ({{TECHNICAL_FILE_OWNER}}) | Owns the end-of-support decision; approves timeline and communications |
| **Security Lead** ({{SECURITY_CONTACT}}) | Manages final vulnerability assessments; oversees post-support CVD channel |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Delivers final security updates; supports migration |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures regulatory compliance throughout wind-down; archives evidence |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes end-of-support policy for CRA Art. 13(15) compliance |
`;

// ─── Secure Development Lifecycle ───────────────────────────────────────────────

const SECURE_DEV_LIFECYCLE_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Annex I, Part I.
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual development process
> 3. Have the document reviewed and approved by your Engineering Lead and
>    Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Annex I — Design & Development** section.

---

# Secure Development Lifecycle

**Document Owner:** {{MANUFACTURER_CONTACT}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Annex I, Part I — Security requirements relating to properties of products with digital elements
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the development process

---

## 1. Purpose

This document describes how {{ORG_NAME}} integrates security throughout the development lifecycle of {{PRODUCT_NAME}}, from design through to deployment and maintenance. It demonstrates compliance with CRA Annex I, Part I, which requires that products with digital elements are designed, developed, and produced to ensure an appropriate level of cybersecurity.

---

## 2. Scope

This lifecycle applies to:

- All development activities for {{PRODUCT_NAME}}
- All contributors (internal employees and external contributors)
- All components (proprietary code, open-source dependencies, third-party libraries)
- All environments (development, staging, production)

---

## 3. Security by Design

### 3.1 Principles

{{PRODUCT_NAME}} is developed in accordance with the following security-by-design principles (CRA Annex I, Part I):

| Principle | Implementation |
|---|---|
| **Minimised attack surface** | Default-deny configurations; principle of least privilege; unnecessary services disabled |
| **Defence in depth** | Multiple security layers; input validation at every boundary |
| **Secure defaults** | Products ship with secure default configurations; users must opt in to reduce security |
| **Data protection** | Personal and sensitive data encrypted at rest and in transit; data minimisation |
| **Integrity protection** | Cryptographic verification of software updates and components |

### 3.2 Threat Modelling

Before significant feature development:

1. Identify assets, entry points, and trust boundaries
2. Enumerate threats using [REVIEW: methodology, e.g. STRIDE, PASTA]
3. Assess risk and define mitigations
4. Document in the product's technical file

CRANIS2's AI risk assessment generator can produce an initial threat analysis grounded in product data, CRA category, and known vulnerability patterns. **The security team reviews, validates, and refines the output before it is accepted as the basis for design decisions.**

---

## 4. CRA Category Classification

{{PRODUCT_NAME}} is classified under the CRA product category system, which determines the applicable conformity assessment route and essential requirements.

CRANIS2's AI category recommender assists in classifying products based on functionality, connectivity, data handling, and deployment attributes. **The recommendation is reviewed and confirmed by the compliance officer before it is applied — the AI provides a starting point, not a final decision.**

---

## 5. Secure Coding Standards

### 5.1 Coding Practices

All contributors must follow:

| Practice | Description |
|---|---|
| Input validation | Validate and sanitise all external inputs at system boundaries |
| Output encoding | Encode output to prevent injection attacks (XSS, SQL injection) |
| Authentication & authorisation | Use established frameworks; enforce least privilege |
| Cryptography | Use well-vetted libraries; no custom cryptographic implementations |
| Error handling | Never expose internal details in error messages; log securely |
| Secrets management | No credentials in code; use environment variables or secret stores |

### 5.2 Code Review

All code changes require peer review before merging, with security-critical changes requiring review by the Security Lead or a designated security reviewer.

---

## 6. Dependency Management

### 6.1 SBOM Management

CRANIS2 auto-generates and maintains the Software Bill of Materials for {{PRODUCT_NAME}} from repository data. The SBOM is:

- Updated automatically on every code push (via webhook integration)
- Scanned continuously against vulnerability databases
- Available for export in SPDX format for audit and supply chain transparency

### 6.2 Dependency Selection

Before adding a new dependency:

| Check | Purpose |
|---|---|
| Licence compatibility | CRANIS2 licence compliance scanning flags incompatible or high-risk licences |
| Maintenance status | Is the package actively maintained? Last release date, open issues |
| Known vulnerabilities | Current CVE count and severity |
| Transitive dependencies | Impact on overall supply chain complexity |

### 6.3 Dependency Updates

- **Security updates**: Applied immediately per the Security Update Procedure
- **Non-security updates**: Evaluated and applied on a [REVIEW: frequency, e.g. monthly] cadence
- **Deprecated dependencies**: Replaced before they become unsupported

---

## 7. Testing Requirements

### 7.1 Security Testing

| Test Type | Frequency | Scope |
|---|---|---|
| Unit tests | Every commit | All code changes |
| Integration tests | Every merge to main | Component interactions |
| SAST (Static Application Security Testing) | Every commit | Source code analysis |
| Dependency vulnerability scan | Continuous (CRANIS2) | All SBOM components |
| Penetration testing | [REVIEW: frequency, e.g. annually] | Full application and infrastructure |
| Fuzz testing | [REVIEW: if applicable] | Input parsing and API endpoints |

### 7.2 CI/CD Compliance Gate

CRANIS2's CI/CD compliance gate is integrated into the deployment pipeline. It verifies CRA readiness as a deployment prerequisite, blocking releases that fail the configured compliance threshold. The threshold is configurable by the team to match their risk tolerance and release cadence.

---

## 8. Release & Deployment

### 8.1 Release Process

1. All tests pass (including CI/CD compliance gate)
2. Code review approved
3. SBOM regenerated and validated
4. Release classified (security-only or feature — per Versioning & Security Release Policy)
5. Deployed to production via automated pipeline
6. Post-deployment health verification

### 8.2 Integrity Verification

- All releases are cryptographically signed [REVIEW: or describe your integrity mechanism]
- Users can verify release authenticity before installation
- SBOM is published alongside each release

---

## 9. Maintenance & Monitoring

### 9.1 Continuous Monitoring

During the support period, {{PRODUCT_NAME}} is continuously monitored for:

| Aspect | Tool/Process |
|---|---|
| Dependency vulnerabilities | CRANIS2 SBOM scanning + CVE database matching |
| Licence compliance | CRANIS2 licence compliance scanning |
| CRA readiness | CRANIS2 obligation engine + compliance gap analysis |
| Support period | CRANIS2 automated alerts (90/60/30/7/0 days before expiry) |

### 9.2 Vulnerability Response

All detected vulnerabilities are handled per the Vulnerability Handling Process (Art. 13(5)), which includes AI-assisted triage with mandatory human review before any action is taken.

---

## 10. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Threat model documentation | Minimum 10 years |
| Code review records | Minimum 5 years |
| Test results (all types) | Minimum 5 years |
| SBOM snapshots | Minimum 10 years |
| Release records | Minimum 10 years |
| Penetration test reports | Minimum 10 years |
| CRA category classification rationale | Minimum 10 years |

---

## 11. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Engineering Lead** ({{MANUFACTURER_CONTACT}}) | Owns the development lifecycle; ensures secure coding practices are followed |
| **Security Lead** ({{SECURITY_CONTACT}}) | Reviews threat models; approves security-critical changes; oversees testing |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures CRA compliance throughout the lifecycle; manages evidence |
| **All Contributors** | Follow secure coding standards; participate in code review; report security concerns |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes secure development lifecycle for CRA Annex I, Part I compliance |
`;
