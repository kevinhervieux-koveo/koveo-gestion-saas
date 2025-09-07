#!/usr/bin/env tsx

/**
 * Investigation script for production user account creation issue
 * User: francois-pierre.landry@hotmail.com
 * Issue: Internal server error during account creation
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';

console.log('🔍 Investigating production user account creation issue...');
console.log('👤 User: francois-pierre.landry@hotmail.com');
console.log('🌍 Environment: Production (DATABASE_URL_KOVEO)');

async function investigateProductionUser() {
  try {
    // Use production database
    const productionUrl = process.env.DATABASE_URL_KOVEO;
    if (!productionUrl) {
      throw new Error('DATABASE_URL_KOVEO not found in environment variables');
    }

    console.log('🔗 Connecting to production database...');
    const pool = new Pool({ connectionString: productionUrl });
    const db = drizzle(pool, { schema });

    const userEmail = 'francois-pierre.landry@hotmail.com';

    // 1. Check if user already exists
    console.log('\n📋 Step 1: Checking if user already exists...');
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, userEmail))
      .limit(1);

    if (existingUser.length > 0) {
      console.log('✅ User found in database:');
      console.log('  - ID:', existingUser[0].id);
      console.log('  - Email:', existingUser[0].email);
      console.log('  - Username:', existingUser[0].username);
      console.log('  - Role:', existingUser[0].role);
      console.log('  - Active:', existingUser[0].isActive);
      console.log('  - Created:', existingUser[0].createdAt);
      console.log('  - Last Login:', existingUser[0].lastLoginAt);
    } else {
      console.log('❌ User NOT found in database');
    }

    // 2. Check for any pending invitations
    console.log('\n📧 Step 2: Checking for pending invitations...');
    const invitations = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.email, userEmail));

    if (invitations.length > 0) {
      console.log(`✅ Found ${invitations.length} invitation(s):`);
      invitations.forEach((inv, index) => {
        console.log(`  Invitation ${index + 1}:`);
        console.log('    - ID:', inv.id);
        console.log('    - Status:', inv.status);
        console.log('    - Role:', inv.role);
        console.log('    - Created:', inv.createdAt);
        console.log('    - Expires:', inv.expiresAt);
        console.log('    - Invited by:', inv.invitedBy);
        console.log('    - Organization:', inv.organizationId);
      });
    } else {
      console.log('❌ No invitations found for this email');
    }

    // 3. Check for any password reset tokens
    console.log('\n🔑 Step 3: Checking for password reset tokens...');
    const resetTokens = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.email, userEmail));

    if (resetTokens.length > 0) {
      console.log(`✅ Found ${resetTokens.length} password reset token(s):`);
      resetTokens.forEach((token, index) => {
        console.log(`  Token ${index + 1}:`);
        console.log('    - ID:', token.id);
        console.log('    - Created:', token.createdAt);
        console.log('    - Expires:', token.expiresAt);
        console.log('    - Used:', token.used);
      });
    } else {
      console.log('❌ No password reset tokens found');
    }

    // 4. Check for conflicting usernames
    console.log('\n👥 Step 4: Checking for potential username conflicts...');
    const potentialUsernames = [
      'francois-pierre.landry',
      'francois-pierre',
      'francoispierre.landry',
      'francoispierre',
      'flandry',
      'fplandry'
    ];

    for (const username of potentialUsernames) {
      const usernameCheck = await db
        .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);

      if (usernameCheck.length > 0) {
        console.log(`⚠️  Username '${username}' is taken by:`, usernameCheck[0]);
      }
    }

    // 5. Check database constraints and table structure
    console.log('\n🏗️  Step 5: Checking database table structure...');
    
    // Test if we can insert a similar record (dry run)
    console.log('📝 Testing account creation constraints...');
    
    // Check for any unique constraint violations
    const emailCheck = await db
      .select({ count: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, userEmail));
    
    console.log(`📊 Users with this email: ${emailCheck.length}`);

    // 6. Check organization access
    console.log('\n🏢 Step 6: Checking organization structure...');
    const organizations = await db
      .select()
      .from(schema.organizations)
      .limit(5);

    console.log(`📊 Total organizations available: ${organizations.length}`);
    if (organizations.length > 0) {
      console.log('Sample organizations:');
      organizations.forEach((org, index) => {
        console.log(`  ${index + 1}. ${org.name} (${org.id}) - Type: ${org.type}`);
      });
    }

    await pool.end();
    console.log('\n✅ Investigation complete!');

  } catch (error: any) {
    console.error('❌ Investigation failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Check if it's a connection error
    if (error.message.includes('connect') || error.message.includes('connection')) {
      console.error('🔗 Database connection issue detected');
      console.error('💡 Possible causes:');
      console.error('  - DATABASE_URL_KOVEO is incorrect');
      console.error('  - Network connectivity issues');
      console.error('  - Database server is down');
    }
    
    // Check if it's a permissions error
    if (error.message.includes('permission') || error.message.includes('access')) {
      console.error('🔒 Database permissions issue detected');
      console.error('💡 Possible causes:');
      console.error('  - Insufficient database permissions');
      console.error('  - Wrong database credentials');
    }
    
    process.exit(1);
  }
}

// Run the investigation
investigateProductionUser();