-- Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
-- SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
--
-- Release migration template — copy to migrations/release-YYYY-MM-DD-<slug>.sql
--
-- Requirements (docs/promotion-process.md §6.3):
--   * Transaction-wrapped: BEGIN; … COMMIT; (a failure leaves the DB unchanged).
--   * Idempotent: re-running is a no-op (WHERE … IS NULL, ON CONFLICT DO NOTHING…).
--   * Forward-only: no down-migrations. Rollback is by backup restore (§8).
--   * Records itself in schema_migrations.
--   * NEVER drops/deletes/truncates customer data (CLAUDE.md rule 14).
--
-- For a zero-change release, keep only the schema_migrations INSERT below
-- (the no-op stub) and justify "no transformation required" in the .md.

BEGIN;

-- ── Transformational changes go here (omit for a no-op release) ──
-- Example (idempotent backfill):
--   UPDATE products
--      SET cra_category_v2 = CASE cra_category
--          WHEN 'class_i' THEN 'important_i'
--          ELSE 'default'
--      END
--    WHERE cra_category_v2 IS NULL;

-- ── Record this release (idempotent) ──
INSERT INTO schema_migrations (id, applied_at, checksum)
VALUES ('release-YYYY-MM-DD-<slug>', NOW(), 'sha256:<fill-in>')
ON CONFLICT (id) DO NOTHING;

COMMIT;
