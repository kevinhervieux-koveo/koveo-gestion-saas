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
   * DISABLED: Demo organization creation has been disabled per user request.
   */
  public static async ensureDemoOrganizations(): Promise<{
    success: boolean;
    message: string;
    demoOrgId?: string;
    openDemoOrgId?: string;
  }> {
    // Demo organizations functionality disabled per user request - no database operations
    console.log('✅ Demo organizations functionality disabled (skipped)');

    return {
      success: true,
      message: 'Demo organizations functionality disabled - skipping all database operations',
    };
  }

  /**
   * Force recreation of demo organizations.
   * DISABLED: Demo organization functionality has been disabled per user request.
   */
  public static async recreateDemoOrganizations(): Promise<{
    success: boolean;
    message: string;
    demoOrgId?: string;
    openDemoOrgId?: string;
  }> {
    console.log('✅ Demo organizations recreation skipped (disabled)');

    return {
      success: true,
      message: 'Demo organizations functionality disabled - recreation skipped',
    };
  }

  /**
   * Get demo organization information.
   * DISABLED: Demo organization functionality has been disabled per user request.
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
    console.log('✅ Demo organizations info retrieval skipped (disabled)');

    return {
      stats: {
        demoBuildings: 0,
        demoUsers: 0,
        openDemoBuildings: 0,
        openDemoUsers: 0,
      },
    };
  }

  /**
   * Initialize demo organizations during application startup.
   * DISABLED: Demo organization functionality has been disabled per user request.
   */
  public static async initializeDemoOrganizations(): Promise<void> {
    console.log('✅ Demo organizations initialization skipped (disabled)');
    // Demo organizations functionality disabled per user request
    return;
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

      // Use shared database connection to avoid multiple pools
      const { db } = await import('../db');

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
          address: '123 Demo Street',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1A 1A1',
          isActive: true,
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
          address: '456 Demo Avenue',
          city: 'Montreal',
          province: 'QC',
          postalCode: 'H1B 1B1',
          isActive: true,
        });
      }

      console.log('✅ Demo organizations are properly configured');
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

      return {
        success: false,
        message: `Scheduled maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions,
      };
    }
  }
}

export default DemoManagementService;
