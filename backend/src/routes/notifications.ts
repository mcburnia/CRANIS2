import { Router, Request, Response } from "express";
import pool from "../db/pool.js";
import { verifySessionToken } from "../utils/token.js";
import { getUnreadCount } from "../services/notifications.js";

const router = Router();

// Local auth middleware (same pattern as other routes)
function requireAuth(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  const payload = verifySessionToken(authHeader.split(" ")[1]);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  (req as any).userId = payload.userId;
  (req as any).email = payload.email;
  next();
}

// Helpers
async function getOrgId(userId: string): Promise<string | null> {
  const r = await pool.query("SELECT org_id FROM users WHERE id = $1", [userId]);
  return r.rows[0]?.org_id || null;
}

// GET /api/notifications
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: "No organisation" }); return; }

    const typeFilter = req.query.type as string | undefined;
    const readFilter = req.query.read as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    let where = "WHERE n.org_id = $1 AND (n.user_id IS NULL OR n.user_id = $2)";
    const params: any[] = [orgId, userId];
    let idx = 3;

    if (typeFilter && typeFilter !== "all") {
      where += ` AND n.type = $${idx}`;
      params.push(typeFilter);
      idx++;
    }
    if (readFilter === "true") {
      where += " AND n.is_read = TRUE";
    } else if (readFilter === "false") {
      where += " AND n.is_read = FALSE";
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM notifications n ${where}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0]?.cnt) || 0;

    const unread = await getUnreadCount(orgId, userId);

    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT n.id, n.type, n.severity, n.title, n.body, n.link,
              n.metadata, n.is_read, n.read_at, n.created_at
       FROM notifications n
       ${where}
       ORDER BY n.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    res.json({
      notifications: rows.rows,
      totalCount,
      unreadCount: unread,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("[NOTIFICATIONS] GET / error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: "No organisation" }); return; }

    const count = await getUnreadCount(orgId, userId);
    res.json({ unreadCount: count });
  } catch (err: any) {
    console.error("[NOTIFICATIONS] GET /unread-count error:", err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// PUT /api/notifications/read-all (MUST be registered before /:id route)
router.put("/read-all", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: "No organisation" }); return; }

    await pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE org_id = $1 AND (user_id IS NULL OR user_id = $2) AND is_read = FALSE`,
      [orgId, userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("[NOTIFICATIONS] PUT /read-all error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// PUT /api/notifications/:id/read
router.put("/:id/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: "No organisation" }); return; }

    const notifId = req.params.id as string;
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND org_id = $2 AND (user_id IS NULL OR user_id = $3)
       RETURNING id`,
      [notifId, orgId, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("[NOTIFICATIONS] PUT /:id/read error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

export default router;
