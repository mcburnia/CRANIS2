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

P3 — AI Automation (Pro plan) — DONE
#	Feature	Effort	Status
13	AI Copilot	High	DONE
15	Auto-triage vulns	High	DONE
27	Copilot usage dashboard	Medium	DONE
16	Risk assessment generator	Medium	DONE
17	Incident report drafter	Medium	DONE
18	CRA category recommender	Low	DONE
19	Supplier due diligence questionnaire	Medium	DONE
20	Compliance gap narrator	Low	DONE

P4 — Public API & External Integrations
#	Feature	Effort	Status	Notes
28	Public API with API key auth	High	DONE	Prerequisite for #22, #14, #21
22	CI/CD compliance gate	Medium	PARKED_HIGH_PRIORITY	Depends on #28
14	MCP API server	High	TODO	Depends on #28
21	IDE compliance assistant	Medium	TODO	Depends on #28
23	GRC/audit tool bridge	Medium	PARKED
24	Chat ops integration	Low	PARKED
25	Slack notifications	Medium	PARKED
26	Trello task creation	Medium	DONE

P5 - Bugs
#	Description | Status
27  All Organisations -> Actions button does nothing DONE
28  ENISA Reporting -> Cancel button does nothing DONE
29  Products & Compliance -> CRANIS2 -> Not Stated? PENDING

---

## Current Status & Next Steps

**P0–P2:** ALL COMPLETE (42/42 features done)
**P3:** 7/8 DONE — Remaining: #20 compliance gap narrator
**P4:** 0/7 TODO (MCP Interface — external integrations)
**P5:** 2/3 DONE — PENDING: #29 Products & Compliance "Not Stated?" issue

**Immediate next:** #28 Public API with API key auth (unlocks CI/CD gate, MCP server, IDE assistant).
