/**
 * @jest-environment node
 *
 * End-to-end test verifying that manager-only nav links never flash for a
 * tenant user, even on throttled 3G networks where auth hydration is slow.
 *
 * Strategy:
 *  1. Log in as the seeded MCP tenant on a normal connection so the session
 *     cookie is established.
 *  2. Apply a 3G-class network throttle via Chrome DevTools Protocol before
 *     navigating to the post-login landing page.
 *  3. Inject a MutationObserver into the page that records any DOM node whose
 *     `href` attribute matches a manager-only path.  The observer runs from
 *     the moment navigation starts until the sidebar nav has fully hydrated
 *     (detected by the presence of at least one real nav link in the sidebar).
 *  4. Assert no manager-only node was ever observed.
 *
 * The manager-only href list is derived from NAVIGATION_CONFIG so it stays in
 * sync with the navigation configuration automatically.
 *
 * Fails loudly if Chromium or the dev server is unavailable to avoid masking
 * regressions in CI.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'node:fs';
import puppeteer, { type Browser, type Page, type CDPSession } from 'puppeteer';
import { NAVIGATION_CONFIG } from '../../client/src/config/navigation';

const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL || 'mcp-tenant@koveo-mcp.test';
const TENANT_PASSWORD = process.env.E2E_TENANT_PASSWORD || 'McpTest2024!';

/**
 * Recursively collects all href values from a list of navigation items.
 */
function collectHrefs(items: Array<{ href?: string; items?: any[] }>): string[] {
  return items.flatMap((item) => {
    const hrefs: string[] = [];
    if (item.href) hrefs.push(item.href);
    if (item.items && item.items.length > 0) {
      hrefs.push(...collectHrefs(item.items));
    }
    return hrefs;
  });
}

/**
 * Manager-only hrefs derived directly from NAVIGATION_CONFIG.
 * Stays in sync with client/src/config/navigation.ts automatically.
 */
const MANAGER_ONLY_HREFS: string[] = NAVIGATION_CONFIG.filter(
  (section) => section.requiredRole === 'manager'
).flatMap((section) => collectHrefs(section.items));

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

let chromium: string;
let browser: Browser;

beforeAll(async () => {
  // Verify we actually derived some hrefs from config; fail early if config changed.
  if (MANAGER_ONLY_HREFS.length === 0) {
    throw new Error(
      'MANAGER_ONLY_HREFS is empty — no manager-only sections found in ' +
        'NAVIGATION_CONFIG. Check client/src/config/navigation.ts.'
    );
  }

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
        'server or set E2E_BASE_URL before running the e2e suite.'
    );
  }

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
}, 90_000);

afterAll(async () => {
  if (browser) await browser.close().catch(() => undefined);
}, 30_000);

async function loginAsTenant(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid=input-email]', { visible: true });
  await page.type('[data-testid=input-email]', TENANT_EMAIL);
  await page.type('[data-testid=input-password]', TENANT_PASSWORD);
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

describe('Sidebar nav: manager-only links must not flash for tenants on slow networks', () => {
  it('never shows a manager-only nav link during 3G-throttled page load', async () => {
    const page = await browser.newPage();
    page.on('pageerror', (err) => {
      console.error('[pageerror]', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[console.error]', msg.text());
      }
    });

    let cdp: CDPSession | null = null;

    try {
      await page.setViewport({ width: 1400, height: 900 });

      // Step 1: log in on a normal connection so the session cookie is set.
      await loginAsTenant(page);

      // Verify we are logged in (not a manager) before throttling.
      const pathAfterLogin = await page.evaluate(() => window.location.pathname);
      expect(pathAfterLogin).not.toContain('/auth/login');

      // Step 2: open a CDP session and apply a 3G-class throttle.
      cdp = await page.createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: (750 * 1024) / 8,   // 750 kbps download
        uploadThroughput: (250 * 1024) / 8,      // 250 kbps upload
        latency: 300,                             // 300 ms RTT
      });

      // Step 3: inject a MutationObserver BEFORE navigating so it captures
      //         every DOM node added from the very first paint onward.
      //         The hrefs are passed in from NAVIGATION_CONFIG so this stays
      //         in sync with the sidebar config automatically.
      await page.evaluateOnNewDocument((managerHrefs: string[]) => {
        (window as any).__managerLinksObserved = [];

        function checkNode(node: Node) {
          if (!(node instanceof Element)) return;
          const href = node.getAttribute('href') || '';
          for (const managerHref of managerHrefs) {
            if (href === managerHref || href.startsWith(managerHref + '?')) {
              (window as any).__managerLinksObserved.push(href);
            }
          }
          // Also scan children of newly added subtrees.
          node.querySelectorAll('[href]').forEach((el) => {
            const childHref = el.getAttribute('href') || '';
            for (const managerHref of managerHrefs) {
              if (
                childHref === managerHref ||
                childHref.startsWith(managerHref + '?')
              ) {
                (window as any).__managerLinksObserved.push(childHref);
              }
            }
          });
        }

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            mutation.addedNodes.forEach(checkNode);
          }
        });

        document.addEventListener('DOMContentLoaded', () => {
          observer.observe(document.body, { childList: true, subtree: true });
        });

        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      }, MANAGER_ONLY_HREFS);

      // Step 4: navigate to the post-login landing page under throttle.
      await page.goto(`${BASE_URL}/dashboard/overview`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      // Step 5: wait until the sidebar nav has fully hydrated.
      // Hydration is complete when at least one real nav <a> appears.
      await page.waitForFunction(
        () => {
          const nav = document.querySelector('nav');
          if (!nav) return false;
          return nav.querySelectorAll('a[href]').length > 0;
        },
        { timeout: 60_000, polling: 100 }
      );

      // Give React one more tick to flush any deferred renders.
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Step 6: assert the MutationObserver never recorded a manager link.
      const observed = await page.evaluate(
        () => (window as any).__managerLinksObserved as string[]
      );

      if (observed.length > 0) {
        console.error(
          '[nav-tenant-flash] Manager-only links were observed in the DOM:',
          observed
        );
      }

      expect(observed).toHaveLength(0);

      // Sanity: the tenant's Settings link should be present after hydration.
      const tenantLinksFound = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        if (!nav) return false;
        return nav.querySelector('a[href="/settings"]') !== null;
      });
      expect(tenantLinksFound).toBe(true);
    } finally {
      if (cdp) {
        await cdp
          .send('Network.emulateNetworkConditions', {
            offline: false,
            downloadThroughput: -1,
            uploadThroughput: -1,
            latency: 0,
          })
          .catch(() => undefined);
      }
      await page.close();
    }
  }, 120_000);
});
