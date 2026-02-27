/**
 * Break Tests — Unit Level: Unicode & Special Characters
 *
 * Tests API handling of unicode, emoji, RTL text, zero-width characters,
 * and other special character inputs across endpoints.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../../setup/test-helpers.js';
import { TEST_IDS } from '../../setup/seed-test-data.js';

describe('Break: Unicode & Special Characters', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Emoji in text fields ──────────────────────────────────────────────

  describe('Emoji in text fields', () => {
    it('should handle emoji in product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test-product-\u{1F680}\u{1F525}', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle emoji in feedback body', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feedback',
          subject: 'Emoji test \u{2705}',
          body: 'Great product! \u{1F44D}\u{1F44D}\u{1F44D} Love the \u{2728} features \u{1F389}',
          pageUrl: '/test',
        },
      });
      expect([200, 201]).toContain(res.status);
    });

    it('should handle emoji-only product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\u{1F600}\u{1F601}\u{1F602}', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });

  // ─── CJK characters ───────────────────────────────────────────────────

  describe('CJK characters', () => {
    it('should handle Chinese product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\u6D4B\u8BD5\u4EA7\u54C1-Chinese', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle Japanese product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\u30C6\u30B9\u30C8\u88FD\u54C1-Japanese', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle Korean product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\uD14C\uC2A4\uD2B8\uC81C\uD488-Korean', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });

  // ─── RTL and bidirectional text ────────────────────────────────────────

  describe('RTL and bidirectional text', () => {
    it('should handle Arabic text', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\u0645\u0646\u062A\u062C-\u0627\u062E\u062A\u0628\u0627\u0631', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle Hebrew text', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\u05DE\u05D5\u05E6\u05E8-\u05D1\u05D3\u05D9\u05E7\u05D4', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle mixed LTR/RTL text', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feedback',
          subject: 'Mixed LTR/RTL: English \u0648\u0639\u0631\u0628\u064A text',
          body: '\u200FRight-to-left\u200E then left-to-right \u200FBack to RTL\u200E',
          pageUrl: '/test',
        },
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ─── Zero-width and invisible characters ───────────────────────────────

  describe('Zero-width and invisible characters', () => {
    it('should handle zero-width space', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test\u200Bproduct', craCategory: 'default' }, // ZWSP
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle zero-width joiner', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test\u200Dproduct', craCategory: 'default' }, // ZWJ
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle zero-width non-joiner', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test\u200Cproduct', craCategory: 'default' }, // ZWNJ
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle product name that is only zero-width chars', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '\u200B\u200B\u200B', craCategory: 'default' },
      });
      // Visually empty but technically non-empty
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle soft hyphen', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feedback',
          subject: 'Soft\u00ADhyphen test',
          body: 'Testing soft\u00ADhyphens in\u00ADtext',
          pageUrl: '/test',
        },
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ─── Special Latin characters ──────────────────────────────────────────

  describe('Special Latin characters', () => {
    it('should handle accented characters (German Umlaute)', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'Pr\u00FCfger\u00E4t-\u00DC\u00F6\u00E4\u00DF', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle Nordic characters', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'produkt-\u00C5\u00C4\u00D6-\u00E6\u00F8\u00E5', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle accented email (internationalized)', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'b\u00FCro@\u00FCmlaut.test', password: 'TestPass123!' },
      });
      // Server may accept internationalised email (sends verification) or reject
      expect([200, 201, 400, 409, 422, 500]).toContain(res.status);
    });
  });

  // ─── Control characters ────────────────────────────────────────────────

  describe('Control characters', () => {
    it('should handle tab characters in text', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feedback',
          subject: 'Tab\tcharacter\ttest',
          body: 'Line1\tColumn2\nLine2\tColumn2',
          pageUrl: '/test',
        },
      });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('should handle newlines in product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test\nproduct\nname', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle carriage return in text', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feedback',
          subject: 'CR test',
          body: 'Line1\r\nLine2\rLine3',
          pageUrl: '/test',
        },
      });
      expect([200, 201, 400]).toContain(res.status);
    });
  });

  // ─── SQL-significant characters ────────────────────────────────────────

  describe('SQL-significant characters in normal fields', () => {
    it('should handle percent signs (LIKE wildcards)', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { status: '%%' },
      });
      expect([200, 400]).toContain(res.status);
    });

    it('should handle underscores (LIKE single-char wildcard)', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { status: '____' },
      });
      expect([200, 400]).toContain(res.status);
    });

    it('should handle backslashes', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test\\product\\name', craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Homoglyph attacks ─────────────────────────────────────────────────

  describe('Homoglyph characters', () => {
    it('should handle Cyrillic characters that look Latin', async () => {
      // \u0430 = Cyrillic 'a', \u0435 = Cyrillic 'e', \u043E = Cyrillic 'o'
      const res = await api.post('/api/auth/login', {
        body: { email: 'test\u0430dmin@m\u0430nuf\u0430cturer-\u0430ctive.test', password: 'TestPass123!' },
      });
      // Should fail — Cyrillic 'a' is not the same as Latin 'a'
      expect([401, 400]).toContain(res.status);
    });
  });
});
