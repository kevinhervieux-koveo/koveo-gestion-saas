/**
 * @jest-environment node
 *
 * Regression tests for the MCP lazy-mount wiring in `server/routes.ts`.
 *
 * Task #452 made the MCP module load on first request instead of at boot.
 * These tests pin that contract by booting the **real** `registerRoutes`
 * with `ENABLE_MCP_SERVER=true` and asserting:
 *
 *  1. `../mcp/index` is NOT materialised at boot (load counter stays at 0
 *     and the canonical `[MCP SEED]` / `[MCP] OAuth-protected MCP server
 *     registered` log lines do not appear).
 *  2. The first hit to a matched MCP-OAuth path triggers exactly one
 *     module load and runs the registrar.
 *  3. The first hit to `/oauth/consent` lazy-loads the consent registrar
 *     post-session-middleware (so `req.session` is defined inside it).
 *
 * If a future top-level `import './mcp/index'` (or other accidental eager
 * reference) sneaks into the boot path, assertion (1) fails and CI catches
 * the regression that would otherwise silently undo the cold-start memory
 * savings.
 *
 * The real `server/routes.ts` is reached by importing it via an absolute
 * filesystem path — that bypasses the `moduleNameMapper` rule that would
 * otherwise rewrite `../routes` to the manual mock at
 * `__mocks__/server/routes.ts`. Heavy peer modules (`./auth`, `./storage`,
 * `./db`) are still satisfied by the existing manual mocks via the mapper,
 * so this test does not need a real database.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import path from 'path';
import type { Express } from 'express';

// --- MCP module mock with import-time load counter ---------------------------
//
// jest.mock factories execute the FIRST time the module is materialised.
// We use that fact to count actual module loads — this is the import-time
// signal the regression test cares about. Anything that incidentally re-
// imports `../mcp/index` at boot will flip `mcpIndexLoadCount` from 0 to 1
// before any request is sent, failing the boot-time assertions below.
let mcpIndexLoadCount = 0;
let registerMcpRoutesCallCount = 0;
let registerOAuthConsentRoutesCallCount = 0;

jest.mock('../mcp/index', () => {
  mcpIndexLoadCount += 1;
  return {
    registerMcpRoutes: jest.fn(async (app: Express) => {
      registerMcpRoutesCallCount += 1;
      // Mirror the real module's log lines so a future code change that
      // mutates the strings is visible from these tests.
      console.log('[MCP SEED] (mock) sandbox seed step');
      console.log('[MCP] OAuth-protected MCP server registered at /mcp (mock)');
      app.get('/.well-known/oauth-authorization-server', (_req, res) => {
        res.json({ ok: true });
      });
      app.get('/.well-known/oauth-protected-resource', (_req, res) => {
        res.json({ ok: true });
      });
      app.post('/mcp', (_req, res) => res.status(401).end());
    }),
    registerOAuthConsentRoutes: jest.fn((app: Express) => {
      registerOAuthConsentRoutesCallCount += 1;
      console.log('[MCP CONSENT] (mock) consent routes registered');
      app.get('/oauth/consent', (req: any, res) => {
        res.json({ sessionVisible: !!req.session });
      });
    }),
    koveoMcpOAuthProvider: {},
  };
});

// MCP seeding never runs in this suite — the mock above replaces
// `registerMcpRoutes` entirely — but stub it just in case anything else
// pulls it in.
jest.mock('../mcp/seed-mcp-data', () => ({ seedMcpData: jest.fn() }));

describe('MCP lazy mount via real registerRoutes (regression for task #452)', () => {
  let app: Express;
  let agent: import('supertest').Agent;
  // Direct console.log replacement (NOT via jest.spyOn) so the global
  // `restoreMocks: true` in jest.config doesn't reset it between tests.
  const originalLog = console.log;
  const allLogged: string[] = [];
  let bootLoggedSnapshot: string[] = [];
  const ORIGINAL_ENABLE = process.env.ENABLE_MCP_SERVER;

  beforeAll(async () => {
    process.env.ENABLE_MCP_SERVER = 'true';

    const express = (await import('express')).default;
    const supertest = (await import('supertest')).default;

    // Bypass the `^\.\./routes(?:\.ts)?$` moduleNameMapper rule by importing
    // the real file via its absolute path. moduleNameMapper rules only fire
    // on relative/aliased import strings — an absolute path is left alone.
    const realRoutesPath = path.resolve(__dirname, '..', 'routes.ts');

    // Install a permanent console.log replacement that mirrors output to
    // the real stream (so jest's reporter still shows logs) AND records
    // every line into `allLogged` for later inspection.
    console.log = (...args: unknown[]) => {
      allLogged.push(args.map((a) => String(a)).join(' '));
      // Don't echo to the real console — keeps test output readable. If
      // debugging, swap this for `originalLog.apply(console, args as any)`.
    };

    // Sanity: BEFORE we even import routes.ts, the MCP module must not
    // have been pulled in by anything else this suite touched.
    expect(mcpIndexLoadCount).toBe(0);

    const routes = (await import(realRoutesPath)) as {
      registerRoutes: (app: Express) => Promise<void>;
    };

    app = express();
    app.use(express.json());
    await routes.registerRoutes(app);
    // Snapshot what's been logged STRICTLY through the boot path. Any
    // request-induced log will land in `allLogged` only AFTER this point.
    bootLoggedSnapshot = [...allLogged];
    agent = supertest(app) as unknown as import('supertest').Agent;
  });

  afterAll(() => {
    console.log = originalLog;
    if (ORIGINAL_ENABLE === undefined) delete process.env.ENABLE_MCP_SERVER;
    else process.env.ENABLE_MCP_SERVER = ORIGINAL_ENABLE;
  });

  function bootHasLog(needle: string): boolean {
    return bootLoggedSnapshot.some((line) => line.includes(needle));
  }
  function anyHasLog(needle: string): boolean {
    return allLogged.some((line) => line.includes(needle));
  }

  it('does not load ./mcp/index at boot (the core regression guard)', () => {
    // The most important assertion in the file: real registerRoutes ran to
    // completion with ENABLE_MCP_SERVER=true, and the MCP module factory
    // has STILL not been materialised. If a future top-level import or
    // other eager reference re-introduces the cold-start cost, this flips
    // to 1 and the test fails.
    expect(mcpIndexLoadCount).toBe(0);
    expect(registerMcpRoutesCallCount).toBe(0);
    expect(registerOAuthConsentRoutesCallCount).toBe(0);
    expect(bootHasLog('[MCP SEED]')).toBe(false);
    expect(bootHasLog('[MCP] OAuth-protected MCP server registered')).toBe(false);
    expect(bootHasLog('[lazy-mount] route module loaded')).toBe(false);
  });

  it('loads the MCP module exactly once on the first matching request', async () => {
    expect(mcpIndexLoadCount).toBe(0);

    // Fire two parallel requests — `lazyMount` shares the loader promise,
    // so even a burst of first-hit requests must trigger exactly one
    // module materialisation and one registrar call.
    const [r1, r2] = await Promise.all([
      agent.get('/.well-known/oauth-authorization-server'),
      agent.get('/.well-known/oauth-authorization-server'),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    expect(mcpIndexLoadCount).toBe(1);
    expect(registerMcpRoutesCallCount).toBe(1);
    expect(anyHasLog('[MCP SEED]')).toBe(true);
    expect(anyHasLog('[MCP] OAuth-protected MCP server registered')).toBe(true);
    expect(anyHasLog('[lazy-mount] route module loaded')).toBe(true);

    // A non-matching request must NOT re-trigger the loader.
    const before = mcpIndexLoadCount;
    await agent.get('/api/something-unrelated');
    expect(mcpIndexLoadCount).toBe(before);
  });

  it('loads the /oauth/consent registrar lazily AND post-session', async () => {
    // The consent registrar uses the SAME shared `loadMcpModule()` promise
    // in routes.ts, so by the time this test runs the module has already
    // been materialised by the previous test. What matters here is that
    // `registerOAuthConsentRoutes` itself was NOT executed at boot and is
    // executed exactly once on the first /oauth/consent hit, with
    // session middleware visible inside the handler.
    expect(registerOAuthConsentRoutesCallCount).toBe(0);

    const res = await agent.get('/oauth/consent');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sessionVisible: true });

    expect(registerOAuthConsentRoutesCallCount).toBe(1);
    expect(anyHasLog('[MCP CONSENT]')).toBe(true);
  });
});
