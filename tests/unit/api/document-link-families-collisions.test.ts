/**
 * @jest-environment node
 *
 * Task #1644 — Pin the 409 collision guards on the
 * `/api/document-link-families` POST and PATCH handlers.
 *
 * The duplicate-prevention logic added in Task #1636 lives in
 * `findNameCollision` and is invoked from:
 *
 *   POST  /api/document-link-families
 *     - When `isSystem:true` is requested by a super_admin, a system-side
 *       collision (any visible family with the same normalised name) must
 *       respond 409 with `existingFamilyId` / `existingFamilyName` and
 *       must NOT insert a new row.
 *     - When creating an org-scoped family, a collision against a system
 *       family OR another family already visible to the org must respond
 *       with the same 409 contract.
 *
 *   PATCH /api/document-link-families/:id
 *     - Renaming an org-scoped family to a name that collides with a
 *       sibling family (or a system family) visible to the same org must
 *       respond 409 and must NOT update the row.
 *     - Re-saving the SAME name (after normalisation) on the family being
 *       edited must NOT collide with itself (the row is excluded).
 *
 * Collisions are matched on the normalised name (trim + casefold) — the
 * tests below pin both the differs-by-case and differs-by-whitespace cases.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));

// ---------------------------------------------------------------------------
// In-memory family store
// ---------------------------------------------------------------------------

type Family = {
  id: string;
  isSystem: boolean;
  organizationId: string | null;
  name: string;
  description: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const familyStore = new Map<string, Family>();
const insertedFamilies: Family[] = [];
const updatedFamilyIds: string[] = [];
let nextInsertId = 1;

function seedFamily(
  id: string,
  name: string,
  isSystem: boolean,
  organizationId: string | null = null,
  createdAt: Date = new Date('2025-01-01'),
): Family {
  const fam: Family = {
    id,
    isSystem,
    organizationId,
    name,
    description: null,
    source: isSystem ? 'koveo' : organizationId,
    createdAt,
    updatedAt: createdAt,
  };
  familyStore.set(id, fam);
  return fam;
}

function condEqValue(cond: any): unknown {
  if (!cond) return undefined;
  if (cond.type === 'condition' && cond.operator === 'eq') return cond.value;
  if ('value' in (cond ?? {})) return cond.value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Mock DB
//
// `select().from(documentLinkFamilies).where(<cond>)` is called from two
// places in the route under test:
//   1. the existing-by-id lookup in PATCH (where = eq on id)
//   2. `findNameCollision`, which builds an `or(isNull, eq(orgId))` filter
//      and reads ALL visible families.
//
// We can't reliably introspect the `or(...)` cond shape across drizzle
// versions, so when the where clause is NOT a simple eq-on-id we fall back
// to "return the full table" — that matches what the production code
// expects (it does the case-fold filter in JS).
// ---------------------------------------------------------------------------

function isSimpleEqOnId(cond: any): boolean {
  return cond?.type === 'condition' && cond?.operator === 'eq' && typeof cond.value === 'string';
}

/**
 * Extract the explicit organisation id from `findNameCollision`'s
 * `or(isNull(orgId), eq(orgId, organizationId))` filter. Returns null when
 * the filter is system-only (`or(isNull, sql\`false\`)`), matching the
 * production resolution.
 */
function extractOrgIdFromVisibilityFilter(cond: any): string | null {
  if (cond?.type !== 'or') return null;
  for (const sub of cond.conditions ?? []) {
    if (sub?.type === 'condition' && sub?.operator === 'eq' && typeof sub.value === 'string') {
      return sub.value;
    }
  }
  return null;
}

const mockDb: any = {
  select: jest.fn((_projection?: any) => ({
    from: jest.fn((_table: any) => ({
      where: jest.fn((cond: any) => {
        if (isSimpleEqOnId(cond)) {
          const id = condEqValue(cond) as string;
          const row = familyStore.get(id);
          return Promise.resolve(row ? [row] : []);
        }
        // `findNameCollision` visibility query: include system rows
        // (organizationId IS NULL) plus rows for the caller's org.
        const orgId = extractOrgIdFromVisibilityFilter(cond);
        const rows = Array.from(familyStore.values()).filter(
          (f) => f.organizationId === null || (orgId !== null && f.organizationId === orgId),
        );
        return Promise.resolve(rows);
      }),
    })),
  })),

  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve()),
  })),

  insert: jest.fn(() => ({
    values: jest.fn((vals: any) => ({
      returning: jest.fn(() => {
        const id = `inserted-${nextInsertId++}`;
        const fam: Family = {
          id,
          isSystem: vals.isSystem ?? false,
          organizationId: vals.organizationId ?? null,
          name: vals.name ?? '',
          description: vals.description ?? null,
          source: vals.source ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        insertedFamilies.push(fam);
        familyStore.set(id, fam);
        return Promise.resolve([fam]);
      }),
    })),
  })),

  update: jest.fn(() => ({
    set: jest.fn((updates: Record<string, unknown>) => ({
      where: jest.fn((cond: any) => ({
        returning: jest.fn(() => {
          const id = condEqValue(cond) as string | undefined;
          if (id && familyStore.has(id)) {
            const existing = familyStore.get(id)!;
            const next: Family = {
              ...existing,
              ...(typeof updates.name === 'string' ? { name: updates.name } : {}),
              ...(updates.description !== undefined
                ? { description: updates.description as string | null }
                : {}),
              updatedAt: (updates.updatedAt as Date) ?? existing.updatedAt,
            };
            familyStore.set(id, next);
            updatedFamilyIds.push(id);
            return Promise.resolve([next]);
          }
          return Promise.resolve([]);
        }),
      })),
    })),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Auth — set req.user from x-test-role header so each test can vary the role.
// ---------------------------------------------------------------------------

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const role = (req.headers['x-test-role'] as string) || 'admin';
    req.user = { id: `user-${role}`, role };
    next();
  },
  requireRole: (_roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

// ---------------------------------------------------------------------------
// Storage — getUserOrganizations is called by the POST/PATCH handlers.
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';

// Both paths must be mocked: the test file references the source path, but
// the route file imports `from '../storage'`, which is rewritten by the
// moduleNameMapper in jest.config.cjs to the file under `__mocks__/server/`.
const storageMock = {
  storage: {
    getUserOrganizations: jest.fn(async () => [{ organizationId: ORG_ID }]),
  },
};
jest.mock('../../../server/storage', () => storageMock);
jest.mock('../../../__mocks__/server/storage', () => storageMock);

// ---------------------------------------------------------------------------
// Schema — minimal columns the route references in eq().
// ---------------------------------------------------------------------------

const makeTable = (tableName: string, cols: Record<string, unknown> = {}) => ({
  _: { name: tableName },
  ...cols,
});

jest.mock('../../../shared/schemas/documents', () => ({
  documentLinkFamilies: makeTable('document_link_families', {
    id: { name: 'id', sqlName: 'id' },
    isSystem: { name: 'isSystem', sqlName: 'is_system' },
    organizationId: { name: 'organizationId', sqlName: 'organization_id' },
    name: { name: 'name', sqlName: 'name' },
  }),
  insertDocumentLinkFamilySchema: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import express, { type Express } from 'express';
import request from 'supertest';
import { registerDocumentLinkFamilyRoutes } from '../../../server/api/document-link-families';

let app: Express;

beforeEach(() => {
  familyStore.clear();
  insertedFamilies.length = 0;
  updatedFamilyIds.length = 0;
  nextInsertId = 1;
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  registerDocumentLinkFamilyRoutes(app);
});

// ===========================================================================
// POST /api/document-link-families — system collision
// ===========================================================================

describe('POST /api/document-link-families — system-side collision (super_admin + isSystem:true)', () => {
  it('returns 409 with existing family info when a system family with the same name exists', async () => {
    seedFamily('sys-existing', 'Budget', true, null);

    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'Budget', isSystem: true });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('sys-existing');
    expect(res.body.existingFamilyName).toBe('Budget');
    expect(res.body.message).toMatch(/already exists/i);
    expect(res.body.message).toMatch(/Koveo system family/i);
    expect(insertedFamilies).toHaveLength(0);
  });

  it('matches case-insensitively (BUDGET collides with budget)', async () => {
    seedFamily('sys-existing', 'budget', true, null);

    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'BUDGET', isSystem: true });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('sys-existing');
    expect(insertedFamilies).toHaveLength(0);
  });

  it('matches against trimmed whitespace ("  Budget  " collides with "Budget")', async () => {
    seedFamily('sys-existing', 'Budget', true, null);

    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: '  Budget  ', isSystem: true });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('sys-existing');
    expect(insertedFamilies).toHaveLength(0);
  });

  it('does not insert a new system family when a collision is detected', async () => {
    seedFamily('sys-existing', 'Budget', true, null);

    await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'budget', isSystem: true });

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(familyStore.size).toBe(1);
  });

  it('still allows creating a system family when no collision exists', async () => {
    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'Brand New Family', isSystem: true });

    expect(res.status).toBe(201);
    expect(res.body.isSystem).toBe(true);
    expect(insertedFamilies).toHaveLength(1);
  });
});

// ===========================================================================
// POST /api/document-link-families — org-scoped collision
// ===========================================================================

describe('POST /api/document-link-families — org-scoped collision (admin/manager)', () => {
  it('returns 409 when an org-scoped family with the same normalised name already exists', async () => {
    seedFamily('org-existing', 'Minutes', false, ORG_ID);

    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'manager')
      .send({ name: 'minutes' });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('org-existing');
    expect(res.body.existingFamilyName).toBe('Minutes');
    expect(res.body.message).toMatch(/already visible to this organization/i);
    expect(insertedFamilies).toHaveLength(0);
  });

  it('returns 409 when the org-side name collides with a system family', async () => {
    seedFamily('sys-budget', 'Budget', true, null);

    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'manager')
      .send({ name: 'BUDGET' });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('sys-budget');
    // The error message calls out that the collision is a system family.
    expect(res.body.message).toMatch(/Koveo system family/i);
    expect(insertedFamilies).toHaveLength(0);
  });

  it('does not collide with a family owned by a DIFFERENT org', async () => {
    // Same name, but in another org — must NOT trigger 409 because that
    // family is not visible to the caller.
    seedFamily('other-org-fam', 'Minutes', false, 'org-other');

    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'manager')
      .send({ name: 'Minutes' });

    expect(res.status).toBe(201);
    expect(insertedFamilies).toHaveLength(1);
    expect(insertedFamilies[0].name).toBe('Minutes');
    expect(insertedFamilies[0].organizationId).toBe(ORG_ID);
  });

  it('still creates the family when there is no collision in the caller\'s org', async () => {
    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'manager')
      .send({ name: 'New Family' });

    expect(res.status).toBe(201);
    expect(res.body.organizationId).toBe(ORG_ID);
    expect(insertedFamilies).toHaveLength(1);
  });
});

// ===========================================================================
// PATCH /api/document-link-families/:id — collision on rename
// ===========================================================================

describe('PATCH /api/document-link-families/:id — rename collision', () => {
  it('returns 409 when renaming to the (case-folded) name of a sibling family', async () => {
    seedFamily('fam-a', 'Minutes', false, ORG_ID);
    seedFamily('fam-b', 'Budget', false, ORG_ID);

    const res = await request(app)
      .patch('/api/document-link-families/fam-b')
      .set('x-test-role', 'admin')
      .send({ name: 'minutes' });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('fam-a');
    expect(res.body.existingFamilyName).toBe('Minutes');
    expect(res.body.message).toMatch(/already visible to this organization/i);

    // The row must NOT have been mutated.
    expect(familyStore.get('fam-b')!.name).toBe('Budget');
    expect(updatedFamilyIds).not.toContain('fam-b');
  });

  it('returns 409 when renaming to a system family\'s name', async () => {
    seedFamily('sys-budget', 'Budget', true, null);
    seedFamily('fam-other', 'Minutes', false, ORG_ID);

    const res = await request(app)
      .patch('/api/document-link-families/fam-other')
      .set('x-test-role', 'admin')
      .send({ name: 'budget' });

    expect(res.status).toBe(409);
    expect(res.body.existingFamilyId).toBe('sys-budget');
    expect(res.body.message).toMatch(/Koveo system family/i);
    expect(familyStore.get('fam-other')!.name).toBe('Minutes');
    expect(updatedFamilyIds).not.toContain('fam-other');
  });

  it('allows re-saving the same name on the row being edited (excludes itself)', async () => {
    // The family being patched should not be considered a collision against
    // itself, even if the new name normalises to the same value.
    seedFamily('fam-self', 'Budget', false, ORG_ID);

    const res = await request(app)
      .patch('/api/document-link-families/fam-self')
      .set('x-test-role', 'admin')
      .send({ name: '  BUDGET  ' });

    expect(res.status).toBe(200);
    expect(familyStore.get('fam-self')!.name).toBe('  BUDGET  ');
    expect(updatedFamilyIds).toContain('fam-self');
  });

  it('does not collide with a family owned by a different org', async () => {
    seedFamily('mine', 'Old Name', false, ORG_ID);
    // Same name, but in another org — must not block our rename.
    seedFamily('theirs', 'New Name', false, 'org-other');

    const res = await request(app)
      .patch('/api/document-link-families/mine')
      .set('x-test-role', 'admin')
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(familyStore.get('mine')!.name).toBe('New Name');
    expect(updatedFamilyIds).toContain('mine');
  });

  it('description-only PATCH skips the collision check entirely', async () => {
    // No `name` in the body means the collision branch must not run; the
    // update should succeed even when another family shares the same name.
    seedFamily('fam-a', 'Minutes', false, ORG_ID);
    seedFamily('fam-b', 'Minutes', false, ORG_ID); // shouldn't normally exist, but proves the guard is name-gated

    const res = await request(app)
      .patch('/api/document-link-families/fam-b')
      .set('x-test-role', 'admin')
      .send({ description: 'Now with a description' });

    expect(res.status).toBe(200);
    expect(familyStore.get('fam-b')!.description).toBe('Now with a description');
    expect(updatedFamilyIds).toContain('fam-b');
  });
});
