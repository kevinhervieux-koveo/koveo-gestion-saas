import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { lazy, Suspense, useEffect, useState, createContext, useContext } from 'react';
import { memoryOptimizer } from '@/utils/memory-monitor';
import { optimizedPageLoaders, createOptimizedLoader } from '@/utils/component-loader';
import { LoadingSpinner } from './components/ui/loading-spinner';

// Mobile menu context
interface MobileMenuContextType {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextType | undefined>(undefined);

export const useMobileMenu = () => {
  const context = useContext(MobileMenuContext);
  if (context === undefined) {
    throw new Error('useMobileMenu must be used within a MobileMenuProvider');
  }
  return context;
};

// Optimized lazy-loaded Owner pages
const OwnerDashboard = optimizedPageLoaders.OwnerDashboard;
const OwnerDocumentation = createOptimizedLoader(
  () => import('@/pages/owner/documentation'),
  'owner-documentation',
  { enableMemoryCleanup: true }
);
const OwnerPillars = createOptimizedLoader(
  () => import('@/pages/owner/pillars'),
  'owner-pillars',
  { enableMemoryCleanup: true }
);
const OwnerRoadmap = optimizedPageLoaders.OwnerRoadmap;
const OwnerQuality = optimizedPageLoaders.OwnerQuality;
const OwnerSuggestions = createOptimizedLoader(
  () => import('@/pages/owner/suggestions'),
  'owner-suggestions',
  { enableMemoryCleanup: true }
);
const OwnerPermissions = createOptimizedLoader(
  () => import('@/pages/owner/permissions'),
  'owner-permissions',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Manager pages
const ManagerBuildings = optimizedPageLoaders.ManagerBuildings;
const ManagerResidences = optimizedPageLoaders.ManagerResidences;
const ManagerBudget = createOptimizedLoader(
  () => import('@/pages/manager/budget'),
  'manager-budget',
  { enableMemoryCleanup: true }
);
const ManagerBills = createOptimizedLoader(
  () => import('@/pages/manager/bills'),
  'manager-bills',
  { enableMemoryCleanup: true }
);
const ManagerDemands = createOptimizedLoader(
  () => import('@/pages/manager/demands'),
  'manager-demands',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Residents pages
const ResidentsDashboard = optimizedPageLoaders.ResidentsDashboard;
const ResidentsResidence = createOptimizedLoader(
  () => import('@/pages/residents/residence'),
  'residents-residence',
  { enableMemoryCleanup: true }
);
const ResidentsBuilding = optimizedPageLoaders.ResidentsBuilding;
const ResidentsDemands = createOptimizedLoader(
  () => import('@/pages/residents/demands'),
  'residents-demands',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Settings pages
const SettingsSettings = createOptimizedLoader(
  () => import('@/pages/settings/settings'),
  'settings-settings',
  { enableMemoryCleanup: true }
);
const SettingsBugReports = createOptimizedLoader(
  () => import('@/pages/settings/bug-reports'),
  'settings-bug-reports',
  { enableMemoryCleanup: true }
);
const SettingsIdeaBox = createOptimizedLoader(
  () => import('@/pages/settings/idea-box'),
  'settings-idea-box',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Legacy pages
const PillarsPage = createOptimizedLoader(
  () => import('@/pages/pillars'),
  'pillars-page',
  { enableMemoryCleanup: true }
);
const NotFound = createOptimizedLoader(
  () => import('@/pages/not-found'),
  'not-found',
  { enableMemoryCleanup: true }
);

// Authentication pages (high priority)
const LoginPage = createOptimizedLoader(
  () => import('@/pages/auth/login'),
  'login-page',
  { preloadDelay: 500, enableMemoryCleanup: true }
);

// Redirect component for root route
/**
 * Component that handles root route redirection based on authentication status.
 * @returns JSX element for root redirect logic
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

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

  const mobileMenuContext = {
    isMobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };

  return (
    <MobileMenuContext.Provider value={mobileMenuContext}>
      <div className='h-full flex bg-gray-50 font-inter'>
        {/* Desktop sidebar - always visible on desktop */}
        <div className="hidden md:block">
          <Sidebar />
        </div>
        
        {/* Mobile sidebar overlay - only visible when mobile menu is open */}
        <div className="md:hidden">
          <Sidebar 
            isMobileMenuOpen={isMobileMenuOpen}
            onMobileMenuClose={closeMobileMenu}
          />
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
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
              <Route path='/owner/permissions' component={OwnerPermissions} />

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
      </div>
    </MobileMenuContext.Provider>
  );
}

/**
 * Main App component with authentication integration.
 * Wraps the application with all necessary providers including authentication.
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