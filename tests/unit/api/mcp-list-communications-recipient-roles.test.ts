import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Task #153: drizzle-orm mocks were relocated out of `__mocks__/` so they
// no longer auto-apply. This suite walks the captured WHERE clause as
// JSON, which only works against the mocked operator stubs.
jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

let lastWhereClause: any = null;
let returnedRows: any[] = [];
const orderByMock = jest.fn().mockImplementation(() => Promise.resolve(returnedRows));
const whereMock = jest.fn().mockImplementation((clause: any) => {
  lastWhereClause = clause;
  return { orderBy: orderByMock, then: (r: any) => Promise.resolve(returnedRows).then(r) };
});
const fromMock = jest.fn().mockReturnValue({ where: whereMock });

const mockSelectChain: any = {
  from: fromMock,
  where: whereMock,
  orderBy: orderByMock,
  innerJoin: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
};

const mockDb = {
  select: jest.fn().mockReturnValue(mockSelectChain),
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{}]),
  }),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/services/document-service', () => ({
  DocumentService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/objectStorage', () => ({
  ObjectStorageService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../../server/services/consolidated-ai-service', () => ({
  aiService: { analyzeDocument: jest.fn(), getAnalysisStatus: jest.fn() },
}));

import { createMcpServer } from '../../../server/mcp/server';

function getHandler(server: any, name: string) {
  return server._registeredTools[name].handler ?? server._registeredTools[name].callback;
}

function serializeClause(clause: any): string {
  try {
    return JSON.stringify(clause, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
  } catch {
    return String(clause);
  }
}

describe('MCP list_communications recipientRoles filter', () => {
  let server: any;

  beforeEach(() => {
    jest.clearAllMocks();
    lastWhereClause = null;
    returnedRows = [];
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([{ id: 'org-1' }]),
          }),
        } as any;
      }
      return mockSelectChain;
    });
    server = createMcpServer();
  });

  it('admin call does NOT add a recipientRoles filter', async () => {
    const handler = getHandler(server, 'list_communications');
    await handler({ role: 'admin', organizationId: 'org-1' }, {});
    const serialized = serializeClause(lastWhereClause).toLowerCase();
    expect(serialized).not.toContain('recipient_roles');
    expect(serialized).not.toContain('cardinality');
  });

  it('tenant call adds NULL, empty-array, and ANY(role) clauses', async () => {
    const handler = getHandler(server, 'list_communications');
    await handler({ role: 'tenant', organizationId: 'org-1' }, {});
    const serialized = serializeClause(lastWhereClause);
    const lower = serialized.toLowerCase();
    expect(lower).toContain('recipient_roles');
    expect(lower).toContain('cardinality');
    expect(lower).toContain('isnull');
    expect(serialized).toContain('tenant');
  });

  it('manager call adds NULL, empty-array, and ANY(manager) clauses', async () => {
    const handler = getHandler(server, 'list_communications');
    await handler({ role: 'manager', organizationId: 'org-1' }, {});
    const serialized = serializeClause(lastWhereClause);
    const lower = serialized.toLowerCase();
    expect(lower).toContain('recipient_roles');
    expect(lower).toContain('cardinality');
    expect(serialized).toContain('manager');
  });
});
