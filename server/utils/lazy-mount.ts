import express, { type Express, type Router } from 'express';

/**
 * Anything a lazy route module is allowed to call on its host. Both
 * `Express` and `Router` satisfy this structurally, so the lazy mount can
 * hand the registrar a fresh `Router()` and tests can keep handing the same
 * registrar a real Express `app`.
 */
export type RouteRegistry = Express | Router;

/**
 * Signature that lazy-loadable route modules must export. The registrar may
 * be sync or async — async lets a module do one-shot setup (DB seeding, OAuth
 * issuer resolution, etc.) inline with route mounting without forcing every
 * caller to split the work between the loader and the registrar.
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

/**
 * Optional configuration for a lazy mount.
 */
export interface LazyMountOptions {
  /**
   * Restrict this mount to a specific set of HTTP methods (upper-case, e.g.
   * `["GET", "POST"]`). When set, any request whose method is NOT in the list
   * receives a `405 Method Not Allowed` response with an `Allow` header
   * — before the lazy loader is invoked. This lets route groups declare their
   * expected verb surface and have the router enforce it at the boundary,
   * rather than waiting for the underlying handler to return a 404/405.
   *
   * When omitted (default), all HTTP methods are forwarded to the module.
   */
  methods?: string[];
}

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
 *
 * Method enforcement: if `options.methods` is provided, requests with a
 * method not in the list are rejected with `405 Method Not Allowed` before
 * the loader is invoked. The `Allow` response header is set to the list so
 * clients can discover which verbs are accepted.
 */
export function lazyMount(
  app: Express,
  matcher: LazyRouteMatcher,
  loader: () => Promise<RouteRegistrar>,
  options?: LazyMountOptions,
): void {
  const matches = buildMatcher(matcher);
  const router: Router = express.Router({ mergeParams: true });
  let loaded = false;
  let loading: Promise<void> | null = null;

  // Normalise the allowed method set once at registration time so the hot
  // path (every matched request) only does a Set lookup instead of
  // re-building the set on each call.
  const allowedMethods: ReadonlySet<string> | null = options?.methods
    ? new Set(options.methods.map((m) => m.toUpperCase()))
    : null;
  const allowHeader: string | null = options?.methods
    ? options.methods.map((m) => m.toUpperCase()).join(', ')
    : null;

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

    // Method enforcement: reject unexpected verbs before touching the loader.
    if (allowedMethods !== null && !allowedMethods.has(req.method)) {
      res.setHeader('Allow', allowHeader!);
      res.status(405).json({
        error: 'Method Not Allowed',
        message: `${req.method} is not supported on this endpoint. Allowed: ${allowHeader}.`,
        code: 'METHOD_NOT_ALLOWED',
        allowed: Array.from(allowedMethods),
      });
      return;
    }

    if (loaded) return router(req, res, next);
    load().then(
      () => router(req, res, next),
      (err) => next(err),
    );
  });
}
