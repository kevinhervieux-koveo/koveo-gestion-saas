import { db } from '../db';
import { eq, and, or, sql } from 'drizzle-orm';
import { dynamicFinancialCalculator } from './dynamic-financial-calculator';
import * as schema from '@shared/schema';

const { bills, residences, buildings } = schema;

/**
 * Financial Automation Service - Replaces MoneyFlowAutomationService
 * Handles cache invalidation when source data changes instead of pre-generating entries.
 */
export class FinancialAutomationService {
  /**
   * Handle bill creation/update by invalidating related caches.
   * @param billId
   * @param action
   */
  async handleBillUpdate(billId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    const bill = await db
      .select({
        buildingId: bills.buildingId,
        billNumber: bills.billNumber,
        paymentType: bills.paymentType,
      })
      .from(bills)
      .where(eq(bills.id, billId))
      .limit(1);

    if (bill.length === 0 && action !== 'delete') {
      throw new Error(`Bill ${billId} not found`);
    }

    const buildingId = bill[0]?.buildingId;
    const billNumber = bill[0]?.billNumber;

    if (buildingId) {
      await dynamicFinancialCalculator.invalidateCache(
        buildingId,
        `bill ${action}: ${billNumber}`
      );
    }
  }

  /**
   * Handle residence monthly fee updates by invalidating related caches.
   * @param residenceId
   * @param action
   */
  async handleResidenceUpdate(
    residenceId: string,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    const residence = await db
      .select({
        buildingId: residences.buildingId,
        unitNumber: residences.unitNumber,
        monthlyFees: residences.monthlyFees,
      })
      .from(residences)
      .where(eq(residences.id, residenceId))
      .limit(1);

    if (residence.length === 0 && action !== 'delete') {
      throw new Error(`Residence ${residenceId} not found`);
    }

    const buildingId = residence[0]?.buildingId;
    const unitNumber = residence[0]?.unitNumber;

    if (buildingId) {
      await dynamicFinancialCalculator.invalidateCache(
        buildingId,
        `residence ${action}: Unit ${unitNumber}`
      );
    }
  }

  async handleBuildingUpdate(
    buildingId: string,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await dynamicFinancialCalculator.invalidateCache(buildingId, `building ${action}`);
  }

  /**
   * Get financial statistics - much simpler than the old money_flow approach.
   */
  async getFinancialStatistics(): Promise<{
    activeBills: number;
    activeResidences: number;
    totalCacheEntries: number;
    lastCalculation: string | null;
    systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    try {
      // Count active bills
      const [billsResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bills)
        .where(and(eq(bills.paymentType, 'recurrent'), sql`${bills.status} IN ('sent', 'draft')`));

      // Count active residences with fees
      const [residencesResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(residences)
        .where(and(eq(residences.isActive, true), sql`${residences.monthlyFees} > 0`));

      // Get cache statistics
      const cacheStats = await dynamicFinancialCalculator.getCacheStatistics();

      // Determine system health
      let systemHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (cacheStats.expiredEntries > cacheStats.totalEntries * 0.5) {
        systemHealth = 'degraded';
      }
      if (cacheStats.totalEntries === 0 && (billsResult.count > 0 || residencesResult.count > 0)) {
        systemHealth = 'unhealthy';
      }

      return {
        activeBills: billsResult.count,
        activeResidences: residencesResult.count,
        totalCacheEntries: cacheStats.totalEntries,
        lastCalculation: cacheStats.newestEntry,
        systemHealth,
      };
    } catch (error) {
      return {
        activeBills: 0,
        activeResidences: 0,
        totalCacheEntries: 0,
        lastCalculation: null,
        systemHealth: 'unhealthy',
      };
    }
  }

  /**
   * Perform maintenance tasks (cleanup expired cache, etc.).
   */
  async performMaintenance(): Promise<{
    cacheEntriesRemoved: number;
    systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {

    try {
      // Get initial cache count
      const initialStats = await dynamicFinancialCalculator.getCacheStatistics();

      // Clean up expired cache entries (this happens automatically in the calculator)
      await db.execute(sql`DELETE FROM financial_cache WHERE expires_at < NOW()`);

      // Get final cache count
      const finalStats = await dynamicFinancialCalculator.getCacheStatistics();
      const removedEntries = initialStats.totalEntries - finalStats.totalEntries;

      // Get system stats
      const systemStats = await this.getFinancialStatistics();


      return {
        cacheEntriesRemoved: removedEntries,
        systemHealth: systemStats.systemHealth,
      };
    } catch (error) {
      return {
        cacheEntriesRemoved: 0,
        systemHealth: 'unhealthy',
      };
    }
  }

  /**
   * Initialize the financial system (create cache table if needed).
   */
  async initialize(): Promise<void> {
    await db.execute(sql`
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
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_financial_cache_lookup 
        ON financial_cache(building_id, cache_key, expires_at)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_financial_cache_expires 
        ON financial_cache(expires_at) WHERE expires_at < NOW()
    `);
  }
}

// Export singleton instance
export const financialAutomationService = new FinancialAutomationService();
