import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/hooks/use-language';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { Sidebar } from '@/components/layout/sidebar';
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
const AdminDashboard = optimizedPageLoaders.AdminDashboard;
const AdminDocumentation = createOptimizedLoader(
  () => import('@/pages/admin/documentation'),
  'admin-documentation',
  { enableMemoryCleanup: true }
);
const AdminPillars = createOptimizedLoader(
  () => import('@/pages/admin/pillars'),
  'admin-pillars',
  { enableMemoryCleanup: true }
);
const AdminRoadmap = optimizedPageLoaders.AdminRoadmap;
const AdminQuality = optimizedPageLoaders.AdminQuality;
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

// Admin/User Management page
const UserManagement = createOptimizedLoader(
  () => import('@/pages/admin/user-management'),
  'user-management',
  { enableMemoryCleanup: true }
);

// Optimized lazy-loaded Owner pages
const OwnerDashboard = createOptimizedLoader(
  () => import('@/pages/owner/dashboard'),
  'owner-dashboard',
  { enableMemoryCleanup: true }
);
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
const OwnerRoadmap = createOptimizedLoader(
  () => import('@/pages/owner/roadmap'),
  'owner-roadmap',
  { enableMemoryCleanup: true }
);
const OwnerQuality = createOptimizedLoader(
  () => import('@/pages/owner/quality'),
  'owner-quality',
  { enableMemoryCleanup: true }
);
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

// Home page (public route)
const HomePage = createOptimizedLoader(
  () => import('@/pages/home'),
  'home-page',
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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Home page and public routes - always without sidebar
  const isHomePage = location === '/';
  
  if (isHomePage || !isAuthenticated) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/accept-invitation" component={InvitationAcceptancePage} />
          <Route component={NotFound} />
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
              {/* Login page - redirect authenticated users to dashboard */}
              <Route path='/login' component={LoginRedirect} />

              {/* Admin routes */}
              <Route path='/admin/dashboard' component={AdminDashboard} />
              <Route path='/admin/documentation' component={AdminDocumentation} />
              <Route path='/admin/pillars' component={AdminPillars} />
              <Route path='/admin/roadmap' component={AdminRoadmap} />
              <Route path='/admin/quality' component={AdminQuality} />
              <Route path='/admin/suggestions' component={AdminSuggestions} />
              <Route path='/admin/permissions' component={AdminPermissions} />

              {/* Owner routes */}
              <Route path='/owner/dashboard' component={OwnerDashboard} />
              <Route path='/owner/documentation' component={OwnerDocumentation} />
              <Route path='/owner/pillars' component={OwnerPillars} />
              <Route path='/owner/roadmap' component={OwnerRoadmap} />
              <Route path='/owner/quality' component={OwnerQuality} />
              <Route path='/owner/suggestions' component={OwnerSuggestions} />
              <Route path='/owner/permissions' component={OwnerPermissions} />

              {/* Admin/Manager User Management routes */}
              <Route path='/admin/user-management' component={UserManagement} />
              <Route path='/manager/user-management' component={() => {
                console.warn('Loading /manager/user-management route');
                return <UserManagement />;
              }} />

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
 * Main App component with authentication integration.
 * Wraps the application with all necessary providers including authentication.
 * @returns JSX element for the main App component.
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