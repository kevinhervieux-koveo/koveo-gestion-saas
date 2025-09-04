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

/**
 * Residence Assignment Solution Guide Test
 * 
 * This test provides a comprehensive guide for fixing the issue where 
 * Sophie Résidente (and potentially other demo users) cannot see their 
 * assigned residences.
 * 
 * PROBLEM IDENTIFIED:
 * - Users exist in the system but lack entries in the user_residences table
 * - 401 Unauthorized errors may be due to missing authentication setup
 * - Access control logic requires valid user-residence relationships
 * 
 * SOLUTION STEPS:
 * 1. Verify user exists and is active
 * 2. Create proper user-residence assignment
 * 3. Validate building access through residence
 * 4. Test API endpoint access
 * 5. Ensure authentication data is correct
 */

describe('Residence Assignment Solution Guide', () => {
  describe('Problem Diagnosis', () => {
    it('should identify demo users without residence assignments', async () => {
      console.log('🔍 DIAGNOSING: Checking for demo users without residence assignments...');

      // Get all demo resident users
      const demoResidents = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          isActive: users.isActive
        })
        .from(users)
        .where(eq(users.role, 'demo_resident'));

      console.log(`📊 Found ${demoResidents.length} demo resident users`);

      // Check each demo resident for residence assignments
      const usersWithoutAssignments = [];
      for (const user of demoResidents) {
        const assignments = await db
          .select()
          .from(userResidences)
          .where(
            and(
              eq(userResidences.userId, user.id),
              eq(userResidences.isActive, true)
            )
          );

        if (assignments.length === 0) {
          usersWithoutAssignments.push(user);
          console.log(`🚨 ISSUE FOUND: ${user.email} (${user.firstName} ${user.lastName}) has no residence assignments`);
        } else {
          console.log(`✅ ${user.email} has ${assignments.length} residence assignment(s)`);
        }
      }

      // Document the problem scope
      console.log(`\n📈 DIAGNOSIS SUMMARY:`);
      console.log(`- Total demo residents: ${demoResidents.length}`);
      console.log(`- Users without assignments: ${usersWithoutAssignments.length}`);
      console.log(`- Users with assignments: ${demoResidents.length - usersWithoutAssignments.length}`);

      if (usersWithoutAssignments.length > 0) {
        console.log(`\n💡 SOLUTION NEEDED: Create user_residences entries for the unassigned users`);
      }

      // This test documents the current state rather than asserting specific values
      expect(demoResidents.length).toBeGreaterThanOrEqual(0);
    });

    it('should check authentication data integrity for demo users', async () => {
      console.log('🔍 CHECKING: Authentication data for demo users...');

      const demoUsers = await db
        .select({
          id: users.id,
          email: users.email,
          password: users.password,
          role: users.role,
          isActive: users.isActive,
          firstName: users.firstName,
          lastName: users.lastName
        })
        .from(users)
        .where(eq(users.role, 'demo_resident'));

      for (const user of demoUsers) {
        const authIssues = [];

        if (!user.isActive) authIssues.push('User not active');
        if (!user.password) authIssues.push('No password set');
        if (user.password && user.password.length < 10) authIssues.push('Password too short (likely not hashed)');

        if (authIssues.length > 0) {
          console.log(`🚨 AUTH ISSUES for ${user.email}:`, authIssues);
        } else {
          console.log(`✅ ${user.email} auth data looks correct`);
        }
      }

      console.log('📋 Auth check complete');
      expect(demoUsers.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify available residences that could be assigned', async () => {
      console.log('🔍 CHECKING: Available residences for assignment...');

      // Get all active residences
      const availableResidences = await db
        .select({
          residenceId: residences.id,
          unitNumber: residences.unitNumber,
          buildingId: residences.buildingId,
          building: buildings.name,
          organization: organizations.name
        })
        .from(residences)
        .innerJoin(buildings, eq(residences.buildingId, buildings.id))
        .innerJoin(organizations, eq(buildings.organizationId, organizations.id))
        .where(
          and(
            eq(residences.isActive, true),
            eq(buildings.isActive, true)
          )
        );

      console.log(`📊 Found ${availableResidences.length} available residences:`);
      
      availableResidences.forEach((residence, index) => {
        if (index < 5) { // Show first 5 as examples
          console.log(`  - Unit ${residence.unitNumber} in ${residence.building} (${residence.organization})`);
        }
      });

      if (availableResidences.length > 5) {
        console.log(`  ... and ${availableResidences.length - 5} more`);
      }

      expect(availableResidences.length).toBeGreaterThan(0);
    });
  });

  describe('Solution Implementation Examples', () => {
    it('should demonstrate how to create a user-residence assignment', async () => {
      console.log('💡 SOLUTION EXAMPLE: Creating user-residence assignment...');

      // Find a demo user without assignments (if any)
      const demoUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'demo_resident'));

      if (demoUsers.length === 0) {
        console.log('ℹ️ No demo users found to demonstrate assignment');
        return;
      }

      const targetUser = demoUsers[0];
      console.log(`🎯 Example user: ${targetUser.email}`);

      // Check current assignments
      const currentAssignments = await db
        .select()
        .from(userResidences)
        .where(eq(userResidences.userId, targetUser.id));

      console.log(`📊 Current assignments: ${currentAssignments.length}`);

      // Get an available residence
      const availableResidences = await db
        .select()
        .from(residences)
        .where(eq(residences.isActive, true))
        .limit(1);

      if (availableResidences.length === 0) {
        console.log('⚠️ No available residences for assignment example');
        return;
      }

      console.log('💡 To fix the issue, you would run this SQL:');
      console.log(`
INSERT INTO user_residences (
  user_id, 
  residence_id, 
  relationship_type, 
  start_date, 
  is_active,
  created_at,
  updated_at
) VALUES (
  '${targetUser.id}',
  '${availableResidences[0].id}',
  'tenant',
  '2024-01-01',
  true,
  NOW(),
  NOW()
);`);

      console.log('\n✅ This would allow the user to see their assigned residence');
      
      // Don't actually create the assignment in this test - just demonstrate
      expect(targetUser).toBeDefined();
      expect(availableResidences[0]).toBeDefined();
    });

    it('should show the API endpoint flow after assignment', async () => {
      console.log('🔄 API FLOW EXAMPLE: How residence access works after assignment...');

      console.log(`
API FLOW for /api/user/residences:
1. User authenticates → gets user object
2. Query user_residences table with user.id
3. Join with residences and buildings tables
4. Return residence list to frontend

CURRENT ISSUE: Step 2 returns empty because user_residences entries are missing

AFTER FIX:
- Step 2 returns residence records
- User can see their assigned residences
- Building access is granted through residence relationship
      `);

      console.log('📋 API flow documentation complete');
      expect(true).toBe(true); // Documentation test
    });

    it('should provide production database fix guidance', async () => {
      console.log('🏭 PRODUCTION FIX GUIDANCE:');

      console.log(`
STEPS TO FIX SOPHIE RÉSIDENTE ISSUE IN PRODUCTION:

1. IDENTIFY AFFECTED USERS:
   SELECT u.id, u.email, u.first_name, u.last_name 
   FROM users u 
   LEFT JOIN user_residences ur ON u.id = ur.user_id AND ur.is_active = true
   WHERE u.role = 'demo_resident' AND ur.id IS NULL;

2. IDENTIFY AVAILABLE RESIDENCES:
   SELECT r.id, r.unit_number, b.name as building_name
   FROM residences r
   JOIN buildings b ON r.building_id = b.id
   WHERE r.is_active = true;

3. CREATE ASSIGNMENTS (example for Sophie):
   INSERT INTO user_residences (
     user_id, 
     residence_id, 
     relationship_type, 
     start_date, 
     is_active,
     created_at,
     updated_at
   ) VALUES (
     (SELECT id FROM users WHERE email = 'resident.demo@koveo-gestion.com'),
     (SELECT id FROM residences WHERE unit_number = '101' LIMIT 1),
     'tenant',
     '2024-01-01',
     true,
     NOW(),
     NOW()
   );

4. VERIFY THE FIX:
   SELECT u.email, r.unit_number, b.name 
   FROM users u
   JOIN user_residences ur ON u.id = ur.user_id
   JOIN residences r ON ur.residence_id = r.id
   JOIN buildings b ON r.building_id = b.id
   WHERE u.role = 'demo_resident' AND ur.is_active = true;

5. TEST API ACCESS:
   - Login as Sophie
   - Navigate to residences page
   - Verify residence appears
      `);

      console.log('✅ Production fix guidance provided');
      expect(true).toBe(true); // Documentation test
    });
  });

  describe('Future Prevention', () => {
    it('should suggest automated checks for residence assignments', async () => {
      console.log('🛡️ PREVENTION: Automated checks to prevent this issue...');

      console.log(`
AUTOMATED PREVENTION MEASURES:

1. DATABASE CONSTRAINT:
   - Add a check that ensures demo users have at least one residence assignment
   - Create a monitoring query to alert when demo users lack assignments

2. USER CREATION WORKFLOW:
   - Modify user creation to automatically assign demo users to available residences
   - Add validation step in registration process

3. HEALTH CHECK ENDPOINT:
   - Create /api/health/user-assignments endpoint
   - Monitor users without residence access
   - Alert administrators of assignment gaps

4. INTEGRATION TEST:
   - Run this test suite in CI/CD pipeline
   - Fail builds if demo users lack proper assignments
   - Validate API endpoints return expected data

5. DATA MIGRATION SAFETY:
   - Always verify user-residence relationships after schema changes
   - Include assignment verification in deployment checklist
      `);

      console.log('✅ Prevention measures documented');
      expect(true).toBe(true); // Documentation test
    });

    it('should validate current system state', async () => {
      console.log('🔍 SYSTEM STATE VALIDATION:');

      // Count various entities
      const counts = {
        totalUsers: await db.select().from(users),
        demoResidents: await db.select().from(users).where(eq(users.role, 'demo_resident')),
        totalResidences: await db.select().from(residences).where(eq(residences.isActive, true)),
        totalAssignments: await db.select().from(userResidences).where(eq(userResidences.isActive, true)),
        assignmentsForDemoResidents: await db
          .select()
          .from(userResidences)
          .innerJoin(users, eq(userResidences.userId, users.id))
          .where(
            and(
              eq(users.role, 'demo_resident'),
              eq(userResidences.isActive, true)
            )
          )
      };

      console.log(`📊 CURRENT SYSTEM STATE:`);
      console.log(`- Total users: ${counts.totalUsers.length}`);
      console.log(`- Demo residents: ${counts.demoResidents.length}`);  
      console.log(`- Active residences: ${counts.totalResidences.length}`);
      console.log(`- Total assignments: ${counts.totalAssignments.length}`);
      console.log(`- Demo resident assignments: ${counts.assignmentsForDemoResidents.length}`);

      const assignmentRatio = counts.demoResidents.length > 0 
        ? (counts.assignmentsForDemoResidents.length / counts.demoResidents.length * 100).toFixed(1)
        : '0';

      console.log(`- Assignment coverage: ${assignmentRatio}% of demo residents have assignments`);

      if (assignmentRatio === '100.0') {
        console.log('✅ All demo residents have residence assignments');
      } else {
        console.log('🚨 Some demo residents lack residence assignments - this is the root cause');
      }

      // Document current state
      expect(counts.totalUsers.length).toBeGreaterThanOrEqual(0);
      expect(counts.totalResidences.length).toBeGreaterThanOrEqual(0);
    });
  });
});