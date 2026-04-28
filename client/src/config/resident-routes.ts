/**
 * Authoritative list of resident SPA routes registered in App.tsx.
 *
 * Kept in its own file (no Vite-specific imports) so unit tests can import
 * it without pulling in import.meta.glob or React — same pattern as
 * route-redirects.ts.
 *
 * When you add or remove a resident route in App.tsx, update this list too.
 * The mobile-test-plan routing test imports this to catch drift automatically.
 */
export const RESIDENT_ROUTES = [
  '/residents/dashboard',
  '/residents/residence',
  '/residents/residence/documents',
  '/residents/residences/:residenceId/documents',
  '/residents/building',
  '/residents/building/documents',
  '/residents/buildings/:buildingId/documents',
  '/residents/demands',
  '/residents/common-spaces',
  '/resident/common-spaces', // legacy singular redirect → /residents/common-spaces
  '/resident/my-calendar',
] as const;

export type ResidentRoute = (typeof RESIDENT_ROUTES)[number];
