/**
 * Task #171 — GET /api/invitations/:id/history.
 *
 * Verifies the role-gating + scoping that mirrors the MCP
 * get_invitation_history tool:
 *   - tenants  -> 403
 *   - admins   -> can read history for any invitation
 *   - managers -> can ONLY read history for invitations they sent
 *
 * The drizzle `db` is mocked with a tiny in-memory store so we exercise
 * the route's branching logic (lookup → permission check → audit query)
 * without needing a real database.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

type Invitation = { id: string; invitedByUserId: string };
type AuditRow = {
  id: string;
  invitationId: string;
  action: string;
  previousStatus: string | null;
  newStatus: string | null;
  performedBy: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
  performedByName: string | null;
  performedByEmail: string | null;
};

const state: {
  invitations: Invitation[];
  audit: AuditRow[];
  user: { id: string; role: string } | null;
} = {
  invitations: [],
  audit: [],
  user: null,
};

// Minimal chainable query builder. We only need to support the two
// shapes the new endpoint actually issues:
//   1. select(...).from(invitations).where(...).limit(1)
//   2. select(count()).from(invitationAuditLog).where(...)
//   3. select(...).from(invitationAuditLog).leftJoin(users, ...)
//        .where(...).orderBy(...).limit(...).offset(...)
function makeChain(resolver: () => unknown[]) {
  const opts: { limit?: number; offset?: number; ordered?: boolean } = {};
  const apply = () => {
    let rows = resolver();
    if (opts.ordered) {
      rows = [...rows].sort((a, b) => {
        const da = (a as { createdAt?: Date }).createdAt?.getTime() ?? 0;
        const dbb = (b as { createdAt?: Date }).createdAt?.getTime() ?? 0;
        return dbb - da;
      });
    }
    if (opts.offset) rows = rows.slice(opts.offset);
    if (opts.limit !== undefined) rows = rows.slice(0, opts.limit);
    return Promise.resolve(rows);
  };
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.leftJoin = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => {
    opts.ordered = true;
    return chain;
  };
  chain.limit = (n: number) => {
    opts.limit = n;
    const t: Record<string, unknown> = {
      then: (cb: (v: unknown) => unknown) => apply().then(cb),
      offset: (o: number) => {
        opts.offset = o;
        return apply();
      },
    };
    return t;
  };
  chain.offset = (o: number) => {
    opts.offset = o;
    return apply();
  };
  (chain as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (cb) =>
    apply().then(cb);
  return chain;
}

let nextSelectKind: 'invitation-lookup' | 'audit-count' | 'audit-page' = 'invitation-lookup';
let lookupId = '';

jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn((projection?: Record<string, unknown>) => {
      // Heuristic on which select shape the route is issuing.
      const keys = projection ? Object.keys(projection) : [];
      if (keys.length === 1 && keys[0] === 'value') {
        nextSelectKind = 'audit-count';
      } else if (keys.includes('invitedByUserId')) {
        nextSelectKind = 'invitation-lookup';
      } else {
        nextSelectKind = 'audit-page';
      }

      return makeChain(() => {
        if (nextSelectKind === 'invitation-lookup') {
          const inv = state.invitations.find((i) => i.id === lookupId);
          return inv ? [inv] : [];
        }
        if (nextSelectKind === 'audit-count') {
          const rows = state.audit.filter((r) => r.invitationId === lookupId);
          return [{ value: rows.length }];
        }
        return state.audit.filter((r) => r.invitationId === lookupId);
      });
    }),
    insert: jest.fn(() => ({ values: () => Promise.resolve() })),
    update: jest.fn(() => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    })),
    delete: jest.fn(),
  },
}));

jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = state.user;
    next();
  },
}));

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

beforeEach(() => {
  state.invitations = [
    { id: 'inv-by-bob', invitedByUserId: 'bob' },
    { id: 'inv-by-alice', invitedByUserId: 'alice' },
  ];
  state.audit = [
    {
      id: 'a1',
      invitationId: 'inv-by-bob',
      action: 'create',
      previousStatus: null,
      newStatus: 'pending',
      performedBy: 'bob',
      ipAddress: null,
      userAgent: null,
      details: { source: 'rest' },
      createdAt: new Date('2026-04-01T00:00:00Z'),
      performedByName: 'Bob Boss',
      performedByEmail: 'bob@example.com',
    },
  ];
  state.user = null;
});

describe('GET /api/invitations/:id/history (task #171)', () => {
  it('returns 403 for tenants', async () => {
    state.user = { id: 'tenant-1', role: 'tenant' };
    lookupId = 'inv-by-bob';
    const res = await request(buildApp()).get('/api/invitations/inv-by-bob/history');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_PERMISSIONS' });
  });

  it('returns 404 when the invitation does not exist', async () => {
    state.user = { id: 'admin-1', role: 'admin' };
    lookupId = 'missing';
    const res = await request(buildApp()).get('/api/invitations/missing/history');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'INVITATION_NOT_FOUND' });
  });

  it('lets admins read history for any invitation', async () => {
    state.user = { id: 'admin-1', role: 'admin' };
    lookupId = 'inv-by-bob';
    const res = await request(buildApp()).get('/api/invitations/inv-by-bob/history');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: 'a1',
      action: 'create',
      performedByName: 'Bob Boss',
    });
    expect(res.body).toMatchObject({ limit: 25, offset: 0, hasMore: false });
  });

  it('lets managers read history for invitations they sent', async () => {
    state.user = { id: 'bob', role: 'manager' };
    lookupId = 'inv-by-bob';
    const res = await request(buildApp()).get('/api/invitations/inv-by-bob/history');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('forbids managers from reading history for invitations someone else sent', async () => {
    state.user = { id: 'bob', role: 'manager' };
    lookupId = 'inv-by-alice';
    const res = await request(buildApp()).get('/api/invitations/inv-by-alice/history');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_PERMISSIONS' });
  });

  it('clamps the limit to the documented range and accepts offset', async () => {
    state.user = { id: 'admin-1', role: 'admin' };
    lookupId = 'inv-by-bob';
    const res = await request(buildApp()).get(
      '/api/invitations/inv-by-bob/history?limit=999&offset=5',
    );
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
    expect(res.body.offset).toBe(5);
  });

  it('returns audit rows newest-first and reports hasMore for paginated slices', async () => {
    // Seed three rows in chronological order; the route is expected to
    // surface them newest-first so administrators see the most recent
    // lifecycle event first.
    state.audit = [
      {
        id: 'old',
        invitationId: 'inv-by-bob',
        action: 'create',
        previousStatus: null,
        newStatus: 'pending',
        performedBy: 'bob',
        ipAddress: null,
        userAgent: null,
        details: { source: 'rest' },
        createdAt: new Date('2026-04-01T00:00:00Z'),
        performedByName: 'Bob Boss',
        performedByEmail: 'bob@example.com',
      },
      {
        id: 'mid',
        invitationId: 'inv-by-bob',
        action: 'resend',
        previousStatus: 'pending',
        newStatus: 'pending',
        performedBy: 'bob',
        ipAddress: null,
        userAgent: null,
        details: { source: 'rest' },
        createdAt: new Date('2026-04-10T00:00:00Z'),
        performedByName: 'Bob Boss',
        performedByEmail: 'bob@example.com',
      },
      {
        id: 'new',
        invitationId: 'inv-by-bob',
        action: 'cancelled',
        previousStatus: 'pending',
        newStatus: 'cancelled',
        performedBy: 'bob',
        ipAddress: null,
        userAgent: null,
        details: { source: 'rest' },
        createdAt: new Date('2026-04-19T00:00:00Z'),
        performedByName: 'Bob Boss',
        performedByEmail: 'bob@example.com',
      },
    ];
    state.user = { id: 'admin-1', role: 'admin' };
    lookupId = 'inv-by-bob';

    const res = await request(buildApp()).get(
      '/api/invitations/inv-by-bob/history?limit=2',
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(2);
    // newest-first ordering: the cancelled row is most recent and must
    // come before the resend row in the page.
    expect(res.body.items.map((r: { id: string }) => r.id)).toEqual(['new', 'mid']);
    expect(res.body.hasMore).toBe(true);
  });
});
