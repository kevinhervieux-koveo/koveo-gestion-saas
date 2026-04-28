/**
 * Task #1549 — Unit tests for first-anchor commit path in
 * POST /api/admin/bulk-import/items/:id/commit
 *
 * When an item's `bulkImportItemFamilyMemberships` row has
 * `neighborDocumentId = null`, the item is designated as the first
 * anchor for the family. The commit handler must:
 *
 *   1. Acquire a PostgreSQL advisory lock keyed on
 *      hashtext(familyId:buildingId:residenceId) to serialize concurrent
 *      first-anchor commits for the same scope.
 *   2. Check for existing `documentLinks` rows in the same
 *      building+residenceId scope (scope-aware, not family-global).
 *   3. Check for other committed first-anchor items in the same scope.
 *   4. If any conflict is found → 409 with errorCode 'first_anchor_conflict'.
 *   5. If no conflict → proceed to commit; release the advisory lock after
 *      the status-'committed' write.
 *
 * Note: First-anchor items do NOT produce a `documentLinks` row
 * (they have no neighbor). They exist in `bulkImportItemFamilyMemberships`
 * with `neighborDocumentId = null` and appear in `link-candidates` for
 * future items to use as a neighbor target.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => {
  const makeOp =
    (type: string) =>
    (...args: unknown[]) => ({ type, args });
  const sql = jest.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({
    sql: Array.isArray(strings) ? strings.join('?') : String(strings),
    params: vals,
  }));
  return {
    sql,
    eq: jest.fn((col: unknown, val: unknown) => ({ type: 'eq', column: col, value: val })),
    ne: jest.fn((col: unknown, val: unknown) => ({ type: 'ne', column: col, value: val })),
    and: jest.fn((...conds: unknown[]) => ({ type: 'and', conditions: conds })),
    or: jest.fn((...conds: unknown[]) => ({ type: 'or', conditions: conds })),
    isNull: jest.fn((col: unknown) => ({ type: 'isNull', column: col })),
    isNotNull: jest.fn((col: unknown) => ({ type: 'isNotNull', column: col })),
    inArray: makeOp('inArray'),
    notInArray: makeOp('notInArray'),
    desc: makeOp('desc'),
    asc: makeOp('asc'),
    gt: makeOp('gt'),
    gte: makeOp('gte'),
    lt: makeOp('lt'),
    lte: makeOp('lte'),
    like: makeOp('like'),
    ilike: makeOp('ilike'),
    not: makeOp('not'),
    exists: makeOp('exists'),
    between: makeOp('between'),
    count: makeOp('count'),
    sum: makeOp('sum'),
    avg: makeOp('avg'),
    max: makeOp('max'),
    min: makeOp('min'),
    relations: jest.fn(() => ({})),
  };
});
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// Scenario control — set these before each test to control mock behaviour
// ---------------------------------------------------------------------------

/**
 * When truthy, the conflict-check-1 query (documentLinks ⋈ documents) will
 * return a non-empty result, simulating an existing linked document in scope.
 */
let simulateLinksConflict = false;

/**
 * When truthy, the conflict-check-2 query (bulkImportItems ⋈ memberships ⋈ documents)
 * will return a non-empty result, simulating an existing committed first-anchor item.
 */
let simulateFirstAnchorConflict = false;

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

type Item = Record<string, unknown> & {
  id: string;
  sessionId: string;
  status: string;
};

type Session = Record<string, unknown> & {
  id: string;
  buildingId: string;
  organizationId: string;
};

type Membership = {
  itemId: string;
  familyId: string | null;
  neighborDocumentId: string | null;
  position: string | null;
};

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();
const membershipsByItemId = new Map<string, Membership[]>();

const updatedItems: Array<{ id: string; set: Record<string, unknown> }> = [];
const advisoryLockCalls: string[] = [];
const advisoryUnlockCalls: string[] = [];
let documentIdCounter = 0;

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const s: Session = { id, buildingId: 'bldg-1', organizationId: 'org-1', ...overrides };
  sessionStore.set(id, s);
  return s;
}

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-fa-1',
    status: 'linked',
    finalDocumentId: null,
    branchDecision: { branch: 'building_documents' },
    linkDecisions: null,
    identification: { name: `Doc ${id}`, description: null, tags: [] },
    originalName: `${id}.pdf`,
    contentHash: `hash-${id}`,
    mimeType: 'application/pdf',
    fileSize: 1234,
    stagedPath: `/staging/${id}.pdf`,
    sortingDecision: {},
    finalFileName: null,
    screening: {},
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

function addMembership(m: Membership): void {
  const list = membershipsByItemId.get(m.itemId) ?? [];
  list.push(m);
  membershipsByItemId.set(m.itemId, list);
}

// ---------------------------------------------------------------------------
// Call-sequence tracker so different select() calls return different things
// ---------------------------------------------------------------------------

/** Returns the table name from a drizzle table mock object. */
function tname(t: any): string {
  return t?._?.name ?? (typeof t?.name === 'string' ? t.name : '');
}

/** Returns the eq value from a drizzle condition mock. */
function eqValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockDb: any = {
  execute: jest.fn((sqlTemplate: any) => {
    const raw: string = sqlTemplate?.sql
      ? JSON.stringify(sqlTemplate)
      : sqlTemplate?.strings?.join?.('') ?? JSON.stringify(sqlTemplate);

    if (raw.includes('pg_advisory_unlock')) {
      advisoryUnlockCalls.push('unlock');
      return Promise.resolve({ rows: [] });
    }
    if (raw.includes('pg_advisory_lock')) {
      advisoryLockCalls.push('lock');
      return Promise.resolve({ rows: [] });
    }
    if (raw.includes('hashtext')) {
      return Promise.resolve({ rows: [{ lock_key: 42 }] });
    }
    return Promise.resolve({ rows: [] });
  }),

  select: jest.fn((_cols?: any) => {
    // Each call to select() creates a fresh stateful chain.
    let fromTable = '';
    let joinedTables: string[] = [];

    const chain: any = {
      from: (table: any) => {
        fromTable = tname(table);
        joinedTables = [fromTable];
        return chain;
      },
      innerJoin: (joinTable: any) => {
        joinedTables.push(tname(joinTable));
        return chain;
      },
      where: (cond: any) => {
        // ----------------------------------------------------------------
        // Item lookup: bulk_import_items (no join)
        // ----------------------------------------------------------------
        if (fromTable === 'bulk_import_items' && joinedTables.length === 1) {
          const id = eqValue(cond) as string | undefined;
          const row = id ? itemStore.get(id) : undefined;
          return asPromiseWithLimit(row ? [row] : []);
        }

        // ----------------------------------------------------------------
        // Session lookup: bulk_import_sessions
        // ----------------------------------------------------------------
        if (fromTable === 'bulk_import_sessions') {
          const id = eqValue(cond) as string | undefined;
          const row = id ? sessionStore.get(id) : undefined;
          return asPromiseWithLimit(row ? [row] : []);
        }

        // ----------------------------------------------------------------
        // Building fiscal year: buildings
        // ----------------------------------------------------------------
        if (fromTable === 'buildings') {
          return asPromiseWithLimit([{ financialYearStart: null }]);
        }

        // ----------------------------------------------------------------
        // Membership lookup: bulk_import_item_family_memberships (no join)
        // ----------------------------------------------------------------
        if (fromTable === 'bulk_import_item_family_memberships' && joinedTables.length === 1) {
          const id = eqValue(cond) as string | undefined;
          const rows = id ? (membershipsByItemId.get(id) ?? []) : [];
          return asPromiseWithLimit(rows);
        }

        // ----------------------------------------------------------------
        // Conflict check #1: document_links ⋈ documents
        // Returns a conflict row if simulateLinksConflict is set.
        // ----------------------------------------------------------------
        if (fromTable === 'document_links' && joinedTables.includes('documents')) {
          const conflict = simulateLinksConflict ? [{ id: 'conflict-link-1' }] : [];
          return asPromiseWithLimit(conflict);
        }

        // ----------------------------------------------------------------
        // Conflict check #2: bulk_import_items ⋈ memberships ⋈ documents
        // Returns a conflict row if simulateFirstAnchorConflict is set.
        // ----------------------------------------------------------------
        if (
          fromTable === 'bulk_import_items' &&
          joinedTables.includes('bulk_import_item_family_memberships') &&
          joinedTables.includes('documents')
        ) {
          const conflict = simulateFirstAnchorConflict ? [{ id: 'conflict-item-1' }] : [];
          return asPromiseWithLimit(conflict);
        }

        // ----------------------------------------------------------------
        // Fallback: return empty
        // ----------------------------------------------------------------
        return asPromiseWithLimit([]);
      },
    };
    return chain;
  }),

  insert: jest.fn((table: any) => {
    const tn = tname(table);
    return {
      values: (_values: any) => {
        if (tn === 'documents') {
          documentIdCounter += 1;
          const id = `doc-${documentIdCounter}`;
          const row = { id, buildingId: 'bldg-1', residenceId: null };
          const p: any = Promise.resolve([row]);
          p.returning = () => Promise.resolve([row]);
          return p;
        }
        const p: any = Promise.resolve([]);
        p.returning = () => Promise.resolve([]);
        p.onConflictDoNothing = (_opts?: any) => {
          const q: any = Promise.resolve([]);
          q.returning = () => Promise.resolve([]);
          return q;
        };
        return p;
      },
    };
  }),

  update: jest.fn((_table: any) => ({
    set: (updates: Record<string, unknown>) => ({
      where: (cond: any) => {
        const id = eqValue(cond) as string | undefined;
        if (!id || !itemStore.has(id)) {
          const p: any = Promise.resolve([]);
          p.returning = () => Promise.resolve([]);
          return p;
        }
        const merged = { ...itemStore.get(id)!, ...updates } as Item;
        itemStore.set(id, merged);
        updatedItems.push({ id, set: updates });
        const p: any = Promise.resolve([merged]);
        p.returning = () => Promise.resolve([merged]);
        return p;
      },
    }),
  })),

  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve()),
  })),
};

/** Returns a Promise that also exposes a `.limit(n)` chainable method. */
function asPromiseWithLimit(rows: unknown[]): any {
  const p = Promise.resolve(rows) as any;
  p.limit = (_n: number) => Promise.resolve(rows.slice(0, _n));
  return p;
}

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../server/services/bulk-import-analyzer', () => ({
  bulkImportAnalyzer: {
    suggestBranch: jest.fn(),
    screen: jest.fn(),
    suggestMergeOrSplit: jest.fn(),
    identify: jest.fn(),
    suggestLinks: jest.fn(),
  },
  isBulkImportAiAvailable: () => true,
  BRANCH_SUB_CATEGORIES: {
    building_documents: ['other'],
    residence_documents: ['lease', 'other'],
    bill: ['other'],
    demand: ['other'],
    maintenance: ['other'],
    other: ['other'],
  },
}));

jest.mock('../../../server/services/bulk-import-rotation', () => ({
  rotateAndRewriteStagedFile: jest.fn(),
}));

jest.mock('../../../server/services/period-hint-parser', () => ({
  parsePeriodHint: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../server/services/document-service', () => ({
  documentService: {
    normalizePath: (p: string) => p,
    buildHierarchicalPath: (_ctx: unknown, name: string) => `/documents/building/${name}`,
  },
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

jest.mock('../../../server/services/document-link-service', () => ({
  upsertDocumentLink: jest.fn().mockResolvedValue(undefined),
  DocumentLinkValidationError: class DocumentLinkValidationError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock('../../../server/services/kpi', () => ({
  recordKpiEvent: jest.fn().mockResolvedValue(undefined),
  classifyFilenameSuggestionOutcome: jest.fn().mockReturnValue('ai_accepted'),
  classifyAiAcceptOutcome: jest.fn().mockReturnValue('ai_accepted'),
  classifyTagSuggestionOutcome: jest.fn().mockReturnValue('ai_accepted'),
}));

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const URL = (id: string) => `/api/admin/bulk-import/items/${id}/commit`;

beforeEach(() => {
  // Reset in-memory state
  itemStore.clear();
  sessionStore.clear();
  membershipsByItemId.clear();
  updatedItems.length = 0;
  advisoryLockCalls.length = 0;
  advisoryUnlockCalls.length = 0;
  documentIdCounter = 0;

  // Reset scenario flags
  simulateLinksConflict = false;
  simulateFirstAnchorConflict = false;

  // Reset mock call records without clearing implementations
  mockDb.execute.mockClear();
  mockDb.select.mockClear();
  mockDb.insert.mockClear();
  mockDb.update.mockClear();
  mockDb.delete.mockClear();

  seedSession('sess-fa-1');
});

describe('POST /commit — first-anchor serialization (Task #1549)', () => {
  it('acquires and releases advisory lock when no conflict exists in scope', async () => {
    seedItem('item-fa-1');
    addMembership({ itemId: 'item-fa-1', familyId: 'fam-a', neighborDocumentId: null, position: null });

    const res = await request(buildApp())
      .post(URL('item-fa-1'))
      .send({})
      .expect(200);

    expect(res.body.item).toBeDefined();
    // Advisory lock must be acquired then released for first-anchor items
    expect(advisoryLockCalls).toHaveLength(1);
    expect(advisoryUnlockCalls).toHaveLength(1);
    // Item status must be committed
    const lastUpdate = updatedItems[updatedItems.length - 1];
    expect(lastUpdate?.set?.status).toBe('committed');
  });

  it('returns 409 first_anchor_conflict when documentLinks conflict exists in scope', async () => {
    seedItem('item-fa-links-conflict');
    addMembership({
      itemId: 'item-fa-links-conflict',
      familyId: 'fam-conflict',
      neighborDocumentId: null,
      position: null,
    });

    // Tell the mock to simulate an existing documentLinks row in the same scope
    simulateLinksConflict = true;

    const res = await request(buildApp())
      .post(URL('item-fa-links-conflict'))
      .send({})
      .expect(409);

    expect(res.body.errorCode).toBe('first_anchor_conflict');
    // Lock must be acquired then released even when 409 is returned
    expect(advisoryLockCalls).toHaveLength(1);
    expect(advisoryUnlockCalls).toHaveLength(1);
    // Item must NOT be updated to 'committed'
    const committedUpdates = updatedItems.filter((u) => u.set?.status === 'committed');
    expect(committedUpdates).toHaveLength(0);
  });

  it('returns 409 first_anchor_conflict when another committed first-anchor item exists in scope', async () => {
    seedItem('item-fa-member-conflict');
    addMembership({
      itemId: 'item-fa-member-conflict',
      familyId: 'fam-already-anchored',
      neighborDocumentId: null,
      position: null,
    });

    // Tell the mock to simulate an existing committed first-anchor item (check #2)
    simulateFirstAnchorConflict = true;

    const res = await request(buildApp())
      .post(URL('item-fa-member-conflict'))
      .send({})
      .expect(409);

    expect(res.body.errorCode).toBe('first_anchor_conflict');
    expect(advisoryUnlockCalls).toHaveLength(1);
    const committedUpdates = updatedItems.filter((u) => u.set?.status === 'committed');
    expect(committedUpdates).toHaveLength(0);
  });

  it('succeeds when conflict is in a different scope (no simulateLinksConflict for this scope)', async () => {
    // Use a different building by overriding the session
    sessionStore.set('sess-fa-1', {
      id: 'sess-fa-1',
      buildingId: 'bldg-2',
      organizationId: 'org-1',
    });
    seedItem('item-fa-diff-scope');
    addMembership({
      itemId: 'item-fa-diff-scope',
      familyId: 'fam-shared',
      neighborDocumentId: null,
      position: null,
    });

    // No conflict flags set — the mock returns empty for all conflict queries
    const res = await request(buildApp())
      .post(URL('item-fa-diff-scope'))
      .send({})
      .expect(200);

    expect(res.body.item).toBeDefined();
    const lastUpdate = updatedItems[updatedItems.length - 1];
    expect(lastUpdate?.set?.status).toBe('committed');
  });

  it('does not acquire advisory lock for regular (neighbor-linked) items', async () => {
    seedItem('item-regular');
    // A regular membership has a non-null neighborDocumentId
    addMembership({
      itemId: 'item-regular',
      familyId: 'fam-b',
      neighborDocumentId: 'some-neighbor-doc',
      position: 'before',
    });

    await request(buildApp())
      .post(URL('item-regular'))
      .send({})
      .expect(200);

    // No advisory lock should be acquired for regular (non-first-anchor) items
    expect(advisoryLockCalls).toHaveLength(0);
    expect(advisoryUnlockCalls).toHaveLength(0);
  });
});
