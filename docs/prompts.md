# CRANIS2 AI CoPilot – Prompt Inventory

Last updated: 2026-03-11 (session 38)

---

## Architecture: Three-Layer Prompt Construction

Every CoPilot prompt is constructed from three layers:

1. **Layer 1 – Quality Standard** (shared): Output quality rules from `copilot-quality-standard.md`, covering British English, canonical terminology, professional tone, consistency, substantive depth, and guardrails. Injected as a preamble into every system prompt.

2. **Layer 2 – Regulatory Context** (per capability): The specific CRA articles, Annex requirements, and regulatory evidence standards that apply to this capability. Tells the AI *what the regulation requires*.

3. **Layer 3 – Capability Prompt** (per capability): The operational instructions, covering what to generate, in what format, and with what constraints. Tells the AI *what to produce*.

All three layers are stored in the `copilot_prompts` database table and editable from **System Admin → AI CoPilot**.

---

## 1. Technical File & Obligation Suggestions

**Prompt Key:** `suggest`
**Goal:** Generate draft content for CRA Technical File sections (8 sections) and obligation evidence notes (19 obligations), grounded in real product data.

**Rationale:** Manufacturers often stare at blank compliance fields. AI drafts give them a starting point grounded in their actual SBOM, vulnerabilities, and product metadata, saving hours of manual writing while keeping the human in the loop for review.

**Acceptance Criteria:**
- Generated text references actual product data (dependency counts, CVE IDs, vulnerability statistics)
- Never invents data. Missing information is flagged with "[TO COMPLETE: ...]" markers
- Output is professional, auditor-grade language
- British English throughout
- Each field is 2–5 sentences of substantive content
- Non-destructive: only fills empty fields

**Model:** `claude-sonnet-4-20250514`
**Max Tokens:** 2,000
**Rate Limit:** 20 per product per hour
**Estimated Cost:** ~$0.01–0.03 per call (small context)

### Layer 2 – Regulatory Context

| CRA Article | Requirement | What Must Be Produced |
|---|---|---|
| Art. 13(12) | Draw up technical documentation before market placement | Complete Technical File per Annex VII (8 sections) |
| Annex VII §1 | Product description: intended purpose, versions, market availability | Product description with cybersecurity scope |
| Annex VII §2(a) | Design & development: architecture, SDLC, component integration | System architecture, SDLC documentation |
| Annex VII §2(b) | Vulnerability handling: CVD policy, SBOM reference, update distribution | CVD policy, reporting contact, update mechanism |
| Annex VII §3 | Risk assessment: methodology, threat model, Annex I assessment | Risk assessment (see Capability 3) |
| Annex VII §4 | Support period: minimum 5 years, rationale, communication plan | Support period definition and justification |
| Annex VII §5 | Standards applied: harmonised standards, common specifications | Standards list with parts applied |
| Annex VII §6 | Test reports: penetration testing, static/dynamic analysis, audits | Test report summaries |
| Annex VII §7 | Declaration of Conformity: per Article 28 and Annex VI | DoC with assessment module, notified body |

**Per-obligation regulatory mapping** (19 obligations, each with specific Article text and evidence requirements):

| Obligation | CRA Article | Evidence Required |
|---|---|---|
| Overall Manufacturer Obligations | Art. 13 | Aggregate compliance across all obligations |
| Component Currency | Art. 13(3) | SBOM, dependency version tracking, zero critical CVEs |
| No Known Vulns at Launch | Art. 13(5) | Pre-launch vulnerability scan, remediation records |
| Vulnerability Handling | Art. 13(6) | Vulnerability Handling Process, CVD policy, response SLAs |
| Automatic Security Updates | Art. 13(7) | Update mechanism documentation or infeasibility justification |
| Free Security Patches | Art. 13(8) | Policy confirming no-cost security updates |
| Separate Security Updates | Art. 13(9) | Versioning & Security Release Policy |
| Documentation Retention | Art. 13(10) | 10-year archival policy |
| SBOM | Art. 13(11) | Machine-readable SPDX JSON |
| Technical Documentation | Art. 13(12) | Complete 8-section Technical File |
| Conformity Assessment | Art. 13(14) | Test reports, assessment module selection |
| EU Declaration of Conformity | Art. 13(15) | Formal DoC per Annex IV/VI |
| Vulnerability Reporting | Art. 14 | ENISA notification process (24h/72h/14d) |
| EU DoC (Annex IV) | Art. 16 | Formal DoC with mandated fields |
| Market Surveillance Registration | Art. 20 | Registration with market authority (critical only) |
| Harmonised Standards | Art. 32 | Standards mapping with conformity evidence |
| Third-Party Assessment | Art. 32(3) | Notified body assessment (important_ii/critical) |
| Security by Design | Annex I, Part I | 13-requirement assessment with evidence |
| Vulnerability Handling (Process) | Annex I, Part II | CVD policy, severity methodology, SLAs |

### Layer 3 – System Prompt (current)

```
You are a CRA (EU Cyber Resilience Act) compliance expert embedded in the CRANIS2
compliance platform. Your role is to generate draft content for technical file
sections and obligation evidence notes.

Rules:
1. Ground all suggestions in the product's actual data (SBOM, vulnerability
   findings, repo metadata, obligation statuses).
2. Write in a professional, factual tone suitable for regulatory documentation
   and auditors.
3. Be specific; reference actual dependency counts, vulnerability stats, and
   product details rather than using generic placeholders.
4. Where the product data is insufficient, note what information the user should
   add manually.
5. Use British English spelling throughout.
6. Never invent data that isn't provided in the context. If data is missing, say
   so clearly.
7. Keep content concise but thorough. Aim for evidence-grade documentation.
```

**User Prompt (tech file sections):**
```
Generate content for the "{sectionKey}" section of the CRA technical file.

CRA guidance for this section: {guidance}

Product context:
- Name / Version / CRA Category / Repository
- SBOM summary (package count, staleness)
- Vulnerability summary (counts by severity)
- Obligation statuses
- Tech file progress

Return a JSON object with fields: {fields}
Each field value should be a string of 2-5 sentences of substantive content.
```

**User Prompt (obligation evidence):**
```
Generate evidence/compliance notes for the following CRA obligation:

Obligation: {article} – {title}
Description: {description}

Product context: [same as above]

Write 3-6 sentences of evidence notes. Return plain text (not JSON).
```

### Gap Analysis

| Gap | Description | Impact |
|---|---|---|
| **Generic system prompt** | Same prompt for all 8 tech file sections, so "vulnerability_handling" gets identical treatment to "standards_applied" | Lower quality, generic output |
| **No obligation-specific depth** | Same prompt for all 19 obligations; art_13 (general) treated same as art_14 (incident reporting) | Misses obligation-specific nuances |
| **No industry awareness** | No product-type context (IoT, SaaS, embedded, library, medical) | Generic risk language |
| **No structured output options** | Always prose, with no checklists or structured formats | Less actionable for users |
| **No section guidance enrichment** | Section guidance strings are brief, with no regulatory detail on what auditors look for | Shallow output |

---

## 2. Vulnerability Triage

**Prompt Key:** `vulnerability_triage`
**Goal:** Analyse open vulnerability findings and suggest dismiss/acknowledge/escalate actions with confidence scores, reasoning, and package-manager-specific mitigation commands.

**Rationale:** A typical product has 50–200+ vulnerability findings. Manual triage is time-consuming and requires security expertise. AI triage prioritises findings by risk, auto-dismisses clear false positives (confidence >=85%), and provides copy-paste fix commands.

**Acceptance Criteria:**
- Each finding gets: action, confidence (0–1), reasoning (2–4 sentences)
- Dismissed findings include audit-trail reason
- Acknowledge/escalate findings include mitigation command (npm/pip/cargo/go/etc.)
- CRA category affects strictness (important_i/ii/critical = stricter)
- Auto-dismiss only when confidence >=0.85 AND action is "dismiss"
- Batched (20 findings per API call) for large finding sets

**Model:** `claude-sonnet-4-20250514`
**Max Tokens:** 4,000
**Rate Limit:** 5 per product per hour
**Batch Size:** 20 findings per API call
**Estimated Cost:** ~$0.02–0.05 per batch (medium context)

### Layer 2 – Regulatory Context

| CRA Article | Requirement | How Triage Supports It |
|---|---|---|
| Art. 13(3) | Keep all components free of known exploitable vulnerabilities throughout support period | Triage identifies which findings require remediation vs. which are false positives |
| Art. 13(5) | No known exploitable vulnerabilities at market placement | Pre-launch triage ensures all critical/high findings are addressed |
| Art. 13(6) | Identify and document vulnerabilities, provide security updates for 5+ years | Triage provides the assessment methodology and audit trail for vulnerability handling |
| Annex I, Part I, I(a) | Products shall be delivered without known exploitable vulnerabilities | Triage validates this requirement is met through systematic finding review |
| Annex I, Part II | Implement vulnerability handling processes including coordinated disclosure | Triage automates the severity assessment and prioritisation step |

**CRA category strictness mapping:**
- `default`: Standard triage; dismiss low-severity dev-only findings freely
- `important_i`: Stricter; escalate medium-severity findings more aggressively
- `important_ii`: Strict; almost all findings with available fixes should escalate
- `critical`: Maximum strictness; only dismiss with very high confidence (>=0.95)

### Layer 3 – System Prompt (current)

```
You are a CRA (EU Cyber Resilience Act) vulnerability triage expert. Your task is
to analyse vulnerability findings for a software product and suggest an appropriate
action for each.

For each finding, suggest one of:
- "dismiss": Not exploitable in context, false positive, dev-only, negligible risk.
- "acknowledge": Real but low priority; track but no immediate action.
- "escalate_mitigate": Urgent attention required. Fix, upgrade, or mitigate.

Rules:
1. Consider the product's CRA category. For "important_i", "important_ii", and
   "critical" categories, be significantly stricter.
2. A fix being available (fixedVersion) increases urgency to escalate.
3. Critical/high severity with high CVSS should almost always escalate unless
   clearly not applicable.
4. Low severity in dev-only dependencies are strong dismiss candidates.
5. Confidence between 0 and 1. Conservative; only >=0.85 when clear-cut.
6. Automatable = true ONLY when confidence >=0.85 AND action is "dismiss".
7. Reasoning of 2-4 sentences.
8. Include dismissReason (for audit trail) when dismissing.
9. British English.
10. When action is acknowledge/escalate and fix available, include mitigationCommand
    (exact CLI: "npm install lodash@4.17.21", "pip install requests>=2.31.0", etc.).

Return ONLY a JSON array of objects:
- findingId, suggestedAction, confidence, reasoning, dismissReason,
  mitigationCommand, automatable
```

### Gap Analysis

| Gap | Description | Impact |
|---|---|---|
| **No direct vs transitive awareness** | Cannot distinguish direct dependencies (user controls) from transitive (harder to fix) | Mitigation commands may be impractical for transitive deps |
| **No EPSS consideration** | Does not factor exploit prediction scores, so real-world exploitation likelihood is ignored | May over-escalate vulns with no known exploit |
| **No reachability analysis** | Cannot determine whether vulnerable code paths are actually invoked | Higher false positive rate in dismiss decisions |
| **Confidence calibration untested** | 85% threshold chosen heuristically, with no validation against actual outcomes | May auto-dismiss findings that should have been reviewed |

---

## 3. Risk Assessment Generator

**Prompt Key:** `risk_assessment`
**Goal:** Generate a comprehensive Annex VII §3 cybersecurity risk assessment including methodology, threat model, risk register, and all 13 Annex I Part I requirement assessments.

**Rationale:** A full CRA risk assessment is one of the most complex compliance documents. It requires security expertise most small/medium manufacturers lack. AI generates a structured first draft grounded in real vulnerability and dependency data.

**Acceptance Criteria:**
- Methodology section (2–4 paragraphs)
- Threat model (2–4 paragraphs) referencing actual vulnerabilities and dependencies
- Risk register as Markdown table (threat, likelihood, impact, risk level, mitigation, status)
- All 13 Annex I Part I requirements assessed (applicable, justification, evidence)
- Real CVE IDs and dependency names referenced; nothing invented
- Professional tone for regulatory auditors

**Model:** `claude-sonnet-4-20250514`
**Max Tokens:** 6,000
**Rate Limit:** 3 per product per day
**Estimated Cost:** ~$0.05–0.15 per call (large context + output)

### Layer 2 – Regulatory Context

| CRA Article | Requirement | What the Risk Assessment Must Demonstrate |
|---|---|---|
| Art. 13(2) | Risk assessment considering intended and foreseeable use | Methodology must address both intended use and reasonably foreseeable misuse |
| Annex VII §3 | Cybersecurity risk assessment documentation | Full risk assessment with methodology, threat model, and risk register |
| Annex I, Part I | 13 essential cybersecurity requirements | Each requirement assessed for applicability with justification and evidence |

**The 13 Annex I Part I requirements (assessed individually):**

| Ref | Requirement | What Evidence Satisfies It |
|---|---|---|
| I(a) | No known exploitable vulnerabilities | SBOM scan results showing zero critical/high CVEs; remediation records |
| I(b) | Secure-by-default configuration | Default config documentation; no open ports/services by default; principle of least privilege |
| I(c) | Security update mechanism | Automatic update capability; update delivery documentation; rollback procedure |
| I(d) | Access control & authentication | Authentication mechanism; role-based access; password policy; MFA capability |
| I(e) | Data confidentiality & encryption | Encryption at rest and in transit; key management; data classification |
| I(f) | Data & command integrity | Input validation; integrity checking; tamper detection; secure boot (if applicable) |
| I(g) | Data minimisation | Data collection justification; retention policies; GDPR alignment |
| I(h) | Availability & resilience | Redundancy; failover; DDoS protection; recovery procedures |
| I(i) | Minimise impact on other services | Network isolation; resource limits; graceful degradation |
| I(j) | Attack surface limitation | Unused feature disabling; port minimisation; dependency reduction |
| I(k) | Exploitation mitigation | Memory safety; ASLR/DEP; sandboxing; exploit detection |
| I(l) | Security monitoring & logging | Audit logging; anomaly detection; log retention; alerting |
| I(m) | Secure data erasure & transfer | Secure deletion; data portability; migration tools |

### Layer 3 – System Prompt (current)

```
You are a CRA (EU Cyber Resilience Act) cybersecurity risk assessment expert.
Generate a comprehensive cybersecurity risk assessment for a software product.

Produce:
1. Methodology section (2-4 paragraphs)
2. Threat model with threats, attack surfaces, mitigations (2-4 paragraphs)
3. Risk register as Markdown table: #, Threat, Likelihood, Impact, Risk Level,
   Mitigation, Status
4. For each of 13 Annex I Part I requirements: applicability, justification,
   evidence

The 13 requirements: I(a) no known exploitable vulns, I(b) secure-by-default,
I(c) security updates, I(d) access control, I(e) data confidentiality,
I(f) data integrity, I(g) data minimisation, I(h) availability/resilience,
I(i) minimise impact on other services, I(j) attack surface limitation,
I(k) exploitation mitigation, I(l) security monitoring/logging,
I(m) secure data erasure/transfer.

Rules:
1. Ground ALL content in actual data. Reference real CVE IDs, dependencies, stats.
2. Never invent vulnerabilities, dependencies, or data not provided.
3. Risk register derived from actual vulnerability findings and licence issues.
4. Note missing information clearly.
5. British English.
6. Professional, auditor-suitable tone.
7. Risk register must be valid Markdown table.
8. Annex I: provide evidence if data supports it, note gaps if not.

Return JSON: { "fields": { "methodology", "threat_model", "risk_register" },
"annexIRequirements": [{ "ref", "title", "applicable", "justification",
"evidence" }] }
```

### Gap Analysis

| Gap | Description | Impact |
|---|---|---|
| **No product-type differentiation** | IoT device, cloud SaaS, embedded firmware, and npm library all get identical treatment | Generic threat models miss domain-specific threats |
| **No methodology framework option** | No STRIDE, DREAD, FAIR, or OWASP alignment, so methodology is ad hoc | Less credible for auditors who expect named frameworks |
| **No industry threat catalogues** | Threats are derived only from vulnerability data, with no ENISA threat landscape reference | Incomplete threat coverage |
| **Shallow Annex I evidence** | Evidence relies solely on SBOM/vuln data; many requirements (I(d)–I(m)) need architecture info not available in product context | "Insufficient data" for most requirements |

---

## 4. Incident Report Drafter

**Prompt Key:** `incident_report_draft`
**Goal:** Draft ENISA Article 14 report stages (early warning, notification, final report) for vulnerability and incident reports.

**Rationale:** CRA Article 14 has strict deadlines (24h/72h/14d). Under time pressure, manufacturers need structured, pre-filled report content. AI drafts from product data so the user can review and submit rather than starting from scratch.

**Acceptance Criteria:**
- Fills only empty fields (non-destructive)
- Uses "[TO COMPLETE: ...]" placeholders for insufficient data
- Maintains consistency across stages (early warning → notification → final)
- References actual CVE IDs and product data
- Correct field values: suspectedMalicious (yes/no/unknown), patchStatus (available/in_progress/planned), userNotificationStatus (informed/pending/not_required)

**Model:** `claude-sonnet-4-20250514`
**Max Tokens:** 3,000
**Rate Limit:** 5 per report per day
**Estimated Cost:** ~$0.02–0.05 per call

### Layer 2 – Regulatory Context

| CRA Article | Requirement | Deadline | What Must Be Reported |
|---|---|---|---|
| Art. 14(1) | Early Warning to CSIRT | 24 hours | Summary of vulnerability/incident; suspected malicious activity; affected member states; TLP classification |
| Art. 14(2) | Notification to CSIRT | 72 hours | Vulnerability details; exploitation nature; affected component; corrective measures; patch status; user mitigations |
| Art. 14(3) | Final Report to ENISA | 14 days (vulns) / 1 month (incidents) | Detailed description; severity assessment; root cause analysis; malicious actor info; security updates issued; preventive measures; user notification status |

**Report stage field mapping:**

| Stage | Vulnerability Fields | Incident Fields |
|---|---|---|
| Early Warning (24h) | summary, memberStatesDetail, sensitivityNote | summary, suspectedMalicious, memberStatesDetail, sensitivityNote |
| Notification (72h) | vulnerabilityDetails, exploitNature, affectedComponent, correctiveMeasures, userMitigations, patchStatus | incidentNature, initialAssessment, correctiveMeasures, userMitigations |
| Final Report (14d/1mo) | detailedDescription, severityAssessment, rootCause, maliciousActorInfo, securityUpdates, preventiveMeasures, userNotificationStatus | detailedDescription, severityAssessment, threatType, ongoingMitigation, preventiveMeasures |

**Enumerated field constraints:**
- `suspectedMalicious`: "yes" | "no" | "unknown"
- `patchStatus`: "available" | "in_progress" | "planned"
- `userNotificationStatus`: "informed" | "pending" | "not_required"

### Layer 3 – System Prompt (current)

```
You are a CRA (EU Cyber Resilience Act) incident and vulnerability reporting expert
embedded in the CRANIS2 compliance platform. Draft content for ENISA Article 14
report stages.

Background: Under CRA Article 14, manufacturers must report actively exploited
vulnerabilities and severe incidents to their CSIRT within:
- Early Warning: 24 hours
- Notification: 72 hours
- Final Report: 14 days (vulns) or 1 month (incidents)

Rules:
1. Ground in actual data (SBOM, vulns, linked findings, repo metadata).
2. Professional tone for CSIRT/ENISA regulatory submissions.
3. Reference actual CVE IDs, dependency names, versions, statistics.
4. Insufficient data → "[TO COMPLETE: ...]" placeholders.
5. British English.
6. Never invent data.
7. Concise but thorough. These are regulatory submissions, not essays.
8. Maintain consistency with previous stages.
9. suspectedMalicious: "yes", "no", or "unknown" only.
10. patchStatus: "available", "in_progress", or "planned" only.
11. userNotificationStatus: "informed", "pending", or "not_required" only.

Return JSON object with requested fields as keys and string values.
```

### Gap Analysis

| Gap | Description | Impact |
|---|---|---|
| **No CSIRT-specific awareness** | Different EU member state CSIRTs may have additional requirements beyond base Article 14 | May miss country-specific fields |
| **No vulnerability vs incident differentiation** | Same system prompt for both report types, with only field differences | Different tone and urgency needed |
| **No cross-stage content linking** | Consistency instruction is vague, with no mechanism to reference previous stage content | May contradict earlier submissions |
| **No TLP classification guidance** | TLP sensitivity (WHITE/GREEN/AMBER/RED) affects what can be shared but is not reflected in drafting | Content may be too detailed for chosen TLP level |

---

## 5. CRA Category Recommendation (AI Augmentation)

**Prompt Key:** `category_recommendation`
**Goal:** Augment deterministic CRA category scoring with AI assessment of product description for risk factors not captured by the 4 deterministic attributes.

**Rationale:** Deterministic scoring (distribution scope, data sensitivity, network connectivity, user criticality) catches most cases, but product descriptions may reveal additional risk factors (e.g. "controls medical devices" or "processes payment data") that shift the category.

**Acceptance Criteria:**
- Score adjustment between −0.2 and +0.2
- Confidence score (0.0–1.0)
- Clear explanation of reasoning
- Suggests new category only if adjustment is significant
- Small adjustments preferred

**Model:** `claude-opus-4-1` (higher capability for nuanced assessment)
**Max Tokens:** 500
**Temperature:** 0.3
**Rate Limit:** 5 per product per day
**Estimated Cost:** ~$0.03–0.08 per call (Opus, but small context)

### Layer 2 – Regulatory Context

| CRA Article | Requirement | How Category Recommendation Supports It |
|---|---|---|
| Art. 3(1)–(3) | Product categorisation: default, important (Class I/II), critical | Ensures products are correctly classified based on risk profile |
| Art. 6 | Important products with digital elements (Annex III) | Validates whether product matches Annex III Class I/II criteria |
| Art. 7 | Critical products with digital elements (Annex IV) | Validates whether product matches Annex IV critical criteria |

**CRA category thresholds:**
- 0.0–0.33: **default** – baseline CRA obligations (Art. 13, self-assessment module A)
- 0.33–0.66: **important (Class I)** – intensified obligations, self-assessment or harmonised standard
- 0.66–0.85: **important (Class II)** – third-party assessment required (Art. 32(3))
- 0.85+: **critical** – maximum obligations, market surveillance registration (Art. 20)

### Layer 3 – User Prompt (current, no system prompt)

```
You are a CRA compliance expert. A product has been scored {score} / 1.0,
recommending "{category}" CRA class.

Product:
- Name: {productName}
- Description: {productDescription}

Deterministic factors: {attributeScores}

Assess:
1. Does the description reveal risk factors NOT captured by deterministic attributes?
2. Should the score be adjusted UP or DOWN? By how much (+-0.0 to +-0.2)?
3. What is your confidence (0.0–1.0)?

Respond JSON: { "adjustmentApplied", "explainedReason", "confidence",
"suggestedCategory" }
```

### Gap Analysis

| Gap | Description | Impact |
|---|---|---|
| **No system prompt** | Only user prompt, so quality standard injection point is missed | Inconsistent tone and terminology |
| **No Annex III/IV reference** | Does not reference the specific product types listed in CRA Annexes III and IV | May miss regulatory classification triggers |
| **No industry keyword matching** | Relies entirely on free-text description analysis | May miss implicit risk factors |

---

## 6. Rule Change Validation

**Prompt Key:** `rule_change_validation`
**Goal:** Validate administrative changes to CRA category scoring rules against regulatory requirements.

**Rationale:** When an admin changes scoring thresholds or attribute weights, AI checks whether the change could cause products to be miscategorised, creating compliance exposure.

**Acceptance Criteria:**
- Assessment: aligned, misaligned, or review_required
- Detailed reasoning
- Suggested corrections if misaligned
- Flags changes that require override

**Model:** `claude-opus-4-1`
**Max Tokens:** 800
**Temperature:** 0.3
**Rate Limit:** (part of category recommendation limit)
**Estimated Cost:** ~$0.03–0.08 per call

### Layer 2 – Regulatory Context

| CRA Article | Requirement | How Validation Supports It |
|---|---|---|
| Art. 3–4 | Product classification definitions | Validates rule changes don't conflict with statutory definitions |
| Art. 6–7 | Important and critical product criteria | Ensures threshold changes don't miscategorise regulated products |
| Annex III | List of important product categories (Class I & II) | Reference for what products MUST be classified as important |
| Annex IV | List of critical product categories | Reference for what products MUST be classified as critical |

### Layer 3 – User Prompt (current, no system prompt)

```
You are a CRA compliance expert reviewing an administrative change to risk rules.

Change Type: {changeType}
Old Values: {oldValues}
New Values: {newValues}

Assess:
1. Is this aligned with CRA Articles 3–4 on product classification?
2. Could it inadvertently miscategorise products?
3. Any conflict with ISO 42001 (AI governance)?

Respond JSON: { "regulatoryAlignment", "reasoning", "suggestedCorrections",
"requiresOverride" }
```

### Gap Analysis

| Gap | Description | Impact |
|---|---|---|
| **No system prompt** | Only user prompt, so quality standard injection is missed | Inconsistent output |
| **No Annex III/IV product lists** | Doesn't reference statutory product classification lists | May approve changes that miscategorise listed products |

---

## Cost Summary

| Capability | Prompt Key | Model | Est. Cost/Call | Rate Limit | Frequency |
|---|---|---|---|---|---|
| Tech file / obligation suggest | `suggest` | Sonnet | $0.01–0.03 | 20/product/hr | High (onboarding) |
| Vulnerability triage | `vulnerability_triage` | Sonnet | $0.02–0.05 | 5/product/hr | Medium (after scans) |
| Risk assessment | `risk_assessment` | Sonnet | $0.05–0.15 | 3/product/day | Low (once per product) |
| Incident report draft | `incident_report_draft` | Sonnet | $0.02–0.05 | 5/report/day | Low (incident-driven) |
| Category recommendation | `category_recommendation` | Opus | $0.03–0.08 | 5/product/day | Low (once per product) |
| Rule change validation | `rule_change_validation` | Opus | $0.03–0.08 | (with category) | Very low (admin only) |

**Monthly budget:** 500K tokens default (configurable per org). At typical usage, this is roughly $15–50/month for an active organisation.

---

## Gap Analysis Summary – P7 #38 & #39

### #38 – Prompt Engineering Topic Focus

| Gap | Description | Impact | Phase |
|---|---|---|---|
| **No quality standard preamble** | Each prompt independently specifies tone, language, and format rules | Inconsistent output quality | Phase 1 (this work) |
| **Generic tech file prompt** | Same prompt for all 8 sections, with no section-specific regulatory depth | Lower quality, generic output | Phase 2 |
| **No obligation-specific depth** | Same prompt for all 19 obligations, with no obligation-specific nuances | Misses regulatory detail | Phase 2 |
| **No industry awareness** | No product-type context (IoT, SaaS, embedded, library, medical) | Generic risk language | Phase 3 |
| **No structured output options** | Always prose, with no checklists or structured formats | Less actionable | Phase 3 |
| **No refinement/follow-up** | Each call is one-shot, with no iterative improvement | Users can't refine output | Phase 3 |
| **No EPSS/reachability in triage** | Missing exploit prediction and code reachability analysis | Higher false positive rate | Phase 3 |

### #39 – Automation Wizards

| Gap | Description | Impact | Phase |
|---|---|---|---|
| **No batch tech file fill** | Must click "AI Suggest" 8 times for 8 sections | Tedious for new products | Phase 2 |
| **No batch obligation fill** | Must click "AI Suggest" 19 times for 19 obligations | Tedious | Phase 2 |
| **No post-scan triage flow** | After a vulnerability scan, no prompt to triage new findings | Missed automation | Phase 2 |
| **No onboarding wizard** | New users must find each AI button individually | Poor first-run experience | Phase 3 |
| **No compliance readiness wizard** | No guided "fix your 5 biggest gaps" flow | Users don't know where to start | Phase 3 |
| **No scheduled/automatic actions** | All AI features require manual button clicks | More manual work | Phase 3 |
