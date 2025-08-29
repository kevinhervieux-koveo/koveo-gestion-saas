/**
 * Demo Organizations Verification Utility
 * Ensures demo organizations exist before running security tests
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

async function verifyDemoOrganizations() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  try {
    // Check for Demo organization
    const demoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Demo'),
    });

    // Check for Open Demo organization
    const openDemoOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.name, 'Open Demo'),
    });

    if (!demoOrg) {
      console.error('❌ Demo organization not found in database');
      process.exit(1);
    }

    if (!openDemoOrg) {
      console.error('❌ Open Demo organization not found in database');
      process.exit(1);
    }

    console.log('✅ Demo organizations verified');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to verify demo organizations:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyDemoOrganizations();
