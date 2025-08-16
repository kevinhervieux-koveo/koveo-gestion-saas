/**
 * Database initialization script for Quebec property management SaaS.
 * Applies all performance optimizations including indexes and maintenance.
 */

import { QueryOptimizer, DatabaseMaintenance } from './database-optimization';
import { dbPerformanceMonitor } from './performance-monitoring';

/**
 * Initializes all database optimizations to reduce 132ms average query time.
 */
export async function initializeDatabaseOptimizations(): Promise<void> {
  console.log('🚀 Initializing database optimizations for Koveo Gestion...');
  
  try {
    // Apply core database indexes
    console.log('📊 Applying database indexes...');
    await QueryOptimizer.applyCoreOptimizations();
    console.log('✅ Database indexes applied successfully');
    
    // Perform initial maintenance
    console.log('🔧 Performing database maintenance...');
    await DatabaseMaintenance.performMaintenance();
    console.log('✅ Database maintenance completed');
    
    // Analyze initial performance
    console.log('📈 Analyzing query performance...');
    await QueryOptimizer.analyzeQueryPerformance();
    console.log('✅ Performance analysis completed');
    
    // Log optimization suggestions
    const suggestions = QueryOptimizer.getOptimizationSuggestions();
    if (suggestions.length > 0) {
      console.log('💡 Optimization suggestions:');
      suggestions.forEach(suggestion => console.log(`   • ${suggestion}`));
    }
    
    console.log('🎯 Database optimizations initialized successfully');
    console.log('📊 Performance monitoring active - target: reduce 132ms query time');
    
  } catch (error) {
    console.error('❌ Database optimization initialization failed:', error);
    throw error;
  }
}

/**
 * Monitors and reports database performance periodically.
 */
export function startPerformanceMonitoring(): void {
  console.log('🔍 Starting database performance monitoring...');
  
  // Log performance stats every 5 minutes
  setInterval(() => {
    const stats = dbPerformanceMonitor.getPerformanceStats();
    const recommendations = dbPerformanceMonitor.getOptimizationRecommendations();
    
    console.log('📊 Database Performance Report:');
    console.log(`   Average Query Time: ${stats.averageQueryTime}`);
    console.log(`   Total Queries: ${stats.totalQueries}`);
    console.log(`   Slow Queries: ${stats.slowQueries}`);
    
    if (recommendations.length > 0) {
      console.log('💡 Performance Recommendations:');
      recommendations.forEach(rec => console.log(`   • ${rec}`));
    }
    
    // Alert if average query time exceeds target
    const avgTime = parseFloat(stats.averageQueryTime.replace('ms', ''));
    if (avgTime > 50) { // Target: reduce from 132ms to under 50ms
      console.warn(`⚠️  Average query time (${stats.averageQueryTime}) exceeds target (50ms)`);
    } else {
      console.log(`✅ Query performance within target: ${stats.averageQueryTime}`);
    }
    
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Emergency performance optimization for when queries are too slow.
 */
export async function emergencyOptimization(): Promise<void> {
  console.log('🚨 Running emergency database optimization...');
  
  try {
    // Clear caches to reset state
    const { queryCache } = await import('./query-cache');
    queryCache.clearAll();
    console.log('✅ Cleared query caches');
    
    // Force database maintenance
    await DatabaseMaintenance.performMaintenance();
    console.log('✅ Forced database maintenance');
    
    // Reset performance monitoring
    dbPerformanceMonitor.reset();
    console.log('✅ Reset performance tracking');
    
    console.log('🎯 Emergency optimization completed');
    
  } catch (error) {
    console.error('❌ Emergency optimization failed:', error);
  }
}

/**
 * Gets current optimization status.
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