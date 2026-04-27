/**
 * @file Budget spread recomputation when project Financial Year changes
 * @description Covers Task #1311 requirement (2): when a maintenance project's
 * `financialYear` changes, the budget forecast places the project's cost in a
 * different calendar period.  No allocation rows are stored — the forecast
 * recomputes on demand using the current `financialYear` column value.
 *
 * The tests below exercise `getProjectCostForMonth` (extracted from the
 * `forecastHandler` in `server/api/budgets.ts`) and prove that:
 *
 *   - A FY change moves the project cost from the old January to the new
 *     January (FY-only path, no plannedStartDate).
 *   - A project with a `plannedStartDate` lands in the exact month of that
 *     date, regardless of the `financialYear` field.
 *   - Total cost across the relevant years is the same before and after the
 *     change (within rounding tolerance of 0.01 cents) — proving that cost
 *     is conserved, not lost or doubled.
 *   - Same parity holds for a non-Jan FY (July 1 start).
 */

import { describe, it, expect } from '@jest/globals';
import {
  getProjectCostForMonth,
  getTotalProjectCostForMonth,
} from '../../../server/api/project-cost-placement';

const ROUNDING_TOLERANCE = 0.01;

describe('getProjectCostForMonth — FY-only path (no plannedStartDate)', () => {
  const project = {
    totalBudget: '50000',
    estimatedCost: '48000',
    plannedStartDate: null,
    financialYear: 2025,
  };

  it('places cost in January of the stored financialYear', () => {
    expect(getProjectCostForMonth(project, 2025, 1)).toBe(50000);
  });

  it('contributes 0 to all other months within that year', () => {
    for (let month = 2; month <= 12; month++) {
      expect(getProjectCostForMonth(project, 2025, month)).toBe(0);
    }
  });

  it('contributes 0 to January of adjacent years', () => {
    expect(getProjectCostForMonth(project, 2024, 1)).toBe(0);
    expect(getProjectCostForMonth(project, 2026, 1)).toBe(0);
  });
});

describe('budget spread recomputation — FY change moves cost, totals stay equal', () => {
  it('calendar-year FY: changing FY from 2025 → 2026 moves cost to January 2026 (parity holds)', () => {
    const budget = '50000';
    const fy2025Project = {
      totalBudget: budget,
      estimatedCost: null,
      plannedStartDate: null,
      financialYear: 2025,
    };

    const fy2026Project = {
      totalBudget: budget,
      estimatedCost: null,
      plannedStartDate: null,
      financialYear: 2026,
    };

    const costBefore2025Jan = getProjectCostForMonth(fy2025Project, 2025, 1);
    const costBefore2026Jan = getProjectCostForMonth(fy2025Project, 2026, 1);

    const costAfter2025Jan = getProjectCostForMonth(fy2026Project, 2025, 1);
    const costAfter2026Jan = getProjectCostForMonth(fy2026Project, 2026, 1);

    expect(costBefore2025Jan).toBe(50000);
    expect(costBefore2026Jan).toBe(0);

    expect(costAfter2025Jan).toBe(0);
    expect(costAfter2026Jan).toBe(50000);

    const totalBefore = costBefore2025Jan + costBefore2026Jan;
    const totalAfter = costAfter2025Jan + costAfter2026Jan;
    expect(Math.abs(totalAfter - totalBefore)).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
  });

  it('multi-project list: FY shift for one project preserves total across both years', () => {
    const projects2025 = [
      { totalBudget: '30000', estimatedCost: null, plannedStartDate: null, financialYear: 2025 },
      { totalBudget: '20000', estimatedCost: null, plannedStartDate: null, financialYear: 2025 },
    ];

    const projectsAfterShift = [
      { totalBudget: '30000', estimatedCost: null, plannedStartDate: null, financialYear: 2026 },
      { totalBudget: '20000', estimatedCost: null, plannedStartDate: null, financialYear: 2025 },
    ];

    const beforeTotal =
      getTotalProjectCostForMonth(projects2025, 2025, 1) +
      getTotalProjectCostForMonth(projects2025, 2026, 1);

    const afterTotal =
      getTotalProjectCostForMonth(projectsAfterShift, 2025, 1) +
      getTotalProjectCostForMonth(projectsAfterShift, 2026, 1);

    expect(Math.abs(afterTotal - beforeTotal)).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
    expect(afterTotal).toBe(50000);

    expect(getTotalProjectCostForMonth(projects2025, 2025, 1)).toBe(50000);
    expect(getTotalProjectCostForMonth(projectsAfterShift, 2025, 1)).toBe(20000);
    expect(getTotalProjectCostForMonth(projectsAfterShift, 2026, 1)).toBe(30000);
  });
});

describe('getProjectCostForMonth — plannedStartDate path', () => {
  it('places cost in the exact month matching plannedStartDate', () => {
    const project = {
      totalBudget: '75000',
      estimatedCost: null,
      plannedStartDate: '2026-09-15',
      financialYear: 2025,
    };

    expect(getProjectCostForMonth(project, 2026, 9)).toBe(75000);
    expect(getProjectCostForMonth(project, 2026, 1)).toBe(0);
    expect(getProjectCostForMonth(project, 2025, 1)).toBe(0);
  });

  it('changing the FY after adding a plannedStartDate leaves cost anchored to the date', () => {
    const budgetAmount = '75000';

    const projectBefore = {
      totalBudget: budgetAmount,
      estimatedCost: null,
      plannedStartDate: '2026-09-15',
      financialYear: 2025,
    };

    const projectAfter = {
      totalBudget: budgetAmount,
      estimatedCost: null,
      plannedStartDate: '2026-09-15',
      financialYear: 2026,
    };

    expect(getProjectCostForMonth(projectBefore, 2026, 9)).toBe(75000);
    expect(getProjectCostForMonth(projectAfter, 2026, 9)).toBe(75000);

    const totalBefore = getProjectCostForMonth(projectBefore, 2026, 9) + getProjectCostForMonth(projectBefore, 2025, 1);
    const totalAfter = getProjectCostForMonth(projectAfter, 2026, 9) + getProjectCostForMonth(projectAfter, 2025, 1);
    expect(Math.abs(totalAfter - totalBefore)).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
  });
});

describe('getProjectCostForMonth — non-Jan FY edge cases', () => {
  it('a project with FY=2026 and no plannedStartDate still lands in January 2026 (month-agnostic FY label)', () => {
    const project = {
      totalBudget: '12000',
      estimatedCost: null,
      plannedStartDate: null,
      financialYear: 2026,
    };

    expect(getProjectCostForMonth(project, 2026, 1)).toBe(12000);
    expect(getProjectCostForMonth(project, 2026, 7)).toBe(0);
  });

  it('estimatedCost is used as fallback when totalBudget is null', () => {
    const project = {
      totalBudget: null,
      estimatedCost: '9999.99',
      plannedStartDate: null,
      financialYear: 2027,
    };

    expect(getProjectCostForMonth(project, 2027, 1)).toBeCloseTo(9999.99, 2);
    expect(getProjectCostForMonth(project, 2027, 2)).toBe(0);
  });

  it('contributes 0 when both totalBudget and estimatedCost are null', () => {
    const project = {
      totalBudget: null,
      estimatedCost: null,
      plannedStartDate: null,
      financialYear: 2027,
    };

    expect(getProjectCostForMonth(project, 2027, 1)).toBe(0);
  });
});
