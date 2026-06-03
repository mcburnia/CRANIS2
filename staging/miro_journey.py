#!/usr/bin/env python3
"""Render the full CRANIS2 customer-journey map as a Beck (tube-map) diagram
on the existing Miro board. Clears prior items, then draws 5 lines with
interchange stations. Reads MIRO_ACCESS_TOKEN from env."""
import os, json, urllib.request, urllib.error

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BASE = "https://api.miro.com/v2"
BOARD_NAME = "CRANIS2 — Customer Journey Map"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Authorization", "Bearer " + TOKEN); r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

# resolve board: reuse our named board if present, else repurpose the empty "Untitled"
_, b = req("GET", "/boards?limit=50")
boards = json.loads(b).get("data", [])
bid = next((x["id"] for x in boards if x["name"] == BOARD_NAME), None)
if not bid:
    bid = next((x["id"] for x in boards if x["name"] == "Untitled"), None)
    if not bid: print("no target board and no 'Untitled' board to reuse"); raise SystemExit
    c, _ = req("PATCH", f"/boards/{bid}", {"name": BOARD_NAME,
        "description": "Customer journeys rendered as Beck (tube-map) diagrams"})
    print(f"repurposed 'Untitled' -> '{BOARD_NAME}' (rename HTTP {c}) id={bid}")
else:
    print("reusing board", bid)

# clear existing items + connectors
for ep, key in [("connectors", "connectors"), ("items", "items")]:
    _, b = req("GET", f"/boards/{bid}/{ep}?limit=50")
    for it in json.loads(b).get("data", []):
        req("DELETE", f"/boards/{bid}/{ep}/{it['id']}")
print("cleared prior items")

COL = {"ob": "#1a73e8", "bill": "#1e8e3e", "esc": "#9334e6", "art": "#d93025", "trust": "#12b5cb"}
GAP = 190

# node: id -> (label, x, y, interchange?, label_dy)
N = {}
def node(nid, label, x, y, ix=False, ldy=-52):
    N[nid] = dict(label=label, x=x, y=y, ix=ix, ldy=ldy)

# --- Onboarding (main line, y=0) ---
ob = ["Sign up","Verify email","Set up organisation","Create product","Connect repository",
      "SBOM captured","Risk findings","Obligations derived","Technical file","Compliance reports","CRA-ready"]
ix_ob = {2,3,6,10}                       # interchange stations
for i, lab in enumerate(ob):
    dy = -58 if i in ix_ob else (-52 if i % 2 == 0 else 52)
    if i in (2, 10): dy = 58             # billing + trust branch up → label below
    node(f"ob{i}", lab, i*GAP, 0, i in ix_ob, dy)

# --- Billing line (top band, branches up from ob2) ---
node("bi1","Trial",          2*GAP, -240, ldy=-52)
node("bi2","Subscribe",      3*GAP, -240, ldy=-52)
node("bi3","Manage plan",    4*GAP, -240, ldy=-52)
# --- Escrow line (bottom band, branches down from ob3) ---
node("es1","Escrow setup",   3*GAP, 240, ldy=52)
node("es2","Daily deposits", 4*GAP, 240, ldy=52)
node("es3","Agent access",   5*GAP, 240, ldy=52)
# --- Vulnerability / Art. 14 line (bottom band, branches down from ob6) ---
node("a1","Awareness",       6*GAP, 240, ldy=52)
node("a2","Early warning 24h",7*GAP, 240, ldy=52)
node("a3","Notification 72h",8*GAP, 240, ldy=52)
node("a4","Final report 14d",9*GAP, 240, ldy=52)
# --- Trust Centre line (top band right, branches up from ob10 / CRA-ready) ---
node("t1","Publish profile", 10*GAP, -240, ldy=-52)
node("t2","Compliance badges",11*GAP,-240, ldy=-52)
node("t3","Customer contact",12*GAP,-240, ldy=-52)

# edges: (a, b, colorkey)
edges = []
for i in range(len(ob)-1): edges.append((f"ob{i}", f"ob{i+1}", "ob"))
edges += [("ob2","bi1","bill"),("bi1","bi2","bill"),("bi2","bi3","bill")]
edges += [("ob3","es1","esc"),("es1","es2","esc"),("es2","es3","esc")]
edges += [("ob6","a1","art"),("a1","a2","art"),("a2","a3","art"),("a3","a4","art")]
edges += [("ob10","t1","trust"),("t1","t2","trust"),("t2","t3","trust")]

# frame backdrop
xs=[n["x"] for n in N.values()]; ys=[n["y"] for n in N.values()]
cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2
req("POST", f"/boards/{bid}/frames", {
    "data":{"title":"CRANIS2 — Customer Journey Map","format":"custom","type":"freeform"},
    "position":{"x":cx,"y":cy-20},
    "geometry":{"width":(max(xs)-min(xs))+360,"height":(max(ys)-min(ys))+360}})

# stations + labels
def line_of(nid):  # colour a station by the line it primarily belongs to
    return {"bi":"bill","es":"esc","a":"art","t":"trust"}.get(nid.rstrip("0123456789"), "ob")
ids={}
for nid,n in N.items():
    if n["ix"]:
        style={"fillColor":"#ffffff","borderColor":"#111111","borderWidth":"4"}; w=46
    else:
        style={"fillColor":"#ffffff","borderColor":COL[line_of(nid)],"borderWidth":"3"}; w=30
    c,b=req("POST",f"/boards/{bid}/shapes",{"data":{"shape":"circle"},"style":style,
        "position":{"x":n["x"],"y":n["y"]},"geometry":{"width":w,"height":w}})
    ids[nid]=json.loads(b)["id"] if c in (200,201) else None
    if c not in (200,201): print("shape FAIL",nid,c,b[:140])
    req("POST",f"/boards/{bid}/texts",{"data":{"content":("<b>"+n["label"]+"</b>" if n["ix"] else n["label"])},
        "position":{"x":n["x"],"y":n["y"]+n["ldy"]},"geometry":{"width":150}})

# connectors
for a,z,ck in edges:
    if ids.get(a) and ids.get(z):
        c,b=req("POST",f"/boards/{bid}/connectors",{"startItem":{"id":ids[a]},"endItem":{"id":ids[z]},
            "shape":"straight","style":{"strokeColor":COL[ck],"strokeWidth":"6","strokeStyle":"normal"}})
        if c not in (200,201): print("connector FAIL",a,z,c,b[:140])

_,b=req("GET",f"/boards/{bid}/items?limit=50"); _,b2=req("GET",f"/boards/{bid}/connectors?limit=50")
print("items:",json.loads(b).get("total")," connectors:",json.loads(b2).get("total"))
print("BOARD URL: https://miro.com/app/board/"+bid+"/")
