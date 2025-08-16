/**
 * Optimized database storage with caching and performance monitoring.
 * Replaces decorators with direct implementation for better compatibility.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, or, gte, lte, count, like, inArray } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type {
  User,
  InsertUser,
  Organization,
  InsertOrganization,
  Building,
  InsertBuilding,
  Residence,
  InsertResidence,
  DevelopmentPillar,
  InsertPillar,
  WorkspaceStatus,
  InsertWorkspaceStatus,
  QualityMetric,
  InsertQualityMetric,
  FrameworkConfiguration,
  InsertFrameworkConfig,
  ImprovementSuggestion,
  InsertImprovementSuggestion,
  Feature,
  InsertFeature,
  ActionableItem,
  InsertActionableItem,
  Invitation,
  InsertInvitation,
  InvitationAuditLog,
  InsertInvitationAuditLog,
} from '@shared/schema';
import type { IStorage } from './storage';
import { QueryOptimizer } from './database-optimization';
import { queryCache, CacheInvalidator } from './query-cache';
import { dbPerformanceMonitor } from './performance-monitoring';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

/**
 * Enhanced database storage with built-in caching and performance monitoring.
 */
export class OptimizedDatabaseStorage implements IStorage {
  
  /**
   *
   */
  constructor() {
    // Initialize optimizations on startup
    this.initializeOptimizations();
  }

  /**
   * Initializes database optimizations.
   */
  private async initializeOptimizations(): Promise<void> {
    try {
      await QueryOptimizer.applyCoreOptimizations();
      console.log('✅ Database optimizations applied');
    } catch (error) {
      console.warn('⚠️ Failed to apply database optimizations:', error);
    }
  }

  /**
   * Wrapper for performance tracking and caching.
   * @param operation
   * @param cacheKey
   * @param cacheType
   * @param fn
   */
  private async withOptimizations<T>(
    operation: string,
    cacheKey: string | null,
    cacheType: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    if (cacheKey) {
      const cached = queryCache.get<T>(cacheType, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Execute with performance tracking
    const result = await dbPerformanceMonitor.trackQuery(operation, fn);

    // Cache result
    if (cacheKey && result !== undefined) {
      queryCache.set(cacheType, cacheKey, result);
    }

    return result;
  }

  // User operations with optimization
  
  /**
   * Retrieves all active users with caching and performance tracking.
   */
  async getUsers(): Promise<User[]> {
    return this.withOptimizations(
      'getUsers',
      'all_users',
      'users',
      () => db.select().from(schema.users).where(eq(schema.users.isActive, true))
    );
  }

  /**
   * Retrieves a specific user by ID with caching.
   * @param id
   */
  async getUser(id: string): Promise<User | undefined> {
    return this.withOptimizations(
      'getUser',
      `user:${id}`,
      'users',
      async () => {
        const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
        return result[0];
      }
    );
  }

  /**
   * Retrieves a user by email with caching.
   * @param email
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.withOptimizations(
      'getUserByEmail',
      `user_email:${email}`,
      'users',
      async () => {
        const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
        return result[0];
      }
    );
  }

  /**
   * Creates a new user with cache invalidation.
   * @param insertUser
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await dbPerformanceMonitor.trackQuery('createUser', async () => {
      const inserted = await db.insert(schema.users).values(insertUser).returning();
      return inserted;
    });
    
    // Invalidate related caches
    CacheInvalidator.invalidateUserCaches('*');
    
    return result[0];
  }

  /**
   * Updates a user with cache invalidation.
   * @param id
   * @param updates
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateUser', async () => {
      return db
        .update(schema.users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning();
    });
    
    // Invalidate specific user caches
    CacheInvalidator.invalidateUserCaches(id);
    
    return result[0];
  }

  // Organization operations with optimization

  /**
   * Retrieves all active organizations with caching.
   */
  async getOrganizations(): Promise<Organization[]> {
    return this.withOptimizations(
      'getOrganizations',
      'all_organizations',
      'organizations',
      () => db.select().from(schema.organizations).where(eq(schema.organizations.isActive, true))
    );
  }

  /**
   * Retrieves an organization by ID with caching.
   * @param id
   */
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.withOptimizations(
      'getOrganization',
      `organization:${id}`,
      'organizations',
      async () => {
        const result = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates a new organization with cache invalidation.
   * @param insertOrganization
   */
  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const result = await dbPerformanceMonitor.trackQuery('createOrganization', async () => {
      return db.insert(schema.organizations).values(insertOrganization).returning();
    });
    
    // Invalidate organization caches
    queryCache.invalidate('organizations');
    
    return result[0];
  }

  // Building operations with optimization

  /**
   * Retrieves buildings by organization with caching.
   * @param organizationId
   */
  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    return this.withOptimizations(
      'getBuildingsByOrganization',
      `org_buildings:${organizationId}`,
      'buildings',
      () => db
        .select()
        .from(schema.buildings)
        .where(
          and(
            eq(schema.buildings.organizationId, organizationId),
            eq(schema.buildings.isActive, true)
          )
        )
    );
  }

  /**
   * Retrieves a building by ID with caching.
   * @param id
   */
  async getBuilding(id: string): Promise<Building | undefined> {
    return this.withOptimizations(
      'getBuilding',
      `building:${id}`,
      'buildings',
      async () => {
        const result = await db
          .select()
          .from(schema.buildings)
          .where(eq(schema.buildings.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates a new building with cache invalidation.
   * @param insertBuilding
   */
  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const result = await dbPerformanceMonitor.trackQuery('createBuilding', async () => {
      return db.insert(schema.buildings).values(insertBuilding).returning();
    });
    
    // Invalidate building caches
    CacheInvalidator.invalidateBuildingCaches('*');
    
    return result[0];
  }

  // Residence operations with optimization

  /**
   * Retrieves residences by building with caching.
   * @param buildingId
   */
  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return this.withOptimizations(
      'getResidencesByBuilding',
      `building_residences:${buildingId}`,
      'residences',
      () => db
        .select()
        .from(schema.residences)
        .where(
          and(
            eq(schema.residences.buildingId, buildingId),
            eq(schema.residences.isActive, true)
          )
        )
        .orderBy(schema.residences.unitNumber)
    );
  }

  /**
   * Retrieves a residence by ID with caching.
   * @param id
   */
  async getResidence(id: string): Promise<Residence | undefined> {
    return this.withOptimizations(
      'getResidence',
      `residence:${id}`,
      'residences',
      async () => {
        const result = await db
          .select()
          .from(schema.residences)
          .where(eq(schema.residences.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates a new residence with cache invalidation.
   * @param insertResidence
   */
  async createResidence(insertResidence: InsertResidence): Promise<Residence> {
    const result = await dbPerformanceMonitor.trackQuery('createResidence', async () => {
      return db.insert(schema.residences).values(insertResidence).returning();
    });
    
    // Invalidate residence caches
    CacheInvalidator.invalidateResidenceCaches('*');
    
    return result[0];
  }

  // Additional optimized methods for frequently accessed data

  /**
   * Gets user residences with caching - frequently accessed in property management.
   * @param userId
   */
  async getUserResidences(userId: string): Promise<any[]> {
    return this.withOptimizations(
      'getUserResidences',
      `user_residences:${userId}`,
      'residences',
      () => db
        .select({
          residence: schema.residences,
          building: schema.buildings,
          userResidence: schema.userResidences
        })
        .from(schema.userResidences)
        .innerJoin(schema.residences, eq(schema.userResidences.residenceId, schema.residences.id))
        .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
        .where(
          and(
            eq(schema.userResidences.userId, userId),
            eq(schema.userResidences.isActive, true)
          )
        )
    );
  }

  /**
   * Gets active bills for a residence - frequently queried.
   * @param residenceId
   */
  async getActiveBillsByResidence(residenceId: string): Promise<any[]> {
    return this.withOptimizations(
      'getActiveBillsByResidence',
      `residence_bills:${residenceId}`,
      'bills',
      () => db
        .select()
        .from(schema.bills)
        .where(
          and(
            eq(schema.bills.residenceId, residenceId),
            or(
              eq(schema.bills.status, 'sent'),
              eq(schema.bills.status, 'overdue')
            )
          )
        )
        .orderBy(desc(schema.bills.dueDate))
    );
  }

  /**
   * Gets maintenance requests for a residence - frequently accessed.
   * @param residenceId
   */
  async getMaintenanceRequestsByResidence(residenceId: string): Promise<any[]> {
    return this.withOptimizations(
      'getMaintenanceRequestsByResidence',
      `residence_maintenance:${residenceId}`,
      'maintenance',
      () => db
        .select()
        .from(schema.maintenanceRequests)
        .where(eq(schema.maintenanceRequests.residenceId, residenceId))
        .orderBy(desc(schema.maintenanceRequests.createdAt))
    );
  }

  // Missing Organization operations
  
  /**
   * Gets organization by name with caching.
   * @param name 
   */
  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return this.withOptimizations(
      'getOrganizationByName',
      `org_name:${name}`,
      'organizations',
      async () => {
        const result = await db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.name, name));
        return result[0];
      }
    );
  }

  /**
   * Updates organization with cache invalidation.
   * @param id
   * @param updates
   */
  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateOrganization', async () => {
      return db
        .update(schema.organizations)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.organizations.id, id))
        .returning();
    });
    
    CacheInvalidator.invalidateUserCaches('*');
    return result[0];
  }

  // Missing Building operations
  
  /**
   * Gets all buildings with caching.
   */
  async getBuildings(): Promise<Building[]> {
    return this.withOptimizations(
      'getBuildings',
      'all_buildings',
      'buildings',
      () => db.select().from(schema.buildings).where(eq(schema.buildings.isActive, true))
    );
  }

  /**
   * Updates building with cache invalidation.
   * @param id
   * @param updates
   */
  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateBuilding', async () => {
      return db
        .update(schema.buildings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.buildings.id, id))
        .returning();
    });
    
    CacheInvalidator.invalidateBuildingCaches(id);
    return result[0];
  }

  /**
   * Deletes building (soft delete).
   * @param id
   */
  async deleteBuilding(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteBuilding', async () => {
      return db
        .update(schema.buildings)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.buildings.id, id))
        .returning();
    });
    
    CacheInvalidator.invalidateBuildingCaches(id);
    return result.length > 0;
  }

  // Missing Residence operations
  
  /**
   * Gets all residences with caching.
   */
  async getResidences(): Promise<Residence[]> {
    return this.withOptimizations(
      'getResidences',
      'all_residences',
      'residences',
      () => db.select().from(schema.residences).where(eq(schema.residences.isActive, true))
    );
  }

  /**
   * Updates residence with cache invalidation.
   * @param id
   * @param updates
   */
  async updateResidence(id: string, updates: Partial<Residence>): Promise<Residence | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateResidence', async () => {
      return db
        .update(schema.residences)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.residences.id, id))
        .returning();
    });
    
    CacheInvalidator.invalidateResidenceCaches(id);
    return result[0];
  }

  /**
   * Deletes residence (soft delete).
   * @param id
   */
  async deleteResidence(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteResidence', async () => {
      return db
        .update(schema.residences)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.residences.id, id))
        .returning();
    });
    
    CacheInvalidator.invalidateResidenceCaches(id);
    return result.length > 0;
  }

  // Development Pillar operations
  
  /**
   * Gets all development pillars.
   */
  async getPillars(): Promise<DevelopmentPillar[]> {
    return this.withOptimizations(
      'getPillars',
      'all_pillars',
      'pillars',
      () => db.select().from(schema.developmentPillars)
    );
  }

  /**
   * Gets development pillar by ID.
   * @param id
   */
  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    return this.withOptimizations(
      'getPillar',
      `pillar:${id}`,
      'pillars',
      async () => {
        const result = await db
          .select()
          .from(schema.developmentPillars)
          .where(eq(schema.developmentPillars.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates development pillar.
   * @param pillar
   */
  async createPillar(pillar: InsertPillar): Promise<DevelopmentPillar> {
    const result = await dbPerformanceMonitor.trackQuery('createPillar', async () => {
      return db.insert(schema.developmentPillars).values(pillar).returning();
    });
    
    queryCache.invalidate('pillars');
    return result[0];
  }

  /**
   * Updates development pillar.
   * @param id
   * @param pillar
   */
  async updatePillar(id: string, pillar: Partial<DevelopmentPillar>): Promise<DevelopmentPillar | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updatePillar', async () => {
      return db
        .update(schema.developmentPillars)
        .set({ ...pillar, updatedAt: new Date() })
        .where(eq(schema.developmentPillars.id, id))
        .returning();
    });
    
    queryCache.invalidate('pillars');
    return result[0];
  }

  // Workspace Status operations
  
  /**
   * Gets all workspace statuses.
   */
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return this.withOptimizations(
      'getWorkspaceStatuses',
      'all_workspace_statuses',
      'workspace_status',
      () => db.select().from(schema.workspaceStatus)
    );
  }

  /**
   * Gets workspace status by component.
   * @param component
   */
  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    return this.withOptimizations(
      'getWorkspaceStatus',
      `workspace_status:${component}`,
      'workspace_status',
      async () => {
        const result = await db
          .select()
          .from(schema.workspaceStatus)
          .where(eq(schema.workspaceStatus.component, component));
        return result[0];
      }
    );
  }

  /**
   * Creates workspace status.
   * @param status
   */
  async createWorkspaceStatus(status: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const result = await dbPerformanceMonitor.trackQuery('createWorkspaceStatus', async () => {
      return db.insert(schema.workspaceStatus).values(status).returning();
    });
    
    queryCache.invalidate('workspace_status');
    return result[0];
  }

  /**
   * Updates workspace status.
   * @param component
   * @param status
   */
  async updateWorkspaceStatus(component: string, status: string): Promise<WorkspaceStatus | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateWorkspaceStatus', async () => {
      return db
        .update(schema.workspaceStatus)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.workspaceStatus.component, component))
        .returning();
    });
    
    queryCache.invalidate('workspace_status');
    return result[0];
  }

  // Quality Metrics operations
  
  /**
   * Gets all quality metrics.
   */
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return this.withOptimizations(
      'getQualityMetrics',
      'all_quality_metrics',
      'quality_metrics',
      () => db.select().from(schema.qualityMetrics)
    );
  }

  /**
   * Creates quality metric.
   * @param metric
   */
  async createQualityMetric(metric: InsertQualityMetric): Promise<QualityMetric> {
    const result = await dbPerformanceMonitor.trackQuery('createQualityMetric', async () => {
      return db.insert(schema.qualityMetrics).values(metric).returning();
    });
    
    queryCache.invalidate('quality_metrics');
    return result[0];
  }

  // Framework Configuration operations
  
  /**
   * Gets all framework configurations.
   */
  async getFrameworkConfigs(): Promise<FrameworkConfiguration[]> {
    return this.withOptimizations(
      'getFrameworkConfigs',
      'all_framework_configs',
      'framework_configs',
      () => db.select().from(schema.frameworkConfiguration)
    );
  }

  /**
   * Gets framework config by key.
   * @param key
   */
  async getFrameworkConfig(key: string): Promise<FrameworkConfiguration | undefined> {
    return this.withOptimizations(
      'getFrameworkConfig',
      `framework_config:${key}`,
      'framework_configs',
      async () => {
        const result = await db
          .select()
          .from(schema.frameworkConfiguration)
          .where(eq(schema.frameworkConfiguration.key, key));
        return result[0];
      }
    );
  }

  /**
   * Sets framework configuration.
   * @param config
   */
  async setFrameworkConfig(config: InsertFrameworkConfig): Promise<FrameworkConfiguration> {
    const result = await dbPerformanceMonitor.trackQuery('setFrameworkConfig', async () => {
      return db
        .insert(schema.frameworkConfiguration)
        .values(config)
        .onConflictDoUpdate({
          target: schema.frameworkConfiguration.key,
          set: { value: config.value, updatedAt: new Date() }
        })
        .returning();
    });
    
    queryCache.invalidate('framework_configs');
    return result[0];
  }

  // Improvement Suggestions operations
  
  /**
   * Gets all improvement suggestions.
   */
  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return this.withOptimizations(
      'getImprovementSuggestions',
      'all_improvement_suggestions',
      'improvement_suggestions',
      () => db.select().from(schema.improvementSuggestions)
    );
  }

  /**
   * Gets top improvement suggestions.
   * @param limit
   */
  async getTopImprovementSuggestions(limit: number): Promise<ImprovementSuggestion[]> {
    return this.withOptimizations(
      'getTopImprovementSuggestions',
      `top_suggestions:${limit}`,
      'improvement_suggestions',
      () => db
        .select()
        .from(schema.improvementSuggestions)
        .orderBy(desc(schema.improvementSuggestions.priority), desc(schema.improvementSuggestions.createdAt))
        .limit(limit)
    );
  }

  /**
   * Creates improvement suggestion.
   * @param suggestion
   */
  async createImprovementSuggestion(suggestion: InsertImprovementSuggestion): Promise<ImprovementSuggestion> {
    const result = await dbPerformanceMonitor.trackQuery('createImprovementSuggestion', async () => {
      return db.insert(schema.improvementSuggestions).values(suggestion).returning();
    });
    
    queryCache.invalidate('improvement_suggestions');
    return result[0];
  }

  /**
   * Clears new suggestions.
   */
  async clearNewSuggestions(): Promise<void> {
    await dbPerformanceMonitor.trackQuery('clearNewSuggestions', async () => {
      return db
        .update(schema.improvementSuggestions)
        .set({ status: 'Acknowledged', updatedAt: new Date() })
        .where(eq(schema.improvementSuggestions.status, 'New'));
    });
    
    queryCache.invalidate('improvement_suggestions');
  }

  /**
   * Updates suggestion status.
   * @param id
   * @param status
   */
  async updateSuggestionStatus(id: string, status: 'New' | 'Acknowledged' | 'Done'): Promise<ImprovementSuggestion | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateSuggestionStatus', async () => {
      return db
        .update(schema.improvementSuggestions)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.improvementSuggestions.id, id))
        .returning();
    });
    
    queryCache.invalidate('improvement_suggestions');
    return result[0];
  }

  // Features operations
  
  /**
   * Gets all features.
   */
  async getFeatures(): Promise<Feature[]> {
    return this.withOptimizations(
      'getFeatures',
      'all_features',
      'features',
      () => db.select().from(schema.features)
    );
  }

  /**
   * Gets features by status.
   * @param status
   */
  async getFeaturesByStatus(status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'): Promise<Feature[]> {
    return this.withOptimizations(
      'getFeaturesByStatus',
      `features_status:${status}`,
      'features',
      () => db
        .select()
        .from(schema.features)
        .where(eq(schema.features.status, status))
    );
  }

  /**
   * Gets features by category.
   * @param category
   */
  async getFeaturesByCategory(category: string): Promise<Feature[]> {
    return this.withOptimizations(
      'getFeaturesByCategory',
      `features_category:${category}`,
      'features',
      () => db
        .select()
        .from(schema.features)
        .where(eq(schema.features.category, category))
    );
  }

  /**
   * Gets public roadmap features.
   */
  async getPublicRoadmapFeatures(): Promise<Feature[]> {
    return this.withOptimizations(
      'getPublicRoadmapFeatures',
      'public_roadmap_features',
      'features',
      () => db
        .select()
        .from(schema.features)
        .where(eq(schema.features.isPublicRoadmap, true))
    );
  }

  /**
   * Creates feature.
   * @param feature
   */
  async createFeature(feature: InsertFeature): Promise<Feature> {
    const result = await dbPerformanceMonitor.trackQuery('createFeature', async () => {
      return db.insert(schema.features).values(feature).returning();
    });
    
    queryCache.invalidate('features');
    return result[0];
  }

  /**
   * Updates feature.
   * @param id
   * @param updates
   */
  async updateFeature(id: string, updates: Partial<InsertFeature>): Promise<Feature | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateFeature', async () => {
      return db
        .update(schema.features)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.features.id, id))
        .returning();
    });
    
    queryCache.invalidate('features');
    return result[0];
  }

  /**
   * Deletes feature.
   * @param id
   */
  async deleteFeature(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteFeature', async () => {
      return db
        .delete(schema.features)
        .where(eq(schema.features.id, id))
        .returning();
    });
    
    queryCache.invalidate('features');
    return result.length > 0;
  }

  // Actionable Items operations
  
  /**
   * Gets actionable items by feature.
   * @param featureId
   */
  async getActionableItemsByFeature(featureId: string): Promise<ActionableItem[]> {
    return this.withOptimizations(
      'getActionableItemsByFeature',
      `actionable_items:${featureId}`,
      'actionable_items',
      () => db
        .select()
        .from(schema.actionableItems)
        .where(eq(schema.actionableItems.featureId, featureId))
    );
  }

  /**
   * Gets actionable item by ID.
   * @param id
   */
  async getActionableItem(id: string): Promise<ActionableItem | undefined> {
    return this.withOptimizations(
      'getActionableItem',
      `actionable_item:${id}`,
      'actionable_items',
      async () => {
        const result = await db
          .select()
          .from(schema.actionableItems)
          .where(eq(schema.actionableItems.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates actionable item.
   * @param item
   */
  async createActionableItem(item: InsertActionableItem): Promise<ActionableItem> {
    const result = await dbPerformanceMonitor.trackQuery('createActionableItem', async () => {
      return db.insert(schema.actionableItems).values(item).returning();
    });
    
    queryCache.invalidate('actionable_items');
    return result[0];
  }

  /**
   * Creates multiple actionable items.
   * @param items
   */
  async createActionableItems(items: InsertActionableItem[]): Promise<ActionableItem[]> {
    const result = await dbPerformanceMonitor.trackQuery('createActionableItems', async () => {
      return db.insert(schema.actionableItems).values(items).returning();
    });
    
    queryCache.invalidate('actionable_items');
    return result;
  }

  /**
   * Updates actionable item.
   * @param id
   * @param updates
   */
  async updateActionableItem(id: string, updates: Partial<ActionableItem>): Promise<ActionableItem | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateActionableItem', async () => {
      return db
        .update(schema.actionableItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.actionableItems.id, id))
        .returning();
    });
    
    queryCache.invalidate('actionable_items');
    return result[0];
  }

  /**
   * Deletes actionable item.
   * @param id
   */
  async deleteActionableItem(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteActionableItem', async () => {
      return db
        .delete(schema.actionableItems)
        .where(eq(schema.actionableItems.id, id))
        .returning();
    });
    
    queryCache.invalidate('actionable_items');
    return result.length > 0;
  }

  /**
   * Deletes actionable items by feature.
   * @param featureId
   */
  async deleteActionableItemsByFeature(featureId: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteActionableItemsByFeature', async () => {
      return db
        .delete(schema.actionableItems)
        .where(eq(schema.actionableItems.featureId, featureId))
        .returning();
    });
    
    queryCache.invalidate('actionable_items');
    return result.length > 0;
  }

  // Invitation operations
  
  /**
   * Gets all invitations.
   */
  async getInvitations(): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitations',
      'all_invitations',
      'invitations',
      () => db.select().from(schema.invitations)
    );
  }

  /**
   * Gets invitation by ID.
   * @param id
   */
  async getInvitation(id: string): Promise<Invitation | undefined> {
    return this.withOptimizations(
      'getInvitation',
      `invitation:${id}`,
      'invitations',
      async () => {
        const result = await db
          .select()
          .from(schema.invitations)
          .where(eq(schema.invitations.id, id));
        return result[0];
      }
    );
  }

  /**
   * Gets invitation by token.
   * @param token
   */
  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return this.withOptimizations(
      'getInvitationByToken',
      `invitation_token:${token}`,
      'invitations',
      async () => {
        const result = await db
          .select()
          .from(schema.invitations)
          .where(eq(schema.invitations.token, token));
        return result[0];
      }
    );
  }

  /**
   * Gets invitations by email.
   * @param email
   */
  async getInvitationsByEmail(email: string): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitationsByEmail',
      `invitations_email:${email}`,
      'invitations',
      () => db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.email, email))
    );
  }

  /**
   * Gets invitations by inviter.
   * @param userId
   */
  async getInvitationsByInviter(userId: string): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitationsByInviter',
      `invitations_inviter:${userId}`,
      'invitations',
      () => db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.invitedBy, userId))
    );
  }

  /**
   * Gets invitations by status.
   * @param status
   */
  async getInvitationsByStatus(status: 'pending' | 'accepted' | 'expired' | 'cancelled'): Promise<Invitation[]> {
    return this.withOptimizations(
      'getInvitationsByStatus',
      `invitations_status:${status}`,
      'invitations',
      () => db
        .select()
        .from(schema.invitations)
        .where(eq(schema.invitations.status, status))
    );
  }

  /**
   * Creates invitation.
   * @param invitation
   */
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const result = await dbPerformanceMonitor.trackQuery('createInvitation', async () => {
      return db.insert(schema.invitations).values(invitation).returning();
    });
    
    queryCache.invalidate('invitations');
    return result[0];
  }

  /**
   * Updates invitation.
   * @param id
   * @param updates
   */
  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('updateInvitation', async () => {
      return db
        .update(schema.invitations)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.invitations.id, id))
        .returning();
    });
    
    queryCache.invalidate('invitations');
    return result[0];
  }

  /**
   * Accepts invitation.
   * @param token
   * @param userData
   * @param ipAddress
   * @param userAgent
   */
  async acceptInvitation(
    token: string,
    userData: { firstName: string; lastName: string; password: string },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; invitation: Invitation } | null> {
    return dbPerformanceMonitor.trackQuery('acceptInvitation', async () => {
      const invitation = await this.getInvitationByToken(token);
      if (!invitation || invitation.status !== 'pending') {
        return null;
      }

      // Create user
      const user = await this.createUser({
        email: invitation.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        passwordHash: userData.password, // This should be hashed
        role: invitation.role,
        organizationId: invitation.organizationId,
        isActive: true,
      });

      // Update invitation
      const updatedInvitation = await this.updateInvitation(invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedIpAddress: ipAddress || null,
        acceptedUserAgent: userAgent || null,
      });

      return { user, invitation: updatedInvitation! };
    });
  }

  /**
   * Cancels invitation.
   * @param id
   * @param cancelledBy
   */
  async cancelInvitation(id: string, cancelledBy: string): Promise<Invitation | undefined> {
    const result = await dbPerformanceMonitor.trackQuery('cancelInvitation', async () => {
      return db
        .update(schema.invitations)
        .set({ 
          status: 'cancelled', 
          cancelledBy,
          cancelledAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(schema.invitations.id, id))
        .returning();
    });
    
    queryCache.invalidate('invitations');
    return result[0];
  }

  /**
   * Expires old invitations.
   */
  async expireInvitations(): Promise<number> {
    const result = await dbPerformanceMonitor.trackQuery('expireInvitations', async () => {
      return db
        .update(schema.invitations)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(
          and(
            eq(schema.invitations.status, 'pending'),
            lte(schema.invitations.expiresAt, new Date())
          )
        )
        .returning();
    });
    
    queryCache.invalidate('invitations');
    return result.length;
  }

  /**
   * Deletes invitation.
   * @param id
   */
  async deleteInvitation(id: string): Promise<boolean> {
    const result = await dbPerformanceMonitor.trackQuery('deleteInvitation', async () => {
      return db
        .delete(schema.invitations)
        .where(eq(schema.invitations.id, id))
        .returning();
    });
    
    queryCache.invalidate('invitations');
    return result.length > 0;
  }

  // Invitation Audit Log operations
  
  /**
   * Gets invitation audit logs.
   * @param invitationId
   */
  async getInvitationAuditLogs(invitationId: string): Promise<InvitationAuditLog[]> {
    return this.withOptimizations(
      'getInvitationAuditLogs',
      `invitation_logs:${invitationId}`,
      'invitation_logs',
      () => db
        .select()
        .from(schema.invitationAuditLog)
        .where(eq(schema.invitationAuditLog.invitationId, invitationId))
        .orderBy(desc(schema.invitationAuditLog.createdAt))
    );
  }

  /**
   * Creates invitation audit log.
   * @param logEntry
   */
  async createInvitationAuditLog(logEntry: InsertInvitationAuditLog): Promise<InvitationAuditLog> {
    const result = await dbPerformanceMonitor.trackQuery('createInvitationAuditLog', async () => {
      return db.insert(schema.invitationAuditLog).values(logEntry).returning();
    });
    
    queryCache.invalidate('invitation_logs');
    return result[0];
  }
}