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
async function checkDocuments() {
  console.log('🔍 Checking current document status...\n');

  try {
    // Check if legacy documents table exists
    console.log('📋 Checking legacy documents table:');
    try {
      const legacyDocs = await db.execute('SELECT COUNT(*) as count FROM documents');
      console.log(`   Legacy documents found: ${legacyDocs.rows[0]?.count || 0}`);
      
      if (parseInt(legacyDocs.rows[0]?.count as string) > 0) {
        console.log('\n   Sample legacy documents:');
        const sampleDocs = await db.execute(`
          SELECT id, name, type, buildings, residence, tenant, upload_date 
          FROM documents 
          LIMIT 5
        `);
        
        sampleDocs.rows.forEach((doc: any, index) => {
          console.log(`   ${index + 1}. ${doc.name} (${doc.type})`);
          console.log(`      Building: ${doc.buildings}, Residence: ${doc.residence}, Tenant: ${doc.tenant}`);
          console.log(`      Uploaded: ${doc.upload_date}`);
        });
      }
    } catch (error) {
      console.log('   ❌ Legacy documents table does not exist');
    }

    // Check if new documents_buildings table exists
    console.log('\n🏢 Checking documents_buildings table:');
    try {
      const buildingDocs = await db.execute('SELECT COUNT(*) as count FROM documents_buildings');
      console.log(`   Building documents found: ${buildingDocs.rows[0]?.count || 0}`);
      
      if (parseInt(buildingDocs.rows[0]?.count as string) > 0) {
        console.log('\n   Sample building documents:');
        const sampleBuildingDocs = await db.execute(`
          SELECT id, name, type, building_id, upload_date 
          FROM documents_buildings 
          LIMIT 3
        `);
        
        sampleBuildingDocs.rows.forEach((doc: any, index) => {
          console.log(`   ${index + 1}. ${doc.name} (${doc.type})`);
          console.log(`      Building ID: ${doc.building_id}`);
          console.log(`      Uploaded: ${doc.upload_date}`);
        });
      }
    } catch (error) {
      console.log('   ❌ documents_buildings table does not exist');
    }

    // Check if new documents_residents table exists
    console.log('\n🏠 Checking documents_residents table:');
    try {
      const residentDocs = await db.execute('SELECT COUNT(*) as count FROM documents_residents');
      console.log(`   Resident documents found: ${residentDocs.rows[0]?.count || 0}`);
      
      if (parseInt(residentDocs.rows[0]?.count as string) > 0) {
        console.log('\n   Sample resident documents:');
        const sampleResidentDocs = await db.execute(`
          SELECT id, name, type, residence_id, upload_date 
          FROM documents_residents 
          LIMIT 3
        `);
        
        sampleResidentDocs.rows.forEach((doc: any, index) => {
          console.log(`   ${index + 1}. ${doc.name} (${doc.type})`);
          console.log(`      Residence ID: ${doc.residence_id}`);
          console.log(`      Uploaded: ${doc.upload_date}`);
        });
      }
    } catch (error) {
      console.log('   ❌ documents_residents table does not exist');
    }

    // Check available buildings and residences for migration context
    console.log('\n🏗️  Available buildings and residences:');
    try {
      const buildings = await db.execute('SELECT COUNT(*) as count FROM buildings WHERE is_active = true');
      console.log(`   Active buildings: ${buildings.rows[0]?.count || 0}`);
    } catch (error) {
      console.log('   ❌ Cannot check buildings table');
    }

    try {
      const residences = await db.execute('SELECT COUNT(*) as count FROM residences WHERE is_active = true');
      console.log(`   Active residences: ${residences.rows[0]?.count || 0}`);
    } catch (error) {
      console.log('   ❌ Cannot check residences table');
    }

    console.log('\n✅ Document check completed');

  } catch (error) {
    console.error('❌ Error checking documents:', error);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDocuments()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { checkDocuments };