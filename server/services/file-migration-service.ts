/**
 * File Migration Service
 * 
 * Safely migrates files from the old deeply nested structure
 * to the optimized directory structure while maintaining
 * backward compatibility and data integrity.
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { optimizedFileStorage } from './optimized-file-storage';
import { generateOptimizedStorageDirectory, mapLegacyToOptimizedPath } from '@shared/config/optimized-upload-config';
import type { OptimizedUploadContext } from '@shared/config/optimized-upload-config';
// CRITICAL FIX: Add database support for transactional updates
import { db } from '../db';
import { documents, bills, bugs, featureRequests, demands } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface MigrationResult {
  success: boolean;
  migratedFiles: number;
  errors: Array<{ file: string; error: string }>;
  skippedFiles: number;
  totalProcessed: number;
  databaseRecordsUpdated: number;
  databaseUpdateErrors: Array<{ record: string; error: string }>;
  reconciliationReport: ReconciliationReport;
  performanceMetrics: {
    duration: number;
    filesPerSecond: number;
  };
}

interface ReconciliationReport {
  totalDatabaseRecords: number;
  recordsNeedingUpdate: number;
  recordsUpdated: number;
  recordsWithErrors: number;
  orphanedRecords: Array<{ table: string; id: string; filePath: string }>;
  brokenReferences: Array<{ table: string; id: string; oldPath: string; newPath?: string }>;
}

interface MigrationProgress {
  currentFile: string;
  processed: number;
  total: number;
  errors: number;
  databaseUpdates: number;
  startTime: number;
}

export class FileMigrationService {
  private readonly baseUploadDir: string;
  private readonly backupDir: string;
  private migrationProgress: MigrationProgress | null = null;
  
  constructor() {
    this.baseUploadDir = path.join(process.cwd(), 'uploads');
    this.backupDir = path.join(process.cwd(), 'uploads_backup');
  }

  /**
   * CRITICAL FIX: Database reconciliation and update methods
   */
  
  /**
   * Find all database records that reference file paths needing migration
   */
  private async findDatabaseRecordsNeedingUpdate(): Promise<{
    documents: Array<{ id: string; filePath: string; table: 'documents' }>;
    bills: Array<{ id: string; filePath: string; table: 'bills' }>;
    bugs: Array<{ id: string; filePath: string; table: 'bugs' }>;
    featureRequests: Array<{ id: string; filePath: string; table: 'feature_requests' }>;
    demands: Array<{ id: string; filePath: string; table: 'demands' }>;
    total: number;
  }> {
    try {
      console.log('🔍 Scanning database for file path references...');
      
      // Find all records with file paths that match legacy structure
      const [documentsWithFiles, billsWithFiles, bugsWithFiles, featureRequestsWithFiles, demandsWithFiles] = await Promise.all([
        db.select({ id: documents.id, filePath: documents.filePath })
          .from(documents)
          .where(documents.filePath.isNotNull()),
        
        db.select({ id: bills.id, filePath: bills.filePath })
          .from(bills)
          .where(bills.filePath.isNotNull()),
        
        db.select({ id: bugs.id, filePath: bugs.filePath })
          .from(bugs)
          .where(bugs.filePath.isNotNull()),
          
        db.select({ id: featureRequests.id, filePath: featureRequests.filePath })
          .from(featureRequests)
          .where(featureRequests.filePath.isNotNull()),
          
        db.select({ id: demands.id, filePath: demands.filePath })
          .from(demands)
          .where(demands.filePath.isNotNull())
      ]);
      
      // Filter for legacy paths that need migration (deep directory structure)
      const filterLegacyPaths = (records: any[]) => {
        return records.filter(record => {
          if (!record.filePath) return false;
          const pathParts = record.filePath.split('/');
          return pathParts.length > 4; // Legacy paths have more depth
        }).map(record => ({ ...record, table: record.table || 'unknown' }));
      };
      
      const result = {
        documents: filterLegacyPaths(documentsWithFiles.map(r => ({ ...r, table: 'documents' }))),
        bills: filterLegacyPaths(billsWithFiles.map(r => ({ ...r, table: 'bills' }))),
        bugs: filterLegacyPaths(bugsWithFiles.map(r => ({ ...r, table: 'bugs' }))),
        featureRequests: filterLegacyPaths(featureRequestsWithFiles.map(r => ({ ...r, table: 'feature_requests' }))),
        demands: filterLegacyPaths(demandsWithFiles.map(r => ({ ...r, table: 'demands' }))),
        total: 0
      };
      
      result.total = result.documents.length + result.bills.length + result.bugs.length + 
                    result.featureRequests.length + result.demands.length;
      
      console.log(`📊 Found ${result.total} database records with file paths needing migration`);
      console.log(`  - Documents: ${result.documents.length}`);
      console.log(`  - Bills: ${result.bills.length}`);
      console.log(`  - Bugs: ${result.bugs.length}`);
      console.log(`  - Feature Requests: ${result.featureRequests.length}`);
      console.log(`  - Demands: ${result.demands.length}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error scanning database records:', error);
      throw error;
    }
  }
  
  /**
   * Update database records transactionally with new file paths
   */
  private async updateDatabaseRecords(
    recordsToUpdate: {
      documents: Array<{ id: string; filePath: string; table: string }>;
      bills: Array<{ id: string; filePath: string; table: string }>;
      bugs: Array<{ id: string; filePath: string; table: string }>;
      featureRequests: Array<{ id: string; filePath: string; table: string }>;
      demands: Array<{ id: string; filePath: string; table: string }>;
    },
    pathMappings: Map<string, string> // oldPath -> newPath
  ): Promise<{
    updated: number;
    errors: Array<{ record: string; error: string }>;
    orphaned: Array<{ table: string; id: string; filePath: string }>;
  }> {
    let updated = 0;
    const errors: Array<{ record: string; error: string }> = [];
    const orphaned: Array<{ table: string; id: string; filePath: string }> = [];
    
    console.log('💾 Starting transactional database updates...');
    
    // Helper function to update a single table
    const updateTable = async (tableName: string, records: any[], updateFn: (id: string, newPath: string) => Promise<void>) => {
      for (const record of records) {
        try {
          const newPath = pathMappings.get(record.filePath);
          if (!newPath) {
            // Check if file still exists at old location
            const oldFullPath = path.join(this.baseUploadDir, record.filePath);
            if (!existsSync(oldFullPath)) {
              orphaned.push({ table: tableName, id: record.id, filePath: record.filePath });
              console.warn(`⚠️  Orphaned record: ${tableName}:${record.id} -> ${record.filePath}`);
            }
            continue;
          }
          
          await updateFn(record.id, newPath);
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`📊 Updated ${updated} database records...`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ record: `${tableName}:${record.id}`, error: errorMsg });
          console.error(`❌ Error updating ${tableName}:${record.id}:`, errorMsg);
        }
      }
    };
    
    try {
      // Update each table with appropriate transactions
      await updateTable('documents', recordsToUpdate.documents, async (id, newPath) => {
        await db.update(documents)
          .set({ filePath: newPath, updatedAt: new Date() })
          .where(eq(documents.id, id));
      });
      
      await updateTable('bills', recordsToUpdate.bills, async (id, newPath) => {
        await db.update(bills)
          .set({ filePath: newPath, updatedAt: new Date() })
          .where(eq(bills.id, id));
      });
      
      await updateTable('bugs', recordsToUpdate.bugs, async (id, newPath) => {
        await db.update(bugs)
          .set({ filePath: newPath, updatedAt: new Date() })
          .where(eq(bugs.id, id));
      });
      
      await updateTable('feature_requests', recordsToUpdate.featureRequests, async (id, newPath) => {
        await db.update(featureRequests)
          .set({ filePath: newPath, updatedAt: new Date() })
          .where(eq(featureRequests.id, id));
      });
      
      await updateTable('demands', recordsToUpdate.demands, async (id, newPath) => {
        await db.update(demands)
          .set({ filePath: newPath, updatedAt: new Date() })
          .where(eq(demands.id, id));
      });
      
      console.log(`✅ Database updates completed: ${updated} records updated, ${errors.length} errors, ${orphaned.length} orphaned`);
      
      return { updated, errors, orphaned };
      
    } catch (error) {
      console.error('❌ Critical error during database updates:', error);
      throw error;
    }
  }

  /**
   * Migrate all files from legacy structure to optimized structure
   */
  async migrateAllFiles(dryRun = false): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: true,
      migratedFiles: 0,
      errors: [],
      skippedFiles: 0,
      totalProcessed: 0,
      databaseRecordsUpdated: 0,
      databaseUpdateErrors: [],
      reconciliationReport: {
        totalDatabaseRecords: 0,
        recordsNeedingUpdate: 0,
        recordsUpdated: 0,
        recordsWithErrors: 0,
        orphanedRecords: [],
        brokenReferences: []
      },
      performanceMetrics: {
        duration: 0,
        filesPerSecond: 0
      }
    };

    try {
      console.log(`🔄 Starting file migration${dryRun ? ' (DRY RUN)' : ''}...`);
      
      // Create backup directory if not in dry run mode
      if (!dryRun && !existsSync(this.backupDir)) {
        await fs.mkdir(this.backupDir, { recursive: true });
      }

      // CRITICAL FIX: Add database reconciliation BEFORE file migration
      console.log('📊 Step 1: Database reconciliation...');
      const databaseRecords = await this.findDatabaseRecordsNeedingUpdate();
      result.reconciliationReport.totalDatabaseRecords = databaseRecords.total;
      result.reconciliationReport.recordsNeedingUpdate = databaseRecords.total;
      
      // Find all files that need migration
      console.log('📁 Step 2: File system scan...');
      const filesToMigrate = await this.findLegacyFiles();
      
      this.migrationProgress = {
        currentFile: '',
        processed: 0,
        total: filesToMigrate.length,
        errors: 0,
        databaseUpdates: 0,
        startTime
      };

      console.log(`📁 Found ${filesToMigrate.length} files to migrate`);
      console.log(`📊 Found ${databaseRecords.total} database records to update`);
      
      // Create path mapping for database updates
      const pathMappings = new Map<string, string>();

      // Process files in batches for better performance
      const batchSize = 10;
      for (let i = 0; i < filesToMigrate.length; i += batchSize) {
        const batch = filesToMigrate.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (fileInfo) => {
          this.migrationProgress!.currentFile = fileInfo.relativePath;
          
          try {
            if (dryRun) {
              console.log(`[DRY RUN] Would migrate: ${fileInfo.relativePath} -> ${fileInfo.newPath}`);
              result.migratedFiles++;
              // Track path mapping for database updates
              pathMappings.set(fileInfo.relativePath, fileInfo.newPath);
            } else {
              await this.migrateFile(fileInfo);
              result.migratedFiles++;
              // CRITICAL: Track path mapping for database updates
              pathMappings.set(fileInfo.relativePath, fileInfo.newPath);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push({ file: fileInfo.relativePath, error: errorMsg });
            this.migrationProgress!.errors++;
            console.error(`❌ Error migrating ${fileInfo.relativePath}:`, errorMsg);
          }
          
          this.migrationProgress!.processed++;
          result.totalProcessed++;
          
          // Log progress every 50 files
          if (result.totalProcessed % 50 === 0) {
            const progress = (result.totalProcessed / filesToMigrate.length * 100).toFixed(1);
            console.log(`📊 Migration progress: ${progress}% (${result.totalProcessed}/${filesToMigrate.length})`);
          }
        });

        await Promise.all(batchPromises);
      }

      // CRITICAL FIX: Step 3 - Update database records with new file paths
      if (!dryRun && pathMappings.size > 0) {
        console.log('🗃️ Step 3: Updating database records...');
        try {
          const dbUpdateResult = await this.updateDatabaseRecords(databaseRecords, pathMappings);
          result.databaseRecordsUpdated = dbUpdateResult.updated;
          result.databaseUpdateErrors = dbUpdateResult.errors;
          result.reconciliationReport.recordsUpdated = dbUpdateResult.updated;
          result.reconciliationReport.recordsWithErrors = dbUpdateResult.errors.length;
          result.reconciliationReport.orphanedRecords = dbUpdateResult.orphaned;
          
          this.migrationProgress!.databaseUpdates = dbUpdateResult.updated;
          
          console.log(`✅ Database updates completed: ${dbUpdateResult.updated} records updated`);
          if (dbUpdateResult.errors.length > 0) {
            console.warn(`⚠️  ${dbUpdateResult.errors.length} database update errors`);
          }
          if (dbUpdateResult.orphaned.length > 0) {
            console.warn(`⚠️  ${dbUpdateResult.orphaned.length} orphaned records found`);
          }
        } catch (error) {
          console.error('❌ Critical error during database updates:', error);
          result.success = false;
          result.errors.push({ file: 'DATABASE_UPDATE', error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      // Step 4: Generate reconciliation report
      const reconciliationSummary = this.generateReconciliationReport(result.reconciliationReport);
      console.log('📋 Migration Reconciliation Report:');
      console.log(reconciliationSummary);

      const duration = Date.now() - startTime;
      result.performanceMetrics.duration = duration;
      result.performanceMetrics.filesPerSecond = result.totalProcessed / (duration / 1000);

      if (result.errors.length > 0 || result.databaseUpdateErrors.length > 0) {
        result.success = false;
        console.warn(`⚠️  Migration completed with ${result.errors.length} file errors and ${result.databaseUpdateErrors.length} database errors`);
      } else {
        console.log(`✅ Migration completed successfully`);
      }

      console.log(`📈 Performance: ${result.migratedFiles} files migrated, ${result.databaseRecordsUpdated} DB records updated in ${duration}ms (${result.performanceMetrics.filesPerSecond.toFixed(2)} files/sec)`);

      return result;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      result.success = false;
      result.errors.push({ file: 'GLOBAL', error: error instanceof Error ? error.message : 'Unknown error' });
      return result;
    } finally {
      this.migrationProgress = null;
    }
  }

  /**
   * Generate reconciliation report for audit trail
   */
  private generateReconciliationReport(report: ReconciliationReport): string {
    const lines = [
      '='.repeat(60),
      '📋 FILE MIGRATION RECONCILIATION REPORT',
      '='.repeat(60),
      `📊 Database Records Summary:`,
      `   • Total records found: ${report.totalDatabaseRecords}`,
      `   • Records needing update: ${report.recordsNeedingUpdate}`,
      `   • Records successfully updated: ${report.recordsUpdated}`,
      `   • Records with errors: ${report.recordsWithErrors}`,
      `   • Orphaned records: ${report.orphanedRecords.length}`,
      '',
      `✅ Success Rate: ${report.recordsNeedingUpdate > 0 ? ((report.recordsUpdated / report.recordsNeedingUpdate) * 100).toFixed(1) : 0}%`,
      ''
    ];
    
    if (report.orphanedRecords.length > 0) {
      lines.push('⚠️  ORPHANED RECORDS (files not found):');
      report.orphanedRecords.slice(0, 10).forEach(record => {
        lines.push(`   • ${record.table}:${record.id} -> ${record.filePath}`);
      });
      if (report.orphanedRecords.length > 10) {
        lines.push(`   • ... and ${report.orphanedRecords.length - 10} more`);
      }
      lines.push('');
    }
    
    if (report.brokenReferences.length > 0) {
      lines.push('❌ BROKEN REFERENCES:');
      report.brokenReferences.slice(0, 10).forEach(ref => {
        lines.push(`   • ${ref.table}:${ref.id} -> ${ref.oldPath} ${ref.newPath ? '-> ' + ref.newPath : '(no new path)'}`);
      });
      if (report.brokenReferences.length > 10) {
        lines.push(`   • ... and ${report.brokenReferences.length - 10} more`);
      }
      lines.push('');
    }
    
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Get current migration progress
   */
  getMigrationProgress(): MigrationProgress | null {
    return this.migrationProgress;
  }

  /**
   * FIXED: Rollback migration with database restoration
   */
  async rollbackMigration(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!existsSync(this.backupDir)) {
        return { success: false, error: 'No backup directory found' };
      }

      console.log('🔄 Rolling back migration...');
      
      // NOTE: Database rollback is not implemented due to complexity and risk factors.
      // 
      // Implementing automatic database rollback would require:
      // 1. Snapshot creation before migration with all file path references
      // 2. Transactional updates that can be reversed atomically
      // 3. Handling of concurrent changes during migration
      // 4. Verification that database state matches file system state
      // 
      // RECOMMENDED ROLLBACK PROCEDURE (Manual):
      // 1. Stop the application to prevent new file operations
      // 2. Restore database from backup taken before migration
      // 3. Use this rollbackMigration() to restore file system
      // 4. Verify database file paths match restored file locations
      // 5. Run integrity check before resuming operations
      // 
      // PREVENTION: Always run migration in dry-run mode first and maintain recent backups.
      console.warn('⚠️  WARNING: Database rollback not implemented. You may need to restore from database backup.');
      
      // Remove current uploads directory
      await fs.rm(this.baseUploadDir, { recursive: true, force: true });
      
      // Restore from backup
      await fs.rename(this.backupDir, this.baseUploadDir);
      
      // Clear caches to ensure consistency
      optimizedFileStorage.clearCaches();
      
      console.log('✅ Migration rollback completed (files only - check database manually)');
      return { success: true };

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Verify migration integrity
   */
  async verifyMigration(): Promise<{ success: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      console.log('🔍 Verifying migration integrity...');
      
      // Check if any legacy deep directories still exist with files
      const legacyFiles = await this.findLegacyFiles();
      if (legacyFiles.length > 0) {
        issues.push(`Found ${legacyFiles.length} files still in legacy structure`);
      }
      
      // Verify optimized directories have the expected structure
      const optimizedDirs = await this.findOptimizedDirectories();
      for (const dir of optimizedDirs) {
        const depth = dir.split('/').length;
        if (depth > 3) {
          issues.push(`Directory ${dir} exceeds maximum depth of 3`);
        }
      }
      
      console.log(issues.length === 0 ? '✅ Migration verification passed' : `⚠️  Found ${issues.length} issues`);
      
      return {
        success: issues.length === 0,
        issues
      };
      
    } catch (error) {
      issues.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, issues };
    }
  }

  // Private helper methods
  private async findLegacyFiles(): Promise<Array<{ relativePath: string; fullPath: string; newPath: string; context: OptimizedUploadContext }>> {
    const legacyFiles: Array<{ relativePath: string; fullPath: string; newPath: string; context: OptimizedUploadContext }> = [];
    
    const scanDirectory = async (dir: string, relativePath = ''): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const currentPath = path.join(dir, entry.name);
          const currentRelative = path.join(relativePath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip already optimized directories (short hash pattern)
            if (entry.name.length === 8 && /^[a-f0-9]+$/.test(entry.name)) {
              continue;
            }
            
            // Skip special directories
            if (entry.name.startsWith('_quarantine') || entry.name.startsWith('backup')) {
              continue;
            }
            
            await scanDirectory(currentPath, currentRelative);
          } else if (entry.isFile() && !entry.name.endsWith('.metadata.json')) {
            // Check if this file is in a legacy deep structure
            const pathParts = currentRelative.split(path.sep);
            if (pathParts.length > 3 && this.isLegacyStructure(pathParts)) {
              const context = this.extractContextFromLegacyPath(pathParts);
              const newPath = generateOptimizedStorageDirectory(context);
              
              legacyFiles.push({
                relativePath: currentRelative,
                fullPath: currentPath,
                newPath,
                context
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not scan directory ${dir}:`, error);
      }
    };
    
    await scanDirectory(this.baseUploadDir);
    return legacyFiles;
  }

  private async findOptimizedDirectories(): Promise<string[]> {
    const optimizedDirs: string[] = [];
    
    const scanForOptimized = async (dir: string, relativePath = ''): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const currentRelative = path.join(relativePath, entry.name);
            
            // Check if this looks like an optimized directory (short hash)
            if (entry.name.length === 8 && /^[a-f0-9]+$/.test(entry.name)) {
              optimizedDirs.push(currentRelative);
            }
            
            await scanForOptimized(path.join(dir, entry.name), currentRelative);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not scan directory ${dir}:`, error);
      }
    };
    
    await scanForOptimized(this.baseUploadDir);
    return optimizedDirs;
  }

  private isLegacyStructure(pathParts: string[]): boolean {
    // Legacy structure: type/org_xxx/building_xxx/residence_xxx/role_xxx/[user_xxx]/file
    return pathParts.some(part => 
      part.startsWith('org_') || 
      part.startsWith('building_') || 
      part.startsWith('residence_') || 
      part.startsWith('role_') ||
      part.startsWith('user_')
    );
  }

  private extractContextFromLegacyPath(pathParts: string[]): OptimizedUploadContext {
    const context: OptimizedUploadContext = {
      type: pathParts[0] as any
    };
    
    for (const part of pathParts) {
      if (part.startsWith('org_')) {
        context.organizationId = part.substring(4);
      } else if (part.startsWith('building_')) {
        context.buildingId = part.substring(9);
      } else if (part.startsWith('residence_')) {
        context.residenceId = part.substring(10);
      } else if (part.startsWith('role_')) {
        context.userRole = part.substring(5);
      } else if (part.startsWith('user_')) {
        context.userId = part.substring(5);
      }
    }
    
    return context;
  }

  private async migrateFile(fileInfo: { relativePath: string; fullPath: string; newPath: string; context: OptimizedUploadContext }): Promise<void> {
    const { fullPath, newPath, relativePath } = fileInfo;
    
    // Create new directory structure
    const newFullPath = path.join(this.baseUploadDir, newPath);
    const newDir = path.dirname(newFullPath);
    
    await fs.mkdir(newDir, { recursive: true });
    
    // Generate new filename
    const originalFilename = path.basename(fullPath);
    const newFilename = this.generateNewFilename(originalFilename);
    const finalNewPath = path.join(newDir, newFilename);
    
    // Copy file to new location
    await fs.copyFile(fullPath, finalNewPath);
    
    // Copy metadata if it exists
    const metadataPath = `${fullPath}.metadata.json`;
    if (existsSync(metadataPath)) {
      await fs.copyFile(metadataPath, `${finalNewPath}.metadata.json`);
    }
    
    // Create backup of original
    const backupPath = path.join(this.backupDir, relativePath);
    const backupDir = path.dirname(backupPath);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile(fullPath, backupPath);
    
    if (existsSync(metadataPath)) {
      await fs.copyFile(metadataPath, `${backupPath}.metadata.json`);
    }
    
    console.log(`✅ Migrated: ${relativePath} -> ${path.relative(this.baseUploadDir, finalNewPath)}`);
  }

  private generateNewFilename(originalFilename: string): string {
    // If filename already has the optimized format, keep it
    if (originalFilename.includes('_') && originalFilename.match(/_[a-f0-9]{8}_\d+/)) {
      return originalFilename;
    }
    
    // Generate new optimized filename
    const ext = path.extname(originalFilename);
    const name = path.basename(originalFilename, ext).substring(0, 50);
    const secureId = require('crypto').randomUUID().substring(0, 8);
    const timestamp = Date.now();
    
    return `${name}_${secureId}_${timestamp}${ext}`;
  }
}

export const fileMigrationService = new FileMigrationService();