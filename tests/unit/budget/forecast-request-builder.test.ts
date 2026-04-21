/**
 * @file Forecast request builder tests
 * @description Verifies the shared builder used by the Overview page
 * (`client/src/pages/dashboard/overview.tsx`) and the Budget page
 * (`client/src/pages/manager/budget/index.tsx`). Specifically locks in
 * that the helper preserves the caller-provided `startMonth` so the
 * Budget page's manual Period Window selection is reflected in the
 * forecast request body, even when `financialYearStart` is set.
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildForecastRequestBody,
  deriveStartMonthFromFiscalYearStart,
} from '../../../client/src/lib/forecast-request';
import { forecastInputSchema } from '../../../server/api/forecast-input-schema';

describe('buildForecastRequestBody', () => {
  const baseConfig = {
    bankAccountStartAmount: 100000,
    bankAccountMinimums: 20000,
    generalInflationRate: 0.02,
    revenueInflationRate: 0.025,
    financialYearStart: '2025-04-01',
  };

  it('preserves a caller-provided startMonth even when financialYearStart is set (Budget manual selection)', () => {
    const body = buildForecastRequestBody({
      bankAccountConfig: baseConfig,
      capitalInvestmentMode: 'custom',
      filters: {
        viewType: 'month',
        periodLength: 12,
        // User picked September manually in the Budget Period Window.
        startMonth: 9,
        startYear: 2026,
      },
      projectIds: [],
    });

    expect(body.startMonth).toBe(9);
    expect(body.startYear).toBe(2026);

    // Same behavior survives parsing through the canonical server schema.
    const parsed = forecastInputSchema.parse(body);
    expect(parsed.startMonth).toBe(9);
    expect(parsed.startYear).toBe(2026);
  });

  it('uses the fiscal-month derivation only when the caller resolves it up front (Overview anchor)', () => {
    const derived = deriveStartMonthFromFiscalYearStart(baseConfig.financialYearStart);
    expect(derived).toBe(4);

    const body = buildForecastRequestBody({
      bankAccountConfig: baseConfig,
      capitalInvestmentMode: 'custom',
      filters: {
        viewType: 'month',
        periodLength: 12,
        startMonth: derived,
        startYear: 2026,
      },
      projectIds: [],
    });

    expect(body.startMonth).toBe(4);
  });

  it('returns undefined fiscal month when financialYearStart is missing or malformed', () => {
    expect(deriveStartMonthFromFiscalYearStart(undefined)).toBeUndefined();
    expect(deriveStartMonthFromFiscalYearStart(null)).toBeUndefined();
    expect(deriveStartMonthFromFiscalYearStart('not-a-date')).toBeUndefined();
  });

  it('omits investmentFilters from the body when the caller does not pass it', () => {
    const body = buildForecastRequestBody({
      bankAccountConfig: baseConfig,
      capitalInvestmentMode: 'custom',
      filters: { viewType: 'month', periodLength: 12, startMonth: 1, startYear: 2026 },
      projectIds: [],
    });

    expect('investmentFilters' in body).toBe(false);
  });

  it('passes through projectIds, customRevenueLines, and punctualRevenueGrowth verbatim', () => {
    const customRevenueLines = [{ id: 'r1', name: 'Parking', amount: 1500 }];
    const punctualRevenueGrowth = [{ id: 'g1', year: 2026, amount: 2500 }];

    const body = buildForecastRequestBody({
      bankAccountConfig: baseConfig,
      capitalInvestmentMode: 'custom',
      filters: { viewType: 'month', periodLength: 12, startMonth: 1, startYear: 2026 },
      projectIds: ['proj-a', 'proj-b'],
      customRevenueLines,
      punctualRevenueGrowth,
    });

    expect(body.projectIds).toEqual(['proj-a', 'proj-b']);
    expect(body.customRevenueLines).toBe(customRevenueLines);
    expect(body.punctualRevenueGrowth).toBe(punctualRevenueGrowth);
  });
});
