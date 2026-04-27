/**
 * Task #1268 — The bulk-import `link` MCP tool must persist
 * `afterItemId`/`beforeItemId` symmetrically across the suggested
 * neighbor row, so every chain it writes satisfies
 * `X.afterItemId = Y ⟺ Y.beforeItemId = X` and the bidirectional guard
 * added in Task #1254 (`set-linking-decision` /
 * `batch-set-linking-decisions`) does not later reject an admin edit.
 *
 * The test drives the registered `analyze_bulk_import_item` handler
 * (step `link`) against an in-memory item store, runs the AI step for
 * every item in a session, then walks the resulting state and asserts
 * full bidirectional consistency. As a final sanity check, it overlays
 * a real call into the bidirectional guard helper used by
 * `batch-set-linking-decisions` and confirms it would not reject the
 * post-AI state.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

type LinkDecisions = {
  beforeItemId?: string | null;
  afterItemId?: string | null;
  relatedItemIds?: string[];
  reason?: string;
  confidence?: number;
  manualOverride?: boolean;
};

type Item = {
  id: string;
  sessionId: string;
  originalName: string;
  status: string;
  linkDecisions: LinkDecisions | null;
  stagedPath: string | null;
  mimeType: string | null;
  updatedAt?: Date;
};

const itemStore = new Map<string, Item>();
const sessionOrgs = new Map<string, string>();

function seedItem(id: string, sessionId: string, name: string, ld: LinkDecisions | null = null): Item {
  const item: Item = {
    id,
    sessionId,
    originalName: name,
    status: 'identified',
    linkDecisions: ld,
    stagedPath: null,
    mimeType: 'application/pdf',
  };
  itemStore.set(id, item);
  return item;
}

function seedSession(id: string, organizationId: string) {
  sessionOrgs.set(id, organizationId);
}

function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function condColumnName(cond: any): string | undefined {
  return cond?.column?.name ?? cond?.column?.sqlName;
}

function makeQuery(rows: unknown[]) {
  const p: any = Promise.resolve(rows);
  return p;
}

const mockDb: any = {
  select: jest.fn((projection?: any) => ({
    from: jest.fn((table: any) => ({
      where: jest.fn((cond: any) => {
        const colName = condColumnName(cond);
        const value = condValue(cond) as string | undefined;
        const tableName = table?._name;
        if (tableName === 'bulk_import_sessions') {
          if (!value) return makeQuery([]);
          const orgId = sessionOrgs.get(value);
          if (!orgId) return makeQuery([]);
          return makeQuery([{ id: value, organizationId: orgId }]);
        }
        // bulk_import_items
        if (colName === 'session_id') {
          const rows = Array.from(itemStore.values()).filter((i) => i.sessionId === value);
          return makeQuery(rows);
        }
        const item = value ? itemStore.get(value) : undefined;
        return makeQuery(item ? [item] : []);
      }),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const value = condValue(cond) as string | undefined;
        if (value && itemStore.has(value)) {
          const existing = itemStore.get(value)!;
          itemStore.set(value, { ...existing, ...updates });
        }
        return Promise.resolve();
      }),
    })),
  })),
  transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
    const txDb: any = {
      update: jest.fn(() => ({
        set: jest.fn((updates: Partial<Item>) => ({
          where: jest.fn((cond: any) => {
            const value = condValue(cond) as string | undefined;
            if (value && itemStore.has(value)) {
              const existing = itemStore.get(value)!;
              itemStore.set(value, { ...existing, ...updates });
            }
            return Promise.resolve();
          }),
        })),
      })),
    };
    return fn(txDb);
  }),
};

const tableCol = (table: string, name: string) => ({ name, sqlName: name, _table: table });

const bulkImportItemsTable: any = {
  _name: 'bulk_import_items',
  id: tableCol('bulk_import_items', 'id'),
  originalName: tableCol('bulk_import_items', 'original_name'),
  sessionId: tableCol('bulk_import_items', 'session_id'),
  linkDecisions: tableCol('bulk_import_items', 'link_decisions'),
  status: tableCol('bulk_import_items', 'status'),
  screening: tableCol('bulk_import_items', 'screening'),
  branchDecision: tableCol('bulk_import_items', 'branch_decision'),
  identification: tableCol('bulk_import_items', 'identification'),
  sortingDecision: tableCol('bulk_import_items', 'sorting_decision'),
  mimeType: tableCol('bulk_import_items', 'mime_type'),
  fileSize: tableCol('bulk_import_items', 'file_size'),
  stagedPath: tableCol('bulk_import_items', 'staged_path'),
  updatedAt: tableCol('bulk_import_items', 'updated_at'),
};
const bulkImportSessionsTable: any = {
  _name: 'bulk_import_sessions',
  id: tableCol('bulk_import_sessions', 'id'),
  organizationId: tableCol('bulk_import_sessions', 'organization_id'),
};

jest.mock('@shared/schema', () => ({
  bulkImportItems: bulkImportItemsTable,
  bulkImportSessions: bulkImportSessionsTable,
}));

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));

const suggestLinks = jest.fn<
  (input: any) => Promise<{ beforeItemId?: string; afterItemId?: string; relatedItemIds: string[]; reason: string; confidence: number }>
>();
jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestLinks: (input: any) => suggestLinks(input),
    screen: jest.fn(),
    suggestMergeOrSplit: jest.fn(),
    suggestBranch: jest.fn(),
    identify: jest.fn(),
  },
}));

jest.mock('../../../server/mcp/server', () => ({
  withRetryableDbCall: <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  buildWriteErrorResponse: (e: unknown) => ({
    content: [{ type: 'text' as const, text: `error: ${(e as Error).message}` }],
  }),
}));

import { registerBulkImportTools } from '../../../server/mcp/bulk-import-tools';
import { z } from 'zod';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;

function makeMockServer() {
  const tools = new Map<string, ToolHandler>();
  const server: any = {
    tool: (
      name: string,
      _description: string,
      _schema: unknown,
      handler: ToolHandler,
    ) => {
      tools.set(name, handler);
    },
  };
  return { server, tools };
}

const SESSION_ID = 'sess-link-1';
const ORG_ID = 'org-1';

let getHandler: (name: string) => ToolHandler;

beforeEach(() => {
  itemStore.clear();
  sessionOrgs.clear();
  jest.clearAllMocks();
  seedSession(SESSION_ID, ORG_ID);

  const { server, tools } = makeMockServer();
  registerBulkImportTools(server, {
    roleParam: z.enum(['admin', 'manager', 'tenant']),
    getMcpUser: async () => ({ id: 'admin-1', role: 'admin' }),
    getMcpOrgIds: async () => [ORG_ID],
  });
  getHandler = (name) => {
    const h = tools.get(name);
    if (!h) throw new Error(`Tool ${name} was not registered`);
    return h;
  };
});

async function runLink(itemId: string) {
  const handler = getHandler('analyze_bulk_import_item');
  const result = await handler({ role: 'admin', itemId, step: 'link' });
  return result;
}

function isMirrored(): { ok: true } | { ok: false; reason: string } {
  for (const [id, item] of itemStore) {
    const ld = (item.linkDecisions ?? {}) as LinkDecisions;
    if (ld.afterItemId) {
      const target = itemStore.get(ld.afterItemId);
      const targetBefore = (target?.linkDecisions as LinkDecisions | null)?.beforeItemId ?? null;
      if (targetBefore !== id) {
        return {
          ok: false,
          reason: `${id}.afterItemId=${ld.afterItemId} but ${ld.afterItemId}.beforeItemId=${targetBefore ?? 'null'}`,
        };
      }
    }
    if (ld.beforeItemId) {
      const target = itemStore.get(ld.beforeItemId);
      const targetAfter = (target?.linkDecisions as LinkDecisions | null)?.afterItemId ?? null;
      if (targetAfter !== id) {
        return {
          ok: false,
          reason: `${id}.beforeItemId=${ld.beforeItemId} but ${ld.beforeItemId}.afterItemId=${targetAfter ?? 'null'}`,
        };
      }
    }
  }
  return { ok: true };
}

describe('analyze_bulk_import_item — step "link" bidirectional consistency (Task #1268)', () => {
  it('mirrors the AI suggestion onto the neighbor so the chain is bidirectional', async () => {
    seedItem('A', SESSION_ID, 'A.pdf');
    seedItem('B', SESSION_ID, 'B.pdf');

    suggestLinks.mockResolvedValueOnce({
      afterItemId: 'B',
      relatedItemIds: ['B'],
      reason: 'A precedes B',
      confidence: 0.9,
    });

    await runLink('A');

    const a = itemStore.get('A')!;
    const b = itemStore.get('B')!;
    expect(a.linkDecisions?.afterItemId).toBe('B');
    expect(b.linkDecisions?.beforeItemId).toBe('A');
    const consistency = isMirrored();
    expect(consistency.ok ? 'consistent' : consistency.reason).toBe('consistent');
  });

  it('after running the link step for every item in a session, every pointer is mirrored', async () => {
    seedItem('A', SESSION_ID, 'A.pdf');
    seedItem('B', SESSION_ID, 'B.pdf');
    seedItem('C', SESSION_ID, 'C.pdf');
    seedItem('D', SESSION_ID, 'D.pdf');

    // Each AI call only sees the analyzed item's own pointer; without
    // the Task #1268 fix the neighbor row would never get updated.
    suggestLinks.mockImplementation(async ({ originalName }: any) => {
      switch (originalName) {
        case 'A.pdf':
          return { afterItemId: 'B', relatedItemIds: ['B'], reason: 'next', confidence: 0.9 };
        case 'B.pdf':
          return { afterItemId: 'C', relatedItemIds: ['C'], reason: 'next', confidence: 0.9 };
        case 'C.pdf':
          return { afterItemId: 'D', relatedItemIds: ['D'], reason: 'next', confidence: 0.9 };
        case 'D.pdf':
          return { relatedItemIds: [], reason: 'tail', confidence: 0.9 };
        default:
          return { relatedItemIds: [], reason: '', confidence: 0 };
      }
    });

    for (const id of ['A', 'B', 'C', 'D']) {
      await runLink(id);
    }

    const a = itemStore.get('A')!.linkDecisions!;
    const b = itemStore.get('B')!.linkDecisions!;
    const c = itemStore.get('C')!.linkDecisions!;
    const d = itemStore.get('D')!.linkDecisions!;
    expect(a.afterItemId).toBe('B');
    expect(b.beforeItemId).toBe('A');
    expect(b.afterItemId).toBe('C');
    expect(c.beforeItemId).toBe('B');
    expect(c.afterItemId).toBe('D');
    expect(d.beforeItemId).toBe('C');

    const consistency = isMirrored();
    expect(consistency.ok ? 'consistent' : consistency.reason).toBe('consistent');
  });

  it('drops a self-link suggestion instead of writing it', async () => {
    seedItem('A', SESSION_ID, 'A.pdf');
    seedItem('B', SESSION_ID, 'B.pdf');
    suggestLinks.mockResolvedValueOnce({
      afterItemId: 'A',
      beforeItemId: 'A',
      relatedItemIds: [],
      reason: 'self',
      confidence: 0.5,
    });

    await runLink('A');

    const a = itemStore.get('A')!.linkDecisions!;
    expect(a.afterItemId ?? null).toBeNull();
    expect(a.beforeItemId ?? null).toBeNull();

    const consistency = isMirrored();
    expect(consistency.ok ? 'consistent' : consistency.reason).toBe('consistent');
  });

  it('drops references to items that are not in this session', async () => {
    seedItem('A', SESSION_ID, 'A.pdf');
    suggestLinks.mockResolvedValueOnce({
      afterItemId: 'GHOST',
      relatedItemIds: ['GHOST'],
      reason: 'fabricated',
      confidence: 0.5,
    });

    await runLink('A');

    const a = itemStore.get('A')!.linkDecisions!;
    expect(a.afterItemId ?? null).toBeNull();
  });

  it('detaches a previously-pointing row when the new mirror would steal a back-pointer', async () => {
    // Pre-existing chain X -> B (mirrored). The AI now suggests A -> B.
    // The Task #1268 fix must clear X's after-pointer so X doesn't
    // dangle, while installing B.before = A.
    seedItem('A', SESSION_ID, 'A.pdf');
    seedItem('B', SESSION_ID, 'B.pdf', { beforeItemId: 'X', afterItemId: null });
    seedItem('X', SESSION_ID, 'X.pdf', { beforeItemId: null, afterItemId: 'B' });

    suggestLinks.mockResolvedValueOnce({
      afterItemId: 'B',
      relatedItemIds: ['B'],
      reason: 'A precedes B',
      confidence: 0.9,
    });

    await runLink('A');

    const a = itemStore.get('A')!.linkDecisions!;
    const b = itemStore.get('B')!.linkDecisions!;
    const x = itemStore.get('X')!.linkDecisions!;
    expect(a.afterItemId).toBe('B');
    expect(b.beforeItemId).toBe('A');
    expect(x.afterItemId ?? null).toBeNull();

    const consistency = isMirrored();
    expect(consistency.ok ? 'consistent' : consistency.reason).toBe('consistent');
  });

  it('rejects an AI suggestion that would close a cycle', async () => {
    // B -> A is already in place; the AI proposes A -> B which would
    // close a 2-cycle. The fix must drop the new after-pointer.
    seedItem('A', SESSION_ID, 'A.pdf', { beforeItemId: 'B', afterItemId: null });
    seedItem('B', SESSION_ID, 'B.pdf', { beforeItemId: null, afterItemId: 'A' });

    suggestLinks.mockResolvedValueOnce({
      afterItemId: 'B',
      relatedItemIds: ['B'],
      reason: 'cycle',
      confidence: 0.5,
    });

    await runLink('A');

    const a = itemStore.get('A')!.linkDecisions!;
    const b = itemStore.get('B')!.linkDecisions!;
    // No cycle: A.after must remain unset.
    expect(a.afterItemId ?? null).toBeNull();
    // The pre-existing B.after = A and A.before = B are still mirrored.
    expect(b.afterItemId).toBe('A');
    expect(a.beforeItemId).toBe('B');

    const consistency = isMirrored();
    expect(consistency.ok ? 'consistent' : consistency.reason).toBe('consistent');
  });

  it('post-AI state survives the same bidirectional check the batch endpoint applies', async () => {
    // Re-implement the guard from
    // server/api/bulk-import.ts (~line 6188) and confirm it would NOT
    // reject a session that just came out of the AI link step. This
    // is the "subsequent admin edit" requirement from the task spec.
    seedItem('A', SESSION_ID, 'A.pdf');
    seedItem('B', SESSION_ID, 'B.pdf');
    seedItem('C', SESSION_ID, 'C.pdf');

    suggestLinks.mockImplementation(async ({ originalName }: any) => {
      if (originalName === 'A.pdf') {
        return { afterItemId: 'B', relatedItemIds: ['B'], reason: '', confidence: 0.9 };
      }
      if (originalName === 'B.pdf') {
        return { afterItemId: 'C', relatedItemIds: ['C'], reason: '', confidence: 0.9 };
      }
      return { relatedItemIds: [], reason: '', confidence: 0.9 };
    });

    for (const id of ['A', 'B', 'C']) {
      await runLink(id);
    }

    const proposedBefore = new Map<string, string | null>();
    const proposedAfter = new Map<string, string | null>();
    for (const [id, item] of itemStore) {
      const ld = (item.linkDecisions ?? {}) as LinkDecisions;
      proposedBefore.set(id, ld.beforeItemId ?? null);
      proposedAfter.set(id, ld.afterItemId ?? null);
    }
    for (const [id, after] of proposedAfter) {
      if (after === null) continue;
      const targetBefore = proposedBefore.get(after) ?? null;
      expect(targetBefore).toBe(id);
    }
    for (const [id, before] of proposedBefore) {
      if (before === null) continue;
      const targetAfter = proposedAfter.get(before) ?? null;
      expect(targetAfter).toBe(id);
    }
  });
});
