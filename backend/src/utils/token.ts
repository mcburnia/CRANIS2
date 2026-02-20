import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateSessionToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): { userId: string; email: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret) as { userId: string; email: string };
}
