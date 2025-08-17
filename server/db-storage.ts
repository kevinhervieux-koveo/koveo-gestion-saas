import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, or, gte, lte, count } from 'drizzle-orm';
import { QueryOptimizer } from './database-optimization';
import { queryCache, cached, CacheInvalidator } from './query-cache';
import { trackPerformance } from './performance-monitoring';
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
} from '@shared/schema';
import type { IStorage } from './storage';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// Initialize database optimizations on startup (skip in test environment)
if (process.env.NODE_ENV !== 'test' && !process.env.DISABLE_DB_OPTIMIZATIONS) {
  QueryOptimizer.applyCoreOptimizations().catch(console.error);
}

/**
 *
 */
export class DatabaseStorage implements IStorage {
  // User operations
  /**
   * Retrieves all users from the database with caching and performance tracking.
   * @returns Promise that resolves to an array of users.
   */
  @trackPerformance('getUsers')
  @cached('users', () => 'all_users')
  async getUsers(): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.isActive, true));
  }

  /**
   * Retrieves a specific user by ID with caching and performance tracking.
   * @param id - The unique identifier of the user.
   * @returns Promise that resolves to the user or undefined if not found.
   */
  @trackPerformance('getUser')
  @cached('users', (id: string) => `user:${id}`)
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  /**
   * Retrieves a user by email with caching and performance tracking.
   * @param email - The email address to search for.
   * @returns Promise that resolves to the user or undefined if not found.
   */
  @trackPerformance('getUserByEmail')
  @cached('users', (email: string) => `user_email:${email}`)
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return result[0];
  }

  /**
   * Creates a new user with cache invalidation and performance tracking.
   * @param insertUser - The user data to insert.
   * @returns Promise that resolves to the created user.
   */
  @trackPerformance('createUser')
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(insertUser).returning();
    
    // Invalidate related caches
    CacheInvalidator.invalidateUserCaches('*');
    
    return result[0];
  }

  /**
   * Updates a user with cache invalidation and performance tracking.
   * @param id - The user ID to update.
   * @param updates - The fields to update.
   * @returns Promise that resolves to the updated user.
   */
  @trackPerformance('updateUser')
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    
    // Invalidate specific user caches
    CacheInvalidator.invalidateUserCaches(id);
    
    return result[0];
  }

  // Organization operations
  /**
   * Retrieves all organizations with caching and performance tracking.
   * @returns Promise that resolves to an array of organizations.
   */
  @trackPerformance('getOrganizations')
  @cached('organizations', () => 'all_organizations')
  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(schema.organizations).where(eq(schema.organizations.isActive, true));
  }

  /**
   * Retrieves an organization by ID with caching and performance tracking.
   * @param id - The organization ID.
   * @returns Promise that resolves to the organization or undefined.
   */
  @trackPerformance('getOrganization')
  @cached('organizations', (id: string) => `organization:${id}`)
  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, id));
    return result[0];
  }

  /**
   *
   * @param name
   */
  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const result = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.name, name));
    return result[0];
  }

  /**
   *
   * @param insertOrganization
   */
  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const result = await db.insert(schema.organizations).values(insertOrganization).returning();
    return result[0];
  }

  /**
   *
   * @param id
   * @param updates
   */
  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | undefined> {
    const result = await db
      .update(schema.organizations)
      .set(updates)
      .where(eq(schema.organizations.id, id))
      .returning();
    return result[0];
  }

  /**
   *
   * @param organizationId
   */
  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    return await db
      .select()
      .from(schema.buildings)
      .where(eq(schema.buildings.organizationId, organizationId));
  }

  // Building operations
  /**
   *
   */
  async getBuildings(): Promise<Building[]> {
    return await db.select().from(schema.buildings);
  }

  /**
   *
   * @param id
   */
  async getBuilding(id: string): Promise<Building | undefined> {
    const result = await db.select().from(schema.buildings).where(eq(schema.buildings.id, id));
    return result[0];
  }

  /**
   *
   * @param insertBuilding
   */
  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const result = await db.insert(schema.buildings).values(insertBuilding).returning();
    return result[0];
  }

  /**
   *
   * @param id
   * @param updates
   */
  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    const result = await db
      .update(schema.buildings)
      .set(updates)
      .where(eq(schema.buildings.id, id))
      .returning();
    return result[0];
  }

  /**
   *
   * @param id
   */
  async deleteBuilding(id: string): Promise<boolean> {
    const result = await db
      .update(schema.buildings)
      .set({ isActive: false })
      .where(eq(schema.buildings.id, id))
      .returning();
    return result.length > 0;
  }

  // Residence operations
  /**
   *
   */
  async getResidences(): Promise<Residence[]> {
    return await db.select().from(schema.residences);
  }

  /**
   *
   * @param id
   */
  async getResidence(id: string): Promise<Residence | undefined> {
    const result = await db.select().from(schema.residences).where(eq(schema.residences.id, id));
    return result[0];
  }

  /**
   *
   * @param buildingId
   */
  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return await db
      .select()
      .from(schema.residences)
      .where(eq(schema.residences.buildingId, buildingId));
  }

  /**
   *
   * @param insertResidence
   */
  async createResidence(insertResidence: InsertResidence): Promise<Residence> {
    const result = await db.insert(schema.residences).values(insertResidence).returning();
    return result[0];
  }

  /**
   *
   * @param id
   * @param updates
   */
  async updateResidence(id: string, updates: Partial<Residence>): Promise<Residence | undefined> {
    const result = await db
      .update(schema.residences)
      .set(updates)
      .where(eq(schema.residences.id, id))
      .returning();
    return result[0];
  }

  /**
   *
   * @param id
   */
  async deleteResidence(id: string): Promise<boolean> {
    const result = await db
      .update(schema.residences)
      .set({ isActive: false })
      .where(eq(schema.residences.id, id))
      .returning();
    return result.length > 0;
  }

  // Development Pillar operations
  /**
   *
   */
  async getPillars(): Promise<DevelopmentPillar[]> {
    return await db.select().from(schema.developmentPillars);
  }

  /**
   *
   * @param id
   */
  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    const result = await db
      .select()
      .from(schema.developmentPillars)
      .where(eq(schema.developmentPillars.id, id));
    return result[0];
  }

  /**
   *
   * @param insertPillar
   */
  async createPillar(insertPillar: InsertPillar): Promise<DevelopmentPillar> {
    const result = await db.insert(schema.developmentPillars).values(insertPillar).returning();
    return result[0];
  }

  /**
   *
   * @param id
   * @param updates
   */
  async updatePillar(
    id: string,
    updates: Partial<DevelopmentPillar>
  ): Promise<DevelopmentPillar | undefined> {
    const result = await db
      .update(schema.developmentPillars)
      .set(updates)
      .where(eq(schema.developmentPillars.id, id))
      .returning();
    return result[0];
  }

  // Workspace Status operations
  /**
   *
   */
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return await db.select().from(schema.workspaceStatus);
  }

  /**
   *
   * @param component
   */
  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    const result = await db
      .select()
      .from(schema.workspaceStatus)
      .where(eq(schema.workspaceStatus.component, component));
    return result[0];
  }

  /**
   *
   * @param insertStatus
   */
  async createWorkspaceStatus(insertStatus: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const result = await db.insert(schema.workspaceStatus).values(insertStatus).returning();
    return result[0];
  }

  /**
   *
   * @param component
   * @param statusValue
   */
  async updateWorkspaceStatus(
    component: string,
    statusValue: string
  ): Promise<WorkspaceStatus | undefined> {
    const result = await db
      .update(schema.workspaceStatus)
      .set({ status: statusValue, lastUpdated: new Date() })
      .where(eq(schema.workspaceStatus.component, component))
      .returning();
    return result[0];
  }

  // Quality Metrics operations
  /**
   *
   */
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return await db.select().from(schema.qualityMetrics);
  }

  /**
   *
   * @param insertMetric
   */
  async createQualityMetric(insertMetric: InsertQualityMetric): Promise<QualityMetric> {
    const result = await db.insert(schema.qualityMetrics).values(insertMetric).returning();
    return result[0];
  }

  // Framework Configuration operations
  /**
   *
   */
  async getFrameworkConfigs(): Promise<FrameworkConfiguration[]> {
    return await db.select().from(schema.frameworkConfiguration);
  }

  /**
   *
   * @param key
   */
  async getFrameworkConfig(key: string): Promise<FrameworkConfiguration | undefined> {
    const result = await db
      .select()
      .from(schema.frameworkConfiguration)
      .where(eq(schema.frameworkConfiguration.key, key));
    return result[0];
  }

  /**
   *
   * @param insertConfig
   */
  async setFrameworkConfig(insertConfig: InsertFrameworkConfig): Promise<FrameworkConfiguration> {
    const result = await db.insert(schema.frameworkConfiguration).values(insertConfig).returning();
    return result[0];
  }

  // Improvement Suggestions operations
  /**
   *
   */
  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return await db.select().from(schema.improvementSuggestions);
  }

  /**
   *
   * @param limit
   */
  async getTopImprovementSuggestions(limit: number): Promise<ImprovementSuggestion[]> {
    const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };

    const suggestions = await db
      .select()
      .from(schema.improvementSuggestions)
      .orderBy(desc(schema.improvementSuggestions.createdAt));

    // Sort by priority in JavaScript since complex SQL sorting might not be supported
    return suggestions
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
      })
      .slice(0, limit);
  }

  /**
   *
   * @param insertSuggestion
   */
  async createImprovementSuggestion(
    insertSuggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion> {
    const result = await db
      .insert(schema.improvementSuggestions)
      .values(insertSuggestion)
      .returning();
    return result[0];
  }

  /**
   *
   */
  async clearNewSuggestions(): Promise<void> {
    await db
      .delete(schema.improvementSuggestions)
      .where(eq(schema.improvementSuggestions.status, 'New'));
  }

  /**
   *
   * @param id
   * @param status
   */
  async updateSuggestionStatus(
    id: string,
    status: 'New' | 'Acknowledged' | 'Done'
  ): Promise<ImprovementSuggestion | undefined> {
    const result = await db
      .update(schema.improvementSuggestions)
      .set({ status })
      .where(eq(schema.improvementSuggestions.id, id))
      .returning();
    return result[0];
  }

  // Feature operations
  /**
   *
   */
  async getFeatures(): Promise<Feature[]> {
    return await db.select().from(schema.features);
  }

  /**
   *
   * @param status
   */
  async getFeaturesByStatus(
    status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'
  ): Promise<Feature[]> {
    return await db.select().from(schema.features).where(eq(schema.features.status, status));
  }

  /**
   *
   * @param category
   */
  async getFeaturesByCategory(category: string): Promise<Feature[]> {
    const features = await db.select().from(schema.features);
    return features.filter((feature) => feature.category === category);
  }

  /**
   *
   */
  async getPublicRoadmapFeatures(): Promise<Feature[]> {
    return await db.select().from(schema.features).where(eq(schema.features.isPublicRoadmap, true));
  }

  /**
   *
   * @param insertFeature
   */
  async createFeature(insertFeature: InsertFeature): Promise<Feature> {
    const result = await db.insert(schema.features).values(insertFeature).returning();
    return result[0];
  }

  /**
   *
   * @param id
   * @param updates
   */
  async updateFeature(id: string, updates: Partial<InsertFeature>): Promise<Feature | undefined> {
    const result = await db
      .update(schema.features)
      .set(updates)
      .where(eq(schema.features.id, id))
      .returning();
    return result[0];
  }

  /**
   *
   * @param id
   */
  async deleteFeature(id: string): Promise<boolean> {
    const result = await db.delete(schema.features).where(eq(schema.features.id, id)).returning();
    return result.length > 0;
  }
}
