#!/usr/bin/env tsx
/**
 * Wrapper for `drizzle-kit push` that prevents accidental schema drift.
 *
 * Why this exists
 * ---------------
 * For years developers used `drizzle-kit push` (`npm run db:push`) to
 * evolve the local dev database. Numbered SQL migrations in `migrations/`
 * rotted in parallel, so prod and dev silently diverged — the cleanup
 * eventually required a 6,000-line repair migration (Task #791).
 *
 * The team workflow is now:
 *   1. Edit `shared/schema.ts` (or files under `shared/schemas/`).
 *   2. Run `npx drizzle-kit generate` to produce a numbered SQL migration
 *      under `migrations/NNNN_*.sql` (or hand-write one).
 *   3. Apply it locally with `npm run migrate`.
 *   4. Commit the schema change AND the migration together.
 *
 * `drizzle-kit push` skips the numbered chain entirely, so it must not be
 * used for routine development. This wrapper prints a loud warning and
 * either:
 *   - Refuses to run when invoked non-interactively (CI, post-merge,
 *     deployment hooks). Those code paths should use `npm run migrate`.
 *   - Demands a typed confirmation when invoked interactively.
 *
 * Bypass
 * ------
 * `npm run db:push:danger` runs `drizzle-kit push` directly, with no
 * prompt. Reserved for one-off recovery scenarios — never for normal
 * schema changes.
 */
import { spawnSync } from 'child_process';
import { createInterface } from 'readline';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function printBanner(): void {
  const line = '='.repeat(72);
  console.error(`${RED}${BOLD}${line}${RESET}`);
  console.error(`${RED}${BOLD}  WARNING: drizzle-kit push bypasses the numbered migration chain${RESET}`);
  console.error(`${RED}${BOLD}${line}${RESET}`);
  console.error('');
  console.error(`${YELLOW}  Using ${BOLD}drizzle-kit push${RESET}${YELLOW} to evolve the schema is what created the${RESET}`);
  console.error(`${YELLOW}  6,000-line repair migration in Task #791. Dev and prod silently${RESET}`);
  console.error(`${YELLOW}  drift apart because nothing gets recorded under migrations/.${RESET}`);
  console.error('');
  console.error(`${BOLD}  The supported workflow is:${RESET}`);
  console.error('    1. Edit shared/schema.ts');
  console.error('    2. npx drizzle-kit generate   # writes migrations/NNNN_*.sql');
  console.error('    3. npm run migrate            # applies it locally');
  console.error('    4. Commit the schema change AND the migration together');
  console.error('');
  console.error(`  See ${BOLD}docs/migrations.md${RESET} for the full workflow.`);
  console.error('');
  console.error(`  Escape hatch (rare recovery only): ${BOLD}npm run db:push:danger${RESET}`);
  console.error(`${RED}${BOLD}${line}${RESET}`);
  console.error('');
}

async function promptConfirmation(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const expected = 'I understand drift';
  return new Promise((resolve) => {
    rl.question(
      `Type ${BOLD}${expected}${RESET} to proceed (anything else aborts): `,
      (answer) => {
        rl.close();
        resolve(answer.trim() === expected);
      }
    );
  });
}

async function main(): Promise<void> {
  printBanner();

  if (!process.stdin.isTTY) {
    console.error(
      `${RED}Refusing to run ${BOLD}drizzle-kit push${RESET}${RED} non-interactively.${RESET}`
    );
    console.error(
      `Automated paths (CI, post-merge, deployment) should run ${BOLD}npm run migrate${RESET} instead.`
    );
    process.exit(1);
  }

  const confirmed = await promptConfirmation();
  if (!confirmed) {
    console.error(`${RED}Aborted. No changes made.${RESET}`);
    process.exit(1);
  }

  const extra = process.argv.slice(2);
  const result = spawnSync('npx', ['drizzle-kit', 'push', ...extra], {
    stdio: 'inherit',
    shell: false,
  });
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
