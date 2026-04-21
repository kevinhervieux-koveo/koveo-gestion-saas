/**
 * Task #227 — POST /api/auth/test-cookie must NOT echo the underlying
 * session-store driver error back to the client. The session save
 * callback receives a pg-style driver error containing SQL fragments and
 * bound parameter values; the response body must not contain them.
 */
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';
import express from 'express';

jest.mock('../../../server/db', () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn(), transaction: jest.fn() },
  pool: {},
  sql: jest.fn(),
}));
jest.mock('../../../server/storage', () => ({ storage: {} }));
jest.mock('../../../server/services/email-service', () => ({
  emailService: { sendInvitationEmail: jest.fn(), sendEmail: jest.fn() },
}));
jest.mock('../../../server/query-cache', () => ({ queryCache: {} }));
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true as never),
}));
jest.mock('../../../server/config/index', () => ({
  config: {
    rateLimit: { windowMs: 60000 },
    server: { isProduction: false, domain: 'localhost' },
    session: { secret: 'test', cookie: {} },
  },
}));

// NOTE: jest.config.cjs moduleNameMapper redirects `../../../server/auth` to a
// stub mock. We must bypass that mapper to exercise the real handler, so we
// import via an extension-qualified path.
import { setupAuthRoutes } from '../../../server/auth.ts';

type Handler = (req: any, res: any, next?: any) => any;

const SQL_LEAK_SUBSTRINGS = [
  'insert into "session"',
  '"sess"',
  'pg_query',
  '$1',
  'top-secret-host:5432',
  'koveo_secret_user',
  'session-payload-pii',
];

const driverError: Error & { code?: string } = new Error(
  'insert into "session" ("sid","sess","expire") values ($1,$2,$3) - connection refused at host=top-secret-host:5432 user=koveo_secret_user / payload=session-payload-pii',
);
driverError.code = '08006';

describe('POST /api/auth/test-cookie — sanitizes session-store driver errors (task #227)', () => {
  let handler: Handler | undefined;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(() => {
    // Mount setupAuthRoutes on a real Express app and then pluck the
    // registered /api/auth/test-cookie handler out of its router stack.
    // This guarantees we exercise the exact handler that production
    // Express would invoke, without pulling in the full middleware
    // pipeline (real session store, rate-limit IPs, etc.).
    const app = express();
    setupAuthRoutes(app);
    const stack = (app as any)._router?.stack ?? [];
    const layer = stack.find(
      (l: any) => l.route && l.route.path === '/api/auth/test-cookie' && l.route.methods.post,
    );
    handler = layer?.route?.stack?.[layer.route.stack.length - 1]?.handle;
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns 500 with the standard generic shape and no SQL/parameter substrings', async () => {
    expect(handler).toBeDefined();

    const captured: { status?: number; body?: any } = {};
    const req: any = {
      sessionID: 'fake-sid',
      session: {
        save: (cb: (err: Error | null) => void) => cb(driverError),
      },
    };
    const res: any = {
      status(code: number) { captured.status = code; return res; },
      json(body: any) { captured.body = body; return res; },
    };
    await handler!(req, res);

    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({
      error: 'Internal server error',
      message: 'Failed to save session',
    });

    const body = JSON.stringify(captured.body);
    for (const leak of SQL_LEAK_SUBSTRINGS) {
      expect(body).not.toContain(leak);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedWithDriverError = consoleErrorSpy.mock.calls.some(
      (call) => call.some((arg) => arg === driverError),
    );
    expect(loggedWithDriverError).toBe(true);
  });
});
