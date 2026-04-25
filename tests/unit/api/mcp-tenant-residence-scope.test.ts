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
import { z } from 'zod';
import { MAINTENANCE_CATEGORY_VALUES } from '../../../shared/schemas/operations';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
const registeredTools = new Map<string, ToolHandler>();
// Captured raw schema shapes (the ZodRawShape passed to `server.tool(...)`)
// keyed by tool name. Tests can use this to assert schema-level guards
// (e.g. Task #619 — `create_maintenance_request.category` enum) the same
// way the MCP SDK would: by parsing inputs through `z.object(shape)`.
const registeredSchemas = new Map<string, z.ZodRawShape>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    // Mirror the MCP SDK contract: validate args against the declared raw
    // shape BEFORE invoking the handler so schema-level rejections (Task
    // #619) are observable in tests. On a Zod parse failure we return the
    // same `content[0].text` shape the SDK surfaces, prefixed so callers
    // can recognise it.
    tool: (
      name: string,
      _desc: string,
      schema: z.ZodRawShape,
      handler: ToolHandler
    ) => {
      registeredSchemas.set(name, schema);
      const wrapped: ToolHandler = async (args) => {
        const parsed = z.object(schema).safeParse(args);
        if (!parsed.success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Validation error: ${parsed.error.issues
                  .map((i) => `${i.path.join('.')}: ${i.message}`)
                  .join('; ')}`,
              },
            ],
          };
        }
        return handler(parsed.data as Record<string, unknown>);
      };
      registeredTools.set(name, wrapped);
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
  registeredSchemas.clear();
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

/**
 * Task #619 — `create_maintenance_request.category` enum enforcement.
 *
 * The MCP tool must reject any `category` value that is not in the
 * canonical list (defined in `shared/schemas/operations.ts` as
 * `MAINTENANCE_CATEGORY_VALUES`). Rejection is enforced by the SDK at
 * Zod-parse time (before the handler runs), so these tests rely on the
 * mock above wrapping the handler with `z.object(schema).safeParse(...)`
 * to mirror the SDK's behaviour.
 *
 * The DB-level CHECK constraint (`maintenance_requests_category_check`,
 * added in migration `0009_maintenance_category_check.sql`) is the
 * defence-in-depth guard for direct inserts that bypass this layer.
 */
describe('create_maintenance_request — category enum (task #619)', () => {
  it('rejects an invalid category at the Zod schema layer (no DB writes)', async () => {
    const handler = registeredTools.get('create_maintenance_request');
    expect(handler).toBeDefined();

    const result = await handler!({
      role: 'tenant',
      residenceId: LINKED_RESIDENCE_ID,
      title: 'leak',
      description: 'leaky pipe',
      category: 'invalid-category-not-in-any-enum-xyz',
      priority: 'medium',
    });

    // Schema-level rejection -> the wrapped handler returns a "Validation
    // error: ..." string and the real handler is never invoked, so no
    // residence/building lookups are consumed and no insert is attempted.
    expect(result.content[0].text).toContain('Validation error');
    expect(result.content[0].text).toContain('category');
    expect(insertCalls.length).toBe(0);
    // No DB lookups should have been pulled from the queue either.
    expect(selectQueue.length).toBe(0);
  });

  it('accepts every value in the canonical enum at the schema layer', async () => {
    const schema = registeredSchemas.get('create_maintenance_request');
    expect(schema).toBeDefined();
    const objectSchema = z.object(schema!);

    // Iterate the canonical tuple directly so this test cannot drift from
    // the source of truth when categories are added/removed in the future.
    for (const category of MAINTENANCE_CATEGORY_VALUES) {
      const parsed = objectSchema.safeParse({
        role: 'tenant',
        residenceId: LINKED_RESIDENCE_ID,
        title: 't',
        description: 'd',
        category,
        priority: 'medium',
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('accepts category="plumbing" end-to-end and inserts the row (200/created path)', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: LINKED_RESIDENCE_ID, buildingId: BUILDING_ID }]);
    selectQueue.push([{ id: BUILDING_ID, organizationId: ORG_ID }]);
    selectQueue.push([{ id: TENANT_USER_ID, role: 'tenant' }]);
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

    expect(result.content[0].text).not.toContain('Validation error');
    expect(result.content[0].text).not.toContain('Access denied');
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.category).toBe('plumbing');
  });

  it("tool description lists the exact accepted categories (no 'etc.')", () => {
    const schema = registeredSchemas.get('create_maintenance_request');
    expect(schema).toBeDefined();
    const categoryField = schema!.category as z.ZodType<unknown>;
    // The field is built as `z.enum([...]).describe("...")`; the description
    // is exposed via the parent ZodType's `_def.description`.
    const description =
      (categoryField as unknown as { _def: { description?: string } })._def
        .description ?? '';
    expect(description).toContain('plumbing');
    expect(description).toContain('electrical');
    expect(description).toContain('hvac');
    expect(description).toContain('general');
    expect(description).toContain('elevator');
    expect(description).toContain('landscaping');
    expect(description).toContain('cleaning');
    expect(description).toContain('security');
    expect(description).toContain('other');
    expect(description.toLowerCase()).not.toContain('etc');
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
