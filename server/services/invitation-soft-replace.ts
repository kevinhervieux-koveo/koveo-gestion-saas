import { db } from "../db";
import * as schema from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
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
 * Shared "soft-replace + create" routine used by both the MCP `invite_user`
 * tool and the REST `POST /api/invitations` endpoint.
 *
 * Behavior:
 *   1. Looks up any existing pending invitation rows for the same
 *      (organizationId, email, residenceId) tuple. NULL residenceId on both
 *      sides matches via `IS NOT DISTINCT FROM` so org-level invites do not
 *      collide with unit-scoped ones.
 *   2. If prior pending rows exist, marks them status='replaced' BEFORE
 *      inserting the new pending row. This ordering is required because
 *      the partial unique index `invitations_pending_org_email_residence_unique`
 *      (Task #200) forbids two pending rows for the same dedup tuple.
 *   3. Inserts the new invitation row. If the insert hits a unique-violation
 *      (23505) — typically due to a concurrent invite winning the race —
 *      retries the entire dedup+insert flow once so concurrent invites do
 *      not 500.
 *   4. Writes one `invitation_audit_log` row per replaced id with
 *      action='replaced' and details.replacedByInvitationId pointing at
 *      the new invitation.
 *   5. Writes a single 'created' `invitation_audit_log` row for the new
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
  //   * residenceId: trim and treat "" / whitespace as null. The helper
  //     previously only `?? null`-coalesced undefined, so MCP callers
  //     passing an empty string would land on a different tuple than the
  //     REST path (which already does `residenceId || null`).
  //   * email: trim + lowercase so "Foo@X.com " and "foo@x.com" dedup
  //     against each other. The same normalized email is stored on the
  //     new invitation row so the next call's SELECT matches.
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

  async function attempt(
    attemptNumber: number,
  ): Promise<CreateInvitationWithSoftReplaceResult | null> {
    // Wrap dedup-select + replace + insert in a single DB transaction so a
    // non-unique-violation insert failure cannot leave the prior pending row(s)
    // marked 'replaced' without a successor row in place.
    type AttemptOk = {
      ok: true;
      invitation: typeof schema.invitations.$inferSelect;
      replacedInvitationIds: string[];
    };
    type AttemptConflict = { ok: false; conflict: true };
    let txResult: AttemptOk | AttemptConflict;
    try {
      txResult = await db.transaction(async (tx): Promise<AttemptOk | AttemptConflict> => {
        const existingPending = await tx
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
    // whether the dedup SELECT actually matched prior pending rows. A silent
    // zero match (e.g. from a column-name slip or a `=` instead of
    // `IS NOT DISTINCT FROM` for NULL residenceId) would otherwise look
    // identical to a legitimate first-time invite.
    logInfo("invitation soft-replace dedup lookup", {
      metadata: {
        source: audit.source,
        attempt: attemptNumber,
        matchedCount: existingPending.length,
        organizationId,
        email,
        residenceId: normalizedResidenceId,
      },
    });
    logDebug("invitation soft-replace dedup lookup (full email)", {
      metadata: {
        source: audit.source,
        attempt: attemptNumber,
        matchedCount: existingPending.length,
        organizationId,
        email,
        residenceId: normalizedResidenceId,
      },
    });

    const replacedInvitationIds = existingPending.map((row) => row.id);

        // Soft-replace prior pending rows BEFORE inserting the new one so the
        // partial unique index does not see two pending rows for the same
        // dedup tuple at the same instant. Both statements run in the same
        // transaction so a non-unique-violation insert failure rolls the
        // 'replaced' update back automatically — preventing partial state
        // where prior pending rows are gone but no successor exists.
        if (replacedInvitationIds.length > 0) {
          await tx
            .update(schema.invitations)
            .set({ status: "replaced", updatedAt: new Date() })
            .where(inArray(schema.invitations.id, replacedInvitationIds));
        }

        const inserted = await tx
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
        const invitation = inserted[0];

        return { ok: true, invitation, replacedInvitationIds };
      });
    } catch (txErr) {
      if (isUniqueViolation(txErr)) {
        logWarn("invitation soft-replace hit unique violation on insert", {
          metadata: {
            source: audit.source,
            attempt: attemptNumber,
            organizationId,
            email,
            residenceId: normalizedResidenceId,
          },
        });
        return null;
      }
      logError("failed to soft-replace + insert invitation in transaction", txErr);
      throw txErr;
    }

    if (txResult.ok !== true) {
      return null;
    }
    const { invitation, replacedInvitationIds } = txResult;

    // Audit-log writes happen OUTSIDE the transaction so a logging failure
    // never rolls back a successful invite. Each catch only logs.
    if (replacedInvitationIds.length > 0) {
      try {
        await db.insert(schema.invitationAuditLog).values(
          replacedInvitationIds.map((oldId) => ({
            invitationId: oldId,
            action: "replaced" as const,
            performedBy: invitedByUserId,
            ipAddress,
            userAgent,
            previousStatus: "pending" as const,
            newStatus: "replaced" as const,
            details: {
              ...auditTag,
              replacedByInvitationId: invitation.id,
              organizationId,
              residenceId: normalizedResidenceId,
              email,
            },
          })),
        );
      } catch (auditReplaceErr) {
        logError("failed to write invitation_audit_log entries on REPLACE", auditReplaceErr);
      }
    }

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

    return { invitation, replacedInvitationIds };
  }

  let result = await attempt(1);
  if (result === null) {
    result = await attempt(2);
  }
  if (result === null) {
    throw new InvitationSoftReplaceRaceLostError();
  }
  return result;
}

/**
 * Thrown by createInvitationWithSoftReplace when both attempts to insert the
 * fresh invitation lose the unique-constraint race against a concurrent caller
 * inserting a row for the same (organization, email, residence) tuple. Callers
 * (REST + MCP) can branch on `err instanceof InvitationSoftReplaceRaceLostError`
 * to surface a stable, friendly retry message without leaking driver details.
 */
export class InvitationSoftReplaceRaceLostError extends Error {
  readonly name = "InvitationSoftReplaceRaceLostError";
  constructor() {
    super(
      "Failed to create invitation: another pending invitation for the same (organization, email, residence) tuple keeps winning the race. Retry after the conflict resolves.",
    );
  }
}
