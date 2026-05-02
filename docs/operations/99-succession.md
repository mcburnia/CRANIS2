<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CRANIS2 — Succession Plan

> **For:** The directors of Loman Cavendish Limited succeeding the founder, Andi McBurnie.
> **Open this if:** The founder is no longer available — through death, long-term incapacity, or absence — and you need to take responsibility for CRANIS2.
> **Otherwise:** Do not act on this document. It is a contingency, not an operating procedure.

---

## A note from the founder

> *[FILL IN: Personal note from Andi to his sons. This section is intentionally left for the founder to write in his own words. It might cover: why CRANIS2 matters, what he hopes they'll do, anything personal he wants them to read at this moment. Keep separate from the operational content below — that part stays factual and doesn't need a personal voice.]*

---

## Stop and read this section before doing anything

You are about to inherit a live SaaS platform with paying customers and customer data covered by GDPR and the EU Cyber Resilience Act. There are things you must not do in the first 48 hours, no matter how stressful this moment is:

1. **Do not delete anything.** Not customer accounts, not a database, not a backup, not a virtual machine, not an email account, not a domain. If something looks wrong, leave it alone and read on.
2. **Do not turn the production server off.** It is at `cranis2.com`, hosted at Infomaniak. Customers depend on it. If it is running when you start, leave it running.
3. **Do not cancel the bank cards or the company credit card immediately.** Several services renew automatically (the domain, the VPS, Cloudflare, Stripe payouts, email sending, Anthropic). If those payments fail, the platform breaks. The first job is to transfer billing authority, not to stop it.
4. **Do not announce anything to customers** until you have read sections 1-4 below and understand what you are saying.
5. **Do not sell, transfer, or wind up the company in the first 30 days.** You almost certainly do not have all the information you need yet, and any of those decisions are reversible only at significant cost.

If you do nothing else, follow those five rules. Everything below is detail.

---

## The order of priority

When two things are in tension, prioritise in this order:

1. **Customer service stays up.** The platform must keep responding at `https://cranis2.com`. Customers paid for that.
2. **Customer data stays safe.** No deletion, no leak, no unauthorised access. The platform handles compliance evidence — losing it has reputational and legal consequences far beyond ours.
3. **The business stays solvent.** Bills get paid, statutory filings happen on time, employees (if any) get paid.
4. **The team's own wellbeing.** Take breaks. Sleep. This is a marathon, not a sprint.

Anything else (new features, marketing, partnerships, the founder's roadmap) waits until those four are stable.

---

## Where to find what you need

The companion file **`OPERATIONS-SECURE.md`** holds everything sensitive: passwords, account names, the location of the USB escrow stick, names and contact numbers of the solicitor and the accountant, the bank, customer contact information.

It is held in three places:

1. **A USB stick in the founder's safe.** Location of the safe: *[FILL IN: e.g. "the office at home, top right drawer of the filing cabinet, combination on a card in [father-in-law]'s safe"]*. Combination of the safe: *[FILL IN: where to find this — do NOT write the combination into this document]*.
2. **A sealed envelope held by the company solicitor.** Solicitor name: *[FILL IN]*. Firm: *[FILL IN]*. Phone: *[FILL IN]*. The envelope contains a printed copy of `OPERATIONS-SECURE.md` plus the age decryption key for the encrypted backup mirror.
3. **Founder's password manager.** Vault provider: *[FILL IN: e.g. "Bitwarden"]*. The master password is shared with you separately — see *[FILL IN: e.g. "the sealed letter the founder gave you when you became a director"]*.

If you cannot get into any of those three sources, contact the solicitor first (they have a sealed copy and a duty to release it to a director on production of a death certificate or appropriate authority).

---

## The first 24 hours

Goals: confirm the platform is running, secure access to the operator accounts, do not break anything.

1. **Confirm the platform is up.** Open `https://cranis2.com` in a browser. You should see the landing page. Open `https://cranis2.com/api/health` — it should return a JSON response with `"status":"ok"`. If both work, the platform is serving customers.
2. **Get into the dev server.** This is the Mac Mini at the founder's home address. SSH access details are in `OPERATIONS-SECURE.md`. From the dev server you can read everything in this repository and the operational scripts.
3. **Get into the production server.** Production is at Infomaniak (IP and domain in `01-architecture.md`). The interactive SSH key is `~/.ssh/cranis2-prod` on the dev server, and it has a passphrase — the passphrase is in `OPERATIONS-SECURE.md`.
4. **Check the most recent backup ran.** On production: `tail ~/cranis2/logs/backup.log`. On dev: `ls ~/cranis2-backup-mirror/daily/ | tail -1`. Both should show a timestamp from within the last 24 hours.
5. **Do not change any passwords yet.** Read section "First week" before rotating anything.

If any of those four checks fail, go to `05-incident-response.md` for that specific issue rather than improvising.

---

## The first week

Goals: take ownership of every account, decide on direction, communicate appropriately.

1. **Read every document in this directory.** In order: `README.md`, `01-architecture.md`, `02-accounts-and-access.md`, `03-daily-operations.md`, `04-deployment.md`, `05-incident-response.md`, `06-security-and-keys.md`, `07-customer-care.md`, `08-business-continuity.md`. This will take several hours.
2. **Inventory every account.** Use `02-accounts-and-access.md` as a checklist. For each one, log in successfully and confirm you can change the recovery email to one you control. This is your single most important administrative task.
3. **Rotate operational secrets you suspect could leak in this transition.** Sequence and procedure are in `06-security-and-keys.md`. Do not do this until step 2 is done — if you rotate a key before you have account access, you can lock yourself out.
4. **Speak to the company solicitor and accountant.** Both will have specific advice about the company's position and your obligations as inheriting directors. Names and contact details in `OPERATIONS-SECURE.md`.
5. **Do not announce anything publicly yet.** Continue routine operations. If a customer raises an issue, respond as the company has always responded — you do not need to disclose the change in management while you are still establishing what is happening.

---

## The first month

Goals: decide direction, communicate, stabilise.

By the end of week 4 you should have decided which of three paths CRANIS2 is on:

| Path | What it means | Trigger |
|---|---|---|
| **Continue** | You and your brother run the company between you, possibly with help from a hired technical lead. | You both have time and willingness; the financials look workable; you can hire to cover the technical gap. |
| **Sell** | You find a buyer — likely a CRA-adjacent compliance vendor or a consultancy — and transfer the company. | You don't have time, but the company has positive financials and customer goodwill. |
| **Wind down** | You give customers notice, return data, refund where appropriate, and close the company in good order. | The financials don't work, or no buyer can be found, or you both decide it isn't the right path. |

There is no shame in any of those three paths. The wrong path is to leave the platform running ungoverned for months — that is when customer trust and data integrity erode.

For each path, the legal route involves the solicitor; the customer-communication route involves `07-customer-care.md`. **Do not announce the path to customers before the solicitor has signed off on the wording.**

---

## Critical contacts

These belong in `OPERATIONS-SECURE.md`. Listed here as a checklist of *what* contacts you must have, not the values themselves.

| Role | Why you need them | Where the value lives |
|---|---|---|
| Solicitor | Legal advice on succession, customer comms, contract status | `OPERATIONS-SECURE: solicitor` |
| Accountant | Company finances, statutory filings, VAT, payroll | `OPERATIONS-SECURE: accountant` |
| Bank — relationship manager | Transfer signatory authority on company accounts | `OPERATIONS-SECURE: bank.contact` |
| Insurance broker | Notify of director change, confirm policy validity | `OPERATIONS-SECURE: insurance` |
| Infomaniak account manager | Production hosting | `OPERATIONS-SECURE: infomaniak` |
| Cloudflare account | DNS and tunnel for both prod and dev | `OPERATIONS-SECURE: cloudflare` |
| Domain registrar | `cranis2.com` and `cranis2.dev` ownership | `OPERATIONS-SECURE: domain` |
| Stripe | Customer payments, billing | `OPERATIONS-SECURE: stripe` |
| Resend | Outbound email (verifications, alerts, statements) | `OPERATIONS-SECURE: resend` |
| Anthropic | AI Copilot capability | `OPERATIONS-SECURE: anthropic` |
| ICO | Data protection registration (£40/year, must be renewed) | `OPERATIONS-SECURE: ico` |

---

## What you must not do, ever

These rules are absolute. They protect customers and the business. Breaking any one of them creates either a regulatory incident or an unrecoverable data loss.

1. **Do not run any command that drops or deletes a customer-data table.** The customer-data invariant is documented in `CLAUDE.md` rule 14 and in `06-security-and-keys.md`. Schema migrations in this codebase only ever add or relax structure.
2. **Do not commit `.env` to git.** It contains every secret the platform uses.
3. **Do not run untested code on production.** The `04-deployment.md` document describes the safe deployment path: build → test → push → deploy → verify health. There are no shortcuts.
4. **Do not delete a backup before verifying its successor exists.** GFS retention is automatic; if you find yourself manually deleting backups, stop.
5. **Do not bypass the secure companion file.** If a credential isn't in `OPERATIONS-SECURE.md` and you need it, work out where it should be added — don't hard-code it into a committed document or paste it into chat.
6. **Do not make announcements without legal review** if you are changing direction (sale, wind-down, scope change).

---

## Where to read next

Once you have stabilised — meaning the platform is up, you have account access, and you've spoken to the solicitor and accountant — return to `README.md` and follow the document set in order. The rest of this directory is your operating manual.

Take your time. Customers are tolerant of slow change much more than they are tolerant of mistakes.

---

*Last updated: 2026-05-01 (v1 draft, awaiting founder fill-in of personal sections and contact details).*
