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
  firstDocumentOfChain: string;
  lastDocumentOfChain: string;
  linkPositionLabel: string;
  chainPanelTitle: string;
  chainPanelEmpty: string;
  chainCurrentBadge: string;
  chainRemoveAction: string;
  chainDragHandleLabel: string;
  chainReorderErrorTitle: string;
  chainRemoveSuccessTitle: string;
  chainRemoveErrorTitle: string;
  notFoundTitle: string;
  notFoundMessage: string;
  // Project workflow status names (used by ProjectForm select & StatusStepper)
  projectStatusPlanned: string;
  projectStatusEvaluation: string;
  projectStatusSubmissionStage: string;
  projectStatusPreWorkStage: string;
  projectStatusInProgressStage: string;
  projectStatusPostWorkStage: string;
  projectStatusCompletedStage: string;
  projectStatusPlannedDesc: string;
  projectStatusEvaluationDesc: string;
  projectStatusSubmissionDesc: string;
  projectStatusPreWorkDesc: string;
  projectStatusInProgressDesc: string;
  projectStatusPostWorkDesc: string;
  projectStatusCompletedDesc: string;
  // ProjectForm modal labels and copy
  projectFormCreateNewTitle: string;
  projectFormCreateFromSuggestionTitle: string;
  projectFormEditTitle: string;
  projectFormCreateDescription: string;
  projectFormEditDescription: string;
  projectFormSubmitCreate: string;
  projectFormSubmitUpdate: string;
  projectFormCreatingFromSuggestionTitle: string;
  projectFormCreatingFromSuggestionDesc: string;
  projectFormQuickProjectDesc: string;
  projectFormTitleLabel: string;
  projectFormTitlePlaceholder: string;
  projectFormTitleDesc: string;
  projectFormDescriptionLabel: string;
  projectFormOptional: string;
  projectFormDescriptionPlaceholderQuick: string;
  projectFormDescriptionDescQuick: string;
  projectFormBudgetLabel: string;
  projectFormBudgetDescQuick: string;
  projectFormFinancialYearLabel: string;
  projectFormFinancialYearDescQuick: string;
  projectFormFinancialYearDescStandard: string;
  projectFormProjectDateLabel: string;
  projectFormProjectDateDesc: string;
  projectFormProjectNumberLabel: string;
  projectFormProjectNumberPlaceholder: string;
  projectFormProjectNumberDesc: string;
  projectFormProjectTitleLabel: string;
  projectFormDescriptionPlaceholderStandard: string;
  projectFormDescriptionDescStandard: string;
  projectFormPlannedStartDateLabel: string;
  projectFormPlannedStartDateDesc: string;
  projectFormTotalBudgetLabel: string;
  projectFormTotalBudgetDesc: string;
  projectFormActualCostLabel: string;
  projectFormActualCostDesc: string;
  projectFormToastBuildingIdRequired: string;
  projectFormToastPermissionDenied: string;
  projectFormToastNoCreatePermission: string;
  projectFormToastNoEditPermission: string;
  projectFormToastCreatedTitle: string;
  projectFormToastUpdatedTitle: string;
  projectFormToastCreatedDesc: string;
  projectFormToastUpdatedDesc: string;
  projectFormToastCreationFailed: string;
  projectFormToastUpdateFailed: string;
  projectFormToastErrorOccurred: string;
  // StatusStepper copy
  statusStepperLabel: string;
  statusStepperPercentComplete: string;
  statusStepperClickToAdvance: string;
  statusStepperLastUpdated: string;
  statusStepperToastUpdatedTitle: string;
  statusStepperToastUpdatedDesc: string;
  statusStepperToastUpdateFailed: string;
  statusStepperToastUpdateFailedDesc: string;
  statusStepperToastPermissionDenied: string;
  statusStepperConfirmTitle: string;
  statusStepperConfirmDesc: string;
  statusStepperConfirmCompletedNote: string;
  statusStepperUpdating: string;
  statusStepperConfirm: string;
  statusStepperAdvanceTo: string;
  statusStepperReturnTo: string;
  // Workflow tabs (PlannedTab and shared)
  plannedTabCurrentStatus: string;
  plannedTabNoBuildingElementsAvailable: string;
  plannedTabBuildingElementsLoading: string;
  plannedTabBuildingElementsNotFound: string;
  plannedTabCreateNewElement: string;
  plannedTabElementCreatedSuccessTitle: string;
  plannedTabElementCreatedSuccessDesc: string;
  reopenStepTrigger: string;
  reopenStepDialogTitle: string;
  reopenStepDialogDescription: string;
  reopenStepStatusPlanning: string;
  reopenStepStatusVendorSubmission: string;
  reopenStepStatusPreWork: string;
  reopenStepStatusInProgress: string;
  reopenStepStatusPostWork: string;
  reopenStepStatusCompleted: string;
  reopenStepSelectTargetTitle: string;
  reopenStepSelectTargetDesc: string;
  reopenStepLoadTargetsFailed: string;
  reopenStepNoTargetsAvailable: string;
  reopenStepTargetPhaseLabel: string;
  reopenStepLoadingPhasesPlaceholder: string;
  reopenStepSelectPhasePlaceholder: string;
  reopenStepReasonLabel: string;
  reopenStepReasonPlaceholder: string;
  reopenStepNoteLabel: string;
  reopenStepNoteBody: string;
  reopenStepReopening: string;
  reopenStepReopenToPhase: string;
  reopenStepSuccessTitle: string;
  reopenStepSuccessDesc: string;
  reopenStepFailedTitle: string;
  reopenStepFailedDesc: string;
  cannotReopenStepTitle: string;
  failedToReopenStepTitle: string;
  reopenStepWorkflowDataUnavailableDesc: string;
  reopenStepWrongPhaseSubmissionDesc: string;
  reopenStepWrongPhasePostWorkDesc: string;
  reopenStepReturnedSuccessDesc: string;
  plannedTabHeader: string;
  plannedTabSubheader: string;
  plannedTabDescriptionLabel: string;
  plannedTabDescriptionPlaceholder: string;
  plannedTabDescriptionHelp: string;
  plannedTabStartDateLabel: string;
  plannedTabStartDateHelp: string;
  plannedTabEstimatedCostLabel: string;
  plannedTabEstimatedCostHelp: string;
  plannedTabFinancialYearLabel: string;
  plannedTabFinancialYearHelp: string;
  plannedTabBuildingElementsPlaceholder: string;
  plannedTabBuildingElementsLoadingPlaceholder: string;
  plannedTabBuildingElementsSearchPlaceholder: string;
  plannedTabBuildingElementsHelp: string;
  plannedTabSuccessTitle: string;
  plannedTabSuccessDesc: string;
  plannedTabWarningTitle: string;
  plannedTabElementsUpdateWarningDesc: string;
  workflowNextLabel: string;
  workflowSavingButton: string;
  workflowSaveChangesButton: string;
  workflowCompletingButton: string;
  workflowCompletePlanningPhaseButton: string;
  workflowAllTasksCompleted: string;
  workflowErrorTitle: string;
  workflowSuccessTitle: string;
  postWorkProjectDataMissing: string;
  postWorkFailedUpdateConfirmation: string;
  postWorkAllElementsConfirmedDesc: string;
  postWorkFailedConfirmAll: string;
  postWorkAllChangesSavedDesc: string;
  postWorkFailedSaveSomeChanges: string;
  postWorkFailedApplyInventoryChangesDesc: string;
  postWorkCompletionFailedTitle: string;
  postWorkFailedMarkCompleteDesc: string;
  postWorkUnexpectedErrorDesc: string;
  postWorkActivitiesHeader: string;
  postWorkActivitiesSubheader: string;
  postWorkSkippableInfo: string;
  autoGeneratedProjectTitle: string;
  autoGeneratedProjectDesc: string;
  postWorkTasksTitle: string;
  postWorkTasksDesc: string;
  postWorkCompletedCounter: string;
  postWorkAddTaskButton: string;
  postWorkNoTasksDefined: string;
  postWorkAddCleanupTasksHint: string;
  postWorkTaskDescriptionPlaceholder: string;
  postWorkTaskDoneLabel: string;
  postWorkTaskPendingLabel: string;
  postWorkElementLifespanImpactTitle: string;
  postWorkElementLifespanImpactDesc: string;
  postWorkConfirmedCounter: string;
  postWorkConfirmAllButton: string;
  postWorkNoElementsLinked: string;
  postWorkElementsMustBeAddedDuringPlanning: string;
  postWorkUnknownElement: string;
  postWorkNoCode: string;
  postWorkPlannedWork: string;
  postWorkConfirmedBadge: string;
  postWorkInterventionTypeLabel: string;
  postWorkSelectInterventionTypePlaceholder: string;
  postWorkInterventionNoWork: string;
  postWorkInterventionRepair: string;
  postWorkInterventionMinorRehab: string;
  postWorkInterventionMajorRehab: string;
  postWorkInterventionReplacement: string;
  postWorkSuggestedStandardLifespanLabel: string;
  postWorkYearsCount: string;
  postWorkYearsUnit: string;
  postWorkUniformatStandardLifespanHelp: string;
  postWorkRemainingLifespanBeforeLabel: string;
  postWorkNotSpecified: string;
  postWorkUniformatStandardWithExtension: string;
  postWorkLifespanImpactYearsLabel: string;
  postWorkSuggestedValue: string;
  postWorkYearsAddedToRemainingLifespan: string;
  postWorkImpactSummaryLabel: string;
  postWorkThisWorkWill: string;
  postWorkSetLifespanToYearsTemplate: string;
  postWorkAddYearsToLifespanTemplate: string;
  postWorkNotChangeRemainingLifespan: string;
  postWorkElementConfirmationsLabel: string;
  postWorkAllElementsConfirmed: string;
  postWorkProgressSummaryTitle: string;
  postWorkTasksCompletedLabel: string;
  postWorkMarkProjectCompleteButton: string;
  postWorkCompleteAllTasksToProceed: string;
  postWorkConfirmAllElementsToProceed: string;
  postWorkConfirmProjectCompletionTitle: string;
  postWorkConfirmProjectCompletionDesc: string;
  postWorkFollowingChangesWillBeApplied: string;
  postWorkWillBeMarkedAsReplaced: string;
  postWorkNewLifespanLine: string;
  postWorkCurrentLifespanWillBeExtendedBy: string;
  postWorkInterventionTypeLine: string;
  postWorkNoChangesWillBeApplied: string;
  postWorkTheseChangesCannotBeUndone: string;
  postWorkConfirmAndCompleteProjectButton: string;
  postWorkCompletingButton: string;
  submissionProjectDataMissing: string;
  submissionUploadInProgressTitle: string;
  submissionUploadInProgressSaveDesc: string;
  submissionUploadInProgressSubmitDesc: string;
  submissionUploadFailedTitle: string;
  submissionUploadFailedDescTemplate: string;
  submissionManagementHeader: string;
  submissionManagementSubheader: string;
  submissionVendorSubmissionsHeader: string;
  submissionVendorSubmissionsSubheader: string;
  submissionElementManagementTab: string;
  submissionAddSubmissionButton: string;
  submissionVendorSubmittedDate: string;
  submissionEditButton: string;
  submissionDeleteButton: string;
  submissionPreferredBadge: string;
  submissionDeleteVendorConfirmTitle: string;
  submissionDeleteVendorConfirmDesc: string;
  submissionEditVendorTitle: string;
  submissionAddSubmissionDescriptionSr: string;
  submissionEditDialogDescription: string;
  submissionAddNewVendorTitle: string;
  submissionVendorNameLabel: string;
  submissionVendorNamePlaceholder: string;
  submissionAvailableDateLabel: string;
  submissionDescriptionLabel: string;
  submissionDescriptionPlaceholder: string;
  submissionPaymentPlanHeader: string;
  submissionPaymentTypeLabel: string;
  submissionSelectPaymentTypePlaceholder: string;
  submissionPaymentTypeOneTime: string;
  submissionPaymentTypeRecurring: string;
  submissionTotalAmountLabel: string;
  submissionPaymentDateLabel: string;
  submissionPaymentScheduleLabel: string;
  submissionSelectPaymentSchedulePlaceholder: string;
  submissionScheduleWeekly: string;
  submissionScheduleMonthly: string;
  submissionScheduleQuarterly: string;
  submissionScheduleYearly: string;
  submissionScheduleCustom: string;
  submissionDateFirstPaymentLabel: string;
  submissionDateEndPaymentLabel: string;
  submissionHasInitialPaymentLabel: string;
  submissionInitialPaymentAmountLabel: string;
  submissionEqualRecurringLabel: string;
  submissionRecurringPaymentAmountLabel: string;
  submissionCustomPaymentAmountsLabel: string;
  submissionCustomPaymentAmountSubLabel: string;
  submissionCustomPaymentDateSubLabel: string;
  submissionCustomPaymentDescriptionSubLabel: string;
  submissionCustomPaymentDescriptionPlaceholder: string;
  submissionMarkAsPreferredLabel: string;
  submissionMarkAsPreferredVendorLabel: string;
  submissionNoVendorSubmissionsHeader: string;
  submissionProposalDetailsHeader: string;
  submissionNoDescriptionProvided: string;
  submissionPaymentBreakdownLabel: string;
  submissionContactInformationHeader: string;
  submissionVendorNameLabelEdit: string;
  submissionContactInformationLabel: string;
  submissionContactInformationPlaceholder: string;
  submissionDescriptionPlaceholderEdit: string;
  submissionAddPaymentButton: string;
  submissionPaymentTypeDescription: string;
  submissionTotalAmountDescription: string;
  submissionPaymentDateDescription: string;
  submissionHasInitialPaymentDescription: string;
  submissionEqualRecurringDescription: string;
  submissionMarkAsPreferredDescription: string;
  submissionCancelButton: string;
  submissionAddingButton: string;
  submissionFailedToLoadVendors: string;
  submissionContactAvailable: string;
  submissionAvailableLabel: string;
  submissionUnmarkPreferredButton: string;
  submissionMarkAsPreferredButton: string;
  submissionAvailableForWorkLabel: string;
  submissionExtendsLifespanTemplate: string;
  submissionDocumentsSubmittedTemplate_one: string;
  submissionDocumentsSubmittedTemplate_other: string;
  submissionPaymentScheduleSummaryTemplate: string;
  submissionPaymentStartsTemplate: string;
  submissionPaymentItemTemplate: string;
  submissionNoPaymentPlanConfigured: string;
  submissionEditPaymentPlanTitleTemplate: string;
  submissionEditPaymentPlanDescription: string;
  submissionNoSubmissionsYetTitle: string;
  submissionNoSubmissionsYetDescription: string;
  submissionNoVendorSubmissionsYetMessage: string;
  submissionPreferredCountTemplate: string;
  submissionUpdatingButton: string;
  submissionSaveChangesButton: string;
  submissionEditVendorTitleTemplate: string;
  submissionEditVendorDialogDescription: string;
  submissionDocumentsTitle: string;
  submissionMarkAsPreferredEditDescription: string;
  submissionDeleteVendorButton: string;
  submissionCompletingButton: string;
  submissionCompleteSubmissionPhaseButton: string;
  submissionDocumentsOptionalTitle: string;
  workflowStepCanBeSkipped: string;
  workflowAutoGeneratedProjectTitle: string;
  workflowFailedToSavePhaseDescription: string;
  workflowPleaseWaitTitle: string;
  workflowSavingTaskChangesDescription: string;
  preWorkPreparationHeader: string;
  preWorkNoTasksDefined: string;
  preWorkAddTasksHelper: string;
  inProgressHeader: string;
  inProgressNoWorkTasksDefined: string;
  inProgressAddTasksHelper: string;
  workflowProgressSummaryTitle: string;
  workflowTasksCompletedLabel: string;
  preWorkSetupTasksSubheader: string;
  preWorkPreparationTasksTitle: string;
  preWorkPreparationTasksDescription: string;
  preWorkAddTaskButton: string;
  preWorkTaskDescriptionPlaceholder: string;
  preWorkTaskDoneBadge: string;
  preWorkTaskPendingBadge: string;
  preWorkNotificationSettingsTitle: string;
  preWorkNotificationSettingsDescription: string;
  preWorkNotificationMessageLabel: string;
  preWorkNotificationMessagePlaceholder: string;
  preWorkTimingLabel: string;
  preWorkDaysBeforeLabel: string;
  preWorkUpdateNotificationButton: string;
  preWorkAddNotificationButton: string;
  preWorkCancelButton: string;
  preWorkCreatedNotificationsTemplate: string;
  preWorkSentBadge: string;
  preWorkPendingBadge: string;
  preWorkCustomDaysBeforeTemplate: string;
  preWorkCompletingButton: string;
  preWorkCompletePhaseButton: string;
  preWorkTimingOneDayBefore: string;
  preWorkTimingThreeDaysBefore: string;
  preWorkTimingOneWeekBefore: string;
  preWorkTimingCustom: string;
  inProgressSubheader: string;
  inProgressWorkTasksTitle: string;
  inProgressWorkTasksDescription: string;
  inProgressTaskCountTemplate: string;
  inProgressAddTaskButton: string;
  inProgressTaskDescriptionPlaceholder: string;
  inProgressMarkWorkCompleteButton: string;
  preWorkNewTaskDefault: string;
  inProgressNewWorkTaskDefault: string;
  downloadYourData: string;
  downloadYourDataDescription: string;
  deleteYourAccount: string;
  deleteYourAccountWarning: string;
  backToBuildingArrow: string;
  searchProjects: string;
  searchByNamePlaceholder: string;
  overdueOnly: string;
  projectName: string;
  startDate: string;
  paginationShowingResults: string;
  noProjectsFoundTitle: string;
  noProjectsForBuilding: string;
  profileSettings: string;
  failedToLoadProjects: string;
  errorLoadingProjects: string;
  deleteAccountPermanently: string;
  deleteAccountIntro: string;
  deleteAccountItemProfile: string;
  deleteAccountItemDocuments: string;
  deleteAccountItemBills: string;
  deleteAccountItemMaintenance: string;
  deleteAccountItemOther: string;
  deleteAccountIrreversible: string;
  confirmEmailToProceed: string;
  reasonForDeletionOptional: string;
  reasonForDeletionPlaceholder: string;
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
  superAdmin: string;
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
  failedToDeleteDocumentsCount_one: string;
  failedToDeleteDocumentsCount_other: string;
  docManagerDocumentCount_one: string;
  docManagerDocumentCount_other: string;
  bulkImportAnalyzing_one: string;
  bulkImportAnalyzing_other: string;
  bulkImportResidenceIncomplete_one: string;
  bulkImportResidenceIncomplete_other: string;
  bulkImportBranchingPending_one: string;
  bulkImportBranchingPending_other: string;
  bulkImportFallbackPending_one: string;
  bulkImportFallbackPending_other: string;
  bulkImportCommitted_one: string;
  bulkImportCommitted_other: string;
  bulkImportNextStep: string;
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
  noResidenceLinkedTitle: string;
  noResidenceLinkedDescription: string;
  selectYourResidence: string;
  selectYourBuilding: string;
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
  plumbing: string;
  electrical: string;
  hvac: string;
  general: string;
  elevator: string;
  submitMaintenanceRequest: string;
  managerWillBeNotified: string;
  maintenancePhotoOptional: string;
  maintenanceRequestSubmitted: string;
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
  selectPriority: string;
  locationPlaceholder: string;
  uiUx: string;
  functionality: string;
  performance: string;
  data: string;
  integration: string;
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
  upvotedMessage: string;
  upvotedDescription: string;
  failedUpvote: string;
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
  rescanCompliance: string;
  notAvailable: string;
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
  ganttEditProject: string;
  ganttSaveChanges: string;
  ganttCancel: string;
  ganttDiscardUnsaved: string;
  ganttResizeStart: string;
  ganttResizeEnd: string;
  ganttDurationDays: string;
  budgetPlannedEndDate: string;
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
  myResidences: string;
  noResidenceLinkedYet: string;
  residencesLoadError: string;
  residenceRelationshipOwner: string;
  residenceRelationshipTenant: string;
  residenceRelationshipOccupant: string;
  residenceSince: string;
  myBuilding: string;
  commonSpaces: string;
  budget: string;
  bills: string;
  demands: string;
  navUserManagement: string;
  documentTags: string;
  manageCommonSpaces: string;
  pillars: string;
  roadmap: string;
  navQualityAssurance: string;
  navLaw25Compliance: string;
  navBulkDocumentImport: string;
  navKpiDashboard: string;
  navImpersonationLog: string;
  navOrgAccess: string;
  kpiDashboardTitle: string;
  kpiDashboardSubtitle: string;
  kpiBulkImportFilenameTitle: string;
  kpiBulkImportFilenameDescription: string;
  kpiBulkImportBranchTitle: string;
  kpiBulkImportBranchDescription: string;
  kpiBulkImportResidenceTitle: string;
  kpiBulkImportResidenceDescription: string;
  kpiBulkImportEffectiveDateTitle: string;
  kpiBulkImportEffectiveDateDescription: string;
  kpiBulkImportTagsTitle: string;
  kpiBulkImportTagsDescription: string;
  kpiByLanguage: string;
  kpiByBranchType: string;
  kpiOverall: string;
  kpiAcceptRate: string;
  kpiTotalDecisions: string;
  kpiVerbatim: string;
  kpiEdited: string;
  kpiCleared: string;
  kpiNoSuggestion: string;
  kpiLanguage: string;
  kpiBranchType: string;
  kpiNoData: string;
  kpiLoadFailed: string;
  kpiBranchKeep: string;
  kpiBranchMerge: string;
  kpiBranchSplit: string;
  kpiBranchBuildingDocuments: string;
  kpiBranchResidenceDocuments: string;
  kpiLangEnglish: string;
  kpiLangFrench: string;
  kpiLangUnknown: string;
  kpiFiltersTitle: string;
  kpiFiltersDescription: string;
  kpiDateRange: string;
  kpiRangeLast7Days: string;
  kpiRangeLast30Days: string;
  kpiRangeLast90Days: string;
  kpiRangeCustom: string;
  kpiFrom: string;
  kpiTo: string;
  kpiPickDate: string;
  kpiPickRangeHint: string;
  kpiOrganization: string;
  kpiAllOrganizations: string;
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
  attachFile: string;
  replaceFile: string;
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
  'bills.aiConfidenceHigh': string;
  'bills.aiConfidenceMedium': string;
  'bills.aiConfidenceLow': string;
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
  
  savingChanges: string;
  fileAttached: string;
  searchAndFilters: string;
  categoryAndSort: string;
  
  mostUpvotes: string;
  whyIsThisNeeded: string;
  chooseDocumentType: string;
  textDocument: string;
  selectFileToUpload: string;
  attachScreenshot: string;
  addDetailedNotes: string;
  internalNotesVisibleAdmins: string;
  currentAttachment: string;
  uploadNewFileToReplace: string;
  attachment: string;
  attachments: string;
  submittedOn: string;
  lastUpdatedOn: string;
  
  featureTitlePlaceholder: string;
  whyIsThisNeededPlaceholder: string;
  pageLocationPlaceholder: string;
  adminNotes: string;
  search: string;
  tryAdjustingSearchOrFilters: string;
  
  titleRequired: string;
  descriptionMinLength20: string;
  pageLocationRequired: string;
  
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
  noResidencesMatchSearch: string;
  
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
  budgetYearEndProjectionTooltip: string;
  budgetYearEndProjectionFiscalYearEndLabel: string;
  budgetYearEndProjectionMonthsRemainingLabel: string;
  budgetYearEndProjectionMonthsRemainingUnit: string;
  budgetYearEndProjectionActiveFiscalYearLabel: string;
  budgetActiveFiscalYear: string;
  budgetLengthTooltip: string;
  budgetTotalInvestment: string;
  budgetNoDataForPeriod: string;
  budgetConfigureAction: string;
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

  // Budget filter labels & section helpers
  budgetViewType: string;
  budgetPeriodWindow: string;
  budgetStartDate: string;
  budgetLength: string;
  budgetDataVisibility: string;
  budgetCapitalInvestmentsLabel: string;
  budgetProjects: string;
  budgetMonthsCount: string;
  budgetYearsCount: string;
  budgetDataSummary: string;
  budgetLoadingData: string;

  // Law 25 compliance dashboard component
  law25ComplianceStatusTitle: string;
  complianceStatusExcellent: string;
  complianceStatusGood: string;
  complianceStatusFair: string;
  complianceStatusPoor: string;
  totalViolations: string;
  criticalViolationsLabel: string;
  lastScan: string;
  categoryDataCollection: string;
  categoryConsentManagement: string;
  categoryDataRetention: string;
  categorySecurityEncryption: string;
  categoryCrossBorderTransfer: string;
  categoryDataSubjectRights: string;
  compliantStatusLabel: string;
  issuesFoundSingular: string;
  issuesFoundPlural: string;
  complianceViolations: string;
  moreViolationsLabel: string;
  law25ComplianceGuide: string;
  requiredComplianceAreas: string;
  requiredAreaExplicitConsent: string;
  requiredAreaDataRetention: string;
  requiredAreaEncryption: string;
  requiredAreaDataSubjectRights: string;
  propertyManagementFocus: string;
  propMgmtTenantInfoProtection: string;
  propMgmtFinancialDataSecurity: string;
  propMgmtBuildingAccessProtection: string;
  propMgmtMaintenancePrivacy: string;

  // Compliance page header
  compliancePageTitle: string;
  compliancePageSubtitle: string;

  // HOC titles
  buildingsManagementTitle: string;
  projectsManagementTitle: string;
  inventoryManagementTitle: string;

  // Buildings page extras
  buildingsLoadDataError: string;
  deleteBuildingDialogTitle: string;
  deleteBuildingDialogConfirmation: string;

  // Budget chart empty state
  budgetChartNoData: string;
  budgetChartAdjustFilters: string;
  // i18n migration (task 691): keys generated for previously-untranslated JSX text.
  chooseABuildingToViewAnd: string;
  creatingThisBillWillAutomaticallyUpdate: string;
  createBillFromAutoGeneratedTemplate: string;
  clickAddPaymentToGetStarted: string;
  thisMayTakeAFewSeconds: string;
  extractingDataFromYourDocument: string;
  useTheUploadSectionAboveTo: string;
  formFieldsHaveBeenAutomaticallyPopulated: string;
  aiIsAnalyzingYourDocument: string;
  historicalPerformanceDataAndImprovements: string;
  priorityOrderedOptimizationSuggestions: string;
  componentOptimizationRecommendations: string;
  mostCommonOptimizationOpportunities: string;
  identificationOfPerformanceBottlenecks: string;
  realTimeServerMetricsAndStatus: string;
  queryExecutionMetricsAndOptimizationStatus: string;
  currentPerformanceMetricsBreakdown: string;
  realTimeWebVitalsPerformanceTracking: string;
  realTimeMonitoringAndOptimizationInsights: string;
  priorityDistributionRecommendations: string;
  basedOnCurrentVelocityExpect15: string;
  documentationCategoryNeedsFocusOnly45: string;
  securitySuggestionsShow92CompletionRate: string;
  noInsightsAvailableRunAnAi: string;
  continuousImprovementRecommendationsFromAiAnalysis: string;
  noRecentInteractionsRecorded: string;
  realTimeLogOfAiAgent: string;
  realTimeMonitoringOfReplitAi: string;
  trackAiInteractionsAndContinuousImprovement: string;
  deletedItemsAreSoftDeletedAnd: string;
  unableToAnalyzeDeletionImpactProceed: string;
  noRelatedEntitiesWillBeAffected: string;
  willCascadeAndRemoveAllRelated: string;
  thisActionCannotBeUndoneDeleting: string;
  thisActionCannotBeUndonePlease: string;
  changesAreAutomaticallySavedAfterYou: string;
  createATextOnlyDocumentEntry: string;
  selectHowYouDLikeTo: string;
  aiAnalysisWillExtractKeyInformation: string;
  onDesktopDragDropClickTo: string;
  onMobileTapToUseCamera: string;
  dropFilesHereOrClickTo: string;
  billDocumentsTenantReadOnly: string;
  pleaseCorrectTheFollowingErrors: string;
  generatedDevelopmentPromptFor: string;
  optionalMockupsWireframesScreenshotsRequirementsDocs: string;
  forEachRoleSpecifyReadWrite: string;
  enableRoleBasedAccessControlFor: string;
  doesThisFeatureRequireRbac: string;
  roleBasedAccessControlRbac: string;
  markThisFeatureAsPartOf: string;
  markAsAStrategicDevelopmentPriority: string;
  saveAsAnActionableItemTo: string;
  requestSpecificImplementationDetailsOrAsk: string;
  theAiWillHaveFullContext: string;
  copyThisPromptAndPasteIt: string;
  noCustomDatesAddedClickAdd: string;
  extractingInvoiceDataWithAiThis: string;
  pleaseFixTheFollowingErrors: string;
  supportedImagesPdfDocXlsTxt: string;
  reasonForDismissalOptional: string;
  areYouSureYouWantTo: string;
  skipVendorSubmissionsDefaultForAuto: string;
  configureWhichWorkflowStepsShouldBe: string;
  whenDidOrWillTheActual: string;
  thisWillBeUsedAsThe: string;
  tryAdjustingYourSearchTermsOr: string;
  theseProjectsWereAutomaticallyGeneratedBy: string;
  aiGeneratedProjectSuggestionsWillAppear: string;
  failedToLoadAutoGeneratedProjects: string;
  loadingAutoGeneratedProjects: string;
  eachElementWillHaveAUnit: string;
  eachElementWillHaveAReconstruction: string;
  costPerUnitEG50: string;
  totalReconstructionCostForEachElement: string;
  updateReconstructionCostsFor: string;
  updateResidenceAssignmentAccessTypeAnd: string;
  pleaseWaitWhileWeProcessYour: string;
  saveTheElementToEnableDocument: string;
  noDocumentsAttachedToThisAsset: string;
  areYouSureYouWantTo2: string;
  automaticallyCalculatedBasedOnConditionAnd: string;
  navigateLevel1Level2Level: string;
  anyAdditionalInformationOrObservations: string;
  automaticallyCalculatedBasedOnEventType: string;
  additionalYearsAddedToElementLifespan: string;
  briefDescriptionOfWarrantyCoverage: string;
  selectFromExistingVendorsOrEnter: string;
  detailedDescriptionOfTheWorkPerformed: string;
  totalCostOfTheWorkOptional: string;
  startBuildingYourInventoryByAdding: string;
  areYouSureYouWantTo3: string;
  detailedBreakdownOfCostsAndAllocations: string;
  thereWasAnErrorLoadingThe: string;
  areYouSureYouWantTo4: string;
  updateCostAllocationAndWorkDetails: string;
  allAvailableElementsAreAlreadyAssigned: string;
  selectBuildingElementsToIncludeIn: string;
  noElementsAssignedToThisProject: string;
  planningOnlyProjectThatCannotAdvance: string;
  selectBuildingElementsToIncludeIn2: string;
  currentActualCostSpentOnThis: string;
  totalAllocatedBudgetForThisProject: string;
  whenTheProjectIsPlannedTo: string;
  optionalDetailedDescriptionOfTheProject: string;
  clearDescriptiveNameForTheProject: string;
  uniqueIdentifierForThisProject: string;
  targetCompletionDateForTheProject: string;
  createASimplifiedProjectWithEssential: string;
  thisProjectIsBeingCreatedBased: string;
  creatingFromEvaluationSuggestion: string;
  areYouSureYouWantTo5: string;
  tryAdjustingYourFiltersOrSearch: string;
  noNotesFoundForThisProject: string;
  thereWasAnErrorLoadingThe2: string;
  thereWasAnErrorLoadingThe3: string;
  noProjectsFoundForTheSelected: string;
  thereWasAnErrorLoadingThe4: string;
  thisWillMarkTheProjectAs: string;
  areYouSureYouWantTo6: string;
  maintenanceApproachComparison: string;
  areYouSureYouWantTo7: string;
  basedOnCriticalOverdueItems: string;
  giveYourFilterPresetAName: string;
  autoCalculatedRecommendations: string;
  detailedExplanationForTheSuggestion: string;
  estimatedCostForTheSuggestedWork: string;
  whenThisEvaluationOrWorkShould: string;
  automaticallyCalculateSuggestionTypePriorityAnd: string;
  selectTheBuildingElementForThis: string;
  pleaseReviewTheSuggestionDetailsAnd: string;
  additionalInformationServiceQualityNotesSpecialties: string;
  primaryEmailAddressForCommunication: string;
  primaryPhoneNumberForContact: string;
  primaryContactPersonAtTheVendor: string;
  primaryServiceCategoryForThisVendor: string;
  theLegalOrBusinessNameOf: string;
  noFeaturesInThisCategoryYet: string;
  formHasBeenPrePopulatedWith: string;
  noBuildingsAvailableForTheSelected: string;
  noOrganizationsSelectedPleaseSelectOrganizations: string;
  noOrganizationsAvailableToAssign: string;
  noResidencesAvailableForTheSelected: string;
  noBuildingsSelectedPleaseSelectBuildings: string;
  noPermissionsFoundMatchingYourSearch: string;
  completeSystemPermissionsTableWithDetailed: string;
  noUsersFoundMatchingYourSearch: string;
  userInheritsAllPermissionsFrom: string;
  noUserSpecificPermissionOverrides: string;
  adminManagerResidentTenant: string;
  yourDashboardWillBeCustomizedBased: string;
  editTheDetailsOfThisBill: string;
  viewDetailedInformationAboutThisBill: string;
  fillInTheFormBelowTo: string;
  noBillsFoundForTheSelected: string;
  fillInTheFormBelowTo2: string;
  thisActionCannotBeUndone2: string;
  areYouSureYouWantTo8: string;
  areYouSureYouWantTo9: string;
  tiquettesPourClasserVosDocumentsCcq: string;
  noInvoicesFoundForTheSelected: string;
  thisActionCannotBeUndoneAnd: string;
  manageBuildingElementsTrackConditionsAnd: string;
  distributionOfElementConditions: string;
  mandatoryBuildingSafetyDrill: string;
  buildingEventsAndImportantDates: string;
  poolMaintenanceScheduledForNextWeek: string;
  elevatorMaintenanceFinishedUnit4b: string;
  latestUpdatesFromYourBuilding: string;
  thisWillPermanentlyDeleteYourAccount: string;
  permanentlyDeleteYourAccountAndAll: string;
  exportAllYourPersonalDataIncluding: string;

  // i18n migration (task 711): keys generated for the maintenance project
  // workflow tabs (PlannedTab, PreWorkTab, SubmissionTab, InProgressTab,
  // PostWorkTab, CompleteTab, ElementManagementTab, PaymentPlanForm,
  // ProjectWorkflowModal, ReopenStepDialog, WorkflowSkipConfigDialog).
  wfCompleteProjectMissing: string;
  wfCompleteSummaryDescription: string;
  wfCompleteSummaryCardDesc: string;
  wfCompleteSummaryFieldDesc: string;
  wfCompleteFooterStatus: string;
  wfElementsAddDescription: string;
  wfElementsIncludedDescription: string;
  wfElementsAdjustSearchHint: string;
  wfElementsNoneAddedYet: string;
  wfElementsAddFromAvailable: string;
  wfElementsBulkRemoveWarning_one: string;
  wfElementsBulkRemoveWarning_other: string;
  wfInProgressProjectMissing: string;
  wfPlannedProjectMissing: string;
  wfPreWorkProjectMissing: string;
  wfPaymentConfigDescription: string;
  wfPaymentTypeDescription: string;
  wfPaymentEndRecurringLabel: string;
  wfPaymentInitialDescription: string;
  wfPaymentEqualRecurringDesc: string;
  wfPaymentMismatchWarning: string;
  wfModalNoProjectDescription: string;
  wfModalProjectMissingMessage: string;
  wfModalProjectStillLoading: string;
  wfModalUnknownTabSuffix: string;
  wfModalLoadingDescription: string;
  wfModalUnableToLoad: string;
  wfSubmissionAvailableDateDesc: string;
  wfSubmissionAdditionalDetailsDesc: string;
  wfSkipConfigDescription: string;
  wfSkipConfigCompletedNote: string;
  wfSkipConfigChangesImmediate: string;
  wfSkipConfigDeleteConfirmation: string;
  wfSkipConfigDialogTitle: string;
  wfSkipConfigStatusCompleted: string;
  wfSkipConfigStatusCurrent: string;
  wfSkipConfigStatusSkipped: string;
  wfSkipConfigSkipStepLabel: string;
  wfSkipConfigIncludeStepLabel: string;
  wfSkipConfigDeletingLabel: string;
  wfSkipConfigDeleteButton: string;
  wfSkipConfigCloseButton: string;
  wfSkipConfigDeleteAlertTitle: string;
  wfSkipConfigCancelButton: string;
  wfSkipConfigDeletePermanentlyButton: string;
  wfStepSubmissionLabel: string;
  wfStepSubmissionDescription: string;
  wfStepPreWorkLabel: string;
  wfStepPreWorkDescription: string;
  wfStepInProgressLabel: string;
  wfStepInProgressDescription: string;
  wfStepPostWorkLabel: string;
  wfStepPostWorkDescription: string;
  wfElementsAddedTitle: string;
  wfElementsAddedDescription: string;
  wfElementsAddFailedDescription: string;
  wfElementsRemovedTitle: string;
  wfElementsRemovedDescription: string;
  wfElementsRemoveFailedDescription: string;
  wfElementsUpdatedTitle: string;
  wfElementsUpdatedDescription: string;
  wfElementsUpdateFailedDescription: string;
  postWorkNewTaskDefault: string;
  wfCompleteSummaryPlaceholder: string;
  wfElementsSearchPlaceholder: string;

  // Bulk edit cost dialog (task #707)
  bulkCostUpdateTitle: string;
  bulkCostUpdateDescPrefix: string;
  bulkCostUpdateDescSuffix: string;
  bulkCostAssignmentType: string;
  bulkCostPerElement: string;
  bulkCostPerUnit: string;
  bulkCostPerElementHint: string;
  bulkCostPerUnitHint: string;
  bulkCostAmountLabel: string;
  bulkCostPerElementHelper: string;
  bulkCostPerUnitHelper: string;
  bulkCostPreviewLabel: string;
  bulkCostPreviewPerElementPrefix: string;
  bulkCostPreviewPerElementSuffix: string;
  bulkCostPreviewPerUnitPrefix: string;
  bulkCostPreviewPerUnitSuffix: string;
  bulkCostUpdateButton: string;
  bulkCostToastUpdatedTitle: string;
  bulkCostToastUpdatedDescPrefix: string;
  bulkCostToastUpdatedDescSuffix: string;
  bulkCostToastFailedTitle: string;
  bulkCostToastFailedDesc: string;
  bulkCostInvalidAmountError: string;

  // Bulk edit residence dialog (task #707)
  bulkResidenceTitle: string;
  bulkResidenceDescPrefix: string;
  bulkResidenceDescSuffix: string;
  bulkResidenceUpdateAssignment: string;
  bulkResidenceSelectPlaceholder: string;
  bulkResidenceBuildingWide: string;
  bulkResidenceBuildingWideDesc: string;
  bulkResidenceUnitPrefix: string;
  bulkResidenceFloorPrefix: string;
  bulkResidenceUpdateAccess: string;
  bulkResidenceSelectAccess: string;
  bulkResidenceNotRestrained: string;
  bulkResidenceNotRestrainedDesc: string;
  bulkResidenceRestrained: string;
  bulkResidenceRestrainedDesc: string;
  bulkResidenceUpdateCharge: string;
  bulkResidenceSelectCharge: string;
  bulkResidenceCommon: string;
  bulkResidenceCommonDesc: string;
  bulkResidencePersonal: string;
  bulkResidencePersonalDesc: string;
  bulkResidenceChangesToApply: string;
  bulkResidenceChangeResidence: string;
  bulkResidenceChangeAccess: string;
  bulkResidenceChangeCharge: string;
  bulkResidenceUpdateButton: string;
  bulkResidenceToastUpdatedTitle: string;
  bulkResidenceToastUpdatedDescPrefix: string;
  bulkResidenceToastUpdatedDescSuffix: string;
  bulkResidenceToastFailedTitle: string;
  bulkResidenceToastFailedDesc: string;
  bulkResidenceSelectFieldError: string;
  bulkResidenceUnknownUnit: string;

  // Project budget (task #707)
  pbBudgetOverview: string;
  pbBudgetBreakdown: string;
  pbViewElements: string;
  pbExportBudget: string;
  pbTotalBudget: string;
  pbActualCost: string;
  pbAllocated: string;
  pbRemaining: string;
  pbBudgetUtilization: string;
  pbOverBudgetPrefix: string;
  pbOverBudgetSuffix: string;
  pbFailedToLoadTitle: string;
  pbFailedToLoadDesc: string;
  pbCategory: string;
  pbVariance: string;
  pbActions: string;
  pbHistoricalOnly: string;
  pbViewDetails: string;
  pbCount: string;
  pbElementsSuffix: string;
  pbVendorsSuffix: string;
  pbOver: string;
  pbNotAvailable: string;
  pbSearchBreakdownPlaceholder: string;
  pbNoBudgetDataTitle: string;
  pbNoBudgetDataDesc: string;
  pbBreakdownDetailsTitle: string;
  pbBreakdownDetailsDesc: string;
  pbDetailsSuffix: string;
  pbProjectElementsHeading: string;
  pbVendorHistoryHeading: string;
  pbUnknownVendor: string;
  pbCategoryElementAllocations: string;
  pbCategoryElementAllocationsDesc: string;
  pbCategoryVendorCosts: string;
  pbCategoryVendorCostsDesc: string;
  pbCategoryMaterials: string;
  pbCategoryMaterialsDesc: string;
  pbCategoryLabor: string;
  pbCategoryLaborDesc: string;
  pbCategoryUnallocated: string;
  pbCategoryUnallocatedDesc: string;
  pbBreakdownAllocatedToPrefix: string;
  pbBreakdownAllocatedToSuffix: string;
  pbBreakdownVendorCountPrefix: string;
  pbBreakdownVendorCountSuffix: string;
  pbBreakdownMaterialsDesc: string;
  pbBreakdownLaborDesc: string;
  pbBreakdownUnallocatedDesc: string;

  // Project elements (task #707)
  peElement: string;
  peCondition: string;
  pePlannedWork: string;
  peCostAllocation: string;
  peLifespanImpact: string;
  peActions: string;
  peNotSpecified: string;
  peNotSet: string;
  peTbd: string;
  peYearsSuffix: string;
  peOpenMenu: string;
  peActionsLabel: string;
  peActionViewDetails: string;
  peActionEditAllocation: string;
  peActionRemoveFromProject: string;
  peRemoveSelected: string;
  peExportElements: string;
  peProjectElementsTitle: string;
  peElementsAssignedSuffix: string;
  peSearchPlaceholder: string;
  peNoElementsAssignedTitle: string;
  peNoElementsAssignedDesc: string;
  peNoElementsAssignedShort: string;
  peAddElement: string;
  peAddBuildingElementTitle: string;
  peAddBuildingElementDesc: string;
  peAddBuildingElementsTitle: string;
  peAddBuildingElementsDesc: string;
  peQuickProject: string;
  peQuickProjectLong: string;
  peQuickProjectShort: string;
  peWorkDescriptionLabel: string;
  peWorkDescriptionPlaceholder: string;
  peCostAllocationLabel: string;
  peLifespanImpactLabel: string;
  peAvailableElements: string;
  peAllAlreadyAssigned: string;
  peEditElementTitle: string;
  peEditElementDesc: string;
  peEditWorkDescriptionPlaceholder: string;
  peSavingProgress: string;
  peRemoveElementTitle: string;
  peRemoveElementConfirm: string;
  peRemoveButton: string;
  peRemovingProgress: string;
  pePermissionDeniedTitle: string;
  pePermissionDeniedAddElements: string;
  pePermissionDeniedQuickProject: string;
  peElementAddedTitle: string;
  peElementAddedDesc: string;
  peElementAddFailedTitle: string;
  peElementUpdatedTitle: string;
  peElementUpdatedDesc: string;
  peElementUpdateFailedTitle: string;
  peElementRemovedTitle: string;
  peElementRemovedDesc: string;
  peElementRemoveFailedTitle: string;
  peQuickProjectCreatedTitle: string;
  peQuickProjectCreatedDesc: string;
  peQuickProjectFailedTitle: string;
  peBulkOpDoneTitle: string;
  peBulkOpRemovedDesc: string;
  peBulkOpUpdatedDesc: string;
  peBulkOpFailedTitle: string;
  pePleaseTryAgain: string;
  peQuickProjectFallbackDescription: string;

  // Element form (task #707)
  efAddBuildingElement: string;
  efEditBuildingElement: string;
  efViewBuildingElement: string;
  efAddDescription: string;
  efEditDescription: string;
  efViewDescription: string;
  efDeleteButton: string;
  efDeletingProgress: string;
  efDeleteConfirm: string;
  efDetailsTabLabel: string;
  efHistoryTabLabel: string;
  efUniformatCodeLabel: string;
  efBrowseButton: string;
  efSearchPlaceholder: string;
  efSearchPlaceholderBrowser: string;
  efBrowseDialogTitle: string;
  efBrowseDialogHint: string;
  efBreadcrumbLevel1: string;
  efBreadcrumbLevel2Prefix: string;
  efBreadcrumbLevel3Prefix: string;
  efTypicalLifespanPrefix: string;
  efTypicalLifespanShortPrefix: string;
  efTypicalLifespanSuffix: string;
  efLoadingCodes: string;
  efNoMatchingCodes: string;
  efSelectableLabel: string;
  efNavigateLabel: string;
  efNavigateOnlyLabel: string;
  efElementNameLabel: string;
  efElementNamePlaceholder: string;
  efCurrentConditionLabel: string;
  efSelectCondition: string;
  efDescriptionLabel: string;
  efDescriptionLabelHelper: string;
  efDescriptionPlaceholder: string;
  efResidenceAssignmentLabel: string;
  efResidenceAssignmentDesc: string;
  efBuildingWideElement: string;
  efSelectResidenceAssignment: string;
  efUnitPrefix: string;
  efFloorPrefix: string;
  efAssignedToPrefix: string;
  efFloorSuffix: string;
  efAccessTypeLabel: string;
  efAccessTypeDesc: string;
  efSelectAccessType: string;
  efNotRestrained: string;
  efNotRestrainedDesc: string;
  efRestrained: string;
  efRestrainedDesc: string;
  efChargeTypeLabel: string;
  efChargeTypeDesc: string;
  efSelectChargeType: string;
  efCommon: string;
  efCommonDesc: string;
  efPersonal: string;
  efPersonalDesc: string;
  efTimelineHeading: string;
  efOriginalConstructionDate: string;
  efOriginalLifespan: string;
  efYearsLeftToReconstruction: string;
  efQuantityHeading: string;
  efQuantityLabel: string;
  efUnitLabel: string;
  efSelectUnit: string;
  efUnitM2: string;
  efUnitM: string;
  efUnitUnit: string;
  efUnitM3: string;
  efUnitKg: string;
  efUnitL: string;
  efNextEvaluationDate: string;
  efAutoCalculate: string;
  efAutoCalcHelper: string;
  efReconstructionEvaluation: string;
  efReconstructionCost: string;
  efReconstructionCostPlaceholder: string;
  efDateOfEstimation: string;
  efElementQuantityHeading: string;
  efQuantityDuplicateLabel: string;
  efQuantityDuplicateDesc: string;
  efNotesLabel: string;
  efNotesPlaceholder: string;
  efElementCreatedTitle: string;
  efElementsCreatedSuffix: string;
  efElementUpdatedTitle: string;
  efElementCreatedSuccessSuffix: string;
  efElementUpdatedSuccessSuffix: string;
  efSuccessfullyCreatedPrefix: string;
  efSuccessfullyCreatedSuffix: string;
  efCreationFailedTitle: string;
  efUpdateFailedTitle: string;
  efFailedToCreateElement: string;
  efFailedToUpdateElement: string;
  efNoElementToDelete: string;
  efElementDeletedTitle: string;
  efElementDeletedDesc: string;
  efDeletionFailedTitle: string;
  efFailedToDeleteElement: string;
  // Manager > Maintenance > Projects: dashboard / table / timeline / details
  // panels copy. Keys prefixed with `pv` (project view); originally added in
  // task #712 and expanded in task #740 to translate remaining short strings.
  pvFailedToLoadDashboard: string;
  pvNoBuildingDashboard: string;
  pvDashboardSubtitle: string;
  pvProjectTrendsDesc: string;
  pvBudgetAnalysisDesc: string;
  pvStatusBreakdownDesc: string;
  pvPriorityBreakdownDesc: string;
  pvOverdueProjectsAlert: string;
  pvBudgetUtilizationHighAlert: string;
  pvExecutiveSummaryDesc: string;
  pvBudgetWithinTarget: string;
  pvQualityMeetingExpectations: string;
  pvDetailsPanelDesc: string;
  pvFailedToLoadDetails: string;
  pvImmediateAttention: string;
  pvFinancialTrackingDesc: string;
  pvElementsAssociatedDesc: string;
  pvElementsAvailableInFullView: string;
  pvFailedToLoadProjects: string;
  pvNoBuildingProjectsTable: string;
  pvNoProjectsCreatedYet: string;
  pvGetStartedHint: string;
  pvNoProjectsMatchFilters: string;
  pvAdjustFiltersHint: string;
  pvRealtimeBulkHint: string;
  pvFailedToLoadTimeline: string;
  pvNoBuildingTimeline: string;
  pvTimelineSubtitle: string;
  pvClickDateToView: string;
  pvNoEventsScheduled: string;
  pvOverdueEventSingular: string;
  pvOverdueEventPlural: string;
  pvFailedToLoadMetrics: string;
  pvBudgetCriticallyHigh: string;
  pvSchedulePerformanceAttention: string;
  pvEfficiencyBelowAcceptable: string;
  pvHealthAlertSuffix: string;
  pvCreateProjectsFromSuggestions: string;
  pvSuggestionsDialogDesc: string;
  pvFailedToLoadSuggestions: string;
  pvProjectDefaultsDesc: string;
  pvNoPendingSuggestions: string;
  pvNoSuggestionsMatchFilters: string;
  // Project view (pv*) keys added in task #740 — short strings missed in #712
  pvProjectsCreatedTitle: string;
  pvProjectsCreatedDesc: string;
  pvFailedToCreateProjects: string;
  pvNoSuggestionsSelectedTitle: string;
  pvNoSuggestionsSelectedDesc: string;
  pvSearchSuggestionsPlaceholder: string;
  pvAllPrioritiesPlaceholder: string;
  pvAllPrioritiesItem: string;
  pvAllTypesPlaceholder: string;
  pvAllTypesItem: string;
  pvTypeInspection: string;
  pvTypeMinorRehab: string;
  pvTypeMajorRehab: string;
  pvTypeReplacement: string;
  pvTypeRepair: string;
  pvTypeNotSure: string;
  pvHealthHealthy: string;
  pvHealthWarning: string;
  pvHealthCritical: string;
  pvSelectAllSuggestions: string;
  pvNSelected: string;
  pvNoSuggestionsFound: string;
  pvSuggestionTypeElementEvaluation: string;
  pvElementHash: string;
  pvProjectDefaultsTitle: string;
  pvDefaultBudgetLabel: string;
  pvDurationDaysLabel: string;
  pvDefaultPriorityLabel: string;
  pvEstimatedTotalBudget: string;
  pvSuggestionsSelectedFooter: string;
  pvCreatingButton: string;
  pvCreateNProjects: string;
  pvNoBuildingSelected: string;
  pvProjectPortfolioDashboard: string;
  pvExportReport: string;
  pvCompletionRateLabel: string;
  pvBudgetUtilizationLabel: string;
  pvOnTimeCompletionLabel: string;
  pvCostEfficiencyLabel: string;
  pvProjectTrendsTitle: string;
  pvBudgetAnalysisTitle: string;
  pvProjectStatusDistributionTitle: string;
  pvPriorityDistributionTitle: string;
  pvBudgetHealth: string;
  pvOverallStatus: string;
  pvBudgetUtilizedPct: string;
  pvScheduleHealth: string;
  pvOnTimeDeliveryRate: string;
  pvQualityHealth: string;
  pvSuccessfulCompletionRate: string;
  pvExecutiveSummaryTitle: string;
  pvPortfolioHealth: string;
  pvTotalProjectsInPortfolio: string;
  pvCurrentlyActiveProjects: string;
  pvCompletionRateThisPeriod: string;
  pvAverageProjectDuration: string;
  pvPerformanceInsights: string;
  pvCostEfficiencyAt: string;
  pvProjectsDeliveredOnTime: string;
  pvChartCreated: string;
  pvChartCompleted: string;
  pvChartPlannedBudget: string;
  pvChartActualSpend: string;
  pvEditProjectAction: string;
  pvUpdateStatusAction: string;
  pvTimelineAction: string;
  pvProjectProgressTitle: string;
  pvOverallProgressLabel: string;
  pvTimeRemaining: string;
  pvDaysOverdue: string;
  pvDaysLeft: string;
  pvBudgetUsage: string;
  pvProjectIsOverdue: string;
  pvProjectIsOverBudget: string;
  pvOverviewTab: string;
  pvTimelineTab: string;
  pvBudgetTab: string;
  pvElementsTab: string;
  pvProjectInformation: string;
  pvTypeColon: string;
  pvCreatedFromSuggestion: string;
  pvAutoGenerated: string;
  pvCreatedColon: string;
  pvLastUpdatedColon: string;
  pvDurationCaps: string;
  pvNDays: string;
  pvActualNDays: string;
  pvBudgetCaps: string;
  pvAmountSpentSuffix: string;
  pvManageProjectElements: string;
  pvProjectNotesAndComm: string;
  pvBudgetCostTracking: string;
  pvProjectTimelineTitle: string;
  pvKeyDatesAndMilestones: string;
  pvPlannedStartColon: string;
  pvPlannedEndColon: string;
  pvActualStartColon: string;
  pvActualEndColon: string;
  pvOpenFullTimelineView: string;
  pvBudgetAnalysisCardTitle: string;
  pvBudgetUtilizationCardLabel: string;
  pvTotalBudgetLabel: string;
  pvAmountSpentLabel: string;
  pvRemainingLabel: string;
  pvVarianceLabel: string;
  pvOpenBudgetManagement: string;
  pvProjectElementsTitle: string;
  pvNoProjectsFound: string;
  pvNoProjectsMatchFiltersTitle: string;
  pvProjectsShownOf: string;
  pvMatchingSearch: string;
  pvStatusFilterChip: string;
  pvPriorityFilterChip: string;
  pvOverdueOnlyChip: string;
  pvProjectTimelineHeader: string;
  pvViewMonth: string;
  pvViewQuarter: string;
  pvViewYear: string;
  pvFullTimeline: string;
  pvTotalEvents: string;
  pvOverdueLabel: string;
  pvDueThisWeek: string;
  pvActiveProjects: string;
  pvEventsThisMonth: string;
  pvEventStart: string;
  pvEventEnd: string;
  pvEventMilestone: string;
  pvSelectADate: string;
  pvEventsScheduledOnDate: string;
  pvProjectNumber: string;
  pvTimelineActions: string;
  pvBulkStatusUpdate: string;
  pvResourcePlanning: string;
  pvExportTimeline: string;
  pvTotalProjectsTitle: string;
  pvNActive: string;
  pvNCompleted: string;
  pvBudgetOverviewTitle: string;
  pvAmountSpentText: string;
  pvScheduleStatusTitle: string;
  pvOverdueProjectsText: string;
  pvNoOverdueProjects: string;
  pvNDueSoon: string;
  pvPerformanceTitle: string;
  pvCompletionRateText: string;
  pvNPercentOnTime: string;
  pvSuggestionsTitle: string;
  pvPendingEvaluationSuggestions: string;
  pvAllSuggestionsReviewed: string;
  pvAvgDuration: string;
  pvDaysPerProject: string;
  pvCostEfficiencyTitle: string;
  pvExcellentEfficiency: string;
  pvGoodEfficiency: string;
  pvNeedsImprovement: string;
  pvResourcesTitle: string;
  pvTeamUtilization: string;
  pvProjectsByStatus: string;
  pvStatusPlanned: string;
  pvStatusEvaluation: string;
  pvStatusSubmission: string;
  pvStatusPreWork: string;
  pvStatusActiveWork: string;
  pvStatusPostWork: string;
  pvStatusCompleted: string;
  pvProjectsByPriority: string;
  pvPriorityLowLabel: string;
  pvPriorityMediumLabel: string;
  pvPriorityHighLabel: string;
  pvPriorityCriticalLabel: string;
  // Auth flow translations (task #713) — invitation, consent, password steps
  authPrivacyAlertTitle: string;
  authPrivacyAlertText: string;
  authDataCollectionTitle: string;
  authDataCollectionMasterText: string;
  authEssentialDataLabel: string;
  authEssentialDataDesc: string;
  authMarketingLabel: string;
  authMarketingDesc: string;
  authAnalyticsLabel: string;
  authAnalyticsDesc: string;
  authThirdPartyLabel: string;
  authThirdPartyDesc: string;
  authRightsAndControl: string;
  authAcknowledgeRightsLabel: string;
  authAcknowledgeRightsDesc: string;
  authAcknowledgeRightsWarning: string;
  authYourRightsTitle: string;
  authRightAccess: string;
  authRightAccessDesc: string;
  authRightRectification: string;
  authRightRectificationDesc: string;
  authRightDeletion: string;
  authRightDeletionDesc: string;
  authRightPortability: string;
  authRightPortabilityDesc: string;
  authContactRightsTitle: string;
  authContactRightsDesc: string;
  authSecurityRetentionTitle: string;
  authSecurityLabel: string;
  authSecurityDesc: string;
  authRetentionLabel: string;
  authRetentionDesc: string;
  authTransparencyLabel: string;
  authTransparencyDesc: string;
  authInvalidToken: string;
  authServerConnectionError: string;
  authValidatingInvitation: string;
  authValidatingInvitationDesc: string;
  authInvitationTokenRequired: string;
  authInvitationTokenRequiredDesc: string;
  authInvitationInvalid: string;
  authUnableToValidate: string;
  authInvitationLinkExpired: string;
  authInvitationCheckLink: string;
  authInvitationNotExpired: string;
  authInvitationContactAdmin: string;
  authInvitationValid: string;
  authInvitationValidDesc: string;
  authInvitationConfirmed: string;
  authInvitedToJoin: string;
  authInvitedBy: string;
  authValidity: string;
  authExpired: string;
  authDayRemaining: string;
  authDaysRemaining: string;
  authHourRemaining: string;
  authHoursRemaining: string;
  authExpiringSoon: string;
  authPasswordRequiredLabel: string;
  authEnterYourPassword: string;
  authHidePassword: string;
  authShowPassword: string;
  authPasswordDoesNotMeetRequirements: string;
  authConfirmPasswordRequired: string;
  authConfirmYourPassword: string;
  authPasswordsMatch: string;
  authPasswordsDoNotMatch: string;
  authSecurityTipsTitle: string;
  authSecurityTip1: string;
  authSecurityTip2: string;
  authSecurityTip3: string;
  authSecurityTip4: string;
  authUserProfileLabel: string;
  authUserProfileDesc: string;
  authPersonalInformation: string;
  authFirstNameRequired: string;
  authYourFirstName: string;
  authLastNameRequired: string;
  authYourLastName: string;
  authPhoneOptional: string;
  authPreferredLanguage: string;
  authChooseLanguage: string;
  authInvalidPhoneFormat: string;
  authFieldIsRequired: string;
  authDemoUserCreated: string;
  authDemoUserCreatedSuccess: string;
  authErrorTitle: string;
  authEmailRequiredForRegular: string;
  authResidenceRequiredForBuilding: string;
  authDemoManager: string;
  authDemoTenant: string;
  authDemoResident: string;
  authFirstNameLabel: string;
  authEnterFirstName: string;
  authLastNameLabel: string;
  authEnterLastName: string;
  authBuildingLabel: string;
  authSelectBuilding: string;
  authAllBuildingsOption: string;
  authResidenceLabelRequired: string;
  authSelectResidence: string;
  authNoSpecificResidence: string;
  authResidenceRequired: string;
  authSelectOrgFirst: string;
  authManagersOnlyOwnOrg: string;
  authSelectTargetOrg: string;
  authCreatingUser: string;
  authCreateDemoUser: string;
  authEmailRequiredForReset: string;
  authEmailSent: string;
  authResetEmailSentIfExists: string;
  authResetEmailSentSuccess: string;
  authResetEmailFollowUp: string;
  authCheckSpamFolder: string;
  authBackToLogin: string;
  authForgotPasswordTitle: string;
  authForgotPasswordDesc: string;
  authSendResetLink: string;
  authSendingInProgress: string;
  authEmailAddressLabel: string;
  authEmailAddressDesc: string;
  authNewPasswordRequired: string;
  authPasswordMin8: string;
  authPasswordMax100: string;
  authPasswordComplexity: string;
  authConfirmPasswordRequiredZ: string;
  authPasswordsDoNotMatchHelp: string;
  authTokenMissing: string;
  authResetLinkInvalid: string;
  authResetTokenMissing: string;
  authPasswordResetTitle: string;
  authPasswordUpdatedSuccess: string;
  authResetGeneralError: string;
  authResetLinkInvalidExpired: string;
  authResetLinkAlreadyUsed: string;
  authPasswordTooShort: string;
  authPasswordTooWeak: string;
  authPasswordResetCompleteDesc: string;
  authSignIn: string;
  authInvalidLink: string;
  authRequestNewLink: string;
  authResetPasswordTitle: string;
  authEnterNewPassword: string;
  authNewPasswordLabel: string;
  authConfirmPasswordLabel: string;
  authConfirmNewPassword: string;
  authResettingInProgress: string;
  authValidationStepTitle: string;
  authValidationStepDesc: string;
  authPasswordStepTitle: string;
  authPasswordStepDesc: string;
  authProfileStepTitle: string;
  authProfileStepDesc: string;
  authConsentStepTitle: string;
  authConsentStepDesc: string;
  authPasswordRequiredError: string;
  authNamesRequiredError: string;
  authConsentsRequiredError: string;
  authAccountCreationError: string;
  authAccountCreationGenericError: string;
  authRegistrationCompleteTitle: string;
  authWelcomeUser: string;
  authAccountCreatedMessage: string;
  authAccountCreatedTitle: string;
  authQuebecComplianceTitle: string;
  authQuebecComplianceDesc: string;
  authAccessMyAccount: string;
  authLoginWithEmailPassword: string;
  authBackToHome: string;
  authInvitationAcceptanceTitle: string;
  authInvitationAcceptanceDesc: string;
  authErrorPrefix: string;
  authCreatingYourAccount: string;
  authRegistrationFooter: string;
  // CompleteTab labels
  wfCompleteHeaderTitle: string;
  wfCompleteCompleteBadge: string;
  wfCompleteSavingButton: string;
  wfCompleteSaveChangesButton: string;
  wfCompleteSummaryCardTitle: string;
  wfCompleteTimelineTitle: string;
  wfCompletePlannedStartLabel: string;
  wfCompleteNotSpecified: string;
  wfCompleteActualEndLabel: string;
  wfCompleteDurationLabel: string;
  wfCompleteDays: string;
  wfCompleteBudgetSummary: string;
  wfCompleteTotalBudget: string;
  wfCompleteActualCost: string;
  wfCompleteBudgetUtilization: string;
  wfCompleteUtilizedSuffix: string;
  wfCompleteOverBudgetBy: string;
  wfCompleteProjectDetails: string;
  wfCompleteProjectNumber: string;
  wfCompleteProjectType: string;
  wfCompletePriority: string;
  wfCompleteOrigin: string;
  wfCompleteOriginAuto: string;
  wfCompleteOriginManual: string;
  wfCompleteCreated: string;
  wfCompleteStatusTitle: string;
  wfCompleteProjectCompleteText: string;
  wfCompleteAllStagesText: string;
  wfCompleteReopenProjectButton: string;
  // ProjectWorkflowModal labels
  wfModalProjectMissingTitle: string;
  wfModalWorkflowErrorTitle: string;
  wfModalLoadFailedFallback: string;
  wfModalProjectNumberPrefix: string;
  wfModalStatusPrefix: string;
  wfModalManagingDescription: string;
  wfModalUnknownTabPrefix: string;
  wfModalCompleteStepDefault: string;
  wfModalCompletePlanning: string;
  wfModalCompleteSubmissions: string;
  wfModalCompletePreWork: string;
  wfModalCompleteWork: string;
  wfModalCompletePostWork: string;
  wfModalCompleteProject: string;
  wfModalTabPlannedLabel: string;
  wfModalTabPlannedDesc: string;
  wfModalTabSubmissionLabel: string;
  wfModalTabSubmissionDesc: string;
  wfModalTabPreWorkLabel: string;
  wfModalTabPreWorkDesc: string;
  wfModalTabInProgressLabel: string;
  wfModalTabInProgressDesc: string;
  wfModalTabPostWorkLabel: string;
  wfModalTabPostWorkDesc: string;
  wfModalTabCompletedLabel: string;
  wfModalTabCompletedDesc: string;
  // PaymentPlanForm labels
  wfPaymentSetupTitle: string;
  wfPaymentTypeLabel: string;
  wfPaymentTypePlaceholder: string;
  wfPaymentTypeSingle: string;
  wfPaymentTypeRecurring: string;
  wfPaymentScheduleLabel: string;
  wfPaymentSchedulePlaceholder: string;
  wfPaymentScheduleWeekly: string;
  wfPaymentScheduleMonthly: string;
  wfPaymentScheduleQuarterly: string;
  wfPaymentScheduleYearly: string;
  wfPaymentScheduleCustom: string;
  wfPaymentFirstDateLabel: string;
  wfPaymentCustomDatesLabel: string;
  wfPaymentAddDateButton: string;
  wfPaymentHasInitialLabel: string;
  wfPaymentInitialAmountLabel: string;
  wfPaymentEqualLabel: string;
  wfPaymentRecurringAmountLabel: string;
  wfPaymentAmountsLabel: string;
  wfPaymentDistributeButton: string;
  wfPaymentAddPaymentButton: string;
  wfPaymentNumberPrefix: string;
  wfPaymentSummaryLabel: string;
  wfPaymentSummarySingle: string;
  wfPaymentSummaryWithInitialSuffix: string;
  wfPaymentSummaryEqualMiddle: string;
  wfPaymentSummaryPlusInitialSuffix: string;
  wfPaymentSummaryCustomSingular: string;
  wfPaymentSummaryCustomPlural: string;
  wfPaymentOver: string;
  wfPaymentUnder: string;
  wfPaymentBy: string;
  wfPaymentSavePlanButton: string;
  // ElementManagementTab labels
  wfElementsManagementTitle: string;
  wfElementsLoading: string;
  wfElementsFilteringByPrefix: string;
  wfElementsResultsSuffix: string;
  wfElementsAvailableTitle: string;
  wfElementsFilteredBySuffix: string;
  wfElementsAddSelectedButton: string;
  wfElementsProjectTitle: string;
  wfElementsDeselectAllButton: string;
  wfElementsSelectAllButton: string;
  wfElementsBulkActionsButton: string;
  wfElementsNoMatchPrefix: string;
  wfElementsNoMatchTitle: string;
  wfElementsTryDifferent: string;
  wfElementsUnknownElement: string;
  wfElementsProjectTypeFieldLabel: string;
  wfElementsBulkActionDescPrefix: string;
  wfElementsBulkActionDescSuffix: string;
  wfElementsChangeTypeOption: string;
  wfElementsRemoveOption: string;
  wfElementsSelectNewTypeLabel: string;
  wfElementsSelectTypePlaceholder: string;
  wfElementsWarningLabel: string;
  wfElementsRemoveButton: string;
  wfElementsUpdateTypeButton: string;
  wfElementsCompletingButton: string;
  wfElementsCompleteSubmissionButton: string;
  wfElementsNextLabel: string;
  wfElementsTypeRepairLabel: string;
  wfElementsTypeRepairDesc: string;
  wfElementsTypeMinorRehabLabel: string;
  wfElementsTypeMinorRehabDesc: string;
  wfElementsTypeMajorRehabLabel: string;
  wfElementsTypeMajorRehabDesc: string;
  wfElementsTypeReplacementLabel: string;
  wfElementsTypeReplacementDesc: string;
  wfElementsTypeAssessmentLabel: string;
  wfElementsTypeAssessmentDesc: string;
  // WorkflowTabNavigation labels
  wfNavLoading: string;
  wfNavWorkflowProgress: string;
  wfNavBadgeComplete: string;
  wfNavBadgeInProgress: string;
  wfNavCurrent: string;

  // Task #736 — Inventory & Projects translations (Bill 101 parity)
  ehfAddMaintenanceHistoryTitle: string;
  ehfEditMaintenanceHistoryTitle: string;
  ehfEditModeBadge: string;
  ehfRecordWorkPrefix: string;
  ehfUpdateEntryDescription: string;
  ehfEventTypeLabel: string;
  ehfEventTypePlaceholder: string;
  ehfEventTypeOriginalConstruction: string;
  ehfEventTypeOriginalConstructionDesc: string;
  ehfEventTypeRepair: string;
  ehfEventTypeRepairDesc: string;
  ehfEventTypeMinorRehab: string;
  ehfEventTypeMinorRehabDesc: string;
  ehfEventTypeMajorRehab: string;
  ehfEventTypeMajorRehabDesc: string;
  ehfEventTypeReplacement: string;
  ehfEventTypeReplacementDesc: string;
  ehfLifespanExtensionBadgeSuffix: string;
  ehfEventDateLabel: string;
  ehfSelectDate: string;
  ehfCostLabel: string;
  ehfWorkDescriptionLabel: string;
  ehfWorkDescriptionPlaceholder: string;
  ehfVendorInformationHeading: string;
  ehfVendorLabel: string;
  ehfVendorSelectPlaceholder: string;
  ehfNoVendorInternalWork: string;
  ehfVendorNameLabel: string;
  ehfVendorNameDesc: string;
  ehfVendorNamePlaceholder: string;
  ehfWarrantyInformationHeading: string;
  ehfWarrantyDurationLabel: string;
  ehfWarrantyTermsLabel: string;
  ehfWarrantyTermsPlaceholder: string;
  ehfWarrantyExpiresLabel: string;
  ehfLifespanImpactHeading: string;
  ehfAutoCalculate: string;
  ehfLifespanExtensionLabel: string;
  ehfAdditionalNotesLabel: string;
  ehfNotesPlaceholder: string;
  ehfCancel: string;
  ehfCreating: string;
  ehfSaving: string;
  ehfCreate: string;
  ehfSaveChanges: string;

  ihdrBackToBuildingButton: string;
  ihdrPageTitle: string;
  ihdrAddElement: string;
  ihdrSearchPlaceholder: string;
  ihdrFilters: string;
  ihdrOverdueLabel: string;
  ihdrOverdueEvaluations: string;
  ihdrConditionLabel: string;
  ihdrAllConditionsPlaceholder: string;
  ihdrAllConditionsItem: string;
  ihdrConditionExcellent: string;
  ihdrConditionGood: string;
  ihdrConditionFair: string;
  ihdrConditionPoor: string;
  ihdrConditionCritical: string;
  ihdrUniformatCategoryLabel: string;
  ihdrAllCategoriesPlaceholder: string;
  ihdrAllCategoriesItem: string;
  ihdrUniformatA: string;
  ihdrUniformatB: string;
  ihdrUniformatC: string;
  ihdrUniformatD: string;
  ihdrUniformatE: string;
  ihdrUniformatF: string;
  ihdrUniformatG: string;
  ihdrEvaluationStatusLabel: string;
  ihdrFilterOverdue: string;
  ihdrFilterDueSoon: string;
  ihdrFilterUpToDate: string;

  ubCatalogTitle: string;
  ubCommonButton: string;
  ubSearchPlaceholder: string;
  ubAllLevelsPlaceholder: string;
  ubAllLevelsItem: string;
  ubLevelLabel: string;
  ubAllCategoriesPlaceholder: string;
  ubAllCategoriesItem: string;
  ubCommonBadge: string;
  ubFilteredResultsPrefix: string;
  ubFilteredResultsSuffix: string;
  ubNoMatchingCodes: string;
  ubNoCodesAvailable: string;
  ubFailedToLoad: string;
  ubLoadErrorDesc: string;
  ubYearsSuffix: string;

  pcTypeEvaluation: string;
  pcTypeRepair: string;
  pcTypeMinorRehab: string;
  pcTypeMajorRehab: string;
  pcTypeReplacement: string;
  pcOverdueBadge: string;
  pcOverBudgetBadge: string;
  pcCriticalPriorityBadge: string;
  pcOpenMenu: string;
  pcQuickActionsLabel: string;
  pcEditProject: string;
  pcViewTimeline: string;
  pcAddNotes: string;
  pcStartWork: string;
  pcCompleteWork: string;
  pcUpdatedPrefix: string;
  pcDaysOverdueSuffix: string;
  pcDaysRemainingSuffix: string;
  pcProgressLabel: string;
  pcStartDateLabel: string;
  pcEndDateLabel: string;
  pcBudgetLabel: string;
  pcBudgetUsedSuffix: string;
  pcElementsLabel: string;
  pcElementsAssignedSuffix: string;
  pcBuildingComponents: string;
  pcStatusUpdatedTitle: string;
  pcStatusUpdatedDesc: string;
  pcUpdateFailedTitle: string;
  pcUpdateFailedDesc: string;

  emcEditElementLabel: string;
  emcEditButton: string;
  emcBuiltLabel: string;
  emcLastInspectionLabel: string;
  emcAgeLifespanLabel: string;
  emcLifespanProgressSuffix: string;
  emcConstructionLabel: string;
  emcUnknown: string;
  emcNever: string;
  emcNextEvaluationLabel: string;
  emcOverdueBadge: string;
  emcDueSoonBadge: string;
  emcScheduledBadge: string;
  emcTotalCostLabel: string;
  emcCostPerYearAvgSuffix: string;
  emcActivityLabel: string;
  emcEntriesSuffix: string;
  emcDocumentsSuffix: string;
  emcTimelineButton: string;
  emcYearsSuffix: string;
  emcExpectedLifespanSuffix: string;
  emcPhotoAltSuffix: string;

  etElementColumn: string;
  etConditionColumn: string;
  etAgeLifespanColumn: string;
  etLastInspectionColumn: string;
  etNextEvaluationColumn: string;
  etActionsColumn: string;
  etYearsSuffix: string;
  etNeverBadge: string;
  etOverdueBadge: string;
  etDueSoonBadge: string;
  etScheduledBadge: string;
  etNotSetBadge: string;
  etNotScheduledBadge: string;
  etViewButton: string;
  etEditButton: string;
  etSelectAllAria: string;
  etSelectElementAria: string;
  etElementsSelectedSuffix: string;
  etBulkEditButton: string;
  etChangeResidenceItem: string;
  etUpdateCostItem: string;
  etDeleteSelectedItem: string;
  etConfirmBulkDelete: string;
  etElementsDeletedTitle: string;
  etElementsDeletedDescPrefix: string;
  etElementsDeletedDescSuffix: string;
  etPartiallyCompletedTitle: string;
  etPartiallyCompletedDesc: string;
  etDeleteFailedTitle: string;
  etDeleteFailedDesc: string;
  etElementDeletedTitle: string;
  etElementDeletedDesc: string;
  etDeleteFailedSingleTitle: string;
  etDeleteFailedSingleDesc: string;
  etFailedToLoadTitle: string;
  etFailedToLoadDesc: string;
  etLoadingMessage: string;
  etNoElementsFoundTitle: string;

  htDateColumn: string;
  htEventTypeColumn: string;
  htDescriptionColumn: string;
  htVendorColumn: string;
  htCostColumn: string;
  htWarrantyColumn: string;
  htInternalLabel: string;
  htNoCostLabel: string;
  htWarrantyNoneLabel: string;
  htWarrantyYearSuffix: string;
  htWarrantyYearsSuffix: string;
  htWarrantyUntilPrefix: string;
  htOpenMenu: string;
  htEditEntry: string;
  htViewDocuments: string;
  htDeleteEntry: string;
  htDeleteHistoryTitle: string;
  htCancelButton: string;
  htDeleteButton: string;
  htTotalCostLabel: string;
  htCostPerYearAvgSuffix: string;
  htLifespanExtensionLabel: string;
  htLifespanFromInterventionsPrefix: string;
  htLifespanFromInterventionsSuffix: string;
  htLastMaintenanceLabel: string;
  htLastMaintenanceNever: string;
  htWorkEventsLabel: string;
  htMaintenanceHistoryTitle: string;
  htMaintenanceHistoryDescPrefix: string;
  htSearchPlaceholder: string;
  htNoHistoryTitle: string;
  htNoHistoryDesc: string;
  htReturnToInventory: string;
  htHistoryEntryDeletedTitle: string;
  htHistoryEntryDeletedDesc: string;
  htDeleteFailedTitle: string;
  htDeleteFailedDesc: string;
  htFailedToLoadTitle: string;
  htFailedToLoadDesc: string;
  htConstructionEventLabel: string;
  htRepairEventLabel: string;
  htMinorRehabEventLabel: string;
  htMajorRehabEventLabel: string;
  htReplacementEventLabel: string;
  htAuditDialogTitle: string;
  htAuditEditorLabel: string;
  htAuditTimestampLabel: string;
  htAuditSystemEditor: string;
  htAuditEmptyState: string;
  htAuditEmptyStateDetail: string;
  htAuditLoadError: string;
  htAuditRetry: string;
  htAuditFieldEventType: string;
  htAuditFieldEventDate: string;
  htAuditFieldWorkDescription: string;
  htAuditFieldCost: string;
  htAuditFieldVendor: string;
  htAuditFieldLifespanImpact: string;
  htAuditFieldWarranty: string;
  htAuditValueNotSet: string;
  htAuditBeforeLabel: string;
  htAuditAfterLabel: string;
  htAuditEditedIndicator: string;
  htAuditViewChanges: string;
  htAuditFieldColumnHeader: string;

  edpEditAction: string;
  edpUploadFilesAction: string;
  edpScheduleAction: string;
  edpDeleteAction: string;
  edpDeleteDialogTitle: string;
  edpDeleteDialogConfirmCancel: string;
  edpDeletingProgress: string;
  edpOverviewTab: string;
  edpDocumentsTab: string;
  edpProjectsTab: string;
  edpStatusEvaluationTitle: string;
  edpCurrentConditionLabel: string;
  edpNextEvaluationLabel: string;
  edpLastInspectionLabel: string;
  edpLastInspectionNever: string;
  edpUrgencyOverdueLabel: string;
  edpUrgencyDueSoonLabel: string;
  edpUrgencyScheduledLabel: string;
  edpUrgencyNotScheduledLabel: string;
  edpLifespanAnalysisTitle: string;
  edpAgeProgressLabel: string;
  edpYearsSuffix: string;
  edpNearingEndLifespan: string;
  edpAgingMonitor: string;
  edpGoodRemaining: string;
  edpOriginalLifespanLabel: string;
  edpCurrentLifespanLabel: string;
  edpConstructionDateLabel: string;
  edpSpecificationsTitle: string;
  edpQuantityLabel: string;
  edpUniformatCodeLabel: string;
  edpNotesLabel: string;
  edpUnknownSize: string;
  edpNoDocumentsUploaded: string;
  edpProjectNumberPrefix: string;
  edpNoRelatedProjects: string;
  edpElementDeletedToastTitle: string;
  edpElementDeletedToastDesc: string;

  iovHeaderTitle: string;
  iovToggleSrText: string;
  iovBuildingConstructionDate: string;
  iovDefaultForNewElements: string;
  iovTotalElementsTitle: string;
  iovBuildingInventoryItems: string;
  iovCriticalAlertsTitle: string;
  iovPoorOrCriticalCondition: string;
  iovOverdueEvaluationsTitle: string;
  iovPastDueDate: string;
  iovAssetValueTitle: string;
  iovEstimatedReplacementCost: string;
  iovConditionBreakdownTitle: string;
  iovQuickStatisticsTitle: string;
  iovKeyInsightsTrends: string;
  iovAverageAgeLabel: string;
  iovYearsSuffix: string;
  iovDueSoonLabel: string;
  iovMostCommonCategoryLabel: string;
  iovBuildingUpdatedTitle: string;
  iovBuildingUpdatedDesc: string;
  iovInvalidDateTitle: string;
  iovInvalidDateDesc: string;
  iovInvalidDateRangeDesc: string;
  iovConditionExcellent: string;
  iovConditionGood: string;
  iovConditionFair: string;
  iovConditionPoor: string;
  iovConditionCritical: string;
  // i18n migration (task 729): keys generated for previously-untranslated
  // JSX strings flagged by i18n/no-untranslated-jsx-strings after the
  // task-708 allow-list comments were removed.
  pwdDoesNotMeetRequirements: string;
  pwdSecTipUseUniqueCombination: string;
  pwdSecTipAvoidPersonalInfo: string;
  pwdSecTipDoNotReuse: string;
  pwdSecTipUsePasswordManager: string;
  pcsCompleteToFinalizeRegistration: string;
  qpcLaw25Heading: string;
  qpcConsentRequiredText: string;
  qpcMasterAcceptAllText: string;
  qpcEssentialDataLabel: string;
  qpcEssentialDataDesc: string;
  qpcMarketingDesc: string;
  qpcAnalyticsDesc: string;
  qpcThirdPartyDesc: string;
  qpcAcknowledgeRightsLabel: string;
  qpcAcknowledgeRightsDesc: string;
  qpcCheckboxRequiredWarning: string;
  qpcRightsHeading: string;
  qpcPortabilityDesc: string;
  qpcContactPara: string;
  qpcSecurityDesc: string;
  qpcRetentionDesc: string;
  qpcTransparencyDesc: string;
  tvsValidatingInvitationDesc: string;
  tvsNoTokenFoundDesc: string;
  tvsCannotValidateInvitation: string;
  tvsLinkExpiredOrInvalid: string;
  tvsCheckUseFullLink: string;
  tvsCheckNotExpired: string;
  tvsContactAdminIfPersists: string;
  tvsInvitationValidProceed: string;
  ffBusinessObjectivePlaceholder: string;
  ffSuccessMetricsPlaceholder: string;
  ffTimelinePlaceholder: string;
  ffDependenciesPlaceholder: string;
  ffDataReqPlaceholder: string;
  ffIntegrationNeedsPlaceholder: string;
  ffSecurityConsidPlaceholder: string;
  ffUserFlowPlaceholder: string;
  ffUiReqPlaceholder: string;
  ffAccessibilityPlaceholder: string;
  ffPerfReqPlaceholder: string;
  ffTestingStrategyPlaceholder: string;
  ffAdditionalNotesPlaceholder: string;
  ffsFeatureNamePlaceholder: string;
  ffsFeatureDescPlaceholder: string;
  ffsBusinessObjectivePlaceholder: string;
  ffsTargetUsersPlaceholder: string;
  ffsSuccessMetricsPlaceholder: string;
  ffsTimelinePlaceholder: string;
  ffsDependenciesPlaceholder: string;
  ffsDataReqPlaceholder: string;
  ffsIntegrationNeedsPlaceholder: string;
  ffsSecurityConsidPlaceholder: string;
  ffsUserFlowPlaceholder: string;
  ffsUiReqPlaceholder: string;
  ffsAccessibilityPlaceholder: string;
  ffsPerfReqPlaceholder: string;
  ffsTestingStrategyPlaceholder: string;
  ffsAdditionalNotesPlaceholder: string;
  apcDismissReasonPlaceholder: string;
  apdPlanningDescPlaceholder: string;
  ehfWorkDescPlaceholder: string;
  vfNotesPlaceholder: string;
  permSearchPlaceholder: string;
  fpEmailSentTitle: string;
  fpEmailSentDesc: string;
  fpCheckSpamFolder: string;
  fpEnterEmailToReceiveLink: string;
  fpSendSecureResetLinkDesc: string;
  iaWelcomeAccountCreated: string;
  iaCanLoginWithEmailPassword: string;
  iaConsentsRecordedLaw25: string;
  iaCompleteRegistrationToJoin: string;
  iaTermsAcceptanceFooter: string;
  rpResetCompleteDesc: string;
  rpInvalidLinkDesc: string;
  budgetReserveFundExamplePlaceholder: string;
  dtSuggestedProsLabel: string;
  dtSuggestedProsPlaceholder: string;
  dtPageTitle: string;
  dtPageSubtitle: string;
  dtViewToggleTags: string;
  dtViewToggleFamilies: string;
  dtSectionHeading: string;
  dtCreateButton: string;
  dtSystemCardTitle: string;
  dtCustomCardTitle: string;
  dtColName: string;
  dtColScope: string;
  dtColImportance: string;
  dtColProfessionals: string;
  dtColActions: string;
  dtReadOnly: string;
  dtLoading: string;
  dtEmpty: string;
  dtDialogEditTitle: string;
  dtDialogNewTitle: string;
  dtNameLabel: string;
  dtDescriptionLabel: string;
  dtScopeLabel: string;
  dtImportanceLabel: string;
  dtScopeAny: string;
  dtScopeBuilding: string;
  dtScopeResidence: string;
  dtImportanceObligatoire: string;
  dtImportanceNiceToHave: string;
  dtImportanceExtra: string;
  dtCancelButton: string;
  dtSaveButton: string;
  dtCreateSubmitButton: string;
  dtToastUpdatedTitle: string;
  dtToastCreatedTitle: string;
  dtToastDeletedTitle: string;
  dtToastErrorTitle: string;
  dtDeleteConfirm: string;
  dtNameRequired: string;
  dtKoveoTagLabel: string;
  dtKoveoTagHelper: string;
  lfSectionHeading: string;
  lfSectionDescription: string;
  lfCreateButton: string;
  lfSearchPlaceholder: string;
  lfSystemCardTitle: string;
  lfCustomCardTitle: string;
  lfLoading: string;
  lfEmpty: string;
  lfColName: string;
  lfColDescription: string;
  lfColActions: string;
  lfDialogEditTitle: string;
  lfDialogNewTitle: string;
  lfDialogDescription: string;
  lfNameLabel: string;
  lfDescriptionLabel: string;
  lfDescriptionPlaceholder: string;
  lfKoveoFamilyLabel: string;
  lfKoveoFamilyHelper: string;
  lfOrganizationLabel: string;
  lfOrganizationPlaceholder: string;
  lfCreateSubmitButton: string;
  lfToastCreatedTitle: string;
  lfToastUpdatedTitle: string;
  lfToastDeletedTitle: string;
  lfToastErrorTitle: string;
  lfDeleteConfirm: string;
  sfNameSequence: string;
  sfDescSequence: string;
  sfNameFinancial: string;
  sfDescFinancial: string;
  sfNameMeetingsAGA: string;
  sfDescMeetingsAGA: string;
  sfNameContracts: string;
  sfDescContracts: string;
  sfNameMaintenance: string;
  sfDescMaintenance: string;
  sfNameDeclarationCopropriete: string;
  sfDescDeclarationCopropriete: string;
  sfNameReglementsImmeuble: string;
  sfDescReglementsImmeuble: string;
  sfNameCertificatLocalisation: string;
  sfDescCertificatLocalisation: string;
  sfNameEtudeFondsPrevoyance: string;
  sfDescEtudeFondsPrevoyance: string;
  sfNameCarnetEntretien: string;
  sfDescCarnetEntretien: string;
  sfNameProcesVerbauxCA: string;
  sfDescProcesVerbauxCA: string;
  sfNameAvisCoproprietaires: string;
  sfDescAvisCoproprietaires: string;
  sfNameEtatsFinanciers: string;
  sfDescEtatsFinanciers: string;
  sfNameBudgetsAnnuels: string;
  sfDescBudgetsAnnuels: string;
  sfNameCotisationsSpeciales: string;
  sfDescCotisationsSpeciales: string;
  sfNameAssurances: string;
  sfDescAssurances: string;
  sfNameSinistres: string;
  sfDescSinistres: string;
  sfNamePermisAutorisations: string;
  sfDescPermisAutorisations: string;
  sfNameInspectionsImmeuble: string;
  sfDescInspectionsImmeuble: string;
  sfNameTravauxMajeurs: string;
  sfDescTravauxMajeurs: string;
  sfNameBaux: string;
  sfDescBaux: string;
  sfNameDossierCoproprietaire: string;
  sfDescDossierCoproprietaire: string;
  sfNameMutationsVentes: string;
  sfDescMutationsVentes: string;
  sfNameProceduresJuridiques: string;
  sfDescProceduresJuridiques: string;
  sfNameEvaluationsMunicipales: string;
  sfDescEvaluationsMunicipales: string;
  sfNameServicesPublics: string;
  sfDescServicesPublics: string;
  linkFamilyLabel: string;
  linkFamilyPlaceholder: string;
  linkFamilyNone: string;
  ihGlobalSearchPlaceholder: string;
  pdvFailedToLoadDashboard: string;
  pdvSelectBuildingForDashboard: string;
  pdvAnalyticsInsightsSubtitle: string;
  pdvProjectTrendsDesc: string;
  pdvBudgetTrendsDesc: string;
  pdvOverdueProjectsAlert: string;
  pdvExecSummaryDesc: string;
  pdpComprehensiveDetails: string;
  pdpFailedToLoadDetails: string;
  pdpElementsAssociatedDesc: string;
  pdpElementMgmtFullView: string;
  ptvFailedToLoadProjects: string;
  ptvSelectBuildingForProjects: string;
  ptvNoProjectsCreated: string;
  ptvGetStartedSuggestion: string;
  ptvNoProjectsMatchFilters: string;
  ptvAdjustFiltersHint: string;
  ptvRealTimeBulkActionsHint: string;
  ptlvFailedToLoadTimeline: string;
  ptlvSelectBuildingForTimeline: string;
  ptlvScheduleOverviewSubtitle: string;
  ptlvClickDateForEvents: string;
  ptlvOverdueEventsAlertSingular: string;
  ptlvOverdueEventsAlertPlural: string;
  povFailedToLoadMetrics: string;
  povConsiderReviewingPortfolio: string;
  siReviewAndSelectDesc: string;
  siFailedToLoadSuggestions: string;
  siProjectDefaultsDesc: string;
  confidenceBandHigh: string;
  confidenceBandMedium: string;
  confidenceBandLow: string;
  confidenceAiNotRun: string;
  confidenceLowTooltip: string;
  confidenceDefaultTooltip: string;
  confidenceAiNotRunTooltip: string;
  aiUnavailableNoApiKey: string;
  aiUnavailableMisconfigured: string;
  residenceUnitsLoadError: string;
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
    superAdmin: 'Super Admin',
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
    'bills.aiConfidenceHigh': 'AI is confident about this value',
    'bills.aiConfidenceMedium': 'Please verify this value',
    'bills.aiConfidenceLow': 'Low confidence — manual review recommended',
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
    failedToDeleteDocumentsCount_one: 'Failed to delete {count} document. Please try again.',
    failedToDeleteDocumentsCount_other: 'Failed to delete {count} documents. Please try again.',
    docManagerDocumentCount_one: '{count} document for {name}',
    docManagerDocumentCount_other: '{count} documents for {name}',
    bulkImportAnalyzing_one: '{count} document is still being analyzed. Wait for it to finish or exclude it to continue.',
    bulkImportAnalyzing_other: '{count} documents are still being analyzed. Wait for them to finish or exclude them to continue.',
    bulkImportResidenceIncomplete_one: '{count} residence document needs a residence selected before you can continue.',
    bulkImportResidenceIncomplete_other: '{count} residence documents need a residence selected before you can continue.',
    bulkImportBranchingPending_one: '{count} branching decision needs your review. Accept or choose manually to continue.',
    bulkImportBranchingPending_other: '{count} branching decisions need your review. Accept or choose manually to continue.',
    bulkImportFallbackPending_one: '{count} file needs a manual assignment (the AI could not process it). Review or exclude it to continue.',
    bulkImportFallbackPending_other: '{count} files need a manual assignment (the AI could not process them). Review or exclude them to continue.',
    bulkImportCommitted_one: '{count} document committed.',
    bulkImportCommitted_other: '{count} documents committed.',
    bulkImportNextStep: 'Next step',
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
    noResidenceLinkedTitle: 'No residence linked',
    noResidenceLinkedDescription: 'No residence is linked to your account yet. Contact your property manager.',
    selectYourResidence: 'Select your residence',
    selectYourBuilding: 'Select your building',
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
    plumbing: 'Plumbing',
    electrical: 'Electrical',
    hvac: 'HVAC',
    general: 'General',
    elevator: 'Elevator',
    submitMaintenanceRequest: 'Submit a maintenance request',
    managerWillBeNotified: 'Your manager will be notified.',
    maintenancePhotoOptional: 'Photo (optional)',
    maintenanceRequestSubmitted: 'Maintenance request submitted',
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
    selectPriority: 'Select priority',
    locationPlaceholder: 'e.g. Dashboard, Login page, Settings',
    uiUx: 'UI/UX',
    functionality: 'Functionality',
    performance: 'Performance',
    data: 'Data',
    integration: 'Integration',
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
    upvotedMessage: 'Upvoted!',
    upvotedDescription: 'Your upvote has been recorded.',
    failedUpvote: 'Failed to upvote',
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
    rescanCompliance: 'Re-scan',
    notAvailable: 'N/A',
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
    ganttEditProject: 'Edit dates',
    ganttSaveChanges: 'Save changes',
    ganttCancel: 'Cancel',
    ganttDiscardUnsaved: 'Discard unsaved changes?',
    ganttResizeStart: 'Drag to change start date',
    ganttResizeEnd: 'Drag to change end date',
    ganttDurationDays: 'days',
    budgetPlannedEndDate: 'Planned end date',
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
    myResidences: 'My Residences',
    noResidenceLinkedYet: 'No residence linked yet — contact your manager.',
    residencesLoadError: 'Unable to load your residences. Please try again later.',
    residenceRelationshipOwner: 'Owner',
    residenceRelationshipTenant: 'Tenant',
    residenceRelationshipOccupant: 'Occupant',
    residenceSince: 'Since',
    myBuilding: 'My Building',
    commonSpaces: 'Common Spaces',
    budget: 'Budget',
    bills: 'Bills',
    demands: 'Demands',
    navUserManagement: 'User Management',
    documentTags: 'Document Tags',
    manageCommonSpaces: 'Manage Common Spaces',
    pillars: 'Pillars',
    roadmap: 'Roadmap',
    navQualityAssurance: 'Quality Assurance',
    navLaw25Compliance: 'Law 25 Compliance',
    navBulkDocumentImport: 'Bulk Document Import',
    navKpiDashboard: 'KPI Dashboard',
    navImpersonationLog: 'Impersonation Log',
    navOrgAccess: 'Org Access',
    kpiDashboardTitle: 'KPI Dashboard',
    kpiDashboardSubtitle: 'Operational metrics aggregated from product telemetry.',
    kpiBulkImportFilenameTitle: 'Bulk import — AI filename suggestions',
    kpiBulkImportFilenameDescription: 'Acceptance of AI-suggested filenames during the bulk-document-import sorting step.',
    kpiBulkImportBranchTitle: 'Bulk import — AI branch destination',
    kpiBulkImportBranchDescription: 'Acceptance of the AI-suggested destination branch (building vs residence documents) during the branching step.',
    kpiBulkImportResidenceTitle: 'Bulk import — AI residence pick',
    kpiBulkImportResidenceDescription: 'Acceptance of the AI-suggested residence for items routed to residence documents.',
    kpiBulkImportEffectiveDateTitle: 'Bulk import — AI effective date',
    kpiBulkImportEffectiveDateDescription: 'Acceptance of the AI-suggested effective date during the identification step.',
    kpiBulkImportTagsTitle: 'Bulk import — AI tag suggestions',
    kpiBulkImportTagsDescription: 'Acceptance of the AI-suggested tag set during the identification step (set comparison).',
    kpiByLanguage: 'By UI language',
    kpiByBranchType: 'By branch type',
    kpiOverall: 'Overall',
    kpiAcceptRate: 'Accept rate',
    kpiTotalDecisions: 'Decisions',
    kpiVerbatim: 'Verbatim',
    kpiEdited: 'Edited',
    kpiCleared: 'Cleared',
    kpiNoSuggestion: 'No suggestion',
    kpiLanguage: 'Language',
    kpiBranchType: 'Branch type',
    kpiNoData: 'No telemetry recorded yet.',
    kpiLoadFailed: 'Failed to load KPI data.',
    kpiBranchKeep: 'Keep',
    kpiBranchMerge: 'Merge',
    kpiBranchSplit: 'Split',
    kpiBranchBuildingDocuments: 'Building documents',
    kpiBranchResidenceDocuments: 'Residence documents',
    kpiLangEnglish: 'English',
    kpiLangFrench: 'French',
    kpiLangUnknown: 'Unknown',
    kpiFiltersTitle: 'Filters',
    kpiFiltersDescription: 'Narrow the metrics down to a specific time window or organization.',
    kpiDateRange: 'Date range',
    kpiRangeLast7Days: 'Last 7 days',
    kpiRangeLast30Days: 'Last 30 days',
    kpiRangeLast90Days: 'Last 90 days',
    kpiRangeCustom: 'Custom range',
    kpiFrom: 'From',
    kpiTo: 'To',
    kpiPickDate: 'Pick a date',
    kpiPickRangeHint: 'Pick both a start and an end date to load metrics.',
    kpiOrganization: 'Organization',
    kpiAllOrganizations: 'All organizations',
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
    attachFile: 'Attach file',
    replaceFile: 'Replace file',
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
    
    titleRequired: 'Title is required',
    descriptionMinLength20: 'Description must be at least 20 characters',
    pageLocationRequired: 'Page/location is required',
    savingChanges: 'Saving...',
    fileAttached: 'File Attached',
    searchAndFilters: 'Search and Filters',
    categoryAndSort: 'Category and Sort',
    
    mostUpvotes: 'Most Upvotes',
    whyIsThisNeeded: 'Why is this needed?',
    chooseDocumentType: 'Choose Document Type',
    textDocument: 'Text Document',
    selectFileToUpload: 'Select file to upload',
    attachScreenshot: 'Attach a screenshot, mockup, or document',
    addDetailedNotes: 'Add detailed notes, specifications, or any additional information...',
    internalNotesVisibleAdmins: 'Internal Notes (visible to admins only)',
    currentAttachment: 'Current Attachment',
    uploadNewFileToReplace: 'Upload a new file to replace the current attachment',
    attachment: 'Attachment',
    attachments: 'Attachments',
    submittedOn: 'Submitted on',
    lastUpdatedOn: 'Last updated on',
    featureTitlePlaceholder: 'e.g. Add bulk export for documents',
    whyIsThisNeededPlaceholder: 'Explain the specific need this feature addresses...',
    pageLocationPlaceholder: 'e.g. Document Management',
    adminNotes: 'Admin Notes',
    search: 'Search',
    tryAdjustingSearchOrFilters: 'Try adjusting your search or filters.',
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
    noResidencesMatchSearch: 'No residences match your search.',
    
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
    budgetYearEndProjectionTooltip:
      'Balance projected at the end of the fiscal year. This value is independent of the chart window length.',
    budgetYearEndProjectionFiscalYearEndLabel: 'Fiscal year-end',
    budgetYearEndProjectionMonthsRemainingLabel: 'Months remaining',
    budgetYearEndProjectionMonthsRemainingUnit: 'months',
    budgetYearEndProjectionActiveFiscalYearLabel: 'Active fiscal year',
    budgetActiveFiscalYear: 'Active fiscal year',
    budgetLengthTooltip:
      'Controls the chart display horizon only. Does not affect the year-end projection.',
    budgetTotalInvestment: 'Total Investment',
    budgetNoDataForPeriod: 'No budget data for this period',
    budgetConfigureAction: 'Configure budget',
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
    firstDocumentOfChain: 'First document of chain',
    lastDocumentOfChain: 'Last document of chain',
    linkPositionLabel: 'Link as',
    chainPanelTitle: 'Sequence',
    chainPanelEmpty: 'No sequence yet — link a previous or next document to start one.',
    chainCurrentBadge: 'Current',
    chainRemoveAction: 'Remove from sequence',
    chainDragHandleLabel: 'Drag to reorder',
    chainReorderErrorTitle: 'Reorder failed',
    chainRemoveSuccessTitle: 'Removed from sequence',
    chainRemoveErrorTitle: 'Remove failed',
    notFoundTitle: 'Page not found',
    notFoundMessage: 'Page not found. Check the URL or return to the dashboard.',

    // Budget filter labels & section helpers
    budgetViewType: 'View Type',
    budgetPeriodWindow: 'Period Window',
    budgetStartDate: 'Start Date',
    budgetLength: 'Length',
    budgetDataVisibility: 'Data Visibility',
    budgetCapitalInvestmentsLabel: 'Capital Investments',
    budgetProjects: 'Projects',
    budgetMonthsCount: '{count} months',
    budgetYearsCount: '{count} years',
    budgetDataSummary: 'Data: {visible} of {total} categories visible',
    budgetLoadingData: 'Loading budget data...',

    // Law 25 compliance dashboard component
    law25ComplianceStatusTitle: 'Quebec Law 25 Compliance Status',
    complianceStatusExcellent: 'Excellent',
    complianceStatusGood: 'Good',
    complianceStatusFair: 'Fair',
    complianceStatusPoor: 'Poor',
    totalViolations: 'Total Violations',
    criticalViolationsLabel: 'Critical',
    lastScan: 'Last Scan',
    categoryDataCollection: 'Data Collection',
    categoryConsentManagement: 'Consent Management',
    categoryDataRetention: 'Data Retention',
    categorySecurityEncryption: 'Security & Encryption',
    categoryCrossBorderTransfer: 'Cross-Border Transfer',
    categoryDataSubjectRights: 'Data Subject Rights',
    compliantStatusLabel: 'Compliant',
    issuesFoundSingular: '{count} issue found',
    issuesFoundPlural: '{count} issues found',
    complianceViolations: 'Compliance Violations',
    moreViolationsLabel: '+{count} more violations',
    law25ComplianceGuide: 'Quebec Law 25 Compliance Guide',
    requiredComplianceAreas: 'Required Compliance Areas',
    requiredAreaExplicitConsent: 'Explicit consent for data collection',
    requiredAreaDataRetention: 'Data retention policies',
    requiredAreaEncryption: 'Encryption of personal data',
    requiredAreaDataSubjectRights: 'Data subject rights implementation',
    propertyManagementFocus: 'Property Management Focus',
    propMgmtTenantInfoProtection: 'Tenant personal information protection',
    propMgmtFinancialDataSecurity: 'Financial data security',
    propMgmtBuildingAccessProtection: 'Building access code protection',
    propMgmtMaintenancePrivacy: 'Maintenance request privacy',

    // Compliance page header
    compliancePageTitle: 'Quebec Law 25 Compliance',
    compliancePageSubtitle: 'Privacy compliance monitoring and violation tracking',

    // HOC titles
    buildingsManagementTitle: 'Buildings Management',
    projectsManagementTitle: 'Projects Management',
    inventoryManagementTitle: 'Inventory Management',

    // Buildings page extras
    buildingsLoadDataError: 'Failed to load buildings data. Please try again later.',
    deleteBuildingDialogTitle: 'Delete Building',
    deleteBuildingDialogConfirmation:
      'Are you sure you want to delete "{name}"? This action cannot be undone.',

    // Budget chart empty state
    budgetChartNoData: 'No data available for selected filters',
    budgetChartAdjustFilters: 'Try adjusting your filter settings',
    // Project workflow status names
    projectStatusPlanned: 'Planned',
    projectStatusEvaluation: 'Evaluation',
    projectStatusSubmissionStage: 'Submission',
    projectStatusPreWorkStage: 'Pre-Work',
    projectStatusInProgressStage: 'In Progress',
    projectStatusPostWorkStage: 'Post-Work',
    projectStatusCompletedStage: 'Completed',
    projectStatusPlannedDesc: 'Project is in planning phase',
    projectStatusEvaluationDesc: 'Under evaluation',
    projectStatusSubmissionDesc: 'Submitted for approval',
    projectStatusPreWorkDesc: 'Preparing for work',
    projectStatusInProgressDesc: 'Work is ongoing',
    projectStatusPostWorkDesc: 'Work completed, cleanup phase',
    projectStatusCompletedDesc: 'Project finished',
    // ProjectForm modal labels and copy
    projectFormCreateNewTitle: 'Create New Project',
    projectFormCreateFromSuggestionTitle: 'Create Project from Suggestion',
    projectFormEditTitle: 'Edit Project',
    projectFormCreateDescription: 'Create a new maintenance project to track work and manage resources.',
    projectFormEditDescription: 'Update project details and configuration.',
    projectFormSubmitCreate: 'Create Project',
    projectFormSubmitUpdate: 'Update Project',
    projectFormCreatingFromSuggestionTitle: 'Creating from Evaluation Suggestion',
    projectFormCreatingFromSuggestionDesc: 'This project is being created based on an evaluation suggestion. Some fields have been pre-populated for you.',
    projectFormQuickProjectDesc: 'Create a simplified project with essential fields only (Title, Description, Budget, Financial Year, Date)',
    projectFormTitleLabel: 'Title',
    projectFormTitlePlaceholder: 'e.g., Roof Repair - Building A',
    projectFormTitleDesc: 'Clear, descriptive name for the project',
    projectFormDescriptionLabel: 'Description',
    projectFormOptional: '(Optional)',
    projectFormDescriptionPlaceholderQuick: 'Brief description of the project...',
    projectFormDescriptionDescQuick: 'Optional detailed description',
    projectFormBudgetLabel: 'Budget',
    projectFormBudgetDescQuick: 'Project budget in dollars',
    projectFormFinancialYearLabel: 'Financial Year',
    projectFormFinancialYearDescQuick: 'Budget assignment year',
    projectFormFinancialYearDescStandard: 'Year this project counts against in budget forecasts and reports.',
    projectFormProjectDateLabel: 'Project Date',
    projectFormProjectDateDesc: 'Target completion date for the project',
    projectFormProjectNumberLabel: 'Project Number',
    projectFormProjectNumberPlaceholder: 'e.g., 2024-001',
    projectFormProjectNumberDesc: 'Unique identifier for this project',
    projectFormProjectTitleLabel: 'Project Title',
    projectFormDescriptionPlaceholderStandard: 'Detailed description of the project scope and objectives...',
    projectFormDescriptionDescStandard: 'Optional detailed description of the project',
    projectFormPlannedStartDateLabel: 'Planned Start Date',
    projectFormPlannedStartDateDesc: 'When the project is planned to start',
    projectFormTotalBudgetLabel: 'Total Budget',
    projectFormTotalBudgetDesc: 'Total allocated budget for this project',
    projectFormActualCostLabel: 'Actual Cost',
    projectFormActualCostDesc: 'Current actual cost spent on this project',
    projectFormToastBuildingIdRequired: 'Building ID is required but not available. Please refresh the page and try again.',
    projectFormToastPermissionDenied: 'Permission Denied',
    projectFormToastNoCreatePermission: "You don't have permission to create projects.",
    projectFormToastNoEditPermission: "You don't have permission to edit projects.",
    projectFormToastCreatedTitle: 'Project Created',
    projectFormToastUpdatedTitle: 'Project Updated',
    projectFormToastCreatedDesc: 'Project "{title}" has been created successfully.',
    projectFormToastUpdatedDesc: 'Project "{title}" has been updated successfully.',
    projectFormToastCreationFailed: 'Creation Failed',
    projectFormToastUpdateFailed: 'Update Failed',
    projectFormToastErrorOccurred: 'An error occurred',
    // StatusStepper copy
    statusStepperLabel: 'Project Status',
    statusStepperPercentComplete: '% Complete',
    statusStepperClickToAdvance: 'Click to advance',
    statusStepperLastUpdated: 'Last updated:',
    statusStepperToastUpdatedTitle: 'Status Updated',
    statusStepperToastUpdatedDesc: 'Project status has been updated to {status}.',
    statusStepperToastUpdateFailed: 'Update Failed',
    statusStepperToastUpdateFailedDesc: 'Failed to update status',
    statusStepperToastPermissionDenied: "You don't have permission to update project status.",
    statusStepperConfirmTitle: 'Confirm Status Change',
    statusStepperConfirmDesc: 'Are you sure you want to change the project status to {status}?',
    statusStepperConfirmCompletedNote: 'This will mark the project as fully completed.',
    statusStepperUpdating: 'Updating...',
    statusStepperConfirm: 'Confirm',
    statusStepperAdvanceTo: 'Advance to',
    statusStepperReturnTo: 'Return to',
    // Workflow tabs
    plannedTabCurrentStatus: 'Current Status:',
    plannedTabNoBuildingElementsAvailable: 'No building elements available. You may need to add elements to this building first.',
    plannedTabBuildingElementsLoading: 'Loading...',
    plannedTabBuildingElementsNotFound: 'No building elements found',
    plannedTabCreateNewElement: '+ Create new element',
    plannedTabElementCreatedSuccessTitle: 'Element created',
    plannedTabElementCreatedSuccessDesc: 'The new element has been added and selected for this project.',
    reopenStepTrigger: 'Reopen Step',
    reopenStepDialogTitle: 'Reopen Workflow Step',
    reopenStepDialogDescription: "Select which previous phase you'd like to reopen to. Your progress in future phases will be preserved.",
    reopenStepStatusPlanning: 'Planning',
    reopenStepStatusVendorSubmission: 'Vendor Submission',
    reopenStepStatusPreWork: 'Pre-Work',
    reopenStepStatusInProgress: 'In Progress',
    reopenStepStatusPostWork: 'Post-Work',
    reopenStepStatusCompleted: 'Completed',
    reopenStepSelectTargetTitle: 'Please select a target',
    reopenStepSelectTargetDesc: 'You must select which phase to reopen to.',
    reopenStepLoadTargetsFailed: 'Failed to load available reopen targets. Please try again.',
    reopenStepNoTargetsAvailable: 'No previous phases available to reopen to. The project must have completed at least one phase to use this feature.',
    reopenStepTargetPhaseLabel: 'Target Phase',
    reopenStepLoadingPhasesPlaceholder: 'Loading phases...',
    reopenStepSelectPhasePlaceholder: 'Select a phase to reopen to',
    reopenStepReasonLabel: 'Reason (optional)',
    reopenStepReasonPlaceholder: "Explain why you're reopening this step...",
    reopenStepNoteLabel: 'Note:',
    reopenStepNoteBody: 'Reopening to {phase} will preserve your progress in future phases. You can continue working where you left off.',
    reopenStepReopening: 'Reopening...',
    reopenStepReopenToPhase: 'Reopen to Phase',
    reopenStepSuccessTitle: 'Step Reopened',
    reopenStepSuccessDesc: 'Successfully reopened to {phase} phase.',
    reopenStepFailedTitle: 'Failed to Reopen',
    reopenStepFailedDesc: 'An error occurred while trying to reopen the step.',
    cannotReopenStepTitle: 'Cannot Reopen',
    failedToReopenStepTitle: 'Failed to Reopen',
    reopenStepWorkflowDataUnavailableDesc: 'Workflow data is not available. Please refresh the page and try again.',
    reopenStepWrongPhaseSubmissionDesc: 'This step can only be reopened when the project is currently in the Submission phase.',
    reopenStepWrongPhasePostWorkDesc: 'This step can only be reopened when the project is currently in the Post-Work phase.',
    reopenStepReturnedSuccessDesc: 'Successfully returned to the previous workflow step.',
    plannedTabHeader: 'Project Planning',
    plannedTabSubheader: 'Define the project description, planning timeline, and estimated cost',
    plannedTabDescriptionLabel: 'Description',
    plannedTabDescriptionPlaceholder: 'Describe the maintenance work needed, including scope, specific areas, and any special requirements...',
    plannedTabDescriptionHelp: 'Provide a detailed description of the planned maintenance work',
    plannedTabStartDateLabel: 'Start Planning Date',
    plannedTabStartDateHelp: 'When do you plan to start working on this project?',
    plannedTabEstimatedCostLabel: 'Estimated Cost',
    plannedTabEstimatedCostHelp: 'Estimated total cost for this project in dollars',
    plannedTabFinancialYearLabel: 'Financial Year',
    plannedTabFinancialYearHelp: 'The financial year for budget assignment. Costs will be allocated to the closest month in this year.',
    plannedTabBuildingElementsPlaceholder: 'Select building elements for this project',
    plannedTabBuildingElementsLoadingPlaceholder: 'Loading elements...',
    plannedTabBuildingElementsSearchPlaceholder: 'Search by name, code, or condition...',
    plannedTabBuildingElementsHelp: 'Select the building elements that will be affected by this maintenance project.',
    plannedTabSuccessTitle: 'Success',
    plannedTabSuccessDesc: 'Project planning completed and moved to submission stage.',
    plannedTabWarningTitle: 'Warning',
    plannedTabElementsUpdateWarningDesc: 'Project saved but there was an issue updating the selected elements.',
    workflowNextLabel: 'Next:',
    workflowSavingButton: 'Saving...',
    workflowSaveChangesButton: 'Save Changes',
    workflowCompletingButton: 'Completing...',
    workflowCompletePlanningPhaseButton: 'Complete Planning Phase',
    workflowAllTasksCompleted: 'All tasks completed!',
    workflowErrorTitle: 'Error',
    workflowSuccessTitle: 'Success',
    postWorkProjectDataMissing: 'Project data is missing. Unable to load the post-work tab.',
    postWorkFailedUpdateConfirmation: 'Failed to update element confirmation',
    postWorkAllElementsConfirmedDesc: 'All elements confirmed successfully',
    postWorkFailedConfirmAll: 'Failed to confirm all elements',
    postWorkAllChangesSavedDesc: 'All changes saved successfully',
    postWorkFailedSaveSomeChanges: 'Failed to save some changes',
    postWorkFailedApplyInventoryChangesDesc: 'Failed to apply inventory changes. Please try again.',
    postWorkCompletionFailedTitle: 'Completion Failed',
    postWorkFailedMarkCompleteDesc: 'Failed to mark the project complete. Please try again.',
    postWorkUnexpectedErrorDesc: 'An unexpected error occurred. Please try again.',
    postWorkActivitiesHeader: 'Post-Work Activities',
    postWorkActivitiesSubheader: 'Manage cleanup, finalization, and project closure tasks',
    postWorkSkippableInfo: 'This step can be skipped in tab navigation',
    autoGeneratedProjectTitle: 'Auto-Generated Project',
    autoGeneratedProjectDesc: 'This project was automatically generated and may have pre-populated fields and tasks based on system analysis. You can modify all information as needed.',
    postWorkTasksTitle: 'Post-Work Tasks',
    postWorkTasksDesc: 'Cleanup, finalization, and closure tasks to complete the project',
    postWorkCompletedCounter: 'completed',
    postWorkAddTaskButton: 'Add Task',
    postWorkNoTasksDefined: 'No post-work tasks defined',
    postWorkAddCleanupTasksHint: 'Add cleanup and finalization tasks',
    postWorkTaskDescriptionPlaceholder: 'Task description (required)',
    postWorkTaskDoneLabel: 'Done',
    postWorkTaskPendingLabel: 'Pending',
    postWorkElementLifespanImpactTitle: 'Element Lifespan Impact',
    postWorkElementLifespanImpactDesc: 'Review and confirm the lifespan impact of interventions on each project element',
    postWorkConfirmedCounter: 'confirmed',
    postWorkConfirmAllButton: 'Confirm All',
    postWorkNoElementsLinked: 'No elements linked to this project',
    postWorkElementsMustBeAddedDuringPlanning: 'Elements must be added during the planning phase',
    postWorkUnknownElement: 'Unknown Element',
    postWorkNoCode: 'No code',
    postWorkPlannedWork: 'Planned work: {description}',
    postWorkConfirmedBadge: 'Confirmed',
    postWorkInterventionTypeLabel: 'Intervention Type',
    postWorkSelectInterventionTypePlaceholder: 'Select intervention type',
    postWorkInterventionNoWork: 'No Work',
    postWorkInterventionRepair: 'Repair',
    postWorkInterventionMinorRehab: 'Minor Rehab',
    postWorkInterventionMajorRehab: 'Major Rehab',
    postWorkInterventionReplacement: 'Replacement',
    postWorkSuggestedStandardLifespanLabel: 'Suggested Standard Lifespan',
    postWorkYearsCount: '{count} years',
    postWorkYearsUnit: 'years',
    postWorkUniformatStandardLifespanHelp: 'UNIFORMAT standard lifespan for this element type',
    postWorkRemainingLifespanBeforeLabel: 'Remaining Lifespan Before',
    postWorkNotSpecified: 'Not specified',
    postWorkUniformatStandardWithExtension: 'UNIFORMAT standard: {standard} years • Suggested extension: {extension} years ({percent}%)',
    postWorkLifespanImpactYearsLabel: 'Lifespan Impact (Years)',
    postWorkSuggestedValue: 'Suggested: {value}',
    postWorkYearsAddedToRemainingLifespan: 'Years added to remaining lifespan',
    postWorkImpactSummaryLabel: 'Impact Summary:',
    postWorkThisWorkWill: 'This work will',
    postWorkSetLifespanToYearsTemplate: "set the element's lifespan to {years} year(s) starting from the date of the work",
    postWorkAddYearsToLifespanTemplate: "add {years} year(s) to the element's remaining lifespan",
    postWorkNotChangeRemainingLifespan: 'not change the remaining lifespan',
    postWorkElementConfirmationsLabel: 'Element Confirmations',
    postWorkAllElementsConfirmed: 'All elements confirmed!',
    postWorkProgressSummaryTitle: 'Progress Summary',
    postWorkTasksCompletedLabel: 'Tasks completed',
    postWorkMarkProjectCompleteButton: 'Mark Project Complete',
    postWorkCompleteAllTasksToProceed: 'Complete all tasks to proceed',
    postWorkConfirmAllElementsToProceed: 'Confirm all element lifespan impacts to proceed',
    postWorkConfirmProjectCompletionTitle: 'Confirm Project Completion',
    postWorkConfirmProjectCompletionDesc: 'Completing this project will apply changes to your building element inventory.',
    postWorkFollowingChangesWillBeApplied: 'The following changes will be applied to your building element inventory:',
    postWorkWillBeMarkedAsReplaced: 'Will be marked as replaced with new construction date',
    postWorkNewLifespanLine: 'New lifespan: {years} years',
    postWorkCurrentLifespanWillBeExtendedBy: 'Current lifespan will be extended by {years} years',
    postWorkInterventionTypeLine: 'Intervention type: {type}',
    postWorkNoChangesWillBeApplied: 'No changes will be applied',
    postWorkTheseChangesCannotBeUndone: 'These changes cannot be undone. Are you sure you want to complete this project?',
    postWorkConfirmAndCompleteProjectButton: 'Confirm & Complete Project',
    postWorkCompletingButton: 'Completing...',
    submissionProjectDataMissing: 'Project data is missing. Unable to load the submission tab.',
    submissionUploadInProgressTitle: 'Upload in progress',
    submissionUploadInProgressSaveDesc: 'Please wait for document uploads to finish before saving.',
    submissionUploadInProgressSubmitDesc: 'Please wait for document uploads to finish before submitting.',
    submissionUploadFailedTitle: 'Upload failed',
    submissionUploadFailedDescTemplate: 'Could not upload {fileName}. Please try again.',
    submissionManagementHeader: 'Submission Management',
    submissionManagementSubheader: 'Manage vendor submissions and project elements',
    submissionVendorSubmissionsHeader: 'Vendor Submissions',
    submissionVendorSubmissionsSubheader: 'Review and select from vendor proposals and quotes',
    submissionElementManagementTab: 'Element Management',
    submissionAddSubmissionButton: 'Add Submission',
    submissionVendorSubmittedDate: 'Submitted',
    submissionEditButton: 'Edit',
    submissionDeleteButton: 'Delete',
    submissionPreferredBadge: 'Preferred',
    submissionDeleteVendorConfirmTitle: 'Delete Vendor Submission',
    submissionDeleteVendorConfirmDesc: 'Are you sure you want to delete this vendor submission? This action cannot be undone.',
    submissionEditVendorTitle: 'Edit Vendor Submission',
    submissionAddSubmissionDescriptionSr: 'Create a new vendor submission with payment plan and document attachments',
    submissionEditDialogDescription: 'Update the vendor submission details, payment plan, and document attachments',
    submissionAddNewVendorTitle: 'Add New Vendor Submission',
    submissionVendorNameLabel: 'Vendor Name *',
    submissionVendorNamePlaceholder: 'Enter vendor name',
    submissionAvailableDateLabel: 'Available Date',
    submissionDescriptionLabel: 'Description',
    submissionDescriptionPlaceholder: "Describe the vendor's proposal...",
    submissionPaymentPlanHeader: 'Payment Plan',
    submissionPaymentTypeLabel: 'Payment Type',
    submissionSelectPaymentTypePlaceholder: 'Select payment type',
    submissionPaymentTypeOneTime: 'One-time Payment',
    submissionPaymentTypeRecurring: 'Recurring Payments',
    submissionTotalAmountLabel: 'Total Amount',
    submissionPaymentDateLabel: 'Payment Date',
    submissionPaymentScheduleLabel: 'Payment Schedule',
    submissionSelectPaymentSchedulePlaceholder: 'Select payment schedule',
    submissionScheduleWeekly: 'Weekly',
    submissionScheduleMonthly: 'Monthly',
    submissionScheduleQuarterly: 'Quarterly',
    submissionScheduleYearly: 'Yearly',
    submissionScheduleCustom: 'Custom Schedule',
    submissionDateFirstPaymentLabel: 'Date First Payment',
    submissionDateEndPaymentLabel: 'Date End Payment',
    submissionHasInitialPaymentLabel: 'Has initial payment',
    submissionInitialPaymentAmountLabel: 'Initial Payment Amount',
    submissionEqualRecurringLabel: 'Equal recurring payments',
    submissionRecurringPaymentAmountLabel: 'Recurring Payment Amount',
    submissionCustomPaymentAmountsLabel: 'Custom Payment Amounts',
    submissionCustomPaymentAmountSubLabel: 'Amount',
    submissionCustomPaymentDateSubLabel: 'Date',
    submissionCustomPaymentDescriptionSubLabel: 'Description (Optional)',
    submissionCustomPaymentDescriptionPlaceholder: 'Payment description',
    submissionMarkAsPreferredLabel: 'Mark as Preferred',
    submissionMarkAsPreferredVendorLabel: 'Mark as preferred vendor',
    submissionNoVendorSubmissionsHeader: 'No Vendor Submissions Yet',
    submissionProposalDetailsHeader: 'Proposal Details',
    submissionNoDescriptionProvided: 'No description provided',
    submissionPaymentBreakdownLabel: 'Payment breakdown:',
    submissionContactInformationHeader: 'Contact Information',
    submissionVendorNameLabelEdit: 'Vendor Name',
    submissionContactInformationLabel: 'Contact Information',
    submissionContactInformationPlaceholder: 'Enter contact information',
    submissionDescriptionPlaceholderEdit: 'Enter description or notes',
    submissionAddPaymentButton: 'Add Payment',
    submissionPaymentTypeDescription: 'Choose whether this is a single payment or multiple payments over time',
    submissionTotalAmountDescription: 'Enter the total amount for this one-time payment',
    submissionPaymentDateDescription: 'The date when this payment is due',
    submissionHasInitialPaymentDescription: "Check if there's a different initial payment amount",
    submissionEqualRecurringDescription: 'Check if all recurring payments are the same amount',
    submissionMarkAsPreferredDescription: 'Flag this vendor as a preferred choice',
    submissionCancelButton: 'Cancel',
    submissionAddingButton: 'Adding...',
    submissionFailedToLoadVendors: 'Failed to load vendor submissions',
    submissionContactAvailable: 'Contact Available',
    submissionAvailableLabel: 'Available',
    submissionUnmarkPreferredButton: 'Unmark Preferred',
    submissionMarkAsPreferredButton: 'Mark as Preferred',
    submissionAvailableForWorkLabel: 'Available for work',
    submissionExtendsLifespanTemplate: 'Extends lifespan: {years} years',
    submissionDocumentsSubmittedTemplate_one: '{count} document submitted',
    submissionDocumentsSubmittedTemplate_other: '{count} documents submitted',
    submissionPaymentScheduleSummaryTemplate: 'Schedule: {schedule}',
    submissionPaymentStartsTemplate: 'Starts: {date}',
    submissionPaymentItemTemplate: 'Payment {index}: {amount}',
    submissionNoPaymentPlanConfigured: 'No payment plan configured yet',
    submissionEditPaymentPlanTitleTemplate: 'Edit Payment Plan - {vendor}',
    submissionEditPaymentPlanDescription: 'Configure payment schedule, costs, and timing for this vendor submission',
    submissionNoSubmissionsYetTitle: 'No Submissions Yet',
    submissionNoSubmissionsYetDescription: 'No vendor submissions have been received for this project',
    submissionNoVendorSubmissionsYetMessage: 'Add vendor submissions with their quotes, availability, and proposal documents.',
    submissionPreferredCountTemplate: '{count} Preferred',
    submissionUpdatingButton: 'Updating...',
    submissionSaveChangesButton: 'Save Changes',
    submissionEditVendorTitleTemplate: 'Edit Vendor - {vendor}',
    submissionEditVendorDialogDescription: 'Edit vendor information, documents, and preferences for this submission',
    submissionDocumentsTitle: 'Documents',
    submissionMarkAsPreferredEditDescription: 'Mark this vendor as preferred for this project',
    submissionDeleteVendorButton: 'Delete Vendor',
    submissionCompletingButton: 'Completing...',
    submissionCompleteSubmissionPhaseButton: 'Complete Submission Phase',
    submissionDocumentsOptionalTitle: 'Documents (Optional)',
    workflowStepCanBeSkipped: 'This step can be skipped in tab navigation',
    workflowAutoGeneratedProjectTitle: 'Auto-Generated Project',
    workflowFailedToSavePhaseDescription: 'Failed to save changes before completing phase',
    workflowPleaseWaitTitle: 'Please wait',
    workflowSavingTaskChangesDescription: 'Saving task changes. Try again in a moment.',
    preWorkPreparationHeader: 'Pre-Work Preparation',
    preWorkNoTasksDefined: 'No preparation tasks defined',
    preWorkAddTasksHelper: 'Add tasks that need to be completed before work starts',
    inProgressHeader: 'Work In Progress',
    inProgressNoWorkTasksDefined: 'No work tasks defined',
    inProgressAddTasksHelper: 'Add tasks to track work progress',
    workflowProgressSummaryTitle: 'Progress Summary',
    workflowTasksCompletedLabel: 'Tasks completed',
    preWorkSetupTasksSubheader: 'Set up preparation tasks and user notifications',
    preWorkPreparationTasksTitle: 'Preparation Tasks',
    preWorkPreparationTasksDescription: 'Define tasks that need to be completed before work begins',
    preWorkAddTaskButton: 'Add Task',
    preWorkTaskDescriptionPlaceholder: 'Task description (required)',
    preWorkTaskDoneBadge: 'Done',
    preWorkTaskPendingBadge: 'Pending',
    preWorkNotificationSettingsTitle: 'Notification Settings',
    preWorkNotificationSettingsDescription: 'Set up automated reminders that will be sent to all users linked to this building',
    preWorkNotificationMessageLabel: 'Notification Message',
    preWorkNotificationMessagePlaceholder: 'Enter notification message...',
    preWorkTimingLabel: 'Timing',
    preWorkDaysBeforeLabel: 'Days Before',
    preWorkUpdateNotificationButton: 'Update Notification',
    preWorkAddNotificationButton: 'Add Notification',
    preWorkCancelButton: 'Cancel',
    preWorkCreatedNotificationsTemplate: 'Created Notifications ({count})',
    preWorkSentBadge: 'Sent',
    preWorkPendingBadge: 'Pending',
    preWorkCustomDaysBeforeTemplate: '{days} days before',
    preWorkCompletingButton: 'Completing...',
    preWorkCompletePhaseButton: 'Complete Pre-Work Phase',
    preWorkTimingOneDayBefore: '1 Day Before',
    preWorkTimingThreeDaysBefore: '3 Days Before',
    preWorkTimingOneWeekBefore: '1 Week Before',
    preWorkTimingCustom: 'Custom',
    inProgressSubheader: 'Manage active work execution and track progress',
    inProgressWorkTasksTitle: 'Work Tasks',
    inProgressWorkTasksDescription: 'Set reminder to for task to do by the manager during the work',
    inProgressTaskCountTemplate: '{completed} / {total} completed',
    inProgressAddTaskButton: 'Add Task',
    inProgressTaskDescriptionPlaceholder: 'Task description (required)',
    inProgressMarkWorkCompleteButton: 'Mark Work Complete',
    preWorkNewTaskDefault: 'New Task',
    inProgressNewWorkTaskDefault: 'New Work Task',

    // Settings - delete account & data export
    downloadYourData: 'Download Your Data',
    downloadYourDataDescription:
      'Export all your personal data including profile information, bills, documents, and activity history.',
    deleteYourAccount: 'Delete Your Account',
    deleteYourAccountWarning:
      'Permanently delete your account and all associated data. This action cannot be undone.',

    // Maintenance projects page
    backToBuildingArrow: '← Back to Building',
    searchProjects: 'Search Projects',
    searchByNamePlaceholder: 'Search by name...',
    overdueOnly: 'Overdue Only',
    projectName: 'Project Name',
    startDate: 'Start Date',
    paginationShowingResults: 'Showing {start} to {end} of {total} result(s)',
    noProjectsFoundTitle: 'No Projects Found',
    noProjectsForBuilding: 'No maintenance projects have been created for this building yet.',
    profileSettings: 'Profile Settings',
    failedToLoadProjects: 'Failed to Load Projects',
    errorLoadingProjects: 'There was an error loading the projects. Please try again.',
    deleteAccountPermanently: 'Delete Account Permanently',
    deleteAccountIntro: 'This will permanently delete your account and all associated data, including:',
    deleteAccountItemProfile: 'Your profile information',
    deleteAccountItemDocuments: 'All documents and files',
    deleteAccountItemBills: 'Bill history and payments',
    deleteAccountItemMaintenance: 'Maintenance requests',
    deleteAccountItemOther: 'All other personal data',
    deleteAccountIrreversible: 'This action cannot be undone.',
    confirmEmailToProceed: 'Confirm your email to proceed',
    reasonForDeletionOptional: 'Reason for deletion (optional)',
    reasonForDeletionPlaceholder: 'Let us know why you are deleting your account...',
    // i18n migration (task 691): EN strings for previously-untranslated JSX text.
    chooseABuildingToViewAnd: 'Choose a building to view and manage its bills',
    creatingThisBillWillAutomaticallyUpdate: 'Creating this bill will automatically update the source bill\'s end date to prevent double counting in budget calculations.',
    createBillFromAutoGeneratedTemplate: 'Create Bill from Auto-Generated Template',
    clickAddPaymentToGetStarted: 'Click "Add Payment" to get started',
    thisMayTakeAFewSeconds: 'This may take a few seconds depending on document complexity.',
    extractingDataFromYourDocument: 'Extracting data from your document...',
    useTheUploadSectionAboveTo: 'Use the upload section above to attach files',
    formFieldsHaveBeenAutomaticallyPopulated: 'Form fields have been automatically populated with extracted data.',
    aiIsAnalyzingYourDocument: 'AI is analyzing your document...',
    historicalPerformanceDataAndImprovements: 'Historical performance data and improvements',
    priorityOrderedOptimizationSuggestions: 'Priority-ordered optimization suggestions',
    componentOptimizationRecommendations: 'Component Optimization Recommendations',
    mostCommonOptimizationOpportunities: 'Most common optimization opportunities',
    identificationOfPerformanceBottlenecks: 'Identification of performance bottlenecks',
    realTimeServerMetricsAndStatus: 'Real-time server metrics and status',
    queryExecutionMetricsAndOptimizationStatus: 'Query execution metrics and optimization status',
    currentPerformanceMetricsBreakdown: 'Current performance metrics breakdown',
    realTimeWebVitalsPerformanceTracking: 'Real-time Web Vitals performance tracking',
    realTimeMonitoringAndOptimizationInsights: 'Real-time monitoring and optimization insights',
    priorityDistributionRecommendations: 'Priority Distribution & Recommendations',
    basedOnCurrentVelocityExpect15: 'Based on current velocity, expect 15% improvement in overall effectiveness next week.',
    documentationCategoryNeedsFocusOnly45: 'Documentation category needs focus - only 45% completion rate detected.',
    securitySuggestionsShow92CompletionRate: 'Security suggestions show 92% completion rate - highest performing category this week.',
    noInsightsAvailableRunAnAi: 'No insights available. Run an AI analysis to generate recommendations.',
    continuousImprovementRecommendationsFromAiAnalysis: 'Continuous improvement recommendations from AI analysis',
    noRecentInteractionsRecorded: 'No recent interactions recorded',
    realTimeLogOfAiAgent: 'Real-time log of AI agent activities and improvements',
    realTimeMonitoringOfReplitAi: 'Real-time monitoring of Replit AI agent effectiveness',
    trackAiInteractionsAndContinuousImprovement: 'Track AI interactions and continuous improvement suggestions',
    deletedItemsAreSoftDeletedAnd: 'Deleted items are soft-deleted and may be recoverable by system administrators.',
    unableToAnalyzeDeletionImpactProceed: 'Unable to analyze deletion impact. Proceed with caution.',
    noRelatedEntitiesWillBeAffected: 'No related entities will be affected.',
    willCascadeAndRemoveAllRelated: 'will cascade and remove all related data.',
    thisActionCannotBeUndoneDeleting: 'This action cannot be undone. Deleting this',
    thisActionCannotBeUndonePlease: 'This action cannot be undone. Please review the impact before proceeding.',
    changesAreAutomaticallySavedAfterYou: '✨ Changes are automatically saved after you stop typing',
    createATextOnlyDocumentEntry: 'Create a text-only document entry. You can add formatting and additional details later.',
    selectHowYouDLikeTo: 'Select how you\'d like to add your file',
    aiAnalysisWillExtractKeyInformation: '✨ AI analysis will extract key information automatically',
    onDesktopDragDropClickTo: '💻 On desktop: Drag & drop, click to browse, or paste screenshots (Ctrl+V)',
    onMobileTapToUseCamera: '📱 On mobile: Tap to use camera or select from gallery',
    dropFilesHereOrClickTo: 'Drop files here or click to browse',
    billDocumentsTenantReadOnly: 'Bill Documents (Tenant - Read Only)',
    pleaseCorrectTheFollowingErrors: 'Please correct the following errors:',
    generatedDevelopmentPromptFor: 'Generated development prompt for',
    optionalMockupsWireframesScreenshotsRequirementsDocs: '(Optional - Mockups, wireframes, screenshots, requirements docs)',
    forEachRoleSpecifyReadWrite: 'For each role, specify read/write permissions and organizational limitations.',
    enableRoleBasedAccessControlFor: 'Enable role-based access control for this feature',
    doesThisFeatureRequireRbac: 'Does this feature require RBAC?',
    roleBasedAccessControlRbac: 'Role-Based Access Control (RBAC)',
    markThisFeatureAsPartOf: 'Mark this feature as part of the strategic roadmap',
    markAsAStrategicDevelopmentPriority: 'Mark as a strategic development priority',
    saveAsAnActionableItemTo: 'Save as an actionable item to track implementation progress',
    requestSpecificImplementationDetailsOrAsk: 'Request specific implementation details or ask follow-up questions',
    theAiWillHaveFullContext: 'The AI will have full context about Koveo Gestion\'s architecture and requirements',
    copyThisPromptAndPasteIt: 'Copy this prompt and paste it into ChatGPT, Claude, or another AI assistant',
    noCustomDatesAddedClickAdd: 'No custom dates added. Click "Add Date" to add payment dates.',
    extractingInvoiceDataWithAiThis: 'Extracting invoice data with AI... This may take a few seconds.',
    pleaseFixTheFollowingErrors: 'Please fix the following errors:',
    supportedImagesPdfDocXlsTxt: 'Supported: Images, PDF, DOC, XLS, TXT',
    reasonForDismissalOptional: 'Reason for dismissal (optional)',
    areYouSureYouWantTo: 'Are you sure you want to dismiss this auto-generated project? This action cannot be undone.',
    skipVendorSubmissionsDefaultForAuto: 'Skip vendor submissions (default for auto-projects)',
    configureWhichWorkflowStepsShouldBe: 'Configure which workflow steps should be skipped for this auto-generated project.',
    whenDidOrWillTheActual: 'When did or will the actual work begin? Leave empty if not yet determined.',
    thisWillBeUsedAsThe: 'This will be used as the project\'s planning description in the workflow.',
    tryAdjustingYourSearchTermsOr: 'Try adjusting your search terms or filters to see more results.',
    theseProjectsWereAutomaticallyGeneratedBy: 'These projects were automatically generated by AI based on building evaluations and maintenance schedules. Review, edit if needed, and accept to convert them into active maintenance projects.',
    aiGeneratedProjectSuggestionsWillAppear: 'AI-generated project suggestions will appear here when available. These are automatically created based on building evaluations and maintenance schedules.',
    failedToLoadAutoGeneratedProjects: 'Failed to load auto-generated projects. Please try refreshing.',
    loadingAutoGeneratedProjects: 'Loading auto-generated projects...',
    eachElementWillHaveAUnit: 'Each element will have a unit cost of $',
    eachElementWillHaveAReconstruction: 'Each element will have a reconstruction cost of $',
    costPerUnitEG50: 'Cost per unit (e.g., $50 per m² for flooring, $200 per m for railings)',
    totalReconstructionCostForEachElement: 'Total reconstruction cost for each element (e.g., $5,000 per window)',
    updateReconstructionCostsFor: 'Update reconstruction costs for',
    updateResidenceAssignmentAccessTypeAnd: 'Update residence assignment, access type, and charge type for',
    pleaseWaitWhileWeProcessYour: 'Please wait while we process your file',
    saveTheElementToEnableDocument: 'Save the element to enable document uploads',
    noDocumentsAttachedToThisAsset: 'No documents attached to this asset',
    areYouSureYouWantTo2: 'Are you sure you want to delete "',
    automaticallyCalculatedBasedOnConditionAnd: 'Automatically calculated based on condition and remaining years',
    navigateLevel1Level2Level: 'Navigate: Level 1 → Level 2 → Level 3 (only Level 3 can be selected for elements)',
    anyAdditionalInformationOrObservations: 'Any additional information or observations',
    automaticallyCalculatedBasedOnEventType: 'Automatically calculated based on event type and cost',
    additionalYearsAddedToElementLifespan: 'Additional years added to element lifespan',
    briefDescriptionOfWarrantyCoverage: 'Brief description of warranty coverage',
    selectFromExistingVendorsOrEnter: 'Select from existing vendors or enter name below',
    detailedDescriptionOfTheWorkPerformed: 'Detailed description of the work performed',
    totalCostOfTheWorkOptional: 'Total cost of the work (optional)',
    startBuildingYourInventoryByAdding: 'Start building your inventory by adding building elements.',
    areYouSureYouWantTo3: 'Are you sure you want to delete this history entry? This action cannot be undone and may affect element lifespan calculations.',
    detailedBreakdownOfCostsAndAllocations: 'Detailed breakdown of costs and allocations for this budget category.',
    thereWasAnErrorLoadingThe: 'There was an error loading the project budget. Please try again.',
    areYouSureYouWantTo4: 'Are you sure you want to remove this element from the project? This action cannot be undone.',
    updateCostAllocationAndWorkDetails: 'Update cost allocation and work details for this element.',
    allAvailableElementsAreAlreadyAssigned: 'All available elements are already assigned to this project.',
    selectBuildingElementsToIncludeIn: 'Select building elements to include in this project and optionally set cost allocation and work details.',
    noElementsAssignedToThisProject: 'No elements assigned to this project yet.',
    planningOnlyProjectThatCannotAdvance: 'Planning-only project that cannot advance beyond planning phase',
    selectBuildingElementsToIncludeIn2: 'Select building elements to include in this project.',
    currentActualCostSpentOnThis: 'Current actual cost spent on this project',
    totalAllocatedBudgetForThisProject: 'Total allocated budget for this project',
    whenTheProjectIsPlannedTo: 'When the project is planned to start',
    optionalDetailedDescriptionOfTheProject: 'Optional detailed description of the project',
    clearDescriptiveNameForTheProject: 'Clear, descriptive name for the project',
    uniqueIdentifierForThisProject: 'Unique identifier for this project',
    targetCompletionDateForTheProject: 'Target completion date for the project',
    createASimplifiedProjectWithEssential: 'Create a simplified project with essential fields only (Title, Description, Budget, Financial Year, Date)',
    thisProjectIsBeingCreatedBased: 'This project is being created based on an evaluation suggestion. Some fields have been pre-populated for you.',
    creatingFromEvaluationSuggestion: 'Creating from Evaluation Suggestion',
    areYouSureYouWantTo5: 'Are you sure you want to delete this note? This action cannot be undone.',
    tryAdjustingYourFiltersOrSearch: 'Try adjusting your filters or search query.',
    noNotesFoundForThisProject: 'No notes found for this project.',
    thereWasAnErrorLoadingThe2: 'There was an error loading the project notes. Please try again.',
    thereWasAnErrorLoadingThe3: 'There was an error loading the projects. Please try again.',
    noProjectsFoundForTheSelected: 'No projects found for the selected time period.',
    thereWasAnErrorLoadingThe4: 'There was an error loading the project timeline. Please try again.',
    thisWillMarkTheProjectAs: 'This will mark the project as fully completed.',
    areYouSureYouWantTo6: 'Are you sure you want to change the project status to',
    maintenanceApproachComparison: 'Maintenance Approach Comparison',
    areYouSureYouWantTo7: 'Are you sure you want to dismiss this suggestion? Please provide a reason for future reference.',
    basedOnCriticalOverdueItems: 'Based on critical & overdue items',
    giveYourFilterPresetAName: 'Give your filter preset a name to save it for future use.',
    autoCalculatedRecommendations: 'Auto-calculated Recommendations',
    detailedExplanationForTheSuggestion: 'Detailed explanation for the suggestion',
    estimatedCostForTheSuggestedWork: 'Estimated cost for the suggested work (CAD)',
    whenThisEvaluationOrWorkShould: 'When this evaluation or work should be performed',
    automaticallyCalculateSuggestionTypePriorityAnd: 'Automatically calculate suggestion type, priority, and dates based on element data',
    selectTheBuildingElementForThis: 'Select the building element for this suggestion',
    pleaseReviewTheSuggestionDetailsAnd: 'Please review the suggestion details and make an approval decision.',
    additionalInformationServiceQualityNotesSpecialties: 'Additional information, service quality notes, specialties, etc.',
    primaryEmailAddressForCommunication: 'Primary email address for communication',
    primaryPhoneNumberForContact: 'Primary phone number for contact',
    primaryContactPersonAtTheVendor: 'Primary contact person at the vendor',
    primaryServiceCategoryForThisVendor: 'Primary service category for this vendor',
    theLegalOrBusinessNameOf: 'The legal or business name of the vendor',
    noFeaturesInThisCategoryYet: 'No features in this category yet.',
    formHasBeenPrePopulatedWith: 'Form has been pre-populated with template data. You can edit all fields below. The bill will be created as a new one-time bill.',
    noBuildingsAvailableForTheSelected: 'No buildings available for the selected organizations.',
    noOrganizationsSelectedPleaseSelectOrganizations: 'No organizations selected. Please select organizations first.',
    noOrganizationsAvailableToAssign: 'No organizations available to assign.',
    noResidencesAvailableForTheSelected: 'No residences available for the selected buildings.',
    noBuildingsSelectedPleaseSelectBuildings: 'No buildings selected. Please select buildings first.',
    noPermissionsFoundMatchingYourSearch: 'No permissions found matching your search criteria.',
    completeSystemPermissionsTableWithDetailed: 'Complete system permissions table with detailed information about each permission.',
    noUsersFoundMatchingYourSearch: 'No users found matching your search criteria.',
    userInheritsAllPermissionsFrom: 'User inherits all permissions from',
    noUserSpecificPermissionOverrides: 'No user-specific permission overrides',
    adminManagerResidentTenant: 'Admin → Manager → Resident → Tenant',
    yourDashboardWillBeCustomizedBased: 'Your dashboard will be customized based on your role and permissions.',
    editTheDetailsOfThisBill: 'Edit the details of this bill including amounts, dates, and payment information',
    viewDetailedInformationAboutThisBill: 'View detailed information about this bill including payment schedule and status',
    fillInTheFormBelowTo: 'Fill in the form below to create a new bill for your building',
    noBillsFoundForTheSelected: 'No bills found for the selected filters. Create your first bill to get started.',
    fillInTheFormBelowTo2: 'Fill in the form below to create a new bill',
    thisActionCannotBeUndone2: '? This action cannot be undone.',
    areYouSureYouWantTo8: 'Are you sure you want to delete',
    areYouSureYouWantTo9: 'Are you sure you want to update the status of',
    tiquettesPourClasserVosDocumentsCcq: 'Étiquettes pour classer vos documents (CCQ, Loi 16…)',
    noInvoicesFoundForTheSelected: 'No invoices found for the selected filters. Create your first invoice to get started.',
    thisActionCannotBeUndoneAnd: '"? This action cannot be undone and will remove all associated maintenance history and documents.',
    manageBuildingElementsTrackConditionsAnd: 'Manage building elements, track conditions, and schedule maintenance evaluations',
    distributionOfElementConditions: 'Distribution of element conditions',
    mandatoryBuildingSafetyDrill: 'Mandatory building safety drill',
    buildingEventsAndImportantDates: 'Building events and important dates',
    poolMaintenanceScheduledForNextWeek: 'Pool maintenance scheduled for next week',
    elevatorMaintenanceFinishedUnit4b: 'Elevator maintenance finished - Unit 4B',
    latestUpdatesFromYourBuilding: 'Latest updates from your building',
    thisWillPermanentlyDeleteYourAccount: 'This will permanently delete your account and all associated data, including:',
    permanentlyDeleteYourAccountAndAll: 'Permanently delete your account and all associated data. This action cannot be undone.',
    exportAllYourPersonalDataIncluding: 'Export all your personal data including profile information, bills, documents, and activity history.',

    // Workflow tabs (task 711)
    wfCompleteProjectMissing: 'Project data is missing. Unable to load the completion tab.',
    wfCompleteSummaryDescription: 'Final project summary and completion details',
    wfCompleteSummaryCardDesc: 'Document the final outcome, lessons learned, and key accomplishments',
    wfCompleteSummaryFieldDesc: 'This summary will be part of the permanent project record',
    wfCompleteFooterStatus: 'Project has been completed successfully',
    wfElementsAddDescription: 'Add elements to this maintenance project',
    wfElementsIncludedDescription: 'Elements included in this maintenance project',
    wfElementsAdjustSearchHint: 'Try adjusting your search terms.',
    wfElementsNoneAddedYet: 'No elements added to this project yet.',
    wfElementsAddFromAvailable: 'Add elements from the available elements below.',
    wfElementsBulkRemoveWarning_one: 'This will remove {count} selected element from the project. This action cannot be undone.',
    wfElementsBulkRemoveWarning_other: 'This will remove {count} selected elements from the project. This action cannot be undone.',
    wfInProgressProjectMissing: 'Project data is missing. Unable to load the in-progress tab.',
    wfPlannedProjectMissing: 'Project data is missing. Unable to load the planning tab.',
    wfPreWorkProjectMissing: 'Project data is missing. Unable to load the pre-work tab.',
    wfPaymentConfigDescription: 'Configure payment schedule and amounts for this vendor submission',
    wfPaymentTypeDescription: 'Choose whether this is a single payment or multiple payments over time',
    wfPaymentEndRecurringLabel: 'Date End Recurring Payment (Optional)',
    wfPaymentInitialDescription: 'Check if there\'s a different initial payment amount',
    wfPaymentEqualRecurringDesc: 'Check if all recurring payments are the same amount',
    wfPaymentMismatchWarning: 'Payment plan total ({planTotal}) does not match the vendor price ({vendorPrice})',
    wfModalNoProjectDescription: 'No project data provided to the workflow modal',
    wfModalProjectMissingMessage: 'Project information is missing. Please close this modal and try again.',
    wfModalProjectStillLoading: 'Project data is missing or still loading. Please wait a moment and try again.',
    wfModalUnknownTabSuffix: 'Please select a valid workflow tab.',
    wfModalLoadingDescription: 'Loading project workflow information...',
    wfModalUnableToLoad: 'Unable to load project workflow information',
    wfSubmissionAvailableDateDesc: 'When can the vendor start the work?',
    wfSubmissionAdditionalDetailsDesc: 'Additional details about the vendor\'s submission',
    wfSkipConfigDescription: 'Configure which workflow steps to skip for this project. Skipped steps will be automatically bypassed during progression.',
    wfSkipConfigCompletedNote: 'This step has already been completed and cannot be modified.',
    wfSkipConfigChangesImmediate: 'Changes are applied immediately',
    wfSkipConfigDeleteConfirmation: 'Are you sure you want to permanently delete this project? This action cannot be undone. All project data, tasks, vendor submissions, and workflow history will be permanently removed.',
    wfSkipConfigDialogTitle: 'Workflow Configuration',
    wfSkipConfigStatusCompleted: 'Completed',
    wfSkipConfigStatusCurrent: 'Current',
    wfSkipConfigStatusSkipped: 'Skipped',
    wfSkipConfigSkipStepLabel: 'Skip this step',
    wfSkipConfigIncludeStepLabel: 'Include this step',
    wfSkipConfigDeletingLabel: 'Deleting...',
    wfSkipConfigDeleteButton: 'Delete Project',
    wfSkipConfigCloseButton: 'Close',
    wfSkipConfigDeleteAlertTitle: 'Delete Project',
    wfSkipConfigCancelButton: 'Cancel',
    wfSkipConfigDeletePermanentlyButton: 'Delete Permanently',
    wfStepSubmissionLabel: 'Submission',
    wfStepSubmissionDescription: 'Skip vendor submissions and selection phase',
    wfStepPreWorkLabel: 'Pre-Work',
    wfStepPreWorkDescription: 'Skip preparation and coordination phase',
    wfStepInProgressLabel: 'In Progress',
    wfStepInProgressDescription: 'Skip active work execution phase',
    wfStepPostWorkLabel: 'Post-Work',
    wfStepPostWorkDescription: 'Skip cleanup and finalization phase',
    wfElementsAddedTitle: 'Elements Added',
    wfElementsAddedDescription: 'Elements have been successfully added to the project.',
    wfElementsAddFailedDescription: 'Failed to add elements to project.',
    wfElementsRemovedTitle: 'Element Removed',
    wfElementsRemovedDescription: 'Element has been successfully removed from the project.',
    wfElementsRemoveFailedDescription: 'Failed to remove element from project.',
    wfElementsUpdatedTitle: 'Element Updated',
    wfElementsUpdatedDescription: 'Project element has been successfully updated.',
    wfElementsUpdateFailedDescription: 'Failed to update project element.',
    postWorkNewTaskDefault: 'New Post-Work Task',
    wfCompleteSummaryPlaceholder: 'Provide a comprehensive summary of the completed work, including:\n• What was accomplished\n• Any challenges overcome\n• Quality of work delivered\n• Impact on the building/residents\n• Lessons learned for future projects\n• Recommendations for maintenance',
    wfElementsSearchPlaceholder: 'Search elements by name, description, or UNIFORMAT code...',

    // Bulk edit cost dialog (task #707)
    bulkCostUpdateTitle: 'Update Reconstruction Costs',
    bulkCostUpdateDescPrefix: 'Update reconstruction costs for ',
    bulkCostUpdateDescSuffix: ' selected element(s).',
    bulkCostAssignmentType: 'Cost Assignment Type',
    bulkCostPerElement: 'Per Element',
    bulkCostPerUnit: 'Per Unit (m², m, etc.)',
    bulkCostPerElementHint: 'Assign the same total cost to each element',
    bulkCostPerUnitHint: 'Assign cost per unit - total cost will be calculated based on element quantity and unit type',
    bulkCostAmountLabel: 'Cost Amount ($)',
    bulkCostPerElementHelper: 'Total reconstruction cost for each element (e.g., $5,000 per window)',
    bulkCostPerUnitHelper: 'Cost per unit (e.g., $50 per m² for flooring, $200 per m for railings)',
    bulkCostPreviewLabel: 'Preview:',
    bulkCostPreviewPerElementPrefix: 'Each element will have a reconstruction cost of $',
    bulkCostPreviewPerElementSuffix: '.',
    bulkCostPreviewPerUnitPrefix: 'Each element will have a unit cost of $',
    bulkCostPreviewPerUnitSuffix: ' per unit',
    bulkCostUpdateButton: 'Update Costs',
    bulkCostToastUpdatedTitle: 'Costs updated',
    bulkCostToastUpdatedDescPrefix: 'Successfully updated costs for ',
    bulkCostToastUpdatedDescSuffix: ' element(s)',
    bulkCostToastFailedTitle: 'Update failed',
    bulkCostToastFailedDesc: 'Failed to update element costs',
    bulkCostInvalidAmountError: 'Please enter a valid cost amount',

    // Bulk edit residence dialog (task #707)
    bulkResidenceTitle: 'Change Assignment & Properties',
    bulkResidenceDescPrefix: 'Update residence assignment, access type, and charge type for ',
    bulkResidenceDescSuffix: ' selected element(s).',
    bulkResidenceUpdateAssignment: 'Update Residence Assignment',
    bulkResidenceSelectPlaceholder: 'Select residence',
    bulkResidenceBuildingWide: 'Building-wide',
    bulkResidenceBuildingWideDesc: 'Common to entire building',
    bulkResidenceUnitPrefix: 'Unit ',
    bulkResidenceFloorPrefix: 'Floor ',
    bulkResidenceUpdateAccess: 'Update Access Type',
    bulkResidenceSelectAccess: 'Select access type',
    bulkResidenceNotRestrained: 'Not Restrained',
    bulkResidenceNotRestrainedDesc: 'Easy access',
    bulkResidenceRestrained: 'Restrained',
    bulkResidenceRestrainedDesc: 'Restricted access',
    bulkResidenceUpdateCharge: 'Update Charge Type',
    bulkResidenceSelectCharge: 'Select charge type',
    bulkResidenceCommon: 'Common',
    bulkResidenceCommonDesc: 'Building responsibility',
    bulkResidencePersonal: 'Personal',
    bulkResidencePersonalDesc: 'Resident responsibility',
    bulkResidenceChangesToApply: 'Changes to apply:',
    bulkResidenceChangeResidence: 'Residence',
    bulkResidenceChangeAccess: 'Access',
    bulkResidenceChangeCharge: 'Charge',
    bulkResidenceUpdateButton: 'Update Assignment',
    bulkResidenceToastUpdatedTitle: 'Assignment updated',
    bulkResidenceToastUpdatedDescPrefix: 'Successfully updated assignment for ',
    bulkResidenceToastUpdatedDescSuffix: ' element(s)',
    bulkResidenceToastFailedTitle: 'Update failed',
    bulkResidenceToastFailedDesc: 'Failed to update element assignments',
    bulkResidenceSelectFieldError: 'Please select at least one field to update',
    bulkResidenceUnknownUnit: 'Unknown',

    // Project budget (task #707)
    pbBudgetOverview: 'Budget Overview',
    pbBudgetBreakdown: 'Budget Breakdown',
    pbViewElements: 'View Elements',
    pbExportBudget: 'Export Budget',
    pbTotalBudget: 'Total Budget',
    pbActualCost: 'Actual Cost',
    pbAllocated: 'Allocated',
    pbRemaining: 'Remaining',
    pbBudgetUtilization: 'Budget Utilization',
    pbOverBudgetPrefix: 'Project is over budget by $',
    pbOverBudgetSuffix: '.',
    pbFailedToLoadTitle: 'Failed to Load Budget',
    pbFailedToLoadDesc: 'There was an error loading the project budget. Please try again.',
    pbCategory: 'Category',
    pbVariance: 'Variance',
    pbActions: 'Actions',
    pbHistoricalOnly: 'Historical only',
    pbViewDetails: 'View Details',
    pbCount: 'Count',
    pbElementsSuffix: ' elements',
    pbVendorsSuffix: ' vendors',
    pbOver: ' over',
    pbNotAvailable: 'N/A',
    pbSearchBreakdownPlaceholder: 'Search breakdown categories...',
    pbNoBudgetDataTitle: 'No Budget Data',
    pbNoBudgetDataDesc: 'No budget allocations or historical costs found for this project.',
    pbBreakdownDetailsTitle: 'Budget Breakdown Details',
    pbBreakdownDetailsDesc: 'Detailed breakdown of costs and allocations for this budget category.',
    pbDetailsSuffix: ' Details',
    pbProjectElementsHeading: 'Project Elements',
    pbVendorHistoryHeading: 'Vendor History',
    pbUnknownVendor: 'Unknown Vendor',
    pbCategoryElementAllocations: 'Element Allocations',
    pbCategoryElementAllocationsDesc: 'Budget allocated to specific building elements',
    pbCategoryVendorCosts: 'Vendor Costs',
    pbCategoryVendorCostsDesc: 'Historical contractor and vendor expenses',
    pbCategoryMaterials: 'Materials',
    pbCategoryMaterialsDesc: 'Material and supply costs from history',
    pbCategoryLabor: 'Labor',
    pbCategoryLaborDesc: 'Labor costs from project work',
    pbCategoryUnallocated: 'Unallocated',
    pbCategoryUnallocatedDesc: 'Budget not yet allocated to specific elements',
    pbBreakdownAllocatedToPrefix: 'Budget allocated to ',
    pbBreakdownAllocatedToSuffix: ' building elements',
    pbBreakdownVendorCountPrefix: 'Historical costs from ',
    pbBreakdownVendorCountSuffix: ' vendors',
    pbBreakdownMaterialsDesc: 'Material and supply costs',
    pbBreakdownLaborDesc: 'Labor costs from repair work',
    pbBreakdownUnallocatedDesc: 'Budget not yet allocated to specific elements',

    // Project elements (task #707)
    peElement: 'Element',
    peCondition: 'Condition',
    pePlannedWork: 'Planned Work',
    peCostAllocation: 'Cost Allocation',
    peLifespanImpact: 'Lifespan Impact',
    peActions: 'Actions',
    peNotSpecified: 'Not specified',
    peNotSet: 'Not set',
    peTbd: 'TBD',
    peYearsSuffix: ' years',
    peOpenMenu: 'Open menu',
    peActionsLabel: 'Actions',
    peActionViewDetails: 'View Details',
    peActionEditAllocation: 'Edit Allocation',
    peActionRemoveFromProject: 'Remove from Project',
    peRemoveSelected: 'Remove Selected',
    peExportElements: 'Export Elements',
    peProjectElementsTitle: 'Project Elements',
    peElementsAssignedSuffix: ' building elements assigned to this project',
    peSearchPlaceholder: 'Search elements...',
    peNoElementsAssignedTitle: 'No Elements Assigned',
    peNoElementsAssignedDesc: 'No building elements have been assigned to this project yet.',
    peNoElementsAssignedShort: 'No elements assigned to this project yet.',
    peAddElement: 'Add Element',
    peAddBuildingElementTitle: 'Add Building Element',
    peAddBuildingElementDesc: 'Select building elements to include in this project.',
    peAddBuildingElementsTitle: 'Add Building Elements',
    peAddBuildingElementsDesc: 'Select building elements to include in this project and optionally set cost allocation and work details.',
    peQuickProject: 'Quick Project',
    peQuickProjectLong: 'Planning-only project that cannot advance beyond planning phase',
    peQuickProjectShort: 'Planning-only project',
    peWorkDescriptionLabel: 'Work Description',
    peWorkDescriptionPlaceholder: 'Describe the work to be done on these elements...',
    peCostAllocationLabel: 'Cost Allocation ($)',
    peLifespanImpactLabel: 'Lifespan Impact (Years)',
    peAvailableElements: 'Available Elements',
    peAllAlreadyAssigned: 'All available elements are already assigned to this project.',
    peEditElementTitle: 'Edit Element Details',
    peEditElementDesc: 'Update cost allocation and work details for this element.',
    peEditWorkDescriptionPlaceholder: 'Describe the work to be done...',
    peSavingProgress: 'Saving...',
    peRemoveElementTitle: 'Remove Element',
    peRemoveElementConfirm: 'Are you sure you want to remove this element from the project? This action cannot be undone.',
    peRemoveButton: 'Remove',
    peRemovingProgress: 'Removing...',
    pePermissionDeniedTitle: 'Permission Denied',
    pePermissionDeniedAddElements: "You don't have permission to add elements to projects.",
    pePermissionDeniedQuickProject: "You don't have permission to create Quick Projects.",
    peElementAddedTitle: 'Element Added',
    peElementAddedDesc: 'Building element has been added to the project successfully.',
    peElementAddFailedTitle: 'Failed to Add Element',
    peElementUpdatedTitle: 'Element Updated',
    peElementUpdatedDesc: 'Element details have been updated successfully.',
    peElementUpdateFailedTitle: 'Update Failed',
    peElementRemovedTitle: 'Element Removed',
    peElementRemovedDesc: 'Element has been removed from the project.',
    peElementRemoveFailedTitle: 'Removal Failed',
    peQuickProjectCreatedTitle: 'Quick Project Created',
    peQuickProjectCreatedDesc: 'This project has been set as a Quick Project for planning purposes only.',
    peQuickProjectFailedTitle: 'Failed to Create Quick Project',
    peBulkOpDoneTitle: 'Bulk Operation Complete',
    peBulkOpRemovedDesc: 'Selected elements have been removed successfully.',
    peBulkOpUpdatedDesc: 'Selected elements have been updated successfully.',
    peBulkOpFailedTitle: 'Bulk Operation Failed',
    pePleaseTryAgain: 'Please try again.',
    peQuickProjectFallbackDescription: 'Quick Project for planning purposes',

    // Element form (task #707)
    efAddBuildingElement: 'Add Building Element',
    efEditBuildingElement: 'Edit Building Element',
    efViewBuildingElement: 'View Building Element',
    efAddDescription: 'Add a new building element to the inventory with its specifications and condition',
    efEditDescription: 'Update the building element information and condition',
    efViewDescription: 'View building element information and condition',
    efDeleteButton: 'Delete',
    efDeletingProgress: 'Deleting...',
    efDeleteConfirm: 'Are you sure you want to delete this element? This action cannot be undone.',
    efDetailsTabLabel: 'Details',
    efHistoryTabLabel: 'History',
    efUniformatCodeLabel: 'UNIFORMAT Code',
    efBrowseButton: 'Browse',
    efSearchPlaceholder: 'Search UNIFORMAT codes...',
    efSearchPlaceholderBrowser: 'Search UNIFORMAT codes...',
    efBrowseDialogTitle: 'Browse UNIFORMAT Codes',
    efBrowseDialogHint: 'Navigate: Level 1 → Level 2 → Level 3 (only Level 3 can be selected for elements)',
    efBreadcrumbLevel1: 'Level 1',
    efBreadcrumbLevel2Prefix: 'Level 2',
    efBreadcrumbLevel3Prefix: 'Level 3',
    efTypicalLifespanPrefix: 'Typical lifespan: ',
    efTypicalLifespanShortPrefix: 'Typical: ',
    efTypicalLifespanSuffix: ' years',
    efLoadingCodes: 'Loading UNIFORMAT codes...',
    efNoMatchingCodes: 'No matching codes found',
    efSelectableLabel: 'Selectable',
    efNavigateLabel: 'Navigate →',
    efNavigateOnlyLabel: 'Navigate only',
    efElementNameLabel: 'Element Name',
    efElementNamePlaceholder: 'e.g., Exterior Wall - North',
    efCurrentConditionLabel: 'Current Condition',
    efSelectCondition: 'Select condition',
    efDescriptionLabel: 'Description',
    efDescriptionLabelHelper: 'Optional detailed description of the element',
    efDescriptionPlaceholder: 'Describe the element location, specifications, or other relevant details...',
    efResidenceAssignmentLabel: 'Residence Assignment',
    efResidenceAssignmentDesc: 'Select if this element is building-wide or applies to specific residences',
    efBuildingWideElement: 'Building-wide element',
    efSelectResidenceAssignment: 'Select residence assignment',
    efUnitPrefix: 'Unit ',
    efFloorPrefix: 'Floor ',
    efAssignedToPrefix: 'Currently assigned to: Unit ',
    efFloorSuffix: 'Floor',
    efAccessTypeLabel: 'Access Type',
    efAccessTypeDesc: 'Access restrictions for this element',
    efSelectAccessType: 'Select access type',
    efNotRestrained: 'Not Restrained',
    efNotRestrainedDesc: 'Free access',
    efRestrained: 'Restrained',
    efRestrainedDesc: 'Restricted access',
    efChargeTypeLabel: 'Charge Type',
    efChargeTypeDesc: 'Who is responsible for costs',
    efSelectChargeType: 'Select charge type',
    efCommon: 'Common',
    efCommonDesc: 'Building responsibility',
    efPersonal: 'Personal',
    efPersonalDesc: 'Resident responsibility',
    efTimelineHeading: 'Timeline & Lifespan',
    efOriginalConstructionDate: 'Original Construction Date',
    efOriginalLifespan: 'Original Lifespan (years)',
    efYearsLeftToReconstruction: 'Years left to reconstruction',
    efQuantityHeading: 'Quantity & Unit',
    efQuantityLabel: 'Quantity',
    efUnitLabel: 'Unit',
    efSelectUnit: 'Select unit',
    efUnitM2: 'm² (square meters)',
    efUnitM: 'm (linear meters)',
    efUnitUnit: 'unit (each)',
    efUnitM3: 'm³ (cubic meters)',
    efUnitKg: 'kg (kilograms)',
    efUnitL: 'L (liters)',
    efNextEvaluationDate: 'Next Evaluation Date',
    efAutoCalculate: 'Auto-calculate',
    efAutoCalcHelper: 'Automatically calculated based on condition and remaining years',
    efReconstructionEvaluation: 'Reconstruction Evaluation',
    efReconstructionCost: 'Reconstruction Cost',
    efReconstructionCostPlaceholder: '0.00',
    efDateOfEstimation: 'Date of Estimation',
    efElementQuantityHeading: 'Element Quantity',
    efQuantityDuplicateLabel: 'Quantity (Duplicate)',
    efQuantityDuplicateDesc: 'Number of identical elements to create (e.g., 30 windows, 5 doors)',
    efNotesLabel: 'Notes',
    efNotesPlaceholder: 'Any additional notes about this element...',
    efElementCreatedTitle: 'Element created',
    efElementsCreatedSuffix: ' Elements created',
    efElementUpdatedTitle: 'Element updated',
    efElementCreatedSuccessSuffix: ' has been created successfully',
    efElementUpdatedSuccessSuffix: ' has been updated successfully',
    efSuccessfullyCreatedPrefix: 'Successfully created ',
    efSuccessfullyCreatedSuffix: ' numbered elements',
    efCreationFailedTitle: 'Creation failed',
    efUpdateFailedTitle: 'Update failed',
    efFailedToCreateElement: 'Failed to create element',
    efFailedToUpdateElement: 'Failed to update element',
    efNoElementToDelete: 'No element to delete',
    efElementDeletedTitle: 'Element deleted',
    efElementDeletedDesc: 'Building element has been successfully removed from the inventory.',
    efDeletionFailedTitle: 'Deletion failed',
    efFailedToDeleteElement: 'Failed to delete element',
    // Manager > Maintenance > Projects (task #712)
    pvFailedToLoadDashboard: 'Failed to load dashboard analytics. Please try again.',
    pvNoBuildingDashboard: 'Please select a building to view its project dashboard.',
    pvDashboardSubtitle: 'Analytics, insights, and performance metrics for maintenance project management',
    pvProjectTrendsDesc: 'Monthly project creation and completion trends',
    pvBudgetAnalysisDesc: 'Planned vs actual budget utilization over time',
    pvStatusBreakdownDesc: 'Current breakdown of projects by status',
    pvPriorityBreakdownDesc: 'Project breakdown by priority level',
    pvOverdueProjectsAlert: '{count} project(s) are overdue and require immediate attention.',
    pvBudgetUtilizationHighAlert: 'Budget utilization is high ({percent}%). Consider reviewing spending.',
    pvExecutiveSummaryDesc: 'Key insights and recommendations for project portfolio management',
    pvBudgetWithinTarget: 'Budget utilization within target range',
    pvQualityMeetingExpectations: 'Quality metrics meeting expectations',
    pvDetailsPanelDesc: 'Comprehensive project details, timeline, budget, and management tools',
    pvFailedToLoadDetails: 'Failed to load project details. Please try again.',
    pvImmediateAttention: 'Immediate attention may be required.',
    pvFinancialTrackingDesc: 'Financial tracking and cost management',
    pvElementsAssociatedDesc: 'Building elements associated with this project',
    pvElementsAvailableInFullView: 'Element management available in full view',
    pvFailedToLoadProjects: 'Failed to load projects. Please try refreshing the page.',
    pvNoBuildingProjectsTable: 'Please select a building to view its maintenance projects.',
    pvNoProjectsCreatedYet: 'No maintenance projects have been created for this building yet.',
    pvGetStartedHint: 'Get started by creating your first project or generating projects from evaluation suggestions.',
    pvNoProjectsMatchFilters: 'No projects match your current search and filter criteria.',
    pvAdjustFiltersHint: 'Try adjusting your filters or search terms.',
    pvRealtimeBulkHint: 'Project data is updated in real-time. Use bulk actions to manage multiple projects at once.',
    pvFailedToLoadTimeline: 'Failed to load timeline data. Please try refreshing the page.',
    pvNoBuildingTimeline: 'Please select a building to view its project timeline.',
    pvTimelineSubtitle: 'Schedule overview and milestone tracking for all projects',
    pvClickDateToView: 'Click on any date to view scheduled events',
    pvNoEventsScheduled: 'No events scheduled for this date',
    pvOverdueEventSingular: '{count} project event is overdue. Review project schedules and consider adjusting timelines or reallocating resources.',
    pvOverdueEventPlural: '{count} project events are overdue. Review project schedules and consider adjusting timelines or reallocating resources.',
    pvFailedToLoadMetrics: 'Failed to load project metrics. Please try refreshing the page.',
    pvBudgetCriticallyHigh: 'Budget utilization is critically high. ',
    pvSchedulePerformanceAttention: 'Schedule performance needs immediate attention. ',
    pvEfficiencyBelowAcceptable: 'Project completion efficiency is below acceptable levels. ',
    pvHealthAlertSuffix: 'Consider reviewing project portfolio and resource allocation.',
    pvCreateProjectsFromSuggestions: 'Create Projects from Suggestions',
    pvSuggestionsDialogDesc: 'Review and select evaluation suggestions to automatically create maintenance projects. Projects will be generated with standard workflows and can be customized after creation.',
    pvFailedToLoadSuggestions: 'Failed to load suggestions. Please try again.',
    pvProjectDefaultsDesc: 'Set default values for all generated projects',
    pvNoPendingSuggestions: 'No pending evaluation suggestions are available for this building.',
    pvNoSuggestionsMatchFilters: 'No suggestions match your current search and filter criteria.',
    pvProjectsCreatedTitle: 'Projects Created',
    pvProjectsCreatedDesc: 'Successfully created {count} project(s) from evaluation suggestions.',
    pvFailedToCreateProjects: 'Failed to create projects. Please try again.',
    pvNoSuggestionsSelectedTitle: 'No Suggestions Selected',
    pvNoSuggestionsSelectedDesc: 'Please select at least one suggestion to create projects.',
    pvSearchSuggestionsPlaceholder: 'Search suggestions...',
    pvAllPrioritiesPlaceholder: 'All priorities',
    pvAllPrioritiesItem: 'All Priorities',
    pvAllTypesPlaceholder: 'All types',
    pvAllTypesItem: 'All Types',
    pvTypeInspection: 'Inspection',
    pvTypeMinorRehab: 'Minor Rehab',
    pvTypeMajorRehab: 'Major Rehab',
    pvTypeReplacement: 'Replacement',
    pvTypeRepair: 'Repair',
    pvTypeNotSure: 'Not Sure',
    pvHealthHealthy: 'Healthy',
    pvHealthWarning: 'Warning',
    pvHealthCritical: 'Critical',
    pvSelectAllSuggestions: 'Select All ({count} suggestions)',
    pvNSelected: '{count} selected',
    pvNoSuggestionsFound: 'No Suggestions Found',
    pvSuggestionTypeElementEvaluation: '{type} - Element Evaluation',
    pvElementHash: 'Element #{id}',
    pvProjectDefaultsTitle: 'Project Defaults',
    pvDefaultBudgetLabel: 'Default Budget',
    pvDurationDaysLabel: 'Duration (days)',
    pvDefaultPriorityLabel: 'Default Priority',
    pvEstimatedTotalBudget: 'Estimated total budget:',
    pvSuggestionsSelectedFooter: '{count} suggestion(s) selected',
    pvCreatingButton: 'Creating...',
    pvCreateNProjects: 'Create {count} Project{plural}',
    pvNoBuildingSelected: 'No Building Selected',
    pvProjectPortfolioDashboard: 'Project Portfolio Dashboard',
    pvExportReport: 'Export Report',
    pvCompletionRateLabel: 'Completion Rate',
    pvBudgetUtilizationLabel: 'Budget Utilization',
    pvOnTimeCompletionLabel: 'On-Time Completion',
    pvCostEfficiencyLabel: 'Cost Efficiency',
    pvProjectTrendsTitle: 'Project Trends',
    pvBudgetAnalysisTitle: 'Budget Analysis',
    pvProjectStatusDistributionTitle: 'Project Status Distribution',
    pvPriorityDistributionTitle: 'Priority Distribution',
    pvBudgetHealth: 'Budget Health',
    pvOverallStatus: 'Overall Status',
    pvBudgetUtilizedPct: '{percent}% of total budget utilized',
    pvScheduleHealth: 'Schedule Health',
    pvOnTimeDeliveryRate: '{percent}% on-time delivery rate',
    pvQualityHealth: 'Quality Health',
    pvSuccessfulCompletionRate: '{percent}% successful completion rate',
    pvExecutiveSummaryTitle: 'Executive Summary',
    pvPortfolioHealth: 'Portfolio Health',
    pvTotalProjectsInPortfolio: '{count} total projects in portfolio',
    pvCurrentlyActiveProjects: '{count} currently active projects',
    pvCompletionRateThisPeriod: '{percent}% completion rate this period',
    pvAverageProjectDuration: 'Average project duration: {days} days',
    pvPerformanceInsights: 'Performance Insights',
    pvCostEfficiencyAt: 'Cost efficiency at {percent}%',
    pvProjectsDeliveredOnTime: '{percent}% projects delivered on time',
    pvChartCreated: 'Created',
    pvChartCompleted: 'Completed',
    pvChartPlannedBudget: 'Planned Budget',
    pvChartActualSpend: 'Actual Spend',
    pvEditProjectAction: 'Edit Project',
    pvUpdateStatusAction: 'Update Status',
    pvTimelineAction: 'Timeline',
    pvProjectProgressTitle: 'Project Progress',
    pvOverallProgressLabel: 'Overall Progress',
    pvTimeRemaining: 'Time Remaining',
    pvDaysOverdue: '{days} days overdue',
    pvDaysLeft: '{days} days left',
    pvBudgetUsage: 'Budget Usage',
    pvProjectIsOverdue: 'This project is overdue. ',
    pvProjectIsOverBudget: 'This project is over budget. ',
    pvOverviewTab: 'Overview',
    pvTimelineTab: 'Timeline',
    pvBudgetTab: 'Budget',
    pvElementsTab: 'Elements',
    pvProjectInformation: 'Project Information',
    pvTypeColon: 'Type:',
    pvCreatedFromSuggestion: 'Created from suggestion:',
    pvAutoGenerated: 'Auto-generated',
    pvCreatedColon: 'Created:',
    pvLastUpdatedColon: 'Last updated:',
    pvDurationCaps: 'DURATION',
    pvNDays: '{count} days',
    pvActualNDays: 'Actual: {count} days',
    pvBudgetCaps: 'BUDGET',
    pvAmountSpentSuffix: '{amount} spent',
    pvManageProjectElements: 'Manage Project Elements',
    pvProjectNotesAndComm: 'Project Notes & Communication',
    pvBudgetCostTracking: 'Budget & Cost Tracking',
    pvProjectTimelineTitle: 'Project Timeline',
    pvKeyDatesAndMilestones: 'Key dates and milestones',
    pvPlannedStartColon: 'Planned Start:',
    pvPlannedEndColon: 'Planned End:',
    pvActualStartColon: 'Actual Start:',
    pvActualEndColon: 'Actual End:',
    pvOpenFullTimelineView: 'Open Full Timeline View',
    pvBudgetAnalysisCardTitle: 'Budget Analysis',
    pvBudgetUtilizationCardLabel: 'Budget Utilization',
    pvTotalBudgetLabel: 'Total Budget',
    pvAmountSpentLabel: 'Amount Spent',
    pvRemainingLabel: 'Remaining',
    pvVarianceLabel: 'Variance',
    pvOpenBudgetManagement: 'Open Budget Management',
    pvProjectElementsTitle: 'Project Elements',
    pvNoProjectsFound: 'No Projects Found',
    pvNoProjectsMatchFiltersTitle: 'No Projects Match Filters',
    pvProjectsShownOf: 'of {total} project{plural} shown',
    pvMatchingSearch: 'matching "{search}"',
    pvStatusFilterChip: 'Status: {value}',
    pvPriorityFilterChip: 'Priority: {value}',
    pvOverdueOnlyChip: 'Overdue Only',
    pvProjectTimelineHeader: 'Project Timeline',
    pvViewMonth: 'Month',
    pvViewQuarter: 'Quarter',
    pvViewYear: 'Year',
    pvFullTimeline: 'Full Timeline',
    pvTotalEvents: 'Total Events',
    pvOverdueLabel: 'Overdue',
    pvDueThisWeek: 'Due This Week',
    pvActiveProjects: 'Active Projects',
    pvEventsThisMonth: 'Events This Month ({count})',
    pvEventStart: 'Start',
    pvEventEnd: 'End',
    pvEventMilestone: 'Milestone',
    pvSelectADate: 'Select a Date',
    pvEventsScheduledOnDate: '{count} event(s) scheduled',
    pvProjectNumber: 'Project #{number}',
    pvTimelineActions: 'Timeline Actions',
    pvBulkStatusUpdate: 'Bulk Status Update',
    pvResourcePlanning: 'Resource Planning',
    pvExportTimeline: 'Export Timeline',
    pvTotalProjectsTitle: 'Total Projects',
    pvNActive: '{count} active',
    pvNCompleted: '{count} completed',
    pvBudgetOverviewTitle: 'Budget Overview',
    pvAmountSpentText: '{amount} spent',
    pvScheduleStatusTitle: 'Schedule Status',
    pvOverdueProjectsText: 'Overdue projects',
    pvNoOverdueProjects: 'No overdue projects',
    pvNDueSoon: '{count} due soon',
    pvPerformanceTitle: 'Performance',
    pvCompletionRateText: 'Completion rate',
    pvNPercentOnTime: '{percent}% on time',
    pvSuggestionsTitle: 'Suggestions',
    pvPendingEvaluationSuggestions: 'Pending evaluation suggestions',
    pvAllSuggestionsReviewed: 'All suggestions reviewed',
    pvAvgDuration: 'Avg Duration',
    pvDaysPerProject: 'Days per project',
    pvCostEfficiencyTitle: 'Cost Efficiency',
    pvExcellentEfficiency: 'Excellent efficiency',
    pvGoodEfficiency: 'Good efficiency',
    pvNeedsImprovement: 'Needs improvement',
    pvResourcesTitle: 'Resources',
    pvTeamUtilization: 'Team utilization',
    pvProjectsByStatus: 'Projects by Status',
    pvStatusPlanned: 'Planned',
    pvStatusEvaluation: 'Evaluation',
    pvStatusSubmission: 'Submission',
    pvStatusPreWork: 'Pre-Work',
    pvStatusActiveWork: 'Active Work',
    pvStatusPostWork: 'Post-Work',
    pvStatusCompleted: 'Completed',
    pvProjectsByPriority: 'Projects by Priority',
    pvPriorityLowLabel: 'Low Priority',
    pvPriorityMediumLabel: 'Medium Priority',
    pvPriorityHighLabel: 'High Priority',
    pvPriorityCriticalLabel: 'Critical Priority',
    // Auth flow translations (task #713)
    authPrivacyAlertTitle: 'Personal Information Protection (Law 25 - Quebec):',
    authPrivacyAlertText:
      'Your consent is required for the collection and use of your personal data.',
    authDataCollectionTitle: 'Data collection and processing',
    authDataCollectionMasterText:
      'I accept all types of data collection and processing (essential and optional).',
    authEssentialDataLabel: 'Essential data collection (Required) *',
    authEssentialDataDesc:
      'Authentication, communication, account management, property management services.',
    authMarketingLabel: 'Marketing communications (Optional)',
    authMarketingDesc: 'Promotional communications, new features, special offers.',
    authAnalyticsLabel: 'Analysis and improvement (Optional)',
    authAnalyticsDesc: 'Anonymized usage data to improve services.',
    authThirdPartyLabel: 'Integrated third-party services (Optional)',
    authThirdPartyDesc: 'Mapping, notifications, storage to enhance the experience.',
    authRightsAndControl: 'Rights and control',
    authAcknowledgeRightsLabel: 'Acknowledgment of my rights (Required) *',
    authAcknowledgeRightsDesc:
      'I have been informed of my rights regarding my personal information and I understand that I can exercise these rights at any time.',
    authAcknowledgeRightsWarning: '⚠️ This box must be checked to continue.',
    authYourRightsTitle: '📋 Your rights under Quebec\'s Law 25',
    authRightAccess: 'Right of access:',
    authRightAccessDesc: 'View your personal data',
    authRightRectification: 'Right of rectification:',
    authRightRectificationDesc: 'Correct inaccurate information',
    authRightDeletion: 'Right of deletion:',
    authRightDeletionDesc: 'Request deletion of your data',
    authRightPortability: 'Right of portability:',
    authRightPortabilityDesc: 'Retrieve your data in a readable format',
    authContactRightsTitle: '📞 Contact for your rights',
    authContactRightsDesc:
      'To exercise your rights or for any question regarding your personal data, contact our data protection officer:',
    authSecurityRetentionTitle: 'Security and retention',
    authSecurityLabel: 'Security:',
    authSecurityDesc: 'Your data is encrypted and stored on secure servers in Canada',
    authRetentionLabel: 'Retention:',
    authRetentionDesc: 'Your data is kept according to Quebec legal requirements',
    authTransparencyLabel: 'Transparency:',
    authTransparencyDesc: 'Consult our complete privacy policy at any time',
    authInvalidToken: 'Invalid token',
    authServerConnectionError: 'Server connection error',
    authValidatingInvitation: 'Validating invitation',
    authValidatingInvitationDesc: 'Verifying the invitation token and associated details...',
    authInvitationTokenRequired: 'Invitation token required',
    authInvitationTokenRequiredDesc:
      'No valid invitation token was found. Please use the invitation link received by email.',
    authInvitationInvalid: 'Invalid invitation:',
    authUnableToValidate: 'Unable to validate the invitation',
    authInvitationLinkExpired: 'The invitation link may be expired, invalid, or already used.',
    authInvitationCheckLink: 'Check that you are using the complete link received by email',
    authInvitationNotExpired: 'Make sure the invitation has not expired',
    authInvitationContactAdmin: 'Contact the administrator if the problem persists',
    authInvitationValid: 'Valid invitation!',
    authInvitationValidDesc: 'You can proceed to create your account.',
    authInvitationConfirmed: 'Invitation confirmed',
    authInvitedToJoin: 'You have been invited to join',
    authInvitedBy: 'Invited by',
    authValidity: 'Validity',
    authExpired: 'Expired',
    authDayRemaining: 'day remaining',
    authDaysRemaining: 'days remaining',
    authHourRemaining: 'hour remaining',
    authHoursRemaining: 'hours remaining',
    authExpiringSoon: 'Expiring soon',
    authPasswordRequiredLabel: 'Password *',
    authEnterYourPassword: 'Enter your password',
    authHidePassword: 'Hide password',
    authShowPassword: 'Show password',
    authPasswordDoesNotMeetRequirements: 'The password does not meet the security requirements.',
    authConfirmPasswordRequired: 'Confirm password *',
    authConfirmYourPassword: 'Confirm your password',
    authPasswordsMatch: 'Passwords match',
    authPasswordsDoNotMatch: 'Passwords do not match',
    authSecurityTipsTitle: '💡 Security tips',
    authSecurityTip1: 'Use a unique combination of letters, numbers, and symbols',
    authSecurityTip2: 'Avoid personal information (name, date of birth)',
    authSecurityTip3: 'Do not reuse a password from another account',
    authSecurityTip4: 'Consider using a password manager',
    authUserProfileLabel: 'User profile:',
    authUserProfileDesc:
      'Complete your profile to finalize your registration and access property management services.',
    authPersonalInformation: 'Personal information',
    authFirstNameRequired: 'First name *',
    authYourFirstName: 'Your first name',
    authLastNameRequired: 'Last name *',
    authYourLastName: 'Your last name',
    authPhoneOptional: 'Phone (optional)',
    authPreferredLanguage: 'Preferred language *',
    authChooseLanguage: 'Choose a language',
    authInvalidPhoneFormat: 'Invalid phone format (e.g., 514-123-4567)',
    authFieldIsRequired: 'is required',
    authDemoUserCreated: 'Demo User Created',
    authDemoUserCreatedSuccess: 'Demo user has been created successfully',
    authErrorTitle: 'Error',
    authEmailRequiredForRegular:
      'Email address is required for regular invitations (example: user@domain.com). For demo users, provide first and last name instead.',
    authResidenceRequiredForBuilding:
      'Please select a specific residence unit for tenants and residents when a building is selected',
    authDemoManager: 'Demo Manager',
    authDemoTenant: 'Demo Tenant',
    authDemoResident: 'Demo Resident',
    authFirstNameLabel: 'First Name *',
    authEnterFirstName: 'Enter first name',
    authLastNameLabel: 'Last Name *',
    authEnterLastName: 'Enter last name',
    authBuildingLabel: 'Building',
    authSelectBuilding: 'Select building',
    authAllBuildingsOption: 'All buildings',
    authResidenceLabelRequired: 'Residence *',
    authSelectResidence: 'Select residence',
    authNoSpecificResidence: 'No specific residence',
    authResidenceRequired: 'Residence required for tenants and residents',
    authSelectOrgFirst: 'Please select an organization first',
    authManagersOnlyOwnOrg: 'Managers can only invite to their organization',
    authSelectTargetOrg: 'Select target organization',
    authCreatingUser: 'Creating User...',
    authCreateDemoUser: 'Create Demo User',
    authEmailRequiredForReset: 'Email address required for password reset',
    authEmailSent: 'Email sent',
    authResetEmailSentIfExists: 'If this email address exists, a reset link has been sent.',
    authResetEmailSentSuccess: 'Reset email sent successfully',
    authResetEmailFollowUp:
      'If your email address is in our system, you will receive a password reset link in a few minutes.',
    authCheckSpamFolder: 'Don\'t forget to check your spam folder.',
    authBackToLogin: 'Back to login',
    authForgotPasswordTitle: 'Forgot password',
    authForgotPasswordDesc: 'Enter your email address to receive a password reset link',
    authSendResetLink: 'Send reset link',
    authSendingInProgress: 'Sending...',
    authEmailAddressLabel: 'Email address',
    authEmailAddressDesc: 'We will send you a secure link to reset your password',
    authNewPasswordRequired: 'The new password is required',
    authPasswordMin8: 'The password must contain at least 8 characters (example: MyPassword123!)',
    authPasswordMax100: 'The password cannot exceed 100 characters',
    authPasswordComplexity:
      'The password must contain at least one lowercase letter, one uppercase letter and one digit (example: MyPassword123!)',
    authConfirmPasswordRequiredZ: 'Password confirmation is required',
    authPasswordsDoNotMatchHelp:
      'Passwords do not match - please enter the same password in both fields',
    authTokenMissing: 'Token missing',
    authResetLinkInvalid: 'The reset link is invalid or missing.',
    authResetTokenMissing: 'Reset token is missing.',
    authPasswordResetTitle: 'Password reset',
    authPasswordUpdatedSuccess: 'Your password has been updated successfully.',
    authResetGeneralError: 'An error occurred while resetting the password.',
    authResetLinkInvalidExpired:
      'The reset link is invalid or expired. Please request a new link.',
    authResetLinkAlreadyUsed: 'This reset link has already been used.',
    authPasswordTooShort: 'The password must contain at least 8 characters.',
    authPasswordTooWeak:
      'The password must contain at least one uppercase letter, one lowercase letter and one digit.',
    authPasswordResetCompleteDesc:
      'Your password has been updated successfully. You can now log in with your new password.',
    authSignIn: 'Sign in',
    authInvalidLink: 'Invalid link',
    authRequestNewLink: 'Request a new link',
    authResetPasswordTitle: 'Reset password',
    authEnterNewPassword: 'Enter your new password',
    authNewPasswordLabel: 'New password',
    authConfirmPasswordLabel: 'Confirm password',
    authConfirmNewPassword: 'Confirm your new password',
    authResettingInProgress: 'Resetting...',
    authValidationStepTitle: 'Invitation validation',
    authValidationStepDesc: 'Verifying your invitation link and associated details',
    authPasswordStepTitle: 'Password creation',
    authPasswordStepDesc: 'Set a secure password for your account',
    authProfileStepTitle: 'Personal information',
    authProfileStepDesc: 'Complete your user profile',
    authConsentStepTitle: 'Consent and privacy',
    authConsentStepDesc: 'Consents required under Quebec\'s Law 25',
    authPasswordRequiredError: 'Password required',
    authNamesRequiredError: 'First and last name required',
    authConsentsRequiredError: 'Required consents are missing',
    authAccountCreationError: 'Error creating account',
    authAccountCreationGenericError: 'An error occurred while creating your account',
    authRegistrationCompleteTitle: '🎉 Registration completed successfully!',
    authWelcomeUser: 'Welcome',
    authAccountCreatedMessage: 'Your account has been created successfully.',
    authAccountCreatedTitle: '✅ Account created successfully',
    authQuebecComplianceTitle: '🛡️ Quebec compliance',
    authQuebecComplianceDesc:
      'Your consents have been recorded in compliance with Quebec\'s Law 25. You can exercise your rights at any time by contacting our team.',
    authAccessMyAccount: 'Access my account',
    authLoginWithEmailPassword: 'You can now log in with your email and password',
    authBackToHome: 'Back to home',
    authInvitationAcceptanceTitle: 'Invitation acceptance',
    authInvitationAcceptanceDesc: 'Complete your registration to join the Koveo Gestion platform',
    authErrorPrefix: 'Error:',
    authCreatingYourAccount: 'Creating your account',
    authRegistrationFooter:
      'By registering, you accept our terms of use and our privacy policy compliant with Quebec\'s Law 25.',
    wfCompleteHeaderTitle: 'Project Completion',
    wfCompleteCompleteBadge: 'Complete',
    wfCompleteSavingButton: 'Saving...',
    wfCompleteSaveChangesButton: 'Save Changes',
    wfCompleteSummaryCardTitle: 'Completion Summary',
    wfCompleteTimelineTitle: 'Project Timeline',
    wfCompletePlannedStartLabel: 'Planned Start',
    wfCompleteNotSpecified: 'Not specified',
    wfCompleteActualEndLabel: 'Actual End',
    wfCompleteDurationLabel: 'Project duration',
    wfCompleteDays: 'days',
    wfCompleteBudgetSummary: 'Budget Summary',
    wfCompleteTotalBudget: 'Total Budget',
    wfCompleteActualCost: 'Actual Cost',
    wfCompleteBudgetUtilization: 'Budget Utilization',
    wfCompleteUtilizedSuffix: '% utilized',
    wfCompleteOverBudgetBy: 'Over budget by',
    wfCompleteProjectDetails: 'Project Details',
    wfCompleteProjectNumber: 'Project Number',
    wfCompleteProjectType: 'Project Type',
    wfCompletePriority: 'Priority',
    wfCompleteOrigin: 'Origin',
    wfCompleteOriginAuto: 'Auto-generated',
    wfCompleteOriginManual: 'Manual',
    wfCompleteCreated: 'Created',
    wfCompleteStatusTitle: 'Status',
    wfCompleteProjectCompleteText: 'Project Complete',
    wfCompleteAllStagesText: 'All workflow stages completed',
    wfCompleteReopenProjectButton: 'Reopen Project',
    wfModalProjectMissingTitle: 'Project Missing',
    wfModalWorkflowErrorTitle: 'Workflow Error',
    wfModalLoadFailedFallback: 'Failed to load workflow state. Please try again.',
    wfModalProjectNumberPrefix: 'Project #',
    wfModalStatusPrefix: 'Status',
    wfModalManagingDescription: 'Managing project workflow',
    wfModalUnknownTabPrefix: 'Unknown tab',
    wfModalCompleteStepDefault: 'Complete Step',
    wfModalCompletePlanning: 'Complete Planning',
    wfModalCompleteSubmissions: 'Complete Submissions',
    wfModalCompletePreWork: 'Complete Pre-Work',
    wfModalCompleteWork: 'Complete Work',
    wfModalCompletePostWork: 'Complete Post-Work',
    wfModalCompleteProject: 'Complete Project',
    wfModalTabPlannedLabel: 'Planned',
    wfModalTabPlannedDesc: 'Project planning and timeline',
    wfModalTabSubmissionLabel: 'Submission',
    wfModalTabSubmissionDesc: 'Vendor submissions and selection',
    wfModalTabPreWorkLabel: 'Pre-Work',
    wfModalTabPreWorkDesc: 'Preparation and coordination',
    wfModalTabInProgressLabel: 'In Progress',
    wfModalTabInProgressDesc: 'Active work execution',
    wfModalTabPostWorkLabel: 'Post-Work',
    wfModalTabPostWorkDesc: 'Cleanup and finalization',
    wfModalTabCompletedLabel: 'Complete',
    wfModalTabCompletedDesc: 'Project completion and summary',
    wfPaymentSetupTitle: 'Payment Plan Setup',
    wfPaymentTypeLabel: 'Payment Type',
    wfPaymentTypePlaceholder: 'Choose payment type',
    wfPaymentTypeSingle: 'Single Payment',
    wfPaymentTypeRecurring: 'Recurring Payments',
    wfPaymentScheduleLabel: 'Payment Schedule',
    wfPaymentSchedulePlaceholder: 'Select payment schedule',
    wfPaymentScheduleWeekly: 'Weekly',
    wfPaymentScheduleMonthly: 'Monthly',
    wfPaymentScheduleQuarterly: 'Quarterly',
    wfPaymentScheduleYearly: 'Yearly',
    wfPaymentScheduleCustom: 'Custom Dates',
    wfPaymentFirstDateLabel: 'Date First Payment',
    wfPaymentCustomDatesLabel: 'Custom Payment Dates',
    wfPaymentAddDateButton: 'Add Date',
    wfPaymentHasInitialLabel: 'Has initial payment',
    wfPaymentInitialAmountLabel: 'Initial Payment Amount',
    wfPaymentEqualLabel: 'Equal recurring payments',
    wfPaymentRecurringAmountLabel: 'Recurring Payment Amount',
    wfPaymentAmountsLabel: 'Payment Amounts',
    wfPaymentDistributeButton: 'Distribute Evenly',
    wfPaymentAddPaymentButton: 'Add Payment',
    wfPaymentNumberPrefix: 'Payment',
    wfPaymentSummaryLabel: 'Payment Summary',
    wfPaymentSummarySingle: 'Single payment',
    wfPaymentSummaryWithInitialSuffix: ' with initial payment',
    wfPaymentSummaryEqualMiddle: 'equal recurring payments',
    wfPaymentSummaryPlusInitialSuffix: ' + initial payment',
    wfPaymentSummaryCustomSingular: 'custom payment',
    wfPaymentSummaryCustomPlural: 'custom payments',
    wfPaymentOver: 'Over',
    wfPaymentUnder: 'Under',
    wfPaymentBy: 'by',
    wfPaymentSavePlanButton: 'Save Payment Plan',
    wfElementsManagementTitle: 'Element Management',
    wfElementsLoading: 'Loading elements...',
    wfElementsFilteringByPrefix: 'Filtering by:',
    wfElementsResultsSuffix: 'results',
    wfElementsAvailableTitle: 'Available Building Elements',
    wfElementsFilteredBySuffix: 'Filtered by',
    wfElementsAddSelectedButton: 'Add Selected',
    wfElementsProjectTitle: 'Project Elements',
    wfElementsDeselectAllButton: 'Deselect All',
    wfElementsSelectAllButton: 'Select All',
    wfElementsBulkActionsButton: 'Bulk Actions',
    wfElementsNoMatchPrefix: 'No elements found matching',
    wfElementsNoMatchTitle: 'No elements match your search.',
    wfElementsTryDifferent: 'Try different search terms.',
    wfElementsUnknownElement: 'Unknown Element',
    wfElementsProjectTypeFieldLabel: 'Project Type:',
    wfElementsBulkActionDescPrefix: 'Choose an action for',
    wfElementsBulkActionDescSuffix: 'selected elements',
    wfElementsChangeTypeOption: 'Change Project Type',
    wfElementsRemoveOption: 'Remove Elements from Project',
    wfElementsSelectNewTypeLabel: 'Select New Project Type:',
    wfElementsSelectTypePlaceholder: 'Select project type',
    wfElementsWarningLabel: 'Warning',
    wfElementsRemoveButton: 'Remove Elements',
    wfElementsUpdateTypeButton: 'Update Project Type',
    wfElementsCompletingButton: 'Completing...',
    wfElementsCompleteSubmissionButton: 'Complete Submission Phase',
    wfElementsNextLabel: 'Next',
    wfElementsTypeRepairLabel: 'Repair',
    wfElementsTypeRepairDesc: 'Fix existing components',
    wfElementsTypeMinorRehabLabel: 'Minor Rehabilitation',
    wfElementsTypeMinorRehabDesc: 'Minor improvements',
    wfElementsTypeMajorRehabLabel: 'Major Rehabilitation',
    wfElementsTypeMajorRehabDesc: 'Significant renovations',
    wfElementsTypeReplacementLabel: 'Replacement',
    wfElementsTypeReplacementDesc: 'Full component replacement',
    wfElementsTypeAssessmentLabel: 'Assessment Needed',
    wfElementsTypeAssessmentDesc: 'Requires evaluation',
    wfNavLoading: 'Loading workflow navigation...',
    wfNavWorkflowProgress: 'Workflow Progress',
    wfNavBadgeComplete: 'Complete',
    wfNavBadgeInProgress: 'In Progress',
    wfNavCurrent: 'Current',

    // Task #736 — Inventory & Projects translations (Bill 101 parity)
    ehfAddMaintenanceHistoryTitle: 'Add Maintenance History',
    ehfEditMaintenanceHistoryTitle: 'Edit Maintenance History',
    ehfEditModeBadge: 'Edit Mode',
    ehfRecordWorkPrefix: 'Record maintenance work performed on',
    ehfUpdateEntryDescription: 'Update the maintenance history entry details',
    ehfEventTypeLabel: 'Event Type',
    ehfEventTypePlaceholder: 'Select event type',
    ehfEventTypeOriginalConstruction: 'Original Construction',
    ehfEventTypeOriginalConstructionDesc: 'Initial construction or installation',
    ehfEventTypeRepair: 'Repair',
    ehfEventTypeRepairDesc: 'Fix or restore to working condition',
    ehfEventTypeMinorRehab: 'Minor Rehabilitation',
    ehfEventTypeMinorRehabDesc: 'Minor improvements or restoration',
    ehfEventTypeMajorRehab: 'Major Rehabilitation',
    ehfEventTypeMajorRehabDesc: 'Significant renovation or restoration',
    ehfEventTypeReplacement: 'Replacement',
    ehfEventTypeReplacementDesc: 'Complete replacement of element',
    ehfLifespanExtensionBadgeSuffix: 'years lifespan extension',
    ehfEventDateLabel: 'Event Date',
    ehfSelectDate: 'Select date',
    ehfCostLabel: 'Cost',
    ehfWorkDescriptionLabel: 'Work Description',
    ehfWorkDescriptionPlaceholder: 'Describe the maintenance work performed, materials used, and any specific details...',
    ehfVendorInformationHeading: 'Vendor Information',
    ehfVendorLabel: 'Vendor',
    ehfVendorSelectPlaceholder: 'Select vendor',
    ehfNoVendorInternalWork: 'No vendor (Internal work)',
    ehfVendorNameLabel: 'Vendor Name',
    ehfVendorNameDesc: 'Or enter vendor name manually',
    ehfVendorNamePlaceholder: 'Enter vendor name',
    ehfWarrantyInformationHeading: 'Warranty Information',
    ehfWarrantyDurationLabel: 'Warranty Duration (months)',
    ehfWarrantyTermsLabel: 'Warranty Terms',
    ehfWarrantyTermsPlaceholder: 'Parts and labor warranty',
    ehfWarrantyExpiresLabel: 'Warranty expires:',
    ehfLifespanImpactHeading: 'Lifespan Impact',
    ehfAutoCalculate: 'Auto-calculate',
    ehfLifespanExtensionLabel: 'Lifespan Extension (years)',
    ehfAdditionalNotesLabel: 'Additional Notes',
    ehfNotesPlaceholder: 'Additional notes, observations, or future recommendations...',
    ehfCancel: 'Cancel',
    ehfCreating: 'Creating...',
    ehfSaving: 'Saving...',
    ehfCreate: 'Create',
    ehfSaveChanges: 'Save Changes',

    ihdrBackToBuildingButton: 'Back to Building',
    ihdrPageTitle: 'Inventory - Building Elements',
    ihdrAddElement: 'Add Element',
    ihdrSearchPlaceholder: 'Search elements by name, UNIFORMAT code, or description...',
    ihdrFilters: 'Filters',
    ihdrOverdueLabel: 'Overdue',
    ihdrOverdueEvaluations: 'Overdue Evaluations',
    ihdrConditionLabel: 'Condition',
    ihdrAllConditionsPlaceholder: 'All conditions',
    ihdrAllConditionsItem: 'All Conditions',
    ihdrConditionExcellent: 'Excellent',
    ihdrConditionGood: 'Good',
    ihdrConditionFair: 'Fair',
    ihdrConditionPoor: 'Poor',
    ihdrConditionCritical: 'Critical',
    ihdrUniformatCategoryLabel: 'UNIFORMAT Category',
    ihdrAllCategoriesPlaceholder: 'All categories',
    ihdrAllCategoriesItem: 'All Categories',
    ihdrUniformatA: 'A - Substructure',
    ihdrUniformatB: 'B - Shell',
    ihdrUniformatC: 'C - Interiors',
    ihdrUniformatD: 'D - Services',
    ihdrUniformatE: 'E - Equipment & Furnishings',
    ihdrUniformatF: 'F - Special Construction',
    ihdrUniformatG: 'G - Building Sitework',
    ihdrEvaluationStatusLabel: 'Evaluation Status',
    ihdrFilterOverdue: 'Overdue',
    ihdrFilterDueSoon: 'Due Soon',
    ihdrFilterUpToDate: 'Up to Date',

    ubCatalogTitle: 'UNIFORMAT II Catalog',
    ubCommonButton: 'Common',
    ubSearchPlaceholder: 'Search codes, names, or descriptions...',
    ubAllLevelsPlaceholder: 'All levels',
    ubAllLevelsItem: 'All levels',
    ubLevelLabel: 'Level',
    ubAllCategoriesPlaceholder: 'All categories',
    ubAllCategoriesItem: 'All categories',
    ubCommonBadge: 'Common',
    ubFilteredResultsPrefix: 'Filtered:',
    ubFilteredResultsSuffix: 'results',
    ubNoMatchingCodes: 'No codes match your current filters',
    ubNoCodesAvailable: 'No UNIFORMAT codes available',
    ubFailedToLoad: 'Failed to load UNIFORMAT codes',
    ubLoadErrorDesc: 'An error occurred while loading the catalog',
    ubYearsSuffix: 'years',

    pcTypeEvaluation: 'Evaluation',
    pcTypeRepair: 'Repair',
    pcTypeMinorRehab: 'Minor Rehab',
    pcTypeMajorRehab: 'Major Rehab',
    pcTypeReplacement: 'Replacement',
    pcOverdueBadge: 'Overdue',
    pcOverBudgetBadge: 'Over Budget',
    pcCriticalPriorityBadge: 'Critical Priority',
    pcOpenMenu: 'Open menu',
    pcQuickActionsLabel: 'Quick Actions',
    pcEditProject: 'Edit Project',
    pcViewTimeline: 'View Timeline',
    pcAddNotes: 'Add Notes',
    pcStartWork: 'Start Work',
    pcCompleteWork: 'Complete Work',
    pcUpdatedPrefix: 'Updated',
    pcDaysOverdueSuffix: 'days overdue',
    pcDaysRemainingSuffix: 'days remaining',
    pcProgressLabel: 'Progress',
    pcStartDateLabel: 'Start Date',
    pcEndDateLabel: 'End Date',
    pcBudgetLabel: 'Budget',
    pcBudgetUsedSuffix: '% used',
    pcElementsLabel: 'Elements',
    pcElementsAssignedSuffix: 'assigned',
    pcBuildingComponents: 'Building components',
    pcStatusUpdatedTitle: 'Status Updated',
    pcStatusUpdatedDesc: 'Project status has been updated successfully.',
    pcUpdateFailedTitle: 'Update Failed',
    pcUpdateFailedDesc: 'Failed to update project status. Please try again.',

    emcEditElementLabel: 'Edit element',
    emcEditButton: 'Edit',
    emcBuiltLabel: 'Built',
    emcLastInspectionLabel: 'Last Inspection',
    emcAgeLifespanLabel: 'Age / Lifespan',
    emcLifespanProgressSuffix: '% of expected lifespan',
    emcConstructionLabel: 'Construction',
    emcUnknown: 'Unknown',
    emcNever: 'Never',
    emcNextEvaluationLabel: 'Next Evaluation',
    emcOverdueBadge: 'Overdue',
    emcDueSoonBadge: 'Due Soon',
    emcScheduledBadge: 'Scheduled',
    emcTotalCostLabel: 'Total Cost',
    emcCostPerYearAvgSuffix: '/year avg',
    emcActivityLabel: 'Activity',
    emcEntriesSuffix: 'entries',
    emcDocumentsSuffix: 'documents',
    emcTimelineButton: 'Timeline',
    emcYearsSuffix: 'years',
    emcExpectedLifespanSuffix: 'of expected lifespan',
    emcPhotoAltSuffix: 'photo',

    etElementColumn: 'Element',
    etConditionColumn: 'Condition',
    etAgeLifespanColumn: 'Age / Lifespan',
    etLastInspectionColumn: 'Last Inspection',
    etNextEvaluationColumn: 'Next Evaluation',
    etActionsColumn: 'Actions',
    etYearsSuffix: 'years',
    etNeverBadge: 'Never',
    etOverdueBadge: 'Overdue',
    etDueSoonBadge: 'Due Soon',
    etScheduledBadge: 'Scheduled',
    etNotSetBadge: 'Not set',
    etNotScheduledBadge: 'Not scheduled',
    etViewButton: 'View',
    etEditButton: 'Edit',
    etSelectAllAria: 'Select all elements',
    etSelectElementAria: 'Select element',
    etElementsSelectedSuffix: 'element(s) selected',
    etBulkEditButton: 'Bulk Actions',
    etChangeResidenceItem: 'Change Residence',
    etUpdateCostItem: 'Update Replacement Cost',
    etDeleteSelectedItem: 'Delete Selected',
    etConfirmBulkDelete: 'Are you sure you want to delete the selected elements? This action cannot be undone.',
    etElementsDeletedTitle: 'Elements deleted',
    etElementsDeletedDescPrefix: 'Successfully deleted',
    etElementsDeletedDescSuffix: 'element(s).',
    etPartiallyCompletedTitle: 'Partially completed',
    etPartiallyCompletedDesc: 'Some elements could not be deleted.',
    etDeleteFailedTitle: 'Delete failed',
    etDeleteFailedDesc: 'Failed to delete the selected elements.',
    etElementDeletedTitle: 'Element deleted',
    etElementDeletedDesc: 'The element has been removed from the inventory.',
    etDeleteFailedSingleTitle: 'Delete failed',
    etDeleteFailedSingleDesc: 'Failed to delete the element.',
    etFailedToLoadTitle: 'Failed to load elements',
    etFailedToLoadDesc: 'There was a problem loading the inventory.',
    etLoadingMessage: 'Loading elements...',
    etNoElementsFoundTitle: 'No elements found',

    htDateColumn: 'Date',
    htEventTypeColumn: 'Event',
    htDescriptionColumn: 'Description',
    htVendorColumn: 'Vendor',
    htCostColumn: 'Cost',
    htWarrantyColumn: 'Warranty',
    htInternalLabel: 'Internal',
    htNoCostLabel: 'No cost',
    htWarrantyNoneLabel: 'None',
    htWarrantyYearSuffix: 'year',
    htWarrantyYearsSuffix: 'years',
    htWarrantyUntilPrefix: 'Until',
    htOpenMenu: 'Open menu',
    htEditEntry: 'Edit Entry',
    htViewDocuments: 'View Documents',
    htDeleteEntry: 'Delete Entry',
    htDeleteHistoryTitle: 'Delete history entry?',
    htCancelButton: 'Cancel',
    htDeleteButton: 'Delete',
    htTotalCostLabel: 'Total Cost',
    htCostPerYearAvgSuffix: '/year avg',
    htLifespanExtensionLabel: 'Lifespan Extension',
    htLifespanFromInterventionsPrefix: 'From',
    htLifespanFromInterventionsSuffix: 'interventions',
    htLastMaintenanceLabel: 'Last Maintenance',
    htLastMaintenanceNever: 'Never',
    htWorkEventsLabel: 'Work Events',
    htMaintenanceHistoryTitle: 'Maintenance History',
    htMaintenanceHistoryDescPrefix: 'Complete history for',
    htSearchPlaceholder: 'Search history...',
    htNoHistoryTitle: 'No maintenance history',
    htNoHistoryDesc: 'No maintenance work has been recorded for this element yet.',
    htReturnToInventory: 'Return to inventory',
    htHistoryEntryDeletedTitle: 'History entry deleted',
    htHistoryEntryDeletedDesc: 'The maintenance history entry has been removed.',
    htDeleteFailedTitle: 'Delete failed',
    htDeleteFailedDesc: 'Failed to delete the history entry.',
    htFailedToLoadTitle: 'Failed to load history',
    htFailedToLoadDesc: 'There was a problem loading the maintenance history.',
    htConstructionEventLabel: 'Construction',
    htRepairEventLabel: 'Repair',
    htMinorRehabEventLabel: 'Minor Rehab',
    htMajorRehabEventLabel: 'Major Rehab',
    htReplacementEventLabel: 'Replacement',
    htAuditDialogTitle: 'Edit History',
    htAuditEditorLabel: 'Editor',
    htAuditTimestampLabel: 'Timestamp',
    htAuditSystemEditor: 'System',
    htAuditEmptyState: 'No recorded changes',
    htAuditEmptyStateDetail: 'This entry was edited before change tracking existed, or was modified directly in the database.',
    htAuditLoadError: 'Failed to load edit history',
    htAuditRetry: 'Retry',
    htAuditFieldEventType: 'Event Type',
    htAuditFieldEventDate: 'Event Date',
    htAuditFieldWorkDescription: 'Work Description',
    htAuditFieldCost: 'Cost',
    htAuditFieldVendor: 'Vendor',
    htAuditFieldLifespanImpact: 'Lifespan Impact',
    htAuditFieldWarranty: 'Warranty',
    htAuditValueNotSet: '—',
    htAuditBeforeLabel: 'Before',
    htAuditAfterLabel: 'After',
    htAuditEditedIndicator: 'edited',
    htAuditViewChanges: 'View changes',
    htAuditFieldColumnHeader: 'Field',

    edpEditAction: 'Edit',
    edpUploadFilesAction: 'Upload Files',
    edpScheduleAction: 'Schedule Evaluation',
    edpDeleteAction: 'Delete',
    edpDeleteDialogTitle: 'Delete this element?',
    edpDeleteDialogConfirmCancel: 'Cancel',
    edpDeletingProgress: 'Deleting...',
    edpOverviewTab: 'Overview',
    edpDocumentsTab: 'Documents',
    edpProjectsTab: 'Projects',
    edpStatusEvaluationTitle: 'Status & Evaluation',
    edpCurrentConditionLabel: 'Current Condition',
    edpNextEvaluationLabel: 'Next Evaluation',
    edpLastInspectionLabel: 'Last Inspection',
    edpLastInspectionNever: 'Never',
    edpUrgencyOverdueLabel: 'Overdue',
    edpUrgencyDueSoonLabel: 'Due Soon',
    edpUrgencyScheduledLabel: 'Scheduled',
    edpUrgencyNotScheduledLabel: 'Not scheduled',
    edpLifespanAnalysisTitle: 'Lifespan Analysis',
    edpAgeProgressLabel: 'Age vs. Expected Lifespan',
    edpYearsSuffix: 'years',
    edpNearingEndLifespan: 'Nearing end of expected lifespan',
    edpAgingMonitor: 'Aging - monitor closely',
    edpGoodRemaining: 'Good remaining lifespan',
    edpOriginalLifespanLabel: 'Original Lifespan',
    edpCurrentLifespanLabel: 'Current Lifespan',
    edpConstructionDateLabel: 'Construction Date',
    edpSpecificationsTitle: 'Specifications',
    edpQuantityLabel: 'Quantity',
    edpUniformatCodeLabel: 'UNIFORMAT Code',
    edpNotesLabel: 'Notes',
    edpUnknownSize: 'Unknown size',
    edpNoDocumentsUploaded: 'No documents uploaded yet.',
    edpProjectNumberPrefix: 'Project',
    edpNoRelatedProjects: 'No related projects.',
    edpElementDeletedToastTitle: 'Element deleted',
    edpElementDeletedToastDesc: 'The element has been removed.',

    iovHeaderTitle: 'Inventory Overview',
    iovToggleSrText: 'Toggle building edit mode',
    iovBuildingConstructionDate: 'Building Construction Date',
    iovDefaultForNewElements: 'Used as a default for new elements without explicit construction date.',
    iovTotalElementsTitle: 'Total Elements',
    iovBuildingInventoryItems: 'Building inventory items',
    iovCriticalAlertsTitle: 'Critical Alerts',
    iovPoorOrCriticalCondition: 'Poor or critical condition',
    iovOverdueEvaluationsTitle: 'Overdue Evaluations',
    iovPastDueDate: 'Past due date',
    iovAssetValueTitle: 'Asset Value',
    iovEstimatedReplacementCost: 'Estimated replacement cost',
    iovConditionBreakdownTitle: 'Condition Breakdown',
    iovQuickStatisticsTitle: 'Quick Statistics',
    iovKeyInsightsTrends: 'Key insights and trends',
    iovAverageAgeLabel: 'Average Age',
    iovYearsSuffix: 'years',
    iovDueSoonLabel: 'Due Soon',
    iovMostCommonCategoryLabel: 'Most Common Category',
    iovBuildingUpdatedTitle: 'Building updated',
    iovBuildingUpdatedDesc: 'Construction date has been saved.',
    iovInvalidDateTitle: 'Invalid date',
    iovInvalidDateDesc: 'Please enter a valid date.',
    iovInvalidDateRangeDesc: 'Date must be between 1800 and today.',
    iovConditionExcellent: 'Excellent',
    iovConditionGood: 'Good',
    iovConditionFair: 'Fair',
    iovConditionPoor: 'Poor',
    iovConditionCritical: 'Critical',
    // i18n migration (task 729): EN strings for previously-untranslated JSX text.
    pwdDoesNotMeetRequirements: 'Password does not meet security requirements.',
    pwdSecTipUseUniqueCombination: 'Use a unique combination of letters, numbers, and symbols',
    pwdSecTipAvoidPersonalInfo: 'Avoid personal information (name, date of birth)',
    pwdSecTipDoNotReuse: 'Do not reuse a password from another account',
    pwdSecTipUsePasswordManager: 'Consider using a password manager',
    pcsCompleteToFinalizeRegistration: 'Complete your profile to finalize your registration and access the property management services.',
    qpcLaw25Heading: 'Personal information protection (Law 25 - Quebec):',
    qpcConsentRequiredText: ' Your consent is required for the collection and use of your personal data.',
    qpcMasterAcceptAllText: 'I accept all types of data collection and processing (essential and optional).',
    qpcEssentialDataLabel: 'Essential data collection (Required) *',
    qpcEssentialDataDesc: 'Authentication, communication, account management, property management services.',
    qpcMarketingDesc: 'Promotional communications, new features, special offers.',
    qpcAnalyticsDesc: 'Anonymized usage data to improve our services.',
    qpcThirdPartyDesc: 'Mapping, notifications, storage to enhance the experience.',
    qpcAcknowledgeRightsLabel: 'Acknowledgement of my rights (Required) *',
    qpcAcknowledgeRightsDesc: 'I have been informed of my rights regarding my personal information and I understand that I can exercise these rights at any time.',
    qpcCheckboxRequiredWarning: '⚠️ This box must be checked to continue.',
    qpcRightsHeading: '📋 Your rights under Quebec Law 25',
    qpcPortabilityDesc: ' Retrieve your data in a readable format',
    qpcContactPara: 'To exercise your rights or for any question regarding your personal data, contact our data protection officer:',
    qpcSecurityDesc: ' Your data is encrypted and stored on secure servers in Canada',
    qpcRetentionDesc: ' Your data is retained according to Quebec legal requirements',
    qpcTransparencyDesc: ' Consult our full privacy policy at any time',
    tvsValidatingInvitationDesc: 'Verifying the invitation token and associated details...',
    tvsNoTokenFoundDesc: 'No valid invitation token was found. Please use the invitation link received by email.',
    tvsCannotValidateInvitation: 'Unable to validate the invitation',
    tvsLinkExpiredOrInvalid: 'The invitation link may be expired, invalid, or already used.',
    tvsCheckUseFullLink: 'Check that you are using the complete link received by email',
    tvsCheckNotExpired: "Make sure the invitation has not expired",
    tvsContactAdminIfPersists: 'Contact the administrator if the issue persists',
    tvsInvitationValidProceed: 'Invitation valid! You can proceed to create your account.',
    ffBusinessObjectivePlaceholder: 'What problem does this feature solve? What business value does it provide?',
    ffSuccessMetricsPlaceholder: 'How will we measure success? What are the KPIs?',
    ffTimelinePlaceholder: 'e.g., 2 weeks, 1 month, Next sprint',
    ffDependenciesPlaceholder: 'What other features, APIs, or systems does this depend on?',
    ffDataReqPlaceholder: 'What data needs to be stored, modified, or accessed?',
    ffIntegrationNeedsPlaceholder: 'External APIs, services, or third-party integrations needed',
    ffSecurityConsidPlaceholder: 'Authentication, authorization, data privacy concerns',
    ffUserFlowPlaceholder: 'Describe the step-by-step user interaction with this feature',
    ffUiReqPlaceholder: 'Specific UI components, layouts, or visual requirements',
    ffAccessibilityPlaceholder: 'Screen reader support, keyboard navigation, color contrast',
    ffPerfReqPlaceholder: 'Load times, data processing speed, scalability needs',
    ffTestingStrategyPlaceholder: 'Unit tests, integration tests, user acceptance criteria',
    ffAdditionalNotesPlaceholder: 'Any other requirements, constraints, or considerations',
    ffsFeatureNamePlaceholder: 'What is this feature called?',
    ffsFeatureDescPlaceholder: "Describe what this feature does and why it's needed",
    ffsBusinessObjectivePlaceholder: 'What business problem does this solve? What value does it provide?',
    ffsTargetUsersPlaceholder: 'Who will use this feature? (Admins, Managers, Tenants, Residents)',
    ffsSuccessMetricsPlaceholder: 'How will we measure the success of this feature?',
    ffsTimelinePlaceholder: 'When does this need to be completed?',
    ffsDependenciesPlaceholder: 'What other features, APIs, or systems does this depend on?',
    ffsDataReqPlaceholder: 'What data needs to be stored, modified, or accessed?',
    ffsIntegrationNeedsPlaceholder: 'External APIs, services, or third-party integrations needed',
    ffsSecurityConsidPlaceholder: 'Authentication, authorization, data privacy concerns',
    ffsUserFlowPlaceholder: 'Describe the step-by-step user interaction with this feature',
    ffsUiReqPlaceholder: 'Specific UI components, layouts, or visual requirements',
    ffsAccessibilityPlaceholder: 'Screen reader support, keyboard navigation, color contrast',
    ffsPerfReqPlaceholder: 'Load times, data processing speed, scalability needs',
    ffsTestingStrategyPlaceholder: 'Unit tests, integration tests, user acceptance criteria',
    ffsAdditionalNotesPlaceholder: 'Any other important information, constraints, or context',
    apcDismissReasonPlaceholder: 'Provide a reason for dismissing this project...',
    apdPlanningDescPlaceholder: 'Detailed planning description for the project...',
    ehfWorkDescPlaceholder: 'Describe the maintenance work performed, materials used, and any specific details...',
    vfNotesPlaceholder: 'Additional notes about this vendor, specialties, service quality, etc.',
    permSearchPlaceholder: 'Search permissions by name, description, or resource type...',
    fpEmailSentTitle: 'Email sent',
    fpEmailSentDesc: 'If your email address is in our system, you will receive a password reset link within a few minutes.',
    fpCheckSpamFolder: "Don't forget to check your spam folder.",
    fpEnterEmailToReceiveLink: 'Enter your email address to receive a password reset link',
    fpSendSecureResetLinkDesc: 'We will send you a secure link to reset your password',
    iaWelcomeAccountCreated: 'Welcome {firstName} {lastName}! Your account has been created successfully.',
    iaCanLoginWithEmailPassword: 'You can now log in with your email and password',
    iaConsentsRecordedLaw25: 'Your consents have been recorded in accordance with Quebec Law 25. You can exercise your rights at any time by contacting our team.',
    iaCompleteRegistrationToJoin: 'Complete your registration to join the Koveo Gestion platform',
    iaTermsAcceptanceFooter: 'By signing up, you accept our terms of use and our privacy policy compliant with Quebec Law 25.',
    rpResetCompleteDesc: 'Your password has been updated successfully. You can now log in with your new password.',
    rpInvalidLinkDesc: 'The reset link is invalid or missing.',
    budgetReserveFundExamplePlaceholder: 'e.g., Reserve Fund, Maintenance Buffer, Capital Reserve',
    dtSuggestedProsLabel: 'Suggested professionals (comma-separated)',
    dtSuggestedProsPlaceholder: 'Notary, Lawyer',
    dtPageTitle: 'Document Tags',
    dtPageSubtitle: 'Manage Koveo and custom tags',
    dtViewToggleTags: 'Tags',
    dtViewToggleFamilies: 'Link Families',
    dtSectionHeading: 'Tags',
    dtCreateButton: 'New tag',
    dtSystemCardTitle: 'Koveo Tags (system)',
    dtCustomCardTitle: 'Custom Tags',
    dtColName: 'Name',
    dtColScope: 'Scope',
    dtColImportance: 'Importance',
    dtColProfessionals: 'Professionals',
    dtColActions: 'Actions',
    dtReadOnly: 'Read only',
    dtLoading: 'Loading…',
    dtEmpty: 'No tags.',
    dtDialogEditTitle: 'Edit tag',
    dtDialogNewTitle: 'New tag',
    dtNameLabel: 'Name *',
    dtDescriptionLabel: 'Description',
    dtScopeLabel: 'Scope',
    dtImportanceLabel: 'Importance',
    dtScopeAny: 'Any',
    dtScopeBuilding: 'Building',
    dtScopeResidence: 'Residence',
    dtImportanceObligatoire: 'Mandatory',
    dtImportanceNiceToHave: 'Recommended',
    dtImportanceExtra: 'Extra',
    dtCancelButton: 'Cancel',
    dtSaveButton: 'Save',
    dtCreateSubmitButton: 'Create',
    dtToastUpdatedTitle: 'Tag updated',
    dtToastCreatedTitle: 'Tag created',
    dtToastDeletedTitle: 'Tag deleted',
    dtToastErrorTitle: 'Error',
    dtDeleteConfirm: 'Delete tag "{name}"?',
    dtNameRequired: 'Name required',
    dtKoveoTagLabel: 'Official Koveo tag — available to all organizations',
    dtKoveoTagHelper: 'When enabled, this tag becomes a system tag visible to every organization.',
    lfSectionHeading: 'Link Families',
    lfSectionDescription: 'Link families group documents into independent reading sequences. A document can belong to multiple families (e.g. Financial, AGA). In the viewer, ← / → navigates within the active family and ↑ / ↓ switches between families.',
    lfCreateButton: 'New family',
    lfSearchPlaceholder: 'Search families…',
    lfSystemCardTitle: 'Koveo families',
    lfCustomCardTitle: 'Custom families',
    lfLoading: 'Loading…',
    lfEmpty: 'No families yet.',
    lfColName: 'Name',
    lfColDescription: 'Description',
    lfColActions: 'Actions',
    lfDialogEditTitle: 'Edit link family',
    lfDialogNewTitle: 'New link family',
    lfDialogDescription: 'A link family defines an independent sequence of documents that can be navigated with ← / →.',
    lfNameLabel: 'Name',
    lfDescriptionLabel: 'Description',
    lfDescriptionPlaceholder: 'Optional description…',
    lfKoveoFamilyLabel: 'Koveo system family',
    lfKoveoFamilyHelper: 'System families are seeded by Koveo and visible to all organizations.',
    lfOrganizationLabel: 'Organization',
    lfOrganizationPlaceholder: 'Select an organization…',
    lfCreateSubmitButton: 'Create',
    lfToastCreatedTitle: 'Family created',
    lfToastUpdatedTitle: 'Family updated',
    lfToastDeletedTitle: 'Family deleted',
    lfToastErrorTitle: 'Error',
    lfDeleteConfirm: 'Delete family "{name}"?',
    sfNameSequence: 'Sequence',
    sfDescSequence: 'General sequential order (e.g. version history or reading order)',
    sfNameFinancial: 'Financial',
    sfDescFinancial: 'Financial documents linked in chronological order (budgets, statements)',
    sfNameMeetingsAGA: 'Meetings (AGA)',
    sfDescMeetingsAGA: 'Annual general assembly minutes and related documents',
    sfNameContracts: 'Contracts',
    sfDescContracts: 'Contracts and amendments linked across versions or renewals',
    sfNameMaintenance: 'Maintenance',
    sfDescMaintenance: 'Maintenance reports, inspections, and follow-up documents',
    sfNameDeclarationCopropriete: 'Declaration of co-ownership',
    sfDescDeclarationCopropriete: 'Versions and amendments of the founding act registered at the land registry',
    sfNameReglementsImmeuble: 'Building bylaws',
    sfDescReglementsImmeuble: 'Adoption and amendments of internal building bylaws',
    sfNameCertificatLocalisation: 'Certificate of location',
    sfDescCertificatLocalisation: 'Successive certificates of location issued for the building',
    sfNameEtudeFondsPrevoyance: 'Contingency fund study',
    sfDescEtudeFondsPrevoyance: 'Quinquennial contingency fund studies and updates (Bill 16)',
    sfNameCarnetEntretien: 'Maintenance logbook',
    sfDescCarnetEntretien: 'Entries and updates of the official maintenance logbook (Bill 16)',
    sfNameProcesVerbauxCA: 'Board meeting minutes',
    sfDescProcesVerbauxCA: 'Board meeting minutes and resolutions (distinct from the AGM chain)',
    sfNameAvisCoproprietaires: 'Notices to co-owners',
    sfDescAvisCoproprietaires: 'Official notices: convocations, assessment notices, art. 1069 notices, etc.',
    sfNameEtatsFinanciers: 'Financial statements',
    sfDescEtatsFinanciers: 'Annual financial statements, review engagements, and audit reports',
    sfNameBudgetsAnnuels: 'Annual budgets',
    sfDescBudgetsAnnuels: 'Yearly budget approvals and revisions',
    sfNameCotisationsSpeciales: 'Special assessments',
    sfDescCotisationsSpeciales: 'Life cycle of a special assessment: resolution → notice → releases',
    sfNameAssurances: 'Insurance',
    sfDescAssurances: 'Annual insurance policy renewals and endorsements',
    sfNameSinistres: 'Insurance claims & losses',
    sfDescSinistres: 'A single loss event: declaration → expert reports → settlement',
    sfNamePermisAutorisations: 'Permits & authorizations',
    sfDescPermisAutorisations: 'Municipal permits and amendments tied to a project',
    sfNameInspectionsImmeuble: 'Building inspections',
    sfDescInspectionsImmeuble: 'Recurring façade, roof, garage, elevator, and environment inspections',
    sfNameTravauxMajeurs: 'Major works',
    sfDescTravauxMajeurs: 'Full project life: bids → contract → amendments → progress payments → releases',
    sfNameBaux: 'Leases',
    sfDescBaux: 'Lease renewals per rental unit (TAL-compliant chain)',
    sfNameDossierCoproprietaire: 'Resident file',
    sfDescDossierCoproprietaire: 'Per-resident document history',
    sfNameMutationsVentes: 'Unit sales & transfers',
    sfDescMutationsVentes: 'Documents tied to a unit sale: art. 1069 certificate, charges statement, notary follow-up',
    sfNameProceduresJuridiques: 'Legal proceedings',
    sfDescProceduresJuridiques: 'Life of a dispute: demand letter → proceedings → judgment → enforcement',
    sfNameEvaluationsMunicipales: 'Municipal assessments & taxes',
    sfDescEvaluationsMunicipales: 'Annual assessment roll and tax bills',
    sfNameServicesPublics: 'Utilities',
    sfDescServicesPublics: 'Recurring utility bill series (Hydro, gas, water, telecom) per account/meter',
    linkFamilyLabel: 'Family',
    linkFamilyPlaceholder: 'Select a family…',
    linkFamilyNone: 'No families available',
    ihGlobalSearchPlaceholder: 'Search elements by name, UNIFORMAT code, or description...',
    pdvFailedToLoadDashboard: 'Failed to load dashboard analytics. Please try again.',
    pdvSelectBuildingForDashboard: 'Please select a building to view its project dashboard.',
    pdvAnalyticsInsightsSubtitle: 'Analytics, insights, and performance metrics for maintenance project management',
    pdvProjectTrendsDesc: 'Monthly project creation and completion trends',
    pdvBudgetTrendsDesc: 'Planned vs actual budget utilization over time',
    pdvOverdueProjectsAlert: '{count} project(s) are overdue and require immediate attention.',
    pdvExecSummaryDesc: 'Key insights and recommendations for project portfolio management',
    pdpComprehensiveDetails: 'Comprehensive project details, timeline, budget, and management tools',
    pdpFailedToLoadDetails: 'Failed to load project details. Please try again.',
    pdpElementsAssociatedDesc: 'Building elements associated with this project',
    pdpElementMgmtFullView: 'Element management available in full view',
    ptvFailedToLoadProjects: 'Failed to load projects. Please try refreshing the page.',
    ptvSelectBuildingForProjects: 'Please select a building to view its maintenance projects.',
    ptvNoProjectsCreated: 'No maintenance projects have been created for this building yet.',
    ptvGetStartedSuggestion: 'Get started by creating your first project or generating projects from evaluation suggestions.',
    ptvNoProjectsMatchFilters: 'No projects match your current search and filter criteria.',
    ptvAdjustFiltersHint: 'Try adjusting your filters or search terms.',
    ptvRealTimeBulkActionsHint: 'Project data is updated in real-time. Use bulk actions to manage multiple projects at once.',
    ptlvFailedToLoadTimeline: 'Failed to load timeline data. Please try refreshing the page.',
    ptlvSelectBuildingForTimeline: 'Please select a building to view its project timeline.',
    ptlvScheduleOverviewSubtitle: 'Schedule overview and milestone tracking for all projects',
    ptlvClickDateForEvents: 'Click on any date to view scheduled events',
    ptlvOverdueEventsAlertSingular: '{count} project event is overdue. Review project schedules and consider adjusting timelines or reallocating resources.',
    ptlvOverdueEventsAlertPlural: '{count} project events are overdue. Review project schedules and consider adjusting timelines or reallocating resources.',
    povFailedToLoadMetrics: 'Failed to load project metrics. Please try refreshing the page.',
    povConsiderReviewingPortfolio: 'Consider reviewing project portfolio and resource allocation.',
    siReviewAndSelectDesc: 'Review and select evaluation suggestions to automatically create maintenance projects. Projects will be generated with standard workflows and can be customized after creation.',
    siFailedToLoadSuggestions: 'Failed to load suggestions. Please try again.',
    siProjectDefaultsDesc: 'Set default values for all generated projects',
    confidenceBandHigh: 'High',
    confidenceBandMedium: 'Medium',
    confidenceBandLow: 'Low',
    confidenceAiNotRun: 'AI not run',
    confidenceLowTooltip: 'AI confidence: {pct}. The AI ran and returned a low score — review this file. Nothing is auto-discarded based on confidence.',
    confidenceDefaultTooltip: 'AI confidence: {pct}. Nothing is auto-discarded based on this score — low confidence means "needs review", not "discard this".',
    confidenceAiNotRunTooltip: 'The AI did not analyze this file. Nothing is auto-discarded based on confidence — a low score means "needs review", not "discard this".',
    aiUnavailableNoApiKey: 'The AI analyzer is not configured on this deployment. Every document will receive a generic 20% confidence score based on its filename only — no real analysis is performed.',
    aiUnavailableMisconfigured: 'The Anthropic API key is configured but appears to be invalid, or the requested model name is not recognised. Every document will receive a generic 20% confidence score until the deployment settings are corrected.',
    residenceUnitsLoadError: 'Failed to load residences. Refresh and try again.',
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
    superAdmin: 'Super Admin',
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
    'bills.aiConfidenceHigh': "L'IA est confiante quant à cette valeur",
    'bills.aiConfidenceMedium': 'Veuillez vérifier cette valeur',
    'bills.aiConfidenceLow': 'Faible confiance — révision manuelle recommandée',
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
    failedToDeleteDocumentsCount_one: 'Échec de la suppression de {count} document. Veuillez réessayer.',
    failedToDeleteDocumentsCount_other: 'Échec de la suppression de {count} documents. Veuillez réessayer.',
    docManagerDocumentCount_one: '{count} document pour {name}',
    docManagerDocumentCount_other: '{count} documents pour {name}',
    bulkImportAnalyzing_one: '{count} document est encore en cours d\'analyse. Attendez la fin de l\'analyse ou excluez-le pour continuer.',
    bulkImportAnalyzing_other: '{count} documents sont encore en cours d\'analyse. Attendez la fin de l\'analyse ou excluez-les pour continuer.',
    bulkImportResidenceIncomplete_one: '{count} document de résidence nécessite une résidence avant de continuer.',
    bulkImportResidenceIncomplete_other: '{count} documents de résidence nécessitent une résidence avant de continuer.',
    bulkImportBranchingPending_one: '{count} décision de branchement en attente. Acceptez ou choisissez manuellement pour continuer.',
    bulkImportBranchingPending_other: '{count} décisions de branchement en attente. Acceptez ou choisissez manuellement pour continuer.',
    bulkImportFallbackPending_one: '{count} fichier doit être assigné manuellement (l\'IA n\'a pas pu le traiter). Vérifiez-le ou excluez-le pour continuer.',
    bulkImportFallbackPending_other: '{count} fichiers doivent être assignés manuellement (l\'IA n\'a pas pu les traiter). Vérifiez-les ou excluez-les pour continuer.',
    bulkImportCommitted_one: '{count} document sauvegardé.',
    bulkImportCommitted_other: '{count} documents sauvegardés.',
    bulkImportNextStep: 'Étape suivante',
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
    plumbing: 'Plomberie',
    electrical: 'Électricité',
    hvac: 'CVC',
    general: 'Général',
    elevator: 'Ascenseur',
    submitMaintenanceRequest: 'Soumettre une demande d\'entretien',
    managerWillBeNotified: 'Votre gestionnaire sera informé.',
    maintenancePhotoOptional: 'Photo (facultatif)',
    maintenanceRequestSubmitted: 'Demande d\'entretien soumise',
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
    selectPriority: 'Sélectionner la priorité',
    locationPlaceholder: 'ex. Tableau de bord, Page de connexion, Paramètres',
    uiUx: 'UI/UX',
    functionality: 'Fonctionnalité',
    performance: 'Performance',
    data: 'Données',
    integration: 'Intégration',
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
    upvotedMessage: 'Vote enregistré !',
    upvotedDescription: 'Votre vote positif a été enregistré.',
    failedUpvote: 'Échec du vote',
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
    rescanCompliance: "Relancer l'analyse",
    notAvailable: 'N/D',
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
    ganttEditProject: 'Modifier les dates',
    ganttSaveChanges: 'Enregistrer',
    ganttCancel: 'Annuler',
    ganttDiscardUnsaved: 'Abandonner les modifications non enregistrées?',
    ganttResizeStart: 'Glisser pour modifier la date de début',
    ganttResizeEnd: 'Glisser pour modifier la date de fin',
    ganttDurationDays: 'jours',
    budgetPlannedEndDate: 'Date de fin prévue',
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
    myResidences: 'Mes résidences',
    noResidenceLinkedYet: 'Aucune résidence liée pour l\'instant — contactez votre gestionnaire.',
    residencesLoadError: 'Impossible de charger vos résidences. Veuillez réessayer plus tard.',
    residenceRelationshipOwner: 'Propriétaire',
    residenceRelationshipTenant: 'Locataire',
    residenceRelationshipOccupant: 'Occupant',
    residenceSince: 'Depuis',
    myBuilding: 'Mon bâtiment',
    commonSpaces: 'Espaces communs',
    budget: 'Budget',
    bills: 'Factures',
    demands: 'Demandes',
    navUserManagement: 'Gestion des utilisateurs',
    documentTags: 'Étiquettes de documents',
    manageCommonSpaces: 'Gérer les espaces communs',
    pillars: 'Piliers',
    roadmap: 'Feuille de route',
    navQualityAssurance: 'Assurance qualité',
    navLaw25Compliance: 'Conformité Loi 25',
    navBulkDocumentImport: 'Importation de documents en masse',
    navKpiDashboard: 'Tableau de bord KPI',
    navImpersonationLog: "Journal d'usurpation d'identité",
    navOrgAccess: "Accès aux organisations",
    kpiDashboardTitle: 'Tableau de bord KPI',
    kpiDashboardSubtitle: 'Mesures opérationnelles agrégées à partir de la télémétrie produit.',
    kpiBulkImportFilenameTitle: 'Import en masse — suggestions de noms IA',
    kpiBulkImportFilenameDescription: "Acceptation des noms de fichiers suggérés par l'IA pendant l'étape de tri de l'import en masse.",
    kpiBulkImportBranchTitle: 'Import en masse — branche de destination IA',
    kpiBulkImportBranchDescription: "Acceptation de la branche de destination suggérée par l'IA (documents d'immeuble ou de résidence) pendant l'étape de branchement.",
    kpiBulkImportResidenceTitle: 'Import en masse — sélection de résidence IA',
    kpiBulkImportResidenceDescription: "Acceptation de la résidence suggérée par l'IA pour les éléments dirigés vers les documents de résidence.",
    kpiBulkImportEffectiveDateTitle: "Import en masse — date d'entrée en vigueur IA",
    kpiBulkImportEffectiveDateDescription: "Acceptation de la date d'entrée en vigueur suggérée par l'IA pendant l'étape d'identification.",
    kpiBulkImportTagsTitle: "Import en masse — suggestions d'étiquettes IA",
    kpiBulkImportTagsDescription: "Acceptation de l'ensemble d'étiquettes suggéré par l'IA pendant l'étape d'identification (comparaison d'ensembles).",
    kpiByLanguage: "Par langue d'interface",
    kpiByBranchType: 'Par type de branche',
    kpiOverall: 'Global',
    kpiAcceptRate: "Taux d'acceptation",
    kpiTotalDecisions: 'Décisions',
    kpiVerbatim: 'Tel quel',
    kpiEdited: 'Modifié',
    kpiCleared: 'Effacé',
    kpiNoSuggestion: 'Aucune suggestion',
    kpiLanguage: 'Langue',
    kpiBranchType: 'Type de branche',
    kpiNoData: 'Aucune télémétrie enregistrée pour le moment.',
    kpiLoadFailed: 'Échec du chargement des KPI.',
    kpiBranchKeep: 'Garder',
    kpiBranchMerge: 'Fusionner',
    kpiBranchSplit: 'Diviser',
    kpiBranchBuildingDocuments: "Documents d'immeuble",
    kpiBranchResidenceDocuments: 'Documents de résidence',
    kpiLangEnglish: 'Anglais',
    kpiLangFrench: 'Français',
    kpiLangUnknown: 'Inconnu',
    kpiFiltersTitle: 'Filtres',
    kpiFiltersDescription: 'Restreindre les mesures à une plage de dates ou à une organisation.',
    kpiDateRange: 'Plage de dates',
    kpiRangeLast7Days: '7 derniers jours',
    kpiRangeLast30Days: '30 derniers jours',
    kpiRangeLast90Days: '90 derniers jours',
    kpiRangeCustom: 'Plage personnalisée',
    kpiFrom: 'Du',
    kpiTo: 'Au',
    kpiPickDate: 'Choisir une date',
    kpiPickRangeHint: 'Choisissez une date de début et de fin pour charger les mesures.',
    kpiOrganization: 'Organisation',
    kpiAllOrganizations: 'Toutes les organisations',
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
    noResidenceLinkedTitle: 'Aucune résidence liée',
    noResidenceLinkedDescription: 'Aucune résidence n\'est liée à votre compte. Contactez votre gestionnaire d\'immeuble.',
    selectYourResidence: 'Sélectionnez votre résidence',
    selectYourBuilding: 'Sélectionnez votre immeuble',
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
    today: 'Aujourd\'hui',
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
    attachFile: 'Joindre un fichier',
    replaceFile: 'Remplacer le fichier',
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
    
    titleRequired: 'Le titre est requis',
    descriptionMinLength20: 'La description doit contenir au moins 20 caractères',
    pageLocationRequired: 'La page/localisation est requise',
    savingChanges: 'Enregistrement...',
    fileAttached: 'Fichier joint',
    searchAndFilters: 'Recherche et filtres',
    categoryAndSort: 'Catégorie et tri',
    
    mostUpvotes: 'Plus de votes',
    whyIsThisNeeded: 'Pourquoi est-ce nécessaire?',
    chooseDocumentType: 'Choisir le type de document',
    textDocument: 'Document texte',
    selectFileToUpload: 'Sélectionner le fichier à télécharger',
    attachScreenshot: 'Joindre une capture d\'écran, une maquette ou un document',
    addDetailedNotes: 'Ajouter des notes détaillées, des spécifications ou toute information supplémentaire...',
    internalNotesVisibleAdmins: 'Notes internes (visibles aux administrateurs seulement)',
    currentAttachment: 'Pièce jointe actuelle',
    uploadNewFileToReplace: 'Télécharger un nouveau fichier pour remplacer la pièce jointe actuelle',
    attachment: 'Pièce jointe',
    attachments: 'Pièces jointes',
    submittedOn: 'Soumis le',
    lastUpdatedOn: 'Dernière mise à jour le',
    featureTitlePlaceholder: 'p. ex. Ajouter l\'exportation en masse pour les documents',
    whyIsThisNeededPlaceholder: 'Expliquez le besoin spécifique que cette fonctionnalité répond...',
    pageLocationPlaceholder: 'p. ex. Gestion des documents',
    adminNotes: 'Notes administratives',
    search: 'Rechercher',
    tryAdjustingSearchOrFilters: 'Essayez d\'ajuster votre recherche ou vos filtres.',
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
    noResidencesMatchSearch: 'Aucune résidence ne correspond à votre recherche.',
    
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
    budgetYearEndProjectionTooltip:
      'Solde projeté à la fin de l\'exercice financier. Cette valeur est indépendante de la durée affichée dans le graphique.',
    budgetYearEndProjectionFiscalYearEndLabel: 'Fin de l\'exercice',
    budgetYearEndProjectionMonthsRemainingLabel: 'Mois restants',
    budgetYearEndProjectionMonthsRemainingUnit: 'mois',
    budgetYearEndProjectionActiveFiscalYearLabel: 'Exercice actif',
    budgetActiveFiscalYear: 'Exercice en cours',
    budgetLengthTooltip:
      'Contrôle uniquement la fenêtre d\'affichage du graphique. N\'affecte pas la projection de fin d\'exercice.',
    budgetTotalInvestment: 'Investissement total',
    budgetNoDataForPeriod: 'Aucune donnée budgétaire pour cette période',
    budgetConfigureAction: 'Configurer le budget',
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
    firstDocumentOfChain: 'Premier document de la chaîne',
    lastDocumentOfChain: 'Dernier document de la chaîne',
    linkPositionLabel: 'Lier comme',
    chainPanelTitle: 'Séquence',
    chainPanelEmpty: 'Aucune séquence — liez un document précédent ou suivant pour en créer une.',
    chainCurrentBadge: 'Actuel',
    chainRemoveAction: 'Retirer de la séquence',
    chainDragHandleLabel: 'Glisser pour réordonner',
    chainReorderErrorTitle: 'Échec du réordonnancement',
    chainRemoveSuccessTitle: 'Retiré de la séquence',
    chainRemoveErrorTitle: 'Échec du retrait',
    notFoundTitle: 'Page introuvable',
    notFoundMessage: "Page introuvable. Vérifiez l'URL ou retournez au tableau de bord.",

    // Budget filter labels & section helpers
    budgetViewType: 'Type de vue',
    budgetPeriodWindow: 'Fenêtre de période',
    budgetStartDate: 'Date de début',
    budgetLength: 'Durée',
    budgetDataVisibility: 'Visibilité des données',
    budgetCapitalInvestmentsLabel: 'Investissements en capital',
    budgetProjects: 'Projets',
    budgetMonthsCount: '{count} mois',
    budgetYearsCount: '{count} ans',
    budgetDataSummary: 'Données : {visible} sur {total} catégories visibles',
    budgetLoadingData: 'Chargement des données budgétaires…',

    // Law 25 compliance dashboard component
    law25ComplianceStatusTitle: 'Statut de conformité à la Loi 25 du Québec',
    complianceStatusExcellent: 'Excellent',
    complianceStatusGood: 'Bon',
    complianceStatusFair: 'Acceptable',
    complianceStatusPoor: 'Faible',
    totalViolations: 'Violations totales',
    criticalViolationsLabel: 'Critique',
    lastScan: 'Dernière analyse',
    categoryDataCollection: 'Collecte de données',
    categoryConsentManagement: 'Gestion du consentement',
    categoryDataRetention: 'Conservation des données',
    categorySecurityEncryption: 'Sécurité et chiffrement',
    categoryCrossBorderTransfer: 'Transfert transfrontalier',
    categoryDataSubjectRights: 'Droits des personnes concernées',
    compliantStatusLabel: 'Conforme',
    issuesFoundSingular: '{count} problème trouvé',
    issuesFoundPlural: '{count} problèmes trouvés',
    complianceViolations: 'Violations de conformité',
    moreViolationsLabel: '+{count} violations supplémentaires',
    law25ComplianceGuide: 'Guide de conformité à la Loi 25 du Québec',
    requiredComplianceAreas: 'Exigences de conformité',
    requiredAreaExplicitConsent: 'Consentement explicite pour la collecte de données',
    requiredAreaDataRetention: 'Politiques de conservation des données',
    requiredAreaEncryption: 'Chiffrement des renseignements personnels',
    requiredAreaDataSubjectRights: 'Mise en œuvre des droits des personnes concernées',
    propertyManagementFocus: 'Axes propres à la gestion immobilière',
    propMgmtTenantInfoProtection: 'Protection des renseignements personnels des locataires',
    propMgmtFinancialDataSecurity: 'Sécurité des données financières',
    propMgmtBuildingAccessProtection: "Protection des codes d'accès aux immeubles",
    propMgmtMaintenancePrivacy: "Confidentialité des demandes d'entretien",

    // Compliance page header
    compliancePageTitle: 'Conformité à la Loi 25 du Québec',
    compliancePageSubtitle: 'Surveillance de la conformité en matière de confidentialité et suivi des violations',

    // HOC titles
    buildingsManagementTitle: 'Gestion des immeubles',
    projectsManagementTitle: 'Gestion des projets',
    inventoryManagementTitle: 'Gestion de l\'inventaire',

    // Buildings page extras
    buildingsLoadDataError:
      'Échec du chargement des données des immeubles. Veuillez réessayer plus tard.',
    deleteBuildingDialogTitle: 'Supprimer l\'immeuble',
    deleteBuildingDialogConfirmation:
      'Êtes-vous sûr de vouloir supprimer « {name} » ? Cette action est irréversible.',

    // Budget chart empty state
    budgetChartNoData: 'Aucune donnée disponible pour les filtres sélectionnés',
    budgetChartAdjustFilters: 'Essayez d\'ajuster vos paramètres de filtre',
    // Project workflow status names
    projectStatusPlanned: 'Planifié',
    projectStatusEvaluation: 'Évaluation',
    projectStatusSubmissionStage: 'Soumission',
    projectStatusPreWorkStage: 'Pré-travaux',
    projectStatusInProgressStage: 'En cours',
    projectStatusPostWorkStage: 'Post-travaux',
    projectStatusCompletedStage: 'Terminé',
    projectStatusPlannedDesc: 'Le projet est en phase de planification',
    projectStatusEvaluationDesc: 'En cours d\'évaluation',
    projectStatusSubmissionDesc: 'Soumis pour approbation',
    projectStatusPreWorkDesc: 'Préparation des travaux',
    projectStatusInProgressDesc: 'Travaux en cours',
    projectStatusPostWorkDesc: 'Travaux terminés, phase de nettoyage',
    projectStatusCompletedDesc: 'Projet terminé',
    // ProjectForm modal labels and copy
    projectFormCreateNewTitle: 'Créer un nouveau projet',
    projectFormCreateFromSuggestionTitle: 'Créer un projet à partir d\'une suggestion',
    projectFormEditTitle: 'Modifier le projet',
    projectFormCreateDescription: 'Créez un nouveau projet d\'entretien pour suivre les travaux et gérer les ressources.',
    projectFormEditDescription: 'Mettez à jour les détails et la configuration du projet.',
    projectFormSubmitCreate: 'Créer le projet',
    projectFormSubmitUpdate: 'Mettre à jour le projet',
    projectFormCreatingFromSuggestionTitle: 'Création à partir d\'une suggestion d\'évaluation',
    projectFormCreatingFromSuggestionDesc: 'Ce projet est créé à partir d\'une suggestion d\'évaluation. Certains champs ont été préremplis pour vous.',
    projectFormQuickProjectDesc: 'Créer un projet simplifié avec uniquement les champs essentiels (Titre, Description, Budget, Année financière, Date)',
    projectFormTitleLabel: 'Titre',
    projectFormTitlePlaceholder: 'p. ex., Réparation de toiture - Bâtiment A',
    projectFormTitleDesc: 'Nom clair et descriptif du projet',
    projectFormDescriptionLabel: 'Description',
    projectFormOptional: '(Optionnel)',
    projectFormDescriptionPlaceholderQuick: 'Brève description du projet...',
    projectFormDescriptionDescQuick: 'Description détaillée optionnelle',
    projectFormBudgetLabel: 'Budget',
    projectFormBudgetDescQuick: 'Budget du projet en dollars',
    projectFormFinancialYearLabel: 'Année financière',
    projectFormFinancialYearDescQuick: 'Année d\'attribution du budget',
    projectFormFinancialYearDescStandard: 'Année à laquelle ce projet est imputé dans les prévisions budgétaires et les rapports.',
    projectFormProjectDateLabel: 'Date du projet',
    projectFormProjectDateDesc: 'Date d\'achèvement cible du projet',
    projectFormProjectNumberLabel: 'Numéro de projet',
    projectFormProjectNumberPlaceholder: 'p. ex., 2024-001',
    projectFormProjectNumberDesc: 'Identifiant unique pour ce projet',
    projectFormProjectTitleLabel: 'Titre du projet',
    projectFormDescriptionPlaceholderStandard: 'Description détaillée de la portée et des objectifs du projet...',
    projectFormDescriptionDescStandard: 'Description détaillée optionnelle du projet',
    projectFormPlannedStartDateLabel: 'Date de début prévue',
    projectFormPlannedStartDateDesc: 'Quand le projet doit-il commencer?',
    projectFormTotalBudgetLabel: 'Budget total',
    projectFormTotalBudgetDesc: 'Budget total alloué pour ce projet',
    projectFormActualCostLabel: 'Coût réel',
    projectFormActualCostDesc: 'Coût réel actuellement dépensé pour ce projet',
    projectFormToastBuildingIdRequired: 'L\'identifiant du bâtiment est requis mais non disponible. Veuillez actualiser la page et réessayer.',
    projectFormToastPermissionDenied: 'Permission refusée',
    projectFormToastNoCreatePermission: 'Vous n\'avez pas la permission de créer des projets.',
    projectFormToastNoEditPermission: 'Vous n\'avez pas la permission de modifier des projets.',
    projectFormToastCreatedTitle: 'Projet créé',
    projectFormToastUpdatedTitle: 'Projet mis à jour',
    projectFormToastCreatedDesc: 'Le projet « {title} » a été créé avec succès.',
    projectFormToastUpdatedDesc: 'Le projet « {title} » a été mis à jour avec succès.',
    projectFormToastCreationFailed: 'Échec de la création',
    projectFormToastUpdateFailed: 'Échec de la mise à jour',
    projectFormToastErrorOccurred: 'Une erreur est survenue',
    // StatusStepper copy
    statusStepperLabel: 'Statut du projet',
    statusStepperPercentComplete: '% terminé',
    statusStepperClickToAdvance: 'Cliquez pour avancer',
    statusStepperLastUpdated: 'Dernière mise à jour :',
    statusStepperToastUpdatedTitle: 'Statut mis à jour',
    statusStepperToastUpdatedDesc: 'Le statut du projet a été mis à jour à {status}.',
    statusStepperToastUpdateFailed: 'Échec de la mise à jour',
    statusStepperToastUpdateFailedDesc: 'Impossible de mettre à jour le statut',
    statusStepperToastPermissionDenied: 'Vous n\'avez pas la permission de mettre à jour le statut du projet.',
    statusStepperConfirmTitle: 'Confirmer le changement de statut',
    statusStepperConfirmDesc: 'Êtes-vous sûr de vouloir changer le statut du projet à {status} ?',
    statusStepperConfirmCompletedNote: 'Cela marquera le projet comme entièrement terminé.',
    statusStepperUpdating: 'Mise à jour…',
    statusStepperConfirm: 'Confirmer',
    statusStepperAdvanceTo: 'Avancer à',
    statusStepperReturnTo: 'Revenir à',
    // Workflow tabs
    plannedTabCurrentStatus: 'Statut actuel :',
    plannedTabNoBuildingElementsAvailable: 'Aucun élément du bâtiment disponible. Vous devrez peut-être ajouter d\'abord des éléments à ce bâtiment.',
    plannedTabBuildingElementsLoading: 'Chargement…',
    plannedTabBuildingElementsNotFound: 'Aucun élément du bâtiment trouvé',
    plannedTabCreateNewElement: '+ Créer un nouvel élément',
    plannedTabElementCreatedSuccessTitle: 'Élément créé',
    plannedTabElementCreatedSuccessDesc: 'Le nouvel élément a été ajouté et sélectionné pour ce projet.',
    reopenStepTrigger: 'Rouvrir l\'étape',
    reopenStepDialogTitle: 'Rouvrir une étape du flux',
    reopenStepDialogDescription: 'Sélectionnez la phase précédente à rouvrir. Votre progression dans les phases ultérieures sera préservée.',
    reopenStepStatusPlanning: 'Planification',
    reopenStepStatusVendorSubmission: 'Soumission du fournisseur',
    reopenStepStatusPreWork: 'Pré-travaux',
    reopenStepStatusInProgress: 'En cours',
    reopenStepStatusPostWork: 'Post-travaux',
    reopenStepStatusCompleted: 'Terminé',
    reopenStepSelectTargetTitle: 'Veuillez sélectionner une cible',
    reopenStepSelectTargetDesc: 'Vous devez sélectionner la phase à rouvrir.',
    reopenStepLoadTargetsFailed: 'Échec du chargement des cibles disponibles. Veuillez réessayer.',
    reopenStepNoTargetsAvailable: 'Aucune phase précédente disponible à rouvrir. Le projet doit avoir terminé au moins une phase pour utiliser cette fonctionnalité.',
    reopenStepTargetPhaseLabel: 'Phase cible',
    reopenStepLoadingPhasesPlaceholder: 'Chargement des phases…',
    reopenStepSelectPhasePlaceholder: 'Sélectionnez une phase à rouvrir',
    reopenStepReasonLabel: 'Raison (optionnelle)',
    reopenStepReasonPlaceholder: 'Expliquez pourquoi vous rouvrez cette étape…',
    reopenStepNoteLabel: 'Note :',
    reopenStepNoteBody: 'La réouverture à {phase} préservera votre progression dans les phases ultérieures. Vous pouvez reprendre là où vous vous êtes arrêté.',
    reopenStepReopening: 'Réouverture en cours…',
    reopenStepReopenToPhase: 'Rouvrir à la phase',
    reopenStepSuccessTitle: 'Étape rouverte',
    reopenStepSuccessDesc: 'Réouverture réussie à la phase {phase}.',
    reopenStepFailedTitle: 'Échec de la réouverture',
    reopenStepFailedDesc: 'Une erreur est survenue en tentant de rouvrir l\'étape.',
    cannotReopenStepTitle: 'Impossible de rouvrir',
    failedToReopenStepTitle: 'Échec de la réouverture',
    reopenStepWorkflowDataUnavailableDesc: 'Les données du flux de travail ne sont pas disponibles. Veuillez actualiser la page et réessayer.',
    reopenStepWrongPhaseSubmissionDesc: 'Cette étape ne peut être rouverte que lorsque le projet est actuellement à la phase de soumission.',
    reopenStepWrongPhasePostWorkDesc: 'Cette étape ne peut être rouverte que lorsque le projet est actuellement à la phase post-travaux.',
    reopenStepReturnedSuccessDesc: 'Retour à l\'étape précédente du flux de travail réussi.',
    plannedTabHeader: 'Planification du projet',
    plannedTabSubheader: 'Définissez la description du projet, l\'échéancier de planification et le coût estimé',
    plannedTabDescriptionLabel: 'Description',
    plannedTabDescriptionPlaceholder: 'Décrivez les travaux d\'entretien nécessaires, y compris la portée, les zones précises et toute exigence particulière…',
    plannedTabDescriptionHelp: 'Fournissez une description détaillée des travaux d\'entretien planifiés',
    plannedTabStartDateLabel: 'Date de début de la planification',
    plannedTabStartDateHelp: 'Quand prévoyez-vous commencer à travailler sur ce projet ?',
    plannedTabEstimatedCostLabel: 'Coût estimé',
    plannedTabEstimatedCostHelp: 'Coût total estimé pour ce projet en dollars',
    plannedTabFinancialYearLabel: 'Année financière',
    plannedTabFinancialYearHelp: 'L\'année financière pour l\'affectation budgétaire. Les coûts seront alloués au mois le plus proche de cette année.',
    plannedTabBuildingElementsPlaceholder: 'Sélectionnez les éléments du bâtiment pour ce projet',
    plannedTabBuildingElementsLoadingPlaceholder: 'Chargement des éléments…',
    plannedTabBuildingElementsSearchPlaceholder: 'Rechercher par nom, code ou état…',
    plannedTabBuildingElementsHelp: 'Sélectionnez les éléments du bâtiment qui seront concernés par ce projet d\'entretien.',
    plannedTabSuccessTitle: 'Succès',
    plannedTabSuccessDesc: 'Planification du projet terminée et passée à l\'étape de soumission.',
    plannedTabWarningTitle: 'Avertissement',
    plannedTabElementsUpdateWarningDesc: 'Le projet a été enregistré, mais une erreur est survenue lors de la mise à jour des éléments sélectionnés.',
    workflowNextLabel: 'Suivant :',
    workflowSavingButton: 'Enregistrement…',
    workflowSaveChangesButton: 'Enregistrer les modifications',
    workflowCompletingButton: 'Finalisation…',
    workflowCompletePlanningPhaseButton: 'Terminer la phase de planification',
    workflowAllTasksCompleted: 'Toutes les tâches sont terminées !',
    workflowErrorTitle: 'Erreur',
    workflowSuccessTitle: 'Succès',
    postWorkProjectDataMissing: 'Les données du projet sont manquantes. Impossible de charger l\'onglet post-travaux.',
    postWorkFailedUpdateConfirmation: 'Échec de la mise à jour de la confirmation de l\'élément',
    postWorkAllElementsConfirmedDesc: 'Tous les éléments ont été confirmés avec succès',
    postWorkFailedConfirmAll: 'Échec de la confirmation de tous les éléments',
    postWorkAllChangesSavedDesc: 'Toutes les modifications ont été enregistrées avec succès',
    postWorkFailedSaveSomeChanges: 'Échec de l\'enregistrement de certaines modifications',
    postWorkFailedApplyInventoryChangesDesc: 'Échec de l\'application des modifications de l\'inventaire. Veuillez réessayer.',
    postWorkCompletionFailedTitle: 'Échec de la finalisation',
    postWorkFailedMarkCompleteDesc: 'Échec de la finalisation du projet. Veuillez réessayer.',
    postWorkUnexpectedErrorDesc: 'Une erreur inattendue est survenue. Veuillez réessayer.',
    postWorkActivitiesHeader: 'Activités post-travaux',
    postWorkActivitiesSubheader: 'Gérer les tâches de nettoyage, de finalisation et de clôture du projet',
    postWorkSkippableInfo: 'Cette étape peut être ignorée dans la navigation par onglets',
    autoGeneratedProjectTitle: 'Projet généré automatiquement',
    autoGeneratedProjectDesc: 'Ce projet a été généré automatiquement et peut comporter des champs et des tâches préremplis selon l\'analyse du système. Vous pouvez modifier toutes les informations selon vos besoins.',
    postWorkTasksTitle: 'Tâches post-travaux',
    postWorkTasksDesc: 'Tâches de nettoyage, de finalisation et de clôture pour terminer le projet',
    postWorkCompletedCounter: 'terminées',
    postWorkAddTaskButton: 'Ajouter une tâche',
    postWorkNoTasksDefined: 'Aucune tâche post-travaux définie',
    postWorkAddCleanupTasksHint: 'Ajoutez des tâches de nettoyage et de finalisation',
    postWorkTaskDescriptionPlaceholder: 'Description de la tâche (obligatoire)',
    postWorkTaskDoneLabel: 'Terminée',
    postWorkTaskPendingLabel: 'En attente',
    postWorkElementLifespanImpactTitle: 'Impact sur la durée de vie des éléments',
    postWorkElementLifespanImpactDesc: 'Examinez et confirmez l\'impact des interventions sur la durée de vie de chaque élément du projet',
    postWorkConfirmedCounter: 'confirmés',
    postWorkConfirmAllButton: 'Tout confirmer',
    postWorkNoElementsLinked: 'Aucun élément lié à ce projet',
    postWorkElementsMustBeAddedDuringPlanning: 'Les éléments doivent être ajoutés durant la phase de planification',
    postWorkUnknownElement: 'Élément inconnu',
    postWorkNoCode: 'Aucun code',
    postWorkPlannedWork: 'Travaux planifiés : {description}',
    postWorkConfirmedBadge: 'Confirmé',
    postWorkInterventionTypeLabel: 'Type d\'intervention',
    postWorkSelectInterventionTypePlaceholder: 'Sélectionnez le type d\'intervention',
    postWorkInterventionNoWork: 'Aucun travail',
    postWorkInterventionRepair: 'Réparation',
    postWorkInterventionMinorRehab: 'Réfection mineure',
    postWorkInterventionMajorRehab: 'Réfection majeure',
    postWorkInterventionReplacement: 'Remplacement',
    postWorkSuggestedStandardLifespanLabel: 'Durée de vie standard suggérée',
    postWorkYearsCount: '{count} années',
    postWorkYearsUnit: 'années',
    postWorkUniformatStandardLifespanHelp: 'Durée de vie standard UNIFORMAT pour ce type d\'élément',
    postWorkRemainingLifespanBeforeLabel: 'Durée de vie restante avant',
    postWorkNotSpecified: 'Non précisé',
    postWorkUniformatStandardWithExtension: 'Standard UNIFORMAT : {standard} années • Extension suggérée : {extension} années ({percent} %)',
    postWorkLifespanImpactYearsLabel: 'Impact sur la durée de vie (années)',
    postWorkSuggestedValue: 'Suggéré : {value}',
    postWorkYearsAddedToRemainingLifespan: 'Années ajoutées à la durée de vie restante',
    postWorkImpactSummaryLabel: 'Résumé de l\'impact :',
    postWorkThisWorkWill: 'Ces travaux vont',
    postWorkSetLifespanToYearsTemplate: 'fixer la durée de vie de l\'élément à {years} année(s) à partir de la date des travaux',
    postWorkAddYearsToLifespanTemplate: 'ajouter {years} année(s) à la durée de vie restante de l\'élément',
    postWorkNotChangeRemainingLifespan: 'ne pas modifier la durée de vie restante',
    postWorkElementConfirmationsLabel: 'Confirmations des éléments',
    postWorkAllElementsConfirmed: 'Tous les éléments sont confirmés !',
    postWorkProgressSummaryTitle: 'Résumé de la progression',
    postWorkTasksCompletedLabel: 'Tâches terminées',
    postWorkMarkProjectCompleteButton: 'Marquer le projet comme terminé',
    postWorkCompleteAllTasksToProceed: 'Terminez toutes les tâches pour continuer',
    postWorkConfirmAllElementsToProceed: 'Confirmez tous les impacts sur la durée de vie des éléments pour continuer',
    postWorkConfirmProjectCompletionTitle: 'Confirmer la finalisation du projet',
    postWorkConfirmProjectCompletionDesc: 'La finalisation de ce projet appliquera des modifications à votre inventaire des éléments du bâtiment.',
    postWorkFollowingChangesWillBeApplied: 'Les modifications suivantes seront appliquées à votre inventaire des éléments du bâtiment :',
    postWorkWillBeMarkedAsReplaced: 'Sera marqué comme remplacé avec une nouvelle date de construction',
    postWorkNewLifespanLine: 'Nouvelle durée de vie : {years} années',
    postWorkCurrentLifespanWillBeExtendedBy: 'La durée de vie actuelle sera prolongée de {years} années',
    postWorkInterventionTypeLine: 'Type d\'intervention : {type}',
    postWorkNoChangesWillBeApplied: 'Aucune modification ne sera appliquée',
    postWorkTheseChangesCannotBeUndone: 'Ces modifications ne peuvent pas être annulées. Êtes-vous sûr de vouloir terminer ce projet ?',
    postWorkConfirmAndCompleteProjectButton: 'Confirmer et terminer le projet',
    postWorkCompletingButton: 'Finalisation…',
    submissionProjectDataMissing: 'Les données du projet sont manquantes. Impossible de charger l\'onglet de soumission.',
    submissionUploadInProgressTitle: 'Téléversement en cours',
    submissionUploadInProgressSaveDesc: 'Veuillez attendre la fin du téléversement des documents avant d\'enregistrer.',
    submissionUploadInProgressSubmitDesc: 'Veuillez attendre la fin du téléversement des documents avant de soumettre.',
    submissionUploadFailedTitle: 'Échec du téléversement',
    submissionUploadFailedDescTemplate: 'Impossible de téléverser {fileName}. Veuillez réessayer.',
    submissionManagementHeader: 'Gestion des soumissions',
    submissionManagementSubheader: 'Gérer les soumissions des fournisseurs et les éléments du projet',
    submissionVendorSubmissionsHeader: 'Soumissions des fournisseurs',
    submissionVendorSubmissionsSubheader: 'Examinez et sélectionnez les propositions et devis des fournisseurs',
    submissionElementManagementTab: 'Gestion des éléments',
    submissionAddSubmissionButton: 'Ajouter une soumission',
    submissionVendorSubmittedDate: 'Soumis le',
    submissionEditButton: 'Modifier',
    submissionDeleteButton: 'Supprimer',
    submissionPreferredBadge: 'Privilégié',
    submissionDeleteVendorConfirmTitle: 'Supprimer la soumission du fournisseur',
    submissionDeleteVendorConfirmDesc: 'Êtes-vous sûr de vouloir supprimer cette soumission de fournisseur ? Cette action ne peut pas être annulée.',
    submissionEditVendorTitle: 'Modifier la soumission du fournisseur',
    submissionAddSubmissionDescriptionSr: 'Créer une nouvelle soumission de fournisseur avec un plan de paiement et des pièces jointes',
    submissionEditDialogDescription: 'Mettre à jour les détails de la soumission du fournisseur, le plan de paiement et les pièces jointes',
    submissionAddNewVendorTitle: 'Ajouter une nouvelle soumission de fournisseur',
    submissionVendorNameLabel: 'Nom du fournisseur *',
    submissionVendorNamePlaceholder: 'Saisissez le nom du fournisseur',
    submissionAvailableDateLabel: 'Date de disponibilité',
    submissionDescriptionLabel: 'Description',
    submissionDescriptionPlaceholder: 'Décrivez la proposition du fournisseur…',
    submissionPaymentPlanHeader: 'Plan de paiement',
    submissionPaymentTypeLabel: 'Type de paiement',
    submissionSelectPaymentTypePlaceholder: 'Sélectionnez le type de paiement',
    submissionPaymentTypeOneTime: 'Paiement unique',
    submissionPaymentTypeRecurring: 'Paiements récurrents',
    submissionTotalAmountLabel: 'Montant total',
    submissionPaymentDateLabel: 'Date du paiement',
    submissionPaymentScheduleLabel: 'Calendrier de paiement',
    submissionSelectPaymentSchedulePlaceholder: 'Sélectionnez le calendrier de paiement',
    submissionScheduleWeekly: 'Hebdomadaire',
    submissionScheduleMonthly: 'Mensuel',
    submissionScheduleQuarterly: 'Trimestriel',
    submissionScheduleYearly: 'Annuel',
    submissionScheduleCustom: 'Calendrier personnalisé',
    submissionDateFirstPaymentLabel: 'Date du premier paiement',
    submissionDateEndPaymentLabel: 'Date du dernier paiement',
    submissionHasInitialPaymentLabel: 'Possède un paiement initial',
    submissionInitialPaymentAmountLabel: 'Montant du paiement initial',
    submissionEqualRecurringLabel: 'Paiements récurrents égaux',
    submissionRecurringPaymentAmountLabel: 'Montant du paiement récurrent',
    submissionCustomPaymentAmountsLabel: 'Montants de paiement personnalisés',
    submissionCustomPaymentAmountSubLabel: 'Montant',
    submissionCustomPaymentDateSubLabel: 'Date',
    submissionCustomPaymentDescriptionSubLabel: 'Description (facultative)',
    submissionCustomPaymentDescriptionPlaceholder: 'Description du paiement',
    submissionMarkAsPreferredLabel: 'Marquer comme privilégié',
    submissionMarkAsPreferredVendorLabel: 'Marquer comme fournisseur privilégié',
    submissionNoVendorSubmissionsHeader: 'Aucune soumission de fournisseur pour l\'instant',
    submissionProposalDetailsHeader: 'Détails de la proposition',
    submissionNoDescriptionProvided: 'Aucune description fournie',
    submissionPaymentBreakdownLabel: 'Détail des paiements :',
    submissionContactInformationHeader: 'Coordonnées',
    submissionVendorNameLabelEdit: 'Nom du fournisseur',
    submissionContactInformationLabel: 'Coordonnées',
    submissionContactInformationPlaceholder: 'Saisissez les coordonnées',
    submissionDescriptionPlaceholderEdit: 'Saisissez une description ou des notes',
    submissionAddPaymentButton: 'Ajouter un paiement',
    submissionPaymentTypeDescription: 'Choisissez s\'il s\'agit d\'un paiement unique ou de paiements multiples dans le temps',
    submissionTotalAmountDescription: 'Saisissez le montant total de ce paiement unique',
    submissionPaymentDateDescription: 'La date à laquelle ce paiement est dû',
    submissionHasInitialPaymentDescription: 'Cochez si un montant de paiement initial différent s\'applique',
    submissionEqualRecurringDescription: 'Cochez si tous les paiements récurrents sont du même montant',
    submissionMarkAsPreferredDescription: 'Désigner ce fournisseur comme choix privilégié',
    submissionCancelButton: 'Annuler',
    submissionAddingButton: 'Ajout en cours...',
    submissionFailedToLoadVendors: 'Échec du chargement des soumissions des fournisseurs',
    submissionContactAvailable: 'Coordonnées disponibles',
    submissionAvailableLabel: 'Disponible',
    submissionUnmarkPreferredButton: 'Retirer le statut privilégié',
    submissionMarkAsPreferredButton: 'Marquer comme privilégié',
    submissionAvailableForWorkLabel: 'Disponible pour les travaux',
    submissionExtendsLifespanTemplate: 'Prolonge la durée de vie : {years} ans',
    submissionDocumentsSubmittedTemplate_one: '{count} document soumis',
    submissionDocumentsSubmittedTemplate_other: '{count} documents soumis',
    submissionPaymentScheduleSummaryTemplate: 'Calendrier : {schedule}',
    submissionPaymentStartsTemplate: 'Début : {date}',
    submissionPaymentItemTemplate: 'Paiement {index} : {amount}',
    submissionNoPaymentPlanConfigured: 'Aucun plan de paiement configuré pour le moment',
    submissionEditPaymentPlanTitleTemplate: 'Modifier le plan de paiement - {vendor}',
    submissionEditPaymentPlanDescription: 'Configurez le calendrier de paiement, les coûts et le calendrier pour cette soumission de fournisseur',
    submissionNoSubmissionsYetTitle: 'Aucune soumission pour l\'instant',
    submissionNoSubmissionsYetDescription: 'Aucune soumission de fournisseur n\'a été reçue pour ce projet',
    submissionNoVendorSubmissionsYetMessage: 'Ajoutez des soumissions de fournisseurs avec leurs devis, disponibilités et documents de proposition.',
    submissionPreferredCountTemplate: '{count} privilégié(s)',
    submissionUpdatingButton: 'Mise à jour...',
    submissionSaveChangesButton: 'Enregistrer les modifications',
    submissionEditVendorTitleTemplate: 'Modifier le fournisseur - {vendor}',
    submissionEditVendorDialogDescription: 'Modifier les renseignements du fournisseur, les documents et les préférences pour cette soumission',
    submissionDocumentsTitle: 'Documents',
    submissionMarkAsPreferredEditDescription: 'Marquer ce fournisseur comme privilégié pour ce projet',
    submissionDeleteVendorButton: 'Supprimer le fournisseur',
    submissionCompletingButton: 'Finalisation...',
    submissionCompleteSubmissionPhaseButton: 'Terminer la phase de soumission',
    submissionDocumentsOptionalTitle: 'Documents (facultatif)',
    workflowStepCanBeSkipped: 'Cette étape peut être ignorée dans la navigation par onglets',
    workflowAutoGeneratedProjectTitle: 'Projet généré automatiquement',
    workflowFailedToSavePhaseDescription: 'Échec de l\'enregistrement des modifications avant de terminer la phase',
    workflowPleaseWaitTitle: 'Veuillez patienter',
    workflowSavingTaskChangesDescription: 'Enregistrement des modifications en cours. Veuillez réessayer dans un instant.',
    preWorkPreparationHeader: 'Préparation avant les travaux',
    preWorkNoTasksDefined: 'Aucune tâche de préparation définie',
    preWorkAddTasksHelper: 'Ajoutez les tâches à compléter avant le début des travaux',
    inProgressHeader: 'Travaux en cours',
    inProgressNoWorkTasksDefined: 'Aucune tâche de travail définie',
    inProgressAddTasksHelper: 'Ajoutez des tâches pour suivre l\'avancement des travaux',
    workflowProgressSummaryTitle: 'Résumé de l\'avancement',
    workflowTasksCompletedLabel: 'Tâches complétées',
    preWorkSetupTasksSubheader: 'Configurez les tâches de préparation et les notifications aux utilisateurs',
    preWorkPreparationTasksTitle: 'Tâches de préparation',
    preWorkPreparationTasksDescription: 'Définissez les tâches à compléter avant le début des travaux',
    preWorkAddTaskButton: 'Ajouter une tâche',
    preWorkTaskDescriptionPlaceholder: 'Description de la tâche (obligatoire)',
    preWorkTaskDoneBadge: 'Terminé',
    preWorkTaskPendingBadge: 'En attente',
    preWorkNotificationSettingsTitle: 'Paramètres de notification',
    preWorkNotificationSettingsDescription: 'Configurez les rappels automatisés qui seront envoyés à tous les utilisateurs liés à cet immeuble',
    preWorkNotificationMessageLabel: 'Message de notification',
    preWorkNotificationMessagePlaceholder: 'Saisissez le message de notification...',
    preWorkTimingLabel: 'Échéance',
    preWorkDaysBeforeLabel: 'Jours avant',
    preWorkUpdateNotificationButton: 'Mettre à jour la notification',
    preWorkAddNotificationButton: 'Ajouter une notification',
    preWorkCancelButton: 'Annuler',
    preWorkCreatedNotificationsTemplate: 'Notifications créées ({count})',
    preWorkSentBadge: 'Envoyée',
    preWorkPendingBadge: 'En attente',
    preWorkCustomDaysBeforeTemplate: '{days} jours avant',
    preWorkCompletingButton: 'Finalisation...',
    preWorkCompletePhaseButton: 'Terminer la phase de préparation',
    preWorkTimingOneDayBefore: '1 jour avant',
    preWorkTimingThreeDaysBefore: '3 jours avant',
    preWorkTimingOneWeekBefore: '1 semaine avant',
    preWorkTimingCustom: 'Personnalisé',
    inProgressSubheader: 'Gérez l\'exécution active des travaux et suivez l\'avancement',
    inProgressWorkTasksTitle: 'Tâches de travail',
    inProgressWorkTasksDescription: 'Définissez les rappels de tâches à effectuer par le gestionnaire pendant les travaux',
    inProgressTaskCountTemplate: '{completed} / {total} terminées',
    inProgressAddTaskButton: 'Ajouter une tâche',
    inProgressTaskDescriptionPlaceholder: 'Description de la tâche (obligatoire)',
    inProgressMarkWorkCompleteButton: 'Marquer les travaux comme terminés',
    preWorkNewTaskDefault: 'Nouvelle tâche',
    inProgressNewWorkTaskDefault: 'Nouvelle tâche de travail',

    // Settings - delete account & data export
    downloadYourData: 'Télécharger vos données',
    downloadYourDataDescription:
      "Exportez toutes vos données personnelles, y compris vos informations de profil, vos factures, vos documents et votre historique d'activité.",
    deleteYourAccount: 'Supprimer votre compte',
    deleteYourAccountWarning:
      'Supprimez définitivement votre compte et toutes les données associées. Cette action est irréversible.',

    // Maintenance projects page
    backToBuildingArrow: '← Retour au bâtiment',
    searchProjects: 'Rechercher des projets',
    searchByNamePlaceholder: 'Rechercher par nom...',
    overdueOnly: 'En retard seulement',
    projectName: 'Nom du projet',
    startDate: 'Date de début',
    paginationShowingResults: 'Affichage de {start} à {end} sur {total} résultat(s)',
    noProjectsFoundTitle: 'Aucun projet trouvé',
    noProjectsForBuilding: 'Aucun projet d\'entretien n\'a été créé pour ce bâtiment.',
    profileSettings: 'Paramètres du profil',
    failedToLoadProjects: 'Échec du chargement des projets',
    errorLoadingProjects: 'Une erreur s\'est produite lors du chargement des projets. Veuillez réessayer.',
    deleteAccountPermanently: 'Supprimer le compte définitivement',
    deleteAccountIntro: 'Cela supprimera définitivement votre compte et toutes les données associées, y compris :',
    deleteAccountItemProfile: 'Vos informations de profil',
    deleteAccountItemDocuments: 'Tous les documents et fichiers',
    deleteAccountItemBills: 'Historique des factures et paiements',
    deleteAccountItemMaintenance: 'Demandes d\'entretien',
    deleteAccountItemOther: 'Toutes les autres données personnelles',
    deleteAccountIrreversible: 'Cette action ne peut pas être annulée.',
    confirmEmailToProceed: 'Confirmez votre courriel pour continuer',
    reasonForDeletionOptional: 'Raison de la suppression (facultatif)',
    reasonForDeletionPlaceholder: 'Dites-nous pourquoi vous supprimez votre compte...',
    // i18n migration (task 691): FR strings for previously-untranslated JSX text.
    chooseABuildingToViewAnd: 'Choisissez un immeuble pour consulter et gérer ses factures',
    creatingThisBillWillAutomaticallyUpdate: 'La création de cette facture mettra automatiquement à jour la date de fin de la facture source afin d\'éviter le double compte dans les calculs budgétaires.',
    createBillFromAutoGeneratedTemplate: 'Créer une facture à partir du modèle généré automatiquement',
    clickAddPaymentToGetStarted: 'Cliquez sur « Ajouter un paiement » pour commencer',
    thisMayTakeAFewSeconds: 'Cela peut prendre quelques secondes selon la complexité du document.',
    extractingDataFromYourDocument: 'Extraction des données de votre document...',
    useTheUploadSectionAboveTo: 'Utilisez la section de téléversement ci-dessus pour joindre des fichiers',
    formFieldsHaveBeenAutomaticallyPopulated: 'Les champs du formulaire ont été remplis automatiquement avec les données extraites.',
    aiIsAnalyzingYourDocument: 'L\'IA analyse votre document...',
    historicalPerformanceDataAndImprovements: 'Données de performance historiques et améliorations',
    priorityOrderedOptimizationSuggestions: 'Suggestions d\'optimisation classées par priorité',
    componentOptimizationRecommendations: 'Recommandations d\'optimisation des composants',
    mostCommonOptimizationOpportunities: 'Opportunités d\'optimisation les plus fréquentes',
    identificationOfPerformanceBottlenecks: 'Identification des goulots d\'étranglement de performance',
    realTimeServerMetricsAndStatus: 'Métriques et statut du serveur en temps réel',
    queryExecutionMetricsAndOptimizationStatus: 'Métriques d\'exécution des requêtes et statut d\'optimisation',
    currentPerformanceMetricsBreakdown: 'Répartition actuelle des métriques de performance',
    realTimeWebVitalsPerformanceTracking: 'Suivi en temps réel des performances Web Vitals',
    realTimeMonitoringAndOptimizationInsights: 'Surveillance en temps réel et analyses d\'optimisation',
    priorityDistributionRecommendations: 'Distribution des priorités et recommandations',
    basedOnCurrentVelocityExpect15: 'Selon la vélocité actuelle, prévoyez une amélioration de 15 % de l\'efficacité globale la semaine prochaine.',
    documentationCategoryNeedsFocusOnly45: 'La catégorie documentation nécessite de l\'attention - taux de complétion de seulement 45 % détecté.',
    securitySuggestionsShow92CompletionRate: 'Les suggestions de sécurité affichent un taux de complétion de 92 % - catégorie la plus performante cette semaine.',
    noInsightsAvailableRunAnAi: 'Aucune analyse disponible. Lancez une analyse IA pour générer des recommandations.',
    continuousImprovementRecommendationsFromAiAnalysis: 'Recommandations d\'amélioration continue issues de l\'analyse IA',
    noRecentInteractionsRecorded: 'Aucune interaction récente enregistrée',
    realTimeLogOfAiAgent: 'Journal en temps réel des activités et améliorations de l\'agent IA',
    realTimeMonitoringOfReplitAi: 'Surveillance en temps réel de l\'efficacité de l\'agent Replit AI',
    trackAiInteractionsAndContinuousImprovement: 'Suivez les interactions IA et les suggestions d\'amélioration continue',
    deletedItemsAreSoftDeletedAnd: 'Les éléments supprimés sont en suppression logique et peuvent être récupérés par les administrateurs système.',
    unableToAnalyzeDeletionImpactProceed: 'Impossible d\'analyser l\'impact de la suppression. Procédez avec prudence.',
    noRelatedEntitiesWillBeAffected: 'Aucune entité liée ne sera affectée.',
    willCascadeAndRemoveAllRelated: 'entraînera la suppression en cascade de toutes les données liées.',
    thisActionCannotBeUndoneDeleting: 'Cette action est irréversible. Suppression de ce',
    thisActionCannotBeUndonePlease: 'Cette action est irréversible. Veuillez examiner l\'impact avant de continuer.',
    changesAreAutomaticallySavedAfterYou: '✨ Les modifications sont enregistrées automatiquement après que vous arrêtez de taper',
    createATextOnlyDocumentEntry: 'Créez une entrée de document texte uniquement. Vous pourrez ajouter le formatage et des détails supplémentaires plus tard.',
    selectHowYouDLikeTo: 'Choisissez comment vous souhaitez ajouter votre fichier',
    aiAnalysisWillExtractKeyInformation: '✨ L\'analyse IA extraira automatiquement les informations clés',
    onDesktopDragDropClickTo: '💻 Sur ordinateur : glissez-déposez, cliquez pour parcourir, ou collez des captures d\'écran (Ctrl+V)',
    onMobileTapToUseCamera: '📱 Sur mobile : appuyez pour utiliser la caméra ou sélectionner depuis la galerie',
    dropFilesHereOrClickTo: 'Déposez les fichiers ici ou cliquez pour parcourir',
    billDocumentsTenantReadOnly: 'Documents de facture (locataire - lecture seule)',
    pleaseCorrectTheFollowingErrors: 'Veuillez corriger les erreurs suivantes :',
    generatedDevelopmentPromptFor: 'Invite de développement générée pour',
    optionalMockupsWireframesScreenshotsRequirementsDocs: '(Facultatif - maquettes, wireframes, captures d\'écran, documents d\'exigences)',
    forEachRoleSpecifyReadWrite: 'Pour chaque rôle, précisez les permissions de lecture/écriture et les limites organisationnelles.',
    enableRoleBasedAccessControlFor: 'Activer le contrôle d\'accès basé sur les rôles pour cette fonctionnalité',
    doesThisFeatureRequireRbac: 'Cette fonctionnalité nécessite-t-elle un RBAC ?',
    roleBasedAccessControlRbac: 'Contrôle d\'accès basé sur les rôles (RBAC)',
    markThisFeatureAsPartOf: 'Marquer cette fonctionnalité comme faisant partie de la feuille de route stratégique',
    markAsAStrategicDevelopmentPriority: 'Marquer comme une priorité de développement stratégique',
    saveAsAnActionableItemTo: 'Enregistrer comme élément actionnable pour suivre les progrès de mise en œuvre',
    requestSpecificImplementationDetailsOrAsk: 'Demander des détails de mise en œuvre spécifiques ou poser des questions de suivi',
    theAiWillHaveFullContext: 'L\'IA aura tout le contexte sur l\'architecture et les exigences de Koveo Gestion',
    copyThisPromptAndPasteIt: 'Copiez cette invite et collez-la dans ChatGPT, Claude ou un autre assistant IA',
    noCustomDatesAddedClickAdd: 'Aucune date personnalisée ajoutée. Cliquez sur « Ajouter une date » pour ajouter des dates de paiement.',
    extractingInvoiceDataWithAiThis: 'Extraction des données de la facture avec l\'IA... Cela peut prendre quelques secondes.',
    pleaseFixTheFollowingErrors: 'Veuillez corriger les erreurs suivantes :',
    supportedImagesPdfDocXlsTxt: 'Pris en charge : images, PDF, DOC, XLS, TXT',
    reasonForDismissalOptional: 'Raison du rejet (facultatif)',
    areYouSureYouWantTo: 'Êtes-vous sûr de vouloir rejeter ce projet généré automatiquement ? Cette action est irréversible.',
    skipVendorSubmissionsDefaultForAuto: 'Ignorer les soumissions des fournisseurs (par défaut pour les projets automatiques)',
    configureWhichWorkflowStepsShouldBe: 'Configurez quelles étapes du flux de travail doivent être ignorées pour ce projet généré automatiquement.',
    whenDidOrWillTheActual: 'Quand le travail réel a-t-il commencé ou commencera-t-il ? Laissez vide si non encore déterminé.',
    thisWillBeUsedAsThe: 'Ceci sera utilisé comme description de la planification du projet dans le flux de travail.',
    tryAdjustingYourSearchTermsOr: 'Essayez d\'ajuster vos termes de recherche ou vos filtres pour voir plus de résultats.',
    theseProjectsWereAutomaticallyGeneratedBy: 'Ces projets ont été générés automatiquement par l\'IA en fonction des évaluations des immeubles et des calendriers d\'entretien. Examinez, modifiez au besoin, puis acceptez pour les convertir en projets d\'entretien actifs.',
    aiGeneratedProjectSuggestionsWillAppear: 'Les suggestions de projets générées par l\'IA apparaîtront ici lorsqu\'elles seront disponibles. Elles sont créées automatiquement en fonction des évaluations des immeubles et des calendriers d\'entretien.',
    failedToLoadAutoGeneratedProjects: 'Échec du chargement des projets générés automatiquement. Veuillez essayer d\'actualiser.',
    loadingAutoGeneratedProjects: 'Chargement des projets générés automatiquement...',
    eachElementWillHaveAUnit: 'Chaque élément aura un coût unitaire de $',
    eachElementWillHaveAReconstruction: 'Chaque élément aura un coût de reconstruction de $',
    costPerUnitEG50: 'Coût unitaire (p. ex. 50 $ par m² pour le revêtement de sol, 200 $ par m pour les rampes)',
    totalReconstructionCostForEachElement: 'Coût total de reconstruction pour chaque élément (p. ex. 5 000 $ par fenêtre)',
    updateReconstructionCostsFor: 'Mettre à jour les coûts de reconstruction pour',
    updateResidenceAssignmentAccessTypeAnd: 'Mettre à jour l\'attribution de résidence, le type d\'accès et le type de charge pour',
    pleaseWaitWhileWeProcessYour: 'Veuillez patienter pendant le traitement de votre fichier',
    saveTheElementToEnableDocument: 'Enregistrez l\'élément pour activer le téléversement de documents',
    noDocumentsAttachedToThisAsset: 'Aucun document joint à cet actif',
    areYouSureYouWantTo2: 'Êtes-vous sûr de vouloir supprimer «',
    automaticallyCalculatedBasedOnConditionAnd: 'Calculé automatiquement en fonction de l\'état et des années restantes',
    navigateLevel1Level2Level: 'Naviguer : Niveau 1 → Niveau 2 → Niveau 3 (seul le Niveau 3 peut être sélectionné pour les éléments)',
    anyAdditionalInformationOrObservations: 'Toute information ou observation supplémentaire',
    automaticallyCalculatedBasedOnEventType: 'Calculé automatiquement en fonction du type d\'événement et du coût',
    additionalYearsAddedToElementLifespan: 'Années supplémentaires ajoutées à la durée de vie de l\'élément',
    briefDescriptionOfWarrantyCoverage: 'Brève description de la couverture de garantie',
    selectFromExistingVendorsOrEnter: 'Sélectionnez parmi les fournisseurs existants ou entrez un nom ci-dessous',
    detailedDescriptionOfTheWorkPerformed: 'Description détaillée du travail effectué',
    totalCostOfTheWorkOptional: 'Coût total du travail (facultatif)',
    startBuildingYourInventoryByAdding: 'Commencez à constituer votre inventaire en ajoutant des éléments d\'immeuble.',
    areYouSureYouWantTo3: 'Êtes-vous sûr de vouloir supprimer cette entrée d\'historique ? Cette action est irréversible et peut affecter les calculs de durée de vie de l\'élément.',
    detailedBreakdownOfCostsAndAllocations: 'Répartition détaillée des coûts et des affectations pour cette catégorie budgétaire.',
    thereWasAnErrorLoadingThe: 'Une erreur est survenue lors du chargement du budget du projet. Veuillez réessayer.',
    areYouSureYouWantTo4: 'Êtes-vous sûr de vouloir retirer cet élément du projet ? Cette action est irréversible.',
    updateCostAllocationAndWorkDetails: 'Mettre à jour l\'affectation des coûts et les détails du travail pour cet élément.',
    allAvailableElementsAreAlreadyAssigned: 'Tous les éléments disponibles sont déjà attribués à ce projet.',
    selectBuildingElementsToIncludeIn: 'Sélectionnez les éléments d\'immeuble à inclure dans ce projet et définissez optionnellement l\'affectation des coûts et les détails du travail.',
    noElementsAssignedToThisProject: 'Aucun élément attribué à ce projet pour le moment.',
    planningOnlyProjectThatCannotAdvance: 'Projet de planification uniquement qui ne peut pas avancer au-delà de la phase de planification',
    selectBuildingElementsToIncludeIn2: 'Sélectionnez les éléments d\'immeuble à inclure dans ce projet.',
    currentActualCostSpentOnThis: 'Coût réel actuel dépensé sur ce projet',
    totalAllocatedBudgetForThisProject: 'Budget total alloué à ce projet',
    whenTheProjectIsPlannedTo: 'Quand le projet est prévu de commencer',
    optionalDetailedDescriptionOfTheProject: 'Description détaillée facultative du projet',
    clearDescriptiveNameForTheProject: 'Nom clair et descriptif pour le projet',
    uniqueIdentifierForThisProject: 'Identifiant unique pour ce projet',
    targetCompletionDateForTheProject: 'Date d\'achèvement cible pour le projet',
    createASimplifiedProjectWithEssential: 'Créer un projet simplifié avec les champs essentiels uniquement (titre, description, budget, exercice financier, date)',
    thisProjectIsBeingCreatedBased: 'Ce projet est créé sur la base d\'une suggestion d\'évaluation. Certains champs ont été pré-remplis pour vous.',
    creatingFromEvaluationSuggestion: 'Création à partir d\'une suggestion d\'évaluation',
    areYouSureYouWantTo5: 'Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.',
    tryAdjustingYourFiltersOrSearch: 'Essayez d\'ajuster vos filtres ou votre requête de recherche.',
    noNotesFoundForThisProject: 'Aucune note trouvée pour ce projet.',
    thereWasAnErrorLoadingThe2: 'Une erreur est survenue lors du chargement des notes du projet. Veuillez réessayer.',
    thereWasAnErrorLoadingThe3: 'Une erreur est survenue lors du chargement des projets. Veuillez réessayer.',
    noProjectsFoundForTheSelected: 'Aucun projet trouvé pour la période sélectionnée.',
    thereWasAnErrorLoadingThe4: 'Une erreur est survenue lors du chargement de l\'échéancier du projet. Veuillez réessayer.',
    thisWillMarkTheProjectAs: 'Ceci marquera le projet comme entièrement terminé.',
    areYouSureYouWantTo6: 'Êtes-vous sûr de vouloir changer le statut du projet à',
    maintenanceApproachComparison: 'Comparaison des approches d\'entretien',
    areYouSureYouWantTo7: 'Êtes-vous sûr de vouloir rejeter cette suggestion ? Veuillez fournir une raison pour référence future.',
    basedOnCriticalOverdueItems: 'Basé sur les éléments critiques et en retard',
    giveYourFilterPresetAName: 'Donnez un nom à votre préréglage de filtre pour l\'enregistrer pour une utilisation future.',
    autoCalculatedRecommendations: 'Recommandations calculées automatiquement',
    detailedExplanationForTheSuggestion: 'Explication détaillée pour la suggestion',
    estimatedCostForTheSuggestedWork: 'Coût estimé pour le travail suggéré (CAD)',
    whenThisEvaluationOrWorkShould: 'Quand cette évaluation ou ce travail doit être effectué',
    automaticallyCalculateSuggestionTypePriorityAnd: 'Calculer automatiquement le type de suggestion, la priorité et les dates en fonction des données de l\'élément',
    selectTheBuildingElementForThis: 'Sélectionnez l\'élément d\'immeuble pour cette suggestion',
    pleaseReviewTheSuggestionDetailsAnd: 'Veuillez examiner les détails de la suggestion et prendre une décision d\'approbation.',
    additionalInformationServiceQualityNotesSpecialties: 'Informations supplémentaires, notes sur la qualité du service, spécialités, etc.',
    primaryEmailAddressForCommunication: 'Adresse courriel principale pour la communication',
    primaryPhoneNumberForContact: 'Numéro de téléphone principal pour le contact',
    primaryContactPersonAtTheVendor: 'Personne-ressource principale chez le fournisseur',
    primaryServiceCategoryForThisVendor: 'Catégorie de service principale pour ce fournisseur',
    theLegalOrBusinessNameOf: 'Le nom légal ou commercial du fournisseur',
    noFeaturesInThisCategoryYet: 'Aucune fonctionnalité dans cette catégorie pour le moment.',
    formHasBeenPrePopulatedWith: 'Le formulaire a été pré-rempli avec les données du modèle. Vous pouvez modifier tous les champs ci-dessous. La facture sera créée comme une nouvelle facture ponctuelle.',
    noBuildingsAvailableForTheSelected: 'Aucun immeuble disponible pour les organisations sélectionnées.',
    noOrganizationsSelectedPleaseSelectOrganizations: 'Aucune organisation sélectionnée. Veuillez d\'abord sélectionner des organisations.',
    noOrganizationsAvailableToAssign: 'Aucune organisation disponible à attribuer.',
    noResidencesAvailableForTheSelected: 'Aucune résidence disponible pour les immeubles sélectionnés.',
    noBuildingsSelectedPleaseSelectBuildings: 'Aucun immeuble sélectionné. Veuillez d\'abord sélectionner des immeubles.',
    noPermissionsFoundMatchingYourSearch: 'Aucune permission trouvée correspondant à vos critères de recherche.',
    completeSystemPermissionsTableWithDetailed: 'Tableau complet des permissions système avec des informations détaillées sur chaque permission.',
    noUsersFoundMatchingYourSearch: 'Aucun utilisateur trouvé correspondant à vos critères de recherche.',
    userInheritsAllPermissionsFrom: 'L\'utilisateur hérite de toutes les permissions de',
    noUserSpecificPermissionOverrides: 'Aucune dérogation de permission spécifique à l\'utilisateur',
    adminManagerResidentTenant: 'Administrateur → Gestionnaire → Résident → Locataire',
    yourDashboardWillBeCustomizedBased: 'Votre tableau de bord sera personnalisé en fonction de votre rôle et de vos permissions.',
    editTheDetailsOfThisBill: 'Modifier les détails de cette facture, y compris les montants, dates et informations de paiement',
    viewDetailedInformationAboutThisBill: 'Consulter les informations détaillées sur cette facture, y compris l\'échéancier de paiement et le statut',
    fillInTheFormBelowTo: 'Remplissez le formulaire ci-dessous pour créer une nouvelle facture pour votre immeuble',
    noBillsFoundForTheSelected: 'Aucune facture trouvée pour les filtres sélectionnés. Créez votre première facture pour commencer.',
    fillInTheFormBelowTo2: 'Remplissez le formulaire ci-dessous pour créer une nouvelle facture',
    thisActionCannotBeUndone2: '? Cette action est irréversible.',
    areYouSureYouWantTo8: 'Êtes-vous sûr de vouloir supprimer',
    areYouSureYouWantTo9: 'Êtes-vous sûr de vouloir mettre à jour le statut de',
    tiquettesPourClasserVosDocumentsCcq: 'Étiquettes pour classer vos documents (CCQ, Loi 16…)',
    noInvoicesFoundForTheSelected: 'Aucune facture trouvée pour les filtres sélectionnés. Créez votre première facture pour commencer.',
    thisActionCannotBeUndoneAnd: '« ? Cette action est irréversible et supprimera tout l\'historique d\'entretien et les documents associés.',
    manageBuildingElementsTrackConditionsAnd: 'Gérez les éléments d\'immeuble, suivez les conditions et planifiez les évaluations d\'entretien',
    distributionOfElementConditions: 'Distribution des conditions des éléments',
    mandatoryBuildingSafetyDrill: 'Exercice de sécurité obligatoire de l\'immeuble',
    buildingEventsAndImportantDates: 'Événements de l\'immeuble et dates importantes',
    poolMaintenanceScheduledForNextWeek: 'Entretien de la piscine prévu pour la semaine prochaine',
    elevatorMaintenanceFinishedUnit4b: 'Entretien de l\'ascenseur terminé - Unité 4B',
    latestUpdatesFromYourBuilding: 'Dernières mises à jour de votre immeuble',
    thisWillPermanentlyDeleteYourAccount: 'Ceci supprimera définitivement votre compte et toutes les données associées, y compris :',
    permanentlyDeleteYourAccountAndAll: 'Supprimer définitivement votre compte et toutes les données associées. Cette action est irréversible.',
    exportAllYourPersonalDataIncluding: 'Exporter toutes vos données personnelles, y compris les informations de profil, les factures, les documents et l\'historique d\'activité.',

    // Workflow tabs (task 711)
    wfCompleteProjectMissing: 'Données du projet manquantes. Impossible de charger l\'onglet de complétion.',
    wfCompleteSummaryDescription: 'Résumé final du projet et détails de complétion',
    wfCompleteSummaryCardDesc: 'Documenter le résultat final, les leçons apprises et les principales réalisations',
    wfCompleteSummaryFieldDesc: 'Ce résumé fera partie du dossier permanent du projet',
    wfCompleteFooterStatus: 'Le projet a été complété avec succès',
    wfElementsAddDescription: 'Ajouter des éléments à ce projet de maintenance',
    wfElementsIncludedDescription: 'Éléments inclus dans ce projet de maintenance',
    wfElementsAdjustSearchHint: 'Essayez d\'ajuster vos termes de recherche.',
    wfElementsNoneAddedYet: 'Aucun élément ajouté à ce projet pour le moment.',
    wfElementsAddFromAvailable: 'Ajoutez des éléments à partir des éléments disponibles ci-dessous.',
    wfElementsBulkRemoveWarning_one: 'Ceci retirera {count} élément sélectionné du projet. Cette action est irréversible.',
    wfElementsBulkRemoveWarning_other: 'Ceci retirera {count} éléments sélectionnés du projet. Cette action est irréversible.',
    wfInProgressProjectMissing: 'Données du projet manquantes. Impossible de charger l\'onglet en cours.',
    wfPlannedProjectMissing: 'Données du projet manquantes. Impossible de charger l\'onglet de planification.',
    wfPreWorkProjectMissing: 'Données du projet manquantes. Impossible de charger l\'onglet de pré-travaux.',
    wfPaymentConfigDescription: 'Configurer le calendrier et les montants de paiement pour cette soumission du fournisseur',
    wfPaymentTypeDescription: 'Choisir s\'il s\'agit d\'un paiement unique ou de plusieurs paiements échelonnés',
    wfPaymentEndRecurringLabel: 'Date de fin du paiement récurrent (facultatif)',
    wfPaymentInitialDescription: 'Cocher s\'il y a un montant de paiement initial différent',
    wfPaymentEqualRecurringDesc: 'Cocher si tous les paiements récurrents sont du même montant',
    wfPaymentMismatchWarning: 'Le total du plan de paiement ({planTotal}) ne correspond pas au prix du fournisseur ({vendorPrice})',
    wfModalNoProjectDescription: 'Aucune donnée de projet fournie au modal de flux de travail',
    wfModalProjectMissingMessage: 'Les informations du projet sont manquantes. Veuillez fermer ce modal et réessayer.',
    wfModalProjectStillLoading: 'Les données du projet sont manquantes ou en cours de chargement. Veuillez patienter un instant et réessayer.',
    wfModalUnknownTabSuffix: 'Veuillez sélectionner un onglet de flux de travail valide.',
    wfModalLoadingDescription: 'Chargement des informations du flux de travail du projet...',
    wfModalUnableToLoad: 'Impossible de charger les informations du flux de travail du projet',
    wfSubmissionAvailableDateDesc: 'Quand le fournisseur peut-il commencer le travail ?',
    wfSubmissionAdditionalDetailsDesc: 'Détails supplémentaires concernant la soumission du fournisseur',
    wfSkipConfigDescription: 'Configurer les étapes du flux de travail à ignorer pour ce projet. Les étapes ignorées seront automatiquement contournées lors de la progression.',
    wfSkipConfigCompletedNote: 'Cette étape a déjà été complétée et ne peut être modifiée.',
    wfSkipConfigChangesImmediate: 'Les modifications sont appliquées immédiatement',
    wfSkipConfigDeleteConfirmation: 'Êtes-vous certain de vouloir supprimer définitivement ce projet ? Cette action est irréversible. Toutes les données du projet, les tâches, les soumissions des fournisseurs et l\'historique du flux de travail seront définitivement supprimés.',
    wfSkipConfigDialogTitle: 'Configuration du flux de travail',
    wfSkipConfigStatusCompleted: 'Complétée',
    wfSkipConfigStatusCurrent: 'En cours',
    wfSkipConfigStatusSkipped: 'Ignorée',
    wfSkipConfigSkipStepLabel: 'Ignorer cette étape',
    wfSkipConfigIncludeStepLabel: 'Inclure cette étape',
    wfSkipConfigDeletingLabel: 'Suppression...',
    wfSkipConfigDeleteButton: 'Supprimer le projet',
    wfSkipConfigCloseButton: 'Fermer',
    wfSkipConfigDeleteAlertTitle: 'Supprimer le projet',
    wfSkipConfigCancelButton: 'Annuler',
    wfSkipConfigDeletePermanentlyButton: 'Supprimer définitivement',
    wfStepSubmissionLabel: 'Soumissions',
    wfStepSubmissionDescription: 'Ignorer la phase de soumissions et de sélection des fournisseurs',
    wfStepPreWorkLabel: 'Pré-travaux',
    wfStepPreWorkDescription: 'Ignorer la phase de préparation et de coordination',
    wfStepInProgressLabel: 'En cours',
    wfStepInProgressDescription: 'Ignorer la phase d\'exécution active des travaux',
    wfStepPostWorkLabel: 'Post-travaux',
    wfStepPostWorkDescription: 'Ignorer la phase de nettoyage et de finalisation',
    wfElementsAddedTitle: 'Éléments ajoutés',
    wfElementsAddedDescription: 'Les éléments ont été ajoutés au projet avec succès.',
    wfElementsAddFailedDescription: 'Échec de l\'ajout des éléments au projet.',
    wfElementsRemovedTitle: 'Élément retiré',
    wfElementsRemovedDescription: 'L\'élément a été retiré du projet avec succès.',
    wfElementsRemoveFailedDescription: 'Échec du retrait de l\'élément du projet.',
    wfElementsUpdatedTitle: 'Élément mis à jour',
    wfElementsUpdatedDescription: 'L\'élément du projet a été mis à jour avec succès.',
    wfElementsUpdateFailedDescription: 'Échec de la mise à jour de l\'élément du projet.',
    postWorkNewTaskDefault: 'Nouvelle tâche post-travaux',
    wfCompleteSummaryPlaceholder: 'Fournissez un résumé complet des travaux réalisés, incluant :\n• Ce qui a été accompli\n• Les défis surmontés\n• La qualité des travaux livrés\n• L\'impact sur l\'immeuble et les résidents\n• Les leçons apprises pour les projets futurs\n• Les recommandations d\'entretien',
    wfElementsSearchPlaceholder: 'Rechercher des éléments par nom, description ou code UNIFORMAT...',

    // Bulk edit cost dialog (task #707)
    bulkCostUpdateTitle: 'Mettre à jour les coûts de reconstruction',
    bulkCostUpdateDescPrefix: 'Mettre à jour les coûts de reconstruction pour ',
    bulkCostUpdateDescSuffix: ' élément(s) sélectionné(s).',
    bulkCostAssignmentType: 'Type d\'attribution du coût',
    bulkCostPerElement: 'Par élément',
    bulkCostPerUnit: 'Par unité (m², m, etc.)',
    bulkCostPerElementHint: 'Attribuer le même coût total à chaque élément',
    bulkCostPerUnitHint: 'Attribuer un coût par unité — le coût total sera calculé selon la quantité et le type d\'unité de l\'élément',
    bulkCostAmountLabel: 'Montant du coût ($)',
    bulkCostPerElementHelper: 'Coût total de reconstruction pour chaque élément (p. ex. 5 000 $ par fenêtre)',
    bulkCostPerUnitHelper: 'Coût par unité (p. ex. 50 $ par m² pour le revêtement de sol, 200 $ par m pour les rampes)',
    bulkCostPreviewLabel: 'Aperçu :',
    bulkCostPreviewPerElementPrefix: 'Chaque élément aura un coût de reconstruction de ',
    bulkCostPreviewPerElementSuffix: ' $',
    bulkCostPreviewPerUnitPrefix: 'Chaque élément aura un coût unitaire de ',
    bulkCostPreviewPerUnitSuffix: ' $ par unité',
    bulkCostUpdateButton: 'Mettre à jour les coûts',
    bulkCostToastUpdatedTitle: 'Coûts mis à jour',
    bulkCostToastUpdatedDescPrefix: 'Coûts mis à jour avec succès pour ',
    bulkCostToastUpdatedDescSuffix: ' élément(s)',
    bulkCostToastFailedTitle: 'Échec de la mise à jour',
    bulkCostToastFailedDesc: 'Échec de la mise à jour des coûts des éléments',
    bulkCostInvalidAmountError: 'Veuillez saisir un montant de coût valide',

    // Bulk edit residence dialog (task #707)
    bulkResidenceTitle: 'Modifier l\'attribution et les propriétés',
    bulkResidenceDescPrefix: 'Mettre à jour l\'attribution de résidence, le type d\'accès et le type de charge pour ',
    bulkResidenceDescSuffix: ' élément(s) sélectionné(s).',
    bulkResidenceUpdateAssignment: 'Mettre à jour l\'attribution de résidence',
    bulkResidenceSelectPlaceholder: 'Sélectionner une résidence',
    bulkResidenceBuildingWide: 'Pour tout le bâtiment',
    bulkResidenceBuildingWideDesc: 'Commun à l\'ensemble du bâtiment',
    bulkResidenceUnitPrefix: 'Unité ',
    bulkResidenceFloorPrefix: 'Étage ',
    bulkResidenceUpdateAccess: 'Mettre à jour le type d\'accès',
    bulkResidenceSelectAccess: 'Sélectionner le type d\'accès',
    bulkResidenceNotRestrained: 'Non restreint',
    bulkResidenceNotRestrainedDesc: 'Accès facile',
    bulkResidenceRestrained: 'Restreint',
    bulkResidenceRestrainedDesc: 'Accès restreint',
    bulkResidenceUpdateCharge: 'Mettre à jour le type de charge',
    bulkResidenceSelectCharge: 'Sélectionner le type de charge',
    bulkResidenceCommon: 'Commun',
    bulkResidenceCommonDesc: 'Responsabilité du bâtiment',
    bulkResidencePersonal: 'Personnel',
    bulkResidencePersonalDesc: 'Responsabilité du résident',
    bulkResidenceChangesToApply: 'Modifications à appliquer :',
    bulkResidenceChangeResidence: 'Résidence',
    bulkResidenceChangeAccess: 'Accès',
    bulkResidenceChangeCharge: 'Charge',
    bulkResidenceUpdateButton: 'Mettre à jour l\'attribution',
    bulkResidenceToastUpdatedTitle: 'Attribution mise à jour',
    bulkResidenceToastUpdatedDescPrefix: 'Attribution mise à jour avec succès pour ',
    bulkResidenceToastUpdatedDescSuffix: ' élément(s)',
    bulkResidenceToastFailedTitle: 'Échec de la mise à jour',
    bulkResidenceToastFailedDesc: 'Échec de la mise à jour des attributions des éléments',
    bulkResidenceSelectFieldError: 'Veuillez sélectionner au moins un champ à mettre à jour',
    bulkResidenceUnknownUnit: 'Inconnue',

    // Project budget (task #707)
    pbBudgetOverview: 'Aperçu du budget',
    pbBudgetBreakdown: 'Répartition du budget',
    pbViewElements: 'Voir les éléments',
    pbExportBudget: 'Exporter le budget',
    pbTotalBudget: 'Budget total',
    pbActualCost: 'Coût réel',
    pbAllocated: 'Alloué',
    pbRemaining: 'Restant',
    pbBudgetUtilization: 'Utilisation du budget',
    pbOverBudgetPrefix: 'Le projet dépasse le budget de ',
    pbOverBudgetSuffix: ' $',
    pbFailedToLoadTitle: 'Échec du chargement du budget',
    pbFailedToLoadDesc: 'Une erreur est survenue lors du chargement du budget du projet. Veuillez réessayer.',
    pbCategory: 'Catégorie',
    pbVariance: 'Écart',
    pbActions: 'Actions',
    pbHistoricalOnly: 'Historique seulement',
    pbViewDetails: 'Voir les détails',
    pbCount: 'Nombre',
    pbElementsSuffix: ' éléments',
    pbVendorsSuffix: ' fournisseurs',
    pbOver: ' dépassement',
    pbNotAvailable: 'S.O.',
    pbSearchBreakdownPlaceholder: 'Rechercher des catégories de répartition…',
    pbNoBudgetDataTitle: 'Aucune donnée budgétaire',
    pbNoBudgetDataDesc: 'Aucune allocation budgétaire ni coût historique trouvé pour ce projet.',
    pbBreakdownDetailsTitle: 'Détails de la répartition du budget',
    pbBreakdownDetailsDesc: 'Répartition détaillée des coûts et des allocations pour cette catégorie budgétaire.',
    pbDetailsSuffix: ' — détails',
    pbProjectElementsHeading: 'Éléments du projet',
    pbVendorHistoryHeading: 'Historique des fournisseurs',
    pbUnknownVendor: 'Fournisseur inconnu',
    pbCategoryElementAllocations: 'Allocations aux éléments',
    pbCategoryElementAllocationsDesc: 'Budget alloué à des éléments spécifiques du bâtiment',
    pbCategoryVendorCosts: 'Coûts des fournisseurs',
    pbCategoryVendorCostsDesc: 'Dépenses historiques des entrepreneurs et fournisseurs',
    pbCategoryMaterials: 'Matériaux',
    pbCategoryMaterialsDesc: 'Coûts des matériaux et fournitures de l\'historique',
    pbCategoryLabor: 'Main-d\'œuvre',
    pbCategoryLaborDesc: 'Coûts de main-d\'œuvre liés aux travaux du projet',
    pbCategoryUnallocated: 'Non alloué',
    pbCategoryUnallocatedDesc: 'Budget non encore alloué à des éléments spécifiques',
    pbBreakdownAllocatedToPrefix: 'Budget alloué à ',
    pbBreakdownAllocatedToSuffix: ' éléments du bâtiment',
    pbBreakdownVendorCountPrefix: 'Coûts historiques de ',
    pbBreakdownVendorCountSuffix: ' fournisseurs',
    pbBreakdownMaterialsDesc: 'Coûts des matériaux et fournitures',
    pbBreakdownLaborDesc: 'Coûts de main-d\'œuvre liés aux réparations',
    pbBreakdownUnallocatedDesc: 'Budget non encore alloué à des éléments spécifiques',

    // Project elements (task #707)
    peElement: 'Élément',
    peCondition: 'État',
    pePlannedWork: 'Travaux prévus',
    peCostAllocation: 'Allocation de coût',
    peLifespanImpact: 'Impact sur la durée de vie',
    peActions: 'Actions',
    peNotSpecified: 'Non précisé',
    peNotSet: 'Non défini',
    peTbd: 'À déterminer',
    peYearsSuffix: ' ans',
    peOpenMenu: 'Ouvrir le menu',
    peActionsLabel: 'Actions',
    peActionViewDetails: 'Voir les détails',
    peActionEditAllocation: 'Modifier l\'allocation',
    peActionRemoveFromProject: 'Retirer du projet',
    peRemoveSelected: 'Retirer la sélection',
    peExportElements: 'Exporter les éléments',
    peProjectElementsTitle: 'Éléments du projet',
    peElementsAssignedSuffix: ' éléments du bâtiment associés à ce projet',
    peSearchPlaceholder: 'Rechercher des éléments…',
    peNoElementsAssignedTitle: 'Aucun élément associé',
    peNoElementsAssignedDesc: 'Aucun élément du bâtiment n\'a encore été associé à ce projet.',
    peNoElementsAssignedShort: 'Aucun élément associé à ce projet pour le moment.',
    peAddElement: 'Ajouter un élément',
    peAddBuildingElementTitle: 'Ajouter un élément du bâtiment',
    peAddBuildingElementDesc: 'Sélectionnez les éléments du bâtiment à inclure dans ce projet.',
    peAddBuildingElementsTitle: 'Ajouter des éléments du bâtiment',
    peAddBuildingElementsDesc: 'Sélectionnez les éléments du bâtiment à inclure dans ce projet et définissez éventuellement l\'allocation des coûts et les détails des travaux.',
    peQuickProject: 'Projet rapide',
    peQuickProjectLong: 'Projet de planification uniquement, ne pouvant pas dépasser la phase de planification',
    peQuickProjectShort: 'Projet de planification uniquement',
    peWorkDescriptionLabel: 'Description des travaux',
    peWorkDescriptionPlaceholder: 'Décrivez les travaux à effectuer sur ces éléments…',
    peCostAllocationLabel: 'Allocation de coût ($)',
    peLifespanImpactLabel: 'Impact sur la durée de vie (années)',
    peAvailableElements: 'Éléments disponibles',
    peAllAlreadyAssigned: 'Tous les éléments disponibles sont déjà associés à ce projet.',
    peEditElementTitle: 'Modifier les détails de l\'élément',
    peEditElementDesc: 'Mettre à jour l\'allocation des coûts et les détails des travaux pour cet élément.',
    peEditWorkDescriptionPlaceholder: 'Décrivez les travaux à effectuer…',
    peSavingProgress: 'Enregistrement…',
    peRemoveElementTitle: 'Retirer l\'élément',
    peRemoveElementConfirm: 'Êtes-vous sûr de vouloir retirer cet élément du projet ? Cette action est irréversible.',
    peRemoveButton: 'Retirer',
    peRemovingProgress: 'Retrait…',
    pePermissionDeniedTitle: 'Permission refusée',
    pePermissionDeniedAddElements: 'Vous n\'avez pas la permission d\'ajouter des éléments aux projets.',
    pePermissionDeniedQuickProject: 'Vous n\'avez pas la permission de créer des projets rapides.',
    peElementAddedTitle: 'Élément ajouté',
    peElementAddedDesc: 'L\'élément du bâtiment a été ajouté au projet avec succès.',
    peElementAddFailedTitle: 'Échec de l\'ajout de l\'élément',
    peElementUpdatedTitle: 'Élément mis à jour',
    peElementUpdatedDesc: 'Les détails de l\'élément ont été mis à jour avec succès.',
    peElementUpdateFailedTitle: 'Échec de la mise à jour',
    peElementRemovedTitle: 'Élément retiré',
    peElementRemovedDesc: 'L\'élément a été retiré du projet.',
    peElementRemoveFailedTitle: 'Échec du retrait',
    peQuickProjectCreatedTitle: 'Projet rapide créé',
    peQuickProjectCreatedDesc: 'Ce projet a été défini comme projet rapide à des fins de planification uniquement.',
    peQuickProjectFailedTitle: 'Échec de la création du projet rapide',
    peBulkOpDoneTitle: 'Opération groupée terminée',
    peBulkOpRemovedDesc: 'Les éléments sélectionnés ont été retirés avec succès.',
    peBulkOpUpdatedDesc: 'Les éléments sélectionnés ont été mis à jour avec succès.',
    peBulkOpFailedTitle: 'Échec de l\'opération groupée',
    pePleaseTryAgain: 'Veuillez réessayer.',
    peQuickProjectFallbackDescription: 'Projet rapide à des fins de planification',

    // Element form (task #707)
    efAddBuildingElement: 'Ajouter un élément du bâtiment',
    efEditBuildingElement: 'Modifier l\'élément du bâtiment',
    efViewBuildingElement: 'Consulter l\'élément du bâtiment',
    efAddDescription: 'Ajouter un nouvel élément du bâtiment à l\'inventaire avec ses spécifications et son état',
    efEditDescription: 'Mettre à jour les informations et l\'état de l\'élément du bâtiment',
    efViewDescription: 'Consulter les informations et l\'état de l\'élément du bâtiment',
    efDeleteButton: 'Supprimer',
    efDeletingProgress: 'Suppression…',
    efDeleteConfirm: 'Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.',
    efDetailsTabLabel: 'Détails',
    efHistoryTabLabel: 'Historique',
    efUniformatCodeLabel: 'Code UNIFORMAT',
    efBrowseButton: 'Parcourir',
    efSearchPlaceholder: 'Rechercher des codes UNIFORMAT…',
    efSearchPlaceholderBrowser: 'Rechercher des codes UNIFORMAT…',
    efBrowseDialogTitle: 'Parcourir les codes UNIFORMAT',
    efBrowseDialogHint: 'Navigation : Niveau 1 → Niveau 2 → Niveau 3 (seuls les codes de niveau 3 sont sélectionnables)',
    efBreadcrumbLevel1: 'Niveau 1',
    efBreadcrumbLevel2Prefix: 'Niveau 2',
    efBreadcrumbLevel3Prefix: 'Niveau 3',
    efTypicalLifespanPrefix: 'Durée de vie typique : ',
    efTypicalLifespanShortPrefix: 'Typique : ',
    efTypicalLifespanSuffix: ' ans',
    efLoadingCodes: 'Chargement des codes UNIFORMAT…',
    efNoMatchingCodes: 'Aucun code correspondant',
    efSelectableLabel: 'Sélectionnable',
    efNavigateLabel: 'Naviguer →',
    efNavigateOnlyLabel: 'Navigation seulement',
    efElementNameLabel: 'Nom de l\'élément',
    efElementNamePlaceholder: 'p. ex. Mur extérieur — Nord',
    efCurrentConditionLabel: 'État actuel',
    efSelectCondition: 'Sélectionner l\'état',
    efDescriptionLabel: 'Description',
    efDescriptionLabelHelper: 'Description détaillée optionnelle de l\'élément',
    efDescriptionPlaceholder: 'Décrivez l\'emplacement, les spécifications ou les autres détails pertinents de l\'élément…',
    efResidenceAssignmentLabel: 'Attribution de résidence',
    efResidenceAssignmentDesc: 'Indiquez si cet élément concerne tout le bâtiment ou des résidences spécifiques',
    efBuildingWideElement: 'Élément pour tout le bâtiment',
    efSelectResidenceAssignment: 'Sélectionner l\'attribution de résidence',
    efUnitPrefix: 'Unité ',
    efFloorPrefix: 'Étage ',
    efAssignedToPrefix: 'Actuellement attribué à : Unité ',
    efFloorSuffix: 'Étage',
    efAccessTypeLabel: 'Type d\'accès',
    efAccessTypeDesc: 'Restrictions d\'accès pour cet élément',
    efSelectAccessType: 'Sélectionner le type d\'accès',
    efNotRestrained: 'Non restreint',
    efNotRestrainedDesc: 'Accès libre',
    efRestrained: 'Restreint',
    efRestrainedDesc: 'Accès restreint',
    efChargeTypeLabel: 'Type de charge',
    efChargeTypeDesc: 'Qui est responsable des coûts',
    efSelectChargeType: 'Sélectionner le type de charge',
    efCommon: 'Commun',
    efCommonDesc: 'Responsabilité du bâtiment',
    efPersonal: 'Personnel',
    efPersonalDesc: 'Responsabilité du résident',
    efTimelineHeading: 'Échéancier et durée de vie',
    efOriginalConstructionDate: 'Date de construction originale',
    efOriginalLifespan: 'Durée de vie originale (années)',
    efYearsLeftToReconstruction: 'Années restantes avant reconstruction',
    efQuantityHeading: 'Quantité et unité',
    efQuantityLabel: 'Quantité',
    efUnitLabel: 'Unité',
    efSelectUnit: 'Sélectionner une unité',
    efUnitM2: 'm² (mètres carrés)',
    efUnitM: 'm (mètres linéaires)',
    efUnitUnit: 'unité (chacune)',
    efUnitM3: 'm³ (mètres cubes)',
    efUnitKg: 'kg (kilogrammes)',
    efUnitL: 'L (litres)',
    efNextEvaluationDate: 'Prochaine date d\'évaluation',
    efAutoCalculate: 'Calcul automatique',
    efAutoCalcHelper: 'Calculée automatiquement selon l\'état et les années restantes',
    efReconstructionEvaluation: 'Évaluation de reconstruction',
    efReconstructionCost: 'Coût de reconstruction',
    efReconstructionCostPlaceholder: '0,00',
    efDateOfEstimation: 'Date de l\'estimation',
    efElementQuantityHeading: 'Quantité de l\'élément',
    efQuantityDuplicateLabel: 'Quantité (duplication)',
    efQuantityDuplicateDesc: 'Nombre d\'éléments identiques à créer (p. ex. 30 fenêtres, 5 portes)',
    efNotesLabel: 'Notes',
    efNotesPlaceholder: 'Notes additionnelles à propos de cet élément…',
    efElementCreatedTitle: 'Élément créé',
    efElementsCreatedSuffix: ' éléments créés',
    efElementUpdatedTitle: 'Élément mis à jour',
    efElementCreatedSuccessSuffix: ' a été créé avec succès',
    efElementUpdatedSuccessSuffix: ' a été mis à jour avec succès',
    efSuccessfullyCreatedPrefix: 'Création réussie de ',
    efSuccessfullyCreatedSuffix: ' éléments numérotés',
    efCreationFailedTitle: 'Échec de la création',
    efUpdateFailedTitle: 'Échec de la mise à jour',
    efFailedToCreateElement: 'Échec de la création de l\'élément',
    efFailedToUpdateElement: 'Échec de la mise à jour de l\'élément',
    efNoElementToDelete: 'Aucun élément à supprimer',
    efElementDeletedTitle: 'Élément supprimé',
    efElementDeletedDesc: 'L\'élément du bâtiment a été retiré de l\'inventaire avec succès.',
    efDeletionFailedTitle: 'Échec de la suppression',
    efFailedToDeleteElement: 'Échec de la suppression de l\'élément',
    // Manager > Maintenance > Projects (task #712)
    pvFailedToLoadDashboard: 'Échec du chargement des analyses du tableau de bord. Veuillez réessayer.',
    pvNoBuildingDashboard: 'Veuillez sélectionner un immeuble pour afficher son tableau de bord de projets.',
    pvDashboardSubtitle: 'Analyses, aperçus et indicateurs de performance pour la gestion des projets d\'entretien',
    pvProjectTrendsDesc: 'Tendances mensuelles de création et d\'achèvement des projets',
    pvBudgetAnalysisDesc: 'Utilisation budgétaire planifiée vs réelle dans le temps',
    pvStatusBreakdownDesc: 'Répartition actuelle des projets par statut',
    pvPriorityBreakdownDesc: 'Répartition des projets par niveau de priorité',
    pvOverdueProjectsAlert: '{count} projet(s) sont en retard et nécessitent une attention immédiate.',
    pvBudgetUtilizationHighAlert: 'L\'utilisation du budget est élevée ({percent} %). Envisagez de réviser les dépenses.',
    pvExecutiveSummaryDesc: 'Aperçus clés et recommandations pour la gestion du portefeuille de projets',
    pvBudgetWithinTarget: 'Utilisation du budget dans la fourchette cible',
    pvQualityMeetingExpectations: 'Indicateurs de qualité conformes aux attentes',
    pvDetailsPanelDesc: 'Détails complets du projet : échéancier, budget et outils de gestion',
    pvFailedToLoadDetails: 'Échec du chargement des détails du projet. Veuillez réessayer.',
    pvImmediateAttention: 'Une attention immédiate peut être requise.',
    pvFinancialTrackingDesc: 'Suivi financier et gestion des coûts',
    pvElementsAssociatedDesc: 'Éléments d\'immeuble associés à ce projet',
    pvElementsAvailableInFullView: 'Gestion des éléments disponible en vue complète',
    pvFailedToLoadProjects: 'Échec du chargement des projets. Veuillez actualiser la page.',
    pvNoBuildingProjectsTable: 'Veuillez sélectionner un immeuble pour afficher ses projets d\'entretien.',
    pvNoProjectsCreatedYet: 'Aucun projet d\'entretien n\'a encore été créé pour cet immeuble.',
    pvGetStartedHint: 'Commencez en créant votre premier projet ou en générant des projets à partir des suggestions d\'évaluation.',
    pvNoProjectsMatchFilters: 'Aucun projet ne correspond à vos critères de recherche et de filtrage actuels.',
    pvAdjustFiltersHint: 'Essayez d\'ajuster vos filtres ou vos termes de recherche.',
    pvRealtimeBulkHint: 'Les données des projets sont mises à jour en temps réel. Utilisez les actions groupées pour gérer plusieurs projets à la fois.',
    pvFailedToLoadTimeline: 'Échec du chargement des données de l\'échéancier. Veuillez actualiser la page.',
    pvNoBuildingTimeline: 'Veuillez sélectionner un immeuble pour afficher son échéancier de projets.',
    pvTimelineSubtitle: 'Vue d\'ensemble de l\'horaire et suivi des jalons pour tous les projets',
    pvClickDateToView: 'Cliquez sur une date pour voir les événements planifiés',
    pvNoEventsScheduled: 'Aucun événement planifié à cette date',
    pvOverdueEventSingular: '{count} événement de projet est en retard. Révisez les calendriers des projets et envisagez d\'ajuster les échéanciers ou de réaffecter les ressources.',
    pvOverdueEventPlural: '{count} événements de projet sont en retard. Révisez les calendriers des projets et envisagez d\'ajuster les échéanciers ou de réaffecter les ressources.',
    pvFailedToLoadMetrics: 'Échec du chargement des indicateurs de projets. Veuillez actualiser la page.',
    pvBudgetCriticallyHigh: 'L\'utilisation du budget est dangereusement élevée. ',
    pvSchedulePerformanceAttention: 'La performance de l\'horaire requiert une attention immédiate. ',
    pvEfficiencyBelowAcceptable: 'L\'efficacité d\'achèvement des projets est sous les niveaux acceptables. ',
    pvHealthAlertSuffix: 'Envisagez de réviser le portefeuille de projets et l\'allocation des ressources.',
    pvCreateProjectsFromSuggestions: 'Créer des projets à partir de suggestions',
    pvSuggestionsDialogDesc: 'Examinez et sélectionnez les suggestions d\'évaluation pour créer automatiquement des projets d\'entretien. Les projets seront générés avec des flux de travail standards et pourront être personnalisés après leur création.',
    pvFailedToLoadSuggestions: 'Échec du chargement des suggestions. Veuillez réessayer.',
    pvProjectDefaultsDesc: 'Définissez les valeurs par défaut pour tous les projets générés',
    pvNoPendingSuggestions: 'Aucune suggestion d\'évaluation en attente n\'est disponible pour cet immeuble.',
    pvNoSuggestionsMatchFilters: 'Aucune suggestion ne correspond à vos critères de recherche et de filtrage actuels.',
    pvProjectsCreatedTitle: 'Projets créés',
    pvProjectsCreatedDesc: '{count} projet(s) ont été créés avec succès à partir des suggestions d\'évaluation.',
    pvFailedToCreateProjects: 'Échec de la création des projets. Veuillez réessayer.',
    pvNoSuggestionsSelectedTitle: 'Aucune suggestion sélectionnée',
    pvNoSuggestionsSelectedDesc: 'Veuillez sélectionner au moins une suggestion pour créer des projets.',
    pvSearchSuggestionsPlaceholder: 'Rechercher des suggestions...',
    pvAllPrioritiesPlaceholder: 'Toutes les priorités',
    pvAllPrioritiesItem: 'Toutes les priorités',
    pvAllTypesPlaceholder: 'Tous les types',
    pvAllTypesItem: 'Tous les types',
    pvTypeInspection: 'Inspection',
    pvTypeMinorRehab: 'Réhabilitation mineure',
    pvTypeMajorRehab: 'Réhabilitation majeure',
    pvTypeReplacement: 'Remplacement',
    pvTypeRepair: 'Réparation',
    pvTypeNotSure: 'Non défini',
    pvHealthHealthy: 'Sain',
    pvHealthWarning: 'Avertissement',
    pvHealthCritical: 'Critique',
    pvSelectAllSuggestions: 'Tout sélectionner ({count} suggestions)',
    pvNSelected: '{count} sélectionné(s)',
    pvNoSuggestionsFound: 'Aucune suggestion trouvée',
    pvSuggestionTypeElementEvaluation: '{type} — Évaluation d\'élément',
    pvElementHash: 'Élément n°{id}',
    pvProjectDefaultsTitle: 'Valeurs par défaut des projets',
    pvDefaultBudgetLabel: 'Budget par défaut',
    pvDurationDaysLabel: 'Durée (jours)',
    pvDefaultPriorityLabel: 'Priorité par défaut',
    pvEstimatedTotalBudget: 'Budget total estimé :',
    pvSuggestionsSelectedFooter: '{count} suggestion(s) sélectionnée(s)',
    pvCreatingButton: 'Création...',
    pvCreateNProjects: 'Créer {count} projet{plural}',
    pvNoBuildingSelected: 'Aucun immeuble sélectionné',
    pvProjectPortfolioDashboard: 'Tableau de bord du portefeuille de projets',
    pvExportReport: 'Exporter le rapport',
    pvCompletionRateLabel: 'Taux d\'achèvement',
    pvBudgetUtilizationLabel: 'Utilisation du budget',
    pvOnTimeCompletionLabel: 'Achèvement à temps',
    pvCostEfficiencyLabel: 'Efficacité des coûts',
    pvProjectTrendsTitle: 'Tendances des projets',
    pvBudgetAnalysisTitle: 'Analyse du budget',
    pvProjectStatusDistributionTitle: 'Répartition des projets par statut',
    pvPriorityDistributionTitle: 'Répartition par priorité',
    pvBudgetHealth: 'Santé du budget',
    pvOverallStatus: 'Statut global',
    pvBudgetUtilizedPct: '{percent} % du budget total utilisé',
    pvScheduleHealth: 'Santé de l\'horaire',
    pvOnTimeDeliveryRate: '{percent} % de taux de livraison à temps',
    pvQualityHealth: 'Santé de la qualité',
    pvSuccessfulCompletionRate: '{percent} % de taux d\'achèvement réussi',
    pvExecutiveSummaryTitle: 'Sommaire exécutif',
    pvPortfolioHealth: 'Santé du portefeuille',
    pvTotalProjectsInPortfolio: '{count} projets au total dans le portefeuille',
    pvCurrentlyActiveProjects: '{count} projets actuellement actifs',
    pvCompletionRateThisPeriod: '{percent} % de taux d\'achèvement pour cette période',
    pvAverageProjectDuration: 'Durée moyenne des projets : {days} jours',
    pvPerformanceInsights: 'Aperçus de performance',
    pvCostEfficiencyAt: 'Efficacité des coûts à {percent} %',
    pvProjectsDeliveredOnTime: '{percent} % des projets livrés à temps',
    pvChartCreated: 'Créés',
    pvChartCompleted: 'Terminés',
    pvChartPlannedBudget: 'Budget planifié',
    pvChartActualSpend: 'Dépenses réelles',
    pvEditProjectAction: 'Modifier le projet',
    pvUpdateStatusAction: 'Mettre à jour le statut',
    pvTimelineAction: 'Échéancier',
    pvProjectProgressTitle: 'Progression du projet',
    pvOverallProgressLabel: 'Progression globale',
    pvTimeRemaining: 'Temps restant',
    pvDaysOverdue: '{days} jours de retard',
    pvDaysLeft: '{days} jours restants',
    pvBudgetUsage: 'Utilisation du budget',
    pvProjectIsOverdue: 'Ce projet est en retard. ',
    pvProjectIsOverBudget: 'Ce projet dépasse le budget. ',
    pvOverviewTab: 'Vue d\'ensemble',
    pvTimelineTab: 'Échéancier',
    pvBudgetTab: 'Budget',
    pvElementsTab: 'Éléments',
    pvProjectInformation: 'Informations sur le projet',
    pvTypeColon: 'Type :',
    pvCreatedFromSuggestion: 'Créé à partir d\'une suggestion :',
    pvAutoGenerated: 'Généré automatiquement',
    pvCreatedColon: 'Créé :',
    pvLastUpdatedColon: 'Dernière mise à jour :',
    pvDurationCaps: 'DURÉE',
    pvNDays: '{count} jours',
    pvActualNDays: 'Réel : {count} jours',
    pvBudgetCaps: 'BUDGET',
    pvAmountSpentSuffix: '{amount} dépensé',
    pvManageProjectElements: 'Gérer les éléments du projet',
    pvProjectNotesAndComm: 'Notes et communication du projet',
    pvBudgetCostTracking: 'Budget et suivi des coûts',
    pvProjectTimelineTitle: 'Échéancier du projet',
    pvKeyDatesAndMilestones: 'Dates clés et jalons',
    pvPlannedStartColon: 'Début planifié :',
    pvPlannedEndColon: 'Fin planifiée :',
    pvActualStartColon: 'Début réel :',
    pvActualEndColon: 'Fin réelle :',
    pvOpenFullTimelineView: 'Ouvrir la vue complète de l\'échéancier',
    pvBudgetAnalysisCardTitle: 'Analyse du budget',
    pvBudgetUtilizationCardLabel: 'Utilisation du budget',
    pvTotalBudgetLabel: 'Budget total',
    pvAmountSpentLabel: 'Montant dépensé',
    pvRemainingLabel: 'Restant',
    pvVarianceLabel: 'Écart',
    pvOpenBudgetManagement: 'Ouvrir la gestion du budget',
    pvProjectElementsTitle: 'Éléments du projet',
    pvNoProjectsFound: 'Aucun projet trouvé',
    pvNoProjectsMatchFiltersTitle: 'Aucun projet ne correspond aux filtres',
    pvProjectsShownOf: 'sur {total} projet{plural} affiché{plural}',
    pvMatchingSearch: 'correspondant à « {search} »',
    pvStatusFilterChip: 'Statut : {value}',
    pvPriorityFilterChip: 'Priorité : {value}',
    pvOverdueOnlyChip: 'En retard seulement',
    pvProjectTimelineHeader: 'Échéancier du projet',
    pvViewMonth: 'Mois',
    pvViewQuarter: 'Trimestre',
    pvViewYear: 'Année',
    pvFullTimeline: 'Échéancier complet',
    pvTotalEvents: 'Total des événements',
    pvOverdueLabel: 'En retard',
    pvDueThisWeek: 'À échéance cette semaine',
    pvActiveProjects: 'Projets actifs',
    pvEventsThisMonth: 'Événements ce mois-ci ({count})',
    pvEventStart: 'Début',
    pvEventEnd: 'Fin',
    pvEventMilestone: 'Jalon',
    pvSelectADate: 'Sélectionnez une date',
    pvEventsScheduledOnDate: '{count} événement(s) planifié(s)',
    pvProjectNumber: 'Projet n°{number}',
    pvTimelineActions: 'Actions de l\'échéancier',
    pvBulkStatusUpdate: 'Mise à jour groupée du statut',
    pvResourcePlanning: 'Planification des ressources',
    pvExportTimeline: 'Exporter l\'échéancier',
    pvTotalProjectsTitle: 'Total des projets',
    pvNActive: '{count} actif(s)',
    pvNCompleted: '{count} terminé(s)',
    pvBudgetOverviewTitle: 'Aperçu du budget',
    pvAmountSpentText: '{amount} dépensé',
    pvScheduleStatusTitle: 'Statut de l\'horaire',
    pvOverdueProjectsText: 'Projets en retard',
    pvNoOverdueProjects: 'Aucun projet en retard',
    pvNDueSoon: '{count} à venir',
    pvPerformanceTitle: 'Performance',
    pvCompletionRateText: 'Taux d\'achèvement',
    pvNPercentOnTime: '{percent} % à temps',
    pvSuggestionsTitle: 'Suggestions',
    pvPendingEvaluationSuggestions: 'Suggestions d\'évaluation en attente',
    pvAllSuggestionsReviewed: 'Toutes les suggestions ont été examinées',
    pvAvgDuration: 'Durée moyenne',
    pvDaysPerProject: 'Jours par projet',
    pvCostEfficiencyTitle: 'Efficacité des coûts',
    pvExcellentEfficiency: 'Excellente efficacité',
    pvGoodEfficiency: 'Bonne efficacité',
    pvNeedsImprovement: 'À améliorer',
    pvResourcesTitle: 'Ressources',
    pvTeamUtilization: 'Utilisation de l\'équipe',
    pvProjectsByStatus: 'Projets par statut',
    pvStatusPlanned: 'Planifié',
    pvStatusEvaluation: 'Évaluation',
    pvStatusSubmission: 'Soumission',
    pvStatusPreWork: 'Pré-travaux',
    pvStatusActiveWork: 'Travaux en cours',
    pvStatusPostWork: 'Post-travaux',
    pvStatusCompleted: 'Terminé',
    pvProjectsByPriority: 'Projets par priorité',
    pvPriorityLowLabel: 'Priorité faible',
    pvPriorityMediumLabel: 'Priorité moyenne',
    pvPriorityHighLabel: 'Priorité élevée',
    pvPriorityCriticalLabel: 'Priorité critique',
    // Auth flow translations (task #713)
    authPrivacyAlertTitle: 'Protection des renseignements personnels (Loi 25 - Québec):',
    authPrivacyAlertText:
      'Votre consentement est requis pour la collecte et l\'utilisation de vos données personnelles.',
    authDataCollectionTitle: 'Collecte et traitement des données',
    authDataCollectionMasterText:
      'J\'accepte tous les types de collecte et traitement de données (essentielles et optionnelles).',
    authEssentialDataLabel: 'Collecte des données essentielles (Requis) *',
    authEssentialDataDesc:
      'Authentification, communication, gestion de compte, services de gestion immobilière.',
    authMarketingLabel: 'Communications marketing (Optionnel)',
    authMarketingDesc:
      'Communications promotionnelles, nouvelles fonctionnalités, offres spéciales.',
    authAnalyticsLabel: 'Analyse et amélioration (Optionnel)',
    authAnalyticsDesc: 'Données d\'utilisation anonymisées pour améliorer les services.',
    authThirdPartyLabel: 'Services tiers intégrés (Optionnel)',
    authThirdPartyDesc: 'Cartographie, notifications, stockage pour améliorer l\'expérience.',
    authRightsAndControl: 'Droits et contrôle',
    authAcknowledgeRightsLabel: 'Reconnaissance de mes droits (Requis) *',
    authAcknowledgeRightsDesc:
      'J\'ai été informé(e) de mes droits concernant mes renseignements personnels et je comprends que je peux exercer ces droits à tout moment.',
    authAcknowledgeRightsWarning: '⚠️ Cette case doit être cochée pour continuer.',
    authYourRightsTitle: '📋 Vos droits selon la Loi 25 du Québec',
    authRightAccess: 'Droit d\'accès:',
    authRightAccessDesc: 'Consulter vos données personnelles',
    authRightRectification: 'Droit de rectification:',
    authRightRectificationDesc: 'Corriger des informations inexactes',
    authRightDeletion: 'Droit de suppression:',
    authRightDeletionDesc: 'Demander l\'effacement de vos données',
    authRightPortability: 'Droit de portabilité:',
    authRightPortabilityDesc: 'Récupérer vos données dans un format lisible',
    authContactRightsTitle: '📞 Contact pour vos droits',
    authContactRightsDesc:
      'Pour exercer vos droits ou pour toute question concernant vos données personnelles, contactez notre responsable de la protection des données:',
    authSecurityRetentionTitle: 'Sécurité et conservation',
    authSecurityLabel: 'Sécurité:',
    authSecurityDesc:
      'Vos données sont chiffrées et stockées sur des serveurs sécurisés au Canada',
    authRetentionLabel: 'Conservation:',
    authRetentionDesc: 'Vos données sont conservées selon les exigences légales québécoises',
    authTransparencyLabel: 'Transparence:',
    authTransparencyDesc: 'Consultez notre politique de confidentialité complète à tout moment',
    authInvalidToken: 'Token invalide',
    authServerConnectionError: 'Erreur de connexion au serveur',
    authValidatingInvitation: 'Validation de l\'invitation',
    authValidatingInvitationDesc: 'Vérification du token d\'invitation et des détails associés...',
    authInvitationTokenRequired: 'Token d\'invitation requis',
    authInvitationTokenRequiredDesc:
      'Aucun token d\'invitation valide n\'a été trouvé. Veuillez utiliser le lien d\'invitation reçu par email.',
    authInvitationInvalid: 'Invitation invalide:',
    authUnableToValidate: 'Impossible de valider l\'invitation',
    authInvitationLinkExpired: 'Le lien d\'invitation peut être expiré, invalide ou déjà utilisé.',
    authInvitationCheckLink: 'Vérifiez que vous utilisez le lien complet reçu par email',
    authInvitationNotExpired: 'Assurez-vous que l\'invitation n\'est pas expirée',
    authInvitationContactAdmin: 'Contactez l\'administrateur si le problème persiste',
    authInvitationValid: 'Invitation valide!',
    authInvitationValidDesc: 'Vous pouvez procéder à la création de votre compte.',
    authInvitationConfirmed: 'Invitation confirmée',
    authInvitedToJoin: 'Vous avez été invité(e) à rejoindre',
    authInvitedBy: 'Invité par',
    authValidity: 'Validité',
    authExpired: 'Expiré',
    authDayRemaining: 'jour restant',
    authDaysRemaining: 'jours restants',
    authHourRemaining: 'heure restante',
    authHoursRemaining: 'heures restantes',
    authExpiringSoon: 'Expire bientôt',
    authPasswordRequiredLabel: 'Mot de passe *',
    authEnterYourPassword: 'Entrez votre mot de passe',
    authHidePassword: 'Masquer le mot de passe',
    authShowPassword: 'Afficher le mot de passe',
    authPasswordDoesNotMeetRequirements:
      'Le mot de passe ne respecte pas les exigences de sécurité.',
    authConfirmPasswordRequired: 'Confirmer le mot de passe *',
    authConfirmYourPassword: 'Confirmez votre mot de passe',
    authPasswordsMatch: 'Les mots de passe correspondent',
    authPasswordsDoNotMatch: 'Les mots de passe ne correspondent pas',
    authSecurityTipsTitle: '💡 Conseils de sécurité',
    authSecurityTip1: 'Utilisez une combinaison unique de lettres, chiffres et symboles',
    authSecurityTip2: 'Évitez les informations personnelles (nom, date de naissance)',
    authSecurityTip3: 'Ne réutilisez pas un mot de passe d\'un autre compte',
    authSecurityTip4: 'Considérez l\'utilisation d\'un gestionnaire de mots de passe',
    authUserProfileLabel: 'Profil utilisateur:',
    authUserProfileDesc:
      'Complétez votre profil pour finaliser votre inscription et accéder aux services de gestion immobilière.',
    authPersonalInformation: 'Informations personnelles',
    authFirstNameRequired: 'Prénom *',
    authYourFirstName: 'Votre prénom',
    authLastNameRequired: 'Nom de famille *',
    authYourLastName: 'Votre nom de famille',
    authPhoneOptional: 'Téléphone (optionnel)',
    authPreferredLanguage: 'Langue préférée *',
    authChooseLanguage: 'Choisir une langue',
    authInvalidPhoneFormat: 'Format de téléphone invalide (ex: 514-123-4567)',
    authFieldIsRequired: 'est requis',
    authDemoUserCreated: 'Utilisateur démo créé',
    authDemoUserCreatedSuccess: 'L\'utilisateur démo a été créé avec succès',
    authErrorTitle: 'Erreur',
    authEmailRequiredForRegular:
      'Une adresse courriel est requise pour les invitations régulières (exemple: utilisateur@domaine.com). Pour les utilisateurs démo, fournissez le prénom et le nom de famille à la place.',
    authResidenceRequiredForBuilding:
      'Veuillez sélectionner une unité de résidence spécifique pour les locataires et résidents lorsqu\'un immeuble est sélectionné',
    authDemoManager: 'Gestionnaire démo',
    authDemoTenant: 'Locataire démo',
    authDemoResident: 'Résident démo',
    authFirstNameLabel: 'Prénom *',
    authEnterFirstName: 'Entrez le prénom',
    authLastNameLabel: 'Nom de famille *',
    authEnterLastName: 'Entrez le nom de famille',
    authBuildingLabel: 'Immeuble',
    authSelectBuilding: 'Sélectionner un immeuble',
    authAllBuildingsOption: 'Tous les immeubles',
    authResidenceLabelRequired: 'Résidence *',
    authSelectResidence: 'Sélectionner une résidence',
    authNoSpecificResidence: 'Aucune résidence spécifique',
    authResidenceRequired: 'Résidence requise pour les locataires et résidents',
    authSelectOrgFirst: 'Veuillez d\'abord sélectionner une organisation',
    authManagersOnlyOwnOrg: 'Les gestionnaires peuvent uniquement inviter à leur organisation',
    authSelectTargetOrg: 'Sélectionner l\'organisation cible',
    authCreatingUser: 'Création de l\'utilisateur...',
    authCreateDemoUser: 'Créer l\'utilisateur démo',
    authEmailRequiredForReset: 'Adresse courriel requise pour la réinitialisation',
    authEmailSent: 'Courriel envoyé',
    authResetEmailSentIfExists:
      'Si cette adresse courriel existe, un lien de réinitialisation a été envoyé.',
    authResetEmailSentSuccess: 'Courriel de réinitialisation envoyé avec succès',
    authResetEmailFollowUp:
      'Si votre adresse courriel est dans notre système, vous recevrez un lien de réinitialisation du mot de passe dans quelques minutes.',
    authCheckSpamFolder: 'N\'oubliez pas de vérifier votre dossier de courrier indésirable.',
    authBackToLogin: 'Retour à la connexion',
    authForgotPasswordTitle: 'Mot de passe oublié',
    authForgotPasswordDesc:
      'Entrez votre adresse courriel pour recevoir un lien de réinitialisation du mot de passe',
    authSendResetLink: 'Envoyer le lien de réinitialisation',
    authSendingInProgress: 'Envoi en cours...',
    authEmailAddressLabel: 'Adresse courriel',
    authEmailAddressDesc: 'Nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe',
    authNewPasswordRequired: 'Le nouveau mot de passe est requis',
    authPasswordMin8:
      'Le mot de passe doit contenir au moins 8 caractères (exemple: MonMotDePasse123!)',
    authPasswordMax100: 'Le mot de passe ne peut pas dépasser 100 caractères',
    authPasswordComplexity:
      'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre (exemple: MonMotDePasse123!)',
    authConfirmPasswordRequiredZ: 'La confirmation du mot de passe est requise',
    authPasswordsDoNotMatchHelp:
      'Les mots de passe ne correspondent pas - veuillez saisir le même mot de passe dans les deux champs',
    authTokenMissing: 'Token manquant',
    authResetLinkInvalid: 'Le lien de réinitialisation est invalide ou manquant.',
    authResetTokenMissing: 'Token de réinitialisation manquant.',
    authPasswordResetTitle: 'Mot de passe réinitialisé',
    authPasswordUpdatedSuccess: 'Votre mot de passe a été mis à jour avec succès.',
    authResetGeneralError: 'Une erreur est survenue lors de la réinitialisation du mot de passe.',
    authResetLinkInvalidExpired:
      'Le lien de réinitialisation est invalide ou expiré. Veuillez demander un nouveau lien.',
    authResetLinkAlreadyUsed: 'Ce lien de réinitialisation a déjà été utilisé.',
    authPasswordTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
    authPasswordTooWeak:
      'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.',
    authPasswordResetCompleteDesc:
      'Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
    authSignIn: 'Se connecter',
    authInvalidLink: 'Lien invalide',
    authRequestNewLink: 'Demander un nouveau lien',
    authResetPasswordTitle: 'Réinitialiser le mot de passe',
    authEnterNewPassword: 'Entrez votre nouveau mot de passe',
    authNewPasswordLabel: 'Nouveau mot de passe',
    authConfirmPasswordLabel: 'Confirmer le mot de passe',
    authConfirmNewPassword: 'Confirmez votre nouveau mot de passe',
    authResettingInProgress: 'Réinitialisation...',
    authValidationStepTitle: 'Validation de l\'invitation',
    authValidationStepDesc: 'Vérification de votre lien d\'invitation et des détails associés',
    authPasswordStepTitle: 'Création du mot de passe',
    authPasswordStepDesc: 'Définissez un mot de passe sécurisé pour votre compte',
    authProfileStepTitle: 'Informations personnelles',
    authProfileStepDesc: 'Complétez votre profil utilisateur',
    authConsentStepTitle: 'Consentements et confidentialité',
    authConsentStepDesc: 'Consentements requis selon la Loi 25 du Québec',
    authPasswordRequiredError: 'Mot de passe requis',
    authNamesRequiredError: 'Nom et prénom requis',
    authConsentsRequiredError: 'Consentements obligatoires requis',
    authAccountCreationError: 'Erreur lors de la création du compte',
    authAccountCreationGenericError:
      'Une erreur est survenue lors de la création de votre compte',
    authRegistrationCompleteTitle: '🎉 Inscription terminée avec succès!',
    authWelcomeUser: 'Bienvenue',
    authAccountCreatedMessage: 'Votre compte a été créé avec succès.',
    authAccountCreatedTitle: '✅ Compte créé avec succès',
    authQuebecComplianceTitle: '🛡️ Conformité Québécoise',
    authQuebecComplianceDesc:
      'Vos consentements ont été enregistrés conformément à la Loi 25 du Québec. Vous pouvez exercer vos droits à tout moment en contactant notre équipe.',
    authAccessMyAccount: 'Accéder à mon compte',
    authLoginWithEmailPassword:
      'Vous pouvez maintenant vous connecter avec votre email et mot de passe',
    authBackToHome: 'Retour à l\'accueil',
    authInvitationAcceptanceTitle: 'Acceptation d\'invitation',
    authInvitationAcceptanceDesc:
      'Complétez votre inscription pour rejoindre la plateforme Koveo Gestion',
    authErrorPrefix: 'Erreur:',
    authCreatingYourAccount: 'Création de votre compte',
    authRegistrationFooter:
      'En vous inscrivant, vous acceptez nos conditions d\'utilisation et notre politique de confidentialité conforme à la Loi 25 du Québec.',
    wfCompleteHeaderTitle: 'Complétion du projet',
    wfCompleteCompleteBadge: 'Complété',
    wfCompleteSavingButton: 'Enregistrement...',
    wfCompleteSaveChangesButton: 'Enregistrer les modifications',
    wfCompleteSummaryCardTitle: 'Résumé de complétion',
    wfCompleteTimelineTitle: 'Calendrier du projet',
    wfCompletePlannedStartLabel: 'Début planifié',
    wfCompleteNotSpecified: 'Non spécifié',
    wfCompleteActualEndLabel: 'Fin réelle',
    wfCompleteDurationLabel: 'Durée du projet',
    wfCompleteDays: 'jours',
    wfCompleteBudgetSummary: 'Résumé du budget',
    wfCompleteTotalBudget: 'Budget total',
    wfCompleteActualCost: 'Coût réel',
    wfCompleteBudgetUtilization: 'Utilisation du budget',
    wfCompleteUtilizedSuffix: '% utilisé',
    wfCompleteOverBudgetBy: 'Dépassement du budget de',
    wfCompleteProjectDetails: 'Détails du projet',
    wfCompleteProjectNumber: 'Numéro de projet',
    wfCompleteProjectType: 'Type de projet',
    wfCompletePriority: 'Priorité',
    wfCompleteOrigin: 'Origine',
    wfCompleteOriginAuto: 'Généré automatiquement',
    wfCompleteOriginManual: 'Manuel',
    wfCompleteCreated: 'Créé',
    wfCompleteStatusTitle: 'Statut',
    wfCompleteProjectCompleteText: 'Projet complété',
    wfCompleteAllStagesText: 'Toutes les étapes du flux de travail sont complétées',
    wfCompleteReopenProjectButton: 'Réouvrir le projet',
    wfModalProjectMissingTitle: 'Projet manquant',
    wfModalWorkflowErrorTitle: 'Erreur du flux de travail',
    wfModalLoadFailedFallback: 'Échec du chargement de l\'état du flux de travail. Veuillez réessayer.',
    wfModalProjectNumberPrefix: 'Projet n°',
    wfModalStatusPrefix: 'Statut',
    wfModalManagingDescription: 'Gestion du flux de travail du projet',
    wfModalUnknownTabPrefix: 'Onglet inconnu',
    wfModalCompleteStepDefault: 'Compléter l\'étape',
    wfModalCompletePlanning: 'Compléter la planification',
    wfModalCompleteSubmissions: 'Compléter les soumissions',
    wfModalCompletePreWork: 'Compléter le pré-travail',
    wfModalCompleteWork: 'Compléter le travail',
    wfModalCompletePostWork: 'Compléter le post-travail',
    wfModalCompleteProject: 'Compléter le projet',
    wfModalTabPlannedLabel: 'Planifié',
    wfModalTabPlannedDesc: 'Planification du projet et calendrier',
    wfModalTabSubmissionLabel: 'Soumission',
    wfModalTabSubmissionDesc: 'Soumissions des fournisseurs et sélection',
    wfModalTabPreWorkLabel: 'Pré-travail',
    wfModalTabPreWorkDesc: 'Préparation et coordination',
    wfModalTabInProgressLabel: 'En cours',
    wfModalTabInProgressDesc: 'Exécution active du travail',
    wfModalTabPostWorkLabel: 'Post-travail',
    wfModalTabPostWorkDesc: 'Nettoyage et finalisation',
    wfModalTabCompletedLabel: 'Complété',
    wfModalTabCompletedDesc: 'Complétion et résumé du projet',
    wfPaymentSetupTitle: 'Configuration du plan de paiement',
    wfPaymentTypeLabel: 'Type de paiement',
    wfPaymentTypePlaceholder: 'Choisir le type de paiement',
    wfPaymentTypeSingle: 'Paiement unique',
    wfPaymentTypeRecurring: 'Paiements récurrents',
    wfPaymentScheduleLabel: 'Calendrier de paiement',
    wfPaymentSchedulePlaceholder: 'Sélectionner le calendrier de paiement',
    wfPaymentScheduleWeekly: 'Hebdomadaire',
    wfPaymentScheduleMonthly: 'Mensuel',
    wfPaymentScheduleQuarterly: 'Trimestriel',
    wfPaymentScheduleYearly: 'Annuel',
    wfPaymentScheduleCustom: 'Dates personnalisées',
    wfPaymentFirstDateLabel: 'Date du premier paiement',
    wfPaymentCustomDatesLabel: 'Dates de paiement personnalisées',
    wfPaymentAddDateButton: 'Ajouter une date',
    wfPaymentHasInitialLabel: 'A un paiement initial',
    wfPaymentInitialAmountLabel: 'Montant du paiement initial',
    wfPaymentEqualLabel: 'Paiements récurrents égaux',
    wfPaymentRecurringAmountLabel: 'Montant du paiement récurrent',
    wfPaymentAmountsLabel: 'Montants des paiements',
    wfPaymentDistributeButton: 'Distribuer également',
    wfPaymentAddPaymentButton: 'Ajouter un paiement',
    wfPaymentNumberPrefix: 'Paiement',
    wfPaymentSummaryLabel: 'Résumé du paiement',
    wfPaymentSummarySingle: 'Paiement unique',
    wfPaymentSummaryWithInitialSuffix: ' avec paiement initial',
    wfPaymentSummaryEqualMiddle: 'paiements récurrents égaux',
    wfPaymentSummaryPlusInitialSuffix: ' + paiement initial',
    wfPaymentSummaryCustomSingular: 'paiement personnalisé',
    wfPaymentSummaryCustomPlural: 'paiements personnalisés',
    wfPaymentOver: 'Au-dessus',
    wfPaymentUnder: 'En dessous',
    wfPaymentBy: 'de',
    wfPaymentSavePlanButton: 'Enregistrer le plan de paiement',
    wfElementsManagementTitle: 'Gestion des éléments',
    wfElementsLoading: 'Chargement des éléments...',
    wfElementsFilteringByPrefix: 'Filtrage par :',
    wfElementsResultsSuffix: 'résultats',
    wfElementsAvailableTitle: 'Éléments de bâtiment disponibles',
    wfElementsFilteredBySuffix: 'Filtré par',
    wfElementsAddSelectedButton: 'Ajouter la sélection',
    wfElementsProjectTitle: 'Éléments du projet',
    wfElementsDeselectAllButton: 'Tout désélectionner',
    wfElementsSelectAllButton: 'Tout sélectionner',
    wfElementsBulkActionsButton: 'Actions en lot',
    wfElementsNoMatchPrefix: 'Aucun élément trouvé correspondant à',
    wfElementsNoMatchTitle: 'Aucun élément ne correspond à votre recherche.',
    wfElementsTryDifferent: 'Essayez différents termes de recherche.',
    wfElementsUnknownElement: 'Élément inconnu',
    wfElementsProjectTypeFieldLabel: 'Type de projet :',
    wfElementsBulkActionDescPrefix: 'Choisir une action pour',
    wfElementsBulkActionDescSuffix: 'éléments sélectionnés',
    wfElementsChangeTypeOption: 'Changer le type de projet',
    wfElementsRemoveOption: 'Retirer les éléments du projet',
    wfElementsSelectNewTypeLabel: 'Sélectionner le nouveau type de projet :',
    wfElementsSelectTypePlaceholder: 'Sélectionner le type de projet',
    wfElementsWarningLabel: 'Avertissement',
    wfElementsRemoveButton: 'Retirer les éléments',
    wfElementsUpdateTypeButton: 'Mettre à jour le type de projet',
    wfElementsCompletingButton: 'Complétion en cours...',
    wfElementsCompleteSubmissionButton: 'Compléter la phase de soumission',
    wfElementsNextLabel: 'Suivant',
    wfElementsTypeRepairLabel: 'Réparation',
    wfElementsTypeRepairDesc: 'Réparer les composants existants',
    wfElementsTypeMinorRehabLabel: 'Réhabilitation mineure',
    wfElementsTypeMinorRehabDesc: 'Améliorations mineures',
    wfElementsTypeMajorRehabLabel: 'Réhabilitation majeure',
    wfElementsTypeMajorRehabDesc: 'Rénovations importantes',
    wfElementsTypeReplacementLabel: 'Remplacement',
    wfElementsTypeReplacementDesc: 'Remplacement complet du composant',
    wfElementsTypeAssessmentLabel: 'Évaluation requise',
    wfElementsTypeAssessmentDesc: 'Nécessite une évaluation',
    wfNavLoading: 'Chargement de la navigation du flux de travail...',
    wfNavWorkflowProgress: 'Progression du flux de travail',
    wfNavBadgeComplete: 'Complété',
    wfNavBadgeInProgress: 'En cours',
    wfNavCurrent: 'Actuel',

    // Task #736 — Inventory & Projects translations (Bill 101 parity)
    ehfAddMaintenanceHistoryTitle: 'Ajouter un historique d\'entretien',
    ehfEditMaintenanceHistoryTitle: 'Modifier l\'historique d\'entretien',
    ehfEditModeBadge: 'Mode édition',
    ehfRecordWorkPrefix: 'Enregistrer les travaux d\'entretien effectués sur',
    ehfUpdateEntryDescription: 'Mettre à jour les détails de l\'entrée d\'historique d\'entretien',
    ehfEventTypeLabel: 'Type d\'événement',
    ehfEventTypePlaceholder: 'Sélectionner un type d\'événement',
    ehfEventTypeOriginalConstruction: 'Construction d\'origine',
    ehfEventTypeOriginalConstructionDesc: 'Construction ou installation initiale',
    ehfEventTypeRepair: 'Réparation',
    ehfEventTypeRepairDesc: 'Remettre en état de fonctionnement',
    ehfEventTypeMinorRehab: 'Réhabilitation mineure',
    ehfEventTypeMinorRehabDesc: 'Améliorations ou restauration mineures',
    ehfEventTypeMajorRehab: 'Réhabilitation majeure',
    ehfEventTypeMajorRehabDesc: 'Rénovation ou restauration importante',
    ehfEventTypeReplacement: 'Remplacement',
    ehfEventTypeReplacementDesc: 'Remplacement complet de l\'élément',
    ehfLifespanExtensionBadgeSuffix: 'années de prolongation de durée de vie',
    ehfEventDateLabel: 'Date de l\'événement',
    ehfSelectDate: 'Sélectionner une date',
    ehfCostLabel: 'Coût',
    ehfWorkDescriptionLabel: 'Description des travaux',
    ehfWorkDescriptionPlaceholder: 'Décrivez les travaux d\'entretien effectués, les matériaux utilisés et tout détail spécifique...',
    ehfVendorInformationHeading: 'Renseignements sur le fournisseur',
    ehfVendorLabel: 'Fournisseur',
    ehfVendorSelectPlaceholder: 'Sélectionner un fournisseur',
    ehfNoVendorInternalWork: 'Aucun fournisseur (travaux internes)',
    ehfVendorNameLabel: 'Nom du fournisseur',
    ehfVendorNameDesc: 'Ou saisir le nom du fournisseur manuellement',
    ehfVendorNamePlaceholder: 'Saisir le nom du fournisseur',
    ehfWarrantyInformationHeading: 'Renseignements sur la garantie',
    ehfWarrantyDurationLabel: 'Durée de la garantie (mois)',
    ehfWarrantyTermsLabel: 'Conditions de la garantie',
    ehfWarrantyTermsPlaceholder: 'Garantie pièces et main-d\'œuvre',
    ehfWarrantyExpiresLabel: 'La garantie expire :',
    ehfLifespanImpactHeading: 'Impact sur la durée de vie',
    ehfAutoCalculate: 'Calcul automatique',
    ehfLifespanExtensionLabel: 'Prolongation de la durée de vie (années)',
    ehfAdditionalNotesLabel: 'Notes supplémentaires',
    ehfNotesPlaceholder: 'Notes supplémentaires, observations ou recommandations futures...',
    ehfCancel: 'Annuler',
    ehfCreating: 'Création en cours...',
    ehfSaving: 'Enregistrement en cours...',
    ehfCreate: 'Créer',
    ehfSaveChanges: 'Enregistrer les modifications',

    ihdrBackToBuildingButton: 'Retour au bâtiment',
    ihdrPageTitle: 'Inventaire — Éléments du bâtiment',
    ihdrAddElement: 'Ajouter un élément',
    ihdrSearchPlaceholder: 'Rechercher des éléments par nom, code UNIFORMAT ou description...',
    ihdrFilters: 'Filtres',
    ihdrOverdueLabel: 'En retard',
    ihdrOverdueEvaluations: 'Évaluations en retard',
    ihdrConditionLabel: 'État',
    ihdrAllConditionsPlaceholder: 'Tous les états',
    ihdrAllConditionsItem: 'Tous les états',
    ihdrConditionExcellent: 'Excellent',
    ihdrConditionGood: 'Bon',
    ihdrConditionFair: 'Passable',
    ihdrConditionPoor: 'Mauvais',
    ihdrConditionCritical: 'Critique',
    ihdrUniformatCategoryLabel: 'Catégorie UNIFORMAT',
    ihdrAllCategoriesPlaceholder: 'Toutes les catégories',
    ihdrAllCategoriesItem: 'Toutes les catégories',
    ihdrUniformatA: 'A — Infrastructure',
    ihdrUniformatB: 'B — Enveloppe',
    ihdrUniformatC: 'C — Intérieurs',
    ihdrUniformatD: 'D — Services',
    ihdrUniformatE: 'E — Équipements et mobilier',
    ihdrUniformatF: 'F — Constructions spéciales',
    ihdrUniformatG: 'G — Aménagement du site',
    ihdrEvaluationStatusLabel: 'État d\'évaluation',
    ihdrFilterOverdue: 'En retard',
    ihdrFilterDueSoon: 'Bientôt dû',
    ihdrFilterUpToDate: 'À jour',

    ubCatalogTitle: 'Catalogue UNIFORMAT II',
    ubCommonButton: 'Courants',
    ubSearchPlaceholder: 'Rechercher des codes, noms ou descriptions...',
    ubAllLevelsPlaceholder: 'Tous les niveaux',
    ubAllLevelsItem: 'Tous les niveaux',
    ubLevelLabel: 'Niveau',
    ubAllCategoriesPlaceholder: 'Toutes les catégories',
    ubAllCategoriesItem: 'Toutes les catégories',
    ubCommonBadge: 'Courant',
    ubFilteredResultsPrefix: 'Filtré :',
    ubFilteredResultsSuffix: 'résultats',
    ubNoMatchingCodes: 'Aucun code ne correspond aux filtres actuels',
    ubNoCodesAvailable: 'Aucun code UNIFORMAT disponible',
    ubFailedToLoad: 'Échec du chargement des codes UNIFORMAT',
    ubLoadErrorDesc: 'Une erreur est survenue lors du chargement du catalogue',
    ubYearsSuffix: 'ans',

    pcTypeEvaluation: 'Évaluation',
    pcTypeRepair: 'Réparation',
    pcTypeMinorRehab: 'Réhab. mineure',
    pcTypeMajorRehab: 'Réhab. majeure',
    pcTypeReplacement: 'Remplacement',
    pcOverdueBadge: 'En retard',
    pcOverBudgetBadge: 'Dépassement du budget',
    pcCriticalPriorityBadge: 'Priorité critique',
    pcOpenMenu: 'Ouvrir le menu',
    pcQuickActionsLabel: 'Actions rapides',
    pcEditProject: 'Modifier le projet',
    pcViewTimeline: 'Voir l\'échéancier',
    pcAddNotes: 'Ajouter des notes',
    pcStartWork: 'Démarrer les travaux',
    pcCompleteWork: 'Terminer les travaux',
    pcUpdatedPrefix: 'Mis à jour le',
    pcDaysOverdueSuffix: 'jours de retard',
    pcDaysRemainingSuffix: 'jours restants',
    pcProgressLabel: 'Progression',
    pcStartDateLabel: 'Date de début',
    pcEndDateLabel: 'Date de fin',
    pcBudgetLabel: 'Budget',
    pcBudgetUsedSuffix: ' % utilisé',
    pcElementsLabel: 'Éléments',
    pcElementsAssignedSuffix: 'assignés',
    pcBuildingComponents: 'Composants du bâtiment',
    pcStatusUpdatedTitle: 'Statut mis à jour',
    pcStatusUpdatedDesc: 'Le statut du projet a été mis à jour avec succès.',
    pcUpdateFailedTitle: 'Échec de la mise à jour',
    pcUpdateFailedDesc: 'Échec de la mise à jour du statut du projet. Veuillez réessayer.',

    emcEditElementLabel: 'Modifier l\'élément',
    emcEditButton: 'Modifier',
    emcBuiltLabel: 'Construit',
    emcLastInspectionLabel: 'Dernière inspection',
    emcAgeLifespanLabel: 'Âge / Durée de vie',
    emcLifespanProgressSuffix: ' % de la durée de vie prévue',
    emcConstructionLabel: 'Construction',
    emcUnknown: 'Inconnu',
    emcNever: 'Jamais',
    emcNextEvaluationLabel: 'Prochaine évaluation',
    emcOverdueBadge: 'En retard',
    emcDueSoonBadge: 'Bientôt dû',
    emcScheduledBadge: 'Prévu',
    emcTotalCostLabel: 'Coût total',
    emcCostPerYearAvgSuffix: '/année (moy.)',
    emcActivityLabel: 'Activité',
    emcEntriesSuffix: 'entrées',
    emcDocumentsSuffix: 'documents',
    emcTimelineButton: 'Échéancier',
    emcYearsSuffix: 'ans',
    emcExpectedLifespanSuffix: 'de la durée de vie prévue',
    emcPhotoAltSuffix: 'photo',

    etElementColumn: 'Élément',
    etConditionColumn: 'État',
    etAgeLifespanColumn: 'Âge / Durée de vie',
    etLastInspectionColumn: 'Dernière inspection',
    etNextEvaluationColumn: 'Prochaine évaluation',
    etActionsColumn: 'Actions',
    etYearsSuffix: 'ans',
    etNeverBadge: 'Jamais',
    etOverdueBadge: 'En retard',
    etDueSoonBadge: 'Bientôt dû',
    etScheduledBadge: 'Prévu',
    etNotSetBadge: 'Non défini',
    etNotScheduledBadge: 'Non prévu',
    etViewButton: 'Voir',
    etEditButton: 'Modifier',
    etSelectAllAria: 'Sélectionner tous les éléments',
    etSelectElementAria: 'Sélectionner l\'élément',
    etElementsSelectedSuffix: 'élément(s) sélectionné(s)',
    etBulkEditButton: 'Actions groupées',
    etChangeResidenceItem: 'Changer la résidence',
    etUpdateCostItem: 'Mettre à jour le coût de remplacement',
    etDeleteSelectedItem: 'Supprimer la sélection',
    etConfirmBulkDelete: 'Voulez-vous vraiment supprimer les éléments sélectionnés? Cette action est irréversible.',
    etElementsDeletedTitle: 'Éléments supprimés',
    etElementsDeletedDescPrefix: 'Suppression réussie de',
    etElementsDeletedDescSuffix: 'élément(s).',
    etPartiallyCompletedTitle: 'Partiellement complété',
    etPartiallyCompletedDesc: 'Certains éléments n\'ont pas pu être supprimés.',
    etDeleteFailedTitle: 'Échec de la suppression',
    etDeleteFailedDesc: 'Échec de la suppression des éléments sélectionnés.',
    etElementDeletedTitle: 'Élément supprimé',
    etElementDeletedDesc: 'L\'élément a été retiré de l\'inventaire.',
    etDeleteFailedSingleTitle: 'Échec de la suppression',
    etDeleteFailedSingleDesc: 'Échec de la suppression de l\'élément.',
    etFailedToLoadTitle: 'Échec du chargement des éléments',
    etFailedToLoadDesc: 'Un problème est survenu lors du chargement de l\'inventaire.',
    etLoadingMessage: 'Chargement des éléments...',
    etNoElementsFoundTitle: 'Aucun élément trouvé',

    htDateColumn: 'Date',
    htEventTypeColumn: 'Événement',
    htDescriptionColumn: 'Description',
    htVendorColumn: 'Fournisseur',
    htCostColumn: 'Coût',
    htWarrantyColumn: 'Garantie',
    htInternalLabel: 'Interne',
    htNoCostLabel: 'Aucun coût',
    htWarrantyNoneLabel: 'Aucune',
    htWarrantyYearSuffix: 'année',
    htWarrantyYearsSuffix: 'années',
    htWarrantyUntilPrefix: 'Jusqu\'au',
    htOpenMenu: 'Ouvrir le menu',
    htEditEntry: 'Modifier l\'entrée',
    htViewDocuments: 'Voir les documents',
    htDeleteEntry: 'Supprimer l\'entrée',
    htDeleteHistoryTitle: 'Supprimer l\'entrée d\'historique?',
    htCancelButton: 'Annuler',
    htDeleteButton: 'Supprimer',
    htTotalCostLabel: 'Coût total',
    htCostPerYearAvgSuffix: '/année (moy.)',
    htLifespanExtensionLabel: 'Prolongation de la durée de vie',
    htLifespanFromInterventionsPrefix: 'Provenant de',
    htLifespanFromInterventionsSuffix: 'interventions',
    htLastMaintenanceLabel: 'Dernier entretien',
    htLastMaintenanceNever: 'Jamais',
    htWorkEventsLabel: 'Événements de travaux',
    htMaintenanceHistoryTitle: 'Historique d\'entretien',
    htMaintenanceHistoryDescPrefix: 'Historique complet pour',
    htSearchPlaceholder: 'Rechercher dans l\'historique...',
    htNoHistoryTitle: 'Aucun historique d\'entretien',
    htNoHistoryDesc: 'Aucun travail d\'entretien n\'a encore été enregistré pour cet élément.',
    htReturnToInventory: 'Retour à l\'inventaire',
    htHistoryEntryDeletedTitle: 'Entrée d\'historique supprimée',
    htHistoryEntryDeletedDesc: 'L\'entrée d\'historique d\'entretien a été retirée.',
    htDeleteFailedTitle: 'Échec de la suppression',
    htDeleteFailedDesc: 'Échec de la suppression de l\'entrée d\'historique.',
    htFailedToLoadTitle: 'Échec du chargement de l\'historique',
    htFailedToLoadDesc: 'Un problème est survenu lors du chargement de l\'historique d\'entretien.',
    htConstructionEventLabel: 'Construction',
    htRepairEventLabel: 'Réparation',
    htMinorRehabEventLabel: 'Réhab. mineure',
    htMajorRehabEventLabel: 'Réhab. majeure',
    htReplacementEventLabel: 'Remplacement',
    htAuditDialogTitle: 'Historique des modifications',
    htAuditEditorLabel: 'Éditeur',
    htAuditTimestampLabel: 'Horodatage',
    htAuditSystemEditor: 'Système',
    htAuditEmptyState: 'Aucune modification enregistrée',
    htAuditEmptyStateDetail: 'Cette entrée a été modifiée avant la mise en place du suivi des modifications, ou a été modifiée directement dans la base de données.',
    htAuditLoadError: 'Échec du chargement de l\'historique des modifications',
    htAuditRetry: 'Réessayer',
    htAuditFieldEventType: 'Type d\'événement',
    htAuditFieldEventDate: 'Date de l\'événement',
    htAuditFieldWorkDescription: 'Description des travaux',
    htAuditFieldCost: 'Coût',
    htAuditFieldVendor: 'Fournisseur',
    htAuditFieldLifespanImpact: 'Impact sur la durée de vie',
    htAuditFieldWarranty: 'Garantie',
    htAuditValueNotSet: '—',
    htAuditBeforeLabel: 'Avant',
    htAuditAfterLabel: 'Après',
    htAuditEditedIndicator: 'modifié',
    htAuditViewChanges: 'Voir les modifications',
    htAuditFieldColumnHeader: 'Champ',

    edpEditAction: 'Modifier',
    edpUploadFilesAction: 'Téléverser des fichiers',
    edpScheduleAction: 'Planifier l\'évaluation',
    edpDeleteAction: 'Supprimer',
    edpDeleteDialogTitle: 'Supprimer cet élément?',
    edpDeleteDialogConfirmCancel: 'Annuler',
    edpDeletingProgress: 'Suppression...',
    edpOverviewTab: 'Aperçu',
    edpDocumentsTab: 'Documents',
    edpProjectsTab: 'Projets',
    edpStatusEvaluationTitle: 'Statut et évaluation',
    edpCurrentConditionLabel: 'État actuel',
    edpNextEvaluationLabel: 'Prochaine évaluation',
    edpLastInspectionLabel: 'Dernière inspection',
    edpLastInspectionNever: 'Jamais',
    edpUrgencyOverdueLabel: 'En retard',
    edpUrgencyDueSoonLabel: 'Bientôt dû',
    edpUrgencyScheduledLabel: 'Prévu',
    edpUrgencyNotScheduledLabel: 'Non prévu',
    edpLifespanAnalysisTitle: 'Analyse de la durée de vie',
    edpAgeProgressLabel: 'Âge vs durée de vie prévue',
    edpYearsSuffix: 'ans',
    edpNearingEndLifespan: 'Approche de la fin de la durée de vie prévue',
    edpAgingMonitor: 'Vieillissant — surveiller de près',
    edpGoodRemaining: 'Bonne durée de vie restante',
    edpOriginalLifespanLabel: 'Durée de vie d\'origine',
    edpCurrentLifespanLabel: 'Durée de vie actuelle',
    edpConstructionDateLabel: 'Date de construction',
    edpSpecificationsTitle: 'Spécifications',
    edpQuantityLabel: 'Quantité',
    edpUniformatCodeLabel: 'Code UNIFORMAT',
    edpNotesLabel: 'Notes',
    edpUnknownSize: 'Taille inconnue',
    edpNoDocumentsUploaded: 'Aucun document téléversé pour le moment.',
    edpProjectNumberPrefix: 'Projet',
    edpNoRelatedProjects: 'Aucun projet associé.',
    edpElementDeletedToastTitle: 'Élément supprimé',
    edpElementDeletedToastDesc: 'L\'élément a été retiré.',

    iovHeaderTitle: 'Aperçu de l\'inventaire',
    iovToggleSrText: 'Basculer le mode édition du bâtiment',
    iovBuildingConstructionDate: 'Date de construction du bâtiment',
    iovDefaultForNewElements: 'Utilisée par défaut pour les nouveaux éléments sans date de construction explicite.',
    iovTotalElementsTitle: 'Total des éléments',
    iovBuildingInventoryItems: 'Articles d\'inventaire du bâtiment',
    iovCriticalAlertsTitle: 'Alertes critiques',
    iovPoorOrCriticalCondition: 'État mauvais ou critique',
    iovOverdueEvaluationsTitle: 'Évaluations en retard',
    iovPastDueDate: 'Date dépassée',
    iovAssetValueTitle: 'Valeur des actifs',
    iovEstimatedReplacementCost: 'Coût de remplacement estimé',
    iovConditionBreakdownTitle: 'Répartition des états',
    iovQuickStatisticsTitle: 'Statistiques rapides',
    iovKeyInsightsTrends: 'Aperçus et tendances clés',
    iovAverageAgeLabel: 'Âge moyen',
    iovYearsSuffix: 'ans',
    iovDueSoonLabel: 'Bientôt dû',
    iovMostCommonCategoryLabel: 'Catégorie la plus courante',
    iovBuildingUpdatedTitle: 'Bâtiment mis à jour',
    iovBuildingUpdatedDesc: 'La date de construction a été enregistrée.',
    iovInvalidDateTitle: 'Date invalide',
    iovInvalidDateDesc: 'Veuillez saisir une date valide.',
    iovInvalidDateRangeDesc: 'La date doit être comprise entre 1800 et aujourd\'hui.',
    iovConditionExcellent: 'Excellent',
    iovConditionGood: 'Bon',
    iovConditionFair: 'Passable',
    iovConditionPoor: 'Mauvais',
    iovConditionCritical: 'Critique',
    // i18n migration (task 729): FR strings for previously-untranslated JSX text.
    pwdDoesNotMeetRequirements: 'Le mot de passe ne respecte pas les exigences de sécurité.',
    pwdSecTipUseUniqueCombination: 'Utilisez une combinaison unique de lettres, chiffres et symboles',
    pwdSecTipAvoidPersonalInfo: 'Évitez les informations personnelles (nom, date de naissance)',
    pwdSecTipDoNotReuse: 'Ne réutilisez pas un mot de passe d\'un autre compte',
    pwdSecTipUsePasswordManager: 'Considérez l\'utilisation d\'un gestionnaire de mots de passe',
    pcsCompleteToFinalizeRegistration: 'Complétez votre profil pour finaliser votre inscription et accéder aux services de gestion immobilière.',
    qpcLaw25Heading: 'Protection des renseignements personnels (Loi 25 - Québec) :',
    qpcConsentRequiredText: ' Votre consentement est requis pour la collecte et l\'utilisation de vos données personnelles.',
    qpcMasterAcceptAllText: 'J\'accepte tous les types de collecte et traitement de données (essentielles et optionnelles).',
    qpcEssentialDataLabel: 'Collecte des données essentielles (Requis) *',
    qpcEssentialDataDesc: 'Authentification, communication, gestion de compte, services de gestion immobilière.',
    qpcMarketingDesc: 'Communications promotionnelles, nouvelles fonctionnalités, offres spéciales.',
    qpcAnalyticsDesc: 'Données d\'utilisation anonymisées pour améliorer les services.',
    qpcThirdPartyDesc: 'Cartographie, notifications, stockage pour améliorer l\'expérience.',
    qpcAcknowledgeRightsLabel: 'Reconnaissance de mes droits (Requis) *',
    qpcAcknowledgeRightsDesc: 'J\'ai été informé(e) de mes droits concernant mes renseignements personnels et je comprends que je peux exercer ces droits à tout moment.',
    qpcCheckboxRequiredWarning: '⚠️ Cette case doit être cochée pour continuer.',
    qpcRightsHeading: '📋 Vos droits selon la Loi 25 du Québec',
    qpcPortabilityDesc: ' Récupérer vos données dans un format lisible',
    qpcContactPara: 'Pour exercer vos droits ou pour toute question concernant vos données personnelles, contactez notre responsable de la protection des données :',
    qpcSecurityDesc: ' Vos données sont chiffrées et stockées sur des serveurs sécurisés au Canada',
    qpcRetentionDesc: ' Vos données sont conservées selon les exigences légales québécoises',
    qpcTransparencyDesc: ' Consultez notre politique de confidentialité complète à tout moment',
    tvsValidatingInvitationDesc: 'Vérification du token d\'invitation et des détails associés...',
    tvsNoTokenFoundDesc: 'Aucun token d\'invitation valide n\'a été trouvé. Veuillez utiliser le lien d\'invitation reçu par email.',
    tvsCannotValidateInvitation: 'Impossible de valider l\'invitation',
    tvsLinkExpiredOrInvalid: 'Le lien d\'invitation peut être expiré, invalide ou déjà utilisé.',
    tvsCheckUseFullLink: 'Vérifiez que vous utilisez le lien complet reçu par email',
    tvsCheckNotExpired: 'Assurez-vous que l\'invitation n\'est pas expirée',
    tvsContactAdminIfPersists: 'Contactez l\'administrateur si le problème persiste',
    tvsInvitationValidProceed: 'Invitation valide ! Vous pouvez procéder à la création de votre compte.',
    ffBusinessObjectivePlaceholder: 'Quel problème cette fonctionnalité résout-elle ? Quelle valeur d\'affaires apporte-t-elle ?',
    ffSuccessMetricsPlaceholder: 'Comment mesurerons-nous le succès ? Quels sont les indicateurs clés ?',
    ffTimelinePlaceholder: 'p. ex., 2 semaines, 1 mois, prochain sprint',
    ffDependenciesPlaceholder: 'De quelles autres fonctionnalités, API ou systèmes cela dépend-il ?',
    ffDataReqPlaceholder: 'Quelles données doivent être stockées, modifiées ou consultées ?',
    ffIntegrationNeedsPlaceholder: 'API externes, services ou intégrations tierces nécessaires',
    ffSecurityConsidPlaceholder: 'Authentification, autorisation, préoccupations de confidentialité des données',
    ffUserFlowPlaceholder: 'Décrivez l\'interaction utilisateur étape par étape avec cette fonctionnalité',
    ffUiReqPlaceholder: 'Composants UI spécifiques, mises en page ou exigences visuelles',
    ffAccessibilityPlaceholder: 'Support du lecteur d\'écran, navigation clavier, contraste des couleurs',
    ffPerfReqPlaceholder: 'Temps de chargement, vitesse de traitement, besoins en évolutivité',
    ffTestingStrategyPlaceholder: 'Tests unitaires, tests d\'intégration, critères d\'acceptation utilisateur',
    ffAdditionalNotesPlaceholder: 'Autres exigences, contraintes ou considérations',
    ffsFeatureNamePlaceholder: 'Comment cette fonctionnalité s\'appelle-t-elle ?',
    ffsFeatureDescPlaceholder: 'Décrivez ce que fait cette fonctionnalité et pourquoi elle est nécessaire',
    ffsBusinessObjectivePlaceholder: 'Quel problème d\'affaires cela résout-il ? Quelle valeur cela apporte-t-il ?',
    ffsTargetUsersPlaceholder: 'Qui utilisera cette fonctionnalité ? (Admins, Gestionnaires, Locataires, Résidents)',
    ffsSuccessMetricsPlaceholder: 'Comment mesurerons-nous le succès de cette fonctionnalité ?',
    ffsTimelinePlaceholder: 'Quand cela doit-il être terminé ?',
    ffsDependenciesPlaceholder: 'De quelles autres fonctionnalités, API ou systèmes cela dépend-il ?',
    ffsDataReqPlaceholder: 'Quelles données doivent être stockées, modifiées ou consultées ?',
    ffsIntegrationNeedsPlaceholder: 'API externes, services ou intégrations tierces nécessaires',
    ffsSecurityConsidPlaceholder: 'Authentification, autorisation, préoccupations de confidentialité des données',
    ffsUserFlowPlaceholder: 'Décrivez l\'interaction utilisateur étape par étape avec cette fonctionnalité',
    ffsUiReqPlaceholder: 'Composants UI spécifiques, mises en page ou exigences visuelles',
    ffsAccessibilityPlaceholder: 'Support du lecteur d\'écran, navigation clavier, contraste des couleurs',
    ffsPerfReqPlaceholder: 'Temps de chargement, vitesse de traitement, besoins en évolutivité',
    ffsTestingStrategyPlaceholder: 'Tests unitaires, tests d\'intégration, critères d\'acceptation utilisateur',
    ffsAdditionalNotesPlaceholder: 'Toute autre information importante, contraintes ou contexte',
    apcDismissReasonPlaceholder: 'Indiquez la raison du rejet de ce projet...',
    apdPlanningDescPlaceholder: 'Description détaillée de la planification du projet...',
    ehfWorkDescPlaceholder: 'Décrivez le travail de maintenance effectué, les matériaux utilisés et tout détail spécifique...',
    vfNotesPlaceholder: 'Notes additionnelles sur ce fournisseur, ses spécialités, la qualité du service, etc.',
    permSearchPlaceholder: 'Rechercher des permissions par nom, description ou type de ressource...',
    fpEmailSentTitle: 'E-mail envoyé',
    fpEmailSentDesc: 'Si votre adresse e-mail est dans notre système, vous recevrez un lien de réinitialisation du mot de passe dans quelques minutes.',
    fpCheckSpamFolder: 'N\'oubliez pas de vérifier votre dossier de courrier indésirable.',
    fpEnterEmailToReceiveLink: 'Entrez votre adresse e-mail pour recevoir un lien de réinitialisation du mot de passe',
    fpSendSecureResetLinkDesc: 'Nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe',
    iaWelcomeAccountCreated: 'Bienvenue {firstName} {lastName} ! Votre compte a été créé avec succès.',
    iaCanLoginWithEmailPassword: 'Vous pouvez maintenant vous connecter avec votre e-mail et votre mot de passe',
    iaConsentsRecordedLaw25: 'Vos consentements ont été enregistrés conformément à la Loi 25 du Québec. Vous pouvez exercer vos droits à tout moment en contactant notre équipe.',
    iaCompleteRegistrationToJoin: 'Complétez votre inscription pour rejoindre la plateforme Koveo Gestion',
    iaTermsAcceptanceFooter: 'En vous inscrivant, vous acceptez nos conditions d\'utilisation et notre politique de confidentialité conforme à la Loi 25 du Québec.',
    rpResetCompleteDesc: 'Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
    rpInvalidLinkDesc: 'Le lien de réinitialisation est invalide ou manquant.',
    budgetReserveFundExamplePlaceholder: 'p. ex., Fonds de réserve, Tampon de maintenance, Réserve d\'investissement',
    dtSuggestedProsLabel: 'Professionnels suggérés (séparés par des virgules)',
    dtSuggestedProsPlaceholder: 'Notaire, Avocat',
    dtPageTitle: 'Étiquettes de documents',
    dtPageSubtitle: 'Gestion des étiquettes Koveo et personnalisées',
    dtViewToggleTags: 'Étiquettes',
    dtViewToggleFamilies: 'Familles de liens',
    dtSectionHeading: 'Étiquettes',
    dtCreateButton: 'Nouvelle étiquette',
    dtSystemCardTitle: 'Étiquettes Koveo (système)',
    dtCustomCardTitle: 'Étiquettes personnalisées',
    dtColName: 'Nom',
    dtColScope: 'Portée',
    dtColImportance: 'Importance',
    dtColProfessionals: 'Professionnels',
    dtColActions: 'Actions',
    dtReadOnly: 'Lecture seule',
    dtLoading: 'Chargement…',
    dtEmpty: 'Aucune étiquette.',
    dtDialogEditTitle: 'Modifier l\'étiquette',
    dtDialogNewTitle: 'Nouvelle étiquette',
    dtNameLabel: 'Nom *',
    dtDescriptionLabel: 'Description',
    dtScopeLabel: 'Portée',
    dtImportanceLabel: 'Importance',
    dtScopeAny: 'Toute',
    dtScopeBuilding: 'Bâtiment',
    dtScopeResidence: 'Résidence',
    dtImportanceObligatoire: 'Obligatoire',
    dtImportanceNiceToHave: 'Recommandée',
    dtImportanceExtra: 'Extra',
    dtCancelButton: 'Annuler',
    dtSaveButton: 'Enregistrer',
    dtCreateSubmitButton: 'Créer',
    dtToastUpdatedTitle: 'Étiquette mise à jour',
    dtToastCreatedTitle: 'Étiquette créée',
    dtToastDeletedTitle: 'Étiquette supprimée',
    dtToastErrorTitle: 'Erreur',
    dtDeleteConfirm: 'Supprimer l\'étiquette « {name} » ?',
    dtNameRequired: 'Nom requis',
    dtKoveoTagLabel: 'Étiquette Koveo officielle — disponible pour toutes les organisations',
    dtKoveoTagHelper: 'Lorsqu\'activée, cette étiquette devient une étiquette système visible par toutes les organisations.',
    lfSectionHeading: 'Familles de liens',
    lfSectionDescription: 'Les familles de liens regroupent des documents en séquences de lecture indépendantes. Un document peut appartenir à plusieurs familles (ex. : Financier, AGA). Dans le visualiseur, ← / → navigue au sein de la famille active et ↑ / ↓ change de famille.',
    lfCreateButton: 'Nouvelle famille',
    lfSearchPlaceholder: 'Rechercher des familles…',
    lfSystemCardTitle: 'Familles Koveo',
    lfCustomCardTitle: 'Familles personnalisées',
    lfLoading: 'Chargement…',
    lfEmpty: 'Aucune famille pour le moment.',
    lfColName: 'Nom',
    lfColDescription: 'Description',
    lfColActions: 'Actions',
    lfDialogEditTitle: 'Modifier la famille de liens',
    lfDialogNewTitle: 'Nouvelle famille de liens',
    lfDialogDescription: 'Une famille de liens définit une séquence indépendante de documents navigable avec ← / →.',
    lfNameLabel: 'Nom',
    lfDescriptionLabel: 'Description',
    lfDescriptionPlaceholder: 'Description facultative…',
    lfKoveoFamilyLabel: 'Famille système Koveo',
    lfKoveoFamilyHelper: 'Les familles système sont générées par Koveo et visibles par toutes les organisations.',
    lfOrganizationLabel: 'Organisation',
    lfOrganizationPlaceholder: 'Sélectionner une organisation…',
    lfCreateSubmitButton: 'Créer',
    lfToastCreatedTitle: 'Famille créée',
    lfToastUpdatedTitle: 'Famille mise à jour',
    lfToastDeletedTitle: 'Famille supprimée',
    lfToastErrorTitle: 'Erreur',
    lfDeleteConfirm: 'Supprimer la famille « {name} » ?',
    sfNameSequence: 'Séquence',
    sfDescSequence: 'Ordre séquentiel général (ex. : historique de versions ou ordre de lecture)',
    sfNameFinancial: 'Finances',
    sfDescFinancial: 'Documents financiers liés en ordre chronologique (budgets, états financiers)',
    sfNameMeetingsAGA: 'Assemblées (AGA)',
    sfDescMeetingsAGA: 'Procès-verbaux d\'assemblées générales annuelles et documents connexes',
    sfNameContracts: 'Contrats',
    sfDescContracts: 'Contrats et avenants liés entre versions ou renouvellements',
    sfNameMaintenance: 'Entretien',
    sfDescMaintenance: 'Rapports d\'entretien, inspections et documents de suivi',
    sfNameDeclarationCopropriete: 'Déclaration de copropriété',
    sfDescDeclarationCopropriete: 'Versions et modifications de l\'acte constitutif inscrit au Registre foncier',
    sfNameReglementsImmeuble: 'Règlements de l\'immeuble',
    sfDescReglementsImmeuble: 'Adoption et modifications des règlements internes de l\'immeuble',
    sfNameCertificatLocalisation: 'Certificat de localisation',
    sfDescCertificatLocalisation: 'Certificats de localisation successifs délivrés pour l\'immeuble',
    sfNameEtudeFondsPrevoyance: 'Étude du fonds de prévoyance',
    sfDescEtudeFondsPrevoyance: 'Études quinquennales du fonds de prévoyance et mises à jour (Loi 16)',
    sfNameCarnetEntretien: 'Carnet d\'entretien',
    sfDescCarnetEntretien: 'Entrées et mises à jour du carnet d\'entretien officiel (Loi 16)',
    sfNameProcesVerbauxCA: 'Procès-verbaux du conseil d\'administration',
    sfDescProcesVerbauxCA: 'Procès-verbaux et résolutions du CA (distincte de la chaîne AGA)',
    sfNameAvisCoproprietaires: 'Avis aux copropriétaires',
    sfDescAvisCoproprietaires: 'Avis officiels : convocations, avis de cotisation, avis art. 1069, etc.',
    sfNameEtatsFinanciers: 'États financiers',
    sfDescEtatsFinanciers: 'États financiers annuels, missions d\'examen et rapports de vérification',
    sfNameBudgetsAnnuels: 'Budgets annuels',
    sfDescBudgetsAnnuels: 'Approbations et révisions du budget annuel',
    sfNameCotisationsSpeciales: 'Cotisations spéciales',
    sfDescCotisationsSpeciales: 'Cycle de vie d\'une cotisation spéciale : résolution → avis → quittances',
    sfNameAssurances: 'Assurances',
    sfDescAssurances: 'Renouvellements annuels de police d\'assurance et avenants',
    sfNameSinistres: 'Sinistres et réclamations',
    sfDescSinistres: 'Un sinistre de bout en bout : déclaration → expertises → règlement',
    sfNamePermisAutorisations: 'Permis et autorisations',
    sfDescPermisAutorisations: 'Permis municipaux et modifications liés à un projet',
    sfNameInspectionsImmeuble: 'Inspections de l\'immeuble',
    sfDescInspectionsImmeuble: 'Inspections périodiques : façade, toiture, garage, ascenseur, environnement',
    sfNameTravauxMajeurs: 'Travaux majeurs',
    sfDescTravauxMajeurs: 'Cycle complet : soumissions → contrat → avenants → décompte progressif → quittances',
    sfNameBaux: 'Baux',
    sfDescBaux: 'Renouvellements de bail par logement locatif (chaîne conforme TAL)',
    sfNameDossierCoproprietaire: 'Dossier de copropriétaire / locataire',
    sfDescDossierCoproprietaire: 'Historique documentaire par résident',
    sfNameMutationsVentes: 'Mutations et ventes',
    sfDescMutationsVentes: 'Documents liés à la vente d\'une unité : attestation art. 1069, état des charges, suivi notaire',
    sfNameProceduresJuridiques: 'Procédures juridiques',
    sfDescProceduresJuridiques: 'Cycle d\'un litige : mise en demeure → procédures → jugement → exécution',
    sfNameEvaluationsMunicipales: 'Évaluations municipales et taxes',
    sfDescEvaluationsMunicipales: 'Rôle d\'évaluation annuel et comptes de taxes',
    sfNameServicesPublics: 'Services publics',
    sfDescServicesPublics: 'Séries de factures récurrentes (Hydro, gaz, eau, télécom) par compte/compteur',
    linkFamilyLabel: 'Famille',
    linkFamilyPlaceholder: 'Sélectionner une famille…',
    linkFamilyNone: 'Aucune famille disponible',
    ihGlobalSearchPlaceholder: 'Rechercher des éléments par nom, code UNIFORMAT ou description...',
    pdvFailedToLoadDashboard: 'Échec du chargement des analyses du tableau de bord. Veuillez réessayer.',
    pdvSelectBuildingForDashboard: 'Veuillez sélectionner un immeuble pour consulter son tableau de bord de projets.',
    pdvAnalyticsInsightsSubtitle: 'Analyses, perspectives et indicateurs de performance pour la gestion des projets de maintenance',
    pdvProjectTrendsDesc: 'Tendances mensuelles de création et de complétion des projets',
    pdvBudgetTrendsDesc: 'Utilisation budgétaire planifiée par rapport au réel dans le temps',
    pdvOverdueProjectsAlert: '{count} projet(s) sont en retard et nécessitent une attention immédiate.',
    pdvExecSummaryDesc: 'Principales perspectives et recommandations pour la gestion du portefeuille de projets',
    pdpComprehensiveDetails: 'Détails complets du projet, calendrier, budget et outils de gestion',
    pdpFailedToLoadDetails: 'Échec du chargement des détails du projet. Veuillez réessayer.',
    pdpElementsAssociatedDesc: 'Éléments du bâtiment associés à ce projet',
    pdpElementMgmtFullView: 'Gestion des éléments disponible en vue complète',
    ptvFailedToLoadProjects: 'Échec du chargement des projets. Veuillez actualiser la page.',
    ptvSelectBuildingForProjects: 'Veuillez sélectionner un immeuble pour consulter ses projets de maintenance.',
    ptvNoProjectsCreated: 'Aucun projet de maintenance n\'a encore été créé pour cet immeuble.',
    ptvGetStartedSuggestion: 'Commencez en créant votre premier projet ou en générant des projets à partir des suggestions d\'évaluation.',
    ptvNoProjectsMatchFilters: 'Aucun projet ne correspond à vos critères de recherche et de filtre actuels.',
    ptvAdjustFiltersHint: 'Essayez d\'ajuster vos filtres ou termes de recherche.',
    ptvRealTimeBulkActionsHint: 'Les données des projets sont mises à jour en temps réel. Utilisez les actions groupées pour gérer plusieurs projets à la fois.',
    ptlvFailedToLoadTimeline: 'Échec du chargement des données du calendrier. Veuillez actualiser la page.',
    ptlvSelectBuildingForTimeline: 'Veuillez sélectionner un immeuble pour consulter son calendrier de projets.',
    ptlvScheduleOverviewSubtitle: 'Aperçu de l\'horaire et suivi des jalons pour tous les projets',
    ptlvClickDateForEvents: 'Cliquez sur une date pour voir les événements planifiés',
    ptlvOverdueEventsAlertSingular: '{count} événement de projet est en retard. Examinez les calendriers de projets et envisagez d\'ajuster les délais ou de réallouer des ressources.',
    ptlvOverdueEventsAlertPlural: '{count} événements de projets sont en retard. Examinez les calendriers de projets et envisagez d\'ajuster les délais ou de réallouer des ressources.',
    povFailedToLoadMetrics: 'Échec du chargement des indicateurs de projets. Veuillez actualiser la page.',
    povConsiderReviewingPortfolio: 'Envisagez de revoir le portefeuille de projets et l\'allocation des ressources.',
    siReviewAndSelectDesc: 'Examinez et sélectionnez les suggestions d\'évaluation pour créer automatiquement des projets de maintenance. Les projets seront générés avec des workflows standards et pourront être personnalisés après leur création.',
    siFailedToLoadSuggestions: 'Échec du chargement des suggestions. Veuillez réessayer.',
    siProjectDefaultsDesc: 'Définir les valeurs par défaut pour tous les projets générés',
    confidenceBandHigh: 'Élevée',
    confidenceBandMedium: 'Moyenne',
    confidenceBandLow: 'Faible',
    confidenceAiNotRun: 'IA non exécutée',
    confidenceLowTooltip: 'Confiance de l\'IA : {pct}. L\'IA a retourné un score faible — vérifiez ce fichier. Aucun fichier n\'est exclu automatiquement selon la confiance.',
    confidenceDefaultTooltip: 'Confiance de l\'IA : {pct}. Aucun fichier n\'est exclu automatiquement — un score faible signifie « à vérifier », pas « à rejeter ».',
    confidenceAiNotRunTooltip: 'L\'IA n\'a pas pu analyser ce fichier. Aucun fichier n\'est exclu automatiquement selon la confiance — un score faible signifie « à vérifier », pas « à rejeter ».',
    aiUnavailableNoApiKey: 'L\'analyseur IA n\'est pas configuré sur ce déploiement. Tous les documents recevront un score de confiance générique de 20 % basé uniquement sur le nom du fichier — aucune analyse réelle n\'est effectuée.',
    aiUnavailableMisconfigured: 'La clé API Anthropic est configurée, mais semble invalide, ou le nom du modèle demandé n\'est pas reconnu. Tous les documents recevront un score de confiance générique de 20 % jusqu\'à ce que les paramètres de déploiement soient corrigés.',
    residenceUnitsLoadError: 'Échec du chargement des résidences. Actualisez et réessayez.',
  }
};