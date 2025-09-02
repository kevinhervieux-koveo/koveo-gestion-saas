import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../server/index';
import { storage } from '../../server/storage';
import { db } from '../../server/db';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('User Invitation API', () => {
  let adminUser: any;
  let managerUser: any;
  let testOrganization: any;
  let testBuilding: any;
  let testResidence: any;
  
  beforeEach(async () => {
    // Clear test data
    await db.delete(schema.invitations);
    await db.delete(schema.users);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);

    // Create test organization
    const [org] = await db
      .insert(schema.organizations)
      .values({
        name: 'Test Organization',
        type: 'Standard' as any,
        address: '123 Test St',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        phone: '514-555-0123',
        email: 'test@org.com',
      })
      .returning();
    testOrganization = org;

    // Create test building
    const [building] = await db
      .insert(schema.buildings)
      .values({
        organizationId: testOrganization.id,
        name: 'Test Building',
        address: '123 Test St',
        city: 'Test City',
        province: 'QC',
        postalCode: 'H1H 1H1',
        totalUnits: 10,
        constructionYear: 2020,
        buildingType: 'Apartment',
      })
      .returning();
    testBuilding = building;

    // Create test residence
    const [residence] = await db
      .insert(schema.residences)
      .values({
        buildingId: testBuilding.id,
        unit: '101',
        type: 'Apartment',
        size: 1000,
        bedrooms: 2,
        bathrooms: 1,
        parkingSpaces: 1,
        storageUnits: 1,
      })
      .returning();
    testResidence = residence;

    // Create admin user
    const [admin] = await db
      .insert(schema.users)
      .values({
        email: 'admin@test.com',
        username: 'admin',
        password: 'hashedpassword123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
        phone: '514-555-0001',
      })
      .returning();
    adminUser = admin;

    // Create manager user
    const [manager] = await db
      .insert(schema.users)
      .values({
        email: 'manager@test.com',
        username: 'manager',
        password: 'hashedpassword123',
        firstName: 'Manager',
        lastName: 'User',
        role: 'manager',
        isActive: true,
        phone: '514-555-0002',
      })
      .returning();
    managerUser = manager;

    // Assign manager to organization
    await db
      .insert(schema.userOrganizations)
      .values({
        userId: managerUser.id,
        organizationId: testOrganization.id,
      });
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(schema.invitations);
    await db.delete(schema.userOrganizations);
    await db.delete(schema.userResidences);
    await db.delete(schema.users);
    await db.delete(schema.residences);
    await db.delete(schema.buildings);
    await db.delete(schema.organizations);
  });

  describe('POST /api/users/invite', () => {
    it('should successfully create invitation as admin', async () => {
      const invitationData = {
        email: 'newuser@test.com',
        role: 'resident',
        organizationId: testOrganization.id,
        residenceId: testResidence.id,
        expiresIn: 7,
        personalMessage: 'Welcome to our organization!',
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(invitationData)
        .expect(201);

      expect(response.body.message).toBe('Invitation sent successfully');
      expect(response.body.invitationId).toBeDefined();

      // Verify invitation was created in database
      const invitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.email, 'newuser@test.com'))
        .limit(1);

      expect(invitation).toHaveLength(1);
      expect(invitation[0].role).toBe('resident');
      expect(invitation[0].organizationId).toBe(testOrganization.id);
      expect(invitation[0].residenceId).toBe(testResidence.id);
      expect(invitation[0].invitedByUserId).toBe(adminUser.id);
      expect(invitation[0].personalMessage).toBe('Welcome to our organization!');
      expect(invitation[0].token).toBeDefined();
      expect(invitation[0].tokenHash).toBeDefined();
    });

    it('should successfully create invitation as manager', async () => {
      const invitationData = {
        email: 'newuser2@test.com',
        role: 'tenant',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=manager-${managerUser.id}`)
        .send(invitationData)
        .expect(201);

      expect(response.body.message).toBe('Invitation sent successfully');
      expect(response.body.invitationId).toBeDefined();

      // Verify invitation was created
      const invitation = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.email, 'newuser2@test.com'))
        .limit(1);

      expect(invitation).toHaveLength(1);
      expect(invitation[0].role).toBe('tenant');
    });

    it('should fail when inviting existing user', async () => {
      const invitationData = {
        email: adminUser.email, // Use existing admin email
        role: 'resident',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(invitationData)
        .expect(400);

      expect(response.body.message).toBe('User with this email already exists');
      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should fail when manager tries to invite admin role', async () => {
      const invitationData = {
        email: 'newadmin@test.com',
        role: 'admin',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=manager-${managerUser.id}`)
        .send(invitationData)
        .expect(403);

      expect(response.body.message).toBe('Managers can only invite resident, tenant, and manager roles');
      expect(response.body.code).toBe('ROLE_PERMISSION_DENIED');
    });

    it('should require authentication', async () => {
      const invitationData = {
        email: 'newuser@test.com',
        role: 'resident',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      const response = await request(app)
        .post('/api/users/invite')
        .send(invitationData)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send({}) // Empty request body
        .expect(400);

      expect(response.body.message).toContain('validation');
    });

    it('should validate email format', async () => {
      const invitationData = {
        email: 'invalid-email',
        role: 'resident',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      const response = await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(invitationData)
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should generate unique tokens for multiple invitations', async () => {
      const invitationData1 = {
        email: 'user1@test.com',
        role: 'resident',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      const invitationData2 = {
        email: 'user2@test.com',
        role: 'tenant',
        organizationId: testOrganization.id,
        expiresIn: 7,
      };

      // Create two invitations
      await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(invitationData1)
        .expect(201);

      await request(app)
        .post('/api/users/invite')
        .set('Cookie', `testSession=admin-${adminUser.id}`)
        .send(invitationData2)
        .expect(201);

      // Verify both invitations exist with different tokens
      const invitations = await db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.organizationId, testOrganization.id));

      expect(invitations).toHaveLength(2);
      expect(invitations[0].token).not.toBe(invitations[1].token);
      expect(invitations[0].tokenHash).not.toBe(invitations[1].tokenHash);
    });
  });
});