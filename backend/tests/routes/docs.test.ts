/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Documentation CMS Route Tests — /api/docs
 *
 * Tests: list pages (public), get single page (public), update page (platform admin only)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/docs', () => {
  let regularToken: string;
  let platformAdminToken: string;
  let originalGuideContent: string;
  let originalGuideTitle: string;

  beforeAll(async () => {
    regularToken = await loginTestUser(TEST_USERS.mfgAdmin);
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);

    // Save original user-guide content so we can restore after destructive PUT tests
    const res = await api.get('/api/docs/user-guide');
    originalGuideTitle = res.body.title;
    originalGuideContent = res.body.content;
  });

  afterAll(async () => {
    // Restore user-guide content that PUT tests overwrite
    if (originalGuideContent && platformAdminToken) {
      await api.put('/api/docs/user-guide', {
        auth: platformAdminToken,
        body: { title: originalGuideTitle, content: originalGuideContent },
      });
    }
  });

  // ─── GET /api/docs — list all pages (public) ───────────────────────────

  describe('GET /api/docs', () => {
    it('should return 200 with docs array (no auth required)', async () => {
      const res = await api.get('/api/docs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.docs)).toBe(true);
      expect(res.body.docs.length).toBeGreaterThan(0);
    });

    it('should return docs with slug and title fields', async () => {
      const res = await api.get('/api/docs');
      expect(res.status).toBe(200);
      for (const doc of res.body.docs) {
        expect(doc).toHaveProperty('slug');
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('updated_at');
        expect(typeof doc.slug).toBe('string');
        expect(typeof doc.title).toBe('string');
      }
    });
  });

  // ─── GET /api/docs/:slug — single page (public) ────────────────────────

  describe('GET /api/docs/:slug', () => {
    it('should return 200 for known slug', async () => {
      const res = await api.get('/api/docs/user-guide');
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('user-guide');
      expect(res.body.title).toBeDefined();
    });

    it('should return page with content field', async () => {
      const res = await api.get('/api/docs/user-guide');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('content');
      expect(typeof res.body.content).toBe('string');
      expect(res.body).toHaveProperty('updated_at');
      expect(res.body).toHaveProperty('updated_by_email');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await api.get('/api/docs/this-slug-does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/docs/:slug — update page (platform admin only) ───────────

  describe('PUT /api/docs/:slug', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.put('/api/docs/user-guide', {
        body: { title: 'Updated Title', content: 'Updated content.' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject non-admin user', async () => {
      const res = await api.put('/api/docs/user-guide', {
        auth: regularToken,
        body: { title: 'Updated Title', content: 'Updated content.' },
      });
      expect(res.status).toBe(403);
    });

    it('should allow platform admin to update a page', async () => {
      const res = await api.put('/api/docs/user-guide', {
        auth: platformAdminToken,
        body: { title: 'User Guide', content: 'Updated guide content for testing.' },
      });
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('user-guide');
      expect(res.body.title).toBe('User Guide');
      expect(res.body).toHaveProperty('updated_at');
    });

    it('should return 400 for missing title', async () => {
      const res = await api.put('/api/docs/user-guide', {
        auth: platformAdminToken,
        body: { content: 'Content without a title.' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for missing content', async () => {
      const res = await api.put('/api/docs/user-guide', {
        auth: platformAdminToken,
        body: { title: 'Title without content' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await api.put('/api/docs/this-slug-does-not-exist', {
        auth: platformAdminToken,
        body: { title: 'Ghost Page', content: 'This page does not exist.' },
      });
      expect(res.status).toBe(404);
    });
  });
});
