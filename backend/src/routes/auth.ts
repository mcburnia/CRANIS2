import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateVerificationToken, generateSessionToken } from '../utils/token.js';
import { sendVerificationEmail } from '../services/email.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { getDriver } from '../db/neo4j.js';

const router = Router();

const DEV_MODE = process.env.DEV_SKIP_EMAIL === 'true';

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, browserLanguage, browserTimezone, referrer: clientReferrer } = req.body;

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

    // Extract server-side telemetry
    const reqData = extractRequestData(req);

    // Derive preferred language from browser
    const preferredLang = (browserLanguage || reqData.acceptLanguage.split(',')[0]?.split('-')[0]?.split(';')[0] || '').toLowerCase().trim();

    // Check if user already exists
    const existing = await pool.query('SELECT id, email_verified FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      if (!existing.rows[0].email_verified) {
        if (DEV_MODE) {
          await pool.query(
            'UPDATE users SET email_verified = TRUE, verification_token = NULL, token_expires_at = NULL, updated_at = NOW() WHERE email = $1',
            [email.toLowerCase()]
          );
          const sessionToken = generateSessionToken(existing.rows[0].id, email.toLowerCase());

          // Record telemetry
          await recordEvent({
            userId: existing.rows[0].id,
            email: email.toLowerCase(),
            eventType: 'register_reverify_dev',
            ipAddress: reqData.ipAddress,
            userAgent: reqData.userAgent,
            acceptLanguage: reqData.acceptLanguage,
            browserLanguage,
            browserTimezone,
            referrer: clientReferrer || reqData.referrer,
          });

          res.json({ message: 'Account verified (dev mode)', devMode: true, session: sessionToken });
          return;
        }
        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await pool.query(
          'UPDATE users SET verification_token = $1, token_expires_at = $2, updated_at = NOW() WHERE email = $3',
          [token, expiresAt, email.toLowerCase()]
        );
        await sendVerificationEmail(email.toLowerCase(), token);

        await recordEvent({
          userId: existing.rows[0].id,
          email: email.toLowerCase(),
          eventType: 'register_resend_verification',
          ipAddress: reqData.ipAddress,
          userAgent: reqData.userAgent,
          acceptLanguage: reqData.acceptLanguage,
          browserLanguage,
          browserTimezone,
          referrer: clientReferrer || reqData.referrer,
        });

        res.json({ message: 'Verification email sent' });
        return;
      }
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    if (DEV_MODE) {
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, email_verified, preferred_language)
         VALUES ($1, $2, TRUE, $3) RETURNING id`,
        [email.toLowerCase(), passwordHash, preferredLang || null]
      );
      const sessionToken = generateSessionToken(result.rows[0].id, email.toLowerCase());
      console.log(`[DEV MODE] Account auto-verified for ${email}`);

      // Record registration event
      await recordEvent({
        userId: result.rows[0].id,
        email: email.toLowerCase(),
        eventType: 'register',
        ipAddress: reqData.ipAddress,
        userAgent: reqData.userAgent,
        acceptLanguage: reqData.acceptLanguage,
        browserLanguage,
        browserTimezone,
        referrer: clientReferrer || reqData.referrer,
        metadata: { devMode: true },
      });

      res.status(201).json({ message: 'Account created and verified (dev mode)', devMode: true, session: sessionToken });
      return;
    }

    // Production mode
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, verification_token, token_expires_at, preferred_language)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email.toLowerCase(), passwordHash, token, expiresAt, preferredLang || null]
    );

    await sendVerificationEmail(email.toLowerCase(), token);

    // Record registration event
    await recordEvent({
      userId: result.rows[0].id,
      email: email.toLowerCase(),
      eventType: 'register',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      browserLanguage,
      browserTimezone,
      referrer: clientReferrer || reqData.referrer,
    });

    res.status(201).json({ message: 'Verification email sent' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, browserLanguage, browserTimezone } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const reqData = extractRequestData(req);

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, email_verified, suspended_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Record failed login attempt (no user found) — use email as identifier
      await recordEvent({
        userId: '00000000-0000-0000-0000-000000000000',
        email: email.toLowerCase(),
        eventType: 'login_failed_no_user',
        ipAddress: reqData.ipAddress,
        userAgent: reqData.userAgent,
        acceptLanguage: reqData.acceptLanguage,
        browserLanguage,
        browserTimezone,
      });

      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    // Check password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      // Record failed login (wrong password)
      await recordEvent({
        userId: user.id,
        email: user.email,
        eventType: 'login_failed_bad_password',
        ipAddress: reqData.ipAddress,
        userAgent: reqData.userAgent,
        acceptLanguage: reqData.acceptLanguage,
        browserLanguage,
        browserTimezone,
      });

      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check email verified
    if (!user.email_verified) {
      res.status(403).json({ error: 'Please verify your email address before logging in' });
      return;
    }

    // Check suspended
    if (user.suspended_at) {
      res.status(403).json({ error: 'Your account has been suspended. Please contact your administrator.' });
      return;
    }

    // Generate session token
    const sessionToken = generateSessionToken(user.id, user.email);

    // Record successful login
    await recordEvent({
      userId: user.id,
      email: user.email,
      eventType: 'login',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      browserLanguage,
      browserTimezone,
    });

    // Update preferred language if provided
    if (browserLanguage) {
      const lang = browserLanguage.split('-')[0].toLowerCase();
      await pool.query('UPDATE users SET preferred_language = COALESCE(preferred_language, $1), updated_at = NOW() WHERE id = $2', [lang, user.id]);
    }

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

    const result = await pool.query('SELECT id, email, email_verified, org_id, org_role, preferred_language, is_platform_admin FROM users WHERE id = $1', [payload.userId]);
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
        preferredLanguage: user.preferred_language || null,
        isPlatformAdmin: user.is_platform_admin || false,
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

    // Record email verification event
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: user.id,
      email: user.email,
      eventType: 'email_verified',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: {
        verificationIpMatchesRegistration: true, // Can be enriched later by comparing IPs
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
    res.redirect(`${frontendUrl}/welcome?session=${sessionToken}`);
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});


// POST /api/auth/accept-invite — Accept an invitation and set password
router.post('/accept-invite', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    // Validate password strength (same rules as registration)
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial || !isLongEnough) {
      res.status(400).json({ error: 'Password does not meet strength requirements' });
      return;
    }

    // Look up invited user by token
    const result = await pool.query(
      `SELECT id, email, org_id, token_expires_at FROM users
       WHERE verification_token = $1 AND email_verified = FALSE AND invited_by IS NOT NULL`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired invitation link' });
      return;
    }

    const user = result.rows[0];

    // Check expiry
    if (new Date() > new Date(user.token_expires_at)) {
      res.status(400).json({ error: 'Invitation link has expired. Please ask your admin to resend the invite.' });
      return;
    }

    // Hash password and activate account
    const passwordHash = await hashPassword(password);
    await pool.query(
      `UPDATE users SET password_hash = $1, email_verified = TRUE,
       verification_token = NULL, token_expires_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    // If user has an org, create Neo4j User node and BELONGS_TO relationship
    if (user.org_id) {
      const neo4jSession = getDriver().session();
      try {
        await neo4jSession.run(
          `MATCH (o:Organisation {id: $orgId})
           MERGE (u:User {id: $userId})
           ON CREATE SET u.email = $email, u.createdAt = datetime()
           MERGE (u)-[:BELONGS_TO]->(o)`,
          { orgId: user.org_id, userId: user.id, email: user.email }
        );
      } finally {
        await neo4jSession.close();
      }
    }

    // Generate session token
    const sessionToken = generateSessionToken(user.id, user.email);

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: user.id,
      email: user.email,
      eventType: 'invite_accepted',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
    });

    res.json({ session: sessionToken, email: user.email, hasOrg: !!user.org_id });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: 'Failed to activate account. Please try again.' });
  }
});

export default router;
