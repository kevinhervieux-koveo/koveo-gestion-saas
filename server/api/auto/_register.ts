import type { Express } from 'express';
import { lazyMount } from '../../utils/lazy-mount';
import { AUTO_ROUTE_MODULES } from './index';

/**
 * Mount every module declared in `AUTO_ROUTE_MODULES`.
 *
 * - Entries with a `lazy.matcher` are wired through `lazyMount`. Their
 *   `load` thunk is NOT invoked here; `lazyMount` invokes it on the first
 *   request whose path matches the matcher. This preserves the same
 *   "no boot-time cost" contract as the explicit `lazyMount(...)` calls
 *   in `server/routes.ts`.
 * - Entries without `lazy` are imported and registered eagerly. Failures
 *   are logged but do not abort `registerRoutes`, so a single broken
 *   auto module cannot take down the whole server.
 */
export async function registerAutoRoutes(app: Express): Promise<void> {
  const entries = Object.entries(AUTO_ROUTE_MODULES);
  if (entries.length === 0) return;

  for (const [name, entry] of entries) {
    if (entry.lazy?.matcher) {
      // Defer both the import and the registrar to first matching request.
      lazyMount(app, entry.lazy.matcher, async () => {
        const mod = await entry.load();
        return mod.default;
      });
      continue;
    }

    try {
      const mod = await entry.load();
      await mod.default(app);
    } catch (err) {
      console.error(`[auto-routes] failed to register module "${name}":`, err);
    }
  }
}
