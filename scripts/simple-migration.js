/**
 * Simple Document Migration Script
 * 
 * Uses direct file system operations and database queries via execute_sql_tool approach
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
    uploaded_by_id
  } = documentData;
  
  // Extract original filename from current path
  const originalFilename = path.basename(documentData.file_path);
  
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
 * Process sample documents to test the migration logic
 */
async function testMigration() {
  console.log('🧪 Testing migration logic with sample documents...\n');
  
  // Sample document data based on our database query results
  const sampleDocuments = [
    {
      document_id: 'test-1',
      document_name: 'Service Contract - Building 1',
      document_type: 'contracts',
      file_path: 'buildings/test-building-id/contracts-test.txt',
      organization_id: 'test-org-id',
      building_id: 'test-building-id',
      residence_id: null,
      user_role: 'demo_manager',
      uploaded_by_id: 'test-user-id'
    },
    {
      document_id: 'test-2',
      document_name: 'Inspection Report - Unit 123',
      document_type: 'inspection',
      file_path: 'residences/test-residence-id/inspection-123.txt',
      organization_id: 'test-org-id',
      building_id: 'test-building-id',
      residence_id: 'test-residence-id',
      user_role: 'demo_manager',
      uploaded_by_id: 'test-user-id'
    }
  ];
  
  sampleDocuments.forEach(doc => {
    const newPath = generateNewPath(doc);
    console.log(`📄 ${doc.document_name}`);
    console.log(`   Current: ${doc.file_path}`);
    console.log(`   New:     ${newPath}`);
    console.log('');
  });
  
  return sampleDocuments;
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
async function runSimpleMigration() {
  console.log('🚀 Starting simple document structure migration...\n');
  
  try {
    // Test the migration logic first
    await testMigration();
    
    console.log('✅ Migration logic test completed successfully!');
    console.log('👉 This script shows how the new paths will be generated.');
    console.log('👉 To run the actual migration, we need to implement database connectivity.');
    
    printMigrationSummary();
    
  } catch (error) {
    console.error('💥 Migration test failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleMigration()
    .then(() => {
      console.log('🎉 Migration test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Migration test failed:', error);
      process.exit(1);
    });
}

export { runSimpleMigration, generateNewPath };