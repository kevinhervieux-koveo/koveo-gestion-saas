/**
 * @file Demo Organization Roles Integration Tests
 * @description Tests to validate that demo organizations can accept both demo roles 
 * (demo_manager, demo_tenant, demo_resident) and regular roles (admin, manager, tenant, resident)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Demo Organization Role Support', () => {
  let adminUser: any;
  let demoOrganization: any;
  let regularOrganization: any;
  let testBuilding: any;
  let testResidence: any;

  beforeEach(async () => {
    // Clear test data
    await db.delete(schema.invitations);
    await db.delete(schema.userOrganizations);
    await db.delete(schema.users);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);

    // Create demo organization
    const [demoOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Demo Organization',
        type: 'Demo',
        address: '123 Demo St',
        city: 'Demo City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'demo@org.com',
      })
      .returning();
    demoOrganization = demoOrg;

    // Create regular organization for comparison
    const [regularOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Regular Organization',
        type: 'management_company',
        address: '456 Regular St',
        city: 'Regular City',
        province: 'QC',
        postalCode: 'H2H 2H2',
        phone: '514-555-0456',
        email: 'regular@org.com',
      })
      .returning();
    regularOrganization = regularOrg;

    // Create test building in demo organization
    const [building] = await db
      .insert(schema.buildings)
      .values({
        organizationId: demoOrganization.id,
        name: 'Demo Building',
        address: '123 Demo St',
        city: 'Demo City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        totalUnits: 10,
        buildingType: 'condo',
        yearBuilt: 2020,
      })
      .returning();
    testBuilding = building;

    // Create test residence
    const [residence] = await db
      .insert(schema.residences)
      .values({
        buildingId: testBuilding.id,
        unitNumber: '101',
        squareFootage: '1000',
        bedrooms: 2,
        bathrooms: '1',
      })
      .returning();
    testResidence = residence;

    // Create admin user
    const [admin] = await db
      .insert(schema.users)
      .values({
        email: 'admin@test.com',
        username: 'admin_user',
        password: 'hashedpassword123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        phone: '514-555-0001',
      })
      .returning();
    adminUser = admin;

    // Assign admin to Koveo organization for global access
    const [koveoOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Koveo',
        type: 'management_company',
        address: '789 Koveo St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H3H 3H3',
        phone: '514-555-0789',
        email: 'koveo@org.com',
      })
      .returning();

    await db
      .insert(schema.userOrganizations)
      .values({
        userId: adminUser.id,
        organizationId: koveoOrg.id,
        organizationRole: 'admin',
        canAccessAllOrganizations: true,
      });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(schema.invitations);
    await db.delete(schema.userOrganizations);
    await db.delete(schema.users);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);
  });

  describe('Demo Organization Role Support', () => {
    it('should allow demo roles in demo organizations', async () => {
      const demoRoles = ['demo_manager', 'demo_tenant', 'demo_resident'];

      for (const role of demoRoles) {
        const demoUserData = {
          firstName: `Demo ${role.split('_')[1]}`,
          lastName: 'User',
          role: role,
          organizationId: demoOrganization.id,
          residenceId: role.includes('tenant') || role.includes('resident') ? testResidence.id : null,
        };

        const response = await request(app)
          .post('/api/users/demo')
          .set('Cookie', `testSession=admin-${adminUser.id}`)
          .send(demoUserData)
          .expect(201);

        expect(response.body.message).toBe('Demo user created successfully');
        expect(response.body.user.role).toBe(role);
        expect(response.body.user.firstName).toBe(demoUserData.firstName);
        expect(response.body.user.lastName).toBe(demoUserData.lastName);

        // Verify user was created in database
        const createdUser = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, response.body.user.id))
          .limit(1);

        expect(createdUser).toHaveLength(1);
        expect(createdUser[0].role).toBe(role);
      }
    });

    it('should allow regular roles in demo organizations', async () => {
      const regularRoles = ['admin', 'manager', 'tenant', 'resident'];

      for (const role of regularRoles) {
        const invitationData = {
          email: `${role}@demo.com`,
          role: role,
          organizationId: demoOrganization.id,
          residenceId: role === 'tenant' || role === 'resident' ? testResidence.id : null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await request(app)
          .post('/api/invitations')
          .set('Cookie', `testSession=admin-${adminUser.id}`)
          .send(invitationData)
          .expect(201);

        expect(response.body.message).toBe('Invitation created successfully');

        // Verify invitation was created in database
        const invitation = await db
          .select()
          .from(schema.invitations)
          .where(eq(schema.invitations.email, invitationData.email))
          .limit(1);

        expect(invitation).toHaveLength(1);
        expect(invitation[0].role).toBe(role);
        expect(invitation[0].organizationId).toBe(demoOrganization.id);
      }
    });

    it('should NOT allow demo roles in regular organizations', async () => {
      const demoRoles = ['demo_manager', 'demo_tenant', 'demo_resident'];

      for (const role of demoRoles) {
        const invitationData = {
          email: `${role}@regular.com`,
          role: role,
          organizationId: regularOrganization.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await request(app)
          .post('/api/invitations')
          .set('Cookie', `testSession=admin-${adminUser.id}`)
          .send(invitationData)
          .expect(400);

        expect(response.body.message).toContain('Demo roles can only be assigned to demo organizations');
      }
    });

    it('should maintain role permissions for demo roles in demo organizations', async () => {
      // Create demo manager user
      const demoManagerData = {
        firstName: 'Demo',
        lastName: 'Manager',
        role: 'demo_manager',
        organizationId: demoOrganization.id,
      };

      const managerResponse = await request(app)
        .post('/api/users/demo')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(demoManagerData)
        .expect(201);

      const demoManager = managerResponse.body.user;

      // Test that demo_manager can access buildings (manager-level permission)
      const buildingsResponse = await request(app)
        .get('/api/buildings')
        .set('Cookie', `testSession=demo_manager-${demoManager.id}`)
        .expect(200);

      expect(Array.isArray(buildingsResponse.body)).toBe(true);
    });

    it('should maintain role permissions for regular roles in demo organizations', async () => {
      // Create regular manager invitation in demo organization
      const regularManagerData = {
        email: 'regular.manager@demo.com',
        role: 'manager',
        organizationId: demoOrganization.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const invitationResponse = await request(app)
        .post('/api/invitations')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(regularManagerData)
        .expect(201);

      // Verify invitation was created with correct role
      const invitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.email, regularManagerData.email))
        .limit(1);

      expect(invitation).toHaveLength(1);
      expect(invitation[0].role).toBe('manager');
      expect(invitation[0].organizationId).toBe(demoOrganization.id);
    });

    it('should handle both demo and regular tenant/resident roles with residence assignments', async () => {
      // Test demo tenant with residence
      const demoTenantData = {
        firstName: 'Demo',
        lastName: 'Tenant',
        role: 'demo_tenant',
        organizationId: demoOrganization.id,
        residenceId: testResidence.id,
      };

      const demoTenantResponse = await request(app)
        .post('/api/users/demo')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(demoTenantData)
        .expect(201);

      expect(demoTenantResponse.body.user.role).toBe('demo_tenant');

      // Test regular tenant with residence via invitation
      const regularTenantData = {
        email: 'regular.tenant@demo.com',
        role: 'tenant',
        organizationId: demoOrganization.id,
        residenceId: testResidence.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const regularTenantResponse = await request(app)
        .post('/api/invitations')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(regularTenantData)
        .expect(201);

      // Verify both were created successfully
      const invitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.email, regularTenantData.email))
        .limit(1);

      expect(invitation).toHaveLength(1);
      expect(invitation[0].role).toBe('tenant');
      expect(invitation[0].residenceId).toBe(testResidence.id);
    });

    it('should allow admin role to invite both demo and regular roles to demo organizations', async () => {
      const allRoles = ['admin', 'manager', 'tenant', 'resident', 'demo_manager', 'demo_tenant', 'demo_resident'];
      
      let successCount = 0;

      for (const role of allRoles) {
        if (role.startsWith('demo_')) {
          // Demo roles use direct user creation
          const demoUserData = {
            firstName: `Demo ${role.split('_')[1]}`,
            lastName: 'User',
            role: role,
            organizationId: demoOrganization.id,
            residenceId: role.includes('tenant') || role.includes('resident') ? testResidence.id : null,
          };

          const response = await request(app)
            .post('/api/users/demo')
            .set('Cookie', `testSession=admin-${adminUser.id}`)
            .send(demoUserData);

          if (response.status === 201) {
            successCount++;
          }
        } else {
          // Regular roles use invitation system
          const invitationData = {
            email: `${role}.user@demo.com`,
            role: role,
            organizationId: demoOrganization.id,
            residenceId: role === 'tenant' || role === 'resident' ? testResidence.id : null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          };

          const response = await request(app)
            .post('/api/invitations')
            .set('Cookie', `testSession=admin-${adminUser.id}`)
            .send(invitationData);

          if (response.status === 201) {
            successCount++;
          }
        }
      }

      // All roles should be successfully created/invited
      expect(successCount).toBe(allRoles.length);
    });
  });
});