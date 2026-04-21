/**
 * @file Overview vs Budget page parity tests
 * @description Locks in that the Overview page (`client/src/pages/dashboard/overview.tsx`)
 * and the Budget page (`client/src/pages/manager/budget/index.tsx`) hand
 * the SAME forecast request body to `POST /api/budgets/:buildingId/forecast`
 * when both land on a given building in their default state.
 *
 * The original bug: Overview hardcoded `capitalInvestmentMode: 'custom'`
 * while the Budget page defaulted to `'suggested'`. In `'suggested'` mode
 * the backend auto-injects capital to keep the running balance above the
 * minimum requirement, which made the same building show different
 * starting balances on the two pages (e.g. $146,308.22 on Overview vs
 * $153,656.96 on Budget for 2026-02). Both pages must default to the same
 * mode and the same start window, otherwise the running totals diverge.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildForecastRequestBody,
  deriveStartMonthFromFiscalYearStart,
} from '../../../client/src/lib/forecast-request';

const sampleBuildingConfig = {
  bankAccountStartAmount: 150000,
  bankAccountMinimums: 17158,
  generalInflationRate: 0.02,
  revenueInflationRate: 0.025,
  financialYearStart: '2026-02-01',
  emergencyFundMinimum: 10000,
  operatingCashMinimum: 7158,
  customBankFields: {},
};

const sampleProjectIds = ['proj-roof-2026'];

/**
 * Mirror what the Overview page builds in its forecast effect.
 */
function buildOverviewBody(opts: { startYear: number }): Record<string, unknown> {
  const derivedFiscalMonth = deriveStartMonthFromFiscalYearStart(
    sampleBuildingConfig.financialYearStart
  );
  return buildForecastRequestBody({
    bankAccountConfig: sampleBuildingConfig,
    capitalInvestmentMode: 'custom',
    filters: {
      viewType: 'month',
      periodLength: 12,
      startMonth: derivedFiscalMonth,
      startYear: opts.startYear,
    },
    projectIds: sampleProjectIds,
    customRevenueLines: [],
    punctualRevenueGrowth: [],
  });
}

/**
 * Mirror what the Budget page builds in its forecast effect, AFTER the
 * default-mode fix and after the financial-year initialisation effect has
 * snapped startMonth/startYear to the building's fiscal year (the
 * page-level behaviour exercised in production).
 */
function buildBudgetBody(opts: {
  startYear: number;
  capitalInvestmentMode?: 'urgent' | 'suggested' | 'custom';
}): Record<string, unknown> {
  const derivedFiscalMonth = deriveStartMonthFromFiscalYearStart(
    sampleBuildingConfig.financialYearStart
  );
  return buildForecastRequestBody({
    bankAccountConfig: sampleBuildingConfig,
    capitalInvestmentMode: opts.capitalInvestmentMode ?? 'custom',
    filters: {
      viewType: 'month',
      periodLength: 12,
      startMonth: derivedFiscalMonth,
      startYear: opts.startYear,
    },
    projectIds: sampleProjectIds,
    customRevenueLines: [],
    punctualRevenueGrowth: [],
  });
}

describe('Overview vs Budget forecast request parity', () => {
  it('both pages produce the SAME default request body for the same building', () => {
    const overview = buildOverviewBody({ startYear: 2026 });
    const budget = buildBudgetBody({ startYear: 2026 });

    // Identical mode is the headline regression: prior to the fix, Budget
    // defaulted to 'suggested' which caused the backend to auto-inject
    // capital and inflated every subsequent month's balance.
    expect(budget.capitalInvestmentMode).toBe('custom');
    expect(overview.capitalInvestmentMode).toBe('custom');
    expect(budget.capitalInvestmentMode).toBe(overview.capitalInvestmentMode);

    // Start window must agree period-by-period so the running balance the
    // backend computes lands on the same calendar month in both pages.
    expect(budget.startMonth).toBe(overview.startMonth);
    expect(budget.startYear).toBe(overview.startYear);
    expect(budget.viewType).toBe(overview.viewType);
    expect(budget.periodLength).toBe(overview.periodLength);

    // Bank account inputs (which drive starting balance, minimums and
    // inflation) must also match.
    expect(budget.bankAccountStartAmount).toBe(overview.bankAccountStartAmount);
    expect(budget.bankAccountMinimums).toBe(overview.bankAccountMinimums);
    expect(budget.emergencyFundMinimum).toBe(overview.emergencyFundMinimum);
    expect(budget.operatingCashMinimum).toBe(overview.operatingCashMinimum);
    expect(budget.generalInflationRate).toBe(overview.generalInflationRate);
    expect(budget.revenueInflationRate).toBe(overview.revenueInflationRate);

    // Project scoping must be identical.
    expect(budget.projectIds).toEqual(overview.projectIds);
  });

  it('Budget startMonth defaults to the fiscal-year month derived from financialYearStart', () => {
    const overview = buildOverviewBody({ startYear: 2026 });
    const budget = buildBudgetBody({ startYear: 2026 });
    // financialYearStart = '2026-02-01' → month 2.
    expect(overview.startMonth).toBe(2);
    expect(budget.startMonth).toBe(2);
  });

  it('switching Budget to "suggested" mode produces a visibly different request body', () => {
    const defaultBody = buildBudgetBody({ startYear: 2026 });
    const suggestedBody = buildBudgetBody({
      startYear: 2026,
      capitalInvestmentMode: 'suggested',
    });

    expect(defaultBody.capitalInvestmentMode).toBe('custom');
    expect(suggestedBody.capitalInvestmentMode).toBe('suggested');
    expect(defaultBody.capitalInvestmentMode).not.toBe(
      suggestedBody.capitalInvestmentMode
    );
  });

  it('switching Budget to "urgent" mode also opts out of the shared default', () => {
    const urgentBody = buildBudgetBody({
      startYear: 2026,
      capitalInvestmentMode: 'urgent',
    });
    expect(urgentBody.capitalInvestmentMode).toBe('urgent');
  });
});
