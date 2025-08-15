import { 
  type User, 
  type InsertUser,
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
  getUser(_id: string): Promise<User | undefined>;
  getUserByUsername(_username: string): Promise<User | undefined>;
  createUser(_user: InsertUser): Promise<User>;

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

  constructor() {
    this.users = new Map();
    this.pillars = new Map();
    this.workspaceStatuses = new Map();
    this.qualityMetrics = new Map();
    this.frameworkConfigs = new Map();
    this.improvementSuggestions = new Map();

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
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser,
      language: insertUser.language || 'en', 
      id,
      createdAt: new Date(),
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
