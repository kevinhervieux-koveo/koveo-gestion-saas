/**
 * Database Queries with Role-Based Access Control.
 * 
 * This module provides a comprehensive set of database query functions that
 * automatically apply role-based data scoping for the Quebec property management system.
 * 
 * All queries use the `scopeQuery` function to ensure users only access data
 * they have permission to see based on their role and entity associations.
 * 
 * @example
 * ```typescript
 * import { getBillsForUser, buildUserContext } from '@/server/db/queries';
 * 
 * // Build user context from session
 * const userContext = await buildUserContext(userId, userRole);
 * 
 * // Get scoped bills for the user
 * const bills = await getBillsForUser(userContext);
 * ```
 */

// Export core scoping functionality
export {
  scopeQuery,
  buildUserContext,
  getUserAccessibleResidenceIds,
  getUserAccessibleBuildingIds,
  type UserContext,
  type ScopedQuery,
  SCOPE_CONFIG
} from './scope-query';

// Export bill-related queries
export {
  getBillsForUser,
  getBillsForResidence,
  getOverdueBills,
  getBillsByStatus,
  getBillsByDateRange,
  getBillById,
  getBillSummary
} from './bills-queries';

// Export maintenance request queries
export {
  getMaintenanceRequestsForUser,
  getMaintenanceRequestsForResidence,
  getMaintenanceRequestsByStatus,
  getUrgentMaintenanceRequests,
  getMaintenanceRequestsAssignedTo,
  searchMaintenanceRequests,
  getMaintenanceRequestById,
  getMaintenanceRequestSummary
} from './maintenance-queries';

// Export building-related queries
export {
  getBuildingsForUser,
  getBuildingById,
  getBuildingsByOrganization,
  searchBuildings,
  getBuildingStatistics,
  getBuildingsWithOccupancy,
  getBuildingsByType,
  getBuildingSummary
} from './building-queries';

// Export user-related queries
export {
  getUsersForUser,
  getUserById,
  getUsersByRole,
  searchUsers,
  getUsersForResidence,
  getUsersForBuilding,
  getCurrentUserProfile,
  getUserSummary
} from './user-queries';

/**
 * Query category constants for easier organization.
 */
export const QUERY_CATEGORIES = {
  BILLS: 'bills',
  MAINTENANCE: 'maintenance',
  BUILDINGS: 'buildings',
  USERS: 'users',
  RESIDENCES: 'residences',
  ORGANIZATIONS: 'organizations',
} as const;

/**
 * Helper function to validate user context before running queries.
 * 
 * @param userContext - User context to validate.
 * @returns Boolean indicating if the context is valid.
 */
/**
 * IsValidUserContext function.
 * @param userContext
 * @returns Function result.
 */
export function isValidUserContext(userContext: unknown): userContext is import('./scope-query').UserContext {
  return (
    userContext &&
    typeof userContext.userId === 'string' &&
    typeof userContext.role === 'string' &&
    ['admin', 'manager', 'tenant', 'resident'].includes(userContext.role)
  );
}