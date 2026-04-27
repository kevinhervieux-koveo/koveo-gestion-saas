/**
 * Tool-level regression tests for the `link_user_to_residence` MCP tool.
 *
 * Covers:
 *  - tenant role rejection
 *  - user outside MCP scope rejection
 *  - residence (via building) outside MCP scope rejection
 *  - happy path: insert with isActive=true, given relationshipType, and the
 *    provided / defaulted startDate
 *  - idempotency: an existing active link returns that row instead of
 *    inserting a duplicate
 *
 * These tests stub the MCP SDK and Drizzle so the registration flow runs
 * without touching the database, mirroring the pattern already used by
 * `mcp-tenant-residence-scope.test.ts`.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

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
const insertCalls: Array<{ values: Record<string, unknown> }> = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.innerJoin = () => chain;
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
          return Promise.resolve([{ id: 'new-link-id', ...vals }]);
        },
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

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'mcp-org-1';
const BUILDING_ID = 'mcp-building-1';
const RESIDENCE_ID = 'res-1';
const TARGET_USER_ID = 'user-target';
const ADMIN_USER_ID = 'mcp-admin-id';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  createMcpServer({ userId: ADMIN_USER_ID, role: 'admin' });
});

describe('link_user_to_residence — role gating', () => {
  it('rejects tenant callers with an Access denied message', async () => {
    const handler = registeredTools.get('link_user_to_residence');
    expect(handler).toBeDefined();

    const result = await handler!({
      role: 'tenant',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'tenant',
    });

    expect(result.content[0].text).toBe(
      'Access denied: tenants cannot link users to residences'
    );
    expect(insertCalls.length).toBe(0);
  });
});

describe('link_user_to_residence — scope checks', () => {
  it('rejects when the target user is not in any MCP-scoped organization', async () => {
    // 1. getMcpOrgIds -> orgs
    selectQueue.push([{ organizationId: ORG_ID }]);
    // 2. userOrganizations lookup -> empty
    selectQueue.push([]);

    const handler = registeredTools.get('link_user_to_residence');
    const result = await handler!({
      role: 'admin',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
    });

    expect(result.content[0].text).toBe('User not found or access denied');
    expect(insertCalls.length).toBe(0);
  });

  it('rejects when the residence does not exist', async () => {
    selectQueue.push([{ organizationId: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: 'user-org-link' }]); // userOrg lookup OK
    selectQueue.push([]); // residence lookup empty

    const handler = registeredTools.get('link_user_to_residence');
    const result = await handler!({
      role: 'admin',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
    });

    expect(result.content[0].text).toBe('Residence not found or access denied');
    expect(insertCalls.length).toBe(0);
  });

  it('rejects when the residence belongs to a building outside MCP scope', async () => {
    selectQueue.push([{ organizationId: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: 'user-org-link' }]); // userOrg lookup OK
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]); // residence
    selectQueue.push([{ id: BUILDING_ID, organizationId: 'other-org' }]); // building outside scope

    const handler = registeredTools.get('link_user_to_residence');
    const result = await handler!({
      role: 'admin',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
    });

    expect(result.content[0].text).toBe('Residence not found or access denied');
    expect(insertCalls.length).toBe(0);
  });
});

describe('link_user_to_residence — happy path', () => {
  it('inserts an active link with the provided startDate and relationshipType', async () => {
    selectQueue.push([{ organizationId: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: 'user-org-link' }]); // userOrg lookup
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]); // residence
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]); // building in scope
    selectQueue.push([]); // existing active link lookup -> none

    const handler = registeredTools.get('link_user_to_residence');
    const result = await handler!({
      role: 'admin',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
      startDate: '2026-01-15',
    });

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values).toEqual({
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
      startDate: '2026-01-15',
      isActive: true,
    });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.id).toBe('new-link-id');
    expect(payload.isActive).toBe(true);
    expect(payload.relationshipType).toBe('owner');
    expect(payload.startDate).toBe('2026-01-15');
  });

  it("defaults startDate to today (YYYY-MM-DD) when the caller omits it", async () => {
    selectQueue.push([{ organizationId: ORG_ID }]);
    selectQueue.push([{ id: 'user-org-link' }]);
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    selectQueue.push([]);

    const handler = registeredTools.get('link_user_to_residence');
    await handler!({
      role: 'manager',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'tenant',
    });

    expect(insertCalls.length).toBe(1);
    const today = new Date().toISOString().slice(0, 10);
    expect(insertCalls[0].values.startDate).toBe(today);
    expect(insertCalls[0].values.isActive).toBe(true);
    expect(insertCalls[0].values.relationshipType).toBe('tenant');
  });
});

describe('link_user_to_residence — idempotency', () => {
  it('only performs one insert across two back-to-back calls with the same (userId, residenceId)', async () => {
    // First call — no existing link, should insert.
    selectQueue.push([{ organizationId: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: 'user-org-link' }]); // userOrg
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]); // residence
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]); // building
    selectQueue.push([]); // existing link lookup -> empty

    // Second call — the link now exists and should be returned as-is.
    selectQueue.push([{ organizationId: ORG_ID }]);
    selectQueue.push([{ id: 'user-org-link' }]);
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    selectQueue.push([
      {
        id: 'existing-link-id',
        userId: TARGET_USER_ID,
        residenceId: RESIDENCE_ID,
        relationshipType: 'owner',
        startDate: '2026-04-20',
        isActive: true,
      },
    ]);

    const handler = registeredTools.get('link_user_to_residence');
    const args = {
      role: 'admin',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
      startDate: '2026-04-20',
    };

    const first = await handler!(args);
    const second = await handler!(args);

    expect(insertCalls.length).toBe(1);
    expect(JSON.parse(first.content[0].text).isActive).toBe(true);
    expect(JSON.parse(second.content[0].text).id).toBe('existing-link-id');
  });

  it('returns the existing active link instead of inserting a duplicate', async () => {
    selectQueue.push([{ organizationId: ORG_ID }]);
    selectQueue.push([{ id: 'user-org-link' }]);
    selectQueue.push([{ id: RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    // existing active link found
    const existing = {
      id: 'existing-link-id',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'owner',
      startDate: '2025-06-01',
      isActive: true,
    };
    selectQueue.push([existing]);

    const handler = registeredTools.get('link_user_to_residence');
    const result = await handler!({
      role: 'admin',
      userId: TARGET_USER_ID,
      residenceId: RESIDENCE_ID,
      relationshipType: 'tenant', // different type — should still short-circuit
      startDate: '2026-04-20',
    });

    expect(insertCalls.length).toBe(0);
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toEqual(existing);
  });
});
