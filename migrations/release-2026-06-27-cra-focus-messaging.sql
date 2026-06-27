-- Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
-- SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
--
-- Release 2026-06-27 — cra-focus-messaging
--
-- NO-OP. This release makes NO schema or data change on prod. It promotes
-- frontend messaging copy, documentation, and staging-only deploy tooling.
-- The only backend/src/db/pool.ts change in range corrects a guarded seed
-- INSERT (category_thresholds.is_locked) that does not run on a populated
-- database, so there is nothing to migrate. Idempotent, forward-only,
-- transaction-wrapped. No customer data is altered (CLAUDE.md rule 14).
--
-- The recorded checksum below is the sha256 of the signed assessment
-- (release-2026-06-27-cra-focus-messaging.md) that authorises this release.

BEGIN;

-- Record this release (idempotent). No transformation precedes it.
INSERT INTO schema_migrations (id, applied_at, checksum)
VALUES ('release-2026-06-27-cra-focus-messaging', NOW(), 'sha256:18ea6245b15e5c8cd5a7b7ff26e90e02354476b99647fe7bf138a8fce20fb7d0')
ON CONFLICT (id) DO NOTHING;

COMMIT;
