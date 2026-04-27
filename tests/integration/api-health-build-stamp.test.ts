/**
 * @jest-environment node
 */
// @ts-nocheck — Same pre-existing pattern shared with the staging-disk-usage
// integration test (see TYPE_CHECK_DEBT.md, task #769).
/**
 * Task #1539 — pin the `/api/health` contract for the `buildSha` and
 * `buildTime` fields so the W32 fix (Pass #20) cannot silently regress.
 *
 * The test wires the same `createApiHealthHandler()` factory the production
 * server uses onto a tiny isolated Express app and asserts that:
 *   - `buildSha` is present and non-empty
 *   - `buildSha` matches a hex SHA pattern (7–40 chars) when supplied via
 *     the stamp file path (the same path the real build exercises at runtime)
 *   - `buildTime` is present and parses as a valid ISO 8601 date
 *   - All pre-existing top-level fields are still serialized
 *
 * The `fs` module is mocked (same pattern as `server/tests/mcp-tools.test.ts`)
 * so the test controls the stamp file content without touching the real
 * `dist/build-info.json` written by the CI build.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../../server/db', () => ({
  db: {
    execute: async () => ({ rows: [{ cross_org_demands: 0 }] }),
  },
}));

type StampFile = { buildSha?: string; buildTime?: string } | null;
let stampFile: StampFile = null;

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    readFileSync: (path: string, encoding?: unknown) => {
      if (typeof path === 'string' && path.endsWith('build-info.json')) {
        if (stampFile) {
          return JSON.stringify(stampFile);
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return actual.readFileSync(path, encoding as never);
    },
  };
});

const ENV_KEYS = ['BUILD_SHA', 'BUILD_TIME'] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  stampFile = null;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = savedEnv[k];
    }
  }
  jest.resetModules();
});

async function buildApp() {
  let createApiHealthHandler: any;
  await jest.isolateModulesAsync(async () => {
    ({ createApiHealthHandler } = require('../../server/api/health-handler'));
  });
  const app = express();
  app.get('/api/health', createApiHealthHandler({ port: 5000, host: '0.0.0.0' }));
  return app;
}

describe('Task #1539 — /api/health surfaces buildSha and buildTime', () => {
  it('returns buildSha matching a hex SHA pattern when a stamp file is present', async () => {
    stampFile = { buildSha: 'a1b2c3d', buildTime: '2026-04-27T00:00:00.000Z' };

    const app = await buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);

    expect(typeof res.body.buildSha).toBe('string');
    expect(res.body.buildSha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(res.body.buildSha).toBe('a1b2c3d');
  });

  it('returns buildTime that parses as a valid ISO 8601 date when a stamp file is present', async () => {
    stampFile = { buildSha: 'deadbeef', buildTime: '2026-04-27T12:34:56.000Z' };

    const app = await buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);

    expect(typeof res.body.buildTime).toBe('string');
    const parsed = new Date(res.body.buildTime);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe('2026-04-27T12:34:56.000Z');
  });

  it('falls back to BUILD_SHA env var and returns a non-empty buildSha when no stamp file exists', async () => {
    process.env.BUILD_SHA = 'envsha123';
    process.env.BUILD_TIME = '2026-04-01T00:00:00.000Z';

    const app = await buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);

    expect(typeof res.body.buildSha).toBe('string');
    expect(res.body.buildSha).toBe('envsha123');
    expect(res.body.buildTime).toBe('2026-04-01T00:00:00.000Z');
  });

  it('always returns a non-empty buildTime that is a valid ISO date even with no stamp or env', async () => {
    const app = await buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);

    expect(typeof res.body.buildTime).toBe('string');
    const parsed = new Date(res.body.buildTime);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('never returns buildSha="unknown" when a valid stamp file is present (nominal production path)', async () => {
    stampFile = { buildSha: 'cafebabe1', buildTime: '2026-04-25T00:00:00.000Z' };

    const app = await buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);

    expect(res.body.buildSha).toBe('cafebabe1');
    expect(res.body.buildSha).not.toBe('unknown');
  });

  it('still serializes all pre-existing top-level fields', async () => {
    stampFile = { buildSha: 'abc1234', buildTime: '2026-04-27T00:00:00.000Z' };

    const app = await buildApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.environment).toBe('string');
    expect(res.body.port).toBe(5000);
    expect(res.body.host).toBe('0.0.0.0');
  });
});
