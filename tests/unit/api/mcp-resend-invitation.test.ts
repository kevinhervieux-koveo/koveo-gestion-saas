/**
 * Unit tests for the `resend_invitation` MCP tool (task #147).
 *
 * Covers:
 *   - admin can resend any invitation in MCP scope
 *   - manager can resend invitations they sent
 *   - manager is denied resending invitations sent by someone else
 *   - tenant caller is denied
 *   - org-scope guard rejects invitations not in MCP-scoped orgs
 *   - missing invitation returns a not-found response
 *
 * Mocks the MCP SDK, the Drizzle `db`, and the email service so the
 * resend flow runs without touching real infrastructure.
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
const updateCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];

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
    select: jest.fn(() => makeSelectChain()),
    update: jest.fn((table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          updateCalls.push({ table, values: vals });
          return Promise.resolve();
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

const sendInvitationEmailMock = jest.fn().mockResolvedValue(true as never);
jest.mock('../../../server/services/email-service', () => ({
  emailService: {
    sendInvitationEmail: (...args: unknown[]) => sendInvitationEmailMock(...args),
  },
}));

import { createMcpServer } from '../../../server/mcp/server';

const ORG_ID = 'mcp-org-1';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';
const SEED_ADMIN_ID = 'seed-mcp-admin-id';
const INVITATION_ID = 'invitation-1';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  updateCalls.length = 0;
  sendInvitationEmailMock.mockClear();
  createMcpServer(undefined);
});

describe('MCP resend_invitation tool', () => {
  it('admin can resend any invitation within MCP scope', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        email: 'invitee@example.com',
        organizationId: ORG_ID,
        invitedByUserId: 'someone-else',
        role: 'tenant',
        token: 'token-abc',
        residenceId: null,
      },
    ]); // invitation lookup
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // lookupMcpUser('admin')
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]); // organization lookup
    selectQueue.push([
      { id: SEED_ADMIN_ID, firstName: 'Anna', lastName: 'Admin', email: 'anna@x.test' },
    ]); // caller full record

    const handler = registeredTools.get('resend_invitation');
    expect(handler).toBeDefined();
    const result = await handler!({ role: 'admin', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].values.status).toBe('pending');
    expect(updateCalls[0].values.expiresAt).toBeInstanceOf(Date);
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      id: INVITATION_ID,
      email: 'invitee@example.com',
      status: 'pending',
      emailSent: true,
    });
  });

  it('manager can resend an invitation they sent', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        email: 'invitee@example.com',
        organizationId: ORG_ID,
        invitedByUserId: SEED_MANAGER_ID,
        role: 'tenant',
        token: 'token-abc',
        residenceId: null,
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]);

    const handler = registeredTools.get('resend_invitation');
    const result = await handler!({ role: 'manager', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(1);
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.emailSent).toBe(true);
  });

  it('manager is denied when resending an invitation sent by someone else', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        email: 'invitee@example.com',
        organizationId: ORG_ID,
        invitedByUserId: 'other-manager-id',
        role: 'tenant',
        token: 'token-abc',
        residenceId: null,
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('resend_invitation');
    const result = await handler!({ role: 'manager', invitationId: INVITATION_ID });

    expect(result.content[0].text).toContain('managers can only resend invitations they sent');
    expect(updateCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('denies tenant callers with an Access denied response', async () => {
    const handler = registeredTools.get('resend_invitation');
    const result = await handler!({ role: 'tenant', invitationId: INVITATION_ID });

    expect(result.content[0].text).toContain('Access denied');
    expect(updateCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('rejects invitations outside the MCP scope', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        email: 'invitee@example.com',
        organizationId: 'non-mcp-org',
        invitedByUserId: SEED_MANAGER_ID,
        role: 'tenant',
        token: 'token-abc',
        residenceId: null,
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds returns only ORG_ID

    const handler = registeredTools.get('resend_invitation');
    const result = await handler!({ role: 'manager', invitationId: INVITATION_ID });

    expect(result.content[0].text).toContain('not in an MCP-scoped organization');
    expect(updateCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  it('returns a not-found response when invitation does not exist', async () => {
    selectQueue.push([]); // invitation lookup -> empty

    const handler = registeredTools.get('resend_invitation');
    const result = await handler!({ role: 'admin', invitationId: 'missing-id' });

    expect(result.content[0].text).toContain('Invitation not found');
    expect(updateCalls.length).toBe(0);
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });
});
