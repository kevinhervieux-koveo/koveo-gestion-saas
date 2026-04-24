/**
 * Boot-time guard that fails fast when a route module which is *supposed*
 * to stay behind a `lazyMount(...)` trampoline ends up in Node's CJS
 * module cache anyway — i.e. someone added a top-level `import` (directly
 * in `server/routes.ts` or transitively through one of the eagerly-loaded
 * registrars) that pulls the heavy module graph in at startup.
 *
 * Per-module regression tests (see `tests/integration/mcp-lazy-mount.test.ts`
 * and the `/api` lazy-mount suites) only catch the modules they explicitly
 * name. A future contributor who lazy-mounts a brand-new heavy module is
 * expected to add its path to {@link HeavyModuleGuardOptions.denylist} —
 * once it's on the list, this guard enforces the "stay lazy" contract for
 * free, with no per-module test wiring required.
 *
 * Detection mechanism: after `registerRoutes(app)` resolves we walk
 * `require.cache` (ts-jest keys it by on-disk source path) and report any
 * entry whose path matches a denylisted module. The check is a no-op when
 * `require.cache` is unavailable (pure ESM runtimes) or when running in
 * production — it is a development/test safety net, not a runtime feature.
 */
import { logError } from './logger';

/** Suffixes treated as a "module file" when matching denylist entries. */
const MODULE_FILE_SUFFIXES = ['.ts', '.tsx', '.js', '.mjs', '.cjs'] as const;
/** Suffixes treated as a "module directory entrypoint" when matching. */
const MODULE_INDEX_SUFFIXES = [
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.mjs',
  '/index.cjs',
] as const;

export interface HeavyModuleGuardOptions {
  /**
   * Repo-relative module paths that MUST stay out of `require.cache`
   * after route registration. Entries should be written WITHOUT a file
   * extension (e.g. `'server/api/communication'`); the matcher accepts
   * both `<entry>.{ts,js,...}` and `<entry>/index.{ts,js,...}` forms so
   * a file-vs-directory refactor doesn't silently break the guard.
   */
  denylist: readonly string[];
  /**
   * When true (default), throw on the first violation. When false, log
   * via `logError` and continue — useful in suites that want to assert
   * on the violation list themselves rather than catch a thrown error.
   */
  throwOnViolation?: boolean;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function stripModuleExtension(entry: string): string {
  return entry.replace(/\.(ts|tsx|js|mjs|cjs)$/, '');
}

function cacheKeyMatchesEntry(cacheKey: string, entry: string): boolean {
  const normKey = normalizePath(cacheKey);
  const normEntry = stripModuleExtension(normalizePath(entry));
  for (const suffix of MODULE_FILE_SUFFIXES) {
    if (normKey.endsWith(`/${normEntry}${suffix}`)) return true;
  }
  for (const suffix of MODULE_INDEX_SUFFIXES) {
    if (normKey.endsWith(`/${normEntry}${suffix}`)) return true;
  }
  return false;
}

/**
 * Return the subset of `denylist` whose modules are currently present in
 * `require.cache`. Pure function — exposed separately so tests can drive
 * it without invoking the throwing wrapper.
 */
export function findEagerlyLoadedHeavyModules(
  denylist: readonly string[],
): string[] {
  // ESM-only runtimes (or any context where the CJS require shim isn't
  // installed) can't be inspected this way; treat as "no violations" so
  // the guard never produces false positives there.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req: any = typeof require !== 'undefined' ? require : undefined;
  if (!req || !req.cache) return [];

  const cacheKeys = Object.keys(req.cache);
  const violations = new Set<string>();
  for (const entry of denylist) {
    for (const key of cacheKeys) {
      if (cacheKeyMatchesEntry(key, entry)) {
        violations.add(entry);
        break;
      }
    }
  }
  return [...violations];
}

/**
 * Test-only handle: forget that we've already run the guard so the next
 * `assertHeavyModulesNotEagerlyLoaded()` call performs a fresh check.
 * Production code should never need this; it exists so a unit test can
 * exercise the once-per-process behavior without spawning a worker.
 */
let hasRun = false;
export function __resetHeavyModuleGuardForTesting(): void {
  hasRun = false;
}

/**
 * Assert that none of the modules listed in `opts.denylist` were loaded
 * eagerly. Intended to run once, immediately after `registerRoutes(app)`
 * has wired up every static + lazy mount. Skips silently in production
 * and when `SKIP_LAZY_MOUNT_GUARD=true` is set (escape hatch for the
 * rare case where a deploy needs to bypass the check).
 *
 * The guard runs at most ONCE per process. The contract it enforces is
 * a startup contract ("nothing eager at boot"), so re-running on every
 * subsequent `registerRoutes()` invocation would produce false positives
 * in test suites that legitimately trigger a lazy load and then build
 * another app — by that point the module is correctly in `require.cache`
 * because it was demand-loaded, not eagerly imported.
 */
export function assertHeavyModulesNotEagerlyLoaded(
  opts: HeavyModuleGuardOptions,
): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.SKIP_LAZY_MOUNT_GUARD === 'true') return;
  if (hasRun) return;
  hasRun = true;

  const violations = findEagerlyLoadedHeavyModules(opts.denylist);
  if (violations.length === 0) return;

  const message =
    `[heavy-module-guard] These modules are wired through lazyMount() and ` +
    `MUST stay out of require.cache until first use, but were already loaded ` +
    `when registerRoutes() returned: ${violations.join(', ')}. ` +
    `Either route the import through lazyMount() (see server/utils/lazy-mount.ts) ` +
    `or remove the path from HEAVY_LAZY_MOUNT_DENYLIST in server/routes.ts. ` +
    `Set SKIP_LAZY_MOUNT_GUARD=true to bypass this check temporarily.`;

  if (opts.throwOnViolation === false) {
    logError(message);
    return;
  }
  throw new Error(message);
}
