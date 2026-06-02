#!/usr/bin/env python3
"""Create per-discipline saved filters in Jira CRAN, shared with the project."""
import os, json, base64, urllib.request, urllib.error

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SITE + path, data=data, method=method)
    r.add_header("Authorization", "Basic " + AUTH); r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

# project id for the project-level share
c, b = req("GET", "/rest/api/3/project/CRAN")
PID = json.loads(b)["id"]
print(f"CRAN project id = {PID}\n")

DISC = ["discipline:marketing","discipline:sales","discipline:qa","discipline:legal","discipline:ops"]
NOT_DISC = " AND labels NOT IN (" + ",".join(f'"{d}"' for d in DISC) + ")"

FILTERS = [
 ("CRAN — Marketing",  'project = CRAN AND labels = "discipline:marketing" ORDER BY key ASC',
  "All CRANIS2 marketing-discipline work (social, operator outreach, content, brand, affiliate)."),
 ("CRAN — Sales",      'project = CRAN AND labels = "discipline:sales" ORDER BY key ASC',
  "All CRANIS2 sales-discipline work (sales plan, beta programme)."),
 ("CRAN — QA",         'project = CRAN AND labels = "discipline:qa" ORDER BY key ASC',
  "All CRANIS2 QA-discipline work (customer-journey UAT, accessibility)."),
 ("CRAN — Legal",      'project = CRAN AND labels = "discipline:legal" ORDER BY key ASC',
  "All CRANIS2 legal/corporate work (NewCo, SEIS, IP, trademark, insurance, contracts)."),
 ("CRAN — Ops & Finance", 'project = CRAN AND labels = "discipline:ops" ORDER BY key ASC',
  "All CRANIS2 ops/finance work (VAT/OSS, financial model, invoicing, KPIs)."),
 ("CRAN — Engineering", f'project = CRAN{NOT_DISC} ORDER BY key ASC',
  "All CRANIS2 engineering/product work (everything without a discipline:* label)."),
]

for name, jql, desc in FILTERS:
    body = {"name": name, "description": desc, "jql": jql, "favourite": True,
            "sharePermissions": [{"type": "project", "project": {"id": PID}}]}
    c, b = req("POST", "/rest/api/3/filter", body)
    if c in (200, 201):
        d = json.loads(b)
        print(f"OK  {name:22} id={d['id']}  {d.get('viewUrl','')}")
    else:
        print(f"FAIL {name}: HTTP {c} {b[:200]}")
