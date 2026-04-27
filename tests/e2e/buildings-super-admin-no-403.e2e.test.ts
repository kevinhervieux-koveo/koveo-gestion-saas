/**
 * @jest-environment node
 *
 * End-to-end regression test for W45:
 * GET /api/buildings must return 200 (not 403) for super_admin.
 *
 * Previously the handler used a hardcoded allow-list that excluded 'super_admin',
 * causing a 403 INSUFFICIENT_PERMISSIONS regression on the canonical resource
 * route while the workaround /api/users/me/buildings still returned 200.
 *
 * This test logs in as the mcp-admin user (which has super_admin or admin
 * privileges in the seeded test environment), then directly calls
 * GET /api/buildings from within the browser session and asserts a 200 response.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:5000').replace(/\/+$/, '');

// Use a dedicated super_admin env var when available, fall back to the
// standard mcp-admin account used in the other e2e tests.
const SA_EMAIL =
  process.env.E2E_SUPER_ADMIN_EMAIL ??
  process.env.E2E_ADMIN_EMAIL ??
  'mcp-admin@koveo-mcp.test';
const SA_PASSWORD =
  process.env.E2E_SUPER_ADMIN_PASSWORD ??
  process.env.E2E_ADMIN_PASSWORD ??
  'McpTest2024!';

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

let browser: Browser;

beforeAll(async () => {
  const chromium = findChromium();
  if (!chromium) {
    throw new Error(
      'Chromium not found. Install Chromium or set PUPPETEER_EXECUTABLE_PATH. ' +
        'This e2e test is mandatory and is NOT silently skipped.',
    );
  }

  let healthOk = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    healthOk = probe.ok;
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    throw new Error(
      `Koveo app not reachable at ${BASE_URL}/api/health. ` +
        'Start the dev server or set E2E_BASE_URL before running the e2e suite.',
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

async function loginAsUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', email);
  await page.type('[data-testid=input-password]', password);
  await Promise.all([
    page
      .waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 })
      .catch(() => undefined),
    page.click('button[type=submit]'),
  ]);
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/auth/login'),
    { timeout: 30_000 },
  );
}

describe('GET /api/buildings — no 403 in Network panel for admin/super_admin (W45)', () => {
  it('returns 200 (not 403) from GET /api/buildings while logged in as admin/super_admin', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });

    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsUser(page, SA_EMAIL, SA_PASSWORD);

      // Collect all /api/buildings responses to assert no 403.
      const buildingsStatuses: number[] = [];
      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/api/buildings')) {
          buildingsStatuses.push(response.status());
        }
      });

      // Navigate to the dashboard — this triggers the initial data fetch which
      // includes GET /api/buildings on pages that use the buildings selector.
      // The bills page is a reliable trigger but requires org context;
      // the dashboard itself may also call /api/buildings for building pickers.
      // We also fire a direct fetch from within the page context to be certain.
      await page.goto(`${BASE_URL}/dashboard`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      // Fire a direct fetch from within the authenticated browser session so we
      // always have at least one /api/buildings response to assert on.
      const directStatus: number = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/buildings`, {
          credentials: 'include',
        });
        return res.status;
      }, BASE_URL);

      expect(directStatus).toBe(200);

      // Also assert that no intercepted response to /api/buildings was 403.
      const has403 = buildingsStatuses.some((s) => s === 403);
      if (has403) {
        throw new Error(
          `W45 regression: GET /api/buildings returned 403 for admin/super_admin. ` +
            `All observed statuses: ${JSON.stringify(buildingsStatuses)}`,
        );
      }
    } finally {
      await page.close();
    }
  }, 120_000);
});
