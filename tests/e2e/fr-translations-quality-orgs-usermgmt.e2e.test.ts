/**
 * @jest-environment node
 *
 * End-to-end regression guard for QA Pass #27 findings W49, W70, W73.
 *
 * Asserts that with language=fr:
 *   - /admin/quality subtitle shows "Métriques de qualité…" (not the EN string)
 *   - /admin/organizations title/subtitle show FR strings
 *   - /manager/user-management role column shows localized labels (not raw values)
 *
 * And with language=en the same pages still show their English strings (no
 * false-positive regressions).
 *
 * Language is set via localStorage key "koveo-language" before each navigation,
 * matching the mechanism used by the useLanguage hook.
 *
 * Logs in as super_admin (mcp-admin@koveo-mcp.test). Falls loudly when
 * Chromium or the dev server is unavailable to avoid masking regressions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:5000').replace(/\/+$/, '');

const SA_EMAIL =
  process.env.E2E_SUPER_ADMIN_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? 'mcp-admin@koveo-mcp.test';
const SA_PASSWORD =
  process.env.E2E_SUPER_ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD ?? 'McpTest2024!';

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
      signal: AbortSignal.timeout(5_000),
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

async function loginAsSuperAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', SA_EMAIL);
  await page.type('[data-testid=input-password]', SA_PASSWORD);
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

async function setLanguage(page: Page, lang: 'fr' | 'en'): Promise<void> {
  await page.evaluate((l: string) => {
    localStorage.setItem('koveo-language', l);
  }, lang);
}

async function navigateAndWait(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 30_000 });
  const actualPath = await page.evaluate(() => window.location.pathname);
  expect(actualPath).toBe(path);
}

async function getPageBodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? '');
}

describe('FR translations — /admin/quality, /admin/organizations, /manager/user-management', () => {
  describe('language=fr: hardcoded EN strings must be absent', () => {
    it('/admin/quality subtitle renders in French', async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1400, height: 900 });
        await loginAsSuperAdmin(page);
        await setLanguage(page, 'fr');
        await navigateAndWait(page, '/admin/quality');

        const body = await getPageBodyText(page);

        expect(body).toContain('Métriques de qualité');
        expect(body).not.toContain('Quality metrics and assurance tracking');
      } finally {
        await page.close();
      }
    }, 120_000);

    it('/admin/organizations title and subtitle render in French', async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1400, height: 900 });
        await loginAsSuperAdmin(page);
        await setLanguage(page, 'fr');
        await navigateAndWait(page, '/admin/organizations');

        const body = await getPageBodyText(page);

        expect(body).toContain('Gestion des organisations');
        expect(body).toContain('Créer, consulter, modifier et supprimer');
        expect(body).not.toContain('Organizations Management');
        expect(body).not.toContain('Create, view, edit and delete organizations in the system');
      } finally {
        await page.close();
      }
    }, 120_000);

    it('/manager/user-management role column shows localized labels, not raw enum values', async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1400, height: 900 });
        await loginAsSuperAdmin(page);
        await setLanguage(page, 'fr');
        await navigateAndWait(page, '/manager/user-management');

        await page.waitForSelector('[data-testid=users-table]', { timeout: 30_000 });

        const body = await getPageBodyText(page);

        const rawEnumValuesToCheck = ['tenant', 'resident', 'manager', 'admin'];
        for (const rawValue of rawEnumValuesToCheck) {
          const roleCell = await page.evaluate((val: string) => {
            const cells = Array.from(
              document.querySelectorAll('[data-testid^="role-"]')
            );
            return cells.some((cell) => cell.textContent?.trim() === val);
          }, rawValue);
          expect(roleCell).toBe(false);
        }

        const hasFrenchLabel = await page.evaluate(() => {
          const cells = Array.from(document.querySelectorAll('[data-testid^="role-"]'));
          const frLabels = ['Locataire', 'Gestionnaire', 'Résident', 'Administrateur', 'Super administrateur', 'Locataire démo', 'Gestionnaire démo', 'Résident démo'];
          return cells.some((cell) =>
            frLabels.some((label) => cell.textContent?.includes(label))
          );
        });
        expect(hasFrenchLabel).toBe(true);
      } finally {
        await page.close();
      }
    }, 120_000);
  });

  describe('language=en regression guard: EN strings still present', () => {
    it('/admin/quality subtitle renders in English', async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1400, height: 900 });
        await loginAsSuperAdmin(page);
        await setLanguage(page, 'en');
        await navigateAndWait(page, '/admin/quality');

        const body = await getPageBodyText(page);

        expect(body).toContain('Quality metrics and assurance tracking');
        expect(body).not.toContain('Métriques de qualité');
      } finally {
        await page.close();
      }
    }, 120_000);

    it('/admin/organizations title and subtitle render in English', async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1400, height: 900 });
        await loginAsSuperAdmin(page);
        await setLanguage(page, 'en');
        await navigateAndWait(page, '/admin/organizations');

        const body = await getPageBodyText(page);

        expect(body).toContain('Organizations Management');
        expect(body).toContain('Create, view, edit and delete organizations in the system');
        expect(body).not.toContain('Gestion des organisations');
      } finally {
        await page.close();
      }
    }, 120_000);

    it('/manager/user-management role column shows English labels', async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1400, height: 900 });
        await loginAsSuperAdmin(page);
        await setLanguage(page, 'en');
        await navigateAndWait(page, '/manager/user-management');

        await page.waitForSelector('[data-testid=users-table]', { timeout: 30_000 });

        const hasEnglishLabel = await page.evaluate(() => {
          const cells = Array.from(document.querySelectorAll('[data-testid^="role-"]'));
          const enLabels = ['Tenant', 'Manager', 'Resident', 'Admin', 'Super Admin'];
          return cells.some((cell) =>
            enLabels.some((label) => cell.textContent?.includes(label))
          );
        });
        expect(hasEnglishLabel).toBe(true);
      } finally {
        await page.close();
      }
    }, 120_000);
  });
});
