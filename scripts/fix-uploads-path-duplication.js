#!/usr/bin/env node
/**
 * Fix Uploads Path Duplication Bug
 * 
 * This script migrates files from the duplicated uploads/uploads/ structure
 * to the correct uploads/ structure and updates all database records.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { documents } from '../shared/schemas/documents.js';
import { bills } from '../shared/schemas/financial.js';
import { maintenanceRequests } from '../shared/schemas/operations.js';
import { bugReports, featureRequests } from '../shared/schemas/development.js';
import { securityIncidents } from '../shared/schemas/monitoring.js';
import { eq, like } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class UploadPathMigration {
  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.uploadsDir = path.join(this.projectRoot, 'uploads');
    this.duplicatedDir = path.join(this.uploadsDir, 'uploads');
    
    // Database connection
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/koveo';
    this.sql = postgres(connectionString);
    this.db = drizzle(this.sql);
    
    this.migratedFiles = [];
    this.updatedRecords = [];
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
      
      // 2. Update database records
      await this.updateDatabaseRecords();
      
      // 3. Clean up empty directories
      await this.cleanupEmptyDirectories();
      
      // 4. Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.sql.end();
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
        type
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

  async updateDatabaseRecords() {
    console.log('🗄️  Updating database records...');
    
    const tables = [
      { table: documents, name: 'documents' },
      { table: bills, name: 'bills' },
      { table: maintenanceRequests, name: 'maintenanceRequests' },
      { table: bugReports, name: 'bugReports' },
      { table: featureRequests, name: 'featureRequests' },
      { table: securityIncidents, name: 'securityIncidents' }
    ];
    
    for (const { table, name } of tables) {
      try {
        console.log(`  🔄 Updating ${name}...`);
        
        // Find records with duplicated paths
        const duplicatedRecords = await this.db
          .select()
          .from(table)
          .where(like(table.filePath, 'uploads/uploads/%'));
        
        if (duplicatedRecords.length === 0) {
          console.log(`    ✅ No duplicated paths found in ${name}`);
          continue;
        }
        
        console.log(`    📋 Found ${duplicatedRecords.length} records with duplicated paths in ${name}`);
        
        for (const record of duplicatedRecords) {
          const oldPath = record.filePath;
          const newPath = oldPath.replace(/^uploads\/uploads\//, '');
          
          await this.db
            .update(table)
            .set({ filePath: newPath })
            .where(eq(table.id, record.id));
          
          this.updatedRecords.push({
            table: name,
            id: record.id,
            oldPath,
            newPath
          });
          
          console.log(`    ✅ Updated ${name}[${record.id}]: ${oldPath} → ${newPath}`);
        }
        
      } catch (error) {
        this.errors.push({
          action: 'update_database',
          table: name,
          error: error.message
        });
        console.error(`  ❌ Failed to update ${name}:`, error.message);
      }
    }
    
    console.log(`✅ Database update complete. Updated ${this.updatedRecords.length} records.`);
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
    console.log(`🗄️  Database records updated: ${this.updatedRecords.length}`);
    console.log(`❌ Errors encountered: ${this.errors.length}`);
    
    if (this.migratedFiles.length > 0) {
      console.log('\n📁 Migrated Files:');
      this.migratedFiles.forEach(file => {
        console.log(`  ${file.type}: ${file.from} → ${file.to}`);
      });
    }
    
    if (this.updatedRecords.length > 0) {
      console.log('\n🗄️  Updated Database Records:');
      const recordsByTable = this.updatedRecords.reduce((acc, record) => {
        if (!acc[record.table]) acc[record.table] = 0;
        acc[record.table]++;
        return acc;
      }, {});
      
      Object.entries(recordsByTable).forEach(([table, count]) => {
        console.log(`  ${table}: ${count} records`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => {
        console.log(`  ${error.action}: ${error.error}`);
      });
    }
    
    console.log('\n✅ Migration completed successfully!');
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new UploadPathMigration();
  migration.run().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { UploadPathMigration };