-- Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
-- SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
--
-- This file is part of CRANIS2 — a personally-owned, personally-funded
-- software product. Unauthorised copying, modification, distribution,
-- or commercial use is prohibited. For licence enquiries:
-- andi.mcburnie@gmail.com

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
