#!/usr/bin/env python3
"""Add opt-in footer cross-links (`def.links`) to becksmap template.js. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/template.js"
s = open(P, encoding="utf-8").read()
old = "  <span>CRANIS2 User Guide</span>\n</footer>"
new = ("  <span>CRANIS2 User Guide</span>"
       "${(def.links || []).map(l => ` &nbsp;|&nbsp; <a href=\"${escapeHtml(l.href)}\" "
       "style=\"color:#1D9E75;font-weight:600;text-decoration:none\">${escapeHtml(l.label)}</a>`).join('')}\n</footer>")
if "def.links" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched template.js (footer links)")
else:
    print("ANCHOR NOT FOUND — no change")
