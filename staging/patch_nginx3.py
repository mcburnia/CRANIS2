#!/usr/bin/env python3
"""Add a /by-period location to nginx/default.conf (inline-script CSP). Idempotent."""
P = "/home/mcburnia/cranis2/nginx/default.conf"
s = open(P, encoding="utf-8").read()
anchor = "    # ── API reverse proxy ──"
block = (
"    # ── By-period (detailed timeline Beck-map page) ──\n"
"    location = /by-period { return 301 /by-period/; }\n"
"    location /by-period/ {\n"
"        add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self';\" always;\n"
"        add_header X-Frame-Options \"SAMEORIGIN\" always;\n"
"        add_header X-Content-Type-Options \"nosniff\" always;\n"
"        add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;\n"
"    }\n\n")
if "location /by-period/" in s:
    print("no change (already present)")
elif anchor in s:
    open(P, "w", encoding="utf-8").write(s.replace(block + anchor, block + anchor) if False else s.replace(anchor, block + anchor, 1))
    print("patched nginx default.conf (/by-period)")
else:
    print("ANCHOR NOT FOUND")
