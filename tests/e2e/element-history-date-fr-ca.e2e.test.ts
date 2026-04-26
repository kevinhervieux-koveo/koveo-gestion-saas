/**
 * @jest-environment node
 *
 * Regression guard for the fr-CA date-shift bug in the element history table
 * and element details panel construction-date display.
 *
 * Root cause: HistoryTable.tsx and ElementDetailsPanel.tsx previously used
 * `parseISO(eventDate)` / `parseISO(originalConstructionDate)` which interpret
 * a date-only string (`YYYY-MM-DD`) as UTC midnight. In a negative-offset
 * timezone (e.g. America/Montreal, UTC-4/UTC-5) that midnight rolls back to the
 * previous calendar day, so `2026-04-25` was displayed as `24 avril 2026`.
 *
 * The fix replaces `parseISO` with `parseDateOnly` (from
 * `client/src/lib/utils.ts`) which constructs the Date using
 * `new Date(year, month-1, day)` — always in the user's local timezone —
 * and passes the `fr` date-fns locale to `format()` so French month names
 * are guaranteed.
 *
 * This test:
 *   1. Seeds a real history entry with `eventDate = 2026-04-25` via the
 *      admin REST API and records the `eventDate` string returned by the
 *      GET history endpoint (cross-check anchor).
 *   2. Seeds `originalConstructionDate = 2026-04-25` on the element via
 *      the admin REST API.
 *   3. Launches Chromium with `TZ=America/Montreal` and `--lang=fr-CA` so
 *      the fix must hold for both date parsing and French locale lookup.
 *   4. Logs in as the demo manager, navigates to the real element history
 *      page at `/manager/maintenance/elements/:elementId/history`.
 *   5. Asserts the rendered date cell identified by
 *      `[data-testid="history-date-<id>"]` contains `25 avril 2026` and
 *      does NOT contain `24 avril` — directly catching the UTC midnight
 *      roll-back regression if `parseISO` is reintroduced.
 *   6. Asserts the construction-date display identified by
 *      `[data-testid="element-construction-date"]` also contains
 *      `25 avril 2026` — catching the same off-by-one for originalConstructionDate.
 *   7. Cross-checks both rendered strings against the API-returned values so
 *      any future UTC regression fails the test.
 *
 * Fails loudly (no silent skip) when Chromium or the dev server is missing,
 * matching the conventions of the existing e2e suite.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL || 'marie.tremblay@demo.koveo.ca';
const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD || 'demo123456';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

const EVENT_DATE = '2026-04-25';

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

interface SeededOrg { id: string }
interface SeededBuilding { id: string; organizationId?: string }
interface SeededElement { id: string; originalConstructionDate?: string | null }
interface HistoryEntry { id: string; eventDate: string }

class CookieClient {
  private cookie = '';
  constructor(private readonly label: string) {}

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(
        `${this.label} login failed (${res.status}): ${await res.text().catch(() => '')}. ` +
          `Ensure the seed data is loaded and ${email} exists.`
      );
    }
    const setCookie =
      res.headers.get('set-cookie') ??
      (res.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie?.()
        ?.join(', ') ??
      '';
    if (!setCookie) throw new Error(`${this.label} login did not return a session cookie`);
    this.cookie = setCookie
      .split(/,(?=[^;]+=)/)
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
  }

  async getJson<T>(url: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, { headers: { Cookie: this.cookie } });
    if (!res.ok) {
      throw new Error(
        `${this.label} GET ${url} failed: ${res.status} ${await res.text().catch(() => '')}`
      );
    }
    return (await res.json()) as T;
  }

  async postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: { Cookie: this.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `${this.label} POST ${url} failed: ${res.status} ${await res.text().catch(() => '')}`
      );
    }
    return (await res.json()) as T;
  }

  async putJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'PUT',
      headers: { Cookie: this.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `${this.label} PUT ${url} failed: ${res.status} ${await res.text().catch(() => '')}`
      );
    }
    return (await res.json()) as T;
  }

  async deleteRequest(url: string): Promise<void> {
    await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers: { Cookie: this.cookie },
    }).catch(() => undefined);
  }
}

let chromiumPath: string;
let browser: Browser;
let managerApi: CookieClient;
let adminApi: CookieClient;
let seededElementId: string | null = null;
let seededHistoryId: string | null = null;
let seededHistoryEventDate: string | null = null;
let originalConstructionDate: string | null = null;

async function pickFirstAccessibleElement(
  managerApiClient: CookieClient,
  adminApiClient: CookieClient,
): Promise<{ elementId: string; element: SeededElement } | null> {
  const orgs = await managerApiClient.getJson<SeededOrg[]>('/api/users/me/organizations');
  if (!Array.isArray(orgs) || orgs.length === 0) return null;

  for (const org of orgs) {
    const buildings = await managerApiClient.getJson<SeededBuilding[]>(
      `/api/users/me/buildings?organization_id=${encodeURIComponent(org.id)}`
    );
    if (!Array.isArray(buildings) || buildings.length === 0) continue;

    for (const building of buildings) {
      const elementsRes = await adminApiClient.getJson<{
        data?: SeededElement[];
        elements?: SeededElement[];
      }>(`/api/maintenance/buildings/${building.id}/elements?limit=1`);
      const elements: SeededElement[] = elementsRes?.data ?? elementsRes?.elements ?? [];
      if (Array.isArray(elements) && elements.length > 0) {
        return { elementId: elements[0].id, element: elements[0] };
      }
    }
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
  chromiumPath = found;

  let healthOk = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    healthOk = probe.ok;
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    throw new Error(
      `Koveo app is not reachable at ${BASE_URL}/api/health. Start the dev ` +
        'server (with seed data loaded) or set E2E_BASE_URL.'
    );
  }

  managerApi = new CookieClient('Manager API');
  adminApi = new CookieClient('Admin API');
  await Promise.all([
    managerApi.login(MANAGER_EMAIL, MANAGER_PASSWORD),
    adminApi.login(ADMIN_EMAIL, ADMIN_PASSWORD),
  ]);

  const target = await pickFirstAccessibleElement(managerApi, adminApi);
  if (!target) {
    throw new Error(
      `No accessible building element found for manager ${MANAGER_EMAIL}. ` +
        'Run the demo seed to populate building elements.'
    );
  }
  seededElementId = target.elementId;

  // Record the original construction date so we can restore it in afterAll
  originalConstructionDate = target.element.originalConstructionDate ?? null;

  // Seed originalConstructionDate on the element to EVENT_DATE so the
  // element details panel construction-date display can be asserted below.
  await adminApi.putJson<unknown>(
    `/api/maintenance/elements/${seededElementId}`,
    { originalConstructionDate: EVENT_DATE }
  );

  // Seed a history entry with the fixed test date
  const historyRes = await adminApi.postJson<{ success?: boolean; data?: HistoryEntry }>(
    `/api/maintenance/elements/${seededElementId}/history`,
    {
      eventType: 'repair',
      eventDate: EVENT_DATE,
      description: `E2E fr-CA date regression test ${Date.now()}`,
    }
  );
  if (!historyRes?.data?.id) {
    throw new Error(
      `Failed to seed history entry — unexpected response: ${JSON.stringify(historyRes)}`
    );
  }
  seededHistoryId = historyRes.data.id;

  // Cross-check anchor: fetch the eventDate the API returns for this entry
  const historyListRes = await managerApi.getJson<{
    success?: boolean;
    data?: HistoryEntry[];
  }>(`/api/maintenance/elements/${seededElementId}/history`);
  const entries: HistoryEntry[] = historyListRes?.data ?? [];
  const seededEntry = entries.find((e) => e.id === seededHistoryId);
  if (!seededEntry) {
    throw new Error(
      `Seeded history entry ${seededHistoryId} not found in GET /history response.`
    );
  }
  seededHistoryEventDate = seededEntry.eventDate;

  // Launch browser with America/Montreal timezone and fr-CA accept-language
  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--lang=fr-CA',
      '--accept-lang=fr-CA,fr;q=0.9,en;q=0.8',
    ],
    env: {
      ...process.env,
      TZ: 'America/Montreal',
    },
  });
}, 120_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
  if (adminApi && seededElementId && seededHistoryId) {
    await adminApi.deleteRequest(
      `/api/maintenance/elements/${seededElementId}/history/${seededHistoryId}`
    );
  }
  // Restore the original construction date on the element (null means remove)
  if (adminApi && seededElementId) {
    await adminApi
      .putJson<unknown>(`/api/maintenance/elements/${seededElementId}`, {
        originalConstructionDate: originalConstructionDate ?? null,
      })
      .catch(() => undefined);
  }
}, 30_000);

async function loginAsManager(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', MANAGER_EMAIL);
  await page.type('[data-testid=input-password]', MANAGER_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }).catch(() => undefined),
    page.click('button[type=submit]'),
  ]);
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/auth/login'),
    { timeout: 30_000 }
  );
}

describe('Element history date rendering in fr-CA / America/Montreal timezone', () => {
  it(
    'renders eventDate 2026-04-25 as "25 avril 2026" (not "24 avril") in the actual history table DOM',
    async () => {
      expect(seededHistoryEventDate).toBe(EVENT_DATE);
      expect(seededHistoryId).toBeTruthy();
      expect(seededElementId).toBeTruthy();

      const page = await browser.newPage();
      page.on('pageerror', (err) => console.error('[pageerror]', err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error('[console.error]', msg.text());
      });

      try {
        await page.setViewport({ width: 1280, height: 900 });

        // Force French UI language via localStorage before first paint
        await page.evaluateOnNewDocument(() => {
          try {
            localStorage.setItem('koveo-language', 'fr');
          } catch {
            // ignore — defaults will still apply
          }
        });

        await loginAsManager(page);

        // Emulate Montreal timezone at the DevTools/CDP level
        await page.emulateTimezone('America/Montreal');

        // Navigate to the dedicated element history page
        const historyUrl =
          `${BASE_URL}/manager/maintenance/elements/${seededElementId}/history`;
        await page.goto(historyUrl, { waitUntil: 'networkidle2', timeout: 60_000 });

        // Sanity-check: must not have been bounced to login
        const currentPath = await page.evaluate(() => window.location.pathname);
        expect(currentPath).toBe(
          `/manager/maintenance/elements/${seededElementId}/history`
        );

        // Wait for the specific seeded history row's date cell to appear in the DOM
        const dateCellSel = `[data-testid="history-date-${seededHistoryId}"]`;
        await page.waitForSelector(dateCellSel, { visible: true, timeout: 30_000 });

        // Read the rendered text from the date cell
        const dateCellText = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          return el ? el.textContent ?? '' : '';
        }, dateCellSel);

        // ── Primary assertion: eventDate ────────────────────────────────────
        // The fixed HistoryTable (using parseDateOnly + fr locale) must show
        // the correct calendar day, never the UTC-midnight rollback to the 24th.
        expect(dateCellText).toContain('25');
        expect(dateCellText).toContain('avril');
        expect(dateCellText).toContain('2026');

        // Must NOT display the off-by-one day that parseISO causes
        expect(dateCellText).not.toContain('24 avril');

        // ── Cross-check eventDate against the API ───────────────────────────
        // The eventDate that the API returned must be EVENT_DATE, and the
        // rendered string must match that date in the fr-CA calendar.
        expect(seededHistoryEventDate).toBe(EVENT_DATE);

        // The rendered date string must agree with the API's eventDate,
        // proving the test catches a regression if parsing reverts to UTC.
        const apiDay = EVENT_DATE.split('-')[2]; // '25'
        expect(dateCellText).toContain(apiDay);

        // Weekday line must also be present and reflect the same calendar day
        // (samedi for 2026-04-25, since it is a Saturday)
        const weekdayText = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          if (!el) return '';
          // The weekday is in the second <div> inside the date cell
          const divs = el.querySelectorAll('div');
          return divs.length >= 2 ? (divs[1].textContent ?? '') : '';
        }, dateCellSel);

        // Weekday must be a French day name (any of them — confirms locale is fr)
        const frenchWeekdays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        const hasFrencheWeekday = frenchWeekdays.some((d) =>
          weekdayText.toLowerCase().includes(d)
        );
        expect(hasFrencheWeekday).toBe(true);

        // 2026-04-25 is a Saturday — assert the correct day name
        expect(weekdayText.toLowerCase()).toContain('samedi');

        // ── Summary metric ─────────────────────────────────────────────────
        // The "latest entry" summary card must show the French month name for
        // the same date, directly asserting the locale-aware rendering of the
        // summary metric (not just the row cell).
        const summaryText = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="latest-entry-date-summary"]');
          return el ? (el.textContent ?? '') : '';
        });
        // 2026-04-25 → "avr. 2026" (abbreviated) or "avril 2026" (full)
        // Either way it must contain "avr" (French April abbreviation prefix)
        // and must NOT contain English "Apr".
        expect(summaryText.toLowerCase()).toMatch(/avr/);
        expect(summaryText).not.toMatch(/\bApr\b/);

        // ── Construction date assertion ─────────────────────────────────────
        // The element details panel on the history page must render the
        // originalConstructionDate (2026-04-25) as "25 avril 2026" — not
        // "24 avril" — proving parseDateOnly is used for that field too.
        const constructionDateSel = '[data-testid="element-construction-date"]';
        await page.waitForSelector(constructionDateSel, { visible: true, timeout: 15_000 });

        const constructionDateText = await page.evaluate((sel: string) => {
          const el = document.querySelector(sel);
          return el ? el.textContent ?? '' : '';
        }, constructionDateSel);

        // Must show the correct day '25 avril 2026', never '24 avril'
        expect(constructionDateText).toContain('25');
        expect(constructionDateText).toContain('avril');
        expect(constructionDateText).toContain('2026');
        expect(constructionDateText).not.toContain('24 avril');

        // Cross-check: rendered day must match API's EVENT_DATE day component
        expect(constructionDateText).toContain(apiDay);

        if (process.env.CI) {
          // eslint-disable-next-line no-console
          console.log('[diag] dateCellText:', JSON.stringify(dateCellText));
          // eslint-disable-next-line no-console
          console.log('[diag] weekdayText:', JSON.stringify(weekdayText));
          // eslint-disable-next-line no-console
          console.log('[diag] constructionDateText:', JSON.stringify(constructionDateText));
        }
      } finally {
        await page.close().catch(() => undefined);
      }
    },
    90_000
  );
});
