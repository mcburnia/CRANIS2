# CRANIS2 Product Capability Specification: Software Evidence Engine (SEE)

**Version:** 1.0
**Author:** Andrew McBurnie
**System:** CRANIS2
**Last updated:** 2026-03-16
**Purpose:** Automated engineering evidence extraction and lifecycle provenance generation from software repositories and development artefacts.

---

## 1. Purpose

The Software Evidence Engine (SEE) provides automated extraction, analysis and structuring of engineering evidence from software development artefacts.

The module converts raw development data (Git repositories, CI/CD pipelines, test evolution, SBOMs and vulnerability records) into a structured evidence model.

The output enables organisations to demonstrate:

- secure development lifecycle practices
- regulatory compliance evidence
- software supply chain provenance
- engineering experimentation and technical uncertainty
- R&D tax claim support evidence
- audit-ready lifecycle documentation

The SEE module underpins multiple regulatory frameworks including:

- EU Cyber Resilience Act (CRA)
- NIS2 Directive
- EU AI Act
- DORA
- ISO 27001 / ISO 42001
- UK HMRC R&D Tax Relief
- French Credit d'Impot Recherche (CIR)
- German Forschungszulage
- Spanish I+D+i

---

## 2. Core Capability

The SEE module performs automated analysis of software development artefacts and constructs a machine-queryable **Software Evidence Graph** representing the lifecycle of a software system.

**Inputs:**

- Git repositories
- commit history
- branch structures
- CI/CD pipeline metadata
- test evolution history
- SBOM records
- vulnerability scans
- issue tracker references
- build artefacts

**Outputs:**

- structured evidence graph
- engineering activity metrics
- lifecycle provenance timeline
- regulatory evidence reports
- R&D experimentation reports
- developer attribution summaries

---

## 3. Software Evidence Graph Model

The system must construct a graph model representing relationships between development artefacts.

**Primary node types:**

- Developer
- Commit
- Branch
- File
- Module
- Component
- Dependency
- Build
- Release
- Deployment
- SBOM
- Vulnerability
- Test
- Experiment
- Architecture Change
- Risk Decision
- Compliance Control

**Example relationships:**

```
Developer -> authored -> Commit
Commit -> modifies -> File
File -> belongs_to -> Module
Module -> part_of -> Component
Component -> included_in -> Release
Release -> deployed_to -> System
SBOM -> describes -> Component
Vulnerability -> affects -> Component
Test -> validates -> Component
Experiment -> evaluates -> Architecture
```

The evidence graph enables queries such as:

- which developer introduced a dependency
- which commit introduced a vulnerability
- how a component evolved across releases
- what experiments preceded a design decision

---

## 4. Repository Analysis Engine

The system must analyse Git repositories and extract structured development signals.

### Commit activity metrics

- total commits
- commits per developer
- commits per module
- commit frequency over time
- average commit size
- commit burst detection

### Code evolution metrics

- lines added
- lines deleted
- rewrite ratio
- file churn
- module churn
- dependency churn

### Branch metrics

- feature branches
- experimental branches
- abandoned branches
- branch lifespan
- merge frequency

### Developer attribution metrics

- commits per developer
- modules owned
- contribution percentages
- engineering activity timeline

---

## 5. Engineering Experimentation Detection

The system must identify patterns consistent with experimental development.

**Indicators include:**

- repeated implementation attempts
- algorithm replacement
- multiple architectural approaches
- prototype directories
- experimental branches
- abandoned development paths
- dependency switching
- refactoring waves

**Derived metrics:**

**Rewrite Ratio:** `lines_deleted / lines_added`. High ratio indicates experimentation.

**Architecture Change Events:** detected when module structure changes, dependency graph changes, API structure changes, or database schema migrations occur.

---

## 6. Test Evolution Analysis

The system must track test lifecycle behaviour.

**Metrics include:**

- test creation events
- test modification events
- test failure/fix cycles
- edge case test additions
- regression test growth
- coverage expansion

These signals indicate technical uncertainty resolution.

---

## 7. Architecture Evolution Detection

The system must detect structural system changes.

**Indicators:**

- module restructuring
- dependency graph evolution
- architectural layer introduction
- service boundary changes
- database schema revisions
- interface redesign

**Output:** Architecture Evolution Timeline.

Example:

- Jan: initial architecture
- Feb: experimental SBOM engine
- Feb: abandoned parsing strategy
- Mar: redesigned graph model
- Mar: stabilised implementation

---

## 8. SBOM and Supply Chain Evidence

The system integrates with CRANIS2 SBOM capabilities.

**Evidence includes:**

- dependency introduction
- dependency updates
- vulnerability exposure history
- patch remediation timelines
- supply chain risk events

Relationships stored in evidence graph.

---

## 9. R&D Evidence Generation

The SEE module must support R&D tax claim evidence generation.

**Engineering Activity Summary:**

- total commits
- modules changed
- experimental branches
- architecture refactors
- test evolution events

**Technological Uncertainty Indicators:**

- algorithm iterations
- architecture redesign
- prototype experiments
- performance optimisation cycles

**Developer Attribution:**

- developer identities
- contribution percentages
- engineering activity timeline

The output must generate a narrative-style evidence report.

---

## 10. Regulatory Evidence Reports

The system must generate structured reports supporting regulatory compliance.

**Supported report types:**

- CRA Evidence Report
- NIS2 Secure Development Evidence
- AI Act Technical Documentation Support
- DORA ICT Change Evidence
- ISO 27001 Secure Development Controls
- R&D Tax Evidence Report

**Reports must include:**

- engineering evidence summary
- lifecycle timeline
- developer attribution
- supply chain traceability
- vulnerability handling history

---

## 11. Visualisation

The module must provide graphical representations.

**Required visualisations:**

- Commit activity timeline
- Module churn heatmap
- Dependency evolution graph
- Experiment lifecycle diagram
- Architecture change timeline
- Developer contribution chart

---

## 12. AI Assisted Analysis

CRANIS2 Copilot may be used to assist with interpretation of extracted signals.

**Examples:**

- summarising engineering experimentation
- generating R&D narrative explanations
- identifying unusual engineering patterns
- generating regulator-ready explanations

AI must not fabricate evidence. All narrative must reference actual repository signals.

---

## 13. Security and Data Integrity

All extracted evidence must be stored with cryptographic integrity protection.

**Recommended mechanisms:**

- hash of repository snapshot
- timestamped evidence records
- optional RFC 3161 timestamping
- immutable audit log

This ensures evidentiary credibility.

---

## 14. Storage Model

Data must be stored in two forms:

**Structured relational model:** Postgres tables storing metrics and artefacts.

**Graph representation:** Neo4j graph database storing evidence relationships.

---

## 15. API Interface

Expose APIs allowing:

- repository ingestion
- evidence graph queries
- evidence report generation
- metric retrieval
- visualisation data retrieval

---

## 16. Performance Requirements

The engine must support analysis of:

- **Small repositories:** fewer than 50k commits
- **Medium repositories:** fewer than 250k commits
- **Large repositories:** fewer than 1M commits

Processing must be incremental after initial scan.

---

## 17. User Workflow

Typical workflow:

1. Connect repository
2. Scan repository
3. Construct evidence graph
4. Compute engineering metrics
5. Generate evidence reports
6. Export compliance artefacts

---

## 18. Export Formats

Reports must be exportable as:

- Markdown
- PDF
- JSON
- Confluence-ready Markdown

---

## 19. Development Session Capture

The SEE module must support capture of conversations between development engineers and AI coding assistants (Claude Code, GitHub Copilot, Cursor, etc.) via the CRANIS2 MCP server.

### Purpose

- Capture evidence of human-directed engineering effort (R&D tax credit evidence)
- Preserve intellectual property created during AI-assisted development conversations
- Establish developer competence profiles from demonstrated expertise

### Consent Model

- Developer is prompted at the start of each session: "Would you like to record this development session for engineering evidence?"
- Opt-in per session. No recording without explicit consent.
- Developer can stop recording at any time during a session.
- Developer can review, redact, or delete recorded sessions.

### Capture Mechanism

- Claude Code hooks (`assistant_response` event) POST conversation turns to CRANIS2 API
- Each turn includes: timestamp, role (human/assistant), content, tool calls made
- Session metadata: developer identity, product context, duration, tools used

### Storage

- Raw conversation transcripts stored in Forgejo (EU-sovereign, git-backed, immutable)
- Structure: `org/{orgId}/evidence-sessions/{productId}/{date}-{sessionId}.md` (human-readable transcript) plus `.json` sidecar (structured metadata)
- CRANIS2 Postgres/Neo4j stores the index and analysis results, not the raw conversations
- This keeps large content in Forgejo and queryable metadata in the database

### Competence Evidence Profile

The system must analyse recorded conversations to produce a developer Competence Evidence Profile. This addresses the R&D tax credit requirement to demonstrate that work was conducted by "competent professionals" without relying solely on formal qualifications.

**Competence indicators detected from conversation analysis:**

- Domain vocabulary usage (regulatory, architectural, security terminology)
- Problem decomposition (structured approach to complex problems)
- Design trade-off reasoning (evaluating alternatives with justification)
- Industry standard awareness (CRA, OWASP, ISO, NIST references)
- Quality of technical direction given to AI (prompt sophistication)
- Rejection of AI suggestions with valid technical reasoning
- Architectural thinking (system design, scalability, security)
- Risk awareness (edge cases, failure modes, compliance implications)

**Output:**

- Technical domains demonstrated with depth rating
- Industry awareness indicators
- Decision-making quality metrics
- Equivalent professional experience level (inferred, with caveats)
- Suitable for inclusion in R&D tax credit documentation as competence evidence

### Privacy and Data Protection

- All conversation data stored in EU-sovereign infrastructure (Forgejo on Infomaniak, Switzerland)
- Developer controls their own data (view, export, redact, delete)
- Organisation admins can see session metadata but not raw conversations without developer consent
- No conversation data shared externally without explicit authorisation
- GDPR Article 6(1)(a) consent basis

---

## 20. Future Extensions

Future enhancements may include:

- build provenance attestation
- software risk scoring
- investment due diligence reports
- cross-organisation benchmarking
- regulatory readiness overlays

---

## 21. Success Criteria

The module is considered successful when it can:

- reconstruct engineering lifecycle evidence from repositories
- generate regulator-ready compliance reports
- support R&D tax evidence documentation
- provide traceable software provenance

The SEE module forms a foundational component of CRANIS2's mission to provide lifecycle compliance and software supply chain traceability.
