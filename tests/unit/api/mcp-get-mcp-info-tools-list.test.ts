/**
 * Task #298: get_mcp_info enumerates every registered MCP tool.
 *
 * Locks in the runtime introspection added at the top of the get_mcp_info
 * handler in server/mcp/server.ts. The handler walks `server._registeredTools`
 * (the SDK's internal map) and emits one `{ name, description }` entry per
 * registered tool plus a `toolCount` so MCP clients (Claude Desktop, Cursor)
 * see the live tool catalogue without any hand-curated documentation.
 *
 * The previous behaviour returned only static metadata (orgs, users, role
 * notes) and silently drifted whenever a new tool was registered. These tests
 * catch a regression where the dynamic enumeration is removed or the static
 * metadata contract is broken.
 *
 * Unlike `tests/unit/api/mcp-acting-role.test.ts`, this suite does NOT mock
 * the `@modelcontextprotocol/sdk/server/mcp.js` module — we want the real
 * `_registeredTools` map populated by the SDK so the assertion exercises the
 * exact code path used in production.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const selectQueue: unknown[][] = [];

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
    insert: jest.fn(() => ({ values: () => ({ returning: () => Promise.resolve([]) }) })),
    update: jest.fn(() => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    })),
  },
}));

jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({ aiService: {} }));
jest.mock('../../../server/services/email-service', () => ({
  emailService: { sendInvitationEmail: jest.fn() },
}));

import { createMcpServer } from '../../../server/mcp/server';

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

interface RegisteredToolEntry {
  description?: string;
  handler?: unknown;
  callback?: unknown;
}

function getRegisteredTools(server: unknown): Record<string, RegisteredToolEntry> {
  const tools = (server as { _registeredTools?: Record<string, RegisteredToolEntry> })
    ._registeredTools;
  if (!tools) throw new Error('SDK did not expose _registeredTools — surface area changed');
  return tools;
}

function getHandler(server: unknown, name: string): ToolHandler {
  const tools = getRegisteredTools(server);
  const entry = tools[name];
  if (!entry) throw new Error(`Tool "${name}" is not registered`);
  const fn = (entry.handler ?? entry.callback) as ToolHandler | undefined;
  if (typeof fn !== 'function') throw new Error(`Tool "${name}" has no handler/callback`);
  return fn;
}

beforeEach(() => {
  selectQueue.length = 0;
});

/**
 * The get_mcp_info handler runs four db.select() chains in this order:
 *   1. orgs (id+name)
 *   2. users (id, email, role, …)
 *   3. buildingCount (id only)
 * Plus one extra inside getMcpOrgIds() that resolves the OAuth user's
 * organization list. We seed empty rows for all of them — only the role
 * metadata and the dynamic tools enumeration matter for these assertions.
 */
function primeGetMcpInfoSelects() {
  selectQueue.push([]);
  selectQueue.push([]);
  selectQueue.push([]);
  selectQueue.push([]);
}

function parseInfo(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

describe('get_mcp_info dynamic tool enumeration (task #298)', () => {
  it('returns a `tools` array generated from server._registeredTools', async () => {
    const server = createMcpServer({ role: 'admin' });
    const registered = getRegisteredTools(server);
    const registeredNames = Object.keys(registered).sort();
    expect(registeredNames.length).toBeGreaterThan(10);

    const getInfo = getHandler(server, 'get_mcp_info');
    primeGetMcpInfoSelects();
    const res = await getInfo({});
    const info = parseInfo(res.content[0].text);

    expect(Array.isArray(info.tools)).toBe(true);
    const tools = info.tools as Array<{ name: string; description: string }>;
    expect(tools.length).toBe(registeredNames.length);
    expect(info.toolCount).toBe(registeredNames.length);

    // Every entry must be a {name, description} pair pulled from the
    // SDK's registered map — no hand-curated drift allowed.
    for (const entry of tools) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(registered[entry.name]).toBeDefined();
      expect(entry.description).toBe(registered[entry.name]?.description ?? '');
    }

    // Sorted by name so client-side diffs across versions stay stable.
    const namesInOrder = tools.map((t) => t.name);
    expect(namesInOrder).toEqual([...namesInOrder].sort());

    // Sanity: the introspection must include itself and a few known tools
    // from across the file (core + budget + bulk-import surfaces) so a
    // refactor that drops a tool category from the list fails loudly.
    const names = new Set(namesInOrder);
    expect(names.has('get_mcp_info')).toBe(true);
    expect(names.has('list_organizations')).toBe(true);
    expect(names.has('downgrade_acting_role')).toBe(true);
    expect(names.has('restore_acting_role')).toBe(true);

    // The get_mcp_info entry should carry its real description, not blank.
    const selfEntry = tools.find((t) => t.name === 'get_mcp_info');
    expect(selfEntry?.description).toMatch(/MCP setup/i);
  });

  it('preserves the existing static metadata contract (org scoping, role notes, test users)', async () => {
    const server = createMcpServer({ role: 'admin' });
    const getInfo = getHandler(server, 'get_mcp_info');
    primeGetMcpInfoSelects();
    const res = await getInfo({});
    const info = parseInfo(res.content[0].text);

    // Static fields the documentation/Claude clients depend on.
    expect(info.description).toBe(
      'Koveo Gestion MCP Server - Property Management Platform for Quebec',
    );
    expect(info.organizations).toBeDefined();
    expect(info.users).toBeDefined();
    expect(info.stats).toBeDefined();
    expect(info.availableRoles).toEqual(['admin', 'manager', 'tenant']);
    expect(info.roleDescriptions).toBeDefined();
    expect(typeof info.roleNote).toBe('string');
    expect(info.roleNote).toBe(info.note); // alias preserved

    // Build stamp surfaced for support/debug tooling.
    expect(info).toHaveProperty('buildSha');
    expect(info).toHaveProperty('buildTime');

    // Role machinery still reflects the OAuth-bound session.
    expect(info.currentRole).toBe('admin');
    expect(info.oauthBoundRole).toBe('admin');
    expect(info.actingRole).toBe('admin');
    expect(info.downgradeActive).toBe(false);
    expect(info.allowedRoles).toEqual(['admin', 'manager', 'tenant']);
  });
});
