import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db';
import {
  organizations,
  buildings,
  residences,
  documents,
  invoices,
  buildingElements,
  invitations,
  users,
} from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Database-level guard tests for migrations 0011 / 0012 / 0013 / 0014
 * (Task #811).
 *
 * Mirrors `demands-residence-building-check-trigger.test.ts` for the
 * four sibling triggers installed on `documents`, `invoices`,
 * `building_elements`, and `invitations`. Each test verifies that:
 *   - Same-building inserts succeed.
 *   - residence_id NULL (or building_id NULL where allowed) is accepted.
 *   - Cross-building inserts and updates are rejected with the expected
 *     'check_violation' (SQLSTATE 23514) message.
 */

const REAL_DB_AVAILABLE =
  typeof process.env.DATABASE_URL === 'string' &&
  !process.env.DATABASE_URL.includes('localhost');

const describeOrSkip = REAL_DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('cross-residence/building triggers (documents, invoices, building_elements)', () => {
  let org1Id: string;
  let org2Id: string;
  let building1Id: string;
  let building2Id: string;
  let residence1Id: string;
  let residence2Id: string;
  let inviterUserId: string | undefined;
  const insertedDocumentIds: string[] = [];
  const insertedInvoiceIds: string[] = [];
  const insertedElementIds: string[] = [];
  const insertedInvitationIds: string[] = [];

  beforeAll(async () => {
    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Trigger Test Org 1 – cross-org siblings',
        type: 'syndicate',
        address: '11 Trigger Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2A 2A2',
        isActive: true,
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: 'Trigger Test Org 2 – cross-org siblings',
        type: 'syndicate',
        address: '21 Trigger Ave',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B 2B2',
        isActive: true,
      })
      .returning();
    org2Id = org2.id;

    const [building1] = await db
      .insert(buildings)
      .values({
        name: 'Sibling Trigger Building 1',
        address: '11 Building Way',
        city: 'Montreal',
        postalCode: 'H2A 2A2',
        organizationId: org1Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building1Id = building1.id;

    const [building2] = await db
      .insert(buildings)
      .values({
        name: 'Sibling Trigger Building 2',
        address: '21 Building Way',
        city: 'Montreal',
        postalCode: 'H2B 2B2',
        organizationId: org2Id,
        totalUnits: 4,
        totalFloors: 1,
        buildingType: 'apartment',
        isActive: true,
      })
      .returning();
    building2Id = building2.id;

    const [residence1] = await db
      .insert(residences)
      .values({
        buildingId: building1Id,
        unitNumber: 'S-101',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence1Id = residence1.id;

    const [residence2] = await db
      .insert(residences)
      .values({
        buildingId: building2Id,
        unitNumber: 'S-201',
        floor: 1,
        monthlyFees: '1000.00',
        isActive: true,
      })
      .returning();
    residence2Id = residence2.id;

    // Inviter user for the invitations trigger tests. The column is
    // varchar without a strict FK in core.ts, but we still create a
    // real user for hygiene.
    const [inviter] = await db
      .insert(users)
      .values({
        email: `trigger-inviter-${Date.now()}@example.test`,
        username: `trigger-inviter-${Date.now()}`,
        password: 'placeholder-not-a-real-hash',
        firstName: 'Trigger',
        lastName: 'Inviter',
        role: 'admin',
        isActive: true,
      })
      .returning();
    inviterUserId = inviter.id;
  }, 30_000);

  afterAll(async () => {
    for (const id of insertedDocumentIds) {
      await db.delete(documents).where(eq(documents.id, id)).catch(() => undefined);
    }
    for (const id of insertedInvoiceIds) {
      await db.delete(invoices).where(eq(invoices.id, id)).catch(() => undefined);
    }
    for (const id of insertedElementIds) {
      await db.delete(buildingElements).where(eq(buildingElements.id, id)).catch(() => undefined);
    }
    for (const id of insertedInvitationIds) {
      await db.delete(invitations).where(eq(invitations.id, id)).catch(() => undefined);
    }
    if (inviterUserId) await db.delete(users).where(eq(users.id, inviterUserId)).catch(() => undefined);
    if (residence1Id) await db.delete(residences).where(eq(residences.id, residence1Id));
    if (residence2Id) await db.delete(residences).where(eq(residences.id, residence2Id));
    if (building1Id) await db.delete(buildings).where(eq(buildings.id, building1Id));
    if (building2Id) await db.delete(buildings).where(eq(buildings.id, building2Id));
    if (org1Id) await db.delete(organizations).where(eq(organizations.id, org1Id));
    if (org2Id) await db.delete(organizations).where(eq(organizations.id, org2Id));
  }, 30_000);

  // -------- documents --------

  describe('documents_residence_building_check', () => {
    const baseDoc = {
      name: 'Trigger doc',
      documentType: 'other',
    };

    it('allows inserts where residence.building_id matches document.building_id', async () => {
      const [row] = await db
        .insert(documents)
        .values({
          ...baseDoc,
          filePath: `/tmp/trigger-doc-${Date.now()}-1`,
          buildingId: building1Id,
          residenceId: residence1Id,
        })
        .returning();
      insertedDocumentIds.push(row.id);
      expect(row.residenceId).toBe(residence1Id);
      expect(row.buildingId).toBe(building1Id);
    }, 30_000);

    it('allows residence-only or building-only documents', async () => {
      const [resOnly] = await db
        .insert(documents)
        .values({
          ...baseDoc,
          filePath: `/tmp/trigger-doc-${Date.now()}-2`,
          residenceId: residence2Id,
          buildingId: null,
        })
        .returning();
      insertedDocumentIds.push(resOnly.id);
      expect(resOnly.buildingId).toBeNull();

      const [bldOnly] = await db
        .insert(documents)
        .values({
          ...baseDoc,
          filePath: `/tmp/trigger-doc-${Date.now()}-3`,
          residenceId: null,
          buildingId: building1Id,
        })
        .returning();
      insertedDocumentIds.push(bldOnly.id);
      expect(bldOnly.residenceId).toBeNull();
    }, 30_000);

    it('rejects INSERT where residence belongs to a different building', async () => {
      await expect(
        db.insert(documents).values({
          ...baseDoc,
          filePath: `/tmp/trigger-doc-${Date.now()}-4`,
          buildingId: building1Id,
          residenceId: residence2Id,
        }),
      ).rejects.toThrow(/Cross-organisation document rejected/i);
    }, 30_000);

    it('rejects UPDATE that switches residence_id to a foreign-building residence', async () => {
      const [row] = await db
        .insert(documents)
        .values({
          ...baseDoc,
          filePath: `/tmp/trigger-doc-${Date.now()}-5`,
          buildingId: building1Id,
          residenceId: residence1Id,
        })
        .returning();
      insertedDocumentIds.push(row.id);

      await expect(
        db.update(documents).set({ residenceId: residence2Id }).where(eq(documents.id, row.id)),
      ).rejects.toThrow(/Cross-organisation document rejected/i);
    }, 30_000);
  });

  // -------- invoices --------

  describe('invoices_residence_building_check', () => {
    const baseInv = {
      vendorName: 'Trigger vendor',
      invoiceNumber: 'TRIG-001',
      totalAmount: '100.00',
      dueDate: '2030-01-01',
      paymentType: 'one-time' as const,
    };

    it('allows inserts where residence.building_id matches invoice.building_id', async () => {
      const [row] = await db
        .insert(invoices)
        .values({
          ...baseInv,
          invoiceNumber: `TRIG-${Date.now()}-1`,
          buildingId: building1Id,
          residenceId: residence1Id,
        })
        .returning();
      insertedInvoiceIds.push(row.id);
      expect(row.residenceId).toBe(residence1Id);
    }, 30_000);

    it('allows residence-only or building-only invoices', async () => {
      const [resOnly] = await db
        .insert(invoices)
        .values({
          ...baseInv,
          invoiceNumber: `TRIG-${Date.now()}-2`,
          residenceId: residence2Id,
          buildingId: null,
        })
        .returning();
      insertedInvoiceIds.push(resOnly.id);

      const [bldOnly] = await db
        .insert(invoices)
        .values({
          ...baseInv,
          invoiceNumber: `TRIG-${Date.now()}-3`,
          residenceId: null,
          buildingId: building1Id,
        })
        .returning();
      insertedInvoiceIds.push(bldOnly.id);
    }, 30_000);

    it('rejects INSERT where residence belongs to a different building', async () => {
      await expect(
        db.insert(invoices).values({
          ...baseInv,
          invoiceNumber: `TRIG-${Date.now()}-4`,
          buildingId: building1Id,
          residenceId: residence2Id,
        }),
      ).rejects.toThrow(/Cross-organisation invoice rejected/i);
    }, 30_000);

    it('rejects UPDATE that switches building_id away from the residence building', async () => {
      const [row] = await db
        .insert(invoices)
        .values({
          ...baseInv,
          invoiceNumber: `TRIG-${Date.now()}-5`,
          buildingId: building1Id,
          residenceId: residence1Id,
        })
        .returning();
      insertedInvoiceIds.push(row.id);

      await expect(
        db.update(invoices).set({ buildingId: building2Id }).where(eq(invoices.id, row.id)),
      ).rejects.toThrow(/Cross-organisation invoice rejected/i);
    }, 30_000);
  });

  // -------- building_elements --------

  describe('building_elements_residence_building_check', () => {
    let uniformatCode: string;

    beforeAll(async () => {
      // building_elements requires a valid uniformat_code FK. Pick one
      // already present in the database (the schema seeds many on init).
      const res = await db.execute(sql`
        SELECT code FROM uniformat_codes LIMIT 1
      `);
      const row = res.rows[0] as { code?: string } | undefined;
      if (!row?.code) {
        throw new Error('No uniformat_codes available; cannot run building_elements trigger tests');
      }
      uniformatCode = row.code;
    }, 30_000);

    it('allows inserts where residence.building_id matches element.building_id', async () => {
      const [row] = await db
        .insert(buildingElements)
        .values({
          buildingId: building1Id,
          residenceId: residence1Id,
          uniformatCode,
          name: 'Trigger element OK',
        })
        .returning();
      insertedElementIds.push(row.id);
      expect(row.residenceId).toBe(residence1Id);
    }, 30_000);

    it('allows building-wide elements (residence_id NULL)', async () => {
      const [row] = await db
        .insert(buildingElements)
        .values({
          buildingId: building1Id,
          residenceId: null,
          uniformatCode,
          name: 'Trigger element building-wide',
        })
        .returning();
      insertedElementIds.push(row.id);
      expect(row.residenceId).toBeNull();
    }, 30_000);

    it('rejects INSERT where residence belongs to a different building', async () => {
      await expect(
        db.insert(buildingElements).values({
          buildingId: building1Id,
          residenceId: residence2Id,
          uniformatCode,
          name: 'Trigger element cross-org',
        }),
      ).rejects.toThrow(/Cross-organisation building_element rejected/i);
    }, 30_000);

    it('rejects UPDATE that switches residence_id to a foreign-building residence', async () => {
      const [row] = await db
        .insert(buildingElements)
        .values({
          buildingId: building1Id,
          residenceId: residence1Id,
          uniformatCode,
          name: 'Trigger element to-be-updated',
        })
        .returning();
      insertedElementIds.push(row.id);

      await expect(
        db
          .update(buildingElements)
          .set({ residenceId: residence2Id })
          .where(eq(buildingElements.id, row.id)),
      ).rejects.toThrow(/Cross-organisation building_element rejected/i);
    }, 30_000);
  });

  // -------- invitations --------

  describe('invitations_residence_building_check', () => {
    function baseInvitation(suffix: string) {
      return {
        email: `trigger-invitee-${Date.now()}-${suffix}@example.test`,
        token: `tok-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2)}`,
        tokenHash: `hash-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2)}`,
        role: 'tenant' as const,
        invitedByUserId: inviterUserId!,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    }

    it('allows inserts where residence.building_id matches invitation.building_id', async () => {
      const [row] = await db
        .insert(invitations)
        .values({
          ...baseInvitation('1'),
          organizationId: org1Id,
          buildingId: building1Id,
          residenceId: residence1Id,
        })
        .returning();
      insertedInvitationIds.push(row.id);
      expect(row.residenceId).toBe(residence1Id);
      expect(row.buildingId).toBe(building1Id);
    }, 30_000);

    it('allows org-only or building-only invitations', async () => {
      const [orgOnly] = await db
        .insert(invitations)
        .values({
          ...baseInvitation('2'),
          organizationId: org1Id,
          buildingId: null,
          residenceId: null,
        })
        .returning();
      insertedInvitationIds.push(orgOnly.id);
      expect(orgOnly.buildingId).toBeNull();

      const [bldOnly] = await db
        .insert(invitations)
        .values({
          ...baseInvitation('3'),
          organizationId: org1Id,
          buildingId: building1Id,
          residenceId: null,
        })
        .returning();
      insertedInvitationIds.push(bldOnly.id);
      expect(bldOnly.residenceId).toBeNull();
    }, 30_000);

    it('rejects INSERT where residence belongs to a different building', async () => {
      await expect(
        db.insert(invitations).values({
          ...baseInvitation('4'),
          organizationId: org1Id,
          buildingId: building1Id,
          residenceId: residence2Id,
        }),
      ).rejects.toThrow(/Cross-organisation invitation rejected/i);
    }, 30_000);

    it('rejects UPDATE that switches residence_id to a foreign-building residence', async () => {
      const [row] = await db
        .insert(invitations)
        .values({
          ...baseInvitation('5'),
          organizationId: org1Id,
          buildingId: building1Id,
          residenceId: residence1Id,
        })
        .returning();
      insertedInvitationIds.push(row.id);

      await expect(
        db.update(invitations).set({ residenceId: residence2Id }).where(eq(invitations.id, row.id)),
      ).rejects.toThrow(/Cross-organisation invitation rejected/i);
    }, 30_000);
  });
});
