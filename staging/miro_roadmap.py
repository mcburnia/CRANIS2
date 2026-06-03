#!/usr/bin/env python3
"""One-page CRANIS2 roadmap on Miro: shipped (green) vs planned (yellow) by
quarter, with regulatory deadlines (red). Aggregated to theme level so it
reads on a single page. Reads MIRO_ACCESS_TOKEN from env."""
import os, json, urllib.request, urllib.error

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BASE = "https://api.miro.com/v2"
NAME = "CRANIS2 — Roadmap"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Authorization", "Bearer " + TOKEN); r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

# find-or-create board
_, b = req("GET", "/boards?limit=50")
bid = next((x["id"] for x in json.loads(b).get("data", []) if x["name"] == NAME), None)
if not bid:
    _, b = req("POST", "/boards", {"name": NAME, "description": "One-page done/to-do roadmap"})
    bid = json.loads(b)["id"]; print("created board", bid)
else:
    # clear for re-run
    for ep in ("connectors", "items"):
        _, c = req("GET", f"/boards/{bid}/{ep}?limit=50")
        for it in json.loads(c).get("data", []): req("DELETE", f"/boards/{bid}/{ep}/{it['id']}")
    print("reusing+cleared board", bid)

def text(content, x, y, size, w=300, align="center", color="#111111", bold=False):
    c = f"<b>{content}</b>" if bold else content
    req("POST", f"/boards/{bid}/texts", {"data": {"content": c},
        "style": {"fontSize": str(size), "textAlign": align, "color": color},
        "position": {"x": x, "y": y}, "geometry": {"width": w}})

def sticky(content, x, y, color, w=290):
    req("POST", f"/boards/{bid}/sticky_notes", {"data": {"content": content, "shape": "rectangle"},
        "style": {"fillColor": color}, "position": {"x": x, "y": y}, "geometry": {"width": w}})

def shape(x, y, w, h, fill):
    req("POST", f"/boards/{bid}/shapes", {"data": {"shape": "rectangle"},
        "style": {"fillColor": fill, "borderColor": fill}, "position": {"x": x, "y": y},
        "geometry": {"width": w, "height": h}})

# frame = the "page"
req("POST", f"/boards/{bid}/frames", {"data": {"title": "CRANIS2 — Product & Programme Roadmap", "format": "custom", "type": "freeform"},
    "position": {"x": 960, "y": 600}, "geometry": {"width": 1980, "height": 1280}})

# title + legend
text("CRANIS2 — Product & Programme Roadmap", 960, 44, 30, w=1100, bold=True)
text("What we've shipped &#183; what's left to do &#8212; as at June 2026", 960, 86, 15, w=900, color="#555555")
text("&#128998; Shipped &#160;&#160;&#160; &#128993; Planned &#160;&#160;&#160; &#128997; Regulatory deadline", 960, 116, 14, w=900, color="#333333")

cols = [160, 480, 800, 1120, 1440, 1760]
heads = [("✓ SHIPPED", "launched 30 Apr 2026"),
         ("Now – Q3 2026", "Finish launch + foundations + GTM"),
         ("Q4 2026", "Growth engine + PLD"),
         ("Q1 2027", "Tier-1 + SSO"),
         ("Q2 2027", "Tier-2 + i18n"),
         ("H2 2027", "Tier-3 + CRA-complete")]
for x, (h, s) in zip(cols, heads):
    text(h, x, 168, 20, w=300, bold=True)
    text(s, x, 198, 11, w=300, color="#666666")

# divider between SHIPPED and the forward plan
shape(320, 640, 4, 1000, "#bdbdbd")

GREEN, YELLOW, RED = "light_green", "light_yellow", "red"
columns = [
 [(GREEN,"Platform &#183; Auth &#183; Org multi-tenancy"),
  (GREEN,"Products &#183; Repos &#183; SBOM (6 providers) &#183; Vuln scanning"),
  (GREEN,"Tech File &#183; Obligations &#183; Art.14 reporting &#183; 10-yr Vault"),
  (GREEN,"AI Copilot suite &#183; Public API &#183; Integrations"),
  (GREEN,"Trust Centre &#183; Escrow &#183; Billing &#183; Affiliate"),
  (GREEN,"Security / PQC &#183; GDPR &#183; ✓ Production launch")],
 [(RED,"&#128681; CRA main obligations — Sep 2026"),
  (YELLOW,"Finish launch: DKIM &#183; Stripe live &#183; secrets &#183; ICO"),
  (YELLOW,"Corporate/Legal foundation: NewCo &#183; SEIS"),
  (YELLOW,"Finance &amp; Tax: EU VAT / OSS"),
  (YELLOW,"Beta programme + Customer-journey UAT"),
  (YELLOW,"Brand &#183; Social &#183; CRA content"),
  (YELLOW,"Sales plan")],
 [(RED,"&#128681; PLD recast transposition — Dec 2026"),
  (YELLOW,"Operator Dashboard + Outreach (growth engine)"),
  (YELLOW,"PLD recast pack + DORA Art.28 pack"),
  (YELLOW,"CVD intake + SBOM publication (Tier-1)"),
  (YELLOW,"Affiliate activation + Accessibility (WCAG)")],
 [(YELLOW,"Tier-1 finish: supplier-assessment &#183; multi-track incident &#183; sub-processor &#183; substantial-mod &#183; RoPA"),
  (YELLOW,"SSO + federated identity")],
 [(YELLOW,"Tier-2: regulator portal &#183; standards catalogue &#183; NB workflow &#183; DPIA &#183; policy attestation"),
  (YELLOW,"Multi-language (i18n)"),
  (YELLOW,"Service unit-test coverage → 100%")],
 [(RED,"&#128681; CRA full applicability — Dec 2027"),
  (YELLOW,"Tier-3: AI Act &#183; NIS2 matrix &#183; compliance calendar &#183; multi-product templating"),
  (YELLOW,"CRA-completeness: Annex II &#183; CSAF &#183; per-component DD &#183; 14(1)(b) &#183; auth-rep &#183; Module A"),
  (YELLOW,"Trust Centre P5 &#183; Slack/ChatOps &#183; evidence dropbox &#183; dep upgrades")],
]
for x, chips in zip(cols, columns):
    for i, (color, txt) in enumerate(chips):
        sticky(txt, x, 250 + i * 132, color)

_, b = req("GET", f"/boards/{bid}/items?limit=50")
print("items:", json.loads(b).get("total"))
print("BOARD URL: https://miro.com/app/board/" + bid + "/")
