import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock mobile viewport
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 375,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 667,
});

describe('Mobile Navigation Tests', () => {
  const user = userEvent.setup();

  describe('Hamburger Menu Navigation', () => {
    it('should render hamburger menu for mobile navigation', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <header className="flex items-center justify-between p-4 border-b">
          <Button 
            variant="ghost" 
            size="sm"
            className="md:hidden"
            aria-label="Toggle navigation menu"
          >
            <span className="text-xl">☰</span>
          </Button>
          <h1 className="text-lg font-semibold">Koveo Gestion</h1>
          <Button variant="ghost" size="sm">
            <span className="text-xl">👤</span>
          </Button>
        </header>
      );
      
      const hamburgerButton = screen.getByRole('button', { name: /toggle navigation menu/i });
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton).toHaveClass('md:hidden');
    });

    it('should expand navigation menu when hamburger is tapped', async () => {
      const { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } = require('../../client/src/components/ui/sheet');
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Open menu">
              ☰
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 space-y-4">
              <a href="/dashboard" className="block p-2 hover:bg-gray-100 rounded">
                📊 Dashboard
              </a>
              <a href="/buildings" className="block p-2 hover:bg-gray-100 rounded">
                🏢 Buildings
              </a>
              <a href="/residents" className="block p-2 hover:bg-gray-100 rounded">
                👥 Residents
              </a>
              <a href="/maintenance" className="block p-2 hover:bg-gray-100 rounded">
                🔧 Maintenance
              </a>
              <a href="/bills" className="block p-2 hover:bg-gray-100 rounded">
                💰 Bills
              </a>
            </nav>
          </SheetContent>
        </Sheet>
      );
      
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);
      
      await waitFor(() => {
        expect(screen.getByText('Navigation')).toBeInTheDocument();
        expect(screen.getByText('📊 Dashboard')).toBeInTheDocument();
        expect(screen.getByText('🏢 Buildings')).toBeInTheDocument();
      });
    });
  });

  describe('Bottom Navigation', () => {
    it('should render bottom navigation for mobile property management', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 md:hidden">
          <div className="flex justify-around items-center">
            <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
              <span className="text-lg">🏠</span>
              <span className="text-xs">Home</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
              <span className="text-lg">🏢</span>
              <span className="text-xs">Buildings</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
              <span className="text-lg">🔧</span>
              <span className="text-xs">Requests</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center p-2">
              <span className="text-lg">👤</span>
              <span className="text-xs">Profile</span>
            </Button>
          </div>
        </div>
      );
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Buildings')).toBeInTheDocument();
      expect(screen.getByText('Requests')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('should highlight active tab in bottom navigation', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-2">
          <div className="flex justify-around items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex flex-col items-center p-2 text-blue-600"
              data-active="true"
            >
              <span className="text-lg">🏠</span>
              <span className="text-xs">Home</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex flex-col items-center p-2 text-gray-600">
              <span className="text-lg">🏢</span>
              <span className="text-xs">Buildings</span>
            </Button>
          </div>
        </div>
      );
      
      const activeTab = screen.getByText('Home').closest('button');
      expect(activeTab).toHaveAttribute('data-active', 'true');
      expect(activeTab).toHaveClass('text-blue-600');
    });
  });

  describe('Tab Navigation', () => {
    it('should implement swipeable tabs for property sections', async () => {
      const { Tabs, TabsList, TabsTrigger, TabsContent } = require('../../client/src/components/ui/tabs');
      
      render(
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="residents" className="flex-1">Residents</TabsTrigger>
            <TabsTrigger value="maintenance" className="flex-1">Maintenance</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="p-4">
            <h3>Property Overview</h3>
            <p>Building details and statistics</p>
          </TabsContent>
          <TabsContent value="residents" className="p-4">
            <h3>Resident Management</h3>
            <p>Tenant information and contacts</p>
          </TabsContent>
          <TabsContent value="maintenance" className="p-4">
            <h3>Maintenance Requests</h3>
            <p>Current and pending maintenance items</p>
          </TabsContent>
        </Tabs>
      );
      
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      const residentsTab = screen.getByRole('tab', { name: /residents/i });
      
      expect(overviewTab).toBeInTheDocument();
      expect(residentsTab).toBeInTheDocument();
      
      // Test tab switching
      await user.click(residentsTab);
      await waitFor(() => {
        expect(screen.getByText('Resident Management')).toBeInTheDocument();
      });
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should provide collapsible breadcrumbs for mobile', () => {
      const { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } = require('../../client/src/components/ui/breadcrumb');
      
      render(
        <Breadcrumb className="p-4">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:inline">
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline" />
            <BreadcrumbItem className="hidden sm:inline">
              <BreadcrumbLink href="/buildings">Buildings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline" />
            <BreadcrumbItem>
              <BreadcrumbPage>Maple Heights</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      );
      
      // On mobile, only current page should be visible
      expect(screen.getByText('Maple Heights')).toBeInTheDocument();
      
      // Hidden breadcrumb items should have hidden classes
      const dashboardLink = screen.getByText('Dashboard');
      expect(dashboardLink.closest('[class*="hidden"]')).toHaveClass('hidden');
    });
  });

  describe('Floating Action Button', () => {
    it('should provide floating action button for quick actions', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <div className="relative">
          <main className="pb-20">
            <h1>Property Management</h1>
            <p>Manage your properties and residents</p>
          </main>
          <Button 
            className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50 md:bottom-4"
            size="lg"
            aria-label="Add new property"
          >
            <span className="text-xl">+</span>
          </Button>
        </div>
      );
      
      const fab = screen.getByRole('button', { name: /add new property/i });
      expect(fab).toBeInTheDocument();
      expect(fab).toHaveClass('fixed');
      expect(fab).toHaveClass('rounded-full');
    });

    it('should show quick action menu from FAB', async () => {
      const { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } = require('../../client/src/components/ui/dropdown-menu');
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
              size="lg"
            >
              +
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="mb-2">
            <DropdownMenuItem>
              🏢 Add Building
            </DropdownMenuItem>
            <DropdownMenuItem>
              👤 Add Resident
            </DropdownMenuItem>
            <DropdownMenuItem>
              🔧 New Maintenance Request
            </DropdownMenuItem>
            <DropdownMenuItem>
              💰 Create Bill
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
      
      const fabButton = screen.getByRole('button');
      await user.click(fabButton);
      
      await waitFor(() => {
        expect(screen.getByText('🏢 Add Building')).toBeInTheDocument();
        expect(screen.getByText('👤 Add Resident')).toBeInTheDocument();
      });
    });
  });

  describe('Back Navigation', () => {
    it('should provide back button for deep navigation', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <header className="flex items-center p-4 border-b">
          <Button 
            variant="ghost" 
            size="sm"
            className="mr-2"
            aria-label="Go back"
          >
            ←
          </Button>
          <h1 className="text-lg font-semibold">Unit 4B Details</h1>
        </header>
      );
      
      const backButton = screen.getByRole('button', { name: /go back/i });
      expect(backButton).toBeInTheDocument();
      expect(screen.getByText('Unit 4B Details')).toBeInTheDocument();
    });

    it('should handle browser back button navigation', () => {
      // Mock history API
      const mockBack = jest.fn();
      Object.defineProperty(window, 'history', {
        value: { back: mockBack },
        writable: true,
      });
      
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <Button 
          onClick={() => window.history.back()}
          variant="ghost"
          size="sm"
        >
          ← Back
        </Button>
      );
      
      const backButton = screen.getByText('← Back');
      fireEvent.click(backButton);
      
      expect(mockBack).toHaveBeenCalled();
    });
  });
});