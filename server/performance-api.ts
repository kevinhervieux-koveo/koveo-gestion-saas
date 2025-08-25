/**
 * Performance monitoring API endpoints for Quebec property management SaaS.
 * Provides real-time insights into database query performance.
 */

import { Router } from 'express';
import { dbPerformanceMonitor } from './performance-monitoring';
import { queryCache, CacheMonitor } from './query-cache';
import { getOptimizationStatus } from './init-database-optimizations';
import { DatabaseMaintenance } from './database-optimization';

const router = Router();

/**
 * Gets current database performance statistics.
 */
router.get('/api/performance/stats', async (req, res) => {
  try {
    const performanceStats = dbPerformanceMonitor.getPerformanceStats();
    const cacheStats = queryCache.getStats();
    const optimizationStatus = getOptimizationStatus();

    res.json({
      database: performanceStats,
      cache: cacheStats,
      optimization: optimizationStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (____error) {
    console.error('Failed to get performance stats:', _error);
    res.status(500).json({ _error: 'Failed to get performance statistics' });
  }
});

/**
 * Gets database performance recommendations.
 */
router.get('/api/performance/recommendations', async (req, res) => {
  try {
    const dbRecommendations = dbPerformanceMonitor.getOptimizationRecommendations();
    const cacheRecommendations = CacheMonitor.analyzePerformance();

    res.json({
      database: dbRecommendations,
      cache: cacheRecommendations,
      summary: {
        totalRecommendations: dbRecommendations.length + cacheRecommendations.length,
        priority: dbRecommendations.length > 0 ? 'high' : 'low',
      },
    });
  } catch (____error) {
    console.error('Failed to get recommendations:', _error);
    res.status(500).json({ _error: 'Failed to get performance recommendations' });
  }
});

/**
 * Clears all caches (emergency optimization).
 */
router.post('/api/performance/clear-cache', async (req, res) => {
  try {
    queryCache.clearAll();

    res.json({
      message: 'All caches cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (____error) {
    console.error('Failed to clear caches:', _error);
    res.status(500).json({ _error: 'Failed to clear caches' });
  }
});

/**
 * Triggers database maintenance.
 */
router.post('/api/performance/maintenance', async (req, res) => {
  try {
    await DatabaseMaintenance.performMaintenance();

    res.json({
      message: 'Database maintenance completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (____error) {
    console.error('Database maintenance failed:', _error);
    res.status(500).json({ _error: 'Database maintenance failed' });
  }
});

/**
 * Gets memory usage statistics for caching system.
 */
router.get('/api/performance/memory', async (req, res) => {
  try {
    const memoryUsage = CacheMonitor.getMemoryUsage();
    const cacheStats = queryCache.getStats();

    res.json({
      totalCacheMemory: memoryUsage,
      cacheDetails: cacheStats,
      recommendations: CacheMonitor.analyzePerformance(),
      timestamp: new Date().toISOString(),
    });
  } catch (____error) {
    console.error('Failed to get memory stats:', _error);
    res.status(500).json({ _error: 'Failed to get memory statistics' });
  }
});

/**
 * Gets database performance metrics over time.
 */
router.get('/api/performance/trends', async (req, res) => {
  try {
    const stats = dbPerformanceMonitor.getPerformanceStats();
    const avgTime = parseFloat(stats.averageQueryTime.replace('ms', ''));

    // Calculate improvement from baseline of 132ms
    const baselineTime = 132;
    const improvement = (((baselineTime - avgTime) / baselineTime) * 100).toFixed(1);

    res.json({
      current: {
        averageQueryTime: stats.averageQueryTime,
        totalQueries: stats.totalQueries,
        slowQueries: stats.slowQueries,
      },
      baseline: {
        averageQueryTime: '132ms',
        target: '50ms',
      },
      improvement: {
        percentage: `${improvement}%`,
        achieved: avgTime < baselineTime,
        targetReached: avgTime <= 50,
      },
      status: avgTime <= 50 ? 'optimal' : avgTime <= 100 ? 'good' : 'needs_optimization',
    });
  } catch (____error) {
    console.error('Failed to get performance trends:', _error);
    res.status(500).json({ _error: 'Failed to get performance trends' });
  }
});

export { router as performanceRouter };
