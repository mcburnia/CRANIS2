<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Release migrations & promotion assessments

This directory holds the **per-release evidence** required by the promotion
process — see [`docs/promotion-process.md`](../docs/promotion-process.md) §6.

For every promotion (even a zero-change one) two files are committed,
sharing the release slug:

```
migrations/release-YYYY-MM-DD-<slug>.md     ← assessment document (hand-written, signed off)
migrations/release-YYYY-MM-DD-<slug>.sql    ← migration script (transaction-wrapped, idempotent)
```

The git **tag** for the same release is `prod-release-YYYY-MM-DD-<slug>`
(the file slug is the tag with the leading `prod-` removed).

## Rules (enforced by `scripts/promote-to-prod.sh`)

- **Both files must exist.** A release with no data transformation still
  needs a no-op `.sql` stub plus an `.md` justifying why none was required.
- **The `.md` must carry the sign-off line** — literally:
  `Assessed and approved for promotion: <date> — Andi MCBURNIE`.
- **The `.sql` must be `BEGIN; … COMMIT;`-wrapped, idempotent, forward-only**,
  and must record itself in `schema_migrations` (§6.3). The promoter dry-runs
  it twice against a dev scratch DB to prove idempotency.
- **Customer-data invariant (CLAUDE.md rule 14):** no `DROP`, `DELETE`,
  `TRUNCATE`, or destructive `ALTER` of customer-owned tables. Removal of an
  old shape is a separate, later release once the new path is verified.

## Producing a release

Follow `docs/promotion-process.md` §6.4. In short: tag the candidate on dev,
take a fresh prod backup, restore it into `cranis2_promotion_test`, run
`scripts/generate-schema-diff.sh`, classify every change, write the `.md` and
`.sql` from the templates below, dry-run, capture evidence, sign off, commit.

Templates: [`_template.md`](_template.md) · [`_template.sql`](_template.sql)
