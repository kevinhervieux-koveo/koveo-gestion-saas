import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

// Task #153: drizzle-orm mocks were relocated out of `__mocks__/` so they
// no longer auto-apply. This suite walks the captured WHERE clause as
// JSON, which only works against the mocked operator stubs.
jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

let lastWhereClause: any = null;

const queryBuilder: any = {
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockImplementation(function (clause: any) {
    lastWhereClause = clause;
    return queryBuilder;
  }),
  orderBy: jest.fn().mockResolvedValue([]),
};

let selectCallCount = 0;
const mockDb: any = {
  select: jest.fn().mockImplementation(() => {
    selectCallCount++;
    if (selectCallCount === 1 && currentTestUser?.role !== 'admin') {
      // userOrgs lookup for non-admins
      return {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ organizationId: 'org-1' }]),
        }),
      };
    }
    return queryBuilder;
  }),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

let currentTestUser: any = null;

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = currentTestUser;
    next();
  },
}));

jest.mock('../../../server/services/consolidated-communication-service', () => ({
  communicationService: {},
}));

import { registerCommunicationRoutes } from '../../../server/api/communication';

function buildApp(user: any): Express {
  currentTestUser = user;
  const app = express();
  app.use(express.json());
  registerCommunicationRoutes(app);
  return app;
}

function serialize(clause: any): string {
  try {
    return JSON.stringify(clause, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
  } catch {
    return String(clause);
  }
}

describe('REST GET /api/communication/general recipientRoles filter', () => {
  beforeEach(() => {
    selectCallCount = 0;
    lastWhereClause = null;
  });

  it('admin call applies no WHERE filter', async () => {
    const app = buildApp({ id: 'u-admin', role: 'admin' });
    await request(app).get('/api/communication/general').expect(200);
    expect(lastWhereClause).toBeNull();
  });

  it('tenant call WHERE clause includes IS NULL, cardinality=0, EXISTS user_organizations and currentUser id', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });
    await request(app).get('/api/communication/general').expect(200);
    const text = serialize(lastWhereClause).toLowerCase();
    expect(text).toContain('recipient_roles');
    expect(text).toContain('cardinality');
    expect(text).toContain('is null');
    expect(text).toContain('user_organizations');
    expect(text).toContain('organization_role');
    // currentUser.id is bound into the EXISTS subquery so per-org role is
    // derived from user_organizations rather than the global session role.
    expect(text).toContain('u-tenant');
  });

  it('manager call WHERE clause also uses per-org organization_role lookup', async () => {
    const app = buildApp({ id: 'u-manager', role: 'manager' });
    await request(app).get('/api/communication/general').expect(200);
    const text = serialize(lastWhereClause).toLowerCase();
    expect(text).toContain('user_organizations');
    expect(text).toContain('organization_role');
    expect(text).toContain('u-manager');
  });
});
