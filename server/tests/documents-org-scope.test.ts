import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  documents,
  users,
  userOrganizations,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from './test-app';

/**
 * Integration tests for org-scope enforcement on GET /api/documents.
 *
 * Mirrors `server/tests/common-spaces-org-scope.test.ts` (Task #1472) for
 * the documents flat-list endpoint (Task #1495). Verifies three guarantees:
 *   1. Malformed `organizationId` query param → 400 INVALID_ORGANIZATION_ID
 *   2. Valid UUID that the caller cannot access → 403 INSUFFICIENT_PERMISSIONS
 *   3. A manager scoped to org-A only receives documents from org-A's
 *      buildings, even when org-B documents exist in the DB.
 *
 * The caller used here is a `manager` (rather than `admin`) because the
 * documents handler's existing role-based filter restricts managers to
 * their own organizations' buildings — exactly the cross-org leak the test
 * is designed to detect. Admins follow a different code path that
 * intentionally widens scope to all buildings and is exercised by the
 * existing manager-only/visibility tests.
 *
 * Skipped when no real DATABASE_URL is available (unit-tier CI runs).
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('GET /api/documents — org-scope enforcement', () => {
  const app = createTestApp();

  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let document1Id: string;
  let document2Id: string;
  let managerUserId: string;

  const TIMESTAMP = Date.now();

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: `DocScope Test Org-A ${TIMESTAMP}`,
        type: 'syndicate',
        address: '1 Doc Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        isActive: true,
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: `DocScope Test Org-B ${TIMESTAMP}`,
        type: 'syndicate',
        address: '2 Doc Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2A 2A2',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [b1] = await db
      .insert(buildings)
      .values({
        name: `DocScope Building-A ${TIMESTAMP}`,
        address: '1 Building Way',
        city: 'Montreal',
        postalCode: 'H1A 1A1',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = b1.id;

    const [b2] = await db
      .insert(buildings)
      .values({
        name: `DocScope Building-B ${TIMESTAMP}`,
        address: '2 Building Way',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org2Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = b2.id;

    const [d1] = await db
      .insert(documents)
      .values({
        name: `DocScope Doc-A ${TIMESTAMP}`,
        documentType: 'legal',
        filePath: `test-fixtures/docscope-a-${TIMESTAMP}.pdf`,
        buildingId: building1Id,
        isVisibleToTenants: false,
        isManagerOnly: false,
      })
      .returning();
    document1Id = d1.id;

    const [d2] = await db
      .insert(documents)
      .values({
        name: `DocScope Doc-B ${TIMESTAMP}`,
        documentType: 'legal',
        filePath: `test-fixtures/docscope-b-${TIMESTAMP}.pdf`,
        buildingId: building2Id,
        isVisibleToTenants: false,
        isManagerOnly: false,
      })
      .returning();
    document2Id = d2.id;

    const [managerUser] = await db
      .insert(users)
      .values({
        email: `docscope-manager-${TIMESTAMP}@example.test`,
        username: `docscope-manager-${TIMESTAMP}`,
        password: 'placeholder-not-a-real-hash',
        firstName: 'DocScope',
        lastName: 'Manager',
        role: 'manager',
        isActive: true,
      })
      .returning();
    managerUserId = managerUser.id;

    await db.insert(userOrganizations).values({
      userId: managerUserId,
      organizationId: org1Id,
      isActive: true,
      canAccessAllOrganizations: false,
    });
  }, 30_000);

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.id, document1Id)).catch(() => undefined);
    await db.delete(documents).where(eq(documents.id, document2Id)).catch(() => undefined);
    await db.delete(userOrganizations).where(
      and(eq(userOrganizations.userId, managerUserId), eq(userOrganizations.organizationId, org1Id))
    ).catch(() => undefined);
    await db.delete(users).where(eq(users.id, managerUserId)).catch(() => undefined);
    await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('returns 400 for a malformed (non-UUID) organizationId', async () => {
    const res = await request(app)
      .get('/api/documents?organizationId=not-a-uuid')
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORGANIZATION_ID');
  }, 30_000);

  it('returns 403 for a valid UUID that the caller cannot access', async () => {
    const res = await request(app)
      .get(`/api/documents?organizationId=${org2Id}`)
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  }, 30_000);

  it("returns only documents from the caller's own org when no organizationId is supplied", async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(200);
    const ids: string[] = (res.body.documents ?? []).map((d: { id: string }) => d.id);
    expect(ids).toContain(document1Id);
    expect(ids).not.toContain(document2Id);
  }, 30_000);

  it("returns only documents from the caller's own org when that org is explicitly requested", async () => {
    const res = await request(app)
      .get(`/api/documents?organizationId=${org1Id}`)
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(200);
    const ids: string[] = (res.body.documents ?? []).map((d: { id: string }) => d.id);
    expect(ids).toContain(document1Id);
    expect(ids).not.toContain(document2Id);
  }, 30_000);
});
