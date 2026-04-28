/**
 * @jest-environment node
 *
 * Task #1227 — End-to-end smoke test for the bulk-import sessions list
 * "Anthropic looks degraded" warning surfaces (Task #1219).
 *
 * Background
 * ----------
 * Task #1219 added two warning surfaces to `/admin/bulk-document-import`:
 *
 *   1. An aggregated yellow banner above the sessions list
 *      (`data-testid="history-ai-degraded-banner"`) counting sessions
 *      whose `aiFailureSummary.aiDegraded` flag is true.
 *   2. A per-row indicator
 *      (`data-testid="history-ai-degraded-${session.id}"`) that only
 *      renders on degraded rows.
 *
 * Task #1223 covered both surfaces with a unit test
 * (`tests/unit/components/bulk-document-import-history-ai-degraded.test.tsx`),
 * but no test exercises the full live stack — auth, route guards, the
 * real `attachAiFailureSummaries` SQL aggregation in
 * `server/api/bulk-import.ts`, and the Wouter-rendered admin page
 * inside a real browser. A regression in any of those layers would
 * silently hide the warning admins now rely on.
 *
 * What this test does
 * -------------------
 *  1. Connects directly to the same database the running dev server
 *     reads from (resolved with the same precedence as
 *     `resolveDatabaseUrl()` in `scripts/run-migrations-url.ts`) so we
 *     can seed a degraded session and matching items in the exact
 *     shape `attachAiFailureSummaries` reads from. There is no admin
 *     REST endpoint that can produce a degraded session without a
 *     real Anthropic API outage, so direct DB seeding is the only
 *     deterministic path.
 *  2. Picks the seeded MCP admin's most recently created building
 *     (the MCP demo seed always provisions one for `MCP-1`) and
 *     inserts a `bulk_import_sessions` row pointing at it with
 *     `current_step = 'screening'`. Inserts four `bulk_import_items`
 *     rows; three carry a `screening` JSONB blob with
 *     `fallbackReason: 'api_error'` (a retryable Anthropic-side
 *     failure) so the per-step rate is 75 % — well above the 25 %
 *     `AI_DEGRADED_FAILURE_RATE_THRESHOLD`.
 *  3. Launches Chromium, logs in as `mcp-admin@koveo-mcp.test`, and
 *     navigates to `/admin/bulk-document-import`. Asserts the
 *     aggregated banner renders and shows our seeded session in its
 *     count, and that the per-row indicator for the seeded session
 *     id renders with the `3/4` failed/total label that proves the
 *     real backend math agrees with the seeded fixture.
 *  4. Always cleans up the seeded session and its items in `afterAll`
 *     so re-runs stay deterministic and the dev DB is not polluted.
 *
 * Fails loudly (no silent skip) when Chromium, the dev server, or the
 * Koveo DB URL are missing — matching the conventions of the existing
 * e2e suite in `tests/e2e/`.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { neon } from '@neondatabase/serverless';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'mcp-admin@koveo-mcp.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'McpTest2024!';

// The dev server resolves its DB via `resolveDatabaseUrl()`
// (`scripts/run-migrations-url.ts`): in development it prefers
// `DATABASE_URL`, falling back to `DATABASE_URL_KOVEO` /
// `PRODUCTION_DATABASE_URL`. We must seed against THE SAME database the
// running dev server reads from — otherwise the seeded session never
// surfaces in `GET /api/admin/bulk-import/sessions` and the assertions
// time out for the wrong reason.
//
// `jest.setup.simple.ts` overwrites `process.env.DATABASE_URL` with a
// fake `postgresql://test:test@localhost:5432/test_db` string for
// hermetic unit-test isolation, but `jest.polyfills.js` (which runs in
// `setupFiles`, BEFORE `setupFilesAfterEnv`) snapshots the real
// `DATABASE_URL` into `_INTEGRATION_DB_URL` first. Read that snapshot
// here so this e2e test always points at the dev DB even when the
// fake DATABASE_URL is active. Fall back to the prod aliases for the
// rare case where a CI runner sets only those (e.g. a smoke run
// against an ephemeral preview DB).
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

let seededSessionId: string | null = null;
let seededAdminId: string | null = null;
let seededBuildingId: string | null = null;

beforeAll(async () => {
  if (!DEV_DB_URL) {
    throw new Error(
      'No DB URL available (_INTEGRATION_DB_URL / DATABASE_URL_KOVEO / ' +
        'PRODUCTION_DATABASE_URL all unset). The bulk-import degraded-warning ' +
        'e2e test seeds rows directly into the same database the dev server ' +
        'reads from and cannot proceed without it.',
    );
  }
  sql = neon(DEV_DB_URL, { arrayMode: false, fullResults: false });

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

  // Look up the MCP admin user that the dev seed always provisions.
  // The admin id is needed both to scope the seeded session
  // (`admin_user_id`) and to satisfy the route's org-scoping check
  // (the admin's `user_organizations` row must cover the seeded
  // building's organization, which is true for every building in
  // MCP-1 / MCP-2 by construction in `server/mcp/seed-mcp-data.ts`).
  const adminRows = (await sql`
    SELECT id FROM users WHERE email = ${ADMIN_EMAIL} LIMIT 1
  `) as Array<{ id: string }>;
  if (adminRows.length === 0) {
    throw new Error(
      `MCP admin user ${ADMIN_EMAIL} not found in the dev DB. Run the ` +
        'MCP seed (`server/mcp/seed-mcp-data.ts`) before this e2e test.',
    );
  }
  seededAdminId = adminRows[0].id;

  // Pick any building inside an organization the admin is linked to.
  // We deliberately filter via `user_organizations` so the admin's
  // org-scope check in GET /api/admin/bulk-import/sessions returns
  // the seeded session even when the admin lacks
  // `canAccessAllOrganizations`.
  const buildingRows = (await sql`
    SELECT b.id
    FROM buildings b
    INNER JOIN user_organizations uo
      ON uo.organization_id = b.organization_id
     AND uo.user_id = ${seededAdminId}
     AND uo.is_active = true
    ORDER BY b.created_at DESC
    LIMIT 1
  `) as Array<{ id: string }>;
  if (buildingRows.length === 0) {
    throw new Error(
      `No building accessible to ${ADMIN_EMAIL} found. Ensure the MCP / ` +
        'demo seed has run so the admin is linked to at least one building.',
    );
  }
  seededBuildingId = buildingRows[0].id;

  // Insert the degraded session and its items. Step is `screening` so
  // `attachAiFailureSummaries` reads `bulk_import_items.screening` — the
  // JSONB column whose `fallbackReason` we pre-populate. Three of four
  // items carry a retryable AI failure reason so the per-step rate
  // (3/4 = 0.75) is above AI_DEGRADED_FAILURE_RATE_THRESHOLD (0.25).
  const sessionRows = (await sql`
    INSERT INTO bulk_import_sessions
      (building_id, organization_id, admin_user_id, current_step, status, progress)
    SELECT
      ${seededBuildingId},
      b.organization_id,
      ${seededAdminId},
      'screening'::bulk_import_step,
      'paused'::bulk_import_status,
      '{}'::jsonb
    FROM buildings b WHERE b.id = ${seededBuildingId}
    RETURNING id
  `) as Array<{ id: string }>;
  seededSessionId = sessionRows[0].id;

  const failedScreening = JSON.stringify({ fallbackReason: 'api_error' });
  const okScreening = JSON.stringify({ fallbackReason: null });
  // Insert items one by one — Neon's HTTP driver does not accept a
  // single `INSERT ... VALUES (...), (...), ...` over its tagged
  // template binding, and the loop is small enough that the latency
  // is negligible for an e2e seed.
  for (let i = 0; i < 3; i++) {
    await sql`
      INSERT INTO bulk_import_items
        (session_id, original_path, original_name, staged_path, content_hash,
         status, screening)
      VALUES
        (${seededSessionId},
         ${'task1227/path-' + i},
         ${'task1227-file-' + i + '.pdf'},
         ${'task1227/staged-' + i},
         ${'task1227-hash-' + i},
         'screened'::bulk_import_item_status,
         ${failedScreening}::jsonb)
    `;
  }
  await sql`
    INSERT INTO bulk_import_items
      (session_id, original_path, original_name, staged_path, content_hash,
       status, screening)
    VALUES
      (${seededSessionId},
       ${'task1227/path-ok'},
       ${'task1227-file-ok.pdf'},
       ${'task1227/staged-ok'},
       ${'task1227-hash-ok'},
       'screened'::bulk_import_item_status,
       ${okScreening}::jsonb)
  `;

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
}, 120_000);

afterAll(async () => {
  if (browser) {
    await browser.close().catch(() => undefined);
  }
  if (sql && seededSessionId) {
    // ON DELETE CASCADE on bulk_import_items.session_id removes the
    // seeded items along with the session row.
    await sql`DELETE FROM bulk_import_sessions WHERE id = ${seededSessionId}`.catch(
      () => undefined,
    );
  }
}, 30_000);

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  // The browser context is shared across `it()` blocks in this suite,
  // so a prior test may have already left a valid session cookie. In
  // that case the login route immediately redirects away (typically to
  // `/dashboard` or back to the last admin page) and the email input
  // never mounts. Detect that case and short-circuit instead of
  // waiting 30 s for a selector that will never appear.
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

describe('/super_admin/bulk-document-import — degraded warning surfaces (Task #1227)', () => {
  it('renders the aggregated banner and the per-row indicator for a seeded degraded session', async () => {
    expect(seededSessionId).toBeTruthy();

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

      await page.goto(`${BASE_URL}/super_admin/bulk-document-import`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      // Sanity: not bounced back to login by the super_admin route guard.
      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/super_admin/bulk-document-import');

      // Anchor on the history list rendering before asserting on the
      // warning surfaces — otherwise a missing testid would time out
      // for the wrong reason (e.g. the page never reached the start
      // view because an active session id was cached in localStorage).
      // We clear `bulkImportActiveSessionId` to guarantee the page
      // lands on the HistoryCard view that owns both surfaces.
      await page.evaluate(() => {
        window.localStorage.removeItem('bulkImportActiveSessionId');
      });
      await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 });

      await page.waitForSelector('[data-testid=history-list]', {
        visible: true,
        timeout: 30_000,
      });

      // 1) Aggregated banner must be present. The dev DB may already
      //    contain other degraded sessions from prior runs of unrelated
      //    tests, so we only assert that the banner renders and that
      //    its message references at least one degraded session — a
      //    deterministic per-session assertion follows below.
      const banner = await page.waitForSelector(
        '[data-testid=history-ai-degraded-banner]',
        { visible: true, timeout: 15_000 },
      );
      expect(banner).toBeTruthy();
      const bannerText = await page.$eval(
        '[data-testid=history-ai-degraded-banner-message]',
        (el) => el.textContent || '',
      );
      // Match either the English or French copy — the MCP admin's
      // preferred locale defaults to `fr` in dev, so the banner can
      // legitimately render in either language depending on whose
      // user record the seed produced. Singular/plural forms in both
      // languages contain a stable Anthropic-failure phrase we anchor on.
      expect(bannerText).toMatch(
        /high Anthropic failure rate|taux d['’]échec Anthropic élevé/i,
      );

      // 2) The per-row indicator for OUR seeded session must render
      //    with the exact failed/total math (3/4) the seed produces.
      //    The sessions list pages 20 rows at a time ordered by
      //    createdAt DESC so a freshly inserted session is on page 1;
      //    if a future change swaps the order or the page size, the
      //    fallback below pages through the list until the seeded
      //    session row appears.
      const indicatorTestId = `history-ai-degraded-${seededSessionId}`;
      let indicator = await page.$(`[data-testid="${indicatorTestId}"]`);
      let attempts = 0;
      while (!indicator && attempts < 5) {
        const loadMore = await page.$('[data-testid=button-history-load-more]');
        if (!loadMore) break;
        await loadMore.click();
        await page.waitForFunction(
          (sel) => !document.querySelector(sel) ||
            !(document.querySelector(sel) as HTMLButtonElement).disabled,
          { timeout: 10_000 },
          '[data-testid=button-history-load-more]',
        );
        indicator = await page.$(`[data-testid="${indicatorTestId}"]`);
        attempts += 1;
      }
      if (!indicator) {
        throw new Error(
          `Per-row degraded indicator [data-testid="${indicatorTestId}"] ` +
            'did not render. The aggregated banner saw at least one ' +
            'degraded session but the seeded session row is missing — ' +
            'check `attachAiFailureSummaries`, the `screening` JSONB ' +
            'reader, or the org-scoping filter on GET /api/admin/bulk-import/sessions.',
        );
      }
      const indicatorText = await indicator.evaluate(
        (el) => el.textContent || '',
      );
      // Same locale caveat as the banner — accept the French label too.
      expect(indicatorText).toMatch(
        /Anthropic (degraded|dégradé) \(3\/4\)/,
      );
    } finally {
      await page.close();
    }
  }, 120_000);

  /**
   * Task #1239 — Click-through recovery flow.
   *
   * The previous test only proved the per-row indicator and the
   * aggregated banner render. It does NOT exercise the next step in
   * the recovery flow that admins actually rely on: clicking the
   * indicator should jump into the wizard at the failed step
   * (`screening` for our seed) and reveal the "Retry AI-failed items"
   * action added in Task #1209 / Task #1202.
   *
   * If a future change quietly broke the click-to-resume routing
   * (e.g. the `onResume` callback in `HistoryCard` stopped calling
   * `setSessionId`, or the wizard stopped rendering the in-step
   * Retry button when `aiFailedCount > 0`), the indicator would
   * still appear and the prior test would still pass — but the
   * one-click recovery path would silently break. This test
   * exercises that exact path end-to-end against the live stack.
   */
  it('opens the wizard at the seeded session step and reveals the "Retry AI-failed items" button when the indicator is clicked', async () => {
    expect(seededSessionId).toBeTruthy();

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

      await page.goto(`${BASE_URL}/super_admin/bulk-document-import`, {
        waitUntil: 'networkidle2',
        timeout: 30_000,
      });

      // Sanity: not bounced back to login by the super_admin route guard.
      const path = await page.evaluate(() => window.location.pathname);
      expect(path).toBe('/super_admin/bulk-document-import');

      // Force the HistoryCard view (where the indicator lives) by
      // clearing any cached active session id from a prior test run
      // sharing this browser context. Without this the page can land
      // directly in the wizard for a different session and the
      // indicator we need to click would never render.
      await page.evaluate(() => {
        window.localStorage.removeItem('bulkImportActiveSessionId');
      });
      await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 });

      await page.waitForSelector('[data-testid=history-list]', {
        visible: true,
        timeout: 30_000,
      });

      // Locate the per-row indicator for OUR seeded session, paging
      // through the list if needed (mirrors the lookup logic in the
      // first test so a future page-size change doesn't regress this
      // one for the wrong reason).
      const indicatorTestId = `history-ai-degraded-${seededSessionId}`;
      let indicator = await page.$(`[data-testid="${indicatorTestId}"]`);
      let attempts = 0;
      while (!indicator && attempts < 5) {
        const loadMore = await page.$('[data-testid=button-history-load-more]');
        if (!loadMore) break;
        await loadMore.click();
        await page.waitForFunction(
          (sel) => !document.querySelector(sel) ||
            !(document.querySelector(sel) as HTMLButtonElement).disabled,
          { timeout: 10_000 },
          '[data-testid=button-history-load-more]',
        );
        indicator = await page.$(`[data-testid="${indicatorTestId}"]`);
        attempts += 1;
      }
      if (!indicator) {
        throw new Error(
          `Per-row degraded indicator [data-testid="${indicatorTestId}"] ` +
            'did not render. Cannot test the click-to-resume path because ' +
            'the entry point is missing.',
        );
      }

      // Click the indicator — this fires the HistoryCard `onResume`
      // callback which sets the wizard's `sessionId` state to the
      // seeded session id, mounting the wizard view in place of the
      // history list.
      await indicator.click();

      // The wizard view is gated on `sessionId` truthy; the
      // HistoryCard explicitly unmounts when that happens. Waiting
      // for the history list to disappear is the most reliable
      // signal that the wizard navigation succeeded.
      await page.waitForFunction(
        () => !document.querySelector('[data-testid=history-list]'),
        { timeout: 30_000 },
      );

      // Confirm the wizard's `sessionId` got set to OUR seeded
      // session — the page persists it via `localStorage` under
      // `bulkImportActiveSessionId`, so this is a deterministic
      // check that the click-through landed on the right session
      // (and not, e.g., the most recently active one).
      const activeId = await page.evaluate(() =>
        window.localStorage.getItem('bulkImportActiveSessionId'),
      );
      expect(activeId).toBe(seededSessionId);

      // The seeded session's `current_step` is `screening`, so the
      // wizard should mount at that step. Both the in-wizard
      // degraded banner (`auto-run-ai-degraded-banner-screening`)
      // and the step-level "Retry AI-failed items" action
      // (`auto-run-retry-failed-screening`) are rendered when the
      // per-step retryable failure rate crosses
      // `AI_DEGRADED_FAILURE_RATE_THRESHOLD` (our seed: 3/4 = 75 %
      // > 25 %). Wait for the retry button specifically — that's
      // the action the task brief calls out as the recovery the
      // admin must still be able to reach in one click.
      const retryButton = await page.waitForSelector(
        '[data-testid=auto-run-retry-failed-screening]',
        { visible: true, timeout: 30_000 },
      );
      expect(retryButton).toBeTruthy();

      // Verify the button text matches either the English or French
      // copy from Task #1202 / Task #1209. The MCP admin's preferred
      // locale defaults to `fr` in dev so we must accept either.
      const retryText = await page.$eval(
        '[data-testid=auto-run-retry-failed-screening]',
        (el) => el.textContent || '',
      );
      expect(retryText).toMatch(
        /Retry AI-failed items \(3\)|Réessayer les fichiers en échec IA \(3\)/,
      );
    } finally {
      // Reset the cached active session so a re-run of this suite
      // (or a sibling e2e test sharing this browser context) starts
      // back at the HistoryCard view instead of the wizard.
      try {
        await page.evaluate(() => {
          window.localStorage.removeItem('bulkImportActiveSessionId');
        });
      } catch {
        // Page may already be navigating away — best-effort cleanup.
      }
      await page.close();
    }
  }, 120_000);
});
