#!/usr/bin/env tsx

/**
 * Script to populate default notification preferences for existing users.
 * Creates default preferences for all 15 notification types with:
 * - frequency: 'monthly'
 * - isEnabled: false
 * 
 * Only creates preferences for users who don't already have them.
 * Safe to run multiple times - won't overwrite existing preferences.
 *
 * Usage: tsx server/scripts/populate-default-notification-preferences.ts
 */

import { db } from '../db';
import { users, userNotificationPreferences } from '@shared/schema';
import { eq, notInArray } from 'drizzle-orm';

// All 15 notification types that should have default preferences
const ALL_NOTIFICATION_TYPES = [
  'bill_reminder',
  'maintenance_update', 
  'announcement',
  'system',
  'upcoming_payment',
  'upcoming_bills',
  'bill_paid_last_month',
  'bills_overdue',
  'payment_overdue',
  'new_building_document',
  'meeting_invite',
  'maintenance_completed',
  'budget_update',
  'policy_change',
  'seasonal_reminder',
] as const;

/**
 * Main function to populate default notification preferences.
 */
async function main() {
  try {
    console.log('🔧 Starting default notification preferences population...');
    
    // Get all active users
    const allUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.isActive, true));
    
    console.log(`📊 Found ${allUsers.length} active users`);
    
    if (allUsers.length === 0) {
      console.log('ℹ️ No active users found. Nothing to do.');
      return;
    }

    // Get users who already have notification preferences
    const usersWithPreferences = await db
      .selectDistinct({ userId: userNotificationPreferences.userId })
      .from(userNotificationPreferences);
    
    const userIdsWithPreferences = new Set(usersWithPreferences.map(p => p.userId));
    console.log(`📋 ${userIdsWithPreferences.size} users already have some notification preferences`);
    
    // Filter to users who need default preferences
    const usersNeedingPreferences = allUsers.filter(user => !userIdsWithPreferences.has(user.id));
    console.log(`🆕 ${usersNeedingPreferences.length} users need default notification preferences`);
    
    if (usersNeedingPreferences.length === 0) {
      console.log('✅ All users already have notification preferences. Nothing to do.');
      return;
    }

    // Create default preferences for users who need them
    let totalCreated = 0;
    
    for (const user of usersNeedingPreferences) {
      console.log(`📝 Creating default preferences for user: ${user.email}`);
      
      const defaultPreferences = ALL_NOTIFICATION_TYPES.map(notificationType => ({
        userId: user.id,
        notificationType: notificationType as any,
        frequency: 'monthly' as any,
        isEnabled: false,
      }));
      
      try {
        await db.insert(userNotificationPreferences).values(defaultPreferences);
        totalCreated += defaultPreferences.length;
        console.log(`  ✅ Created ${defaultPreferences.length} preferences for ${user.email}`);
      } catch (error) {
        console.error(`  ❌ Error creating preferences for ${user.email}:`, error);
      }
    }
    
    console.log(`\n🎉 Successfully created ${totalCreated} default notification preferences`);
    console.log(`📈 Summary:`);
    console.log(`  - Total active users: ${allUsers.length}`);
    console.log(`  - Users with existing preferences: ${userIdsWithPreferences.size}`);
    console.log(`  - Users needing default preferences: ${usersNeedingPreferences.length}`);
    console.log(`  - Total preferences created: ${totalCreated}`);
    
    // Verify the results
    const finalCount = await db
      .selectDistinct({ userId: userNotificationPreferences.userId })
      .from(userNotificationPreferences);
    
    console.log(`\n✅ Verification: ${finalCount.length} users now have notification preferences`);
    
  } catch (error) {
    console.error('❌ Error populating default notification preferences:', error);
    process.exit(1);
  }
}

/**
 * API endpoint version for populating default preferences.
 * Can be called via POST /api/communication/populate-defaults
 */
export async function populateDefaultPreferences(): Promise<{
  success: boolean;
  message: string;
  statistics: {
    totalUsers: number;
    usersWithPreferences: number;
    usersNeedingDefaults: number;
    preferencesCreated: number;
  };
}> {
  try {
    // Get all active users
    const allUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.isActive, true));
    
    // Get users who already have notification preferences
    const usersWithPreferences = await db
      .selectDistinct({ userId: userNotificationPreferences.userId })
      .from(userNotificationPreferences);
    
    const userIdsWithPreferences = new Set(usersWithPreferences.map(p => p.userId));
    const usersNeedingPreferences = allUsers.filter(user => !userIdsWithPreferences.has(user.id));
    
    let totalCreated = 0;
    
    // Create default preferences for users who need them
    for (const user of usersNeedingPreferences) {
      const defaultPreferences = ALL_NOTIFICATION_TYPES.map(notificationType => ({
        userId: user.id,
        notificationType: notificationType as any,
        frequency: 'monthly' as any,
        isEnabled: false,
      }));
      
      await db.insert(userNotificationPreferences).values(defaultPreferences);
      totalCreated += defaultPreferences.length;
    }
    
    return {
      success: true,
      message: `Successfully created default notification preferences for ${usersNeedingPreferences.length} users`,
      statistics: {
        totalUsers: allUsers.length,
        usersWithPreferences: userIdsWithPreferences.size,
        usersNeedingDefaults: usersNeedingPreferences.length,
        preferencesCreated: totalCreated,
      },
    };
  } catch (error) {
    console.error('Error in populateDefaultPreferences:', error);
    return {
      success: false,
      message: `Error creating default preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
      statistics: {
        totalUsers: 0,
        usersWithPreferences: 0,
        usersNeedingDefaults: 0,
        preferencesCreated: 0,
      },
    };
  }
}

// NOTE: Automatic execution disabled for bundled environments
// To run this script manually: tsx server/scripts/populate-default-notification-preferences.ts
// Or call via API: POST /api/communication/populate-defaults

export { main };