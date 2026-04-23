import express, { type Express, type Router } from 'express';

/**
 * Anything a lazy route module is allowed to call on its host. Both
 * `Express` and `Router` satisfy this structurally, so the lazy mount can
 * hand the registrar a fresh `Router()` and tests can keep handing the same
 * registrar a real Express `app`.
 */
export type RouteRegistry = Express | Router;

/**
 * Signature that lazy-loadable route modules must export. Registrars may be
 * synchronous (the common case — just `app.use(...)` / `app.get(...)` etc.)
 * or return a Promise when they need to await async setup work before the
 * router is considered "loaded" (e.g. the MCP module, which seeds sandbox
 * data and wipes stale OAuth secrets before mounting its handlers).
 */
export type RouteRegistrar = (registry: RouteRegistry) => void | Promise<void>;

/**
 * How a request path is matched against a lazy mount. Strings/string[] do a
 * `startsWith` check; a function lets callers express anything stricter
 * (e.g. a regex) without expanding the helper API.
 */
export type LazyRouteMatcher =
  | string
  | string[]
  | ((path: string) => boolean);

function buildMatcher(matcher: LazyRouteMatcher): (path: string) => boolean {
  if (typeof matcher === 'function') return matcher;
  const prefixes = Array.isArray(matcher) ? matcher : [matcher];
  return (path: string) => prefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * Lazy-mount a route module behind a path matcher. The module is dynamically
 * imported and its registrar invoked on the first matching request. Subsequent
 * requests skip the import and go straight to the resolved router.
 *
 * Concurrency: the loader is awaited via a single shared promise, so a burst
 * of first-hit requests still triggers exactly one `import()` and one
 * `register(router)` call.
 *
 * Failure handling: if the loader rejects, the rejection is propagated to
 * `next(err)` and the next matching request will retry the load. Once the
 * registrar succeeds, `loaded` flips and the trampoline becomes a thin
 * branch that delegates to the underlying router.
 */
export function lazyMount(
  app: Express,
  matcher: LazyRouteMatcher,
  loader: () => Promise<RouteRegistrar>,
): void {
  const matches = buildMatcher(matcher);
  const router: Router = express.Router({ mergeParams: true });
  let loaded = false;
  let loading: Promise<void> | null = null;

  const load = (): Promise<void> => {
    if (loading) return loading;
    loading = (async () => {
      const t0 = Date.now();
      const register = await loader();
      await register(router);
      loaded = true;
      console.log(
        `[lazy-mount] route module loaded in ${Date.now() - t0}ms`,
      );
    })().catch((err) => {
      // Reset so a subsequent request can retry the load.
      loading = null;
      throw err;
    });
    return loading;
  };

  app.use((req, res, next) => {
    if (!matches(req.path)) return next();
    if (loaded) return router(req, res, next);
    load().then(
      () => router(req, res, next),
      (err) => next(err),
    );
  });
}
