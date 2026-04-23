import React, { lazy, Suspense } from 'react';
import { Route } from 'wouter';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export type AutoPageRoute = {
  path: string;
  role?: 'admin' | 'manager' | 'tenant' | 'resident';
};

type ComponentLoader = () => Promise<{ default: React.ComponentType<unknown> }>;

/**
 * Eagerly collect every page's `route` named export. This is small (just
 * config), so loading them at app boot is essentially free, and gives us
 * sync access to paths/roles without forcing the page bundles to load.
 */
const routeConfigs = import.meta.glob<AutoPageRoute>('./*.tsx', {
  import: 'route',
  eager: true,
}) as Record<string, AutoPageRoute>;

/**
 * Lazy loaders for the page components themselves. Vite turns each entry
 * into its own async chunk, so a page is only fetched when its route is
 * matched (same behavior as `createOptimizedLoader` elsewhere in the app).
 */
const componentLoaders = import.meta.glob<{ default: React.ComponentType<unknown> }>(
  './*.tsx',
);

/**
 * Render every auto-discovered page as a `<Route>`. Mount this inside the
 * main `<Switch>` BEFORE the 404 fallback so the catch-all still wins.
 */
export function AutoPageRoutes(): JSX.Element {
  const entries = Object.entries(routeConfigs).filter(([file]) => {
    // Skip self and any other underscore-prefixed helper files.
    const base = file.split('/').pop() ?? '';
    return !base.startsWith('_');
  });

  return (
    <>
      {entries.map(([file, route]) => {
        const loader = componentLoaders[file] as ComponentLoader | undefined;
        // Loud, diagnostic failures for misconfigured auto pages —
        // surfaced in dev rather than rendered as a silent broken route.
        if (!loader) {
          if (import.meta.env.DEV) {
            console.error(
              `[auto-pages] no component loader resolved for ${file}; ` +
                `skipping this route. Does the file exist and have a default export?`,
            );
          }
          return null;
        }
        if (!route || typeof route.path !== 'string' || route.path.length === 0) {
          if (import.meta.env.DEV) {
            console.error(
              `[auto-pages] ${file} is missing a valid \`export const route\` ` +
                `with a non-empty \`path\` string; skipping this route.`,
            );
          }
          return null;
        }
        const Component = lazy(loader);
        const inner = (
          <Suspense fallback={<LoadingSpinner />}>
            <Component />
          </Suspense>
        );
        return (
          <Route key={file} path={route.path}>
            {() =>
              route.role ? (
                <ProtectedRoute requiredRole={route.role}>{inner}</ProtectedRoute>
              ) : (
                inner
              )
            }
          </Route>
        );
      })}
    </>
  );
}
