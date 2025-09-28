#!/usr/bin/env node

import { neon } from '@neondatabase/serverless';

async function checkSchemaDifferences() {
  const prodSql = neon(process.env.DATABASE_URL_KOVEO);
  const devSql = neon(process.env.DATABASE_URL);

  try {
    console.log('🔍 Comparing schema differences between DEV and PRODUCTION...\n');

    // Check key maintenance tables for structural differences
    const keyTables = [
      'maintenance_projects',
      'submission_vendors', 
      'workflow_tasks',
      'building_elements'
    ];

    for (const tableName of keyTables) {
      console.log(`📋 Checking table: ${tableName}`);
      
      try {
        // Get production schema
        const prodColumns = await prodSql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position;
        `;

        // Get dev schema  
        const devColumns = await devSql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position;
        `;

        console.log(`  Production columns (${prodColumns.length}):`);
        prodColumns.forEach(col => {
          console.log(`    ${col.column_name} (${col.data_type})`);
        });

        console.log(`  Dev columns (${devColumns.length}):`);
        devColumns.forEach(col => {
          console.log(`    ${col.column_name} (${col.data_type})`);
        });

        // Find differences
        const prodColumnNames = new Set(prodColumns.map(c => c.column_name));
        const devColumnNames = new Set(devColumns.map(c => c.column_name));

        const missingInProd = [...devColumnNames].filter(name => !prodColumnNames.has(name));
        const missingInDev = [...prodColumnNames].filter(name => !devColumnNames.has(name));

        if (missingInProd.length > 0) {
          console.log(`  ❌ Missing in PRODUCTION: ${missingInProd.join(', ')}`);
        }
        if (missingInDev.length > 0) {
          console.log(`  ⚠️  Extra in PRODUCTION: ${missingInDev.join(', ')}`);
        }

        // Check type differences for common columns
        const commonColumns = [...prodColumnNames].filter(name => devColumnNames.has(name));
        const typeDiffs = [];
        
        for (const colName of commonColumns) {
          const prodCol = prodColumns.find(c => c.column_name === colName);
          const devCol = devColumns.find(c => c.column_name === colName);
          
          if (prodCol.data_type !== devCol.data_type) {
            typeDiffs.push(`${colName}: PROD(${prodCol.data_type}) vs DEV(${devCol.data_type})`);
          }
        }

        if (typeDiffs.length > 0) {
          console.log(`  🔄 Type differences: ${typeDiffs.join(', ')}`);
        }

        if (missingInProd.length === 0 && missingInDev.length === 0 && typeDiffs.length === 0) {
          console.log(`  ✅ Schemas match!`);
        }

      } catch (error) {
        console.log(`  ❌ Error checking ${tableName}: ${error.message}`);
      }
      
      console.log('');
    }

    // Also check for specific problematic columns mentioned in TypeScript errors
    console.log('🔍 Checking specific problematic columns...\n');
    
    // Check submission_vendors for vendorId vs vendor_id
    try {
      const submissionVendorsColumns = await prodSql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'submission_vendors' 
        AND column_name LIKE '%vendor%';
      `;
      
      console.log('submission_vendors vendor columns:');
      submissionVendorsColumns.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    } catch (error) {
      console.log('❌ Error checking submission_vendors vendor columns');
    }

    // Check maintenance_projects date column types
    try {
      const maintenanceProjectsDateColumns = await prodSql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'maintenance_projects' 
        AND column_name LIKE '%date%';
      `;
      
      console.log('\nmaintenance_projects date columns:');
      maintenanceProjectsDateColumns.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type})`);
      });
    } catch (error) {
      console.log('❌ Error checking maintenance_projects date columns');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSchemaDifferences();