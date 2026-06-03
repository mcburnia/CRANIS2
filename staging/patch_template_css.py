#!/usr/bin/env python3
"""Add a compact, muted `.acro-list` style to becksmap template.js for tidy
acronym sub-lists under card bullets. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/template.js"
s = open(P, encoding="utf-8").read()
anchor = "  .detail-list li::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--teal);margin-top:7px;flex-shrink:0}"
add = ("\n  .acro-list{list-style:none;padding-left:16px;margin-top:8px;display:flex;flex-direction:column;gap:3px}"
       "\n  .acro-list li{font-family:'Outfit',sans-serif;font-size:12px;color:var(--text-3);line-height:1.45}"
       "\n  .acro-list li::before{content:'\\2013\\00a0';color:var(--text-3)}")
if ".acro-list" in s:
    print("no change (already patched)")
elif anchor in s:
    open(P, "w", encoding="utf-8").write(s.replace(anchor, anchor + add, 1))
    print("patched template.js (.acro-list css)")
else:
    print("ANCHOR NOT FOUND — no change")
