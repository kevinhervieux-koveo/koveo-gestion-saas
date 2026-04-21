import { describe, it, expect, beforeAll } from '@jest/globals';

/**
 * Live-endpoint companion to the parity unit test in
 * tests/unit/budget/budget-graph-consistency.test.ts.
 *
 * Locks in the alignment from task #120 by hitting the real
 * `POST /api/budgets/:buildingId/forecast` route handler with the
 * payload the Overview page sends and the payload the Budget page
 * sends for the same building, project list, and bank-account
 * configuration in `custom` capital-investment mode, and asserting
 * that the per-period `balance`, `startingBalance`, and `netCashFlow`
 * arrays returned for each call match.
 *
 * The unit test proves the two payloads parse to the same canonical
 * input via the server's request schema; this test proves end-to-end
 * that the running endpoint returns identical numbers for both.
 */

let app: any;
let request: any;

try {
  request = require('supertest');
  app = require('../../server/index').app;
} catch {
  app = null;
}

const describeIfApp = app ? describe : describe.skip;

describeIfApp('Forecast endpoint parity: Overview vs Budget payloads (custom mode)', () => {
  // Same building used by tests/integration/financial-overview-api.test.ts.
  const buildingId = '18bc7633-ff5f-4b60-8d21-5a8a0ee28f0f';

  // Inputs both pages have at request time. The fiscal-year start is
  // April so the Budget page's filters.startMonth (initialized from
  // financialYearStart) and the Overview page's derived startMonth
  // both land on 4.
  const scenario = {
    includedProjectIds: [] as string[],
    filters: {
      viewType: 'month' as const,
      periodLength: 24,
      startMonth: 4,
      startYear: 2026,
    },
    bankAccountConfig: {
      bankAccountStartAmount: 145308.22,
      bankAccountMinimums: 25000,
      generalInflationRate: 0.02,
      revenueInflationRate: 0.025,
      financialYearStart: '2025-04-01',
      emergencyFundMinimum: 10000,
      operatingCashMinimum: 5000,
      revenueGrowthRate: 0.03,
      costInflationRate: 0.022,
      utilityInflationRate: 0.04,
      maintenanceInflationRate: 0.025,
      specialInvestmentBudget: 50000,
      investmentHorizonYears: 10,
      capitalProjectReserve: 75000,
      useGlobalBillsInflation: true,
      globalBillsInflationRate: 0.02,
      unplannedBillsAmount: 2000,
      unplannedBillsStartDate: '2025-04-01',
      categoryInflationRates: { utilities: 0.04, maintenance: 0.025 },
      customBankFields: { reserveA: 5000, reserveB: 7500 },
      customRevenueLines: [] as unknown[],
      punctualRevenueGrowth: [] as unknown[],
    },
  };

  // Mirrors client/src/pages/manager/budget/index.tsx (forecastParams useMemo).
  function buildBudgetPagePayload() {
    const cfg = scenario.bankAccountConfig;
    return {
      ...cfg,
      capitalInvestmentMode: 'custom' as const,
      customRevenueLines: cfg.customRevenueLines || [],
      punctualRevenueGrowth: cfg.punctualRevenueGrowth || [],
      viewType: scenario.filters.viewType,
      periodLength: scenario.filters.periodLength,
      startMonth: scenario.filters.startMonth,
      startYear: scenario.filters.startYear,
      projectIds: scenario.includedProjectIds,
    };
  }

  // Mirrors client/src/pages/dashboard/overview.tsx (forecastParams object).
  function buildOverviewPagePayload() {
    const cfg = scenario.bankAccountConfig;
    let effectiveStartMonth: number = scenario.filters.startMonth;
    const m = cfg.financialYearStart?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) effectiveStartMonth = parseInt(m[2], 10);

    return {
      viewType: scenario.filters.viewType,
      periodLength: scenario.filters.periodLength,
      startMonth: effectiveStartMonth,
      startYear: scenario.filters.startYear,
      projectIds: scenario.includedProjectIds,
      capitalInvestmentMode: 'custom' as const,
      bankAccountStartAmount: cfg.bankAccountStartAmount,
      bankAccountMinimums: cfg.bankAccountMinimums,
      generalInflationRate: cfg.generalInflationRate,
      revenueInflationRate: cfg.revenueInflationRate,
      emergencyFundMinimum: cfg.emergencyFundMinimum,
      operatingCashMinimum: cfg.operatingCashMinimum,
      revenueGrowthRate: cfg.revenueGrowthRate,
      costInflationRate: cfg.costInflationRate,
      utilityInflationRate: cfg.utilityInflationRate,
      maintenanceInflationRate: cfg.maintenanceInflationRate,
      specialInvestmentBudget: cfg.specialInvestmentBudget,
      investmentHorizonYears: cfg.investmentHorizonYears,
      capitalProjectReserve: cfg.capitalProjectReserve,
      useGlobalBillsInflation: cfg.useGlobalBillsInflation,
      globalBillsInflationRate: cfg.globalBillsInflationRate,
      unplannedBillsAmount: cfg.unplannedBillsAmount,
      unplannedBillsStartDate: cfg.unplannedBillsStartDate,
      categoryInflationRates: cfg.categoryInflationRates,
      customBankFields: cfg.customBankFields,
      customRevenueLines: cfg.customRevenueLines || [],
      punctualRevenueGrowth: cfg.punctualRevenueGrowth || [],
    };
  }

  interface ForecastPeriod {
    balance: number;
    startingBalance?: number;
    balanceStart?: number;
    netCashFlow: number;
  }
  let budgetForecast: ForecastPeriod[];
  let overviewForecast: ForecastPeriod[];

  beforeAll(async () => {
    const budgetRes = await request(app)
      .post(`/api/budgets/${buildingId}/forecast`)
      .send(buildBudgetPagePayload());
    const overviewRes = await request(app)
      .post(`/api/budgets/${buildingId}/forecast`)
      .send(buildOverviewPagePayload());

    // Fail hard if either request was rejected. A 4xx/5xx here means
    // the parity assertion below would not actually be checking the
    // forecast arrays — surfacing the failure prevents the test from
    // silently passing on auth, validation, or server errors.
    expect(budgetRes.status).toBe(200);
    expect(overviewRes.status).toBe(200);

    budgetForecast = budgetRes.body.forecast;
    overviewForecast = overviewRes.body.forecast;
  });

  it('returns identical balance, startingBalance, and netCashFlow arrays for both payloads', () => {
    expect(overviewForecast).toHaveLength(budgetForecast.length);

    const pickBalance = (p: ForecastPeriod) => p.balance;
    const pickStarting = (p: ForecastPeriod) =>
      p.balanceStart ?? p.startingBalance;
    const pickNet = (p: ForecastPeriod) => p.netCashFlow;

    expect(overviewForecast.map(pickBalance)).toEqual(
      budgetForecast.map(pickBalance),
    );
    expect(overviewForecast.map(pickStarting)).toEqual(
      budgetForecast.map(pickStarting),
    );
    expect(overviewForecast.map(pickNet)).toEqual(
      budgetForecast.map(pickNet),
    );
  });
});
