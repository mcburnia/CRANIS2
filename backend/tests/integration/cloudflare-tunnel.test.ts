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
