/**
 * Stakeholders Route Tests — /api/stakeholders
 *
 * Stakeholders are pre-seeded role-based rows per organisation (not user-created).
 * Each org gets a fixed set of stakeholder roles (e.g. manufacturer_contact,
 * authorised_representative, importer_contact, etc.) that can be filled in
 * but not created or deleted via the API.
 *
 * Tests: GET list, field validation, auth enforcement
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/stakeholders', () => {

  // ─── GET /api/stakeholders ────────────────────────────────────────────

  describe('GET /api/stakeholders', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await api.get('/api/stakeholders');
      expect(res.status).toBe(401);
    });

    it('should return orgStakeholders array for authenticated user', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/stakeholders', { auth: token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orgStakeholders');
      expect(Array.isArray(res.body.orgStakeholders)).toBe(true);
      expect(res.body.orgStakeholders.length).toBeGreaterThan(0);
    });

    it('should include expected fields on each stakeholder', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/stakeholders', { auth: token });

      expect(res.status).toBe(200);

      const stakeholders = res.body.orgStakeholders;
      for (const s of stakeholders) {
        // Identity fields
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('roleKey');
        expect(s).toHaveProperty('title');
        expect(s).toHaveProperty('craReference');

        // Contact/detail fields
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('email');
        expect(s).toHaveProperty('phone');
        expect(s).toHaveProperty('organisation');
        expect(s).toHaveProperty('address');

        // Audit fields
        expect(s).toHaveProperty('updatedBy');
        expect(s).toHaveProperty('updatedAt');
      }
    });

    it('should have non-empty roleKey and title on every stakeholder', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/stakeholders', { auth: token });

      expect(res.status).toBe(200);

      for (const s of res.body.orgStakeholders) {
        expect(typeof s.roleKey).toBe('string');
        expect(s.roleKey.length).toBeGreaterThan(0);
        expect(typeof s.title).toBe('string');
        expect(s.title.length).toBeGreaterThan(0);
      }
    });

    it('should have a craReference string on every stakeholder', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/stakeholders', { auth: token });

      expect(res.status).toBe(200);

      for (const s of res.body.orgStakeholders) {
        expect(typeof s.craReference).toBe('string');
        expect(s.craReference.length).toBeGreaterThan(0);
      }
    });

    it('should have unique roleKeys across all stakeholders', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/stakeholders', { auth: token });

      expect(res.status).toBe(200);

      const roleKeys = res.body.orgStakeholders.map((s: any) => s.roleKey);
      const uniqueKeys = new Set(roleKeys);
      expect(uniqueKeys.size).toBe(roleKeys.length);
    });

    it('should return stakeholders for a different org', async () => {
      const token = await loginTestUser(TEST_USERS.impAdmin);
      const res = await api.get('/api/stakeholders', { auth: token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orgStakeholders');
      expect(Array.isArray(res.body.orgStakeholders)).toBe(true);
      expect(res.body.orgStakeholders.length).toBeGreaterThan(0);
    });
  });

  // ─── POST /api/stakeholders (not supported) ──────────────────────────

  describe('POST /api/stakeholders', () => {
    it('should return 404 since stakeholders are pre-seeded, not created', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.post('/api/stakeholders', {
        auth: token,
        body: {
          roleKey: 'fake_role',
          name: 'Should Not Work',
          email: 'nope@test.test',
        },
      });

      expect(res.status).toBe(404);
    });
  });
});
