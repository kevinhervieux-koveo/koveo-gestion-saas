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
  updateOrganization(
    _id: string,
    _updates: Partial<Organization>
  ): Promise<Organization | undefined>;
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
  getContactsByEntity(
    _entityId: string,
    _entity: 'organization' | 'building' | 'residence'
  ): Promise<Contact[]>;
  getContactsForResidence(_residenceId: string): Promise<Array<Contact & { user: User }>>;
  createContact(_contact: InsertContact): Promise<Contact>;
  updateContact(_id: string, _updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(_id: string): Promise<boolean>;

  // Document operations
  getDocuments(_filters?: {
    buildingId?: string;
    residenceId?: string;
    documentType?: string;
    userId?: string;
    userRole?: string;
  }): Promise<Document[]>;
  getDocument(_id: string): Promise<Document | undefined>;
  createDocument(_document: InsertDocument): Promise<Document>;
  updateDocument(_id: string, _updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(_id: string): Promise<boolean>;

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
  updateWorkspaceStatus(
    _component: string,
    _status: Partial<WorkspaceStatus>
  ): Promise<WorkspaceStatus | undefined>;
  getQualityMetrics(): Promise<QualityMetric[]>;
  createQualityMetric(_metric: InsertQualityMetric): Promise<QualityMetric>;
  getFrameworkConfigurations(): Promise<FrameworkConfiguration[]>;
  createFrameworkConfiguration(
    _config: InsertFrameworkConfiguration
  ): Promise<FrameworkConfiguration>;
  updateFrameworkConfiguration(
    _key: string,
    _config: Partial<FrameworkConfiguration>
  ): Promise<FrameworkConfiguration | undefined>;
  getImprovementSuggestions(): Promise<ImprovementSuggestion[]>;
  createImprovementSuggestion(
    _suggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion>;
  updateImprovementSuggestion(
    _id: string,
    _updates: Partial<ImprovementSuggestion>
  ): Promise<ImprovementSuggestion | undefined>;
  getFeatures(): Promise<Feature[]>;
  getFeature(_id: string): Promise<Feature | undefined>;
  createFeature(_feature: InsertFeature): Promise<Feature>;
  updateFeature(_id: string, _updates: Partial<Feature>): Promise<Feature | undefined>;
  getActionableItems(): Promise<ActionableItem[]>;
  createActionableItem(_item: InsertActionableItem): Promise<ActionableItem>;
  updateActionableItem(
    _id: string,
    _updates: Partial<ActionableItem>
  ): Promise<ActionableItem | undefined>;
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
  updateFeatureRequest(
    _id: string,
    _updates: Partial<FeatureRequest>
  ): Promise<FeatureRequest | undefined>;
  addFeatureRequestUpvote(
    _featureRequestId: string,
    _userId: string
  ): Promise<{ success: boolean; message: string; data?: any }>;
  removeFeatureRequestUpvote(
    _featureRequestId: string,
    _userId: string
  ): Promise<{ success: boolean; message: string; data?: any }>;
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
    const preHashedPassword = '$2b$12$MdgAKqapGQDuM.z4QtxH.eJld2LR0fFMSOCiNR4MiLDYzPscRjIO.';

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
    return Array.from(this.users.values()).find((user) => user.email === email);
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
  async getPasswordResetToken(_token: string): Promise<PasswordResetToken | undefined> {
    return undefined;
  }
  async markPasswordResetTokenAsUsed(_tokenId: string): Promise<PasswordResetToken | undefined> {
    return undefined;
  }
  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    return 0;
  }

  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }
  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find((org) => org.name === name);
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
  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | undefined> {
    const existing = this.organizations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.organizations.set(id, updated);
    return updated;
  }
  async getBuildingsByOrganization(orgId: string): Promise<Building[]> {
    return Array.from(this.buildings.values()).filter((b) => b.organizationId === orgId);
  }

  async getBuildings(): Promise<Building[]> {
    return Array.from(this.buildings.values());
  }
  async getBuilding(id: string): Promise<Building | undefined> {
    return this.buildings.get(id);
  }
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
      buildingType: building.buildingType as 'apartment' | 'condo' | 'rental',
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
  async deleteBuilding(id: string): Promise<boolean> {
    return this.buildings.delete(id);
  }

  async getResidences(): Promise<Residence[]> {
    return Array.from(this.residences.values());
  }
  async getResidence(id: string): Promise<Residence | undefined> {
    return this.residences.get(id);
  }
  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return Array.from(this.residences.values()).filter((r) => r.buildingId === buildingId);
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
  async deleteResidence(id: string): Promise<boolean> {
    return this.residences.delete(id);
  }

  async getContacts(): Promise<Contact[]> {
    return [];
  }
  async getContactsByEntity(): Promise<Contact[]> {
    return [];
  }
  async getContactsForResidence(): Promise<Array<Contact & { user: User }>> {
    return [];
  }
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
  async updateContact(): Promise<Contact | undefined> {
    return undefined;
  }
  async deleteContact(): Promise<boolean> {
    return false;
  }

  async getDocuments(_filters?: {
    buildingId?: string;
    residenceId?: string;
    documentType?: string;
    userId?: string;
    userRole?: string;
  }): Promise<Document[]> {
    return [];
  }

  async getDocument(_id: string): Promise<Document | undefined> {
    return undefined;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    return {
      ...doc,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateDocument(_id: string, _updates: Partial<Document>): Promise<Document | undefined> {
    return undefined;
  }

  async deleteDocument(_id: string): Promise<boolean> {
    return false;
  }

  async getPermissions(): Promise<Permission[]> {
    return [];
  }
  async getRolePermissions(): Promise<RolePermission[]> {
    return [];
  }
  async getUserPermissions(): Promise<UserPermission[]> {
    return [];
  }

  async getPillars(): Promise<Pillar[]> {
    return Array.from(this.pillars.values());
  }
  async getPillar(id: string): Promise<Pillar | undefined> {
    return this.pillars.get(id);
  }
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

  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return Array.from(this.workspaceStatuses.values());
  }
  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    return this.workspaceStatuses.get(component);
  }
  async createWorkspaceStatus(status: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    const id = randomUUID();
    const newStatus: WorkspaceStatus = {
      ...status,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workspaceStatuses.set(status.component, newStatus);
    return newStatus;
  }
  async updateWorkspaceStatus(
    component: string,
    updates: Partial<WorkspaceStatus>
  ): Promise<WorkspaceStatus | undefined> {
    const existing = this.workspaceStatuses.get(component);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.workspaceStatuses.set(component, updated);
    return updated;
  }

  async getQualityMetrics(): Promise<QualityMetric[]> {
    return Array.from(this.qualityMetrics.values());
  }
  async createQualityMetric(metric: InsertQualityMetric): Promise<QualityMetric> {
    const id = randomUUID();
    const newMetric: QualityMetric = {
      ...metric,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.qualityMetrics.set(id, newMetric);
    return newMetric;
  }

  async getFrameworkConfigurations(): Promise<FrameworkConfiguration[]> {
    return Array.from(this.frameworkConfigs.values());
  }
  async createFrameworkConfiguration(
    config: InsertFrameworkConfiguration
  ): Promise<FrameworkConfiguration> {
    const id = randomUUID();
    const newConfig: FrameworkConfiguration = {
      ...config,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.frameworkConfigs.set(config._key, newConfig);
    return newConfig;
  }
  async updateFrameworkConfiguration(
    key: string,
    updates: Partial<FrameworkConfiguration>
  ): Promise<FrameworkConfiguration | undefined> {
    const existing = this.frameworkConfigs.get(key);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.frameworkConfigs.set(key, updated);
    return updated;
  }

  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return Array.from(this.improvementSuggestions.values());
  }
  async createImprovementSuggestion(
    suggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion> {
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
  async updateImprovementSuggestion(
    id: string,
    updates: Partial<ImprovementSuggestion>
  ): Promise<ImprovementSuggestion | undefined> {
    const existing = this.improvementSuggestions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.improvementSuggestions.set(id, updated);
    return updated;
  }

  async getFeatures(): Promise<Feature[]> {
    return Array.from(this.features.values());
  }
  async getFeature(id: string): Promise<Feature | undefined> {
    return this.features.get(id);
  }
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

  async getActionableItems(): Promise<ActionableItem[]> {
    return Array.from(this.actionableItems.values());
  }
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
  async updateActionableItem(
    id: string,
    updates: Partial<ActionableItem>
  ): Promise<ActionableItem | undefined> {
    const existing = this.actionableItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.actionableItems.set(id, updated);
    return updated;
  }
  async deleteActionableItem(id: string): Promise<boolean> {
    return this.actionableItems.delete(id);
  }

  async getInvitations(): Promise<Invitation[]> {
    return Array.from(this.invitations.values());
  }
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
    return Array.from(this.invitations.values()).find((inv) => inv.token === token);
  }
  async updateInvitation(
    id: string,
    updates: Partial<Invitation>
  ): Promise<Invitation | undefined> {
    const existing = this.invitations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.invitations.set(id, updated);
    return updated;
  }

  async getInvitationAuditLogs(): Promise<InvitationAuditLog[]> {
    return Array.from(this.invitationAuditLogs.values());
  }
  async createInvitationAuditLog(log: InsertInvitationAuditLog): Promise<InvitationAuditLog> {
    const id = randomUUID();
    const newLog: InvitationAuditLog = { ...log, id, createdAt: new Date() };
    this.invitationAuditLogs.set(id, newLog);
    return newLog;
  }

  async getCommentsByDemand(): Promise<DemandComment[]> {
    return [];
  }
  async createDemandComment(comment: InsertDemandComment): Promise<DemandComment> {
    const id = randomUUID();
    return {
      ...comment,
      id,
      createdAt: new Date(),
      orderIndex: comment.orderIndex?.toString() || '0',
    };
  }

  async getBugs(): Promise<Bug[]> {
    return Array.from(this.bugs.values());
  }
  async getBug(id: string): Promise<Bug | undefined> {
    return this.bugs.get(id);
  }
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

  async getFeatureRequests(): Promise<FeatureRequest[]> {
    return Array.from(this.featureRequests.values());
  }
  async getFeatureRequest(id: string): Promise<FeatureRequest | undefined> {
    return this.featureRequests.get(id);
  }
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
  async updateFeatureRequest(
    id: string,
    updates: Partial<FeatureRequest>
  ): Promise<FeatureRequest | undefined> {
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

// Import the database storage implementation
import { DatabaseStorage } from './db-storage';
import { OptimizedDatabaseStorage } from './optimized-db-storage';

// Production fallback storage - try database first, fall back to memory if authentication fails
class ProductionFallbackStorage implements IStorage {
  private dbStorage: DatabaseStorage;
  private memStorage: MemStorage;
  private usingFallback: boolean = false;

  constructor() {
    this.dbStorage = new DatabaseStorage();
    this.memStorage = new MemStorage();
  }

  private async safeDbOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.usingFallback) {
      throw new Error('Database unavailable, using memory storage');
    }

    try {
      return await operation();
    } catch (error: any) {
      // Check if it's a database authentication error
      if (
        error.message?.includes('password authentication failed') ||
        error.message?.includes('neondb_owner') ||
        error.cause?.message?.includes('password authentication failed')
      ) {
        console.warn(
          '🔄 Database authentication failed, switching to memory storage for production stability'
        );
        this.usingFallback = true;

        // Initialize memory storage with production admin user
        await this.initializeFallbackData();
        throw new Error('Database unavailable, using memory storage');
      }
      throw error;
    }
  }

  private async initializeFallbackData(): Promise<void> {
    // Create the production admin user in memory storage
    const adminUser = {
      id: 'f35647de-5f16-46f2-b30b-09e0469356b1',
      username: 'kevin.hervieux',
      email: 'kevin.hervieux@koveo-gestion.com',
      password: '$2b$12$sAJXEcITZg5ItQou312JsucLyzByPC6lF7CLvrrLkhxKd1EyfSxda', // admin123
      firstName: 'Kevin',
      lastName: 'Hervieux',
      phone: '',
      profileImage: '',
      language: 'fr' as const,
      role: 'admin' as const,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.memStorage.createUser(adminUser);

    // Create default organization for admin user
    const defaultOrg = {
      id: 'koveo-org-main',
      name: 'Koveo Gestion',
      type: 'property_management' as const,
      address: '123 Quebec Street',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1A 1A1',
      phone: '+1-514-555-0100',
      email: 'contact@koveo-gestion.com',
      website: 'https://koveo-gestion.com',
      description: 'Main Koveo property management organization',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.memStorage.createOrganization(defaultOrg);

    // Associate admin user with the organization
    // For memory storage, we'll just ensure the user has access to the organization
    // This is handled by the user's role being 'admin' which gives access to all organizations

    console.log(
      '✅ Production fallback: Admin user and default organization initialized in memory storage'
    );
  }

  // User operations with fallback
  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log('🔍 ProductionFallbackStorage.getUserByEmail called with:', email);
    try {
      const user = await this.safeDbOperation(() => this.dbStorage.getUserByEmail(email));
      console.log('🔍 ProductionFallbackStorage result:', user ? 'FOUND' : 'NOT FOUND');
      return user;
    } catch (error) {
      console.error('🔍 ProductionFallbackStorage error:', error);
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    return await this.safeDbOperation(() => this.dbStorage.getUsers());
  }

  async getUsersByOrganizations(userId: string): Promise<User[]> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getUsersByOrganizations(userId));
    } catch {
      return this.memStorage.getUsersByOrganizations(userId);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return await this.safeDbOperation(() => this.dbStorage.getUser(id));
  }

  async getUserOrganizations(userId: string): Promise<Array<{ organizationId: string }>> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getUserOrganizations(userId));
    } catch {
      return this.memStorage.getUserOrganizations(userId);
    }
  }

  async getUserResidences(userId: string): Promise<Array<{ residenceId: string }>> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getUserResidences(userId));
    } catch {
      return this.memStorage.getUserResidences(userId);
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.createUser(user));
    } catch {
      return this.memStorage.createUser(user);
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    return await this.safeDbOperation(() => this.dbStorage.updateUser(id, updates));
  }

  // Password reset operations
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.createPasswordResetToken(token));
    } catch {
      return this.memStorage.createPasswordResetToken(token);
    }
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getPasswordResetToken(token));
    } catch {
      return this.memStorage.getPasswordResetToken(token);
    }
  }

  async markPasswordResetTokenAsUsed(tokenId: string): Promise<PasswordResetToken | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.markPasswordResetTokenAsUsed(tokenId));
    } catch {
      return this.memStorage.markPasswordResetTokenAsUsed(tokenId);
    }
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.cleanupExpiredPasswordResetTokens());
    } catch {
      return this.memStorage.cleanupExpiredPasswordResetTokens();
    }
  }

  // Delegate all other methods to the appropriate storage
  async getOrganizations(): Promise<Organization[]> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getOrganizations());
    } catch {
      return this.memStorage.getOrganizations();
    }
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getOrganization(id));
    } catch {
      return this.memStorage.getOrganization(id);
    }
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.createOrganization(org));
    } catch {
      return this.memStorage.createOrganization(org);
    }
  }

  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.updateOrganization(id, updates));
    } catch {
      return this.memStorage.updateOrganization(id, updates);
    }
  }

  async deleteOrganization(id: string): Promise<boolean> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.deleteOrganization(id));
    } catch {
      return this.memStorage.deleteOrganization(id);
    }
  }

  // Buildings
  async getBuildings(): Promise<Building[]> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getBuildings());
    } catch {
      return this.memStorage.getBuildings();
    }
  }

  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    try {
      return await this.safeDbOperation(() =>
        this.dbStorage.getBuildingsByOrganization(organizationId)
      );
    } catch {
      return this.memStorage.getBuildingsByOrganization(organizationId);
    }
  }

  async getBuilding(id: string): Promise<Building | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getBuilding(id));
    } catch {
      return this.memStorage.getBuilding(id);
    }
  }

  async createBuilding(building: InsertBuilding): Promise<Building> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.createBuilding(building));
    } catch {
      return this.memStorage.createBuilding(building);
    }
  }

  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.updateBuilding(id, updates));
    } catch {
      return this.memStorage.updateBuilding(id, updates);
    }
  }

  async deleteBuilding(id: string): Promise<boolean> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.deleteBuilding(id));
    } catch {
      return this.memStorage.deleteBuilding(id);
    }
  }

  // Residences
  async getResidences(): Promise<Residence[]> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getResidences());
    } catch {
      return this.memStorage.getResidences();
    }
  }

  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getResidencesByBuilding(buildingId));
    } catch {
      return this.memStorage.getResidencesByBuilding(buildingId);
    }
  }

  async getResidence(id: string): Promise<Residence | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getResidence(id));
    } catch {
      return this.memStorage.getResidence(id);
    }
  }

  async createResidence(residence: InsertResidence): Promise<Residence> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.createResidence(residence));
    } catch {
      return this.memStorage.createResidence(residence);
    }
  }

  async updateResidence(id: string, updates: Partial<Residence>): Promise<Residence | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.updateResidence(id, updates));
    } catch {
      return this.memStorage.updateResidence(id, updates);
    }
  }

  async deleteResidence(id: string): Promise<boolean> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.deleteResidence(id));
    } catch {
      return this.memStorage.deleteResidence(id);
    }
  }

  // All other methods - implement fallback pattern for remaining interface methods
  async getContacts(): Promise<Contact[]> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getContacts());
    } catch {
      return this.memStorage.getContacts();
    }
  }

  async getContact(id: string): Promise<Contact | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.getContact(id));
    } catch {
      return this.memStorage.getContact(id);
    }
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.createContact(contact));
    } catch {
      return this.memStorage.createContact(contact);
    }
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.updateContact(id, updates));
    } catch {
      return this.memStorage.updateContact(id, updates);
    }
  }

  async deleteContact(id: string): Promise<boolean> {
    try {
      return await this.safeDbOperation(() => this.dbStorage.deleteContact(id));
    } catch {
      return this.memStorage.deleteContact(id);
    }
  }

  // Stub implementations for remaining interface methods - add all other required methods
  async getDocuments(): Promise<Document[]> {
    return [];
  }
  async getDocument(id: string): Promise<Document | undefined> {
    return undefined;
  }
  async createDocument(doc: InsertDocument): Promise<Document> {
    throw new Error('Not implemented in fallback');
  }
  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    return undefined;
  }
  async deleteDocument(id: string): Promise<boolean> {
    return false;
  }
  async getDocumentsByBuilding(buildingId: string): Promise<DocumentBuilding[]> {
    return [];
  }
  async createDocumentBuilding(doc: InsertDocumentBuilding): Promise<DocumentBuilding> {
    // Note: External storage integration removed
    const id = randomUUID();
    return {
      ...doc,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async deleteDocumentBuilding(documentId: string, buildingId: string): Promise<boolean> {
    return false;
  }
  async getDocumentsByResident(residentId: string): Promise<DocumentResident[]> {
    return [];
  }
  async createDocumentResident(doc: InsertDocumentResident): Promise<DocumentResident> {
    // Note: External storage integration removed
    const id = randomUUID();
    return {
      ...doc,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async deleteDocumentResident(documentId: string, residentId: string): Promise<boolean> {
    return false;
  }
  async getPillars(): Promise<Pillar[]> {
    return [];
  }
  async getPillar(id: string): Promise<Pillar | undefined> {
    return undefined;
  }
  async createPillar(pillar: InsertPillar): Promise<Pillar> {
    throw new Error('Not implemented in fallback');
  }
  async updatePillar(id: string, updates: Partial<Pillar>): Promise<Pillar | undefined> {
    return undefined;
  }
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return [];
  }
  async getWorkspaceStatus(id: string): Promise<WorkspaceStatus | undefined> {
    return undefined;
  }
  async createWorkspaceStatus(status: InsertWorkspaceStatus): Promise<WorkspaceStatus> {
    throw new Error('Not implemented in fallback');
  }
  async updateWorkspaceStatus(
    id: string,
    updates: Partial<WorkspaceStatus>
  ): Promise<WorkspaceStatus | undefined> {
    return undefined;
  }
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return [];
  }
  async getQualityMetric(id: string): Promise<QualityMetric | undefined> {
    return undefined;
  }
  async createQualityMetric(metric: InsertQualityMetric): Promise<QualityMetric> {
    throw new Error('Not implemented in fallback');
  }
  async updateQualityMetric(
    id: string,
    updates: Partial<QualityMetric>
  ): Promise<QualityMetric | undefined> {
    return undefined;
  }
  async getFrameworkConfigurations(): Promise<FrameworkConfiguration[]> {
    return [];
  }
  async getFrameworkConfiguration(id: string): Promise<FrameworkConfiguration | undefined> {
    return undefined;
  }
  async createFrameworkConfiguration(
    config: InsertFrameworkConfiguration
  ): Promise<FrameworkConfiguration> {
    throw new Error('Not implemented in fallback');
  }
  async updateFrameworkConfiguration(
    id: string,
    updates: Partial<FrameworkConfiguration>
  ): Promise<FrameworkConfiguration | undefined> {
    return undefined;
  }
  async getImprovementSuggestions(): Promise<ImprovementSuggestion[]> {
    return [];
  }
  async getImprovementSuggestion(id: string): Promise<ImprovementSuggestion | undefined> {
    return undefined;
  }
  async createImprovementSuggestion(
    suggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion> {
    throw new Error('Not implemented in fallback');
  }
  async updateImprovementSuggestion(
    id: string,
    updates: Partial<ImprovementSuggestion>
  ): Promise<ImprovementSuggestion | undefined> {
    return undefined;
  }
  async getFeatures(): Promise<Feature[]> {
    return [];
  }
  async getFeature(id: string): Promise<Feature | undefined> {
    return undefined;
  }
  async createFeature(feature: InsertFeature): Promise<Feature> {
    throw new Error('Not implemented in fallback');
  }
  async updateFeature(id: string, updates: Partial<Feature>): Promise<Feature | undefined> {
    return undefined;
  }
  async getActionableItems(): Promise<ActionableItem[]> {
    return [];
  }
  async getActionableItem(id: string): Promise<ActionableItem | undefined> {
    return undefined;
  }
  async createActionableItem(item: InsertActionableItem): Promise<ActionableItem> {
    throw new Error('Not implemented in fallback');
  }
  async updateActionableItem(
    id: string,
    updates: Partial<ActionableItem>
  ): Promise<ActionableItem | undefined> {
    return undefined;
  }
  async getInvitations(): Promise<Invitation[]> {
    return [];
  }
  async getInvitation(id: string): Promise<Invitation | undefined> {
    return undefined;
  }
  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return undefined;
  }
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    throw new Error('Not implemented in fallback');
  }
  async updateInvitation(
    id: string,
    updates: Partial<Invitation>
  ): Promise<Invitation | undefined> {
    return undefined;
  }
  async deleteInvitation(id: string): Promise<boolean> {
    return false;
  }
  async getPermissions(): Promise<Permission[]> {
    return [];
  }
  async getPermission(id: string): Promise<Permission | undefined> {
    return undefined;
  }
  async getRolePermissions(role: string): Promise<RolePermission[]> {
    return [];
  }
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return [];
  }
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    return true;
  } // Admin fallback
  async getBugs(): Promise<Bug[]> {
    return [];
  }
  async getBug(id: string): Promise<Bug | undefined> {
    return undefined;
  }
  async createBug(bug: InsertBug): Promise<Bug> {
    throw new Error('Not implemented in fallback');
  }
  async updateBug(id: string, updates: Partial<Bug>): Promise<Bug | undefined> {
    return undefined;
  }
  async getFeatureRequests(): Promise<FeatureRequest[]> {
    return [];
  }
  async getFeatureRequest(id: string): Promise<FeatureRequest | undefined> {
    return undefined;
  }
  async createFeatureRequest(request: InsertFeatureRequest): Promise<FeatureRequest> {
    throw new Error('Not implemented in fallback');
  }
  async updateFeatureRequest(
    id: string,
    updates: Partial<FeatureRequest>
  ): Promise<FeatureRequest | undefined> {
    return undefined;
  }
  async addFeatureRequestUpvote(
    featureRequestId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    return { success: true, message: 'Fallback mode' };
  }
  async removeFeatureRequestUpvote(
    featureRequestId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    return { success: true, message: 'Fallback mode' };
  }
}

// Always use optimized database storage - no fallbacks
export const storage = new OptimizedDatabaseStorage();
