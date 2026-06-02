#!/usr/bin/env python3
"""Create one Kanban board per discipline, backed by the existing saved filters."""
import os, json, base64, urllib.request, urllib.error
SITE="https://andimcburnie.atlassian.net"
EMAIL=os.environ.get("JIRA_EMAIL","andi.mcburnie@gmail.com")
TOKEN=os.environ["JIRA_API_TOKEN"]
AUTH=base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()
def req(method,path,body=None):
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(SITE+path,data=data,method=method)
    r.add_header("Authorization","Basic "+AUTH); r.add_header("Accept","application/json")
    if data: r.add_header("Content-Type","application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

BOARDS=[
 ("CRAN — Marketing board",10132),
 ("CRAN — Sales board",10133),
 ("CRAN — QA board",10134),
 ("CRAN — Legal board",10135),
 ("CRAN — Ops & Finance board",10136),
 ("CRAN — Engineering board",10137),
]
for name,fid in BOARDS:
    c,b=req("POST","/rest/agile/1.0/board",{"name":name,"type":"kanban","filterId":fid})
    if c in (200,201):
        d=json.loads(b); print(f"OK  {name:30} boardId={d.get('id')}  filter={fid}")
    else:
        print(f"FAIL {name}: HTTP {c} {b[:240]}")
