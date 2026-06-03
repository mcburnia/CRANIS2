#!/usr/bin/env python3
P = "/home/mcburnia/cranis2/tools/becksmap/lib/template.js"
s = open(P, encoding="utf-8").read()
bad = "content:'\\2013\\00a0'"   # the broken octal-escape version
good = "content:'- '"
if bad in s:
    open(P, "w", encoding="utf-8").write(s.replace(bad, good))
    print("fixed .acro-list bullet -> plain dash")
else:
    print("bad pattern not found (already fixed?)")
