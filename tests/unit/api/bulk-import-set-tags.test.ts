/**
 * Task #1104 — Server-side coverage for the inline tag editor added to
 * the Identification step of the bulk-document-import wizard
 * (Task #1103).
 *
 * The endpoint POST /api/admin/bulk-import/items/:id/set-tags lets an
 * admin override the AI-suggested `identification.tags` blob on a single
 * staged item with a curated list of real `document_tags` UUIDs before
 * the item is committed. The handler must:
 *
 *   - Merge the chosen tag IDs into the existing identification JSONB
 *     (so the AI's other fields — name, description, effectiveDate —
 *     are preserved untouched).
 *   - Validate every supplied tag ID against `document_tags`, restricted
 *     to the session organisation's own tags + system tags. Unknown or
 *     cross-tenant IDs must produce a 400 (no silent skip).
 *   - Enforce scope: a `building`-scoped tag must never be applied to a
 *     residence-routed item, and vice versa. `any`-scope tags are always
 *     allowed.
 *   - Reject access from admins who do not belong to the session's
 *     organisation with a 403.
 *   - Accept an empty array as a valid "clear all tags" payload.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () =>
  require('../../manual-mocks/drizzle-orm/pg-core'),
);

// ---------------------------------------------------------------------------
// In-memory stores. Same shape as the sister bulk-import unit tests.
// ---------------------------------------------------------------------------
type Item = Record<string, unknown> & { id: string; sessionId: string };
type Session = Record<string, unknown> & {
  id: string;
  buildingId: string | null;
  organizationId: string;
};
type Tag = {
  id: string;
  scope: 'building' | 'residence' | 'any';
  organizationId: string | null;
  isSystem: boolean;
};

const itemStore = new Map<string, Item>();
const sessionStore = new Map<string, Session>();
const tagStore = new Map<string, Tag>();

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
    stagedPath: `/staging/${id}.pdf`,
    mimeType: 'application/pdf',
    status: 'identified',
    branchDecision: { branch: 'building_documents' } as Record<string, unknown>,
    identification: {
      name: 'AI-detected name',
      description: 'AI-detected description',
      effectiveDate: '2024-03-15',
      effectiveDateManualOverride: true,
      confidence: 0.92,
    } as Record<string, unknown>,
    ...overrides,
  };
  itemStore.set(id, base);
  return base;
}

function seedTag(tag: Tag): Tag {
  tagStore.set(tag.id, tag);
  return tag;
}

// ---------------------------------------------------------------------------
// drizzle helpers — the manual-mock builds `eq(col, val)`, `and(...)`,
// `or(...)`, and `inArray(col, values)` descriptors with a `type`
// discriminator and `value`/`values` fields.
// ---------------------------------------------------------------------------
function condValue(cond: any): unknown {
  if (!cond) return undefined;
  if ('value' in cond) return cond.value;
  return undefined;
}

/**
 * Walk an arbitrarily nested `and(...)` / `or(...)` cond and pull out
 * the `inArray(...).values` operand. The handler's tag select uses
 *   and(inArray(documentTags.id, tagIds), or(eq(isSystem, true), …))
 * so the inArray sits one level deep inside an `and`.
 */
function extractInArrayValues(cond: any): string[] | undefined {
  if (!cond) return undefined;
  if (cond.operator === 'in' && Array.isArray(cond.values)) {
    return cond.values as string[];
  }
  if (cond.type === 'inArray' && Array.isArray(cond.values)) {
    return cond.values as string[];
  }
  if (cond.type === 'and' && Array.isArray(cond.conditions)) {
    for (const c of cond.conditions) {
      const v = extractInArrayValues(c);
      if (v) return v;
    }
  }
  if (cond.type === 'or' && Array.isArray(cond.conditions)) {
    for (const c of cond.conditions) {
      const v = extractInArrayValues(c);
      if (v) return v;
    }
  }
  return undefined;
}

function makeWhereThenable(updated: Item | null) {
  const p: any = Promise.resolve();
  p.returning = () => Promise.resolve(updated ? [updated] : []);
  return p;
}

const mockDb: any = {
  select: jest.fn((_cols?: any) => ({
    from: jest.fn((table: any) => {
      // The pgTable mock spreads the schema columns into the table
      // object, so `table.name` ends up shadowed by the `name` column
      // descriptor on tables that have one (e.g. document_tags).
      // Reading from `table._.name` always gives the underlying SQL
      // table name regardless of the columns it contains.
      const tableName =
        table?._?.name ?? (typeof table?.name === 'string' ? table.name : '');
      return {
        where: jest.fn((cond: any) => {
          if (tableName === 'bulk_import_sessions') {
            const id = condValue(cond) as string | undefined;
            const row = id ? sessionStore.get(id) : undefined;
            return Promise.resolve(row ? [row] : []);
          }
          if (tableName === 'document_tags') {
            const ids = extractInArrayValues(cond) ?? [];
            // The handler additionally restricts the lookup to system
            // tags OR tags belonging to the session's organisation;
            // since we control the seeded tags directly, we honour that
            // filter here so cross-tenant IDs that are seeded under a
            // foreign org won't come back from the lookup.
            const rows = ids
              .map((id) => tagStore.get(id))
              .filter((t): t is Tag => !!t)
              .filter(
                (t) =>
                  t.isSystem ||
                  t.organizationId === null ||
                  t.organizationId === currentSessionOrgForLookup,
              )
              .map((t) => ({ id: t.id, scope: t.scope }));
            return Promise.resolve(rows);
          }
          // Fallback: bulk_import_items lookup by id.
          const id = condValue(cond) as string | undefined;
          const row = id ? itemStore.get(id) : undefined;
          return Promise.resolve(row ? [row] : []);
        }),
      };
    }),
  })),
  update: jest.fn(() => ({
    set: jest.fn((updates: Partial<Item>) => ({
      where: jest.fn((cond: any) => {
        const id = condValue(cond) as string | undefined;
        if (!id || !itemStore.has(id)) return makeWhereThenable(null);
        const merged: Item = { ...itemStore.get(id)!, ...updates } as Item;
        itemStore.set(id, merged);
        return makeWhereThenable(merged);
      }),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => Promise.resolve()),
  })),
};

// The org used to filter the documentTags lookup. Set right before each
// request so the mock can apply the same scope check the handler does
// without us having to reproduce the full SQL predicate.
let currentSessionOrgForLookup = 'org-1';

jest.mock('../../../server/db', () => ({ db: mockDb }));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'admin' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const canAccessMock = jest.fn().mockResolvedValue(true);
jest.mock('../../../server/rbac', () => ({
  canUserAccessOrganization: (...args: any[]) => canAccessMock(...args),
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
  logWarn: jest.fn(),
}));

import { registerBulkImportRoutes } from '../../../server/api/bulk-import';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerBulkImportRoutes(app);
  return app;
}

beforeEach(() => {
  itemStore.clear();
  sessionStore.clear();
  tagStore.clear();
  canAccessMock.mockClear();
  canAccessMock.mockResolvedValue(true);
  currentSessionOrgForLookup = 'org-1';
  jest.clearAllMocks();
});

const URL = (id: string) =>
  `/api/admin/bulk-import/items/${id}/set-tags`;

describe('POST /api/admin/bulk-import/items/:id/set-tags (Task #1104)', () => {
  it('happy path: writes tagIds into identification JSONB and preserves sibling fields', async () => {
    seedSession('sess-1');
    seedItem('it-1');
    seedTag({
      id: 'tag-building-1',
      scope: 'building',
      organizationId: 'org-1',
      isSystem: false,
    });
    seedTag({
      id: 'tag-any-1',
      scope: 'any',
      organizationId: null,
      isSystem: true,
    });

    const res = await request(buildApp())
      .post(URL('it-1'))
      .send({ tagIds: ['tag-building-1', 'tag-any-1'] })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.tags).toEqual(['tag-building-1', 'tag-any-1']);
    // Sibling identification fields the AI wrote must survive the merge —
    // the endpoint must NOT clobber them with a fresh blob.
    expect(ident.name).toBe('AI-detected name');
    expect(ident.description).toBe('AI-detected description');
    expect(ident.effectiveDate).toBe('2024-03-15');
    expect(ident.effectiveDateManualOverride).toBe(true);
    expect(ident.confidence).toBe(0.92);
  });

  it('happy path: empty array clears the tag list (valid payload)', async () => {
    seedSession('sess-1');
    seedItem('it-empty', {
      identification: {
        name: 'Doc',
        tags: ['tag-old-1', 'tag-old-2'],
      } as Record<string, unknown>,
    });

    const res = await request(buildApp())
      .post(URL('it-empty'))
      .send({ tagIds: [] })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.tags).toEqual([]);
    expect(ident.name).toBe('Doc');
  });

  it('seeds a fresh identification blob when the item has none yet', async () => {
    seedSession('sess-1');
    seedItem('it-fresh', { identification: null });
    seedTag({
      id: 'tag-any-1',
      scope: 'any',
      organizationId: null,
      isSystem: true,
    });

    const res = await request(buildApp())
      .post(URL('it-fresh'))
      .send({ tagIds: ['tag-any-1'] })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.tags).toEqual(['tag-any-1']);
  });

  it('rejects unknown tag IDs with a 400 and leaves the item untouched', async () => {
    seedSession('sess-1');
    seedItem('it-unknown');
    seedTag({
      id: 'tag-known',
      scope: 'any',
      organizationId: 'org-1',
      isSystem: false,
    });

    const res = await request(buildApp())
      .post(URL('it-unknown'))
      .send({ tagIds: ['tag-known', 'tag-does-not-exist'] })
      .expect(400);

    expect(typeof res.body.error).toBe('string');
    expect(res.body.error).toMatch(/tag-does-not-exist/);
    // The identification blob must NOT have been overwritten on the
    // failure path.
    const stored = itemStore.get('it-unknown')!.identification as Record<
      string,
      unknown
    >;
    expect(stored.tags).toBeUndefined();
    // Sibling fields are still intact.
    expect(stored.name).toBe('AI-detected name');
  });

  it('rejects cross-tenant tag IDs (treated as inaccessible) with a 400', async () => {
    seedSession('sess-1', { organizationId: 'org-1' });
    seedItem('it-cross');
    // Tag belongs to a DIFFERENT org and is not a system tag — the
    // handler restricts the lookup to the session's org, so this id
    // should come back as "unknown / inaccessible".
    seedTag({
      id: 'tag-foreign',
      scope: 'any',
      organizationId: 'org-other',
      isSystem: false,
    });

    const res = await request(buildApp())
      .post(URL('it-cross'))
      .send({ tagIds: ['tag-foreign'] })
      .expect(400);

    expect(res.body.error).toMatch(/tag-foreign/);
  });

  it('rejects a building-scope tag applied to a residence-scoped item with a 400', async () => {
    seedSession('sess-1');
    seedItem('it-residence', {
      branchDecision: { branch: 'residence_documents' } as Record<
        string,
        unknown
      >,
    });
    seedTag({
      id: 'tag-building-only',
      scope: 'building',
      organizationId: 'org-1',
      isSystem: false,
    });

    const res = await request(buildApp())
      .post(URL('it-residence'))
      .send({ tagIds: ['tag-building-only'] })
      .expect(400);

    expect(res.body.error).toMatch(/scope.*building/i);
    expect(res.body.error).toMatch(/residence/i);
    // No partial write on the failure path.
    const stored = itemStore.get('it-residence')!.identification as Record<
      string,
      unknown
    >;
    expect(stored.tags).toBeUndefined();
  });

  it('rejects a residence-scope tag applied to a building-scoped item with a 400', async () => {
    seedSession('sess-1');
    seedItem('it-building', {
      branchDecision: { branch: 'building_documents' } as Record<
        string,
        unknown
      >,
    });
    seedTag({
      id: 'tag-residence-only',
      scope: 'residence',
      organizationId: 'org-1',
      isSystem: false,
    });

    const res = await request(buildApp())
      .post(URL('it-building'))
      .send({ tagIds: ['tag-residence-only'] })
      .expect(400);

    expect(res.body.error).toMatch(/scope.*residence/i);
    expect(res.body.error).toMatch(/building/i);
  });

  it('allows scope="any" tags on either branch', async () => {
    seedSession('sess-1');
    seedItem('it-residence-any', {
      branchDecision: { branch: 'residence_documents' } as Record<
        string,
        unknown
      >,
    });
    seedTag({
      id: 'tag-universal',
      scope: 'any',
      organizationId: null,
      isSystem: true,
    });

    const res = await request(buildApp())
      .post(URL('it-residence-any'))
      .send({ tagIds: ['tag-universal'] })
      .expect(200);

    const ident = (res.body.identification ?? {}) as Record<string, unknown>;
    expect(ident.tags).toEqual(['tag-universal']);
  });

  it('returns 403 when the admin cannot access the session organisation', async () => {
    seedSession('sess-1');
    seedItem('it-forbidden');
    seedTag({
      id: 'tag-any-1',
      scope: 'any',
      organizationId: null,
      isSystem: true,
    });
    canAccessMock.mockResolvedValueOnce(false);

    const res = await request(buildApp())
      .post(URL('it-forbidden'))
      .send({ tagIds: ['tag-any-1'] })
      .expect(403);

    expect(res.body.error).toMatch(/do not have access/i);
    // The identification blob must NOT have been touched on the
    // access-denied path.
    const stored = itemStore.get('it-forbidden')!.identification as Record<
      string,
      unknown
    >;
    expect(stored.tags).toBeUndefined();
    expect(stored.name).toBe('AI-detected name');
  });

  it('returns 404 when the item id is unknown', async () => {
    seedSession('sess-1');

    const res = await request(buildApp())
      .post(URL('does-not-exist'))
      .send({ tagIds: [] })
      .expect(404);

    expect(res.body.error).toMatch(/Item not found/);
  });
});
