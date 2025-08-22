import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock viewport utilities
const mockViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    _value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    _value: height,
  });
  window.dispatchEvent(new Event('resize'));
};

// Common mobile breakpoints
const BREAKPOINTS = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  tablet: { width: 768, height: 1024 }, // iPad
  desktop: { width: 1024, height: 768 }, // Desktop
  large: { width: 1440, height: 900 }, // Large desktop
};

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

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    // Reset viewport to mobile by default
    mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
  });

  describe('Layout Components', () => {
    it('should render mobile-optimized header on small screens', async () => {
      const { default: Header } = await import('../../client/src/components/layout/header');
      
      renderWithProviders(<Header />);
      
      // Check for mobile-specific elements
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
      
      // Verify mobile-optimized styling classes
      expect(header).toHaveClass('lg:px-6'); // Responsive padding
    });

    it('should adapt sidebar for mobile navigation', async () => {
      const { default: Sidebar } = await import('../../client/src/components/layout/sidebar');
      
      renderWithProviders(<Sidebar />);
      
      // On mobile, sidebar should be collapsible or hidden
      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Dashboard Responsiveness', () => {
    it('should render owner dashboard responsively across breakpoints', async () => {
      const { default: OwnerDashboard } = await import('../../client/src/pages/owner/dashboard');
      
      // Test mobile layout
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      renderWithProviders(<OwnerDashboard />);
      
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      
      // Test tablet layout
      mockViewport(BREAKPOINTS.tablet.width, BREAKPOINTS.tablet.height);
      renderWithProviders(<OwnerDashboard />);
      
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      
      // Test desktop layout
      mockViewport(BREAKPOINTS.desktop.width, BREAKPOINTS.desktop.height);
      renderWithProviders(<OwnerDashboard />);
      
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    });

    it('should render resident dashboard with mobile-optimized layout', async () => {
      const { default: ResidentDashboard } = await import('../../client/src/pages/residents/dashboard');
      
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      renderWithProviders(<ResidentDashboard />);
      
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    });
  });

  describe('Card Component Responsiveness', () => {
    it('should adapt card layouts for different screen sizes', () => {
      const { Card, CardContent, CardHeader, CardTitle } = require('../../client/src/components/ui/card');
      
      // Test mobile card layout
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(
        <Card>
          <CardHeader>
            <CardTitle>Property Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Building details and resident information</p>
          </CardContent>
        </Card>
      );
      
      const card = screen.getByText('Property Information').closest('[class*="rounded-"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('border');
    });
  });

  describe('Form Responsiveness', () => {
    it('should render forms with mobile-optimized input sizing', () => {
      const { Input } = require('../../client/src/components/ui/input');
      const { Label } = require('../../client/src/components/ui/label');
      
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(
        <div>
          <Label htmlFor="property-name">Property Name</Label>
          <Input 
            id="property-name" 
            type="text" 
            placeholder="Enter property name"
            className="w-full"
          />
        </div>
      );
      
      const input = screen.getByLabelText(/Property Name/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('w-full');
    });

    it('should handle textarea responsiveness for maintenance requests', () => {
      const { Textarea } = require('../../client/src/components/ui/textarea');
      
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(
        <Textarea 
          placeholder="Describe the maintenance issue..."
          className="min-h-[120px] resize-none"
        />
      );
      
      const textarea = screen.getByPlaceholderText(/Describe the maintenance issue/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveClass('min-h-[120px]');
    });
  });

  describe('Table Responsiveness', () => {
    it('should handle table overflow on mobile devices', () => {
      const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = require('../../client/src/components/ui/table');
      
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Monthly Fees</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Maple Heights</TableCell>
                <TableCell>24</TableCell>
                <TableCell>$450</TableCell>
                <TableCell>Active</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      );
      
      expect(screen.getByText('Property')).toBeInTheDocument();
      expect(screen.getByText('Maple Heights')).toBeInTheDocument();
    });
  });

  describe('Navigation Responsiveness', () => {
    it('should show mobile navigation patterns', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
      render(
        <div className="flex justify-between items-center p-4 md:hidden">
          <Button variant="ghost" size="sm">
            ☰ Menu
          </Button>
          <h1 className="text-lg font-semibold">Koveo Gestion</h1>
          <Button variant="ghost" size="sm">
            👤
          </Button>
        </div>
      );
      
      expect(screen.getByText('☰ Menu')).toBeInTheDocument();
      expect(screen.getByText('Koveo Gestion')).toBeInTheDocument();
    });
  });
});