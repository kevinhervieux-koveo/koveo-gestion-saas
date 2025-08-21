import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { bills, residences, buildings, userResidences } from '@shared/schema';
import { db } from '../../db';
import { scopeQuery, type UserContext } from './scope-query';

/**
 * Get all bills accessible to the user based on their role and associations.
 * This query automatically applies role-based filtering.
 * 
 * @param userContext - User context containing role and entity associations.
 * @returns Promise resolving to array of bills the user can access.
 */
/**
 * GetBillsForUser function.
 * @param userContext
 * @returns Function result.
 */
export async function getBillsForUser(userContext: UserContext) {
  const baseQuery = db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      type: bills.type,
      description: bills.description,
      amount: bills.amount,
      dueDate: bills.dueDate,
      issueDate: bills.issueDate,
      status: bills.status,
      finalAmount: bills.finalAmount,
      paymentReceivedDate: bills.paymentReceivedDate,
      residenceId: bills.residenceId,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .orderBy(desc(bills.dueDate));

  return await scopeQuery(baseQuery, userContext, 'bills');
}

/**
 * Get bills for a specific residence with role-based access control.
 * Users can only see bills for residences they have access to.
 * 
 * @param residenceId - The residence ID to get bills for.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of bills for the residence.
 */
/**
 * GetBillsForResidence function.
 * @param residenceId
 * @param userContext
 * @returns Function result.
 */
export async function getBillsForResidence(residenceId: string, userContext: UserContext) {
  const baseQuery = db
    .select()
    .from(bills)
    .where(eq(bills.residenceId, residenceId))
    .orderBy(desc(bills.dueDate));

  return await scopeQuery(baseQuery, userContext, 'bills');
}

/**
 * Get overdue bills with role-based filtering.
 * Managers see overdue bills for all their managed properties,
 * owners see overdue bills for their properties,
 * tenants see only their own overdue bills.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of overdue bills.
 */
/**
 * GetOverdueBills function.
 * @param userContext
 * @returns Function result.
 */
export async function getOverdueBills(userContext: UserContext) {
  const today = new Date().toISOString().split('T')[0];
  
  const baseQuery = db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      type: bills.type,
      description: bills.description,
      amount: bills.amount,
      dueDate: bills.dueDate,
      status: bills.status,
      finalAmount: bills.finalAmount,
      residenceId: bills.residenceId,
      // Include residence and building info for context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
    })
    .from(bills)
    .innerJoin(residences, eq(bills.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .where(
      and(
        lte(bills.dueDate, today),
        inArray(bills.status, ['sent', 'overdue'] as const)
      )
    )
    .orderBy(desc(bills.dueDate));

  return await scopeQuery(baseQuery, userContext, 'bills');
}

/**
 * Get bills by status with role-based filtering.
 * 
 * @param status - Bill status to filter by.
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of bills with the specified status.
 */
/**
 * GetBillsByStatus function.
 * @param status
 * @param userContext
 * @returns Function result.
 */
export async function getBillsByStatus(
  status: 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled',
  userContext: UserContext
) {
  const baseQuery = db
    .select()
    .from(bills)
    .where(eq(bills.status, status))
    .orderBy(desc(bills.createdAt));

  return await scopeQuery(baseQuery, userContext, 'bills');
}

/**
 * Get bills within a date range with role-based filtering.
 * Useful for financial reporting and analysis.
 * 
 * @param startDate - Start date (YYYY-MM-DD format).
 * @param endDate - End date (YYYY-MM-DD format).
 * @param userContext - User context for access control.
 * @returns Promise resolving to array of bills within the date range.
 */
/**
 * GetBillsByDateRange function.
 * @param startDate
 * @param endDate
 * @param userContext
 * @returns Function result.
 */
export async function getBillsByDateRange(
  startDate: string,
  endDate: string,
  userContext: UserContext
) {
  const baseQuery = db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      type: bills.type,
      description: bills.description,
      amount: bills.amount,
      dueDate: bills.dueDate,
      issueDate: bills.issueDate,
      status: bills.status,
      finalAmount: bills.finalAmount,
      paymentReceivedDate: bills.paymentReceivedDate,
      residenceId: bills.residenceId,
      // Include residence context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
    })
    .from(bills)
    .innerJoin(residences, eq(bills.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .where(
      and(
        gte(bills.issueDate, startDate),
        lte(bills.issueDate, endDate)
      )
    )
    .orderBy(desc(bills.issueDate));

  return await scopeQuery(baseQuery, userContext, 'bills');
}

/**
 * Get a single bill by ID with role-based access control.
 * Users can only access bills for residences they have access to.
 * 
 * @param billId - The bill ID to retrieve.
 * @param userContext - User context for access control.
 * @returns Promise resolving to the bill if accessible, undefined otherwise.
 */
/**
 * GetBillById function.
 * @param billId
 * @param userContext
 * @returns Function result.
 */
export async function getBillById(billId: string, userContext: UserContext) {
  const baseQuery = db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      type: bills.type,
      description: bills.description,
      amount: bills.amount,
      dueDate: bills.dueDate,
      issueDate: bills.issueDate,
      status: bills.status,
      notes: bills.notes,
      lateFeeAmount: bills.lateFeeAmount,
      discountAmount: bills.discountAmount,
      finalAmount: bills.finalAmount,
      paymentReceivedDate: bills.paymentReceivedDate,
      residenceId: bills.residenceId,
      createdBy: bills.createdBy,
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
      // Include residence and building context
      unitNumber: residences.unitNumber,
      buildingName: buildings.name,
      buildingAddress: buildings.address,
    })
    .from(bills)
    .innerJoin(residences, eq(bills.residenceId, residences.id))
    .innerJoin(buildings, eq(residences.buildingId, buildings.id))
    .where(eq(bills.id, billId));

  const scopedQuery = await scopeQuery(baseQuery, userContext, 'bills');
  const results = await scopedQuery;
  return results[0];
}

/**
 * Get bill summary statistics for the user's accessible data.
 * Provides aggregated financial information scoped to user's permissions.
 * 
 * @param userContext - User context for access control.
 * @returns Promise resolving to bill summary statistics.
 */
/**
 * GetBillSummary function.
 * @param userContext
 * @returns Function result.
 */
export async function getBillSummary(userContext: UserContext) {
  // First get all accessible bill IDs
  const accessibleBillsQuery = await scopeQuery(
    db.select({ id: bills.id }).from(bills),
    userContext,
    'bills'
  );
  
  const accessibleBills = await accessibleBillsQuery;
  const billIds = accessibleBills.map((b: { id: string }) => b.id);
  
  if (billIds.length === 0) {
    return {
      totalOutstanding: '0',
      totalPaid: '0',
      totalOverdue: '0',
      billCount: 0,
      overdueCount: 0,
      paidCount: 0,
    };
  }

  // Get aggregated statistics for accessible bills
  const today = new Date().toISOString().split('T')[0];
  
  const summaryQuery = await db
    .select({
      status: bills.status,
      count: bills.id,
      totalAmount: bills.finalAmount,
      isOverdue: lte(bills.dueDate, today),
    })
    .from(bills)
    .where(inArray(bills.id, billIds));

  const summary = await summaryQuery;
  
  // Process the results to calculate totals
  let totalOutstanding = 0;
  let totalPaid = 0;
  let totalOverdue = 0;
  let billCount = 0;
  let overdueCount = 0;
  let paidCount = 0;

  summary.forEach((row: { totalAmount?: string; status: string; isOverdue?: boolean }) => {
    const amount = parseFloat(row.totalAmount || '0');
    billCount++;
    
    if (row.status === 'paid') {
      totalPaid += amount;
      paidCount++;
    } else if (row.status === 'overdue' || (row.isOverdue && row.status === 'sent')) {
      totalOverdue += amount;
      overdueCount++;
    } else {
      totalOutstanding += amount;
    }
  });

  return {
    totalOutstanding: totalOutstanding.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalOverdue: totalOverdue.toFixed(2),
    billCount,
    overdueCount,
    paidCount,
  };
}