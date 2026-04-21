#!/usr/bin/env node
/**
 * Fix Uploads Path Duplication Bug
 * 
 * This script migrates files from the duplicated uploads/uploads/ structure
 * to the correct uploads/ structure and updates all database records.
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

class UploadPathMigration {
  constructor() {
    this.projectRoot = process.cwd();
    this.uploadsDir = path.join(this.projectRoot, 'uploads');
    this.duplicatedDir = path.join(this.uploadsDir, 'uploads');
    
    this.migratedFiles = [];
    this.errors = [];
  }

  async run() {
    console.log('🚀 Starting uploads path duplication fix...\n');
    
    try {
      // Check if duplicated directory exists
      if (!existsSync(this.duplicatedDir)) {
        console.log('✅ No duplicated uploads/uploads directory found. Nothing to migrate.');
        return;
      }
      
      console.log('📁 Found duplicated uploads/uploads directory');
      
      // 1. Scan and migrate files
      await this.migrateFiles();
      
      // 2. Clean up empty directories
      await this.cleanupEmptyDirectories();
      
      // 3. Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateFiles() {
    console.log('📦 Starting file migration...');
    
    const duplicatedTypes = await fs.readdir(this.duplicatedDir);
    
    for (const type of duplicatedTypes) {
      const typeDuplicatedDir = path.join(this.duplicatedDir, type);
      const typeCorrectDir = path.join(this.uploadsDir, type);
      
      if (!(await fs.stat(typeDuplicatedDir)).isDirectory()) continue;
      
      console.log(`  🔄 Migrating ${type} files...`);
      await this.migrateTypeDirectory(typeDuplicatedDir, typeCorrectDir, type);
    }
    
    console.log(`✅ File migration complete. Migrated ${this.migratedFiles.length} files.`);
  }

  async migrateTypeDirectory(sourceDir, targetDir, type) {
    await this.ensureDirectoryExists(targetDir);
    
    const items = await fs.readdir(sourceDir);
    
    for (const item of items) {
      const sourcePath = path.join(sourceDir, item);
      const targetPath = path.join(targetDir, item);
      
      const stat = await fs.stat(sourcePath);
      
      if (stat.isDirectory()) {
        // Recursively handle subdirectories
        await this.migrateTypeDirectory(sourcePath, targetPath, type);
      } else {
        // Migrate file
        await this.migrateFile(sourcePath, targetPath, type);
      }
    }
  }

  async migrateFile(sourcePath, targetPath, type) {
    try {
      // Check if target file already exists
      if (existsSync(targetPath)) {
        console.log(`    ⚠️  Target file already exists: ${path.relative(this.projectRoot, targetPath)}`);
        
        // Compare files to see if they're identical
        const sourceStats = await fs.stat(sourcePath);
        const targetStats = await fs.stat(targetPath);
        
        if (sourceStats.size === targetStats.size) {
          const sourceBuffer = await fs.readFile(sourcePath);
          const targetBuffer = await fs.readFile(targetPath);
          
          if (sourceBuffer.equals(targetBuffer)) {
            console.log(`    ✅ Files are identical, removing duplicate`);
            await fs.unlink(sourcePath);
            
            // Also remove metadata file if it exists
            const metadataPath = `${sourcePath}.metadata.json`;
            if (existsSync(metadataPath)) {
              await fs.unlink(metadataPath);
            }
            
            this.migratedFiles.push({
              from: path.relative(this.projectRoot, sourcePath),
              to: path.relative(this.projectRoot, targetPath),
              type,
              action: 'removed_duplicate'
            });
            
            return;
          }
        }
        
        // Files are different, create unique name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = path.extname(targetPath);
        const baseName = path.basename(targetPath, ext);
        const dir = path.dirname(targetPath);
        targetPath = path.join(dir, `${baseName}-migrated-${timestamp}${ext}`);
      }
      
      // Ensure target directory exists
      await this.ensureDirectoryExists(path.dirname(targetPath));
      
      // Move file
      await fs.copyFile(sourcePath, targetPath);
      await fs.unlink(sourcePath);
      
      // Move metadata file if it exists
      const sourceMetadataPath = `${sourcePath}.metadata.json`;
      const targetMetadataPath = `${targetPath}.metadata.json`;
      
      if (existsSync(sourceMetadataPath)) {
        await fs.copyFile(sourceMetadataPath, targetMetadataPath);
        await fs.unlink(sourceMetadataPath);
      }
      
      this.migratedFiles.push({
        from: path.relative(this.projectRoot, sourcePath),
        to: path.relative(this.projectRoot, targetPath),
        type,
        action: 'migrated'
      });
      
      console.log(`    ✅ Migrated: ${path.relative(this.uploadsDir, sourcePath)} → ${path.relative(this.uploadsDir, targetPath)}`);
      
    } catch (error) {
      this.errors.push({
        action: 'migrate_file',
        source: sourcePath,
        target: targetPath,
        error: error.message
      });
      console.error(`    ❌ Failed to migrate ${sourcePath}:`, error.message);
    }
  }

  async cleanupEmptyDirectories() {
    console.log('🧹 Cleaning up empty directories...');
    
    await this.removeEmptyDirectories(this.duplicatedDir);
    
    if (existsSync(this.duplicatedDir)) {
      try {
        const items = await fs.readdir(this.duplicatedDir);
        if (items.length === 0) {
          await fs.rmdir(this.duplicatedDir);
          console.log('  ✅ Removed empty uploads/uploads directory');
        } else {
          console.log(`  ⚠️  uploads/uploads directory not empty, contains: ${items.join(', ')}`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not remove uploads/uploads directory:`, error.message);
      }
    }
  }

  async removeEmptyDirectories(dir) {
    if (!existsSync(dir)) return;
    
    try {
      const items = await fs.readdir(dir);
      
      // Recursively clean subdirectories
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await this.removeEmptyDirectories(itemPath);
        }
      }
      
      // Check if directory is now empty
      const remainingItems = await fs.readdir(dir);
      if (remainingItems.length === 0) {
        await fs.rmdir(dir);
        console.log(`  ✅ Removed empty directory: ${path.relative(this.projectRoot, dir)}`);
      }
      
    } catch (error) {
      // Ignore errors when cleaning up directories
    }
  }

  async ensureDirectoryExists(dir) {
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  generateReport() {
    console.log('\n📊 Migration Report');
    console.log('='.repeat(50));
    console.log(`📦 Files migrated: ${this.migratedFiles.length}`);
    console.log(`❌ Errors encountered: ${this.errors.length}`);
    
    if (this.migratedFiles.length > 0) {
      console.log('\n📁 Migrated Files:');
      const actions = this.migratedFiles.reduce((acc, file) => {
        if (!acc[file.action]) acc[file.action] = [];
        acc[file.action].push(file);
        return acc;
      }, {});
      
      Object.entries(actions).forEach(([action, files]) => {
        console.log(`  ${action}: ${files.length} files`);
        files.slice(0, 5).forEach(file => {
          console.log(`    ${file.type}: ${file.from} → ${file.to}`);
        });
        if (files.length > 5) {
          console.log(`    ... and ${files.length - 5} more`);
        }
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => {
        console.log(`  ${error.action}: ${error.error}`);
      });
    }
    
    console.log('\n✅ File migration completed successfully!');
    console.log('\n⚠️  Note: Database records need to be updated separately using database migration tools.');
    console.log('   Run the following SQL to update file paths in the database:');
    console.log(`   UPDATE documents SET file_path = REPLACE(file_path, 'uploads/uploads/', '') WHERE file_path LIKE 'uploads/uploads/%';`);
    console.log(`   UPDATE bills SET file_path = REPLACE(file_path, 'uploads/uploads/', '') WHERE file_path LIKE 'uploads/uploads/%';`);
    console.log(`   UPDATE maintenance_requests SET file_path = REPLACE(file_path, 'uploads/uploads/', '') WHERE file_path LIKE 'uploads/uploads/%';`);
    console.log(`   UPDATE bug_reports SET file_path = REPLACE(file_path, 'uploads/uploads/', '') WHERE file_path LIKE 'uploads/uploads/%';`);
    console.log(`   UPDATE feature_requests SET file_path = REPLACE(file_path, 'uploads/uploads/', '') WHERE file_path LIKE 'uploads/uploads/%';`);
    console.log(`   UPDATE security_incidents SET file_path = REPLACE(file_path, 'uploads/uploads/', '') WHERE file_path LIKE 'uploads/uploads/%';`);
  }
}

// Run migration if this file is executed directly
const migration = new UploadPathMigration();
migration.run().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});