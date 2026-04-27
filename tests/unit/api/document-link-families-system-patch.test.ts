/**
 * @jest-environment node
 *
 * Task #1436 — Stop admins from editing Koveo system link family names
 * through the web.
 *
 * Task #1430 closed the deletion gap on
 * `DELETE /api/document-link-families/:id`. The matching PATCH handler
 * still allowed `admin`-role users to rename or change the description
 * of a Koveo system link family. The MCP layer treats system families
 * as fully read-only — this test pins the REST surface to the same
 * behavior:
 *
 *   - PATCH returns 403 with the shared
 *     `refuseIfKoveoSystemLinkFamilyUpdate` message
 *     ("System document link families cannot be modified") for every
 *     role that can reach the handler — `super_admin`, `admin`,
 *     `manager`, `demo_manager` — when the family is a system family
 *     (isSystem = true, organizationId = null).
 *   - The system family row is NOT mutated in any of those refused
 *     cases (no `db.update` call is made).
 *   - PATCH still works for a non-system family in the caller's org.
 *   - PATCH still returns 404 when the family id does not exist.
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
const updatedFamilyIds: string[] = [];

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

  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve()),
  })),

  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn(() => Promise.resolve([])),
    })),
  })),

  update: jest.fn((_table: any) => ({
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
// Storage mock — only getUserOrganizations is exercised by the PATCH handler
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
  updatedFamilyIds.length = 0;
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  registerDocumentLinkFamilyRoutes(app);
});

// ---------------------------------------------------------------------------
// PATCH — system family refusal across every reachable role
// ---------------------------------------------------------------------------

describe('PATCH /api/document-link-families/:id — Koveo system family refusal', () => {
  beforeEach(() => {
    seedFamily(SYSTEM_FAMILY_ID, true, null);
  });

  for (const role of ['super_admin', 'admin', 'manager', 'demo_manager'] as const) {
    it(`returns 403 with the shared refusal message for role=${role}`, async () => {
      const res = await request(app)
        .patch(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
        .set('x-test-role', role)
        .send({ name: 'Renamed by admin', description: 'tampered' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'System document link families cannot be modified',
      });

      // Row must still be untouched; mockDb.update must not have been called.
      const stored = familyStore.get(SYSTEM_FAMILY_ID)!;
      expect(stored.name).toBe(`Family ${SYSTEM_FAMILY_ID}`);
      expect(stored.description).toBeNull();
      expect(updatedFamilyIds).not.toContain(SYSTEM_FAMILY_ID);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  }

  it('the system row is unchanged after every refused call', async () => {
    for (const role of ['super_admin', 'admin', 'manager', 'demo_manager'] as const) {
      await request(app)
        .patch(`/api/document-link-families/${SYSTEM_FAMILY_ID}`)
        .set('x-test-role', role)
        .send({ name: `renamed-by-${role}` });
    }
    const stored = familyStore.get(SYSTEM_FAMILY_ID)!;
    expect(stored.name).toBe(`Family ${SYSTEM_FAMILY_ID}`);
    expect(updatedFamilyIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// PATCH — custom (non-system) family happy path is preserved
// ---------------------------------------------------------------------------

describe('PATCH /api/document-link-families/:id — non-system family path is preserved', () => {
  it('admin successfully renames a custom family in the caller\'s org', async () => {
    seedFamily(CUSTOM_FAMILY_ID, false, ORG_ID);

    const res = await request(app)
      .patch(`/api/document-link-families/${CUSTOM_FAMILY_ID}`)
      .set('x-test-role', 'admin')
      .send({ name: 'New name', description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New name');
    expect(res.body.description).toBe('Updated description');
    expect(familyStore.get(CUSTOM_FAMILY_ID)!.name).toBe('New name');
    expect(updatedFamilyIds).toContain(CUSTOM_FAMILY_ID);
  });

  it('manager gets 403 "Access denied" for a custom family in another org', async () => {
    seedFamily(OUT_OF_SCOPE_FAMILY_ID, false, 'org-other');

    const res = await request(app)
      .patch(`/api/document-link-families/${OUT_OF_SCOPE_FAMILY_ID}`)
      .set('x-test-role', 'manager')
      .send({ name: 'Renamed' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Access denied' });
    expect(familyStore.get(OUT_OF_SCOPE_FAMILY_ID)!.name).toBe(
      `Family ${OUT_OF_SCOPE_FAMILY_ID}`,
    );
    expect(updatedFamilyIds).not.toContain(OUT_OF_SCOPE_FAMILY_ID);
  });

  it('returns 404 when the family id does not exist', async () => {
    const res = await request(app)
      .patch(`/api/document-link-families/${GHOST_FAMILY_ID}`)
      .set('x-test-role', 'admin')
      .send({ name: 'Renamed' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Family not found' });
  });
});
