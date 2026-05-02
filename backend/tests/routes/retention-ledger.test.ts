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
 * Retention Ledger Route Tests — /api/admin/retention-ledger
 *
 * Tests: list, summary, funding certificate, expiry warnings,
 * cost forecast, snapshots dashboard, auth enforcement
 *
 * All endpoints require platform admin role.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/admin/retention-ledger', () => {
  let platformToken: string;
  let adminToken: string;

  beforeAll(async () => {
    platformToken = await loginTestUser(TEST_USERS.platformAdmin);
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── GET /api/admin/retention-ledger ────────────────────────────────

  describe('GET /api/admin/retention-ledger', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/admin/retention-ledger');
      expect(res.status).toBe(401);
    });

    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/retention-ledger', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return ledger entries for platform admin', async () => {
      const res = await api.get('/api/admin/retention-ledger', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      // Should be an array or object with entries
      const entries = Array.isArray(res.body) ? res.body : res.body.entries;
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  // ─── GET /api/admin/retention-ledger/summary ────────────────────────

  describe('GET /api/admin/retention-ledger/summary', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/retention-ledger/summary', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return aggregate summary for platform admin', async () => {
      const res = await api.get('/api/admin/retention-ledger/summary', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ─── GET /api/admin/retention-ledger/expiry-warnings ────────────────

  describe('GET /api/admin/retention-ledger/expiry-warnings', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/retention-ledger/expiry-warnings', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return expiry warnings for platform admin', async () => {
      const res = await api.get('/api/admin/retention-ledger/expiry-warnings', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      // Should be an array of snapshots nearing expiry
      const warnings = Array.isArray(res.body) ? res.body : res.body.warnings;
      expect(Array.isArray(warnings)).toBe(true);
    });
  });

  // ─── GET /api/admin/retention-ledger/cost-forecast ──────────────────

  describe('GET /api/admin/retention-ledger/cost-forecast', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/retention-ledger/cost-forecast', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return cost forecast for platform admin', async () => {
      const res = await api.get('/api/admin/retention-ledger/cost-forecast', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ─── GET /api/admin/retention-ledger/snapshots ──────────────────────

  describe('GET /api/admin/retention-ledger/snapshots', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/retention-ledger/snapshots', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return snapshots dashboard for platform admin', async () => {
      const res = await api.get('/api/admin/retention-ledger/snapshots', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      const snapshots = Array.isArray(res.body) ? res.body : res.body.snapshots;
      expect(Array.isArray(snapshots)).toBe(true);
    });
  });

  // ─── GET /api/admin/retention-ledger/:id/certificate ────────────────

  describe('GET /api/admin/retention-ledger/:id/certificate', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/retention-ledger/fake-id/certificate', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return 404 for non-existent entry', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/admin/retention-ledger/${fakeId}/certificate`, { auth: platformToken });
      expect([404, 400]).toContain(res.status);
    });
  });
});
