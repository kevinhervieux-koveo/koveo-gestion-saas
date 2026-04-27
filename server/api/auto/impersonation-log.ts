/**
 * Impersonation audit log API — Task #1322.
 *
 * Routes (all require admin auth, all begin with /api/admin/impersonation):
 *   GET  /api/admin/impersonation-log      — paginated audit log
 *   GET  /api/admin/impersonation-status   — active impersonation state
 *   POST /api/admin/impersonation/dev/record   — test event writer (non-prod)
 *   POST /api/admin/impersonation/dev/restore  — test restore writer (non-prod)
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
      if (!currentUser || currentUser.role !== 'admin') {
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
   * Algorithm (correct temporal logic):
   *   1. Find the most recent SUCCESSFUL assume event for this admin
   *      (action = 'assume', details->>'outcome' = 'success').
   *   2. If none exists → inactive.
   *   3. Check whether a 'restore' event exists with created_at AFTER
   *      that successful assume → if so, session has ended → inactive.
   *   4. Otherwise → active.
   *
   * Failed assume attempts (feature_disabled, unknown_target_user, etc.)
   * are completely ignored — they cannot reset an active session.  There is
   * no arbitrary time cutoff: active state is derived purely from the
   * assume→restore event pairs in the audit log.
   */
  app.get(
    '/api/admin/impersonation-status',
    requireAuth,
    asyncHandler(async (req: any, res) => {
      const currentUser = req.user ?? req.session?.user;
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required', code: 'FORBIDDEN' });
      }

      // Step 1: Find the most recent SUCCESSFUL assume event for this admin.
      // We filter on action = 'assume' AND details->>'outcome' = 'success'
      // so that failed attempts (not_admin, feature_disabled, unknown_target_user,
      // etc.) are excluded from the active-state calculation.
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

      // Step 2: Check whether a restore event was recorded AFTER that assume.
      // If so, the session has ended.
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

      // Active: successful assume with no later restore.
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
        : { id: latestSuccessfulAssume.assumedUserId, email: null, fullName: '(deleted user)' };

      return res.json({
        active: true,
        assumedUser,
        since: latestSuccessfulAssume.createdAt,
      });
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
        if (!currentUser || currentUser.role !== 'admin') {
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
        if (!currentUser || currentUser.role !== 'admin') {
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
