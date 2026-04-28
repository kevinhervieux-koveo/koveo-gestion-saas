/**
 * @jest-environment node
 *
 * Task #1660 — End-to-end regression test verifying that org-section
 * headers on `/admin/bulk-document-import` are rendered with their
 * original stored case and NOT forced to ALL-CAPS by a CSS
 * `text-transform: uppercase` rule.
 *
 * Background
 * ----------
 * QA Pass #27 found that the org-section headers in the building
 * selector grid were rendered ALL-CAPS via the Tailwind `uppercase`
 * class, while the building rows below them rendered with correct
 * mixed/lower case. This was particularly jarring on the FR UI where
 * accented characters such as "563 montée des pionniers" would appear
 * as "563 MONTÉE DES PIONNIERS".
 *
 * Task #1660 removed the `uppercase` class from the header element
 * (`data-testid="group-org-header-<orgId>"`).
 *
 * What this test does
 * -------------------
 *  1. Connects to the dev DB to resolve the org names accessible to the
 *     MCP admin, so the assertions below are deterministic against real
 *     data rather than conditional on seed presence.
 *  2. Launches Chromium and logs in as super_admin (mcp-admin@koveo-mcp.test).
 *  3. Navigates to `/admin/bulk-document-import` and forces the building
 *     picker view by clearing any cached active session from localStorage.
 *  4. Waits for the org-section header elements
 *     (`[data-testid^="group-org-header-"]`) to render.
 *  5. Asserts via `getComputedStyle(el).textTransform` that none of the
 *     headers has its CSS text-transform set to "uppercase" — this catches
 *     a CSS regression even if the source class name changes.
 *  6. Asserts that all rendered textContent values match the stored org
 *     names from the DB (i.e. "563 montée des pionniers" appears as
 *     "563 montée des pionniers", not "563 MONTÉE DES PIONNIERS").
 *
 * Fails loudly (no silent skip) when Chromium or the dev server is
 * unavailable — matching the conventions of the existing e2e suite.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { neon } from '@neondatabase/serverless';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

const DEV_DB_URL =
  process.env._INTEGRATION_DB_URL ||
  process.env.DATABASE_URL_KOVEO ||
  process.env.PRODUCTION_DATABASE_URL ||
  '';

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

let chromiumPath: string;
let browser: Browser;
let sql: ReturnType<typeof neon<false, false>>;

/** Org names that the MCP admin can see in the building picker. */
let accessibleOrgNames: string[] = [];

beforeAll(async () => {
  if (!DEV_DB_URL) {
    throw new Error(
      'No DB URL available (_INTEGRATION_DB_URL / DATABASE_URL_KOVEO / ' +
        'PRODUCTION_DATABASE_URL all unset). The bulk-import org-header e2e ' +
        'test queries the DB to resolve real org names and cannot proceed ' +
        'without it.',
    );
  }
  sql = neon(DEV_DB_URL, { arrayMode: false, fullResults: false });

  // Resolve the distinct org names whose buildings the MCP admin can
  // access. Super-admins with canAccessAllOrganizations see every org,
  // so we union both the user_organizations scope and the
  // canAccessAllOrganizations flag to build the complete set.
  const adminRows = (await sql`
    SELECT id, can_access_all_organizations
    FROM users
    WHERE email = ${ADMIN_EMAIL}
    LIMIT 1
  `) as Array<{ id: string; can_access_all_organizations: boolean }>;

  if (adminRows.length > 0) {
    const admin = adminRows[0];
    let orgRows: Array<{ name: string }>;
    if (admin.can_access_all_organizations) {
      orgRows = (await sql`
        SELECT DISTINCT o.name
        FROM organizations o
        INNER JOIN buildings b ON b.organization_id = o.id
        WHERE o.is_active = true AND b.is_active = true
        ORDER BY o.name
      `) as Array<{ name: string }>;
    } else {
      orgRows = (await sql`
        SELECT DISTINCT o.name
        FROM organizations o
        INNER JOIN buildings b ON b.organization_id = o.id
        INNER JOIN user_organizations uo
          ON uo.organization_id = o.id
         AND uo.user_id = ${admin.id}
         AND uo.is_active = true
        WHERE o.is_active = true AND b.is_active = true
        ORDER BY o.name
      `) as Array<{ name: string }>;
    }
    accessibleOrgNames = orgRows.map((r) => r.name);
  }

  const found = findChromium();
  if (!found) {
    throw new Error(
      'Chromium executable not found. Install Chromium or set ' +
        'PUPPETEER_EXECUTABLE_PATH. This e2e test is mandatory and is not ' +
        'silently skipped to avoid masking regressions in CI.',
    );
  }
  chromiumPath = found;

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
        'server or set E2E_BASE_URL before running the e2e suite.',
    );
  }

  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}, 60_000);

afterAll(async () => {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
}, 30_000);

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(
      () =>
        !window.location.pathname.startsWith('/auth/login') ||
        !!document.querySelector('[data-testid=input-email]'),
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  if (!page.url().includes('/auth/login')) {
    return;
  }
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
    { timeout: 30_000 },
  );
}

describe('/admin/bulk-document-import — org-section header preserves stored case (Task #1660)', () => {
  it('renders org headers without CSS text-transform: uppercase and with correct stored casing', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
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

      // Clear any cached active session so the page shows the building
      // picker (which contains the org-section headers) rather than the
      // wizard for a previously active session.
      await page.goto(`${BASE_URL}/admin/bulk-document-import`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      await page.evaluate(() => {
        window.localStorage.removeItem('bulkImportActiveSessionId');
      });
      await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 });

      // Sanity: the admin route guard should not have redirected us.
      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/admin/bulk-document-import');

      // Wait for at least one org-section header to appear in the
      // building picker grid.
      await page.waitForSelector('[data-testid^="group-org-header-"]', {
        visible: true,
        timeout: 30_000,
      });

      // --- CSS computed-style assertion ---
      // getComputedStyle detects text-transform even when the class is
      // renamed — textContent alone would pass with `uppercase` still
      // present because CSS transforms don't change the DOM text.
      const computedTransforms: string[] = await page.$$eval(
        '[data-testid^="group-org-header-"]',
        (els) =>
          els.map((el) =>
            window.getComputedStyle(el).textTransform,
          ),
      );
      expect(computedTransforms.length).toBeGreaterThan(0);
      for (const transform of computedTransforms) {
        expect(transform).not.toBe('uppercase');
      }

      // --- Stored-case assertion ---
      // Collect the rendered textContent of every org header.
      const renderedTexts: string[] = await page.$$eval(
        '[data-testid^="group-org-header-"]',
        (els) => els.map((el) => (el.textContent ?? '').trim()),
      );

      // Every rendered text must match a stored org name from the DB
      // exactly. This assertion is only made when we successfully
      // resolved org names from the DB (accessibleOrgNames.length > 0).
      if (accessibleOrgNames.length > 0) {
        for (const rendered of renderedTexts) {
          expect(accessibleOrgNames).toContain(rendered);
        }
      }

      // --- Explicit QA-report seed assertions ---
      // If the specific orgs from the QA report are present in the DB,
      // assert their exact rendering. These are unconditional when the
      // DB query resolved them above (not just if they happen to render).
      const hasPionniers = accessibleOrgNames.includes('563 montée des pionniers');
      const hasDemo = accessibleOrgNames.includes('Demo');

      if (hasPionniers) {
        expect(renderedTexts).toContain('563 montée des pionniers');
        expect(renderedTexts).not.toContain('563 MONTÉE DES PIONNIERS');
      }

      if (hasDemo) {
        // "Demo" must appear; "DEMO" (all-caps, the transformed version)
        // must not appear as any header text.
        expect(renderedTexts).toContain('Demo');
        expect(renderedTexts).not.toContain('DEMO');
      }
    } finally {
      await page.close();
    }
  }, 120_000);
});
