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
