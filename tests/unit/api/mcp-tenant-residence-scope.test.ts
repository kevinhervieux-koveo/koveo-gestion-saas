/**
 * Tool-level regression tests for task #141: tenant residence scope leak.
 *
 *  - `list_residences` previously filtered on `userResidences.isActive`,
 *    silently hiding residences a tenant was genuinely linked to whenever
 *    that flag was anything other than true.
 *  - `create_maintenance_request` and `create_demand` accepted any
 *    `residenceId` in MCP scope without verifying the calling tenant was
 *    actually linked to that residence (confused-deputy / scope leak).
 *
 * These tests stub the MCP SDK and Drizzle so the full registration flow
 * runs without touching the database.
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
          return Promise.resolve([{ id: 'new-row-id', ...vals }]);
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
const LINKED_RESIDENCE_ID = 'res-linked';
const UNLINKED_RESIDENCE_ID = 'res-unlinked';
const TENANT_USER_ID = 'mcp-tenant-id';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  createMcpServer({ userId: TENANT_USER_ID, role: 'tenant' });
});

describe('list_residences (tenant) — task #141', () => {
  it('returns the tenant\'s linked residences without requiring userResidences.isActive', async () => {
    // 1. getMcpOrgIds -> organizations
    selectQueue.push([{ id: ORG_ID }]);
    // 2. building lookup
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    // 3. lookupMcpUserById (OAuth path resolves the bound user)
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    // 4. residences join — return one row even though the link is "inactive"
    selectQueue.push([{ r: { id: LINKED_RESIDENCE_ID, buildingId: BUILDING_ID, isActive: true } }]);

    const handler = registeredTools.get('list_residences');
    expect(handler).toBeDefined();
    const result = await handler!({ role: 'tenant', buildingId: BUILDING_ID });

    expect(result.content[0].text).toContain(LINKED_RESIDENCE_ID);
    expect(result.content[0].text).not.toBe('[]');
  });
});

describe('get_residence (tenant) — task #145', () => {
  it('rejects when the tenant is not linked to the target residence', async () => {
    // 1. getMcpOrgIds
    selectQueue.push([{ id: ORG_ID }]);
    // 2. residence lookup — exists, in MCP scope
    selectQueue.push([{ id: UNLINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    // 3. building lookup
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    // 4. tenant user lookup
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    // 5. userResidences membership lookup — empty (no link)
    selectQueue.push([]);

    const handler = registeredTools.get('get_residence');
    expect(handler).toBeDefined();
    const result = await handler!({ role: 'tenant', residenceId: UNLINKED_RESIDENCE_ID });

    // Parity requirement (task #145): tenant denial must match the
    // out-of-scope denial exactly so authorization state isn't disclosed.
    expect(result.content[0].text).toBe('Access denied');
    expect(result.content[0].text).not.toContain(UNLINKED_RESIDENCE_ID);
  });

  it('returns the residence when the tenant IS linked to it', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: LINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    // Membership found
    selectQueue.push([{ id: 'link-1' }]);

    const handler = registeredTools.get('get_residence');
    const result = await handler!({ role: 'tenant', residenceId: LINKED_RESIDENCE_ID });

    expect(result.content[0].text).not.toContain('Access denied');
    expect(result.content[0].text).toContain(LINKED_RESIDENCE_ID);
  });
});

describe('create_maintenance_request (tenant) — task #141', () => {
  it('rejects when the tenant is not linked to the target residence', async () => {
    // 1. getMcpOrgIds
    selectQueue.push([{ id: ORG_ID }]);
    // 2. residence lookup — exists, in MCP scope
    selectQueue.push([{ id: UNLINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    // 3. building lookup
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    // 4. tenant user lookup
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    // 5. userResidences membership lookup — empty (no link)
    selectQueue.push([]);

    const handler = registeredTools.get('create_maintenance_request');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'tenant',
      residenceId: UNLINKED_RESIDENCE_ID,
      title: 'leak',
      description: 'leaky pipe',
      category: 'plumbing',
      priority: 'medium',
    });

    expect(result.content[0].text).toContain('Access denied');
    expect(result.content[0].text).toContain('not linked to this residence');
    expect(insertCalls.length).toBe(0);
  });

  it('allows the request when the tenant IS linked to the residence', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: LINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    // Membership found
    selectQueue.push([{ id: 'link-1' }]);

    const handler = registeredTools.get('create_maintenance_request');
    const result = await handler!({
      role: 'tenant',
      residenceId: LINKED_RESIDENCE_ID,
      title: 'leak',
      description: 'leaky pipe',
      category: 'plumbing',
      priority: 'medium',
    });

    expect(result.content[0].text).not.toContain('Access denied');
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.residenceId).toBe(LINKED_RESIDENCE_ID);
    expect(insertCalls[0].values.submittedBy).toBe(TENANT_USER_ID);
  });
});

describe('create_demand (tenant) — task #141', () => {
  it('rejects when the tenant supplies an unlinked residenceId', async () => {
    // 1. getMcpOrgIds
    selectQueue.push([{ id: ORG_ID }]);
    // 2. building lookup
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    // 3. residence pre-flight (Task #622) — residence DOES exist and belongs
    //    to this building, so the access-denied check that follows is what
    //    rejects the call.
    selectQueue.push([{ id: UNLINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    // 4. tenant user lookup
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    // 5. userResidences membership lookup — empty
    selectQueue.push([]);

    const handler = registeredTools.get('create_demand');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'tenant',
      buildingId: BUILDING_ID,
      type: 'complaint',
      description: 'noise',
      residenceId: UNLINKED_RESIDENCE_ID,
    });

    expect(result.content[0].text).toContain('Access denied');
    expect(result.content[0].text).toContain('not linked to this residence');
    expect(insertCalls.length).toBe(0);
  });

  it('allows a building-scoped demand (no residenceId) without a membership check', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);

    const handler = registeredTools.get('create_demand');
    const result = await handler!({
      role: 'tenant',
      buildingId: BUILDING_ID,
      type: 'information',
      description: 'general question',
    });

    expect(result.content[0].text).not.toContain('Access denied');
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.buildingId).toBe(BUILDING_ID);
    expect(insertCalls[0].values.submitterId).toBe(TENANT_USER_ID);
  });

  it('allows a residence-scoped demand when the tenant IS linked', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    // Residence pre-flight (Task #622) — residence belongs to the building.
    selectQueue.push([{ id: LINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
    selectQueue.push([{ id: 'link-1' }]);

    const handler = registeredTools.get('create_demand');
    const result = await handler!({
      role: 'tenant',
      buildingId: BUILDING_ID,
      type: 'complaint',
      description: 'noise',
      residenceId: LINKED_RESIDENCE_ID,
    });

    expect(result.content[0].text).not.toContain('Access denied');
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.residenceId).toBe(LINKED_RESIDENCE_ID);
  });
});
