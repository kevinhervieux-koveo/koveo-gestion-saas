import { sql } from 'drizzle-orm';
import {
  pgMaterializedView,
  pgView,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  decimal,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';
import { bills, residences, buildings } from './property';

/**
 * Real-time financial calculator that replaces the money_flow table
 * with dynamic calculations and smart caching.
 */

// Materialized view for active financial sources (bills + residences)
export const activeFinancialSources = pgMaterializedView('active_financial_sources')
  .as((qb) => {
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
            category: sql<string>`'monthly_fees'`.as('category'),
            title: sql<string>`CONCAT('Monthly fees - Unit ', ${residences.unitNumber})`.as('title'),
            amount: residences.monthlyFees,
            costs: sql<decimal[]>`ARRAY[${residences.monthlyFees}]`.as('costs'),
            schedulePayment: sql<string>`'monthly'`.as('schedule_payment'),
            scheduleCustom: sql<string[]>`NULL`.as('schedule_custom'),
            startDate: sql<string>`CURRENT_DATE`.as('start_date'),
            endDate: sql<string>`NULL`.as('end_date'),
            paymentType: sql<string>`'recurrent'`.as('payment_type'),
            flowType: sql<string>`'income'`.as('flow_type'),
            isActive: sql<boolean>`${residences.isActive} AND ${residences.monthlyFees} > 0`.as('is_active'),
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

// View for current month financial summary (fast lookup)
export const currentMonthFinancials = pgView('current_month_financials')
  .as((qb) => {
    return qb
      .select({
        buildingId: activeFinancialSources.buildingId,
        month: sql<number>`EXTRACT(MONTH FROM CURRENT_DATE)::int`.as('month'),
        year: sql<number>`EXTRACT(YEAR FROM CURRENT_DATE)::int`.as('year'),
        totalIncome: sql<decimal>`
          COALESCE(
            SUM(CASE WHEN ${activeFinancialSources.flowType} = 'income' 
                     THEN ${activeFinancialSources.amount} ELSE 0 END), 0
          )
        `.as('total_income'),
        totalExpenses: sql<decimal>`
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
        lastUpdated: sql<timestamp>`MAX(${activeFinancialSources.updatedAt})`.as('last_updated'),
      })
      .from(activeFinancialSources)
      .where(sql`${activeFinancialSources.isActive} = true`)
      .groupBy(activeFinancialSources.buildingId);
  });

// Cache table for frequently accessed financial calculations
export const financialCache = sql`
  CREATE TABLE IF NOT EXISTS financial_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id UUID NOT NULL REFERENCES buildings(id),
    cache_key VARCHAR(255) NOT NULL,
    cache_data JSONB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(building_id, cache_key, start_date, end_date)
  );
  
  CREATE INDEX IF NOT EXISTS idx_financial_cache_lookup 
    ON financial_cache(building_id, cache_key, expires_at);
  CREATE INDEX IF NOT EXISTS idx_financial_cache_expires 
    ON financial_cache(expires_at) WHERE expires_at < NOW();
`;

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