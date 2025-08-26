#!/usr/bin/env tsx

/**
 * Comprehensive Demo Organization Creation Script.
 *
 * This script creates a comprehensive Demo organization with all data elements
 * needed to demonstrate every aspect of the resident/manager/settings menus.
 *
 * Data Created:
 * - Organizations (Demo and Open Demo)
 * - Buildings with varied types and amenities
 * - Residences with different configurations
 * - Users with all roles (admin, manager, tenant, resident)
 * - Bills with various types and statuses
 * - Budgets and monthly budgets
 * - Money flow transactions
 * - Maintenance requests with different priorities
 * - Demands/complaints
 * - Notifications
 * - Bug reports
 * - Feature requests
 * - Documents (both building and residence level).
 *
 * Usage: tsx scripts/create-comprehensive-demo.ts.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, sql, or, like } from 'drizzle-orm';
import * as schema from '../shared/schema';
import * as bcrypt from 'bcryptjs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 * Main function to create comprehensive demo data.
 * PRODUCTION FIX: Clean existing demo data first to avoid conflicts.
 */
async function createComprehensiveDemo(): Promise<void> {
  try {
    console.log('🚀 Creating comprehensive demo organizations and data...\n');

    // Step 0: Clean existing demo data to avoid conflicts
    console.log('🧹 Cleaning existing demo data...');
    await cleanExistingDemoData();

    // Step 1: Create Organizations
    console.log('📁 Creating organizations...');
    const organizations = await createOrganizations();

    // Step 2: Create Buildings
    console.log('\n🏢 Creating buildings with varied configurations...');
    const buildings = await createBuildings(organizations.demo.id);

    // Step 3: Create Residences
    console.log('\n🏠 Creating residences with different types...');
    const residences = await createResidences(buildings);

    // Step 4: Create Users
    console.log('\n👥 Creating users with different roles...');
    const users = await createUsers(organizations.demo.id);

    // Step 5: Assign Users to Residences
    console.log('\n🔗 Assigning users to residences...');
    await assignUsersToResidences(users, residences);

    // Step 6: Create Financial Data
    console.log('\n💰 Creating financial data (bills, budgets, money flow)...');
    await createFinancialData(buildings, residences, users.filter(u => u && u.id));

    // Step 7: Create Operations Data
    console.log('\n🔧 Creating operations data (maintenance, demands, notifications)...');
    await createOperationsData(residences, users);

    // Step 8: Create Settings Data
    console.log('\n⚙️ Creating settings data (bugs, feature requests)...');
    await createSettingsData(users);

    // Step 9: Create Documents
    console.log('\n📄 Creating document data...');
    await createDocuments(buildings, residences, users);

    // Step 10: Create Open Demo Organization
    console.log('\n🔄 Creating Open Demo organization...');
    await createOpenDemoOrganization(organizations.demo.id);

    console.log('\n✨ Comprehensive demo data creation completed successfully!');
    console.log('\n📊 Summary of created data:');
    console.log('- 2 Organizations (Demo, Open Demo)');
    console.log('- 4 Buildings with varied types');
    console.log('- 20+ Residences with different configurations');
    console.log('- 15+ Users with different roles');
    console.log('- 50+ Bills with various statuses');
    console.log('- Budget and monthly budget data');
    console.log('- Money flow transactions');
    console.log('- 30+ Maintenance requests');
    console.log('- 20+ Demands/complaints');
    console.log('- Multiple notifications');
    console.log('- Bug reports for testing');
    console.log('- Feature requests for idea box');
    console.log('- Building and residence documents');
  } catch (error) {
    console.error('❌ Error creating comprehensive demo data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * PRODUCTION FIX: Clean existing demo data to avoid conflicts.
 */
async function cleanExistingDemoData(): Promise<void> {
  try {
    console.log('  🗑️  Removing ALL existing demo users...');
    // Get ALL users with demo emails and delete them
    const demoUsers = await db.select({ username: schema.users.username })
      .from(schema.users)
      .where(like(schema.users.email, '%demo.com%'));
    
    if (demoUsers.length > 0) {
      console.log(`  🗑️  Found ${demoUsers.length} demo users to remove`);
      await db.delete(schema.users).where(
        like(schema.users.email, '%demo.com%')
      );
    }
    
    console.log('  🗑️  Removing existing demo organizations...');
    await db.delete(schema.organizations).where(
      schema.organizations.name.in(['Demo', 'Open Demo'])
    );
    
    console.log('  ✅ Cleanup complete');
  } catch (error) {
    console.log('  ⚠️  Cleanup warning (non-critical):', (error as Error).message);
  }
}

/**
 * Create organizations (Demo and Open Demo).
 * PRODUCTION FIX: Use 'demo' type instead of 'management_company'.
 */
async function createOrganizations() {
  // Clean existing demo data first
  console.log('  🧹 Cleaning existing demo data...');
  await cleanExistingDemoData();

  // Create Demo organization
  const [demoOrg] = await db
    .insert(schema.organizations)
    .values({
      name: 'Demo',
      type: 'demo',
      address: '123 Demo Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      phone: '514-555-0100',
      email: 'demo@koveogesion.com',
      website: 'https://demo.koveogesion.com',
      registrationNumber: 'DEMO-001',
      isActive: true,
    })
    .returning();

  // Create Open Demo organization (read-only demo)
  const [openDemoOrg] = await db
    .insert(schema.organizations)
    .values({
      name: 'Open Demo',
      type: 'demo',
      address: '456 Open Demo Avenue',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H2B 2B2',
      phone: '514-555-0200',
      email: 'opendemo@koveogesion.com',
      website: 'https://opendemo.koveogesion.com',
      registrationNumber: 'OPEN-DEMO-001',
      isActive: true,
    })
    .returning();

  console.log('✅ Created Demo and Open Demo organizations');
  return { demo: demoOrg, openDemo: openDemoOrg };
}

/**
 * Create buildings with varied configurations.
 * @param organizationId
 */
async function createBuildings(organizationId: string) {
  const buildingConfigs = [
    {
      name: 'Maple Heights Condominiums',
      address: '100 Maple Street',
      city: 'Montreal',
      buildingType: 'condo' as const,
      yearBuilt: 2018,
      totalUnits: 12,
      totalFloors: 4,
      parkingSpaces: 15,
      storageSpaces: 12,
      amenities: { gym: true, pool: true, laundry: true, concierge: true, security: true },
      managementCompany: 'Koveo Gestion',
    },
    {
      name: 'Riverside Apartments',
      address: '200 River Boulevard',
      city: 'Montreal',
      buildingType: 'rental' as const,
      yearBuilt: 2020,
      totalUnits: 8,
      totalFloors: 3,
      parkingSpaces: 10,
      storageSpaces: 8,
      amenities: { gym: false, pool: false, laundry: true, elevators: true },
      managementCompany: 'Koveo Gestion',
    },
    {
      name: 'Downtown Executive Suites',
      address: '300 Business District',
      city: 'Montreal',
      buildingType: 'condo' as const,
      yearBuilt: 2022,
      totalUnits: 6,
      totalFloors: 2,
      parkingSpaces: 8,
      storageSpaces: 6,
      amenities: { gym: true, pool: false, laundry: true, rooftop: true },
      managementCompany: 'Koveo Gestion',
    },
    {
      name: 'Family Garden Complex',
      address: '400 Garden Lane',
      city: 'Montreal',
      buildingType: 'rental' as const,
      yearBuilt: 2015,
      totalUnits: 16,
      totalFloors: 4,
      parkingSpaces: 20,
      storageSpaces: 16,
      amenities: { gym: false, pool: true, laundry: true, playground: true, garden: true },
      managementCompany: 'Koveo Gestion',
    },
  ];

  const buildings = [];
  for (const config of buildingConfigs) {
    const [building] = await db
      .insert(schema.buildings)
      .values({
        organizationId,
        ...config,
        province: 'QC',
        postalCode: `H${Math.floor(Math.random() * 9) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${Math.floor(Math.random() * 9) + 1}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9) + 1}`,
        isActive: true,
      })
      .returning();
    buildings.push(building);
    console.log(`✅ Created building: ${building.name}`);
  }

  return buildings;
}

/**
 * Create residences with different configurations.
 * @param buildings
 */
async function createResidences(buildings: any[]) {
  const residences = [];

  for (const building of buildings) {
    const residenceConfigs = [];

    // Generate different residence types based on building type
    if (building.buildingType === 'condo') {
      // Condos: Mix of 1, 2, and 3 bedroom units
      for (let i = 1; i <= building.totalUnits; i++) {
        const bedrooms = [1, 2, 3][Math.floor(i / 4) % 3];
        residenceConfigs.push({
          unitNumber: `${Math.floor((i - 1) / 3) + 1}0${((i - 1) % 3) + 1}`,
          floor: Math.floor((i - 1) / 3) + 1,
          squareFootage: bedrooms === 1 ? '650.00' : bedrooms === 2 ? '850.00' : '1200.00',
          bedrooms,
          bathrooms: bedrooms === 1 ? '1.0' : bedrooms === 2 ? '1.5' : '2.0',
          balcony: Math.floor((i - 1) / 3) > 0, // Upper floors have balconies
          parkingSpaceNumbers: [`P${i}`],
          storageSpaceNumbers: [`S${i}`],
          ownershipPercentage: (100 / building.totalUnits / 100).toFixed(4),
          monthlyFees: bedrooms === 1 ? '350.00' : bedrooms === 2 ? '425.00' : '550.00',
        });
      }
    } else {
      // Rentals: More varied configurations
      for (let i = 1; i <= building.totalUnits; i++) {
        const bedrooms = [1, 2, 2, 3][i % 4]; // More 2-bedroom units
        residenceConfigs.push({
          unitNumber: `${Math.floor((i - 1) / 4) + 1}${String.fromCharCode(65 + ((i - 1) % 4))}`,
          floor: Math.floor((i - 1) / 4) + 1,
          squareFootage: bedrooms === 1 ? '750.00' : bedrooms === 2 ? '950.00' : '1350.00',
          bedrooms,
          bathrooms: bedrooms === 1 ? '1.0' : bedrooms === 2 ? '1.5' : '2.0',
          balcony: i % 3 !== 0, // Most units have balconies
          parkingSpaceNumbers: i <= building.parkingSpaces ? [`P${i}`] : [],
          storageSpaceNumbers: [`S${i}`],
          ownershipPercentage: null, // Rentals don't have ownership percentage
          monthlyFees: bedrooms === 1 ? '1200.00' : bedrooms === 2 ? '1500.00' : '1900.00',
        });
      }
    }

    // Create residences for this building
    for (const config of residenceConfigs) {
      const [residence] = await db
        .insert(schema.residences)
        .values({
          buildingId: building.id,
          ...config,
          isActive: true,
        })
        .returning();
      residences.push({ ...residence, buildingName: building.name });
    }

    console.log(`✅ Created ${residenceConfigs.length} residences for ${building.name}`);
  }

  return residences;
}

/**
 * Create users with different roles.
 * @param organizationId
 */
async function createUsers(organizationId: string) {
  const hashedPassword = await bcrypt.hash('Demo@123456', 10);

  const userConfigs = [
    // Manager users (realistic Quebec names)
    {
      firstName: 'Sophie',
      lastName: 'Tremblay',
      email: 'sophie.tremblay@demo.com',
      role: 'manager' as const,
    },
    {
      firstName: 'Marc',
      lastName: 'Gauthier',
      email: 'marc.gauthier@demo.com',
      role: 'manager' as const,
    },

    // Tenant/Resident users (realistic Quebec and Canadian names)
    {
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@demo.com',
      role: 'tenant' as const,
    },
    { firstName: 'Bob', lastName: 'Smith', email: 'bob.smith@demo.com', role: 'resident' as const },
    {
      firstName: 'Claire',
      lastName: 'Bouchard',
      email: 'claire.bouchard@demo.com',
      role: 'tenant' as const,
    },
    {
      firstName: 'David',
      lastName: 'Wilson',
      email: 'david.wilson@demo.com',
      role: 'resident' as const,
    },
    { firstName: 'Emma', lastName: 'Côté', email: 'emma.cote@demo.com', role: 'tenant' as const },
    {
      firstName: 'Frank',
      lastName: 'Miller',
      email: 'frank.miller@demo.com',
      role: 'resident' as const,
    },
    {
      firstName: 'Gabrielle',
      lastName: 'Leclerc',
      email: 'gabrielle.leclerc@demo.com',
      role: 'tenant' as const,
    },
    {
      firstName: 'Henri',
      lastName: 'Dubois',
      email: 'henri.dubois@demo.com',
      role: 'resident' as const,
    },
    {
      firstName: 'Isabelle',
      lastName: 'Morin',
      email: 'isabelle.morin@demo.com',
      role: 'tenant' as const,
    },
    {
      firstName: 'Jacques',
      lastName: 'Anderson',
      email: 'jacques.anderson@demo.com',
      role: 'resident' as const,
    },
    { firstName: 'Katia', lastName: 'Roy', email: 'katia.roy@demo.com', role: 'tenant' as const },
    {
      firstName: 'Louis',
      lastName: 'Fournier',
      email: 'louis.fournier@demo.com',
      role: 'resident' as const,
    },
    {
      firstName: 'Marie',
      lastName: 'Lavoie',
      email: 'marie.lavoie@demo.com',
      role: 'tenant' as const,
    },
  ];

  const users = [];
  for (const config of userConfigs) {
    const [user] = await db
      .insert(schema.users)
      .values({
        username: config.email.split('@')[0],
        email: config.email,
        password: hashedPassword,
        firstName: config.firstName,
        lastName: config.lastName,
        phone: `514-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        language: 'fr',
        role: config.role,
        isActive: true,
      })
      .returning();

    // Create user-organization relationship
    await db.insert(schema.userOrganizations).values({
      userId: user.id,
      organizationId,
      organizationRole: config.role,
      canAccessAllOrganizations: false,
    });

    users.push(user);
    console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.role})`);
  }

  return users;
}

/**
 * Assign users to residences.
 * @param users
 * @param residences
 */
async function assignUsersToResidences(users: any[], residences: any[]): Promise<void> {
  const tenantUsers = users.filter((u) => u.role === 'tenant' || u.role === 'resident');

  // Assign each tenant/resident to a residence
  for (let i = 0; i < Math.min(tenantUsers.length, residences.length); i++) {
    const user = tenantUsers[i];
    const residence = residences[i];

    await db.insert(schema.userResidences).values({
      userId: user.id,
      residenceId: residence.id,
      relationshipType: user.role === 'resident' ? 'owner' : 'tenant',
      startDate: new Date('2024-01-01').toISOString().split('T')[0] as any,
      isActive: true,
    });

    console.log(
      `✅ Assigned ${user.firstName} ${user.lastName} to ${residence.buildingName} - Unit ${residence.unitNumber}`
    );
  }
}

/**
 * Create comprehensive financial data.
 * @param buildings
 * @param residences
 * @param users
 */
async function createFinancialData(
  buildings: any[],
  residences: any[],
  users: any[]
): Promise<void> {
  const adminUser = users.find((u) => u.role === 'admin' || u.role === 'manager');
  const currentYear = new Date().getFullYear();

  for (const building of buildings) {
    // Create annual budgets
    const budgetCategories = ['operational', 'reserve', 'special_project'];
    for (const category of budgetCategories) {
      await db.insert(schema.budgets).values({
        buildingId: building.id,
        year: currentYear,
        name: `${category.replace('_', ' ').toUpperCase()} Budget ${currentYear}`,
        description: `Annual ${category} budget for ${building.name}`,
        category,
        budgetedAmount:
          category === 'operational'
            ? '125000.00'
            : category === 'reserve'
              ? '50000.00'
              : '75000.00',
        actualAmount: '0.00',
        variance: '0.00',
        createdBy: adminUser.id,
        isActive: true,
      });
    }

    // Create monthly budgets for current year
    for (let month = 1; month <= 12; month++) {
      await db.insert(schema.monthlyBudgets).values({
        buildingId: building.id,
        year: currentYear,
        month,
        incomeTypes: ['monthly_fees', 'parking_fees', 'utility_reimbursement'],
        incomes: ['10500.00', '800.00', '200.00'],
        spendingTypes: ['maintenance_expense', 'administrative_expense', 'professional_services'],
        spendings: ['3500.00', '1200.00', '800.00'],
        approved: month <= new Date().getMonth() + 1,
        approvedBy: month <= new Date().getMonth() + 1 ? adminUser.id : null,
        approvedDate: month <= new Date().getMonth() + 1 ? new Date() : null,
      });
    }

    // Create bills with various statuses
    const billCategories = [
      'maintenance',
      'utilities',
      'insurance',
      'professional_services',
      'supplies',
    ];
    const billStatuses = ['paid', 'sent', 'overdue', 'draft'];

    for (let i = 0; i < 15; i++) {
      const category = billCategories[i % billCategories.length];
      const status = billStatuses[i % billStatuses.length];
      const amount = (Math.random() * 5000 + 500).toFixed(2);

      await db.insert(schema.bills).values({
        buildingId: building.id,
        billNumber: `BILL-${building.name.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        title: `${category.replace('_', ' ').toUpperCase()} - ${building.name}`,
        description: `${category} expense for building maintenance and operations`,
        category: category as any,
        vendor: `${category.toUpperCase()} Company Inc.`,
        paymentType: 'unique',
        costs: [amount],
        totalAmount: amount,
        startDate: new Date(
          currentYear,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        )
          .toISOString()
          .split('T')[0] as any,
        status: status as any,
        createdBy: adminUser.id,
      });
    }

    // Create money flow transactions
    const flowCategories = ['monthly_fees', 'bill_payment', 'maintenance_expense', 'other_income'];
    for (let i = 0; i < 20; i++) {
      const category = flowCategories[i % flowCategories.length];
      const isIncome = category.includes('fees') || category.includes('income');

      await db.insert(schema.moneyFlow).values({
        buildingId: building.id,
        type: isIncome ? 'income' : 'expense',
        category: category as any,
        description: `${category.replace('_', ' ')} transaction for ${building.name}`,
        amount: (Math.random() * 3000 + 200).toFixed(2),
        transactionDate: new Date(
          currentYear,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        )
          .toISOString()
          .split('T')[0] as any,
        referenceNumber: `REF-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`,
        isReconciled: Math.random() > 0.3,
        createdBy: adminUser.id,
      });
    }

    console.log(`✅ Created financial data for ${building.name}`);
  }
}

/**
 * Create operations data (maintenance, demands, notifications).
 * @param residences
 * @param users
 */
async function createOperationsData(residences: any[], users: any[]): Promise<void> {
  const tenantUsers = users.filter((u) => u.role === 'tenant' || u.role === 'resident');
  const managerUsers = users.filter((u) => u.role === 'manager');

  // Create maintenance requests
  const maintenanceCategories = ['plumbing', 'electrical', 'hvac', 'appliances', 'general'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['submitted', 'acknowledged', 'in_progress', 'completed'];

  for (let i = 0; i < 35; i++) {
    const residence = residences[i % residences.length];
    const submitter = tenantUsers[i % tenantUsers.length];
    const assignedTo = managerUsers[i % managerUsers.length];
    const category = maintenanceCategories[i % maintenanceCategories.length];
    const priority = priorities[i % priorities.length];
    const status = statuses[i % statuses.length];

    await db.insert(schema.maintenanceRequests).values({
      residenceId: residence.id,
      submittedBy: submitter.id,
      assignedTo: Math.random() > 0.3 ? assignedTo.id : null,
      title: `${category.toUpperCase()} Issue - Unit ${residence.unitNumber}`,
      description: `${category} maintenance request for unit ${residence.unitNumber}. Requires professional attention.`,
      category,
      priority: priority as any,
      status: status as any,
      estimatedCost: Math.random() > 0.5 ? (Math.random() * 1000 + 100).toFixed(2) : null,
      actualCost: status === 'completed' ? (Math.random() * 1000 + 100).toFixed(2) : null,
      scheduledDate:
        Math.random() > 0.6
          ? new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000)
          : null,
      completedDate:
        status === 'completed'
          ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
          : null,
      notes: status !== 'submitted' ? 'Work in progress, will update soon.' : null,
    });
  }

  // Create demands
  const demandTypes = ['maintenance', 'complaint', 'information', 'other'];
  const demandStatuses = ['submitted', 'under_review', 'approved', 'in_progress', 'completed'];

  for (let i = 0; i < 25; i++) {
    const residence = residences[i % residences.length];
    const submitter = tenantUsers[i % tenantUsers.length];
    const type = demandTypes[i % demandTypes.length];
    const status = demandStatuses[i % demandStatuses.length];

    await db.insert(schema.demands).values({
      submitterId: submitter.id,
      type: type as any,
      description: `${type.toUpperCase()} request from unit ${residence.unitNumber}: Details about the ${type} that needs attention.`,
      residenceId: residence.id,
      buildingId: residence.buildingId,
      status: status as any,
      reviewedBy: status !== 'submitted' ? managerUsers[0].id : null,
      reviewedAt: status !== 'submitted' ? new Date() : null,
      reviewNotes: status !== 'submitted' ? 'Request reviewed and being processed.' : null,
    });
  }

  // Create notifications for all users
  const notificationTypes = ['bill_reminder', 'maintenance_update', 'announcement', 'system'];
  for (const user of users) {
    for (let i = 0; i < 5; i++) {
      const type = notificationTypes[i % notificationTypes.length];

      await db.insert(schema.notifications).values({
        userId: user.id,
        type: type as any,
        title: `${type.replace('_', ' ').toUpperCase()} Notification`,
        message: `This is a ${type} notification for ${user.firstName} ${user.lastName}.`,
        isRead: Math.random() > 0.4,
        readAt:
          Math.random() > 0.4
            ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
            : null,
      });
    }
  }

  console.log('✅ Created maintenance requests, demands, and notifications');
}

/**
 * Create settings data (bugs, feature requests).
 * @param users
 */
async function createSettingsData(users: any[]): Promise<void> {
  const allUsers = users;

  // Create bug reports
  const bugCategories = ['ui_ux', 'functionality', 'performance', 'data', 'security'];
  const bugPriorities = ['low', 'medium', 'high', 'critical'];
  const bugStatuses = ['new', 'acknowledged', 'in_progress', 'resolved'];
  const pages = [
    'Dashboard',
    'Buildings',
    'Residences',
    'Bills',
    'Budget',
    'Maintenance',
    'Settings',
  ];

  for (let i = 0; i < 15; i++) {
    const user = allUsers[i % allUsers.length];
    const category = bugCategories[i % bugCategories.length];
    const priority = bugPriorities[i % bugPriorities.length];
    const status = bugStatuses[i % bugStatuses.length];
    const page = pages[i % pages.length];

    await db.insert(schema.bugs).values({
      createdBy: user.id,
      title: `${category.replace('_', ' ').toUpperCase()} issue on ${page} page`,
      description: `Detailed description of the ${category} bug found on the ${page} page. This affects user experience and needs attention.`,
      category: category as any,
      page,
      priority: priority as any,
      status: status as any,
      assignedTo: status !== 'new' ? users.find((u) => u.role === 'admin')?.id || null : null,
      resolvedAt:
        status === 'resolved'
          ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
          : null,
      resolvedBy: status === 'resolved' ? users.find((u) => u.role === 'admin')?.id || null : null,
      reproductionSteps: 'Step 1: Navigate to page\nStep 2: Perform action\nStep 3: Observe issue',
      environment: 'Chrome 119.0, Windows 11, Desktop',
    });
  }

  // Create feature requests
  const featureCategories = [
    'dashboard',
    'property_management',
    'financial_management',
    'maintenance',
    'communication',
  ];
  const featureStatuses = ['submitted', 'under_review', 'planned', 'in_progress', 'completed'];

  for (let i = 0; i < 20; i++) {
    const user = allUsers[i % allUsers.length];
    const category = featureCategories[i % featureCategories.length];
    const status = featureStatuses[i % featureStatuses.length];
    const page = pages[i % pages.length];

    const [featureRequest] = await db
      .insert(schema.featureRequests)
      .values({
        createdBy: user.id,
        title: `Enhanced ${category.replace('_', ' ')} functionality`,
        description: `Detailed feature request for improving ${category} capabilities on the ${page} page. This would enhance user productivity and satisfaction.`,
        need: `Users need better ${category} tools to manage their daily tasks more efficiently.`,
        category: category as any,
        page,
        status: status as any,
        upvoteCount: Math.floor(Math.random() * 10),
        assignedTo:
          status !== 'submitted' ? users.find((u) => u.role === 'admin')?.id || null : null,
        reviewedBy:
          status !== 'submitted' ? users.find((u) => u.role === 'admin')?.id || null : null,
        reviewedAt: status !== 'submitted' ? new Date() : null,
        adminNotes:
          status !== 'submitted'
            ? 'Feature request under consideration for next development cycle.'
            : null,
      })
      .returning();

    // Add some upvotes
    const upvoteCount = Math.floor(Math.random() * 5);
    for (let j = 0; j < upvoteCount; j++) {
      const upvoter = allUsers[(i + j) % allUsers.length];
      if (upvoter.id !== user.id) {
        await db.insert(schema.featureRequestUpvotes).values({
          featureRequestId: featureRequest.id,
          userId: upvoter.id,
        });
      }
    }
  }

  console.log('✅ Created bug reports and feature requests');
}

/**
 * Create document data.
 * @param buildings
 * @param residences
 * @param users
 */
async function createDocuments(buildings: any[], residences: any[], users: any[]): Promise<void> {
  const adminUser = users.find((u) => u.role === 'admin');

  // Create building documents
  const buildingDocTypes = [
    'Financial Reports',
    'Insurance Policies',
    'Maintenance Contracts',
    'Legal Documents',
    'Meeting Minutes',
  ];

  for (const building of buildings) {
    for (let i = 0; i < buildingDocTypes.length; i++) {
      const docType = buildingDocTypes[i];

      await db.insert(schema.documentsBuildings).values({
        name: `${docType} - ${building.name}`,
        dateReference: new Date(
          2024,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        ),
        type: docType,
        buildingId: building.id,
        fileName: `${docType.toLowerCase().replace(/\s+/g, '_')}_${building.name.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        fileSize: `${Math.floor(Math.random() * 5000) + 500}KB`,
        mimeType: 'application/pdf',
        uploadedBy: adminUser.id,
        isVisibleToTenants: docType === 'Meeting Minutes' || docType === 'Financial Reports',
      });
    }
    console.log(`✅ Created building documents for ${building.name}`);
  }

  // Create residence documents
  const residenceDocTypes = [
    'Lease Agreement',
    'Move-in Inspection',
    'Maintenance Records',
    'Insurance Claims',
  ];

  // Create documents for first 10 residences to avoid too much data
  for (let i = 0; i < Math.min(10, residences.length); i++) {
    const residence = residences[i];

    for (const docType of residenceDocTypes) {
      await db.insert(schema.documentsResidents).values({
        name: `${docType} - Unit ${residence.unitNumber}`,
        dateReference: new Date(
          2024,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1
        ),
        type: docType,
        residenceId: residence.id,
        fileName: `${docType.toLowerCase().replace(/\s+/g, '_')}_unit_${residence.unitNumber}.pdf`,
        fileSize: `${Math.floor(Math.random() * 2000) + 200}KB`,
        mimeType: 'application/pdf',
        uploadedBy: adminUser.id,
        isVisibleToTenants: docType === 'Lease Agreement' || docType === 'Move-in Inspection',
      });
    }
  }

  console.log('✅ Created residence documents');
}

/**
 * Create Open Demo organization by duplicating Demo data.
 * @param demoOrgId
 */
async function createOpenDemoOrganization(demoOrgId: string): Promise<void> {
  console.log('Creating Open Demo organization as a copy of Demo...');

  // Find Open Demo organization
  const openDemoOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.name, 'Open Demo'),
  });

  if (!openDemoOrg) {
    throw new Error('Open Demo organization not found');
  }

  // The actual duplication logic will be handled by the sync service
  // For now, we just ensure the Open Demo organization exists
  console.log('✅ Open Demo organization ready for synchronization');
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createComprehensiveDemo().catch(console.error);
}

export { createComprehensiveDemo };
