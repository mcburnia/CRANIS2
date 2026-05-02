/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Vitest setupFiles — runs in each worker/fork before its test file.
 *
 * Lightweight: only handles connection cleanup after each file finishes.
 * Heavy work (seeding, rate-limit cleanup) is in globalSetup.
 */

import { afterAll } from 'vitest';
import { closeAllConnections, clearTokenCache } from './test-helpers.js';

afterAll(async () => {
  clearTokenCache();
  await closeAllConnections();
});
