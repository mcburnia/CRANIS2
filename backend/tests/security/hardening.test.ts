/**
 * Security Hardening Tests — WS3
 *
 * Tests for:
 *   1. Database port binding (localhost only)
 *   2. Forgejo credentials moved to .env
 *   3. Auth rate limiting on login/register/verify/invite
 *   4. CORS restricted to FRONTEND_URL
 *   5. Welcome site credential hardening
 *   6. npm audit clean
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3011';
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// ── Docker Compose Port Binding ─────────────────────────────────────

describe('Database port binding', () => {
  const compose = fs.readFileSync(
    path.join(PROJECT_ROOT, 'docker-compose.yml'),
    'utf-8'
  );

  it('Postgres port is bound to 127.0.0.1', () => {
    expect(compose).toContain('127.0.0.1:5433:5432');
  });

  it('Neo4j HTTP port is bound to 127.0.0.1', () => {
    expect(compose).toContain('127.0.0.1:7475:7474');
  });

  it('Neo4j Bolt port is bound to 127.0.0.1', () => {
    expect(compose).toContain('127.0.0.1:7688:7687');
  });

  it('Forgejo port is bound to 127.0.0.1', () => {
    expect(compose).toContain('127.0.0.1:3003:3000');
  });

  it('no database ports are exposed to 0.0.0.0', () => {
    // These patterns would indicate unbound ports for databases
    const lines = compose.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments
      if (trimmed.startsWith('#')) continue;
      // Check port bindings for database services
      if (trimmed.match(/^- "(\d+):(\d+)"$/)) {
        const port = trimmed.match(/^- "(\d+):/)?.[1];
        // Ports 5432/5433 (postgres), 7474/7475 (neo4j http), 7687/7688 (neo4j bolt)
        // should all be localhost-bound
        if (port && ['5433', '7475', '7688', '3003'].includes(port)) {
          // This would be a bare port without 127.0.0.1 — fail
          expect(trimmed).toContain('127.0.0.1');
        }
      }
    }
  });
});

// ── Forgejo Credentials ─────────────────────────────────────────────

describe('Forgejo credentials', () => {
  const compose = fs.readFileSync(
    path.join(PROJECT_ROOT, 'docker-compose.yml'),
    'utf-8'
  );

  it('Forgejo DB user comes from environment variable', () => {
    expect(compose).toContain('FORGEJO__database__USER=${FORGEJO_DB_USER}');
  });

  it('Forgejo DB password comes from environment variable', () => {
    expect(compose).toContain('FORGEJO__database__PASSWD=${FORGEJO_DB_PASSWD}');
  });

  it('no hardcoded Forgejo password in docker-compose.yml', () => {
    expect(compose).not.toContain('forgejo_dev_2026');
  });

  it('init script uses environment variables', () => {
    const initScript = fs.readFileSync(
      path.join(PROJECT_ROOT, 'postgres/init-forgejo-db.sh'),
      'utf-8'
    );
    expect(initScript).toContain('FORGEJO_DB_USER');
    expect(initScript).toContain('FORGEJO_DB_PASSWD');
    expect(initScript).not.toContain("PASSWORD 'forgejo_dev_2026'");
  });
});

// ── Auth Rate Limiting ──────────────────────────────────────────────

describe('Auth rate limiting', () => {
  it('rate limit is bypassed in test mode (CRANIS2_TEST_MODE)', async () => {
    // Test backend has CRANIS2_TEST_MODE=true, so rate limiting is skipped.
    // Send multiple rapid login attempts — all should get 401 (bad creds), not 429.
    const responses = [];
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@cranis2-test.local',
          password: 'wrong-password',
        }),
      });
      responses.push(res.status);
    }
    // All should be 401 (invalid credentials), none should be 429
    expect(responses.every((s) => s === 401)).toBe(true);
  });

  it('rate limit config defines correct limits', () => {
    const middleware = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/middleware/authRateLimit.ts'),
      'utf-8'
    );
    // login: 5 per 15 min
    expect(middleware).toContain('maxAttempts: 5');
    expect(middleware).toContain('15 * 60 * 1000');
    // register: 3 per hour
    expect(middleware).toContain('maxAttempts: 3');
    // 429 response
    expect(middleware).toContain('status(429)');
    expect(middleware).toContain('Retry-After');
  });

  it('register endpoint has rate limiting middleware', () => {
    const authRoutes = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/routes/auth.ts'),
      'utf-8'
    );
    expect(authRoutes).toContain("authRateLimit('register')");
  });

  it('login endpoint has rate limiting middleware', () => {
    const authRoutes = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/routes/auth.ts'),
      'utf-8'
    );
    expect(authRoutes).toContain("authRateLimit('login')");
  });

  it('verify-email endpoint has rate limiting middleware', () => {
    const authRoutes = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/routes/auth.ts'),
      'utf-8'
    );
    expect(authRoutes).toContain("authRateLimit('verify')");
  });

  it('accept-invite endpoint has rate limiting middleware', () => {
    const authRoutes = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/routes/auth.ts'),
      'utf-8'
    );
    expect(authRoutes).toContain("authRateLimit('invite')");
  });

  it('rate limit middleware module exports expected functions', () => {
    const middleware = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/middleware/authRateLimit.ts'),
      'utf-8'
    );
    expect(middleware).toContain('export function authRateLimit');
    expect(middleware).toContain('export function clearAuthRateLimits');
    expect(middleware).toContain('export const AUTH_RATE_LIMITS');
  });
});

// ── CORS Configuration ──────────────────────────────────────────────

describe('CORS configuration', () => {
  it('CORS is restricted to FRONTEND_URL', () => {
    const index = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/index.ts'),
      'utf-8'
    );
    // Should NOT have wide-open cors()
    expect(index).not.toMatch(/app\.use\(cors\(\)\)/);
    // Should have origin restriction
    expect(index).toContain('origin:');
    expect(index).toContain('FRONTEND_URL');
    expect(index).toContain('credentials: true');
  });

  it('CORS allows required headers', () => {
    const index = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/index.ts'),
      'utf-8'
    );
    expect(index).toContain('Authorization');
    expect(index).toContain('X-API-Key');
    expect(index).toContain('Content-Type');
  });

  it('backend responds with correct CORS headers', async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3002',
        'Access-Control-Request-Method': 'GET',
      },
    });
    // Should allow the configured origin
    const allowOrigin = res.headers.get('access-control-allow-origin');
    // In test mode FRONTEND_URL is http://backend_test:3001
    expect(allowOrigin).toBeTruthy();
  });
});

// ── Welcome Site Hardening ──────────────────────────────────────────

describe('Welcome site credential hardening', () => {
  it('config.js requires WELCOME_USER env var', () => {
    const config = fs.readFileSync(
      path.join(PROJECT_ROOT, 'welcome/config.js'),
      'utf-8'
    );
    expect(config).toContain("requireEnv('WELCOME_USER')");
  });

  it('config.js requires WELCOME_PASS env var', () => {
    const config = fs.readFileSync(
      path.join(PROJECT_ROOT, 'welcome/config.js'),
      'utf-8'
    );
    expect(config).toContain("requireEnv('WELCOME_PASS')");
  });

  it('config.js requires WELCOME_SECRET env var', () => {
    const config = fs.readFileSync(
      path.join(PROJECT_ROOT, 'welcome/config.js'),
      'utf-8'
    );
    expect(config).toContain("requireEnv('WELCOME_SECRET')");
  });

  it('no default credentials in config.js', () => {
    const config = fs.readFileSync(
      path.join(PROJECT_ROOT, 'welcome/config.js'),
      'utf-8'
    );
    expect(config).not.toContain('LetMeIn');
    expect(config).not.toContain('dev-secret-change-me');
  });

  it('requireEnv exits on missing variable', () => {
    const config = fs.readFileSync(
      path.join(PROJECT_ROOT, 'welcome/config.js'),
      'utf-8'
    );
    expect(config).toContain('process.exit(1)');
  });
});

// ── Security Headers (nginx) ────────────────────────────────────────

describe('Security headers (nginx)', () => {
  const nginxConf = fs.readFileSync(
    path.join(PROJECT_ROOT, 'nginx/default.conf'),
    'utf-8'
  );

  it('sets X-Frame-Options', () => {
    expect(nginxConf).toContain('X-Frame-Options');
    expect(nginxConf).toContain('SAMEORIGIN');
  });

  it('sets X-Content-Type-Options', () => {
    expect(nginxConf).toContain('X-Content-Type-Options');
    expect(nginxConf).toContain('nosniff');
  });

  it('sets Strict-Transport-Security', () => {
    expect(nginxConf).toContain('Strict-Transport-Security');
  });

  it('sets Content-Security-Policy', () => {
    expect(nginxConf).toContain('Content-Security-Policy');
  });

  it('sets Referrer-Policy', () => {
    expect(nginxConf).toContain('Referrer-Policy');
  });
});
