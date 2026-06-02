#!/usr/bin/env python3
"""CRANIS2 Jira CRAN enrichment tool.

Reverse-engineers repo-as-built history into agile-standard Jira issues:
user-story-voice description + Given/When/Then acceptance criteria,
story points (customfield_10016) and a human-team-equivalent effort
estimate (native Original estimate / timetracking).

Reads JIRA_API_TOKEN (and optional JIRA_EMAIL) from the environment.
Updates via REST v2 (wiki-markup description), reads back via v3 (rendered).
"""
import os, sys, json, base64, urllib.request, urllib.error

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SITE + path, data=data, method=method)
    r.add_header("Authorization", "Basic " + AUTH)
    r.add_header("Accept", "application/json")
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# --- Pilot: EPIC-03 (CRAN-34) Organisation & Multi-Tenant Model + 3 stories ---
ISSUES = [
    {
        "key": "CRAN-34",  # Epic — no field-level estimates; children aggregate
        "points": None,
        "effort": None,
        "description": """h2. Epic Goal
*As a* CRANIS2 customer,
*I want* every product, repository, contributor and finding to be strictly scoped to my organisation,
*so that* my compliance data stays private, is correctly CRA-classified, and is never visible to any other tenant.

h3. Scope
The tenancy boundary of the whole platform: the post-signup org-setup wizard (name / country / company size / CRA role / industry); the Postgres + Neo4j data model (Organisation node with {{ADMIN_OF}} / {{BELONGS_TO}} edges); the organisation page with members + CRA classification; and the cross-org data-isolation guarantee enforced by every authenticated route.

h3. Acceptance Criteria
* *Given* any authenticated request, *when* a query runs, *then* results are scoped to the caller's {{org_id}} resolved from the JWT.
* *Given* two tenants A and B, *when* B's user queries any resource, *then* no row belonging to A is ever returned.
* *Given* the five CRA roles, *then* {{Organisation.craRole}} supports {{manufacturer}}, {{importer}}, {{distributor}} and {{open_source_steward}}.

h3. Child Stories
* CRAN-99 — Org setup wizard + Neo4j integration
* CRAN-100 — Organisation page with live data + members
* CRAN-101 — Cross-org data-isolation guarantee

_Rolled-up size ≈ 18 points / ≈ 8.5 person-days (human-team equivalent), aggregated from child stories._
""",
    },
    {
        "key": "CRAN-99",
        "points": 8,
        "effort": "4d",
        "description": """h3. User Story
*As an* organisation administrator,
*I want* to complete a guided org-setup wizard immediately after signing up,
*so that* my organisation's CRA profile is captured and every product, repo, contributor and finding is scoped to my tenant from day one.

h3. Acceptance Criteria
* *Given* a newly registered user with no organisation, *when* they authenticate, *then* they are redirected to {{/setup/org}}.
* *Given* the org-setup wizard, *when* submitted with name + country + company size + CRA role + industry, *then* {{POST /api/org}} creates an Organisation node in Neo4j and sets {{users.org_id}} in Postgres.
* *Given* a created organisation, *when* the owner is linked, *then* an {{ADMIN_OF}} edge exists from the user to the Organisation node and {{users.org_role}} is populated.
* *Given* an authenticated session, *when* {{GET /api/auth/me}} is called, *then* it returns the caller's organisation info.

h3. Implementation Notes
Backend connected to Neo4j; introduced Organisation / Product / Dependency / Vulnerability node types. Post-signup wizard captures name + country + company size + CRA role + industry. {{POST /api/org}} and {{GET /api/org}} endpoints. Added {{users.org_id}} + {{users.org_role}} columns; {{/api/auth/me}} returns org info.

h3. Verification
{{routes/org.test.ts}} (org-create + org-read); {{e2e/acceptance/organisation-management.spec.ts}} (redirect-to-setup path).

h3. Sources
Commit {{bac8ad5}} (2026-02-20 14:23).
""",
    },
    {
        "key": "CRAN-100",
        "points": 5,
        "effort": "2d 4h",
        "description": """h3. User Story
*As an* organisation administrator,
*I want* a single organisation page showing my org details, CRA compliance status and member list,
*so that* I can see my tenant's profile and who has access at a glance.

h3. Acceptance Criteria
* *Given* an authenticated org admin, *when* they open {{/organisation}}, *then* three cards render with live data: Details (name / country / size / CRA role / industry / org ID), CRA Compliance Status (classification / SME exemptions / applicable articles / product + obligation counts), and Members (email / role / preferred language / join date).
* *Given* {{GET /api/org/members}}, *when* called, *then* it returns the organisation's members and is covered by {{routes/org.test.ts}}.
* *Given* a small screen, *when* the page renders, *then* it collapses to a single column and hides the preferred-language column.

h3. Implementation Notes
Three-card responsive organisation page backed by {{GET /api/org/members}}. Single column on mobile; language column hidden on small screens.

h3. Verification
{{routes/org.test.ts}} ({{GET /api/org/members}}); rendered live and verified via E2E.

h3. Sources
Commit {{0c7bc1e}} (2026-02-20 15:25).
""",
    },
    {
        "key": "CRAN-101",
        "points": 5,
        "effort": "2d",
        "description": """h3. User Story
*As a* CRANIS2 customer,
*I want* my organisation's data strictly isolated from every other tenant,
*so that* no other organisation can ever see my products, repositories, findings or members.

h3. Acceptance Criteria
* *Given* every authenticated route, *when* a query executes, *then* it scopes by {{org_id}} resolved from the JWT.
* *Given* tenant A and tenant B, *when* B's authenticated user issues any read, *then* no row belonging to A appears in the response.
* *Given* attempted privilege-escalation / cross-org access paths, *when* exercised, *then* they are denied.

h3. Implementation Notes
Every authenticated route resolves {{org_id}} from the JWT and scopes every query to that org. The guarantee is exercised end-to-end so that a row from org A's tenant never appears in a response served to org B's authenticated user.

h3. Verification
{{integration/cross-org-data-isolation.test.ts}}; {{security/cross-org-access.test.ts}} (privilege-escalation paths).

h3. Sources
{{routes/auth.ts}} JWT payload includes {{org_id}}; org scoping is the established pattern across {{routes/*.ts}}.
""",
    },
]


def load_issues():
    """Load issue data from a JSON file path in argv, else use the built-in pilot set.

    JSON shape: [{"key","points"(int|null),"effort"(str|null),"description"(wiki)}, ...]
    """
    for a in sys.argv[1:]:
        if a.endswith(".json"):
            with open(a) as fh:
                data = json.load(fh)
            print(f"Loaded {len(data)} issues from {a}\n")
            return data
    return ISSUES


def settable_fields(key):
    """Return the set of field IDs that can be edited on this issue."""
    code, body = req("GET", f"/rest/api/3/issue/{key}/editmeta")
    if code != 200:
        return set()
    return set(json.loads(body).get("fields", {}).keys())


def main():
    apply = "--apply" in sys.argv
    issues = load_issues()
    print(f"Mode: {'APPLY' if apply else 'DRY-RUN (pass --apply to write)'}\n")
    for it in issues:
        editable = settable_fields(it["key"]) if apply else set()
        if not apply:
            print(f"{it['key']}: points={it['points']} effort={it['effort']} desc_len={len(it['description'])}")
            continue
        # Description always lands (v2 converts wiki -> ADF). Estimate fields
        # only sent if the project/board actually exposes them, so a missing
        # field never blocks the description write.
        fields = {"description": it["description"]}
        skipped = []
        if it.get("points") is not None:
            if "customfield_10016" in editable:
                fields["customfield_10016"] = it["points"]
            else:
                skipped.append(f"points({it['points']})")
        if it.get("effort"):
            if "timetracking" in editable:
                fields["timetracking"] = {"originalEstimate": it["effort"]}
            else:
                skipped.append(f"effort({it['effort']})")
        code, body = req("PUT", f"/rest/api/2/issue/{it['key']}", {"fields": fields})
        note = f"  [skipped: {', '.join(skipped)}]" if skipped else ""
        print(f"{it['key']}: PUT -> HTTP {code} {body[:160]}{note}")
    if apply:
        print("\n--- read-back ---")
        for it in issues:
            code, body = req("GET", f"/rest/api/3/issue/{it['key']}?fields=summary,description,customfield_10016,timeoriginalestimate")
            d = json.loads(body)
            f = d["fields"]
            est = f.get("timeoriginalestimate")
            est_d = f"{est/28800:.2f}d" if est else "none"
            has_desc = "yes" if f.get("description") else "NO"
            print(f"{it['key']}: desc={has_desc} points={f.get('customfield_10016')} orig_est={est_d}  ({f['summary'][:38]})")


if __name__ == "__main__":
    main()
