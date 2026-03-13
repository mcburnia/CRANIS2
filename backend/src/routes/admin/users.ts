import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { generateVerificationToken } from '../../utils/token.js';
import { sendInviteEmail } from '../../services/email.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';

const router = Router();

const DEV_MODE = process.env.DEV_SKIP_EMAIL === 'true';

// GET /api/admin/users – List all users with org info and activity
router.get('/users', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').toLowerCase();

    // Get all users from Postgres
    let query = `
      SELECT id, email, org_id, org_role, email_verified, is_platform_admin,
             preferred_language, created_at, updated_at, suspended_at, suspended_by
      FROM users
    `;
    const params: any[] = [];
    if (search) {
      query += ' WHERE LOWER(email) LIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY created_at DESC';

    const usersResult = await pool.query(query, params);

    // Get last login per user
    const lastLoginResult = await pool.query(`
      SELECT user_id, MAX(created_at) AS last_login
      FROM user_events
      WHERE event_type = 'login'
      GROUP BY user_id
    `);
    const lastLoginMap: Record<string, string> = {};
    for (const row of lastLoginResult.rows) {
      lastLoginMap[row.user_id] = row.last_login;
    }

    // Get org names from Neo4j
    const orgIds = [...new Set(usersResult.rows.map(u => u.org_id).filter(Boolean))];
    let orgNameMap: Record<string, string> = {};

    if (orgIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const orgResult = await session.run(
          'MATCH (o:Organisation) WHERE o.id IN $orgIds RETURN o.id AS id, o.name AS name',
          { orgIds }
        );
        for (const record of orgResult.records) {
          orgNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    // Active users (last 30 days)
    const activeResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS active FROM user_events
      WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days'
    `);
    const active30d = parseInt(activeResult.rows[0]?.active) || 0;

    const users = usersResult.rows.map(u => ({
      id: u.id,
      email: u.email,
      orgId: u.org_id || null,
      orgName: u.org_id ? (orgNameMap[u.org_id] || 'Unknown') : null,
      orgRole: u.org_role || null,
      emailVerified: u.email_verified,
      isPlatformAdmin: u.is_platform_admin || false,
      preferredLanguage: u.preferred_language || null,
      lastLogin: lastLoginMap[u.id] || null,
      createdAt: u.created_at,
      suspendedAt: u.suspended_at || null,
      suspendedBy: u.suspended_by || null,
    }));

    const totalAdmins = users.filter(u => u.isPlatformAdmin).length;
    const totalVerified = users.filter(u => u.emailVerified).length;

    res.json({
      users,
      totals: {
        total: users.length,
        verified: totalVerified,
        platformAdmins: totalAdmins,
        active30d,
      },
    });

  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:userId/platform-admin – Toggle platform admin status
router.put('/users/:userId/platform-admin', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { isPlatformAdmin } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (typeof isPlatformAdmin !== 'boolean') {
      res.status(400).json({ error: 'isPlatformAdmin must be a boolean' });
      return;
    }

    // Safety: cannot demote yourself
    if (userId === adminUserId && !isPlatformAdmin) {
      res.status(400).json({ error: 'Cannot remove your own platform admin access' });
      return;
    }

    // Check target user exists
    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetEmail = userResult.rows[0].email;

    await pool.query(
      'UPDATE users SET is_platform_admin = $1, updated_at = NOW() WHERE id = $2',
      [isPlatformAdmin, userId]
    );

    // Record telemetry event
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId,
      email: adminEmail,
      eventType: isPlatformAdmin ? 'platform_admin_granted' : 'platform_admin_revoked',
      ...reqData,
      metadata: { targetUserId: userId, targetEmail },
    });

    res.json({ success: true, userId, isPlatformAdmin });

  } catch (err) {
    console.error('Admin toggle error:', err);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});



// PUT /api/admin/users/:userId – Edit user details
router.put('/users/:userId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;
    const { email, orgRole } = req.body;

    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (email) {
      // Check email not already taken
      const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Email address already in use' });
        return;
      }
      updates.push('email = $' + idx); params.push(email); idx++;
    }
    if (orgRole) {
      updates.push('org_role = $' + idx); params.push(orgRole); idx++;
    }

    params.push(userId);
    await pool.query(
      'UPDATE users SET ' + updates.join(', ') + ' WHERE id = $' + idx,
      params
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: 'admin_user_edited', ...reqData,
      metadata: { targetUserId: userId, changes: { email, orgRole } },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Admin edit user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT /api/admin/users/:userId/suspend – Suspend or unsuspend a user
router.put('/users/:userId/suspend', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { suspend } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (typeof suspend !== 'boolean') {
      res.status(400).json({ error: 'suspend must be a boolean' });
      return;
    }

    if (userId === adminUserId) {
      res.status(400).json({ error: 'Cannot suspend yourself' });
      return;
    }

    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetEmail = userResult.rows[0].email;

    if (suspend) {
      await pool.query(
        'UPDATE users SET suspended_at = NOW(), suspended_by = $1, updated_at = NOW() WHERE id = $2',
        [adminEmail, userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET suspended_at = NULL, suspended_by = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );
    }

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: suspend ? 'admin_user_suspended' : 'admin_user_unsuspended',
      ...reqData,
      metadata: { targetUserId: userId, targetEmail },
    });

    res.json({ success: true, suspended: suspend });
  } catch (err) {
    console.error('Admin suspend user error:', err);
    res.status(500).json({ error: 'Failed to suspend/unsuspend user' });
  }
});

// DELETE /api/admin/users/:userId – Delete a user
router.delete('/users/:userId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (userId === adminUserId) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    const userResult = await pool.query('SELECT id, email, org_id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetEmail = userResult.rows[0].email;
    const targetOrgId = userResult.rows[0].org_id;

    // Delete related data
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_events WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM feedback WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM repo_connections WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: 'admin_user_deleted', ...reqData,
      metadata: { targetUserId: userId, targetEmail, targetOrgId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /admin/invite – Invite a new user via email
router.post('/invite', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { email, orgId, isPlatformAdmin } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id, email_verified, invited_by FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];

      // Allow re-invite for unaccepted invitations
      if (!existingUser.email_verified && existingUser.invited_by) {
        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
          `UPDATE users SET verification_token = $1, token_expires_at = $2, org_id = $3,
           is_platform_admin = $4, invited_by = $5, updated_at = NOW() WHERE id = $6`,
          [token, expiresAt, orgId || null, isPlatformAdmin || false, adminUserId, existingUser.id]
        );

        if (DEV_MODE) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
          console.log(`[DEV MODE] Re-invite URL for ${normalizedEmail}: ${frontendUrl}/accept-invite?token=${token}`);
        } else {
          await sendInviteEmail(normalizedEmail, token, adminEmail);
        }

        const reqData = extractRequestData(req);
        await recordEvent({
          userId: adminUserId,
          email: adminEmail,
          eventType: 'user_reinvited',
          ipAddress: reqData.ipAddress,
          userAgent: reqData.userAgent,
          acceptLanguage: reqData.acceptLanguage,
          metadata: { invitedEmail: normalizedEmail, orgId: orgId || null, isPlatformAdmin: isPlatformAdmin || false },
        });

        res.json({ success: true, userId: existingUser.id, email: normalizedEmail, reinvite: true });
        return;
      }

      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    // Validate org exists if provided
    if (orgId) {
      const neo4jSession = getDriver().session();
      try {
        const orgResult = await neo4jSession.run(
          'MATCH (o:Organisation {id: $orgId}) RETURN o.id AS id',
          { orgId }
        );
        if (orgResult.records.length === 0) {
          res.status(400).json({ error: 'Organisation not found' });
          return;
        }
      } finally {
        await neo4jSession.close();
      }
    }

    // Generate invite token (7-day expiry)
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create user record (no usable password)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, email_verified, verification_token, token_expires_at,
       org_id, org_role, is_platform_admin, invited_by)
       VALUES ($1, '', FALSE, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [normalizedEmail, token, expiresAt, orgId || null, orgId ? 'member' : 'admin',
       isPlatformAdmin || false, adminUserId]
    );

    // Send invite email (or log in dev mode)
    if (DEV_MODE) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      console.log(`[DEV MODE] Invite URL for ${normalizedEmail}: ${frontendUrl}/accept-invite?token=${token}`);
    } else {
      await sendInviteEmail(normalizedEmail, token, adminEmail);
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId,
      email: adminEmail,
      eventType: 'user_invited',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { invitedEmail: normalizedEmail, orgId: orgId || null, isPlatformAdmin: isPlatformAdmin || false },
    });

    res.status(201).json({ success: true, userId: result.rows[0].id, email: normalizedEmail });
  } catch (err) {
    console.error('Admin invite error:', err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

export default router;
