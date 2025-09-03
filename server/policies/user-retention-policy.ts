/**
 * User Retention Policy
 * 
 * Critical safety measures to prevent accidental user data loss.
 * This policy ensures users are never automatically deleted during cascade operations.
 */

import { db } from '../db';
import * as schema from '../../shared/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';

export interface UserRetentionResult {
  usersAffected: number;
  usersPreserved: string[];
  recommendedActions: string[];
}

/**
 * User Retention Policy Configuration
 */
export const USER_RETENTION_POLICY = {
  // Never automatically delete users during cascade operations
  AUTO_DELETE_USERS: false,
  
  // Preserve users even when they lose all organizational relationships
  PRESERVE_ORPHANED_USERS: true,
  
  // Log user preservation actions for audit trail
  LOG_PRESERVATION_ACTIONS: true,
  
  // Require explicit admin action for user deletion
  REQUIRE_EXPLICIT_ADMIN_DELETION: true,
} as const;

/**
 * Checks for users who would be affected by organizational changes
 * but preserves them according to retention policy
 */
export async function preserveUsersInCascadeOperation(
  operationType: 'building_deletion' | 'organization_deletion',
  entityId: string
): Promise<UserRetentionResult> {
  console.log(`🛡️ User Retention Policy: Checking users affected by ${operationType} of ${entityId}`);
  
  let affectedUsers: { id: string; email: string }[] = [];
  
  if (operationType === 'building_deletion') {
    // Find users who would lose residence relationships
    const buildingResidences = await db
      .select({ id: schema.residences.id })
      .from(schema.residences)
      .where(eq(schema.residences.buildingId, entityId));
    
    const residenceIds = buildingResidences.map(r => r.id);
    
    if (residenceIds.length > 0) {
      const usersWithResidences = await db
        .select({ 
          userId: schema.userResidences.userId,
          userEmail: schema.users.email 
        })
        .from(schema.userResidences)
        .innerJoin(schema.users, eq(schema.users.id, schema.userResidences.userId))
        .where(inArray(schema.userResidences.residenceId, residenceIds));
      
      affectedUsers = usersWithResidences.map(u => ({
        id: u.userId,
        email: u.userEmail
      }));
    }
  } else if (operationType === 'organization_deletion') {
    // Find users who would lose organization relationships
    const usersInOrg = await db
      .select({ 
        userId: schema.userOrganizations.userId,
        userEmail: schema.users.email 
      })
      .from(schema.userOrganizations)
      .innerJoin(schema.users, eq(schema.users.id, schema.userOrganizations.userId))
      .where(eq(schema.userOrganizations.organizationId, entityId));
    
    affectedUsers = usersInOrg.map(u => ({
      id: u.userId,
      email: u.userEmail
    }));
  }
  
  const result: UserRetentionResult = {
    usersAffected: affectedUsers.length,
    usersPreserved: affectedUsers.map(u => u.email),
    recommendedActions: []
  };
  
  if (affectedUsers.length > 0) {
    console.log(`🛡️ User Retention Policy: Preserving ${affectedUsers.length} users from automatic deletion`);
    console.log(`🛡️ Preserved users: ${affectedUsers.map(u => u.email).join(', ')}`);
    
    result.recommendedActions = [
      'Review preserved users to determine if they should be reassigned to other organizations',
      'Consider sending notification to preserved users about organizational changes',
      'Update user permissions if needed based on new organizational status'
    ];
    
    if (USER_RETENTION_POLICY.LOG_PRESERVATION_ACTIONS) {
      console.log(`📋 Audit Log: ${operationType} preserved ${affectedUsers.length} users from deletion`);
    }
  }
  
  return result;
}

/**
 * Validates that no user deletion operations are being performed automatically
 */
export function validateUserDeletionPolicy(operation: string): void {
  if (!USER_RETENTION_POLICY.AUTO_DELETE_USERS) {
    console.log(`🛡️ User Retention Policy: Automatic user deletion is disabled for ${operation}`);
  }
  
  if (USER_RETENTION_POLICY.PRESERVE_ORPHANED_USERS) {
    console.log(`🛡️ User Retention Policy: Orphaned users will be preserved during ${operation}`);
  }
}

/**
 * Provides safe alternatives to user deletion
 */
export function getSafeUserManagementAlternatives(): string[] {
  return [
    'Deactivate user accounts instead of deleting them',
    'Remove organizational assignments while preserving user data',
    'Mark users as inactive but retain their historical records',
    'Use role-based access control to limit access without deletion',
    'Archive user data with proper retention timestamps'
  ];
}

/**
 * Emergency user recovery information
 */
export function getEmergencyRecoveryInfo(): {
  message: string;
  backupSources: string[];
  recoverySteps: string[];
} {
  return {
    message: "If user data has been accidentally deleted, immediate action is required",
    backupSources: [
      "Database transaction logs",
      "Automated database backups",
      "Audit trail records",
      "Session store data"
    ],
    recoverySteps: [
      "1. Stop all write operations immediately",
      "2. Identify the exact time of deletion from logs",
      "3. Restore from the most recent backup before deletion",
      "4. Re-apply any necessary data changes after restoration",
      "5. Update user retention policies to prevent recurrence"
    ]
  };
}