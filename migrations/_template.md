# Release YYYY-MM-DD — <slug>

Commit range: <prev-prod-commit>..<release-commit>
Tag: prod-release-YYYY-MM-DD-<slug>

## Schema diff
<!-- Paste the annotated output of scripts/generate-schema-diff.sh here. -->

## Change classification
<!-- Tag EVERY change as exactly one of: -->
- Additive: <new tables / nullable columns / indexes — no data work>
- Transformational: <backfills / splits / semantic changes — needs the .sql below>
- Rule-14 violations: NONE   <!-- if any exist, STOP and rework the release -->

## Affected prod tables
<!-- For each transformational change: prod table + estimated rows (queried read-only). -->
- <table> — <N> rows on prod as of <UTC timestamp>.

## Migration plan
<!-- Prose: what each transformation does, what it preserves, what it touches,
     what could go wrong, how it rolls back. -->

## Test evidence
- Fixture: prod backup <timestamp> (SHA: <…>)
- Before: <row counts / sampled records>
- After:  <row counts / distribution / sampled records>
- Anomalies: <none / …>

## Rollback
<!-- Always backup-restore, never reverse-migration (§8). -->

Assessed and approved for promotion: YYYY-MM-DD — Andi MCBURNIE
