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
  type InsertImprovementSuggestion
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private pillars: Map<string, DevelopmentPillar>;
  private workspaceStatuses: Map<string, WorkspaceStatus>;
  private qualityMetrics: Map<string, QualityMetric>;
  private frameworkConfigs: Map<string, FrameworkConfiguration>;
  private improvementSuggestions: Map<string, ImprovementSuggestion>;
  private organizations: Map<string, Organization>;
  private buildings: Map<string, Building>;
  private residences: Map<string, Residence>;

  constructor() {
    this.users = new Map();
    this.pillars = new Map();
    this.workspaceStatuses = new Map();
    this.qualityMetrics = new Map();
    this.frameworkConfigs = new Map();
    this.improvementSuggestions = new Map();
    this.organizations = new Map();
    this.buildings = new Map();
    this.residences = new Map();

    // Initialize with default data
    this.initializeDefaultData();
  }

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
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

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

  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const organization: Organization = {
      ...insertOrganization,
      type: insertOrganization.type || 'management_company',
      province: insertOrganization.province || 'QC',
      id,
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
  async getBuildings(): Promise<Building[]> {
    return Array.from(this.buildings.values());
  }

  async getBuilding(id: string): Promise<Building | undefined> {
    return this.buildings.get(id);
  }

  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const id = randomUUID();
    const building: Building = {
      ...insertBuilding,
      province: insertBuilding.province || 'QC',
      id,
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
      ...insertResidence,
      id,
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
  async getPillars(): Promise<DevelopmentPillar[]> {
    return Array.from(this.pillars.values()).sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    return this.pillars.get(id);
  }

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
}

// Use database storage if DATABASE_URL is set, otherwise use in-memory storage
import { DatabaseStorage } from './db-storage';

export const storage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();
