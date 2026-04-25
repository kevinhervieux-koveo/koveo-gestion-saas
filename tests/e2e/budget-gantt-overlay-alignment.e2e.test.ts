/**
 * @jest-environment node
 *
 * Browser-level smoke test for the Gantt drag-edit on the manager budget
 * page. Task #937 added a regression guard for the math that vertically
 * centers the blue drag overlay on the grey `<rect>` of the Gantt row,
 * but that test runs in jsdom with a custom ResizeObserver shim — it
 * cannot catch drift caused by real-browser CSS (a stylesheet adds
 * padding to the chart's parent, a scrollbar appears, font metrics
 * shift the X-axis labels, etc).
 *
 * This e2e test closes that gap. Modelled on
 * `tests/e2e/admin-permissions.e2e.test.ts`, it logs in as the seeded
 * MCP manager, seeds a small set of maintenance projects with planned
 * dates against the real database, opens `/manager/budget`, switches
 * to the Gantt view, clicks the bar's edit affordance to enter inline
 * date drag-edit, and asserts that the rendered blue overlay's
 * `getBoundingClientRect()` vertically centers on the row's grey
 * `<rect>` within 1 px in a real Chromium browser.
 *
 * Mandatory: fails loudly (no silent skip) when Chromium, the dev
 * server, or seed data is missing — matching the conventions of the
 * existing e2e suite.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
// Browser session uses the seeded demo manager (`demo_manager` role) — the
// same account the `document-inline-viewer-seeded.e2e.test.ts` suite drives.
// The demo seed populates `userBuildings` rows for this user, which the
// `/api/users/me/buildings` endpoint and the building-access HOC require to
// resolve a building so the budget page can render. The role passes the
// `requiredRole="manager"` route guard via `ROLE_HIERARCHY` (demo_manager == 2).
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || 'marie.tremblay@demo.koveo.ca';
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || 'demo123456';

// API seeding uses the MCP admin (`admin` role). Project creation through
// `POST /api/maintenance/projects` is restricted to admin/manager roles and
// `checkBuildingAccess` short-circuits to true for admins, so the admin can
// freely create maintenance projects in any of the demo manager's buildings
// without needing a `userBuildings` row of its own.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

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

interface SeededOrg {
  id: string;
  name?: string;
}

interface SeededBuilding {
  id: string;
  organizationId?: string;
  name?: string;
}

interface CreatedProject {
  id: string;
  title: string;
}

/**
 * Cookie-authenticated REST client. One instance per role: a manager-scoped
 * client discovers the buildings the demo manager can see (so the seeded
 * projects appear in the same building selector the browser session lands
 * in), and a separate admin-scoped client creates those projects (because
 * `POST /api/maintenance/projects` is admin/manager-only and the demo
 * manager role is rejected by that route's RBAC check).
 *
 * Mirrors the cookie-handling pattern used by
 * `document-inline-viewer-seeded.e2e.test.ts`.
 */
class CookieClient {
  private cookie = '';

  constructor(private readonly label: string) {}

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(
        `${this.label} login failed (${res.status}): ${await res.text().catch(() => '')}. ` +
          `Ensure the seed data is loaded and ${email} exists.`
      );
    }
    const setCookie =
      res.headers.get('set-cookie') ??
      (res.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie?.()
        ?.join(', ') ??
      '';
    if (!setCookie) {
      throw new Error(`${this.label} login did not return a session cookie`);
    }
    this.cookie = setCookie
      .split(/,(?=[^;]+=)/)
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
  }

  async getJson<T>(url: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { Cookie: this.cookie },
    });
    if (!res.ok) {
      throw new Error(
        `${this.label} GET ${url} failed: ${res.status} ${await res.text().catch(() => '')}`
      );
    }
    return (await res.json()) as T;
  }

  async postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: { Cookie: this.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `${this.label} POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`
      );
    }
    return (await res.json()) as T;
  }

  async deleteRequest(url: string): Promise<void> {
    await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers: { Cookie: this.cookie },
    }).catch(() => undefined);
  }
}

async function pickFirstOrgAndBuilding(
  managerClient: CookieClient
): Promise<{ org: SeededOrg; building: SeededBuilding }> {
  const orgs = await managerClient.getJson<SeededOrg[]>('/api/users/me/organizations');
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error(
      `Manager ${MANAGER_EMAIL} has no accessible organizations — run the demo seed.`
    );
  }
  // Iterate orgs until we find one that exposes at least one building so
  // a stale/empty org never silently breaks the test.
  for (const org of orgs) {
    // The endpoint expects `organization_id` (snake_case), not `organization`.
    const buildings = await managerClient.getJson<SeededBuilding[]>(
      `/api/users/me/buildings?organization_id=${encodeURIComponent(org.id)}`
    );
    if (Array.isArray(buildings) && buildings.length > 0) {
      return { org, building: { ...buildings[0], organizationId: org.id } };
    }
  }
  throw new Error(
    `No accessible building found for manager ${MANAGER_EMAIL} across ${orgs.length} ` +
      `organization(s) — run the demo seed.`
  );
}

async function createProject(
  adminClient: CookieClient,
  buildingId: string,
  payload: { title: string; plannedStartDate: string; plannedEndDate: string }
): Promise<CreatedProject> {
  // projectNumber must be unique; embed a high-resolution timestamp so
  // re-runs of the suite never collide.
  const projectNumber = `E2E-GANTT-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const body = await adminClient.postJson<{ data: { id: string; title: string } }>(
    '/api/maintenance/projects',
    {
      buildingId,
      projectNumber,
      title: payload.title,
      type: 'minor_rehab',
      priority: 'medium',
      totalBudget: 5000,
      plannedStartDate: payload.plannedStartDate,
      plannedEndDate: payload.plannedEndDate,
    }
  );
  if (!body?.data?.id) {
    throw new Error(
      `POST /api/maintenance/projects returned unexpected shape: ${JSON.stringify(body)}`
    );
  }
  return { id: body.data.id, title: body.data.title };
}

let chromium: string;
let browser: Browser;
let managerApi: CookieClient;
let adminApi: CookieClient;
let org: SeededOrg;
let building: SeededBuilding;
const createdProjects: CreatedProject[] = [];

/**
 * Build a planned-date span anchored on the next month at day 1 so the
 * project bars always fall inside the budget chart's default 12-month
 * window (which starts at the current calendar month).
 */
function spanFromMonthOffset(startMonthOffset: number, durationDays: number): {
  plannedStartDate: string;
  plannedEndDate: string;
} {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + startMonthOffset, 1);
  const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { plannedStartDate: fmt(start), plannedEndDate: fmt(end) };
}

beforeAll(async () => {
  const found = findChromium();
  if (!found) {
    throw new Error(
      'Chromium executable not found. Install Chromium or set ' +
        'PUPPETEER_EXECUTABLE_PATH. This e2e test is mandatory and is not ' +
        'silently skipped to avoid masking regressions in CI.'
    );
  }
  chromium = found;

  let healthOk = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    healthOk = probe.ok;
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    throw new Error(
      `Koveo app is not reachable at ${BASE_URL}/api/health. Start the dev ` +
        'server (with the MCP seed data loaded) or set E2E_BASE_URL before ' +
        'running the e2e suite.'
    );
  }

  managerApi = new CookieClient('Manager API');
  adminApi = new CookieClient('Admin API');
  await Promise.all([
    managerApi.login(MANAGER_EMAIL, MANAGER_PASSWORD),
    adminApi.login(ADMIN_EMAIL, ADMIN_PASSWORD),
  ]);
  ({ org, building } = await pickFirstOrgAndBuilding(managerApi));

  // Seed three maintenance projects with planned dates, staggered across
  // the next few months, so the Gantt renders a multi-project list and
  // the row we click is not the only one (which would mask a vertical
  // alignment regression that only shows up beyond row index 0).
  createdProjects.push(
    await createProject(adminApi, building.id, {
      title: `E2E Gantt Project A ${Date.now()}`,
      ...spanFromMonthOffset(1, 30),
    })
  );
  createdProjects.push(
    await createProject(adminApi, building.id, {
      title: `E2E Gantt Project B ${Date.now()}`,
      ...spanFromMonthOffset(2, 45),
    })
  );
  createdProjects.push(
    await createProject(adminApi, building.id, {
      title: `E2E Gantt Project C ${Date.now()}`,
      ...spanFromMonthOffset(3, 60),
    })
  );

  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromium,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}, 120_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
  if (adminApi) {
    for (const p of createdProjects) {
      await adminApi.deleteRequest(`/api/maintenance/projects/${p.id}`);
    }
  }
}, 30_000);

async function loginAsManager(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', MANAGER_EMAIL);
  await page.type('[data-testid=input-password]', MANAGER_PASSWORD);
  await Promise.all([
    page
      .waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 })
      .catch(() => undefined),
    page.click('button[type=submit]'),
  ]);
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/auth/login'),
    { timeout: 30_000 }
  );
}

describe('/manager/budget Gantt drag overlay alignment (real browser)', () => {
  it('vertically centers the blue drag overlay on the grey row rect within 1 px', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      // Surface uncaught client errors so a resurrected
      // Gantt-overlay regression is immediately diagnosable.
      console.error('[pageerror]', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[console.error]', msg.text());
      }
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsManager(page);

      // Pre-seed the localStorage / sessionStorage that the budget page
      // reads on first paint:
      //   - keep the project card expanded (collapsed by default)
      //   - land directly on the Gantt view (instead of the list view)
      // Done after login so the cookies are set against the right origin.
      await page.evaluateOnNewDocument(() => {
        try {
          window.localStorage.setItem(
            'budget-cards-collapsed',
            JSON.stringify({
              project: false,
              bankAccount: true,
              minimumRequirement: true,
              revenue: true,
              bills: true,
              capitalInvestment: true,
            })
          );
          window.sessionStorage.setItem('budget.projectViewMode', 'gantt');
        } catch {
          // ignore — defaults will still let the test pass via clicks
        }
      });

      const budgetUrl =
        `${BASE_URL}/manager/budget?organization=${encodeURIComponent(org.id)}` +
        `&building=${encodeURIComponent(building.id)}`;
      await page.goto(budgetUrl, {
        waitUntil: 'networkidle2',
        timeout: 60_000,
      });

      // Sanity-check: we did not get bounced back to login.
      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/manager/budget');

      // The project card might still be collapsed (e.g. evaluateOnNewDocument
      // ran too late, or another test left a stale localStorage value). If
      // so, click the header to expand it. Done before waiting on Gantt
      // testids so we don't time out on a hidden card.
      const cardOpen = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="card-project-management"]');
        if (!card) return false;
        // The card body sits in CardContent; its absence indicates collapse.
        const content = card.querySelectorAll('[class*="CardContent"], div');
        // Heuristic: if no view-toggle button is rendered, the card is
        // collapsed and we need to expand it.
        return !!card.querySelector('[data-testid="button-projects-view-gantt"]');
      });
      if (!cardOpen) {
        await page.evaluate(() => {
          const header = document.querySelector(
            '[data-testid="card-project-management"] [class*="CardHeader"], ' +
              '[data-testid="card-project-management"] > div'
          ) as HTMLElement | null;
          header?.click();
        });
      }

      // Ensure we are on the Gantt view (it should already be the active
      // tab via sessionStorage, but click defensively if not).
      await page.waitForSelector('[data-testid="button-projects-view-gantt"]', {
        timeout: 30_000,
      });
      const onGantt = await page.evaluate(() => {
        const btn = document.querySelector(
          '[data-testid="button-projects-view-gantt"]'
        ) as HTMLButtonElement | null;
        return !!btn && !btn.classList.contains('ghost');
      });
      if (!onGantt) {
        await page.click('[data-testid="button-projects-view-gantt"]');
      }

      // Wait until every seeded project's grey bar `<rect>` is in the DOM.
      // This guarantees the chart has finished its initial measure pass
      // and the per-row click overlays exist.
      await page.waitForFunction(
        (ids: string[]) =>
          ids.every((id) =>
            document.querySelector(`[data-testid="gantt-bar-rect-${id}"]`)
          ),
        { timeout: 60_000 },
        createdProjects.map((p) => p.id)
      );

      // Pick the middle row (index 1 of 3) so any vertical drift caused by
      // top-margin or row-height regressions is surfaced — index 0 happens
      // to coincide with the chart's top margin and would mask such bugs.
      const target = createdProjects[1];

      const barClickSel = `[data-testid="gantt-bar-click-${target.id}"]`;
      const barRectSel = `[data-testid="gantt-bar-rect-${target.id}"]`;
      const overlaySel = `[data-testid="gantt-drag-overlay-${target.id}"]`;

      await page.waitForSelector(barClickSel, { timeout: 30_000 });

      // Click via puppeteer's native ElementHandle.click() so the synthetic
      // pointerdown / mousedown / click sequence matches what a real user
      // produces — React's onClick handler on the bar overlay fires reliably
      // in this mode.
      const barClick = await page.$(barClickSel);
      if (!barClick) {
        throw new Error(`Could not locate ${barClickSel}`);
      }
      await barClick.evaluate((el: Element) =>
        (el as HTMLElement).scrollIntoView({ block: 'center' })
      );
      await barClick.click();

      // Wait for the blue drag overlay to appear (proof that inline
      // edit mode engaged).
      await page.waitForSelector(overlaySel, { visible: true, timeout: 15_000 });

      // Compare the overlay's bounding rect with the grey bar's rect.
      // Both elements live inside the same chart container, so their
      // viewport-coords can be compared directly.
      const measurement = await page.evaluate(
        ({ overlaySel, barRectSel }) => {
          const overlay = document.querySelector(overlaySel);
          const bar = document.querySelector(barRectSel);
          if (!overlay || !bar) {
            return { found: false } as const;
          }
          const o = overlay.getBoundingClientRect();
          const b = bar.getBoundingClientRect();
          return {
            found: true as const,
            overlay: { top: o.top, height: o.height, centerY: o.top + o.height / 2 },
            bar: { top: b.top, height: b.height, centerY: b.top + b.height / 2 },
          };
        },
        { overlaySel, barRectSel }
      );

      expect(measurement.found).toBe(true);
      if (!measurement.found) return; // satisfy TS narrowing

      // The overlay must vertically center on the grey bar within 1 px.
      // This is the regression task #937 guards against in jsdom — here
      // we assert it against a real Chromium layout so production CSS
      // (parent padding, scrollbars, font-driven X-axis height) can't
      // sneak past the unit test.
      const drift = Math.abs(measurement.overlay.centerY - measurement.bar.centerY);
      if (drift > 1) {
        // eslint-disable-next-line no-console
        console.error('[diag] overlay/bar measurement', JSON.stringify(measurement, null, 2));
      }
      expect(drift).toBeLessThanOrEqual(1);

      // Sanity: the overlay must be at least as tall as the bar (it's the
      // interactive surface) — an overlay shorter than the bar would
      // indicate a layout collapse that the alignment check alone could
      // miss when both rects degenerate to zero height.
      expect(measurement.overlay.height).toBeGreaterThanOrEqual(measurement.bar.height - 1);
      expect(measurement.bar.height).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 180_000);
});
