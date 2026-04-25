/**
 * @jest-environment node
 *
 * End-to-end smoke test for `/admin/permissions`. Replays the production
 * regression that left the page stuck on its loading spinner forever:
 * we log in as admin, navigate to the page, and assert that the
 * permissions matrix `<Table>` actually renders with at least one
 * `<TableRow>` in its body. Fails loudly (no silent skip) when Chromium
 * or the Koveo dev server is unavailable so CI cannot mask regressions.
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

describe('/admin/permissions (real browser, real app)', () => {
  it('renders the permissions matrix table with at least one row', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      // Surface uncaught client errors so a resurrected
      // `x.filter is not a function` regression is immediately
      // diagnosable from the test output.
      console.error('[pageerror]', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[console.error]', msg.text());
      }
    });
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);

      await page.goto(`${BASE_URL}/admin/permissions`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      // Sanity-check: we did not get bounced back to login by the
      // `requiredRole="admin"` route guard.
      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/admin/permissions');

      // The page-level loader must clear (the regression we are
      // guarding against was that this loader spun forever).
      await page.waitForFunction(
        () => !document.querySelector('[data-testid=loader-permissions-page]'),
        { timeout: 30_000 }
      );

      // Switch into the "All Permissions" tab where the matrix `<Table>`
      // is rendered. The default tab is "User Permissions". Radix's
      // `<TabsTrigger>` reacts to pointer events, so we use puppeteer's
      // native `ElementHandle.click()` (which dispatches real mouse
      // events) instead of `el.click()` inside `page.evaluate` (which
      // only fires a synthetic click event Radix ignores).
      await page.waitForSelector('[role="tab"]', { timeout: 30_000 });
      const tabHandles = await page.$$('[role="tab"]');
      let clicked = false;
      for (const handle of tabHandles) {
        const text = await handle.evaluate((el) => el.textContent?.trim() || '');
        if (text.toLowerCase() === 'all permissions') {
          await handle.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        throw new Error('Could not find the "All Permissions" tab');
      }
      // Wait for Radix to flip the tab state before checking the panel.
      await page.waitForFunction(
        () => {
          const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
          const allPerms = tabs.find(
            (t) => t.textContent?.trim().toLowerCase() === 'all permissions'
          );
          return allPerms?.getAttribute('data-state') === 'active';
        },
        { timeout: 10_000 }
      );

      // The matrix `<Table>` must render at least one `<TableRow>` in
      // its `<TableBody>`. On failure, dump diagnostic info so a
      // resurrected regression is immediately diagnosable.
      try {
        await page.waitForFunction(
          () => {
            const tables = Array.from(document.querySelectorAll('table'));
            return tables.some((table) => {
              const tbody = table.querySelector('tbody');
              if (!tbody) return false;
              return tbody.querySelectorAll('tr').length > 0;
            });
          },
          { timeout: 30_000 }
        );
      } catch (err) {
        const diag = await page.evaluate(() => {
          const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(
            (t) => ({
              text: t.textContent?.trim() || '',
              state: t.getAttribute('data-state'),
              selected: t.getAttribute('aria-selected'),
            })
          );
          const panels = Array.from(
            document.querySelectorAll('[role="tabpanel"]')
          ).map((p) => ({
            state: p.getAttribute('data-state'),
            tableCount: p.querySelectorAll('table').length,
            tbodyRows: Array.from(p.querySelectorAll('table tbody')).map(
              (tb) => tb.querySelectorAll('tr').length
            ),
          }));
          return { tabs, panels };
        });
        // eslint-disable-next-line no-console
        console.error('[diag] tabs/panels state', JSON.stringify(diag, null, 2));
        throw err;
      }

      const rowCount = await page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
          const tbody = table.querySelector('tbody');
          if (!tbody) continue;
          const rows = tbody.querySelectorAll('tr');
          if (rows.length > 0) return rows.length;
        }
        return 0;
      });
      expect(rowCount).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 120_000);
});
