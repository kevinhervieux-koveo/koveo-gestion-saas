/**
 * @jest-environment node
 *
 * Task #1418 — super-admin-only Koveo system tags & families.
 *
 * Verifies:
 *   - super_admin CAN create / update / delete Koveo system tags and families.
 *   - admin and manager are 403'd when attempting the same on system resources.
 *   - Non-system (org-scoped) tags and families remain accessible to admin,
 *     manager, and demo_manager exactly as before (regression).
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ─── DB mock queues (populated per-test) ─────────────────────────────────────
const selectQueue: unknown[][] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];

function makeSelectChain() {
  const result = (): Promise<unknown[]> => Promise.resolve(selectQueue.shift() ?? []);
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = result;
  chain.orderBy = () => chain;
  chain.limit = result;
  (chain as { then: (cb: (v: unknown[]) => unknown) => Promise<unknown> }).then = (cb) =>
    result().then(cb);
  return chain;
}

jest.mock('../../../server/db', () => ({
  db: {
    select: jest.fn(() => makeSelectChain()),
    insert: jest.fn(() => ({
      values: () => ({
        returning: () => Promise.resolve(insertResult),
      }),
    })),
    update: jest.fn(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(updateResult),
        }),
      }),
    })),
    delete: jest.fn(() => ({
      where: () => Promise.resolve([]),
    })),
  },
  pool: {},
  sql: jest.fn(),
}));

jest.mock('../../../server/config/index', () => ({
  config: {
    rateLimit: { windowMs: 60000 },
    server: { isProduction: false, domain: 'localhost' },
    session: { secret: 'test-secret', cookie: {} },
  },
}));

// Use '../storage' to match the moduleNameMapper rule ('^\.\.\/storage') that
// maps this path (as used by server/api/ route files) to __mocks__/server/storage.ts.
jest.mock('../storage', () => ({
  storage: {
    getUserOrganizations: jest.fn(() =>
      Promise.resolve([{ organizationId: 'org-1' }]),
    ),
  },
}));

jest.mock('../../../server/utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

jest.mock('../../../server/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    next();
  },
  requireRole: (allowedRoles: string[]) => (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const isAuthorized =
      req.user.role === 'super_admin' || allowedRoles.includes(req.user.role);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  },
}));

// ─── Shared fixture records ───────────────────────────────────────────────────

const SYSTEM_TAG = {
  id: 'tag-system-1',
  name: 'Koveo Tag',
  isSystem: true,
  organizationId: null,
  scope: 'any',
  importance: 'nice_to_have',
  suggestedProfessionals: [],
};

const ORG_TAG = {
  id: 'tag-org-1',
  name: 'Custom Tag',
  isSystem: false,
  organizationId: 'org-1',
  scope: 'any',
  importance: 'nice_to_have',
  suggestedProfessionals: [],
};

const SYSTEM_FAMILY = {
  id: 'fam-system-1',
  name: 'Koveo Family',
  isSystem: true,
  organizationId: null,
  description: null,
};

const ORG_FAMILY = {
  id: 'fam-org-1',
  name: 'Custom Family',
  isSystem: false,
  organizationId: 'org-1',
  description: null,
};

// ─── App builder ─────────────────────────────────────────────────────────────

import { registerDocumentTagRoutes } from '../../../server/api/document-tags';
import { registerDocumentLinkFamilyRoutes } from '../../../server/api/document-link-families';

function makeAuth(role: string) {
  return (req: any, _res: any, next: any) => {
    req.user = { id: `user-${role}`, role, email: `${role}@test.com` };
    next();
  };
}

function buildApp(role: string) {
  const app = express();
  app.use(express.json());
  app.use(makeAuth(role));
  registerDocumentTagRoutes(app);
  registerDocumentLinkFamilyRoutes(app);
  return app;
}

beforeEach(() => {
  selectQueue.length = 0;
  insertResult = [];
  updateResult = [];
});

// ─── POST /api/document-tags ──────────────────────────────────────────────────

describe('POST /api/document-tags — isSystem flag', () => {
  it('super_admin can create a system tag (201)', async () => {
    insertResult = [SYSTEM_TAG];
    const res = await request(buildApp('super_admin'))
      .post('/api/document-tags')
      .send({ name: 'Koveo Tag', scope: 'any', importance: 'nice_to_have', isSystem: true });
    expect(res.status).toBe(201);
  });

  it('admin gets 403 when trying to create a system tag', async () => {
    const res = await request(buildApp('admin'))
      .post('/api/document-tags')
      .send({ name: 'Koveo Tag', scope: 'any', importance: 'nice_to_have', isSystem: true });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('manager gets 403 when trying to create a system tag', async () => {
    const res = await request(buildApp('manager'))
      .post('/api/document-tags')
      .send({ name: 'Koveo Tag', scope: 'any', importance: 'nice_to_have', isSystem: true });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('admin can still create a non-system tag (201)', async () => {
    insertResult = [ORG_TAG];
    const res = await request(buildApp('admin'))
      .post('/api/document-tags')
      .send({
        name: 'Custom Tag',
        scope: 'any',
        importance: 'nice_to_have',
        isSystem: false,
        organizationId: 'org-1',
      });
    expect(res.status).toBe(201);
  });

  it('manager can still create a non-system tag (201)', async () => {
    insertResult = [ORG_TAG];
    const res = await request(buildApp('manager'))
      .post('/api/document-tags')
      .send({
        name: 'Custom Tag',
        scope: 'any',
        importance: 'nice_to_have',
        isSystem: false,
        organizationId: 'org-1',
      });
    expect(res.status).toBe(201);
  });

  it('demo_manager can still create a non-system tag (201)', async () => {
    insertResult = [ORG_TAG];
    const res = await request(buildApp('demo_manager'))
      .post('/api/document-tags')
      .send({
        name: 'Custom Tag',
        scope: 'any',
        importance: 'nice_to_have',
        isSystem: false,
        organizationId: 'org-1',
      });
    expect(res.status).toBe(201);
  });
});

// ─── PATCH /api/document-tags/:id ────────────────────────────────────────────

describe('PATCH /api/document-tags/:id — system tag protection', () => {
  it('super_admin can update a system tag (200)', async () => {
    selectQueue.push([SYSTEM_TAG]);
    updateResult = [{ ...SYSTEM_TAG, name: 'Updated' }];
    const res = await request(buildApp('super_admin'))
      .patch('/api/document-tags/tag-system-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('admin gets 403 when trying to update a system tag', async () => {
    selectQueue.push([SYSTEM_TAG]);
    const res = await request(buildApp('admin'))
      .patch('/api/document-tags/tag-system-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('manager gets 403 when trying to update a system tag', async () => {
    selectQueue.push([SYSTEM_TAG]);
    const res = await request(buildApp('manager'))
      .patch('/api/document-tags/tag-system-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('admin can still update a non-system tag from their org (200)', async () => {
    selectQueue.push([ORG_TAG]);
    updateResult = [{ ...ORG_TAG, name: 'Updated' }];
    const res = await request(buildApp('admin'))
      .patch('/api/document-tags/tag-org-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('manager can still update a non-system tag from their org (200)', async () => {
    selectQueue.push([ORG_TAG]);
    updateResult = [{ ...ORG_TAG, name: 'Updated' }];
    const res = await request(buildApp('manager'))
      .patch('/api/document-tags/tag-org-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/document-tags/:id ───────────────────────────────────────────

describe('DELETE /api/document-tags/:id — system tag protection', () => {
  it('super_admin gets 403 when trying to delete a system tag (tags are locked for all roles)', async () => {
    selectQueue.push([SYSTEM_TAG]);
    const res = await request(buildApp('super_admin'))
      .delete('/api/document-tags/tag-system-1');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('System tags cannot be deleted');
  });

  it('admin gets 403 when trying to delete a system tag', async () => {
    selectQueue.push([SYSTEM_TAG]);
    const res = await request(buildApp('admin'))
      .delete('/api/document-tags/tag-system-1');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('System tags cannot be deleted');
  });

  it('manager gets 403 when trying to delete a system tag', async () => {
    selectQueue.push([SYSTEM_TAG]);
    const res = await request(buildApp('manager'))
      .delete('/api/document-tags/tag-system-1');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('System tags cannot be deleted');
  });

  it('admin can still delete a non-system tag from their org (200)', async () => {
    selectQueue.push([ORG_TAG]);
    const res = await request(buildApp('admin'))
      .delete('/api/document-tags/tag-org-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('manager can still delete a non-system tag from their org (200)', async () => {
    selectQueue.push([ORG_TAG]);
    const res = await request(buildApp('manager'))
      .delete('/api/document-tags/tag-org-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /api/document-link-families ────────────────────────────────────────

describe('POST /api/document-link-families — isSystem flag', () => {
  it('super_admin can create a system family (201)', async () => {
    insertResult = [SYSTEM_FAMILY];
    const res = await request(buildApp('super_admin'))
      .post('/api/document-link-families')
      .send({ name: 'Koveo Family', isSystem: true });
    expect(res.status).toBe(201);
  });

  it('admin gets 403 when trying to create a system family', async () => {
    const res = await request(buildApp('admin'))
      .post('/api/document-link-families')
      .send({ name: 'Koveo Family', isSystem: true });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('manager gets 403 when trying to create a system family', async () => {
    const res = await request(buildApp('manager'))
      .post('/api/document-link-families')
      .send({ name: 'Koveo Family', isSystem: true });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('admin can still create a non-system family (201)', async () => {
    insertResult = [ORG_FAMILY];
    const res = await request(buildApp('admin'))
      .post('/api/document-link-families')
      .send({ name: 'Custom Family', isSystem: false, organizationId: 'org-1' });
    expect(res.status).toBe(201);
  });

  it('manager can still create a non-system family (201)', async () => {
    insertResult = [ORG_FAMILY];
    const res = await request(buildApp('manager'))
      .post('/api/document-link-families')
      .send({ name: 'Custom Family', isSystem: false, organizationId: 'org-1' });
    expect(res.status).toBe(201);
  });

  it('demo_manager can still create a non-system family (201)', async () => {
    insertResult = [ORG_FAMILY];
    const res = await request(buildApp('demo_manager'))
      .post('/api/document-link-families')
      .send({ name: 'Custom Family', isSystem: false, organizationId: 'org-1' });
    expect(res.status).toBe(201);
  });
});

// ─── PATCH /api/document-link-families/:id ───────────────────────────────────

describe('PATCH /api/document-link-families/:id — system family protection', () => {
  it('super_admin can update a system family (200)', async () => {
    selectQueue.push([SYSTEM_FAMILY]);
    updateResult = [{ ...SYSTEM_FAMILY, name: 'Updated' }];
    const res = await request(buildApp('super_admin'))
      .patch('/api/document-link-families/fam-system-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('admin gets 403 when trying to update a system family', async () => {
    selectQueue.push([SYSTEM_FAMILY]);
    const res = await request(buildApp('admin'))
      .patch('/api/document-link-families/fam-system-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('manager gets 403 when trying to update a system family', async () => {
    selectQueue.push([SYSTEM_FAMILY]);
    const res = await request(buildApp('manager'))
      .patch('/api/document-link-families/fam-system-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/super admin/i);
  });

  it('admin can still update a non-system family from their org (200)', async () => {
    selectQueue.push([ORG_FAMILY]);
    updateResult = [{ ...ORG_FAMILY, name: 'Updated' }];
    const res = await request(buildApp('admin'))
      .patch('/api/document-link-families/fam-org-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('manager can still update a non-system family from their org (200)', async () => {
    selectQueue.push([ORG_FAMILY]);
    updateResult = [{ ...ORG_FAMILY, name: 'Updated' }];
    const res = await request(buildApp('manager'))
      .patch('/api/document-link-families/fam-org-1')
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/document-link-families/:id ──────────────────────────────────

describe('DELETE /api/document-link-families/:id — system family protection', () => {
  it('super_admin can delete a system family (200)', async () => {
    selectQueue.push([SYSTEM_FAMILY]);
    const res = await request(buildApp('super_admin'))
      .delete('/api/document-link-families/fam-system-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('admin gets 403 when trying to delete a system family', async () => {
    selectQueue.push([SYSTEM_FAMILY]);
    const res = await request(buildApp('admin'))
      .delete('/api/document-link-families/fam-system-1');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('System document link families cannot be deleted');
  });

  it('manager gets 403 when trying to delete a system family', async () => {
    selectQueue.push([SYSTEM_FAMILY]);
    const res = await request(buildApp('manager'))
      .delete('/api/document-link-families/fam-system-1');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('System document link families cannot be deleted');
  });

  it('admin can still delete a non-system family from their org (200)', async () => {
    selectQueue.push([ORG_FAMILY]);
    const res = await request(buildApp('admin'))
      .delete('/api/document-link-families/fam-org-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('manager can still delete a non-system family from their org (200)', async () => {
    selectQueue.push([ORG_FAMILY]);
    const res = await request(buildApp('manager'))
      .delete('/api/document-link-families/fam-org-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
