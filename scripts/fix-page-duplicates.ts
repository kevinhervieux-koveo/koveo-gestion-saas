#!/usr/bin/env tsx

/**
 * Script to fix page organization issues identified by tests.
 *
 * This script will:
 * 1. Remove orphaned pillars.tsx from root
 * 2. Identify and consolidate duplicate pages
 * 3. Update imports in App.tsx and other files
 * 4. Generate a migration report.
 */

import { existsSync, unlinkSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 *
 */
interface DuplicatePage {
  fileName: string;
  locations: string[];
  recommended: string;
  action: 'keep' | 'remove' | 'consolidate';
}

const duplicatePages: DuplicatePage[] = [
  {
    fileName: 'documentation.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate',
  },
  {
    fileName: 'permissions.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate',
  },
  {
    fileName: 'pillars.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate',
  },
  {
    fileName: 'quality.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate',
  },
  {
    fileName: 'roadmap.tsx',
    locations: ['admin', 'owner'],
    recommended: 'owner',
    action: 'consolidate',
  },
  {
    fileName: 'suggestions-with-filter.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate',
  },
  {
    fileName: 'suggestions.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate',
  },
  {
    fileName: 'demands.tsx',
    locations: ['manager', 'residents'],
    recommended: 'manager',
    action: 'consolidate',
  },
  {
    fileName: 'dashboard.tsx',
    locations: ['owner', 'residents'],
    recommended: 'keep', // Both are different - owner dashboard vs resident dashboard
    action: 'keep',
  },
];

/**
 *
 */
/**
 * Main function.
 * @returns Function result.
 */
function main() {
  console.warn('🔧 Starting page organization cleanup...\n');

  // 1. Remove orphaned pillars.tsx from root
  const orphanedPillarsPath = join(process.cwd(), 'client/src/pages/pillars.tsx');
  if (existsSync(orphanedPillarsPath)) {
    console.warn('📁 Removing orphaned pillars.tsx from root pages directory...');
    try {
      unlinkSync(orphanedPillarsPath);
      console.warn('✅ Removed: client/src/pages/pillars.tsx\n');
    } catch (_error) {
      console.error('❌ Failed to remove pillars.tsx:', _error);
    }
  }

  // 2. Process duplicate pages
  const consolidationReport: string[] = [];

  duplicatePages.forEach((duplicate) => {
    if (duplicate.action === 'keep') {
      console.warn(`📝 Keeping both versions of ${duplicate.fileName} (different purposes)`);
      consolidationReport.push(
        `KEPT: ${duplicate.fileName} - both versions serve different purposes`
      );
      return;
    }

    if (duplicate.action === 'consolidate') {
      console.warn(`🔄 Processing ${duplicate.fileName}...`);

      const keepLocation = duplicate.recommended;
      const removeLocations = duplicate.locations.filter((loc) => loc !== keepLocation);

      removeLocations.forEach((removeLocation) => {
        const removeFilePath = join(
          process.cwd(),
          `client/src/pages/${removeLocation}/${duplicate.fileName}`
        );

        if (existsSync(removeFilePath)) {
          try {
            unlinkSync(removeFilePath);
            console.warn(`  ✅ Removed: ${removeLocation}/${duplicate.fileName}`);
            consolidationReport.push(
              `REMOVED: ${removeLocation}/${duplicate.fileName} (kept ${keepLocation}/${duplicate.fileName})`
            );
          } catch (_error) {
            console.error(`  ❌ Failed to remove ${removeLocation}/${duplicate.fileName}:`, _error);
            consolidationReport.push(
              `ERROR: Failed to remove ${removeLocation}/${duplicate.fileName}`
            );
          }
        }
      });
    }
  });

  // 3. Generate migration report
  console.warn('\n📋 Consolidation Report:');
  consolidationReport.forEach((line) => console.warn(`  ${line}`));

  // 4. Update App.tsx imports (manual step - too complex to automate safely)
  console.warn('\n⚠️  Manual Steps Required:');
  console.warn('   1. Update App.tsx to remove imports for deleted pages');
  console.warn('   2. Update routing to point to the consolidated page locations');
  console.warn('   3. Test all affected routes');
  console.warn('   4. Run page organization tests to verify fixes');

  console.warn('\n✅ Page organization cleanup completed!');
  console.warn('   Run: npm run test tests/routing/page-organization.test.tsx');
}

if (require.main === module) {
  main();
}
