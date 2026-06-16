<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — Promotion Process (Dev → Prod)

This document describes how changes move from the development environment to production. **Treat it as part of the operational runbook and as product training material.** It is the single source of truth for how a release reaches customers, and it must be kept current — if any step, script, or gate changes, update this file in the same commit.

---

## 1. Purpose

CRANIS2 holds real customer data: organisations, products, SBOMs, vulnerability findings, technical files, billing records, audit evidence. A failed or careless production update could lose, corrupt, or expose that data. The promotion process exists to make every release a **deliberate, reversible, evidenced** action — never an ad-hoc push.

The process is built around three principles:

1. **Dev is the source of truth.** Every change — code, schema, configuration shape — originates and is validated on dev before any prod movement.
2. **Promotion is a discrete event.** It happens at controlled checkpoints, not continuously. Each promotion is named, documented, and signed off.
3. **Customer data is sacred.** No promotion may drop, delete, truncate, or destructure customer data. (See CLAUDE.md rule 14 — the customer-data invariant.)

---

## 2. The promotion model

Development happens continuously on the `main` branch in the dev environment. At points where dev is in a state we are happy with, we **promote** that state to prod via a defined, gated process.

```
   DEV (dev.cranis2.dev)                              PROD (cranis2.com)
   ┌────────────────────────┐                         ┌────────────────────────┐
   │  continuous changes    │                         │  customer-facing       │
   │  on main branch        │   ── promotion ──▶      │  stable releases       │
   │  validated by tests    │   (gated, evidenced)    │  real customer data    │
   └────────────────────────┘                         └────────────────────────┘
```

Promotion is **not** a `git push` followed by a hope that everything works. It is a sequence of gates, each of which can block the release if anything is off.

---

## 3. What promotes and what does not

Not everything in dev should appear on prod. The promotion model only moves **shape**, never **data or environment-specific values**.

| Item | Promoted? | Mechanism |
|---|---|---|
| Application code | **Yes** | `git pull` on prod + `docker compose up -d --build` |
| Database schema (DDL) | **Yes** | `initDb()` in `backend/src/db/pool.ts` runs at backend startup, idempotently |
| Static config keys | **Yes** | `.env.example` documents the keys; prod has its own values |
| Cron schedules / background jobs | **Yes** | Defined in code, deployed with the release |
| Feature-flag definitions | **Yes** | Defined in code; per-env values are not |
| Secrets and env values | **No** | Prod has its own Stripe keys, Resend domain, OAuth secrets |
| `platform_settings` row values | **Partial** | Operational defaults match; per-env URLs and IDs do not |
| Customer data | **Never** | Prod's `users`, `products`, `product_sboms`, vulnerability tables, `technical_file_sections`, `obligations`, `org_billing`, `affiliate_*`, etc. are sacred |
| Neo4j graph data | **Never** | Same as above — prod's graph is owned by customers |
| Dev test fixtures | **Never** | Test orgs, seed data, dev-only Forgejo connections do not appear on prod |

If you find yourself wanting to copy data from dev to prod, **stop**. The flow is always the other direction (prod backup → dev replica for testing), never the reverse.

---

## 4. The customer-data floor (CLAUDE.md rule 14)

Every promotion must respect the customer-data invariant:

> **Production updates must NEVER:**
> - `DROP` a column or table
> - `DELETE` rows from a customer-owned table
> - `TRUNCATE` data tables
> - Remove a foreign key that data depends on

The promotion process enforces this by inspecting every proposed schema change and migration script before promotion. A change that would remove or destructure customer data is rejected at the assessment gate (§6) — it must be reworked, typically as a two-release sequence (release N adds the new shape and backfills; release N+1, only after the new path is verified, removes the old).

---

## 5. Schema as single source of truth (CLAUDE.md rule 13)

All Postgres schema lives in `backend/src/db/pool.ts initDb()`, expressed with idempotent guards:

- `CREATE TABLE IF NOT EXISTS …`
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`
- `CREATE INDEX IF NOT EXISTS …`

Hand-patched DDL on a running database is forbidden — past incidents (the affiliate-programme schema mismatch) have shown that ad-hoc dev edits break clean deployments. If a schema change has no corresponding commit to `initDb()`, it does not exist as far as the promotion process is concerned.

`initDb()` handles **additive shape changes** safely: new tables, new nullable columns, new indexes. Existing customer data continues to work unchanged.

What `initDb()` **cannot** express is **data transformations**: backfilling a new column, splitting one column into two, adding a unique constraint where duplicates may exist, moving rows between tables, changing column semantics. These need an explicit migration script, governed by the assessment gate below.

---

## 6. The migration assessment gate

**No promotion proceeds without a committed, signed-off migration assessment.** This is the central safety gate of the promotion process.

### 6.1 What the assessment is

For each release, two files are committed to the repository:

```
migrations/release-YYYY-MM-DD-<slug>.md     ← the assessment document
migrations/release-YYYY-MM-DD-<slug>.sql    ← the bespoke migration script
```

Both files share the release slug. Both must exist for the gate to pass — even a release with zero data transformations still produces both files, with the `.sql` being a no-op stub that records the release in `schema_migrations` and the `.md` justifying why no transformation was needed.

### 6.2 The assessment document

The `.md` file is hand-written and contains:

1. **Release identity** — date, release tag, commit range covered.
2. **Schema diff** — auto-generated diff between current prod schema and release-candidate dev schema, hand-reviewed and annotated.
3. **Change classification** — every change tagged as one of:
   - **Additive** (no data work required)
   - **Transformational** (needs migration script)
   - **Rule-14 violation** (rejected — must be reworked before promotion)
4. **Affected prod tables** — for each transformational change, the prod tables touched and the estimated number of rows affected (queried from prod read-only).
5. **Migration plan in prose** — what each transformation does, what it preserves, what it touches, what could go wrong, how it rolls back.
6. **Test evidence** — SHA of the prod backup used as the test fixture, before/after row counts, sampled spot-check records, any anomalies observed.
7. **Sign-off line** — a literal line: `Assessed and approved for promotion: <date> — Andi MCBURNIE`. The promotion script will not run without this line.

### 6.3 The migration script

The `.sql` file is bespoke per release. Requirements:

- **Transaction-wrapped** — `BEGIN; … COMMIT;` so a failure leaves the database in its prior state.
- **Idempotent** — re-running the script is a no-op. Use `WHERE … IS NULL` guards, `ON CONFLICT DO NOTHING`, or feature checks.
- **Forward-only** — no down-migrations. Rollback is by backup restore, not by reversing the script. (Rule 14 makes most automated rollbacks unsafe anyway.)
- **Records itself** — the final statement inserts a row into `schema_migrations` (`id`, `applied_at`, `checksum`) so the runner knows it has been applied.

### 6.4 The dev-side workflow that produces the assessment

```
1. Tag the release candidate on dev.
2. Take a fresh prod backup (./scripts/backup-databases.sh --pre-upgrade).
3. Restore that backup into a throwaway cranis2_promotion_test database on dev.
4. Run scripts/generate-schema-diff.sh against the restored backup and current dev.
5. Hand-review the diff; classify every change.
6. If any change is a rule-14 violation, abort — rework the release.
7. Write the assessment .md and the migration .sql.
8. Apply the .sql against cranis2_promotion_test inside a transaction.
9. Capture before/after evidence (row counts, sampled records, checksums).
10. Sign off the assessment.
11. Commit both files alongside the release tag.
```

This workflow is what produces the evidence. The promotion gate only checks that the evidence exists and is internally consistent — it does not re-do the work.

---

## 7. The promotion runbook

Once the assessment is committed and signed off, promotion proceeds as follows. The runbook is implemented as `scripts/promote-to-prod.sh`; this section is the human-readable specification of what that script does.

### Step 1 — Pre-flight gates

Before any prod change, the script verifies:

- Working tree is clean on `main` and matches the release tag.
- `migrations/release-<tag>.md` exists and contains the signed sign-off line.
- `migrations/release-<tag>.sql` exists.
- The operator has supplied `--assessment-sha=<sha>` and `--script-sha=<sha>` flags that match the SHAs of the committed files (forces the operator to look at the files, not rubber-stamp).
- Prod `/api/health` returns 200 (a healthy starting state).
- Disk space on prod is sufficient for a full backup.

Any failure here aborts before touching prod.

### Step 2 — Pre-promotion backup (CLAUDE.md rule 12)

```
ssh prod './scripts/backup-databases.sh --pre-upgrade'
```

The script waits for "BACKUP COMPLETE" before proceeding. The backup directory and timestamp are recorded for the rollback path.

### Step 3 — Dry-run the migration

The migration script is executed against a freshly restored copy of the just-taken backup on dev (`cranis2_promotion_test`). Row counts and checksums on critical tables are compared against the values recorded in the assessment document. Any divergence aborts the promotion.

### Step 4 — Deploy code to prod

```
ssh prod 'cd ~/cranis2 && git pull && docker compose up -d --build'
```

This recreates the backend container with the new image. On startup the backend runs `initDb()`, which applies any additive schema changes idempotently.

### Step 5 — Apply the migration script

```
ssh prod 'docker exec cranis2_postgres psql -U cranis2 -d cranis2 -f /migrations/release-<tag>.sql'
```

The script runs inside its own transaction. On success, it inserts a row into `schema_migrations` recording the release.

### Step 6 — Post-promotion verification

- `/api/health` returns 200.
- Row counts on critical tables (`users`, `products`, `product_sboms`, `org_billing`) match the pre-promotion values plus any expected delta from the migration script.
- A smoke-test request (e.g. an authenticated `GET /api/products`) returns expected data for a known test account.
- Application logs for the past five minutes contain no `ERROR` lines that did not exist before.

If any verification fails, proceed to rollback (§8).

### Step 7 — Tag and announce

- Tag the prod commit: `prod-release-YYYY-MM-DD-<slug>`.
- Update `RESTART.md` with the release summary and any operational notes.
- Notify customers if the release introduces user-visible changes.

---

## 8. Rollback path

A promotion is reversible up to the moment customer-visible writes begin landing against the new schema. The rollback path is **always backup restore, never reverse-migration** — automated down-migrations are unsafe under rule 14.

```
1. Stop the prod backend:
   ssh prod 'docker compose stop backend'

2. Restore the pre-promotion backup:
   ssh prod './scripts/restore-databases.sh <pre-promotion-timestamp>'

3. Redeploy the previous image tag:
   ssh prod 'cd ~/cranis2 && git checkout <previous-release-tag> && docker compose up -d --build backend'

4. Verify /api/health and a smoke-test request.

5. Investigate the failure on dev before attempting another promotion.
```

The rollback path itself must be exercised periodically — at minimum once per quarter, against a restored backup in a scratch environment — so we know it works before we need it.

---

## 9. Worked example — a transformational release

Suppose a release adds a `products.cra_category_v2` column to replace the legacy `cra_category` string with a normalised enum value, with a backfill from the existing data.

### `migrations/release-2026-06-01-cra-category-v2.md`

```markdown
# Release 2026-06-01 — cra_category_v2

Commit range: a1b2c3d..e4f5g6h
Tag: prod-release-2026-06-01-cra-category-v2

## Schema diff
- ADD COLUMN products.cra_category_v2 TEXT (idempotent in initDb())
- ADD INDEX idx_products_cra_category_v2

## Change classification
- Additive: cra_category_v2 column, index.
- Transformational: backfill cra_category_v2 from cra_category, normalising
  legacy values (class_i, category-1 → important_i, etc.).
- Rule-14 violations: NONE. The legacy cra_category column is preserved.

## Affected prod tables
- products — 1,247 rows on prod as of 2026-05-31 23:45 UTC.

## Migration plan
The migration script normalises legacy values and writes them to the new
column. The old column remains untouched. A future release (post-verification)
will remove the old column — that is a separate two-release sequence.

## Test evidence
- Fixture: prod backup 2026-05-31-2345 (SHA: …)
- Before: 1,247 rows, cra_category_v2 NULL in all.
- After: 1,247 rows, cra_category_v2 populated, distribution:
    default 412, important_i 503, important_ii 287, critical 45.
- Sampled 20 random rows — all mapped correctly.

## Rollback
If the new column causes problems, restore the pre-promotion backup and
redeploy the previous image. The new column will be re-created empty on
the next promotion attempt.

Assessed and approved for promotion: 2026-06-01 — Andi MCBURNIE
```

### `migrations/release-2026-06-01-cra-category-v2.sql`

```sql
BEGIN;

UPDATE products
   SET cra_category_v2 = CASE cra_category
       WHEN 'class_i'    THEN 'important_i'
       WHEN 'category-1' THEN 'important_i'
       WHEN 'class_ii'   THEN 'important_ii'
       WHEN 'category-2' THEN 'important_ii'
       WHEN 'critical'   THEN 'critical'
       ELSE 'default'
   END
 WHERE cra_category_v2 IS NULL;

INSERT INTO schema_migrations (id, applied_at, checksum)
VALUES ('release-2026-06-01-cra-category-v2', NOW(),
        'sha256:abcd1234...');

COMMIT;
```

This is the shape every transformational release follows: an assessment document explaining the intent and evidence, a script doing the bare minimum needed inside a transaction.

---

## 10. Implementation status

As of 2026-06-16, the following is **in place**:

- `backend/src/db/pool.ts initDb()` as the single source of truth for schema (CLAUDE.md rule 13).
- `schema_migrations` table in `initDb()` — ledger of applied release migrations (§6.3).
- Pre-promotion backups via `scripts/backup-databases.sh --pre-upgrade` (CLAUDE.md rule 12, see `docs/backup-retention.md`).
- Customer-data invariant codified (CLAUDE.md rule 14).
- `scripts/promote-to-prod.sh` — the gated dev-side orchestrator (§7), with a `--check` mode that runs every pre-flight gate without touching prod.
- `scripts/deploy-on-prod.sh` — the prod-side executor (clean-tree guard → checkout tag → rebuild → health → migration). Also the forced-command target for the Phase-2 restricted CI deploy key.
- `scripts/generate-schema-diff.sh` — schema-diff helper for the assessment (§6.4).
- `migrations/` directory with `README.md`, `_template.md`, `_template.sql`.

The following is **planned but not yet built**:

- A restricted forced-command dev→prod (and CI→prod) key whose only command is `deploy-on-prod.sh`, so promotion needs no general prod shell (Phase 2).
- GitHub Actions: automatic test/build on push/PR (CI), plus a manually-triggered, environment-approved promotion workflow (CD) that calls `promote-to-prod.sh` (Phase 1–2).
- A quarterly rollback rehearsal in a scratch environment.

This document describes the **target state**. Update it as the machinery is built so that the gap between the doc and reality is always visible.

---

## 11. Related documents

- `CLAUDE.md` — operating protocol; rules 12 (backup), 13 (schema source of truth), 14 (customer-data invariant) are all load-bearing for this process.
- `docs/backup-retention.md` — backup architecture, retention scheme, recovery procedures.
- `docs/backup-and-restore.md` — operational restore procedure.
- `docs/SDLC.md` — wider development lifecycle context.
- `RESTART.md` — running record of what is on prod.
