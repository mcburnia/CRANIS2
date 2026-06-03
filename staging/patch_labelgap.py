#!/usr/bin/env python3
"""Add opt-in `labelGap` to becksmap generator.js: pushes main-line labels
further from the station circles (above labels up, below labels down) by N px.
Default 0 -> existing maps unchanged. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/generator.js"
s = open(P, encoding="utf-8").read()
old = ("    const titleY = labelsAbove ? GRID.rows.mainUpperText.title : GRID.rows.mainLowerText.title;\n"
       "    const subY = labelsAbove ? GRID.rows.mainUpperText.sub : GRID.rows.mainLowerText.sub;")
new = ("    const _gap = def.labelGap || 0;\n"
       "    const titleY = labelsAbove ? GRID.rows.mainUpperText.title - _gap : GRID.rows.mainLowerText.title + _gap;\n"
       "    const subY = labelsAbove ? GRID.rows.mainUpperText.sub - _gap : GRID.rows.mainLowerText.sub + _gap;")
if "_gap" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched generator.js (labelGap)")
else:
    print("ANCHOR NOT FOUND — no change")
