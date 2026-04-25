/**
 * Mock for server/storage.ts - Provides test-ready storage implementation
 * Uses MemStorage automatically for all tests - SELF-CONTAINED MOCK
 */

// Mock IStorage interface
export interface IStorage {
  users: Map<string, any>;
  organizations: Map<string, any>;
  buildings: Map<string, any>;
  residences: Map<string, any>;
  pillars: Map<string, any>;
  workspaceStatuses: Map<string, any>;
  qualityMetrics: Map<string, any>;
  frameworkConfigs: Map<string, any>;
  improvementSuggestions: Map<string, any>;
  features: Map<string, any>;
  actionableItems: Map<string, any>;
  invitations: Map<string, any>;
  invitationAuditLogs: Map<string, any>;
  invoices: Map<string, any>;
  
  // Common storage methods
  clear(): void;
  get(collection: string, id: string): any;
  set(collection: string, id: string, data: any): void;
  delete(collection: string, id: string): void;
  list(collection: string): any[];
}

// Mock MemStorage class - completely self-contained
export class MemStorage implements IStorage {
  users = new Map<string, any>();
  organizations = new Map<string, any>();
  buildings = new Map<string, any>();
  residences = new Map<string, any>();
  pillars = new Map<string, any>();
  workspaceStatuses = new Map<string, any>();
  qualityMetrics = new Map<string, any>();
  frameworkConfigs = new Map<string, any>();
  improvementSuggestions = new Map<string, any>();
  features = new Map<string, any>();
  actionableItems = new Map<string, any>();
  invitations = new Map<string, any>();
  invitationAuditLogs = new Map<string, any>();
  invoices = new Map<string, any>();

  clear(): void {
    this.users.clear();
    this.organizations.clear();
    this.buildings.clear();
    this.residences.clear();
    this.pillars.clear();
    this.workspaceStatuses.clear();
    this.qualityMetrics.clear();
    this.frameworkConfigs.clear();
    this.improvementSuggestions.clear();
    this.features.clear();
    this.actionableItems.clear();
    this.invitations.clear();
    this.invitationAuditLogs.clear();
    this.invoices.clear();
  }

  get(collection: string, id: string): any {
    const map = (this as any)[collection];
    return map ? map.get(id) : undefined;
  }

  set(collection: string, id: string, data: any): void {
    const map = (this as any)[collection];
    if (map) map.set(id, data);
  }

  delete(collection: string, id: string): void {
    const map = (this as any)[collection];
    if (map) map.delete(id);
  }

  list(collection: string): any[] {
    const map = (this as any)[collection];
    return map ? Array.from(map.values()) : [];
  }
}

// Create a default mock storage instance
const mockStorage = new MemStorage();

// Export default mock storage instance
export const storage = mockStorage;
export default mockStorage;

// Additional storage utilities for tests
export const createTestStorage = () => new MemStorage();
export const clearTestStorage = (storage: MemStorage) => {
  storage.clear();
};