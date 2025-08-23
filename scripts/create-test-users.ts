import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import { hashPassword } from '../server/auth';
import { randomBytes } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Test user credentials - these will be saved to a separate file
const testUsers = [
  {
    username: 'test_manager',
    email: 'manager@563pionniers.test',
    password: 'TestManager2024!',
    firstName: 'Sophie',
    lastName: 'Tremblay',
    phone: '514-555-0101',
    role: 'manager' as const,
    language: 'fr'
  },
  {
    username: 'test_tenant',
    email: 'tenant@563pionniers.test',
    password: 'TestTenant2024!',
    firstName: 'Marc',
    lastName: 'Dubois',
    phone: '514-555-0102',
    role: 'tenant' as const,
    language: 'fr'
  },
  {
    username: 'test_resident',
    email: 'resident@563pionniers.test',
    password: 'TestResident2024!',
    firstName: 'Julie',
    lastName: 'Laflamme',
    phone: '514-555-0103',
    role: 'resident' as const,
    language: 'fr'
  }
];

const BUILDING_ID = '005b0e63-6a0a-44c9-bf01-2b779b316bba'; // 563 montée des pionniers
const ORGANIZATION_ID = '72263718-6559-4216-bd93-524f7acdcbbc'; // 563 montée des pionniers org
const RESIDENCES = {
  unit102: '4a0987f4-dd0a-4d4f-8d3b-839edd3b4c05', // For tenant
  unit103: '2d325292-eca7-4c47-a161-90ee34130e09'  // For resident
};

async function createTestUsers() {
  console.log('🏗️  Creating test users for 563 montée des pionniers...');
  
  try {
    // Create the users
    for (const userData of testUsers) {
      console.log(`Creating user: ${userData.firstName} ${userData.lastName} (${userData.role})`);
      
      // Hash the password
      const { salt, hash } = hashPassword(userData.password);
      const combinedPassword = `${salt}:${hash}`; // Store salt and hash together
      
      // Create user
      const [user] = await db.insert(schema.users).values({
        username: userData.username,
        email: userData.email,
        password: combinedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        language: userData.language
      }).returning();
      
      console.log(`✅ Created user: ${user.id}`);
      
      // Add user to organization
      await db.insert(schema.userOrganizations).values({
        userId: user.id,
        organizationId: ORGANIZATION_ID,
        organizationRole: userData.role,
        isActive: true,
        canAccessAllOrganizations: false
      });
      
      console.log(`✅ Added ${userData.role} to organization`);
      
      // Add tenant and resident to specific residences
      if (userData.role === 'tenant') {
        await db.insert(schema.userResidences).values({
          userId: user.id,
          residenceId: RESIDENCES.unit102,
          relationshipType: 'tenant',
          startDate: new Date('2024-01-01'),
          isActive: true
        });
        console.log(`✅ Assigned tenant to unit 102`);
      } else if (userData.role === 'resident') {
        await db.insert(schema.userResidences).values({
          userId: user.id,
          residenceId: RESIDENCES.unit103,
          relationshipType: 'owner',
          startDate: new Date('2024-01-01'),
          isActive: true
        });
        console.log(`✅ Assigned resident to unit 103`);
      }
    }
    
    console.log('\n🎉 All test users created successfully!');
    console.log('\n📝 Credentials saved to test-users-credentials.txt');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script if called directly
createTestUsers().catch(console.error);

export { testUsers, createTestUsers };