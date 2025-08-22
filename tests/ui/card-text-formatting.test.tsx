/**
 * @file Card Text Formatting Tests.
 * @description Tests for text formatting, overflow handling, and layout issues in demand cards.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import '@testing-library/jest-dom';

// Mock demand card component for testing
const DemandCard = ({ demand }: { demand: any }) => {
  return (
    <div 
      className="bg-white rounded-lg border p-4 shadow-sm max-w-sm"
      data-testid="demand-card"
      style={{ width: '320px', height: 'auto' }}
    >
      {/* Header with type and status */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 capitalize">
            {demand.type}
          </span>
          <span 
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyles(demand.status)}`}
            data-testid="status-badge"
          >
            {demand.status}
          </span>
        </div>
        <div className="flex gap-1">
          <button className="p-1 rounded hover:bg-gray-100" aria-label="View details">
            👁️
          </button>
          <button className="p-1 rounded hover:bg-gray-100" aria-label="Add comment">
            💬
          </button>
        </div>
      </div>

      {/* Main content with truncated description */}
      <div className="mb-3">
        <h3 
          className="text-gray-900 font-medium line-clamp-2 text-sm leading-5"
          data-testid="demand-title"
          title={demand.description}
        >
          {demand.description}
        </h3>
      </div>

      {/* Building and residence info */}
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span className="font-medium">Building:</span>
          <span 
            className="truncate ml-2 flex-1 text-right"
            data-testid="building-name"
            title={demand.building?.name || 'Unknown'}
          >
            {demand.building?.name || 'Unknown'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Residence:</span>
          <span 
            className="truncate ml-2 flex-1 text-right"
            data-testid="residence-unit"
            title={demand.residence?.unitNumber || 'N/A'}
          >
            {demand.residence?.unitNumber || 'N/A'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Created:</span>
          <span className="ml-2 text-right">
            {new Date(demand.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper function for status styles
/**
 *
 * @param status
 */
/**
 * GetStatusStyles function.
 * @param status
 * @returns Function result.
 */
function getStatusStyles(status: string) {
  const styles = {
    submitted: 'bg-blue-100 text-blue-800',
    under_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-gray-100 text-gray-800',
    rejected: 'bg-red-100 text-red-800'
  };
  return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
}

// Test data with various text lengths
const testDemands = {
  shortText: {
    id: '1',
    type: 'maintenance',
    status: 'submitted',
    description: 'Faucet leak',
    building: { name: 'Building A' },
    residence: { unitNumber: '101' },
    createdAt: '2025-08-20T10:00:00Z'
  },
  mediumText: {
    id: '2',
    type: 'complaint',
    status: 'under_review',
    description: 'The building entrance door is not closing properly and needs adjustment',
    building: { name: 'Residential Complex North Wing' },
    residence: { unitNumber: '2B-405' },
    createdAt: '2025-08-19T15:30:00Z'
  },
  longText: {
    id: '3',
    type: 'maintenance',
    status: 'approved',
    description: 'My apartment door lock is sticking and very difficult to open, especially during cold weather. The mechanism seems to be jamming and I sometimes have to force it which is concerning for security. This has been happening for several weeks now and is getting progressively worse. I would appreciate if someone could look at this as soon as possible since it affects my daily access to the apartment.',
    building: { 
      name: 'The Grand Metropolitan Residential Tower Complex Building North Wing Section A' 
    },
    residence: { unitNumber: 'PENTHOUSE-2B-405-WEST' },
    createdAt: '2025-08-18T09:15:00Z'
  },
  veryLongText: {
    id: '4',
    type: 'information',
    status: 'in_progress',
    description: 'Could you please provide the schedule for building maintenance activities including elevator servicing, cleaning schedules, landscaping work, parking lot maintenance, emergency system testing, fire alarm checks, sprinkler system inspections, and any other regular maintenance that might affect residents? I would like to plan accordingly and know when there might be noise or access restrictions. Also, could you include information about any upcoming renovations or construction work that might impact our daily routines? This would be very helpful for all residents to have this information available in advance so we can make appropriate arrangements.',
    building: { 
      name: 'Super Long Building Name That Definitely Will Not Fit In A Single Line And Should Be Truncated Properly' 
    },
    residence: { unitNumber: 'UNIT-999-EXTRA-LONG-DESIGNATION-THAT-OVERFLOWS' },
    createdAt: '2025-08-17T14:20:00Z'
  }
};

describe('Card Text Formatting Tests', () => {
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

  describe('Text Truncation and Overflow', () => {
    it('should properly truncate long descriptions with ellipsis', () => {
      renderWithProviders(<DemandCard demand={testDemands.longText} />);
      
      const titleElement = screen.getByTestId('demand-title');
      
      // Check that the title attribute contains the full text for tooltip
      expect(titleElement).toHaveAttribute('title', testDemands.longText.description);
      
      // Check that line-clamp-2 class is applied for truncation
      expect(titleElement).toHaveClass('line-clamp-2');
      
      // Verify the element dimensions don't exceed expected bounds
      const cardElement = screen.getByTestId('demand-card');
      const cardRect = cardElement.getBoundingClientRect();
      expect(cardRect.width).toBeLessThanOrEqual(320);
    });

    it('should handle very long building names with truncation', () => {
      renderWithProviders(<DemandCard demand={testDemands.veryLongText} />);
      
      const buildingElement = screen.getByTestId('building-name');
      
      // Check that truncate class is applied
      expect(buildingElement).toHaveClass('truncate');
      
      // Check that full building name is available in title attribute
      expect(buildingElement).toHaveAttribute('title', testDemands.veryLongText.building.name);
      
      // Ensure text doesn't overflow the container
      expect(buildingElement).toHaveClass('flex-1', 'text-right');
    });

    it('should truncate long residence unit numbers', () => {
      renderWithProviders(<DemandCard demand={testDemands.veryLongText} />);
      
      const residenceElement = screen.getByTestId('residence-unit');
      
      // Check truncation class
      expect(residenceElement).toHaveClass('truncate');
      
      // Check title attribute for full text
      expect(residenceElement).toHaveAttribute('title', testDemands.veryLongText.residence.unitNumber);
    });

    it('should display short text without truncation issues', () => {
      renderWithProviders(<DemandCard demand={testDemands.shortText} />);
      
      const titleElement = screen.getByTestId('demand-title');
      const buildingElement = screen.getByTestId('building-name');
      const residenceElement = screen.getByTestId('residence-unit');
      
      // Short text should display fully
      expect(titleElement.textContent).toBe(testDemands.shortText.description);
      expect(buildingElement.textContent).toBe(testDemands.shortText.building.name);
      expect(residenceElement.textContent).toBe(testDemands.shortText.residence.unitNumber);
    });
  });

  describe('Card Layout Constraints', () => {
    it('should maintain consistent card dimensions across different content lengths', () => {
      const { rerender } = renderWithProviders(<DemandCard demand={testDemands.shortText} />);
      
      const shortCard = screen.getByTestId('demand-card');
      const shortCardRect = shortCard.getBoundingClientRect();
      
      rerender(
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <DemandCard demand={testDemands.longText} />
          </LanguageProvider>
        </QueryClientProvider>
      );
      
      const longCard = screen.getByTestId('demand-card');
      const longCardRect = longCard.getBoundingClientRect();
      
      // Width should be consistent
      expect(Math.abs(shortCardRect.width - longCardRect.width)).toBeLessThan(5);
      
      // Both should respect max width
      expect(shortCardRect.width).toBeLessThanOrEqual(320);
      expect(longCardRect.width).toBeLessThanOrEqual(320);
    });

    it('should prevent horizontal overflow in flexbox layouts', () => {
      renderWithProviders(<DemandCard demand={testDemands.veryLongText} />);
      
      const cardElement = screen.getByTestId('demand-card');
      
      // Check that all child elements respect container boundaries
      const buildingRow = within(cardElement).getByText('Building:').parentElement;
      const residenceRow = within(cardElement).getByText('Residence:').parentElement;
      
      expect(buildingRow).toHaveClass('flex', 'justify-between');
      expect(residenceRow).toHaveClass('flex', 'justify-between');
      
      // Elements with potential overflow should have truncate class
      const buildingValue = within(buildingRow!).getByTestId('building-name');
      const residenceValue = within(residenceRow!).getByTestId('residence-unit');
      
      expect(buildingValue).toHaveClass('truncate');
      expect(residenceValue).toHaveClass('truncate');
    });
  });

  describe('Status Badge Formatting', () => {
    it('should format status badges consistently regardless of text length', () => {
      const statuses = ['submitted', 'under_review', 'approved', 'in_progress', 'completed', 'rejected'];
      
      statuses.forEach(status => {
        const demand = { ...testDemands.shortText, status };
        const { rerender } = renderWithProviders(<DemandCard demand={demand} />);
        
        const statusBadge = screen.getByTestId('status-badge');
        
        // Check basic styling classes
        expect(statusBadge).toHaveClass('px-2', 'py-1', 'rounded-full', 'text-xs', 'font-medium');
        
        // Check that text content matches status
        expect(statusBadge.textContent).toBe(status);
        
        // Verify status-specific coloring is applied
        const className = statusBadge.className;
        expect(className).toMatch(/(bg-\w+-100|text-\w+-800)/);
        
        rerender(<div />);
      });
    });

    it('should handle long status text appropriately', () => {
      const demandWithLongStatus = {
        ...testDemands.shortText,
        status: 'very_long_status_name_that_might_break_layout'
      };
      
      renderWithProviders(<DemandCard demand={demandWithLongStatus} />);
      
      const statusBadge = screen.getByTestId('status-badge');
      
      // Should still maintain basic badge structure
      expect(statusBadge).toHaveClass('px-2', 'py-1', 'rounded-full', 'text-xs');
      
      // Should not break the header layout
      const cardElement = screen.getByTestId('demand-card');
      expect(cardElement.getBoundingClientRect().width).toBeLessThanOrEqual(320);
    });
  });

  describe('Responsive Text Sizing', () => {
    it('should use appropriate text sizes for different content types', () => {
      renderWithProviders(<DemandCard demand={testDemands.mediumText} />);
      
      // Main title should be readable but compact
      const titleElement = screen.getByTestId('demand-title');
      expect(titleElement).toHaveClass('text-sm');
      
      // Type label should be smaller
      const typeElement = screen.getByText(testDemands.mediumText.type);
      expect(typeElement).toHaveClass('text-sm');
      
      // Status badge should be extra small
      const statusBadge = screen.getByTestId('status-badge');
      expect(statusBadge).toHaveClass('text-xs');
      
      // Metadata should be smallest
      const buildingLabel = screen.getByText('Building:');
      expect(buildingLabel.parentElement).toHaveClass('text-xs');
    });

    it('should maintain readability with proper line height', () => {
      renderWithProviders(<DemandCard demand={testDemands.longText} />);
      
      const titleElement = screen.getByTestId('demand-title');
      
      // Check that line height is set appropriately for multiline text
      expect(titleElement).toHaveClass('leading-5');
      
      // Verify line clamp is applied for consistent height
      expect(titleElement).toHaveClass('line-clamp-2');
    });
  });

  describe('Accessibility and Usability', () => {
    it('should provide tooltips for truncated text', () => {
      renderWithProviders(<DemandCard demand={testDemands.longText} />);
      
      const titleElement = screen.getByTestId('demand-title');
      const buildingElement = screen.getByTestId('building-name');
      const residenceElement = screen.getByTestId('residence-unit');
      
      // All potentially truncated elements should have title attributes
      expect(titleElement).toHaveAttribute('title');
      expect(buildingElement).toHaveAttribute('title');
      expect(residenceElement).toHaveAttribute('title');
      
      // Title attributes should contain full text
      expect(titleElement.getAttribute('title')).toBe(testDemands.longText.description);
      expect(buildingElement.getAttribute('title')).toBe(testDemands.longText.building.name);
      expect(residenceElement.getAttribute('title')).toBe(testDemands.longText.residence.unitNumber);
    });

    it('should provide proper aria labels for action buttons', () => {
      renderWithProviders(<DemandCard demand={testDemands.shortText} />);
      
      const viewButton = screen.getByLabelText('View details');
      const commentButton = screen.getByLabelText('Add comment');
      
      expect(viewButton).toBeInTheDocument();
      expect(commentButton).toBeInTheDocument();
      
      // Buttons should have appropriate hover states
      expect(viewButton).toHaveClass('hover:bg-gray-100');
      expect(commentButton).toHaveClass('hover:bg-gray-100');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing or null data gracefully', () => {
      const incompleteData = {
        id: '5',
        type: 'maintenance',
        status: 'submitted',
        description: 'Test demand',
        building: null,
        residence: null,
        createdAt: '2025-08-20T10:00:00Z'
      };
      
      renderWithProviders(<DemandCard demand={incompleteData} />);
      
      const buildingElement = screen.getByTestId('building-name');
      const residenceElement = screen.getByTestId('residence-unit');
      
      // Should display fallback text
      expect(buildingElement.textContent).toBe('Unknown');
      expect(residenceElement.textContent).toBe('N/A');
      
      // Should have appropriate title attributes
      expect(buildingElement).toHaveAttribute('title', 'Unknown');
      expect(residenceElement).toHaveAttribute('title', 'N/A');
    });

    it('should handle empty strings appropriately', () => {
      const emptyStringData = {
        id: '6',
        type: 'complaint',
        status: 'submitted',
        description: '',
        building: { name: '' },
        residence: { unitNumber: '' },
        createdAt: '2025-08-20T10:00:00Z'
      };
      
      renderWithProviders(<DemandCard demand={emptyStringData} />);
      
      const titleElement = screen.getByTestId('demand-title');
      const buildingElement = screen.getByTestId('building-name');
      const residenceElement = screen.getByTestId('residence-unit');
      
      // Empty description should still render element
      expect(titleElement).toBeInTheDocument();
      expect(titleElement.textContent).toBe('');
      
      // Empty building/residence should show fallback
      expect(buildingElement.textContent).toBe('Unknown');
      expect(residenceElement.textContent).toBe('N/A');
    });

    it('should handle special characters and unicode text', () => {
      const unicodeData = {
        id: '7',
        type: 'information',
        status: 'approved',
        description: 'Demande d\'information avec des accents: été, hôtel, naïve. Also émojis: 🏠🔧💧',
        building: { name: 'Bâtiment Résidentiel "Les Érables" – Montréal' },
        residence: { unitNumber: 'Unité #42-Ω' },
        createdAt: '2025-08-20T10:00:00Z'
      };
      
      renderWithProviders(<DemandCard demand={unicodeData} />);
      
      const titleElement = screen.getByTestId('demand-title');
      const buildingElement = screen.getByTestId('building-name');
      const residenceElement = screen.getByTestId('residence-unit');
      
      // Should display special characters correctly
      expect(titleElement.textContent).toContain('été');
      expect(titleElement.textContent).toContain('🏠');
      expect(buildingElement.textContent).toContain('Érables');
      expect(residenceElement.textContent).toContain('Ω');
    });
  });

  describe('Multi-Card Layout Consistency', () => {
    it('should maintain visual alignment across multiple cards with varying content', () => {
      const cardData = [testDemands.shortText, testDemands.mediumText, testDemands.longText];
      
      const MultiCardLayout = () => (
        <div className="grid grid-cols-3 gap-4" data-testid="card-grid">
          {cardData.map((demand, index) => (
            <DemandCard key={index} demand={demand} />
          ))}
        </div>
      );
      
      renderWithProviders(<MultiCardLayout />);
      
      const cards = screen.getAllByTestId('demand-card');
      expect(cards).toHaveLength(3);
      
      // All cards should have consistent width
      const widths = cards.map(card => card.getBoundingClientRect().width);
      const minWidth = Math.min(...widths);
      const maxWidth = Math.max(...widths);
      
      expect(maxWidth - minWidth).toBeLessThan(5); // Allow for minor browser rendering differences
      
      // All cards should maintain their container boundaries
      cards.forEach(card => {
        expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(320);
      });
    });
  });
});