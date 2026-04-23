/**
 * Unit tests for the demand-followup MCP tools added in task #196:
 *
 *   - update_demand_status
 *   - list_demand_comments
 *   - create_demand_comment
 *
 * Mocks the MCP SDK, the Drizzle `db`, and the demand notification service so
 * the tools run without touching real infrastructure. Mirrors the pattern
 * already used by `mcp-link-user-to-residence.test.ts`.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
const registeredTools = new Map<string, ToolHandler>();
const registeredSchemas = new Map<string, Record<string, unknown>>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: (name: string, _desc: string, schema: Record<string, unknown>, handler: ToolHandler) => {
      registeredTools.set(name, handler);
      registeredSchemas.set(name, schema);
    },
  })),
}));

const selectQueue: unknown[][] = [];
const insertCalls: Array<{ values: Record<string, unknown> }> = [];
const updateCalls: Array<{ values: Record<string, unknown> }> = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
  chain.leftJoin = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn(() => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          insertCalls.push({ values: vals });
          return Promise.resolve([{ id: 'new-comment-id', ...vals }]);
        },
      }),
    })),
    update: jest.fn(() => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => ({
          returning: () => {
            updateCalls.push({ values: vals });
            return Promise.resolve([{ id: 'updated-demand-id', ...vals }]);
          },
        }),
      }),
    })),
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

const notifyDemandEditedMock = jest.fn().mockResolvedValue(undefined as never);
const notifyDemandCommentedMock = jest.fn().mockResolvedValue(undefined as never);
jest.mock('../../../server/services/demand-notification-service', () => ({
  demandNotificationService: {
    notifyDemandEdited: (...args: unknown[]) => notifyDemandEditedMock(...args),
    notifyDemandCommented: (...args: unknown[]) => notifyDemandCommentedMock(...args),
  },
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BUILDING_ID = '22222222-2222-4222-8222-222222222222';
const DEMAND_ID = '33333333-3333-4333-8333-333333333333';
const SEED_ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const SEED_MANAGER_ID = '55555555-5555-4555-8555-555555555555';
const SEED_TENANT_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_USER_ID = '77777777-7777-4777-8777-777777777777';

function demandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DEMAND_ID,
    submitterId: OTHER_USER_ID,
    type: 'complaint',
    description: 'Broken light in lobby',
    buildingId: BUILDING_ID,
    status: 'submitted',
    ...overrides,
  };
}

function buildingRow() {
  return { id: BUILDING_ID, organizationId: ORG_ID, name: 'B1' };
}

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  notifyDemandEditedMock.mockClear();
  notifyDemandCommentedMock.mockClear();
  // Use the legacy (no-OAuth) registration path so the seed-account lookups run.
  createMcpServer(undefined);
});

describe('MCP update_demand_status tool', () => {
  it('denies tenant callers', async () => {
    const handler = registeredTools.get('update_demand_status');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'tenant',
      demandId: DEMAND_ID,
      status: 'in_progress',
    });
    expect(result.content[0].text).toContain('Access denied');
    expect(updateCalls.length).toBe(0);
  });

  it('returns Demand not found when the id is unknown', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([]); // demand lookup -> none
    const handler = registeredTools.get('update_demand_status');
    const result = await handler!({
      role: 'manager',
      demandId: 'missing',
      status: 'in_progress',
    });
    expect(result.content[0].text).toBe('Demand not found');
    expect(updateCalls.length).toBe(0);
  });

  it('rejects demands whose building is outside MCP scope', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow()]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: 'other-org' }]);
    const handler = registeredTools.get('update_demand_status');
    const result = await handler!({
      role: 'manager',
      demandId: DEMAND_ID,
      status: 'in_progress',
    });
    expect(result.content[0].text).toBe('Access denied');
    expect(updateCalls.length).toBe(0);
  });

  it('admin happy path: updates status, stamps reviewedBy, notifies submitter', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow()]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // getMcpUser

    const handler = registeredTools.get('update_demand_status');
    const result = await handler!({
      role: 'admin',
      demandId: DEMAND_ID,
      status: 'in_progress',
      reviewNotes: 'Working on it',
    });

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].values).toMatchObject({
      status: 'in_progress',
      reviewNotes: 'Working on it',
      reviewedBy: SEED_ADMIN_ID,
    });
    expect(updateCalls[0].values.reviewedAt).toBeInstanceOf(Date);
    expect(notifyDemandEditedMock).toHaveBeenCalledWith(DEMAND_ID, SEED_ADMIN_ID, OTHER_USER_ID);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe('in_progress');
  });

  it('manager happy path on a same-status no-op does not stamp reviewedBy/reviewedAt', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ status: 'in_progress' })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('update_demand_status');
    await handler!({
      role: 'manager',
      demandId: DEMAND_ID,
      status: 'in_progress',
    });

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].values).not.toHaveProperty('reviewedBy');
    expect(updateCalls[0].values).not.toHaveProperty('reviewedAt');
  });

  it('the registered status schema rejects invalid enum values', async () => {
    const schema = registeredSchemas.get('update_demand_status');
    expect(schema).toBeDefined();
    const statusSchema = (schema as { status: { safeParse: (v: unknown) => { success: boolean } } }).status;
    expect(statusSchema.safeParse('in_progress').success).toBe(true);
    expect(statusSchema.safeParse('not-a-real-status').success).toBe(false);
    expect(statusSchema.safeParse('').success).toBe(false);
    expect(statusSchema.safeParse(undefined).success).toBe(false);
  });

  it('does not notify when the editor is the submitter', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: SEED_ADMIN_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]);

    const handler = registeredTools.get('update_demand_status');
    await handler!({
      role: 'admin',
      demandId: DEMAND_ID,
      status: 'completed',
    });

    expect(updateCalls.length).toBe(1);
    expect(notifyDemandEditedMock).not.toHaveBeenCalled();
  });
});

describe('MCP list_demand_comments tool', () => {
  it('returns Demand not found when the id is unknown', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([]);
    const handler = registeredTools.get('list_demand_comments');
    const result = await handler!({ role: 'admin', demandId: 'missing' });
    expect(result.content[0].text).toBe('Demand not found');
  });

  it('rejects demands outside MCP scope', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow()]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: 'other-org' }]);
    const handler = registeredTools.get('list_demand_comments');
    const result = await handler!({ role: 'admin', demandId: DEMAND_ID });
    expect(result.content[0].text).toBe('Access denied');
  });

  it('denies tenants on demands they did not submit', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: OTHER_USER_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_TENANT_ID, role: 'tenant' }]);
    const handler = registeredTools.get('list_demand_comments');
    const result = await handler!({ role: 'tenant', demandId: DEMAND_ID });
    expect(result.content[0].text).toContain('Access denied');
  });

  it('admin sees all comments including internal ones', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow()]);
    selectQueue.push([buildingRow()]);
    const allComments = [
      { id: 'c1', demandId: DEMAND_ID, commentText: 'public', isInternal: false, commenterId: SEED_ADMIN_ID, author: { id: SEED_ADMIN_ID } },
      { id: 'c2', demandId: DEMAND_ID, commentText: 'internal', isInternal: true, commenterId: SEED_ADMIN_ID, author: { id: SEED_ADMIN_ID } },
    ];
    selectQueue.push(allComments);

    const handler = registeredTools.get('list_demand_comments');
    const result = await handler!({ role: 'admin', demandId: DEMAND_ID });

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toHaveLength(2);
    expect(payload.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2']);
  });

  it('tenant sees their own demand comments but never internal ones', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: SEED_TENANT_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_TENANT_ID, role: 'tenant' }]);
    const allComments = [
      { id: 'c1', commentText: 'public', isInternal: false, commenterId: SEED_TENANT_ID, author: { id: SEED_TENANT_ID } },
      { id: 'c2', commentText: 'internal', isInternal: true, commenterId: SEED_ADMIN_ID, author: { id: SEED_ADMIN_ID } },
      { id: 'c3', commentText: 'reply', isInternal: false, commenterId: SEED_ADMIN_ID, author: { id: SEED_ADMIN_ID } },
    ];
    selectQueue.push(allComments);

    const handler = registeredTools.get('list_demand_comments');
    const result = await handler!({ role: 'tenant', demandId: DEMAND_ID });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.map((c: { id: string }) => c.id)).toEqual(['c1', 'c3']);
  });
});

describe('MCP create_demand_comment tool', () => {
  it('rejects tenant attempts to post internal comments', async () => {
    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'tenant',
      demandId: DEMAND_ID,
      commentText: 'sneaky',
      isInternal: true,
    });
    expect(result.content[0].text).toContain('Access denied');
    expect(insertCalls.length).toBe(0);
  });

  it('returns Demand not found when the id is unknown', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([]);
    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'manager',
      demandId: 'missing',
      commentText: 'hello',
    });
    expect(result.content[0].text).toBe('Demand not found');
    expect(insertCalls.length).toBe(0);
  });

  it('rejects demands outside MCP scope', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow()]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: 'other-org' }]);
    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'manager',
      demandId: DEMAND_ID,
      commentText: 'hello',
    });
    expect(result.content[0].text).toBe('Access denied');
    expect(insertCalls.length).toBe(0);
  });

  it('rejects tenants commenting on demands they did not submit', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: OTHER_USER_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_TENANT_ID, role: 'tenant' }]);
    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'tenant',
      demandId: DEMAND_ID,
      commentText: 'hello',
    });
    expect(result.content[0].text).toContain('Access denied');
    expect(insertCalls.length).toBe(0);
  });

  it('manager happy path inserts the comment and triggers the notification', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: OTHER_USER_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'manager',
      demandId: DEMAND_ID,
      commentText: 'looking into this',
      isInternal: false,
    });

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values).toMatchObject({
      demandId: DEMAND_ID,
      commenterId: SEED_MANAGER_ID,
      commentText: 'looking into this',
      isInternal: false,
    });
    expect(notifyDemandCommentedMock).toHaveBeenCalledWith(
      DEMAND_ID,
      SEED_MANAGER_ID,
      'manager',
      OTHER_USER_ID,
      BUILDING_ID,
    );
    const payload = JSON.parse(result.content[0].text);
    expect(payload.demandId).toBe(DEMAND_ID);
  });

  it('tenant happy path on their own demand inserts a non-internal comment', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: SEED_TENANT_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_TENANT_ID, role: 'tenant' }]);

    const handler = registeredTools.get('create_demand_comment');
    await handler!({
      role: 'tenant',
      demandId: DEMAND_ID,
      commentText: 'thanks',
    });

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.isInternal).toBe(false);
    expect(insertCalls[0].values.commenterId).toBe(SEED_TENANT_ID);
    expect(notifyDemandCommentedMock).toHaveBeenCalledWith(
      DEMAND_ID,
      SEED_TENANT_ID,
      'tenant',
      SEED_TENANT_ID,
      BUILDING_ID,
    );
  });

  it('rejects empty comment text via the insert schema', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: SEED_TENANT_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_TENANT_ID, role: 'tenant' }]);

    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'tenant',
      demandId: DEMAND_ID,
      commentText: '',
    });
    expect(result.content[0].text).toContain('Invalid comment data');
    expect(insertCalls.length).toBe(0);
  });
});
