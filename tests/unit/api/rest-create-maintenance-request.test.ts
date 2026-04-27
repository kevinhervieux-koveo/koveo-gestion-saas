/**
 * Resident maintenance request REST endpoint — Task #1277 / #1314.
 *
 * Walks the contract documented on `server/api/auto/maintenance-requests.ts`:
 *   - 400 when `category` is not one of `MAINTENANCE_CATEGORY_VALUES`
 *     (the same enum the MCP `create_maintenance_request` tool and the DB
 *     CHECK constraint enforce — keeps every surface in sync), and
 *   - 201 + the inserted row when a tenant linked to the residence submits
 *     a valid request,
 *   - 403 when the caller cannot access the residence,
 *   - 400 when the images array exceeds count or per-image size limits.
 *
 * Task #1314: persistence is now routed through
 * `storage.createMaintenanceRequest()` so the storage layer (cache
 * invalidation, MemStorage in tests) stays consistent with manager-side flows.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';

jest.mock('drizzle-orm', () => require('../../manual-mocks/drizzle-orm'));
jest.mock('drizzle-orm/pg-core', () => require('../../manual-mocks/drizzle-orm/pg-core'));

// ── Storage mock ────────────────────────────────────────────────────────────
// The endpoint now routes through storage.createMaintenanceRequest() rather
// than db.insert() directly, so mock the storage module.
let storageCreateCallCount = 0;
let lastStorageCreateArgs: any = null;
let storageCreateShouldThrow = false;

const mockStorage = {
  createMaintenanceRequest: jest.fn(async (data: any) => {
    storageCreateCallCount++;
    lastStorageCreateArgs = data;
    if (storageCreateShouldThrow) throw new Error('DB error');
    return {
      id: 'mr-1',
      ...data,
      status: 'submitted',
      assignedTo: null,
      estimatedCost: null,
      actualCost: null,
      scheduledDate: null,
      completedDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }),
};

jest.mock('../../../server/storage', () => ({
  storage: mockStorage,
}));

// ── Auth mock ───────────────────────────────────────────────────────────────
let currentTestUser: any = null;
const mockRequireAuth = (req: any, _res: any, next: any) => {
  req.user = currentTestUser;
  next();
};
jest.mock('../../../server/auth', () => ({
  requireAuth: mockRequireAuth,
}));
jest.mock('../../../server/auth/index', () => ({
  requireAuth: mockRequireAuth,
}));
jest.mock(
  require('path').resolve(__dirname, '../../../server/auth.ts'),
  () => ({ requireAuth: mockRequireAuth }),
);

// ── RBAC mock ────────────────────────────────────────────────────────────────
let canAccess = true;
jest.mock('../../../server/rbac', () => ({
  canUserAccessResidence: jest.fn(async () => canAccess),
}));

import register from '../../../server/api/auto/maintenance-requests';

function buildApp(user: any): Express {
  currentTestUser = user;
  const app = express();
  // Use a generous body limit so Zod's per-image constraint (not the body
  // parser) is what enforces the image size cap in the validation tests.
  app.use(express.json({ limit: '50mb' }));
  register(app);
  return app;
}

const VALID_RESIDENCE_ID = '11111111-1111-4111-8111-111111111111';

describe('POST /api/maintenance-requests', () => {
  beforeEach(() => {
    storageCreateCallCount = 0;
    lastStorageCreateArgs = null;
    storageCreateShouldThrow = false;
    canAccess = true;
    mockStorage.createMaintenanceRequest.mockClear();
  });

  it('rejects an invalid category with 400 and never calls storage', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'not_a_real_category',
        priority: 'medium',
      })
      .expect(400);

    expect(response.body.message).toBe('Invalid maintenance request');
    expect(response.body.errors).toBeDefined();
    expect(storageCreateCallCount).toBe(0);
  });

  it('returns 201 with the new row when a linked tenant submits a valid request', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'plumbing',
        priority: 'high',
      })
      .expect(201);

    expect(storageCreateCallCount).toBe(1);
    expect(lastStorageCreateArgs).toMatchObject({
      residenceId: VALID_RESIDENCE_ID,
      title: 'Leaky faucet',
      description: 'Kitchen tap drips constantly',
      category: 'plumbing',
      priority: 'high',
      submittedBy: 'u-tenant',
    });
    expect(response.body).toMatchObject({
      id: 'mr-1',
      residenceId: VALID_RESIDENCE_ID,
      category: 'plumbing',
      status: 'submitted',
    });
  });

  it('rejects an invalid priority with 400 and never calls storage', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'plumbing',
        priority: 'super_critical',
      })
      .expect(400);

    expect(response.body.message).toBe('Invalid maintenance request');
    expect(response.body.errors).toBeDefined();
    expect(storageCreateCallCount).toBe(0);
  });

  it('returns 403 when the caller cannot access the residence (residence-scope guard)', async () => {
    canAccess = false;
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Leaky faucet',
        description: 'Kitchen tap drips constantly',
        category: 'plumbing',
      })
      .expect(403);

    expect(response.body.code).toBe('RESIDENCE_ACCESS_DENIED');
    expect(storageCreateCallCount).toBe(0);
  });

  it('accepts a request with a valid photo attachment and forwards images to storage', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });
    const fakeImage = 'data:image/jpeg;base64,/9j/fakebase64data';

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Crack in ceiling',
        description: 'Large crack appeared after the storm',
        category: 'general',
        priority: 'high',
        images: [fakeImage],
      })
      .expect(201);

    expect(storageCreateCallCount).toBe(1);
    expect(lastStorageCreateArgs.images).toEqual([fakeImage]);
    expect(response.body.status).toBe('submitted');
  });

  it('rejects when more than 3 images are provided', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });
    const tooManyImages = ['img1', 'img2', 'img3', 'img4'];

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Crack in ceiling',
        description: 'Large crack appeared after the storm',
        category: 'general',
        priority: 'medium',
        images: tooManyImages,
      })
      .expect(400);

    expect(response.body.message).toBe('Invalid maintenance request');
    expect(storageCreateCallCount).toBe(0);
  });

  it('rejects when a single image string exceeds the size limit', async () => {
    const app = buildApp({ id: 'u-tenant', role: 'tenant' });
    // 14_000_001 characters is over the 14_000_000 limit
    const oversizedImage = 'x'.repeat(14_000_001);

    const response = await request(app)
      .post('/api/maintenance-requests')
      .send({
        residenceId: VALID_RESIDENCE_ID,
        title: 'Crack in ceiling',
        description: 'Large crack appeared after the storm',
        category: 'general',
        priority: 'medium',
        images: [oversizedImage],
      })
      .expect(400);

    expect(response.body.message).toBe('Invalid maintenance request');
    expect(storageCreateCallCount).toBe(0);
  });
});
