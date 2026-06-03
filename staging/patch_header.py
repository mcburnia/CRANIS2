#!/usr/bin/env python3
"""Stack the Beck-map title over its subtitle (own rows) so the title never
word-wraps regardless of window width. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/template.js"
s = open(P, encoding="utf-8").read()
old = ".map-header{display:flex;align-items:baseline;gap:12px;margin-bottom:18px}"
new = ".map-header{display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin-bottom:18px}"
if "flex-direction:column;align-items:flex-start;gap:5px;margin-bottom:18px}" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched template.js (stacked header)")
else:
    print("ANCHOR NOT FOUND — no change")
