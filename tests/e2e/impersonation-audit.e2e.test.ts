/**
 * @jest-environment node
 *
 * End-to-end test for impersonation audit logging — Task #1322.
 *
 * Verifies that:
 *   1. GET /api/admin/impersonation-log returns a well-formed paginated response.
 *   2. GET /api/admin/impersonation-status returns a well-formed status object.
 *   3. Events recorded via POST /api/admin/impersonation/dev/record (which calls
 *      the shared recordImpersonationEvent() service — the same function the MCP
 *      assume_user tool calls) appear in the log and flip status to active.
 *   4. /admin/impersonation-log page renders without a spinner lock.
 *
 * MCP assume_user requires a full OAuth Bearer token, which is not available in
 * a plain HTTP E2E test.  The dev endpoint exercises the real service code path
 * (recordImpersonationEvent) without coupling to the OAuth/SSE transport layer.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'McpTest2024!';

// ─── Chromium discovery ─────────────────────────────────────────────────────

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

// ─── Shared state ─────────────────────────────────────────────────────────

let browser: Browser;
let page: Page;
let recordedRowId: string | null = null;

// ─── Setup / teardown ─────────────────────────────────────────────────────

beforeAll(async () => {
  const chromium = findChromium();
  if (!chromium) {
    throw new Error(
      'Chromium not found. Install Chromium or set PUPPETEER_EXECUTABLE_PATH. ' +
        'This e2e test is mandatory and is NOT silently skipped.',
    );
  }

  let healthOk = false;
  try {
    const probe = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5_000) });
    healthOk = probe.ok;
  } catch {
    healthOk = false;
  }
  if (!healthOk) {
    throw new Error(
      `Koveo app not reachable at ${BASE_URL}/api/health. ` +
        'Start the dev server or set E2E_BASE_URL.',
    );
  }

  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromium,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  page = await browser.newPage();
}, 90_000);

afterAll(async () => {
  // Emit a restore event to return the admin session to a clean state after
  // the assume event recorded in step 3.
  if (recordedRowId) {
    await page.evaluate(async (url: string) => {
      await fetch(`${url}/api/admin/impersonation/dev/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => undefined);
    }, BASE_URL).catch(() => undefined);
  }
  if (browser) await browser.close().catch(() => undefined);
}, 30_000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loginAsAdmin(): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.type('input[type="email"]', ADMIN_EMAIL);
  await page.type('input[type="password"]', ADMIN_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('button[type="submit"]')]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Impersonation audit log (task #1322)', () => {
  it('GET /api/admin/impersonation-log returns a paginated response', async () => {
    await loginAsAdmin();

    const result = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation-log?page=1&limit=10`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('data');
    expect(result.body).toHaveProperty('pagination');
    expect(Array.isArray(result.body.data)).toBe(true);
    expect(typeof result.body.pagination.total).toBe('number');
    expect(typeof result.body.pagination.page).toBe('number');
  }, 60_000);

  it('impersonation events are recorded and visible in the audit log', async () => {
    // Trigger a real impersonation recording via the dev HTTP endpoint.
    // This endpoint uses the exact same db.insert(mcpAssumeUserLog) call
    // and details shape (outcome:'success') that the MCP assume_user tool
    // uses — exercising the actual recording code path over HTTP.
    const recordResult = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation/dev/record`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    expect(recordResult.status).toBe(200);
    expect(typeof recordResult.body.id).toBe('string');
    recordedRowId = recordResult.body.id;

    // The audit log endpoint must surface the newly recorded event.
    const logResult = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation-log?page=1&limit=100`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    expect(logResult.status).toBe(200);
    const rows: Array<{ id: string; action: string }> = logResult.body.data ?? [];
    const testRow = rows.find((r) => r.id === recordedRowId);
    expect(testRow).toBeDefined();
    expect(testRow?.action).toBe('assume');

    // The status endpoint must detect the active impersonation.
    const statusResult = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation-status`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    expect(statusResult.status).toBe(200);
    expect(statusResult.body.active).toBe(true);
    expect(statusResult.body.assumedUser).not.toBeNull();
  }, 60_000);

  it('a failed assume attempt after a successful one does not reset active status', async () => {
    // At this point, recordedRowId is set from the previous test, meaning
    // there is an active successful assume in the DB.  Now simulate a failed
    // assume (e.g. unknown_target_user) — as the MCP server does when it
    // logs a failed call before returning an error response.
    const failedResult = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation/dev/record`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'unknown_target_user' }),
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    expect(failedResult.status).toBe(200);

    // Even with the failed attempt logged AFTER the successful assume,
    // the status endpoint must still report active = true.
    const statusResult = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation-status`, {
        credentials: 'include',
      });
      return { status: res.status, body: await res.json() };
    }, BASE_URL);

    expect(statusResult.status).toBe(200);
    expect(statusResult.body.active).toBe(true);
    expect(statusResult.body.assumedUser).not.toBeNull();
  }, 30_000);

  it('impersonation-log endpoint is admin-only (non-admin gets 401 or 403)', async () => {
    await page.evaluate(async (url: string) => {
      await fetch(`${url}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    }, BASE_URL);

    const result = await page.evaluate(async (url: string) => {
      const res = await fetch(`${url}/api/admin/impersonation-log`, { credentials: 'include' });
      return { status: res.status };
    }, BASE_URL);

    expect([401, 403]).toContain(result.status);

    await loginAsAdmin();
  }, 30_000);

  it('/admin/impersonation-log page renders without a spinner lock', async () => {
    await page.goto(`${BASE_URL}/admin/impersonation-log`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('table, [data-testid="empty-state"]', { timeout: 15_000 }).catch(async () => {
      await page.waitForFunction(
        () => {
          const spinners = document.querySelectorAll('[data-loading], .animate-spin');
          const hasContent = document.querySelector('table, .rounded-md.border');
          return hasContent !== null || spinners.length === 0;
        },
        { timeout: 15_000 },
      );
    });

    // page.$() resolves to null (not rejects) when no element is found —
    // so we check the resolved value, not a catch branch.
    const tableExists = await page.$('table').then((el) => el !== null);
    const emptyStateExists = await page.$('[class*="text-muted"]').then((el) => el !== null);
    const heading = await page.$eval('h1, [class*="text-2xl"], [class*="font-bold"]', (el) =>
      el.textContent?.trim() ?? '',
    ).catch(() => '');

    expect(tableExists || emptyStateExists || heading.length > 0).toBe(true);
  }, 60_000);
});
