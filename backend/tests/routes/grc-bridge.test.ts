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
 * GRC/OSCAL Bridge — Integration Tests
 *
 * Tests:
 *   GET /api/grc-bridge/ – Currently parked (stub)
 */

import { describe, it, expect } from 'vitest';
import { api } from '../setup/test-helpers.js';

describe('GET /api/integrations/grc', () => {
  it('returns parked status', async () => {
    const res = await api.get('/api/integrations/grc');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('parked');
  });
});
