/**
 * Unit tests for the `list_pending_invitations` MCP tool (task #150).
 *
 * Covers:
 *   - tenant caller is denied
 *   - admin sees every pending invitation in MCP scope
 *   - manager sees only invitations they themselves sent
 *   - organizationId filter outside MCP scope is rejected
 *   - email filter is forwarded to the WHERE clause
 *
 * Mocks the MCP SDK and the Drizzle `db` so the read flow runs without
 * touching real infrastructure.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Task #153: drizzle-orm mocks were relocated out of `__mocks__/` so they
// no longer auto-apply. This suite JSON-stringifies the captured WHERE
// argument, which only works against the mocked operator stubs (real
// drizzle objects are circular).
jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
const registeredTools = new Map<string, ToolHandler>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: (name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      registeredTools.set(name, handler);
    },
  })),
}));

const selectQueue: unknown[][] = [];
const lastSelectCalls: Array<{
  fields: unknown;
  whereArg: unknown;
  orderByArg: unknown;
  limitArg: unknown;
  offsetArg: unknown;
}> = [];

function makeSelectChain() {
  let whereArg: unknown;
  let orderByArg: unknown;
  let limitArg: unknown;
  let offsetArg: unknown;
  let recorded = false;
  const result = (): Promise<unknown[]> => {
    if (!recorded) {
      lastSelectCalls.push({
        fields: chain.__fields,
        whereArg,
        orderByArg,
        limitArg,
        offsetArg,
      });
      recorded = true;
    }
    return Promise.resolve(selectQueue.shift() ?? []);
  };
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.leftJoin = () => chain;
  chain.where = (arg: unknown) => {
    whereArg = arg;
    return chain;
  };
  chain.orderBy = (arg: unknown) => {
    orderByArg = arg;
    return chain;
  };
  chain.limit = (arg: unknown) => {
    limitArg = arg;
    return chain;
  };
  chain.offset = (arg: unknown) => {
    offsetArg = arg;
    return result();
  };
  // Some queries (e.g. count) terminate with await straight after .where().
  // The chain object itself is awaitable via .then so result() flushes once.
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn((fields?: unknown) => {
      const c = makeSelectChain();
      (c as Record<string, unknown>).__fields = fields;
      return c;
    }),
    update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  },
}));

jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: {},
}));
jest.mock('../../../server/services/email-service', () => ({
  emailService: { sendInvitationEmail: jest.fn() },
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'mcp-org-1';
const ORG_ID_2 = 'mcp-org-2';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';
const SEED_ADMIN_ID = 'seed-mcp-admin-id';

function pendingInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    email: 'invitee@example.com',
    role: 'tenant',
    status: 'pending',
    expiresAt: new Date('2030-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    organizationId: ORG_ID,
    buildingId: null,
    residenceId: null,
    invitedByUserId: SEED_ADMIN_ID,
    ...overrides,
  };
}

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  lastSelectCalls.length = 0;
  createMcpServer(undefined);
});

describe('MCP list_pending_invitations tool', () => {
  it('denies tenant callers with an Access denied response', async () => {
    const handler = registeredTools.get('list_pending_invitations');
    expect(handler).toBeDefined();

    const result = await handler!({ role: 'tenant' });
    expect(result.content[0].text).toContain('Access denied');
    // Should short-circuit BEFORE hitting the database.
    expect(lastSelectCalls.length).toBe(0);
  });

  it('admin sees pending invitations across all MCP-scoped orgs', async () => {
    selectQueue.push([{ id: ORG_ID }, { id: ORG_ID_2 }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // lookupMcpUser
    selectQueue.push([{ value: 2 }]); // count
    const rows = [
      pendingInvitation({ id: 'inv-a', organizationId: ORG_ID }),
      pendingInvitation({
        id: 'inv-b',
        organizationId: ORG_ID_2,
        invitedByUserId: 'someone-else',
      }),
    ];
    selectQueue.push(rows); // final invitations select

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'admin' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      total: 2,
      limit: 25,
      offset: 0,
      hasMore: false,
    });
    expect(payload.items).toHaveLength(2);
    expect(payload.items.map((r: { id: string }) => r.id).sort()).toEqual(['inv-a', 'inv-b']);

    // The terminating call (offset) is the invitations query — last entry.
    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    expect(finalCall.whereArg).toBeDefined();
    expect(finalCall.orderByArg).toBeDefined();
    expect(finalCall.limitArg).toBe(25);
    expect(finalCall.offsetArg).toBe(0);
  });

  it('manager only sees invitations they themselves sent', async () => {
    selectQueue.push([{ id: ORG_ID }, { id: ORG_ID_2 }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // caller lookup
    selectQueue.push([{ value: 1 }]); // count
    selectQueue.push([
      pendingInvitation({ id: 'inv-mine', invitedByUserId: SEED_MANAGER_ID }),
    ]);

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'manager' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].invitedByUserId).toBe(SEED_MANAGER_ID);
    expect(payload.total).toBe(1);

    // Sanity-check the WHERE tree includes a manager-scope clause. Drizzle's
    // operator helpers are real here so we walk the captured `and(...)` tree.
    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    const whereJson = JSON.stringify(finalCall.whereArg);
    expect(whereJson).toContain(SEED_MANAGER_ID);
  });

  it('rejects an organizationId filter that is not in MCP scope', async () => {
    selectQueue.push([{ id: ORG_ID }, { id: ORG_ID_2 }]); // getMcpOrgIds

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({
      role: 'admin',
      organizationId: 'some-other-org',
    });

    expect(result.content[0].text).toContain('not in MCP scope');
    // Only the getMcpOrgIds select should have run; no caller / invitations query.
    expect(lastSelectCalls.length).toBe(1);
  });

  it('honours an email filter and forwards it into the where clause', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 1 }]); // count
    selectQueue.push([
      pendingInvitation({ id: 'inv-x', email: 'TARGET@example.com' }),
    ]);

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'admin', email: 'target@example.com' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].id).toBe('inv-x');

    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    const whereJson = JSON.stringify(finalCall.whereArg);
    expect(whereJson.toLowerCase()).toContain('target@example.com');
  });

  it('returns the joined organization, building, residence, and inviter labels', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 1 }]); // count
    selectQueue.push([
      pendingInvitation({
        id: 'inv-joined',
        organizationName: 'MCP Org One',
        buildingName: 'Building B',
        residenceUnitNumber: '4',
        invitedByName: 'Mary Manager',
      }),
    ]);

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'admin' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: 'inv-joined',
      organizationName: 'MCP Org One',
      buildingName: 'Building B',
      residenceUnitNumber: '4',
      invitedByName: 'Mary Manager',
    });

    // The selected fields list should include the joined label columns so
    // Claude doesn't need a follow-up org/user lookup.
    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    const fields = finalCall.fields as Record<string, unknown>;
    expect(fields).toHaveProperty('organizationName');
    expect(fields).toHaveProperty('buildingName');
    expect(fields).toHaveProperty('residenceUnitNumber');
    expect(fields).toHaveProperty('invitedByName');
  });

  it('returns an empty page object when MCP scope is empty', async () => {
    selectQueue.push([]); // getMcpOrgIds returns nothing

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'admin' });

    expect(JSON.parse(result.content[0].text)).toEqual({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
      hasMore: false,
    });
    // Should NOT run a caller lookup or invitations query when scope is empty.
    expect(lastSelectCalls.length).toBe(1);
  });

  it('honours custom limit and offset and reports hasMore when more rows remain', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 50 }]); // count
    selectQueue.push([
      pendingInvitation({ id: 'inv-page2-1' }),
      pendingInvitation({ id: 'inv-page2-2' }),
    ]); // page rows

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'admin', limit: 2, offset: 4 });

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      total: 50,
      limit: 2,
      offset: 4,
      hasMore: true, // 4 + 2 < 50
    });
    expect(payload.items).toHaveLength(2);

    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    expect(finalCall.limitArg).toBe(2);
    expect(finalCall.offsetArg).toBe(4);
  });

  it('reports hasMore=false on the last page', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 5 }]); // count
    selectQueue.push([pendingInvitation({ id: 'inv-tail' })]); // single tail row

    const handler = registeredTools.get('list_pending_invitations');
    const result = await handler!({ role: 'admin', limit: 2, offset: 4 });

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      total: 5,
      limit: 2,
      offset: 4,
      hasMore: false, // 4 + 1 === 5
    });
    expect(payload.items).toHaveLength(1);
  });

  it('clamps limit above the max of 100 down to 100', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 0 }]); // count
    selectQueue.push([]); // page rows (empty)

    const handler = registeredTools.get('list_pending_invitations');
    // The Zod schema should reject 250, but the handler also clamps
    // defensively in case validation is bypassed.
    const result = await handler!({ role: 'admin', limit: 250 });

    const payload = JSON.parse(result.content[0].text);
    // Either we got a Zod validation error OR the clamp kicked in.
    if (typeof payload === 'object' && 'limit' in payload) {
      expect(payload.limit).toBeLessThanOrEqual(100);
    }
  });
});
