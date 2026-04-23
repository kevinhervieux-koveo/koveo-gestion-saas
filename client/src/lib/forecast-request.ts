/**
 * Shared builder for the request body sent to
 * `POST /api/budgets/:buildingId/forecast`.
 *
 * Both the Overview page (`client/src/pages/dashboard/overview.tsx`) and
 * the Budget page (`client/src/pages/manager/budget/index.tsx`) call this
 * helper so the two pages cannot drift apart on the inputs they hand to
 * the forecast endpoint. The canonical schema parsed on the server lives
 * at `server/api/forecast-input-schema.ts`; the parity test in
 * `tests/unit/budget/budget-graph-consistency.test.ts` locks in that
 * both call sites produce equivalent inputs.
 */

export interface ForecastBankAccountConfig {
  bankAccountStartAmount?: number;
  bankAccountMinimums?: number;
  generalInflationRate?: number;
  revenueInflationRate?: number;
  financialYearStart?: string | null;
  emergencyFundMinimum?: number;
  operatingCashMinimum?: number;
  revenueGrowthRate?: number;
  costInflationRate?: number;
  utilityInflationRate?: number;
  maintenanceInflationRate?: number;
  specialInvestmentBudget?: number;
  investmentHorizonYears?: number;
  capitalProjectReserve?: number;
  useGlobalBillsInflation?: boolean;
  globalBillsInflationRate?: number;
  unplannedBillsAmount?: number;
  unplannedBillsStartDate?: string | null;
  categoryInflationRates?: Record<string, number | undefined>;
  customBankFields?: Record<string, number>;
}

/**
 * Returns the month-of-year (1-12) parsed from a financial-year start
 * date string of the form `YYYY-MM-DD`, or `undefined` when the input
 * is missing or doesn't match the expected format. Callers that want
 * to anchor their forecast request to the fiscal year should call this
 * to resolve `filters.startMonth` BEFORE invoking
 * `buildForecastRequestBody`. This is intentionally exposed as a
 * separate function so pages that let users manually pick a start
 * month (e.g. the Budget page's Period Window UI) can opt out of the
 * derivation.
 */
export function deriveStartMonthFromFiscalYearStart(
  financialYearStart: string | null | undefined
): number | undefined {
  if (typeof financialYearStart !== 'string') return undefined;
  const m = financialYearStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? parseInt(m[2], 10) : undefined;
}

export interface ForecastFilters {
  viewType: 'month' | 'year';
  periodLength: number;
  startMonth?: number;
  startYear?: number;
}

export interface BuildForecastRequestBodyArgs {
  bankAccountConfig: ForecastBankAccountConfig;
  capitalInvestmentMode: 'urgent' | 'suggested' | 'custom';
  filters: ForecastFilters;
  projectIds: string[];
  // Per-project financial-year overrides used to preview a project period
  // shift before the user clicks Confirm. Keys are project IDs, values are
  // the previewed financialYear. Omit or pass an empty object to disable.
  projectYearOverrides?: Record<string, number>;
  customRevenueLines?: unknown[];
  punctualRevenueGrowth?: unknown[];
  investmentFilters?: { urgency?: string };
}

export function buildForecastRequestBody(
  args: BuildForecastRequestBodyArgs
): Record<string, unknown> {
  const cfg = args.bankAccountConfig;

  // NOTE: Callers are responsible for resolving filters.startMonth and
  // filters.startYear before invoking this helper. The Budget page lets
  // the user manually pick a start month from the Period Window UI and
  // must preserve that selection; the Overview page derives the start
  // month from financialYearStart up front (see deriveStartMonthFromFiscalYearStart
  // below). Doing the derivation here would silently override Budget's
  // manual selection on every request.

  const body: Record<string, unknown> = {
    viewType: args.filters.viewType,
    periodLength: args.filters.periodLength,
    startMonth: args.filters.startMonth,
    startYear: args.filters.startYear,
    projectIds: args.projectIds,
    capitalInvestmentMode: args.capitalInvestmentMode,
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
    customRevenueLines: args.customRevenueLines ?? [],
    punctualRevenueGrowth: args.punctualRevenueGrowth ?? [],
  };

  if (args.projectYearOverrides && Object.keys(args.projectYearOverrides).length > 0) {
    body.projectYearOverrides = args.projectYearOverrides;
  }

  if (args.investmentFilters) {
    body.investmentFilters = args.investmentFilters;
  }

  return body;
}
