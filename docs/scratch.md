P0 — Must-have before launch — ALL DONE
#	Feature	Status
1	Email alerts	DONE
2	Notification bell	DONE
3	Compliance scorecard	DONE
4	CVD policy generator	DONE
5	Pre-prod cleanup	DONE

P1 — Important for credibility — ALL DONE
#	Feature	Status
6	Standalone report exports	DONE
7	In-field tooltips	DONE
8	Smart deadline alerts	DONE
9	End-of-support tracking	DONE

P2 — Polish for production — ALL DONE
#	Feature	Status
10	Product activity log	DONE
11	Compliance heat map	DONE
12	Webhook E2E tests	DONE

P3 — AI Automation (Pro plan) — IN PROGRESS
#	Feature	Effort	Status
13	AI Copilot	High	DONE
15	Auto-triage vulns	High	DONE
27	Copilot usage dashboard	Medium	DONE
16	Risk assessment generator	Medium	DONE
17	Incident report drafter	Medium	DONE
18	CRA category recommender	Low	IN PROGRESS (Phases 1-3 DONE)
19	Supplier due diligence questionnaire	Medium	TODO
20	Compliance gap narrator	Low	TODO

P4 — MCP Interface (external integration)
#	Feature	Effort	Status
14	MCP API server	High	TODO
21	IDE compliance assistant	Medium	TODO
22	CI/CD compliance gate	Medium	TODO
23	GRC/audit tool bridge	Medium	TODO
24	Chat ops integration	Low	TODO
25	Slack notifications	Medium	TODO
26	Trello task creation	Medium	TODO

P5 - Buggs
#	Description | Status
27  All Organisations -> Actions button does nothing DONE
28  ENISA Reporting -> Cancel button does nothing DONE
29  Products & Compliance -> CRANIS2 -> Not Stated? PENDING

---

## Session 24 Progress — P3 #18 CRA Category Recommender

**Today's Work (3 commits, ~12 hours):**

✅ **Phase 1: Database Schema** (commit 0107308)
- 6 new tables: category_rule_attributes, category_rule_attribute_values,
  category_thresholds, category_recommendations, category_rule_changes,
  recommendation_access_log
- Seed data: 4 core risk attributes, 4 scoring options each, 4 CRA thresholds
- All locked to regulatory baseline for ISO 42001 compliance

✅ **Phase 2: Backend Services** (commit dc68da0)
- CategoryRecommendationService: Deterministic scoring, storage, history
- CategoryAIAugmentationService: Claude API integration for probabilistic assessment
- CategoryRuleValidator: Admin rule modifications with AI regulatory alignment check
- Full TypeScript types with structured audit logging

✅ **Phase 3: Backend Routes** (commit 17e32c7)  
- User endpoints: Get recommendation, view history, accept/override/dismiss
- Admin endpoints: View/edit rules, audit trail
- All with organisation scoping, auth guards, error handling

**Architecture:**
- **Deterministic:** 4 risk attributes (distribution, data sensitivity, connectivity,
  criticality) scored 0.0–1.0, normalised to 0–1, mapped to CRA class
- **Probabilistic:** Claude assesses product description vs deterministic score,
  suggests ±0.0–0.2 adjustment
- **Governance:** All admin rule changes assessed for regulatory alignment;
  misaligned changes require explicit override confirmation
- **Audit Trail:** Full transparency — every recommendation, access, and rule change logged

**Remaining:**
- Phase 4: Frontend UI (product detail modal, admin rules editor)
- Phase 5: Comprehensive tests (unit + integration + E2E)

---

## Current Status & Next Steps

**P0–P2:** ✅ ALL COMPLETE (42/42 features done)
**P3:** 5/8 DONE — Remaining: CRA category recommender, Supplier due diligence questionnaire, Compliance gap narrator
**P4:** 0/7 DONE (MCP Interface — external integrations, low priority for MVP)
**P5:** 2/3 DONE — PENDING: Products & Compliance "Not Stated?" issue

**Phase 3: Compliance Framework (NEW)** — Not yet in priority list, but critical for CRA compliance:
1. Obligations auto-intelligence (CRITICAL) — Auto-advance obligation statuses based on platform data
2. Expand obligations list — Add 8 new CRA articles (auto-trackable and policy declaration)
3. EU Declaration of Conformity generator — Generate legal DoC documents
4. Technical file auto-population — Pre-fill sections with platform data
5. Getting-started compliance checklist — Per-product CRA readiness checklist
6. CVD policy template generator — Generate Coordinated Vulnerability Disclosure policies
7. End-of-support tracking — Add support window fields for Art. 13(6)
8. Webhook integration E2E test — Verify webhook registration end-to-end

**Immediate next:** Choose between finishing P3 remaining items OR starting Phase 3 compliance framework.
