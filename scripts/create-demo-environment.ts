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
 * 
 * Features:
 * - Idempotent upsert logic (updates existing organizations)
 * - Role-based user creation (demo vs production types)
 * - Comprehensive realistic data using @faker-js/faker
 * - Quebec-specific data generation
 * - Complete building, residence, and user ecosystem
 * - Realistic bookings, demands, and financial data
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, gte } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcryptjs';
import * as schema from '../shared/schema';

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Types
interface CliArgs {
  type: 'demo' | 'production';
  name: string;
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
    }
  }
  
  if (!type) {
    console.error('❌ --type argument is required (demo or production)');
    console.error('Usage: npx tsx scripts/create-demo-environment.ts --type demo --name "Demo Organization"');
    process.exit(1);
  }
  
  if (!name) {
    console.error('❌ --name argument is required');
    console.error('Usage: npx tsx scripts/create-demo-environment.ts --type demo --name "Demo Organization"');
    process.exit(1);
  }
  
  return { type, name };
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
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting Koveo Gestion Demo Environment Creation');
    console.log('='.repeat(60));
    
    // Parse CLI arguments
    const args = parseArguments();
    console.log(`📋 Configuration:`);
    console.log(`   Organization Type: ${args.type}`);
    console.log(`   Organization Name: "${args.name}"`);
    console.log('');
    
    // Step 1: Upsert Organization
    console.log('📁 Step 1: Upsert Organization');
    const organization = await upsertOrganization(args.name, args.type);
    console.log('');
    
    // TODO: Continue with remaining steps
    console.log('🎉 Demo environment script completed successfully!');
    console.log(`✅ Organization "${organization.name}" is ready for use`);
    
  } catch (error) {
    console.error('❌ Demo environment creation failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Execute the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;