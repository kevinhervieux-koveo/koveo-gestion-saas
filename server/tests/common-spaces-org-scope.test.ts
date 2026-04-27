import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  commonSpaces,
  users,
  userOrganizations,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from './test-app';

/**
 * Integration tests for org-scope enforcement on GET /api/common-spaces.
 *
 * Verifies four guarantees (Task #1472):
 *   1. Malformed `organizationId` query param → 400 INVALID_ORGANIZATION_ID
 *   2. Valid UUID that the caller cannot access → 403 INSUFFICIENT_PERMISSIONS
 *   3. An admin scoped to org-A only receives spaces from org-A's buildings,
 *      even when org-B spaces exist in the DB.
 *   4. Providing `?buildingId=<id>` limits results to that building's spaces.
 *
 * Skipped when no real DATABASE_URL is available (unit-tier CI runs).
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('GET /api/common-spaces — org-scope enforcement', () => {
  const app = createTestApp();

  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence1Id: string;
  let space1Id: string;
  let space2Id: string;
  let adminUserId: string;

  const TIMESTAMP = Date.now();

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: `OrgScope Test Org-A ${TIMESTAMP}`,
        type: 'syndicate',
        address: '1 Test Ave',
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
        name: `OrgScope Test Org-B ${TIMESTAMP}`,
        type: 'syndicate',
        address: '2 Test Ave',
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
        name: `OrgScope Building-A ${TIMESTAMP}`,
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
        name: `OrgScope Building-B ${TIMESTAMP}`,
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

    const [r1] = await db
      .insert(residences)
      .values({
        buildingId: building1Id,
        unitNumber: `OS-101-${TIMESTAMP}`,
        floor: 1,
        monthlyFees: '500.00',
        isActive: true,
      })
      .returning();
    residence1Id = r1.id;

    const [s1] = await db
      .insert(commonSpaces)
      .values({
        name: `OrgScope Space-A ${TIMESTAMP}`,
        buildingId: building1Id,
        isReservable: true,
      })
      .returning();
    space1Id = s1.id;

    const [s2] = await db
      .insert(commonSpaces)
      .values({
        name: `OrgScope Space-B ${TIMESTAMP}`,
        buildingId: building2Id,
        isReservable: true,
      })
      .returning();
    space2Id = s2.id;

    const [adminUser] = await db
      .insert(users)
      .values({
        email: `orgscope-admin-${TIMESTAMP}@example.test`,
        username: `orgscope-admin-${TIMESTAMP}`,
        password: 'placeholder-not-a-real-hash',
        firstName: 'OrgScope',
        lastName: 'Admin',
        role: 'admin',
        isActive: true,
      })
      .returning();
    adminUserId = adminUser.id;

    await db.insert(userOrganizations).values({
      userId: adminUserId,
      organizationId: org1Id,
      isActive: true,
      canAccessAllOrganizations: false,
    });
  }, 30_000);

  afterAll(async () => {
    await db.delete(commonSpaces).where(eq(commonSpaces.id, space1Id)).catch(() => undefined);
    await db.delete(commonSpaces).where(eq(commonSpaces.id, space2Id)).catch(() => undefined);
    await db.delete(residences).where(eq(residences.id, residence1Id)).catch(() => undefined);
    await db.delete(userOrganizations).where(
      and(eq(userOrganizations.userId, adminUserId), eq(userOrganizations.organizationId, org1Id))
    ).catch(() => undefined);
    await db.delete(users).where(eq(users.id, adminUserId)).catch(() => undefined);
    await db.delete(buildings).where(eq(buildings.id, building1Id)).catch(() => undefined);
    await db.delete(buildings).where(eq(buildings.id, building2Id)).catch(() => undefined);
    await db.delete(organizations).where(eq(organizations.id, org1Id)).catch(() => undefined);
    await db.delete(organizations).where(eq(organizations.id, org2Id)).catch(() => undefined);
  }, 30_000);

  it('returns 400 for a malformed (non-UUID) organizationId', async () => {
    const res = await request(app)
      .get('/api/common-spaces?organizationId=not-a-uuid')
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORGANIZATION_ID');
  }, 30_000);

  it('returns 403 for a valid UUID that the caller cannot access', async () => {
    const res = await request(app)
      .get(`/api/common-spaces?organizationId=${org2Id}`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  }, 30_000);

  it("returns only spaces from the caller's own org when no organizationId is supplied", async () => {
    const res = await request(app)
      .get('/api/common-spaces')
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(space1Id);
    expect(ids).not.toContain(space2Id);
  }, 30_000);

  it("returns only spaces from the caller's own org when that org is explicitly requested", async () => {
    const res = await request(app)
      .get(`/api/common-spaces?organizationId=${org1Id}`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(space1Id);
    expect(ids).not.toContain(space2Id);
  }, 30_000);

  it("honours ?buildingId= and limits results to that building's spaces", async () => {
    const res = await request(app)
      .get(`/api/common-spaces?buildingId=${building1Id}`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(space1Id);
    expect(ids.every((id) => id !== space2Id)).toBe(true);
  }, 30_000);

  it('returns 403 when ?buildingId= points to an inaccessible building', async () => {
    const res = await request(app)
      .get(`/api/common-spaces?buildingId=${building2Id}`)
      .set('x-test-user-id', adminUserId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  }, 30_000);
});
