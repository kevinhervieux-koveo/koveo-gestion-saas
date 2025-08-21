/**
 * @file Responsive Card Layout Tests
 * @description Tests for card layout responsiveness and text adaptation across different screen sizes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '../../client/src/contexts/LanguageContext';

// Mock ResizeObserver for testing
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = MockResizeObserver;

// Mock viewport dimensions helper
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // Dispatch resize event
  window.dispatchEvent(new Event('resize'));
};

// Responsive demand card component with breakpoint-aware styling
const ResponsiveDemandCard = ({ demand, className = '' }: { demand: any; className?: string }) => {
  return (
    <div 
      className={`
        bg-white rounded-lg border shadow-sm p-3
        sm:p-4 md:p-5 lg:p-6
        w-full max-w-sm
        sm:max-w-md md:max-w-lg lg:max-w-xl
        ${className}
      `}
      data-testid="responsive-demand-card"
    >
      {/* Header - responsive flex layout */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-medium text-gray-600 capitalize">
            {demand.type}
          </span>
          <span 
            className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${getResponsiveStatusStyles(demand.status)}
            `}
            data-testid="responsive-status-badge"
          >
            {demand.status}
          </span>
        </div>
        
        {/* Action buttons - hidden on very small screens */}
        <div className="flex gap-1 self-end sm:self-auto">
          <button 
            className="p-1 sm:p-2 rounded hover:bg-gray-100 text-xs sm:text-sm hidden sm:block"
            aria-label="View details"
          >
            👁️
          </button>
          <button 
            className="p-1 sm:p-2 rounded hover:bg-gray-100 text-xs sm:text-sm hidden sm:block"
            aria-label="Add comment"
          >
            💬
          </button>
        </div>
      </div>

      {/* Main content - responsive text sizing */}
      <div className="mb-3">
        <h3 
          className={`
            text-gray-900 font-medium
            text-sm leading-5 sm:text-base sm:leading-6
            md:text-lg md:leading-7
            line-clamp-2 sm:line-clamp-3 md:line-clamp-4
          `}
          data-testid="responsive-title"
          title={demand.description}
        >
          {demand.description}
        </h3>
      </div>

      {/* Metadata - responsive layout */}
      <div className="space-y-1 text-xs sm:text-sm text-gray-600">
        {/* Building info */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
          <span className="font-medium shrink-0">Building:</span>
          <span 
            className="truncate sm:text-right"
            data-testid="responsive-building"
            title={demand.building?.name || 'Unknown'}
          >
            {demand.building?.name || 'Unknown'}
          </span>
        </div>
        
        {/* Residence info */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
          <span className="font-medium shrink-0">Residence:</span>
          <span 
            className="truncate sm:text-right"
            data-testid="responsive-residence"
            title={demand.residence?.unitNumber || 'N/A'}
          >
            {demand.residence?.unitNumber || 'N/A'}
          </span>
        </div>
        
        {/* Date info - abbreviated on small screens */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
          <span className="font-medium shrink-0">Created:</span>
          <span className="sm:text-right">
            <span className="sm:hidden">
              {new Date(demand.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
            <span className="hidden sm:inline">
              {new Date(demand.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric',
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

// Responsive status styles helper
function getResponsiveStatusStyles(status: string) {
  const baseStyles = 'bg-opacity-10 border border-opacity-20';
  const statusColors = {
    submitted: 'bg-blue-500 text-blue-700 border-blue-500',
    under_review: 'bg-yellow-500 text-yellow-700 border-yellow-500',
    approved: 'bg-green-500 text-green-700 border-green-500',
    in_progress: 'bg-purple-500 text-purple-700 border-purple-500',
    completed: 'bg-gray-500 text-gray-700 border-gray-500',
    rejected: 'bg-red-500 text-red-700 border-red-500'
  };
  
  return `${baseStyles} ${statusColors[status as keyof typeof statusColors] || statusColors.submitted}`;
}

// Test data
const testDemand = {
  id: '1',
  type: 'maintenance',
  status: 'submitted',
  description: 'The building entrance door is not closing properly and needs immediate attention to ensure security.',
  building: { 
    name: 'Metropolitan Residential Tower Complex Building A' 
  },
  residence: { 
    unitNumber: 'Unit 2B-405' 
  },
  createdAt: '2025-08-20T10:00:00Z'
};

describe('Responsive Card Layout Tests', () => {
  let queryClient: QueryClient;
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // Store original viewport dimensions
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    // Restore original viewport dimensions
    setViewportSize(originalInnerWidth, originalInnerHeight);
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          {component}
        </LanguageProvider>
      </QueryClientProvider>
    );
  };

  describe('Mobile Layout (320px - 639px)', () => {
    beforeEach(() => {
      setViewportSize(375, 667); // iPhone SE dimensions
    });

    it('should stack elements vertically on mobile', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const card = screen.getByTestId('responsive-demand-card');
      
      // Header should stack vertically (flex-col)
      const header = card.querySelector('.flex-col');
      expect(header).toBeInTheDocument();
      
      // Action buttons should be hidden on mobile
      const viewButton = screen.queryByLabelText('View details');
      const commentButton = screen.queryByLabelText('Add comment');
      
      expect(viewButton).not.toBeVisible();
      expect(commentButton).not.toBeVisible();
    });

    it('should use smaller text sizes on mobile', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const title = screen.getByTestId('responsive-title');
      const typeLabel = screen.getByText(testDemand.type);
      
      // Title should use small text size
      expect(title).toHaveClass('text-sm');
      
      // Type label should use extra small text size
      expect(typeLabel).toHaveClass('text-xs');
    });

    it('should display abbreviated date on mobile', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const dateElement = screen.getByText(/aug|20/i);
      expect(dateElement).toBeInTheDocument();
      
      // Should not show full year on mobile
      expect(screen.queryByText('2025')).not.toBeVisible();
    });

    it('should stack metadata labels and values vertically on mobile', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const buildingRow = screen.getByText('Building:').parentElement;
      const residenceRow = screen.getByText('Residence:').parentElement;
      
      // Rows should stack vertically on mobile
      expect(buildingRow).toHaveClass('flex-col');
      expect(residenceRow).toHaveClass('flex-col');
    });
  });

  describe('Tablet Layout (640px - 767px)', () => {
    beforeEach(() => {
      setViewportSize(768, 1024); // iPad dimensions
    });

    it('should show horizontal layout on tablet', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const card = screen.getByTestId('responsive-demand-card');
      
      // Header should use horizontal layout (sm:flex-row)
      const header = card.querySelector('.sm\\:flex-row');
      expect(header).toBeInTheDocument();
      
      // Action buttons should be visible on tablet
      const viewButton = screen.getByLabelText('View details');
      const commentButton = screen.getByLabelText('Add comment');
      
      expect(viewButton).toBeVisible();
      expect(commentButton).toBeVisible();
    });

    it('should use medium text sizes on tablet', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const title = screen.getByTestId('responsive-title');
      const typeLabel = screen.getByText(testDemand.type);
      
      // Title should use base text size on tablet
      expect(title).toHaveClass('sm:text-base');
      
      // Type label should use small text size on tablet
      expect(typeLabel).toHaveClass('sm:text-sm');
    });

    it('should display full date on tablet', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      // Should show full date including year on tablet
      const fullDate = screen.getByText(/2025/);
      expect(fullDate).toBeVisible();
    });

    it('should align metadata horizontally on tablet', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const buildingRow = screen.getByText('Building:').parentElement;
      const residenceRow = screen.getByText('Residence:').parentElement;
      
      // Rows should be horizontal on tablet
      expect(buildingRow).toHaveClass('sm:flex-row', 'sm:justify-between');
      expect(residenceRow).toHaveClass('sm:flex-row', 'sm:justify-between');
    });
  });

  describe('Desktop Layout (768px+)', () => {
    beforeEach(() => {
      setViewportSize(1920, 1080); // Full HD desktop
    });

    it('should use largest text sizes on desktop', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const title = screen.getByTestId('responsive-title');
      
      // Title should use large text size on desktop
      expect(title).toHaveClass('md:text-lg');
    });

    it('should show more lines of text on desktop', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const title = screen.getByTestId('responsive-title');
      
      // Should allow more lines on larger screens
      expect(title).toHaveClass('md:line-clamp-4');
    });

    it('should provide maximum padding on desktop', () => {
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const card = screen.getByTestId('responsive-demand-card');
      
      // Should use largest padding on desktop
      expect(card).toHaveClass('lg:p-6');
    });
  });

  describe('Breakpoint Transitions', () => {
    it('should handle viewport size changes gracefully', () => {
      const { rerender } = renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      // Start with mobile
      setViewportSize(375, 667);
      rerender(
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ResponsiveDemandCard demand={testDemand} />
          </LanguageProvider>
        </QueryClientProvider>
      );
      
      let title = screen.getByTestId('responsive-title');
      expect(title).toHaveClass('text-sm');
      
      // Switch to desktop
      setViewportSize(1920, 1080);
      rerender(
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ResponsiveDemandCard demand={testDemand} />
          </LanguageProvider>
        </QueryClientProvider>
      );
      
      title = screen.getByTestId('responsive-title');
      expect(title).toHaveClass('md:text-lg');
    });

    it('should maintain text truncation across all screen sizes', () => {
      const longTextDemand = {
        ...testDemand,
        description: 'This is an extremely long description that should be truncated on all screen sizes to prevent layout issues and maintain visual consistency across the entire application interface.'
      };

      // Test on multiple screen sizes
      const screenSizes = [
        { width: 375, height: 667 },   // Mobile
        { width: 768, height: 1024 },  // Tablet  
        { width: 1920, height: 1080 }  // Desktop
      ];

      screenSizes.forEach(({ width, height }) => {
        setViewportSize(width, height);
        
        const { rerender } = renderWithProviders(<ResponsiveDemandCard demand={longTextDemand} />);
        
        const title = screen.getByTestId('responsive-title');
        
        // Should have line-clamp on all screen sizes
        expect(title.className).toMatch(/line-clamp-\d+/);
        
        // Should have title attribute for tooltip
        expect(title).toHaveAttribute('title', longTextDemand.description);
        
        rerender(<div />);
      });
    });
  });

  describe('Grid Layout Responsiveness', () => {
    const MultiCardResponsiveGrid = () => {
      const demands = Array.from({ length: 6 }, (_, i) => ({
        ...testDemand,
        id: String(i + 1),
        description: `Test demand ${i + 1} with varying description length to test grid responsiveness.`
      }));

      return (
        <div 
          className={`
            grid gap-4
            grid-cols-1 
            sm:grid-cols-2 
            lg:grid-cols-3 
            xl:grid-cols-4
            2xl:grid-cols-6
            p-4
          `}
          data-testid="responsive-grid"
        >
          {demands.map((demand, index) => (
            <ResponsiveDemandCard key={index} demand={demand} />
          ))}
        </div>
      );
    };

    it('should display single column on mobile', () => {
      setViewportSize(375, 667);
      
      renderWithProviders(<MultiCardResponsiveGrid />);
      
      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveClass('grid-cols-1');
    });

    it('should display two columns on tablet', () => {
      setViewportSize(768, 1024);
      
      renderWithProviders(<MultiCardResponsiveGrid />);
      
      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('should display multiple columns on large desktop', () => {
      setViewportSize(1920, 1080);
      
      renderWithProviders(<MultiCardResponsiveGrid />);
      
      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveClass('lg:grid-cols-3', 'xl:grid-cols-4');
    });

    it('should maintain consistent card spacing in grid', () => {
      setViewportSize(1920, 1080);
      
      renderWithProviders(<MultiCardResponsiveGrid />);
      
      const cards = screen.getAllByTestId('responsive-demand-card');
      expect(cards.length).toBe(6);
      
      // All cards should have consistent classes
      cards.forEach(card => {
        expect(card).toHaveClass('w-full', 'rounded-lg', 'border', 'shadow-sm');
      });
    });
  });

  describe('Touch and Interaction Responsiveness', () => {
    it('should have appropriate touch targets on mobile', () => {
      setViewportSize(375, 667);
      
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const statusBadge = screen.getByTestId('responsive-status-badge');
      
      // Status badge should have adequate padding for touch
      expect(statusBadge).toHaveClass('px-2', 'py-1');
      
      // Card itself should be easily tappable
      const card = screen.getByTestId('responsive-demand-card');
      expect(card).toHaveClass('p-3');
    });

    it('should optimize button sizes for different screen sizes', () => {
      setViewportSize(768, 1024);
      
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Buttons should have responsive padding
      buttons.forEach(button => {
        expect(button).toHaveClass('p-1', 'sm:p-2');
      });
    });
  });

  describe('Accessibility Across Screen Sizes', () => {
    it('should maintain accessibility attributes across breakpoints', () => {
      const screenSizes = [375, 768, 1920];
      
      screenSizes.forEach(width => {
        setViewportSize(width, 1080);
        
        const { rerender } = renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
        
        // Buttons should maintain aria-labels
        if (width >= 640) {
          const viewButton = screen.queryByLabelText('View details');
          const commentButton = screen.queryByLabelText('Add comment');
          
          expect(viewButton).toHaveAttribute('aria-label');
          expect(commentButton).toHaveAttribute('aria-label');
        }
        
        // Title should always have title attribute for truncated text
        const title = screen.getByTestId('responsive-title');
        expect(title).toHaveAttribute('title');
        
        rerender(<div />);
      });
    });

    it('should ensure proper contrast and readability at all sizes', () => {
      setViewportSize(375, 667);
      
      renderWithProviders(<ResponsiveDemandCard demand={testDemand} />);
      
      const title = screen.getByTestId('responsive-title');
      const statusBadge = screen.getByTestId('responsive-status-badge');
      
      // Text should have proper contrast classes
      expect(title).toHaveClass('text-gray-900');
      expect(statusBadge).toHaveClass('text-blue-700'); // Or similar high contrast
      
      // Background should provide adequate contrast
      const card = screen.getByTestId('responsive-demand-card');
      expect(card).toHaveClass('bg-white');
    });
  });
});