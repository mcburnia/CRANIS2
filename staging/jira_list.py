#!/usr/bin/env python3
"""List CRAN issues for a JQL: key | type | parent | summary. Paginates fully."""
import os, sys, json, base64, urllib.request, urllib.parse, urllib.error

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()

jql = sys.argv[1] if len(sys.argv) > 1 else "project=CRAN ORDER BY key ASC"

token = None
rows = []
while True:
    params = {"jql": jql, "maxResults": "100", "fields": "summary,issuetype,parent,status"}
    if token:
        params["nextPageToken"] = token
    url = SITE + "/rest/api/3/search/jql?" + urllib.parse.urlencode(params)
    r = urllib.request.Request(url)
    r.add_header("Authorization", "Basic " + AUTH)
    r.add_header("Accept", "application/json")
    with urllib.request.urlopen(r) as resp:
        d = json.loads(resp.read().decode())
    for i in d.get("issues", []):
        f = i["fields"]
        rows.append((i["key"], f["issuetype"]["name"], (f.get("parent") or {}).get("key", ""), f["status"]["name"], f["summary"]))
    token = d.get("nextPageToken")
    if not token or d.get("isLast"):
        break

print(f"# {len(rows)} issues")
for k, t, p, s, summ in rows:
    print(f"{k}\t{t}\t{p}\t{s}\t{summ}")
