import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, inArray, and, sql } from 'drizzle-orm';
import * as schema from '../shared/schema';
import * as bcrypt from 'bcryptjs';
import ws from 'ws';
import { uploadSeededDocumentPlaceholder, getSeededPlaceholderPdfSize, writeSeededPlaceholderToLocalPath } from './lib/seed-document-upload';
import { ObjectAccessGroupType, ObjectPermission } from '../server/objectAcl';
import * as path from 'path';
import { randomUUID } from 'crypto';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const ORGS_TO_KEEP = ['e9bb7862-4ba5-4822-848f-f3692e826e73', 'f0e34e59-0d81-4c1a-b95f-e23dd1667a19'];
const ADMIN_USER_ID = '3b174fcb-93a1-467a-ad61-b047156a98c2';

interface DemoUserConfig {
  firstName: string;
  lastName: string;
  email: string;
  role: 'demo_manager' | 'demo_resident' | 'demo_tenant';
  description: string;
}

const DEMO_USERS: DemoUserConfig[] = [
  { firstName: 'Marie', lastName: 'Tremblay', email: 'marie.tremblay@demo.koveo.ca', role: 'demo_manager', description: 'Building Manager' },
  { firstName: 'Jean-Pierre', lastName: 'Gagnon', email: 'jp.gagnon@demo.koveo.ca', role: 'demo_manager', description: 'Assistant Manager' },
  { firstName: 'Sophie', lastName: 'Bouchard', email: 'sophie.bouchard@demo.koveo.ca', role: 'demo_resident', description: 'Condo Owner' },
  { firstName: 'Michel', lastName: 'Roy', email: 'michel.roy@demo.koveo.ca', role: 'demo_resident', description: 'Board Member' },
  { firstName: 'Isabelle', lastName: 'Côté', email: 'isabelle.cote@demo.koveo.ca', role: 'demo_resident', description: 'Long-term Resident' },
  { firstName: 'François', lastName: 'Lavoie', email: 'francois.lavoie@demo.koveo.ca', role: 'demo_tenant', description: 'Tenant' },
  { firstName: 'Nathalie', lastName: 'Fortin', email: 'nathalie.fortin@demo.koveo.ca', role: 'demo_tenant', description: 'New Tenant' },
  { firstName: 'Robert', lastName: 'Morin', email: 'robert.morin@demo.koveo.ca', role: 'demo_resident', description: 'Senior Resident' },
  { firstName: 'Chantal', lastName: 'Gauthier', email: 'chantal.gauthier@demo.koveo.ca', role: 'demo_manager', description: 'Concierge' },
  { firstName: 'Pierre', lastName: 'Bélanger', email: 'pierre.belanger@demo.koveo.ca', role: 'demo_resident', description: 'Vice-President' },
];

const BUILDING_NAMES = [
  { name: 'Les Jardins du Parc', address: '1250 Boulevard René-Lévesque Est' },
  { name: 'Résidences du Fleuve', address: '500 Avenue des Érables' },
  { name: 'Le Belvedere', address: '875 Rue Sherbrooke Ouest' },
  { name: 'Place Laurier', address: '2100 Chemin Sainte-Foy' },
  { name: 'Domaine des Pins', address: '450 Boulevard de l\'Ormière' },
  { name: 'La Citadelle', address: '1800 Avenue Cartier' },
];

const DOCUMENT_TYPES = [
  { type: 'building_permit', nameEn: 'Building Permit', nameFr: 'Permis de construction' },
  { type: 'insurance_policy', nameEn: 'Insurance Policy', nameFr: 'Police d\'assurance' },
  { type: 'meeting_minutes', nameEn: 'Annual General Meeting Minutes', nameFr: 'Procès-verbal AGA' },
  { type: 'financial_statement', nameEn: 'Financial Statement', nameFr: 'États financiers' },
  { type: 'maintenance_contract', nameEn: 'Maintenance Contract', nameFr: 'Contrat d\'entretien' },
  { type: 'fire_inspection', nameEn: 'Fire Safety Inspection Report', nameFr: 'Rapport inspection incendie' },
  { type: 'elevator_inspection', nameEn: 'Elevator Inspection Certificate', nameFr: 'Certificat inspection ascenseur' },
  { type: 'condo_declaration', nameEn: 'Condo Declaration', nameFr: 'Déclaration de copropriété' },
];

const BILL_CATEGORIES = [
  { category: 'utilities' as const, nameFr: 'Services publics' },
  { category: 'insurance' as const, nameFr: 'Assurance' },
  { category: 'maintenance' as const, nameFr: 'Entretien' },
  { category: 'cleaning' as const, nameFr: 'Services de nettoyage' },
  { category: 'landscaping' as const, nameFr: 'Aménagement paysager' },
  { category: 'security' as const, nameFr: 'Services de sécurité' },
];

const INVENTORY_ELEMENTS = [
  { category: 'D30', name: 'HVAC System', nameFr: 'Système CVAC', lifespan: 20 },
  { category: 'D10', name: 'Elevator', nameFr: 'Ascenseur', lifespan: 25 },
  { category: 'B20', name: 'Exterior Windows', nameFr: 'Fenêtres extérieures', lifespan: 30 },
  { category: 'B30', name: 'Roof', nameFr: 'Toiture', lifespan: 25 },
  { category: 'D50', name: 'Electrical System', nameFr: 'Système électrique', lifespan: 40 },
  { category: 'D20', name: 'Plumbing System', nameFr: 'Plomberie', lifespan: 35 },
  { category: 'D40', name: 'Fire Protection System', nameFr: 'Système protection incendie', lifespan: 20 },
  { category: 'G20', name: 'Parking Structure', nameFr: 'Stationnement', lifespan: 40 },
];

const PROJECT_TYPES = [
  { type: 'repair' as const, statusOptions: ['planned', 'in_progress', 'completed'] as const },
  { type: 'replacement' as const, statusOptions: ['planned', 'in_progress', 'completed'] as const },
  { type: 'minor_rehab' as const, statusOptions: ['planned', 'in_progress', 'completed'] as const },
  { type: 'major_rehab' as const, statusOptions: ['planned', 'in_progress'] as const },
];

const COMMON_SPACES = [
  { 
    name: 'Salle d\'entraînement',
    description: 'Salle de conditionnement physique équipée avec appareils cardio et musculation',
    isReservable: true,
    capacity: 15,
    openingHours: { monday: { open: '06:00', close: '22:00' }, tuesday: { open: '06:00', close: '22:00' }, wednesday: { open: '06:00', close: '22:00' }, thursday: { open: '06:00', close: '22:00' }, friday: { open: '06:00', close: '22:00' }, saturday: { open: '08:00', close: '20:00' }, sunday: { open: '08:00', close: '20:00' } },
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    bookingRules: 'Réservation maximale de 2 heures. Nettoyage des équipements obligatoire après utilisation.',
  },
  { 
    name: 'Salon communautaire',
    description: 'Espace de détente avec télévision, bibliothèque et coin café',
    isReservable: false,
    capacity: 30,
    openingHours: { monday: { open: '08:00', close: '22:00' }, tuesday: { open: '08:00', close: '22:00' }, wednesday: { open: '08:00', close: '22:00' }, thursday: { open: '08:00', close: '22:00' }, friday: { open: '08:00', close: '22:00' }, saturday: { open: '08:00', close: '22:00' }, sunday: { open: '08:00', close: '22:00' } },
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    bookingRules: null,
  },
  { 
    name: 'Salle de réunion',
    description: 'Salle équipée pour réunions avec écran, projecteur et système de vidéoconférence',
    isReservable: true,
    capacity: 12,
    openingHours: { monday: { open: '08:00', close: '21:00' }, tuesday: { open: '08:00', close: '21:00' }, wednesday: { open: '08:00', close: '21:00' }, thursday: { open: '08:00', close: '21:00' }, friday: { open: '08:00', close: '21:00' }, saturday: { open: '09:00', close: '17:00' }, sunday: { open: '09:00', close: '17:00' } },
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    bookingRules: 'Réservation requise 24h à l\'avance. Maximum 4 heures par réservation.',
  },
  { 
    name: 'Piscine',
    description: 'Piscine intérieure chauffée avec vestiaires et douches',
    isReservable: true,
    capacity: 20,
    openingHours: { monday: { open: '07:00', close: '21:00' }, tuesday: { open: '07:00', close: '21:00' }, wednesday: { open: '07:00', close: '21:00' }, thursday: { open: '07:00', close: '21:00' }, friday: { open: '07:00', close: '21:00' }, saturday: { open: '08:00', close: '20:00' }, sunday: { open: '08:00', close: '20:00' } },
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    bookingRules: 'Réservation d\'un créneau de 1 heure. Maximum 2 invités par résident.',
  },
  { 
    name: 'Terrasse sur le toit',
    description: 'Terrasse panoramique avec mobilier de jardin et vue sur la ville',
    isReservable: false,
    capacity: 40,
    openingHours: { monday: { open: '09:00', close: '21:00' }, tuesday: { open: '09:00', close: '21:00' }, wednesday: { open: '09:00', close: '21:00' }, thursday: { open: '09:00', close: '21:00' }, friday: { open: '09:00', close: '22:00' }, saturday: { open: '09:00', close: '22:00' }, sunday: { open: '09:00', close: '21:00' } },
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    bookingRules: null,
  },
  { 
    name: 'Aire BBQ',
    description: 'Espace barbecue extérieur avec tables de pique-nique et évier',
    isReservable: true,
    capacity: 25,
    openingHours: { monday: { open: '10:00', close: '21:00' }, tuesday: { open: '10:00', close: '21:00' }, wednesday: { open: '10:00', close: '21:00' }, thursday: { open: '10:00', close: '21:00' }, friday: { open: '10:00', close: '22:00' }, saturday: { open: '10:00', close: '22:00' }, sunday: { open: '10:00', close: '21:00' } },
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    bookingRules: 'Réservation de 3 heures maximum. Nettoyage obligatoire après utilisation.',
  },
];

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function deleteOrphanedData() {
  console.log('🧹 Cleaning up orphaned organizations and related data...\n');
  
  const orgsToDelete = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(sql`${schema.organizations.id} NOT IN (${sql.join(ORGS_TO_KEEP.map(id => sql`${id}`), sql`, `)})`);
  
  console.log(`Found ${orgsToDelete.length} organizations to delete:`);
  orgsToDelete.forEach(org => console.log(`  - ${org.name} (${org.id})`));
  
  const buildingsToDelete = await db
    .select({ id: schema.buildings.id })
    .from(schema.buildings)
    .where(sql`${schema.buildings.organizationId} NOT IN (${sql.join(ORGS_TO_KEEP.map(id => sql`${id}`), sql`, `)})`);
  
  const buildingIds = buildingsToDelete.map(b => b.id);
  console.log(`\nFound ${buildingIds.length} buildings to delete`);
  
  if (buildingIds.length > 0) {
    const residencesToDelete = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(inArray(schema.residences.buildingId, buildingIds));
    
    const residenceIds = residencesToDelete.map(r => r.id);
    console.log(`Found ${residenceIds.length} residences to delete`);
    
    if (residenceIds.length > 0) {
      await db.delete(schema.userResidences).where(inArray(schema.userResidences.residenceId, residenceIds));
      console.log('  ✓ Deleted user_residences');
      
      await db.delete(schema.documents).where(inArray(schema.documents.residenceId, residenceIds));
      console.log('  ✓ Deleted residence documents');
      
      await db.delete(schema.demands).where(inArray(schema.demands.residenceId, residenceIds));
      console.log('  ✓ Deleted residence demands');
      
      await db.delete(schema.residences).where(inArray(schema.residences.id, residenceIds));
      console.log('  ✓ Deleted residences');
    }
    
    await db.delete(schema.bills).where(inArray(schema.bills.buildingId, buildingIds));
    console.log('  ✓ Deleted bills');
    
    await db.delete(schema.documents).where(inArray(schema.documents.buildingId, buildingIds));
    console.log('  ✓ Deleted building documents');
    
    await db.delete(schema.maintenanceProjects).where(inArray(schema.maintenanceProjects.buildingId, buildingIds));
    console.log('  ✓ Deleted maintenance projects');
    
    await db.delete(schema.buildingElements).where(inArray(schema.buildingElements.buildingId, buildingIds));
    console.log('  ✓ Deleted building elements');
    
    await db.delete(schema.budgets).where(inArray(schema.budgets.buildingId, buildingIds));
    console.log('  ✓ Deleted budgets');
    
    await db.delete(schema.monthlyBudgets).where(inArray(schema.monthlyBudgets.buildingId, buildingIds));
    console.log('  ✓ Deleted monthly budgets');
    
    await db.delete(schema.commonSpaces).where(inArray(schema.commonSpaces.buildingId, buildingIds));
    console.log('  ✓ Deleted common spaces');
    
    await db.delete(schema.demands).where(inArray(schema.demands.buildingId, buildingIds));
    console.log('  ✓ Deleted demands');
    
    await db.delete(schema.userBuildings).where(inArray(schema.userBuildings.buildingId, buildingIds));
    console.log('  ✓ Deleted user_buildings');
    
    await db.delete(schema.buildings).where(inArray(schema.buildings.id, buildingIds));
    console.log('  ✓ Deleted buildings');
  }
  
  const orgIds = orgsToDelete.map(o => o.id);
  if (orgIds.length > 0) {
    await db.delete(schema.userOrganizations).where(inArray(schema.userOrganizations.organizationId, orgIds));
    console.log('  ✓ Deleted user_organizations');
    
    await db.delete(schema.organizations).where(inArray(schema.organizations.id, orgIds));
    console.log('  ✓ Deleted organizations');
  }
  
  console.log('\n✅ Orphaned data cleanup complete!\n');
}

async function skipPruneBuildings() {
  console.log('🏢 Keeping all existing buildings (skipping pruning)...\n');
  
  const buildingCount = await db
    .select({ id: schema.buildings.id })
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  console.log(`  Found ${buildingCount.length} buildings in demo organizations`);
  console.log('✅ Building check complete!\n');
}

async function renameBuildings() {
  console.log('🏷️ Renaming buildings to French names...\n');
  
  const allBuildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  for (let i = 0; i < allBuildings.length && i < BUILDING_NAMES.length; i++) {
    await db
      .update(schema.buildings)
      .set({
        name: BUILDING_NAMES[i].name,
        address: BUILDING_NAMES[i].address,
        city: 'Québec',
        province: 'QC',
        postalCode: `G1K ${i + 1}A${i + 1}`,
      })
      .where(eq(schema.buildings.id, allBuildings[i].id));
    
    console.log(`  ✓ Renamed to: ${BUILDING_NAMES[i].name}`);
  }
  
  console.log('✅ Building rename complete!\n');
}

async function skipUserCleanup() {
  console.log('👥 Skipping user cleanup (keeping existing users)...\n');
  
  const demoUserCount = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`${schema.users.role} IN ('demo_manager', 'demo_resident', 'demo_tenant')`);
  
  console.log(`  Found ${demoUserCount.length} existing demo users`);
  console.log('✅ User check complete!\n');
}

async function createDemoUsers() {
  console.log('👥 Creating/updating demo users...\n');
  
  const hashedPassword = await hashPassword('demo123456');
  const createdUsers: string[] = [];
  
  for (const userConfig of DEMO_USERS) {
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, userConfig.email))
      .limit(1);
    
    let userId: string;
    
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await db.update(schema.users).set({
        firstName: userConfig.firstName,
        lastName: userConfig.lastName,
        role: userConfig.role,
        isActive: true,
        password: hashedPassword,
      }).where(eq(schema.users.id, userId));
      console.log(`  ↻ Updated: ${userConfig.firstName} ${userConfig.lastName} (${userConfig.role})`);
    } else {
      const newUserId = crypto.randomUUID();
      await db.insert(schema.users).values({
        username: userConfig.email.split('@')[0],
        email: userConfig.email,
        firstName: userConfig.firstName,
        lastName: userConfig.lastName,
        password: hashedPassword,
        role: userConfig.role,
        isActive: true,
      });
      
      const inserted = await db.select().from(schema.users).where(eq(schema.users.email, userConfig.email)).limit(1);
      userId = inserted[0]?.id || newUserId;
      console.log(`  ✓ Created: ${userConfig.firstName} ${userConfig.lastName} (${userConfig.role})`);
    }
    
    createdUsers.push(userId);
  }
  
  console.log('✅ Demo users created!\n');
  return createdUsers;
}

async function linkUsersToOrgsAndBuildings(userIds: string[]) {
  console.log('🔗 Linking users to organizations and buildings...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  const residences = await db
    .select()
    .from(schema.residences)
    .where(inArray(schema.residences.buildingId, buildings.map(b => b.id)))
    .limit(30);
  
  const demoUsers = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, userIds));
  
  for (const user of demoUsers) {
    await db.delete(schema.userOrganizations).where(eq(schema.userOrganizations.userId, user.id));
    await db.delete(schema.userBuildings).where(eq(schema.userBuildings.userId, user.id));
    await db.delete(schema.userResidences).where(eq(schema.userResidences.userId, user.id));
  }
  
  let residenceIndex = 0;
  
  for (const user of demoUsers) {
    if (user.role === 'demo_manager') {
      for (const orgId of ORGS_TO_KEEP) {
        await db.insert(schema.userOrganizations).values({
          userId: user.id,
          organizationId: orgId,
        }).onConflictDoNothing();
      }
      
      for (const building of buildings) {
        await db.insert(schema.userBuildings).values({
          userId: user.id,
          buildingId: building.id,
          relationshipType: 'manager',
        }).onConflictDoNothing();
      }
      console.log(`  ✓ Linked manager ${user.firstName} to all organizations and buildings`);
    } else {
      if (residences.length === 0) {
        console.log(`  ⚠ No residences available for ${user.firstName}`);
        continue;
      }
      
      const residence = residences[residenceIndex % residences.length];
      residenceIndex++;
      
      const building = buildings.find(b => b.id === residence.buildingId);
      if (!building) continue;
      
      await db.insert(schema.userOrganizations).values({
        userId: user.id,
        organizationId: building.organizationId,
      }).onConflictDoNothing();
      
      await db.insert(schema.userResidences).values({
        userId: user.id,
        residenceId: residence.id,
        relationshipType: user.role === 'demo_resident' ? 'owner' : 'tenant',
        startDate: formatDateStr(new Date('2023-01-01')),
        isActive: true,
      }).onConflictDoNothing();
      console.log(`  ✓ Linked ${user.firstName} (${user.role}) to ${building.name}, Unit ${residence.unitNumber}`);
    }
  }
  
  await db.insert(schema.userOrganizations).values({
    userId: ADMIN_USER_ID,
    organizationId: ORGS_TO_KEEP[0],
  }).onConflictDoNothing();
  
  await db.insert(schema.userOrganizations).values({
    userId: ADMIN_USER_ID,
    organizationId: ORGS_TO_KEEP[1],
  }).onConflictDoNothing();
  
  console.log('✅ User linking complete!\n');
}

async function createDocuments() {
  console.log('📄 Creating documents for buildings...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  await db.delete(schema.documents)
    .where(inArray(schema.documents.buildingId, buildings.map(b => b.id)));
  
  const placeholderSize = getSeededPlaceholderPdfSize();
  for (const building of buildings) {
    for (const docType of DOCUMENT_TYPES) {
      const filePath = `/objects/buildings/${building.id}/documents/${docType.type}_${Date.now()}.pdf`;
      await uploadSeededDocumentPlaceholder(filePath);
      await db.insert(schema.documents).values({
        name: `${docType.nameFr} - ${building.name}`,
        filePath,
        fileName: `${docType.type}.pdf`,
        fileSize: placeholderSize,
        mimeType: 'application/pdf',
        documentType: docType.type,
        buildingId: building.id,
        uploadedById: ADMIN_USER_ID,
        isVisibleToTenants: true,
      });
    }
    console.log(`  ✓ Created ${DOCUMENT_TYPES.length} documents for ${building.name}`);
  }
  
  console.log('✅ Document creation complete!\n');
}

let billAttachmentCounter = 0;
async function maybeSeedBillAttachment(
  buildingId: string,
  category: string,
  forceAttach: boolean = false
): Promise<{ filePath: string; fileName: string; fileSize: number } | null> {
  // Attach placeholders to roughly 1 in every 4 recurrent bills, and all
  // one-off annual bills (forceAttach=true), so every seeded building ends up
  // with several downloadable demo attachments without seeding hundreds.
  billAttachmentCounter++;
  if (!forceAttach && billAttachmentCounter % 4 !== 0) return null;

  const uuid = randomUUID();
  const fileName = `invoice_${category}_${Date.now()}.pdf`;
  const filePath = `/objects/buildings/${buildingId}/bills/${uuid}_${fileName}`;
  await uploadSeededDocumentPlaceholder(filePath, {
    owner: ADMIN_USER_ID,
    visibility: 'private',
    aclRules: [
      {
        group: { type: ObjectAccessGroupType.BUILDING, id: buildingId },
        permission: ObjectPermission.READ,
      },
    ],
  });
  return { filePath, fileName, fileSize: getSeededPlaceholderPdfSize() };
}

async function maybeSeedDemandAttachment(): Promise<{
  filePath: string;
  fileName: string;
  fileSize: number;
} | null> {
  // Demands serve attachments from /tmp/uploads/demands via a local-file
  // handler (see server/routes.ts /uploads/demands/*), not object storage.
  // Write the placeholder PDF there so the DB filePath matches what the
  // handler resolves on disk.
  const uuid = randomUUID();
  const fileName = `demand_${uuid}.pdf`;
  const filePath = `/uploads/demands/${fileName}`;
  const absolutePath = path.join('/tmp', 'uploads', 'demands', fileName);
  await writeSeededPlaceholderToLocalPath(absolutePath);
  return { filePath, fileName, fileSize: getSeededPlaceholderPdfSize() };
}

async function createBills() {
  console.log('💰 Creating bills for buildings...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  await db.delete(schema.bills)
    .where(inArray(schema.bills.buildingId, buildings.map(b => b.id)));
  
  const currentYear = new Date().getFullYear();
  let billCounter = 1;
  
  for (const building of buildings) {
    let billCount = 0;
    
    for (let month = 0; month < 12; month++) {
      for (const billCat of BILL_CATEGORIES.slice(0, 4)) {
        const dueDate = new Date(currentYear, month, 15);
        const isPaid = month < new Date().getMonth();
        const amount = randomAmount(500, 5000);
        const attachment = await maybeSeedBillAttachment(building.id, billCat.category);

        await db.insert(schema.bills).values({
          buildingId: building.id,
          billNumber: `BILL-${currentYear}-${String(billCounter++).padStart(5, '0')}`,
          title: `${billCat.nameFr} - ${dueDate.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })}`,
          category: billCat.category,
          paymentType: 'recurrent',
          totalAmount: amount.toString(),
          costs: [amount.toString()],
          startDate: formatDateStr(dueDate),
          status: isPaid ? 'paid' : 'draft',
          createdBy: ADMIN_USER_ID,
          ...(attachment ?? {}),
        });
        billCount++;
      }
    }
    
    for (const billCat of BILL_CATEGORIES.slice(4)) {
      const dueDate = new Date(currentYear, Math.floor(Math.random() * 12), 15);
      const amount = randomAmount(2000, 15000);
      const attachment = await maybeSeedBillAttachment(building.id, billCat.category, true);

      await db.insert(schema.bills).values({
        buildingId: building.id,
        billNumber: `BILL-${currentYear}-${String(billCounter++).padStart(5, '0')}`,
        title: `${billCat.nameFr} - Annuel ${currentYear}`,
        category: billCat.category,
        paymentType: 'unique',
        totalAmount: amount.toString(),
        costs: [amount.toString()],
        startDate: formatDateStr(dueDate),
        status: dueDate < new Date() ? 'paid' : 'draft',
        createdBy: ADMIN_USER_ID,
        ...(attachment ?? {}),
      });
      billCount++;
    }
    
    console.log(`  ✓ Created ${billCount} bills for ${building.name}`);
  }
  
  console.log('✅ Bill creation complete!\n');
}

type SeedVendorDocument = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};
type SubmissionVendorProjectType =
  (typeof schema.projectTypeEnum.enumValues)[number];

async function seedVendorSubmissionsForProject(
  projectId: string,
  projectType: SubmissionVendorProjectType,
): Promise<void> {
  // Add 2 vendor submissions per project; attach a demo PDF to the first one
  // so the "download vendor document" flow has real bytes behind it. The
  // download handler recursively searches uploads/ for files whose name
  // contains the document id, so we write the PDF to
  // uploads/maintenance/seed/<docId>_placeholder.pdf.
  const vendors = [
    { vendorName: 'Construction Tremblay Inc.', attach: true },
    { vendorName: 'Rénovations Bélanger Ltée', attach: false },
  ];
  for (const vendor of vendors) {
    let documentsJson: SeedVendorDocument[] | null = null;
    if (vendor.attach) {
      const docId = randomUUID();
      const fileName = `soumission_${Date.now()}.pdf`;
      const absolutePath = path.join(
        process.cwd(),
        'uploads',
        'maintenance',
        'seed',
        `${docId}_${fileName}`,
      );
      await writeSeededPlaceholderToLocalPath(absolutePath);
      documentsJson = [
        {
          id: docId,
          name: fileName,
          size: getSeededPlaceholderPdfSize(),
          mimeType: 'application/pdf',
          uploadedAt: new Date().toISOString(),
        },
      ];
    }
    await db.insert(schema.submissionVendors).values({
      projectId,
      vendorName: vendor.vendorName,
      price: randomAmount(3000, 80000).toString(),
      projectType,
      documents: documentsJson,
      isSelected: false,
    });
  }
}

const BUG_TEMPLATES_FR = [
  { title: 'Le tableau de bord ne charge pas', description: 'Le tableau de bord reste bloqué sur "Chargement..." après la connexion.', category: 'ui_ux' as const, page: '/dashboard', priority: 'high' as const, status: 'new' as const },
  { title: 'Erreur 500 sur la page des factures', description: 'Cliquer sur "Factures" affiche une page blanche avec une erreur 500.', category: 'functionality' as const, page: '/bills', priority: 'critical' as const, status: 'acknowledged' as const },
  { title: 'Notifications en retard', description: 'Les courriels de rappel de paiement arrivent plusieurs heures après l\'échéance.', category: 'functionality' as const, page: '/notifications', priority: 'medium' as const, status: 'in_progress' as const },
  { title: 'Filtre de recherche cassé', description: 'Le filtre par bâtiment dans la liste des demandes ne retourne aucun résultat.', category: 'ui_ux' as const, page: '/demands', priority: 'medium' as const, status: 'new' as const },
  { title: 'PDF téléchargé corrompu', description: 'Les PDF téléchargés depuis le module documents sont parfois illisibles.', category: 'data' as const, page: '/documents', priority: 'high' as const, status: 'resolved' as const },
  { title: 'Session expire trop tôt', description: 'Je suis déconnecté après 5 minutes d\'inactivité alors que le paramètre est à 30 minutes.', category: 'security' as const, page: '/settings', priority: 'low' as const, status: 'new' as const },
];

type FeatureRequestCategory = (typeof schema.featureRequestCategoryEnum.enumValues)[number];
type FeatureRequestStatus = (typeof schema.featureRequestStatusEnum.enumValues)[number];
type FeatureTemplate = {
  title: string;
  description: string;
  need: string;
  category: FeatureRequestCategory;
  page: string;
  status: FeatureRequestStatus;
};

const FEATURE_TEMPLATES_FR: FeatureTemplate[] = [
  { title: 'Export Excel des factures', description: 'Pouvoir exporter la liste filtrée de factures en Excel.', need: 'Les gestionnaires veulent intégrer les données à leur comptabilité externe.', category: 'financial_management', page: '/bills', status: 'submitted' },
  { title: 'Rappels de paiement automatiques', description: 'Envoyer un courriel automatique aux résidents 3 jours avant une échéance.', need: 'Réduire les retards de paiement.', category: 'communication', page: '/notifications', status: 'under_review' },
  { title: 'Mode sombre', description: 'Ajouter un thème sombre à toute l\'application.', need: 'Confort visuel pour les utilisateurs travaillant le soir.', category: 'other', page: '/settings', status: 'planned' },
  { title: 'Réservations récurrentes', description: 'Permettre de réserver un espace commun chaque semaine à la même heure.', need: 'Simplifier les activités régulières comme les cours de yoga.', category: 'property_management', page: '/bookings', status: 'in_progress' },
  { title: 'Application mobile', description: 'Application iOS / Android avec notifications push.', need: 'Les résidents veulent gérer leur immeuble depuis leur téléphone.', category: 'mobile_app', page: '/dashboard', status: 'submitted' },
  { title: 'Historique des modifications', description: 'Voir qui a modifié une facture ou une demande et quand.', need: 'Traçabilité et audit pour les gestionnaires.', category: 'reports', page: '/bills', status: 'submitted' },
];

async function seedBugOrFeatureAttachment(
  type: 'bugs' | 'features',
  ownerId: string,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const uuid = randomUUID();
  const fileName = `${type}_${uuid}.pdf`;
  const filePath = `/objects/${type}/${uuid}_${fileName}`;
  // Bug / feature attachments are owned by the reporter and visible publicly
  // to match the runtime expectation that any authenticated user can see
  // these files once they exist. canAccessObject returns true for
  // visibility=public, which avoids 403s in the demo.
  await uploadSeededDocumentPlaceholder(filePath, {
    owner: ownerId,
    visibility: 'public',
  });
  return { filePath, fileName, fileSize: getSeededPlaceholderPdfSize() };
}

async function createBugsAndFeatureRequests() {
  console.log('🐛 Creating bugs and feature requests...\n');

  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.isActive, true))
    .limit(20);
  if (users.length === 0) {
    console.log('  ⚠ No users found — skipping bugs and feature requests.');
    return;
  }

  await db.delete(schema.bugs);
  await db.delete(schema.featureRequests);

  let bugCount = 0;
  for (let i = 0; i < BUG_TEMPLATES_FR.length; i++) {
    const tpl = BUG_TEMPLATES_FR[i];
    const creator = users[i % users.length];
    const attachment = i % 3 === 0 ? await seedBugOrFeatureAttachment('bugs', creator.id) : null;
    await db.insert(schema.bugs).values({
      createdBy: creator.id,
      title: tpl.title,
      description: tpl.description,
      category: tpl.category,
      page: tpl.page,
      priority: tpl.priority,
      status: tpl.status,
      ...(attachment ?? {}),
    });
    bugCount++;
  }
  console.log(`  ✓ Created ${bugCount} bug reports`);

  let featureCount = 0;
  for (let i = 0; i < FEATURE_TEMPLATES_FR.length; i++) {
    const tpl = FEATURE_TEMPLATES_FR[i];
    const creator = users[i % users.length];
    const attachment = i % 3 === 0 ? await seedBugOrFeatureAttachment('features', creator.id) : null;
    await db.insert(schema.featureRequests).values({
      createdBy: creator.id,
      title: tpl.title,
      description: tpl.description,
      need: tpl.need,
      category: tpl.category,
      page: tpl.page,
      status: tpl.status,
      ...(attachment ?? {}),
    });
    featureCount++;
  }
  console.log(`  ✓ Created ${featureCount} feature requests`);
  console.log('✅ Bugs and feature requests complete!\n');
}

async function createInventoryAndProjects() {
  console.log('🔧 Creating inventory elements and maintenance projects...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  await db.delete(schema.buildingElements)
    .where(inArray(schema.buildingElements.buildingId, buildings.map(b => b.id)));
  
  await db.delete(schema.maintenanceProjects)
    .where(inArray(schema.maintenanceProjects.buildingId, buildings.map(b => b.id)));
  
  for (const building of buildings) {
    for (const element of INVENTORY_ELEMENTS) {
      const installYear = 2000 + Math.floor(Math.random() * 20);
      
      await db.insert(schema.buildingElements).values({
        buildingId: building.id,
        name: element.nameFr,
        uniformatCode: element.category,
        description: `${element.nameFr} du bâtiment ${building.name}`,
        location: 'Zones communes',
        installationDate: formatDateStr(new Date(installYear, 0, 1)),
        expectedLifespan: element.lifespan,
        condition: ['excellent', 'good', 'fair', 'poor'][Math.floor(Math.random() * 4)] as any,
        lastInspectionDate: formatDateStr(randomDate(new Date('2024-01-01'), new Date())),
      });
    }
    console.log(`  ✓ Created ${INVENTORY_ELEMENTS.length} inventory elements for ${building.name}`);
    
    const projectCount = 2 + Math.floor(Math.random() * 3);
    let projectCounter = 1;
    
    for (let i = 0; i < projectCount; i++) {
      const projectType = PROJECT_TYPES[Math.floor(Math.random() * PROJECT_TYPES.length)];
      const status = projectType.statusOptions[Math.floor(Math.random() * projectType.statusOptions.length)];
      const element = INVENTORY_ELEMENTS[Math.floor(Math.random() * INVENTORY_ELEMENTS.length)];
      
      const startDate = randomDate(new Date('2024-06-01'), new Date('2026-06-01'));
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1 + Math.floor(Math.random() * 6));
      
      const projectNumber = `PROJ-${building.id.slice(0, 4).toUpperCase()}-${Date.now()}-${projectCounter++}`;
      
      const [insertedProject] = await db.insert(schema.maintenanceProjects).values({
        buildingId: building.id,
        createdBy: ADMIN_USER_ID,
        projectNumber: projectNumber,
        title: `${projectType.type === 'repair' ? 'Réparation' : projectType.type === 'replacement' ? 'Remplacement' : projectType.type === 'minor_rehab' ? 'Réhabilitation mineure' : 'Réhabilitation majeure'} - ${element.nameFr}`,
        type: projectType.type,
        status: status as any,
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
        estimatedCost: randomAmount(5000, 100000).toString(),
        actualCost: status === 'completed' ? randomAmount(5000, 100000).toString() : '0',
        plannedStartDate: formatDateStr(startDate),
        actualEndDate: status === 'completed' ? formatDateStr(endDate) : null,
        plannedEndDate: formatDateStr(endDate),
      }).returning({ id: schema.maintenanceProjects.id });

      await seedVendorSubmissionsForProject(insertedProject.id, projectType.type);
    }
    console.log(`  ✓ Created ${projectCount} maintenance projects for ${building.name}`);
  }
  
  console.log('✅ Inventory and projects creation complete!\n');
}

async function createBudgets() {
  console.log('📊 Creating budgets for buildings...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  await db.delete(schema.budgets)
    .where(inArray(schema.budgets.buildingId, buildings.map(b => b.id)));
  
  await db.delete(schema.monthlyBudgets)
    .where(inArray(schema.monthlyBudgets.buildingId, buildings.map(b => b.id)));
  
  const currentYear = new Date().getFullYear();
  
  for (const building of buildings) {
    for (let year = currentYear; year <= currentYear + 2; year++) {
      const annualBudget = randomAmount(50000, 200000);
      
      await db.insert(schema.budgets).values({
        buildingId: building.id,
        name: `Budget ${year} - ${building.name}`,
        category: 'operational',
        year: year,
        budgetedAmount: annualBudget.toString(),
      });
    }
    console.log(`  ✓ Created budgets for ${building.name} (${currentYear}-${currentYear + 2})`);
  }
  
  console.log('✅ Budget creation complete!\n');
}

async function createCommonSpaces() {
  console.log('🏊 Creating common spaces for buildings...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  const existingSpaces = await db
    .select({ id: schema.commonSpaces.id })
    .from(schema.commonSpaces)
    .where(inArray(schema.commonSpaces.buildingId, buildings.map(b => b.id)));
  
  if (existingSpaces.length > 0) {
    await db.delete(schema.bookings)
      .where(inArray(schema.bookings.commonSpaceId, existingSpaces.map(s => s.id)));
    console.log('  ✓ Deleted existing bookings');
    
    await db.delete(schema.commonSpaces)
      .where(inArray(schema.commonSpaces.buildingId, buildings.map(b => b.id)));
    console.log('  ✓ Deleted existing common spaces');
  }
  
  const createdSpaces: { id: string; buildingId: string; isReservable: boolean }[] = [];
  
  for (const building of buildings) {
    const spacesForBuilding = COMMON_SPACES.slice(0, 3 + Math.floor(Math.random() * 2));
    
    for (const spaceConfig of spacesForBuilding) {
      const result = await db.insert(schema.commonSpaces).values({
        name: spaceConfig.name,
        description: spaceConfig.description,
        buildingId: building.id,
        isReservable: spaceConfig.isReservable,
        capacity: spaceConfig.capacity,
        openingHours: spaceConfig.openingHours,
        availableDays: spaceConfig.availableDays,
        bookingRules: spaceConfig.bookingRules,
      }).returning({ id: schema.commonSpaces.id });
      
      if (result[0]) {
        createdSpaces.push({
          id: result[0].id,
          buildingId: building.id,
          isReservable: spaceConfig.isReservable,
        });
      }
    }
    console.log(`  ✓ Created ${spacesForBuilding.length} common spaces for ${building.name}`);
  }
  
  console.log('✅ Common spaces creation complete!\n');
  return createdSpaces;
}

async function createBookings(commonSpaces: { id: string; buildingId: string; isReservable: boolean }[]) {
  console.log('📅 Creating bookings for demo residents...\n');
  
  const reservableSpaces = commonSpaces.filter(s => s.isReservable);
  
  if (reservableSpaces.length === 0) {
    console.log('  ⚠ No reservable spaces found, skipping bookings');
    return;
  }
  
  const demoResidents = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, 'demo_resident'));
  
  if (demoResidents.length === 0) {
    console.log('  ⚠ No demo residents found, skipping bookings');
    return;
  }
  
  let bookingCount = 0;
  const now = new Date();
  
  for (const resident of demoResidents) {
    const numBookings = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numBookings; i++) {
      const space = reservableSpaces[Math.floor(Math.random() * reservableSpaces.length)];
      
      const daysFromNow = 1 + Math.floor(Math.random() * 29);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + daysFromNow);
      startDate.setHours(9 + Math.floor(Math.random() * 10), 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1 + Math.floor(Math.random() * 2));
      
      await db.insert(schema.bookings).values({
        commonSpaceId: space.id,
        userId: resident.id,
        startTime: startDate,
        endTime: endDate,
        status: 'confirmed',
      });
      bookingCount++;
    }
    console.log(`  ✓ Created ${numBookings} bookings for ${resident.firstName} ${resident.lastName}`);
  }
  
  console.log(`✅ Booking creation complete! (${bookingCount} total bookings)\n`);
}

const DEMAND_TEMPLATES = [
  { type: 'maintenance' as const, descFr: 'Fuite d\'eau dans la salle de bain nécessitant une intervention urgente' },
  { type: 'maintenance' as const, descFr: 'Problème de chauffage dans l\'appartement - température insuffisante' },
  { type: 'maintenance' as const, descFr: 'Porte de garage ne fonctionne pas correctement' },
  { type: 'complaint' as const, descFr: 'Bruit excessif provenant de l\'appartement voisin en soirée' },
  { type: 'complaint' as const, descFr: 'Problème de stationnement - véhicule non autorisé dans ma place' },
  { type: 'information' as const, descFr: 'Demande d\'information sur les règlements de la copropriété' },
  { type: 'information' as const, descFr: 'Question concernant les frais de condo et leur répartition' },
  { type: 'other' as const, descFr: 'Demande d\'autorisation pour installer une thermopompe' },
  { type: 'other' as const, descFr: 'Proposition d\'amélioration pour les espaces communs' },
];

const RESIDENCE_DOC_TYPES = [
  { type: 'lease_agreement', nameFr: 'Contrat de bail' },
  { type: 'inspection_report', nameFr: 'Rapport d\'inspection' },
  { type: 'welcome_package', nameFr: 'Dossier de bienvenue' },
];

const INCOME_TYPES = ['condo_fees', 'parking', 'interest', 'rental_income'];
const SPENDING_TYPES = ['maintenance', 'utilities', 'insurance', 'cleaning', 'administration', 'reserves'];

async function createDemands() {
  console.log('📝 Creating demands for demo residents...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  const demoUsers = await db
    .select()
    .from(schema.users)
    .where(sql`${schema.users.role} IN ('demo_manager', 'demo_resident', 'demo_tenant')`);
  
  const managers = demoUsers.filter(u => u.role === 'demo_manager');
  const residents = demoUsers.filter(u => u.role === 'demo_resident' || u.role === 'demo_tenant');
  
  const userResidenceLinks = await db
    .select()
    .from(schema.userResidences)
    .where(inArray(schema.userResidences.userId, residents.map(r => r.id)));
  
  const residences = await db
    .select()
    .from(schema.residences)
    .where(inArray(schema.residences.buildingId, buildings.map(b => b.id)));
  
  const existingDemands = await db.select({ id: schema.demands.id })
    .from(schema.demands)
    .where(inArray(schema.demands.buildingId, buildings.map(b => b.id)));
  
  if (existingDemands.length > 0) {
    await db.delete(schema.demandComments)
      .where(inArray(schema.demandComments.demandId, existingDemands.map(d => d.id)));
    await db.delete(schema.demands)
      .where(inArray(schema.demands.buildingId, buildings.map(b => b.id)));
  }
  
  const statuses: Array<'draft' | 'submitted' | 'under_review' | 'approved' | 'completed' | 'rejected'> = 
    ['draft', 'submitted', 'under_review', 'approved', 'completed', 'rejected'];
  
  let demandCount = 0;
  
  for (const resident of residents) {
    const userResidenceLink = userResidenceLinks.find(ur => ur.userId === resident.id);
    if (!userResidenceLink) {
      console.log(`  ⚠ No residence link for ${resident.firstName} ${resident.lastName}`);
      continue;
    }
    
    const residence = residences.find(r => r.id === userResidenceLink.residenceId);
    if (!residence) {
      console.log(`  ⚠ Residence not found for ${resident.firstName}`);
      continue;
    }
    
    const building = buildings.find(b => b.id === residence.buildingId);
    if (!building) continue;
    
    const numDemands = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numDemands; i++) {
      const template = DEMAND_TEMPLATES[i % DEMAND_TEMPLATES.length];
      const status = statuses[i % statuses.length];
      
      const isReviewed = ['approved', 'completed', 'rejected'].includes(status);
      const reviewer = isReviewed ? managers[Math.floor(Math.random() * managers.length)] : null;
      const createdAt = randomDate(new Date('2024-01-01'), new Date());
      const reviewedAt = isReviewed ? randomDate(createdAt, new Date()) : null;
      
      const demandAttachment = i % 3 === 0 ? await maybeSeedDemandAttachment() : null;
      await db.insert(schema.demands).values({
        submitterId: resident.id,
        type: template.type,
        description: template.descFr,
        buildingId: building.id,
        residenceId: residence.id,
        status: status,
        reviewedBy: reviewer?.id || null,
        reviewedAt: reviewedAt,
        createdAt: createdAt,
        ...(demandAttachment ?? {}),
      });
      demandCount++;
    }
    console.log(`  ✓ Created ${numDemands} demands for ${resident.firstName} ${resident.lastName}`);
  }
  
  console.log(`✅ Demand creation complete! (${demandCount} total demands)\n`);
}

async function createMonthlyBudgets() {
  console.log('📊 Creating monthly budgets for buildings...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  await db.delete(schema.monthlyBudgets)
    .where(inArray(schema.monthlyBudgets.buildingId, buildings.map(b => b.id)));
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  for (const building of buildings) {
    for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
      let year = currentYear;
      let month = currentMonth - monthsAgo;
      
      if (month <= 0) {
        month += 12;
        year -= 1;
      }
      
      const isPastMonth = monthsAgo > 0;
      
      const incomes = INCOME_TYPES.map(() => randomAmount(5000, 25000).toString());
      const spendings = SPENDING_TYPES.map(() => randomAmount(2000, 15000).toString());
      
      await db.insert(schema.monthlyBudgets).values({
        buildingId: building.id,
        year: year,
        month: month,
        incomeTypes: INCOME_TYPES,
        incomes: incomes,
        spendingTypes: SPENDING_TYPES,
        spendings: spendings,
        approved: isPastMonth,
        approvedBy: isPastMonth ? ADMIN_USER_ID : null,
        approvedDate: isPastMonth ? new Date(year, month - 1, 28) : null,
      });
    }
    console.log(`  ✓ Created 12 monthly budgets for ${building.name}`);
  }
  
  console.log('✅ Monthly budget creation complete!\n');
}

async function createResidenceDocuments() {
  console.log('📄 Creating residence documents for demo users...\n');
  
  const buildings = await db
    .select()
    .from(schema.buildings)
    .where(inArray(schema.buildings.organizationId, ORGS_TO_KEEP));
  
  const demoResidents = await db
    .select()
    .from(schema.users)
    .where(sql`${schema.users.role} IN ('demo_resident', 'demo_tenant')`);
  
  const userResidenceLinks = await db
    .select()
    .from(schema.userResidences)
    .where(inArray(schema.userResidences.userId, demoResidents.map(r => r.id)));
  
  const demoResidenceIds = userResidenceLinks.map(ur => ur.residenceId);
  
  const residences = await db
    .select()
    .from(schema.residences)
    .where(inArray(schema.residences.id, demoResidenceIds));
  
  if (residences.length > 0) {
    await db.delete(schema.documents)
      .where(and(
        inArray(schema.documents.residenceId, residences.map(r => r.id)),
        sql`${schema.documents.residenceId} IS NOT NULL`
      ));
  }
  
  let docCount = 0;
  
  for (const residence of residences) {
    const building = buildings.find(b => b.id === residence.buildingId);
    
    for (const docType of RESIDENCE_DOC_TYPES) {
      const filePath = `/objects/residences/${residence.id}/documents/${docType.type}_${Date.now()}.pdf`;
      await uploadSeededDocumentPlaceholder(filePath);
      await db.insert(schema.documents).values({
        name: `${docType.nameFr} - Unité ${residence.unitNumber}`,
        filePath,
        fileName: `${docType.type}.pdf`,
        fileSize: getSeededPlaceholderPdfSize(),
        mimeType: 'application/pdf',
        documentType: docType.type,
        buildingId: residence.buildingId,
        residenceId: residence.id,
        uploadedById: ADMIN_USER_ID,
        isVisibleToTenants: docType.type !== 'inspection_report',
      });
      docCount++;
    }
    console.log(`  ✓ Created ${RESIDENCE_DOC_TYPES.length} documents for Unit ${residence.unitNumber}`);
  }
  
  console.log(`✅ Residence document creation complete! (${docCount} total docs for ${residences.length} residences)\n`);
}

async function updateOrganizationNames() {
  console.log('🏢 Updating organization names...\n');
  
  await db.update(schema.organizations)
    .set({ name: 'Gestion Immobilière Québec' })
    .where(eq(schema.organizations.id, ORGS_TO_KEEP[0]));
  
  await db.update(schema.organizations)
    .set({ name: 'Syndicat des Copropriétaires du Centre-Ville' })
    .where(eq(schema.organizations.id, ORGS_TO_KEEP[1]));
  
  console.log('  ✓ Updated organization names');
  console.log('✅ Organization update complete!\n');
}

async function main() {
  console.log('🚀 Setting up Marketing Demo Environment\n');
  console.log('='.repeat(50) + '\n');
  
  try {
    await deleteOrphanedData();
    await skipPruneBuildings();
    await renameBuildings();
    await updateOrganizationNames();
    await skipUserCleanup();
    const userIds = await createDemoUsers();
    await linkUsersToOrgsAndBuildings(userIds);
    await createDocuments();
    await createBills();
    await createInventoryAndProjects();
    await createBudgets();
    const commonSpaces = await createCommonSpaces();
    await createBookings(commonSpaces);
    await createDemands();
    await createMonthlyBudgets();
    await createResidenceDocuments();
    await createBugsAndFeatureRequests();
    
    console.log('='.repeat(50));
    console.log('\n🎉 Marketing Demo Environment Setup Complete!\n');
    
    console.log('📋 Summary:');
    console.log('  - 2 organizations with French names');
    console.log('  - 6 buildings with Quebec addresses');
    console.log('  - 10 demo users with French names');
    console.log('  - Documents, bills, budgets, inventory, and projects');
    console.log('  - Common spaces and bookings for each building');
    console.log('  - Demands/complaints with various statuses');
    console.log('  - Monthly budget data for past 12 months');
    console.log('  - Residence documents (leases, inspections, welcome packages)');
    console.log('\n💡 Demo Login Credentials:');
    console.log('  Email: marie.tremblay@demo.koveo.ca (Manager)');
    console.log('  Email: sophie.bouchard@demo.koveo.ca (Resident)');
    console.log('  Password: demo123456');
    
  } catch (error) {
    console.error('❌ Error setting up demo environment:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
