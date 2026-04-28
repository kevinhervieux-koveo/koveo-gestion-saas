/**
 * @jest-environment node
 *
 * End-to-end tests for the 404 Not Found page (W11 follow-up).
 *
 * The NotFound component renders as a catch-all inside AuthenticatedLayout's
 * <main id="main-content" role="main"> wrapper. Tests assert:
 *  - Exactly one <main id="main-content"> landmark (no duplicate).
 *  - Skip-to-main link (href="#main-content") is present.
 *  - <main h1> contains the localized 404 title in EN and FR.
 *  - document.title is set to the localized title (W52 pattern).
 *  - Authenticated CTA links to /dashboard/overview.
 *  - Unauthenticated CTA links to /login (isolated browser context).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page, type BrowserContext } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

const NOT_FOUND_PATH = '/this-route-does-not-exist-404-test';

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
      'Chromium executable not found. Install Chromium or set PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  let healthOk = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    healthOk = probe.ok;
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    throw new Error(
      `Koveo app is not reachable at ${BASE_URL}/api/health. Start the dev server first.`
    );
  }

  browser = await puppeteer.launch({
    headless: true,
    executablePath: found,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
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
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }).catch(() => undefined),
    page.click('button[type=submit]'),
  ]);
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/auth/login'),
    { timeout: 30_000 }
  );
}

async function waitForNotFoundH1(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('main h1') !== null,
    { timeout: 15_000, polling: 200 }
  );
}

describe('404 Not Found page — accessibility landmarks (W54)', () => {
  it('renders exactly one <main id="main-content"> on a 404 route', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      expect(await page.evaluate(() => document.querySelectorAll('main').length)).toBe(1);
      expect(await page.evaluate(() => document.querySelector('main')?.id)).toBe('main-content');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('skip-to-main link href="#main-content" is present', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      const skipText = await page.evaluate(() => {
        const a = document.querySelector('a[href="#main-content"]') as HTMLAnchorElement | null;
        return a ? a.textContent : null;
      });
      expect(skipText).not.toBeNull();
    } finally {
      await page.close();
    }
  }, 120_000);

  it('<main> contains an <h1> with a non-empty localized title', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'en'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent ?? null);
      expect(h1).not.toBeNull();
      expect(h1!.length).toBeGreaterThan(0);
    } finally {
      await page.close();
    }
  }, 120_000);
});

describe('404 Not Found page — localized content (EN)', () => {
  it('<main h1> contains "Page not found"', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'en'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      expect(await page.evaluate(() => document.querySelector('main h1')?.textContent ?? '')).toContain('Page not found');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('document.title contains "Page not found" and "Koveo Gestion"', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'en'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      const title = await page.title();
      expect(title).toContain('Page not found');
      expect(title).toContain('Koveo Gestion');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('authenticated CTA links to /dashboard/overview', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'en'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      const href = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('main a'));
        return links.find((a) => (a as HTMLAnchorElement).href.includes('/dashboard/overview'))
          ? '/dashboard/overview'
          : null;
      });
      expect(href).toBe('/dashboard/overview');
    } finally {
      await page.close();
    }
  }, 120_000);
});

describe('404 Not Found page — localized content (FR)', () => {
  it('<main h1> contains "Page introuvable"', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'fr'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      expect(await page.evaluate(() => document.querySelector('main h1')?.textContent ?? '')).toContain('Page introuvable');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('document.title contains "Page introuvable" and "Koveo Gestion"', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'fr'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      const title = await page.title();
      expect(title).toContain('Page introuvable');
      expect(title).toContain('Koveo Gestion');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('authenticated CTA links to /dashboard/overview', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'fr'));
      await loginAsAdmin(page);
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await waitForNotFoundH1(page);

      const href = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('main a'));
        return links.find((a) => (a as HTMLAnchorElement).href.includes('/dashboard/overview'))
          ? '/dashboard/overview'
          : null;
      });
      expect(href).toBe('/dashboard/overview');
    } finally {
      await page.close();
    }
  }, 120_000);
});

describe('404 Not Found page — unauthenticated CTA', () => {
  it('unauthenticated: CTA links to /login (isolated incognito context)', async () => {
    let context: BrowserContext | null = null;
    const pages: Page[] = [];
    try {
      context = await browser.createBrowserContext();
      const page = await context.newPage();
      pages.push(page);

      await page.setViewport({ width: 1400, height: 900 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('koveo-language', 'en'));
      await page.goto(`${BASE_URL}${NOT_FOUND_PATH}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const href = await page
        .waitForFunction(
          () => {
            const loginLink = Array.from(document.querySelectorAll('a')).find(
              (a) => (a as HTMLAnchorElement).getAttribute('href') === '/login'
            );
            return loginLink ? '/login' : null;
          },
          { timeout: 5_000, polling: 100 }
        )
        .then((h) => h.jsonValue())
        .catch(() => null);

      expect(href).toBe('/login');
    } finally {
      for (const p of pages) await p.close().catch(() => undefined);
      if (context) await context.close().catch(() => undefined);
    }
  }, 60_000);
});
