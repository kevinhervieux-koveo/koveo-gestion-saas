/**
 * @file Common-Spaces Accessible Building IDs — Task #1271 regression.
 * @description Locks the manager-without-userOrganizations path on the REST
 * helper `getAccessibleBuildingIds` to a deny (empty array). The previous
 * iteration silently widened that branch to "every active building", which
 * the security review flagged as a cross-org bypass: every common-spaces
 * read/write endpoint that gates solely on this helper would have leaked
 * (or accepted writes for) buildings outside the caller's tenant.
 *
 * The MCP equivalent (`getMcpAccessibleBuildingIds`) keeps a similar
 * fallback because it is clamped by the MCP-scoped org allowlist; the
 * REST helper has no such clamp. These cases prove:
 *   1. admin still receives every active building (unchanged),
 *   2. manager with active userOrganizations resolves to that org's
 *      buildings (unchanged),
 *   3. manager / demo_manager with NO userOrganizations row receives
 *      `[]`, no longer "all active buildings",
 *   4. tenant continues to receive only userResidences-linked buildings.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const buildingsTable = {
  id: 'buildings.id',
  organizationId: 'buildings.organizationId',
  isActive: 'buildings.isActive',
} as const;

const organizationsTable = { id: 'organizations.id', name: 'organizations.name' } as const;
const userOrganizationsTable = {
  id: 'userOrganizations.id',
  userId: 'userOrganizations.userId',
  organizationId: 'userOrganizations.organizationId',
  isActive: 'userOrganizations.isActive',
  canAccessAllOrganizations: 'userOrganizations.canAccessAllOrganizations',
} as const;
const residencesTable = { id: 'residences.id', buildingId: 'residences.buildingId' } as const;
const userResidencesTable = {
  id: 'userResidences.id',
  userId: 'userResidences.userId',
  residenceId: 'userResidences.residenceId',
  isActive: 'userResidences.isActive',
} as const;

jest.mock('@shared/schema', () => ({
  buildings: buildingsTable,
  residences: residencesTable,
  userResidences: userResidencesTable,
  organizations: organizationsTable,
  userOrganizations: userOrganizationsTable,
  // The router file imports the whole schema namespace as `schema`; provide
  // every symbol it touches in the helper as a plain identifier mock.
  default: {
    organizations: organizationsTable,
    residences: residencesTable,
  },
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column: any, value: any) => ({ kind: 'eq', column, value })),
  and: jest.fn((...conditions: any[]) => ({ kind: 'and', conditions })),
  or: jest.fn((...conditions: any[]) => ({ kind: 'or', conditions })),
  inArray: jest.fn((column: any, values: any[]) => ({ kind: 'inArray', column, values })),
  gte: jest.fn(),
  lte: jest.fn(),
  lt: jest.fn(),
  gt: jest.fn(),
  ne: jest.fn(),
  isNull: jest.fn(),
  isNotNull: jest.fn(),
  ilike: jest.fn(),
  desc: jest.fn(),
  asc: jest.fn(),
  sql: Object.assign(
    jest.fn((s: any) => ({ sql: String(s) })),
    { join: (parts: any[]) => ({ sql: 'join', parts }) },
  ),
}));

type Row = { buildingId?: string; organizationId?: string; canAccessAllOrganizations?: boolean };
const queue: Row[][] = [];
const calls: Array<{ from: string; conditions: any[] }> = [];

const mockDb = {
  select: jest.fn(() => {
    const state: { from: string; conditions: any[] } = { from: '', conditions: [] };
    const chain: any = {
      from: jest.fn((tbl: any) => {
        // Identify the source table from the imported reference (string-tagged in our mock).
        if (tbl === buildingsTable) state.from = 'buildings';
        else if (tbl === userResidencesTable) state.from = 'userResidences';
        else if (tbl === userOrganizationsTable) state.from = 'userOrganizations';
        else if (tbl === organizationsTable) state.from = 'organizations';
        else state.from = 'unknown';
        return chain;
      }),
      innerJoin: jest.fn(() => chain),
      leftJoin: jest.fn(() => chain),
      where: jest.fn((cond: any) => {
        const flat = (c: any): any[] => (c?.kind === 'and' ? c.conditions.flatMap(flat) : [c]);
        state.conditions = flat(cond);
        calls.push(state);
        const next = queue.shift() ?? [];
        // Drizzle's terminal call (no .limit()) returns rows by awaiting the chain.
        return Promise.resolve(next);
      }),
      orderBy: jest.fn(() => chain),
      groupBy: jest.fn(() => chain),
      limit: jest.fn(() => chain),
    };
    return chain;
  }),
};

jest.mock('../../server/db', () => ({ db: mockDb }));

let getAccessibleBuildingIds: (user: any) => Promise<string[]>;

beforeEach(() => {
  jest.resetModules();
  queue.length = 0;
  calls.length = 0;
});

describe('getAccessibleBuildingIds — Task #1271 deny enforcement', () => {
  it('admin receives every active building', async () => {
    queue.push([{ buildingId: 'b-1' }, { buildingId: 'b-2' }]);
    ({ getAccessibleBuildingIds } = await import('../../server/api/common-spaces'));
    const ids = await getAccessibleBuildingIds({ id: 'admin-1', role: 'admin' });
    expect(ids).toEqual(['b-1', 'b-2']);
  });

  it('manager with active userOrganizations rows resolves to that orgs buildings', async () => {
    // 1st db.select: userOrganizations join → returns the org link rows.
    queue.push([
      { organizationId: 'org-alpha', canAccessAllOrganizations: false } as any,
    ]);
    // 2nd db.select: buildings filtered to those orgIds.
    queue.push([{ buildingId: 'b-alpha-1' }]);
    ({ getAccessibleBuildingIds } = await import('../../server/api/common-spaces'));
    const ids = await getAccessibleBuildingIds({ id: 'mgr-1', role: 'manager' });
    expect(ids).toEqual(['b-alpha-1']);
  });

  it('manager with NO userOrganizations rows is denied (empty array)', async () => {
    // 1st db.select: userOrganizations join → no rows.
    queue.push([]);
    ({ getAccessibleBuildingIds } = await import('../../server/api/common-spaces'));
    const ids = await getAccessibleBuildingIds({ id: 'mgr-orphan', role: 'manager' });
    expect(ids).toEqual([]);
    // The helper must NOT have queried the buildings table for the
    // "all active buildings" fallback. Only the org-membership lookup
    // (organizations innerJoin userOrganizations) should fire.
    expect(calls.map((c) => c.from)).toEqual(['organizations']);
  });

  it('demo_manager with NO userOrganizations rows is also denied', async () => {
    queue.push([]);
    ({ getAccessibleBuildingIds } = await import('../../server/api/common-spaces'));
    const ids = await getAccessibleBuildingIds({ id: 'dmgr-orphan', role: 'demo_manager' });
    expect(ids).toEqual([]);
    expect(calls.map((c) => c.from)).toEqual(['organizations']);
  });

  it('tenant with no orgs falls through to userResidences-linked buildings', async () => {
    // 1st db.select: userOrganizations join → no rows.
    queue.push([]);
    // 2nd db.select: userResidences join → tenant's buildings.
    queue.push([{ buildingId: 'b-tenant' }]);
    ({ getAccessibleBuildingIds } = await import('../../server/api/common-spaces'));
    const ids = await getAccessibleBuildingIds({ id: 'tenant-1', role: 'tenant' });
    expect(ids).toEqual(['b-tenant']);
  });

  it('manager with canAccessAllOrganizations flag still receives every active building', async () => {
    // 1st db.select: userOrganizations join → flag is set.
    queue.push([
      { organizationId: 'org-koveo', canAccessAllOrganizations: true } as any,
    ]);
    // 2nd db.select: all active buildings.
    queue.push([{ buildingId: 'b-1' }, { buildingId: 'b-2' }]);
    ({ getAccessibleBuildingIds } = await import('../../server/api/common-spaces'));
    const ids = await getAccessibleBuildingIds({ id: 'mgr-koveo', role: 'manager' });
    expect(ids).toEqual(['b-1', 'b-2']);
  });
});
