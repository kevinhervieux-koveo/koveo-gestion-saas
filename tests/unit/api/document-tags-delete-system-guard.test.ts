/**
 * Task #1431 / Task #1445 — System-entity guard for Koveo system tags on
 * the REST `DELETE /api/document-tags/:id` surface used by the admin web UI.
 *
 * The MCP `delete_document_tag` tool stays role-agnostic and refuses every
 * caller (Task #1428). The REST surface used by the admin UI now carves out
 * `super_admin` so super admins can curate the system tag list from the
 * admin document-tags page (Task #1445), mirroring the system link family
 * carve-out from Task #1440.
 *
 *   - Returns 403 with "System tags cannot be deleted" for every NON-super
 *     role that reaches the handler (admin, manager, demo_manager) when
 *     the target tag has `isSystem = true`. The row is NOT deleted.
 *   - super_admin CAN delete a Koveo system tag via this REST handler
 *     (Task #1445). The MCP guard remains intentionally unchanged.
 *   - The system-tag refusal happens BEFORE the per-org access check, so
 *     a manager who otherwise wouldn't own the tag still gets the system
 *     refusal first — matching the MCP behaviour.
 *   - The refusal message is sourced from the shared
 *     `SYSTEM_TAG_DELETE_REFUSAL_MESSAGE` constant in
 *     `server/mcp/system-entity-guards.ts`, so MCP and REST stay in sync.
 *   - Custom (non-system) tags can still be deleted by an admin.
 *   - Returns 404 for a tag that does not exist (regression — the system
 *     check must not fire when the row is missing).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () =>
  require('../../manual-mocks/drizzle-orm/pg-core'),
);

// ---------------------------------------------------------------------------
// In-memory tag store
// ---------------------------------------------------------------------------

type Tag = {
  id: string;
  isSystem: boolean;
  organizationId: string | null;
  name: string;
};

const tagStore = new Map<string, Tag>();
const deletedTagIds: string[] = [];

function seedTag(
  id: string,
  isSystem: boolean,
  organizationId: string | null = null,
): Tag {
  const tag: Tag = { id, isSystem, organizationId, name: `Tag ${id}` };
  tagStore.set(id, tag);
  return tag;
}

function condEqValue(cond: any): unknown {
  if (!cond) return undefined;
  if (cond.type === 'condition' && cond.operator === 'eq') return cond.value;
  if ('value' in (cond ?? {})) return cond.value;
  return undefined;
}

// ---------------------------------------------------------------------------
// Mock DB — only the select-by-id and delete-by-id paths are exercised by
// the DELETE handler.
// ---------------------------------------------------------------------------

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn((_table: any) => ({
      where: jest.fn((cond: any) => {
        const id = condEqValue(cond) as string | undefined;
        const row = id ? tagStore.get(id) : undefined;
        return Promise.resolve(row ? [row] : []);
      }),
    })),
  })),

  delete: jest.fn((_table: any) => ({
    where: jest.fn((cond: any) => {
      const id = condEqValue(cond) as string | undefined;
      if (id && tagStore.has(id)) {
        deletedTagIds.push(id);
        tagStore.delete(id);
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
// Auth mock — every test sets `currentTestUser` before issuing a request so
// the requireAuth middleware injects the right principal.
// ---------------------------------------------------------------------------

let currentTestUser: { id: string; role: string } | null = null;

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = currentTestUser;
    next();
  },
  // requireRole is permissive in tests — the production middleware would
  // gate by role, but we pin the system-tag invariant for every allowed
  // role (admin, manager, demo_manager) explicitly via individual tests.
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

// ---------------------------------------------------------------------------
// Storage mock — getUserOrganizations is used by the per-org access check
// for non-admin roles. Admins bypass this code path entirely.
// ---------------------------------------------------------------------------

let userOrgIds: string[] = [];

jest.mock('../../../server/storage', () => ({
  storage: {
    getUserOrganizations: jest.fn(async () =>
      userOrgIds.map((organizationId) => ({ organizationId })),
    ),
  },
}));

jest.mock('../../../server/utils/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
  logWarn: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

import { registerDocumentTagRoutes } from '../../../server/api/document-tags';
import { SYSTEM_TAG_DELETE_REFUSAL_MESSAGE } from '../../../server/mcp/system-entity-guards';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  registerDocumentTagRoutes(app);
  return app;
}

const SYSTEM_TAG_ID = 'sys-tag-1';
const CUSTOM_TAG_ID = 'custom-tag-1';
const ORG_ID = 'org-1';

beforeEach(() => {
  tagStore.clear();
  deletedTagIds.length = 0;
  userOrgIds = [];
  currentTestUser = null;
  jest.clearAllMocks();
});

describe('DELETE /api/document-tags/:id — Koveo system tag refusal (Task #1431 / #1445)', () => {
  beforeEach(() => {
    seedTag(SYSTEM_TAG_ID, true, null);
  });

  for (const role of ['admin', 'manager', 'demo_manager'] as const) {
    it(`returns 403 with the shared refusal message for role=${role} and leaves the row in the database`, async () => {
      currentTestUser = { id: `user-${role}`, role };
      // The non-admin roles also belong to the org that owns the tag — this
      // proves the system-tag check fires BEFORE the per-org access check
      // for managers, and unconditionally for admins.
      userOrgIds = [ORG_ID];

      const res = await request(buildApp())
        .delete(`/api/document-tags/${SYSTEM_TAG_ID}`)
        .expect(403);

      expect(res.body).toEqual({ message: SYSTEM_TAG_DELETE_REFUSAL_MESSAGE });
      expect(res.body.message).toBe('System tags cannot be deleted');
      expect(tagStore.has(SYSTEM_TAG_ID)).toBe(true);
      expect(deletedTagIds).not.toContain(SYSTEM_TAG_ID);
    });
  }

  it('the row is still in the database after every refused call across non-super roles', async () => {
    for (const role of ['admin', 'manager', 'demo_manager'] as const) {
      currentTestUser = { id: `user-${role}`, role };
      userOrgIds = [ORG_ID];
      await request(buildApp())
        .delete(`/api/document-tags/${SYSTEM_TAG_ID}`)
        .expect(403);
    }
    expect(tagStore.has(SYSTEM_TAG_ID)).toBe(true);
    expect(deletedTagIds).toHaveLength(0);
  });

  it('the system-tag refusal precedes the per-org access check (manager outside the tag org still gets the system refusal)', async () => {
    currentTestUser = { id: 'mgr-1', role: 'manager' };
    // Manager is in a different org than the (org-less) system tag — without
    // the system-tag-first ordering they would get "Access denied" instead.
    userOrgIds = ['org-other'];

    const res = await request(buildApp())
      .delete(`/api/document-tags/${SYSTEM_TAG_ID}`)
      .expect(403);

    expect(res.body.message).toBe(SYSTEM_TAG_DELETE_REFUSAL_MESSAGE);
    expect(tagStore.has(SYSTEM_TAG_ID)).toBe(true);
  });

  // Task #1445 — super_admin is the single carve-out on the REST surface,
  // matching the system link family delete carve-out from Task #1440. The
  // MCP `delete_document_tag` tool stays role-agnostic (covered separately
  // in tests/unit/mcp/document-tags-system-guard.test.ts).
  it('super_admin can delete a Koveo system tag via the REST handler (Task #1445)', async () => {
    currentTestUser = { id: 'super-1', role: 'super_admin' };
    // System tags have no organizationId, and super_admin has no per-org
    // membership configured — proving the system check is bypassed AND
    // the per-org access check is not reached for super_admin.
    userOrgIds = [];

    const res = await request(buildApp())
      .delete(`/api/document-tags/${SYSTEM_TAG_ID}`)
      .expect(200);

    expect(res.body).toEqual({ success: true });
    expect(tagStore.has(SYSTEM_TAG_ID)).toBe(false);
    expect(deletedTagIds).toContain(SYSTEM_TAG_ID);
  });
});

describe('DELETE /api/document-tags/:id — non-system tag and not-found', () => {
  it('admin can still delete a custom (non-system) tag', async () => {
    seedTag(CUSTOM_TAG_ID, false, ORG_ID);
    currentTestUser = { id: 'admin-1', role: 'admin' };

    const res = await request(buildApp())
      .delete(`/api/document-tags/${CUSTOM_TAG_ID}`)
      .expect(200);

    expect(res.body).toEqual({ success: true });
    expect(tagStore.has(CUSTOM_TAG_ID)).toBe(false);
    expect(deletedTagIds).toContain(CUSTOM_TAG_ID);
  });

  it('returns 404 when the tag does not exist (system check does not fire on a missing row)', async () => {
    currentTestUser = { id: 'admin-1', role: 'admin' };

    const res = await request(buildApp())
      .delete('/api/document-tags/ghost-tag-id')
      .expect(404);

    expect(res.body).toEqual({ message: 'Tag not found' });
  });
});
