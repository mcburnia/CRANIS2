# CRANIS2 — Operations & Succession Documentation

This directory is the operator handbook for CRANIS2. It is the document set someone needs in order to keep the platform running, look after customers, and protect the business — particularly if the founder is unavailable.

It is **not** a product or marketing document set. For product capability, see `docs/EXECUTIVE-SUMMARY.md`, `docs/HLD.md`, `docs/LLD.md` and `docs/USER-GUIDE.md`.

---

## Who this is for

| Reader | Likely starting point |
|---|---|
| A new technical operator who has just inherited the system | `01-architecture.md`, then `03-daily-operations.md`, then `05-incident-response.md` |
| A director who needs a non-technical overview of what they own | `08-business-continuity.md`, then `01-architecture.md` |
| Someone opening this for the first time after the founder is no longer available | **`99-succession.md` first**, in full, before doing anything else |
| An on-call operator dealing with an active incident | `05-incident-response.md` |

---

## Document set

| File | Purpose | Audience |
|---|---|---|
| `README.md` | This index | Everyone |
| `01-architecture.md` | Where everything lives — servers, services, ports, data flow, dependencies | Technical operator |
| `02-accounts-and-access.md` | Every third-party account, who holds it, how to recover it | Technical operator + director |
| `03-daily-operations.md` | What to check daily / weekly / monthly to keep things healthy | Technical operator |
| `04-deployment.md` | How to ship a change to production, and how to roll one back | Technical operator |
| `05-incident-response.md` | When something breaks: triage, runbooks, escalation | On-call operator |
| `06-security-and-keys.md` | Secret management, key rotation cadence, USB escrow | Technical operator |
| `07-customer-care.md` | Customer support, GDPR requests, communication, SLA expectations | Director + support operator |
| `08-business-continuity.md` | Company, legal, accountant, insurance, statutory deadlines | Director |
| `99-succession.md` | The "if I'm not around" document — written for the founder's family/successors | Successors |

Documents 02 and 99 will reference a **secure companion file** (see below) for the values that should not be in this public repository.

---

## The secure companion file

This documentation set lives in the public CRANIS2 git repository on GitHub. Anything in here is, in effect, public. Sensitive operational content — account credentials, recovery emails, the location of the USB escrow stick, names and contact details of the solicitor, accountant, banker, key customers — must **not** be committed here.

Those values live in a single companion file called **`OPERATIONS-SECURE.md`**, which is **not** in the git repository. It is held only in:

1. The USB escrow stick kept in the founder's safe (and a sealed copy with the solicitor — see `99-succession.md`).
2. The founder's password-manager vault.
3. (Optionally) on the dev server at a location named in the secure file itself.

The committed documents in this directory contain placeholders such as `[see OPERATIONS-SECURE: <key>]`. The secure file resolves those placeholders.

**If you are reading this and you do not have access to the secure companion file, stop and read `99-succession.md` — it explains how to obtain it.**

---

## Operating principles for this documentation

These rules apply every time any document in this directory is updated:

1. **The repository docs describe procedures, structure, and decision rules.** They never contain credentials, customer-identifying details, or supplier names that would not appear on a public website.
2. **The secure companion file resolves placeholders.** It is a single flat reference document — values keyed by name — not a runbook.
3. **British English.** Spelling and phrasing follow `docs/EDITORIAL-STANDARD.md`.
4. **Update in the same change.** If a procedure changes (a key location moves, a third-party supplier changes, a script is renamed), the relevant document here is updated in the same git commit as the underlying change. Stale ops docs are dangerous.
5. **Cross-reference, don't duplicate.** The deeper operational documents (`docs/backup-retention.md`, `docs/key-rotation.md`, `docs/upgrade-and-patching.md`) remain authoritative for their topics. Files in this directory link out to them; they do not copy their content.

---

## Document maturity (as of 2026-05-01)

This documentation set is being created in phases. Current state:

| Document | Status |
|---|---|
| `README.md` | Draft v1 |
| `01-architecture.md` | Draft v1 |
| `99-succession.md` | Draft v1 — needs founder to fill in personal-detail placeholders |
| `02-accounts-and-access.md` | Not yet written |
| `03-daily-operations.md` | Not yet written |
| `04-deployment.md` | Not yet written |
| `05-incident-response.md` | Not yet written |
| `06-security-and-keys.md` | Not yet written |
| `07-customer-care.md` | Not yet written |
| `08-business-continuity.md` | Not yet written |

The remaining documents will be added in follow-on sessions. The order above is the priority order: accounts and security first (highest risk if the founder vanishes), then daily operations, deployment, incident response, customer care, and business continuity.
