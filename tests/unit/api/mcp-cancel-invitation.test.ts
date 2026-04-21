/**
 * Unit tests for the `cancel_invitation` MCP tool (task #148).
 *
 * Covers:
 *   - admin can cancel any pending invitation in MCP scope
 *   - manager can cancel an invitation they sent
 *   - manager cannot cancel an invitation sent by someone else
 *   - tenant caller is denied
 *   - non-pending invitations cannot be cancelled
 *   - invitations outside MCP-scoped organizations are denied
 *   - missing invitation returns a not-found response
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
const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];

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
        where: () => ({
          returning: () => {
            updateCalls.push({ table, values: vals });
            const last = updateCalls[updateCalls.length - 1];
            return Promise.resolve([
              {
                id: 'invitation-1',
                email: 'someone@example.com',
                role: 'tenant',
                organizationId: 'mcp-org-1',
                ...last.values,
              },
            ]);
          },
        }),
      }),
    })),
    insert: jest.fn((table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        insertCalls.push({ table, values: vals });
        return Promise.resolve();
      },
    })),
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
const INVITATION_ID = 'invitation-1';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';
const SEED_ADMIN_ID = 'seed-mcp-admin-id';
const OTHER_INVITER_ID = 'some-other-manager-id';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  updateCalls.length = 0;
  insertCalls.length = 0;
  createMcpServer(undefined);
});

describe('MCP cancel_invitation tool', () => {
  it('admin can cancel any pending invitation in MCP scope', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        organizationId: ORG_ID,
        status: 'pending',
        invitedByUserId: OTHER_INVITER_ID,
        email: 'invitee@example.com',
        role: 'tenant',
      },
    ]); // invitation lookup
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_ADMIN_ID, role: 'admin' }]); // caller lookup

    const handler = registeredTools.get('cancel_invitation');
    expect(handler).toBeDefined();
    const result = await handler!({ role: 'admin', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].values.status).toBe('cancelled');
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      id: INVITATION_ID,
      status: 'cancelled',
      cancelledBy: SEED_ADMIN_ID,
    });

    // Audit trail (task #151): MCP cancellation must write an
    // invitation_audit_log row with the resolved caller as performedBy
    // and the previous/new status pair recorded.
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values).toMatchObject({
      invitationId: INVITATION_ID,
      action: 'cancelled',
      performedBy: SEED_ADMIN_ID,
      previousStatus: 'pending',
      newStatus: 'cancelled',
    });
    expect(insertCalls[0].values.details).toMatchObject({
      source: 'mcp',
      tool: 'cancel_invitation',
      role: 'admin',
    });
  });

  it('manager can cancel a pending invitation they sent', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        organizationId: ORG_ID,
        status: 'pending',
        invitedByUserId: SEED_MANAGER_ID,
        email: 'invitee@example.com',
        role: 'tenant',
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('cancel_invitation');
    const result = await handler!({ role: 'manager', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(1);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe('cancelled');
    expect(payload.cancelledBy).toBe(SEED_MANAGER_ID);

    // Manager cancellations also write to invitation_audit_log.
    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0].values).toMatchObject({
      action: 'cancelled',
      performedBy: SEED_MANAGER_ID,
      previousStatus: 'pending',
      newStatus: 'cancelled',
    });
  });

  it('manager cannot cancel an invitation sent by someone else', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        organizationId: ORG_ID,
        status: 'pending',
        invitedByUserId: OTHER_INVITER_ID,
        email: 'invitee@example.com',
        role: 'tenant',
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);

    const handler = registeredTools.get('cancel_invitation');
    const result = await handler!({ role: 'manager', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(0);
    expect(result.content[0].text).toContain('managers can only cancel invitations they sent');
  });

  it('denies tenant callers with an Access denied response', async () => {
    const handler = registeredTools.get('cancel_invitation');
    const result = await handler!({ role: 'tenant', invitationId: INVITATION_ID });

    expect(result.content[0].text).toContain('Access denied');
    expect(updateCalls.length).toBe(0);
  });

  it('refuses to cancel non-pending invitations', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        organizationId: ORG_ID,
        status: 'accepted',
        invitedByUserId: SEED_MANAGER_ID,
        email: 'invitee@example.com',
        role: 'tenant',
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]);

    const handler = registeredTools.get('cancel_invitation');
    const result = await handler!({ role: 'admin', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(0);
    expect(result.content[0].text).toContain('only pending invitations can be cancelled');
  });

  it('rejects invitations outside the MCP-scoped organizations', async () => {
    selectQueue.push([
      {
        id: INVITATION_ID,
        organizationId: 'some-other-org',
        status: 'pending',
        invitedByUserId: SEED_MANAGER_ID,
        email: 'invitee@example.com',
        role: 'tenant',
      },
    ]);
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds returns only the MCP org

    const handler = registeredTools.get('cancel_invitation');
    const result = await handler!({ role: 'admin', invitationId: INVITATION_ID });

    expect(updateCalls.length).toBe(0);
    expect(result.content[0].text).toContain('not in an MCP-scoped organization');
  });

  it('returns a not-found response for unknown invitation ids', async () => {
    selectQueue.push([]); // invitation lookup -> none

    const handler = registeredTools.get('cancel_invitation');
    const result = await handler!({ role: 'admin', invitationId: 'missing-id' });

    expect(updateCalls.length).toBe(0);
    expect(result.content[0].text).toContain('Invitation not found');
  });
});
