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
    action: 'consolidate'
  },
  {
    fileName: 'permissions.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate'
  },
  {
    fileName: 'pillars.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate'
  },
  {
    fileName: 'quality.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate'
  },
  {
    fileName: 'roadmap.tsx',
    locations: ['admin', 'owner'],
    recommended: 'owner',
    action: 'consolidate'
  },
  {
    fileName: 'suggestions-with-filter.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate'
  },
  {
    fileName: 'suggestions.tsx',
    locations: ['admin', 'owner'],
    recommended: 'admin',
    action: 'consolidate'
  },
  {
    fileName: 'demands.tsx',
    locations: ['manager', 'residents'],
    recommended: 'manager',
    action: 'consolidate'
  },
  {
    fileName: 'dashboard.tsx',
    locations: ['owner', 'residents'],
    recommended: 'keep', // Both are different - owner dashboard vs resident dashboard
    action: 'keep'
  }
];

/**
 *
 */
function main() {
  console.log('🔧 Starting page organization cleanup...\n');

  // 1. Remove orphaned pillars.tsx from root
  const orphanedPillarsPath = join(process.cwd(), 'client/src/pages/pillars.tsx');
  if (existsSync(orphanedPillarsPath)) {
    console.log('📁 Removing orphaned pillars.tsx from root pages directory...');
    try {
      unlinkSync(orphanedPillarsPath);
      console.log('✅ Removed: client/src/pages/pillars.tsx\n');
    } catch (error) {
      console.error('❌ Failed to remove pillars.tsx:', error);
    }
  }

  // 2. Process duplicate pages
  const consolidationReport: string[] = [];
  
  duplicatePages.forEach(duplicate => {
    if (duplicate.action === 'keep') {
      console.log(`📝 Keeping both versions of ${duplicate.fileName} (different purposes)`);
      consolidationReport.push(`KEPT: ${duplicate.fileName} - both versions serve different purposes`);
      return;
    }

    if (duplicate.action === 'consolidate') {
      console.log(`🔄 Processing ${duplicate.fileName}...`);
      
      const keepLocation = duplicate.recommended;
      const removeLocations = duplicate.locations.filter(loc => loc !== keepLocation);
      
      removeLocations.forEach(removeLocation => {
        const removeFilePath = join(process.cwd(), `client/src/pages/${removeLocation}/${duplicate.fileName}`);
        
        if (existsSync(removeFilePath)) {
          try {
            unlinkSync(removeFilePath);
            console.log(`  ✅ Removed: ${removeLocation}/${duplicate.fileName}`);
            consolidationReport.push(`REMOVED: ${removeLocation}/${duplicate.fileName} (kept ${keepLocation}/${duplicate.fileName})`);
          } catch (error) {
            console.error(`  ❌ Failed to remove ${removeLocation}/${duplicate.fileName}:`, error);
            consolidationReport.push(`ERROR: Failed to remove ${removeLocation}/${duplicate.fileName}`);
          }
        }
      });
    }
  });

  // 3. Generate migration report
  console.log('\n📋 Consolidation Report:');
  consolidationReport.forEach(line => console.log(`  ${line}`));

  // 4. Update App.tsx imports (manual step - too complex to automate safely)
  console.log('\n⚠️  Manual Steps Required:');
  console.log('   1. Update App.tsx to remove imports for deleted pages');
  console.log('   2. Update routing to point to the consolidated page locations');
  console.log('   3. Test all affected routes');
  console.log('   4. Run page organization tests to verify fixes');

  console.log('\n✅ Page organization cleanup completed!');
  console.log('   Run: npm run test tests/routing/page-organization.test.tsx');
}

if (require.main === module) {
  main();
}