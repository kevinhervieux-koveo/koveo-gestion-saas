/**
 * @jest-environment node
 *
 * End-to-end tests for WCAG 2.1 SC 1.4.4 — pinch-zoom accessibility (W65).
 *
 * W65 — The SPA shell must NOT restrict pinch-zoom via `maximum-scale=1` in
 *       the viewport meta tag. iOS Safari and Android Chrome respect this
 *       attribute by blocking user scaling past the initial scale, which
 *       violates WCAG 1.4.4 "Resize text" (Level AA).
 *
 * Tests:
 *   1. Viewport meta string on every target page does NOT contain maximum-scale=1.
 *   2. Programmatic pinch-zoom via CDP Input.dispatchTouchEvent raises
 *      window.visualViewport.scale above 1.5 on a simulated iPhone 13.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

const MAXIMUM_SCALE_PATTERN = /maximum-scale\s*=\s*1\b/i;

const PUBLIC_ROUTES = ['/login'] as const;

const AUTHENTICATED_ROUTES = [
  '/dashboard/overview',
  '/residents/dashboard',
  '/manager/bills',
  '/admin/permissions',
] as const;

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
  const found = findChromium();
  if (!found) {
    throw new Error(
      'Chromium executable not found. Install Chromium or set ' +
        'PUPPETEER_EXECUTABLE_PATH. This e2e test is mandatory and is not ' +
        'silently skipped to avoid masking regressions in CI.'
    );
  }

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
    executablePath: found,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--enable-touch-events',
    ],
  });
}, 90_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
}, 30_000);

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
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
    () => !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/auth/login'),
    { timeout: 30_000 }
  );
}

function getViewportMeta(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.querySelector('meta[name="viewport"]');
    return el ? el.getAttribute('content') : null;
  });
}

describe('WCAG 1.4.4 (W65) — viewport meta must not restrict pinch-zoom', () => {
  for (const route of PUBLIC_ROUTES) {
    it(`${route}: viewport meta does not contain maximum-scale=1`, async () => {
      const page = await browser.newPage();
      page.on('pageerror', (err) => console.error('[pageerror]', err.message));
      try {
        await page.goto(`${BASE_URL}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        const content = await getViewportMeta(page);
        expect(content).not.toBeNull();
        expect(MAXIMUM_SCALE_PATTERN.test(content ?? '')).toBe(false);
      } finally {
        await page.close();
      }
    }, 60_000);
  }

  for (const route of AUTHENTICATED_ROUTES) {
    it(`${route}: viewport meta does not contain maximum-scale=1`, async () => {
      const page = await browser.newPage();
      page.on('pageerror', (err) => console.error('[pageerror]', err.message));
      try {
        await page.setViewport({ width: 390, height: 844 });
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}${route}`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        const content = await getViewportMeta(page);
        expect(content).not.toBeNull();
        expect(MAXIMUM_SCALE_PATTERN.test(content ?? '')).toBe(false);
      } finally {
        await page.close();
      }
    }, 120_000);
  }
});

describe('WCAG 1.4.4 (W65) — programmatic pinch-zoom must not be blocked', () => {
  it('simulated pinch-zoom on /login raises visualViewport.scale above 1.5', async () => {
    const iPhone13 = {
      name: 'iPhone 13',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      viewport: {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        isLandscape: false,
      },
    };

    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    try {
      await page.emulate(iPhone13);
      await page.goto(`${BASE_URL}/login`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      const viewportMeta = await getViewportMeta(page);
      expect(
        MAXIMUM_SCALE_PATTERN.test(viewportMeta ?? ''),
        `maximum-scale=1 MUST NOT be present — found: "${viewportMeta}"`
      ).toBe(false);

      const cdp = await page.createCDPSession();

      const centerX = 195;
      const centerY = 422;
      const startSpread = 60;

      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: centerX - startSpread, y: centerY, id: 1, radiusX: 10, radiusY: 10, force: 1 },
          { x: centerX + startSpread, y: centerY, id: 2, radiusX: 10, radiusY: 10, force: 1 },
        ],
        modifiers: 0,
      });

      for (let i = 1; i <= 10; i++) {
        const delta = startSpread + i * 30;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: centerX - delta, y: centerY, id: 1, radiusX: 10, radiusY: 10, force: 1 },
            { x: centerX + delta, y: centerY, id: 2, radiusX: 10, radiusY: 10, force: 1 },
          ],
          modifiers: 0,
        });
        await new Promise((r) => setTimeout(r, 40));
      }

      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
        modifiers: 0,
      });

      await new Promise((r) => setTimeout(r, 300));

      const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);

      expect(
        scale,
        `visualViewport.scale must be > 1.5 after pinch-zoom (was ${scale}). ` +
          'This confirms the browser is not blocking user scaling. ' +
          'If this fails, the viewport meta may have reintroduced maximum-scale=1.'
      ).toBeGreaterThan(1.5);
    } finally {
      await page.close();
    }
  }, 120_000);
});
