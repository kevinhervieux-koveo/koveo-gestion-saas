/**
 * Database Connection Check Utility
 * Used by the demo security test runner to verify database connectivity
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

async function checkConnection() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connection successful');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    await pool.end();
    process.exit(1);
  }
}

checkConnection();