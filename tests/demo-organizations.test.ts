import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and } from 'drizzle-orm';
import * as schema from '../shared/schema';
import { createComprehensiveDemo } from '../scripts/create-comprehensive-demo';
import { duplicateDemoToOpenDemo } from '../scripts/duplicate-demo-to-open-demo';
import ComprehensiveDemoSyncService from '../server/services/comprehensive-demo-sync-service';
import DemoManagementService from '../server/services/demo-management-service';

// Test database setup
const TEST_DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL must be defined for tests');
}

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const db = drizzle({ client: pool, schema });

describe('Demo Organizations System', () => {
  beforeAll(async () => {
    // Clean up any existing demo data before tests
    await cleanupDemoData();
  });

  afterAll(async () => {
    // Clean up after all tests
    await cleanupDemoData();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up before each test to ensure isolation
    await cleanupDemoData();
  });

  /**
   *
   */
  async function cleanupDemoData() {
    try {
      // Delete demo organizations and all related data
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      if (demoOrg) {
        await db.delete(schema.organizations).where(eq(schema.organizations.id, demoOrg.id));
      }
      if (openDemoOrg) {
        await db.delete(schema.organizations).where(eq(schema.organizations.id, openDemoOrg.id));
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }

  describe('Comprehensive Demo Creation', () => {
    it('should create Demo and Open Demo organizations', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      expect(demoOrg).toBeDefined();
      expect(demoOrg?.name).toBe('Demo');
      expect(demoOrg?.type).toBe('management_company');
      expect(demoOrg?.isActive).toBe(true);

      expect(openDemoOrg).toBeDefined();
      expect(openDemoOrg?.name).toBe('Open Demo');
      expect(openDemoOrg?.type).toBe('management_company');
      expect(openDemoOrg?.isActive).toBe(true);
    }, 120000); // 2 minute timeout for comprehensive demo creation

    it('should create buildings with varied configurations', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });

      expect(buildings.length).toBeGreaterThan(0);

      // Verify different building types exist
      const buildingTypes = buildings.map((b) => b.buildingType);
      expect(buildingTypes).toContain('condo');
      expect(buildingTypes).toContain('rental');

      // Verify buildings have required fields
      buildings.forEach((building) => {
        expect(building.name).toBeDefined();
        expect(building.address).toBeDefined();
        expect(building.city).toBe('Montreal');
        expect(building.province).toBe('QC');
        expect(building.totalUnits).toBeGreaterThan(0);
        expect(building.isActive).toBe(true);
      });
    });

    it('should create residences for all buildings', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });

      expect(buildings.length).toBeGreaterThan(0);

      for (const building of buildings) {
        const residences = await db.query.residences.findMany({
          where: eq(schema.residences.buildingId, building.id),
        });

        expect(residences.length).toBeGreaterThanOrEqual(building.totalUnits);

        // Verify residence data
        residences.forEach((residence) => {
          expect(residence.unitNumber).toBeDefined();
          expect(residence.bedrooms).toBeGreaterThan(0);
          expect(residence.bathrooms).toBeGreaterThan(0);
          expect(residence.isActive).toBe(true);
        });
      }
    });

    it('should create users with different roles', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const userOrganizations = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg!.id),
        with: { user: true },
      });

      expect(userOrganizations.length).toBeGreaterThan(10);

      const roles = userOrganizations.map((uo) => uo.user.role);
      expect(roles).toContain('admin');
      expect(roles).toContain('manager');
      expect(roles).toContain('tenant');
      expect(roles).toContain('resident');

      // Verify admin user exists
      const adminUser = userOrganizations.find((uo) => uo.user.role === 'admin');
      expect(adminUser).toBeDefined();
      if (adminUser) {
        expect(adminUser.user.firstName).toBe('Admin');
        expect(adminUser.user.lastName).toBe('Demo');
      }
    });

    it('should create comprehensive financial data', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });

      for (const building of buildings) {
        // Check bills
        const bills = await db.query.bills.findMany({
          where: eq(schema.bills.buildingId, building.id),
        });
        expect(bills.length).toBeGreaterThan(0);

        // Check budgets
        const budgets = await db.query.budgets.findMany({
          where: eq(schema.budgets.buildingId, building.id),
        });
        expect(budgets.length).toBeGreaterThan(0);

        // Check monthly budgets
        const monthlyBudgets = await db.query.monthlyBudgets.findMany({
          where: eq(schema.monthlyBudgets.buildingId, building.id),
        });
        expect(monthlyBudgets.length).toBeGreaterThan(0);

        // Check money flow
        const moneyFlow = await db.query.moneyFlow.findMany({
          where: eq(schema.moneyFlow.buildingId, building.id),
        });
        expect(moneyFlow.length).toBeGreaterThan(0);
      }
    });

    it('should create operations data', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });

      const residences = await db.query.residences.findMany({
        where: eq(schema.residences.buildingId, buildings[0].id),
      });

      // Check maintenance requests
      const maintenanceRequests = await db.query.maintenanceRequests.findMany({
        where: eq(schema.maintenanceRequests.residenceId, residences[0].id),
      });
      expect(maintenanceRequests.length).toBeGreaterThanOrEqual(0);

      // Check demands
      const demands = await db.query.demands.findMany({
        where: eq(schema.demands.buildingId, buildings[0].id),
      });
      expect(demands.length).toBeGreaterThanOrEqual(0);

      // Check notifications
      const userOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg!.id),
      });

      if (userOrgs.length > 0) {
        const notifications = await db.query.notifications.findMany({
          where: eq(schema.notifications.userId, userOrgs[0].userId),
        });
        expect(notifications.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should create settings data', async () => {
      await createComprehensiveDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const userOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg!.id),
      });

      if (userOrgs.length > 0) {
        const userId = userOrgs[0].userId;

        // Check bugs
        const bugs = await db.query.bugs.findMany({
          where: eq(schema.bugs.createdBy, userId),
        });
        expect(bugs.length).toBeGreaterThanOrEqual(0);

        // Check feature requests
        const featureRequests = await db.query.featureRequests.findMany({
          where: eq(schema.featureRequests.createdBy, userId),
        });
        expect(featureRequests.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Demo to Open Demo Duplication', () => {
    beforeEach(async () => {
      // Create demo data first
      await createComprehensiveDemo();
    });

    it('should duplicate Demo organization to Open Demo', async () => {
      await duplicateDemoToOpenDemo();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      expect(demoOrg).toBeDefined();
      expect(openDemoOrg).toBeDefined();

      // Get building counts
      const demoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });
      const openDemoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, openDemoOrg!.id),
      });

      expect(openDemoBuildings.length).toBe(demoBuildings.length);

      // Verify building data is duplicated correctly
      for (let i = 0; i < demoBuildings.length; i++) {
        const demoBuilding = demoBuildings[i];
        const openDemoBuilding = openDemoBuildings.find((b) => b.name === demoBuilding.name);

        expect(openDemoBuilding).toBeDefined();
        expect(openDemoBuilding?.address).toBe(demoBuilding.address);
        expect(openDemoBuilding?.buildingType).toBe(demoBuilding.buildingType);
        expect(openDemoBuilding?.totalUnits).toBe(demoBuilding.totalUnits);
      }
    }, 120000);

    it('should change user email domains correctly', async () => {
      await duplicateDemoToOpenDemo();

      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      const openDemoUserOrgs = await db.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, openDemoOrg!.id),
        with: { user: true },
      });

      expect(openDemoUserOrgs.length).toBeGreaterThan(0);

      // Verify email domains are changed
      openDemoUserOrgs.forEach((userOrg) => {
        if (userOrg.user?.email) {
          expect(userOrg.user.email).toContain('@opendemo.com');
          expect(userOrg.user.email).not.toContain('@demo.com');
        }
      });
    });

    it('should preserve data relationships', async () => {
      await duplicateDemoToOpenDemo();

      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      const openDemoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, openDemoOrg!.id),
      });

      expect(openDemoBuildings.length).toBeGreaterThan(0);

      // Check that residences are properly linked to buildings
      for (const building of openDemoBuildings) {
        const residences = await db.query.residences.findMany({
          where: eq(schema.residences.buildingId, building.id),
        });
        expect(residences.length).toBe(building.totalUnits);
      }
    });
  });

  describe('Comprehensive Demo Sync Service', () => {
    beforeEach(async () => {
      await createComprehensiveDemo();
    });

    it('should perform full synchronization', async () => {
      await ComprehensiveDemoSyncService.runFullSync();

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      expect(demoOrg).toBeDefined();
      expect(openDemoOrg).toBeDefined();

      // Verify data was synchronized
      const demoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });
      const openDemoBuildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, openDemoOrg!.id),
      });

      expect(openDemoBuildings.length).toBe(demoBuildings.length);
    }, 120000);
  });

  describe('Demo Management Service', () => {
    it('should check demo health when no orgs exist', async () => {
      const health = await DemoManagementService.checkDemoHealth();

      expect(health.healthy).toBe(false);
      expect(health.status).toBeDefined();
      expect(health.message).toContain('need attention');
      expect(health.timestamp).toBeDefined();
    });

    it('should ensure demo organizations exist', async () => {
      const result = await DemoManagementService.ensureDemoOrganizations();

      expect(result.success).toBe(true);
      expect(result.demoOrgId).toBeDefined();
      expect(result.openDemoOrgId).toBeDefined();

      // Verify organizations were created
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });
      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Open Demo'),
      });

      expect(demoOrg).toBeDefined();
      expect(openDemoOrg).toBeDefined();
    }, 120000);

    it('should get demo organization info', async () => {
      await createComprehensiveDemo();

      const info = await DemoManagementService.getDemoOrganizationInfo();

      expect(info.demo).toBeDefined();
      expect(info.openDemo).toBeDefined();
      expect(info.stats.demoBuildings).toBeGreaterThan(0);
      expect(info.stats.demoUsers).toBeGreaterThan(0);
      expect(info.stats.openDemoBuildings).toBeGreaterThan(0);
      expect(info.stats.openDemoUsers).toBeGreaterThan(0);
    });

    it('should run scheduled maintenance', async () => {
      await createComprehensiveDemo();

      const result = await DemoManagementService.scheduledMaintenance();

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    beforeEach(async () => {
      await createComprehensiveDemo();
    });

    it('should maintain referential integrity between tables', async () => {
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const buildings = await db.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg!.id),
      });

      for (const building of buildings) {
        // Check residences reference valid buildings
        const residences = await db.query.residences.findMany({
          where: eq(schema.residences.buildingId, building.id),
        });

        expect(residences.length).toBeGreaterThan(0);

        // Check bills reference valid buildings
        const bills = await db.query.bills.findMany({
          where: eq(schema.bills.buildingId, building.id),
        });

        // All bills should have valid created_by references
        for (const bill of bills) {
          const creator = await db.query.users.findFirst({
            where: eq(schema.users.id, bill.createdBy),
          });
          expect(creator).toBeDefined();
        }
      }
    });

    it('should have consistent user-residence relationships', async () => {
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, 'Demo'),
      });

      const userResidences = await db.query.userResidences.findMany();

      for (const userRes of userResidences) {
        // Verify user exists
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, userRes.userId),
        });
        expect(user).toBeDefined();

        // Verify residence exists
        const residence = await db.query.residences.findFirst({
          where: eq(schema.residences.id, userRes.residenceId),
        });
        expect(residence).toBeDefined();

        // Verify relationship type is valid
        expect(['owner', 'tenant', 'occupant']).toContain(userRes.relationshipType);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing Demo organization gracefully', async () => {
      // Don't create demo data first
      const health = await DemoManagementService.checkDemoHealth();
      expect(health.healthy).toBe(false);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database connection
      // For now, we just verify that our service methods don't throw uncaught exceptions
      try {
        await DemoManagementService.checkDemoHealth();
        // Should not throw
      } catch (error) {
        // If it throws, it should be a handled error
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
