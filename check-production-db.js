#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

async function checkProductionDatabase() {
  // Use the production database URL
  const sql = neon(process.env.DATABASE_URL_KOVEO);

  try {
    console.log('🔍 Checking production database structure...\n');

    // Check what tables exist in production
    const productionTables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    console.log('📋 Tables in PRODUCTION database:');
    const productionTableNames = productionTables.map(t => t.table_name);
    productionTableNames.forEach(table => console.log(`  ✓ ${table}`));

    // Check for critical maintenance tables
    const criticalTables = [
      'building_elements',
      'maintenance_projects', 
      'element_history',
      'project_elements',
      'element_documents',
      'common_spaces',
      'bookings',
      'user_booking_restrictions',
      'submission_vendors',
      'workflow_tasks',
      'auto_generated_projects',
      'evaluation_suggestions',
      'uniformat_codes',
      'vendors'
    ];

    console.log('\n🔍 Checking critical maintenance tables:');
    const missingTables = [];
    
    for (const table of criticalTables) {
      if (productionTableNames.includes(table)) {
        console.log(`  ✅ ${table} - EXISTS`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      console.log('\n⚠️  MISSING TABLES IN PRODUCTION:');
      missingTables.forEach(table => console.log(`  - ${table}`));
      console.log('\n💡 Production database needs schema updates.');
    } else {
      console.log('\n✅ All critical tables exist in production!');
    }

    // Check if buildings table has construction_date column  
    console.log('\n🏗️  Checking buildings table structure...');
    try {
      const buildingsColumns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'buildings'
        ORDER BY ordinal_position;
      `;
      
      console.log('Buildings table columns:');
      buildingsColumns.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });

      const hasConstructionDate = buildingsColumns.some(col => col.column_name === 'construction_date');
      if (!hasConstructionDate) {
        console.log('❌ buildings table missing construction_date column');
      } else {
        console.log('✅ buildings table has construction_date column');
      }
    } catch (error) {
      console.log('❌ buildings table does not exist');
    }

    // Check enums
    console.log('\n🔧 Checking enums...');
    try {
      const enums = await sql`
        SELECT enumname 
        FROM pg_enum pe
        JOIN pg_type pt ON pe.enumtypid = pt.oid
        GROUP BY enumname
        ORDER BY enumname;
      `;
      
      console.log('Available enums:');
      enums.forEach(e => console.log(`  ${e.enumname}`));
    } catch (error) {
      console.log('❌ Error checking enums:', error.message);
    }

  } catch (error) {
    console.error('❌ Error connecting to production database:', error.message);
  }
}

checkProductionDatabase();