import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import ws from 'ws';
import 'whatwg-fetch';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

describe('Demo User Login Page Integration', () => {
  beforeAll(async () => {
    // Verify database connection and demo organizations exist
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo'),
    });
    
    if (!demoOrg) {
      throw new Error('Demo organization not found - ensure demo setup is complete');
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Database Connection Verification', () => {
    test('should connect to the correct database environment', async () => {
      // Check database connection
      const result = await db.execute(sql`SELECT current_database(), version()`);
      expect(result.rows).toHaveLength(1);
      
      const row = result.rows[0] as { current_database: string; version: string };
      const dbName = row.current_database;
      const version = row.version;
      
      console.log(`✅ Connected to database: ${dbName}`);
      console.log(`✅ PostgreSQL version: ${version}`);
      
      // Verify this is a PostgreSQL database (expected for production)
      expect(version).toMatch(/PostgreSQL/i);
      
      // Check for expected demo data structure
      const tableCount = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const countRow = tableCount.rows[0] as { count: string };
      expect(Number(countRow.count)).toBeGreaterThan(10);
    });

    test('should have proper demo organizations in the database', async () => {
      // Verify Demo organization exists
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      
      expect(demoOrg).toBeDefined();
      expect(demoOrg?.type).toBe('demo');
      expect(demoOrg?.isActive).toBe(true);
      
      // Verify Open Demo organization exists
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });
      
      expect(openDemoOrg).toBeDefined();
      expect(openDemoOrg?.type).toBe('demo');
      expect(openDemoOrg?.isActive).toBe(true);
      
      console.log(`✅ Demo organization verified: ${demoOrg?.id}`);
      console.log(`✅ Open Demo organization verified: ${openDemoOrg?.id}`);
    });
  });

  describe('Existing Demo Users for Login Page', () => {
    test('should have demo users that can appear on login page', async () => {
      // Get all demo users from Demo organization
      const demoUsers = await db.query.users.findMany({
        where: and(
          eq(schema.users.isActive, true),
          sql`${schema.users.email} LIKE '%@demo.com'`
        ),
        with: {
          userOrganizations: {
            with: {
              organization: true,
            },
          },
        },
      });

      expect(demoUsers.length).toBeGreaterThan(0);
      console.log(`✅ Found ${demoUsers.length} demo users`);

      // Verify each user has proper login page format
      for (const user of demoUsers) {
        expect(user.email).toMatch(/@demo\.com$/);
        expect(user.firstName).toBeDefined();
        expect(user.lastName).toBeDefined();
        expect(user.firstName.length).toBeGreaterThan(0);
        expect(user.lastName.length).toBeGreaterThan(0);
        expect(user.isActive).toBe(true);
        
        // Check organization membership
        const demoOrgMembership = user.userOrganizations.find(
          uo => uo.organization?.name === 'Demo'
        );
        expect(demoOrgMembership).toBeDefined();
        
        console.log(`  ✓ ${user.firstName} ${user.lastName} (${user.email}) - ${user.role}`);
      }
    });

    test('should have Open Demo users for login suggestions', async () => {
      // Get all Open Demo users
      const openDemoUsers = await db.query.users.findMany({
        where: and(
          eq(schema.users.isActive, true),
          sql`${schema.users.email} LIKE '%@opendemo.com'`
        ),
        with: {
          userOrganizations: {
            with: {
              organization: true,
            },
          },
        },
      });

      if (openDemoUsers.length > 0) {
        console.log(`✅ Found ${openDemoUsers.length} Open Demo users`);

        for (const user of openDemoUsers) {
          expect(user.email).toMatch(/@opendemo\.com$/);
          expect(user.firstName).toBeDefined();
          expect(user.lastName).toBeDefined();
          expect(user.isActive).toBe(true);
          
          // Check organization membership
          const openDemoOrgMembership = user.userOrganizations.find(
            uo => uo.organization?.name === 'Open Demo'
          );
          expect(openDemoOrgMembership).toBeDefined();
          
          console.log(`  ✓ ${user.firstName} ${user.lastName} (${user.email}) - ${user.role} [View Only]`);
        }
      } else {
        console.log('ℹ️ No Open Demo users found - they may need to be created');
      }
    });

    test('should have users with different roles for testing', async () => {
      // Get demo users grouped by role
      const usersByRole = await db.execute(sql`
        SELECT u.role, COUNT(*) as count
        FROM users u
        INNER JOIN user_organizations uo ON u.id = uo.user_id
        INNER JOIN organizations o ON uo.organization_id = o.id
        WHERE o.name IN ('Demo', 'Open Demo')
        AND u.is_active = true
        GROUP BY u.role
        ORDER BY u.role
      `);

      expect(usersByRole.rows.length).toBeGreaterThan(0);
      
      const roleDistribution: { [key: string]: number } = {};
      for (const row of usersByRole.rows) {
        roleDistribution[row.role as string] = Number(row.count);
        console.log(`  ✓ ${row.role}: ${row.count} users`);
      }

      // Should have users in multiple roles for comprehensive testing
      expect(Object.keys(roleDistribution).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Login Page Data Format', () => {
    test('should provide users in format expected by login page', async () => {
      // Simulate how login page would query for demo users
      const loginPageUsers = await db.execute(sql`
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.role,
          o.name as organization_name,
          CASE 
            WHEN o.name = 'Open Demo' THEN true 
            ELSE false 
          END as is_view_only
        FROM users u
        INNER JOIN user_organizations uo ON u.id = uo.user_id
        INNER JOIN organizations o ON uo.organization_id = o.id
        WHERE o.name IN ('Demo', 'Open Demo')
        AND u.is_active = true
        ORDER BY u.first_name, u.last_name
      `);

      expect(loginPageUsers.rows.length).toBeGreaterThan(0);

      for (const user of loginPageUsers.rows) {
        // Type assertion and verify required fields for login page
        const userRow = user as {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: string;
          organization_name: string;
          is_view_only: boolean;
        };
        
        expect(userRow.id).toBeDefined();
        expect(userRow.email).toMatch(/^[a-zA-Z0-9._%+-]+@(demo|opendemo)\.com$/);
        expect(userRow.first_name).toBeDefined();
        expect(userRow.last_name).toBeDefined();
        expect(userRow.role).toMatch(/^(admin|manager|tenant|resident)$/);
        expect(userRow.organization_name).toMatch(/^(Demo|Open Demo)$/);
        expect(typeof userRow.is_view_only).toBe('boolean');
        
        // Type assertion for row data
        const userRow = user as {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: string;
          organization_name: string;
          is_view_only: boolean;
        };
        
        // Check email format matches first name and last name
        const expectedEmailPrefix = `${userRow.first_name.toLowerCase()}.${userRow.last_name.toLowerCase()}`;
        const normalizedEmailPrefix = expectedEmailPrefix
          .replace(/[àâäéèêëïîôöùûüÿç]/g, (char) => {
            const map: { [key: string]: string } = {
              'à': 'a', 'â': 'a', 'ä': 'a',
              'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
              'ï': 'i', 'î': 'i',
              'ô': 'o', 'ö': 'o',
              'ù': 'u', 'û': 'u', 'ü': 'u',
              'ÿ': 'y', 'ç': 'c'
            };
            return map[char] || char;
          });
        
        const emailPrefix = userRow.email.split('@')[0];
        expect(emailPrefix.toLowerCase()).toBe(normalizedEmailPrefix);
        
        console.log(`  ✓ Login format valid: ${userRow.first_name} ${userRow.last_name} (${userRow.email}) - ${userRow.role} ${userRow.is_view_only ? '[View Only]' : ''}`);
      }
    });

    test('should have proper password format for authentication', async () => {
      // Get a sample of demo users and check password format
      const usersWithPasswords = await db.query.users.findMany({
        where: and(
          eq(schema.users.isActive, true),
          sql`${schema.users.email} LIKE '%@demo.com'`
        ),
        limit: 3,
      });

      expect(usersWithPasswords.length).toBeGreaterThan(0);

      for (const user of usersWithPasswords) {
        // Verify password is properly hashed (bcrypt format)
        expect(user.password).toMatch(/^\$2b\$\d+\$/);
        expect(user.password.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
        
        console.log(`  ✓ Password properly hashed for: ${user.email}`);
      }
    });
  });

  describe('User Authentication Readiness', () => {
    test('should be able to find users by email for login', async () => {
      // Test email lookup functionality (used during login)
      const testEmails = await db.execute(sql`
        SELECT u.email
        FROM users u
        INNER JOIN user_organizations uo ON u.id = uo.user_id
        INNER JOIN organizations o ON uo.organization_id = o.id
        WHERE o.name = 'Demo'
        AND u.is_active = true
        LIMIT 3
      `);

      expect(testEmails.rows.length).toBeGreaterThan(0);

      for (const emailRow of testEmails.rows) {
        const email = emailRow.email as string;
        
        // Simulate login email lookup
        const foundUser = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
        });

        expect(foundUser).toBeDefined();
        expect(foundUser?.email).toBe(email);
        expect(foundUser?.isActive).toBe(true);
        
        console.log(`  ✓ Email lookup successful: ${email}`);
      }
    });

    test('should have complete user profiles for demo users', async () => {
      // Check that demo users have all required profile fields
      const incompleteUsers = await db.execute(sql`
        SELECT u.email, u.first_name, u.last_name, u.phone
        FROM users u
        INNER JOIN user_organizations uo ON u.id = uo.user_id
        INNER JOIN organizations o ON uo.organization_id = o.id
        WHERE o.name IN ('Demo', 'Open Demo')
        AND u.is_active = true
        AND (
          u.first_name IS NULL OR u.first_name = '' OR
          u.last_name IS NULL OR u.last_name = '' OR
          u.email IS NULL OR u.email = ''
        )
      `);

      // Should have no incomplete user profiles
      expect(incompleteUsers.rows.length).toBe(0);
      
      if (incompleteUsers.rows.length > 0) {
        console.error('❌ Found incomplete user profiles:');
        for (const user of incompleteUsers.rows) {
          console.error(`  - ${user.email}: missing data`);
        }
      } else {
        console.log('✅ All demo users have complete profiles');
      }
    });

    test('should verify demo users are properly associated with organizations', async () => {
      // Check for orphaned users (users without organization relationships)
      const orphanedUsers = await db.execute(sql`
        SELECT u.email, u.first_name, u.last_name
        FROM users u
        WHERE u.email LIKE '%@demo.com' OR u.email LIKE '%@opendemo.com'
        AND u.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM user_organizations uo 
          WHERE uo.user_id = u.id AND uo.is_active = true
        )
      `);

      // Should have no orphaned demo users
      expect(orphanedUsers.rows.length).toBe(0);
      
      if (orphanedUsers.rows.length > 0) {
        console.error('❌ Found orphaned demo users:');
        for (const user of orphanedUsers.rows) {
          console.error(`  - ${user.first_name} ${user.last_name} (${user.email})`);
        }
      } else {
        console.log('✅ All demo users are properly associated with organizations');
      }
    });
  });
});