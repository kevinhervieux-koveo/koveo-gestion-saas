/**
 * Unit tests for the admin-only `assume_user` / `restore_acting_user` MCP
 * tools added in task #642.
 *
 * Covers:
 *   - feature-flag gating (`MCP_ASSUME_USER`): both tools refuse to act when
 *     the flag is off, even for admin OAuth sessions.
 *   - non-admin OAuth sessions cannot impersonate (manager/tenant get a
 *     permission-denied response).
 *   - legacy MCP_API_KEY sessions (no OAuth-bound role) cannot impersonate.
 *   - unknown `userId` returns a clear error and does not mutate session state.
 *   - on success, `assume_user` updates the effective user resolution AND
 *     auto-downgrades `actingRole` to the assumed user's mapped MCP role.
 *   - subsequent tool calls without an explicit `role` pick up the assumed
 *     user's role (verified via `get_mcp_info`).
 *   - `restore_acting_user` clears the override and resets the acting role
 *     back to the OAuth-bound ceiling.
 *   - every successful invocation writes one row to `mcp_assume_user_log`.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }> }>;
const registeredTools = new Map<string, ToolHandler>();
const registeredSchemas = new Map<string, Record<string, unknown>>();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => {
    // Expose `_registeredTools` so that get_mcp_info can enumerate the tools
    // registered on this server instance (Task #789). Each instance gets its
    // own map so session-isolation is preserved across createMcpServer() calls.
    const _registeredTools: Record<string, { description: string }> = {};
    return {
      _registeredTools,
      tool: (name: string, desc: string, schema: Record<string, unknown>, handler: ToolHandler) => {
        registeredTools.set(name, handler);
        registeredSchemas.set(name, schema);
        _registeredTools[name] = { description: desc };
      },
    };
  }),
}));

const selectQueue: unknown[][] = [];
const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
// When set to a non-null Error, the next `db.insert(...).values(...)` call will
// reject with that error instead of resolving — used to assert audit-failure
// behaviour (Task #642 requires audit-first writes: a failed insert must
// abort impersonation rather than silently succeed).
let nextInsertError: Error | null = null;

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
    // Supports both the legacy `.values(...).returning()` path used by the
    // existing tools AND the bare `.values(...)` path used by the new
    // `mcp_assume_user_log` audit insert. The bare form returns a thenable
    // resolving to an empty array so `await db.insert(...).values(...)` works.
    // When `nextInsertError` is set, the bare form rejects so we can prove
    // audit-failure aborts impersonation.
    insert: jest.fn((table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        insertCalls.push({ table, values: vals });
        if (nextInsertError) {
          const err = nextInsertError;
          nextInsertError = null;
          const rejecting = Promise.reject(err);
          // Swallow the unhandled-rejection on the .returning() branch
          // (none of our code paths call it after an audit insert, but the
          // chain object must still expose the method for type parity).
          rejecting.catch(() => {});
          return {
            returning: () => Promise.reject(err),
            then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.reject(err).then(
                resolve as (v: unknown) => unknown,
                reject,
              ),
          };
        }
        return {
          returning: () => Promise.resolve([]),
          then: (cb: (v: unknown[]) => unknown) => Promise.resolve([]).then(cb),
        };
      },
    })),
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

let assumeUserEnabled = true;
jest.mock('../../../server/utils/feature-flags', () => ({
  isMcpAssumeUserEnabled: () => assumeUserEnabled,
  // Re-export anything else the server pulls in eagerly. Keep this list in
  // sync with `server/utils/feature-flags.ts`.
  isBillNumberV2Enabled: () => false,
}));

import { createMcpServer } from '../../../server/mcp/server';

beforeEach(() => {
  registeredTools.clear();
  registeredSchemas.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  assumeUserEnabled = true;
  nextInsertError = null;
});

function parse(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

/** Pre-load the four selects `get_mcp_info` performs (orgIds, orgs, users, buildingCount). */
function primeGetMcpInfoSelects() {
  selectQueue.push([]);
  selectQueue.push([]);
  selectQueue.push([]);
  selectQueue.push([]);
}

describe('assume_user / restore_acting_user tools (Task #642)', () => {
  // Helper: assert that a single audit row was written with the given
  // outcome and (optionally) attributed performed_by. Centralising this
  // keeps every "denied path" test consistent with the audit-log
  // requirement that EVERY invocation of either tool produces a row.
  const expectSingleAuditRow = (args: {
    action: 'assume' | 'restore';
    outcome: string;
    performedBy?: string | null;
    assumedUserId?: string | null;
  }) => {
    expect(insertCalls).toHaveLength(1);
    const row = insertCalls[0]!.values;
    expect(row.action).toBe(args.action);
    if (args.performedBy !== undefined) {
      expect(row.performedBy).toBe(args.performedBy);
    }
    if (args.assumedUserId !== undefined) {
      expect(row.assumedUserId).toBe(args.assumedUserId);
    }
    const details = row.details as Record<string, unknown>;
    expect(details.outcome).toBe(args.outcome);
  };

  describe('feature-flag gating', () => {
    it('assume_user refuses when MCP_ASSUME_USER is disabled but still audits the attempt', async () => {
      assumeUserEnabled = false;
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      expect(assume).toBeDefined();
      const res = await assume({ userId: 'target-user' });
      expect(res.content[0].text).toContain('not enabled');
      expect(res.content[0].text).toContain('MCP_ASSUME_USER');
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'feature_disabled',
        performedBy: 'admin-1',
        assumedUserId: null,
      });
      const details = insertCalls[0]!.values.details as Record<string, unknown>;
      expect(details.attemptedUserId).toBe('target-user');
    });

    it('restore_acting_user refuses when MCP_ASSUME_USER is disabled but still audits the attempt', async () => {
      assumeUserEnabled = false;
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const restore = registeredTools.get('restore_acting_user')!;
      const res = await restore({});
      expect(res.content[0].text).toContain('not enabled');
      expectSingleAuditRow({
        action: 'restore',
        outcome: 'feature_disabled',
        performedBy: 'admin-1',
      });
    });
  });

  describe('non-admin sessions cannot impersonate', () => {
    it('manager OAuth session calling assume_user is denied AND audited', async () => {
      createMcpServer({ role: 'manager', userId: 'mgr-1' });
      const assume = registeredTools.get('assume_user')!;
      const res = await assume({ userId: 'target-user' });
      expect(res.content[0].text).toContain('Permission denied');
      expect(res.content[0].text).toContain('admin');
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'not_admin',
        performedBy: 'mgr-1',
      });
    });

    it('tenant OAuth session calling assume_user is denied AND audited', async () => {
      createMcpServer({ role: 'tenant', userId: 'tenant-1' });
      const assume = registeredTools.get('assume_user')!;
      const res = await assume({ userId: 'target-user' });
      expect(res.content[0].text).toContain('Permission denied');
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'not_admin',
        performedBy: 'tenant-1',
      });
    });

    it('manager OAuth session calling restore_acting_user is denied AND audited', async () => {
      createMcpServer({ role: 'manager', userId: 'mgr-1' });
      const restore = registeredTools.get('restore_acting_user')!;
      const res = await restore({});
      expect(res.content[0].text).toContain('Permission denied');
      expectSingleAuditRow({
        action: 'restore',
        outcome: 'not_admin',
        performedBy: 'mgr-1',
      });
    });

    it('legacy MCP_API_KEY sessions (no OAuth-bound role) are denied AND audited with NULL performed_by', async () => {
      createMcpServer(undefined);
      const assume = registeredTools.get('assume_user')!;
      const res = await assume({ userId: 'target-user' });
      expect(res.content[0].text).toContain('OAuth-authenticated admin session');
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'not_oauth',
        performedBy: null,
      });
    });

    // Regression test for the wrapper-bypass guarantee: the generic
    // role-enforcement wrapper short-circuits with "Authorization mismatch"
    // when a non-admin caller passes an escalated `role` argument. If the
    // impersonation tools went through that wrapper, the short-circuit
    // would skip the audit row. We bypass the wrapper for these tools
    // (see IMPERSONATION_TOOL_NAMES) and remove `role` from their schema,
    // so even a malicious caller passing `role: "admin"` ends up in our
    // handler and produces a `not_admin` audit row.
    it('manager OAuth session passing role:"admin" to assume_user is still denied AND audited (wrapper bypass)', async () => {
      createMcpServer({ role: 'manager', userId: 'mgr-1' });
      const assume = registeredTools.get('assume_user')!;
      // Deliberately attempt escalation by passing role:"admin". The
      // wrapper would normally short-circuit and skip our handler — the
      // bypass guarantees the handler still runs and writes an audit row.
      const res = await assume({ role: 'admin', userId: 'target-user' });
      expect(res.content[0].text).toContain('Permission denied');
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'not_admin',
        performedBy: 'mgr-1',
      });
    });

    it('tenant OAuth session passing role:"admin" to restore_acting_user is still denied AND audited (wrapper bypass)', async () => {
      createMcpServer({ role: 'tenant', userId: 'tenant-1' });
      const restore = registeredTools.get('restore_acting_user')!;
      const res = await restore({ role: 'admin' });
      expect(res.content[0].text).toContain('Permission denied');
      expectSingleAuditRow({
        action: 'restore',
        outcome: 'not_admin',
        performedBy: 'tenant-1',
      });
    });
  });

  describe('admin successful impersonation', () => {
    it('rejects unknown userId without mutating session state but audits the attempt', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      // The lookupMcpUserById select returns []  (no user row).
      selectQueue.push([]);
      const res = await assume({ userId: 'does-not-exist' });
      expect(res.content[0].text).toContain('no user found');
      expect(res.content[0].text).toContain('does-not-exist');

      // Session state must be untouched: no impersonation active.
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({})).content[0].text);
      expect(info.assumedUserId).toBeNull();
      expect(info.impersonationActive).toBe(false);
      expect(info.actingRole).toBe('admin');

      // Audit row written for the failed lookup so operators can spot
      // probing or stale references.
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'unknown_target_user',
        performedBy: 'admin-1',
        assumedUserId: null,
      });
      const details = insertCalls[0]!.values.details as Record<string, unknown>;
      expect(details.attemptedUserId).toBe('does-not-exist');
    });

    it('successful assume_user updates assumedUserId, auto-downgrades actingRole to tenant, and writes audit row', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      // lookupMcpUserById -> tenant target row.
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      const res = await assume({ userId: 'tenant-target-id' });
      const body = parse(res.content[0].text);
      expect(body.ok).toBe(true);
      expect(body.assumedUserId).toBe('tenant-target-id');
      expect(body.assumedUserRole).toBe('tenant');
      expect(body.actingRole).toBe('tenant');
      expect(body.previousActingRole).toBe('admin');
      expect(body.previousAssumedUserId).toBeNull();

      // get_mcp_info now reflects the impersonation AND the auto-downgrade.
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({})).content[0].text);
      expect(info.assumedUserId).toBe('tenant-target-id');
      expect(info.impersonationActive).toBe(true);
      expect(info.oauthBoundRole).toBe('admin');
      expect(info.actingRole).toBe('tenant');
      expect(info.currentRole).toBe('tenant');
      expect(info.downgradeActive).toBe(true);

      // Exactly one audit row, captured with the right shape.
      expect(insertCalls).toHaveLength(1);
      const audit = insertCalls[0]!.values;
      expect(audit.performedBy).toBe('admin-1');
      expect(audit.assumedUserId).toBe('tenant-target-id');
      expect(audit.action).toBe('assume');
      const details = audit.details as Record<string, unknown>;
      expect(details.tool).toBe('assume_user');
      expect(details.assumedUserDbRole).toBe('tenant');
      expect(details.assumedUserMcpRole).toBe('tenant');
      expect(details.previousAssumedUserId).toBeNull();
    });

    it('assuming a manager auto-downgrades acting role to manager', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'mgr-target', role: 'manager' }]);
      const body = parse((await assume({ userId: 'mgr-target' })).content[0].text);
      expect(body.actingRole).toBe('manager');
      expect(body.assumedUserRole).toBe('manager');
    });

    it('assuming an admin keeps acting role at admin', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'other-admin', role: 'admin' }]);
      const body = parse((await assume({ userId: 'other-admin' })).content[0].text);
      expect(body.actingRole).toBe('admin');
    });

    it('assuming an unknown DB role (e.g. resident) collapses to tenant', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'resident-id', role: 'resident' }]);
      const body = parse((await assume({ userId: 'resident-id' })).content[0].text);
      expect(body.actingRole).toBe('tenant');
      expect(body.assumedUserRole).toBe('resident');
    });
  });

  describe('restore_acting_user', () => {
    it('clears the impersonation override and resets acting role to the OAuth ceiling', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      const restore = registeredTools.get('restore_acting_user')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      // First, impersonate.
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      await assume({ userId: 'tenant-target-id' });

      // Then, restore.
      const restoreRes = await restore({});
      const restoreBody = parse(restoreRes.content[0].text);
      expect(restoreBody.ok).toBe(true);
      expect(restoreBody.assumedUserId).toBeNull();
      expect(restoreBody.actingRole).toBe('admin');
      expect(restoreBody.previousAssumedUserId).toBe('tenant-target-id');
      expect(restoreBody.previousActingRole).toBe('tenant');
      expect(restoreBody.noChange).toBe(false);

      // get_mcp_info now reports no impersonation active and admin acting role.
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({})).content[0].text);
      expect(info.assumedUserId).toBeNull();
      expect(info.impersonationActive).toBe(false);
      expect(info.actingRole).toBe('admin');
      expect(info.currentRole).toBe('admin');
      expect(info.downgradeActive).toBe(false);

      // Two audit rows: one assume, one restore.
      expect(insertCalls).toHaveLength(2);
      expect(insertCalls[0]!.values.action).toBe('assume');
      expect(insertCalls[1]!.values.action).toBe('restore');
      expect(insertCalls[1]!.values.assumedUserId).toBe('tenant-target-id');
      const restoreDetails = insertCalls[1]!.values.details as Record<string, unknown>;
      expect(restoreDetails.tool).toBe('restore_acting_user');
      expect(restoreDetails.previousAssumedUserId).toBe('tenant-target-id');
    });

    // (no-op outcome assertion lives in the dedicated describe block below)
  });

  describe('session isolation', () => {
    it('a fresh server starts with no impersonation override', async () => {
      // First session: impersonate.
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume1 = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      await assume1({ userId: 'tenant-target-id' });

      // Second session: should start clean.
      registeredTools.clear();
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const getInfo2 = registeredTools.get('get_mcp_info')!;
      primeGetMcpInfoSelects();
      const info = parse((await getInfo2({})).content[0].text);
      expect(info.assumedUserId).toBeNull();
      expect(info.impersonationActive).toBe(false);
      expect(info.actingRole).toBe('admin');
    });
  });

  describe('audit durability (Task #642 compliance requirement)', () => {
    it('aborts assume_user when the audit insert fails and does not mutate session state', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      const getInfo = registeredTools.get('get_mcp_info')!;
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      nextInsertError = new Error('simulated DB outage');

      const res = await assume({ userId: 'tenant-target-id' });
      expect(res.content[0].text).toMatch(/assume_user aborted/i);
      expect(res.content[0].text).toMatch(/Session state was not changed/i);

      // The insert was attempted (so we still have the audit-attempt
      // visible in server logs), but the session state must not have
      // moved on to "impersonating".
      expect(insertCalls).toHaveLength(1);
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({})).content[0].text);
      expect(info.assumedUserId).toBeNull();
      expect(info.impersonationActive).toBe(false);
      expect(info.actingRole).toBe('admin');
    });

    it('aborts restore_acting_user when the audit insert fails and keeps prior impersonation in effect', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      const restore = registeredTools.get('restore_acting_user')!;
      const getInfo = registeredTools.get('get_mcp_info')!;

      // Successful assume.
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      await assume({ userId: 'tenant-target-id' });
      expect(insertCalls).toHaveLength(1);

      // Restore audit insert fails.
      nextInsertError = new Error('simulated DB outage');
      const res = await restore({});
      expect(res.content[0].text).toMatch(/restore_acting_user aborted/i);
      expect(res.content[0].text).toMatch(/Session state was not changed/i);

      // Still impersonating because the restore was rejected before mutating state.
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({})).content[0].text);
      expect(info.assumedUserId).toBe('tenant-target-id');
      expect(info.impersonationActive).toBe(true);
      expect(info.actingRole).toBe('tenant');
    });

    it('rejects assume_user without an OAuth userId but writes an audit row with NULL performed_by', async () => {
      // OAuth-bound role is admin, but no userId in the auth context —
      // we can still audit the attempt (with NULL performed_by) so the
      // attempt itself is visible to operators, but we refuse to flip
      // session state because the action cannot be safely attributed.
      createMcpServer({ role: 'admin' });
      const assume = registeredTools.get('assume_user')!;
      const res = await assume({ userId: 'tenant-target-id' });
      expect(res.content[0].text).toMatch(/cannot be safely attributed/i);
      expectSingleAuditRow({
        action: 'assume',
        outcome: 'missing_user_id',
        performedBy: null,
        assumedUserId: null,
      });
      const details = insertCalls[0]!.values.details as Record<string, unknown>;
      expect(details.attemptedUserId).toBe('tenant-target-id');
      expect(details.oauthHasUserId).toBe(false);
    });

    it('rejects restore_acting_user without an OAuth userId but writes an audit row with NULL performed_by', async () => {
      createMcpServer({ role: 'admin' });
      const restore = registeredTools.get('restore_acting_user')!;
      const res = await restore({});
      expect(res.content[0].text).toMatch(/cannot be safely attributed/i);
      expectSingleAuditRow({
        action: 'restore',
        outcome: 'missing_user_id',
        performedBy: null,
      });
    });

    it('writes performed_by as the OAuth userId (never a role string)', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-uuid-42' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'target-id', role: 'tenant' }]);
      await assume({ userId: 'target-id' });
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0]!.values.performedBy).toBe('admin-uuid-42');
      const details = insertCalls[0]!.values.details as Record<string, unknown>;
      expect(details.outcome).toBe('success');
    });
  });

  describe('restore_acting_user no-op outcome', () => {
    it('writes outcome=success_noop when restore is called with no impersonation active', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const restore = registeredTools.get('restore_acting_user')!;
      const res = await restore({});
      const body = parse(res.content[0].text);
      expect(body.ok).toBe(true);
      expect(body.noChange).toBe(true);
      expectSingleAuditRow({
        action: 'restore',
        outcome: 'success_noop',
        performedBy: 'admin-1',
        assumedUserId: null,
      });
    });
  });

  // Task #689 regression: before the fix, `schema.mcpAssumeUserLog` was
  // undefined, so `db.insert(schema.mcpAssumeUserLog)` was being called with
  // `undefined` as the table reference. The mock used elsewhere in this file
  // doesn't care what `table` is passed to `db.insert(table)`, which masked
  // the bug. These tests target the schema export directly to ensure the
  // table is real and that the audit-insert code path actually receives it.
  describe('schema export wiring (Task #689 regression)', () => {
    it('shared schema exports a real `mcpAssumeUserLog` Drizzle table', async () => {
      const schema = await import('@shared/schema');
      const { getTableName } = await import('drizzle-orm');
      expect(schema.mcpAssumeUserLog).toBeDefined();
      // Use Drizzle's public helper rather than reaching into Symbol-keyed
      // internals so this regression check stays valid across ORM upgrades.
      expect(getTableName(schema.mcpAssumeUserLog)).toBe('mcp_assume_user_log');
    });

    it('audit insert passes the real `mcpAssumeUserLog` table (not undefined) to db.insert', async () => {
      const schema = await import('@shared/schema');
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      await assume({ userId: 'tenant-target-id' });
      expect(insertCalls).toHaveLength(1);
      // The first positional arg to `db.insert(...)` must be the actual
      // table object — the bug being regressed was passing `undefined`.
      expect(insertCalls[0]!.table).toBeDefined();
      expect(insertCalls[0]!.table).toBe(schema.mcpAssumeUserLog);
    });

    it('audit insert path completes without throwing on the success outcome', async () => {
      // Sanity check that mirrors what production does: trigger the insert
      // path end-to-end and assert it resolves cleanly. With a missing
      // schema export this would throw `TypeError: Cannot read properties
      // of undefined (reading "Symbol(...).BaseName")` from drizzle.
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'tenant-target-id', role: 'tenant' }]);
      await expect(assume({ userId: 'tenant-target-id' })).resolves.toBeDefined();
    });
  });

  describe('audit log captures session-context metadata', () => {
    it('records ipAddress and userAgent from the McpAuthContext', async () => {
      createMcpServer({
        role: 'admin',
        userId: 'admin-1',
        ipAddress: '203.0.113.7',
        userAgent: 'TestAgent/1.0',
      });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'target-id', role: 'tenant' }]);
      await assume({ userId: 'target-id' });
      expect(insertCalls).toHaveLength(1);
      const row = insertCalls[0]!.values;
      expect(row.ipAddress).toBe('203.0.113.7');
      expect(row.userAgent).toBe('TestAgent/1.0');
    });

    it('records null ipAddress/userAgent when not provided', async () => {
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'target-id', role: 'tenant' }]);
      await assume({ userId: 'target-id' });
      const row = insertCalls[0]!.values;
      expect(row.ipAddress).toBeNull();
      expect(row.userAgent).toBeNull();
    });
  });

  // Task #789 acceptance tests — get_mcp_info tool visibility rules for the
  // impersonation tools (assume_user / restore_acting_user).
  describe('get_mcp_info tool visibility (Task #789)', () => {
    const WARN_PREFIX =
      'Requires the MCP_ASSUME_USER feature flag to be enabled on the server; ' +
      'without it, every call returns an explicit error.';

    // Acceptance test 1a: admin session with flag OFF — both tools listed, both with warning prefix.
    it('admin session + MCP_ASSUME_USER unset: both tools listed with warning prefix in description', async () => {
      assumeUserEnabled = false;
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const getInfo = registeredTools.get('get_mcp_info')!;
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({ role: 'admin' })).content[0].text) as {
        tools: Array<{ name: string; description: string }>;
      };

      const assumeTool = info.tools.find((t) => t.name === 'assume_user');
      const restoreTool = info.tools.find((t) => t.name === 'restore_acting_user');

      expect(assumeTool).toBeDefined();
      expect(restoreTool).toBeDefined();

      // Descriptions must start with the exact warning prefix (prefix + single space).
      expect(assumeTool!.description.startsWith(WARN_PREFIX + ' ')).toBe(true);
      expect(restoreTool!.description.startsWith(WARN_PREFIX + ' ')).toBe(true);

      // The original description content should still follow the prefix.
      expect(assumeTool!.description).toContain('Admin-only QA tool');
      expect(restoreTool!.description).toContain('Clear any impersonation override');
    });

    // Acceptance test 1b: manager session — impersonation tools must be absent entirely.
    it('manager session: assume_user and restore_acting_user are absent from tools list, flag value is irrelevant', async () => {
      // Verify with flag ON (flag should not affect visibility for non-admins).
      assumeUserEnabled = true;
      createMcpServer({ role: 'manager', userId: 'mgr-1' });
      const getInfo = registeredTools.get('get_mcp_info')!;
      primeGetMcpInfoSelects();
      const infoFlagOn = parse((await getInfo({ role: 'manager' })).content[0].text) as {
        tools: Array<{ name: string }>;
      };
      expect(infoFlagOn.tools.find((t) => t.name === 'assume_user')).toBeUndefined();
      expect(infoFlagOn.tools.find((t) => t.name === 'restore_acting_user')).toBeUndefined();
      // All other tools (at least one) should still be listed.
      expect(infoFlagOn.tools.length).toBeGreaterThan(0);

      // Verify with flag OFF as well.
      assumeUserEnabled = false;
      registeredTools.clear();
      registeredSchemas.clear();
      createMcpServer({ role: 'manager', userId: 'mgr-1' });
      const getInfo2 = registeredTools.get('get_mcp_info')!;
      primeGetMcpInfoSelects();
      const infoFlagOff = parse((await getInfo2({ role: 'manager' })).content[0].text) as {
        tools: Array<{ name: string }>;
      };
      expect(infoFlagOff.tools.find((t) => t.name === 'assume_user')).toBeUndefined();
      expect(infoFlagOff.tools.find((t) => t.name === 'restore_acting_user')).toBeUndefined();
    });

    // Acceptance test 1c: admin session with flag ON — tools listed without warning.
    it('admin session + MCP_ASSUME_USER=1: both tools listed with original descriptions (no warning prefix)', async () => {
      assumeUserEnabled = true;
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const getInfo = registeredTools.get('get_mcp_info')!;
      primeGetMcpInfoSelects();
      const info = parse((await getInfo({ role: 'admin' })).content[0].text) as {
        tools: Array<{ name: string; description: string }>;
      };

      const assumeTool = info.tools.find((t) => t.name === 'assume_user');
      const restoreTool = info.tools.find((t) => t.name === 'restore_acting_user');

      expect(assumeTool).toBeDefined();
      expect(restoreTool).toBeDefined();

      // Must NOT have the warning prefix when the flag is enabled.
      expect(assumeTool!.description).not.toContain(WARN_PREFIX);
      expect(restoreTool!.description).not.toContain(WARN_PREFIX);

      // Original description content should be intact.
      expect(assumeTool!.description).toContain('Admin-only QA tool');
      expect(restoreTool!.description).toContain('Clear any impersonation override');
    });

    // Acceptance test 2 (already covered by 'successful assume_user updates...' above).
    // Verify it explicitly with the flag enabled for completeness of the spec.
    it('MCP_ASSUME_USER=1 + admin: assume_user succeeds and writes action=assume, outcome=success audit row', async () => {
      assumeUserEnabled = true;
      createMcpServer({ role: 'admin', userId: 'admin-1' });
      const assume = registeredTools.get('assume_user')!;
      selectQueue.push([{ id: 'tenant-id', role: 'tenant' }]);
      const res = await assume({ userId: 'tenant-id' });
      const body = parse(res.content[0].text);
      expect(body.ok).toBe(true);
      expect(insertCalls).toHaveLength(1);
      const row = insertCalls[0]!.values;
      expect(row.action).toBe('assume');
      const details = row.details as Record<string, unknown>;
      expect(details.outcome).toBe('success');
    });

    // Acceptance test 3: flag enabled + manager OAuth → role-permission error, not flag error.
    // This verifies that the error-precedence order inside assume_user was NOT changed by Task #789:
    // the feature-flag check fires first, the role check fires second — so when the flag IS on,
    // a manager caller hits the role-rejection path (not_admin) rather than feature_disabled.
    it('MCP_ASSUME_USER=1 + manager: assume_user returns role-permission error (not flag error), audit row outcome=not_admin', async () => {
      assumeUserEnabled = true;
      createMcpServer({ role: 'manager', userId: 'mgr-1' });
      const assume = registeredTools.get('assume_user')!;
      const res = await assume({ userId: 'some-user' });

      // Must be the role-rejection message, not the feature-flag message.
      expect(res.content[0].text).toContain('Permission denied');
      expect(res.content[0].text).not.toContain('MCP_ASSUME_USER');
      expect(res.content[0].text).not.toContain('not enabled');

      expectSingleAuditRow({
        action: 'assume',
        outcome: 'not_admin',
        performedBy: 'mgr-1',
      });
    });
  });
});
