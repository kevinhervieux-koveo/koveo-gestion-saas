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
 * Pages covered:
 *   - /admin/organizations   (data-testid="loader-organizations-page")
 *   - /admin/compliance      (Skeleton components replaced by content)
 *   - /admin/quality         (Skeleton components replaced by content)
 *
 * NOTE: /admin/permissions has its own dedicated test in
 * admin-permissions.e2e.test.ts and is intentionally excluded here.
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

      await page.goto(`${BASE_URL}/admin/compliance`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/admin/compliance');

      // The compliance page uses Radix Skeleton components while loading.
      // Wait until none of the skeleton pulse elements remain in the DOM,
      // which signals that the data query has resolved and real content has
      // replaced the placeholders.
      await page.waitForFunction(
        () => {
          const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
          return skeletons.length === 0;
        },
        { timeout: 30_000 }
      );

      // Sanity-check that at least one non-trivial text node is visible.
      const hasContent = await page.evaluate(() => {
        const cards = document.querySelectorAll('[class*="Card"],[class*="card"]');
        return cards.length > 0;
      });
      expect(hasContent).toBe(true);
    } finally {
      await page.close();
    }
  }, 120_000);

  it('/admin/quality: skeleton placeholders disappear and content renders', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);

      await page.goto(`${BASE_URL}/admin/quality`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/admin/quality');

      // The quality-metrics component conditionally renders Skeleton elements
      // while the query is pending. Once resolved, the metric values replace them.
      await page.waitForFunction(
        () => {
          const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
          return skeletons.length === 0;
        },
        { timeout: 30_000 }
      );

      const hasContent = await page.evaluate(() => {
        const cards = document.querySelectorAll('[class*="Card"],[class*="card"]');
        return cards.length > 0;
      });
      expect(hasContent).toBe(true);
    } finally {
      await page.close();
    }
  }, 120_000);
});
