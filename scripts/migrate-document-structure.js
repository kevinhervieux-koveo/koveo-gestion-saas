/**
 * Document Structure Migration Script
 * 
 * Reorganizes all documents in the uploads directory to use the modern hierarchical structure:
 * uploads/{type}/org_{organizationId}/building_{buildingId}/residence_{residenceId}/role_{userRole}/user_{userId}
 */

import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { documents } from '../shared/schema.js';

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

// Migration statistics
let migrationStats = {
  totalDocuments: 0,
  successfulMigrations: 0,
  skippedDocuments: 0,
  errors: [],
  processedTypes: new Set(),
};

/**
 * Generate the new hierarchical path for a document
 */
function generateNewPath(documentData) {
  const {
    document_type,
    organization_id,
    building_id,
    residence_id,
    user_role,
    user_id,
    file_path
  } = documentData;
  
  // Extract original filename
  const originalFilename = path.basename(file_path);
  
  // Build hierarchical path segments
  const pathSegments = ['uploads', document_type];
  
  // Organization level (required)
  const orgId = organization_id || 'default';
  pathSegments.push(`org_${orgId}`);
  
  // Building level (if applicable)
  if (building_id) {
    pathSegments.push(`building_${building_id}`);
  }
  
  // Residence level (if applicable)
  if (residence_id) {
    pathSegments.push(`residence_${residence_id}`);
  }
  
  // Role level (if applicable)
  if (user_role) {
    pathSegments.push(`role_${user_role}`);
  }
  
  // User level for tenant/resident uploads
  if (user_role && ['tenant', 'resident', 'demo_tenant', 'demo_resident'].includes(user_role) && user_id) {
    pathSegments.push(`user_${user_id}`);
  }
  
  // Combine path with filename
  return path.join(...pathSegments, originalFilename);
}

/**
 * Create directory recursively if it doesn't exist
 */
async function ensureDirectoryExists(filePath) {
  const directory = path.dirname(filePath);
  try {
    await fs.mkdir(directory, { recursive: true });
    return true;
  } catch (error) {
    console.error(`Failed to create directory ${directory}:`, error);
    return false;
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Move file from old path to new path
 */
async function moveFile(oldPath, newPath) {
  try {
    // Check if source file exists
    if (!(await fileExists(oldPath))) {
      throw new Error(`Source file does not exist: ${oldPath}`);
    }
    
    // Create destination directory
    const directoryCreated = await ensureDirectoryExists(newPath);
    if (!directoryCreated) {
      throw new Error(`Failed to create destination directory for: ${newPath}`);
    }
    
    // Check if destination file already exists
    if (await fileExists(newPath)) {
      console.log(`Destination file already exists, skipping: ${newPath}`);
      return false; // Skip, don't count as error
    }
    
    // Move the file
    await fs.rename(oldPath, newPath);
    console.log(`✅ Moved: ${oldPath} → ${newPath}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to move ${oldPath} → ${newPath}:`, error.message);
    throw error;
  }
}

/**
 * Update database record with new file path
 */
async function updateDocumentPath(documentId, newPath) {
  try {
    await db
      .update(documents)
      .set({ 
        filePath: newPath,
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId));
    
    return true;
  } catch (error) {
    console.error(`Failed to update database for document ${documentId}:`, error);
    throw error;
  }
}

/**
 * Get all documents that need to be migrated
 */
async function getDocumentsToMigrate() {
  const query = sql`
    SELECT 
        d.id as document_id,
        d.name as document_name,
        d.document_type,
        d.file_path,
        d.uploaded_by_id,
        d.building_id,
        d.residence_id,
        
        -- User information
        u.role as user_role,
        u.first_name,
        u.last_name,
        
        -- Building information (to get organization)
        b.organization_id,
        b.name as building_name,
        
        -- Organization information
        o.name as organization_name,
        o.type as organization_type,
        
        -- Residence information (if applicable)
        r.unit_number,
        
        -- User-Organization relationship (may have different role)
        uo.organization_role as org_role
        
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by_id = u.id
    LEFT JOIN buildings b ON d.building_id = b.id
    LEFT JOIN organizations o ON b.organization_id = o.id
    LEFT JOIN residences r ON d.residence_id = r.id
    LEFT JOIN user_organizations uo ON (u.id = uo.user_id AND o.id = uo.organization_id)

    -- Only get documents that are NOT already in the modern hierarchical structure
    WHERE d.file_path NOT LIKE '%/org_%'

    ORDER BY d.document_type, o.name, b.name, r.unit_number
  `;
  
  const result = await db.execute(query);
  return result.rows;
}

/**
 * Process a single document migration
 */
async function migrateDocument(documentData) {
  const { document_id, file_path, document_name, document_type } = documentData;
  
  try {
    // Generate new path
    const newPath = generateNewPath(documentData);
    
    // Skip if already in correct structure
    if (newPath === file_path) {
      console.log(`📝 Already in correct structure, skipping: ${file_path}`);
      migrationStats.skippedDocuments++;
      return;
    }
    
    console.log(`🔄 Processing: ${document_name} (${document_type})`);
    console.log(`   From: ${file_path}`);
    console.log(`   To:   ${newPath}`);
    
    // Move the file
    const fileMoved = await moveFile(file_path, newPath);
    
    if (fileMoved) {
      // Update database with new path
      await updateDocumentPath(document_id, newPath);
      migrationStats.successfulMigrations++;
      migrationStats.processedTypes.add(document_type);
      
      console.log(`✅ Successfully migrated: ${document_name}`);
    } else {
      migrationStats.skippedDocuments++;
      console.log(`⚠️  Skipped: ${document_name} (file already exists at destination)`);
    }
    
  } catch (error) {
    migrationStats.errors.push({
      document_id,
      document_name,
      file_path,
      error: error.message
    });
    console.error(`❌ Migration failed for ${document_name}:`, error.message);
  }
}

/**
 * Print migration summary
 */
function printMigrationSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total documents processed: ${migrationStats.totalDocuments}`);
  console.log(`Successfully migrated: ${migrationStats.successfulMigrations}`);
  console.log(`Skipped (already exists): ${migrationStats.skippedDocuments}`);
  console.log(`Errors: ${migrationStats.errors.length}`);
  console.log(`Document types processed: ${Array.from(migrationStats.processedTypes).join(', ')}`);
  
  if (migrationStats.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    migrationStats.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.document_name}: ${error.error}`);
    });
  }
  
  console.log('\n✨ Migration completed!');
  console.log('='.repeat(80));
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting document structure migration...\n');
  
  try {
    // Get all documents to migrate
    console.log('📋 Fetching documents to migrate...');
    const documentsToMigrate = await getDocumentsToMigrate();
    migrationStats.totalDocuments = documentsToMigrate.length;
    
    console.log(`Found ${documentsToMigrate.length} documents to migrate\n`);
    
    if (documentsToMigrate.length === 0) {
      console.log('✅ No documents to migrate. All documents are already in the correct structure.');
      return;
    }
    
    // Process each document
    for (let i = 0; i < documentsToMigrate.length; i++) {
      const doc = documentsToMigrate[i];
      console.log(`\n[${i + 1}/${documentsToMigrate.length}] Processing document...`);
      await migrateDocument(doc);
      
      // Add a small delay to prevent overwhelming the file system
      if (i % 50 === 0 && i > 0) {
        console.log('⏸️  Pausing briefly to prevent file system overload...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    printMigrationSummary();
    
  } catch (error) {
    console.error('💥 Migration failed with critical error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log('🎉 Migration process completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Migration process failed:', error);
      process.exit(1);
    });
}

export { runMigration, generateNewPath, getDocumentsToMigrate };