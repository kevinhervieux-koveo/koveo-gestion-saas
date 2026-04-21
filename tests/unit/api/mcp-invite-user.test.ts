/**
 * Unit tests for the `invite_user` MCP tool (task #146).
 *
 * Covers:
 *   - successful invite by manager (default invitedRole = manager)
 *   - tenant caller is denied
 *   - manager attempting to invite an admin is denied
 *   - org-scope guard rejects non-MCP organizations
 *
 * Mocks the MCP SDK, the Drizzle `db`, and the email service so the
 * registration flow runs without touching real infrastructure.
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
const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
const deleteCalls: Array<{ table: unknown }> = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

jest.mock('../../../server/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const { db } = jest.requireMock('../../../server/db') as { db: unknown };
      return cb(db);
    }),
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn((table: unknown) => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          insertCalls.push({ table, values: vals });
          return Promise.resolve([{ id: 'new-invitation-id', status: 'pending', ...vals }]);
        },
      }),
    })),
    delete: jest.fn((table: unknown) => ({
      where: () => {
        deleteCalls.push({ table });
        return Promise.resolve();
      },
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

const sendInvitationEmailMock = jest.fn().mockResolvedValue(true as never);
jest.mock('../../../server/services/email-service', () => ({
  emailService: {
    sendInvitationEmail: (...args: unknown[]) => sendInvitationEmailMock(...args),
  },
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'mcp-org-1';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  deleteCalls.length = 0;
  sendInvitationEmailMock.mockClear();
  // Re-register tools using the legacy (no-OAuth) path so the seed lookup runs.
  createMcpServer(undefined);
});

describe('MCP invite_user tool', () => {
  it('manager can successfully invite a tenant', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // lookupMcpUser('manager')
    selectQueue.push([]); // existing user check -> none
    selectQueue.push([]); // existing pending invitation lookup -> none (soft-replace path)
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]); // organization lookup
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]); // inviter full record

    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'manager',
      organizationId: ORG_ID,
      email: 'newtenant@example.com',
      invitedRole: 'tenant',
    });

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.email).toBe('newtenant@example.com');
    expect(insertCalls[0].values.role).toBe('tenant');
    expect(insertCalls[0].values.organizationId).toBe(ORG_ID);
    expect(insertCalls[0].values.invitedByUserId).toBe(SEED_MANAGER_ID);
    expect(insertCalls[0].values.token).toEqual(expect.any(String));
    expect(insertCalls[0].values.tokenHash).toEqual(expect.any(String));
    expect(deleteCalls.length).toBe(0); // soft-replace flow no longer hard-deletes
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      id: 'new-invitation-id',
      email: 'newtenant@example.com',
      role: 'tenant',
      organizationId: ORG_ID,
      status: 'pending',
      emailSent: true,
    });
  });

  it('denies tenant callers with an Access denied response', async () => {
    const handler = registeredTools.get('invite_user');
    const result = await handler!({
      role: 'tenant',
      organizationId: ORG_ID,
      email: 'someone@example.com',
      invitedRole: 'tenant',
    });

    expect(result.content[0].text).toContain('Access denied');
    expect(insertCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('manager cannot invite an admin', async () => {
    const handler = registeredTools.get('invite_user');
    const result = await handler!({
      role: 'manager',
      organizationId: ORG_ID,
      email: 'newadmin@example.com',
      invitedRole: 'admin',
    });

    expect(result.content[0].text).toContain('managers can only invite');
    expect(insertCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('rejects organizations outside the MCP scope', async () => {
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds returns only ORG_ID

    const handler = registeredTools.get('invite_user');
    const result = await handler!({
      role: 'manager',
      organizationId: 'some-other-org',
      email: 'newtenant@example.com',
      invitedRole: 'tenant',
    });

    expect(result.content[0].text).toContain('not in MCP scope');
    expect(insertCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('admin caller can invite an admin', async () => {
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: 'seed-admin-id', role: 'admin' }]);
    selectQueue.push([]);
    selectQueue.push([]); // existing pending invitation lookup -> none
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: 'seed-admin-id', firstName: 'Anna', lastName: 'Admin', email: 'anna@x.test' },
    ]);

    const handler = registeredTools.get('invite_user');
    const result = await handler!({
      role: 'admin',
      organizationId: ORG_ID,
      email: 'newadmin@example.com',
      invitedRole: 'admin',
    });

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values.role).toBe('admin');
    const payload = JSON.parse(result.content[0].text);
    expect(payload.role).toBe('admin');
    expect(payload.emailSent).toBe(true);
  });
});
