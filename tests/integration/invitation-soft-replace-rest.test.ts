/**
 * Task #250 — REST POST /api/invitations duplicate-invite conflict.
 *
 * The previous "soft-replace" behavior is removed. A second REST invite
 * for the same (organizationId, email, residenceId) tuple must:
 *   1. Return HTTP 409 with a friendly INVITATION_ALREADY_PENDING payload
 *      directing the caller to `resend_invitation` or `cancel_invitation`.
 *   2. NOT insert a new invitation row.
 *   3. NOT mutate the prior pending row (no `db.update(invitations)
 *      .set({status:'replaced'})`, no hard delete).
 *   4. NOT write any `replaced` audit log entry.
 *
 * Mirrors the MCP `invite_user` regression test so a future divergence
 * between the two paths surfaces immediately.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const ORG_ID = 'org-1';
const RESIDENCE_ID = 'res-1';
const ADMIN_USER = {
  id: 'admin-1',
  role: 'admin',
  email: 'admin@example.com',
  firstName: 'Anna',
  lastName: 'Admin',
};
const PRIOR_INVITATION_ID = 'prior-pending-invitation-id';

function tableName(table: unknown): string {
  const t = table as { _?: { name?: string } };
  if (t?._?.name) return t._.name;
  for (const sym of Object.getOwnPropertySymbols(t ?? {})) {
    if (sym.description === 'drizzle:Name') {
      const v = (t as Record<symbol, unknown>)[sym];
      if (typeof v === 'string') return v;
    }
  }
  return 'unknown';
}

interface State {
  // Whether the next "existing pending invitations" SELECT should
  // return a prior row.
  returnPriorInvitation: boolean;
  // When true, every `db.insert(invitations).values(...)` call rejects
  // with a pg-style unique-violation. Used to exercise the
  // concurrent-race branch in `createInvitationWithSoftReplace`, which
  // must also surface as a 409 with INVITATION_ALREADY_PENDING.
  forceUniqueViolationOnInsert: boolean;
  insertCalls: Array<{ tableName: string; values: unknown }>;
  updateCalls: Array<{ tableName: string; values: Record<string, unknown> }>;
  deleteCalls: Array<{ tableName: string }>;
  selectCount: number;
}

const state: State = {
  returnPriorInvitation: false,
  forceUniqueViolationOnInsert: false,
  insertCalls: [],
  updateCalls: [],
  deleteCalls: [],
  selectCount: 0,
};

/**
 * The route issues these SELECTs in order (admin path):
 *   1. existing pending invitation lookup for dedup.
 *   2. organization name for the email body (only reached on success).
 */
function selectChain() {
  state.selectCount += 1;
  const idx = state.selectCount;
  const result = (): Promise<unknown[]> => {
    if (idx === 1) {
      return Promise.resolve(
        state.returnPriorInvitation ? [{ id: PRIOR_INVITATION_ID }] : [],
      );
    }
    if (idx === 2) {
      return Promise.resolve([{ id: ORG_ID, name: 'Test Org' }]);
    }
    return Promise.resolve([]);
  };
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

jest.mock('../../server/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const { db } = jest.requireMock('../../server/db') as { db: unknown };
      return cb(db);
    }),
    select: jest.fn(() => selectChain()),
    insert: jest.fn((table: unknown) => ({
      values: (vals: unknown) => {
        const name = tableName(table);
        state.insertCalls.push({ tableName: name, values: vals });
        if (state.forceUniqueViolationOnInsert && name === 'invitations') {
          const err = new Error(
            'duplicate key value violates unique constraint "invitations_pending_org_email_residence_unique"',
          ) as Error & { code?: string };
          err.code = '23505';
          const rejected = Promise.reject(err) as Promise<unknown> & {
            returning?: () => Promise<unknown[]>;
          };
          rejected.catch(() => undefined);
          rejected.returning = () => Promise.reject(err);
          return rejected;
        }
        const rows = Array.isArray(vals)
          ? (vals as Record<string, unknown>[]).map((v, i) => ({
              id: `new-${name}-${i}`,
              status: 'pending',
              ...v,
            }))
          : [{ id: 'new-invitation-id', status: 'pending', ...(vals as Record<string, unknown>) }];
        const promise = Promise.resolve(rows) as Promise<unknown> & {
          returning?: () => Promise<unknown[]>;
        };
        promise.returning = () => Promise.resolve(rows);
        return promise;
      },
    })),
    update: jest.fn((table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          state.updateCalls.push({ tableName: tableName(table), values: vals });
          return Promise.resolve();
        },
      }),
    })),
    delete: jest.fn((table: unknown) => ({
      where: () => {
        state.deleteCalls.push({ tableName: tableName(table) });
        return Promise.resolve();
      },
    })),
  },
}));

jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = ADMIN_USER;
    next();
  },
}));

jest.mock('../../server/storage', () => ({
  storage: {
    getUserByEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../server/services/email-service', () => ({
  emailService: {
    sendInvitationEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn(),
  },
}));
jest.mock('../../server/services/cache-invalidation-service', () => ({
  cacheInvalidationService: { invalidate: jest.fn() },
  createInvalidationMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../server/query-cache', () => ({
  queryCache: { get: jest.fn(), set: jest.fn(), invalidate: jest.fn() },
  CacheInvalidator: { invalidateForUser: jest.fn(), invalidateForOrganization: jest.fn() },
}));

import { registerUserRoutes } from '../../server/api/users';
import { InvitationAlreadyPendingError } from '../../server/services/invitation-soft-replace';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerUserRoutes(app);
  return app;
}

beforeEach(() => {
  state.returnPriorInvitation = false;
  state.forceUniqueViolationOnInsert = false;
  state.insertCalls = [];
  state.updateCalls = [];
  state.deleteCalls = [];
  state.selectCount = 0;
});

describe('POST /api/invitations — duplicate invite returns 409 (task #250)', () => {
  it('returns HTTP 409 with INVITATION_ALREADY_PENDING and does NOT mutate the prior pending invite', async () => {
    state.returnPriorInvitation = true;

    const res = await request(buildApp())
      .post('/api/invitations')
      .send({
        organizationId: ORG_ID,
        residenceId: RESIDENCE_ID,
        email: 'duplicate@example.com',
        role: 'tenant',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    // (1) 409 with structured error code.
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Conflict',
      code: 'INVITATION_ALREADY_PENDING',
    });
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/resend_invitation/);
    expect(res.body.message).toMatch(/cancel_invitation/);
    // Driver / SQL details must NOT leak through the friendly message.
    expect(res.body.message).not.toContain('duplicate key');
    expect(res.body.message).not.toContain('invitations_pending');
    expect(res.body.message).not.toContain('23505');

    // (2) NO new invitation row inserted.
    expect(state.insertCalls.find((c) => c.tableName === 'invitations')).toBeUndefined();

    // (3) Prior pending row is untouched: no soft-replace UPDATE, no delete.
    expect(
      state.updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();
    expect(state.deleteCalls.find((c) => c.tableName === 'invitations')).toBeUndefined();

    // (4) NO `replaced` audit log row written.
    const auditRows = state.insertCalls
      .filter((c) => c.tableName === 'invitation_audit_log')
      .flatMap((c) =>
        Array.isArray(c.values)
          ? (c.values as Record<string, unknown>[])
          : [c.values as Record<string, unknown>],
      );
    expect(auditRows.find((r) => r.action === 'replaced')).toBeUndefined();

    // The contractual error class is exported and instanceof Error.
    expect(new InvitationAlreadyPendingError()).toBeInstanceOf(Error);
  });

  it('happy path: when no prior pending invite exists, creates a new invitation and writes a created audit row', async () => {
    state.returnPriorInvitation = false;

    const res = await request(buildApp())
      .post('/api/invitations')
      .send({
        organizationId: ORG_ID,
        residenceId: RESIDENCE_ID,
        email: 'fresh@example.com',
        role: 'tenant',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);

    const invitationInsert = state.insertCalls.find((c) => c.tableName === 'invitations');
    expect(invitationInsert).toBeDefined();
    const invVals = invitationInsert!.values as Record<string, unknown>;
    expect(invVals.email).toBe('fresh@example.com');
    expect(invVals.residenceId).toBe(RESIDENCE_ID);

    expect(
      state.updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();

    const auditRows = state.insertCalls
      .filter((c) => c.tableName === 'invitation_audit_log')
      .flatMap((c) =>
        Array.isArray(c.values)
          ? (c.values as Record<string, unknown>[])
          : [c.values as Record<string, unknown>],
      );
    expect(auditRows.find((r) => r.action === 'replaced')).toBeUndefined();
    expect(auditRows.find((r) => r.action === 'created')).toBeDefined();
  });
});

describe('POST /api/invitations — concurrent unique-violation also maps to 409 (task #250)', () => {
  it('returns 409 with INVITATION_ALREADY_PENDING when a concurrent invite wins the unique-constraint race', async () => {
    // Dedup SELECT returns no prior row, but the INSERT itself raises a
    // 23505 unique violation (a concurrent invite slipped in between
    // SELECT and INSERT). The helper must translate this to
    // `InvitationAlreadyPendingError`, which the REST handler maps to 409.
    state.forceUniqueViolationOnInsert = true;

    const res = await request(buildApp())
      .post('/api/invitations')
      .send({
        organizationId: ORG_ID,
        residenceId: RESIDENCE_ID,
        email: 'racing@example.com',
        role: 'tenant',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      error: 'Conflict',
      code: 'INVITATION_ALREADY_PENDING',
    });
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).not.toContain('duplicate key');
    expect(res.body.message).not.toContain('invitations_pending');
    expect(res.body.message).not.toContain('23505');
  });
});
