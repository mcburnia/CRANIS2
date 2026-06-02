#!/usr/bin/env python3
"""Create the go-to-market / business / QA epics + child stories in CRAN.
Each epic is discipline-labelled; epics aggregate (no own estimate), child
stories carry user-story + AC + points + human-effort. Forward business work,
all To Do. Source: team GTM/ops planning, 2026-06-02.
"""
import os, sys, json, base64, urllib.request, urllib.error

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()
SRC = "Go-to-market / operations planning, 2026-06-02 (team session)."

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SITE + path, data=data, method=method)
    r.add_header("Authorization", "Basic " + AUTH); r.add_header("Accept", "application/json")
    if data: r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp: return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

def settable(key):
    c, b = req("GET", f"/rest/api/3/issue/{key}/editmeta")
    return set(json.loads(b).get("fields", {}).keys()) if c == 200 else set()

def edesc(role, want, so, scope, ac, children):
    return f"""h2. Epic Goal
*As a* {role},
*I want* {want},
*so that* {so}

h3. Scope
{scope}

h3. Acceptance Criteria
{ac}

h3. Child Stories
{children}

h3. Source
{SRC}

_Forward work (To Do). Story points + effort aggregate from child stories._
"""

def sdesc(role, want, so, ac, notes=""):
    parts = [f"""h3. User Story
*As a* {role},
*I want* {want},
*so that* {so}

h3. Acceptance Criteria
{ac}"""]
    if notes: parts.append(f"h3. Notes\n{notes}")
    parts.append(f"h3. Source\n{SRC}")
    return "\n\n".join(parts) + "\n"

def S(summary, pts, eff, role, want, so, ac, notes="", labels=None):
    return {"summary": summary, "points": pts, "effort": eff, "labels": labels or [],
            "desc": sdesc(role, want, so, ac, notes)}

EPICS = [
# ===================== MARKETING =====================
{"label":"discipline:marketing","summary":"Social Media Marketing Campaign",
 "desc":edesc("CRANIS2 founder","an active social-media presence and a repeatable campaign engine",
   "the product builds awareness and inbound demand in the CRA / compliance community.",
   "Establish branded social accounts, a reusable Canva template set built on the brand kit, a content calendar/cadence, the launch campaign, and measurement. Builds on Brand & Asset Foundation.",
   "* *Given* the accounts + templates + calendar, *when* the campaign runs, *then* posts ship on cadence and reach/engagement is measured against the funnel.",
   "* Create + brand social accounts\n* Canva post/carousel/story templates\n* Content calendar + cadence\n* Launch announcement campaign\n* Social analytics + funnel measurement"),
 "children":[
   S("Create and brand social media accounts",2,"1d","founder","branded LinkedIn / X / YouTube accounts set up",
     "the brand has consistent, claimed handles to publish from.",
     "* *Given* the brand kit, *when* accounts are created, *then* handles, bios, avatars and banners are consistent across platforms.",
     "Uses the master logo + brand kit from the Brand & Asset Foundation epic."),
   S("Canva social template set",3,"2d","content creator","a reusable set of Canva post / carousel / story templates",
     "on-brand content can be produced quickly without a designer each time.",
     "* *Given* the Canva brand kit, *when* templates are built, *then* post/carousel/story formats exist and are reusable."),
   S("Content calendar + posting cadence",3,"1d 4h","content creator","a planned content calendar and cadence",
     "posting is consistent and themed rather than ad-hoc.",
     "* *Given* the calendar, *when* the campaign runs, *then* each slot has a theme/format and a target date."),
   S("Launch announcement campaign",2,"1d","founder","a coordinated launch-announcement campaign",
     "the public launch of CRANIS2 reaches the target audience.",
     "* *Given* launch readiness, *when* the campaign runs, *then* announcement content ships across all channels in a coordinated sequence."),
   S("Social analytics + funnel measurement",2,"1d","founder","reach/engagement tracked through to signups",
     "I know which social activity actually drives funnel, not just vanity metrics.",
     "* *Given* tracked links/UTMs, *when* posts run, *then* reach, engagement and downstream signups are attributable."),
 ]},
{"label":"discipline:marketing","summary":"Demand-side / Operator Outreach (growth engine)",
 "desc":edesc("CRANIS2 go-to-market lead","to get regulated operators (banks, NIS2 entities, financial entities) to demand a CRANIS2 Trust Centre from their suppliers",
   "procurement leverage pulls whole sectors of suppliers onto the platform — the two-sided-market flywheel.",
   "The highest-leverage GTM motion: identify anchor operators, build the operator value proposition (discharge their own NIS2 Art. 21(2)(d) / DORA Art. 28 / GDPR Art. 28 supply-chain duties for free), and run a pilot. Tightly coupled to the Operator Supplier Dashboard (CRAN-419).",
   "* *Given* an anchor operator, *when* they adopt the dashboard, *then* they begin requesting CRANIS2 Trust Centres from their suppliers, generating referred supplier signups.",
   "* Identify target operators + sectors (spike)\n* Operator value-prop + one-pager\n* Anchor-operator outreach pilot\n* Operator Supplier Dashboard readiness (link CRAN-419)"),
 "children":[
   S("Discovery — target operators + sectors",3,"2d","GTM lead","to identify the sectors and named operators with the most supply-chain leverage",
     "outreach focuses where one adopter pulls in the most suppliers.",
     "* *Given* the discovery, *when* complete, *then* a ranked target list of sectors + named operators with rationale exists.",
     "Discovery spike."),
   S("Operator value proposition + one-pager",3,"1d 4h","GTM lead","a crisp operator-facing value proposition and one-pager",
     "an operator instantly understands how CRANIS2 discharges their own supply-chain obligations for free.",
     "* *Given* the one-pager, *when* shown to an operator, *then* it frames NIS2 Art. 21(2)(d) / DORA Art. 28 / GDPR Art. 28 discharge via supplier Trust Centres."),
   S("Anchor-operator outreach pilot",5,"3d","GTM lead","a pilot outreach to 1–2 anchor operators",
     "the flywheel is validated with real operators before scaling.",
     "* *Given* the target list + value-prop, *when* the pilot runs, *then* at least one operator agrees to request CRANIS2 Trust Centres from suppliers.",
     "Depends on Operator Supplier Dashboard (CRAN-419) being demoable."),
 ]},
{"label":"discipline:marketing","summary":"CRA-Deadline Content Engine",
 "desc":edesc("CRANIS2 marketer","a content programme pegged to the CRA / PLD / NIS2 statutory deadlines",
   "I capture demand exactly as those dates drive buyer urgency.",
   "Content calendar anchored to the regulatory beats — CRA major obligations Sep 2026, PLD recast transposition Dec 2026, full CRA applicability Dec 2027 — with explainer content, webinars/events, and the existing welcome-site assessments repurposed as lead magnets.",
   "* *Given* an upcoming statutory deadline, *when* it approaches, *then* timed content + an event ship and feed the launch list / assessment funnels.",
   "* Deadline-anchored content calendar\n* CRA explainer series\n* Deadline-beat webinar/event\n* Welcome-site assessments as lead magnets"),
 "children":[
   S("Deadline-anchored content calendar",3,"1d 4h","marketer","a content calendar anchored to Sep 2026 / Dec 2026 / Dec 2027",
     "content lands when buyer urgency peaks.",
     "* *Given* the regulatory dates, *when* the calendar is built, *then* each beat has planned content + channels."),
   S("CRA explainer content series",5,"3d","marketer","a series of CRA explainer articles/posts",
     "prospects learn the regulation from CRANIS2 and associate the brand with authority.",
     "* *Given* the series, *when* published (blog + welcome site), *then* each piece is SEO-tagged and links to an assessment/lead magnet."),
   S("Deadline-beat webinar / event",5,"3d","marketer","a webinar or event timed to a regulatory deadline",
     "I generate qualified leads around a moment of high buyer attention.",
     "* *Given* a deadline beat, *when* the event runs, *then* registrations are captured to the launch list and followed up."),
   S("Repurpose welcome-site assessments as lead magnets",2,"1d","marketer","the existing CRA/NIS2/Importer/PQC assessments promoted as campaign lead magnets",
     "an already-built asset actively drives the funnel.",
     "* *Given* the assessments, *when* promoted, *then* completions convert to launch-list leads and are measured.",
     "Reuses the P9 public conformity assessments (CRAN-54)."),
 ]},
{"label":"discipline:marketing","summary":"Brand & Asset Foundation",
 "desc":edesc("CRANIS2 founder","a consolidated brand-asset foundation built from the brand pack",
   "all marketing and sales output is visually consistent and the brand is protected.",
   "The creative foundation everything else builds on: a master editable logo (vector + variants), refreshed brand guidelines from docs/BRAND-PACK.md, and a Canva brand kit. (Trademark registration lives under Corporate & Legal Foundation.)",
   "* *Given* the foundation, *when* any team member produces an asset, *then* it draws on a single source of logo, colours and type.",
   "* Master editable logo asset\n* Brand guidelines refresh (from BRAND-PACK.md)\n* Canva brand kit"),
 "children":[
   S("Master editable CRANIS2 logo asset",3,"1d 4h","designer","a master editable logo in vector form with variants",
     "every downstream asset uses one canonical, scalable logo.",
     "* *Given* the master file, *when* exported, *then* full / mark-only / mono / reversed variants exist in vector + raster.",
     "Seeds the trademark filing (Corporate & Legal Foundation)."),
   S("Brand guidelines refresh from BRAND-PACK.md",2,"1d","designer","the brand guidelines refreshed from the existing brand pack",
     "the documented palette/type/voice is current and authoritative.",
     "* *Given* docs/BRAND-PACK.md, *when* refreshed, *then* palette, typography, logo usage and voice are consolidated into a single guideline.",
     "docs/BRAND-PACK.md already exists as the starting point."),
   S("Canva brand kit",2,"1d","content creator","colours, fonts and logo loaded into a Canva brand kit",
     "on-brand templates can be built directly in Canva.",
     "* *Given* the brand kit, *when* set up, *then* the palette, fonts and logo variants are available to all templates."),
 ]},
{"label":"discipline:marketing","summary":"Affiliate Programme Activation",
 "desc":edesc("CRANIS2 founder","to actively recruit and run affiliates on the already-built affiliate system",
   "partners drive referred signups through a programme that exists in code but has never been switched on commercially.",
   "Operationalise the affiliate programme (CRAN-71): define terms + commission, recruit initial affiliates (compliance consultants, community voices), onboard them with codes + assets, and run the monthly-statement/payout operations.",
   "* *Given* the built system, *when* affiliates are recruited and onboarded, *then* referred signups are attributed and monthly statements/payouts run.",
   "* Define affiliate terms + commission\n* Recruit initial affiliates\n* Affiliate onboarding + assets\n* Statement + payout operations"),
 "children":[
   S("Define affiliate terms + commission structure",2,"1d","founder","documented affiliate terms and a commission/bonus structure",
     "affiliates know what they earn and on what basis.",
     "* *Given* the terms, *when* published, *then* commission rates, attribution rules and payout cadence are clear.",
     "The bonus-code + ledger machinery already exists (CRAN-71)."),
   S("Recruit initial affiliates",3,"2d","founder","an initial cohort of affiliates recruited",
     "the programme has active partners, not just capability.",
     "* *Given* the terms, *when* recruitment runs, *then* a first cohort (e.g. compliance consultants / community voices) is signed up with bonus codes."),
   S("Affiliate onboarding + assets",2,"1d","affiliate manager","onboarding materials and promo assets for affiliates",
     "affiliates can start promoting immediately and on-brand.",
     "* *Given* a new affiliate, *when* onboarded, *then* they receive their code, banners and approved copy."),
   S("Statement + payout operations",2,"1d","affiliate manager","the monthly-statement and payout operations running",
     "affiliates are paid accurately and on time.",
     "* *Given* the monthly cycle, *when* it runs, *then* statements are generated (system exists) and payouts are processed + recorded."),
 ]},
# ===================== SALES =====================
{"label":"discipline:sales","summary":"Sales Plan",
 "desc":edesc("CRANIS2 founder","a documented sales plan and a working pipeline",
   "I can convert beta interest and inbound into paying customers predictably rather than ad-hoc.",
   "Define the ICP and two-sided segmentation, validate pricing/packaging, build the demo + collateral, stand up a CRM/pipeline, and write the beta→paid conversion playbook.",
   "* *Given* the plan, *when* a lead enters, *then* there is a defined qualification, demo, and conversion path with pricing.",
   "* ICP + two-sided segmentation\n* Pricing & packaging validation\n* Demo script + sales collateral\n* CRM / pipeline setup\n* Beta→paid conversion playbook"),
 "children":[
   S("ICP definition + two-sided segmentation",3,"2d","founder","a defined ideal-customer profile separating paying suppliers from promoting operators",
     "sales and marketing target the right two audiences distinctly.",
     "* *Given* the segmentation, *when* documented, *then* paying-supplier ICP and free-promoting-operator profile are each defined with qualifying criteria."),
   S("Pricing & packaging validation",3,"2d","founder","validated pricing and packaging across tiers",
     "the Standard/Pro/Enterprise/Managed options are priced to convert and sustain.",
     "* *Given* the live tiers + Enterprise/Managed (CRAN-379), *when* validated, *then* pricing is tested against ICP willingness-to-pay and documented."),
   S("Demo script + sales collateral",3,"1d 4h","founder","a repeatable demo script and supporting collateral",
     "every prospect gets a consistent, compelling walkthrough.",
     "* *Given* a demo, *when* delivered, *then* it follows the script and is backed by collateral drawn from EXECUTIVE-SUMMARY / MARKET-PITCH."),
   S("CRM / pipeline setup",3,"1d 4h","founder","a CRM and defined pipeline stages",
     "leads are tracked from first touch to closed-won.",
     "* *Given* the CRM, *when* a lead is added, *then* it moves through defined stages with next-actions."),
   S("Beta→paid conversion playbook",2,"1d","founder","a playbook for converting beta users to paying customers",
     "beta goodwill is systematically converted to revenue.",
     "* *Given* a beta user, *when* the playbook is applied, *then* there is a defined trigger, offer and conversion path."),
 ]},
{"label":"discipline:sales","summary":"Beta Programme Management",
 "desc":edesc("CRANIS2 founder","a structured beta programme",
   "early customers — including the confirmed beta partner — succeed, give structured feedback, and become references.",
   "Run the beta: onboarding playbook, onboard the confirmed first partner (brother's company, Bitbucket-hosted), a structured feedback loop, and a published case study/reference.",
   "* *Given* a beta participant, *when* they go through the programme, *then* they are onboarded, their feedback is captured and triaged, and a reference is produced.",
   "* Beta onboarding playbook\n* Onboard first beta partner\n* Structured feedback capture loop\n* Case study / reference"),
 "children":[
   S("Beta onboarding playbook",3,"1d 4h","founder","a documented beta onboarding playbook",
     "every beta partner gets a consistent, supported start.",
     "* *Given* a new beta org, *when* onboarded, *then* the playbook covers setup, first product, repo connect, and a success checklist."),
   S("Onboard first beta partner",3,"2d","founder","the confirmed beta partner onboarded end-to-end",
     "the first real customer is live and generating feedback.",
     "* *Given* the partner uses Bitbucket, *when* they connect, *then* repo connect + SBOM + obligations work.",
     "Depends on Bitbucket OAuth consumer registration (CRAN-405)."),
   S("Structured feedback capture loop",2,"1d","founder","a structured channel for beta feedback",
     "feedback flows into the backlog rather than being lost in conversation.",
     "* *Given* beta usage, *when* feedback arrives, *then* it is captured (the in-app feedback→support path exists, CRAN-366) and triaged into Jira."),
   S("Case study / reference from beta",3,"1d 4h","founder","a published case study / reference from a beta partner",
     "prospects see proof from a real customer.",
     "* *Given* a successful beta, *when* the case study is produced, *then* it is approved by the partner and usable in sales."),
 ]},
# ===================== QA =====================
{"label":"discipline:qa","summary":"Customer-Journey Process Testing (manual UAT)",
 "desc":edesc("CRANIS2 founder","every path a customer can take through CRANIS2 manually walked and validated by a human",
   "the real-world experience is verified beyond the automated test suite — nothing broken, confusing or dead-ends.",
   "Map every customer journey, execute manual walkthroughs, test edge/negative paths and a cross-browser/device matrix, then triage and fix findings.",
   "* *Given* the journey map, *when* each path is walked manually, *then* every issue (broken, confusing, dead-end) is logged and triaged.",
   "* Map all customer journeys\n* Execute manual walkthroughs\n* Edge / negative-path testing\n* Cross-browser / device matrix\n* Triage + fix findings loop"),
 "children":[
   S("Map all customer journeys",3,"2d","QA lead","a complete map of every customer journey through the product",
     "testing is exhaustive and nothing is missed.",
     "* *Given* the product, *when* mapped, *then* every journey is documented: signup → org setup → product → repo connect → SBOM → obligations → tech file → reports → escrow → billing → Trust Centre."),
   S("Execute manual journey walkthroughs",5,"3d","QA tester","each mapped journey walked manually end-to-end",
     "the happy paths genuinely work for a real human, not just in tests.",
     "* *Given* the journey map, *when* each is walked, *then* findings are logged with severity and reproduction steps."),
   S("Edge and negative-path testing",3,"2d","QA tester","failure, gating and error paths exercised",
     "the product behaves correctly when things go wrong or access is restricted.",
     "* *Given* error/gating/edge conditions (billing gate, plan gating, invalid input, expired tokens), *when* exercised, *then* behaviour is correct and messaging is clear."),
   S("Cross-browser / device matrix run",3,"2d","QA tester","the product validated across a browser and device matrix",
     "customers on any common browser/device get a working experience.",
     "* *Given* a defined matrix (Chrome/Firefox/Safari/Edge × desktop/tablet/mobile), *when* run, *then* layout and function are verified or issues logged."),
   S("Triage + fix findings loop",3,"1d 4h","founder","a loop to triage and fix the issues found",
     "findings turn into fixes rather than a dormant list.",
     "* *Given* logged findings, *when* triaged, *then* each becomes a prioritised bug ticket and is resolved or deferred with rationale."),
 ]},
{"label":"discipline:qa","summary":"Accessibility Audit (WCAG)",
 "desc":edesc("user relying on assistive technology (low-vision, keyboard, screen-reader)","CRANIS2 to meet WCAG 2.2 AA",
   "the platform is usable by everyone and acceptable to public-sector and enterprise buyers.",
   "A full accessibility pass: audit key flows against WCAG 2.2 AA, remediate findings (contrast, focus order, ARIA, keyboard nav), and add automated a11y checks to CI/E2E. Builds on the existing hover-grow/focus work.",
   "* *Given* the key flows, *when* audited and remediated, *then* they meet WCAG 2.2 AA and automated checks guard against regressions.",
   "* WCAG 2.2 AA audit of key flows\n* Remediate findings\n* Automated a11y checks in CI/E2E"),
 "children":[
   S("WCAG 2.2 AA audit of key flows",3,"2d","accessibility tester","an audit of the key flows against WCAG 2.2 AA",
     "I know exactly where the platform fails accessibility.",
     "* *Given* signup/dashboard/product/reports flows, *when* audited, *then* failures are listed against specific WCAG criteria with severity."),
   S("Remediate accessibility findings",5,"3d","frontend engineer","the audit findings remediated",
     "real users with assistive tech can use the platform.",
     "* *Given* the findings, *when* fixed, *then* contrast, focus order, ARIA labelling and keyboard navigation pass for the audited flows."),
   S("Automated accessibility checks in CI/E2E",2,"1d","engineer","automated a11y checks wired into CI / Playwright",
     "accessibility doesn't silently regress.",
     "* *Given* the E2E suite, *when* it runs, *then* automated a11y assertions (e.g. axe) gate the key pages."),
 ]},
# ===================== LEGAL / CORPORATE =====================
{"label":"discipline:legal","summary":"Corporate & Legal Foundation",
 "desc":edesc("owner of CRANIS2","the company's corporate, IP and legal foundations in place",
   "CRANIS2 can take revenue and investment on a sound, protected footing.",
   "Form the UK NewCo, pursue SEIS readiness, assign IP to the entity, register the trademark, arrange insurance, and prepare customer contract templates. (ICO registration is already tracked at CRAN-410.)",
   "* *Given* each item, *when* complete, *then* the corresponding legal/corporate foundation is in place and documented.",
   "* UK NewCo formation\n* SEIS advance assurance + investment readiness\n* IP assignment to the entity\n* Trademark registration (name + logo)\n* Professional-indemnity + cyber insurance\n* Customer MSA + DPA templates"),
 "children":[
   S("UK NewCo formation + structure",5,"3d","owner","the UK NewCo formed with an appropriate share/structure",
     "there is a corporate entity to hold the IP, take revenue and receive investment.",
     "* *Given* advice, *when* formed, *then* the company is incorporated with a share structure compatible with SEIS.",
     "Governing law for the product is already England & Wales for continuity with this planned NewCo."),
   S("SEIS advance assurance + investment readiness",5,"3d","owner","SEIS advance assurance and an investment-ready pack",
     "early investment can be raised tax-efficiently.",
     "* *Given* the NewCo, *when* SEIS is pursued, *then* advance assurance is obtained and an investor pack is prepared.",
     "See the seis_strategy memory."),
   S("IP assignment to the entity",2,"1d","owner","all CRANIS2 IP formally assigned to the NewCo",
     "the company unambiguously owns the product.",
     "* *Given* the NewCo, *when* IP is assigned, *then* code, brand and content are owned by the entity with a documented chain.",
     "The evidence locker (CRAN-359) supports the provenance chain."),
   S("Trademark registration (name + logo)",3,"2d","owner","the CRANIS2 name and logo registered as trademarks",
     "the brand is legally protected before wide public exposure.",
     "* *Given* the master logo (Brand & Asset Foundation), *when* filed, *then* word + figurative marks are registered in the relevant classes/territories."),
   S("Professional-indemnity + cyber insurance",2,"1d","owner","appropriate PI and cyber insurance in place",
     "the business is protected against liability and incident exposure.",
     "* *Given* the offering, *when* insured, *then* PI and cyber cover are bound at appropriate limits."),
   S("Customer MSA + DPA templates",3,"2d","owner","customer contract templates (MSA + DPA with CRANIS2 as processor)",
     "I can contract with customers compliantly and quickly.",
     "* *Given* the data flows, *when* drafted, *then* an MSA + a GDPR Art. 28 DPA (CRANIS2 as processor) are ready for customer signature.",
     "Distinct from the in-product DPA *generator* feature (CRAN-15)."),
 ]},
# ===================== FINANCE / OPS =====================
{"label":"discipline:ops","summary":"Finance & Tax Operations",
 "desc":edesc("owner of CRANIS2","finance and tax operations set up correctly",
   "I bill compliantly across the EU and understand the company's runway and unit economics.",
   "Handle EU VAT/OSS for cross-border SaaS, build a financial model + runway view, set up invoicing/revenue ops once Stripe is live, and stand up a KPI dashboard.",
   "* *Given* a sale in any EU member state, *when* billed, *then* VAT is handled correctly; *given* the month, *then* MRR/churn/runway are visible.",
   "* EU VAT / OSS registration + handling\n* Financial model + runway\n* Invoicing + revenue ops (Stripe live)\n* KPI / metrics dashboard"),
 "children":[
   S("EU VAT / OSS registration + handling",5,"3d","owner","EU VAT handled via OSS for cross-border SaaS sales",
     "I'm compliant with VAT on B2B/B2C sales across member states from day one of revenue.",
     "* *Given* a sale into an EU member state, *when* invoiced, *then* the correct VAT treatment (reverse-charge B2B / OSS B2C) is applied and recorded.",
     "Easy to overlook for an EU-selling SaaS; verify alongside Stripe Tax settings."),
   S("Financial model + runway",3,"2d","owner","a financial model with runway and unit economics",
     "I can make spend and pricing decisions with visibility.",
     "* *Given* costs + pricing, *when* modelled, *then* runway, CAC/LTV and break-even are projected."),
   S("Invoicing + revenue operations",2,"1d","owner","invoicing and revenue operations running once Stripe is live",
     "customers are billed and revenue is recognised cleanly.",
     "* *Given* live Stripe (CRAN-408), *when* a customer subscribes, *then* invoices issue and revenue is reconciled.",
     "Depends on Stripe live keys (CRAN-408)."),
   S("KPI / metrics dashboard",3,"1d 4h","owner","a KPI dashboard for the business metrics",
     "I track the health of the business at a glance.",
     "* *Given* billing + usage data, *when* the dashboard renders, *then* MRR, churn, signups and conversion are visible.",
     "The admin analytics page (CRAN-191) covers platform internals; this is business-level."),
 ]},
]

created_epics = []; created_stories = 0; failures = []
for ep in EPICS:
    fields = {"project":{"key":"CRAN"},"issuetype":{"name":"Epic"},"summary":ep["summary"],
              "description":ep["desc"],"labels":["outstanding",ep["label"]]}
    c, b = req("POST","/rest/api/2/issue",{"fields":fields})
    if c not in (200,201):
        failures.append(f"EPIC {ep['summary']}: {c} {b[:160]}"); print(f"FAILED EPIC {ep['summary']}: {c} {b[:160]}"); continue
    ekey = json.loads(b)["key"]; created_epics.append((ekey, ep["summary"]))
    print(f"EPIC {ekey}  {ep['summary']}")
    for st in ep["children"]:
        sf = {"project":{"key":"CRAN"},"issuetype":{"name":"Story"},"summary":st["summary"],
              "description":st["desc"],"parent":{"key":ekey},
              "labels":["outstanding",ep["label"]]+st.get("labels",[])}
        c2, b2 = req("POST","/rest/api/2/issue",{"fields":sf})
        if c2 not in (200,201):
            failures.append(f"STORY {st['summary']}: {c2} {b2[:120]}"); print(f"  FAILED {st['summary']}: {c2} {b2[:120]}"); continue
        skey = json.loads(b2)["key"]; created_stories += 1
        ed = settable(skey); ef = {}
        if "customfield_10016" in ed and st.get("points") is not None: ef["customfield_10016"]=st["points"]
        if "timetracking" in ed and st.get("effort"): ef["timetracking"]={"originalEstimate":st["effort"]}
        if ef: req("PUT", f"/rest/api/2/issue/{skey}", {"fields":ef})
        print(f"  {skey}  {st['points']}pt/{st['effort']:5}  {st['summary'][:48]}")

print(f"\n=== {len(created_epics)} epics, {created_stories} stories created ===")
if failures: print("FAILURES:\n" + "\n".join(failures))
