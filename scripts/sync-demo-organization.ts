#!/usr/bin/env tsx

/**
 * Demo Organization Synchronization Script.
 * 
 * This script synchronizes the Demo organization data from development to production.
 * During deployment, it:
 * 1. Deletes all existing Demo organization data from production
 * 2. Exports Demo organization data from development
 * 3. Imports the exported data into production.
 * 
 * Usage: tsx scripts/sync-demo-organization.ts
 * Environment: Set PRODUCTION_DATABASE_URL for prod sync.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, ne } from 'drizzle-orm';
import * as schema from '../shared/schema';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// Development database connection
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set for development database access');
}

const devPool = new Pool({ connectionString: process.env.DATABASE_URL });
const devDb = drizzle({ client: devPool, schema });

// Production database connection (optional - for direct sync)
let prodDb: unknown = null;
if (process.env.PRODUCTION_DATABASE_URL) {
  const prodPool = new Pool({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  prodDb = drizzle({ client: prodPool, schema });
}

/**
 *
 */
interface DemoOrganizationData {
  organization: any;
  buildings: unknown[];
  residences: unknown[];
  users: unknown[];
  userOrganizations: unknown[];
  bills: unknown[];
  maintenanceRequests: unknown[];
  notifications: unknown[];
}

/**
 * Exports all Demo organization data from development database.
 */
/**
 * ExportDemoData function.
 * @returns Function result.
 */
async function exportDemoData(): Promise<DemoOrganizationData> {
  console.warn('📤 Exporting Demo organization data from development...');

  try {
    // Find Demo organization
    const demoOrg = await devDb.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo')
    });

    if (!demoOrg) {
      throw new Error('Demo organization not found in development database');
    }

    console.warn(`  ✓ Found Demo organization: ${demoOrg.id}`);

    // Export all related data
    const [buildings, users, userOrganizations] = await Promise.all([
      // Buildings belonging to Demo organization
      devDb.query.buildings.findMany({
        where: eq(schema.buildings.organizationId, demoOrg.id)
      }),
      
      // Users associated with Demo organization
      devDb.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg.id),
        with: {
          user: true
        }
      }),

      // User-organization relationships
      devDb.query.userOrganizations.findMany({
        where: eq(schema.userOrganizations.organizationId, demoOrg.id)
      })
    ]);

    // Get all building IDs for further queries
    const buildingIds = buildings.map(b => b.id);
    
    // Export residences, bills, maintenance requests for Demo buildings
    const [residences, bills, maintenanceRequests, notifications] = await Promise.all([
      buildingIds.length > 0 ? 
        devDb.query.residences.findMany({
          where: (residences, { inArray }) => inArray(residences.buildingId, buildingIds)
        }) : [],
      
      buildingIds.length > 0 ?
        devDb.query.bills.findMany({
          where: (bills, { inArray, exists }) => 
            exists(
              devDb.select().from(schema.residences)
                .where(and(
                  eq(schema.residences.id, bills.residenceId),
                  inArray(schema.residences.buildingId, buildingIds)
                ))
            )
        }) : [],

      buildingIds.length > 0 ?
        devDb.query.maintenanceRequests.findMany({
          where: (requests, { inArray, exists }) =>
            exists(
              devDb.select().from(schema.residences)
                .where(and(
                  eq(schema.residences.id, requests.residenceId),
                  inArray(schema.residences.buildingId, buildingIds)
                ))
            )
        }) : [],

      // Notifications for Demo organization users
      users.length > 0 ?
        devDb.query.notifications.findMany({
          where: (notifications, { inArray }) => 
            inArray(notifications.userId, users.map(u => u.user.id))
        }) : []
    ]);

    const exportData: DemoOrganizationData = {
      organization: demoOrg,
      buildings,
      residences,
      users: users.map(u => u.user),
      userOrganizations,
      bills,
      maintenanceRequests,
      notifications
    };

    console.warn(`  ✓ Exported ${buildings.length} buildings`);
    console.warn(`  ✓ Exported ${residences.length} residences`);
    console.warn(`  ✓ Exported ${exportData.users.length} users`);
    console.warn(`  ✓ Exported ${bills.length} bills`);
    console.warn(`  ✓ Exported ${maintenanceRequests.length} maintenance requests`);
    console.warn(`  ✓ Exported ${notifications.length} notifications`);

    return exportData;

  } catch (_error) {
    console.error('❌ Error exporting Demo _data:', _error);
    throw error;
  }
}

/**
 * Deletes all Demo organization data from target database.
 * @param db
 */
/**
 * DeleteDemoData function.
 * @param db
 * @returns Function result.
 */
async function deleteDemoData(db: unknown): Promise<void> {
  console.warn('🗑️  Deleting existing Demo organization data...');

  try {
    // Find Demo organization in target database
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo')
    });

    if (!demoOrg) {
      console.warn('  ℹ️  No Demo organization found to delete');
      return;
    }

    console.warn(`  ✓ Found Demo organization to delete: ${demoOrg.id}`);

    // Get all buildings for Demo organization
    const buildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrg.id)
    });

    const buildingIds = buildings.map(b => b.id);

    // Get all residences for Demo buildings
    const residences = buildingIds.length > 0 ?
      await db.query.residences.findMany({
        where: (residences, { inArray }) => inArray(residences.buildingId, buildingIds)
      }) : [];

    const residenceIds = residences.map(r => r.id);

    // Get all users associated with Demo organization
    const userOrgs = await db.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, demoOrg.id)
    });

    const userIds = userOrgs.map(uo => uo.userId);

    // Delete in correct order (respect foreign key constraints)
    
    // 1. Delete notifications for Demo users
    if (userIds.length > 0) {
      await db.delete(schema.notifications)
        .where((notifications, { inArray }) => inArray(notifications.userId, userIds));
      console.warn('  ✓ Deleted Demo user notifications');
    }

    // 2. Delete bills for Demo residences
    if (residenceIds.length > 0) {
      await db.delete(schema.bills)
        .where((bills, { inArray }) => inArray(bills.residenceId, residenceIds));
      console.warn('  ✓ Deleted Demo bills');
    }

    // 3. Delete maintenance requests for Demo residences
    if (residenceIds.length > 0) {
      await db.delete(schema.maintenanceRequests)
        .where((requests, { inArray }) => inArray(requests.residenceId, residenceIds));
      console.warn('  ✓ Deleted Demo maintenance requests');
    }

    // 4. Delete residences
    if (buildingIds.length > 0) {
      await db.delete(schema.residences)
        .where((residences, { inArray }) => inArray(residences.buildingId, buildingIds));
      console.warn('  ✓ Deleted Demo residences');
    }

    // 5. Delete buildings
    if (buildingIds.length > 0) {
      await db.delete(schema.buildings)
        .where((buildings, { inArray }) => inArray(buildings.id, buildingIds));
      console.warn('  ✓ Deleted Demo buildings');
    }

    // 6. Delete user-organization relationships
    await db.delete(schema.userOrganizations)
      .where(eq(schema.userOrganizations.organizationId, demoOrg.id));
    console.warn('  ✓ Deleted Demo user-organization relationships');

    // 7. Delete Demo users (only if they don't belong to other organizations)
    if (userIds.length > 0) {
      for (const userId of userIds) {
        const otherOrgs = await db.query.userOrganizations.findMany({
          where: and(
            eq(schema.userOrganizations.userId, userId),
            ne(schema.userOrganizations.organizationId, demoOrg.id)
          )
        });

        if (otherOrgs.length === 0) {
          await db.delete(schema.users).where(eq(schema.users.id, userId));
        }
      }
      console.warn('  ✓ Deleted Demo-only users');
    }

    // 8. Finally delete the Demo organization
    await db.delete(schema.organizations)
      .where(eq(schema.organizations.id, demoOrg.id));
    console.warn('  ✓ Deleted Demo organization');

  } catch (_error) {
    console.error('❌ Error deleting Demo _data:', _error);
    throw error;
  }
}

/**
 * Imports Demo organization data into target database.
 * @param db
 * @param data
 */
/**
 * ImportDemoData function.
 * @param db
 * @param data
 * @param _data
 * @returns Function result.
 */
async function importDemoData(db: any, _data: DemoOrganizationData): Promise<void> {
  console.warn('📥 Importing Demo organization data...');

  try {
    // 1. Insert organization
    const [newOrg] = await db.insert(schema.organizations)
      .values({
        ...data.organization,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    console.warn(`  ✓ Imported Demo organization: ${newOrg.id}`);

    // 2. Insert users (if they don't already exist)
    const existingUsers = await db.query.users.findMany({
      where: (users, { inArray }) => 
        inArray(users.email, data.users.map(u => u.email))
    });
    
    const existingEmails = new Set(existingUsers.map(u => u.email));
    const newUsers = data.users.filter(u => !existingEmails.has(u.email));
    
    const allUserIds: Record<string, string> = {};
    existingUsers.forEach(u => {
      const originalUser = data.users.find(du => du.email === u.email);
      if (originalUser) {
        allUserIds[originalUser.id] = u.id;
      }
    });

    if (newUsers.length > 0) {
      const insertedUsers = await db.insert(schema.users)
        .values(newUsers.map(user => ({
          ...user,
          createdAt: new Date(),
          updatedAt: new Date()
        })))
        .returning();
      
      insertedUsers.forEach((newUser, _index) => {
        allUserIds[newUsers[index].id] = newUser.id;
      });
      
      console.warn(`  ✓ Imported ${newUsers.length} new users`);
    } else {
      console.warn('  ✓ All users already exist');
    }

    // 3. Insert user-organization relationships
    await db.insert(schema.userOrganizations)
      .values(data.userOrganizations.map(uo => ({
        userId: allUserIds[uo.userId],
        organizationId: newOrg.id,
        role: uo.role,
        joinedAt: uo.joinedAt || new Date()
      })));
    console.warn(`  ✓ Imported ${data.userOrganizations.length} user-organization relationships`);

    // 4. Insert buildings
    const buildingIdMap: Record<string, string> = {};
    if (data.buildings.length > 0) {
      const insertedBuildings = await db.insert(schema.buildings)
        .values(data.buildings.map(building => ({
          ...building,
          organizationId: newOrg.id,
          createdAt: new Date(),
          updatedAt: new Date()
        })))
        .returning();
      
      insertedBuildings.forEach((newBuilding, _index) => {
        buildingIdMap[data.buildings[index].id] = newBuilding.id;
      });
      
      console.warn(`  ✓ Imported ${data.buildings.length} buildings`);
    }

    // 5. Insert residences
    const residenceIdMap: Record<string, string> = {};
    if (data.residences.length > 0) {
      const insertedResidences = await db.insert(schema.residences)
        .values(data.residences.map(residence => ({
          ...residence,
          buildingId: buildingIdMap[residence.buildingId],
          createdAt: new Date(),
          updatedAt: new Date()
        })))
        .returning();
      
      insertedResidences.forEach((newResidence, _index) => {
        residenceIdMap[data.residences[index].id] = newResidence.id;
      });
      
      console.warn(`  ✓ Imported ${data.residences.length} residences`);
    }

    // 6. Insert bills
    if (data.bills.length > 0) {
      await db.insert(schema.bills)
        .values(data.bills.map(bill => ({
          ...bill,
          residenceId: residenceIdMap[bill.residenceId],
          createdAt: new Date(),
          updatedAt: new Date()
        })));
      console.warn(`  ✓ Imported ${data.bills.length} bills`);
    }

    // 7. Insert maintenance requests
    if (data.maintenanceRequests.length > 0) {
      await db.insert(schema.maintenanceRequests)
        .values(data.maintenanceRequests.map(request => ({
          ...request,
          residenceId: residenceIdMap[request.residenceId],
          createdAt: new Date(),
          updatedAt: new Date()
        })));
      console.warn(`  ✓ Imported ${data.maintenanceRequests.length} maintenance requests`);
    }

    // 8. Insert notifications
    if (data.notifications.length > 0) {
      await db.insert(schema.notifications)
        .values(data.notifications.map(notification => ({
          ...notification,
          userId: allUserIds[notification.userId],
          createdAt: new Date(),
          updatedAt: new Date()
        })));
      console.warn(`  ✓ Imported ${data.notifications.length} notifications`);
    }

  } catch (_error) {
    console.error('❌ Error importing Demo _data:', _error);
    throw error;
  }
}

/**
 * Synchronizes Demo organization from development to production.
 */
/**
 * SyncDemoOrganization function.
 * @returns Function result.
 */
async function syncDemoOrganization(): Promise<void> {
  try {
    console.warn('🔄 Starting Demo organization synchronization...\n');

    // Step 1: Export data from development
    const demoData = await exportDemoData();
    
    console.warn('\n📋 Export Summary:');
    console.warn(`  • Organization: ${demoData.organization.name}`);
    console.warn(`  • Buildings: ${demoData.buildings.length}`);
    console.warn(`  • Residences: ${demoData.residences.length}`);
    console.warn(`  • Users: ${demoData.users.length}`);
    console.warn(`  • Bills: ${demoData.bills.length}`);
    console.warn(`  • Maintenance Requests: ${demoData.maintenanceRequests.length}`);
    console.warn(`  • Notifications: ${demoData.notifications.length}`);

    // Step 2: If production database is available, sync directly
    if (prodDb) {
      console.warn('\n🎯 Syncing directly to production database...');
      
      await deleteDemoData(prodDb);
      await importDemoData(prodDb, demoData);
      
      console.warn('\n✅ Demo organization synchronized successfully!');
    } else {
      // Step 3: If no direct prod access, export to JSON for manual import
      console.warn('\n💾 Exporting to JSON file for manual deployment...');
      
      const fs = await import('fs');
      const exportFile = 'demo-organization-export.json';
      
      await fs.promises.writeFile(
        exportFile,
        JSON.stringify(demoData, null, 2),
        'utf8'
      );
      
      console.warn(`  ✓ Exported to ${exportFile}`);
      console.warn('\n📋 To complete sync in production:');
      console.warn('  1. Upload demo-organization-export.json to production');
      console.warn('  2. Run: tsx scripts/import-demo-organization.ts');
    }

  } catch (_error) {
    console.error('\n❌ Demo organization sync failed:', _error);
    process.exit(1);
  } finally {
    await devPool.end();
    if (prodDb) {
      await prodDb.$client.end();
    }
  }
}

/**
 * Import Demo organization from JSON file (for production deployment).
 */
/**
 * ImportFromFile function.
 * @returns Function result.
 */
async function importFromFile(): Promise<void> {
  try {
    console.warn('📥 Importing Demo organization from JSON file...');
    
    const fs = await import('fs');
    const exportFile = 'demo-organization-export.json';
    
    if (!fs.existsSync(exportFile)) {
      throw new Error(`Export file ${exportFile} not found`);
    }
    
    const fileContent = await fs.promises.readFile(exportFile, 'utf8');
    const demoData: DemoOrganizationData = JSON.parse(fileContent);
    
    // Use current database connection for import
    await deleteDemoData(devDb);
    await importDemoData(devDb, demoData);
    
    console.warn('\n✅ Demo organization imported successfully from file!');
    
  } catch (_error) {
    console.error('\n❌ Demo organization import failed:', _error);
    process.exit(1);
  } finally {
    await devPool.end();
  }
}

// Main execution
/**
 *
 */
/**
 * Main function.
 * @returns Function result.
 */
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'import':
      await importFromFile();
      break;
    default:
      await syncDemoOrganization();
      break;
  }
}

// Export functions for use in API routes
export { exportDemoData, deleteDemoData, importDemoData };

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console._error);
}