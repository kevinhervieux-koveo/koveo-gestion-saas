import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { Suspense, useEffect, useState, createContext, useContext } from 'react';
import { memoryOptimizer } from '@/utils/memory-monitor';
import { optimizedPageLoaders, createOptimizedLoader } from '@/utils/component-loader';
import { LoadingSpinner } from './components/ui/loading-spinner';

// Mobile menu context
/**
 *
 */
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

// Optimized lazy-loaded Admin pages
const AdminOrganizations = createOptimizedLoader(
  () => import('@/pages/admin/organizations-styled'),
  'admin-organizations-styled',
  { preloadDelay: 300, enableMemoryCleanup: true }
);
const AdminDocumentation = createOptimizedLoader(
  () => import('@/pages/admin/documentation-styled'),
  'admin-documentation-styled',
  { enableMemoryCleanup: true }
);
const AdminPillars = createOptimizedLoader(
  () => import('@/pages/admin/pillars'),
  'admin-pillars',
  { enableMemoryCleanup: true }
);
const AdminRoadmap = createOptimizedLoader(
  () => import('@/pages/admin/roadmap-styled'),
  'admin-roadmap-styled',
  { enableMemoryCleanup: true }
);
const AdminQuality = createOptimizedLoader(
  () => import('@/pages/admin/quality-styled'),
  'admin-quality-styled',
  { enableMemoryCleanup: true }
);
const AdminSuggestions = createOptimizedLoader(
  () => import('@/pages/admin/suggestions'),
  'admin-suggestions',
  { enableMemoryCleanup: true }
);
const AdminPermissions = createOptimizedLoader(
  () => import('@/pages/admin/permissions'),
  'admin-permissions',
  { enableMemoryCleanup: true }
);

// Management pages removed - User Management functionality removed from navigation

// Owner routes removed - consolidating all documentation under admin section

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
const PillarsPage = AdminPillars; // Reuse admin pillars
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

// Home page (public route)
const HomePage = createOptimizedLoader(
  () => import('@/pages/home-styled'),
  'home-page',
  { preloadDelay: 100, enableMemoryCleanup: true }
);

// Main Dashboard page
const DashboardPage = createOptimizedLoader(
  () => import('@/pages/dashboard-simple'),
  'dashboard-page',
  { preloadDelay: 200, enableMemoryCleanup: true }
);

// Test styling page
const TestStylingPage = createOptimizedLoader(
  () => import('@/pages/test-styling'),
  'test-styling-page',
  { preloadDelay: 100, enableMemoryCleanup: true }
);

// Invitation acceptance page (public route)
const InvitationAcceptancePage = createOptimizedLoader(
  () => import('@/pages/auth/invitation-acceptance'),
  'invitation-acceptance-page',
  { preloadDelay: 500, enableMemoryCleanup: true }
);


/**
 * Protected router component that handles authentication-based routing.
 * Shows login page for unauthenticated users, main app for authenticated users.
 * @returns JSX element for the router component.
 */
function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  console.log('Router: isAuthenticated:', isAuthenticated, 'isLoading:', isLoading, 'location:', location);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (isLoading) {
    console.log('Router: showing loading spinner due to isLoading');
    return <LoadingSpinner />;
  }

  // Home page and public routes - always without sidebar
  const isHomePage = location === '/';
  
  if (!isAuthenticated) {
    // For unauthenticated users, only show public routes and redirect everything else
    return (
      <div style={{minHeight: '100vh', background: 'linear-gradient(to bottom right, #dbeafe, #ffffff, #f9fafb)'}}>
        {/* Top Header - Always visible */}
        <TopHeader />
        
        <div style={{paddingTop: '60px'}}>
          <Suspense fallback={<LoadingSpinner />}>
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/accept-invitation" component={InvitationAcceptancePage} />
              {/* Redirect all other routes to home for unauthenticated users */}
              <Route component={HomeRedirect} />
            </Switch>
          </Suspense>
        </div>
      </div>
    );
  }
  
  if (isHomePage) {
    // Redirect authenticated users to dashboard instead of showing home page
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <DashboardRedirect />
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
      {/* Top Header - Always visible */}
      <TopHeader />
      
      <div className='h-full flex bg-gray-50 font-inter' style={{minHeight: '100vh', background: '#f9fafb', paddingTop: '60px'}}>  
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
              {/* Login page - redirect authenticated users to dashboard */}
              <Route path='/login' component={LoginRedirect} />

              {/* Main Dashboard */}
              <Route path='/dashboard' component={DashboardPage} />
              
              {/* Test styling page */}
              <Route path='/test-styling' component={TestStylingPage} />

              {/* Admin routes */}
              <Route path='/admin/organizations' component={AdminOrganizations} />
              <Route path='/admin/documentation' component={AdminDocumentation} />
              <Route path='/admin/pillars' component={AdminPillars} />
              <Route path='/admin/roadmap' component={AdminRoadmap} />
              <Route path='/admin/quality' component={AdminQuality} />
              <Route path='/admin/suggestions' component={AdminSuggestions} />
              <Route path='/admin/permissions' component={AdminPermissions} />

              {/* Owner routes removed - documentation consolidated under admin section */}

              {/* Manager routes */}
              <Route path='/manager/buildings' component={ManagerBuildings} />
              <Route path='/manager/residences' component={ManagerResidences} />
              <Route path='/manager/budget' component={ManagerBudget} />
              <Route path='/manager/bills' component={ManagerBills} />
              <Route path='/manager/demands' component={ManagerDemands} />

              {/* Management routes removed - User Management functionality removed from navigation */}

              {/* Residents routes */}
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
 * Login redirect component for authenticated users.
 * Redirects authenticated users from login page to dashboard.
 * @returns JSX element that shows loading while redirecting.
 */
function LoginRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/dashboard');
  }, [setLocation]);
  
  return <LoadingSpinner />;
}

/**
 * Dashboard redirect component for authenticated users.
 * Redirects authenticated users from home page to dashboard.
 * @returns JSX element that shows loading while redirecting.
 */
function DashboardRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/dashboard');
  }, [setLocation]);
  
  return <LoadingSpinner />;
}

/**
 * Home redirect component for unauthenticated users.
 * Redirects unauthenticated users from protected routes to home page.
 * @returns JSX element that shows loading while redirecting.
 */
function HomeRedirect() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/');
  }, [setLocation]);
  
  return <LoadingSpinner />;
}

/**
 * Main App component with authentication integration.
 * Wraps the application with all necessary providers including authentication.
 * @returns JSX element for the main App component.
 */
function App() {
  // Initialize memory monitoring on app start
  useEffect(() => {
    try {
      memoryOptimizer.start();
    } catch (error) {
      console.log('Memory optimizer failed to start:', error);
    }
    
    // Cleanup on unmount
    return () => {
      try {
        memoryOptimizer.stop();
      } catch (error) {
        console.log('Memory optimizer failed to stop:', error);
      }
    };
  }, []);

  console.log('App component rendering...');

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
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
    </div>
  );
}

export default App;