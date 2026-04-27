/**
 * @file Project cost placement logic
 * @description Determines the calendar month in which a maintenance project's
 * cost is applied in the budget forecast.
 *
 * Rules (mirrors the `forecastHandler` loop in `server/api/budgets.ts`):
 *   1. If the project has a `plannedStartDate`, the cost lands in the month
 *      that matches the date (year + month).
 *   2. If the project has only a `financialYear` (no `plannedStartDate`), the
 *      cost lands in January of that `financialYear`.
 *   3. A project with neither field contributes no cost to any month.
 *
 * Extracted to its own module so the placement rule can be unit-tested
 * independently of the full HTTP forecast handler.
 */

export interface ProjectForPlacement {
  totalBudget: string | null;
  estimatedCost: string | null;
  plannedStartDate: string | null;
  financialYear: number | null;
}

/**
 * Returns the cost that a project contributes to a given (year, month).
 *
 * @param project    The project row (subset of fields used by the spread).
 * @param year       The calendar year being evaluated (e.g. 2026).
 * @param month      The calendar month being evaluated (1 = January … 12 = December).
 * @returns The amount added to that month's project-costs bucket, or 0.
 */
export function getProjectCostForMonth(
  project: ProjectForPlacement,
  year: number,
  month: number,
): number {
  if (project.plannedStartDate) {
    const date = new Date(project.plannedStartDate);
    if (date.getFullYear() === year && date.getMonth() === month - 1) {
      return parseFloat(String(project.totalBudget ?? project.estimatedCost ?? 0));
    }
    return 0;
  }

  if (project.financialYear) {
    if (year === project.financialYear && month === 1) {
      return parseFloat(String(project.totalBudget ?? project.estimatedCost ?? 0));
    }
  }

  return 0;
}

/**
 * Sums the cost that a list of projects contributes to a given (year, month).
 */
export function getTotalProjectCostForMonth(
  projects: ProjectForPlacement[],
  year: number,
  month: number,
): number {
  return projects.reduce((sum, p) => sum + getProjectCostForMonth(p, year, month), 0);
}
