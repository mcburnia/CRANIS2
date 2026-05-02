<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Loman Cavendish Limited — Capabilities Definition

## What We Do

Loman Cavendish builds production-grade software products. End-to-end — from concept through architecture, implementation, testing, deployment, and ongoing operation.

We combine 25+ years of enterprise architecture experience with AI-augmented development to deliver what traditionally requires a team of six to eight engineers. The result: faster delivery, lower cost, and architectural coherence that committee-designed software never achieves.

---

## How We Work

A single senior architect leads every engagement, supported by AI-augmented development tooling that handles implementation at scale. This isn't outsourced offshore code or a junior team managed remotely. It's one experienced architect who understands your domain, your constraints, and your regulation — building your product directly.

**What this means for clients:**
- One point of accountability — no handoffs, no communication overhead
- Architectural decisions made by someone who has governed billion-pound integration programmes
- Production-quality output from day one — not a prototype that needs rebuilding
- Deep testing discipline (thousands of automated tests, not manual QA)
- Security and compliance built in, not bolted on afterwards

---

## Core Capabilities

### 1. Full-Stack Product Development

We build complete web-based software products — SaaS platforms, internal tools, customer-facing applications — ready for production use.

**Technology stack:**
- **Frontend:** React, TypeScript, responsive design
- **Backend:** Node.js, TypeScript, RESTful APIs, public API design
- **Databases:** PostgreSQL (relational), Neo4j (graph), dual-database architectures
- **Infrastructure:** Docker, NGINX, automated deployment, CI/CD pipelines
- **Payments:** Stripe integration (subscriptions, tiered billing, usage-based pricing)
- **Email:** Transactional email (Resend), template management
- **Authentication:** OAuth (GitHub, GitLab, Bitbucket), JWT, invite flows, role-based access

**What we deliver:**
- Fully tested applications (unit, integration, end-to-end)
- API documentation and public API access
- Automated test suites with nightly regression runs
- Docker-based deployment ready for any hosting environment
- Comprehensive documentation (user guides, admin guides, API docs)

### 2. AI & LLM Integration

We build AI-augmented features into products — not toy demos, but production-ready AI capabilities with cost controls, rate limiting, and governance.

**Capabilities:**
- LLM-powered copilot features (contextual suggestions, document drafting, intelligent triage)
- Prompt management systems (admin-editable, versioned, cached)
- Token budget enforcement and per-organisation usage limits
- Response caching (SHA-256 context hashing, TTL-based)
- Multi-capability AI architectures (different prompts/models per feature)
- Cost protection layers (rate limiting, budget caps, cache-first strategies)

**Our principle:** AI is used only where it adds value that cannot be achieved deterministically. We don't use AI for the sake of it.

### 3. Regulatory Compliance Engineering

We don't just advise on regulation — we encode it into working software. This is our sharpest differentiator.

**Regulations we've implemented in production software:**
- **EU Cyber Resilience Act (CRA)** — obligation engines, conformity assessments, SBOM management, vulnerability tracking, end-of-life calculations, market surveillance workflows
- **NIS2 Directive** — supply chain risk assessment
- **GDPR** — data subject rights, privacy policies, retention management, data export/deletion
- **AI Act** — risk classification frameworks
- **DORA** — operational resilience mapping

**What this means for clients:**
- If your product operates in a regulated industry, compliance is part of the architecture from day one
- Obligation tracking, audit trails, and evidence generation built into the product
- Not a compliance layer added later — structural compliance

### 4. Data Architecture & Governance

**Capabilities:**
- Enterprise data platform design (cloud and on-premise)
- DCAM v3-aligned data governance frameworks
- Metadata management and data lineage
- Data quality management and controls
- Graph-based data modelling (Neo4j) for complex relationship domains
- API and integration architecture (20+ years of enterprise integration experience)
- Design authority governance

**Industry experience:** Banking, insurance, energy, pharmaceuticals, travel, logistics, healthcare, transport infrastructure.

### 5. Security Engineering

We build secure products by default, not as an afterthought.

**Implemented in production:**
- Post-quantum cryptography (Ed25519 + ML-DSA-65 hybrid signing)
- HKDF key derivation with domain separation
- Versioned encryption with graceful migration
- JWT algorithm pinning (preventing alg:none attacks)
- Rate limiting (authentication, API, AI features)
- CORS hardening
- Database port binding (localhost only)
- Credential rotation tooling
- Automated security patching pipelines
- Defence-in-depth test isolation

---

## Proof of Capability

### Product: CRA Compliance Platform (CRANIS2)

Built entirely by Loman Cavendish. A full SaaS platform helping software organisations achieve EU Cyber Resilience Act compliance.

**Scale:**
- ~50,000+ lines of production code
- 2,135+ backend tests across 114 test files
- 280+ end-to-end tests
- 98.5% route test coverage
- 66 API routes, 71 services
- 35 CRA obligations encoded with role-based filtering

**Features delivered:**
- Product and dependency tracking with SBOM import/export
- Vulnerability management with AI-powered triage
- Obligation engine with derived and manual compliance statuses
- AI copilot (5 capabilities: suggestions, vulnerability triage, risk assessment, incident drafting, category recommendation)
- Admin-editable prompt management with 32 seeded prompts
- Public REST API with key management
- Stripe billing (two tiers, contributor-based and product-based pricing)
- 10-year compliance vault with cryptographic integrity verification
- Conformity assessment workflows (CRA and NIS2)
- Comprehensive help guide system (48 interactive guides)
- Software Evidence Engine for R&D tax credit documentation
- Post-quantum cryptographic signing of compliance packages
- Nightly automated test runs with Trello notifications
- Full backup/restore and upgrade/rollback tooling

**Timeline:** Concept to launch-ready in approximately 6 months of part-time development.

### Previous Delivery (Anonymised)

| Project | What Was Delivered | Outcome |
|---|---|---|
| Smart-grid energy platform | AI/ML-driven predictive modelling, asset integration across community energy networks | ~75% reduction in grid-energy demand |
| Travel industry integration | Consolidated 5 airline systems and hotel platforms into unified environment | €1 billion increase in company asset value |
| Logistics merger | Oracle AIA-based integration for major logistics merger | Legal and operational compliance achieved |
| Transport infrastructure | Unidirectional data-diode telemetry integration for critical national infrastructure | Safe operational visibility without control system risk |
| Pharmaceutical R&D | FDA 21 CFR Part 11-compliant integration for AI/ML drug discovery | Regulatory-compliant research platform |

---

## Engagement Models

### Build a Product
We take your concept and deliver a production-ready software product. Fixed scope, iterative delivery, full ownership transfer.

**Typical engagement:** 3–6 months. Includes architecture, implementation, testing, deployment, documentation.

### Extend a Product
You have an existing product that needs new capabilities — AI features, compliance modules, API layers, billing systems. We integrate into your codebase and deliver.

### Architecture & Technical Due Diligence
Independent architecture review, technology assessment, or technical due diligence for investment decisions.

### Retained Product Development
Ongoing product development on a retained basis — new features, maintenance, security updates. Predictable monthly cost.

---

## Industries Served

- Financial services (banking, insurance)
- Energy and utilities
- Pharmaceuticals and life sciences
- Travel and aviation
- Logistics and supply chain
- Healthcare
- Transport infrastructure
- Software and technology companies

---

## Contact

**Loman Cavendish Limited**
[Contact details to be confirmed]

---

*This document defines the capabilities of Loman Cavendish Limited for use in website development and marketing materials.*
