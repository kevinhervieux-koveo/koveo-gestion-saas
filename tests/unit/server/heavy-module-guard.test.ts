/**
 * Unit tests for `server/utils/heavy-module-guard.ts`.
 *
 * The guard's job is to fail loudly when a "should-be-lazy" module ends
 * up in Node's CJS module cache by the time `registerRoutes()` returns.
 * These tests exercise the cache-walk + matching logic directly so the
 * behavior is locked independent of the routes wiring.
 */

import path from 'path';

import {
  __resetHeavyModuleGuardForTesting,
  assertHeavyModulesNotEagerlyLoaded,
  findEagerlyLoadedHeavyModules,
} from '../../../server/utils/heavy-module-guard';

const REAL_FIXTURE = path.resolve(
  __dirname,
  '../../../server/utils/lazy-mount.ts',
);

describe('heavy-module-guard', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSkip = process.env.SKIP_LAZY_MOUNT_GUARD;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.SKIP_LAZY_MOUNT_GUARD;
    // The real guard is once-per-process. Reset between tests so each
    // case exercises a fresh check rather than the early-return path.
    __resetHeavyModuleGuardForTesting();
  });

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSkip === undefined) delete process.env.SKIP_LAZY_MOUNT_GUARD;
    else process.env.SKIP_LAZY_MOUNT_GUARD = previousSkip;
  });

  describe('findEagerlyLoadedHeavyModules', () => {
    it('returns an empty list when no denylisted modules are in require.cache', () => {
      // `server/api/communication` is wired through lazyMount() and is
      // not imported anywhere this test transitively pulls in, so it
      // must not show up.
      expect(
        findEagerlyLoadedHeavyModules(['server/api/communication']),
      ).toEqual([]);
    });

    it('flags a denylisted module once it has been eagerly required', () => {
      // Force `server/utils/lazy-mount.ts` into require.cache by importing
      // it (it's already imported above, but `require()` here makes the
      // intent explicit and survives any future tree-shaking).
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      const violations = findEagerlyLoadedHeavyModules([
        'server/utils/lazy-mount',
      ]);
      expect(violations).toEqual(['server/utils/lazy-mount']);
    });

    it('matches denylist entries written with an explicit extension', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      expect(
        findEagerlyLoadedHeavyModules(['server/utils/lazy-mount.ts']),
      ).toEqual(['server/utils/lazy-mount.ts']);
    });

    it('does not flag a partial path match (substring guard)', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      // `lazy-mou` is a strict substring of the cache key; it should NOT
      // match because the matcher requires a full filename + extension.
      expect(findEagerlyLoadedHeavyModules(['server/utils/lazy-mou'])).toEqual(
        [],
      );
    });

    it('deduplicates so each denylist entry is reported at most once', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      expect(
        findEagerlyLoadedHeavyModules([
          'server/utils/lazy-mount',
          'server/utils/lazy-mount',
        ]),
      ).toEqual(['server/utils/lazy-mount']);
    });
  });

  describe('assertHeavyModulesNotEagerlyLoaded', () => {
    it('is a no-op when nothing on the denylist has been loaded', () => {
      expect(() =>
        assertHeavyModulesNotEagerlyLoaded({
          denylist: ['server/api/communication'],
        }),
      ).not.toThrow();
    });

    it('throws with a helpful message when a denylisted module is loaded', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      expect(() =>
        assertHeavyModulesNotEagerlyLoaded({
          denylist: ['server/utils/lazy-mount'],
        }),
      ).toThrow(/heavy-module-guard.*server\/utils\/lazy-mount/s);
    });

    it('skips the check when NODE_ENV=production', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);
      process.env.NODE_ENV = 'production';

      expect(() =>
        assertHeavyModulesNotEagerlyLoaded({
          denylist: ['server/utils/lazy-mount'],
        }),
      ).not.toThrow();
    });

    it('skips the check when SKIP_LAZY_MOUNT_GUARD=true', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);
      process.env.SKIP_LAZY_MOUNT_GUARD = 'true';

      expect(() =>
        assertHeavyModulesNotEagerlyLoaded({
          denylist: ['server/utils/lazy-mount'],
        }),
      ).not.toThrow();
    });

    it('runs at most once per process (subsequent calls are a no-op)', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      // First call consumes the once-per-process budget.
      expect(() =>
        assertHeavyModulesNotEagerlyLoaded({
          denylist: ['server/utils/lazy-mount'],
        }),
      ).toThrow(/heavy-module-guard/);

      // Second call must NOT throw — re-running on every registerRoutes()
      // would produce false positives in suites that legitimately
      // demand-load a module and then rebuild the app.
      expect(() =>
        assertHeavyModulesNotEagerlyLoaded({
          denylist: ['server/utils/lazy-mount'],
        }),
      ).not.toThrow();
    });

    it('logs instead of throwing when throwOnViolation is false', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(REAL_FIXTURE);

      // The guard funnels through `logError`, which writes to stderr via
      // `console.error` in this codebase. Spying on console.error is
      // sufficient to confirm the soft-fail path executed.
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        expect(() =>
          assertHeavyModulesNotEagerlyLoaded({
            denylist: ['server/utils/lazy-mount'],
            throwOnViolation: false,
          }),
        ).not.toThrow();
        expect(spy).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
