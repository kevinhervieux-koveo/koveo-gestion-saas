#!/usr/bin/env node

/**
 * Script to update demo user passwords in production database
 * This ensures demo users can login with the standard "demo123456" password
 */

import bcrypt from 'bcryptjs';
import { Pool } from '@neondatabase/serverless';

// Demo password that should work for all demo users
const DEMO_PASSWORD = 'demo123456';
const DEMO_PASSWORD_HASH = '$2b$12$cOc/QjMjzlhqAQqF2b/MTOZr2QAtERbXJGd4OSa1CXMlF04FC3F02';

async function updateDemoPasswords() {
  const productionDbUrl = process.env.DATABASE_URL_KOVEO;
  
  if (!productionDbUrl) {
    console.error('❌ DATABASE_URL_KOVEO environment variable not found');
    console.log('This script needs to run against the production database');
    process.exit(1);
  }

  console.log('🔗 Connecting to production database...');
  const pool = new Pool({ connectionString: productionDbUrl });

  try {
    // Verify the hash works
    const isValid = await bcrypt.compare(DEMO_PASSWORD, DEMO_PASSWORD_HASH);
    if (!isValid) {
      throw new Error('Password hash verification failed');
    }
    console.log('✅ Password hash verified');

    // Get current demo users
    const currentDemoUsers = await pool.query(`
      SELECT id, email, role, password 
      FROM users 
      WHERE role IN ('demo_manager', 'demo_tenant', 'demo_resident')
      ORDER BY role, email
    `);

    console.log(`📊 Found ${currentDemoUsers.rows.length} demo users:`);
    currentDemoUsers.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.role})`);
    });

    if (currentDemoUsers.rows.length === 0) {
      console.log('⚠️ No demo users found in production database');
      return;
    }

    // Update passwords for all demo users
    console.log('🔄 Updating demo user passwords...');
    
    const updateResult = await pool.query(`
      UPDATE users 
      SET password = $1, updated_at = CURRENT_TIMESTAMP
      WHERE role IN ('demo_manager', 'demo_tenant', 'demo_resident')
    `, [DEMO_PASSWORD_HASH]);

    console.log(`✅ Updated ${updateResult.rowCount} demo user passwords`);

    // Verify the update worked
    console.log('🔍 Verifying updates...');
    const verifyUsers = await pool.query(`
      SELECT email, role, password 
      FROM users 
      WHERE role IN ('demo_manager', 'demo_tenant', 'demo_resident')
      ORDER BY role, email
    `);

    let allCorrect = true;
    for (const user of verifyUsers.rows) {
      const isCorrect = user.password === DEMO_PASSWORD_HASH;
      console.log(`  ${user.email}: ${isCorrect ? '✅ Correct' : '❌ Wrong'}`);
      if (!isCorrect) allCorrect = false;
    }

    if (allCorrect) {
      console.log('🎉 All demo users now have the correct password hash!');
      console.log('🔑 Demo users can now login with password: demo123456');
    } else {
      console.error('❌ Some passwords were not updated correctly');
    }

  } catch (error) {
    console.error('❌ Error updating demo passwords:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
updateDemoPasswords().catch(console.error);