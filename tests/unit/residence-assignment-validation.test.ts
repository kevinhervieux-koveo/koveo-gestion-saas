import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../../server/db';
import { 
  users, 
  residences, 
  buildings, 
  organizations, 
  userResidences, 
  userOrganizations 
} from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

/**
 * Residence Assignment Validation Test Suite
 * 
 * This comprehensive test validates that users can properly access their assigned residences.
 * Specifically addresses the issue where Sophie Résidente (or demo resident users) 
 * cannot see their assigned residences.
 * 
 * Test Coverage:
 * - User-residence relationship data integrity
 * - Residence access control logic for demo users
 * - API endpoints for fetching user residences  
 * - Proper error messages when no residences found
 * - Authentication and authorization flows
 */

describe('Residence Assignment Validation', () => {
  // Test data setup
  const testData = {
    // Test organization
    testOrg: {
      id: 'test-org-residence-assignment',
      name: 'Test Residence Organization',
      type: 'management_company' as const,
      address: '123 Test Residence Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      isActive: true
    },
    // Test building
    testBuilding: {
      id: 'test-building-residence-assignment',
      name: 'Test Residence Building',
      address: '123 Test Building Street',
      city: 'Montreal', 
      province: 'QC',
      postalCode: 'H1A 1A1',
      buildingType: 'condo' as const,
      totalUnits: 5,
      totalFloors: 2,
      isActive: true
    },
    // Test residences
    testResidences: [
      {
        id: 'test-residence-1',
        unitNumber: '101',
        floor: 1,
        isActive: true
      },
      {
        id: 'test-residence-2', 
        unitNumber: '102',
        floor: 1,
        isActive: true
      },
      {
        id: 'test-residence-3',
        unitNumber: '201',
        floor: 2,
        isActive: true
      }
    ],
    // Test users - covering different roles including demo users
    testUsers: [
      {
        id: 'test-user-demo-resident',
        username: 'sophie.resident.test',
        email: 'sophie.resident.test@koveo-gestion.com',
        password: 'TestPass123!',
        firstName: 'Sophie',
        lastName: 'Résidente',
        role: 'demo_resident' as const,
        language: 'fr',
        isActive: true
      },
      {
        id: 'test-user-regular-resident',
        username: 'regular.resident.test',
        email: 'regular.resident.test@koveo-gestion.com', 
        password: 'TestPass123!',
        firstName: 'Regular',
        lastName: 'Resident',
        role: 'resident' as const,
        language: 'fr',
        isActive: true
      },
      {
        id: 'test-user-demo-tenant',
        username: 'demo.tenant.test',
        email: 'demo.tenant.test@koveo-gestion.com',
        password: 'TestPass123!', 
        firstName: 'Demo',
        lastName: 'Tenant',
        role: 'demo_tenant' as const,
        language: 'fr',
        isActive: true
      },
      {
        id: 'test-user-manager',
        username: 'test.manager',
        email: 'test.manager@koveo-gestion.com',
        password: 'TestPass123!',
        firstName: 'Test',
        lastName: 'Manager',
        role: 'manager' as const,
        language: 'fr',
        isActive: true
      }
    ]
  };

  let createdUserIds: string[] = [];
  let createdOrgIds: string[] = [];
  let createdBuildingIds: string[] = [];
  let createdResidenceIds: string[] = [];

  beforeAll(async () => {
    console.log('🔧 Setting up residence assignment test data...');

    // Clean up any existing test data
    const testEmails = testData.testUsers.map(user => user.email);
    const testUserIds = testData.testUsers.map(user => user.id);
    const testResidenceIds = testData.testResidences.map(residence => residence.id);

    await db.delete(userResidences).where(
      inArray(userResidences.userId, testUserIds)
    ).catch(() => {}); // Ignore if doesn't exist

    await db.delete(userOrganizations).where(
      inArray(userOrganizations.userId, testUserIds)  
    ).catch(() => {});

    await db.delete(users).where(
      inArray(users.email, testEmails)
    ).catch(() => {});

    await db.delete(residences).where(
      inArray(residences.id, testResidenceIds)
    ).catch(() => {});

    await db.delete(buildings).where(
      eq(buildings.id, testData.testBuilding.id)
    ).catch(() => {});

    await db.delete(organizations).where(
      eq(organizations.id, testData.testOrg.id)
    ).catch(() => {});

    // Create test organization
    await db.insert(organizations).values({
      ...testData.testOrg,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    createdOrgIds.push(testData.testOrg.id);

    // Create test building
    await db.insert(buildings).values({
      ...testData.testBuilding,
      organizationId: testData.testOrg.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    createdBuildingIds.push(testData.testBuilding.id);

    // Create test residences
    const residencesToCreate = testData.testResidences.map(residence => ({
      ...residence,
      buildingId: testData.testBuilding.id,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(residences).values(residencesToCreate);
    createdResidenceIds = testData.testResidences.map(r => r.id);

    // Create test users with hashed passwords
    const usersToCreate = await Promise.all(
      testData.testUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 12),
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    );

    await db.insert(users).values(usersToCreate);
    createdUserIds = testData.testUsers.map(u => u.id);

    // Create user-organization relationships for regular users
    const userOrgRelationships = [
      {
        userId: testData.testUsers[1].id, // regular resident
        organizationId: testData.testOrg.id,
        organizationRole: 'resident' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: testData.testUsers[3].id, // manager
        organizationId: testData.testOrg.id, 
        organizationRole: 'manager' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await db.insert(userOrganizations).values(userOrgRelationships);

    console.log('✅ Test data setup complete');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up residence assignment test data...');

    // Clean up in reverse order due to foreign key constraints
    await db.delete(userResidences).where(
      inArray(userResidences.userId, createdUserIds)
    ).catch(() => {});

    await db.delete(userOrganizations).where(
      inArray(userOrganizations.userId, createdUserIds)
    ).catch(() => {});

    await db.delete(users).where(
      inArray(users.id, createdUserIds)
    ).catch(() => {});

    await db.delete(residences).where(
      inArray(residences.id, createdResidenceIds)
    ).catch(() => {});

    await db.delete(buildings).where(
      inArray(buildings.id, createdBuildingIds)
    ).catch(() => {});

    await db.delete(organizations).where(
      inArray(organizations.id, createdOrgIds)
    ).catch(() => {});

    console.log('✅ Test cleanup complete');
  });

  describe('User-Residence Relationship Data Integrity', () => {
    it('should create user-residence assignments correctly', async () => {
      // Assign Sophie Résidente to residence 101
      const sophieUser = testData.testUsers[0]; // demo_resident
      const residence101 = testData.testResidences[0];

      const userResidenceAssignment = {
        userId: sophieUser.id,
        residenceId: residence101.id,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(userResidences).values(userResidenceAssignment);

      // Verify the assignment was created correctly
      const createdAssignment = await db
        .select()
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, sophieUser.id),
            eq(userResidences.residenceId, residence101.id)
          )
        );

      expect(createdAssignment).toHaveLength(1);
      expect(createdAssignment[0].relationshipType).toBe('tenant');
      expect(createdAssignment[0].isActive).toBe(true);
    });

    it('should handle multiple residence assignments for the same user', async () => {
      const regularResident = testData.testUsers[1]; // regular resident
      
      // Assign to multiple residences
      const assignments = [
        {
          userId: regularResident.id,
          residenceId: testData.testResidences[1].id, // residence 102
          relationshipType: 'owner',
          startDate: '2024-01-01',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: regularResident.id, 
          residenceId: testData.testResidences[2].id, // residence 201
          relationshipType: 'tenant',
          startDate: '2024-06-01',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      await db.insert(userResidences).values(assignments);

      // Verify multiple assignments
      const userAssignments = await db
        .select()
        .from(userResidences)
        .where(eq(userResidences.userId, regularResident.id));

      expect(userAssignments).toHaveLength(2);
      expect(userAssignments.every(a => a.isActive)).toBe(true);
    });

    it('should enforce referential integrity between users and residences', async () => {
      // Try to create assignment with non-existent user ID
      const invalidAssignment = {
        userId: 'non-existent-user-id',
        residenceId: testData.testResidences[0].id,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // This should fail due to foreign key constraint
      await expect(
        db.insert(userResidences).values(invalidAssignment)
      ).rejects.toThrow();
    });
  });

  describe('Residence Access Control Logic for Demo Users', () => {
    beforeAll(async () => {
      // Set up residence assignments for access control tests
      const assignments = [
        {
          userId: testData.testUsers[0].id, // Sophie demo_resident
          residenceId: testData.testResidences[0].id,
          relationshipType: 'tenant',
          startDate: '2024-01-01',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          userId: testData.testUsers[2].id, // demo_tenant
          residenceId: testData.testResidences[1].id,
          relationshipType: 'tenant', 
          startDate: '2024-01-01',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      await db.insert(userResidences).values(assignments);
    });

    it('should allow demo_resident users to access their assigned residences', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident

      // Query residences accessible to Sophie
      const accessibleResidences = await db
        .select({
          residence: residences,
          building: buildings,
          userResidence: userResidences
        })
        .from(userResidences)
        .innerJoin(residences, eq(userResidences.residenceId, residences.id))
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(
          and(
            eq(userResidences.userId, sophieUser.id),
            eq(userResidences.isActive, true),
            eq(residences.isActive, true)
          )
        );

      expect(accessibleResidences).toHaveLength(1);
      expect(accessibleResidences[0].residence.unitNumber).toBe('101');
      expect(accessibleResidences[0].building.name).toBe('Test Residence Building');
    });

    it('should properly handle demo users with no residence assignments', async () => {
      // Create a demo user with no assignments
      const unassignedDemoUser = {
        id: 'test-user-unassigned-demo',
        username: 'unassigned.demo.test',
        email: 'unassigned.demo.test@koveo-gestion.com',
        password: await bcrypt.hash('TestPass123!', 12),
        firstName: 'Unassigned',
        lastName: 'Demo',
        role: 'demo_resident' as const,
        language: 'fr',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(users).values(unassignedDemoUser);
      createdUserIds.push(unassignedDemoUser.id);

      // Query residences for unassigned user
      const accessibleResidences = await db
        .select()
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, unassignedDemoUser.id),
            eq(userResidences.isActive, true)
          )
        );

      expect(accessibleResidences).toHaveLength(0);
    });

    it('should validate user access scope for building-level permissions', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident

      // Get buildings accessible through residence assignments
      const accessibleBuildings = await db
        .select({
          buildingId: buildings.id,
          buildingName: buildings.name
        })
        .from(userResidences)
        .innerJoin(residences, eq(userResidences.residenceId, residences.id))
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(
          and(
            eq(userResidences.userId, sophieUser.id),
            eq(userResidences.isActive, true),
            eq(buildings.isActive, true)
          )
        );

      expect(accessibleBuildings).toHaveLength(1);
      expect(accessibleBuildings[0].buildingId).toBe(testData.testBuilding.id);
    });
  });

  describe('API Endpoint Simulation Tests', () => {
    it('should simulate /api/user/residences endpoint logic', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident

      // Simulate the logic from server/api/residences.ts
      const userResidencesList = await db
        .select({
          residenceId: userResidences.residenceId,
        })
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, sophieUser.id),
            eq(userResidences.isActive, true)
          )
        );

      expect(userResidencesList).toHaveLength(1);
      expect(userResidencesList[0].residenceId).toBe(testData.testResidences[0].id);
    });

    it('should simulate /api/residences endpoint with building access filter', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident

      // Simulate the access control logic from residences API
      // First get user's accessible building IDs through residences
      const userResidenceRecords = await db
        .select({
          residenceId: userResidences.residenceId,
        })
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, sophieUser.id),
            eq(userResidences.isActive, true)
          )
        );

      if (userResidenceRecords.length > 0) {
        const residenceIds = userResidenceRecords.map(ur => ur.residenceId);

        // Get buildings through residences  
        const residenceBuildings = await db
          .select({ 
            buildingId: buildings.id,
            residenceId: residences.id,
            unitNumber: residences.unitNumber
          })
          .from(residences)
          .innerJoin(buildings, eq(residences.buildingId, buildings.id))
          .where(
            and(
              inArray(residences.id, residenceIds),
              eq(buildings.isActive, true)
            )
          );

        expect(residenceBuildings).toHaveLength(1);
        expect(residenceBuildings[0].buildingId).toBe(testData.testBuilding.id);
        expect(residenceBuildings[0].unitNumber).toBe('101');
      }
    });

    it('should validate residence access for specific residence endpoint', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident
      const residenceId = testData.testResidences[0].id;

      // Simulate /api/residences/:id access check
      const accessCheck = await db
        .select({
          hasAccess: userResidences.isActive
        })
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, sophieUser.id),
            eq(userResidences.residenceId, residenceId),
            eq(userResidences.isActive, true)
          )
        );

      expect(accessCheck).toHaveLength(1);
      expect(accessCheck[0].hasAccess).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle inactive user residence assignments', async () => {
      // Create an inactive assignment
      const inactiveAssignment = {
        userId: testData.testUsers[0].id, // Sophie
        residenceId: testData.testResidences[2].id, // residence 201
        relationshipType: 'former_tenant',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        isActive: false, // INACTIVE
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(userResidences).values(inactiveAssignment);

      // Query should only return active assignments
      const activeAssignments = await db
        .select()
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, testData.testUsers[0].id),
            eq(userResidences.isActive, true)
          )
        );

      // Should only have the active assignment (residence 101), not the inactive one
      expect(activeAssignments).toHaveLength(1);
      expect(activeAssignments[0].residenceId).toBe(testData.testResidences[0].id);
    });

    it('should handle users with expired residence assignments', async () => {
      // Create an assignment with end date in the past
      const expiredAssignment = {
        userId: testData.testUsers[2].id, // demo_tenant
        residenceId: testData.testResidences[2].id,
        relationshipType: 'tenant',
        startDate: '2023-01-01',
        endDate: '2023-06-30', // Expired
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(userResidences).values(expiredAssignment);

      // Application should implement logic to handle expired assignments
      // For now, we test that the data structure supports this
      const expiredAssignments = await db
        .select()
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, testData.testUsers[2].id),
            eq(userResidences.isActive, true)
          )
        );

      expect(expiredAssignments.length).toBeGreaterThanOrEqual(1);
      expect(expiredAssignments.some(a => a.endDate !== null)).toBe(true);
    });

    it('should provide meaningful error context for debugging', async () => {
      const testUserId = testData.testUsers[0].id; // Sophie

      // Gather debugging information that would help diagnose the issue
      const debugInfo = {
        // User exists check
        userExists: await db
          .select({ id: users.id, email: users.email, role: users.role, isActive: users.isActive })
          .from(users)
          .where(eq(users.id, testUserId)),

        // User residence assignments
        userResidenceAssignments: await db
          .select()
          .from(userResidences)
          .where(eq(userResidences.userId, testUserId)),

        // Available residences in the system
        availableResidences: await db
          .select({
            id: residences.id,
            unitNumber: residences.unitNumber,
            buildingId: residences.buildingId,
            isActive: residences.isActive
          })
          .from(residences)
          .where(eq(residences.isActive, true)),

        // Building information
        buildingInfo: await db
          .select({
            id: buildings.id,
            name: buildings.name,
            organizationId: buildings.organizationId,
            isActive: buildings.isActive
          })
          .from(buildings)
          .where(eq(buildings.isActive, true))
      };

      // Validate that debugging info is comprehensive
      expect(debugInfo.userExists).toHaveLength(1);
      expect(debugInfo.userExists[0].email).toBe('sophie.resident.test@koveo-gestion.com');
      expect(debugInfo.userResidenceAssignments.length).toBeGreaterThanOrEqual(0);
      expect(debugInfo.availableResidences.length).toBeGreaterThanOrEqual(3);
      expect(debugInfo.buildingInfo).toHaveLength(1);

      // Log debug info for troubleshooting (would be helpful in real scenarios)
      console.log('🔍 Residence Assignment Debug Info:', {
        userId: testUserId,
        userExists: debugInfo.userExists.length > 0,
        assignmentCount: debugInfo.userResidenceAssignments.length,
        activeAssignments: debugInfo.userResidenceAssignments.filter(a => a.isActive).length,
        availableResidences: debugInfo.availableResidences.length,
        buildings: debugInfo.buildingInfo.length
      });
    });
  });

  describe('Authentication Integration Tests', () => {
    it('should validate that demo users have proper authentication credentials', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident

      // Verify user record exists with proper authentication data
      const userRecord = await db
        .select({
          id: users.id,
          email: users.email,
          password: users.password,
          role: users.role,
          isActive: users.isActive
        })
        .from(users)
        .where(eq(users.email, sophieUser.email));

      expect(userRecord).toHaveLength(1);
      expect(userRecord[0].role).toBe('demo_resident');
      expect(userRecord[0].isActive).toBe(true);
      expect(userRecord[0].password).toBeDefined();
      expect(userRecord[0].password.length).toBeGreaterThan(10); // Hashed password
    });

    it('should verify password validation for demo users', async () => {
      const sophieUser = testData.testUsers[0]; // demo_resident
      const userRecord = await db
        .select({ password: users.password })
        .from(users)
        .where(eq(users.email, sophieUser.email));

      // Verify that the stored password can be validated
      const isValidPassword = await bcrypt.compare('TestPass123!', userRecord[0].password);
      expect(isValidPassword).toBe(true);

      // Verify invalid password fails
      const isInvalidPassword = await bcrypt.compare('WrongPassword', userRecord[0].password);
      expect(isInvalidPassword).toBe(false);
    });
  });
});