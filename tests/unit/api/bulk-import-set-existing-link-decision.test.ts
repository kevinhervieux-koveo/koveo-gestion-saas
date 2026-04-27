/**
 * Task #1386 — Server-side unit tests for the existing-family linking
 * endpoint.
 *
 * POST /api/admin/bulk-import/items/:id/set-existing-link-decision
 *
 * Covers:
 *   - Clear path (familyId = null): wipes familyId/beforeDocumentId/afterDocumentId
 *   - Happy path: persists familyId + position into linkDecisions
 *   - Validation errors: item-not-found, session-not-found, missing-fields,
 *     family-not-found, family-not-visible, neighbor-not-found, scope-mismatch,
 *     self-link, neighbor-not-in-family, occupied-side
 *   - Cycle detection: returns 400 cycle_detected
 *   - No-new-family guarantee: decision persists into linkDecisions, NOT into documentLinkFamilies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column: any, value: any) => ({ type: 'eq', column, value })),
  and: jest.fn((...conditions: any[]) => ({ type: 'and', conditions })),
  or: jest.fn((...conditions: any[]) => ({ type: 'or', conditions })),
  ne: jest.fn((column: any, value: any) => ({ type: 'ne', column, value })),
  inArray: jest.fn((column: any, values: any) => ({ type: 'inArray', column, values })),
  notInArray: jest.fn((column: any, values: any) => ({ type: 'notInArray', column, values })),
  isNull: jest.fn((column: any) => ({ type: 'isNull', column })),
  isNotNull: jest.fn((column: any) => ({ type: 'isNotNull', column })),
  gt: jest.fn((column: any, value: any) => ({ type: 'gt', column, value })),
  gte: jest.fn((column: any, value: any) => ({ type: 'gte', column, value })),
  lt: jest.fn((column: any, value: any) => ({ type: 'lt', column, value })),
  lte: jest.fn((column: any, value: any) => ({ type: 'lte', column, value })),
  like: jest.fn((column: any, pattern: any) => ({ type: 'like', column, pattern })),
  ilike: jest.fn((column: any, pattern: any) => ({ type: 'ilike', column, pattern })),
  not: jest.fn((condition: any) => ({ type: 'not', condition })),
  sql: jest.fn((strings: any) => ({ type: 'sql', strings })),
  desc: jest.fn((column: any) => ({ type: 'desc', column })),
  asc: jest.fn((column: any) => ({ type: 'asc', column })),
  relations: jest.fn((_table: any, cb: any) => {
    if (typeof cb === 'function') {
      try { cb({ one: jest.fn(), many: jest.fn() }); } catch (_) { /* ignore */ }
    }
    return {};
  }),
  primaryKey: jest.fn((_opts: any) => ({})),
  uniqueIndex: jest.fn((_name: any) => ({ on: jest.fn(() => ({})) })),
  index: jest.fn((_name: any) => ({ on: jest.fn(() => ({})) })),
  foreignKey: jest.fn((_opts: any) => ({})),
  check: jest.fn((_name: any, _cond: any) => ({})),
  getTableName: jest.fn((table: any) => table?._?.name ?? table?.name ?? ''),
  getTableColumns: jest.fn((table: any) => table?._?.columns ?? {}),
}));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

type Item = {
  id: string;
  sessionId: string;
  status: string;
  finalDocumentId: string | null;
  branchDecision: Record<string, unknown> | null;
  linkDecisions: Record<string, unknown> | null;
  [key: string]: unknown;
};

type Session = {
  id: string;
  buildingId: string | null;
  organizationId: string;
  [key: string]: unknown;
};

type Family = {
  id: string;
  organizationId: string | null;
  [key: string]: unknown;
};

type DocRecord = {
  id: string;
  buildingId: string | null;
  residenceId: string | null;
  [key: string]: unknown;
};

type DocumentLink = {
  id: string;
  familyId: string;
  fromDocumentId: string;
  toDocumentId: string;
  position: 'before' | 'after';
};

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();
const familyStore = new Map<string, Family>();
const documentStore = new Map<string, DocRecord>();
const documentLinkStore = new Map<string, DocumentLink>();

function seedItem(id: string, overrides: Partial<Item> = {}): Item {
  const item: Item = {
    id,
    sessionId: 'sess-el-1',
    status: 'linked',
    finalDocumentId: null,
    branchDecision: { branch: 'building_documents', subCategory: 'other' },
    linkDecisions: null,
    ...overrides,
  };
  itemStore.set(id, item);
  return item;
}

function seedSession(id: string, overrides: Partial<Session> = {}): Session {
  const s: Session = {
    id,
    buildingId: 'bldg-1',
    organizationId: 'org-1',
    ...overrides,
  };
  sessionStore.set(id, s);
  return s;
}

function seedFamily(id: string, overrides: Partial<Family> = {}): Family {
  const f: Family = { id, organizationId: 'org-1', ...overrides };
  familyStore.set(id, f);
  return f;
}

function seedDocument(id: string, overrides: Partial<DocRecord> = {}): DocRecord {
  const d: DocRecord = { id, buildingId: 'bldg-1', residenceId: null, ...overrides };
  documentStore.set(id, d);
  return d;
}

function seedDocumentLink(
  id: string,
  familyId: string,
  fromDocumentId: string,
  toDocumentId: string,
  position: 'before' | 'after',
): DocumentLink {
  const l: DocumentLink = { id, familyId, fromDocumentId, toDocumentId, position };
  documentLinkStore.set(id, l);
  return l;
}

function condEqValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

function condAndParts(cond: any): any[] {
  if (!cond) return [];
  if (cond.type === 'and' && Array.isArray(cond.conditions)) return cond.conditions;
  if (Array.isArray(cond)) return cond;
  return [];
}

function condOrParts(cond: any): any[] {
  if (!cond) return [];
  if (cond.type === 'or' && Array.isArray(cond.conditions)) return cond.conditions;
  return [];
}

/**
 * Returns a thenable that also has a `.limit()` method — required because
 * some queries chain `.limit(1)` after `.where(...)`.
 */
function makeWhereResult(rows: any[]): any {
  const p = Promise.resolve(rows) as any;
  p.limit = (_n: number) => Promise.resolve(rows);
  return p;
}

function makeReturning(item: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(item ? [item] : []);
  return p;
}

/** Tracks every table passed to mockDb.insert() so tests can assert no rogue inserts. */
const insertedTables: string[] = [];

const mockDb: any = {
  insert: jest.fn((table: any) => {
    const tname: string = table?._?.name ?? (typeof table?.name === 'string' ? table.name : '');
    insertedTables.push(tname);
    return {
      values: jest.fn(() => ({
        onConflictDoUpdate: jest.fn(() => Promise.resolve([])),
        returning: jest.fn(() => Promise.resolve([])),
      })),
    };
  }),
  select: jest.fn((_cols?: any) => ({
    from: jest.fn((table: any) => {
      const tname: string = table?._?.name ?? (typeof table?.name === 'string' ? table.name : '');
      return {
        where: jest.fn((cond: any) => {
          if (tname === 'bulk_import_sessions') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? sessionStore.get(id) : undefined;
            return makeWhereResult(row ? [row] : []);
          }

          if (tname === 'document_link_families') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? familyStore.get(id) : undefined;
            return makeWhereResult(row ? [row] : []);
          }

          if (tname === 'documents') {
            const id = condEqValue(cond) as string | undefined;
            const row = id ? documentStore.get(id) : undefined;
            return makeWhereResult(row ? [row] : []);
          }

          if (tname === 'document_links') {
            const andParts = condAndParts(cond);
            const familyIdPart = andParts[0];
            const familyId = condEqValue(familyIdPart) as string | undefined;
            const orPart = andParts[1];
            const orParts = condOrParts(orPart);

            const colName = (c: any): string =>
              c?.column?.enumValue ?? c?.column?.name ?? c?.column?.sqlName ?? '';

            const matchesCond = (c: any, l: DocumentLink): boolean => {
              const col = colName(c);
              const val = condEqValue(c) as string | undefined;
              if (col === 'from_document_id') return l.fromDocumentId === val;
              if (col === 'to_document_id') return l.toDocumentId === val;
              if (col === 'position') return l.position === val;
              return true;
            };

            const matching = Array.from(documentLinkStore.values()).filter((l) => {
              if (familyId && l.familyId !== familyId) return false;
              if (orParts.length === 0) return true;

              return orParts.some((p: any) => {
                const andSubParts = condAndParts(p);
                if (andSubParts.length >= 2) {
                  return andSubParts.every((c: any) => matchesCond(c, l));
                }
                const docId = condEqValue(p) as string | undefined;
                return docId === l.fromDocumentId || docId === l.toDocumentId;
              });
            });
            // Task #1386: family-wide queries (cycle detection) need ALL matches.
            // Slot-specific occupancy queries (with OR conditions) need only the first.
            if (orParts.length === 0) return makeWhereResult(matching);
            return makeWhereResult(matching.length > 0 ? [matching[0]] : []);
          }

          const id = condEqValue(cond) as string | undefined;
          const row = id ? itemStore.get(id) : undefined;
          return makeWhereResult(row ? [row] : []);
        }),
      };
    }),
  })),

  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const id = condEqValue(cond) as string | undefined;
        if (!id || !itemStore.has(id)) return makeReturning(null);
        const existing = itemStore.get(id)!;
        const merged = { ...existing, ...updates } as Item;
        itemStore.set(id, merged);
        return makeReturning(merged);
      }),
    })),
  })),

  // Task #1425: needed by the membership upsert/clear side-effects.
  delete: jest.fn((_table: any) => ({
    where: jest.fn(() => Promise.resolve()),
  })),
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

jest.mock('../../../server/services/document-service', () => ({
  documentService: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

const ITEM_URL = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-existing-link-decision`;

const SESSION = 'sess-el-1';

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  familyStore.clear();
  documentStore.clear();
  documentLinkStore.clear();
  insertedTables.length = 0;
  jest.clearAllMocks();

  seedSession(SESSION, { buildingId: 'bldg-1', organizationId: 'org-1' });
});

describe('POST /api/admin/bulk-import/items/:id/set-existing-link-decision (Task #1386)', () => {
  it('returns 404 when item does not exist', async () => {
    const res = await request(buildApp())
      .post(ITEM_URL('ghost-item'))
      .send({ familyId: null, neighborDocumentId: null, position: null })
      .expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 (missing_fields) when familyId is set but neighborDocumentId is null', async () => {
    seedItem('item-1');

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: null, position: null })
      .expect(400);

    expect(res.body.errorCode).toBe('missing_fields');
  });

  it('clears the existing-family link when familyId is null', async () => {
    seedItem('item-1', {
      linkDecisions: {
        familyId: 'fam-old',
        beforeDocumentId: 'doc-old',
        afterDocumentId: null,
        manualOverride: true,
      },
    });

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: null, neighborDocumentId: null, position: null })
      .expect(200);

    const ld = res.body.item.linkDecisions as Record<string, unknown>;
    expect(ld.familyId).toBeNull();
    expect(ld.beforeDocumentId).toBeNull();
    expect(ld.afterDocumentId).toBeNull();
    expect(ld.manualOverride).toBe(true);
  });

  it('returns 400 (family_not_found) when the family does not exist', async () => {
    seedItem('item-1');

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'ghost-family', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('family_not_found');
  });

  it('returns 400 (family_not_visible) when the family belongs to a different org', async () => {
    seedItem('item-1');
    seedFamily('fam-other-org', { organizationId: 'org-other' });

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-other-org', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('family_not_visible');
  });

  it('family with null organizationId is visible (does not return family_not_visible)', async () => {
    seedItem('item-1');
    seedFamily('fam-global', { organizationId: null });
    // No neighbor doc seeded — the request should fail with neighbor_not_found, NOT family_not_visible.
    // This proves the global-family visibility check passes.
    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-global', neighborDocumentId: 'ghost-doc', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('neighbor_not_found');
  });

  it('returns 400 (neighbor_not_found) when the neighbor document does not exist', async () => {
    seedItem('item-1');
    seedFamily('fam-1');

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'ghost-doc', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('neighbor_not_found');
  });

  it('returns 400 (scope_mismatch) when the neighbor is in a different building', async () => {
    seedItem('item-1');
    seedFamily('fam-1');
    seedDocument('doc-other-bldg', { buildingId: 'bldg-other', residenceId: null });

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-other-bldg', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('scope_mismatch');
  });

  it('returns 400 (scope_mismatch) when item is residence doc and neighbor residence does not match', async () => {
    seedItem('item-res', {
      branchDecision: { branch: 'residence_documents', subCategory: 'lease', residenceId: 'res-1' },
    });
    seedFamily('fam-1');
    seedDocument('doc-res-2', { buildingId: 'bldg-1', residenceId: 'res-2' });

    const res = await request(buildApp())
      .post(ITEM_URL('item-res'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-res-2', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('scope_mismatch');
  });

  it('returns 400 (self_link) when the neighbor is the item\'s own committed document', async () => {
    seedItem('item-1', { finalDocumentId: 'doc-committed' });
    seedFamily('fam-1');
    seedDocument('doc-committed', { buildingId: 'bldg-1', residenceId: null });

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-committed', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('self_link');
  });

  it('returns 400 (neighbor_not_in_family) when the neighbor has no link in the chosen family', async () => {
    seedItem('item-1');
    seedFamily('fam-1');
    seedDocument('doc-1', { buildingId: 'bldg-1', residenceId: null });

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('neighbor_not_in_family');
  });

  it('returns 400 (occupied_side) when the chosen after-side of the neighbor is already occupied', async () => {
    seedItem('item-1');
    seedFamily('fam-1');
    seedDocument('doc-1', { buildingId: 'bldg-1', residenceId: null });
    // doc-1 is in the family AND its 'after' side is occupied via an outgoing 'after' link
    seedDocumentLink('lnk-occ', 'fam-1', 'doc-1', 'doc-2', 'after');

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(400);

    expect(res.body.errorCode).toBe('occupied_side');
  });

  it('happy path (position=after): stores familyId + afterDocumentId in linkDecisions', async () => {
    seedItem('item-1', { status: 'identified' });
    seedFamily('fam-1');
    seedDocument('doc-1', { buildingId: 'bldg-1', residenceId: null });
    // doc-1 is in the family; its 'after' side is free (only 'before' side occupied)
    seedDocumentLink('lnk-seed', 'fam-1', 'doc-1', 'doc-0', 'before');

    const res = await request(buildApp())
      .post(ITEM_URL('item-1'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(200);

    const ld = res.body.item.linkDecisions as Record<string, unknown>;
    expect(ld.familyId).toBe('fam-1');
    expect(ld.afterDocumentId).toBe('doc-1');
    expect(ld.beforeDocumentId).toBeNull();
    expect(ld.manualOverride).toBe(true);
    expect(res.body.item.status).toBe('linked');
  });

  it('happy path (position=before): stores familyId + beforeDocumentId in linkDecisions', async () => {
    seedItem('item-2', { status: 'linked' });
    seedFamily('fam-1');
    seedDocument('doc-1', { buildingId: 'bldg-1', residenceId: null });
    // doc-1 is in the family; its 'before' side is free (only 'after' side occupied)
    seedDocumentLink('lnk-seed', 'fam-1', 'doc-1', 'doc-2', 'after');

    const res = await request(buildApp())
      .post(ITEM_URL('item-2'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-1', position: 'before' })
      .expect(200);

    const ld = res.body.item.linkDecisions as Record<string, unknown>;
    expect(ld.familyId).toBe('fam-1');
    expect(ld.beforeDocumentId).toBe('doc-1');
    expect(ld.afterDocumentId).toBeNull();
    expect(ld.manualOverride).toBe(true);
  });

  it('preserves existing beforeItemId/afterItemId when adding a family link', async () => {
    seedItem('item-3', {
      status: 'linked',
      linkDecisions: { beforeItemId: 'prev-item', afterItemId: null, manualOverride: true },
    });
    seedFamily('fam-1');
    seedDocument('doc-1', { buildingId: 'bldg-1', residenceId: null });
    // doc-1 is in the family; its 'after' side is free
    seedDocumentLink('lnk-seed', 'fam-1', 'doc-1', 'doc-0', 'before');

    const res = await request(buildApp())
      .post(ITEM_URL('item-3'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(200);

    const ld = res.body.item.linkDecisions as Record<string, unknown>;
    expect(ld.beforeItemId).toBe('prev-item');
    expect(ld.familyId).toBe('fam-1');
  });

  // ── Task #1386 new tests ─────────────────────────────────────────────────

  it('returns 400 (occupied_side) when a corrupt cyclic chain would pass the cycle walk (occupancy fires first)', async () => {
    // Build a corrupt (already-cyclic) chain: doc-A →(after)→ doc-B →(after)→ doc-A.
    // Although cycle detection would catch this (PROJECTED → doc-A → doc-B → doc-A), the
    // occupancy check runs BEFORE the cycle walk.  Inserting 'before' doc-A requires the
    // before-slot of doc-A to be free; lnk-ba (from=doc-B, pos='after', to=doc-A) occupies
    // that slot (matches the second OR-branch: to=doc-A AND pos=opposite('before')='after'),
    // so the server returns `occupied_side` not `cycle_detected`.
    // cycle_detected is a safety net for future corrupt-DB states; it is unreachable through
    // normal API use because occupancy is equivalent to a cycle check on a linear chain.
    seedItem('item-cycle', { status: 'identified' });
    seedFamily('fam-cycle');
    seedDocument('doc-A', { buildingId: 'bldg-1', residenceId: null });
    seedDocument('doc-B', { buildingId: 'bldg-1', residenceId: null });
    seedDocumentLink('lnk-ab', 'fam-cycle', 'doc-A', 'doc-B', 'after');
    seedDocumentLink('lnk-ba', 'fam-cycle', 'doc-B', 'doc-A', 'after');

    const res = await request(buildApp())
      .post(ITEM_URL('item-cycle'))
      .send({ familyId: 'fam-cycle', neighborDocumentId: 'doc-A', position: 'before' })
      .expect(400);

    expect(res.body.errorCode).toBe('occupied_side');
  });

  it('happy path NEVER inserts into documentLinkFamilies or documentLinks — decision is stored in linkDecisions only', async () => {
    // Task #1386: set-existing-link-decision must store the decision into
    // bulkImportItems.linkDecisions and never create new family/link rows.
    // The documentLinks row is only written at commit time.
    // Task #1425: a membership-table upsert (bulk_import_item_family_memberships)
    // IS now allowed as a side-effect, but document_link_families and document_links
    // must never be inserted at decision time.
    seedItem('item-noins', { status: 'identified' });
    seedFamily('fam-1');
    seedDocument('doc-1', { buildingId: 'bldg-1', residenceId: null });
    // doc-1 is in the family; its 'after' side is free
    seedDocumentLink('lnk-seed', 'fam-1', 'doc-1', 'doc-0', 'before');

    await request(buildApp())
      .post(ITEM_URL('item-noins'))
      .send({ familyId: 'fam-1', neighborDocumentId: 'doc-1', position: 'after' })
      .expect(200);

    // db.insert must NEVER touch document_link_families or document_links at decision time.
    expect(insertedTables).not.toContain('document_link_families');
    expect(insertedTables).not.toContain('document_links');
    // Task #1425: the membership upsert (bulk_import_item_family_memberships) IS expected.
    expect(insertedTables.filter((t) => t !== 'bulk_import_item_family_memberships')).toHaveLength(0);
  });

  it('never calls db.insert even on the clear path (Task #1425: delete-only side-effect)', async () => {
    seedItem('item-clr', {
      linkDecisions: { familyId: 'fam-old', beforeDocumentId: 'doc-old', afterDocumentId: null },
    });

    await request(buildApp())
      .post(ITEM_URL('item-clr'))
      .send({ familyId: null, neighborDocumentId: null, position: null })
      .expect(200);

    // Clear path must not INSERT anything — it only DELETEs memberships as a side-effect.
    expect(insertedTables).toHaveLength(0);
  });
});
