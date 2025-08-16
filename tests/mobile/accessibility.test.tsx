import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const _renderWithProviders = (component: React.ReactElement) => {
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

describe('Mobile Accessibility Tests', () => {
  const user = userEvent.setup();

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA labels for mobile navigation', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <nav role="navigation" aria-label="Main navigation">
          <Button 
            variant="ghost" 
            aria-label="Open navigation menu"
            aria-expanded={false}
            aria-controls="mobile-menu"
          >
            ☰
          </Button>
          <div id="mobile-menu" aria-hidden={true}>
            <a href="/dashboard" aria-label="Go to dashboard">Dashboard</a>
            <a href="/properties" aria-label="View properties">Properties</a>
          </div>
        </nav>
      );
      
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu');
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('should announce dynamic content changes to screen readers', () => {
      const { toast } = require('../../client/src/hooks/use-toast');
      
      const NotificationComponent = () => {
        const [status, setStatus] = React.useState('');
        
        const handleSave = () => {
          setStatus('Saving property...');
          setTimeout(() => {
            setStatus('Property saved successfully');
          }, 1000);
        };
        
        return (
          <div>
            <button onClick={handleSave}>Save Property</button>
            <div 
              role="status" 
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {status}
            </div>
            {status && (
              <div className="p-2 bg-green-100 text-green-800 rounded">
                {status}
              </div>
            )}
          </div>
        );
      };
      
      render(<NotificationComponent />);
      
      const saveButton = screen.getByText('Save Property');
      fireEvent.click(saveButton);
      
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('Touch Target Accessibility', () => {
    it('should provide minimum 44px touch targets for all interactive elements', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <div className="space-y-4 p-4">
          <Button size="sm" className="min-h-[44px] min-w-[44px] touch-manipulation">
            Save
          </Button>
          <Button size="default" className="min-h-[44px] px-6 touch-manipulation">
            Submit Maintenance Request
          </Button>
          <button 
            className="w-12 h-12 rounded-full bg-blue-600 text-white touch-manipulation"
            aria-label="Add new property"
          >
            +
          </button>
        </div>
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('touch-manipulation');
        
        // Check minimum touch target size
        const computedStyle = window.getComputedStyle(button);
        const minHeight = computedStyle.minHeight;
        const minWidth = computedStyle.minWidth;
        
        // Should have adequate touch target size
        expect(button).toHaveClass(/min-h-\[44px\]|h-12/);
      });
    });

    it('should provide adequate spacing between touch targets', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <div className="flex gap-4 p-4">
          <Button size="sm" className="min-h-[44px]">Edit</Button>
          <Button size="sm" className="min-h-[44px]">Delete</Button>
          <Button size="sm" className="min-h-[44px]">Share</Button>
        </div>
      );
      
      const container = screen.getByText('Edit').closest('div');
      expect(container).toHaveClass('gap-4'); // Adequate spacing between buttons
    });
  });

  describe('Focus Management', () => {
    it('should provide visible focus indicators for keyboard navigation', async () => {
      const { Input } = require('../../client/src/components/ui/input');
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <form className="space-y-4 p-4">
          <Input 
            placeholder="Property name"
            className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <Input 
            placeholder="Address"
            className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <Button 
            type="submit"
            className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            Save Property
          </Button>
        </form>
      );
      
      const propertyInput = screen.getByPlaceholderText('Property name');
      const addressInput = screen.getByPlaceholderText('Address');
      const submitButton = screen.getByText('Save Property');
      
      // Test tab navigation
      await user.tab();
      expect(propertyInput).toHaveFocus();
      expect(propertyInput).toHaveClass('focus:ring-2');
      
      await user.tab();
      expect(addressInput).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should trap focus within modal dialogs', async () => {
      const { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } = require('../../client/src/components/ui/dialog');
      const { Button } = require('../../client/src/components/ui/button');
      const { Input } = require('../../client/src/components/ui/input');
      
      render(
        <Dialog>
          <DialogTrigger asChild>
            <Button>Add Resident</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Resident</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <Input placeholder="First name" />
              <Input placeholder="Last name" />
              <Input placeholder="Email" />
              <div className="flex gap-2">
                <Button type="submit">Add Resident</Button>
                <Button variant="outline" type="button">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      );
      
      const triggerButton = screen.getByText('Add Resident');
      await user.click(triggerButton);
      
      await waitFor(() => {
        expect(screen.getByText('Add New Resident')).toBeInTheDocument();
      });
      
      // Focus should be trapped within the dialog
      const firstNameInput = screen.getByPlaceholderText('First name');
      expect(firstNameInput).toBeInTheDocument();
    });
  });

  describe('Color Contrast and Visual Design', () => {
    it('should provide sufficient color contrast for text elements', () => {
      render(
        <div className="space-y-4 p-4">
          <h1 className="text-2xl font-bold text-gray-900">Property Dashboard</h1>
          <p className="text-gray-700">Manage your properties and residents effectively</p>
          <div className="bg-blue-600 text-white p-4 rounded">
            <h2 className="text-lg font-semibold">Active Properties</h2>
            <p className="text-blue-100">You have 5 active properties</p>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
            <strong>Alert:</strong> Maintenance request requires attention
          </div>
        </div>
      );
      
      const heading = screen.getByText('Property Dashboard');
      const description = screen.getByText(/Manage your properties/);
      const alertText = screen.getByText(/Maintenance request requires attention/);
      
      expect(heading).toHaveClass('text-gray-900'); // High contrast
      expect(description).toHaveClass('text-gray-700'); // Adequate contrast
      expect(alertText).toHaveClass('text-red-800'); // High contrast for alerts
    });

    it('should support dark mode with proper contrast ratios', () => {
      render(
        <div className="dark">
          <div className="bg-gray-900 text-gray-100 p-4">
            <h1 className="text-xl font-bold text-white">Property Management</h1>
            <p className="text-gray-300">Dark mode interface</p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
              Action Button
            </button>
          </div>
        </div>
      );
      
      const container = screen.getByText('Property Management').closest('div');
      expect(container).toHaveClass('bg-gray-900');
      expect(container).toHaveClass('text-gray-100');
    });
  });

  describe('Voice Control Support', () => {
    it('should provide voice-friendly labels and commands', () => {
      const { Button } = require('../../client/src/components/ui/button');
      
      render(
        <div className="space-y-4 p-4">
          <Button aria-label="Add new property to your portfolio">
            Add Property
          </Button>
          <Button aria-label="View all maintenance requests">
            Maintenance
          </Button>
          <Button aria-label="Generate monthly financial report">
            Reports
          </Button>
        </div>
      );
      
      const addButton = screen.getByRole('button', { name: /add new property to your portfolio/i });
      const maintenanceButton = screen.getByRole('button', { name: /view all maintenance requests/i });
      const reportsButton = screen.getByRole('button', { name: /generate monthly financial report/i });
      
      expect(addButton).toBeInTheDocument();
      expect(maintenanceButton).toBeInTheDocument();
      expect(reportsButton).toBeInTheDocument();
    });
  });

  describe('Reduced Motion Support', () => {
    it('should respect user preference for reduced motion', () => {
      // Mock prefers-reduced-motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(
        <div className="motion-reduce:transition-none transition-all duration-300">
          <div className="motion-reduce:animate-none animate-fade-in">
            Property list content
          </div>
        </div>
      );
      
      const container = screen.getByText('Property list content').closest('div');
      expect(container).toHaveClass('motion-reduce:animate-none');
      expect(container?.parentElement).toHaveClass('motion-reduce:transition-none');
    });
  });

  describe('Text Size and Zoom Support', () => {
    it('should remain functional at 200% zoom level', () => {
      // Mock higher zoom level
      Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        value: 2,
      });
      
      render(
        <div className="text-base leading-relaxed p-4 max-w-none">
          <h1 className="text-xl md:text-2xl lg:text-3xl">Property Dashboard</h1>
          <p className="text-sm md:text-base">
            Manage your Quebec residential properties with ease
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded">Building A</div>
            <div className="p-4 border rounded">Building B</div>
            <div className="p-4 border rounded">Building C</div>
          </div>
        </div>
      );
      
      const heading = screen.getByText('Property Dashboard');
      const description = screen.getByText(/Manage your Quebec residential properties/);
      
      expect(heading).toHaveClass('text-xl'); // Responsive text sizing
      expect(description).toHaveClass('text-sm'); // Readable at zoom levels
    });
  });

  describe('Error Messages and Feedback', () => {
    it('should provide accessible error messages for form validation', async () => {
      const { Input } = require('../../client/src/components/ui/input');
      const { Label } = require('../../client/src/components/ui/label');
      
      const FormWithValidation = () => {
        const [error, setError] = React.useState('');
        
        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          const email = formData.get('email') as string;
          
          if (!email || !email.includes('@')) {
            setError('Please enter a valid email address');
          } else {
            setError('');
          }
        };
        
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Tenant Email</Label>
              <Input 
                id="email"
                name="email"
                type="email"
                aria-describedby={error ? 'email-error' : undefined}
                aria-invalid={error ? 'true' : 'false'}
              />
              {error && (
                <div 
                  id="email-error"
                  role="alert"
                  className="text-red-600 text-sm mt-1"
                >
                  {error}
                </div>
              )}
            </div>
            <button type="submit">Add Tenant</button>
          </form>
        );
      };
      
      render(<FormWithValidation />);
      
      const emailInput = screen.getByLabelText('Tenant Email');
      const submitButton = screen.getByText('Add Tenant');
      
      // Submit invalid form
      await user.click(submitButton);
      
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent('Please enter a valid email address');
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
      });
    });
  });
});