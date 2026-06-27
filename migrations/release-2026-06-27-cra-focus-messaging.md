# Release 2026-06-27 — cra-focus-messaging

Commit range: 7a712ff..568a88d
Tag: prod-release-2026-06-27-cra-focus-messaging

## Schema diff
No DDL changes. `scripts/generate-schema-diff.sh` over `7a712ff..568a88d`
yields an empty schema delta. The only `backend/src/db/pool.ts` change in range
(commit `b95a884`) corrects a **seed-data** INSERT — `category_thresholds`
gains the missing `is_locked` value — and touches no table, column, or index
structure.

## Change classification
- **Additive:** none requiring data work.
- **Code / content only:** frontend messaging copy (PR #12 — CRA positioned as
  the managed core; NIS2 as readiness + OSCAL export), documentation updates,
  pull-based staging auto-deploy tooling (`scripts/deploy-staging.sh`,
  `deploy/cranis2-staging-deploy.{service,timer}` — staging-only, inert on prod),
  and `.env.example`.
- **Seed fix (`b95a884`):** the `category_thresholds` seed gains its missing
  `is_locked` value. The seed block is guarded by `if (attrCount === 0)`; prod's
  category tables are already populated, so the block does not execute on prod —
  the fix is inert there (it only affects a from-scratch database).
- **Transformational:** NONE.
- **Rule-14 violations:** NONE.

## Affected prod tables
None. No customer-owned table is read for transformation or written.

## Migration plan
No data transformation required. The accompanying `.sql` is a no-op stub that
records the release in `schema_migrations`. Application code and the idempotent
`initDb()` deploy via the standard `git pull` + `docker compose up -d --build`
inside the gated promote script. `initDb()` makes no structural change for this
release.

## Test evidence
- Fixture: validated on dev and on staging (the same `main@568a88d`).
- Staging: `main@568a88d` auto-deployed to dev.cranis2.dev via the systemd
  timer; `/api/health` = 200; the corrected messaging was verified live in the
  served JS bundle (`/assets/index-*.js`).
- Fresh-DB init verified clean after the seed fix (4 attributes / 16 values /
  4 thresholds, no error) — confirms the only schema-path change is safe on an
  empty DB and inert on a populated one.
- CI green on every PR in range (#9–#12): backend typecheck + audit, frontend
  build + audit, welcome audit.
- Anomalies: none.

## Rollback
Backup-restore only (§8, forward-only — no reverse migration). The promote
script takes a fresh pre-promotion prod backup and gates on `BACKUP COMPLETE`
before any deploy; restoring that snapshot is the rollback path.

Assessed and approved for promotion: 2026-06-27 — Andi MCBURNIE
