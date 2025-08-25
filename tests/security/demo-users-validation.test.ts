import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

describe('Demo Users Validation', () => {
  beforeAll(async () => {
    // Ensure test isolation
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('No Admin Demo Users Rule', () => {
    test('should never have admin users in Demo organizations', async () => {
      // Find Demo and Open Demo organizations
      const demoOrganizations = await db.query.organizations.findMany({
        where: inArray(schema.organizations.name, ['Demo', 'Open Demo'])
      });

      expect(demoOrganizations.length).toBeGreaterThan(0);

      for (const org of demoOrganizations) {
        // Get all users in this demo organization
        const userOrgRelations = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, org.id),
          with: {
            user: true
          }
        });

        // Check that NO users have admin role
        const adminUsers = userOrgRelations.filter(
          rel => (rel.user && rel.user.role === 'admin') || rel.organizationRole === 'admin'
        );

        expect(adminUsers).toHaveLength(0);
        
        if (adminUsers.length > 0) {
          console.error(`❌ Found admin users in ${org.name} organization:`, 
            adminUsers.map(u => u.user ? `${u.user.firstName} ${u.user.lastName} (${u.user.email})` : 'Unknown user')
          );
        }
      }
    }, 10000);

    test('should have realistic names for all demo users', async () => {
      // Find Demo and Open Demo organizations
      const demoOrganizations = await db.query.organizations.findMany({
        where: inArray(schema.organizations.name, ['Demo', 'Open Demo'])
      });

      expect(demoOrganizations.length).toBeGreaterThan(0);

      // List of unrealistic/placeholder names that should not exist
      const bannedNames = [
        'Demo', 'Test', 'Admin', 'Manager', 'User', 'Tenant', 'Resident',
        'Example', 'Sample', 'Mock', 'Dummy', 'Placeholder'
      ];

      for (const org of demoOrganizations) {
        // Get all users in this demo organization
        const userOrgRelations = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, org.id),
          with: {
            user: true
          }
        });

        for (const rel of userOrgRelations) {
          const user = rel.user;
          
          if (!user) {continue;}
          
          // Check first name is realistic
          for (const bannedName of bannedNames) {
            expect(user.firstName.toLowerCase()).not.toContain(bannedName.toLowerCase());
            expect(user.lastName.toLowerCase()).not.toContain(bannedName.toLowerCase());
          }

          // Ensure names are properly capitalized and realistic
          expect(user.firstName).toMatch(/^[A-Z][a-z]+$/);
          expect(user.lastName).toMatch(/^[A-Z][a-z\-\']+$/);
          
          // Ensure names are not just generic placeholders
          expect(user.firstName.length).toBeGreaterThan(2);
          expect(user.lastName.length).toBeGreaterThan(2);
        }
      }
    }, 10000);

    test('should have realistic email addresses for demo users', async () => {
      // Find Demo and Open Demo organizations
      const demoOrganizations = await db.query.organizations.findMany({
        where: inArray(schema.organizations.name, ['Demo', 'Open Demo'])
      });

      expect(demoOrganizations.length).toBeGreaterThan(0);

      const bannedEmailPrefixes = ['admin', 'test', 'demo.manager', 'demo.tenant', 'demo.resident'];

      for (const org of demoOrganizations) {
        // Get all users in this demo organization
        const userOrgRelations = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, org.id),
          with: {
            user: true
          }
        });

        for (const rel of userOrgRelations) {
          const user = rel.user;
          
          if (!user) {continue;}
          
          const emailPrefix = user.email.split('@')[0];
          
          // Check that email doesn't contain banned prefixes
          for (const bannedPrefix of bannedEmailPrefixes) {
            expect(emailPrefix.toLowerCase()).not.toBe(bannedPrefix.toLowerCase());
          }

          // Ensure email follows firstname.lastname pattern
          const expectedEmailPrefix = `${user.firstName.toLowerCase()}.${user.lastName.toLowerCase()}`.replace(/[àâäéèêëïîôöùûüÿç]/g, (char) => {
            const map: { [key: string]: string } = {
              'à': 'a', 'â': 'a', 'ä': 'a',
              'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
              'ï': 'i', 'î': 'i',
              'ô': 'o', 'ö': 'o',
              'ù': 'u', 'û': 'u', 'ü': 'u',
              'ÿ': 'y',
              'ç': 'c'
            };
            return map[char] || char;
          });
          
          expect(emailPrefix.toLowerCase()).toBe(expectedEmailPrefix);
        }
      }
    }, 10000);

    test('should only have manager, tenant, and resident roles in demo organizations', async () => {
      // Find Demo and Open Demo organizations
      const demoOrganizations = await db.query.organizations.findMany({
        where: inArray(schema.organizations.name, ['Demo', 'Open Demo'])
      });

      expect(demoOrganizations.length).toBeGreaterThan(0);

      const allowedRoles = ['manager', 'tenant', 'resident'];

      for (const org of demoOrganizations) {
        // Get all users in this demo organization
        const userOrgRelations = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, org.id),
          with: {
            user: true
          }
        });

        for (const rel of userOrgRelations) {
          const user = rel.user;
          
          if (!user) {continue;}
          
          // Check user role
          expect(allowedRoles).toContain(user.role);
          
          // Check organization role
          expect(allowedRoles).toContain(rel.organizationRole);
          
          // Double check - no admin roles
          expect(user.role).not.toBe('admin');
          expect(rel.organizationRole).not.toBe('admin');
        }
      }
    }, 10000);

    test('should ensure demo users have Quebec-appropriate names', async () => {
      // Find Demo and Open Demo organizations
      const demoOrganizations = await db.query.organizations.findMany({
        where: inArray(schema.organizations.name, ['Demo', 'Open Demo'])
      });

      expect(demoOrganizations.length).toBeGreaterThan(0);

      // Common Quebec French names and surnames
      const quebecNames = [
        'Sophie', 'Marc', 'Marie', 'Pierre', 'Julie', 'Michel', 'Nathalie', 'Daniel',
        'Isabelle', 'Claude', 'Chantal', 'Robert', 'Sylvie', 'Jean', 'Nicole', 'André',
        'Louise', 'François', 'Diane', 'Gilles', 'Lise', 'Alain', 'Martine', 'Jacques',
        'Hélène', 'Yves', 'Francine', 'Serge', 'Monique', 'Paul', 'Ginette', 'Marcel',
        'Gabrielle', 'Henri', 'Louis', 'Claire', 'Emma', 'Alice', 'David', 'Frank',
        'Bob', 'Katie', 'Liam', 'Maya', 'Grace', 'Henry', 'Jack', 'Isabel', 'Katia'
      ];

      const quebecSurnames = [
        'Tremblay', 'Gauthier', 'Bouchard', 'Côté', 'Leclerc', 'Dubois', 'Morin', 
        'Roy', 'Fournier', 'Lavoie', 'Gagnon', 'Martin', 'Lefebvre', 'Girard',
        'Bergeron', 'Pelletier', 'Poirier', 'Caron', 'Beaulieu', 'Cloutier',
        'Johnson', 'Smith', 'Brown', 'Wilson', 'Davis', 'Miller', 'Garcia',
        'Martinez', 'Rodriguez', 'Anderson', 'Taylor', 'Thomas', 'Jackson'
      ];

      for (const org of demoOrganizations) {
        // Get all users in this demo organization
        const userOrgRelations = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, org.id),
          with: {
            user: true
          }
        });

        expect(userOrgRelations.length).toBeGreaterThan(0);

        // Check that at least 80% of users have Quebec-appropriate names
        const quebecNameCount = userOrgRelations.filter(rel => {
          const user = rel.user;
          return user && (quebecNames.includes(user.firstName) || quebecSurnames.includes(user.lastName));
        }).length;

        const quebecNamePercentage = quebecNameCount / userOrgRelations.length;
        expect(quebecNamePercentage).toBeGreaterThan(0.8);
      }
    }, 10000);
  });

  describe('Data Integrity Checks', () => {
    test('should have consistent user data across Demo and Open Demo', async () => {
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo')
      });
      
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo')
      });

      if (!demoOrg || !openDemoOrg) {
        console.warn('Demo or Open Demo organization not found, skipping consistency check');
        return;
      }

      // Get user counts
      const demoUsers = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg.id)
      });

      const openDemoUsers = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, openDemoOrg.id)
      });

      // Should have same number of users (minus any admin users)
      expect(demoUsers.length).toBe(openDemoUsers.length);
    }, 10000);
  });
});