/**
 * Pre-migration guard: counts pending invitations and aborts unless the
 * caller explicitly acknowledges that any pending rows are safe to lose.
 *
 * Run before any `drizzle-kit migrate` (or `db:push`) against an environment
 * that holds real invitation data. Exits with:
 *   0 — no pending rows, or `--allow-pending-invitations` was passed
 *   1 — pending rows exist and the operator did not opt-in (abort migration)
 *   2 — could not query the database (treated as unsafe; abort migration)
 *
 * Uses the HTTP variant of @neondatabase/serverless so we do not need to
 * wire up a WebSocket constructor (and avoid any related casts).
 *
 * Usage:
 *   npx tsx scripts/check-pending-invitations.ts
 *   npx tsx scripts/check-pending-invitations.ts --allow-pending-invitations
 */
import { neon } from '@neondatabase/serverless';

const ALLOW_FLAG = '--allow-pending-invitations';

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isUndefinedTableError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '42P01'
  );
}

async function main(): Promise<number> {
  const allowPending = process.argv.includes(ALLOW_FLAG);
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('[db:preflight] DATABASE_URL is not set; cannot verify invitations.');
    return 2;
  }

  const sql = neon(databaseUrl);
  let pending = 0;

  try {
    const rows = (await sql`SELECT COUNT(*)::text AS count FROM invitations WHERE status = 'pending'`) as Array<{ count: string }>;
    pending = Number(rows[0]?.count ?? '0');
  } catch (err) {
    if (isUndefinedTableError(err)) {
      console.log('[db:preflight] invitations table does not exist yet; safe to migrate.');
      return 0;
    }
    console.error(`[db:preflight] Failed to query invitations: ${describeError(err)}`);
    return 2;
  }

  if (pending === 0) {
    console.log('[db:preflight] No pending invitations. Safe to migrate.');
    return 0;
  }

  if (allowPending) {
    console.warn(
      `[db:preflight] WARNING: ${pending} pending invitation(s) present. ` +
        `Proceeding because ${ALLOW_FLAG} was passed.`
    );
    return 0;
  }

  console.error(
    `[db:preflight] ABORT: ${pending} pending invitation(s) detected.\n` +
      `Platform update #2 wiped these rows once before. Export them first or\n` +
      `re-run with ${ALLOW_FLAG} to acknowledge the risk.`
  );
  return 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`[db:preflight] Unexpected error: ${describeError(err)}`);
    process.exit(2);
  }
);
