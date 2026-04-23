import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  boolean,
  integer,
  decimal,
  date,
  jsonb,
  varchar,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users } from './core';
import { residences, buildings } from './property';

// Financial enums
export const billStatusEnum = pgEnum('bill_status', [
  'draft',
  'sent',
  'overdue',
  'paid',
  'cancelled',
]);


export const billCategoryEnum = pgEnum('bill_category', [
  'administration',
  'cleaning',
  'construction',
  'consulting',
  'equipment_rental',
  'insurance',
  'landscaping',
  'legal_services',
  'maintenance',
  'professional_services',
  'repairs',
  'reserves',
  'salary',
  'security',
  'supplies',
  'taxes',
  'technology',
  'utilities',
  'other',
]);

// Shared constant array for use in frontend components - SINGLE SOURCE OF TRUTH
export const BILL_CATEGORIES = [
  'administration',
  'cleaning',
  'construction',
  'consulting',
  'equipment_rental',
  'insurance',
  'landscaping',
  'legal_services',
  'maintenance',
  'professional_services',
  'repairs',
  'reserves',
  'salary',
  'security',
  'supplies',
  'taxes',
  'technology',
  'utilities',
  'other',
] as const;

/**
 * @deprecated Use billTypeEnum and paymentStructureEnum instead.
 * Kept for backward compatibility with existing database records.
 * Do not use in new code — will be removed once all records are migrated.
 */
export const paymentTypeEnum = pgEnum('payment_type', ['unique', 'recurrent']);

// New enums for proper bill type and payment structure separation
export const billTypeEnum = pgEnum('bill_type', ['unique', 'recurrent']);
export const paymentStructureEnum = pgEnum('payment_structure', ['single', 'installment']);

export const schedulePaymentEnum = pgEnum('schedule_payment', [
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'overdue', 
  'paid',
  'cancelled',
]);

export const investmentUrgencyEnum = pgEnum('investment_urgency', [
  'not_urgent',
  'urgent', 
  'suggested',
]);

export const investmentTypeEnum = pgEnum('investment_type', [
  'auto_generated',
  'custom',
]);

export const investmentOwnershipEnum = pgEnum('investment_ownership', [
  'residences',
  'owner',
]);

// Financial tables
/**
 * Enhanced bills table for tracking financial obligations with advanced scheduling.
 * Supports unique and recurrent payments with custom scheduling options.
 */
export const bills = pgTable('bills', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  billNumber: varchar('bill_number', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  category: billCategoryEnum('category').notNull(),
  vendor: varchar('vendor', { length: 200 }), // Company or service provider
  
  // New fields for proper bill type and payment structure
  billType: billTypeEnum('bill_type'), // unique (one-time) or recurrent (repeating) - determines if auto-generation is possible
  paymentStructure: paymentStructureEnum('payment_structure'), // single (one payment) or installment (payment plan)
  
  /**
   * @deprecated Use billType + paymentStructure instead.
   * MIGRATION PLAN:
   * 1. All write paths (create/update) now set both billType AND paymentType.
   * 2. All read paths use getEffectiveBillType() which prefers billType over paymentType.
   * 3. Budget forecast uses billType with paymentType fallback via OR conditions.
   * 4. Once all existing rows have billType populated (via backfill migration),
   *    make this column nullable and stop writing to it.
   * 5. Finally, drop the column and remove paymentTypeEnum.
   */
  paymentType: paymentTypeEnum('payment_type').notNull(),
  
  // AI-extracted vendor-facing identifiers (populated from uploaded bill documents).
  // Distinct from `billNumber` above, which is the system-generated, organization-unique number.
  issueDate: date('issue_date'), // Date the vendor issued / dated the invoice
  vendorInvoiceNumber: varchar('vendor_invoice_number', { length: 100 }), // Vendor's own invoice/bill number on the document
  schedulePayment: schedulePaymentEnum('schedule_payment'), // Only for installment payments
  yearInterval: integer('year_interval').notNull().default(1), // For recurrent bills: how many years between occurrences (1-99)
  scheduleCustom: date('schedule_custom').array(), // Custom dates for custom schedules
  costs: decimal('costs', { precision: 10, scale: 2 }).array().notNull(), // Array of costs for payment plan
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  startDate: date('start_date').notNull(), // When the bill series starts
  endDate: date('end_date'), // For recurrent bills, when they end (optional for ongoing)
  status: billStatusEnum('status').notNull().default('draft'),
  filePath: text('file_path'), // Path to uploaded bill document
  fileName: text('file_name'), // Stored (normalized) filename
  // Original UTF-8 filename supplied by the uploader (Task #420). Preserved
  // so download endpoints can serve the user-facing name even though
  // `fileName` / `filePath` are normalized to ASCII for storage.
  originalFileName: text('original_file_name'),
  fileSize: integer('file_size'), // File size in bytes
  isAiAnalyzed: boolean('is_ai_analyzed').default(false),
  aiAnalysisData: jsonb('ai_analysis_data'), // Store AI-extracted data
  notes: text('notes'),
  isAutoGenerated: boolean('is_auto_generated').notNull().default(false), // Indicates if this bill was auto-generated
  autoGenerateNextYear: boolean('auto_generate_next_year').notNull().default(false), // Generate template bills for next year automatically
  sourceTemplateId: varchar('source_template_id').references(() => bills.id), // References the original bill for auto-generated bills
  parentBillId: text('parent_bill_id'), // Link to parent bill for fiscal year split bills
  autoGeneratedLabel: varchar('auto_generated_label'), // Display label for auto-generated bills
  // Origin of the bill: 'mcp' | 'auto' | 'api' | 'import' (Task #255).
  // Replaces the legacy practice of encoding the source in the bill number.
  source: varchar('source', { length: 16 }),
  createdBy: varchar('created_by')
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  buildingIdIdx: index('bills_building_id_idx').on(table.buildingId),
  createdByIdx: index('bills_created_by_idx').on(table.createdBy),
  sourceTemplateIdIdx: index('bills_source_template_id_idx').on(table.sourceTemplateId),
  parentBillIdIdx: index('bills_parent_bill_id_idx').on(table.parentBillId),
  statusIdx: index('bills_status_idx').on(table.status),
  categoryIdx: index('bills_category_idx').on(table.category),
  // Date indexes for range queries
  startDateIdx: index('bills_start_date_idx').on(table.startDate),
  endDateIdx: index('bills_end_date_idx').on(table.endDate),
  createdAtIdx: index('bills_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('bills_updated_at_idx').on(table.updatedAt),
  // Check constraint to enforce year_interval range (1-99)
  yearIntervalCheck: check('year_interval_check', sql`year_interval >= 1 AND year_interval <= 99`),
}));

/**
 * Payments table for tracking individual payment instances for each bill.
 * Supports both unique and recurring payment schedules with automatic generation.
 */
export const payments = pgTable('payments', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  billId: varchar('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  paymentNumber: integer('payment_number').notNull(), // 1, 2, 3... for recurring bills
  scheduledDate: date('scheduled_date').notNull(),
  paidDate: date('paid_date'), // nullable - set when payment is confirmed
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum('status').notNull().default('pending'),
  notes: text('notes'), // Optional notes for this specific payment
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  billIdIdx: index('payments_bill_id_idx').on(table.billId),
  statusIdx: index('payments_status_idx').on(table.status),
  // Date indexes for range queries
  scheduledDateIdx: index('payments_scheduled_date_idx').on(table.scheduledDate),
  paidDateIdx: index('payments_paid_date_idx').on(table.paidDate),
  createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('payments_updated_at_idx').on(table.updatedAt),
}));


/**
 * Budgets table for tracking financial planning by building and category.
 * Supports operational, reserve, and special project budgets.
 */
export const budgets = pgTable('budgets', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  year: integer('year').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'operational', 'reserve', 'special_project'
  budgetedAmount: decimal('budgeted_amount', { precision: 12, scale: 2 }).notNull(),
  actualAmount: decimal('actual_amount', { precision: 12, scale: 2 }).default('0'),
  variance: decimal('variance', { precision: 12, scale: 2 }).default('0'),
  approvedBy: varchar('approved_by').references(() => users.id),
  approvedDate: date('approved_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by')
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  buildingIdIdx: index('budgets_building_id_idx').on(table.buildingId),
  approvedByIdx: index('budgets_approved_by_idx').on(table.approvedBy),
  createdByIdx: index('budgets_created_by_idx').on(table.createdBy),
  // Date indexes for range queries
  approvedDateIdx: index('budgets_approved_date_idx').on(table.approvedDate),
  createdAtIdx: index('budgets_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('budgets_updated_at_idx').on(table.updatedAt),
}));

/**
 * Monthly budgets table for detailed monthly tracking of income and spending by building.
 * Automatically populated for each building from construction date to 25 years in the future.
 * Updated monthly on the 1st and supports approval workflow.
 */
export const monthlyBudgets = pgTable('monthly_budgets', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12
  incomeTypes: text('income_types').array().notNull(), // Array of income categories from money_flow
  incomes: decimal('incomes', { precision: 12, scale: 2 }).array().notNull(), // Array of income amounts corresponding to incomeTypes
  spendingTypes: text('spending_types').array().notNull(), // Array of expense categories from money_flow
  spendings: decimal('spendings', { precision: 12, scale: 2 }).array().notNull(), // Array of spending amounts corresponding to spendingTypes
  approved: boolean('approved').notNull().default(false),
  approvedBy: varchar('approved_by').references(() => users.id),
  approvedDate: timestamp('approved_date'),
  originalBudgetId: varchar('original_budget_id').references(() => monthlyBudgets.id), // References the original budget if this is an approved copy
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  buildingIdIdx: index('monthly_budgets_building_id_idx').on(table.buildingId),
  approvedByIdx: index('monthly_budgets_approved_by_idx').on(table.approvedBy),
  originalBudgetIdIdx: index('monthly_budgets_original_budget_id_idx').on(table.originalBudgetId),
  // Date indexes for range queries
  approvedDateIdx: index('monthly_budgets_approved_date_idx').on(table.approvedDate),
  createdAtIdx: index('monthly_budgets_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('monthly_budgets_updated_at_idx').on(table.updatedAt),
}));

/**
 * Capital investments table for tracking building infrastructure investments and improvements.
 * Supports both auto-generated suggestions and custom user-defined investments.
 */
export const capitalInvestments = pgTable('capital_investments', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  title: text('title').notNull(),
  description: text('description'),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  targetDate: date('target_date').notNull(),
  urgency: investmentUrgencyEnum('urgency').notNull(),
  type: investmentTypeEnum('type').notNull(),
  ownershipType: investmentOwnershipEnum('ownership_type').notNull(),
  category: text('category'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  buildingIdIdx: index('capital_investments_building_id_idx').on(table.buildingId),
  urgencyIdx: index('capital_investments_urgency_idx').on(table.urgency),
  typeIdx: index('capital_investments_type_idx').on(table.type),
  ownershipTypeIdx: index('capital_investments_ownership_type_idx').on(table.ownershipType),
  // Date indexes for range queries
  targetDateIdx: index('capital_investments_target_date_idx').on(table.targetDate),
  createdAtIdx: index('capital_investments_created_at_idx').on(table.createdAt),
  updatedAtIdx: index('capital_investments_updated_at_idx').on(table.updatedAt),
}));

/**
 * Real-time financial calculator that replaces the money_flow table
 * with dynamic calculations and smart caching.
 */

// SCHEMA DEBT: SQL views disabled for drizzle-kit compatibility.
// These views are defined below but commented out because drizzle-kit cannot
// generate migrations for pgMaterializedView / pgView definitions.
//
// Migration guidance:
// 1. When ready to enable, create a manual SQL migration that runs
//    CREATE MATERIALIZED VIEW active_financial_sources AS (...)
//    and CREATE VIEW current_month_financials AS (...).
// 2. Uncomment the Drizzle definitions below so the ORM can reference them.
// 3. Add a REFRESH MATERIALIZED VIEW cron job for active_financial_sources.
// 4. Keep the manual migration and these definitions in sync — changes to
//    column lists or WHERE clauses must be applied in both places.
//
// Materialized view for active financial sources (bills + residences)
/*
export const activeFinancialSources = pgMaterializedView('active_financial_sources').as((qb) => {
  return qb
    .select({
      id: bills.id,
      buildingId: bills.buildingId,
      sourceType: sql<string>`'bill'`.as('source_type'),
      category: bills.category,
      title: bills.title,
      amount: bills.totalAmount,
      costs: bills.costs,
      schedulePayment: bills.schedulePayment,
      scheduleCustom: bills.scheduleCustom,
      startDate: bills.startDate,
      endDate: bills.endDate,
      paymentType: bills.paymentType,
      flowType: sql<string>`'expense'`.as('flow_type'),
      isActive: sql<boolean>`${bills.status} IN ('sent', 'draft')`.as('is_active'),
      referenceId: bills.id,
      unitNumber: sql<string>`NULL`.as('unit_number'),
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
    })
    .from(bills)
    .where(sql`${bills.paymentType} = 'recurrent'`)

    .unionAll(
      qb
        .select({
          id: residences.id,
          buildingId: residences.buildingId,
          sourceType: sql<string>`'residence'`.as('source_type'),
          category: sql<'maintenance'>`'maintenance'`.as('category'),
          title: sql<string>`CONCAT('Monthly fees - Unit ', ${residences.unitNumber})`.as('title'),
          amount: residences.monthlyFees,
          costs: sql<string[]>`ARRAY[${residences.monthlyFees}]`.as('costs'),
          schedulePayment: sql<'monthly'>`'monthly'`.as('schedule_payment'),
          scheduleCustom: sql<string[]>`NULL`.as('schedule_custom'),
          startDate: sql<string>`CURRENT_DATE`.as('start_date'),
          endDate: sql<string>`NULL`.as('end_date'),
          paymentType: sql<'recurrent'>`'recurrent'`.as('payment_type'),
          flowType: sql<string>`'income'`.as('flow_type'),
          isActive: sql<boolean>`${residences.isActive} AND ${residences.monthlyFees} > 0`.as(
            'is_active'
          ),
          referenceId: residences.id,
          unitNumber: residences.unitNumber,
          createdAt: residences.createdAt,
          updatedAt: residences.updatedAt,
        })
        .from(residences)
        .innerJoin(buildings, sql`${residences.buildingId} = ${buildings.id}`)
        .where(sql`${residences.isActive} = true AND ${buildings.isActive} = true`)
    );
});
*/

// View for current month financial summary (fast lookup)
// Temporarily disabled for drizzle-kit compatibility - will create manually
/*
export const currentMonthFinancials = pgView('current_month_financials').as((qb) => {
  return qb
    .select({
      buildingId: activeFinancialSources.buildingId,
      month: sql<number>`EXTRACT(MONTH FROM CURRENT_DATE)::int`.as('month'),
      year: sql<number>`EXTRACT(YEAR FROM CURRENT_DATE)::int`.as('year'),
      totalIncome: sql<string>`
          COALESCE(
            SUM(CASE WHEN ${activeFinancialSources.flowType} = 'income' 
                     THEN ${activeFinancialSources.amount} ELSE 0 END), 0
          )
        `.as('total_income'),
      totalExpenses: sql<string>`
          COALESCE(
            SUM(CASE WHEN ${activeFinancialSources.flowType} = 'expense' 
                     THEN ${activeFinancialSources.amount} ELSE 0 END), 0
          )
        `.as('total_expenses'),
      activeIncomeStreams: sql<number>`
          COUNT(CASE WHEN ${activeFinancialSources.flowType} = 'income' THEN 1 END)::int
        `.as('active_income_streams'),
      activeExpenseStreams: sql<number>`
          COUNT(CASE WHEN ${activeFinancialSources.flowType} = 'expense' THEN 1 END)::int
        `.as('active_expense_streams'),
      lastUpdated: sql<string>`MAX(${activeFinancialSources.updatedAt})`.as('last_updated'),
    })
    .from(activeFinancialSources)
    .where(sql`${activeFinancialSources.isActive} = true`)
    .groupBy(activeFinancialSources.buildingId);
});
*/

// Cache table for frequently accessed financial calculations
export const financialCache = pgTable('financial_cache', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  buildingId: varchar('building_id')
    .notNull()
    .references(() => buildings.id),
  cacheKey: text('cache_key').notNull(),
  cacheData: jsonb('cache_data').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  unqFinancialCache: uniqueIndex('unq_financial_cache').on(
    table.buildingId,
    table.cacheKey,
    table.startDate,
    table.endDate
  ),
  idxFinancialCacheLookup: index('idx_financial_cache_lookup').on(
    table.buildingId,
    table.cacheKey,
    table.expiresAt
  ),
  // Date indexes for range queries
  startDateIdx: index('financial_cache_start_date_idx').on(table.startDate),
  endDateIdx: index('financial_cache_end_date_idx').on(table.endDate),
  createdAtIdx: index('financial_cache_created_at_idx').on(table.createdAt),
  expiresAtIdx: index('financial_cache_expires_at_idx').on(table.expiresAt),
}));

// Insert schemas
// Removed insertMoneyFlowSchema - money flow table deleted

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertBillSchema = z.object({
  buildingId: z.string().uuid(),
  billNumber: z.string().min(1, "Bill number is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.enum(['administration', 'construction', 'consulting', 'equipment_rental', 'insurance', 'legal_services', 'maintenance', 'professional_services', 'repairs', 'supplies', 'taxes', 'utilities', 'other']),
  paymentType: z.enum(['unique', 'recurrent']),
  schedulePayment: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
  yearInterval: z.coerce.number().int().min(1, "Year interval must be at least 1").max(99, "Year interval cannot exceed 99 years").optional().default(1),
  scheduleCustom: z.array(z.coerce.date()).optional().refine(
    (dates) => !dates || dates.length === 0 || dates.every(date => date instanceof Date && !isNaN(date.getTime())),
    "All custom schedule dates must be valid dates"
  ),
  costs: z.array(z.coerce.number().positive("All costs must be positive")).min(1, "At least one cost is required"),
  totalAmount: z.coerce.number().positive("Total amount must be positive"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['draft', 'sent', 'overdue', 'paid', 'cancelled']).default('draft'),
  isAutoGenerated: z.boolean().default(false),
  sourceTemplateId: z.string().optional(),
  autoGeneratedLabel: z.string().optional(),
  reference: z.string().optional(),
  createdBy: z.string().uuid().optional(),
});


export const insertBudgetSchema = z.object({
  buildingId: z.string().uuid(),
  year: z.number().int(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string(),
  budgetedAmount: z.number(),
  actualAmount: z.number().optional(),
  createdBy: z.string().uuid().optional(),
});

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertMonthlyBudgetSchema = z.object({
  buildingId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  incomeTypes: z.array(z.string()),
  incomes: z.array(z.string()), // Decimal strings
  spendingTypes: z.array(z.string()),
  spendings: z.array(z.string()), // Decimal strings
  approved: z.boolean().default(false),
  approvedBy: z.string().uuid().optional(),
  approvedDate: z.date().optional(),
});

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertPaymentSchema = z.object({
  billId: z.string().uuid(),
  paymentNumber: z.number().int().positive("Payment number must be positive"),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal with up to 2 decimal places"),
  status: z.enum(['pending', 'overdue', 'paid', 'cancelled']).default('pending'),
  notes: z.string().optional(),
});

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertCapitalInvestmentSchema = z.object({
  buildingId: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullish(),
  amount: z.coerce.number().positive("Amount must be positive"),
  targetDate: z.coerce.date(),
  urgency: z.enum(['not_urgent', 'urgent', 'suggested']),
  type: z.enum(['auto_generated', 'custom']),
  ownershipType: z.enum(['residences', 'owner']),
  category: z.string().nullish(),
});

// Temporary fix: Manual schema definition to avoid createInsertSchema issue
export const insertFinancialCacheSchema = z.object({
  buildingId: z.string().uuid('Building ID must be a valid UUID'),
  cacheKey: z.string().min(1, 'Cache key is required'),
  cacheData: z.any(), // JSONB data
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  expiresAt: z.date(),
});

// Types

/**
 * Bills insert and select types.
 */
export type InsertBill = typeof bills.$inferInsert;
/**
 *
 */
export type Bill = typeof bills.$inferSelect;


/**
 * Budget insert and select types.
 */
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
/**
 *
 */
export type Budget = typeof budgets.$inferSelect;

/**
 * Monthly budget insert and select types.
 */
export type InsertMonthlyBudget = typeof monthlyBudgets.$inferInsert;
/**
 *
 */
export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;

/**
 * Payment insert and select types.
 */
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
/**
 *
 */
export type Payment = typeof payments.$inferSelect;

/**
 * Capital investment insert and select types.
 */
export type InsertCapitalInvestment = z.infer<typeof insertCapitalInvestmentSchema>;
/**
 *
 */
export type CapitalInvestment = typeof capitalInvestments.$inferSelect;

// Types for the financial views system
/**
 * Financial period data interface for cash flow calculations.
 */
export interface FinancialPeriodData {
  buildingId: string;
  startDate: string;
  endDate: string;
  monthlyData: Array<{
    year: number;
    month: number;
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    incomeByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
  }>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    averageMonthlyIncome: number;
    averageMonthlyExpenses: number;
  };
}

/**
 * Financial cache entry interface.
 */
export interface FinancialCacheEntry {
  id: string;
  buildingId: string;
  cacheKey: string;
  cacheData: FinancialPeriodData;
  startDate: string;
  endDate: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Financial cache insert and select types.
 */
export type InsertFinancialCache = z.infer<typeof insertFinancialCacheSchema>;
export type FinancialCache = typeof financialCache.$inferSelect;

// Relations - temporarily commented out due to drizzle-orm version compatibility
// Removed moneyFlow relations
//   }),
//   residence: one(residences, {
//   (removed money flow relations)
//   }),
// }));

// export const billsRelations = relations(bills, ({ one, many }) => ({
//   building: one(buildings, {
//     fields: [bills.buildingId],
//     references: [buildings.id],
//   }),
//   createdBy: one(users, {
//     fields: [bills.createdBy],
//     references: [users.id],
//   }),
//   originalBill: one(bills, {
//     fields: [bills.reference],
//     references: [bills.id],
//     relationName: 'billReference'
//   }),
//   generatedBills: many(bills, {
//     relationName: 'billReference'
//   }),
//   (removed money flow relations),
// }));


// export const budgetsRelations = relations(budgets, ({ one }) => ({
//   building: one(buildings, {
//     fields: [budgets.buildingId],
//     references: [buildings.id],
//   }),
//   createdBy: one(users, {
//     fields: [budgets.createdBy],
//     references: [users.id],
//   }),
//   approvedBy: one(users, {
//     fields: [budgets.approvedBy],
//     references: [users.id],
//   }),
// }));

// export const monthlyBudgetsRelations = relations(monthlyBudgets, ({ one }) => ({
//   building: one(buildings, {
//     fields: [monthlyBudgets.buildingId],
//     references: [buildings.id],
//   }),
//   approvedBy: one(users, {
//     fields: [monthlyBudgets.approvedBy],
//     references: [users.id],
//   }),
//   originalBudget: one(monthlyBudgets, {
//     fields: [monthlyBudgets.originalBudgetId],
//     references: [monthlyBudgets.id],
//     relationName: 'budgetCopy'
//   }),
// }));
