import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import type { 
  User, 
  InsertUser,
  Organization,
  InsertOrganization,
  Building,
  DevelopmentPillar,
  InsertPillar,
  WorkspaceStatus,
  InsertWorkspaceStatus,
  QualityMetric,
  InsertQualityMetric,
  FrameworkConfiguration,
  InsertFrameworkConfig,
  ImprovementSuggestion,
  InsertImprovementSuggestion
} from "@shared/schema";
import type { IStorage } from "./storage";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export class DatabaseStorage implements IStorage {
  // User operations
  async getUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  // Organization operations
  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(schema.organizations);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const result = await db.select().from(schema.organizations).where(eq(schema.organizations.id, id));
    return result[0];
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const result = await db.select().from(schema.organizations).where(eq(schema.organizations.name, name));
    return result[0];
  }

  async createOrganization(insertOrganization: InsertOrganization): Promise<Organization> {
    const result = await db.insert(schema.organizations).values(insertOrganization).returning();
    return result[0];
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | undefined> {
    const result = await db.update(schema.organizations)
      .set(updates)
      .where(eq(schema.organizations.id, id))
      .returning();
    return result[0];
  }

  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    return await db.select().from(schema.buildings).where(eq(schema.buildings.organizationId, organizationId));
  }

  // Development Pillar operations
  async getPillars(): Promise<DevelopmentPillar[]> {
    return await db.select().from(schema.developmentPillars);
  }

  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    const result = await db.select().from(schema.developmentPillars).where(eq(schema.developmentPillars.id, id));
    return result[0];
  }

  async createPillar(insertPillar: InsertPillar): Promise<DevelopmentPillar> {
    const result = await db.insert(schema.developmentPillars).values(insertPillar).returning();
    return result[0];
  }

  async updatePillar(id: string, updates: Partial<DevelopmentPillar>): Promise<DevelopmentPillar | undefined> {
    const result = await db.update(schema.developmentPillars)
      .set(updates)
      .where(eq(schema.developmentPillars.id, id))
      .returning();
    return result[0];
  }

  // Workspace Status operations
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return await db.select().from(schema.workspaceStatus);
  }

  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    const result = await db.select().from(schema.workspaceStatus).where(eq(schema.workspaceStatus.component, component));
    return result[0];
  }

  async createWorkspaceStatus(insertStatus: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const result = await db.insert(schema.workspaceStatus).values(insertStatus).returning();
    return result[0];
  }

  async updateWorkspaceStatus(component: string, statusValue: string): Promise<WorkspaceStatus | undefined> {
    const result = await db.update(schema.workspaceStatus)
      .set({ status: statusValue, lastUpdated: new Date() })
      .where(eq(schema.workspaceStatus.component, component))
      .returning();
    return result[0];
  }

  // Quality Metrics operations
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return await db.select().from(schema.qualityMetrics);
  }

  async createQualityMetric(insertMetric: InsertQualityMetric): Promise<QualityMetric> {
    const result = await db.insert(schema.qualityMetrics).values(insertMetric).returning();
    return result[0];
  }

  // Framework Configuration operations
  async getFrameworkConfigs(): Promise<FrameworkConfiguration[]> {
    return await db.select().from(schema.frameworkConfiguration);
  }

  async getFrameworkConfig(key: string): Promise<FrameworkConfiguration | undefined> {
    const result = await db.select().from(schema.frameworkConfiguration).where(eq(schema.frameworkConfiguration.key, key));
    return result[0];
  }

  async setFrameworkConfig(insertConfig: InsertFrameworkConfig): Promise<FrameworkConfiguration> {
    const result = await db.insert(schema.frameworkConfiguration).values(insertConfig).returning();
    return result[0];
  }

  // Improvement Suggestions operations
  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return await db.select().from(schema.improvementSuggestions);
  }

  async getTopImprovementSuggestions(limit: number): Promise<ImprovementSuggestion[]> {
    const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    
    const suggestions = await db.select()
      .from(schema.improvementSuggestions)
      .orderBy(desc(schema.improvementSuggestions.createdAt));
    
    // Sort by priority in JavaScript since complex SQL sorting might not be supported
    return suggestions
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
      })
      .slice(0, limit);
  }

  async createImprovementSuggestion(insertSuggestion: InsertImprovementSuggestion): Promise<ImprovementSuggestion> {
    const result = await db.insert(schema.improvementSuggestions).values(insertSuggestion).returning();
    return result[0];
  }

  async clearNewSuggestions(): Promise<void> {
    await db.delete(schema.improvementSuggestions).where(eq(schema.improvementSuggestions.status, 'New'));
  }

  async updateSuggestionStatus(id: string, status: 'New' | 'Acknowledged' | 'Done'): Promise<ImprovementSuggestion | undefined> {
    const result = await db.update(schema.improvementSuggestions)
      .set({ status })
      .where(eq(schema.improvementSuggestions.id, id))
      .returning();
    return result[0];
  }
}