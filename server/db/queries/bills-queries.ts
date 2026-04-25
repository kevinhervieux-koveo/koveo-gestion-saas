// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { eq, and, desc, asc, inArray, sql, type SQL } from 'drizzle-orm';
import { bills, payments, type Bill, type Payment } from '@shared/schema';
import { db } from '../../db';
import { getUserAccessibleBuildingIds, type UserContext } from './scope-query';

export type BillWithPayments = Bill & { payments: Payment[] };

/**
 * Fetch a single bill by ID (without payments).
 *
 * @param billId - The bill ID to retrieve.
 * @returns The bill or null if not found.
 */
export async function getBillById(billId: string): Promise<Bill | null> {
  const [bill] = await db
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);

  return bill ?? null;
}

/**
 * Fetch a bill and its associated payments.
 *
 * @param billId - The bill ID to retrieve with payments.
 * @returns { bill, payments } or null if not found.
 */
export async function getBillWithPayments(billId: string): Promise<{ bill: Bill; payments: Payment[] } | null> {
  const [bill] = await db
    .select()
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);

  if (!bill) return null;

  const billPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.billId, billId))
    .orderBy(asc(payments.paymentNumber));

  return { bill, payments: billPayments };
}

/**
 * Fetch bills with their payments in a single SQL query using LEFT JOIN.
 * Groups the joined rows by bill in application code to produce one
 * BillWithPayments per bill.
 *
 * @param whereClause - Optional Drizzle SQL condition for filtering bills.
 * @returns Array of bills, each with a `payments` array.
 */
export async function getBillsWithPayments(whereClause?: SQL): Promise<BillWithPayments[]> {
  const rows = await db
    .select({
      bill: bills,
      paymentId: payments.id,
      paymentBillId: payments.billId,
      paymentNumber: payments.paymentNumber,
      paymentScheduledDate: payments.scheduledDate,
      paymentAmount: payments.amount,
      paymentStatus: payments.status,
      paymentPaidDate: payments.paidDate,
      paymentNotes: payments.notes,
      paymentCreatedAt: payments.createdAt,
      paymentUpdatedAt: payments.updatedAt,
    })
    .from(bills)
    .leftJoin(payments, eq(payments.billId, bills.id))
    .where(whereClause)
    .orderBy(desc(bills.startDate), asc(payments.paymentNumber));

  const billMap = new Map<string, BillWithPayments>();

  for (const row of rows) {
    const billId = row.bill.id;
    if (!billMap.has(billId)) {
      billMap.set(billId, { ...row.bill, payments: [] });
    }
    if (row.paymentId) {
      billMap.get(billId)!.payments.push({
        id: row.paymentId,
        billId: row.paymentBillId,
        paymentNumber: row.paymentNumber,
        scheduledDate: row.paymentScheduledDate,
        amount: row.paymentAmount,
        status: row.paymentStatus,
        paidDate: row.paymentPaidDate,
        notes: row.paymentNotes,
        createdAt: row.paymentCreatedAt,
        updatedAt: row.paymentUpdatedAt,
      } as Payment);
    }
  }

  return Array.from(billMap.values());
}

/**
 * Fetch payments for a specific bill.
 *
 * @param billId - The bill ID to retrieve payments for.
 * @returns Array of payments ordered by payment number.
 */
export async function getPaymentsForBill(billId: string): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.billId, billId))
    .orderBy(asc(payments.paymentNumber));
}

/**
 * Determine the effective bill type, preferring the new billType field
 * over the deprecated paymentType field.
 *
 * MIGRATION NOTE (paymentType deprecation):
 * - `paymentType` (payment_type column) is deprecated but still NOT NULL in the schema.
 * - New code should always set `billType` and read it via this helper.
 * - `paymentType` is kept populated for backward compatibility with older queries/views.
 * - Once all rows have `billType` populated and all code paths use this helper,
 *   `paymentType` can be made nullable and eventually dropped.
 * - See shared/schemas/financial.ts for the schema-level deprecation comment.
 */
export function getEffectiveBillType(bill: Pick<Bill, 'billType' | 'paymentType'>): 'unique' | 'recurrent' {
  return (bill.billType ?? bill.paymentType) as 'unique' | 'recurrent';
}

/**
 * Get bill summary statistics using SQL-level aggregation.
 * Uses conditional SUM/COUNT for a single efficient query.
 *
 * @param userContext - User context for access control.
 */
export async function getBillSummary(userContext: UserContext) {
  const today = new Date().toISOString().split('T')[0];

  const accessibleBuildingIds = userContext.role === 'admin'
    ? null
    : await getUserAccessibleBuildingIds(userContext);

  if (accessibleBuildingIds !== null && accessibleBuildingIds.length === 0) {
    return {
      totalOutstanding: '0',
      totalPaid: '0',
      totalOverdue: '0',
      billCount: 0,
      overdueCount: 0,
      paidCount: 0,
    };
  }

  const conditions = accessibleBuildingIds
    ? [inArray(bills.buildingId, accessibleBuildingIds)]
    : [];

  const [result] = await db
    .select({
      billCount: sql<number>`count(*)::int`,
      paidCount: sql<number>`count(*) filter (where ${bills.status} = 'paid')::int`,
      overdueCount: sql<number>`count(*) filter (where ${bills.status} = 'overdue' or (${bills.status} = 'sent' and ${bills.startDate} <= ${today}))::int`,
      totalPaid: sql<string>`coalesce(sum(cast(${bills.totalAmount} as numeric)) filter (where ${bills.status} = 'paid'), 0)::text`,
      totalOverdue: sql<string>`coalesce(sum(cast(${bills.totalAmount} as numeric)) filter (where ${bills.status} = 'overdue' or (${bills.status} = 'sent' and ${bills.startDate} <= ${today})), 0)::text`,
      totalOutstanding: sql<string>`coalesce(sum(cast(${bills.totalAmount} as numeric)) filter (where ${bills.status} not in ('paid', 'overdue', 'cancelled') and not (${bills.status} = 'sent' and ${bills.startDate} <= ${today})), 0)::text`,
    })
    .from(bills)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    totalOutstanding: parseFloat(result?.totalOutstanding || '0').toFixed(2),
    totalPaid: parseFloat(result?.totalPaid || '0').toFixed(2),
    totalOverdue: parseFloat(result?.totalOverdue || '0').toFixed(2),
    billCount: result?.billCount || 0,
    overdueCount: result?.overdueCount || 0,
    paidCount: result?.paidCount || 0,
  };
}