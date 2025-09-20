import { sql } from 'drizzle-orm';
import {
  pgMaterializedView,
  pgView,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  integer,
  decimal,
  date,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { residences, buildings } from './property';
import { bills } from './financial';

/**
 * Real-time financial calculator that replaces the money_flow table
 * with dynamic calculations and smart caching.
 */

// Materialized view for active financial sources (bills + residences)
// Temporarily disabled for drizzle-kit compatibility - will create manually
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
}));

// Types for the new system
/**
 *
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
 *
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

// Insert schema and types for financialCache table
export const insertFinancialCacheSchema = createInsertSchema(financialCache, {
  buildingId: z.string().uuid('Building ID must be a valid UUID'),
  cacheKey: z.string().min(1, 'Cache key is required'),
  cacheData: z.any(), // JSONB data
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  expiresAt: z.date(),
}).omit({ id: true, createdAt: true });

export type InsertFinancialCache = z.infer<typeof insertFinancialCacheSchema>;
export type FinancialCache = typeof financialCache.$inferSelect;
