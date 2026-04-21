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

import { registerOAuthConsentRoutes, effectiveMcpRoleForUser } from '../../server/mcp/oauth-consent';
import { db } from '../../server/db';

const TEST_USER_ID = 'user-1';
const TEST_CLIENT_ID = 'client-1';
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const FLOW_CODE = 'koac_test_flow_code';

type FakeRow = {
  code: string;
  clientId: string;
  redirectUri: string;
  status: 'pending' | 'issued';
  used: boolean;
  userId: string | null;
  role: string | null;
  state: string | null;
  scopes: string[];
  expiresAt: Date;
  codeChallenge: string;
  resource: string | null;
};

function freshRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    code: FLOW_CODE,
    clientId: TEST_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    status: 'pending',
    used: false,
    userId: null,
    role: null,
    state: 'opaque-state',
    scopes: ['mcp'],
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    codeChallenge: 'challenge',
    resource: null,
    ...overrides,
  };
}

function buildApp(rowRef: { current: FakeRow }) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Fake session middleware: every request is authenticated as TEST_USER_ID.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { session?: { userId?: string } }).session = {
      userId: TEST_USER_ID,
    };
    next();
  });

  // Stub the provider with just the two methods the consent routes call.
  const provider = {
    clientsStore: {
      getClient: async () => ({ client_id: TEST_CLIENT_ID, client_name: 'Claude' }),
    },
    getPendingFlow: async (_flow: string) => rowRef.current,
    finalizeAuthorization: async (
      flow: string,
      userId: string,
      role: string,
    ) => {
      // Mirror real behaviour: only succeeds when status is pending.
      if (rowRef.current.status !== 'pending') throw new Error('flow_already_finalized');
      rowRef.current = {
        ...rowRef.current,
        status: 'issued',
        userId,
        role,
      };
      return {
        code: flow,
        redirectUri: rowRef.current.redirectUri,
        state: rowRef.current.state,
      };
    },
    denyAuthorization: async () => null,
  } as unknown as Parameters<typeof registerOAuthConsentRoutes>[1];

  // Stub the users SELECT call inside the POST handler.
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

describe('OAuth consent — idempotent double-submit', () => {
  let rowRef: { current: FakeRow };
  let app: express.Application;

  beforeEach(() => {
    rowRef = { current: freshRow() };
    app = buildApp(rowRef);
  });

  it('first POST approve redirects to the client with a code', async () => {
    const res = await request(app)
      .post('/oauth/consent')
      .type('form')
      .send({ flow: FLOW_CODE, decision: 'approve', role: 'admin' });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    expect(location.searchParams.get('code')).toBe(FLOW_CODE);
    expect(location.searchParams.get('state')).toBe('opaque-state');
    expect(rowRef.current.status).toBe('issued');
  });

  it('second POST approve for the same flow re-redirects (no error page)', async () => {
    // Pre-flight: simulate that the first approve already succeeded.
    rowRef.current = freshRow({
      status: 'issued',
      userId: TEST_USER_ID,
      role: 'admin',
      used: false,
    });

    const res = await request(app)
      .post('/oauth/consent')
      .type('form')
      .send({ flow: FLOW_CODE, decision: 'approve', role: 'admin' });

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    expect(location.searchParams.get('code')).toBe(FLOW_CODE);
    expect(location.searchParams.get('state')).toBe('opaque-state');
  });

  it('GET /oauth/consent on an already-issued flow re-redirects instead of erroring', async () => {
    rowRef.current = freshRow({
      status: 'issued',
      userId: TEST_USER_ID,
      role: 'admin',
      used: false,
    });

    const res = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe(REDIRECT_URI);
    expect(location.searchParams.get('code')).toBe(FLOW_CODE);
  });

  it('once the auth code is exchanged (used=true), the consent page errors out (no replay)', async () => {
    rowRef.current = freshRow({
      status: 'issued',
      userId: TEST_USER_ID,
      role: 'admin',
      used: true, // already exchanged for a token
    });

    const res = await request(app)
      .post('/oauth/consent')
      .type('form')
      .send({ flow: FLOW_CODE, decision: 'approve', role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.text).toContain('invalid');
  });

  it('effectiveMcpRoleForUser maps account roles correctly', () => {
    expect(effectiveMcpRoleForUser('admin')).toBe('manager');
    expect(effectiveMcpRoleForUser('manager')).toBe('manager');
    expect(effectiveMcpRoleForUser('tenant')).toBe('tenant');
    expect(effectiveMcpRoleForUser(null)).toBe('tenant');
    expect(effectiveMcpRoleForUser(undefined)).toBe('tenant');
    expect(effectiveMcpRoleForUser('something-else')).toBe('tenant');
  });

  it('GET /oauth/consent does not render a role selector', async () => {
    const res = await request(app).get(`/oauth/consent?flow=${FLOW_CODE}`);
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/<select[\s>]/i);
    expect(res.text).not.toMatch(/name="role"/i);
  });

  it('admin user finalizes with role "manager" (admin role is downgraded for MCP)', async () => {
    const res = await request(app)
      .post('/oauth/consent')
      .type('form')
      // Even if the body smuggles role=admin, the server ignores it and
      // derives the bound role from the signed-in user's account role.
      .send({ flow: FLOW_CODE, decision: 'approve', role: 'admin' });

    expect(res.status).toBe(302);
    expect(rowRef.current.status).toBe('issued');
    expect(rowRef.current.role).toBe('manager');
  });

  it('approved flow owned by a different user is NOT replayed', async () => {
    rowRef.current = freshRow({
      status: 'issued',
      userId: 'someone-else',
      role: 'admin',
      used: false,
    });

    const res = await request(app)
      .post('/oauth/consent')
      .type('form')
      .send({ flow: FLOW_CODE, decision: 'approve', role: 'admin' });

    expect(res.status).toBe(400);
  });
});
