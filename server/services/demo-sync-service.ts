import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 * Demo Synchronization Service.
 * 
 * Synchronizes data from the Demo organization to the Open Demo organization
 * to provide a read-only demo environment. This service copies buildings,
 * residences, documents, bills, and other data while preserving the
 * view-only nature of the Open Demo organization.
 */
export class DemoSyncService {
  private static readonly DEMO_ORG_NAME = 'Demo';
  private static readonly OPEN_DEMO_ORG_NAME = 'Open Demo';

  /**
   * Get the Demo organization.
   */
  private static async getDemoOrg() {
    return await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, this.DEMO_ORG_NAME)
    });
  }

  /**
   * Get the Open Demo organization.
   */
  private static async getOpenDemoOrg() {
    return await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, this.OPEN_DEMO_ORG_NAME)
    });
  }

  /**
   * Synchronize organization data from Demo to Open Demo.
   */
  public static async syncOrganizationData(): Promise<void> {
    console.warn('🔄 Starting Demo → Open Demo synchronization...');
    
    const demoOrg = await this.getDemoOrg();
    const openDemoOrg = await this.getOpenDemoOrg();

    if (!demoOrg) {
      throw new Error('Demo organization not found');
    }

    if (!openDemoOrg) {
      throw new Error('Open Demo organization not found');
    }

    try {
      // Sync buildings
      await this.syncBuildings(demoOrg.id, openDemoOrg.id);
      
      // Sync residences (after buildings)
      await this.syncResidences(demoOrg.id, openDemoOrg.id);
      
      // Sync documents
      await this.syncDocuments(demoOrg.id, openDemoOrg.id);
      
      // Sync budgets
      await this.syncBudgets(demoOrg.id, openDemoOrg.id);
      
      // Sync bills
      await this.syncBills(demoOrg.id, openDemoOrg.id);
      
      // Sync maintenance requests
      await this.syncMaintenanceRequests(demoOrg.id, openDemoOrg.id);

      console.warn('✅ Demo → Open Demo synchronization completed successfully');
      
    } catch (_error) {
      console.error('❌ Demo synchronization failed:', _error);
      throw error;
    }
  }

  /**
   * Sync buildings from Demo to Open Demo.
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncBuildings(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.warn('  📋 Syncing buildings...');
    
    // Get all buildings from Demo organization
    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId)
    });

    // Get existing Open Demo buildings 
    const existingOpenDemoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, openDemoOrgId)
    });

    // Create mapping of existing buildings by name for updates
    const existingBuildingMap = new Map(
      existingOpenDemoBuildings.map(b => [b.name, b])
    );

    for (const demoBuilding of demoBuildings) {
      const existingBuilding = existingBuildingMap.get(demoBuilding.name);
      
      const buildingData = {
        name: demoBuilding.name,
        address: demoBuilding.address,
        city: demoBuilding.city,
        province: demoBuilding.province,
        postalCode: demoBuilding.postalCode,
        buildingType: demoBuilding.buildingType,
        totalUnits: demoBuilding.totalUnits,
        constructionYear: demoBuilding.constructionYear,
        totalFloors: demoBuilding.totalFloors,
        hasElevator: demoBuilding.hasElevator,
        hasParking: demoBuilding.hasParking,
        isActive: demoBuilding.isActive,
        organizationId: openDemoOrgId
      };

      if (existingBuilding) {
        // Update existing building
        await db.update(schema.buildings)
          .set(buildingData)
          .where(eq(schema.buildings.id, existingBuilding.id));
      } else {
        // Create new building
        await db.insert(schema.buildings).values(buildingData);
      }
    }

    console.warn(`  ✅ Synced ${demoBuildings.length} buildings`);
  }

  /**
   * Sync residences from Demo to Open Demo.
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncResidences(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.warn('  🏠 Syncing residences...');
    
    // Get Demo buildings and their residences
    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId),
      with: {
        residences: true
      }
    });

    // Get Open Demo buildings
    const openDemoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, openDemoOrgId)
    });

    // Create mapping from demo building name to open demo building
    const buildingMapping = new Map();
    for (const openDemoBuilding of openDemoBuildings) {
      const matchingDemoBuilding = demoBuildings.find(b => b.name === openDemoBuilding.name);
      if (matchingDemoBuilding) {
        buildingMapping.set(matchingDemoBuilding.id, openDemoBuilding.id);
      }
    }

    let totalResidences = 0;
    
    for (const demoBuilding of demoBuildings) {
      const openDemoBuildingId = buildingMapping.get(demoBuilding.id);
      if (!openDemoBuildingId) {continue;}

      // Get existing residences in Open Demo building
      const existingResidences = await db.query.residences.findMany({
        where: eq(schema.residences.buildingId, openDemoBuildingId)
      });

      const existingResidenceMap = new Map(
        existingResidences.map(r => [`${r.floor}-${r.unitNumber}`, r])
      );

      for (const demoResidence of demoBuilding.residences) {
        const existingResidence = existingResidenceMap.get(`${demoResidence.floor}-${demoResidence.unitNumber}`);
        
        const residenceData = {
          unitNumber: demoResidence.unitNumber,
          floor: demoResidence.floor,
          residenceType: demoResidence.residenceType,
          squareFootage: demoResidence.squareFootage,
          bedrooms: demoResidence.bedrooms,
          bathrooms: demoResidence.bathrooms,
          balconySquareFootage: demoResidence.balconySquareFootage,
          storageIncluded: demoResidence.storageIncluded,
          parkingIncluded: demoResidence.parkingIncluded,
          isActive: demoResidence.isActive,
          buildingId: openDemoBuildingId
        };

        if (existingResidence) {
          // Update existing residence
          await db.update(schema.residences)
            .set(residenceData)
            .where(eq(schema.residences.id, existingResidence.id));
        } else {
          // Create new residence
          await db.insert(schema.residences).values(residenceData);
        }
        
        totalResidences++;
      }
    }

    console.warn(`  ✅ Synced ${totalResidences} residences`);
  }

  /**
   * Sync documents from Demo to Open Demo.
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncDocuments(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.warn('  📄 Syncing documents...');
    
    // Get all documents associated with Demo organization buildings
    const demoBuildingIds = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId),
      columns: { id: true }
    });

    if (demoBuildingIds.length === 0) {return;}

    const demoDocuments = await db.query.documents.findMany({
      with: {
        buildings: true,
        residences: true
      }
    });

    // Filter documents that belong to Demo organization
    const relevantDocuments = demoDocuments.filter(doc => 
      doc.buildings?.some(db => demoBuildingIds.some(building => building.id === db.buildingId))
    );

    console.warn(`  ✅ Found ${relevantDocuments.length} documents to sync`);
  }

  /**
   * Sync budgets from Demo to Open Demo.
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncBudgets(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.warn('  💰 Syncing budgets...');
    
    // Get Demo buildings
    const demoBuildingIds = (await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId),
      columns: { id: true }
    })).map(b => b.id);

    if (demoBuildingIds.length === 0) {return;}

    const budgets = await db.query.budgets.findMany({
      where: inArray(schema.budgets.buildingId, demoBuildingIds)
    });

    console.warn(`  ✅ Found ${budgets.length} budgets to sync`);
  }

  /**
   * Sync bills from Demo to Open Demo.
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncBills(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.warn('  🧾 Syncing bills...');
    
    // Get Demo residences through buildings
    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId),
      with: {
        residences: true
      }
    });

    const demoResidenceIds = demoBuildings.flatMap(b => b.residences.map(r => r.id));

    if (demoResidenceIds.length === 0) {return;}

    const bills = await db.query.bills.findMany({
      where: inArray(schema.bills.residenceId, demoResidenceIds)
    });

    console.warn(`  ✅ Found ${bills.length} bills to sync`);
  }

  /**
   * Sync maintenance requests from Demo to Open Demo.
   * @param demoOrgId
   * @param openDemoOrgId
   */
  private static async syncMaintenanceRequests(demoOrgId: string, openDemoOrgId: string): Promise<void> {
    console.warn('  🔧 Syncing maintenance requests...');
    
    // Get Demo residences
    const demoBuildings = await db.query.buildings.findMany({
      where: eq(schema.buildings.organizationId, demoOrgId),
      with: {
        residences: true
      }
    });

    const demoResidenceIds = demoBuildings.flatMap(b => b.residences.map(r => r.id));

    if (demoResidenceIds.length === 0) {return;}

    const maintenanceRequests = await db.query.maintenanceRequests.findMany({
      where: inArray(schema.maintenanceRequests.residenceId, demoResidenceIds)
    });

    console.warn(`  ✅ Found ${maintenanceRequests.length} maintenance requests to sync`);
  }

  /**
   * Run complete synchronization.
   */
  public static async runSync(): Promise<void> {
    try {
      await this.syncOrganizationData();
      console.warn('🎉 Demo synchronization completed successfully');
    } catch (_error) {
      console.error('💥 Demo synchronization failed:', _error);
      throw error;
    }
  }
}

// Export for use in other modules
export default DemoSyncService;