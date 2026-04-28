/**
 * @jest-environment node
 *
 * WCAG 2.5.5 "Target Size" – interactive hit area enforcement.
 *
 * Verifies that every visible interactive element on the four pages listed in
 * the requirement has a bounding rect of at least 44×44 CSS pixels when viewed
 * on a mobile viewport (iPhone 13: 390×844, deviceScaleFactor 3).
 *
 * The test logs up to 10 offenders per page so regressions are diagnosable
 * without re-running in a headed browser.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

const IPHONE_13 = {
  width: 390,
  height: 844,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  isLandscape: false,
} as const;

const MIN_HIT_PX = 44;

const PAGES_UNDER_TEST = [
  '/dashboard/overview',
  '/manager/common-spaces-stats',
  '/manager/buildings',
  '/admin/permissions',
] as const;

let browser: Browser | null = null;
let chromium: string | null = null;

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

type Offender = { tag: string; text: string; width: number; height: number; selector: string };

async function collectSmallTargets(page: Page, minPx: number): Promise<Offender[]> {
  return page.evaluate((min) => {
    const INTERACTIVE = 'a[href], button, [role="button"], [role="link"], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const offenders: Offender[] = [];
    const elements = Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE));
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) continue;
      if (rect.width < min || rect.height < min) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('aria-label') || '').slice(0, 60).trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          selector: el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : el.tagName.toLowerCase(),
        });
        if (offenders.length >= 10) break;
      }
    }
    return offenders;
  }, minPx);
}

describe(`WCAG 2.5.5 – interactive hit areas ≥ ${MIN_HIT_PX}×${MIN_HIT_PX}px (iPhone 13)`, () => {
  for (const path of PAGES_UNDER_TEST) {
    it(`${path} – zero visible interactive elements under ${MIN_HIT_PX}×${MIN_HIT_PX}px`, async () => {
      if (!browser) throw new Error('browser not initialised');
      const page = await browser.newPage();
      try {
        await page.emulate(IPHONE_13);
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}${path}`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });
        await page.waitForFunction(
          () => !window.location.pathname.startsWith('/auth/login'),
          { timeout: 10_000 }
        );
        await new Promise((r) => setTimeout(r, 1_500));

        const offenders = await collectSmallTargets(page, MIN_HIT_PX);

        if (offenders.length > 0) {
          console.error(
            `[${path}] ${offenders.length} interactive element(s) with hit area < ${MIN_HIT_PX}×${MIN_HIT_PX}px:\n` +
              offenders
                .map((o) => `  <${o.tag}> "${o.text}" ${o.width}×${o.height}px selector=${o.selector}`)
                .join('\n')
          );
        }

        expect(offenders).toHaveLength(0);
      } finally {
        await page.close();
      }
    }, 120_000);
  }
});
