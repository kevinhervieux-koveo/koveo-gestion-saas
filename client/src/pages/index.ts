// Note: This file provides centralized exports for page components
// Individual pages should be imported directly when needed
// Example: import HomePage from './home' (default exports)

// Public Pages (using default exports as they exist)
export { default as HomePage } from './home';
export { default as NotFoundPage } from './not-found';
export { default as Dashboard } from './dashboard';

// Auth Pages
export { default as LoginPage } from './auth/login';
export { default as InvitationAcceptancePage } from './auth/invitation-acceptance';

// Admin Pages
export { default as AdminDocumentationPage } from './admin/documentation';
export { default as AdminOrganizationsPage } from './admin/organizations';
export { default as AdminPermissionsPage } from './admin/permissions';
export { default as AdminPillarsPage } from './admin/pillars';
export { default as AdminQualityPage } from './admin/quality';
export { default as AdminRoadmapPage } from './admin/roadmap';
export { default as AdminSuggestionsPage } from './admin/suggestions';
export { default as AdminSuggestionsWithFilterPage } from './admin/suggestions-with-filter';

// Manager Pages
export { default as ManagerBillsPage } from './manager/bills';
export { default as ManagerBudgetPage } from './manager/budget';
export { default as ManagerBuildingsPage } from './manager/buildings';
export { default as ManagerDemandsPage } from './manager/demands';
export { default as ManagerResidencesPage } from './manager/residences';

// Resident Pages
export { default as ResidentDashboardPage } from './residents/dashboard';
export { default as ResidentBuildingPage } from './residents/building';
export { default as ResidentResidencePage } from './residents/residence';

// Settings Pages
export { default as SettingsPage } from './settings/settings';
export { default as BugReportsPage } from './settings/bug-reports';
export { default as IdeaBoxPage } from './settings/idea-box';
