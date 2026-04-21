/**
 * @jest-environment node
 *
 * Second end-to-end test for DocumentInlineViewer that complements
 * `document-inline-viewer.e2e.test.ts`. The companion suite uploads its own
 * fixture PDFs at runtime; this suite instead exercises the production
 * `DocumentInlineViewer` React component against documents that already exist
 * in the seeded demo database (the same data shipped to the live app).
 *
 * It boots no harness: it drives the real Express + Vite dev server via a
 * real Chromium browser, logs in through the production login form with a
 * demo user, opens a document from the building documents page and a
 * document attached to a bill from the manager bills page, asserts the
 * production shadcn Dialog opens with the iframe pointing at the file
 * endpoint, and confirms that clicking Download saves a real file to disk.
 *
 * Mandatory: fails loudly if Chromium or the dev server is unavailable so
 * regressions are not masked by silent skips in CI.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import puppeteer, { type Browser, type Page, type CDPSession } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TEST_EMAIL = process.env.E2E_USER_EMAIL || 'marie.tremblay@demo.koveo.ca';
const TEST_PASSWORD = process.env.E2E_USER_PASSWORD || 'demo123456';

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

interface SeededBuilding {
  id: string;
  organizationId: string;
}

interface SeededDocument {
  id: string;
  name: string;
  fileName: string;
  buildingId?: string | null;
  attachedToType?: string | null;
  attachedToId?: string | null;
}

interface SeededBill {
  id: string;
  buildingId: string;
}

class DemoApi {
  private cookie = '';

  async login(): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (!res.ok) {
      throw new Error(`Demo login failed: ${res.status} ${await res.text()}`);
    }
    const setCookie =
      res.headers.get('set-cookie') ??
      (res.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie?.()
        ?.join(', ') ??
      '';
    if (!setCookie) throw new Error('Demo login did not return a session cookie');
    this.cookie = setCookie
      .split(/,(?=[^;]+=)/)
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { Cookie: this.cookie },
    });
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  async listBuildings(): Promise<SeededBuilding[]> {
    const body = await this.getJson<
      SeededBuilding[] | { buildings: SeededBuilding[] }
    >('/api/manager/buildings');
    const list = Array.isArray(body) ? body : body.buildings;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('No buildings accessible to the demo user — run the demo seed');
    }
    return list;
  }

  async findBuildingDocument(buildingId: string): Promise<SeededDocument> {
    const docs = await this.getJson<SeededDocument[]>(
      `/api/documents?buildingId=${encodeURIComponent(buildingId)}&limit=50`
    );
    const standalone = docs.find(
      (d) => d.fileName?.toLowerCase().endsWith('.pdf') && !d.attachedToType
    );
    if (!standalone) {
      throw new Error(
        `No seeded standalone PDF document found for building ${buildingId} — run the demo seed`
      );
    }
    return standalone;
  }

  async findBillWithAttachment(buildingId: string): Promise<{
    bill: SeededBill;
    document: SeededDocument;
  }> {
    const bills = await this.getJson<SeededBill[]>(
      `/api/bills?buildingId=${encodeURIComponent(buildingId)}&limit=100`
    );
    for (const bill of bills) {
      const docs = await this.getJson<SeededDocument[]>(
        `/api/documents?attachedToType=bill&attachedToId=${encodeURIComponent(bill.id)}`
      );
      const pdf = docs.find((d) => d.fileName?.toLowerCase().endsWith('.pdf'));
      if (pdf) return { bill, document: pdf };
    }
    throw new Error(
      `No seeded bill with PDF attachment found for building ${buildingId} — run the demo seed`
    );
  }
}

let chromium: string;
let browser: Browser;
let browserCdp: CDPSession;
let downloadDir: string;
let api: DemoApi;
let building: SeededBuilding;
let buildingDoc: SeededDocument;
let bill: SeededBill;
let billDoc: SeededDocument;

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
        'server (with the demo data seeded) or set E2E_BASE_URL before running ' +
        'the e2e suite.'
    );
  }

  api = new DemoApi();
  await api.login();

  const buildings = await api.listBuildings();
  building = buildings[0];
  buildingDoc = await api.findBuildingDocument(building.id);
  ({ bill, document: billDoc } = await api.findBillWithAttachment(building.id));

  downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-viewer-seeded-e2e-'));
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
  browserCdp = await browser.target().createCDPSession();
  await browserCdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
    eventsEnabled: true,
  });
}, 90_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
  if (downloadDir && fs.existsSync(downloadDir)) {
    fs.rmSync(downloadDir, { recursive: true, force: true });
  }
}, 30_000);

async function newAuthedPage(): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.evaluateOnNewDocument(() => {
    (window as unknown as { __popupCount: number }).__popupCount = 0;
    const original = window.open;
    window.open = function (...args: unknown[]) {
      (window as unknown as { __popupCount: number }).__popupCount += 1;
      return original.apply(window, args as Parameters<typeof window.open>);
    } as typeof window.open;
  });
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', TEST_EMAIL);
  await page.type('[data-testid=input-password]', TEST_PASSWORD);
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
  return page;
}

async function assertProductionDialogOpen(page: Page, expectedFileUrl: string): Promise<void> {
  await page.waitForSelector('[data-testid=iframe-inline-viewer]', {
    visible: true,
    timeout: 15_000,
  });
  // Confirm the production shadcn Dialog wiring (role=dialog, aria-modal)
  // is actually in the DOM, not just our iframe selector.
  const dialogRole = await page.evaluate(() => {
    const dialog = document.querySelector('[role=dialog]');
    return dialog?.getAttribute('aria-modal');
  });
  expect(dialogRole).toBe('true');

  const src = await page.$eval(
    '[data-testid=iframe-inline-viewer]',
    (el) => (el as HTMLIFrameElement).getAttribute('src')
  );
  expect(src).toBe(expectedFileUrl);

  await page.waitForSelector('[data-testid=button-inline-viewer-download]', {
    visible: true,
  });
  await page.waitForSelector('[data-testid=button-inline-viewer-close]', {
    visible: true,
  });

  const fetched = await page.evaluate(async (u: string) => {
    const r = await fetch(u, { credentials: 'include' });
    const buf = await r.arrayBuffer();
    return {
      ok: r.ok,
      status: r.status,
      type: r.headers.get('Content-Type'),
      size: buf.byteLength,
    };
  }, expectedFileUrl);
  expect(fetched.ok).toBe(true);
  expect(fetched.status).toBe(200);
  expect(fetched.type).toMatch(/application\/pdf/);
  expect(fetched.size).toBeGreaterThan(100);

  const popups = await page.evaluate(
    () => (window as unknown as { __popupCount?: number }).__popupCount ?? 0
  );
  expect(popups).toBe(0);
}

async function waitForDownloadedFile(
  before: Set<string>,
  expectedSubstring: string,
  timeoutMs = 20_000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = fs
      .readdirSync(downloadDir)
      .filter((f) => !before.has(f) && !f.endsWith('.crdownload'));
    const match = current.find((f) => f.includes(expectedSubstring));
    if (match) {
      const stat = fs.statSync(path.join(downloadDir, match));
      if (stat.size > 0) return match;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(
    `No downloaded file containing "${expectedSubstring}" appeared within ${timeoutMs}ms`
  );
}

describe('DocumentInlineViewer against the seeded demo app (real browser)', () => {
  it('opens the production dialog for a seeded building document', async () => {
    const page = await newAuthedPage();
    try {
      await page.goto(
        `${BASE_URL}/manager/buildings/${building.id}/documents`,
        { waitUntil: 'networkidle2', timeout: 30_000 }
      );
      const viewBtn = `[data-testid="view-document-${buildingDoc.id}"]`;
      await page.waitForSelector(`[data-testid="document-card-${buildingDoc.id}"]`, {
        timeout: 30_000,
      });
      await page.waitForSelector(viewBtn, { timeout: 15_000 });
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) throw new Error(`view action button ${sel} not in DOM`);
        el.scrollIntoView({ block: 'center' });
        el.click();
      }, viewBtn);
      await page.waitForSelector('[data-testid=button-view-document-file]', {
        visible: true,
        timeout: 15_000,
      });
      await page.click('[data-testid=button-view-document-file]');
      await assertProductionDialogOpen(
        page,
        `/api/documents/${buildingDoc.id}/file`
      );
    } finally {
      await page.close();
    }
  }, 120_000);

  it('downloads the seeded building document file to disk', async () => {
    const page = await newAuthedPage();
    try {
      await page.goto(
        `${BASE_URL}/manager/buildings/${building.id}/documents`,
        { waitUntil: 'networkidle2', timeout: 30_000 }
      );
      const viewBtn = `[data-testid="view-document-${buildingDoc.id}"]`;
      await page.waitForSelector(viewBtn, { timeout: 30_000 });
      await page.evaluate((sel) => {
        (document.querySelector(sel) as HTMLElement | null)?.click();
      }, viewBtn);
      await page.waitForSelector('[data-testid=button-view-document-file]', {
        visible: true,
      });
      await page.click('[data-testid=button-view-document-file]');
      await page.waitForSelector('[data-testid=iframe-inline-viewer]', {
        visible: true,
      });

      const before = new Set(fs.readdirSync(downloadDir));
      await page.click('[data-testid=button-inline-viewer-download]');
      const saved = await waitForDownloadedFile(before, buildingDoc.fileName);
      const bytes = fs.readFileSync(path.join(downloadDir, saved));
      expect(bytes.length).toBeGreaterThan(100);
      expect(bytes.slice(0, 5).toString('utf-8')).toBe('%PDF-');
    } finally {
      await page.close();
    }
  }, 120_000);

  it('opens the production dialog for a seeded bill attachment', async () => {
    const page = await newAuthedPage();
    try {
      await page.goto(
        `${BASE_URL}/manager/bills?organization=${building.organizationId}&building=${building.id}`,
        { waitUntil: 'networkidle2', timeout: 30_000 }
      );
      const editBtn = `[data-testid="button-edit-bill-${bill.id}"]`;
      await page.waitForSelector(editBtn, { timeout: 30_000 });
      await page.click(editBtn);

      // The edit dialog renders attached documents via AttachedFileSection,
      // each with a duplicate `button-view-file` testId. Scope by row text
      // to find the row matching the seeded fixture file name.
      await page.waitForFunction(
        (fileName: string) => {
          const buttons = Array.from(
            document.querySelectorAll('[data-testid="button-view-file"]')
          );
          return buttons.some((btn) => {
            let row: Element | null = btn;
            for (let i = 0; i < 6 && row; i += 1) {
              row = row.parentElement;
              if (row && row.textContent?.includes(fileName)) return true;
            }
            return false;
          });
        },
        { timeout: 30_000 },
        billDoc.fileName
      );
      const clicked = await page.evaluate((fileName: string) => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[data-testid="button-view-file"]'
          )
        );
        for (const btn of buttons) {
          let row: Element | null = btn;
          for (let i = 0; i < 6 && row; i += 1) {
            row = row.parentElement;
            if (row && row.textContent?.includes(fileName)) {
              btn.scrollIntoView({ block: 'center' });
              btn.click();
              return true;
            }
          }
        }
        return false;
      }, billDoc.fileName);
      expect(clicked).toBe(true);

      await assertProductionDialogOpen(
        page,
        `/api/documents/${billDoc.id}/file`
      );
    } finally {
      await page.close();
    }
  }, 120_000);
});
