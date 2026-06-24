# Release 2026-06-24 — account-cancellation-lifecycle

Commit range: aa4cb88..f63333a
Tag: prod-release-2026-06-24-account-cancellation-lifecycle

## Summary
Fixes the daily "trial ended" email spam and adds the missing self-service
account-cancellation UI, a redesigned trial→lapse→win-back email lifecycle,
and a GDPR "forget me" flow. See PR #7.

## Schema diff
New table + additive columns/indexes (mirrors initDb(), created idempotently):

```
+ TABLE lifecycle_emails (id, org_id, email_type, sent_at, UNIQUE(org_id,email_type))
+ INDEX idx_lifecycle_emails_org ON lifecycle_emails(org_id)
+ org_billing.do_not_contact  BOOLEAN NOT NULL DEFAULT FALSE
+ org_billing.forget_token    UUID
+ org_billing.forgotten_at    TIMESTAMPTZ
+ INDEX idx_org_billing_forget_token ON org_billing(forget_token) WHERE forget_token IS NOT NULL
```

## Change classification
- Additive: new `lifecycle_emails` table; three new `org_billing` columns
  (all defaulted or nullable); two new indexes. No data work.
- Transformational: NONE.
- Rule-14 violations: NONE. No DROP / DELETE / TRUNCATE / destructive ALTER.

## Affected prod tables
- `org_billing` — 5 rows on prod as of 2026-06-24 (read-only count). Columns
  added with defaults; existing rows get `do_not_contact = FALSE`, others NULL.
- `lifecycle_emails` — new, starts empty.

## Migration plan
The release `.sql` is additive and identical to what `initDb()` runs on backend
boot, so it is effectively a no-op confirmation once the new backend starts; it
exists to record the release in `schema_migrations` and to document the shape.
Nothing reads or rewrites existing customer data. The behavioural change (the
new lifecycle engine) is code-only and keyed off the new `lifecycle_emails`
dedup table, which starts empty — so on first run prod orgs simply enter the
correct stage with no backfill required.

Pre-existing prod state note: the 5 looping trial orgs were already moved out of
the buggy re-arm loop on 2026-06-24 via a reversible data fix (trial_ends_at
extended to 2026-12-21, grace_ends_at cleared). Under the new code these orgs
match no email stage until ~30 days before that date, so promotion sends nothing
on deploy.

## Test evidence
- Full Vitest suite on the isolated test stack: 2271 passed, 96 skipped, 1
  pre-existing `admin-system` health-stats timeout flake (passes 6/6 in
  isolation; unrelated to this change).
- 9 new `account-lifecycle` tests pass, including a spam-regression guard
  asserting no re-send and no grace re-arm across repeated lifecycle runs.
- Schema verified idempotent: applied via initDb on the test stack and the dev
  `cranis2` DB; re-running the release `.sql` is a no-op.

## Rollback
Backup-restore only (promotion-process.md §8). Pre-promotion pg_dump -Fc of
`cranis2` is taken by the promoter. The change is additive, so a code rollback
(redeploy prior image) leaves the new, unused columns/table harmless in place;
no schema reversal is required.

Assessed and approved for promotion: 2026-06-24 — Andi MCBURNIE
