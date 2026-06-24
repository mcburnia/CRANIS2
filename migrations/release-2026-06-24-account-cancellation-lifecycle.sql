-- Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
-- SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
--
-- Release 2026-06-24 — account-cancellation-lifecycle
--
-- ADDITIVE ONLY. Mirrors initDb() exactly, so it is a no-op on any backend
-- that has already booted the release code. Idempotent, forward-only,
-- transaction-wrapped. No customer data is altered (CLAUDE.md rule 14).

BEGIN;

-- Lifecycle email dedup tracking — one row per (org, stage) guarantees each
-- lifecycle email is sent exactly once across restarts.
CREATE TABLE IF NOT EXISTS lifecycle_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      VARCHAR(255) NOT NULL,
  email_type  VARCHAR(40) NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, email_type)
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_emails_org ON lifecycle_emails(org_id);

-- GDPR opt-out / forget-me state on org_billing (all defaulted or nullable).
ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS forget_token UUID;
ALTER TABLE org_billing ADD COLUMN IF NOT EXISTS forgotten_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_billing_forget_token ON org_billing(forget_token) WHERE forget_token IS NOT NULL;

-- Record this release (idempotent).
INSERT INTO schema_migrations (id, applied_at, checksum)
VALUES ('release-2026-06-24-account-cancellation-lifecycle', NOW(), 'sha256:251bfb76dda085f5e05e976a38af0355aca21b29a3b901807ba2ec0a2a060e6d')
ON CONFLICT (id) DO NOTHING;

COMMIT;
