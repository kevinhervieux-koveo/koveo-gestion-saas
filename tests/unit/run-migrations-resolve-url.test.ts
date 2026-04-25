/**
 * @jest-environment node
 *
 * Task #936 — `resolveDatabaseUrl()` is the single point that decides
 * which database the migration runner targets. Production deploys
 * silently corrupted the dev DB before this task because the runner
 * only knew about `DATABASE_URL_KOVEO` and quietly fell back to
 * `DATABASE_URL` when the operator stored their prod URL under
 * `PRODUCTION_DATABASE_URL`. These tests pin the new contract:
 *
 *   - Either prod env var (or both) is accepted in production.
 *   - When both are set, `DATABASE_URL_KOVEO` wins deterministically;
 *     the alias is reported so the caller can log it, with a flag for
 *     the dangerous "they point at different databases" case.
 *   - In production with neither prod var set, the runner refuses to
 *     fall back to `DATABASE_URL` and throws — fail-fast instead of
 *     silently writing dev DB from a prod deploy.
 *   - Development behaviour (prefers `DATABASE_URL`) is unchanged.
 */
import { describe, expect, it } from '@jest/globals';
import {
  assertProdUrlInProduction,
  maskDatabaseUrl,
  resolveDatabaseUrl,
  resolveProdDatabaseUrl,
} from '../../scripts/run-migrations-url';

const PROD_KOVEO = 'postgres://u:p@prod-koveo.example.com:5432/koveo';
const PROD_ALIAS = 'postgres://u:p@prod-alias.example.com:5432/koveo';
const DEV = 'postgres://u:p@dev.example.com:5432/koveo_dev';

describe('resolveDatabaseUrl', () => {
  describe('production (NODE_ENV=production)', () => {
    it('uses DATABASE_URL_KOVEO when it is the only prod var set', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'production',
        DATABASE_URL_KOVEO: PROD_KOVEO,
        DATABASE_URL: DEV,
      });
      expect(r).toEqual({
        url: PROD_KOVEO,
        source: 'DATABASE_URL_KOVEO',
        isProd: true,
      });
    });

    it('uses PRODUCTION_DATABASE_URL when it is the only prod var set', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'production',
        PRODUCTION_DATABASE_URL: PROD_ALIAS,
        DATABASE_URL: DEV,
      });
      expect(r).toEqual({
        url: PROD_ALIAS,
        source: 'PRODUCTION_DATABASE_URL',
        isProd: true,
      });
    });

    it('prefers DATABASE_URL_KOVEO when both prod vars are set to the same value', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'production',
        DATABASE_URL_KOVEO: PROD_KOVEO,
        PRODUCTION_DATABASE_URL: PROD_KOVEO,
      });
      expect(r).toEqual({
        url: PROD_KOVEO,
        source: 'DATABASE_URL_KOVEO',
        isProd: true,
        ignoredSource: 'PRODUCTION_DATABASE_URL',
        ignoredSourceDiffers: false,
      });
    });

    it('prefers DATABASE_URL_KOVEO and flags the divergence when both prod vars disagree', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'production',
        DATABASE_URL_KOVEO: PROD_KOVEO,
        PRODUCTION_DATABASE_URL: PROD_ALIAS,
      });
      expect(r).toEqual({
        url: PROD_KOVEO,
        source: 'DATABASE_URL_KOVEO',
        isProd: true,
        ignoredSource: 'PRODUCTION_DATABASE_URL',
        ignoredSourceDiffers: true,
      });
    });

    it('throws fail-fast when neither prod var is set, even if DATABASE_URL is set', () => {
      expect(() =>
        resolveDatabaseUrl({
          NODE_ENV: 'production',
          DATABASE_URL: DEV,
        }),
      ).toThrow(/Refusing to migrate the development database/);
    });

    it('throws fail-fast when no DB env vars are set at all in production', () => {
      expect(() =>
        resolveDatabaseUrl({
          NODE_ENV: 'production',
        }),
      ).toThrow(
        /neither DATABASE_URL_KOVEO nor PRODUCTION_DATABASE_URL is set/,
      );
    });
  });

  describe('non-production', () => {
    it('uses DATABASE_URL in development', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'development',
        DATABASE_URL: DEV,
        DATABASE_URL_KOVEO: PROD_KOVEO,
      });
      expect(r).toEqual({
        url: DEV,
        source: 'DATABASE_URL',
        isProd: false,
      });
    });

    it('falls back to DATABASE_URL_KOVEO when DATABASE_URL is unset (legacy dev shells)', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'development',
        DATABASE_URL_KOVEO: PROD_KOVEO,
      });
      expect(r.url).toBe(PROD_KOVEO);
      expect(r.source).toBe('DATABASE_URL_KOVEO');
      expect(r.isProd).toBe(false);
    });

    it('falls back to PRODUCTION_DATABASE_URL when nothing else is set', () => {
      const r = resolveDatabaseUrl({
        NODE_ENV: 'development',
        PRODUCTION_DATABASE_URL: PROD_ALIAS,
      });
      expect(r.url).toBe(PROD_ALIAS);
      expect(r.source).toBe('PRODUCTION_DATABASE_URL');
    });

    it('throws when no DB env vars are set at all in development', () => {
      expect(() =>
        resolveDatabaseUrl({
          NODE_ENV: 'development',
        }),
      ).toThrow(/No database URL configured/);
    });
  });
});

/**
 * Task #940 — `resolveProdDatabaseUrl()` is the prod-only sibling used
 * by dual-DB scripts (dev-vs-prod sync checks, `--database prod` demo
 * targeting). It must accept either prod alias and return `null` when
 * the operator has not configured one, so the caller can emit a
 * script-specific error instead of throwing through the resolver.
 */
describe('resolveProdDatabaseUrl', () => {
  it('uses DATABASE_URL_KOVEO when only it is set', () => {
    expect(
      resolveProdDatabaseUrl({ DATABASE_URL_KOVEO: PROD_KOVEO }),
    ).toEqual({ url: PROD_KOVEO, source: 'DATABASE_URL_KOVEO' });
  });

  it('uses PRODUCTION_DATABASE_URL when only it is set', () => {
    expect(
      resolveProdDatabaseUrl({ PRODUCTION_DATABASE_URL: PROD_ALIAS }),
    ).toEqual({ url: PROD_ALIAS, source: 'PRODUCTION_DATABASE_URL' });
  });

  it('prefers DATABASE_URL_KOVEO when both prod vars are set to the same value', () => {
    expect(
      resolveProdDatabaseUrl({
        DATABASE_URL_KOVEO: PROD_KOVEO,
        PRODUCTION_DATABASE_URL: PROD_KOVEO,
      }),
    ).toEqual({
      url: PROD_KOVEO,
      source: 'DATABASE_URL_KOVEO',
      ignoredSource: 'PRODUCTION_DATABASE_URL',
      ignoredSourceDiffers: false,
    });
  });

  it('prefers DATABASE_URL_KOVEO and flags the divergence when both prod vars disagree', () => {
    expect(
      resolveProdDatabaseUrl({
        DATABASE_URL_KOVEO: PROD_KOVEO,
        PRODUCTION_DATABASE_URL: PROD_ALIAS,
      }),
    ).toEqual({
      url: PROD_KOVEO,
      source: 'DATABASE_URL_KOVEO',
      ignoredSource: 'PRODUCTION_DATABASE_URL',
      ignoredSourceDiffers: true,
    });
  });

  it('returns null instead of throwing when neither prod var is set', () => {
    expect(resolveProdDatabaseUrl({})).toBeNull();
  });

  it('returns null even when DATABASE_URL is set — refuses to silently use the dev URL', () => {
    expect(resolveProdDatabaseUrl({ DATABASE_URL: DEV })).toBeNull();
  });

  it('ignores NODE_ENV — prod-only callers do not gate on NODE_ENV', () => {
    expect(
      resolveProdDatabaseUrl({
        NODE_ENV: 'development',
        DATABASE_URL_KOVEO: PROD_KOVEO,
      }),
    ).toEqual({ url: PROD_KOVEO, source: 'DATABASE_URL_KOVEO' });
  });
});

/**
 * Task #940 — `assertProdUrlInProduction()` is the explicit fail-fast
 * guard used by dual-DB scripts that have a "dev-only mode" fallback
 * for developer convenience (e.g. `scripts/advanced-database-migration.ts`).
 * The guard exists so the script does NOT silently switch to dev-only
 * mode on a production deploy where the operator forgot to set the
 * prod URL — that would either corrupt the dev DB from a prod shell
 * or hide a real misconfiguration behind a benign-looking warning.
 */
describe('assertProdUrlInProduction', () => {
  it('throws in production when no prod URL was resolved', () => {
    expect(() =>
      assertProdUrlInProduction(
        null,
        { NODE_ENV: 'production' },
        'advanced-database-migration',
      ),
    ).toThrow(
      /NODE_ENV=production but neither DATABASE_URL_KOVEO nor PRODUCTION_DATABASE_URL is set/,
    );
  });

  it('includes the script name in the thrown error so operators know what to re-run', () => {
    expect(() =>
      assertProdUrlInProduction(
        null,
        { NODE_ENV: 'production' },
        'advanced-database-migration',
      ),
    ).toThrow(/advanced-database-migration/);
  });

  it('does not throw in production when a prod URL was resolved', () => {
    expect(() =>
      assertProdUrlInProduction(
        { url: PROD_KOVEO, source: 'DATABASE_URL_KOVEO' },
        { NODE_ENV: 'production' },
        'advanced-database-migration',
      ),
    ).not.toThrow();
  });

  it('does not throw in non-production even when no prod URL is set (preserves dev-only fallback)', () => {
    expect(() =>
      assertProdUrlInProduction(
        null,
        { NODE_ENV: 'development' },
        'advanced-database-migration',
      ),
    ).not.toThrow();
  });

  it('does not throw when NODE_ENV is undefined and no prod URL is set (default dev behaviour)', () => {
    expect(() =>
      assertProdUrlInProduction(null, {}, 'advanced-database-migration'),
    ).not.toThrow();
  });
});

describe('maskDatabaseUrl', () => {
  it('strips credentials and keeps host:port/db', () => {
    expect(maskDatabaseUrl('postgres://user:secret@db.example.com:5432/koveo'))
      .toBe('db.example.com:5432/koveo');
  });

  it('omits the port when none is present', () => {
    expect(maskDatabaseUrl('postgres://user:secret@db.example.com/koveo')).toBe(
      'db.example.com/koveo',
    );
  });

  it('returns a placeholder for unparseable input rather than echoing it', () => {
    expect(maskDatabaseUrl('not a url')).toBe('<unparseable-url>');
  });
});
