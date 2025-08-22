import { Router } from 'express';
import { dynamicFinancialCalculator } from '../services/dynamic-financial-calculator';
import { requireAuth, requireRole } from '../auth';

const router = Router();

/**
 * Dynamic Budget API - Replaces money_flow based endpoints with real-time calculations
 * Much faster, more cost-effective, and always accurate.
 */

/**
 * Get financial data for a building with smart caching
 * GET /api/dynamic-budgets/:buildingId?startYear=2024&endYear=2026&groupBy=monthly&forceRefresh=false.
 */
router.get('/:buildingId', requireAuth, async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { 
      startYear = new Date().getFullYear() - 1,
      endYear = new Date().getFullYear() + 2,
      groupBy = 'monthly',
      forceRefresh = 'false'
    } = req.query;

    // Validate parameters
    const startYearNum = parseInt(startYear as string);
    const endYearNum = parseInt(endYear as string);
    
    if (isNaN(startYearNum) || isNaN(endYearNum) || startYearNum > endYearNum) {
      return res.status(400).json({
        _error: 'Invalid year range',
        message: 'Start year must be less than or equal to end year'
      });
    }

    if (endYearNum - startYearNum > 30) {
      return res.status(400).json({
        _error: 'Date range too large',
        message: 'Maximum range is 30 years'
      });
    }

    const startDate = `${startYearNum}-01-01`;
    const endDate = `${endYearNum}-12-31`;
    const shouldForceRefresh = forceRefresh === 'true';

    console.warn(`📊 Financial data request for building ${buildingId}, ${startDate} to ${endDate}`);

    // Get financial data using dynamic calculator
    const financialData = await dynamicFinancialCalculator.getFinancialData(
      buildingId,
      startDate,
      endDate,
      shouldForceRefresh
    );

    // Transform data based on groupBy parameter
    let responseData;
    if (groupBy === 'yearly') {
      responseData = transformToYearlyData(financialData);
    } else {
      responseData = financialData.monthlyData;
    }

    res.json({
      success: true,
      _data: responseData,
      summary: financialData.summary,
      meta: {
        buildingId,
        startDate,
        endDate,
        groupBy,
        dataPoints: responseData.length,
        generatedAt: new Date().toISOString(),
        cached: !shouldForceRefresh
      }
    });

  } catch (_error) {
    console.error('❌ Error getting dynamic financial _data:', _error);
    res.status(500).json({
      _error: 'Failed to get financial data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get financial summary for multiple buildings
 * GET /api/dynamic-budgets/summary?buildingIds=id1,id2,id3&year=2024.
 */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { buildingIds, year = new Date().getFullYear() } = req.query;
    
    if (!buildingIds) {
      return res.status(400).json({
        _error: 'Missing building IDs',
        message: 'Provide buildingIds as comma-separated values'
      });
    }

    const ids = (buildingIds as string).split(',').filter(id => id.trim());
    const yearNum = parseInt(year as string);
    
    if (ids.length === 0 || ids.length > 50) {
      return res.status(400).json({
        _error: 'Invalid building count',
        message: 'Provide 1-50 building IDs'
      });
    }

    const startDate = `${yearNum}-01-01`;
    const endDate = `${yearNum}-12-31`;

    console.warn(`📈 Summary request for ${ids.length} buildings, year ${yearNum}`);

    // Get data for all buildings concurrently
    const summaryPromises = ids.map(async (buildingId) => {
      try {
        const data = await dynamicFinancialCalculator.getFinancialData(
          buildingId.trim(),
          startDate,
          endDate
        );
        return {
          buildingId: buildingId.trim(),
          success: true,
          ...data.summary
        };
      } catch (_error) {
        return {
          buildingId: buildingId.trim(),
          success: false,
          _error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const results = await Promise.all(summaryPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Calculate aggregate summary
    const aggregate = successful.reduce((acc, curr) => ({
      totalIncome: acc.totalIncome + (curr.totalIncome || 0),
      totalExpenses: acc.totalExpenses + (curr.totalExpenses || 0),
      netCashFlow: acc.netCashFlow + (curr.netCashFlow || 0),
      buildingCount: acc.buildingCount + 1
    }), {
      totalIncome: 0,
      totalExpenses: 0, 
      netCashFlow: 0,
      buildingCount: 0
    });

    res.json({
      success: true,
      _data: {
        buildings: successful,
        aggregate,
        failed: failed.length > 0 ? failed : undefined
      },
      meta: {
        year: yearNum,
        requestedBuildings: ids.length,
        successfulBuildings: successful.length,
        failedBuildings: failed.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (_error) {
    console.error('❌ Error getting financial summary:', _error);
    res.status(500).json({
      _error: 'Failed to get financial summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Invalidate cache for a building
 * DELETE /api/dynamic-budgets/:buildingId/cache.
 */
router.delete('/:buildingId/cache', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    await dynamicFinancialCalculator.invalidateCache(buildingId, 'manual API request');
    
    res.json({
      success: true,
      message: `Cache invalidated for building ${buildingId}`
    });

  } catch (_error) {
    console.error('❌ Error invalidating cache:', _error);
    res.status(500).json({
      _error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get cache statistics
 * GET /api/dynamic-budgets/cache/stats.
 */
router.get('/cache/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const stats = await dynamicFinancialCalculator.getCacheStatistics();
    
    res.json({
      success: true,
      _data: stats,
      generatedAt: new Date().toISOString()
    });

  } catch (_error) {
    console.error('❌ Error getting cache stats:', _error);
    res.status(500).json({
      _error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Force refresh cache for a building
 * POST /api/dynamic-budgets/:buildingId/refresh.
 */
router.post('/:buildingId/refresh', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const { buildingId } = req.params;
    
    await dynamicFinancialCalculator.refreshBuildingCache(buildingId);
    
    res.json({
      success: true,
      message: `Cache refreshed for building ${buildingId}`
    });

  } catch (_error) {
    console.error('❌ Error refreshing cache:', _error);
    res.status(500).json({
      _error: 'Failed to refresh cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Transform monthly data to yearly aggregation.
 * @param financialData
 */
/**
 * TransformToYearlyData function.
 * @param financialData
 * @returns Function result.
 */
function transformToYearlyData(financialData: unknown) {
  const yearlyMap = new Map();

  for (const monthData of financialData.monthlyData) {
    const year = monthData.year;
    
    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, {
        year,
        totalIncome: 0,
        totalExpenses: 0,
        netCashFlow: 0,
        incomeByCategory: {},
        expensesByCategory: {},
        monthCount: 0
      });
    }

    const yearData = yearlyMap.get(year);
    
    // Aggregate totals
    yearData.totalIncome += monthData.totalIncome;
    yearData.totalExpenses += monthData.totalExpenses;
    yearData.netCashFlow += monthData.netCashFlow;
    yearData.monthCount += 1;

    // Aggregate categories
    for (const [_category, amount] of Object.entries(monthData.incomeByCategory || {})) {
      yearData.incomeByCategory[category] = (yearData.incomeByCategory[category] || 0) + (amount as number);
    }
    
    for (const [_category, amount] of Object.entries(monthData.expensesByCategory || {})) {
      yearData.expensesByCategory[category] = (yearData.expensesByCategory[category] || 0) + (amount as number);
    }
  }

  return Array.from(yearlyMap.values()).sort((a, b) => a.year - b.year);
}

export default router;