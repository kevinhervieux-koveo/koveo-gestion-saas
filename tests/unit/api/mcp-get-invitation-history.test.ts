/**
 * Unit tests for the `get_invitation_history` MCP tool (task #159).
 *
 * Covers:
 *   - tenant caller is denied
 *   - empty MCP scope short-circuits with an empty page object
 *   - admin sees joined audit rows across MCP scope
 *   - manager scope restricts to invitations they sent (WHERE clause)
 *   - filters (invitationId, performedByUserId, since/until) reach WHERE
 *   - pagination metadata reports total / hasMore correctly
 *   - invalid date strings are rejected with a clear error
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

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
    insert: jest.fn(() => ({ values: () => Promise.resolve() })),
    delete: jest.fn(),
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
const SEED_MANAGER_ID = 'seed-mcp-manager-id';
const SEED_ADMIN_ID = 'seed-mcp-admin-id';

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    invitationId: 'inv-1',
    action: 'cancelled',
    previousStatus: 'pending',
    newStatus: 'cancelled',
    performedBy: SEED_ADMIN_ID,
    ipAddress: null,
    details: { source: 'mcp', tool: 'cancel_invitation', role: 'admin' },
    createdAt: new Date('2026-04-19T12:00:00Z'),
    invitationEmail: 'invitee@example.com',
    organizationId: ORG_ID,
    organizationName: 'MCP Org One',
    performedByName: 'Mary Manager',
    performedByEmail: 'mary@example.com',
    ...overrides,
  };
}

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  lastSelectCalls.length = 0;
  createMcpServer(undefined);
});

describe('MCP get_invitation_history tool', () => {
  it('denies tenant callers with an Access denied response', async () => {
    const handler = registeredTools.get('get_invitation_history');
    expect(handler).toBeDefined();

    const result = await handler!({ role: 'tenant' });
    expect(result.content[0].text).toContain('Access denied');
    expect(lastSelectCalls.length).toBe(0);
  });

  it('returns an empty page object when MCP scope is empty', async () => {
    selectQueue.push([]); // getMcpOrgIds

    const handler = registeredTools.get('get_invitation_history');
    const result = await handler!({ role: 'admin' });

    expect(JSON.parse(result.content[0].text)).toEqual({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
      hasMore: false,
    });
    expect(lastSelectCalls.length).toBe(1);
  });

  it('admin sees joined audit rows across MCP scope', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 1 }]); // count
    selectQueue.push([auditRow({ id: 'audit-a' })]); // page

    const handler = registeredTools.get('get_invitation_history');
    const result = await handler!({ role: 'admin' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({ total: 1, limit: 25, offset: 0, hasMore: false });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: 'audit-a',
      invitationEmail: 'invitee@example.com',
      organizationName: 'MCP Org One',
      performedByName: 'Mary Manager',
    });

    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    const fields = finalCall.fields as Record<string, unknown>;
    // Joined enrichment columns are projected.
    expect(fields).toHaveProperty('invitationEmail');
    expect(fields).toHaveProperty('organizationName');
    expect(fields).toHaveProperty('performedByName');
    expect(fields).toHaveProperty('performedByEmail');
    expect(finalCall.limitArg).toBe(25);
    expect(finalCall.offsetArg).toBe(0);
  });

  it('manager scope appears in the WHERE clause', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // caller
    selectQueue.push([{ value: 1 }]); // count
    selectQueue.push([auditRow({ id: 'audit-mgr', performedBy: SEED_MANAGER_ID })]);

    const handler = registeredTools.get('get_invitation_history');
    const result = await handler!({ role: 'manager' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.items).toHaveLength(1);

    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    const whereJson = JSON.stringify(finalCall.whereArg);
    expect(whereJson).toContain(SEED_MANAGER_ID);
  });

  it('forwards filters (invitationId, performedByUserId, since, until) into WHERE', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 0 }]); // count
    selectQueue.push([]); // page

    const handler = registeredTools.get('get_invitation_history');
    await handler!({
      role: 'admin',
      invitationId: 'inv-target',
      performedByUserId: 'user-target',
      since: '2026-04-01T00:00:00Z',
      until: '2026-04-20T00:00:00Z',
    });

    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    const whereJson = JSON.stringify(finalCall.whereArg);
    expect(whereJson).toContain('inv-target');
    expect(whereJson).toContain('user-target');
    // Date bounds reach the WHERE tree (year fragment is enough proof).
    expect(whereJson).toContain('2026');
  });

  it('paginates with custom limit/offset and reports hasMore correctly', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller
    selectQueue.push([{ value: 50 }]); // count
    selectQueue.push([auditRow({ id: 'a-1' }), auditRow({ id: 'a-2' })]); // page

    const handler = registeredTools.get('get_invitation_history');
    const result = await handler!({ role: 'admin', limit: 2, offset: 4 });

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({ total: 50, limit: 2, offset: 4, hasMore: true });
    expect(payload.items).toHaveLength(2);

    const finalCall = lastSelectCalls[lastSelectCalls.length - 1];
    expect(finalCall.limitArg).toBe(2);
    expect(finalCall.offsetArg).toBe(4);
  });

  it("rejects an invalid 'since' timestamp with a clear error", async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller

    const handler = registeredTools.get('get_invitation_history');
    const result = await handler!({ role: 'admin', since: 'not-a-date' });

    expect(result.content[0].text).toContain("Invalid 'since' timestamp");
    // Should NOT have run the count or page queries.
    expect(lastSelectCalls.length).toBe(2);
  });
});
