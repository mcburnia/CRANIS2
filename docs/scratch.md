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

P3 — AI Automation (Pro plan) — ALL DONE
#	Feature	Effort	Status
13	AI Copilot	High	DONE
15	Auto-triage vulns	High	DONE
27	Copilot usage dashboard	Medium	DONE
16	Risk assessment generator	Medium	DONE
17	Incident report drafter	Medium	DONE
18	CRA category recommender	Low	DONE
19	Supplier due diligence questionnaire	Medium	DONE
20	Compliance gap narrator	Low	DONE

P4 — Public API & External Integrations — 5/7 DONE
#	Feature	Effort	Status	Notes
28	Public API with API key auth	High	DONE	Prerequisite for #14, #21
22	CI/CD compliance gate	Medium	DONE	Gate script + CI examples
26	Trello task creation	Medium	DONE	4 event types, dedup, resolution
14	MCP API server	High	DONE	5 tools, 12+ mitigation commands, SBOM rescan verification
21	IDE compliance assistant	Medium	DONE	Setup wizard on Integrations page, 4 IDE tabs, auto-generated config
23	GRC/audit tool bridge	Medium	PARKED
24	Chat ops integration	Low	PARKED
25	Slack notifications	Medium	PARKED

P5 — Supplier Marketplace (viral growth loop) — NOT STARTED
#	Feature	Effort	Status
28	Supplier invitation flow	Medium	TODO
29	Supplier compliance profile	Medium	TODO
30	Auto-resolution of due diligence	Medium	TODO
31	Marketplace directory	Medium	TODO
32	Supplier analytics dashboard	Low	TODO
33	Supplier tier pricing	Low	TODO
34	Manufacturer trust signals	Low	TODO

Bugs
#	Description	Status
27	All Organisations -> Actions button does nothing	DONE
28	ENISA Reporting -> Cancel button does nothing	DONE
29	Products & Compliance -> CRANIS2 -> Not Stated?	DONE

P6 — Compliance Document Library — ALL DONE
#	Feature	Effort	Status
35	Template download page	Low	DONE
36	Auto-populated templates	Medium	DONE
37	Full template library (7 templates)	High	DONE

Cross-cutting (done)
-	Pro plan billing (Standard €6/contributor, Pro €9/product + €6/contributor)	DONE
-	Pro plan feature gating (API keys, CI/CD, marketplace behind Pro)	DONE
-	AI Copilot cost protection (token budget, rate limits, response cache)	DONE
-	Welcome page pricing overhaul (enhanced features, vertical cards, €9 price)	DONE
-	CRA Action Plan guided workflow (per-product visual pipeline)	DONE
-	Product lifecycle stage + lifecycle-aware readiness framing	DONE
-	Test infrastructure fix (reliable, repeatable, 37% faster)	DONE

---

## Current Status & Next Steps

**P0–P3:** ALL COMPLETE (50/50 features done)
**P4:** 5/7 DONE (#28 Public API, #22 CI/CD gate, #26 Trello, #14 MCP server, #21 IDE assistant) — #23/#24/#25 parked for post-launch
**P5:** 0/7 — Supplier marketplace not started (post-launch)
**P6:** ALL DONE (document template library)
**Bugs:** 3/3 ALL DONE

**Immediate next:**
- Fix flaky risk-findings status filter test (cross-file state pollution)
- Production deployment planning (Infomaniak hosting, cranis2.com)
- P5 — Supplier marketplace (post-launch)
