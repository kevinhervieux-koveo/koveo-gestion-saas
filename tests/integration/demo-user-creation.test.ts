import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { hashPassword } from '../../server/auth';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

let testDemoOrgId: string;
let testOpenDemoOrgId: string;
let createdUserIds: string[] = [];

describe('Demo User Creation and Login Integration Tests', () => {
  beforeAll(async () => {
    // Ensure test organizations exist
    await setupTestOrganizations();
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.end();
  });

  beforeEach(() => {
    createdUserIds = [];
  });

  afterEach(async () => {
    // Clean up any users created during tests
    if (createdUserIds.length > 0) {
      await db.delete(schema.userOrganizations).where(
        inArray(schema.userOrganizations.userId, createdUserIds)
      );
      await db.delete(schema.users).where(
        inArray(schema.users.id, createdUserIds)
      );
      createdUserIds = [];
    }
  });

  describe('Database Verification', () => {
    test('should use the correct production/development database', async () => {
      // Verify we're connected to the expected database
      const result = await db.execute(sql`SELECT current_database()`);
      expect(result.rows).toHaveLength(1);
      
      // Check that demo organizations exist (indicating correct database)
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      expect(demoOrg).toBeDefined();
      expect(openDemoOrg).toBeDefined();
      
      console.log(`✅ Connected to database: ${result.rows[0]?.current_database}`);
      console.log(`✅ Demo organization found: ${demoOrg?.id}`);
      console.log(`✅ Open Demo organization found: ${openDemoOrg?.id}`);
    });

    test('should have proper database schema and tables', async () => {
      // Verify key tables exist
      const tables = ['users', 'organizations', 'userOrganizations', 'buildings', 'residences'];
      
      for (const tableName of tables) {
        const result = await db.execute(
          sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )`
        );
        
        expect(result.rows[0]?.exists).toBe(true);
      }
    });
  });

  describe('Demo User Creation', () => {
    test('should create regular demo user with correct properties', async () => {
      const userData = {
        username: 'test.demo.user',
        email: 'test.demo.user@demo.com',
        firstName: 'Marie',
        lastName: 'Dubois',
        role: 'manager' as const,
        phone: '514-555-0199',
      };

      const hashedPassword = await hashPassword('Demo@123456');

      // Create user
      const [newUser] = await db
        .insert(schema.users)
        .values({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          language: 'fr',
          role: userData.role,
          isActive: true,
        })
        .returning();

      expect(newUser).toBeDefined();
      expect(newUser.email).toBe(userData.email);
      expect(newUser.firstName).toBe(userData.firstName);
      expect(newUser.lastName).toBe(userData.lastName);
      expect(newUser.role).toBe(userData.role);
      expect(newUser.isActive).toBe(true);

      createdUserIds.push(newUser.id);

      // Add user to Demo organization
      const [userOrg] = await db
        .insert(schema.userOrganizations)
        .values({
          userId: newUser.id,
          organizationId: testDemoOrgId,
          organizationRole: userData.role,
          isActive: true,
        })
        .returning();

      expect(userOrg).toBeDefined();
      expect(userOrg.userId).toBe(newUser.id);
      expect(userOrg.organizationId).toBe(testDemoOrgId);
      expect(userOrg.organizationRole).toBe(userData.role);

      // Verify user can be retrieved with organization
      const userWithOrg = await db.query.users.findFirst({
        where: eq(schema.users.id, newUser.id),
        with: {
          userOrganizations: {
            with: {
              organization: true,
            },
          },
        },
      });

      expect(userWithOrg).toBeDefined();
      expect(userWithOrg?.userOrganizations).toHaveLength(1);
      expect(userWithOrg?.userOrganizations[0]?.organization?.name).toBe('Demo');
    });

    test('should create Open Demo user with view-only restrictions', async () => {
      const userData = {
        username: 'test.opendemo.user',
        email: 'test.opendemo.user@opendemo.com',
        firstName: 'Sophie',
        lastName: 'Martin',
        role: 'tenant' as const,
        phone: '514-555-0198',
      };

      const hashedPassword = await hashPassword('Demo@123456');

      // Create user
      const [newUser] = await db
        .insert(schema.users)
        .values({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          language: 'fr',
          role: userData.role,
          isActive: true,
        })
        .returning();

      createdUserIds.push(newUser.id);

      // Add user to Open Demo organization
      await db
        .insert(schema.userOrganizations)
        .values({
          userId: newUser.id,
          organizationId: testOpenDemoOrgId,
          organizationRole: userData.role,
          isActive: true,
        });

      // Verify user is properly identified as Open Demo user
      const { isOpenDemoUser } = await import('../../server/rbac');
      const isOpenDemo = await isOpenDemoUser(newUser.id);
      expect(isOpenDemo).toBe(true);

      // Verify user cannot perform write operations
      const { canUserPerformWriteOperation } = await import('../../server/rbac');
      const canCreate = await canUserPerformWriteOperation(newUser.id, 'create');
      const canUpdate = await canUserPerformWriteOperation(newUser.id, 'update');
      const canDelete = await canUserPerformWriteOperation(newUser.id, 'delete');

      expect(canCreate).toBe(false);
      expect(canUpdate).toBe(false);
      expect(canDelete).toBe(false);
    });

    test('should create demo users with Quebec-appropriate names', async () => {
      const quebecUsers = [
        {
          username: 'jean.demo.test',
          email: 'jean.tremblay.test@demo.com',
          firstName: 'Jean',
          lastName: 'Tremblay',
          role: 'tenant' as const,
        },
        {
          username: 'marie.demo.test',
          email: 'marie.gagnon.test@demo.com',
          firstName: 'Marie',
          lastName: 'Gagnon',
          role: 'resident' as const,
        },
        {
          username: 'pierre.demo.test',
          email: 'pierre.leblanc.test@demo.com',
          firstName: 'Pierre',
          lastName: 'Leblanc',
          role: 'manager' as const,
        },
      ];

      const hashedPassword = await hashPassword('Demo@123456');

      for (const userData of quebecUsers) {
        const [newUser] = await db
          .insert(schema.users)
          .values({
            username: userData.username,
            email: userData.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: '514-555-0100',
            language: 'fr',
            role: userData.role,
            isActive: true,
          })
          .returning();

        createdUserIds.push(newUser.id);

        // Add to Demo organization
        await db
          .insert(schema.userOrganizations)
          .values({
            userId: newUser.id,
            organizationId: testDemoOrgId,
            organizationRole: userData.role,
            isActive: true,
          });

        // Verify names follow Quebec patterns
        expect(newUser.firstName).toMatch(/^[A-Z][a-z]+$/);
        expect(newUser.lastName).toMatch(/^[A-Z][a-z\-\']+$/);
        expect(newUser.email).toMatch(/^[a-z]+\.[a-z]+\.test@demo\.com$/);
      }
    });
  });

  describe('Login Page Integration', () => {
    test('should create users that can appear in login suggestions', async () => {
      // Create test users for login page
      const loginTestUsers = [
        {
          username: 'marc.login.test',
          email: 'marc.gauthier.test@demo.com',
          firstName: 'Marc',
          lastName: 'Gauthier',
          role: 'manager' as const,
        },
        {
          username: 'sophie.login.test',
          email: 'sophie.tremblay.test@demo.com',
          firstName: 'Sophie',
          lastName: 'Tremblay',
          role: 'tenant' as const,
        },
      ];

      const hashedPassword = await hashPassword('Demo@123456');

      for (const userData of loginTestUsers) {
        const [newUser] = await db
          .insert(schema.users)
          .values({
            username: userData.username,
            email: userData.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: '514-555-0100',
            language: 'fr',
            role: userData.role,
            isActive: true,
          })
          .returning();

        createdUserIds.push(newUser.id);

        await db
          .insert(schema.userOrganizations)
          .values({
            userId: newUser.id,
            organizationId: testDemoOrgId,
            organizationRole: userData.role,
            isActive: true,
          });
      }

      // Verify users can be retrieved for login page suggestions
      const demoUsers = await db.query.users.findMany({
        where: and(
          eq(schema.users.isActive, true),
          sql`${schema.users.email} LIKE '%@demo.com'`
        ),
        with: {
          userOrganizations: {
            where: eq(schema.userOrganizations.organizationId, testDemoOrgId),
            with: {
              organization: true,
            },
          },
        },
      });

      expect(demoUsers.length).toBeGreaterThanOrEqual(2);
      
      // Verify each user has proper login page format
      for (const user of demoUsers) {
        expect(user.email).toMatch(/@demo\.com$/);
        expect(user.firstName).toBeDefined();
        expect(user.lastName).toBeDefined();
        expect(user.isActive).toBe(true);
        expect(user.userOrganizations).toHaveLength(1);
        expect(user.userOrganizations[0]?.organization?.name).toBe('Demo');
      }
    });

    test('should create users with proper authentication credentials', async () => {
      const testPassword = 'Demo@123456';
      const userData = {
        username: 'auth.test.user',
        email: 'auth.test.user@demo.com',
        firstName: 'Auth',
        lastName: 'Test',
        role: 'tenant' as const,
      };

      const hashedPassword = await hashPassword(testPassword);

      const [newUser] = await db
        .insert(schema.users)
        .values({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: '514-555-0100',
          language: 'fr',
          role: userData.role,
          isActive: true,
        })
        .returning();

      createdUserIds.push(newUser.id);

      // Verify password was properly hashed
      expect(newUser.password).not.toBe(testPassword);
      expect(newUser.password).toMatch(/^\$2b\$\d+\$/); // bcrypt hash format

      // Verify user can be found by email (login lookup)
      const foundUser = await db.query.users.findFirst({
        where: eq(schema.users.email, userData.email),
      });

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(newUser.id);
      expect(foundUser?.email).toBe(userData.email);

      // Verify password verification would work
      const bcrypt = await import('bcryptjs');
      const isValidPassword = await bcrypt.compare(testPassword, newUser.password);
      expect(isValidPassword).toBe(true);
    });
  });

  describe('User Data Integrity', () => {
    test('should enforce unique email addresses', async () => {
      const userData = {
        username: 'unique.test.user',
        email: 'unique.test@demo.com',
        firstName: 'Unique',
        lastName: 'Test',
        role: 'tenant' as const,
      };

      const hashedPassword = await hashPassword('Demo@123456');

      // Create first user
      const [firstUser] = await db
        .insert(schema.users)
        .values({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: '514-555-0100',
          language: 'fr',
          role: userData.role,
          isActive: true,
        })
        .returning();

      createdUserIds.push(firstUser.id);

      // Attempt to create second user with same email should fail
      await expect(
        db.insert(schema.users).values({
          username: 'different.username',
          email: userData.email, // Same email
          password: hashedPassword,
          firstName: 'Different',
          lastName: 'User',
          phone: '514-555-0101',
          language: 'fr',
          role: 'tenant',
          isActive: true,
        })
      ).rejects.toThrow();
    });

    test('should enforce required fields for demo users', async () => {
      const hashedPassword = await hashPassword('Demo@123456');

      // Test missing email
      await expect(
        db.insert(schema.users).values({
          username: 'test.user',
          email: '', // Empty email
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          phone: '514-555-0100',
          language: 'fr',
          role: 'tenant',
          isActive: true,
        })
      ).rejects.toThrow();

      // Test missing password
      await expect(
        db.insert(schema.users).values({
          username: 'test.user2',
          email: 'test2@demo.com',
          password: '', // Empty password
          firstName: 'Test',
          lastName: 'User',
          phone: '514-555-0100',
          language: 'fr',
          role: 'tenant',
          isActive: true,
        })
      ).rejects.toThrow();
    });

    test('should create users with proper demo organization relationships', async () => {
      const userData = {
        username: 'org.test.user',
        email: 'org.test@demo.com',
        firstName: 'Org',
        lastName: 'Test',
        role: 'manager' as const,
      };

      const hashedPassword = await hashPassword('Demo@123456');

      const [newUser] = await db
        .insert(schema.users)
        .values({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: '514-555-0100',
          language: 'fr',
          role: userData.role,
          isActive: true,
        })
        .returning();

      createdUserIds.push(newUser.id);

      // Create organization relationship
      await db
        .insert(schema.userOrganizations)
        .values({
          userId: newUser.id,
          organizationId: testDemoOrgId,
          organizationRole: userData.role,
          isActive: true,
        });

      // Verify complete user-organization relationship
      const userWithFullDetails = await db.query.userOrganizations.findFirst({
        where: eq(schema.userOrganizations.userId, newUser.id),
        with: {
          user: true,
          organization: true,
        },
      });

      expect(userWithFullDetails).toBeDefined();
      expect(userWithFullDetails?.user?.email).toBe(userData.email);
      expect(userWithFullDetails?.organization?.name).toBe('Demo');
      expect(userWithFullDetails?.organizationRole).toBe(userData.role);
      expect(userWithFullDetails?.isActive).toBe(true);
    });
  });
});

// Helper functions
async function setupTestOrganizations() {
  // Get or create Demo organization
  let demoOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.name, 'Demo'),
  });

  if (!demoOrg) {
    [demoOrg] = await db.insert(schema.organizations).values({
      name: 'Demo',
      type: 'demo',
      address: '123 Demo St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      isActive: true,
    }).returning();
  }

  // Get or create Open Demo organization
  let openDemoOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.name, 'Open Demo'),
  });

  if (!openDemoOrg) {
    [openDemoOrg] = await db.insert(schema.organizations).values({
      name: 'Open Demo',
      type: 'demo',
      address: '456 Open Demo Ave',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1B 1B1',
      isActive: true,
    }).returning();
  }

  testDemoOrgId = demoOrg.id;
  testOpenDemoOrgId = openDemoOrg.id;

  console.log('✅ Test organizations setup completed');
  console.log(`   Demo Org ID: ${testDemoOrgId}`);
  console.log(`   Open Demo Org ID: ${testOpenDemoOrgId}`);
}

async function cleanupTestData() {
  try {
    // Clean up any test users that might have been left behind
    const testUsers = await db.query.users.findMany({
      where: sql`${schema.users.email} LIKE '%.test@demo.com' OR ${schema.users.email} LIKE '%.test@opendemo.com'`,
    });

    if (testUsers.length > 0) {
      const testUserIds = testUsers.map(u => u.id);
      
      await db.delete(schema.userOrganizations).where(
        inArray(schema.userOrganizations.userId, testUserIds)
      );
      
      await db.delete(schema.users).where(
        inArray(schema.users.id, testUserIds)
      );
      
      console.log(`✅ Cleaned up ${testUsers.length} test users`);
    }
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error);
  }
}