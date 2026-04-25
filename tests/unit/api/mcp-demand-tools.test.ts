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
import { DEMAND_DESCRIPTION_MAX } from '../../../shared/schemas/operations';

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
const getExistingObjectAclMock = jest.fn() as jest.Mock<Promise<unknown>, [string]>;
const trySetObjectEntityAclPolicyMock = jest.fn() as jest.Mock<
  Promise<string>,
  [string, { visibility: string; owner: string }]
>;
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({
    getExistingObjectAcl: (path: string) => getExistingObjectAclMock(path),
    trySetObjectEntityAclPolicy: (path: string, policy: { visibility: string; owner: string }) =>
      trySetObjectEntityAclPolicyMock(path, policy),
  })),
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
const RESIDENCE_ID = '88888888-8888-4888-8888-888888888888';
const OTHER_BUILDING_ID = '99999999-9999-4999-8999-999999999999';

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
  getExistingObjectAclMock.mockReset();
  getExistingObjectAclMock.mockResolvedValue(null);
  trySetObjectEntityAclPolicyMock.mockReset();
  trySetObjectEntityAclPolicyMock.mockResolvedValue('/objects/whatever');
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

describe('MCP demand attachment handling', () => {
  it('create_demand stores the attachment fields and binds the object ACL to the caller', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([buildingRow()]); // building lookup
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // getMcpUser

    const handler = registeredTools.get('create_demand');
    expect(handler).toBeDefined();

    const result = await handler!({
      role: 'manager',
      buildingId: BUILDING_ID,
      type: 'maintenance',
      description: 'Hallway light is flickering and needs to be replaced.',
      attachment: {
        url: '/objects/uploads/demand-photo.png',
        originalName: 'demand-photo.png',
        size: 12345,
      },
    });

    // The ownership-check helper was consulted before the row was inserted.
    expect(getExistingObjectAclMock).toHaveBeenCalledWith('/objects/uploads/demand-photo.png');
    // The new demand row carries the file metadata.
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].values).toMatchObject({
      buildingId: BUILDING_ID,
      type: 'maintenance',
      filePath: '/objects/uploads/demand-photo.png',
      fileName: 'demand-photo.png',
      fileSize: 12345,
    });
    // The ACL set call binds the object to the calling user with `private`
    // visibility, matching POST /api/demands.
    expect(trySetObjectEntityAclPolicyMock).toHaveBeenCalledWith(
      '/objects/uploads/demand-photo.png',
      { visibility: 'private', owner: SEED_MANAGER_ID },
    );
    // Sanity-check the response contains the inserted row.
    expect(result.content[0].text).toContain('demand-photo.png');
  });

  it('create_demand rejects an attachment whose ACL is owned by another user', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    getExistingObjectAclMock.mockResolvedValueOnce({ owner: OTHER_USER_ID, visibility: 'private' });

    const handler = registeredTools.get('create_demand');
    const result = await handler!({
      role: 'manager',
      buildingId: BUILDING_ID,
      type: 'complaint',
      description: 'Loud noises late at night from the neighbouring unit.',
      attachment: {
        url: '/objects/uploads/owned-by-someone-else.pdf',
      },
    });

    expect(result.content[0].text).toContain('Access denied: object belongs to another user');
    // No insert and no ACL rebinding should have happened.
    expect(insertCalls).toHaveLength(0);
    expect(trySetObjectEntityAclPolicyMock).not.toHaveBeenCalled();
  });

  it('create_demand_comment stores the attachment fields and binds the object ACL to the caller', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: OTHER_USER_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'manager',
      demandId: DEMAND_ID,
      commentText: 'See the attached invoice for the repair quote.',
      attachment: {
        url: '/objects/uploads/quote.pdf',
        originalName: 'quote.pdf',
        size: 5432,
      },
    });

    expect(getExistingObjectAclMock).toHaveBeenCalledWith('/objects/uploads/quote.pdf');
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].values).toMatchObject({
      demandId: DEMAND_ID,
      commenterId: SEED_MANAGER_ID,
      commentText: 'See the attached invoice for the repair quote.',
      filePath: '/objects/uploads/quote.pdf',
      fileName: 'quote.pdf',
      fileSize: 5432,
    });
    expect(trySetObjectEntityAclPolicyMock).toHaveBeenCalledWith(
      '/objects/uploads/quote.pdf',
      { visibility: 'private', owner: SEED_MANAGER_ID },
    );
    // The notification flow still fires for non-self comments.
    expect(notifyDemandCommentedMock).toHaveBeenCalled();
    expect(result.content[0].text).toContain('quote.pdf');
  });

  it('create_demand_comment rejects an attachment whose ACL is owned by another user', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: SEED_TENANT_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_TENANT_ID, role: 'tenant' }]);

    getExistingObjectAclMock.mockResolvedValueOnce({ owner: OTHER_USER_ID, visibility: 'private' });

    const handler = registeredTools.get('create_demand_comment');
    const result = await handler!({
      role: 'tenant',
      demandId: DEMAND_ID,
      commentText: 'Adding a screenshot for context.',
      attachment: {
        url: '/objects/uploads/not-mine.png',
      },
    });

    expect(result.content[0].text).toContain('Access denied: object belongs to another user');
    expect(insertCalls).toHaveLength(0);
    expect(trySetObjectEntityAclPolicyMock).not.toHaveBeenCalled();
    expect(notifyDemandCommentedMock).not.toHaveBeenCalled();
  });

  it('non-object-storage attachment URLs skip the ACL flow but still record metadata', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]);

    const handler = registeredTools.get('create_demand');
    await handler!({
      role: 'admin',
      buildingId: BUILDING_ID,
      type: 'other',
      description: 'External link to additional documentation about the issue.',
      attachment: {
        url: 'https://example.com/docs/spec.pdf',
        originalName: 'spec.pdf',
        size: 999,
      },
    });

    // External URLs are not object-storage paths, so the ACL helpers must not
    // be called (the REST endpoint behaves the same way).
    expect(getExistingObjectAclMock).not.toHaveBeenCalled();
    expect(trySetObjectEntityAclPolicyMock).not.toHaveBeenCalled();
    // But the file metadata is still recorded on the demand row.
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].values).toMatchObject({
      filePath: 'https://example.com/docs/spec.pdf',
      fileName: 'spec.pdf',
      fileSize: 999,
    });
  });

  it('create_demand residence pre-flight: returns 404-style message when residenceId does not exist (Task #622)', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([buildingRow()]); // building lookup
    selectQueue.push([]); // residence lookup -> not found

    const handler = registeredTools.get('create_demand');
    expect(handler).toBeDefined();

    const result = await handler!({
      role: 'manager',
      buildingId: BUILDING_ID,
      type: 'complaint',
      description: 'Should be rejected before INSERT.',
      residenceId: '00000000-0000-4000-8000-000000000000',
    });

    expect(result.content[0].text).toBe(
      'Residence not found or does not belong to the specified building',
    );
    // No insert should have run because we short-circuited before the DB write.
    expect(insertCalls).toHaveLength(0);
  });

  it('create_demand residence pre-flight: rejects a residence that belongs to another building (Task #622)', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([buildingRow()]); // building lookup
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: OTHER_BUILDING_ID }]); // residence belongs elsewhere

    const handler = registeredTools.get('create_demand');
    const result = await handler!({
      role: 'manager',
      buildingId: BUILDING_ID,
      type: 'complaint',
      description: 'Cross-building residence id should be rejected.',
      residenceId: RESIDENCE_ID,
    });

    expect(result.content[0].text).toBe(
      'Residence not found or does not belong to the specified building',
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('create_demand surfaces raw DB error in [dev] block when NODE_ENV !== production (Task #622)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([buildingRow()]); // building lookup
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // getMcpUser

    // Force the INSERT to throw so we exercise the catch block. The mock
    // factory above stores the rejecting promise on `returning()`.
    const { db } = await import('../../../server/db');
    (db.insert as jest.Mock).mockImplementationOnce(() => ({
      values: () => ({
        returning: () => Promise.reject(Object.assign(new Error('insert blew up'), { code: '99999' })),
      }),
    }));

    try {
      const handler = registeredTools.get('create_demand');
      const result = await handler!({
        role: 'manager',
        buildingId: BUILDING_ID,
        type: 'complaint',
        description: 'This call is expected to fail at the INSERT.',
      });
      // Two content items: the friendly envelope + the [dev] raw message.
      expect(result.content).toHaveLength(2);
      expect(result.content[0].text).toContain('Failed to create demand');
      expect(result.content[1].text).toBe('[dev] insert blew up');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('create_demand omits the [dev] block when NODE_ENV === production (Task #622)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const { db } = await import('../../../server/db');
    (db.insert as jest.Mock).mockImplementationOnce(() => ({
      values: () => ({
        returning: () => Promise.reject(Object.assign(new Error('insert blew up'), { code: '99999' })),
      }),
    }));

    try {
      const handler = registeredTools.get('create_demand');
      const result = await handler!({
        role: 'manager',
        buildingId: BUILDING_ID,
        type: 'complaint',
        description: 'This call is expected to fail at the INSERT.',
      });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Failed to create demand');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('create_demand residence happy path: a valid residence in the same building inserts the row (Task #622)', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([buildingRow()]); // building lookup
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]); // residence lookup -> matches building
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // getMcpUser

    const handler = registeredTools.get('create_demand');
    const result = await handler!({
      role: 'manager',
      buildingId: BUILDING_ID,
      type: 'maintenance',
      description: 'Faucet leaking in unit 4B.',
      residenceId: RESIDENCE_ID,
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].values).toMatchObject({
      buildingId: BUILDING_ID,
      type: 'maintenance',
      residenceId: RESIDENCE_ID,
    });
    // The response is the inserted row JSON, not an error message.
    const payload = JSON.parse(result.content[0].text);
    expect(payload.residenceId).toBe(RESIDENCE_ID);
  });

  it('create_demand_comment without an attachment leaves the file fields unset and the ACL helpers untouched', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([demandRow({ submitterId: OTHER_USER_ID })]);
    selectQueue.push([buildingRow()]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('create_demand_comment');
    await handler!({
      role: 'manager',
      demandId: DEMAND_ID,
      commentText: 'No file needed here.',
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].values).not.toHaveProperty('filePath');
    expect(insertCalls[0].values).not.toHaveProperty('fileName');
    expect(insertCalls[0].values).not.toHaveProperty('fileSize');
    expect(getExistingObjectAclMock).not.toHaveBeenCalled();
    expect(trySetObjectEntityAclPolicyMock).not.toHaveBeenCalled();
  });
});

describe('create_demand MCP schema — description length cap (task #651)', () => {
  type ZodLike = { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ code: string }> } } };

  it('accepts a description of exactly ' + DEMAND_DESCRIPTION_MAX + ' characters', () => {
    const schema = registeredSchemas.get('create_demand') as Record<string, ZodLike> | undefined;
    expect(schema).toBeDefined();
    const result = schema!.description.safeParse('a'.repeat(DEMAND_DESCRIPTION_MAX));
    expect(result.success).toBe(true);
  });

  it('rejects a description of ' + (DEMAND_DESCRIPTION_MAX + 1) + ' characters with a too_big error', () => {
    const schema = registeredSchemas.get('create_demand') as Record<string, ZodLike> | undefined;
    expect(schema).toBeDefined();
    const result = schema!.description.safeParse('a'.repeat(DEMAND_DESCRIPTION_MAX + 1));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error!.issues.find((i) => i.code === 'too_big');
      expect(issue).toBeDefined();
    }
  });
});
