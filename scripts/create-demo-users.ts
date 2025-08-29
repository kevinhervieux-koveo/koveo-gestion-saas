/**
 * Script to create demo users for the Demo organization with @demo.com emails
 */

import { db } from '../server/db';
import { users, userOrganizations } from '../shared/schema';
import { hashPassword } from '../server/auth';

const DEMO_PASSWORD = 'Demo@123456';
const DEMO_ORG_ID = '8c6de72f-057c-4ac5-9372-dd7bc74e32f4'; // Demo organization ID

const demoUsers = [
  {
    username: 'marie.demo.manager',
    email: 'marie.dubois@demo.com',
    firstName: 'Marie',
    lastName: 'Dubois',
    role: 'demo_manager' as const,
    phone: '514-555-0101',
  },
  {
    username: 'jean.demo.tenant',
    email: 'jean.tremblay@demo.com',
    firstName: 'Jean',
    lastName: 'Tremblay',
    role: 'demo_tenant' as const,
    phone: '514-555-0102',
  },
  {
    username: 'sophie.demo.resident',
    email: 'sophie.martin@demo.com',
    firstName: 'Sophie',
    lastName: 'Martin',
    role: 'demo_resident' as const,
    phone: '514-555-0103',
  },
  {
    username: 'pierre.demo.manager',
    email: 'pierre.gagnon@demo.com',
    firstName: 'Pierre',
    lastName: 'Gagnon',
    role: 'demo_manager' as const,
    phone: '514-555-0104',
  },
  {
    username: 'lucie.demo.tenant',
    email: 'lucie.roy@demo.com',
    firstName: 'Lucie',
    lastName: 'Roy',
    role: 'demo_tenant' as const,
    phone: '514-555-0105',
  },
  {
    username: 'michel.demo.resident',
    email: 'michel.cote@demo.com',
    firstName: 'Michel',
    lastName: 'Côté',
    role: 'demo_resident' as const,
    phone: '514-555-0106',
  },
];

async function createDemoUsers() {
  try {
    console.log('🚀 Creating demo users...');
    const hashedPassword = await hashPassword(DEMO_PASSWORD);

    for (const userData of demoUsers) {
      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          language: 'fr',
          role: userData.role,
          isActive: true,
        })
        .returning({ id: users.id, email: users.email });

      // Add user to Demo organization
      await db.insert(userOrganizations).values({
        userId: newUser.id,
        organizationId: DEMO_ORG_ID,
        organizationRole: userData.role,
        isActive: true,
      });

      console.log(
        `✅ Created demo user: ${userData.firstName} ${userData.lastName} (${userData.email})`
      );
    }

    console.log('🎉 All demo users created successfully!');
    console.log(`📧 All users can login with password: ${DEMO_PASSWORD}`);
  } catch (error) {
    console.error('❌ Error creating demo users:', error);
    throw error;
  }
}

// Run the script
createDemoUsers().catch(console.error);
