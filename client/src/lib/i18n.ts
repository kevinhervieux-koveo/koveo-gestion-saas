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
  occupancyStats: string;
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
  roleBasedAccess: string;
  roleBasedAccessDesc: string;
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
  login: string;
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
  // Building related translations
  myBuildings: string;
  viewBuildingsAccess: string;
  noBuildingsFound: string;
  // Residence Documents translations
  residenceDocuments: string;
  manageDocumentsResidence: string;
  backToResidences: string;
  documentsCount: string;
  allResidenceDocuments: string;
  noDocumentsFound: string;
  noDocumentsUploadedYet: string;
  // Demands page translations
  myDemands: string;
  submitAndTrackRequests: string;
  searchDemands: string;
  allTypes: string;
  showingResults: string;
  // Buildings management translations
  buildings: string;
  manageBuildingsOrganization: string;
  searchBuildingsAddress: string;
  addBuilding: string;
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
    _error: 'Error',
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
    cancelling: 'Cancelling',
    daysRemaining: 'days remaining',
    hoursRemaining: 'hours remaining',
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
    billTitle: 'Bill title',
    companyOrServiceProvider: 'Company or service provider',
    selectPaymentType: 'Select payment type',
    selectSchedule: 'Select schedule',
    selectStatus: 'Select status',
    // Page content translations
    loadingDemands: 'Loading demands...',
    searchDemandsUsers: 'Search demands, users...',
    submitAndTrack: 'Submit and track maintenance requests',
    reviewDemand: 'Review Demand',
    failedToReviewDemand: 'Failed to review demand',
    error: 'Error',
    submitted: 'Submitted',
    underReview: 'Under Review',
    approved: 'Approved',
    completed: 'Completed',
    rejected: 'Rejected',
    // Additional status labels
    draft: 'Draft',
    maintenance: 'Maintenance',
    complaint: 'Complaint',
    information: 'Information',
    other: 'Other',
    allStatus: 'All Status',
    // Dialog and form translations
    createNewBill: 'Create New Bill',
    billCreationForm: 'Bill creation form for {building}',
    createBill: 'Create Bill',
    createNewDemand: 'Create New Demand',
    submitNewRequest: 'Submit a new request or complaint',
    submitAndTrackRequests: 'Submit and track your requests',
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
    success: 'Success',
    updateStatusAndNotes: 'Update the status and add review notes',
    // Additional form labels and placeholders
    describeRequestDetail: 'Describe your request in detail...',
    submittedBy: 'Submitted by',
    addNotesReview: 'Add notes about your review decision...',
    addNotesReviewDecision: 'Add notes about your review decision...',
    selectBuilding2: 'Select building',
    // Status options for manager
    submitted2: 'Submitted',
    // Document management translations
    // Type placeholders
    typePlaceholder: 'Type',
    buildingPlaceholder: 'Building',
    // Dashboard and major page content
    welcomeBack: 'Welcome back',
    personalizedDashboard: 'Your personalized dashboard - quick access to everything you need',
    quickAccessEverything: 'quick access to everything you need',
    adminDashboard: 'Admin Dashboard',
    systemManagement: 'System Management',
    manageOrganizationsUsers: 'Manage organizations, users, and system settings',
    organizationOverview: 'Organization Overview',
    viewManageOrganizations: 'View and manage all organizations',
    viewManageResidences: 'View and manage organization residences',
    selectBuildingResidence: 'Select Building & Residence',
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
    noResidencesFound: 'No Residences Found',
    noResidencesFoundOrg: 'No residences found in your organization.',
    notAssignedResidences: 'You are not assigned to any residences.',
    selectResidence: 'Select Residence',
    selectAResidence: 'Select a residence',
    areYouSureDelete: 'Are you sure you want to delete this contact?',
    parkingSpaces: 'Parking Spaces',
    storageSpaces: 'Storage Spaces',
    // Building page translations
    myBuildings: 'My Buildings',
    viewBuildingsAccess: 'View buildings you have access to',
    noBuildingsFound: 'No Buildings Found',
    buildingType: 'Building Type',
    yearBuilt: 'Year Built',
    totalUnits: 'Total Units',
    managementCompany: 'Management Company',
    occupancyStats: 'Occupancy Stats',
    // Documents page translations
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
    comprehensivePropertyManagement:
      "Comprehensive property management solution designed specifically for Quebec's regulatory environment. Manage buildings, residents, finances, and compliance all in one secure platform.",
    startManagingToday: 'Start Managing Today',
    goToDashboard: 'Go to Dashboard',
    everythingYouNeed: 'Everything You Need to Manage Properties',
    builtForPropertyOwners:
      'Built for property owners, managers, and residents with Quebec-specific compliance and bilingual support.',
    buildingManagement: 'Building Management',
    buildingManagementDesc:
      'Comprehensive building oversight with maintenance tracking, resident management, and compliance monitoring.',
    residentPortal: 'Resident Portal',
    residentPortalDesc:
      'Self-service portal for residents to view bills, submit requests, and communicate with property management.',
    financialReporting: 'Financial Reporting',
    financialReportingDesc:
      'Detailed financial analytics, budget tracking, and Quebec-compliant reporting for transparency.',
    quebecCompliance: 'Quebec Compliance',
    quebecComplianceDesc:
      'Built-in compliance with Quebec Law 25 and property management regulations. Strong data protection measures implemented.',
    whyChooseKoveo: 'Why Choose Koveo Gestion?',
    quebecLaw25Compliant: 'Quebec Law 25 Compliant',
    quebecLaw25CompliantDesc:
      "Full compliance with Quebec's privacy and data protection regulations.",
    bilingualSupport: 'Bilingual Support',
    bilingualSupportDesc: 'Full French and English language support for all users.',
    roleBasedAccess: 'Role-Based Access',
    roleBasedAccessDesc: 'Secure access controls for owners, managers, and residents.',
    cloudBasedSecurity: 'Cloud-Based Security',
    cloudBasedSecurityDesc: 'Enterprise-grade security with automatic backups and updates.',
    mobileResponsive: 'Mobile Responsive',
    mobileResponsiveDesc: 'Access your property management tools from any device, anywhere.',
    expertSupport: 'Expert Support',
    expertSupportDesc: 'Dedicated support team with Quebec property management expertise.',
    readyToTransform: 'Ready to Transform Your Property Management?',
    joinPropertyOwners:
      'Join property owners and managers across Quebec who trust Koveo Gestion for their property management needs.',
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
    login: 'Login',
    logout: 'Logout',
    getStarted: 'Get Started',
    language: 'Language',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Quebec Law 25 Compliant',
    // Pricing page translations
    pricing: 'Pricing',
    simplePricing: 'Simple, Transparent Pricing',
    pricingSubtitle: 'Professional property management that scales with your business',
    professionalPlan: 'Professional Plan',
    perfectForPropertyManagers: 'Perfect for property managers of all sizes',
    perDoorPerMonth: 'per door per month',
    noSetupFees: 'No setup fees',
    whatsIncluded: "What's included:",
    unlimitedResidents: 'Unlimited residents',
    documentStorage: 'Secure document storage',
    maintenanceTracking: 'Maintenance tracking',
    financialReports: 'Financial reports',
    law25Protection: 'Quebec Law 25 protection',
    multilingualSupport: 'Bilingual support (EN/FR)',
    mobileAccess: 'Mobile access',
    cloudBackup: 'Automatic cloud backup',
    emailSupport: 'Email support',
    regularUpdates: 'Regular updates',
    documentManagement: 'Document Management',
    documentManagementDesc: 'Secure storage and organization',
    smartNotifications: 'Smart Notifications',
    smartNotificationsDesc: 'Automated alerts and reminders',
    electronicBilling: 'Electronic Billing',
    electronicBillingDesc: 'Digital invoicing and payment tracking',
    centralizedCommunication: 'Centralized Communication',
    centralizedCommunicationDesc: 'Unified messaging platform',
    maintenancePlanning: 'Maintenance Planning',
    maintenancePlanningDesc: 'Smart scheduling and tracking',
    processManagement: 'Process Management',
    processManagementDesc: 'Organized workflow tools',
    law25Compliance: 'Quebec Law 25 Compliance',
    law25ComplianceDesc: 'Built-in privacy protection',
    featuresOverviewDesc:
      'Discover how our comprehensive platform can streamline your property management',
    viewAllFeatures: 'View All Features',
    readyToGetStarted: 'Ready to Get Started?',
    allRightsReserved: 'All rights reserved',
    // Additional translations for missing elements
    residenceDocuments: 'Residence Documents',
    manageDocumentsResidence: 'Manage documents for this residence',
    documentsCount: 'Documents ({count})',
    noDocumentsUploadedYet: 'No documents have been uploaded for this residence yet.',
    myDemands: 'My Demands',
    showingResults: 'Showing {start} to {end} of {total} demands',
    manageBuildingsOrganization: 'Manage {count} buildings in your organization',
    searchBuildingsAddress: 'Search buildings by name or address...',
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
    settingUpPillarMethodology:
      'Mise en place de la méthodologie des piliers pour la plateforme Koveo Gestion',
    workspaceActive: 'Espace de travail actif',
    saveProgress: 'Sauvegarder les progrès',
    initializationProgress: "Progrès d'initialisation",
    frameworkSetup: 'Configuration du cadre',
    pillarCreation: 'Création de piliers',
    qualityTools: 'Outils de qualité',
    testingSetup: 'Configuration des tests',
    validation: 'Validation',
    frameworkConfiguration: 'Configuration du cadre',
    recommended: 'Recommandé pour les applications SaaS',
    selected: 'Sélectionné',
    database: 'Base de données',
    auth: 'Authentification',
    pillarMethodology: 'Méthodologie des piliers',
    validationQAPillar: 'Pilier validation et AQ',
    coreQualityAssurance: "Cadre d'assurance qualité de base",
    inProgress: 'En cours',
    testingPillar: 'Pilier de test',
    automatedTestingFramework: 'Cadre de test automatisé',
    pending: 'En attente',
    securityPillar: 'Pilier de sécurité',
    law25ComplianceFramework: 'Cadre de conformité Loi 25',
    workspaceStatus: "État de l'espace de travail",
    environmentSetup: "Configuration de l'environnement",
    complete: 'Terminé',
    dependenciesInstallation: 'Installation des dépendances',
    typeScriptConfiguration: 'Configuration TypeScript',
    qualityMetrics: 'Métriques de qualité',
    codeCoverage: 'Couverture du code',
    codeQuality: 'Qualité du code',
    securityIssues: 'Problèmes de sécurité',
    buildTime: 'Temps de compilation',
    translationCoverage: 'Couverture de traduction',
    // Performance metrics
    responseTime: 'Temps de réponse',
    memoryUsage: 'Utilisation mémoire',
    bundleSize: 'Taille du bundle',
    dbQueryTime: 'Temps de requête BD',
    pageLoadTime: 'Temps de chargement',
    nextActions: 'Prochaines actions',
    initializeQAPillar: 'Initialiser le pilier AQ',
    setupValidationQualityAssurance: "Configurer le cadre de validation et d'assurance qualité",
    configureTesting: 'Configurer les tests',
    // Continuous Improvement translations
    continuousImprovementPillar: 'Amélioration Continue',
    continuousImprovementDescription:
      "Métriques IA, analyses et suggestions d'amélioration automatisées",
    documentationPillar: 'Documentation et Connaissances',
    documentationDescription: 'Système complet de documentation et de gestion des connaissances',
    activePillar: 'Actif',
    systemHealth: 'Santé du Système',
    completedToday: "Complétées Aujourd'hui",
    activeSuggestions: 'Suggestions Actives',
    healthy: 'sain',
    suggestions: 'suggestions',
    availableAfterQACompletion: "Disponible après l'achèvement du pilier AQ",
    developmentConsole: 'Console de développement',
    accessDenied: 'Accès refusé',
    accessDeniedDescription:
      'Vous ne disposez pas des permissions suffisantes pour accéder à cette ressource. Veuillez contacter votre administrateur ou gestionnaire immobilier pour demander les permissions nécessaires.',
    // User management
    activateUsers: 'Activer les utilisateurs',
    activateSelectedUsers: 'Activer les utilisateurs sélectionnés',
    deactivateUsers: 'Désactiver les utilisateurs',
    deactivateSelectedUsers: 'Désactiver les utilisateurs sélectionnés',
    changeRole: 'Changer le rôle',
    changeRoleSelectedUsers: 'Changer le rôle des utilisateurs sélectionnés',
    sendPasswordReset: 'Envoyer réinitialisation mot de passe',
    sendPasswordResetSelectedUsers:
      'Envoyer réinitialisation de mot de passe aux utilisateurs sélectionnés',
    sendWelcomeEmail: 'Envoyer courriel de bienvenue',
    sendWelcomeEmailSelectedUsers: 'Envoyer courriel de bienvenue aux utilisateurs sélectionnés',
    exportUsers: 'Exporter les utilisateurs',
    exportSelectedUsersData: 'Exporter les données des utilisateurs sélectionnés',
    deleteUsers: 'Supprimer les utilisateurs',
    deleteSelectedUsers: 'Supprimer les utilisateurs sélectionnés',
    users: 'utilisateurs',
    usersSelected: 'utilisateurs sélectionnés',
    bulkActions: 'Actions en lot',
    moreActions: "Plus d'actions",
    newRole: 'Nouveau rôle',
    selectRole: 'Sélectionner le rôle',
    admin: 'Administrateur',
    manager: 'Gestionnaire',
    tenant: 'Locataire',
    resident: 'Résident',
    applyRoleChange: 'Appliquer le changement de rôle',
    thisActionCannotBeUndone: 'Cette action ne peut pas être annulée',
    cancel: 'Annuler',
    processing: 'Traitement en cours',
    confirm: 'Confirmer',
    // Invitation management
    inviteUser: 'Inviter un utilisateur',
    inviteUserDescription:
      'Envoyer des invitations aux nouveaux utilisateurs pour rejoindre votre système de gestion immobilière',
    singleInvitation: 'Invitation unique',
    bulkInvitations: 'Invitations en lot',
    emailAddress: 'Adresse courriel',
    enterEmailAddress: "Entrer l'adresse courriel",
    role: 'Rôle',
    organization: 'Organisation',
    optional: 'Optionnel',
    selectOrganization: "Sélectionner l'organisation",
    expiresIn: 'Expire dans',
    day: 'jour',
    days: 'jours',
    securityLevel: 'Niveau de sécurité',
    standard: 'Standard',
    high: 'Élevé',
    require2FA: 'Exiger 2FA',
    require2FADescription: "Exiger l'authentification à deux facteurs pour cet utilisateur",
    personalMessage: 'Message personnel',
    personalMessagePlaceholder: 'Ajouter un message de bienvenue personnel...',
    personalMessageDescription: "Ce message sera inclus dans le courriel d'invitation",
    bulkPersonalMessagePlaceholder: 'Ajouter un message personnel pour toutes les invitations...',
    sendInvitation: "Envoyer l'invitation",
    sendInvitations: 'Envoyer les invitations',
    sending: 'Envoi en cours...',
    emailAddresses: 'Adresses courriel',
    addEmailAddress: 'Ajouter une adresse courriel',
    invitationSent: 'Invitation envoyée',
    invitationSentSuccessfully: 'Invitation envoyée avec succès',
    bulkInvitationsSent: 'Invitations en lot envoyées',
    bulkInvitationsResult: 'Invitations en lot traitées avec succès',
    bulkInvitationsSuccess: 'invitations envoyées avec succès',
    _error: 'Erreur',
    // Additional user management translations
    bulkActionSuccess: 'Action en lot terminée',
    bulkActionSuccessDescription: "L'action en lot a été terminée avec succès",
    reminderSent: 'Rappel envoyé',
    reminderSentDescription: 'Le courriel de rappel a été envoyé avec succès',
    errorLoadingData: 'Erreur de chargement des données',
    tryAgain: 'Réessayer',
    noUsersSelected: 'Aucun utilisateur sélectionné',
    selectUsersForBulkAction:
      "Veuillez sélectionner des utilisateurs pour effectuer l'action en lot",
    totalUsers: 'Total des utilisateurs',
    activeUsers: 'Utilisateurs actifs',
    pendingInvitations: 'Invitations en attente',
    totalInvitations: 'Total des invitations',
    userManagement: 'Gestion des utilisateurs',
    manageUsersInvitationsRoles: 'Gérer les utilisateurs, invitations et rôles',
    searchUsersInvitations: 'Rechercher utilisateurs et invitations...',
    filterByRole: 'Filtrer par rôle',
    allRoles: 'Tous les rôles',
    filterByStatus: 'Filtrer par statut',
    allStatuses: 'Tous les statuts',
    active: 'Actif',
    inactive: 'Inactif',
    expired: 'Expiré',
    invitations: 'Invitations',
    invitationSentDescription: "L'invitation a été envoyée avec succès à l'utilisateur",
    // Missing user management translations
    userUpdated: 'Utilisateur mis à jour',
    userUpdatedSuccessfully: "L'utilisateur a été mis à jour avec succès",
    editUser: "Modifier l'utilisateur",
    status: 'Statut',
    activeUser: 'Utilisateur actif',
    updating: 'Mise à jour...',
    updateUser: "Mettre à jour l'utilisateur",
    userDeleted: 'Utilisateur supprimé',
    userDeletedSuccessfully: "L'utilisateur a été supprimé avec succès",
    passwordResetSent: 'Réinitialisation de mot de passe envoyée',
    passwordResetEmailSent:
      'Le courriel de réinitialisation de mot de passe a été envoyé avec succès',
    cannotDeleteOwnAccount: 'Vous ne pouvez pas supprimer votre propre compte',
    never: 'Jamais',
    usersList: 'Liste des utilisateurs',
    user: 'Utilisateur',
    selectAllUsers: 'Sélectionner tous les utilisateurs',
    lastLogin: 'Dernière connexion',
    joinedDate: "Date d'adhésion",
    userActions: 'Actions utilisateur',
    actions: 'Actions',
    resetPassword: 'Réinitialiser le mot de passe',
    deactivateUser: "Désactiver l'utilisateur",
    activateUser: "Activer l'utilisateur",
    deleteUser: "Supprimer l'utilisateur",
    noUsersFound: 'Aucun utilisateur trouvé',
    editUserDescription: "Modifier les détails de l'utilisateur pour {name}",
    confirmDeleteUser: 'Êtes-vous sûr de vouloir supprimer {name}?',
    selectedUsers: '{count} utilisateurs sélectionnés',
    selectUser: "Sélectionner l'utilisateur {name}",
    // Additional invitation management translations
    invitationCancelled: 'Invitation annulée',
    invitationCancelledSuccessfully: 'Invitation annulée avec succès',
    invitationResent: 'Invitation renvoyée',
    invitationResentSuccessfully: 'Invitation renvoyée avec succès',
    linkCopied: 'Lien copié',
    invitationLinkCopied: "Lien d'invitation copié dans le presse-papiers",
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
    invitationActions: "Actions d'invitation",
    copyLink: 'Copier le lien',
    openLink: 'Ouvrir le lien',
    sendReminder: 'Envoyer un rappel',
    resendInvitation: "Renvoyer l'invitation",
    cancelInvitation: "Annuler l'invitation",
    noInvitationsFound: 'Aucune invitation trouvée',
    cancelInvitationConfirmation: 'Êtes-vous sûr de vouloir annuler cette invitation?',
    cancelling: 'Annulation',
    daysRemaining: 'jours restants',
    hoursRemaining: 'heures restantes',
    // Form and UI translations
    formStatus: 'Statut',
    formType: 'Type',
    building: 'Bâtiment',
    allBuildings: 'Tous les bâtiments',
    searchDemands: 'Rechercher des demandes...',
    title: 'Titre',
    vendor: 'Fournisseur',
    category: 'Catégorie',
    selectCategory: 'Sélectionner une catégorie',
    billTitle: 'Titre de la facture',
    companyOrServiceProvider: 'Entreprise ou fournisseur de service',
    selectPaymentType: 'Sélectionner le type de paiement',
    selectSchedule: "Sélectionner l'horaire",
    selectStatus: 'Sélectionner le statut',
    // Page content translations
    loadingDemands: 'Chargement des demandes...',
    searchDemandsUsers: 'Rechercher demandes, utilisateurs...',
    submitAndTrack: 'Soumettre et suivre les demandes de maintenance',
    reviewDemand: 'Examiner la demande',
    failedToReviewDemand: "Échec de l'examen de la demande",
    error: 'Erreur',
    submitted: 'Soumis',
    underReview: "En cours d'examen",
    approved: 'Approuvé',
    completed: 'Terminé',
    rejected: 'Rejeté',
    // Additional status labels
    draft: 'Brouillon',
    maintenance: 'Entretien',
    complaint: 'Plainte',
    information: 'Information',
    other: 'Autre',
    allStatus: 'Tous les statuts',
    // Dialog and form translations
    createNewBill: 'Créer une nouvelle facture',
    billCreationForm: 'Formulaire de création de facture pour {building}',
    createBill: 'Créer la facture',
    createNewDemand: 'Créer une nouvelle demande',
    submitNewRequest: 'Soumettre une nouvelle demande ou plainte',
    submitAndTrackRequests: 'Soumettre et suivre vos demandes',
    newDemand: 'Nouvelle demande',
    selectType: 'Sélectionner le type',
    selectBuilding: 'Sélectionner le bâtiment',
    addNewDocument: 'Ajouter un nouveau document',
    addDocument: 'Ajouter un document',
    documentName: 'Nom du document',
    enterDocumentName: 'Saisir le nom du document',
    documentType: 'Type de document',
    selectDocumentType: 'Sélectionner le type de document',
    enterDocumentDescription: 'Saisir la description du document',
    backToResidences: 'Retour aux résidences',
    documents: 'Documents',
    documentsAvailableToTenants: 'Documents disponibles aux locataires',
    allResidenceDocuments: 'Tous les documents de résidence',
    loadingDemands2: 'Chargement des demandes...',
    noDemandsFound: 'Aucune demande trouvée',
    success: 'Succès',
    updateStatusAndNotes: "Mettre à jour le statut et ajouter des notes d'examen",
    // Additional form labels and placeholders
    describeRequestDetail: 'Décrivez votre demande en détail...',
    submittedBy: 'Soumis par',
    addNotesReview: "Ajouter des notes sur votre décision d'examen...",
    selectBuilding2: 'Sélectionner le bâtiment',
    addNotesReviewDecision: "Ajoutez des notes sur votre décision d'examen...",
    // Status options for manager
    submitted2: 'Soumis',
    // Document management translations
    // Type placeholders
    typePlaceholder: 'Type',
    buildingPlaceholder: 'Bâtiment',
    // Dashboard and major page content
    welcomeBack: 'Bienvenue',
    personalizedDashboard:
      'Votre tableau de bord personnalisé - accès rapide à tout ce dont vous avez besoin',
    quickAccessEverything: 'accès rapide à tout ce dont vous avez besoin',
    adminDashboard: 'Tableau de bord administrateur',
    systemManagement: 'Gestion du système',
    manageOrganizationsUsers: 'Gérer les organisations, utilisateurs et paramètres système',
    organizationOverview: "Aperçu de l'organisation",
    viewManageOrganizations: 'Voir et gérer toutes les organisations',
    viewManageResidences: "Voir et gérer les résidences de l'organisation",
    selectBuildingResidence: 'Sélectionner le bâtiment et la résidence',
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
    // More residence page translations
    myResidenceInfo: 'Voir les informations de votre résidence et les contacts',
    viewResidenceInfo: 'Voir les informations de votre résidence et les contacts',
    loading: 'Chargement...',
    noResidencesFound: 'Aucune résidence trouvée',
    noResidencesFoundOrg: 'Aucune résidence trouvée dans votre organisation.',
    notAssignedResidences: "Vous n'êtes assigné à aucune résidence.",
    selectResidence: 'Sélectionner une résidence',
    selectAResidence: 'Sélectionner une résidence',
    areYouSureDelete: 'Êtes-vous sûr de vouloir supprimer ce contact?',
    parkingSpaces: 'Espaces de stationnement',
    storageSpaces: 'Espaces de rangement',
    // Building page translations
    myBuildings: 'Mes bâtiments',
    viewBuildingsAccess: 'Voir les bâtiments auxquels vous avez accès',
    noBuildingsFound: 'Aucun bâtiment trouvé',
    buildingType: 'Type de bâtiment',
    yearBuilt: 'Année de construction',
    totalUnits: 'Unités totales',
    managementCompany: 'Compagnie de gestion',
    occupancyStats: "Statistiques d'occupation",
    // Documents page translations
    // Navigation translations
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
    // Home page translations
    modernPropertyManagement: 'Gestion Immobilière Moderne',
    forQuebec: 'pour le Québec',
    comprehensivePropertyManagement:
      "Solution de gestion immobilière complète conçue spécifiquement pour l'environnement réglementaire du Québec. Gérez les bâtiments, les résidents, les finances et la conformité dans une plateforme sécurisée.",
    startManagingToday: "Commencer aujourd'hui",
    goToDashboard: 'Accéder au tableau de bord',
    everythingYouNeed: 'Tout ce dont vous avez besoin pour gérer vos propriétés',
    builtForPropertyOwners:
      'Conçu pour les propriétaires, gestionnaires et résidents avec conformité québécoise et support bilingue.',
    buildingManagement: "Gestion d'immeubles",
    buildingManagementDesc:
      'Supervision complète des bâtiments avec suivi de la maintenance, gestion des résidents et surveillance de la conformité.',
    residentPortal: 'Portail résident',
    residentPortalDesc:
      'Portail libre-service pour que les résidents puissent consulter leurs factures, soumettre des demandes et communiquer avec la gestion immobilière.',
    financialReporting: 'Rapports financiers',
    financialReportingDesc:
      'Analyses financières détaillées, suivi budgétaire et rapports conformes au Québec pour la transparence.',
    quebecCompliance: 'Conformité québécoise',
    quebecComplianceDesc:
      'Conformité intégrée avec la Loi 25 du Québec et les règlements de gestion immobilière. Mesures robustes de protection des données mises en place.',
    whyChooseKoveo: 'Pourquoi choisir Koveo Gestion?',
    quebecLaw25Compliant: 'Conforme à la Loi 25 du Québec',
    quebecLaw25CompliantDesc:
      'Conformité complète avec les règlements de confidentialité et de protection des données du Québec.',
    bilingualSupport: 'Support bilingue',
    bilingualSupportDesc: 'Support complet en français et en anglais pour tous les utilisateurs.',
    roleBasedAccess: 'Accès basé sur les rôles',
    roleBasedAccessDesc:
      "Contrôles d'accès sécurisés pour propriétaires, gestionnaires et résidents.",
    cloudBasedSecurity: 'Sécurité infonuagique',
    cloudBasedSecurityDesc:
      'Sécurité de niveau entreprise avec sauvegardes et mises à jour automatiques.',
    mobileResponsive: 'Compatible mobile',
    mobileResponsiveDesc:
      "Accédez à vos outils de gestion immobilière depuis n'importe quel appareil, n'importe où.",
    expertSupport: 'Support expert',
    expertSupportDesc: 'Équipe de support dédiée avec expertise en gestion immobilière québécoise.',
    readyToTransform: 'Prêt à transformer votre gestion immobilière?',
    joinPropertyOwners:
      'Rejoignez les propriétaires et gestionnaires à travers le Québec qui font confiance à Koveo Gestion pour leurs besoins de gestion immobilière.',
    getStartedNow: 'Commencer maintenant',
    yourDataIsProtected: 'Vos données sont protégées',
    // Hamburger menu translations
    menu: 'Menu',
    navigation: 'Navigation',
    account: 'Compte',
    home: 'Accueil',
    features: 'Fonctionnalités',
    security: 'Sécurité',
    ourStory: 'Notre histoire',
    privacyPolicy: 'Politique de confidentialité',
    termsOfService: "Conditions d'utilisation",
    login: 'Se connecter',
    logout: 'Déconnexion',
    getStarted: 'Commencer',
    language: 'Langue',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Conforme à la Loi 25 du Québec',
    // Pricing page translations
    pricing: 'Tarification',
    simplePricing: 'Tarification Simple et Transparente',
    pricingSubtitle: 'Gestion immobilière professionnelle qui évolue avec votre entreprise',
    professionalPlan: 'Plan Professionnel',
    perfectForPropertyManagers: 'Parfait pour les gestionnaires immobiliers de toutes tailles',
    perDoorPerMonth: 'par porte par mois',
    noSetupFees: "Aucuns frais d'installation",
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
    featuresOverviewDesc:
      'Découvrez comment notre plateforme complète peut rationaliser votre gestion immobilière',
    viewAllFeatures: 'Voir toutes les fonctionnalités',
    readyToGetStarted: 'Prêt à commencer?',
    allRightsReserved: 'Tous droits réservés',
    // Additional translations for missing elements
    residenceDocuments: 'Documents de résidence',
    manageDocumentsResidence: 'Gérer les documents de cette résidence',
    documentsCount: 'Documents ({count})',
    noDocumentsUploadedYet: 'Aucun document n\'a encore été téléchargé pour cette résidence.',
    myDemands: 'Mes demandes',
    showingResults: 'Affichage de {start} à {end} sur {total} demandes',
    manageBuildingsOrganization: 'Gérer {count} bâtiments dans votre organisation',
    searchBuildingsAddress: 'Rechercher des bâtiments par nom ou adresse...',
  },
};

export { translations };
