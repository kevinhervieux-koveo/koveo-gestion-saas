/**
 * Task #189 — MCP `invite_user` soft-replace regression.
 *
 * Two consecutive MCP invites for the same
 * (organizationId, email, residenceId) tuple must:
 *   1. Insert a brand-new invitation row.
 *   2. Mark the prior pending invitation as status='replaced' (NOT
 *      hard-delete it) via `db.update(invitations).set({status:'replaced'})`.
 *   3. Write an `invitation_audit_log` row with action='replaced' whose
 *      `details.replacedByInvitationId` points at the new invitation.
 *   4. Also write the standard `created` audit row for the new
 *      invitation.
 *
 * This test isolates the soft-replace path so a regression that
 * silently routes the MCP tool through a lower-level `storage.createInvitation`
 * (which would skip dedup), or that drops the `db.update(...)` /
 * `invitation_audit_log` writes, will fail loudly here even before the
 * REST endpoint regression test runs.
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
  // Drizzle pg tables expose `_.name` (or `Symbol(drizzle:Name)` in
  // newer versions). The MCP handler imports from
  // `shared/schema` so we can introspect the table identifier without
  // pinning to internals.
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
      // Some call sites await `.values(...)` directly (audit log inserts);
      // others chain `.values(...).returning()` (the new invitation
      // insert). Support both shapes by returning a thenable that *also*
      // exposes `.returning()`.
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

describe('MCP invite_user — soft-replace regression (task #189)', () => {
  it('two consecutive invite_user calls leave the first row in status=replaced with a replaced audit row pointing at the second', async () => {
    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();

    const args = {
      role: 'manager',
      organizationId: ORG_ID,
      email: 'duplicate@example.com',
      invitedRole: 'tenant',
      residenceId: RESIDENCE_ID,
    };

    // ---- First invite_user call ----
    // No prior pending invitation exists yet, so the soft-replace
    // SELECT returns []. The handler inserts a new invitation and a
    // single 'created' audit row.
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // lookupMcpUser
    selectQueue.push([]); // existing-user check -> none
    selectQueue.push([]); // existing pending invitation lookup -> none
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]); // organization lookup
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]); // inviter full record

    const firstResult = await handler!(args);
    const firstPayload = JSON.parse(firstResult.content[0].text);
    expect(firstPayload.status).toBe('pending');
    // After the first call there must be NO 'replaced' update.
    expect(
      updateCalls.find(
        (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
      ),
    ).toBeUndefined();

    // ---- Second invite_user call (same org/email/residence tuple) ----
    // The prior row is now "in the database" — model that by having
    // the dedup SELECT return its id. Use a stable id so we can assert
    // the replaced-audit row is keyed on the *first* invitation.
    selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // lookupMcpUser
    selectQueue.push([]); // existing-user check -> none
    selectQueue.push([{ id: PRIOR_INVITATION_ID }]); // existing pending invitation -> the first row
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]); // organization lookup
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]); // inviter full record

    const result = await handler!(args);

    // (1) Two new invitation rows were inserted across the two calls
    // (one per call). The handler must NOT skip insertion when a prior
    // pending row exists.
    const invitationInserts = insertCalls.filter((c) => c.tableName === 'invitations');
    expect(invitationInserts).toHaveLength(2);
    for (const ins of invitationInserts) {
      const v = ins.values as Record<string, unknown>;
      expect(v.email).toBe('duplicate@example.com');
      expect(v.residenceId).toBe(RESIDENCE_ID);
    }

    // (2) Soft-replace: exactly one db.update(invitations).set({status:'replaced'})
    // call (triggered by the second invite). The handler must NOT
    // hard-delete the prior row.
    const replaceUpdates = updateCalls.filter(
      (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
    );
    expect(replaceUpdates).toHaveLength(1);
    expect(deleteCalls.find((c) => c.tableName === 'invitations')).toBeUndefined();

    // (3) An invitation_audit_log row with action='replaced' was written
    // and its details.replacedByInvitationId points at the freshly
    // inserted invitation.
    const auditInserts = insertCalls.filter((c) => c.tableName === 'invitation_audit_log');
    const replacedAuditRows = auditInserts.flatMap((c) =>
      Array.isArray(c.values)
        ? (c.values as Record<string, unknown>[])
        : [c.values as Record<string, unknown>],
    );
    const replacedAudit = replacedAuditRows.find((r) => r.action === 'replaced');
    expect(replacedAudit).toBeDefined();
    expect(replacedAudit!.invitationId).toBe(PRIOR_INVITATION_ID);
    expect(replacedAudit!.previousStatus).toBe('pending');
    expect(replacedAudit!.newStatus).toBe('replaced');
    const details = replacedAudit!.details as Record<string, unknown>;
    expect(details.source).toBe('mcp');
    expect(details.tool).toBe('invite_user');
    expect(details.replacedByInvitationId).toBe('new-invitation-id');

    // (4) Standard 'created' audit row for the new invitation is also
    // written (mirrors REST POST /api/invitations).
    const createdAudit = replacedAuditRows.find((r) => r.action === 'created');
    expect(createdAudit).toBeDefined();
    expect(createdAudit!.invitationId).toBe('new-invitation-id');

    // Sanity: both invites succeeded end-to-end (one email per call).
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toMatchObject({
      id: 'new-invitation-id',
      email: 'duplicate@example.com',
      status: 'pending',
      emailSent: true,
    });
  });

  // Task #199 regression: the original report was that two MCP
  // invite_user calls with an empty-string residenceId (i.e. the
  // caller intends an org-level invite but passes "" instead of
  // omitting the field) left both rows pending. The MCP handler must
  // normalize "" → null at its boundary so the helper sees the same
  // tuple shape as the REST path, AND must store the new invitation
  // row with residenceId=null so the next call's `IS NOT DISTINCT
  // FROM null` lookup actually matches it. We also use a mixed-case
  // email here to lock in the helper's email lower-casing.
  it('normalizes empty-string residenceId and mixed-case email so consecutive MCP invites still soft-replace (task #199)', async () => {
    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();

    const args = {
      role: 'manager',
      organizationId: ORG_ID,
      email: 'Duplicate.MixedCase@Example.COM',
      invitedRole: 'tenant',
      residenceId: '',
    };

    // First call — no prior pending row.
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]);

    await handler!(args);

    // Second call (same logical invite) — dedup SELECT now returns
    // the prior row id.
    selectQueue.push([{ id: ORG_ID }]);
    selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]);
    selectQueue.push([]);
    selectQueue.push([{ id: PRIOR_INVITATION_ID }]);
    selectQueue.push([{ id: ORG_ID, name: 'MCP Org 1' }]);
    selectQueue.push([
      { id: SEED_MANAGER_ID, firstName: 'Mary', lastName: 'Manager', email: 'mary@x.test' },
    ]);

    await handler!(args);

    // Both invitation INSERTs must have stored residenceId=null
    // (NOT "") and the lower-cased email so the SELECT predicate
    // (eq(email) + IS NOT DISTINCT FROM null) actually matches on
    // subsequent calls.
    const invitationInserts = insertCalls.filter((c) => c.tableName === 'invitations');
    expect(invitationInserts).toHaveLength(2);
    for (const ins of invitationInserts) {
      const v = ins.values as Record<string, unknown>;
      expect(v.residenceId).toBeNull();
      expect(v.email).toBe('duplicate.mixedcase@example.com');
    }

    // The second call must trigger the soft-replace UPDATE pointing at
    // the prior row.
    const replaceUpdates = updateCalls.filter(
      (c) => c.tableName === 'invitations' && c.values.status === 'replaced',
    );
    expect(replaceUpdates).toHaveLength(1);

    const auditInserts = insertCalls.filter((c) => c.tableName === 'invitation_audit_log');
    const replacedAuditRows = auditInserts.flatMap((c) =>
      Array.isArray(c.values)
        ? (c.values as Record<string, unknown>[])
        : [c.values as Record<string, unknown>],
    );
    const replacedAudit = replacedAuditRows.find((r) => r.action === 'replaced');
    expect(replacedAudit).toBeDefined();
    expect(replacedAudit!.invitationId).toBe(PRIOR_INVITATION_ID);
    const details = replacedAudit!.details as Record<string, unknown>;
    expect(details.residenceId).toBeNull();
    expect(details.email).toBe('duplicate.mixedcase@example.com');
  });
});
