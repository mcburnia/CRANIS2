<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# Help Guide Review: Full Audit Against Help Guide Standard

**Date:** 2026-03-16
**Scope:** All 48 help files in `frontend/public/help/`
**Reviewed against:** `docs/HELP-GUIDE-STANDARD.md`

---

## Executive Summary

The 48 help guides split into three tiers of quality:

| Tier | Count | Description |
|------|-------|-------------|
| **Real content** | 30 | Bespoke station maps and substantive body text, but with consistent gaps against the standard |
| **Stub/placeholder** | 18 | Identical generic 5-station template with boilerplate text. Fail every standard criterion. |

The 18 stubs are the highest priority. They document features that exist and are complete but have no real help content.

### Systemic Gaps (affect all 48 files)

These issues appear in every file without exception:

1. **No Copilot prompt key references anywhere.** Zero files reference a `copilot_prompts` prompt_key by name, despite multiple files mentioning AI features.
2. **No cost profiles or lifecycle frequency.** Zero files document token usage, invocation cost, or lifecycle frequency classes.
3. **Non-standard audience tags.** All files use ad hoc tags ("End user", "Staff", "Sales", "Developers") instead of the standard's five roles (Software Engineer, Product Manager, Compliance Officer, Test Engineer, Administration User).
4. **No role-aware content delivery.** All content is one-size-fits-all. No role tags on sections, no conditional depth, no role-specific landing pages.
5. **Em dashes present throughout.** Unicode em dashes (U+2014) appear in station titles and sub-text across at least 15 files. The editorial standard prohibits these.
6. **Sparse regulatory citations.** Most files either omit CRA/NIS2 Article references entirely or cite them inconsistently. The standard requires full reference on first mention, short form thereafter.
7. **Input element documentation incomplete.** Where input fields exist, the five-question framework (what to enter, why, Copilot availability, good answer qualities, common mistakes) is never fully applied.
8. **Reversibility statements missing.** Almost no action element documents whether the action can be undone.
9. **Footer diagram counts wrong.** Files added after the initial set were not reflected in earlier footers (e.g. ch7_05 says "5 of 5" but ch7 now has 10 guides).
10. **Navigation links broken/incomplete.** ch7_05's Next button is disabled, severing access to ch7_06-ch7_10. Some prev/next links skip files.
11. **Duplicated CSS.** All files contain an identical ~70-line CSS block that should be extracted to a shared stylesheet.
12. **Emoji escape bugs.** Several stub files show `\U0001f5fa\ufe0f` as literal text rather than rendering the map emoji.

---

## Stub Files Requiring Complete Rewrite (18 files)

These files contain only generic placeholder text ("Full content for this guide is being prepared") and fail every standard criterion. Each needs a full rewrite with bespoke station maps, real content, and full standard compliance.

### Chapter 2 (1 stub)
| File | Feature | Regulatory Driver |
|------|---------|-------------------|
| ch2_05_supplier_due_diligence.html | Supplier DD questionnaires | CRA Art. 13(5), NIS2 Art. 21(2)(d) |

### Chapter 3 (2 stubs)
| File | Feature | Regulatory Driver |
|------|---------|-------------------|
| ch3_04_batch_triage.html | Post-scan triage wizard | CRA Art. 13(6) |
| ch3_05_understanding_severity.html | CVSS severity reference | CRA Art. 13(6), Art. 14 |

### Chapter 4 (3 stubs)
| File | Feature | Regulatory Driver |
|------|---------|-------------------|
| ch4_05_batch_fill.html | Batch Fill wizard (core Copilot feature) | CRA Annex VII |
| ch4_06_ai_copilot.html | AI Copilot user reference | All Copilot capabilities |
| ch4_07_risk_assessment.html | Annex I risk assessment | CRA Annex I (a)-(m) |

### Chapter 5 (3 stubs)
| File | Feature | Regulatory Driver |
|------|---------|-------------------|
| ch5_05_compliance_reports.html | Three report types | CRA Art. 13 |
| ch5_06_compliance_vault.html | 10-year compliance archive | CRA Art. 23(2), Art. 13 |
| ch5_07_due_diligence_package.html | Buyer/investor DD package | CRA Art. 13 |

### Chapter 6 (1 stub)
| File | Feature | Regulatory Driver |
|------|---------|-------------------|
| ch6_05_incident_lifecycle.html | Internal incident management | CRA Art. 14, NIS2 Art. 23 |

### Chapter 7 (5 stubs)
| File | Feature | Regulatory Driver |
|------|---------|-------------------|
| ch7_06_stakeholders.html | Stakeholder/contact management | CRA Art. 13(12) |
| ch7_07_org_settings.html | Organisation settings incl. CRA role | CRA Art. 3, Art. 13-19 |
| ch7_08_trello_integration.html | Trello task automation | CRA Art. 13 (task tracking) |
| ch7_09_Trust Centre.html | Supplier Trust Centre | **Feature not built (P5 parked)**. Remove or mark "Coming soon". |
| ch7_10_document_templates.html | Document template library | CRA Annex VII, Art. 28 |

### Priority order for stubs

1. **ch4_06_ai_copilot.html** -- primary Copilot user reference, directly supports the standard's Section 4
2. **ch4_05_batch_fill.html** -- core Copilot feature, high-frequency use
3. **ch4_07_risk_assessment.html** -- Annex I is a central CRA requirement
4. **ch6_05_incident_lifecycle.html** -- complete feature with 8 API endpoints, no docs
5. **ch5_06_compliance_vault.html** -- major feature (P8, 7 phases), no docs
6. **ch5_05_compliance_reports.html** -- three report types, no docs
7. **ch7_07_org_settings.html** -- CRA role selection is one of the most consequential settings
8. **ch5_07_due_diligence_package.html** -- investor-facing, high value
9. **ch2_05_supplier_due_diligence.html** -- complete feature, no docs
10. **ch3_04_batch_triage.html** -- automation wizard, no docs
11. **ch3_05_understanding_severity.html** -- reference guide, should use non-linear map
12. **ch7_10_document_templates.html** -- P6 complete, no docs
13. **ch7_06_stakeholders.html** -- overlaps with ch7_04
14. **ch7_08_trello_integration.html** -- integration feature
15. **ch7_09_Trust Centre.html** -- feature not built, lowest priority

---

## File-by-File Findings: Real Content Files (30 files)

### Chapter 0: Introduction

#### ch0_01_what_is_cra.html
- **Status:** Primer page, no UI elements. Acceptable structure.
- **Regulatory refs:** FAIL. Does not cite regulation number (EU) 2024/2847, no Article references for obligations, deadlines, penalties, or scope.
- **Editorial:** "almost certainly" is a hedge phrase. Remove.
- **Actions:** Add regulation number. Add Article refs to every station. Remove hedge phrase.

#### ch0_02_glossary.html
- **Status:** Reference page. Good structure.
- **Copilot:** Mentions AI drafting for Technical File and ENISA without prompt key refs.
- **Regulatory refs:** No Article/Annex citations for any glossary term (SBOM, Technical File, DoC, CE marking, ENISA, Notified Body).
- **Actions:** Add Article/Annex refs to every term. Add prompt key refs where Copilot is mentioned. Add human-in-the-loop language.

### Chapter 1: Onboarding

#### ch1_01_account_creation.html
- **Em dash:** Station "verify" sub-text. Fix.
- **Element gaps:** Email/password inputs not fully documented. Resend rate limiting not mentioned. Account deletion reversibility absent.
- **Actions:** Fix em dash. Add input field detail. Add reversibility for account creation.

#### ch1_02_org_setup.html
- **Em dashes:** Stations "welcome" and "wizard" sub-text. Fix both.
- **Element gaps:** 5 wizard fields lack the five-question input framework. CRA role reversibility is vague.
- **Regulatory refs:** CRA role station does not cite Art. 3 (definitions) or Art. 13/18/19 (operator obligations). Company size does not mention micro-enterprise exemptions.
- **Actions:** Fix em dashes. Expand each wizard field to full input documentation. Add Article refs. Clarify CRA role reversibility and downstream effects.

#### ch1_03_repo_connection.html
- **Em dash:** Station "provider" sub-text. Fix.
- **Element gaps:** PAT field missing required scopes guidance. Connection reversibility absent. Sync status indicator not documented.
- **Regulatory refs:** No citation for SBOM requirement (Art. 13(5), Annex II).
- **Automation-first:** Strong. Three-tier SBOM approach well explained.
- **Actions:** Fix em dash. Add PAT scope requirements. Document disconnection. Add regulatory refs.

#### ch1_04_compliance_checklist.html
- **Copilot:** Mentions AI Auto-Triage and AI Copilot for Technical File with no prompt keys, no cost profiles.
- **Regulatory refs:** Partial. Annex VII cited for Technical File, Art. 16 for DoC. Missing refs for steps 1-4 and 6.
- **Editorial:** "eliminating 60-80% of the documentation effort" is unsubstantiated marketing. Remove or rephrase.
- **Actions:** Add prompt keys (vulnerability_triage, section:* prompts). Add cost profiles. Add missing Article refs. Remove marketing claim.

#### ch1_05_add_product.html
- **Copilot:** Mentions Category Recommender with no prompt key (`category_recommendation`), no cost, no lifecycle (one-off/onboarding).
- **Element gaps:** Product description missing "good answer" guidance. Distribution model regulatory consequences absent.
- **Regulatory refs:** Category station does not cite Art. 6-8 or Annexes III/IV.
- **Actions:** Add prompt key and cost profile. Add Article refs. Expand input field guidance.

#### ch1_06_reading_dashboard.html
- **Status:** Editorially strongest page. Good automation-first framing.
- **Element gaps:** Dashboard elements missing data sources and action guidance for concerning values.
- **Regulatory refs:** No dashboard metric traced to a CRA Article.
- **Actions:** Add data source info per element. Add "what to do" guidance. Add Article traceability.

#### ch1_07_notifications.html
- **Status:** Strong automation-first framing. Best role-aware content in Ch1 (mentions role-based contacts).
- **Regulatory refs:** ENISA deadlines not traced to Art. 14. Vulnerability notifications not traced to Art. 13(6).
- **Actions:** Add Article refs. Document bulk actions. Add compliance implications of disabling alerts.

### Chapter 2: Dependency Management

#### ch2_01_sbom_sync_cycle.html
- **Regulatory refs:** Zero. SBOM requirement traces to CRA Annex I Part II Section 1 and Art. 13(5). Neither cited.
- **Element gaps:** Sync button not documented as action element (reversibility, consequences).
- **Actions:** Add regulatory refs. Document Sync button. State Copilot is N/A (fully automated).

#### ch2_02_vuln_scan_flow.html
- **Copilot:** Mentions AI Auto-Triage without prompt key (`vulnerability_triage`) or cost profile.
- **Regulatory refs:** Art. 13(6) cited once in "clean scan" station. Art. 14 mentioned at ENISA station without full citation.
- **Element gaps:** Five triage statuses lack reversibility and regulatory consequence documentation.
- **Actions:** Add prompt key. Add full Art. 13(6) citation. Document status transition consequences. Add cross-ref to ch3_02.

#### ch2_03_licence_compliance.html
- **Regulatory refs:** Zero. Licence data required by CRA Annex I Part II Section 1.
- **Element gaps:** Waiver justification field is the most significant input element gap. No "what to enter", no "good answer", no common mistakes, no Copilot availability.
- **Actions:** Add regulatory refs. Document waiver field fully. Clarify Copilot availability for waivers. Add data source for licence classification.

#### ch2_04_supply_chain_risk.html
- **Regulatory refs:** Zero. NIS2 Art. 21(2)(d) and CRA Art. 13(5) not cited.
- **Element gaps:** Score data sources incomplete. "Fresh" vs "stale" SBOM not defined precisely.
- **Editorial:** Emoji escape bug on line 128.
- **Actions:** Add regulatory refs. Define SBOM staleness threshold. Fix emoji bug. Add engineer-focused action guidance.

### Chapter 3: Risk Management

#### ch3_01_finding_triage.html
- **Status:** Best action element documentation across all files (5 status transitions).
- **Em dash:** Station sub-text "Aware and evaluating, not yet actioned" has Unicode em dash. Fix.
- **Copilot:** Mentions AI Auto-Triage without prompt key.
- **Element gaps:** Dismissed reason and mitigation notes fields not documented as inputs. Reversibility absent for most transitions.
- **Actions:** Fix em dash. Add prompt key. Document input fields. Add reversibility per status.

#### ch3_02_ai_autotriage.html
- **Status:** Best automation-first guide. Correctly frames user as reviewer/approver.
- **Copilot:** Most Copilot-relevant guide but missing: prompt key (`vulnerability_triage`), cost profile, rate limit (5/product/hr), token budget, admin settings link.
- **Regulatory refs:** Zero. Art. 13(6) not cited.
- **Actions:** Add all Copilot specification details. Add Art. 13(6). Add admin guidance for prompt config.

#### ch3_03_enisa_escalation.html
- **Status:** Best regulatory guide of Ch2-Ch3. References Art. 14 throughout.
- **Copilot:** Mentions AI Incident Report Drafter without prompt key (`incident_report_draft`) or cost profile.
- **Element gaps:** Report form fields (5 fields across 3 stages) listed but not documented per input standard.
- **Audience tags:** "Sales" is wrong. Should be "Compliance officer", "Security lead".
- **Actions:** Add prompt key. Document form fields fully. Fix audience tags. Cite specific Art. 14 sub-articles per stage.

### Chapter 4: Compliance Documentation

#### ch4_01_technical_file.html
- **Element gaps:** Content editor, internal notes field, status dropdown per section not documented. No "good answer" or "common mistakes" for any section.
- **Copilot:** Mentions Copilot can "draft any section" but no prompt keys (`section:*`), no trigger mechanism, no review workflow, no cost profile.
- **Regulatory refs:** Cites "Annex VII Section X" but never explains *why* each section exists. Art. 31 not mentioned.
- **Actions:** Add per-section input documentation. Add all 8 `section:*` prompt keys. Add regulatory "why". Document progress indicator.

#### ch4_02_obligations.html
- **Em dashes:** 3 instances in station sub-text. Fix all.
- **Copilot:** Mentions "AI Suggest" without the 19 `obligation:*` prompt keys, rate limits, or cost profiles.
- **Element gaps:** Evidence notes text area and status dropdown not documented as input/action elements. Derivation rules for auto-intelligence not explained.
- **Actions:** Fix em dashes. Add prompt keys. Document evidence notes and status dropdown. Explain derivation rules.

#### ch4_03_cra_category.html
- **Copilot:** Mentions AI scoring without prompt key (`category_recommendation`), cost (one-off), rate limit (5/product/day).
- **Element gaps:** 4 assessment questions not documented as input elements. Apply button lacks reversibility and downstream consequences.
- **Regulatory refs:** Does not cite Art. 32 or Annex III.
- **Actions:** Add prompt key and cost. Document questions as inputs. Add Article refs. Document downstream effects of category change.

#### ch4_04_declaration_conformity.html
- **Status:** Good automation-first framing (platform auto-populates).
- **Element gaps:** Content editor and signatory fields not documented. Re-generation reversibility absent.
- **Regulatory refs:** Art. 16 cited but may need verification against final CRA text (possibly Art. 28). Annex V not referenced. "CE-mark ready" claim needs qualification (conformity assessment also required for Class I/II).
- **Actions:** Verify Article number. Add Annex V ref. Qualify legal claims. State this is deterministic, not AI-generated.

### Chapter 5: Compliance Lifecycle

#### ch5_01_enisa_reporting.html
- **Em dashes:** 3 instances in stage station titles ("Early warning, 24 hours" etc). Fix.
- **Copilot:** Mentions AI Incident Report Drafter at stage 1 only. No prompt key (`incident_report_draft`), not mentioned for stages 2 and 3.
- **Regulatory refs:** CRA Art. 14 never cited despite this being the ENISA reporting guide.
- **Element gaps:** 6 form fields listed without full input documentation.
- **Audience tags:** "Sales" is wrong.
- **Actions:** Fix em dashes. Add Art. 14 citations throughout. Add prompt key for all 3 stages. Document form fields fully. Fix audience tags.

#### ch5_02_ip_proof.html
- **Status:** Clean editorial. Good automation-first (auto-trigger from SBOM syncs).
- **Regulatory refs:** No CRA Article reference. eIDAS mentioned but not formally cited.
- **Element gaps:** Snapshot list, hash display, verification status not documented as information elements.
- **Actions:** Add Art. 13 and Annex I refs. State Copilot is N/A. Add reversibility (snapshots are permanent). Add "Legal" to audience tags.

#### ch5_03_escrow.html
- **Em dash:** Station "deposit" title. Fix.
- **Element gaps:** Artefact checkboxes and release model radio buttons lack decision criteria and common mistakes. Toggle reversibility absent.
- **Regulatory refs:** CRA does not directly mandate escrow. Note as voluntary best practice supporting Art. 13(8).
- **Actions:** Fix em dash. Add decision criteria for release model. Document toggle reversibility. Clarify regulatory status.

#### ch5_04_billing_lifecycle.html
- **Em dashes:** 3 instances in station titles. Fix.
- **Editorial:** Grammar issue in grace-trial station ("No data is lost or features are restricted").
- **Element gaps:** Payment methods, cancellation/downgrade reversibility, notification schedule not documented.
- **Actions:** Fix em dashes. Fix grammar. Add "Admin" to audience tags. Reference CRA 10-year retention in cancelled station.

### Chapter 6: Post-Market Monitoring

#### ch6_01_field_issue_lifecycle.html
- **Regulatory refs:** Partial. Art. 13(6) and Art. 13(9) cited but not in full first-mention format.
- **Element gaps:** 5 form fields (title, severity, source, affected versions, reporter contact) listed without full input documentation. Severity decision criteria absent. Status transition reversibility absent.
- **Copilot:** No Copilot mentioned. Could `incident_report_draft` assist? Document availability or absence.
- **Actions:** Add full citation format. Document form fields per input standard. Add severity decision criteria. Add reversibility.

#### ch6_02_corrective_action.html
- **Element gaps:** Creation form fields not listed at all. Status transition reversibility absent.
- **Copilot:** Not mentioned. Could Copilot suggest corrective action text? Document.
- **Actions:** Document form fields. Add reversibility. Clarify Copilot availability. Add separation of duties guidance (implementer vs verifier).

#### ch6_03_security_release.html
- **Em dash:** Station "classify" title. Fix.
- **Copilot:** Auto-triage relevant at triage step but not mentioned. Prompt key: `vulnerability_triage`.
- **Regulatory refs:** Art. 13(9) cited in subtitle only, not in individual stations.
- **Actions:** Fix em dash. Add prompt key at triage step. Cite Art. 13(9) in relevant stations.

#### ch6_04_crypto_pqc.html
- **Em dash:** Station "broken" subtitle. Fix.
- **Regulatory refs:** Art. 13(2) cited. CRA Annex I Part I Section 2 (cryptographic requirements) should be primary reference but missing.
- **Copilot:** Annex I risk assessment mentioned as AI-generated but no prompt key.
- **Actions:** Fix em dash. Add Annex I Part I Section 2 ref. Add prompt key for risk assessment.

### Chapter 7: Administration

#### ch7_01_api_keys.html
- **Regulatory refs:** Zero. API access supports Art. 13 automated compliance. Not mentioned.
- **Element gaps:** Key list information element not documented. Create action lacks reversibility. Revoke action lacks its own station.
- **Actions:** Add regulatory context. Document key list. Add reversibility. State Copilot is N/A. Fix footer count (1 of 5 should be 1 of 10).

#### ch7_02_cicd_gate.html
- **Em dashes:** 2 instances in station titles ("Gate passes" and "Gate fails"). Fix.
- **Copilot:** Mentions Auto-Triage without prompt key, trigger mechanism, or cost.
- **Regulatory refs:** Zero. CI/CD gate supports Art. 13(6) and Art. 13(2). Not mentioned.
- **Actions:** Fix em dashes. Add prompt key. Add regulatory refs. Fix footer count.

#### ch7_03_mcp_ide.html
- **Regulatory refs:** Zero. MCP tools support Art. 13(6) and Art. 13(2).
- **Element gaps:** 5 MCP tools listed but output meanings and data sources not documented.
- **Actions:** Add regulatory refs. Document tool outputs. Add cost implications for verify_fix. Fix footer count.

#### ch7_04_user_roles.html
- **Regulatory refs:** Zero. Role management supports Art. 13(1).
- **Element gaps:** Email input for invitations, role assignment consequences, user removal consequences not documented.
- **Actions:** Add regulatory refs. Document billing impact of adding users. Add reversibility for user removal. Fix footer count.

#### ch7_05_oscal_bridge.html
- **Status:** Good action documentation for document type selection.
- **Regulatory refs:** Indirect only. No explicit citation for why OSCAL matters.
- **CRITICAL BUG:** Next button is disabled (line 143), severing navigation to ch7_06-ch7_10.
- **Actions:** Fix Next button navigation. Add "Compliance officer" to tags. Explain why OSCAL format. Fix footer count.

---

## Cross-Cutting Remediation Plan

### Phase 1: Structural fixes (all 48 files)
1. Fix all em dashes (at least 15 files, ~20+ instances)
2. Fix footer diagram counts to reflect actual chapter sizes
3. Fix navigation links (ch7_05 Next button, any skip gaps)
4. Fix emoji escape bugs in stub files
5. Extract duplicated CSS to shared stylesheet
6. Standardise audience tags to the five standard roles

### Phase 2: Write the 18 stub guides
Priority order as listed above. ch4_06 (AI Copilot reference) first, ch7_09 (Trust Centre, feature not built) last or removed.

### Phase 3: Add Copilot prompt specification to all relevant guides
For every file that mentions an AI feature, add:
- Prompt key reference
- How to trigger, review, and approve
- Cost per invocation (estimated tokens, model tier)
- Lifecycle frequency class
- Lifecycle phase mapping
- Rate limit information
- Link to admin Copilot settings

Applicable prompt keys across all guides:
| Prompt Key | Relevant Guides |
|------------|-----------------|
| `suggest` | ch4_01, ch4_02, ch4_05 |
| `section:*` (8 keys) | ch4_01, ch4_05, ch1_04 |
| `obligation:*` (19 keys) | ch4_02 |
| `vulnerability_triage` | ch2_02, ch3_01, ch3_02, ch3_04, ch6_03, ch7_02 |
| `risk_assessment` | ch4_07, ch6_04 |
| `incident_report_draft` | ch3_03, ch5_01, ch6_05 |
| `category_recommendation` | ch1_05, ch4_03 |

### Phase 4: Add regulatory traceability to all guides
Every guide should cite the specific CRA/NIS2 Article or Annex that drives the feature it documents. Full citation on first mention, short form thereafter.

### Phase 5: Enrich element documentation
For the 30 real-content files, apply the element taxonomy framework:
- Input elements: what to enter, why, Copilot availability, good answer, common mistakes
- Action elements: what it does, regulatory consequence, reversibility, decision criteria
- Information elements: what it means, why it's there, what to do, data source

### Phase 6: Add role-aware content
Add role tags or role-specific callouts to guide sections. Minimum viable approach: add a "Who needs this" note per station identifying which of the five roles should pay attention.

---

## Metrics

| Category | Count |
|----------|-------|
| Total files | 48 |
| Stub files needing complete rewrite | 18 |
| Files with em dash violations | ~15 |
| Files with broken navigation | 1 (ch7_05) + skip gaps |
| Files with wrong footer counts | ~15 |
| Files citing any CRA Article | ~8 of 30 real files |
| Files with Copilot prompt key refs | 0 |
| Files with cost profiles | 0 |
| Files with role-specific content | ~2 (partial) |
