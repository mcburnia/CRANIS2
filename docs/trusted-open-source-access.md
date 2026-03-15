# #58 — Trusted Open Source and Non-Profit Access Model

**Status:** Proposed backlog item
**Priority:** High

---

## Objective

Allow open-source projects, community projects, and verified non-profit organisations to use CRANIS2 without contributor charges while preventing commercial abuse of the free tier.

The system must automatically classify organisations using repository metadata and behavioural signals, while allowing manual verification where appropriate.

The system must also implement a Progressive Trust Model so that open-source eligibility is earned through observed behaviour rather than granted permanently at repository connection.

---

## 1. Feature Overview

CRANIS2 must introduce a Trust Classification System that determines whether an organisation qualifies for free access.

The classification must support the following categories:

| Classification | Description |
|---|---|
| Commercial | Standard paying organisation |
| Provisional Open Source | Newly connected public open-source repository |
| Trusted Open Source | Open-source project confirmed through behavioural signals |
| Community Project | Small public project with limited contributors |
| Verified Non-Profit | Approved non-profit organisation |
| Review Required | Potential abuse or uncertain classification |

Classification determines billing behaviour.

---

## 2. High-Level Behaviour

When an organisation connects repositories, CRANIS2 must automatically evaluate eligibility for free usage.

Evaluation must occur during the following events:

- Repository connection
- Scheduled periodic review
- Repository metadata updates
- Manual admin review

The classification result must be stored with the organisation record.

---

## 3. Progressive Trust Model

CRANIS2 must not grant permanent free access immediately. Instead, organisations must progress through trust stages.

### Stage 1 — Provisional Open Source

A repository initially qualifies as Provisional Open Source if the following conditions are met:

| Condition | Requirement |
|---|---|
| Repository visibility | Public |
| Licence | OSI-approved licence detected |
| Private repositories | None attached to organisation |
| Source provider | Supported repository provider |

**Eligibility rule:**
`public_repository = true AND licence IN osi_approved_licences AND private_repository_count = 0`

This classification grants temporary free access.

**Duration of provisional stage:** 30 to 60 days.

**Purpose:** Observe repository behaviour before granting permanent trusted status.

### Stage 2 — Behavioural Trust Evaluation

During the provisional period, CRANIS2 must calculate a Trust Score based on repository activity signals.

**Signals:**

| Signal | Description |
|---|---|
| Contributor count | Number of contributors |
| Fork count | Repository forks |
| Star count | Repository stars |
| Issue activity | Presence of public issue tracker |
| Pull requests | Public pull request activity |
| Release history | Presence of tagged releases |
| Commit activity | Recent commits |

**Example scoring model:**

| Signal | Points |
|---|---|
| 2+ contributors | 10 |
| 5+ contributors | 20 |
| 10+ forks | 10 |
| 20+ stars | 10 |
| At least one release | 5 |
| Recent commits | 5 |

If the trust score exceeds a configurable threshold, the organisation becomes Trusted Open Source.

### Stage 3 — Trusted Open Source

When behavioural signals confirm legitimate open-source activity, the classification becomes Trusted Open Source.

**Feature access:**

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

## 4. Commercial Signal Detection

CRANIS2 must detect indicators that a repository is part of a commercial product.

**Signals:**

| Signal | Description |
|---|---|
| Corporate email domains | Contributors using corporate domains |
| Private repository mirrors | Public repo linked to private repos |
| Commercial organisation metadata | Organisation description indicates company |
| CI/CD deployment pipelines | Pipelines referencing production deployment |
| Proprietary licence detection | Non-OSI licence |
| Commercial website links | Organisation linked to product website |

If commercial signals exceed a defined threshold, the organisation must be classified as Review Required.

Admin review must determine whether the organisation should convert to a commercial plan.

---

## 5. Non-Profit Organisation Eligibility

CRANIS2 must support a Verified Non-Profit classification.

### Application Workflow

The organisation must submit the following information:

| Requirement | Description |
|---|---|
| Organisation name | Registered name |
| Country | Registration country |
| Registration number | Charity or non-profit number |
| Proof document | Uploaded verification document |
| Organisation website | Optional |

Submission triggers admin review.

**Admin actions:**

- Approve
- Reject
- Request additional information

Approved organisations receive the Verified Non-Profit classification.

---

## 6. Abuse Protection

Free access must be revoked automatically when specific triggers occur:

| Trigger | Behaviour |
|---|---|
| Private repository added | Convert organisation to commercial |
| Commercial signals exceed threshold | Flag for admin review |
| Repeated trust violations | Remove free eligibility |

When a private repository is added, the organisation plan must convert to the commercial tier. The organisation must be notified.

---

## 7. Trust Classification Data Model

Add the following fields to the organisation record:

| Field | Type | Description |
|---|---|---|
| trust_classification | enum | Classification type |
| trust_score | integer | Behavioural score |
| commercial_signal_score | integer | Risk score |
| classification_last_review | timestamp | Last evaluation |
| classification_source | enum | Automatic or manual |

**Enum values for trust_classification:**

- `commercial`
- `provisional_open_source`
- `trusted_open_source`
- `community_project`
- `verified_nonprofit`
- `review_required`

---

## 8. Admin Dashboard Requirements

Add a Trust Classification Panel to the admin dashboard.

**Display fields:**

| Field | Description |
|---|---|
| Organisation name | Organisation identifier |
| Classification | Current classification |
| Trust score | Behavioural score |
| Commercial signal score | Risk score |
| Contributor count | Repository contributor count |
| Repository count | Connected repositories |
| Licence types | Detected licences |
| Review status | Manual review status |

**Admin actions:**

- Approve open source
- Approve non-profit
- Reclassify organisation
- Suspend free access
- Trigger re-evaluation

---

## 9. Background Evaluation Jobs

Periodic evaluation must be implemented:

| Task | Frequency |
|---|---|
| Trust score recomputation | Weekly |
| Commercial signal detection | Weekly |
| Classification audit | Monthly |

These checks ensure classifications remain accurate.

---

## 10. Badge Feature (Optional)

Trusted open-source projects may optionally display a badge:

> **CRA Compliance** — powered by CRANIS2

The badge links back to CRANIS2.

**Purpose:**

- Ecosystem goodwill
- Organic marketing
- Developer adoption

---

## 11. Security Considerations

The system must ensure the following:

- No private repository metadata is exposed
- Commercial signal detection does not store sensitive data
- Uploaded verification documents are securely stored
- Admin actions are fully logged

All classification changes must generate audit log entries.

---

## 12. Acceptance Criteria

The feature is complete when the following conditions are met:

- Organisations connecting public OSI-licensed repositories are automatically evaluated
- Provisional open-source stage is created on first connection
- Behavioural scoring promotes projects to trusted open source
- Commercial signals trigger review
- Non-profit verification workflow functions
- Admin dashboard allows classification management
- Free tier automatically converts to paid when private repositories are added
- Audit logging captures classification decisions

---

## 13. Implementation Priority

Priority level is **High**.

This feature directly affects:

- Pricing integrity
- Developer goodwill
- Abuse prevention
- Ecosystem adoption
