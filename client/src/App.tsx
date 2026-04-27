// @ts-nocheck — Pre-existing type errors tracked in TYPE_CHECK_DEBT.md (task #769)
import { Switch, Route, useLocation } from 'wouter';
import { PARENT_ROUTE_REDIRECTS } from '@/config/route-redirects';
import { HelmetProvider } from 'react-helmet-async';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { SidebarStateProvider, useSidebarState } from '@/hooks/use-sidebar-state';
import { Suspense, useEffect } from 'react';
import React from 'react';
import { memoryOptimizer } from '@/utils/memory-monitor';
import { optimizedPageLoaders, createOptimizedLoader, smartPreload } from '@/utils/component-loader';
import { LoadingSpinner } from './components/ui/loading-spinner';
import { useSmoothNavigation } from '@/hooks/use-smooth-navigation';
import { webVitalsMonitor } from '@/utils/web-vitals-monitor';
import { performanceMonitor } from '@/utils/performance-monitor';

// Start memory monitoring for better performance
memoryOptimizer.start();

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  // Make queryClient available globally for memory cleanup
  (window as unknown as Record<string, unknown>).queryClient = queryClient;
  
  // Initialize Web Vitals and performance monitoring
  webVitalsMonitor.initialize();
  performanceMonitor.start();
  
}

import { MobileMenuProvider } from '@/hooks/use-mobile-menu';
import { AuthErrorBoundary } from '@/components/common/AuthErrorBoundary';
import { HelpProvider } from '@/contexts/HelpContext';
import { HelpButton } from '@/components/help/HelpButton';
import { HelpOverlay } from '@/components/help/HelpOverlay';
import { HelpHighlighter } from '@/components/help/HelpHighlighter';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { InstallPrompt } from '@/components/common/InstallPrompt';
import { AutoPageRoutes } from '@/pages/auto/_register';

// Optimized lazy-loaded Admin pages
const AdminOrganizations = optimizedPageLoaders.AdminOrganizations;
const AdminQuality = optimizedPageLoaders.AdminQuality;
const AdminPermissions = createOptimizedLoader(
  () => import('@/pages/admin/permissions'),
  'admin-permissions',
  { enableMemoryCleanup: true }
);
const AdminCompliance = createOptimizedLoader(
  () => import('@/pages/admin/compliance'),
  'admin-compliance',
  { enableMemoryCleanup: true }
);
const AdminBulkDocumentImport = createOptimizedLoader(
  () => import('@/pages/admin/bulk-document-import'),
  'admin-bulk-document-import',
  { enableMemoryCleanup: true }
);

// Manager User Management component
const ManagerUserManagement = createOptimizedLoader(
  () => import('@/pages/manager/user-management'),
  'manager-user-management',
  { enableMemoryCleanup: true }
);

const ManagerDocumentTags = createOptimizedLoader(
  () => import('@/pages/manager/document-tags'),
  'manager-document-tags',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Manager pages
const ManagerBuildings = optimizedPageLoaders.ManagerBuildings;
const ManagerResidences = optimizedPageLoaders.ManagerResidences;
const BuildingDocuments = createOptimizedLoader(
  () => import('@/pages/manager/BuildingDocuments'),
  'building-documents-page',
  { enableMemoryCleanup: true }
);
const ResidenceDocuments = createOptimizedLoader(
  () => import('@/pages/manager/ResidenceDocuments'),
  'residence-documents-page',
  { enableMemoryCleanup: true }
);
const ResidentsResidenceDocuments = createOptimizedLoader(
  () => import('@/pages/residents/ResidenceDocuments'),
  'residents-residence-documents-page',
  { enableMemoryCleanup: true }
);
const ResidentsBuildingDocuments = createOptimizedLoader(
  () => import('@/pages/residents/BuildingDocuments'),
  'residents-building-documents-page',
  { enableMemoryCleanup: true }
);
const ManagerBudget = createOptimizedLoader(() => import('@/pages/manager/budget'), 'manager-budget', {
  enableMemoryCleanup: true,
});
const ManagerBills = createOptimizedLoader(() => import('@/pages/manager/bills'), 'manager-bills', {
  enableMemoryCleanup: true,
});
const ManagerInvoices = createOptimizedLoader(() => import('@/pages/manager/invoices'), 'manager-invoices', {
  enableMemoryCleanup: true,
});
const ManagerDemands = createOptimizedLoader(
  () => import('@/pages/manager/demands'),
  'manager-demands',
  { enableMemoryCleanup: true }
);

const ManagerCommonSpacesStats = createOptimizedLoader(
  () => import('@/pages/manager/common-spaces-stats'),
  'manager-common-spaces-stats',
  { enableMemoryCleanup: true }
);

const ManagerMaintenanceInventory = createOptimizedLoader(
  () => import('@/pages/manager/maintenance/inventory'),
  'manager-maintenance-inventory',
  { enableMemoryCleanup: true }
);

const ManagerMaintenanceProjects = createOptimizedLoader(
  () => import('@/pages/manager/maintenance/projects'),
  'manager-maintenance-projects',
  { enableMemoryCleanup: true }
);

const ManagerElementHistoryPage = createOptimizedLoader(
  () => import('@/pages/manager/maintenance/inventory/ElementHistoryPage'),
  'manager-element-history-page',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Residents pages
const ResidentsResidence = createOptimizedLoader(
  () => import('@/pages/residents/residence'),
  'residents-residence',
  { enableMemoryCleanup: true }
);
const ResidentsBuilding = optimizedPageLoaders.ResidentsBuilding;
const ResidentsDemands = createOptimizedLoader(
  () => import('@/pages/ResidentDemandsPage'),
  'residents-demands',
  { enableMemoryCleanup: true }
);

const ResidentsCommonSpaces = createOptimizedLoader(
  () => import('@/pages/residents/common-spaces'),
  'residents-common-spaces',
  { enableMemoryCleanup: true }
);

const ResidentsMyCalendar = createOptimizedLoader(
  () => import('@/pages/residents/my-calendar'),
  'residents-my-calendar',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Settings pages
const SettingsSettings = createOptimizedLoader(
  () => import('@/pages/settings/settings'),
  'settings-settings',
  { enableMemoryCleanup: true }
);
// Optimized lazy-loaded Legacy pages
const NotFound = createOptimizedLoader(() => import('@/pages/not-found'), 'not-found', {
  enableMemoryCleanup: true,
});

// Authentication pages (high priority)
const LoginPage = createOptimizedLoader(() => import('@/pages/auth/login'), 'login-page', {
  enableMemoryCleanup: true,
});
const ForgotPasswordPage = createOptimizedLoader(
  () => import('@/pages/auth/forgot-password'),
  'forgot-password-page',
  { enableMemoryCleanup: true }
);
const ResetPasswordPage = createOptimizedLoader(
  () => import('@/pages/auth/reset-password'),
  'reset-password-page',
  { enableMemoryCleanup: true }
);

// Home page (public route)
const HomePage = createOptimizedLoader(() => import('@/pages/home'), 'home-page', {
  enableMemoryCleanup: true,
});

// New public pages
const FeaturesPage = createOptimizedLoader(() => import('@/pages/features'), 'features-page', {
  enableMemoryCleanup: true,
});
const SecurityPage = createOptimizedLoader(() => import('@/pages/security'), 'security-page', {
  enableMemoryCleanup: true,
});
const StoryPage = createOptimizedLoader(() => import('@/pages/story'), 'story-page', {
  enableMemoryCleanup: true,
});
const PrivacyPolicyPage = createOptimizedLoader(
  () => import('@/pages/privacy-policy'),
  'privacy-policy-page',
  { enableMemoryCleanup: true }
);
const TermsOfServicePage = createOptimizedLoader(
  () => import('@/pages/terms-of-service'),
  'terms-of-service-page',
  { enableMemoryCleanup: true }
);
const PricingPage = createOptimizedLoader(() => import('@/pages/pricing'), 'pricing-page', {
  enableMemoryCleanup: true,
});
const EnterprisePage = createOptimizedLoader(() => import('@/pages/enterprise'), 'enterprise-page', {
  enableMemoryCleanup: true,
});

// Main Dashboard page (Financial Overview)
const DashboardPage = createOptimizedLoader(() => import('@/pages/dashboard/overview'), 'dashboard-page', {
  enableMemoryCleanup: true,
});

// Dashboard Communication page
const DashboardCommunicationPage = createOptimizedLoader(
  () => import('@/pages/dashboard/communication'),
  'dashboard-communication-page',
  { enableMemoryCleanup: true }
);

// Invitation acceptance page (public route)
const InvitationAcceptancePage = createOptimizedLoader(
  () => import('@/pages/auth/invitation-acceptance'),
  'invitation-acceptance-page',
  { enableMemoryCleanup: true }
);

// Performance Dashboard page (admin route)
const PerformanceDashboardPage = createOptimizedLoader(
  () => import('@/components/dashboard/PerformanceDashboard'),
  'performance-dashboard-page',
  { enableMemoryCleanup: true }
);

/**
 * Protected router component that handles authentication-based routing.
 * Shows login page for unauthenticated users, main app for authenticated users.
 * @returns JSX element for the router component.
 */
/**
 * Router function.
 * @returns Function result.
 */
function Router() {
  const { isAuthenticated, isLoading, isAuthenticating } = useAuth();
  const [location] = useLocation();
  
  // Enable smooth scroll-to-top on navigation
  useSmoothNavigation();

  // Preload likely next pages for the current section during browser idle time
  useEffect(() => {
    smartPreload(location);
  }, [location]);

  // Show loading spinner while authentication is being determined
  if (isLoading || isAuthenticating) {
    return <LoadingSpinner />;
  }

  // Check if we're on a public page
  const isPublicPage = [
    '/login',
    '/auth/login',
    '/forgot-password',
    '/auth/forgot-password',
    '/reset-password',
    '/auth/reset-password',
    '/accept-invitation',
    '/auth/accept-invitation',
    '/register',
    '/features',
    '/pricing',
    '/enterprise',
    '/security',
    '/story',
    '/privacy-policy',
    '/terms-of-service',
  ].includes(location);

  // Root path: redirect to dashboard if authenticated, login otherwise.
  if (location === '/') {
    return <RootRedirect isAuthenticated={isAuthenticated} />;
  }

  // If we're on a public page, allow access regardless of auth status
  if (isPublicPage) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <Route path='/features' component={FeaturesPage} />
          <Route path='/pricing' component={PricingPage} />
          <Route path='/enterprise' component={EnterprisePage} />
          <Route path='/security' component={SecurityPage} />
          <Route path='/story' component={StoryPage} />
          <Route path='/privacy-policy' component={PrivacyPolicyPage} />
          <Route path='/terms-of-service' component={TermsOfServicePage} />
          <Route path='/login' component={isAuthenticated ? LoginRedirect : LoginPage} />
          <Route path='/auth/login' component={isAuthenticated ? LoginRedirect : LoginPage} />
          <Route path='/forgot-password' component={ForgotPasswordPage} />
          <Route path='/auth/forgot-password' component={ForgotPasswordPage} />
          <Route path='/reset-password' component={ResetPasswordPage} />
          <Route path='/auth/reset-password' component={ResetPasswordPage} />
          <Route path='/accept-invitation' component={InvitationAcceptancePage} />
          <Route path='/auth/accept-invitation' component={InvitationAcceptancePage} />
          <Route path='/register' component={InvitationAcceptancePage} />
        </Switch>
      </Suspense>
    );
  }

  // For protected routes, require authentication
  if (!isAuthenticated) {
    // Show loading spinner instead of immediate redirect to prevent race conditions
    // The redirect logic is now handled in the useAuth hook with proper delays
    return <LoadingSpinner />;
  }

  return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
  const { isCollapsed } = useSidebarState();

  return (
    <div className='h-full flex bg-gray-50 font-inter'>
      {/* Desktop sidebar - always visible on desktop */}
      <div className='hidden md:block'>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay - only visible when mobile menu is open */}
      <div className='md:hidden'>
        <Sidebar forceExpanded />
      </div>

      {/* Main content area. When the desktop sidebar is collapsed, we add a
          marker class so page-level wrappers (e.g. `max-w-7xl mx-auto`) can
          widen to fill the freed-up space. The CSS rules live in
          `client/src/index.css`. */}
      <div
        className={`flex-1 flex flex-col min-w-0 sidebar-aware-content ${
          isCollapsed ? 'sidebar-collapsed-layout' : ''
        }`}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <Switch>
            {/* Login page - redirect authenticated users to dashboard */}
            <Route path='/login' component={LoginRedirect} />
            <Route path='/auth/login' component={LoginRedirect} />

            {/* Main Dashboard */}
            <Route path='/dashboard' component={DashboardOverviewRedirect} />
            <Route path='/dashboard/overview' component={DashboardPage} />
            <Route path='/dashboard/communication' component={DashboardCommunicationPage} />

            {/* Admin routes */}
            <Route path='/admin' component={AdminOverviewRedirect} />
            <Route path='/admin/organizations'>{() => <ProtectedRoute requiredRole="admin"><AdminOrganizations /></ProtectedRoute>}</Route>
            <Route path='/admin/quality'>{() => <ProtectedRoute requiredRole="admin"><AdminQuality /></ProtectedRoute>}</Route>
            <Route path='/admin/compliance'>{() => <ProtectedRoute requiredRole="admin" superAdminOnly><AdminCompliance /></ProtectedRoute>}</Route>
            <Route path='/admin/permissions'>{() => <ProtectedRoute requiredRole="admin"><AdminPermissions /></ProtectedRoute>}</Route>
            <Route path='/admin/bulk-document-import'>{() => <ProtectedRoute requiredRole="admin"><AdminBulkDocumentImport /></ProtectedRoute>}</Route>
            <Route path='/admin/performance'>{() => <ProtectedRoute requiredRole="admin"><PerformanceDashboardPage /></ProtectedRoute>}</Route>

            {/* Manager routes */}
            <Route path='/manager' component={ManagerOverviewRedirect} />
            <Route path='/manager/buildings'>{() => <ProtectedRoute requiredRole="manager"><ManagerBuildings /></ProtectedRoute>}</Route>
            <Route path='/manager/buildings/documents'>{() => <ProtectedRoute requiredRole="manager"><BuildingDocuments /></ProtectedRoute>}</Route>
            <Route path='/manager/buildings/:buildingId/documents'>{() => <ProtectedRoute requiredRole="manager"><BuildingDocuments /></ProtectedRoute>}</Route>
            <Route path='/manager/residences'>{() => <ProtectedRoute requiredRole="manager"><ManagerResidences /></ProtectedRoute>}</Route>
            <Route path='/manager/residences/documents'>{() => <ProtectedRoute requiredRole="manager"><ResidenceDocuments /></ProtectedRoute>}</Route>
            <Route path='/manager/residences/:residenceId/documents'>{() => <ProtectedRoute requiredRole="manager"><ResidenceDocuments /></ProtectedRoute>}</Route>
            <Route path='/manager/budget'>{() => <ProtectedRoute requiredRole="manager"><ManagerBudget /></ProtectedRoute>}</Route>
            <Route path='/manager/bills'>{() => <ProtectedRoute requiredRole="manager"><ManagerBills /></ProtectedRoute>}</Route>
            <Route path='/manager/invoices'>{() => <ProtectedRoute requiredRole="manager"><ManagerInvoices /></ProtectedRoute>}</Route>
            <Route path='/manager/demands'>{() => <ProtectedRoute requiredRole="manager"><ManagerDemands /></ProtectedRoute>}</Route>
            <Route path='/manager/user-management'>{() => <ProtectedRoute requiredRole="manager"><ManagerUserManagement /></ProtectedRoute>}</Route>
            <Route path='/manager/document-tags'>{() => <ProtectedRoute requiredRole="manager"><ManagerDocumentTags /></ProtectedRoute>}</Route>
            <Route path='/manager/common-spaces-stats'>{() => <ProtectedRoute requiredRole="manager"><ManagerCommonSpacesStats /></ProtectedRoute>}</Route>
            <Route path='/manager/maintenance/inventory'>{() => <ProtectedRoute requiredRole="manager"><ManagerMaintenanceInventory /></ProtectedRoute>}</Route>
            <Route path='/manager/maintenance/elements/:elementId/history'>{() => <ProtectedRoute requiredRole="manager"><ManagerElementHistoryPage /></ProtectedRoute>}</Route>
            <Route path='/manager/maintenance/projects'>{() => <ProtectedRoute requiredRole="manager"><ManagerMaintenanceProjects /></ProtectedRoute>}</Route>


            {/* Residents routes */}
            <Route path='/residents' component={ResidentsOverviewRedirect} />
            <Route path='/residents/residence'>{() => <ResidentsResidence />}</Route>
            <Route
              path='/residents/residence/documents'
              component={() => <ResidentsResidenceDocuments />}
            />
            {/* Support dynamic residence ID in URL path */}
            <Route
              path='/residents/residences/:residenceId/documents'
              component={() => <ResidentsResidenceDocuments />}
            />
            <Route path='/residents/building'>{() => <ResidentsBuilding />}</Route>
            <Route
              path='/residents/building/documents'
              component={() => <ResidentsBuildingDocuments />}
            />
            {/* Support dynamic building ID in URL path */}
            <Route
              path='/residents/buildings/:buildingId/documents'
              component={() => <ResidentsBuildingDocuments />}
            />
            <Route path='/residents/demands' component={ResidentsDemands} />
            <Route path='/resident/common-spaces'>{() => <ResidentsCommonSpaces />}</Route>
            <Route path='/resident/my-calendar' component={ResidentsMyCalendar} />

            {/* Settings routes */}
            <Route path='/settings' component={SettingsSettings} />

            {/* Auto-discovered pages — drop new pages in
                client/src/pages/auto/ instead of editing this file.
                See client/src/pages/auto/README.md. */}
            <AutoPageRoutes />

            {/* 404 */}
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </div>

      {/* Help system - floating button and overlay */}
      <HelpButton />
      <HelpOverlay />
      <HelpHighlighter />
    </div>
  );
}

// Re-export the canonical redirect map (source of truth lives in config/ so
// tests can import it without pulling in Vite-specific import.meta.glob).
export { PARENT_ROUTE_REDIRECTS };

/**
 * Login redirect component for authenticated users.
 * Redirects authenticated users from login page to dashboard.
 * @returns JSX element that shows loading while redirecting.
 */
/**
 * LoginRedirect function.
 * @returns Function result.
 */
function DashboardOverviewRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(PARENT_ROUTE_REDIRECTS['/dashboard']);
  }, [setLocation]);

  return <LoadingSpinner />;
}

function ResidentsOverviewRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(PARENT_ROUTE_REDIRECTS['/residents']);
  }, [setLocation]);

  return <LoadingSpinner />;
}

function ManagerOverviewRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(PARENT_ROUTE_REDIRECTS['/manager']);
  }, [setLocation]);

  return <LoadingSpinner />;
}

function AdminOverviewRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(PARENT_ROUTE_REDIRECTS['/admin']);
  }, [setLocation]);

  return <LoadingSpinner />;
}

function LoginRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/dashboard/overview');
  }, [setLocation]);

  return <LoadingSpinner />;
}

/**
 * Root path redirect: sends authenticated users to the dashboard
 * overview and unauthenticated users to the login page. Renders the
 * shared loading spinner while the redirect happens so the marketing
 * home page never flashes.
 */
function RootRedirect({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(isAuthenticated ? '/dashboard/overview' : '/login');
  }, [isAuthenticated, setLocation]);

  return <LoadingSpinner />;
}

// HomeRedirect component removed as it's not currently used

/**
 * Main App component with authentication integration.
 * Wraps the application with all necessary providers including authentication.
 * @returns JSX element for the main App component.
 */
/**
 * App function.
 * @returns Function result.
 */
function App() {
  // Initialize memory monitoring on app start
  useEffect(() => {
    memoryOptimizer.start();

    // Cleanup on unmount
    return () => {
      memoryOptimizer.stop();
    };
  }, []);

  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthErrorBoundary>
          <AuthProvider>
          <MobileMenuProvider>
            <SidebarStateProvider>
              <HelpProvider>
                <TooltipProvider>
                  <Toaster />
                  <Router />
                  <InstallPrompt />
                </TooltipProvider>
              </HelpProvider>
            </SidebarStateProvider>
          </MobileMenuProvider>
          </AuthProvider>
        </AuthErrorBoundary>
      </LanguageProvider>
    </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;