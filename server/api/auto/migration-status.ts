/**
 * Post-deploy migration verifier endpoint (task #939).
 *
 * Exposes `GET /api/admin/migration-status`. The endpoint compares the
 * highest migration filename recorded in `schema_migrations` (the live
 * database) against the highest `NNNN_*.sql` shipped with the deployed
 * bundle on disk and reports whether the deploy actually landed the
 * schema the running code expects.
 *
 * Behaviour:
 *  - Returns 200 + `{ inSync: true, ... }` when the highest applied
 *    matches the highest expected and there are no missing files.
 *  - Returns 503 + `{ inSync: false, ... }` when the live database is
 *    behind the bundle. The 503 (instead of 200 with a flag) means a
 *    misconfigured deploy hook trips uptime/synthetic monitors the same
 *    day instead of waiting for a runtime column-not-found error.
 *  - Returns 500 + `{ error }` when the verifier itself fails (e.g. DB
 *    unreachable). This is logged loudly with `[migrate]` so it shows up
 *    in the same grep as the runner.
 *
 * Why this is unauthenticated: the response body only contains migration
 * filenames (already in the public repo) and a masked `host:port/db`
 * (no credentials). Operators / synthetic monitors / CI smoke tests need
 * to be able to curl this without juggling an admin session.
 *
 * The handler intentionally allocates a fresh pool per request via
 * `verifyMigrationsApplied()` rather than reusing the app's main pool —
 * the verifier needs to run even if the app pool is misconfigured, and
 * this endpoint is not on a hot path so the per-request connection cost
 * is acceptable (and matches what `--verify` does from the CLI).
 */
import type { Express } from 'express';
import {
  verifyMigrationsApplied,
  formatVerification,
  describeDrift,
} from '../../../scripts/run-migrations';

export default function register(app: Express): void {
  app.get('/api/admin/migration-status', async (_req, res) => {
    try {
      const result = await verifyMigrationsApplied();
      const line = formatVerification(result);
      if (result.inSync) {
        console.log(`[migrate] ${line}`);
        return res.status(200).json({
          inSync: true,
          driftKind: result.driftKind,
          highestApplied: result.highestApplied,
          highestExpected: result.highestExpected,
          source: result.source,
          db: result.maskedDb,
          checkedAt: new Date().toISOString(),
        });
      }
      // Loud log so the same drift shows up in grep/alerting in addition
      // to the HTTP 503 the caller observes.
      console.error(`[migrate] ${line}`);
      return res.status(503).json({
        inSync: false,
        driftKind: result.driftKind,
        highestApplied: result.highestApplied,
        highestExpected: result.highestExpected,
        pendingCount: result.pendingCount,
        missing: result.missing,
        source: result.source,
        db: result.maskedDb,
        checkedAt: new Date().toISOString(),
        message: describeDrift(result),
      });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      console.error(`[migrate] migration verifier crashed: ${msg}`);
      return res.status(500).json({
        inSync: null,
        error: 'verifier_failed',
        message: msg,
        checkedAt: new Date().toISOString(),
      });
    }
  });
}
