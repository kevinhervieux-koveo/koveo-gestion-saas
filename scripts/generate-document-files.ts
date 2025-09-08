#!/usr/bin/env tsx

/**
 * Generate Physical Document Files for Production
 * 
 * Creates actual text files on disk for all documents in the Demo organization
 * Uses the same content generation logic as the demo creation script
 */

import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '../shared/schema';

/**
 * Quebec-specific data generators (from demo script)
 */
function generateQuebecPhone(): string {
  const areaCodes = ['514', '438', '450', '579', '418', '581', '819', '873'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const exchange = faker.string.numeric(3);
  const number = faker.string.numeric(4);
  return `(${areaCode}) ${exchange}-${number}`;
}

/**
 * Create demo disclosure notice
 */
function createDemoDisclosure(): string {
  return `⚠️ DEMO NOTICE - FOR DEMONSTRATION PURPOSES ONLY ⚠️

This document contains fictional data created for product demonstration.
In a real environment, this would contain actual uploaded content from property managers.
All information shown is generated automatically for testing and demo purposes.

This demo showcases the document management capabilities of Koveo Gestion.

═══════════════════════════════════════════════════════════

`;
}

/**
 * Ensure directory exists, create if not
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write file to disk and return file info
 */
function writeDocumentFile(filePath: string, content: string): { fileSize: number } {
  const fullPath = path.resolve(filePath);
  const dir = path.dirname(fullPath);
  ensureDirectoryExists(dir);
  fs.writeFileSync(fullPath, content, 'utf8');
  return { fileSize: content.length };
}

/**
 * Generate content for bill documents
 */
function generateBillDocumentContent(doc: any, bill: any, isInvoice: boolean): string {
  const demoDisclosure = createDemoDisclosure();
  const docType = isInvoice ? 'invoice' : 'receipt';
  
  let documentContent = `${demoDisclosure}${docType.toUpperCase()} DOCUMENT

Bill Number: ${bill.bill_number}
Title: ${bill.title}
Vendor: ${bill.vendor}
Category: ${bill.category.charAt(0).toUpperCase() + bill.category.slice(1)}
Total Amount: $${bill.total_amount}
Description: ${bill.description}

`;

  if (isInvoice) {
    documentContent += `This invoice document would normally be uploaded by the property manager
as a PDF or image file, but for this demo we're showing it as text content.

Payment Terms: Net 30 days
Invoice Date: ${faker.date.recent().toLocaleDateString()}
Due Date: ${faker.date.future().toLocaleDateString()}

Service Details:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Thank you for your business!
${bill.vendor}`;
  } else {
    documentContent += `Payment Amount: $${bill.total_amount}
Payment Date: ${faker.date.recent().toLocaleDateString()}
Payment Method: ${faker.helpers.arrayElement(['Electronic Transfer', 'Check', 'ACH Transfer'])}
Reference Number: PAY-${faker.string.alphanumeric(8).toUpperCase()}

This payment has been processed successfully.
Building Management Office`;
  }

  return documentContent;
}

/**
 * Generate content for residence documents
 */
function generateResidenceDocumentContent(doc: any, residence: any, building: any): string {
  const demoDisclosure = createDemoDisclosure();
  
  let documentContent = `${demoDisclosure}${doc.document_type.toUpperCase()}

Unit: ${residence.unit_number}
Building: ${building.name}
Address: ${faker.location.streetAddress()}

`;

  if (doc.document_type === 'lease') {
    documentContent += `LEASE AGREEMENT

Tenant Information:
- Unit Number: ${residence.unit_number}
- Lease Start Date: ${faker.date.past().toLocaleDateString()}
- Lease End Date: ${faker.date.future().toLocaleDateString()}
- Monthly Rent: $${faker.number.int({ min: 800, max: 2500 })}
- Security Deposit: $${faker.number.int({ min: 800, max: 2500 })}

Terms and Conditions:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Landlord: ${building.name} Management
Tenant Signature: ____________________
Date: ${faker.date.recent().toLocaleDateString()}`;
  } else if (doc.document_type === 'inspection') {
    documentContent += `INSPECTION REPORT

Inspection Date: ${faker.date.recent().toLocaleDateString()}
Inspector: ${faker.person.fullName()}

Inspection Results:
✓ Electrical systems - Good condition
✓ Plumbing - Good condition  
✓ Heating/Cooling - Good condition
⚠ Minor paint touch-up needed in bedroom
✓ Windows and doors - Good condition
✓ Smoke detectors - Working properly

Overall Rating: ${faker.helpers.arrayElement(['Excellent', 'Good', 'Fair'])}

Notes:
${faker.lorem.paragraph()}

Inspector Signature: ____________________`;
  } else if (doc.document_type === 'maintenance') {
    documentContent += `MAINTENANCE LOG

Maintenance History for Unit ${residence.unit_number}:

${faker.date.past().toLocaleDateString()} - ${faker.helpers.arrayElement(['Plumbing repair', 'Electrical work', 'HVAC maintenance'])}
Status: Completed
Cost: $${faker.number.int({ min: 50, max: 500 })}

${faker.date.recent().toLocaleDateString()} - ${faker.helpers.arrayElement(['Annual inspection', 'Filter replacement', 'Light fixture repair'])}
Status: In Progress
Estimated Cost: $${faker.number.int({ min: 50, max: 500 })}

Next Scheduled Maintenance: ${faker.date.future().toLocaleDateString()}`;
  }

  return documentContent;
}

/**
 * Generate content for building documents
 */
function generateBuildingDocumentContent(doc: any, building: any): string {
  const demoDisclosure = createDemoDisclosure();
  
  let documentContent = `${demoDisclosure}${doc.document_type.toUpperCase()}

Building: ${building.name}
Document Date: ${faker.date.recent().toLocaleDateString()}

`;

  if (doc.document_type === 'insurance') {
    documentContent += `INSURANCE CERTIFICATE

Policy Number: INS-${faker.string.alphanumeric(10).toUpperCase()}
Insurance Company: ${faker.company.name()} Insurance
Coverage Type: Commercial Property Insurance
Coverage Amount: $${faker.number.int({ min: 1000000, max: 5000000 }).toLocaleString()}
Policy Period: ${faker.date.past().toLocaleDateString()} to ${faker.date.future().toLocaleDateString()}

Coverage Details:
- Property Damage: Covered
- Liability: Covered  
- Natural Disasters: Covered
- Equipment Breakdown: Covered

Contact Information:
Agent: ${faker.person.fullName()}
Phone: ${generateQuebecPhone()}
Email: ${faker.internet.email()}`;
  } else if (doc.document_type === 'permits') {
    documentContent += `BUILDING PERMIT

Permit Number: PER-${faker.string.alphanumeric(8).toUpperCase()}
Permit Type: ${faker.helpers.arrayElement(['Renovation', 'Electrical Work', 'Plumbing', 'HVAC Installation'])}
Issue Date: ${faker.date.past().toLocaleDateString()}
Expiry Date: ${faker.date.future().toLocaleDateString()}
Contractor: ${faker.company.name()}

Work Description:
${faker.lorem.paragraph()}

Inspection Schedule:
- Initial Inspection: ${faker.date.recent().toLocaleDateString()}
- Progress Inspection: ${faker.date.soon().toLocaleDateString()}
- Final Inspection: ${faker.date.future().toLocaleDateString()}

Approved by: City Planning Department
Permit Fee: $${faker.number.int({ min: 100, max: 1000 })}`;
  } else if (doc.document_type === 'meeting_minutes') {
    documentContent += `BOARD MEETING MINUTES

Meeting Date: ${faker.date.recent().toLocaleDateString()}
Meeting Time: ${faker.number.int({ min: 18, max: 20 })}:00
Location: ${building.name} Community Room

Attendees:
- ${faker.person.fullName()} (Board President)
- ${faker.person.fullName()} (Treasurer)  
- ${faker.person.fullName()} (Secretary)
- ${faker.person.fullName()} (Property Manager)

Agenda Items:
1. Budget Review - ${faker.lorem.sentence()}
2. Maintenance Updates - ${faker.lorem.sentence()}
3. New Policies - ${faker.lorem.sentence()}

Action Items:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Next Meeting: ${faker.date.future().toLocaleDateString()}`;
  } else if (doc.document_type === 'contracts') {
    documentContent += `SERVICE CONTRACT

Contract Number: CON-${faker.string.alphanumeric(8).toUpperCase()}
Service Provider: ${faker.company.name()}
Service Type: ${faker.helpers.arrayElement(['Cleaning Services', 'Landscaping', 'Security', 'Maintenance'])}
Contract Period: ${faker.date.past().toLocaleDateString()} to ${faker.date.future().toLocaleDateString()}
Monthly Cost: $${faker.number.int({ min: 500, max: 3000 })}

Service Details:
${faker.lorem.paragraph()}

Contact Information:
Manager: ${faker.person.fullName()}
Phone: ${generateQuebecPhone()}
Emergency Contact: ${generateQuebecPhone()}

Terms and Conditions:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}`;
  }

  return documentContent;
}

/**
 * Main function to generate all document files
 */
async function generateDocumentFiles() {
  try {
    console.log('🔗 Connecting to PRODUCTION database (DATABASE_URL_KOVEO)');
    
    const DATABASE_URL_KOVEO = process.env.DATABASE_URL_KOVEO;
    if (!DATABASE_URL_KOVEO) {
      console.error('❌ DATABASE_URL_KOVEO environment variable is required');
      process.exit(1);
    }
    
    const { Pool } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    
    const pool = new Pool({ connectionString: DATABASE_URL_KOVEO });
    const db = drizzle({ client: pool, schema });
    
    console.log('📄 Generating physical document files for Demo organization...');
    
    // Get all documents from Demo organization
    const documents = await db
      .select({
        id: schema.documents.id,
        name: schema.documents.name,
        documentType: schema.documents.documentType,
        filePath: schema.documents.filePath,
        fileName: schema.documents.fileName,
        buildingId: schema.documents.buildingId,
        residenceId: schema.documents.residenceId,
        attachedToId: schema.documents.attachedToId,
        attachedToType: schema.documents.attachedToType
      })
      .from(schema.documents)
      .leftJoin(schema.buildings, eq(schema.documents.buildingId, schema.buildings.id))
      .leftJoin(schema.residences, eq(schema.documents.residenceId, schema.residences.id))
      .leftJoin(schema.organizations, eq(schema.buildings.organizationId, schema.organizations.id))
      .where(eq(schema.organizations.type, 'demo'));

    console.log(`Found ${documents.length} documents to generate files for`);

    let filesCreated = 0;

    for (const doc of documents) {
      try {
        let content = '';
        
        if (doc.attachedToType === 'bill' && doc.attachedToId) {
          // Generate bill document content
          const [bill] = await db
            .select()
            .from(schema.bills)
            .where(eq(schema.bills.id, doc.attachedToId))
            .limit(1);
            
          if (bill) {
            const isInvoice = doc.name.toLowerCase().includes('invoice');
            content = generateBillDocumentContent(doc, bill, isInvoice);
          }
        } else if (doc.residenceId) {
          // Generate residence document content
          const [residence] = await db
            .select()
            .from(schema.residences)
            .where(eq(schema.residences.id, doc.residenceId))
            .limit(1);
            
          const [building] = await db
            .select()
            .from(schema.buildings)
            .where(eq(schema.buildings.id, doc.buildingId))
            .limit(1);
            
          if (residence && building) {
            content = generateResidenceDocumentContent(doc, residence, building);
          }
        } else if (doc.buildingId) {
          // Generate building document content
          const [building] = await db
            .select()
            .from(schema.buildings)
            .where(eq(schema.buildings.id, doc.buildingId))
            .limit(1);
            
          if (building) {
            content = generateBuildingDocumentContent(doc, building);
          }
        }
        
        if (content) {
          const filePath = `uploads/${doc.filePath}`;
          writeDocumentFile(filePath, content);
          filesCreated++;
          
          if (filesCreated % 100 === 0) {
            console.log(`   Created ${filesCreated} files...`);
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to create file for document ${doc.id}: ${error}`);
      }
    }
    
    console.log(`✅ Successfully created ${filesCreated} document files`);
    console.log('📁 All files created in uploads/ directory structure');
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Failed to generate document files:', error);
    process.exit(1);
  }
}

// Run the script
generateDocumentFiles();