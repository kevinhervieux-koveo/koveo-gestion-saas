/**
 * @jest-environment node
 *
 * End-to-end test: unauthenticated users who land on a nonexistent URL must
 * see the 404 page, not a spinner, and the URL must NOT change to /login.
 *
 * Task #1498 — Show the 404 page to unauthenticated users instead of a spinner
 *
 * Coverage:
 *   1. Navigating to /this-route-does-not-exist without authenticating renders
 *      the 404 page (h1 visible, "Go to Login" CTA visible).
 *   2. The URL stays at /this-route-does-not-exist — no redirect to /login.
 *   3. The page does not contain a persistent loading spinner after the SPA
 *      has hydrated (i.e. auth resolution completes and 404 is shown).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const NONEXISTENT_PATH = '/this-route-does-not-exist';
const TIMEOUT = 60_000;

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
});

describe('Unauthenticated 404 catch-all', () => {
  it(
    'shows the 404 page (h1 + CTA visible) without redirecting to /login',
    async () => {
      const page: Page = await browser.newPage();

      try {
        // Navigate as a fresh, unauthenticated visitor.
        await page.goto(`${BASE_URL}${NONEXISTENT_PATH}`, {
          waitUntil: 'networkidle2',
          timeout: TIMEOUT,
        });

        // Wait for React to hydrate and auth to resolve (spinner disappears).
        // We wait for the h1 that the NotFound component renders.
        await page.waitForFunction(
          () => {
            const h1 = document.querySelector('h1');
            return h1 !== null && h1.textContent !== null && h1.textContent.trim().length > 0;
          },
          { timeout: TIMEOUT }
        );

        // 1. The URL must NOT have changed to /login.
        const finalUrl = new URL(page.url());
        expect(finalUrl.pathname).toBe(NONEXISTENT_PATH);

        // 2. An h1 element must be visible (the 404 page heading).
        const h1Text = await page.$eval('h1', (el) => el.textContent?.trim() ?? '');
        expect(h1Text.length).toBeGreaterThan(0);

        // 3. A "Go to Login" CTA link must exist and point to /login.
        const ctaHref = await page.$eval(
          'a[href="/login"]',
          (el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''
        );
        expect(ctaHref).toBe('/login');

        // 4. No persistent loading spinner: the h1 being visible already
        //    implies the auth resolution completed and the spinner is gone.
        //    Double-check by confirming the animate-spin class is absent.
        const hasSpinner = await page.$eval(
          'body',
          (body) => body.querySelector('.animate-spin') !== null
        );
        expect(hasSpinner).toBe(false);
      } finally {
        await page.close().catch(() => undefined);
      }
    },
    TIMEOUT + 10_000
  );
});
