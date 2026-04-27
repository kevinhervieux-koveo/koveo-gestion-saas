import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { db } from '../db';
import {
  organizations,
  buildings,
  invoices,
  users,
  userOrganizations,
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from './test-app';

/**
 * Integration tests for org-scope enforcement on GET /api/invoices.
 *
 * Mirrors `server/tests/common-spaces-org-scope.test.ts` (Task #1472) for
 * the invoices flat-list endpoint (Task #1495). Verifies four guarantees:
 *   1. Malformed `organizationId` query param → 400 INVALID_ORGANIZATION_ID
 *   2. Valid UUID that the caller cannot access → 403 INSUFFICIENT_PERMISSIONS
 *   3. A manager scoped to org-A only receives invoices from org-A's
 *      buildings, even when org-B invoices exist in the DB.
 *   4. `?buildingId=<id>` pointing to an inaccessible building returns 403
 *      (rather than silently filtering to an empty list).
 *
 * Skipped when no real DATABASE_URL is available (unit-tier CI runs).
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('GET /api/invoices — org-scope enforcement', () => {
  const app = createTestApp();

  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let invoice1Id: string;
  let invoice2Id: string;
  let managerUserId: string;

  const TIMESTAMP = Date.now();
  const TODAY_ISO = new Date().toISOString().split('T')[0];

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: `InvScope Test Org-A ${TIMESTAMP}`,
        type: 'syndicate',
        address: '1 Inv Ave',
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
        name: `InvScope Test Org-B ${TIMESTAMP}`,
        type: 'syndicate',
        address: '2 Inv Ave',
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
        name: `InvScope Building-A ${TIMESTAMP}`,
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
        name: `InvScope Building-B ${TIMESTAMP}`,
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

    const [managerUser] = await db
      .insert(users)
      .values({
        email: `invscope-manager-${TIMESTAMP}@example.test`,
        username: `invscope-manager-${TIMESTAMP}`,
        password: 'placeholder-not-a-real-hash',
        firstName: 'InvScope',
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

    const [i1] = await db
      .insert(invoices)
      .values({
        vendorName: `InvScope Vendor-A ${TIMESTAMP}`,
        invoiceNumber: `INV-A-${TIMESTAMP}`,
        totalAmount: '100.00',
        dueDate: TODAY_ISO,
        paymentType: 'one-time',
        buildingId: building1Id,
        createdBy: managerUserId,
      })
      .returning();
    invoice1Id = i1.id;

    const [i2] = await db
      .insert(invoices)
      .values({
        vendorName: `InvScope Vendor-B ${TIMESTAMP}`,
        invoiceNumber: `INV-B-${TIMESTAMP}`,
        totalAmount: '200.00',
        dueDate: TODAY_ISO,
        paymentType: 'one-time',
        buildingId: building2Id,
        createdBy: managerUserId,
      })
      .returning();
    invoice2Id = i2.id;
  }, 30_000);

  afterAll(async () => {
    await db.delete(invoices).where(eq(invoices.id, invoice1Id)).catch(() => undefined);
    await db.delete(invoices).where(eq(invoices.id, invoice2Id)).catch(() => undefined);
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
      .get('/api/invoices?organizationId=not-a-uuid')
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORGANIZATION_ID');
  }, 30_000);

  it('returns 403 for a valid UUID that the caller cannot access', async () => {
    const res = await request(app)
      .get(`/api/invoices?organizationId=${org2Id}`)
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  }, 30_000);

  it("returns only invoices from the caller's own org when no organizationId is supplied", async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(200);
    const ids: string[] = (res.body.data ?? []).map((i: { id: string }) => i.id);
    expect(ids).toContain(invoice1Id);
    expect(ids).not.toContain(invoice2Id);
  }, 30_000);

  it("returns only invoices from the caller's own org when that org is explicitly requested", async () => {
    const res = await request(app)
      .get(`/api/invoices?organizationId=${org1Id}`)
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(200);
    const ids: string[] = (res.body.data ?? []).map((i: { id: string }) => i.id);
    expect(ids).toContain(invoice1Id);
    expect(ids).not.toContain(invoice2Id);
  }, 30_000);

  it('returns 403 when ?buildingId= points to an inaccessible building', async () => {
    const res = await request(app)
      .get(`/api/invoices?buildingId=${building2Id}`)
      .set('x-test-user-id', managerUserId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
  }, 30_000);
});
