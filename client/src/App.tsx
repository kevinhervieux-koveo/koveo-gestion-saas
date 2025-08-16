import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { lazy, Suspense, useEffect } from 'react';
import { LoadingSpinner } from './components/ui/loading-spinner';

// Lazy-loaded Owner pages
const OwnerDashboard = lazy(() => import('@/pages/owner/dashboard'));
const OwnerDocumentation = lazy(() => import('@/pages/owner/documentation'));
const OwnerPillars = lazy(() => import('@/pages/owner/pillars'));
const OwnerRoadmap = lazy(() => import('@/pages/owner/roadmap'));
const OwnerQuality = lazy(() => import('@/pages/owner/quality'));
const OwnerSuggestions = lazy(() => import('@/pages/owner/suggestions'));

// Lazy-loaded Manager pages
const ManagerBuildings = lazy(() => import('@/pages/manager/buildings'));
const ManagerResidences = lazy(() => import('@/pages/manager/residences'));
const ManagerBudget = lazy(() => import('@/pages/manager/budget'));
const ManagerBills = lazy(() => import('@/pages/manager/bills'));
const ManagerDemands = lazy(() => import('@/pages/manager/demands'));

// Lazy-loaded Residents pages
const ResidentsDashboard = lazy(() => import('@/pages/residents/dashboard'));
const ResidentsResidence = lazy(() => import('@/pages/residents/residence'));
const ResidentsBuilding = lazy(() => import('@/pages/residents/building'));
const ResidentsDemands = lazy(() => import('@/pages/residents/demands'));

// Lazy-loaded Settings pages
const SettingsSettings = lazy(() => import('@/pages/settings/settings'));
const SettingsBugReports = lazy(() => import('@/pages/settings/bug-reports'));
const SettingsIdeaBox = lazy(() => import('@/pages/settings/idea-box'));

// Lazy-loaded Legacy pages
const PillarsPage = lazy(() => import('@/pages/pillars'));
const NotFound = lazy(() => import('@/pages/not-found'));

// Authentication pages
const LoginPage = lazy(() => import('@/pages/auth/login'));

// Redirect component for root route
/**
 *
 */
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/dashboard');
    }
  }, [isAuthenticated, isLoading, setLocation]);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (isAuthenticated) {
    return null; // Will redirect via useEffect
  }
  
  return <LoginPage />;
}

/**
 * Protected router component that handles authentication-based routing.
 * Shows login page for unauthenticated users, main app for authenticated users.
 */
function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <Route component={LoginPage} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <div className='h-full flex bg-gray-50 font-inter'>
      <Sidebar />
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
        {/* Default route - redirect to dashboard */}
        <Route path='/' component={RootRedirect} />

        {/* Owner routes */}
        <Route path='/owner/dashboard' component={OwnerDashboard} />
        <Route path='/owner/documentation' component={OwnerDocumentation} />
        <Route path='/owner/pillars' component={OwnerPillars} />
        <Route path='/owner/roadmap' component={OwnerRoadmap} />
        <Route path='/owner/quality' component={OwnerQuality} />
        <Route path='/owner/suggestions' component={OwnerSuggestions} />

        {/* Manager routes */}
        <Route path='/manager/buildings' component={ManagerBuildings} />
        <Route path='/manager/residences' component={ManagerResidences} />
        <Route path='/manager/budget' component={ManagerBudget} />
        <Route path='/manager/bills' component={ManagerBills} />
        <Route path='/manager/demands' component={ManagerDemands} />

        {/* Residents routes */}
        <Route path='/dashboard' component={ResidentsDashboard} />
        <Route path='/residents/residence' component={ResidentsResidence} />
        <Route path='/residents/building' component={ResidentsBuilding} />
        <Route path='/residents/demands' component={ResidentsDemands} />

        {/* Settings routes */}
        <Route path='/settings/settings' component={SettingsSettings} />
        <Route path='/settings/bug-reports' component={SettingsBugReports} />
        <Route path='/settings/idea-box' component={SettingsIdeaBox} />

        {/* Legacy routes */}
        <Route path='/pillars' component={PillarsPage} />

          {/* 404 */}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </div>
  );
}

/**
 * Main App component with authentication integration.
 * Wraps the application with all necessary providers including authentication.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
