#!/usr/bin/env python3
"""Miro Beck-map renderer (pilot). Builds customer-journey 'tube lines' as
native, editable Miro objects: station circles on an equidistant grid,
coloured straight connectors, alternating labels, inside a titled frame.
Reads MIRO_ACCESS_TOKEN from env. Find-or-create board (idempotent on name)."""
import os, json, urllib.request, urllib.error

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BASE = "https://api.miro.com/v2"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Authorization", "Bearer " + TOKEN); r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

BOARD_NAME = "CRANIS2 — Customer Journey Map"
LINE = "#1a73e8"   # CRANIS2 accent blue
GAP = 180          # equidistant station spacing (Beck grid)

# find-or-create board
_, b = req("GET", "/boards?limit=50")
bid = next((x["id"] for x in json.loads(b).get("data", []) if x["name"] == BOARD_NAME), None)
if not bid:
    c, b = req("POST", "/boards", {"name": BOARD_NAME,
        "description": "Customer journeys rendered as Beck (tube-map) diagrams"})
    if c not in (200, 201): print("board create FAIL", c, b[:300]); raise SystemExit
    bid = json.loads(b)["id"]; print("created board", bid)
else:
    print("reusing board", bid)

stations = ["Sign up", "Verify email", "Set up organisation", "Create product"]
n = len(stations); span = (n - 1) * GAP

# titled frame as the canvas backdrop
c, b = req("POST", f"/boards/{bid}/frames", {
    "data": {"title": "Onboarding line — new customer → first product", "format": "custom", "type": "freeform"},
    "position": {"x": span / 2, "y": 0},
    "geometry": {"width": span + 240, "height": 260}})
print("frame:", c if c in (200,201) else (c, b[:160]))

# stations + alternating labels
ids = []
for i, name in enumerate(stations):
    x = i * GAP
    c, b = req("POST", f"/boards/{bid}/shapes", {
        "data": {"shape": "circle"},
        "style": {"fillColor": "#ffffff", "borderColor": LINE, "borderWidth": "3"},
        "position": {"x": x, "y": 0}, "geometry": {"width": 30, "height": 30}})
    if c in (200, 201): ids.append(json.loads(b)["id"])
    else: ids.append(None); print(f"  shape '{name}' FAIL", c, b[:160])
    ly = -50 if i % 2 == 0 else 50
    c2, b2 = req("POST", f"/boards/{bid}/texts", {
        "data": {"content": name}, "position": {"x": x, "y": ly}, "geometry": {"width": 130}})
    if c2 not in (200, 201): print(f"  label '{name}' FAIL", c2, b2[:160])

# coloured connectors between consecutive stations
for a, z in zip(ids, ids[1:]):
    if a and z:
        c, b = req("POST", f"/boards/{bid}/connectors", {
            "startItem": {"id": a}, "endItem": {"id": z}, "shape": "straight",
            "style": {"strokeColor": LINE, "strokeWidth": "6", "strokeStyle": "normal"}})
        if c not in (200, 201): print("  connector FAIL", c, b[:200])

_, b = req("GET", f"/boards/{bid}/items?limit=50")
print("items on board:", json.loads(b).get("total"))
print("BOARD URL: https://miro.com/app/board/" + bid + "/")
