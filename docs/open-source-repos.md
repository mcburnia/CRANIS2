<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 Feature Specification
## Trusted Open Source and Non-Profit Access Model

## Document Status
Proposed backlog item

---

# Objective

Allow open source projects, community projects and verified non-profit organisations to use CRANIS2 without contributor charges while preventing commercial abuse of the free tier.

The system must automatically classify organisations using repository metadata and behavioural signals, while allowing manual verification where appropriate.

The system must also implement a **Progressive Trust Model** so that open source eligibility is earned through observed behaviour rather than granted permanently at repository connection.

---

# 1 Feature Overview

CRANIS2 must introduce a **Trust Classification System** that determines whether an organisation qualifies for free access.

The classification must support the following categories.

| Classification | Description |
|---|---|
| Commercial | Standard paying organisation |
| Provisional Open Source | Newly connected public open source repository |
| Trusted Open Source | Open source project confirmed through behavioural signals |
| Community Project | Small public project with limited contributors |
| Verified Non Profit | Approved non profit organisation |
| Review Required | Potential abuse or uncertain classification |

Classification determines billing behaviour.

---

# 2 High Level Behaviour

When an organisation connects repositories, CRANIS2 must automatically evaluate eligibility for free usage.

Evaluation must occur during the following events.

- repository connection
- scheduled periodic review
- repository metadata updates
- manual admin review

The classification result must be stored with the organisation record.

---

# 3 Progressive Trust Model

CRANIS2 must not grant permanent free access immediately.

Instead, organisations must progress through trust stages.

## Stage 1 Provisional Open Source

A repository initially qualifies as **Provisional Open Source** if the following conditions are met.

| Condition | Requirement |
|---|---|
| Repository visibility | Public |
| Licence | OSI approved licence detected |
| Private repositories | None attached to organisation |
| Source provider | Supported repository provider |

Eligibility rule.

public repository equals true  
AND licence in OSI approved licences  
AND private repository count equals zero

This classification grants temporary free access.

Duration of provisional stage.

30 to 60 days.

Purpose.

Observe repository behaviour before granting permanent trusted status.

---

## Stage 2 Behavioural Trust Evaluation

During the provisional period CRANIS2 must calculate a **Trust Score** based on repository activity signals.

Signals.

| Signal | Description |
|---|---|
| Contributor count | Number of contributors |
| Fork count | Repository forks |
| Star count | Repository stars |
| Issue activity | Presence of public issue tracker |
| Pull requests | Public pull request activity |
| Release history | Presence of tagged releases |
| Commit activity | Recent commits |

Example scoring model.

| Signal | Points |
|---|---|
| Two or more contributors | 10 |
| Five or more contributors | 20 |
| Ten or more forks | 10 |
| Twenty or more stars | 10 |
| At least one release | 5 |
| Recent commits | 5 |

If the trust score exceeds a configurable threshold the organisation becomes **Trusted Open Source**.

---

## Stage 3 Trusted Open Source

When behavioural signals confirm legitimate open source activity the classification becomes **Trusted Open Source**.

Benefits.

| Feature | Access |
|---|---|
| SBOM generation | Full |
| Vulnerability scanning | Full |
| Licence compliance | Full |
| Technical file features | Full |
| Compliance vault | Limited snapshot quota |
| AI features | Limited token allowance |
| Integrations | Limited |

Trusted Open Source classification remains active unless abuse signals are detected.

---

# 4 Commercial Signal Detection

CRANIS2 must detect indicators that a repository is part of a commercial product.

Signals.

| Signal | Description |
|---|---|
| Corporate email domains | Contributors using corporate domains |
| Private repository mirrors | Public repo linked to private repos |
| Commercial organisation metadata | Organisation description indicates company |
| CI CD deployment pipelines | Pipelines referencing production deployment |
| Proprietary licence detection | Non OSI licence |
| Commercial website links | Organisation linked to product website |

If commercial signals exceed a defined threshold the organisation must be classified as **Review Required**.

Admin review must determine whether the organisation should convert to a commercial plan.

---

# 5 Non Profit Organisation Eligibility

CRANIS2 must support a **Verified Non Profit** classification.

## Application Workflow

The organisation must submit the following information.

| Requirement | Description |
|---|---|
| Organisation name | Registered name |
| Country | Registration country |
| Registration number | Charity or non profit number |
| Proof document | Uploaded verification document |
| Organisation website | Optional |

Submission triggers admin review.

Admin actions.

- approve
- reject
- request additional information

Approved organisations receive the Verified Non Profit classification.

---

# 6 Abuse Protection

Free access must be revoked automatically when specific triggers occur.

| Trigger | Behaviour |
|---|---|
| Private repository added | Convert organisation to commercial |
| Commercial signals exceed threshold | Flag for admin review |
| Repeated trust violations | Remove free eligibility |

When a private repository is added the organisation plan must convert to the commercial tier.

The organisation must be notified.

---

# 7 Trust Classification Data Model

Add the following fields to the organisation record.

| Field | Type | Description |
|---|---|---|
| trust classification | enum | classification type |
| trust score | integer | behavioural score |
| commercial signal score | integer | risk score |
| classification last review | timestamp | last evaluation |
| classification source | enum | automatic or manual |

Enum values.

- commercial  
- provisional open source  
- trusted open source  
- community project  
- verified nonprofit  
- review required  

---

# 8 Admin Dashboard Requirements

Add a **Trust Classification Panel** to the Admin dashboard.

Display fields.

| Field | Description |
|---|---|
| Organisation name | organisation identifier |
| classification | current classification |
| trust score | behavioural score |
| commercial signal score | risk score |
| contributor count | repository contributor count |
| repository count | connected repositories |
| licence types | detected licences |
| review status | manual review status |

Admin actions.

- approve open source
- approve non profit
- reclassify organisation
- suspend free access
- trigger re evaluation

---

# 9 Background Evaluation Jobs

Periodic evaluation must be implemented.

| Task | Frequency |
|---|---|
| Trust score recomputation | Weekly |
| Commercial signal detection | Weekly |
| Classification audit | Monthly |

These checks ensure classifications remain accurate.

---

# 10 Badge Feature Optional

Trusted open source projects may optionally display a badge.

CRA Compliance powered by CRANIS2

The badge links back to CRANIS2.

Purpose.

- ecosystem goodwill
- organic marketing
- developer adoption

---

# 11 Security Considerations

The system must ensure the following.

- no private repository metadata is exposed
- commercial signal detection does not store sensitive data
- uploaded verification documents are securely stored
- admin actions are fully logged

All classification changes must generate audit log entries.

---

# 12 Acceptance Criteria

The feature is complete when the following conditions are met.

- organisations connecting public OSI licensed repositories are automatically evaluated
- provisional open source stage is created on first connection
- behavioural scoring promotes projects to trusted open source
- commercial signals trigger review
- non profit verification workflow functions
- admin dashboard allows classification management
- free tier automatically converts to paid when private repositories are added
- audit logging captures classification decisions

---

# 13 Implementation Priority

Priority level is **High**.

This feature directly affects.

- pricing integrity
- developer goodwill
- abuse prevention
- ecosystem adoption