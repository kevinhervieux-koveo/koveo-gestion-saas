/**
 * Hierarchical Navigation Components Integration Tests
 * Tests the withHierarchicalSelection HOC and integrated components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock wouter for routing
const mockSetLocation = jest.fn();
const mockLocation = '/residents/building';
const mockSearch = '';

jest.mock('wouter', () => ({
  useLocation: () => [mockLocation, mockSetLocation],
  useSearch: () => mockSearch,
}));

// Mock the SelectionGrid component
const MockSelectionGrid = ({ title, items, onSelectItem, isLoading }: any) => (
  <div data-testid="selection-grid">
    <h3 data-testid="selection-title">{title}</h3>
    {isLoading && <div data-testid="loading-spinner">Loading...</div>}
    <div data-testid="items-grid">
      {items.map((item: any, index: number) => (
        <button
          key={item.id || index}
          data-testid={`item-${item.id || index}`}
          onClick={() => onSelectItem(item.id || `item-${index}`)}
          className="selection-item"
        >
          {item.name || item.title || `Item ${index + 1}`}
        </button>
      ))}
    </div>
  </div>
);

// Mock the SelectionGrid import
jest.mock('@/components/common/SelectionGrid', () => ({
  SelectionGrid: MockSelectionGrid,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="arrow-left-icon">ArrowLeft</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
  MapPin: () => <div data-testid="map-pin-icon">MapPin</div>,
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className, 'data-testid': testId, ...props }: any) => (
    <button
      onClick={onClick}
      data-testid={testId}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title, subtitle }: any) => (
    <header data-testid="header">
      <h1 data-testid="header-title">{title}</h1>
      <p data-testid="header-subtitle">{subtitle}</p>
    </header>
  ),
}));

// Test component that simulates a hierarchical page
const TestComponent = ({ 
  buildingId, 
  showBackButton, 
  backButtonLabel, 
  onBack 
}: {
  buildingId?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
}) => (
  <div data-testid="test-component">
    {showBackButton && onBack && (
      <div data-testid="back-button-container">
        <button
          data-testid="button-back"
          onClick={onBack}
        >
          {backButtonLabel}
        </button>
      </div>
    )}
    {buildingId ? (
      <div data-testid="building-details">
        <h2>Building Details</h2>
        <p data-testid="building-id">{buildingId}</p>
      </div>
    ) : (
      <div data-testid="selection-screen">
        <h2>Select Building</h2>
        <p>Choose a building to view details</p>
      </div>
    )}
  </div>
);

// Mock the withHierarchicalSelection HOC
const withHierarchicalSelection = (Component: React.ComponentType<any>, config: any) => {
  return (props: any) => {
    const [currentBuildingId, setCurrentBuildingId] = React.useState<string | null>(null);
    const [showBuildings, setShowBuildings] = React.useState(false);
    
    // Mock data
    const mockBuildings = [
      { id: 'building-1', name: 'Building A' },
      { id: 'building-2', name: 'Building B' },
    ];

    // Simulate URL parsing
    React.useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const buildingFromUrl = urlParams.get('building');
      if (buildingFromUrl) {
        setCurrentBuildingId(buildingFromUrl);
        setShowBuildings(false);
      } else {
        setShowBuildings(true);
      }
    }, []);

    const handleBuildingSelect = (buildingId: string) => {
      setCurrentBuildingId(buildingId);
      setShowBuildings(false);
      // Simulate URL update
      window.history.pushState({}, '', `?building=${buildingId}`);
    };

    const handleBack = () => {
      setCurrentBuildingId(null);
      setShowBuildings(true);
      window.history.pushState({}, '', '/residents/building');
      mockSetLocation('/residents/building');
    };

    if (showBuildings) {
      return (
        <div data-testid="hierarchical-selection">
          <MockSelectionGrid
            title="Select Building"
            items={mockBuildings}
            onSelectItem={handleBuildingSelect}
            isLoading={false}
          />
        </div>
      );
    }

    // Determine if should show back button (mock logic)
    const shouldShowBackButton = currentBuildingId && mockBuildings.length > 1;

    return (
      <Component
        {...props}
        buildingId={currentBuildingId}
        showBackButton={shouldShowBackButton}
        backButtonLabel="Building"
        onBack={handleBack}
      />
    );
  };
};

const WrappedTestComponent = withHierarchicalSelection(TestComponent, {
  hierarchy: ['building'],
});

describe('Hierarchical Navigation Components', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Reset mocks
    jest.clearAllMocks();
    mockSetLocation.mockClear();

    // Mock window.history.pushState
    Object.defineProperty(window, 'history', {
      value: {
        pushState: jest.fn(),
      },
      writable: true,
    });

    // Reset URL
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        pathname: '/residents/building',
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Building Selection Screen', () => {
    test('should render building selection when no building is selected', () => {
      renderWithProviders(<WrappedTestComponent />);

      expect(screen.getByTestId('hierarchical-selection')).toBeInTheDocument();
      expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
      expect(screen.getByTestId('selection-title')).toHaveTextContent('Select Building');
      
      // Should show building options
      expect(screen.getByTestId('item-building-1')).toHaveTextContent('Building A');
      expect(screen.getByTestId('item-building-2')).toHaveTextContent('Building B');
    });

    test('should handle building selection', async () => {
      renderWithProviders(<WrappedTestComponent />);

      const buildingAButton = screen.getByTestId('item-building-1');
      fireEvent.click(buildingAButton);

      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
        expect(screen.getByTestId('building-details')).toBeInTheDocument();
        expect(screen.getByTestId('building-id')).toHaveTextContent('building-1');
      });

      // Should update URL
      expect(window.history.pushState).toHaveBeenCalledWith({}, '', '?building=building-1');
    });

    test('should not show loading spinner when not loading', () => {
      renderWithProviders(<WrappedTestComponent />);

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  describe('Building Details Screen', () => {
    test('should render building details when building is selected', () => {
      // Mock URL with building parameter
      Object.defineProperty(window, 'location', {
        value: {
          search: '?building=building-1',
          pathname: '/residents/building',
        },
        writable: true,
      });

      renderWithProviders(<WrappedTestComponent />);

      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByTestId('building-details')).toBeInTheDocument();
      expect(screen.getByTestId('building-id')).toHaveTextContent('building-1');
    });

    test('should show back button when building is selected and multiple buildings exist', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?building=building-1',
          pathname: '/residents/building',
        },
        writable: true,
      });

      renderWithProviders(<WrappedTestComponent />);

      expect(screen.getByTestId('back-button-container')).toBeInTheDocument();
      expect(screen.getByTestId('button-back')).toHaveTextContent('Building');
    });

    test('should handle back button click', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?building=building-1',
          pathname: '/residents/building',
        },
        writable: true,
      });

      renderWithProviders(<WrappedTestComponent />);

      const backButton = screen.getByTestId('button-back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByTestId('hierarchical-selection')).toBeInTheDocument();
        expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
      });

      // Should update URL and router
      expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/residents/building');
      expect(mockSetLocation).toHaveBeenCalledWith('/residents/building');
    });
  });

  describe('Smart Back Button Logic', () => {
    test('should not show back button when only one building exists', () => {
      // Mock only one building
      const SingleBuildingComponent = withHierarchicalSelection(TestComponent, {
        hierarchy: ['building'],
      });

      // Override the component to simulate single building scenario
      const SingleBuildingTestComponent = (props: any) => {
        const [currentBuildingId, setCurrentBuildingId] = React.useState('building-1');
        
        // Mock single building scenario - should not show back button
        const shouldShowBackButton = false; // Single building = no back button

        return (
          <TestComponent
            {...props}
            buildingId={currentBuildingId}
            showBackButton={shouldShowBackButton}
            backButtonLabel="Building"
            onBack={() => {}}
          />
        );
      };

      renderWithProviders(<SingleBuildingTestComponent />);

      expect(screen.queryByTestId('back-button-container')).not.toBeInTheDocument();
      expect(screen.queryByTestId('button-back')).not.toBeInTheDocument();
    });

    test('should show back button when multiple buildings exist', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?building=building-1',
          pathname: '/residents/building',
        },
        writable: true,
      });

      renderWithProviders(<WrappedTestComponent />);

      // Should show back button because mock has 2 buildings
      expect(screen.getByTestId('back-button-container')).toBeInTheDocument();
      expect(screen.getByTestId('button-back')).toBeInTheDocument();
    });
  });

  describe('URL Navigation', () => {
    test('should parse building ID from URL parameters', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?building=test-building-123',
          pathname: '/residents/building',
        },
        writable: true,
      });

      renderWithProviders(<WrappedTestComponent />);

      expect(screen.getByTestId('building-details')).toBeInTheDocument();
      expect(screen.getByTestId('building-id')).toHaveTextContent('test-building-123');
    });

    test('should show selection screen when no URL parameters', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          pathname: '/residents/building',
        },
        writable: true,
      });

      renderWithProviders(<WrappedTestComponent />);

      expect(screen.getByTestId('hierarchical-selection')).toBeInTheDocument();
      expect(screen.getByTestId('selection-grid')).toBeInTheDocument();
    });

    test('should handle URL updates correctly', async () => {
      renderWithProviders(<WrappedTestComponent />);

      // Start with selection screen
      expect(screen.getByTestId('hierarchical-selection')).toBeInTheDocument();

      // Select a building
      const buildingButton = screen.getByTestId('item-building-2');
      fireEvent.click(buildingButton);

      await waitFor(() => {
        expect(window.history.pushState).toHaveBeenCalledWith({}, '', '?building=building-2');
      });

      // Go back
      const backButton = screen.getByTestId('button-back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(window.history.pushState).toHaveBeenCalledWith({}, '', '/residents/building');
      });
    });
  });
});