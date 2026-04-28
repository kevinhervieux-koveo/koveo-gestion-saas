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
 * Error thrown when the runner is inside a Replit deployment build
 * context (detected via REPLIT_DEPLOYMENT or IS_DEPLOY_BUILD) but
 * neither prod URL alias is configured as a deployment secret.
 * The deploy MUST NOT proceed — configure DATABASE_URL_KOVEO (or its
 * alias PRODUCTION_DATABASE_URL) in the Manage → Secrets panel.
 */
export const DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE =
  'Running inside a Replit deployment build but neither ' +
  'DATABASE_URL_KOVEO nor PRODUCTION_DATABASE_URL is set. ' +
  'Refusing to migrate — configure DATABASE_URL_KOVEO as a ' +
  'deployment secret in the Manage → Secrets panel before publishing. ' +
  'The deploy will not proceed until this secret is present.';

/**
 * Error thrown when the resolved production URL is byte-equal to
 * DATABASE_URL (the dev database). This catches the operator mistake
 * of copying the dev URL into the prod secret, which would cause all
 * production migration runs to land in the dev database.
 */
export function buildProdEqualsDevMessage(
  prodSource: string,
  maskedHost: string,
): string {
  return (
    `${prodSource} resolves to the same database as DATABASE_URL ` +
    `(${maskedHost}). The production secret must not be identical to ` +
    `DATABASE_URL. Verify that ${prodSource} is set to the correct ` +
    `production database, not the development one.`
  );
}

/**
 * Return true when the migration runner is executing inside a Replit
 * deployment build. Detection uses two independent signals so that
 * a future platform change (or a missing IS_DEPLOY_BUILD flag) cannot
 * silently degrade the guard:
 *
 *  - REPLIT_DEPLOYMENT — set by the Replit platform in deploy builds.
 *  - IS_DEPLOY_BUILD=true — set explicitly in the `.replit` build
 *    command as a belt-and-suspenders fallback.
 */
export function isDeployContext(env: NodeJS.ProcessEnv): boolean {
  return !!env.REPLIT_DEPLOYMENT || env.IS_DEPLOY_BUILD === 'true';
}

/**
 * Resolve which database URL the migration runner should target, and
 * record which env var supplied it.
 *
 * Production (`NODE_ENV=production` OR deploy context):
 *   - Prefer `DATABASE_URL_KOVEO` when set.
 *   - Otherwise accept `PRODUCTION_DATABASE_URL` as an alias.
 *   - If both are set, deterministically use `DATABASE_URL_KOVEO`; the
 *     alias is reported via `ignoredSource` so the caller can log it,
 *     and `ignoredSourceDiffers` flags the dangerous case where the
 *     two point at different databases.
 *   - If neither is set, throw — even when `DATABASE_URL` is set —
 *     because silently migrating the dev DB from a prod deploy is
 *     exactly the failure mode this runner exists to prevent.
 *   - If the resolved prod URL equals `DATABASE_URL`, throw — this
 *     catches an operator mistake where the dev URL was copied into
 *     the production secret.
 *
 * Deploy context (REPLIT_DEPLOYMENT or IS_DEPLOY_BUILD=true):
 *   - Treated as production regardless of NODE_ENV value. If NODE_ENV
 *     is missing or wrong, the runner still refuses to fall back to
 *     DATABASE_URL and throws a deploy-context-specific message so the
 *     deploy log is grep-friendly.
 *
 * Non-production:
 *   - Prefer `DATABASE_URL`, then either prod alias if dev is unset.
 *
 * Pass an explicit `env` to keep tests hermetic.
 */
export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDatabaseUrl {
  const inDeploy = isDeployContext(env);
  const isProd = env.NODE_ENV === 'production' || inDeploy;
  const koveo = env.DATABASE_URL_KOVEO;
  const prodAlias = env.PRODUCTION_DATABASE_URL;
  const dev = env.DATABASE_URL;

  if (isProd) {
    if (koveo && prodAlias) {
      assertProdNotEqualsDevUrl(koveo, 'DATABASE_URL_KOVEO', dev);
      return {
        url: koveo,
        source: 'DATABASE_URL_KOVEO',
        isProd: true,
        ignoredSource: 'PRODUCTION_DATABASE_URL',
        ignoredSourceDiffers: koveo !== prodAlias,
      };
    }
    if (koveo) {
      assertProdNotEqualsDevUrl(koveo, 'DATABASE_URL_KOVEO', dev);
      return { url: koveo, source: 'DATABASE_URL_KOVEO', isProd: true };
    }
    if (prodAlias) {
      assertProdNotEqualsDevUrl(prodAlias, 'PRODUCTION_DATABASE_URL', dev);
      return {
        url: prodAlias,
        source: 'PRODUCTION_DATABASE_URL',
        isProd: true,
      };
    }
    // Neither prod URL is configured — fail fast with a context-specific message.
    if (inDeploy) {
      throw new Error(DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE);
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
 * Throw if the resolved production URL is byte-equal to the dev URL.
 * This catches the operator mistake of copying DATABASE_URL into the
 * production secret, which would silently run every deploy migration
 * against the development database.
 */
function assertProdNotEqualsDevUrl(
  prodUrl: string,
  prodSource: string,
  devUrl: string | undefined,
): void {
  if (devUrl && prodUrl === devUrl) {
    throw new Error(
      buildProdEqualsDevMessage(prodSource, maskDatabaseUrl(prodUrl)),
    );
  }
}

/**
 * Result of `resolveProdDatabaseUrl()`. Mirrors the prod-relevant
 * subset of `ResolvedDatabaseUrl` for callers (sync/check scripts)
 * that explicitly need the prod URL alongside the dev URL.
 */
export interface ResolvedProdDatabaseUrl {
  url: string;
  source: ProdUrlSource;
  ignoredSource?: ProdUrlSource;
  ignoredSourceDiffers?: boolean;
}

/**
 * Resolve the production database URL using the same alias rules as
 * `resolveDatabaseUrl()` in production mode, but without consulting
 * `NODE_ENV` and without throwing when no prod var is set. Returns
 * `null` instead so the caller (e.g. dev-vs-prod comparison scripts)
 * can decide how to handle a missing prod URL — typically by exiting
 * with a script-specific error message.
 *
 * Use this from one-off scripts that need the prod URL specifically
 * (e.g. database sync checks, demo-data targeting `--database prod`)
 * so they accept either `DATABASE_URL_KOVEO` or
 * `PRODUCTION_DATABASE_URL`, matching the runtime contract.
 */
export function resolveProdDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedProdDatabaseUrl | null {
  const koveo = env.DATABASE_URL_KOVEO;
  const prodAlias = env.PRODUCTION_DATABASE_URL;

  if (koveo && prodAlias) {
    return {
      url: koveo,
      source: 'DATABASE_URL_KOVEO',
      ignoredSource: 'PRODUCTION_DATABASE_URL',
      ignoredSourceDiffers: koveo !== prodAlias,
    };
  }
  if (koveo) {
    return { url: koveo, source: 'DATABASE_URL_KOVEO' };
  }
  if (prodAlias) {
    return { url: prodAlias, source: 'PRODUCTION_DATABASE_URL' };
  }
  return null;
}

/**
 * Assert that a prod URL was actually resolved when running under
 * `NODE_ENV=production`. Used by dual-DB scripts (sync checks,
 * advanced migrations) that have a "dev-only mode" fallback for
 * development convenience but must NOT silently fall back to it on
 * a production deploy — that would either corrupt the dev DB from
 * a prod shell or produce misleading "everything looks fine" output
 * because the script never touched the real prod data.
 *
 * Returns silently when the prod URL was resolved or when the
 * caller is not in production. Throws a descriptive Error otherwise.
 *
 * @param prodResolved Result of `resolveProdDatabaseUrl()`.
 * @param env Process env (overridable for tests). Defaults to `process.env`.
 * @param scriptName Short name used in the error message ("advanced
 *        migration", "dev-db-check", etc.) so operators know which
 *        script to re-invoke.
 */
export function assertProdUrlInProduction(
  prodResolved: ResolvedProdDatabaseUrl | null,
  env: NodeJS.ProcessEnv = process.env,
  scriptName = 'this script',
): void {
  if (prodResolved) return;
  if (env.NODE_ENV !== 'production') return;
  throw new Error(
    `NODE_ENV=production but neither DATABASE_URL_KOVEO nor ` +
      `PRODUCTION_DATABASE_URL is set. Refusing to fall back to ` +
      `dev-only mode for ${scriptName} in production. Set one of ` +
      `the prod URL env vars, or unset NODE_ENV=production.`,
  );
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
