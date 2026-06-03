#!/usr/bin/env python3
"""Add opt-in `preselectFirst`: when set, the page auto-opens the first
station's card on load instead of the 'select a station' prompt. Idempotent."""
P = "/home/mcburnia/cranis2/tools/becksmap/lib/template.js"
s = open(P, encoding="utf-8").read()
old = "  card.classList.add('visible');\n}\n</script>"
new = ("  card.classList.add('visible');\n}\n"
       "${def.preselectFirst ? 'if (allIds && allIds.length) { show(allIds[0]); }' : ''}\n</script>")
if "preselectFirst" in s:
    print("no change (already patched)")
elif old in s:
    open(P, "w", encoding="utf-8").write(s.replace(old, new, 1))
    print("patched template.js (preselectFirst)")
else:
    print("ANCHOR NOT FOUND — no change")
