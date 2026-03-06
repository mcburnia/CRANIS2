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
18	CRA category recommender	Low	IN PROGRESS (Phases 1-4 DONE, Phase 5 tests remaining)
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

## P3 #18 CRA Category Recommender — Progress

✅ **Phase 1: Database Schema** (commit 0107308)
✅ **Phase 2: Backend Services** (commit dc68da0)
✅ **Phase 3: Backend Routes** (commit 17e32c7)
✅ **Phase 4: Frontend UI** (commits d6f7897, ad9d69c)
⬜ **Phase 5: Tests** (unit + integration + E2E)

**Architecture:**
- **Deterministic:** 4 risk attributes scored 0.0–1.0, normalised, mapped to CRA class
- **Probabilistic:** Claude API augmentation with ±0.0–0.2 adjustment
- **Governance:** Admin rule changes assessed for regulatory alignment
- **Audit Trail:** Every recommendation, access, and rule change logged

---

## Current Status & Next Steps

**P0–P2:** ✅ ALL COMPLETE (42/42 features done)
**P3:** 5/8 DONE — Remaining: #18 tests, #19 supplier due diligence, #20 compliance gap narrator
**P4:** 0/7 TODO (MCP Interface — external integrations)
**P5:** 2/3 DONE — PENDING: #29 Products & Compliance "Not Stated?" issue

**Immediate next:** Finish #18 Phase 5 (tests), then #19 or #20.
