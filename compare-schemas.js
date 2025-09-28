// Compare development vs production schemas to find the real issue
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = neon(connectionString);

async function checkMissingTables() {
  try {
    console.log('Checking for missing maintenance tables in production...');
    
    const requiredTables = [
      'uniformat_codes',
      'vendors', 
      'building_elements',
      'element_history',
      'evaluation_suggestions',
      'auto_generated_projects',
      'maintenance_projects',
      'project_steps',
      'project_elements',
      'element_documents',
      'submission_vendors',
      'workflow_tasks',
      'project_notifications',
      'element_project_updates'
    ];
    
    for (const tableName of requiredTables) {
      try {
        const exists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          );
        `;
        
        if (exists[0].exists) {
          console.log(`✅ ${tableName} - exists`);
          
          // Check if it has data
          const count = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)} LIMIT 1`;
          console.log(`   Records: ${count[0].count}`);
        } else {
          console.log(`❌ ${tableName} - MISSING`);
        }
      } catch (error) {
        console.log(`❌ ${tableName} - ERROR: ${error.message}`);
      }
    }
    
    // Check for missing foreign key relationships
    console.log('\nChecking foreign key constraints...');
    const fkConstraints = await sql`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('maintenance_projects', 'auto_generated_projects')
      ORDER BY tc.table_name, tc.constraint_name;
    `;
    
    console.log('Foreign key constraints:');
    fkConstraints.forEach(fk => {
      console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
  } catch (error) {
    console.error('Schema check failed:', error.message);
  }
}

checkMissingTables().then(() => {
  console.log('\nSchema comparison complete');
  process.exit(0);
}).catch(error => {
  console.error('Check failed:', error);
  process.exit(1);
});