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
  documentLinkCreatedTitle: string;
  documentLinkCreatedDesc: string;
  documentLinkErrorTitle: string;
  documentLinkErrorDesc: string;
  linkPreviousDocumentTitle: string;
  linkNextDocumentTitle: string;
  linkDocumentPickerDescription: string;
  linkDocumentSearchPlaceholder: string;
  linkDocumentNoCandidates: string;
  linkExplainSharedCategory: string;
  linkExplainSharedTags: string;
  linkExplainCloseInTime: string;
  linkedBadge: string;
  byDateBadge: string;
  addPreviousDocument: string;
  addNextDocument: string;
  editPreviousLink: string;
  editNextLink: string;
  linkPositionLabel: string;
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
  select: string;
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
  quebecComplianceDesc: string;
  quebecDataProtectionDesc: string;
  memoryUsage: string;
  bundleSize: string;
  dbQueryTime: string;
  pageLoadTime: string;
  nextActions: string;
  initializeQAPillar: string;
  setupValidationQualityAssurance: string;
  configureTesting: string;
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
  invitationAlreadyPending: string;
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
  userManagementSubtitle: string;
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
  selectAll: string;
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
  vendorInvoiceNumber: string;
  issueDate: string;
  category: string;
  selectCategory: string;
  billTitle: string;
  companyOrServiceProvider: string;
  selectPaymentType: string;
  paymentType: string;
  allPaymentTypes: string;
  billType: string;
  allBillTypes: string;
  paymentStructure: string;
  allPaymentStructures: string;
  allPayments: string;
  in: string;
  unique: string;
  recurrent: string;
  single: string;
  installment: string;
  searchByVendor: string;
  // Payment management
  paymentDate: string;
  paymentAmount: string;
  paymentStatus: string;
  paymentDetails: string;
  paymentSchedule: string;
  paymentNumber: string;
  scheduledDate: string;
  amount: string;
  paid: string;
  overdue: string;
  paymentHistory: string;
  viewPayments: string;
  noPaymentsFound: string;
  monthlyPayments: string;
  singlePayment: string;
  selectSchedule: string;
  billingSchedule: string;
  selectStatus: string;
  monthlyBillsSummary: string;
  billsForSelectedBuilding: string;
  lastMonth: string;
  nextMonth: string;
  previousMonth: string;
  selectedMonth: string;
  totalBills: string;
  upcomingBills: string;
  totalDue: string;
  totalAmount: string;
  alreadyPaid: string;
  noBillsForPeriod: string;
  viewBillDetails: string;
  billDetails: string;
  closeDetails: string;
  downloadAttachment: string;
  noAttachment: string;
  billInformation: string;
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
  maintenanceJournal: string;
  inventory: string;
  projects: string;
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
  createDocument: string;
  editDocument: string;
  createDocumentDialogDescription: string;
  editDocumentDialogDescription: string;
  documentContent: string;
  effectiveDate: string;
  visibleToTenants: string;
  uploadDate: string;
  uploadFile: string;
  uploadFileOrCreateText: string;
  maxFileSize: string;
  yes: string;
  no: string;
  documentNameRequired: string;
  documentNameTooLong: string;
  documentDescriptionTooLong: string;
  missingContent: string;
  missingContentDescription: string;
  documentCreatedSuccessfully: string;
  documentUpdatedSuccessfully: string;
  documentDeletedSuccessfully: string;
  failedToCreateDocument: string;
  failedToUpdateDocument: string;
  failedToDeleteDocument: string;
  creatingDocument: string;
  updatingDocument: string;
  deletingDocument: string;
  documentVisibility: string;
  documentVisibilityDescription: string;
  managerOnly: string;
  managerOnlyDescription: string;
  showManagerOnlyDocuments: string;
  showOnlyLinkedDocuments: string;
  partOfSequence: string;
  linkedPrevious: string;
  linkedNext: string;
  confirmDeleteDocument: string;
  documentDetails: string;
  documentDetailsDescription: string;
  loadingDocument: string;
  documentAttachment: string;
  previewNotAvailable: string;
  previewNotAvailableDescription: string;
  backToResidences: string;
  backToBuildings: string;
  backToMyResidence: string;
  documents: string;
  documentsAvailableToTenants: string;
  allResidenceDocuments: string;
  categoryBylaws: string;
  categoryFinancial: string;
  categoryMaintenance: string;
  categoryLegal: string;
  categoryMeetingMinutes: string;
  categoryInsurance: string;
  categoryContracts: string;
  categoryPermits: string;
  categoryInspection: string;
  categoryOther: string;
  bylawsDocuments: string;
  financialDocuments: string;
  maintenanceRecords: string;
  legalDocuments: string;
  meetingMinutesDocuments: string;
  insuranceDocuments: string;
  contractsDocuments: string;
  permitsDocuments: string;
  inspectionReports: string;
  otherDocuments: string;
  loadingDemands2: string;
  noDemandsFound: string;
  noDocumentsFound: string;
  noDocumentsMatchFilters: string;
  documentsDeleted: string;
  successfullyDeleted: string;
  failedToDelete: string;
  failedToDeleteDocumentsCount: string;
  deselectAll: string;
  buildingIdRequired: string;
  residenceIdRequired: string;
  residenceNotFound: string;
  residenceIdDoesNotExist: string;
  productionDatabaseIdWarning: string;
  goToTestResidence: string;
  viewAndActions: string;
  tags: string;
  filterByTags: string;
  documentFound: string;
  documentsFound: string;
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
  allResidences: string;
  creator: string;
  allCreators: string;
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
  demoModeTitle: string;
  demoModeMessage: string;
  demoModeSuggestion: string;
  demoModeContact: string;
  demoFileUploadRestricted: string;
  demoBulkOperationRestricted: string;
  demoExportRestricted: string;
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
  buildingsManagementSubtitle: string;
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
  commonSpacesCount: string;
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
  residencesManagementSubtitle: string;
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
  budgetManagement: string;
  budgetManagementSubtitle: string;
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
  construction: string;
  consulting: string;
  equipmentRental: string;
  legalServices: string;
  technology: string;
  reserves: string;
  billsManagement: string;
  billsSubtitle: string;
  invoiceManagement: string;
  invoiceManagementSubtitle: string;
  filters: string;
  financialYearStarts: string;
  year: string;
  months: string;
  allMonths: string;
  allYears: string;
  allCategories: string;
  loadingBuildings: string;
  failedToLoadBuildings: string;
  retry: string;
  createFirstBill: string;
  noBillsFound: string;
  noBillsFoundMessage: string;
  loadingBills: string;
  searchBills: string;
  aiAnalyzedLabel: string;
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
  createDemand: string;
  typeLabel: string;
  buildingLabel: string;
  descriptionLabel: string;
  residenceOptional: string;
  noSpecificResidence: string;
  searchResidencesPlaceholder: string;
  attachmentsOptional: string;
  attachmentUploadInstructions: string;
  submitRequestComplaint: string;
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
  failedToCreateDemand: string;
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
  filtered: string;
  onThisPage: string;
  confirmEmail: string;
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
  noItemsFound: string;
  noItemsMessage: string;
  noBookingsFound: string;
  noBookingsFoundMessage: string;
  selectCommonSpace: string;
  selectCommonSpaceMessage: string;
  noComplianceData: string;
  noComplianceDataMessage: string;
  noCertificateFound: string;
  noCertificateFoundMessage: string;
  // Hierarchical selection messages
  buildingWithResidences: string;
  buildingsWithResidences: string;
  // Invitation management
  managePendingInvitations: string;
  loadingInvitations: string;
  deleteInvitation: string;
  deleteInvitationConfirm: string;
  invitationDeletedSuccess: string;
  invitationDeletedError: string;
  viewInvitationHistory: string;
  invitationHistory: string;
  invitationHistoryDescription: string;
  invitationHistoryEmpty: string;
  invitationHistoryLoadError: string;
  invitationHistoryAction: string;
  invitationHistoryPerformedBy: string;
  invitationHistoryWhen: string;
  invitationHistoryStatusChange: string;
  invitationHistorySource: string;
  invitationHistorySystem: string;
  invitationHistoryShowDetails: string;
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
  bugReportsSubtitle: string;
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
  ideaBoxSubtitle: string;
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
  privacyPolicyIntro: string;
  lastUpdated: string;
  informationCollection: string;
  informationCollectionDesc: string;
  informationUse: string;
  informationUseDesc: string;
  informationSharing: string;
  privacyRights: string;
  dataSecurity: string;
  contactPrivacy: string;
  privacyInfoItem1: string;
  privacyInfoItem2: string;
  privacyInfoItem3: string;
  privacyInfoItem4: string;
  privacyInfoItem5: string;
  privacyUseItem1: string;
  privacyUseItem2: string;
  privacyUseItem3: string;
  privacyUseItem4: string;
  privacyUseItem5: string;
  privacySharingIntro: string;
  privacySharingItem1: string;
  privacySharingItem2: string;
  privacySharingItem3: string;
  privacySharingItem4: string;
  privacySecurityIntro: string;
  privacySecurityItem1: string;
  privacySecurityItem2: string;
  privacySecurityItem3: string;
  privacySecurityItem4: string;
  privacySecurityItem5: string;
  privacyRightsIntro: string;
  privacyRightsItem1: string;
  privacyRightsItem2: string;
  privacyRightsItem3: string;
  privacyRightsItem4: string;
  privacyRightsItem5: string;
  privacyContactIntro: string;
  privacyContactEmail: string;
  privacyContactEmailLabel: string;
  privacyContactOfficer: string;
  backToHome: string;
  loginButton: string;
  securityTitle: string;
  securityIntro: string;
  enterpriseEncryption: string;
  enterpriseEncryptionDesc: string;
  roleBasedAccess: string;
  roleBasedAccessDesc: string;
  quebecDataProtection: string;
  secureInfrastructure: string;
  secureInfrastructureDesc: string;
  securityEnterpriseSectionTitle: string;
  securityEnterpriseSectionDesc: string;
  securityComplianceSectionTitle: string;
  securityComplianceSectionDesc: string;
  securityDetailsSectionTitle: string;
  securityDetailsSectionDesc: string;
  securityBadgeMilitaryGrade: string;
  securityBadgeControlledAccess: string;
  securityBadgeLaw25: string;
  securityBadgeHighAvailability: string;
  securityFeatureAes256: string;
  securityFeatureHttpsTls: string;
  securityFeatureSeparateKeys: string;
  securityFeatureKeyRotation: string;
  securityFeatureDefinedRoles: string;
  securityFeatureGranularPermissions: string;
  securityFeatureCompleteAudit: string;
  securityFeatureSecureSessions: string;
  securityFeatureCanadaHosted: string;
  securityFeatureLaw25Compliance: string;
  securityFeatureInformedConsent: string;
  securityFeatureRightToForget: string;
  securityFeatureMultiDataCenter: string;
  securityFeature247Monitoring: string;
  securityFeatureEncryptedBackups: string;
  securityFeatureDisasterRecovery: string;
  securityComplianceLaw25Title: string;
  securityComplianceLaw25Desc: string;
  securityComplianceIndustryTitle: string;
  securityComplianceIndustryDesc: string;
  securityComplianceEncryptionTitle: string;
  securityComplianceEncryptionDesc: string;
  securityStatusCertified: string;
  securityStatusCompliant: string;
  securityStatusActive: string;
  securityDataProtectionTitle: string;
  securityDataProtectionAes256: string;
  securityDataProtectionPasswordHash: string;
  securityDataProtectionAnonymization: string;
  securitySurveillanceTitle: string;
  securitySurveillanceLogging: string;
  securitySurveillanceDetection: string;
  securitySurveillanceAudits: string;
  securityCtaTitle: string;
  securityCtaDescription: string;
  securityCtaStartTrial: string;
  securityCtaViewPrivacy: string;
  securityCtaAccessDashboard: string;
  securityNavBackHome: string;
  securityNavPrivacyPolicy: string;
  securityNavOurStory: string;
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
  storyMissionTitle: string;
  storyMissionDesc: string;
  storyVisionTitle: string;
  storyVisionDesc: string;
  storyValuesTitle: string;
  storyValuesDesc: string;
  storyEngagementTitle: string;
  storyEngagementDesc: string;
  storyJourneyTitle: string;
  storyJourneySubtitle: string;
  storyOurValuesTitle: string;
  storyOurValuesSubtitle: string;
  storyValueComplianceTitle: string;
  storyValueComplianceDesc: string;
  storyValueServiceTitle: string;
  storyValueServiceDesc: string;
  storyValueInnovationTitle: string;
  storyValueInnovationDesc: string;
  storyValueCommunityTitle: string;
  storyValueCommunityDesc: string;
  storyTeamTitle: string;
  storyTeamSubtitle: string;
  storyTeamExpertise: string;
  storyTeamExpertiseDesc: string;
  storyTeamHighlight1: string;
  storyTeamHighlight2: string;
  storyTeamHighlight3: string;
  storyTeamHighlight4: string;
  storyDocumentationTitle: string;
  storyDocumentationDesc: string;
  storyViewDocumentation: string;
  storyAvailableDocuments: string;
  storyDownload: string;
  storyCtaTitle: string;
  storyCtaDesc: string;
  storyFreeTrial: string;
  storyDiscoverFeatures: string;
  storyAccessDashboard: string;
  storyBackHome: string;
  storyPrivacyPolicy: string;
  storySecurity: string;
  overview: string;
  quickActions: string;
  financialOverview: string;
  buildingFinancialOverview: string;
  budgetTrendAnalysis: string;
  budgetTrendAnalysisMonthly: string;
  projectManagement: string;
  projectManagementDesc: string;
  projectsAffectingBudget: string;
  fiscalYearFilter: string;
  fiscalYearFilters: string;
  loadNext25Years: string;
  pastFiscalYears: string;
  startingFiscalYear: string;
  chartYearPickerHelp: string;
  currentFiscalYear: string;
  futureProjections: string;
  monthlyView: string;
  yearlyView: string;
  noBuildingsAssigned: string;
  displaying: string;
  monthly: string;
  yearly: string;
  manageProjectsForCurrentYear: string;
  listView: string;
  ganttView: string;
  noDatesSet: string;
  includeInBudget: string;
  excludeFromBudget: string;
  statusSubmission: string;
  statusPreWork: string;
  statusPostWork: string;
  loadingProjects: string;
  quickProject: string;
  actual: string;
  cost: string;
  include: string;
  noProjectsFound: string;
  minimumRequirement: string;
  investments: string;
  ofWhich: string;
  calendar: string;
  myResidence: string;
  myBuilding: string;
  commonSpaces: string;
  budget: string;
  bills: string;
  demands: string;
  navUserManagement: string;
  documentTags: string;
  manageCommonSpaces: string;
  documentation: string;
  pillars: string;
  roadmap: string;
  navQualityAssurance: string;
  navLaw25Compliance: string;
  rbacPermissions: string;
  modernPropertyManagement: string;
  comprehensivePropertyManagement: string;
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
  
  // Trial Request Form
  trialRequestTitle: string;
  trialRequestDescription: string;
  personalInformation: string;
  companyInformation: string;
  propertyInformation: string;
  additionalInformation: string;
  company: string;
  city: string;
  province: string;
  postalCode: string;
  numberOfBuildings: string;
  numberOfResidences: string;
  message: string;
  submitRequest: string;
  copyright: string;
  law25Compliant: string;
  pricing: string;
  simplePricing: string;
  pricingSubtitle: string;
  professionalPlan: string;
  perfectForPropertyManagers: string;
  perDoorPerMonth: string;
  noSetupFees: string;
  condoManagementPlan: string;
  condoManagementDescription: string;
  rentalManagementPlan: string;
  rentalManagementDescription: string;
  applicationIncluded: string;
  pricingSubjectToChange: string;
  basedOnClientNeeds: string;
  plusExpenses: string;
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
  unlimitedUsersDisclaimer: string;
  largeClientTitle: string;
  largeClientDescription: string;
  largeClientBenefit: string;
  largeClientCta: string;
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
  whatsIncluded: string;
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
  searchTypePlaceholder: string;
  showingDemandsRange: string;
  buildingField: string;
  residenceField: string;
  createdField: string;
  unknownBuilding: string;
  loadingDemandsMessage: string;
  manageBuildingsOrganization: string;
  searchBuildingsAddress: string;
  fullscreen: string;
  exitFullscreen: string;
  save: string;
  close: string;
  edit: string;
  delete: string;
  deleteOrphanUsers: string;
  deleteOrphanUsersConfirmTitle: string;
  deleteOrphanUsersConfirmDescription: string;
  deleteOrphanUsersWarning: string;
  deleteOrphanUsersWarningList1: string;
  deleteOrphanUsersWarningList2: string;
  deleteOrphanUsersWarningList3: string;
  deleteOrphanUsersWarningList4: string;
  filterByOrganization: string;
  orphanFilterUnavailable: string;
  userInvitationsNotAvailableDemo: string;
  allUsers: string;
  orphanUsers: string;
  assignedUsers: string;
  noStatus: string;
  noOrganizations: string;
  noBuildings: string;
  noResidences: string;
  more: string;
  
  selectBuildingInventoryMessage: string;
  inventoryManagementSubtitle: string;
  backToBuilding: string;
  buildingElements: string;
  toggleBuildingElementsTable: string;
  searchElementsPlaceholder: string;
  overdueEvaluations: string;
  addElement: string;
  allConditions: string;
  excellent: string;
  good: string;
  fair: string;
  poor: string;
  uniformatCategory: string;
  uniformatSubstructure: string;
  uniformatShell: string;
  uniformatInteriors: string;
  uniformatServices: string;
  uniformatEquipmentFurnishings: string;
  uniformatSpecialConstruction: string;
  uniformatBuildingSitework: string;
  elementDocuments: string;
  uniformatBrowser: string;
  featureComingSoon: string;
  evaluationSchedulingComingSoon: string;
  elementImportComingSoon: string;
  reportExportComingSoon: string;
  elementDeleted: string;
  elementDeletedSuccessfully: string;
  
  selectBuildingProjectsMessage: string;
  projectsMaintenanceManagement: string;
  projectsManagementSubtitle: string;
  toggleProjectOverview: string;
  projectsSelected: string;
  newProject: string;
  toggleProjectsTable: string;
  projectTable: string;
  projectStatus: string;
  projectTimeline: string;
  projectElements: string;
  projectNotes: string;
  projectBudget: string;
  projectCreated: string;
  projectUpdated: string;
  projectUpdateFailed: string;
  projectDeleted: string;
  projectDeleteFailed: string;
  editProject: string;
  editProjectDescription: string;
  confirmDeleteProject: string;
  fillRequiredFields: string;
  projectCreatedSuccessfully: string;
  projectUpdatedSuccessfully: string;
  projectsCreated: string;
  projectsCreatedFromSuggestions: string;
  projectCreatedSuccessfully2: string;
  autoProjectConvertedSuccess: string;
  statusUpdated: string;
  projectStatusUpdatedSuccessfully: string;
  
  // Demand details translations
  demandDetails: string;
  escalateToManager: string;
  fileAttachment: string;
  view: string;
  download: string;
  location: string;
  reviewNotes: string;
  addReviewNotes: string;
  updated: string;
  comments: string;
  addAComment: string;
  addComment: string;
  adding: string;
  noCommentsYet: string;
  commentsDisabledFor: string;
  deleteDemand: string;
  confirmDeleteDemand: string;
  demandUpdatedSuccessfully: string;
  failedToUpdateDemand: string;
  demandDeletedSuccessfully: string;
  failedToDeleteDemand: string;
  commentAddedSuccessfully: string;
  failedToAddComment: string;
  underReviewStatus: string;
  approvedStatus: string;
  rejectedStatus: string;
  inProgressStatus: string;
  completedStatus: string;
  cancelledStatus: string;
  submittedStatus: string;
  viewRelatedDocuments: string;
  descriptionMinLengthError: string;
  descriptionMaxLengthError: string;
  reviewNotesMaxLengthError: string;
  commentMinLengthError: string;
  commentMaxLengthError: string;
  
  // Bills translations
  'bills.editBill': string;
  'bills.createNewBill': string;
  'bills.createFromTemplate': string;
  'bills.aiExtracted': string;
  'bills.manualEntry': string;
  'bills.aiExtraction': string;
  'bills.uploadBillDocument': string;
  'bills.uploadDocumentOptional': string;
  'bills.autoSaving': string;
  'bills.title': string;
  'bills.vendor': string;
  'bills.vendorInvoiceNumber': string;
  'bills.issueDate': string;
  'bills.issueDateFrom': string;
  'bills.issueDateTo': string;
  'bills.dueDate': string;
  'bills.amount': string;
  'bills.category': string;
  'bills.status': string;
  'bills.paymentType': string;
  'bills.totalAmount': string;
  'bills.totalAmountOptional': string;
  'bills.startDate': string;
  'bills.paymentSchedule': string;
  'bills.paymentConfiguration': string;
  'bills.initialPayment': string;
  'bills.equalRecurringPayments': string;
  'bills.initialPaymentAmount': string;
  'bills.recurringPaymentAmount': string;
  'bills.recurrenceEndDate': string;
  'bills.customPaymentSchedule': string;
  'bills.individualPaymentAmounts': string;
  'bills.addPayment': string;
  'bills.amount': string;
  'bills.date': string;
  'bills.description': string;
  'bills.notes': string;
  'bills.statusDraft': string;
  'bills.statusDraftNote': string;
  'bills.statusSent': string;
  'bills.statusSentPartiallyPaid': string;
  'bills.statusOverdue': string;
  'bills.statusPaid': string;
  'bills.statusCancelled': string;
  'bills.paymentTypeOneTime': string;
  'bills.paymentTypeRecurring': string;
  'bills.scheduleWeekly': string;
  'bills.scheduleMonthly': string;
  'bills.scheduleQuarterly': string;
  'bills.scheduleYearly': string;
  'bills.yearInterval': string;
  'bills.yearIntervalDescription': string;
  'bills.scheduleCustom': string;
  'bills.totalAmountDescriptionOneTime': string;
  'bills.totalAmountDescriptionRecurring': string;
  'bills.initialPaymentDescription': string;
  'bills.equalRecurringPaymentsDescription': string;
  'bills.initialPaymentAmountDescription': string;
  'bills.recurringPaymentAmountDescription': string;
  'bills.recurrenceEndDateDescription': string;
  'bills.customPaymentScheduleDescription': string;
  'bills.individualPaymentAmountsDescription': string;
  'bills.deleting': string;
  'bills.deleteBill': string;
  'bills.cancel': string;
  'bills.processing': string;
  'bills.updateBill': string;
  'bills.createBill': string;
  'bills.paymentCount': string;
  'bills.paymentCountSingle': string;
  'bills.paymentCountMultiple': string;
  'bills.paymentCountDescription': string;
  'bills.recurrence': string;
  'bills.recurrenceDescription': string;
  'bills.singlePaymentAmount': string;
  'bills.singlePaymentAmountDescription': string;
  'bills.calculatedTotalAmount': string;
  'bills.totalAmountSingleDescription': string;
  'bills.totalAmountMultipleEqualDescription': string;
  'bills.totalAmountMultipleCustomDescription': string;
  'bills.autoCalculatedBadge': string;
  'bills.fromPaymentAmountBadge': string;
  'bills.billType': string;
  'bills.billTypeUnique': string;
  'bills.billTypeRecurrent': string;
  'bills.billTypeDescription': string;
  'bills.paymentStructure': string;
  'bills.paymentStructureSingle': string;
  'bills.paymentStructureInstallment': string;
  'bills.paymentStructureDescription': string;
  'bills.recurrenceEndDateDescriptionSingle': string;
  'bills.recurrenceEndDateDescriptionInstallment': string;
  'bills.editAutoGeneratedDescription': string;
  'bills.extractingData': string;
  'bills.extractingDataNote': string;
  'bills.customPaymentDateRequired': string;
  'bills.customPaymentDateRequiredSingle': string;
  'bills.customPaymentDateRequiredPlural': string;
  
  // Bug Reports additional keys (unique non-duplicate keys only)
  editBugReport: string;
  bugReportDetails: string;
  areYouSureDeleteBugReport: string;
  savingChanges: string;
  fileAttached: string;
  searchAndFilters: string;
  categoryAndSort: string;
  
  // Idea Box additional keys (unique non-duplicate keys only)
  mostUpvotes: string;
  whyIsThisNeeded: string;
  chooseDocumentType: string;
  textDocument: string;
  selectFileToUpload: string;
  attachScreenshot: string;
  addDetailedNotes: string;
  thisWillShowAsAdditionalNotes: string;
  submitIdea: string;
  editIdea: string;
  internalNotesVisibleAdmins: string;
  currentAttachment: string;
  uploadNewFileToReplace: string;
  updateIdea: string;
  deleteIdea: string;
  attachment: string;
  attachments: string;
  submittedOn: string;
  lastUpdatedOn: string;
  
  // Additional idea box and common keys (unique non-duplicate keys only)
  featureTitlePlaceholder: string;
  featureDescriptionPlaceholder: string;
  whyIsThisNeededPlaceholder: string;
  pageLocationPlaceholder: string;
  adminNotes: string;
  search: string;
  noIdeasFound: string;
  tryAdjustingSearchOrFilters: string;
  getStartedBySubmittingFirstIdea: string;
  confirmDeleteIdea: string;
  
  // Additional Bug Reports translation keys (unique non-duplicate keys only)
  bugReportCreatedSuccessfully: string;
  bugReportUpdatedSuccessfully: string;
  bugReportDeletedSuccessfully: string;
  failedToCreateBugReport: string;
  failedToUpdateBugReport: string;
  failedToDeleteBugReport: string;
  titleRequired: string;
  descriptionMinLength20: string;
  pageLocationRequired: string;
  noBugsMatchFilters: string;
  noBugReportsYet: string;
  
  // Additional Idea Box translation keys (unique non-duplicate keys only)
  ideaSubmittedSuccessfully: string;
  ideaUpdatedSuccessfully: string;
  ideaDeletedSuccessfully: string;
  failedToSubmitIdea: string;
  failedToUpdateIdea: string;
  failedToDeleteIdea: string;
  upvoteRecorded: string;
  failedToUpvote: string;
  featureTitleRequired: string;
  titleMaxLength200: string;
  descriptionMinLength10: string;
  descriptionMaxLength2000: string;
  needMinLength5: string;
  needMaxLength500: string;
  pageLocationMaxLength100: string;
  adminNotesMaxLength1000: string;
  
  // Common Filter Component translations (unique non-duplicate keys only)
  filter: string;
  addFilter: string;
  selectField: string;
  searchFields: string;
  selectOperator: string;
  searchOperators: string;
  selectValue: string;
  searchValues: string;
  enterValue: string;
  applyFilter: string;
  sort: string;
  clearSort: string;
  quickFilters: string;
  searchPresets: string;
  clearAll: string;
  results: string;
  searchPlaceholder: string;
  
  // Bills Payment Schedule translations (unique non-duplicate keys only)
  markPaid: string;
  noPaymentInformation: string;
  paidLabel: string;
  
  // Bill Category translations (unique non-duplicate keys only)
  categoryAdministration: string;
  categoryCleaning: string;
  categoryConstruction: string;
  categoryConsulting: string;
  categoryEquipmentRental: string;
  categoryLandscaping: string;
  categoryLegalServices: string;
  categoryProfessionalServices: string;
  categoryRepairs: string;
  categoryReserves: string;
  categorySalary: string;
  categorySecurity: string;
  categorySupplies: string;
  categoryTaxes: string;
  categoryTechnology: string;
  categoryUtilities: string;
  
  // Bill Document Management translations (unique non-duplicate keys only)
  attachedDocuments: string;
  noDocumentsAttached: string;
  clickAddDocumentToStart: string;
  documentDeleteFailed: string;
  confirmDeleteDocumentMessage: string;

  // Features Page translations
  featuresPageTitle: string;
  featuresPageTitleHighlight: string;
  featuresPageSubtitle: string;
  featuresPageTryNow: string;
  featuresPageStartNow: string;
  featuresCoreFeaturesTitle: string;
  featuresCoreFeaturesSubtitle: string;
  featuresAdvancedTitle: string;
  featuresAdvancedSubtitle: string;
  featuresComplianceTitle: string;
  featuresComplianceSubtitle: string;
  featuresReadyToTransform: string;
  featuresJoinManagers: string;
  featuresBuildingManagementTitle: string;
  featuresBuildingManagementDesc: string;
  featuresBuildingManagement1: string;
  featuresBuildingManagement2: string;
  featuresBuildingManagement3: string;
  featuresBuildingManagement4: string;
  featuresResidentPortalTitle: string;
  featuresResidentPortalDesc: string;
  featuresResidentPortal1: string;
  featuresResidentPortal2: string;
  featuresResidentPortal3: string;
  featuresResidentPortal4: string;
  featuresFinancialReportsTitle: string;
  featuresFinancialReportsDesc: string;
  featuresFinancialReports1: string;
  featuresFinancialReports2: string;
  featuresFinancialReports3: string;
  featuresFinancialReports4: string;
  featuresLaw25Title: string;
  featuresLaw25Desc: string;
  featuresLaw251: string;
  featuresLaw252: string;
  featuresLaw253: string;
  featuresLaw254: string;
  featuresProjectMgmtTitle: string;
  featuresProjectMgmtDesc: string;
  featuresProjectMgmt1: string;
  featuresProjectMgmt2: string;
  featuresProjectMgmt3: string;
  featuresProjectMgmt4: string;
  featuresDocMgmtTitle: string;
  featuresDocMgmtDesc: string;
  featuresDocMgmt1: string;
  featuresDocMgmt2: string;
  featuresDocMgmt3: string;
  featuresNotificationsTitle: string;
  featuresNotificationsDesc: string;
  featuresNotifications1: string;
  featuresNotifications2: string;
  featuresNotifications3: string;
  featuresBillingTitle: string;
  featuresBillingDesc: string;
  featuresBilling1: string;
  featuresBilling2: string;
  featuresBilling3: string;
  featuresCommTitle: string;
  featuresCommDesc: string;
  featuresComm1: string;
  featuresComm2: string;
  featuresComm3: string;
  featuresPlanningTitle: string;
  featuresPlanningDesc: string;
  featuresPlanning1: string;
  featuresPlanning2: string;
  featuresPlanning3: string;
  featuresProcessTitle: string;
  featuresProcessDesc: string;
  featuresProcess1: string;
  featuresProcess2: string;
  featuresProcess3: string;
  featuresCompLaw25Title: string;
  featuresCompLaw25Desc: string;
  featuresCompCondoTitle: string;
  featuresCompCondoDesc: string;
  featuresCompFinancialTitle: string;
  featuresCompFinancialDesc: string;
  featuresCompBilingualTitle: string;
  featuresCompBilingualDesc: string;

  // Home Page Feature Card Popup translations
  learnMore: string;
  viewSecurityDetails: string;

  // Budget Page translations
  budgetFilters: string;
  budgetTrendAnalysisCard: string;
  budgetProjectManagement: string;
  budgetBankAccountConfig: string;
  budgetMinimumRequirementCard: string;
  budgetCustomBankAccountFields: string;
  budgetFieldName: string;
  budgetFieldValue: string;
  budgetRevenueConfig: string;
  budgetBillsConfig: string;
  budgetCapitalInvestmentScenarios: string;
  budgetBackToBuilding: string;
  budgetAddInvestment: string;
  budgetEditInvestment: string;
  budgetSaveChanges: string;
  budgetAddQuickProject: string;
  budgetAddProject: string;
  budgetRefresh: string;
  budgetAddCustomRevenueLine: string;
  budgetRemoveRevenueLine: string;
  budgetRemoveInvestment: string;
  budgetConfirmInvestment: string;
  budgetStartingBalance: string;
  budgetBalanceDate: string;
  budgetFinancialYearStart: string;
  budgetMinimumRequirementAmount: string;
  budgetRevenueGrowthRate: string;
  budgetMonthlyAmount: string;
  budgetInflationRate: string;
  budgetGlobalInflation: string;
  budgetPerCategoryInflation: string;
  budgetUnplannedBills: string;
  budgetInvestmentTitle: string;
  budgetInvestmentDescription: string;
  budgetInvestmentAmount: string;
  budgetTargetDate: string;
  budgetUrgencyLevel: string;
  budgetProjectTitle: string;
  budgetProjectBudget: string;
  budgetProjectFinancialYear: string;
  budgetProjectDescription: string;
  budgetEnterAmount: string;
  budgetEnterTitle: string;
  budgetEnterDescription: string;
  budgetOptionalDetails: string;
  budgetEnterProjectTitle: string;
  budgetOptionalProjectDescription: string;
  budgetBankAccountSaveSuccess: string;
  budgetBankAccountSaveSuccessDesc: string;
  budgetBankAccountSaveFailed: string;
  budgetBankAccountSaveFailedDesc: string;
  budgetRevenueSaveSuccess: string;
  budgetRevenueSaveSuccessDesc: string;
  budgetRevenueSaveFailed: string;
  budgetRevenueSaveFailedDesc: string;
  budgetBillsSaveSuccess: string;
  budgetBillsSaveSuccessDesc: string;
  budgetBillsSaveFailed: string;
  budgetBillsSaveFailedDesc: string;
  budgetInvestmentsSaveSuccess: string;
  budgetInvestmentsSaveSuccessDesc: string;
  budgetInvestmentsSaveFailed: string;
  budgetRefreshSuccess: string;
  budgetRefreshSuccessDesc: string;
  budgetRefreshFailed: string;
  budgetRefreshFailedDesc: string;
  budgetInvestmentAdded: string;
  budgetInvestmentAddedDesc: string;
  budgetInvestmentRemoved: string;
  budgetInvestmentRemovedDesc: string;
  budgetInvestmentUpdated: string;
  budgetInvestmentUpdatedDesc: string;
  budgetInvestmentConfirmed: string;
  budgetInvestmentConfirmedDesc: string;
  budgetQuickProjectAdded: string;
  budgetQuickProjectAddedDesc: string;
  budgetQuickProjectDeleted: string;
  budgetQuickProjectDeletedDesc: string;
  budgetDeleteQuickProjectConfirm: string;
  budgetInvalidAmount: string;
  budgetInvalidAmountDesc: string;
  budgetInvalidValue: string;
  budgetInvalidValueDesc: string;
  budgetCannotRemoveAutoGenerated: string;
  budgetCannotRemoveAutoGeneratedDesc: string;
  budgetCannotEditAutoGenerated: string;
  budgetCannotEditAutoGeneratedDesc: string;
  budgetValidationError: string;
  budgetFillAllFields: string;
  budgetInvestmentNotFound: string;
  budgetInvestmentNotFoundDesc: string;
  budgetCurrentBalanceApplied: string;
  budgetCurrentBalanceAppliedDesc: string;
  budgetAddNewInvestment: string;
  budgetEditInvestmentTitle: string;
  budgetAddQuickProjectTitle: string;
  budgetRevenue: string;
  budgetSpending: string;
  budgetBalanceStartOfPeriod: string;
  budgetBalanceEndOfPeriod: string;
  budgetNetCashFlow: string;
  budgetCapitalInvestments: string;
  budgetMinimumRequirementLine: string;
  budgetMonthlyView: string;
  budgetYearlyView: string;
  budgetMonth: string;
  budgetYear: string;
  budgetShowing: string;
  budgetDisplaying: string;
  budgetOf: string;
  budgetSeriesVisible: string;
  budgetUrgent: string;
  budgetNotUrgent: string;
  budgetSuggested: string;
  budgetAutoGenerated: string;
  budgetQuickProjectBadge: string;
  budgetCurrentBalance: string;
  budgetMonthlyRevenue: string;
  budgetMonthlySpending: string;
  budgetYearEndProjection: string;
  budgetTotalInvestment: string;
  budgetUseQuickProjectHelp: string;
  budgetConfirmAndMakePermanent: string;
  budgetMonths: string;
  budgetYears: string;
  budgetTotalMonthlyRevenue: string;
  budgetTotalMonthlyExpenses: string;
  budgetMonthlyResidenceFees: string;
  budgetInflationRateMode: string;
  budgetCategorySpecificInflationRates: string;
  budgetCapitalInvestmentStrategy: string;
  budgetUrgentCapitalOnly: string;
  budgetSuggestedPlusUrgent: string;
  budgetAllInvestments: string;
  budgetUtilitiesInflation: string;
  budgetMaintenanceInflation: string;
  budgetGeneralInflation: string;
  budgetOtherInflation: string;
  budgetTotalMinimumRequirement: string;
  budgetMinimumRequirementSummary: string;
  budgetSaveMinimumRequirement: string;
  budgetRequired: string;
  budgetOptional: string;
  budgetIncludeInBudget: string;
  budgetActualCost: string;
  budgetNoProjectsFound: string;
  budgetSaveBankAccountSettings: string;
  budgetSaveRevenueConfiguration: string;
  budgetSaveBillsConfiguration: string;
  budgetDescriptionPlaceholder: string;
  budgetManageProjectsForCurrentYear: string;
  budgetUrgentCapitalInjection: string;
  budgetSuggestedCapitalInjection: string;
  budgetAutoGeneratedScenario: string;
  
  // Capital Investment Scenarios (additional keys)
  budgetMonthlyPayment: string;
  budgetNoPaymentNeeded: string;
  budgetSuggestedCapital: string;
  budgetSuggestedCapitalDesc: string;
  budgetUrgentCapitalOnlyDesc: string;
  budgetCustomMode: string;
  budgetCustomModeDesc: string;
  budgetNoAutomaticCapitalInjections: string;
  budgetCapitalInvestmentStrategyHelp: string;
  budgetUrgentScenarioHelp: string;
  budgetSuggestedScenarioHelp: string;
  budgetCustomScenarioHelp: string;
  budgetInvestmentTitlePlaceholder: string;
  budgetInvestmentDescriptionPlaceholder: string;
  budgetNoInvestmentsMatch: string;
  budgetAddCustomInvestmentsHelp: string;
  
  // Bills Configuration
  budgetRecurrentBills: string;
  budgetUniqueBills: string;
  budgetInflationRateSettings: string;
  budgetApplySameRateToAllBills: string;
  budgetSetDifferentRatesPerCategory: string;
  budgetPerCategory: string;
  budgetGlobal: string;
  budgetGlobalBillsInflationRate: string;
  budgetAppliedToAllBillCategories: string;
  budgetUtilities: string;
  budgetGeneral: string;
  budgetSetDifferentInflationRates: string;
  budgetUnplannedBillsMonthly: string;
  budgetUnplannedBillsStartDate: string;
  budgetNextMonth: string;
  budgetAdditionalBudgetUnexpected: string;
  budgetPunctualRevenueGrowth: string;
  budgetPunctualRevenueGrowthDesc: string;
  budgetPercentageIncrease: string;
  budgetInflationIncluded: string;
  budgetInflationIncludedTooltip: string;
  budgetAddPunctualGrowth: string;
  budgetNoPunctualGrowth: string;
  budgetDeletePunctualGrowth: string;
  budgetInvalidYear: string;
  budgetInvalidMonth: string;
  budgetYearAlreadyExists: string;
  budgetYearMonthAlreadyExists: string;
  budgetRevenueConfigurationHelp: string;
  budgetRevenueGrowthRateHelp: string;
  budgetPunctualRevenueGrowthHelp: string;
  budgetInflationIncludedHelp: string;
  budgetRevenueConfigNote: string;
  budgetRevenueGrowthRateNote: string;
  selectMonth: string;
  selectDay: string;
  plannedDate: string;
  budgetHistoricalAverage: string;
  budgetNoDataAvailable: string;
  budgetManualOverride: string;
  budgetMonthlyExpenses: string;
  
  // Revenue Configuration
  budgetResidenceRevenue: string;
  loadingResidenceData: string;
  budgetResidenceDataLoadFailed: string;
  budgetRevenueCalculationIncomplete: string;
  budgetActiveResidences: string;
  budgetPerMonth: string;
  budgetCustomRevenueSources: string;
  budgetCustomRevenue: string;
  
  // Project Management
  budgetProjectsAffectingBudget: string;
  budgetFinancialYearStartHelp: string;
  budgetAddQuickProjectDescription: string;
  budgetTotalBudget: string;
  budgetPleaseCompleteRequiredFields: string;
  
  // General
  investment: string;
  years: string;
  month: string;
  increase: string;
  validationError: string;
  notSet: string;
  
  // Bill Payments
  payments: string;
  noPaymentsCurrentYear: string;
  noFiscalYearWarning: string;
  
  // Additional missing translations
  balcony: string;
  condition: string;
  contactAddedSuccessfully: string;
  contactDeletedSuccessfully: string;
  contactUpdatedSuccessfully: string;
  deleteDocuments: string;
  deleteDocumentsConfirmation: string;
  documentNotFound: string;
  errorLoadingBuildings: string;
  failedToLoadBuildingInformation: string;
  inventoryManagement: string;
  loadingDocuments: string;
  noBuildingsAccess: string;
  noMatchingBuildings: string;
  noMatchingBuildingsDescription: string;
  searchBuildingsByNameOrAddress: string;
  updateBugReport: string;
  viewAccessibleBuildingsAndDocuments: string;

  // Terms of Service Page
  termsPageTitle: string;
  termsLastUpdated: string;
  termsIntro: string;
  termsSection1Title: string;
  termsSection1Content: string;
  termsSection2Title: string;
  termsSection2Intro: string;
  termsServiceItem1: string;
  termsServiceItem2: string;
  termsServiceItem3: string;
  termsServiceItem4: string;
  termsServiceItem5: string;
  termsSection3Title: string;
  termsSection3Intro: string;
  termsAccountItem1: string;
  termsAccountItem2: string;
  termsAccountItem3: string;
  termsAccountItem4: string;
  termsAccountItem5: string;
  termsSection4Title: string;
  termsSection4Intro: string;
  termsUseItem1: string;
  termsUseItem2: string;
  termsUseItem3: string;
  termsUseItem4: string;
  termsUseItem5: string;
  termsUseItem6: string;
  termsSection5Title: string;
  termsSection5Content: string;
  termsSection6Title: string;
  termsSection6Content: string;
  termsSection7Title: string;
  termsSection7Intro: string;
  termsPaymentItem1: string;
  termsPaymentItem2: string;
  termsPaymentItem3: string;
  termsPaymentItem4: string;
  termsPaymentItem5: string;
  termsSection8Title: string;
  termsSection8Content: string;
  termsSection9Title: string;
  termsSection9Content: string;
  termsSection10Title: string;
  termsSection10Intro: string;
  termsTerminationItem1: string;
  termsTerminationItem2: string;
  termsTerminationItem3: string;
  termsTerminationItem4: string;
  termsSection11Title: string;
  termsSection11Content: string;
  termsSection12Title: string;
  termsSection12Content: string;
  termsSection13Title: string;
  termsSection13Intro: string;
  termsContactInfo: string;

  // Enterprise Page
  enterprise: string;
  enterprisePageTitle: string;
  enterprisePageSubtitle: string;
  enterpriseVersatilityTitle: string;
  enterpriseVersatilityDesc: string;
  enterpriseRentals: string;
  enterpriseCondos: string;
  enterpriseRentalsDesc: string;
  enterpriseCondosDesc: string;
  enterpriseWhiteLabelTitle: string;
  enterpriseWhiteLabelDesc: string;
  enterpriseWhiteLabelExplanation: string;
  enterpriseWhiteLabelBenefit1: string;
  enterpriseWhiteLabelBenefit2: string;
  enterpriseWhiteLabelBenefit3: string;
  enterprisePricingTitle: string;
  enterprisePricingDesc: string;
  enterprisePriceTier1: string;
  enterprisePriceTier1Desc: string;
  enterprisePriceTier2: string;
  enterprisePriceTier2Desc: string;
  enterprisePriceTier3: string;
  enterprisePriceTier3Desc: string;
  enterprisePriceTier4: string;
  enterprisePriceTier4Desc: string;
  enterpriseJuniorTitle: string;
  enterpriseJuniorDesc: string;
  enterpriseJuniorBenefit: string;
  enterpriseAdvantagesTitle: string;
  enterpriseAdvantage1: string;
  enterpriseAdvantage1Desc: string;
  enterpriseAdvantage2: string;
  enterpriseAdvantage2Desc: string;
  enterpriseAdvantage3: string;
  enterpriseAdvantage3Desc: string;
  enterpriseContactTitle: string;
  enterpriseContactDesc: string;
  enterpriseContactEmail: string;
  enterpriseContactPhone: string;
  enterpriseRequestQuote: string;
  enterprisePerDoor: string;
  enterprisePerMonth: string;
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
    select: 'Select',
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
    quebecComplianceDesc: 'Quebec regulatory compliance for property management',
    quebecDataProtectionDesc: 'Data protection in accordance with Quebec Law 25',
    memoryUsage: 'Memory Usage',
    bundleSize: 'Bundle Size',
    dbQueryTime: 'DB Query Time',
    pageLoadTime: 'Page Load Time',
    nextActions: 'Next Actions',
    initializeQAPillar: 'Initialize QA Pillar',
    setupValidationQualityAssurance: 'Set up validation and quality assurance framework',
    configureTesting: 'Configure Testing',
    continuousImprovementPillar: 'Continuous Improvement',
    continuousImprovementDescription: 'Ongoing optimization and enhancement framework',
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
    users: 'User management',
    usersSelected: 'users selected',
    bulkActions: 'Bulk Actions',
    moreActions: 'More Actions',
    newRole: 'New Role',
    selectRole: 'Select role',
    admin: 'Administrator',
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
    invitationAlreadyPending:
      'A pending invitation already exists for this organization and email. Use Resend Invitation to extend its expiry, or Cancel Invitation to start over.',
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
    userManagementSubtitle: 'Manage users, roles, access permissions, and send invitations to new members.',
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
    selectAll: 'Select all',
    lastLogin: 'Last Login',
    joinedDate: 'Joined Date',
    userActions: 'User Actions',
    actions: 'Actions',
    resetPassword: 'Reset Password',
    deactivateUser: 'Deactivate User',
    activateUser: 'Activate User',
    deleteUser: 'Delete User',
    deleteOrphanUsers: 'Delete Orphan Users',
    deleteOrphanUsersConfirmTitle: 'Delete Orphan Users',
    deleteOrphanUsersConfirmDescription: 'This will permanently mark all orphan users (users with no organization or residence assignments) as inactive.',
    deleteOrphanUsersWarning: 'Warning: This action will:',
    deleteOrphanUsersWarningList1: 'Mark all orphan users as inactive (they will be hidden from the interface)',
    deleteOrphanUsersWarningList2: 'Preserve their data for audit purposes but remove access',
    deleteOrphanUsersWarningList3: 'Only affect users with no organization or residence assignments',
    deleteOrphanUsersWarningList4: 'Cannot be undone through the interface',
    filterByOrganization: 'Filter by organization',
    orphanFilterUnavailable: 'Orphan filter unavailable (organization selected)',
    userInvitationsNotAvailableDemo: 'User invitations are not available in demo mode',
    allUsers: 'All Users',
    orphanUsers: 'Orphan Users',
    assignedUsers: 'Assigned Users',
    noStatus: 'No Status',
    noOrganizations: 'No organizations',
    noBuildings: 'No buildings',
    noResidences: 'No residences',
    more: 'more',
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
    vendorInvoiceNumber: 'Bill / Invoice Number',
    issueDate: 'Issue Date',
    category: 'Category',
    selectCategory: 'Select category',
    billTitle: 'Bill Title',
    companyOrServiceProvider: 'Company/Service Provider',
    selectPaymentType: 'Select payment type',
    paymentType: 'Payment Type',
    allPaymentTypes: 'All Payment Types',
    billType: 'Bill Type',
    allBillTypes: 'All Bill Types',
    paymentStructure: 'Payment Structure',
    allPaymentStructures: 'All Payment Structures',
    unique: 'Unique',
    recurrent: 'Recurrent',
    single: 'Single',
    installment: 'Installment',
    searchByVendor: 'Search by vendor...',
    allPayments: 'All Payments',
    in: 'in',
    // Payment management
    paymentDate: 'Payment Date',
    paymentAmount: 'Payment Amount',
    paymentStatus: 'Payment Status',
    paymentDetails: 'Payment Details',
    paymentSchedule: 'Payment Schedule',
    paymentNumber: 'Payment Number',
    scheduledDate: 'Scheduled Date',
    amount: 'Amount',
    paid: 'Paid',
    overdue: 'Overdue',
    paymentHistory: 'Payment History',
    viewPayments: 'View Payments',
    noPaymentsFound: 'No payments found',
    monthlyPayments: 'Monthly Payments',
    singlePayment: 'Single Payment',
    selectSchedule: 'Select schedule',
    billingSchedule: 'Billing Schedule',
    selectStatus: 'Select status',
    monthlyBillsSummary: 'Monthly Bills Summary',
    billsForSelectedBuilding: 'Bills with payments scheduled for the selected building',
    lastMonth: 'Last Month',
    nextMonth: 'Next Month',
    previousMonth: 'Previous Month',
    selectedMonth: 'Selected Month',
    totalBills: 'Total Bills',
    upcomingBills: 'Upcoming Bills',
    totalDue: 'Total Due',
    totalAmount: 'Total Amount',
    alreadyPaid: 'Already Paid',
    noBillsForPeriod: 'No bills for this period',
    viewBillDetails: 'View Bill Details',
    billDetails: 'Bill Details',
    closeDetails: 'Close Details',
    downloadAttachment: 'Download Attachment',
    noAttachment: 'No attachment',
    billInformation: 'Bill Information',
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
    draft: 'Draft',
    maintenance: 'Maintenance',
    maintenanceJournal: 'Maintenance Journal',
    inventory: 'Inventory',
    projects: 'Projects',
    complaint: 'Complaint',
    information: 'Information',
    other: 'Other',
    allStatus: 'All Status',
    createNewBill: 'Create New Bill',
    billCreationForm: 'Bill Creation Form',
    createBill: 'Create Bill',
    
    // Bills form translations
    'bills.editBill': 'Edit Bill',
    'bills.createNewBill': 'Create New Bill',
    'bills.createFromTemplate': 'Create Bill from Template',
    'bills.aiExtracted': 'AI Extracted',
    'bills.manualEntry': 'Manual Entry',
    'bills.aiExtraction': 'AI Extraction',
    'bills.uploadBillDocument': 'Upload Bill Document',
    'bills.uploadDocumentOptional': 'Upload Document (Optional)',
    'bills.autoSaving': 'Auto-saving...',
    'bills.title': 'Title',
    'bills.vendor': 'Vendor',
    'bills.vendorInvoiceNumber': 'Bill / Invoice Number',
    'bills.issueDate': 'Issue Date',
    'bills.issueDateFrom': 'Issue date from',
    'bills.issueDateTo': 'Issue date to',
    'bills.dueDate': 'Due Date',
    'bills.amount': 'Amount',
    'bills.category': 'Category',
    'bills.status': 'Status',
    'bills.paymentType': 'Payment Type *',
    'bills.totalAmount': 'Total Amount *',
    'bills.totalAmountOptional': 'Total Amount (Optional)',
    'bills.startDate': 'Start Date',
    'bills.paymentSchedule': 'Payment Schedule',
    'bills.paymentConfiguration': 'Payment Configuration',
    'bills.initialPayment': 'Initial Payment',
    'bills.equalRecurringPayments': 'Equal Recurring Payments',
    'bills.initialPaymentAmount': 'Initial Payment Amount *',
    'bills.recurringPaymentAmount': 'Recurring Payment Amount *',
    'bills.recurrenceEndDate': 'Recurrence End Date (Optional)',
    'bills.customPaymentSchedule': 'Custom Payment Schedule',
    'bills.individualPaymentAmounts': 'Individual Payment Amounts',
    'bills.addPayment': 'Add Payment',
    'bills.amount': 'Amount *',
    'bills.date': 'Date *',
    'bills.description': 'Description',
    'bills.notes': 'Notes',
    'bills.statusDraft': 'Draft',
    'bills.statusDraftNote': 'Draft bills are excluded from budget calculations',
    'bills.statusSent': 'Sent',
    'bills.statusSentPartiallyPaid': 'Sent (partially paid)',
    'bills.statusOverdue': 'Overdue',
    'bills.statusPaid': 'Paid',
    'bills.statusCancelled': 'Cancelled',
    'bills.paymentTypeOneTime': 'One-Time Bill',
    'bills.paymentTypeRecurring': 'Recurring Payment',
    'bills.scheduleWeekly': 'Weekly',
    'bills.scheduleMonthly': 'Monthly',
    'bills.scheduleQuarterly': 'Quarterly',
    'bills.scheduleYearly': 'Yearly',
    'bills.yearInterval': 'Year Interval',
    'bills.yearIntervalDescription': 'How many years between each occurrence (1-99). For example, enter 3 for bills that occur every 3 years.',
    'bills.scheduleCustom': 'Custom Schedule',
    'bills.totalAmountDescriptionOneTime': 'Complete amount for this one-time bill',
    'bills.totalAmountDescriptionRecurring': 'Leave empty to calculate from individual payment amounts',
    'bills.initialPaymentDescription': 'Is there an upfront payment different from recurring amounts?',
    'bills.equalRecurringPaymentsDescription': 'Are all recurring payment amounts the same?',
    'bills.initialPaymentAmountDescription': 'Amount for the upfront payment',
    'bills.recurringPaymentAmountDescription': 'Amount for each recurring payment',
    'bills.recurrenceEndDateDescription': 'Payment schedule will be limited to the next year. Setting an end date will stop recurring bills after this date.',
    'bills.customPaymentScheduleDescription': 'Define your custom payment schedule with specific dates and amounts.',
    'bills.individualPaymentAmountsDescription': 'Since recurring payments are not equal, specify individual amounts for each payment. Dates will be calculated based on your selected schedule.',
    'bills.deleting': 'Deleting...',
    'bills.deleteBill': 'Delete Bill',
    'bills.cancel': 'Cancel',
    'bills.processing': 'Processing...',
    'bills.updateBill': 'Update Bill',
    'bills.createBill': 'Create Bill',
    'bills.paymentCount': 'Payment Count *',
    'bills.paymentCountSingle': 'Single Payment',
    'bills.paymentCountMultiple': 'Multiple Payments',
    'bills.paymentCountDescription': 'Choose whether this is a single payment or multiple payments',
    'bills.recurrence': 'Generate bills for next year automatically',
    'bills.recurrenceDescription': 'When enabled, this bill will automatically recur for the next year',
    'bills.singlePaymentAmount': 'Payment Amount',
    'bills.singlePaymentAmountDescription': 'Enter the amount for this single payment',
    'bills.calculatedTotalAmount': 'Calculated Total Amount',
    'bills.totalAmountSingleDescription': 'Amount for single payment',
    'bills.totalAmountMultipleEqualDescription': 'Calculated from payment configuration (12 payments)',
    'bills.totalAmountMultipleCustomDescription': 'Sum of all payment amounts',
    'bills.autoCalculatedBadge': 'Auto-calculated',
    'bills.fromPaymentAmountBadge': 'From payment amount',
    'bills.billType': 'Bill Type',
    'bills.billTypeUnique': 'Unique Bill',
    'bills.billTypeRecurrent': 'Recurring Bill',
    'bills.billTypeDescription': 'Unique bills occur once. Recurring bills repeat automatically (e.g., yearly with single payment, or monthly installments)',
    'bills.paymentStructure': 'Payment Structure',
    'bills.paymentStructureSingle': 'Single Payment',
    'bills.paymentStructureInstallment': 'Installment Plan',
    'bills.paymentStructureDescription': 'Single payment = paid in one lump sum. Installment plan = split into multiple scheduled payments',
    'bills.recurrenceEndDateDescriptionSingle': 'Optional. Specify when this recurring bill should stop. Leave empty for ongoing bills. For example, a yearly bill starting in 2024 with no end date will recur every year indefinitely.',
    'bills.recurrenceEndDateDescriptionInstallment': 'Optional. Specify when this recurring bill should stop generating new payment cycles. Leave empty for ongoing bills.',
    'bills.editAutoGeneratedDescription': 'Edit this bill. Saving will convert it to a regular bill.',
    'bills.extractingData': 'Extracting data from your document...',
    'bills.extractingDataNote': 'This may take a few seconds depending on document complexity.',
    'bills.customPaymentDateRequired': 'Date is required',
    'bills.customPaymentDateRequiredSingle': 'Please enter a date for each payment. 1 payment is missing a date.',
    'bills.customPaymentDateRequiredPlural': 'Please enter a date for each payment. {count} payments are missing a date.',
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
    createDocument: 'Create New Document',
    editDocument: 'Edit Document',
    createDocumentDialogDescription: 'Create a new document for this entity',
    editDocumentDialogDescription: 'Edit document information and settings',
    documentContent: 'Document Content',
    effectiveDate: 'Effective Date',
    visibleToTenants: 'Visible to Tenants',
    uploadDate: 'Upload Date',
    uploadFile: 'Upload File',
    uploadFileOrCreateText: 'Upload a file or create a text document. Maximum file size: 25MB.',
    maxFileSize: 'Maximum file size',
    yes: 'Yes',
    no: 'No',
    documentNameRequired: 'Document name is required',
    documentNameTooLong: 'Name must be less than 255 characters',
    documentDescriptionTooLong: 'Description must be less than 1000 characters',
    missingContent: 'Missing Content',
    missingContentDescription: 'Please either upload a file or enter text content for the document.',
    documentCreatedSuccessfully: 'has been created successfully',
    documentUpdatedSuccessfully: 'Document updated successfully',
    documentDeletedSuccessfully: 'Document deleted successfully',
    failedToCreateDocument: 'Failed to create document',
    failedToUpdateDocument: 'Failed to update document',
    failedToDeleteDocument: 'Failed to delete document',
    creatingDocument: 'Creating...',
    updatingDocument: 'Updating...',
    deletingDocument: 'Deleting...',
    documentVisibility: 'Share with Tenants',
    documentVisibilityDescription: 'When enabled, tenants can view and download this document from their portal',
    managerOnly: 'Manager only',
    managerOnlyDescription: 'When enabled, only managers assigned to this building (and administrators) can view this document. Residents and tenants will not see it, even if it belongs to their residence or building.',
    showManagerOnlyDocuments: 'Show only manager-only documents',
    showOnlyLinkedDocuments: 'Show only documents that are part of a sequence',
    partOfSequence: 'Part of a sequence',
    linkedPrevious: 'Previous',
    linkedNext: 'Next',
    confirmDeleteDocument: 'Are you sure you want to delete this document? This action cannot be undone.',
    documentDetails: 'Document Details',
    documentDetailsDescription: 'View and manage document information',
    loadingDocument: 'Loading document...',
    documentAttachment: 'Document Attachment',
    previewNotAvailable: 'Preview not available',
    previewNotAvailableDescription: 'This file type cannot be previewed in the browser. Download the file to open it in a compatible application.',
    backToResidences: 'Back to Residences',
    backToBuildings: 'Back to Buildings',
    backToMyResidence: 'Back to My Residence',
    documents: 'Documents',
    documentsAvailableToTenants: 'Documents available to tenants',
    allResidenceDocuments: 'All residence documents',
    categoryBylaws: 'Bylaws',
    categoryFinancial: 'Financial',
    categoryMaintenance: 'Maintenance',
    categoryLegal: 'Legal',
    categoryMeetingMinutes: 'Meeting Minutes',
    categoryInsurance: 'Insurance',
    categoryContracts: 'Contracts',
    categoryPermits: 'Permits',
    categoryInspection: 'Inspection',
    categoryOther: 'Other',
    bylawsDocuments: 'Bylaws',
    financialDocuments: 'Financial Documents',
    maintenanceRecords: 'Maintenance Records',
    legalDocuments: 'Legal Documents',
    meetingMinutesDocuments: 'Meeting Minutes',
    insuranceDocuments: 'Insurance Documents',
    contractsDocuments: 'Contracts',
    permitsDocuments: 'Permits',
    inspectionReports: 'Inspection Reports',
    otherDocuments: 'Other Documents',
    loadingDemands2: 'Loading demands...',
    noDemandsFound: 'No demands found',
    noDocumentsFound: 'No documents found',
    noDocumentsMatchFilters: 'No documents match your current filters. Try adjusting your search or filters.',
    documentsDeleted: 'Documents deleted',
    successfullyDeleted: 'Successfully deleted',
    failedToDelete: 'Failed to delete',
    failedToDeleteDocumentsCount: 'Failed to delete {count} document(s). Please try again.',
    deselectAll: 'Deselect all',
    buildingIdRequired: 'Building ID is required to view documents',
    residenceIdRequired: 'Residence ID is required to view documents',
    residenceNotFound: 'Residence Not Found',
    residenceIdDoesNotExist: 'The residence ID "{entityId}" does not exist in the database.',
    productionDatabaseIdWarning: 'Note: This may be a production database ID that doesn\'t exist in the development environment.',
    goToTestResidence: 'Go to Test Residence',
    viewAndActions: 'View & Actions',
    tags: 'Tags',
    filterByTags: 'Filter by tags',
    documentFound: 'document found',
    documentsFound: 'documents found',
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
    allResidences: 'All residences',
    creator: 'Creator',
    allCreators: 'All creators',
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
    demoModeTitle: 'Demo Mode - View Only',
    demoModeMessage: 'This is a demonstration account with view-only access. You can explore all features but cannot make changes to the data.',
    demoModeSuggestion: 'To create, edit, or delete content, please contact us for a full account.',
    demoModeContact: 'Contact our team to get started with your own property management workspace.',
    demoFileUploadRestricted: 'File uploads are not available in demonstration mode. You can view existing documents but cannot upload new ones.',
    demoBulkOperationRestricted: 'Bulk operations are not available in demonstration mode to protect the integrity of demo data.',
    demoExportRestricted: 'Data export is not available in demonstration mode. This feature is available in full accounts.',
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
    buildingsManagementSubtitle: 'Manage building information, property assets, and organization structures.',
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
    commonSpacesCount: 'common spaces',
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
    residencesManagementSubtitle: 'Manage residence information, units, property details, and tenant assignments across your properties.',
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
    budgetManagement: 'Budget Management',
    budgetManagementSubtitle: 'Plan and track financial budgets for property management with comprehensive forecasting and analysis.',
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
    construction: 'Construction',
    consulting: 'Consulting',
    equipmentRental: 'Equipment Rental',
    legalServices: 'Legal Services',
    technology: 'Technology',
    reserves: 'Reserves',
    billsManagement: 'Bills Management',
    billsSubtitle: 'Manage property bills, invoices, and financial documents with comprehensive tracking and organization.',
    invoiceManagement: 'Invoice Management',
    invoiceManagementSubtitle: 'Modern AI-powered invoice processing and management',
    filters: 'Filters',
    financialYearStarts: 'Financial year starts:',
    year: 'Financial Year',
    months: 'Months',
    allMonths: 'All months',
    allYears: 'All years',
    allCategories: 'All Categories',
    loadingBuildings: 'Loading buildings...',
    failedToLoadBuildings: 'Failed to load buildings',
    retry: 'Retry',
    createFirstBill: 'Create First Bill',
    noBillsFound: 'No Bills Found',
    noBillsFoundMessage: 'No bills found for the selected filters. Create your first bill to get started.',
    loadingBills: 'Loading bills...',
    searchBills: 'Search bills...',
    aiAnalyzedLabel: 'AI Analyzed',
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
    createDemand: 'Create Demand',
    typeLabel: 'Type',
    buildingLabel: 'Building',
    descriptionLabel: 'Description',
    residenceOptional: 'Residence (Optional)',
    noSpecificResidence: 'No specific residence',
    searchResidencesPlaceholder: 'Search residences...',
    attachmentsOptional: 'Attachments (Optional)',
    attachmentUploadInstructions: 'Upload photos, documents, or screenshots. Camera supported for mobile. Max 10MB per file.',
    submitRequestComplaint: 'Submit a new request or complaint',
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
    failedToCreateDemand: 'Failed to create demand',
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
    filtered: 'Filtered',
    onThisPage: 'On this page',
    confirmEmail: 'Confirm Email',
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
    noItemsFound: 'No Items Found',
    noItemsMessage: 'No items are currently available to select.',
    noBookingsFound: 'No bookings found for this space in the last 12 months.',
    noBookingsFoundMessage: 'No bookings found for this space in the last 12 months.',
    selectCommonSpace: 'Select a Common Space',
    selectCommonSpaceMessage: 'Choose a building and common space to view usage statistics.',
    noComplianceData: 'No Compliance Data Available',
    noComplianceDataMessage: 'Run the compliance scan to view Law 25 compliance status.',
    noCertificateFound: 'No Certificate Found',
    noCertificateFoundMessage: 'No SSL certificate found for this domain.',
    // Hierarchical selection messages
    buildingWithResidences: 'building with residences',
    buildingsWithResidences: 'buildings with residences',
    // Invitation management (moved to prevent duplicates)
    managePendingInvitations: 'Manage Pending Invitations',
    loadingInvitations: 'Loading invitations...',
    deleteInvitation: 'Delete Invitation',
    deleteInvitationConfirm: 'Are you sure you want to delete this invitation?',
    invitationDeletedSuccess: 'Invitation deleted successfully',
    invitationDeletedError: 'Failed to delete invitation',
    viewInvitationHistory: 'View history',
    invitationHistory: 'Invitation history',
    invitationHistoryDescription: 'Lifecycle events for {email}',
    invitationHistoryEmpty: 'No history yet for this invitation.',
    invitationHistoryLoadError: 'Failed to load invitation history',
    invitationHistoryAction: 'Action',
    invitationHistoryPerformedBy: 'Performed by',
    invitationHistoryWhen: 'When',
    invitationHistoryStatusChange: 'Status change',
    invitationHistorySource: 'Source',
    invitationHistorySystem: 'System',
    invitationHistoryShowDetails: 'Show details',
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
    bugReportsSubtitle: 'Report and track application issues',
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
    ideaBoxSubtitle: 'Share your ideas to improve our platform',
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
    privacyPolicyIntro: 'Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.',
    lastUpdated: 'Last updated:',
    informationCollection: '1. Information Collection',
    informationCollectionDesc: 'We collect the following personal information as part of our services:',
    informationUse: '2. Use of Information',
    informationUseDesc: 'Your personal information is used exclusively for:',
    informationSharing: '3. Sharing and Disclosure',
    privacyRights: '4. Your Rights',
    dataSecurity: '5. Data Security',
    contactPrivacy: '6. Contact Us',
    privacyInfoItem1: 'Identification information (name, email address, phone number)',
    privacyInfoItem2: 'Professional information (organization, role, business address)',
    privacyInfoItem3: 'Platform login and usage data',
    privacyInfoItem4: 'Communications and correspondence with our customer service',
    privacyInfoItem5: 'Payment information (processed by secure third parties)',
    privacyUseItem1: 'Providing and improving our property management services',
    privacyUseItem2: 'Creating and managing your user account',
    privacyUseItem3: 'Communicating with you about your account and our services',
    privacyUseItem4: 'Ensuring the security and integrity of our platform',
    privacyUseItem5: 'Complying with our legal and regulatory obligations',
    privacySharingIntro: 'We do not sell, rent, or share your personal information, except in the following cases:',
    privacySharingItem1: 'With your explicit consent',
    privacySharingItem2: 'With our trusted third-party service providers (hosting, payment)',
    privacySharingItem3: 'When required by law or by a competent authority',
    privacySharingItem4: 'To protect our rights, safety, or that of our users',
    privacySecurityIntro: 'We implement appropriate technical, physical, and administrative security measures:',
    privacySecurityItem1: 'Encryption of data in transit and at rest (AES-256)',
    privacySecurityItem2: 'Strict access controls and two-factor authentication',
    privacySecurityItem3: 'Continuous monitoring and regular security audits',
    privacySecurityItem4: 'Staff training on data protection',
    privacySecurityItem5: 'Secure backup and recovery plans',
    privacyRightsIntro: 'In accordance with Law 25, you have the right to:',
    privacyRightsItem1: 'Access your personal information',
    privacyRightsItem2: 'Request correction of your data',
    privacyRightsItem3: 'Request deletion of your information',
    privacyRightsItem4: 'Withdraw your consent at any time',
    privacyRightsItem5: 'File a complaint with the Commission d\'accès à l\'information',
    privacyContactIntro: 'For any questions regarding this privacy policy or to exercise your rights, contact us:',
    privacyContactEmail: 'Email:',
    privacyContactEmailLabel: 'privacy@koveo-gestion.com',
    privacyContactOfficer: 'Personal Information Protection Officer',
    backToHome: 'Back to home',
    loginButton: 'Sign in',
    securityTitle: 'Security and Compliance',
    securityIntro: 'The security of your data is our absolute priority. Discover how we protect your information with enterprise-grade security measures and Quebec Law 25 compliance.',
    enterpriseEncryption: 'Enterprise-grade encryption',
    enterpriseEncryptionDesc: 'All data is encrypted in transit and at rest with industry-standard AES-256 encryption.',
    roleBasedAccess: 'Role-based access control',
    roleBasedAccessDesc: 'Granular authorization system ensuring each user only accesses necessary information.',
    quebecDataProtection: 'Quebec data protection',
    secureInfrastructure: 'Secure infrastructure',
    secureInfrastructureDesc: 'Redundant cloud architecture with 24/7 monitoring and automated backups.',
    securityEnterpriseSectionTitle: 'Enterprise-level security',
    securityEnterpriseSectionDesc: 'Our platform integrates the highest security measures to protect your data and guarantee the confidentiality of your property information.',
    securityComplianceSectionTitle: 'Compliance and Standards',
    securityComplianceSectionDesc: 'Koveo Gestion follows the strictest regulations to ensure the protection of your data and legal compliance.',
    securityDetailsSectionTitle: 'Detailed security measures',
    securityDetailsSectionDesc: 'Discover in detail how we protect your data.',
    securityBadgeMilitaryGrade: 'Enterprise Security',
    securityBadgeControlledAccess: 'Controlled access',
    securityBadgeLaw25: 'Law 25',
    securityBadgeHighAvailability: 'High availability',
    securityFeatureAes256: 'AES-256 encryption for all data',
    securityFeatureHttpsTls: 'Mandatory HTTPS/TLS 1.3 connections',
    securityFeatureSeparateKeys: 'Separately managed encryption keys',
    securityFeatureKeyRotation: 'Automatic security key rotation',
    securityFeatureDefinedRoles: 'Defined roles: administrator, manager, resident',
    securityFeatureGranularPermissions: 'Granular permissions per feature',
    securityFeatureCompleteAudit: 'Complete audit of access and actions',
    securityFeatureSecureSessions: 'Secure sessions with automatic expiration',
    securityFeatureCanadaHosted: 'Data hosted exclusively in Canada',
    securityFeatureLaw25Compliance: 'Law 25 compliance - Personal information protection',
    securityFeatureInformedConsent: 'Informed consent and preference management',
    securityFeatureRightToForget: 'Right to be forgotten and data portability',
    securityFeatureMultiDataCenter: 'Multi-data center redundancy',
    securityFeature247Monitoring: '24/7/365 security monitoring',
    securityFeatureEncryptedBackups: 'Automated encrypted backups',
    securityFeatureDisasterRecovery: 'Tested disaster recovery plan',
    securityComplianceLaw25Title: 'Quebec Law 25',
    securityComplianceLaw25Desc: 'Full compliance with personal information protection requirements',
    securityComplianceIndustryTitle: 'Industry standards',
    securityComplianceIndustryDesc: 'Adherence to IT security best practices',
    securityComplianceEncryptionTitle: 'Advanced encryption',
    securityComplianceEncryptionDesc: 'Implementation of the latest encryption standards',
    securityStatusCertified: 'Compliant',
    securityStatusCompliant: 'Compliant',
    securityStatusActive: 'Active',
    securityDataProtectionTitle: 'Data protection',
    securityDataProtectionAes256: 'AES-256 encryption for all sensitive data',
    securityDataProtectionPasswordHash: 'Secure password hashing with unique salt',
    securityDataProtectionAnonymization: 'Data anonymization for analytics',
    securitySurveillanceTitle: 'Monitoring and audit',
    securitySurveillanceLogging: 'Complete logging of all access',
    securitySurveillanceDetection: 'Automatic detection of suspicious activities',
    securitySurveillanceAudits: 'Regular third-party security audits',
    securityCtaTitle: 'Ready to secure your property management?',
    securityCtaDescription: 'Join property owners who trust Koveo Gestion for the security of their data.',
    securityCtaStartTrial: 'Start free trial',
    securityCtaViewPrivacy: 'View privacy policy',
    securityCtaAccessDashboard: 'Access dashboard',
    securityNavBackHome: 'Back to home',
    securityNavPrivacyPolicy: 'Privacy policy',
    securityNavOurStory: 'Our story',
    ourStoryTitle: 'Our Story',
    storyIntro: 'Discover the story behind Koveo Gestion and our mission to modernize property management in Quebec.',
    foundationYear: '2025',
    foundationTitle: 'Foundation of Koveo Gestion',
    foundationDesc: 'Company creation with the mission to modernize property management in Quebec.',
    developmentYear: '2025',
    developmentTitle: 'Platform Development',
    developmentDesc: 'Design and development of our comprehensive solution in compliance with Quebec Law 25.',
    launchYear: '2026',
    launchTitle: 'Official Launch',
    launchDesc: 'Launch of our platform with complete bilingual support and Quebec compliance.',
    storyMissionTitle: 'Our Mission',
    storyMissionDesc: 'Simplify and modernize property management in Quebec by offering advanced, secure technological tools that comply with local regulations.',
    storyVisionTitle: 'Vision',
    storyVisionDesc: 'Become the reference platform for modern property management in Quebec.',
    storyValuesTitle: 'Values',
    storyValuesDesc: 'Transparency, responsible innovation and commitment to the Quebec community.',
    storyEngagementTitle: 'Commitment',
    storyEngagementDesc: 'Protecting your data with full compliance with Quebec Law 25.',
    storyJourneyTitle: 'Our Journey',
    storyJourneySubtitle: 'From the initial idea to today\'s complete platform, discover the key stages of our development.',
    storyOurValuesTitle: 'Our Values',
    storyOurValuesSubtitle: 'The principles that guide every decision and orient our development.',
    storyValueComplianceTitle: 'Compliance and Transparency',
    storyValueComplianceDesc: 'We are committed to respecting all Quebec regulations and maintaining transparency in our practices.',
    storyValueServiceTitle: 'Customer Service',
    storyValueServiceDesc: 'User experience and customer satisfaction are at the heart of everything we do.',
    storyValueInnovationTitle: 'Responsible Innovation',
    storyValueInnovationDesc: 'We innovate thoughtfully, focusing on practical solutions that bring real value.',
    storyValueCommunityTitle: 'Quebec Community',
    storyValueCommunityDesc: 'We are committed to the Quebec property management community and understand their unique challenges.',
    storyTeamTitle: 'Our Team',
    storyTeamSubtitle: 'Experts passionate about improving property management in Quebec.',
    storyTeamExpertise: 'Quebec Expertise',
    storyTeamExpertiseDesc: 'Our team combines cutting-edge technical expertise with in-depth knowledge of the Quebec real estate market.',
    storyTeamHighlight1: 'Team of Quebec property management experts',
    storyTeamHighlight2: 'Regulatory compliance specialists',
    storyTeamHighlight3: 'Data security expert developers',
    storyTeamHighlight4: 'Bilingual customer support (French/English)',
    storyDocumentationTitle: 'Complete Documentation',
    storyDocumentationDesc: 'Consult our detailed documentation on the history and mission of Koveo Gestion.',
    storyViewDocumentation: 'View documentation',
    storyAvailableDocuments: 'Available Documents',
    storyDownload: 'Download',
    storyCtaTitle: 'Join Our Vision',
    storyCtaDesc: 'Discover how Koveo Gestion can transform your approach to property management.',
    storyFreeTrial: 'Free Trial',
    storyDiscoverFeatures: 'Discover our features',
    storyAccessDashboard: 'Access dashboard',
    storyBackHome: 'Back to home',
    storyPrivacyPolicy: 'Privacy Policy',
    storySecurity: 'Security',
    overview: 'Overview',
    quickActions: 'Quick Actions',
    financialOverview: 'Financial Overview',
    buildingFinancialOverview: 'Building Financial Overview',
    budgetTrendAnalysis: 'Budget Trend Analysis',
    budgetTrendAnalysisMonthly: 'Budget Trend Analysis - Monthly View',
    projectManagement: 'Project Management',
    projectManagementDesc: 'Manage projects for current financial year and future periods',
    projectsAffectingBudget: 'Projects affecting budget calculations',
    fiscalYearFilter: 'Fiscal Year Filter',
    fiscalYearFilters: 'Fiscal Year Filters',
    loadNext25Years: 'Load next 25 years',
    pastFiscalYears: 'Past Fiscal Years',
    startingFiscalYear: 'Starting Fiscal Year',
    chartYearPickerHelp: "The chart starts at the building's bank account start date (or January 1 of the current year if none is set). The earliest selectable year is {year}.",
    currentFiscalYear: 'Current Fiscal Year',
    futureProjections: 'Future Projections',
    monthlyView: 'Monthly View',
    yearlyView: 'Yearly View',
    noBuildingsAssigned: 'No buildings assigned',
    displaying: 'Displaying',
    monthly: 'Monthly',
    yearly: 'Yearly',
    manageProjectsForCurrentYear: 'Manage projects for current financial year and future periods',
    listView: 'List view',
    ganttView: 'Gantt view',
    noDatesSet: 'No dates set',
    includeInBudget: 'Include in budget',
    excludeFromBudget: 'Exclude from budget',
    statusSubmission: 'Submission',
    statusPreWork: 'Pre work',
    statusPostWork: 'Post work',
    loadingProjects: 'Loading projects...',
    quickProject: 'Quick Project',
    actual: 'Actual',
    cost: 'Cost',
    include: 'Include',
    noProjectsFound: 'No projects found for current financial year and future periods',
    minimumRequirement: 'Minimum Requirement',
    investments: 'Investments',
    ofWhich: 'of which',
    calendar: 'Calendar',
    myResidence: 'My Residence',
    myBuilding: 'My Building',
    commonSpaces: 'Common Spaces',
    budget: 'Budget',
    bills: 'Bills',
    demands: 'Demands',
    navUserManagement: 'User Management',
    documentTags: 'Document Tags',
    manageCommonSpaces: 'Manage Common Spaces',
    documentation: 'Documentation',
    pillars: 'Pillars',
    roadmap: 'Roadmap',
    navQualityAssurance: 'Quality Assurance',
    navLaw25Compliance: 'Law 25 Compliance',
    rbacPermissions: 'RBAC Permissions',
    modernPropertyManagement: 'Modern Property Management',
    comprehensivePropertyManagement: 'Comprehensive property management solution designed specifically for Quebec residential communities',
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
    
    // Trial Request Form
    trialRequestTitle: 'Free Trial Request',
    trialRequestDescription: 'Discover Koveo Gestion with a free 30-day trial. Fill out the form below and our team will contact you quickly.',
    personalInformation: 'Personal Information',
    companyInformation: 'Company Information',
    propertyInformation: 'Property Information',
    additionalInformation: 'Additional Information',
    company: 'Company Name',
    city: 'City',
    province: 'Province',
    postalCode: 'Postal Code',
    numberOfBuildings: 'Number of Buildings',
    numberOfResidences: 'Total Number of Residences',
    message: 'Message',
    submitRequest: 'Submit Request',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Quebec Law 25 Compliant',
    pricing: 'Pricing',
    simplePricing: 'Simple and Transparent Pricing',
    pricingSubtitle: 'Professional property management that scales with your business',
    professionalPlan: 'Professional Plan',
    perfectForPropertyManagers: 'Perfect for all your management needs',
    perDoorPerMonth: 'per door per month',
    noSetupFees: 'No setup fees',
    condoManagementPlan: 'Condo Management Services',
    condoManagementDescription: 'Complete condo management solution',
    rentalManagementPlan: 'Rental Management Services',
    rentalManagementDescription: 'Full-service rental property management',
    applicationIncluded: 'Application included',
    pricingSubjectToChange: 'Pricing subject to change at any time',
    basedOnClientNeeds: 'based on client needs',
    plusExpenses: '+ expenses',
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
    unlimitedUsersDisclaimer: '*Koveo reserves the right to limit the number of users in case of abuse.',
    largeClientTitle: 'Managing 25+ Doors?',
    largeClientDescription: 'We offer special pricing for larger properties. Contact us to discuss a customized rate based on your portfolio size.',
    largeClientBenefit: 'Volume pricing available - lower rates than our standard pricing',
    largeClientCta: 'Contact Us for a Quote',
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
    whatsIncluded: 'What\'s included:',
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
    searchTypePlaceholder: 'Search type...',
    showingDemandsRange: 'Showing {start} to {end} of {total} demands',
    buildingField: 'Building:',
    residenceField: 'Residence:',
    createdField: 'Created:',
    unknownBuilding: 'Unknown',
    loadingDemandsMessage: 'Loading demands...',
    manageBuildingsOrganization: 'Manage {count} buildings in your organization',
    searchBuildingsAddress: 'Search buildings by name or address...',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    save: 'Save',
    close: 'Close',
    edit: 'Edit',
    delete: 'Delete',
    
    selectBuildingInventoryMessage: 'Please select an organization and building to view its maintenance inventory.',
    inventoryManagementSubtitle: 'Manage building elements, maintenance records, and asset documentation across your property portfolio.',
    backToBuilding: 'Back to',
    buildingElements: 'Building Elements',
    toggleBuildingElementsTable: 'Toggle building elements table',
    searchElementsPlaceholder: 'Search elements by name, UNIFORMAT code, or description...',
    overdueEvaluations: 'Overdue Evaluations',
    addElement: 'Add Element',
    allConditions: 'All Conditions',
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    uniformatCategory: 'UNIFORMAT Category',
    uniformatSubstructure: 'A - Substructure',
    uniformatShell: 'B - Shell',
    uniformatInteriors: 'C - Interiors',
    uniformatServices: 'D - Services',
    uniformatEquipmentFurnishings: 'E - Equipment & Furnishings',
    uniformatSpecialConstruction: 'F - Special Construction',
    uniformatBuildingSitework: 'G - Building Sitework',
    elementDocuments: 'Element Documents',
    uniformatBrowser: 'UNIFORMAT Browser',
    featureComingSoon: 'Feature Coming Soon',
    evaluationSchedulingComingSoon: 'Evaluation scheduling will be available in a future update.',
    elementImportComingSoon: 'Element import functionality will be available in a future update.',
    reportExportComingSoon: 'Report export functionality will be available in a future update.',
    elementDeleted: 'Element Deleted',
    elementDeletedSuccessfully: 'has been successfully deleted from the inventory.',
    
    selectBuildingProjectsMessage: 'Please select an organization and building to view its maintenance projects.',
    projectsMaintenanceManagement: 'Projects - Maintenance Management',
    projectsManagementSubtitle: 'Manage maintenance projects, track progress, and coordinate work schedules',
    toggleProjectOverview: 'Toggle project overview',
    projectsSelected: 'project(s) selected',
    newProject: 'New Project',
    toggleProjectsTable: 'Toggle projects table',
    projectTable: 'Project Table',
    projectStatus: 'Project Status',
    projectTimeline: 'Project Timeline',
    projectElements: 'Project Elements',
    projectNotes: 'Project Notes',
    projectBudget: 'Project Budget',
    projectCreated: 'Project Created',
    projectUpdated: 'Project Updated',
    projectUpdateFailed: 'Failed to update project',
    projectDeleted: 'Project Deleted',
    projectDeleteFailed: 'Failed to delete project',
    editProject: 'Edit Project',
    editProjectDescription: 'Modify the project details below.',
    confirmDeleteProject: 'Are you sure you want to delete this project?',
    fillRequiredFields: 'Please fill in all required fields.',
    projectCreatedSuccessfully: 'has been created successfully.',
    projectUpdatedSuccessfully: 'has been updated successfully.',
    projectsCreated: 'Projects Created',
    projectsCreatedFromSuggestions: 'project(s) have been created from evaluation suggestions.',
    projectCreatedSuccessfully2: 'Project Created Successfully',
    autoProjectConvertedSuccess: 'has been converted to a maintenance project.',
    statusUpdated: 'Status Updated',
    projectStatusUpdatedSuccessfully: 'Project status has been updated successfully.',
    
    // Demand details translations
    demandDetails: 'Demand Details',
    escalateToManager: 'Escalate to Manager',
    fileAttachment: 'File Attachment',
    view: 'View',
    download: 'Download',
    location: 'Location',
    reviewNotes: 'Review Notes',
    addReviewNotes: 'Add review notes...',
    updated: 'Updated:',
    comments: 'Comments',
    addAComment: 'Add a comment...',
    addComment: 'Add Comment',
    adding: 'Adding...',
    noCommentsYet: 'No comments yet',
    commentsDisabledFor: 'Comments are disabled for {status} demands.',
    deleteDemand: 'Delete',
    confirmDeleteDemand: 'Are you sure you want to delete this demand?',
    demandUpdatedSuccessfully: 'Demand updated successfully',
    failedToUpdateDemand: 'Failed to update demand',
    demandDeletedSuccessfully: 'Demand deleted successfully',
    failedToDeleteDemand: 'Failed to delete demand',
    commentAddedSuccessfully: 'Comment added successfully',
    failedToAddComment: 'Failed to add comment',
    underReviewStatus: 'Under Review',
    approvedStatus: 'Approved',
    rejectedStatus: 'Rejected',
    inProgressStatus: 'In Progress',
    completedStatus: 'Completed',
    cancelledStatus: 'Cancelled',
    submittedStatus: 'Submitted',
    viewRelatedDocuments: 'View Related Documents',
    descriptionMinLengthError: 'Description must be at least 10 characters long (example: Faucet in kitchen sink is leaking and needs repair)',
    descriptionMaxLengthError: 'Description must be less than 2000 characters',
    reviewNotesMaxLengthError: 'Review notes must be less than 1000 characters',
    commentMinLengthError: 'Comment text is required (minimum 1 character)',
    commentMaxLengthError: 'Comment must be less than 1000 characters',
    
    // Additional Bug Reports translation keys
    bugReportCreatedSuccessfully: 'Bug report created successfully',
    bugReportUpdatedSuccessfully: 'Bug report updated successfully',
    bugReportDeletedSuccessfully: 'Bug report deleted successfully',
    failedToCreateBugReport: 'Failed to create bug report',
    failedToUpdateBugReport: 'Failed to update bug report',
    failedToDeleteBugReport: 'Failed to delete bug report',
    titleRequired: 'Title is required',
    descriptionMinLength20: 'Description must be at least 20 characters',
    pageLocationRequired: 'Page/location is required',
    noBugsMatchFilters: 'No bugs match your current filters.',
    noBugReportsYet: 'No bug reports have been submitted yet.',
    editBugReport: 'Edit Bug Report',
    bugReportDetails: 'Bug Report Details',
    areYouSureDeleteBugReport: 'Are you sure you want to delete this bug report?',
    savingChanges: 'Saving...',
    fileAttached: 'File Attached',
    searchAndFilters: 'Search and Filters',
    categoryAndSort: 'Category and Sort',
    
    // Additional Idea Box translation keys
    mostUpvotes: 'Most Upvotes',
    whyIsThisNeeded: 'Why is this needed?',
    chooseDocumentType: 'Choose Document Type',
    textDocument: 'Text Document',
    selectFileToUpload: 'Select file to upload',
    attachScreenshot: 'Attach a screenshot, mockup, or document',
    addDetailedNotes: 'Add detailed notes, specifications, or any additional information...',
    thisWillShowAsAdditionalNotes: 'This will show as additional notes with your idea',
    submitIdea: 'Submit Idea',
    editIdea: 'Edit Idea',
    internalNotesVisibleAdmins: 'Internal Notes (visible to admins only)',
    currentAttachment: 'Current Attachment',
    uploadNewFileToReplace: 'Upload a new file to replace the current attachment',
    updateIdea: 'Update Idea',
    deleteIdea: 'Delete Idea',
    attachment: 'Attachment',
    attachments: 'Attachments',
    submittedOn: 'Submitted on',
    lastUpdatedOn: 'Last updated on',
    featureTitlePlaceholder: 'e.g. Add bulk export for documents',
    featureDescriptionPlaceholder: 'Describe your feature idea in detail...',
    whyIsThisNeededPlaceholder: 'Explain the specific need this feature addresses...',
    pageLocationPlaceholder: 'e.g. Document Management',
    adminNotes: 'Admin Notes',
    search: 'Search',
    noIdeasFound: 'No ideas found',
    tryAdjustingSearchOrFilters: 'Try adjusting your search or filters.',
    getStartedBySubmittingFirstIdea: 'Get started by submitting your first idea.',
    confirmDeleteIdea: 'Are you sure you want to delete "{title}"? This action cannot be undone.',
    ideaSubmittedSuccessfully: 'Idea submitted successfully',
    ideaUpdatedSuccessfully: 'Idea updated successfully',
    ideaDeletedSuccessfully: 'Idea deleted successfully',
    failedToSubmitIdea: 'Failed to submit idea',
    failedToUpdateIdea: 'Failed to update idea',
    failedToDeleteIdea: 'Failed to delete idea',
    upvoteRecorded: 'Your upvote has been recorded',
    failedToUpvote: 'Failed to upvote',
    featureTitleRequired: 'Feature title is required',
    titleMaxLength200: 'Title must be less than 200 characters',
    descriptionMinLength10: 'Description must be at least 10 characters',
    descriptionMaxLength2000: 'Description must be less than 2000 characters',
    needMinLength5: 'Need explanation must be at least 5 characters',
    needMaxLength500: 'Need explanation must be less than 500 characters',
    pageLocationMaxLength100: 'Page location must be less than 100 characters',
    adminNotesMaxLength1000: 'Admin notes must be less than 1000 characters',
    
    // Common Filter Component translations
    filter: 'Filter',
    addFilter: 'Add Filter',
    selectField: 'Select field',
    searchFields: 'Search fields...',
    selectOperator: 'Select operator',
    searchOperators: 'Search operators...',
    selectValue: 'Select value',
    searchValues: 'Search values...',
    enterValue: 'Enter value',
    applyFilter: 'Apply Filter',
    sort: 'Sort',
    clearSort: 'Clear Sort',
    quickFilters: 'Quick filters',
    searchPresets: 'Search presets...',
    clearAll: 'Clear All',
    results: 'results',
    searchPlaceholder: 'Search...',
    
    // Bills Payment Schedule translations
    markPaid: 'Mark Paid',
    noPaymentInformation: 'No payment information',
    paidLabel: 'Paid',
    
    // Bill Category translations
    categoryAdministration: 'Administration',
    categoryCleaning: 'Cleaning',
    categoryConstruction: 'Construction',
    categoryConsulting: 'Consulting',
    categoryEquipmentRental: 'Equipment Rental',
    categoryLandscaping: 'Landscaping',
    categoryLegalServices: 'Legal Services',
    categoryProfessionalServices: 'Professional Services',
    categoryRepairs: 'Repairs',
    categoryReserves: 'Reserves',
    categorySalary: 'Salary',
    categorySecurity: 'Security',
    categorySupplies: 'Supplies',
    categoryTaxes: 'Taxes',
    categoryTechnology: 'Technology',
    categoryUtilities: 'Utilities',
    
    // Bill Document Management translations
    attachedDocuments: 'Attached Documents',
    noDocumentsAttached: 'No documents attached',
    clickAddDocumentToStart: 'Click "Add Document" to get started',
    documentDeleteFailed: 'Failed to delete document',
    confirmDeleteDocumentMessage: 'Are you sure you want to delete this document? This action cannot be undone.',

    // Budget Page translations
    budgetFilters: 'Budget Filters',
    budgetTrendAnalysisCard: 'Budget Trend Analysis',
    budgetProjectManagement: 'Project Management',
    budgetBankAccountConfig: 'Bank Account Configuration',
    budgetMinimumRequirementCard: 'Minimum Requirement',
    budgetCustomBankAccountFields: 'Custom Bank Account Fields',
    budgetFieldName: 'Field Name',
    budgetFieldValue: 'Field Value',
    budgetRevenueConfig: 'Revenue Configuration',
    budgetBillsConfig: 'Bills Configuration',
    budgetCapitalInvestmentScenarios: 'Capital Investment Scenarios',
    budgetBackToBuilding: 'Back to Building',
    budgetAddInvestment: 'Add Investment',
    budgetEditInvestment: 'Edit Investment',
    budgetSaveChanges: 'Save Changes',
    budgetAddQuickProject: 'Add Quick Project',
    budgetAddProject: 'Add Project',
    budgetRefresh: 'Refresh',
    budgetAddCustomRevenueLine: 'Add custom revenue line',
    budgetRemoveRevenueLine: 'Remove',
    budgetRemoveInvestment: 'Remove',
    budgetConfirmInvestment: 'Confirm',
    budgetStartingBalance: 'Starting Balance',
    budgetBalanceDate: 'Balance Date',
    budgetFinancialYearStart: 'Financial Year Start',
    budgetMinimumRequirementAmount: 'Minimum Requirement',
    budgetRevenueGrowthRate: 'Revenue Growth Rate (%)',
    budgetMonthlyAmount: 'Monthly Amount ($)',
    budgetInflationRate: 'Inflation Rate',
    budgetGlobalInflation: 'Global',
    budgetPerCategoryInflation: 'Per-Category',
    budgetUnplannedBills: 'Unplanned Bills',
    budgetInvestmentTitle: 'Title',
    budgetInvestmentDescription: 'Description',
    budgetInvestmentAmount: 'Amount ($)',
    budgetTargetDate: 'Target Date',
    budgetUrgencyLevel: 'Urgency Level',
    budgetProjectTitle: 'Project Title',
    budgetProjectBudget: 'Total Budget',
    budgetProjectFinancialYear: 'Financial Year',
    budgetProjectDescription: 'Description',
    budgetEnterAmount: 'Enter amount',
    budgetEnterTitle: 'Enter title',
    budgetEnterDescription: 'Enter description',
    budgetOptionalDetails: 'Optional details about the investment',
    budgetEnterProjectTitle: 'Enter project title',
    budgetOptionalProjectDescription: 'Optional project description',
    budgetBankAccountSaveSuccess: 'Success',
    budgetBankAccountSaveSuccessDesc: 'Bank account settings saved successfully',
    budgetBankAccountSaveFailed: 'Error',
    budgetBankAccountSaveFailedDesc: 'Failed to save bank account settings',
    budgetRevenueSaveSuccess: 'Success',
    budgetRevenueSaveSuccessDesc: 'Revenue configuration saved successfully',
    budgetRevenueSaveFailed: 'Error',
    budgetRevenueSaveFailedDesc: 'Failed to save revenue configuration',
    budgetBillsSaveSuccess: 'Success',
    budgetBillsSaveSuccessDesc: 'Unplanned bills amount saved successfully',
    budgetBillsSaveFailed: 'Error',
    budgetBillsSaveFailedDesc: 'Failed to save unplanned bills amount',
    budgetInvestmentsSaveSuccess: 'Success',
    budgetInvestmentsSaveSuccessDesc: 'Capital investments saved successfully',
    budgetInvestmentsSaveFailed: 'Failed to save capital investments',
    budgetRefreshSuccess: 'Refresh Complete',
    budgetRefreshSuccessDesc: 'Budget data has been refreshed with the latest information.',
    budgetRefreshFailed: 'Refresh Error',
    budgetRefreshFailedDesc: 'Failed to refresh budget data. Please try again.',
    budgetInvestmentAdded: 'Investment Added',
    budgetInvestmentAddedDesc: '{title} has been added to the investment plan.',
    budgetInvestmentRemoved: 'Investment Removed',
    budgetInvestmentRemovedDesc: 'The investment has been removed from the plan.',
    budgetInvestmentUpdated: 'Investment Updated',
    budgetInvestmentUpdatedDesc: 'The investment has been updated successfully.',
    budgetInvestmentConfirmed: 'Investment Confirmed',
    budgetInvestmentConfirmedDesc: 'The investment has been confirmed and added to your permanent plan.',
    budgetQuickProjectAdded: 'Quick Project Added',
    budgetQuickProjectAddedDesc: '"{title}" has been added to your projects list',
    budgetQuickProjectDeleted: 'Project Deleted',
    budgetQuickProjectDeletedDesc: 'The project has been removed from your list',
    budgetDeleteQuickProjectConfirm: 'Are you sure you want to delete the project "{title}"?',
    budgetInvalidAmount: 'Invalid Amount',
    budgetInvalidAmountDesc: 'Please enter a valid positive number for the monthly amount.',
    budgetInvalidValue: 'Invalid Value',
    budgetInvalidValueDesc: 'Please enter a valid positive number for the field value.',
    budgetCannotRemoveAutoGenerated: 'Cannot Remove',
    budgetCannotRemoveAutoGeneratedDesc: 'Auto-generated investments cannot be removed. Address the underlying budget issue instead.',
    budgetCannotEditAutoGenerated: 'Cannot Edit',
    budgetCannotEditAutoGeneratedDesc: 'Auto-generated investments cannot be edited. Address the underlying budget issue instead.',
    budgetValidationError: 'Validation Error',
    budgetFillAllFields: 'Please fill in all required fields (Title, Budget, Financial Year)',
    budgetInvestmentNotFound: 'Error',
    budgetInvestmentNotFoundDesc: 'Investment not found or not auto-generated.',
    budgetCurrentBalanceApplied: 'Current balance applied',
    budgetCurrentBalanceAppliedDesc: 'Starting balance set to {amount}',
    budgetAddNewInvestment: 'Add New Investment',
    budgetEditInvestmentTitle: 'Edit Investment',
    budgetAddQuickProjectTitle: 'Add Quick Project',
    budgetRevenue: 'Revenue',
    budgetSpending: 'Spending',
    budgetBalanceStartOfPeriod: 'Balance (Start of Period)',
    budgetBalanceEndOfPeriod: 'Balance (End of Period)',
    budgetNetCashFlow: 'Net Cash Flow',
    budgetCapitalInvestments: 'Capital Investments',
    budgetMinimumRequirementLine: 'Minimum Requirement',
    budgetMonthlyView: 'Monthly View',
    budgetYearlyView: 'Yearly View',
    budgetMonth: 'Month',
    budgetYear: 'Year',
    budgetShowing: 'Showing:',
    budgetDisplaying: 'Displaying:',
    budgetOf: 'of',
    budgetSeriesVisible: 'series visible',
    budgetUrgent: 'Urgent',
    budgetNotUrgent: 'Not Urgent',
    budgetSuggested: 'Suggested',
    budgetAutoGenerated: 'Auto-generated',
    budgetQuickProjectBadge: 'Quick Project',
    budgetCurrentBalance: 'Current Balance',
    budgetMonthlyRevenue: 'Monthly Revenue',
    budgetMonthlySpending: 'Monthly Spending',
    budgetYearEndProjection: 'Year End Projection',
    budgetTotalInvestment: 'Total Investment',
    budgetUseQuickProjectHelp: 'Use "Add Quick Project" to create a new project',
    budgetConfirmAndMakePermanent: 'Confirm and make permanent',
    budgetMonths: 'months',
    budgetYears: 'years',
    budgetTotalMonthlyRevenue: 'Total Monthly Revenue:',
    budgetTotalMonthlyExpenses: 'Total Monthly Expenses:',
    budgetMonthlyResidenceFees: 'Monthly Residence Fees',
    budgetInflationRateMode: 'Inflation Rate Mode',
    budgetCategorySpecificInflationRates: 'Category-Specific Inflation Rates (%)',
    budgetCapitalInvestmentStrategy: 'Capital Investment Strategy',
    budgetUrgentCapitalOnly: 'Urgent Capital Only',
    budgetSuggestedPlusUrgent: 'Suggested + Urgent',
    budgetAllInvestments: 'All Investments',
    budgetUtilitiesInflation: 'Utilities',
    budgetMaintenanceInflation: 'Maintenance',
    budgetGeneralInflation: 'General',
    budgetOtherInflation: 'Other',
    budgetTotalMinimumRequirement: 'Total Minimum Requirement',
    budgetMinimumRequirementSummary: 'This represents the total minimum reserve funds required for this building',
    budgetSaveMinimumRequirement: 'Save Minimum Requirement',
    budgetRequired: '*',
    budgetOptional: 'Optional',
    budgetIncludeInBudget: 'Include in Budget',
    budgetActualCost: 'Actual',
    budgetNoProjectsFound: 'No projects found',
    budgetSaveBankAccountSettings: 'Save Bank Account Settings',
    budgetSaveRevenueConfiguration: 'Save Revenue Configuration',
    budgetSaveBillsConfiguration: 'Save Bills Configuration',
    budgetDescriptionPlaceholder: 'Description (optional)',
    budgetManageProjectsForCurrentYear: 'Manage projects for current year and future',
    budgetUrgentCapitalInjection: 'Urgent Capital Injection',
    budgetSuggestedCapitalInjection: 'Suggested Capital Injection',
    budgetAutoGeneratedScenario: 'Auto-generated {mode} scenario to maintain minimum reserve requirement ({amount})',
    
    // Capital Investment Scenarios (additional keys)
    budgetMonthlyPayment: 'Monthly Payment',
    budgetNoPaymentNeeded: 'No payment needed',
    budgetSuggestedCapital: 'Suggested + Urgent',
    budgetSuggestedCapitalDesc: 'Include both suggested and urgent capital investments',
    budgetUrgentCapitalOnlyDesc: 'Only urgent capital investments',
    budgetCustomMode: 'Custom Mode',
    budgetCustomModeDesc: 'Manage investments manually',
    budgetNoAutomaticCapitalInjections: 'No automatic capital injections',
    budgetCapitalInvestmentStrategyHelp: 'Choose how to handle capital investments',
    budgetUrgentScenarioHelp: 'Suggests capital investments only when the budget is projected to fall below $0, preventing complete depletion of funds.',
    budgetSuggestedScenarioHelp: 'Suggests capital investments to prevent the account balance from falling below the minimum requirement threshold.',
    budgetCustomScenarioHelp: 'No automatic capital investment suggestions. Manually add and manage capital injections as needed.',
    budgetInvestmentTitlePlaceholder: 'Enter investment title',
    budgetInvestmentDescriptionPlaceholder: 'Enter description (optional)',
    budgetNoInvestmentsMatch: 'No investments match your filters',
    budgetAddCustomInvestmentsHelp: 'Add custom investments using the form above',
    
    // Bills Configuration
    budgetRecurrentBills: 'Recurrent Bills',
    budgetUniqueBills: 'Unique Bills',
    budgetInflationRateSettings: 'Inflation Rate Settings',
    budgetApplySameRateToAllBills: 'Apply same rate to all bills',
    budgetSetDifferentRatesPerCategory: 'Set different rates per category',
    budgetPerCategory: 'Per Category',
    budgetGlobal: 'Global',
    budgetGlobalBillsInflationRate: 'Global Bills Inflation Rate (%)',
    budgetAppliedToAllBillCategories: 'Applied to all bill categories',
    budgetUtilities: 'Utilities',
    budgetGeneral: 'General',
    budgetSetDifferentInflationRates: 'Set different inflation rates',
    budgetUnplannedBillsMonthly: 'Unplanned Bills (Monthly)',
    budgetUnplannedBillsStartDate: 'Unplanned Bills Start Date',
    budgetNextMonth: 'Next Month',
    budgetAdditionalBudgetUnexpected: 'Additional budget for unexpected expenses',
    
    // Punctual Revenue Growth
    budgetPunctualRevenueGrowth: 'Punctual Revenue Growth',
    budgetPunctualRevenueGrowthDesc: 'Planned increases in condo fees for specific years',
    budgetPercentageIncrease: 'Percentage Increase (%)',
    budgetInflationIncluded: 'Inflation Included',
    budgetInflationIncludedTooltip: 'If enabled, the regular revenue inflation rate will not be applied for this year',
    budgetAddPunctualGrowth: 'Add Punctual Growth',
    budgetNoPunctualGrowth: 'No punctual revenue growth configured',
    budgetDeletePunctualGrowth: 'Delete this punctual growth entry',
    budgetInvalidYear: 'Year must be in the future',
    budgetInvalidMonth: 'Please select a valid month',
    budgetYearAlreadyExists: 'A punctual growth for this year already exists',
    budgetYearMonthAlreadyExists: 'A punctual growth for this year and month combination already exists',
    budgetRevenueConfigurationHelp: 'Revenue Configuration Guide',
    budgetRevenueGrowthRateHelp: 'Annual baseline increase applied to all revenues every year, representing regular inflation and cost adjustments.',
    budgetPunctualRevenueGrowthHelp: 'Specific condo fee increases planned for particular months and years, such as special assessments or one-time rate adjustments.',
    budgetInflationIncludedHelp: 'When enabled, this punctual growth percentage already accounts for inflation. The system will skip applying the regular Revenue Growth Rate for this specific period.',
    budgetRevenueConfigNote: 'Punctual growth entries override the base revenue growth rate for their specified periods.',
    budgetRevenueGrowthRateNote: 'This rate applies annually to all revenues. When a Punctual Growth entry has "Inflation Included" enabled, this base rate is not applied for that specific period.',
    selectMonth: 'Select month',
    selectDay: 'Select day',
    plannedDate: 'Planned Date',
    budgetHistoricalAverage: 'Historical Average',
    budgetNoDataAvailable: 'No data available',
    budgetManualOverride: 'Manual Override',
    budgetMonthlyExpenses: 'Monthly Expenses',
    
    // Revenue Configuration
    budgetResidenceRevenue: 'Residence Revenue',
    loadingResidenceData: 'Loading residence data...',
    budgetResidenceDataLoadFailed: 'Failed to load residence data',
    budgetRevenueCalculationIncomplete: 'Revenue calculation may be incomplete',
    budgetActiveResidences: 'active residences',
    budgetPerMonth: 'per month',
    budgetCustomRevenueSources: 'Custom Revenue Sources',
    budgetCustomRevenue: 'Custom Revenue',
    
    // Project Management
    budgetProjectsAffectingBudget: 'Projects affecting this budget',
    budgetFinancialYearStartHelp: 'The fiscal year starts in this month',
    budgetAddQuickProjectDescription: 'Quick description of the project',
    budgetTotalBudget: 'Total Budget',
    budgetPleaseCompleteRequiredFields: 'Please complete all required fields',
    
    // General
    investment: 'Investment',
    years: 'years',
    month: 'month',
    increase: 'increase',
    validationError: 'Validation Error',
    notSet: 'Not set',
    
    // Bill Payments
    payments: 'payments',
    noPaymentsCurrentYear: 'No payments scheduled for current financial year',
    noFiscalYearWarning: 'No fiscal year start date is configured for this building. Please configure it in building settings to see accurate financial year labels.',
    
    // Additional missing translations
    balcony: 'Balcony',
    condition: 'Condition',
    contactAddedSuccessfully: 'Contact added successfully',
    contactDeletedSuccessfully: 'Contact deleted successfully',
    contactUpdatedSuccessfully: 'Contact updated successfully',
    deleteDocuments: 'Delete Documents',
    deleteDocumentsConfirmation: 'Are you sure you want to delete the selected documents? This action cannot be undone.',
    documentNotFound: 'Document not found',
    errorLoadingBuildings: 'Error loading buildings',
    failedToLoadBuildingInformation: 'Failed to load building information',
    inventoryManagement: 'Inventory Management',
    loadingDocuments: 'Loading documents...',
    noBuildingsAccess: 'You do not have access to any buildings',
    noMatchingBuildings: 'No matching buildings found',
    noMatchingBuildingsDescription: 'Try adjusting your search criteria',
    searchBuildingsByNameOrAddress: 'Search buildings by name or address',
    updateBugReport: 'Update Bug Report',
    viewAccessibleBuildingsAndDocuments: 'View accessible buildings and documents',

    // Features Page translations
    featuresPageTitle: 'Complete features for',
    featuresPageTitleHighlight: 'Quebec property management',
    featuresPageSubtitle: 'Discover all the features of our platform designed specifically to meet the needs of property managers and residents in Quebec.',
    featuresPageTryNow: 'Try now',
    featuresPageStartNow: 'Start now',
    featuresCoreFeaturesTitle: 'Core Features',
    featuresCoreFeaturesSubtitle: 'Four essential pillars for effective and compliant property management in Quebec.',
    featuresAdvancedTitle: 'Advanced Features',
    featuresAdvancedSubtitle: 'Complementary tools to optimize your daily property management.',
    featuresComplianceTitle: 'Quebec Regulatory Compliance',
    featuresComplianceSubtitle: 'Our platform complies with all legal and regulatory requirements of Quebec.',
    featuresReadyToTransform: 'Ready to transform your property management?',
    featuresJoinManagers: 'Join Quebec property managers who trust Koveo Gestion for their property management needs.',
    featuresBuildingManagementTitle: 'Complete Building Management',
    featuresBuildingManagementDesc: 'Oversee all your buildings with maintenance tracking, resident management, and Quebec regulatory compliance monitoring.',
    featuresBuildingManagement1: 'Preventive and corrective maintenance tracking',
    featuresBuildingManagement2: 'Common space management',
    featuresBuildingManagement3: 'Quebec compliance monitoring',
    featuresBuildingManagement4: 'Building performance reports',
    featuresResidentPortalTitle: 'Self-Service Resident Portal',
    featuresResidentPortalDesc: 'Self-service portal for residents to view invoices, submit requests, and communicate with property management.',
    featuresResidentPortal1: 'Online invoice and payment viewing',
    featuresResidentPortal2: 'Maintenance request submission',
    featuresResidentPortal3: 'Direct communication with management',
    featuresResidentPortal4: 'Interaction and document history',
    featuresFinancialReportsTitle: 'Detailed Financial Reports',
    featuresFinancialReportsDesc: 'In-depth financial analyses, budget tracking, and reports compliant with Quebec regulations for transparency.',
    featuresFinancialReports1: 'Real-time financial dashboards',
    featuresFinancialReports2: 'Budget tracking and forecasting',
    featuresFinancialReports3: 'Quebec-standard compliant reports',
    featuresFinancialReports4: 'Property profitability analyses',
    featuresLaw25Title: 'Quebec Law 25 Compliance',
    featuresLaw25Desc: 'Built-in compliance with Quebec Law 25 and property management regulations. Data protection guaranteed.',
    featuresLaw251: 'Data protection under Law 25',
    featuresLaw252: 'Real estate regulatory compliance',
    featuresLaw253: 'Regular security audits',
    featuresLaw254: 'Consent and privacy management',
    featuresProjectMgmtTitle: 'Project Management',
    featuresProjectMgmtDesc: 'Plan, track, and manage maintenance projects with budget integration and timeline visualization.',
    featuresProjectMgmt1: 'Maintenance project planning and scheduling',
    featuresProjectMgmt2: 'Budget tracking and cost management',
    featuresProjectMgmt3: 'Project timeline and status updates',
    featuresProjectMgmt4: 'Integration with financial forecasting',
    featuresDocMgmtTitle: 'Document Management',
    featuresDocMgmtDesc: 'Secure storage and organization of all your real estate documents',
    featuresDocMgmt1: 'Secure cloud storage',
    featuresDocMgmt2: 'Document sharing',
    featuresDocMgmt3: 'Versions and history',
    featuresNotificationsTitle: 'Smart Notifications',
    featuresNotificationsDesc: 'Automatic alerts for maintenance, payments, and important events',
    featuresNotifications1: 'Customizable alerts',
    featuresNotifications2: 'Email notifications',
    featuresNotifications3: 'Automatic reminders',
    featuresBillingTitle: 'Electronic Billing',
    featuresBillingDesc: 'Digital billing system to track payments',
    featuresBilling1: 'Electronic invoices',
    featuresBilling2: 'Payment tracking',
    featuresBilling3: 'Invoice history',
    featuresCommTitle: 'Centralized Communication',
    featuresCommDesc: 'Unified communication platform between managers and residents',
    featuresComm1: 'Integrated messaging',
    featuresComm2: 'Conversation tracking',
    featuresComm3: 'Mass communication',
    featuresPlanningTitle: 'Maintenance Planning',
    featuresPlanningDesc: 'Intelligent planning system for property maintenance',
    featuresPlanning1: 'Integrated calendar',
    featuresPlanning2: 'Recurring scheduling',
    featuresPlanning3: 'Intervention tracking',
    featuresProcessTitle: 'Process Management',
    featuresProcessDesc: 'Tools to organize and manage property management processes',
    featuresProcess1: 'Organized workflows',
    featuresProcess2: 'Business rules',
    featuresProcess3: 'System configuration',
    featuresCompLaw25Title: 'Law 25 - Personal Information Protection',
    featuresCompLaw25Desc: 'Full compliance with Quebec personal data protection requirements',
    featuresCompCondoTitle: 'Condominium Regulations',
    featuresCompCondoDesc: 'Compliance with Quebec laws on condominium and syndicate management',
    featuresCompFinancialTitle: 'Financial Transparency Standards',
    featuresCompFinancialDesc: 'Financial reports compliant with Quebec transparency requirements',
    featuresCompBilingualTitle: 'Accessibility and Bilingualism',
    featuresCompBilingualDesc: 'Bilingual French-English interface and accessibility standards compliance',

    // Home Page Feature Card Popup translations
    learnMore: 'Learn More',
    viewSecurityDetails: 'View Security Details',

    // Terms of Service Page
    termsPageTitle: 'Terms of Service',
    termsLastUpdated: 'Last updated: January 2025',
    termsIntro: 'These terms of service govern your access and use of the Koveo Gestion platform, a property management service designed for the Quebec market.',
    termsSection1Title: '1. Acceptance of Terms',
    termsSection1Content: 'By accessing or using our platform, you agree to be bound by these terms of service and our privacy policy. If you do not accept these terms, please do not use our services.',
    termsSection2Title: '2. Service Description',
    termsSection2Intro: 'Koveo Gestion provides a property management platform including:',
    termsServiceItem1: 'Building and residence management',
    termsServiceItem2: 'Resident portal for communications and payments',
    termsServiceItem3: 'Financial tracking and reporting tools',
    termsServiceItem4: 'Secure document management',
    termsServiceItem5: 'Quebec compliance features',
    termsSection3Title: '3. User Accounts',
    termsSection3Intro: 'To use our service, you must:',
    termsAccountItem1: 'Create an account with accurate and up-to-date information',
    termsAccountItem2: 'Maintain the security of your login credentials',
    termsAccountItem3: 'Notify us immediately of any unauthorized access',
    termsAccountItem4: 'Be responsible for all activities under your account',
    termsAccountItem5: 'Comply with applicable Quebec and Canadian laws',
    termsSection4Title: '4. Acceptable Use',
    termsSection4Intro: 'You agree not to:',
    termsUseItem1: 'Use the service for illegal or unauthorized purposes',
    termsUseItem2: 'Attempt to access other users\' accounts',
    termsUseItem3: 'Interfere with the operation of the service',
    termsUseItem4: 'Upload or transmit viruses or malicious code',
    termsUseItem5: 'Violate intellectual property rights',
    termsUseItem6: 'Harass or harm other users',
    termsSection5Title: '5. Intellectual Property',
    termsSection5Content: 'Koveo Gestion and its licensors hold all intellectual property rights related to the service, including software, content, trademarks, and designs. You retain ownership of your data but grant us a license to use it as necessary to provide the service.',
    termsSection6Title: '6. Privacy and Data',
    termsSection6Content: 'Our processing of your personal data is governed by our privacy policy, which complies with Quebec\'s Law 25. You agree to respect the confidentiality of other users\' information to which you may have access.',
    termsSection7Title: '7. Payments and Billing',
    termsSection7Intro: 'Payment terms include:',
    termsPaymentItem1: 'Fees are billed according to your chosen subscription plan',
    termsPaymentItem2: 'Payment is due in advance for each billing period',
    termsPaymentItem3: 'Applicable taxes are added to subscription fees',
    termsPaymentItem4: 'Non-payment may result in service suspension',
    termsPaymentItem5: 'Refunds are granted according to our refund policy',
    termsSection8Title: '8. Service Availability',
    termsSection8Content: 'We strive to maintain high service availability but do not guarantee uninterrupted access. We may perform scheduled maintenance with reasonable notice.',
    termsSection9Title: '9. Limitation of Liability',
    termsSection9Content: 'To the extent permitted by Quebec law, our liability is limited to the amount paid for the service in the last 12 months. We are not liable for indirect, consequential, or punitive damages.',
    termsSection10Title: '10. Termination',
    termsSection10Intro: 'You may terminate your account at any time. We may suspend or terminate your access in case of:',
    termsTerminationItem1: 'Violation of these terms of service',
    termsTerminationItem2: 'Non-payment of fees due',
    termsTerminationItem3: 'Fraudulent or illegal activity',
    termsTerminationItem4: 'Service discontinuation (with 30 days notice)',
    termsSection11Title: '11. Governing Law',
    termsSection11Content: 'These terms are governed by the laws of Quebec and Canada. Any dispute will be subject to the exclusive jurisdiction of Quebec courts.',
    termsSection12Title: '12. Modifications',
    termsSection12Content: 'We reserve the right to modify these terms occasionally. Significant changes will be communicated by email with 30 days notice.',
    termsSection13Title: '13. Contact',
    termsSection13Intro: 'For any questions regarding these terms of service:',
    termsContactInfo: 'Koveo Gestion Customer Service\nEmail: info@koveo-gestion.com\nPhone: 1-514-712-8441\nAddress: Montreal, Quebec, Canada',

    // Enterprise Page
    enterprise: 'Enterprise',
    enterprisePageTitle: 'Boost Your Business Efficiency',
    enterprisePageSubtitle: 'A comprehensive property management solution designed for businesses looking to scale their operations.',
    enterpriseVersatilityTitle: 'One Platform, Multiple Property Types',
    enterpriseVersatilityDesc: 'Our solution adapts to all types of property management.',
    enterpriseRentals: 'Rental Properties',
    enterpriseCondos: 'Condominiums',
    enterpriseRentalsDesc: 'Complete management of rental units: leases, rents, maintenance, and tenant communication.',
    enterpriseCondosDesc: 'Syndicate management, common charges, assemblies, and condo regulations compliance.',
    enterpriseWhiteLabelTitle: 'White Label Solution',
    enterpriseWhiteLabelDesc: 'Offer the platform under your own brand.',
    enterpriseWhiteLabelExplanation: 'White Label means you can customize the application with your own logo, colors, and branding to offer it to your clients as if it were your own product.',
    enterpriseWhiteLabelBenefit1: 'Strengthen your brand identity',
    enterpriseWhiteLabelBenefit2: 'Build customer loyalty',
    enterpriseWhiteLabelBenefit3: 'Stand out from the competition',
    enterprisePricingTitle: 'Volume Pricing',
    enterprisePricingDesc: 'The more properties you manage, the more you save.',
    enterprisePriceTier1: '$10 CAD',
    enterprisePriceTier1Desc: 'Up to 99 doors',
    enterprisePriceTier2: '$8 CAD',
    enterprisePriceTier2Desc: '100+ doors',
    enterprisePriceTier3: '$6 CAD',
    enterprisePriceTier3Desc: '500+ doors',
    enterprisePriceTier4: 'Custom Quote',
    enterprisePriceTier4Desc: '1000+ doors',
    enterpriseJuniorTitle: 'Junior Property Managers',
    enterpriseJuniorDesc: 'Starting your property management career?',
    enterpriseJuniorBenefit: 'Get your first doors free to launch your business and build your portfolio.',
    enterpriseAdvantagesTitle: 'Enterprise Advantages',
    enterpriseAdvantage1: 'Multi-Property Centralization',
    enterpriseAdvantage1Desc: 'Manage all your properties from a single dashboard.',
    enterpriseAdvantage2: 'Consolidated Reports',
    enterpriseAdvantage2Desc: 'Complete financial and operational overview across your portfolio.',
    enterpriseAdvantage3: 'Dedicated Support',
    enterpriseAdvantage3Desc: 'Priority access to our expert support team.',
    enterpriseContactTitle: 'Request a Quote',
    enterpriseContactDesc: 'Contact us to discuss your specific needs and get a personalized offer.',
    enterpriseContactEmail: 'Email',
    enterpriseContactPhone: 'Phone',
    enterpriseRequestQuote: 'Request Quote',
    enterprisePerDoor: 'per door',
    enterprisePerMonth: 'per month',
    documentLinkCreatedTitle: 'Documents linked',
    documentLinkCreatedDesc: 'The document sequence has been updated.',
    documentLinkErrorTitle: 'Could not link documents',
    documentLinkErrorDesc: 'Please try again.',
    linkPreviousDocumentTitle: 'Link previous document',
    linkNextDocumentTitle: 'Link next document',
    linkDocumentPickerDescription: 'Pick a document to chain in your reading sequence. Suggestions are ranked by relevance.',
    linkDocumentSearchPlaceholder: 'Search by name…',
    linkDocumentNoCandidates: 'No matching documents found in this scope.',
    linkExplainSharedCategory: 'Same category',
    linkExplainSharedTags: 'Shared tags',
    linkExplainCloseInTime: 'Close in time',
    linkedBadge: 'Linked',
    byDateBadge: 'By date',
    addPreviousDocument: 'Link previous',
    addNextDocument: 'Link next',
    editPreviousLink: 'Change previous link',
    editNextLink: 'Change next link',
    linkPositionLabel: 'Link as',
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
    select: 'Sélectionner',
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
    quebecComplianceDesc: 'Conformité réglementaire du Québec pour la gestion immobilière',
    quebecDataProtectionDesc: 'Protection des données selon la Loi 25 du Québec',
    memoryUsage: 'Utilisation de la mémoire',
    bundleSize: 'Taille du bundle',
    dbQueryTime: 'Temps de requête DB',
    pageLoadTime: 'Temps de chargement de page',
    nextActions: 'Prochaines actions',
    initializeQAPillar: 'Initialiser le pilier AQ',
    configureTesting: 'Configurer les tests',
    continuousImprovementPillar: 'Amélioration continue',
    continuousImprovementDescription: 'Cadre d\'optimisation et d\'amélioration continue',
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
    deleteOrphanUsers: 'Supprimer les utilisateurs orphelins',
    deleteOrphanUsersConfirmTitle: 'Supprimer les utilisateurs orphelins',
    deleteOrphanUsersConfirmDescription: 'Ceci marquera définitivement tous les utilisateurs orphelins (utilisateurs sans affectation d\'organisation ou de résidence) comme inactifs.',
    deleteOrphanUsersWarning: 'Avertissement : Cette action va :',
    deleteOrphanUsersWarningList1: 'Marquer tous les utilisateurs orphelins comme inactifs (ils seront cachés de l\'interface)',
    deleteOrphanUsersWarningList2: 'Préserver leurs données à des fins d\'audit mais supprimer l\'accès',
    deleteOrphanUsersWarningList3: 'Affecter uniquement les utilisateurs sans affectation d\'organisation ou de résidence',
    deleteOrphanUsersWarningList4: 'Ne peut pas être annulé via l\'interface',
    filterByOrganization: 'Filtrer par organisation',
    orphanFilterUnavailable: 'Filtre orphelin non disponible (organisation sélectionnée)',
    userInvitationsNotAvailableDemo: 'Les invitations d\'utilisateurs ne sont pas disponibles en mode démo',
    allUsers: 'Tous les utilisateurs',
    orphanUsers: 'Utilisateurs orphelins',
    assignedUsers: 'Utilisateurs assignés',
    noStatus: 'Aucun statut',
    noOrganizations: 'Aucune organisation',
    noBuildings: 'Aucun bâtiment',
    noResidences: 'Aucune résidence',
    more: 'de plus',
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
    invitationAlreadyPending:
      'Une invitation en attente existe déjà pour cette organisation et ce courriel. Utilisez Renvoyer invitation pour prolonger son expiration, ou Annuler invitation pour recommencer.',
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
    userManagementSubtitle: 'Gérer les utilisateurs, les rôles, les autorisations d\'accès et envoyer des invitations aux nouveaux membres.',
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
    selectAll: 'Tout sélectionner',
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
    vendorInvoiceNumber: 'Numéro de facture',
    issueDate: "Date d'émission",
    category: 'Catégorie',
    selectCategory: 'Sélectionner la catégorie',
    billTitle: 'Titre de la facture',
    companyOrServiceProvider: 'Entreprise/Fournisseur de services',
    selectPaymentType: 'Sélectionner le type de paiement',
    paymentType: 'Type de paiement',
    allPaymentTypes: 'Tous les types de paiement',
    billType: 'Type de facture',
    allBillTypes: 'Tous les types de factures',
    paymentStructure: 'Structure de paiement',
    allPaymentStructures: 'Toutes les structures de paiement',
    unique: 'Unique',
    recurrent: 'Récurrent',
    single: 'Unique',
    installment: 'Versement',
    searchByVendor: 'Rechercher par fournisseur...',
    allPayments: 'Tous les paiements',
    in: 'dans',
    // Payment management
    paymentDate: 'Date de paiement',
    paymentAmount: 'Montant du paiement',
    paymentStatus: 'Statut du paiement',
    paymentDetails: 'Détails du paiement',
    paymentSchedule: 'Calendrier de paiement',
    paymentNumber: 'Numéro de paiement',
    scheduledDate: 'Date prévue',
    amount: 'Montant',
    paid: 'Payé',
    overdue: 'En retard',
    paymentHistory: 'Historique des paiements',
    viewPayments: 'Voir les paiements',
    noPaymentsFound: 'Aucun paiement trouvé',
    monthlyPayments: 'Paiements mensuels',
    singlePayment: 'Paiement unique',
    billingSchedule: 'Calendrier de facturation',
    selectStatus: 'Sélectionner le statut',
    monthlyBillsSummary: 'Résumé mensuel des factures',
    billsForSelectedBuilding: 'Factures avec paiements prévus pour l\'immeuble sélectionné',
    lastMonth: 'Mois dernier',
    nextMonth: 'Mois prochain',
    previousMonth: 'Mois précédent',
    selectedMonth: 'Mois sélectionné',
    totalBills: 'Total des factures',
    upcomingBills: 'Factures à venir',
    totalDue: 'Total dû',
    totalAmount: 'Montant total',
    alreadyPaid: 'Déjà payé',
    noBillsForPeriod: 'Aucune facture pour cette période',
    viewBillDetails: 'Voir les détails de la facture',
    billDetails: 'Détails de la facture',
    closeDetails: 'Fermer les détails',
    downloadAttachment: 'Télécharger la pièce jointe',
    noAttachment: 'Aucune pièce jointe',
    billInformation: 'Informations sur la facture',
    loadingDemands: 'Chargement des demandes...',
    searchDemandsUsers: 'Rechercher des demandes et des utilisateurs...',
    submitAndTrack: 'Soumettre et suivre',
    reviewDemand: 'Examiner la demande',
    submitted: 'Soumis',
    approved: 'Approuvé',
    completed: 'Terminé',
    rejected: 'Rejeté',
    draft: 'Brouillon',
    maintenance: 'Entretien',
    maintenanceJournal: 'Carnet d\'entretien',
    inventory: 'Inventaire',
    projects: 'Projets',
    complaint: 'Plainte',
    information: 'Information',
    other: 'Autre',
    allStatus: 'Tous les statuts',
    createNewBill: 'Créer une nouvelle facture',
    billCreationForm: 'Formulaire de création de facture',
    createBill: 'Créer une facture',
    
    // Bills form translations
    'bills.editBill': 'Modifier la facture',
    'bills.createNewBill': 'Créer une nouvelle facture',
    'bills.createFromTemplate': 'Créer une facture à partir du modèle',
    'bills.aiExtracted': 'Extrait par IA',
    'bills.manualEntry': 'Saisie manuelle',
    'bills.aiExtraction': 'Extraction IA',
    'bills.uploadBillDocument': 'Télécharger le document de facture',
    'bills.uploadDocumentOptional': 'Télécharger un document (optionnel)',
    'bills.autoSaving': 'Sauvegarde automatique...',
    'bills.title': 'Titre',
    'bills.vendor': 'Fournisseur',
    'bills.vendorInvoiceNumber': 'Numéro de facture',
    'bills.issueDate': "Date d'émission",
    'bills.issueDateFrom': "Date d'émission (du)",
    'bills.issueDateTo': "Date d'émission (au)",
    'bills.dueDate': "Date d'échéance",
    'bills.amount': 'Montant',
    'bills.category': 'Catégorie',
    'bills.status': 'Statut',
    'bills.paymentType': 'Type de paiement *',
    'bills.totalAmount': 'Montant total *',
    'bills.totalAmountOptional': 'Montant total (optionnel)',
    'bills.startDate': 'Date de début',
    'bills.paymentSchedule': 'Échéancier de paiement',
    'bills.paymentConfiguration': 'Configuration du paiement',
    'bills.initialPayment': 'Paiement initial',
    'bills.equalRecurringPayments': 'Paiements récurrents égaux',
    'bills.initialPaymentAmount': 'Montant du paiement initial *',
    'bills.recurringPaymentAmount': 'Montant du paiement récurrent *',
    'bills.recurrenceEndDate': 'Date de fin de récurrence (optionnel)',
    'bills.customPaymentSchedule': 'Échéancier de paiement personnalisé',
    'bills.individualPaymentAmounts': 'Montants de paiement individuels',
    'bills.addPayment': 'Ajouter un paiement',
    'bills.amount': 'Montant *',
    'bills.date': 'Date *',
    'bills.description': 'Description',
    'bills.notes': 'Notes',
    'bills.statusDraft': 'Brouillon',
    'bills.statusDraftNote': 'Les factures en brouillon sont exclues des calculs budgétaires',
    'bills.statusSent': 'Envoyé',
    'bills.statusSentPartiallyPaid': 'Envoyé (partiellement payé)',
    'bills.statusOverdue': 'En retard',
    'bills.statusPaid': 'Payé',
    'bills.statusCancelled': 'Annulé',
    'bills.paymentTypeOneTime': 'Facture unique',
    'bills.paymentTypeRecurring': 'Paiement récurrent',
    'bills.scheduleWeekly': 'Hebdomadaire',
    'bills.scheduleMonthly': 'Mensuel',
    'bills.scheduleQuarterly': 'Trimestriel',
    'bills.scheduleYearly': 'Annuel',
    'bills.yearInterval': 'Intervalle annuel',
    'bills.yearIntervalDescription': 'Nombre d\'années entre chaque occurrence (1-99). Par exemple, entrez 3 pour les factures qui se produisent tous les 3 ans.',
    'bills.scheduleCustom': 'Échéancier personnalisé',
    'bills.totalAmountDescriptionOneTime': 'Montant complet pour cette facture unique',
    'bills.totalAmountDescriptionRecurring': 'Laisser vide pour calculer à partir des montants de paiement individuels',
    'bills.initialPaymentDescription': 'Y a-t-il un paiement initial différent des montants récurrents?',
    'bills.equalRecurringPaymentsDescription': 'Tous les montants de paiement récurrents sont-ils les mêmes?',
    'bills.initialPaymentAmountDescription': 'Montant du paiement initial',
    'bills.recurringPaymentAmountDescription': 'Montant de chaque paiement récurrent',
    'bills.recurrenceEndDateDescription': 'L\'échéancier de paiement sera limité à l\'année suivante. Définir une date de fin arrêtera les factures récurrentes après cette date.',
    'bills.customPaymentScheduleDescription': 'Définissez votre échéancier de paiement personnalisé avec des dates et des montants spécifiques.',
    'bills.individualPaymentAmountsDescription': 'Étant donné que les paiements récurrents ne sont pas égaux, spécifiez les montants individuels pour chaque paiement. Les dates seront calculées en fonction de votre échéancier sélectionné.',
    'bills.deleting': 'Suppression...',
    'bills.deleteBill': 'Supprimer la facture',
    'bills.cancel': 'Annuler',
    'bills.processing': 'Traitement...',
    'bills.updateBill': 'Mettre à jour la facture',
    'bills.createBill': 'Créer la facture',
    'bills.paymentCount': 'Nombre de paiements *',
    'bills.paymentCountSingle': 'Paiement unique',
    'bills.paymentCountMultiple': 'Paiements multiples',
    'bills.paymentCountDescription': 'Choisissez s\'il s\'agit d\'un paiement unique ou de paiements multiples',
    'bills.recurrence': 'Générer automatiquement les factures pour l\'année prochaine',
    'bills.recurrenceDescription': 'Lorsqu\'elle est activée, cette facture se répétera automatiquement pour l\'année suivante',
    'bills.singlePaymentAmount': 'Montant du paiement',
    'bills.singlePaymentAmountDescription': 'Entrez le montant pour ce paiement unique',
    'bills.calculatedTotalAmount': 'Montant total calculé',
    'bills.totalAmountSingleDescription': 'Montant pour le paiement unique',
    'bills.totalAmountMultipleEqualDescription': 'Calculé à partir de la configuration de paiement (12 paiements)',
    'bills.totalAmountMultipleCustomDescription': 'Somme de tous les montants de paiement',
    'bills.autoCalculatedBadge': 'Auto-calculé',
    'bills.fromPaymentAmountBadge': 'Du montant de paiement',
    'bills.billType': 'Type de facture',
    'bills.billTypeUnique': 'Facture unique',
    'bills.billTypeRecurrent': 'Facture récurrente',
    'bills.billTypeDescription': 'Les factures uniques se produisent une fois. Les factures récurrentes se répètent automatiquement (p. ex., annuellement avec paiement unique, ou versements mensuels)',
    'bills.paymentStructure': 'Structure de paiement',
    'bills.paymentStructureSingle': 'Paiement unique',
    'bills.paymentStructureInstallment': 'Plan de versements',
    'bills.paymentStructureDescription': 'Paiement unique = payé en une seule somme. Plan de versements = divisé en plusieurs paiements planifiés',
    'bills.recurrenceEndDateDescriptionSingle': 'Optionnel. Spécifiez quand cette facture récurrente devrait cesser. Laissez vide pour les factures continues. Par exemple, une facture annuelle commençant en 2024 sans date de fin se répétera chaque année indéfiniment.',
    'bills.recurrenceEndDateDescriptionInstallment': 'Optionnel. Spécifiez quand cette facture récurrente devrait cesser de générer de nouveaux cycles de paiement. Laissez vide pour les factures continues.',
    'bills.editAutoGeneratedDescription': 'Modifiez cette facture. L\'enregistrement la convertira en facture régulière.',
    'bills.extractingData': 'Extraction des données de votre document...',
    'bills.extractingDataNote': 'Cela peut prendre quelques secondes selon la complexité du document.',
    'bills.customPaymentDateRequired': 'La date est requise',
    'bills.customPaymentDateRequiredSingle': 'Veuillez entrer une date pour chaque paiement. 1 paiement n\'a pas de date.',
    'bills.customPaymentDateRequiredPlural': 'Veuillez entrer une date pour chaque paiement. {count} paiements n\'ont pas de date.',
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
    createDocument: 'Créer un document',
    editDocument: 'Modifier le document',
    createDocumentDialogDescription: 'Créer un nouveau document pour cette entité',
    editDocumentDialogDescription: 'Modifier les informations et les paramètres du document',
    documentContent: 'Contenu du document',
    effectiveDate: 'Date d\'effet',
    visibleToTenants: 'Visible pour les locataires',
    uploadDate: 'Date de téléchargement',
    uploadFile: 'Télécharger un fichier',
    uploadFileOrCreateText: 'Télécharger un fichier ou créer un document texte. Taille maximale du fichier : 25 Mo.',
    maxFileSize: 'Taille maximale du fichier',
    yes: 'Oui',
    no: 'Non',
    documentNameRequired: 'Le nom du document est requis',
    documentNameTooLong: 'Le nom doit contenir moins de 255 caractères',
    documentDescriptionTooLong: 'La description doit contenir moins de 1000 caractères',
    missingContent: 'Contenu manquant',
    missingContentDescription: 'Veuillez télécharger un fichier ou saisir du contenu texte pour le document.',
    documentCreatedSuccessfully: 'a été créé avec succès',
    documentUpdatedSuccessfully: 'Document mis à jour avec succès',
    documentDeletedSuccessfully: 'Document supprimé avec succès',
    failedToCreateDocument: 'Échec de la création du document',
    failedToUpdateDocument: 'Échec de la mise à jour du document',
    failedToDeleteDocument: 'Échec de la suppression du document',
    creatingDocument: 'Création en cours...',
    updatingDocument: 'Mise à jour en cours...',
    deletingDocument: 'Suppression en cours...',
    documentVisibility: 'Partager avec les locataires',
    documentVisibilityDescription: 'Lorsque activé, les locataires peuvent voir et télécharger ce document depuis leur portail',
    managerOnly: 'Gestionnaires seulement',
    managerOnlyDescription: 'Lorsque activé, seuls les gestionnaires assignés à cet immeuble (et les administrateurs) peuvent consulter ce document. Les résidents et locataires ne le verront pas, même s\'il appartient à leur résidence ou immeuble.',
    showManagerOnlyDocuments: 'Afficher uniquement les documents pour gestionnaires',
    showOnlyLinkedDocuments: 'Afficher uniquement les documents faisant partie d\u2019une s\u00e9quence',
    partOfSequence: 'Fait partie d\u2019une s\u00e9quence',
    linkedPrevious: 'Pr\u00e9c\u00e9dent',
    linkedNext: 'Suivant',
    confirmDeleteDocument: 'Êtes-vous sûr de vouloir supprimer ce document ? Cette action ne peut pas être annulée.',
    documentDetails: 'Détails du document',
    documentDetailsDescription: 'Afficher et gérer les informations du document',
    loadingDocument: 'Chargement du document...',
    documentAttachment: 'Pièce jointe du document',
    previewNotAvailable: 'Aperçu non disponible',
    previewNotAvailableDescription: "Ce type de fichier ne peut pas être prévisualisé dans le navigateur. Téléchargez le fichier pour l'ouvrir dans une application compatible.",
    backToResidences: 'Retour aux résidences',
    backToBuildings: 'Retour aux bâtiments',
    backToMyResidence: 'Retour à ma résidence',
    documents: 'Documents',
    documentsAvailableToTenants: 'Documents disponibles aux locataires',
    allResidenceDocuments: 'Tous les documents de résidence',
    categoryBylaws: 'Règlements',
    categoryFinancial: 'Financier',
    categoryMaintenance: 'Entretien',
    categoryLegal: 'Légal',
    categoryMeetingMinutes: 'Procès-verbaux',
    categoryInsurance: 'Assurance',
    categoryContracts: 'Contrats',
    categoryPermits: 'Permis',
    categoryInspection: 'Inspection',
    categoryOther: 'Autre',
    bylawsDocuments: 'Règlements',
    financialDocuments: 'Documents financiers',
    maintenanceRecords: 'Registres d\'entretien',
    legalDocuments: 'Documents légaux',
    meetingMinutesDocuments: 'Procès-verbaux',
    insuranceDocuments: 'Documents d\'assurance',
    contractsDocuments: 'Contrats',
    permitsDocuments: 'Permis',
    inspectionReports: 'Rapports d\'inspection',
    otherDocuments: 'Autres documents',
    loadingDemands2: 'Chargement des demandes...',
    noDemandsFound: 'Aucune demande trouvée',
    noDocumentsFound: 'Aucun document trouvé',
    noDocumentsMatchFilters: 'Aucun document ne correspond à vos filtres actuels. Essayez d\'ajuster votre recherche ou vos filtres.',
    documentsDeleted: 'Documents supprimés',
    successfullyDeleted: 'Supprimé avec succès',
    failedToDelete: 'Échec de la suppression',
    failedToDeleteDocumentsCount: 'Échec de la suppression de {count} document(s). Veuillez réessayer.',
    deselectAll: 'Tout désélectionner',
    buildingIdRequired: 'L\'ID du bâtiment est requis pour voir les documents',
    residenceIdRequired: 'L\'ID de la résidence est requis pour voir les documents',
    residenceNotFound: 'Résidence introuvable',
    residenceIdDoesNotExist: 'L\'ID de résidence "{entityId}" n\'existe pas dans la base de données.',
    productionDatabaseIdWarning: 'Remarque : Il peut s\'agir d\'un ID de base de données de production qui n\'existe pas dans l\'environnement de développement.',
    goToTestResidence: 'Aller à la résidence de test',
    viewAndActions: 'Affichage et actions',
    tags: 'Étiquettes',
    filterByTags: 'Filtrer par étiquettes',
    documentFound: 'document trouvé',
    documentsFound: 'documents trouvés',
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
    allResidences: 'Toutes les résidences',
    creator: 'Créateur',
    allCreators: 'Tous les créateurs',
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
    demoModeTitle: 'Mode Démonstration - Consultation Seulement',
    demoModeMessage: 'Ceci est un compte de démonstration avec accès en consultation seulement. Vous pouvez explorer toutes les fonctionnalités mais ne pouvez pas modifier les données.',
    demoModeSuggestion: 'Pour créer, modifier ou supprimer du contenu, veuillez nous contacter pour un compte complet.',
    demoModeContact: 'Contactez notre équipe pour commencer avec votre propre espace de gestion immobilière.',
    demoFileUploadRestricted: "Le téléchargement de fichiers n'est pas disponible en mode démonstration. Vous pouvez consulter les documents existants mais ne pouvez pas en télécharger de nouveaux.",
    demoBulkOperationRestricted: "Les opérations en lot ne sont pas disponibles en mode démonstration pour protéger l'intégrité des données de démonstration.",
    demoExportRestricted: "L'exportation de données n'est pas disponible en mode démonstration. Cette fonctionnalité est disponible dans les comptes complets.",
    firstName: 'Prénom',
    lastName: 'Nom de famille',
    confirmPassword: 'Confirmer le mot de passe',
    enterPassword: 'Entrez le mot de passe',
    enterFirstName: 'Entrez le prénom',
    enterLastName: 'Entrez le nom de famille',
    required: 'Requis',
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
    startFreeTrial: 'Débutez votre essai gratuit',
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
    maintenanceFilter: 'Entretien',
    complaintFilter: 'Plainte',
    informationFilter: 'Information',
    otherFilter: 'Autre',
    buildingsManagement: 'Gestion des bâtiments',
    buildingsManagementSubtitle: 'Gérer les informations sur les bâtiments, les actifs immobiliers et les structures organisationnelles.',
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
    commonSpacesCount: 'espaces communs',
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
    residencesManagementSubtitle: 'Gérer les informations sur les résidences, les unités, les détails des propriétés et les affectations des locataires dans vos propriétés.',
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
    budgetManagement: 'Gestion du budget',
    budgetManagementSubtitle: 'Planifier et suivre les budgets financiers pour la gestion immobilière avec des prévisions et des analyses complètes.',
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
    construction: 'Construction',
    consulting: 'Consultation',
    equipmentRental: 'Location d\'équipement',
    legalServices: 'Services juridiques',
    technology: 'Technologie',
    reserves: 'Réserves',
    billsManagement: 'Gestion des factures',
    billsSubtitle: 'Gérer les factures de propriété, les factures et les documents financiers avec un suivi et une organisation complets.',
    invoiceManagement: 'Gestion des factures',
    invoiceManagementSubtitle: 'Traitement et gestion modernes des factures alimentés par l\'IA',
    filters: 'Filtres',
    financialYearStarts: 'L\'année financière commence:',
    year: 'Année financière',
    months: 'Mois',
    allMonths: 'Tous les mois',
    allYears: 'Toutes les années',
    allCategories: 'Toutes les catégories',
    loadingBuildings: 'Chargement des bâtiments...',
    failedToLoadBuildings: 'Échec du chargement des bâtiments',
    retry: 'Réessayer',
    createFirstBill: 'Créer la première facture',
    noBillsFound: 'Aucune facture trouvée',
    noBillsFoundMessage: 'Aucune facture trouvée pour les filtres sélectionnés. Créez votre première facture pour commencer.',
    loadingBills: 'Chargement des factures...',
    searchBills: 'Rechercher des factures...',
    aiAnalyzedLabel: 'Analysé par IA',
    current: 'Actuel',
    demandsManagement: 'Gestion des demandes',
    demandsSubtitle: 'Gérer les demandes de maintenance et réclamations',
    allDemands: 'Toutes les demandes',
    reviewManageDemands: 'Examiner et gérer les demandes des résidents',
    type: 'Type',
    allTypes: 'Tous les types',
    description: 'Description',
    describeDemandDetail: 'Décrivez la demande en détail...',
    creating: 'Création...',
    createDemand: 'Créer une demande',
    typeLabel: 'Type',
    buildingLabel: 'Bâtiment',
    descriptionLabel: 'Description',
    residenceOptional: 'Résidence (optionnel)',
    noSpecificResidence: 'Aucune résidence spécifique',
    searchResidencesPlaceholder: 'Rechercher des résidences...',
    attachmentsOptional: 'Pièces jointes (optionnel)',
    attachmentUploadInstructions: 'Téléchargez des photos, documents ou captures d\'écran. Caméra supportée pour mobile. Maximum 10 Mo par fichier.',
    submitRequestComplaint: 'Soumettre une nouvelle demande ou plainte',
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
    filtered: 'Filtré',
    onThisPage: 'Sur cette page',
    confirmEmail: 'Confirmer le courriel',
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
    noItemsFound: 'Aucun élément trouvé',
    noItemsMessage: 'Aucun élément n\'est actuellement disponible à sélectionner.',
    noBookingsFound: 'Aucune réservation trouvée pour cet espace au cours des 12 derniers mois.',
    noBookingsFoundMessage: 'Aucune réservation trouvée pour cet espace au cours des 12 derniers mois.',
    selectCommonSpace: 'Sélectionnez un espace commun',
    selectCommonSpaceMessage: "Choisissez un bâtiment et un espace commun pour voir les statistiques d'utilisation.",
    noComplianceData: 'Aucune donnée de conformité disponible',
    noComplianceDataMessage: 'Exécutez l\'analyse de conformité pour voir le statut de conformité à la Loi 25.',
    noCertificateFound: 'Aucun certificat trouvé',
    noCertificateFoundMessage: 'Aucun certificat SSL trouvé pour ce domaine.',
    // Hierarchical selection messages
    buildingWithResidences: 'bâtiment avec résidences',
    buildingsWithResidences: 'bâtiments avec résidences',
    // Invitation management (moved to prevent duplicates)
    managePendingInvitations: 'Gérer les invitations en attente',
    loadingInvitations: 'Chargement des invitations...',
    deleteInvitation: 'Supprimer l\'invitation',
    deleteInvitationConfirm: 'Êtes-vous sûr de vouloir supprimer cette invitation?',
    invitationDeletedSuccess: 'Invitation supprimée avec succès',
    invitationDeletedError: 'Échec de la suppression de l\'invitation',
    viewInvitationHistory: 'Voir l\'historique',
    invitationHistory: 'Historique de l\'invitation',
    invitationHistoryDescription: 'Évènements du cycle de vie pour {email}',
    invitationHistoryEmpty: 'Aucun historique pour cette invitation pour le moment.',
    invitationHistoryLoadError: 'Échec du chargement de l\'historique de l\'invitation',
    invitationHistoryAction: 'Action',
    invitationHistoryPerformedBy: 'Effectué par',
    invitationHistoryWhen: 'Quand',
    invitationHistoryStatusChange: 'Changement de statut',
    invitationHistorySource: 'Source',
    invitationHistorySystem: 'Système',
    invitationHistoryShowDetails: 'Voir les détails',
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
    bugReportsSubtitle: 'Signaler et suivre les problèmes de l\'application',
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
    ideaBoxSubtitle: 'Partagez vos idées pour améliorer notre plateforme',
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
    privacyPolicyIntro: 'Votre confidentialité est importante pour nous. Cette politique explique comment nous collectons, utilisons et protégeons vos renseignements personnels.',
    lastUpdated: 'Dernière mise à jour :',
    informationCollection: '1. Collecte des renseignements',
    informationCollectionDesc: 'Nous collectons les renseignements personnels suivants dans le cadre de nos services :',
    informationUse: '2. Utilisation des renseignements',
    informationUseDesc: 'Vos renseignements personnels sont utilisés exclusivement pour :',
    informationSharing: '3. Partage et divulgation',
    privacyRights: '4. Vos droits',
    dataSecurity: '5. Sécurité des données',
    contactPrivacy: '6. Nous contacter',
    privacyInfoItem1: 'Informations d\'identification (nom, adresse courriel, numéro de téléphone)',
    privacyInfoItem2: 'Informations professionnelles (organisation, rôle, adresse d\'affaires)',
    privacyInfoItem3: 'Données de connexion et d\'utilisation de la plateforme',
    privacyInfoItem4: 'Communications et correspondances avec notre service client',
    privacyInfoItem5: 'Informations de paiement (traitées par des tiers sécurisés)',
    privacyUseItem1: 'Fournir et améliorer nos services de gestion immobilière',
    privacyUseItem2: 'Créer et gérer votre compte utilisateur',
    privacyUseItem3: 'Communiquer avec vous concernant votre compte et nos services',
    privacyUseItem4: 'Assurer la sécurité et l\'intégrité de notre plateforme',
    privacyUseItem5: 'Respecter nos obligations légales et réglementaires',
    privacySharingIntro: 'Nous ne vendons, ne louons, ni ne partageons vos renseignements personnels, sauf dans les cas suivants :',
    privacySharingItem1: 'Avec votre consentement explicite',
    privacySharingItem2: 'Avec nos fournisseurs de services tiers de confiance (hébergement, paiement)',
    privacySharingItem3: 'Lorsque requis par la loi ou par une autorité compétente',
    privacySharingItem4: 'Pour protéger nos droits, notre sécurité ou celle de nos utilisateurs',
    privacySecurityIntro: 'Nous mettons en place des mesures de sécurité techniques, physiques et administratives appropriées :',
    privacySecurityItem1: 'Chiffrement des données en transit et au repos (AES-256)',
    privacySecurityItem2: 'Contrôles d\'accès stricts et authentification à deux facteurs',
    privacySecurityItem3: 'Surveillance continue et audits de sécurité réguliers',
    privacySecurityItem4: 'Formation du personnel sur la protection des données',
    privacySecurityItem5: 'Sauvegarde sécurisée et plans de récupération',
    privacyRightsIntro: 'Conformément à la Loi 25, vous avez le droit de :',
    privacyRightsItem1: 'Accéder à vos renseignements personnels',
    privacyRightsItem2: 'Demander la rectification de vos données',
    privacyRightsItem3: 'Demander la suppression de vos renseignements',
    privacyRightsItem4: 'Retirer votre consentement à tout moment',
    privacyRightsItem5: 'Porter plainte auprès de la Commission d\'accès à l\'information',
    privacyContactIntro: 'Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, contactez-nous :',
    privacyContactEmail: 'Courriel :',
    privacyContactEmailLabel: 'privacy@koveo-gestion.com',
    privacyContactOfficer: 'Responsable de la protection des renseignements personnels',
    backToHome: 'Retour à l\'accueil',
    loginButton: 'Se connecter',
    securityTitle: 'Sécurité et conformité',
    securityIntro: 'La sécurité de vos données est notre priorité absolue. Découvrez comment nous protégeons vos informations avec des mesures de sécurité de niveau entreprise et la conformité à la Loi 25 du Québec.',
    enterpriseEncryption: 'Chiffrement de niveau entreprise',
    enterpriseEncryptionDesc: 'Toutes les données sont chiffrées en transit et au repos avec le chiffrement standard AES-256.',
    quebecDataProtection: 'Protection des données québécoises',
    secureInfrastructure: 'Infrastructure sécurisée',
    secureInfrastructureDesc: 'Architecture cloud redondante avec surveillance 24/7 et sauvegardes automatisées.',
    securityEnterpriseSectionTitle: 'Sécurité de niveau entreprise',
    securityEnterpriseSectionDesc: 'Notre plateforme intègre les plus hautes mesures de sécurité pour protéger vos données et garantir la confidentialité des informations de vos propriétés.',
    securityComplianceSectionTitle: 'Conformité et standards',
    securityComplianceSectionDesc: 'Koveo Gestion respecte les réglementations les plus strictes pour assurer la protection de vos données et la conformité légale.',
    securityDetailsSectionTitle: 'Mesures de sécurité détaillées',
    securityDetailsSectionDesc: 'Découvrez en détail comment nous protégeons vos données.',
    securityBadgeMilitaryGrade: 'Sécurité entreprise',
    securityBadgeControlledAccess: 'Accès contrôlé',
    securityBadgeLaw25: 'Loi 25',
    securityBadgeHighAvailability: 'Haute disponibilité',
    securityFeatureAes256: 'Chiffrement AES-256 pour tous les données',
    securityFeatureHttpsTls: 'Connexions HTTPS/TLS 1.3 obligatoires',
    securityFeatureSeparateKeys: 'Clés de chiffrement gérées séparément',
    securityFeatureKeyRotation: 'Rotation automatique des clés de sécurité',
    securityFeatureDefinedRoles: 'Rôles définis : administrateur, gestionnaire, résident',
    securityFeatureGranularPermissions: 'Permissions granulaires par fonctionnalité',
    securityFeatureCompleteAudit: 'Audit complet des accès et actions',
    securityFeatureSecureSessions: 'Sessions sécurisées avec expiration automatique',
    securityFeatureCanadaHosted: 'Données hébergées exclusivement au Canada',
    securityFeatureLaw25Compliance: 'Conformité Loi 25 - Protection des renseignements',
    securityFeatureInformedConsent: 'Consentement éclairé et gestion des préférences',
    securityFeatureRightToForget: 'Droit à l\'oubli et portabilité des données',
    securityFeatureMultiDataCenter: 'Redondance multi-centres de données',
    securityFeature247Monitoring: 'Surveillance de sécurité 24/7/365',
    securityFeatureEncryptedBackups: 'Sauvegardes chiffrées automatiques',
    securityFeatureDisasterRecovery: 'Plan de reprise d\'activité testé',
    securityComplianceLaw25Title: 'Loi 25 du Québec',
    securityComplianceLaw25Desc: 'Conformité complète aux exigences de protection des renseignements personnels',
    securityComplianceIndustryTitle: 'Standards de l\'industrie',
    securityComplianceIndustryDesc: 'Respect des meilleures pratiques de sécurité informatique',
    securityComplianceEncryptionTitle: 'Chiffrement avancé',
    securityComplianceEncryptionDesc: 'Implémentation des standards de chiffrement les plus récents',
    securityStatusCertified: 'Conforme',
    securityStatusCompliant: 'Conforme',
    securityStatusActive: 'Actif',
    securityDataProtectionTitle: 'Protection des données',
    securityDataProtectionAes256: 'Chiffrement AES-256 pour toutes les données sensibles',
    securityDataProtectionPasswordHash: 'Hachage sécurisé des mots de passe avec salt unique',
    securityDataProtectionAnonymization: 'Anonymisation des données pour les analyses',
    securitySurveillanceTitle: 'Surveillance et audit',
    securitySurveillanceLogging: 'Journalisation complète de tous les accès',
    securitySurveillanceDetection: 'Détection automatique des activités suspectes',
    securitySurveillanceAudits: 'Audits de sécurité réguliers par des tiers',
    securityCtaTitle: 'Prêt à sécuriser votre gestion immobilière?',
    securityCtaDescription: 'Rejoignez les propriétaires qui font confiance à Koveo Gestion pour la sécurité de leurs données.',
    securityCtaStartTrial: 'Commencer l\'essai gratuit',
    securityCtaViewPrivacy: 'Voir la politique de confidentialité',
    securityCtaAccessDashboard: 'Accéder au tableau de bord',
    securityNavBackHome: 'Retour à l\'accueil',
    securityNavPrivacyPolicy: 'Politique de confidentialité',
    securityNavOurStory: 'Notre histoire',
    ourStoryTitle: 'Notre histoire',
    foundationYear: '2025',
    foundationTitle: 'Fondation de Koveo Gestion',
    developmentYear: '2025',
    developmentTitle: 'Développement de la plateforme',
    developmentDesc: 'Conception et développement de notre solution complète en conformité avec la Loi 25 du Québec.',
    launchYear: '2026',
    launchTitle: 'Lancement officiel',
    launchDesc: 'Lancement de notre plateforme avec support bilingue complet et conformité québécoise.',
    storyMissionTitle: 'Notre mission',
    storyMissionDesc: 'Simplifier et moderniser la gestion immobilière au Québec en offrant des outils technologiques avancés, sécurisés et conformes aux réglementations locales.',
    storyVisionTitle: 'Vision',
    storyVisionDesc: 'Devenir la plateforme de référence pour la gestion immobilière moderne au Québec.',
    storyValuesTitle: 'Valeurs',
    storyValuesDesc: 'Transparence, innovation responsable et engagement envers la communauté québécoise.',
    storyEngagementTitle: 'Engagement',
    storyEngagementDesc: 'Protection de vos données avec une conformité totale à la Loi 25 du Québec.',
    storyJourneyTitle: 'Notre parcours',
    storyJourneySubtitle: 'De l\'idée initiale à la plateforme complète d\'aujourd\'hui, découvrez les étapes clés de notre développement.',
    storyOurValuesTitle: 'Nos valeurs',
    storyOurValuesSubtitle: 'Les principes qui guident chaque décision et orientent notre développement.',
    storyValueComplianceTitle: 'Conformité et transparence',
    storyValueComplianceDesc: 'Nous nous engageons à respecter toutes les réglementations québécoises et à maintenir la transparence dans nos pratiques.',
    storyValueServiceTitle: 'Service à la clientèle',
    storyValueServiceDesc: 'L\'expérience utilisateur et la satisfaction client sont au cœur de tout ce que nous faisons.',
    storyValueInnovationTitle: 'Innovation responsable',
    storyValueInnovationDesc: 'Nous innovons de manière réfléchie, en nous concentrant sur des solutions pratiques qui apportent une vraie valeur.',
    storyValueCommunityTitle: 'Communauté québécoise',
    storyValueCommunityDesc: 'Nous nous engageons envers la communauté des gestionnaires immobiliers du Québec et comprenons leurs défis uniques.',
    storyTeamTitle: 'Notre équipe',
    storyTeamSubtitle: 'Des experts passionnés par l\'amélioration de la gestion immobilière au Québec.',
    storyTeamExpertise: 'Expertise québécoise',
    storyTeamExpertiseDesc: 'Notre équipe combine une expertise technique de pointe avec une connaissance approfondie du marché immobilier québécois.',
    storyTeamHighlight1: 'Équipe d\'experts en gestion immobilière québécoise',
    storyTeamHighlight2: 'Spécialistes en conformité réglementaire',
    storyTeamHighlight3: 'Développeurs experts en sécurité des données',
    storyTeamHighlight4: 'Support client bilingue (français/anglais)',
    storyDocumentationTitle: 'Documentation complète',
    storyDocumentationDesc: 'Consultez notre documentation détaillée sur l\'histoire et la mission de Koveo Gestion.',
    storyViewDocumentation: 'Voir la documentation',
    storyAvailableDocuments: 'Documents disponibles',
    storyDownload: 'Télécharger',
    storyCtaTitle: 'Rejoignez notre vision',
    storyCtaDesc: 'Découvrez comment Koveo Gestion peut transformer votre approche de la gestion immobilière.',
    storyFreeTrial: 'Essai gratuit',
    storyDiscoverFeatures: 'Découvrir nos fonctionnalités',
    storyAccessDashboard: 'Accéder au tableau de bord',
    storyBackHome: 'Retour à l\'accueil',
    storyPrivacyPolicy: 'Politique de confidentialité',
    storySecurity: 'Sécurité',
    overview: 'Vue d\'ensemble',
    quickActions: 'Actions rapides',
    financialOverview: 'Vue d\'ensemble financière',
    buildingFinancialOverview: 'Vue d\'ensemble financière du bâtiment',
    budgetTrendAnalysis: 'Analyse des tendances budgétaires',
    budgetTrendAnalysisMonthly: 'Analyse des tendances budgétaires - Vue mensuelle',
    projectManagement: 'Gestion de projets',
    projectManagementDesc: 'Gérer les projets pour l\'année financière actuelle et les périodes futures',
    projectsAffectingBudget: 'Projets affectant les calculs budgétaires',
    fiscalYearFilter: 'Filtre d\'année fiscale',
    fiscalYearFilters: 'Filtres d\'année fiscale',
    loadNext25Years: 'Charger les 25 prochaines années',
    pastFiscalYears: 'Années fiscales passées',
    startingFiscalYear: 'Année fiscale de départ',
    chartYearPickerHelp: "Le graphique commence à la date d'ouverture du compte bancaire du bâtiment (ou le 1er janvier de l'année en cours si aucune date n'est définie). L'année la plus ancienne sélectionnable est {year}.",
    currentFiscalYear: 'Année fiscale actuelle',
    futureProjections: 'Projections futures',
    monthlyView: 'Vue mensuelle',
    yearlyView: 'Vue annuelle',
    noBuildingsAssigned: 'Aucun bâtiment assigné',
    displaying: 'Affichage',
    monthly: 'Mensuel',
    yearly: 'Annuel',
    manageProjectsForCurrentYear: 'Gérer les projets pour l\'année financière actuelle et les périodes futures',
    listView: 'Vue liste',
    ganttView: 'Vue Gantt',
    noDatesSet: 'Aucune date définie',
    includeInBudget: 'Inclure au budget',
    excludeFromBudget: 'Exclure du budget',
    statusSubmission: 'Soumission',
    statusPreWork: 'Pré-travaux',
    statusPostWork: 'Post-travaux',
    loadingProjects: 'Chargement des projets...',
    quickProject: 'Projet rapide',
    actual: 'Réel',
    cost: 'Coût',
    include: 'Inclure',
    noProjectsFound: 'Aucun projet trouvé pour l\'année financière actuelle et les périodes futures',
    minimumRequirement: 'Exigence minimale',
    investments: 'Investissements',
    ofWhich: 'dont',
    calendar: 'Calendrier',
    myResidence: 'Ma résidence',
    myBuilding: 'Mon bâtiment',
    commonSpaces: 'Espaces communs',
    budget: 'Budget',
    bills: 'Factures',
    demands: 'Demandes',
    navUserManagement: 'Gestion des utilisateurs',
    documentTags: 'Étiquettes de documents',
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
    quebecCompliance: 'Conformité Québec',
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
    
    // Trial Request Form
    trialRequestTitle: 'Demande d\'essai gratuit',
    trialRequestDescription: 'Découvrez Koveo Gestion avec un essai gratuit de 30 jours. Remplissez le formulaire ci-dessous et notre équipe vous contactera rapidement.',
    personalInformation: 'Informations personnelles',
    companyInformation: 'Informations sur l\'entreprise',
    propertyInformation: 'Informations sur les propriétés',
    additionalInformation: 'Informations supplémentaires',
    company: 'Nom de l\'entreprise',
    city: 'Ville',
    province: 'Province',
    postalCode: 'Code postal',
    numberOfBuildings: 'Nombre de bâtiments',
    numberOfResidences: 'Nombre total de résidences',
    message: 'Message',
    submitRequest: 'Envoyer la demande',
    copyright: '© 2025 Koveo Gestion',
    law25Compliant: 'Conforme à la Loi 25 du Québec',
    pricing: 'Tarification',
    simplePricing: 'Tarification simple et transparente',
    pricingSubtitle: 'Gestion immobilière professionnelle qui évolue avec votre entreprise',
    professionalPlan: 'Plan professionnel',
    perfectForPropertyManagers: 'Parfait pour tous vos besoins de gestion',
    perDoorPerMonth: 'par porte par mois',
    noSetupFees: 'Aucun frais d\'installation',
    condoManagementPlan: 'Services de gestion de copropriété',
    condoManagementDescription: 'Solution complète de gestion de copropriété',
    rentalManagementPlan: 'Services de gestion locative',
    rentalManagementDescription: 'Gestion complète de propriété locative',
    applicationIncluded: 'Application incluse',
    pricingSubjectToChange: 'Tarification sujette à changement en tout temps',
    basedOnClientNeeds: 'selon les besoins du client',
    plusExpenses: '+ dépenses',
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
    unlimitedUsersDisclaimer: '*Koveo se réserve le droit de limiter le nombre d\'utilisateurs en cas d\'abus.',
    largeClientTitle: 'Vous gérez plus de 25 portes?',
    largeClientDescription: 'Nous offrons une tarification spéciale pour les grandes propriétés. Contactez-nous pour discuter d\'un tarif personnalisé selon la taille de votre portefeuille.',
    largeClientBenefit: 'Tarification préférentielle disponible - des taux inférieurs à notre tarification standard',
    largeClientCta: 'Contactez-nous pour une soumission',
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
    searchTypePlaceholder: 'Rechercher le type...',
    showingDemandsRange: 'Affichage de {start} à {end} sur {total} demandes',
    buildingField: 'Bâtiment :',
    residenceField: 'Résidence :',
    createdField: 'Créé :',
    unknownBuilding: 'Inconnu',
    loadingDemandsMessage: 'Chargement des demandes...',
    manageBuildingsOrganization: 'Gérer {count} bâtiments dans votre organisation',
    searchBuildingsAddress: 'Rechercher des bâtiments par nom ou adresse...',
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    save: 'Enregistrer',
    close: 'Fermer',
    edit: 'Modifier',
    delete: 'Supprimer',
    initializationProgress: 'Progrès d\'initialisation',
    coreQualityAssurance: 'Cadre d\'assurance qualité de base',
    workspaceStatus: 'Statut de l\'espace de travail',
    environmentSetup: 'Configuration de l\'environnement',
    setupValidationQualityAssurance: 'Configuration du cadre de validation et d\'assurance qualité',
    completedToday: 'Complété aujourd\'hui',
    availableAfterQACompletion: 'Disponible après l\'achèvement du pilier QA',
    moreActions: 'Plus d\'actions',
    enterEmailAddress: 'Entrez l\'adresse courriel',
    selectOrganization: 'Sélectionnez l\'organisation',
    require2FADescription: 'Exiger l\'authentification à deux facteurs pour cet utilisateur',
    personalMessageDescription: 'Ce message sera inclus dans le courriel d\'invitation',
    _error: 'Une erreur s\'est produite',
    bulkActionSuccessDescription: 'L\'action groupée a été complétée avec succès',
    selectUsersForBulkAction: 'Veuillez sélectionner des utilisateurs pour effectuer l\'action groupée',
    invitationSentDescription: 'L\'invitation a été envoyée avec succès à l\'utilisateur',
    userUpdatedSuccessfully: 'Utilisateur mis à jour avec succès',
    editUser: 'Modifier l\'utilisateur',
    updateUser: 'Mettre à jour l\'utilisateur',
    userDeletedSuccessfully: 'Utilisateur supprimé avec succès',
    joinedDate: 'Date d\'adhésion',
    deactivateUser: 'Désactiver l\'utilisateur',
    activateUser: 'Activer l\'utilisateur',
    deleteUser: 'Supprimer l\'utilisateur',
    editUserDescription: 'Mettre à jour les informations et permissions de l\'utilisateur',
    selectUser: 'Sélectionner l\'utilisateur {nom}',
    invitationLinkCopied: 'Lien d\'invitation copié dans le presse-papiers',
    invitationActions: 'Actions d\'invitation',
    selectSchedule: 'Sélectionner l\'horaire',
    failedToReviewDemand: 'Échec de l\'examen de la demande',
    addNotesReviewDecision: 'Ajouter des notes concernant votre décision d\'examen',
    addNotesReview: 'Ajouter des notes concernant l\'examen',
    organizationOverview: 'Aperçu de l\'organisation',
    viewManageResidences: 'Voir et gérer les résidences de l\'organisation',
    notAssignedResidences: 'Vous n\'êtes assigné à aucune résidence.',
    occupancyStats: 'Statistiques d\'occupation',
    unableToDisplayAmenities: 'Impossible d\'afficher les commodités',
    emailRequired: 'L\'adresse courriel est requise',
    unexpectedError: 'Une erreur inattendue s\'est produite - veuillez contacter le support si cela continue',
    saveFailed: 'Échec de l\'enregistrement des modifications - veuillez réessayer',
    deleteFailed: 'Échec de la suppression de l\'élément - veuillez réessayer',
    firstNameInvalidCharacters: 'Le prénom ne peut contenir que des lettres, espaces, apostrophes et traits d\'union',
    lastNameInvalidCharacters: 'Le nom de famille ne peut contenir que des lettres, espaces, apostrophes et traits d\'union',
    expiryDaysInvalid: 'Les jours d\'expiration doivent être entre 1 et 30 jours',
    emailOrNameRequired: 'L\'adresse courriel est requise pour les invitations régulières (exemple: utilisateur@domaine.com). Pour les utilisateurs de démonstration, fournissez le prénom et le nom de famille.',
    aiAnalysisWarning: 'Avertissement d\'analyse IA',
    lowConfidenceAIWarning: 'L\'analyse IA a une faible confiance :',
    enterStreetAddress: 'Entrez l\'adresse de rue',
    addressRequired: 'L\'adresse est requise',
    searchUnitTenant: 'Rechercher par numéro d\'unité ou nom du locataire...',
    unitNumber: 'Numéro d\'unité',
    adjustSearchCriteria: 'Essayez d\'ajuster vos critères de recherche',
    fromLastYear: 'de l\'année dernière',
    budgetAnalyticsChart: 'Le graphique d\'analyse budgétaire apparaîtrait ici',
    showMoreYears: 'Afficher plus d\'années',
    showFewerYears: 'Afficher moins d\'années',
    createDemandBehalf: 'Créer une demande au nom d\'un résident',
    editUserTitle: 'Modifier l\'utilisateur',
    organizationAssignmentsUpdated: 'Affectations d\'organisation mises à jour avec succès',
    anErrorOccurred: 'Une erreur s\'est produite',
    failedToCreateDemand: 'Échec de la création de la demande',
    firstNameInvalidChars: 'Le prénom ne peut contenir que des lettres, espaces, apostrophes et traits d\'union',
    lastNameInvalidChars: 'Le nom de famille ne peut contenir que des lettres, espaces, apostrophes et traits d\'union',
    roleRequired: 'Veuillez sélectionner un rôle d\'utilisateur',
    emailConfirmationRequired: 'La confirmation par courriel est requise pour supprimer l\'utilisateur',
    orgResidenceAssignments: 'Affectations d\'organisation et de résidence',
    notificationsActivity: 'Notifications et historique d\'activité',
    manageAccountSettings: 'Gérer votre compte et les paramètres de l\'application',
    username: 'Nom d\'utilisateur',
    exportFailed: 'Échec de l\'exportation',
    failedExportData: 'Échec de l\'exportation des données',
    reportTrackIssues: 'Signaler et suivre les problèmes de l\'application',
    today: 'Aujourd\'hui',
    failedSubmitIdea: 'Échec de la soumission de l\'idée',
    ideaUpdatedDescription: 'L\'idée de fonctionnalité a été mise à jour avec succès.',
    failedUpdateIdea: 'Échec de la mise à jour de l\'idée',
    ideaDeletedDescription: 'L\'idée de fonctionnalité a été supprimée avec succès.',
    failedDeleteIdea: 'Échec de la suppression de l\'idée',
    permissionsManagementDesc: 'Gérer les rôles d\'utilisateur et les permissions système',
    roleBasedAccessControl: 'Contrôle d\'Accès Basé sur les Rôles',
    userRoles: 'Rôles d\'utilisateur',
    userFeedbackSuggestions: 'Commentaires et suggestions d\'utilisateurs',
    auditLogs: 'Journaux d\'audit',
    rightToErasure: 'Droit à l\'effacement',
    privacyImpactAssessment: 'Évaluation de l\'impact sur la vie privée',
    roleAssignmentFailed: 'Échec de l\'affectation de rôle',
    operationFailed: 'Échec de l\'opération',
    timeoutError: 'Erreur de délai d\'attente',
    droitALOubli: 'Droit à l\'oubli',
    evaluationImpactViePrivee: 'Évaluation de l\'impact sur la vie privée',
    roleBasedAccess: 'Contrôle d\'accès basé sur les rôles',
    roleBasedAccessDesc: 'Système d\'autorisation granulaire garantissant que chaque utilisateur n\'accède qu\'aux informations nécessaires.',
    storyIntro: 'Découvrez l\'histoire derrière Koveo Gestion et notre mission de moderniser la gestion immobilière au Québec.',
    foundationDesc: 'Création de l\'entreprise avec la mission de moderniser la gestion immobilière au Québec.',
    startManagingToday: 'Commencez à gérer aujourd\'hui',
    buildingManagementDesc: 'Système complet de gestion des bâtiments et unités',
    expertSupport: 'Support expert',
    termsOfService: 'Conditions de service',
    noDocumentsUploadedYet: 'Aucun document n\'a encore été téléchargé pour cette résidence.',
    
    selectBuildingInventoryMessage: 'Veuillez sélectionner une organisation et un bâtiment pour voir son inventaire de maintenance.',
    inventoryManagementSubtitle: 'Gérez les éléments du bâtiment, les dossiers d\'entretien et la documentation des actifs dans votre portefeuille immobilier.',
    backToBuilding: 'Retour à',
    buildingElements: 'Éléments du bâtiment',
    toggleBuildingElementsTable: 'Basculer le tableau des éléments du bâtiment',
    searchElementsPlaceholder: 'Rechercher des éléments par nom, code UNIFORMAT ou description...',
    overdueEvaluations: 'Évaluations en retard',
    addElement: 'Ajouter un élément',
    allConditions: 'Toutes les conditions',
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Acceptable',
    poor: 'Mauvais',
    uniformatCategory: 'Catégorie UNIFORMAT',
    uniformatSubstructure: 'A - Infrastructure',
    uniformatShell: 'B - Enveloppe',
    uniformatInteriors: 'C - Aménagements intérieurs',
    uniformatServices: 'D - Services',
    uniformatEquipmentFurnishings: 'E - Équipements et ameublements',
    uniformatSpecialConstruction: 'F - Construction spéciale',
    uniformatBuildingSitework: 'G - Travaux de site du bâtiment',
    elementDocuments: 'Documents de l\'élément',
    uniformatBrowser: 'Navigateur UNIFORMAT',
    featureComingSoon: 'Fonctionnalité à venir',
    evaluationSchedulingComingSoon: 'La planification des évaluations sera disponible dans une mise à jour future.',
    elementImportComingSoon: 'La fonctionnalité d\'importation d\'éléments sera disponible dans une mise à jour future.',
    reportExportComingSoon: 'La fonctionnalité d\'exportation de rapports sera disponible dans une mise à jour future.',
    elementDeleted: 'Élément supprimé',
    elementDeletedSuccessfully: 'a été supprimé avec succès de l\'inventaire.',
    
    selectBuildingProjectsMessage: 'Veuillez sélectionner une organisation et un bâtiment pour voir ses projets de maintenance.',
    projectsMaintenanceManagement: 'Projets - Gestion de la maintenance',
    projectsManagementSubtitle: 'Gérez les projets de maintenance, suivez les progrès et coordonnez les horaires de travail',
    toggleProjectOverview: 'Basculer l\'aperçu des projets',
    projectsSelected: 'projet(s) sélectionné(s)',
    newProject: 'Nouveau projet',
    toggleProjectsTable: 'Basculer le tableau des projets',
    projectTable: 'Tableau des projets',
    projectStatus: 'Statut du projet',
    projectTimeline: 'Chronologie du projet',
    projectElements: 'Éléments du projet',
    projectNotes: 'Notes du projet',
    projectBudget: 'Budget du projet',
    projectCreated: 'Projet créé',
    projectUpdated: 'Projet mis à jour',
    projectUpdateFailed: 'Échec de la mise à jour du projet',
    projectDeleted: 'Projet supprimé',
    projectDeleteFailed: 'Échec de la suppression du projet',
    editProject: 'Modifier le projet',
    editProjectDescription: 'Modifiez les détails du projet ci-dessous.',
    confirmDeleteProject: 'Êtes-vous sûr de vouloir supprimer ce projet?',
    fillRequiredFields: 'Veuillez remplir tous les champs obligatoires.',
    projectCreatedSuccessfully: 'a été créé avec succès.',
    projectUpdatedSuccessfully: 'a été mis à jour avec succès.',
    projectsCreated: 'Projets créés',
    projectsCreatedFromSuggestions: 'projet(s) ont été créé(s) à partir des suggestions d\'évaluation.',
    projectCreatedSuccessfully2: 'Projet créé avec succès',
    autoProjectConvertedSuccess: 'a été converti en projet de maintenance.',
    statusUpdated: 'Statut mis à jour',
    projectStatusUpdatedSuccessfully: 'Le statut du projet a été mis à jour avec succès.',
    
    // Demand details translations
    demandDetails: 'Détails de la demande',
    escalateToManager: 'Escalader au gestionnaire',
    fileAttachment: 'Pièce jointe',
    view: 'Voir',
    download: 'Télécharger',
    location: 'Emplacement',
    reviewNotes: 'Notes de révision',
    addReviewNotes: 'Ajouter des notes de révision...',
    updated: 'Mis à jour :',
    comments: 'Commentaires',
    addAComment: 'Ajouter un commentaire...',
    addComment: 'Ajouter un commentaire',
    adding: 'Ajout...',
    noCommentsYet: 'Aucun commentaire pour le moment',
    commentsDisabledFor: 'Les commentaires sont désactivés pour les demandes {status}.',
    deleteDemand: 'Supprimer',
    confirmDeleteDemand: 'Êtes-vous sûr de vouloir supprimer cette demande?',
    demandUpdatedSuccessfully: 'Demande mise à jour avec succès',
    failedToUpdateDemand: 'Échec de la mise à jour de la demande',
    demandDeletedSuccessfully: 'Demande supprimée avec succès',
    failedToDeleteDemand: 'Échec de la suppression de la demande',
    commentAddedSuccessfully: 'Commentaire ajouté avec succès',
    failedToAddComment: 'Échec de l\'ajout du commentaire',
    underReviewStatus: 'En révision',
    approvedStatus: 'Approuvé',
    rejectedStatus: 'Rejeté',
    inProgressStatus: 'En cours',
    completedStatus: 'Terminé',
    cancelledStatus: 'Annulé',
    submittedStatus: 'Soumis',
    viewRelatedDocuments: 'Voir les documents associés',
    descriptionMinLengthError: 'La description doit contenir au moins 10 caractères (exemple : Le robinet de l\'évier de la cuisine fuit et nécessite une réparation)',
    descriptionMaxLengthError: 'La description doit contenir moins de 2000 caractères',
    reviewNotesMaxLengthError: 'Les notes de révision doivent contenir moins de 1000 caractères',
    commentMinLengthError: 'Le texte du commentaire est requis (minimum 1 caractère)',
    commentMaxLengthError: 'Le commentaire doit contenir moins de 1000 caractères',
    
    // Additional Bug Reports translation keys
    bugReportCreatedSuccessfully: 'Rapport de bogue créé avec succès',
    bugReportUpdatedSuccessfully: 'Rapport de bogue mis à jour avec succès',
    bugReportDeletedSuccessfully: 'Rapport de bogue supprimé avec succès',
    failedToCreateBugReport: 'Échec de la création du rapport de bogue',
    failedToUpdateBugReport: 'Échec de la mise à jour du rapport de bogue',
    failedToDeleteBugReport: 'Échec de la suppression du rapport de bogue',
    titleRequired: 'Le titre est requis',
    descriptionMinLength20: 'La description doit contenir au moins 20 caractères',
    pageLocationRequired: 'La page/localisation est requise',
    noBugsMatchFilters: 'Aucun bogue ne correspond à vos filtres actuels.',
    noBugReportsYet: 'Aucun rapport de bogue n\'a encore été soumis.',
    editBugReport: 'Modifier le rapport de bogue',
    bugReportDetails: 'Détails du rapport de bogue',
    areYouSureDeleteBugReport: 'Êtes-vous sûr de vouloir supprimer ce rapport de bogue?',
    savingChanges: 'Enregistrement...',
    fileAttached: 'Fichier joint',
    searchAndFilters: 'Recherche et filtres',
    categoryAndSort: 'Catégorie et tri',
    
    // Additional Idea Box translation keys
    mostUpvotes: 'Plus de votes',
    whyIsThisNeeded: 'Pourquoi est-ce nécessaire?',
    chooseDocumentType: 'Choisir le type de document',
    textDocument: 'Document texte',
    selectFileToUpload: 'Sélectionner le fichier à télécharger',
    attachScreenshot: 'Joindre une capture d\'écran, une maquette ou un document',
    addDetailedNotes: 'Ajouter des notes détaillées, des spécifications ou toute information supplémentaire...',
    thisWillShowAsAdditionalNotes: 'Ceci sera affiché comme notes supplémentaires avec votre idée',
    submitIdea: 'Soumettre l\'idée',
    editIdea: 'Modifier l\'idée',
    internalNotesVisibleAdmins: 'Notes internes (visibles aux administrateurs seulement)',
    currentAttachment: 'Pièce jointe actuelle',
    uploadNewFileToReplace: 'Télécharger un nouveau fichier pour remplacer la pièce jointe actuelle',
    updateIdea: 'Mettre à jour l\'idée',
    deleteIdea: 'Supprimer l\'idée',
    attachment: 'Pièce jointe',
    attachments: 'Pièces jointes',
    submittedOn: 'Soumis le',
    lastUpdatedOn: 'Dernière mise à jour le',
    featureTitlePlaceholder: 'p. ex. Ajouter l\'exportation en masse pour les documents',
    featureDescriptionPlaceholder: 'Décrivez votre idée de fonctionnalité en détail...',
    whyIsThisNeededPlaceholder: 'Expliquez le besoin spécifique que cette fonctionnalité répond...',
    pageLocationPlaceholder: 'p. ex. Gestion des documents',
    adminNotes: 'Notes administratives',
    search: 'Rechercher',
    noIdeasFound: 'Aucune idée trouvée',
    tryAdjustingSearchOrFilters: 'Essayez d\'ajuster votre recherche ou vos filtres.',
    getStartedBySubmittingFirstIdea: 'Commencez par soumettre votre première idée.',
    confirmDeleteIdea: 'Êtes-vous sûr de vouloir supprimer "{title}"? Cette action ne peut pas être annulée.',
    ideaSubmittedSuccessfully: 'Idée soumise avec succès',
    ideaUpdatedSuccessfully: 'Idée mise à jour avec succès',
    ideaDeletedSuccessfully: 'Idée supprimée avec succès',
    failedToSubmitIdea: 'Échec de la soumission de l\'idée',
    failedToUpdateIdea: 'Échec de la mise à jour de l\'idée',
    failedToDeleteIdea: 'Échec de la suppression de l\'idée',
    upvoteRecorded: 'Votre vote a été enregistré',
    failedToUpvote: 'Échec du vote',
    featureTitleRequired: 'Le titre de la fonctionnalité est requis',
    titleMaxLength200: 'Le titre doit contenir moins de 200 caractères',
    descriptionMinLength10: 'La description doit contenir au moins 10 caractères',
    descriptionMaxLength2000: 'La description doit contenir moins de 2000 caractères',
    needMinLength5: 'L\'explication du besoin doit contenir au moins 5 caractères',
    needMaxLength500: 'L\'explication du besoin doit contenir moins de 500 caractères',
    pageLocationMaxLength100: 'La localisation de la page doit contenir moins de 100 caractères',
    adminNotesMaxLength1000: 'Les notes d\'administration doivent contenir moins de 1000 caractères',
    
    // Common Filter Component translations
    filter: 'Filtrer',
    addFilter: 'Ajouter un filtre',
    selectField: 'Sélectionner un champ',
    searchFields: 'Rechercher des champs...',
    selectOperator: 'Sélectionner un opérateur',
    searchOperators: 'Rechercher des opérateurs...',
    selectValue: 'Sélectionner une valeur',
    searchValues: 'Rechercher des valeurs...',
    enterValue: 'Entrer une valeur',
    applyFilter: 'Appliquer le filtre',
    sort: 'Trier',
    clearSort: 'Effacer le tri',
    quickFilters: 'Filtres rapides',
    searchPresets: 'Rechercher des préréglages...',
    clearAll: 'Tout effacer',
    results: 'résultats',
    searchPlaceholder: 'Rechercher...',
    
    // Bills Payment Schedule translations
    markPaid: 'Marquer comme payé',
    noPaymentInformation: 'Aucune information de paiement',
    paidLabel: 'Payé',
    
    // Bill Category translations
    categoryAdministration: 'Administration',
    categoryCleaning: 'Nettoyage',
    categoryConstruction: 'Construction',
    categoryConsulting: 'Conseil',
    categoryEquipmentRental: 'Location d\'équipement',
    categoryLandscaping: 'Aménagement paysager',
    categoryLegalServices: 'Services juridiques',
    categoryProfessionalServices: 'Services professionnels',
    categoryRepairs: 'Réparations',
    categoryReserves: 'Réserves',
    categorySalary: 'Salaire',
    categorySecurity: 'Sécurité',
    categorySupplies: 'Fournitures',
    categoryTaxes: 'Taxes',
    categoryTechnology: 'Technologie',
    categoryUtilities: 'Services publics',
    
    // Bill Document Management translations
    attachedDocuments: 'Documents joints',
    noDocumentsAttached: 'Aucun document joint',
    clickAddDocumentToStart: 'Cliquez sur "Ajouter un document" pour commencer',
    documentDeleteFailed: 'Échec de la suppression du document',
    confirmDeleteDocumentMessage: 'Êtes-vous sûr de vouloir supprimer ce document? Cette action ne peut pas être annulée.',

    // Budget Page translations
    budgetFilters: 'Filtres budgétaires',
    budgetTrendAnalysisCard: 'Analyse des tendances budgétaires',
    budgetProjectManagement: 'Gestion de projets',
    budgetBankAccountConfig: 'Configuration du compte bancaire',
    budgetMinimumRequirementCard: 'Exigences minimales',
    budgetCustomBankAccountFields: 'Champs de compte bancaire personnalisés',
    budgetFieldName: 'Nom du champ',
    budgetFieldValue: 'Valeur du champ',
    budgetRevenueConfig: 'Configuration des revenus',
    budgetBillsConfig: 'Configuration des dépenses',
    budgetCapitalInvestmentScenarios: 'Scénarios d\'investissement en capital',
    budgetBackToBuilding: 'Retour au bâtiment',
    budgetAddInvestment: 'Ajouter un investissement',
    budgetEditInvestment: 'Modifier l\'investissement',
    budgetSaveChanges: 'Enregistrer les modifications',
    budgetAddQuickProject: 'Ajouter un projet rapide',
    budgetAddProject: 'Ajouter un projet',
    budgetRefresh: 'Actualiser',
    budgetAddCustomRevenueLine: 'Ajouter une ligne de revenus personnalisée',
    budgetRemoveRevenueLine: 'Supprimer',
    budgetRemoveInvestment: 'Supprimer',
    budgetConfirmInvestment: 'Confirmer',
    budgetStartingBalance: 'Solde de départ',
    budgetBalanceDate: 'Date du solde',
    budgetFinancialYearStart: 'Début de l\'exercice financier',
    budgetMinimumRequirementAmount: 'Minimum requis',
    budgetRevenueGrowthRate: 'Taux de croissance des revenus (%)',
    budgetMonthlyAmount: 'Montant mensuel ($)',
    budgetInflationRate: 'Taux d\'inflation',
    budgetGlobalInflation: 'Global',
    budgetPerCategoryInflation: 'Par catégorie',
    budgetUnplannedBills: 'Dépenses imprévues',
    budgetInvestmentTitle: 'Titre',
    budgetInvestmentDescription: 'Description',
    budgetInvestmentAmount: 'Montant ($)',
    budgetTargetDate: 'Date cible',
    budgetUrgencyLevel: 'Niveau d\'urgence',
    budgetProjectTitle: 'Titre du projet',
    budgetProjectBudget: 'Budget total',
    budgetProjectFinancialYear: 'Exercice financier',
    budgetProjectDescription: 'Description',
    budgetEnterAmount: 'Entrer le montant',
    budgetEnterTitle: 'Entrer le titre',
    budgetEnterDescription: 'Entrer la description',
    budgetOptionalDetails: 'Détails facultatifs sur l\'investissement',
    budgetEnterProjectTitle: 'Entrer le titre du projet',
    budgetOptionalProjectDescription: 'Description facultative du projet',
    budgetBankAccountSaveSuccess: 'Succès',
    budgetBankAccountSaveSuccessDesc: 'Paramètres du compte bancaire enregistrés avec succès',
    budgetBankAccountSaveFailed: 'Erreur',
    budgetBankAccountSaveFailedDesc: 'Échec de l\'enregistrement des paramètres du compte bancaire',
    budgetRevenueSaveSuccess: 'Succès',
    budgetRevenueSaveSuccessDesc: 'Configuration des revenus enregistrée avec succès',
    budgetRevenueSaveFailed: 'Erreur',
    budgetRevenueSaveFailedDesc: 'Échec de l\'enregistrement de la configuration des revenus',
    budgetBillsSaveSuccess: 'Succès',
    budgetBillsSaveSuccessDesc: 'Montant des dépenses imprévues enregistré avec succès',
    budgetBillsSaveFailed: 'Erreur',
    budgetBillsSaveFailedDesc: 'Échec de l\'enregistrement du montant des dépenses imprévues',
    budgetInvestmentsSaveSuccess: 'Succès',
    budgetInvestmentsSaveSuccessDesc: 'Investissements en capital enregistrés avec succès',
    budgetInvestmentsSaveFailed: 'Échec de l\'enregistrement des investissements en capital',
    budgetRefreshSuccess: 'Actualisation terminée',
    budgetRefreshSuccessDesc: 'Les données budgétaires ont été actualisées avec les dernières informations.',
    budgetRefreshFailed: 'Erreur d\'actualisation',
    budgetRefreshFailedDesc: 'Échec de l\'actualisation des données budgétaires. Veuillez réessayer.',
    budgetInvestmentAdded: 'Investissement ajouté',
    budgetInvestmentAddedDesc: '{title} a été ajouté au plan d\'investissement.',
    budgetInvestmentRemoved: 'Investissement supprimé',
    budgetInvestmentRemovedDesc: 'L\'investissement a été retiré du plan.',
    budgetInvestmentUpdated: 'Investissement mis à jour',
    budgetInvestmentUpdatedDesc: 'L\'investissement a été mis à jour avec succès.',
    budgetInvestmentConfirmed: 'Investissement confirmé',
    budgetInvestmentConfirmedDesc: 'L\'investissement a été confirmé et ajouté à votre plan permanent.',
    budgetQuickProjectAdded: 'Projet rapide ajouté',
    budgetQuickProjectAddedDesc: '"{title}" a été ajouté à votre liste de projets',
    budgetQuickProjectDeleted: 'Projet supprimé',
    budgetQuickProjectDeletedDesc: 'Le projet a été retiré de votre liste',
    budgetDeleteQuickProjectConfirm: 'Êtes-vous sûr de vouloir supprimer le projet "{title}"?',
    budgetInvalidAmount: 'Montant invalide',
    budgetInvalidAmountDesc: 'Veuillez entrer un nombre positif valide pour le montant mensuel.',
    budgetInvalidValue: 'Valeur invalide',
    budgetInvalidValueDesc: 'Veuillez entrer un nombre positif valide pour la valeur du champ.',
    budgetCannotRemoveAutoGenerated: 'Impossible de supprimer',
    budgetCannotRemoveAutoGeneratedDesc: 'Les investissements générés automatiquement ne peuvent pas être supprimés. Résolvez plutôt le problème budgétaire sous-jacent.',
    budgetCannotEditAutoGenerated: 'Impossible de modifier',
    budgetCannotEditAutoGeneratedDesc: 'Les investissements générés automatiquement ne peuvent pas être modifiés. Résolvez plutôt le problème budgétaire sous-jacent.',
    budgetValidationError: 'Erreur de validation',
    budgetFillAllFields: 'Veuillez remplir tous les champs obligatoires (Titre, Budget, Exercice financier)',
    budgetInvestmentNotFound: 'Erreur',
    budgetInvestmentNotFoundDesc: 'Investissement introuvable ou non généré automatiquement.',
    budgetCurrentBalanceApplied: 'Solde actuel appliqué',
    budgetCurrentBalanceAppliedDesc: 'Solde de départ défini à {amount}',
    budgetAddNewInvestment: 'Ajouter un nouvel investissement',
    budgetEditInvestmentTitle: 'Modifier l\'investissement',
    budgetAddQuickProjectTitle: 'Ajouter un projet rapide',
    budgetRevenue: 'Revenus',
    budgetSpending: 'Dépenses',
    budgetBalanceStartOfPeriod: 'Solde (début de période)',
    budgetBalanceEndOfPeriod: 'Solde (fin de période)',
    budgetNetCashFlow: 'Flux de trésorerie net',
    budgetCapitalInvestments: 'Investissements en capital',
    budgetMinimumRequirementLine: 'Exigences minimales',
    budgetMonthlyView: 'Vue mensuelle',
    budgetYearlyView: 'Vue annuelle',
    budgetMonth: 'Mois',
    budgetYear: 'Année',
    budgetShowing: 'Affichage :',
    budgetDisplaying: 'Affichage :',
    budgetOf: 'de',
    budgetSeriesVisible: 'séries visibles',
    budgetUrgent: 'Urgent',
    budgetNotUrgent: 'Non urgent',
    budgetSuggested: 'Suggéré',
    budgetAutoGenerated: 'Généré automatiquement',
    budgetQuickProjectBadge: 'Projet rapide',
    budgetCurrentBalance: 'Solde actuel',
    budgetMonthlyRevenue: 'Revenus mensuels',
    budgetMonthlySpending: 'Dépenses mensuelles',
    budgetYearEndProjection: 'Projection de fin d\'exercice',
    budgetTotalInvestment: 'Investissement total',
    budgetUseQuickProjectHelp: 'Utilisez "Ajouter un projet rapide" pour créer un nouveau projet',
    budgetConfirmAndMakePermanent: 'Confirmer et rendre permanent',
    budgetMonths: 'mois',
    budgetYears: 'années',
    budgetTotalMonthlyRevenue: 'Revenus mensuels totaux :',
    budgetTotalMonthlyExpenses: 'Dépenses mensuelles totales :',
    budgetMonthlyResidenceFees: 'Frais mensuels de résidence',
    budgetInflationRateMode: 'Mode de taux d\'inflation',
    budgetCategorySpecificInflationRates: 'Taux d\'inflation par catégorie (%)',
    budgetCapitalInvestmentStrategy: 'Stratégie d\'investissement en capital',
    budgetUrgentCapitalOnly: 'Capital urgent uniquement',
    budgetSuggestedPlusUrgent: 'Suggéré + Urgent',
    budgetAllInvestments: 'Tous les investissements',
    budgetUtilitiesInflation: 'Services publics',
    budgetMaintenanceInflation: 'Entretien',
    budgetGeneralInflation: 'Général',
    budgetOtherInflation: 'Autre',
    budgetTotalMinimumRequirement: 'Total des exigences minimales',
    budgetMinimumRequirementSummary: 'Ceci représente le total des fonds de réserve minimaux requis pour ce bâtiment',
    budgetSaveMinimumRequirement: 'Enregistrer les exigences minimales',
    budgetRequired: '*',
    budgetOptional: 'Facultatif',
    budgetIncludeInBudget: 'Inclure dans le budget',
    budgetActualCost: 'Réel',
    budgetNoProjectsFound: 'Aucun projet trouvé',
    budgetSaveBankAccountSettings: 'Enregistrer les paramètres du compte bancaire',
    budgetSaveRevenueConfiguration: 'Enregistrer la configuration des revenus',
    budgetSaveBillsConfiguration: 'Enregistrer la configuration des dépenses',
    budgetDescriptionPlaceholder: 'Description (facultatif)',
    budgetManageProjectsForCurrentYear: 'Gérer les projets pour l\'exercice en cours et futurs',
    budgetUrgentCapitalInjection: 'Injection de capital urgente',
    budgetSuggestedCapitalInjection: 'Injection de capital suggérée',
    budgetAutoGeneratedScenario: 'Scénario {mode} généré automatiquement pour maintenir le minimum requis en réserve ({amount})',
    
    // Capital Investment Scenarios (additional keys)
    budgetMonthlyPayment: 'Paiement mensuel',
    budgetNoPaymentNeeded: 'Aucun paiement nécessaire',
    budgetSuggestedCapital: 'Suggéré + Urgent',
    budgetSuggestedCapitalDesc: 'Inclure les investissements en capital suggérés et urgents',
    budgetUrgentCapitalOnlyDesc: 'Uniquement les investissements en capital urgents',
    budgetCustomMode: 'Mode personnalisé',
    budgetCustomModeDesc: 'Gérer les investissements manuellement',
    budgetNoAutomaticCapitalInjections: 'Aucune injection de capital automatique',
    budgetCapitalInvestmentStrategyHelp: 'Choisissez comment gérer les investissements en capital',
    budgetUrgentScenarioHelp: 'Suggère des investissements en capital uniquement lorsque le budget est projeté de tomber en dessous de 0$, empêchant l\'épuisement complet des fonds.',
    budgetSuggestedScenarioHelp: 'Suggère des investissements en capital pour empêcher le solde du compte de tomber en dessous du seuil minimum requis.',
    budgetCustomScenarioHelp: 'Aucune suggestion automatique d\'investissement en capital. Ajoutez et gérez manuellement les injections de capital selon les besoins.',
    budgetInvestmentTitlePlaceholder: 'Entrez le titre de l\'investissement',
    budgetInvestmentDescriptionPlaceholder: 'Entrez la description (facultatif)',
    budgetNoInvestmentsMatch: 'Aucun investissement ne correspond à vos filtres',
    budgetAddCustomInvestmentsHelp: 'Ajoutez des investissements personnalisés en utilisant le formulaire ci-dessus',
    
    // Bills Configuration
    budgetRecurrentBills: 'Factures récurrentes',
    budgetUniqueBills: 'Factures uniques',
    budgetInflationRateSettings: 'Paramètres de taux d\'inflation',
    budgetApplySameRateToAllBills: 'Appliquer le même taux à toutes les factures',
    budgetSetDifferentRatesPerCategory: 'Définir des taux différents par catégorie',
    budgetPerCategory: 'Par catégorie',
    budgetGlobal: 'Global',
    budgetGlobalBillsInflationRate: 'Taux d\'inflation global des factures (%)',
    budgetAppliedToAllBillCategories: 'Appliqué à toutes les catégories de factures',
    budgetUtilities: 'Services publics',
    budgetGeneral: 'Général',
    budgetSetDifferentInflationRates: 'Définir des taux d\'inflation différents',
    budgetUnplannedBillsMonthly: 'Factures imprévues (mensuelles)',
    budgetUnplannedBillsStartDate: 'Date de début des factures imprévues',
    budgetNextMonth: 'Mois prochain',
    budgetAdditionalBudgetUnexpected: 'Budget supplémentaire pour dépenses imprévues',
    
    // Punctual Revenue Growth
    budgetPunctualRevenueGrowth: 'Croissance ponctuelle des revenus',
    budgetPunctualRevenueGrowthDesc: 'Augmentations planifiées des frais de copropriété pour des années spécifiques',
    budgetPercentageIncrease: 'Pourcentage d\'augmentation (%)',
    budgetInflationIncluded: 'Inflation incluse',
    budgetInflationIncludedTooltip: 'Si activé, le taux d\'inflation des revenus réguliers ne sera pas appliqué pour cette année',
    budgetAddPunctualGrowth: 'Ajouter une croissance ponctuelle',
    budgetNoPunctualGrowth: 'Aucune croissance ponctuelle des revenus configurée',
    budgetDeletePunctualGrowth: 'Supprimer cette entrée de croissance ponctuelle',
    budgetInvalidYear: 'L\'année doit être dans le futur',
    budgetInvalidMonth: 'Veuillez sélectionner un mois valide',
    budgetYearAlreadyExists: 'Une croissance ponctuelle pour cette année existe déjà',
    budgetYearMonthAlreadyExists: 'Une croissance ponctuelle pour cette année et ce mois existe déjà',
    budgetRevenueConfigurationHelp: 'Guide de configuration des revenus',
    budgetRevenueGrowthRateHelp: 'Augmentation annuelle de base appliquée à tous les revenus chaque année, représentant l\'inflation régulière et les ajustements de coûts.',
    budgetPunctualRevenueGrowthHelp: 'Augmentations spécifiques des frais de copropriété prévues pour des mois et années particuliers, comme les évaluations spéciales ou les ajustements ponctuels de tarifs.',
    budgetInflationIncludedHelp: 'Lorsque activé, ce pourcentage de croissance ponctuelle tient déjà compte de l\'inflation. Le système n\'appliquera pas le taux de croissance des revenus régulier pour cette période spécifique.',
    budgetRevenueConfigNote: 'Les entrées de croissance ponctuelle remplacent le taux de croissance des revenus de base pour leurs périodes spécifiées.',
    budgetRevenueGrowthRateNote: 'Ce taux s\'applique annuellement à tous les revenus. Lorsqu\'une entrée de Croissance Ponctuelle a "Inflation incluse" activée, ce taux de base n\'est pas appliqué pour cette période spécifique.',
    selectMonth: 'Sélectionner le mois',
    selectDay: 'Sélectionner le jour',
    plannedDate: 'Date prévue',
    budgetHistoricalAverage: 'Moyenne historique',
    budgetNoDataAvailable: 'Aucune donnée disponible',
    budgetManualOverride: 'Saisie manuelle',
    budgetMonthlyExpenses: 'Dépenses mensuelles',
    
    // Revenue Configuration
    budgetResidenceRevenue: 'Revenus des résidences',
    loadingResidenceData: 'Chargement des données de résidence...',
    budgetResidenceDataLoadFailed: 'Échec du chargement des données de résidence',
    budgetRevenueCalculationIncomplete: 'Le calcul des revenus peut être incomplet',
    budgetActiveResidences: 'résidences actives',
    budgetPerMonth: 'par mois',
    budgetCustomRevenueSources: 'Sources de revenus personnalisées',
    budgetCustomRevenue: 'Revenus personnalisés',
    
    // Project Management
    budgetProjectsAffectingBudget: 'Projets affectant ce budget',
    budgetFinancialYearStartHelp: 'L\'exercice financier commence ce mois',
    budgetAddQuickProjectDescription: 'Brève description du projet',
    budgetTotalBudget: 'Budget total',
    budgetPleaseCompleteRequiredFields: 'Veuillez compléter tous les champs obligatoires',
    
    // General
    investment: 'Investissement',
    years: 'années',
    month: 'mois',
    increase: 'augmentation',
    validationError: 'Erreur de validation',
    notSet: 'Non défini',
    
    // Bill Payments
    payments: 'paiements',
    noPaymentsCurrentYear: 'Aucun paiement prévu pour l\'année financière en cours',
    noFiscalYearWarning: 'Aucune date de début d\'année fiscale n\'est configurée pour ce bâtiment. Veuillez la configurer dans les paramètres du bâtiment pour voir les étiquettes d\'année financière exactes.',
    
    // Additional missing translations
    balcony: 'Balcon',
    condition: 'Condition',
    contactAddedSuccessfully: 'Contact ajouté avec succès',
    contactDeletedSuccessfully: 'Contact supprimé avec succès',
    contactUpdatedSuccessfully: 'Contact mis à jour avec succès',
    deleteDocuments: 'Supprimer les documents',
    deleteDocumentsConfirmation: 'Êtes-vous sûr de vouloir supprimer les documents sélectionnés? Cette action est irréversible.',
    documentNotFound: 'Document non trouvé',
    errorLoadingBuildings: 'Erreur lors du chargement des immeubles',
    failedToLoadBuildingInformation: 'Échec du chargement des informations de l\'immeuble',
    inventoryManagement: 'Gestion de l\'inventaire',
    loadingDocuments: 'Chargement des documents...',
    noBuildingsAccess: 'Vous n\'avez pas accès à des immeubles',
    noMatchingBuildings: 'Aucun immeuble correspondant trouvé',
    noMatchingBuildingsDescription: 'Essayez de modifier vos critères de recherche',
    searchBuildingsByNameOrAddress: 'Rechercher des immeubles par nom ou adresse',
    updateBugReport: 'Mettre à jour le rapport de bogue',
    viewAccessibleBuildingsAndDocuments: 'Voir les immeubles et documents accessibles',

    // Features Page translations
    featuresPageTitle: 'Fonctionnalités complètes pour',
    featuresPageTitleHighlight: 'la gestion immobilière au Québec',
    featuresPageSubtitle: 'Découvrez toutes les fonctionnalités de notre plateforme conçue spécifiquement pour répondre aux besoins des gestionnaires immobiliers et résidents du Québec.',
    featuresPageTryNow: 'Essayer maintenant',
    featuresPageStartNow: 'Commencer maintenant',
    featuresCoreFeaturesTitle: 'Fonctionnalités principales',
    featuresCoreFeaturesSubtitle: 'Quatre piliers essentiels pour une gestion immobilière efficace et conforme au Québec.',
    featuresAdvancedTitle: 'Fonctionnalités avancées',
    featuresAdvancedSubtitle: 'Outils complémentaires pour optimiser votre gestion immobilière quotidienne.',
    featuresComplianceTitle: 'Conformité réglementaire québécoise',
    featuresComplianceSubtitle: 'Notre plateforme respecte toutes les exigences légales et réglementaires du Québec.',
    featuresReadyToTransform: 'Prêt à transformer votre gestion immobilière?',
    featuresJoinManagers: 'Rejoignez les gestionnaires immobiliers du Québec qui font confiance à Koveo Gestion pour leurs besoins de gestion immobilière.',
    featuresBuildingManagementTitle: 'Gestion de bâtiments complète',
    featuresBuildingManagementDesc: 'Supervisez tous vos bâtiments avec suivi des maintenances, gestion des résidents, et surveillance de la conformité réglementaire québécoise.',
    featuresBuildingManagement1: 'Suivi des maintenances préventives et correctives',
    featuresBuildingManagement2: 'Gestion des espaces communs',
    featuresBuildingManagement3: 'Surveillance de la conformité québécoise',
    featuresBuildingManagement4: 'Rapports de performance des bâtiments',
    featuresResidentPortalTitle: 'Portail résident autonome',
    featuresResidentPortalDesc: 'Portail en libre-service pour les résidents afin de consulter les factures, soumettre des demandes, et communiquer avec la gestion immobilière.',
    featuresResidentPortal1: 'Consultation des factures et paiements en ligne',
    featuresResidentPortal2: 'Soumission de demandes de maintenance',
    featuresResidentPortal3: 'Communication directe avec la gestion',
    featuresResidentPortal4: 'Historique des interactions et documents',
    featuresFinancialReportsTitle: 'Rapports financiers détaillés',
    featuresFinancialReportsDesc: 'Analyses financières approfondies, suivi budgétaire, et rapports conformes aux réglementations québécoises pour la transparence.',
    featuresFinancialReports1: 'Tableaux de bord financiers en temps réel',
    featuresFinancialReports2: 'Suivi budgétaire et prévisions',
    featuresFinancialReports3: 'Rapports conformes aux normes québécoises',
    featuresFinancialReports4: 'Analyses de rentabilité par propriété',
    featuresLaw25Title: 'Conformité Loi 25 du Québec',
    featuresLaw25Desc: 'Conformité intégrée à la Loi 25 du Québec et aux réglementations de gestion immobilière. Protection des données garantie.',
    featuresLaw251: 'Protection des données selon la Loi 25',
    featuresLaw252: 'Conformité aux réglementations immobilières',
    featuresLaw253: 'Audit de sécurité régulier',
    featuresLaw254: 'Gestion des consentements et de la vie privée',
    featuresProjectMgmtTitle: 'Gestion de projets',
    featuresProjectMgmtDesc: 'Planifiez, suivez et gérez les projets de maintenance avec intégration budgétaire et visualisation des échéanciers.',
    featuresProjectMgmt1: 'Planification et programmation des projets de maintenance',
    featuresProjectMgmt2: 'Suivi budgétaire et gestion des coûts',
    featuresProjectMgmt3: 'Échéanciers et mises à jour de statut des projets',
    featuresProjectMgmt4: 'Intégration avec les prévisions financières',
    featuresDocMgmtTitle: 'Gestion documentaire',
    featuresDocMgmtDesc: 'Stockage sécurisé et organisation de tous vos documents immobiliers',
    featuresDocMgmt1: 'Stockage cloud sécurisé',
    featuresDocMgmt2: 'Partage de documents',
    featuresDocMgmt3: 'Versions et historique',
    featuresNotificationsTitle: 'Notifications intelligentes',
    featuresNotificationsDesc: 'Alertes automatiques pour maintenances, paiements et événements importants',
    featuresNotifications1: 'Alertes personnalisables',
    featuresNotifications2: 'Notifications par courriel',
    featuresNotifications3: 'Rappels automatiques',
    featuresBillingTitle: 'Facturation électronique',
    featuresBillingDesc: 'Système de facturation numérique pour suivre les paiements',
    featuresBilling1: 'Factures électroniques',
    featuresBilling2: 'Suivi des paiements',
    featuresBilling3: 'Historique des factures',
    featuresCommTitle: 'Communication centralisée',
    featuresCommDesc: 'Plateforme de communication unifiée entre gestionnaires et résidents',
    featuresComm1: 'Messages intégrés',
    featuresComm2: 'Suivi des conversations',
    featuresComm3: 'Communication de masse',
    featuresPlanningTitle: 'Planification des maintenances',
    featuresPlanningDesc: 'Système de planification intelligent pour l\'entretien des propriétés',
    featuresPlanning1: 'Calendrier intégré',
    featuresPlanning2: 'Programmation récurrente',
    featuresPlanning3: 'Suivi des interventions',
    featuresProcessTitle: 'Gestion des processus',
    featuresProcessDesc: 'Outils pour organiser et gérer les processus de gestion immobilière',
    featuresProcess1: 'Flux de travail organisés',
    featuresProcess2: 'Règles de gestion',
    featuresProcess3: 'Configuration système',
    featuresCompLaw25Title: 'Loi 25 - Protection des renseignements personnels',
    featuresCompLaw25Desc: 'Conformité complète aux exigences de protection des données personnelles du Québec',
    featuresCompCondoTitle: 'Réglementation de la copropriété',
    featuresCompCondoDesc: 'Respect des lois québécoises sur la gestion des copropriétés et syndicats',
    featuresCompFinancialTitle: 'Normes de transparence financière',
    featuresCompFinancialDesc: 'Rapports financiers conformes aux exigences québécoises de transparence',
    featuresCompBilingualTitle: 'Accessibilité et bilinguisme',
    featuresCompBilingualDesc: 'Interface bilingue français-anglais et conformité aux normes d\'accessibilité',

    // Home Page Feature Card Popup translations
    learnMore: 'En savoir plus',
    viewSecurityDetails: 'Voir les détails de sécurité',

    // Terms of Service Page
    termsPageTitle: 'Conditions d\'utilisation',
    termsLastUpdated: 'Dernière mise à jour : Janvier 2025',
    termsIntro: 'Ces conditions d\'utilisation régissent votre accès et votre utilisation de la plateforme Koveo Gestion, un service de gestion immobilière conçu pour le marché québécois.',
    termsSection1Title: '1. Acceptation des conditions',
    termsSection1Content: 'En accédant ou en utilisant notre plateforme, vous acceptez d\'être lié par ces conditions d\'utilisation et notre politique de confidentialité. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser nos services.',
    termsSection2Title: '2. Description du service',
    termsSection2Intro: 'Koveo Gestion fournit une plateforme de gestion immobilière comprenant :',
    termsServiceItem1: 'Gestion de bâtiments et de résidences',
    termsServiceItem2: 'Portail résident pour communications et paiements',
    termsServiceItem3: 'Outils de suivi financier et de rapports',
    termsServiceItem4: 'Gestion documentaire sécurisée',
    termsServiceItem5: 'Fonctionnalités de conformité québécoise',
    termsSection3Title: '3. Comptes utilisateur',
    termsSection3Intro: 'Pour utiliser notre service, vous devez :',
    termsAccountItem1: 'Créer un compte avec des informations exactes et à jour',
    termsAccountItem2: 'Maintenir la sécurité de vos identifiants de connexion',
    termsAccountItem3: 'Nous informer immédiatement de tout accès non autorisé',
    termsAccountItem4: 'Être responsable de toutes les activités sous votre compte',
    termsAccountItem5: 'Respecter les lois applicables du Québec et du Canada',
    termsSection4Title: '4. Utilisation acceptable',
    termsSection4Intro: 'Vous vous engagez à ne pas :',
    termsUseItem1: 'Utiliser le service à des fins illégales ou non autorisées',
    termsUseItem2: 'Tenter d\'accéder aux comptes d\'autres utilisateurs',
    termsUseItem3: 'Interférer avec le fonctionnement du service',
    termsUseItem4: 'Télécharger ou transmettre des virus ou codes malveillants',
    termsUseItem5: 'Violer les droits de propriété intellectuelle',
    termsUseItem6: 'Harceler ou nuire à d\'autres utilisateurs',
    termsSection5Title: '5. Propriété intellectuelle',
    termsSection5Content: 'Koveo Gestion et ses concédants détiennent tous les droits de propriété intellectuelle relatifs au service, y compris les logiciels, contenus, marques et designs. Vous conservez la propriété de vos données, mais nous accordez une licence d\'utilisation nécessaire pour fournir le service.',
    termsSection6Title: '6. Confidentialité et données',
    termsSection6Content: 'Notre traitement de vos données personnelles est régi par notre politique de confidentialité, qui respecte la Loi 25 du Québec. Vous vous engagez à respecter la confidentialité des informations d\'autres utilisateurs auxquelles vous pourriez avoir accès.',
    termsSection7Title: '7. Paiements et facturation',
    termsSection7Intro: 'Les conditions de paiement comprennent :',
    termsPaymentItem1: 'Les frais sont facturés selon votre plan d\'abonnement choisi',
    termsPaymentItem2: 'Le paiement est dû à l\'avance pour chaque période de facturation',
    termsPaymentItem3: 'Les taxes applicables s\'ajoutent aux frais d\'abonnement',
    termsPaymentItem4: 'Le non-paiement peut entraîner la suspension du service',
    termsPaymentItem5: 'Les remboursements sont accordés selon notre politique de remboursement',
    termsSection8Title: '8. Disponibilité du service',
    termsSection8Content: 'Nous nous efforçons de maintenir une haute disponibilité du service, mais ne garantissons pas un accès ininterrompu. Nous pouvons effectuer des maintenances programmées avec préavis raisonnable.',
    termsSection9Title: '9. Limitation de responsabilité',
    termsSection9Content: 'Dans les limites permises par la loi québécoise, notre responsabilité est limitée au montant payé pour le service au cours des 12 derniers mois. Nous ne sommes pas responsables des dommages indirects, consécutifs ou punitifs.',
    termsSection10Title: '10. Résiliation',
    termsSection10Intro: 'Vous pouvez résilier votre compte à tout moment. Nous pouvons suspendre ou résilier votre accès en cas de :',
    termsTerminationItem1: 'Violation de ces conditions d\'utilisation',
    termsTerminationItem2: 'Non-paiement des frais dus',
    termsTerminationItem3: 'Activité frauduleuse ou illégale',
    termsTerminationItem4: 'Cessation du service (avec préavis de 30 jours)',
    termsSection11Title: '11. Droit applicable',
    termsSection11Content: 'Ces conditions sont régies par les lois du Québec et du Canada. Tout différend sera soumis à la juridiction exclusive des tribunaux du Québec.',
    termsSection12Title: '12. Modifications',
    termsSection12Content: 'Nous nous réservons le droit de modifier ces conditions occasionnellement. Les modifications importantes seront communiquées par courriel avec un préavis de 30 jours.',
    termsSection13Title: '13. Contact',
    termsSection13Intro: 'Pour toute question concernant ces conditions d\'utilisation :',
    termsContactInfo: 'Service client Koveo Gestion\nCourriel : info@koveo-gestion.com\nTéléphone : 1-514-712-8441\nAdresse : Montréal, Québec, Canada',

    // Enterprise Page
    enterprise: 'Entreprise',
    enterprisePageTitle: 'Améliorez l\'efficacité de votre entreprise',
    enterprisePageSubtitle: 'Une solution complète de gestion immobilière conçue pour les entreprises qui souhaitent faire croître leurs opérations.',
    enterpriseVersatilityTitle: 'Une plateforme, plusieurs types de propriétés',
    enterpriseVersatilityDesc: 'Notre solution s\'adapte à tous les types de gestion immobilière.',
    enterpriseRentals: 'Logements locatifs',
    enterpriseCondos: 'Copropriétés',
    enterpriseRentalsDesc: 'Gestion complète des unités locatives : baux, loyers, maintenance et communication avec les locataires.',
    enterpriseCondosDesc: 'Gestion de syndicats, charges communes, assemblées et conformité aux règlements de copropriété.',
    enterpriseWhiteLabelTitle: 'Solution Marque Blanche',
    enterpriseWhiteLabelDesc: 'Offrez la plateforme sous votre propre marque.',
    enterpriseWhiteLabelExplanation: 'Marque Blanche signifie que vous pouvez personnaliser l\'application avec votre propre logo, vos couleurs et votre marque pour l\'offrir à vos clients comme s\'il s\'agissait de votre propre produit.',
    enterpriseWhiteLabelBenefit1: 'Renforcez votre identité de marque',
    enterpriseWhiteLabelBenefit2: 'Fidélisez vos clients',
    enterpriseWhiteLabelBenefit3: 'Démarquez-vous de la concurrence',
    enterprisePricingTitle: 'Prix dégressifs selon le volume',
    enterprisePricingDesc: 'Plus vous gérez de propriétés, plus vous économisez.',
    enterprisePriceTier1: '10 $ CAD',
    enterprisePriceTier1Desc: 'Jusqu\'à 99 portes',
    enterprisePriceTier2: '8 $ CAD',
    enterprisePriceTier2Desc: '100+ portes',
    enterprisePriceTier3: '6 $ CAD',
    enterprisePriceTier3Desc: '500+ portes',
    enterprisePriceTier4: 'Sur devis',
    enterprisePriceTier4Desc: '1000+ portes',
    enterpriseJuniorTitle: 'Gestionnaires juniors',
    enterpriseJuniorDesc: 'Vous débutez dans la gestion immobilière?',
    enterpriseJuniorBenefit: 'Obtenez vos premières portes gratuitement pour lancer votre entreprise et bâtir votre portefeuille.',
    enterpriseAdvantagesTitle: 'Avantages entreprises',
    enterpriseAdvantage1: 'Centralisation multi-propriétés',
    enterpriseAdvantage1Desc: 'Gérez toutes vos propriétés depuis un seul tableau de bord.',
    enterpriseAdvantage2: 'Rapports consolidés',
    enterpriseAdvantage2Desc: 'Vue d\'ensemble financière et opérationnelle complète de votre portefeuille.',
    enterpriseAdvantage3: 'Support dédié',
    enterpriseAdvantage3Desc: 'Accès prioritaire à notre équipe d\'experts.',
    enterpriseContactTitle: 'Demander un devis',
    enterpriseContactDesc: 'Contactez-nous pour discuter de vos besoins spécifiques et obtenir une offre personnalisée.',
    enterpriseContactEmail: 'Courriel',
    enterpriseContactPhone: 'Téléphone',
    enterpriseRequestQuote: 'Demander un devis',
    enterprisePerDoor: 'par porte',
    enterprisePerMonth: 'par mois',
    documentLinkCreatedTitle: 'Documents liés',
    documentLinkCreatedDesc: 'La séquence de documents a été mise à jour.',
    documentLinkErrorTitle: 'Impossible de lier les documents',
    documentLinkErrorDesc: 'Veuillez réessayer.',
    linkPreviousDocumentTitle: 'Lier le document précédent',
    linkNextDocumentTitle: 'Lier le document suivant',
    linkDocumentPickerDescription: 'Choisissez un document à enchaîner dans votre séquence de lecture. Les suggestions sont classées par pertinence.',
    linkDocumentSearchPlaceholder: 'Rechercher par nom…',
    linkDocumentNoCandidates: 'Aucun document correspondant dans ce périmètre.',
    linkExplainSharedCategory: 'Même catégorie',
    linkExplainSharedTags: 'Étiquettes communes',
    linkExplainCloseInTime: 'Date proche',
    linkedBadge: 'Lié',
    byDateBadge: 'Par date',
    addPreviousDocument: 'Lier précédent',
    addNextDocument: 'Lier suivant',
    editPreviousLink: 'Modifier le lien précédent',
    editNextLink: 'Modifier le lien suivant',
    linkPositionLabel: 'Lier comme',
  }
};