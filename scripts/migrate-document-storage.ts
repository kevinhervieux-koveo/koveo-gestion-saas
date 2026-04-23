#!/usr/bin/env tsx

/**
 * Document Storage Reorganization Script
 * 
 * Migrates all documents from legacy flat structure to modern hierarchical structure.
 * Fixes type namespace issues and role handling for complete storage reorganization.
 */

import fs from 'fs/promises';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { generateStorageDirectory, mapLegacyDocumentType, type UploadContext } from '../shared/config/upload-config.js';

// Database connection
const sql = neon(process.env.DATABASE_URL!);

interface LegacyDocument {
  id: string;
  name: string;
  document_type: string;
  file_path: string;
  building_id?: string;
  residence_id?: string;
  uploaded_by_id: string;
  organization_id?: string; // Will be resolved from building/residence
}

interface MigrationResult {
  success: boolean;
  documentId: string;
  oldPath: string;
  newPath?: string;
  error?: string;
  action: 'migrated' | 'skipped' | 'error';
}

class DocumentStorageMigrator {
  private baseUploadDir: string;
  private migrationResults: MigrationResult[] = [];
  private dryRun: boolean;

  constructor(dryRun = false) {
    this.baseUploadDir = path.join(process.cwd(), 'uploads');
    this.dryRun = dryRun;
  }

  /**
   * Main migration function
   */
  async migrate(): Promise<void> {
    console.log('🚀 Starting document storage reorganization...');
    console.log(`📁 Base upload directory: ${this.baseUploadDir}`);
    console.log(`🔧 Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    
    try {
      // Step 1: Fix existing migrated documents with wrong types
      await this.fixMigratedDocumentTypes();

      // Step 2: Get all legacy documents that need migration
      const legacyDocuments = await this.getLegacyDocuments();
      console.log(`📋 Found ${legacyDocuments.length} documents to migrate`);

      if (legacyDocuments.length === 0) {
        console.log('✅ No documents need migration!');
        return;
      }

      // Step 3: Resolve organization IDs for all documents
      const documentsWithOrgs = await this.resolveOrganizations(legacyDocuments);
      console.log(`🏢 Resolved organizations for ${documentsWithOrgs.length} documents`);

      // Step 4: Migrate each document
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const doc of documentsWithOrgs) {
        try {
          const result = await this.migrateDocument(doc);
          this.migrationResults.push(result);
          
          if (result.success) {
            if (result.action === 'migrated') {
              successCount++;
              console.log(`✅ ${successCount}/${documentsWithOrgs.length}: Migrated ${doc.name}`);
            } else {
              skippedCount++;
              console.log(`⏭️  ${skippedCount}: Skipped ${doc.name} - ${result.error}`);
            }
          } else {
            errorCount++;
            console.log(`❌ ${errorCount}: ${doc.name} - ${result.error}`);
          }
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          this.migrationResults.push({
            success: false,
            documentId: doc.id,
            oldPath: doc.file_path,
            error: errorMsg,
            action: 'error'
          });
          console.log(`❌ ${errorCount}: ${doc.name} - ${errorMsg}`);
        }
      }

      // Step 5: Generate migration report
      await this.generateReport();

      console.log('\n📊 Migration Summary:');
      console.log(`✅ Successfully migrated: ${successCount}`);
      console.log(`⏭️  Skipped (already modern): ${skippedCount}`);
      console.log(`❌ Failed: ${errorCount}`);
      console.log(`📋 Total: ${documentsWithOrgs.length}`);

      if (!this.dryRun && successCount > 0) {
        console.log('\n🧹 Cleaning up empty legacy directories...');
        await this.cleanupLegacyDirectories();
      }

      // Step 6: Final verification
      await this.verifyMigration();

    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    }
  }

  /**
   * Fix existing migrated documents that use unsupported types
   */
  private async fixMigratedDocumentTypes(): Promise<void> {
    console.log('🔧 Fixing document types in already migrated documents...');
    
    const problematicTypes = ['contracts', 'financial'];
    
    for (const badType of problematicTypes) {
      const docs = await sql`
        SELECT id, file_path, document_type 
        FROM documents 
        WHERE file_path LIKE ${'uploads/' + badType + '/%'}
      `;
      
      for (const doc of docs) {
        const newPath = doc.file_path.replace(`uploads/${badType}/`, 'uploads/documents/');
        
        if (!this.dryRun) {
          // Update database to use documents type and new path
          await sql`UPDATE documents SET file_path = ${newPath} WHERE id = ${doc.id}`;
          
          // Move physical file if it exists
          const oldFullPath = path.join(this.baseUploadDir, doc.file_path);
          const newFullPath = path.join(this.baseUploadDir, newPath);
          
          try {
            if (await this.fileExists(oldFullPath)) {
              await fs.mkdir(path.dirname(newFullPath), { recursive: true });
              await fs.rename(oldFullPath, newFullPath);
              console.log(`🔄 Fixed type mapping: ${badType} -> documents for ${doc.id}`);
            }
          } catch (error) {
            console.log(`⚠️  Could not move file for ${doc.id}:`, error);
          }
        } else {
          console.log(`🔄 Would fix type mapping: ${badType} -> documents for ${doc.id}`);
        }
      }
    }
  }

  /**
   * Get all documents that need migration (not in modern structure)
   */
  private async getLegacyDocuments(): Promise<LegacyDocument[]> {
    const result = await sql`
      SELECT 
        d.id,
        d.name,
        d.document_type,
        d.file_path,
        d.building_id,
        d.residence_id,
        d.uploaded_by_id
      FROM documents d
      WHERE d.file_path NOT LIKE 'uploads/%/org_%'
      ORDER BY d.created_at ASC
    `;
    return result as LegacyDocument[];
  }

  /**
   * Resolve organization IDs for documents based on building/residence associations
   */
  private async resolveOrganizations(documents: LegacyDocument[]): Promise<LegacyDocument[]> {
    const documentsWithOrgs: LegacyDocument[] = [];

    for (const doc of documents) {
      let organizationId: string | undefined;

      // Try to get organization from building
      if (doc.building_id) {
        const buildingResult = await sql`
          SELECT organization_id 
          FROM buildings 
          WHERE id = ${doc.building_id}
        `;
        if (buildingResult.length > 0) {
          organizationId = buildingResult[0].organization_id;
        }
      }

      // Try to get organization from residence if not found via building
      if (!organizationId && doc.residence_id) {
        const residenceResult = await sql`
          SELECT b.organization_id
          FROM residences r
          JOIN buildings b ON r.building_id = b.id
          WHERE r.id = ${doc.residence_id}
        `;
        if (residenceResult.length > 0) {
          organizationId = residenceResult[0].organization_id;
        }
      }

      // Default to Demo organization if no organization found
      if (!organizationId) {
        organizationId = 'da67894c-fbbe-4f0f-b686-ee1d1cb13891'; // Demo organization
      }

      documentsWithOrgs.push({
        ...doc,
        organization_id: organizationId
      });
    }

    return documentsWithOrgs;
  }

  /**
   * Migrate a single document to modern structure
   */
  private async migrateDocument(doc: LegacyDocument): Promise<MigrationResult> {
    try {
      // Check if file is already in modern structure (but somehow missed by query)
      if (doc.file_path.includes('/org_')) {
        return {
          success: true,
          documentId: doc.id,
          oldPath: doc.file_path,
          newPath: doc.file_path,
          action: 'skipped'
        };
      }

      // Map legacy document type to allowed type
      const mappedType = mapLegacyDocumentType(doc.document_type);

      // Generate upload context for modern directory structure
      const context: UploadContext = {
        type: mappedType,
        organizationId: doc.organization_id!,
        buildingId: doc.building_id,
        residenceId: doc.residence_id,
        userRole: 'demo_manager', // Use demo_manager as default role for migration
        userId: doc.uploaded_by_id
      };

      // Generate modern directory path
      const modernDir = generateStorageDirectory(context);
      
      // Determine filename from current path
      const oldFilePath = path.join(this.baseUploadDir, doc.file_path);
      const fileName = path.basename(doc.file_path);
      const newFilePath = path.join(this.baseUploadDir, modernDir, fileName);
      const newRelativePath = path.join(modernDir, fileName).replace(/\\\\/g, '/'); // Ensure POSIX

      // Check if source file exists
      if (!(await this.fileExists(oldFilePath))) {
        return {
          success: false,
          documentId: doc.id,
          oldPath: doc.file_path,
          error: 'Source file does not exist',
          action: 'error'
        };
      }

      // Check if target file already exists (avoid overwrite)
      if (await this.fileExists(newFilePath)) {
        // Generate unique filename if target exists
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const timestamp = Date.now();
        const uniqueFileName = `${baseName}-migrated-${timestamp}${ext}`;
        const uniqueNewFilePath = path.join(this.baseUploadDir, modernDir, uniqueFileName);
        const uniqueNewRelativePath = path.join(modernDir, uniqueFileName).replace(/\\\\/g, '/');

        return await this.performMigration(doc, oldFilePath, uniqueNewFilePath, uniqueNewRelativePath);
      }

      return await this.performMigration(doc, oldFilePath, newFilePath, newRelativePath);

    } catch (error) {
      return {
        success: false,
        documentId: doc.id,
        oldPath: doc.file_path,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'error'
      };
    }
  }

  /**
   * Perform the actual file move and database update
   */
  private async performMigration(
    doc: LegacyDocument,
    oldFilePath: string,
    newFilePath: string,
    newRelativePath: string
  ): Promise<MigrationResult> {
    if (!this.dryRun) {
      // Ensure target directory exists
      const targetDir = path.dirname(newFilePath);
      await fs.mkdir(targetDir, { recursive: true });

      // Move the file
      await fs.rename(oldFilePath, newFilePath);

      // Update database record with POSIX path
      await sql`
        UPDATE documents 
        SET 
          file_path = ${newRelativePath},
          updated_at = NOW()
        WHERE id = ${doc.id}
      `;
    }

    return {
      success: true,
      documentId: doc.id,
      oldPath: doc.file_path,
      newPath: newRelativePath,
      action: 'migrated'
    };
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up empty legacy directories
   */
  private async cleanupLegacyDirectories(): Promise<void> {
    const legacyDirs = [
      'bills',
      'buildings', 
      'residences',
      'contracts', // Also clean up the problematic type dirs
      'financial'
    ];

    for (const dir of legacyDirs) {
      const fullPath = path.join(this.baseUploadDir, dir);
      try {
        if (await this.fileExists(fullPath)) {
          await this.cleanupDirectory(fullPath, dir);
        }
      } catch (error) {
        console.log(`⚠️  Could not cleanup ${dir}:`, error);
      }
    }
  }

  /**
   * Recursively clean up a directory if it's empty
   */
  private async cleanupDirectory(dirPath: string, dirName: string): Promise<void> {
    try {
      const contents = await fs.readdir(dirPath);
      
      // First, try to clean up any subdirectories
      for (const item of contents) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await this.cleanupDirectory(itemPath, `${dirName}/${item}`);
        }
      }
      
      // Check if directory is now empty
      const updatedContents = await fs.readdir(dirPath);
      if (updatedContents.length === 0) {
        console.log(`🗑️  Removing empty legacy directory: ${dirName}`);
        await fs.rmdir(dirPath);
      } else {
        console.log(`⚠️  Legacy directory ${dirName} still contains ${updatedContents.length} items`);
      }
    } catch (error) {
      console.log(`⚠️  Could not cleanup directory ${dirName}:`, error);
    }
  }

  /**
   * Verify that migration is complete
   */
  private async verifyMigration(): Promise<void> {
    console.log('\n🔍 Verifying migration completeness...');
    
    // Check for any remaining documents in legacy structure
    const legacyCount = await sql`
      SELECT COUNT(*) as count
      FROM documents 
      WHERE file_path NOT LIKE 'uploads/%/org_%'
    `;
    
    const remaining = legacyCount[0].count;
    
    if (remaining === 0) {
      console.log('✅ VERIFICATION PASSED: All documents are now in modern structure!');
    } else {
      console.log(`❌ VERIFICATION FAILED: ${remaining} documents still in legacy structure`);
      
      // Show examples of remaining legacy documents
      const examples = await sql`
        SELECT file_path, document_type
        FROM documents 
        WHERE file_path NOT LIKE 'uploads/%/org_%'
        LIMIT 5
      `;
      
      console.log('Examples of remaining legacy documents:');
      examples.forEach((doc: any) => {
        console.log(`  - ${doc.file_path} (${doc.document_type})`);
      });
    }
    
    // Check directory structure
    const legacyDirs = ['bills', 'buildings', 'residences', 'contracts', 'financial'];
    for (const dir of legacyDirs) {
      const fullPath = path.join(this.baseUploadDir, dir);
      if (await this.fileExists(fullPath)) {
        console.log(`⚠️  Legacy directory still exists: uploads/${dir}/`);
      }
    }
  }

  /**
   * Generate migration report
   */
  private async generateReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), `storage-migration-report-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      dryRun: this.dryRun,
      totalDocuments: this.migrationResults.length,
      successful: this.migrationResults.filter(r => r.success && r.action === 'migrated').length,
      skipped: this.migrationResults.filter(r => r.success && r.action === 'skipped').length,
      failed: this.migrationResults.filter(r => !r.success).length,
      results: this.migrationResults
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Migration report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode - no actual changes will be made');
  }

  const migrator = new DocumentStorageMigrator(dryRun);
  await migrator.migrate();
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DocumentStorageMigrator };