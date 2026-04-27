/**
 * @jest-environment node
 *
 * Task #1440 — Super admins can create and delete Koveo system link families.
 *
 * This file replaces the Task #1430 fixture (which blocked all roles from
 * deleting system families) with the new behaviour:
 *
 * DELETE /api/document-link-families/:id
 *   - super_admin CAN delete a system family → 200.
 *   - Every other role (admin, manager, demo_manager) is still refused → 403.
 *   - The system family row is NOT deleted when the caller is not super_admin.
 *   - Non-system family in the caller's org → still 200 for admin.
 *   - Out-of-scope non-system family → still 403 for manager.
 *   - Missing id → 404.
 *
 * POST /api/document-link-families
 *   - super_admin + isSystem:true → 201, isSystem=true, source='koveo'.
 *   - super_admin + isSystem:false + explicit organizationId (not a member) → 201.
 *   - admin + isSystem:true → 403 "Only super admins can create Koveo system families".
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
const deletedFamilyIds: string[] = [];
const insertedFamilies: Family[] = [];

function seedFamily(
  id: string,
  isSystem: boolean,
  organizationId: string | null = null,
): Family {
  const fam: Family = {
    id,
    isSystem,
    organizationId,
    name: `Family ${id}`,
    description: null,
    source: isSystem ? 'koveo' : organizationId,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
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
// ---------------------------------------------------------------------------

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn((_table: any) => ({
      where: jest.fn((cond: any) => {
        const id = condEqValue(cond) as string | undefined;
        const row = id ? familyStore.get(id) : undefined;
        return Promise.resolve(row ? [row] : []);
      }),
    })),
  })),

  delete: jest.fn((_table: any) => ({
    where: jest.fn((cond: any) => {
      const id = condEqValue(cond) as string | undefined;
      if (id && familyStore.has(id)) {
        deletedFamilyIds.push(id);
        familyStore.delete(id);
      }
      return Promise.resolve();
    }),
  })),

  insert: jest.fn((_table: any) => ({
    values: jest.fn((vals: any) => ({
      returning: jest.fn(() => {
        const fam: Family = {
          id: 'new-family-id',
          isSystem: vals.isSystem ?? false,
          organizationId: vals.organizationId ?? null,
          name: vals.name ?? '',
          description: vals.description ?? null,
          source: vals.source ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        insertedFamilies.push(fam);
        return Promise.resolve([fam]);
      }),
    })),
  })),

  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve([])),
      })),
    })),
  })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Auth middleware — sets req.user from x-test-role header.
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
// Storage mock
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';

jest.mock('../../../server/storage', () => ({
  storage: {
    getUserOrganizations: jest.fn(async () => [{ organizationId: ORG_ID }]),
  },
}));

// ---------------------------------------------------------------------------
// Schema mock
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
  }),
  insertDocumentLinkFamilySchema: {},
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER all mocks are set up.
// ---------------------------------------------------------------------------

import express, { type Express } from 'express';
import request from 'supertest';
import { registerDocumentLinkFamilyRoutes } from '../../../server/api/document-link-families';

const SYSTEM_FAMILY_ID = 'sys-fam-1';
const CUSTOM_FAMILY_ID = 'custom-fam-1';
const OUT_OF_SCOPE_FAMILY_ID = 'custom-fam-other-org';
const GHOST_FAMILY_ID = 'does-not-exist';

let app: Express;

beforeEach(() => {
  familyStore.clear();
  deletedFamilyIds.length = 0;
  insertedFamilies.length = 0;
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  registerDocumentLinkFamilyRoutes(app);
});

// ---------------------------------------------------------------------------
// DELETE — super_admin succeeds on system family
// ---------------------------------------------------------------------------

describe('DELETE /api/document-link-families/:id — super_admin on system family', () => {
  beforeEach(() => {
    seedFamily(SYSTEM_FAMILY_ID, true, null);
  });

  it('returns 200 and removes the row', async () => {
    const res = await request(app)
      .delete(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
      .set('x-test-role', 'super_admin');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(familyStore.has(SYSTEM_FAMILY_ID)).toBe(false);
    expect(deletedFamilyIds).toContain(SYSTEM_FAMILY_ID);
  });
});

// ---------------------------------------------------------------------------
// DELETE — non-super roles are still refused for system families
// ---------------------------------------------------------------------------

describe('DELETE /api/document-link-families/:id — Koveo system family refusal (non-super)', () => {
  beforeEach(() => {
    seedFamily(SYSTEM_FAMILY_ID, true, null);
  });

  for (const role of ['admin', 'manager', 'demo_manager'] as const) {
    it(`returns 403 with the shared refusal message for role=${role}`, async () => {
      const res = await request(app)
        .delete(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
        .set('x-test-role', role);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'System document link families cannot be deleted',
      });

      expect(familyStore.has(SYSTEM_FAMILY_ID)).toBe(true);
      expect(deletedFamilyIds).not.toContain(SYSTEM_FAMILY_ID);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  }

  it('the system row is still present after every refused non-super call', async () => {
    for (const role of ['admin', 'manager', 'demo_manager'] as const) {
      await request(app)
        .delete(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
        .set('x-test-role', role);
    }
    expect(familyStore.has(SYSTEM_FAMILY_ID)).toBe(true);
    expect(deletedFamilyIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DELETE — custom (non-system) family paths preserved
// ---------------------------------------------------------------------------

describe('DELETE /api/document-link-families/:id — non-system family path is preserved', () => {
  it('admin successfully deletes a custom family in the caller\'s org', async () => {
    seedFamily(CUSTOM_FAMILY_ID, false, ORG_ID);

    const res = await request(app)
      .delete(`/api/document-link-families/${CUSTOM_FAMILY_ID}`)
      .set('x-test-role', 'admin');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(familyStore.has(CUSTOM_FAMILY_ID)).toBe(false);
    expect(deletedFamilyIds).toContain(CUSTOM_FAMILY_ID);
  });

  it('manager gets 403 "Access denied" for a custom family in another org', async () => {
    seedFamily(OUT_OF_SCOPE_FAMILY_ID, false, 'org-other');

    const res = await request(app)
      .delete(`/api/document-link-families/${OUT_OF_SCOPE_FAMILY_ID}`)
      .set('x-test-role', 'manager');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Access denied' });
    expect(familyStore.has(OUT_OF_SCOPE_FAMILY_ID)).toBe(true);
    expect(deletedFamilyIds).not.toContain(OUT_OF_SCOPE_FAMILY_ID);
  });

  it('returns 404 when the family id does not exist', async () => {
    const res = await request(app)
      .delete(`/api/document-link-families/${GHOST_FAMILY_ID}`)
      .set('x-test-role', 'admin');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Family not found' });
  });
});

// ---------------------------------------------------------------------------
// POST — super_admin creates a Koveo system family
// ---------------------------------------------------------------------------

describe('POST /api/document-link-families — super_admin creates system family', () => {
  it('returns 201 with isSystem=true, source=koveo, organizationId=null', async () => {
    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'New Koveo Family', description: 'A seeded family', isSystem: true });

    expect(res.status).toBe(201);
    expect(res.body.isSystem).toBe(true);
    expect(res.body.source).toBe('koveo');
    expect(res.body.organizationId).toBeNull();
  });

  it('persists the insert call with correct values', async () => {
    await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'Koveo Seeded', isSystem: true });

    expect(insertedFamilies).toHaveLength(1);
    expect(insertedFamilies[0].isSystem).toBe(true);
    expect(insertedFamilies[0].source).toBe('koveo');
    expect(insertedFamilies[0].organizationId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST — super_admin creates non-system family for an org they don't belong to
// ---------------------------------------------------------------------------

describe('POST /api/document-link-families — super_admin creates non-system family for any org', () => {
  it('returns 201 when an explicit organizationId outside their memberships is supplied', async () => {
    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'super_admin')
      .send({ name: 'Org Family', isSystem: false, organizationId: 'org-other' });

    expect(res.status).toBe(201);
    expect(res.body.isSystem).toBe(false);
    expect(res.body.organizationId).toBe('org-other');
  });
});

// ---------------------------------------------------------------------------
// POST — regular admin is still refused for isSystem:true
// ---------------------------------------------------------------------------

describe('POST /api/document-link-families — admin cannot create system family', () => {
  it('returns 403 with the right message', async () => {
    const res = await request(app)
      .post('/api/document-link-families')
      .set('x-test-role', 'admin')
      .send({ name: 'Sneaky System Family', isSystem: true });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: 'Only super admins can create Koveo system families',
    });
    expect(insertedFamilies).toHaveLength(0);
  });
});
