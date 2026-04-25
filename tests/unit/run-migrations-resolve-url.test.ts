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
  maskDatabaseUrl,
  resolveDatabaseUrl,
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
