#!/usr/bin/env python3
"""Add opt-in per-station label font-size (`labelSize`) to becksmap generator.js,
so a station's main label can be enlarged for emphasis. Non-breaking. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/generator.js"
s = open(P, encoding="utf-8").read()
old = 'style="fill:${labelColour}">'
new = "style=\"fill:${labelColour}${stn.labelSize ? ';font-size:' + stn.labelSize + 'px' : ''}\">"
if "stn.labelSize" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched generator.js (labelSize)")
else:
    print("ANCHOR NOT FOUND — no change")
