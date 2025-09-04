#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';

async function checkProdSchema() {
  const connection = neon(process.env.DATABASE_URL_KOVEO!);

  try {
    // Check organizations table structure
    const result = await connection(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'organizations'
      ORDER BY ordinal_position
    `);
    
    console.log('Production organizations table structure:');
    result.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Try a simple count query
    const countResult = await connection('SELECT COUNT(*) as count FROM organizations');
    console.log(`\nTotal organizations in production: ${countResult[0].count}`);
    
    // Try to get organization names directly
    const orgsResult = await connection('SELECT id, name, type, city FROM organizations LIMIT 10');
    console.log('\nOrganizations in production:');
    orgsResult.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (${org.type}) - ${org.city}`);
    });
    
  } catch (error) {
    console.error('Error checking production schema:', error);
  }
}

checkProdSchema();