/** Shared impersonation audit service — Task #1322. */

import { db } from '../db';
import { mcpAssumeUserLog } from '../../shared/schema';

export type ImpersonationEventParams = {
  /** The admin user performing the impersonation (null for API-key sessions). */
  performedBy: string | null;
  /** The target user id (null for failed attempts or restore events). */
  assumedUserId: string | null;
  /** 'assume' for assume_user calls, 'restore' for restore_acting_user calls. */
  action: 'assume' | 'restore';
  /** Outcome string matching MCP server conventions (e.g. 'success', 'feature_disabled'). */
  outcome: string;
  /** The source IP address, if known. */
  ipAddress?: string | null;
  /** The User-Agent header, if known. */
  userAgent?: string | null;
  /** Extra key/value pairs merged into the `details` JSON column. */
  extraDetails?: Record<string, unknown>;
};

/**
 * Write one row to `mcp_assume_user_log`. Returns the inserted id, or `null`
 * on DB error so callers can enforce audit-first semantics (abort on failure).
 */
export async function recordImpersonationEvent(
  params: ImpersonationEventParams,
): Promise<string | null> {
  try {
    const [row] = await db
      .insert(mcpAssumeUserLog)
      .values({
        performedBy: params.performedBy,
        assumedUserId: params.assumedUserId,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        details: {
          outcome: params.outcome,
          ...(params.extraDetails ?? {}),
        },
      })
      .returning({ id: mcpAssumeUserLog.id });
    return row?.id ?? null;
  } catch (e) {
    console.error(
      `[impersonation-audit] failed to write audit row ` +
        `(action=${params.action}, outcome=${params.outcome})`,
      e,
    );
    return null;
  }
}
