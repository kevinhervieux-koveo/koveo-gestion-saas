/**
 * @jest-environment node
 *
 * End-to-end test: residence picker save → refresh flow (Task #1324).
 *
 * Verifies that when a manager selects a building in the hierarchical picker,
 * the selection is preserved in the URL query parameters and survives a page
 * reload, so the user lands back on the same picker step or the wrapped page.
 *
 * Strategy:
 *  1. Log in as the seeded MCP manager.
 *  2. Navigate to a page that uses withHierarchicalSelection.
 *  3. Wait until either a building card is visible OR the URL already contains
 *     ?building=<id> (auto-forwarded for single-building managers).
 *  4. If auto-forwarded: assert URL contains `building=<id>`.
 *     If cards visible: click the first card and assert URL now contains `building=<id>`.
 *  5. In both cases reload the page and assert the SAME `building=<id>` is still present.
 *  6. Assert that page content (next picker step or wrapped page) rendered — the user
 *     did not fall back to the beginning of the flow.
 *
 * Fails loudly if Chromium or the dev server is unavailable so CI catches regressions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || 'mcp-manager@koveo-mcp.test';
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || 'McpTest2024!';

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
        'PUPPETEER_EXECUTABLE_PATH. This e2e test is mandatory.',
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
      `App not reachable at ${BASE_URL}/api/health. Start the dev server ` +
        'or set E2E_BASE_URL before running the e2e suite.',
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
    ],
  });
}, 90_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
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
  await page.waitForFunction(() => !window.location.pathname.startsWith('/auth/login'), {
    timeout: 30_000,
  });
}

describe('Residence picker: building selection is persisted in URL and survives reload', () => {
  it('selecting a building writes ?building=<id> and the param is present after page reload', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));

    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsManager(page);

      // Navigate to a page that uses withHierarchicalSelection with a building step.
      await page.goto(`${BASE_URL}/manager/residences`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      // Wait until either: (a) a building card is present, OR (b) the URL already
      // includes `building=` (single-building managers are auto-forwarded).
      const pickerState = await page
        .waitForFunction(
          () => {
            const hasBuilding = window.location.href.includes('building=');
            const hasCard = document.querySelector('[data-testid^="grid-item-"]') !== null;
            return hasBuilding || hasCard;
          },
          { timeout: 20_000, polling: 200 },
        )
        .catch(() => null);

      // The picker MUST have loaded in one of the two valid states.
      expect(pickerState).not.toBeNull();

      const urlBeforeClick = await page.url();
      console.log('[e2e] URL after picker load:', urlBeforeClick);

      let expectedBuildingId: string;

      if (urlBeforeClick.includes('building=')) {
        // Auto-forwarded: the building is already selected in the URL.
        const param = new URL(urlBeforeClick).searchParams.get('building');
        expect(param).toBeTruthy();
        expectedBuildingId = param!;
        console.log('[e2e] Building was auto-forwarded to:', expectedBuildingId);
      } else {
        // Multiple buildings shown — click the first card to select a building.
        const firstCard = await page.$('[data-testid^="grid-item-"]');
        // Must have a card (we already confirmed it existed above).
        expect(firstCard).not.toBeNull();

        await firstCard!.click();

        // Wait for the URL to update with the building param.
        await page.waitForFunction(() => window.location.href.includes('building='), {
          timeout: 10_000,
          polling: 100,
        });

        const urlWithBuilding = await page.url();
        const param = new URL(urlWithBuilding).searchParams.get('building');
        expect(param).toBeTruthy();
        expectedBuildingId = param!;
        console.log('[e2e] Clicked building card, URL:', urlWithBuilding);
      }

      // ── Core assertion: reload and verify the building param survives. ──
      await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 });
      const urlAfterReload = await page.url();
      console.log('[e2e] URL after reload:', urlAfterReload);

      const buildingParamAfterReload = new URL(urlAfterReload).searchParams.get('building');
      // The same building must be present after reload (URL-based persistence).
      expect(buildingParamAfterReload).toBe(expectedBuildingId);

      // ── Secondary assertion: the user is not dumped back to the picker start. ──
      // Either the next picker step (residence cards) or the wrapped page content
      // must be visible — confirming the flow advanced correctly after reload.
      const nextStepVisible = await page
        .waitForFunction(
          () => {
            const el = document.querySelector(
              '[data-testid^="grid-item-"], [data-testid="page-header"], [data-testid="wrapped"]',
            );
            return el !== null;
          },
          { timeout: 10_000, polling: 200 },
        )
        .catch(() => null);

      expect(nextStepVisible).not.toBeNull();
    } finally {
      await page.close();
    }
  }, 120_000);
});
