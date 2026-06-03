#!/usr/bin/env python3
"""Fix double-escaped unicode in becksmap template.js so the breadcrumb separator
(\\u203a -> ) and the prompt map icon render as real characters, not literal text."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/template.js"
s = open(P, encoding="utf-8").read()
bs = chr(92)  # backslash
fixes = [
    (bs + bs + "u203a", "›"),                                   # \\u203a -> 
    (bs + bs + "ud83d" + bs + bs + "uddfa" + bs + bs + "ufe0f", "\U0001F5FA️"),  # map emoji
]
changed = False
for old, new in fixes:
    if old in s:
        s = s.replace(old, new); changed = True
if changed:
    open(P, "w", encoding="utf-8").write(s); print("fixed double-escaped unicode")
else:
    print("no double-escapes found (already fixed?)")
