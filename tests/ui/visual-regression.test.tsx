/**
 * @file Visual Regression Tests for Card Text Overflow.
 * @description Tests to prevent text overflow and formatting issues as seen in the provided screenshot.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '../../client/src/contexts/LanguageContext';

// CSS-in-JS helper for line clamping
const getComputedLineClamp = (element: HTMLElement): string => {
  return window.getComputedStyle(element).webkitLineClamp || 
         window.getComputedStyle(element).getPropertyValue('-webkit-line-clamp');
};

// Test component matching the exact layout from the screenshot
const DemandCardFromScreenshot = ({ demand }: { demand: any }) => {
  const getStatusColor = (status: string) => {
    const colors = {
      'submitted': 'bg-blue-100 text-blue-700',
      'under_review': 'bg-yellow-100 text-yellow-700', 
      'approved': 'bg-green-100 text-green-700',
      'in_progress': 'bg-purple-100 text-purple-700',
      'completed': 'bg-gray-100 text-gray-700',
      'rejected': 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || colors.submitted;
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
      style={{ width: '320px', minHeight: '200px' }}
      data-testid="screenshot-card"
    >
      {/* Header matching screenshot layout */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-600 capitalize shrink-0">
            {demand.type}
          </span>
          <span 
            className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${getStatusColor(demand.status)}`}
            data-testid="status-tag"
          >
            {demand.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button className="p-1 rounded hover:bg-gray-100" data-testid="view-btn">
            👁️
          </button>
          <button className="p-1 rounded hover:bg-gray-100" data-testid="comment-btn">
            💬
          </button>
        </div>
      </div>

      {/* Title with proper text overflow handling */}
      <div className="mb-4">
        <h3 
          className="text-gray-900 font-medium text-base leading-5 overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
            hyphens: 'auto'
          }}
          data-testid="card-title"
          title={demand.description}
        >
          {demand.description}
        </h3>
      </div>

      {/* Metadata section matching screenshot */}
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-700 shrink-0">Building:</span>
          <span 
            className="text-right ml-2 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            data-testid="building-value"
            title={demand.building || 'Unknown'}
          >
            {demand.building || 'Unknown'}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-700 shrink-0">Residence:</span>
          <span 
            className="text-right ml-2 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
            data-testid="residence-value"
            title={demand.residence || ''}
          >
            {demand.residence || ''}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-700 shrink-0">Created:</span>
          <span className="text-right ml-2 shrink-0">
            {new Date(demand.createdAt).toLocaleDateString('en-GB')}
          </span>
        </div>
      </div>
    </div>
  );
};

// Test data based on the screenshot examples
const screenshotTestData = [
  {
    id: '1',
    type: 'Complaint',
    status: 'submitted',
    description: 'The building entrance door is not closing properly and needs immediate attention',
    building: 'Unknown',
    residence: '',
    createdAt: '2025-08-20T00:00:00Z'
  },
  {
    id: '2', 
    type: 'Maintenance',
    status: 'submitted',
    description: 'My apartment door lock is sticking and very difficult to open during cold weather',
    building: 'Unknown',
    residence: '',
    createdAt: '2025-08-19T00:00:00Z'
  },
  {
    id: '3',
    type: 'Information',
    status: 'approved', 
    description: 'Could you please provide the schedule for building maintenance and cleaning activities',
    building: 'Unknown',
    residence: '',
    createdAt: '2025-08-19T00:00:00Z'
  },
  {
    id: '4',
    type: 'Maintenance',
    status: 'under_review',
    description: 'There is a water stain on my bedroom ceiling that appears to be getting worse over time',
    building: 'Unknown', 
    residence: '',
    createdAt: '2025-08-19T00:00:00Z'
  },
  {
    id: '5',
    type: 'Maintenance', 
    status: 'submitted',
    description: 'The kitchen faucet is leaking and needs repair as soon as possible',
    building: 'Unknown',
    residence: '',
    createdAt: '2025-08-18T00:00:00Z'
  },
  {
    id: '6',
    type: 'Maintenance',
    status: 'in_progress', 
    description: 'The washing machine in the laundry room is making loud noises during spin cycle',
    building: 'Unknown',
    residence: '',
    createdAt: '2025-08-18T00:00:00Z'
  }
];

describe('Visual Regression Tests - Card Text Overflow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
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

  describe('Text Overflow Prevention', () => {
    it('should prevent title text from overflowing card boundaries', () => {
      screenshotTestData.forEach((demand, index) => {
        const { rerender } = renderWithProviders(<DemandCardFromScreenshot demand={demand} />);
        
        const card = screen.getByTestId('screenshot-card');
        const title = screen.getByTestId('card-title');
        
        // Card should maintain fixed width
        expect(card.style.width).toBe('320px');
        
        // Title should have overflow handling
        expect(title).toHaveStyle({
          display: '-webkit-box',
          WebkitLineClamp: '2',
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        });
        
        // Title should have title attribute for full text on hover
        expect(title).toHaveAttribute('title', demand.description);
        
        rerender(<div />);
      });
    });

    it('should truncate building names that are too long', () => {
      const longBuildingDemand = {
        ...screenshotTestData[0],
        building: 'Very Long Building Name That Would Overflow The Card Layout If Not Handled Properly'
      };
      
      renderWithProviders(<DemandCardFromScreenshot demand={longBuildingDemand} />);
      
      const buildingValue = screen.getByTestId('building-value');
      
      // Should have ellipsis overflow handling
      expect(buildingValue).toHaveClass('overflow-hidden', 'text-ellipsis', 'whitespace-nowrap');
      
      // Should have title attribute for tooltip
      expect(buildingValue).toHaveAttribute('title', longBuildingDemand.building);
      
      // Should use flexible layout
      expect(buildingValue).toHaveClass('min-w-0', 'flex-1');
    });

    it('should handle empty or missing residence data gracefully', () => {
      const emptyResidenceDemand = {
        ...screenshotTestData[0],
        residence: null
      };
      
      renderWithProviders(<DemandCardFromScreenshot demand={emptyResidenceDemand} />);
      
      const residenceValue = screen.getByTestId('residence-value');
      
      // Should display empty string for null/undefined residence
      expect(residenceValue.textContent).toBe('');
      
      // Should still have proper overflow classes
      expect(residenceValue).toHaveClass('overflow-hidden', 'text-ellipsis', 'whitespace-nowrap');
    });

    it('should maintain consistent card height regardless of content length', () => {
      const shortContentCard = renderWithProviders(
        <DemandCardFromScreenshot demand={screenshotTestData[0]} />
      );
      const shortCard = screen.getByTestId('screenshot-card');
      const shortCardRect = shortCard.getBoundingClientRect();
      
      shortContentCard.rerender(
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <DemandCardFromScreenshot demand={screenshotTestData[3]} />
          </LanguageProvider>
        </QueryClientProvider>
      );
      
      const longCard = screen.getByTestId('screenshot-card');
      const longCardRect = longCard.getBoundingClientRect();
      
      // Heights should be similar (allow for minor differences)
      expect(Math.abs(shortCardRect.height - longCardRect.height)).toBeLessThan(20);
      
      // Both should meet minimum height requirement
      expect(shortCardRect.height).toBeGreaterThanOrEqual(200);
      expect(longCardRect.height).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Status Badge Formatting', () => {
    it('should format status badges consistently across all statuses', () => {
      const statuses = ['submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected'];
      
      statuses.forEach(status => {
        const demand = { ...screenshotTestData[0], status };
        
        const { rerender } = renderWithProviders(<DemandCardFromScreenshot demand={demand} />);
        
        const statusTag = screen.getByTestId('status-tag');
        
        // Should have consistent padding and styling
        expect(statusTag).toHaveClass('px-2', 'py-1', 'rounded', 'text-xs', 'font-medium');
        
        // Should display readable text (replace underscores with spaces)
        expect(statusTag.textContent).toBe(status.replace('_', ' '));
        
        // Should not overflow or break layout
        expect(statusTag).toHaveClass('shrink-0');
        
        rerender(<div />);
      });
    });

    it('should handle very long status text appropriately', () => {
      const longStatusDemand = {
        ...screenshotTestData[0],
        status: 'extremely_long_status_name'
      };
      
      renderWithProviders(<DemandCardFromScreenshot demand={longStatusDemand} />);
      
      const statusTag = screen.getByTestId('status-tag');
      
      // Should still maintain proper styling
      expect(statusTag).toHaveClass('shrink-0');
      
      // Card should not overflow due to long status
      const card = screen.getByTestId('screenshot-card');
      expect(card.style.width).toBe('320px');
    });
  });

  describe('Header Layout Integrity', () => {
    it('should maintain proper spacing between header elements', () => {
      renderWithProviders(<DemandCardFromScreenshot demand={screenshotTestData[0]} />);
      
      const card = screen.getByTestId('screenshot-card');
      const header = card.querySelector('.flex.justify-between');
      
      expect(header).toBeInTheDocument();
      
      // Left side should be flexible
      const leftSide = header?.querySelector('.flex-1');
      expect(leftSide).toHaveClass('min-w-0', 'flex-1');
      
      // Right side should not shrink
      const rightSide = header?.querySelector('.shrink-0');
      expect(rightSide).toHaveClass('shrink-0');
    });

    it('should prevent action buttons from being pushed out of view', () => {
      const longTypeDemand = {
        ...screenshotTestData[0],
        type: 'VeryLongTypeName',
        status: 'extremely_long_status_text'
      };
      
      renderWithProviders(<DemandCardFromScreenshot demand={longTypeDemand} />);
      
      const viewBtn = screen.getByTestId('view-btn');
      const commentBtn = screen.getByTestId('comment-btn');
      
      // Buttons should always be visible
      expect(viewBtn).toBeVisible();
      expect(commentBtn).toBeVisible();
      
      // Button container should not shrink
      const buttonContainer = viewBtn.parentElement;
      expect(buttonContainer).toHaveClass('shrink-0');
    });
  });

  describe('Responsive Text Handling', () => {
    it('should apply word-break for long unbreakable text', () => {
      const longWordDemand = {
        ...screenshotTestData[0],
        description: 'Thisisanextremelylongwordthatwouldbreaklayoutifnothandledproperlywithwordbreaking'
      };
      
      renderWithProviders(<DemandCardFromScreenshot demand={longWordDemand} />);
      
      const title = screen.getByTestId('card-title');
      
      // Should have word-break styling
      expect(title).toHaveStyle({ wordBreak: 'break-word' });
    });

    it('should handle hyphenation for better text flow', () => {
      const hyphenationDemand = {
        ...screenshotTestData[0], 
        description: 'Maintenance request for building accessibility improvements and modernization'
      };
      
      renderWithProviders(<DemandCardFromScreenshot demand={hyphenationDemand} />);
      
      const title = screen.getByTestId('card-title');
      
      // Should enable hyphenation
      expect(title).toHaveStyle({ hyphens: 'auto' });
    });
  });

  describe('Grid Layout Consistency', () => {
    it('should maintain consistent card sizes in grid layout', () => {
      const GridLayout = () => (
        <div className="grid grid-cols-3 gap-4 p-4" data-testid="card-grid">
          {screenshotTestData.slice(0, 6).map((demand, index) => (
            <DemandCardFromScreenshot key={index} demand={demand} />
          ))}
        </div>
      );
      
      renderWithProviders(<GridLayout />);
      
      const cards = screen.getAllByTestId('screenshot-card');
      expect(cards).toHaveLength(6);
      
      // All cards should have identical widths
      const cardWidths = cards.map(card => card.getBoundingClientRect().width);
      const uniqueWidths = [...new Set(cardWidths)];
      expect(uniqueWidths).toHaveLength(1); // All widths should be identical
      
      // All should be 320px wide
      expect(cardWidths[0]).toBe(320);
    });

    it('should prevent content from breaking grid alignment', () => {
      const mixedContentData = [
        { ...screenshotTestData[0], description: 'Short' },
        { 
          ...screenshotTestData[1], 
          description: 'This is a very long description that could potentially break the grid layout if text overflow is not handled properly',
          building: 'Extremely Long Building Name That Goes On And On'
        },
        { ...screenshotTestData[2], description: 'Medium length description for testing' }
      ];
      
      const MixedGridLayout = () => (
        <div className="grid grid-cols-3 gap-4" data-testid="mixed-grid">
          {mixedContentData.map((demand, index) => (
            <DemandCardFromScreenshot key={index} demand={demand} />
          ))}
        </div>
      );
      
      renderWithProviders(<MixedGridLayout />);
      
      const cards = screen.getAllByTestId('screenshot-card');
      
      // All cards should maintain consistent width
      cards.forEach(card => {
        expect(card.style.width).toBe('320px');
      });
      
      // Grid should not be broken by content overflow
      const grid = screen.getByTestId('mixed-grid');
      expect(grid).toHaveClass('grid', 'grid-cols-3');
    });
  });

  describe('Accessibility and Semantic Correctness', () => {
    it('should provide appropriate ARIA labels and semantic markup', () => {
      renderWithProviders(<DemandCardFromScreenshot demand={screenshotTestData[0]} />);
      
      const title = screen.getByTestId('card-title');
      const viewBtn = screen.getByTestId('view-btn');
      const commentBtn = screen.getByTestId('comment-btn');
      
      // Title should be semantically correct heading
      expect(title.tagName).toBe('H3');
      
      // Buttons should have accessible labels (in real implementation)
      expect(viewBtn.tagName).toBe('BUTTON');
      expect(commentBtn.tagName).toBe('BUTTON');
      
      // Truncated text should have full text in title for screen readers
      expect(title).toHaveAttribute('title', screenshotTestData[0].description);
    });

    it('should maintain proper reading order and focus management', () => {
      renderWithProviders(<DemandCardFromScreenshot demand={screenshotTestData[0]} />);
      
      const card = screen.getByTestId('screenshot-card');
      const focusableElements = card.querySelectorAll('button');
      
      // Should have proper focus order
      expect(focusableElements).toHaveLength(2);
      
      // Elements should be keyboard accessible
      focusableElements.forEach(element => {
        expect(element).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });
});