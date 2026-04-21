/**
 * Process First Batch of Document Migration
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
  updateQueries: []
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
      
      // Generate database update query
      const updateQuery = `UPDATE documents SET file_path = '${newPath}', updated_at = NOW() WHERE id = '${document_id}';`;
      migrationStats.updateQueries.push(updateQuery);
      
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
  
  console.log(`\n📝 Database update queries generated: ${migrationStats.updateQueries.length}`);
  
  console.log('\n✨ Migration completed!');
  console.log('='.repeat(80));
}

// Process the first batch
async function processBatch1() {
  console.log('🚀 Starting batch 1 migration...\n');
  
  const batch1Data = `document_id,document_name,document_type,file_path,uploaded_by_id,building_id,residence_id,user_role,first_name,last_name,organization_id,building_name,organization_name,organization_type,unit_number,org_role
8218c572-36cf-4958-bb09-8b6b2771061d,Service Contract-1 - 4647 Meggie Pass Building 2,contracts,buildings/fde56ff5-2ae8-4012-9f14-5b956b35a446/contracts-4647-meggie-pass-building-2-1.txt,f6c45ace-33cf-45f8-8722-174c3f64de8f,fde56ff5-2ae8-4012-9f14-5b956b35a446,,demo_manager,Diamond,Cartwright,da67894c-fbbe-4f0f-b686-ee1d1cb13891,4647 Meggie Pass Building 2,Demo,demo,,
a4df2b4d-a0a9-456a-b266-9074aeaa0025,Service Contract-2 - 4647 Meggie Pass Building 2,contracts,buildings/fde56ff5-2ae8-4012-9f14-5b956b35a446/contracts-4647-meggie-pass-building-2-2.txt,f6c45ace-33cf-45f8-8722-174c3f64de8f,fde56ff5-2ae8-4012-9f14-5b956b35a446,,demo_manager,Diamond,Cartwright,da67894c-fbbe-4f0f-b686-ee1d1cb13891,4647 Meggie Pass Building 2,Demo,demo,,
dba3e82f-23a1-484e-8c2a-13d6830054b8,Service Contract - 4804 Stuart Gateway Building 1,contracts,buildings/c4213bf1-5a5e-41f8-ba23-1cad3c299ebc/contracts-4804-stuart-gateway-building-1.txt,0b1c8dfd-2725-4dab-bd8c-94258e5df023,c4213bf1-5a5e-41f8-ba23-1cad3c299ebc,,demo_manager,Ignatius,Schuster,da67894c-fbbe-4f0f-b686-ee1d1cb13891,4804 Stuart Gateway Building 1,Demo,demo,,
c0cf046d-e49a-4462-b04d-5fc3d9230948,Service Contract-2 - 64671 Green Close Building 4,contracts,buildings/961b2774-7f1e-49e2-8c94-64cc952cf557/contracts-64671-green-close-building-4-2.txt,579317cd-b88f-462d-bcdd-6fa9c9301827,961b2774-7f1e-49e2-8c94-64cc952cf557,,demo_manager,Jessy,O'Kon-Ondricka,da67894c-fbbe-4f0f-b686-ee1d1cb13891,64671 Green Close Building 4,Demo,demo,,
a926b923-de72-47f8-9f57-3d060f106147,Service Contract-1 - 64671 Green Close Building 4,contracts,buildings/961b2774-7f1e-49e2-8c94-64cc952cf557/contracts-64671-green-close-building-4-1.txt,579317cd-b88f-462d-bcdd-6fa9c9301827,961b2774-7f1e-49e2-8c94-64cc952cf557,,demo_manager,Jessy,O'Kon-Ondricka,da67894c-fbbe-4f0f-b686-ee1d1cb13891,64671 Green Close Building 4,Demo,demo,,
c9e005fa-02b4-4804-8822-9e054276833b,Service Contract - 68391 Brent Shoals Building 3,contracts,buildings/7b1486c7-40ce-41ca-9b1d-a7c629f21d19/contracts-68391-brent-shoals-building-3.txt,43a962ec-f805-48de-8248-26b2b72b0565,7b1486c7-40ce-41ca-9b1d-a7c629f21d19,,demo_manager,Drew,Labadie,da67894c-fbbe-4f0f-b686-ee1d1cb13891,68391 Brent Shoals Building 3,Demo,demo,,
eb03d91b-d141-49dc-8462-5e34bfa57e2e,Service Contract-2 - 7393 Abernathy Green Building 5,contracts,buildings/21dcf337-cdbb-40c3-b7c5-619d7341e3ba/contracts-7393-abernathy-green-building-5-2.txt,1f642674-0207-41f3-bda9-c5b8208a4e70,21dcf337-cdbb-40c3-b7c5-619d7341e3ba,,demo_manager,Sylvia,Von,da67894c-fbbe-4f0f-b686-ee1d1cb13891,7393 Abernathy Green Building 5,Demo,demo,,
2bb02ea9-31b9-4297-ad33-571cd7e8108d,Service Contract-1 - 7393 Abernathy Green Building 5,contracts,buildings/21dcf337-cdbb-40c3-b7c5-619d7341e3ba/contracts-7393-abernathy-green-building-5-1.txt,1f642674-0207-41f3-bda9-c5b8208a4e70,21dcf337-cdbb-40c3-b7c5-619d7341e3ba,,demo_manager,Sylvia,Von,da67894c-fbbe-4f0f-b686-ee1d1cb13891,7393 Abernathy Green Building 5,Demo,demo,,
a5f0a709-1ac0-44ea-ae02-6ead674f6f92,Loan Agreement - 4804 Stuart Gateway Building 1,financial,buildings/c4213bf1-5a5e-41f8-ba23-1cad3c299ebc/financial-loan-agreement-2024.txt,0b1c8dfd-2725-4dab-bd8c-94258e5df023,c4213bf1-5a5e-41f8-ba23-1cad3c299ebc,,demo_manager,Ignatius,Schuster,da67894c-fbbe-4f0f-b686-ee1d1cb13891,4804 Stuart Gateway Building 1,Demo,demo,,
79f763aa-d7fe-4b3d-94d7-018e1f3641e1,Bank Statement Q4 - 4804 Stuart Gateway Building 1,financial,buildings/c4213bf1-5a5e-41f8-ba23-1cad3c299ebc/financial-bank-statement-2024.txt,0b1c8dfd-2725-4dab-bd8c-94258e5df023,c4213bf1-5a5e-41f8-ba23-1cad3c299ebc,,demo_manager,Ignatius,Schuster,da67894c-fbbe-4f0f-b686-ee1d1cb13891,4804 Stuart Gateway Building 1,Demo,demo,,`;
  
  const documents = parseDocumentsFromCSV(batch1Data);
  migrationStats.totalDocuments = documents.length;
  
  console.log(`Processing ${documents.length} documents in batch 1...\n`);
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    console.log(`\n[${i + 1}/${documents.length}] Processing document...`);
    await migrateDocument(doc);
  }
  
  printMigrationSummary();
  
  // Write update queries to file
  if (migrationStats.updateQueries.length > 0) {
    const queryContent = migrationStats.updateQueries.join('\n');
    await fs.writeFile('batch1_updates.sql', queryContent);
    console.log('\n📄 Database update queries written to: batch1_updates.sql');
  }
}

// Run the batch processing
processBatch1()
  .then(() => {
    console.log('🎉 Batch 1 migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Batch 1 migration failed:', error);
    process.exit(1);
  });