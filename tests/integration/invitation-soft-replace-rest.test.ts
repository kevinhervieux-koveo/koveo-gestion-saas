/**
 * Task #189 — REST POST /api/invitations soft-replace regression.
 *
 * Two consecutive REST invites for the same
 * (organizationId, email, residenceId) tuple must:
 *   1. Insert a brand-new invitation row.
 *   2. Mark the prior pending invitation as status='replaced' (NOT
 *      hard-delete it) via `db.update(invitations).set({status:'replaced'})`.
 *   3. Write an `invitation_audit_log` row with action='replaced'
 *      whose `details.replacedByInvitationId` points at the new
 *      invitation.
 *   4. Also write the standard `created` audit row for the new
 *      invitation.
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
  // return a prior row. We toggle this per scenario.
  returnPriorInvitation: boolean;
  // Task #204 — when true, every `db.insert(invitations).values(...)` call
  // rejects with a pg-style unique-violation (code '23505'). This forces
  // both attempts inside `createInvitationWithSoftReplace` to lose the
  // race and the helper to throw `InvitationSoftReplaceRaceLostError`,
  // which the REST handler must translate to a 409.
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
 * The route issues these SELECTs in order (admin path, no manager
 * org-type lookup):
 *   1. `select({id}).from(invitations).where(...)` — existing pending
 *      invitation lookup for soft-replace dedup.
 *   2. `select().from(organizations).where(...).limit(1)` — org name
 *      for the email body.
 *
 * `storage.getUserByEmail` is mocked separately so it does NOT consume
 * a SELECT here.
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
    // The soft-replace helper now wraps the dedup-select + replace + insert
    // in `db.transaction(cb)` so the mock just runs the callback inline,
    // passing the same mock db as the tx handle.
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const { db } = jest.requireMock('../../server/db') as { db: unknown };
      return cb(db);
    }),
    select: jest.fn(() => selectChain()),
    insert: jest.fn((table: unknown) => ({
      // Support both `await .values(...)` (audit log inserts) and
      // `.values(...).returning()` (the new invitation insert).
      values: (vals: unknown) => {
        const name = tableName(table);
        state.insertCalls.push({ tableName: name, values: vals });
        if (state.forceUniqueViolationOnInsert && name === 'invitations') {
          // Simulate the partial-unique-index violation that a concurrent
          // invite would raise. The helper's `isUniqueViolation` walks
          // the cause chain looking for `code === '23505'`.
          const err = new Error(
            'duplicate key value violates unique constraint "invitations_pending_org_email_residence_unique"',
          ) as Error & { code?: string };
          err.code = '23505';
          const rejected = Promise.reject(err) as Promise<unknown> & {
            returning?: () => Promise<unknown[]>;
          };
          // Swallow the unhandled-rejection warning if `.returning()` is
          // never chained — the helper always chains it on the invitation
          // insert, but be defensive for audit-log paths just in case.
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
import { InvitationSoftReplaceRaceLostError } from '../../server/services/invitation-soft-replace';

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

describe('POST /api/invitations — soft-replace regression (task #189)', () => {
  it('soft-replaces a prior pending invitation and writes a replaced audit row pointing at the new one', async () => {
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

    expect(res.status).toBe(201);

    // (1) New invitation row inserted.
    const invitationInsert = state.insertCalls.find((c) => c.tableName === 'invitations');
    expect(invitationInsert).toBeDefined();
    const invVals = invitationInsert!.values as Record<string, unknown>;
    expect(invVals.email).toBe('duplicate@example.com');
    expect(invVals.residenceId).toBe(RESIDENCE_ID);

    // (2) Soft-replace: db.update(invitations).set({status:'replaced'}) was
    // called, and the prior row was NOT hard-deleted.
    const replaceUpdate = state.updateCalls.find(
      (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
    );
    expect(replaceUpdate).toBeDefined();
    expect(state.deleteCalls.find((c) => c.tableName === 'invitations')).toBeUndefined();

    // (3) `invitation_audit_log` row with action='replaced' whose
    // details.replacedByInvitationId points at the new invitation.
    const auditInserts = state.insertCalls.filter(
      (c) => c.tableName === 'invitation_audit_log',
    );
    const auditRows = auditInserts.flatMap((c) =>
      Array.isArray(c.values)
        ? (c.values as Record<string, unknown>[])
        : [c.values as Record<string, unknown>],
    );
    const replacedAudit = auditRows.find((r) => r.action === 'replaced');
    expect(replacedAudit).toBeDefined();
    expect(replacedAudit!.invitationId).toBe(PRIOR_INVITATION_ID);
    expect(replacedAudit!.previousStatus).toBe('pending');
    expect(replacedAudit!.newStatus).toBe('replaced');
    const details = replacedAudit!.details as Record<string, unknown>;
    expect(details.source).toBe('rest');
    expect(details.route).toBe('POST /api/invitations');
    expect(details.replacedByInvitationId).toBe('new-invitation-id');

    // (4) Standard 'created' audit row for the new invitation.
    const createdAudit = auditRows.find((r) => r.action === 'created');
    expect(createdAudit).toBeDefined();
    expect(createdAudit!.invitationId).toBe('new-invitation-id');
  });

  it('does not call db.update on invitations when there is no prior pending row', async () => {
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
    expect(
      state.updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();
    // Only the 'created' audit row should have been written.
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

describe('POST /api/invitations — duplicate-pending conflict mapping (task #204)', () => {
  it('returns 409 with a friendly INVITATION_ALREADY_PENDING payload when the helper exhausts its retry', async () => {
    // Force every invitation insert to raise a pg-style 23505 unique
    // violation so both attempts inside `createInvitationWithSoftReplace`
    // lose the race and the helper throws
    // `InvitationSoftReplaceRaceLostError`. The REST handler must map
    // that to a 4xx (409), NOT a generic 500.
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
    // The post-retry helper error class is the contractual signal we map
    // on; surface it explicitly so a future refactor that swallows the
    // class fails this test loudly.
    expect(new InvitationSoftReplaceRaceLostError()).toBeInstanceOf(Error);
    // Driver / SQL details must NOT leak through the friendly message.
    expect(res.body.message).not.toContain('duplicate key');
    expect(res.body.message).not.toContain('invitations_pending');
    expect(res.body.message).not.toContain('23505');
  });
});
