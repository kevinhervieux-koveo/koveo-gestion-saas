#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { organizations } from './shared/schema.js';

async function checkProdOrganizations() {
  const connection = neon(process.env.DATABASE_URL_KOVEO!);
  const db = drizzle(connection);

  try {
    const orgs = await db.select().from(organizations);
    console.log(`Found ${orgs.length} organizations in production database:`);
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (${org.type}) - ${org.city}, ${org.province}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Active: ${org.isActive}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error querying production database:', error);
  }
}

checkProdOrganizations();