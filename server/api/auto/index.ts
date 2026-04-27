/**
 * Auto-discovered API route module registry.
 *
 * READ `./README.md` BEFORE EDITING.
 *
 * To add a new module: create `./<feature>.ts` (default-export a registrar)
 * then add ONE alphabetically-sorted entry below.
 *
 * Do NOT edit `server/routes.ts` for new feature modules.
 */
import type { Express, Router } from 'express';
import type { LazyRouteMatcher } from '../../utils/lazy-mount';

export type AutoRouteRegistrar = (app: Express | Router) => void | Promise<void>;

export type AutoRouteModule = {
  default: AutoRouteRegistrar;
};

export type AutoRouteEntry = {
  /**
   * Dynamic-import thunk for the module. Must be a literal
   * `() => import('./<feature>')` so esbuild can statically follow it.
   *
   * For entries with a `lazy` matcher, this thunk is only invoked on the
   * first matching request — the module's code is NOT imported at boot.
   * For entries without `lazy`, this thunk is invoked once at boot.
   */
  load: () => Promise<AutoRouteModule>;
  /**
   * Optional lazy-mount config. When set, the module is wired through
   * `lazyMount(app, matcher, ...)` so neither the module's code nor its
   * registrar runs until the first request matching `matcher` arrives.
   */
  lazy?: { matcher: LazyRouteMatcher };
};

/**
 * Keep entries alphabetically sorted by key. Each line is independent,
 * which lets git's recursive merge resolve parallel additions
 * automatically in the common case.
 */
export const AUTO_ROUTE_MODULES: Record<string, AutoRouteEntry> = {
  // Eager example:
  //   widgets: { load: () => import('./widgets') },
  //
  // Lazy example (module imported on first hit only):
  //   bulkImport: {
  //     load: () => import('./bulk-import'),
  //     lazy: { matcher: '/api/admin/bulk-import' },
  //   },

  // Resident maintenance request creation endpoint (task #1277). Lazy
  // because residents only post a handful of requests; loading the module
  // on first hit keeps server boot light.
  maintenanceRequests: {
    load: () => import('./maintenance-requests'),
    lazy: { matcher: '/api/maintenance-requests' },
  },

  // Post-deploy migration verifier (task #939). Eager so a curl against
  // /api/admin/migration-status responds the moment the server is up,
  // without waiting for a first lazy-mount hit.
  migrationStatus: { load: () => import('./migration-status') },
};
