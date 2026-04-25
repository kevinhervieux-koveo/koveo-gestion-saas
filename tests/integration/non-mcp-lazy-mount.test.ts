/**
 * @jest-environment node
 *
 * Task #478 — Locks the lazy-mount contract for the SEVEN non-MCP heavy
 * route modules in `server/routes.ts`:
 *
 *   - /api/documents          → ./api/documents          (registerDocumentRoutes)
 *   - /api/bills (+ regex)    → ./api/bills              (registerBillRoutes)
 *   - /api/communication      → ./api/communication      (registerCommunicationRoutes)
 *   - /api/maintenance        → ./api/maintenance        (registerMaintenanceRoutes)
 *   - /api/demo               → ./api/demo-management    (registerDemoManagementRoutes)
 *   - /api/ai                 → ./api/ai-document-analysis (registerAiAnalysisRoutes)
 *   - /api/admin/bulk-import  → ./api/bulk-import        (registerBulkImportRoutes)
 *
 * Task #475 / `tests/integration/mcp-lazy-mount.test.ts` already locks the
 * lazy-mount contract for the two MCP-related blocks. Without a sibling
 * test for these other seven, a future refactor that turns one of those
 * loaders into a top-level `import './api/documents'` (or hoists the
 * `register*Routes` call out of its `lazyMount` closure) would silently
 * re-introduce production boot cost — they've been lazy since they were
 * added precisely because they pull in heavy service-layer dependencies
 * (AI helpers, validators, cache stores, etc.).
 *
 * The suite has two halves:
 *
 *   - Static half: parse `server/routes.ts` as text and assert
 *       1. there is no top-level `import ... from './api/<modPath>'`, and
 *       2. the module's `register*Routes` symbol appears EXACTLY ONCE in
 *          the file, and that occurrence is inside the
 *          `(await import('./api/<modPath>')).register*Routes` loader of
 *          the corresponding `lazyMount(...)` block.
 *     A future hoist of either the `import` or the `register*Routes`
 *     reference out of its lazy closure flips one of these assertions.
 *
 *   - Behavioral half: boot the REAL `registerRoutes` and probe a single
 *     prefix (`/api/documents/__probe__`). Asserts that
 *       a) exactly ONE `[lazy-mount] route module loaded` log line fires
 *          (so only ONE of the seven lazy mounts ran its loader), and
 *       b) `server/api/documents` ends up in Node's module cache, while
 *          the OTHER six lazy modules do not.
 *     Together these prove the matchers are properly scoped: traffic to
 *     one prefix can't drag the other six modules into the process.
 *
 * Implementation notes — mirrored from the MCP sibling test:
 *
 *   - The `__mocks__/server/routes.ts` jest moduleNameMapper is bypassed
 *     by `require()`-ing the real source via its absolute on-disk path.
 *   - `ws` is mocked because `@neondatabase/serverless` (pulled in by
 *     several of the lazy modules' transitive deps) expects a WebSocket
 *     constructor in Node.
 *   - `server/auth` is partially mocked so `sessionConfig` and
 *     `setupAuthRoutes` no-op without dragging the real session/passport
 *     stack into the test process.
 */

import { describe, it, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import express, { type Express } from 'express';
import http from 'http';
import type { AddressInfo } from 'net';

jest.mock('ws', () => ({
  __esModule: true,
  default: class MockWebSocket {},
}));

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
const ROUTES_SOURCE = fs.readFileSync(ROUTES_ABS_PATH, 'utf8');

/**
 * Catalogue of every NON-MCP lazy-mount block in `server/routes.ts`.
 *
 * `modPath` is the relative specifier passed to the dynamic `import(...)`
 * call inside the loader (without the `./` prefix). `registrar` is the
 * named export the loader returns. `probePath` is a request path that
 * matches the lazy mount's matcher; it doesn't need to be a real route on
 * the underlying router — the `lazyMount` trampoline fires the loader on
 * any matching path before delegating to the (possibly empty) router.
 *
 * `cacheSuffixes` lists the on-disk path suffixes used to detect whether
 * the module was loaded into Node's CJS cache. ts-jest keys the cache by
 * the on-disk source path, so the `.ts` suffix is what we'll typically
 * see; we accept `.js` too in case the suite is ever executed against a
 * pre-built artifact.
 */
const LAZY_MODULES = [
  {
    name: 'documents',
    modPath: 'api/documents',
    registrar: 'registerDocumentRoutes',
    probePath: '/api/documents/__probe__',
  },
  {
    name: 'bills',
    modPath: 'api/bills',
    registrar: 'registerBillRoutes',
    probePath: '/api/bills/__probe__',
  },
  {
    name: 'communication',
    modPath: 'api/communication',
    registrar: 'registerCommunicationRoutes',
    probePath: '/api/communication/__probe__',
  },
  {
    name: 'maintenance',
    modPath: 'api/maintenance',
    registrar: 'registerMaintenanceRoutes',
    probePath: '/api/maintenance/__probe__',
  },
  {
    name: 'demo-management',
    modPath: 'api/demo-management',
    registrar: 'registerDemoManagementRoutes',
    probePath: '/api/demo/__probe__',
  },
  {
    name: 'ai-document-analysis',
    modPath: 'api/ai-document-analysis',
    registrar: 'registerAiAnalysisRoutes',
    probePath: '/api/ai/__probe__',
  },
  {
    name: 'bulk-import',
    modPath: 'api/bulk-import',
    registrar: 'registerBulkImportRoutes',
    probePath: '/api/admin/bulk-import/__probe__',
  },
] as const;

type LazyModule = (typeof LAZY_MODULES)[number];

function cacheSuffixesFor(mod: LazyModule): string[] {
  return [`/server/${mod.modPath}.ts`, `/server/${mod.modPath}.js`];
}

function isModuleLoaded(mod: LazyModule): boolean {
  const suffixes = cacheSuffixesFor(mod);
  return Object.keys(require.cache).some((key) => {
    const norm = key.replace(/\\/g, '/');
    return suffixes.some((s) => norm.endsWith(s));
  });
}

function evictModuleFromCache(mod: LazyModule): void {
  const suffixes = cacheSuffixesFor(mod);
  for (const key of Object.keys(require.cache)) {
    const norm = key.replace(/\\/g, '/');
    if (suffixes.some((s) => norm.endsWith(s))) {
      delete require.cache[key];
    }
  }
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
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
    });
    req.on('error', reject);
  });
}

async function buildAppWithRealRoutes(): Promise<Express> {
  const realRoutes = require(ROUTES_ABS_PATH) as {
    registerRoutes: (app: Express) => Promise<unknown>;
  };
  const app = express();
  app.use(express.json());
  await realRoutes.registerRoutes(app);
  await new Promise((r) => setImmediate(r));
  return app;
}

/**
 * Spy on `console.log` and count `[lazy-mount] route module loaded` lines
 * — the marker `server/utils/lazy-mount.ts` writes whenever a `lazyMount`
 * loader resolves successfully. One line === one lazy module's loader
 * fired. Returns a counter handle the caller can read and restore.
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

describe('Non-MCP lazy-mount contract in server/routes.ts (Task #478)', () => {
  describe('Static source contract — locks the import + registrar shape per block', () => {
    test.each(LAZY_MODULES.map((m) => [m.name, m] as const))(
      '%s: no top-level static `import ... from "./%s"` in routes.ts',
      (_name, mod) => {
        // A future refactor that hoists the loader to a top-level
        // `import` (e.g. `import { registerDocumentRoutes } from
        // './api/documents'`) would re-introduce production boot cost.
        // We assert by string-matching the relative specifier inside
        // single OR double quotes, so the phrasing of the import line
        // doesn't matter as long as nobody adds one.
        const sq = `from './${mod.modPath}'`;
        const dq = `from "./${mod.modPath}"`;
        expect(ROUTES_SOURCE.includes(sq)).toBe(false);
        expect(ROUTES_SOURCE.includes(dq)).toBe(false);
      },
    );

    test.each(LAZY_MODULES.map((m) => [m.name, m] as const))(
      '%s: registrar symbol is referenced ONLY inside the matching lazyMount loader',
      (_name, mod) => {
        // The expected shape of the loader as it appears in routes.ts:
        //   (await import('./api/<modPath>')).register*Routes
        // We require that the registrar symbol appears exactly once in
        // the source AND that the single occurrence is part of that
        // dynamic-import-and-property-access expression. Anything else
        // (a top-level `import { registerDocumentRoutes }`, a stray
        // direct call outside the lazy closure, etc.) trips this.
        const occurrences = ROUTES_SOURCE.split(mod.registrar).length - 1;
        expect(occurrences).toBe(1);

        const expectedExpr = `(await import('./${mod.modPath}')).${mod.registrar}`;
        expect(ROUTES_SOURCE.includes(expectedExpr)).toBe(true);
      },
    );
  });

  describe('Behavioral fixture — a request to one prefix does not pull in the other six', () => {
    const previousEnv: Record<string, string | undefined> = {};

    beforeAll(() => {
      // The mcp-lazy-mount sibling test enables MCP via these env vars; if
      // it ran first in the same worker its `afterAll` restores them, but
      // be defensive — we don't care whether MCP is on or off for THIS
      // suite. We do want to leave the env unchanged on the way out.
      previousEnv.ENABLE_MCP_SERVER = process.env.ENABLE_MCP_SERVER;
      // Force OFF so registerRoutes doesn't even register the MCP lazy
      // mounts; they're irrelevant to this contract and skipping them
      // keeps the load-counter signal clean.
      process.env.ENABLE_MCP_SERVER = 'false';
    });

    afterAll(() => {
      for (const key of Object.keys(previousEnv)) {
        const prev = previousEnv[key];
        if (prev === undefined) delete process.env[key];
        else process.env[key] = prev;
      }
    });

    it(
      'hitting /api/documents fires exactly one lazy-mount load and only loads the documents module',
      async () => {
        const target = LAZY_MODULES.find((m) => m.name === 'documents')!;
        const others = LAZY_MODULES.filter((m) => m.name !== 'documents');

        // Defensive: evict any stale cache entries another suite in the
        // same worker may have populated. We need a clean baseline so
        // post-request cache state is attributable to THIS request.
        for (const mod of LAZY_MODULES) evictModuleFromCache(mod);

        const app = await buildAppWithRealRoutes();

        // Contract #1: `registerRoutes` itself must NOT have triggered
        // ANY of the seven lazy-loaded modules. If a future refactor
        // adds an eager `await import('./api/documents')` (or hoists
        // any `register*Routes` out of its lazy closure) this fails.
        for (const mod of LAZY_MODULES) {
          expect(isModuleLoaded(mod)).toBe(false);
        }

        // Install the load-line counter AFTER routes are registered so
        // it starts at zero relative to the upcoming request.
        const counter = installLazyMountLoadCounter();
        const server = await listen(app);
        try {
          // Sanity: counter starts at zero — the trampoline has not
          // resolved any loader yet.
          expect(counter.getCount()).toBe(0);

          // Probe the targeted prefix. We don't care about the response
          // status — even a 404 from the underlying router proves the
          // trampoline ran the loader and registered the documents
          // router. We assert on side effects (counter + module cache).
          await get(`${server.url}${target.probePath}`);

          // Contract #2: EXACTLY one lazy-mount loader fired. Any other
          // matcher accidentally matching `/api/documents/...` (e.g. a
          // future refactor that broadens a sibling matcher) bumps this
          // above 1. A regression that loads the module eagerly during
          // `registerRoutes` makes the loader skip its log line on the
          // request path and drops this to 0.
          expect(counter.getCount()).toBe(1);

          // Contract #3: the targeted module IS now in the module cache.
          expect(isModuleLoaded(target)).toBe(true);

          // Contract #4: NONE of the other six modules entered the
          // cache as a side effect. This is the matcher-scoping half of
          // the contract — proves a `/api/documents` hit can't drag in
          // bills, communication, maintenance, demo-management,
          // ai-document-analysis, or bulk-import.
          for (const mod of others) {
            expect({ name: mod.name, loaded: isModuleLoaded(mod) }).toEqual({
              name: mod.name,
              loaded: false,
            });
          }
        } finally {
          await server.close();
          counter.restore();
        }
      },
      30_000,
    );
  });
});
