import { 
  type User, 
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type Building,
  type InsertBuilding,
  type Residence,
  type InsertResidence,
  type DevelopmentPillar,
  type InsertPillar,
  type WorkspaceStatus,
  type InsertWorkspaceStatus,
  type QualityMetric,
  type InsertQualityMetric,
  type FrameworkConfiguration,
  type InsertFrameworkConfig,
  type ImprovementSuggestion,
  type InsertImprovementSuggestion,
  type Feature,
  type InsertFeature
} from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * Storage interface for the Koveo Gestion property management system.
 * Defines all storage operations for users, organizations, buildings, residences,
 * development pillars, quality metrics, and features.
 * 
 * @interface IStorage
 * @example
 * ```typescript
 * class MyStorage implements IStorage {
 *   async getUsers(): Promise<User[]> {
 *     // implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */
export interface IStorage {
  // User operations
  getUsers(): Promise<User[]>;
  getUser(_id: string): Promise<User | undefined>;
  getUserByEmail(_email: string): Promise<User | undefined>;
  createUser(_user: InsertUser): Promise<User>;
  updateUser(_id: string, _updates: Partial<User>): Promise<User | undefined>;

  // Organization operations
  getOrganizations(): Promise<Organization[]>;
  getOrganization(_id: string): Promise<Organization | undefined>;
  getOrganizationByName(_name: string): Promise<Organization | undefined>;
  createOrganization(_organization: InsertOrganization): Promise<Organization>;
  updateOrganization(_id: string, _updates: Partial<Organization>): Promise<Organization | undefined>;
  getBuildingsByOrganization(_organizationId: string): Promise<Building[]>;

  // Building operations
  getBuildings(): Promise<Building[]>;
  getBuilding(_id: string): Promise<Building | undefined>;
  createBuilding(_building: InsertBuilding): Promise<Building>;
  updateBuilding(_id: string, _updates: Partial<Building>): Promise<Building | undefined>;
  deleteBuilding(_id: string): Promise<boolean>;

  // Residence operations
  getResidences(): Promise<Residence[]>;
  getResidence(_id: string): Promise<Residence | undefined>;
  getResidencesByBuilding(_buildingId: string): Promise<Residence[]>;
  createResidence(_residence: InsertResidence): Promise<Residence>;
  updateResidence(_id: string, _updates: Partial<Residence>): Promise<Residence | undefined>;
  deleteResidence(_id: string): Promise<boolean>;

  // Development Pillar operations
  getPillars(): Promise<DevelopmentPillar[]>;
  getPillar(_id: string): Promise<DevelopmentPillar | undefined>;
  createPillar(_pillar: InsertPillar): Promise<DevelopmentPillar>;
  updatePillar(_id: string, _pillar: Partial<DevelopmentPillar>): Promise<DevelopmentPillar | undefined>;

  // Workspace Status operations
  getWorkspaceStatuses(): Promise<WorkspaceStatus[]>;
  getWorkspaceStatus(_component: string): Promise<WorkspaceStatus | undefined>;
  createWorkspaceStatus(_status: InsertWorkspaceStatus): Promise<WorkspaceStatus>;
  updateWorkspaceStatus(_component: string, _status: string): Promise<WorkspaceStatus | undefined>;

  // Quality Metrics operations
  getQualityMetrics(): Promise<QualityMetric[]>;
  createQualityMetric(_metric: InsertQualityMetric): Promise<QualityMetric>;

  // Framework Configuration operations
  getFrameworkConfigs(): Promise<FrameworkConfiguration[]>;
  getFrameworkConfig(_key: string): Promise<FrameworkConfiguration | undefined>;
  setFrameworkConfig(_config: InsertFrameworkConfig): Promise<FrameworkConfiguration>;

  // Improvement Suggestions operations
  getImprovementSuggestions(): Promise<ImprovementSuggestion[]>;
  getTopImprovementSuggestions(_limit: number): Promise<ImprovementSuggestion[]>;
  createImprovementSuggestion(_suggestion: InsertImprovementSuggestion): Promise<ImprovementSuggestion>;
  clearNewSuggestions(): Promise<void>;
  updateSuggestionStatus(_id: string, _status: 'New' | 'Acknowledged' | 'Done'): Promise<ImprovementSuggestion | undefined>;

  // Features operations
  getFeatures(): Promise<Feature[]>;
  getFeaturesByStatus(_status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'): Promise<Feature[]>;
  getFeaturesByCategory(_category: string): Promise<Feature[]>;
  getPublicRoadmapFeatures(): Promise<Feature[]>;
  createFeature(_feature: InsertFeature): Promise<Feature>;
  updateFeature(_id: string, _updates: Partial<InsertFeature>): Promise<Feature | undefined>;
  deleteFeature(_id: string): Promise<boolean>;
}

/**
 * In-memory storage implementation for the Koveo Gestion system.
 * Stores all data in memory using Map collections with automatic initialization
 * of default data including development pillars and workspace status.
 * 
 * @class MemStorage
 * @implements {IStorage}
 * 
 * @example
 * ```typescript
 * const storage = new MemStorage();
 * const users = await storage.getUsers();
 * const newUser = await storage.createUser(userData);
 * ```
 */
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private pillars: Map<string, DevelopmentPillar>;
  private workspaceStatuses: Map<string, WorkspaceStatus>;
  private qualityMetrics: Map<string, QualityMetric>;
  private frameworkConfigs: Map<string, FrameworkConfiguration>;
  private improvementSuggestions: Map<string, ImprovementSuggestion>;
  private features: Map<string, Feature>;
  private organizations: Map<string, Organization>;
  private buildings: Map<string, Building>;
  private residences: Map<string, Residence>;

  /**
   * Creates a new MemStorage instance and initializes default data.
   * Automatically sets up development pillars, workspace status, and quality metrics.
   */
  constructor() {
    this.users = new Map();
    this.pillars = new Map();
    this.workspaceStatuses = new Map();
    this.qualityMetrics = new Map();
    this.frameworkConfigs = new Map();
    this.improvementSuggestions = new Map();
    this.features = new Map();
    this.organizations = new Map();
    this.buildings = new Map();
    this.residences = new Map();

    // Initialize with default data
    this.initializeDefaultData();
  }

  /**
   * Initializes default data for the storage including development pillars,
   * workspace status tracking, and baseline quality metrics.
   * 
   * @private
   */
  private initializeDefaultData() {
    // Initialize default pillars
    const defaultPillars = [
      {
        id: randomUUID(),
        name: "Validation & QA Pillar",
        description: "Core quality assurance framework",
        status: "in-progress",
        order: "1",
        configuration: { tools: ["eslint", "prettier", "typescript"] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        name: "Testing Pillar",
        description: "Automated testing framework",
        status: "pending",
        order: "2",
        configuration: { tools: ["jest", "cypress", "testing-library"] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: randomUUID(),
        name: "Security Pillar",
        description: "Law 25 compliance framework",
        status: "pending",
        order: "3",
        configuration: { compliance: ["law25", "gdpr"], tools: ["helmet", "bcrypt"] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultPillars.forEach(pillar => this.pillars.set(pillar.id, pillar));

    // Initialize workspace status
    const defaultStatuses = [
      { component: "Environment Setup", status: "complete" },
      { component: "Dependencies Installation", status: "complete" },
      { component: "TypeScript Configuration", status: "in-progress" },
      { component: "Pillar Framework", status: "pending" },
    ];

    defaultStatuses.forEach(status => {
      const statusRecord = {
        id: randomUUID(),
        component: status.component,
        status: status.status,
        lastUpdated: new Date(),
      };
      this.workspaceStatuses.set(status.component, statusRecord);
    });

    // Initialize quality metrics
    const defaultMetrics = [
      { metricType: "Code Coverage", value: "95%" },
      { metricType: "Code Quality", value: "A+" },
      { metricType: "Security Issues", value: "0" },
      { metricType: "Build Time", value: "12ms" },
    ];

    defaultMetrics.forEach(metric => {
      const metricRecord = {
        id: randomUUID(),
        metricType: metric.metricType,
        value: metric.value,
        timestamp: new Date(),
      };
      this.qualityMetrics.set(metric.metricType, metricRecord);
    });
  }

  // User operations
  /**
   * Retrieves all users from storage.
   * 
   * @returns {Promise<User[]>} Array of all user records
   * 
   * @example
   * ```typescript
   * const users = await storage.getUsers();
   * console.log(`Found ${users.length} users`);
   * ```
   */
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  /**
   * Retrieves a specific user by ID.
   * 
   * @param {string} id - The unique identifier of the user
   * @returns {Promise<User | undefined>} The user record or undefined if not found
   * 
   * @example
   * ```typescript
   * const user = await storage.getUser('user-123');
   * if (user) {
   *   console.log(`User: ${user.email}`);
   * }
   * ```
   */
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * Finds a user by their email address.
   * 
   * @param {string} email - The email address to search for
   * @returns {Promise<User | undefined>} The user record or undefined if not found
   * 
   * @example
   * ```typescript
   * const user = await storage.getUserByEmail('john@example.com');
   * if (user) {
   *   console.log(`Found user: ${user.name}`);
   * }
   * ```
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  /**
   * Updates an existing user with partial data.
   * 
   * @param {string} id - The unique identifier of the user to update
   * @param {Partial<User>} updates - Partial user data to update
   * @returns {Promise<User | undefined>} The updated user record or undefined if not found
   * 
   * @example
   * ```typescript
   * const updatedUser = await storage.updateUser('user-123', {
   *   name: 'John Doe',
   *   phone: '+1-555-0123'
   * });
   * ```
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return undefined;
    }

    const updatedUser = {
      ...existingUser,
      ...updates,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Organization operations
  /**
   * Retrieves all organizations from storage.
   * 
   * @returns {Promise<Organization[]>} Array of all organization records
   * 
   * @example
   * ```typescript
   * const orgs = await storage.getOrganizations();
   * console.log(`Managing ${orgs.length} organizations`);
   * ```
   */
  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(
      (org) => org.name === name,
    );
  }

  /**
   * Creates a new organization with automatic ID generation and default values.
   * 
   * @param {InsertOrganization} insertOrganization - Organization data to create
   * @returns {Promise<Organization>} The newly created organization record
   * 
   * @example
   * ```typescript
   * const org = await storage.createOrganization({
   *   name: 'ABC Property Management',
   *   email: 'contact@abc-pm.ca',
   *   address: '123 Main St',
   *   city: 'Montreal',
   *   postalCode: 'H1A 1A1'
   * });
   * ```
   */
  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const organization: Organization = {
      id,
      name: insertOrganization.name,
      email: insertOrganization.email ?? null,
      phone: insertOrganization.phone ?? null,
      website: insertOrganization.website ?? null,
      registrationNumber: insertOrganization.registrationNumber ?? null,
      address: insertOrganization.address,
      city: insertOrganization.city,
      province: insertOrganization.province || 'QC',
      postalCode: insertOrganization.postalCode,
      type: insertOrganization.type || 'management_company',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.organizations.set(id, organization);
    return organization;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | undefined> {
    const existingOrganization = this.organizations.get(id);
    if (!existingOrganization) {
      return undefined;
    }

    const updatedOrganization = {
      ...existingOrganization,
      ...updates,
      updatedAt: new Date(),
    };
    this.organizations.set(id, updatedOrganization);
    return updatedOrganization;
  }

  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    return Array.from(this.buildings.values()).filter(
      (building) => building.organizationId === organizationId,
    );
  }

  // Building operations
  /**
   * Retrieves all buildings from storage.
   * 
   * @returns {Promise<Building[]>} Array of all building records
   * 
   * @example
   * ```typescript
   * const buildings = await storage.getBuildings();
   * const activeBuildings = buildings.filter(b => b.isActive);
   * ```
   */
  async getBuildings(): Promise<Building[]> {
    return Array.from(this.buildings.values());
  }

  async getBuilding(id: string): Promise<Building | undefined> {
    return this.buildings.get(id);
  }

  /**
   * Creates a new building with automatic ID generation and Quebec defaults.
   * 
   * @param {InsertBuilding} insertBuilding - Building data to create
   * @returns {Promise<Building>} The newly created building record
   * 
   * @example
   * ```typescript
   * const building = await storage.createBuilding({
   *   organizationId: 'org-123',
   *   name: 'Maple Towers',
   *   address: '456 Rue Saint-Laurent',
   *   city: 'Quebec City',
   *   postalCode: 'G1K 1K1'
   * });
   * ```
   */
  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const id = randomUUID();
    const building: Building = {
      id,
      organizationId: insertBuilding.organizationId,
      name: insertBuilding.name,
      address: insertBuilding.address,
      city: insertBuilding.city,
      province: insertBuilding.province || 'QC',
      postalCode: insertBuilding.postalCode,
      buildingType: insertBuilding.buildingType ?? null,
      yearBuilt: insertBuilding.yearBuilt ?? null,
      totalUnits: insertBuilding.totalUnits ?? null,
      totalFloors: insertBuilding.totalFloors ?? null,
      parkingSpaces: insertBuilding.parkingSpaces ?? null,
      storageSpaces: insertBuilding.storageSpaces ?? null,
      amenities: insertBuilding.amenities ?? null,
      managementCompany: insertBuilding.managementCompany ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.buildings.set(id, building);
    return building;
  }

  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    const existingBuilding = this.buildings.get(id);
    if (!existingBuilding) {
      return undefined;
    }

    const updatedBuilding = {
      ...existingBuilding,
      ...updates,
      updatedAt: new Date(),
    };
    this.buildings.set(id, updatedBuilding);
    return updatedBuilding;
  }

  async deleteBuilding(id: string): Promise<boolean> {
    const existing = this.buildings.get(id);
    if (!existing) {
      return false;
    }

    // Soft delete by setting isActive to false
    const updated = {
      ...existing,
      isActive: false,
      updatedAt: new Date(),
    };
    this.buildings.set(id, updated);
    return true;
  }

  // Residence operations
  async getResidences(): Promise<Residence[]> {
    return Array.from(this.residences.values());
  }

  async getResidence(id: string): Promise<Residence | undefined> {
    return this.residences.get(id);
  }

  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return Array.from(this.residences.values()).filter(
      (residence) => residence.buildingId === buildingId,
    );
  }

  async createResidence(insertResidence: InsertResidence): Promise<Residence> {
    const id = randomUUID();
    const residence: Residence = {
      id,
      buildingId: insertResidence.buildingId,
      unitNumber: insertResidence.unitNumber,
      floor: insertResidence.floor ?? null,
      squareFootage: insertResidence.squareFootage ?? null,
      bedrooms: insertResidence.bedrooms ?? null,
      bathrooms: insertResidence.bathrooms ?? null,
      balcony: insertResidence.balcony ?? null,
      parkingSpaceNumber: insertResidence.parkingSpaceNumber ?? null,
      storageSpaceNumber: insertResidence.storageSpaceNumber ?? null,
      ownershipPercentage: insertResidence.ownershipPercentage ?? null,
      monthlyFees: insertResidence.monthlyFees ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.residences.set(id, residence);
    return residence;
  }

  async updateResidence(id: string, updates: Partial<Residence>): Promise<Residence | undefined> {
    const existingResidence = this.residences.get(id);
    if (!existingResidence) {
      return undefined;
    }

    const updatedResidence = {
      ...existingResidence,
      ...updates,
      updatedAt: new Date(),
    };
    this.residences.set(id, updatedResidence);
    return updatedResidence;
  }

  async deleteResidence(id: string): Promise<boolean> {
    const existing = this.residences.get(id);
    if (!existing) {
      return false;
    }

    // Soft delete by setting isActive to false
    const updated = {
      ...existing,
      isActive: false,
      updatedAt: new Date(),
    };
    this.residences.set(id, updated);
    return true;
  }

  /**
   * Creates a new user with automatic ID generation and French/tenant defaults.
   * 
   * @param {InsertUser} insertUser - User data to create
   * @returns {Promise<User>} The newly created user record
   * 
   * @example
   * ```typescript
   * const user = await storage.createUser({
   *   name: 'Marie Tremblay',
   *   email: 'marie@example.com',
   *   language: 'fr',
   *   role: 'tenant'
   * });
   * ```
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      language: insertUser.language || 'fr', 
      role: insertUser.role || 'tenant',
      phone: insertUser.phone || null,
      id,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Development Pillar operations
  /**
   * Retrieves all development pillars sorted by order.
   * Development pillars track the implementation of core system frameworks.
   * 
   * @returns {Promise<DevelopmentPillar[]>} Array of development pillars sorted by order
   * 
   * @example
   * ```typescript
   * const pillars = await storage.getPillars();
   * const completedPillars = pillars.filter(p => p.status === 'complete');
   * ```
   */
  async getPillars(): Promise<DevelopmentPillar[]> {
    return Array.from(this.pillars.values()).sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    return this.pillars.get(id);
  }

  /**
   * Creates a new development pillar for system framework tracking.
   * 
   * @param {InsertPillar} insertPillar - Pillar data to create
   * @returns {Promise<DevelopmentPillar>} The newly created pillar record
   * 
   * @example
   * ```typescript
   * const pillar = await storage.createPillar({
   *   name: 'Performance Pillar',
   *   description: 'System performance monitoring framework',
   *   order: '4',
   *   configuration: { tools: ['lighthouse', 'webvitals'] }
   * });
   * ```
   */
  async createPillar(insertPillar: InsertPillar): Promise<DevelopmentPillar> {
    const id = randomUUID();
    const pillar: DevelopmentPillar = {
      ...insertPillar,
      status: insertPillar.status || 'pending',
      configuration: insertPillar.configuration || null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pillars.set(id, pillar);
    return pillar;
  }

  async updatePillar(id: string, updates: Partial<DevelopmentPillar>): Promise<DevelopmentPillar | undefined> {
    const existingPillar = this.pillars.get(id);
    if (!existingPillar) {
      return undefined;
    }

    const updatedPillar = {
      ...existingPillar,
      ...updates,
      updatedAt: new Date(),
    };
    this.pillars.set(id, updatedPillar);
    return updatedPillar;
  }

  // Workspace Status operations
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return Array.from(this.workspaceStatuses.values());
  }

  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    return this.workspaceStatuses.get(component);
  }

  async createWorkspaceStatus(insertStatus: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const id = randomUUID();
    const status: WorkspaceStatus = {
      ...insertStatus,
      status: insertStatus.status || 'pending',
      id,
      lastUpdated: new Date(),
    };
    this.workspaceStatuses.set(insertStatus.component, status);
    return status;
  }

  async updateWorkspaceStatus(component: string, statusValue: string): Promise<WorkspaceStatus | undefined> {
    const existing = this.workspaceStatuses.get(component);
    if (!existing) {
      return undefined;
    }

    const updated = {
      ...existing,
      status: statusValue,
      lastUpdated: new Date(),
    };
    this.workspaceStatuses.set(component, updated);
    return updated;
  }

  // Quality Metrics operations
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return Array.from(this.qualityMetrics.values());
  }

  async createQualityMetric(insertMetric: InsertQualityMetric): Promise<QualityMetric> {
    const id = randomUUID();
    const metric: QualityMetric = {
      ...insertMetric,
      id,
      timestamp: new Date(),
    };
    this.qualityMetrics.set(insertMetric.metricType, metric);
    return metric;
  }

  // Framework Configuration operations
  async getFrameworkConfigs(): Promise<FrameworkConfiguration[]> {
    return Array.from(this.frameworkConfigs.values());
  }

  async getFrameworkConfig(key: string): Promise<FrameworkConfiguration | undefined> {
    return this.frameworkConfigs.get(key);
  }

  async setFrameworkConfig(insertConfig: InsertFrameworkConfig): Promise<FrameworkConfiguration> {
    const id = randomUUID();
    const config: FrameworkConfiguration = {
      ...insertConfig,
      description: insertConfig.description || null,
      id,
      updatedAt: new Date(),
    };
    this.frameworkConfigs.set(insertConfig.key, config);
    return config;
  }

  // Improvement Suggestions operations
  /**
   * Retrieves all improvement suggestions from quality analysis.
   * 
   * @returns {Promise<ImprovementSuggestion[]>} Array of all improvement suggestions
   * 
   * @example
   * ```typescript
   * const suggestions = await storage.getImprovementSuggestions();
   * const criticalSuggestions = suggestions.filter(s => s.priority === 'Critical');
   * ```
   */
  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return Array.from(this.improvementSuggestions.values());
  }

  async getTopImprovementSuggestions(limit: number): Promise<ImprovementSuggestion[]> {
    const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    
    return Array.from(this.improvementSuggestions.values())
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
      })
      .slice(0, limit);
  }

  /**
   * Creates a new improvement suggestion from quality analysis results.
   * 
   * @param {InsertImprovementSuggestion} insertSuggestion - Suggestion data to create
   * @returns {Promise<ImprovementSuggestion>} The newly created suggestion record
   * 
   * @example
   * ```typescript
   * const suggestion = await storage.createImprovementSuggestion({
   *   title: 'High Cyclomatic Complexity in UserService',
   *   description: 'Function complexity exceeds threshold of 10',
   *   category: 'Code Quality',
   *   priority: 'High',
   *   filePath: 'src/services/UserService.ts'
   * });
   * ```
   */
  async createImprovementSuggestion(insertSuggestion: InsertImprovementSuggestion): Promise<ImprovementSuggestion> {
    const id = randomUUID();
    const suggestion: ImprovementSuggestion = {
      ...insertSuggestion,
      status: insertSuggestion.status || 'New',
      filePath: insertSuggestion.filePath || null,
      id,
      createdAt: new Date(),
    };
    this.improvementSuggestions.set(id, suggestion);
    return suggestion;
  }

  async clearNewSuggestions(): Promise<void> {
    const toDelete: string[] = [];
    this.improvementSuggestions.forEach((suggestion, id) => {
      if (suggestion.status === 'New') {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => this.improvementSuggestions.delete(id));
  }

  async updateSuggestionStatus(id: string, status: 'New' | 'Acknowledged' | 'Done'): Promise<ImprovementSuggestion | undefined> {
    const existing = this.improvementSuggestions.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = {
      ...existing,
      status,
    };
    this.improvementSuggestions.set(id, updated);
    return updated;
  }

  // Features operations
  /**
   * Retrieves all features from the roadmap system.
   * 
   * @returns {Promise<Feature[]>} Array of all feature records
   * 
   * @example
   * ```typescript
   * const features = await storage.getFeatures();
   * const completedFeatures = features.filter(f => f.status === 'completed');
   * ```
   */
  async getFeatures(): Promise<Feature[]> {
    return Array.from(this.features.values());
  }

  async getFeaturesByStatus(status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'): Promise<Feature[]> {
    return Array.from(this.features.values()).filter(
      (feature) => feature.status === status
    );
  }

  async getFeaturesByCategory(category: string): Promise<Feature[]> {
    return Array.from(this.features.values()).filter(
      (feature) => feature.category === category
    );
  }

  async getPublicRoadmapFeatures(): Promise<Feature[]> {
    return Array.from(this.features.values()).filter(
      (feature) => feature.isPublicRoadmap === true
    );
  }

  /**
   * Creates a new feature for the product roadmap with defaults.
   * 
   * @param {InsertFeature} insertFeature - Feature data to create
   * @returns {Promise<Feature>} The newly created feature record
   * 
   * @example
   * ```typescript
   * const feature = await storage.createFeature({
   *   name: 'Advanced Reporting',
   *   description: 'Customizable financial and operational reports',
   *   category: 'Analytics & Reporting',
   *   status: 'planned',
   *   priority: 'high'
   * });
   * ```
   */
  async createFeature(insertFeature: InsertFeature): Promise<Feature> {
    const id = randomUUID();
    const feature: Feature = {
      ...insertFeature,
      status: insertFeature.status || 'planned',
      priority: insertFeature.priority || 'medium',
      isPublicRoadmap: insertFeature.isPublicRoadmap ?? true,
      requestedBy: insertFeature.requestedBy || null,
      assignedTo: insertFeature.assignedTo || null,
      estimatedHours: insertFeature.estimatedHours || null,
      actualHours: null,
      startDate: insertFeature.startDate || null,
      completedDate: insertFeature.completedDate || null,
      tags: insertFeature.tags || null,
      metadata: insertFeature.metadata || null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.features.set(id, feature);
    return feature;
  }

  async updateFeature(id: string, updates: Partial<InsertFeature>): Promise<Feature | undefined> {
    const existingFeature = this.features.get(id);
    if (!existingFeature) {
      return undefined;
    }

    const updatedFeature = {
      ...existingFeature,
      ...updates,
      updatedAt: new Date(),
    };
    this.features.set(id, updatedFeature);
    return updatedFeature;
  }

  async deleteFeature(id: string): Promise<boolean> {
    return this.features.delete(id);
  }
}

// Use database storage if DATABASE_URL is set, otherwise use in-memory storage
// import { DatabaseStorage } from './db-storage';

// Temporarily using MemStorage until database tables are created
export const storage = new MemStorage();
// export const storage = process.env.DATABASE_URL 
//   ? new DatabaseStorage() 
//   : new MemStorage();
