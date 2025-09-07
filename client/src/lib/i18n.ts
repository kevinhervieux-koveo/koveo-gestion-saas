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
  // Performance metrics
  responseTime: string;
  memoryUsage: string;
  bundleSize: string;
  dbQueryTime: string;
  pageLoadTime: string;
  nextActions: string;
  initializeQAPillar: string;
  setupValidationQualityAssurance: string;
  configureTesting: string;
  // Continuous Improvement Pillar translations
  continuousImprovementPillar: string;
  continuousImprovementDescription: string;
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
  accessDeniedDescription: string;
  // User management
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
  // Invitation management
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
  // Additional user management translations
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
  // Missing user management translations
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
  // Additional invitation management translations
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
  // Form and UI translations
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
  // Page content translations
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
  // Status label translations
  draft: string;
  maintenance: string;
  complaint: string;
  information: string;
  other: string;
  allStatus: string;
  // Dialog and form translations
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
  // Additional form labels and placeholders
  describeRequestDetail: string;
  submittedBy: string;
  addNotesReviewDecision: string;
  addNotesReview: string;
  selectBuilding2: string;
  // Status options for manager
  submitted2: string;
  // Document management translations
  // Type placeholders
  typePlaceholder: string;
  buildingPlaceholder: string;
  // Dashboard and major page content
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
  // More residence page translations
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
  // Building page translations
  myBuildings: string;
  viewBuildingsAccess: string;
  noBuildingsFound: string;
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
  // Error Messages
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
  // AI Analysis warnings
  aiAnalysisWarning: string;
  lowConfidenceAIWarning: string;
  reviewAISuggestionsCarefully: string;
  // Core field labels for forms
  email: string;
  password: string;
  login: string;
  forgotPassword: string;
  // Document button standardization
  documentsButton: string;
  buildingDocumentsButton: string;
  residenceDocumentsButton: string;
  viewDocumentsButton: string;
  startFreeTrial: string;
  tryDemo: string;
  previous: string;
  next: string;
  // Status filter labels
  allStatusFilter: string;
  submittedFilter: string;
  underReviewFilter: string;
  approvedFilter: string;
  inProgressFilter: string;
  completedFilter: string;
  rejectedFilter: string;
  cancelledFilter: string;
  draftFilter: string;
  // Type filter labels
  allTypesFilter: string;
  maintenanceFilter: string;
  complaintFilter: string;
  informationFilter: string;
  otherFilter: string;
  // Manager Buildings page
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
  buildingType: string;
  totalUnits: string;
  organizationLabel: string;
  enterBuildingName: string;
  enterStreetAddress: string;
  enterCity: string;
  selectProvince: string;
  enterPostalCode: string;
  selectBuildingType: string;
  selectOrganization: string;
  fillBuildingInfo: string;
  allFieldsRequired: string;
  buildingNameRequired: string;
  addressRequired: string;
  cityRequired: string;
  provinceRequired: string;
  postalCodeRequired: string;
  organizationRequired: string;
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
  // Building types
  condoType: string;
  apartmentType: string;
  townhouseType: string;
  commercialType: string;
  mixedUseType: string;
  otherBuildingType: string;
  // Manager Residences page
  residencesManagement: string;
  manageResidences: string;
  searchFilters: string;
  searchResidences: string;
  searchUnitTenant: string;
  buildingFilter: string;
  floorFilter: string;
  allBuildings: string;
  allFloors: string;
  unitNumber: string;
  floor: string;
  bedrooms: string;
  noResidencesFound: string;
  adjustSearchCriteria: string;
  active: string;
  inactive: string;
  bed: string;
  bath: string;
  parking: string;
  storage: string;
  residents: string;
  noResidentsAssigned: string;
  moreResidents: string;
  bathrooms: string;
  squareFootage: string;
  sqFt: string;
  monthShort: string;
  manageResidenceDocuments: string;
  monthlyFees: string;
  ownershipPercentage: string;
  editResidence: string;
  viewDocuments: string;
  // Budget page translations
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
  // Budget categories
  maintenance: string;
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
  other: string;
  // Bills page translations
  billsManagement: string;
  billsSubtitle: string;
  filters: string;
  building: string;
  category: string;
  year: string;
  months: string;
  allMonths: string;
  allCategories: string;
  selectBuilding: string;
  loadingBuildings: string;
  failedToLoadBuildings: string;
  retry: string;
  createBill: string;
  createNewBill: string;
  createFirstBill: string;
  noBillsFound: string;
  noBillsFoundMessage: string;
  loadingBills: string;
  current: string;
  showMoreYears: string;
  showFewerYears: string;
  // Month names
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
  // Privacy Policy page
  privacyPolicyTitle: string;
  lastUpdated: string;
  privacyPolicyIntro: string;
  informationCollection: string;
  informationCollectionDesc: string;
  informationUse: string;
  informationUseDesc: string;
  informationSharing: string;
  privacyRights: string;
  dataSecurity: string;
  contactPrivacy: string;
  // Security page
  securityTitle: string;
  securityIntro: string;
  enterpriseEncryption: string;
  enterpriseEncryptionDesc: string;
  roleBasedAccess: string;
  roleBasedAccessDesc: string;
  quebecDataProtection: string;
  quebecDataProtectionDesc: string;
  secureInfrastructure: string;
  secureInfrastructureDesc: string;
  // Story page
  ourStoryTitle: string;
  storyIntro: string;
  foundationYear: string;
  foundationTitle: string;
  foundationDesc: string;
  developmentYear: string;
  developmentTitle: string;
  developmentDesc: string;
  launchYear: string;
  launchTitle: string;
  launchDesc: string;
  // Documents page translations
  // Navigation translations
  quickActions: string;
  calendar: string;
  residents: string;
  myResidence: string;
  myBuilding: string;
  commonSpaces: string;
  buildings: string;
  budget: string;
  bills: string;
  demands: string;
  navUserManagement: string;
  manageCommonSpaces: string;
  organizations: string;
  documentation: string;
  pillars: string;
  roadmap: string;
  navQualityAssurance: string;
  navLaw25Compliance: string;
  rbacPermissions: string;
  settings: string;
  bugReports: string;
  ideaBox: string;
  // Home page translations
  modernPropertyManagement: string;
  forQuebec: string;
  comprehensivePropertyManagement: string;
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
  quebecComplianceDesc: string;
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
  // Hamburger menu translations
  menu: string;
  navigation: string;
  account: string;
  home: string;
  features: string;
  security: string;
  ourStory: string;
  privacyPolicy: string;
  termsOfService: string;
  logout: string;
  getStarted: string;
  language: string;
  openMenu: string;
  closeMenu: string;
  copyright: string;
  law25Compliant: string;
  // Pricing page translations
  pricing: string;
  simplePricing: string;
  pricingSubtitle: string;
  professionalPlan: string;
  perfectForPropertyManagers: string;
  perDoorPerMonth: string;
  noSetupFees: string;
  whatsIncluded: string;
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
  documentManagement: string;
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
  // Residence Documents translations
  residenceDocuments: string;
  manageDocumentsResidence: string;
  documentsCount: string;
  noDocumentsUploadedYet: string;
  // Demands page translations
  myDemands: string;
  allTypes: string;
  showingResults: string;
  // Buildings management translations
  manageBuildingsOrganization: string;
  searchBuildingsAddress: string;
  addBuilding: string;
  // Fullscreen controls
  fullscreen: string;
  exitFullscreen: string;
  // Common action buttons
  save: string;
  cancel: string;
  saving: string;
  close: string;
  edit: string;
  delete: string;
  phone: string;
}

const translations: Record<Language, Translations> = {
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
    // Performance metrics
    responseTime: 'Response Time',
    memoryUsage: 'Memory Usage',
    bundleSize: 'Bundle Size',
    dbQueryTime: 'DB Query Time',
    pageLoadTime: 'Page Load Time',
    nextActions: 'Next Actions',
    initializeQAPillar: 'Initialize QA Pillar',
    setupValidationQualityAssurance: 'Set up validation and quality assurance framework',
    configureTesting: 'Configure Testing',
    // Continuous Improvement translations
    continuousImprovementPillar: 'Continuous Improvement',
    continuousImprovementDescription:
      'AI-driven metrics, analytics, and automated improvement suggestions',
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
    accessDeniedDescription:
      'You do not have sufficient permissions to access this resource. Please contact your administrator or property manager to request the necessary permissions.',
    // User management
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
    users: 'users',
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
    // Invitation management
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
    // Additional user management translations
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
    // Missing user management translations
    userUpdated: 'User Updated',
    userUpdatedSuccessfully: 'User has been updated successfully',
    editUser: 'Edit User',
    status: 'Status',
    activeUser: 'Active User',
    updating: 'Updating...',
    updateUser: 'Update User',
    userDeleted: 'User Deleted',
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
    editUserDescription: 'Edit the user details for {name}',
    confirmDeleteUser: 'Are you sure you want to delete {name}?',
    selectedUsers: '{count} users selected',
    selectUser: 'Select user {name}',
    // Additional invitation management translations
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
    // Form and UI translations
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
    // Page content translations
    loadingDemands: 'Loading demands...',
    searchDemandsUsers: 'Search demands and users...',
    submitAndTrack: 'Submit and track',
    reviewDemand: 'Review Demand',
    failedToReviewDemand: 'Failed to review demand',
    error: 'An error occurred',
    submitted: 'Submitted',
    underReview: 'Under Review',
    approved: 'Approved',
    completed: 'Completed',
    rejected: 'Rejected',
    // Status label translations
    draft: 'Draft',
    maintenance: 'Maintenance',
    complaint: 'Complaint',
    information: 'Information',
    other: 'Other',
    allStatus: 'All Status',
    // Dialog and form translations
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
    // Additional form labels and placeholders
    describeRequestDetail: 'Describe your request in detail',
    submittedBy: 'Submitted by',
    addNotesReviewDecision: 'Add notes about your review decision',
    addNotesReview: 'Add notes about the review',
    selectBuilding2: 'Select a building',
    // Status options for manager
    submitted2: 'Submitted',
    // Type placeholders
    typePlaceholder: 'Select type...',
    buildingPlaceholder: 'Select building...',
    // Dashboard and major page content
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
    sqFt: 'Sq Ft',
    bedrooms: 'Bedrooms',
    bathrooms: 'Bathrooms',
    viewDocuments2: 'View Documents',
    unit: 'Unit',
    allFloors: 'All Floors',
    totalFloors: 'Total Floors',
    // More residence page translations
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
    // Building page translations
    myBuildings: 'My Buildings',
    viewBuildingsAccess: 'View buildings you have access to',
    noBuildingsFound: 'No buildings found',
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
    residences: 'residences',
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
    // Error Messages
    fieldRequired: 'This field is required',
    emailRequired: 'Email address is required to sign in',
    passwordRequired: 'Password is required to sign in',
    invalidEmail: 'Please enter a valid email address (example: user@domain.com)',
    invalidEmailFormat: 'Please enter a valid email address (example: user@domain.com)',
    passwordTooShort: 'Password must be at least 8 characters long',
    passwordTooWeak: 'Password is too weak - please use a stronger password',
    passwordsNotMatch: 'Passwords do not match - please check both fields',
    firstNameRequired: 'First name is required for registration',
    lastNameRequired: 'Last name is required for registration',
    organizationRequired: 'Please select an organization from the dropdown',
    buildingRequired: 'Please select a building from the dropdown',
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
    // AI Analysis warnings
    aiAnalysisWarning: 'AI Analysis Warning',
    lowConfidenceAIWarning: 'AI analysis has low confidence:',
    reviewAISuggestionsCarefully: 'Please review all suggested values carefully.',
    // Core field labels for forms
    email: 'Email',
    password: 'Password',
    login: 'Login',
    forgotPassword: 'Forgot Password',
    // Document button standardization
    documentsButton: 'Documents',
    buildingDocumentsButton: 'Building Documents',
    residenceDocumentsButton: 'Residence Documents',
    viewDocumentsButton: 'View Documents',
    startFreeTrial: 'Start your free trial',
    tryDemo: 'Try Demo',
    previous: 'Previous',
    next: 'Next',
    // Status filter labels
    allStatusFilter: 'All Status',
    submittedFilter: 'Submitted',
    underReviewFilter: 'Under Review',
    approvedFilter: 'Approved',
    inProgressFilter: 'In Progress',
    completedFilter: 'Completed',
    rejectedFilter: 'Rejected',
    cancelledFilter: 'Cancelled',
    draftFilter: 'Draft',
    // Type filter labels
    allTypesFilter: 'All Types',
    maintenanceFilter: 'Maintenance',
    complaintFilter: 'Complaint',
    informationFilter: 'Information',
    otherFilter: 'Other',
    // Manager Buildings page
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
    buildingType: 'Building Type',
    totalUnits: 'Total Units',
    organizationLabel: 'Organization',
    enterBuildingName: 'Enter building name',
    enterStreetAddress: 'Enter street address',
    enterCity: 'Enter city',
    selectProvince: 'Select province',
    enterPostalCode: 'Enter postal code',
    selectBuildingType: 'Select building type',
    selectOrganization: 'Select organization',
    fillBuildingInfo: 'Fill in the building information below. All fields are required.',
    allFieldsRequired: 'All fields are required',
    buildingNameRequired: 'Building name is required',
    addressRequired: 'Address is required',
    cityRequired: 'City is required',
    provinceRequired: 'Province is required',
    postalCodeRequired: 'Postal code is required',
    organizationRequired: 'Organization is required',
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
    // Building types
    condoType: 'Condo',
    apartmentType: 'Apartment',
    townhouseType: 'Townhouse',
    commercialType: 'Commercial',
    mixedUseType: 'Mixed Use',
    otherBuildingType: 'Other',
    // Manager Residences page
    residencesManagement: 'Residences Management',
    manageResidences: 'Manage all residences and units',
    searchFilters: 'Search & Filters',
    searchResidences: 'Search',
    searchUnitTenant: 'Search by unit number or tenant name...',
    buildingFilter: 'Building',
    floorFilter: 'Floor',
    allBuildings: 'All Buildings',
    allFloors: 'All Floors',
    unitNumber: 'Unit Number',
    floor: 'Floor',
    bedrooms: 'Bedrooms',
    noResidencesFound: 'No residences found',
    adjustSearchCriteria: 'Try adjusting your search criteria',
    active: 'Active',
    inactive: 'Inactive',
    bed: 'bed',
    bath: 'bath',
    parking: 'Parking',
    storage: 'Storage',
    residents: 'Residents',
    noResidentsAssigned: 'No residents assigned',
    moreResidents: 'more',
    bathrooms: 'Bathrooms',
    squareFootage: 'Square Footage',
    sqFt: 'sq ft',
    monthShort: 'month',
    manageResidenceDocuments: 'Manage residence documents',
    monthlyFees: 'Monthly Fees',
    ownershipPercentage: 'Ownership %',
    editResidence: 'Edit Residence',
    viewDocuments: 'View Documents',
    // Budget page translations
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
    // Budget categories
    maintenance: 'Maintenance',
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
    other: 'Other',
    // Bills page translations
    billsManagement: 'Bills Management',
    billsSubtitle: 'Manage building expenses and revenue tracking',
    filters: 'Filters',
    building: 'Building',
    category: 'Category',
    year: 'Year',
    months: 'Months',
    allMonths: 'All months',
    allCategories: 'All categories',
    selectBuilding: 'Select building',
    loadingBuildings: 'Loading buildings...',
    failedToLoadBuildings: 'Failed to load buildings',
    retry: 'Retry',
    createBill: 'Create Bill',
    createNewBill: 'Create New Bill',
    createFirstBill: 'Create First Bill',
    noBillsFound: 'No Bills Found',
    noBillsFoundMessage: 'No bills found for the selected filters. Create your first bill to get started.',
    loadingBills: 'Loading bills...',
    current: 'Current',
    showMoreYears: 'Show more years',
    showFewerYears: 'Show fewer years',
    // Month names
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
    // Privacy Policy page
    privacyPolicyTitle: 'Privacy Policy',
    lastUpdated: 'Last updated:',
    privacyPolicyIntro: 'At Koveo Gestion, we are committed to protecting your personal information in compliance with Quebec\'s Law 25 on the Protection of Personal Information in the Private Sector and industry best practices.',
    informationCollection: '1. Information Collection',
    informationCollectionDesc: 'We collect the following personal information as part of our services:',
    informationUse: '2. Use of Information',
    informationUseDesc: 'Your personal information is used exclusively for:',
    informationSharing: '3. Sharing and Disclosure',
    privacyRights: '4. Your Rights',
    dataSecurity: '5. Data Security',
    contactPrivacy: '6. Contact Us',
    // Security page
    securityTitle: 'Security and Compliance',
    securityIntro: 'The security of your data is our absolute priority. Discover how we protect your information with enterprise-grade security measures and Quebec Law 25 compliance.',
    enterpriseEncryption: 'Enterprise-grade encryption',
    enterpriseEncryptionDesc: 'All data is encrypted in transit and at rest with military-grade AES-256 standards.',
    roleBasedAccess: 'Role-based access control',
    roleBasedAccessDesc: 'Granular authorization system ensuring each user only accesses necessary information.',
    quebecDataProtection: 'Quebec data protection',
    quebecDataProtectionDesc: 'Strict compliance with Quebec\'s Law 25 with data hosting in Canada.',
    secureInfrastructure: 'Secure infrastructure',
    secureInfrastructureDesc: 'Redundant cloud architecture with 24/7 monitoring and automated backups.',
    // Story page
    ourStoryTitle: 'Our Story',
    storyIntro: 'Discover the story behind Koveo Gestion and our mission to modernize property management in Quebec.',
    foundationYear: '2023',
    foundationTitle: 'Foundation of Koveo Gestion',
    foundationDesc: 'Company creation with the mission to modernize property management in Quebec.',
    developmentYear: '2024',
    developmentTitle: 'Platform Development',
    developmentDesc: 'Design and development of our comprehensive solution in compliance with Quebec\'s Law 25.',
    launchYear: '2025',
    launchTitle: 'Official Launch',
    launchDesc: 'Launch of our platform with complete bilingual support and Quebec compliance.',
    // Navigation translations
    quickActions: 'Quick Actions',
    calendar: 'Calendar',
    residents: 'Residents',
    myResidence: 'My Residence',
    myBuilding: 'My Building',
    commonSpaces: 'Common Spaces',
    buildings: 'Buildings',
    budget: 'Budget',
    bills: 'Bills',
    demands: 'Demands',
    navUserManagement: 'User Management',
    manageCommonSpaces: 'Manage Common Spaces',
    organizations: 'Organizations',
    documentation: 'Documentation',
    pillars: 'Pillars',
    roadmap: 'Roadmap',
    navQualityAssurance: 'Quality Assurance',
    navLaw25Compliance: 'Law 25 Compliance',
    rbacPermissions: 'RBAC Permissions',
    settings: 'Settings',
    bugReports: 'Bug Reports',
    ideaBox: 'Idea Box',
    // Home page translations
    modernPropertyManagement: 'Modern Property Management',
    forQuebec: 'for Quebec',
    comprehensivePropertyManagement: 'Comprehensive property management solution designed specifically for Quebec\'s residential communities',
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
    quebecComplianceDesc: 'Full compliance with Quebec\'s Law 25 and regulations',
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
    // Hamburger menu translations
    menu: 'Menu',
    navigation: 'Navigation',
    account: 'Account',
    home: 'Home',
    features: 'Features',
    security: 'Security',
    ourStory: 'Our Story',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    logout: 'Logout',
    getStarted: 'Get Started',
    language: 'Language',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Quebec Law 25 Compliant',
    // Pricing page translations
    pricing: 'Pricing',
    simplePricing: 'Simple and Transparent Pricing',
    pricingSubtitle: 'Professional property management that scales with your business',
    professionalPlan: 'Professional Plan',
    perfectForPropertyManagers: 'Perfect for property managers of all sizes',
    perDoorPerMonth: 'per door per month',
    noSetupFees: 'No setup fees',
    whatsIncluded: 'What\'s included:',
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
    documentManagement: 'Document management',
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
    // Residence Documents translations
    residenceDocuments: 'Residence Documents',
    manageDocumentsResidence: 'Manage documents for this residence',
    documentsCount: 'Documents ({count})',
    noDocumentsUploadedYet: 'No documents have been uploaded yet for this residence.',
    // Demands page translations
    myDemands: 'My Demands',
    allTypes: 'All Types',
    showingResults: 'Showing {start} to {end} of {total} demands',
    // Buildings management translations
    manageBuildingsOrganization: 'Manage {count} buildings in your organization',
    searchBuildingsAddress: 'Search buildings by name or address...',
    addBuilding: 'Add Building',
    // Fullscreen controls
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    // Common action buttons
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving...',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    phone: 'Phone'
  },
  fr: {
    dashboard: 'Tableau de bord',
    pillarFramework: 'Cadre Pilier',
    qualityAssurance: 'Assurance Qualité',
    workflowSetup: 'Configuration du flux de travail',
    configuration: 'Configuration',
    developer: 'Développeur',
    frameworkAdmin: 'Admin',
    developmentFrameworkInitialization: 'Initialisation du cadre de développement',
    settingUpPillarMethodology: 'Configuration de la méthodologie Pilier pour la plateforme Koveo Gestion',
    workspaceActive: 'Espace de travail actif',
    saveProgress: 'Sauvegarder les progrès',
    initializationProgress: 'Progrès d\'initialisation',
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
    coreQualityAssurance: 'Cadre d\'assurance qualité de base',
    inProgress: 'En cours',
    testingPillar: 'Pilier de test',
    automatedTestingFramework: 'Cadre de test automatisé',
    pending: 'En attente',
    securityPillar: 'Pilier de sécurité',
    law25ComplianceFramework: 'Cadre de conformité Loi 25',
    workspaceStatus: 'Statut de l\'espace de travail',
    environmentSetup: 'Configuration de l\'environnement',
    complete: 'Terminé',
    dependenciesInstallation: 'Installation des dépendances',
    typeScriptConfiguration: 'Configuration TypeScript',
    qualityMetrics: 'Métriques de qualité',
    codeCoverage: 'Couverture de code',
    codeQuality: 'Qualité du code',
    securityIssues: 'Problèmes de sécurité',
    buildTime: 'Temps de construction',
    translationCoverage: 'Couverture de traduction',
    // Métriques de performance
    responseTime: 'Temps de réponse',
    memoryUsage: 'Utilisation de la mémoire',
    bundleSize: 'Taille du bundle',
    dbQueryTime: 'Temps de requête DB',
    pageLoadTime: 'Temps de chargement de page',
    nextActions: 'Prochaines actions',
    initializeQAPillar: 'Initialiser le pilier AQ',
    setupValidationQualityAssurance: 'Configurer le cadre de validation et d\'assurance qualité',
    configureTesting: 'Configurer les tests',
    // Traductions d'amélioration continue
    continuousImprovementPillar: 'Amélioration continue',
    continuousImprovementDescription:
      'Métriques basées sur l\'IA, analytiques et suggestions d\'amélioration automatisées',
    documentationPillar: 'Documentation et connaissances',
    documentationDescription: 'Système complet de documentation et de gestion des connaissances',
    activePillar: 'Actif',
    systemHealth: 'Santé du système',
    completedToday: 'Complété aujourd\'hui',
    activeSuggestions: 'Suggestions actives',
    healthy: 'sain',
    suggestions: 'suggestions',
    availableAfterQACompletion: 'Disponible après l\'achèvement du pilier AQ',
    developmentConsole: 'Console de développement',
    accessDenied: 'Accès refusé',
    accessDeniedDescription:
      'Vous n\'avez pas les permissions suffisantes pour accéder à cette ressource. Veuillez contacter votre administrateur ou gestionnaire immobilier pour demander les permissions nécessaires.',
    // Gestion des utilisateurs
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
    users: 'utilisateurs',
    usersSelected: 'utilisateurs sélectionnés',
    bulkActions: 'Actions groupées',
    moreActions: 'Plus d\'actions',
    newRole: 'Nouveau rôle',
    selectRole: 'Sélectionner le rôle',
    admin: 'Admin',
    manager: 'Gestionnaire',
    tenant: 'Locataire',
    resident: 'Résident',
    applyRoleChange: 'Appliquer le changement de rôle',
    thisActionCannotBeUndone: 'Cette action ne peut pas être annulée',
    cancel: 'Annuler',
    processing: 'Traitement en cours',
    confirm: 'Confirmer',
    // Gestion des invitations
    inviteUser: 'Inviter un utilisateur',
    inviteUserDescription: 'Envoyer des invitations aux nouveaux utilisateurs pour rejoindre votre système de gestion immobilière',
    singleInvitation: 'Invitation unique',
    bulkInvitations: 'Invitations groupées',
    emailAddress: 'Adresse courriel',
    enterEmailAddress: 'Entrez l\'adresse courriel',
    role: 'Rôle',
    organization: 'Organisation',
    optional: 'Optionnel',
    selectOrganization: 'Sélectionner l\'organisation',
    expiresIn: 'Expire dans',
    day: 'jour',
    days: 'jours',
    securityLevel: 'Niveau de sécurité',
    standard: 'Standard',
    high: 'Élevé',
    require2FA: 'Exiger 2FA',
    require2FADescription: 'Exiger l\'authentification à deux facteurs pour cet utilisateur',
    personalMessage: 'Message personnel',
    personalMessagePlaceholder: 'Ajouter un message de bienvenue personnel...',
    personalMessageDescription: 'Ce message sera inclus dans le courriel d\'invitation',
    bulkPersonalMessagePlaceholder: 'Ajouter un message personnel pour toutes les invitations...',
    sendInvitation: 'Envoyer l\'invitation',
    sendInvitations: 'Envoyer les invitations',
    sending: 'Envoi en cours...',
    emailAddresses: 'Adresses courriel',
    addEmailAddress: 'Ajouter une adresse courriel',
    invitationSent: 'Invitation envoyée',
    invitationSentSuccessfully: 'Invitation envoyée avec succès',
    bulkInvitationsSent: 'Invitations groupées envoyées',
    bulkInvitationsResult: 'Invitations groupées traitées avec succès',
    bulkInvitationsSuccess: 'invitations envoyées avec succès',
    _error: 'Une erreur s\'est produite',
    // Traductions supplémentaires de gestion des utilisateurs
    bulkActionSuccess: 'Action groupée terminée',
    bulkActionSuccessDescription: 'L\'action groupée a été terminée avec succès',
    reminderSent: 'Rappel envoyé',
    reminderSentDescription: 'Le courriel de rappel a été envoyé avec succès',
    errorLoadingData: 'Erreur de chargement des données',
    tryAgain: 'Réessayer',
    noUsersSelected: 'Aucun utilisateur sélectionné',
    selectUsersForBulkAction: 'Veuillez sélectionner des utilisateurs pour effectuer l\'action groupée',
    totalUsers: 'Utilisateurs totaux',
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
    invitationSentDescription: 'L\'invitation a été envoyée avec succès à l\'utilisateur',
    // Traductions manquantes de gestion des utilisateurs
    userUpdated: 'Utilisateur mis à jour',
    userUpdatedSuccessfully: 'L\'utilisateur a été mis à jour avec succès',
    editUser: 'Modifier l\'utilisateur',
    status: 'Statut',
    activeUser: 'Utilisateur actif',
    updating: 'Mise à jour en cours...',
    updateUser: 'Mettre à jour l\'utilisateur',
    userDeleted: 'Utilisateur supprimé',
    userDeletedSuccessfully: 'L\'utilisateur a été supprimé avec succès',
    passwordResetSent: 'Réinitialisation du mot de passe envoyée',
    passwordResetEmailSent: 'Le courriel de réinitialisation du mot de passe a été envoyé avec succès',
    cannotDeleteOwnAccount: 'Vous ne pouvez pas supprimer votre propre compte',
    never: 'Jamais',
    usersList: 'Liste des utilisateurs',
    user: 'Utilisateur',
    selectAllUsers: 'Sélectionner tous les utilisateurs',
    lastLogin: 'Dernière connexion',
    joinedDate: 'Date d\'inscription',
    userActions: 'Actions utilisateur',
    actions: 'Actions',
    resetPassword: 'Réinitialiser le mot de passe',
    deactivateUser: 'Désactiver l\'utilisateur',
    activateUser: 'Activer l\'utilisateur',
    deleteUser: 'Supprimer l\'utilisateur',
    noUsersFound: 'Aucun utilisateur trouvé',
    editUserDescription: 'Modifier les détails de l\'utilisateur pour {name}',
    confirmDeleteUser: 'Êtes-vous sûr de vouloir supprimer {name}?',
    selectedUsers: '{count} utilisateurs sélectionnés',
    selectUser: 'Sélectionner l\'utilisateur {name}',
    // Traductions supplémentaires de gestion des invitations
    invitationCancelled: 'Invitation annulée',
    invitationCancelledSuccessfully: 'Invitation annulée avec succès',
    invitationResent: 'Invitation renvoyée',
    invitationResentSuccessfully: 'Invitation renvoyée avec succès',
    linkCopied: 'Lien copié',
    invitationLinkCopied: 'Lien d\'invitation copié dans le presse-papiers',
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
    invitationActions: 'Actions d\'invitation',
    copyLink: 'Copier le lien',
    openLink: 'Ouvrir le lien',
    sendReminder: 'Envoyer un rappel',
    resendInvitation: 'Renvoyer l\'invitation',
    cancelInvitation: 'Annuler l\'invitation',
    noInvitationsFound: 'Aucune invitation trouvée',
    cancelInvitationConfirmation: 'Êtes-vous sûr de vouloir annuler cette invitation?',
    cancelling: 'Annulation en cours...',
    daysRemaining: '{days} jours restants',
    hoursRemaining: '{hours} heures restantes',
    // Traductions de formulaire et d'interface utilisateur
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
    selectSchedule: 'Sélectionner l\'horaire',
    billingSchedule: 'Calendrier de facturation',
    selectStatus: 'Sélectionner le statut',
    // Traductions de contenu de page
    loadingDemands: 'Chargement des demandes...',
    searchDemandsUsers: 'Rechercher des demandes et des utilisateurs...',
    submitAndTrack: 'Soumettre et suivre',
    reviewDemand: 'Examiner la demande',
    failedToReviewDemand: 'Échec de l\'examen de la demande',
    error: 'Une erreur s\'est produite',
    submitted: 'Soumis',
    underReview: 'En cours d\'examen',
    approved: 'Approuvé',
    completed: 'Terminé',
    rejected: 'Rejeté',
    // Traductions d'étiquettes de statut
    draft: 'Brouillon',
    maintenance: 'Maintenance',
    complaint: 'Plainte',
    information: 'Information',
    other: 'Autre',
    allStatus: 'Tous les statuts',
    // Traductions de dialogue et de formulaire
    createNewBill: 'Créer une nouvelle facture',
    billCreationForm: 'Formulaire de création de facture',
    createBill: 'Créer une facture',
    createNewDemand: 'Créer une nouvelle demande',
    submitNewRequest: 'Soumettre une nouvelle demande',
    submitAndTrackRequests: 'Soumettre et suivre les demandes',
    newDemand: 'Nouvelle demande',
    selectType: 'Sélectionner le type',
    selectBuilding: 'Sélectionner le bâtiment',
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
    // Étiquettes et espaces réservés de formulaire supplémentaires
    describeRequestDetail: 'Décrivez votre demande en détail',
    submittedBy: 'Soumis par',
    addNotesReviewDecision: 'Ajouter des notes sur votre décision d\'examen',
    addNotesReview: 'Ajouter des notes sur l\'examen',
    selectBuilding2: 'Sélectionner un bâtiment',
    // Options de statut pour le gestionnaire
    submitted2: 'Soumis',
    // Espaces réservés de type
    typePlaceholder: 'Sélectionner le type...',
    buildingPlaceholder: 'Sélectionner le bâtiment...',
    // Contenu du tableau de bord et des pages principales
    welcomeBack: 'Bon retour',
    personalizedDashboard: 'Votre tableau de bord personnalisé',
    quickAccessEverything: 'Accès rapide à tout ce dont vous avez besoin',
    adminDashboard: 'Tableau de bord administrateur',
    systemManagement: 'Gestion du système',
    manageOrganizationsUsers: 'Gérer les organisations, utilisateurs et paramètres système',
    organizationOverview: 'Aperçu de l\'organisation',
    viewManageOrganizations: 'Voir et gérer toutes les organisations',
    viewManageResidences: 'Voir et gérer les résidences de l\'organisation',
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
    sqFt: 'Pi²',
    bedrooms: 'Chambres',
    bathrooms: 'Salles de bain',
    viewDocuments2: 'Voir les documents',
    unit: 'Unité',
    allFloors: 'Tous les étages',
    totalFloors: 'Étages totaux',
    // Plus de traductions de page de résidence
    myResidenceInfo: 'Voir les informations de votre résidence et les contacts',
    viewResidenceInfo: 'Voir les informations de votre résidence et les contacts',
    loading: 'Chargement...',
    noResidencesFound: 'Aucune résidence trouvée',
    noResidencesFoundOrg: 'Aucune résidence trouvée dans votre organisation.',
    notAssignedResidences: 'Vous n\'êtes assigné à aucune résidence.',
    selectResidence: 'Sélectionner une résidence',
    selectAResidence: 'Sélectionner une résidence',
    areYouSureDelete: 'Êtes-vous sûr de vouloir supprimer ce contact?',
    parkingSpaces: 'Espaces de stationnement',
    storageSpaces: 'Espaces de rangement',
    // Traductions de page de bâtiment
    myBuildings: 'Mes bâtiments',
    viewBuildingsAccess: 'Voir les bâtiments auxquels vous avez accès',
    noBuildingsFound: 'Aucun bâtiment trouvé',
    buildingType: 'Type de bâtiment',
    yearBuilt: 'Année de construction',
    totalUnits: 'Unités totales',
    managementCompany: 'Compagnie de gestion',
    occupancy: 'Occupation',
    occupancyStats: 'Statistiques d\'occupation',
    parking: 'Stationnement',
    storage: 'Rangement',
    units: 'unités',
    occupied: 'occupé',
    amenities: 'Commodités',
    moreAmenities: 'de plus',
    unableToDisplayAmenities: 'Impossible d\'afficher les commodités',
    buildingInfoUnavailable: 'Informations du bâtiment non disponibles',
    addressUnavailable: 'Adresse non disponible',
    previous: 'Précédent',
    next: 'Suivant',
    showing: 'Affichage',
    residences: 'résidences',
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
    // Messages d'erreur
    fieldRequired: 'Ce champ est requis',
    emailRequired: 'L\'adresse courriel est requise pour se connecter',
    passwordRequired: 'Le mot de passe est requis pour se connecter',
    invalidEmail: 'Veuillez entrer une adresse courriel valide (exemple: utilisateur@domaine.com)',
    invalidEmailFormat: 'Veuillez entrer une adresse courriel valide (exemple: utilisateur@domaine.com)',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères',
    passwordTooWeak: 'Le mot de passe est trop faible - veuillez utiliser un mot de passe plus fort',
    passwordsNotMatch: 'Les mots de passe ne correspondent pas - veuillez vérifier les deux champs',
    firstNameRequired: 'Le prénom est requis pour l\'inscription',
    lastNameRequired: 'Le nom de famille est requis pour l\'inscription',
    organizationRequired: 'Veuillez sélectionner une organisation dans le menu déroulant',
    buildingRequired: 'Veuillez sélectionner un bâtiment dans le menu déroulant',
    residenceRequired: 'Veuillez sélectionner une unité de résidence spécifique pour les locataires et résidents',
    loginFailed: 'Connexion échouée - veuillez vérifier vos identifiants et réessayer',
    invalidCredentials: 'Courriel ou mot de passe invalide - veuillez réessayer',
    networkError: 'Erreur de connexion réseau - veuillez vérifier votre connexion Internet',
    serverError: 'Erreur serveur survenue - veuillez réessayer plus tard',
    unexpectedError: 'Une erreur inattendue s\'est produite - veuillez contacter le support si cela continue',
    loadingFailed: 'Échec du chargement des données - veuillez actualiser la page et réessayer',
    saveFailed: 'Échec de l\'enregistrement des modifications - veuillez réessayer',
    updateFailed: 'Échec de la mise à jour des informations - veuillez réessayer',
    deleteFailed: 'Échec de la suppression de l\'élément - veuillez réessayer',
    firstNameTooLong: 'Le prénom doit contenir moins de 50 caractères',
    firstNameInvalidCharacters: 'Le prénom ne peut contenir que des lettres, espaces, apostrophes et traits d\'union',
    lastNameTooLong: 'Le nom de famille doit contenir moins de 50 caractères',
    lastNameInvalidCharacters: 'Le nom de famille ne peut contenir que des lettres, espaces, apostrophes et traits d\'union',
    personalMessageTooLong: 'Le message personnel doit contenir moins de 500 caractères',
    expiryDaysInvalid: 'Les jours d\'expiration doivent être entre 1 et 30 jours',
    emailOrNameRequired: 'L\'adresse courriel est requise pour les invitations régulières (exemple: utilisateur@domaine.com). Pour les utilisateurs de démo, fournissez le prénom et le nom de famille.',
    // AI Analysis warnings
    aiAnalysisWarning: 'Avertissement d\'analyse IA',
    lowConfidenceAIWarning: 'L\'analyse IA a une confiance faible :',
    reviewAISuggestionsCarefully: 'Veuillez examiner attentivement toutes les valeurs suggérées.',
    // Étiquettes de champs de base pour les formulaires
    email: 'Courriel',
    password: 'Mot de passe',
    login: 'Connexion',
    forgotPassword: 'Mot de passe oublié',
    // Standardisation des boutons de documents
    documentsButton: 'Documents',
    buildingDocumentsButton: 'Documents du bâtiment',
    residenceDocumentsButton: 'Documents de la résidence',
    viewDocumentsButton: 'Voir les documents',
    startFreeTrial: 'Commencez votre essai gratuit',
    tryDemo: 'Essayer la démo',
    previous: 'Précédent',
    next: 'Suivant',
    // Étiquettes de filtre de statut
    allStatusFilter: 'Tous les statuts',
    submittedFilter: 'Soumise',
    underReviewFilter: 'En révision',
    approvedFilter: 'Approuvée',
    inProgressFilter: 'En cours',
    completedFilter: 'Complétée',
    rejectedFilter: 'Rejetée',
    cancelledFilter: 'Annulée',
    draftFilter: 'Brouillon',
    // Étiquettes de filtre de type
    allTypesFilter: 'Tous les types',
    maintenanceFilter: 'Maintenance',
    complaintFilter: 'Plainte',
    informationFilter: 'Information',
    otherFilter: 'Autre',
    // Page de gestion des bâtiments
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
    buildingType: 'Type de bâtiment',
    totalUnits: 'Nombre total d\'unités',
    organizationLabel: 'Organisation',
    enterBuildingName: 'Entrez le nom du bâtiment',
    enterStreetAddress: 'Entrez l\'adresse de la rue',
    enterCity: 'Entrez la ville',
    selectProvince: 'Sélectionnez la province',
    enterPostalCode: 'Entrez le code postal',
    selectBuildingType: 'Sélectionnez le type de bâtiment',
    selectOrganization: 'Sélectionnez l\'organisation',
    fillBuildingInfo: 'Remplissez les informations du bâtiment ci-dessous. Tous les champs sont obligatoires.',
    allFieldsRequired: 'Tous les champs sont obligatoires',
    buildingNameRequired: 'Le nom du bâtiment est obligatoire',
    addressRequired: 'L\'adresse est obligatoire',
    cityRequired: 'La ville est obligatoire',
    provinceRequired: 'La province est obligatoire',
    postalCodeRequired: 'Le code postal est obligatoire',
    organizationRequired: 'L\'organisation est obligatoire',
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
    // Types de bâtiments
    condoType: 'Copropriété',
    apartmentType: 'Appartement',
    townhouseType: 'Maison en rangée',
    commercialType: 'Commercial',
    mixedUseType: 'Usage mixte',
    otherBuildingType: 'Autre',
    // Page de gestion des résidences
    residencesManagement: 'Gestion des résidences',
    manageResidences: 'Gérer toutes les résidences et unités',
    searchFilters: 'Recherche et filtres',
    searchResidences: 'Recherche',
    searchUnitTenant: 'Rechercher par numéro d\'unité ou nom de locataire...',
    buildingFilter: 'Bâtiment',
    floorFilter: 'Étage',
    allBuildings: 'Tous les bâtiments',
    allFloors: 'Tous les étages',
    unitNumber: 'Numéro d\'unité',
    floor: 'Étage',
    bedrooms: 'Chambres',
    noResidencesFound: 'Aucune résidence trouvée',
    adjustSearchCriteria: 'Essayez d\'ajuster vos critères de recherche',
    active: 'Actif',
    inactive: 'Inactif',
    bed: 'chambre',
    bath: 'salle de bain',
    parking: 'Stationnement',
    storage: 'Entreposage',
    residents: 'Résidents',
    noResidentsAssigned: 'Aucun résident assigné',
    moreResidents: 'de plus',
    bathrooms: 'Salles de bain',
    squareFootage: 'Superficie',
    sqFt: 'pi²',
    monthShort: 'mois',
    manageResidenceDocuments: 'Gérer les documents de résidence',
    monthlyFees: 'Frais mensuels',
    ownershipPercentage: 'Propriété %',
    editResidence: 'Modifier la résidence',
    viewDocuments: 'Voir les documents',
    // Traductions de la page budget
    budgetDashboard: 'Tableau de bord budgétaire',
    budgetSubtitle: 'Gestion et suivi du budget financier',
    totalBudget: 'Budget total',
    usedBudget: 'Budget utilisé',
    remaining: 'Restant',
    variance: 'Variance',
    fromLastYear: 'par rapport à l\'année dernière',
    ofTotalBudget: 'du budget total',
    percentRemaining: 'restant',
    underBudget: 'Sous le budget',
    overBudget: 'Dépassement de budget',
    budgetCategories: 'Catégories budgétaires',
    monthlySpendingTrend: 'Tendance des dépenses mensuelles',
    budgetAnalyticsChart: 'Le graphique d\'analyse budgétaire apparaîtrait ici',
    // Catégories budgétaires
    maintenance: 'Entretien',
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
    other: 'Autre',
    // Traductions de la page factures
    billsManagement: 'Gestion des factures',
    billsSubtitle: 'Gérer les dépenses des bâtiments et le suivi des revenus',
    filters: 'Filtres',
    building: 'Bâtiment',
    category: 'Catégorie',
    year: 'Année',
    months: 'Mois',
    allMonths: 'Tous les mois',
    allCategories: 'Toutes les catégories',
    selectBuilding: 'Sélectionner un bâtiment',
    loadingBuildings: 'Chargement des bâtiments...',
    failedToLoadBuildings: 'Échec du chargement des bâtiments',
    retry: 'Réessayer',
    createBill: 'Créer une facture',
    createNewBill: 'Créer une nouvelle facture',
    createFirstBill: 'Créer la première facture',
    noBillsFound: 'Aucune facture trouvée',
    noBillsFoundMessage: 'Aucune facture trouvée pour les filtres sélectionnés. Créez votre première facture pour commencer.',
    loadingBills: 'Chargement des factures...',
    current: 'Actuel',
    showMoreYears: 'Afficher plus d\'années',
    showFewerYears: 'Afficher moins d\'années',
    // Noms des mois
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
    // Page Politique de confidentialité
    privacyPolicyTitle: 'Politique de confidentialité',
    lastUpdated: 'Dernière mise à jour :',
    privacyPolicyIntro: 'Chez Koveo Gestion, nous nous engageons à protéger vos renseignements personnels en conformité avec la Loi 25 du Québec sur la protection des renseignements personnels dans le secteur privé et les meilleures pratiques de l\'industrie.',
    informationCollection: '1. Collecte des renseignements',
    informationCollectionDesc: 'Nous collectons les renseignements personnels suivants dans le cadre de nos services :',
    informationUse: '2. Utilisation des renseignements',
    informationUseDesc: 'Vos renseignements personnels sont utilisés exclusivement pour :',
    informationSharing: '3. Partage et divulgation',
    privacyRights: '4. Vos droits',
    dataSecurity: '5. Sécurité des données',
    contactPrivacy: '6. Nous contacter',
    // Page Sécurité
    securityTitle: 'Sécurité et conformité',
    securityIntro: 'La sécurité de vos données est notre priorité absolue. Découvrez comment nous protégeons vos informations avec des mesures de sécurité de niveau entreprise et la conformité à la Loi 25 du Québec.',
    enterpriseEncryption: 'Chiffrement de niveau entreprise',
    enterpriseEncryptionDesc: 'Toutes les données sont chiffrées en transit et au repos avec des standards militaires AES-256.',
    roleBasedAccess: 'Contrôle d\'accès basé sur les rôles',
    roleBasedAccessDesc: 'Système d\'autorisation granulaire garantissant que chaque utilisateur n\'accède qu\'aux informations nécessaires.',
    quebecDataProtection: 'Protection des données québécoises',
    quebecDataProtectionDesc: 'Conformité stricte à la Loi 25 du Québec avec hébergement des données au Canada.',
    secureInfrastructure: 'Infrastructure sécurisée',
    secureInfrastructureDesc: 'Architecture cloud redondante avec surveillance 24/7 et sauvegardes automatisées.',
    // Page Histoire
    ourStoryTitle: 'Notre histoire',
    storyIntro: 'Découvrez l\'histoire derrière Koveo Gestion et notre mission de moderniser la gestion immobilière au Québec.',
    foundationYear: '2023',
    foundationTitle: 'Fondation de Koveo Gestion',
    foundationDesc: 'Création de l\'entreprise avec pour mission de moderniser la gestion immobilière au Québec.',
    developmentYear: '2024',
    developmentTitle: 'Développement de la plateforme',
    developmentDesc: 'Conception et développement de notre solution complète en conformité avec la Loi 25 du Québec.',
    launchYear: '2025',
    launchTitle: 'Lancement officiel',
    launchDesc: 'Lancement de notre plateforme avec support bilingue complet et conformité québécoise.',
    // Traductions de navigation
    quickActions: 'Actions rapides',
    calendar: 'Calendrier',
    residents: 'Résidents',
    myResidence: 'Ma résidence',
    myBuilding: 'Mon bâtiment',
    commonSpaces: 'Espaces communs',
    buildings: 'Bâtiments',
    budget: 'Budget',
    bills: 'Factures',
    demands: 'Demandes',
    navUserManagement: 'Gestion des utilisateurs',
    manageCommonSpaces: 'Gérer les espaces communs',
    organizations: 'Organisations',
    documentation: 'Documentation',
    pillars: 'Piliers',
    roadmap: 'Feuille de route',
    navQualityAssurance: 'Assurance qualité',
    navLaw25Compliance: 'Conformité Loi 25',
    rbacPermissions: 'Permissions RBAC',
    settings: 'Paramètres',
    bugReports: 'Rapports de bogues',
    ideaBox: 'Boîte à idées',
    // Traductions de page d'accueil
    modernPropertyManagement: 'Gestion immobilière moderne',
    forQuebec: 'pour le Québec',
    comprehensivePropertyManagement: 'Solution de gestion immobilière complète conçue spécifiquement pour les communautés résidentielles du Québec',
    startManagingToday: 'Commencez la gestion aujourd\'hui',
    goToDashboard: 'Aller au tableau de bord',
    everythingYouNeed: 'Tout ce dont vous avez besoin',
    builtForPropertyOwners: 'Conçu pour les propriétaires et gestionnaires immobiliers',
    buildingManagement: 'Gestion de bâtiments',
    buildingManagementDesc: 'Système complet de gestion de bâtiments et d\'unités',
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
    expertSupport: 'Support d\'experts',
    expertSupportDesc: 'Équipe de support dédiée basée au Québec',
    readyToTransform: 'Prêt à transformer votre gestion immobilière?',
    joinPropertyOwners: 'Rejoignez des centaines de propriétaires québécois qui font confiance à Koveo Gestion',
    getStartedNow: 'Commencer maintenant',
    yourDataIsProtected: 'Vos données sont protégées',
    // Traductions de menu hamburger
    menu: 'Menu',
    navigation: 'Navigation',
    account: 'Compte',
    home: 'Accueil',
    features: 'Fonctionnalités',
    security: 'Sécurité',
    ourStory: 'Notre histoire',
    privacyPolicy: 'Politique de confidentialité',
    termsOfService: 'Conditions d\'utilisation',
    logout: 'Déconnexion',
    getStarted: 'Commencer',
    language: 'Langue',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Conforme à la Loi 25 du Québec',
    // Traductions de page de tarification
    pricing: 'Tarification',
    simplePricing: 'Tarification simple et transparente',
    pricingSubtitle: 'Gestion immobilière professionnelle qui évolue avec votre entreprise',
    professionalPlan: 'Plan professionnel',
    perfectForPropertyManagers: 'Parfait pour les gestionnaires immobiliers de toutes tailles',
    perDoorPerMonth: 'par porte par mois',
    noSetupFees: 'Aucuns frais d\'installation',
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
    documentManagement: 'Gestion documentaire',
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
    // Traductions de documents de résidence
    residenceDocuments: 'Documents de résidence',
    manageDocumentsResidence: 'Gérer les documents de cette résidence',
    documentsCount: 'Documents ({count})',
    noDocumentsUploadedYet: 'Aucun document n\'a encore été téléchargé pour cette résidence.',
    // Traductions de page de demandes
    myDemands: 'Mes demandes',
    allTypes: 'Tous les types',
    showingResults: 'Affichage de {start} à {end} sur {total} demandes',
    // Traductions de gestion de bâtiments
    manageBuildingsOrganization: 'Gérer {count} bâtiments dans votre organisation',
    searchBuildingsAddress: 'Rechercher des bâtiments par nom ou adresse...',
    addBuilding: 'Ajouter un bâtiment',
    // Contrôles plein écran
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    // Boutons d'action communs
    save: 'Enregistrer',
    cancel: 'Annuler',
    saving: 'Enregistrement...',
    close: 'Fermer',
    edit: 'Modifier',
    delete: 'Supprimer',
    phone: 'Téléphone'
  }
};

/**
 * Default language for the application
 */
export const DEFAULT_LANGUAGE: Language = 'fr';

/**
 * Get translations for a specific language
 * @param language - The language to get translations for
 * @returns The translations object for the specified language
 */
export function getTranslations(language: Language): Translations {
  return translations[language] || translations[DEFAULT_LANGUAGE];
}

/**
 * Get available languages
 * @returns Array of available language codes
 */
export function getAvailableLanguages(): Language[] {
  return Object.keys(translations) as Language[];
}

/**
 * Check if a language is supported
 * @param language - The language code to check
 * @returns Whether the language is supported
 */
export function isLanguageSupported(language: string): language is Language {
  return getAvailableLanguages().includes(language as Language);
}

/**
 * Get language name in its native form
 * @param language - The language code
 * @returns The language name in native form
 */
export function getLanguageName(language: Language): string {
  const names: Record<Language, string> = {
    en: 'English',
    fr: 'Français'
  };
  return names[language] || names[DEFAULT_LANGUAGE];
}

export { translations };
export default translations;