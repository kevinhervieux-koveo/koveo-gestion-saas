/**
 * @jest-environment node
 *
 * Task #471 — Lock the lazy-mount contract for the seven NON-MCP heavy
 * route modules wired into `server/routes.ts`:
 *
 *   /api/documents, /api/bills (+ /api/buildings/:id/bills/*),
 *   /api/communication, /api/maintenance, /api/demo, /api/ai,
 *   /api/admin/bulk-import.
 *
 * Each one pulls in expensive service-layer deps (AI helpers, validators,
 * cache stores). Task #458 added a MCP-only smoke test; this suite mirrors
 * that pattern for the other seven mounts so a future top-level
 * `import` (or an accidental eager call to one of the loaders) regresses
 * cold-start memory loudly instead of silently.
 *
 * Strategy:
 *   - Reuse the REAL `lazyMount` helper from `server/utils/lazy-mount.ts`.
 *   - Reuse the REAL matcher + loader values via the `HEAVY_LAZY_MOUNTS`
 *     export from `server/routes.ts` — no copy-paste of strings or regex
 *     between this test and the production wiring.
 *   - Wrap each real loader in a `jest.fn` spy BEFORE registering it. The
 *     spies short-circuit to a no-op registrar so the test never actually
 *     pulls the heavy module graphs into the worker's module cache; we're
 *     only verifying the trampoline's invocation behavior, which is what
 *     the production-hot-path contract depends on.
 *
 * The three contracts asserted, parameterized over every mount:
 *   1. After all `lazyMount(...)` calls, NO loader has been invoked
 *      (no boot-time import).
 *   2. A request whose path doesn't match ANY lazy mount triggers ZERO
 *      loaders (proves the matchers aren't accidentally permissive).
 *   3. A request to a path that matches mount `M` triggers exactly ONE
 *      call to mount `M`'s loader and ZERO calls to every other mount's
 *      loader (proves matcher scoping AND the load-once contract).
 */

import { describe, it, expect, jest } from '@jest/globals';
import express from 'express';
import http from 'http';
import path from 'path';
import type { AddressInfo } from 'net';

import {
  lazyMount,
  type RouteRegistrar,
} from '../../server/utils/lazy-mount';
import type { HeavyLazyMountSpec } from '../../server/routes';

// `jest.config.cjs`'s moduleNameMapper rewrites `'../../server/routes'` to a
// thin mock that doesn't export `HEAVY_LAZY_MOUNTS`. Bypass the mapper by
// requiring the real source via its absolute on-disk path — none of the
// mapper's anchored patterns match an absolute `.ts` path.
const ROUTES_ABS_PATH = path.resolve(__dirname, '../../server/routes.ts');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HEAVY_LAZY_MOUNTS: readonly HeavyLazyMountSpec[] = (
  require(ROUTES_ABS_PATH) as { HEAVY_LAZY_MOUNTS: readonly HeavyLazyMountSpec[] }
).HEAVY_LAZY_MOUNTS;

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

function listen(app: express.Express): Promise<RunningServer> {
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

/**
 * A path the production `routes.ts` mount wires up that is GUARANTEED to
 * satisfy the matcher exported alongside it. Keyed by the `name` field on
 * each `HeavyLazyMountSpec` so adding a new mount in routes.ts forces the
 * test author to also add a sample path here (the assertion below errors
 * loudly if a name is missing).
 */
const SAMPLE_MATCHING_PATH: Record<string, string> = {
  documents: '/api/documents',
  // Exercise the regex branch too — the bills mount owns BOTH /api/bills
  // and /api/buildings/:id/bills/*. The first parameterized iteration uses
  // /api/bills; an extra dedicated case below covers the regex branch.
  bills: '/api/bills',
  communication: '/api/communication',
  maintenance: '/api/maintenance',
  demo: '/api/demo',
  ai: '/api/ai',
  'admin-bulk-import': '/api/admin/bulk-import',
  // Task #489 mounts. Each sample path is a prefix the production matcher
  // is guaranteed to fire on; the buildings sample deliberately avoids any
  // /api/buildings/:id/bills sub-URL so it does NOT also load `bills`.
  users: '/api/users',
  organizations: '/api/organizations',
  buildings: '/api/buildings',
  demands: '/api/demands',
  'common-spaces': '/api/common-spaces',
  budgets: '/api/budgets',
};

/**
 * Build a fresh app with every heavy mount registered, with each loader
 * wrapped in a spy that resolves to a no-op registrar. Returned alongside
 * the spies (one per mount, same order as `HEAVY_LAZY_MOUNTS`) so the
 * caller can assert on call counts.
 */
function buildAppWithSpies(): {
  app: express.Express;
  spies: jest.Mock[];
} {
  const app = express();
  const spies = HEAVY_LAZY_MOUNTS.map((spec) => {
    const noopRegistrar: RouteRegistrar = (registry) => {
      // Mount a catch-all so the trampoline's `router(req, res, next)` call
      // resolves with a real HTTP response instead of falling through to
      // express's default 404 (which would still be fine, but a 200 makes
      // the intent of "the load actually happened" obvious in failure logs).
      (registry as express.Router).use((_req, res) => res.status(204).end());
    };
    const spy = jest.fn(async () => noopRegistrar);
    lazyMount(app, spec.matcher, spy as unknown as () => Promise<RouteRegistrar>);
    return spy;
  });
  return { app, spies };
}

describe('heavy /api lazy mounts stay unloaded until first matching request', () => {
  it('exports a sample path for every lazy mount (drift guard)', () => {
    const missing = HEAVY_LAZY_MOUNTS
      .map((spec) => spec.name)
      .filter((name) => !(name in SAMPLE_MATCHING_PATH));
    expect(missing).toEqual([]);
  });

  it('registers exactly the thirteen documented heavy mounts', () => {
    // Lock the count so a NEW lazy mount in routes.ts forces a deliberate
    // update here (and hence forces the author to add a sample path and
    // re-run the parameterized suite below).
    expect(HEAVY_LAZY_MOUNTS).toHaveLength(13);
    expect(HEAVY_LAZY_MOUNTS.map((s) => s.name).sort()).toEqual(
      [
        'admin-bulk-import',
        'ai',
        'bills',
        'budgets',
        'buildings',
        'common-spaces',
        'communication',
        'demands',
        'demo',
        'documents',
        'maintenance',
        'organizations',
        'users',
      ],
    );
  });

  describe.each(HEAVY_LAZY_MOUNTS.map((spec, idx) => [spec.name, idx] as const))(
    'mount %s',
    (name, idx) => {
      it('is not loaded at boot, loads exactly once on first match, and is not loaded by a non-match', async () => {
        const { app, spies } = buildAppWithSpies();

        // Contract #1: registration alone must not invoke any loader.
        spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

        const server = await listen(app);
        try {
          // Contract #2: a path that matches NONE of the mounts triggers
          // ZERO loader calls — proves no matcher is accidentally
          // permissive (e.g. matching `/` or empty string).
          await get(`${server.url}/__definitely_not_a_lazy_mount__`);
          spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());

          // Contract #3: hitting THIS mount's sample path triggers exactly
          // one call to ITS loader and zero calls to every other mount's
          // loader.
          const samplePath = SAMPLE_MATCHING_PATH[name];
          await get(`${server.url}${samplePath}`);

          spies.forEach((spy, j) => {
            if (j === idx) {
              expect(spy).toHaveBeenCalledTimes(1);
            } else {
              expect(spy).not.toHaveBeenCalled();
            }
          });

          // Hitting the same prefix again must NOT re-invoke the loader —
          // the trampoline flips to a thin delegate after the first load.
          await get(`${server.url}${samplePath}`);
          expect(spies[idx]).toHaveBeenCalledTimes(1);

          // And a non-matching request AFTER the first load must still not
          // bump any spy — proves the matcher stays scoped post-load and
          // doesn't degrade into "match everything" once the router is
          // resolved.
          await get(`${server.url}/__still_not_a_lazy_mount__`);
          spies.forEach((spy, j) => {
            expect(spy).toHaveBeenCalledTimes(j === idx ? 1 : 0);
          });
        } finally {
          await server.close();
        }
      }, 15_000);
    },
  );

  it('matches the bills regex branch (/api/buildings/:id/bills/*) without loading anything else', async () => {
    const { app, spies } = buildAppWithSpies();
    const billsIdx = HEAVY_LAZY_MOUNTS.findIndex((s) => s.name === 'bills');
    expect(billsIdx).toBeGreaterThanOrEqual(0);

    const server = await listen(app);
    try {
      // A request to /api/buildings/:id/bills MUST trigger ONLY the bills
      // mount. Pre-task-#489 this was trivially true (buildings was eager);
      // post-#489 the buildings module is also lazy and matches anything
      // under /api/buildings/* — its matcher must explicitly carve out the
      // bills sub-URLs so it does NOT also load on a /bills hit.
      await get(`${server.url}/api/buildings/abc-123/bills`);
      spies.forEach((spy, j) => {
        if (j === billsIdx) {
          expect(spy).toHaveBeenCalledTimes(1);
        } else {
          expect(spy).not.toHaveBeenCalled();
        }
      });

      // And the regex must NOT match an unrelated /api/buildings sub-URL.
      // Now that buildings is itself lazy-mounted, that traffic correctly
      // loads `buildings` (and ONLY `buildings`) — proving the bills regex
      // doesn't bleed across into generic building paths.
      const { app: app2, spies: spies2 } = buildAppWithSpies();
      const buildingsIdx = HEAVY_LAZY_MOUNTS.findIndex(
        (s) => s.name === 'buildings',
      );
      expect(buildingsIdx).toBeGreaterThanOrEqual(0);
      const server2 = await listen(app2);
      try {
        await get(`${server2.url}/api/buildings/abc-123/residences`);
        spies2.forEach((spy, j) => {
          if (j === buildingsIdx) {
            expect(spy).toHaveBeenCalledTimes(1);
          } else {
            expect(spy).not.toHaveBeenCalled();
          }
        });
      } finally {
        await server2.close();
      }
    } finally {
      await server.close();
    }
  }, 15_000);
});
