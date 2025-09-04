/**
 * Button Database Integration Tests
 * Tests that buttons actually persist data to the database correctly
 */

import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';
import { db } from '../../server/db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { apiRequest } from '../../client/src/lib/queryClient';

const {
  users,
  organizations,
  userOrganizations,
  buildings,
  residences,
  userResidences,
  documents,
  demands,
  commonSpaces,
  bookings,
  userBookingRestrictions,
  userTimeLimits,
  invitations
} = schema;

describe('Button Database Integration Tests', () => {
  let testUser: any;
  let testOrganization: any;
  let testBuilding: any;
  let testResidence: any;

  beforeEach(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      username: 'test-button-user',
      email: 'test-button@test.com',
      password: 'hash',
      role: 'admin',
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
    }).returning();
    testUser = user;

    // Create test organization
    const [org] = await db.insert(organizations).values({
      name: 'Test Organization',
      isActive: true,
    }).returning();
    testOrganization = org;

    // Link user to organization
    await db.insert(userOrganizations).values({
      userId: testUser.id,
      organizationId: testOrganization.id,
      isActive: true,
    });

    // Create test building
    const [building] = await db.insert(buildings).values({
      name: 'Test Building',
      address: '123 Test St',
      organizationId: testOrganization.id,
      isActive: true,
    }).returning();
    testBuilding = building;

    // Create test residence
    const [residence] = await db.insert(residences).values({
      unitNumber: '101',
      buildingId: testBuilding.id,
      isActive: true,
    }).returning();
    testResidence = residence;

    // Link user to residence
    await db.insert(userResidences).values({
      userId: testUser.id,
      residenceId: testResidence.id,
      isActive: true,
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser?.id) {
      await db.delete(userResidences).where(eq(userResidences.userId, testUser.id));
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUser.id));
      await db.delete(demands).where(eq(demands.userId, testUser.id));
      await db.delete(bookings).where(eq(bookings.userId, testUser.id));
      await db.delete(userBookingRestrictions).where(eq(userBookingRestrictions.userId, testUser.id));
      await db.delete(userTimeLimits).where(eq(userTimeLimits.userId, testUser.id));
      await db.delete(invitations).where(eq(invitations.email, testUser.email));
      await db.delete(users).where(eq(users.id, testUser.id));
    }
    if (testResidence?.id) {
      await db.delete(residences).where(eq(residences.id, testResidence.id));
    }
    if (testBuilding?.id) {
      await db.delete(commonSpaces).where(eq(commonSpaces.buildingId, testBuilding.id));
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    }
    if (testOrganization?.id) {
      await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
    }
  });

  describe('Create Button Database Persistence', () => {
    it('should persist new common space when create button is used', async () => {
      const spaceData = {
        name: 'Test Common Space',
        description: 'A space for testing',
        building_id: testBuilding.id,
        is_reservable: true,
        capacity: 50,
      };

      // Simulate button click creating a space
      const response = await fetch('/api/common-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spaceData),
      });

      expect(response.ok).toBe(true);

      // Verify data was persisted to database
      const createdSpaces = await db
        .select()
        .from(commonSpaces)
        .where(and(
          eq(commonSpaces.name, spaceData.name),
          eq(commonSpaces.buildingId, testBuilding.id)
        ));

      expect(createdSpaces).toHaveLength(1);
      expect(createdSpaces[0].name).toBe(spaceData.name);
      expect(createdSpaces[0].description).toBe(spaceData.description);
      expect(createdSpaces[0].capacity).toBe(spaceData.capacity);
    });

    it('should persist new demand when create demand button is used', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Test demand description',
        assignationResidenceId: testResidence.id,
      };

      // Simulate button click creating a demand
      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demandData),
      });

      expect(response.ok).toBe(true);

      // Verify data was persisted to database
      const createdDemands = await db
        .select()
        .from(demands)
        .where(and(
          eq(demands.title, demandData.title),
          eq(demands.userId, testUser.id)
        ));

      expect(createdDemands).toHaveLength(1);
      expect(createdDemands[0].title).toBe(demandData.title);
      expect(createdDemands[0].description).toBe(demandData.description);
      expect(createdDemands[0].category).toBe(demandData.category);
      expect(createdDemands[0].priority).toBe(demandData.priority);
    });

    it('should persist new user invitation when invite button is used', async () => {
      const invitationData = {
        email: 'newuser@test.com',
        organizationId: testOrganization.id,
        role: 'resident',
      };

      // Simulate button click creating an invitation
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });

      expect(response.ok).toBe(true);

      // Verify data was persisted to database
      const createdInvitations = await db
        .select()
        .from(invitations)
        .where(eq(invitations.email, invitationData.email));

      expect(createdInvitations).toHaveLength(1);
      expect(createdInvitations[0].email).toBe(invitationData.email);
      expect(createdInvitations[0].role).toBe(invitationData.role);
      expect(createdInvitations[0].organizationId).toBe(testOrganization.id);
    });
  });

  describe('Update Button Database Persistence', () => {
    it('should update demand status when approve button is used', async () => {
      // Create a demand first
      const [demand] = await db.insert(demands).values({
        title: 'Test Demand for Approval',
        description: 'Test description',
        category: 'maintenance',
        priority: 'medium',
        status: 'pending',
        userId: testUser.id,
        residenceId: testResidence.id,
      }).returning();

      // Simulate approve button click
      const response = await fetch(`/api/demands/${demand.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(true);

      // Verify status was updated in database
      const updatedDemands = await db
        .select()
        .from(demands)
        .where(eq(demands.id, demand.id));

      expect(updatedDemands).toHaveLength(1);
      expect(updatedDemands[0].status).toBe('approved');
    });

    it('should update user restriction when block button is used', async () => {
      // Create a common space first
      const [space] = await db.insert(commonSpaces).values({
        name: 'Test Space for Blocking',
        buildingId: testBuilding.id,
        isReservable: true,
      }).returning();

      const restrictionData = {
        common_space_id: space.id,
        is_blocked: true,
        reason: 'Test blocking',
      };

      // Simulate block button click
      const response = await fetch(`/api/common-spaces/users/${testUser.id}/restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restrictionData),
      });

      expect(response.ok).toBe(true);

      // Verify restriction was created in database
      const restrictions = await db
        .select()
        .from(userBookingRestrictions)
        .where(and(
          eq(userBookingRestrictions.userId, testUser.id),
          eq(userBookingRestrictions.commonSpaceId, space.id)
        ));

      expect(restrictions).toHaveLength(1);
      expect(restrictions[0].isBlocked).toBe(true);
      expect(restrictions[0].reason).toBe('Test blocking');
    });

    it('should update time limit when time limit button is used', async () => {
      const timeLimitData = {
        user_id: testUser.id,
        limit_type: 'monthly',
        limit_hours: 10,
      };

      // Simulate time limit button click
      const response = await fetch(`/api/common-spaces/users/${testUser.id}/time-limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timeLimitData),
      });

      expect(response.ok).toBe(true);

      // Verify time limit was created in database
      const timeLimits = await db
        .select()
        .from(userTimeLimits)
        .where(eq(userTimeLimits.userId, testUser.id));

      expect(timeLimits).toHaveLength(1);
      expect(timeLimits[0].limitType).toBe('monthly');
      expect(timeLimits[0].limitHours).toBe(10);
    });
  });

  describe('Delete Button Database Persistence', () => {
    it('should remove data when delete button is used', async () => {
      // Create an invitation first
      const [invitation] = await db.insert(invitations).values({
        email: 'delete-test@test.com',
        organizationId: testOrganization.id,
        role: 'resident',
        token: 'delete-test-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      }).returning();

      // Simulate delete button click
      const response = await fetch(`/api/users/invitations/${invitation.id}`, {
        method: 'DELETE',
      });

      expect(response.ok).toBe(true);

      // Verify data was removed from database
      const remainingInvitations = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, invitation.id));

      expect(remainingInvitations).toHaveLength(0);
    });

    it('should soft delete demand when reject button is used', async () => {
      // Create a demand first
      const [demand] = await db.insert(demands).values({
        title: 'Test Demand for Rejection',
        description: 'Test description',
        category: 'maintenance',
        priority: 'medium',
        status: 'pending',
        userId: testUser.id,
        residenceId: testResidence.id,
      }).returning();

      // Simulate reject button click
      const response = await fetch(`/api/demands/${demand.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.ok).toBe(true);

      // Verify status was updated to rejected (soft delete)
      const updatedDemands = await db
        .select()
        .from(demands)
        .where(eq(demands.id, demand.id));

      expect(updatedDemands).toHaveLength(1);
      expect(updatedDemands[0].status).toBe('rejected');
    });
  });

  describe('Save Button Database Persistence', () => {
    it('should persist user residence assignments when save button is used', async () => {
      // Create another residence for assignment
      const [newResidence] = await db.insert(residences).values({
        unitNumber: '102',
        buildingId: testBuilding.id,
        isActive: true,
      }).returning();

      const assignmentData = {
        residenceIds: [testResidence.id, newResidence.id],
      };

      // Simulate save button click for residence assignments
      const response = await fetch(`/api/users/${testUser.id}/residences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentData),
      });

      expect(response.ok).toBe(true);

      // Verify assignments were persisted to database
      const assignments = await db
        .select()
        .from(userResidences)
        .where(and(
          eq(userResidences.userId, testUser.id),
          eq(userResidences.isActive, true)
        ));

      expect(assignments).toHaveLength(2);
      const residenceIds = assignments.map(a => a.residenceId);
      expect(residenceIds).toContain(testResidence.id);
      expect(residenceIds).toContain(newResidence.id);
    });
  });

  describe('Complex Button Workflow Database Persistence', () => {
    it('should handle complete CRUD workflow with database persistence', async () => {
      // 1. Create a common space
      const spaceData = {
        name: 'Workflow Test Space',
        description: 'Testing complete workflow',
        building_id: testBuilding.id,
        is_reservable: true,
        capacity: 25,
      };

      const createResponse = await fetch('/api/common-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spaceData),
      });

      expect(createResponse.ok).toBe(true);

      // Verify creation in database
      const [createdSpace] = await db
        .select()
        .from(commonSpaces)
        .where(eq(commonSpaces.name, spaceData.name));

      expect(createdSpace).toBeDefined();

      // 2. Update the space
      const updateData = {
        name: 'Updated Workflow Space',
        capacity: 30,
      };

      const updateResponse = await fetch(`/api/common-spaces/${createdSpace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(updateResponse.ok).toBe(true);

      // Verify update in database
      const [updatedSpace] = await db
        .select()
        .from(commonSpaces)
        .where(eq(commonSpaces.id, createdSpace.id));

      expect(updatedSpace.name).toBe(updateData.name);
      expect(updatedSpace.capacity).toBe(updateData.capacity);

      // 3. Create a booking for the space
      const bookingData = {
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
      };

      const bookingResponse = await fetch(`/api/common-spaces/${createdSpace.id}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });

      expect(bookingResponse.ok).toBe(true);

      // Verify booking in database
      const createdBookings = await db
        .select()
        .from(bookings)
        .where(and(
          eq(bookings.commonSpaceId, createdSpace.id),
          eq(bookings.userId, testUser.id)
        ));

      expect(createdBookings).toHaveLength(1);
      expect(createdBookings[0].status).toBe('confirmed');

      // 4. Cancel the booking (delete operation)
      const deleteResponse = await fetch(`/api/common-spaces/bookings/${createdBookings[0].id}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.ok).toBe(true);

      // Verify booking was cancelled in database
      const [cancelledBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, createdBookings[0].id));

      expect(cancelledBooking.status).toBe('cancelled');
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain foreign key relationships when buttons create related data', async () => {
      // Create a demand with proper relationships
      const demandData = {
        title: 'Relationship Test Demand',
        description: 'Testing foreign key relationships',
        category: 'maintenance',
        priority: 'high',
        residenceId: testResidence.id,
      };

      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demandData),
      });

      expect(response.ok).toBe(true);

      // Verify relationships are maintained
      const demandWithRelations = await db
        .select({
          demand: demands,
          user: users,
          residence: residences,
          building: buildings,
        })
        .from(demands)
        .innerJoin(users, eq(demands.userId, users.id))
        .innerJoin(residences, eq(demands.residenceId, residences.id))
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(eq(demands.title, demandData.title));

      expect(demandWithRelations).toHaveLength(1);
      expect(demandWithRelations[0].user.id).toBe(testUser.id);
      expect(demandWithRelations[0].residence.id).toBe(testResidence.id);
      expect(demandWithRelations[0].building.id).toBe(testBuilding.id);
    });

    it('should validate data constraints when buttons attempt invalid operations', async () => {
      // Try to create a common space with invalid building ID
      const invalidSpaceData = {
        name: 'Invalid Space',
        building_id: '00000000-0000-0000-0000-000000000000', // Non-existent building
        is_reservable: true,
      };

      const response = await fetch('/api/common-spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidSpaceData),
      });

      expect(response.ok).toBe(false);

      // Verify no invalid data was created
      const invalidSpaces = await db
        .select()
        .from(commonSpaces)
        .where(eq(commonSpaces.name, invalidSpaceData.name));

      expect(invalidSpaces).toHaveLength(0);
    });
  });
});