/**
 * @file Financial Year validation for maintenance project updates
 * @description Extracted so both PUT and PATCH handlers share one implementation
 * and so the guard can be unit-tested without standing up the full HTTP layer.
 *
 * Rule: a `financialYear` value submitted when editing a maintenance project must
 * correspond to a year for which the building already has monthly-budget records.
 * Monthly budgets are auto-populated from the building's construction date to
 * 25 years in the future, so any year outside that window has no records and is
 * therefore not reachable in the context of this building's organisation.
 */

import { and, eq } from 'drizzle-orm';
import { monthlyBudgets } from '@shared/schema';

export interface DbLike {
  select: (fields?: any) => {
    from: (table: any) => {
      where: (condition: any) => {
        limit: (n: number) => Promise<{ year: number }[]>;
      };
    };
  };
}

/**
 * Returns `true` when `year` has at least one monthly-budget row for `buildingId`.
 *
 * @param db         Drizzle db instance (or a compatible mock).
 * @param buildingId The building the project belongs to.
 * @param year       The financial year submitted by the client.
 */
export async function isFinancialYearCoveredForBuilding(
  db: DbLike,
  buildingId: string,
  year: number,
): Promise<boolean> {
  const rows = await db
    .select({ year: monthlyBudgets.year })
    .from(monthlyBudgets)
    .where(
      and(
        eq(monthlyBudgets.buildingId, buildingId),
        eq(monthlyBudgets.year, year),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Builds the standardised 400 error body returned when FY validation fails.
 */
export function buildFyValidationError(year: number) {
  return {
    error: 'Invalid financial year',
    details: `Financial year ${year} is not covered by the building's budget records`,
  };
}
