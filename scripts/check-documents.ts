#!/usr/bin/env tsx

/**
 * Document Check Script.
 *
 * This script checks the current state of documents in the database
 * and displays information about existing documents and table structure.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

/**
 *
 */
/**
 * CheckDocuments function.
 * @returns Function result.
 */
async function checkDocuments() {
  console.warn('🔍 Checking current document status...\n');

  try {
    // Check if legacy documents table exists
    console.warn('📋 Checking legacy documents table:');
    try {
      const legacyDocs = await db.execute('SELECT COUNT(*) as count FROM documents');
      console.warn(`   Legacy documents found: ${legacyDocs.rows[0]?.count || 0}`);

      if (parseInt(legacyDocs.rows[0]?.count as string) > 0) {
        console.warn('\n   Sample legacy documents:');
        const sampleDocs = await db.execute(`
          SELECT id, name, type, buildings, residence, tenant, upload_date 
          FROM documents 
          LIMIT 5
        `);

        sampleDocs.rows.forEach((doc: any, _index) => {
          console.warn(`   ${index + 1}. ${doc.name} (${doc.type})`);
          console.warn(
            `      Building: ${doc.buildings}, Residence: ${doc.residence}, Tenant: ${doc.tenant}`
          );
          console.warn(`      Uploaded: ${doc.upload_date}`);
        });
      }
    } catch (_error) {
      console.warn('   ❌ Legacy documents table does not exist');
    }

    // Check if new documents_buildings table exists
    console.warn('\n🏢 Checking documents_buildings table:');
    try {
      const buildingDocs = await db.execute('SELECT COUNT(*) as count FROM documents_buildings');
      console.warn(`   Building documents found: ${buildingDocs.rows[0]?.count || 0}`);

      if (parseInt(buildingDocs.rows[0]?.count as string) > 0) {
        console.warn('\n   Sample building documents:');
        const sampleBuildingDocs = await db.execute(`
          SELECT id, name, type, building_id, upload_date 
          FROM documents_buildings 
          LIMIT 3
        `);

        sampleBuildingDocs.rows.forEach((doc: any, _index) => {
          console.warn(`   ${index + 1}. ${doc.name} (${doc.type})`);
          console.warn(`      Building ID: ${doc.building_id}`);
          console.warn(`      Uploaded: ${doc.upload_date}`);
        });
      }
    } catch (_error) {
      console.warn('   ❌ documents_buildings table does not exist');
    }

    // Check if new documents_residents table exists
    console.warn('\n🏠 Checking documents_residents table:');
    try {
      const residentDocs = await db.execute('SELECT COUNT(*) as count FROM documents_residents');
      console.warn(`   Resident documents found: ${residentDocs.rows[0]?.count || 0}`);

      if (parseInt(residentDocs.rows[0]?.count as string) > 0) {
        console.warn('\n   Sample resident documents:');
        const sampleResidentDocs = await db.execute(`
          SELECT id, name, type, residence_id, upload_date 
          FROM documents_residents 
          LIMIT 3
        `);

        sampleResidentDocs.rows.forEach((doc: any, _index) => {
          console.warn(`   ${index + 1}. ${doc.name} (${doc.type})`);
          console.warn(`      Residence ID: ${doc.residence_id}`);
          console.warn(`      Uploaded: ${doc.upload_date}`);
        });
      }
    } catch (_error) {
      console.warn('   ❌ documents_residents table does not exist');
    }

    // Check available buildings and residences for migration context
    console.warn('\n🏗️  Available buildings and residences:');
    try {
      const buildings = await db.execute(
        'SELECT COUNT(*) as count FROM buildings WHERE is_active = true'
      );
      console.warn(`   Active buildings: ${buildings.rows[0]?.count || 0}`);
    } catch (_error) {
      console.warn('   ❌ Cannot check buildings table');
    }

    try {
      const residences = await db.execute(
        'SELECT COUNT(*) as count FROM residences WHERE is_active = true'
      );
      console.warn(`   Active residences: ${residences.rows[0]?.count || 0}`);
    } catch (_error) {
      console.warn('   ❌ Cannot check residences table');
    }

    console.warn('\n✅ Document check completed');
  } catch (_error) {
    console.error('❌ Error checking documents:', _error);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDocuments()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { checkDocuments };
