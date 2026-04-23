/**
 * Batch Document Migration Script
 * 
 * Processes documents in batches to migrate to new hierarchical structure
 */

import fs from 'fs/promises';
import path from 'path';

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
    uploaded_by_id,
    file_path
  } = documentData;
  
  // Extract original filename from current path
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
  if (user_role && ['tenant', 'resident', 'demo_tenant', 'demo_resident'].includes(user_role) && uploaded_by_id) {
    pathSegments.push(`user_${uploaded_by_id}`);
  }
  
  // Combine path with filename
  return path.join(...pathSegments, originalFilename);
}

/**
 * Process a batch of documents from CSV-like data
 */
async function processBatch(documentsData) {
  console.log(`\n📦 Processing batch of ${documentsData.length} documents...`);
  
  for (const doc of documentsData) {
    await migrateDocument(doc);
  }
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
      console.log(`⚠️  Destination file already exists, skipping: ${newPath}`);
      return false; // Skip, don't count as error
    }
    
    // Move the file
    await fs.rename(oldPath, newPath);
    console.log(`✅ Moved: ${path.basename(oldPath)} → ${newPath}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to move ${oldPath} → ${newPath}:`, error.message);
    throw error;
  }
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
      return { document_id, newPath, migrated: false };
    }
    
    console.log(`🔄 Processing: ${document_name} (${document_type})`);
    
    // Move the file
    const fileMoved = await moveFile(file_path, newPath);
    
    if (fileMoved) {
      migrationStats.successfulMigrations++;
      migrationStats.processedTypes.add(document_type);
      
      console.log(`✅ Successfully migrated: ${document_name}`);
      return { document_id, newPath, migrated: true };
    } else {
      migrationStats.skippedDocuments++;
      console.log(`⚠️  Skipped: ${document_name} (file already exists at destination)`);
      return { document_id, newPath, migrated: false };
    }
    
  } catch (error) {
    migrationStats.errors.push({
      document_id,
      document_name,
      file_path,
      error: error.message
    });
    console.error(`❌ Migration failed for ${document_name}:`, error.message);
    return { document_id, newPath: null, migrated: false, error: error.message };
  }
}

/**
 * Parse CSV-like data into objects
 */
function parseDocumentsFromCSV(csvData) {
  // This function will parse the database query results
  const lines = csvData.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || null;
    });
    return obj;
  });
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

export { 
  generateNewPath, 
  migrateDocument, 
  processBatch, 
  printMigrationSummary, 
  migrationStats 
};