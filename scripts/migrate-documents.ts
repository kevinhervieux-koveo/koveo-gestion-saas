#!/usr/bin/env tsx

/**
 * Document Migration Script.
 *
 * This script migrates existing documents from the legacy documents table
 * to the new separate documents_buildings and documents_residents tables.
 *
 * Usage: npm run migrate:documents.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';

// Types for the migration
/**
 *
 */
type LegacyDocument = {
  id: string;
  name: string;
  uploadDate: Date;
  dateReference: Date | null;
  type: string;
  buildings: string; // boolean stored as string
  residence: string; // boolean stored as string
  tenant: string; // boolean stored as string
};

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

/**
 * Determines the migration target for a document based on its boolean flags.
 * @param doc
 */
/**
 * DetermineDocumentTarget function.
 * @param doc
 * @returns Function result.
 */
function determineDocumentTarget(doc: LegacyDocument): 'building' | 'resident' | 'both' | 'skip' {
  const isBuilding = doc.buildings === 'true';
  const isResidence = doc.residence === 'true';
  const isTenant = doc.tenant === 'true';

  if (isBuilding && (isResidence || isTenant)) {
    return 'both'; // Document applies to both building and residents
  } else if (isBuilding) {
    return 'building';
  } else if (isResidence || isTenant) {
    return 'resident';
  } else {
    return 'skip'; // No flags set, skip this document
  }
}

/**
 * Gets building IDs from the database.
 */
/**
 * GetBuildingIds function.
 * @returns Function result.
 */
async function getBuildingIds(): Promise<string[]> {
  const buildings = await db.select({ id: schema.buildings.id }).from(schema.buildings);
  return buildings.map((b) => b.id);
}

/**
 * Gets residence IDs from the database.
 */
/**
 * GetResidenceIds function.
 * @returns Function result.
 */
async function getResidenceIds(): Promise<string[]> {
  const residences = await db.select({ id: schema.residences.id }).from(schema.residences);
  return residences.map((r) => r.id);
}

/**
 * Creates building documents from legacy documents.
 * @param doc
 * @param buildingId
 * @param uploadedBy
 */
/**
 * CreateBuildingDocument function.
 * @param doc
 * @param buildingId
 * @param uploadedBy
 * @returns Function result.
 */
async function createBuildingDocument(doc: LegacyDocument, buildingId: string, uploadedBy: string) {
  return {
    name: doc.name,
    uploadDate: doc.uploadDate,
    dateReference: doc.dateReference,
    type: doc.type,
    buildingId: buildingId,
    fileUrl: null, // Will be populated later if files exist
    fileName: null,
    fileSize: null,
    mimeType: null,
    uploadedBy: uploadedBy,
  };
}

/**
 * Creates resident documents from legacy documents.
 * @param doc
 * @param residenceId
 * @param uploadedBy
 */
/**
 * CreateResidentDocument function.
 * @param doc
 * @param residenceId
 * @param uploadedBy
 * @returns Function result.
 */
async function createResidentDocument(
  doc: LegacyDocument,
  residenceId: string,
  uploadedBy: string
) {
  return {
    name: doc.name,
    uploadDate: doc.uploadDate,
    dateReference: doc.dateReference,
    type: doc.type,
    residenceId: residenceId,
    fileUrl: null, // Will be populated later if files exist
    fileName: null,
    fileSize: null,
    mimeType: null,
    uploadedBy: uploadedBy,
  };
}

/**
 * Main migration function.
 */
/**
 * MigrateDocuments function.
 * @returns Function result.
 */
async function migrateDocuments() {
  console.warn('🚀 Starting document migration...');

  try {
    // Check if legacy documents table exists and has data
    console.warn('📋 Checking for existing documents...');

    let legacyDocuments: LegacyDocument[] = [];
    try {
      // Try to query legacy documents table
      const result = await db.execute(`
        SELECT id, name, upload_date, date_reference, type, buildings, residence, tenant 
        FROM documents
      `);

      legacyDocuments = result.rows.map((row: unknown) => ({
        id: row.id,
        name: row.name,
        uploadDate: new Date(row.upload_date),
        dateReference: row.date_reference ? new Date(row.date_reference) : null,
        type: row.type,
        buildings: String(row.buildings),
        residence: String(row.residence),
        tenant: String(row.tenant),
      }));

      console.warn(`📄 Found ${legacyDocuments.length} legacy documents to migrate`);
    } catch (_error) {
      console.warn('ℹ️  No legacy documents table found or no documents to migrate');
      console.warn('✅ Migration completed - no data to migrate');
      return;
    }

    if (legacyDocuments.length === 0) {
      console.warn('✅ Migration completed - no documents to migrate');
      return;
    }

    // Get available building and residence IDs
    const buildingIds = await getBuildingIds();
    const residenceIds = await getResidenceIds();

    console.warn(`🏢 Found ${buildingIds.length} buildings`);
    console.warn(`🏠 Found ${residenceIds.length} residences`);

    // Use first building/residence as default if available
    const defaultBuildingId = buildingIds[0];
    const defaultResidenceId = residenceIds[0];
    const defaultUploadedBy = 'migration-script'; // Placeholder user ID

    let buildingDocsCreated = 0;
    let residentDocsCreated = 0;
    let skippedDocs = 0;

    // Process each legacy document
    for (const doc of legacyDocuments) {
      const target = determineDocumentTarget(doc);

      console.warn(`📝 Processing document: ${doc.name} (target: ${target})`);

      switch (target) {
        case 'building':
          if (defaultBuildingId) {
            const buildingDoc = await createBuildingDocument(
              doc,
              defaultBuildingId,
              defaultUploadedBy
            );
            await db.insert(schema.documentsBuildings).values(buildingDoc);
            buildingDocsCreated++;
          } else {
            console.warn(`⚠️  Skipping building document ${doc.name} - no buildings available`);
            skippedDocs++;
          }
          break;

        case 'resident':
          if (defaultResidenceId) {
            const residentDoc = await createResidentDocument(
              doc,
              defaultResidenceId,
              defaultUploadedBy
            );
            await db.insert(schema.documentsResidents).values(residentDoc);
            residentDocsCreated++;
          } else {
            console.warn(`⚠️  Skipping resident document ${doc.name} - no residences available`);
            skippedDocs++;
          }
          break;

        case 'both':
          if (defaultBuildingId) {
            const buildingDoc = await createBuildingDocument(
              doc,
              defaultBuildingId,
              defaultUploadedBy
            );
            await db.insert(schema.documentsBuildings).values(buildingDoc);
            buildingDocsCreated++;
          }
          if (defaultResidenceId) {
            const residentDoc = await createResidentDocument(
              doc,
              defaultResidenceId,
              defaultUploadedBy
            );
            await db.insert(schema.documentsResidents).values(residentDoc);
            residentDocsCreated++;
          }
          break;

        case 'skip':
          console.warn(`⏭️  Skipping document ${doc.name} - no target flags set`);
          skippedDocs++;
          break;
      }
    }

    // Summary
    console.warn('\n📊 Migration Summary:');
    console.warn(`   Building documents created: ${buildingDocsCreated}`);
    console.warn(`   Resident documents created: ${residentDocsCreated}`);
    console.warn(`   Documents skipped: ${skippedDocs}`);
    console.warn(`   Total documents processed: ${legacyDocuments.length}`);

    console.warn('\n✅ Document migration completed successfully!');
    console.warn('\n💡 Next steps:');
    console.warn('   1. Verify the migrated documents in the new tables');
    console.warn('   2. Update API endpoints to use new document tables');
    console.warn('   3. Update frontend to work with separate document types');
    console.warn('   4. Test document functionality end-to-end');
    console.warn('   5. Once verified, you can remove the legacy documents table');
  } catch (_error) {
    console.error('❌ Migration failed:', _error);
    throw error;
  }
}

/**
 * Rollback function to undo the migration.
 */
/**
 * RollbackMigration function.
 * @returns Function result.
 */
async function rollbackMigration() {
  console.warn('🔄 Rolling back document migration...');

  try {
    // Clear the new tables
    await db.delete(schema.documentsBuildings);
    await db.delete(schema.documentsResidents);

    console.warn('✅ Migration rollback completed');
  } catch (_error) {
    console.error('❌ Rollback failed:', _error);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--rollback')) {
    rollbackMigration()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    migrateDocuments()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

export { migrateDocuments, rollbackMigration };
