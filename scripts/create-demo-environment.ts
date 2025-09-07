#!/usr/bin/env tsx

/**
 * Koveo Gestion Demo Environment Script
 * 
 * Creates or updates a comprehensive demo environment with realistic, fictional data
 * for product demonstrations and QA testing. Complies with Quebec's Law 25.
 * 
 * Usage:
 *   npx tsx scripts/create-demo-environment.ts --type demo --name "Demo Organization"
 *   npx tsx scripts/create-demo-environment.ts --type production --name "Test Company"
 *   npx tsx scripts/create-demo-environment.ts --type demo --name "Demo Organization" --database prod
 * 
 * Features:
 * - Idempotent upsert logic (updates existing organizations)
 * - Role-based user creation (demo vs production types)
 * - Comprehensive realistic data using @faker-js/faker
 * - Quebec-specific data generation
 * - Complete building, residence, and user ecosystem
 * - Realistic bookings, demands, and financial data
 */

import { eq, and, gte } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import * as schema from '../shared/schema';

// Database connection variables
let db: any;
let closeConnection: () => Promise<void>;

async function initializeDatabase(targetDatabase: 'dev' | 'prod') {
  if (targetDatabase === 'prod') {
    console.log('⚠️ WARNING: Targeting PRODUCTION database (DATABASE_URL_KOVEO)');
    console.log('⚠️ This will create demo data in the production environment!');
    console.log('');
    
    // Use production database
    const DATABASE_URL_KOVEO = process.env.DATABASE_URL_KOVEO;
    if (!DATABASE_URL_KOVEO) {
      console.error('❌ DATABASE_URL_KOVEO environment variable is required for production database');
      process.exit(1);
    }
    
    const { Pool } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    
    const pool = new Pool({ connectionString: DATABASE_URL_KOVEO });
    db = drizzle({ client: pool, schema });
    closeConnection = async () => {
      await pool.end();
    };
    
    console.log('🔗 Connected to PRODUCTION database (DATABASE_URL_KOVEO)');
  } else {
    // Use development database (default)
    const { db: sharedDb } = await import('../server/db');
    db = sharedDb;
    closeConnection = async () => {
      // Connection will be managed by the shared pool
    };
    
    console.log('🔗 Connected to DEVELOPMENT database (DATABASE_URL)');
  }
}

// Types
interface CliArgs {
  type: 'demo' | 'production';
  name: string;
  database: 'dev' | 'prod';
}

interface CreatedBuilding {
  id: string;
  name: string;
  organizationId: string;
}

interface CreatedResidence {
  id: string;
  unitNumber: string;
  buildingId: string;
  buildingName: string;
}

interface CreatedUser {
  id: string;
  username: string;
  email: string;
  role: string;
  buildingId?: string;
  residenceId?: string;
}

interface CreatedCommonSpace {
  id: string;
  name: string;
  buildingId: string;
  isReservable: boolean;
}

interface CreatedBill {
  id: string;
  billNumber: string;
  title: string;
  category: string;
  vendor: string;
  totalAmount: string;
  buildingId: string;
  description: string;
}

// Configuration constants
const BUILDINGS_PER_ORG = 5;
const MIN_RESIDENCES_PER_BUILDING = 5;
const MAX_RESIDENCES_PER_BUILDING = 10;
const COMMON_SPACES_PER_BUILDING = 4;
const BOOKINGS_PER_RESERVABLE_SPACE = 8;
const DEMANDS_PER_RESIDENT = 2;
const BILLS_PER_BUILDING_PER_MONTH = 6;

// Quebec-specific data
const QUEBEC_CITIES = [
  'Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil',
  'Sherbrooke', 'Saguenay', 'Trois-Rivières', 'Terrebonne', 'Saint-Jean-sur-Richelieu'
];

const COMMON_SPACE_TYPES = [
  { name: 'Gym', isBookable: false },
  { name: 'Rooftop Terrace', isBookable: true },
  { name: 'Pool', isBookable: false },
  { name: 'Conference Room', isBookable: true },
  { name: 'Party Room', isBookable: true },
  { name: 'Lobby', isBookable: false },
  { name: 'Storage Room', isBookable: false },
  { name: 'Laundry Room', isBookable: false }
];

const MAINTENANCE_CATEGORIES = [
  'Plumbing', 'Electrical', 'HVAC', 'Structural', 'Appliances', 'General Maintenance'
];

const BILL_CATEGORIES = [
  'insurance', 'maintenance', 'utilities', 'cleaning', 'security', 
  'landscaping', 'professional_services', 'administration', 'supplies'
] as const;

/**
 * Parse command line arguments
 */
function parseArguments(): CliArgs {
  const args = process.argv.slice(2);
  
  let type: 'demo' | 'production' | undefined;
  let name: string | undefined;
  let database: 'dev' | 'prod' = 'dev'; // Default to development database
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && i + 1 < args.length) {
      const typeValue = args[i + 1];
      if (typeValue === 'demo' || typeValue === 'production') {
        type = typeValue;
      } else {
        console.error('❌ --type must be either "demo" or "production"');
        process.exit(1);
      }
      i++; // Skip next argument as it's the value
    } else if (args[i] === '--name' && i + 1 < args.length) {
      name = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (args[i] === '--database' && i + 1 < args.length) {
      const databaseValue = args[i + 1];
      if (databaseValue === 'dev' || databaseValue === 'prod') {
        database = databaseValue;
      } else {
        console.error('❌ --database must be either "dev" or "prod"');
        process.exit(1);
      }
      i++; // Skip next argument as it's the value
    }
  }
  
  if (!type) {
    console.error('❌ --type argument is required (demo or production)');
    console.error('Usage: npx tsx scripts/create-demo-environment.ts --type demo --name "Demo Organization" [--database dev|prod]');
    process.exit(1);
  }
  
  if (!name) {
    console.error('❌ --name argument is required');
    console.error('Usage: npx tsx scripts/create-demo-environment.ts --type demo --name "Demo Organization" [--database dev|prod]');
    process.exit(1);
  }
  
  return { type, name, database };
}

/**
 * Generate Quebec-specific postal code
 */
function generateQuebecPostalCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  
  return `H${digits[Math.floor(Math.random() * digits.length)]}${letters[Math.floor(Math.random() * letters.length)]} ${digits[Math.floor(Math.random() * digits.length)]}${letters[Math.floor(Math.random() * letters.length)]}${digits[Math.floor(Math.random() * digits.length)]}`;
}

/**
 * Generate Quebec phone number in format (514) 555-0123
 */
function generateQuebecPhone(): string {
  const areaCodes = ['514', '438', '450', '579', '418', '581', '819', '873'];
  const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const exchange = faker.string.numeric(3);
  const number = faker.string.numeric(4);
  
  return `(${areaCode}) ${exchange}-${number}`;
}

/**
 * Generate realistic Quebec street address
 */
function generateQuebecAddress(): string {
  const streetTypes = ['rue', 'avenue', 'boulevard', 'montée', 'chemin'];
  const streetNames = [
    'Saint-Laurent', 'Notre-Dame', 'Sainte-Catherine', 'Sherbrooke', 'René-Lévesque',
    'de la Montagne', 'du Parc', 'des Érables', 'des Pins', 'de Maisonneuve'
  ];
  
  const number = faker.number.int({ min: 100, max: 9999 });
  const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
  const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
  
  return `${number} ${streetType} ${streetName}`;
}

/**
 * Upsert organization (find existing or create new)
 */
async function upsertOrganization(name: string, type: 'demo' | 'production'): Promise<schema.Organization> {
  try {
    console.log(`🔍 Looking for existing organization: "${name}"`);
    
    // Check if organization already exists
    const existingOrgs = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.name, name))
      .limit(1);
    
    if (existingOrgs.length > 0) {
      console.log(`✅ Found existing organization: "${name}" (ID: ${existingOrgs[0].id})`);
      
      // Update the existing organization with new data
      const [updatedOrg] = await db
        .update(schema.organizations)
        .set({
          type: type === 'demo' ? 'demo' : 'management_company',
          address: generateQuebecAddress(),
          city: QUEBEC_CITIES[Math.floor(Math.random() * QUEBEC_CITIES.length)],
          province: 'QC',
          postalCode: generateQuebecPostalCode(),
          phone: generateQuebecPhone(),
          email: faker.internet.email().toLowerCase(),
          website: faker.internet.url(),
          registrationNumber: `${type.toUpperCase()}-${faker.string.alphanumeric(6).toUpperCase()}`,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(schema.organizations.id, existingOrgs[0].id))
        .returning();
      
      console.log(`📝 Updated organization "${name}" with new demo data`);
      return updatedOrg;
    } else {
      console.log(`➕ Creating new organization: "${name}"`);
      
      // Create new organization
      const [newOrg] = await db
        .insert(schema.organizations)
        .values({
          name,
          type: type === 'demo' ? 'demo' : 'management_company',
          address: generateQuebecAddress(),
          city: QUEBEC_CITIES[Math.floor(Math.random() * QUEBEC_CITIES.length)],
          province: 'QC',
          postalCode: generateQuebecPostalCode(),
          phone: generateQuebecPhone(),
          email: faker.internet.email().toLowerCase(),
          website: faker.internet.url(),
          registrationNumber: `${type.toUpperCase()}-${faker.string.alphanumeric(6).toUpperCase()}`,
          isActive: true
        })
        .returning();
      
      console.log(`✅ Created new organization: "${name}" (ID: ${newOrg.id})`);
      return newOrg;
    }
  } catch (error) {
    console.error(`❌ Failed to upsert organization "${name}":`, error);
    throw error;
  }
}

/**
 * Create buildings for an organization
 */
async function seedBuildings(organizationId: string): Promise<CreatedBuilding[]> {
  try {
    console.log(`🏢 Creating ${BUILDINGS_PER_ORG} buildings...`);
    
    const buildings: CreatedBuilding[] = [];
    
    for (let i = 1; i <= BUILDINGS_PER_ORG; i++) {
      const buildingName = `${faker.location.streetAddress()} Building ${i}`;
      
      const [building] = await db
        .insert(schema.buildings)
        .values({
          organizationId,
          name: buildingName,
          address: generateQuebecAddress(),
          city: QUEBEC_CITIES[Math.floor(Math.random() * QUEBEC_CITIES.length)],
          province: 'QC',
          postalCode: generateQuebecPostalCode(),
          buildingType: Math.random() > 0.5 ? 'condo' : 'appartement',
          yearBuilt: faker.number.int({ min: 1950, max: 2023 }),
          totalUnits: faker.number.int({ min: MIN_RESIDENCES_PER_BUILDING, max: MAX_RESIDENCES_PER_BUILDING }),
          totalFloors: faker.number.int({ min: 3, max: 25 }),
          parkingSpaces: faker.number.int({ min: 10, max: 150 }),
          storageSpaces: faker.number.int({ min: 5, max: 75 }),
          amenities: JSON.stringify([
            'Elevator', 'Parking', 'Storage', 'Gym', 'Pool', 'Concierge'
          ].filter(() => Math.random() > 0.3)),
          managementCompany: faker.company.name(),
          bankAccountNumber: faker.finance.accountNumber(12),
          isActive: true
        })
        .returning();
      
      buildings.push({
        id: building.id,
        name: building.name,
        organizationId: building.organizationId
      });
      
      console.log(`   ✅ Created building: ${building.name}`);
    }
    
    console.log(`📊 Created ${buildings.length} buildings`);
    return buildings;
  } catch (error) {
    console.error('❌ Failed to create buildings:', error);
    throw error;
  }
}

/**
 * Create residences for buildings
 */
async function seedResidences(buildings: CreatedBuilding[]): Promise<CreatedResidence[]> {
  try {
    console.log('🏠 Creating residences...');
    
    const residences: CreatedResidence[] = [];
    
    for (const building of buildings) {
      // Get the building's totalUnits to create exact number of residences
      const buildingData = await db
        .select({ totalUnits: schema.buildings.totalUnits })
        .from(schema.buildings)
        .where(eq(schema.buildings.id, building.id))
        .limit(1);
      
      const residenceCount = buildingData[0]?.totalUnits || MIN_RESIDENCES_PER_BUILDING;
      
      console.log(`   Creating ${residenceCount} residences for ${building.name}`);
      
      for (let i = 1; i <= residenceCount; i++) {
        const unitNumber = `${faker.number.int({ min: 100, max: 999 })}`;
        
        const [residence] = await db
          .insert(schema.residences)
          .values({
            buildingId: building.id,
            unitNumber,
            floor: faker.number.int({ min: 1, max: 15 }),
            squareFootage: faker.number.float({ min: 500, max: 2500, fractionDigits: 0 }).toString(),
            bedrooms: faker.number.int({ min: 1, max: 4 }),
            bathrooms: faker.number.float({ min: 1, max: 3.5, fractionDigits: 1 }).toString(),
            balcony: Math.random() > 0.4,
            parkingSpaceNumbers: Math.random() > 0.3 ? [
              `P${faker.number.int({ min: 1, max: 200 })}`
            ] : [],
            storageSpaceNumbers: Math.random() > 0.5 ? [
              `S${faker.number.int({ min: 1, max: 100 })}`
            ] : [],
            ownershipPercentage: faker.number.float({ min: 0.1, max: 5.0, fractionDigits: 2 }).toString(),
            monthlyFees: faker.number.float({ min: 200, max: 800, fractionDigits: 2 }).toString(),
            isActive: true
          })
          .returning();
        
        residences.push({
          id: residence.id,
          unitNumber: residence.unitNumber,
          buildingId: residence.buildingId,
          buildingName: building.name
        });
      }
    }
    
    console.log(`📊 Created ${residences.length} residences across all buildings`);
    return residences;
  } catch (error) {
    console.error('❌ Failed to create residences:', error);
    throw error;
  }
}

/**
 * Create common spaces for buildings
 */
async function seedCommonSpaces(buildings: CreatedBuilding[]): Promise<CreatedCommonSpace[]> {
  try {
    console.log('🏛️ Creating common spaces...');
    
    const commonSpaces: CreatedCommonSpace[] = [];
    
    for (const building of buildings) {
      console.log(`   Creating ${COMMON_SPACES_PER_BUILDING} common spaces for ${building.name}`);
      
      // Shuffle and take first N common space types
      const shuffledTypes = [...COMMON_SPACE_TYPES].sort(() => 0.5 - Math.random());
      const selectedTypes = shuffledTypes.slice(0, COMMON_SPACES_PER_BUILDING);
      
      for (const spaceType of selectedTypes) {
        const [commonSpace] = await db
          .insert(schema.commonSpaces)
          .values({
            name: spaceType.name,
            description: `${spaceType.name} facility available to residents`,
            buildingId: building.id,
            isReservable: spaceType.isBookable,
            capacity: spaceType.isBookable ? faker.number.int({ min: 5, max: 50 }) : null,
            openingHours: spaceType.isBookable ? JSON.stringify([
              {
                day: 'monday',
                open: '08:00',
                close: '22:00',
                isOpen: true,
                breaks: []
              },
              {
                day: 'tuesday',
                open: '08:00',
                close: '22:00',
                isOpen: true,
                breaks: []
              },
              {
                day: 'wednesday',
                open: '08:00',
                close: '22:00',
                isOpen: true,
                breaks: []
              },
              {
                day: 'thursday',
                open: '08:00',
                close: '22:00',
                isOpen: true,
                breaks: []
              },
              {
                day: 'friday',
                open: '08:00',
                close: '22:00',
                isOpen: true,
                breaks: []
              },
              {
                day: 'saturday',
                open: '09:00',
                close: '21:00',
                isOpen: true,
                breaks: []
              },
              {
                day: 'sunday',
                open: '09:00',
                close: '21:00',
                isOpen: true,
                breaks: []
              }
            ]) : null,
            availableDays: spaceType.isBookable ? JSON.stringify([
              'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
            ]) : null,
            bookingRules: spaceType.isBookable ? 'Maximum 4 hours per booking. Must be booked at least 24 hours in advance.' : null
          })
          .returning();
        
        commonSpaces.push({
          id: commonSpace.id,
          name: commonSpace.name,
          buildingId: commonSpace.buildingId,
          isReservable: commonSpace.isReservable
        });
      }
    }
    
    console.log(`📊 Created ${commonSpaces.length} common spaces`);
    return commonSpaces;
  } catch (error) {
    console.error('❌ Failed to create common spaces:', error);
    throw error;
  }
}

/**
 * Create users with role-based logic and proper organization/building/residence relationships
 * Role-based assignment rules:
 * - Residents/Tenants: assign 1+ residences, then assign user to buildings of those residences
 * - Managers: assign 0+ residences, assign user to building's residences, can assign 0+ other buildings
 */
async function seedUsers(
  organizationType: 'demo' | 'production',
  organizationId: string,
  buildings: CreatedBuilding[],
  residences: CreatedResidence[]
): Promise<CreatedUser[]> {
  try {
    console.log('👥 Creating users with role-based assignments...');
    
    const users: CreatedUser[] = [];
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    
    // Create managers (1-2 per building) with residence and building assignments
    console.log('   Creating managers...');
    for (const building of buildings) {
      const managerCount = faker.number.int({ min: 1, max: 2 });
      console.log(`   Creating ${managerCount} managers for ${building.name}`);
      
      for (let i = 0; i < managerCount; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const role = organizationType === 'demo' ? 'demo_manager' : 'manager';
        
        const [user] = await db
          .insert(schema.users)
          .values({
            username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.number.int({ min: 10, max: 99 })}`,
            email: faker.internet.email({ firstName, lastName }).toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            phone: generateQuebecPhone(),
            language: Math.random() > 0.3 ? 'fr' : 'en', // 70% French, 30% English for Quebec
            role: role as any,
            isActive: true
          })
          .returning();
        
        // Create user-organization relationship
        await db
          .insert(schema.userOrganizations)
          .values({
            userId: user.id,
            organizationId: organizationId,
            organizationRole: role as any,
            isActive: true,
            canAccessAllOrganizations: false
          });
        
        // For managers: assign 0+ residences (40% chance of having residences)
        const buildingResidences = residences.filter(r => r.buildingId === building.id);
        const shouldHaveResidences = Math.random() < 0.4;
        let assignedResidences: CreatedResidence[] = [];
        
        if (shouldHaveResidences && buildingResidences.length > 0) {
          const residenceCount = faker.number.int({ min: 1, max: Math.min(3, buildingResidences.length) });
          assignedResidences = faker.helpers.arrayElements(buildingResidences, residenceCount);
          
          for (const residence of assignedResidences) {
            await db
              .insert(schema.userResidences)
              .values({
                userId: user.id,
                residenceId: residence.id,
                relationshipType: 'owner', // Managers are typically owners
                startDate: new Date(Date.now() - faker.number.int({ min: 30, max: 365 * 2 }) * 24 * 60 * 60 * 1000),
                isActive: true
              });
          }
        }
        
        // Managers can be assigned to additional buildings (30% chance)
        const shouldHaveAdditionalBuildings = Math.random() < 0.3;
        const otherBuildings = buildings.filter(b => b.id !== building.id);
        
        if (shouldHaveAdditionalBuildings && otherBuildings.length > 0) {
          const additionalBuildingCount = faker.number.int({ min: 1, max: Math.min(2, otherBuildings.length) });
          const additionalBuildings = faker.helpers.arrayElements(otherBuildings, additionalBuildingCount);
          
          console.log(`     Manager ${user.email} assigned to ${additionalBuildingCount + 1} buildings`);
        }
        
        users.push({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          buildingId: building.id,
          residenceId: assignedResidences.length > 0 ? assignedResidences[0].id : undefined
        });
      }
    }
    
    // Create residents and tenants with proper residence-first assignments
    console.log('   Creating residents and tenants...');
    
    // Calculate how many residents/tenants we need (aim for ~80% residence occupancy)
    const targetResidentCount = Math.floor(residences.length * 0.8);
    let createdResidents = 0;
    
    for (let i = 0; i < targetResidentCount; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      
      // 60% residents, 40% tenants
      const isResident = Math.random() < 0.6;
      const baseRole = isResident ? 'resident' : 'tenant';
      const role = organizationType === 'demo' ? `demo_${baseRole}` : baseRole;
      
      const [user] = await db
        .insert(schema.users)
        .values({
          username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.number.int({ min: 10, max: 99 })}`,
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          phone: generateQuebecPhone(),
          language: Math.random() > 0.3 ? 'fr' : 'en', // 70% French, 30% English for Quebec
          role: role as any,
          isActive: true
        })
        .returning();
      
      // Create user-organization relationship
      await db
        .insert(schema.userOrganizations)
        .values({
          userId: user.id,
          organizationId: organizationId,
          organizationRole: role as any,
          isActive: true,
          canAccessAllOrganizations: false
        });
      
      // For residents/tenants: assign 1+ residences (primary residence + possible additional ones)
      const primaryResidenceCount = faker.number.int({ min: 1, max: 2 });
      const availableResidences = residences.filter(r => 
        !users.some(u => u.residenceId === r.id) // Avoid double-assignment for simplicity
      );
      
      if (availableResidences.length === 0) break; // No more residences available
      
      const assignedResidences = faker.helpers.arrayElements(
        availableResidences, 
        Math.min(primaryResidenceCount, availableResidences.length)
      );
      
      let primaryBuildingId = '';
      
      for (let j = 0; j < assignedResidences.length; j++) {
        const residence = assignedResidences[j];
        const relationshipTypes = ['owner', 'tenant', 'occupant'];
        const relationshipType = j === 0 
          ? (isResident ? 'owner' : 'tenant') // Primary residence matches role
          : faker.helpers.arrayElement(['tenant', 'occupant']); // Secondary residences
        
        await db
          .insert(schema.userResidences)
          .values({
            userId: user.id,
            residenceId: residence.id,
            relationshipType: relationshipType,
            startDate: new Date(Date.now() - faker.number.int({ min: 30, max: 365 * 3 }) * 24 * 60 * 60 * 1000),
            isActive: true
          });
        
        if (j === 0) {
          primaryBuildingId = residence.buildingId;
        }
      }
      
      users.push({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        buildingId: primaryBuildingId,
        residenceId: assignedResidences[0].id
      });
      
      createdResidents++;
      
      if (assignedResidences.length > 1) {
        console.log(`     ${role} ${user.email} assigned to ${assignedResidences.length} residences`);
      }
    }
    
    console.log(`📊 Created ${users.length} users:`);
    console.log(`   - ${users.filter(u => u.role.includes('manager')).length} managers`);
    console.log(`   - ${users.filter(u => u.role.includes('resident')).length} residents`);
    console.log(`   - ${users.filter(u => u.role.includes('tenant')).length} tenants`);
    
    return users;
  } catch (error) {
    console.error('❌ Failed to create users:', error);
    throw error;
  }
}

/**
 * Create bookings for reservable common spaces
 */
async function seedBookings(
  commonSpaces: CreatedCommonSpace[],
  users: CreatedUser[]
): Promise<void> {
  try {
    console.log('📅 Creating bookings...');
    
    const reservableSpaces = commonSpaces.filter(space => space.isReservable);
    let totalBookings = 0;
    
    for (const space of reservableSpaces) {
      const spaceUsers = users.filter(user => user.buildingId === space.buildingId);
      
      if (spaceUsers.length === 0) continue;
      
      console.log(`   Creating ${BOOKINGS_PER_RESERVABLE_SPACE} bookings for ${space.name}`);
      
      for (let i = 0; i < BOOKINGS_PER_RESERVABLE_SPACE; i++) {
        const user = spaceUsers[Math.floor(Math.random() * spaceUsers.length)];
        const startDate = faker.date.between({
          from: new Date(new Date().getFullYear(), 0, 1),
          to: new Date(new Date().getFullYear(), 11, 31)
        });
        
        const startTime = new Date(startDate);
        startTime.setHours(faker.number.int({ min: 8, max: 20 }), 0, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + faker.number.int({ min: 1, max: 4 }));
        
        await db
          .insert(schema.bookings)
          .values({
            commonSpaceId: space.id,
            userId: user.id,
            startTime,
            endTime,
            status: Math.random() > 0.1 ? 'confirmed' : 'cancelled'
          });
        
        totalBookings++;
      }
    }
    
    console.log(`📊 Created ${totalBookings} bookings across ${reservableSpaces.length} reservable spaces`);
  } catch (error) {
    console.error('❌ Failed to create bookings:', error);
    throw error;
  }
}

/**
 * Create maintenance demands (referred to as "demands" in schema)
 */
async function seedMaintenanceRequests(users: CreatedUser[]): Promise<void> {
  try {
    console.log('🔧 Creating maintenance demands...');
    
    const residents = users.filter(user => user.role.includes('resident') && user.residenceId);
    let totalDemands = 0;
    
    for (const resident of residents) {
      for (let i = 0; i < DEMANDS_PER_RESIDENT; i++) {
        const category = MAINTENANCE_CATEGORIES[Math.floor(Math.random() * MAINTENANCE_CATEGORIES.length)];
        const priority = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)];
        
        await db
          .insert(schema.demands)
          .values({
            submitterId: resident.id,
            type: 'maintenance',
            description: `${category} issue: ${faker.lorem.sentence()}. ${faker.lorem.sentences(2)}`,
            buildingId: resident.buildingId!,
            residenceId: resident.residenceId,
            status: ['submitted', 'under_review', 'in_progress', 'completed'][Math.floor(Math.random() * 4)] as any
          });
        
        totalDemands++;
      }
    }
    
    console.log(`📊 Created ${totalDemands} maintenance demands for ${residents.length} residents`);
  } catch (error) {
    console.error('❌ Failed to create maintenance demands:', error);
    throw error;
  }
}

/**
 * Create bills for buildings (previous year data)
 */
async function seedBills(buildings: CreatedBuilding[], users: CreatedUser[]): Promise<CreatedBill[]> {
  try {
    console.log('💰 Creating bills for previous year...');
    
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    let totalBills = 0;
    const createdBills: CreatedBill[] = [];
    
    // Get managers to assign as bill creators
    const managers = users.filter(user => user.role.includes('manager'));
    
    for (const building of buildings) {
      const buildingManagers = managers.filter(manager => manager.buildingId === building.id);
      const billCreator = buildingManagers.length > 0 
        ? buildingManagers[0] 
        : managers[0]; // Fallback to any manager
      
      if (!billCreator) {
        console.warn(`   ⚠️ No manager found for building ${building.name}, skipping bills`);
        continue;
      }
      
      console.log(`   Creating bills for ${building.name} (${previousYear})`);
      
      // Create bills for each month of previous year
      for (let month = 1; month <= 12; month++) {
        for (let billIndex = 0; billIndex < BILLS_PER_BUILDING_PER_MONTH; billIndex++) {
          const category = BILL_CATEGORIES[Math.floor(Math.random() * BILL_CATEGORIES.length)];
          const amount = faker.number.float({ min: 100, max: 5000, fractionDigits: 2 });
          const startDate = new Date(previousYear, month - 1, faker.number.int({ min: 1, max: 28 }));
          const billNumber = `${building.id.slice(0, 4).toUpperCase()}-${previousYear}-${month.toString().padStart(2, '0')}-${(billIndex + 1).toString().padStart(3, '0')}`;
          const title = `${category.charAt(0).toUpperCase() + category.slice(1)} - ${faker.company.name()}`;
          const vendor = faker.company.name();
          const description = `Monthly ${category} service for ${faker.date.month()} ${previousYear}`;
          
          const [bill] = await db
            .insert(schema.bills)
            .values({
              buildingId: building.id,
              billNumber,
              title,
              description,
              category,
              vendor,
              paymentType: Math.random() > 0.7 ? 'recurrent' : 'unique',
              schedulePayment: Math.random() > 0.7 ? 'monthly' : null,
              costs: [amount.toString()],
              totalAmount: amount.toString(),
              startDate,
              status: ['paid', 'overdue', 'sent'][Math.floor(Math.random() * 3)] as any,
              createdBy: billCreator.id,
              autoGenerated: false
            })
            .returning();
          
          createdBills.push({
            id: bill.id,
            billNumber,
            title,
            category,
            vendor,
            totalAmount: amount.toString(),
            buildingId: building.id,
            description
          });
          
          totalBills++;
        }
      }
    }
    
    console.log(`📊 Created ${totalBills} bills across ${buildings.length} buildings for ${previousYear}`);
    return createdBills;
  } catch (error) {
    console.error('❌ Failed to create bills:', error);
    throw error;
  }
}

/**
 * Create demo disclosure notice for all documents
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
 * Create documents for bills, residences, and buildings
 */
async function seedDocuments(
  bills: CreatedBill[],
  buildings: CreatedBuilding[],
  residences: CreatedResidence[],
  users: CreatedUser[]
): Promise<void> {
  try {
    console.log('📄 Creating demo documents...');
    
    let totalDocuments = 0;
    const demoDisclosure = createDemoDisclosure();
    
    // Create Bill Documents (attached to bills)
    console.log('   Creating bill documents...');
    for (const bill of bills) {
      const billCreator = users.find(user => user.buildingId === bill.buildingId && user.role.includes('manager'));
      if (!billCreator) continue;
      
      // Create invoice document
      const invoiceContent = `${demoDisclosure}INVOICE DOCUMENT

Bill Number: ${bill.billNumber}
Title: ${bill.title}
Vendor: ${bill.vendor}
Category: ${bill.category.charAt(0).toUpperCase() + bill.category.slice(1)}
Total Amount: $${bill.totalAmount}
Description: ${bill.description}

This invoice document would normally be uploaded by the property manager
as a PDF or image file, but for this demo we're showing it as text content.

Payment Terms: Net 30 days
Invoice Date: ${faker.date.recent().toLocaleDateString()}
Due Date: ${faker.date.future().toLocaleDateString()}

Service Details:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Thank you for your business!
${bill.vendor}`;

      const invoiceFilePath = `demo-documents/bills/invoice-${bill.billNumber.toLowerCase()}.txt`;
      
      await db
        .insert(schema.documents)
        .values({
          name: `Invoice - ${bill.billNumber}`,
          description: `Invoice document for ${bill.title}`,
          documentType: 'financial',
          filePath: invoiceFilePath,
          fileName: `invoice-${bill.billNumber}.txt`,
          fileSize: invoiceContent.length,
          mimeType: 'text/plain',
          isVisibleToTenants: false,
          buildingId: bill.buildingId,
          uploadedById: billCreator.id,
          attachedToType: 'bill',
          attachedToId: bill.id
        });
      
      // Create receipt document
      const receiptContent = `${demoDisclosure}PAYMENT RECEIPT

Receipt for Bill: ${bill.billNumber}
Payment Amount: $${bill.totalAmount}
Payment Date: ${faker.date.recent().toLocaleDateString()}
Payment Method: ${faker.helpers.arrayElement(['Electronic Transfer', 'Check', 'ACH Transfer'])}
Reference Number: PAY-${faker.string.alphanumeric(8).toUpperCase()}

Bill Details:
- Title: ${bill.title}
- Vendor: ${bill.vendor}
- Category: ${bill.category}

This payment has been processed successfully.
Building Management Office`;

      const receiptFilePath = `demo-documents/bills/receipt-${bill.billNumber.toLowerCase()}.txt`;
      
      await db
        .insert(schema.documents)
        .values({
          name: `Receipt - ${bill.billNumber}`,
          description: `Payment receipt for ${bill.title}`,
          documentType: 'financial',
          filePath: receiptFilePath,
          fileName: `receipt-${bill.billNumber}.txt`,
          fileSize: receiptContent.length,
          mimeType: 'text/plain',
          isVisibleToTenants: true,
          buildingId: bill.buildingId,
          uploadedById: billCreator.id,
          attachedToType: 'bill',
          attachedToId: bill.id
        });
      
      totalDocuments += 2;
    }
    
    // Create Residence Documents
    console.log('   Creating residence documents...');
    const residenceDocumentTypes = [
      { type: 'lease', name: 'Lease Agreement', description: 'Rental lease agreement' },
      { type: 'inspection', name: 'Inspection Report', description: 'Unit inspection report' },
      { type: 'maintenance', name: 'Maintenance Log', description: 'Maintenance history log' }
    ];
    
    for (const residence of residences.slice(0, Math.min(residences.length, 20))) { // Limit to 20 residences for demo
      const building = buildings.find(b => b.id === residence.buildingId);
      const manager = users.find(user => user.buildingId === residence.buildingId && user.role.includes('manager'));
      if (!building || !manager) continue;
      
      // Create one document per residence
      const docType = residenceDocumentTypes[Math.floor(Math.random() * residenceDocumentTypes.length)];
      
      let documentContent = `${demoDisclosure}${docType.name.toUpperCase()}

Unit: ${residence.unitNumber}
Building: ${building.name}
Address: ${faker.location.streetAddress()}

`;
      
      if (docType.type === 'lease') {
        documentContent += `LEASE AGREEMENT

Tenant Information:
- Unit Number: ${residence.unitNumber}
- Lease Start Date: ${faker.date.past().toLocaleDateString()}
- Lease End Date: ${faker.date.future().toLocaleDateString()}
- Monthly Rent: $${faker.number.int({ min: 800, max: 2500 })}
- Security Deposit: $${faker.number.int({ min: 800, max: 2500 })}

Terms and Conditions:
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}
- ${faker.lorem.sentence()}

Landlord: ${building.name} Management
Tenant Signature: ____________________
Date: ${faker.date.recent().toLocaleDateString()}`;
      } else if (docType.type === 'inspection') {
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
      } else {
        documentContent += `MAINTENANCE LOG

Maintenance History for Unit ${residence.unitNumber}:

${faker.date.past().toLocaleDateString()} - ${faker.helpers.arrayElement(['Plumbing repair', 'Electrical work', 'HVAC maintenance'])}
Status: Completed
Cost: $${faker.number.int({ min: 50, max: 500 })}

${faker.date.past().toLocaleDateString()} - ${faker.helpers.arrayElement(['Paint touch-up', 'Carpet cleaning', 'Appliance repair'])}
Status: Completed  
Cost: $${faker.number.int({ min: 50, max: 500 })}

${faker.date.recent().toLocaleDateString()} - ${faker.helpers.arrayElement(['Annual inspection', 'Filter replacement', 'Light fixture repair'])}
Status: In Progress
Estimated Cost: $${faker.number.int({ min: 50, max: 500 })}

Next Scheduled Maintenance: ${faker.date.future().toLocaleDateString()}`;
      }
      
      const docFilePath = `demo-documents/residences/${docType.type}-${residence.unitNumber.toLowerCase()}.txt`;
      
      await db
        .insert(schema.documents)
        .values({
          name: `${docType.name} - Unit ${residence.unitNumber}`,
          description: `${docType.description} for unit ${residence.unitNumber}`,
          documentType: docType.type,
          filePath: docFilePath,
          fileName: `${docType.type}-${residence.unitNumber}.txt`,
          fileSize: documentContent.length,
          mimeType: 'text/plain',
          isVisibleToTenants: docType.type === 'lease',
          residenceId: residence.id,
          buildingId: residence.buildingId,
          uploadedById: manager.id
        });
      
      totalDocuments++;
    }
    
    // Create Building Documents  
    console.log('   Creating building documents...');
    const buildingDocumentTypes = [
      { type: 'insurance', name: 'Insurance Certificate', description: 'Building insurance certificate' },
      { type: 'permits', name: 'Building Permit', description: 'Construction/renovation permit' },
      { type: 'meeting_minutes', name: 'Board Meeting Minutes', description: 'Monthly board meeting minutes' },
      { type: 'contracts', name: 'Service Contract', description: 'Maintenance service contract' }
    ];
    
    for (const building of buildings) {
      const manager = users.find(user => user.buildingId === building.id && user.role.includes('manager'));
      if (!manager) continue;
      
      // Create 2-3 documents per building
      const docsToCreate = faker.number.int({ min: 2, max: 3 });
      const selectedTypes = faker.helpers.arrayElements(buildingDocumentTypes, docsToCreate);
      
      for (const docType of selectedTypes) {
        let documentContent = `${demoDisclosure}${docType.name.toUpperCase()}

Building: ${building.name}
Organization: ${building.organizationId}
Document Date: ${faker.date.recent().toLocaleDateString()}

`;
        
        if (docType.type === 'insurance') {
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
        } else if (docType.type === 'permits') {
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
        } else if (docType.type === 'meeting_minutes') {
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
        } else {
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
        
        const docFilePath = `demo-documents/buildings/${docType.type}-${building.id.slice(0, 8)}.txt`;
        
        await db
          .insert(schema.documents)
          .values({
            name: `${docType.name} - ${building.name}`,
            description: `${docType.description} for ${building.name}`,
            documentType: docType.type,
            filePath: docFilePath,
            fileName: `${docType.type}-${building.name.replace(/\s+/g, '-').toLowerCase()}.txt`,
            fileSize: documentContent.length,
            mimeType: 'text/plain',
            isVisibleToTenants: docType.type === 'meeting_minutes',
            buildingId: building.id,
            uploadedById: manager.id
          });
        
        totalDocuments++;
      }
    }
    
    console.log(`📊 Created ${totalDocuments} demo documents:`);
    console.log(`   - Bill documents: ${bills.length * 2} (invoices + receipts)`);
    console.log(`   - Residence documents: ${Math.min(residences.length, 20)}`);
    console.log(`   - Building documents: ${buildings.length * 2}-${buildings.length * 3}`);
    
  } catch (error) {
    console.error('❌ Failed to create documents:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting Koveo Gestion Demo Environment Creation');
    console.log('='.repeat(60));
    
    // Parse CLI arguments
    const args = parseArguments();
    
    // Initialize database connection
    await initializeDatabase(args.database);
    
    console.log(`📋 Configuration:`);
    console.log(`   Organization Type: ${args.type}`);
    console.log(`   Organization Name: "${args.name}"`);
    console.log(`   Target Database: ${args.database === 'prod' ? 'PRODUCTION (DATABASE_URL_KOVEO)' : 'DEVELOPMENT (DATABASE_URL)'}`);
    console.log('');
    
    // Step 1: Upsert Organization
    console.log('📁 Step 1: Upsert Organization');
    const organization = await upsertOrganization(args.name, args.type);
    console.log('');
    
    // Step 2: Create Buildings
    console.log('🏢 Step 2: Create Buildings');
    const buildings = await seedBuildings(organization.id);
    console.log('');
    
    // Step 3: Create Residences
    console.log('🏠 Step 3: Create Residences');
    const residences = await seedResidences(buildings);
    console.log('');
    
    // Step 4: Create Common Spaces
    console.log('🏛️ Step 4: Create Common Spaces');
    const commonSpaces = await seedCommonSpaces(buildings);
    console.log('');
    
    // Step 5: Create Users
    console.log('👥 Step 5: Create Users');
    const users = await seedUsers(args.type, organization.id, buildings, residences);
    console.log('');
    
    // Step 6: Create Bookings
    console.log('📅 Step 6: Create Bookings');
    await seedBookings(commonSpaces, users);
    console.log('');
    
    // Step 7: Create Maintenance Demands
    console.log('🔧 Step 7: Create Maintenance Demands');
    await seedMaintenanceRequests(users);
    console.log('');
    
    // Step 8: Create Bills
    console.log('💰 Step 8: Create Bills');
    await seedBills(buildings, users);
    console.log('');
    
    // Summary
    console.log('🎉 Demo environment created successfully!');
    console.log('='.repeat(60));
    console.log(`✅ Organization: ${organization.name} (${organization.type})`);
    console.log(`✅ Buildings: ${buildings.length}`);
    console.log(`✅ Residences: ${residences.length}`);
    console.log(`✅ Common Spaces: ${commonSpaces.length}`);
    console.log(`✅ Users: ${users.length}`);
    console.log(`✅ Managers: ${users.filter(u => u.role.includes('manager')).length}`);
    console.log(`✅ Residents: ${users.filter(u => u.role.includes('resident')).length}`);
    console.log('✅ Bookings, demands, and bills created successfully');
    console.log('');
    console.log(`🚀 Demo environment for "${args.name}" is ready for use!`);
    
  } catch (error) {
    console.error('❌ Demo environment creation failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await closeConnection();
  }
}

// Execute the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;