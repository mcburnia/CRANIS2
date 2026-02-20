import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import { generateVerificationToken, generateSessionToken } from '../utils/token.js';
import { sendVerificationEmail } from '../services/email.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Check password strength
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial || !isLongEnough) {
      res.status(400).json({ error: 'Password does not meet strength requirements' });
      return;
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      if (!existing.rows[0].email_verified) {
        // Re-send verification email for unverified accounts
        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pool.query(
          'UPDATE users SET verification_token = $1, token_expires_at = $2, updated_at = NOW() WHERE email = $3',
          [token, expiresAt, email.toLowerCase()]
        );
        await sendVerificationEmail(email.toLowerCase(), token);
        res.json({ message: 'Verification email sent' });
        return;
      }
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate verification token
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Insert user
    await pool.query(
      `INSERT INTO users (email, password_hash, verification_token, token_expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email.toLowerCase(), passwordHash, token, expiresAt]
    );

    // Send verification email
    await sendVerificationEmail(email.toLowerCase(), token);

    res.status(201).json({ message: 'Verification email sent' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Invalid verification link' });
      return;
    }

    // Find user by token
    const result = await pool.query(
      'SELECT id, email, token_expires_at FROM users WHERE verification_token = $1 AND email_verified = FALSE',
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }

    const user = result.rows[0];

    // Check expiry
    if (new Date() > new Date(user.token_expires_at)) {
      res.status(400).json({ error: 'Verification link has expired. Please register again.' });
      return;
    }

    // Mark email as verified
    await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, token_expires_at = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate session token
    const sessionToken = generateSessionToken(user.id, user.email);

    // Redirect to welcome page with session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    res.redirect(`${frontendUrl}/welcome?session=${sessionToken}`);
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

export default router;
