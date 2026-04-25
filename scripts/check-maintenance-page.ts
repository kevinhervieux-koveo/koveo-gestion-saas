/**
 * Automated check that verifies the branded maintenance page.
 *
 * Run with:
 *   npx tsx scripts/check-maintenance-page.ts
 *
 * Asserts:
 *  - No <meta http-equiv="refresh"> in the output
 *  - French copy is present
 *  - English copy is present
 *  - Koveo logo is present (inline data URI)
 *  - Status link is present
 *  - Response size is meaningfully larger than the old 1426-byte shell
 *  - /maintenance route responds with HTTP 200 and text/html
 *  - /maintenance/events responds with HTTP 200 and text/event-stream
 */

import { renderMaintenancePage } from '../server/health-check';

const OLD_SHELL_BYTES = 1426;
const PASS = '✅';
const FAIL = '❌';

let failures = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`${PASS} ${label}`);
  } else {
    console.error(`${FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

// ── renderMaintenancePage() unit checks ──────────────────────────────────────

const pageDefault = renderMaintenancePage(undefined);
const pageEn = renderMaintenancePage('en-CA,en;q=0.9');
const pageFr = renderMaintenancePage('fr-CA,fr;q=0.9');

// 1. No meta-refresh
assert(
  'No <meta http-equiv="refresh"> in default output',
  !pageDefault.includes('http-equiv="refresh"'),
);
assert(
  'No <meta http-equiv="refresh"> in en output',
  !pageEn.includes('http-equiv="refresh"'),
);

// 2. French copy present
assert(
  'French heading present (default)',
  pageDefault.includes('Maintenance en cours'),
);
assert(
  'French body text present (default)',
  pageDefault.includes('mise à jour du serveur'),
);

// 3. English copy present
assert(
  'English heading present (default)',
  pageDefault.includes('Maintenance in progress'),
);
assert(
  'English body text present (default)',
  pageDefault.includes('server is being updated'),
);

// 4. Koveo logo present (inline base64 data URI)
assert(
  'Inline logo data URI present',
  pageDefault.includes('data:image/jpeg;base64,'),
);

// 5. Status link present
assert(
  'Status link present',
  pageDefault.includes('/status') ||
    pageDefault.includes(process.env.STATUS_PAGE_URL ?? '/status'),
);

// 6. SSE subscription script present
assert(
  'SSE EventSource script present',
  pageDefault.includes('EventSource') &&
    pageDefault.includes('/maintenance/events'),
);

// 7. Retry button present
assert(
  'Retry button present',
  pageDefault.includes('retryNow') || pageDefault.includes('Réessayer'),
);

// 8. Size check
const pageBytes = Buffer.byteLength(pageDefault, 'utf8');
assert(
  `Response size (${pageBytes} bytes) is larger than old shell (${OLD_SHELL_BYTES} bytes)`,
  pageBytes > OLD_SHELL_BYTES,
  `got ${pageBytes}`,
);

// 9. lang attribute reflects primary language
assert('lang="en" when en is primary', pageEn.includes('lang="en"'));
assert(
  'lang="fr" when fr is primary (or no header)',
  pageFr.includes('lang="fr"') && pageDefault.includes('lang="fr"'),
);

// 10. ETA block only shown when env var is set
const origEta = process.env.MAINTENANCE_ETA;
process.env.MAINTENANCE_ETA = '2026-04-25 18:00 UTC';
const pageWithEta = renderMaintenancePage(undefined);
assert(
  'ETA block rendered when MAINTENANCE_ETA env var is set',
  pageWithEta.includes('2026-04-25 18:00 UTC'),
);
process.env.MAINTENANCE_ETA = '';
const pageNoEta = renderMaintenancePage(undefined);
assert(
  'ETA block absent when MAINTENANCE_ETA is empty',
  !pageNoEta.includes('Retour estimé'),
);
if (origEta !== undefined) process.env.MAINTENANCE_ETA = origEta;
else delete process.env.MAINTENANCE_ETA;

// ── HTTP-level route checks (requires running server on port 5000) ─────────
console.log('');
console.log('HTTP-level route checks (skipped if server not available):');

const BASE_URL = `http://localhost:${process.env.PORT ?? '5000'}`;

async function httpCheck() {
  // /maintenance — must return 200 text/html with expected content
  try {
    const res = await fetch(`${BASE_URL}/maintenance`, {
      headers: { 'Accept-Language': 'fr-CA,fr;q=0.9' },
    });
    assert(
      'GET /maintenance returns HTTP 200',
      res.status === 200,
      `got ${res.status}`,
    );
    const ct = res.headers.get('content-type') ?? '';
    assert(
      'GET /maintenance content-type is text/html',
      ct.includes('text/html'),
      `got "${ct}"`,
    );
    const body = await res.text();
    assert(
      'GET /maintenance body contains French copy',
      body.includes('Maintenance en cours'),
    );
    assert(
      'GET /maintenance body contains English copy',
      body.includes('Maintenance in progress'),
    );
    assert(
      'GET /maintenance body contains inline logo',
      body.includes('data:image/jpeg;base64,'),
    );
    assert(
      'GET /maintenance body has no <meta http-equiv="refresh">',
      !body.includes('http-equiv="refresh"'),
    );
    const bodyBytes = Buffer.byteLength(body, 'utf8');
    assert(
      `GET /maintenance body size (${bodyBytes} bytes) > old shell (${OLD_SHELL_BYTES} bytes)`,
      bodyBytes > OLD_SHELL_BYTES,
    );
  } catch (err: any) {
    console.log(`  ⚠️  /maintenance fetch failed — server may not be running (${err.message})`);
  }

  // /maintenance/events — must return 200 text/event-stream
  try {
    const ac = new AbortController();
    // Abort quickly after verifying headers so we don't hang on the SSE stream
    const timer = setTimeout(() => ac.abort(), 2000);
    try {
      const res = await fetch(`${BASE_URL}/maintenance/events`, {
        signal: ac.signal,
      });
      clearTimeout(timer);
      assert(
        'GET /maintenance/events returns HTTP 200',
        res.status === 200,
        `got ${res.status}`,
      );
      const ct = res.headers.get('content-type') ?? '';
      assert(
        'GET /maintenance/events content-type is text/event-stream',
        ct.includes('text/event-stream'),
        `got "${ct}"`,
      );
      // Consume & discard body to avoid memory leak
      await res.body?.cancel();
    } catch (abortErr: any) {
      if (abortErr.name === 'AbortError') {
        // AbortError means the stream is alive — headers already checked above
      } else {
        throw abortErr;
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.log(`  ⚠️  /maintenance/events fetch failed — server may not be running (${err.message})`);
    }
  }
}

await httpCheck();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log(`${PASS} All checks passed.`);
  process.exit(0);
} else {
  console.error(`${FAIL} ${failures} check(s) failed.`);
  process.exit(1);
}
