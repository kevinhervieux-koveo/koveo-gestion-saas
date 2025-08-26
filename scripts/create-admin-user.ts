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
/**
 * CreateAdminUser function.
 * @returns Function result.
 */
async function createAdminUser() {
  try {
    console.warn('🔍 Checking for existing admin user...');

    // Check if admin user already exists
    const existingAdmin = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'admin@koveo-gestion.com'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.warn('✅ Admin user already exists');
      console.warn('📧 Email: admin@koveo-gestion.com');
      console.warn('🔑 Password: Admin123!');
      return;
    }

    console.warn('👤 Creating default admin user...');

    // Create admin user
    const adminUser = await db
      .insert(schema.users)
      .values({
        email: 'admin@koveo-gestion.com',
        password: 'Admin123!', // Will be auto-migrated to bcrypt on first login
        firstName: 'Administrateur',
        lastName: 'Système',
        phone: '+1-514-555-0100',
        language: 'fr',
        role: 'admin',
      })
      .returning();

    if (adminUser[0]) {
      console.warn('✅ Admin user created successfully!');
      console.warn('📧 Email: admin@koveo-gestion.com');
      console.warn('🔑 Password: Admin123!');
      console.warn('🌐 Language: Français (Quebec)');
      console.warn('👤 Role: Administrator');
      console.warn('');
      console.warn('🔐 Security Note: Please change the default password after first login');
      console.warn('🇨🇦 Law 25 Compliance: This account follows Quebec privacy regulations');
    }
  } catch (_error) {
    console.error('❌ Error creating admin user:', _error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Creates additional sample users for testing and demonstration.
 */
/**
 * CreateSampleUsers function.
 * @returns Function result.
 */
async function createSampleUsers() {
  try {
    console.warn('👥 Creating sample users for testing...');

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
      console.warn('✅ Sample manager created: manager@koveo-gestion.com');
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
      console.warn('✅ Sample admin created: admin@koveo-gestion.com');
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
      console.warn('✅ Sample tenant created: tenant@koveo-gestion.com');
    }

    console.warn('');
    console.warn('🎯 Test accounts ready for Quebec property management system');
    console.warn('🔐 All passwords follow the same pattern: [Role]123!');
  } catch (_error) {
    console.error('❌ Error creating sample users:', _error);
  }
}

// Execute the script
/**
 *
 */
/**
 * Main function.
 * @returns Function result.
 */
async function main() {
  console.warn('🏠 Koveo Gestion - Quebec Property Management System');
  console.warn('👤 User Initialization Script');
  console.warn('=====================================');
  console.warn('');

  await createAdminUser();
  await createSampleUsers();

  console.warn('');
  console.warn('🎉 User initialization complete!');
  console.warn('🔗 Access the system at http://localhost:5000');
  console.warn('🇫🇷 Système de gestion immobilière du Québec prêt!');
}

// Run the script if called directly
main().catch((_error) => {
  console.error('💥 Script failed:', _error);
  process.exit(1);
});

export { createAdminUser, createSampleUsers };
