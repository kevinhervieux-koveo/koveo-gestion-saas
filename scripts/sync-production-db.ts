#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

console.log('🔄 Synchronizing production database schema...');

try {
  // Create production config
  const prodConfig = `import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL_KOVEO) {
  throw new Error('DATABASE_URL_KOVEO, ensure the production database is provisioned');
}

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_KOVEO,
  },
});`;

  writeFileSync('drizzle.config.prod.temp.ts', prodConfig);
  
  console.log('✅ Created temporary production config');
  
  // Execute the push with create column option
  console.log('🚀 Pushing schema to production database...');
  try {
    execSync('echo "+" | npx drizzle-kit push --config=drizzle.config.prod.temp.ts', {
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    console.log('✅ Production database schema updated successfully');
  } catch (error: any) {
    if (error.message.includes('create column')) {
      console.log('⚠️  Handling column creation prompt...');
      execSync('npx drizzle-kit push --config=drizzle.config.prod.temp.ts --force', {
        stdio: 'inherit'
      });
      console.log('✅ Production database schema updated with force');
    } else {
      throw error;
    }
  }
  
  // Clean up temp file
  unlinkSync('drizzle.config.prod.temp.ts');
  console.log('🧹 Cleaned up temporary config file');
  
  console.log('🎉 Production database synchronization completed!');
  
} catch (error) {
  console.error('❌ Error synchronizing production database:', error);
  // Clean up temp file if it exists
  try {
    unlinkSync('drizzle.config.prod.temp.ts');
  } catch {}
  process.exit(1);
}