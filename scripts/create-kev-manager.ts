#!/usr/bin/env tsx
// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)

/**
 * One-off script to upsert Kevin's dev manager account.
 *
 * - email:    kevhervieux@gmail.com
 * - password: Admin12345!  (stored as bcrypt hash, 12 rounds)
 * - role:     manager
 * - isActive: true
 *
 * If the user already exists the script updates the password and role
 * instead of failing. No user_organizations rows are created.
 *
 * Usage: tsx scripts/create-kev-manager.ts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';
import * as bcrypt from 'bcryptjs';
import { resolveDatabaseUrl } from './run-migrations-url';

neonConfig.webSocketConstructor = ws;

const TARGET_EMAIL = 'kevhervieux@gmail.com';
const TARGET_PASSWORD = 'Admin12345!';
const SALT_ROUNDS = 12;

const pool = new Pool({ connectionString: resolveDatabaseUrl().url });
const db = drizzle({ client: pool, schema });

async function upsertKevManager() {
  console.warn('🔍 Looking for existing user:', TARGET_EMAIL);

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, TARGET_EMAIL))
    .limit(1);

  const hashedPassword = await bcrypt.hash(TARGET_PASSWORD, SALT_ROUNDS);

  if (existing.length > 0) {
    const user = existing[0];
    console.warn('♻️  User already exists — updating password and role...');

    await db
      .update(schema.users)
      .set({
        password: hashedPassword,
        role: 'manager',
        isActive: true,
        language: 'fr',
      })
      .where(eq(schema.users.id, user.id));

    console.warn('✅ User updated successfully');
    console.warn('   id:    ', user.id);
    console.warn('   email: ', TARGET_EMAIL);
    console.warn('   role:  manager');
    return;
  }

  // Generate a username from email (kevhervieux)
  const baseUsername = TARGET_EMAIL.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase();

  // Ensure uniqueness
  let username = baseUsername;
  let counter = 1;
  while (true) {
    const conflict = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    if (conflict.length === 0) break;
    username = `${baseUsername}${counter}`;
    counter++;
  }

  console.warn('👤 Creating new manager user...');

  const inserted = await db
    .insert(schema.users)
    .values({
      email: TARGET_EMAIL,
      username,
      password: hashedPassword,
      firstName: 'Kevin',
      lastName: 'Hervieux',
      language: 'fr',
      role: 'manager',
      isActive: true,
    })
    .returning();

  if (inserted[0]) {
    console.warn('✅ Manager user created successfully!');
    console.warn('   id:    ', inserted[0].id);
    console.warn('   email: ', TARGET_EMAIL);
    console.warn('   role:  manager');
  }
}

async function main() {
  console.warn('');
  console.warn('🏠 Koveo Gestion — dev manager account setup');
  console.warn('============================================');
  try {
    await upsertKevManager();
    console.warn('');
    console.warn('🎉 Done! Kevin can now log in at the local app.');
    console.warn('   Email:    ' + TARGET_EMAIL);
    console.warn('   Password: ' + TARGET_PASSWORD);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});
