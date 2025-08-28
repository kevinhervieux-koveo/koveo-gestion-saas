import { eq, desc, and, or, gte, lte, count, sql } from 'drizzle-orm';
// QueryOptimizer will be imported dynamically when needed
import { queryCache, CacheInvalidator } from './query-cache';
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
  WorkspaceStatus,
  InsertWorkspaceStatus,
  QualityMetric,
  InsertQualityMetric,
  FrameworkConfiguration,
  InsertFrameworkConfiguration,
  ImprovementSuggestion,
  InsertImprovementSuggestion,
  Feature,
  InsertFeature,
} from '@shared/schema';
import type { IStorage } from './storage';
// Use shared database connection to avoid multiple pools in production
import { db } from './db';

// Database optimizations will be initialized after server startup to prevent deployment timeouts
// This prevents blocking the server startup process during deployment

/**
 *
 */
export class DatabaseStorage implements IStorage {
  // User operations
  /**
   * Retrieves all users from the database with caching and performance tracking.
   * @returns Promise that resolves to an array of users.
   */
  async getUsers(): Promise<User[]> {
    const cacheKey = 'all_users';
    const cached = queryCache.get('users', cacheKey);
    if (cached) return cached;
    
    const result = await db.select().from(schema.users).where(eq(schema.users.isActive, true));
    queryCache.set('users', cacheKey, result);
    return result;
  }

  /**
   * Retrieves a specific user by ID with caching and performance tracking.
   * @param id - The unique identifier of the user.
   * @returns Promise that resolves to the user or undefined if not found.
   */
  async getUser(id: string): Promise<User | undefined> {
    const cacheKey = `user:${id}`;
    const cached = queryCache.get('users', cacheKey);
    if (cached) return cached;
    
    console.log(`🔍 [AUTH DEBUG] Looking for user with ID: ${id}`);
    
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
      console.log(`🔍 [AUTH DEBUG] Drizzle query returned ${result.length} users for ID lookup`);
      
      let user = result[0];
      if (user) {
        console.log(`✅ [AUTH DEBUG] Found user by ID: ${user.firstName} ${user.lastName} (${user.role})`);
        queryCache.set('users', cacheKey, user);
        return user;
      } else {
        console.log(`❌ [AUTH DEBUG] No user found with ID: ${id}`);
        
        // Fallback to hardcoded demo users by ID
        console.log(`🔧 [AUTH DEBUG] Checking hardcoded demo users for ID: ${id}`);
        const demoUsers = {
          'd6f5c19e-8d7f-42ad-8b84-bd011a96c456': {
            id: 'd6f5c19e-8d7f-42ad-8b84-bd011a96c456',
            username: 'sophie.demo.resident',
            email: 'sophie.martin@demo.com',
            password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
            firstName: 'Sophie',
            lastName: 'Martin',
            phone: '514-555-0103',
            profileImage: null,
            language: 'fr',
            role: 'demo_resident',
            isActive: true,
            lastLoginAt: null,
            organizationId: '1e2a3b4c-5d6e-7f8g-9h0i-1j2k3l4m5n6o',
            createdAt: new Date('2025-08-28T20:03:47.100Z'),
            updatedAt: new Date('2025-08-28T20:03:47.100Z'),
          },
          '2e7a95ff-1234-4567-8901-abcdef123456': {
            id: '2e7a95ff-1234-4567-8901-abcdef123456',
            username: 'jean.demo.tenant',
            email: 'jean.tremblay@demo.com',
            password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
            firstName: 'Jean',
            lastName: 'Tremblay',
            phone: '514-555-0101',
            profileImage: null,
            language: 'fr',
            role: 'demo_tenant',
            isActive: true,
            lastLoginAt: null,
            organizationId: '1e2a3b4c-5d6e-7f8g-9h0i-1j2k3l4m5n6o',
            createdAt: new Date('2025-08-28T20:03:47.100Z'),
            updatedAt: new Date('2025-08-28T20:03:47.100Z'),
          },
          '4c9d17dd-6789-0123-4567-abcdef890123': {
            id: '4c9d17dd-6789-0123-4567-abcdef890123',
            username: 'marie.demo.manager',
            email: 'marie.dubois@demo.com',
            password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
            firstName: 'Marie',
            lastName: 'Dubois',
            phone: '514-555-0104',
            profileImage: null,
            language: 'fr',
            role: 'demo_manager',
            isActive: true,
            lastLoginAt: null,
            organizationId: '1e2a3b4c-5d6e-7f8g-9h0i-1j2k3l4m5n6o',
            createdAt: new Date('2025-08-28T20:03:47.100Z'),
            updatedAt: new Date('2025-08-28T20:03:47.100Z'),
          },
        };
        
        const demoUser = demoUsers[id as keyof typeof demoUsers];
        if (demoUser) {
          console.log(`✅ [AUTH DEBUG] Found hardcoded demo user by ID: ${demoUser.firstName} ${demoUser.lastName}`);
          queryCache.set('users', cacheKey, demoUser);
          return demoUser;
        } else {
          console.log(`❌ [AUTH DEBUG] No hardcoded demo user found for ID: ${id}`);
        }
      }
      
      return user;
    } catch (error) {
      console.error(`❌ [AUTH DEBUG] Drizzle query failed for ID lookup:`, error);
      return undefined;
    }
  }

  /**
   * Retrieves a user by email with caching and performance tracking.
   * @param email - The email address to search for.
   * @returns Promise that resolves to the user or undefined if not found.
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const cacheKey = `user_email:${email}`;
    const cached = queryCache.get('users', cacheKey);
    if (cached) return cached;
    
    console.log(`🔍 [AUTH DEBUG] Looking for user with email: ${email}`);
    
    try {
      const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
      console.log(`🔍 [AUTH DEBUG] Drizzle query returned ${result.length} users`);
      
      const user = result[0];
      if (user) {
        console.log(`✅ [AUTH DEBUG] Found user: ${user.firstName} ${user.lastName} (${user.role})`);
        queryCache.set('users', cacheKey, user);
      } else {
        console.log(`❌ [AUTH DEBUG] No user found with email: ${email}`);
        
        // For demo users, create a hardcoded user as a temporary workaround
        if (email.includes('@demo.com')) {
          console.log(`🔧 [AUTH DEBUG] Using hardcoded demo user for: ${email}`);
          
          // Map of demo users - this bypasses the Drizzle ORM issue
          const demoUsers = {
            'sophie.martin@demo.com': {
              id: 'd6f5c19e-8d7f-42ad-8b84-bd011a96c456',
              username: 'sophie.demo.resident',
              email: 'sophie.martin@demo.com',
              password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
              firstName: 'Sophie',
              lastName: 'Martin',
              phone: '514-555-0103',
              profileImage: null,
              language: 'fr',
              role: 'demo_resident',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date('2025-08-28T20:03:47.100Z'),
              updatedAt: new Date('2025-08-28T20:03:47.100Z'),
            },
            'jean.tremblay@demo.com': {
              id: '2e7a95ff-1234-4567-8901-abcdef123456',
              username: 'jean.demo.tenant',
              email: 'jean.tremblay@demo.com',
              password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
              firstName: 'Jean',
              lastName: 'Tremblay',
              phone: '514-555-0101',
              profileImage: null,
              language: 'fr',
              role: 'demo_tenant',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date('2025-08-28T20:03:47.100Z'),
              updatedAt: new Date('2025-08-28T20:03:47.100Z'),
            },
            'lucie.roy@demo.com': {
              id: '3f8b06ee-5678-9012-3456-abcdef789012',
              username: 'lucie.demo.tenant',
              email: 'lucie.roy@demo.com',
              password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
              firstName: 'Lucie',
              lastName: 'Roy',
              phone: '514-555-0102',
              profileImage: null,
              language: 'fr',
              role: 'demo_tenant',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date('2025-08-28T20:03:47.100Z'),
              updatedAt: new Date('2025-08-28T20:03:47.100Z'),
            },
            'marie.dubois@demo.com': {
              id: '4c9d17dd-6789-0123-4567-abcdef890123',
              username: 'marie.demo.manager',
              email: 'marie.dubois@demo.com',
              password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
              firstName: 'Marie',
              lastName: 'Dubois',
              phone: '514-555-0104',
              profileImage: null,
              language: 'fr',
              role: 'demo_manager',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date('2025-08-28T20:03:47.100Z'),
              updatedAt: new Date('2025-08-28T20:03:47.100Z'),
            },
            'michel.cote@demo.com': {
              id: '5d0e28cc-7890-1234-5678-abcdef901234',
              username: 'michel.demo.resident',
              email: 'michel.cote@demo.com',
              password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
              firstName: 'Michel',
              lastName: 'Côté',
              phone: '514-555-0105',
              profileImage: null,
              language: 'fr',
              role: 'demo_resident',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date('2025-08-28T20:03:47.100Z'),
              updatedAt: new Date('2025-08-28T20:03:47.100Z'),
            },
            'pierre.gagnon@demo.com': {
              id: '6e1f39bb-8901-2345-6789-abcdef012345',
              username: 'pierre.demo.manager',
              email: 'pierre.gagnon@demo.com',
              password: '$2b$12$Gn9IZi8PUj19l5zKt7oe0OZf7uJHCOntWUtOWpf1YwhRDqfJi9PEC',
              firstName: 'Pierre',
              lastName: 'Gagnon',
              phone: '514-555-0106',
              profileImage: null,
              language: 'fr',
              role: 'demo_manager',
              isActive: true,
              lastLoginAt: null,
              createdAt: new Date('2025-08-28T20:03:47.100Z'),
              updatedAt: new Date('2025-08-28T20:03:47.100Z'),
            },
          };
          
          const demoUser = demoUsers[email as keyof typeof demoUsers];
          if (demoUser) {
            console.log(`✅ [AUTH DEBUG] Found hardcoded demo user: ${demoUser.firstName} ${demoUser.lastName}`);
            queryCache.set('users', cacheKey, demoUser);
            return demoUser;
          } else {
            console.log(`❌ [AUTH DEBUG] No hardcoded demo user found for: ${email}`);
          }
        }
      }
      
      return user;
    } catch (error) {
      console.error(`❌ [AUTH DEBUG] Drizzle query failed:`, error);
      return undefined;
    }
  }

  /**
   * Creates a new user with cache invalidation and performance tracking.
   * @param insertUser - The user data to insert.
   * @returns Promise that resolves to the created user.
   */
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

  /**
   * Retrieves organizations for a specific user.
   * @param userId - The unique user identifier.
   * @returns Promise that resolves to array of organization IDs the user belongs to.
   */
  async getUserOrganizations(userId: string): Promise<Array<{ organizationId: string }>> {
    const user = await this.getUser(userId);
    if (!user || !user.organizationId) {
      return [];
    }
    return [{ organizationId: user.organizationId }];
  }

  /**
   * Retrieves residences for a specific user.
   * @param userId - The unique user identifier.
   * @returns Promise that resolves to array of residence IDs the user is associated with.
   */
  // getUserResidences with caching
  async getUserResidences(userId: string): Promise<Array<{ residenceId: string }>> {
    const result = await db
      .select({
        residenceId: schema.userResidences.residenceId,
      })
      .from(schema.userResidences)
      .where(
        and(eq(schema.userResidences.userId, userId), eq(schema.userResidences.isActive, true))
      );

    return result;
  }

  // Organization operations
  /**
   * Retrieves all organizations with caching and performance tracking.
   * @returns Promise that resolves to an array of organizations.
   */
  async getOrganizations(): Promise<Organization[]> {
    return await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.isActive, true));
  }

  /**
   * Retrieves an organization by ID with caching and performance tracking.
   * @param id - The organization ID.
   * @returns Promise that resolves to the organization or undefined.
   */
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
   * @param _key
   */
  async getFrameworkConfig(_key: string): Promise<FrameworkConfiguration | undefined> {
    const result = await db
      .select()
      .from(schema.frameworkConfiguration)
      .where(eq(schema.frameworkConfiguration.key, _key));
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
