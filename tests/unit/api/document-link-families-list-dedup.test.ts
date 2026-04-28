/**
 * @jest-environment node
 *
 * Task #1643 — GET /api/document-link-families dedup regression test.
 *
 * The list endpoint is supposed to strip non-canonical duplicates from
 * the response so the UI never shows two cards for "Financial" /
 * "financial" / "  FINANCIAL  ". The dedup pass uses
 * `buildCanonicalResult` from the canonical-family-resolver service,
 * which picks the system family first, then the oldest createdAt, then
 * lexicographic id.
 *
 * This test seeds the mock DB with a mix of duplicate-name rows
 * (system + org-scoped collisions, plus a same-tier oldest-wins case)
 * and pins the response to contain exactly the canonical winners.
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

const familyStore: Family[] = [];

function seedFamily(opts: Partial<Family> & { id: string; name: string }): Family {
  const fam: Family = {
    isSystem: false,
    organizationId: null,
    description: null,
    source: opts.isSystem ? 'koveo' : opts.organizationId ?? null,
    createdAt: opts.createdAt ?? new Date('2025-01-01'),
    updatedAt: opts.updatedAt ?? new Date('2025-01-01'),
    ...opts,
  };
  familyStore.push(fam);
  return fam;
}

// ---------------------------------------------------------------------------
// Mock DB — only the GET handler path is exercised here; the admin role
// branch hits `db.select().from(documentLinkFamilies)` with no `where`.
// ---------------------------------------------------------------------------

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn(() => {
      // The chain may end here (admin path) or with .where(...) (non-admin).
      const tail: any = {
        where: jest.fn(() => Promise.resolve([...familyStore])),
        then: (resolve: (v: Family[]) => void) => resolve([...familyStore]),
      };
      // Make the bare `await db.select().from(table)` resolve to the rows.
      return new Proxy(tail, {
        get(target, prop) {
          if (prop === 'then') {
            return (resolve: (v: Family[]) => void) => resolve([...familyStore]);
          }
          return (target as any)[prop];
        },
      });
    }),
  })),
  insert: jest.fn(() => ({ values: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([])) })) })),
  update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning: jest.fn(() => Promise.resolve([])) })) })) })),
  delete: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })),
};

jest.mock('../../../server/db', () => ({ db: mockDb }));

// ---------------------------------------------------------------------------
// Auth — caller is an admin so the GET handler skips org filtering and
// returns every row in the store before applying canonical dedup.
// ---------------------------------------------------------------------------

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-admin', role: 'admin' };
    next();
  },
  requireRole: (_roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../../server/storage', () => ({
  storage: {
    getUserOrganizations: jest.fn(async () => []),
  },
}));

const makeTable = (tableName: string, cols: Record<string, unknown> = {}) => ({
  _: { name: tableName },
  ...cols,
});

jest.mock('../../../shared/schemas/documents', () => ({
  documentLinkFamilies: makeTable('document_link_families', {
    id: { name: 'id' },
    isSystem: { name: 'isSystem' },
    organizationId: { name: 'organizationId' },
    name: { name: 'name' },
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

let app: Express;

beforeEach(() => {
  familyStore.length = 0;
  jest.clearAllMocks();

  app = express();
  app.use(express.json());
  registerDocumentLinkFamilyRoutes(app);
});

describe('GET /api/document-link-families — duplicate-name dedup', () => {
  it('collapses case- and whitespace-only duplicates to a single canonical row', async () => {
    seedFamily({ id: 'org-old', name: 'Financial', organizationId: 'org-1', createdAt: new Date('2024-01-01') });
    seedFamily({ id: 'org-mid', name: '  financial ', organizationId: 'org-1', createdAt: new Date('2024-02-01') });
    seedFamily({ id: 'org-new', name: 'FINANCIAL', organizationId: 'org-1', createdAt: new Date('2024-03-01') });

    const res = await request(app).get('/api/document-link-families');
    expect(res.status).toBe(200);
    const ids = (res.body.families as { id: string }[]).map((f) => f.id);
    expect(ids).toEqual(['org-old']);
  });

  it('prefers the system row over an org-scoped row with the same normalized name', async () => {
    seedFamily({ id: 'org-old', name: 'AGA', organizationId: 'org-1', isSystem: false, createdAt: new Date('2024-01-01') });
    seedFamily({ id: 'sys-new', name: 'aga', organizationId: null, isSystem: true, createdAt: new Date('2024-06-01') });

    const res = await request(app).get('/api/document-link-families');
    expect(res.status).toBe(200);
    const ids = (res.body.families as { id: string }[]).map((f) => f.id);
    expect(ids).toEqual(['sys-new']);
  });

  it('returns all rows untouched when there are no normalized-name collisions', async () => {
    seedFamily({ id: 'a', name: 'Alpha', organizationId: 'org-1', createdAt: new Date('2024-01-01') });
    seedFamily({ id: 'b', name: 'Bravo', organizationId: 'org-1', createdAt: new Date('2024-01-02') });
    seedFamily({ id: 'c', name: 'Charlie', isSystem: true, organizationId: null, createdAt: new Date('2024-01-03') });

    const res = await request(app).get('/api/document-link-families');
    expect(res.status).toBe(200);
    const ids = (res.body.families as { id: string }[]).map((f) => f.id);
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('mixes both rules: system wins one collision, oldest-createdAt wins another, both in one response', async () => {
    seedFamily({ id: 'org-aga', name: 'AGA', organizationId: 'org-1', createdAt: new Date('2024-01-01') });
    seedFamily({ id: 'sys-aga', name: 'aga', organizationId: null, isSystem: true, createdAt: new Date('2024-06-01') });
    seedFamily({ id: 'org-fin-old', name: 'Financial', organizationId: 'org-1', createdAt: new Date('2024-01-01') });
    seedFamily({ id: 'org-fin-new', name: 'financial', organizationId: 'org-1', createdAt: new Date('2024-05-01') });

    const res = await request(app).get('/api/document-link-families');
    expect(res.status).toBe(200);
    const ids = (res.body.families as { id: string }[]).map((f) => f.id);
    expect(new Set(ids)).toEqual(new Set(['sys-aga', 'org-fin-old']));
  });
});
