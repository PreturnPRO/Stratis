import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";

export const notificationRouter = Router();

interface NotificationRow {
  id: string;
  user_id: string;
  session_id: string | null;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  meeting_title?: string | null;
}

/**
 * GET /api/notification
 * Fetches all notifications fanned out to the current authenticated user.
 */
notificationRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const limit = typeof req.query.limit === "string" ? Math.min(parseInt(req.query.limit, 10), 50) : 20;

    const result = await db.query<NotificationRow>(
      `SELECT n.id, n.user_id, n.session_id, n.kind, n.title, n.body, n.read, n.created_at, m.title AS meeting_title
       FROM notifications n
       LEFT JOIN sessions s ON s.id = n.session_id
       LEFT JOIN meetings m ON m.id = s.meeting_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({ ok: true, data: { notifications: result.rows } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notification/:id/read
 * Marks a notification as read for the authenticated owner.
 */
notificationRouter.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const notificationId = req.params.id;

    const result = await db.query(
      `UPDATE notifications 
       SET read = TRUE 
       WHERE id = $1 AND user_id = $2 
       RETURNING id`,
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "Notification not found or unauthorized" });
    }

    res.json({ ok: true, data: { read: true, id: notificationId } });
  } catch (err) {
    next(err);
  }
});

export default notificationRouter;