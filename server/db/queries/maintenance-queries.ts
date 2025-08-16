import { eq, and, desc, asc, inArray, ilike, or } from 'drizzle-orm';
import { maintenanceRequests, residences, buildings, users } from '@shared/schema';
import { db } from '../../db';
import { scopeQuery, type UserContext } from './scope-query';

/**
 * Get all maintenance requests accessible to the user based on their role and associations.
 * Tenants see only their own requests, managers/owners see requests for their properties.
 * 
 * @param userContext - User context containing role and entity associations.
 * @returns Promise resolving to array of maintenance requests the user can access.
 */
export async function getMaintenanceRequestsForUser(userContext: UserContext) {
  const baseQuery = db
    .select({
      id: maintenanceRequests.id,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      estimatedCost: maintenanceRequests.estimatedCost,
      actualCost: maintenanceRequests.actualCost,
      scheduledDate: maintenanceRequests.scheduledDate,
      completedDate: maintenanceRequests.completedDate,
      residenceId: maintenanceRequests.residenceId,
      submittedBy: maintenanceRequests.submittedBy,
      assignedTo: maintenanceRequests.assignedTo,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      // Include residence and building context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
      // Include submitter information
      submitterName: users.firstName,
      submitterLastName: users.lastName,
    })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(users, eq(maintenanceRequests.submittedBy, users.id))
    .orderBy(desc(maintenanceRequests.createdAt));

  return await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
}

/**
 * Get maintenance requests for a specific residence with role-based access control.
 * 
 * @param residenceId - The residence ID to get maintenance requests for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of maintenance requests for the residence.
 */
export async function getMaintenanceRequestsForResidence(residenceId: string, userContext: UserContext) {
  const baseQuery = db
    .select()
    .from(maintenanceRequests)
    .where(eq(maintenanceRequests.residenceId, residenceId))
    .orderBy(desc(maintenanceRequests.createdAt));

  return await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
}

/**
 * Get maintenance requests by status with role-based filtering.
 * 
 * @param status - Maintenance request status to filter by.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of maintenance requests with the specified status.
 */
export async function getMaintenanceRequestsByStatus(
  status: 'submitted' | 'acknowledged' | 'in_progress' | 'completed' | 'cancelled',
  userContext: UserContext
) {
  const baseQuery = db
    .select({
      id: maintenanceRequests.id,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      estimatedCost: maintenanceRequests.estimatedCost,
      scheduledDate: maintenanceRequests.scheduledDate,
      residenceId: maintenanceRequests.residenceId,
      submittedBy: maintenanceRequests.submittedBy,
      assignedTo: maintenanceRequests.assignedTo,
      createdAt: maintenanceRequests.createdAt,
      // Include context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      submitterName: users.firstName,
      submitterLastName: users.lastName,
    })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(users, eq(maintenanceRequests.submittedBy, users.id))
    .where(eq(maintenanceRequests.status, status))
    .orderBy(desc(maintenanceRequests.createdAt));

  return await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
}

/**
 * Get urgent maintenance requests with role-based filtering.
 * Returns requests with high, urgent, or emergency priority.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of urgent maintenance requests.
 */
export async function getUrgentMaintenanceRequests(userContext: UserContext) {
  const baseQuery = db
    .select({
      id: maintenanceRequests.id,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      estimatedCost: maintenanceRequests.estimatedCost,
      scheduledDate: maintenanceRequests.scheduledDate,
      residenceId: maintenanceRequests.residenceId,
      submittedBy: maintenanceRequests.submittedBy,
      assignedTo: maintenanceRequests.assignedTo,
      createdAt: maintenanceRequests.createdAt,
      // Include context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
      submitterName: users.firstName,
      submitterLastName: users.lastName,
    })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(users, eq(maintenanceRequests.submittedBy, users.id))
    .where(
      and(
        inArray(maintenanceRequests.priority, ['high', 'urgent', 'emergency']),
        inArray(maintenanceRequests.status, ['submitted', 'acknowledged', 'in_progress'])
      )
    )
    .orderBy(
      // Priority order: emergency > urgent > high
      asc(maintenanceRequests.priority), 
      desc(maintenanceRequests.createdAt)
    );

  return await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
}

/**
 * Get maintenance requests assigned to a specific user with role-based filtering.
 * 
 * @param assignedUserId - User ID of the assigned person.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of assigned maintenance requests.
 */
export async function getMaintenanceRequestsAssignedTo(assignedUserId: string, userContext: UserContext) {
  const baseQuery = db
    .select({
      id: maintenanceRequests.id,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      estimatedCost: maintenanceRequests.estimatedCost,
      actualCost: maintenanceRequests.actualCost,
      scheduledDate: maintenanceRequests.scheduledDate,
      completedDate: maintenanceRequests.completedDate,
      residenceId: maintenanceRequests.residenceId,
      submittedBy: maintenanceRequests.submittedBy,
      assignedTo: maintenanceRequests.assignedTo,
      createdAt: maintenanceRequests.createdAt,
      // Include context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      submitterName: users.firstName,
      submitterLastName: users.lastName,
    })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(users, eq(maintenanceRequests.submittedBy, users.id))
    .where(eq(maintenanceRequests.assignedTo, assignedUserId))
    .orderBy(asc(maintenanceRequests.scheduledDate), desc(maintenanceRequests.createdAt));

  return await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
}

/**
 * Search maintenance requests by keyword with role-based filtering.
 * Searches in title, description, and category fields.
 * 
 * @param searchTerm - Search term to look for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of matching maintenance requests.
 */
export async function searchMaintenanceRequests(searchTerm: string, userContext: UserContext) {
  const searchPattern = `%${searchTerm}%`;
  
  const baseQuery = db
    .select({
      id: maintenanceRequests.id,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      estimatedCost: maintenanceRequests.estimatedCost,
      scheduledDate: maintenanceRequests.scheduledDate,
      residenceId: maintenanceRequests.residenceId,
      submittedBy: maintenanceRequests.submittedBy,
      assignedTo: maintenanceRequests.assignedTo,
      createdAt: maintenanceRequests.createdAt,
      // Include context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      submitterName: users.firstName,
      submitterLastName: users.lastName,
    })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(users, eq(maintenanceRequests.submittedBy, users.id))
    .where(
      or(
        ilike(maintenanceRequests.title, searchPattern),
        ilike(maintenanceRequests.description, searchPattern),
        ilike(maintenanceRequests.category, searchPattern)
      )
    )
    .orderBy(desc(maintenanceRequests.createdAt));

  return await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
}

/**
 * Get a single maintenance request by ID with role-based access control.
 * 
 * @param requestId - The maintenance request ID to retrieve.
 * @param userContext - User context for access control.
 * @returns Promise resolving to the maintenance request if accessible, undefined otherwise.
 */
export async function getMaintenanceRequestById(requestId: string, userContext: UserContext) {
  const baseQuery = db
    .select({
      id: maintenanceRequests.id,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      category: maintenanceRequests.category,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      estimatedCost: maintenanceRequests.estimatedCost,
      actualCost: maintenanceRequests.actualCost,
      scheduledDate: maintenanceRequests.scheduledDate,
      completedDate: maintenanceRequests.completedDate,
      notes: maintenanceRequests.notes,
      images: maintenanceRequests.images,
      residenceId: maintenanceRequests.residenceId,
      submittedBy: maintenanceRequests.submittedBy,
      assignedTo: maintenanceRequests.assignedTo,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      // Include full context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
      submitterName: users.firstName,
      submitterLastName: users.lastName,
      submitterEmail: users.email,
      submitterPhone: users.phone,
    })
    .from(maintenanceRequests)
    .innerJoin(residences, eq(maintenanceRequests.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .innerJoin(users, eq(maintenanceRequests.submittedBy, users.id))
    .where(eq(maintenanceRequests.id, requestId));

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'maintenanceRequests');
  const results = await scopedQuery;
  return results[0];
}

/**
 * Get maintenance request summary statistics for the user's accessible data.
 * Provides aggregated information scoped to user's permissions.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to maintenance request summary statistics.
 */
export async function getMaintenanceRequestSummary(userContext: UserContext) {
  // First get all accessible maintenance request IDs
  const accessibleRequestsQuery = await scopeQuery(
    db.select({ id: maintenanceRequests.id }).from(maintenanceRequests),
    userContext,
    'maintenanceRequests'
  );
  
  const accessibleRequests = await accessibleRequestsQuery;
  const requestIds = accessibleRequests.map((r: { id: string }) => r.id);
  
  if (requestIds.length === 0) {
    return {
      totalRequests: 0,
      submittedCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      urgentCount: 0,
      totalEstimatedCost: '0',
      totalActualCost: '0',
    };
  }

  // Get summary statistics for accessible requests
  const summaryQuery = await db
    .select({
      id: maintenanceRequests.id,
      status: maintenanceRequests.status,
      priority: maintenanceRequests.priority,
      estimatedCost: maintenanceRequests.estimatedCost,
      actualCost: maintenanceRequests.actualCost,
    })
    .from(maintenanceRequests)
    .where(inArray(maintenanceRequests.id, requestIds));

  const summary = await summaryQuery;
  
  // Process the results to calculate totals
  let totalRequests = 0;
  let submittedCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let urgentCount = 0;
  let totalEstimatedCost = 0;
  let totalActualCost = 0;

  summary.forEach((row: any) => {
    totalRequests++;
    
    // Count by status
    if (row.status === 'submitted') {submittedCount++;}
    else if (['acknowledged', 'in_progress'].includes(row.status)) {inProgressCount++;}
    else if (row.status === 'completed') {completedCount++;}
    
    // Count urgent requests
    if (['high', 'urgent', 'emergency'].includes(row.priority)) {urgentCount++;}
    
    // Sum costs
    totalEstimatedCost += parseFloat(row.estimatedCost || '0');
    totalActualCost += parseFloat(row.actualCost || '0');
  });

  return {
    totalRequests,
    submittedCount,
    inProgressCount,
    completedCount,
    urgentCount,
    totalEstimatedCost: totalEstimatedCost.toFixed(2),
    totalActualCost: totalActualCost.toFixed(2),
  };
}