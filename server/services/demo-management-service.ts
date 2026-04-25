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
    // Demo organizations functionality disabled per user request
    return;
  }

  /**
   * Sample a handful of `filePath` values that look like seeded object-storage
   * attachments (they start with `/objects/`) across documents and bills, and
   * verify that the underlying files actually exist in object storage.
   *
   * When a demo environment is cloned or restored without re-running the seed
   * script, the database rows still reference `/objects/...` paths whose
   * bytes were never uploaded. This check surfaces that drift so admins (or
   * server-start logs) can recommend re-running the seed script instead of
   * leaving users with silent "File not found" errors.
   *
   * @param sampleSize Maximum number of file paths to probe per table.
   */
  public static async checkSeededDocumentIntegrity(sampleSize: number = 5): Promise<{
    healthy: boolean;
    totalSampled: number;
    totalMissing: number;
    missing: Array<{ table: string; filePath: string }>;
    errors: Array<{ table: string; error: string }>;
    remediation: string;
    timestamp: string;
  }> {
    const { db } = await import('../db');
    const { isNotNull, and, like } = await import('drizzle-orm');
    const schema = await import('../../shared/schema');
    const { ObjectStorageService, ObjectNotFoundError } = await import(
      '../objectStorage'
    );

    const objectStorage = new ObjectStorageService();

    const sources: Array<{ table: string; select: () => Promise<Array<{ filePath: string | null }>> }> = [
      {
        table: 'documents',
        select: () =>
          db
            .select({ filePath: schema.documents.filePath })
            .from(schema.documents)
            .where(like(schema.documents.filePath, '/objects/%'))
            .limit(sampleSize),
      },
      {
        table: 'bills',
        select: () =>
          db
            .select({ filePath: schema.bills.filePath })
            .from(schema.bills)
            .where(
              and(
                isNotNull(schema.bills.filePath),
                like(schema.bills.filePath, '/objects/%'),
              ),
            )
            .limit(sampleSize),
      },
    ];
    let totalSampled = 0;
    const missing: Array<{ table: string; filePath: string }> = [];
    const errors: Array<{ table: string; error: string }> = [];

    for (const source of sources) {
      let rows: Array<{ filePath: string | null }>;
      try {
        rows = await source.select();
      } catch (error) {
        // Only swallow the narrow "relation does not exist" case (older
        // schemas); all other query failures must bubble up into `errors`
        // and force an unhealthy verdict so real problems stay visible.
        const message = error instanceof Error ? error.message : String(error);
        const code = (error as { code?: string } | null)?.code;
        const isRelationMissing =
          code === '42P01' || /relation .* does not exist/i.test(message);
        if (isRelationMissing) continue;
        errors.push({ table: source.table, error: message });
        continue;
      }
      for (const row of rows) {
        if (!row.filePath) continue;
        totalSampled++;
        try {
          await objectStorage.getObjectEntityFile(row.filePath);
        } catch (error) {
          if (error instanceof ObjectNotFoundError) {
            missing.push({ table: source.table, filePath: row.filePath });
          } else {
            // Non-"not found" failures (bucket auth, env misconfig,
            // network) are infrastructure problems — not seed drift — and
            // belong in `errors` so the remediation message stays
            // accurate.
            errors.push({
              table: source.table,
              error: `${row.filePath}: ${
                error instanceof Error ? error.message : 'unknown error'
              }`,
            });
          }
        }
      }
    }

    const healthy = missing.length === 0 && errors.length === 0;
    let remediation: string;
    if (healthy) {
      remediation = 'All sampled seeded documents are present in object storage.';
    } else if (errors.length > 0) {
      remediation =
        'Document integrity probe failed for one or more sources. Inspect the `errors` field and fix database or storage access before trusting the result.';
    } else {
      remediation =
        'Some seeded documents reference object-storage paths whose bytes are missing. Re-run the marketing demo seed script (npm run db:seed:marketing or scripts/setup-marketing-demo-data.ts) to repopulate the files.';
    }
    return {
      healthy,
      totalSampled,
      totalMissing: missing.length,
      missing,
      errors,
      remediation,
      timestamp: new Date().toISOString(),
    };
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

    } catch (error) {
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


      return {
        success: true,
        message: 'Scheduled maintenance completed successfully',
        actions,
      };
    } catch (error) {
      return {
        success: false,
        message: `Scheduled maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions,
      };
    }
  }
}

export default DemoManagementService;
