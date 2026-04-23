/**
 * @jest-environment node
 *
 * Task #470 — End-to-end smoke test that locks the lazy-mount contract for
 * the MCP server in `server/routes.ts`.
 *
 * Task #454 wired the MCP / OAuth-issuer prefixes through the lazy-mount
 * trampoline so the heavy MCP module graph (OAuth provider singleton,
 * SDK transports, tool registry) is only `import()`-ed on the first
 * request to a matching prefix. The existing helper-level smoke test in
 * `tests/unit/server/lazy-mount.test.ts` proves the trampoline itself
 * behaves correctly with a fake loader, but it does not catch a future
 * refactor that re-introduces an eager `await import('./mcp/index')`
 * inside `server/routes.ts` and silently regresses production boot cost.
 *
 * This test exercises the REAL `registerRoutes(app)` wiring and asserts:
 *
 *   1. After `registerRoutes` returns, the `server/mcp/index` module has
 *      NOT been pulled into Node's module cache (proves no eager import
 *      at the top of routes.ts and no eager call to the lazy loader
 *      inside `registerRoutes`).
 *   2. A request to a non-MCP path does not trigger the load either
 *      (proves the lazy-mount predicate isn't accidentally matching
 *      everything).
 *   3. A request to a real MCP/OAuth-issuer prefix — here
 *      `/.well-known/oauth-authorization-server` — DOES trigger the
 *      load (proves the trampoline is actually wired to that prefix).
 *
 * The test bypasses the `__mocks__/server/routes.ts` jest moduleNameMapper
 * by `require()`-ing the real source via its absolute path, which doesn't
 * match any of the mapper's anchored patterns.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import express, { type Express } from 'express';
import http from 'http';
import type { AddressInfo } from 'net';

// The MCP module graph pulls in `@neondatabase/serverless`, which expects a
// WebSocket constructor in Node. Match what the other integration suites do.
jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {},
}));

// `__mocks__/server/auth.ts` (auto-applied via jest.config.cjs's
// moduleNameMapper) doesn't export `setupAuthRoutes` or `sessionConfig`,
// which routes.ts wires into the express app at the top of registerRoutes.
// Provide just-enough stubs so the function can run end-to-end without
// pulling the real session/passport stack into the test process.
jest.mock('../../server/auth', () => {
  const actual = jest.requireActual('../../server/auth');
  const noop = (_req: any, _res: any, next: any) => next();
  return {
    ...actual,
    sessionConfig: noop,
    setupAuthRoutes: () => {},
  };
});

const ROUTES_ABS_PATH = path.resolve(__dirname, '../../server/routes.ts');

/**
 * True iff Node's CJS module cache contains an entry for
 * `server/mcp/index.{ts,js}`. ts-jest keys the cache by the on-disk source
 * path, so the `.ts` suffix is what we'll see in test runs; we accept `.js`
 * too in case the suite is ever executed against a pre-built artifact.
 */
function isMcpIndexLoaded(): boolean {
  return Object.keys(require.cache).some((key) => {
    const norm = key.replace(/\\/g, '/');
    return (
      norm.endsWith('/server/mcp/index.ts') ||
      norm.endsWith('/server/mcp/index.js')
    );
  });
}

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

function listen(app: Express): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

function get(url: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      // Drain so the socket can close cleanly.
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
    });
    req.on('error', reject);
  });
}

describe('MCP server stays unloaded until a real MCP request arrives', () => {
  const previousEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    // Snapshot so we can restore in afterAll — leaking these to other
    // suites in the same worker would silently change their behavior.
    previousEnv.ENABLE_MCP_SERVER = process.env.ENABLE_MCP_SERVER;
    previousEnv.MCP_OAUTH_ISSUER = process.env.MCP_OAUTH_ISSUER;

    // The lazy MCP block in routes.ts is gated on this flag in
    // non-development environments. Force-enable so the lazyMount calls
    // are actually registered regardless of NODE_ENV in CI.
    process.env.ENABLE_MCP_SERVER = 'true';
    // `resolveIssuerOrigin()` throws in production without this; setting
    // it unconditionally is harmless and keeps the test environment-agnostic.
    process.env.MCP_OAUTH_ISSUER ||= 'http://localhost:5000';
  });

  afterAll(() => {
    for (const key of Object.keys(previousEnv)) {
      const prev = previousEnv[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it(
    'only imports server/mcp/index after the first matching request',
    async () => {
      // Defensive: make sure no earlier suite in the same worker pulled in
      // the MCP module graph. If it did, evict it so we measure THIS run.
      for (const key of Object.keys(require.cache)) {
        const norm = key.replace(/\\/g, '/');
        if (
          norm.endsWith('/server/mcp/index.ts') ||
          norm.endsWith('/server/mcp/index.js')
        ) {
          delete require.cache[key];
        }
      }
      expect(isMcpIndexLoaded()).toBe(false);

      // Bypass the `__mocks__/server/routes.ts` moduleNameMapper by
      // requiring the real source via its absolute on-disk path — none of
      // the mapper's anchored patterns (`^../../server/routes$`, etc.)
      // match an absolute path with a `.ts` suffix.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const realRoutes = require(ROUTES_ABS_PATH) as {
        registerRoutes: (app: Express) => Promise<unknown>;
      };

      const app = express();
      app.use(express.json());
      await realRoutes.registerRoutes(app);

      // Yield to flush any microtasks the registrars scheduled.
      await new Promise((r) => setImmediate(r));

      // Contract #1: registerRoutes itself must NOT have triggered the
      // MCP module load. If a future refactor adds an eager
      // `await import('./mcp/index')` (or hoists `loadMcpModule()` out of
      // its lazy closure) this assertion fails.
      expect(isMcpIndexLoaded()).toBe(false);

      const server = await listen(app);
      try {
        // Contract #2: a non-MCP request must not pull MCP in either —
        // proves the lazy-mount predicate is properly scoped to MCP /
        // OAuth-issuer prefixes only.
        await get(`${server.url}/api/__definitely_not_a_real_endpoint__`);
        expect(isMcpIndexLoaded()).toBe(false);

        // Contract #3: hitting a real MCP-prefix path triggers the load.
        // `/.well-known/oauth-authorization-server` is one of the prefixes
        // wired up in the pre-session lazyMount block in routes.ts.
        await get(`${server.url}/.well-known/oauth-authorization-server`);
        expect(isMcpIndexLoaded()).toBe(true);
      } finally {
        await server.close();
      }
    },
    30_000,
  );
});
