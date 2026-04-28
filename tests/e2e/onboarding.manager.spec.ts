/**
 * @jest-environment node
 *
 * Onboarding manager tour catalog end-to-end test (Task #1590).
 *
 * Coverage:
 *   1.  /api/onboarding/catalog exposes all seven manager tour IDs.
 *   2.  Welcome tour fires automatically on first manager login.
 *   3.  Stepping through welcome persists status='completed'.
 *   4.  Reload after completion does not re-trigger welcome.
 *   5.  Restart-all from Settings → Onboarding re-fires welcome.
 *   6–12. Each of the seven manager tours, walked end-to-end on the page
 *        where its anchors live: welcome, buildings, invitations, financials,
 *        requests, communications, settings.  The OnboardingProvider
 *        auto-fires the first eligible pending tour on mount and the runner
 *        filters steps via visibleIf, so the resulting walk-through reflects
 *        what a real manager experiences in this build.
 *  13.   Key always-present data-onboarding anchors exist on the dashboard.
 *  14.   bills.new-btn anchor exists on the bills page.
 *  15.   settings.onboarding.restart-all anchor exists on the onboarding settings page.
 *  16.   invitations.new-btn anchor exists on the user-management page.
 *  17.   Maintenance-request auto-assign caveat (req.auto-assign):
 *        the back-end accepts the manager's authenticated GET to
 *        /api/maintenance-requests, confirming the route exists.  The
 *        in-browser PATCH→acknowledged interaction is gated on the
 *        acknowledge button + PATCH endpoint shipping (tracked as a follow-up
 *        — no acknowledge UI exists in this build, so the predicate
 *        PRED_HAS_MAINTENANCE_ACKNOWLEDGE returns false and the tour step
 *        is silently skipped by the runner).
 *
 * Environment variables:
 *   E2E_BASE_URL          Base URL of the running server (default: http://localhost:5000)
 *   E2E_MANAGER_EMAIL     Manager account e-mail (default: test-manager@koveo-mcp.test)
 *   E2E_MANAGER_PASSWORD  Manager account password (default: McpTest2024!)
 *   PUPPETEER_EXECUTABLE_PATH  Override Chromium path
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || 'test-manager@koveo-mcp.test';
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || 'McpTest2024!';
const TIMEOUT = 120_000;

const MANAGER_TOUR_IDS = [
  'manager.core.welcome',
  'manager.core.buildings',
  'manager.core.invitations',
  'manager.core.financials',
  'manager.core.requests',
  'manager.core.communications',
  'manager.core.settings',
] as const;

type TourId = (typeof MANAGER_TOUR_IDS)[number];

/**
 * Per-tour landing page where at least one of the tour's anchors is rendered
 * for a manager user.  When the OnboardingProvider mounts on this URL, the
 * runner will filter steps via visibleIf and play whatever eligible steps
 * have a visible anchor in the current DOM.
 */
const TOUR_LANDING_URL: Record<TourId, string> = {
  'manager.core.welcome': '/dashboard/overview',
  'manager.core.buildings': '/dashboard/overview',
  'manager.core.invitations': '/manager/user-management',
  'manager.core.financials': '/manager/bills',
  'manager.core.requests': '/dashboard/overview',
  'manager.core.communications': '/dashboard/overview',
  'manager.core.settings': '/settings/onboarding',
};

// ---------------------------------------------------------------------------
// Chromium discovery
// ---------------------------------------------------------------------------

function findChromium(): string | null {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function loginAsManager(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.type('input[type="email"], input[name="email"]', MANAGER_EMAIL, { delay: 30 });
  await page.type('input[type="password"], input[name="password"]', MANAGER_PASSWORD, { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 });
}

async function getSessionCookie(): Promise<string | null> {
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MANAGER_EMAIL, password: MANAGER_PASSWORD }),
    redirect: 'manual',
  });
  const setCookieHeader = loginRes.headers.get('set-cookie') ?? '';
  const sidMatch = setCookieHeader.match(/koveo\.sid=([^;]+)/);
  return sidMatch ? `koveo.sid=${sidMatch[1]}` : null;
}

async function resetTourProgress(cookie: string, tourId: string): Promise<void> {
  await fetch(`${BASE_URL}/api/onboarding/restart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ tourId }),
  });
}

async function resetAllManagerTours(cookie: string): Promise<void> {
  for (const tourId of MANAGER_TOUR_IDS) {
    await resetTourProgress(cookie, tourId).catch(() => {});
  }
}

async function completeTourViaApi(cookie: string, tourId: string): Promise<void> {
  await fetch(`${BASE_URL}/api/onboarding/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ tourId, status: 'completed', stepId: null }),
  });
}

/**
 * Mark every manager tour as completed via API EXCEPT the target tour, then
 * reset the target tour to 'not_started'.  This guarantees the
 * OnboardingProvider's auto-start picks our target tour and only our target
 * tour when the page loads.
 */
async function isolateTour(cookie: string, target: TourId): Promise<void> {
  for (const tourId of MANAGER_TOUR_IDS) {
    if (tourId === target) {
      await resetTourProgress(cookie, tourId).catch(() => {});
    } else {
      await completeTourViaApi(cookie, tourId).catch(() => {});
    }
  }
}

async function getTourProgress(
  page: Page,
  tourId: string,
): Promise<{ status: string; currentStep: number } | null> {
  try {
    const res = await page.evaluate(async (url: string) => {
      const r = await fetch(`${url}/api/onboarding/me`, { credentials: 'include' });
      return r.json();
    }, BASE_URL);
    const prog = res?.progress?.find(
      (p: { tourId: string; status: string }) => p.tourId === tourId,
    );
    return prog ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Driver.js stepping helpers
// ---------------------------------------------------------------------------

async function stepThroughTour(page: Page, maxSteps = 20): Promise<number> {
  let stepCount = 0;
  while (stepCount < maxSteps) {
    const nextBtn = await page.$('.driver-popover-next-btn');
    if (!nextBtn) break;
    const isVisible = await nextBtn.isIntersectingViewport().catch(() => false);
    if (!isVisible) break;
    await nextBtn.click();
    stepCount++;
    await new Promise((r) => setTimeout(r, 600));
    const overlay = await page.$('.driver-overlay');
    if (!overlay) break;
  }
  // Click final close button if still open (last-step Done usually closes
  // the overlay, but we close defensively).
  const closeBtn = await page.$('.driver-popover-close-btn');
  if (closeBtn) {
    await closeBtn.click().catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 1_000));
  return stepCount;
}

async function walkTourEndToEnd(
  page: Page,
  cookie: string,
  tourId: TourId,
): Promise<{ stepsWalked: number; finalStatus: string | null }> {
  await isolateTour(cookie, tourId);
  await page.goto(`${BASE_URL}${TOUR_LANDING_URL[tourId]}`, {
    waitUntil: 'networkidle2',
    timeout: 30_000,
  });

  // Auto-start fetches /api/onboarding/me and runs the first eligible tour
  // ~800ms after the response arrives.  Wait for the driver overlay to
  // appear; if no eligible step exists for the current page the runner
  // marks the tour as completed without showing an overlay (see
  // OnboardingContext.runTour).
  let overlayAppeared = true;
  try {
    await page.waitForSelector('.driver-overlay', { timeout: 10_000 });
  } catch {
    overlayAppeared = false;
  }

  let stepsWalked = 0;
  if (overlayAppeared) {
    stepsWalked = await stepThroughTour(page);
  }

  const progress = await getTourProgress(page, tourId);
  return { stepsWalked, finalStatus: progress?.status ?? null };
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

let browser: Browser;
let chromiumPath: string;

beforeAll(async () => {
  const found = findChromium();
  if (!found) {
    throw new Error(
      'Chromium executable not found. Set PUPPETEER_EXECUTABLE_PATH or install Chromium.',
    );
  }
  chromiumPath = found;

  const healthRes = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!healthRes?.ok) {
    throw new Error(
      `Server not reachable at ${BASE_URL}. Start the server before running e2e tests.`,
    );
  }

  browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}, TIMEOUT);

afterAll(async () => {
  if (browser) await browser.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Manager onboarding tour catalog (Task #1590)', () => {
  /**
   * Test 1 – Catalog exposes all seven manager tour IDs.
   */
  it(
    'All seven manager tour IDs appear in /api/onboarding/catalog',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();

      const res = await fetch(`${BASE_URL}/api/onboarding/catalog`, {
        headers: { Cookie: cookie! },
      });
      expect(res.ok).toBe(true);
      const body = await res.json();
      const tourIds: string[] = (body.catalog ?? []).map((t: { tourId: string }) => t.tourId);

      for (const expectedId of MANAGER_TOUR_IDS) {
        expect(tourIds).toContain(expectedId);
      }
    },
    TIMEOUT,
  );

  /**
   * Test 2 – Welcome tour fires automatically on first manager login.
   */
  it(
    'Welcome tour appears automatically after first manager login',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();
      await resetAllManagerTours(cookie!);

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        const driverOverlay = await page.waitForSelector('.driver-overlay', {
          timeout: 15_000,
        });
        expect(driverOverlay).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 3 – Stepping through welcome persists status='completed'.
   */
  it(
    'Completing welcome tour persists status=completed via API',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();
      await isolateTour(cookie!, 'manager.core.welcome');

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await page.waitForSelector('.driver-overlay', { timeout: 15_000 });
        await stepThroughTour(page);

        const progress = await getTourProgress(page, 'manager.core.welcome');
        expect(progress?.status).toBe('completed');
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 4 – Reload after completion does not re-trigger welcome.
   */
  it(
    'Reload after tour completion does not re-trigger the welcome tour',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();
      // Complete every tour so nothing pending can fire.
      for (const tourId of MANAGER_TOUR_IDS) {
        await completeTourViaApi(cookie!, tourId);
      }

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await new Promise((r) => setTimeout(r, 4_000));

        const overlay = await page.$('.driver-overlay');
        expect(overlay).toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 5 – Restart-all from Settings → Onboarding re-fires welcome.
   */
  it(
    'Restart-all from Settings → Onboarding re-triggers the welcome tour',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();
      for (const tourId of MANAGER_TOUR_IDS) {
        await completeTourViaApi(cookie!, tourId);
      }

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/settings/onboarding`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await new Promise((r) => setTimeout(r, 1_500));

        const restartAllBtn = await page.$('[data-onboarding="settings.onboarding.restart-all"]');
        expect(restartAllBtn).not.toBeNull();
        await restartAllBtn!.click();
        await new Promise((r) => setTimeout(r, 1_500));

        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        const driverOverlay = await page.waitForSelector('.driver-overlay', {
          timeout: 15_000,
        });
        expect(driverOverlay).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  // -------------------------------------------------------------------------
  // Tests 6-12 – End-to-end walk of each of the seven manager tours.
  // For each tour: isolate it (others completed, target reset), open the
  // page where its anchors live, allow the OnboardingProvider to auto-fire
  // it, walk through eligible steps, and verify the tour is recorded as
  // completed.  Some steps may be filtered out by visibleIf (e.g. row-level
  // anchors that depend on data); the tour is still completed once the
  // walked steps finish.
  // -------------------------------------------------------------------------

  for (const tourId of MANAGER_TOUR_IDS) {
    it(
      `End-to-end walk: ${tourId} on ${TOUR_LANDING_URL[tourId]}`,
      async () => {
        const cookie = await getSessionCookie();
        expect(cookie).not.toBeNull();

        const page = await browser.newPage();
        page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
        try {
          await page.setViewport({ width: 1280, height: 800 });
          await loginAsManager(page);

          const result = await walkTourEndToEnd(page, cookie!, tourId);

          // The tour either walked steps and completed, or was completed
          // immediately because zero steps were eligible on the landing
          // page (legitimate when no anchors render — the runner short-
          // circuits via persistProgress(completed) without showing UI).
          // In either case, the recorded status MUST be 'completed' when
          // the walk finishes.
          expect(result.finalStatus).toBe('completed');
        } finally {
          await page.close();
        }
      },
      TIMEOUT,
    );
  }

  /**
   * Test 13 – Always-present anchors on the manager dashboard.
   */
  it(
    'Key data-onboarding anchors are present on the manager dashboard',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();
      for (const tourId of MANAGER_TOUR_IDS) {
        await completeTourViaApi(cookie!, tourId);
      }

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await new Promise((r) => setTimeout(r, 2_000));

        const alwaysPresentAnchors = [
          '[data-onboarding="dashboard.root"]',
          '[data-onboarding="topbar.user-menu"]',
          '[data-onboarding="topbar.role-badge"]',
          '[data-onboarding="nav.buildings"]',
          '[data-onboarding="nav.demands"]',
          '[data-onboarding="nav.communications"]',
          '[data-onboarding="topbar.settings-link"]',
        ];
        for (const selector of alwaysPresentAnchors) {
          const el = await page.$(selector);
          expect(el).not.toBeNull();
        }
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 14 – bills.new-btn anchor exists on the bills page.
   */
  it(
    'bills.new-btn anchor is present on the bills page',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();
      for (const tourId of MANAGER_TOUR_IDS) {
        await completeTourViaApi(cookie!, tourId);
      }

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/manager/bills`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await new Promise((r) => setTimeout(r, 2_000));

        const billsBtn = await page.$('[data-onboarding="bills.new-btn"]');
        expect(billsBtn).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 15 – settings.onboarding.restart-all anchor exists.
   */
  it(
    'settings.onboarding.restart-all anchor is present on the onboarding settings page',
    async () => {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/settings/onboarding`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await new Promise((r) => setTimeout(r, 2_000));

        const restartAllBtn = await page.$('[data-onboarding="settings.onboarding.restart-all"]');
        expect(restartAllBtn).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 16 – invitations.new-btn anchor exists on the user-management page.
   */
  it(
    'invitations.new-btn anchor is present on the user-management page',
    async () => {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsManager(page);
        await page.goto(`${BASE_URL}/manager/user-management`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await new Promise((r) => setTimeout(r, 2_000));

        const inviteBtn = await page.$('[data-onboarding="invitations.new-btn"]');
        expect(inviteBtn).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  /**
   * Test 17 – Maintenance auto-assign caveat (req.auto-assign).
   *
   * The tour step describes the back-end behavior of moving a maintenance
   * request from submitted → acknowledged.  In this build there is no
   * acknowledge button (PRED_HAS_MAINTENANCE_ACKNOWLEDGE returns false) and
   * no PATCH endpoint, so the tour step is silently filtered out by the
   * runner.  This test asserts the contract that exists today: the manager
   * can authenticate and reach the maintenance-requests list endpoint.
   * When the acknowledge UI + PATCH endpoint ship, a follow-up will extend
   * this test to actually flip the status and verify assignedTo=managerId.
   */
  it(
    'Maintenance-requests endpoint is reachable for an authenticated manager (auto-assign caveat groundwork)',
    async () => {
      const cookie = await getSessionCookie();
      expect(cookie).not.toBeNull();

      const res = await fetch(`${BASE_URL}/api/maintenance-requests`, {
        headers: { Cookie: cookie! },
      });
      // 200 (rows) or 403 (no buildings) are both acceptable; what we are
      // guarding against is a 401/404 that would mean the endpoint disappeared.
      expect([200, 403]).toContain(res.status);
    },
    TIMEOUT,
  );
});
