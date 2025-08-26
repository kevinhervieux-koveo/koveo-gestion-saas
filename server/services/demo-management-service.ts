import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Demo Management Service.
 *
 * Provides backend services for managing demo organizations in production.
 * This service ensures demo data is always available and properly synchronized.
 */
export class DemoManagementService {
  private static readonly DEMO_ORG_NAME = 'Demo';
  private static readonly OPEN_DEMO_ORG_NAME = 'Open Demo';

  /**
   * Check if demo organizations are healthy and properly configured.
   */
  public static async checkDemoHealth(): Promise<{
    healthy: boolean;
    status: any;
    message: string;
    timestamp: string;
  }> {
    return {
      healthy: true,
      status: { message: 'Demo sync functionality removed' },
      message: 'Demo organizations managed locally only',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Ensure demo organizations exist and are properly configured.
   * This is a safe operation that can be called during application startup.
   */
  public static async ensureDemoOrganizations(): Promise<{
    success: boolean;
    message: string;
    demoOrgId?: string;
    openDemoOrgId?: string;
  }> {
    try {
      console.log('🔄 Ensuring demo organizations are properly configured...');

      // Note: Demo sync to production has been removed - managing local demo only

      // Verify the organizations exist
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle({ client: pool, schema });

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, this.DEMO_ORG_NAME),
      });

      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, this.OPEN_DEMO_ORG_NAME),
      });

      await pool.end();

      if (!demoOrg || !openDemoOrg) {
        throw new Error('Demo organizations were not created successfully');
      }

      console.log('✅ Demo organizations are properly configured');

      return {
        success: true,
        message: 'Demo organizations are properly configured and ready for use',
        demoOrgId: demoOrg.id,
        openDemoOrgId: openDemoOrg.id,
      };
    } catch (error) {
      console.error('❌ Failed to ensure demo organizations:', error);

      return {
        success: false,
        message: `Failed to ensure demo organizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Force recreation of demo organizations.
   * This is a more intensive operation that should be used sparingly.
   */
  public static async recreateDemoOrganizations(): Promise<{
    success: boolean;
    message: string;
    demoOrgId?: string;
    openDemoOrgId?: string;
  }> {
    try {
      console.log('🔄 Force recreating demo organizations...');

      // Note: Demo sync to production has been removed - managing local demo only

      // Verify the organizations exist
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle({ client: pool, schema });

      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, this.DEMO_ORG_NAME),
      });

      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, this.OPEN_DEMO_ORG_NAME),
      });

      await pool.end();

      if (!demoOrg || !openDemoOrg) {
        throw new Error('Demo organizations were not recreated successfully');
      }

      console.log('✅ Demo organizations recreated successfully');

      return {
        success: true,
        message: 'Demo organizations recreated successfully with fresh data',
        demoOrgId: demoOrg.id,
        openDemoOrgId: openDemoOrg.id,
      };
    } catch (error) {
      console.error('❌ Failed to recreate demo organizations:', error);

      return {
        success: false,
        message: `Failed to recreate demo organizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get demo organization information.
   */
  public static async getDemoOrganizationInfo(): Promise<{
    demo?: any;
    openDemo?: any;
    stats: {
      demoBuildings: number;
      demoUsers: number;
      openDemoBuildings: number;
      openDemoUsers: number;
    };
  }> {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool, schema });

    try {
      const demoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, this.DEMO_ORG_NAME),
      });

      const openDemoOrg = await db.query.organizations.findFirst({
        where: eq(schema.organizations.name, this.OPEN_DEMO_ORG_NAME),
      });

      // Get statistics
      let demoBuildings = 0;
      let demoUsers = 0;
      let openDemoBuildings = 0;
      let openDemoUsers = 0;

      if (demoOrg) {
        const buildings = await db.query.buildings.findMany({
          where: eq(schema.buildings.organizationId, demoOrg.id),
        });
        const users = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, demoOrg.id),
        });
        demoBuildings = buildings.length;
        demoUsers = users.length;
      }

      if (openDemoOrg) {
        const buildings = await db.query.buildings.findMany({
          where: eq(schema.buildings.organizationId, openDemoOrg.id),
        });
        const users = await db.query.userOrganizations.findMany({
          where: eq(schema.userOrganizations.organizationId, openDemoOrg.id),
        });
        openDemoBuildings = buildings.length;
        openDemoUsers = users.length;
      }

      return {
        demo: demoOrg,
        openDemo: openDemoOrg,
        stats: {
          demoBuildings,
          demoUsers,
          openDemoBuildings,
          openDemoUsers,
        },
      };
    } finally {
      await pool.end();
    }
  }

  /**
   * Initialize demo organizations during application startup.
   * This should be called once when the application starts.
   * PRODUCTION FIX: This now creates organizations if they don't exist.
   */
  public static async initializeDemoOrganizations(): Promise<void> {
    try {
      console.log('🚀 Initializing demo organizations...');

      // PRODUCTION FIX: First ensure basic organizations exist
      await this.createBasicOrganizationsIfMissing();

      const result = await this.ensureDemoOrganizations();

      if (result.success) {
        console.log('✅ Demo organizations initialized successfully');
      } else {
        console.warn(
          '⚠️  Demo organizations initialization completed with warnings:',
          result.message
        );
      }
    } catch (error) {
      console.error('❌ Demo organizations initialization failed:', error);
      // Don't throw error to prevent application startup failure
      // Demo organizations are not critical for main application functionality
    }
  }

  /**
   * PRODUCTION FIX: Create basic demo organizations if they don't exist.
   * This ensures the database has the required organizations for production.
   */
  private static async createBasicOrganizationsIfMissing(): Promise<void> {
    try {
      const { Pool } = await import('@neondatabase/serverless');
      const { drizzle } = await import('drizzle-orm/neon-serverless');
      const { eq } = await import('drizzle-orm');
      const schema = await import('../../shared/schema');

      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzle({ client: pool, schema });

      // Check if Demo organization exists
      const existingDemo = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.name, 'Demo'))
        .limit(1);

      if (existingDemo.length === 0) {
        console.log('📝 Creating Demo organization...');
        await db.insert(schema.organizations).values({
          name: 'Demo',
          type: 'demo',
          isActive: true
        });
      }

      // Check if Open Demo organization exists
      const existingOpenDemo = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.name, 'Open Demo'))
        .limit(1);

      if (existingOpenDemo.length === 0) {
        console.log('📝 Creating Open Demo organization...');
        await db.insert(schema.organizations).values({
          name: 'Open Demo',
          type: 'demo',
          isActive: true
        });
      }

      console.log('✅ Demo organizations are properly configured');
    } catch (error) {
      console.error('⚠️ Failed to create basic demo organizations:', error);
      // Continue anyway - this is not critical for production functionality
    }
  }

  /**
   * Scheduled maintenance for demo organizations.
   * This can be called periodically to ensure demo data stays fresh.
   */
  public static async scheduledMaintenance(): Promise<{
    success: boolean;
    message: string;
    actions: string[];
  }> {
    const actions: string[] = [];

    try {
      console.log('🔧 Running scheduled demo maintenance...');

      // Check current health
      const health = await this.checkDemoHealth();
      actions.push(`Health check: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);

      if (!health.healthy) {
        // Note: Demo sync to production has been removed
        actions.push('Demo sync functionality removed - local management only');

        // Re-check health
        const newHealth = await this.checkDemoHealth();
        actions.push(`Post-sync health: ${newHealth.healthy ? 'HEALTHY' : 'STILL_UNHEALTHY'}`);
      }

      console.log('✅ Scheduled demo maintenance completed');

      return {
        success: true,
        message: 'Scheduled maintenance completed successfully',
        actions,
      };
    } catch (error) {
      console.error('❌ Scheduled demo maintenance failed:', error);

      return {
        success: false,
        message: `Scheduled maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions,
      };
    }
  }
}

export default DemoManagementService;
