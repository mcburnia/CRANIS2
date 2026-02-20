import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateVerificationToken, generateSessionToken } from '../utils/token.js';
import { sendVerificationEmail } from '../services/email.js';

const router = Router();

const DEV_MODE = process.env.DEV_SKIP_EMAIL === 'true';

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
        if (DEV_MODE) {
          // Dev mode: auto-verify existing unverified account
          await pool.query(
            'UPDATE users SET email_verified = TRUE, verification_token = NULL, token_expires_at = NULL, updated_at = NOW() WHERE email = $1',
            [email.toLowerCase()]
          );
          const sessionToken = generateSessionToken(existing.rows[0].id, email.toLowerCase());
          res.json({ message: 'Account verified (dev mode)', devMode: true, session: sessionToken });
          return;
        }
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

    if (DEV_MODE) {
      // Dev mode: create account and auto-verify immediately
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, email_verified)
         VALUES ($1, $2, TRUE) RETURNING id`,
        [email.toLowerCase(), passwordHash]
      );
      const sessionToken = generateSessionToken(result.rows[0].id, email.toLowerCase());
      console.log(`[DEV MODE] Account auto-verified for ${email}`);
      res.status(201).json({ message: 'Account created and verified (dev mode)', devMode: true, session: sessionToken });
      return;
    }

    // Production mode: create with verification token
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO users (email, password_hash, verification_token, token_expires_at)
       VALUES ($1, $2, $3, $4)`,
      [email.toLowerCase(), passwordHash, token, expiresAt]
    );

    await sendVerificationEmail(email.toLowerCase(), token);

    res.status(201).json({ message: 'Verification email sent' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    // Check password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check email verified
    if (!user.email_verified) {
      res.status(403).json({ error: 'Please verify your email address before logging in' });
      return;
    }

    // Generate session token
    const sessionToken = generateSessionToken(user.id, user.email);

    res.json({ session: sessionToken, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me — check current session
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { verifySessionToken } = await import('../utils/token.js');
    const payload = verifySessionToken(token);

    const result = await pool.query('SELECT id, email, email_verified, org_id, org_role FROM users WHERE id = $1', [payload.userId]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        orgId: user.org_id || null,
        orgRole: user.org_role || null,
      },
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
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

    const result = await pool.query(
      'SELECT id, email, token_expires_at FROM users WHERE verification_token = $1 AND email_verified = FALSE',
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }

    const user = result.rows[0];

    if (new Date() > new Date(user.token_expires_at)) {
      res.status(400).json({ error: 'Verification link has expired. Please register again.' });
      return;
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, token_expires_at = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    const sessionToken = generateSessionToken(user.id, user.email);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    res.redirect(`${frontendUrl}/welcome?session=${sessionToken}`);
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

export default router;
