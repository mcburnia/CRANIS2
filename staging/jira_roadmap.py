#!/usr/bin/env python3
"""Set Start date (customfield_10015) + Due date on forward CRAN epics so the
Timeline renders as a cross-discipline roadmap. Draft sequence anchored to
CRA Sep-2026, PLD Dec-2026, CRA-full Dec-2027. Skips cancelled CRAN-21/22.
"""
import os, json, base64, urllib.request, urllib.error

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()
START_FIELD = "customfield_10015"  # Start date

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SITE + path, data=data, method=method)
    r.add_header("Authorization", "Basic " + AUTH); r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

def settable(key):
    c, b = req("GET", f"/rest/api/3/issue/{key}/editmeta")
    return set(json.loads(b).get("fields", {}).keys()) if c == 200 else set()

# (key, start, due)  — band comments mark the planning theme
ROADMAP = [
 # ── Band 1: Now / launch consolidation + foundations + GTM kickoff (Jun–Sep 2026) ──
 ("CRAN-377","2026-06-02","2026-06-30"),  # Launch outstanding (user-side)
 ("CRAN-475","2026-06-02","2026-07-31"),  # Finance & Tax Ops
 ("CRAN-458","2026-06-09","2026-07-15"),  # Customer-journey process testing
 ("CRAN-453","2026-06-09","2026-07-31"),  # Beta programme management
 ("CRAN-438","2026-06-16","2026-07-15"),  # Brand & asset foundation
 ("CRAN-468","2026-06-09","2026-08-31"),  # Corporate & legal foundation
 ("CRAN-376","2026-06-16","2026-08-31"),  # Post-launch ops & hardening
 ("CRAN-447","2026-07-01","2026-08-31"),  # Sales plan
 ("CRAN-423","2026-07-15","2026-09-15"),  # Social media campaign
 ("CRAN-433","2026-08-01","2026-09-30"),  # CRA-deadline content engine (→ CRA Sep)
 # ── Band 2: Growth engine + PLD + Tier-1 CRA (Oct–Dec 2026) ──
 ("CRAN-442","2026-10-01","2026-10-31"),  # Affiliate activation
 ("CRAN-419","2026-10-01","2026-12-15"),  # Operator Supplier Dashboard
 ("CRAN-420","2026-10-01","2026-12-15"),  # PLD recast (Dec-2026 deadline)
 ("CRAN-2","2026-10-01","2026-11-15"),    # CVD intake
 ("CRAN-3","2026-10-01","2026-11-15"),    # Customer-facing SBOM publication
 ("CRAN-429","2026-10-15","2026-12-31"),  # Demand-side / operator outreach
 ("CRAN-464","2026-11-01","2026-11-30"),  # Accessibility audit
 ("CRAN-421","2026-11-01","2026-12-31"),  # DORA Art. 28 pack
 # ── Band 3: Tier-1 completion + SSO (Q1 2027) ──
 ("CRAN-4","2027-01-05","2027-02-28"),    # Regulatory supplier-assessment
 ("CRAN-5","2027-01-05","2027-03-15"),    # Single-incident multi-track
 ("CRAN-371","2027-01-15","2027-02-28"),  # SSO
 ("CRAN-8","2027-02-01","2027-02-28"),    # Sub-processor list
 ("CRAN-6","2027-02-15","2027-03-31"),    # Substantial-modification detection
 ("CRAN-7","2027-03-01","2027-03-31"),    # GDPR Art. 30 RoPA
 # ── Band 4: Tier-2 + i18n (Q2 2027) ──
 ("CRAN-373","2027-04-01","2027-06-30"),  # Service unit-test coverage
 ("CRAN-9","2027-04-01","2027-04-30"),    # Regulator evidence portal
 ("CRAN-370","2027-04-01","2027-05-31"),  # i18n
 ("CRAN-10","2027-04-15","2027-05-31"),   # Harmonised standards catalogue
 ("CRAN-12","2027-05-01","2027-05-31"),   # DPIA generator
 ("CRAN-11","2027-05-01","2027-06-15"),   # Notified Body workflow
 ("CRAN-13","2027-06-01","2027-06-30"),   # Regulatory policy attestation
 # ── Band 5: Tier-3 + CRA-completeness (H2 2027 → CRA-full Dec 2027) ──
 ("CRAN-378","2027-07-01","2027-07-31"),  # Major dependency upgrades
 ("CRAN-14","2027-07-01","2027-07-31"),   # Evidence dropbox
 ("CRAN-23","2027-07-01","2027-08-15"),   # CRA-A Annex II pack
 ("CRAN-372","2027-07-01","2027-08-31"),  # Help-guide stub completion
 ("CRAN-15","2027-07-15","2027-08-15"),   # DPA / SCC generator
 ("CRAN-16","2027-08-01","2027-08-31"),   # OSS Steward workflow
 ("CRAN-24","2027-08-01","2027-09-15"),   # CRA-B CSAF feed
 ("CRAN-379","2027-08-01","2027-09-30"),  # Commercial offerings discovery
 ("CRAN-17","2027-09-01","2027-10-15"),   # AI Act overlap
 ("CRAN-18","2027-09-01","2027-10-15"),   # NIS2 matrix
 ("CRAN-25","2027-09-01","2027-10-15"),   # CRA-C per-component DD
 ("CRAN-374","2027-09-01","2027-10-15"),  # Slack / ChatOps
 ("CRAN-19","2027-10-01","2027-10-31"),   # Compliance calendar
 ("CRAN-375","2027-10-01","2027-12-15"),  # Supplier Trust Centre P5
 ("CRAN-26","2027-10-01","2027-11-15"),   # CRA-D severe-incident trigger
 ("CRAN-20","2027-10-15","2027-11-15"),   # Multi-product templating
 ("CRAN-27","2027-11-01","2027-11-30"),   # CRA-E authorised representative
 ("CRAN-28","2027-11-15","2027-12-15"),   # CRA-F Module A record
]

ok = 0; fail = []
checked = settable(ROADMAP[0][0])
use_start = START_FIELD in checked
if not use_start:
    print(f"WARNING: {START_FIELD} (Start date) not settable on epics — setting Due date only.")
for key, start, due in ROADMAP:
    fields = {"duedate": due}
    if use_start: fields[START_FIELD] = start
    c, b = req("PUT", f"/rest/api/2/issue/{key}", {"fields": fields})
    if c == 204: ok += 1
    else: fail.append(f"{key}: {c} {b[:120]}")
print(f"dated {ok}/{len(ROADMAP)} epics (start+due)" if use_start else f"dated {ok}/{len(ROADMAP)} (due only)")
if fail: print("FAILURES:\n" + "\n".join(fail))
