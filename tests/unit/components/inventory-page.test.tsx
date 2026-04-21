import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/hooks/use-language';

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

jest.mock('../../../client/src/pages/manager/maintenance/inventory/InventoryOverview', () => ({
  InventoryOverview: ({ building, buildingId, organizationId, className }: any) => (
    <div data-testid="inventory-overview" data-building-id={buildingId} data-organization-id={organizationId} className={className}>
      <div data-testid="building-name">{building?.name || 'No Building'}</div>
    </div>
  ),
}));

jest.mock('../../../client/src/components/maintenance/inventory/ElementTable', () => ({
  ElementTable: ({ buildingId, organizationId }: any) => (
    <div data-testid="element-table" data-building-id={buildingId} data-organization-id={organizationId}>
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

jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button className={className} onClick={onClick} disabled={disabled}
      data-testid={props['data-testid'] || 'button'} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton">Loading...</div>,
}));

jest.mock('../../../client/src/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input className={className} value={value || ''} onChange={onChange} placeholder={placeholder}
      data-testid={props['data-testid'] || 'input'} {...props} />
  ),
}));

jest.mock('../../../client/src/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}><button onClick={() => onValueChange?.('test-value')}>{children}</button></div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid="select-item" data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

jest.mock('../../../client/src/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuCheckboxItem: ({ children, checked, onCheckedChange }: any) => (
    <div data-testid="dropdown-menu-checkbox-item" data-checked={checked}>
      <input type="checkbox" checked={checked} onChange={onCheckedChange} />{children}
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
  Collapsible: ({ children, open }: any) => <div data-testid="collapsible" data-open={open}>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, onClick }: any) => (
    <button data-testid="collapsible-trigger" onClick={onClick}>{children}</button>
  ),
}));

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

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'test-building-id',
      name: 'Test Building',
      constructionDate: '2020-06-15',
      organizationId: 'test-org-id',
    }),
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

import InventoryPage from '../../../client/src/pages/manager/maintenance/inventory/InventoryPage';

describe('InventoryPage Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();

    const { apiRequest } = require('@/lib/queryClient');
    (apiRequest as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-building-id',
        name: 'Test Building',
        constructionDate: '2020-06-15',
        organizationId: 'test-org-id',
      }),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'test-building-id',
        name: 'Test Building',
        constructionDate: '2020-06-15',
        organizationId: 'test-org-id',
      }),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <InventoryPage {...props} />
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render with hierarchical selection props', () => {
      renderComponent();
      const inventoryOverview = screen.getByTestId('inventory-overview');
      expect(inventoryOverview).toHaveAttribute('data-building-id', 'test-building-id');
      expect(inventoryOverview).toHaveAttribute('data-organization-id', 'test-org-id');
    });

    it('should render inventory overview component', () => {
      renderComponent();
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
    });

    it('should render element table component', () => {
      renderComponent();
      expect(screen.getByTestId('element-table')).toBeInTheDocument();
    });

    it('should pass buildingId to element table', () => {
      renderComponent();
      const table = screen.getByTestId('element-table');
      expect(table).toHaveAttribute('data-building-id', 'test-building-id');
    });

    it('should pass organizationId to element table', () => {
      renderComponent();
      const table = screen.getByTestId('element-table');
      expect(table).toHaveAttribute('data-organization-id', 'test-org-id');
    });
  });

  describe('Building Data Flow', () => {
    it('should pass buildingId and orgId to InventoryOverview', () => {
      renderComponent();
      const overview = screen.getByTestId('inventory-overview');
      expect(overview).toHaveAttribute('data-building-id', 'test-building-id');
      expect(overview).toHaveAttribute('data-organization-id', 'test-org-id');
    });

    it('should fetch building data and pass to InventoryOverview', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('building-name')).toHaveTextContent('Test Building');
      });
    });
  });

  describe('Layout', () => {
    it('should render without crashing', () => {
      const { container } = renderComponent();
      expect(container).toBeTruthy();
    });

    it('should contain all main sections', () => {
      renderComponent();
      expect(screen.getByTestId('inventory-overview')).toBeInTheDocument();
      expect(screen.getByTestId('element-table')).toBeInTheDocument();
    });
  });
});
