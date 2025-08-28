/**
 * Script to set up read-only permissions for demo roles
 */

import { db } from '../server/db';
import { permissions, rolePermissions } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function setupDemoPermissions() {
  try {
    console.log('🚀 Setting up demo role permissions...');

    // Get all read permissions
    const readPermissions = await db
      .select()
      .from(permissions)
      .where(eq(permissions.action, 'read'));

    console.log(`📚 Found ${readPermissions.length} read permissions`);

    // Map demo roles to their corresponding non-demo roles for permission copying
    const roleMapping = {
      demo_manager: 'manager',
      demo_tenant: 'tenant', 
      demo_resident: 'resident'
    };

    for (const [demoRole, originalRole] of Object.entries(roleMapping)) {
      console.log(`🔧 Setting up permissions for ${demoRole} (based on ${originalRole})`);

      // Grant all read permissions to demo roles
      for (const permission of readPermissions) {
        try {
          await db
            .insert(rolePermissions)
            .values({
              role: demoRole as any,
              permissionId: permission.id,
            })
            .onConflictDoNothing(); // Avoid duplicate entries

          console.log(`  ✅ Granted ${permission.name} to ${demoRole}`);
        } catch (error) {
          console.log(`  ⚠️  Permission ${permission.name} already exists for ${demoRole}`);
        }
      }
    }

    console.log('🎉 Demo role permissions setup complete!');
    console.log('📖 All demo roles now have read-only access to all resources');
  } catch (error) {
    console.error('❌ Error setting up demo permissions:', error);
    throw error;
  }
}

// Run the script
setupDemoPermissions().catch(console.error);