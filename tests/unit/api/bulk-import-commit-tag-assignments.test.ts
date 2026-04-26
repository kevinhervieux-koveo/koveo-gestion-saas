/**
 * Task #1104 — Server-side coverage for the document-tag-assignment write
 * added to the bulk-import commit handler by Task #1103.
 *
 * Endpoint under test:
 *   POST /api/admin/bulk-import/items/:id/commit
 *
 * The relevant slice of the handler reads the staged
 * `identification.tags` array and, for every entry that:
 *   1. is a non-empty string, AND
 *   2. exists as a real `document_tags.id`,
 * inserts a `document_tag_assignments` row pairing the new
 * `documents.id` with the tag id (idempotent via
 * `.onConflictDoNothing()`).
 *
 * Free-form AI suggestion strings (the values the analyzer writes
 * before an admin curates the list through the picker) won't match
 * `document_tags.id`, so the inArray filter drops them and they are
 * silently skipped — no row is written and no error is raised.
 *
 * The cases below pin both sides of that contract:
 *   - happy path: only the curated UUID(s) reach the assignments insert;
 *   - silently-skip path: an `identification.tags` array containing
 *     ONLY non-UUID AI strings results in no documentTagAssignments
 *     write at all (and the commit still succeeds);
 *   - mixed path: when both kinds of strings are present the write
 *     happens but only contains the valid UUIDs;
 *   - empty path: an empty / missing tags array short-circuits before
 *     the documentTags lookup so the commit never even queries the
 *     tag table.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ---------------------------------------------------------------------------
// Fixtures and in-memory stores
// ---------------------------------------------------------------------------

type Item = Record<string, unknown> & {
  id: string;
  sessionId: string;
  identification: Record<string, unknown> | null;
};
type Session = Record<string, unknown> & {
  id: string;
  buildingId: string | null;
  organizationId: string;
};
type Building = { id: string; financialYearStart: string | null };
type DocTag = { id: string };

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();
const buildingStore = new Map<string, Building>();
const tagStore = new Map<string, DocTag>();

interface InsertedDocument {
  id: string;
  values: Record<string, unknown>;
}
const insertedDocuments: InsertedDocument[] = [];

interface InsertedFingerprint {
  values: Record<string, unknown>;
}
const insertedFingerprints: InsertedFingerprint[] = [];

interface InsertedAssignment {
  values: Array<{ documentId: string; tagId: string }>;
}
const insertedAssignments: InsertedAssignment[] = [];

interface UpdatedItem {
  id: string;
  set: Record<string, unknown>;
}
const updatedItems: UpdatedItem[] = [];

let documentIdCounter = 0;

const VALID_TAG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_TAG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STALE_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; // valid shape, not in tagStore

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const base: Session = {
    id,
    buildingId: 'building-1',
    organizationId: 'org-1',
    ...overrides,
  };
  sessionStore.set(id, base);
  return base;
}

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id,
    sessionId: 'sess-1',
    originalName: `${id}.pdf`,
    contentHash: `hash-${id}`,
    mimeType: 'application/pdf',
    fileSize: 1234,
    stagedPath: `/staging/${id}.pdf`,
    status: 'identified',
    identification: null,
    branchDecision: { branch: 'building_documents' },
    sortingDecision: {},
    finalFileName: null,
    screening: {},
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

function seedBuilding(id: string, financialYearStart: string | null = null) {
  buildingStore.set(id, { id, financialYearStart });
}

function seedTag(id: string) {
  tagStore.set(id, { id });
}

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

function tableName(table: any): string {
  // The pgTable mock spreads the schema columns into the table object,
  // so `table.name` ends up shadowed by the `name` column when there is
  // one (e.g. document_tags). `_._.name` always carries the underlying
  // SQL table name regardless of the columns the table has.
  return table?._?.name ?? (typeof table?.name === 'string' ? table.name : '');
}

function condEqValue(cond: any): unknown {
  if (!cond) return undefined;
  if (cond.type === 'condition' && cond.operator === 'eq') return cond.value;
  if ('value' in (cond ?? {})) return cond.value;
  return undefined;
}

function extractInArrayValues(cond: any): string[] | null {
  if (!cond) return null;
  if (cond.type === 'condition' && cond.operator === 'in') {
    return Array.isArray(cond.values) ? cond.values : [];
  }
  if (cond.type === 'and' && Array.isArray(cond.conditions)) {
    for (const child of cond.conditions) {
      const found = extractInArrayValues(child);
      if (found !== null) return found;
    }
  }
  return null;
}

function makeReturningThenable(rows: any[]) {
  const p: any = Promise.resolve(rows);
  p.returning = () => Promise.resolve(rows);
  return p;
}

function makeOnConflictThenable(rows: any[]) {
  const p: any = Promise.resolve(rows);
  p.onConflictDoNothing = () => Promise.resolve(rows);
  p.returning = () => Promise.resolve(rows);
  return p;
}

const mockDb: any = {
  select: jest.fn((_cols?: any) => ({
    from: jest.fn((table: any) => {
      const name = tableName(table);
      return {
        where: jest.fn((cond: any) => {
          if (name === 'bulk_import_sessions') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? sessionStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          if (name === 'bulk_import_items') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? itemStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          if (name === 'buildings') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? buildingStore.get(id) : undefined;
            return Promise.resolve(
              row ? [{ financialYearStart: row.financialYearStart }] : [],
            );
          }
          if (name === 'document_tags') {
            const ids = extractInArrayValues(cond) ?? [];
            const rows = ids
              .filter((id) => tagStore.has(id))
              .map((id) => ({ id }));
            return Promise.resolve(rows);
          }
          return Promise.resolve([]);
        }),
      };
    }),
  })),

  insert: jest.fn((table: any) => {
    const name = tableName(table);
    return {
      values: jest.fn((values: any) => {
        if (name === 'documents') {
          documentIdCounter += 1;
          const id = `doc-${documentIdCounter}`;
          insertedDocuments.push({ id, values });
          return makeReturningThenable([{ id, ...values }]);
        }
        if (name === 'client_document_fingerprints') {
          insertedFingerprints.push({ values });
          return makeOnConflictThenable([]);
        }
        if (name === 'document_tag_assignments') {
          insertedAssignments.push({ values });
          return makeOnConflictThenable([]);
        }
        return makeOnConflictThenable([]);
      }),
    };
  }),

  update: jest.fn((table: any) => {
    const name = tableName(table);
    return {
      set: jest.fn((updates: Record<string, unknown>) => ({
        where: jest.fn((cond: any) => {
          if (name === 'bulk_import_items') {
            const id = condEqValue(cond) as string | undefined;
            if (id && itemStore.has(id)) {
              updatedItems.push({ id, set: updates });
              const merged = { ...itemStore.get(id)!, ...updates } as Item;
              itemStore.set(id, merged);
              return makeReturningThenable([merged]);
            }
          }
          return makeReturningThenable([]);
        }),
      })),
    };
  }),
};

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
    buildHierarchicalPath: (
      _ctx: { type: string; buildingId: string },
      name: string,
    ) => `/documents/building/${name}`,
  },
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
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
  itemStore.clear();
  sessionStore.clear();
  buildingStore.clear();
  tagStore.clear();
  insertedDocuments.length = 0;
  insertedFingerprints.length = 0;
  insertedAssignments.length = 0;
  updatedItems.length = 0;
  documentIdCounter = 0;
  jest.clearAllMocks();

  // Default: a building exists for the session, two real tags exist in
  // the system. Per-test calls to `seedItem` decide what tags land on
  // the item's identification.tags array.
  seedSession('sess-1');
  seedBuilding('building-1');
  seedTag(VALID_TAG_A);
  seedTag(VALID_TAG_B);
});

describe('POST /api/admin/bulk-import/items/:id/commit — tag assignments (Task #1104)', () => {
  it('writes a documentTagAssignments row for every valid tag UUID and links them to the new document', async () => {
    seedItem('it-happy', {
      identification: {
        name: 'Lease 101',
        description: 'unit 101 lease',
        tags: [VALID_TAG_A, VALID_TAG_B],
      },
    });

    const res = await request(buildApp())
      .post(URL('it-happy'))
      .send({})
      .expect(200);

    // Sanity: the commit produced a document.
    expect(insertedDocuments).toHaveLength(1);
    const docId = insertedDocuments[0].id;
    expect(res.body.document.id).toBe(docId);

    // The assignment write happened exactly once with one row per
    // valid tag, all pointing at the freshly inserted document.
    expect(insertedAssignments).toHaveLength(1);
    const assignmentValues = insertedAssignments[0].values;
    expect(assignmentValues).toHaveLength(2);
    const tagIdsWritten = assignmentValues.map((v) => v.tagId).sort();
    expect(tagIdsWritten).toEqual([VALID_TAG_A, VALID_TAG_B].sort());
    for (const v of assignmentValues) {
      expect(v.documentId).toBe(docId);
    }
  });

  it('silently skips non-UUID AI strings — no documentTagAssignments insert when no entry matches a real tag', async () => {
    seedItem('it-ai-only', {
      identification: {
        name: 'AI doc',
        // These are exactly the kind of free-form labels the AI emits
        // before an admin curates the picker. None match a real
        // document_tags.id, so the lookup returns no rows and the
        // handler must short-circuit the assignment insert.
        tags: ['recyclage', 'stationnement', 'animaux'],
      },
    });

    const res = await request(buildApp())
      .post(URL('it-ai-only'))
      .send({})
      .expect(200);

    expect(insertedDocuments).toHaveLength(1);
    expect(res.body.document.id).toBe(insertedDocuments[0].id);

    // The whole point of the silent-skip path: NO row is written.
    expect(insertedAssignments).toHaveLength(0);
    // The commit nevertheless succeeded and finalised the item.
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].set.status).toBe('committed');
  });

  it('mixed list: keeps valid UUIDs and drops AI strings + stale UUIDs from the assignments insert', async () => {
    seedItem('it-mixed', {
      identification: {
        name: 'Mixed doc',
        tags: [
          VALID_TAG_A, // real, kept
          'recyclage', // AI free-form, dropped
          STALE_UUID, // looks like a UUID but no longer in document_tags
          VALID_TAG_B, // real, kept
        ],
      },
    });

    await request(buildApp()).post(URL('it-mixed')).send({}).expect(200);

    expect(insertedDocuments).toHaveLength(1);
    const docId = insertedDocuments[0].id;
    expect(insertedAssignments).toHaveLength(1);
    const writtenTagIds = insertedAssignments[0].values
      .map((v) => v.tagId)
      .sort();
    expect(writtenTagIds).toEqual([VALID_TAG_A, VALID_TAG_B].sort());
    // No row for the AI string or the stale UUID escaped through.
    expect(writtenTagIds).not.toContain('recyclage');
    expect(writtenTagIds).not.toContain(STALE_UUID);
    for (const v of insertedAssignments[0].values) {
      expect(v.documentId).toBe(docId);
    }
  });

  it('skips the documentTags lookup entirely when identification.tags is missing or empty', async () => {
    seedItem('it-empty', {
      identification: { name: 'Plain doc' }, // no tags key at all
    });

    await request(buildApp()).post(URL('it-empty')).send({}).expect(200);

    expect(insertedDocuments).toHaveLength(1);
    expect(insertedAssignments).toHaveLength(0);

    // Same expectation when tags is explicitly an empty array — the
    // handler must still short-circuit.
    insertedDocuments.length = 0;
    insertedAssignments.length = 0;
    seedItem('it-empty-arr', {
      identification: { name: 'Plain doc', tags: [] },
    });

    await request(buildApp()).post(URL('it-empty-arr')).send({}).expect(200);
    expect(insertedDocuments).toHaveLength(1);
    expect(insertedAssignments).toHaveLength(0);
  });
});
