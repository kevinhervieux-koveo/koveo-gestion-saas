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
async function populateOrganizations() {
  try {
    console.log('🚀 Starting to populate organizations, buildings, and residences...');

    // Step 1: Create Organizations
    console.log('\n📁 Creating organizations...');
    
    // Create Demo organization
    const [demoOrg] = await db.insert(schema.organizations).values({
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
    }).returning();
    console.log('✅ Created Demo organization');

    // Create Koveo organization
    const [koveoOrg] = await db.insert(schema.organizations).values({
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
    }).returning();
    console.log('✅ Created Koveo organization');

    // Create 563 montée des pionniers organization
    const [monteeOrg] = await db.insert(schema.organizations).values({
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
    }).returning();
    console.log('✅ Created 563 montée des pionniers organization');

    // Step 2: Find or create users
    console.log('\n👤 Setting up users...');
    
    // Find the admin user (you)
    let adminUser = await db.query.users.findFirst({
      where: eq(schema.users.role, 'admin')
    });

    if (!adminUser) {
      // Create admin user if doesn't exist
      const hashedPassword = await bcrypt.hash('Admin@123456', 10);
      [adminUser] = await db.insert(schema.users).values({
        email: 'admin@koveo.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        phone: '514-555-0001',
        language: 'fr',
        role: 'admin',
        isActive: true,
      }).returning();
      console.log('✅ Created admin user');
    } else {
      console.log('✅ Found existing admin user');
    }

    // Create mock users for demo organization
    const mockUsers = [];
    const mockUserData = [
      { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'tenant' as const },
      { email: 'jane.smith@example.com', firstName: 'Jane', lastName: 'Smith', role: 'tenant' as const },
      { email: 'bob.johnson@example.com', firstName: 'Bob', lastName: 'Johnson', role: 'tenant' as const },
      { email: 'alice.williams@example.com', firstName: 'Alice', lastName: 'Williams', role: 'tenant' as const },
      { email: 'charlie.brown@example.com', firstName: 'Charlie', lastName: 'Brown', role: 'tenant' as const },
      { email: 'emma.davis@example.com', firstName: 'Emma', lastName: 'Davis', role: 'tenant' as const },
      { email: 'frank.miller@example.com', firstName: 'Frank', lastName: 'Miller', role: 'tenant' as const },
      { email: 'grace.wilson@example.com', firstName: 'Grace', lastName: 'Wilson', role: 'tenant' as const },
      { email: 'henry.moore@example.com', firstName: 'Henry', lastName: 'Moore', role: 'tenant' as const },
      { email: 'demo.manager@example.com', firstName: 'Demo', lastName: 'Manager', role: 'manager' as const },
    ];

    for (const userData of mockUserData) {
      // Check if user already exists
      let user = await db.query.users.findFirst({
        where: eq(schema.users.email, userData.email)
      });

      if (!user) {
        const hashedPassword = await bcrypt.hash('Demo@123456', 10);
        [user] = await db.insert(schema.users).values({
          ...userData,
          password: hashedPassword,
          phone: '514-555-' + Math.floor(1000 + Math.random() * 9000),
          language: 'fr',
          isActive: true,
        }).returning();
      }
      mockUsers.push(user);
    }
    console.log(`✅ Created/found ${mockUsers.length} mock users`);

    // Step 3: Create user-organization relationships
    console.log('\n🔗 Creating user-organization relationships...');
    
    // Add all mock users to Demo organization
    for (const user of mockUsers) {
      const exists = await db.query.userOrganizations.findFirst({
        where: (userOrg, { and, eq }) => and(
          eq(userOrg.userId, user.id),
          eq(userOrg.organizationId, demoOrg.id)
        )
      });

      if (!exists) {
        await db.insert(schema.userOrganizations).values({
          userId: user.id,
          organizationId: demoOrg.id,
          organizationRole: user.role,
          canAccessAllOrganizations: user.role === 'manager',
        });
      }
    }
    console.log('✅ Added mock users to Demo organization');

    // Add admin user to Koveo and 563 montée des pionniers organizations
    // Koveo organization with access to all
    const koveoRelExists = await db.query.userOrganizations.findFirst({
      where: (userOrg, { and, eq }) => and(
        eq(userOrg.userId, adminUser.id),
        eq(userOrg.organizationId, koveoOrg.id)
      )
    });

    if (!koveoRelExists) {
      await db.insert(schema.userOrganizations).values({
        userId: adminUser.id,
        organizationId: koveoOrg.id,
        organizationRole: 'admin',
        canAccessAllOrganizations: true,
      });
    }
    console.log('✅ Added admin user to Koveo organization');

    // 563 montée des pionniers organization with access to all
    const monteeRelExists = await db.query.userOrganizations.findFirst({
      where: (userOrg, { and, eq }) => and(
        eq(userOrg.userId, adminUser.id),
        eq(userOrg.organizationId, monteeOrg.id)
      )
    });

    if (!monteeRelExists) {
      await db.insert(schema.userOrganizations).values({
        userId: adminUser.id,
        organizationId: monteeOrg.id,
        organizationRole: 'admin',
        canAccessAllOrganizations: true,
      });
    }
    console.log('✅ Added admin user to 563 montée des pionniers organization');

    // Step 4: Create Buildings
    console.log('\n🏢 Creating buildings...');
    
    // Demo buildings
    const [demoBuilding1] = await db.insert(schema.buildings).values({
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
    }).returning();
    console.log('✅ Created Demo Building 1');

    const [demoBuilding2] = await db.insert(schema.buildings).values({
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
    }).returning();
    console.log('✅ Created Demo Building 2');

    // 563 montée des pionniers building
    const [monteeBuilding] = await db.insert(schema.buildings).values({
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
    }).returning();
    console.log('✅ Created 563 montée des pionniers building');

    // Step 5: Create Residences
    console.log('\n🏠 Creating residences...');
    
    // Demo Building 1 - 5 residences
    const demo1Residences = [];
    for (let i = 1; i <= 5; i++) {
      const [residence] = await db.insert(schema.residences).values({
        buildingId: demoBuilding1.id,
        unitNumber: `${i}01`,
        floor: Math.ceil(i / 2),
        squareFootage: '850.00',
        bedrooms: 2,
        bathrooms: '1.5',
        balcony: i % 2 === 0,
        parkingSpaceNumber: `P${i}`,
        storageSpaceNumber: `S${i}`,
        ownershipPercentage: '0.2000',
        monthlyFees: '350.00',
        isActive: true,
      }).returning();
      demo1Residences.push(residence);
    }
    console.log('✅ Created 5 residences for Demo Building 1');

    // Demo Building 2 - 4 residences
    const demo2Residences = [];
    for (let i = 1; i <= 4; i++) {
      const [residence] = await db.insert(schema.residences).values({
        buildingId: demoBuilding2.id,
        unitNumber: `${i}02`,
        floor: Math.ceil(i / 2),
        squareFootage: '750.00',
        bedrooms: 1,
        bathrooms: '1.0',
        balcony: i > 2,
        parkingSpaceNumber: `P${i}`,
        storageSpaceNumber: `S${i}`,
        monthlyFees: '1200.00',
        isActive: true,
      }).returning();
      demo2Residences.push(residence);
    }
    console.log('✅ Created 4 residences for Demo Building 2');

    // 563 montée des pionniers - 6 residences
    const monteeResidences = [];
    for (let i = 1; i <= 6; i++) {
      const [residence] = await db.insert(schema.residences).values({
        buildingId: monteeBuilding.id,
        unitNumber: `${100 + i}`,
        floor: Math.ceil(i / 2),
        squareFootage: '1200.00',
        bedrooms: 3,
        bathrooms: '2.0',
        balcony: true,
        parkingSpaceNumber: `P${i}A`,
        storageSpaceNumber: `S${i}`,
        ownershipPercentage: '0.1667',
        monthlyFees: '450.00',
        isActive: true,
      }).returning();
      monteeResidences.push(residence);
    }
    console.log('✅ Created 6 residences for 563 montée des pionniers');

    // Step 6: Assign users to residences
    console.log('\n🏘️ Assigning users to residences...');
    
    // Assign mock users to Demo Building 1 residences
    for (let i = 0; i < 5 && i < mockUsers.length; i++) {
      await db.insert(schema.userResidences).values({
        userId: mockUsers[i].id,
        residenceId: demo1Residences[i].id,
        relationshipType: 'owner',
        startDate: new Date('2024-01-01').toISOString().split('T')[0],
        isActive: true,
      });
    }
    console.log('✅ Assigned users to Demo Building 1');

    // Assign remaining mock users to Demo Building 2 residences
    for (let i = 0; i < 4 && (i + 5) < mockUsers.length; i++) {
      await db.insert(schema.userResidences).values({
        userId: mockUsers[i + 5].id,
        residenceId: demo2Residences[i].id,
        relationshipType: 'tenant',
        startDate: new Date('2024-01-01').toISOString().split('T')[0],
        isActive: true,
      });
    }
    console.log('✅ Assigned users to Demo Building 2');

    console.log('\n✨ Successfully populated all organizations, buildings, and residences!');
    console.log('\n📊 Summary:');
    console.log('- 3 Organizations created');
    console.log('- 3 Buildings created (2 for Demo, 0 for Koveo, 1 for 563 montée)');
    console.log('- 15 Residences created (5 + 4 + 6)');
    console.log('- Users assigned to organizations and residences');

  } catch (error) {
    console.error('❌ Error populating data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the population script
populateOrganizations().catch(console.error);