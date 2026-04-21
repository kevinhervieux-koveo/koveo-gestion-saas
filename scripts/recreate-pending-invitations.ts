/**
 * Re-creates pending invitations from a CSV file (or stdin) after the
 * platform-update-2 data loss incident. For each row we call the existing
 * `storage.createInvitation` method (so all the regular side effects, hashing,
 * and validation paths run), then write an `invitation_audit_log` entry with
 * the reason `"re-created after platform-update-2 data loss"`. If the audit
 * log write fails we delete the orphaned invitation so the row pair is
 * effectively transactional.
 *
 * Each accepted invitation prints its newly generated invite link to stdout
 * so an admin can hand it to the affected user immediately.
 *
 * CSV format (header row required). Both snake_case and camelCase headers are
 * accepted so the file produced by the documented `\copy` export works
 * unmodified:
 *
 *   email,role,organization_id,building_id,residence_id,expires_in_days
 *   email,role,organizationId,buildingId,residenceId,expiresInDays
 *
 * Only `email` and `role` are required. Default expiry is 7 days. Quoted CSV
 * values (e.g. `"value, with comma"`) are handled.
 *
 * Environment:
 *   RECREATE_INVITED_BY_USER_ID (or ADMIN_USER_ID) — required, must be the id
 *     of an existing admin user. Validated before any writes.
 *   DRY_RUN=1 — parse + validate input but do not write anything.
 *
 * Usage:
 *   npx tsx scripts/recreate-pending-invitations.ts path/to/invites.csv
 *   cat invites.csv | npx tsx scripts/recreate-pending-invitations.ts
 */
import { readFileSync } from 'fs';
import { storage } from '../server/storage';
import type { InsertInvitation, InsertInvitationAuditLog } from '@shared/schema';

type InvitationRole = InsertInvitation['role'];
type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

const REASON = 're-created after platform-update-2 data loss';
const VALID_ROLES: ReadonlySet<InvitationRole> = new Set<InvitationRole>([
  'admin',
  'manager',
  'tenant',
  'resident',
  'demo_manager',
  'demo_tenant',
  'demo_resident',
]);

function isInvitationRole(value: string): value is InvitationRole {
  return (VALID_ROLES as ReadonlySet<string>).has(value);
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const ADMIN_ROLES: ReadonlySet<string> = new Set(['admin', 'manager']);

/**
 * The storage layer accepts buildingId on top of the shared insertInvitation
 * schema (it is spread directly into the drizzle insert), but the Zod-derived
 * type does not surface it. We extend the type explicitly so we can pass it
 * without casting.
 */
type InvitationCreatePayload = InsertInvitation & { buildingId?: string };

const HEADER_ALIASES: Record<string, string> = {
  email: 'email',
  role: 'role',
  organization_id: 'organizationId',
  organizationid: 'organizationId',
  building_id: 'buildingId',
  buildingid: 'buildingId',
  residence_id: 'residenceId',
  residenceid: 'residenceId',
  expires_in_days: 'expiresInDays',
  expiresindays: 'expiresInDays',
};

interface Row {
  email: string;
  role: string;
  organizationId?: string;
  buildingId?: string;
  residenceId?: string;
  expiresInDays?: number;
}

function readSource(): string {
  const fileArg = process.argv[2];
  if (fileArg) {
    return readFileSync(fileArg, 'utf8');
  }
  return readFileSync(0, 'utf8');
}

/**
 * RFC-4180-ish CSV row parser. Handles quoted fields, embedded commas, and
 * doubled-quote escapes. Sufficient for our admin-controlled CSV.
 */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function normalizeHeader(name: string): string | null {
  const key = name.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

function parseCsv(input: string): Row[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, ''))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return [];

  const rawHeader = parseCsvRow(lines[0]);
  const header = rawHeader.map((h) => normalizeHeader(h));
  for (const required of ['email', 'role'] as const) {
    if (!header.includes(required)) {
      throw new Error(
        `CSV missing required column "${required}" (got headers: ${rawHeader.join(', ')})`
      );
    }
  }

  return lines.slice(1).map((line, idx) => {
    const cells = parseCsvRow(line);
    const get = (col: keyof Row | 'expiresInDays'): string => {
      const i = header.indexOf(col as string);
      return i >= 0 ? cells[i] ?? '' : '';
    };

    const email = get('email');
    const role = get('role');
    if (!email || !role) {
      throw new Error(`Row ${idx + 2}: email and role are required`);
    }
    if (!isInvitationRole(role)) {
      throw new Error(`Row ${idx + 2}: invalid role "${role}"`);
    }

    const expiresRaw = get('expiresInDays');
    const expiresInDays = expiresRaw ? Number(expiresRaw) : 7;
    if (Number.isNaN(expiresInDays) || expiresInDays <= 0) {
      throw new Error(`Row ${idx + 2}: invalid expires_in_days "${expiresRaw}"`);
    }

    return {
      email,
      role,
      organizationId: get('organizationId') || undefined,
      buildingId: get('buildingId') || undefined,
      residenceId: get('residenceId') || undefined,
      expiresInDays,
    } satisfies Row;
  });
}

function buildInviteUrl(token: string): string {
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]?.trim()}`
      : 'http://localhost:5000');
  return `${base.replace(/\/$/, '')}/invite/accept?token=${token}`;
}

async function main(): Promise<number> {
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

  let rows: Row[];
  try {
    rows = parseCsv(readSource());
  } catch (err) {
    console.error(`[recreate] CSV parse error: ${describeError(err)}`);
    return 1;
  }

  if (rows.length === 0) {
    console.error('[recreate] No rows found in input.');
    return 1;
  }

  const invitedByUserId =
    process.env.RECREATE_INVITED_BY_USER_ID || process.env.ADMIN_USER_ID || '';
  if (!invitedByUserId) {
    console.error(
      '[recreate] RECREATE_INVITED_BY_USER_ID (or ADMIN_USER_ID) must be set ' +
        'to the admin user that should own the re-created invitations.'
    );
    return 1;
  }

  // Pre-flight: confirm the invited-by user exists AND has an admin-level
  // role so audit-log FK won't fail mid-loop, and so we never let a
  // non-admin operator silently re-seed invitations.
  try {
    const admin = await storage.getUser(invitedByUserId);
    if (!admin) {
      console.error(
        `[recreate] User ${invitedByUserId} not found. Set RECREATE_INVITED_BY_USER_ID to a valid admin user id.`
      );
      return 1;
    }
    if (!ADMIN_ROLES.has(admin.role)) {
      console.error(
        `[recreate] User ${invitedByUserId} has role "${admin.role}". ` +
          `Re-seeding invitations requires an admin or manager.`
      );
      return 1;
    }
  } catch (err) {
    console.error(`[recreate] Failed to verify invited-by user: ${describeError(err)}`);
    return 1;
  }

  if (dryRun) {
    console.error(`[recreate] DRY RUN — ${rows.length} row(s) parsed, no writes performed.`);
    for (const row of rows) {
      console.log(
        `${row.email}\t${row.role}\t${row.organizationId ?? ''}\t${row.buildingId ?? ''}\t${row.residenceId ?? ''}`
      );
    }
    return 0;
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    let createdInvitationId: string | null = null;
    try {
      const expiresAt = new Date(Date.now() + (row.expiresInDays ?? 7) * 86_400_000);
      if (!isInvitationRole(row.role)) {
        throw new Error(`invalid role "${row.role}"`);
      }
      const payload: InvitationCreatePayload = {
        email: row.email,
        role: row.role,
        invitedByUserId,
        expiresAt,
        organizationId: row.organizationId,
        residenceId: row.residenceId,
        buildingId: row.buildingId,
      };
      const invitation = await storage.createInvitation(payload);
      createdInvitationId = invitation.id;

      try {
        const auditPayload: InsertInvitationAuditLog = {
          invitationId: invitation.id,
          action: 'recreated',
          performedBy: invitedByUserId,
          details: { reason: REASON, source: 'recreate-pending-invitations.ts' },
          newStatus: 'pending' satisfies InvitationStatus,
        };
        await storage.createInvitationAuditLog(auditPayload);
      } catch (auditErr) {
        // Compensate: delete the orphaned invitation so retries don't
        // duplicate it and we never end up with rows missing audit history.
        try {
          await storage.deleteInvitation(invitation.id);
        } catch (rollbackErr) {
          console.error(
            `[recreate] CRITICAL ${row.email}: invitation ${invitation.id} created but audit log AND rollback failed. ` +
              `Manual cleanup required. audit=${describeError(auditErr)} rollback=${describeError(rollbackErr)}`
          );
          failed += 1;
          continue;
        }
        throw new Error(`audit log write failed (rolled back): ${describeError(auditErr)}`);
      }

      console.log(
        `${row.email}\t${row.role}\t${invitation.id}\t${buildInviteUrl(invitation.token)}`
      );
      succeeded += 1;
    } catch (err) {
      failed += 1;
      console.error(
        `[recreate] FAILED ${row.email}${createdInvitationId ? ` (rolled back ${createdInvitationId})` : ''}: ${describeError(err)}`
      );
    }
  }

  console.error(`[recreate] Done. ${succeeded} succeeded, ${failed} failed.`);
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`[recreate] Unexpected error: ${describeError(err)}`);
    process.exit(1);
  }
);
