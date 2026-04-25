import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Build stamp surfaced through the `get_mcp_info` tool so support can verify,
 * from outside the long-lived MCP process, which commit the running bundle
 * was built from. A stale bundle (e.g. after a soft-replace rewire) would
 * otherwise be invisible. Resolved once at module load.
 *
 * Previously this resolver preferred `REPLIT_DEPLOYMENT_ID` /
 * `REPL_DEPLOYMENT_ID` / `SOURCE_VERSION`, but on Replit autoscale those env
 * vars are stable per-deployment-slot rather than per-build, so they never
 * moved across redeploys and the same UUID was reported for every shipped
 * commit. They are removed from the precedence here.
 *
 * Resolution order (real per-build stamp first, dev fallback last):
 *   1. `dist/build-info.json` written by `scripts/write-build-info.ts`
 *      during the production build. Authoritative when present.
 *   2. `BUILD_SHA` / `BUILD_TIME` env vars — lets a deploy pipeline inject
 *      the stamp without writing a file.
 *   3. `git rev-parse --short HEAD` and the current ISO timestamp — used in
 *      local `npm run dev` and any container where `.git` is available.
 *   4. The literal string `"unknown"` (SHA) / current ISO timestamp (time).
 *
 * To verify a deploy moved: capture `buildSha` and `buildTime` from
 * `get_mcp_info` before redeploying, redeploy, then call `get_mcp_info`
 * again. Different commit → `buildSha` changes. No-op redeploy of the same
 * commit → `buildSha` stays the same but `buildTime` advances.
 */
type BuildStamp = { buildSha?: unknown; buildTime?: unknown };

function readBuildStampFile(): BuildStamp {
  // The production build writes `dist/build-info.json` at the project root.
  // The deployed bundle (`dist/index.js`) is invoked with cwd = project root,
  // so a single cwd-relative lookup is enough and avoids ESM/CJS gymnastics
  // around `import.meta.url`.
  const file = join(process.cwd(), "dist", "build-info.json");
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as BuildStamp;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // No stamp file (e.g. dev mode) — fall through to env / git resolution.
  }
  return {};
}

const BUILD_STAMP = readBuildStampFile();

const BUILD_SHA: string = (() => {
  if (typeof BUILD_STAMP.buildSha === "string" && BUILD_STAMP.buildSha) {
    return BUILD_STAMP.buildSha;
  }
  if (process.env.BUILD_SHA) {
    return process.env.BUILD_SHA;
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();

const BUILD_TIME: string = (() => {
  if (typeof BUILD_STAMP.buildTime === "string" && BUILD_STAMP.buildTime) {
    return BUILD_STAMP.buildTime;
  }
  if (process.env.BUILD_TIME) {
    return process.env.BUILD_TIME;
  }
  return new Date().toISOString();
})();
import { db } from "../db";
import * as schema from "@shared/schema";
import { registerBudgetTools } from "./budget-tools";
import { registerBulkImportTools } from "./bulk-import-tools";
import * as commonSpaceRules from "../api/common-spaces-rules";
import { adjustResidenceCount } from "../api/buildings/operations";
import { eq, and, inArray, desc, asc, isNull, or, sql, count, gte, lte, type SQL } from "drizzle-orm";
import { DocumentService, type DocumentType } from "../services/document-service";
import { ObjectStorageService } from "../objectStorage";
import {
  applyAttachmentAcl,
  normalizeAttachmentInput,
  verifyAttachmentOwnership,
} from "../utils/demand-attachment-acl";
import { aiService } from "../services/consolidated-ai-service";
import { emailService } from "../services/email-service";
import { workflowService } from "../services/workflow-service";
import {
  createInvitationWithSoftReplace,
  InvitationAlreadyPendingError,
} from "../services/invitation-soft-replace";
import { demandNotificationService } from "../services/demand-notification-service";
import { insertDemandCommentSchema } from "@shared/schemas/operations";

const MCP_ORG_NAMES = ["MCP-1", "MCP-2"];

async function getMcpOrgIds(): Promise<string[]> {
  const orgs = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(inArray(schema.organizations.name, MCP_ORG_NAMES));
  return orgs.map((o) => o.id);
}

type McpRole = "admin" | "manager" | "tenant";

export interface McpAuthContext {
  /** OAuth-authenticated user id (Koveo users.id), if any. */
  userId?: string;
  /**
   * Role granted by the OAuth consent screen. When set, this OVERRIDES any
   * caller-supplied `role` argument on tool inputs — preventing privilege
   * escalation by simply passing `role: "admin"` in tool args.
   */
  role?: McpRole;
}

async function lookupMcpUser(role: McpRole): Promise<{ id: string; role: string } | null> {
  const emailMap: Record<string, string> = {
    admin: "mcp-admin@koveo-mcp.test",
    manager: "mcp-manager@koveo-mcp.test",
    tenant: "mcp-tenant@koveo-mcp.test",
  };
  const [user] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, emailMap[role]))
    .limit(1);
  return user || null;
}

async function lookupMcpUserById(userId: string): Promise<{ id: string; role: string } | null> {
  const [user] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return user || null;
}

/**
 * Resolve the MCP-acting user.
 *
 * Exported for unit testing. The two lookups are injected so the function can
 * be tested in isolation from the database.
 *
 * Resolution order:
 *   - If the request is OAuth-authenticated (`authContext.userId` is set),
 *     return the real Koveo user behind that OAuth grant. This is what every
 *     write tool that needs an `xxxBy` foreign key (createdBy, submitterId,
 *     etc.) should use, so rows are attributed to the actual caller.
 *   - Otherwise (legacy MCP_API_KEY path, no OAuth context), fall back to the
 *     synthetic seed account for the requested role
 *     (`mcp-{role}@koveo-mcp.test`).
 *
 * If the OAuth-bound user can't be found in the DB (e.g. they were deleted
 * after the token was issued), this returns null — callers should handle that
 * the same way they handle a missing seed account.
 */
export async function resolveMcpUser(
  authContext: McpAuthContext | undefined,
  role: McpRole,
  deps: {
    lookupById: (id: string) => Promise<{ id: string; role: string } | null>;
    lookupByRole: (role: McpRole) => Promise<{ id: string; role: string } | null>;
  },
): Promise<{ id: string; role: string } | null> {
  if (authContext?.userId) {
    return deps.lookupById(authContext.userId);
  }
  return deps.lookupByRole(role);
}

/**
 * Roles the OAuth-bound role is allowed to "act as" within a single session.
 *
 * Exported for testing. The OAuth-bound role acts as the ceiling: an admin
 * session may downgrade to manager or tenant, a manager session may downgrade
 * to tenant, and a tenant session is locked to tenant. This mirrors a real
 * RBAC hierarchy — a higher-privilege role can always view what a lower one
 * sees, but never the other way around. Downgrades let a manager use Claude
 * to explore tenant-scoped behavior without re-authenticating.
 */
export function allowedRolesFor(enforcedRole: McpRole): McpRole[] {
  switch (enforcedRole) {
    case 'admin':
      return ['admin', 'manager', 'tenant'];
    case 'manager':
      return ['manager', 'tenant'];
    case 'tenant':
      return ['tenant'];
  }
}

/**
 * Build the per-tool input wrapper that enforces the OAuth-bound role.
 *
 * Exported for unit testing. When `enforcedRole` is set, the returned wrapper:
 *   - allows the caller-supplied `role` if it is a permitted downgrade of
 *     `enforcedRole` (see `allowedRolesFor`); the supplied role is forwarded
 *     to the handler so tenant-scoped restrictions kick in,
 *   - returns an `Authorization mismatch` text response when the caller-
 *     supplied `role` is NOT a permitted downgrade (e.g. tenant trying to
 *     act as manager, or manager trying to act as admin),
 *   - injects the session's *acting role* into args when no `role` was
 *     supplied. The acting role defaults to `enforcedRole` but can be
 *     downgraded for the rest of the session via the `downgrade_acting_role`
 *     tool (and reset via `restore_acting_role`). The optional
 *     `getActingRole` callback is what makes that downgrade visible here.
 *
 * When `enforcedRole` is undefined (legacy MCP_API_KEY path), the wrapper just
 * forwards args to the handler so callers can self-select a role.
 */
export function wrapHandlerWithRoleEnforcement<H extends (a: Record<string, unknown>, ...rest: unknown[]) => unknown>(
  handler: H,
  enforcedRole: McpRole | undefined,
  getActingRole?: () => McpRole,
): H {
  if (!enforcedRole) return handler;
  const allowed = allowedRolesFor(enforcedRole);
  const wrapped = async (a: Record<string, unknown>, ...rest: unknown[]) => {
    const args = (a && typeof a === 'object') ? a : {};
    const defaultRole: McpRole = getActingRole ? getActingRole() : enforcedRole;
    let effectiveRole: McpRole = defaultRole;
    if ('role' in args) {
      const supplied = (args as { role?: unknown }).role;
      if (typeof supplied === 'string') {
        if (!(allowed as string[]).includes(supplied)) {
          return {
            content: [{
              type: 'text' as const,
              text:
                `Authorization mismatch: this OAuth session is bound to role "${enforcedRole}", ` +
                `which only permits acting as [${allowed.map((r) => `"${r}"`).join(', ')}], ` +
                `but the call requested role "${supplied}". The role argument can only be used ` +
                `to downgrade to a less-privileged role within the OAuth-bound ceiling — it ` +
                `cannot escalate. To act as "${supplied}", disconnect the connector and ` +
                `re-authorize, selecting "${supplied}" on the consent screen. (See ` +
                `get_mcp_info for the currently bound role and allowed downgrades.)`,
            }],
          };
        }
        // An explicit `role` always wins over the session's acting role,
        // even when it equals the OAuth-bound role — that lets the caller
        // make a per-call call as the OAuth-bound role even after a sticky
        // downgrade (and lets `downgrade_acting_role` see the requested
        // target role rather than the previously-downgraded role).
        effectiveRole = supplied as McpRole;
      }
    }
    // Inject the trusted effective role so handlers see a consistent value
    // (matches the OAuth-bound role unless the caller explicitly downgraded).
    return handler({ ...args, role: effectiveRole }, ...rest);
  };
  return wrapped as unknown as H;
}

/**
 * Pure authorization check used by `delete_building` and `delete_bill`.
 *
 * Exported for unit testing. Returns `{ ok: true }` when the caller is allowed
 * to delete the entity, otherwise an `{ ok: false, response }` shaped like an
 * MCP tool text response that the handler should return as-is.
 */
export function authorizeDeleteInMcpScope(params: {
  role: McpRole;
  entityKind: 'building' | 'bill' | 'residence' | 'project' | 'common_space' | 'inventory_element';
  entityId: string;
  entity: { exists: boolean; organizationId?: string | null };
  mcpOrgIds: string[];
}): { ok: true } | { ok: false; response: { content: Array<{ type: 'text'; text: string }> } } {
  const labelMap = {
    building: 'Building',
    bill: 'Bill',
    residence: 'Residence',
    project: 'Project',
    common_space: 'Common space',
    inventory_element: 'Inventory element',
  } as const;
  const pluralWordMap = {
    building: 'buildings',
    bill: 'bills',
    residence: 'residences',
    project: 'projects',
    common_space: 'common spaces',
    inventory_element: 'inventory elements',
  } as const;
  const label = labelMap[params.entityKind];
  if (params.role === 'tenant') {
    return {
      ok: false,
      response: { content: [{ type: 'text' as const, text: `Access denied: tenants cannot delete ${pluralWordMap[params.entityKind]}` }] },
    };
  }
  if (!params.entity.exists) {
    return {
      ok: false,
      response: { content: [{ type: 'text' as const, text: `${label} not found: ${params.entityId}` }] },
    };
  }
  if (!params.entity.organizationId || !params.mcpOrgIds.includes(params.entity.organizationId)) {
    const scopeMessages = {
      building: 'Access denied: building is not in an MCP-scoped organization',
      bill: 'Access denied: bill is not attached to an MCP-scoped building',
      residence: 'Access denied: residence is not in an MCP-scoped organization',
      project: 'Access denied: project is not attached to an MCP-scoped building',
      common_space: 'Access denied: common space is not attached to an MCP-scoped building',
      inventory_element: 'Access denied: inventory element is not in an MCP-scoped organization',
    } as const;
    return { ok: false, response: { content: [{ type: 'text' as const, text: scopeMessages[params.entityKind] }] } };
  }
  return { ok: true };
}

/**
 * Maps PostgreSQL table names to human-readable singular entity class names
 * used in sanitized FK-violation responses. Falls back to the raw table name
 * (with a trailing 's' stripped) when no explicit mapping is registered.
 */
const FK_TABLE_TO_ENTITY: Record<string, string> = {
  residences: 'residence',
  bookings: 'booking',
  bills: 'bill',
  payments: 'payment',
  scheduled_payments: 'scheduled_payment',
  maintenance_requests: 'maintenance_request',
  maintenance_records: 'maintenance_record',
  buildings: 'building',
  common_spaces: 'common_space',
  demands: 'demand',
};

/**
 * Build a sanitized MCP tool response for an error caught while writing
 * (`create`/`update`) or deleting (`delete`) `entityLabel`. For PostgreSQL
 * FK-violation errors (`code === '23503'`) we parse the driver `detail`
 * field to extract the related table and emit a structured JSON object the
 * LLM caller can branch on. For unique-constraint violations
 * (`code === '23505'`) we emit an action-specific friendly message. For any
 * other error we emit a generic fallback string with NO raw driver fields
 * so SQL text and bound parameter values never leak. Callers MUST log the
 * full error themselves before calling this helper.
 *
 * FK detail patterns differ between create/update and delete:
 *   - create/update fail because the *referenced* row doesn't exist —
 *     PostgreSQL says `Key (col)=(val) is not present in table "X"`. The
 *     parsed table is emitted as `referenced_entity`.
 *   - delete fails because *other rows still reference* the row being
 *     deleted — PostgreSQL says `Key (col)=(val) is still referenced from
 *     table "X"`. The parsed table is emitted as `blocking_entity`.
 */
export function buildWriteErrorResponse(
  e: unknown,
  entityLabel: string,
  action: 'create' | 'update' | 'delete' = 'create',
): { content: Array<{ type: 'text'; text: string }> } {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === '23503') {
    const detail = (e as { detail?: unknown } | null)?.detail;
    let relatedTable: string | null = null;
    if (typeof detail === 'string') {
      const pattern = action === 'delete'
        ? /referenced from table "([^"]+)"/
        : /is not present in table "([^"]+)"/;
      const match = detail.match(pattern);
      if (match) relatedTable = match[1];
    }
    const relatedEntity = relatedTable
      ? (FK_TABLE_TO_ENTITY[relatedTable] ?? relatedTable.replace(/s$/, ''))
      : 'related_record';
    const humanLabel = relatedEntity.replace(/_/g, ' ');
    if (action === 'delete') {
      const message = relatedTable
        ? `Cannot delete ${entityLabel}: 1 or more ${humanLabel}s still reference it. Remove them first.`
        : `Cannot delete ${entityLabel}: other records still reference it. Remove them first.`;
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'fk_violation',
            code: 'FK_VIOLATION',
            retryable: false,
            blocking_entity: relatedEntity,
            message,
          }, null, 2),
        }],
      };
    }
    const message = relatedTable
      ? `Cannot ${action} ${entityLabel}: referenced ${humanLabel} does not exist.`
      : `Cannot ${action} ${entityLabel}: a referenced record does not exist.`;
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'fk_violation',
          code: 'FK_VIOLATION',
          retryable: false,
          referenced_entity: relatedEntity,
          message,
        }, null, 2),
      }],
    };
  }
  if (code === '23505') {
    const message = action === 'delete'
      ? `Cannot delete ${entityLabel}: a unique-constraint conflict prevented the delete (likely a related row could not be updated).`
      : `Cannot ${action} ${entityLabel}: a record with the same unique value already exists.`;
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'unique_violation',
          code: 'UNIQUE_VIOLATION',
          retryable: false,
          message,
        }, null, 2),
      }],
    };
  }
  // Task #245 — surface a wider range of PostgreSQL SQLSTATEs as
  // structured envelopes so MCP callers can distinguish transient
  // (retryable) failures from permanent rejections. The driver `message`
  // and `detail` are intentionally NOT included — only the friendly
  // per-action sentence and the SQLSTATE itself, which is not sensitive.
  if (typeof code === 'string' && PG_EXTENDED_ERROR_CATALOG[code]) {
    const entry = PG_EXTENDED_ERROR_CATALOG[code];
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: entry.status,
          code: entry.envelopeCode,
          retryable: entry.retryable,
          pgCode: code,
          message: entry.phrase(action, entityLabel),
        }, null, 2),
      }],
    };
  }
  return {
    content: [{
      type: 'text' as const,
      text: `Failed to ${action} ${entityLabel} — please retry`,
    }],
  };
}

/**
 * Extended PostgreSQL SQLSTATE → structured-envelope catalog used by
 * `buildWriteErrorResponse`. Each entry maps a raw SQLSTATE to a stable
 * envelope `code`, a `retryable` flag MCP callers use for backoff
 * decisions, and a friendly per-action message factory. Documented in
 * `replit.md` under the MCP Tooling section.
 *
 * Retryable: 40001, 40P01, 57014, 08006/08001/08003/08004.
 * Permanent: 23514, 23502 (FK 23503 and unique 23505 are handled with
 * richer detail-parsing logic above).
 */
export const PG_EXTENDED_ERROR_CATALOG: Record<
  string,
  {
    status: string;
    envelopeCode: string;
    retryable: boolean;
    phrase: (action: string, label: string) => string;
  }
> = {
  '23514': {
    status: 'check_violation',
    envelopeCode: 'CHECK_VIOLATION',
    retryable: false,
    phrase: (a, l) => `Cannot ${a} ${l}: one or more values failed a database check constraint.`,
  },
  '23502': {
    status: 'not_null_violation',
    envelopeCode: 'NOT_NULL_VIOLATION',
    retryable: false,
    phrase: (a, l) => `Cannot ${a} ${l}: a required field was missing.`,
  },
  '40001': {
    status: 'serialization_failure',
    envelopeCode: 'SERIALIZATION_FAILURE',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} due to a transient serialization conflict — please retry with backoff.`,
  },
  '40P01': {
    status: 'deadlock_detected',
    envelopeCode: 'DEADLOCK_DETECTED',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} because the database detected a deadlock — please retry with backoff.`,
  },
  '57014': {
    status: 'statement_timeout',
    envelopeCode: 'STATEMENT_TIMEOUT',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} because the database statement timed out — please retry shortly.`,
  },
  '08006': {
    status: 'connection_failure',
    envelopeCode: 'CONNECTION_FAILURE',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} because the database connection failed — please retry shortly.`,
  },
  '08001': {
    status: 'connection_failure',
    envelopeCode: 'CONNECTION_FAILURE',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} because the database connection could not be established — please retry shortly.`,
  },
  '08003': {
    status: 'connection_failure',
    envelopeCode: 'CONNECTION_FAILURE',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} because the database connection was closed — please retry shortly.`,
  },
  '08004': {
    status: 'connection_failure',
    envelopeCode: 'CONNECTION_FAILURE',
    retryable: true,
    phrase: (a, l) =>
      `Could not ${a} ${l} because the database rejected the connection — please retry shortly.`,
  },
};

/**
 * PostgreSQL SQLSTATEs flagged as transient/retryable by
 * `PG_EXTENDED_ERROR_CATALOG`. Centralized here so `withRetryableDbCall` and
 * the catalog cannot drift apart: anything advertised to MCP callers as
 * `retryable: true` is exactly what we silently retry in-process before the
 * error ever surfaces to the LLM.
 *
 *   40001  serialization_failure
 *   40P01  deadlock_detected
 *   57014  statement_timeout (query cancelled)
 *   08006  connection_failure
 *   08001  sqlclient_unable_to_establish_sqlconnection
 *   08003  connection_does_not_exist
 *   08004  sqlserver_rejected_establishment_of_sqlconnection
 */
export const RETRYABLE_PG_CODES: ReadonlySet<string> = new Set([
  '40001',
  '40P01',
  '57014',
  '08006',
  '08001',
  '08003',
  '08004',
]);

/**
 * Run `fn` against the database, retrying on the SQLSTATEs catalogued as
 * retryable (see `RETRYABLE_PG_CODES`). Non-retryable errors short-circuit
 * immediately so callers (and `buildWriteErrorResponse`) keep their
 * deterministic single-attempt behaviour for permanent failures.
 *
 * Bounded by `maxAttempts` (default 3). Between attempts we wait a small
 * exponential backoff (`baseDelayMs * 2^(attempt-1)`) plus uniform jitter in
 * `[0, baseDelayMs)` so concurrent retriers don't stampede in lockstep.
 *
 * `sleep` and `random` are injectable so unit tests can run without a real
 * timer / RNG.
 */
export async function withRetryableDbCall<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const rand = options.random ?? Math.random;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const code = (e as { code?: unknown } | null)?.code;
      const isRetryable = typeof code === 'string' && RETRYABLE_PG_CODES.has(code);
      if (!isRetryable || attempt === maxAttempts) {
        throw e;
      }
      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = rand() * baseDelayMs;
      await sleep(backoff + jitter);
    }
  }
  // Unreachable — the loop either returns or throws — but TypeScript's
  // control-flow analysis can't prove that, so rethrow defensively.
  throw lastErr;
}

/**
 * Backwards-compatible alias for delete-action error sanitization. New code
 * should call `buildWriteErrorResponse(e, label, 'delete')` directly.
 */
export function buildDeleteErrorResponse(
  e: unknown,
  entityLabel: string,
): { content: Array<{ type: 'text'; text: string }> } {
  return buildWriteErrorResponse(e, entityLabel, 'delete');
}

/**
 * Sanitized message for transactional email send failures. The underlying
 * SendGrid/SMTP error often includes API keys, request IDs, or recipient
 * email addresses in its `.message`, so we never surface it raw to the
 * MCP caller — operators get the full error in the server console.
 */
export const SANITIZED_EMAIL_ERROR =
  'Email service threw an error while sending — see server logs';

/**
 * Tools that already carry the OAuth-bound / acting role information in their
 * primary response payload. We do NOT want to append the generic downgrade
 * reminder to these — it would either duplicate the information they already
 * return (`get_mcp_info`) or add noise to a response whose entire purpose is
 * to manipulate the acting role (`downgrade_acting_role`, `restore_acting_role`).
 */
const ROLE_META_TOOL_NAMES: ReadonlySet<string> = new Set([
  'get_mcp_info',
  'downgrade_acting_role',
  'restore_acting_role',
]);

/**
 * Build the human-readable reminder text appended to every tool response when
 * the session is operating under a downgraded acting role. Exported so the
 * unit tests can assert the exact wording.
 *
 * The reminder is intentionally short, prefixed with a clear `[Acting role …]`
 * marker, and instructs the assistant how to revert (`restore_acting_role`).
 */
export function buildDowngradeReminderText(
  oauthBoundRole: McpRole,
  currentActingRole: McpRole,
): string {
  return (
    `[Acting role reminder] This MCP session is OAuth-bound to "${oauthBoundRole}" ` +
    `but a session-level downgrade is in effect — you are currently acting as ` +
    `"${currentActingRole}", which has reduced privileges. Subsequent tool calls ` +
    `that omit the \`role\` argument will continue to run as "${currentActingRole}". ` +
    `Plan accordingly, or call restore_acting_role to revert to "${oauthBoundRole}".`
  );
}

export function createMcpServer(authContext?: McpAuthContext): McpServer {
  // When the request was authenticated via OAuth, ALWAYS use the role granted
  // at consent time. Otherwise (legacy MCP_API_KEY path) fall back to the
  // caller-supplied role for backwards compatibility.
  const enforcedRole: McpRole | undefined = authContext?.role;
  // Resolves the user the tool should attribute writes to. When OAuth is in
  // use, this is the real Koveo user behind the token; when the legacy API-key
  // path is in use, it falls back to the synthetic `mcp-{role}@koveo-mcp.test`
  // seed account so existing dev/test workflows keep working.
  const getMcpUser = (role: McpRole) =>
    resolveMcpUser(authContext, enforcedRole ?? role, {
      lookupById: lookupMcpUserById,
      lookupByRole: lookupMcpUser,
    });
  const server = new McpServer({
    name: "koveo-gestion",
    version: "1.0.0",
  });

  // Per-session "acting role" state. Defaults to the OAuth-bound role and can
  // be downgraded for the remainder of this MCP session via the
  // `downgrade_acting_role` tool (and reset via `restore_acting_role`). The
  // closure scope here is the MCP session scope — `createMcpServer` is invoked
  // per `initialize` request — so this state cannot leak across users or
  // tokens. Legacy MCP_API_KEY sessions have no enforcedRole and therefore no
  // acting role to track.
  let actingRole: McpRole | undefined = enforcedRole;

  // CENTRAL RBAC ENFORCEMENT: when an OAuth token granted a specific role at
  // consent time, every tool handler must see a trusted role — either the
  // session's current acting role (defaults to the OAuth-bound role, may be a
  // permitted downgrade after `downgrade_acting_role`), or a permitted
  // *downgrade* of the OAuth-bound role passed explicitly via the `role` arg.
  // The wrapper (a) injects the acting role when no `role` arg was sent,
  // (b) accepts a permitted explicit downgrade and forwards it so tenant-
  // scoped restrictions apply, or (c) returns a clear error response when the
  // caller-supplied `role` would *escalate* beyond the OAuth-bound ceiling.
  // Silently rewriting a mismatched arg masks bugs, so we fail loudly for
  // escalation attempts and tell them how to re-authorize.
  if (enforcedRole) {
    const original = server.tool.bind(server) as unknown as (
      ...args: unknown[]
    ) => unknown;
    (server as unknown as { tool: typeof original }).tool = ((
      ...registerArgs: unknown[]
    ) => {
      const toolName = typeof registerArgs[0] === 'string' ? (registerArgs[0] as string) : '';
      const handlerIdx = registerArgs.length - 1;
      const handler = registerArgs[handlerIdx] as (
        a: Record<string, unknown>,
        ...rest: unknown[]
      ) => unknown;
      if (typeof handler === 'function') {
        const enforced = wrapHandlerWithRoleEnforcement(
          handler,
          enforcedRole,
          () => actingRole ?? enforcedRole,
        );
        // Append a session-state reminder to every tool response when a
        // downgrade is in effect, so the model sees the active (reduced)
        // role on every turn rather than only after explicitly calling
        // `get_mcp_info`. This makes it much harder for the assistant to
        // forget that its scope has been narrowed and propose an action
        // that will fail because of the downgrade. The role-meta tools
        // (`downgrade_acting_role`, `restore_acting_role`, `get_mcp_info`)
        // are exempt because they already carry that information in their
        // primary payload — re-appending it would just be noise.
        const isRoleMetaTool = ROLE_META_TOOL_NAMES.has(toolName);
        const wrapped = isRoleMetaTool
          ? enforced
          : (async (a: Record<string, unknown>, ...rest: unknown[]) => {
              const result = await enforced(a, ...rest);
              const current = actingRole ?? enforcedRole;
              if (
                current !== enforcedRole &&
                result &&
                typeof result === 'object' &&
                Array.isArray((result as { content?: unknown }).content)
              ) {
                const r = result as {
                  content: Array<{ type: string; text: string }>;
                };
                return {
                  ...r,
                  content: [
                    ...r.content,
                    {
                      type: 'text' as const,
                      text: buildDowngradeReminderText(enforcedRole, current),
                    },
                  ],
                };
              }
              return result;
            }) as typeof enforced;
        registerArgs[handlerIdx] = wrapped;
      }
      return original(...registerArgs);
    }) as typeof original;
  }

  const roleParam = z
    .enum(["admin", "manager", "tenant"])
    .optional()
    .describe(
      "The user role to act as. When the MCP server is reached via OAuth, the " +
        "role granted at consent time is the ceiling: you may pass a less-privileged " +
        "role here to operate in that role's scope (admin sessions may downgrade to " +
        "manager or tenant; manager sessions may downgrade to tenant) — useful for " +
        "exploring tenant-scoped behavior without re-authenticating. Passing a " +
        "MORE-privileged role returns an authorization-mismatch error; re-authorize " +
        "the connector to escalate. See get_mcp_info for the allowed roles in the " +
        "current session.",
    );

  server.tool(
    "list_organizations",
    "List all MCP-accessible organizations",
    // Intentional exemption from the "list tools require organizationId"
    // rule (Task #260): this tool IS the org-discovery primitive callers
    // use to learn which MCP-scoped orgs exist before passing one of those
    // ids into every other list_* / get_* tool. Restricting it would create
    // a chicken-and-egg problem. The result set is already hard-bounded to
    // the MCP-scoped org allowlist (`getMcpOrgIds`) so it cannot leak
    // arbitrary tenant data even without an org filter.
    { role: roleParam },
    async ({ role }) => {
      const orgIds = await getMcpOrgIds();
      const orgs = await db
        .select()
        .from(schema.organizations)
        .where(and(inArray(schema.organizations.id, orgIds), eq(schema.organizations.isActive, true)));
      return { content: [{ type: "text" as const, text: JSON.stringify(orgs, null, 2) }] };
    }
  );

  server.tool(
    "get_organization",
    "Get details of a specific organization",
    { role: roleParam, organizationId: z.string().describe("Organization ID") },
    async ({ role, organizationId }) => {
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, organizationId));
      return { content: [{ type: "text" as const, text: org ? JSON.stringify(org, null, 2) : "Organization not found" }] };
    }
  );

  server.tool(
    "list_buildings",
    "List buildings in an organization",
    { role: roleParam, organizationId: z.string().describe("Organization ID") },
    async ({ role, organizationId }) => {
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const buildings = await db
        .select()
        .from(schema.buildings)
        .where(and(eq(schema.buildings.organizationId, organizationId), eq(schema.buildings.isActive, true)));
      return { content: [{ type: "text" as const, text: JSON.stringify(buildings, null, 2) }] };
    }
  );

  server.tool(
    "get_building",
    "Get details of a specific building",
    { role: roleParam, buildingId: z.string().describe("Building ID") },
    async ({ role, buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(building, null, 2) }] };
    }
  );

  server.tool(
    "create_building",
    "Create a new building in an organization (admin/manager only)",
    {
      role: roleParam,
      organizationId: z.string().describe("Organization ID"),
      name: z.string().describe("Building name"),
      address: z.string().describe("Street address"),
      city: z.string().describe("City"),
      postalCode: z.string().describe("Postal code"),
      buildingType: z.enum(["apartment", "condo", "rental"]).describe("Building type"),
      totalUnits: z.number().int().describe("Total number of units"),
      province: z.string().length(2).optional().describe("Province code (defaults to QC)"),
      constructionDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("Construction date (YYYY-MM-DD)"),
      totalFloors: z.number().int().optional().describe("Total number of floors"),
      parkingSpaces: z.number().int().optional().describe("Total parking spaces"),
      storageSpaces: z.number().int().optional().describe("Total storage spaces"),
      amenities: z.array(z.string()).optional().describe("List of building amenities"),
      managementCompany: z.string().optional().describe("Management company name"),
      bankAccountNumber: z.string().optional().describe("Bank account number"),
      bankAccountNotes: z.string().optional().describe("Bank reconciliation notes"),
      bankAccountStartDate: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("Bank account start date (ISO 8601 datetime)"),
      bankAccountStartAmount: z.number().optional().describe("Bank account starting balance"),
      bankAccountMinimums: z
        .string()
        .refine((s) => {
          try {
            JSON.parse(s);
            return true;
          } catch {
            return false;
          }
        }, "Must be a valid JSON string")
        .optional()
        .describe("JSON string of minimum balance settings"),
      unplannedBillsAmount: z.number().optional().describe("Monthly unplanned bills budget"),
      unplannedBillsStartDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("Unplanned bills start date (YYYY-MM-DD)"),
      inflationSettings: z
        .string()
        .refine((s) => {
          try {
            JSON.parse(s);
            return true;
          } catch {
            return false;
          }
        }, "Must be a valid JSON string")
        .optional()
        .describe("JSON string of inflation configuration by category"),
      financialYearStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("Financial year start date (YYYY-MM-DD)"),
      generalInflationRate: z.number().optional().describe("General inflation rate percentage"),
      revenueInflationRate: z.number().optional().describe("Revenue inflation rate percentage"),
    },
    async ({
      role,
      organizationId,
      name,
      address,
      city,
      postalCode,
      buildingType,
      totalUnits,
      province,
      constructionDate,
      totalFloors,
      parkingSpaces,
      storageSpaces,
      amenities,
      managementCompany,
      bankAccountNumber,
      bankAccountNotes,
      bankAccountStartDate,
      bankAccountStartAmount,
      bankAccountMinimums,
      unplannedBillsAmount,
      unplannedBillsStartDate,
      inflationSettings,
      financialYearStart,
      generalInflationRate,
      revenueInflationRate,
    }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create buildings" }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      try {
        const [building] = await withRetryableDbCall(() => db
          .insert(schema.buildings)
          .values({
            organizationId,
            name,
            address,
            city,
            postalCode,
            buildingType,
            totalUnits,
            province: province ?? "QC",
            ...(constructionDate !== undefined && { constructionDate }),
            ...(totalFloors !== undefined && { totalFloors }),
            ...(parkingSpaces !== undefined && { parkingSpaces }),
            ...(storageSpaces !== undefined && { storageSpaces }),
            ...(amenities !== undefined && { amenities }),
            ...(managementCompany !== undefined && { managementCompany }),
            ...(bankAccountNumber !== undefined && { bankAccountNumber }),
            ...(bankAccountNotes !== undefined && { bankAccountNotes }),
            ...(bankAccountStartDate !== undefined && { bankAccountStartDate: new Date(bankAccountStartDate) }),
            ...(bankAccountStartAmount !== undefined && { bankAccountStartAmount: String(bankAccountStartAmount) }),
            ...(bankAccountMinimums !== undefined && { bankAccountMinimums }),
            ...(unplannedBillsAmount !== undefined && { unplannedBillsAmount: String(unplannedBillsAmount) }),
            ...(unplannedBillsStartDate !== undefined && { unplannedBillsStartDate }),
            ...(inflationSettings !== undefined && { inflationSettings }),
            ...(financialYearStart !== undefined && { financialYearStart }),
            ...(generalInflationRate !== undefined && { generalInflationRate: String(generalInflationRate) }),
            ...(revenueInflationRate !== undefined && { revenueInflationRate: String(revenueInflationRate) }),
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(building, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_building]", e);
        return buildWriteErrorResponse(e, 'building', 'create');
      }
    }
  );

  server.tool(
    "update_building",
    "Update an existing building (admin/manager only). Only fields supplied are changed; organizationId is immutable.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      name: z.string().optional().describe("Building name"),
      address: z.string().optional().describe("Street address"),
      city: z.string().optional().describe("City"),
      postalCode: z.string().optional().describe("Postal code"),
      buildingType: z.enum(["apartment", "condo", "rental"]).optional().describe("Building type"),
      totalUnits: z.number().int().optional().describe("Total number of units"),
      province: z.string().length(2).optional().describe("Province code"),
      constructionDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("Construction date (YYYY-MM-DD)"),
      totalFloors: z.number().int().optional().describe("Total number of floors"),
      parkingSpaces: z.number().int().optional().describe("Total parking spaces"),
      storageSpaces: z.number().int().optional().describe("Total storage spaces"),
      amenities: z.array(z.string()).optional().describe("List of building amenities"),
      managementCompany: z.string().optional().describe("Management company name"),
      bankAccountNumber: z.string().optional().describe("Bank account number"),
      bankAccountNotes: z.string().optional().describe("Bank reconciliation notes"),
      bankAccountStartDate: z
        .string()
        .datetime({ offset: true })
        .optional()
        .describe("Bank account start date (ISO 8601 datetime)"),
      bankAccountStartAmount: z.number().optional().describe("Bank account starting balance"),
      bankAccountMinimums: z
        .string()
        .refine((s) => {
          try {
            JSON.parse(s);
            return true;
          } catch {
            return false;
          }
        }, "Must be a valid JSON string")
        .optional()
        .describe("JSON string of minimum balance settings"),
      unplannedBillsAmount: z.number().optional().describe("Monthly unplanned bills budget"),
      unplannedBillsStartDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("Unplanned bills start date (YYYY-MM-DD)"),
      inflationSettings: z
        .string()
        .refine((s) => {
          try {
            JSON.parse(s);
            return true;
          } catch {
            return false;
          }
        }, "Must be a valid JSON string")
        .optional()
        .describe("JSON string of inflation configuration by category"),
      financialYearStart: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("Financial year start date (YYYY-MM-DD)"),
      generalInflationRate: z.number().optional().describe("General inflation rate percentage"),
      revenueInflationRate: z.number().optional().describe("Revenue inflation rate percentage"),
    },
    async ({
      role,
      buildingId,
      name,
      address,
      city,
      postalCode,
      buildingType,
      totalUnits,
      province,
      constructionDate,
      totalFloors,
      parkingSpaces,
      storageSpaces,
      amenities,
      managementCompany,
      bankAccountNumber,
      bankAccountNotes,
      bankAccountStartDate,
      bankAccountStartAmount,
      bankAccountMinimums,
      unplannedBillsAmount,
      unplannedBillsStartDate,
      inflationSettings,
      financialYearStart,
      generalInflationRate,
      revenueInflationRate,
    }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update buildings" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }

      // Mirror the REST PUT handler's residence-count rules:
      //   - Only admins may change `totalUnits`, because the change adds
      //     or soft-deletes residence rows (which can destroy data).
      //   - The building update + residence adjustment must run inside a
      //     single transaction so a mid-flight failure cannot leave
      //     `buildings.totalUnits` updated while the residence rows are
      //     out of sync (the drift Task #172 closed for the REST path).
      const previousTotalUnits = building.totalUnits ?? 0;
      const totalUnitsChanging =
        totalUnits !== undefined && totalUnits !== previousTotalUnits;
      if (totalUnitsChanging && role !== "admin") {
        return {
          content: [{
            type: "text" as const,
            text:
              "Access denied: only admins can change a building's totalUnits, " +
              "because doing so adds or soft-deletes residence rows.",
          }],
        };
      }

      // The other side effects the REST PUT writes are stored as
      // plain columns on the building row (bankAccount*, inflation*,
      // unplannedBills*, etc.) and have no separate recompute step in
      // the REST handler — there is no budget-recompute, no
      // notification fan-out, no derived-table refresh to mirror here.
      // If a future REST change adds a real side effect, this comment
      // should be revisited along with the REST PUT handler.
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          const [updated] = await tx
            .update(schema.buildings)
            .set({
              ...(name !== undefined && { name }),
              ...(address !== undefined && { address }),
              ...(city !== undefined && { city }),
              ...(postalCode !== undefined && { postalCode }),
              ...(buildingType !== undefined && { buildingType }),
              ...(totalUnits !== undefined && { totalUnits }),
              ...(province !== undefined && { province }),
              ...(constructionDate !== undefined && { constructionDate }),
              ...(totalFloors !== undefined && { totalFloors }),
              ...(parkingSpaces !== undefined && { parkingSpaces }),
              ...(storageSpaces !== undefined && { storageSpaces }),
              ...(amenities !== undefined && { amenities }),
              ...(managementCompany !== undefined && { managementCompany }),
              ...(bankAccountNumber !== undefined && { bankAccountNumber }),
              ...(bankAccountNotes !== undefined && { bankAccountNotes }),
              ...(bankAccountStartDate !== undefined && { bankAccountStartDate: new Date(bankAccountStartDate) }),
              ...(bankAccountStartAmount !== undefined && { bankAccountStartAmount: String(bankAccountStartAmount) }),
              ...(bankAccountMinimums !== undefined && { bankAccountMinimums }),
              ...(unplannedBillsAmount !== undefined && { unplannedBillsAmount: String(unplannedBillsAmount) }),
              ...(unplannedBillsStartDate !== undefined && { unplannedBillsStartDate }),
              ...(inflationSettings !== undefined && { inflationSettings }),
              ...(financialYearStart !== undefined && { financialYearStart }),
              ...(generalInflationRate !== undefined && { generalInflationRate: String(generalInflationRate) }),
              ...(revenueInflationRate !== undefined && { revenueInflationRate: String(revenueInflationRate) }),
              updatedAt: new Date(),
            })
            .where(eq(schema.buildings.id, buildingId))
            .returning();

          let adjustment: Awaited<ReturnType<typeof adjustResidenceCount>> | null = null;
          if (totalUnitsChanging) {
            // `totalFloors` may not be in the update payload; fall back
            // to the persisted value (mirroring the REST handler's
            // `buildingData.totalFloors || existingBuilding[0].totalFloors || 1`).
            const effectiveFloors =
              totalFloors !== undefined
                ? totalFloors
                : building.totalFloors ?? 1;
            adjustment = await adjustResidenceCount(
              buildingId,
              building.organizationId,
              totalUnits!,
              previousTotalUnits,
              effectiveFloors || 1,
              tx as unknown as typeof db,
            );
          }

          return { updated, adjustment };
        }));

        // Decrease path mirrors the REST PUT: the building row's new
        // (lower) `totalUnits` is committed, but the residence rows are
        // NOT auto-deleted because some may carry users or documents.
        // Surface the candidate list so the assistant can call
        // `delete_residence` for each one it actually wants to remove.
        if (
          result.adjustment &&
          result.adjustment.action === 'decreased' &&
          result.adjustment.residencesToSelect
        ) {
          const toRemove = previousTotalUnits - (totalUnits ?? previousTotalUnits);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                building: result.updated,
                residenceAdjustment: {
                  action: 'decreased',
                  needsResidenceSelection: true,
                  residencesToRemove: toRemove,
                  residencesToSelect: result.adjustment.residencesToSelect,
                  instruction:
                    `Building totalUnits was lowered from ${previousTotalUnits} to ${totalUnits}, ` +
                    `but residence rows were not auto-deleted. Pick ${toRemove} residence` +
                    `${toRemove === 1 ? '' : 's'} from \`residencesToSelect\` (rows without ` +
                    `users or documents are listed first) and call the \`delete_residence\` ` +
                    `tool for each one to bring the residence count back in sync.`,
                },
              }, null, 2),
            }],
          };
        }

        if (result.adjustment && result.adjustment.action === 'increased') {
          const added = (totalUnits ?? previousTotalUnits) - previousTotalUnits;
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                building: result.updated,
                residenceAdjustment: {
                  action: 'increased',
                  residencesAdded: added,
                },
              }, null, 2),
            }],
          };
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result.updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_building]", e);
        return buildWriteErrorResponse(e, 'building', 'update');
      }
    }
  );

  server.tool(
    "list_residences",
    "List residences in a building",
    { role: roleParam, buildingId: z.string().describe("Building ID") },
    async ({ role, buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      let residences;
      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };
        // Per the canonical "current tenancy" rule on `userResidences`
        // (see shared/schemas/property.ts, Task #144), reads MUST filter
        // on `userResidences.isActive = true`. The MCP `list_residences`
        // tenant branch now applies the strict rule like all other
        // read paths — seed data inserts default `isActive: true`, and
        // the end-residency write contract keeps the flag aligned.
        residences = await db
          .select({ r: schema.residences })
          .from(schema.residences)
          .innerJoin(schema.userResidences, eq(schema.residences.id, schema.userResidences.residenceId))
          .where(
            and(
              eq(schema.residences.buildingId, buildingId),
              eq(schema.userResidences.userId, user.id),
              eq(schema.userResidences.isActive, true),
              eq(schema.residences.isActive, true)
            )
          );
        residences = residences.map((r: { r: typeof schema.residences.$inferSelect }) => r.r);
      } else {
        residences = await db
          .select()
          .from(schema.residences)
          .where(and(eq(schema.residences.buildingId, buildingId), eq(schema.residences.isActive, true)));
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(residences, null, 2) }] };
    }
  );

  server.tool(
    "get_residence",
    "Get details of a specific residence",
    { role: roleParam, residenceId: z.string().describe("Residence ID") },
    async ({ role, residenceId }) => {
      const orgIds = await getMcpOrgIds();
      const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
      if (!residence) return { content: [{ type: "text" as const, text: "Residence not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      // Tenant scope guard: a tenant may only read a residence they are
      // actually linked to via `userResidences`. Without this check, the
      // org-scope check above lets any tenant read any residence in the
      // MCP sandbox by ID. Per Task #144, the link must be currently
      // active (`userResidences.isActive = true`).
      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };
        const [link] = await db
          .select({ id: schema.userResidences.id })
          .from(schema.userResidences)
          .where(
            and(
              eq(schema.userResidences.userId, user.id),
              eq(schema.userResidences.residenceId, residenceId),
              eq(schema.userResidences.isActive, true)
            )
          )
          .limit(1);
        if (!link) {
          return { content: [{ type: "text" as const, text: "Access denied" }] };
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(residence, null, 2) }] };
    }
  );

  server.tool(
    "create_residence",
    "Create a new residence in a building (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      unitNumber: z.string().describe("Unit number"),
      floor: z.number().int().optional().describe("Floor number"),
      bedrooms: z.number().int().optional().describe("Number of bedrooms"),
      bathrooms: z.number().optional().describe("Number of bathrooms"),
      monthlyFees: z.number().optional().describe("Monthly fees amount"),
      squareFootage: z.number().optional().describe("Square footage"),
      balcony: z.boolean().optional().describe("Whether the residence has a balcony"),
      parkingSpaceNumbers: z.array(z.string()).optional().describe("Assigned parking space numbers"),
      storageSpaceNumbers: z.array(z.string()).optional().describe("Assigned storage space numbers"),
      ownershipPercentage: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Ownership percentage for condo fee allocation (0-100)"),
    },
    async ({
      role,
      buildingId,
      unitNumber,
      floor,
      bedrooms,
      bathrooms,
      monthlyFees,
      squareFootage,
      balcony,
      parkingSpaceNumbers,
      storageSpaceNumbers,
      ownershipPercentage,
    }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create residences" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      try {
        const [residence] = await withRetryableDbCall(() => db.insert(schema.residences).values({
          buildingId,
          unitNumber,
          ...(floor !== undefined && { floor }),
          ...(bedrooms !== undefined && { bedrooms }),
          ...(bathrooms !== undefined && { bathrooms: String(bathrooms) }),
          ...(monthlyFees !== undefined && { monthlyFees: String(monthlyFees) }),
          ...(squareFootage !== undefined && { squareFootage: String(squareFootage) }),
          ...(balcony !== undefined && { balcony }),
          ...(parkingSpaceNumbers !== undefined && { parkingSpaceNumbers }),
          ...(storageSpaceNumbers !== undefined && { storageSpaceNumbers }),
          ...(ownershipPercentage !== undefined && { ownershipPercentage: String(ownershipPercentage) }),
        }).returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(residence, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_residence]", e);
        return buildWriteErrorResponse(e, 'residence', 'create');
      }
    }
  );

  server.tool(
    "update_residence",
    "Update an existing residence (admin/manager only). Only fields supplied are changed; buildingId is immutable.",
    {
      role: roleParam,
      residenceId: z.string().describe("Residence ID"),
      unitNumber: z.string().optional().describe("Unit number"),
      floor: z.number().int().optional().describe("Floor number"),
      bedrooms: z.number().int().optional().describe("Number of bedrooms"),
      bathrooms: z.number().optional().describe("Number of bathrooms"),
      monthlyFees: z.number().optional().describe("Monthly fees amount"),
      squareFootage: z.number().optional().describe("Square footage"),
      balcony: z.boolean().optional().describe("Whether the residence has a balcony"),
      parkingSpaceNumbers: z.array(z.string()).optional().describe("Assigned parking space numbers"),
      storageSpaceNumbers: z.array(z.string()).optional().describe("Assigned storage space numbers"),
      ownershipPercentage: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Ownership percentage for condo fee allocation (0-100)"),
    },
    async ({
      role,
      residenceId,
      unitNumber,
      floor,
      bedrooms,
      bathrooms,
      monthlyFees,
      squareFootage,
      balcony,
      parkingSpaceNumbers,
      storageSpaceNumbers,
      ownershipPercentage,
    }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update residences" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
      if (!residence) {
        return { content: [{ type: "text" as const, text: "Residence not found or access denied" }] };
      }
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Residence not found or access denied" }] };
      }
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.residences)
          .set({
            ...(unitNumber !== undefined && { unitNumber }),
            ...(floor !== undefined && { floor }),
            ...(bedrooms !== undefined && { bedrooms }),
            ...(bathrooms !== undefined && { bathrooms: String(bathrooms) }),
            ...(monthlyFees !== undefined && { monthlyFees: String(monthlyFees) }),
            ...(squareFootage !== undefined && { squareFootage: String(squareFootage) }),
            ...(balcony !== undefined && { balcony }),
            ...(parkingSpaceNumbers !== undefined && { parkingSpaceNumbers }),
            ...(storageSpaceNumbers !== undefined && { storageSpaceNumbers }),
            ...(ownershipPercentage !== undefined && { ownershipPercentage: String(ownershipPercentage) }),
            updatedAt: new Date(),
          })
          .where(eq(schema.residences.id, residenceId))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_residence]", e);
        return buildWriteErrorResponse(e, 'residence', 'update');
      }
    }
  );

  server.tool(
    "link_user_to_residence",
    "Link an existing user to an existing residence with a relationship type (admin/manager only)",
    {
      role: roleParam,
      userId: z.string().describe("User ID to link"),
      residenceId: z.string().describe("Residence ID to link to"),
      relationshipType: z.enum(["owner", "tenant", "occupant"]).describe("Relationship type"),
      startDate: z.string().optional().describe("Start date (YYYY-MM-DD); defaults to today"),
    },
    async ({ role, userId, residenceId, relationshipType, startDate }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot link users to residences" }] };
      }
      const orgIds = await getMcpOrgIds();

      const userOrg = await db
        .select({ id: schema.userOrganizations.id })
        .from(schema.userOrganizations)
        .where(
          and(
            eq(schema.userOrganizations.userId, userId),
            inArray(schema.userOrganizations.organizationId, orgIds)
          )
        )
        .limit(1);
      if (userOrg.length === 0) {
        return { content: [{ type: "text" as const, text: "User not found or access denied" }] };
      }

      const [residence] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, residenceId));
      if (!residence) {
        return { content: [{ type: "text" as const, text: "Residence not found or access denied" }] };
      }
      const [building] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Residence not found or access denied" }] };
      }

      const [existing] = await db
        .select()
        .from(schema.userResidences)
        .where(
          and(
            eq(schema.userResidences.userId, userId),
            eq(schema.userResidences.residenceId, residenceId),
            eq(schema.userResidences.isActive, true)
          )
        )
        .limit(1);
      if (existing) {
        return { content: [{ type: "text" as const, text: JSON.stringify(existing, null, 2) }] };
      }

      const effectiveStartDate = startDate ?? new Date().toISOString().slice(0, 10);
      try {
        const [link] = await withRetryableDbCall(() => db
          .insert(schema.userResidences)
          .values({
            userId,
            residenceId,
            relationshipType,
            startDate: effectiveStartDate,
            isActive: true,
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(link, null, 2) }] };
      } catch (e) {
        console.error("[mcp:link_user_to_residence]", e);
        return buildWriteErrorResponse(e, 'user-residence link', 'create');
      }
    }
  );

  server.tool(
    "unlink_user_from_residence",
    "End an existing user-to-residence link by soft-ending the active row (admin/manager only)",
    {
      role: roleParam,
      userId: z.string().describe("User ID to unlink"),
      residenceId: z.string().describe("Residence ID to unlink from"),
      endDate: z.string().optional().describe("End date (YYYY-MM-DD); defaults to today"),
    },
    async ({ role, userId, residenceId, endDate }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot unlink users from residences" }] };
      }
      const orgIds = await getMcpOrgIds();

      const userOrg = await db
        .select({ id: schema.userOrganizations.id })
        .from(schema.userOrganizations)
        .where(
          and(
            eq(schema.userOrganizations.userId, userId),
            inArray(schema.userOrganizations.organizationId, orgIds)
          )
        )
        .limit(1);
      if (userOrg.length === 0) {
        return { content: [{ type: "text" as const, text: "User not found or access denied" }] };
      }

      const [residence] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, residenceId));
      if (!residence) {
        return { content: [{ type: "text" as const, text: "Residence not found or access denied" }] };
      }
      const [building] = await db
        .select()
        .from(schema.buildings)
        .where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Residence not found or access denied" }] };
      }

      const [existing] = await db
        .select()
        .from(schema.userResidences)
        .where(
          and(
            eq(schema.userResidences.userId, userId),
            eq(schema.userResidences.residenceId, residenceId),
            eq(schema.userResidences.isActive, true)
          )
        )
        .limit(1);
      if (!existing) {
        return { content: [{ type: "text" as const, text: "No active link between user and residence" }] };
      }

      const effectiveEndDate = endDate ?? new Date().toISOString().slice(0, 10);
      // Per shared/schemas/property.ts userResidences write contract
      // (Task #144): ending a residency MUST set BOTH `isActive = false`
      // AND `endDate` so reads (which only consult `isActive`) and the
      // informational `endDate` stay aligned.
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.userResidences)
          .set({ isActive: false, endDate: effectiveEndDate, updatedAt: new Date() })
          .where(eq(schema.userResidences.id, existing.id))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:unlink_user_from_residence]", e);
        return buildWriteErrorResponse(e, 'user-residence link', 'update');
      }
    }
  );

  server.tool(
    "list_users",
    "List users in an MCP organization (admin/manager only)",
    // Task #260: organizationId is REQUIRED so callers cannot accidentally
    // page across every MCP-scoped org in a single call. Use list_organizations
    // to discover ids, then call this tool once per org as needed.
    { role: roleParam, organizationId: z.string().describe("Organization ID to list users from (required)") },
    async ({ role, organizationId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot list users" }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const userOrgs = await db
        .select({
          userId: schema.userOrganizations.userId,
          organizationId: schema.userOrganizations.organizationId,
        })
        .from(schema.userOrganizations)
        .where(
          and(eq(schema.userOrganizations.organizationId, organizationId), eq(schema.userOrganizations.isActive, true))
        );
      const userIds = [...new Set(userOrgs.map((uo) => uo.userId))];
      if (userIds.length === 0) return { content: [{ type: "text" as const, text: "[]" }] };
      const users = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          role: schema.users.role,
          isActive: schema.users.isActive,
          language: schema.users.language,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds));
      return { content: [{ type: "text" as const, text: JSON.stringify(users, null, 2) }] };
    }
  );

  server.tool(
    "get_user",
    "Get details of a specific user (admin/manager only)",
    { role: roleParam, userId: z.string().describe("User ID") },
    async ({ role, userId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view user details" }] };
      }
      const orgIds = await getMcpOrgIds();
      const userOrg = await db
        .select()
        .from(schema.userOrganizations)
        .where(and(eq(schema.userOrganizations.userId, userId), inArray(schema.userOrganizations.organizationId, orgIds)))
        .limit(1);
      if (userOrg.length === 0) {
        return { content: [{ type: "text" as const, text: "User not found in MCP organizations" }] };
      }
      const [user] = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          role: schema.users.role,
          isActive: schema.users.isActive,
          language: schema.users.language,
          phone: schema.users.phone,
          createdAt: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      return { content: [{ type: "text" as const, text: user ? JSON.stringify(user, null, 2) : "User not found" }] };
    }
  );

  server.tool(
    "list_bills",
    "List bills for a building",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      status: z.enum(["draft", "sent", "overdue", "paid", "cancelled"]).optional().describe("Filter by status"),
    },
    async ({ role, buildingId, status }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view bills" }] };
      }
      try {
        const orgIds = await getMcpOrgIds();
        const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
        if (!building || !orgIds.includes(building.organizationId)) {
          return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
        }
        const conditions = [eq(schema.bills.buildingId, buildingId)];
        if (status) conditions.push(eq(schema.bills.status, status));
        const bills = await db
          .select()
          .from(schema.bills)
          .where(and(...conditions))
          .orderBy(desc(schema.bills.createdAt));
        return { content: [{ type: "text" as const, text: JSON.stringify(bills, null, 2) }] };
      } catch (e) {
        // Never leak the underlying SQL or driver error message to the
        // MCP caller — it can include the full query text. Log the
        // detail server-side and return a generic body instead.
        // The whole DB-interaction block (org lookup, building lookup,
        // and the bills query itself) is wrapped so that *any* Drizzle
        // failure ends up here, not just the bills query.
        console.error("[mcp:list_bills]", e);
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Internal server error" }) }] };
      }
    }
  );

  server.tool(
    "get_bill",
    "Get details of a specific bill",
    { role: roleParam, billId: z.string().describe("Bill ID") },
    async ({ role, billId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view bills" }] };
      }
      try {
        const orgIds = await getMcpOrgIds();
        const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, billId));
        if (!bill) return { content: [{ type: "text" as const, text: "Bill not found" }] };
        const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, bill.buildingId));
        if (!building || !orgIds.includes(building.organizationId)) {
          return { content: [{ type: "text" as const, text: "Access denied" }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(bill, null, 2) }] };
      } catch (e) {
        // See list_bills above — every DB call in this handler is wrapped
        // so no Drizzle/SQL error reaches the MCP caller.
        console.error("[mcp:get_bill]", e);
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Internal server error" }) }] };
      }
    }
  );

  server.tool(
    "create_bill",
    "Create a new bill for a building (admin/manager only)",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      title: z.string().describe("Bill title"),
      category: z.enum([
        "administration", "cleaning", "construction", "consulting", "equipment_rental",
        "insurance", "landscaping", "legal_services", "maintenance", "professional_services",
        "repairs", "reserves", "salary", "security", "supplies", "taxes", "technology", "utilities", "other",
      ]).describe("Bill category"),
      totalAmount: z.number().positive().describe("Total amount"),
      paymentType: z.enum(["unique", "recurrent"]).describe("Payment type"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
    },
    async ({ role, buildingId, title, category, totalAmount, paymentType, startDate }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create bills" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const user = await getMcpUser(role);
      try {
        const { isBillNumberV2Enabled } = await import("../utils/feature-flags");
        const {
          generateBillNumberV2,
          resolveOrgCodeForBuilding,
          withBillNumberRetry,
        } = await import("../services/bill-number-generator");

        const mintNumber = async (): Promise<string> => {
          if (isBillNumberV2Enabled()) {
            const orgCode = await resolveOrgCodeForBuilding(buildingId);
            return generateBillNumberV2({
              orgCode,
              billingPeriod: startDate,
              category,
            });
          }
          return `MCP-${Date.now()}`;
        };

        const inserted = await withBillNumberRetry(mintNumber, async (billNumber) => {
          const rows = await withRetryableDbCall(() => db
            .insert(schema.bills)
            .values({
              buildingId,
              billNumber,
              source: "mcp",
              title,
              category,
              totalAmount: String(totalAmount),
              costs: [String(totalAmount)],
              paymentType,
              startDate,
              status: "draft",
              createdBy: user?.id,
            })
            .returning());
          return rows as any[];
        });
        const bill = (inserted as any[])[0];
        return { content: [{ type: "text" as const, text: JSON.stringify(bill, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_bill]", e);
        return buildWriteErrorResponse(e, 'bill', 'create');
      }
    }
  );

  server.tool(
    "update_bill_status",
    "Update the status of a bill (admin/manager only)",
    {
      role: roleParam,
      billId: z.string().describe("Bill ID"),
      status: z.enum(["draft", "sent", "overdue", "paid", "cancelled"]).describe("New status"),
    },
    async ({ role, billId, status }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update bills" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, billId));
      if (!bill) return { content: [{ type: "text" as const, text: "Bill not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, bill.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      try {
        const [updated] = await withRetryableDbCall(() => db.update(schema.bills).set({ status, updatedAt: new Date() }).where(eq(schema.bills.id, billId)).returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_bill_status]", e);
        return buildWriteErrorResponse(e, 'bill', 'update');
      }
    }
  );

  server.tool(
    "list_maintenance_requests",
    "List maintenance requests for residences in a building",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      status: z.enum(["submitted", "acknowledged", "in_progress", "completed", "cancelled"]).optional().describe("Filter by status"),
    },
    async ({ role, buildingId, status }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const residenceIds = (
        await db.select({ id: schema.residences.id }).from(schema.residences).where(eq(schema.residences.buildingId, buildingId))
      ).map((r) => r.id);
      if (residenceIds.length === 0) return { content: [{ type: "text" as const, text: "[]" }] };

      const conditions: SQL[] = [inArray(schema.maintenanceRequests.residenceId, residenceIds)];
      if (status) conditions.push(eq(schema.maintenanceRequests.status, status));

      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (user) conditions.push(eq(schema.maintenanceRequests.submittedBy, user.id));
      }

      const requests = await db
        .select()
        .from(schema.maintenanceRequests)
        .where(and(...conditions))
        .orderBy(desc(schema.maintenanceRequests.createdAt));
      return { content: [{ type: "text" as const, text: JSON.stringify(requests, null, 2) }] };
    }
  );

  server.tool(
    "get_maintenance_request",
    "Get details of a specific maintenance request",
    { role: roleParam, requestId: z.string().describe("Maintenance request ID") },
    async ({ role, requestId }) => {
      const orgIds = await getMcpOrgIds();
      const [request] = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, requestId));
      if (!request) return { content: [{ type: "text" as const, text: "Request not found" }] };
      const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, request.residenceId));
      if (!residence) return { content: [{ type: "text" as const, text: "Residence not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (!user || request.submittedBy !== user.id) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants can only view their own requests" }] };
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(request, null, 2) }] };
    }
  );

  server.tool(
    "create_maintenance_request",
    "Create a new maintenance request",
    {
      role: roleParam,
      residenceId: z.string().describe("Residence ID"),
      title: z.string().describe("Request title"),
      description: z.string().describe("Detailed description"),
      category: z.string().describe("Category (plumbing, electrical, hvac, general, etc.)"),
      priority: z.enum(["low", "medium", "high", "urgent", "emergency"]).default("medium").describe("Priority level"),
    },
    async ({ role, residenceId, title, description, category, priority }) => {
      const orgIds = await getMcpOrgIds();
      const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
      if (!residence) return { content: [{ type: "text" as const, text: "Residence not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const user = await getMcpUser(role);
      // Tenant scope guard: a tenant may only create maintenance requests for
      // a residence they are actually linked to via `userResidences`. Without
      // this check the residence-in-MCP-org check above is the only barrier,
      // which lets any tenant write against any residence in the sandbox.
      // Per Task #144, authorization checks require an ACTIVE link
      // (`userResidences.isActive = true`).
      if (role === "tenant") {
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };
        const [link] = await db
          .select({ id: schema.userResidences.id })
          .from(schema.userResidences)
          .where(
            and(
              eq(schema.userResidences.userId, user.id),
              eq(schema.userResidences.residenceId, residenceId),
              eq(schema.userResidences.isActive, true)
            )
          )
          .limit(1);
        if (!link) {
          return { content: [{ type: "text" as const, text: "Access denied: tenant is not linked to this residence" }] };
        }
      }
      try {
        const [request] = await withRetryableDbCall(() => db
          .insert(schema.maintenanceRequests)
          .values({ residenceId, title, description, category, priority, submittedBy: user?.id, status: "submitted" })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(request, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_maintenance_request]", e);
        return buildWriteErrorResponse(e, 'maintenance request', 'create');
      }
    }
  );

  server.tool(
    "update_maintenance_request",
    "Update a maintenance request status (admin/manager only)",
    {
      role: roleParam,
      requestId: z.string().describe("Maintenance request ID"),
      status: z.enum(["submitted", "acknowledged", "in_progress", "completed", "cancelled"]).describe("New status"),
      notes: z.string().optional().describe("Notes about the update"),
    },
    async ({ role, requestId, status, notes }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update maintenance request status" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [request] = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, requestId));
      if (!request) return { content: [{ type: "text" as const, text: "Request not found" }] };
      const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, request.residenceId));
      if (!residence) return { content: [{ type: "text" as const, text: "Residence not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, residence.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const user = await getMcpUser(role);
      try {
        const [updated] = await withRetryableDbCall(() => db.update(schema.maintenanceRequests).set({
          status,
          updatedAt: new Date(),
          ...(notes && { notes }),
          ...(status === "completed" && { completedDate: new Date() }),
          ...(user && { assignedTo: user.id }),
        }).where(eq(schema.maintenanceRequests.id, requestId)).returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_maintenance_request]", e);
        return buildWriteErrorResponse(e, 'maintenance request', 'update');
      }
    }
  );

  // Shared schema for the optional `attachment` parameter on the demand and
  // demand-comment creation tools. Mirrors the shape REST callers send to
  // POST /api/demands (`attachments[0]`): an object-storage URL, an optional
  // original filename, and an optional byte size. The normalize/verify/apply
  // helpers live in `server/utils/demand-attachment-acl` so the REST handlers
  // and the MCP tools share a single ACL implementation.
  const demandAttachmentParam = z
    .object({
      url: z.string().min(1).describe("Object-storage URL or path (typically `/objects/...`) returned by an upload helper."),
      originalName: z.string().optional().describe("Original filename to display in the UI."),
      size: z.number().int().nonnegative().optional().describe("File size in bytes."),
    })
    .optional()
    .describe("Optional single-file attachment. ACL is verified for ownership and bound to the calling user.");

  server.tool(
    "list_demands",
    "List demands (requests/complaints) for a building",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      status: z.enum(["draft", "submitted", "under_review", "approved", "in_progress", "completed", "rejected", "cancelled"]).optional().describe("Filter by status"),
    },
    async ({ role, buildingId, status }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const conditions: SQL[] = [eq(schema.demands.buildingId, buildingId)];
      if (status) conditions.push(eq(schema.demands.status, status));
      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (user) conditions.push(eq(schema.demands.submitterId, user.id));
      }
      const demandsList = await db
        .select()
        .from(schema.demands)
        .where(and(...conditions))
        .orderBy(desc(schema.demands.createdAt));
      return { content: [{ type: "text" as const, text: JSON.stringify(demandsList, null, 2) }] };
    }
  );

  server.tool(
    "get_demand",
    "Get details of a specific demand",
    { role: roleParam, demandId: z.string().describe("Demand ID") },
    async ({ role, demandId }) => {
      const orgIds = await getMcpOrgIds();
      const [demand] = await db.select().from(schema.demands).where(eq(schema.demands.id, demandId));
      if (!demand) return { content: [{ type: "text" as const, text: "Demand not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, demand.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (!user || demand.submitterId !== user.id) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants can only view their own demands" }] };
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(demand, null, 2) }] };
    }
  );

  server.tool(
    "create_demand",
    "Create a new demand (request/complaint). Optionally attach a single file by passing an `attachment` (e.g. an object-storage URL the assistant just uploaded). The ACL on `/objects/...` paths is verified for ownership and then bound to the calling user, mirroring POST /api/demands.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      type: z.enum(["complaint", "information", "maintenance", "other"]).describe("Demand type"),
      description: z.string().describe("Detailed description"),
      residenceId: z.string().optional().describe("Optional residence ID"),
      attachment: demandAttachmentParam,
    },
    async ({ role, buildingId, type, description, residenceId, attachment }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      // Residence pre-flight check (Task #622): mirrors the building check above.
      // Without this, a bad `residenceId` falls through to the INSERT and trips
      // an FK violation that gets swallowed by the generic catch-block message
      // ("Failed to create demand — please retry"). Catching it up-front lets
      // us return a precise 404-style message to the caller.
      if (residenceId) {
        const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
        if (!residence || residence.buildingId !== buildingId) {
          return { content: [{ type: "text" as const, text: "Residence not found or does not belong to the specified building" }] };
        }
      }
      const user = await getMcpUser(role);
      // Tenant scope guard: when a tenant supplies a residenceId, they must be
      // linked to that residence. Demands without a residenceId remain allowed
      // because they are building-scoped (e.g. a general complaint).
      // Per Task #144, authorization checks require an ACTIVE link
      // (`userResidences.isActive = true`).
      if (role === "tenant" && residenceId) {
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };
        const [link] = await db
          .select({ id: schema.userResidences.id })
          .from(schema.userResidences)
          .where(
            and(
              eq(schema.userResidences.userId, user.id),
              eq(schema.userResidences.residenceId, residenceId),
              eq(schema.userResidences.isActive, true)
            )
          )
          .limit(1);
        if (!link) {
          return { content: [{ type: "text" as const, text: "Access denied: tenant is not linked to this residence" }] };
        }
      }
      // Resolve attachment + verify ACL ownership on object-storage paths
      // before we accept the path binding. If an attachment is supplied we
      // refuse the request entirely when we cannot resolve the calling user,
      // so attachment metadata is never persisted without an enforced ACL
      // owner — matching POST /api/demands behavior.
      const fileInfo = normalizeAttachmentInput(attachment);
      if (fileInfo.filePath && !user) {
        return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      }
      if (fileInfo.filePath && user) {
        const aclError = await verifyAttachmentOwnership(
          fileInfo.filePath,
          user.id,
          "[mcp:create_demand]"
        );
        if (aclError) {
          return { content: [{ type: "text" as const, text: aclError }] };
        }
      }
      try {
        const [demand] = await withRetryableDbCall(() => db.insert(schema.demands).values({
          buildingId,
          type,
          description,
          submitterId: user?.id,
          status: "submitted" as const,
          ...(residenceId && { residenceId }),
          ...(fileInfo.filePath && { filePath: fileInfo.filePath }),
          ...(fileInfo.fileName && { fileName: fileInfo.fileName }),
          ...(fileInfo.fileSize !== undefined && { fileSize: fileInfo.fileSize }),
        }).returning());
        if (fileInfo.filePath && user) {
          await applyAttachmentAcl(fileInfo.filePath, user.id, "[mcp:create_demand]");
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(demand, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_demand]", e);
        const response = buildWriteErrorResponse(e, 'demand', 'create');
        // Task #622: surface raw driver error in non-production so developers
        // can see the actual DB failure (FK violation detail, etc.) instead of
        // only the friendly wrapper. Production responses are unchanged.
        if (process.env.NODE_ENV !== 'production') {
          const rawMessage = (e as { message?: unknown } | null)?.message;
          if (typeof rawMessage === 'string' && rawMessage.length > 0) {
            response.content.push({ type: "text" as const, text: `[dev] ${rawMessage}` });
          }
        }
        return response;
      }
    }
  );

  server.tool(
    "update_demand_status",
    "Update the status of a demand (admin/manager only). Mirrors the REST PUT /api/demands/:id behavior: records reviewedBy/reviewedAt when status changes and notifies the submitter.",
    {
      role: roleParam,
      demandId: z.string().describe("Demand ID"),
      status: z
        .enum([
          "draft",
          "submitted",
          "under_review",
          "approved",
          "in_progress",
          "completed",
          "rejected",
          "cancelled",
        ])
        .describe("New status"),
      reviewNotes: z.string().optional().describe("Optional review notes"),
    },
    async ({ role, demandId, status, reviewNotes }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update demand status" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [demand] = await db.select().from(schema.demands).where(eq(schema.demands.id, demandId));
      if (!demand) return { content: [{ type: "text" as const, text: "Demand not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, demand.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const user = await getMcpUser(role);
      const statusChanged = status !== demand.status;
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.demands)
          .set({
            status,
            updatedAt: new Date(),
            ...(reviewNotes !== undefined && { reviewNotes }),
            ...(statusChanged && user && { reviewedBy: user.id, reviewedAt: new Date() }),
          })
          .where(eq(schema.demands.id, demandId))
          .returning());
        if (user && demand.submitterId && demand.submitterId !== user.id) {
          demandNotificationService
            .notifyDemandEdited(demandId, user.id, demand.submitterId)
            .catch((err) => console.error("[mcp:update_demand_status] notify failed", err));
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_demand_status]", e);
        return buildWriteErrorResponse(e, 'demand', 'update');
      }
    }
  );

  server.tool(
    "list_demand_comments",
    "List comments on a demand, joined with author info. Tenants only see comments on their own demands and never see internal (manager-only) comments.",
    { role: roleParam, demandId: z.string().describe("Demand ID") },
    async ({ role, demandId }) => {
      const orgIds = await getMcpOrgIds();
      const [demand] = await db.select().from(schema.demands).where(eq(schema.demands.id, demandId));
      if (!demand) return { content: [{ type: "text" as const, text: "Demand not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, demand.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      if (role === "tenant") {
        const user = await getMcpUser("tenant");
        if (!user || demand.submitterId !== user.id) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants can only view comments on their own demands" }] };
        }
      }
      const comments = await db
        .select({
          id: schema.demandComments.id,
          demandId: schema.demandComments.demandId,
          commentText: schema.demandComments.commentText,
          commentType: schema.demandComments.commentType,
          isInternal: schema.demandComments.isInternal,
          commenterId: schema.demandComments.commenterId,
          createdAt: schema.demandComments.createdAt,
          author: {
            id: schema.users.id,
            firstName: schema.users.firstName,
            lastName: schema.users.lastName,
            email: schema.users.email,
          },
        })
        .from(schema.demandComments)
        .innerJoin(schema.users, eq(schema.demandComments.commenterId, schema.users.id))
        .where(eq(schema.demandComments.demandId, demandId))
        .orderBy(asc(schema.demandComments.createdAt));
      const visible = role === "tenant" ? comments.filter((c) => !c.isInternal) : comments;
      return { content: [{ type: "text" as const, text: JSON.stringify(visible, null, 2) }] };
    }
  );

  server.tool(
    "create_demand_comment",
    "Add a comment to a demand. Tenants may only comment on their own demands and cannot post internal (manager-only) comments. Triggers the demand-commented notification flow. Optionally attach a single file by passing an `attachment` (e.g. an object-storage URL the assistant just uploaded); the ACL check + binding mirrors the demand attachment flow.",
    {
      role: roleParam,
      demandId: z.string().describe("Demand ID"),
      commentText: z.string().describe("Comment body (1-1000 characters)"),
      commentType: z.string().optional().describe("Optional comment type"),
      isInternal: z.boolean().optional().describe("Internal/manager-only comment (admin/manager only). Defaults to false."),
      attachment: demandAttachmentParam,
    },
    async ({ role, demandId, commentText, commentType, isInternal, attachment }) => {
      if (role === "tenant" && isInternal === true) {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot post internal comments" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [demand] = await db.select().from(schema.demands).where(eq(schema.demands.id, demandId));
      if (!demand) return { content: [{ type: "text" as const, text: "Demand not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, demand.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const user = await getMcpUser(role);
      if (!user) {
        return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      }
      if (role === "tenant" && demand.submitterId !== user.id) {
        return { content: [{ type: "text" as const, text: "Access denied: tenants can only comment on their own demands" }] };
      }
      const fileInfo = normalizeAttachmentInput(attachment);
      if (fileInfo.filePath) {
        const aclError = await verifyAttachmentOwnership(
          fileInfo.filePath,
          user.id,
          "[mcp:create_demand_comment]"
        );
        if (aclError) {
          return { content: [{ type: "text" as const, text: aclError }] };
        }
      }
      const parsed = insertDemandCommentSchema.safeParse({
        demandId,
        commenterId: user.id,
        commentText,
        commentType,
        isInternal: isInternal ?? false,
        ...(fileInfo.filePath && { filePath: fileInfo.filePath }),
        ...(fileInfo.fileName && { fileName: fileInfo.fileName }),
        ...(fileInfo.fileSize !== undefined && { fileSize: fileInfo.fileSize }),
      });
      if (!parsed.success) {
        return { content: [{ type: "text" as const, text: `Invalid comment data: ${parsed.error.issues.map((i) => i.message).join(", ")}` }] };
      }
      try {
        // Explicit insert payload (rather than `parsed.data` directly) so the
        // required columns stay non-optional for Drizzle's insert overload.
        const insertValues = {
          demandId,
          commenterId: user.id,
          commentText,
          commentType,
          isInternal: isInternal ?? false,
          ...(fileInfo.filePath && { filePath: fileInfo.filePath }),
          ...(fileInfo.fileName && { fileName: fileInfo.fileName }),
          ...(fileInfo.fileSize !== undefined && { fileSize: fileInfo.fileSize }),
        };
        const [comment] = await withRetryableDbCall(() => db
          .insert(schema.demandComments)
          .values(insertValues)
          .returning());
        if (fileInfo.filePath) {
          await applyAttachmentAcl(fileInfo.filePath, user.id, "[mcp:create_demand_comment]");
        }
        if (demand.submitterId) {
          demandNotificationService
            .notifyDemandCommented(demandId, user.id, role, demand.submitterId, demand.buildingId)
            .catch((err) => console.error("[mcp:create_demand_comment] notify failed", err));
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(comment, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_demand_comment]", e);
        return buildWriteErrorResponse(e, 'demand comment', 'create');
      }
    }
  );

  server.tool(
    "list_common_spaces",
    "List common spaces in a building",
    { role: roleParam, buildingId: z.string().describe("Building ID") },
    async ({ role, buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const spaces = await db.select().from(schema.commonSpaces).where(eq(schema.commonSpaces.buildingId, buildingId));
      return { content: [{ type: "text" as const, text: JSON.stringify(spaces, null, 2) }] };
    }
  );

  // ============================================================
  // Common-spaces extended MCP coverage (Task #194).
  //
  // The helpers in `../api/common-spaces-rules` are the SAME ones the
  // resident/manager REST routes use, so opening-hours, user time-limit,
  // blocked-user, and conflict-detection behaviour are guaranteed to
  // match between the web UI and these MCP tools.
  // ============================================================

  // Compute the set of buildings the MCP-acting user can actually
  // touch, mirroring REST's `getAccessibleBuildingIds`
  // (`server/api/common-spaces.ts`) and clamped by the MCP-scoped org
  // allowlist so an OAuth manager can never reach buildings outside
  // MCP scope. Resolution order matches REST exactly:
  //   1. admin role                                  -> every active
  //                                                     building (clamped)
  //   2. Koveo / canAccessAllOrganizations link      -> every active
  //                                                     building (clamped)
  //   3. manager role with active userOrganizations  -> buildings of
  //                                                     those orgs (clamped)
  //   4. fallback (incl. tenants and managers w/o
  //      org link)                                   -> active
  //                                                     userResidences
  //                                                     building links
  //                                                     (clamped)
  // Returns `null` when the MCP user record cannot be resolved.
  async function getMcpAccessibleBuildingIds(role: McpRole): Promise<string[] | null> {
    const user = await getMcpUser(role);
    if (!user) return null;
    const mcpOrgIds = await getMcpOrgIds();
    if (mcpOrgIds.length === 0) return [];

    const allActiveBuildings = async (): Promise<string[]> => {
      const rows = await db
        .select({ buildingId: schema.buildings.id })
        .from(schema.buildings)
        .where(
          and(
            eq(schema.buildings.isActive, true),
            inArray(schema.buildings.organizationId, mcpOrgIds)
          )
        );
      return rows.map((r) => r.buildingId);
    };

    if (role === "admin") return allActiveBuildings();

    const userOrgs = await db
      .select({
        organizationId: schema.userOrganizations.organizationId,
        organizationName: schema.organizations.name,
        canAccessAllOrganizations: schema.userOrganizations.canAccessAllOrganizations,
      })
      .from(schema.userOrganizations)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.userOrganizations.organizationId)
      )
      .where(
        and(
          eq(schema.userOrganizations.userId, user.id),
          eq(schema.userOrganizations.isActive, true)
        )
      );

    const hasGlobalAccess = userOrgs.some(
      (o) => o.organizationName === "Koveo" || o.canAccessAllOrganizations
    );
    if (hasGlobalAccess) return allActiveBuildings();

    if (role === "manager" && userOrgs.length > 0) {
      const userOrgIds = userOrgs
        .map((o) => o.organizationId)
        .filter((id) => mcpOrgIds.includes(id));
      if (userOrgIds.length > 0) {
        const rows = await db
          .select({ buildingId: schema.buildings.id })
          .from(schema.buildings)
          .where(
            and(
              inArray(schema.buildings.organizationId, userOrgIds),
              eq(schema.buildings.isActive, true)
            )
          );
        return rows.map((r) => r.buildingId);
      }
      // fall through to residence-linked path if no MCP-scoped org link
    }

    // Fallback: residence-linked buildings (covers tenants and the
    // manager-without-org-link case, matching REST behaviour).
    const rows = await db
      .selectDistinct({ buildingId: schema.residences.buildingId })
      .from(schema.userResidences)
      .innerJoin(schema.residences, eq(schema.residences.id, schema.userResidences.residenceId))
      .innerJoin(schema.buildings, eq(schema.buildings.id, schema.residences.buildingId))
      .where(
        and(
          eq(schema.userResidences.userId, user.id),
          eq(schema.userResidences.isActive, true),
          eq(schema.buildings.isActive, true),
          inArray(schema.buildings.organizationId, mcpOrgIds)
        )
      );
    return rows.map((r) => r.buildingId);
  }

  // Resolve the space, then verify the MCP-acting user actually has
  // access to its building (admin/manager/tenant rules, see
  // `getMcpAccessibleBuildingIds`).
  async function authorizeSpaceAccess(role: McpRole, spaceId: string): Promise<
    | { ok: true; space: { id: string; name: string; buildingId: string; isReservable: boolean; openingHours: unknown }; userId: string }
    | { ok: false; response: { content: Array<{ type: "text"; text: string }> } }
  > {
    const space = await commonSpaceRules.loadCommonSpaceForBookingChecks(spaceId);
    if (!space) {
      return { ok: false, response: { content: [{ type: "text" as const, text: "Common space not found" }] } };
    }
    const user = await getMcpUser(role);
    if (!user) {
      return { ok: false, response: { content: [{ type: "text" as const, text: `MCP ${role} user not found` }] } };
    }
    const accessible = await getMcpAccessibleBuildingIds(role);
    if (!accessible || !accessible.includes(space.buildingId)) {
      return { ok: false, response: { content: [{ type: "text" as const, text: "Access denied: you do not have access to the building containing this common space" }] } };
    }
    return { ok: true, space, userId: user.id };
  }

  server.tool(
    "get_common_space",
    "Get details of a specific common space",
    { role: roleParam, spaceId: z.string().describe("Common space ID") },
    async ({ role, spaceId }) => {
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const [space] = await db.select().from(schema.commonSpaces).where(eq(schema.commonSpaces.id, spaceId));
      return { content: [{ type: "text" as const, text: JSON.stringify(space, null, 2) }] };
    }
  );

  server.tool(
    "list_common_space_bookings",
    "List bookings for a common space, optionally filtered by date range. Tenants only see their own bookings; admins/managers see all.",
    {
      role: roleParam,
      spaceId: z.string().describe("Common space ID"),
      startDate: z.string().optional().describe("ISO datetime; only bookings starting at or after this are returned"),
      endDate: z.string().optional().describe("ISO datetime; only bookings ending at or before this are returned"),
    },
    async ({ role, spaceId, startDate, endDate }) => {
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const conditions = [eq(schema.bookings.commonSpaceId, spaceId)];
      if (startDate) {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) {
          return { content: [{ type: "text" as const, text: "Invalid startDate: expected ISO datetime string" }] };
        }
        conditions.push(gte(schema.bookings.startTime, d));
      }
      if (endDate) {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) {
          return { content: [{ type: "text" as const, text: "Invalid endDate: expected ISO datetime string" }] };
        }
        conditions.push(lte(schema.bookings.endTime, d));
      }
      if (role === "tenant" && auth.userId) {
        conditions.push(eq(schema.bookings.userId, auth.userId));
      }
      const rows = await db
        .select({
          id: schema.bookings.id,
          commonSpaceId: schema.bookings.commonSpaceId,
          userId: schema.bookings.userId,
          userName: sql<string>`CONCAT(${schema.users.firstName}, ' ', ${schema.users.lastName})`,
          userEmail: schema.users.email,
          startTime: schema.bookings.startTime,
          endTime: schema.bookings.endTime,
          status: schema.bookings.status,
          createdAt: schema.bookings.createdAt,
        })
        .from(schema.bookings)
        .innerJoin(schema.users, eq(schema.bookings.userId, schema.users.id))
        .where(and(...conditions))
        .orderBy(asc(schema.bookings.startTime));
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "list_my_common_space_bookings",
    "List the current MCP user's bookings (any status) across MCP-scoped common spaces. For tenants, only buildings where the user still has an active userResidences link are included.",
    { role: roleParam },
    async ({ role }) => {
      const user = await getMcpUser(role);
      if (!user) return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      // Restrict to buildings the MCP-acting user can actually see
      // (mirrors REST getAccessibleBuildingIds, role-aware, and already
      // clamped to MCP-scoped orgs).
      const accessibleBuildingIds = await getMcpAccessibleBuildingIds(role);
      if (!accessibleBuildingIds || accessibleBuildingIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify([], null, 2) }] };
      }
      const conditions = [
        eq(schema.bookings.userId, user.id),
        inArray(schema.commonSpaces.buildingId, accessibleBuildingIds),
      ];
      const rows = await db
        .select({
          id: schema.bookings.id,
          commonSpaceId: schema.bookings.commonSpaceId,
          commonSpaceName: schema.commonSpaces.name,
          buildingId: schema.commonSpaces.buildingId,
          buildingName: schema.buildings.name,
          startTime: schema.bookings.startTime,
          endTime: schema.bookings.endTime,
          status: schema.bookings.status,
          createdAt: schema.bookings.createdAt,
        })
        .from(schema.bookings)
        .innerJoin(schema.commonSpaces, eq(schema.bookings.commonSpaceId, schema.commonSpaces.id))
        .innerJoin(schema.buildings, eq(schema.commonSpaces.buildingId, schema.buildings.id))
        .where(and(...conditions))
        .orderBy(desc(schema.bookings.startTime));
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "get_common_space_availability",
    "Compute available booking windows for a common space on a given date (America/Montreal). Returns the configured opening hours for the day, all confirmed bookings for that day, and the resulting free slots.",
    {
      role: roleParam,
      spaceId: z.string().describe("Common space ID"),
      date: z.string().describe("Target date (YYYY-MM-DD) interpreted in America/Montreal"),
    },
    async ({ role, spaceId, date }) => {
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const space = auth.space;
      const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (!dayMatch) {
        return { content: [{ type: "text" as const, text: "Invalid date: expected YYYY-MM-DD" }] };
      }
      // Compute the UTC instants for [00:00, 24:00) America/Montreal on
      // the requested calendar date — DST-safe (offset is -05:00 in
      // winter, -04:00 in summer; this works year-round).
      const tz = "America/Montreal";
      const tzOffsetMinutes = (instant: Date): number => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }).formatToParts(instant);
        const get = (t: string) => parts.find((p) => p.type === t)!.value;
        const asUtc = Date.UTC(
          parseInt(get("year")), parseInt(get("month")) - 1, parseInt(get("day")),
          parseInt(get("hour")) % 24, parseInt(get("minute")), parseInt(get("second"))
        );
        return (asUtc - instant.getTime()) / 60000;
      };
      const candidate = new Date(`${date}T00:00:00Z`);
      const offMin = tzOffsetMinutes(candidate);
      const dayStart = new Date(candidate.getTime() - offMin * 60000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const weekday = dayStart
        .toLocaleDateString("en-US", { weekday: "long", timeZone: tz })
        .toLowerCase();
      const hours = commonSpaceRules.normalizeOpeningHours(space.openingHours);
      const dayHours = hours.find((h) => h.day && h.day.toLowerCase() === weekday);

      // Include any booking that overlaps the day window (start < dayEnd
      // AND end > dayStart), not just bookings fully contained in it,
      // so cross-midnight reservations are not silently ignored.
      const dayBookings = await db
        .select({
          id: schema.bookings.id,
          startTime: schema.bookings.startTime,
          endTime: schema.bookings.endTime,
        })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.commonSpaceId, spaceId),
            eq(schema.bookings.status, "confirmed"),
            lte(schema.bookings.startTime, dayEnd),
            gte(schema.bookings.endTime, dayStart)
          )
        )
        .orderBy(asc(schema.bookings.startTime));

      let freeSlots: Array<{ start: string; end: string }> = [];
      if (dayHours) {
        const toMinutes = (t: string) => {
          const [h, m] = t.split(":").map((n) => parseInt(n, 10));
          return h * 60 + m;
        };
        const fmt = (mins: number) =>
          `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
        const open = toMinutes(dayHours.open);
        const close = toMinutes(dayHours.close);
        // Express each booking as minutes-from-dayStart in absolute time,
        // then clip to the opening window. This handles cross-midnight
        // bookings correctly (e.g. 22:00 -> 02:00 next day shows up as a
        // busy block ending at `close` on the earlier day and starting at
        // `open` on the later day).
        const busy = dayBookings
          .map((b) => {
            const s = new Date(b.startTime as unknown as string);
            const e = new Date(b.endTime as unknown as string);
            const sm = Math.round((s.getTime() - dayStart.getTime()) / 60000);
            const em = Math.round((e.getTime() - dayStart.getTime()) / 60000);
            return { sm: Math.max(sm, open), em: Math.min(em, close) };
          })
          .filter((b) => b.em > b.sm)
          .sort((a, b) => a.sm - b.sm);
        let cursor = open;
        for (const b of busy) {
          if (b.sm > cursor) freeSlots.push({ start: fmt(cursor), end: fmt(b.sm) });
          cursor = Math.max(cursor, b.em);
        }
        if (cursor < close) freeSlots.push({ start: fmt(cursor), end: fmt(close) });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                spaceId,
                date,
                isReservable: space.isReservable,
                openingHours: dayHours ?? null,
                bookings: dayBookings,
                freeSlots,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "create_common_space_booking",
    "Create a booking for a common space. Enforces opening hours, blocked-user rules, monthly/yearly time limits, and overlap detection — identical to the REST API used by the resident UI.",
    {
      role: roleParam,
      spaceId: z.string().describe("Common space ID"),
      startTime: z.string().describe("ISO datetime for booking start"),
      endTime: z.string().describe("ISO datetime for booking end"),
    },
    async ({ role, spaceId, startTime, endTime }) => {
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const space = auth.space;
      if (!space.isReservable) {
        return { content: [{ type: "text" as const, text: "This common space is not reservable" }] };
      }
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { content: [{ type: "text" as const, text: "Invalid startTime or endTime: expected ISO datetime strings" }] };
      }
      if (start >= end) {
        return { content: [{ type: "text" as const, text: "Invalid time range: startTime must be before endTime" }] };
      }
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (start < fiveMinutesAgo) {
        return { content: [{ type: "text" as const, text: "Cannot book in the past" }] };
      }
      const user = await getMcpUser(role);
      if (!user) return { content: [{ type: "text" as const, text: "MCP user not found" }] };

      if (await commonSpaceRules.isUserBlocked(user.id, spaceId)) {
        return { content: [{ type: "text" as const, text: "Access denied: you are blocked from booking this space" }] };
      }
      const hours = commonSpaceRules.normalizeOpeningHours(space.openingHours);
      if (hours.length > 0 && !commonSpaceRules.isWithinOpeningHours(start, end, hours)) {
        return { content: [{ type: "text" as const, text: "Booking time is outside opening hours" }] };
      }
      if (await commonSpaceRules.hasOverlappingBookings(spaceId, start, end)) {
        return { content: [{ type: "text" as const, text: "Time slot is already booked" }] };
      }
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const limitCheck = await commonSpaceRules.checkUserTimeLimit(user.id, spaceId, durationHours);
      if (!limitCheck.withinLimit) {
        return { content: [{ type: "text" as const, text: limitCheck.message ?? "User time limit exceeded" }] };
      }

      try {
        const [booking] = await withRetryableDbCall(() => db
          .insert(schema.bookings)
          .values({
            commonSpaceId: spaceId,
            userId: user.id,
            startTime: start,
            endTime: end,
            status: "confirmed",
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(booking, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_common_space_booking]", e);
        return buildWriteErrorResponse(e, 'booking', 'create');
      }
    }
  );

  server.tool(
    "cancel_common_space_booking",
    "Cancel a confirmed common-space booking. Tenants may only cancel their own bookings AND must still have an active residence link to the space's building. Managers/admins may cancel any booking on a space inside their accessible buildings.",
    { role: roleParam, bookingId: z.string().describe("Booking ID to cancel") },
    async ({ role, bookingId }) => {
      const [booking] = await db
        .select({
          id: schema.bookings.id,
          userId: schema.bookings.userId,
          status: schema.bookings.status,
          commonSpaceId: schema.bookings.commonSpaceId,
        })
        .from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId))
        .limit(1);
      if (!booking) {
        return { content: [{ type: "text" as const, text: "Booking not found" }] };
      }
      // Route through the same building-access check as every other
      // common-space tool, so tenant active-residence and manager
      // accessible-buildings rules are enforced uniformly.
      const auth = await authorizeSpaceAccess(role, booking.commonSpaceId);
      if (!auth.ok) return auth.response;
      const isOwner = booking.userId === auth.userId;
      const isStaff = role === "admin" || role === "manager";
      if (!isOwner && !isStaff) {
        return { content: [{ type: "text" as const, text: "Access denied: tenants may only cancel their own bookings" }] };
      }
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.bookings)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.bookings.id, bookingId))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:cancel_common_space_booking]", e);
        return buildWriteErrorResponse(e, 'booking', 'update');
      }
    }
  );

  server.tool(
    "create_common_space",
    "Create a new common space in a building (admin/manager only).",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      name: z.string().describe("Common space name"),
      description: z.string().optional().describe("Optional description"),
      isReservable: z.boolean().default(true).describe("Whether the space accepts bookings"),
      capacity: z.number().int().positive().optional().describe("Maximum capacity"),
      openingHours: z
        .array(
          z.object({
            day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
            open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM"),
            close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM"),
          })
        )
        .optional()
        .describe("Per-day opening hours; omit for an unrestricted space"),
      bookingRules: z.string().optional().describe("Free-text booking rules shown to residents"),
    },
    async ({ role, buildingId, name, description, isReservable, capacity, openingHours, bookingRules }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create common spaces" }] };
      }
      const accessibleBuildingIds = await getMcpAccessibleBuildingIds(role);
      if (!accessibleBuildingIds || !accessibleBuildingIds.includes(buildingId)) {
        return { content: [{ type: "text" as const, text: "Access denied: you do not have access to this building" }] };
      }
      const [duplicate] = await db
        .select({ id: schema.commonSpaces.id })
        .from(schema.commonSpaces)
        .where(and(eq(schema.commonSpaces.name, name), eq(schema.commonSpaces.buildingId, buildingId)))
        .limit(1);
      if (duplicate) {
        return { content: [{ type: "text" as const, text: "A common space with this name already exists in this building" }] };
      }
      try {
        const [created] = await withRetryableDbCall(() => db
          .insert(schema.commonSpaces)
          .values({
            buildingId,
            name,
            ...(description !== undefined && { description }),
            isReservable,
            ...(capacity !== undefined && { capacity }),
            ...(openingHours !== undefined && { openingHours }),
            ...(bookingRules !== undefined && { bookingRules }),
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_common_space]", e);
        return buildWriteErrorResponse(e, 'common space', 'create');
      }
    }
  );

  server.tool(
    "update_common_space",
    "Update an existing common space (admin/manager only). Only provided fields are updated.",
    {
      role: roleParam,
      spaceId: z.string().describe("Common space ID"),
      name: z.string().optional(),
      description: z.string().optional(),
      isReservable: z.boolean().optional(),
      capacity: z.number().int().positive().optional(),
      openingHours: z
        .array(
          z.object({
            day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
            open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM"),
            close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM"),
          })
        )
        .optional(),
      bookingRules: z.string().optional(),
    },
    async ({ role, spaceId, name, description, isReservable, capacity, openingHours, bookingRules }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update common spaces" }] };
      }
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (isReservable !== undefined) patch.isReservable = isReservable;
      if (capacity !== undefined) patch.capacity = capacity;
      if (openingHours !== undefined) patch.openingHours = openingHours;
      if (bookingRules !== undefined) patch.bookingRules = bookingRules;
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.commonSpaces)
          .set(patch)
          .where(eq(schema.commonSpaces.id, spaceId))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_common_space]", e);
        return buildWriteErrorResponse(e, 'common space', 'update');
      }
    }
  );

  server.tool(
    "delete_common_space",
    "Delete a common space (admin/manager only). Refuses if any confirmed future bookings exist; cascades through Postgres FKs to past bookings, restrictions, and time-limit rows.",
    { role: roleParam, spaceId: z.string().describe("Common space ID") },
    async ({ role, spaceId }) => {
      // Centralize the role + MCP-scope rules through the shared
      // `authorizeDeleteInMcpScope` helper (same pattern as
      // delete_bill / delete_project / delete_residence). Resolve the
      // space's building organizationId first, then defer the
      // tenant-denial / not-found / out-of-scope wording to the helper
      // so it stays consistent with the other delete tools.
      const orgIds = await getMcpOrgIds();
      const [space] = await db
        .select({ id: schema.commonSpaces.id, buildingId: schema.commonSpaces.buildingId })
        .from(schema.commonSpaces)
        .where(eq(schema.commonSpaces.id, spaceId));
      let buildingOrgId: string | null | undefined = undefined;
      if (space) {
        const [building] = await db
          .select({ organizationId: schema.buildings.organizationId })
          .from(schema.buildings)
          .where(eq(schema.buildings.id, space.buildingId));
        buildingOrgId = building?.organizationId;
      }
      const auth = authorizeDeleteInMcpScope({
        role,
        entityKind: 'common_space',
        entityId: spaceId,
        entity: { exists: !!space, organizationId: buildingOrgId },
        mcpOrgIds: orgIds,
      });
      if (!auth.ok) return auth.response;
      const [futureBooking] = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.commonSpaceId, spaceId),
            eq(schema.bookings.status, "confirmed"),
            gte(schema.bookings.startTime, new Date())
          )
        )
        .limit(1);
      if (futureBooking) {
        return { content: [{ type: "text" as const, text: "Cannot delete common space: confirmed future bookings exist. Cancel them first." }] };
      }
      try {
        const [deleted] = await withRetryableDbCall(() => db
          .delete(schema.commonSpaces)
          .where(eq(schema.commonSpaces.id, spaceId))
          .returning({ id: schema.commonSpaces.id, name: schema.commonSpaces.name }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted, message: "Common space deleted" }, null, 2) }] };
      } catch (e) {
        console.error("[mcp:delete_common_space]", e);
        return buildWriteErrorResponse(e, 'common space', 'delete');
      }
    }
  );

  // Confirms the TARGET user (whose restriction/time-limit is being
  // read or written) belongs to a building or organization the calling
  // MCP user can already touch. Used by tools that don't have a
  // commonSpaceId anchor (global time limits, cross-user listings) so a
  // manager in org A cannot enumerate or mutate quotas for a user in
  // org B simply by knowing their userId. Returns true when the target
  // shares scope with the caller; false otherwise.
  async function targetUserInScope(role: McpRole, targetUserId: string): Promise<boolean> {
    const accessible = await getMcpAccessibleBuildingIds(role);
    if (!accessible || accessible.length === 0) return false;
    const [resRow] = await db
      .select({ id: schema.userResidences.id })
      .from(schema.userResidences)
      .innerJoin(
        schema.residences,
        eq(schema.residences.id, schema.userResidences.residenceId)
      )
      .where(
        and(
          eq(schema.userResidences.userId, targetUserId),
          eq(schema.userResidences.isActive, true),
          inArray(schema.residences.buildingId, accessible)
        )
      )
      .limit(1);
    if (resRow) return true;
    const accessibleOrgRows = await db
      .selectDistinct({ organizationId: schema.buildings.organizationId })
      .from(schema.buildings)
      .where(inArray(schema.buildings.id, accessible));
    const accessibleOrgIds = accessibleOrgRows.map((r) => r.organizationId);
    if (accessibleOrgIds.length === 0) return false;
    const [orgRow] = await db
      .select({ id: schema.userOrganizations.id })
      .from(schema.userOrganizations)
      .where(
        and(
          eq(schema.userOrganizations.userId, targetUserId),
          eq(schema.userOrganizations.isActive, true),
          inArray(schema.userOrganizations.organizationId, accessibleOrgIds)
        )
      )
      .limit(1);
    return Boolean(orgRow);
  }

  // ============================================================
  // Common-space user restrictions & time limits (Task #289).
  //
  // Mirrors the manager-only REST endpoints in
  // `server/api/common-spaces.ts` (~860-1080 for restrictions and
  // ~1390-1600 for time limits). All tools refuse the `tenant` role and
  // re-use `authorizeSpaceAccess` so they are clamped to the buildings
  // the MCP-acting user can already touch (which is itself clamped to
  // the MCP-scoped org allowlist).
  // ============================================================

  server.tool(
    "list_user_booking_restrictions",
    "List per-user booking restrictions (block/unblock entries) for a common space. Admin/manager only. Returns one row per user that has a restriction record on the space, including the target user's name/email and whether they are currently blocked.",
    { role: roleParam, spaceId: z.string().describe("Common space ID") },
    async ({ role, spaceId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view booking restrictions" }] };
      }
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const rows = await db
        .select({
          id: schema.userBookingRestrictions.id,
          userId: schema.userBookingRestrictions.userId,
          commonSpaceId: schema.userBookingRestrictions.commonSpaceId,
          isBlocked: schema.userBookingRestrictions.isBlocked,
          reason: schema.userBookingRestrictions.reason,
          createdAt: schema.userBookingRestrictions.createdAt,
          updatedAt: schema.userBookingRestrictions.updatedAt,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
        })
        .from(schema.userBookingRestrictions)
        .innerJoin(schema.users, eq(schema.users.id, schema.userBookingRestrictions.userId))
        .where(eq(schema.userBookingRestrictions.commonSpaceId, spaceId))
        .orderBy(schema.users.lastName, schema.users.firstName);
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "set_user_booking_restriction",
    "Block or unblock a specific user from booking a common space (admin/manager only). Upserts a row in userBookingRestrictions: if one already exists for the (user, space) pair it is updated, otherwise it is created. Pass isBlocked=false to record an explicit allow override without deleting the row; use remove_user_booking_restriction to delete it entirely.",
    {
      role: roleParam,
      spaceId: z.string().describe("Common space ID"),
      userId: z.string().describe("Target user ID to block or unblock"),
      isBlocked: z.boolean().describe("true to block the user from booking this space, false to record an explicit unblock"),
      reason: z.string().optional().describe("Optional reason shown to managers"),
    },
    async ({ role, spaceId, userId, isBlocked, reason }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot manage booking restrictions" }] };
      }
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      const [target] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (!target) {
        return { content: [{ type: "text" as const, text: "Target user not found" }] };
      }
      try {
        const [existing] = await db
          .select({ id: schema.userBookingRestrictions.id })
          .from(schema.userBookingRestrictions)
          .where(
            and(
              eq(schema.userBookingRestrictions.userId, userId),
              eq(schema.userBookingRestrictions.commonSpaceId, spaceId)
            )
          )
          .limit(1);
        let row;
        if (existing) {
          [row] = await withRetryableDbCall(() => db
            .update(schema.userBookingRestrictions)
            .set({ isBlocked, reason: reason ?? null, updatedAt: new Date() })
            .where(eq(schema.userBookingRestrictions.id, existing.id))
            .returning());
        } else {
          [row] = await withRetryableDbCall(() => db
            .insert(schema.userBookingRestrictions)
            .values({ userId, commonSpaceId: spaceId, isBlocked, reason: reason ?? null })
            .returning());
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
      } catch (e) {
        console.error("[mcp:set_user_booking_restriction]", e);
        return buildWriteErrorResponse(e, 'booking restriction', 'create');
      }
    }
  );

  server.tool(
    "remove_user_booking_restriction",
    "Delete the booking-restriction row for a (user, space) pair (admin/manager only). After deletion the user falls back to the default access rules for the space. No-op response is returned if no row exists.",
    {
      role: roleParam,
      spaceId: z.string().describe("Common space ID"),
      userId: z.string().describe("Target user ID whose restriction row should be deleted"),
    },
    async ({ role, spaceId, userId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot manage booking restrictions" }] };
      }
      const auth = await authorizeSpaceAccess(role, spaceId);
      if (!auth.ok) return auth.response;
      try {
        const deleted = await withRetryableDbCall(() => db
          .delete(schema.userBookingRestrictions)
          .where(
            and(
              eq(schema.userBookingRestrictions.userId, userId),
              eq(schema.userBookingRestrictions.commonSpaceId, spaceId)
            )
          )
          .returning({ id: schema.userBookingRestrictions.id }));
        if (deleted.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: 0, message: "No restriction row found for this user/space pair" }, null, 2) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: deleted.length, ids: deleted.map((d) => d.id), message: "Booking restriction removed" }, null, 2) }] };
      } catch (e) {
        console.error("[mcp:remove_user_booking_restriction]", e);
        return buildWriteErrorResponse(e, 'booking restriction', 'delete');
      }
    }
  );

  server.tool(
    "list_user_time_limits",
    "List per-user booking time-limit rules (admin/manager only). Filter by userId and/or spaceId. A row with a NULL commonSpaceId is a global limit that applies across every space the user can book. Includes the target space name (when scoped) and the user's name/email.",
    {
      role: roleParam,
      userId: z.string().optional().describe("Optional: only return limits for this user"),
      spaceId: z.string().optional().describe("Optional: only return limits scoped to this common space (excludes global NULL-space limits)"),
    },
    async ({ role, userId, spaceId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view time limits" }] };
      }
      if (!userId && !spaceId) {
        return { content: [{ type: "text" as const, text: "At least one of userId or spaceId is required" }] };
      }
      // Clamp by accessible buildings so a manager cannot enumerate
      // limits attached to spaces in buildings outside their scope.
      const accessible = await getMcpAccessibleBuildingIds(role);
      if (!accessible) {
        return { content: [{ type: "text" as const, text: `MCP ${role} user not found` }] };
      }
      if (spaceId) {
        const auth = await authorizeSpaceAccess(role, spaceId);
        if (!auth.ok) return auth.response;
      } else if (userId) {
        // userId-only query would otherwise expose this user's GLOBAL
        // (NULL-space) limits to any caller that knows the userId.
        // Require the target user to share scope with the caller.
        if (!(await targetUserInScope(role, userId))) {
          return { content: [{ type: "text" as const, text: "Access denied: target user is not in your MCP scope" }] };
        }
      }
      const conditions: SQL[] = [];
      if (userId) conditions.push(eq(schema.userTimeLimits.userId, userId));
      if (spaceId) {
        conditions.push(eq(schema.userTimeLimits.commonSpaceId, spaceId));
      } else {
        // No spaceId filter: only return rows that are either global
        // (NULL space) or attached to a space inside an accessible
        // building. The userId-only path is already scope-clamped by
        // the targetUserInScope check above; the spaceId-attached rows
        // are clamped here.
        const accessSql = accessible.length > 0
          ? or(
              isNull(schema.userTimeLimits.commonSpaceId),
              inArray(schema.commonSpaces.buildingId, accessible)
            )
          : isNull(schema.userTimeLimits.commonSpaceId);
        if (accessSql) conditions.push(accessSql);
      }
      const rows = await db
        .select({
          id: schema.userTimeLimits.id,
          userId: schema.userTimeLimits.userId,
          commonSpaceId: schema.userTimeLimits.commonSpaceId,
          spaceName: schema.commonSpaces.name,
          limitType: schema.userTimeLimits.limitType,
          limitHours: schema.userTimeLimits.limitHours,
          createdAt: schema.userTimeLimits.createdAt,
          updatedAt: schema.userTimeLimits.updatedAt,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
        })
        .from(schema.userTimeLimits)
        .leftJoin(schema.commonSpaces, eq(schema.commonSpaces.id, schema.userTimeLimits.commonSpaceId))
        .innerJoin(schema.users, eq(schema.users.id, schema.userTimeLimits.userId))
        .where(and(...conditions))
        .orderBy(schema.userTimeLimits.userId, schema.userTimeLimits.limitType, schema.userTimeLimits.commonSpaceId);
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.tool(
    "set_user_time_limit",
    "Create or update a per-user booking time limit (admin/manager only). Upsert key is (userId, commonSpaceId, limitType): omit spaceId for a global limit that applies across every space. limitHours must be 1..8760 (1 year).",
    {
      role: roleParam,
      userId: z.string().describe("Target user ID"),
      spaceId: z.string().optional().describe("Optional common space ID; omit for a GLOBAL limit applied across every space"),
      limitType: z.enum(["monthly", "yearly"]).describe("Reset cadence for the hourly quota"),
      limitHours: z.number().int().min(1).max(8760).describe("Maximum hours allowed in the period (1..8760)"),
    },
    async ({ role, userId, spaceId, limitType, limitHours }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot manage time limits" }] };
      }
      // For global limits we still need a valid MCP user record; reuse
      // the helper through authorizeSpaceAccess when a space is given,
      // otherwise verify the role through getMcpAccessibleBuildingIds
      // (returns null for unknown users) AND require the TARGET user
      // to share scope with the caller — the global path has no
      // commonSpaceId anchor, so without this check a manager could
      // mutate any user's quotas across orgs.
      if (spaceId) {
        const auth = await authorizeSpaceAccess(role, spaceId);
        if (!auth.ok) return auth.response;
      } else {
        const accessible = await getMcpAccessibleBuildingIds(role);
        if (!accessible) {
          return { content: [{ type: "text" as const, text: `MCP ${role} user not found` }] };
        }
        if (!(await targetUserInScope(role, userId))) {
          return { content: [{ type: "text" as const, text: "Access denied: target user is not in your MCP scope" }] };
        }
      }
      const [target] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (!target) {
        return { content: [{ type: "text" as const, text: "Target user not found" }] };
      }
      try {
        const [existing] = await db
          .select({ id: schema.userTimeLimits.id })
          .from(schema.userTimeLimits)
          .where(
            and(
              eq(schema.userTimeLimits.userId, userId),
              spaceId
                ? eq(schema.userTimeLimits.commonSpaceId, spaceId)
                : isNull(schema.userTimeLimits.commonSpaceId),
              eq(schema.userTimeLimits.limitType, limitType)
            )
          )
          .limit(1);
        let row;
        if (existing) {
          [row] = await withRetryableDbCall(() => db
            .update(schema.userTimeLimits)
            .set({ limitHours, updatedAt: new Date() })
            .where(eq(schema.userTimeLimits.id, existing.id))
            .returning());
        } else {
          [row] = await withRetryableDbCall(() => db
            .insert(schema.userTimeLimits)
            .values({ userId, commonSpaceId: spaceId ?? null, limitType, limitHours })
            .returning());
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
      } catch (e) {
        console.error("[mcp:set_user_time_limit]", e);
        return buildWriteErrorResponse(e, 'time limit', 'create');
      }
    }
  );

  server.tool(
    "remove_user_time_limit",
    "Delete a per-user time-limit row (admin/manager only). Identified by (userId, commonSpaceId, limitType): omit spaceId to target the user's GLOBAL limit. Returns the deleted row count (0 if no matching limit existed).",
    {
      role: roleParam,
      userId: z.string().describe("Target user ID"),
      spaceId: z.string().optional().describe("Optional common space ID; omit to remove the user's GLOBAL limit"),
      limitType: z.enum(["monthly", "yearly"]).describe("Which cadence's limit to remove"),
    },
    async ({ role, userId, spaceId, limitType }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot manage time limits" }] };
      }
      if (spaceId) {
        const auth = await authorizeSpaceAccess(role, spaceId);
        if (!auth.ok) return auth.response;
      } else {
        const accessible = await getMcpAccessibleBuildingIds(role);
        if (!accessible) {
          return { content: [{ type: "text" as const, text: `MCP ${role} user not found` }] };
        }
        // Global delete has no space anchor — require target user
        // to share scope with the caller.
        if (!(await targetUserInScope(role, userId))) {
          return { content: [{ type: "text" as const, text: "Access denied: target user is not in your MCP scope" }] };
        }
      }
      try {
        const deleted = await withRetryableDbCall(() => db
          .delete(schema.userTimeLimits)
          .where(
            and(
              eq(schema.userTimeLimits.userId, userId),
              spaceId
                ? eq(schema.userTimeLimits.commonSpaceId, spaceId)
                : isNull(schema.userTimeLimits.commonSpaceId),
              eq(schema.userTimeLimits.limitType, limitType)
            )
          )
          .returning({ id: schema.userTimeLimits.id }));
        if (deleted.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: 0, message: "No matching time-limit row found" }, null, 2) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: deleted.length, ids: deleted.map((d) => d.id), message: "Time limit removed" }, null, 2) }] };
      } catch (e) {
        console.error("[mcp:remove_user_time_limit]", e);
        return buildWriteErrorResponse(e, 'time limit', 'delete');
      }
    }
  );

  server.tool(
    "list_communications",
    "List general communications for an organization",
    { role: roleParam, organizationId: z.string().describe("Organization ID") },
    async ({ role, organizationId }) => {
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const conditions: SQL[] = [eq(schema.generalCommunications.organizationId, organizationId)];
      // Admins see every communication. Other roles only see communications
      // whose recipientRoles is NULL (broadcast to everyone) or whose array
      // explicitly contains their role.
      if (role !== "admin") {
        // Treat NULL OR an empty array as "broadcast to everyone".
        // Otherwise the caller's role must be present in the array.
        const recipientFilter = or(
          isNull(schema.generalCommunications.recipientRoles),
          sql`cardinality(${schema.generalCommunications.recipientRoles}) = 0`,
          sql`${role} = ANY(${schema.generalCommunications.recipientRoles})`
        );
        if (recipientFilter) conditions.push(recipientFilter);
      }
      const comms = await db
        .select()
        .from(schema.generalCommunications)
        .where(and(...conditions))
        .orderBy(desc(schema.generalCommunications.createdAt));
      return { content: [{ type: "text" as const, text: JSON.stringify(comms, null, 2) }] };
    }
  );

  server.tool(
    "create_communication",
    "Create a general communication / announcement (admin/manager only)",
    {
      role: roleParam,
      organizationId: z.string().describe("Organization ID"),
      title: z.string().describe("Communication title"),
      content: z.string().describe("Communication content"),
      isUrgent: z.boolean().default(false).describe("Whether this is urgent"),
    },
    async ({ role, organizationId, title, content, isUrgent }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create communications" }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const user = await getMcpUser(role);
      if (!user) return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      try {
        const [comm] = await withRetryableDbCall(() => db
          .insert(schema.generalCommunications)
          .values({ organizationId, title, content, isUrgent, createdBy: user.id, sentAt: new Date() })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(comm, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_communication]", e);
        return buildWriteErrorResponse(e, 'communication', 'create');
      }
    }
  );

  server.tool(
    "list_documents",
    "List documents for a building or residence (at least one of buildingId / residenceId is required)",
    // Task #260: at least one of `buildingId` or `residenceId` MUST be supplied
    // so the result set is always tenant-scoped through a building or
    // residence the caller already has access to. Both fields stay optional
    // in the Zod schema (so callers can choose which scope to filter by),
    // but the handler hard-rejects calls that omit BOTH before any DB read
    // — there is no "list every document across MCP scope" code path.
    {
      role: roleParam,
      buildingId: z.string().optional().describe("Filter by building ID (required if residenceId is omitted)"),
      residenceId: z.string().optional().describe("Filter by residence ID (required if buildingId is omitted)"),
    },
    async ({ role, buildingId, residenceId }) => {
      if (!buildingId && !residenceId) {
        return { content: [{ type: "text" as const, text: "Please provide buildingId or residenceId" }] };
      }
      const orgIds = await getMcpOrgIds();
      if (buildingId) {
        const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
        if (!building || !orgIds.includes(building.organizationId)) {
          return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
        }
      }
      if (residenceId && !buildingId) {
        const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
        if (!residence) {
          return { content: [{ type: "text" as const, text: "Residence not found" }] };
        }
        const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, residence.buildingId));
        if (!building || !orgIds.includes(building.organizationId)) {
          return { content: [{ type: "text" as const, text: "Access denied: residence not in MCP scope" }] };
        }
      }
      const conditions: SQL[] = [];
      if (buildingId) conditions.push(eq(schema.documents.buildingId, buildingId));
      if (residenceId) conditions.push(eq(schema.documents.residenceId, residenceId));
      const docs = await db
        .select()
        .from(schema.documents)
        .where(and(...conditions))
        .orderBy(desc(schema.documents.createdAt));
      return { content: [{ type: "text" as const, text: JSON.stringify(docs, null, 2) }] };
    }
  );

  server.tool(
    "list_budgets",
    "List budgets for a building",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      year: z.number().int().optional().describe("Filter by year"),
    },
    async ({ role, buildingId, year }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const conditions: SQL[] = [eq(schema.budgets.buildingId, buildingId)];
      if (year) conditions.push(eq(schema.budgets.year, year));
      const budgetList = await db
        .select()
        .from(schema.budgets)
        .where(and(...conditions));
      return { content: [{ type: "text" as const, text: JSON.stringify(budgetList, null, 2) }] };
    }
  );

  server.tool(
    "list_invoices",
    "List invoices for a building",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
    },
    async ({ role, buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const invoiceList = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.buildingId, buildingId))
        .orderBy(desc(schema.invoices.createdAt))
        .limit(50);
      return { content: [{ type: "text" as const, text: JSON.stringify(invoiceList, null, 2) }] };
    }
  );

  server.tool(
    "list_meetings",
    "List meetings for an organization",
    { role: roleParam, organizationId: z.string().describe("Organization ID") },
    async ({ role, organizationId }) => {
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const meetingList = await db
        .select()
        .from(schema.meetings)
        .where(eq(schema.meetings.organizationId, organizationId))
        .orderBy(desc(schema.meetings.scheduledDate));
      return { content: [{ type: "text" as const, text: JSON.stringify(meetingList, null, 2) }] };
    }
  );

  server.tool(
    "create_meeting",
    "Schedule a meeting for an organization (admin/manager only)",
    {
      role: roleParam,
      organizationId: z.string().describe("Organization ID"),
      title: z.string().describe("Meeting title"),
      description: z.string().optional().describe("Meeting description"),
      location: z.string().describe("Meeting location"),
      scheduledDate: z.string().describe("Scheduled date/time (ISO 8601)"),
      duration: z.number().int().describe("Duration in minutes"),
    },
    async ({ role, organizationId, title, description, location, scheduledDate, duration }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create meetings" }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
      }
      const parsedScheduledDate = new Date(scheduledDate);
      if (Number.isNaN(parsedScheduledDate.getTime())) {
        return { content: [{ type: "text" as const, text: "scheduledDate must be a valid ISO 8601 date" }] };
      }
      if (parsedScheduledDate.getTime() < Date.now()) {
        return { content: [{ type: "text" as const, text: "scheduledDate must be in the future" }] };
      }
      const user = await getMcpUser(role);
      if (!user) return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      try {
        const [meeting] = await withRetryableDbCall(() => db
          .insert(schema.meetings)
          .values({
            organizationId,
            title,
            description: description || null,
            location,
            scheduledDate: parsedScheduledDate,
            duration,
            createdBy: user.id,
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(meeting, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_meeting]", e);
        return buildWriteErrorResponse(e, 'meeting', 'create');
      }
    }
  );

  // ===========================================
  // INVENTORY (BUILDING ELEMENTS) — Task #301
  // ===========================================
  // Read/write coverage for building inventory elements (UNIFORMAT II).
  // RBAC: tenants are blocked on every tool below; only admin/manager may
  // operate. Org scope is validated via building.organizationId ∈ MCP orgs
  // for tools that take a buildingId, and via the element's building for
  // tools that take an elementId.

  server.tool(
    "list_inventory_elements",
    "List building inventory elements (UNIFORMAT II classified) for a building. Admin/manager only. Optional filters: condition (excellent|good|fair|poor|critical), category (UNIFORMAT major group such as 'Substructure', 'Shell', 'Interiors', 'Services', etc.).",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      condition: z.enum(["excellent", "good", "fair", "poor", "critical"]).optional().describe("Filter by current condition"),
      category: z.string().optional().describe("Filter by UNIFORMAT category (e.g. 'Shell')"),
    },
    async ({ role, buildingId, condition, category }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view inventory elements" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const conditions: SQL[] = [eq(schema.buildingElements.buildingId, buildingId)];
      if (condition) conditions.push(eq(schema.buildingElements.currentCondition, condition));
      if (category) {
        const matchingCodes = await db
          .select({ code: schema.uniformatCodes.code })
          .from(schema.uniformatCodes)
          .where(sql`lower(${schema.uniformatCodes.category}) = lower(${category})`);
        if (matchingCodes.length === 0) {
          return { content: [{ type: "text" as const, text: "[]" }] };
        }
        conditions.push(inArray(schema.buildingElements.uniformatCode, matchingCodes.map((c) => c.code)));
      }
      const elements = await db
        .select()
        .from(schema.buildingElements)
        .where(and(...conditions))
        .orderBy(desc(schema.buildingElements.createdAt));
      return { content: [{ type: "text" as const, text: JSON.stringify(elements, null, 2) }] };
    }
  );

  server.tool(
    "get_inventory_element",
    "Get full details of a single building inventory element. Admin/manager only.",
    { role: roleParam, elementId: z.string().describe("Building element ID") },
    async ({ role, elementId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view inventory elements" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [element] = await db.select().from(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
      if (!element) return { content: [{ type: "text" as const, text: "Inventory element not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, element.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(element, null, 2) }] };
    }
  );

  server.tool(
    "create_inventory_element",
    "Create a new building inventory element classified by a UNIFORMAT II code. Admin/manager only. Use search_uniformat_codes first to pick the right classification code.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      uniformatCode: z.string().describe("UNIFORMAT II classification code (e.g. 'B2010')"),
      name: z.string().describe("Element name"),
      currentCondition: z.enum(["excellent", "good", "fair", "poor", "critical"]).describe("Current condition"),
      description: z.string().optional().describe("Element description"),
      residenceId: z.string().optional().describe("Optional residence ID; omit for building-wide elements"),
      originalConstructionDate: z.string().optional().describe("Original construction date (YYYY-MM-DD)"),
      originalLifespan: z.number().int().positive().optional().describe("Original lifespan in years"),
      currentLifespan: z.number().int().positive().optional().describe("Current adjusted lifespan in years"),
      lastInspectionDate: z.string().optional().describe("Last inspection date (YYYY-MM-DD)"),
      nextEvaluationDate: z.string().optional().describe("Next evaluation date (YYYY-MM-DD)"),
      unit: z.string().optional().describe("Measurement unit (e.g. 'm2', 'm', 'unit')"),
      unitValue: z.number().positive().optional().describe("Quantity in the specified unit"),
      reconstructionCost: z.number().positive().optional().describe("Estimated reconstruction cost"),
      costEstimationDate: z.string().optional().describe("Cost estimation date (YYYY-MM-DD)"),
      access: z.enum(["not_restrained", "restrained"]).optional().describe("Access type"),
      charge: z.enum(["common", "personnal"]).optional().describe("Charge type"),
      notes: z.string().optional().describe("Free-form notes"),
    },
    async (args) => {
      const { role, buildingId, residenceId, ...rest } = args;
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create inventory elements" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      // Match the maintenance API rule: building elements may only be created
      // against a level-3 UNIFORMAT code. Levels 1-2 are grouping-only.
      const { UNIFORMAT_CATALOG } = await import("@shared/data/uniformat-catalog");
      const uniformatEntry = UNIFORMAT_CATALOG.find((e) => e.code === rest.uniformatCode);
      if (!uniformatEntry) {
        return { content: [{ type: "text" as const, text: `Unknown UNIFORMAT code: ${rest.uniformatCode}. Use search_uniformat_codes to find a valid level-3 code.` }] };
      }
      if (uniformatEntry.level !== 3) {
        return { content: [{ type: "text" as const, text: `UNIFORMAT code ${rest.uniformatCode} is level ${uniformatEntry.level}; building elements may only be created against level-3 codes (the leaf elements). Use search_uniformat_codes with level=3 to pick a valid code.` }] };
      }
      // Validate that the optional residenceId actually belongs to the
      // supplied building. The DB column is unconstrained (no FK), so MCP
      // must enforce this itself to prevent cross-building links.
      if (residenceId) {
        const [residence] = await db
          .select({ id: schema.residences.id, buildingId: schema.residences.buildingId })
          .from(schema.residences)
          .where(eq(schema.residences.id, residenceId));
        if (!residence) {
          return { content: [{ type: "text" as const, text: `Residence not found: ${residenceId}` }] };
        }
        if (residence.buildingId !== buildingId) {
          return { content: [{ type: "text" as const, text: `Residence ${residenceId} does not belong to building ${buildingId}` }] };
        }
      }
      try {
        const values: typeof schema.buildingElements.$inferInsert = {
          buildingId,
          uniformatCode: rest.uniformatCode,
          name: rest.name,
          currentCondition: rest.currentCondition,
          ...(residenceId !== undefined && { residenceId }),
          ...(rest.description !== undefined && { description: rest.description }),
          ...(rest.originalConstructionDate !== undefined && { originalConstructionDate: rest.originalConstructionDate }),
          ...(rest.originalLifespan !== undefined && { originalLifespan: rest.originalLifespan }),
          ...(rest.currentLifespan !== undefined && { currentLifespan: rest.currentLifespan }),
          ...(rest.lastInspectionDate !== undefined && { lastInspectionDate: rest.lastInspectionDate }),
          ...(rest.nextEvaluationDate !== undefined && { nextEvaluationDate: rest.nextEvaluationDate }),
          ...(rest.unit !== undefined && { unit: rest.unit }),
          ...(rest.unitValue !== undefined && { unitValue: String(rest.unitValue) }),
          ...(rest.reconstructionCost !== undefined && { reconstructionCost: String(rest.reconstructionCost) }),
          ...(rest.costEstimationDate !== undefined && { costEstimationDate: rest.costEstimationDate }),
          ...(rest.access !== undefined && { access: rest.access }),
          ...(rest.charge !== undefined && { charge: rest.charge }),
          ...(rest.notes !== undefined && { notes: rest.notes }),
        };
        const [element] = await withRetryableDbCall(() => db.insert(schema.buildingElements).values(values).returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(element, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_inventory_element]", e);
        return buildWriteErrorResponse(e, 'inventory element', 'create');
      }
    }
  );

  server.tool(
    "update_inventory_element",
    "Update an existing building inventory element. Admin/manager only. Supply only the fields you want to change.",
    {
      role: roleParam,
      elementId: z.string().describe("Building element ID"),
      name: z.string().optional().describe("Element name"),
      description: z.string().optional().describe("Element description"),
      currentCondition: z.enum(["excellent", "good", "fair", "poor", "critical"]).optional().describe("Current condition"),
      lastInspectionDate: z.string().optional().describe("Last inspection date (YYYY-MM-DD)"),
      nextEvaluationDate: z.string().optional().describe("Next evaluation date (YYYY-MM-DD)"),
      currentLifespan: z.number().int().positive().optional().describe("Current adjusted lifespan in years"),
      reconstructionCost: z.number().positive().optional().describe("Estimated reconstruction cost"),
      costEstimationDate: z.string().optional().describe("Cost estimation date (YYYY-MM-DD)"),
      unit: z.string().optional().describe("Measurement unit"),
      unitValue: z.number().positive().optional().describe("Quantity in the specified unit"),
      access: z.enum(["not_restrained", "restrained"]).optional().describe("Access type"),
      charge: z.enum(["common", "personnal"]).optional().describe("Charge type"),
      notes: z.string().optional().describe("Free-form notes"),
    },
    async (args) => {
      const { role, elementId, ...rest } = args;
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update inventory elements" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [element] = await db.select().from(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
      if (!element) return { content: [{ type: "text" as const, text: "Inventory element not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, element.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const update: Partial<typeof schema.buildingElements.$inferInsert> = {
        updatedAt: new Date(),
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.description !== undefined && { description: rest.description }),
        ...(rest.currentCondition !== undefined && { currentCondition: rest.currentCondition }),
        ...(rest.lastInspectionDate !== undefined && { lastInspectionDate: rest.lastInspectionDate }),
        ...(rest.nextEvaluationDate !== undefined && { nextEvaluationDate: rest.nextEvaluationDate }),
        ...(rest.currentLifespan !== undefined && { currentLifespan: rest.currentLifespan }),
        ...(rest.reconstructionCost !== undefined && { reconstructionCost: String(rest.reconstructionCost) }),
        ...(rest.costEstimationDate !== undefined && { costEstimationDate: rest.costEstimationDate }),
        ...(rest.unit !== undefined && { unit: rest.unit }),
        ...(rest.unitValue !== undefined && { unitValue: String(rest.unitValue) }),
        ...(rest.access !== undefined && { access: rest.access }),
        ...(rest.charge !== undefined && { charge: rest.charge }),
        ...(rest.notes !== undefined && { notes: rest.notes }),
      };
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.buildingElements)
          .set(update)
          .where(eq(schema.buildingElements.id, elementId))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_inventory_element]", e);
        return buildWriteErrorResponse(e, 'inventory element', 'update');
      }
    }
  );

  server.tool(
    "delete_inventory_element",
    "Delete a building inventory element (admin/manager only). Returns a structured FK-violation envelope if other records (e.g. project elements, history that has been preserved at the application layer) still reference it.",
    { role: roleParam, elementId: z.string().describe("Building element ID to delete") },
    async ({ role, elementId }) => {
      // Centralize the role + MCP-scope rules through the shared
      // `authorizeDeleteInMcpScope` helper (same pattern as
      // delete_bill / delete_project / delete_residence). Resolve the
      // element's building organizationId first, then defer the
      // tenant-denial / not-found / out-of-scope wording to the helper
      // so it stays consistent with the other delete tools.
      const orgIds = await getMcpOrgIds();
      const [element] = await db.select().from(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
      let buildingOrgId: string | null | undefined = undefined;
      if (element) {
        const [building] = await db
          .select({ organizationId: schema.buildings.organizationId })
          .from(schema.buildings)
          .where(eq(schema.buildings.id, element.buildingId));
        buildingOrgId = building?.organizationId;
      }
      const auth = authorizeDeleteInMcpScope({
        role,
        entityKind: 'inventory_element',
        entityId: elementId,
        entity: { exists: !!element, organizationId: buildingOrgId },
        mcpOrgIds: orgIds,
      });
      if (!auth.ok) return auth.response;
      try {
        const [deleted] = await withRetryableDbCall(() => db
          .delete(schema.buildingElements)
          .where(eq(schema.buildingElements.id, elementId))
          .returning({ id: schema.buildingElements.id, name: schema.buildingElements.name, uniformatCode: schema.buildingElements.uniformatCode }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ deleted, message: "Inventory element deleted (cascade applied to history, evaluation suggestions, project elements, element documents, element project updates)" }, null, 2),
          }],
        };
      } catch (e) {
        console.error("[mcp:delete_inventory_element]", e);
        return buildWriteErrorResponse(e, 'inventory element', 'delete');
      }
    }
  );

  server.tool(
    "search_uniformat_codes",
    "Search the UNIFORMAT II catalog (Quebec construction standards, FR/EN) to find a classification code before creating or updating an inventory element. Matches code, French/English name, description, and synonyms. Returns up to 50 results.",
    {
      role: roleParam,
      query: z.string().max(100).optional().describe("Free-text search (code, name, description, or synonym in FR or EN). Optional — omit for pure browsing by level/category."),
      level: z.number().int().min(1).max(3).optional().describe("Restrict to a specific UNIFORMAT level (1, 2, or 3). Level 3 is required for createable elements."),
      category: z.string().optional().describe("Filter by major-group category (e.g. 'Shell', 'Services')"),
    },
    async ({ role, query, level, category }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot browse the UNIFORMAT catalog via MCP" }] };
      }
      // At least one of query/level/category must be provided so we never
      // dump the entire catalog without intent.
      if (!query && level === undefined && !category) {
        return { content: [{ type: "text" as const, text: "Please provide at least one of: query, level, or category." }] };
      }
      const { UNIFORMAT_CATALOG } = await import("@shared/data/uniformat-catalog");
      let results = UNIFORMAT_CATALOG;
      if (query && query.trim().length > 0) {
        const searchLower = query.toLowerCase();
        results = results.filter((item) =>
          item.code.toLowerCase().includes(searchLower) ||
          item.nameFr.toLowerCase().includes(searchLower) ||
          item.nameEn.toLowerCase().includes(searchLower) ||
          (item.descriptionFr && item.descriptionFr.toLowerCase().includes(searchLower)) ||
          (item.descriptionEn && item.descriptionEn.toLowerCase().includes(searchLower)) ||
          (item.synonymsEn && item.synonymsEn.some((s) => s.toLowerCase().includes(searchLower))) ||
          (item.synonymsFr && item.synonymsFr.some((s) => s.toLowerCase().includes(searchLower)))
        );
      }
      if (level) results = results.filter((item) => item.level === level);
      if (category) {
        const cLower = category.toLowerCase();
        results = results.filter((item) => item.category.toLowerCase().includes(cLower));
      }
      results = results.slice(0, 50);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "list_element_history",
    "List the repair / minor_rehab / major_rehab / replacement / construction history for a single inventory element. Admin/manager only. Returns events ordered by event date (most recent first).",
    { role: roleParam, elementId: z.string().describe("Building element ID") },
    async ({ role, elementId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view inventory element history" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [element] = await db.select().from(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
      if (!element) return { content: [{ type: "text" as const, text: "Inventory element not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, element.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const history = await db
        .select()
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.elementId, elementId))
        .orderBy(desc(schema.elementHistory.eventDate));
      return { content: [{ type: "text" as const, text: JSON.stringify(history, null, 2) }] };
    }
  );

  // Post-work element project updates: per-element record of what was actually
  // performed when a maintenance project wraps up (repair / minor_rehab /
  // major_rehab / replace / nothing, optional actual cost and notes).
  // Mirrors the REST handlers in server/api/maintenance.ts:
  //   - GET  /api/maintenance/projects/:id/element-updates
  //   - POST /api/maintenance/projects/:id/element-updates  (upsert)
  // RBAC: tenants are blocked on both. The element must already be linked to
  // the project via project_elements (same constraint the REST upsert enforces),
  // and the project's building must be inside an MCP-scoped organization.

  server.tool(
    "list_element_project_updates",
    "List the post-work element updates recorded against a maintenance project (admin/manager only). Each row is the per-element record of what was actually performed (repair / minor_rehab / major_rehab / replace / nothing) along with optional actualCost and notes, joined to the building element's name and UNIFORMAT code. Project's building must be inside an MCP-scoped organization.",
    { role: roleParam, projectId: z.string().describe("Maintenance project ID") },
    async ({ role, projectId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view post-work element updates" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      const updates = await db
        .select({
          id: schema.elementProjectUpdates.id,
          projectId: schema.elementProjectUpdates.projectId,
          elementId: schema.elementProjectUpdates.elementId,
          updateStatus: schema.elementProjectUpdates.updateStatus,
          actualCost: schema.elementProjectUpdates.actualCost,
          notes: schema.elementProjectUpdates.notes,
          createdAt: schema.elementProjectUpdates.createdAt,
          updatedAt: schema.elementProjectUpdates.updatedAt,
          elementName: schema.buildingElements.name,
          uniformatCode: schema.buildingElements.uniformatCode,
          elementDescription: schema.buildingElements.description,
        })
        .from(schema.elementProjectUpdates)
        .innerJoin(schema.buildingElements, eq(schema.elementProjectUpdates.elementId, schema.buildingElements.id))
        .where(eq(schema.elementProjectUpdates.projectId, projectId))
        .orderBy(asc(schema.buildingElements.name));
      return { content: [{ type: "text" as const, text: JSON.stringify(updates, null, 2) }] };
    }
  );

  server.tool(
    "upsert_element_project_update",
    "Record (or update) what was actually done to a single inventory element during a maintenance project's post-work phase (admin/manager only). Creates or updates the row in element_project_updates for the (projectId, elementId) pair. The element must already be linked to the project via project_elements; if it is not, the call is rejected with a hint to attach it first. Project's building must be inside an MCP-scoped organization.",
    {
      role: roleParam,
      projectId: z.string().describe("Maintenance project ID"),
      elementId: z.string().describe("Building element ID (must already be linked to the project)"),
      updateStatus: z
        .enum(["repair", "minor_rehab", "major_rehab", "replace", "nothing"])
        .describe("What was actually done to this element"),
      actualCost: z.number().nonnegative().optional().describe("Optional actual cost charged for this element's work"),
      notes: z.string().optional().describe("Optional free-form notes about the work performed"),
    },
    async ({ role, projectId, elementId, updateStatus, actualCost, notes }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot record post-work element updates" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      // The element must already be attached to the project via the
      // project_elements junction. Mirrors the REST upsert handler so the
      // tool cannot quietly create updates for elements that were never
      // part of the project's scope of work.
      const [link] = await db
        .select({ id: schema.projectElements.id })
        .from(schema.projectElements)
        .where(and(
          eq(schema.projectElements.projectId, projectId),
          eq(schema.projectElements.elementId, elementId),
        ));
      if (!link) {
        return { content: [{ type: "text" as const, text: `Element ${elementId} is not linked to project ${projectId}. Attach it to the project first before recording a post-work update.` }] };
      }
      try {
        const [upserted] = await withRetryableDbCall(() => db
          .insert(schema.elementProjectUpdates)
          .values({
            projectId,
            elementId,
            updateStatus,
            ...(actualCost !== undefined && { actualCost: String(actualCost) }),
            ...(notes !== undefined && { notes }),
          })
          .onConflictDoUpdate({
            target: [schema.elementProjectUpdates.projectId, schema.elementProjectUpdates.elementId],
            set: {
              updateStatus,
              ...(actualCost !== undefined && { actualCost: String(actualCost) }),
              ...(notes !== undefined && { notes }),
              updatedAt: new Date(),
            },
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(upserted, null, 2) }] };
      } catch (e) {
        console.error("[mcp:upsert_element_project_update]", e);
        return buildWriteErrorResponse(e, 'element project update', 'update');
      }
    }
  );

  server.tool(
    "create_element_history_event",
    "Log a work-history event (construction / repair / minor_rehab / major_rehab / replacement) on a building inventory element. Admin/manager only. The element's organization is resolved from its building, and writes are attributed to the OAuth-bound MCP user. When a non-null `lifespanImpact` is supplied, the element's `currentLifespan` is increased by that many years (mirroring the inventory maintenance API). When `eventType` is `repair` or `minor_rehab`, the element's `lastInspectionDate` is also bumped to the supplied `eventDate` (matching the REST behaviour of `POST /api/maintenance/elements/:elementId/history`).",
    {
      role: roleParam,
      elementId: z.string().describe("Building element ID the event applies to"),
      eventType: z
        .enum(["construction", "repair", "minor_rehab", "major_rehab", "replacement"])
        .describe("Type of work performed"),
      eventDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .describe("Date the work was performed (YYYY-MM-DD)"),
      workDescription: z.string().min(1).describe("Description of the work performed"),
      cost: z.number().nonnegative().optional().describe("Cost of the work (>= 0)"),
      vendorId: z
        .string()
        .optional()
        .describe("Vendor ID. Must belong to the same organization as the element's building."),
      vendorName: z
        .string()
        .max(200)
        .optional()
        .describe("Vendor name stored as a free-text historical record (used when no vendorId is available, or alongside it)."),
      lifespanImpact: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional()
        .describe("Years to add to the element's currentLifespan (0-100). When provided non-null, currentLifespan is bumped by this value. Matches the 0-100 range enforced by the inventory bulk-changes maintenance API."),
      warranty: z
        .record(z.any())
        .optional()
        .describe("Warranty details as a JSON object (e.g. { endDate: 'YYYY-MM-DD', terms: '12 months parts and labour' })."),
    },
    async ({ role, elementId, eventType, eventDate, workDescription, cost, vendorId, vendorName, lifespanImpact, warranty }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot log inventory element history" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [element] = await db.select().from(schema.buildingElements).where(eq(schema.buildingElements.id, elementId));
      if (!element) return { content: [{ type: "text" as const, text: "Inventory element not found" }] };
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, element.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      // Validate vendor (if supplied) belongs to the element's organization. The
      // FK on element_history.vendor_id only ensures the vendor exists, not that
      // it lives in the same org — MCP must enforce that itself to prevent
      // cross-org vendor leakage.
      if (vendorId) {
        const [vendor] = await db
          .select({ id: schema.vendors.id, organizationId: schema.vendors.organizationId })
          .from(schema.vendors)
          .where(eq(schema.vendors.id, vendorId));
        if (!vendor) {
          return { content: [{ type: "text" as const, text: `Vendor not found: ${vendorId}` }] };
        }
        if (vendor.organizationId !== building.organizationId) {
          return { content: [{ type: "text" as const, text: `Vendor ${vendorId} does not belong to the element's organization` }] };
        }
      }
      const user = await getMcpUser(role);
      if (!user) return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          const [event] = await tx
            .insert(schema.elementHistory)
            .values({
              elementId,
              eventType,
              eventDate,
              workDescription,
              createdBy: user.id,
              ...(cost !== undefined && { cost: String(cost) }),
              ...(vendorId !== undefined && { vendorId }),
              ...(vendorName !== undefined && { vendorName }),
              ...(lifespanImpact !== undefined && lifespanImpact !== null && { lifespanImpact }),
              ...(warranty !== undefined && { warranty }),
            })
            .returning();
          let updatedElement: { id: string; currentLifespan: number | null; lastInspectionDate: string | null } | null = null;
          const elementUpdates: { currentLifespan?: number; lastInspectionDate?: string; updatedAt: Date } = { updatedAt: new Date() };
          if (lifespanImpact !== undefined && lifespanImpact !== null) {
            elementUpdates.currentLifespan = (element.currentLifespan ?? 0) + lifespanImpact;
          }
          if (eventType === "repair" || eventType === "minor_rehab") {
            elementUpdates.lastInspectionDate = eventDate;
          }
          if (elementUpdates.currentLifespan !== undefined || elementUpdates.lastInspectionDate !== undefined) {
            const [el] = await tx
              .update(schema.buildingElements)
              .set(elementUpdates)
              .where(eq(schema.buildingElements.id, elementId))
              .returning({
                id: schema.buildingElements.id,
                currentLifespan: schema.buildingElements.currentLifespan,
                lastInspectionDate: schema.buildingElements.lastInspectionDate,
              });
            updatedElement = el ?? null;
          }
          return { event, updatedElement };
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_element_history_event]", e);
        return buildWriteErrorResponse(e, 'element history event', 'create');
      }
    }
  );

  server.tool(
    "update_element_history_event",
    "Edit an existing inventory work-history event (construction / repair / minor_rehab / major_rehab / replacement). Admin/manager only. Pass only the fields you want to change; omitted fields are left untouched. The event's element must live in an MCP-scoped organization, and a supplied `vendorId` must belong to the same organization. When `lifespanImpact` changes (including to / from null), the parent element's `currentLifespan` is recomputed by the delta consistently with `create_element_history_event`'s create-side behavior, inside the same transaction.",
    {
      role: roleParam,
      historyId: z.string().describe("Element history event ID to update"),
      eventType: z
        .enum(["construction", "repair", "minor_rehab", "major_rehab", "replacement"])
        .optional()
        .describe("New type of work performed"),
      eventDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
        .optional()
        .describe("New date the work was performed (YYYY-MM-DD)"),
      workDescription: z.string().min(1).optional().describe("New description of the work performed"),
      cost: z.number().nonnegative().nullable().optional().describe("New cost (>= 0). Pass null to clear."),
      vendorId: z
        .string()
        .nullable()
        .optional()
        .describe("New vendor ID. Must belong to the element's organization. Pass null to detach the vendor."),
      vendorName: z
        .string()
        .max(200)
        .nullable()
        .optional()
        .describe("New free-text vendor name stored as historical record. Pass null to clear."),
      lifespanImpact: z
        .number()
        .int()
        .min(0)
        .max(100)
        .nullable()
        .optional()
        .describe("New years to add to the element's currentLifespan (0-100). When this changes, the element's currentLifespan is adjusted by `(new ?? 0) - (old ?? 0)` and clamped at 0. Pass null to clear and refund the previous bump."),
      warranty: z
        .record(z.any())
        .nullable()
        .optional()
        .describe("New warranty details JSON object. Pass null to clear."),
    },
    async ({ role, historyId, eventType, eventDate, workDescription, cost, vendorId, vendorName, lifespanImpact, warranty }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update inventory element history" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [existing] = await db
        .select()
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, historyId));
      if (!existing) {
        return { content: [{ type: "text" as const, text: "Element history event not found" }] };
      }
      const [element] = await db
        .select()
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, existing.elementId));
      if (!element) {
        return { content: [{ type: "text" as const, text: "Inventory element not found" }] };
      }
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, element.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      // Validate vendor (if a non-null id supplied) belongs to the element's
      // organization. Same cross-org guard as the create-side handler.
      if (vendorId) {
        const [vendor] = await db
          .select({ id: schema.vendors.id, organizationId: schema.vendors.organizationId })
          .from(schema.vendors)
          .where(eq(schema.vendors.id, vendorId));
        if (!vendor) {
          return { content: [{ type: "text" as const, text: `Vendor not found: ${vendorId}` }] };
        }
        if (vendor.organizationId !== building.organizationId) {
          return { content: [{ type: "text" as const, text: `Vendor ${vendorId} does not belong to the element's organization` }] };
        }
      }
      // Build the partial update payload. Each field is only included when
      // the caller explicitly passed it (undefined => no change). `null`
      // explicitly clears the column for nullable fields.
      const eventUpdate: Record<string, unknown> = {};
      if (eventType !== undefined) eventUpdate.eventType = eventType;
      if (eventDate !== undefined) eventUpdate.eventDate = eventDate;
      if (workDescription !== undefined) eventUpdate.workDescription = workDescription;
      if (cost !== undefined) eventUpdate.cost = cost === null ? null : String(cost);
      if (vendorId !== undefined) eventUpdate.vendorId = vendorId;
      if (vendorName !== undefined) eventUpdate.vendorName = vendorName;
      if (lifespanImpact !== undefined) eventUpdate.lifespanImpact = lifespanImpact;
      if (warranty !== undefined) eventUpdate.warranty = warranty;
      // Detect a change to lifespanImpact so we can adjust currentLifespan in
      // the same transaction. We treat omitted (undefined) as "no change",
      // and treat both `null` and `undefined` storage as 0 when computing
      // the delta — mirroring create-side `(currentLifespan ?? 0) + impact`.
      const lifespanProvided = lifespanImpact !== undefined;
      const oldImpact = existing.lifespanImpact ?? 0;
      const newImpact = lifespanImpact === undefined
        ? oldImpact
        : (lifespanImpact ?? 0);
      const lifespanDelta = lifespanProvided ? newImpact - oldImpact : 0;
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          let updatedEvent = existing;
          if (Object.keys(eventUpdate).length > 0) {
            const [row] = await tx
              .update(schema.elementHistory)
              .set(eventUpdate)
              .where(eq(schema.elementHistory.id, historyId))
              .returning();
            if (row) updatedEvent = row;
          }
          let updatedElement: { id: string; currentLifespan: number | null } | null = null;
          if (lifespanProvided && lifespanDelta !== 0) {
            const newCurrentLifespan = Math.max(0, (element.currentLifespan ?? 0) + lifespanDelta);
            const [el] = await tx
              .update(schema.buildingElements)
              .set({ currentLifespan: newCurrentLifespan, updatedAt: new Date() })
              .where(eq(schema.buildingElements.id, element.id))
              .returning({ id: schema.buildingElements.id, currentLifespan: schema.buildingElements.currentLifespan });
            updatedElement = el ?? null;
          }
          return { event: updatedEvent, updatedElement };
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_element_history_event]", e);
        return buildWriteErrorResponse(e, 'element history event', 'update');
      }
    }
  );

  server.tool(
    "delete_element_history_event",
    "Delete an inventory work-history event. Admin/manager only. The event's element must live in an MCP-scoped organization. If the event carried a non-null `lifespanImpact`, the parent element's `currentLifespan` is reduced by that many years (clamped at 0) inside the same transaction so the bump previously applied by `create_element_history_event` is rolled back. FK violations and other DB errors are surfaced through the standard structured envelope.",
    {
      role: roleParam,
      historyId: z.string().describe("Element history event ID to delete"),
    },
    async ({ role, historyId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot delete inventory element history" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [existing] = await db
        .select()
        .from(schema.elementHistory)
        .where(eq(schema.elementHistory.id, historyId));
      if (!existing) {
        return { content: [{ type: "text" as const, text: "Element history event not found" }] };
      }
      const [element] = await db
        .select()
        .from(schema.buildingElements)
        .where(eq(schema.buildingElements.id, existing.elementId));
      if (!element) {
        return { content: [{ type: "text" as const, text: "Inventory element not found" }] };
      }
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, element.buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          const [deleted] = await tx
            .delete(schema.elementHistory)
            .where(eq(schema.elementHistory.id, historyId))
            .returning({ id: schema.elementHistory.id });
          let updatedElement: { id: string; currentLifespan: number | null } | null = null;
          const refund = existing.lifespanImpact ?? 0;
          if (refund !== 0) {
            const newCurrentLifespan = Math.max(0, (element.currentLifespan ?? 0) - refund);
            const [el] = await tx
              .update(schema.buildingElements)
              .set({ currentLifespan: newCurrentLifespan, updatedAt: new Date() })
              .where(eq(schema.buildingElements.id, element.id))
              .returning({ id: schema.buildingElements.id, currentLifespan: schema.buildingElements.currentLifespan });
            updatedElement = el ?? null;
          }
          return { deleted: deleted ?? { id: historyId }, updatedElement };
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp:delete_element_history_event]", e);
        return buildWriteErrorResponse(e, 'element history event', 'delete');
      }
    }
  );

  server.tool(
    "downgrade_acting_role",
    "Downgrade the MCP session's acting role to a less-privileged role within the OAuth-bound ceiling. " +
      "Subsequent tool calls that omit the `role` argument will run as the downgraded role. " +
      "Calls that explicitly pass a `role` continue to be validated against the OAuth-bound ceiling. " +
      "Use `restore_acting_role` to revert to the original OAuth-bound role. " +
      "Only available on OAuth-authenticated sessions; legacy API-key sessions have no role to downgrade from.",
    { role: roleParam },
    async ({ role }) => {
      if (!enforcedRole) {
        return {
          content: [{
            type: "text" as const,
            text:
              "No OAuth-bound role to downgrade from: this MCP session is using the legacy " +
              "MCP_API_KEY auth path, which has no acting-role state. Pass the desired `role` " +
              "argument on each tool call instead.",
          }],
        };
      }
      // The wrapper above already validated `role` against allowedRolesFor(enforcedRole),
      // so by the time we get here the requested downgrade is permitted.
      const target = role as McpRole;
      const previous = actingRole ?? enforcedRole;
      actingRole = target;
      const noChange = previous === target;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: true,
              oauthBoundRole: enforcedRole,
              previousActingRole: previous,
              actingRole: target,
              noChange,
              message: noChange
                ? `Acting role unchanged: this session is already acting as "${target}".`
                : `Acting role downgraded from "${previous}" to "${target}". ` +
                  `Subsequent tool calls without an explicit \`role\` argument will run as "${target}". ` +
                  `Call restore_acting_role to revert to the OAuth-bound role "${enforcedRole}".`,
            },
            null,
            2,
          ),
        }],
      };
    },
  );

  server.tool(
    "restore_acting_role",
    "Restore the MCP session's acting role to the original OAuth-bound role granted at consent time. " +
      "Use this to revert a previous `downgrade_acting_role` call. " +
      "Only available on OAuth-authenticated sessions; legacy API-key sessions have no role to restore.",
    {},
    async () => {
      if (!enforcedRole) {
        return {
          content: [{
            type: "text" as const,
            text:
              "No OAuth-bound role to restore: this MCP session is using the legacy " +
              "MCP_API_KEY auth path, which has no acting-role state. Pass the desired `role` " +
              "argument on each tool call instead.",
          }],
        };
      }
      const previous = actingRole ?? enforcedRole;
      actingRole = enforcedRole;
      const noChange = previous === enforcedRole;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: true,
              oauthBoundRole: enforcedRole,
              previousActingRole: previous,
              actingRole: enforcedRole,
              noChange,
              message: noChange
                ? `Acting role unchanged: this session is already acting as the OAuth-bound role "${enforcedRole}".`
                : `Acting role restored from "${previous}" back to the OAuth-bound role "${enforcedRole}".`,
            },
            null,
            2,
          ),
        }],
      };
    },
  );

  server.tool(
    "get_mcp_info",
    "Get information about the MCP setup including available organizations, users, and roles",
    { role: roleParam },
    async ({ role }) => {
      const orgIds = await getMcpOrgIds();
      const orgs = await db
        .select({ id: schema.organizations.id, name: schema.organizations.name })
        .from(schema.organizations)
        .where(inArray(schema.organizations.id, orgIds));

      const users = await db
        .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role, firstName: schema.users.firstName, lastName: schema.users.lastName })
        .from(schema.users)
        .where(inArray(schema.users.email, ["mcp-admin@koveo-mcp.test", "mcp-manager@koveo-mcp.test", "mcp-tenant@koveo-mcp.test"]));

      const buildingCount = await db
        .select({ id: schema.buildings.id })
        .from(schema.buildings)
        .where(inArray(schema.buildings.organizationId, orgIds));

      // `role` here is whatever role this specific call is effectively
      // executing as. When OAuth is in use, the central RBAC patch above
      // guarantees this is either the OAuth-bound role or a permitted
      // downgrade of it (e.g. a manager-bound session calling with
      // `role: "tenant"` will see `role === "tenant"` here). When the
      // legacy MCP_API_KEY path is in use, it's the caller-supplied arg.
      const oauthBoundRole = enforcedRole ?? null;
      const currentActingRole: McpRole | null = oauthBoundRole
        ? actingRole ?? oauthBoundRole
        : null;
      const allowedRoles: McpRole[] = oauthBoundRole
        ? allowedRolesFor(oauthBoundRole)
        : ["admin", "manager", "tenant"];
      const downgradeActive =
        oauthBoundRole !== null && currentActingRole !== oauthBoundRole;
      const roleNote = oauthBoundRole
        ? `This MCP session is OAuth-authenticated and bound to role "${oauthBoundRole}". ` +
          `The current acting role is "${currentActingRole}"` +
          (downgradeActive
            ? ` (a session-level downgrade is in effect — call restore_acting_role to revert).`
            : ` (no downgrade in effect).`) +
          ` You may pass any of [${allowedRoles.map((r) => `"${r}"`).join(', ')}] as the ` +
          `"role" argument on tool calls — the OAuth-bound role is the ceiling, and ` +
          `lower-privileged roles are accepted as a downgrade so you can explore what a ` +
          `tenant (or, for admin sessions, a manager) sees within the same session. ` +
          `For a sticky downgrade that applies to every subsequent tool call without ` +
          `re-passing \`role\`, use the downgrade_acting_role tool. ` +
          `Passing a more-privileged role returns an authorization-mismatch error; ` +
          `to escalate, disconnect the connector and re-authorize, selecting the desired ` +
          `role on the consent screen.`
        : `This MCP session is using the legacy API-key auth path. The "role" argument ` +
          `on each tool call selects which role to act as. The downgrade_acting_role ` +
          `and restore_acting_role tools are not usable on this auth path.`;
      // Enumerate every tool currently registered on this MCP server so the
      // tool list is self-describing. Avoids the documentation-drift hazard
      // where a new tool ships in code but `get_mcp_info` still advertises
      // the old hand-curated list. The SDK exposes `_registeredTools` as a
      // map keyed by tool name with `{ description, ... }` values.
      const registeredToolsMap = (server as unknown as {
        _registeredTools?: Record<string, { description?: string }>;
      })._registeredTools;
      const registeredTools = registeredToolsMap
        ? Object.keys(registeredToolsMap)
            .sort()
            .map((name) => ({
              name,
              description: registeredToolsMap[name]?.description ?? "",
            }))
        : [];

      const info = {
        description: "Koveo Gestion MCP Server - Property Management Platform for Quebec",
        // Build stamp resolved once at module load — lets support confirm
        // the deployed long-lived MCP bundle matches the latest commit.
        // Compare `buildSha`/`buildTime` before and after a redeploy to
        // confirm the bundle actually moved. See the resolver block at the
        // top of this file for the full precedence.
        buildSha: BUILD_SHA,
        buildTime: BUILD_TIME,
        tools: registeredTools,
        toolCount: registeredTools.length,
        organizations: orgs,
        users: users.map((u) => ({ ...u, note: `Use role="${u.role}" to act as this user` })),
        // `currentRole` reflects the role this specific call is executing as
        // (may be a downgrade from the OAuth-bound role). `allowedRoles` lists
        // every role the current session may pass as `role` on tool calls.
        // `actingRole` is the *sticky* downgraded role for the session — it's
        // what gets injected into subsequent tool calls that omit `role`.
        // `downgradeActive` is a convenience flag for clients that just want
        // to know whether the acting role differs from the OAuth-bound role.
        currentRole: role,
        oauthBoundRole,
        actingRole: currentActingRole,
        downgradeActive,
        allowedRoles,
        roleNote,
        // `note` is an alias for `roleNote` so MCP clients that look for a
        // generic `note` field at the top level still find the role guidance.
        note: roleNote,
        stats: {
          organizations: orgs.length,
          buildings: buildingCount.length,
        },
        availableRoles: ["admin", "manager", "tenant"],
        roleDescriptions: {
          admin: "Full system access - can manage organizations, buildings, users, bills, etc.",
          manager: "Property management - can manage buildings, residences, bills, maintenance, communications",
          tenant: "Resident access - can view own residences, submit maintenance requests and demands, view bills",
        },
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }] };
    }
  );

  const documentService = new DocumentService();
  const objectStorageService = new ObjectStorageService();

  function getDocumentAnalysisPrompt(typeHint: string): string {
    const base = "Analyze this document and extract relevant information. Return the data as a structured JSON object.";
    switch (typeHint) {
      case "bills":
        return `${base} This is a bill or invoice document. Extract: vendor/company name, bill/invoice number, amount(s) and currency, due date or service period, category (utilities, maintenance, insurance, etc.), payment details, any recurring payment information.`;
      case "buildings":
        return `${base} This is a building-related document. Extract: document type (inspection report, maintenance record, permit, etc.), building information (name, address, details), date and any deadlines, key findings or recommendations, contact information, any compliance or regulatory information.`;
      case "residences":
        return `${base} This is a residence-related document. Extract: unit or apartment details, resident information, document type (lease, inspection, maintenance, etc.), dates and deadlines, key details or issues, any fees or charges mentioned.`;
      case "maintenance":
        return `${base} This is a maintenance-related document. Extract: type of maintenance (preventive, corrective, emergency), equipment or system affected, issue description, work performed or required, parts or materials needed, timeline and priorities, safety considerations.`;
      default:
        return `${base} Extract any structured information including: document type and purpose, key dates and deadlines, important details and findings, contact information, action items or next steps.`;
    }
  }

  async function analyzeDocumentWithGemini(fileBuffer: Buffer, mimeType: string, typeHint: string): Promise<any> {
    if (typeHint === "bills") {
      return aiService.extractBillData(fileBuffer, mimeType);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const prompt = getDocumentAnalysisPrompt(typeHint);
    const base64Data = fileBuffer.toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = result.candidates[0].content.parts[0].text;
      if (typeof text !== "string") {
        return text;
      }
      try {
        return JSON.parse(text);
      } catch (parseError: any) {
        return {
          parseError: true,
          message: "Gemini returned non-JSON content",
          error: parseError?.message ?? String(parseError),
          rawText: text,
        };
      }
    }
    throw new Error("Invalid response from Gemini");
  }

  server.tool(
    "request_upload_url",
    "Request a presigned URL to upload a document to object storage. Returns the upload URL and the resulting storage path. After uploading the file via HTTP PUT to the URL, call confirm_document_upload to register it.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID the document belongs to"),
      filename: z.string().min(1).describe("Original filename including extension (e.g. 'invoice.pdf')"),
      documentType: z.enum(["documents", "bills", "inventory", "projects", "demands", "maintenance"]).describe("Type/category of document"),
      residenceId: z.string().optional().describe("Residence ID if the document is residence-specific"),
      entityId: z.string().optional().describe("Related entity ID (e.g. bill ID) if attaching to a specific record"),
    },
    async ({ role, buildingId, filename, documentType, residenceId, entityId }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }

      if (residenceId) {
        const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
        if (!residence || residence.buildingId !== buildingId) {
          return { content: [{ type: "text" as const, text: "Residence not found or does not belong to the specified building" }] };
        }
      }

      if (role === "tenant") {
        if (!residenceId) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants must specify a residenceId to upload documents" }] };
        }
        const user = await getMcpUser("tenant");
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };
        const tenantResidence = await db
          .select()
          .from(schema.userResidences)
          .where(
            and(
              eq(schema.userResidences.userId, user.id),
              eq(schema.userResidences.residenceId, residenceId),
              eq(schema.userResidences.isActive, true)
            )
          )
          .limit(1);
        if (tenantResidence.length === 0) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants can only upload to their own residence" }] };
        }
        const allowedTypes: DocumentType[] = ["documents", "maintenance"];
        if (!allowedTypes.includes(documentType)) {
          return { content: [{ type: "text" as const, text: `Access denied: tenants can only upload document types: ${allowedTypes.join(", ")}` }] };
        }
      }

      const context = {
        type: documentType as DocumentType,
        buildingId,
        residenceId,
        entityId,
        organizationId: building.organizationId,
      };

      const result = await documentService.getUploadUrl(context, filename);
      if (!result.success) {
        return { content: [{ type: "text" as const, text: `Failed to generate upload URL: ${result.error}` }] };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            uploadUrl: result.uploadUrl,
            storagePath: result.filePath,
            method: "PUT",
            expiresInSeconds: 900,
            instructions: "Upload the file by making an HTTP PUT request to the uploadUrl with the file content as the request body. After uploading, call confirm_document_upload with the storagePath to register the document.",
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "confirm_document_upload",
    "Register a document in the system after it has been uploaded to object storage via the presigned URL from request_upload_url. Creates a document record in the database. Tenants can confirm uploads to their own residence only (documents and maintenance types).",
    {
      role: roleParam,
      storagePath: z.string().min(1).describe("The storage path returned by request_upload_url"),
      buildingId: z.string().describe("Building ID the document belongs to"),
      name: z.string().min(1).describe("Human-readable document name/title"),
      documentType: z.enum(["documents", "bills", "inventory", "projects", "demands", "maintenance"]).describe("Type/category of document"),
      fileName: z.string().optional().describe("Original filename"),
      mimeType: z.string().optional().describe("MIME type of the file (e.g. 'application/pdf', 'image/jpeg')"),
      fileSize: z.number().int().optional().describe("File size in bytes"),
      residenceId: z.string().optional().describe("Residence ID if residence-specific"),
      description: z.string().optional().describe("Document description"),
      isVisibleToTenants: z.boolean().default(false).describe("Whether tenants can see this document"),
    },
    async ({ role, storagePath, buildingId, name, documentType, fileName, mimeType, fileSize, residenceId, description, isVisibleToTenants }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }

      const normalizedPath = documentService.normalizePath(storagePath);
      const expectedPrefix = `/objects/buildings/${buildingId}/`;
      if (!normalizedPath.startsWith(expectedPrefix)) {
        return { content: [{ type: "text" as const, text: `Invalid storage path: path must belong to building ${buildingId}` }] };
      }

      if (residenceId) {
        const [residence] = await db.select().from(schema.residences).where(eq(schema.residences.id, residenceId));
        if (!residence || residence.buildingId !== buildingId) {
          return { content: [{ type: "text" as const, text: "Residence not found or does not belong to the specified building" }] };
        }
      }

      if (role === "tenant") {
        if (!residenceId) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants must specify a residenceId when confirming uploads" }] };
        }
        const allowedTypes: DocumentType[] = ["documents", "maintenance"];
        if (!allowedTypes.includes(documentType)) {
          return { content: [{ type: "text" as const, text: `Access denied: tenants can only upload document types: ${allowedTypes.join(", ")}` }] };
        }
        const user = await getMcpUser("tenant");
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };
        const tenantResidence = await db
          .select()
          .from(schema.userResidences)
          .where(
            and(
              eq(schema.userResidences.userId, user.id),
              eq(schema.userResidences.residenceId, residenceId),
              eq(schema.userResidences.isActive, true)
            )
          )
          .limit(1);
        if (tenantResidence.length === 0) {
          return { content: [{ type: "text" as const, text: "Access denied: tenants can only confirm uploads to their own residence" }] };
        }
      }

      try {
        await objectStorageService.getObjectEntityFile(normalizedPath);
      } catch (error: any) {
        if (error.name === "ObjectNotFoundError") {
          return { content: [{ type: "text" as const, text: "File not found at the specified storage path. Make sure the file was uploaded via the presigned URL before confirming." }] };
        }
        console.error("[mcp:confirm_document_upload] failed to verify uploaded file", error);
        return { content: [{ type: "text" as const, text: "Failed to verify uploaded file — please retry" }] };
      }

      const user = await getMcpUser(role);

      try {
        const [doc] = await withRetryableDbCall(() => db
          .insert(schema.documents)
          .values({
            name,
            description: description || null,
            documentType,
            filePath: normalizedPath,
            fileName: fileName || null,
            mimeType: mimeType || null,
            fileSize: fileSize || null,
            buildingId,
            residenceId: residenceId || null,
            uploadedById: user?.id || null,
            isVisibleToTenants: role === "tenant" ? false : isVisibleToTenants,
          })
          .returning());

        await documentService.setDocumentAcl(normalizedPath, user?.id || "system", {
          type: documentType as DocumentType,
          buildingId,
          residenceId,
          organizationId: building.organizationId,
        });

        return { content: [{ type: "text" as const, text: JSON.stringify(doc, null, 2) }] };
      } catch (error: any) {
        console.error("[mcp:confirm_document_upload] failed to register document", error);
        return buildWriteErrorResponse(error, 'document', 'create');
      }
    }
  );

  server.tool(
    "analyze_document",
    "Analyze a document stored in object storage using AI (Gemini). Extracts structured data such as vendor names, amounts, dates, and categories from invoices, bills, and other documents. The document must be registered in the system (via confirm_document_upload or existing in the documents table).",
    {
      role: roleParam,
      storagePath: z.string().min(1).describe("The object storage path of the document (e.g. from confirm_document_upload or list_documents filePath field)"),
      documentTypeHint: z.enum(["bills", "buildings", "residences", "maintenance", "general"]).default("general").describe("Hint about the document type to improve extraction accuracy"),
    },
    async ({ role, storagePath, documentTypeHint }) => {
      const orgIds = await getMcpOrgIds();
      const normalizedPath = documentService.normalizePath(storagePath);

      const [doc] = await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.filePath, normalizedPath))
        .limit(1);

      if (!doc) {
        return { content: [{ type: "text" as const, text: "Document not found in the system. The document must be registered via confirm_document_upload before analysis." }] };
      }

      if (doc.buildingId) {
        const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, doc.buildingId));
        if (!building || !orgIds.includes(building.organizationId)) {
          return { content: [{ type: "text" as const, text: "Access denied: document belongs to a building outside MCP scope" }] };
        }
      }

      if (role === "tenant") {
        if (!doc.isVisibleToTenants) {
          return { content: [{ type: "text" as const, text: "Access denied: this document is not visible to tenants" }] };
        }
        const user = await getMcpUser("tenant");
        if (!user) return { content: [{ type: "text" as const, text: "MCP tenant user not found" }] };

        if (doc.residenceId) {
          const tenantResidence = await db
            .select()
            .from(schema.userResidences)
            .where(
              and(
                eq(schema.userResidences.userId, user.id),
                eq(schema.userResidences.residenceId, doc.residenceId),
                eq(schema.userResidences.isActive, true)
              )
            )
            .limit(1);
          if (tenantResidence.length === 0) {
            return { content: [{ type: "text" as const, text: "Access denied: tenants can only analyze documents from their own residence" }] };
          }
        } else if (doc.buildingId) {
          const tenantBuildingMembership = await db
            .select({ id: schema.userResidences.id })
            .from(schema.userResidences)
            .innerJoin(
              schema.residences,
              eq(schema.userResidences.residenceId, schema.residences.id)
            )
            .where(
              and(
                eq(schema.userResidences.userId, user.id),
                eq(schema.userResidences.isActive, true),
                eq(schema.residences.buildingId, doc.buildingId)
              )
            )
            .limit(1);
          if (tenantBuildingMembership.length === 0) {
            return { content: [{ type: "text" as const, text: "Access denied: tenants can only analyze building documents for buildings they reside in" }] };
          }
        }
      }

      try {
        const objectFile = await objectStorageService.getObjectEntityFile(normalizedPath);

        const [metadata] = await objectFile.getMetadata();
        const mimeType = (metadata.contentType as string) || "application/octet-stream";

        const supportedTypes = [
          "application/pdf",
          "image/jpeg", "image/jpg", "image/png", "image/webp",
          "image/heic", "image/heif",
        ];
        if (!supportedTypes.includes(mimeType)) {
          return {
            content: [{
              type: "text" as const,
              text: `Unsupported file type for AI analysis: ${mimeType}. Supported types: ${supportedTypes.join(", ")}`,
            }],
          };
        }

        const fileSize = metadata.size ? Number(metadata.size) : 0;
        if (fileSize > 50 * 1024 * 1024) {
          return { content: [{ type: "text" as const, text: "File too large for AI analysis. Maximum supported size is 50MB." }] };
        }

        const [buffer] = await objectFile.download();

        const analysisResult = await analyzeDocumentWithGemini(buffer, mimeType, documentTypeHint);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              documentId: doc.id,
              storagePath: normalizedPath,
              documentTypeHint,
              mimeType,
              fileSize,
              analysisResult,
              analyzedAt: new Date().toISOString(),
            }, null, 2),
          }],
        };
      } catch (error: any) {
        const errorMsg = error.name === "ObjectNotFoundError"
          ? `Document file not found in storage at path: ${normalizedPath}`
          : "Analysis failed — please retry";
        console.error("[mcp:analyze_document] failed", error);
        return { content: [{ type: "text" as const, text: errorMsg }] };
      }
    }
  );

  server.tool(
    "delete_building",
    "Delete a building (admin/manager only). Only buildings inside MCP-scoped organizations can be deleted via MCP. Cascades in application code (inside a single transaction) to all dependent rows: every residence in the building (and each residence's invoices, documents, building elements, maintenance requests, demands, and user-residence links), then building-scoped bills (and their payments), budgets, monthly budgets, capital investments, financial cache, invoices, documents, demands and their demand_comments (rows where this building is the primary buildingId are deleted; rows where it is only the assignationBuildingId are null-ed out), notification configurations and their notification_dispatch_log entries, contacts, common spaces (and their bookings/restrictions), user-building links, building elements, auto-generated projects, and maintenance projects. Pending invitations attached directly to the building or to any of its residences are soft-cancelled (status set to 'cancelled' and the dangling residenceId/buildingId nulled); already-terminal invitations are left alone. Returns a structured summary of how many rows were removed from each child table.",
    { role: roleParam, buildingId: z.string().describe("Building ID to delete") },
    async ({ role, buildingId }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      const auth = authorizeDeleteInMcpScope({
        role,
        entityKind: 'building',
        entityId: buildingId,
        entity: { exists: !!building, organizationId: building?.organizationId },
        mcpOrgIds: orgIds,
      });
      if (!auth.ok) return auth.response;
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          // Step 1: cascade through every residence in this building, mirroring
          // the per-residence cascade implemented by `delete_residence` so that
          // residence-scoped FK dependents (invoices, documents, building
          // elements, maintenance requests, demands, user-residence links) are
          // removed before the residences themselves are dropped.
          const residenceRows = await tx
            .select({ id: schema.residences.id })
            .from(schema.residences)
            .where(eq(schema.residences.buildingId, buildingId));
          const residenceIds = residenceRows.map((r) => r.id);

          let resInvoices = 0;
          let resDocuments = 0;
          let resBuildingElements = 0;
          let resMaintenanceRequests = 0;
          let resDemands = 0;
          let resDemandComments = 0;
          let resDemandsCleared = 0;
          let resUserResidences = 0;
          let resInvitationsCancelled = 0;
          let residencesDeletedCount = 0;

          if (residenceIds.length > 0) {
            resInvoices = (await tx
              .delete(schema.invoices)
              .where(inArray(schema.invoices.residenceId, residenceIds))
              .returning({ id: schema.invoices.id })).length;
            resDocuments = (await tx
              .delete(schema.documents)
              .where(inArray(schema.documents.residenceId, residenceIds))
              .returning({ id: schema.documents.id })).length;
            resBuildingElements = (await tx
              .delete(schema.buildingElements)
              .where(inArray(schema.buildingElements.residenceId, residenceIds))
              .returning({ id: schema.buildingElements.id })).length;
            resMaintenanceRequests = (await tx
              .delete(schema.maintenanceRequests)
              .where(inArray(schema.maintenanceRequests.residenceId, residenceIds))
              .returning({ id: schema.maintenanceRequests.id })).length;
            // demand_comments.demandId references demands.id without ON
            // DELETE CASCADE, so dispose of comments before deleting the
            // parent demands or the FK will block the building delete.
            const resDemandIdRows = await tx
              .select({ id: schema.demands.id })
              .from(schema.demands)
              .where(inArray(schema.demands.residenceId, residenceIds));
            const resDemandIds = resDemandIdRows.map((r) => r.id);
            if (resDemandIds.length > 0) {
              resDemandComments = (await tx
                .delete(schema.demandComments)
                .where(inArray(schema.demandComments.demandId, resDemandIds))
                .returning({ id: schema.demandComments.id })).length;
            }
            resDemands = (await tx
              .delete(schema.demands)
              .where(inArray(schema.demands.residenceId, residenceIds))
              .returning({ id: schema.demands.id })).length;
            // Clear assignations that point at any of these residences but
            // live in a primary residence outside the building.
            resDemandsCleared = (await tx
              .update(schema.demands)
              .set({ assignationResidenceId: null })
              .where(inArray(schema.demands.assignationResidenceId, residenceIds))
              .returning({ id: schema.demands.id })).length;
            resUserResidences = (await tx
              .delete(schema.userResidences)
              .where(inArray(schema.userResidences.residenceId, residenceIds))
              .returning({ id: schema.userResidences.id })).length;
            // Soft-cancel invitations attached to any residence in this
            // building (see task #383). The status='pending' guard keeps
            // already-terminal rows untouched so the audit trail is
            // preserved. We null both residenceId AND buildingId here:
            // every residence in residenceIds belongs to the building
            // being deleted, so any buildingId on the invitation is
            // about to dangle anyway. Nulling it in the same pass also
            // prevents the dual-linked edge case where the building-
            // scope sweep below (filtered by status='pending') would
            // skip the row we just cancelled and leave buildingId set.
            resInvitationsCancelled = (await tx
              .update(schema.invitations)
              .set({
                status: 'cancelled',
                residenceId: null,
                buildingId: null,
                updatedAt: new Date(),
              })
              .where(and(
                inArray(schema.invitations.residenceId, residenceIds),
                eq(schema.invitations.status, 'pending'),
              ))
              .returning({ id: schema.invitations.id })).length;
            residencesDeletedCount = (await tx
              .delete(schema.residences)
              .where(inArray(schema.residences.id, residenceIds))
              .returning({ id: schema.residences.id })).length;
          }

          // Step 2: building-scoped dependents. Even tables whose FK is
          // declared `ON DELETE CASCADE` are torn down explicitly so the
          // cascade summary surfaces accurate counts to callers.
          const billsDeleted = await tx
            .delete(schema.bills)
            .where(eq(schema.bills.buildingId, buildingId))
            .returning({ id: schema.bills.id });
          const budgetsDeleted = await tx
            .delete(schema.budgets)
            .where(eq(schema.budgets.buildingId, buildingId))
            .returning({ id: schema.budgets.id });
          const monthlyBudgetsDeleted = await tx
            .delete(schema.monthlyBudgets)
            .where(eq(schema.monthlyBudgets.buildingId, buildingId))
            .returning({ id: schema.monthlyBudgets.id });
          const capitalInvestmentsDeleted = await tx
            .delete(schema.capitalInvestments)
            .where(eq(schema.capitalInvestments.buildingId, buildingId))
            .returning({ id: schema.capitalInvestments.id });
          const financialCacheDeleted = await tx
            .delete(schema.financialCache)
            .where(eq(schema.financialCache.buildingId, buildingId))
            .returning({ id: schema.financialCache.id });
          const buildingInvoicesDeleted = await tx
            .delete(schema.invoices)
            .where(eq(schema.invoices.buildingId, buildingId))
            .returning({ id: schema.invoices.id });
          const buildingDocumentsDeleted = await tx
            .delete(schema.documents)
            .where(eq(schema.documents.buildingId, buildingId))
            .returning({ id: schema.documents.id });
          const buildingDemandIdRows = await tx
            .select({ id: schema.demands.id })
            .from(schema.demands)
            .where(eq(schema.demands.buildingId, buildingId));
          const buildingDemandIds = buildingDemandIdRows.map((r) => r.id);
          let buildingDemandCommentsCount = 0;
          if (buildingDemandIds.length > 0) {
            buildingDemandCommentsCount = (await tx
              .delete(schema.demandComments)
              .where(inArray(schema.demandComments.demandId, buildingDemandIds))
              .returning({ id: schema.demandComments.id })).length;
          }
          const buildingDemandsDeleted = await tx
            .delete(schema.demands)
            .where(eq(schema.demands.buildingId, buildingId))
            .returning({ id: schema.demands.id });
          // Demands that only point at this building as the assignation
          // target get the assignation cleared rather than deleted.
          const buildingDemandsCleared = await tx
            .update(schema.demands)
            .set({ assignationBuildingId: null })
            .where(eq(schema.demands.assignationBuildingId, buildingId))
            .returning({ id: schema.demands.id });
          // notification_dispatch_log.configurationId references
          // notification_configurations.id without ON DELETE CASCADE, so
          // dispose of dispatch records before deleting their parent
          // configurations.
          const notificationConfigIdRows = await tx
            .select({ id: schema.notificationConfigurations.id })
            .from(schema.notificationConfigurations)
            .where(eq(schema.notificationConfigurations.buildingId, buildingId));
          const notificationConfigIds = notificationConfigIdRows.map((r) => r.id);
          let notificationDispatchLogCount = 0;
          if (notificationConfigIds.length > 0) {
            notificationDispatchLogCount = (await tx
              .delete(schema.notificationDispatchLog)
              .where(inArray(schema.notificationDispatchLog.configurationId, notificationConfigIds))
              .returning({ id: schema.notificationDispatchLog.id })).length;
          }
          const notificationConfigurationsDeleted = await tx
            .delete(schema.notificationConfigurations)
            .where(eq(schema.notificationConfigurations.buildingId, buildingId))
            .returning({ id: schema.notificationConfigurations.id });
          const contactsDeleted = await tx
            .delete(schema.contacts)
            .where(and(
              eq(schema.contacts.entity, 'building'),
              eq(schema.contacts.entityId, buildingId),
            ))
            .returning({ id: schema.contacts.id });
          const commonSpacesDeleted = await tx
            .delete(schema.commonSpaces)
            .where(eq(schema.commonSpaces.buildingId, buildingId))
            .returning({ id: schema.commonSpaces.id });
          const userBuildingsDeleted = await tx
            .delete(schema.userBuildings)
            .where(eq(schema.userBuildings.buildingId, buildingId))
            .returning({ id: schema.userBuildings.id });
          // auto_generated_projects.element_id is declared ON DELETE
          // CASCADE against building_elements, so we delete the
          // auto-generated projects first to keep accurate counts in the
          // cascade summary instead of letting the FK silently take them.
          const autoGeneratedProjectsDeleted = await tx
            .delete(schema.autoGeneratedProjects)
            .where(eq(schema.autoGeneratedProjects.buildingId, buildingId))
            .returning({ id: schema.autoGeneratedProjects.id });
          const buildingElementsDeleted = await tx
            .delete(schema.buildingElements)
            .where(eq(schema.buildingElements.buildingId, buildingId))
            .returning({ id: schema.buildingElements.id });
          const maintenanceProjectsDeleted = await tx
            .delete(schema.maintenanceProjects)
            .where(eq(schema.maintenanceProjects.buildingId, buildingId))
            .returning({ id: schema.maintenanceProjects.id });
          // Soft-cancel pending invitations directly attached to this
          // building (see task #383). Residence-scoped invitations were
          // already swept in Step 1 above. We also null the dangling
          // buildingId so any future inspection doesn't dereference a
          // missing building row.
          const buildingInvitationsCancelled = await tx
            .update(schema.invitations)
            .set({ status: 'cancelled', buildingId: null, updatedAt: new Date() })
            .where(and(
              eq(schema.invitations.buildingId, buildingId),
              eq(schema.invitations.status, 'pending'),
            ))
            .returning({ id: schema.invitations.id });

          const deleted = await tx
            .delete(schema.buildings)
            .where(eq(schema.buildings.id, buildingId))
            .returning({ id: schema.buildings.id, name: schema.buildings.name });

          return {
            deleted: deleted[0] ?? null,
            cascaded: {
              residences: residencesDeletedCount,
              invoices: resInvoices + buildingInvoicesDeleted.length,
              documents: resDocuments + buildingDocumentsDeleted.length,
              bills: billsDeleted.length,
              budgets: budgetsDeleted.length,
              monthlyBudgets: monthlyBudgetsDeleted.length,
              capitalInvestments: capitalInvestmentsDeleted.length,
              financialCache: financialCacheDeleted.length,
              demands: resDemands + buildingDemandsDeleted.length,
              demandComments: resDemandComments + buildingDemandCommentsCount,
              maintenanceRequests: resMaintenanceRequests,
              buildingElements: resBuildingElements + buildingElementsDeleted.length,
              autoGeneratedProjects: autoGeneratedProjectsDeleted.length,
              maintenanceProjects: maintenanceProjectsDeleted.length,
              notificationConfigurations: notificationConfigurationsDeleted.length,
              notificationDispatchLog: notificationDispatchLogCount,
              contacts: contactsDeleted.length,
              commonSpaces: commonSpacesDeleted.length,
              userBuildings: userBuildingsDeleted.length,
              userResidences: resUserResidences,
              invitations: resInvitationsCancelled + buildingInvitationsCancelled.length,
            },
            demandsAssignationCleared: resDemandsCleared + buildingDemandsCleared.length,
          };
        }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, message: "Building deleted (cascade applied to residences, bills, budgets, invoices, documents, demands, common spaces, user links, building elements, maintenance projects, invitations)" }, null, 2),
          }],
        };
      } catch (e) {
        // Log full driver error (includes SQL text + bound params) to the
        // server console so operators can debug, but never interpolate it
        // into the MCP response — see task #239.
        console.error("[mcp:delete_building]", e);
        return buildWriteErrorResponse(e, 'building', 'delete');
      }
    }
  );

  server.tool(
    "delete_residence",
    "Delete a single residence (admin/manager only). Only residences attached to buildings inside MCP-scoped organizations can be deleted via MCP. Cascades in application code (inside a single transaction) to all dependent rows: invoices, documents, building elements, maintenance requests, demands (rows where this residence is the primary residenceId are deleted; rows where it is only the assignationResidenceId are null-ed out), and user-residence links. Pending invitations whose residenceId points at this residence are soft-cancelled (status set to 'cancelled' and the dangling residenceId nulled); already-terminal invitations are left alone. Returns a structured summary of how many rows were removed from each child table.",
    { role: roleParam, residenceId: z.string().describe("Residence ID to delete") },
    async ({ role, residenceId }) => {
      const orgIds = await getMcpOrgIds();
      const [residence] = await db
        .select()
        .from(schema.residences)
        .where(eq(schema.residences.id, residenceId));
      let buildingOrgId: string | null | undefined = undefined;
      if (residence) {
        const [building] = await db
          .select({ organizationId: schema.buildings.organizationId })
          .from(schema.buildings)
          .where(eq(schema.buildings.id, residence.buildingId));
        buildingOrgId = building?.organizationId;
      }
      const auth = authorizeDeleteInMcpScope({
        role,
        entityKind: 'residence',
        entityId: residenceId,
        entity: { exists: !!residence, organizationId: buildingOrgId },
        mcpOrgIds: orgIds,
      });
      if (!auth.ok) return auth.response;
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          const invoicesDeleted = await tx
            .delete(schema.invoices)
            .where(eq(schema.invoices.residenceId, residenceId))
            .returning({ id: schema.invoices.id });
          const documentsDeleted = await tx
            .delete(schema.documents)
            .where(eq(schema.documents.residenceId, residenceId))
            .returning({ id: schema.documents.id });
          const buildingElementsDeleted = await tx
            .delete(schema.buildingElements)
            .where(eq(schema.buildingElements.residenceId, residenceId))
            .returning({ id: schema.buildingElements.id });
          const maintenanceRequestsDeleted = await tx
            .delete(schema.maintenanceRequests)
            .where(eq(schema.maintenanceRequests.residenceId, residenceId))
            .returning({ id: schema.maintenanceRequests.id });
          const demandsDeleted = await tx
            .delete(schema.demands)
            .where(eq(schema.demands.residenceId, residenceId))
            .returning({ id: schema.demands.id });
          // Demands that only point at this residence as the assignation
          // target (but live in a different primary residence) get the
          // assignation cleared so they are not orphaned by the FK.
          const demandsCleared = await tx
            .update(schema.demands)
            .set({ assignationResidenceId: null })
            .where(eq(schema.demands.assignationResidenceId, residenceId))
            .returning({ id: schema.demands.id });
          const userResidencesDeleted = await tx
            .delete(schema.userResidences)
            .where(eq(schema.userResidences.residenceId, residenceId))
            .returning({ id: schema.userResidences.id });
          // invitations.residenceId has no FK in the database (see task
          // #383). Soft-cancel any non-terminal invitation pointing at
          // this residence and null the dangling residenceId so the
          // accept/resend/cancel flows treat it as a finished
          // invitation instead of attempting to dereference a missing
          // residence row. Already-terminal rows
          // (accepted/cancelled/expired) are left alone to preserve the
          // audit trail.
          const invitationsCancelled = await tx
            .update(schema.invitations)
            .set({ status: 'cancelled', residenceId: null, updatedAt: new Date() })
            .where(and(
              eq(schema.invitations.residenceId, residenceId),
              eq(schema.invitations.status, 'pending'),
            ))
            .returning({ id: schema.invitations.id });
          const deleted = await tx
            .delete(schema.residences)
            .where(eq(schema.residences.id, residenceId))
            .returning({ residenceId: schema.residences.id, unitNumber: schema.residences.unitNumber });
          return {
            deleted: deleted[0] ?? null,
            cascaded: {
              invoices: invoicesDeleted.length,
              documents: documentsDeleted.length,
              demands: demandsDeleted.length,
              maintenanceRequests: maintenanceRequestsDeleted.length,
              buildingElements: buildingElementsDeleted.length,
              userResidences: userResidencesDeleted.length,
              invitations: invitationsCancelled.length,
            },
            demandsAssignationCleared: demandsCleared.length,
          };
        }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, message: "Residence deleted (cascade applied to invoices, documents, building elements, maintenance requests, demands, user links, invitations)" }, null, 2),
          }],
        };
      } catch (e) {
        // Log full driver error (includes SQL text + bound params) to the
        // server console so operators can debug, but never interpolate it
        // into the MCP response — see task #239.
        console.error("[mcp:delete_residence]", e);
        return buildWriteErrorResponse(e, 'residence', 'delete');
      }
    }
  );

  server.tool(
    "delete_bill",
    "Delete a bill (admin/manager only). Only bills attached to buildings inside MCP-scoped organizations can be deleted via MCP. Cascades to scheduled payments.",
    { role: roleParam, billId: z.string().describe("Bill ID to delete") },
    async ({ role, billId }) => {
      const orgIds = await getMcpOrgIds();
      const [bill] = await db.select().from(schema.bills).where(eq(schema.bills.id, billId));
      let buildingOrgId: string | null | undefined = undefined;
      if (bill) {
        const [building] = await db
          .select({ organizationId: schema.buildings.organizationId })
          .from(schema.buildings)
          .where(eq(schema.buildings.id, bill.buildingId));
        buildingOrgId = building?.organizationId;
      }
      const auth = authorizeDeleteInMcpScope({
        role,
        entityKind: 'bill',
        entityId: billId,
        entity: { exists: !!bill, organizationId: buildingOrgId },
        mcpOrgIds: orgIds,
      });
      if (!auth.ok) return auth.response;
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          // Explicitly delete dependent payments inside the same
          // transaction so the MCP response can report exact cascade
          // counts (rather than relying purely on the DB-level
          // ON DELETE CASCADE FK, which gives us no row count).
          const paymentsDeleted = await tx
            .delete(schema.payments)
            .where(eq(schema.payments.billId, billId))
            .returning({ id: schema.payments.id });
          const deleted = await tx
            .delete(schema.bills)
            .where(eq(schema.bills.id, billId))
            .returning({ id: schema.bills.id, billNumber: schema.bills.billNumber, title: schema.bills.title });
          return {
            deleted: deleted[0] ?? null,
            cascaded: { payments: paymentsDeleted.length },
          };
        }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, message: "Bill deleted (cascade applied to payments)" }, null, 2),
          }],
        };
      } catch (e) {
        // Log full driver error (includes SQL text + bound params) to the
        // server console so operators can debug, but never interpolate it
        // into the MCP response — see task #239.
        console.error("[mcp:delete_bill]", e);
        return buildWriteErrorResponse(e, 'bill', 'delete');
      }
    }
  );

  server.tool(
    "delete_project",
    "Delete a maintenance project (admin/manager only). Only projects attached to buildings inside MCP-scoped organizations can be deleted via MCP. Cascades in application code (inside a single transaction) to all dependent rows: project steps, project elements (junction to building elements), submission vendors, workflow tasks, project notifications, and element project updates. Evaluation suggestions that point at this project are not deleted; their projectId is null-ed out via the DB-level ON DELETE SET NULL FK. Returns a structured summary of how many rows were removed from each child table.",
    { role: roleParam, projectId: z.string().describe("Maintenance project ID to delete") },
    async ({ role, projectId }) => {
      const orgIds = await getMcpOrgIds();
      const [project] = await db
        .select()
        .from(schema.maintenanceProjects)
        .where(eq(schema.maintenanceProjects.id, projectId));
      let buildingOrgId: string | null | undefined = undefined;
      if (project) {
        const [building] = await db
          .select({ organizationId: schema.buildings.organizationId })
          .from(schema.buildings)
          .where(eq(schema.buildings.id, project.buildingId));
        buildingOrgId = building?.organizationId;
      }
      const auth = authorizeDeleteInMcpScope({
        role,
        entityKind: 'project',
        entityId: projectId,
        entity: { exists: !!project, organizationId: buildingOrgId },
        mcpOrgIds: orgIds,
      });
      if (!auth.ok) return auth.response;
      try {
        const result = await withRetryableDbCall(() => db.transaction(async (tx) => {
          // Explicitly delete each dependent table inside the same
          // transaction so the MCP response can report exact cascade
          // counts (rather than relying purely on the DB-level
          // ON DELETE CASCADE FK, which gives us no row count).
          const projectStepsDeleted = await tx
            .delete(schema.projectSteps)
            .where(eq(schema.projectSteps.projectId, projectId))
            .returning({ id: schema.projectSteps.id });
          const projectElementsDeleted = await tx
            .delete(schema.projectElements)
            .where(eq(schema.projectElements.projectId, projectId))
            .returning({ id: schema.projectElements.id });
          const submissionVendorsDeleted = await tx
            .delete(schema.submissionVendors)
            .where(eq(schema.submissionVendors.projectId, projectId))
            .returning({ id: schema.submissionVendors.id });
          const workflowTasksDeleted = await tx
            .delete(schema.workflowTasks)
            .where(eq(schema.workflowTasks.projectId, projectId))
            .returning({ id: schema.workflowTasks.id });
          const projectNotificationsDeleted = await tx
            .delete(schema.projectNotifications)
            .where(eq(schema.projectNotifications.projectId, projectId))
            .returning({ id: schema.projectNotifications.id });
          const elementProjectUpdatesDeleted = await tx
            .delete(schema.elementProjectUpdates)
            .where(eq(schema.elementProjectUpdates.projectId, projectId))
            .returning({ id: schema.elementProjectUpdates.id });
          // Evaluation suggestions that reference this project have
          // their projectId cleared (DB-level ON DELETE SET NULL handles
          // it, but we count it explicitly so the MCP response is
          // honest about what touched the surrounding data).
          const evaluationSuggestionsCleared = await tx
            .update(schema.evaluationSuggestions)
            .set({ projectId: null })
            .where(eq(schema.evaluationSuggestions.projectId, projectId))
            .returning({ id: schema.evaluationSuggestions.id });
          const deleted = await tx
            .delete(schema.maintenanceProjects)
            .where(eq(schema.maintenanceProjects.id, projectId))
            .returning({
              id: schema.maintenanceProjects.id,
              projectNumber: schema.maintenanceProjects.projectNumber,
              title: schema.maintenanceProjects.title,
            });
          return {
            deleted: deleted[0] ?? null,
            cascaded: {
              projectSteps: projectStepsDeleted.length,
              projectElements: projectElementsDeleted.length,
              submissionVendors: submissionVendorsDeleted.length,
              workflowTasks: workflowTasksDeleted.length,
              projectNotifications: projectNotificationsDeleted.length,
              elementProjectUpdates: elementProjectUpdatesDeleted.length,
            },
            evaluationSuggestionsCleared: evaluationSuggestionsCleared.length,
          };
        }));
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, message: "Project deleted (cascade applied to project steps, project elements, submission vendors, workflow tasks, project notifications, element project updates)" }, null, 2),
          }],
        };
      } catch (e) {
        // Log full driver error (includes SQL text + bound params) to the
        // server console so operators can debug, but never interpolate it
        // into the MCP response — see task #239.
        console.error("[mcp:delete_project]", e);
        return buildWriteErrorResponse(e, 'project', 'delete');
      }
    }
  );

  // ===========================================
  // MAINTENANCE PROJECT TOOLS (Task #302)
  // ===========================================
  //
  // Helper that loads a project, verifies it belongs to a building inside an
  // MCP-scoped organization, and returns either the loaded project + building
  // or a ready-to-return MCP error response. Used by every project tool below
  // so the scope check is identical everywhere.
  async function loadMcpScopedProject(projectId: string): Promise<
    | { ok: true; project: typeof schema.maintenanceProjects.$inferSelect; building: typeof schema.buildings.$inferSelect }
    | { ok: false; response: { content: Array<{ type: 'text'; text: string }> } }
  > {
    const orgIds = await getMcpOrgIds();
    const [project] = await db
      .select()
      .from(schema.maintenanceProjects)
      .where(eq(schema.maintenanceProjects.id, projectId));
    if (!project) {
      return { ok: false, response: { content: [{ type: 'text' as const, text: `Project not found: ${projectId}` }] } };
    }
    const [building] = await db
      .select()
      .from(schema.buildings)
      .where(eq(schema.buildings.id, project.buildingId));
    if (!building || !orgIds.includes(building.organizationId)) {
      return { ok: false, response: { content: [{ type: 'text' as const, text: 'Access denied: project is not attached to an MCP-scoped building' }] } };
    }
    return { ok: true, project, building };
  }

  server.tool(
    "list_projects",
    "List maintenance projects for a building (admin/manager/tenant). Optional status filter. Building must be inside an MCP-scoped organization. Returns id, projectNumber, title, status, priority, plannedStartDate, plannedEndDate, totalBudget for each project.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID"),
      status: z
        .enum(["planned", "submission", "pre_work", "in_progress", "post_work", "completed"])
        .optional()
        .describe("Filter by workflow status"),
    },
    async ({ role, buildingId, status }) => {
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const conditions = [eq(schema.maintenanceProjects.buildingId, buildingId)];
      if (status) conditions.push(eq(schema.maintenanceProjects.status, status));
      const projects = await db
        .select({
          id: schema.maintenanceProjects.id,
          projectNumber: schema.maintenanceProjects.projectNumber,
          title: schema.maintenanceProjects.title,
          status: schema.maintenanceProjects.status,
          priority: schema.maintenanceProjects.priority,
          type: schema.maintenanceProjects.type,
          plannedStartDate: schema.maintenanceProjects.plannedStartDate,
          plannedEndDate: schema.maintenanceProjects.plannedEndDate,
          totalBudget: schema.maintenanceProjects.totalBudget,
          actualCost: schema.maintenanceProjects.actualCost,
        })
        .from(schema.maintenanceProjects)
        .where(and(...conditions))
        .orderBy(desc(schema.maintenanceProjects.createdAt));
      return { content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }] };
    },
  );

  server.tool(
    "get_project",
    "Get full details of a maintenance project including current workflow state and a project-steps summary. Project's building must be inside an MCP-scoped organization.",
    { role: roleParam, projectId: z.string().describe("Maintenance project ID") },
    async ({ role, projectId }) => {
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      let workflowState: unknown = null;
      try {
        workflowState = await workflowService.getProjectWorkflowState(projectId);
      } catch (e) {
        console.error("[mcp:get_project] workflow state error", e);
      }
      const steps = await db
        .select({
          id: schema.projectSteps.id,
          stepType: schema.projectSteps.stepType,
          status: schema.projectSteps.status,
          isRequired: schema.projectSteps.isRequired,
          startedAt: schema.projectSteps.startedAt,
          completedAt: schema.projectSteps.completedAt,
        })
        .from(schema.projectSteps)
        .where(eq(schema.projectSteps.projectId, projectId));
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ project: scope.project, workflowState, steps }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "create_project",
    "Create a new maintenance project for a building (admin/manager only). Auto-generates a project number. Building must be inside an MCP-scoped organization. Optional fields: priority (defaults to medium), totalBudget, plannedStartDate, plannedEndDate (YYYY-MM-DD). Returns the created project row.",
    {
      role: roleParam,
      buildingId: z.string().describe("Building ID (must be MCP-scoped)"),
      title: z.string().min(1).max(200).describe("Project title"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Priority (defaults to medium)"),
      totalBudget: z.number().positive().optional().describe("Total project budget"),
      plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Planned start date"),
      plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Planned end date"),
    },
    async ({ role, buildingId, title, priority, totalBudget, plannedStartDate, plannedEndDate }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot create projects" }] };
      }
      const orgIds = await getMcpOrgIds();
      const [building] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, buildingId));
      if (!building || !orgIds.includes(building.organizationId)) {
        return { content: [{ type: "text" as const, text: "Building not found or access denied" }] };
      }
      const user = await getMcpUser(role);
      if (!user) {
        return { content: [{ type: "text" as const, text: "MCP user account not found" }] };
      }
      try {
        const [project] = await withRetryableDbCall(() => db
          .insert(schema.maintenanceProjects)
          .values({
            buildingId,
            projectNumber: `MCP-PROJ-${Date.now()}-${randomBytes(2).toString("hex")}`,
            title,
            type: "not_sure",
            status: "planned",
            priority: priority ?? "medium",
            ...(totalBudget !== undefined && { totalBudget: String(totalBudget) }),
            ...(plannedStartDate !== undefined && { plannedStartDate }),
            ...(plannedEndDate !== undefined && { plannedEndDate }),
            createdBy: user.id,
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
      } catch (e) {
        console.error("[mcp:create_project]", e);
        return buildWriteErrorResponse(e, 'project', 'create');
      }
    },
  );

  server.tool(
    "update_project",
    "Update a maintenance project's metadata (admin/manager only): title, priority, totalBudget, plannedStartDate, plannedEndDate. Project's building must be inside an MCP-scoped organization. To advance workflow stage, use advance_project_status instead.",
    {
      role: roleParam,
      projectId: z.string().describe("Maintenance project ID"),
      title: z.string().min(1).max(200).optional().describe("New title"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("New priority"),
      totalBudget: z.number().positive().optional().describe("New total budget"),
      plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("New planned start date"),
      plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("New planned end date"),
    },
    async ({ role, projectId, title, priority, totalBudget, plannedStartDate, plannedEndDate }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update projects" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title;
      if (priority !== undefined) updateData.priority = priority;
      if (totalBudget !== undefined) updateData.totalBudget = String(totalBudget);
      if (plannedStartDate !== undefined) updateData.plannedStartDate = plannedStartDate;
      if (plannedEndDate !== undefined) updateData.plannedEndDate = plannedEndDate;
      if (Object.keys(updateData).length === 1) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.maintenanceProjects)
          .set(updateData)
          .where(eq(schema.maintenanceProjects.id, projectId))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_project]", e);
        return buildWriteErrorResponse(e, 'project', 'update');
      }
    },
  );

  server.tool(
    "advance_project_status",
    "Advance a project to its next workflow stage (admin/manager only). Mirrors POST /api/maintenance/projects/:id/advance-status: looks up nextStatus via workflowService.getProjectWorkflowState (honours skip flags), then updates the project with the matching phase timestamp. When the current status is 'completed', the call is rejected. Project's building must be inside an MCP-scoped organization.",
    { role: roleParam, projectId: z.string().describe("Maintenance project ID") },
    async ({ role, projectId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot advance project status" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      const currentStatus = scope.project.status as
        | "planned" | "submission" | "pre_work" | "in_progress" | "post_work" | "completed";
      if (currentStatus === "completed") {
        return { content: [{ type: "text" as const, text: "Project is already completed and cannot advance further" }] };
      }
      let workflowState;
      try {
        workflowState = await workflowService.getProjectWorkflowState(projectId);
      } catch (e) {
        console.error("[mcp:advance_project_status] workflow lookup", e);
        return buildWriteErrorResponse(e, 'project', 'update');
      }
      if (!workflowState || !workflowState.canProgress || !workflowState.nextStatus) {
        return { content: [{ type: "text" as const, text: "Cannot advance from current status (project may need linked elements, may be a Quick Project, or may already be complete)" }] };
      }
      const nextStatus = workflowState.nextStatus;
      const today = new Date().toISOString().split('T')[0];
      // Mirrors the per-transition timestamp writes in
      // POST /api/maintenance/projects/:id/advance-status. Only writes columns
      // that actually exist on the maintenanceProjects table. The REST handler
      // also references `submissionDate`, `preWorkStartDate`, and `workEndDate`,
      // none of which exist in shared/schemas/maintenance.ts, so they are
      // silently dropped by Drizzle there and are intentionally not included
      // here either; runtime behaviour is identical.
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.maintenanceProjects)
          .set({
            status: nextStatus,
            updatedAt: new Date(),
            ...(nextStatus === "in_progress" && { actualStartDate: today }),
            ...(nextStatus === "completed" && { actualEndDate: today }),
          })
          .where(eq(schema.maintenanceProjects.id, projectId))
          .returning());
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              previousStatus: currentStatus,
              newStatus: nextStatus,
              project: updated,
            }, null, 2),
          }],
        };
      } catch (e) {
        console.error("[mcp:advance_project_status]", e);
        return buildWriteErrorResponse(e, 'project', 'update');
      }
    },
  );

  server.tool(
    "list_allowed_reopen_targets",
    "List the previous workflow statuses a project can be reopened/reverted to (admin/manager only). Mirrors GET /api/maintenance/projects/:id/reopen-targets by surfacing workflowService.getAllowedReopenTargets, returning each previously-completed or skipped status that precedes the current one. Project's building must be inside an MCP-scoped organization. Use the returned values as the targetStatus argument to reopen_project_status.",
    { role: roleParam, projectId: z.string().describe("Maintenance project ID") },
    async ({ role, projectId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot view reopen targets" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      try {
        const allowedTargets = await workflowService.getAllowedReopenTargets(projectId);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              currentStatus: scope.project.status,
              allowedTargets,
            }, null, 2),
          }],
        };
      } catch (e) {
        console.error("[mcp:list_allowed_reopen_targets]", e);
        return buildWriteErrorResponse(e, 'project', 'update');
      }
    },
  );

  server.tool(
    "reopen_project_status",
    "Reopen/revert a project to a previous workflow stage (admin/manager only). Mirrors POST /api/maintenance/projects/:id/reopen-step: validates targetStatus against workflowService.getAllowedReopenTargets, resets downstream phase artifacts and date columns, and recalculates actualCost from the remaining completed phases. targetStatus must be one of the previously-completed or skipped statuses returned by list_allowed_reopen_targets. Project's building must be inside an MCP-scoped organization.",
    {
      role: roleParam,
      projectId: z.string().describe("Maintenance project ID"),
      targetStatus: z
        .enum(["planned", "submission", "pre_work", "in_progress", "post_work", "completed"])
        .describe("Previous workflow status to revert to. Must appear in list_allowed_reopen_targets."),
      reason: z.string().optional().describe("Optional reason logged with the reopen action"),
    },
    async ({ role, projectId, targetStatus, reason }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot reopen project status" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      const previousStatus = scope.project.status;
      try {
        const workflowState = await workflowService.reopenToPhase(projectId, targetStatus, reason);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              previousStatus,
              newStatus: targetStatus,
              workflowState,
            }, null, 2),
          }],
        };
      } catch (e) {
        console.error("[mcp:reopen_project_status]", e);
        return buildWriteErrorResponse(e, 'project', 'update');
      }
    },
  );

  server.tool(
    "add_project_task",
    "Add a custom workflow task to a project phase (admin/manager only). Phase must be one of pre_work, in_progress, post_work. If orderIndex is omitted, the task is appended to the end of the phase. Project's building must be inside an MCP-scoped organization.",
    {
      role: roleParam,
      projectId: z.string().describe("Maintenance project ID"),
      phase: z.enum(["pre_work", "in_progress", "post_work"]).describe("Workflow phase"),
      taskName: z.string().min(1).max(255).describe("Task name"),
      description: z.string().optional().describe("Task description"),
      cost: z.number().positive().optional().describe("Task cost"),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Due date"),
      orderIndex: z.number().int().min(0).optional().describe("Order within the phase (defaults to end)"),
    },
    async ({ role, projectId, phase, taskName, description, cost, dueDate, orderIndex }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot add project tasks" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      try {
        let resolvedOrderIndex = orderIndex;
        if (resolvedOrderIndex === undefined) {
          const [{ value: maxOrder } = { value: null }] = await db
            .select({ value: sql<number | null>`max(${schema.workflowTasks.orderIndex})` })
            .from(schema.workflowTasks)
            .where(and(eq(schema.workflowTasks.projectId, projectId), eq(schema.workflowTasks.phase, phase)));
          resolvedOrderIndex = (maxOrder ?? -1) + 1;
        }
        const [task] = await withRetryableDbCall(() => db
          .insert(schema.workflowTasks)
          .values({
            projectId,
            phase,
            taskName,
            ...(description !== undefined && { description }),
            ...(cost !== undefined && { cost: String(cost) }),
            ...(dueDate !== undefined && { dueDate }),
            orderIndex: resolvedOrderIndex,
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (e) {
        console.error("[mcp:add_project_task]", e);
        return buildWriteErrorResponse(e, 'project task', 'create');
      }
    },
  );

  server.tool(
    "update_project_task",
    "Update or complete a project workflow task (admin/manager only). Update taskName, description, cost, dueDate, or mark isCompleted. Task's project building must be inside an MCP-scoped organization.",
    {
      role: roleParam,
      taskId: z.string().describe("Workflow task ID"),
      taskName: z.string().min(1).max(255).optional().describe("New task name"),
      description: z.string().optional().describe("New description"),
      cost: z.number().positive().optional().describe("New cost"),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("New due date"),
      isCompleted: z.boolean().optional().describe("Mark task complete or incomplete"),
    },
    async ({ role, taskId, taskName, description, cost, dueDate, isCompleted }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot update project tasks" }] };
      }
      const [task] = await db
        .select({ id: schema.workflowTasks.id, projectId: schema.workflowTasks.projectId })
        .from(schema.workflowTasks)
        .where(eq(schema.workflowTasks.id, taskId));
      if (!task) {
        return { content: [{ type: "text" as const, text: `Task not found: ${taskId}` }] };
      }
      const scope = await loadMcpScopedProject(task.projectId);
      if (!scope.ok) return scope.response;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (taskName !== undefined) updateData.taskName = taskName;
      if (description !== undefined) updateData.description = description;
      if (cost !== undefined) updateData.cost = String(cost);
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
      if (Object.keys(updateData).length === 1) {
        return { content: [{ type: "text" as const, text: "No fields to update" }] };
      }
      try {
        const [updated] = await withRetryableDbCall(() => db
          .update(schema.workflowTasks)
          .set(updateData)
          .where(eq(schema.workflowTasks.id, taskId))
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
      } catch (e) {
        console.error("[mcp:update_project_task]", e);
        return buildWriteErrorResponse(e, 'project task', 'update');
      }
    },
  );

  server.tool(
    "assign_project_vendor",
    "Attach a vendor submission (quote) to a project (admin/manager only). Mirrors POST /api/maintenance/projects/:id/vendors. Project's building must be inside an MCP-scoped organization.",
    {
      role: roleParam,
      projectId: z.string().describe("Maintenance project ID"),
      vendorName: z.string().min(1).max(255).describe("Vendor name"),
      projectType: z
        .enum(["repair", "minor_rehab", "major_rehab", "replacement", "not_sure"])
        .describe("Project type the quote is for"),
      price: z.number().min(0).optional().describe("Quoted price"),
      addedLifespan: z.number().int().positive().optional().describe("Years of added lifespan (rehab only)"),
      availableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("Vendor availability date"),
      contactInfo: z.string().optional().describe("Vendor contact info"),
      notes: z.string().optional().describe("Submission notes"),
      preferred: z.boolean().optional().describe("Mark this submission as preferred"),
    },
    async ({ role, projectId, vendorName, projectType, price, addedLifespan, availableDate, contactInfo, notes, preferred }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot assign vendors to projects" }] };
      }
      const scope = await loadMcpScopedProject(projectId);
      if (!scope.ok) return scope.response;
      try {
        const [submission] = await withRetryableDbCall(() => db
          .insert(schema.submissionVendors)
          .values({
            projectId,
            vendorName,
            projectType,
            ...(price !== undefined && { price: String(price) }),
            ...(addedLifespan !== undefined && { addedLifespan }),
            ...(availableDate !== undefined && { availableDate }),
            ...(contactInfo !== undefined && { contactInfo }),
            ...(notes !== undefined && { notes }),
            ...(preferred !== undefined && { preferred }),
          })
          .returning());
        return { content: [{ type: "text" as const, text: JSON.stringify(submission, null, 2) }] };
      } catch (e) {
        console.error("[mcp:assign_project_vendor]", e);
        return buildWriteErrorResponse(e, 'project vendor submission', 'create');
      }
    },
  );

  server.tool(
    "invite_user",
    "Invite a new user to an MCP-scoped organization by email (admin/manager only). Creates an invitation record and sends the standard invitation email — same flow as POST /api/invitations. Admins may invite any role; managers may only invite manager, tenant, or resident.",
    {
      role: roleParam,
      organizationId: z.string().describe("Organization ID (must be MCP-scoped)"),
      email: z.string().email().describe("Invitee email address"),
      invitedRole: z
        .enum(["admin", "manager", "tenant", "resident"])
        .describe("Role to assign the invited user once they accept"),
      firstName: z.string().optional().describe("Invitee first name (for personalization)"),
      lastName: z.string().optional().describe("Invitee last name (for personalization)"),
      residenceId: z
        .string()
        .optional()
        .describe("Optional residence ID to associate the invitation with"),
      personalMessage: z
        .string()
        .optional()
        .describe("Optional personal message included with the invitation email"),
      expiresInDays: z
        .number()
        .int()
        .positive()
        .max(90)
        .optional()
        .describe("Days until the invitation expires (default 7, max 90)"),
    },
    async ({
      role,
      organizationId,
      email,
      invitedRole,
      firstName,
      lastName,
      residenceId,
      personalMessage,
      expiresInDays,
    }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot invite users" }] };
      }
      if (role === "manager" && !["manager", "tenant", "resident"].includes(invitedRole)) {
        return {
          content: [{
            type: "text" as const,
            text: "Access denied: managers can only invite manager, tenant, or resident roles",
          }],
        };
      }
      try {
        const orgIds = await getMcpOrgIds();
        if (!orgIds.includes(organizationId)) {
          return { content: [{ type: "text" as const, text: "Access denied: organization not in MCP scope" }] };
        }
        const inviter = await getMcpUser(role);
        if (!inviter) {
          return { content: [{ type: "text" as const, text: "MCP user not found" }] };
        }

        const [existingUser] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.email, email))
          .limit(1);
        if (existingUser) {
          return { content: [{ type: "text" as const, text: "User with this email already exists" }] };
        }

      // Soft-replace any existing pending invitations for the same
      // (organization, email, residence) tuple so the caller always gets a
      // fresh token while preserving the prior invitation row + audit trail.
      // Shared with the REST POST /api/invitations endpoint via
      // createInvitationWithSoftReplace so the two paths cannot drift.
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + (expiresInDays ?? 7) * 24 * 60 * 60 * 1000);

      const { invitation } = await withRetryableDbCall(() => createInvitationWithSoftReplace({
        organizationId,
        // Match the REST path: treat empty / whitespace-only residenceId
        // as null so MCP and REST land on the exact same dedup tuple.
        // The helper itself also normalizes defensively, but normalizing
        // here keeps the logged tuple and the inserted row consistent
        // with the REST endpoint's wire shape.
        residenceId: residenceId && residenceId.trim().length > 0 ? residenceId.trim() : null,
        email,
        role: invitedRole,
        token,
        tokenHash,
        expiresAt,
        personalMessage: personalMessage ?? null,
        invitedByUserId: inviter.id,
        audit: { source: "mcp", tool: "invite_user" },
        logError: (msg, err) => console.error(`[mcp:invite_user] ${msg}`, err),
      }));
      const normalizedResidenceId = invitation.residenceId;

      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);
      const [inviterFull] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, inviter.id))
        .limit(1);

      const inviterName = inviterFull
        ? `${inviterFull.firstName || inviterFull.email} ${inviterFull.lastName || ""}`.trim()
        : "Koveo Manager";
      // Use the invitee's provided name as the email greeting recipient when
      // available, falling back to the email address.
      const recipientName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || email;
      // Mirrors the REST endpoint's URL precedence: prefer a custom (non
      // .replit.app) REPLIT_DOMAINS entry, then APP_URL, then localhost.
      const replitDomains = (process.env.REPLIT_DOMAINS || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const customDomain = replitDomains.find((d) => !d.includes(".replit.app"));
      const replitDomain = customDomain || replitDomains[0];
      const baseUrl = replitDomain
        ? `https://${replitDomain}`
        : process.env.APP_URL || "http://localhost:5000";
      const invitationUrl = `${baseUrl}/accept-invitation?token=${token}`;

      let emailSent = false;
      let emailError: string | undefined;
      try {
        emailSent = await emailService.sendInvitationEmail(
          email,
          inviterName,
          invitationUrl,
          organization?.name || "Koveo Gestion",
          "fr",
        );
        if (!emailSent) {
          emailError = "Email service returned false (likely SENDGRID_API_KEY not configured)";
        }
      } catch (err) {
        // Never surface raw SendGrid/SMTP error text — it can include API
        // keys, request IDs, or recipient emails in `.message`. Operators
        // get the full error in the server console.
        console.error("[mcp:invite_user] failed to send invitation email", err);
        emailSent = false;
        emailError = SANITIZED_EMAIL_ERROR;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: invitation.id,
            email: invitation.email,
            recipientName,
            role: invitation.role,
            organizationId: invitation.organizationId,
            residenceId: invitation.residenceId,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            emailSent,
            ...(emailError ? { emailError } : {}),
          }, null, 2),
        }],
      };
      } catch (err) {
        // Log the full error (message, stack, driver fields) server-side so
        // operators can debug, but never interpolate err.message into the
        // MCP response — postgres/Drizzle driver errors include the failing
        // SQL text and bound parameter values (table/column names, the
        // invitee email, etc.) which would leak schema details to the
        // calling client. See task #214.
        console.error("[mcp:invite_user] failed to create invitation", err);
        if (err instanceof InvitationAlreadyPendingError) {
          // Task #250 — duplicate invites are now an explicit conflict.
          // Return a structured "already-invited" outcome so the calling
          // assistant can branch on `status` instead of string-matching the
          // error text, and direct the user to the correct follow-up tool
          // (`resend_invitation` to extend expiry, or `cancel_invitation`
          // to start over). Still a non-throw, non-leaky response so the
          // MCP SDK does not surface driver details.
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "already_invited",
                code: "INVITATION_ALREADY_PENDING",
                message: err.message,
              }, null, 2),
            }],
          };
        }
        return buildWriteErrorResponse(err, 'invitation', 'create');
      }
    },
  );

  server.tool(
    "list_pending_invitations",
    "List pending invitations within an MCP-scoped organization (admin/manager only). Tenants are denied. Admins see every pending invitation in the org; managers see only invitations they themselves sent. `organizationId` (must be in MCP scope) is REQUIRED — call list_organizations first to discover ids, then call this tool once per org. Optional `email` (case-insensitive exact match) further narrows results. Pagination is controlled by optional `limit` (default 25, max 100) and `offset` (default 0) parameters. The response is `{ items, total, limit, offset, hasMore }`, where each item includes the invitation id, email, role, status, expiresAt, createdAt, organizationId, buildingId, residenceId, invitedByUserId, plus the human-readable organizationName, buildingName, residenceUnitNumber, and invitedByName joined in — enough for the assistant to immediately render results and follow up with resend_invitation or cancel_invitation without extra lookups.",
    // Task #260: organizationId is REQUIRED so callers cannot accidentally
    // page across every MCP-scoped org's invitations in a single call.
    {
      role: roleParam,
      organizationId: z
        .string()
        .describe("MCP-scoped organization ID to list pending invitations from (required)"),
      email: z
        .string()
        .optional()
        .describe("Optional invitee email to filter by (case-insensitive exact match)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Page size (default 25, max 100)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of rows to skip from the start of the ordered result set (default 0)"),
    },
    async ({ role, organizationId, email, limit, offset }) => {
      const pageLimit = Math.min(Math.max(limit ?? 25, 1), 100);
      const pageOffset = Math.max(offset ?? 0, 0);
      const emptyPage = {
        items: [] as unknown[],
        total: 0,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: false,
      };
      if (role === "tenant") {
        return {
          content: [{
            type: "text" as const,
            text: "Access denied: tenants cannot list invitations",
          }],
        };
      }

      const orgIds = await getMcpOrgIds();
      if (orgIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(emptyPage, null, 2) }] };
      }

      // Task #260: organizationId is required at the schema level. We still
      // verify it sits inside MCP scope before honouring it.
      if (!orgIds.includes(organizationId)) {
        return {
          content: [{
            type: "text" as const,
            text: "Access denied: organization is not in MCP scope",
          }],
        };
      }
      const scopedOrgIds: string[] = [organizationId];

      const caller = await getMcpUser(role);
      if (!caller) {
        return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      }

      // Mirror the role rules used by resend/cancel_invitation:
      //   - admin: every pending invitation in MCP scope
      //   - manager: only invitations they themselves sent (within MCP scope)
      const conditions = [
        eq(schema.invitations.status, "pending"),
        inArray(schema.invitations.organizationId, scopedOrgIds),
      ];
      if (role === "manager") {
        conditions.push(eq(schema.invitations.invitedByUserId, caller.id));
      }
      if (email) {
        conditions.push(sql`lower(${schema.invitations.email}) = lower(${email})`);
      }

      // Total count (for pagination metadata) — runs against the same WHERE
      // tree so it stays in sync with role/org/email filters above.
      const totalRows = await db
        .select({ value: count() })
        .from(schema.invitations)
        .where(and(...conditions));
      const total = Number(totalRows[0]?.value ?? 0);

      const items = await db
        .select({
          id: schema.invitations.id,
          email: schema.invitations.email,
          role: schema.invitations.role,
          status: schema.invitations.status,
          expiresAt: schema.invitations.expiresAt,
          createdAt: schema.invitations.createdAt,
          organizationId: schema.invitations.organizationId,
          buildingId: schema.invitations.buildingId,
          residenceId: schema.invitations.residenceId,
          invitedByUserId: schema.invitations.invitedByUserId,
          organizationName: schema.organizations.name,
          buildingName: sql<string>`buildings.name`,
          residenceUnitNumber: sql<string>`residences.unit_number`,
          invitedByName: sql<string>`CONCAT(users.first_name, ' ', users.last_name)`,
        })
        .from(schema.invitations)
        .leftJoin(
          schema.organizations,
          eq(schema.invitations.organizationId, schema.organizations.id)
        )
        .leftJoin(sql`buildings`, sql`invitations.building_id = buildings.id`)
        .leftJoin(sql`residences`, sql`invitations.residence_id = residences.id`)
        .leftJoin(schema.users, eq(schema.invitations.invitedByUserId, schema.users.id))
        .where(and(...conditions))
        .orderBy(desc(schema.invitations.createdAt))
        .limit(pageLimit)
        .offset(pageOffset);

      const page = {
        items,
        total,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + items.length < total,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(page, null, 2) }],
      };
    },
  );

  server.tool(
    "resend_invitation",
    "Resend a pending invitation email by invitation ID (admin/manager only). Validates the invitation belongs to an MCP-scoped organization, extends its expiry by 7 days, and re-triggers the standard invitation email — same flow as POST /api/invitations/:id/resend. Tenants are denied; managers may only resend invitations they originally sent; admins may resend any invitation in MCP scope.",
    {
      role: roleParam,
      invitationId: z.string().describe("Invitation ID to resend"),
    },
    async ({ role, invitationId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot resend invitations" }] };
      }
      const [invitation] = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, invitationId))
        .limit(1);
      if (!invitation) {
        return { content: [{ type: "text" as const, text: `Invitation not found: ${invitationId}` }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!invitation.organizationId || !orgIds.includes(invitation.organizationId)) {
        return {
          content: [{ type: "text" as const, text: "Access denied: invitation is not in an MCP-scoped organization" }],
        };
      }
      const caller = await getMcpUser(role);
      if (!caller) {
        return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      }
      if (role === "manager" && invitation.invitedByUserId !== caller.id) {
        return {
          content: [{ type: "text" as const, text: "Access denied: managers can only resend invitations they sent" }],
        };
      }

      // Reject resend for terminal/replaced states so a soft-replaced
      // invitation cannot be silently resurrected.
      if (
        invitation.status === "replaced" ||
        invitation.status === "accepted" ||
        invitation.status === "cancelled"
      ) {
        return {
          content: [{
            type: "text" as const,
            text: `Cannot resend invitation: status is "${invitation.status}"`,
          }],
        };
      }

      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      try {
        await withRetryableDbCall(() => db
          .update(schema.invitations)
          .set({ expiresAt: newExpiresAt, status: "pending", updatedAt: new Date() })
          .where(eq(schema.invitations.id, invitationId)));
      } catch (e) {
        console.error("[mcp:resend_invitation] failed to update invitation", e);
        return buildWriteErrorResponse(e, 'invitation', 'update');
      }

      // Audit trail: mirror the REST resend lifecycle write so chat-driven
      // resends show up in invitation_audit_log alongside REST resends.
      // Failure to write must NOT mask the successful resend.
      try {
        await withRetryableDbCall(() =>
          db.insert(schema.invitationAuditLog).values({
            invitationId,
            action: "resent",
            performedBy: caller.id,
            previousStatus: invitation.status,
            newStatus: "pending",
            details: {
              source: "mcp",
              tool: "resend_invitation",
              callerRole: role,
              newExpiresAt: newExpiresAt.toISOString(),
            },
          })
        );
      } catch (auditErr) {
        console.error("[mcp:resend_invitation] failed to write invitation_audit_log entry", auditErr);
      }

      const [organization] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, invitation.organizationId))
        .limit(1);
      const [callerFull] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, caller.id))
        .limit(1);

      const inviterName = callerFull
        ? `${callerFull.firstName || callerFull.email} ${callerFull.lastName || ""}`.trim()
        : "Koveo Manager";
      const replitDomains = (process.env.REPLIT_DOMAINS || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const customDomain = replitDomains.find((d) => !d.includes(".replit.app"));
      const replitDomain = customDomain || replitDomains[0];
      const baseUrl = replitDomain
        ? `https://${replitDomain}`
        : process.env.APP_URL || "http://localhost:5000";
      const invitationUrl = `${baseUrl}/accept-invitation?token=${invitation.token}`;

      let emailSent = false;
      let emailError: string | undefined;
      try {
        emailSent = await emailService.sendInvitationEmail(
          invitation.email,
          inviterName,
          invitationUrl,
          organization?.name || "Koveo Gestion",
          "fr",
        );
        if (!emailSent) {
          emailError = "Email service returned false (likely SENDGRID_API_KEY not configured)";
        }
      } catch (err) {
        // Never surface raw SendGrid/SMTP error text — it can include API
        // keys, request IDs, or recipient emails in `.message`. Operators
        // get the full error in the server console.
        console.error("[mcp:resend_invitation] failed to send invitation email", err);
        emailSent = false;
        emailError = SANITIZED_EMAIL_ERROR;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            organizationId: invitation.organizationId,
            residenceId: invitation.residenceId,
            status: "pending",
            expiresAt: newExpiresAt,
            emailSent,
            ...(emailError ? { emailError } : {}),
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "cancel_invitation",
    "Cancel a pending invitation in an MCP-scoped organization (admin/manager only). Marks the invitation status as 'cancelled'. Admins may cancel any pending invitation in MCP-scoped organizations; managers may only cancel invitations they themselves sent. Tenants are denied. Returns an error if the invitation is not pending.",
    {
      role: roleParam,
      invitationId: z.string().describe("Invitation ID to cancel"),
    },
    async ({ role, invitationId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied: tenants cannot cancel invitations" }] };
      }
      const [invitation] = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.id, invitationId))
        .limit(1);
      if (!invitation) {
        return { content: [{ type: "text" as const, text: `Invitation not found: ${invitationId}` }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!invitation.organizationId || !orgIds.includes(invitation.organizationId)) {
        return { content: [{ type: "text" as const, text: "Access denied: invitation is not in an MCP-scoped organization" }] };
      }
      if (invitation.status !== "pending") {
        return {
          content: [{
            type: "text" as const,
            text: `Cannot cancel invitation: status is "${invitation.status}", only pending invitations can be cancelled`,
          }],
        };
      }
      const caller = await getMcpUser(role);
      if (!caller) {
        return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      }
      // Managers may only cancel invitations they themselves sent. Admins
      // can cancel any pending invitation within MCP scope.
      if (role === "manager" && invitation.invitedByUserId !== caller.id) {
        return {
          content: [{
            type: "text" as const,
            text: "Access denied: managers can only cancel invitations they sent",
          }],
        };
      }
      const previousStatus = invitation.status;
      let updated: typeof schema.invitations.$inferSelect;
      try {
        [updated] = await withRetryableDbCall(() => db
          .update(schema.invitations)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.invitations.id, invitationId))
          .returning());
      } catch (e) {
        console.error("[mcp:cancel_invitation] failed to update invitation", e);
        return buildWriteErrorResponse(e, 'invitation', 'update');
      }

      // Audit trail: record who cancelled this invitation and when. Other
      // invitation lifecycle events (security alerts in
      // server/auth/invitation-rbac.ts) write to the same table; we keep
      // MCP cancellations consistent so admins reviewing the audit log
      // can see chat-initiated revocations alongside everything else.
      // Failure to write the audit row should NOT mask the successful
      // cancellation, so we log-and-swallow.
      try {
        await withRetryableDbCall(() =>
          db.insert(schema.invitationAuditLog).values({
            invitationId: updated.id,
            action: "cancelled",
            performedBy: caller.id,
            previousStatus,
            newStatus: "cancelled",
            details: { source: "mcp", tool: "cancel_invitation", callerRole: role },
          })
        );
      } catch (auditErr) {
        console.error(
          "[mcp:cancel_invitation] failed to write invitation_audit_log entry",
          auditErr,
        );
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: updated.id,
            email: updated.email,
            role: updated.role,
            organizationId: updated.organizationId,
            status: updated.status,
            cancelledBy: caller.id,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "get_invitation_history",
    "Read the invitation_audit_log to see who acted on which invitation, when, from where (REST vs MCP), and the status transition (admin/manager only; tenants are denied). Admins see every audit entry whose invitation belongs to an MCP-scoped organization; managers only see entries for invitations they themselves originally sent. Optional filters: `invitationId`, `performedByUserId`, `since` / `until` (ISO 8601 timestamps). Pagination via `limit` (default 25, max 100) and `offset` (default 0). Each row is enriched with the invitation email, invitation organizationId/organizationName, and the performer's name/email so the assistant can render the history without follow-up lookups.",
    {
      role: roleParam,
      invitationId: z.string().optional().describe("Optional invitation ID to filter by"),
      performedByUserId: z
        .string()
        .optional()
        .describe("Optional performer user ID to filter by"),
      since: z
        .string()
        .optional()
        .describe("Optional ISO 8601 timestamp lower bound (inclusive) on createdAt"),
      until: z
        .string()
        .optional()
        .describe("Optional ISO 8601 timestamp upper bound (inclusive) on createdAt"),
      limit: z.number().int().min(1).max(100).optional().describe("Page size (default 25, max 100)"),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of rows to skip from the start (default 0)"),
    },
    async ({ role, invitationId, performedByUserId, since, until, limit, offset }) => {
      const pageLimit = Math.min(Math.max(limit ?? 25, 1), 100);
      const pageOffset = Math.max(offset ?? 0, 0);
      const emptyPage = {
        items: [] as unknown[],
        total: 0,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: false,
      };

      if (role === "tenant") {
        return {
          content: [{
            type: "text" as const,
            text: "Access denied: tenants cannot read invitation history",
          }],
        };
      }

      const orgIds = await getMcpOrgIds();
      if (orgIds.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify(emptyPage, null, 2) }] };
      }

      const caller = await getMcpUser(role);
      if (!caller) {
        return { content: [{ type: "text" as const, text: "MCP user not found" }] };
      }

      // Audit rows are anchored by their parent invitation. Scope them to the
      // same MCP-scoped invitations the rest of the invitation tools see, and
      // for managers narrow further to invitations they themselves sent.
      const conditions: SQL[] = [
        inArray(schema.invitations.organizationId, orgIds),
      ];
      if (role === "manager") {
        conditions.push(eq(schema.invitations.invitedByUserId, caller.id));
      }
      if (invitationId) {
        conditions.push(eq(schema.invitationAuditLog.invitationId, invitationId));
      }
      if (performedByUserId) {
        conditions.push(eq(schema.invitationAuditLog.performedBy, performedByUserId));
      }
      if (since) {
        const sinceDate = new Date(since);
        if (Number.isNaN(sinceDate.getTime())) {
          return {
            content: [{ type: "text" as const, text: `Invalid 'since' timestamp: ${since}` }],
          };
        }
        conditions.push(sql`${schema.invitationAuditLog.createdAt} >= ${sinceDate}`);
      }
      if (until) {
        const untilDate = new Date(until);
        if (Number.isNaN(untilDate.getTime())) {
          return {
            content: [{ type: "text" as const, text: `Invalid 'until' timestamp: ${until}` }],
          };
        }
        conditions.push(sql`${schema.invitationAuditLog.createdAt} <= ${untilDate}`);
      }

      // Total count (matches the same WHERE/JOIN tree used for the page).
      const totalRows = await db
        .select({ value: count() })
        .from(schema.invitationAuditLog)
        .leftJoin(
          schema.invitations,
          eq(schema.invitationAuditLog.invitationId, schema.invitations.id)
        )
        .where(and(...conditions));
      const total = Number(totalRows[0]?.value ?? 0);

      const items = await db
        .select({
          id: schema.invitationAuditLog.id,
          invitationId: schema.invitationAuditLog.invitationId,
          action: schema.invitationAuditLog.action,
          previousStatus: schema.invitationAuditLog.previousStatus,
          newStatus: schema.invitationAuditLog.newStatus,
          performedBy: schema.invitationAuditLog.performedBy,
          ipAddress: schema.invitationAuditLog.ipAddress,
          details: schema.invitationAuditLog.details,
          createdAt: schema.invitationAuditLog.createdAt,
          invitationEmail: schema.invitations.email,
          organizationId: schema.invitations.organizationId,
          organizationName: schema.organizations.name,
          performedByName: sql<string>`CONCAT(users.first_name, ' ', users.last_name)`,
          performedByEmail: schema.users.email,
        })
        .from(schema.invitationAuditLog)
        .leftJoin(
          schema.invitations,
          eq(schema.invitationAuditLog.invitationId, schema.invitations.id)
        )
        .leftJoin(
          schema.organizations,
          eq(schema.invitations.organizationId, schema.organizations.id)
        )
        .leftJoin(schema.users, eq(schema.invitationAuditLog.performedBy, schema.users.id))
        .where(and(...conditions))
        .orderBy(desc(schema.invitationAuditLog.createdAt))
        .limit(pageLimit)
        .offset(pageOffset);

      const page = {
        items,
        total,
        limit: pageLimit,
        offset: pageOffset,
        hasMore: pageOffset + items.length < total,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(page, null, 2) }],
      };
    },
  );

  server.tool(
    "get_analysis_status",
    "Check the status of a document analysis. Currently all analyses are synchronous so this always returns 'completed'. Provided for forward compatibility with future async analysis.",
    {
      role: roleParam,
      analysisId: z.string().describe("Analysis ID or document storage path"),
    },
    async ({ role, analysisId }) => {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            analysisId,
            status: "completed",
            message: "All document analyses are currently processed synchronously and complete immediately.",
          }, null, 2),
        }],
      };
    }
  );

  registerBudgetTools(server, { roleParam, getMcpUser, getMcpOrgIds });
  registerBulkImportTools(server, { roleParam, getMcpUser, getMcpOrgIds });

  // ===========================================================================
  // Document Tags
  // ===========================================================================
  server.tool(
    "list_document_tags",
    "List document tags available to the caller (system Koveo tags + tags from caller's organizations)",
    { role: roleParam },
    async () => {
      const orgIds = await getMcpOrgIds();
      const rows = await db
        .select()
        .from(schema.documentTags)
        .where(
          or(
            eq(schema.documentTags.isSystem, true),
            orgIds.length > 0 ? inArray(schema.documentTags.organizationId, orgIds) : sql`false`,
          ),
        );
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    "create_document_tag",
    "Create a custom document tag for an organization (manager/admin)",
    {
      role: roleParam,
      organizationId: z.string().describe("Organization ID owning the tag"),
      name: z.string().min(1).describe("Tag name"),
      description: z.string().optional().describe("Description"),
      scope: z.enum(["building", "residence", "any"]).default("any"),
      importance: z.enum(["obligatoire", "nice_to_have", "extra"]).default("nice_to_have"),
      suggestedProfessionals: z.array(z.string()).default([]),
    },
    async ({ role, organizationId, name, description, scope, importance, suggestedProfessionals }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const orgIds = await getMcpOrgIds();
      if (!orgIds.includes(organizationId)) {
        return { content: [{ type: "text" as const, text: "Organization not in MCP scope" }] };
      }
      const [created] = await db
        .insert(schema.documentTags)
        .values({
          organizationId,
          name,
          description: description ?? null,
          scope,
          importance,
          suggestedProfessionals,
          isSystem: false,
          source: organizationId,
        })
        .returning();
      return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
    },
  );

  server.tool(
    "update_document_tag",
    "Update a custom document tag (cannot modify system tags)",
    {
      role: roleParam,
      tagId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      scope: z.enum(["building", "residence", "any"]).optional(),
      importance: z.enum(["obligatoire", "nice_to_have", "extra"]).optional(),
      suggestedProfessionals: z.array(z.string()).optional(),
    },
    async ({ role, tagId, ...updates }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const [tag] = await db.select().from(schema.documentTags).where(eq(schema.documentTags.id, tagId));
      if (!tag) return { content: [{ type: "text" as const, text: "Tag not found" }] };
      if (tag.isSystem) return { content: [{ type: "text" as const, text: "System tags cannot be modified" }] };
      const orgIds = await getMcpOrgIds();
      if (!tag.organizationId || !orgIds.includes(tag.organizationId)) {
        return { content: [{ type: "text" as const, text: "Tag not in MCP scope" }] };
      }
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(updates)) if (v !== undefined) set[k] = v;
      const [updated] = await db.update(schema.documentTags).set(set).where(eq(schema.documentTags.id, tagId)).returning();
      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    },
  );

  server.tool(
    "delete_document_tag",
    "Delete a custom document tag (cannot delete system tags)",
    { role: roleParam, tagId: z.string() },
    async ({ role, tagId }) => {
      if (role === "tenant") {
        return { content: [{ type: "text" as const, text: "Access denied" }] };
      }
      const [tag] = await db.select().from(schema.documentTags).where(eq(schema.documentTags.id, tagId));
      if (!tag) return { content: [{ type: "text" as const, text: "Tag not found" }] };
      if (tag.isSystem) return { content: [{ type: "text" as const, text: "System tags cannot be deleted" }] };
      const orgIds = await getMcpOrgIds();
      if (!tag.organizationId || !orgIds.includes(tag.organizationId)) {
        return { content: [{ type: "text" as const, text: "Tag not in MCP scope" }] };
      }
      await db.delete(schema.documentTags).where(eq(schema.documentTags.id, tagId));
      return { content: [{ type: "text" as const, text: "Deleted" }] };
    },
  );

  server.tool(
    "assign_document_tag",
    "Assign a tag to a document",
    { role: roleParam, documentId: z.string(), tagId: z.string() },
    async ({ documentId, tagId }) => {
      try {
        const [created] = await db
          .insert(schema.documentTagAssignments)
          .values({ documentId, tagId })
          .returning();
        return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Already assigned" }] };
      }
    },
  );

  server.tool(
    "unassign_document_tag",
    "Remove a tag from a document",
    { role: roleParam, documentId: z.string(), tagId: z.string() },
    async ({ documentId, tagId }) => {
      await db
        .delete(schema.documentTagAssignments)
        .where(
          and(
            eq(schema.documentTagAssignments.documentId, documentId),
            eq(schema.documentTagAssignments.tagId, tagId),
          ),
        );
      return { content: [{ type: "text" as const, text: "Unassigned" }] };
    },
  );

  // ===========================================================================
  // Document Links — sequence chaining with AI suggestions (Task #397)
  // ===========================================================================
  // All document-link tools are scoped through the document's building/
  // residence: a tool returns "not found / access denied" when the doc
  // (or for create, the target doc) is outside the MCP-scoped orgs.
  const assertDocInMcpScope = async (documentId: string, mcpOrgIds: string[]) => {
    const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId)).limit(1);
    if (!doc) return null;
    if (doc.buildingId) {
      const [b] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, doc.buildingId)).limit(1);
      if (!b || !mcpOrgIds.includes(b.organizationId)) return null;
    } else if (doc.residenceId) {
      const [r] = await db.select().from(schema.residences).where(eq(schema.residences.id, doc.residenceId)).limit(1);
      if (!r) return null;
      const [b] = await db.select().from(schema.buildings).where(eq(schema.buildings.id, r.buildingId)).limit(1);
      if (!b || !mcpOrgIds.includes(b.organizationId)) return null;
    } else {
      return null; // Documents without building/residence scope are not addressable.
    }
    return doc;
  };

  server.tool(
    "list_document_links",
    "List explicit before/after links anchored at a document. Returns rows from `document_links` where the document is either source or target.",
    { role: roleParam, documentId: z.string().describe("Document ID") },
    async ({ documentId }) => {
      const orgIds = await getMcpOrgIds();
      const doc = await assertDocInMcpScope(documentId, orgIds);
      if (!doc) return { content: [{ type: "text" as const, text: "Document not found or access denied" }] };
      const { listLinksForDocument } = await import("../services/document-link-service");
      const links = await listLinksForDocument(documentId);
      return { content: [{ type: "text" as const, text: JSON.stringify(links, null, 2) }] };
    },
  );

  server.tool(
    "get_document_neighbors",
    "Resolve previous/next documents for a document by combining explicit links with date-based ordering (scoped to same building/residence).",
    { role: roleParam, documentId: z.string().describe("Document ID") },
    async ({ role, documentId }) => {
      const orgIds = await getMcpOrgIds();
      const doc = await assertDocInMcpScope(documentId, orgIds);
      if (!doc) return { content: [{ type: "text" as const, text: "Document not found or access denied" }] };
      const { resolveDocumentNeighbors } = await import("../services/document-link-service");
      const result = await resolveDocumentNeighbors(documentId, { role });
      if (!result) return { content: [{ type: "text" as const, text: "Document not found" }] };
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            currentId: result.current.id,
            previous: result.previous.document
              ? { id: result.previous.document.id, name: result.previous.document.name, source: result.previous.source }
              : null,
            previousIsChainEnd: result.previous.isChainEnd,
            next: result.next.document
              ? { id: result.next.document.id, name: result.next.document.name, source: result.next.source }
              : null,
            nextIsChainEnd: result.next.isChainEnd,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "create_document_link",
    "Create or replace an explicit document link. Each document has at most one explicit `before` and one explicit `after` (admin/manager only).",
    {
      role: roleParam,
      fromDocumentId: z.string().describe("Source document ID"),
      toDocumentId: z.string().describe("Target document ID"),
      position: z.enum(["before", "after"]).describe("Whether the target comes before or after the source"),
      ordinal: z.number().int().optional().describe("Optional explicit ordinal for tie-breaking"),
    },
    async ({ role, fromDocumentId, toDocumentId, position, ordinal }) => {
      if (role !== "admin" && role !== "manager" && role !== "demo_manager") {
        return { content: [{ type: "text" as const, text: "Access denied: only admin or manager roles can manage document links" }] };
      }
      const orgIds = await getMcpOrgIds();
      const fromDoc = await assertDocInMcpScope(fromDocumentId, orgIds);
      const toDoc = await assertDocInMcpScope(toDocumentId, orgIds);
      if (!fromDoc) return { content: [{ type: "text" as const, text: "Source document not found or access denied" }] };
      if (!toDoc) return { content: [{ type: "text" as const, text: "Target document not found or access denied" }] };
      try {
        const { upsertDocumentLink, DocumentLinkValidationError } = await import("../services/document-link-service");
        try {
          const link = await upsertDocumentLink({ fromDocumentId, toDocumentId, position, ordinal: ordinal ?? null });
          return { content: [{ type: "text" as const, text: JSON.stringify(link, null, 2) }] };
        } catch (e) {
          if (e instanceof DocumentLinkValidationError) {
            return { content: [{ type: "text" as const, text: `Validation error: ${e.message}` }] };
          }
          throw e;
        }
      } catch (e) {
        console.error("[mcp:create_document_link]", e);
        return buildWriteErrorResponse(e, "document link", "create");
      }
    },
  );

  server.tool(
    "delete_document_link",
    "Remove the explicit `before` or `after` link anchored at a document (admin/manager only).",
    {
      role: roleParam,
      fromDocumentId: z.string().describe("Source document ID"),
      position: z.enum(["before", "after"]).describe("Which side to remove"),
    },
    async ({ role, fromDocumentId, position }) => {
      if (role !== "admin" && role !== "manager" && role !== "demo_manager") {
        return { content: [{ type: "text" as const, text: "Access denied: only admin or manager roles can manage document links" }] };
      }
      const orgIds = await getMcpOrgIds();
      const doc = await assertDocInMcpScope(fromDocumentId, orgIds);
      if (!doc) return { content: [{ type: "text" as const, text: "Document not found or access denied" }] };
      const { deleteDocumentLink } = await import("../services/document-link-service");
      const removed = await deleteDocumentLink({ fromDocumentId, position });
      return { content: [{ type: "text" as const, text: removed ? "Deleted" : "Link not found" }] };
    },
  );

  server.tool(
    "suggest_document_links",
    "Get AI-ranked candidate documents to link from `documentId`. Ranking is deterministic (name similarity, shared category, shared tags, date proximity, same building/residence) and includes an `explain` payload.",
    {
      role: roleParam,
      documentId: z.string().describe("Source document ID"),
      query: z.string().optional().describe("Optional free-text query to bias the ranking"),
      limit: z.number().int().min(1).max(50).optional().describe("Max suggestions to return (default 10)"),
    },
    async ({ role, documentId, query, limit }) => {
      const orgIds = await getMcpOrgIds();
      const doc = await assertDocInMcpScope(documentId, orgIds);
      if (!doc) return { content: [{ type: "text" as const, text: "Document not found or access denied" }] };
      const { suggestLinkTargets } = await import("../services/document-link-service");
      const result = await suggestLinkTargets({ documentId, query, limit, viewer: { role } });
      if (!result) return { content: [{ type: "text" as const, text: "Document not found" }] };
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            suggestions: result.suggestions.map((s) => ({
              document: {
                id: s.document.id,
                name: s.document.name,
                documentType: s.document.documentType,
                effectiveDate: s.document.effectiveDate,
                createdAt: s.document.createdAt,
              },
              score: Math.round(s.score * 100) / 100,
              explain: s.explain,
            })),
          }, null, 2),
        }],
      };
    },
  );

  return server;
}
