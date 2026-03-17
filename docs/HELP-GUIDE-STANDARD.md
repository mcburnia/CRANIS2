# CRANIS2 Help Guide Standard

**Version:** 2.0
**Author:** Andi McBurnie
**Last updated:** 2026-03-17

This document defines the design principles, content standards, and Copilot integration requirements for all help guides, user documentation, FAQs, and contextual guidance within CRANIS2.

It is a living document. Update it as new patterns emerge, as user feedback arrives, and as the platform evolves.

---

## 1. Mission

CRANIS2 exists to remove the bureaucratic burden of EU cyber-regulation from the people who build software.

The help guide system serves this mission directly. Its purpose is not to teach users how to fill in forms. Its purpose is to help users understand what the platform has already done for them, what decisions only they can make, and why the regulation requires it.

Every guide, tooltip, and contextual explanation must be written with a single question in mind: *does this reduce the user's effort, or does it add to it?*

---

## 2. Guiding Principles

### 2.1 Automation first

The platform should do the work. The user should review and approve. Help content must reflect this. Where the Copilot can pre-fill, draft, or suggest, the guide should explain how to review the output, not how to author from scratch.

### 2.2 Human in the loop

The human always approves. No AI-generated content enters a compliance record without explicit user confirmation. Help content must make this clear and make the approval workflow obvious.

### 2.3 Regulation transparent

Users should understand *which* regulation drives each requirement and *why* it exists, without needing to read the legislation. Every element that exists because of a regulatory obligation should trace back to the specific Article or Annex that mandates it.

### 2.4 Role aware

A software engineer needs different guidance from a product manager or a compliance officer. Help content must be tailored to the user's role, surfacing what matters to them and suppressing what does not.

### 2.5 Minimal effort

Every word in the guide should reduce effort. If the user can complete a task without reading the guide, the guide is doing its job through good UI design. The guide exists for when the user needs to understand *why*, not *how to click*.

### 2.6 Minimal error

Help content must steer users away from mistakes. Where a choice has regulatory consequences, the guide must explain those consequences before the user commits.

---

## 3. Element Taxonomy

Every UI element that appears on a CRANIS2 screen falls into one of three categories. Help content must address each category differently.

### 3.1 Input Elements

These are fields, text areas, dropdowns, date pickers, and any element where the user provides data.

For each input element, the help guide must answer:

- **What does the user need to enter?** Plain-language description of the expected content, with an example where helpful.
- **Why is this field here?** Which regulation requires this data, and what happens if it is left empty or completed incorrectly.
- **Can the Copilot fill this?** If yes, explain how to trigger the Copilot suggestion, how to review it, and how to approve or edit it. If no, explain why human judgement is required.
- **What does a good answer look like?** Briefly describe the qualities of a strong response (specificity, evidence, length) without being prescriptive.
- **What are common mistakes?** Where users frequently get this wrong, flag it.

### 3.2 Action Elements

These are buttons, checkboxes, radio groups, toggles, and any element where the user triggers a state change or makes a selection.

For each action element, the help guide must answer:

- **What does this action do?** Describe the immediate effect in plain language.
- **What are the regulatory consequences?** If selecting an option changes the product's compliance posture (e.g. choosing a CRA category, confirming an obligation as met, triggering an ENISA notification), explain the downstream effects.
- **Is this reversible?** If the action cannot be undone, or if undoing it has consequences, say so explicitly.
- **What should the user choose?** Where appropriate, provide decision criteria without making the decision for them.

### 3.3 Information Elements

These are labels, status indicators, badges, contextual explainers, progress bars, scores, and any element that displays data without accepting input.

For each information element, the help guide must answer:

- **What does this mean?** Define the term, metric, or status in plain language.
- **Why is it here?** Which regulatory requirement or compliance workflow does it support.
- **What should the user do about it?** If the information implies an action (e.g. a red status, a missing field warning, a low score), explain what action to take.
- **Where does this data come from?** Whether it is calculated, imported, user-entered, or AI-generated, so the user knows how to correct it if wrong.

---

## 4. Copilot Prompt Specification

For every UI element where the Copilot can assist, the help guide system must define and manage a complete prompt specification. This ensures consistency, admin control, cost transparency, and quality assurance.

### 4.1 Prompt Definition

Each Copilot-assisted element must have a defined prompt that:

- Is specific to the element's context (not a generic "fill this in" instruction)
- References the relevant regulatory Article or Annex requirement
- Includes the data context available to the Copilot (product metadata, SBOM data, vulnerability findings, existing field values)
- Defines the expected output format and length
- Specifies guardrails (what the Copilot must not invent, assume, or omit)

### 4.2 Admin-Editable Storage

All prompts must be stored in the `copilot_prompts` database table with the following attributes:

- `prompt_key` — unique identifier linking to the specific element (e.g. `section:risk_assessment`, `obligation:art_13_6`)
- `system_prompt` — the full prompt text
- `model` — the Claude model to use
- `max_tokens` — output token limit
- `temperature` — generation temperature
- `enabled` — toggle to disable without deleting

Platform administrators must be able to view, edit, test, and version these prompts from the Admin UI at `/admin/copilot`.

### 4.3 Quality Testing

Before a prompt is deployed or modified, it must be testable. The admin interface should support:

- **Preview mode** — run the prompt against sample product data and review the output without writing it to the database
- **A/B comparison** — compare outputs from different prompt versions or model configurations
- **Quality checklist** — does the output meet the Copilot Quality Standard (Q1–Q7 from `copilot-quality-standard.md`)?

### 4.4 Cost Estimation

Each Copilot-assisted element must have a documented cost profile:

#### Per-invocation cost
- Estimated input tokens (context size)
- Estimated output tokens (response size)
- Model pricing tier
- Calculated cost per call

#### Lifecycle frequency
How often this Copilot operation is expected to run during the product's compliance lifecycle:

| Frequency Class | Description | Example |
|---|---|---|
| One-off | Runs once per product, typically during initial setup | Product description, CRA category recommendation |
| Per-release | Runs each time a new version is released | Risk assessment refresh, SBOM analysis |
| Per-dependency-change | Runs when the dependency graph changes | Vulnerability triage, licence compliance check |
| Per-incident | Runs when an incident or field issue is raised | Incident report draft, ENISA notification |
| Periodic | Runs on a schedule (weekly, monthly, quarterly) | Compliance gap analysis, obligation status review |
| On-demand | Runs when the user explicitly requests it | Technical file section draft, evidence note |

#### Projected cost
- Monthly cost per product (based on frequency and typical product activity)
- Annual cost per product
- Cost at scale (10, 50, 100 products)
- Comparison to manual effort (time saved vs. token spend)

This cost data informs platform pricing, token budget allocation, and the admin's ability to manage Copilot expenditure.

### 4.5 Lifecycle Mapping

For each Copilot-assisted element, document when in the product development cycle the operation is triggered:

- **Onboarding** — product registration, initial SBOM sync, category selection
- **Development** — dependency updates, vulnerability scanning, code changes
- **Pre-release** — technical file completion, risk assessment, conformity check
- **Post-release** — field issue tracking, incident reporting, surveillance
- **Ongoing** — obligation monitoring, annual reviews, end-of-support planning

This mapping ensures the help guide can tell the user not just *what* the Copilot does, but *when* it matters.

---

## 5. Audience Tracks

CRANIS2 documentation, help guides, and FAQs serve two primary audience tracks. Every guide must be tagged with its audience track to enable filtering and navigation.

### 5.1 Two-Track Model

| Track | Who | What they need |
|-------|-----|---------------|
| **Admin** | Organisation administrators, compliance officers, product managers | Obligations, technical files, ENISA reporting, billing, vulnerability management, conformity assessments, document templates, post-market monitoring |
| **Contributor** | Software engineers, test engineers, DevOps practitioners | Repository connection, SEE (evidence engine), session capture, CI/CD gate, MCP/IDE tools, API keys, dependency details, vulnerability findings |

Many guides are relevant to both tracks. Where a guide is primarily for one track, it must be tagged accordingly. Where it serves both, it should present the admin perspective first (obligations, compliance decisions) followed by the contributor perspective (what this means for development activity).

### 5.2 Chapter-to-Track Mapping

| Chapter | Track | Rationale |
|---------|-------|-----------|
| Ch 0: Foundations | Both | CRA primer and glossary are universal |
| Ch 1: Onboarding | Both | Account setup is universal; repo connection is contributor-focused |
| Ch 2: SBOM & Supply Chain | Both | Admin manages supply chain; contributor connects repos |
| Ch 3: Vulnerability Triage | Both | Admin triages findings; contributor fixes them |
| Ch 4: Technical Files & Obligations | Admin | Compliance documentation is admin-owned |
| Ch 5: Compliance Reporting | Admin | Reports, vault, and exports are admin functions |
| Ch 6: Post-Market Monitoring | Admin | Field issues and corrective actions are admin-managed |
| Ch 7: Administration & Integration | Split | ch7_01-ch7_03 are Contributor (API, CI/CD, MCP); ch7_04-ch7_10 are Admin |

### 5.3 Detailed Role Profiles

Within the two tracks, five specific roles exist:

**Admin track:**

- **Compliance Officer** — Needs regulatory traceability, evidence completeness, audit readiness, gap analysis. Tone: regulatory-precise, evidence-oriented.
- **Product Manager** — Needs overall product compliance status, pending decisions, deadlines, prioritisation. Tone: outcome-focused, decision-oriented.
- **Administration User** — Needs organisation setup, user management, billing, Copilot configuration, platform settings. Tone: operational, settings-oriented.

**Contributor track:**

- **Software Engineer** — Needs how their code and dependencies affect compliance, what SBOMs and vulnerability scans found, what they need to fix, how SEE analyses their commits. Tone: technical, direct.
- **Test Engineer** — Needs what tests satisfy which obligations, how to document test evidence, how test evolution is tracked by the SEE. Tone: procedural, evidence-focused.

### 5.4 Audience Tags in HTML

Every help guide HTML file must include audience tags in the header using the standard CSS classes:

```html
<span class="audience-tag audience-admin">Admin</span>
<span class="audience-tag audience-contributor">Contributor</span>
```

Guides relevant to both tracks include both tags. The help panel can use these tags for filtering.

### 5.5 Role-Aware Content Delivery

Where possible, help content should adapt to the user's track. This can be achieved through:

- **Track tags** on each guide, enabling the help panel to filter by audience
- **Track-specific section ordering** within guides that serve both tracks
- **Conditional depth** where the same guide offers a summary for one track and full detail for another

---

## 6. Content Rules

### 6.1 Editorial compliance

All help content must conform to the CRANIS2 Editorial Standard (`docs/EDITORIAL-STANDARD.md`). British English, no AI artefacts, professional tone, no filler.

### 6.2 Regulation references

- On first mention, cite the full reference: "CRA Article 13(6) — Vulnerability Handling"
- On subsequent mentions, use the short form: "Art. 13(6)"
- Never quote regulation text verbatim at length. Summarise what the regulation requires in plain language.
- Always explain *why* the regulation requires it, not just *what* it requires.

### 6.3 Copilot capability surfacing

When documenting an element that the Copilot can assist with:

- State clearly that Copilot assistance is available
- Explain how to trigger it (button location, keyboard shortcut, automatic behaviour)
- Explain how to review and approve the output
- Note that the user remains responsible for the final content
- Link to the relevant Copilot prompt key for admin reference

### 6.4 Depth calibration

- **Tooltips** (HelpTip component): One sentence. What this element is and why it matters.
- **Help panel guides**: Enough to complete the task and understand the regulatory context. Typically 200–500 words per station.
- **Full documentation**: Comprehensive reference material. No length limit, but every paragraph must earn its place.
- **FAQ entries**: Question, direct answer, optional "learn more" link. No preamble.

### 6.5 Linking and cross-referencing

- Link to related guides rather than duplicating content
- Link to the relevant regulation Article when explaining regulatory context
- Link to the admin Copilot settings when discussing prompt configuration

---

## 7. Quality Checklist

Before publishing or updating any help guide page, validate it against this checklist.

### Completeness
- [ ] Every input element on the screen is documented
- [ ] Every action element on the screen is documented
- [ ] Every information element on the screen is documented (where non-obvious)
- [ ] Regulatory traceability is provided for every element that exists because of a regulation

### Copilot Coverage
- [ ] Every Copilot-assisted element identifies the prompt key
- [ ] The review/approve workflow is explained
- [ ] Cost profile is documented (per-invocation and lifecycle frequency)
- [ ] The lifecycle phase is identified (onboarding, development, pre-release, post-release, ongoing)

### Role Appropriateness
- [ ] Content is tagged or structured for role-aware delivery
- [ ] Technical detail is available for engineers without overwhelming product managers
- [ ] Regulatory detail is available for compliance officers without overwhelming engineers

### Editorial Quality
- [ ] Conforms to `docs/EDITORIAL-STANDARD.md`
- [ ] British English throughout
- [ ] No AI artefacts (em dashes, triadic phrases, hedge words, mechanical cadence)
- [ ] Professional, direct, scannable

### Accuracy
- [ ] Regulatory references are correct and current
- [ ] UI element descriptions match the current implementation
- [ ] Copilot prompt keys match the `copilot_prompts` table
- [ ] Cost estimates are based on current model pricing

---

## 8. Maintenance

### 8.1 When to update

- When a new feature adds UI elements to an existing screen
- When Copilot capability is added to an element that was previously manual-only
- When a regulation is amended or a new regulation is adopted
- When user feedback identifies confusion or error in existing guides
- When Copilot prompts are modified (update the corresponding help guide to match)

### 8.2 Version alignment

Help guide content must stay aligned with the current state of the platform. Stale guides are worse than no guides, because they teach users to distrust the help system.

After each development session that changes UI elements, check whether the corresponding help guide needs updating. This should be part of the definition of done for any feature work.

### 8.3 Cost model refresh

Copilot cost estimates must be refreshed when:

- Model pricing changes
- A prompt is significantly rewritten (changing token consumption)
- Usage patterns differ materially from initial estimates
- New Copilot-assisted elements are added

---

## References

- Editorial Standard: `docs/EDITORIAL-STANDARD.md`
- Copilot Quality Standard: `docs/copilot-quality-standard.md`
- Copilot Prompt Inventory: `docs/prompts.md`
- Help pages: `frontend/public/help/`
- HelpPanel component: `frontend/src/components/HelpPanel.tsx`
- HelpPanelContext: `frontend/src/context/HelpPanelContext.tsx`
- Admin Copilot UI: `/admin/copilot`
