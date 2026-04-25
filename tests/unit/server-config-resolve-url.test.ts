/**
 * @jest-environment node
 *
 * Task #938 — the running server (server pool, session store, auth
 * helpers) must follow the SAME alias rules as the deploy-time
 * migration runner from Task #936. An operator who switched their
 * secret name from `DATABASE_URL_KOVEO` to `PRODUCTION_DATABASE_URL`
 * would otherwise get migrations applied to the right database, then
 * have the server quietly read the dev DB at boot — same silent-
 * divergence bug just one step later.
 *
 * These tests pin the new contract for `server/config/index.ts`:
 *
 *   - In production with only `PRODUCTION_DATABASE_URL` set, the
 *     resolved URL is the prod alias (not a fallback to DATABASE_URL).
 *   - In production with both prod aliases set to the same value the
 *     canonical wins and the alias is reported via `ignoredUrlSource`
 *     with `ignoredUrlSourceDiffers === false`.
 *   - In production with both prod aliases set to DIFFERENT values
 *     `ignoredUrlSourceDiffers` is `true` so the boot warning fires.
 *   - In production with neither prod alias set, loading the config
 *     module throws fail-fast — even when `DATABASE_URL` is set —
 *     so the deploy fails loudly instead of writing the dev DB.
 *   - Non-production behaviour (prefer `DATABASE_URL`) is unchanged.
 *
 * The config module reads `process.env` at import time, so each test
 * mutates the env, calls `jest.resetModules()` and re-`require()`s
 * the module. We also unmock the global `server/config/index` mock
 * from `jest.setup.ts` so we exercise the real resolver path.
 */
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';

const PROD_KOVEO = 'postgres://u:p@prod-koveo.example.com:5432/koveo';
const PROD_ALIAS = 'postgres://u:p@prod-alias.example.com:5432/koveo';
const DEV = 'postgres://u:p@dev.example.com:5432/koveo_dev';

// Snapshot env keys we mutate so we can fully restore between tests.
const ENV_KEYS = [
  'NODE_ENV',
  'DATABASE_URL',
  'DATABASE_URL_KOVEO',
  'PRODUCTION_DATABASE_URL',
  'SESSION_SECRET',
  'REPLIT_DEPLOYMENT',
] as const;

type EnvSnapshot = Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

function snapshotEnv(): EnvSnapshot {
  const out: EnvSnapshot = {};
  for (const k of ENV_KEYS) out[k] = process.env[k];
  return out;
}

function restoreEnv(snap: EnvSnapshot) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k] as string;
  }
}

function clearDbEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_URL_KOVEO;
  delete process.env.PRODUCTION_DATABASE_URL;
}

// SESSION_SECRET is required by the config schema; always set a
// long-enough fake one so the schema doesn't fail unrelated to DB
// resolution.
const TEST_SESSION_SECRET = 'x'.repeat(48);

function loadConfig() {
  jest.resetModules();
  // The global mock in jest.setup.ts replaces `server/config/index`
  // with a hand-rolled fake. We must un-mock it so this test exercises
  // the real boot-time resolver. We also have to force the .ts file:
  // a stale `server/config/index.js` file exists that Jest's default
  // moduleFileExtensions picks before `index.ts` (see the same
  // workaround in tests/integration/cross-organization-isolation.test.ts).
  jest.unmock('../../server/config/index');
  jest.unmock('../../server/config/index.ts');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(path.resolve(__dirname, '../../server/config/index.ts'));
}

describe('server config DB URL resolution (Task #938)', () => {
  let snap: EnvSnapshot;

  beforeEach(() => {
    snap = snapshotEnv();
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
    delete process.env.REPLIT_DEPLOYMENT;
  });

  afterEach(() => {
    restoreEnv(snap);
    jest.resetModules();
  });

  describe('production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('uses PRODUCTION_DATABASE_URL alone when it is the only prod var set', () => {
      clearDbEnv();
      process.env.PRODUCTION_DATABASE_URL = PROD_ALIAS;

      const { config } = loadConfig();

      expect(config.database.url).toBe(PROD_ALIAS);
      expect(config.database.urlSource).toBe('PRODUCTION_DATABASE_URL');
      expect(config.database.urlMasked).toBe(
        'prod-alias.example.com:5432/koveo',
      );
      expect(config.database.ignoredUrlSource).toBeUndefined();
      expect(config.database.ignoredUrlSourceDiffers).toBe(false);
    });

    it('prefers DATABASE_URL_KOVEO over PRODUCTION_DATABASE_URL when both match', () => {
      clearDbEnv();
      process.env.DATABASE_URL_KOVEO = PROD_KOVEO;
      process.env.PRODUCTION_DATABASE_URL = PROD_KOVEO;

      const { config } = loadConfig();

      expect(config.database.url).toBe(PROD_KOVEO);
      expect(config.database.urlSource).toBe('DATABASE_URL_KOVEO');
      expect(config.database.ignoredUrlSource).toBe('PRODUCTION_DATABASE_URL');
      expect(config.database.ignoredUrlSourceDiffers).toBe(false);
    });

    it('flags divergence when both prod aliases point at different databases', () => {
      clearDbEnv();
      process.env.DATABASE_URL_KOVEO = PROD_KOVEO;
      process.env.PRODUCTION_DATABASE_URL = PROD_ALIAS;

      const { config } = loadConfig();

      expect(config.database.url).toBe(PROD_KOVEO);
      expect(config.database.urlSource).toBe('DATABASE_URL_KOVEO');
      expect(config.database.ignoredUrlSource).toBe('PRODUCTION_DATABASE_URL');
      expect(config.database.ignoredUrlSourceDiffers).toBe(true);
    });

    it('refuses to fall back to DATABASE_URL when no prod var is set in production', () => {
      clearDbEnv();
      process.env.DATABASE_URL = DEV;

      expect(() => loadConfig()).toThrow(
        /Refusing to migrate the development database/,
      );
    });
  });

  describe('non-production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('uses DATABASE_URL in development even when prod aliases are set', () => {
      clearDbEnv();
      process.env.DATABASE_URL = DEV;
      process.env.DATABASE_URL_KOVEO = PROD_KOVEO;

      const { config } = loadConfig();

      expect(config.database.url).toBe(DEV);
      expect(config.database.urlSource).toBe('DATABASE_URL');
      expect(config.database.ignoredUrlSource).toBeUndefined();
    });

    it('falls back to PRODUCTION_DATABASE_URL when nothing else is set in dev', () => {
      clearDbEnv();
      process.env.PRODUCTION_DATABASE_URL = PROD_ALIAS;

      const { config } = loadConfig();

      expect(config.database.url).toBe(PROD_ALIAS);
      expect(config.database.urlSource).toBe('PRODUCTION_DATABASE_URL');
    });
  });

  describe('getRuntimeDatabaseUrl back-compat', () => {
    it('returns the prod URL when the request domain is koveo-gestion.com', () => {
      process.env.NODE_ENV = 'development';
      clearDbEnv();
      process.env.DATABASE_URL = DEV;
      process.env.PRODUCTION_DATABASE_URL = PROD_ALIAS;

      const { config } = loadConfig();

      expect(config.database.getRuntimeDatabaseUrl('koveo-gestion.com')).toBe(
        PROD_ALIAS,
      );
      expect(config.database.getRuntimeDatabaseUrl('localhost')).toBe(DEV);
    });

    it('keeps using DATABASE_URL_KOVEO for prod-domain requests when it is set', () => {
      process.env.NODE_ENV = 'development';
      clearDbEnv();
      process.env.DATABASE_URL = DEV;
      process.env.DATABASE_URL_KOVEO = PROD_KOVEO;

      const { config } = loadConfig();

      expect(config.database.getRuntimeDatabaseUrl('koveo-gestion.com')).toBe(
        PROD_KOVEO,
      );
    });
  });
});
