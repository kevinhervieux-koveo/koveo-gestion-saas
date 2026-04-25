/**
 * Tool-level regression tests for the bug fixed in task #138:
 * `create_communication` and `create_meeting` previously returned
 * "MCP user not found" for OAuth-authenticated callers because they
 * resolved the author via the synthetic `mcp-{role}@koveo-mcp.test`
 * seed account. They must now use the OAuth caller's real user id.
 *
 * These tests stub out the MCP SDK and the Drizzle `db` so the full
 * tool-registration flow runs without touching the database.
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

// Chainable Drizzle-shaped mock: each terminal method returns whatever the
// next item in `selectQueue` is. Inserts are captured into `insertCalls` and
// the .returning() call resolves with `[{ ...values, id: 'new-id' }]`.
const selectQueue: unknown[][] = [];
const insertCalls: Array<{ values: Record<string, unknown> }> = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  // Allow `await db.select(...).from(...).where(...)` (no limit) to resolve.
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

// Avoid touching real services that may not exist in test env.
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
const OAUTH_USER_ID = 'real-oauth-user-123';
const SEED_USER_ID = 'seed-mcp-manager-id';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
});

describe('create_communication / create_meeting OAuth attribution (task #138)', () => {
  describe('OAuth path', () => {
    beforeEach(() => {
      createMcpServer({ userId: OAUTH_USER_ID, role: 'manager' });
    });

    it('create_communication sets createdBy to the OAuth user id (not "MCP user not found")', async () => {
      // Order of db.select calls inside the handler:
      //   1. getMcpOrgIds  -> organizations  [{id: ORG_ID}]
      //   2. lookupMcpUserById -> users      [{id: OAUTH_USER_ID, role: 'manager'}]
      selectQueue.push([{ id: ORG_ID }]);
      selectQueue.push([{ id: OAUTH_USER_ID, role: 'manager' }]);

      const handler = registeredTools.get('create_communication');
      expect(handler).toBeDefined();
      const result = await handler!({
        role: 'manager',
        organizationId: ORG_ID,
        title: 'Hello',
        content: 'World',
        isUrgent: false,
      });

      expect(result.content[0].text).not.toContain('MCP user not found');
      expect(insertCalls.length).toBe(1);
      expect(insertCalls[0].values.createdBy).toBe(OAUTH_USER_ID);
      expect(insertCalls[0].values.organizationId).toBe(ORG_ID);
    });

    it('create_meeting sets createdBy to the OAuth user id (not "MCP user not found")', async () => {
      selectQueue.push([{ id: ORG_ID }]);
      selectQueue.push([{ id: OAUTH_USER_ID, role: 'manager' }]);

      const handler = registeredTools.get('create_meeting');
      expect(handler).toBeDefined();
      const result = await handler!({
        role: 'manager',
        organizationId: ORG_ID,
        title: 'Board meeting',
        location: 'Salle 1',
        scheduledDate: '2026-05-01T18:00:00Z',
        duration: 60,
      });

      expect(result.content[0].text).not.toContain('MCP user not found');
      expect(insertCalls.length).toBe(1);
      expect(insertCalls[0].values.createdBy).toBe(OAUTH_USER_ID);
      expect(insertCalls[0].values.organizationId).toBe(ORG_ID);
    });

    it('rejects a past scheduledDate without inserting', async () => {
      selectQueue.push([{ id: ORG_ID }]);

      const handler = registeredTools.get('create_meeting');
      expect(handler).toBeDefined();
      const result = await handler!({
        role: 'manager',
        organizationId: ORG_ID,
        title: 'Backdated meeting',
        location: 'Salle 1',
        scheduledDate: '1995-01-01T10:00:00Z',
        duration: 60,
      });

      expect(result.content[0].text).toContain('scheduledDate must be in the future');
      expect(insertCalls.length).toBe(0);
      expect(selectQueue.length).toBe(0);
    });

    it('still fails clearly when the OAuth user no longer exists in the DB', async () => {
      selectQueue.push([{ id: ORG_ID }]);
      selectQueue.push([]); // user lookup by id finds nothing

      const handler = registeredTools.get('create_communication');
      const result = await handler!({
        role: 'manager',
        organizationId: ORG_ID,
        title: 'Hello',
        content: 'World',
        isUrgent: false,
      });

      expect(result.content[0].text).toContain('MCP user not found');
      expect(insertCalls.length).toBe(0);
    });
  });

  describe('Legacy MCP_API_KEY path (no authContext)', () => {
    beforeEach(() => {
      createMcpServer(undefined);
    });

    it('create_communication attributes createdBy to the seed account', async () => {
      selectQueue.push([{ id: ORG_ID }]);
      // Seed lookup: lookupMcpUser('manager') queries users by email.
      selectQueue.push([{ id: SEED_USER_ID, role: 'manager' }]);

      const handler = registeredTools.get('create_communication');
      const result = await handler!({
        role: 'manager',
        organizationId: ORG_ID,
        title: 'Hello',
        content: 'World',
        isUrgent: false,
      });

      expect(result.content[0].text).not.toContain('MCP user not found');
      expect(insertCalls.length).toBe(1);
      expect(insertCalls[0].values.createdBy).toBe(SEED_USER_ID);
    });
  });
});
