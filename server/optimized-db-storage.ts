/**
 * Optimized database storage with caching and performance monitoring.
 * Replaces decorators with direct implementation for better compatibility.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, or, gte, lte, count } from 'drizzle-orm';
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
}