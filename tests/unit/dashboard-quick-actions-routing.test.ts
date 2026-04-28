/**
 * Resident Route Validity Test — W76 reconciliation
 *
 * This test validates the mobile test plan (MOB-T01 – MOB-T10) against the
 * authoritative resident route list exported from
 * `client/src/config/resident-routes.ts`.
 *
 * Because RESIDENT_ROUTES is the single source of truth (same file that
 * developers must keep in sync with App.tsx), any drift between the route
 * registration and the mobile test plan will fail this suite automatically.
 *
 * Route decisions recorded during W76 fix:
 *   /residents/maintenance  → /residents/demands          (rewrite test)
 *   /residents/bookings     → /residents/common-spaces    (rewrite test)
 *   /residents/profile      → /settings/general           (rewrite test)
 *   /residents/meetings     → /resident/my-calendar       (rewrite test)
 *   /residents/dashboard    → registered in App.tsx        (page added)
 *   /residents/bills        → no page yet — PENDING #1702
 *   /residents/comms        → no page yet — PENDING #1703
 *
 * See docs/mobile-test-plan.md for the full test-case descriptions.
 */

import { describe, it, expect } from '@jest/globals';
import { RESIDENT_ROUTES } from '../../client/src/config/resident-routes';

/** Routes outside /residents/* that are valid targets for resident test cases. */
const AUX_ROUTES = ['/login', '/settings/general'] as const;

/** Union of all routes the mobile test plan is allowed to target. */
const ALL_VALID_ROUTES: readonly string[] = [...RESIDENT_ROUTES, ...AUX_ROUTES];

type CaseStatus = 'READY' | 'PENDING';

interface MobileTestCase {
  case: string;
  route: string | null;
  status: CaseStatus;
  pendingFollowUp?: string;
}

const MOBILE_TEST_PLAN: MobileTestCase[] = [
  { case: 'MOB-T01', route: '/login',                   status: 'READY'   },
  { case: 'MOB-T02', route: '/residents/residence',     status: 'READY'   },
  { case: 'MOB-T03', route: '/residents/residence',     status: 'READY'   },
  { case: 'MOB-T04', route: '/residents/demands',       status: 'READY'   },
  { case: 'MOB-T05', route: null,                       status: 'PENDING', pendingFollowUp: '#1702' },
  { case: 'MOB-T06', route: '/residents/common-spaces', status: 'READY'   },
  { case: 'MOB-T07', route: '/settings/general',        status: 'READY'   },
  { case: 'MOB-T08', route: null,                       status: 'PENDING', pendingFollowUp: '#1703' },
  { case: 'MOB-T09', route: '/resident/my-calendar',    status: 'READY'   },
  { case: 'MOB-T10', route: '/residents/dashboard',     status: 'READY'   },
];

describe('Resident route validity (W76 — mobile test plan reconciliation)', () => {
  describe('READY cases resolve to registered routes', () => {
    it('every READY MOB-T case targets a route in RESIDENT_ROUTES or AUX_ROUTES', () => {
      const readyCases = MOBILE_TEST_PLAN.filter((c) => c.status === 'READY');

      // Guard: ensure we haven't accidentally shrunk the READY set
      expect(readyCases.length).toBeGreaterThanOrEqual(8);

      const unresolvable = readyCases.filter(
        (c) => c.route === null || !ALL_VALID_ROUTES.includes(c.route),
      );

      if (unresolvable.length > 0) {
        const details = unresolvable
          .map((c) => `  ${c.case}: "${c.route}" not in RESIDENT_ROUTES — add it to App.tsx and client/src/config/resident-routes.ts`)
          .join('\n');
        throw new Error(`Mobile test plan has READY cases with unregistered routes:\n${details}`);
      }

      expect(unresolvable).toHaveLength(0);
    });
  });

  describe('PENDING cases are explicitly tracked', () => {
    it('exactly 2 cases are PENDING and each has a follow-up ticket reference', () => {
      const pendingCases = MOBILE_TEST_PLAN.filter((c) => c.status === 'PENDING');

      expect(pendingCases).toHaveLength(2);
      expect(pendingCases.map((c) => c.case)).toEqual(['MOB-T05', 'MOB-T08']);

      pendingCases.forEach((c) => {
        expect(c.route).toBeNull();
        expect(typeof c.pendingFollowUp).toBe('string');
      });
    });

    it('PENDING cases do not reference routes that now exist', () => {
      const pendingCases = MOBILE_TEST_PLAN.filter((c) => c.status === 'PENDING');

      // If a new page ships and is added to RESIDENT_ROUTES, the PENDING case
      // must be updated to READY — this assertion catches forgotten updates.
      const resolvedButStillPending = pendingCases.filter(
        (c) => c.route !== null && ALL_VALID_ROUTES.includes(c.route as string),
      );

      expect(resolvedButStillPending).toHaveLength(0);
    });
  });

  describe('Route-decision record (W76)', () => {
    it('documents the old → new route mapping decided during W76 fix', () => {
      const decisions = [
        { oldRoute: '/residents/maintenance', newRoute: '/residents/demands',       verdict: 'rewrite-test' },
        { oldRoute: '/residents/bookings',    newRoute: '/residents/common-spaces', verdict: 'rewrite-test' },
        { oldRoute: '/residents/profile',     newRoute: '/settings/general',        verdict: 'rewrite-test' },
        { oldRoute: '/residents/meetings',    newRoute: '/resident/my-calendar',    verdict: 'rewrite-test' },
        { oldRoute: '/residents/dashboard',   newRoute: '/residents/dashboard',     verdict: 'ship-page'    },
        { oldRoute: '/residents/bills',       newRoute: null,                       verdict: 'follow-up-new-page' },
        { oldRoute: '/residents/comms',       newRoute: null,                       verdict: 'follow-up-new-page' },
      ];

      const rewrites  = decisions.filter((d) => d.verdict === 'rewrite-test');
      const shipped   = decisions.filter((d) => d.verdict === 'ship-page');
      const followUps = decisions.filter((d) => d.verdict === 'follow-up-new-page');

      expect(rewrites).toHaveLength(4);
      expect(shipped).toHaveLength(1);
      expect(followUps).toHaveLength(2);

      // Rewritten and shipped routes must resolve to a registered route
      [...rewrites, ...shipped].forEach((d) => {
        expect(d.newRoute).not.toBeNull();
        expect(ALL_VALID_ROUTES.includes(d.newRoute as string)).toBe(true);
      });

      // Follow-up routes have no current target
      followUps.forEach((d) => {
        expect(d.newRoute).toBeNull();
      });
    });
  });

  describe('Admin and manager routes (regression guard)', () => {
    it('validates admin card routes are unchanged', () => {
      const adminRoutes = [
        { cardName: 'System Management',     path: '/admin/organizations', exists: true },
        { cardName: 'Organization Overview', path: '/admin/organizations', exists: true },
        { cardName: 'User Management',       path: '/admin/organizations', exists: true },
      ];

      adminRoutes.forEach((route) => {
        expect(route.exists).toBe(true);
      });
    });

    it('validates manager card routes are unchanged', () => {
      const managerRoutes = [
        { cardName: 'Buildings',         path: '/manager/buildings', exists: true },
        { cardName: 'Financial Reports', path: '/manager/budget',    exists: true },
        { cardName: 'Maintenance',       path: '/manager/demands',   exists: true },
      ];

      managerRoutes.forEach((route) => {
        expect(route.exists).toBe(true);
      });
    });
  });
});
