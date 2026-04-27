/**
 * Sorting helpers for the bills page.
 *
 * The bills page exposes sort toggles for several columns. All sort fields
 * follow the same NULL-last rule: bills missing a value for the active sort
 * field always sort to the end, regardless of direction.
 *
 * Extracted from bills.tsx so the sorting logic can be unit tested without
 * mounting the entire bills page.
 */

import { parseDateOnlyLoose } from '@/lib/utils';

export type BillSortField = 'issueDate' | 'dueDate' | 'amount';

type BillSortable = {
  issueDate?: unknown;
  startDate?: unknown;
  totalAmount?: unknown;
};

function dateOnlyToTime(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const parsed = parseDateOnlyLoose(v as string | Date);
  if (parsed) return parsed.getTime();
  const t = new Date(v as string).getTime();
  return Number.isNaN(t) ? null : t;
}

function getSortValue(bill: BillSortable, field: BillSortField): number | null {
  switch (field) {
    case 'issueDate':
      return dateOnlyToTime(bill.issueDate);
    case 'dueDate':
      // The bill's "due date" in the UI corresponds to the schema's startDate
      // (when the bill series starts / is due).
      return dateOnlyToTime(bill.startDate);
    case 'amount': {
      const v = bill.totalAmount;
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isNaN(n) ? null : n;
    }
    default:
      return null;
  }
}

/**
 * Generic bill sort that handles the supported sort fields with NULL-last
 * semantics. Returns the original ordering when sortField is not recognized.
 */
export function sortBills<T extends BillSortable>(
  bills: T[],
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
): T[] {
  if (sortField !== 'issueDate' && sortField !== 'dueDate' && sortField !== 'amount') {
    return bills;
  }
  const field = sortField as BillSortField;
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...bills].sort((a, b) => {
    const av = getSortValue(a, field);
    const bv = getSortValue(b, field);
    // NULL values always sort to the end regardless of direction
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * direction;
  });
}

/**
 * Backwards-compatible wrapper that only sorts when sortField === 'issueDate'.
 */
export function sortBillsByIssueDate<T extends { issueDate?: unknown }>(
  bills: T[],
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
): T[] {
  if (sortField !== 'issueDate') return bills;
  return sortBills(bills as unknown as (T & BillSortable)[], sortField, sortDirection) as T[];
}
