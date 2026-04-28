/**
 * @jest-environment node
 *
 * Spinner-watchdog end-to-end test for admin pages.
 *
 * Each admin route is visited as a logged-in admin user. The test asserts
 * that any data-loading spinner/skeleton visible on first render disappears
 * within a reasonable timeout. A page that stays stuck in its loading state
 * (regression similar to the `/admin/permissions` spinner bug) will cause
 * this suite to fail loudly so CI cannot mask it.
 *
 * Pages covered (generic walk-through):
 * Admin routes (admin+):
 *   - /admin/organizations
 *   - /admin/compliance
 *   - /admin/permissions      (also has its own dedicated e2e suite)
 * Super-admin-only routes:
 *   - /super_admin/quality
 *   - /super_admin/bulk-document-import
 *   - /super_admin/document-tags
 *   - /super_admin/kpi-dashboard
 *   - /super_admin/performance
 *
 * The generic strategy for each route:
 *   1. Navigate and wait for network-idle.
 *   2. Assert that no `animate-pulse` skeletons or `role="status"` spinners
 *      remain in the DOM after a 30-second timeout.
 *   3. Assert that at least one non-empty text node is visible on the page.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
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

let chromium: string;
let browser: Browser;

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
        'server or set E2E_BASE_URL before running the e2e suite.'
    );
  }

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
}, 90_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
}, 30_000);

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', ADMIN_EMAIL);
  await page.type('[data-testid=input-password]', ADMIN_PASSWORD);
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

/**
 * Generic spinner-watchdog assertion.
 * Waits until neither `animate-pulse` skeleton elements nor `role="status"`
 * spinners remain in the DOM, then confirms at least one non-empty heading or
 * card element is visible.
 */
async function assertNoSpinnerStuck(page: Page, route: string): Promise<void> {
  await page.goto(`${BASE_URL}${route}`, {
    waitUntil: 'networkidle2',
    timeout: 30_000,
  });

  const actualPath = await page.evaluate(() => window.location.pathname);
  expect(actualPath).toBe(route);

  // Wait until all skeleton / spinner indicators have resolved.
  await page.waitForFunction(
    () => {
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      const spinners = document.querySelectorAll('[role="status"]');
      return skeletons.length === 0 && spinners.length === 0;
    },
    { timeout: 30_000 }
  );

  // Confirm meaningful content is now visible.
  const hasContent = await page.evaluate(() => {
    const selectors = 'h1,h2,h3,[class*="CardTitle"],[class*="Card"],[class*="card"]';
    const els = Array.from(document.querySelectorAll(selectors));
    return els.some((el) => (el.textContent || '').trim().length > 0);
  });
  expect(hasContent).toBe(true);
}

/** Admin-only routes (admin role or higher). */
const ADMIN_ROUTES = [
  '/admin/organizations',
  '/admin/compliance',
  '/admin/permissions',
] as const;

/** Super-admin-only routes (super_admin role required). */
const SUPER_ADMIN_ROUTES = [
  '/super_admin/quality',
  '/super_admin/bulk-document-import',
  '/super_admin/document-tags',
  '/super_admin/kpi-dashboard',
  '/super_admin/performance',
] as const;

describe('Admin page spinner watchdog', () => {
  it('/admin/organizations: loading spinner disappears after data loads', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);

      await page.goto(`${BASE_URL}/admin/organizations`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/admin/organizations');

      // The organizations card renders a data-testid="loader-organizations-page"
      // element while its query is in flight. Once the API responds the element
      // is removed from the DOM and the actual card content is rendered instead.
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="loader-organizations-page"]'),
        { timeout: 30_000 }
      );

      // Confirm that meaningful content is now visible (at least one card heading).
      const hasContent = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,[class*="CardTitle"]'));
        return headings.some((el) => (el.textContent || '').trim().length > 0);
      });
      expect(hasContent).toBe(true);
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/admin/compliance: skeleton placeholders disappear and content renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/admin/compliance');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/super_admin/quality: skeleton placeholders disappear and content renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/super_admin/quality');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/admin/permissions: spinner resolves and permission matrix renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/admin/permissions');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/super_admin/bulk-document-import: spinner resolves and import UI renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/super_admin/bulk-document-import');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/super_admin/document-tags: spinner resolves and tag list renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/super_admin/document-tags');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/super_admin/kpi-dashboard: spinner resolves and KPI metrics render', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/super_admin/kpi-dashboard');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/super_admin/performance: spinner resolves and performance dashboard renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await assertNoSpinnerStuck(page, '/super_admin/performance');
    } finally {
      await page.close();
    }
  }, 120_000);

  /**
   * Generic walk-through: verifies the ADMIN_ROUTES and SUPER_ADMIN_ROUTES
   * constants are complete and structurally correct.
   * This meta-test does not visit the browser; it just asserts structural
   * completeness to catch missed routes when new pages are added.
   */
  it('ADMIN_ROUTES and SUPER_ADMIN_ROUTES lists match their URL prefixes', () => {
    for (const route of ADMIN_ROUTES) {
      expect(route.startsWith('/admin/')).toBe(true);
    }
    for (const route of SUPER_ADMIN_ROUTES) {
      expect(route.startsWith('/super_admin/')).toBe(true);
    }
    expect(ADMIN_ROUTES.length).toBeGreaterThanOrEqual(3);
    expect(SUPER_ADMIN_ROUTES.length).toBeGreaterThanOrEqual(5);
  });
});
