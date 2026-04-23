/**
 * @jest-environment node
 *
 * Task #470 + Task #475 — End-to-end smoke test that locks the lazy-mount
 * contract for the MCP server in `server/routes.ts`.
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
 * `server/routes.ts` lazy-mounts the MCP module from TWO different
 * blocks that share the SAME memoized `loadMcpModule` closure:
 *
 *   - Pre-session: the MCP transport endpoints + the SDK's OAuth-issuer
 *     routes (`/mcp`, `/.well-known/oauth-authorization-server`, ...).
 *   - Post-session: the user-facing OAuth consent UI (`/oauth/consent`),
 *     mounted AFTER `sessionConfig` because it reads the Koveo session.
 *
 * This test exercises the REAL `registerRoutes(app)` wiring twice — one
 * `it()` per prefix block — to lock both lazy mounts independently. A
 * future refactor that hoists either loader out of its `lazyMount`
 * closure, or replaces the dynamic import with a static
 * `import './mcp/...'`, fails one or both `it()` blocks.
 *
 * Two independent load signals are used because they suit different
 * scenarios:
 *
 *   - Pre-session scenario: snapshot Node's `require.cache` for
 *     `server/mcp/index`. This works because the test runs FIRST in
 *     declaration order, so the cache is clean and the dynamic
 *     `import('./mcp/index')` is what populates it.
 *
 *   - Post-session (consent UI) scenario: count the `[lazy-mount]
 *     route module loaded` log line that `server/utils/lazy-mount.ts`
 *     emits whenever a lazy loader resolves SUCCESSFULLY. The
 *     `require.cache` signal would be unreliable here because the
 *     pre-session scenario has already pulled `server/mcp/index` in
 *     and Jest's module registry intercepts `delete require.cache[...]`.
 *     The consent registrar (`registerOAuthConsentRoutes`) doesn't call
 *     `seedMcpData`, so the log line is reliably emitted on success.
 *
 * The test bypasses the `__mocks__/server/routes.ts` jest moduleNameMapper
 * by `require()`-ing the real source via its absolute path, which doesn't
 * match any of the mapper's anchored patterns.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
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

/**
 * Build a fresh Express app wired with the REAL `registerRoutes`. The
 * `__mocks__/server/routes.ts` moduleNameMapper is bypassed by
 * importing the real source via its absolute on-disk path — none of the
 * mapper's anchored patterns (`^../../server/routes$`, etc.) match an
 * absolute path with a `.ts` suffix.
 */
async function buildAppWithRealRoutes(): Promise<Express> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const realRoutes = require(ROUTES_ABS_PATH) as {
    registerRoutes: (app: Express) => Promise<unknown>;
  };

  const app = express();
  app.use(express.json());
  await realRoutes.registerRoutes(app);

  // Yield to flush any microtasks the registrars scheduled.
  await new Promise((r) => setImmediate(r));

  return app;
}

/**
 * Spy on `console.log` and count the `[lazy-mount] route module loaded`
 * lines that `server/utils/lazy-mount.ts` writes whenever a `lazyMount`
 * loader resolves successfully. Returns a counter handle that the
 * caller can read and restore.
 */
function installLazyMountLoadCounter(): {
  getCount: () => number;
  restore: () => void;
} {
  let count = 0;
  const spy = jest
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        first.includes('[lazy-mount] route module loaded')
      ) {
        count += 1;
      }
    });
  return {
    getCount: () => count,
    restore: () => spy.mockRestore(),
  };
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
    'a pre-session MCP/OAuth-issuer prefix triggers the load on its own',
    async () => {
      // Defensive: make sure no earlier suite in the same worker pulled
      // in the MCP module graph. If it did, evict it so we measure THIS
      // run.
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

      const app = await buildAppWithRealRoutes();

      // Contract #1: registerRoutes itself must NOT have triggered the
      // MCP module load. If a future refactor adds an eager
      // `await import('./mcp/index')` (or hoists `loadMcpModule()` out
      // of either lazy closure) this assertion fails.
      expect(isMcpIndexLoaded()).toBe(false);

      const server = await listen(app);
      try {
        // Contract #2: a non-MCP request must not pull MCP in either —
        // proves the lazy-mount predicate is properly scoped to MCP /
        // OAuth-issuer prefixes only.
        await get(`${server.url}/api/__definitely_not_a_real_endpoint__`);
        expect(isMcpIndexLoaded()).toBe(false);

        // Contract #3: hitting a real pre-session MCP-prefix path
        // triggers the load. `/.well-known/oauth-authorization-server`
        // is one of the prefixes wired up in the pre-session lazyMount
        // block in routes.ts.
        await get(`${server.url}/.well-known/oauth-authorization-server`);
        expect(isMcpIndexLoaded()).toBe(true);
      } finally {
        await server.close();
      }
    },
    30_000,
  );

  it(
    'a /oauth/consent request triggers the load on its own (post-session lazyMount stays lazy)',
    async () => {
      // Task #475 regression guard: prove the post-session
      // `lazyMount(app, '/oauth/consent', ...)` loader fires on its
      // own when the user-agent hits the consent UI — independent of
      // the pre-session block. We can't reuse the `require.cache`
      // signal here because the previous `it()` block has already
      // pulled `server/mcp/index` into the cache and Jest's runtime
      // intercepts `delete require.cache[...]` so we can't reset it.
      //
      // Instead, count the `[lazy-mount] route module loaded` log
      // line that `lazy-mount.ts` writes on a successful loader
      // resolve. `registerOAuthConsentRoutes` doesn't call
      // `seedMcpData`, so the log line is reliably emitted on the
      // happy path. A FRESH `registerRoutes(app)` call gives the
      // post-session `lazyMount` a brand-new closure with `loaded =
      // false`, so the loader has to fire again on the consent hit
      // — and the spy attributes that fire to THIS request.
      //
      // If a future refactor hoists the consent-UI loader out of its
      // `lazyMount(app, '/oauth/consent', ...)` closure, splits the
      // consent UI onto its own non-lazy `import './mcp/...'`, or
      // somehow couples the consent load to a pre-session prefix
      // hit, the counter expectation flips and this fails.
      const app = await buildAppWithRealRoutes();

      // Install the counter AFTER routes are registered so the
      // pre-session lazyMount's earlier load (from the previous
      // `it()` block, if any) is excluded from the count, and the
      // counter starts at zero relative to THIS scenario's request.
      const counter = installLazyMountLoadCounter();
      try {
        // Contract: even after `registerRoutes` returns, no new
        // lazy-mount load has happened just by virtue of this app
        // being built — the post-session `lazyMount` must not have
        // eagerly resolved its loader.
        expect(counter.getCount()).toBe(0);

        const server = await listen(app);
        try {
          // The consent UI registers `/oauth/consent/...` routes
          // (start, approve, deny). We don't care about the response
          // status — even a 4xx proves the trampoline ran the loader
          // and registered the consent router. We assert on the
          // load-signal side effect, not on response body.
          await get(`${server.url}/oauth/consent/start`);
          expect(counter.getCount()).toBe(1);
        } finally {
          await server.close();
        }
      } finally {
        counter.restore();
      }
    },
    30_000,
  );
});
