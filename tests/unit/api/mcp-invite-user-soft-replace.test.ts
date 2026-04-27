/**
 * Task #250 — MCP `invite_user` duplicate-invite conflict.
 *
 * The previous "soft-replace" behavior (silently mark prior pending invite
 * as `replaced` and issue a new one) has been removed. A second
 * `invite_user` call for the same (organizationId, email, residenceId)
 * tuple must now:
 *   1. NOT insert a new invitation row.
 *   2. NOT mutate the prior pending invitation (no `db.update(invitations)
 *      .set({status:'replaced'})` and no hard delete).
 *   3. NOT write any `replaced` audit log entry.
 *   4. Return a structured tool response with
 *      `status='already_invited'`, `code='INVITATION_ALREADY_PENDING'`,
 *      and a message directing the caller to `resend_invitation` /
 *      `cancel_invitation`.
 *
 * The happy path (no prior pending row) must still succeed and write the
 * standard `created` audit log entry.
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
const insertCalls: Array<{ tableName: string; values: unknown }> = [];
const updateCalls: Array<{ tableName: string; values: Record<string, unknown> }> = [];
const deleteCalls: Array<{ tableName: string }> = [];

function tableName(table: unknown): string {
  const t = table as { _?: { name?: string }; [k: symbol]: unknown };
  if (t?._?.name) return t._.name;
  for (const sym of Object.getOwnPropertySymbols(t ?? {})) {
    if (sym.description === 'drizzle:Name') {
      const v = (t as Record<symbol, unknown>)[sym];
      if (typeof v === 'string') return v;
    }
  }
  return 'unknown';
}

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
      values: (vals: unknown) => {
        const name = tableName(table);
        insertCalls.push({ tableName: name, values: vals });
        const rows = Array.isArray(vals)
          ? (vals as Record<string, unknown>[]).map((v, i) => ({
              id: `new-${name}-${i}`,
              status: 'pending',
              ...v,
            }))
          : [{ id: 'new-invitation-id', status: 'pending', ...(vals as Record<string, unknown>) }];
        const promise = Promise.resolve(rows) as Promise<unknown> & {
          returning?: () => Promise<unknown[]>;
        };
        promise.returning = () => Promise.resolve(rows);
        return promise;
      },
    })),
    update: jest.fn((table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          updateCalls.push({ tableName: tableName(table), values: vals });
          return Promise.resolve();
        },
      }),
    })),
    delete: jest.fn((table: unknown) => ({
      where: () => {
        deleteCalls.push({ tableName: tableName(table) });
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
const RESIDENCE_ID = 'res-1';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';
const PRIOR_INVITATION_ID = 'prior-pending-invitation-id';

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  insertCalls.length = 0;
  updateCalls.length = 0;
  deleteCalls.length = 0;
  sendInvitationEmailMock.mockClear();
  createMcpServer(undefined);
});

describe('MCP invite_user — duplicate invite returns 409-style conflict (task #250)', () => {
  it('first invite succeeds and writes a created audit row (happy path)', async () => {
    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();

    const args = {
      role: 'manager',
      organizationId: ORG_ID,
      email: 'fresh@example.com',
      invitedRole: 'tenant',
      residenceId: RESIDENCE_ID,
    };

    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // lookupMcpUser
    selectQueue.push([]); // existing-user check -> none
    // Residence-org scope check (task #1306) — two new selects before dedup
    selectQueue.push([{ buildingId: 'building-1' }]); // residence lookup
    selectQueue.push([{ organizationId: ORG_ID }]); // building org lookup
    selectQueue.push([]); // existing pending invitation lookup -> none
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]); // organization lookup
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]); // inviter full record

    const result = await handler!(args);
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      id: 'new-invitation-id',
      email: 'fresh@example.com',
      status: 'pending',
      emailSent: true,
    });

    // Exactly one new invitation row, no soft-replace UPDATE, no delete.
    const invitationInserts = insertCalls.filter((c) => c.tableName === 'invitations');
    expect(invitationInserts).toHaveLength(1);
    expect(
      updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();
    expect(deleteCalls.find((c) => c.tableName === 'invitations')).toBeUndefined();

    // Standard `created` audit row written.
    const auditRows = insertCalls
      .filter((c) => c.tableName === 'invitation_audit_log')
      .flatMap((c) =>
        Array.isArray(c.values)
          ? (c.values as Record<string, unknown>[])
          : [c.values as Record<string, unknown>],
      );
    const createdAudit = auditRows.find((r) => r.action === 'created');
    expect(createdAudit).toBeDefined();
    expect(createdAudit!.invitationId).toBe('new-invitation-id');
    expect(auditRows.find((r) => r.action === 'replaced')).toBeUndefined();

    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);
  });

  it('second invite for the same (org, email, residence) returns INVITATION_ALREADY_PENDING and does NOT mutate the prior pending row', async () => {
    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();

    const args = {
      role: 'manager',
      organizationId: ORG_ID,
      email: 'duplicate@example.com',
      invitedRole: 'tenant',
      residenceId: RESIDENCE_ID,
    };

    // Dedup SELECT returns a prior pending row id, simulating the second
    // invite attempt. The handler must reject without inserting a new
    // invitation, without flipping the prior row to `replaced`, and
    // without sending another email.
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // lookupMcpUser
    selectQueue.push([]); // existing-user check -> none
    // Residence-org scope check (task #1306) — two new selects before dedup
    selectQueue.push([{ buildingId: 'building-1' }]); // residence lookup
    selectQueue.push([{ organizationId: ORG_ID }]); // building org lookup
    selectQueue.push([{ id: PRIOR_INVITATION_ID }]); // existing pending invitation -> prior row
    // Org lookup / inviter lookup queued in case the handler reaches them
    // (it must not — assertions below confirm).
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]);

    const result = await handler!(args);

    // (1) Structured conflict response with the new error code.
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe('already_invited');
    expect(payload.code).toBe('INVITATION_ALREADY_PENDING');
    expect(typeof payload.message).toBe('string');
    expect(payload.message).toMatch(/resend_invitation/);
    expect(payload.message).toMatch(/cancel_invitation/);

    // (2) NO new invitation row inserted.
    const invitationInserts = insertCalls.filter((c) => c.tableName === 'invitations');
    expect(invitationInserts).toHaveLength(0);

    // (3) Prior invite untouched: no soft-replace UPDATE, no delete.
    expect(
      updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();
    expect(deleteCalls.find((c) => c.tableName === 'invitations')).toBeUndefined();

    // (4) NO `replaced` audit log row written.
    const auditRows = insertCalls
      .filter((c) => c.tableName === 'invitation_audit_log')
      .flatMap((c) =>
        Array.isArray(c.values)
          ? (c.values as Record<string, unknown>[])
          : [c.values as Record<string, unknown>],
      );
    expect(auditRows.find((r) => r.action === 'replaced')).toBeUndefined();
    expect(auditRows.find((r) => r.action === 'created')).toBeUndefined();

    // (5) No email sent on the conflict path.
    expect(sendInvitationEmailMock).not.toHaveBeenCalled();
  });

  // Task #199 regression preserved: the helper still normalizes empty-string
  // residenceId and mixed-case email so the dedup SELECT actually matches
  // prior rows. We exercise the same normalization but assert the new
  // conflict outcome instead of the soft-replace UPDATE.
  it('normalizes empty-string residenceId and mixed-case email so a duplicate org-level MCP invite still hits the conflict path', async () => {
    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();

    const args = {
      role: 'manager',
      organizationId: ORG_ID,
      email: 'Duplicate.MixedCase@Example.COM',
      invitedRole: 'tenant',
      residenceId: '',
    };

    // First call — no prior pending row, succeeds.
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]);

    await handler!(args);

    // Confirm the inserted row was normalized (residenceId=null, lowercased
    // email) so the next dedup SELECT can match it via IS NOT DISTINCT FROM.
    const firstInsert = insertCalls.find((c) => c.tableName === 'invitations');
    expect(firstInsert).toBeDefined();
    const v = firstInsert!.values as Record<string, unknown>;
    expect(v.residenceId).toBeNull();
    expect(v.email).toBe('duplicate.mixedcase@example.com');

    // Second call (same logical invite) — dedup SELECT returns the prior
    // row id; helper must reject with the new conflict envelope.
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);
    selectQueue.push([]);
    selectQueue.push([{ id: PRIOR_INVITATION_ID }]);
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]);

    const result = await handler!(args);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe('already_invited');
    expect(payload.code).toBe('INVITATION_ALREADY_PENDING');

    // Only one invitation row across both calls — second call rejected.
    const invitationInserts = insertCalls.filter((c) => c.tableName === 'invitations');
    expect(invitationInserts).toHaveLength(1);

    // No soft-replace UPDATE on the prior row.
    expect(
      updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();
  });
});
