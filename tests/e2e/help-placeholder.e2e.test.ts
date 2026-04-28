/**
 * @jest-environment node
 *
 * End-to-end tests for the bilingual /help placeholder page (Task #1662 — H1–H7).
 *
 * Covers:
 *  - /help body contains "Aide / Help — bientôt disponible"
 *  - /help has a mailto:support@koveo-gestion.com CTA link
 *  - /help has exactly one <main id="main-content"> landmark
 *  - /help has a skip-link pointing to #main-content
 *  - /help is accessible without authentication (no redirect to /login)
 *  - /admin/help redirects to /help (final URL is /help)
 *  - /dashboard/help redirects to /help (final URL is /help)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const EXPECTED_HEADING = 'Aide / Help — bientôt disponible';
const SUPPORT_EMAIL = 'support@koveo-gestion.com';

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
    ],
  });
}, 90_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
}, 30_000);

/**
 * Navigate to a URL without any authentication cookies and wait for the SPA
 * to fully hydrate (no auth state = unauthenticated session).
 */
async function openUnauthenticated(path: string): Promise<Page> {
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 30_000 });
  return page;
}

describe('/help placeholder — content', () => {
  it('contains the bilingual heading "Aide / Help — bientôt disponible"', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).toContain(EXPECTED_HEADING);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('contains a mailto:support@koveo-gestion.com link', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const mailtoHref = await page.evaluate((email) => {
        const link = document.querySelector(`a[href="mailto:${email}"]`) as HTMLAnchorElement | null;
        return link?.href ?? null;
      }, SUPPORT_EMAIL);
      expect(mailtoHref).toBe(`mailto:${SUPPORT_EMAIL}`);
    } finally {
      await page.close();
    }
  }, 60_000);
});

describe('/help placeholder — a11y landmarks', () => {
  it('has exactly one <main> element', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const mainCount = await page.evaluate(() => document.querySelectorAll('main').length);
      expect(mainCount).toBe(1);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('<main> has id="main-content"', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const mainId = await page.evaluate(() => document.querySelector('main')?.id ?? null);
      expect(mainId).toBe('main-content');
    } finally {
      await page.close();
    }
  }, 60_000);

  it('has a skip-link pointing to #main-content', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const skipLinkHref = await page.evaluate(() => {
        const link = document.querySelector('a[href="#main-content"]') as HTMLAnchorElement | null;
        return link?.getAttribute('href') ?? null;
      });
      expect(skipLinkHref).toBe('#main-content');
    } finally {
      await page.close();
    }
  }, 60_000);
});

describe('/help placeholder — unauthenticated access', () => {
  it('is accessible without authentication — final URL is /help (not /login)', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const finalPath = await page.evaluate(() => window.location.pathname);
      expect(finalPath).toBe('/help');
    } finally {
      await page.close();
    }
  }, 60_000);

  it('document.title contains the bilingual placeholder title (W52 guard)', async () => {
    const page = await openUnauthenticated('/help');
    try {
      const title = await page.title();
      expect(title).toContain('Aide / Help');
      expect(title).toContain('Koveo Gestion');
    } finally {
      await page.close();
    }
  }, 60_000);
});

describe('help redirect routes', () => {
  it('/admin/help — final URL is /help for unauthenticated users', async () => {
    const page = await openUnauthenticated('/admin/help');
    try {
      await page.waitForFunction(() => window.location.pathname === '/help', { timeout: 15_000 });
      const finalPath = await page.evaluate(() => window.location.pathname);
      expect(finalPath).toBe('/help');
    } finally {
      await page.close();
    }
  }, 60_000);

  it('/dashboard/help — final URL is /help for unauthenticated users', async () => {
    const page = await openUnauthenticated('/dashboard/help');
    try {
      await page.waitForFunction(() => window.location.pathname === '/help', { timeout: 15_000 });
      const finalPath = await page.evaluate(() => window.location.pathname);
      expect(finalPath).toBe('/help');
    } finally {
      await page.close();
    }
  }, 60_000);
});
