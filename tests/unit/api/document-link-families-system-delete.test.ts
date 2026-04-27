/**
 * @jest-environment node
 *
 * Task #1430 — Prevent system link families from being deleted by admin
 * users through the REST web interface.
 *
 * The MCP layer (Task #1428) already refuses to delete document link
 * families where `isSystem = true`. Task #1428 explicitly excluded the
 * REST surface, leaving `DELETE /api/document-link-families/:id` open
 * for `admin` callers. This file pins the closed behavior:
 *
 *   - DELETE returns 403 with the shared
 *     `refuseIfKoveoSystemLinkFamily` message for every role that can
 *     reach the handler — `super_admin`, `admin`, `manager`,
 *     `demo_manager` — when the family is a system family
 *     (isSystem = true, organizationId = null).
 *   - The system family row is NOT deleted from the database in any of
 *     those refused cases.
 *   - DELETE still works for a non-system family in the caller's org.
 *   - DELETE still returns 404 when the family id does not exist.
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
// Mock DB — only the operations the route handlers use
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

  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([])),
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
// Auth middleware — replace the default __mocks__ pass-through with one that
// sets req.user from a header so each test can vary the caller's role.
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
// Storage mock — only getUserOrganizations is exercised by the DELETE handler
// (and only on the non-system path).
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';

jest.mock('../../../server/storage', () => ({
  storage: {
    getUserOrganizations: jest.fn(async () => [{ organizationId: ORG_ID }]),
  },
}));

// ---------------------------------------------------------------------------
// Schema — minimal shape sufficient for `eq(documentLinkFamilies.id, id)`.
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

// Logger — keep the test output clean.
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
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  registerDocumentLinkFamilyRoutes(app);
});

// ---------------------------------------------------------------------------
// DELETE — system family refusal across every reachable role
// ---------------------------------------------------------------------------

describe('DELETE /api/document-link-families/:id — Koveo system family refusal', () => {
  beforeEach(() => {
    seedFamily(SYSTEM_FAMILY_ID, true, null);
  });

  for (const role of ['super_admin', 'admin', 'manager', 'demo_manager'] as const) {
    it(`returns 403 with the shared refusal message for role=${role}`, async () => {
      const res = await request(app)
        .delete(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
        .set('x-test-role', role);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'System document link families cannot be deleted',
      });

      // Row must still be in the database; mockDb.delete must not have been
      // called against it.
      expect(familyStore.has(SYSTEM_FAMILY_ID)).toBe(true);
      expect(deletedFamilyIds).not.toContain(SYSTEM_FAMILY_ID);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  }

  it('the system row is still present after every refused call', async () => {
    for (const role of ['super_admin', 'admin', 'manager', 'demo_manager'] as const) {
      await request(app)
        .delete(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
        .set('x-test-role', role);
    }
    expect(familyStore.has(SYSTEM_FAMILY_ID)).toBe(true);
    expect(deletedFamilyIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DELETE — custom (non-system) family happy path is preserved
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
