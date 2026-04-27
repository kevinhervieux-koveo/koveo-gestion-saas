/**
 * Impersonation audit log API — Task #1322 / #1473.
 *
 * Routes (all require admin/super_admin auth, all begin with /api/admin/impersonation):
 *   GET  /api/admin/impersonation-log              — paginated MCP audit log
 *   GET  /api/admin/impersonation-status           — active impersonation state
 *   POST /api/admin/impersonation/start            — start web-UI impersonation session
 *   POST /api/admin/impersonation/exit             — exit impersonation (clears session + audit row)
 *   POST /api/admin/impersonation/dev/record       — test event writer (non-prod)
 *   POST /api/admin/impersonation/dev/restore      — test restore writer (non-prod)
 *
 * Impersonation state design (#1473):
 *   Web-UI impersonation is stored directly in the Express session
 *   (req.session.webAssumedUserId).  The GET /api/admin/impersonation-status endpoint
 *   checks the session first; if no web-UI session is active it falls back to the
 *   MCP audit-log approach (assume→restore pairs) so the banner also reflects MCP
 *   impersonation that was started from a Claude/MCP client.
 *
 *   POST /api/admin/impersonation/exit:
 *     • If req.session.webAssumedUserId is set → clears it in the session (real state)
 *       then writes an audit row.
 *     • Otherwise → writes an advisory restore audit row (best-effort for MCP sessions
 *       whose per-connection state cannot be cleared from the web layer).
 */

import type { Express } from 'express';
import { db } from '../../db';
import { mcpAssumeUserLog, users } from '../../../shared/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../../auth';
import { asyncHandler } from '../../utils/async-handler';
import { recordImpersonationEvent } from '../../services/impersonation-audit';

const PAGE_SIZE = 50;

type UserInfo = { id: string; email: string | null; fullName: string };

function buildFullName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ') || '(unknown)';
}

/** Returns true when the caller has admin or super_admin role. */
function isAdminOrSuperAdmin(currentUser: { role?: string } | undefined | null): boolean {
  return currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
}

export default function registerImpersonationLogRoutes(app: Express): void {
  /**
   * GET /api/admin/impersonation-log
   *
   * Query params:
   *   page   – 1-based page number (default: 1)
   *   limit  – rows per page (default: 50, max: 200)
   */
  app.get(
    '/api/admin/impersonation-log',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user ?? req.session?.user;
      if (!isAdminOrSuperAdmin(currentUser)) {
        return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
      }

      const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
      const limit = Math.min(
        200,
        Math.max(1, parseInt((req.query.limit as string) ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
      );
      const offset = (page - 1) * limit;

      const rows = await db
        .select({
          id: mcpAssumeUserLog.id,
          action: mcpAssumeUserLog.action,
          ipAddress: mcpAssumeUserLog.ipAddress,
          userAgent: mcpAssumeUserLog.userAgent,
          details: mcpAssumeUserLog.details,
          createdAt: mcpAssumeUserLog.createdAt,
          performedById: mcpAssumeUserLog.performedBy,
          assumedUserId: mcpAssumeUserLog.assumedUserId,
        })
        .from(mcpAssumeUserLog)
        .orderBy(desc(mcpAssumeUserLog.createdAt))
        .limit(limit)
        .offset(offset);

      const userIds = new Set<string>();
      for (const row of rows) {
        if (row.performedById) userIds.add(row.performedById);
        if (row.assumedUserId) userIds.add(row.assumedUserId);
      }

      const userMap = new Map<string, UserInfo>();
      if (userIds.size > 0) {
        const idList = Array.from(userIds);
        const userRows = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(sql`${users.id} = ANY(${idList})`);
        for (const u of userRows) {
          userMap.set(u.id, {
            id: u.id,
            email: u.email,
            fullName: buildFullName(u.firstName, u.lastName),
          });
        }
      }

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(mcpAssumeUserLog);

      const enriched = rows.map((row) => ({
        ...row,
        performedBy: row.performedById ? (userMap.get(row.performedById) ?? null) : null,
        assumedUser: row.assumedUserId ? (userMap.get(row.assumedUserId) ?? null) : null,
      }));

      return res.json({
        data: enriched,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }),
  );

  /**
   * GET /api/admin/impersonation-status
   *
   * Returns the current impersonation state for the logged-in admin.
   *
   * Priority:
   *   1. Web-UI session state (req.session.webAssumedUserId) — real, clearable.
   *      Source label: 'web'.
   *   2. MCP audit-log state (most-recent successful assume without a later restore).
   *      Source label: 'mcp'.  Advisory only — cannot be cleared from the web layer.
   *   3. Inactive.
   */
  app.get(
    '/api/admin/impersonation-status',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user ?? req.session?.user;
      if (!isAdminOrSuperAdmin(currentUser)) {
        return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
      }

      // ── Priority 1: web-UI session impersonation ──────────────────────────
      const webAssumedUserId = req.session?.webAssumedUserId;
      if (webAssumedUserId) {
        const [assumedUserRow] = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(eq(users.id, webAssumedUserId))
          .limit(1);

        const assumedUser = assumedUserRow
          ? {
              id: assumedUserRow.id,
              email: assumedUserRow.email,
              fullName: buildFullName(assumedUserRow.firstName, assumedUserRow.lastName),
            }
          : { id: webAssumedUserId, email: null, fullName: '(deleted user)' };

        return res.json({ active: true, source: 'web', assumedUser });
      }

      // ── Priority 2: MCP audit-log state ──────────────────────────────────
      // Find the most recent SUCCESSFUL assume event for this admin.
      // Failed attempts are excluded so they cannot reset an active session.
      const [latestSuccessfulAssume] = await db
        .select({
          id: mcpAssumeUserLog.id,
          assumedUserId: mcpAssumeUserLog.assumedUserId,
          createdAt: mcpAssumeUserLog.createdAt,
        })
        .from(mcpAssumeUserLog)
        .where(
          and(
            eq(mcpAssumeUserLog.performedBy, currentUser.id),
            eq(mcpAssumeUserLog.action, 'assume'),
            sql`(${mcpAssumeUserLog.details}->>'outcome') = 'success'`,
          ),
        )
        .orderBy(desc(mcpAssumeUserLog.createdAt))
        .limit(1);

      if (!latestSuccessfulAssume?.assumedUserId) {
        return res.json({ active: false, assumedUser: null });
      }

      // Check whether a restore event was recorded AFTER that assume.
      const [laterRestore] = await db
        .select({ id: mcpAssumeUserLog.id })
        .from(mcpAssumeUserLog)
        .where(
          and(
            eq(mcpAssumeUserLog.performedBy, currentUser.id),
            eq(mcpAssumeUserLog.action, 'restore'),
            sql`${mcpAssumeUserLog.createdAt} > ${latestSuccessfulAssume.createdAt}`,
          ),
        )
        .limit(1);

      if (laterRestore) {
        return res.json({ active: false, assumedUser: null });
      }

      // Active MCP session — fetch user info.
      const [assumedUserRow] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, latestSuccessfulAssume.assumedUserId))
        .limit(1);

      const assumedUser = assumedUserRow
        ? {
            id: assumedUserRow.id,
            email: assumedUserRow.email,
            fullName: buildFullName(assumedUserRow.firstName, assumedUserRow.lastName),
          }
        : {
            id: latestSuccessfulAssume.assumedUserId,
            email: null,
            fullName: '(deleted user)',
          };

      return res.json({
        active: true,
        source: 'mcp',
        assumedUser,
        since: latestSuccessfulAssume.createdAt,
      });
    }),
  );

  /**
   * POST /api/admin/impersonation/start
   *
   * Begins a web-UI impersonation session by storing the target user ID in
   * the Express session (req.session.webAssumedUserId) and recording an audit
   * row.  The ImpersonationBanner will immediately reflect this via the status
   * endpoint (priority 1 path above).
   *
   * Body: { userId: string }
   */
  app.post(
    '/api/admin/impersonation/start',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user ?? req.session?.user;
      if (!isAdminOrSuperAdmin(currentUser)) {
        return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
      }

      const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
      if (!targetUserId) {
        return res.status(400).json({ message: 'userId is required', code: 'BAD_REQUEST' });
      }

      // Verify the target user exists.
      const [targetUser] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found', code: 'NOT_FOUND' });
      }

      // Set web-UI impersonation in the session.
      req.session.webAssumedUserId = targetUserId;

      await new Promise<void>((resolve, reject) =>
        req.session.save((err: Error | null) => (err ? reject(err) : resolve())),
      );

      // Write audit row.
      const id = await recordImpersonationEvent({
        performedBy: currentUser.id,
        assumedUserId: targetUserId,
        action: 'assume',
        outcome: 'success',
        ipAddress: req.ip ?? '127.0.0.1',
        userAgent: req.headers['user-agent'] ?? 'web-ui/impersonation/start',
        extraDetails: {
          source: 'web-ui',
          tool: 'assume_user',
          assumedUserDbRole: targetUser.role ?? 'unknown',
          assumedUserMcpRole: targetUser.role ?? 'unknown',
        },
      });

      return res.json({ ok: true, id: id ?? null });
    }),
  );

  /**
   * POST /api/admin/impersonation/exit
   *
   * Exits the current impersonation session.
   *
   * If a web-UI session is active (req.session.webAssumedUserId is set):
   *   → Clears the session field (real state change), saves the session,
   *     then writes a restore audit row.
   *
   * If there is no web-UI session (e.g. the impersonation was started via MCP):
   *   → Writes an advisory restore audit row.  The MCP session itself is a
   *     separate per-connection closure that cannot be cleared from this layer,
   *     but the audit restore row signals "ended" to the banner fallback path.
   */
  app.post(
    '/api/admin/impersonation/exit',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user ?? req.session?.user;
      if (!isAdminOrSuperAdmin(currentUser)) {
        return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
      }

      // Clear web-UI session state if present.
      if (req.session?.webAssumedUserId) {
        req.session.webAssumedUserId = null;
        await new Promise<void>((resolve, reject) =>
          req.session.save((err: Error | null) => (err ? reject(err) : resolve())),
        );
      }

      // Write restore audit row (always, so both web and MCP code paths are audited).
      const id = await recordImpersonationEvent({
        performedBy: currentUser.id,
        assumedUserId: null,
        action: 'restore',
        outcome: 'success',
        ipAddress: req.ip ?? '127.0.0.1',
        userAgent: req.headers['user-agent'] ?? 'web-ui/impersonation/exit',
        extraDetails: { source: 'web-ui', tool: 'restore_acting_user' },
      });

      return res.json({ ok: true, id: id ?? null });
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    // POST /api/admin/impersonation/dev/record — NON-PROD test helper.
    // Calls recordImpersonationEvent() (same service as MCP assume_user)
    // so E2E tests exercise the real recording code path without OAuth.
    app.post(
      '/api/admin/impersonation/dev/record',
      requireAuth,
      asyncHandler(async (req: any, res) => {
        const currentUser = req.user ?? req.session?.user;
        if (!isAdminOrSuperAdmin(currentUser)) {
          return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
        }

        const outcome =
          typeof req.body?.outcome === 'string' ? req.body.outcome : 'success';
        const isSuccessOutcome = outcome === 'success';

        const assumedUserId: string | null = isSuccessOutcome
          ? (typeof req.body?.assumedUserId === 'string' ? req.body.assumedUserId : currentUser.id)
          : null;

        const id = await recordImpersonationEvent({
          performedBy: currentUser.id,
          assumedUserId,
          action: 'assume',
          outcome,
          ipAddress: req.ip ?? '127.0.0.1',
          userAgent: 'E2E-test/impersonation/dev/record',
          extraDetails: {
            source: 'e2e-test',
            ...(isSuccessOutcome && {
              tool: 'assume_user',
              assumedUserDbRole: 'admin',
              assumedUserMcpRole: 'admin',
            }),
          },
        });

        if (!id) {
          return res.status(500).json({ message: 'Failed to record impersonation event' });
        }
        return res.json({ id });
      }),
    );

    // POST /api/admin/impersonation/dev/restore — NON-PROD test cleanup helper.
    app.post(
      '/api/admin/impersonation/dev/restore',
      requireAuth,
      asyncHandler(async (req: any, res) => {
        const currentUser = req.user ?? req.session?.user;
        if (!isAdminOrSuperAdmin(currentUser)) {
          return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
        }

        const id = await recordImpersonationEvent({
          performedBy: currentUser.id,
          assumedUserId: null,
          action: 'restore',
          outcome: 'success',
          ipAddress: req.ip ?? '127.0.0.1',
          userAgent: 'E2E-test/impersonation/dev/restore',
          extraDetails: { source: 'e2e-test', tool: 'restore_acting_user' },
        });

        return res.json({ id: id ?? null });
      }),
    );
  }
}
