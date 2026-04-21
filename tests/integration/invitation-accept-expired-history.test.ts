/**
 * Task #170 — Retried/concurrent expired-invite accepts must produce
 * exactly ONE history entry.
 *
 * Task #160 added a lazy "expired" transition in
 * POST /api/invitations/accept/:token using a conditional UPDATE
 * (...WHERE id=? AND status='pending') with RETURNING. Only the
 * request that actually flips the row gets back a non-empty
 * RETURNING set and writes the audit-log entry. This keeps a single
 * 'expired' history row even under retries / Promise.all races.
 *
 * The mock below does NOT hardcode the gate. Instead it inspects the
 * actual SQL the route hands to drizzle's `.where(...)` and only
 * applies the "WHERE status='pending'" gate when the predicate
 * genuinely references the invitations.status column with value
 * 'pending'. If a regression re-broadens the predicate to just
 * `eq(invitations.id, ...)` (or drops the gate entirely), both
 * concurrent updates win and the audit-row count assertion fails.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'cancelled';
type Invitation = {
  id: string;
  token: string;
  email: string;
  role: string;
  organizationId: string;
  invitedByUserId: string;
  expiresAt: Date;
  status: InvitationStatus;
  updatedAt?: Date;
};

const dialect = new PgDialect();

interface TestState {
  invitation: Invitation | null;
  auditInserts: Array<Record<string, unknown>>;
  invitationUpdates: number;
  /**
   * In concurrent mode the SELECT snapshot used by every request is
   * the original pending row, mirroring how Promise.all racing
   * requests all read the row before any of them write.
   */
  concurrentMode: boolean;
  rowSnapshotForUpdate: InvitationStatus | null;
}

const state: TestState = {
  invitation: null,
  auditInserts: [],
  invitationUpdates: 0,
  concurrentMode: false,
  rowSnapshotForUpdate: null,
};

function selectInvitationsChain() {
  const result = (): Promise<Invitation[]> =>
    Promise.resolve(state.invitation ? [{ ...state.invitation }] : []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: Invitation[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

/**
 * Inspect the SQL passed to `.where(...)` and decide:
 *   - does the predicate include `<invitations>.status = 'pending'`?
 *   - does it target the row by id?
 * We do this by rendering the SQL through drizzle's PgDialect — the
 * SAME dialect production uses — so the answer reflects exactly what
 * the route asked the database to do.
 */
function describeWhere(condition: SQL): { gatesByStatus: boolean; targetsId: boolean } {
  const query = dialect.sqlToQuery(condition);
  const sqlText = query.sql.toLowerCase();
  const params = (query.params as unknown[]).map((p) => (typeof p === 'string' ? p : p));
  return {
    gatesByStatus: /"status"\s*=\s*\$\d+/.test(sqlText) && params.includes('pending'),
    targetsId: /"id"\s*=\s*\$\d+/.test(sqlText),
  };
}

jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(() => selectInvitationsChain()),
    update: jest.fn((table: { _?: { name?: string } }) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (condition: SQL) => ({
          returning: () => {
            if (table?._?.name && table._.name !== 'invitations') {
              return Promise.resolve([]);
            }
            const inv = state.invitation;
            if (!inv) return Promise.resolve([]);

            const { gatesByStatus, targetsId } = describeWhere(condition);
            if (!targetsId) return Promise.resolve([]);

            // The gate the test cares about: status='pending' must be
            // part of the predicate. Without it both racing requests
            // would commit and we'd write two audit rows.
            const effectiveStatus = state.concurrentMode
              ? state.rowSnapshotForUpdate ?? inv.status
              : inv.status;

            if (gatesByStatus && effectiveStatus !== 'pending') {
              return Promise.resolve([]);
            }

            Object.assign(inv, vals);
            state.invitationUpdates += 1;
            // Subsequent racing writers will read this fresh status
            // when checking their gate above.
            state.rowSnapshotForUpdate = inv.status;
            return Promise.resolve([{ id: inv.id }]);
          },
        }),
      }),
    })),
    insert: jest.fn(() => ({
      values: (vals: Record<string, unknown>) => {
        if (vals && (vals as { action?: string }).action === 'expired') {
          state.auditInserts.push(vals);
        }
        return Promise.resolve();
      },
    })),
    delete: jest.fn(),
  },
}));

// Side-effect modules pulled in by registerUserRoutes that we don't
// need for the expired branch.
jest.mock('../../server/services/email-service', () => ({
  emailService: {
    sendInvitationEmail: jest.fn(),
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

function buildApp() {
  const app = express();
  app.use(express.json());
  registerUserRoutes(app);
  return app;
}

function seedExpiredPendingInvitation(): Invitation {
  const inv: Invitation = {
    id: 'inv-expired-1',
    token: 'tok-expired-1',
    email: 'expired@example.com',
    role: 'tenant',
    organizationId: 'org-1',
    invitedByUserId: 'user-inviter-1',
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    status: 'pending',
  };
  state.invitation = inv;
  state.rowSnapshotForUpdate = inv.status;
  return inv;
}

const validBody = {
  firstName: 'Ex',
  lastName: 'Pired',
  password: 'SuperSecret123!',
  language: 'en',
  dataCollectionConsent: true,
  acknowledgedRights: true,
};

beforeEach(() => {
  state.invitation = null;
  state.auditInserts = [];
  state.invitationUpdates = 0;
  state.concurrentMode = false;
  state.rowSnapshotForUpdate = null;
});

describe('POST /api/invitations/accept/:token — expired invitation history (task #170)', () => {
  it("emits the WHERE status='pending' gate in the lazy-expire UPDATE", async () => {
    // Sanity check on the contract this test file relies on: we
    // capture the predicate the route sends and verify it really does
    // gate by status. Without this, the other assertions in this file
    // would silently pass even if the gate were removed.
    const inv = seedExpiredPendingInvitation();
    const captured: { gatesByStatus: boolean; targetsId: boolean } = {
      gatesByStatus: false,
      targetsId: false,
    };
    const dbModule = await import('../../server/db');
    const original = dbModule.db.update;
    (dbModule.db as unknown as { update: typeof original }).update = jest.fn(() => ({
      set: (vals: Record<string, unknown>) => ({
        where: (condition: SQL) => ({
          returning: () => {
            Object.assign(captured, describeWhere(condition));
            Object.assign(inv, vals);
            return Promise.resolve([{ id: inv.id }]);
          },
        }),
      }),
    })) as typeof original;

    try {
      const app = buildApp();
      await request(app)
        .post(`/api/invitations/accept/${inv.token}`)
        .send(validBody)
        .expect(400);
    } finally {
      (dbModule.db as unknown as { update: typeof original }).update = original;
    }

    expect(captured.targetsId).toBe(true);
    expect(captured.gatesByStatus).toBe(true);
  });

  it('writes exactly one expired audit-log row when retried sequentially', async () => {
    const inv = seedExpiredPendingInvitation();
    const app = buildApp();

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/invitations/accept/${inv.token}`)
        .send(validBody);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVITATION_EXPIRED' });
    }

    expect(state.invitationUpdates).toBe(1);
    expect(state.auditInserts).toHaveLength(1);
    expect(state.auditInserts[0]).toMatchObject({
      invitationId: inv.id,
      action: 'expired',
      previousStatus: 'pending',
      newStatus: 'expired',
    });
    expect(state.invitation?.status).toBe('expired');
  });

  it('writes exactly one expired audit-log row when accepts race concurrently', async () => {
    const inv = seedExpiredPendingInvitation();
    state.concurrentMode = true;
    const app = buildApp();

    const N = 5;
    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        request(app).post(`/api/invitations/accept/${inv.token}`).send(validBody),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'INVITATION_EXPIRED' });
    }

    expect(state.invitationUpdates).toBe(1);
    expect(state.auditInserts).toHaveLength(1);
    expect(state.auditInserts[0]).toMatchObject({
      invitationId: inv.id,
      action: 'expired',
      previousStatus: 'pending',
      newStatus: 'expired',
    });
    expect(state.invitation?.status).toBe('expired');
  });

  it('does not write any audit row when the invitation is already expired in DB', async () => {
    const inv = seedExpiredPendingInvitation();
    inv.status = 'expired';
    state.rowSnapshotForUpdate = 'expired';
    const app = buildApp();

    const res = await request(app)
      .post(`/api/invitations/accept/${inv.token}`)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'INVITATION_EXPIRED' });
    expect(state.invitationUpdates).toBe(0);
    expect(state.auditInserts).toHaveLength(0);
  });
});
