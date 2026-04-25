/**
 * Database URL resolution + masking helpers for the migration runner.
 *
 * Lives in its own module (separate from `scripts/run-migrations.ts`)
 * because the runner script uses `import.meta.url` for path resolution,
 * which Jest's CJS loader cannot parse — keeping these helpers in a
 * pure module lets the unit test suite import them directly without
 * loading the script's ESM entry point.
 */

export type ProdUrlSource =
  | 'DATABASE_URL_KOVEO'
  | 'PRODUCTION_DATABASE_URL';

export type DatabaseUrlSource = ProdUrlSource | 'DATABASE_URL';

export interface ResolvedDatabaseUrl {
  url: string;
  source: DatabaseUrlSource;
  isProd: boolean;
  /**
   * When both `DATABASE_URL_KOVEO` and `PRODUCTION_DATABASE_URL` are
   * set in a production environment we deterministically prefer
   * `DATABASE_URL_KOVEO` and record the alias here so the caller can
   * log that it was ignored. If the two values differ,
   * `ignoredSourceDiffers` is `true` and the caller should warn
   * loudly — otherwise the operator probably set both to the same
   * value.
   */
  ignoredSource?: ProdUrlSource;
  ignoredSourceDiffers?: boolean;
}

export const NO_URL_MESSAGE =
  'No database URL configured. Set DATABASE_URL_KOVEO or ' +
  'PRODUCTION_DATABASE_URL (production) or DATABASE_URL (development).';

export const PROD_FALLBACK_MESSAGE =
  'NODE_ENV=production but neither DATABASE_URL_KOVEO nor ' +
  'PRODUCTION_DATABASE_URL is set. Refusing to migrate the development ' +
  'database (DATABASE_URL) from a production deploy. Set one of the two ' +
  'production env vars (they are aliases) or unset NODE_ENV=production.';

/**
 * Resolve which database URL the migration runner should target, and
 * record which env var supplied it.
 *
 * Production (`NODE_ENV=production`):
 *   - Prefer `DATABASE_URL_KOVEO` when set.
 *   - Otherwise accept `PRODUCTION_DATABASE_URL` as an alias.
 *   - If both are set, deterministically use `DATABASE_URL_KOVEO`; the
 *     alias is reported via `ignoredSource` so the caller can log it,
 *     and `ignoredSourceDiffers` flags the dangerous case where the
 *     two point at different databases.
 *   - If neither is set, throw — even when `DATABASE_URL` is set —
 *     because silently migrating the dev DB from a prod deploy is
 *     exactly the failure mode this runner exists to prevent.
 *
 * Non-production:
 *   - Prefer `DATABASE_URL`, then either prod alias if dev is unset.
 *
 * Pass an explicit `env` to keep tests hermetic.
 */
export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDatabaseUrl {
  const isProd = env.NODE_ENV === 'production';
  const koveo = env.DATABASE_URL_KOVEO;
  const prodAlias = env.PRODUCTION_DATABASE_URL;
  const dev = env.DATABASE_URL;

  if (isProd) {
    if (koveo && prodAlias) {
      return {
        url: koveo,
        source: 'DATABASE_URL_KOVEO',
        isProd: true,
        ignoredSource: 'PRODUCTION_DATABASE_URL',
        ignoredSourceDiffers: koveo !== prodAlias,
      };
    }
    if (koveo) {
      return { url: koveo, source: 'DATABASE_URL_KOVEO', isProd: true };
    }
    if (prodAlias) {
      return {
        url: prodAlias,
        source: 'PRODUCTION_DATABASE_URL',
        isProd: true,
      };
    }
    throw new Error(PROD_FALLBACK_MESSAGE);
  }

  if (dev) {
    return { url: dev, source: 'DATABASE_URL', isProd: false };
  }
  if (koveo) {
    return { url: koveo, source: 'DATABASE_URL_KOVEO', isProd: false };
  }
  if (prodAlias) {
    return {
      url: prodAlias,
      source: 'PRODUCTION_DATABASE_URL',
      isProd: false,
    };
  }
  throw new Error(NO_URL_MESSAGE);
}

/**
 * Render `host[:port]/dbname` for a connection string, stripping
 * username/password so we can safely log it. Returns a placeholder
 * when the URL cannot be parsed rather than echoing the raw value
 * (which might still contain credentials).
 */
export function maskDatabaseUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const port = u.port ? `:${u.port}` : '';
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
    const host = u.hostname || '<unknown-host>';
    return `${host}${port}${path}`;
  } catch {
    return '<unparseable-url>';
  }
}
