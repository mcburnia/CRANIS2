#!/usr/bin/env python3
"""Add opt-in per-station label-position override to becksmap generator.js.
A station may set "labelPos": "above" | "below" to override the computed
alternation. Non-breaking (stations without it keep the alternation). Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/generator.js"
s = open(P, encoding="utf-8").read()
old = "    const labelsAbove = labelPositions[i].above;"
new = "    const labelsAbove = stn.labelPos ? (stn.labelPos === 'above') : labelPositions[i].above;"
if "stn.labelPos" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched generator.js (labelPos override)")
else:
    print("ANCHOR NOT FOUND — no change")
