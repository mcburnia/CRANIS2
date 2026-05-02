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
 * Integration Test: Role-Specific Obligations
 *
 * Verifies that different economic operator roles (manufacturer, importer,
 * distributor) receive the correct CRA obligation sets when viewing their
 * products. This is the backend equivalent of the E2E role-aware obligations
 * acceptance test.
 *
 * Key assertions:
 * - Manufacturer (Art. 13) — no Art. 18/19 obligations
 * - Importer (Art. 18) — exactly 10 obligations, no Art. 19
 * - Distributor (Art. 19) — exactly 6 obligations, no Art. 18
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Role-Specific Obligations', () => {
  let mfgToken: string;
  let impToken: string;
  let distToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
    distToken = await loginTestUser(TEST_USERS.distAdmin);
  });

  // ─── Manufacturer — Art. 13 ─────────────────────────────────────────

  describe('Manufacturer obligations (Art. 13)', () => {
    it('should return Art. 13 obligations for manufacturer product', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);

      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );

      // Should contain manufacturer obligations
      expect(keys).toContain('art_13');
      expect(keys).toContain('art_13_6');
      expect(keys).toContain('art_13_11');
      expect(keys).toContain('art_13_12');
      expect(keys).toContain('art_14');
      expect(keys).toContain('annex_i_part_i');
      expect(keys).toContain('annex_i_part_ii');
    });

    it('should NOT contain importer or distributor obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: mfgToken });
      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );

      expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
      expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
    });

    it('should have at least 16 manufacturer obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.body.obligations.length).toBeGreaterThanOrEqual(16);
    });
  });

  // ─── Importer — Art. 18 ─────────────────────────────────────────────

  describe('Importer obligations (Art. 18)', () => {
    it('should return Art. 18 obligations for importer product', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.impGithub}`, { auth: impToken });
      expect(res.status).toBe(200);

      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );

      expect(keys).toContain('art_18_1');
      expect(keys).toContain('art_18_2');
      expect(keys).toContain('art_18_3');
      expect(keys).toContain('art_18_7');
      expect(keys).toContain('art_18_8');
      expect(keys).toContain('art_18_10');
    });

    it('should have exactly 10 importer obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.impGithub}`, { auth: impToken });
      const art18Keys = res.body.obligations
        .map((o: any) => o.obligationKey || o.obligation_key)
        .filter((k: string) => k.startsWith('art_18'));
      expect(art18Keys.length).toBe(10);
    });

    it('should NOT contain distributor obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.impGithub}`, { auth: impToken });
      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );
      expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
    });
  });

  // ─── Distributor — Art. 19 ──────────────────────────────────────────

  describe('Distributor obligations (Art. 19)', () => {
    it('should return Art. 19 obligations for distributor product', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.distGithub1}`, { auth: distToken });
      expect(res.status).toBe(200);

      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );

      expect(keys).toContain('art_19_1');
      expect(keys).toContain('art_19_2');
      expect(keys).toContain('art_19_4');
      expect(keys).toContain('art_19_5');
    });

    it('should have exactly 6 distributor obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.distGithub1}`, { auth: distToken });
      const art19Keys = res.body.obligations
        .map((o: any) => o.obligationKey || o.obligation_key)
        .filter((k: string) => k.startsWith('art_19'));
      expect(art19Keys.length).toBe(6);
    });

    it('should NOT contain importer obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.distGithub1}`, { auth: distToken });
      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );
      expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
    });
  });

  // ─── Cross-role isolation ───────────────────────────────────────────

  describe('Cross-role isolation', () => {
    it('should not allow manufacturer to access importer product obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.impGithub}`, { auth: mfgToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not allow importer to access manufacturer product obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not allow distributor to access manufacturer product obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: distToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not allow importer to access distributor product obligations', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.distGithub1}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Category-specific obligations ──────────────────────────────────

  describe('Category-specific obligations', () => {
    it('should include art_20 for critical-category products only', async () => {
      // github product is important_i — should NOT have art_20
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: mfgToken });
      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );
      // art_20 only applies to 'critical' category
      expect(keys).not.toContain('art_20');
    });

    it('should include harmonised standards obligation for all manufacturer products', async () => {
      const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, { auth: mfgToken });
      const keys: string[] = res.body.obligations.map(
        (o: any) => o.obligationKey || o.obligation_key
      );
      expect(keys).toContain('art_32');
    });
  });
});
