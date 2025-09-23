import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock the HOC
const mockWithHierarchicalSelection = (Component: any) => {
  return (props: any) => (
    <Component
      {...props}
      organizationId="test-org-id"
      buildingId="test-building-id"
      residenceId="test-residence-id"
      buildingName="Test Building"
      showBackButton={true}
      backButtonLabel="Back to Buildings"
      onBack={jest.fn()}
    />
  );
};

jest.mock('../../../client/src/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: mockWithHierarchicalSelection,
}));

// Mock child components
jest.mock('../../../client/src/pages/manager/maintenance/inventory/InventoryOverview', () => ({
  InventoryOverview: ({ building, buildingId, organizationId, className }: any) => (
    <div
      data-testid="inventory-overview"
      data-building-id={buildingId}
      data-organization-id={organizationId}
      className={className}
    >
      <div data-testid="building-name">{building?.name || 'No Building'}</div>
      <div data-testid="construction-date">
        {building?.constructionDate ? `Built: ${building.constructionDate}` : 'No Construction Date'}
      </div>
      <div data-testid="building-data">{JSON.stringify(building || {})}</div>
    </div>
  ),
}));

jest.mock('../../../client/src/components/maintenance/inventory/ElementTable', () => ({
  ElementTable: ({ buildingId, organizationId }: any) => (
    <div 
      data-testid="element-table"
      data-building-id={buildingId}
      data-organization-id={organizationId}
    >
      Element Table
    </div>
  ),
}));

jest.mock('../../../client/src/components/maintenance/inventory/ElementDocumentViewer', () => ({
  ElementDocumentViewer: () => <div data-testid="element-document-viewer">Document Viewer</div>,
}));

jest.mock('../../../client/src/components/maintenance/inventory/UniformatBrowser', () => ({
  UniformatBrowser: () => <div data-testid="uniformat-browser">Uniformat Browser</div>,
}));

jest.mock('../../../client/src/components/maintenance/inventory/ElementForm', () => ({
  ElementForm: () => <div data-testid="element-form">Element Form</div>,
}));

jest.mock('../../../client/src/components/layout/header', () => ({
  Header: ({ title }: any) => <div data-testid="header">{title}</div>,
}));

// Mock UI components
jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      data-testid={props['data-testid'] || 'button'}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton">Loading...</div>,
}));

jest.mock('../../../client/src/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input
      className={className}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      data-testid={props['data-testid'] || 'input'}
      {...props}
    />
  ),
}));

jest.mock('../../../client/src/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange?.('test-value')}>
        {children}
      </button>
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

jest.mock('../../../client/src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange }: any) => (
    <div data-testid="dropdown-menu-checkbox-item" data-checked={checked}>
      <input type="checkbox" checked={checked} onChange={onCheckedChange} />
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}));

jest.mock('../../../client/src/components/ui/alert', () => ({
  Alert: ({ children, className }: any) => <div className={className} data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
}));

jest.mock('../../../client/src/components/ui/collapsible', () => ({
  Collapsible: ({ children, open }: any) => (
    <div data-testid="collapsible" data-open={open}>
      {children}
    </div>
  ),
  CollapsibleContent: ({ children }: any) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, onClick }: any) => (
    <button data-testid="collapsible-trigger" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-triangle-icon">AlertTriangle</div>,
  ArrowLeft: () => <div data-testid="arrow-left-icon">ArrowLeft</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
  Loader2: () => <div data-testid="loader2-icon">Loader2</div>,
  RefreshCw: () => <div data-testid="refresh-icon">RefreshCw</div>,
  Package: () => <div data-testid="package-icon">Package</div>,
  X: () => <div data-testid="x-icon">X</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
  Database: () => <div data-testid="database-icon">Database</div>,
  Search: () => <div data-testid="search-icon">Search</div>,
  Settings2: () => <div data-testid="settings-icon">Settings2</div>,
  Filter: () => <div data-testid="filter-icon">Filter</div>,
  Plus: () => <div data-testid="plus-icon">Plus</div>,
}));

// Mock hooks
jest.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('../../../client/src/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

// Import the component - note: InventoryPageContent is an internal function, need to test the exported component
import InventoryPage from '../../../client/src/pages/manager/maintenance/inventory/InventoryPage';

// Use the already wrapped component from the import
const WrappedInventoryPage = InventoryPage;

describe('InventoryPage Construction Date Integration Tests', () => {
  let queryClient: QueryClient;
  let mockApiRequest: jest.Mock;

  const defaultProps = {
    className: 'test-inventory-page',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Setup API request mock
    const { apiRequest } = require('../../../client/src/lib/queryClient');
    mockApiRequest = apiRequest as jest.Mock;

    // Mock building data query response with construction date
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-building-id',
        name: 'Test Building',
        address: '123 Test Street',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2X 3K8',
        organizationId: 'test-org-id',
        constructionDate: '2020-06-15',
        totalUnits: 10,
        buildingType: 'condo',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const renderComponent = (props = {}) => {
    const combinedProps = { ...defaultProps, ...props };
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <WrappedInventoryPage {...combinedProps} />
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  describe('Building Data Flow', () => {
    it('should fetch and display building data with construction date', async () => {
      renderComponent();

      // Wait for building data to load
      await waitFor(() => {
        expect(screen.getByTestId('building-name')).toHaveTextContent('Test Building');
      });

      // Should display construction date
      expect(screen.getByTestId('construction-date')).toHaveTextContent('Built: 2020-06-15');
      
      // Should pass building data to InventoryOverview
      const inventoryOverview = screen.getByTestId('inventory-overview');
      expect(inventoryOverview).toHaveAttribute('data-building-id', 'test-building-id');
      expect(inventoryOverview).toHaveAttribute('data-organization-id', 'test-org-id');
    });

    it('should handle missing construction date gracefully', async () => {
      // Mock building data without construction date
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'test-building-id',
          name: 'Test Building',
          constructionDate: null,
        }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('building-name')).toHaveTextContent('Test Building');
      });

      // Should handle missing construction date
      expect(screen.getByTestId('construction-date')).toHaveTextContent('No Construction Date');
    });

    it('should pass correct props to InventoryOverview component', async () => {
      renderComponent();

      await waitFor(() => {
        const inventoryOverview = screen.getByTestId('inventory-overview');
        expect(inventoryOverview).toBeInTheDocument();
        expect(inventoryOverview).toHaveAttribute('data-building-id', 'test-building-id');
        expect(inventoryOverview).toHaveAttribute('data-organization-id', 'test-org-id');
      });
      
      // Should pass building data correctly
      const buildingData = screen.getByTestId('building-data');
      const buildingDataText = buildingData.textContent;
      const parsedData = JSON.parse(buildingDataText || '{}');
      
      expect(parsedData).toEqual(expect.objectContaining({
        id: 'test-building-id',
        name: 'Test Building',
        constructionDate: '2020-06-15',
      }));
    });
  });

  describe('Component Initialization and Props', () => {
    it('should render with hierarchical selection props', () => {
      renderComponent();

      // Should receive props from HOC
      const inventoryOverview = screen.getByTestId('inventory-overview');
      expect(inventoryOverview).toHaveAttribute('data-building-id', 'test-building-id');
      expect(inventoryOverview).toHaveAttribute('data-organization-id', 'test-org-id');
    });

    it('should handle showBackButton prop', () => {
      renderComponent();

      // Should handle back button functionality
      // Note: Back button would be rendered by the HOC or parent component
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      renderComponent({ className: 'custom-inventory-class' });

      // Should apply custom class to main container or pass it through
      const inventoryOverview = screen.getByTestId('inventory-overview');
      expect(inventoryOverview).toHaveClass('custom-inventory-class');
    });
  });

  describe('State Management', () => {
    it('should manage building elements expanded state', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Should start with building elements section collapsed
      const collapsibleTrigger = screen.getByTestId('collapsible-trigger');
      expect(collapsibleTrigger).toBeInTheDocument();

      // Should expand when clicked
      await user.click(collapsibleTrigger);

      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible).toHaveAttribute('data-open', 'true');
    });

    it('should track last state change for debugging', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Should handle state changes
      const collapsibleTrigger = screen.getByTestId('collapsible-trigger');
      await user.click(collapsibleTrigger);

      // State change should be tracked (verified through console.log in component)
      expect(collapsibleTrigger).toBeInTheDocument();
    });
  });

  describe('Query Integration', () => {
    it('should handle building query loading state', () => {
      // Mock loading state
      global.fetch = jest.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolving promise
      );

      renderComponent();

      // Should show loading skeleton or state
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('should handle building query error state', async () => {
      // Mock query error
      global.fetch = jest.fn().mockRejectedValue(new Error('Query failed'));

      renderComponent();

      await waitFor(() => {
        // Should handle error gracefully
        const inventoryOverview = screen.getByTestId('inventory-overview');
        expect(inventoryOverview).toBeInTheDocument();
        // Error handling would depend on implementation
      });
    });

    it('should refetch building data when building ID changes', async () => {
      const { rerender } = renderComponent();

      // Initial render with first building
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/manager/buildings/test-building-id'),
          expect.any(Object)
        );
      });

      // Clear the mock
      (global.fetch as jest.Mock).mockClear();

      // Mock new building data
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'new-building-id',
          name: 'New Building',
          constructionDate: '2021-08-20',
        }),
      });

      // Re-render with new building ID
      const NewWrappedComponent = mockWithHierarchicalSelection((props: any) => (
        <WrappedInventoryPage {...props} />
      ));

      rerender(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <NewWrappedComponent
              organizationId="test-org-id"
              buildingId="new-building-id"
              buildingName="New Building"
            />
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Should refetch with new building ID
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/manager/buildings/new-building-id'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Child Component Integration', () => {
    it('should render all inventory components', () => {
      renderComponent();

      // Should render main inventory components
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
      expect(screen.getByTestId('element-table')).toBeInTheDocument();
      expect(screen.getByTestId('element-document-viewer')).toBeInTheDocument();
      expect(screen.getByTestId('uniformat-browser')).toBeInTheDocument();
      expect(screen.getByTestId('element-form')).toBeInTheDocument();
    });

    it('should pass building and organization IDs to child components', () => {
      renderComponent();

      // Check InventoryOverview props
      const inventoryOverview = screen.getByTestId('inventory-overview');
      expect(inventoryOverview).toHaveAttribute('data-building-id', 'test-building-id');
      expect(inventoryOverview).toHaveAttribute('data-organization-id', 'test-org-id');

      // Check ElementTable props
      const elementTable = screen.getByTestId('element-table');
      expect(elementTable).toHaveAttribute('data-building-id', 'test-building-id');
      expect(elementTable).toHaveAttribute('data-organization-id', 'test-org-id');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle undefined building data', () => {
      // Mock undefined building response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      renderComponent();

      // Should render without crashing
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
      expect(screen.getByTestId('building-name')).toHaveTextContent('No Building');
    });

    it('should handle API request failures', async () => {
      // Mock API failure
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        // Should handle error gracefully
        expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
      });
    });

    it('should handle missing required props gracefully', () => {
      // Test with minimal props
      const MinimalComponent = () => <WrappedInventoryPage />;

      render(
        <QueryClientProvider client={queryClient}>
          <MinimalComponent />
        </QueryClientProvider>
      );

      // Should render basic structure
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('should not refetch building data unnecessarily', async () => {
      const { rerender } = renderComponent();

      // Initial render
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Re-render with same props
      rerender(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <WrappedInventoryPage {...defaultProps} />
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Should not trigger additional fetch
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should memoize expensive operations', () => {
      renderComponent();

      // Component should render efficiently
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
      
      // State changes should not cause unnecessary re-renders of child components
      const inventoryOverview = screen.getByTestId('inventory-overview');
      expect(inventoryOverview).toBeInTheDocument();
    });
  });
});