import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 *
 */
/**
 * PopulateOrganizations function.
 * @returns Function result.
 */
async function populateOrganizations() {
  try {
    console.warn('🚀 Starting to populate organizations, buildings, and residences...');

    // Step 1: Create Organizations
    console.warn('\n📁 Creating organizations...');

    // Create Demo organization
    const [demoOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Demo',
        type: 'management_company',
        address: '123 Demo Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1A 1A1',
        phone: '514-555-0100',
        email: 'demo@example.com',
        website: 'https://demo.example.com',
        registrationNumber: 'DEMO-001',
        isActive: true,
      })
      .returning();
    console.warn('✅ Created Demo organization');

    // Create Koveo organization
    const [koveoOrg] = await db
      .insert(schema.organizations)
      .values({
        name: 'Koveo',
        type: 'management_company',
        address: '456 Business Avenue',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2B 2B2',
        phone: '514-555-0200',
        email: 'info@koveo.com',
        website: 'https://koveo.com',
        registrationNumber: 'KOVEO-001',
        isActive: true,
      })
      .returning();
    console.warn('✅ Created Koveo organization');

    // Create 563 montée des pionniers organization
    const [monteeOrg] = await db
      .insert(schema.organizations)
      .values({
        name: '563 montée des pionniers',
        type: 'syndicate',
        address: '563 montée des pionniers',
        city: 'Terrebonne',
        province: 'QC',
        postalCode: 'J6W 1N5',
        phone: '450-555-0300',
        email: 'syndic@563montee.com',
        website: 'https://563montee.com',
        registrationNumber: 'SYNDIC-563',
        isActive: true,
      })
      .returning();
    console.warn('✅ Created 563 montée des pionniers organization');

    // Step 2: Find or create users
    console.warn('\n👤 Setting up users...');

    // Find the admin user (you)
    let adminUser = await db.query.users.findFirst({
      where: eq(schema.users.role, 'admin'),
    });

    if (!adminUser) {
      // Create admin user if doesn't exist
      const hashedPassword = await bcrypt.hash('Admin@123456', 10);
      [adminUser] = await db
        .insert(schema.users)
        .values({
          username: 'admin.koveo',
          email: 'admin@koveo.com',
          password: hashedPassword,
          firstName: 'Alexandre',
          lastName: 'Bergeron',
          phone: '514-555-0001',
          language: 'fr',
          role: 'admin',
          isActive: true,
        })
        .returning();
      console.warn('✅ Created admin user');
    } else {
      console.warn('✅ Found existing admin user');
    }

    // Users will be created through the application interface
    console.warn('✅ User creation available through invitation system');

    // Step 3: Create admin user organization relationships
    console.warn('\n🔗 Creating admin user organization relationships...');

    // Add admin user to Koveo and 563 montée des pionniers organizations
    // Koveo organization with access to all
    const koveoRelExists = await db.query.userOrganizations.findFirst({
      where: (userOrg, { and, eq }) =>
        and(eq(userOrg.userId, adminUser.id), eq(userOrg.organizationId, koveoOrg.id)),
    });

    if (!koveoRelExists) {
      await db.insert(schema.userOrganizations).values({
        userId: adminUser.id,
        organizationId: koveoOrg.id,
        organizationRole: 'admin',
        canAccessAllOrganizations: true,
      });
    }
    console.warn('✅ Added admin user to Koveo organization');

    // 563 montée des pionniers organization with access to all
    const monteeRelExists = await db.query.userOrganizations.findFirst({
      where: (userOrg, { and, eq }) =>
        and(eq(userOrg.userId, adminUser.id), eq(userOrg.organizationId, monteeOrg.id)),
    });

    if (!monteeRelExists) {
      await db.insert(schema.userOrganizations).values({
        userId: adminUser.id,
        organizationId: monteeOrg.id,
        organizationRole: 'admin',
        canAccessAllOrganizations: true,
      });
    }
    console.warn('✅ Added admin user to 563 montée des pionniers organization');

    // Step 4: Create Buildings
    console.warn('\n🏢 Creating buildings...');

    // Demo buildings
    const [demoBuilding1] = await db
      .insert(schema.buildings)
      .values({
        organizationId: demoOrg.id,
        name: 'Demo Building 1',
        address: '100 Demo Avenue',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H3A 1A1',
        buildingType: 'condo',
        yearBuilt: 2010,
        totalUnits: 5,
        totalFloors: 3,
        parkingSpaces: 5,
        storageSpaces: 5,
        amenities: { gym: true, pool: false, laundry: true },
        managementCompany: 'Demo Management Inc.',
        isActive: true,
      })
      .returning();
    console.warn('✅ Created Demo Building 1');

    const [demoBuilding2] = await db
      .insert(schema.buildings)
      .values({
        organizationId: demoOrg.id,
        name: 'Demo Building 2',
        address: '200 Demo Boulevard',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H3B 2B2',
        buildingType: 'rental',
        yearBuilt: 2015,
        totalUnits: 4,
        totalFloors: 2,
        parkingSpaces: 4,
        storageSpaces: 4,
        amenities: { gym: false, pool: true, laundry: true },
        managementCompany: 'Demo Management Inc.',
        isActive: true,
      })
      .returning();
    console.warn('✅ Created Demo Building 2');

    // 563 montée des pionniers building
    const [monteeBuilding] = await db
      .insert(schema.buildings)
      .values({
        organizationId: monteeOrg.id,
        name: '563 montée des pionniers, Terrebonne',
        address: '563 montée des pionniers',
        city: 'Terrebonne',
        province: 'QC',
        postalCode: 'J6W 1N5',
        buildingType: 'condo',
        yearBuilt: 2020,
        totalUnits: 6,
        totalFloors: 3,
        parkingSpaces: 12,
        storageSpaces: 6,
        amenities: { gym: true, pool: true, laundry: true, securitySystem: true },
        managementCompany: 'Koveo Gestion',
        isActive: true,
      })
      .returning();
    console.warn('✅ Created 563 montée des pionniers building');

    // Step 5: Create Residences
    console.warn('\n🏠 Creating residences...');

    // Demo Building 1 - 5 residences
    const demo1Residences = [];
    for (let i = 1; i <= 5; i++) {
      const [residence] = await db
        .insert(schema.residences)
        .values({
          buildingId: demoBuilding1.id,
          unitNumber: `${i}01`,
          floor: Math.ceil(i / 2),
          squareFootage: '850.00',
          bedrooms: 2,
          bathrooms: '1.5',
          balcony: i % 2 === 0,
          parkingSpaceNumbers: [`P${i}`],
          storageSpaceNumbers: [`S${i}`],
          ownershipPercentage: '0.2000',
          monthlyFees: '350.00',
          isActive: true,
        })
        .returning();
      demo1Residences.push(residence);
    }
    console.warn('✅ Created 5 residences for Demo Building 1');

    // Demo Building 2 - 4 residences
    const demo2Residences = [];
    for (let i = 1; i <= 4; i++) {
      const [residence] = await db
        .insert(schema.residences)
        .values({
          buildingId: demoBuilding2.id,
          unitNumber: `${i}02`,
          floor: Math.ceil(i / 2),
          squareFootage: '750.00',
          bedrooms: 1,
          bathrooms: '1.0',
          balcony: i > 2,
          parkingSpaceNumbers: [`P${i}`],
          storageSpaceNumbers: [`S${i}`],
          monthlyFees: '1200.00',
          isActive: true,
        })
        .returning();
      demo2Residences.push(residence);
    }
    console.warn('✅ Created 4 residences for Demo Building 2');

    // 563 montée des pionniers - 6 residences
    const monteeResidences = [];
    for (let i = 1; i <= 6; i++) {
      const [residence] = await db
        .insert(schema.residences)
        .values({
          buildingId: monteeBuilding.id,
          unitNumber: `${100 + i}`,
          floor: Math.ceil(i / 2),
          squareFootage: '1200.00',
          bedrooms: 3,
          bathrooms: '2.0',
          balcony: true,
          parkingSpaceNumbers: [`P${i}A`],
          storageSpaceNumbers: [`S${i}`],
          ownershipPercentage: '0.1667',
          monthlyFees: '450.00',
          isActive: true,
        })
        .returning();
      monteeResidences.push(residence);
    }
    console.warn('✅ Created 6 residences for 563 montée des pionniers');

    // Step 6: Assign users to residences
    console.warn('\n🏘️ Assigning users to residences...');

    // Note: User-residence assignments will be handled through the invitation system
    console.warn('✅ User-residence assignments available through invitation system');

    console.warn('\n✨ Successfully populated all organizations, buildings, and residences!');
    console.warn('\n📊 Summary:');
    console.warn('- 3 Organizations created');
    console.warn('- 3 Buildings created (2 for Demo, 0 for Koveo, 1 for 563 montée)');
    console.warn('- 15 Residences created (5 + 4 + 6)');
    console.warn('- Users assigned to organizations and residences');
  } catch (error) {
    console.error('❌ Error populating data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the population script
populateOrganizations().catch(console.error);
