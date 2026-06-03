#!/usr/bin/env python3
"""Drop the WE-ARE-HERE marker further below the station so it clears the
(now gap-shifted) station label. Honours labelGap. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/generator.js"
s = open(P, encoding="utf-8").read()
old = "    const ty = GRID.rows.lowerBranchUpper.title;"
new = "    const ty = GRID.rows.lowerBranchUpper.title + (def.labelGap || 0) + 6;"
if "lowerBranchUpper.title + (def.labelGap" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched generator.js (marker drop)")
else:
    print("ANCHOR NOT FOUND — no change")
