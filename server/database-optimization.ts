/**
 * Database optimization utilities for Quebec property management SaaS.
 * Provides index creation, query optimization, and caching strategies.
 */

import { sql } from 'drizzle-orm';

/**
 * Database optimization queries for improving performance.
 * Targets 132ms average query time reduction through strategic indexing.
 */
export const DatabaseOptimization = {
  
  /**
   * Core indexes for frequently queried foreign keys and search fields.
   * These indexes target the most common query patterns in property management.
   */
  coreIndexes: [
    // Users table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login_at)',
    
    // Organizations table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_type ON organizations(type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_active ON organizations(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_city ON organizations(city)',
    
    // Buildings table indexes  
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_org_id ON buildings(organization_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_type ON buildings(building_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_active ON buildings(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_city ON buildings(city)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_postal ON buildings(postal_code)',
    
    // Residences table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_residences_building_id ON residences(building_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_residences_unit ON residences(unit_number)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_residences_active ON residences(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_residences_floor ON residences(floor)',
    
    // User-Residences relationship indexes  
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_residences_user_id ON user_residences(user_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_residences_residence_id ON user_residences(residence_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_residences_active ON user_residences(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_residences_relationship ON user_residences(relationship_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_residences_dates ON user_residences(start_date, end_date)',
    
    // Bills table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_residence_id ON bills(residence_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_number ON bills(bill_number)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_status ON bills(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_type ON bills(type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_due_date ON bills(due_date)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_created_by ON bills(created_by)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_issue_date ON bills(issue_date)',
    
    // Maintenance requests indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_residence_id ON maintenance_requests(residence_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_submitted_by ON maintenance_requests(submitted_by)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_assigned_to ON maintenance_requests(assigned_to)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_priority ON maintenance_requests(priority)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_category ON maintenance_requests(category)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_scheduled ON maintenance_requests(scheduled_date)',
    
    // Budgets table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_building_id ON budgets(building_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_year ON budgets(year)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_category ON budgets(category)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_active ON budgets(is_active)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_created_by ON budgets(created_by)',
    
    // Documents table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org_id ON documents(organization_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_building_id ON documents(building_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_residence_id ON documents(residence_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_category ON documents(category)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_public ON documents(is_public)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)',
    
    // Notifications table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON notifications(type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read ON notifications(is_read)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_entity ON notifications(related_entity_id, related_entity_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created ON notifications(created_at)',
  ],

  /**
   * Development framework indexes for quality metrics and pillars.
   */
  frameworkIndexes: [
    // Quality metrics indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_type ON quality_metrics(metric_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_timestamp ON quality_metrics(timestamp)',
    
    // Framework configuration indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_framework_config_key ON framework_configuration(key)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_framework_config_updated ON framework_configuration(updated_at)',
    
    // Workspace status indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_component ON workspace_status(component)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_status ON workspace_status(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspace_updated ON workspace_status(last_updated)',
    
    // Development pillars indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pillars_status ON development_pillars(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pillars_order ON development_pillars("order")',
    
    // Metric effectiveness tracking indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_effectiveness_type ON metric_effectiveness_tracking(metric_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_effectiveness_validation ON metric_effectiveness_tracking(validation_date)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_effectiveness_compliance ON metric_effectiveness_tracking(quebec_compliance_impact)',
    
    // Metric predictions indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_predictions_type ON metric_predictions(metric_type)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_predictions_created ON metric_predictions(created_at)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_predictions_compliance ON metric_predictions(quebec_compliance_relevant)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_predictions_category ON metric_predictions(property_management_category)',
    
    // Prediction validations indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prediction_validations_prediction_id ON prediction_validations(prediction_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prediction_validations_status ON prediction_validations(validation_status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prediction_validations_validated ON prediction_validations(validated_at)',
    
    // Features table indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_status ON features(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_priority ON features(priority)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_category ON features(category)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_strategic ON features(is_strategic_path)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_roadmap ON features(show_on_roadmap)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_created ON features(created_at)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_synced ON features(synced_at)',
    
    // Actionable items indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actionable_items_feature_id ON actionable_items(feature_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actionable_items_status ON actionable_items(status)',
    
    // Improvement suggestions indexes
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_improvement_suggestions_category ON improvement_suggestions(category)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_improvement_suggestions_priority ON improvement_suggestions(priority)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_improvement_suggestions_status ON improvement_suggestions(status)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_improvement_suggestions_created ON improvement_suggestions(created_at)',
  ],

  /**
   * Composite indexes for complex query patterns.
   */
  compositeIndexes: [
    // User residence active relationships
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_residences_active_relationship ON user_residences(user_id, residence_id) WHERE is_active = true',
    
    // Active bills by residence and status
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_residence_status ON bills(residence_id, status, due_date)',
    
    // Active maintenance requests by residence
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_residence_status ON maintenance_requests(residence_id, status, priority)',
    
    // Active buildings by organization
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_org_active ON buildings(organization_id, is_active)',
    
    // Active residences by building
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_residences_building_active ON residences(building_id, is_active)',
    
    // Unread notifications by user
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at) WHERE is_read = false',
    
    // Current year budgets by building
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_building_year ON budgets(building_id, year, is_active)',
    
    // Recent features for roadmap
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_features_roadmap_recent ON features(show_on_roadmap, created_at) WHERE show_on_roadmap = true',
  ],

  /**
   * Partial indexes for improved performance on filtered queries.
   */
  partialIndexes: [
    // Only index active records for frequently filtered tables
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_email ON users(email) WHERE is_active = true',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_active_type ON organizations(type) WHERE is_active = true',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_buildings_active_org ON buildings(organization_id) WHERE is_active = true',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_residences_active_building ON residences(building_id) WHERE is_active = true',
    
    // Unpaid bills only
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bills_unpaid ON bills(residence_id, due_date) WHERE status IN (\'sent\', \'overdue\')',
    
    // Open maintenance requests only
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_open ON maintenance_requests(residence_id, priority) WHERE status IN (\'submitted\', \'acknowledged\', \'in_progress\')',
    
    // Unread notifications only
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at) WHERE is_read = false',
  ]
};

/**
 * Query performance monitoring and optimization utilities.
 */
export class QueryOptimizer {
  
  /**
   * Applies all core database indexes for Quebec property management.
   */
  static async applyCoreOptimizations(): Promise<void> {
    console.log('Applying core database optimizations...');
    
    const allIndexes = [
      ...DatabaseOptimization.coreIndexes,
      ...DatabaseOptimization.frameworkIndexes,
      ...DatabaseOptimization.compositeIndexes,
      ...DatabaseOptimization.partialIndexes
    ];
    
    for (const indexQuery of allIndexes) {
      try {
        await sql`${indexQuery}`;
        console.log(`✓ Applied: ${indexQuery}`);
      } catch (error) {
        console.warn(`⚠ Failed to apply index: ${indexQuery}`, error);
      }
    }
    
    console.log('Database optimizations complete');
  }
  
  /**
   * Analyzes query performance and suggests optimizations.
   */
  static async analyzeQueryPerformance(): Promise<void> {
    console.log('Analyzing query performance...');
    
    try {
      // Enable query logging temporarily
      await sql`SET log_min_duration_statement = 100`; // Log queries > 100ms
      await sql`SET log_statement = 'all'`;
      
      // Check for slow queries
      const slowQueries = await sql`
        SELECT query, mean_exec_time, calls, total_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;
      
      console.log('Slow queries detected:', slowQueries);
      
      // Check index usage
      const indexUsage = await sql`
        SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_tup_read > 0
        ORDER BY idx_tup_read DESC
        LIMIT 20
      `;
      
      console.log('Index usage statistics:', indexUsage);
      
    } catch (error) {
      console.warn('Query performance analysis failed:', error);
    }
  }
  
  /**
   * Provides query optimization suggestions.
   */
  static getOptimizationSuggestions(): string[] {
    return [
      'Add indexes on frequently queried foreign keys',
      'Use partial indexes for filtered queries (e.g., WHERE is_active = true)',
      'Implement query result caching for expensive operations',
      'Use LIMIT clauses for large result sets',
      'Consider materialized views for complex aggregations',
      'Optimize JOIN order in complex queries',
      'Use EXISTS instead of IN for subqueries',
      'Implement pagination for large datasets',
      'Add covering indexes for SELECT-heavy queries',
      'Regular VACUUM and ANALYZE maintenance'
    ];
  }
}

/**
 * Database maintenance utilities for optimal performance.
 */
export class DatabaseMaintenance {
  
  /**
   * Performs routine database maintenance for optimal performance.
   */
  static async performMaintenance(): Promise<void> {
    console.log('Starting database maintenance...');
    
    try {
      // Update table statistics
      await sql`ANALYZE`;
      console.log('✓ Updated table statistics');
      
      // Clean up unused space
      await sql`VACUUM`;
      console.log('✓ Cleaned up unused space');
      
      // Reindex for optimal performance
      await sql`REINDEX DATABASE CONCURRENTLY ${process.env.PGDATABASE}`;
      console.log('✓ Rebuilt indexes');
      
    } catch (error) {
      console.warn('Database maintenance completed with warnings:', error);
    }
    
    console.log('Database maintenance complete');
  }
  
  /**
   * Monitors database performance metrics.
   */
  static async getPerformanceMetrics(): Promise<any> {
    try {
      const metrics = await sql`
        SELECT 
          'connections' as metric,
          count(*) as value
        FROM pg_stat_activity
        UNION ALL
        SELECT 
          'slow_queries' as metric,
          count(*) as value
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        UNION ALL
        SELECT 
          'cache_hit_ratio' as metric,
          round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) as value
        FROM pg_stat_database
        WHERE datname = current_database()
      `;
      
      return metrics;
      
    } catch (error) {
      console.warn('Failed to get performance metrics:', error);
      return [];
    }
  }
}