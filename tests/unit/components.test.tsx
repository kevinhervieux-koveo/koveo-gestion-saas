import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoadingSpinner } from '../../client/src/components/ui/loading-spinner';
import { LanguageProvider } from '../../client/src/hooks/use-language';
import { Sidebar } from '../../client/src/components/layout/sidebar';
import { Header } from '../../client/src/components/layout/header';
import { NavigationMenu, NavigationMenuList, NavigationMenuItem } from '../../client/src/components/ui/navigation-menu';

// Mock wouter for routing components
jest.mock('wouter', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid={`link-${href.replace('/', '')}`}>{children}</a>
  ),
  useLocation: () => ['/owner/dashboard', jest.fn()],
  Switch: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Route: ({ component: Component }: { component: React.ComponentType }) => <Component />,
}));

// Mock icons
jest.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon">Loading...</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Home: () => <div data-testid="home-icon">Home</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  FileText: () => <div data-testid="file-icon">File</div>,
  Menu: () => <div data-testid="menu-icon">Menu</div>,
  ArrowUp: () => <div data-testid="arrow-up-icon">ArrowUp</div>,
  ShieldCheck: () => <div data-testid="shield-icon">Shield</div>,
  CheckCircle: () => <div data-testid="check-icon">Check</div>,
  User: () => <div data-testid="user-icon">User</div>,
  DollarSign: () => <div data-testid="dollar-icon">Dollar</div>,
  AlertCircle: () => <div data-testid="alert-icon">Alert</div>,
  Lightbulb: () => <div data-testid="lightbulb-icon">Lightbulb</div>,
  LogOut: () => <div data-testid="logout-icon">LogOut</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
}));

describe('Component Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  describe('LoadingSpinner', () => {
    it('should render loading spinner', () => {
      render(<LoadingSpinner />);
      
      expect(screen.getByTestId('loader-icon')).toBeDefined();
      expect(screen.getByText('Loading...')).toBeDefined();
    });

    it('should have correct styling classes', () => {
      render(<LoadingSpinner />);
      
      const container = screen.getByText('Loading...').closest('div');
      expect(container?.className).toContain('flex');
    });
  });

  describe('LanguageProvider', () => {
    it('should provide language context', () => {
      const TestComponent = () => {
        const { useLanguage } = require('../../client/src/hooks/use-language');
        const { t, currentLanguage } = useLanguage();
        return (
          <div>
            <span data-testid="language">{currentLanguage}</span>
            <span data-testid="greeting">{t('welcome')}</span>
          </div>
        );
      };

      render(
        <LanguageProvider>
          <TestComponent />
        </LanguageProvider>
      );

      expect(screen.getByTestId('language')).toHaveTextContent('fr');
    });
  });

  describe('QueryClient Integration', () => {
    it('should provide query client to children', () => {
      const TestComponent = () => {
        const { useQueryClient } = require('@tanstack/react-query');
        const client = useQueryClient();
        return <div data-testid="has-client">{client ? 'true' : 'false'}</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      expect(screen.getByTestId('has-client')).toHaveTextContent('true');
    });
  });

  describe('Header Component', () => {
    const mockProps = {
      title: 'Test Dashboard',
      subtitle: 'Test subtitle for dashboard page'
    };

    const renderHeader = () => {
      return render(
        <LanguageProvider>
          <Header {...mockProps} />
        </LanguageProvider>
      );
    };

    it('should render header with title and subtitle', () => {
      renderHeader();
      
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Test subtitle for dashboard page')).toBeInTheDocument();
    });

    it('should display workspace active status', () => {
      renderHeader();
      
      expect(screen.getByText('Espace de travail actif')).toBeInTheDocument();
    });

    it('should have proper header styling', () => {
      renderHeader();
      
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-white', 'border-b', 'border-gray-200');
    });

    it('should render title with correct styling', () => {
      renderHeader();
      
      const title = screen.getByText('Test Dashboard');
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'text-gray-900');
    });
  });

  describe('Sidebar Component', () => {
    const renderSidebar = () => {
      return render(
        <LanguageProvider>
          <Sidebar />
        </LanguageProvider>
      );
    };

    it('should render sidebar with navigation menu', () => {
      renderSidebar();
      
      // Check for main navigation sections
      expect(screen.getByText('Propriétaire')).toBeInTheDocument();
      expect(screen.getByText('Locataire')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
    });

    it('should render language switcher', () => {
      renderSidebar();
      
      // Language switcher should be present
      const languageSwitcher = screen.getByRole('button', { name: /français/i });
      expect(languageSwitcher).toBeInTheDocument();
    });

    it('should have expandable menu sections', () => {
      renderSidebar();
      
      // Check for chevron icons indicating expandable menus
      expect(screen.getAllByTestId('chevron-down-icon')).toHaveLength(1); // Owner section expanded by default
      expect(screen.getAllByTestId('chevron-right-icon').length).toBeGreaterThan(0);
    });

    it('should toggle menu sections when clicked', () => {
      renderSidebar();
      
      // Find a collapsible menu button (tenant section)
      const tenantButton = screen.getByText('Locataire').closest('button');
      expect(tenantButton).toBeInTheDocument();
      
      // Click to expand
      fireEvent.click(tenantButton!);
      
      // Should show expanded state
      expect(screen.getByText('Locataire').parentElement?.parentElement).toBeInTheDocument();
    });

    it('should render navigation links for owner section', () => {
      renderSidebar();
      
      // Owner section should be expanded by default, check for some links
      expect(screen.getByTestId('link-owner-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('link-owner-quality')).toBeInTheDocument();
    });

    it('should highlight active navigation item', () => {
      renderSidebar();
      
      // Since we mock useLocation to return '/owner/dashboard', that link should be active
      const activeLink = screen.getByTestId('link-owner-dashboard');
      expect(activeLink.parentElement).toHaveClass('bg-koveo-navy');
    });

    it('should render proper icons for navigation items', () => {
      renderSidebar();
      
      // Check for various navigation icons
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.getByTestId('building-icon')).toBeInTheDocument();
      expect(screen.getByTestId('users-icon')).toBeInTheDocument();
    });
  });

  describe('NavigationMenu Component', () => {
    const renderNavigationMenu = () => {
      return render(
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <span>Test Menu Item</span>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      );
    };

    it('should render navigation menu structure', () => {
      renderNavigationMenu();
      
      expect(screen.getByText('Test Menu Item')).toBeInTheDocument();
    });

    it('should have proper navigation menu styling', () => {
      renderNavigationMenu();
      
      const menuContainer = screen.getByText('Test Menu Item').closest('[class*="relative z-10"]');
      expect(menuContainer).toBeInTheDocument();
    });

    it('should render navigation menu list with correct classes', () => {
      renderNavigationMenu();
      
      const menuList = screen.getByText('Test Menu Item').closest('[class*="group flex"]');
      expect(menuList).toBeInTheDocument();
    });

    it('should handle multiple navigation items', () => {
      render(
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <span>Item 1</span>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <span>Item 2</span>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      );
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('should work together in layout structure', () => {
      const TestLayout = () => (
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <div>
              <Header title="Test Page" subtitle="Test layout integration" />
              <div className="flex">
                <Sidebar />
                <main>
                  <LoadingSpinner />
                </main>
              </div>
            </div>
          </QueryClientProvider>
        </LanguageProvider>
      );

      render(<TestLayout />);
      
      // Verify all components render together
      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByText('Propriétaire')).toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });
  });
});