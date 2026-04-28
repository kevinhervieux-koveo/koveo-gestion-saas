/**
 * Unit tests for `scripts/run-migrations-url.ts`.
 *
 * Covers URL resolution, deploy-context detection, the prod-equals-dev
 * sanity check, and the normal dev/CI path so regressions cannot slip
 * through unnoticed.
 */

import {
  resolveDatabaseUrl,
  isDeployContext,
  maskDatabaseUrl,
  PROD_FALLBACK_MESSAGE,
  DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE,
  buildProdEqualsDevMessage,
  NO_URL_MESSAGE,
} from '../../scripts/run-migrations-url';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal env map to keep tests readable. */
function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

// ---------------------------------------------------------------------------
// isDeployContext
// ---------------------------------------------------------------------------

describe('isDeployContext()', () => {
  it('returns false when neither REPLIT_DEPLOYMENT nor IS_DEPLOY_BUILD is set', () => {
    expect(isDeployContext(env())).toBe(false);
  });

  it('returns true when REPLIT_DEPLOYMENT is set (platform-provided signal)', () => {
    expect(isDeployContext(env({ REPLIT_DEPLOYMENT: '1' }))).toBe(true);
  });

  it('returns true when IS_DEPLOY_BUILD=true (build-command signal)', () => {
    expect(isDeployContext(env({ IS_DEPLOY_BUILD: 'true' }))).toBe(true);
  });

  it('returns false when IS_DEPLOY_BUILD has a non-"true" value', () => {
    expect(isDeployContext(env({ IS_DEPLOY_BUILD: '1' }))).toBe(false);
    expect(isDeployContext(env({ IS_DEPLOY_BUILD: 'yes' }))).toBe(false);
  });

  it('returns true when both signals are present', () => {
    expect(
      isDeployContext(env({ REPLIT_DEPLOYMENT: '1', IS_DEPLOY_BUILD: 'true' })),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveDatabaseUrl — deploy-context behaviour (Step 3)
// ---------------------------------------------------------------------------

describe('resolveDatabaseUrl() — deploy-context guard', () => {
  const PROD_URL = 'postgresql://user:pw@prod-host/proddb';
  const DEV_URL  = 'postgresql://user:pw@dev-host/devdb';

  it('uses DATABASE_URL_KOVEO when IS_DEPLOY_BUILD=true even without NODE_ENV', () => {
    const resolved = resolveDatabaseUrl(
      env({ IS_DEPLOY_BUILD: 'true', DATABASE_URL_KOVEO: PROD_URL }),
    );
    expect(resolved.url).toBe(PROD_URL);
    expect(resolved.source).toBe('DATABASE_URL_KOVEO');
    expect(resolved.isProd).toBe(true);
  });

  it('uses DATABASE_URL_KOVEO when REPLIT_DEPLOYMENT is set even without NODE_ENV', () => {
    const resolved = resolveDatabaseUrl(
      env({ REPLIT_DEPLOYMENT: '1', DATABASE_URL_KOVEO: PROD_URL }),
    );
    expect(resolved.url).toBe(PROD_URL);
    expect(resolved.source).toBe('DATABASE_URL_KOVEO');
    expect(resolved.isProd).toBe(true);
  });

  it('uses PRODUCTION_DATABASE_URL when IS_DEPLOY_BUILD=true and KOVEO is absent', () => {
    const resolved = resolveDatabaseUrl(
      env({ IS_DEPLOY_BUILD: 'true', PRODUCTION_DATABASE_URL: PROD_URL }),
    );
    expect(resolved.url).toBe(PROD_URL);
    expect(resolved.source).toBe('PRODUCTION_DATABASE_URL');
    expect(resolved.isProd).toBe(true);
  });

  it('throws DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE when IS_DEPLOY_BUILD=true but no prod URL', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({ IS_DEPLOY_BUILD: 'true', DATABASE_URL: DEV_URL }),
      ),
    ).toThrow(DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE);
  });

  it('throws DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE when REPLIT_DEPLOYMENT is set but no prod URL', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({ REPLIT_DEPLOYMENT: '1', DATABASE_URL: DEV_URL }),
      ),
    ).toThrow(DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE);
  });

  it('throws DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE when deploy context has no URLs at all', () => {
    expect(() =>
      resolveDatabaseUrl(env({ IS_DEPLOY_BUILD: 'true' })),
    ).toThrow(DEPLOY_CONTEXT_NO_PROD_URL_MESSAGE);
  });

  it('does NOT fall back to DATABASE_URL in deploy context when prod URL is missing', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({ IS_DEPLOY_BUILD: 'true', DATABASE_URL: DEV_URL }),
      ),
    ).toThrow(); // must throw, never return DEV_URL
  });
});

// ---------------------------------------------------------------------------
// resolveDatabaseUrl — prod-equals-dev sanity check (Step 4)
// ---------------------------------------------------------------------------

describe('resolveDatabaseUrl() — prod-equals-dev sanity check', () => {
  const SHARED_URL = 'postgresql://user:pw@shared-host/db';

  it('throws when DATABASE_URL_KOVEO equals DATABASE_URL under NODE_ENV=production', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({
          NODE_ENV: 'production',
          DATABASE_URL_KOVEO: SHARED_URL,
          DATABASE_URL: SHARED_URL,
        }),
      ),
    ).toThrow(/DATABASE_URL_KOVEO resolves to the same database as DATABASE_URL/);
  });

  it('throws when PRODUCTION_DATABASE_URL equals DATABASE_URL under NODE_ENV=production', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({
          NODE_ENV: 'production',
          PRODUCTION_DATABASE_URL: SHARED_URL,
          DATABASE_URL: SHARED_URL,
        }),
      ),
    ).toThrow(/PRODUCTION_DATABASE_URL resolves to the same database as DATABASE_URL/);
  });

  it('throws when prod URL equals dev URL in deploy context (IS_DEPLOY_BUILD)', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({
          IS_DEPLOY_BUILD: 'true',
          DATABASE_URL_KOVEO: SHARED_URL,
          DATABASE_URL: SHARED_URL,
        }),
      ),
    ).toThrow(/DATABASE_URL_KOVEO resolves to the same database as DATABASE_URL/);
  });

  it('includes the masked host in the error message', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({
          NODE_ENV: 'production',
          DATABASE_URL_KOVEO: SHARED_URL,
          DATABASE_URL: SHARED_URL,
        }),
      ),
    ).toThrow('shared-host/db');
  });

  it('does NOT throw when prod URL differs from dev URL', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({
          NODE_ENV: 'production',
          DATABASE_URL_KOVEO: 'postgresql://u:p@prod-host/proddb',
          DATABASE_URL: 'postgresql://u:p@dev-host/devdb',
        }),
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveDatabaseUrl — NODE_ENV=production (existing behaviour)
// ---------------------------------------------------------------------------

describe('resolveDatabaseUrl() — NODE_ENV=production', () => {
  const KOVEO = 'postgresql://u:p@prod-host/proddb';
  const ALIAS = 'postgresql://u:p@alias-host/aliasdb';

  it('prefers DATABASE_URL_KOVEO when both prod aliases are set', () => {
    const resolved = resolveDatabaseUrl(
      env({ NODE_ENV: 'production', DATABASE_URL_KOVEO: KOVEO, PRODUCTION_DATABASE_URL: ALIAS }),
    );
    expect(resolved.url).toBe(KOVEO);
    expect(resolved.source).toBe('DATABASE_URL_KOVEO');
    expect(resolved.ignoredSource).toBe('PRODUCTION_DATABASE_URL');
    expect(resolved.ignoredSourceDiffers).toBe(true);
  });

  it('reports ignoredSourceDiffers=false when both aliases have the same value', () => {
    const resolved = resolveDatabaseUrl(
      env({ NODE_ENV: 'production', DATABASE_URL_KOVEO: KOVEO, PRODUCTION_DATABASE_URL: KOVEO }),
    );
    expect(resolved.ignoredSourceDiffers).toBe(false);
  });

  it('uses PRODUCTION_DATABASE_URL when KOVEO is absent', () => {
    const resolved = resolveDatabaseUrl(
      env({ NODE_ENV: 'production', PRODUCTION_DATABASE_URL: ALIAS }),
    );
    expect(resolved.url).toBe(ALIAS);
    expect(resolved.source).toBe('PRODUCTION_DATABASE_URL');
    expect(resolved.isProd).toBe(true);
  });

  it('throws PROD_FALLBACK_MESSAGE when no prod URL and NODE_ENV=production (no deploy context)', () => {
    expect(() =>
      resolveDatabaseUrl(
        env({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://u:p@dev/db' }),
      ),
    ).toThrow(PROD_FALLBACK_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// resolveDatabaseUrl — normal dev/CI runs (Step 5d)
// ---------------------------------------------------------------------------

describe('resolveDatabaseUrl() — normal dev/CI (no deploy context, NODE_ENV unset)', () => {
  const DEV_URL  = 'postgresql://u:p@dev-host/devdb';
  const PROD_URL = 'postgresql://u:p@prod-host/proddb';

  it('returns DATABASE_URL when set (happy path)', () => {
    const resolved = resolveDatabaseUrl(env({ DATABASE_URL: DEV_URL }));
    expect(resolved.url).toBe(DEV_URL);
    expect(resolved.source).toBe('DATABASE_URL');
    expect(resolved.isProd).toBe(false);
  });

  it('falls back to DATABASE_URL_KOVEO when DATABASE_URL is absent', () => {
    const resolved = resolveDatabaseUrl(env({ DATABASE_URL_KOVEO: PROD_URL }));
    expect(resolved.url).toBe(PROD_URL);
    expect(resolved.source).toBe('DATABASE_URL_KOVEO');
    expect(resolved.isProd).toBe(false);
  });

  it('falls back to PRODUCTION_DATABASE_URL when DATABASE_URL and KOVEO are absent', () => {
    const resolved = resolveDatabaseUrl(
      env({ PRODUCTION_DATABASE_URL: PROD_URL }),
    );
    expect(resolved.url).toBe(PROD_URL);
    expect(resolved.source).toBe('PRODUCTION_DATABASE_URL');
    expect(resolved.isProd).toBe(false);
  });

  it('throws NO_URL_MESSAGE when no URL is set', () => {
    expect(() => resolveDatabaseUrl(env())).toThrow(NO_URL_MESSAGE);
  });

  it('does not apply the prod-equals-dev check in dev context', () => {
    const SAME = 'postgresql://u:p@same-host/db';
    // No throw expected — the sanity check only applies in prod/deploy context.
    expect(() =>
      resolveDatabaseUrl(env({ DATABASE_URL: SAME })),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// maskDatabaseUrl
// ---------------------------------------------------------------------------

describe('maskDatabaseUrl()', () => {
  it('strips credentials and returns host/db', () => {
    expect(maskDatabaseUrl('postgresql://user:secret@my-host.neon.tech/mydb')).toBe(
      'my-host.neon.tech/mydb',
    );
  });

  it('includes port when present', () => {
    expect(maskDatabaseUrl('postgresql://u:p@host:5432/db')).toBe('host:5432/db');
  });

  it('returns placeholder for unparseable URL', () => {
    expect(maskDatabaseUrl('not-a-url')).toBe('<unparseable-url>');
  });
});

// ---------------------------------------------------------------------------
// buildProdEqualsDevMessage
// ---------------------------------------------------------------------------

describe('buildProdEqualsDevMessage()', () => {
  it('names both the prod source and the masked host', () => {
    const msg = buildProdEqualsDevMessage('DATABASE_URL_KOVEO', 'prod-host/db');
    expect(msg).toContain('DATABASE_URL_KOVEO');
    expect(msg).toContain('DATABASE_URL');
    expect(msg).toContain('prod-host/db');
  });
});
