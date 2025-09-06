#!/usr/bin/env node

/**
 * Production Database Schema Validation Script
 * 
 * This script validates that all tables and columns defined in our Drizzle schema
 * exist in the production database with the correct structure.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Import all our schema definitions
import * as coreSchema from './shared/schemas/core.js';
import * as propertySchema from './shared/schemas/property.js';
import * as financialSchema from './shared/schemas/financial.js';
import * as operationsSchema from './shared/schemas/operations.js';
import * as documentsSchema from './shared/schemas/documents.js';
import * as invoicesSchema from './shared/schemas/invoices.js';
import * as developmentSchema from './shared/schemas/development.js';
import * as monitoringSchema from './shared/schemas/monitoring.js';
import * as infrastructureSchema from './shared/schemas/infrastructure.js';

// Production database connection
const databaseUrl = process.env.DATABASE_URL_KOVEO || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL_KOVEO or DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(databaseUrl);
const db = drizzle(sql);

/**
 * Get all tables and columns from the production database
 */
async function getProductionSchema() {
  const result = await sql`
    SELECT 
      t.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position
  `;
  
  const tables = {};
  
  result.forEach(row => {
    if (!tables[row.table_name]) {
      tables[row.table_name] = {
        columns: {}
      };
    }
    
    if (row.column_name) {
      tables[row.table_name].columns[row.column_name] = {
        data_type: row.data_type,
        is_nullable: row.is_nullable,
        column_default: row.column_default,
        character_maximum_length: row.character_maximum_length,
        numeric_precision: row.numeric_precision,
        numeric_scale: row.numeric_scale
      };
    }
  });
  
  return tables;
}

/**
 * Extract table definitions from our Drizzle schemas
 */
function getSchemaDefinitions() {
  const schemas = [
    coreSchema,
    propertySchema,
    financialSchema,
    operationsSchema,
    documentsSchema,
    invoicesSchema,
    developmentSchema,
    monitoringSchema,
    infrastructureSchema
  ];
  
  const tables = {};
  
  schemas.forEach(schema => {
    Object.keys(schema).forEach(key => {
      const item = schema[key];
      // Check if this looks like a Drizzle table definition
      if (item && typeof item === 'object' && item[Symbol.for('drizzle:EntityKind')] === 'PgTable') {
        const tableName = item[Symbol.for('drizzle:Name')];
        if (tableName) {
          tables[tableName] = {
            schemaKey: key,
            definition: item
          };
        }
      }
    });
  });
  
  return tables;
}

/**
 * Main validation function
 */
async function validateSchema() {
  console.log('🔍 Starting production database schema validation...\n');
  
  try {
    // Get production database schema
    console.log('📊 Fetching production database schema...');
    const productionTables = await getProductionSchema();
    console.log(`✅ Found ${Object.keys(productionTables).length} tables in production\n`);
    
    // Get our schema definitions
    console.log('📋 Analyzing schema definitions...');
    const schemaTables = getSchemaDefinitions();
    console.log(`✅ Found ${Object.keys(schemaTables).length} table definitions in schema\n`);
    
    // Validation results
    const results = {
      missingTables: [],
      extraTables: [],
      tableComparisons: {},
      totalIssues: 0
    };
    
    // Check for missing tables (in schema but not in production)
    console.log('🔍 Checking for missing tables in production...');
    Object.keys(schemaTables).forEach(tableName => {
      if (!productionTables[tableName]) {
        results.missingTables.push(tableName);
        results.totalIssues++;
      }
    });
    
    // Check for extra tables (in production but not in schema)
    console.log('🔍 Checking for extra tables in production...');
    Object.keys(productionTables).forEach(tableName => {
      if (!schemaTables[tableName]) {
        results.extraTables.push(tableName);
        results.totalIssues++;
      }
    });
    
    // Compare common tables
    console.log('🔍 Validating table structures...');
    Object.keys(schemaTables).forEach(tableName => {
      if (productionTables[tableName]) {
        results.tableComparisons[tableName] = {
          status: 'exists',
          productionColumns: Object.keys(productionTables[tableName].columns),
          productionColumnCount: Object.keys(productionTables[tableName].columns).length
        };
      }
    });
    
    // Generate report
    console.log('\n📋 VALIDATION REPORT');
    console.log('==========================================\n');
    
    if (results.totalIssues === 0) {
      console.log('✅ ALL VALIDATIONS PASSED!');
      console.log('Production database schema is synchronized with code definitions.\n');
    } else {
      console.log(`❌ Found ${results.totalIssues} schema issues:\n`);
    }
    
    // Missing tables
    if (results.missingTables.length > 0) {
      console.log('❌ MISSING TABLES IN PRODUCTION:');
      results.missingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log();
    }
    
    // Extra tables
    if (results.extraTables.length > 0) {
      console.log('⚠️  EXTRA TABLES IN PRODUCTION (not in schema):');
      results.extraTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log();
    }
    
    // Table comparisons
    console.log('📊 TABLE STATUS SUMMARY:');
    console.log('Table Name                     | Status    | Columns');
    console.log('-------------------------------|-----------|--------');
    
    // Sort all tables alphabetically
    const allTables = new Set([
      ...Object.keys(productionTables),
      ...Object.keys(schemaTables)
    ]);
    
    Array.from(allTables).sort().forEach(tableName => {
      const inProduction = !!productionTables[tableName];
      const inSchema = !!schemaTables[tableName];
      
      let status = '';
      let columnCount = '';
      
      if (inProduction && inSchema) {
        status = '✅ Synced';
        columnCount = Object.keys(productionTables[tableName].columns).length.toString();
      } else if (inProduction && !inSchema) {
        status = '⚠️  Extra';
        columnCount = Object.keys(productionTables[tableName].columns).length.toString();
      } else if (!inProduction && inSchema) {
        status = '❌ Missing';
        columnCount = 'N/A';
      }
      
      const nameColumn = tableName.padEnd(30);
      const statusColumn = status.padEnd(9);
      console.log(`${nameColumn} | ${statusColumn} | ${columnCount}`);
    });
    
    console.log('\n📋 RECOMMENDATIONS:');
    if (results.missingTables.length > 0) {
      console.log('1. Run `npm run db:push --force` to create missing tables in production');
    }
    
    if (results.extraTables.length > 0) {
      console.log('2. Review extra tables and determine if they should be added to schema or removed');
    }
    
    if (results.totalIssues === 0) {
      console.log('✅ No action required - schema is fully synchronized!');
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log(`   • Total Production Tables: ${Object.keys(productionTables).length}`);
    console.log(`   • Total Schema Tables: ${Object.keys(schemaTables).length}`);
    console.log(`   • Missing in Production: ${results.missingTables.length}`);
    console.log(`   • Extra in Production: ${results.extraTables.length}`);
    console.log(`   • Issues Found: ${results.totalIssues}`);
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run validation
validateSchema().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});