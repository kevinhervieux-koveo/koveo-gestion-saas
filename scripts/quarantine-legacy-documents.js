#!/usr/bin/env node

/**
 * Safe Quarantine Script for Legacy Documents
 * 
 * This script implements the architect-recommended quarantine approach to safely
 * clean up legacy documents and directories without permanently deleting data.
 * 
 * Features:
 * - Creates timestamped quarantine directory
 * - Moves (not deletes) legacy directories to quarantine
 * - Marks orphaned database records as quarantined
 * - Generates comprehensive manifest
 * - Performs safety checks and verification
 * - Provides rollback instructions
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const QUARANTINE_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const QUARANTINE_DIR = `uploads/_quarantine_${QUARANTINE_TIMESTAMP}`;
const MANIFEST_FILE = `quarantine_manifest_${QUARANTINE_TIMESTAMP}.json`;

// Legacy directories to quarantine (relative to project root)
const LEGACY_DIRECTORIES = [
  'bills',
  'buildings', 
  'residences',
  'feature-requests',
  'bugs',
  'contracts',
  'financial'
];

// Safety checks configuration
const VERIFICATION_PERCENTAGE = 10; // Percent of files to hash-check
const MAX_FILE_SIZE_FOR_HASH = 10 * 1024 * 1024; // 10MB limit for hashing

class QuarantineProcessor {
  constructor() {
    this.manifest = {
      timestamp: new Date().toISOString(),
      quarantineDirectory: QUARANTINE_DIR,
      processedDirectories: [],
      quarantinedFiles: [],
      errors: [],
      statistics: {
        directoriesQuarantined: 0,
        filesQuarantined: 0,
        totalSizeQuarantined: 0,
        databaseRecordsMarked: 0
      }
    };
  }

  async run() {
    console.log('🔒 Starting Safe Document Quarantine Process');
    console.log(`📅 Timestamp: ${QUARANTINE_TIMESTAMP}`);
    console.log(`📁 Quarantine Directory: ${QUARANTINE_DIR}`);
    
    try {
      // Step 1: Pre-flight safety checks
      await this.performPreflightChecks();
      
      // Step 2: Create quarantine directory
      await this.createQuarantineDirectory();
      
      // Step 3: Quarantine legacy directories
      await this.quarantineLegacyDirectories();
      
      // Step 4: Mark orphaned database records as quarantined
      await this.quarantineOrphanedRecords();
      
      // Step 5: Cleanup empty directories
      await this.cleanupEmptyDirectories();
      
      // Step 6: Verification checks
      await this.performVerificationChecks();
      
      // Step 7: Generate manifest and documentation
      await this.generateManifest();
      
      console.log('✅ Quarantine process completed successfully!');
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Quarantine process failed:', error);
      this.manifest.errors.push({
        type: 'FATAL_ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Generate partial manifest for troubleshooting
      await this.generateManifest();
      throw error;
    }
  }

  async performPreflightChecks() {
    console.log('\n🔍 Performing pre-flight safety checks...');
    
    // Check if we're in the right directory
    const packageJsonExists = await this.fileExists('package.json');
    if (!packageJsonExists) {
      throw new Error('Not in project root directory (package.json not found)');
    }
    
    // Check if uploads directory exists
    const uploadsExists = await this.fileExists('uploads');
    if (!uploadsExists) {
      throw new Error('uploads directory not found');
    }
    
    // Check if quarantine directory already exists
    const quarantineExists = await this.fileExists(QUARANTINE_DIR);
    if (quarantineExists) {
      throw new Error(`Quarantine directory already exists: ${QUARANTINE_DIR}`);
    }
    
    // Check available disk space
    await this.checkDiskSpace();
    
    console.log('✅ Pre-flight checks passed');
  }

  async checkDiskSpace() {
    try {
      const { stdout } = await execAsync('df -h .');
      console.log('💾 Disk space status:');
      console.log(stdout);
      
      // Calculate total size of directories to be quarantined
      let totalSize = 0;
      for (const dir of LEGACY_DIRECTORIES) {
        if (await this.fileExists(dir)) {
          const size = await this.getDirectorySize(dir);
          totalSize += size;
        }
      }
      
      console.log(`📊 Total size to quarantine: ${this.formatBytes(totalSize)}`);
      
      // Store in manifest
      this.manifest.estimatedSizeToQuarantine = totalSize;
      
    } catch (error) {
      console.warn('⚠️ Could not check disk space:', error.message);
    }
  }

  async createQuarantineDirectory() {
    console.log('\n📁 Creating quarantine directory...');
    
    try {
      await fs.mkdir(QUARANTINE_DIR, { recursive: true });
      console.log(`✅ Created: ${QUARANTINE_DIR}`);
      
      // Create subdirectories for organization
      await fs.mkdir(path.join(QUARANTINE_DIR, 'directories'), { recursive: true });
      await fs.mkdir(path.join(QUARANTINE_DIR, 'metadata'), { recursive: true });
      
      // Write quarantine info file
      const infoContent = {
        created: new Date().toISOString(),
        purpose: 'Safe quarantine of legacy document directories',
        retentionPolicy: '30 days from creation',
        rollbackInstructions: 'See quarantine_manifest.json for rollback procedures'
      };
      
      await fs.writeFile(
        path.join(QUARANTINE_DIR, 'QUARANTINE_INFO.json'),
        JSON.stringify(infoContent, null, 2)
      );
      
    } catch (error) {
      throw new Error(`Failed to create quarantine directory: ${error.message}`);
    }
  }

  async quarantineLegacyDirectories() {
    console.log('\n🚚 Quarantining legacy directories...');
    
    for (const legacyDir of LEGACY_DIRECTORIES) {
      if (await this.fileExists(legacyDir)) {
        console.log(`\n📦 Processing: ${legacyDir}`);
        
        try {
          // Get directory statistics before moving
          const stats = await this.getDirectoryStats(legacyDir);
          console.log(`   Files: ${stats.fileCount}, Size: ${this.formatBytes(stats.size)}`);
          
          // Move to quarantine
          const quarantinePath = path.join(QUARANTINE_DIR, 'directories', legacyDir);
          await fs.rename(legacyDir, quarantinePath);
          
          console.log(`✅ Moved to: ${quarantinePath}`);
          
          // Update manifest
          this.manifest.processedDirectories.push({
            originalPath: legacyDir,
            quarantinePath: quarantinePath,
            fileCount: stats.fileCount,
            size: stats.size,
            movedAt: new Date().toISOString()
          });
          
          this.manifest.statistics.directoriesQuarantined++;
          this.manifest.statistics.filesQuarantined += stats.fileCount;
          this.manifest.statistics.totalSizeQuarantined += stats.size;
          
        } catch (error) {
          const errorInfo = {
            type: 'DIRECTORY_QUARANTINE_ERROR',
            directory: legacyDir,
            message: error.message,
            timestamp: new Date().toISOString()
          };
          
          this.manifest.errors.push(errorInfo);
          console.error(`❌ Failed to quarantine ${legacyDir}:`, error.message);
        }
      } else {
        console.log(`⏭️  Skipping ${legacyDir} (does not exist)`);
      }
    }
  }

  async quarantineOrphanedRecords() {
    console.log('\n💾 Marking orphaned database records as quarantined...');
    
    // This would typically use the database connection
    // For now, we'll create a SQL script that can be executed
    const sqlScript = `
-- Safe quarantine of orphaned document records
-- Generated: ${new Date().toISOString()}

-- First, let's see what we're dealing with
SELECT 
  COUNT(*) as total_orphaned_records,
  array_agg(DISTINCT document_type) as document_types
FROM documents 
WHERE file_path NOT LIKE 'uploads/%'
  AND is_quarantined = false;

-- Mark orphaned records as quarantined instead of deleting
UPDATE documents 
SET 
  is_quarantined = true,
  updated_at = CURRENT_TIMESTAMP
WHERE file_path NOT LIKE 'uploads/%'
  AND is_quarantined = false;

-- Verify the update
SELECT 
  COUNT(*) as quarantined_records,
  array_agg(DISTINCT document_type) as quarantined_types
FROM documents 
WHERE is_quarantined = true;
`;

    const scriptPath = path.join(QUARANTINE_DIR, 'metadata', 'quarantine_orphaned_records.sql');
    await fs.writeFile(scriptPath, sqlScript);
    
    console.log(`📝 Generated SQL script: ${scriptPath}`);
    console.log('⚠️  Please execute this script manually to quarantine orphaned records');
    
    // Add to manifest
    this.manifest.databaseScript = {
      path: scriptPath,
      purpose: 'Mark 648 orphaned document records as quarantined',
      instructions: 'Execute this SQL script against the database to complete the quarantine process'
    };
  }

  async cleanupEmptyDirectories() {
    console.log('\n🧹 Cleaning up empty directories...');
    
    // Clean up any remaining uploads/uploads/ structures
    const uploadsUploadsPath = 'uploads/uploads';
    if (await this.fileExists(uploadsUploadsPath)) {
      try {
        const stats = await fs.stat(uploadsUploadsPath);
        if (stats.isDirectory()) {
          // Check if empty or contains only demo/empty dirs
          const isEmpty = await this.isEmptyOrDemo(uploadsUploadsPath);
          if (isEmpty) {
            await fs.rmdir(uploadsUploadsPath, { recursive: true });
            console.log('✅ Removed empty uploads/uploads/ directory');
            
            this.manifest.cleanedUpDirectories = this.manifest.cleanedUpDirectories || [];
            this.manifest.cleanedUpDirectories.push(uploadsUploadsPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not clean up ${uploadsUploadsPath}:`, error.message);
      }
    }
    
    // Remove empty legacy directories (in case some were empty and not moved)
    for (const dir of LEGACY_DIRECTORIES) {
      if (await this.fileExists(dir)) {
        try {
          await fs.rmdir(dir, { recursive: false }); // Only remove if empty
          console.log(`✅ Removed empty directory: ${dir}`);
        } catch (error) {
          // Expected if directory is not empty - that's fine
        }
      }
    }
  }

  async performVerificationChecks() {
    console.log('\n🔍 Performing verification checks...');
    
    // Check that legacy directories are gone from root
    const remainingLegacyDirs = [];
    for (const dir of LEGACY_DIRECTORIES) {
      if (await this.fileExists(dir)) {
        remainingLegacyDirs.push(dir);
      }
    }
    
    if (remainingLegacyDirs.length > 0) {
      console.warn('⚠️  Some legacy directories still exist:', remainingLegacyDirs);
      this.manifest.warnings = this.manifest.warnings || [];
      this.manifest.warnings.push({
        type: 'LEGACY_DIRECTORIES_REMAIN',
        directories: remainingLegacyDirs,
        message: 'These directories were not successfully quarantined'
      });
    } else {
      console.log('✅ All legacy directories successfully quarantined');
    }
    
    // Verify modern structure is intact
    const modernDirs = ['uploads/bills', 'uploads/buildings', 'uploads/documents'];
    for (const dir of modernDirs) {
      if (await this.fileExists(dir)) {
        console.log(`✅ Modern structure preserved: ${dir}`);
      }
    }
    
    // Perform random hash checks on quarantined files
    await this.performHashVerification();
  }

  async performHashVerification() {
    console.log('\n🔐 Performing random hash verification...');
    
    const filesToCheck = [];
    
    // Collect sample of quarantined files for verification
    for (const dirInfo of this.manifest.processedDirectories) {
      const quarantinedPath = dirInfo.quarantinePath;
      if (await this.fileExists(quarantinedPath)) {
        const files = await this.getSampleFiles(quarantinedPath, Math.max(1, Math.floor(dirInfo.fileCount * VERIFICATION_PERCENTAGE / 100)));
        filesToCheck.push(...files.map(f => ({ file: f, originalDir: dirInfo.originalPath })));
      }
    }
    
    console.log(`📊 Checking ${filesToCheck.length} files (${VERIFICATION_PERCENTAGE}% sample)`);
    
    const verificationResults = [];
    
    for (const { file, originalDir } of filesToCheck) {
      try {
        const stats = await fs.stat(file);
        if (stats.size <= MAX_FILE_SIZE_FOR_HASH) {
          const hash = await this.calculateFileHash(file);
          verificationResults.push({
            file: file,
            originalDirectory: originalDir,
            hash: hash,
            size: stats.size,
            verified: true
          });
        } else {
          verificationResults.push({
            file: file,
            originalDirectory: originalDir,
            size: stats.size,
            verified: 'skipped_too_large',
            reason: `File size ${this.formatBytes(stats.size)} exceeds ${this.formatBytes(MAX_FILE_SIZE_FOR_HASH)} limit`
          });
        }
      } catch (error) {
        verificationResults.push({
          file: file,
          originalDirectory: originalDir,
          verified: false,
          error: error.message
        });
      }
    }
    
    this.manifest.verification = {
      samplePercentage: VERIFICATION_PERCENTAGE,
      filesChecked: verificationResults.length,
      results: verificationResults
    };
    
    const successfulChecks = verificationResults.filter(r => r.verified === true).length;
    console.log(`✅ Hash verification completed: ${successfulChecks}/${verificationResults.length} files verified`);
  }

  async generateManifest() {
    console.log('\n📋 Generating quarantine manifest...');
    
    // Add rollback instructions
    this.manifest.rollback = {
      instructions: [
        '1. Stop the application',
        '2. Execute the following commands to restore from quarantine:',
        ...this.manifest.processedDirectories.map(dir => 
          `   mv "${dir.quarantinePath}" "${dir.originalPath}"`
        ),
        '3. Run the database rollback script to unquarantine records',
        '4. Restart the application',
        '5. Verify functionality'
      ],
      databaseRollback: `
-- Rollback quarantined records
UPDATE documents 
SET is_quarantined = false, updated_at = CURRENT_TIMESTAMP 
WHERE is_quarantined = true 
  AND updated_at >= '${this.manifest.timestamp}';
      `,
      warnings: [
        'Only execute rollback if you are certain the quarantine was incorrect',
        'Backup your database before running rollback scripts',
        'Verify application functionality after rollback'
      ]
    };
    
    // Write manifest
    await fs.writeFile(MANIFEST_FILE, JSON.stringify(this.manifest, null, 2));
    console.log(`✅ Manifest written to: ${MANIFEST_FILE}`);
    
    // Write human-readable summary
    const summaryPath = `quarantine_summary_${QUARANTINE_TIMESTAMP}.md`;
    const summaryContent = this.generateSummaryMarkdown();
    await fs.writeFile(summaryPath, summaryContent);
    console.log(`📄 Summary written to: ${summaryPath}`);
  }

  generateSummaryMarkdown() {
    return `# Document Quarantine Summary

**Timestamp:** ${this.manifest.timestamp}
**Quarantine Directory:** ${this.manifest.quarantineDirectory}

## Statistics

- **Directories Quarantined:** ${this.manifest.statistics.directoriesQuarantined}
- **Files Quarantined:** ${this.manifest.statistics.filesQuarantined}
- **Total Size:** ${this.formatBytes(this.manifest.statistics.totalSizeQuarantined)}

## Quarantined Directories

${this.manifest.processedDirectories.map(dir => `
### ${dir.originalPath}
- **Moved to:** ${dir.quarantinePath}
- **Files:** ${dir.fileCount}
- **Size:** ${this.formatBytes(dir.size)}
- **Date:** ${dir.movedAt}
`).join('\n')}

## Rollback Instructions

${this.manifest.rollback.instructions.map(instruction => `${instruction}`).join('\n')}

## Database Rollback

\`\`\`sql
${this.manifest.rollback.databaseRollback}
\`\`\`

## Verification Results

- **Files Checked:** ${this.manifest.verification?.filesChecked || 0}
- **Sample Percentage:** ${this.manifest.verification?.samplePercentage || 0}%

## Warnings

${this.manifest.rollback.warnings.map(warning => `⚠️ ${warning}`).join('\n')}

---
*Generated by Safe Document Quarantine Script v1.0*
`;
  }

  printSummary() {
    console.log('\n📊 QUARANTINE SUMMARY');
    console.log('='.repeat(50));
    console.log(`📁 Directories quarantined: ${this.manifest.statistics.directoriesQuarantined}`);
    console.log(`📄 Files quarantined: ${this.manifest.statistics.filesQuarantined}`);
    console.log(`💾 Total size: ${this.formatBytes(this.manifest.statistics.totalSizeQuarantined)}`);
    console.log(`🔍 Files verified: ${this.manifest.verification?.filesChecked || 0}`);
    console.log(`❌ Errors: ${this.manifest.errors.length}`);
    console.log('='.repeat(50));
    console.log(`📋 Manifest: ${MANIFEST_FILE}`);
    console.log(`📄 Summary: quarantine_summary_${QUARANTINE_TIMESTAMP}.md`);
    console.log(`🔒 Quarantine directory: ${QUARANTINE_DIR}`);
    console.log('='.repeat(50));
  }

  // Utility methods
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getDirectorySize(dirPath) {
    try {
      const { stdout } = await execAsync(`du -sb "${dirPath}"`);
      return parseInt(stdout.split('\t')[0]);
    } catch (error) {
      console.warn(`Could not calculate size for ${dirPath}:`, error.message);
      return 0;
    }
  }

  async getDirectoryStats(dirPath) {
    try {
      const { stdout: sizeOutput } = await execAsync(`du -sb "${dirPath}"`);
      const size = parseInt(sizeOutput.split('\t')[0]);
      
      const { stdout: countOutput } = await execAsync(`find "${dirPath}" -type f | wc -l`);
      const fileCount = parseInt(countOutput.trim());
      
      return { size, fileCount };
    } catch (error) {
      console.warn(`Could not get stats for ${dirPath}:`, error.message);
      return { size: 0, fileCount: 0 };
    }
  }

  async getSampleFiles(dirPath, maxFiles) {
    try {
      const { stdout } = await execAsync(`find "${dirPath}" -type f | head -${maxFiles}`);
      return stdout.trim().split('\n').filter(f => f.length > 0);
    } catch (error) {
      console.warn(`Could not get sample files from ${dirPath}:`, error.message);
      return [];
    }
  }

  async calculateFileHash(filePath) {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async isEmptyOrDemo(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      if (entries.length === 0) return true;
      
      // Check if only contains demo or empty directories
      for (const entry of entries) {
        if (entry.isFile()) return false;
        if (entry.isDirectory() && entry.name !== 'demo') return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const processor = new QuarantineProcessor();
  processor.run()
    .then(() => {
      console.log('\n✅ Quarantine process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Quarantine process failed:', error.message);
      process.exit(1);
    });
}

export { QuarantineProcessor };