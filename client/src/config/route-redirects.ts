/**
 * Destination sub-routes for each top-level parent route.
 *
 * Each key is a "section root" that has no content of its own; hitting it
 * triggers an immediate redirect to the matching sub-route listed here.
 *
 * Kept in its own file so unit tests can import it without pulling in
 * App.tsx and its Vite-specific `import.meta.glob` call.
 */
export const PARENT_ROUTE_REDIRECTS = {
  '/dashboard': '/dashboard/overview',
  '/admin': '/admin/organizations',
  '/super_admin': '/super_admin/kpi-dashboard',
  '/manager': '/manager/buildings',
  '/residents': '/residents/residence',
  '/settings': '/settings/general',
} as const;

export type ParentRoute = keyof typeof PARENT_ROUTE_REDIRECTS;
export type ParentRouteTarget = (typeof PARENT_ROUTE_REDIRECTS)[ParentRoute];
