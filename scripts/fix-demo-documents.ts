#!/usr/bin/env tsx

/**
 * Fix Demo Organization Documents
 * Creates proper database records for existing demo documents
 */

import { eq, and } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../shared/schema';

// Database connection
let db: any;

async function initializeDatabase() {
  const { db: sharedDb } = await import('../server/db');
  db = sharedDb;
  console.log('🔗 Connected to DEVELOPMENT database');
}

/**
 * Create document records in database for Demo Organization
 */
async function fixDemoDocuments() {
  try {
    console.log('📄 Fixing Demo Organization documents...');
    
    // Get Demo Organization
    const demoOrg = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.name, 'Demo Organization'))
      .limit(1);
    
    if (demoOrg.length === 0) {
      console.error('❌ Demo Organization not found');
      return;
    }
    
    console.log(`✅ Found Demo Organization: ${demoOrg[0].id}`);
    
    // Get all buildings for Demo Organization
    const buildings = await db
      .select()
      .from(schema.buildings)
      .where(eq(schema.buildings.organizationId, demoOrg[0].id));
    
    console.log(`✅ Found ${buildings.length} buildings`);
    
    // Get all residences for these buildings
    const residences = await db
      .select()
      .from(schema.residences)
      .where(eq(schema.residences.isActive, true));
    
    console.log(`✅ Found ${residences.length} residences`);
    
    // Get all users who can upload documents (managers)
    const managers = await db
      .select()
      .from(schema.users)
      .where(and(
        eq(schema.users.isActive, true),
        eq(schema.users.role, 'demo_manager' as any)
      ));
    
    console.log(`✅ Found ${managers.length} managers`);
    
    // Get all bills for these buildings
    const bills = await db
      .select()
      .from(schema.bills)
      .innerJoin(schema.buildings, eq(schema.bills.buildingId, schema.buildings.id))
      .where(eq(schema.buildings.organizationId, demoOrg[0].id));
    
    console.log(`✅ Found ${bills.length} bills`);
    
    let totalDocuments = 0;
    
    // Create Building Documents
    console.log('🏢 Creating building documents...');
    const buildingDocumentTypes = [
      { type: 'insurance', name: 'Insurance Certificate' },
      { type: 'permits', name: 'Building Permit' },
      { type: 'meeting_minutes', name: 'Board Meeting Minutes' },
      { type: 'contracts', name: 'Service Contract' }
    ];
    
    for (const building of buildings) {
      const manager = managers.find(m => Math.random() > 0.5) || managers[0];
      if (!manager) continue;
      
      for (const docType of buildingDocumentTypes) {
        // Check if documents exist for this building/type combo
        const existingDocs = await db
          .select({ id: schema.documents.id })
          .from(schema.documents)
          .where(and(
            eq(schema.documents.buildingId, building.id),
            eq(schema.documents.documentType, docType.type)
          ));
        
        if (existingDocs.length === 0) {
          // Create 1-2 documents per type
          const docsToCreate = faker.number.int({ min: 1, max: 2 });
          
          for (let i = 0; i < docsToCreate; i++) {
            const suffix = docsToCreate > 1 ? `-${i + 1}` : '';
            const fileName = `${docType.type}-${building.name.replace(/\s+/g, '-').toLowerCase()}${suffix}.txt`;
            const filePath = `buildings/${building.id}/${fileName}`;
            const fullPath = path.join('uploads', filePath);
            
            // Check if file exists, create minimal content if not
            let fileSize = 100;
            if (fs.existsSync(fullPath)) {
              fileSize = fs.statSync(fullPath).size;
            } else {
              // Create minimal file
              const dir = path.dirname(fullPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              const content = `Demo ${docType.name}${suffix}\n\nBuilding: ${building.name}\nCreated: ${new Date().toISOString()}`;
              fs.writeFileSync(fullPath, content);
              fileSize = content.length;
            }
            
            await db
              .insert(schema.documents)
              .values({
                name: `${docType.name}${suffix} - ${building.name}`,
                description: `${docType.name} for ${building.name}`,
                documentType: docType.type,
                filePath,
                fileName,
                fileSize,
                mimeType: 'text/plain',
                isVisibleToTenants: docType.type === 'meeting_minutes',
                buildingId: building.id,
                uploadedById: manager.id
              });
            
            totalDocuments++;
            console.log(`  ✓ Created: ${docType.name}${suffix} for ${building.name}`);
          }
        } else {
          console.log(`  ↳ Skipping ${docType.type} for ${building.name} (already exists)`);
        }
      }
    }
    
    // Create Residence Documents
    console.log('🏠 Creating residence documents...');
    const residenceDocumentTypes = [
      { type: 'lease', name: 'Lease Agreement' },
      { type: 'inspection', name: 'Inspection Report' },
      { type: 'maintenance', name: 'Maintenance Log' }
    ];
    
    const demoResidences = residences.filter(r => 
      buildings.some(b => b.id === r.buildingId)
    );
    
    for (const residence of demoResidences.slice(0, 35)) { // Limit to prevent timeout
      const building = buildings.find(b => b.id === residence.buildingId);
      const manager = managers.find(m => Math.random() > 0.5) || managers[0];
      if (!building || !manager) continue;
      
      for (const docType of residenceDocumentTypes) {
        // Check if documents exist for this residence/type combo
        const existingDocs = await db
          .select({ id: schema.documents.id })
          .from(schema.documents)
          .where(and(
            eq(schema.documents.residenceId, residence.id),
            eq(schema.documents.documentType, docType.type)
          ));
        
        if (existingDocs.length === 0) {
          const docsToCreate = faker.number.int({ min: 1, max: 2 });
          
          for (let i = 0; i < docsToCreate; i++) {
            const suffix = docsToCreate > 1 ? `-${i + 1}` : '';
            const fileName = `${docType.type}-${residence.unitNumber}${suffix}.txt`;
            const filePath = `residences/${residence.id}/${fileName}`;
            const fullPath = path.join('uploads', filePath);
            
            let fileSize = 100;
            if (fs.existsSync(fullPath)) {
              fileSize = fs.statSync(fullPath).size;
            } else {
              // Create minimal file
              const dir = path.dirname(fullPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              const content = `Demo ${docType.name}${suffix}\n\nUnit: ${residence.unitNumber}\nBuilding: ${building.name}\nCreated: ${new Date().toISOString()}`;
              fs.writeFileSync(fullPath, content);
              fileSize = content.length;
            }
            
            await db
              .insert(schema.documents)
              .values({
                name: `${docType.name}${suffix} - Unit ${residence.unitNumber}`,
                description: `${docType.name} for unit ${residence.unitNumber}`,
                documentType: docType.type,
                filePath,
                fileName,
                fileSize,
                mimeType: 'text/plain',
                isVisibleToTenants: docType.type === 'lease',
                residenceId: residence.id,
                buildingId: residence.buildingId,
                uploadedById: manager.id
              });
            
            totalDocuments++;
          }
        }
      }
    }
    
    // Create Bill Documents (attachments)
    console.log('💰 Creating bill attachments...');
    for (const billRecord of bills.slice(0, 100)) { // Limit to prevent timeout
      const bill = billRecord.bills;
      const building = billRecord.buildings;
      const manager = managers.find(m => Math.random() > 0.5) || managers[0];
      if (!manager) continue;
      
      // Check if bill already has documents
      const existingDocs = await db
        .select({ id: schema.documents.id })
        .from(schema.documents)
        .where(and(
          eq(schema.documents.attachedToType, 'bill'),
          eq(schema.documents.attachedToId, bill.id)
        ));
      
      if (existingDocs.length === 0) {
        const isInvoice = Math.random() > 0.5;
        const docType = isInvoice ? 'invoice' : 'receipt';
        const fileName = `${docType}-${bill.billNumber.toLowerCase()}-${bill.id.slice(0, 8)}.txt`;
        const filePath = `bills/${fileName}`;
        const fullPath = path.join('uploads', filePath);
        
        let fileSize = 100;
        if (fs.existsSync(fullPath)) {
          fileSize = fs.statSync(fullPath).size;
        } else {
          // Create minimal file
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const content = `Demo ${isInvoice ? 'Invoice' : 'Receipt'}\n\nBill: ${bill.billNumber}\nTitle: ${bill.title}\nAmount: $${bill.totalAmount}\nCreated: ${new Date().toISOString()}`;
          fs.writeFileSync(fullPath, content);
          fileSize = content.length;
        }
        
        await db
          .insert(schema.documents)
          .values({
            name: `${isInvoice ? 'Invoice' : 'Receipt'} - ${bill.billNumber}`,
            description: `${isInvoice ? 'Invoice' : 'Payment receipt'} for ${bill.title}`,
            documentType: 'financial',
            filePath,
            fileName,
            fileSize,
            mimeType: 'text/plain',
            isVisibleToTenants: !isInvoice,
            buildingId: bill.buildingId,
            uploadedById: manager.id,
            attachedToType: 'bill',
            attachedToId: bill.id
          });
        
        totalDocuments++;
      }
    }
    
    console.log(`\n✅ Successfully created ${totalDocuments} document records in database`);
    console.log('📄 All documents are now properly linked to buildings, residences, and bills');
    
  } catch (error) {
    console.error('❌ Failed to fix demo documents:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Starting Demo Document Fix');
    console.log('='.repeat(50));
    
    await initializeDatabase();
    await fixDemoDocuments();
    
    console.log('\n✅ Demo document fix completed successfully!');
    console.log('🎉 You should now see documents in the Demo Organization buildings');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;