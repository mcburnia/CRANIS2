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
 * Bonus Code Route Tests — /api/bonus-code/validate
 *
 * Public, unauthenticated endpoint used by the signup form to validate a
 * code before submission. Case-insensitive, returns canonical form +
 * affiliate display name.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getAppPool } from '../setup/test-helpers.js';
import { randomUUID } from 'crypto';

describe('/api/bonus-code', () => {
  const testCode = `BCTEST${Math.floor(Math.random() * 100000)}`;
  let affiliateId: string;
  const disabledCode = `BCDIS${Math.floor(Math.random() * 100000)}`;
  let disabledId: string;

  beforeAll(async () => {
    const pool = getAppPool();
    affiliateId = randomUUID();
    await pool.query(
      `INSERT INTO affiliates (id, bonus_code, display_name, contact_email, commission_rate, enabled)
       VALUES ($1, $2, 'BC Test Affiliate', 'bc-test@example.com', 0.20, TRUE)`,
      [affiliateId, testCode]
    );
    disabledId = randomUUID();
    await pool.query(
      `INSERT INTO affiliates (id, bonus_code, display_name, contact_email, commission_rate, enabled)
       VALUES ($1, $2, 'Disabled Affiliate', 'bc-dis@example.com', 0.20, FALSE)`,
      [disabledId, disabledCode]
    );
  });

  afterAll(async () => {
    const pool = getAppPool();
    await pool.query(`DELETE FROM affiliates WHERE id = ANY($1)`, [[affiliateId, disabledId]]);
  });

  describe('GET /api/bonus-code/validate', () => {
    it('returns 400 when code missing', async () => {
      const res = await api.get('/api/bonus-code/validate');
      expect(res.status).toBe(400);
    });

    it('returns valid:false for unknown code', async () => {
      const res = await api.get('/api/bonus-code/validate?code=NEVERHEARDOFTHIS');
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('returns valid:true with canonicalCode and displayName for valid code', async () => {
      const res = await api.get(`/api/bonus-code/validate?code=${testCode}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.canonicalCode).toBe(testCode);
      expect(res.body.displayName).toBe('BC Test Affiliate');
    });

    it('matches case-insensitively', async () => {
      const res = await api.get(`/api/bonus-code/validate?code=${testCode.toLowerCase()}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.canonicalCode).toBe(testCode);
    });

    it('rejects disabled affiliates', async () => {
      const res = await api.get(`/api/bonus-code/validate?code=${disabledCode}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('reveals only display name (no contact email or rate)', async () => {
      const res = await api.get(`/api/bonus-code/validate?code=${testCode}`);
      expect(res.body.contactEmail).toBeUndefined();
      expect(res.body.commissionRate).toBeUndefined();
      expect(res.body.id).toBeUndefined();
    });
  });
});
