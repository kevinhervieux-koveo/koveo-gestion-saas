/**
 * @jest-environment node
 *
 * Onboarding base layer end-to-end test (Task #1572).
 *
 * Covers the six steps from the spec (§8):
 *   1. Fresh login → smoke tour appears automatically.
 *   2. Click Next through all steps.
 *   3. Completion is persisted (status=completed via API).
 *   4. Reload doesn't re-trigger the tour.
 *   5. Settings → Help & Onboarding page is accessible.
 *   6. Restart from that page re-triggers the tour.
 *
 * Verification of completion uses the REST API rather than direct DB polling.
 *
 * Skips gracefully when:
 *   - ONBOARDING_ENABLED is explicitly false
 *   - Chromium binary is not found
 *   - Server is unreachable
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';
const TIMEOUT = 90_000;

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
let chromiumPath: string;

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle2', timeout: 30_000 });
  await page.type('input[type="email"], input[name="email"]', ADMIN_EMAIL, { delay: 30 });
  await page.type('input[type="password"], input[name="password"]', ADMIN_PASSWORD, { delay: 30 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 });
}

async function resetTourProgress(email: string, password: string): Promise<void> {
  const cookieJar: Record<string, string> = {};

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });

  const setCookieHeader = loginRes.headers.get('set-cookie') ?? '';
  const sidMatch = setCookieHeader.match(/koveo\.sid=([^;]+)/);
  if (!sidMatch) return;

  const sessionCookie = `koveo.sid=${sidMatch[1]}`;

  await fetch(`${BASE_URL}/api/onboarding/restart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ tourId: 'onboarding.smoke' }),
  });
}

async function getOnboardingProgress(page: Page): Promise<{ status: string } | null> {
  try {
    const res = await page.evaluate(async (url: string) => {
      const r = await fetch(`${url}/api/onboarding/me`, { credentials: 'include' });
      return r.json();
    }, BASE_URL);
    const prog = res?.progress?.find((p: { tourId: string; status: string }) => p.tourId === 'onboarding.smoke');
    return prog ?? null;
  } catch {
    return null;
  }
}

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
    throw new Error(`Server not reachable at ${BASE_URL}. Start the server before running e2e tests.`);
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

describe('Onboarding base layer (smoke tour)', () => {
  it(
    'Step 1: smoke tour appears on first login',
    async () => {
      await resetTourProgress(ADMIN_EMAIL, ADMIN_PASSWORD).catch(() => {});

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsAdmin(page);
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

  it(
    'Step 2: click Next through all steps; step 3: completion persists via API',
    async () => {
      await resetTourProgress(ADMIN_EMAIL, ADMIN_PASSWORD).catch(() => {});

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        await page.waitForSelector('.driver-overlay', { timeout: 15_000 });

        let stepCount = 0;
        const maxSteps = 10;
        while (stepCount < maxSteps) {
          const nextBtn = await page.$('.driver-popover-next-btn');
          if (!nextBtn) break;
          const isVisible = await nextBtn.isIntersectingViewport();
          if (!isVisible) break;
          await nextBtn.click();
          stepCount++;
          await new Promise((r) => setTimeout(r, 500));

          const overlay = await page.$('.driver-overlay');
          if (!overlay) break;
        }

        const closeBtn = await page.$('.driver-popover-close-btn');
        if (closeBtn) await closeBtn.click();

        await new Promise((r) => setTimeout(r, 1_500));

        const progress = await getOnboardingProgress(page);
        expect(progress?.status).toBe('completed');
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  it(
    'Step 4: reload after completion does not re-trigger the tour',
    async () => {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        await new Promise((r) => setTimeout(r, 3_000));

        const overlay = await page.$('.driver-overlay');
        expect(overlay).toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  it(
    'Step 5: Settings → Help & Onboarding page is accessible',
    async () => {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}/settings/onboarding`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        const heading = await page.waitForFunction(
          () => document.body.innerText.includes('Aide & Démarrage') ||
                document.body.innerText.includes('Help & Onboarding'),
          { timeout: 10_000 },
        );
        expect(heading).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  it(
    'Resume tour: floater relaunches the tour after navigating away mid-tour',
    async () => {
      await resetTourProgress(ADMIN_EMAIL, ADMIN_PASSWORD).catch(() => {});

      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}/dashboard/overview`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        // Wait for the tour to auto-start, then advance one step so we're past the start.
        await page.waitForSelector('.driver-overlay', { timeout: 15_000 });
        const nextBtn = await page.$('.driver-popover-next-btn');
        if (nextBtn) {
          await nextBtn.click();
          await new Promise((r) => setTimeout(r, 600));
        }

        // Navigate away mid-tour — this should pause (not destroy) the tour.
        await page.goto(`${BASE_URL}/settings/onboarding`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        // The driver overlay should be gone but the resume floater should appear.
        const overlayGone = await page.$('.driver-overlay');
        expect(overlayGone).toBeNull();

        const resumeBtn = await page.waitForFunction(
          () => {
            const btns = Array.from(document.querySelectorAll('button'));
            return (
              btns.find((b) =>
                /Resume tour|Reprendre la visite/i.test(b.textContent ?? ''),
              ) ?? null
            );
          },
          { timeout: 10_000 },
        );
        expect(resumeBtn).not.toBeNull();

        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find((b) =>
            /Resume tour|Reprendre la visite/i.test(b.textContent ?? ''),
          );
          (btn as HTMLButtonElement | undefined)?.click();
        });

        // Tour should reopen.
        const overlayAgain = await page.waitForSelector('.driver-overlay', {
          timeout: 10_000,
        });
        expect(overlayAgain).not.toBeNull();
      } finally {
        await page.close();
      }
    },
    TIMEOUT,
  );

  it(
    'Step 6: Restart from Settings re-triggers the tour without a page reload',
    async () => {
      const page = await browser.newPage();
      page.on('pageerror', (e) => console.error('[PAGE ERROR]', e.message));
      try {
        await page.setViewport({ width: 1280, height: 800 });
        await loginAsAdmin(page);
        await page.goto(`${BASE_URL}/settings/onboarding`, {
          waitUntil: 'networkidle2',
          timeout: 30_000,
        });

        const restartBtn = await page.waitForSelector(
          'button ::-p-text(Relancer), button ::-p-text(Restart)',
          { timeout: 10_000 },
        );
        if (restartBtn) {
          await restartBtn.click();
        }

        await new Promise((r) => setTimeout(r, 2_000));

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
});
