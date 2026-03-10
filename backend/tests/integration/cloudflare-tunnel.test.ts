/**
 * Cloudflare Tunnel Smoke Test
 *
 * Single lightweight check that the public URL is reachable through
 * the Cloudflare Tunnel. All other tests hit localhost:3001 directly.
 */

import { describe, it, expect } from 'vitest';

const PUBLIC_URL = 'https://dev.cranis2.dev';

describe('Cloudflare Tunnel connectivity', () => {
  it('should reach /api/health through the public URL', async () => {
    const res = await fetch(`${PUBLIC_URL}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });
});
