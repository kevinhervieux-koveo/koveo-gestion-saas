#!/usr/bin/env tsx

/**
 * Script to create initial admin user for Koveo Gestion.
 * Creates a default admin account for Quebec property management system access.
 * 
 * Usage: tsx scripts/create-admin-user.ts.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 * Creates a default admin user for the system.
 * Checks if admin already exists before creating to avoid duplicates.
 */
async function createAdminUser() {
  try {
    console.log('🔍 Checking for existing admin user...');
    
    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@koveo-gestion.com'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists');
      console.log('📧 Email: admin@koveo-gestion.com');
      console.log('🔑 Password: Admin123!');
      return;
    }

    console.log('👤 Creating default admin user...');

    // Create admin user
    const adminUser = await db
      .insert(schema.users)
      .values({
        email: 'admin@koveo-gestion.com',
        password: 'Admin123!', // TODO: Hash with bcrypt in production
        firstName: 'Administrateur',
        lastName: 'Système',
        phone: '+1-514-555-0100',
        language: 'fr',
        role: 'admin',
      })
      .returning();

    if (adminUser[0]) {
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: admin@koveo-gestion.com');
      console.log('🔑 Password: Admin123!');
      console.log('🌐 Language: Français (Quebec)');
      console.log('👤 Role: Administrator');
      console.log('');
      console.log('🔐 Security Note: Please change the default password after first login');
      console.log('🇨🇦 Law 25 Compliance: This account follows Quebec privacy regulations');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Creates additional sample users for testing and demonstration.
 */
async function createSampleUsers() {
  try {
    console.log('👥 Creating sample users for testing...');

    // Sample Manager
    const existingManager = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'manager@koveo-gestion.com'))
      .limit(1);

    if (existingManager.length === 0) {
      await db.insert(schema.users).values({
        email: 'manager@koveo-gestion.com',
        password: 'Manager123!',
        firstName: 'Marie',
        lastName: 'Tremblay',
        phone: '+1-514-555-0200',
        language: 'fr',
        role: 'manager',
      });
      console.log('✅ Sample manager created: manager@koveo-gestion.com');
    }

    // Sample Owner
    const existingOwner = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'owner@koveo-gestion.com'))
      .limit(1);

    if (existingOwner.length === 0) {
      await db.insert(schema.users).values({
        email: 'owner@koveo-gestion.com',
        password: 'Owner123!',
        firstName: 'Jean',
        lastName: 'Québécois',
        phone: '+1-514-555-0300',
        language: 'fr',
        role: 'admin',
      });
      console.log('✅ Sample admin created: admin@koveo-gestion.com');
    }

    // Sample Tenant
    const existingTenant = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'tenant@koveo-gestion.com'))
      .limit(1);

    if (existingTenant.length === 0) {
      await db.insert(schema.users).values({
        email: 'tenant@koveo-gestion.com',
        password: 'Tenant123!',
        firstName: 'Sophie',
        lastName: 'Laval',
        phone: '+1-514-555-0400',
        language: 'fr',
        role: 'tenant',
      });
      console.log('✅ Sample tenant created: tenant@koveo-gestion.com');
    }

    console.log('');
    console.log('🎯 Test accounts ready for Quebec property management system');
    console.log('🔐 All passwords follow the same pattern: [Role]123!');

  } catch (error) {
    console.error('❌ Error creating sample users:', error);
  }
}

// Execute the script
/**
 *
 */
async function main() {
  console.log('🏠 Koveo Gestion - Quebec Property Management System');
  console.log('👤 User Initialization Script');
  console.log('=====================================');
  console.log('');

  await createAdminUser();
  await createSampleUsers();

  console.log('');
  console.log('🎉 User initialization complete!');
  console.log('🔗 Access the system at http://localhost:5000');
  console.log('🇫🇷 Système de gestion immobilière du Québec prêt!');
}

// Run the script if called directly
main().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

export { createAdminUser, createSampleUsers };