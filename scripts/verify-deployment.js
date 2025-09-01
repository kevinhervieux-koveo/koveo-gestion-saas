#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying deployment readiness...\n');

// Check if dist folder exists
const distPath = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist folder not found. Run npm run build first.');
  process.exit(1);
}

// Check server build
const serverPath = path.join(distPath, 'index.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ Server build not found at dist/index.js');
  process.exit(1);
}

const serverStats = fs.statSync(serverPath);
console.log(`✅ Server build: ${(serverStats.size / 1024).toFixed(1)}kb`);

// Check client build
const clientPath = path.join(distPath, 'public', 'index.html');
if (!fs.existsSync(clientPath)) {
  console.error('❌ Client build not found at dist/public/index.html');
  process.exit(1);
}

console.log('✅ Client build found');

// Check for the fixed SQL query in the server build
const serverContent = fs.readFileSync(serverPath, 'utf8');
if (serverContent.includes('schema.documents.userId')) {
  console.error('❌ WARNING: Old SQL syntax still present (userId instead of uploadedById)');
  console.error('   The build contains the bug that causes 500 errors!');
  process.exit(1);
}

if (!serverContent.includes('uploadedById')) {
  console.error('❌ WARNING: Fixed SQL syntax not found in build');
  console.error('   The build may not contain the latest fixes!');
  process.exit(1);
}

console.log('✅ SQL syntax fix verified in build');

// Check package.json for start script
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.scripts || !packageJson.scripts.start) {
  console.error('❌ No start script found in package.json');
  process.exit(1);
}

console.log('✅ Start script configured:', packageJson.scripts.start);

console.log('\n✅ Deployment package is ready!');
console.log('📦 The build contains all fixes for the document upload issue.');
console.log('🚀 Ready to deploy to production.\n');