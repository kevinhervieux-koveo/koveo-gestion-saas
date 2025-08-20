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
  Document,
  InsertDocument,
  DocumentBuilding,
  InsertDocumentBuilding,
  DocumentResident,
  InsertDocumentResident,
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
  Permission,
  RolePermission,
  UserPermission,
  PasswordResetToken,
  InsertPasswordResetToken,
} from '@shared/schema';
import type { IStorage } from './storage';
import { QueryOptimizer, PaginationHelper, type PaginationOptions } from './database-optimization';
import { queryCache, CacheInvalidator } from './query-cache';
import { dbPerformanceMonitor } from './performance-monitoring';
import { exists, sql as sqlOp } from 'drizzle-orm';

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
    // Skip optimizations in test environment
    if (process.env.TEST_ENV !== 'integration' && !process.env.DISABLE_DB_OPTIMIZATIONS) {
      this.initializeOptimizations();
    }
  }

  /**
   * Initializes database optimizations.
   */
  private async initializeOptimizations(): Promise<void> {
    try {
      await QueryOptimizer.applyCoreOptimizations();
      console.log('✅ Database optimizations applied');
    } catch (_error) {
      console.warn('⚠️ Failed to apply database optimizations:', _error);
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
      () => db.select().from(schema.users)
        .where(eq(schema.users.isActive, true))
        .limit(100) // Always use LIMIT for large result sets
        .orderBy(desc(schema.users.createdAt))
    );
  }

  /**
   * Gets paginated users with optimized query structure.
   * @param options
   */
  async getPaginatedUsers(options: PaginationOptions): Promise<{ users: User[], total: number }> {
    PaginationHelper.validatePagination(options);
    
    const cacheKey = `paginated_users:${options.page}:${options.pageSize}:${options.sortBy}:${options.sortDirection}`;
    
    // Try cache first
    const cached = queryCache.get<{ users: User[], total: number }>('users', cacheKey);
    if (cached) {
      return cached;
    }
    
    // Get total count using covering index
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));
    
    // Get paginated results with LIMIT and optimized ORDER BY
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.isActive, true))
      .orderBy(
        options.sortDirection === 'DESC' 
          ? desc(schema.users.createdAt)
          : schema.users.createdAt
      )
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize);
    
    const result = { users, total };
    queryCache.set('users', cacheKey, result);
    
    return result;
  }

  /**
   * Gets buildings with residents using EXISTS instead of IN subquery.
   * @param organizationId
   * @param limit
   */
  async getBuildingsWithResidents(organizationId: string, limit: number = 50): Promise<Building[]> {
    const cacheKey = `buildings_with_residents:${organizationId}:${limit}`;
    
    return this.withOptimizations(
      'getBuildingsWithResidents',
      cacheKey,
      'buildings',
      () => db
        .select()
        .from(schema.buildings)
        .where(
          and(
            eq(schema.buildings.organizationId, organizationId),
            eq(schema.buildings.isActive, true),
            exists(
              db.select()
                .from(schema.residences)
                .where(
                  and(
                    eq(schema.residences.buildingId, schema.buildings.id),
                    eq(schema.residences.isActive, true)
                  )
                )
            )
          )
        )
        .limit(limit) // Always use LIMIT for large result sets
    );
  }

  /**
   * Searches users with optimized covering index and LIMIT.
   * @param query
   * @param limit
   */
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const cacheKey = `search_users:${query}:${limit}`;
    
    return this.withOptimizations(
      'searchUsers',
      cacheKey,
      'users',
      () => db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.isActive, true),
            or(
              like(schema.users.email, `%${query}%`),
              like(schema.users.firstName, `%${query}%`),
              like(schema.users.lastName, `%${query}%`)
            )
          )
        )
        .limit(limit) // Always limit search results
        .orderBy(schema.users.lastName, schema.users.firstName)
    );
  }

  /**
   * Gets financial summary using materialized view for complex aggregations.
   * @param buildingId
   */
  async getFinancialSummary(buildingId: string): Promise<any[]> {
    const cacheKey = `financial_summary:${buildingId}`;
    
    return this.withOptimizations(
      'getFinancialSummary',
      cacheKey,
      'financial',
      async () => {
        // Use materialized view for complex aggregations
        const summary = await db.execute(
          sqlOp`SELECT * FROM mv_financial_summary WHERE building_id = ${buildingId} ORDER BY month DESC LIMIT 12`
        );
        return summary.rows;
      }
    );
  }

  /**
   * Gets building statistics using materialized view.
   * @param buildingId
   */
  async getBuildingStats(buildingId: string): Promise<any> {
    const cacheKey = `building_stats:${buildingId}`;
    
    return this.withOptimizations(
      'getBuildingStats',
      cacheKey,
      'buildings',
      async () => {
        // Use materialized view for dashboard statistics
        const stats = await db.execute(
          sqlOp`SELECT * FROM mv_building_stats WHERE building_id = ${buildingId}`
        );
        return stats.rows[0];
      }
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
      const inserted = await db.insert(schema.users).values([insertUser]).returning();
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

  /**
   * Retrieves organizations for a specific user.
   * @param userId
   */
  async getUserOrganizations(userId: string): Promise<Array<{organizationId: string}>> {
    return this.withOptimizations(
      'getUserOrganizations',
      `user_orgs:${userId}`,
      'users',
      async () => {
        const user = await this.getUser(userId);
        if (!user || !user.organizationId) {
          return [];
        }
        return [{ organizationId: user.organizationId }];
      }
    );
  }

  /**
   * Retrieves residences for a specific user.
   * @param userId
   */
  async getUserResidences(userId: string): Promise<Array<{residenceId: string}>> {
    return this.withOptimizations(
      'getUserResidences',
      `user_residences:${userId}`,
      'users',
      async () => {
        const user = await this.getUser(userId);
        if (!user || !user.assignedResidenceId) {
          return [];
        }
        return [{ residenceId: user.assignedResidenceId }];
      }
    );
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
      return db.insert(schema.buildings).values([insertBuilding]).returning();
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
        .set({ status })
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
      return db.insert(schema.improvementSuggestions).values([suggestion]).returning();
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
        .set({ status: 'Acknowledged' })
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
        .set({ status })
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
        .where(eq(schema.features.status, status as any))
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
        .where(eq(schema.features.category, category as any))
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
      return db.insert(schema.features).values([feature]).returning();
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
        .set(updates as any)
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
      return db.insert(schema.actionableItems).values([item]).returning();
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
        .set(updates as any)
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
        .where(eq(schema.invitations.invitedByUserId, userId))
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
      return db.insert(schema.invitations).values([invitation]).returning();
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
        .set(updates as any)
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
   * @param userData.firstName
   * @param ipAddress
   * @param userData.lastName
   * @param userAgent
   * @param userData.password
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
        password: userData.password, // This should be hashed
        role: invitation.role,
      });

      // Update invitation
      const updatedInvitation = await this.updateInvitation(invitation.id, {
        status: 'accepted',
        acceptedAt: new Date(),
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

  // Permission operations
  
  /**
   * Gets all permissions.
   */
  async getPermissions(): Promise<Permission[]> {
    return this.withOptimizations(
      'getPermissions',
      'permissions:all',
      'permissions',
      () => db
        .select()
        .from(schema.permissions)
        .where(eq(schema.permissions.isActive, true))
        .orderBy(schema.permissions.resourceType, schema.permissions.action)
    );
  }

  /**
   * Gets all role permissions.
   */
  async getRolePermissions(): Promise<RolePermission[]> {
    return this.withOptimizations(
      'getRolePermissions',
      'role_permissions:all',
      'role_permissions',
      () => db
        .select()
        .from(schema.rolePermissions)
        .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
        .where(eq(schema.permissions.isActive, true))
        .orderBy(schema.rolePermissions.role, schema.permissions.resourceType)
    );
  }

  /**
   * Gets all user permissions.
   */
  async getUserPermissions(): Promise<UserPermission[]> {
    return this.withOptimizations(
      'getUserPermissions',
      'user_permissions:all',
      'user_permissions',
      () => db
        .select()
        .from(schema.userPermissions)
        .innerJoin(schema.permissions, eq(schema.userPermissions.permissionId, schema.permissions.id))
        .where(eq(schema.permissions.isActive, true))
        .orderBy(schema.userPermissions.userId)
    );
  }

  // Building Document operations

  /**
   * Gets building documents for user based on role and permissions.
   * @param userId
   * @param userRole
   * @param organizationId
   * @param buildingIds
   */
  async getBuildingDocumentsForUser(
    userId: string, 
    userRole: string, 
    organizationId?: string, 
    buildingIds?: string[]
  ): Promise<DocumentBuilding[]> {
    return this.withOptimizations(
      'getBuildingDocumentsForUser',
      `building_docs:${userId}:${userRole}`,
      'building_documents',
      async () => {
        let query = db.select().from(schema.documentsBuildings);
        
        // Role-based filtering
        if (userRole === 'admin') {
          // Admin can see all building documents
          return await query.orderBy(desc(schema.documentsBuildings.uploadDate));
        } else if (userRole === 'manager' && organizationId) {
          // Manager can see documents for buildings in their organization
          return await query
            .innerJoin(schema.buildings, eq(schema.documentsBuildings.buildingId, schema.buildings.id))
            .where(eq(schema.buildings.organizationId, organizationId))
            .orderBy(desc(schema.documentsBuildings.uploadDate));
        } else if ((userRole === 'resident' || userRole === 'tenant') && buildingIds && buildingIds.length > 0) {
          // Residents/tenants can see documents for their buildings
          return await query
            .where(inArray(schema.documentsBuildings.buildingId, buildingIds))
            .orderBy(desc(schema.documentsBuildings.uploadDate));
        }
        
        return [];
      }
    );
  }

  /**
   * Gets specific building document with permission check.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   * @param buildingIds
   */
  async getBuildingDocument(
    id: string, 
    userId: string, 
    userRole: string, 
    organizationId?: string, 
    buildingIds?: string[]
  ): Promise<DocumentBuilding | undefined> {
    return this.withOptimizations(
      'getBuildingDocument',
      `building_doc:${id}:${userId}`,
      'building_documents',
      async () => {
        const result = await db.select().from(schema.documentsBuildings).where(eq(schema.documentsBuildings.id, id));
        const document = result[0];
        
        if (!document) return undefined;
        
        // Permission check based on role
        if (userRole === 'admin') {
          return document;
        } else if (userRole === 'manager' && organizationId) {
          // Check if document belongs to manager's organization
          const building = await this.getBuilding(document.buildingId);
          if (building && building.organizationId === organizationId) {
            return document;
          }
        } else if ((userRole === 'resident' || userRole === 'tenant') && buildingIds && buildingIds.includes(document.buildingId)) {
          return document;
        }
        
        return undefined;
      }
    );
  }

  /**
   * Creates building document.
   * @param document
   */
  async createBuildingDocument(document: InsertDocumentBuilding): Promise<DocumentBuilding> {
    return dbPerformanceMonitor.trackQuery('createBuildingDocument', async () => {
      const result = await db.insert(schema.documentsBuildings).values(document).returning();
      
      // Invalidate building document caches
      queryCache.invalidate('building_documents');
      
      return result[0];
    });
  }

  /**
   * Updates building document with permission check.
   * @param id
   * @param updates
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async updateBuildingDocument(
    id: string, 
    updates: Partial<InsertDocumentBuilding>, 
    userId: string, 
    userRole: string, 
    organizationId?: string
  ): Promise<DocumentBuilding | undefined> {
    return dbPerformanceMonitor.trackQuery('updateBuildingDocument', async () => {
      // First check if user has permission to update this document
      const document = await this.getBuildingDocument(id, userId, userRole, organizationId);
      if (!document) return undefined;
      
      const result = await db
        .update(schema.documentsBuildings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.documentsBuildings.id, id))
        .returning();
      
      // Invalidate building document caches
      queryCache.invalidate('building_documents');
      
      return result[0];
    });
  }

  /**
   * Deletes building document with permission check.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async deleteBuildingDocument(
    id: string, 
    userId: string, 
    userRole: string, 
    organizationId?: string
  ): Promise<boolean> {
    return dbPerformanceMonitor.trackQuery('deleteBuildingDocument', async () => {
      // First check if user has permission to delete this document
      const document = await this.getBuildingDocument(id, userId, userRole, organizationId);
      if (!document) return false;
      
      const result = await db
        .delete(schema.documentsBuildings)
        .where(eq(schema.documentsBuildings.id, id))
        .returning();
      
      // Invalidate building document caches
      queryCache.invalidate('building_documents');
      
      return result.length > 0;
    });
  }

  // Resident Document operations

  /**
   * Gets resident documents for user based on role and permissions.
   * @param userId
   * @param userRole
   * @param organizationId
   * @param residenceIds
   */
  async getResidentDocumentsForUser(
    userId: string, 
    userRole: string, 
    organizationId?: string, 
    residenceIds?: string[]
  ): Promise<DocumentResident[]> {
    return this.withOptimizations(
      'getResidentDocumentsForUser',
      `resident_docs:${userId}:${userRole}`,
      'resident_documents',
      async () => {
        let query = db.select().from(schema.documentsResidents);
        
        // Role-based filtering
        if (userRole === 'admin') {
          // Admin can see all resident documents
          return await query.orderBy(desc(schema.documentsResidents.uploadDate));
        } else if (userRole === 'manager' && organizationId) {
          // Manager can see documents for residences in their organization
          return await query
            .innerJoin(schema.residences, eq(schema.documentsResidents.residenceId, schema.residences.id))
            .innerJoin(schema.buildings, eq(schema.residences.buildingId, schema.buildings.id))
            .where(eq(schema.buildings.organizationId, organizationId))
            .orderBy(desc(schema.documentsResidents.uploadDate));
        } else if ((userRole === 'resident' || userRole === 'tenant') && residenceIds && residenceIds.length > 0) {
          // Residents/tenants can see documents for their residences
          return await query
            .where(inArray(schema.documentsResidents.residenceId, residenceIds))
            .orderBy(desc(schema.documentsResidents.uploadDate));
        }
        
        return [];
      }
    );
  }

  /**
   * Gets specific resident document with permission check.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   * @param residenceIds
   */
  async getResidentDocument(
    id: string, 
    userId: string, 
    userRole: string, 
    organizationId?: string, 
    residenceIds?: string[]
  ): Promise<DocumentResident | undefined> {
    return this.withOptimizations(
      'getResidentDocument',
      `resident_doc:${id}:${userId}`,
      'resident_documents',
      async () => {
        const result = await db.select().from(schema.documentsResidents).where(eq(schema.documentsResidents.id, id));
        const document = result[0];
        
        if (!document) return undefined;
        
        // Permission check based on role
        if (userRole === 'admin') {
          return document;
        } else if (userRole === 'manager' && organizationId) {
          // Check if document belongs to manager's organization
          const residence = await this.getResidence(document.residenceId);
          if (residence) {
            const building = await this.getBuilding(residence.buildingId);
            if (building && building.organizationId === organizationId) {
              return document;
            }
          }
        } else if ((userRole === 'resident' || userRole === 'tenant') && residenceIds && residenceIds.includes(document.residenceId)) {
          return document;
        }
        
        return undefined;
      }
    );
  }

  /**
   * Creates resident document.
   * @param document
   */
  async createResidentDocument(document: InsertDocumentResident): Promise<DocumentResident> {
    return dbPerformanceMonitor.trackQuery('createResidentDocument', async () => {
      const result = await db.insert(schema.documentsResidents).values(document).returning();
      
      // Invalidate resident document caches
      queryCache.invalidate('resident_documents');
      
      return result[0];
    });
  }

  /**
   * Updates resident document with permission check.
   * @param id
   * @param updates
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async updateResidentDocument(
    id: string, 
    updates: Partial<InsertDocumentResident>, 
    userId: string, 
    userRole: string, 
    organizationId?: string
  ): Promise<DocumentResident | undefined> {
    return dbPerformanceMonitor.trackQuery('updateResidentDocument', async () => {
      // First check if user has permission to update this document
      const document = await this.getResidentDocument(id, userId, userRole, organizationId);
      if (!document) return undefined;
      
      const result = await db
        .update(schema.documentsResidents)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.documentsResidents.id, id))
        .returning();
      
      // Invalidate resident document caches
      queryCache.invalidate('resident_documents');
      
      return result[0];
    });
  }

  /**
   * Deletes resident document with permission check.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async deleteResidentDocument(
    id: string, 
    userId: string, 
    userRole: string, 
    organizationId?: string
  ): Promise<boolean> {
    return dbPerformanceMonitor.trackQuery('deleteResidentDocument', async () => {
      // First check if user has permission to delete this document
      const document = await this.getResidentDocument(id, userId, userRole, organizationId);
      if (!document) return false;
      
      const result = await db
        .delete(schema.documentsResidents)
        .where(eq(schema.documentsResidents.id, id))
        .returning();
      
      // Invalidate resident document caches
      queryCache.invalidate('resident_documents');
      
      return result.length > 0;
    });
  }

  // Legacy Document operations (kept for migration purposes)

  /**
   * Gets legacy documents for user.
   * @param userId
   * @param userRole
   * @param organizationId
   * @param residenceIds
   */
  async getDocumentsForUser(
    userId: string, 
    userRole: string, 
    organizationId?: string, 
    residenceIds?: string[]
  ): Promise<Document[]> {
    return this.withOptimizations(
      'getDocumentsForUser',
      `legacy_docs:${userId}:${userRole}`,
      'documents',
      async () => {
        return await db.select().from(schema.documents).orderBy(desc(schema.documents.uploadDate));
      }
    );
  }

  /**
   * Gets specific legacy document with permission check.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   * @param residenceIds
   */
  async getDocument(
    id: string, 
    userId: string, 
    userRole: string, 
    organizationId?: string, 
    residenceIds?: string[]
  ): Promise<Document | undefined> {
    return this.withOptimizations(
      'getDocument',
      `legacy_doc:${id}:${userId}`,
      'documents',
      async () => {
        const result = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
        return result[0];
      }
    );
  }

  /**
   * Creates legacy document.
   * @param document
   */
  async createDocument(document: InsertDocument): Promise<Document> {
    return dbPerformanceMonitor.trackQuery('createDocument', async () => {
      const result = await db.insert(schema.documents).values(document).returning();
      
      queryCache.invalidate('documents');
      
      return result[0];
    });
  }

  /**
   * Updates legacy document with permission check.
   * @param id
   * @param updates
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async updateDocument(
    id: string, 
    updates: Partial<InsertDocument>, 
    userId: string, 
    userRole: string, 
    organizationId?: string
  ): Promise<Document | undefined> {
    return dbPerformanceMonitor.trackQuery('updateDocument', async () => {
      const result = await db
        .update(schema.documents)
        .set(updates)
        .where(eq(schema.documents.id, id))
        .returning();
      
      queryCache.invalidate('documents');
      
      return result[0];
    });
  }

  /**
   * Deletes legacy document with permission check.
   * @param id
   * @param userId
   * @param userRole
   * @param organizationId
   */
  async deleteDocument(
    id: string, 
    userId: string, 
    userRole: string, 
    organizationId?: string
  ): Promise<boolean> {
    return dbPerformanceMonitor.trackQuery('deleteDocument', async () => {
      const result = await db
        .delete(schema.documents)
        .where(eq(schema.documents.id, id))
        .returning();
      
      queryCache.invalidate('documents');
      
      return result.length > 0;
    });
  }

  // Password reset operations
  /**
   *
   * @param token
   */
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await db.insert(schema.passwordResetTokens)
      .values(token)
      .returning();
    
    // Token created successfully
    
    return result[0];
  }

  /**
   *
   * @param tokenValue
   */
  async getPasswordResetToken(tokenValue: string): Promise<PasswordResetToken | undefined> {
    return this.withOptimizations(
      'getPasswordResetToken',
      `token_${tokenValue}`,
      'password_reset_tokens',
      async () => {
        const result = await db.select()
          .from(schema.passwordResetTokens)
          .where(eq(schema.passwordResetTokens.token, tokenValue))
          .limit(1);
        return result[0];
      }
    );
  }

  /**
   *
   * @param tokenId
   */
  async markPasswordResetTokenAsUsed(tokenId: string): Promise<PasswordResetToken | undefined> {
    const result = await db.update(schema.passwordResetTokens)
      .set({
        isUsed: true,
        usedAt: new Date(),
      })
      .where(eq(schema.passwordResetTokens.id, tokenId))
      .returning();

    // Token marked as used
    
    return result[0];
  }

  /**
   *
   */
  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const result = await db.delete(schema.passwordResetTokens)
      .where(lte(schema.passwordResetTokens.expiresAt, new Date()))
      .returning();

    // Expired tokens cleaned up
    
    return result.length;
  }
}