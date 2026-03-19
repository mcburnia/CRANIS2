import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { deriveJwtSecret } from './key-derivation.js';

/**
 * Allowed JWT signing algorithm. Pinned to HS256 to prevent:
 *   - "alg: none" bypass attacks
 *   - Algorithm confusion (e.g. RS256 with HMAC secret as public key)
 */
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

/** Cache the derived secret so HKDF runs once, not per request. */
let cachedDerivedSecret: string | null = null;

function getJwtSecret(): string {
  if (cachedDerivedSecret) return cachedDerivedSecret;

  const masterSecret = process.env.JWT_SECRET;
  if (!masterSecret) throw new Error('JWT_SECRET not configured');

  cachedDerivedSecret = deriveJwtSecret(masterSecret);
  return cachedDerivedSecret;
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateSessionToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: '7d',
  });
}

export function verifySessionToken(token: string): { userId: string; email: string } {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
  }) as { userId: string; email: string };
}
