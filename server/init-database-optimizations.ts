/**
 * Database initialization script for Quebec property management SaaS.
 * Applies all performance optimizations including indexes and maintenance.
 */

import { QueryOptimizer, DatabaseMaintenance } from './database-optimization';
import { dbPerformanceMonitor } from './performance-monitoring';

/**
 * Initializes all database optimizations to reduce 132ms average query time.
 */
/**
 * InitializeDatabaseOptimizations function.
 * @returns Function result.
 */
export async function initializeDatabaseOptimizations(): Promise<void> {
  console.warn('🚀 Initializing database optimizations for Koveo Gestion...');
  
  try {
    // Apply core database indexes
    console.warn('📊 Applying database indexes...');
    await QueryOptimizer.applyCoreOptimizations();
    console.warn('✅ Database indexes applied successfully');
    
    // Perform initial maintenance
    console.warn('🔧 Performing database maintenance...');
    await DatabaseMaintenance.performMaintenance();
    console.warn('✅ Database maintenance completed');
    
    // Analyze initial performance
    console.warn('📈 Analyzing query performance...');
    await QueryOptimizer.analyzeQueryPerformance();
    console.warn('✅ Performance analysis completed');
    
    // Log optimization suggestions
    const suggestions = QueryOptimizer.getOptimizationSuggestions();
    if (suggestions.length > 0) {
      console.warn('💡 Optimization suggestions:');
      suggestions.forEach(suggestion => console.warn(`   • ${suggestion}`));
    }
    
    console.warn('🎯 Database optimizations initialized successfully');
    console.warn('📊 Performance monitoring active - target: reduce 132ms query time');
    
  } catch (____error) {
    console.error('❌ Database optimization initialization failed:', _error);
    throw _error;
  }
}

/**
 * Monitors and reports database performance periodically.
 */
/**
 * StartPerformanceMonitoring function.
 * @returns Function result.
 */
export function startPerformanceMonitoring(): void {
  console.warn('🔍 Starting database performance monitoring...');
  
  // Log performance stats every 5 minutes
  setInterval(() => {
    const stats = dbPerformanceMonitor.getPerformanceStats();
    const recommendations = dbPerformanceMonitor.getOptimizationRecommendations();
    
    console.warn('📊 Database Performance Report:');
    console.warn(`   Average Query Time: ${stats.averageQueryTime}`);
    console.warn(`   Total Queries: ${stats.totalQueries}`);
    console.warn(`   Slow Queries: ${stats.slowQueries}`);
    
    if (recommendations.length > 0) {
      console.warn('💡 Performance Recommendations:');
      recommendations.forEach(rec => console.warn(`   • ${rec}`));
    }
    
    // Alert if average query time exceeds target
    const avgTime = parseFloat(stats.averageQueryTime.replace('ms', ''));
    if (avgTime > 50) { // Target: reduce from 132ms to under 50ms
      console.warn(`⚠️  Average query time (${stats.averageQueryTime}) exceeds target (50ms)`);
    } else {
      console.warn(`✅ Query performance within target: ${stats.averageQueryTime}`);
    }
    
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Emergency performance optimization for when queries are too slow.
 */
/**
 * EmergencyOptimization function.
 * @returns Function result.
 */
export async function emergencyOptimization(): Promise<void> {
  console.warn('🚨 Running emergency database optimization...');
  
  try {
    // Clear caches to reset state
    const { queryCache } = await import('./query-cache');
    queryCache.clearAll();
    console.warn('✅ Cleared query caches');
    
    // Force database maintenance
    await DatabaseMaintenance.performMaintenance();
    console.warn('✅ Forced database maintenance');
    
    // Reset performance monitoring
    dbPerformanceMonitor.reset();
    console.warn('✅ Reset performance tracking');
    
    console.warn('🎯 Emergency optimization completed');
    
  } catch (_error) {
    console.error('❌ Emergency optimization failed:', _error);
  }
}

/**
 * Gets current optimization status.
 */
/**
 * GetOptimizationStatus function.
 * @returns Function result.
 */
export function getOptimizationStatus(): any {
  const performanceStats = dbPerformanceMonitor.getPerformanceStats();
  const avgTime = parseFloat(performanceStats.averageQueryTime.replace('ms', ''));
  
  return {
    status: avgTime <= 50 ? 'optimal' : avgTime <= 100 ? 'acceptable' : 'needs_optimization',
    currentAverage: performanceStats.averageQueryTime,
    target: '50ms',
    improvement: avgTime < 132 ? `${((132 - avgTime) / 132 * 100).toFixed(1)}% faster` : 'no improvement',
    recommendations: dbPerformanceMonitor.getOptimizationRecommendations(),
    performanceStats
  };
}