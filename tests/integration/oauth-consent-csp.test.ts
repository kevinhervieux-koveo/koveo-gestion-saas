/**
 * Task #128 — Verify the OAuth consent GET handler patches the outgoing
 * Content-Security-Policy header so that:
 *   1. The inline double-click-protection script is allowed via a
 *      per-request `'nonce-<value>'` on `script-src`, AND that the
 *      same nonce is rendered as the `nonce="..."` attribute on the
 *      `<script>` tag in the page body.
 *   2. `form-action` includes `https:` so the POST handler's 302
 *      redirect to the external OAuth callback (e.g. claude.ai) is
 *      not blocked by browsers that enforce form-action across the
 *      redirect chain.
 *
 * These guard against the production regression described in the task:
 * clicking "Approve" on /oauth/consent silently failed because both the
 * inline script and the cross-origin redirect were blocked by CSP.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

import { registerOAuthConsentRoutes } from '../../server/mcp/oauth-consent';
import { db } from '../../server/db';

const TEST_USER_ID = 'user-1';
const TEST_CLIENT_ID = 'client-1';
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const FLOW_CODE = 'koac_test_flow_code';

const BASELINE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Simulate Helmet by setting a baseline CSP header on every response
  // before the consent route runs.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', BASELINE_CSP);
    next();
  });

  // Fake session middleware: every request is authenticated as TEST_USER_ID.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { session?: { userId?: string } }).session = {
      userId: TEST_USER_ID,
    };
    next();
  });

  const provider = {
    clientsStore: {
      getClient: async () => ({ client_id: TEST_CLIENT_ID, client_name: 'Claude' }),
    },
    getPendingFlow: async () => ({
      code: FLOW_CODE,
      clientId: TEST_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      status: 'pending' as const,
      used: false,
      userId: null,
      role: null,
      state: 'opaque-state',
      scopes: ['mcp'],
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      codeChallenge: 'challenge',
      resource: null,
    }),
    finalizeAuthorization: async () => ({
      code: FLOW_CODE,
      redirectUri: REDIRECT_URI,
      state: 'opaque-state',
    }),
    denyAuthorization: async () => null,
  } as unknown as Parameters<typeof registerOAuthConsentRoutes>[1];

  (db.select as jest.Mock).mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: async () => [
          { id: TEST_USER_ID, email: 'admin@example.com', role: 'admin' },
        ],
      }),
    }),
  }));

  registerOAuthConsentRoutes(app, provider);
  return app;
}

describe('OAuth consent — CSP nonce + form-action patch (Task #128)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp();
  });

  it('GET /oauth/consent adds a nonce to script-src and renders the same nonce on the inline <script>', async () => {
    const res = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);

    expect(res.status).toBe(200);

    const csp = res.headers['content-security-policy'];
    expect(typeof csp).toBe('string');

    // script-src must include a 'nonce-<base64>' entry alongside the
    // pre-existing 'self' source.
    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/i);
    expect(scriptSrcMatch).not.toBeNull();
    const scriptSrcValue = scriptSrcMatch![1];
    expect(scriptSrcValue).toContain("'self'");

    const nonceMatch = scriptSrcValue.match(/'nonce-([^']+)'/);
    expect(nonceMatch).not.toBeNull();
    const headerNonce = nonceMatch![1];
    expect(headerNonce.length).toBeGreaterThan(0);

    // The same nonce must appear on the inline <script> tag in the page.
    expect(res.text).toContain(`<script nonce="${headerNonce}">`);
  });

  it('GET /oauth/consent extends form-action with https: to allow the external OAuth redirect', async () => {
    const res = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);

    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy'];
    expect(typeof csp).toBe('string');

    const formActionMatch = csp.match(/form-action\s+([^;]+)/i);
    expect(formActionMatch).not.toBeNull();
    const formActionValue = formActionMatch![1];
    // Pre-existing 'self' must be preserved alongside the new https:.
    expect(formActionValue).toContain("'self'");
    expect(formActionValue).toMatch(/(^|\s)https:(\s|$)/);
  });

  it('GET /oauth/consent leaves unrelated CSP directives untouched', async () => {
    const res = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);
    const csp = res.headers['content-security-policy'];
    expect(csp).toMatch(/default-src\s+'self'/i);
    expect(csp).toMatch(/style-src\s+'self'\s+'unsafe-inline'/i);
  });

  it('issues a fresh nonce on each request (not a static value)', async () => {
    const r1 = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);
    const r2 = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);
    const n1 = r1.headers['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
    const n2 = r2.headers['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
    expect(n1).toBeTruthy();
    expect(n2).toBeTruthy();
    expect(n1).not.toBe(n2);
  });
});
