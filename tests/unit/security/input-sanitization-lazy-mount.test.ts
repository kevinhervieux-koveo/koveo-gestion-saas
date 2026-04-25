import express, { type Express } from 'express';
import request from 'supertest';
import {
  sanitizeInputMiddleware,
  buildLegacyBypassFromApp,
} from '../../../server/middleware/input-sanitization';
import { lazyMount } from '../../../server/utils/lazy-mount';

/**
 * Regression test for Task #728.
 *
 * Bug: `buildLegacyBypassFromApp` was called after `registerRoutes`, but the
 * lazy-mount trampoline has NOT yet registered any sub-routes at that moment —
 * the actual handlers are only loaded on the first matching request. As a
 * result, routes under `/api/budgets` (and other lazy-mounted prefixes) were
 * absent from the bypass map, so every forecast request was fully scanned by
 * the dangerous-input heuristics in production. A French label like
 * "Franchise Assurance (loi 141)" in `customBankFields` keys contains
 * parentheses that the LDAP-injection probe flags, causing a 400
 * (DANGEROUS_INPUT) before the handler ever ran.
 *
 * Fix: `buildLegacyBypassFromApp` now accepts a `lazyPrefixes` array. Any
 * prefix in that array that is already in `LEGACY_BYPASS_RESOURCE_ROOTS` gets
 * an all-methods prefix-based bypass rule added, so the route is bypassed even
 * before the lazy loader fires.
 *
 * This test wires a real lazy mount for `/api/budgets/:buildingId/forecast`,
 * calls `buildLegacyBypassFromApp` with `/api/budgets` in `lazyPrefixes`, and
 * then POSTs a body containing `customBankFields: { "Franchise Assurance (loi
 * 141)": 1000 }`. The test asserts that the underlying handler's 200 is
 * returned, not a 400 from the sanitizer.
 */
function buildLazyApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeInputMiddleware);

  // Wire a real lazy mount for /api/budgets using the same helper that
  // production uses. The handler simulates the forecast endpoint response.
  lazyMount(app, '/api/budgets', async () => (registry) => {
    (registry as Express).post(
      '/api/budgets/:buildingId/forecast',
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
  });

  // Call buildLegacyBypassFromApp BEFORE any request is made — just like
  // server/index.ts does after registerRoutes(). Pass '/api/budgets' as a
  // lazy prefix so the bypass covers it even though no sub-routes are
  // registered yet.
  buildLegacyBypassFromApp(app, ['/api/budgets']);

  return app;
}

describe('sanitizeInputMiddleware — lazy-mount bypass (Task #728)', () => {
  let app: Express;

  beforeAll(() => {
    app = buildLazyApp();
  });

  it('allows POST /api/budgets/:id/forecast with parenthesised customBankField keys', async () => {
    const body = {
      customBankFields: {
        'Franchise Assurance (loi 141)': 1000,
        'TPS/TVQ (taxes)': 250,
        'Réserve (urgences)': 500,
      },
      bankAccountStartAmount: 50000,
      generalInflationRate: 2,
    };

    const res = await request(app)
      .post('/api/budgets/building-abc/forecast')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('does NOT bypass a sibling path outside LEGACY_BYPASS_RESOURCE_ROOTS', async () => {
    // /api/budgets-evil is NOT in LEGACY_BYPASS_RESOURCE_ROOTS; registering a
    // handler for it so it returns 200 when the sanitizer passes through, or
    // the body itself gets scanned and flagged.
    const siblingApp = express();
    siblingApp.use(express.json({ limit: '1mb' }));
    siblingApp.use(sanitizeInputMiddleware);
    siblingApp.post('/api/budgets-evil', (_req, res) =>
      res.status(200).json({ ok: true }),
    );
    buildLegacyBypassFromApp(siblingApp, ['/api/budgets']);

    const body = { q: "1; DROP TABLE users; --" };
    const res = await request(siblingApp)
      .post('/api/budgets-evil')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DANGEROUS_INPUT');
  });
});
