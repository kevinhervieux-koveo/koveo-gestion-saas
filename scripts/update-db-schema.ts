#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';

async function updateSchema() {
  console.log('🔄 Updating database schema...');
  
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  try {
    // Create actionable_items table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS actionable_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_id UUID NOT NULL REFERENCES features(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        technical_details TEXT,
        implementation_prompt TEXT,
        testing_requirements TEXT,
        estimated_effort TEXT,
        dependencies JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        completed_at TIMESTAMP,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Created actionable_items table');

    // Add new columns to features table if they don't exist
    const columnsToAdd = [
      { name: 'business_objective', type: 'TEXT' },
      { name: 'target_users', type: 'TEXT' },
      { name: 'success_metrics', type: 'TEXT' },
      { name: 'technical_complexity', type: 'TEXT' },
      { name: 'dependencies', type: 'TEXT' },
      { name: 'user_flow', type: 'TEXT' },
      { name: 'ai_analysis_result', type: 'JSONB' },
      { name: 'ai_analyzed_at', type: 'TIMESTAMP' },
    ];

    for (const column of columnsToAdd) {
      try {
        await sql(`ALTER TABLE features ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`✅ Added column ${column.name} to features table`);
      } catch (error: any) {
        if (error.code === '42701') {
          console.log(`⏭️  Column ${column.name} already exists`);
        } else {
          throw error;
        }
      }
    }

    // Update default status for features if needed
    await sql`ALTER TABLE features ALTER COLUMN status SET DEFAULT 'submitted'`;
    console.log('✅ Updated default status for features');

    console.log('\n✨ Database schema updated successfully!');
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    process.exit(1);
  }
}

updateSchema();