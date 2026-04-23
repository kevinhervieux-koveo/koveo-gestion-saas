/**
 * Unit tests for the per-session acting-role downgrade/restore added in task #460.
 *
 * Covers:
 *   - successful downgrade (manager → tenant, admin → manager/tenant)
 *   - rejected escalation attempts (manager → admin, tenant → manager)
 *   - successful restore back to the OAuth-bound role
 *   - rejection on legacy MCP_API_KEY sessions (no enforced role)
 *   - subsequent tool calls without an explicit `role` pick up the downgraded
 *     role (verified by inspecting `currentRole` returned by `get_mcp_info`)
 *   - downgrade state is per-session (a fresh server starts at the OAuth-bound role)
 *   - the wrapper invokes `getActingRole` per-call so live state changes propagate
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }> }>;
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

import {
  createMcpServer,
  wrapHandlerWithRoleEnforcement,
} from '../../../server/mcp/server';

beforeEach(() => {
  registeredTools.clear();
  registeredSchemas.clear();
  selectQueue.length = 0;
});

/**
 * Pre-load empty result rows for the four DB lookups `get_mcp_info` performs:
 * orgIds, orgs, users, buildingCount. The values themselves don't matter for
 * our acting-role assertions — we only inspect role-related fields.
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

describe('downgrade_acting_role / restore_acting_role tools', () => {
  describe('OAuth-authenticated sessions', () => {
    it('manager session can downgrade to tenant and back', async () => {
      createMcpServer({ role: 'manager' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const restore = registeredTools.get('restore_acting_role')!;
      expect(downgrade).toBeDefined();
      expect(restore).toBeDefined();

      const downRes = await downgrade({ role: 'tenant' });
      const downBody = parseInfo(downRes.content[0].text);
      expect(downBody.ok).toBe(true);
      expect(downBody.oauthBoundRole).toBe('manager');
      expect(downBody.previousActingRole).toBe('manager');
      expect(downBody.actingRole).toBe('tenant');
      expect(downBody.noChange).toBe(false);

      const restoreRes = await restore({});
      const restoreBody = parseInfo(restoreRes.content[0].text);
      expect(restoreBody.ok).toBe(true);
      expect(restoreBody.oauthBoundRole).toBe('manager');
      expect(restoreBody.previousActingRole).toBe('tenant');
      expect(restoreBody.actingRole).toBe('manager');
      expect(restoreBody.noChange).toBe(false);
    });

    it('admin session can downgrade to manager and to tenant', async () => {
      for (const target of ['manager', 'tenant'] as const) {
        registeredTools.clear();
        createMcpServer({ role: 'admin' });
        const downgrade = registeredTools.get('downgrade_acting_role')!;
        const res = await downgrade({ role: target });
        const body = parseInfo(res.content[0].text);
        expect(body.ok).toBe(true);
        expect(body.oauthBoundRole).toBe('admin');
        expect(body.actingRole).toBe(target);
      }
    });

    it('rejects manager session attempting to escalate to admin via downgrade tool', async () => {
      createMcpServer({ role: 'manager' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const res = await downgrade({ role: 'admin' });
      expect(res.content[0].text).toContain('Authorization mismatch');
      expect(res.content[0].text).toContain('"manager"');
      expect(res.content[0].text).toContain('"admin"');
    });

    it('rejects tenant session attempting to escalate (to manager) via downgrade tool', async () => {
      createMcpServer({ role: 'tenant' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const res = await downgrade({ role: 'manager' });
      expect(res.content[0].text).toContain('Authorization mismatch');
    });

    it('reports noChange when downgrading to the current acting role', async () => {
      createMcpServer({ role: 'manager' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const res = await downgrade({ role: 'manager' });
      const body = parseInfo(res.content[0].text);
      expect(body.ok).toBe(true);
      expect(body.noChange).toBe(true);
      expect(body.actingRole).toBe('manager');
    });

    it('reports noChange when restoring with no downgrade in effect', async () => {
      createMcpServer({ role: 'admin' });
      const restore = registeredTools.get('restore_acting_role')!;
      const res = await restore({});
      const body = parseInfo(res.content[0].text);
      expect(body.ok).toBe(true);
      expect(body.noChange).toBe(true);
      expect(body.actingRole).toBe('admin');
    });

    it('subsequent tool calls without explicit role pick up the downgraded role', async () => {
      createMcpServer({ role: 'admin' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      // Before downgrade: get_mcp_info should run as admin.
      primeGetMcpInfoSelects();
      const beforeRes = await getInfo({});
      const before = parseInfo(beforeRes.content[0].text);
      expect(before.currentRole).toBe('admin');
      expect(before.actingRole).toBe('admin');
      expect(before.downgradeActive).toBe(false);

      // Downgrade to tenant.
      await downgrade({ role: 'tenant' });

      // After downgrade: get_mcp_info called with NO role arg should now run as tenant.
      primeGetMcpInfoSelects();
      const afterRes = await getInfo({});
      const after = parseInfo(afterRes.content[0].text);
      expect(after.currentRole).toBe('tenant');
      expect(after.actingRole).toBe('tenant');
      expect(after.oauthBoundRole).toBe('admin');
      expect(after.downgradeActive).toBe(true);
    });

    it('explicit role on a per-call basis still works after a sticky downgrade', async () => {
      createMcpServer({ role: 'admin' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      await downgrade({ role: 'tenant' });

      // Explicit role wins over the sticky downgrade for this single call.
      primeGetMcpInfoSelects();
      const res = await getInfo({ role: 'manager' });
      const body = parseInfo(res.content[0].text);
      expect(body.currentRole).toBe('manager');
      // But the sticky acting role is unchanged.
      expect(body.actingRole).toBe('tenant');
    });

    it('restore reverts the sticky downgrade so subsequent calls run as the OAuth-bound role', async () => {
      createMcpServer({ role: 'admin' });
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const restore = registeredTools.get('restore_acting_role')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      await downgrade({ role: 'tenant' });
      await restore({});

      primeGetMcpInfoSelects();
      const res = await getInfo({});
      const body = parseInfo(res.content[0].text);
      expect(body.currentRole).toBe('admin');
      expect(body.actingRole).toBe('admin');
      expect(body.downgradeActive).toBe(false);
    });

    it('downgrade state is scoped per-session: a fresh server starts at the OAuth-bound role', async () => {
      createMcpServer({ role: 'admin' });
      const downgrade1 = registeredTools.get('downgrade_acting_role')!;
      await downgrade1({ role: 'tenant' });

      // Fresh session.
      registeredTools.clear();
      createMcpServer({ role: 'admin' });
      const getInfo2 = registeredTools.get('get_mcp_info')!;

      primeGetMcpInfoSelects();
      const res = await getInfo2({});
      const body = parseInfo(res.content[0].text);
      expect(body.actingRole).toBe('admin');
      expect(body.downgradeActive).toBe(false);
    });
  });

  describe('legacy MCP_API_KEY sessions (no OAuth-bound role)', () => {
    it('downgrade_acting_role returns a clear "no role to downgrade from" response', async () => {
      createMcpServer(undefined);
      const downgrade = registeredTools.get('downgrade_acting_role')!;
      const res = await downgrade({ role: 'tenant' });
      expect(res.content[0].text).toContain('No OAuth-bound role to downgrade from');
      expect(res.content[0].text).toContain('legacy');
    });

    it('restore_acting_role returns a clear "no role to restore" response', async () => {
      createMcpServer(undefined);
      const restore = registeredTools.get('restore_acting_role')!;
      const res = await restore({});
      expect(res.content[0].text).toContain('No OAuth-bound role to restore');
      expect(res.content[0].text).toContain('legacy');
    });

    it('get_mcp_info on legacy sessions reports actingRole=null and downgradeActive=false', async () => {
      createMcpServer(undefined);
      const getInfo = registeredTools.get('get_mcp_info')!;
      primeGetMcpInfoSelects();
      const res = await getInfo({ role: 'admin' });
      const body = parseInfo(res.content[0].text);
      expect(body.oauthBoundRole).toBeNull();
      expect(body.actingRole).toBeNull();
      expect(body.downgradeActive).toBe(false);
    });
  });
});

describe('wrapHandlerWithRoleEnforcement getActingRole integration', () => {
  it('injects the value returned by getActingRole when no role argument is supplied', async () => {
    let acting: 'manager' | 'tenant' = 'manager';
    const handler = jest.fn(async (a: Record<string, unknown>) => ({
      content: [{ type: 'text' as const, text: a.role as string }],
    }));
    const wrapped = wrapHandlerWithRoleEnforcement(handler, 'manager', () => acting);

    // Initial: acting is 'manager'.
    let res = (await wrapped({})) as { content: Array<{ text: string }> };
    expect(res.content[0].text).toBe('manager');

    // Mutate live state to simulate a downgrade.
    acting = 'tenant';

    // Same wrapped handler now sees the new acting role on the next call.
    res = (await wrapped({})) as { content: Array<{ text: string }> };
    expect(res.content[0].text).toBe('tenant');
  });

  it('explicit role argument overrides getActingRole', async () => {
    let acting: 'manager' | 'tenant' = 'tenant';
    const handler = jest.fn(async (a: Record<string, unknown>) => ({
      content: [{ type: 'text' as const, text: a.role as string }],
    }));
    const wrapped = wrapHandlerWithRoleEnforcement(handler, 'manager', () => acting);

    const res = (await wrapped({ role: 'manager' })) as { content: Array<{ text: string }> };
    expect(res.content[0].text).toBe('manager');
    expect(acting).toBe('tenant');
  });

  it('escalation via explicit role is still rejected when getActingRole is supplied', async () => {
    const handler = jest.fn(async () => ({ content: [{ type: 'text' as const, text: 'ran' }] }));
    const wrapped = wrapHandlerWithRoleEnforcement(handler, 'tenant', () => 'tenant');

    const res = (await wrapped({ role: 'admin' })) as { content: Array<{ text: string }> };
    expect(handler).not.toHaveBeenCalled();
    expect(res.content[0].text).toContain('Authorization mismatch');
  });
});
