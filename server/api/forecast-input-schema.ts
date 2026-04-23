import { z } from 'zod';

/**
 * Validation schema for the request body of
 * `POST /api/budgets/:buildingId/forecast`.
 *
 * This is the canonical contract the forecast endpoint reads. Two
 * payloads — including the ones built by the Budget page
 * (client/src/pages/manager/budget/index.tsx) and the Overview page
 * (client/src/pages/dashboard/overview.tsx) — that parse to the same
 * object will produce the same forecast (so the Budget chart and the
 * Overview chart will render identical numbers in custom mode).
 *
 * Extracted into its own module so tests can import the schema without
 * dragging in the entire route file (which depends on the database).
 */
export const forecastInputSchema = z.object({
  bankAccountStartAmount: z.coerce.number().optional(),
  bankAccountMinimums: z.coerce.number().optional(),
  generalInflationRate: z.coerce.number().min(-100).max(100).optional(),
  revenueInflationRate: z.coerce.number().min(-100).max(100).optional(),
  unplannedBillsAmount: z.coerce.number().min(0).optional(),
  // Time window parameters
  viewType: z.enum(['month', 'year']).optional(),
  periodLength: z
    .coerce
    .number()
    .positive()
    .max(360, 'Maximum projection period is 360 months (30 years)')
    .optional(),
  startMonth: z.coerce.number().min(1).max(12).optional(),
  startYear: z.coerce.number().optional(),
  unplannedBillsStartDate: z.string().nullable().optional(), // Allow null from frontend
  lookbackYears: z.coerce.number().min(1).max(10).optional().default(3),
  capitalInvestmentMode: z
    .enum(['urgent', 'suggested', 'custom'])
    .optional()
    .default('suggested'),
  projectIds: z.array(z.string()).optional(), // Project IDs to include in forecast
  // Per-project financial-year overrides used to preview a project period
  // shift before the user clicks Confirm. Maps projectId -> financialYear.
  // When omitted, projects use their stored financialYear / plannedStartDate.
  projectYearOverrides: z.record(z.string(), z.coerce.number()).optional(),
  // Extended configuration fields (passed from frontend for parity with budget page)
  emergencyFundMinimum: z.coerce.number().optional(),
  operatingCashMinimum: z.coerce.number().optional(),
  revenueGrowthRate: z.coerce.number().optional(),
  costInflationRate: z.coerce.number().optional(),
  utilityInflationRate: z.coerce.number().optional(),
  maintenanceInflationRate: z.coerce.number().optional(),
  specialInvestmentBudget: z.coerce.number().optional(),
  investmentHorizonYears: z.coerce.number().optional(),
  capitalProjectReserve: z.coerce.number().optional(),
  useGlobalBillsInflation: z.boolean().optional(),
  globalBillsInflationRate: z.coerce.number().optional(),
  categoryInflationRates: z.record(z.string(), z.number()).optional(),
  customBankFields: z.record(z.string(), z.number()).optional(),
  customRevenueLines: z.array(z.any()).optional(),
  punctualRevenueGrowth: z.array(z.any()).optional(),
});

export type ForecastInput = z.infer<typeof forecastInputSchema>;
