/**
 * @file Demand Comment Attachment Tests
 * @description Tests verifying that GET /api/demands/:id/comments returns the
 * `filePath`, `fileName`, and `fileSize` columns for comments that have an
 * attached file (e.g. created by the MCP `create_demand_comment` tool), and
 * leaves them as `null` for comments without an attachment. Also asserts the
 * existing access-control rules so the new fields cannot leak to unauthorized
 * roles.
 *
 * Mirrors the harness used by
 * `tests/integration/demand-comment-manager-admin-access.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { db } from '../../server/db';
import {
  demands,
  demandComments,
  users,
  residences,
  buildings,
  organizations,
  userResidences,
  userOrganizations,
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Mock Express app setup mirroring the existing demand-comment integration
// test. A no-op middleware is installed first so individual tests can swap in
// the user under test by mutating the mounted layer.
function createTestApp() {
  const express = require('express');
  const app = express();

  app.use(express.json());

  app.use((req: any, _res: any, next: any) => {
    req.user = { id: 'placeholder', role: 'resident' };
    next();
  });

  const { registerDemandRoutes } = require('../../server/api/demands');
  registerDemandRoutes(app);

  return app;
}

function setActiveUser(app: any, user: any) {
  app._router.stack.forEach((layer: any) => {
    if (layer.name === 'anonymous') {
      layer.handle = (req: any, _res: any, next: any) => {
        req.user = user;
        next();
      };
    }
  });
}

describe('Demand Comment Attachment Fields', () => {
  let app: any;
  let testOrganization: any;
  let otherOrganization: any;
  let testBuilding: any;
  let testResidence: any;
  let testDemand: any;

  let adminUser: any;
  let managerUser: any;
  let residentUser: any;
  let otherManagerUser: any;

  beforeEach(async () => {
    app = createTestApp();

    const orgResult = await db
      .insert(organizations)
      .values({
        name: 'Attachment Test Organization',
        type: 'residential',
        address: '101 Attach St',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        isActive: true,
      })
      .returning();
    testOrganization = orgResult[0];

    const otherOrgResult = await db
      .insert(organizations)
      .values({
        name: 'Other Attachment Organization',
        type: 'residential',
        address: '202 Other Attach St',
        city: 'Other City',
        province: 'QC',
        postalCode: 'H2H 2H2',
        isActive: true,
      })
      .returning();
    otherOrganization = otherOrgResult[0];

    const buildingResult = await db
      .insert(buildings)
      .values({
        name: 'Attachment Test Building',
        address: '303 Attach Ave',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H3H 3H3',
        buildingType: 'condo',
        organizationId: testOrganization.id,
        totalUnits: 4,
        isActive: true,
      })
      .returning();
    testBuilding = buildingResult[0];

    const residenceResult = await db
      .insert(residences)
      .values({
        buildingId: testBuilding.id,
        unitNumber: '202',
        floor: 2,
        squareFootage: '900',
        bedrooms: 2,
        bathrooms: '1',
        balcony: false,
        isActive: true,
      })
      .returning();
    testResidence = residenceResult[0];

    const adminResult = await db
      .insert(users)
      .values({
        username: 'attach-admin',
        firstName: 'Attach',
        lastName: 'Admin',
        email: 'attach-admin@example.com',
        password: 'hashed_password',
        role: 'admin',
        isActive: true,
      })
      .returning();
    adminUser = adminResult[0];

    const managerResult = await db
      .insert(users)
      .values({
        username: 'attach-manager',
        firstName: 'Attach',
        lastName: 'Manager',
        email: 'attach-manager@example.com',
        password: 'hashed_password',
        role: 'manager',
        isActive: true,
      })
      .returning();
    managerUser = managerResult[0];

    const residentResult = await db
      .insert(users)
      .values({
        username: 'attach-resident',
        firstName: 'Attach',
        lastName: 'Resident',
        email: 'attach-resident@example.com',
        password: 'hashed_password',
        role: 'resident',
        isActive: true,
      })
      .returning();
    residentUser = residentResult[0];

    const otherManagerResult = await db
      .insert(users)
      .values({
        username: 'attach-other-manager',
        firstName: 'Other',
        lastName: 'Manager',
        email: 'attach-other-manager@example.com',
        password: 'hashed_password',
        role: 'manager',
        isActive: true,
      })
      .returning();
    otherManagerUser = otherManagerResult[0];

    await db.insert(userOrganizations).values({
      userId: managerUser.id,
      organizationId: testOrganization.id,
      relationshipType: 'employee',
      isActive: true,
    });

    await db.insert(userOrganizations).values({
      userId: otherManagerUser.id,
      organizationId: otherOrganization.id,
      relationshipType: 'employee',
      isActive: true,
    });

    await db.insert(userResidences).values({
      userId: residentUser.id,
      residenceId: testResidence.id,
      relationshipType: 'resident',
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
    });

    const demandResult = await db
      .insert(demands)
      .values({
        submitterId: residentUser.id,
        type: 'maintenance',
        description: 'Demand for attachment field tests',
        buildingId: testBuilding.id,
        residenceId: testResidence.id,
        status: 'submitted',
      })
      .returning();
    testDemand = demandResult[0];
  });

  afterEach(async () => {
    try {
      await db.delete(demandComments).where(eq(demandComments.demandId, testDemand.id));
      await db.delete(demands).where(eq(demands.id, testDemand.id));
      await db.delete(userResidences).where(eq(userResidences.userId, residentUser.id));
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, managerUser.id));
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, otherManagerUser.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
      await db.delete(users).where(eq(users.id, managerUser.id));
      await db.delete(users).where(eq(users.id, residentUser.id));
      await db.delete(users).where(eq(users.id, otherManagerUser.id));
      await db.delete(residences).where(eq(residences.id, testResidence.id));
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
      await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
      await db.delete(organizations).where(eq(organizations.id, otherOrganization.id));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('GET /api/demands/:id/comments returns attachment fields', () => {
    it('returns filePath, fileName and fileSize for a comment with an attachment', async () => {
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'See attached invoice',
        isInternal: false,
        filePath: '/uploads/demands/invoice-123.pdf',
        fileName: 'invoice-123.pdf',
        fileSize: 24680,
      });

      setActiveUser(app, managerUser);

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(1);

      const [comment] = response.body;
      expect(comment).toMatchObject({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'See attached invoice',
        filePath: '/uploads/demands/invoice-123.pdf',
        fileName: 'invoice-123.pdf',
        fileSize: 24680,
      });
    });

    it('returns null attachment fields for a comment with no file', async () => {
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: residentUser.id,
        commentText: 'Plain text comment, no file',
        isInternal: false,
      });

      setActiveUser(app, residentUser);

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      const [comment] = response.body;
      expect(comment.commentText).toBe('Plain text comment, no file');
      // Endpoint always selects the columns; absent attachment surfaces as null.
      expect(comment.filePath).toBeNull();
      expect(comment.fileName).toBeNull();
      expect(comment.fileSize).toBeNull();
    });

    it('returns the right per-comment attachment fields when both kinds are mixed', async () => {
      await db.insert(demandComments).values([
        {
          demandId: testDemand.id,
          commenterId: residentUser.id,
          commentText: 'No file here',
          isInternal: false,
        },
        {
          demandId: testDemand.id,
          commenterId: managerUser.id,
          commentText: 'With file',
          isInternal: false,
          filePath: '/uploads/demands/photo.png',
          fileName: 'photo.png',
          fileSize: 4096,
        },
      ]);

      setActiveUser(app, adminUser);

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toHaveLength(2);

      const noFile = response.body.find((c: any) => c.commentText === 'No file here');
      const withFile = response.body.find((c: any) => c.commentText === 'With file');

      expect(noFile.filePath).toBeNull();
      expect(noFile.fileName).toBeNull();
      expect(noFile.fileSize).toBeNull();

      expect(withFile.filePath).toBe('/uploads/demands/photo.png');
      expect(withFile.fileName).toBe('photo.png');
      expect(withFile.fileSize).toBe(4096);
    });

    it('exposes attachment fields to the admin role on any demand', async () => {
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'Admin-visible attachment',
        isInternal: false,
        filePath: '/uploads/demands/admin-doc.pdf',
        fileName: 'admin-doc.pdf',
        fileSize: 1234,
      });

      setActiveUser(app, adminUser);

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].filePath).toBe('/uploads/demands/admin-doc.pdf');
      expect(response.body[0].fileName).toBe('admin-doc.pdf');
      expect(response.body[0].fileSize).toBe(1234);
    });

    it('exposes attachment fields to the demand submitter (resident)', async () => {
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'Update with file for resident',
        isInternal: false,
        filePath: '/uploads/demands/update.pdf',
        fileName: 'update.pdf',
        fileSize: 555,
      });

      setActiveUser(app, residentUser);

      const response = await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].filePath).toBe('/uploads/demands/update.pdf');
      expect(response.body[0].fileName).toBe('update.pdf');
      expect(response.body[0].fileSize).toBe(555);
    });

    it('does not leak attachment fields to a manager from a different organization', async () => {
      await db.insert(demandComments).values({
        demandId: testDemand.id,
        commenterId: managerUser.id,
        commentText: 'Should not be visible cross-org',
        isInternal: false,
        filePath: '/uploads/demands/secret.pdf',
        fileName: 'secret.pdf',
        fileSize: 999,
      });

      setActiveUser(app, otherManagerUser);

      await request(app)
        .get(`/api/demands/${testDemand.id}/comments`)
        .expect(403);
    });
  });
});
