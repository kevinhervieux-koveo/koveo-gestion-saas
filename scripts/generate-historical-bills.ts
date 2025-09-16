#!/usr/bin/env tsx

import { db } from '../server/db';
import { bills } from '../shared/schemas/financial';
import { buildings } from '../shared/schemas/property';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { 
  generateStorageDirectory, 
  type UploadContext 
} from '../shared/config/upload-config';

// Building and user details
const BUILDING_ID = 'c3052c3c-b694-41a6-bd65-3bc3ae9a5984';
const ADMIN_USER_ID = '3b174fcb-93a1-467a-ad61-b047156a98c2';
const BUILDING_NAME = '1936 Nitzsche Track Building 5';

// Bill categories and typical vendors
const BILL_CATEGORIES = [
  'insurance',
  'maintenance', 
  'utilities',
  'cleaning',
  'security',
  'landscaping',
  'professional_services',
  'administration',
  'repairs',
  'supplies'
] as const;

const VENDORS_BY_CATEGORY = {
  insurance: ['Quebec Insurance Co.', 'Desjardins Assurances', 'Intact Insurance', 'Aviva Canada'],
  maintenance: ['Maintenance Plus', 'ServiceMaster', 'Reliable Building Care', 'Total Maintenance Solutions'],
  utilities: ['Hydro-Québec', 'Énergir', 'Videotron', 'Bell Canada'],
  cleaning: ['Nettoyage Excellence', 'CleanMaster Services', 'Entretien Ménager Plus', 'Pro-Clean Services'],
  security: ['Garda Security', 'Securitas', 'GardaWorld', 'Paladin Security'],
  landscaping: ['Jardins Excellence', 'Landscaping Pro', 'Entretien Paysager Plus', 'Green Thumb Services'],
  professional_services: ['Comptables Associés', 'Gestion Immobilière Québec', 'Services Juridiques Plus', 'Consultants Experts'],
  administration: ['Services Administratifs Plus', 'Gestion Administrative Pro', 'Administration Excellence', 'Pro-Admin Services'],
  repairs: ['Réparations Express', 'Fix-It Pro', 'Maintenance & Réparations', 'Service de Réparation Plus'],
  supplies: ['Fournitures Industrielles', 'Supplies Pro', 'Matériaux Plus', 'Équipements & Fournitures']
};

// Generate random amounts based on category
function getRandomAmount(category: string): number {
  const ranges = {
    insurance: [1200, 3500],
    maintenance: [800, 2800],
    utilities: [600, 1800],
    cleaning: [400, 1200],
    security: [500, 1500],
    landscaping: [300, 1000],
    professional_services: [1000, 4000],
    administration: [600, 2000],
    repairs: [400, 1800],
    supplies: [200, 800]
  };
  
  const [min, max] = ranges[category as keyof typeof ranges] || [500, 1500];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random vendor for category
function getRandomVendor(category: string): string {
  const vendors = VENDORS_BY_CATEGORY[category as keyof typeof VENDORS_BY_CATEGORY] || ['Generic Vendor'];
  return vendors[Math.floor(Math.random() * vendors.length)];
}

// Generate bill number
function generateBillNumber(year: number, month: number, category: string, sequence: number): string {
  const monthStr = month.toString().padStart(2, '0');
  const categoryCode = category.toUpperCase().replace('_', '');
  return `${BUILDING_NAME.substring(0, 4).toUpperCase()}-${year}-${monthStr}-${categoryCode}-${sequence}`;
}

// Create text attachment content
function generateBillAttachmentContent(
  billNumber: string,
  title: string,
  vendor: string,
  amount: number,
  date: string,
  category: string
): string {
  return `FACTURE / INVOICE
===================

Numéro de facture / Invoice Number: ${billNumber}
Date: ${date}

FACTURER À / BILL TO:
${BUILDING_NAME}
2536 montée Sainte-Catherine
Québec, Canada

FOURNISSEUR / VENDOR:
${vendor}

DESCRIPTION / DESCRIPTION:
${title}

CATÉGORIE / CATEGORY: ${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}

MONTANT / AMOUNT:
Sous-total / Subtotal: $${amount.toFixed(2)} CAD
TPS (5%) / GST: $${(amount * 0.05).toFixed(2)} CAD
TVQ (9.975%) / QST: $${(amount * 0.09975).toFixed(2)} CAD
TOTAL: $${(amount * 1.14975).toFixed(2)} CAD

CONDITIONS DE PAIEMENT / PAYMENT TERMS:
Net 30 jours / Net 30 days

Merci de votre confiance / Thank you for your business
===============================================

Ce document est généré automatiquement pour les besoins de test du système Koveo Gestion.
This document is automatically generated for Koveo Gestion system testing purposes.
`;
}

// Create attachment file using hierarchical storage structure
async function createBillAttachment(
  billId: string,
  billNumber: string,
  title: string,
  vendor: string,
  amount: number,
  date: string,
  category: string
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  // Get organization ID for the building
  const [building] = await db
    .select({ organizationId: buildings.organizationId })
    .from(buildings)
    .where(eq(buildings.id, BUILDING_ID))
    .limit(1);
  
  const organizationId = building?.organizationId || 'da67894c-fbbe-4f0f-b686-ee1d1cb13891'; // Fallback to Demo organization
  
  // Create upload context for hierarchical storage
  const uploadContext: UploadContext = {
    type: 'bills',
    organizationId,
    buildingId: BUILDING_ID,
    userRole: 'manager',
    userId: ADMIN_USER_ID
  };
  
  // Generate hierarchical storage path
  const storageDir = generateStorageDirectory(uploadContext);
  const fileName = `invoice-${billNumber.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.txt`;
  const relativePath = `${storageDir}/${fileName}`;
  
  // Full path from uploads directory
  const uploadsBaseDir = path.join(process.cwd(), 'uploads');
  const fullPath = path.join(uploadsBaseDir, relativePath);
  const dir = path.dirname(fullPath);
  
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = generateBillAttachmentContent(billNumber, title, vendor, amount, date, category);
  
  // Write file
  fs.writeFileSync(fullPath, content, 'utf8');
  const fileSize = fs.statSync(fullPath).size;
  
  return {
    filePath: relativePath, // Return relative path for database storage
    fileName,
    fileSize
  };
}

// Generate status based on date (older bills more likely to be paid)
function generateStatus(date: Date): 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled' {
  const monthsAgo = (new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  if (monthsAgo > 12) {
    // Bills older than 1 year: 85% paid, 10% overdue, 5% cancelled
    const rand = Math.random();
    if (rand < 0.85) return 'paid';
    if (rand < 0.95) return 'overdue';
    return 'cancelled';
  } else if (monthsAgo > 6) {
    // Bills 6-12 months old: 70% paid, 20% overdue, 5% sent, 5% cancelled
    const rand = Math.random();
    if (rand < 0.70) return 'paid';
    if (rand < 0.90) return 'overdue';
    if (rand < 0.95) return 'sent';
    return 'cancelled';
  } else if (monthsAgo > 3) {
    // Bills 3-6 months old: 60% paid, 25% overdue, 10% sent, 5% cancelled
    const rand = Math.random();
    if (rand < 0.60) return 'paid';
    if (rand < 0.85) return 'overdue';
    if (rand < 0.95) return 'sent';
    return 'cancelled';
  } else {
    // Recent bills: 40% paid, 30% overdue, 25% sent, 5% draft
    const rand = Math.random();
    if (rand < 0.40) return 'paid';
    if (rand < 0.70) return 'overdue';
    if (rand < 0.95) return 'sent';
    return 'draft';
  }
}

async function generateHistoricalBills() {
  console.log('🚀 Starting historical bill generation...');
  
  const startDate = new Date('2021-01-01');
  const endDate = new Date('2025-09-09');
  
  const billsToCreate: any[] = [];
  let totalBills = 0;

  // Generate bills from 2021 to 2025-09-09
  for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
    const startMonth = year === startDate.getFullYear() ? startDate.getMonth() + 1 : 1;
    const endMonth = year === endDate.getFullYear() ? endDate.getMonth() + 1 : 12;
    
    for (let month = startMonth; month <= endMonth; month++) {
      // Skip future months if we're in the current year
      const billDate = new Date(year, month - 1, Math.floor(Math.random() * 28) + 1);
      if (billDate > endDate) continue;

      // Generate 2-5 bills per month with varying categories
      const billsThisMonth = Math.floor(Math.random() * 4) + 2;
      const usedCategories = new Set<string>();

      for (let i = 0; i < billsThisMonth; i++) {
        // Ensure we don't repeat categories in the same month
        let category: string;
        let attempts = 0;
        do {
          category = BILL_CATEGORIES[Math.floor(Math.random() * BILL_CATEGORIES.length)];
          attempts++;
        } while (usedCategories.has(category) && attempts < 10);
        
        if (attempts >= 10) continue; // Skip if we can't find an unused category
        usedCategories.add(category);

        const vendor = getRandomVendor(category);
        const amount = getRandomAmount(category);
        const billId = uuidv4();
        const billNumber = generateBillNumber(year, month, category, i + 1);
        const title = `${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} - ${vendor}`;
        const status = generateStatus(billDate);

        // Create attachment
        console.log(`📄 Creating attachment for bill ${billNumber}...`);
        const attachment = await createBillAttachment(
          billId,
          billNumber,
          title,
          vendor,
          amount,
          billDate.toISOString().split('T')[0],
          category
        );

        const bill = {
          id: billId,
          buildingId: BUILDING_ID,
          billNumber: billNumber,
          title,
          description: `Monthly ${category.replace('_', ' ')} service for ${billDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          category,
          vendor,
          paymentType: 'unique' as const,
          schedulePayment: null,
          scheduleCustom: null,
          costs: [amount.toString()],
          totalAmount: amount.toString(),
          startDate: billDate.toISOString().split('T')[0],
          endDate: null,
          status,
          filePath: attachment.filePath,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          isAiAnalyzed: false,
          aiAnalysisData: null,
          notes: status === 'paid' ? `Payment confirmed on ${new Date(billDate.getTime() + Math.random() * 45 * 24 * 60 * 60 * 1000).toLocaleDateString()}` : null,
          autoGenerated: false,
          reference: null,
          createdBy: ADMIN_USER_ID,
          createdAt: billDate,
          updatedAt: billDate
        };

        billsToCreate.push(bill);
        totalBills++;

        if (totalBills % 50 === 0) {
          console.log(`📊 Generated ${totalBills} bills so far...`);
        }
      }
    }
  }

  console.log(`💾 Inserting ${totalBills} bills into database...`);
  
  // Insert in batches of 50
  for (let i = 0; i < billsToCreate.length; i += 50) {
    const batch = billsToCreate.slice(i, i + 50);
    try {
      await db.insert(bills).values(batch);
      console.log(`✅ Inserted batch ${Math.floor(i / 50) + 1}/${Math.ceil(billsToCreate.length / 50)}`);
    } catch (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / 50) + 1}:`, error);
      throw error;
    }
  }

  console.log(`🎉 Successfully generated ${totalBills} historical bills with attachments!`);
  
  // Summary statistics
  const categories = billsToCreate.reduce((acc, bill) => {
    acc[bill.category] = (acc[bill.category] || 0) + 1;
    return acc;
  }, {});
  
  const statuses = billsToCreate.reduce((acc, bill) => {
    acc[bill.status] = (acc[bill.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📈 Generation Summary:');
  console.log('Categories:', categories);
  console.log('Statuses:', statuses);
}

// Run the script
generateHistoricalBills()
  .then(() => {
    console.log('✅ Historical bill generation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error generating historical bills:', error);
    process.exit(1);
  });