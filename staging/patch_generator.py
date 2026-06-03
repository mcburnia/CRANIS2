#!/usr/bin/env python3
"""Add opt-in 'WE ARE HERE' marker support to becksmap generator.js.
Non-breaking: only renders when a definition sets `youAreHere`. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/generator.js"
src = open(P, encoding="utf-8").read()

# 1) make viewBox/legend mutable + give room for the marker when no lower branch
old1 = ("  const viewBoxHeight = hasLowerBranch ? GRID.viewBoxWithLower : GRID.viewBoxNoLower;\n"
        "  const legendY = hasLowerBranch ? GRID.legendWithLower : GRID.legendNoLower;")
new1 = ("  let viewBoxHeight = hasLowerBranch ? GRID.viewBoxWithLower : GRID.viewBoxNoLower;\n"
        "  let legendY = hasLowerBranch ? GRID.legendWithLower : GRID.legendNoLower;\n"
        "  if (!hasLowerBranch && def.youAreHere) { viewBoxHeight = 244; legendY = 230; }")

# 2) draw the marker (inside the translated group, after main-line stations)
anchor = "  // Draw feeder stations (above main line)"
block = (
"  // Draw \"WE ARE HERE\" marker (opt-in via def.youAreHere)\n"
"  if (def.youAreHere && stationXMap[def.youAreHere] != null) {\n"
"    const hx = stationXMap[def.youAreHere];\n"
"    const amber = COLOURS.feeder;\n"
"    parts.push(`<circle cx=\"${hx}\" cy=\"${GRID.mainY}\" r=\"15\" fill=\"none\" stroke=\"${amber}\" stroke-width=\"2.5\"/>`);\n"
"    const ty = GRID.rows.lowerBranchUpper.title;\n"
"    parts.push(`<polygon points=\"${hx-6},${ty} ${hx+6},${ty} ${hx},${ty-8}\" fill=\"${amber}\"/>`);\n"
"    parts.push(`<text x=\"${hx}\" y=\"${ty+13}\" text-anchor=\"middle\" class=\"lbl\" font-weight=\"700\" style=\"fill:${amber}\">WE ARE HERE</text>`);\n"
"  }\n\n" + anchor)

changed = False
if "if (!hasLowerBranch && def.youAreHere)" not in src and old1 in src:
    src = src.replace(old1, new1, 1); changed = True
if "WE ARE HERE" not in src and anchor in src:
    src = src.replace(anchor, block, 1); changed = True

if changed:
    open(P, "w", encoding="utf-8").write(src)
    print("patched generator.js")
else:
    print("no change (already patched or anchors not found)")
