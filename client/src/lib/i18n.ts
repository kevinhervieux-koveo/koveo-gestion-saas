/**
 * Supported languages for the Quebec property management platform.
 * Provides bilingual support as required by Quebec regulations.
 */
export type Language = 'en' | 'fr';

/**
 * Translation keys interface for multilingual support.
 * Defines all translatable text keys used throughout the application.
 * Supports Quebec's bilingual requirements with French and English translations.
 */
export interface Translations {
  dashboard: string;
  pillarFramework: string;
  qualityAssurance: string;
  workflowSetup: string;
  configuration: string;
  developer: string;
  frameworkAdmin: string;
  developmentFrameworkInitialization: string;
  settingUpPillarMethodology: string;
  workspaceActive: string;
  saveProgress: string;
  initializationProgress: string;
  frameworkSetup: string;
  pillarCreation: string;
  qualityTools: string;
  testingSetup: string;
  validation: string;
  frameworkConfiguration: string;
  recommended: string;
  selected: string;
  database: string;
  auth: string;
  pillarMethodology: string;
  validationQAPillar: string;
  coreQualityAssurance: string;
  inProgress: string;
  testingPillar: string;
  automatedTestingFramework: string;
  pending: string;
  securityPillar: string;
  law25ComplianceFramework: string;
  workspaceStatus: string;
  environmentSetup: string;
  complete: string;
  dependenciesInstallation: string;
  typeScriptConfiguration: string;
  qualityMetrics: string;
  codeCoverage: string;
  codeQuality: string;
  securityIssues: string;
  buildTime: string;
  translationCoverage: string;
  responseTime: string;
  memoryUsage: string;
  bundleSize: string;
  dbQueryTime: string;
  pageLoadTime: string;
  nextActions: string;
  initializeQAPillar: string;
  setupValidationQualityAssurance: string;
  configureTesting: string;
  continuousImprovementPillar: string;
  documentationPillar: string;
  documentationDescription: string;
  activePillar: string;
  systemHealth: string;
  completedToday: string;
  activeSuggestions: string;
  healthy: string;
  suggestions: string;
  availableAfterQACompletion: string;
  developmentConsole: string;
  accessDenied: string;
  activateUsers: string;
  activateSelectedUsers: string;
  deactivateUsers: string;
  deactivateSelectedUsers: string;
  changeRole: string;
  changeRoleSelectedUsers: string;
  sendPasswordReset: string;
  sendPasswordResetSelectedUsers: string;
  sendWelcomeEmail: string;
  sendWelcomeEmailSelectedUsers: string;
  exportUsers: string;
  exportSelectedUsersData: string;
  deleteUsers: string;
  deleteSelectedUsers: string;
  users: string;
  usersSelected: string;
  bulkActions: string;
  moreActions: string;
  newRole: string;
  selectRole: string;
  admin: string;
  manager: string;
  tenant: string;
  resident: string;
  applyRoleChange: string;
  thisActionCannotBeUndone: string;
  cancel: string;
  processing: string;
  confirm: string;
  inviteUser: string;
  inviteUserDescription: string;
  singleInvitation: string;
  bulkInvitations: string;
  emailAddress: string;
  enterEmailAddress: string;
  role: string;
  organization: string;
  optional: string;
  selectOrganization: string;
  expiresIn: string;
  day: string;
  days: string;
  securityLevel: string;
  standard: string;
  high: string;
  require2FA: string;
  require2FADescription: string;
  personalMessage: string;
  personalMessagePlaceholder: string;
  personalMessageDescription: string;
  bulkPersonalMessagePlaceholder: string;
  sendInvitation: string;
  sendInvitations: string;
  sending: string;
  emailAddresses: string;
  addEmailAddress: string;
  invitationSent: string;
  invitationSentSuccessfully: string;
  bulkInvitationsSent: string;
  bulkInvitationsResult: string;
  bulkInvitationsSuccess: string;
  _error: string;
  bulkActionSuccess: string;
  bulkActionSuccessDescription: string;
  reminderSent: string;
  reminderSentDescription: string;
  errorLoadingData: string;
  tryAgain: string;
  noUsersSelected: string;
  selectUsersForBulkAction: string;
  totalUsers: string;
  activeUsers: string;
  pendingInvitations: string;
  totalInvitations: string;
  userManagement: string;
  manageUsersInvitationsRoles: string;
  searchUsersInvitations: string;
  filterByRole: string;
  filterByCategory: string;
  allRoles: string;
  filterByStatus: string;
  allStatuses: string;
  active: string;
  inactive: string;
  expired: string;
  invitations: string;
  invitationSentDescription: string;
  userUpdated: string;
  userUpdatedSuccessfully: string;
  editUser: string;
  status: string;
  activeUser: string;
  updating: string;
  updateUser: string;
  userDeleted: string;
  userDeletedSuccessfully: string;
  passwordResetSent: string;
  passwordResetEmailSent: string;
  cannotDeleteOwnAccount: string;
  never: string;
  usersList: string;
  user: string;
  selectAllUsers: string;
  lastLogin: string;
  joinedDate: string;
  userActions: string;
  actions: string;
  resetPassword: string;
  deactivateUser: string;
  activateUser: string;
  deleteUser: string;
  noUsersFound: string;
  editUserDescription: string;
  confirmDeleteUser: string;
  selectedUsers: string;
  selectUser: string;
  invitationCancelled: string;
  invitationCancelledSuccessfully: string;
  invitationResent: string;
  invitationResentSuccessfully: string;
  linkCopied: string;
  invitationLinkCopied: string;
  accepted: string;
  cancelled: string;
  expiringsSoon: string;
  invitationsList: string;
  refresh: string;
  recipient: string;
  invited: string;
  expires: string;
  invitedBy: string;
  system: string;
  invitationActions: string;
  copyLink: string;
  openLink: string;
  sendReminder: string;
  resendInvitation: string;
  cancelInvitation: string;
  noInvitationsFound: string;
  cancelInvitationConfirmation: string;
  cancelling: string;
  daysRemaining: string;
  hoursRemaining: string;
  formStatus: string;
  formType: string;
  building: string;
  allBuildings: string;
  searchDemands: string;
  title: string;
  vendor: string;
  category: string;
  selectCategory: string;
  billTitle: string;
  companyOrServiceProvider: string;
  selectPaymentType: string;
  selectSchedule: string;
  billingSchedule: string;
  selectStatus: string;
  loadingDemands: string;
  searchDemandsUsers: string;
  submitAndTrack: string;
  reviewDemand: string;
  failedToReviewDemand: string;
  error: string;
  submitted: string;
  underReview: string;
  approved: string;
  completed: string;
  rejected: string;
  draft: string;
  maintenance: string;
  complaint: string;
  information: string;
  other: string;
  allStatus: string;
  createNewBill: string;
  billCreationForm: string;
  createBill: string;
  createNewDemand: string;
  submitNewRequest: string;
  submitAndTrackRequests: string;
  newDemand: string;
  selectType: string;
  selectBuilding: string;
  addNewDocument: string;
  addDocument: string;
  documentName: string;
  enterDocumentName: string;
  documentType: string;
  selectDocumentType: string;
  enterDocumentDescription: string;
  backToResidences: string;
  documents: string;
  documentsAvailableToTenants: string;
  allResidenceDocuments: string;
  loadingDemands2: string;
  noDemandsFound: string;
  noDocumentsFound: string;
  success: string;
  updateStatusAndNotes: string;
  describeRequestDetail: string;
  submittedBy: string;
  addNotesReviewDecision: string;
  addNotesReview: string;
  selectBuilding2: string;
  submitted2: string;
  typePlaceholder: string;
  buildingPlaceholder: string;
  welcomeBack: string;
  personalizedDashboard: string;
  quickAccessEverything: string;
  adminDashboard: string;
  systemManagement: string;
  manageOrganizationsUsers: string;
  organizationOverview: string;
  viewManageOrganizations: string;
  viewManageResidences: string;
  selectBuildingResidence: string;
  selectBuildingOptional: string;
  selectOrganizationOptional: string;
  selectResidenceOptional: string;
  welcome: string;
  building2: string;
  residence: string;
  selectABuilding: string;
  address: string;
  floor: string;
  sqFt: string;
  bedrooms: string;
  bathrooms: string;
  viewDocuments2: string;
  unit: string;
  allFloors: string;
  totalFloors: string;
  myResidenceInfo: string;
  viewResidenceInfo: string;
  loading: string;
  noResidencesFound: string;
  noResidencesFoundOrg: string;
  notAssignedResidences: string;
  selectResidence: string;
  selectAResidence: string;
  areYouSureDelete: string;
  parkingSpaces: string;
  storageSpaces: string;
  myBuildings: string;
  viewBuildingsAccess: string;
  noBuildingsFound: string;
  noBuildingsAdminMessage: string;
  noBuildingsUserMessage: string;
  buildingType: string;
  yearBuilt: string;
  totalUnits: string;
  managementCompany: string;
  occupancy: string;
  occupancyStats: string;
  parking: string;
  storage: string;
  units: string;
  occupied: string;
  amenities: string;
  moreAmenities: string;
  unableToDisplayAmenities: string;
  buildingInfoUnavailable: string;
  addressUnavailable: string;
  previous: string;
  next: string;
  showing: string;
  residences: string;
  buildingDocuments: string;
  signIn: string;
  demoMode: string;
  firstName: string;
  lastName: string;
  confirmPassword: string;
  enterPassword: string;
  enterFirstName: string;
  enterLastName: string;
  required: string;
  submit: string;
  send: string;
  reset: string;
  clear: string;
  add: string;
  remove: string;
  update: string;
  create: string;
  fieldRequired: string;
  emailRequired: string;
  passwordRequired: string;
  invalidEmail: string;
  invalidEmailFormat: string;
  passwordTooShort: string;
  passwordTooWeak: string;
  passwordsNotMatch: string;
  firstNameRequired: string;
  lastNameRequired: string;
  organizationRequired: string;
  buildingRequired: string;
  residenceRequired: string;
  loginFailed: string;
  invalidCredentials: string;
  networkError: string;
  serverError: string;
  unexpectedError: string;
  loadingFailed: string;
  saveFailed: string;
  updateFailed: string;
  deleteFailed: string;
  firstNameTooLong: string;
  firstNameInvalidCharacters: string;
  lastNameTooLong: string;
  lastNameInvalidCharacters: string;
  personalMessageTooLong: string;
  expiryDaysInvalid: string;
  emailOrNameRequired: string;
  aiAnalysisWarning: string;
  lowConfidenceAIWarning: string;
  reviewAISuggestionsCarefully: string;
  email: string;
  password: string;
  login: string;
  forgotPassword: string;
  documentsButton: string;
  buildingDocumentsButton: string;
  residenceDocumentsButton: string;
  viewDocumentsButton: string;
  startFreeTrial: string;
  tryDemo: string;
  allStatusFilter: string;
  submittedFilter: string;
  underReviewFilter: string;
  approvedFilter: string;
  inProgressFilter: string;
  completedFilter: string;
  rejectedFilter: string;
  cancelledFilter: string;
  draftFilter: string;
  allTypesFilter: string;
  maintenanceFilter: string;
  complaintFilter: string;
  informationFilter: string;
  otherFilter: string;
  buildingsManagement: string;
  manageBuildings: string;
  addBuilding: string;
  editBuilding: string;
  createBuilding: string;
  buildingName: string;
  buildingAddress: string;
  buildingCity: string;
  buildingProvince: string;
  buildingPostalCode: string;
  organizationLabel: string;
  enterBuildingName: string;
  enterStreetAddress: string;
  enterCity: string;
  selectProvince: string;
  enterPostalCode: string;
  selectBuildingType: string;
  fillBuildingInfo: string;
  allFieldsRequired: string;
  buildingNameRequired: string;
  addressRequired: string;
  cityRequired: string;
  provinceRequired: string;
  postalCodeRequired: string;
  nameTooLong: string;
  addressTooLong: string;
  cityTooLong: string;
  provinceTooLong: string;
  postalCodeTooLong: string;
  mustHaveAtLeastOneUnit: string;
  maximumUnitsAllowed: string;
  searchBuildingsPlaceholder: string;
  unitsCount: string;
  activeBuilding: string;
  inactiveBuilding: string;
  condoType: string;
  apartmentType: string;
  appartementType: string;
  townhouseType: string;
  commercialType: string;
  mixedUseType: string;
  otherBuildingType: string;
  residencesManagement: string;
  manageResidences: string;
  searchFilters: string;
  searchResidences: string;
  searchUnitTenant: string;
  buildingFilter: string;
  floorFilter: string;
  unitNumber: string;
  adjustSearchCriteria: string;
  bed: string;
  bath: string;
  residents: string;
  noResidentsAssigned: string;
  moreResidents: string;
  squareFootage: string;
  monthShort: string;
  manageResidenceDocuments: string;
  monthlyFees: string;
  ownershipPercentage: string;
  editResidence: string;
  viewDocuments: string;
  budgetDashboard: string;
  budgetSubtitle: string;
  totalBudget: string;
  usedBudget: string;
  remaining: string;
  variance: string;
  fromLastYear: string;
  ofTotalBudget: string;
  percentRemaining: string;
  underBudget: string;
  overBudget: string;
  budgetCategories: string;
  monthlySpendingTrend: string;
  budgetAnalyticsChart: string;
  utilities: string;
  insurance: string;
  administration: string;
  cleaning: string;
  security: string;
  landscaping: string;
  professionalServices: string;
  repairs: string;
  supplies: string;
  taxes: string;
  salary: string;
  billsManagement: string;
  billsSubtitle: string;
  filters: string;
  year: string;
  months: string;
  allMonths: string;
  allCategories: string;
  loadingBuildings: string;
  failedToLoadBuildings: string;
  retry: string;
  createFirstBill: string;
  noBillsFound: string;
  noBillsFoundMessage: string;
  loadingBills: string;
  current: string;
  showMoreYears: string;
  showFewerYears: string;
  demandsManagement: string;
  demandsSubtitle: string;
  allDemands: string;
  reviewManageDemands: string;
  createDemandBehalf: string;
  type: string;
  allTypes: string;
  description: string;
  describeDemandDetail: string;
  creating: string;
  maintenanceType: string;
  complaintType: string;
  informationType: string;
  otherType: string;
  pendingReview: string;
  activeTab: string;
  completedTab: string;
  all: string;
  noDemandsPending: string;
  noActiveDemands: string;
  noCompletedDemands: string;
  totalDemandsLoaded: string;
  created: string;
  unknown: string;
  demandCreatedSuccess: string;
  failedCreateDemand: string;
  descriptionMinLength: string;
  manageAllUsers: string;
  total: string;
  searchUsers: string;
  clearFilters: string;
  clearSelection: string;
  activateSelected: string;
  deactivateSelected: string;
  deleteSelected: string;
  rowsPerPage: string;
  name: string;
  organizations: string;
  demoManager: string;
  demoTenant: string;
  demoResident: string;
  statusActive: string;
  statusInactive: string;
  editOrganizations: string;
  editBuildings: string;
  editResidences: string;
  editUserTitle: string;
  accountStatus: string;
  saveChanges: string;
  deleteUserTitle: string;
  deleteUserDescription: string;
  reasonOptional: string;
  confirmDeletion: string;
  userUpdatedSuccess: string;
  organizationAssignmentsUpdated: string;
  buildingAssignmentsUpdated: string;
  residenceAssignmentsUpdated: string;
  accountDeleted: string;
  accountDeletedDescription: string;
  deletionFailed: string;
  deletionFailedDescription: string;
  anErrorOccurred: string;
  firstNameMaxLength: string;
  firstNameInvalidChars: string;
  lastNameMaxLength: string;
  lastNameInvalidChars: string;
  emailInvalid: string;
  roleRequired: string;
  emailConfirmationRequired: string;
  emailConfirmationInvalid: string;
  reasonMaxLength: string;
  allOrganizations: string;
  loadingUsers: string;
  basicInfo: string;
  buildings: string;
  saving: string;
  warning: string;
  deleteUserDataWarning: string;
  profileInfoAccess: string;
  orgResidenceAssignments: string;
  billsDocsMaintenance: string;
  notificationsActivity: string;
  enterReasonDeletion: string;
  deleting: string;
  page: string;
  of: string;
  settings: string;
  manageAccountSettings: string;
  generalSettings: string;
  securitySettings: string;
  additionalSettings: string;
  privacyDataCompliance: string;
  future: string;
  notifications: string;
  theme: string;
  advanced: string;
  username: string;
  phone: string;
  language: string;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  changePassword: string;
  changing: string;
  selectLanguage: string;
  yourDataRights: string;
  exportData: string;
  exportDataDescription: string;
  exporting: string;
  deleteAccount: string;
  deleteAccountDescription: string;
  confirmEmailDelete: string;
  reasonForDeletion: string;
  enterReasonForDeletion: string;
  // Common no data messages
  noData: string;
  noDataAvailable: string;
  noDataFound: string;
  noBookingsFound: string;
  noBookingsFoundMessage: string;
  selectCommonSpace: string;
  selectCommonSpaceMessage: string;
  noComplianceData: string;
  noComplianceDataMessage: string;
  noCertificateFound: string;
  noCertificateFoundMessage: string;
  // Invitation management
  pendingInvitations: string;
  managePendingInvitations: string;
  loadingInvitations: string;
  noInvitationsFound: string;
  expires: string;
  status: string;
  actions: string;
  unit: string;
  expired: string;
  pending: string;
  deleteInvitation: string;
  deleteInvitationConfirm: string;
  cancel: string;
  invitationDeletedSuccess: string;
  invitationDeletedError: string;
  deleteAccountAction: string;
  profileUpdated: string;
  profileUpdatedDescription: string;
  failedUpdateProfile: string;
  passwordChanged: string;
  passwordChangedDescription: string;
  failedChangePassword: string;
  dataExported: string;
  dataExportedDescription: string;
  exportFailed: string;
  failedExportData: string;
  bugReports: string;
  reportTrackIssues: string;
  reportBug: string;
  reportNewBug: string;
  searchBugs: string;
  new: string;
  acknowledged: string;
  resolved: string;
  closed: string;
  allPriority: string;
  low: string;
  medium: string;
  critical: string;
  priority: string;
  pageLocation: string;
  stepsToReproduce: string;
  stepsToReproduceOptional: string;
  reproducePlaceholder: string;
  attachDocumentsOptional: string;
  submitting: string;
  submitBugReport: string;
  editBug: string;
  deleteBug: string;
  selectPriority: string;
  locationPlaceholder: string;
  uiUx: string;
  functionality: string;
  performance: string;
  data: string;
  integration: string;
  bugCreatedSuccess: string;
  failedCreateBug: string;
  bugUpdatedSuccess: string;
  failedUpdateBug: string;
  bugDeletedSuccess: string;
  ideaBox: string;
  shareIdeasImprove: string;
  submitNewIdea: string;
  createIdea: string;
  searchIdeas: string;
  sortBy: string;
  newest: string;
  oldest: string;
  upvotes: string;
  featureTitle: string;
  need: string;
  needExplanation: string;
  upvote: string;
  upvoted: string;
  today: string;
  yesterday: string;
  daysAgo: string;
  weeksAgo: string;
  planned: string;
  propertyManagement: string;
  residentManagement: string;
  financialManagement: string;
  documentManagement: string;
  communication: string;
  reports: string;
  mobileApp: string;
  integrations: string;
  ideaSubmitted: string;
  ideaSubmittedDescription: string;
  failedSubmitIdea: string;
  ideaUpdated: string;
  ideaUpdatedDescription: string;
  failedUpdateIdea: string;
  upvotedMessage: string;
  upvotedDescription: string;
  failedUpvote: string;
  ideaDeleted: string;
  ideaDeletedDescription: string;
  failedDeleteIdea: string;
  organizationsManagement: string;
  organizationsManagementDesc: string;
  createEditDeleteOrganizations: string;
  permissionsManagement: string;
  permissionsManagementDesc: string;
  roleBasedAccessControl: string;
  systemPermissions: string;
  userRoles: string;
  permissionSettings: string;
  quebecLaw25Compliance: string;
  privacyComplianceMonitoring: string;
  violationTracking: string;
  scanCommand: string;
  semgrepCli: string;
  qualityMetricsTracking: string;
  refreshCommand: string;
  documentationCenter: string;
  generateManageDocumentation: string;
  projectOverview: string;
  technicalComponents: string;
  apiSpecifications: string;
  databaseSchema: string;
  dependencyInformation: string;
  productRoadmap: string;
  featurePlanningCapabilities: string;
  roadmapManagement: string;
  featureStatus: string;
  priorityManagement: string;
  developmentFrameworkMethodology: string;
  validateCommand: string;
  suggestionsManagement: string;
  userFeedbackSuggestions: string;
  suggestionReview: string;
  createNew: string;
  editSelected: string;
  dataExport: string;
  importData: string;
  manageUsers: string;
  assignRoles: string;
  revokePermissions: string;
  grantPermissions: string;
  activateAccount: string;
  deactivateAccount: string;
  systemSettings: string;
  auditLogs: string;
  systemBackup: string;
  complianceReport: string;
  performanceMetrics: string;
  privacyAudit: string;
  dataRetentionPolicy: string;
  consentManagement: string;
  rightToErasure: string;
  dataPortability: string;
  privacyImpactAssessment: string;
  insufficientPermissions: string;
  roleAssignmentFailed: string;
  permissionRevocationFailed: string;
  unauthorized: string;
  systemError: string;
  configurationError: string;
  validationFailed: string;
  operationFailed: string;
  connectionError: string;
  timeoutError: string;
  privacyViolation: string;
  dataRetentionViolation: string;
  consentRequired: string;
  dataProcessingError: string;
  complianceCheckFailed: string;
  userActive: string;
  userInactive: string;
  userPending: string;
  userSuspended: string;
  systemOnline: string;
  systemOffline: string;
  maintenanceMode: string;
  backupInProgress: string;
  updateAvailable: string;
  securityAlert: string;
  compliant: string;
  nonCompliant: string;
  requiresAction: string;
  auditRequired: string;
  donneesPersonnelles: string;
  consentementEclaire: string;
  droitALOubli: string;
  portabiliteDonnees: string;
  evaluationImpactViePrivee: string;
  responsableTraitement: string;
  sousTraitant: string;
  violationDonnees: string;
  notificationViolation: string;
  registreTraitement: string;
  auditConformite: string;
  mesuresSecurite: string;
  conservationDonnees: string;
  suppressionDonnees: string;
  rectificationDonnees: string;
  analytics: string;
  compliance: string;
  createdAt: string;
  updatedAt: string;
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;
  tenants: string;
  noTenants: string;
  residenceDetails: string;
  privacyPolicyTitle: string;
  lastUpdated: string;
  informationCollection: string;
  informationCollectionDesc: string;
  informationUse: string;
  informationUseDesc: string;
  informationSharing: string;
  privacyRights: string;
  dataSecurity: string;
  contactPrivacy: string;
  securityTitle: string;
  securityIntro: string;
  enterpriseEncryption: string;
  enterpriseEncryptionDesc: string;
  roleBasedAccess: string;
  roleBasedAccessDesc: string;
  quebecDataProtection: string;
  secureInfrastructure: string;
  secureInfrastructureDesc: string;
  ourStoryTitle: string;
  storyIntro: string;
  foundationYear: string;
  foundationTitle: string;
  foundationDesc: string;
  developmentYear: string;
  developmentTitle: string;
  launchYear: string;
  launchTitle: string;
  launchDesc: string;
  quickActions: string;
  calendar: string;
  myResidence: string;
  myBuilding: string;
  commonSpaces: string;
  budget: string;
  bills: string;
  demands: string;
  navUserManagement: string;
  manageCommonSpaces: string;
  documentation: string;
  pillars: string;
  roadmap: string;
  navQualityAssurance: string;
  navLaw25Compliance: string;
  rbacPermissions: string;
  modernPropertyManagement: string;
  forQuebec: string;
  startManagingToday: string;
  goToDashboard: string;
  everythingYouNeed: string;
  builtForPropertyOwners: string;
  buildingManagement: string;
  buildingManagementDesc: string;
  residentPortal: string;
  residentPortalDesc: string;
  financialReporting: string;
  financialReportingDesc: string;
  quebecCompliance: string;
  whyChooseKoveo: string;
  quebecLaw25Compliant: string;
  quebecLaw25CompliantDesc: string;
  bilingualSupport: string;
  bilingualSupportDesc: string;
  cloudBasedSecurity: string;
  cloudBasedSecurityDesc: string;
  mobileResponsive: string;
  mobileResponsiveDesc: string;
  expertSupport: string;
  expertSupportDesc: string;
  readyToTransform: string;
  joinPropertyOwners: string;
  getStartedNow: string;
  yourDataIsProtected: string;
  menu: string;
  navigation: string;
  account: string;
  home: string;
  features: string;
  ourStory: string;
  privacyPolicy: string;
  termsOfService: string;
  logout: string;
  getStarted: string;
  openMenu: string;
  closeMenu: string;
  copyright: string;
  law25Compliant: string;
  pricing: string;
  simplePricing: string;
  pricingSubtitle: string;
  professionalPlan: string;
  perfectForPropertyManagers: string;
  perDoorPerMonth: string;
  noSetupFees: string;
  unlimitedResidents: string;
  documentStorage: string;
  maintenanceTracking: string;
  financialReports: string;
  law25Protection: string;
  multilingualSupport: string;
  mobileAccess: string;
  cloudBackup: string;
  emailSupport: string;
  regularUpdates: string;
  documentManagementDesc: string;
  documentDescription: string;
  documentTitle: string;
  searchDocuments: string;
  smartNotifications: string;
  smartNotificationsDesc: string;
  electronicBilling: string;
  electronicBillingDesc: string;
  centralizedCommunication: string;
  centralizedCommunicationDesc: string;
  maintenancePlanning: string;
  maintenancePlanningDesc: string;
  processManagement: string;
  processManagementDesc: string;
  law25Compliance: string;
  law25ComplianceDesc: string;
  featuresOverviewDesc: string;
  viewAllFeatures: string;
  readyToGetStarted: string;
  allRightsReserved: string;
  residenceDocuments: string;
  manageDocumentsResidence: string;
  documentsCount: string;
  noDocumentsUploadedYet: string;
  myDemands: string;
  showingResults: string;
  manageBuildingsOrganization: string;
  searchBuildingsAddress: string;
  fullscreen: string;
  exitFullscreen: string;
  save: string;
  close: string;
  edit: string;
  delete: string;
}

/**
 * All translations for the Quebec property management platform.
 * Supports bilingual requirements with comprehensive coverage.
 */
export const translations: Record<Language, Translations> = {
  en: {
    dashboard: 'Dashboard',
    pillarFramework: 'Pillar Framework',
    qualityAssurance: 'Quality Assurance',
    workflowSetup: 'Workflow Setup',
    configuration: 'Configuration',
    developer: 'Developer',
    frameworkAdmin: 'Admin',
    developmentFrameworkInitialization: 'Development Framework Initialization',
    settingUpPillarMethodology: 'Setting up Pillar Methodology for Koveo Gestion Platform',
    workspaceActive: 'Workspace Active',
    saveProgress: 'Save Progress',
    initializationProgress: 'Initialization Progress',
    frameworkSetup: 'Framework Setup',
    pillarCreation: 'Pillar Creation',
    qualityTools: 'Quality Tools',
    testingSetup: 'Testing Setup',
    validation: 'Validation',
    frameworkConfiguration: 'Framework Configuration',
    recommended: 'Recommended for SaaS applications',
    selected: 'Selected',
    database: 'Database',
    auth: 'Auth',
    pillarMethodology: 'Pillar Methodology',
    validationQAPillar: 'Validation & QA Pillar',
    coreQualityAssurance: 'Core quality assurance framework',
    inProgress: 'In Progress',
    testingPillar: 'Testing Pillar',
    automatedTestingFramework: 'Automated testing framework',
    pending: 'Pending',
    securityPillar: 'Security Pillar',
    law25ComplianceFramework: 'Law 25 compliance framework',
    workspaceStatus: 'Workspace Status',
    environmentSetup: 'Environment Setup',
    complete: 'Complete',
    dependenciesInstallation: 'Dependencies Installation',
    typeScriptConfiguration: 'TypeScript Configuration',
    qualityMetrics: 'Quality Metrics',
    codeCoverage: 'Code Coverage',
    codeQuality: 'Code Quality',
    securityIssues: 'Security Issues',
    buildTime: 'Build Time',
    translationCoverage: 'Translation Coverage',
    responseTime: 'Response Time',
    memoryUsage: 'Memory Usage',
    bundleSize: 'Bundle Size',
    dbQueryTime: 'DB Query Time',
    pageLoadTime: 'Page Load Time',
    nextActions: 'Next Actions',
    initializeQAPillar: 'Initialize QA Pillar',
    setupValidationQualityAssurance: 'Set up validation and quality assurance framework',
    configureTesting: 'Configure Testing',
    continuousImprovementPillar: 'Continuous Improvement',
    documentationPillar: 'Documentation & Knowledge',
    documentationDescription: 'Comprehensive documentation and knowledge management system',
    activePillar: 'Active',
    systemHealth: 'System Health',
    completedToday: 'Completed Today',
    activeSuggestions: 'Active Suggestions',
    healthy: 'healthy',
    suggestions: 'suggestions',
    availableAfterQACompletion: 'Available after QA pillar completion',
    developmentConsole: 'Development Console',
    accessDenied: 'Access Denied',
    activateUsers: 'Activate Users',
    activateSelectedUsers: 'Activate selected users',
    deactivateUsers: 'Deactivate Users',
    deactivateSelectedUsers: 'Deactivate selected users',
    changeRole: 'Change Role',
    changeRoleSelectedUsers: 'Change role for selected users',
    sendPasswordReset: 'Send Password Reset',
    sendPasswordResetSelectedUsers: 'Send password reset to selected users',
    sendWelcomeEmail: 'Send Welcome Email',
    sendWelcomeEmailSelectedUsers: 'Send welcome email to selected users',
    exportUsers: 'Export Users',
    exportSelectedUsersData: 'Export selected users data',
    deleteUsers: 'Delete Users',
    deleteSelectedUsers: 'Delete selected users',
    users: 'Users',
    usersSelected: 'users selected',
    bulkActions: 'Bulk Actions',
    moreActions: 'More Actions',
    newRole: 'New Role',
    selectRole: 'Select role',
    admin: 'Admin',
    manager: 'Manager',
    tenant: 'Tenant',
    resident: 'Resident',
    applyRoleChange: 'Apply Role Change',
    thisActionCannotBeUndone: 'This action cannot be undone',
    cancel: 'Cancel',
    processing: 'Processing',
    confirm: 'Confirm',
    inviteUser: 'Invite User',
    inviteUserDescription: 'Send invitations to new users to join your property management system',
    singleInvitation: 'Single Invitation',
    bulkInvitations: 'Bulk Invitations',
    emailAddress: 'Email Address',
    enterEmailAddress: 'Enter email address',
    role: 'Role',
    organization: 'Organization',
    optional: 'Optional',
    selectOrganization: 'Select organization',
    expiresIn: 'Expires In',
    day: 'day',
    days: 'days',
    securityLevel: 'Security Level',
    standard: 'Standard',
    high: 'High',
    require2FA: 'Require 2FA',
    require2FADescription: 'Require two-factor authentication for this user',
    personalMessage: 'Personal Message',
    personalMessagePlaceholder: 'Add a personal welcome message...',
    personalMessageDescription: 'This message will be included in the invitation email',
    bulkPersonalMessagePlaceholder: 'Add a personal message for all invitations...',
    sendInvitation: 'Send Invitation',
    sendInvitations: 'Send Invitations',
    sending: 'Sending...',
    emailAddresses: 'Email Addresses',
    addEmailAddress: 'Add Email Address',
    invitationSent: 'Invitation Sent',
    invitationSentSuccessfully: 'Invitation sent successfully',
    bulkInvitationsSent: 'Bulk Invitations Sent',
    bulkInvitationsResult: 'Bulk invitations processed successfully',
    bulkInvitationsSuccess: 'invitations sent successfully',
    _error: 'An error occurred',
    bulkActionSuccess: 'Bulk Action Completed',
    bulkActionSuccessDescription: 'The bulk action has been completed successfully',
    reminderSent: 'Reminder Sent',
    reminderSentDescription: 'Reminder email has been sent successfully',
    errorLoadingData: 'Error Loading Data',
    tryAgain: 'Try Again',
    noUsersSelected: 'No Users Selected',
    selectUsersForBulkAction: 'Please select users to perform bulk action',
    totalUsers: 'Total Users',
    activeUsers: 'Active Users',
    pendingInvitations: 'Pending Invitations',
    totalInvitations: 'Total Invitations',
    userManagement: 'User Management',
    manageUsersInvitationsRoles: 'Manage users, invitations, and roles',
    searchUsersInvitations: 'Search users and invitations...',
    filterByRole: 'Filter by role',
    filterByCategory: 'Filter by category',
    allRoles: 'All Roles',
    filterByStatus: 'Filter by status',
    allStatuses: 'All Statuses',
    active: 'Active',
    inactive: 'Inactive',
    expired: 'Expired',
    invitations: 'Invitations',
    invitationSentDescription: 'Invitation has been sent successfully to the user',
    userUpdated: 'User Updated',
    userUpdatedSuccessfully: 'User has been updated successfully',
    editUser: 'Edit User',
    status: 'Status',
    activeUser: 'Active User',
    updating: 'Updating...',
    updateUser: 'Update User',
    userDeleted: 'Deleted',
    userDeletedSuccessfully: 'User has been deleted successfully',
    passwordResetSent: 'Password Reset Sent',
    passwordResetEmailSent: 'Password reset email has been sent successfully',
    cannotDeleteOwnAccount: 'You cannot delete your own account',
    never: 'Never',
    usersList: 'Users List',
    user: 'User',
    selectAllUsers: 'Select All Users',
    lastLogin: 'Last Login',
    joinedDate: 'Joined Date',
    userActions: 'User Actions',
    actions: 'Actions',
    resetPassword: 'Reset Password',
    deactivateUser: 'Deactivate User',
    activateUser: 'Activate User',
    deleteUser: 'Delete User',
    noUsersFound: 'No users found',
    editUserDescription: 'Update user information and permissions',
    confirmDeleteUser: 'Are you sure you want to delete {name}?',
    selectedUsers: 'selected users',
    selectUser: 'Select user {name}',
    invitationCancelled: 'Invitation Cancelled',
    invitationCancelledSuccessfully: 'Invitation cancelled successfully',
    invitationResent: 'Invitation Resent',
    invitationResentSuccessfully: 'Invitation resent successfully',
    linkCopied: 'Link Copied',
    invitationLinkCopied: 'Invitation link copied to clipboard',
    accepted: 'Accepted',
    cancelled: 'Cancelled',
    expiringsSoon: 'Expiring Soon',
    invitationsList: 'Invitations List',
    refresh: 'Refresh',
    recipient: 'Recipient',
    invited: 'Invited',
    expires: 'Expires',
    invitedBy: 'Invited By',
    system: 'System',
    invitationActions: 'Invitation Actions',
    copyLink: 'Copy Link',
    openLink: 'Open Link',
    sendReminder: 'Send Reminder',
    resendInvitation: 'Resend Invitation',
    cancelInvitation: 'Cancel Invitation',
    noInvitationsFound: 'No invitations found',
    cancelInvitationConfirmation: 'Are you sure you want to cancel this invitation?',
    cancelling: 'Cancelling...',
    daysRemaining: '{days} days remaining',
    hoursRemaining: '{hours} hours remaining',
    formStatus: 'Status',
    formType: 'Type',
    building: 'Building',
    allBuildings: 'All Buildings',
    searchDemands: 'Search demands...',
    title: 'Title',
    vendor: 'Vendor',
    category: 'Category',
    selectCategory: 'Select category',
    billTitle: 'Bill Title',
    companyOrServiceProvider: 'Company/Service Provider',
    selectPaymentType: 'Select payment type',
    selectSchedule: 'Select schedule',
    billingSchedule: 'Billing Schedule',
    selectStatus: 'Select status',
    loadingDemands: 'Loading demands...',
    searchDemandsUsers: 'Search demands and users...',
    submitAndTrack: 'Submit and track',
    reviewDemand: 'Review Demand',
    failedToReviewDemand: 'Failed to review demand',
    error: 'Error',
    submitted: 'Submitted',
    underReview: 'Under Review',
    approved: 'Approved',
    completed: 'Completed',
    rejected: 'Rejected',
    draft: 'Draft',
    maintenance: 'Maintenance',
    complaint: 'Complaint',
    information: 'Information',
    other: 'Other',
    allStatus: 'All Status',
    createNewBill: 'Create New Bill',
    billCreationForm: 'Bill Creation Form',
    createBill: 'Create Bill',
    createNewDemand: 'Create New Demand',
    submitNewRequest: 'Submit New Request',
    submitAndTrackRequests: 'Submit and track requests',
    newDemand: 'New Demand',
    selectType: 'Select type',
    selectBuilding: 'Select building',
    addNewDocument: 'Add New Document',
    addDocument: 'Add Document',
    documentName: 'Document Name',
    enterDocumentName: 'Enter document name',
    documentType: 'Document Type',
    selectDocumentType: 'Select document type',
    enterDocumentDescription: 'Enter document description',
    backToResidences: 'Back to Residences',
    documents: 'Documents',
    documentsAvailableToTenants: 'Documents available to tenants',
    allResidenceDocuments: 'All residence documents',
    loadingDemands2: 'Loading demands...',
    noDemandsFound: 'No demands found',
    noDocumentsFound: 'No documents found',
    success: 'Success',
    updateStatusAndNotes: 'Update status and notes',
    describeRequestDetail: 'Describe your request in detail',
    submittedBy: 'Submitted by',
    addNotesReviewDecision: 'Add notes about your review decision',
    addNotesReview: 'Add notes about the review',
    selectBuilding2: 'Select a building',
    submitted2: 'Submitted',
    typePlaceholder: 'Select type...',
    buildingPlaceholder: 'Select building...',
    welcomeBack: 'Welcome back',
    personalizedDashboard: 'Your personalized dashboard',
    quickAccessEverything: 'Quick access to everything you need',
    adminDashboard: 'Admin Dashboard',
    systemManagement: 'System Management',
    manageOrganizationsUsers: 'Manage organizations, users and system settings',
    organizationOverview: 'Organization Overview',
    viewManageOrganizations: 'View and manage all organizations',
    viewManageResidences: 'View and manage organization residences',
    selectBuildingResidence: 'Select building and residence',
    selectBuildingOptional: 'Select a building (optional)',
    selectOrganizationOptional: 'Select an organization (optional)',
    selectResidenceOptional: 'Select a residence (optional)',
    welcome: 'Welcome',
    building2: 'Building',
    residence: 'Residence',
    selectABuilding: 'Select a building',
    address: 'Address',
    floor: 'Floor',
    sqFt: 'sq ft',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    viewDocuments2: 'View Documents',
    unit: 'Unit',
    allFloors: 'All Floors',
    totalFloors: 'Total Floors',
    myResidenceInfo: 'View your residence information and contacts',
    viewResidenceInfo: 'View your residence information and contacts',
    loading: 'Loading...',
    noResidencesFound: 'No residences found',
    noResidencesFoundOrg: 'No residences found in your organization.',
    notAssignedResidences: 'You are not assigned to any residences.',
    selectResidence: 'Select residence',
    selectAResidence: 'Select a residence',
    areYouSureDelete: 'Are you sure you want to delete this contact?',
    parkingSpaces: 'Parking spaces',
    storageSpaces: 'Storage spaces',
    myBuildings: 'My Buildings',
    viewBuildingsAccess: 'View buildings you have access to',
    noBuildingsFound: 'No buildings found',
    noBuildingsAdminMessage: 'No buildings are currently registered in your organizations.',
    noBuildingsUserMessage: "You don't have access to any buildings yet.",
    buildingType: 'Building Type',
    yearBuilt: 'Year Built',
    totalUnits: 'Total Units',
    managementCompany: 'Management Company',
    occupancy: 'Occupancy',
    occupancyStats: 'Occupancy Stats',
    parking: 'Parking',
    storage: 'Storage',
    units: 'units',
    occupied: 'occupied',
    amenities: 'Amenities',
    moreAmenities: 'more',
    unableToDisplayAmenities: 'Unable to display amenities',
    buildingInfoUnavailable: 'Building information unavailable',
    addressUnavailable: 'Address unavailable',
    previous: 'Previous',
    next: 'Next',
    showing: 'Showing',
    residences: 'Residences',
    buildingDocuments: 'Building Documents',
    signIn: 'Sign In',
    demoMode: 'Demo Mode',
    firstName: 'First Name',
    lastName: 'Last Name',
    confirmPassword: 'Confirm Password',
    enterPassword: 'Enter password',
    enterFirstName: 'Enter first name',
    enterLastName: 'Enter last name',
    required: 'This field is required',
    submit: 'Submit',
    send: 'Send',
    reset: 'Reset',
    clear: 'Clear',
    add: 'Add',
    remove: 'Remove',
    update: 'Update',
    create: 'Create',
    fieldRequired: 'This field is required',
    emailRequired: 'Email address is required',
    passwordRequired: 'Password is required to sign in',
    invalidEmail: 'Please enter a valid email address (example: user@domain.com)',
    invalidEmailFormat: 'Please enter a valid email address (example: user@domain.com)',
    passwordTooShort: 'Password must be at least 8 characters long',
    passwordTooWeak: 'Password is too weak - please use a stronger password',
    passwordsNotMatch: 'Passwords do not match - please check both fields',
    firstNameRequired: 'First name is required (example: Jean)',
    lastNameRequired: 'Last name is required (example: Dupont)',
    organizationRequired: 'Organization is required',
    buildingRequired: 'Building is required',
    residenceRequired: 'Please select a specific residence unit for tenants and residents',
    loginFailed: 'Sign in failed - please check your credentials and try again',
    invalidCredentials: 'Invalid email or password - please try again',
    networkError: 'Network connection error - please check your internet connection',
    serverError: 'Server error occurred - please try again later',
    unexpectedError: 'An unexpected error occurred - please contact support if this continues',
    loadingFailed: 'Failed to load data - please refresh the page and try again',
    saveFailed: 'Failed to save changes - please try again',
    updateFailed: 'Failed to update information - please try again',
    deleteFailed: 'Failed to delete item - please try again',
    firstNameTooLong: 'First name must be less than 50 characters',
    firstNameInvalidCharacters: 'First name can only contain letters, spaces, apostrophes and hyphens',
    lastNameTooLong: 'Last name must be less than 50 characters',
    lastNameInvalidCharacters: 'Last name can only contain letters, spaces, apostrophes and hyphens',
    personalMessageTooLong: 'Personal message must be less than 500 characters',
    expiryDaysInvalid: 'Expiry days must be between 1 and 30 days',
    emailOrNameRequired: 'Email address is required for regular invitations (example: user@domain.com). For demo users, provide first name and last name.',
    aiAnalysisWarning: 'AI Analysis Warning',
    lowConfidenceAIWarning: 'AI analysis has low confidence:',
    reviewAISuggestionsCarefully: 'Please review all suggested values carefully.',
    email: 'Email',
    password: 'Password',
    login: 'Login',
    forgotPassword: 'Forgot Password',
    documentsButton: 'Documents',
    buildingDocumentsButton: 'Building Documents',
    residenceDocumentsButton: 'Residence Documents',
    viewDocumentsButton: 'View Documents',
    startFreeTrial: 'Start your free trial',
    tryDemo: 'Try Demo',
    allStatusFilter: 'All Status',
    submittedFilter: 'Submitted',
    underReviewFilter: 'Under Review',
    approvedFilter: 'Approved',
    inProgressFilter: 'In Progress',
    completedFilter: 'Completed',
    rejectedFilter: 'Rejected',
    cancelledFilter: 'Cancelled',
    draftFilter: 'Draft',
    allTypesFilter: 'All Types',
    maintenanceFilter: 'Maintenance',
    complaintFilter: 'Complaint',
    informationFilter: 'Information',
    otherFilter: 'Other',
    buildingsManagement: 'Buildings Management',
    manageBuildings: 'Manage all buildings in your organization',
    addBuilding: 'Add Building',
    editBuilding: 'Edit Building',
    createBuilding: 'Create Building',
    buildingName: 'Building Name',
    buildingAddress: 'Address',
    buildingCity: 'City',
    buildingProvince: 'Province',
    buildingPostalCode: 'Postal Code',
    organizationLabel: 'Organization',
    enterBuildingName: 'Enter building name',
    enterStreetAddress: 'Enter street address',
    enterCity: 'Enter city',
    selectProvince: 'Select province',
    enterPostalCode: 'Enter postal code',
    selectBuildingType: 'Select building type',
    fillBuildingInfo: 'Fill in the building information below. All fields are required.',
    allFieldsRequired: 'All fields are required',
    buildingNameRequired: 'Building name is required',
    addressRequired: 'Address is required',
    cityRequired: 'City is required',
    provinceRequired: 'Province is required',
    postalCodeRequired: 'Postal code is required',
    nameTooLong: 'Name too long',
    addressTooLong: 'Address too long',
    cityTooLong: 'City too long',
    provinceTooLong: 'Province too long',
    postalCodeTooLong: 'Postal code too long',
    mustHaveAtLeastOneUnit: 'Must have at least 1 unit',
    maximumUnitsAllowed: 'Maximum 300 units allowed',
    searchBuildingsPlaceholder: 'Search buildings by name or address...',
    unitsCount: 'units',
    activeBuilding: 'Active',
    inactiveBuilding: 'Inactive',
    condoType: 'Condo',
    apartmentType: 'Apartment',
    appartementType: 'Apartment',
    townhouseType: 'Townhouse',
    commercialType: 'Commercial',
    mixedUseType: 'Mixed Use',
    otherBuildingType: 'Other',
    residencesManagement: 'Residences Management',
    manageResidences: 'Manage all residences and units',
    searchFilters: 'Search & Filters',
    searchResidences: 'Search',
    searchUnitTenant: 'Search by unit number or tenant name...',
    buildingFilter: 'Building',
    floorFilter: 'Floor',
    unitNumber: 'Unit Number',
    adjustSearchCriteria: 'Try adjusting your search criteria',
    bed: 'bed',
    bath: 'bath',
    residents: 'Residents',
    noResidentsAssigned: 'No residents assigned',
    moreResidents: 'more',
    squareFootage: 'Square Footage',
    monthShort: 'month',
    manageResidenceDocuments: 'Manage residence documents',
    monthlyFees: 'Monthly Fees',
    ownershipPercentage: 'Ownership %',
    editResidence: 'Edit Residence',
    viewDocuments: 'View Documents',
    budgetDashboard: 'Budget Dashboard',
    budgetSubtitle: 'Financial budget management and tracking',
    totalBudget: 'Total Budget',
    usedBudget: 'Used Budget',
    remaining: 'Remaining',
    variance: 'Variance',
    fromLastYear: 'from last year',
    ofTotalBudget: 'of total budget',
    percentRemaining: 'remaining',
    underBudget: 'Under budget',
    overBudget: 'Over budget',
    budgetCategories: 'Budget Categories',
    monthlySpendingTrend: 'Monthly Spending Trend',
    budgetAnalyticsChart: 'Budget analytics chart would appear here',
    utilities: 'Utilities',
    insurance: 'Insurance',
    administration: 'Administration',
    cleaning: 'Cleaning',
    security: 'Security',
    landscaping: 'Landscaping',
    professionalServices: 'Professional Services',
    repairs: 'Repairs',
    supplies: 'Supplies',
    taxes: 'Taxes',
    salary: 'Salary',
    billsManagement: 'Bills Management',
    billsSubtitle: 'Manage building expenses and revenue tracking',
    filters: 'Filters',
    year: 'Year',
    months: 'Months',
    allMonths: 'All months',
    allCategories: 'All Categories',
    loadingBuildings: 'Loading buildings...',
    failedToLoadBuildings: 'Failed to load buildings',
    retry: 'Retry',
    createFirstBill: 'Create First Bill',
    noBillsFound: 'No Bills Found',
    noBillsFoundMessage: 'No bills found for the selected filters. Create your first bill to get started.',
    loadingBills: 'Loading bills...',
    current: 'Current',
    showMoreYears: 'Show more years',
    showFewerYears: 'Show fewer years',
    demandsManagement: 'Demands Management',
    demandsSubtitle: 'Manage maintenance requests and demands',
    allDemands: 'All Demands',
    reviewManageDemands: 'Review and manage resident demands',
    createDemandBehalf: 'Create a demand on behalf of a resident',
    type: 'Type',
    allTypes: 'All Types',
    description: 'Description',
    describeDemandDetail: 'Describe the demand in detail...',
    creating: 'Creating...',
    maintenanceType: 'Maintenance',
    complaintType: 'Complaint',
    informationType: 'Information',
    otherType: 'Other',
    pendingReview: 'Pending Review',
    activeTab: 'Active',
    completedTab: 'Completed',
    all: 'All',
    noDemandsPending: 'No demands pending review',
    noActiveDemands: 'No active demands',
    noCompletedDemands: 'No completed demands',
    totalDemandsLoaded: 'total demands loaded, but filtered out',
    created: 'Created',
    unknown: 'Unknown',
    demandCreatedSuccess: 'Demand created successfully',
    failedCreateDemand: 'Failed to create demand',
    descriptionMinLength: 'Description must be at least 10 characters',
    manageAllUsers: 'Manage All Users',
    total: 'Total',
    searchUsers: 'Search users...',
    clearFilters: 'Clear Filters',
    clearSelection: 'Clear Selection',
    activateSelected: 'Activate Selected',
    deactivateSelected: 'Deactivate Selected',
    deleteSelected: 'Delete Selected',
    rowsPerPage: 'rows per page',
    name: 'Name',
    organizations: 'Organizations',
    demoManager: 'Demo Manager',
    demoTenant: 'Demo Tenant',
    demoResident: 'Demo Resident',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    editOrganizations: 'Edit Organizations',
    editBuildings: 'Edit Buildings',
    editResidences: 'Edit Residences',
    editUserTitle: 'Edit User',
    accountStatus: 'Account Status',
    saveChanges: 'Save Changes',
    deleteUserTitle: 'Delete User Account',
    deleteUserDescription: 'This will permanently delete and all associated data. This action cannot be undone.',
    reasonOptional: 'Reason for deletion (optional)',
    confirmDeletion: 'Delete Account',
    userUpdatedSuccess: 'User updated successfully',
    organizationAssignmentsUpdated: 'Organization assignments updated successfully',
    buildingAssignmentsUpdated: 'Building assignments updated successfully',
    residenceAssignmentsUpdated: 'Residence assignments updated successfully',
    accountDeleted: 'Account deleted',
    accountDeletedDescription: 'User account and all associated data have been permanently deleted.',
    deletionFailed: 'Deletion failed',
    deletionFailedDescription: 'Failed to delete account',
    anErrorOccurred: 'An error occurred',
    firstNameMaxLength: 'First name must be less than 50 characters',
    firstNameInvalidChars: 'First name can only contain letters, spaces, apostrophes and hyphens',
    lastNameMaxLength: 'Last name must be less than 50 characters',
    lastNameInvalidChars: 'Last name can only contain letters, spaces, apostrophes and hyphens',
    emailInvalid: 'Please enter a valid email address (example: jean.dupont@email.com)',
    roleRequired: 'Please select a user role',
    emailConfirmationRequired: 'Email confirmation is required to delete user',
    emailConfirmationInvalid: 'Please enter a valid email address that matches the user account',
    reasonMaxLength: 'Reason must be less than 500 characters',
    allOrganizations: 'All Organizations',
    loadingUsers: 'Loading users...',
    basicInfo: 'Basic Info',
    buildings: 'Buildings',
    saving: 'Saving...',
    warning: 'Warning',
    deleteUserDataWarning: 'This will delete all user data including',
    profileInfoAccess: 'Profile information and account access',
    orgResidenceAssignments: 'Organization and residence assignments',
    billsDocsMaintenance: 'Bills, documents, and maintenance requests',
    notificationsActivity: 'Notifications and activity history',
    enterReasonDeletion: 'Enter reason for deletion...',
    deleting: 'Deleting...',
    page: 'Page',
    of: 'of',
    settings: 'Settings',
    manageAccountSettings: 'Manage your account and application settings',
    generalSettings: 'General Settings',
    securitySettings: 'Security Settings',
    additionalSettings: 'Additional Settings',
    privacyDataCompliance: 'Privacy & Data (Law 25 Compliance)',
    future: 'Future',
    notifications: 'Notifications',
    theme: 'Theme',
    advanced: 'Advanced',
    username: 'Username',
    phone: 'Phone',
    language: 'Language',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    changePassword: 'Change Password',
    changing: 'Changing...',
    selectLanguage: 'Select language',
    yourDataRights: 'Your Data Rights',
    exportData: 'Export Data',
    exportDataDescription: 'Download a copy of all your personal data stored in our system.',
    exporting: 'Exporting...',
    deleteAccount: 'Delete Account',
    deleteAccountDescription: 'Permanently delete your account and all associated data.',
    confirmEmailDelete: 'Confirm by typing your email address',
    reasonForDeletion: 'Reason for deletion (optional)',
    enterReasonForDeletion: 'Enter reason for deletion...',
    // Common no data messages
    noData: 'No Data',
    noDataAvailable: 'No Data Available',
    noDataFound: 'No Data Found',
    noBookingsFound: 'No bookings found for this space in the last 12 months.',
    noBookingsFoundMessage: 'No bookings found for this space in the last 12 months.',
    selectCommonSpace: 'Select a Common Space',
    selectCommonSpaceMessage: 'Choose a building and common space to view usage statistics.',
    noComplianceData: 'No Compliance Data Available',
    noComplianceDataMessage: 'Run the compliance scan to view Law 25 compliance status.',
    noCertificateFound: 'No Certificate Found',
    noCertificateFoundMessage: 'No SSL certificate found for this domain.',
    // Invitation management (moved to prevent duplicates)
    invitationDeletedSuccess: 'Invitation deleted successfully',
    invitationDeletedError: 'Failed to delete invitation',
    deleteAccountAction: 'Delete Account',
    profileUpdated: 'Profile updated',
    profileUpdatedDescription: 'Your profile has been updated successfully.',
    failedUpdateProfile: 'Failed to update profile',
    passwordChanged: 'Password changed',
    passwordChangedDescription: 'Your password has been changed successfully.',
    failedChangePassword: 'Failed to change password',
    dataExported: 'Data exported',
    dataExportedDescription: 'Your data has been downloaded successfully.',
    exportFailed: 'Export failed',
    failedExportData: 'Failed to export data',
    bugReports: 'Bug Reports',
    reportTrackIssues: 'Report and track application issues',
    reportBug: 'Report Bug',
    reportNewBug: 'Report New Bug',
    searchBugs: 'Search bugs...',
    new: 'New',
    acknowledged: 'Acknowledged',
    resolved: 'Resolved',
    closed: 'Closed',
    allPriority: 'All Priority',
    low: 'Low',
    medium: 'Medium',
    critical: 'Critical',
    priority: 'Priority',
    pageLocation: 'Page/Location',
    stepsToReproduce: 'Steps to Reproduce',
    stepsToReproduceOptional: 'Steps to Reproduce (Optional)',
    reproducePlaceholder: 'Describe the steps to reproduce this issue...',
    attachDocumentsOptional: 'Attach Documents (Optional)',
    submitting: 'Submitting...',
    submitBugReport: 'Submit Bug Report',
    editBug: 'Edit Bug',
    deleteBug: 'Delete Bug',
    selectPriority: 'Select priority',
    locationPlaceholder: 'e.g. Dashboard, Login page, Settings',
    uiUx: 'UI/UX',
    functionality: 'Functionality',
    performance: 'Performance',
    data: 'Data',
    integration: 'Integration',
    bugCreatedSuccess: 'Bug report created successfully',
    failedCreateBug: 'Failed to create bug report',
    bugUpdatedSuccess: 'Bug report updated successfully',
    failedUpdateBug: 'Failed to update bug report',
    bugDeletedSuccess: 'Bug report deleted successfully',
    ideaBox: 'Idea Box',
    shareIdeasImprove: 'Share your ideas to improve our platform',
    submitNewIdea: 'Submit New Idea',
    createIdea: 'Create Idea',
    searchIdeas: 'Search ideas...',
    sortBy: 'Sort by',
    newest: 'Newest',
    oldest: 'Oldest',
    upvotes: 'Upvotes',
    featureTitle: 'Feature Title',
    need: 'Need',
    needExplanation: 'Need explanation',
    upvote: 'Upvote',
    upvoted: 'Upvoted',
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: 'days ago',
    weeksAgo: 'weeks ago',
    planned: 'Planned',
    propertyManagement: 'Property Management',
    residentManagement: 'Resident Management',
    financialManagement: 'Financial Management',
    documentManagement: 'Document management',
    communication: 'Communication',
    reports: 'Reports',
    mobileApp: 'Mobile App',
    integrations: 'Integrations',
    ideaSubmitted: 'Idea submitted!',
    ideaSubmittedDescription: 'Your feature idea has been submitted successfully.',
    failedSubmitIdea: 'Failed to submit idea',
    ideaUpdated: 'Idea updated!',
    ideaUpdatedDescription: 'Feature idea has been updated successfully.',
    failedUpdateIdea: 'Failed to update idea',
    upvotedMessage: 'Upvoted!',
    upvotedDescription: 'Your upvote has been recorded.',
    failedUpvote: 'Failed to upvote',
    ideaDeleted: 'Idea deleted!',
    ideaDeletedDescription: 'The feature idea has been deleted successfully.',
    failedDeleteIdea: 'Failed to delete idea',
    organizationsManagement: 'Organizations Management',
    organizationsManagementDesc: 'Create, view, edit and delete organizations in the system',
    createEditDeleteOrganizations: 'Create, edit and delete organizations',
    permissionsManagement: 'Permissions Management',
    permissionsManagementDesc: 'Manage user roles and system permissions',
    roleBasedAccessControl: 'Role-Based Access Control',
    systemPermissions: 'System Permissions',
    userRoles: 'User Roles',
    permissionSettings: 'Permission Settings',
    quebecLaw25Compliance: 'Quebec Law 25 Compliance',
    privacyComplianceMonitoring: 'Privacy compliance monitoring and violation tracking',
    violationTracking: 'Violation Tracking',
    scanCommand: 'Scan Command',
    semgrepCli: 'Semgrep CLI',
    qualityMetricsTracking: 'Quality metrics and assurance tracking',
    refreshCommand: 'Refresh Command',
    documentationCenter: 'Documentation Center',
    generateManageDocumentation: 'Generate and manage project documentation',
    projectOverview: 'Project Overview',
    technicalComponents: 'Technical Components',
    apiSpecifications: 'API Specifications',
    databaseSchema: 'Database Schema',
    dependencyInformation: 'Dependency Information',
    productRoadmap: 'Product Roadmap',
    featurePlanningCapabilities: 'Feature planning capabilities',
    roadmapManagement: 'Roadmap Management',
    featureStatus: 'Feature Status',
    priorityManagement: 'Priority Management',
    developmentFrameworkMethodology: 'Development framework and methodology',
    validateCommand: 'Validate Command',
    suggestionsManagement: 'Suggestions Management',
    userFeedbackSuggestions: 'User feedback and suggestions',
    suggestionReview: 'Suggestion Review',
    createNew: 'Create New',
    editSelected: 'Edit Selected',
    dataExport: 'Data Export',
    importData: 'Import Data',
    manageUsers: 'Manage Users',
    assignRoles: 'Assign Roles',
    revokePermissions: 'Revoke Permissions',
    grantPermissions: 'Grant Permissions',
    activateAccount: 'Activate Account',
    deactivateAccount: 'Deactivate Account',
    systemSettings: 'System Settings',
    auditLogs: 'Audit Logs',
    systemBackup: 'System Backup',
    complianceReport: 'Compliance Report',
    performanceMetrics: 'Performance Metrics',
    privacyAudit: 'Privacy Audit',
    dataRetentionPolicy: 'Data Retention Policy',
    consentManagement: 'Consent Management',
    rightToErasure: 'Right to Erasure',
    dataPortability: 'Data Portability',
    privacyImpactAssessment: 'Privacy Impact Assessment',
    insufficientPermissions: 'Insufficient Permissions',
    roleAssignmentFailed: 'Role Assignment Failed',
    permissionRevocationFailed: 'Permission Revocation Failed',
    unauthorized: 'Unauthorized',
    systemError: 'System Error',
    configurationError: 'Configuration Error',
    validationFailed: 'Validation Failed',
    operationFailed: 'Operation Failed',
    connectionError: 'Connection Error',
    timeoutError: 'Timeout Error',
    privacyViolation: 'Privacy Violation',
    dataRetentionViolation: 'Data Retention Violation',
    consentRequired: 'Consent Required',
    dataProcessingError: 'Data Processing Error',
    complianceCheckFailed: 'Compliance Check Failed',
    userActive: 'Active',
    userInactive: 'Inactive',
    userPending: 'Pending',
    userSuspended: 'Suspended',
    systemOnline: 'Online',
    systemOffline: 'Offline',
    maintenanceMode: 'Maintenance Mode',
    backupInProgress: 'Backup in Progress',
    updateAvailable: 'Update Available',
    securityAlert: 'Security Alert',
    compliant: 'Compliant',
    nonCompliant: 'Non-Compliant',
    requiresAction: 'Requires Action',
    auditRequired: 'Audit Required',
    donneesPersonnelles: 'Personal Data',
    consentementEclaire: 'Informed Consent',
    droitALOubli: 'Right to be Forgotten',
    portabiliteDonnees: 'Data Portability',
    evaluationImpactViePrivee: 'Privacy Impact Assessment',
    responsableTraitement: 'Data Controller',
    sousTraitant: 'Data Processor',
    violationDonnees: 'Data Breach',
    notificationViolation: 'Breach Notification',
    registreTraitement: 'Processing Registry',
    auditConformite: 'Compliance Audit',
    mesuresSecurite: 'Security Measures',
    conservationDonnees: 'Data Retention',
    suppressionDonnees: 'Data Deletion',
    rectificationDonnees: 'Data Rectification',
    analytics: 'Analytics',
    compliance: 'Compliance',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    january: 'January',
    february: 'February',
    march: 'March',
    april: 'April',
    may: 'May',
    june: 'June',
    july: 'July',
    august: 'August',
    september: 'September',
    october: 'October',
    november: 'November',
    december: 'December',
    tenants: 'Tenants',
    noTenants: 'No tenants assigned',
    residenceDetails: 'Residence Details',
    privacyPolicyTitle: 'Privacy Policy',
    lastUpdated: 'Last updated:',
    informationCollection: '1. Information Collection',
    informationCollectionDesc: 'We collect the following personal information as part of our services:',
    informationUse: '2. Use of Information',
    informationUseDesc: 'Your personal information is used exclusively for:',
    informationSharing: '3. Sharing and Disclosure',
    privacyRights: '4. Your Rights',
    dataSecurity: '5. Data Security',
    contactPrivacy: '6. Contact Us',
    securityTitle: 'Security and Compliance',
    securityIntro: 'The security of your data is our absolute priority. Discover how we protect your information with enterprise-grade security measures and Quebec Law 25 compliance.',
    enterpriseEncryption: 'Enterprise-grade encryption',
    enterpriseEncryptionDesc: 'All data is encrypted in transit and at rest with military-grade AES-256 standards.',
    roleBasedAccess: 'Role-based access control',
    roleBasedAccessDesc: 'Granular authorization system ensuring each user only accesses necessary information.',
    quebecDataProtection: 'Quebec data protection',
    secureInfrastructure: 'Secure infrastructure',
    secureInfrastructureDesc: 'Redundant cloud architecture with 24/7 monitoring and automated backups.',
    ourStoryTitle: 'Our Story',
    storyIntro: 'Discover the story behind Koveo Gestion and our mission to modernize property management in Quebec.',
    foundationYear: '2023',
    foundationTitle: 'Foundation of Koveo Gestion',
    foundationDesc: 'Company creation with the mission to modernize property management in Quebec.',
    developmentYear: '2024',
    developmentTitle: 'Platform Development',
    launchYear: '2025',
    launchTitle: 'Official Launch',
    launchDesc: 'Launch of our platform with complete bilingual support and Quebec compliance.',
    quickActions: 'Quick Actions',
    calendar: 'Calendar',
    myResidence: 'My Residence',
    myBuilding: 'My Building',
    commonSpaces: 'Common Spaces',
    budget: 'Budget',
    bills: 'Bills',
    demands: 'Demands',
    navUserManagement: 'User Management',
    manageCommonSpaces: 'Manage Common Spaces',
    documentation: 'Documentation',
    pillars: 'Pillars',
    roadmap: 'Roadmap',
    navQualityAssurance: 'Quality Assurance',
    navLaw25Compliance: 'Law 25 Compliance',
    rbacPermissions: 'RBAC Permissions',
    modernPropertyManagement: 'Modern Property Management',
    forQuebec: 'for Quebec',
    startManagingToday: 'Start managing today',
    goToDashboard: 'Go to Dashboard',
    everythingYouNeed: 'Everything You Need',
    builtForPropertyOwners: 'Built for Property Owners and Managers',
    buildingManagement: 'Building Management',
    buildingManagementDesc: 'Complete building and unit management system',
    residentPortal: 'Resident Portal',
    residentPortalDesc: 'Self-service portal for residents and tenants',
    financialReporting: 'Financial Reporting',
    financialReportingDesc: 'Comprehensive financial tracking and reporting',
    quebecCompliance: 'Quebec Compliance',
    whyChooseKoveo: 'Why Choose Koveo?',
    quebecLaw25Compliant: 'Quebec Law 25 Compliant',
    quebecLaw25CompliantDesc: 'Built-in privacy protection and data security',
    bilingualSupport: 'Bilingual Support',
    bilingualSupportDesc: 'Full French and English language support',
    cloudBasedSecurity: 'Cloud-based Security',
    cloudBasedSecurityDesc: 'Enterprise-grade security and automated backups',
    mobileResponsive: 'Mobile Responsive',
    mobileResponsiveDesc: 'Access your property management tools anywhere',
    expertSupport: 'Expert Support',
    expertSupportDesc: 'Dedicated Quebec-based support team',
    readyToTransform: 'Ready to Transform Your Property Management?',
    joinPropertyOwners: 'Join hundreds of Quebec property owners who trust Koveo Gestion',
    getStartedNow: 'Get Started Now',
    yourDataIsProtected: 'Your data is protected',
    menu: 'Menu',
    navigation: 'Navigation',
    account: 'Account',
    home: 'Home',
    features: 'Features',
    ourStory: 'Our Story',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    logout: 'Logout',
    getStarted: 'Get Started',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Quebec Law 25 Compliant',
    pricing: 'Pricing',
    simplePricing: 'Simple and Transparent Pricing',
    pricingSubtitle: 'Professional property management that scales with your business',
    professionalPlan: 'Professional Plan',
    perfectForPropertyManagers: 'Perfect for property managers of all sizes',
    perDoorPerMonth: 'per door per month',
    noSetupFees: 'No setup fees',
    unlimitedResidents: 'Unlimited residents',
    documentStorage: 'Secure document storage',
    maintenanceTracking: 'Maintenance tracking',
    financialReports: 'Financial reports',
    law25Protection: 'Quebec Law 25 protection',
    multilingualSupport: 'Bilingual support (FR/EN)',
    mobileAccess: 'Mobile access',
    cloudBackup: 'Automatic cloud backup',
    emailSupport: 'Email support',
    regularUpdates: 'Regular updates',
    documentManagementDesc: 'Secure storage and organization',
    documentDescription: 'Description of the document',
    documentTitle: 'Document Title',
    searchDocuments: 'Search documents...',
    smartNotifications: 'Smart notifications',
    smartNotificationsDesc: 'Automated alerts and reminders',
    electronicBilling: 'Electronic billing',
    electronicBillingDesc: 'Digital billing and payment tracking',
    centralizedCommunication: 'Centralized communication',
    centralizedCommunicationDesc: 'Unified messaging platform',
    maintenancePlanning: 'Maintenance planning',
    maintenancePlanningDesc: 'Smart planning and tracking',
    processManagement: 'Process management',
    processManagementDesc: 'Organized workflow tools',
    law25Compliance: 'Quebec Law 25 compliance',
    law25ComplianceDesc: 'Built-in privacy protection',
    featuresOverviewDesc: 'Complete solution for modern property management',
    viewAllFeatures: 'View all features',
    readyToGetStarted: 'Ready to get started?',
    allRightsReserved: 'All rights reserved',
    residenceDocuments: 'Residence Documents',
    manageDocumentsResidence: 'Manage documents for this residence',
    documentsCount: 'Documents ({count})',
    noDocumentsUploadedYet: 'No documents have been uploaded yet for this residence.',
    myDemands: 'My Demands',
    showingResults: 'Showing {start} to {end} of {total} demands',
    manageBuildingsOrganization: 'Manage {count} buildings in your organization',
    searchBuildingsAddress: 'Search buildings by name or address...',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    save: 'Save',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
  },
  fr: {

    dashboard: 'Tableau de bord',
    pillarFramework: 'Cadre de piliers',
    qualityAssurance: 'Assurance qualité',
    workflowSetup: 'Configuration du flux de travail',
    configuration: 'Configuration',
    developer: 'Développeur',
    frameworkAdmin: 'Admin',
    developmentFrameworkInitialization: 'Initialisation du cadre de développement',
    settingUpPillarMethodology: 'Configuration de la méthodologie Pilier pour la plateforme Koveo Gestion',
    workspaceActive: 'Espace de travail actif',
    saveProgress: 'Sauvegarder les progrès',
    frameworkSetup: 'Configuration du cadre',
    pillarCreation: 'Création de pilier',
    qualityTools: 'Outils de qualité',
    testingSetup: 'Configuration des tests',
    validation: 'Validation',
    frameworkConfiguration: 'Configuration du cadre',
    recommended: 'Recommandé pour les applications SaaS',
    selected: 'Sélectionné',
    database: 'Base de données',
    auth: 'Auth',
    pillarMethodology: 'Méthodologie Pilier',
    validationQAPillar: 'Pilier Validation et AQ',
    inProgress: 'En cours',
    testingPillar: 'Pilier de test',
    automatedTestingFramework: 'Cadre de test automatisé',
    pending: 'En attente',
    securityPillar: 'Pilier de sécurité',
    law25ComplianceFramework: 'Cadre de conformité Loi 25',
    complete: 'Terminé',
    dependenciesInstallation: 'Installation des dépendances',
    typeScriptConfiguration: 'Configuration TypeScript',
    qualityMetrics: 'Métriques de qualité',
    codeCoverage: 'Couverture de code',
    codeQuality: 'Qualité du code',
    securityIssues: 'Problèmes de sécurité',
    buildTime: 'Temps de construction',
    translationCoverage: 'Couverture de traduction',
    responseTime: 'Temps de réponse',
    memoryUsage: 'Utilisation de la mémoire',
    bundleSize: 'Taille du bundle',
    dbQueryTime: 'Temps de requête DB',
    pageLoadTime: 'Temps de chargement de page',
    nextActions: 'Prochaines actions',
    initializeQAPillar: 'Initialiser le pilier AQ',
    configureTesting: 'Configurer les tests',
    continuousImprovementPillar: 'Amélioration continue',
    documentationPillar: 'Documentation et connaissances',
    documentationDescription: 'Système complet de documentation et de gestion des connaissances',
    activePillar: 'Actif',
    systemHealth: 'Santé du système',
    activeSuggestions: 'Suggestions actives',
    healthy: 'sain',
    suggestions: 'suggestions',
    developmentConsole: 'Console de développement',
    accessDenied: 'Accès refusé',
    activateUsers: 'Activer les utilisateurs',
    activateSelectedUsers: 'Activer les utilisateurs sélectionnés',
    deactivateUsers: 'Désactiver les utilisateurs',
    deactivateSelectedUsers: 'Désactiver les utilisateurs sélectionnés',
    changeRole: 'Changer le rôle',
    changeRoleSelectedUsers: 'Changer le rôle des utilisateurs sélectionnés',
    sendPasswordReset: 'Envoyer la réinitialisation du mot de passe',
    sendPasswordResetSelectedUsers: 'Envoyer la réinitialisation du mot de passe aux utilisateurs sélectionnés',
    sendWelcomeEmail: 'Envoyer un courriel de bienvenue',
    sendWelcomeEmailSelectedUsers: 'Envoyer un courriel de bienvenue aux utilisateurs sélectionnés',
    exportUsers: 'Exporter les utilisateurs',
    exportSelectedUsersData: 'Exporter les données des utilisateurs sélectionnés',
    deleteUsers: 'Supprimer les utilisateurs',
    deleteSelectedUsers: 'Supprimer les utilisateurs sélectionnés',
    users: 'Utilisateurs',
    usersSelected: 'utilisateurs sélectionnés',
    bulkActions: 'Actions en lot',
    newRole: 'Nouveau rôle',
    selectRole: 'Sélectionner un rôle',
    admin: 'Administrateur',
    manager: 'Gestionnaire',
    tenant: 'Locataire',
    resident: 'Résident',
    applyRoleChange: 'Appliquer le changement de rôle',
    thisActionCannotBeUndone: 'Cette action ne peut pas être annulée',
    cancel: 'Annuler',
    processing: 'Traitement en cours',
    confirm: 'Confirmer',
    inviteUser: 'Inviter un utilisateur',
    inviteUserDescription: 'Envoyer des invitations aux nouveaux utilisateurs pour rejoindre votre système de gestion immobilière',
    singleInvitation: 'Invitation unique',
    bulkInvitations: 'Invitations groupées',
    emailAddress: 'Adresse courriel',
    role: 'Rôle',
    organization: 'Organisation',
    optional: 'Optionnel',
    expiresIn: 'Expire dans',
    day: 'jour',
    days: 'jours',
    securityLevel: 'Niveau de sécurité',
    standard: 'Standard',
    high: 'Élevé',
    require2FA: 'Exiger 2FA',
    personalMessage: 'Message personnel',
    personalMessagePlaceholder: 'Ajouter un message de bienvenue personnel...',
    bulkPersonalMessagePlaceholder: 'Ajouter un message personnel pour toutes les invitations...',
    sendInvitations: 'Envoyer les invitations',
    sending: 'Envoi en cours...',
    emailAddresses: 'Adresses courriel',
    addEmailAddress: 'Ajouter une adresse courriel',
    invitationSent: 'Invitation envoyée',
    invitationSentSuccessfully: 'Invitation envoyée avec succès',
    bulkInvitationsSent: 'Invitations groupées envoyées',
    bulkInvitationsResult: 'Invitations groupées traitées avec succès',
    bulkInvitationsSuccess: 'invitations envoyées avec succès',
    bulkActionSuccess: 'Action groupée terminée',
    reminderSent: 'Rappel envoyé',
    reminderSentDescription: 'Le courriel de rappel a été envoyé avec succès',
    errorLoadingData: 'Erreur de chargement des données',
    tryAgain: 'Réessayer',
    noUsersSelected: 'Aucun utilisateur sélectionné',
    totalUsers: 'Total utilisateurs',
    activeUsers: 'Utilisateurs actifs',
    pendingInvitations: 'Invitations en attente',
    totalInvitations: 'Invitations totales',
    userManagement: 'Gestion des utilisateurs',
    manageUsersInvitationsRoles: 'Gérer les utilisateurs, invitations et rôles',
    searchUsersInvitations: 'Rechercher des utilisateurs et invitations...',
    filterByRole: 'Filtrer par rôle',
    filterByCategory: 'Filtrer par catégorie',
    allRoles: 'Tous les rôles',
    filterByStatus: 'Filtrer par statut',
    allStatuses: 'Tous les statuts',
    active: 'Actif',
    inactive: 'Inactif',
    expired: 'Expiré',
    invitations: 'Invitations',
    userUpdated: 'Utilisateur mis à jour',
    status: 'Statut',
    activeUser: 'Utilisateur actif',
    updating: 'Mise à jour en cours...',
    userDeleted: 'Supprimé',
    passwordResetSent: 'Réinitialisation du mot de passe envoyée',
    passwordResetEmailSent: 'Le courriel de réinitialisation du mot de passe a été envoyé avec succès',
    cannotDeleteOwnAccount: 'Vous ne pouvez pas supprimer votre propre compte',
    never: 'Jamais',
    usersList: 'Liste des utilisateurs',
    user: 'Utilisateur',
    selectAllUsers: 'Sélectionner tous les utilisateurs',
    lastLogin: 'Dernière connexion',
    userActions: 'Actions utilisateur',
    actions: 'Actions',
    resetPassword: 'Réinitialiser mot de passe',
    noUsersFound: 'Aucun utilisateur trouvé',
    confirmDeleteUser: 'Êtes-vous sûr de vouloir supprimer {name}?',
    selectedUsers: 'utilisateurs sélectionnés',
    invitationCancelled: 'Invitation annulée',
    invitationCancelledSuccessfully: 'Invitation annulée avec succès',
    invitationResent: 'Invitation renvoyée',
    invitationResentSuccessfully: 'Invitation renvoyée avec succès',
    linkCopied: 'Lien copié',
    accepted: 'Accepté',
    cancelled: 'Annulé',
    expiringsSoon: 'Expire bientôt',
    invitationsList: 'Liste des invitations',
    refresh: 'Actualiser',
    recipient: 'Destinataire',
    invited: 'Invité',
    expires: 'Expire',
    invitedBy: 'Invité par',
    system: 'Système',
    copyLink: 'Copier le lien',
    openLink: 'Ouvrir le lien',
    sendReminder: 'Envoyer un rappel',
    noInvitationsFound: 'Aucune invitation trouvée',
    cancelInvitationConfirmation: 'Êtes-vous sûr de vouloir annuler cette invitation?',
    cancelling: 'Annulation en cours...',
    daysRemaining: '{days} jours restants',
    hoursRemaining: '{hours} heures restantes',
    formStatus: 'Statut',
    formType: 'Type',
    building: 'Bâtiment',
    allBuildings: 'Tous les bâtiments',
    searchDemands: 'Rechercher des demandes...',
    title: 'Titre',
    vendor: 'Fournisseur',
    category: 'Catégorie',
    selectCategory: 'Sélectionner la catégorie',
    billTitle: 'Titre de la facture',
    companyOrServiceProvider: 'Entreprise/Fournisseur de services',
    selectPaymentType: 'Sélectionner le type de paiement',
    billingSchedule: 'Calendrier de facturation',
    selectStatus: 'Sélectionner le statut',
    loadingDemands: 'Chargement des demandes...',
    searchDemandsUsers: 'Rechercher des demandes et des utilisateurs...',
    submitAndTrack: 'Soumettre et suivre',
    reviewDemand: 'Examiner la demande',
    submitted: 'Soumis',
    approved: 'Approuvé',
    completed: 'Terminé',
    rejected: 'Rejeté',
    draft: 'Brouillon',
    maintenance: 'Maintenance',
    complaint: 'Plainte',
    information: 'Information',
    other: 'Autre',
    allStatus: 'Tous les statuts',
    createNewBill: 'Créer une nouvelle facture',
    billCreationForm: 'Formulaire de création de facture',
    createBill: 'Créer une facture',
    createNewDemand: 'Créer une nouvelle demande',
    submitNewRequest: 'Soumettre une nouvelle demande',
    submitAndTrackRequests: 'Soumettre et suivre les demandes',
    newDemand: 'Nouvelle demande',
    selectType: 'Sélectionner le type',
    selectBuilding: 'Sélectionner un bâtiment',
    addNewDocument: 'Ajouter un nouveau document',
    addDocument: 'Ajouter un document',
    documentName: 'Nom du document',
    enterDocumentName: 'Entrez le nom du document',
    documentType: 'Type de document',
    selectDocumentType: 'Sélectionner le type de document',
    enterDocumentDescription: 'Entrez la description du document',
    backToResidences: 'Retour aux résidences',
    documents: 'Documents',
    documentsAvailableToTenants: 'Documents disponibles aux locataires',
    allResidenceDocuments: 'Tous les documents de résidence',
    loadingDemands2: 'Chargement des demandes...',
    noDemandsFound: 'Aucune demande trouvée',
    noDocumentsFound: 'Aucun document trouvé',
    success: 'Succès',
    updateStatusAndNotes: 'Mettre à jour le statut et les notes',
    describeRequestDetail: 'Décrivez votre demande en détail',
    submittedBy: 'Soumis par',
    selectBuilding2: 'Sélectionner un bâtiment',
    submitted2: 'Soumis',
    typePlaceholder: 'Sélectionner le type...',
    buildingPlaceholder: 'Sélectionner le bâtiment...',
    welcomeBack: 'Bon retour',
    personalizedDashboard: 'Votre tableau de bord personnalisé',
    quickAccessEverything: 'Accès rapide à tout ce dont vous avez besoin',
    adminDashboard: 'Tableau de bord administrateur',
    systemManagement: 'Gestion du système',
    manageOrganizationsUsers: 'Gérer les organisations, utilisateurs et paramètres système',
    viewManageOrganizations: 'Voir et gérer toutes les organisations',
    selectBuildingResidence: 'Sélectionner le bâtiment et la résidence',
    selectBuildingOptional: 'Sélectionner un bâtiment (optionnel)',
    selectOrganizationOptional: 'Sélectionner une organisation (optionnel)',
    selectResidenceOptional: 'Sélectionner une résidence (optionnel)',
    welcome: 'Bienvenue',
    building2: 'Bâtiment',
    residence: 'Résidence',
    selectABuilding: 'Sélectionner un bâtiment',
    address: 'Adresse',
    floor: 'Étage',
    sqFt: 'pi²',
    bedrooms: 'Chambres',
    bathrooms: 'Salles de bain',
    viewDocuments2: 'Voir les documents',
    unit: 'Unité',
    allFloors: 'Tous les étages',
    totalFloors: 'Étages totaux',
    myResidenceInfo: 'Voir les informations de votre résidence et les contacts',
    viewResidenceInfo: 'Voir les informations de votre résidence et les contacts',
    loading: 'Chargement...',
    noResidencesFound: 'Aucune résidence trouvée',
    noResidencesFoundOrg: 'Aucune résidence trouvée dans votre organisation.',
    selectResidence: 'Sélectionner une résidence',
    selectAResidence: 'Sélectionner une résidence',
    areYouSureDelete: 'Êtes-vous sûr de vouloir supprimer ce contact?',
    parkingSpaces: 'Espaces de stationnement',
    storageSpaces: 'Espaces de rangement',
    myBuildings: 'Mes bâtiments',
    viewBuildingsAccess: 'Voir les bâtiments auxquels vous avez accès',
    noBuildingsFound: 'Aucun bâtiment trouvé',
    noBuildingsAdminMessage: 'Aucun bâtiment n\'est actuellement enregistré dans vos organisations.',
    noBuildingsUserMessage: 'Vous n\'avez pas encore accès à des bâtiments.',
    buildingType: 'Type de bâtiment',
    yearBuilt: 'Année de construction',
    totalUnits: 'Unités totales',
    managementCompany: 'Compagnie de gestion',
    occupancy: 'Occupation',
    parking: 'Stationnement',
    storage: 'Entreposage',
    units: 'unités',
    occupied: 'occupé',
    amenities: 'Commodités',
    moreAmenities: 'de plus',
    buildingInfoUnavailable: 'Informations du bâtiment non disponibles',
    addressUnavailable: 'Adresse non disponible',
    previous: 'Précédent',
    next: 'Suivant',
    showing: 'Affichage',
    residences: 'Résidences',
    buildingDocuments: 'Documents du bâtiment',
    signIn: 'Se connecter',
    demoMode: 'Mode démo',
    firstName: 'Prénom',
    lastName: 'Nom de famille',
    confirmPassword: 'Confirmer le mot de passe',
    enterPassword: 'Entrez le mot de passe',
    enterFirstName: 'Entrez le prénom',
    enterLastName: 'Entrez le nom de famille',
    required: 'Ce champ est requis',
    submit: 'Soumettre',
    send: 'Envoyer',
    reset: 'Réinitialiser',
    clear: 'Effacer',
    add: 'Ajouter',
    remove: 'Retirer',
    update: 'Mettre à jour',
    create: 'Créer',
    fieldRequired: 'Ce champ est requis',
    passwordRequired: 'Le mot de passe est requis pour se connecter',
    invalidEmail: 'Veuillez entrer une adresse courriel valide (exemple: utilisateur@domaine.com)',
    invalidEmailFormat: 'Veuillez entrer une adresse courriel valide (exemple: utilisateur@domaine.com)',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères',
    passwordTooWeak: 'Le mot de passe est trop faible - veuillez utiliser un mot de passe plus fort',
    passwordsNotMatch: 'Les mots de passe ne correspondent pas - veuillez vérifier les deux champs',
    organizationRequired: 'Veuillez sélectionner une organisation dans le menu déroulant',
    buildingRequired: 'Le bâtiment est requis',
    residenceRequired: 'Veuillez sélectionner une unité de résidence spécifique pour les locataires et résidents',
    loginFailed: 'Connexion échouée - veuillez vérifier vos identifiants et réessayer',
    invalidCredentials: 'Courriel ou mot de passe invalide - veuillez réessayer',
    networkError: 'Erreur de connexion réseau - veuillez vérifier votre connexion Internet',
    serverError: 'Erreur serveur survenue - veuillez réessayer plus tard',
    loadingFailed: 'Échec du chargement des données - veuillez actualiser la page et réessayer',
    updateFailed: 'Échec de la mise à jour des informations - veuillez réessayer',
    firstNameTooLong: 'Le prénom doit contenir moins de 50 caractères',
    lastNameTooLong: 'Le nom de famille doit contenir moins de 50 caractères',
    personalMessageTooLong: 'Le message personnel doit contenir moins de 500 caractères',
    reviewAISuggestionsCarefully: 'Veuillez examiner attentivement toutes les valeurs suggérées.',
    email: 'Courriel',
    password: 'Mot de passe',
    login: 'Connexion',
    forgotPassword: 'Mot de passe oublié',
    documentsButton: 'Documents',
    buildingDocumentsButton: 'Documents du bâtiment',
    residenceDocumentsButton: 'Documents de la résidence',
    viewDocumentsButton: 'Voir les documents',
    startFreeTrial: 'Commencez votre essai gratuit',
    tryDemo: 'Essayer la démo',
    allStatusFilter: 'Tous les statuts',
    submittedFilter: 'Soumise',
    underReviewFilter: 'En révision',
    approvedFilter: 'Approuvée',
    inProgressFilter: 'En cours',
    completedFilter: 'Complétée',
    rejectedFilter: 'Rejetée',
    cancelledFilter: 'Annulée',
    draftFilter: 'Brouillon',
    allTypesFilter: 'Tous les types',
    maintenanceFilter: 'Maintenance',
    complaintFilter: 'Plainte',
    informationFilter: 'Information',
    otherFilter: 'Autre',
    buildingsManagement: 'Gestion des bâtiments',
    manageBuildings: 'Gérer tous les bâtiments de votre organisation',
    addBuilding: 'Ajouter un bâtiment',
    editBuilding: 'Modifier le bâtiment',
    createBuilding: 'Créer un bâtiment',
    buildingName: 'Nom du bâtiment',
    buildingAddress: 'Adresse',
    buildingCity: 'Ville',
    buildingProvince: 'Province',
    buildingPostalCode: 'Code postal',
    organizationLabel: 'Organisation',
    enterBuildingName: 'Entrez le nom du bâtiment',
    enterCity: 'Entrez la ville',
    selectProvince: 'Sélectionnez la province',
    enterPostalCode: 'Entrez le code postal',
    selectBuildingType: 'Sélectionnez le type de bâtiment',
    fillBuildingInfo: 'Remplissez les informations du bâtiment ci-dessous. Tous les champs sont obligatoires.',
    allFieldsRequired: 'Tous les champs sont obligatoires',
    buildingNameRequired: 'Le nom du bâtiment est obligatoire',
    cityRequired: 'La ville est obligatoire',
    provinceRequired: 'La province est obligatoire',
    postalCodeRequired: 'Le code postal est obligatoire',
    nameTooLong: 'Nom trop long',
    addressTooLong: 'Adresse trop longue',
    cityTooLong: 'Ville trop longue',
    provinceTooLong: 'Province trop longue',
    postalCodeTooLong: 'Code postal trop long',
    mustHaveAtLeastOneUnit: 'Doit avoir au moins 1 unité',
    maximumUnitsAllowed: 'Maximum 300 unités autorisées',
    searchBuildingsPlaceholder: 'Rechercher des bâtiments par nom ou adresse...',
    unitsCount: 'unités',
    activeBuilding: 'Actif',
    inactiveBuilding: 'Inactif',
    condoType: 'Copropriété',
    apartmentType: 'Appartement',
    appartementType: 'Appartement',
    townhouseType: 'Maison en rangée',
    commercialType: 'Commercial',
    mixedUseType: 'Usage mixte',
    otherBuildingType: 'Autre',
    residencesManagement: 'Gestion des résidences',
    manageResidences: 'Gérer toutes les résidences et unités',
    searchFilters: 'Recherche et filtres',
    searchResidences: 'Recherche',
    buildingFilter: 'Bâtiment',
    floorFilter: 'Étage',
    bed: 'chambre',
    bath: 'salle de bain',
    residents: 'Résidents',
    noResidentsAssigned: 'Aucun résident assigné',
    moreResidents: 'de plus',
    squareFootage: 'Superficie',
    monthShort: 'mois',
    manageResidenceDocuments: 'Gérer les documents de résidence',
    monthlyFees: 'Frais mensuels',
    ownershipPercentage: 'Propriété %',
    editResidence: 'Modifier la résidence',
    viewDocuments: 'Voir les documents',
    budgetDashboard: 'Tableau de bord budgétaire',
    budgetSubtitle: 'Gestion et suivi du budget financier',
    totalBudget: 'Budget total',
    usedBudget: 'Budget utilisé',
    remaining: 'Restant',
    variance: 'Variance',
    ofTotalBudget: 'du budget total',
    percentRemaining: 'restant',
    underBudget: 'Sous le budget',
    overBudget: 'Dépassement de budget',
    budgetCategories: 'Catégories budgétaires',
    monthlySpendingTrend: 'Tendance des dépenses mensuelles',
    utilities: 'Services publics',
    insurance: 'Assurance',
    administration: 'Administration',
    cleaning: 'Nettoyage',
    security: 'Sécurité',
    landscaping: 'Aménagement paysager',
    professionalServices: 'Services professionnels',
    repairs: 'Réparations',
    supplies: 'Fournitures',
    taxes: 'Taxes',
    salary: 'Salaire',
    billsManagement: 'Gestion des factures',
    billsSubtitle: 'Gérer les dépenses des bâtiments et le suivi des revenus',
    filters: 'Filtres',
    year: 'Année',
    months: 'Mois',
    allMonths: 'Tous les mois',
    allCategories: 'Toutes les catégories',
    loadingBuildings: 'Chargement des bâtiments...',
    failedToLoadBuildings: 'Échec du chargement des bâtiments',
    retry: 'Réessayer',
    createFirstBill: 'Créer la première facture',
    noBillsFound: 'Aucune facture trouvée',
    noBillsFoundMessage: 'Aucune facture trouvée pour les filtres sélectionnés. Créez votre première facture pour commencer.',
    loadingBills: 'Chargement des factures...',
    current: 'Actuel',
    demandsManagement: 'Gestion des demandes',
    demandsSubtitle: 'Gérer les demandes de maintenance et réclamations',
    allDemands: 'Toutes les demandes',
    reviewManageDemands: 'Examiner et gérer les demandes des résidents',
    type: 'Type',
    allTypes: 'Tous les types',
    description: 'Description',
    describeDemandDetail: 'Décrivez la demande en détail...',
    creating: 'Création en cours...',
    maintenanceType: 'Entretien',
    complaintType: 'Plainte',
    informationType: 'Information',
    otherType: 'Autre',
    underReview: 'En révision',
    pendingReview: 'En attente de révision',
    activeTab: 'Actif',
    completedTab: 'Terminé',
    all: 'Tout',
    noDemandsPending: 'Aucune demande en attente de révision',
    noActiveDemands: 'Aucune demande active',
    noCompletedDemands: 'Aucune demande terminée',
    totalDemandsLoaded: 'demandes totales chargées, mais filtrées',
    created: 'Créé',
    unknown: 'Inconnu',
    demandCreatedSuccess: 'Demande créée avec succès',
    failedCreateDemand: 'Échec de la création de la demande',
    error: 'Erreur',
    descriptionMinLength: 'La description doit contenir au moins 10 caractères',
    manageAllUsers: 'Gérer tous les utilisateurs',
    total: 'Total',
    sendInvitation: 'Envoyer invitation',
    searchUsers: 'Rechercher des utilisateurs...',
    clearFilters: 'Effacer les filtres',
    clearSelection: 'Effacer la sélection',
    activateSelected: 'Activer la sélection',
    deactivateSelected: 'Désactiver la sélection',
    deleteSelected: 'Supprimer sélectionné',
    rowsPerPage: 'lignes par page',
    name: 'Nom',
    organizations: 'Organisations',
    demoManager: 'Gestionnaire démo',
    demoTenant: 'Locataire démo',
    demoResident: 'Résident démo',
    statusActive: 'Actif',
    statusInactive: 'Inactif',
    editOrganizations: 'Modifier les organisations',
    editBuildings: 'Modifier les bâtiments',
    editResidences: 'Modifier les résidences',
    accountStatus: 'Statut du compte',
    saveChanges: 'Enregistrer les modifications',
    deleteUserTitle: 'Supprimer le compte utilisateur',
    deleteUserDescription: 'Ceci supprimera définitivement et toutes les données associées. Cette action ne peut pas être annulée.',
    reasonOptional: 'Raison de la suppression (optionnel)',
    confirmDeletion: 'Supprimer le compte',
    userUpdatedSuccess: 'Utilisateur mis à jour avec succès',
    buildingAssignmentsUpdated: 'Affectations de bâtiments mises à jour avec succès',
    residenceAssignmentsUpdated: 'Affectations de résidences mises à jour avec succès',
    accountDeleted: 'Compte supprimé',
    accountDeletedDescription: 'Le compte utilisateur et toutes les données associées ont été supprimés définitivement.',
    deletionFailed: 'Échec de la suppression',
    deletionFailedDescription: 'Échec de la suppression du compte',
    firstNameRequired: 'Le prénom est requis (exemple: Jean)',
    firstNameMaxLength: 'Le prénom doit contenir moins de 50 caractères',
    lastNameRequired: 'Le nom de famille est requis (exemple: Dupont)',
    lastNameMaxLength: 'Le nom de famille doit contenir moins de 50 caractères',
    emailInvalid: 'Veuillez entrer une adresse courriel valide (exemple: jean.dupont@email.com)',
    emailConfirmationInvalid: 'Veuillez entrer une adresse courriel valide qui correspond au compte utilisateur',
    reasonMaxLength: 'La raison doit contenir moins de 500 caractères',
    allOrganizations: 'Toutes les organisations',
    loadingUsers: 'Chargement des utilisateurs...',
    basicInfo: 'Informations de base',
    buildings: 'Bâtiments',
    saving: 'Enregistrement...',
    warning: 'Avertissement',
    deleteUserDataWarning: 'Ceci supprimera toutes les données utilisateur incluant',
    profileInfoAccess: 'Informations de profil et accès au compte',
    billsDocsMaintenance: 'Factures, documents et demandes de maintenance',
    enterReasonDeletion: 'Entrer la raison de la suppression...',
    deleting: 'Suppression...',
    page: 'Page',
    of: 'de',
    settings: 'Paramètres',
    generalSettings: 'Paramètres généraux',
    securitySettings: 'Paramètres de sécurité',
    additionalSettings: 'Paramètres supplémentaires',
    privacyDataCompliance: 'Confidentialité et données (Conformité Loi 25)',
    future: 'Futur',
    notifications: 'Notifications',
    theme: 'Thème',
    advanced: 'Avancé',
    phone: 'Téléphone',
    language: 'Langue',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    changePassword: 'Changer le mot de passe',
    changing: 'Modification...',
    selectLanguage: 'Sélectionner la langue',
    yourDataRights: 'Vos droits sur les données',
    exportData: 'Exporter données',
    exportDataDescription: 'Télécharger une copie de toutes vos données personnelles stockées dans notre système.',
    exporting: 'Exportation...',
    deleteAccount: 'Supprimer le compte',
    deleteAccountDescription: 'Supprimer définitivement votre compte et toutes les données associées.',
    confirmEmailDelete: 'Confirmez en tapant votre adresse courriel',
    reasonForDeletion: 'Raison de la suppression (optionnel)',
    enterReasonForDeletion: 'Entrer la raison de la suppression...',
    // Common no data messages
    noData: 'Aucune donnée',
    noDataAvailable: 'Aucune donnée disponible',
    noDataFound: 'Aucune donnée trouvée',
    noBookingsFound: 'Aucune réservation trouvée pour cet espace au cours des 12 derniers mois.',
    noBookingsFoundMessage: 'Aucune réservation trouvée pour cet espace au cours des 12 derniers mois.',
    selectCommonSpace: 'Sélectionnez un espace commun',
    selectCommonSpaceMessage: "Choisissez un bâtiment et un espace commun pour voir les statistiques d'utilisation.",
    noComplianceData: 'Aucune donnée de conformité disponible',
    noComplianceDataMessage: 'Exécutez l\'analyse de conformité pour voir le statut de conformité à la Loi 25.',
    noCertificateFound: 'Aucun certificat trouvé',
    noCertificateFoundMessage: 'Aucun certificat SSL trouvé pour ce domaine.',
    // Invitation management (moved to prevent duplicates)
    invitationDeletedSuccess: 'Invitation supprimée avec succès',
    invitationDeletedError: 'Échec de la suppression de l\'invitation',
    deleteAccountAction: 'Supprimer le compte',
    profileUpdated: 'Profil mis à jour',
    profileUpdatedDescription: 'Votre profil a été mis à jour avec succès.',
    failedUpdateProfile: 'Échec de la mise à jour du profil',
    passwordChanged: 'Mot de passe modifié',
    passwordChangedDescription: 'Votre mot de passe a été modifié avec succès.',
    failedChangePassword: 'Échec de la modification du mot de passe',
    dataExported: 'Données exportées',
    dataExportedDescription: 'Vos données ont été téléchargées avec succès.',
    bugReports: 'Rapports de bogues',
    reportBug: 'Signaler un bogue',
    reportNewBug: 'Signaler un nouveau bogue',
    searchBugs: 'Rechercher des bogues...',
    new: 'Nouveau',
    acknowledged: 'Reconnu',
    resolved: 'Résolu',
    closed: 'Fermé',
    allPriority: 'Toutes les priorités',
    low: 'Faible',
    medium: 'Moyen',
    critical: 'Critique',
    priority: 'Priorité',
    pageLocation: 'Page/Emplacement',
    stepsToReproduce: 'Étapes pour reproduire',
    stepsToReproduceOptional: 'Étapes pour reproduire (Optionnel)',
    reproducePlaceholder: 'Décrivez les étapes pour reproduire ce problème...',
    attachDocumentsOptional: 'Joindre des documents (Optionnel)',
    submitting: 'Soumission...',
    submitBugReport: 'Soumettre le rapport de bogue',
    editBug: 'Modifier le bogue',
    deleteBug: 'Supprimer le bogue',
    selectPriority: 'Sélectionner la priorité',
    locationPlaceholder: 'ex. Tableau de bord, Page de connexion, Paramètres',
    uiUx: 'UI/UX',
    functionality: 'Fonctionnalité',
    performance: 'Performance',
    data: 'Données',
    integration: 'Intégration',
    bugCreatedSuccess: 'Rapport de bogue créé avec succès',
    failedCreateBug: 'Échec de la création du rapport de bogue',
    bugUpdatedSuccess: 'Rapport de bogue mis à jour avec succès',
    failedUpdateBug: 'Échec de la mise à jour du rapport de bogue',
    bugDeletedSuccess: 'Rapport de bogue supprimé avec succès',
    ideaBox: 'Boîte à idées',
    shareIdeasImprove: 'Partagez vos idées pour améliorer notre plateforme',
    submitNewIdea: 'Soumettre une nouvelle idée',
    createIdea: 'Créer une idée',
    searchIdeas: 'Rechercher des idées...',
    sortBy: 'Trier par',
    newest: 'Plus récent',
    oldest: 'Plus ancien',
    upvotes: 'Votes positifs',
    featureTitle: 'Titre de la fonctionnalité',
    need: 'Besoin',
    needExplanation: 'Explication du besoin',
    upvote: 'Vote positif',
    upvoted: 'Vote enregistré',
    yesterday: 'Hier',
    daysAgo: 'jours',
    weeksAgo: 'semaines',
    planned: 'Planifié',
    propertyManagement: 'Gestion immobilière',
    residentManagement: 'Gestion des résidents',
    financialManagement: 'Gestion financière',
    documentManagement: 'Gestion documentaire',
    communication: 'Communication',
    reports: 'Rapports',
    mobileApp: 'Application mobile',
    integrations: 'Intégrations',
    ideaSubmitted: 'Idée soumise !',
    ideaSubmittedDescription: 'Votre idée de fonctionnalité a été soumise avec succès.',
    ideaUpdated: 'Idée mise à jour !',
    upvotedMessage: 'Vote enregistré !',
    upvotedDescription: 'Votre vote positif a été enregistré.',
    failedUpvote: 'Échec du vote',
    ideaDeleted: 'Idée supprimée !',
    organizationsManagement: 'Gestion des organisations',
    organizationsManagementDesc: 'Créer, consulter, modifier et supprimer les organisations du système',
    createEditDeleteOrganizations: 'Créer, modifier et supprimer les organisations',
    permissionsManagement: 'Gestion des permissions',
    systemPermissions: 'Permissions système',
    permissionSettings: 'Paramètres de permissions',
    quebecLaw25Compliance: 'Conformité Loi 25 du Québec',
    privacyComplianceMonitoring: 'Surveillance de la conformité à la vie privée et suivi des violations',
    violationTracking: 'Suivi des violations',
    scanCommand: 'Commande de balayage',
    semgrepCli: 'Interface de ligne de commande Semgrep',
    qualityMetricsTracking: 'Suivi des métriques et assurance qualité',
    refreshCommand: 'Commande de rafraîchissement',
    documentationCenter: 'Centre de documentation',
    generateManageDocumentation: 'Générer et gérer la documentation du projet',
    projectOverview: 'Aperçu du projet',
    technicalComponents: 'Composants techniques',
    apiSpecifications: 'Spécifications API',
    databaseSchema: 'Schéma de base de données',
    dependencyInformation: 'Informations sur les dépendances',
    productRoadmap: 'Feuille de route produit',
    featurePlanningCapabilities: 'Capacités de planification des fonctionnalités',
    roadmapManagement: 'Gestion de la feuille de route',
    featureStatus: 'Statut des fonctionnalités',
    priorityManagement: 'Gestion des priorités',
    developmentFrameworkMethodology: 'Cadre de développement et méthodologie',
    validateCommand: 'Commande de validation',
    suggestionsManagement: 'Gestion des suggestions',
    suggestionReview: 'Révision des suggestions',
    createNew: 'Créer nouveau',
    editSelected: 'Modifier sélectionné',
    dataExport: 'Exportation de données',
    importData: 'Importer données',
    manageUsers: 'Gérer utilisateurs',
    assignRoles: 'Assigner rôles',
    revokePermissions: 'Révoquer permissions',
    grantPermissions: 'Accorder permissions',
    activateAccount: 'Activer compte',
    deactivateAccount: 'Désactiver compte',
    cancelInvitation: 'Annuler invitation',
    resendInvitation: 'Renvoyer invitation',
    systemSettings: 'Paramètres système',
    systemBackup: 'Sauvegarde système',
    complianceReport: 'Rapport de conformité',
    performanceMetrics: 'Métriques de performance',
    privacyAudit: 'Audit de confidentialité',
    dataRetentionPolicy: 'Politique de conservation des données',
    consentManagement: 'Gestion du consentement',
    dataPortability: 'Portabilité des données',
    insufficientPermissions: 'Permissions insuffisantes',
    permissionRevocationFailed: 'Échec de la révocation des permissions',
    unauthorized: 'Non autorisé',
    systemError: 'Erreur système',
    configurationError: 'Erreur de configuration',
    validationFailed: 'Échec de la validation',
    connectionError: 'Erreur de connexion',
    privacyViolation: 'Violation de la vie privée',
    dataRetentionViolation: 'Violation de la conservation des données',
    consentRequired: 'Consentement requis',
    dataProcessingError: 'Erreur de traitement des données',
    complianceCheckFailed: 'Échec de la vérification de conformité',
    userActive: 'Actif',
    userInactive: 'Inactif',
    userPending: 'En attente',
    userSuspended: 'Suspendu',
    systemOnline: 'En ligne',
    systemOffline: 'Hors ligne',
    maintenanceMode: 'Mode de maintenance',
    backupInProgress: 'Sauvegarde en cours',
    updateAvailable: 'Mise à jour disponible',
    securityAlert: 'Alerte de sécurité',
    compliant: 'Conforme',
    nonCompliant: 'Non conforme',
    requiresAction: 'Nécessite une action',
    auditRequired: 'Audit requis',
    donneesPersonnelles: 'Données personnelles',
    consentementEclaire: 'Consentement éclairé',
    portabiliteDonnees: 'Portabilité des données',
    responsableTraitement: 'Responsable du traitement',
    sousTraitant: 'Sous-traitant',
    violationDonnees: 'Violation de données',
    notificationViolation: 'Notification de violation',
    registreTraitement: 'Registre de traitement',
    auditConformite: 'Audit de conformité',
    mesuresSecurite: 'Mesures de sécurité',
    conservationDonnees: 'Conservation des données',
    suppressionDonnees: 'Suppression des données',
    rectificationDonnees: 'Rectification des données',
    analytics: 'Analytiques',
    compliance: 'Conformité',
    createdAt: 'Créé le',
    updatedAt: 'Mis à jour le',
    january: 'Janvier',
    february: 'Février',
    march: 'Mars',
    april: 'Avril',
    may: 'Mai',
    june: 'Juin',
    july: 'Juillet',
    august: 'Août',
    september: 'Septembre',
    october: 'Octobre',
    november: 'Novembre',
    december: 'Décembre',
    tenants: 'Locataires',
    noTenants: 'Aucun locataire assigné',
    residenceDetails: 'Détails de la résidence',
    privacyPolicyTitle: 'Politique de confidentialité',
    lastUpdated: 'Dernière mise à jour :',
    informationCollection: '1. Collecte des renseignements',
    informationCollectionDesc: 'Nous collectons les renseignements personnels suivants dans le cadre de nos services :',
    informationUse: '2. Utilisation des renseignements',
    informationUseDesc: 'Vos renseignements personnels sont utilisés exclusivement pour :',
    informationSharing: '3. Partage et divulgation',
    privacyRights: '4. Vos droits',
    dataSecurity: '5. Sécurité des données',
    contactPrivacy: '6. Nous contacter',
    securityTitle: 'Sécurité et conformité',
    securityIntro: 'La sécurité de vos données est notre priorité absolue. Découvrez comment nous protégeons vos informations avec des mesures de sécurité de niveau entreprise et la conformité à la Loi 25 du Québec.',
    enterpriseEncryption: 'Chiffrement de niveau entreprise',
    enterpriseEncryptionDesc: 'Toutes les données sont chiffrées en transit et au repos avec des standards militaires AES-256.',
    quebecDataProtection: 'Protection des données québécoises',
    quebecDataProtectionDesc: 'Conformité stricte à la Loi 25 du Québec avec hébergement des données au Canada.',
    secureInfrastructure: 'Infrastructure sécurisée',
    secureInfrastructureDesc: 'Architecture cloud redondante avec surveillance 24/7 et sauvegardes automatisées.',
    ourStoryTitle: 'Notre histoire',
    foundationYear: '2023',
    foundationTitle: 'Fondation de Koveo Gestion',
    developmentYear: '2024',
    developmentTitle: 'Développement de la plateforme',
    developmentDesc: 'Conception et développement de notre solution complète en conformité avec la Loi 25 du Québec.',
    launchYear: '2025',
    launchTitle: 'Lancement officiel',
    launchDesc: 'Lancement de notre plateforme avec support bilingue complet et conformité québécoise.',
    quickActions: 'Actions rapides',
    calendar: 'Calendrier',
    myResidence: 'Ma résidence',
    myBuilding: 'Mon bâtiment',
    commonSpaces: 'Espaces communs',
    budget: 'Budget',
    bills: 'Factures',
    demands: 'Demandes',
    navUserManagement: 'Gestion des utilisateurs',
    manageCommonSpaces: 'Gérer les espaces communs',
    documentation: 'Documentation',
    pillars: 'Piliers',
    roadmap: 'Feuille de route',
    navQualityAssurance: 'Assurance qualité',
    navLaw25Compliance: 'Conformité Loi 25',
    rbacPermissions: 'Permissions RBAC',
    modernPropertyManagement: 'Gestion immobilière moderne',
    forQuebec: 'pour le Québec',
    comprehensivePropertyManagement: 'Solution de gestion immobilière complète conçue spécifiquement pour les communautés résidentielles du Québec',
    goToDashboard: 'Aller au tableau de bord',
    everythingYouNeed: 'Tout ce dont vous avez besoin',
    builtForPropertyOwners: 'Conçu pour les propriétaires et gestionnaires immobiliers',
    buildingManagement: 'Gestion de bâtiments',
    residentPortal: 'Portail des résidents',
    residentPortalDesc: 'Portail libre-service pour les résidents et locataires',
    financialReporting: 'Rapports financiers',
    financialReportingDesc: 'Suivi et rapports financiers complets',
    quebecCompliance: 'Conformité québécoise',
    quebecComplianceDesc: 'Conformité complète à la Loi 25 du Québec et aux réglementations',
    whyChooseKoveo: 'Pourquoi choisir Koveo?',
    quebecLaw25Compliant: 'Conforme à la Loi 25 du Québec',
    quebecLaw25CompliantDesc: 'Protection de la vie privée et sécurité des données intégrées',
    bilingualSupport: 'Support bilingue',
    bilingualSupportDesc: 'Support complet en français et en anglais',
    cloudBasedSecurity: 'Sécurité basée sur le nuage',
    cloudBasedSecurityDesc: 'Sécurité de niveau entreprise et sauvegardes automatisées',
    mobileResponsive: 'Compatible mobile',
    mobileResponsiveDesc: 'Accédez à vos outils de gestion immobilière partout',
    expertSupportDesc: 'Équipe de support dédiée basée au Québec',
    readyToTransform: 'Prêt à transformer votre gestion immobilière?',
    joinPropertyOwners: 'Rejoignez des centaines de propriétaires québécois qui font confiance à Koveo Gestion',
    getStartedNow: 'Commencer maintenant',
    yourDataIsProtected: 'Vos données sont protégées',
    menu: 'Menu',
    navigation: 'Navigation',
    account: 'Compte',
    home: 'Accueil',
    features: 'Fonctionnalités',
    ourStory: 'Notre histoire',
    privacyPolicy: 'Politique de confidentialité',
    logout: 'Déconnexion',
    getStarted: 'Commencer',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Conforme à la Loi 25 du Québec',
    pricing: 'Tarification',
    simplePricing: 'Tarification simple et transparente',
    pricingSubtitle: 'Gestion immobilière professionnelle qui évolue avec votre entreprise',
    professionalPlan: 'Plan professionnel',
    perfectForPropertyManagers: 'Parfait pour les gestionnaires immobiliers de toutes tailles',
    perDoorPerMonth: 'par porte par mois',
    whatsIncluded: 'Ce qui est inclus :',
    unlimitedResidents: 'Résidents illimités',
    documentStorage: 'Stockage sécurisé de documents',
    maintenanceTracking: 'Suivi de maintenance',
    financialReports: 'Rapports financiers',
    law25Protection: 'Protection Loi 25 du Québec',
    multilingualSupport: 'Support bilingue (FR/EN)',
    mobileAccess: 'Accès mobile',
    cloudBackup: 'Sauvegarde automatique dans le nuage',
    emailSupport: 'Support par courriel',
    regularUpdates: 'Mises à jour régulières',
    documentManagementDesc: 'Stockage et organisation sécurisés',
    documentDescription: 'Description du document',
    documentTitle: 'Titre du document',
    searchDocuments: 'Rechercher des documents...',
    smartNotifications: 'Notifications intelligentes',
    smartNotificationsDesc: 'Alertes et rappels automatisés',
    electronicBilling: 'Facturation électronique',
    electronicBillingDesc: 'Facturation numérique et suivi des paiements',
    centralizedCommunication: 'Communication centralisée',
    centralizedCommunicationDesc: 'Plateforme de messagerie unifiée',
    maintenancePlanning: 'Planification de maintenance',
    maintenancePlanningDesc: 'Planification et suivi intelligents',
    processManagement: 'Gestion des processus',
    processManagementDesc: 'Outils de flux de travail organisés',
    law25Compliance: 'Conformité Loi 25 du Québec',
    law25ComplianceDesc: 'Protection de la vie privée intégrée',
    featuresOverviewDesc: 'Solution complète pour la gestion immobilière moderne',
    viewAllFeatures: 'Voir toutes les fonctionnalités',
    readyToGetStarted: 'Prêt à commencer?',
    allRightsReserved: 'Tous droits réservés',
    residenceDocuments: 'Documents de résidence',
    manageDocumentsResidence: 'Gérer les documents de cette résidence',
    documentsCount: 'Documents ({count})',
    myDemands: 'Mes demandes',
    showingResults: 'Affichage de {start} à {end} sur {total} demandes',
    manageBuildingsOrganization: 'Gérer {count} bâtiments dans votre organisation',
    searchBuildingsAddress: 'Rechercher des bâtiments par nom ou adresse...',
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    save: 'Enregistrer',
    close: 'Fermer',
    edit: 'Modifier',
    delete: 'Supprimer',
    en: 'English',
    fr: 'Français',
    initializationProgress: 'Initialization Progress',
    coreQualityAssurance: 'Core quality assurance framework',
    workspaceStatus: 'Workspace Statut',
    environmentSetup: 'Environment Setup',
    setupValidationQualityAssurance: 'Set up validation and quality assurance framework',
    completedToday: 'Completed Today',
    availableAfterQACompletion: 'Available after QA pillar completion',
    moreActions: 'More Actions',
    enterEmailAddress: 'Enter courriel adresse',
    selectOrganization: 'Select organisation',
    require2FADescription: 'Require two-factor authentication for this utilisateur',
    personalMessageDescription: 'This message will be included in the invitation courriel',
    _error: 'An erreur occurred',
    bulkActionSuccessDescription: 'The bulk action has been completed succèsfully',
    selectUsersForBulkAction: 'Please select utilisateurs to perform bulk action',
    invitationSentDescription: 'Invitation has been sent succèsfully to the utilisateur',
    userUpdatedSuccessfully: 'Utilisateur has been mettre à jourd succèsfully',
    editUser: 'Modifier Utilisateur',
    updateUser: 'Mettre à jour Utilisateur',
    userDeletedSuccessfully: 'Utilisateur has been supprimerd succèsfully',
    joinedDate: 'Joined Date',
    deactivateUser: 'Deactivate Utilisateur',
    activateUser: 'Activate Utilisateur',
    deleteUser: 'Supprimer Utilisateur',
    editUserDescription: 'Mettre à jour utilisateur information and permissions',
    selectUser: 'Select utilisateur {nom}',
    invitationLinkCopied: 'Invitation link copied to clipboard',
    invitationActions: 'Invitation Actions',
    selectSchedule: 'Select schedule',
    failedToReviewDemand: 'Échec to review demand',
    addNotesReviewDecision: 'Ajouter notes about your review decision',
    addNotesReview: 'Ajouter notes about the review',
    organizationOverview: 'Organisation Overview',
    viewManageResidences: 'View and manage organisation résidences',
    notAssignedResidences: 'You are not assigned to any résidences.',
    occupancyStats: 'Occupancy Stats',
    unableToDisplayAmenities: 'Unable to display amenities',
    emailRequired: 'Courriel adresse is requis',
    unexpectedError: 'An unexpected erreur occurred - please contact support if this continues',
    saveFailed: 'Échec to enregistrer changes - please try again',
    deleteFailed: 'Échec to supprimer item - please try again',
    firstNameInvalidCharacters: 'First nom can only contain letters, spaces, apostrophes and hyphens',
    lastNameInvalidCharacters: 'Last nom can only contain letters, spaces, apostrophes and hyphens',
    expiryDaysInvalid: 'Expiry days must be between 1 and 30 days',
    emailOrNameRequired: 'Courriel adresse is requis for regular invitations (example: utilisateur@domain.com). For demo utilisateurs, provide first nom and last nom.',
    aiAnalysisWarning: 'AI Analysis Warning',
    lowConfidenceAIWarning: 'AI analysis has low confidence:',
    enterStreetAddress: 'Enter street adresse',
    addressRequired: 'Adresse is requis',
    searchUnitTenant: 'Rechercher by unit number or tenant nom...',
    unitNumber: 'Unit Number',
    adjustSearchCriteria: 'Try adjusting your rechercher criteria',
    fromLastYear: 'from last year',
    budgetAnalyticsChart: 'Budget analytics chart would appear here',
    showMoreYears: 'Show more years',
    showFewerYears: 'Show fewer years',
    createDemandBehalf: 'Créer a demand on behalf of a resident',
    editUserTitle: 'Modifier Utilisateur',
    organizationAssignmentsUpdated: 'Organisation assignments mettre à jourd succèsfully',
    anErrorOccurred: 'An erreur occurred',
    firstNameInvalidChars: 'First nom can only contain letters, spaces, apostrophes and hyphens',
    lastNameInvalidChars: 'Last nom can only contain letters, spaces, apostrophes and hyphens',
    roleRequired: 'Please select a utilisateur role',
    emailConfirmationRequired: 'Courriel confirmeration is requis to supprimer utilisateur',
    orgResidenceAssignments: 'Organisation and résidence assignments',
    notificationsActivity: 'Notifications and activity history',
    manageAccountSettings: 'Manage your account and application paramètres',
    username: 'Utilisateurnom',
    exportFailed: 'Export échec',
    failedExportData: 'Échec to export data',
    reportTrackIssues: 'Report and track application issues',
    today: 'Today',
    failedSubmitIdea: 'Échec to soumettre idea',
    ideaUpdatedDescription: 'Feature idea has been mettre à jourd succèsfully.',
    failedUpdateIdea: 'Échec to mettre à jour idea',
    ideaDeletedDescription: 'The feature idea has been supprimerd succèsfully.',
    failedDeleteIdea: 'Échec to supprimer idea',
    permissionsManagementDesc: 'Manage utilisateur roles and system permissions',
    roleBasedAccessControl: 'Role-Based Access Control',
    userRoles: 'Utilisateur Roles',
    userFeedbackSuggestions: 'Utilisateur feedretour and suggestions',
    auditLogs: 'Audit Logs',
    rightToErasure: 'Right to Erasure',
    privacyImpactAssessment: 'Privacy Impact Assessment',
    roleAssignmentFailed: 'Role Assignment Échec',
    operationFailed: 'Operation Échec',
    timeoutError: 'Timeout Erreur',
    droitALOubli: 'Right to be Forgotten',
    evaluationImpactViePrivee: 'Privacy Impact Assessment',
    roleBasedAccess: 'Role-based access control',
    roleBasedAccessDesc: 'Granular authorization system ensuring each utilisateur only accesses necessary information.',
    storyIntro: 'Discover the story behind Koveo Gestion and our mission to modernize property gestion in Quebec.',
    foundationDesc: 'Company creation with the mission to modernize property gestion in Quebec.',
    startManagingToday: 'Start managing today',
    buildingManagementDesc: 'Complete bâtiment and unit gestion system',
    expertSupport: 'Support expert',
    termsOfService: 'Conditions de service',
    noSetupFees: 'Aucun frais d\'installation',
    noDocumentsUploadedYet: 'Aucun document n\'a encore été téléchargé pour cette résidence.',
  }
};