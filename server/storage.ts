import {
  type User,
  type InsertUser,
  type Organization,
  type InsertOrganization,
  type Building,
  type InsertBuilding,
  type Residence,
  type InsertResidence,
  type Contact,
  type InsertContact,
  type Document,
  type InsertDocument,
  type DocumentBuilding,
  type InsertDocumentBuilding,
  type DocumentResident,
  type InsertDocumentResident,
  type Pillar,
  type InsertPillar,
  type WorkspaceStatus,
  type InsertWorkspaceStatus,
  type QualityMetric,
  type InsertQualityMetric,
  type FrameworkConfiguration,
  type InsertFrameworkConfiguration,
  type ImprovementSuggestion,
  type InsertImprovementSuggestion,
  type Feature,
  type InsertFeature,
  type ActionableItem,
  type InsertActionableItem,
  type Invitation,
  type InsertInvitation,
  type InvitationAuditLog,
  type InsertInvitationAuditLog,
  type Permission,
  type RolePermission,
  type UserPermission,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Bug,
  type InsertBug,
  type FeatureRequest,
  type InsertFeatureRequest,
  type FeatureRequestUpvote,
  type InsertFeatureRequestUpvote,
} from '@shared/schema';
import {
  type Demand,
  type InsertDemand,
  type DemandComment,
  type InsertDemandComment,
} from '@shared/schemas/operations';
import { randomUUID } from 'crypto';

export interface IStorage {
  // User operations
  getUsers(): Promise<User[]>;
  getUsersByOrganizations(_userId: string): Promise<User[]>;
  getUser(_id: string): Promise<User | undefined>;
  getUserOrganizations(_userId: string): Promise<Array<{ organizationId: string }>>;
  getUserResidences(_userId: string): Promise<Array<{ residenceId: string }>>;
  getUserByEmail(_email: string): Promise<User | undefined>;
  createUser(_user: InsertUser): Promise<User>;
  updateUser(_id: string, _updates: Partial<User>): Promise<User | undefined>;
  
  // Password reset operations
  createPasswordResetToken(_token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(_token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(_tokenId: string): Promise<PasswordResetToken | undefined>;
  cleanupExpiredPasswordResetTokens(): Promise<number>;
  
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
  
  // Contact operations
  getContacts(): Promise<Contact[]>;
  getContactsByEntity(_entityId: string, _entity: 'organization' | 'building' | 'residence'): Promise<Contact[]>;
  getContactsForResidence(_residenceId: string): Promise<Array<Contact & { user: User }>>;
  createContact(_contact: InsertContact): Promise<Contact>;
  updateContact(_id: string, _updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(_id: string): Promise<boolean>;
  
  // Document operations
  getBuildingDocumentsForUser(_buildingId: string, _userId: string, _userRole: string): Promise<Array<Document & { buildingDocument: DocumentBuilding }>>;
  getBuildingDocument(_buildingId: string, _documentId: string, _userId: string, _userRole: string): Promise<(Document & { buildingDocument: DocumentBuilding }) | undefined>;
  createBuildingDocument(_document: InsertDocumentBuilding): Promise<DocumentBuilding>;
  updateBuildingDocument(_id: string, _updates: Partial<DocumentBuilding>): Promise<DocumentBuilding | undefined>;
  deleteBuildingDocument(_id: string): Promise<boolean>;
  getResidentDocumentsForUser(_residenceId: string, _userId: string, _userRole: string): Promise<Array<Document & { residentDocument: DocumentResident }>>;
  
  // Permission operations
  getPermissions(): Promise<Permission[]>;
  getRolePermissions(): Promise<RolePermission[]>;
  getUserPermissions(): Promise<UserPermission[]>;
  
  // Development operations
  getPillars(): Promise<Pillar[]>;
  getPillar(_id: string): Promise<Pillar | undefined>;
  createPillar(_pillar: InsertPillar): Promise<Pillar>;
  updatePillar(_id: string, _pillar: Partial<Pillar>): Promise<Pillar | undefined>;
  getWorkspaceStatuses(): Promise<WorkspaceStatus[]>;
  getWorkspaceStatus(_component: string): Promise<WorkspaceStatus | undefined>;
  createWorkspaceStatus(_status: InsertWorkspaceStatus): Promise<WorkspaceStatus>;
  updateWorkspaceStatus(_component: string, _status: Partial<WorkspaceStatus>): Promise<WorkspaceStatus | undefined>;
  getQualityMetrics(): Promise<QualityMetric[]>;
  createQualityMetric(_metric: InsertQualityMetric): Promise<QualityMetric>;
  getFrameworkConfigurations(): Promise<FrameworkConfiguration[]>;
  createFrameworkConfiguration(_config: InsertFrameworkConfiguration): Promise<FrameworkConfiguration>;
  updateFrameworkConfiguration(_key: string, _config: Partial<FrameworkConfiguration>): Promise<FrameworkConfiguration | undefined>;
  getImprovementSuggestions(): Promise<ImprovementSuggestion[]>;
  createImprovementSuggestion(_suggestion: InsertImprovementSuggestion): Promise<ImprovementSuggestion>;
  updateImprovementSuggestion(_id: string, _updates: Partial<ImprovementSuggestion>): Promise<ImprovementSuggestion | undefined>;
  getFeatures(): Promise<Feature[]>;
  getFeature(_id: string): Promise<Feature | undefined>;
  createFeature(_feature: InsertFeature): Promise<Feature>;
  updateFeature(_id: string, _updates: Partial<Feature>): Promise<Feature | undefined>;
  getActionableItems(): Promise<ActionableItem[]>;
  createActionableItem(_item: InsertActionableItem): Promise<ActionableItem>;
  updateActionableItem(_id: string, _updates: Partial<ActionableItem>): Promise<ActionableItem | undefined>;
  deleteActionableItem(_id: string): Promise<boolean>;
  getInvitations(): Promise<Invitation[]>;
  createInvitation(_invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(_token: string): Promise<Invitation | undefined>;
  updateInvitation(_id: string, _updates: Partial<Invitation>): Promise<Invitation | undefined>;
  getInvitationAuditLogs(): Promise<InvitationAuditLog[]>;
  createInvitationAuditLog(_log: InsertInvitationAuditLog): Promise<InvitationAuditLog>;
  getCommentsByDemand(_demandId: string): Promise<DemandComment[]>;
  createDemandComment(_comment: InsertDemandComment): Promise<DemandComment>;
  getBugs(): Promise<Bug[]>;
  getBug(_id: string): Promise<Bug | undefined>;
  createBug(_bug: InsertBug): Promise<Bug>;
  updateBug(_id: string, _updates: Partial<Bug>): Promise<Bug | undefined>;
  getFeatureRequests(): Promise<FeatureRequest[]>;
  getFeatureRequest(_id: string): Promise<FeatureRequest | undefined>;
  createFeatureRequest(_request: InsertFeatureRequest): Promise<FeatureRequest>;
  updateFeatureRequest(_id: string, _updates: Partial<FeatureRequest>): Promise<FeatureRequest | undefined>;
  addFeatureRequestUpvote(_featureRequestId: string, _userId: string): Promise<{ success: boolean; message: string; data?: any }>;
  removeFeatureRequestUpvote(_featureRequestId: string, _userId: string): Promise<{ success: boolean; message: string; data?: any }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private organizations: Map<string, Organization>;
  private buildings: Map<string, Building>;
  private residences: Map<string, Residence>;
  private pillars: Map<string, Pillar>;
  private workspaceStatuses: Map<string, WorkspaceStatus>;
  private qualityMetrics: Map<string, QualityMetric>;
  private frameworkConfigs: Map<string, FrameworkConfiguration>;
  private improvementSuggestions: Map<string, ImprovementSuggestion>;
  private features: Map<string, Feature>;
  private actionableItems: Map<string, ActionableItem>;
  private invitations: Map<string, Invitation>;
  private invitationAuditLogs: Map<string, InvitationAuditLog>;
  private bugs: Map<string, Bug>;
  private featureRequests: Map<string, FeatureRequest>;
  private featureRequestUpvotes: Map<string, FeatureRequestUpvote>;

  constructor() {
    this.users = new Map();
    this.organizations = new Map();
    this.buildings = new Map();
    this.residences = new Map();
    this.pillars = new Map();
    this.workspaceStatuses = new Map();
    this.qualityMetrics = new Map();
    this.frameworkConfigs = new Map();
    this.improvementSuggestions = new Map();
    this.features = new Map();
    this.actionableItems = new Map();
    this.invitations = new Map();
    this.invitationAuditLogs = new Map();
    this.bugs = new Map();
    this.featureRequests = new Map();
    this.featureRequestUpvotes = new Map();

    this.initializeTestUser();
  }

  private initializeTestUser() {
    const preHashedPassword = '$2b$12$2enFyxzC3wmknRDwQNnISOVpE1bsRCLlCtj/t1kc7nOwNoG7p9w26';
    
    const user: User = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      username: 'kevin.hervieux@koveo-gestion.com',
      email: 'kevin.hervieux@koveo-gestion.com',
      password: preHashedPassword,
      firstName: 'Kevin',
      lastName: 'Hervieux',
      phone: '',
      profileImage: '',
      language: 'fr',
      role: 'admin',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set(user.id, user);
  }

  // User operations
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByOrganizations(_userId: string): Promise<User[]> {
    return [];
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserOrganizations(_userId: string): Promise<Array<{ organizationId: string }>> {
    return [];
  }

  async getUserResidences(_userId: string): Promise<Array<{ residenceId: string }>> {
    return [];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      phone: insertUser.phone || '',
      profileImage: insertUser.profileImage || '',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
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

  // Minimal implementations for other required methods
  async createPasswordResetToken(_token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    return { ..._token, id: randomUUID(), createdAt: new Date(), usedAt: null, isUsed: false };
  }
  async getPasswordResetToken(_token: string): Promise<PasswordResetToken | undefined> { return undefined; }
  async markPasswordResetTokenAsUsed(_tokenId: string): Promise<PasswordResetToken | undefined> { return undefined; }
  async cleanupExpiredPasswordResetTokens(): Promise<number> { return 0; }

  async getOrganizations(): Promise<Organization[]> { return Array.from(this.organizations.values()); }
  async getOrganization(id: string): Promise<Organization | undefined> { return this.organizations.get(id); }
  async getOrganizationByName(name: string): Promise<Organization | undefined> { 
    return Array.from(this.organizations.values()).find(org => org.name === name); 
  }
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const id = randomUUID();
    const organization: Organization = {
      ...org,
      id,
      phone: org.phone || '',
      email: org.email || '',
      website: org.website || '',
      registrationNumber: org.registrationNumber || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.organizations.set(id, organization);
    return organization;
  }
  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | undefined> {
    const existing = this.organizations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.organizations.set(id, updated);
    return updated;
  }
  async getBuildingsByOrganization(orgId: string): Promise<Building[]> {
    return Array.from(this.buildings.values()).filter(b => b.organizationId === orgId);
  }

  async getBuildings(): Promise<Building[]> { return Array.from(this.buildings.values()); }
  async getBuilding(id: string): Promise<Building | undefined> { return this.buildings.get(id); }
  async createBuilding(building: InsertBuilding): Promise<Building> {
    const id = randomUUID();
    const newBuilding: Building = {
      ...building,
      id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      totalUnits: building.totalUnits || 0,
      floors: building.floors || 0,
      yearBuilt: building.yearBuilt || 0,
      buildingType: building.buildingType as "apartment" | "condo" | "rental",
      bankAccountNumber: building.bankAccountNumber || '',
      bankAccountMinimums: building.bankAccountMinimums || {},
      bankAccountUpdatedAt: new Date(),
      inflationSettings: building.inflationSettings || '',
      managementFeePercentage: building.managementFeePercentage || 0,
      reserveFundPercentage: building.reserveFundPercentage || 0,
    };
    this.buildings.set(id, newBuilding);
    return newBuilding;
  }
  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    const existing = this.buildings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.buildings.set(id, updated);
    return updated;
  }
  async deleteBuilding(id: string): Promise<boolean> { return this.buildings.delete(id); }

  async getResidences(): Promise<Residence[]> { return Array.from(this.residences.values()); }
  async getResidence(id: string): Promise<Residence | undefined> { return this.residences.get(id); }
  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return Array.from(this.residences.values()).filter(r => r.buildingId === buildingId);
  }
  async createResidence(residence: InsertResidence): Promise<Residence> {
    const id = randomUUID();
    const newResidence: Residence = {
      ...residence,
      id,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      floor: residence.floor || 0,
      squareFootage: residence.squareFootage?.toString() || '0',
      bedrooms: residence.bedrooms || 0,
      bathrooms: residence.bathrooms?.toString() || '0',
      balcony: residence.balcony || false,
      parking: residence.parking || false,
      storage: residence.storage || false,
      monthlyFees: residence.monthlyFees?.toString() || '0',
    };
    this.residences.set(id, newResidence);
    return newResidence;
  }
  async updateResidence(id: string, updates: Partial<Residence>): Promise<Residence | undefined> {
    const existing = this.residences.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.residences.set(id, updated);
    return updated;
  }
  async deleteResidence(id: string): Promise<boolean> { return this.residences.delete(id); }

  async getContacts(): Promise<Contact[]> { return []; }
  async getContactsByEntity(): Promise<Contact[]> { return []; }
  async getContactsForResidence(): Promise<Array<Contact & { user: User }>> { return []; }
  async createContact(contact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    return {
      ...contact,
      id,
      email: contact.email || '',
      phone: contact.phone || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async updateContact(): Promise<Contact | undefined> { return undefined; }
  async deleteContact(): Promise<boolean> { return false; }

  async getBuildingDocumentsForUser(): Promise<Array<Document & { buildingDocument: DocumentBuilding }>> { return []; }
  async getBuildingDocument(): Promise<(Document & { buildingDocument: DocumentBuilding }) | undefined> { return undefined; }
  async createBuildingDocument(doc: InsertDocumentBuilding): Promise<DocumentBuilding> {
    const id = randomUUID();
    return {
      ...doc,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      uploadDate: new Date(),
      dateReference: new Date(),
      fileUrl: doc.fileUrl || '',
      fileName: doc.fileName || '',
      fileSize: doc.fileSize || '',
      mimeType: doc.mimeType || '',
    };
  }
  async updateBuildingDocument(): Promise<DocumentBuilding | undefined> { return undefined; }
  async deleteBuildingDocument(): Promise<boolean> { return false; }
  async getResidentDocumentsForUser(): Promise<Array<Document & { residentDocument: DocumentResident }>> { return []; }

  async getPermissions(): Promise<Permission[]> { return []; }
  async getRolePermissions(): Promise<RolePermission[]> { return []; }
  async getUserPermissions(): Promise<UserPermission[]> { return []; }

  async getPillars(): Promise<Pillar[]> { return Array.from(this.pillars.values()); }
  async getPillar(id: string): Promise<Pillar | undefined> { return this.pillars.get(id); }
  async createPillar(pillar: InsertPillar): Promise<Pillar> {
    const id = randomUUID();
    const newPillar: Pillar = {
      ...pillar,
      id,
      description: pillar.description || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pillars.set(id, newPillar);
    return newPillar;
  }
  async updatePillar(id: string, updates: Partial<Pillar>): Promise<Pillar | undefined> {
    const existing = this.pillars.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.pillars.set(id, updated);
    return updated;
  }

  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> { return Array.from(this.workspaceStatuses.values()); }
  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> { return this.workspaceStatuses.get(component); }
  async createWorkspaceStatus(status: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const id = randomUUID();
    const newStatus: WorkspaceStatus = { ...status, id, createdAt: new Date(), updatedAt: new Date() };
    this.workspaceStatuses.set(status.component, newStatus);
    return newStatus;
  }
  async updateWorkspaceStatus(component: string, updates: Partial<WorkspaceStatus>): Promise<WorkspaceStatus | undefined> {
    const existing = this.workspaceStatuses.get(component);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.workspaceStatuses.set(component, updated);
    return updated;
  }

  async getQualityMetrics(): Promise<QualityMetric[]> { return Array.from(this.qualityMetrics.values()); }
  async createQualityMetric(metric: InsertQualityMetric): Promise<QualityMetric> {
    const id = randomUUID();
    const newMetric: QualityMetric = { ...metric, id, createdAt: new Date(), updatedAt: new Date() };
    this.qualityMetrics.set(id, newMetric);
    return newMetric;
  }

  async getFrameworkConfigurations(): Promise<FrameworkConfiguration[]> { return Array.from(this.frameworkConfigs.values()); }
  async createFrameworkConfiguration(config: InsertFrameworkConfiguration): Promise<FrameworkConfiguration> {
    const id = randomUUID();
    const newConfig: FrameworkConfiguration = { ...config, id, createdAt: new Date(), updatedAt: new Date() };
    this.frameworkConfigs.set(config._key, newConfig);
    return newConfig;
  }
  async updateFrameworkConfiguration(key: string, updates: Partial<FrameworkConfiguration>): Promise<FrameworkConfiguration | undefined> {
    const existing = this.frameworkConfigs.get(key);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.frameworkConfigs.set(key, updated);
    return updated;
  }

  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> { return Array.from(this.improvementSuggestions.values()); }
  async createImprovementSuggestion(suggestion: InsertImprovementSuggestion): Promise<ImprovementSuggestion> {
    const id = randomUUID();
    const newSuggestion: ImprovementSuggestion = {
      ...suggestion,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      acknowledgedAt: null,
      completedAt: null,
    };
    this.improvementSuggestions.set(id, newSuggestion);
    return newSuggestion;
  }
  async updateImprovementSuggestion(id: string, updates: Partial<ImprovementSuggestion>): Promise<ImprovementSuggestion | undefined> {
    const existing = this.improvementSuggestions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.improvementSuggestions.set(id, updated);
    return updated;
  }

  async getFeatures(): Promise<Feature[]> { return Array.from(this.features.values()); }
  async getFeature(id: string): Promise<Feature | undefined> { return this.features.get(id); }
  async createFeature(feature: InsertFeature): Promise<Feature> {
    const id = randomUUID();
    const newFeature: Feature = {
      ...feature,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      requestedBy: feature.requestedBy || '',
      assignedTo: feature.assignedTo || '',
      estimatedHours: feature.estimatedHours || 0,
      businessObjective: feature.businessObjective || '',
      targetUsers: feature.targetUsers || '',
      successMetrics: feature.successMetrics || '',
      technicalComplexity: feature.technicalComplexity || '',
      dependencies: feature.dependencies || [],
      userFlow: feature.userFlow || '',
      isPublicRoadmap: feature.isPublicRoadmap || false,
      upvoteCount: 0,
      startDate: null,
      completedDate: null,
      tags: [],
      metadata: {},
      syncedAt: new Date(),
    };
    this.features.set(id, newFeature);
    return newFeature;
  }
  async updateFeature(id: string, updates: Partial<Feature>): Promise<Feature | undefined> {
    const existing = this.features.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.features.set(id, updated);
    return updated;
  }

  async getActionableItems(): Promise<ActionableItem[]> { return Array.from(this.actionableItems.values()); }
  async createActionableItem(item: InsertActionableItem): Promise<ActionableItem> {
    const id = randomUUID();
    const newItem: ActionableItem = {
      ...item,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedHours: item.estimatedHours || 0,
      priority: item.priority || 'medium',
      dependencies: item.dependencies || [],
      completedAt: null,
      startedAt: null,
    };
    this.actionableItems.set(id, newItem);
    return newItem;
  }
  async updateActionableItem(id: string, updates: Partial<ActionableItem>): Promise<ActionableItem | undefined> {
    const existing = this.actionableItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.actionableItems.set(id, updated);
    return updated;
  }
  async deleteActionableItem(id: string): Promise<boolean> { return this.actionableItems.delete(id); }

  async getInvitations(): Promise<Invitation[]> { return Array.from(this.invitations.values()); }
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const id = randomUUID();
    const newInvitation: Invitation = {
      ...invitation,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      buildingId: invitation.buildingId || '',
      personalMessage: invitation.personalMessage || '',
      invitationContext: invitation.invitationContext || '',
      securityLevel: invitation.securityLevel || '',
      isRevocable: invitation.isRevocable || true,
      lastAccessedAt: null,
    };
    this.invitations.set(id, newInvitation);
    return newInvitation;
  }
  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return Array.from(this.invitations.values()).find(inv => inv.token === token);
  }
  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation | undefined> {
    const existing = this.invitations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.invitations.set(id, updated);
    return updated;
  }

  async getInvitationAuditLogs(): Promise<InvitationAuditLog[]> { return Array.from(this.invitationAuditLogs.values()); }
  async createInvitationAuditLog(log: InsertInvitationAuditLog): Promise<InvitationAuditLog> {
    const id = randomUUID();
    const newLog: InvitationAuditLog = { ...log, id, createdAt: new Date() };
    this.invitationAuditLogs.set(id, newLog);
    return newLog;
  }

  async getCommentsByDemand(): Promise<DemandComment[]> { return []; }
  async createDemandComment(comment: InsertDemandComment): Promise<DemandComment> {
    const id = randomUUID();
    return {
      ...comment,
      id,
      createdAt: new Date(),
      orderIndex: comment.orderIndex?.toString() || '0',
    };
  }

  async getBugs(): Promise<Bug[]> { return Array.from(this.bugs.values()); }
  async getBug(id: string): Promise<Bug | undefined> { return this.bugs.get(id); }
  async createBug(bug: InsertBug): Promise<Bug> {
    const id = randomUUID();
    const newBug: Bug = {
      ...bug,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      reproductionSteps: bug.reproductionSteps || '',
      assignedTo: null,
      resolvedAt: null,
      resolvedBy: null,
      notes: null,
    };
    this.bugs.set(id, newBug);
    return newBug;
  }
  async updateBug(id: string, updates: Partial<Bug>): Promise<Bug | undefined> {
    const existing = this.bugs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.bugs.set(id, updated);
    return updated;
  }

  async getFeatureRequests(): Promise<FeatureRequest[]> { return Array.from(this.featureRequests.values()); }
  async getFeatureRequest(id: string): Promise<FeatureRequest | undefined> { return this.featureRequests.get(id); }
  async createFeatureRequest(request: InsertFeatureRequest): Promise<FeatureRequest> {
    const id = randomUUID();
    const newRequest: FeatureRequest = {
      ...request,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      upvoteCount: 0,
    };
    this.featureRequests.set(id, newRequest);
    return newRequest;
  }
  async updateFeatureRequest(id: string, updates: Partial<FeatureRequest>): Promise<FeatureRequest | undefined> {
    const existing = this.featureRequests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.featureRequests.set(id, updated);
    return updated;
  }

  async addFeatureRequestUpvote(): Promise<{ success: boolean; message: string; data?: any }> {
    return { success: true, message: 'Upvote added' };
  }
  async removeFeatureRequestUpvote(): Promise<{ success: boolean; message: string; data?: any }> {
    return { success: true, message: 'Upvote removed' };
  }
}

export const storage = new MemStorage();