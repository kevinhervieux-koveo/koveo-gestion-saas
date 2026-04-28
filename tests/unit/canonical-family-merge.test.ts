/**
 * @jest-environment node
 *
 * Task #1644 — Smoke test for `mergeOrganizationDuplicateFamilies`.
 *
 * The startup backfill collapses duplicate `document_link_families` rows
 * inside one organisation by:
 *
 *   1. repointing every `bulk_import_item_family_memberships.familyId`
 *      pointing at a duplicate to its canonical id (deleting any membership
 *      that would clash with an existing canonical-side row), then
 *   2. repointing every `document_links.familyId` pointing at a duplicate to
 *      its canonical id (keeping the older edge when the unique constraints
 *      would clash), then
 *   3. deleting the duplicate row.
 *
 * This file pins the happy path: one org-scoped duplicate family pointing
 * at the same name as a system family, with a membership and a link that
 * both need repointing. The two repointings happen, and the duplicate row
 * is removed at the end.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../manual-mocks/drizzle-orm'));

// ---------------------------------------------------------------------------
// In-memory tables
// ---------------------------------------------------------------------------

type FamilyRow = {
  id: string;
  organizationId: string | null;
  name: string;
  isSystem: boolean;
  source: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipRow = {
  id: string;
  itemId: string;
  familyId: string;
};

type LinkRow = {
  id: string;
  fromDocumentId: string;
  toDocumentId: string;
  familyId: string;
  position: 'before' | 'after';
  createdAt: Date;
};

const familyTable = new Map<string, FamilyRow>();
const membershipTable = new Map<string, MembershipRow>();
const linkTable = new Map<string, LinkRow>();

// ---------------------------------------------------------------------------
// Small drizzle-orm condition matcher.
//
// Conditions produced by the manual mock are plain objects of the form:
//   eq:        { type: 'condition', column, value, operator: 'eq' }
//   isNull:    { type: 'condition', column, operator: 'isNull' }
//   inArray:   { type: 'condition', column, values, operator: 'in' }
//   and(...)   { type: 'and', conditions: [...] }
//   or(...)    { type: 'or',  conditions: [...] }
//
// The columns the production code passes carry a `name` we set in the
// schema mock below, so we can identify columns by string name.
// ---------------------------------------------------------------------------

function colName(col: any): string | undefined {
  return col?.name ?? col?._?.name;
}

function evalCond<T extends Record<string, unknown>>(cond: any, row: T): boolean {
  if (!cond) return true;
  if (cond.type === 'and') {
    return (cond.conditions ?? []).every((c: any) => evalCond(c, row));
  }
  if (cond.type === 'or') {
    return (cond.conditions ?? []).some((c: any) => evalCond(c, row));
  }
  if (cond.type === 'condition') {
    const name = colName(cond.column);
    if (!name) return false;
    const cell = row[name as keyof T];
    if (cond.operator === 'eq') return cell === cond.value;
    if (cond.operator === 'isNull') return cell === null || cell === undefined;
    if (cond.operator === 'in') return (cond.values as unknown[]).includes(cell);
  }
  return false;
}

function tableFor(tableRef: any): Map<string, any> {
  const name = tableRef?._?.name;
  if (name === 'document_link_families') return familyTable;
  if (name === 'bulk_import_item_family_memberships') return membershipTable;
  if (name === 'document_links') return linkTable;
  throw new Error(`Unknown table reference: ${name}`);
}

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockDb: any = {
  select: jest.fn((projection?: any) => {
    let currentTable: Map<string, any> | null = null;
    let projector: ((row: any) => any) | null = null;
    if (projection) {
      // Resolve the column name set requested by `select({ ... })`. Each
      // value is a column-mock object with a `name` field.
      const cols = Object.entries(projection as Record<string, { name?: string }>);
      projector = (row) => {
        const out: Record<string, unknown> = {};
        for (const [outKey, col] of cols) {
          const sourceKey = (col?.name ?? outKey) as string;
          out[outKey] = row[sourceKey];
        }
        return out;
      };
    }
    const builder: any = {
      from: jest.fn((tableRef: any) => {
        currentTable = tableFor(tableRef);
        return {
          where: jest.fn((cond: any) => {
            const all = Array.from(currentTable!.values());
            const matched = all.filter((row) => evalCond(cond, row));
            return Promise.resolve(projector ? matched.map(projector) : matched);
          }),
        };
      }),
    };
    return builder;
  }),

  delete: jest.fn((tableRef: any) => {
    const tbl = tableFor(tableRef);
    return {
      where: jest.fn((cond: any) => {
        for (const [id, row] of Array.from(tbl.entries())) {
          if (evalCond(cond, row)) tbl.delete(id);
        }
        return Promise.resolve();
      }),
    };
  }),

  update: jest.fn((tableRef: any) => {
    const tbl = tableFor(tableRef);
    let pendingUpdates: Record<string, unknown> = {};
    const builder: any = {
      set: jest.fn((updates: Record<string, unknown>) => {
        pendingUpdates = updates;
        return {
          where: jest.fn((cond: any) => {
            for (const [id, row] of Array.from(tbl.entries())) {
              if (evalCond(cond, row)) {
                tbl.set(id, { ...row, ...pendingUpdates });
              }
            }
            return Promise.resolve();
          }),
        };
      }),
    };
    return builder;
  }),

  insert: jest.fn(() => ({
    values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([])) })),
  })),

  // Production code uses `db.transaction(async tx => {...})`; pass the same
  // db through so writes hit the same in-memory tables.
  transaction: jest.fn(async (fn: any) => fn(mockDb)),
};

jest.mock('../../server/db', () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Schema mocks — only the columns the production code references.
// ---------------------------------------------------------------------------

const makeTable = (tableName: string, cols: Record<string, { name: string }>) => ({
  _: { name: tableName },
  ...cols,
});

jest.mock('../../shared/schemas/documents', () => ({
  documentLinkFamilies: makeTable('document_link_families', {
    id: { name: 'id' },
    organizationId: { name: 'organizationId' },
    isSystem: { name: 'isSystem' },
    name: { name: 'name' },
  }),
  documentLinks: makeTable('document_links', {
    id: { name: 'id' },
    fromDocumentId: { name: 'fromDocumentId' },
    toDocumentId: { name: 'toDocumentId' },
    familyId: { name: 'familyId' },
    position: { name: 'position' },
    createdAt: { name: 'createdAt' },
  }),
}));

jest.mock('../../shared/schemas/bulk-import', () => ({
  bulkImportItemFamilyMemberships: makeTable('bulk_import_item_family_memberships', {
    id: { name: 'id' },
    itemId: { name: 'itemId' },
    familyId: { name: 'familyId' },
  }),
}));

jest.mock('../../shared/schemas/core', () => ({
  organizations: makeTable('organizations', { id: { name: 'id' } }),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import { mergeOrganizationDuplicateFamilies } from '../../server/services/canonical-family-resolver';

const ORG_ID = 'org-1';
const SYSTEM_FAMILY_ID = 'sys-budget';
const DUPLICATE_FAMILY_ID = 'org-budget-dup';
const ITEM_ID = 'item-1';
const MEMBERSHIP_ID = 'mem-1';
const FROM_DOC_ID = 'doc-from';
const TO_DOC_ID = 'doc-to';
const LINK_ID = 'link-1';

beforeEach(() => {
  familyTable.clear();
  membershipTable.clear();
  linkTable.clear();
  jest.clearAllMocks();

  // System "Budget" family + an org-scoped lowercase "budget" duplicate.
  familyTable.set(SYSTEM_FAMILY_ID, {
    id: SYSTEM_FAMILY_ID,
    organizationId: null,
    name: 'Budget',
    isSystem: true,
    source: 'koveo',
    description: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  });
  familyTable.set(DUPLICATE_FAMILY_ID, {
    id: DUPLICATE_FAMILY_ID,
    organizationId: ORG_ID,
    name: 'budget',
    isSystem: false,
    source: ORG_ID,
    description: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  });

  // A membership and a link, both attached to the duplicate family — these
  // are exactly the rows the merge function must repoint to the system id.
  membershipTable.set(MEMBERSHIP_ID, {
    id: MEMBERSHIP_ID,
    itemId: ITEM_ID,
    familyId: DUPLICATE_FAMILY_ID,
  });
  linkTable.set(LINK_ID, {
    id: LINK_ID,
    fromDocumentId: FROM_DOC_ID,
    toDocumentId: TO_DOC_ID,
    familyId: DUPLICATE_FAMILY_ID,
    position: 'after',
    createdAt: new Date('2025-02-01'),
  });
});

describe('mergeOrganizationDuplicateFamilies', () => {
  it('repoints memberships and links from the duplicate to the canonical, then deletes the duplicate', async () => {
    const merged = await mergeOrganizationDuplicateFamilies(ORG_ID, () => undefined);

    expect(merged).toBe(1);

    // Membership repointed to the canonical (system) family.
    expect(membershipTable.get(MEMBERSHIP_ID)?.familyId).toBe(SYSTEM_FAMILY_ID);

    // Link repointed to the canonical family — still the same link row.
    expect(linkTable.get(LINK_ID)?.familyId).toBe(SYSTEM_FAMILY_ID);

    // Duplicate family row removed; system family preserved.
    expect(familyTable.has(DUPLICATE_FAMILY_ID)).toBe(false);
    expect(familyTable.has(SYSTEM_FAMILY_ID)).toBe(true);

    // The whole repoint+delete must be wrapped in one transaction per pair.
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('returns 0 and touches nothing when there are no duplicates', async () => {
    // Drop the duplicate so only the system family remains visible to org-1.
    familyTable.delete(DUPLICATE_FAMILY_ID);
    membershipTable.delete(MEMBERSHIP_ID);
    linkTable.delete(LINK_ID);

    const merged = await mergeOrganizationDuplicateFamilies(ORG_ID, () => undefined);

    expect(merged).toBe(0);
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(familyTable.has(SYSTEM_FAMILY_ID)).toBe(true);
  });
});
