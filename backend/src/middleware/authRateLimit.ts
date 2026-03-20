/**
 * Auth Rate Limiting Middleware — WS3 Security Hardening
 *
 * In-memory IP-based rate limiting for authentication endpoints.
 * Prevents brute-force attacks on login, registration, and verification.
 *
 * Limits:
 *   - login:    5 attempts per 15 minutes per IP
 *   - register: 3 attempts per hour per IP
 *   - verify:   10 attempts per hour per IP
 *
 * Implementation:
 *   - In-memory Map (no Redis/DB dependency)
 *   - Automatic cleanup of expired entries every 10 minutes
 *   - Returns 429 with Retry-After header on limit exceeded
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  /** Maximum attempts within the window */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Rate limit configurations by endpoint category. */
export const AUTH_RATE_LIMITS: Record<string, RateLimitConfig> = {
  login:    { maxAttempts: 5,  windowMs: 15 * 60 * 1000 },  // 5 per 15 min
  register: { maxAttempts: 3,  windowMs: 60 * 60 * 1000 },  // 3 per hour
  verify:   { maxAttempts: 10, windowMs: 60 * 60 * 1000 },  // 10 per hour
  invite:   { maxAttempts: 5,  windowMs: 60 * 60 * 1000 },  // 5 per hour
};

/** In-memory store: key = "category:ip" → entry */
const store = new Map<string, RateLimitEntry>();

/** Cleanup interval (10 minutes). */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

/** Remove expired entries periodically to prevent memory leaks. */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Find the config for this key's category
      const category = key.split(':')[0];
      const config = AUTH_RATE_LIMITS[category];
      if (config && now - entry.windowStart > config.windowMs) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node.js to exit even if the timer is still running
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Extract the client IP address from the request.
 * Trusts X-Forwarded-For when behind nginx/Cloudflare.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate-limiting middleware for a specific auth category.
 *
 * @param category - One of: 'login', 'register', 'verify', 'invite'
 */
export function authRateLimit(category: string) {
  const config = AUTH_RATE_LIMITS[category];
  if (!config) {
    throw new Error(`Unknown auth rate limit category: ${category}`);
  }

  ensureCleanup();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip rate limiting in test mode — tests make many rapid logins
    if (process.env.CRANIS2_TEST_MODE === 'true') {
      next();
      return;
    }

    const ip = getClientIp(req);
    const key = `${category}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now - entry.windowStart > config.windowMs) {
      // New window
      store.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (entry.count >= config.maxAttempts) {
      const retryAfterMs = config.windowMs - (now - entry.windowStart);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many attempts. Please try again later.',
        retryAfter: retryAfterSec,
      });
      return;
    }

    // Increment count
    entry.count += 1;
    next();
  };
}

/**
 * Clear all rate limit entries. Used by tests.
 */
export function clearAuthRateLimits(): void {
  store.clear();
}

/**
 * Get the current count for a specific IP and category. Used by tests.
 */
export function getAuthRateLimitCount(category: string, ip: string): number {
  const entry = store.get(`${category}:${ip}`);
  return entry ? entry.count : 0;
}
