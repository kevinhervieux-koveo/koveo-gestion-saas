/**
 * Task #214 — MCP `invite_user` must NOT leak driver-level error details.
 *
 * The MCP SDK surfaces thrown error messages verbatim to the client. When
 * `createInvitationWithSoftReplace` (or its underlying Drizzle/postgres-js
 * call) throws, the raw `error.message` typically includes the failing SQL
 * statement and its bound parameter values (table/column names, the invitee
 * email, etc.). The MCP wrapper must catch those and return a short,
 * friendly message instead.
 *
 * This test mocks the soft-replace helper to throw two different errors and
 * asserts that:
 *   (a) the MCP tool returns the friendly text branch (race-loss vs generic),
 *   (b) the response body contains none of the SQL / parameter substrings
 *       from the raw driver error,
 *   (c) the full error is still logged server-side via console.error.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

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
    insert: jest.fn(() => ({
      values: () => ({ returning: () => Promise.resolve([]) }),
    })),
    update: jest.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    delete: jest.fn(() => ({ where: () => Promise.resolve() })),
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
  emailService: {
    sendInvitationEmail: jest.fn().mockResolvedValue(true as never),
  },
}));

const createInvitationWithSoftReplaceMock = jest.fn();
jest.mock('../../../server/services/invitation-soft-replace', () => {
  const actual = jest.requireActual(
    '../../../server/services/invitation-soft-replace',
  ) as Record<string, unknown>;
  return {
    ...actual,
    createInvitationWithSoftReplace: (...args: unknown[]) =>
      createInvitationWithSoftReplaceMock(...args),
  };
});

import { createMcpServer } from '../../../server/mcp/server';
import { InvitationSoftReplaceRaceLostError } from '../../../server/services/invitation-soft-replace';

const ORG_ID = 'mcp-org-1';
const SEED_MANAGER_ID = 'seed-mcp-manager-id';

// Substrings from the simulated driver error that, if present in the MCP
// response body, would constitute a leak of schema details / PII.
const SQL_SUBSTRINGS = [
  'insert into "invitations"',
  'organization_id',
  'token_hash',
  '$1',
  '$2',
  'pg_query',
  'leaked-secret-token-abc123',
  'duplicate@example.com',
];

let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

beforeEach(() => {
  registeredTools.clear();
  selectQueue.length = 0;
  createInvitationWithSoftReplaceMock.mockReset();
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  createMcpServer(undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

function primeSeedSelects() {
  selectQueue.push([{ id: ORG_ID }]); // getMcpOrgIds
  selectQueue.push([{ id: SEED_MANAGER_ID, role: 'manager' }]); // lookupMcpUser
  selectQueue.push([]); // existing-user check -> none
}

describe('MCP invite_user — sanitizes error responses (task #214)', () => {
  it('returns generic friendly text and hides SQL/params when the helper throws a pg-style driver error', async () => {
    primeSeedSelects();

    const driverError = new Error(
      'insert into "invitations" ("organization_id","email","token_hash") values ($1,$2,$3) - duplicate key value violates unique constraint "invitations_pkey": leaked-secret-token-abc123 / duplicate@example.com',
    );
    (driverError as Error & { code?: string }).code = '23505';
    createInvitationWithSoftReplaceMock.mockRejectedValueOnce(driverError);

    const handler = registeredTools.get('invite_user');
    expect(handler).toBeDefined();
    const result = await handler!({
      role: 'manager',
      organizationId: ORG_ID,
      email: 'duplicate@example.com',
      invitedRole: 'tenant',
    });

    const text = result.content[0].text;
    // Task #243 — invitation create errors now route through
    // buildWriteErrorResponse, which emits a structured JSON envelope
    // for known PostgreSQL error codes (23505 unique_violation here).
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.status).toBe('unique_violation');
    expect(parsed.code).toBe('UNIQUE_VIOLATION');
    expect(typeof parsed.message).toBe('string');
    for (const leak of SQL_SUBSTRINGS) {
      expect(text).not.toContain(leak);
    }

    // Full error is still logged server-side for operators.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedArgs = consoleErrorSpy.mock.calls[0];
    expect(loggedArgs[0]).toContain('[mcp:invite_user]');
    expect(loggedArgs[1]).toBe(driverError);
  });

  it('also sanitizes pre-soft-replace DB lookup failures (e.g. getMcpOrgIds throwing a pg-style error)', async () => {
    // Make the very first SELECT (used by getMcpOrgIds) throw a pg-style
    // driver error. The new try/catch must catch it before the MCP SDK
    // surfaces err.message verbatim to the client.
    const driverError = new Error(
      'select "id" from "organizations" where "name" in ($1,$2) - connection refused at host=db-prod-internal port=5432 user=koveo_secret password=top-secret-password',
    );
    (driverError as Error & { code?: string }).code = '08006';

    const dbModule = jest.requireMock('../../../server/db') as {
      db: { select: jest.Mock };
    };
    dbModule.db.select.mockImplementationOnce(() => {
      throw driverError;
    });

    const handler = registeredTools.get('invite_user');
    const result = await handler!({
      role: 'manager',
      organizationId: ORG_ID,
      email: 'duplicate@example.com',
      invitedRole: 'tenant',
    });

    const text = result.content[0].text;
    expect(text).toBe('Failed to create invitation — please retry');
    for (const leak of [
      'select "id"',
      'organizations',
      'connection refused',
      'db-prod-internal',
      'top-secret-password',
      'koveo_secret',
      '$1',
      '$2',
    ]) {
      expect(text).not.toContain(leak);
    }
    // createInvitationWithSoftReplace must NOT be reached on this path.
    expect(createInvitationWithSoftReplaceMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('returns the race-loss friendly text when the helper throws InvitationSoftReplaceRaceLostError', async () => {
    primeSeedSelects();

    createInvitationWithSoftReplaceMock.mockRejectedValueOnce(
      new InvitationSoftReplaceRaceLostError(),
    );

    const handler = registeredTools.get('invite_user');
    const result = await handler!({
      role: 'manager',
      organizationId: ORG_ID,
      email: 'duplicate@example.com',
      invitedRole: 'tenant',
    });

    const text = result.content[0].text;
    // Task #204 — the wrapper now returns a structured "already-invited"
    // outcome (parseable JSON) rather than a free-form string so the
    // calling assistant can branch on `status` deterministically.
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.status).toBe('already_invited');
    expect(parsed.code).toBe('INVITATION_ALREADY_PENDING');
    expect(typeof parsed.message).toBe('string');
    // Even the helper's own (already-friendly) message should not leak the
    // tuple-keeps-winning-the-race phrasing through the wrapper.
    expect(text).not.toContain('keeps winning the race');
    expect(text).not.toContain('organization, email, residence');
  });
});
