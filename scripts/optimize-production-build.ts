#!/usr/bin/env npx tsx
/**
 * Production build optimization script
 * Reduces bundle sizes and improves static file serving
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting production build optimization...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
  execSync('rm -rf dist/', { stdio: 'inherit' });
} catch (error) {
  console.log('No previous build to clean');
}

// Build with optimizations
console.log('🔨 Building optimized client...');
try {
  execSync('vite build --mode production', { stdio: 'inherit' });
} catch (error) {
  console.error('Client build failed:', error);
  process.exit(1);
}

// Build server
console.log('🔨 Building optimized server...');
try {
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify', { stdio: 'inherit' });
} catch (error) {
  console.error('Server build failed:', error);
  process.exit(1);
}

// Analyze build sizes
console.log('📊 Analyzing build sizes...');
const publicDir = path.resolve('dist/public');
const assetsDir = path.resolve(publicDir, 'assets');

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  const cssFiles = files.filter(f => f.endsWith('.css'));
  
  console.log('\n📦 Bundle Analysis:');
  console.log(`   JS files: ${jsFiles.length}`);
  console.log(`   CSS files: ${cssFiles.length}`);
  
  // Check for large files
  const largeFiles = files.filter(file => {
    const filePath = path.resolve(assetsDir, file);
    const stats = fs.statSync(filePath);
    return stats.size > 200 * 1024; // > 200KB
  });
  
  if (largeFiles.length > 0) {
    console.log('\n⚠️  Large files detected (>200KB):');
    largeFiles.forEach(file => {
      const filePath = path.resolve(assetsDir, file);
      const stats = fs.statSync(filePath);
      console.log(`   ${file}: ${Math.round(stats.size / 1024)}KB`);
    });
  } else {
    console.log('\n✅ All files under 200KB - good for production serving');
  }
}

// Create gzipped versions for better serving
console.log('\n🗜️  Creating compressed versions...');
try {
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    files.forEach(file => {
      if (file.endsWith('.js') || file.endsWith('.css')) {
        const filePath = path.resolve(assetsDir, file);
        execSync(`gzip -k -f "${filePath}"`, { stdio: 'inherit' });
      }
    });
    console.log('✅ Compressed versions created');
  }
} catch (error) {
  console.log('Note: gzip not available, compression will be handled at runtime');
}

console.log('\n🎉 Production build optimization complete!');
console.log('\nNext steps:');
console.log('1. Deploy the optimized dist/ folder');
console.log('2. Ensure NODE_ENV=production is set');
console.log('3. Monitor server resources for 503 errors');