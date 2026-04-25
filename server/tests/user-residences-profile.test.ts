// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { testApp as app } from './test-app';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  users,
  userResidences,
  userOrganizations,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Integration tests for GET /api/user/residences (profile widget endpoint).
 *
 * Verifies:
 * 1. A user linked to active residences in two different organizations sees both rows.
 * 2. A link flipped to isActive = false disappears from the response.
 * 3. Each row contains the expected enriched fields (buildingName, unitNumber, etc.).
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('GET /api/user/residences — profile widget', () => {
  let testUserId: string;
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence1Id: string;
  let residence2Id: string;
  let link1Id: string;
  let link2Id: string;

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Profile Widget Test Org 1',
        type: 'syndicate',
        address: '1 Profile St',
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
        name: 'Profile Widget Test Org 2',
        type: 'syndicate',
        address: '2 Profile St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'Profile Building One',
        address: '1 Building Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        organizationId: org1Id,
        totalUnits: 2,
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Profile Building Two',
        address: '2 Building Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        organizationId: org2Id,
        totalUnits: 2,
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    const [res1] = await db
      .insert(residences)
      .values({
        buildingId: building1Id,
        unitNumber: '101',
        bedrooms: 2,
        bathrooms: '1.0',
        isActive: true,
      })
      .returning();
    residence1Id = res1.id;

    const [res2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: '202',
        bedrooms: 1,
        bathrooms: '1.0',
        isActive: true,
      })
      .returning();
    residence2Id = res2.id;

    const [testUser] = await db
      .insert(users)
      .values({
        username: 'profile-widget-test-user',
        email: 'profile-widget-test@example.com',
        password: 'hashed-password',
        role: 'tenant',
        firstName: 'Profile',
        lastName: 'Test',
        isActive: true,
      })
      .returning();
    testUserId = testUser.id;

    await db.insert(userOrganizations).values([
      { userId: testUserId, organizationId: org1Id, isActive: true },
      { userId: testUserId, organizationId: org2Id, isActive: true },
    ]);

    const [link1] = await db
      .insert(userResidences)
      .values({
        userId: testUserId,
        residenceId: residence1Id,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
      })
      .returning();
    link1Id = link1.id;

    const [link2] = await db
      .insert(userResidences)
      .values({
        userId: testUserId,
        residenceId: residence2Id,
        relationshipType: 'owner',
        startDate: '2024-06-01',
        isActive: true,
      })
      .returning();
    link2Id = link2.id;
  });

  afterAll(async () => {
    await db.delete(userResidences).where(eq(userResidences.userId, testUserId));
    await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(residences).where(eq(residences.id, residence1Id));
    await db.delete(residences).where(eq(residences.id, residence2Id));
    await db.delete(buildings).where(eq(buildings.id, building1Id));
    await db.delete(buildings).where(eq(buildings.id, building2Id));
    await db.delete(organizations).where(eq(organizations.id, org1Id));
    await db.delete(organizations).where(eq(organizations.id, org2Id));
  });

  it('returns both active residence rows for a user linked to two orgs', async () => {
    const res = await request(app)
      .get('/api/user/residences')
      .set('x-test-user-id', testUserId)
      .expect(200);

    const rows = res.body as any[];
    expect(rows).toHaveLength(2);

    const row1 = rows.find((r: any) => r.residenceId === residence1Id);
    const row2 = rows.find((r: any) => r.residenceId === residence2Id);

    expect(row1).toBeDefined();
    expect(row1.id).toBe(link1Id);
    expect(row1.buildingName).toBe('Profile Building One');
    expect(row1.unitNumber).toBe('101');
    expect(row1.relationshipType).toBe('tenant');
    expect(row1.startDate).toBe('2024-01-01');
    expect(row1.organizationName).toBe('Profile Widget Test Org 1');

    expect(row2).toBeDefined();
    expect(row2.id).toBe(link2Id);
    expect(row2.buildingName).toBe('Profile Building Two');
    expect(row2.unitNumber).toBe('202');
    expect(row2.relationshipType).toBe('owner');
    expect(row2.startDate).toBe('2024-06-01');
    expect(row2.organizationName).toBe('Profile Widget Test Org 2');
  });

  it('excludes a link once isActive is set to false', async () => {
    await db
      .update(userResidences)
      .set({ isActive: false })
      .where(eq(userResidences.id, link2Id));

    const res = await request(app)
      .get('/api/user/residences')
      .set('x-test-user-id', testUserId)
      .expect(200);

    const rows = res.body as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].residenceId).toBe(residence1Id);
    expect(rows.find((r: any) => r.residenceId === residence2Id)).toBeUndefined();

    await db
      .update(userResidences)
      .set({ isActive: true })
      .where(eq(userResidences.id, link2Id));
  });
});
