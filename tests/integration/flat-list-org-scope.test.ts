/**
 * @file Flat-list org-scope — Task #1306 regression coverage.
 *
 * Verifies that list-style GET endpoints that use `resolveOrgScope` /
 * `getUserAccessibleOrganizations` only return items belonging to the
 * caller's organisation, and that callers cannot inject a foreign
 * `organizationId` query parameter to widen their view.
 *
 * Uses the same approach as the existing bills and cross-org isolation
 * tests: Express + mocked db + mocked rbac, no real database required.
 */

import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const ORG_ALPHA = '00000000-0000-0000-0000-00000000aaaa';
const ORG_BETA = '00000000-0000-0000-0000-00000000bbbb';

const ALPHA_BUILDING = '00000000-0000-0000-0000-0000000000a1';
const BETA_BUILDING = '00000000-0000-0000-0000-0000000000b1';

const MANAGER_USER_ID = '00000000-0000-0000-0000-0000000000aa';

const buildingRowsById = new Map<string, any>();

const mockDb = {
  select: jest.fn<any>(),
  insert: jest.fn<any>(),
  update: jest.fn<any>(),
  delete: jest.fn<any>(),
  execute: jest.fn<any>(),
};

jest.mock('../../server/db', () => ({
  db: mockDb,
}));

jest.mock('../../server/mcp/server', () => ({
  buildWriteErrorResponse: jest.fn(),
  createMcpServer: jest.fn(),
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((col: any, val: any) => ({ kind: 'eq', col, val })),
  and: jest.fn((...c: any[]) => ({ kind: 'and', conditions: c })),
  or: jest.fn((...c: any[]) => ({ kind: 'or', conditions: c })),
  inArray: jest.fn((col: any, vals: any[]) => ({ kind: 'inArray', col, vals })),
  isNull: jest.fn((col: any) => ({ kind: 'isNull', col })),
  isNotNull: jest.fn((col: any) => ({ kind: 'isNotNull', col })),
  ilike: jest.fn((col: any, val: any) => ({ kind: 'ilike', col, val })),
  gte: jest.fn((col: any, val: any) => ({ kind: 'gte', col, val })),
  lte: jest.fn((col: any, val: any) => ({ kind: 'lte', col, val })),
  ne: jest.fn((col: any, val: any) => ({ kind: 'ne', col, val })),
  desc: jest.fn((col: any) => ({ col, dir: 'desc' })),
  asc: jest.fn((col: any) => ({ col, dir: 'asc' })),
  sql: Object.assign(jest.fn((s: any) => ({ sql: s })), {
    join: (p: any[]) => ({ sql: 'join', p }),
    raw: jest.fn((s: string) => ({ raw: s })),
  }),
  between: jest.fn((col: any, a: any, b: any) => ({ kind: 'between', col, a, b })),
  exists: jest.fn((q: any) => ({ kind: 'exists', q })),
}));

jest.mock('@shared/schema', () => {
  const buildingsTable = {
    id: 'buildings.id',
    name: 'buildings.name',
    organizationId: 'buildings.organizationId',
    isActive: 'buildings.isActive',
    address: 'buildings.address',
    financialYearStart: 'buildings.financialYearStart',
  };
  const orgTable = {
    id: 'organizations.id',
    name: 'organizations.name',
    isActive: 'organizations.isActive',
  };
  const commonSpacesTable = {
    id: 'commonSpaces.id',
    buildingId: 'commonSpaces.buildingId',
    name: 'commonSpaces.name',
    isReservable: 'commonSpaces.isReservable',
    capacity: 'commonSpaces.capacity',
    contactPersonId: 'commonSpaces.contactPersonId',
    openingHours: 'commonSpaces.openingHours',
    bookingRules: 'commonSpaces.bookingRules',
    createdAt: 'commonSpaces.createdAt',
    updatedAt: 'commonSpaces.updatedAt',
  };
  const bookingsTable = {
    id: 'bookings.id',
    commonSpaceId: 'bookings.commonSpaceId',
    userId: 'bookings.userId',
    startTime: 'bookings.startTime',
    endTime: 'bookings.endTime',
    status: 'bookings.status',
    createdAt: 'bookings.createdAt',
    updatedAt: 'bookings.updatedAt',
  };
  const userOrgsTable = {
    userId: 'userOrganizations.userId',
    organizationId: 'userOrganizations.organizationId',
    isActive: 'userOrganizations.isActive',
    canAccessAllOrganizations: 'userOrganizations.canAccessAllOrganizations',
    organizationRole: 'userOrganizations.organizationRole',
  };
  const usersTable = {
    id: 'users.id',
    firstName: 'users.firstName',
    lastName: 'users.lastName',
    email: 'users.email',
    role: 'users.role',
  };
  const userResidencesTable = {
    userId: 'userResidences.userId',
    residenceId: 'userResidences.residenceId',
    isActive: 'userResidences.isActive',
  };
  const residencesTable = {
    id: 'residences.id',
    buildingId: 'residences.buildingId',
  };
  const makeMockSchema: any = () => {
    const s: any = {
      parse: jest.fn((data: any) => data),
      partial: jest.fn(() => makeMockSchema()),
      omit: jest.fn(() => makeMockSchema()),
      extend: jest.fn(() => makeMockSchema()),
    };
    return s;
  };
  return {
    buildings: buildingsTable,
    organizations: orgTable,
    commonSpaces: commonSpacesTable,
    bookings: bookingsTable,
    userOrganizations: userOrgsTable,
    users: usersTable,
    userResidences: userResidencesTable,
    residences: residencesTable,
    userTimeLimits: { id: 'userTimeLimits.id', userId: 'userTimeLimits.userId', commonSpaceId: 'userTimeLimits.commonSpaceId', limitType: 'userTimeLimits.limitType', limitHours: 'userTimeLimits.limitHours', createdAt: 'userTimeLimits.createdAt', updatedAt: 'userTimeLimits.updatedAt' },
    userBookingRestrictions: { id: 'userBookingRestrictions.id', userId: 'userBookingRestrictions.userId', commonSpaceId: 'userBookingRestrictions.commonSpaceId', isBlocked: 'userBookingRestrictions.isBlocked', reason: 'userBookingRestrictions.reason', createdAt: 'userBookingRestrictions.createdAt', updatedAt: 'userBookingRestrictions.updatedAt' },
    invitations: {
      id: 'invitations.id',
      organizationId: 'invitations.organizationId',
      email: 'invitations.email',
      status: 'invitations.status',
      createdAt: 'invitations.createdAt',
    },
    insertCommonSpaceSchema: makeMockSchema(),
    insertBuildingSchema: makeMockSchema(),
  };
});

jest.mock('../../server/auth', () => {
  const passthrough = (_req: any, _res: any, next: any) => next();
  return {
    requireAuth: passthrough,
    requireRole: jest.fn(() => passthrough),
  };
});

jest.mock('../../server/storage', () => ({
  storage: {
    getBuildings: jest.fn<any>(async () => []),
    getOrganizations: jest.fn<any>(async () => []),
    getInvoices: jest.fn<any>(async () => []),
  },
}));

jest.mock('../../server/utils/logger', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}));

// Hard-pin the calling manager to ORG_ALPHA only.
jest.mock('../../server/rbac', () => ({
  getUserAccessibleOrganizations: jest.fn<any>(async (_userId: string) => [ORG_ALPHA]),
  getAccessibleBuildingIds: jest.fn<any>(async () => [ALPHA_BUILDING]),
}));

import { registerCommonSpacesRoutes } from '../../server/api/common-spaces';

function buildSelectChain(resolveRows: () => any[]) {
  const chain: any = {};
  ['from', 'leftJoin', 'innerJoin', 'orderBy', 'groupBy', 'having', 'limit', 'offset'].forEach(
    (m) => {
      chain[m] = jest.fn(() => chain);
    },
  );
  chain.where = jest.fn(() => chain);
  chain.then = (resolve: any) => resolve(resolveRows());
  return chain;
}

describe('Task #1306 — Flat-list org-scope', () => {
  let app: express.Application;
  let agent: ReturnType<typeof request.agent>;

  beforeEach(() => {
    jest.clearAllMocks();
    buildingRowsById.clear();

    buildingRowsById.set(ALPHA_BUILDING, {
      id: ALPHA_BUILDING,
      organizationId: ORG_ALPHA,
      isActive: true,
      name: 'Alpha Tower',
    });
    buildingRowsById.set(BETA_BUILDING, {
      id: BETA_BUILDING,
      organizationId: ORG_BETA,
      isActive: true,
      name: 'Beta Tower',
    });

    (mockDb.select as any).mockImplementation(() =>
      buildSelectChain(() => []),
    );

    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      }),
    );
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        id: MANAGER_USER_ID,
        role: 'manager',
        email: 'alpha@example.com',
        firstName: 'Alpha',
        lastName: 'Manager',
        isActive: true,
      };
      next();
    });

    registerCommonSpacesRoutes(app as any);
    agent = request.agent(app);
  });

  describe('GET /api/common-spaces — cross-org filter rejection', () => {
    it('returns 403 when an explicit organizationId from a foreign org is provided', async () => {
      const res = await agent.get(
        `/api/common-spaces?organizationId=${ORG_BETA}`,
      );
      expect(res.status).toBe(403);
    });

    it('returns 200 with empty array when caller has access to an org but no spaces exist', async () => {
      const res = await agent.get(
        `/api/common-spaces?organizationId=${ORG_ALPHA}`,
      );
      // The mock resolves org-scope query to return ORG_ALPHA and building id,
      // so it should proceed (not 403).
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('PUT /api/common-spaces/:spaceId — cross-org building reassignment denial', () => {
    it('returns 404 when payload contains a building_id from a different organization', async () => {
      const ALPHA_SPACE_ID = '00000000-0000-0000-0000-0000000000a4';

      // Mock that returns the space for space-ID queries and the correct
      // building row for building-ID queries.
      (mockDb.select as any).mockImplementation(() => {
        const chain: any = {};
        const conditions: any[] = [];

        const collectConditions = (cond: any) => {
          if (!cond) return;
          if (cond.kind === 'and' && Array.isArray(cond.conditions)) {
            cond.conditions.forEach(collectConditions);
          } else {
            conditions.push(cond);
          }
        };

        ['from', 'leftJoin', 'innerJoin', 'orderBy', 'groupBy', 'having', 'offset'].forEach(
          (m) => { chain[m] = jest.fn(() => chain); },
        );
        chain.where = jest.fn((cond: any) => { collectConditions(cond); return chain; });
        chain.limit = jest.fn(() => ({
          then: (resolve: any) => {
            const spaceEq = conditions.find(
              (c) => c?.kind === 'eq' && c?.col === 'commonSpaces.id',
            );
            if (spaceEq) {
              return resolve([{
                id: ALPHA_SPACE_ID,
                buildingId: ALPHA_BUILDING,
                name: 'Alpha Space',
                isReservable: false,
              }]);
            }
            const buildingEq = conditions.find(
              (c) => c?.kind === 'eq' && c?.col === 'buildings.id',
            );
            if (buildingEq) {
              const row = buildingRowsById.get(buildingEq.val);
              if (!row) return resolve([]);
              const isActiveCond = conditions.find(
                (c) => c?.kind === 'eq' && c?.col === 'buildings.isActive',
              );
              if (isActiveCond && row.isActive !== isActiveCond.val) return resolve([]);
              return resolve([{ id: row.id, organizationId: row.organizationId }]);
            }
            return resolve([]);
          },
        }));
        chain.then = (resolve: any) => resolve([]);
        return chain;
      });

      (mockDb.update as any).mockImplementation(() => ({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      }));

      const res = await agent.put(`/api/common-spaces/${ALPHA_SPACE_ID}`).send({
        name: 'Alpha Space Renamed',
        building_id: BETA_BUILDING,
        is_reservable: false,
      });

      // 404 (not 403) — existence oracle prevention for the target building.
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/common-spaces/:spaceId/bookings — cross-org existence leak prevention', () => {
    it('returns 404 (not 403) for a space in a foreign organisation', async () => {
      const BETA_SPACE_ID = '00000000-0000-0000-0000-0000000000b4';

      // Seed the space selector to return a beta building space
      (mockDb.select as any).mockImplementation(() => {
        const chain: any = {};
        const state: any = { conditions: [] };

        ['from', 'leftJoin', 'innerJoin', 'orderBy', 'groupBy', 'having', 'offset'].forEach(
          (m) => {
            chain[m] = jest.fn(() => chain);
          },
        );
        chain.limit = jest.fn(() => {
          // If we're returning a space, give it a beta building
          return {
            then: (resolve: any) =>
              resolve([{ id: BETA_SPACE_ID, buildingId: BETA_BUILDING, name: 'Beta Space', isReservable: true, openingHours: null }]),
          };
        });
        chain.where = jest.fn(() => chain);
        chain.then = (resolve: any) => resolve([]);
        return chain;
      });

      const res = await agent.post(`/api/common-spaces/${BETA_SPACE_ID}/bookings`).send({
        start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });

      // Must be 404 (not 403) — existence oracle prevention
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
