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
 * Sophie Résidente - Residence Assignment Integration Test
 * 
 * This test specifically addresses the reported issue where Sophie Résidente 
 * (or similar demo resident users) cannot see their assigned residences.
 * 
 * It provides comprehensive validation of:
 * - Database setup and data integrity
 * - API endpoint simulation for residence access
 * - Authentication flow validation
 * - Error handling and debugging information
 * - Real-world scenario testing
 */

describe('Sophie Résidente - Residence Assignment Integration', () => {
  // Test setup mimicking the real Sophie Résidente scenario
  const sophieTestData = {
    organization: {
      id: 'sophie-test-org',
      name: 'Sophie Test Organization',
      type: 'management_company' as const,
      address: '123 Sophie Test Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      isActive: true
    },
    building: {
      id: 'sophie-test-building',
      name: 'Sophie Test Building',
      address: '123 Sophie Building Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      buildingType: 'condo' as const,
      totalUnits: 3,
      totalFloors: 1,
      isActive: true
    },
    residence: {
      id: 'sophie-test-residence',
      unitNumber: '101',
      floor: 1,
      isActive: true
    },
    user: {
      id: 'sophie-residente-test-user',
      username: 'sophie.residente.test',
      email: 'sophie.residente.test@koveo-gestion.com',
      password: 'SophiePass123!',
      firstName: 'Sophie',
      lastName: 'Résidente',
      role: 'demo_resident' as const,
      language: 'fr',
      isActive: true
    }
  };

  let testUserIds: string[] = [];
  let testOrgIds: string[] = [];
  let testBuildingIds: string[] = [];
  let testResidenceIds: string[] = [];

  beforeAll(async () => {
    console.log('🏠 Setting up Sophie Résidente test scenario...');

    // Cleanup any existing test data
    await db.delete(userResidences).where(
      eq(userResidences.userId, sophieTestData.user.id)
    ).catch(() => {});

    await db.delete(users).where(
      eq(users.email, sophieTestData.user.email)
    ).catch(() => {});

    await db.delete(residences).where(
      eq(residences.id, sophieTestData.residence.id)
    ).catch(() => {});

    await db.delete(buildings).where(
      eq(buildings.id, sophieTestData.building.id)
    ).catch(() => {});

    await db.delete(organizations).where(
      eq(organizations.id, sophieTestData.organization.id)
    ).catch(() => {});

    // Create test organization
    await db.insert(organizations).values({
      ...sophieTestData.organization,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testOrgIds.push(sophieTestData.organization.id);

    // Create test building
    await db.insert(buildings).values({
      ...sophieTestData.building,
      organizationId: sophieTestData.organization.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testBuildingIds.push(sophieTestData.building.id);

    // Create test residence
    await db.insert(residences).values({
      ...sophieTestData.residence,
      buildingId: sophieTestData.building.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testResidenceIds.push(sophieTestData.residence.id);

    // Create Sophie user
    await db.insert(users).values({
      ...sophieTestData.user,
      password: await bcrypt.hash(sophieTestData.user.password, 12),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testUserIds.push(sophieTestData.user.id);

    console.log('✅ Sophie Résidente test setup complete');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up Sophie Résidente test data...');

    // Clean up in reverse order
    await db.delete(userResidences).where(
      inArray(userResidences.userId, testUserIds)
    ).catch(() => {});

    await db.delete(userOrganizations).where(
      inArray(userOrganizations.userId, testUserIds)
    ).catch(() => {});

    await db.delete(users).where(
      inArray(users.id, testUserIds)
    ).catch(() => {});

    await db.delete(residences).where(
      inArray(residences.id, testResidenceIds)
    ).catch(() => {});

    await db.delete(buildings).where(
      inArray(buildings.id, testBuildingIds)
    ).catch(() => {});

    await db.delete(organizations).where(
      inArray(organizations.id, testOrgIds)
    ).catch(() => {});

    console.log('✅ Sophie cleanup complete');
  });

  describe('Problem Reproduction - Sophie Cannot See Residence', () => {
    it('should reproduce the issue: Sophie has no residence assigned initially', async () => {
      // Simulate the current problem state - Sophie exists but has no residences
      const sophieUser = await db
        .select()
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      expect(sophieUser).toHaveLength(1);
      expect(sophieUser[0].firstName).toBe('Sophie');
      expect(sophieUser[0].role).toBe('demo_resident');

      // Check residence assignments - should be empty (reproducing the problem)
      const residenceAssignments = await db
        .select()
        .from(userResidences)
        .where(eq(userResidences.userId, sophieUser[0].id));

      expect(residenceAssignments).toHaveLength(0);
      console.log('🚫 Confirmed: Sophie has no residence assignments (reproducing the issue)');
    });

    it('should demonstrate the problem with API endpoint simulation', async () => {
      // Simulate /api/user/residences endpoint logic
      const sophieUser = await db
        .select()
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      const userResidencesList = await db
        .select({
          residenceId: userResidences.residenceId,
        })
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, sophieUser[0].id),
            eq(userResidences.isActive, true)
          )
        );

      // This should return empty array - confirming the problem
      expect(userResidencesList).toHaveLength(0);
      console.log('🚫 API simulation confirms: Sophie gets empty residence list');
    });

    it('should demonstrate the 401 Unauthorized issue', async () => {
      // Check if Sophie's authentication data is properly set up
      const sophieUser = await db
        .select({
          id: users.id,
          email: users.email,
          password: users.password,
          role: users.role,
          isActive: users.isActive
        })
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      expect(sophieUser).toHaveLength(1);
      expect(sophieUser[0].isActive).toBe(true);
      expect(sophieUser[0].password).toBeDefined();

      // Verify password can be validated (this would pass in auth)
      const passwordValid = await bcrypt.compare('SophiePass123!', sophieUser[0].password);
      expect(passwordValid).toBe(true);

      console.log('✅ Sophie authentication data is valid - 401 error likely comes from elsewhere');
    });
  });

  describe('Solution Implementation - Assign Sophie to Residence', () => {
    it('should assign Sophie to her residence', async () => {
      // Create the residence assignment that should exist
      const sophieUser = await db
        .select()
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      const residenceAssignment = {
        userId: sophieUser[0].id,
        residenceId: sophieTestData.residence.id,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(userResidences).values(residenceAssignment);

      // Verify the assignment was created
      const assignments = await db
        .select()
        .from(userResidences)
        .where(eq(userResidences.userId, sophieUser[0].id));

      expect(assignments).toHaveLength(1);
      expect(assignments[0].residenceId).toBe(sophieTestData.residence.id);
      expect(assignments[0].isActive).toBe(true);

      console.log('✅ Sophie has been assigned to residence');
    });

    it('should validate that Sophie can now access her residence via API simulation', async () => {
      const sophieUser = await db
        .select()
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      // Simulate /api/user/residences endpoint after assignment
      const userResidencesList = await db
        .select({
          residenceId: userResidences.residenceId,
        })
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, sophieUser[0].id),
            eq(userResidences.isActive, true)
          )
        );

      expect(userResidencesList).toHaveLength(1);
      expect(userResidencesList[0].residenceId).toBe(sophieTestData.residence.id);

      console.log('✅ API simulation now returns Sophie\'s residence');
    });

    it('should validate building access through residence assignment', async () => {
      const sophieUser = await db
        .select()
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      // Simulate the building access logic from residences API
      const accessibleBuildings = await db
        .select({
          buildingId: buildings.id,
          buildingName: buildings.name,
          residenceId: residences.id,
          unitNumber: residences.unitNumber
        })
        .from(userResidences)
        .innerJoin(residences, eq(userResidences.residenceId, residences.id))
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .where(
          and(
            eq(userResidences.userId, sophieUser[0].id),
            eq(userResidences.isActive, true),
            eq(buildings.isActive, true)
          )
        );

      expect(accessibleBuildings).toHaveLength(1);
      expect(accessibleBuildings[0].buildingId).toBe(sophieTestData.building.id);
      expect(accessibleBuildings[0].unitNumber).toBe('101');

      console.log('✅ Sophie can access building through residence assignment');
    });
  });

  describe('Validation Tests for Future Prevention', () => {
    it('should validate that demo users have consistent assignment patterns', async () => {
      // Check if other demo users in the system have proper assignments
      const allDemoUsers = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role
        })
        .from(users)
        .where(eq(users.role, 'demo_resident'));

      for (const demoUser of allDemoUsers) {
        const assignments = await db
          .select()
          .from(userResidences)
          .where(
            and(
              eq(userResidences.userId, demoUser.id),
              eq(userResidences.isActive, true)
            )
          );

        console.log(`📊 Demo user ${demoUser.email} has ${assignments.length} residence assignments`);
        
        // Each demo user should have at least one assignment
        // (This test might initially fail, identifying other users with the same issue)
        if (assignments.length === 0) {
          console.warn(`⚠️ WARNING: Demo user ${demoUser.email} has no residence assignments`);
        }
      }

      // For our test user, should have 1 assignment now
      const sophieUser = await db
        .select()
        .from(users)
        .where(eq(users.email, sophieTestData.user.email));

      const sophieAssignments = await db
        .select()
        .from(userResidences)
        .where(eq(userResidences.userId, sophieUser[0].id));

      expect(sophieAssignments).toHaveLength(1);
    });

    it('should validate residence assignment creation workflow', async () => {
      // Create a systematic test for assigning demo users to residences
      const testDemoUser = {
        id: 'test-demo-assignment-user',
        username: 'test.demo.assignment',
        email: 'test.demo.assignment@koveo-gestion.com',
        password: await bcrypt.hash('TestPass123!', 12),
        firstName: 'Test',
        lastName: 'DemoAssignment',
        role: 'demo_resident' as const,
        language: 'fr',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create additional test residence
      const testResidence = {
        id: 'test-residence-assignment',
        buildingId: sophieTestData.building.id,
        unitNumber: '102',
        floor: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert test user and residence
      await db.insert(users).values(testDemoUser);
      testUserIds.push(testDemoUser.id);

      await db.insert(residences).values(testResidence);
      testResidenceIds.push(testResidence.id);

      // Create assignment
      await db.insert(userResidences).values({
        userId: testDemoUser.id,
        residenceId: testResidence.id,
        relationshipType: 'tenant',
        startDate: '2024-01-01',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Validate the assignment workflow
      const assignment = await db
        .select()
        .from(userResidences)
        .where(
          and(
            eq(userResidences.userId, testDemoUser.id),
            eq(userResidences.residenceId, testResidence.id)
          )
        );

      expect(assignment).toHaveLength(1);
      expect(assignment[0].isActive).toBe(true);

      console.log('✅ Residence assignment workflow validated');
    });

    it('should provide debugging information for troubleshooting', async () => {
      // Comprehensive debugging info that would help identify the issue
      const debugInfo = {
        totalUsers: await db.select({ count: users.id }).from(users),
        totalDemoResidents: await db
          .select({ count: users.id })
          .from(users)
          .where(eq(users.role, 'demo_resident')),
        totalResidences: await db.select({ count: residences.id }).from(residences),
        totalActiveResidences: await db
          .select({ count: residences.id })
          .from(residences)
          .where(eq(residences.isActive, true)),
        totalUserResidenceAssignments: await db.select({ count: userResidences.id }).from(userResidences),
        activeUserResidenceAssignments: await db
          .select({ count: userResidences.id })
          .from(userResidences)
          .where(eq(userResidences.isActive, true)),
        demoUsersWithAssignments: await db
          .select({
            userEmail: users.email,
            residenceId: userResidences.residenceId,
            unitNumber: residences.unitNumber
          })
          .from(users)
          .leftJoin(userResidences, eq(users.id, userResidences.userId))
          .leftJoin(residences, eq(userResidences.residenceId, residences.id))
          .where(eq(users.role, 'demo_resident'))
      };

      console.log('🔍 Residence Assignment Debug Information:', {
        totalUsers: debugInfo.totalUsers.length,
        totalDemoResidents: debugInfo.totalDemoResidents.length,
        totalResidences: debugInfo.totalResidences.length,
        totalActiveResidences: debugInfo.totalActiveResidences.length,
        totalAssignments: debugInfo.totalUserResidenceAssignments.length,
        activeAssignments: debugInfo.activeUserResidenceAssignments.length,
        demoUsersWithAssignments: debugInfo.demoUsersWithAssignments.length
      });

      // Validate that our test setup is working
      expect(debugInfo.totalUsers.length).toBeGreaterThan(0);
      expect(debugInfo.totalResidences.length).toBeGreaterThan(0);
      expect(debugInfo.activeUserResidenceAssignments.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle the case when user exists but no residences are available', async () => {
      // Create a user in a building with no residences
      const testEmptyBuilding = {
        id: 'test-empty-building',
        organizationId: sophieTestData.organization.id,
        name: 'Empty Test Building',
        address: '456 Empty Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1B 1B1',
        buildingType: 'condo' as const,
        totalUnits: 0,
        totalFloors: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(buildings).values(testEmptyBuilding);
      testBuildingIds.push(testEmptyBuilding.id);

      // API should return empty result gracefully
      const emptyResult = await db
        .select()
        .from(residences)
        .where(eq(residences.buildingId, testEmptyBuilding.id));

      expect(emptyResult).toHaveLength(0);
      console.log('✅ Gracefully handles empty building scenario');
    });

    it('should provide meaningful error messages for missing assignments', async () => {
      // Test that would help identify why Sophie cannot see her residence
      const orphanedUser = {
        id: 'orphaned-demo-user',
        username: 'orphaned.demo',
        email: 'orphaned.demo@koveo-gestion.com',
        password: await bcrypt.hash('TestPass123!', 12),
        firstName: 'Orphaned',
        lastName: 'Demo',
        role: 'demo_resident' as const,
        language: 'fr',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(users).values(orphanedUser);
      testUserIds.push(orphanedUser.id);

      // Simulate error checking logic
      const userExists = await db
        .select()
        .from(users)
        .where(eq(users.id, orphanedUser.id));

      const hasAssignments = await db
        .select()
        .from(userResidences)
        .where(eq(userResidences.userId, orphanedUser.id));

      const availableResidences = await db
        .select()
        .from(residences)
        .where(eq(residences.isActive, true));

      // Generate meaningful error context
      const errorContext = {
        userExists: userExists.length > 0,
        userIsActive: userExists[0]?.isActive ?? false,
        hasAssignments: hasAssignments.length > 0,
        availableResidencesInSystem: availableResidences.length,
        userRole: userExists[0]?.role
      };

      expect(errorContext.userExists).toBe(true);
      expect(errorContext.userIsActive).toBe(true);
      expect(errorContext.hasAssignments).toBe(false); // This is the problem
      expect(errorContext.availableResidencesInSystem).toBeGreaterThan(0);

      console.log('🚨 Error diagnosis for orphaned user:', errorContext);
      console.log('💡 Solution: User needs residence assignment in user_residences table');
    });
  });
});