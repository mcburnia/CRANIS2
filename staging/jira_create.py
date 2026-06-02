#!/usr/bin/env python3
"""Create new CRAN issues (3 strategic epics + 1 billing story), then set
story points + effort. Closes the audit gap: gap-analysis NEW-1/2/3 (never
created) + the billing.ts:197 90-day-window TODO.
"""
import os, sys, json, base64, urllib.request, urllib.error

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SITE + path, data=data, method=method)
    r.add_header("Authorization", "Basic " + AUTH)
    r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

EPIC_LABELS = ["outstanding", "new-epic", "strategic-10x"]

NEW = [
 {"type":"Epic","points":21,"effort":"12d",
  "labels":EPIC_LABELS+["tier:1","area:trust","regulation:cross"],
  "summary":"Operator Supplier Dashboard — closes the two-sided-market loop",
  "desc":"""h2. Epic Goal
*As a* regulated operator (financial entity, NIS2 essential/important entity, healthcare provider, utility, telco, or large enterprise),
*I want* a free, read-only dashboard of every supplier in my software supply chain who publishes on CRANIS2,
*so that* my supply-chain compliance collapses from spreadsheets-and-chasing-PDFs into a single subscription.

h3. Regulatory Basis
Tier 1 — Group A (closes the operator loop). Discharges the operator's own NIS2 Art. 21(2)(d), DORA Art. 28, and GDPR Art. 28 supply-chain obligations as a side-effect. This is the *missing demand-side surface* that makes the procurement-leverage flywheel real.

h3. What CRANIS2 Should Add
A free, read-only product surface scoped to regulated operators, showing all their CRANIS2-publishing suppliers with: current obligation states (per supplier, per product); inbound active-incident feeds (Art. 14 / NIS2 / GDPR notifications from suppliers); sub-processor change diffs with subscription-based notifications; one-click DORA Art. 28 register-ready exports per ICT third-party; NIS2 Art. 21(2)(d) supplier-DD discharge; webhook delivery of changes; audit-logged read access.

h3. Acceptance Criteria
* *Given* a regulated operator, *when* they open the dashboard, *then* every CRANIS2-publishing supplier in their supply chain is shown with current obligation state.
* *Given* a supplier publishes a new Art. 14 / NIS2 / GDPR notification, *when* it lands, *then* it appears in the operator's incident feed (and via webhook if subscribed).
* *Given* a sub-processor change, *when* it occurs, *then* subscribed operators are notified with a diff.
* *Given* an ICT third-party, *when* the operator exports, *then* a DORA Art. 28 register-ready artefact is produced.
* *Given* all access, *when* used, *then* it is read-only and audit-logged.

h3. Open Decision
Surface mode: a mode of the existing app vs. a separate sub-app ({{operators.cranis2.com}}) vs. defer the call. Owner: TBD.

h3. Source
docs/CRA-GAP-ANALYSIS-2026-05-06.md — NEW-1 (proposed 2026-05-13; not previously created in Jira).
"""},
 {"type":"Epic","points":13,"effort":"8d",
  "labels":EPIC_LABELS+["tier:1","area:docs","regulation:pld"],
  "summary":"PLD recast 2024/2853 — software-product-liability evidence pack",
  "desc":"""h2. Epic Goal
*As a* software manufacturer,
*I want* a PLD-shaped \"defective-product defence\" evidence pack assembled from data CRANIS2 already holds,
*so that* I can meet the new direct product-liability obligation under Directive (EU) 2024/2853 (transposition deadline December 2026).

h3. Regulatory Basis
Tier 1. Directive (EU) 2024/2853 (PLD recast) explicitly classifies software as a \"product\" for defective-product liability. New, direct statutory obligation on every software developer; almost no incumbent addresses it. CRANIS2 already holds ~60-80% of the evidence a PLD defence requires.

h3. What CRANIS2 Should Add
A PLD-shaped export of existing evidence tied to a specific product version: vulnerability history with discovery and fix dates; SBOM history showing component decisions; security-update timeliness (CRA Art. 13(8)); and reasonable-safety-expectations evidence via the CRA conformity record. Plus a new tech-file section \"Reasonable safety expectations\" that ties into the CRA risk assessment.

h3. Acceptance Criteria
* *Given* a product version, *when* a PLD pack is generated, *then* it assembles vuln history (discovery+fix dates), SBOM history, security-update timeliness and reasonable-safety-expectations evidence.
* *Given* the tech file, *when* extended, *then* a \"Reasonable safety expectations\" section exists and reuses the CRA risk assessment.
* *Given* the pack, *when* exported, *then* it is tied to a specific product version.

h3. Source
docs/CRA-GAP-ANALYSIS-2026-05-06.md — NEW-2 (proposed 2026-05-13; not previously created in Jira).
"""},
 {"type":"Epic","points":8,"effort":"5d",
  "labels":EPIC_LABELS+["tier:1","area:trust","regulation:dora"],
  "summary":"DORA Art. 28 supplier-evidence pack — downstream-demand",
  "desc":"""h2. Epic Goal
*As a* CRANIS2 customer selling into financial services,
*I want* a DORA-shaped supplier-evidence export emitted from my CRANIS2 data,
*so that* my banking customers can populate their ICT third-party register in one click and I can answer their DORA questionnaires instantly.

h3. Regulatory Basis
Tier 1 — Group A (downstream-demand). DORA (Regulation (EU) 2022/2554) has required financial entities to maintain a structured ICT third-party register and perform due diligence on every ICT supplier since January 2025. CRANIS2 customers selling into financial services already receive DORA questionnaires today.

h3. What CRANIS2 Should Add
A DORA-shaped supplier-evidence export — the exact fields a financial entity needs to populate their ICT third-party register — emitted from the supplier's CRANIS2 data. Subscribable via the Operator Supplier Dashboard (NEW-1) so the operator gets a finished artefact rather than raw data.

h3. Acceptance Criteria
* *Given* a supplier's CRANIS2 data, *when* a DORA pack is exported, *then* it contains the ICT-third-party-register fields a financial entity requires.
* *Given* the Operator Supplier Dashboard, *when* an operator subscribes to a supplier, *then* the DORA pack is available to them.

h3. Source
docs/CRA-GAP-ANALYSIS-2026-05-06.md — NEW-3 (proposed 2026-05-13; not previously created in Jira). Complements NEW-1.
"""},
 {"type":"Story","points":3,"effort":"1d 4h","parent":"CRAN-47",
  "labels":["enhancement","area:billing"],
  "summary":"Active-contributor billing — 90-day commit-activity window",
  "desc":"""h3. User Story
*As a* paying customer,
*I want* contributor-based billing to count only contributors who committed in the last 90 days,
*so that* I am not charged for long-dormant contributors who no longer work on the product.

h3. Acceptance Criteria
* *Given* {{lastCommitAt}} is recorded on Neo4j {{Contributor}} nodes, *when* billing computes the active-contributor count, *then* only contributors with a commit in the trailing 90-day window are counted.
* *Given* a repo/SBOM sync, *when* it runs, *then* {{lastCommitAt}} is populated/refreshed on Contributor nodes (prerequisite).
* *Given* a contributor with no commit in 90 days, *when* billing runs, *then* they are excluded from the billable count.

h3. Notes
Captured from the existing code TODO at {{backend/src/services/billing.ts:197}} (\"When we have lastCommitAt on Contributor nodes, use 90-day window\"). The blocker is capturing {{lastCommitAt}} during repo sync; once present, the billing calculation switches to the windowed count.

h3. Source
Code TODO {{backend/src/services/billing.ts:197}}; surfaced in the 2026-06-01 backlog-completeness audit.
"""},
]

def settable(key):
    code, body = req("GET", f"/rest/api/3/issue/{key}/editmeta")
    return set(json.loads(body).get("fields", {}).keys()) if code == 200 else set()

created = []
for it in NEW:
    fields = {"project": {"key": "CRAN"}, "issuetype": {"name": it["type"]},
              "summary": it["summary"], "description": it["desc"]}
    if it.get("labels"): fields["labels"] = it["labels"]
    if it.get("parent"): fields["parent"] = {"key": it["parent"]}
    code, body = req("POST", "/rest/api/2/issue", {"fields": fields})
    if code in (200, 201):
        key = json.loads(body)["key"]
        created.append(key)
        # set points + effort if settable
        ed = settable(key)
        ef = {}
        if "customfield_10016" in ed and it.get("points") is not None:
            ef["customfield_10016"] = it["points"]
        if "timetracking" in ed and it.get("effort"):
            ef["timetracking"] = {"originalEstimate": it["effort"]}
        skipped = []
        if it.get("points") is not None and "customfield_10016" not in ed: skipped.append(f"points({it['points']})")
        if it.get("effort") and "timetracking" not in ed: skipped.append(f"effort({it['effort']})")
        if ef:
            c2, b2 = req("PUT", f"/rest/api/2/issue/{key}", {"fields": ef})
            note = f" enrich HTTP {c2}" + (f" {b2[:120]}" if b2 else "")
        else:
            note = ""
        note += f"  [skipped: {', '.join(skipped)}]" if skipped else ""
        print(f"CREATED {key}  {it['type']:6} <- {it['summary'][:50]}{note}")
    else:
        print(f"FAILED  ({code}) {it['summary'][:50]}: {body[:240]}")

print("\n--- read-back ---")
for key in created:
    code, body = req("GET", f"/rest/api/3/issue/{key}?fields=summary,issuetype,parent,customfield_10016,timeoriginalestimate,labels")
    f = json.loads(body)["fields"]
    est = f.get("timeoriginalestimate"); est_d = f"{est/28800:.2f}d" if est else "none"
    par = (f.get("parent") or {}).get("key", "-")
    print(f"{key}: {f['issuetype']['name']:6} pts={f.get('customfield_10016')} est={est_d} parent={par}  {f['summary'][:42]}")
