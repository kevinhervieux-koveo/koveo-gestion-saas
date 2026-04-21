import { db } from "../db";
import * as schema from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { logDebug, logInfo, logWarn } from "../utils/logger";

export type InvitationRole = typeof schema.invitations.$inferInsert["role"];

export interface InvitationAuditMeta {
  source: "mcp" | "rest";
  tool?: string;
  route?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateInvitationWithSoftReplaceInput {
  organizationId: string;
  residenceId?: string | null;
  email: string;
  role: InvitationRole;
  token: string;
  tokenHash: string;
  expiresAt: Date;
  personalMessage?: string | null;
  invitedByUserId: string;
  audit: InvitationAuditMeta;
  logError?: (message: string, err: unknown) => void;
}

export interface CreateInvitationWithSoftReplaceResult {
  invitation: typeof schema.invitations.$inferSelect;
  /**
   * Retained for backwards compatibility with the previous soft-replace
   * contract. Always an empty array now that duplicate invites are rejected
   * with `InvitationAlreadyPendingError` instead of silently replacing the
   * prior pending row. Callers should not rely on this field.
   */
  replacedInvitationIds: string[];
}

function buildAuditTag(audit: InvitationAuditMeta): Record<string, unknown> {
  if (audit.source === "mcp") {
    return { source: "mcp", tool: audit.tool ?? "invite_user" };
  }
  return { source: "rest", route: audit.route ?? "POST /api/invitations" };
}

function isUniqueViolation(err: unknown): boolean {
  // Walk the cause chain so we catch both raw pg errors (top-level `.code`)
  // and Drizzle's DrizzleQueryError wrapper (which exposes the underlying
  // pg error on `.cause`).
  let cur: { code?: string; message?: string; cause?: unknown } | null =
    (err as { code?: string; message?: string; cause?: unknown } | null) ?? null;
  for (let depth = 0; cur && depth < 5; depth++) {
    if (cur.code === "23505") return true;
    if (typeof cur.message === "string" && /unique constraint|duplicate key/i.test(cur.message)) {
      return true;
    }
    cur = (cur.cause as typeof cur) ?? null;
  }
  return false;
}

/**
 * Shared invite-create routine used by both the MCP `invite_user` tool and
 * the REST `POST /api/invitations` endpoint.
 *
 * Behavior (Task #250 — explicit reject on duplicate):
 *   1. Looks up any existing pending invitation rows for the same
 *      (organizationId, email, residenceId) tuple. NULL residenceId on both
 *      sides matches via `IS NOT DISTINCT FROM` so org-level invites do not
 *      collide with unit-scoped ones.
 *   2. If a prior pending row exists, throws
 *      `InvitationAlreadyPendingError`. The pending row is left untouched —
 *      callers must explicitly use `resend_invitation` (extend expiry) or
 *      `cancel_invitation` (start fresh) before re-inviting. Previously this
 *      code path silently soft-replaced the prior row and returned a new
 *      one; that behavior is removed.
 *   3. Otherwise inserts the new invitation row. If the insert hits a
 *      unique-violation (23505) — typically a concurrent invite winning the
 *      race against the SELECT above — it is mapped to the same
 *      `InvitationAlreadyPendingError` so callers get one consistent
 *      conflict signal.
 *   4. Writes a single 'created' `invitation_audit_log` row for the new
 *      invitation. Audit-log failures are logged but never mask a successful
 *      invite create.
 */
export async function createInvitationWithSoftReplace(
  input: CreateInvitationWithSoftReplaceInput,
): Promise<CreateInvitationWithSoftReplaceResult> {
  const {
    organizationId,
    role,
    token,
    tokenHash,
    expiresAt,
    personalMessage,
    invitedByUserId,
    audit,
  } = input;
  // Normalize the dedup tuple inputs so the MCP and REST paths cannot
  // diverge on subtle shape differences:
  //   * residenceId: trim and treat "" / whitespace as null.
  //   * email: trim + lowercase so "Foo@X.com " and "foo@x.com" dedup
  //     against each other.
  const normalizedResidenceId: string | null = (() => {
    const raw = input.residenceId;
    if (raw === null || raw === undefined) return null;
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
  })();
  const normalizedEmail = input.email.trim().toLowerCase();
  const email = normalizedEmail;
  const logError =
    input.logError ?? ((msg, err) => console.error(`[invitation-soft-replace] ${msg}`, err));

  const auditTag = buildAuditTag(audit);
  const ipAddress = audit.ipAddress ?? null;
  const userAgent = audit.userAgent ?? null;

  const existingPending = await db
    .select({ id: schema.invitations.id })
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.email, normalizedEmail),
        eq(schema.invitations.organizationId, organizationId),
        eq(schema.invitations.status, "pending"),
        sql`${schema.invitations.residenceId} IS NOT DISTINCT FROM ${normalizedResidenceId}`,
      ),
    );

  // Single info-level line per call so production logs make it obvious
  // whether the dedup SELECT actually matched prior pending rows.
  logInfo("invitation create dedup lookup", {
    metadata: {
      source: audit.source,
      matchedCount: existingPending.length,
      organizationId,
      email,
      residenceId: normalizedResidenceId,
    },
  });
  logDebug("invitation create dedup lookup (full email)", {
    metadata: {
      source: audit.source,
      matchedCount: existingPending.length,
      organizationId,
      email,
      residenceId: normalizedResidenceId,
    },
  });

  if (existingPending.length > 0) {
    logWarn("invitation create rejected — pending duplicate exists", {
      metadata: {
        source: audit.source,
        organizationId,
        email,
        residenceId: normalizedResidenceId,
      },
    });
    throw new InvitationAlreadyPendingError();
  }

  let invitation: typeof schema.invitations.$inferSelect;
  try {
    const inserted = await db
      .insert(schema.invitations)
      .values({
        organizationId,
        residenceId: normalizedResidenceId,
        email,
        token,
        tokenHash,
        role,
        invitedByUserId,
        expiresAt,
        personalMessage: personalMessage ?? null,
      })
      .returning();
    invitation = inserted[0];
  } catch (insertErr) {
    if (isUniqueViolation(insertErr)) {
      // Concurrent invite won the race between the SELECT above and this
      // INSERT. Surface the same explicit-conflict signal as the SELECT
      // dedup branch so callers only have to handle one error class.
      logWarn("invitation create lost unique-constraint race", {
        metadata: {
          source: audit.source,
          organizationId,
          email,
          residenceId: normalizedResidenceId,
        },
      });
      throw new InvitationAlreadyPendingError();
    }
    logError("failed to insert invitation", insertErr);
    throw insertErr;
  }

  // Audit-log writes are best-effort: a logging failure must never mask a
  // successful invite create.
  try {
    await db.insert(schema.invitationAuditLog).values({
      invitationId: invitation.id,
      action: "created",
      performedBy: invitedByUserId,
      ipAddress,
      userAgent,
      previousStatus: null,
      newStatus: "pending",
      details: { ...auditTag, invitedRole: invitation.role },
    });
  } catch (auditErr) {
    logError("failed to write invitation_audit_log entry on CREATE", auditErr);
  }

  return { invitation, replacedInvitationIds: [] };
}

/**
 * Thrown by `createInvitationWithSoftReplace` when a pending invitation
 * already exists for the same (organization, email, residence) tuple — either
 * found by the dedup SELECT or surfaced as a unique-violation by a concurrent
 * invite. Callers (REST + MCP) branch on `err instanceof
 * InvitationAlreadyPendingError` to surface a stable 409/conflict response
 * directing the user to `resend_invitation` or `cancel_invitation`.
 */
export class InvitationAlreadyPendingError extends Error {
  readonly name = "InvitationAlreadyPendingError";
  constructor() {
    super(
      "A pending invitation exists for this organization and email. Use resend_invitation to extend its expiry or cancel_invitation to start over.",
    );
  }
}

/**
 * Backwards-compatible alias for the pre-Task #250 race-loss error class.
 * The old soft-replace flow distinguished a "race lost after retry" outcome
 * from the dedup hit; the new flow collapses both into
 * `InvitationAlreadyPendingError`. This alias keeps any older `instanceof`
 * checks compiling without forcing a coordinated rename.
 *
 * @deprecated Use `InvitationAlreadyPendingError` instead.
 */
export const InvitationSoftReplaceRaceLostError = InvitationAlreadyPendingError;
export type InvitationSoftReplaceRaceLostError = InvitationAlreadyPendingError;
