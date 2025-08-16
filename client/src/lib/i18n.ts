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
  error: string;
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
    availableAfterQACompletion: 'Available after QA pillar completion',
    developmentConsole: 'Development Console',
    accessDenied: 'Access Denied',
    accessDeniedDescription: 'You do not have sufficient permissions to access this resource. Please contact your administrator or property manager to request the necessary permissions.',
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
    error: 'Error',
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
    availableAfterQACompletion: "Disponible après l'achèvement du pilier AQ",
    developmentConsole: 'Console de développement',
    accessDenied: 'Accès refusé',
    accessDeniedDescription: 'Vous ne disposez pas des permissions suffisantes pour accéder à cette ressource. Veuillez contacter votre administrateur ou gestionnaire immobilier pour demander les permissions nécessaires.',
    // User management
    activateUsers: 'Activer les utilisateurs',
    activateSelectedUsers: 'Activer les utilisateurs sélectionnés',
    deactivateUsers: 'Désactiver les utilisateurs',
    deactivateSelectedUsers: 'Désactiver les utilisateurs sélectionnés',
    changeRole: 'Changer le rôle',
    changeRoleSelectedUsers: 'Changer le rôle des utilisateurs sélectionnés',
    sendPasswordReset: 'Envoyer réinitialisation mot de passe',
    sendPasswordResetSelectedUsers: 'Envoyer réinitialisation de mot de passe aux utilisateurs sélectionnés',
    sendWelcomeEmail: 'Envoyer courriel de bienvenue',
    sendWelcomeEmailSelectedUsers: 'Envoyer courriel de bienvenue aux utilisateurs sélectionnés',
    exportUsers: 'Exporter les utilisateurs',
    exportSelectedUsersData: 'Exporter les données des utilisateurs sélectionnés',
    deleteUsers: 'Supprimer les utilisateurs',
    deleteSelectedUsers: 'Supprimer les utilisateurs sélectionnés',
    users: 'utilisateurs',
    usersSelected: 'utilisateurs sélectionnés',
    bulkActions: 'Actions en lot',
    moreActions: 'Plus d\'actions',
    newRole: 'Nouveau rôle',
    selectRole: 'Sélectionner le rôle',
    admin: 'Administrateur',
    manager: 'Gestionnaire',
    tenant: 'Locataire',
    applyRoleChange: 'Appliquer le changement de rôle',
    thisActionCannotBeUndone: 'Cette action ne peut pas être annulée',
    cancel: 'Annuler',
    processing: 'Traitement en cours',
    confirm: 'Confirmer',
    // Invitation management
    inviteUser: 'Inviter un utilisateur',
    inviteUserDescription: 'Envoyer des invitations aux nouveaux utilisateurs pour rejoindre votre système de gestion immobilière',
    singleInvitation: 'Invitation unique',
    bulkInvitations: 'Invitations en lot',
    emailAddress: 'Adresse courriel',
    enterEmailAddress: 'Entrer l\'adresse courriel',
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
    bulkInvitationsSent: 'Invitations en lot envoyées',
    bulkInvitationsResult: 'Invitations en lot traitées avec succès',
    bulkInvitationsSuccess: 'invitations envoyées avec succès',
    error: 'Erreur',
    // Additional user management translations
    bulkActionSuccess: 'Action en lot terminée',
    bulkActionSuccessDescription: 'L\'action en lot a été terminée avec succès',
    reminderSent: 'Rappel envoyé',
    reminderSentDescription: 'Le courriel de rappel a été envoyé avec succès',
    errorLoadingData: 'Erreur de chargement des données',
    tryAgain: 'Réessayer',
    noUsersSelected: 'Aucun utilisateur sélectionné',
    selectUsersForBulkAction: 'Veuillez sélectionner des utilisateurs pour effectuer l\'action en lot',
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
    invitationSentDescription: 'L\'invitation a été envoyée avec succès à l\'utilisateur',
  },
};

export { translations };
