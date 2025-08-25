#!/usr/bin/env tsx

/**
 * Automatic Features Table Sync to Production.
 * 
 * This script synchronizes the features table from development to production
 * during deployments. It ensures the production roadmap reflects the latest
 * feature status and completion data.
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { features } from '../shared/schemas/development.js';
import { eq, ne } from 'drizzle-orm';

/**
 *
 */
interface FeatureSyncConfig {
  developmentDatabaseUrl: string;
  productionDatabaseUrl: string;
  dryRun?: boolean;
}

/**
 *
 */
interface SyncResult {
  success: boolean;
  message: string;
  stats: {
    total: number;
    synced: number;
    skipped: number;
    errors: number;
  };
  details?: string[];
}

/**
 * Syncs features table from development to production.
 * @param config
 */
async function syncFeaturesToProduction(config: FeatureSyncConfig): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    message: '',
    stats: { total: 0, synced: 0, skipped: 0, errors: 0 },
    details: []
  };

  try {
    // Connect to both databases
    const devDb = drizzle(config.developmentDatabaseUrl);
    const prodDb = drizzle(config.productionDatabaseUrl);

    console.log('🔄 Starting features table synchronization...');

    // Get all features from development
    const devFeatures = await devDb.select().from(features);
    result.stats.total = devFeatures.length;

    console.log(`📊 Found ${devFeatures.length} features in development database`);

    if (config.dryRun) {
      console.log('🧪 DRY RUN MODE - No changes will be made to production');
    }

    // Sync each feature
    for (const feature of devFeatures) {
      try {
        if (!config.dryRun) {
          // Check if feature exists in production
          const existing = await prodDb
            .select()
            .from(features)
            .where(eq(features.id, feature.id))
            .limit(1);

          if (existing.length > 0) {
            // Update existing feature
            await prodDb
              .update(features)
              .set({
                ...feature,
                syncedAt: new Date(),
                updatedAt: new Date()
              })
              .where(eq(features.id, feature.id));

            result.details?.push(`✅ Updated feature: ${feature.name}`);
          } else {
            // Insert new feature
            await prodDb.insert(features).values({
              ...feature,
              syncedAt: new Date(),
              updatedAt: new Date()
            });

            result.details?.push(`➕ Added new feature: ${feature.name}`);
          }
        }

        result.stats.synced++;
        console.log(`✅ ${config.dryRun ? '[DRY RUN] ' : ''}Synced: ${feature.name}`);

      } catch (error) {
        result.stats.errors++;
        const errorMsg = `❌ Failed to sync feature ${feature.name}: ${error}`;
        result.details?.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Mark sync completion
    if (!config.dryRun && result.stats.errors === 0) {
      console.log('🎯 Updating sync timestamps...');
      await prodDb
        .update(features)
        .set({ syncedAt: new Date() })
        .where(ne(features.syncedAt, null));
    }

    result.success = result.stats.errors === 0;
    result.message = result.success 
      ? `Successfully synced ${result.stats.synced} features to production`
      : `Sync completed with ${result.stats.errors} errors`;

    console.log(`🏁 Sync complete: ${result.message}`);
    return result;

  } catch (error) {
    result.success = false;
    result.message = `Sync failed: ${error}`;
    console.error('💥 Sync failed:', error);
    return result;
  }
}

/**
 * Main execution function.
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // In a real deployment, you'd have separate URLs for dev and prod
  // For now, we'll use the same database but mark records as synced
  const config: FeatureSyncConfig = {
    developmentDatabaseUrl: process.env.DATABASE_URL,
    productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
    dryRun: isDryRun
  };

  console.log('🚀 Features Sync to Production');
  console.log(`📋 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE SYNC'}`);
  console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development'}`);
  console.log('📡 Starting synchronization...\n');

  const result = await syncFeaturesToProduction(config);

  // Output results
  console.log('\n📊 SYNC RESULTS:');
  console.log(`✅ Success: ${result.success}`);
  console.log(`📝 Message: ${result.message}`);
  console.log(`📈 Stats:`);
  console.log(`   • Total features: ${result.stats.total}`);
  console.log(`   • Successfully synced: ${result.stats.synced}`);
  console.log(`   • Skipped: ${result.stats.skipped}`);
  console.log(`   • Errors: ${result.stats.errors}`);

  if (result.details && result.details.length > 0) {
    console.log('\n📋 Details:');
    result.details.forEach(detail => console.log(`   ${detail}`));
  }

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { syncFeaturesToProduction, type FeatureSyncConfig, type SyncResult };