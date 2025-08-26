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
  permissions,
  rolePermissions,
  userPermissions,
  bugs,
  featureRequests,
  featureRequestUpvotes,
} from '@shared/schema';
import {
  type Demand,
  type InsertDemand,
  type DemandComment,
  type InsertDemandComment,
} from '@shared/schemas/operations';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { hashPassword } from './auth';
import { db } from './db';

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
  /**
   * Retrieves all users from storage.
   *
   * @returns {Promise<User[]>} Array of all user records.
   */
  getUsers(): Promise<User[]>;

  /**
   * Retrieves users from organizations that a specific user has access to.
   *
   * @param {string} _userId - The unique user identifier.
   * @returns {Promise<User[]>} Array of users from accessible organizations.
   */
  getUsersByOrganizations(_userId: string): Promise<User[]>;

  /**
   * Retrieves a specific user by their unique identifier.
   *
   * @param {string} _id - The unique user identifier.
   * @returns {Promise<User | undefined>} User record or undefined if not found.
   */
  getUser(_id: string): Promise<User | undefined>;

  /**
   * Retrieves organizations for a specific user.
   *
   * @param {string} _userId - The unique user identifier.
   * @returns {Promise<Array<{organizationId: string}>>} Array of organization IDs the user belongs to.
   */
  getUserOrganizations(_userId: string): Promise<Array<{ organizationId: string }>>;

  /**
   * Retrieves residences for a specific user.
   *
   * @param {string} _userId - The unique user identifier.
   * @returns {Promise<Array<{residenceId: string}>>} Array of residence IDs the user is associated with.
   */
  getUserResidences(_userId: string): Promise<Array<{ residenceId: string }>>;

  /**
   * Retrieves a user by their email address.
   *
   * @param {string} _email - The user's email address.
   * @returns {Promise<User | undefined>} User record or undefined if not found.
   */
  getUserByEmail(_email: string): Promise<User | undefined>;

  /**
   * Creates a new user in the storage system.
   *
   * @param {InsertUser} _user - User data for creation (excluding auto-generated fields).
   * @returns {Promise<User>} The created user record with generated ID and timestamps.
   */
  createUser(_user: InsertUser): Promise<User>;

  /**
   * Updates an existing user's information.
   *
   * @param {string} _id - The unique user identifier.
   * @param {Partial<User>} _updates - Partial user data containing fields to update.
   * @returns {Promise<User | undefined>} Updated user record or undefined if not found.
   */
  updateUser(_id: string, _updates: Partial<User>): Promise<User | undefined>;

  // Password reset operations
  /**
   * Creates a new password reset token for a user.
   *
   * @param {InsertPasswordResetToken} _token - Token data for creation.
   * @returns {Promise<PasswordResetToken>} The created token record.
   */
  createPasswordResetToken(_token: InsertPasswordResetToken): Promise<PasswordResetToken>;

  /**
   * Retrieves a password reset token by its token string.
   *
   * @param {string} _token - The token string to look up.
   * @returns {Promise<PasswordResetToken | undefined>} Token record or undefined if not found.
   */
  getPasswordResetToken(_token: string): Promise<PasswordResetToken | undefined>;

  /**
   * Marks a password reset token as used.
   *
   * @param {string} _tokenId - The unique token identifier.
   * @returns {Promise<PasswordResetToken | undefined>} Updated token record or undefined if not found.
   */
  markPasswordResetTokenAsUsed(_tokenId: string): Promise<PasswordResetToken | undefined>;

  /**
   * Deletes expired password reset tokens.
   *
   * @returns {Promise<number>} Number of expired tokens deleted.
   */
  cleanupExpiredPasswordResetTokens(): Promise<number>;

  // Organization operations
  /**
   * Retrieves all organizations from storage.
   *
   * @returns {Promise<Organization[]>} Array of all organization records.
   */
  getOrganizations(): Promise<Organization[]>;

  /**
   * Retrieves a specific organization by its unique identifier.
   *
   * @param {string} _id - The unique organization identifier.
   * @returns {Promise<Organization | undefined>} Organization record or undefined if not found.
   */
  getOrganization(_id: string): Promise<Organization | undefined>;

  /**
   * Retrieves an organization by its name.
   *
   * @param {string} _name - The organization's name.
   * @returns {Promise<Organization | undefined>} Organization record or undefined if not found.
   */
  getOrganizationByName(_name: string): Promise<Organization | undefined>;

  /**
   * Creates a new organization in the storage system.
   *
   * @param {InsertOrganization} _organization - Organization data for creation.
   * @returns {Promise<Organization>} The created organization record with generated ID.
   */
  createOrganization(_organization: InsertOrganization): Promise<Organization>;

  /**
   * Updates an existing organization's information.
   *
   * @param {string} _id - The unique organization identifier.
   * @param {Partial<Organization>} _updates - Partial organization data containing fields to update.
   * @returns {Promise<Organization | undefined>} Updated organization record or undefined if not found.
   */
  updateOrganization(
    _id: string,
    _updates: Partial<Organization>
  ): Promise<Organization | undefined>;

  /**
   * Retrieves all buildings belonging to a specific organization.
   *
   * @param {string} _organizationId - The unique organization identifier.
   * @returns {Promise<Building[]>} Array of buildings managed by the organization.
   */
  getBuildingsByOrganization(_organizationId: string): Promise<Building[]>;

  // Building operations
  /**
   * Retrieves all buildings from storage.
   *
   * @returns {Promise<Building[]>} Array of all building records.
   */
  getBuildings(): Promise<Building[]>;

  /**
   * Retrieves a specific building by its unique identifier.
   *
   * @param {string} _id - The unique building identifier.
   * @returns {Promise<Building | undefined>} Building record or undefined if not found.
   */
  getBuilding(_id: string): Promise<Building | undefined>;

  /**
   * Creates a new building in the storage system.
   *
   * @param {InsertBuilding} _building - Building data for creation.
   * @returns {Promise<Building>} The created building record with generated ID.
   */
  createBuilding(_building: InsertBuilding): Promise<Building>;

  /**
   * Updates an existing building's information.
   *
   * @param {string} _id - The unique building identifier.
   * @param {Partial<Building>} _updates - Partial building data containing fields to update.
   * @returns {Promise<Building | undefined>} Updated building record or undefined if not found.
   */
  updateBuilding(_id: string, _updates: Partial<Building>): Promise<Building | undefined>;

  /**
   * Deletes a building from storage.
   *
   * @param {string} _id - The unique building identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteBuilding(_id: string): Promise<boolean>;

  // Residence operations
  /**
   * Retrieves all residences from storage.
   *
   * @returns {Promise<Residence[]>} Array of all residence records.
   */
  getResidences(): Promise<Residence[]>;

  /**
   * Retrieves a specific residence by its unique identifier.
   *
   * @param {string} _id - The unique residence identifier.
   * @returns {Promise<Residence | undefined>} Residence record or undefined if not found.
   */
  getResidence(_id: string): Promise<Residence | undefined>;

  /**
   * Retrieves all residences within a specific building.
   *
   * @param {string} _buildingId - The unique building identifier.
   * @returns {Promise<Residence[]>} Array of residences in the specified building.
   */
  getResidencesByBuilding(_buildingId: string): Promise<Residence[]>;

  /**
   * Creates a new residence in the storage system.
   *
   * @param {InsertResidence} _residence - Residence data for creation.
   * @returns {Promise<Residence>} The created residence record with generated ID.
   */
  createResidence(_residence: InsertResidence): Promise<Residence>;

  /**
   * Updates an existing residence's information.
   *
   * @param {string} _id - The unique residence identifier.
   * @param {Partial<Residence>} _updates - Partial residence data containing fields to update.
   * @returns {Promise<Residence | undefined>} Updated residence record or undefined if not found.
   */
  updateResidence(_id: string, _updates: Partial<Residence>): Promise<Residence | undefined>;

  /**
   * Deletes a residence from storage.
   *
   * @param {string} _id - The unique residence identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteResidence(_id: string): Promise<boolean>;

  // Contact operations
  /**
   * Retrieves all contacts from storage.
   *
   * @returns {Promise<Contact[]>} Array of all contact records.
   */
  getContacts(): Promise<Contact[]>;

  /**
   * Retrieves contacts for a specific entity.
   *
   * @param {string} _entityId - The unique entity identifier.
   * @param {'organization' | 'building' | 'residence'} _entity - The entity type.
   * @returns {Promise<Contact[]>} Array of contacts for the specified entity.
   */
  getContactsByEntity(
    _entityId: string,
    _entity: 'organization' | 'building' | 'residence'
  ): Promise<Contact[]>;

  /**
   * Retrieves contacts for a specific residence with user details.
   *
   * @param {string} _residenceId - The unique residence identifier.
   * @returns {Promise<Array<Contact & { user: User }>>} Array of contacts with user information.
   */
  getContactsForResidence(_residenceId: string): Promise<Array<Contact & { user: User }>>;

  /**
   * Creates a new contact in the storage system.
   *
   * @param {InsertContact} _contact - Contact data for creation.
   * @returns {Promise<Contact>} The created contact record with generated ID.
   */
  createContact(_contact: InsertContact): Promise<Contact>;

  /**
   * Updates an existing contact's information.
   *
   * @param {string} _id - The unique contact identifier.
   * @param {Partial<Contact>} _updates - Partial contact data containing fields to update.
   * @returns {Promise<Contact | undefined>} Updated contact record or undefined if not found.
   */
  updateContact(_id: string, _updates: Partial<Contact>): Promise<Contact | undefined>;

  /**
   * Deletes a contact from storage.
   *
   * @param {string} _id - The unique contact identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteContact(_id: string): Promise<boolean>;

  // Development Pillar operations
  /**
   * Retrieves all development pillars from storage.
   *
   * @returns {Promise<DevelopmentPillar[]>} Array of all development pillar records.
   */
  getPillars(): Promise<DevelopmentPillar[]>;

  /**
   * Retrieves a specific development pillar by its unique identifier.
   *
   * @param {string} _id - The unique pillar identifier.
   * @returns {Promise<DevelopmentPillar | undefined>} Pillar record or undefined if not found.
   */
  getPillar(_id: string): Promise<DevelopmentPillar | undefined>;

  /**
   * Creates a new development pillar in the storage system.
   *
   * @param {InsertPillar} _pillar - Pillar data for creation.
   * @returns {Promise<DevelopmentPillar>} The created pillar record with generated ID.
   */
  createPillar(_pillar: InsertPillar): Promise<DevelopmentPillar>;

  /**
   * Updates an existing development pillar's information.
   *
   * @param {string} _id - The unique pillar identifier.
   * @param {Partial<DevelopmentPillar>} _pillar - Partial pillar data containing fields to update.
   * @returns {Promise<DevelopmentPillar | undefined>} Updated pillar record or undefined if not found.
   */
  updatePillar(
    _id: string,
    _pillar: Partial<DevelopmentPillar>
  ): Promise<DevelopmentPillar | undefined>;

  // Workspace Status operations
  /**
   * Retrieves all workspace component statuses from storage.
   *
   * @returns {Promise<WorkspaceStatus[]>} Array of all workspace status records.
   */
  getWorkspaceStatuses(): Promise<WorkspaceStatus[]>;

  /**
   * Retrieves the status of a specific workspace component.
   *
   * @param {string} _component - The name of the workspace component.
   * @returns {Promise<WorkspaceStatus | undefined>} Status record or undefined if not found.
   */
  getWorkspaceStatus(_component: string): Promise<WorkspaceStatus | undefined>;

  /**
   * Creates a new workspace status record.
   *
   * @param {InsertWorkspaceStatus} _status - Status data for creation.
   * @returns {Promise<WorkspaceStatus>} The created status record.
   */
  createWorkspaceStatus(_status: InsertWorkspaceStatus): Promise<WorkspaceStatus>;

  /**
   * Updates the status of a specific workspace component.
   *
   * @param {string} _component - The name of the workspace component.
   * @param {string} _status - The new status value.
   * @returns {Promise<WorkspaceStatus | undefined>} Updated status record or undefined if not found.
   */
  updateWorkspaceStatus(_component: string, _status: string): Promise<WorkspaceStatus | undefined>;

  // Quality Metrics operations
  /**
   * Retrieves all quality metrics from storage.
   *
   * @returns {Promise<QualityMetric[]>} Array of all quality metric records.
   */
  getQualityMetrics(): Promise<QualityMetric[]>;

  /**
   * Creates a new quality metric record.
   *
   * @param {InsertQualityMetric} _metric - Metric data for creation.
   * @returns {Promise<QualityMetric>} The created quality metric record.
   */
  createQualityMetric(_metric: InsertQualityMetric): Promise<QualityMetric>;

  // Framework Configuration operations
  /**
   * Retrieves all framework configuration records from storage.
   *
   * @returns {Promise<FrameworkConfiguration[]>} Array of all configuration records.
   */
  getFrameworkConfigs(): Promise<FrameworkConfiguration[]>;

  /**
   * Retrieves a specific framework configuration by its key.
   *
   * @param {string} _key - The configuration key identifier.
   * @returns {Promise<FrameworkConfiguration | undefined>} Configuration record or undefined if not found.
   */
  getFrameworkConfig(_key: string): Promise<FrameworkConfiguration | undefined>;

  /**
   * Sets or updates a framework configuration.
   *
   * @param {InsertFrameworkConfig} _config - Configuration data to set.
   * @returns {Promise<FrameworkConfiguration>} The created or updated configuration record.
   */
  setFrameworkConfig(_config: InsertFrameworkConfig): Promise<FrameworkConfiguration>;

  // Improvement Suggestions operations
  /**
   * Retrieves all improvement suggestions from storage.
   *
   * @returns {Promise<ImprovementSuggestion[]>} Array of all improvement suggestion records.
   */
  getImprovementSuggestions(): Promise<ImprovementSuggestion[]>;

  /**
   * Retrieves the top improvement suggestions by priority and creation date.
   *
   * @param {number} _limit - Maximum number of suggestions to return.
   * @returns {Promise<ImprovementSuggestion[]>} Array of top improvement suggestions.
   */
  getTopImprovementSuggestions(_limit: number): Promise<ImprovementSuggestion[]>;

  /**
   * Creates a new improvement suggestion in the storage system.
   *
   * @param {InsertImprovementSuggestion} _suggestion - Suggestion data for creation.
   * @returns {Promise<ImprovementSuggestion>} The created suggestion record with generated ID.
   */
  createImprovementSuggestion(
    _suggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion>;

  /**
   * Clears all suggestions with 'New' status by marking them as acknowledged.
   *
   * @returns {Promise<void>} Promise that resolves when operation is complete.
   */
  clearNewSuggestions(): Promise<void>;

  /**
   * Updates the status of a specific improvement suggestion.
   *
   * @param {string} _id - The unique suggestion identifier.
   * @param {'New' | 'Acknowledged' | 'Done'} _status - The new status to set.
   * @returns {Promise<ImprovementSuggestion | undefined>} Updated suggestion record or undefined if not found.
   */
  updateSuggestionStatus(
    _id: string,
    _status: 'New' | 'Acknowledged' | 'Done'
  ): Promise<ImprovementSuggestion | undefined>;

  // Features operations
  /**
   * Retrieves all features from storage.
   *
   * @returns {Promise<Feature[]>} Array of all feature records.
   */
  getFeatures(): Promise<Feature[]>;

  /**
   * Retrieves features filtered by their development status.
   *
   * @param {'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'} _status - The status to filter by.
   * @returns {Promise<Feature[]>} Array of features with the specified status.
   */
  getFeaturesByStatus(
    _status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'
  ): Promise<Feature[]>;

  /**
   * Retrieves features filtered by their category.
   *
   * @param {string} _category - The category to filter by.
   * @returns {Promise<Feature[]>} Array of features in the specified category.
   */
  getFeaturesByCategory(_category: string): Promise<Feature[]>;

  /**
   * Retrieves features that are visible on the public roadmap.
   *
   * @returns {Promise<Feature[]>} Array of public roadmap features.
   */
  getPublicRoadmapFeatures(): Promise<Feature[]>;

  /**
   * Creates a new feature in the storage system.
   *
   * @param {InsertFeature} _feature - Feature data for creation.
   * @returns {Promise<Feature>} The created feature record with generated ID.
   */
  createFeature(_feature: InsertFeature): Promise<Feature>;

  /**
   * Updates an existing feature's information.
   *
   * @param {string} _id - The unique feature identifier.
   * @param {Partial<InsertFeature>} _updates - Partial feature data containing fields to update.
   * @returns {Promise<Feature | undefined>} Updated feature record or undefined if not found.
   */
  updateFeature(_id: string, _updates: Partial<InsertFeature>): Promise<Feature | undefined>;

  /**
   * Deletes a feature from storage.
   *
   * @param {string} _id - The unique feature identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteFeature(_id: string): Promise<boolean>;

  // Actionable Items operations
  /**
   * Retrieves all actionable items associated with a specific feature.
   *
   * @param {string} _featureId - The unique feature identifier.
   * @returns {Promise<ActionableItem[]>} Array of actionable items for the feature.
   */
  getActionableItemsByFeature(_featureId: string): Promise<ActionableItem[]>;

  /**
   * Retrieves a specific actionable item by its unique identifier.
   *
   * @param {string} _id - The unique actionable item identifier.
   * @returns {Promise<ActionableItem | undefined>} Actionable item record or undefined if not found.
   */
  getActionableItem(_id: string): Promise<ActionableItem | undefined>;

  /**
   * Creates a new actionable item in the storage system.
   *
   * @param {InsertActionableItem} _item - Actionable item data for creation.
   * @returns {Promise<ActionableItem>} The created actionable item record with generated ID.
   */
  createActionableItem(_item: InsertActionableItem): Promise<ActionableItem>;

  /**
   * Creates multiple actionable items in a single operation.
   *
   * @param {InsertActionableItem[]} _items - Array of actionable item data for creation.
   * @returns {Promise<ActionableItem[]>} Array of created actionable item records.
   */
  createActionableItems(_items: InsertActionableItem[]): Promise<ActionableItem[]>;

  /**
   * Updates an existing actionable item's information.
   *
   * @param {string} _id - The unique actionable item identifier.
   * @param {Partial<ActionableItem>} _updates - Partial item data containing fields to update.
   * @returns {Promise<ActionableItem | undefined>} Updated item record or undefined if not found.
   */
  updateActionableItem(
    _id: string,
    _updates: Partial<ActionableItem>
  ): Promise<ActionableItem | undefined>;

  /**
   * Deletes an actionable item from storage.
   *
   * @param {string} _id - The unique actionable item identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteActionableItem(_id: string): Promise<boolean>;

  /**
   * Deletes all actionable items associated with a specific feature.
   *
   * @param {string} _featureId - The unique feature identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteActionableItemsByFeature(_featureId: string): Promise<boolean>;

  // Document operations - Building Documents
  /**
   * Retrieves building documents with role-based filtering for a specific user.
   *
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_buildingIds] - Array of building IDs the user has access to (optional).
   * @returns {Promise<DocumentBuilding[]>} Array of building documents the user can access.
   */
  getBuildingDocumentsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _buildingIds?: string[]
  ): Promise<DocumentBuilding[]>;

  /**
   * Retrieves a specific building document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_buildingIds] - Array of building IDs the user has access to (optional).
   * @returns {Promise<DocumentBuilding | undefined>} Building document record or undefined if not found or access denied.
   */
  getBuildingDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _buildingIds?: string[]
  ): Promise<DocumentBuilding | undefined>;

  /**
   * Creates a new building document in the storage system.
   *
   * @param {InsertDocumentBuilding} _document - Building document data for creation.
   * @returns {Promise<DocumentBuilding>} The created building document record with generated ID and timestamps.
   */
  createBuildingDocument(_document: InsertDocumentBuilding): Promise<DocumentBuilding>;

  /**
   * Updates an existing building document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {Partial<InsertDocumentBuilding>} _updates - Partial document data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<DocumentBuilding | undefined>} Updated building document record or undefined if not found or access denied.
   */
  updateBuildingDocument(
    _id: string,
    _updates: Partial<InsertDocumentBuilding>,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<DocumentBuilding | undefined>;

  /**
   * Deletes a building document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteBuildingDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<boolean>;

  // Document operations - Resident Documents
  /**
   * Retrieves resident documents with role-based filtering for a specific user.
   *
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_residenceIds] - Array of residence IDs the user has access to (optional).
   * @returns {Promise<DocumentResident[]>} Array of resident documents the user can access.
   */
  getResidentDocumentsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _residenceIds?: string[]
  ): Promise<DocumentResident[]>;

  /**
   * Retrieves a specific resident document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_residenceIds] - Array of residence IDs the user has access to (optional).
   * @returns {Promise<DocumentResident | undefined>} Resident document record or undefined if not found or access denied.
   */
  getResidentDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _residenceIds?: string[]
  ): Promise<DocumentResident | undefined>;

  /**
   * Creates a new resident document in the storage system.
   *
   * @param {InsertDocumentResident} _document - Resident document data for creation.
   * @returns {Promise<DocumentResident>} The created resident document record with generated ID and timestamps.
   */
  createResidentDocument(_document: InsertDocumentResident): Promise<DocumentResident>;

  /**
   * Updates an existing resident document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {Partial<InsertDocumentResident>} _updates - Partial document data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<DocumentResident | undefined>} Updated resident document record or undefined if not found or access denied.
   */
  updateResidentDocument(
    _id: string,
    _updates: Partial<InsertDocumentResident>,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<DocumentResident | undefined>;

  /**
   * Deletes a resident document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteResidentDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<boolean>;

  // Legacy Document operations (kept for migration purposes)
  /**
   * Retrieves documents with role-based filtering for a specific user.
   *
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_residenceIds] - Array of residence IDs the user has access to (optional).
   * @returns {Promise<Document[]>} Array of documents the user can access.
   */
  getDocumentsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _residenceIds?: string[]
  ): Promise<Document[]>;

  /**
   * Retrieves a specific document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_residenceIds] - Array of residence IDs the user has access to (optional).
   * @returns {Promise<Document | undefined>} Document record or undefined if not found or access denied.
   */
  getDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _residenceIds?: string[]
  ): Promise<Document | undefined>;

  /**
   * Creates a new document in the storage system.
   *
   * @param {InsertDocument} _document - Document data for creation.
   * @returns {Promise<Document>} The created document record with generated ID and timestamps.
   */
  createDocument(_document: InsertDocument): Promise<Document>;

  /**
   * Updates an existing document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {Partial<InsertDocument>} _updates - Partial document data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<Document | undefined>} Updated document record or undefined if not found or access denied.
   */
  updateDocument(
    _id: string,
    _updates: Partial<InsertDocument>,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<Document | undefined>;

  /**
   * Deletes a document with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<boolean>;

  // Invitation operations
  /**
   * Retrieves all invitations from storage.
   *
   * @returns {Promise<Invitation[]>} Array of all invitation records.
   */
  getInvitations(): Promise<Invitation[]>;

  /**
   * Retrieves a specific invitation by its unique identifier.
   *
   * @param {string} _id - The unique invitation identifier.
   * @returns {Promise<Invitation | undefined>} Invitation record or undefined if not found.
   */
  getInvitation(_id: string): Promise<Invitation | undefined>;

  /**
   * Retrieves an invitation by its secure token.
   *
   * @param {string} _token - The invitation token.
   * @returns {Promise<Invitation | undefined>} Invitation record or undefined if not found.
   */
  getInvitationByToken(_token: string): Promise<Invitation | undefined>;

  /**
   * Retrieves all invitations for a specific email address.
   *
   * @param {string} _email - The email address to search for.
   * @returns {Promise<Invitation[]>} Array of invitations for the email.
   */
  getInvitationsByEmail(_email: string): Promise<Invitation[]>;

  /**
   * Retrieves all invitations sent by a specific user.
   *
   * @param {string} _userId - The unique user identifier of the inviter.
   * @returns {Promise<Invitation[]>} Array of invitations sent by the user.
   */
  getInvitationsByInviter(_userId: string): Promise<Invitation[]>;

  /**
   * Retrieves all invitations filtered by their status.
   *
   * @param {'pending' | 'accepted' | 'expired' | 'cancelled'} _status - The status to filter by.
   * @returns {Promise<Invitation[]>} Array of invitations with the specified status.
   */
  getInvitationsByStatus(
    _status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  ): Promise<Invitation[]>;

  /**
   * Creates a new invitation with secure token generation.
   *
   * @param {InsertInvitation} _invitation - Invitation data for creation.
   * @returns {Promise<Invitation>} The created invitation record with generated token and security data.
   */
  createInvitation(_invitation: InsertInvitation): Promise<Invitation>;

  /**
   * Updates an existing invitation's information.
   *
   * @param {string} _id - The unique invitation identifier.
   * @param {Partial<Invitation>} _updates - Partial invitation data containing fields to update.
   * @returns {Promise<Invitation | undefined>} Updated invitation record or undefined if not found.
   */
  updateInvitation(_id: string, _updates: Partial<Invitation>): Promise<Invitation | undefined>;

  /**
   * Accepts an invitation by its token and creates a new user account.
   *
   * @param {string} _token - The invitation token.
   * @param {object} _userData - User account data for the new user.
   * @param {string} _ipAddress - IP address of the user accepting the invitation.
   * @param {string} _userAgent - Browser/client information.
   * @returns {Promise<{ user: User; invitation: Invitation } | null>} Created user and updated invitation or null if invalid.
   */
  acceptInvitation(
    _token: string,
    _userData: { firstName: string; lastName: string; password: string },
    _ipAddress?: string,
    _userAgent?: string
  ): Promise<{ user: User; invitation: Invitation } | null>;

  /**
   * Cancels an invitation by setting its status to cancelled.
   *
   * @param {string} _id - The unique invitation identifier.
   * @param {string} _cancelledBy - User ID of who cancelled the invitation.
   * @returns {Promise<Invitation | undefined>} Updated invitation record or undefined if not found.
   */
  cancelInvitation(_id: string, _cancelledBy: string): Promise<Invitation | undefined>;

  /**
   * Expires all invitations that have passed their expiry date.
   *
   * @returns {Promise<number>} Number of invitations that were expired.
   */
  expireInvitations(): Promise<number>;

  /**
   * Deletes an invitation from storage.
   *
   * @param {string} _id - The unique invitation identifier.
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise.
   */
  deleteInvitation(_id: string): Promise<boolean>;

  // Invitation Audit Log operations
  /**
   * Retrieves all audit log entries for a specific invitation.
   *
   * @param {string} _invitationId - The unique invitation identifier.
   * @returns {Promise<InvitationAuditLog[]>} Array of audit log entries for the invitation.
   */
  getInvitationAuditLogs(_invitationId: string): Promise<InvitationAuditLog[]>;

  /**
   * Creates a new invitation audit log entry.
   *
   * @param {InsertInvitationAuditLog} _logEntry - Audit log data for creation.
   * @returns {Promise<InvitationAuditLog>} The created audit log entry.
   */
  createInvitationAuditLog(_logEntry: InsertInvitationAuditLog): Promise<InvitationAuditLog>;

  // Permission operations
  /**
   * Retrieves all permissions from storage.
   *
   * @returns {Promise<Permission[]>} Array of all permission records.
   */
  getPermissions(): Promise<Permission[]>;

  /**
   * Retrieves all role-permission associations from storage.
   *
   * @returns {Promise<RolePermission[]>} Array of all role-permission records.
   */
  getRolePermissions(): Promise<RolePermission[]>;

  /**
   * Retrieves all user-specific permission overrides from storage.
   *
   * @returns {Promise<UserPermission[]>} Array of all user-permission records.
   */
  getUserPermissions(): Promise<UserPermission[]>;

  // Document operations
  /**
   * Retrieves all documents with role-based filtering.
   *
   * @param {string} _userId - The requesting user's ID.
   * @param {string} _userRole - The user's role (admin, manager, tenant, resident).
   * @param {string} [_organizationId] - User's organization ID for filtering.
   * @param {string[]} [_residenceIds] - User's residence IDs for filtering.
   * @returns {Promise<Document[]>} Array of documents the user can access.
   */
  getDocumentsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _residenceIds?: string[]
  ): Promise<Document[]>;

  /**
   * Retrieves a specific document by its unique identifier with permission check.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The requesting user's ID.
   * @param {string} _userRole - The user's role for permission checking.
   * @param {string} [_organizationId] - User's organization ID for filtering.
   * @param {string[]} [_residenceIds] - User's residence IDs for filtering.
   * @returns {Promise<Document | undefined>} Document record or undefined if not found/accessible.
   */
  getDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _residenceIds?: string[]
  ): Promise<Document | undefined>;

  /**
   * Creates a new document in the storage system.
   *
   * @param {InsertDocument} _document - Document data for creation.
   * @returns {Promise<Document>} The created document record with generated ID.
   */
  createDocument(_document: InsertDocument): Promise<Document>;

  /**
   * Updates an existing document's information.
   *
   * @param {string} _id - The unique document identifier.
   * @param {Partial<InsertDocument>} _updates - Partial document data containing fields to update.
   * @param {string} _userId - The requesting user's ID for permission checking.
   * @param {string} _userRole - The user's role for permission checking.
   * @param {string} [_organizationId] - User's organization ID for permission checking.
   * @returns {Promise<Document | undefined>} Updated document record or undefined if not found/accessible.
   */
  updateDocument(
    _id: string,
    _updates: Partial<InsertDocument>,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<Document | undefined>;

  /**
   * Deletes a document from the storage system.
   *
   * @param {string} _id - The unique document identifier.
   * @param {string} _userId - The requesting user's ID for permission checking.
   * @param {string} _userRole - The user's role for permission checking.
   * @param {string} [_organizationId] - User's organization ID for permission checking.
   * @returns {Promise<boolean>} True if document was deleted, false if not found/accessible.
   */
  deleteDocument(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<boolean>;

  // Demand operations
  /**
   * Retrieves demands with role-based filtering for a specific user.
   *
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_buildingIds] - Array of building IDs the user has access to (optional).
   * @param {string[]} [_residenceIds] - Array of residence IDs the user has access to (optional).
   * @returns {Promise<Demand[]>} Array of demands the user can access.
   */
  getDemandsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _buildingIds?: string[],
    _residenceIds?: string[]
  ): Promise<Demand[]>;

  /**
   * Retrieves a specific demand with permission check.
   *
   * @param {string} _id - The unique demand identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @param {string[]} [_buildingIds] - Array of building IDs the user has access to (optional).
   * @param {string[]} [_residenceIds] - Array of residence IDs the user has access to (optional).
   * @returns {Promise<Demand | undefined>} Demand record or undefined if not found or access denied.
   */
  getDemand(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _buildingIds?: string[],
    _residenceIds?: string[]
  ): Promise<Demand | undefined>;

  /**
   * Creates a new demand in the storage system.
   *
   * @param {InsertDemand} _demand - Demand data for creation.
   * @returns {Promise<Demand>} The created demand record with generated ID and timestamps.
   */
  createDemand(_demand: InsertDemand): Promise<Demand>;

  /**
   * Updates an existing demand with permission check.
   *
   * @param {string} _id - The unique demand identifier.
   * @param {Partial<Demand>} _updates - Partial demand data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<Demand | undefined>} Updated demand record or undefined if not found or access denied.
   */
  updateDemand(
    _id: string,
    _updates: Partial<Demand>,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<Demand | undefined>;

  /**
   * Deletes a demand with permission check.
   *
   * @param {string} _id - The unique demand identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteDemand(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<boolean>;

  // Demand Comment operations
  /**
   * Retrieves comments for a specific demand.
   *
   * @param {string} _demandId - The unique demand identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<DemandComment[]>} Array of demand comments ordered by creation time.
   */
  getDemandComments(
    _demandId: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<DemandComment[]>;

  /**
   * Creates a new comment on a demand.
   *
   * @param {InsertDemandComment} _comment - Comment data for creation.
   * @returns {Promise<DemandComment>} The created comment record with generated ID and timestamps.
   */
  createDemandComment(_comment: InsertDemandComment): Promise<DemandComment>;

  /**
   * Updates an existing demand comment with permission check.
   *
   * @param {string} _id - The unique comment identifier.
   * @param {Partial<DemandComment>} _updates - Partial comment data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @returns {Promise<DemandComment | undefined>} Updated comment record or undefined if not found or access denied.
   */
  updateDemandComment(
    _id: string,
    _updates: Partial<DemandComment>,
    _userId: string,
    _userRole: string
  ): Promise<DemandComment | undefined>;

  /**
   * Deletes a demand comment with permission check.
   *
   * @param {string} _id - The unique comment identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteDemandComment(_id: string, _userId: string, _userRole: string): Promise<boolean>;

  // Bug operations
  /**
   * Retrieves bugs based on user role and permissions.
   * Residents/tenants see only their own bugs.
   * Managers see bugs from their organization.
   * Admins see all bugs.
   *
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<Bug[]>} Array of bugs the user can access.
   */
  getBugsForUser(_userId: string, _userRole: string, _organizationId?: string): Promise<Bug[]>;

  /**
   * Retrieves a specific bug with permission check.
   *
   * @param {string} _id - The unique bug identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<Bug | undefined>} Bug record or undefined if not found or access denied.
   */
  getBug(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<Bug | undefined>;

  /**
   * Creates a new bug report.
   *
   * @param {InsertBug} _bug - Bug data for creation.
   * @returns {Promise<Bug>} The created bug record with generated ID and timestamps.
   */
  createBug(_bug: InsertBug): Promise<Bug>;

  /**
   * Updates an existing bug with permission check.
   * Only admins and managers can update bugs.
   *
   * @param {string} _id - The unique bug identifier.
   * @param {Partial<Bug>} _updates - Partial bug data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @returns {Promise<Bug | undefined>} Updated bug record or undefined if not found or access denied.
   */
  updateBug(
    _id: string,
    _updates: Partial<Bug>,
    _userId: string,
    _userRole: string
  ): Promise<Bug | undefined>;

  /**
   * Deletes a bug with permission check.
   * Only admins can delete bugs.
   *
   * @param {string} _id - The unique bug identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteBug(_id: string, _userId: string, _userRole: string): Promise<boolean>;

  // Feature Request operations
  /**
   * Retrieves feature requests based on user role and organization access.
   *
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<FeatureRequest[]>} Array of feature requests the user can access.
   */
  getFeatureRequestsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<FeatureRequest[]>;

  /**
   * Retrieves a specific feature request with permission check.
   *
   * @param {string} _id - The unique feature request identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @param {string} [_organizationId] - The user's organization ID (optional).
   * @returns {Promise<FeatureRequest | undefined>} Feature request record or undefined if not found or access denied.
   */
  getFeatureRequest(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<FeatureRequest | undefined>;

  /**
   * Creates a new feature request.
   *
   * @param {InsertFeatureRequest} _featureRequest - Feature request data for creation.
   * @returns {Promise<FeatureRequest>} The created feature request record with generated ID and timestamps.
   */
  createFeatureRequest(_featureRequest: InsertFeatureRequest): Promise<FeatureRequest>;

  /**
   * Updates an existing feature request with permission check.
   * Only admins can update feature requests.
   *
   * @param {string} _id - The unique feature request identifier.
   * @param {Partial<FeatureRequest>} _updates - Partial feature request data containing fields to update.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @returns {Promise<FeatureRequest | undefined>} Updated feature request record or undefined if not found or access denied.
   */
  updateFeatureRequest(
    _id: string,
    _updates: Partial<FeatureRequest>,
    _userId: string,
    _userRole: string
  ): Promise<FeatureRequest | undefined>;

  /**
   * Deletes a feature request with permission check.
   * Only admins can delete feature requests.
   *
   * @param {string} _id - The unique feature request identifier.
   * @param {string} _userId - The unique user identifier.
   * @param {string} _userRole - The user's role (admin, manager, resident, tenant).
   * @returns {Promise<boolean>} True if deletion was successful, false if not found or access denied.
   */
  deleteFeatureRequest(_id: string, _userId: string, _userRole: string): Promise<boolean>;

  /**
   * Upvotes a feature request.
   *
   * @param {InsertFeatureRequestUpvote} _upvote - Upvote data for creation.
   * @returns {Promise<{success: boolean; message: string; data?: any}>} Result object with success status and data.
   */
  upvoteFeatureRequest(
    _upvote: InsertFeatureRequestUpvote
  ): Promise<{ success: boolean; message: string; data?: any }>;

  /**
   * Removes an upvote from a feature request.
   *
   * @param {string} _featureRequestId - The unique feature request identifier.
   * @param {string} _userId - The unique user identifier.
   * @returns {Promise<{success: boolean; message: string; data?: any}>} Result object with success status and data.
   */
  removeFeatureRequestUpvote(
    _featureRequestId: string,
    _userId: string
  ): Promise<{ success: boolean; message: string; data?: any }>;
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
  private actionableItems: Map<string, ActionableItem>;
  private invitations: Map<string, Invitation>;
  private invitationAuditLogs: Map<string, InvitationAuditLog>;
  private organizations: Map<string, Organization>;
  private buildings: Map<string, Building>;
  private residences: Map<string, Residence>;
  private documents: Map<string, Document>;
  private bugs: Map<string, Bug>;
  private featureRequests: Map<string, FeatureRequest>;
  private featureRequestUpvotes: Map<string, FeatureRequestUpvote>;

  /**
   * Creates a new MemStorage instance with empty storage maps.
   * No mock data is initialized - production ready.
   */
  constructor() {
    this.users = new Map();
    this.pillars = new Map();
    this.workspaceStatuses = new Map();
    this.qualityMetrics = new Map();
    this.frameworkConfigs = new Map();
    this.improvementSuggestions = new Map();
    this.features = new Map();
    this.actionableItems = new Map();
    this.invitations = new Map();
    this.invitationAuditLogs = new Map();
    this.organizations = new Map();
    this.buildings = new Map();
    this.residences = new Map();
    this.documents = new Map();
    this.bugs = new Map();
    this.featureRequests = new Map();
    this.featureRequestUpvotes = new Map();

    // Storage initialized empty - no mock data
  }

  // Permission operations
  /**
   * Retrieves all permissions from storage.
   */
  async getPermissions(): Promise<Permission[]> {
    try {
      const result = await this.db.select().from(permissions);
      return result;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }
  }

  /**
   * Retrieves all role-specific permission mappings from storage.
   */
  async getRolePermissions(): Promise<RolePermission[]> {
    try {
      const result = await this.db
        .select({
          id: rolePermissions.id,
          role: rolePermissions.role,
          permissionId: rolePermissions.permissionId,
          createdAt: rolePermissions.createdAt,
          permission: {
            id: permissions.id,
            name: permissions.name,
            displayName: permissions.displayName,
            description: permissions.description,
            resourceType: permissions.resourceType,
            action: permissions.action,
            isActive: permissions.isActive,
            createdAt: permissions.createdAt,
          },
        })
        .from(rolePermissions)
        .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

      return result;
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      return [];
    }
  }

  /**
   * Retrieves all user-specific permission overrides from storage.
   */
  async getUserPermissions(): Promise<UserPermission[]> {
    try {
      const result = await this.db
        .select({
          id: userPermissions.id,
          userId: userPermissions.userId,
          permissionId: userPermissions.permissionId,
          granted: userPermissions.granted,
          grantedBy: userPermissions.grantedBy,
          reason: userPermissions.reason,
          grantedAt: userPermissions.grantedAt,
          createdAt: userPermissions.createdAt,
          permission: {
            id: permissions.id,
            name: permissions.name,
            displayName: permissions.displayName,
            description: permissions.description,
            resourceType: permissions.resourceType,
            action: permissions.action,
            isActive: permissions.isActive,
            createdAt: permissions.createdAt,
          },
        })
        .from(userPermissions)
        .leftJoin(permissions, eq(userPermissions.permissionId, permissions.id));

      return result;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  }

  // User operations
  /**
   * Retrieves all users from storage.
   *
   * @returns {Promise<User[]>} Array of all user records.
   *
   * @example
   * ```typescript
   * const users = await storage.getUsers();
   * console.warn(`Found ${users.length} users`);
   * ```
   */
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByOrganizations(_userId: string): Promise<User[]> {
    // In memory storage: return empty array for non-admin users
    return [];
  }

  /**
   * Retrieves a specific user by ID.
   *
   * @param {string} id - The unique identifier of the user.
   * @returns {Promise<User | undefined>} The user record or undefined if not found.
   *
   * @example
   * ```typescript
   * const user = await storage.getUser('user-123');
   * if (user) {
   *   console.warn(`User: ${user.email}`);
   * }
   * ```
   */
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * Finds a user by their email address.
   *
   * @param {string} email - The email address to search for.
   * @returns {Promise<User | undefined>} The user record or undefined if not found.
   *
   * @example
   * ```typescript
   * const user = await storage.getUserByEmail('john@example.com');
   * if (user) {
   *   console.warn(`Found user: ${user.name}`);
   * }
   * ```
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }

  /**
   * Updates an existing user with partial data.
   *
   * @param {string} id - The unique identifier of the user to update.
   * @param {Partial<User>} updates - Partial user data to update.
   * @returns {Promise<User | undefined>} The updated user record or undefined if not found.
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

  /**
   * Retrieves organizations for a specific user.
   *
   * @param {string} userId - The unique user identifier.
   * @returns {Promise<Array<{organizationId: string}>>} Array of organization IDs the user belongs to.
   */
  async getUserOrganizations(userId: string): Promise<Array<{ organizationId: string }>> {
    const user = this.users.get(userId);
    if (!user) {
      return [];
    }
    // User type doesn't have organizationId property in current schema
    // Return empty array for now
    return [];
  }

  /**
   * Retrieves residences for a specific user.
   *
   * @param {string} userId - The unique user identifier.
   * @returns {Promise<Array<{residenceId: string}>>} Array of residence IDs the user is associated with.
   */
  async getUserResidences(userId: string): Promise<Array<{ residenceId: string }>> {
    const user = this.users.get(userId);
    if (!user) {
      return [];
    }
    // User type doesn't have assignedResidenceId property in current schema
    // Return empty array for now
    return [];
  }

  // Organization operations
  /**
   * Retrieves all organizations from storage.
   *
   * @returns {Promise<Organization[]>} Array of all organization records.
   *
   * @example
   * ```typescript
   * const orgs = await storage.getOrganizations();
   * console.warn(`Managing ${orgs.length} organizations`);
   * ```
   */
  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  /**
   * Retrieves a specific organization by ID.
   *
   * @param {string} id - The unique identifier of the organization.
   * @returns {Promise<Organization | undefined>} The organization record or undefined if not found.
   *
   * @example
   * ```typescript
   * const org = await storage.getOrganization('org-456');
   * if (org) {
   *   console.warn(`Organization: ${org.name} in ${org.city}`);
   * }
   * ```
   */
  async getOrganization(id: string): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }

  /**
   * Finds an organization by its name.
   *
   * @param {string} name - The name of the organization to search for.
   * @returns {Promise<Organization | undefined>} The organization record or undefined if not found.
   *
   * @example
   * ```typescript
   * const org = await storage.getOrganizationByName('ABC Property Management');
   * if (org) {
   *   console.warn(`Found organization with ID: ${org.id}`);
   * }
   * ```
   */
  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find((org) => org.name === name);
  }

  /**
   * Creates a new organization with automatic ID generation and default values.
   *
   * @param {InsertOrganization} insertOrganization - Organization data to create.
   * @returns {Promise<Organization>} The newly created organization record.
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

  /**
   * Updates an existing organization with partial data.
   *
   * @param {string} id - The unique identifier of the organization to update.
   * @param {Partial<Organization>} updates - Partial organization data to update.
   * @returns {Promise<Organization | undefined>} The updated organization record or undefined if not found.
   *
   * @example
   * ```typescript
   * const updatedOrg = await storage.updateOrganization('org-456', {
   *   phone: '+1-514-555-9999',
   *   website: 'https://newsite.ca'
   * });
   * ```
   */
  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization | undefined> {
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

  /**
   * Retrieves all buildings managed by a specific organization.
   *
   * @param {string} organizationId - The unique identifier of the organization.
   * @returns {Promise<Building[]>} Array of buildings managed by the organization.
   *
   * @example
   * ```typescript
   * const buildings = await storage.getBuildingsByOrganization('org-456');
   * console.warn(`Organization manages ${buildings.length} buildings`);
   * ```
   */
  async getBuildingsByOrganization(organizationId: string): Promise<Building[]> {
    return Array.from(this.buildings.values()).filter(
      (building) => building.organizationId === organizationId
    );
  }

  // Building operations
  /**
   * Retrieves all buildings from storage.
   *
   * @returns {Promise<Building[]>} Array of all building records.
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

  /**
   * Retrieves a specific building by ID.
   *
   * @param {string} id - The unique identifier of the building.
   * @returns {Promise<Building | undefined>} The building record or undefined if not found.
   *
   * @example
   * ```typescript
   * const building = await storage.getBuilding('bldg-789');
   * if (building) {
   *   console.warn(`Building: ${building.name} has ${building.totalUnits} units`);
   * }
   * ```
   */
  async getBuilding(id: string): Promise<Building | undefined> {
    return this.buildings.get(id);
  }

  /**
   * Creates a new building with automatic ID generation and Quebec defaults.
   *
   * @param {InsertBuilding} insertBuilding - Building data to create.
   * @returns {Promise<Building>} The newly created building record.
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
      buildingType: insertBuilding.buildingType ?? (null as 'condo' | 'rental' | null),
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

  /**
   * Updates an existing building with partial data.
   *
   * @param {string} id - The unique identifier of the building to update.
   * @param {Partial<Building>} updates - Partial building data to update.
   * @returns {Promise<Building | undefined>} The updated building record or undefined if not found.
   *
   * @example
   * ```typescript
   * const updatedBuilding = await storage.updateBuilding('bldg-789', {
   *   totalUnits: 150,
   *   amenities: ['pool', 'gym', 'parking']
   * });
   * ```
   */
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

  /**
   * Performs a soft delete on a building by setting isActive to false.
   * Maintains data integrity while marking the building as inactive.
   *
   * @param {string} id - The unique identifier of the building to delete.
   * @returns {Promise<boolean>} True if the building was successfully deleted, false if not found.
   *
   * @example
   * ```typescript
   * const deleted = await storage.deleteBuilding('bldg-789');
   * if (deleted) {
   *   console.warn('Building successfully deactivated');
   * }
   * ```
   */
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
  /**
   * Retrieves all residences from storage.
   *
   * @returns {Promise<Residence[]>} Array of all residence records.
   *
   * @example
   * ```typescript
   * const residences = await storage.getResidences();
   * const activeResidences = residences.filter(r => r.isActive);
   * console.warn(`Found ${activeResidences.length} active residences`);
   * ```
   */
  async getResidences(): Promise<Residence[]> {
    return Array.from(this.residences.values());
  }

  /**
   * Retrieves a specific residence by ID.
   *
   * @param {string} id - The unique identifier of the residence.
   * @returns {Promise<Residence | undefined>} The residence record or undefined if not found.
   *
   * @example
   * ```typescript
   * const residence = await storage.getResidence('res-123');
   * if (residence) {
   *   console.warn(`Unit ${residence.unitNumber}: ${residence.bedrooms} bed, ${residence.bathrooms} bath`);
   * }
   * ```
   */
  async getResidence(id: string): Promise<Residence | undefined> {
    return this.residences.get(id);
  }

  /**
   * Retrieves all residences within a specific building.
   *
   * @param {string} buildingId - The unique identifier of the building.
   * @returns {Promise<Residence[]>} Array of residences in the building.
   *
   * @example
   * ```typescript
   * const residences = await storage.getResidencesByBuilding('bldg-789');
   * console.warn(`Building has ${residences.length} residential units`);
   * const vacantUnits = residences.filter(r => !r.isOccupied);
   * ```
   */
  async getResidencesByBuilding(buildingId: string): Promise<Residence[]> {
    return Array.from(this.residences.values()).filter(
      (residence) => residence.buildingId === buildingId
    );
  }

  /**
   * Creates a new residence with automatic ID generation and default values.
   *
   * @param {InsertResidence} insertResidence - Residence data to create.
   * @returns {Promise<Residence>} The newly created residence record.
   *
   * @example
   * ```typescript
   * const residence = await storage.createResidence({
   *   buildingId: 'bldg-789',
   *   unitNumber: '4B',
   *   floor: 4,
   *   bedrooms: 2,
   *   bathrooms: 1.5,
   *   squareFootage: '850.00',
   *   monthlyFees: '450.00'
   * });
   * ```
   */
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
      parkingSpaceNumbers: insertResidence.parkingSpaceNumbers ?? (null as string[] | null),
      storageSpaceNumbers: insertResidence.storageSpaceNumbers ?? (null as string[] | null),
      ownershipPercentage: insertResidence.ownershipPercentage ?? null,
      monthlyFees: insertResidence.monthlyFees ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.residences.set(id, residence);
    return residence;
  }

  /**
   * Updates an existing residence with partial data.
   *
   * @param {string} id - The unique identifier of the residence to update.
   * @param {Partial<Residence>} updates - Partial residence data to update.
   * @returns {Promise<Residence | undefined>} The updated residence record or undefined if not found.
   *
   * @example
   * ```typescript
   * const updatedResidence = await storage.updateResidence('res-123', {
   *   monthlyFees: '475.00',
   *   balcony: true
   * });
   * ```
   */
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

  /**
   * Performs a soft delete on a residence by setting isActive to false.
   * Maintains data integrity while marking the residence as inactive.
   *
   * @param {string} id - The unique identifier of the residence to delete.
   * @returns {Promise<boolean>} True if the residence was successfully deleted, false if not found.
   *
   * @example
   * ```typescript
   * const deleted = await storage.deleteResidence('res-123');
   * if (deleted) {
   *   console.warn('Residence successfully deactivated');
   * }
   * ```
   */
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
   * @param {InsertUser} insertUser - User data to create.
   * @returns {Promise<User>} The newly created user record.
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
      role: (insertUser.role || 'tenant') as 'admin' | 'manager' | 'tenant' | 'resident',
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
   * @returns {Promise<DevelopmentPillar[]>} Array of development pillars sorted by order.
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

  /**
   * Retrieves a specific development pillar by ID.
   *
   * @param {string} id - The unique identifier of the development pillar.
   * @returns {Promise<DevelopmentPillar | undefined>} The pillar record or undefined if not found.
   *
   * @example
   * ```typescript
   * const pillar = await storage.getPillar('pillar-1');
   * if (pillar) {
   *   console.warn(`Pillar: ${pillar.name} - Status: ${pillar.status}`);
   * }
   * ```
   */
  async getPillar(id: string): Promise<DevelopmentPillar | undefined> {
    return this.pillars.get(id);
  }

  /**
   * Creates a new development pillar for system framework tracking.
   *
   * @param {InsertPillar} insertPillar - Pillar data to create.
   * @returns {Promise<DevelopmentPillar>} The newly created pillar record.
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

  /**
   * Updates an existing development pillar with partial data.
   *
   * @param {string} id - The unique identifier of the pillar to update.
   * @param {Partial<DevelopmentPillar>} updates - Partial pillar data to update.
   * @returns {Promise<DevelopmentPillar | undefined>} The updated pillar record or undefined if not found.
   *
   * @example
   * ```typescript
   * const updatedPillar = await storage.updatePillar('pillar-1', {
   *   status: 'complete',
   *   configuration: { completedAt: new Date() }
   * });
   * ```
   */
  async updatePillar(
    id: string,
    updates: Partial<DevelopmentPillar>
  ): Promise<DevelopmentPillar | undefined> {
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
  /**
   * Retrieves all workspace component statuses for development tracking.
   *
   * @returns {Promise<WorkspaceStatus[]>} Array of all workspace status records.
   *
   * @example
   * ```typescript
   * const statuses = await storage.getWorkspaceStatuses();
   * const completedComponents = statuses.filter(s => s.status === 'complete');
   * console.warn(`${completedComponents.length} components completed`);
   * ```
   */
  async getWorkspaceStatuses(): Promise<WorkspaceStatus[]> {
    return Array.from(this.workspaceStatuses.values());
  }

  /**
   * Retrieves the status of a specific workspace component.
   *
   * @param {string} component - The name of the workspace component.
   * @returns {Promise<WorkspaceStatus | undefined>} The workspace status record or undefined if not found.
   *
   * @example
   * ```typescript
   * const status = await storage.getWorkspaceStatus('TypeScript Configuration');
   * if (status) {
   *   console.warn(`Component status: ${status.status}`);
   * }
   * ```
   */
  async getWorkspaceStatus(component: string): Promise<WorkspaceStatus | undefined> {
    return this.workspaceStatuses.get(component);
  }

  /**
   * Creates a new workspace status record for component tracking.
   *
   * @param {InsertWorkspaceStatus} insertStatus - Workspace status data to create.
   * @returns {Promise<WorkspaceStatus>} The newly created workspace status record.
   *
   * @example
   * ```typescript
   * const status = await storage.createWorkspaceStatus({
   *   component: 'Database Setup',
   *   status: 'in-progress'
   * });
   * ```
   */
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

  /**
   *
   */
  async updateWorkspaceStatus(
    component: string,
    statusValue: string
  ): Promise<WorkspaceStatus | undefined> {
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
  /**
   *
   */
  async getQualityMetrics(): Promise<QualityMetric[]> {
    return Array.from(this.qualityMetrics.values());
  }

  /**
   *
   */
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
  /**
   *
   */
  async getFrameworkConfigs(): Promise<FrameworkConfiguration[]> {
    return Array.from(this.frameworkConfigs.values());
  }

  /**
   *
   */
  async getFrameworkConfig(_key: string): Promise<FrameworkConfiguration | undefined> {
    return this.frameworkConfigs.get(_key);
  }

  /**
   *
   */
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
   * @returns {Promise<ImprovementSuggestion[]>} Array of all improvement suggestions.
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

  /**
   *
   */
  async getTopImprovementSuggestions(limit: number): Promise<ImprovementSuggestion[]> {
    const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };

    return Array.from(this.improvementSuggestions.values())
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
   * Creates a new improvement suggestion from quality analysis results.
   *
   * @param {InsertImprovementSuggestion} insertSuggestion - Suggestion data to create.
   * @returns {Promise<ImprovementSuggestion>} The newly created suggestion record.
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
  async createImprovementSuggestion(
    insertSuggestion: InsertImprovementSuggestion
  ): Promise<ImprovementSuggestion> {
    const id = randomUUID();
    const suggestion: ImprovementSuggestion = {
      ...insertSuggestion,
      status: (insertSuggestion.status || 'New') as 'New' | 'Acknowledged' | 'Done',
      filePath: insertSuggestion.filePath || null,
      id,
      createdAt: new Date(),
    };
    this.improvementSuggestions.set(id, suggestion);
    return suggestion;
  }

  /**
   *
   */
  async clearNewSuggestions(): Promise<void> {
    const toDelete: string[] = [];
    this.improvementSuggestions.forEach((suggestion, id) => {
      if (suggestion.status === 'New') {
        toDelete.push(id);
      }
    });
    toDelete.forEach((id) => this.improvementSuggestions.delete(id));
  }

  /**
   *
   */
  async updateSuggestionStatus(
    id: string,
    status: 'New' | 'Acknowledged' | 'Done'
  ): Promise<ImprovementSuggestion | undefined> {
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
   * @returns {Promise<Feature[]>} Array of all feature records.
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

  /**
   *
   */
  async getFeaturesByStatus(
    status: 'completed' | 'in-progress' | 'planned' | 'cancelled' | 'requested'
  ): Promise<Feature[]> {
    return Array.from(this.features.values()).filter((feature) => feature.status === status);
  }

  /**
   *
   */
  async getFeaturesByCategory(category: string): Promise<Feature[]> {
    return Array.from(this.features.values()).filter((feature) => feature.category === category);
  }

  /**
   *
   */
  async getPublicRoadmapFeatures(): Promise<Feature[]> {
    return Array.from(this.features.values()).filter((feature) => feature.isPublicRoadmap === true);
  }

  /**
   * Creates a new feature for the product roadmap with defaults.
   *
   * @param {InsertFeature} insertFeature - Feature data to create.
   * @returns {Promise<Feature>} The newly created feature record.
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
      status: (insertFeature.status || 'planned') as
        | 'submitted'
        | 'planned'
        | 'in-progress'
        | 'ai-analyzed'
        | 'completed'
        | 'cancelled',
      priority: (insertFeature.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      isPublicRoadmap: insertFeature.isPublicRoadmap ?? true,
      requestedBy: insertFeature.requestedBy || null,
      assignedTo: insertFeature.assignedTo || null,
      estimatedHours: insertFeature.estimatedHours || null,
      actualHours: null,
      startDate: insertFeature.startDate || null,
      completedDate: insertFeature.completedDate || null,
      tags: insertFeature.tags || null,
      metadata: insertFeature.metadata || null,
      // AI analysis fields
      aiAnalysisResult: null,
      aiAnalyzedAt: null,
      // Strategic path flag
      isStrategicPath: false,
      // Synchronization tracking
      syncedAt: null,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.features.set(id, feature);
    return feature;
  }

  /**
   * Updates an existing feature with partial data.
   *
   * @param {string} id - The unique identifier of the feature to update.
   * @param {Partial<InsertFeature>} updates - Partial feature data to update.
   * @returns {Promise<Feature | undefined>} The updated feature record or undefined if not found.
   *
   * @example
   * ```typescript
   * const updatedFeature = await storage.updateFeature('feat-456', {
   *   status: 'in-progress',
   *   assignedTo: 'dev-123'
   * });
   * ```
   */
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

  /**
   * Deletes a feature and all associated actionable items.
   * Performs a complete removal from storage.
   *
   * @param {string} id - The unique identifier of the feature to delete.
   * @returns {Promise<boolean>} True if the feature was successfully deleted.
   *
   * @example
   * ```typescript
   * const deleted = await storage.deleteFeature('feat-456');
   * if (deleted) {
   *   console.warn('Feature and related items deleted successfully');
   * }
   * ```
   */
  async deleteFeature(id: string): Promise<boolean> {
    // Also delete associated actionable items
    await this.deleteActionableItemsByFeature(id);
    return this.features.delete(id);
  }

  // Actionable Items
  /**
   * Retrieves all actionable items for a specific feature, sorted by order index.
   *
   * @param {string} featureId - The unique identifier of the feature.
   * @returns {Promise<ActionableItem[]>} Array of actionable items sorted by order index.
   *
   * @example
   * ```typescript
   * const items = await storage.getActionableItemsByFeature('feat-456');
   * console.warn(`Feature has ${items.length} actionable items`);
   * ```
   */
  async getActionableItemsByFeature(featureId: string): Promise<ActionableItem[]> {
    return Array.from(this.actionableItems.values())
      .filter((item) => item.featureId === featureId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  /**
   * Retrieves a specific actionable item by ID.
   *
   * @param {string} id - The unique identifier of the actionable item.
   * @returns {Promise<ActionableItem | undefined>} The actionable item record or undefined if not found.
   *
   * @example
   * ```typescript
   * const item = await storage.getActionableItem('item-789');
   * if (item) {
   *   console.warn(`Item: ${item.title} - Status: ${item.status}`);
   * }
   * ```
   */
  async getActionableItem(id: string): Promise<ActionableItem | undefined> {
    return this.actionableItems.get(id);
  }

  /**
   * Creates a new actionable item with automatic ID generation.
   *
   * @param {InsertActionableItem} item - Actionable item data to create.
   * @returns {Promise<ActionableItem>} The newly created actionable item record.
   *
   * @example
   * ```typescript
   * const item = await storage.createActionableItem({
   *   featureId: 'feat-456',
   *   title: 'Update user interface',
   *   description: 'Modify UI for new feature',
   *   orderIndex: 1
   * });
   * ```
   */
  async createActionableItem(item: InsertActionableItem): Promise<ActionableItem> {
    const id = randomUUID();
    const newItem: ActionableItem = {
      id,
      ...item,
      actualHours: null,
      assignedTo: item.assignedTo || null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ActionableItem;
    this.actionableItems.set(id, newItem);
    return newItem;
  }

  /**
   * Creates multiple actionable items in batch.
   *
   * @param {InsertActionableItem[]} items - Array of actionable item data to create.
   * @returns {Promise<ActionableItem[]>} Array of newly created actionable item records.
   *
   * @example
   * ```typescript
   * const items = await storage.createActionableItems([
   *   { featureId: 'feat-456', title: 'Task 1', orderIndex: 1 },
   *   { featureId: 'feat-456', title: 'Task 2', orderIndex: 2 }
   * ]);
   * ```
   */
  async createActionableItems(items: InsertActionableItem[]): Promise<ActionableItem[]> {
    const created: ActionableItem[] = [];
    for (const item of items) {
      const newItem = await this.createActionableItem(item);
      created.push(newItem);
    }
    return created;
  }

  /**
   * Updates an existing actionable item with partial data.
   *
   * @param {string} id - The unique identifier of the actionable item to update.
   * @param {Partial<ActionableItem>} updates - Partial actionable item data to update.
   * @returns {Promise<ActionableItem | undefined>} The updated actionable item record or undefined if not found.
   *
   * @example
   * ```typescript
   * const updatedItem = await storage.updateActionableItem('item-789', {
   *   status: 'completed',
   *   completedAt: new Date()
   * });
   * ```
   */
  async updateActionableItem(
    id: string,
    updates: Partial<ActionableItem>
  ): Promise<ActionableItem | undefined> {
    const existing = this.actionableItems.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.actionableItems.set(id, updated);
    return updated;
  }

  /**
   * Deletes a specific actionable item.
   *
   * @param {string} id - The unique identifier of the actionable item to delete.
   * @returns {Promise<boolean>} True if the item was successfully deleted.
   *
   * @example
   * ```typescript
   * const deleted = await storage.deleteActionableItem('item-789');
   * if (deleted) {
   *   console.warn('Actionable item deleted successfully');
   * }
   * ```
   */
  async deleteActionableItem(id: string): Promise<boolean> {
    return this.actionableItems.delete(id);
  }

  /**
   * Deletes all actionable items associated with a feature.
   *
   * @param {string} featureId - The unique identifier of the feature.
   * @returns {Promise<boolean>} True if all items were successfully deleted.
   *
   * @example
   * ```typescript
   * const deleted = await storage.deleteActionableItemsByFeature('feat-456');
   * if (deleted) {
   *   console.warn('All feature actionable items deleted');
   * }
   * ```
   */
  async deleteActionableItemsByFeature(featureId: string): Promise<boolean> {
    const items = await this.getActionableItemsByFeature(featureId);
    for (const item of items) {
      this.actionableItems.delete(item.id);
    }
    return true;
  }

  // Invitation operations

  /**
   * Retrieves all invitations.
   */
  async getInvitations(): Promise<Invitation[]> {
    return Array.from(this.invitations.values());
  }

  /**
   * Retrieves a specific invitation by ID.
   * @param id
   */
  async getInvitation(id: string): Promise<Invitation | undefined> {
    return this.invitations.get(id);
  }

  /**
   * Retrieves an invitation by its token.
   * @param token
   */
  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    return Array.from(this.invitations.values()).find((invitation) => invitation.token === token);
  }

  /**
   * Retrieves invitations by email.
   * @param email
   */
  async getInvitationsByEmail(email: string): Promise<Invitation[]> {
    return Array.from(this.invitations.values()).filter((invitation) => invitation.email === email);
  }

  /**
   * Retrieves invitations by inviter.
   * @param userId
   */
  async getInvitationsByInviter(userId: string): Promise<Invitation[]> {
    return Array.from(this.invitations.values()).filter(
      (invitation) => invitation.invitedByUserId === userId
    );
  }

  /**
   * Retrieves invitations by status.
   * @param status
   */
  async getInvitationsByStatus(
    status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  ): Promise<Invitation[]> {
    return Array.from(this.invitations.values()).filter(
      (invitation) => invitation.status === status
    );
  }

  /**
   * Creates a new invitation.
   * @param invitation
   */
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const id = randomUUID();
    const token = randomUUID();
    const newInvitation: Invitation = {
      id,
      ...invitation,
      token,
      tokenHash: 'temp-hash',
      status: 'pending',
      usageCount: 0,
      maxUsageCount: 1,
      acceptedAt: null,
      acceptedByUserId: null,
      lastAccessedAt: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Invitation;
    this.invitations.set(id, newInvitation);
    return newInvitation;
  }

  /**
   * Updates an invitation.
   * @param id
   * @param updates
   */
  async updateInvitation(
    id: string,
    updates: Partial<Invitation>
  ): Promise<Invitation | undefined> {
    const existing = this.invitations.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.invitations.set(id, updated);
    return updated;
  }

  /**
   * Accepts an invitation.
   * @param token
   * @param userData
   * @param ipAddress
   * @param userAgent
   */
  async acceptInvitation(
    token: string,
    userData: { firstName: string; lastName: string; password: string },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; invitation: Invitation } | null> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation || invitation.status !== 'pending') {
      return null;
    }

    // Create user
    const user = await this.createUser({
      email: invitation.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
      username: invitation.email, // Use email as username
      role: invitation.role,
      language: 'fr', // Default language
      // organizationId not supported in current User schema
    });

    // Update invitation
    const updatedInvitation = await this.updateInvitation(invitation.id, {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedBy: user.id,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return { user, invitation: updatedInvitation! };
  }

  /**
   * Cancels an invitation.
   * @param id
   * @param cancelledBy
   */
  async cancelInvitation(id: string, cancelledBy: string): Promise<Invitation | undefined> {
    return this.updateInvitation(id, {
      status: 'cancelled',
    });
  }

  /**
   * Expires old invitations.
   */
  async expireInvitations(): Promise<number> {
    const now = new Date();
    const expiredInvitations = Array.from(this.invitations.values()).filter(
      (invitation) => invitation.status === 'pending' && invitation.expiresAt <= now
    );

    for (const invitation of expiredInvitations) {
      await this.updateInvitation(invitation.id, { status: 'expired' });
    }

    return expiredInvitations.length;
  }

  /**
   * Deletes an invitation.
   * @param id
   */
  async deleteInvitation(id: string): Promise<boolean> {
    return this.invitations.delete(id);
  }

  // Invitation Audit Log operations

  /**
   * Gets invitation audit logs.
   * @param invitationId
   */
  async getInvitationAuditLogs(invitationId: string): Promise<InvitationAuditLog[]> {
    return Array.from(this.invitationAuditLogs.values())
      .filter((log) => log.invitationId === invitationId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  /**
   * Creates invitation audit log.
   * @param logEntry
   */
  async createInvitationAuditLog(logEntry: InsertInvitationAuditLog): Promise<InvitationAuditLog> {
    const id = randomUUID();
    const newLog: InvitationAuditLog = {
      id,
      ...logEntry,
      createdAt: new Date(),
    } as InvitationAuditLog;
    this.invitationAuditLogs.set(id, newLog);
    return newLog;
  }

  // Document operations - Memory storage implementation

  /**
   * Retrieves documents with role-based filtering.
   */
  async getDocumentsForUser(
    userId: string,
    userRole: string,
    organizationId?: string,
    residenceIds?: string[]
  ): Promise<Document[]> {
    const allDocuments = Array.from(this.documents.values());

    return allDocuments.filter((doc) => {
      // Admin and Manager can see all documents
      if (userRole === 'admin' || userRole === 'manager') {
        return true;
      }

      // Resident can see building and residence documents
      if (userRole === 'resident') {
        return doc.buildings || doc.residence;
      }

      // Tenant can only see documents marked as visible to tenants
      if (userRole === 'tenant') {
        return doc.tenant;
      }

      return false;
    });
  }

  /**
   * Retrieves a specific document with permission check.
   */
  async getDocument(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string,
    residenceIds?: string[]
  ): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) {
      return undefined;
    }

    const accessibleDocs = await this.getDocumentsForUser(
      userId,
      userRole,
      organizationId,
      residenceIds
    );
    return accessibleDocs.find((doc) => doc.id === id);
  }

  /**
   * Creates a new document.
   */
  async createDocument(document: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const newDocument: Document = {
      id,
      name: document.name,
      type: document.type,
      tenant: document.tenant ?? false,
      residence: document.residence ?? false,
      buildings: document.buildings ?? false,
      uploadDate: new Date(),
      dateReference: document.dateReference || new Date(),
    };
    this.documents.set(id, newDocument);
    return newDocument;
  }

  /**
   * Updates an existing document with permission check.
   */
  async updateDocument(
    id: string,
    updates: Partial<InsertDocument>,
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) {
      return undefined;
    }

    // Admin and Manager can edit any document
    if (userRole === 'admin' || userRole === 'manager') {
      // Allow editing
    } else {
      // Resident and Tenant cannot edit documents in simplified model
      return undefined;
    }

    const updatedDocument = {
      ...document,
      ...updates,
    };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  /**
   * Deletes a document with permission check.
   */
  async deleteDocument(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<boolean> {
    const document = this.documents.get(id);
    if (!document) {
      return false;
    }

    // Admin and Manager can delete any document
    if (userRole === 'admin' || userRole === 'manager') {
      return this.documents.delete(id);
    } else {
      // Resident and Tenant cannot delete documents in simplified model
      return false;
    }
  }

  // Password reset operations - Memory storage implementation
  private passwordResetTokens = new Map<string, PasswordResetToken>();

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = randomUUID();
    const newToken: PasswordResetToken = {
      id,
      ...token,
      isUsed: false,
      usedAt: null,
      createdAt: new Date(),
    } as PasswordResetToken;
    this.passwordResetTokens.set(id, newToken);
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return Array.from(this.passwordResetTokens.values()).find((t) => t.token === token);
  }

  async markPasswordResetTokenAsUsed(tokenId: string): Promise<PasswordResetToken | undefined> {
    const token = this.passwordResetTokens.get(tokenId);
    if (!token) {
      return undefined;
    }

    const updatedToken = {
      ...token,
      isUsed: true,
      usedAt: new Date(),
    };
    this.passwordResetTokens.set(tokenId, updatedToken);
    return updatedToken;
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const now = new Date();
    const expiredTokens = Array.from(this.passwordResetTokens.entries()).filter(
      ([_, token]) => token.expiresAt <= now
    );

    expiredTokens.forEach(([id, _]) => {
      this.passwordResetTokens.delete(id);
    });

    return expiredTokens.length;
  }

  // Demand operations (stub implementation)
  async getDemandsForUser(
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _buildingIds?: string[],
    _residenceIds?: string[]
  ): Promise<Demand[]> {
    // Return empty array for now
    return [];
  }

  async getDemand(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string,
    _buildingIds?: string[],
    _residenceIds?: string[]
  ): Promise<Demand | undefined> {
    // Return undefined for now
    return undefined;
  }

  async createDemand(_demand: InsertDemand): Promise<Demand> {
    // Create a simple mock implementation
    const demand = {
      id: randomUUID(),
      ..._demand,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Demand;

    return demand;
  }

  async updateDemand(
    _id: string,
    _updates: Partial<Demand>,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<Demand | undefined> {
    // Return undefined for now
    return undefined;
  }

  async deleteDemand(
    _id: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<boolean> {
    // Return false for now
    return false;
  }

  // Demand Comment operations (stub implementation)
  async getDemandComments(
    _demandId: string,
    _userId: string,
    _userRole: string,
    _organizationId?: string
  ): Promise<DemandComment[]> {
    // Return empty array for now
    return [];
  }

  async createDemandComment(_comment: InsertDemandComment): Promise<DemandComment> {
    // Create a simple mock implementation
    const comment = {
      id: randomUUID(),
      ..._comment,
      createdAt: new Date(),
    } as DemandComment;

    return comment;
  }

  async updateDemandComment(
    _id: string,
    _updates: Partial<DemandComment>,
    _userId: string,
    _userRole: string
  ): Promise<DemandComment | undefined> {
    // Return undefined for now
    return undefined;
  }

  async deleteDemandComment(_id: string, _userId: string, _userRole: string): Promise<boolean> {
    // Return false for now
    return false;
  }

  // Bug operations implementation
  async getBugsForUser(userId: string, userRole: string, organizationId?: string): Promise<Bug[]> {
    const allBugs = Array.from(this.bugs.values());

    if (userRole === 'admin') {
      return allBugs;
    }

    if (userRole === 'manager' && organizationId) {
      // For managers, return bugs from users in their organization
      const orgUsers = Array.from(this.users.values()).filter((user) => {
        // Assuming users have organizationId - might need to be adjusted based on schema
        return true; // For now, return all bugs for managers
      });
      return allBugs;
    }

    // For residents and tenants, return only their own bugs
    return allBugs.filter((bug) => bug.createdBy === userId);
  }

  async getBug(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<Bug | undefined> {
    const bug = this.bugs.get(id);
    if (!bug) {
      return undefined;
    }

    if (userRole === 'admin') {
      return bug;
    }

    if (userRole === 'manager') {
      return bug; // Managers can see all bugs for now
    }

    // Residents and tenants can only see their own bugs
    return bug.createdBy === userId ? bug : undefined;
  }

  async createBug(bugData: InsertBug): Promise<Bug> {
    const id = randomUUID();
    const now = new Date();

    const bug: Bug = {
      id,
      ...bugData,
      status: 'new',
      assignedTo: null,
      resolvedAt: null,
      resolvedBy: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    this.bugs.set(id, bug);
    return bug;
  }

  async updateBug(
    id: string,
    updates: Partial<Bug>,
    userId: string,
    userRole: string
  ): Promise<Bug | undefined> {
    const bug = this.bugs.get(id);
    if (!bug) {
      return undefined;
    }

    // Only admins and managers can update bugs
    if (userRole !== 'admin' && userRole !== 'manager') {
      return undefined;
    }

    const updatedBug: Bug = {
      ...bug,
      ...updates,
      updatedAt: new Date(),
    };

    this.bugs.set(id, updatedBug);
    return updatedBug;
  }

  async deleteBug(id: string, userId: string, userRole: string): Promise<boolean> {
    const bug = this.bugs.get(id);
    if (!bug) {
      return false;
    }

    // Only admins can delete bugs
    if (userRole !== 'admin') {
      return false;
    }

    this.bugs.delete(id);
    return true;
  }

  // Feature Request operations implementation
  async getFeatureRequestsForUser(
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<FeatureRequest[]> {
    const allFeatureRequests = Array.from(this.featureRequests.values());

    // All users can see all feature requests, but admin role determines if they can see who submitted
    if (userRole === 'admin') {
      return allFeatureRequests;
    }

    // For non-admin users, hide the createdBy field by setting it to null in the returned data
    return allFeatureRequests.map((request) => ({
      ...request,
      createdBy: userRole === 'admin' ? request.createdBy : (null as any),
    }));
  }

  async getFeatureRequest(
    id: string,
    userId: string,
    userRole: string,
    organizationId?: string
  ): Promise<FeatureRequest | undefined> {
    const featureRequest = this.featureRequests.get(id);
    if (!featureRequest) {
      return undefined;
    }

    // All users can see any feature request
    if (userRole === 'admin') {
      return featureRequest;
    }

    // For non-admin users, hide the createdBy field
    return {
      ...featureRequest,
      createdBy: null as any,
    };
  }

  async createFeatureRequest(featureRequestData: InsertFeatureRequest): Promise<FeatureRequest> {
    const id = randomUUID();
    const now = new Date();

    const featureRequest: FeatureRequest = {
      id,
      ...featureRequestData,
      status: 'submitted',
      upvoteCount: 0,
      assignedTo: null,
      reviewedBy: null,
      reviewedAt: null,
      adminNotes: null,
      mergedIntoId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.featureRequests.set(id, featureRequest);
    return featureRequest;
  }

  async updateFeatureRequest(
    id: string,
    updates: Partial<FeatureRequest>,
    userId: string,
    userRole: string
  ): Promise<FeatureRequest | undefined> {
    const featureRequest = this.featureRequests.get(id);
    if (!featureRequest) {
      return undefined;
    }

    // Only admins can update feature requests
    if (userRole !== 'admin') {
      return undefined;
    }

    const updatedFeatureRequest: FeatureRequest = {
      ...featureRequest,
      ...updates,
      updatedAt: new Date(),
    };

    this.featureRequests.set(id, updatedFeatureRequest);
    return updatedFeatureRequest;
  }

  async deleteFeatureRequest(id: string, userId: string, userRole: string): Promise<boolean> {
    const featureRequest = this.featureRequests.get(id);
    if (!featureRequest) {
      return false;
    }

    // Only admins can delete feature requests
    if (userRole !== 'admin') {
      return false;
    }

    // Also delete all upvotes for this feature request
    const upvotesToDelete = Array.from(this.featureRequestUpvotes.entries())
      .filter(([_, upvote]) => upvote.featureRequestId === id)
      .map(([upvoteId, _]) => upvoteId);

    upvotesToDelete.forEach((upvoteId) => {
      this.featureRequestUpvotes.delete(upvoteId);
    });

    this.featureRequests.delete(id);
    return true;
  }

  async upvoteFeatureRequest(
    upvoteData: InsertFeatureRequestUpvote
  ): Promise<{ success: boolean; message: string; data?: any }> {
    const { featureRequestId, userId } = upvoteData;

    // Check if feature request exists
    const featureRequest = this.featureRequests.get(featureRequestId);
    if (!featureRequest) {
      return {
        success: false,
        message: 'Feature request not found',
      };
    }

    // Check if user has already upvoted this feature request
    const existingUpvote = Array.from(this.featureRequestUpvotes.values()).find(
      (upvote) => upvote.featureRequestId === featureRequestId && upvote.userId === userId
    );

    if (existingUpvote) {
      return {
        success: false,
        message: 'You have already upvoted this feature request',
      };
    }

    // Create the upvote
    const upvoteId = randomUUID();
    const upvote: FeatureRequestUpvote = {
      id: upvoteId,
      ...upvoteData,
      createdAt: new Date(),
    };

    this.featureRequestUpvotes.set(upvoteId, upvote);

    // Update the upvote count on the feature request
    const updatedFeatureRequest: FeatureRequest = {
      ...featureRequest,
      upvoteCount: featureRequest.upvoteCount + 1,
      updatedAt: new Date(),
    };

    this.featureRequests.set(featureRequestId, updatedFeatureRequest);

    return {
      success: true,
      message: 'Feature request upvoted successfully',
      data: {
        upvote,
        featureRequest: updatedFeatureRequest,
      },
    };
  }

  async removeFeatureRequestUpvote(
    featureRequestId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    // Check if feature request exists
    const featureRequest = this.featureRequests.get(featureRequestId);
    if (!featureRequest) {
      return {
        success: false,
        message: 'Feature request not found',
      };
    }

    // Find the upvote to remove
    const upvoteEntry = Array.from(this.featureRequestUpvotes.entries()).find(
      ([_, upvote]) => upvote.featureRequestId === featureRequestId && upvote.userId === userId
    );

    if (!upvoteEntry) {
      return {
        success: false,
        message: 'You have not upvoted this feature request',
      };
    }

    const [upvoteId, upvote] = upvoteEntry;

    // Remove the upvote
    this.featureRequestUpvotes.delete(upvoteId);

    // Update the upvote count on the feature request
    const updatedFeatureRequest: FeatureRequest = {
      ...featureRequest,
      upvoteCount: Math.max(0, featureRequest.upvoteCount - 1),
      updatedAt: new Date(),
    };

    this.featureRequests.set(featureRequestId, updatedFeatureRequest);

    return {
      success: true,
      message: 'Upvote removed successfully',
      data: {
        featureRequest: updatedFeatureRequest,
      },
    };
  }
}

// Use database storage if DATABASE_URL is set, otherwise use in-memory storage
import { OptimizedDatabaseStorage } from './optimized-db-storage';

// Use OptimizedDatabaseStorage for persistent storage with performance enhancements
export const storage = process.env.DATABASE_URL ? new OptimizedDatabaseStorage() : new MemStorage();
