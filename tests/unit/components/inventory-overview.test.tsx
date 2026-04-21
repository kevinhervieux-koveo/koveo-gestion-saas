import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryOverview } from '../../../client/src/pages/manager/maintenance/inventory/InventoryOverview';

jest.mock('react-day-picker', () => ({
  Calendar: ({ selected, onSelect, disabled }: any) => (
    <div data-testid="calendar-picker">
      <button 
        data-testid="calendar-date-button"
        onClick={() => onSelect?.(new Date('2022-03-15'))}
        disabled={disabled}
      >
        Select Date: {selected ? selected.toISOString().split('T')[0] : 'No date'}
      </button>
    </div>
  ),
}));

jest.mock('date-fns', () => ({
  differenceInDays: jest.fn(() => 365),
  parseISO: jest.fn((date) => new Date(date)),
  isAfter: jest.fn(() => false),
  format: jest.fn((date) => {
    try {
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }),
}));

jest.mock('lucide-react', () => ({
  Package: () => <div data-testid="package-icon">Package</div>,
  AlertTriangle: () => <div data-testid="alert-triangle-icon">AlertTriangle</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  DollarSign: () => <div data-testid="dollar-sign-icon">DollarSign</div>,
  TrendingUp: () => <div data-testid="trending-up-icon">TrendingUp</div>,
  Activity: () => <div data-testid="activity-icon">Activity</div>,
  CheckCircle: () => <div data-testid="check-circle-icon">CheckCircle</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
  Wrench: () => <div data-testid="wrench-icon">Wrench</div>,
  FileText: () => <div data-testid="file-text-icon">FileText</div>,
  Target: () => <div data-testid="target-icon">Target</div>,
  BarChart3: () => <div data-testid="bar-chart-icon">BarChart3</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
  ChevronRight: () => <div data-testid="chevron-right-icon">ChevronRight</div>,
  Edit2: () => <div data-testid="edit2-icon">Edit2</div>,
  Save: () => <div data-testid="save-icon">Save</div>,
  X: () => <div data-testid="x-icon">X</div>,
  CalendarIcon: () => <div data-testid="calendar-icon">CalendarIcon</div>,
}));

jest.mock('../../../client/src/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => <div className={className} data-testid={props['data-testid'] || 'card'}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
  CardDescription: ({ children, className }: any) => <div className={className} data-testid="card-description">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className} data-testid="card-title">{children}</div>,
}));

jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

jest.mock('../../../client/src/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div className={className} data-testid="progress" data-value={value}>Progress: {value}%</div>
  ),
}));

jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton">Loading...</div>,
}));

jest.mock('../../../client/src/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button className={className} onClick={onClick} disabled={disabled}
      data-testid={props['data-testid'] || 'button'} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('../../../client/src/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input className={className} value={value || ''} onChange={onChange} placeholder={placeholder}
      data-testid={props['data-testid'] || 'input'} {...props} />
  ),
}));

jest.mock('../../../client/src/components/ui/collapsible', () => ({
  Collapsible: ({ children, open, onOpenChange, className, ...props }: any) => (
    <div data-testid={props['data-testid'] || 'collapsible'} data-open={open} className={className}>{children}</div>
  ),
  CollapsibleContent: ({ children }: any) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, onClick, asChild }: any) => (
    <div data-testid="collapsible-trigger" onClick={onClick}>{children}</div>
  ),
}));

jest.mock('../../../client/src/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children, className }: any) => (
    <div className={className} data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
}));

jest.mock('../../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/queryClient', () => ({
  apiRequest: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  }),
  queryClient: {
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  },
}));

describe('InventoryOverview Construction Date Tests', () => {
  let queryClient: QueryClient;

  const defaultProps = {
    className: 'test-class',
    buildingId: 'test-building-id',
    organizationId: 'test-org-id',
    building: {
      id: 'test-building-id',
      name: 'Test Building',
      constructionDate: '2020-06-15',
    },
  };

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
      json: async () => ({ success: true, data: [] }),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderComponent = (props = {}) => {
    const combinedProps = { ...defaultProps, ...props };
    return render(
      <QueryClientProvider client={queryClient}>
        <InventoryOverview {...combinedProps} />
      </QueryClientProvider>
    );
  };

  describe('Component Rendering', () => {
    it('should render Inventory Overview header', () => {
      renderComponent();
      expect(screen.getByText('Inventory Overview')).toBeInTheDocument();
    });

    it('should render building name after loading', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText((content) => content.includes('Test Building'))).toBeInTheDocument();
      });
    });

    it('should render collapsible wrapper', () => {
      renderComponent();
      const overview = screen.getByTestId('inventory-overview');
      expect(overview).toBeInTheDocument();
    });

    it('should start collapsed by default', () => {
      renderComponent();
      const overview = screen.getByTestId('inventory-overview');
      expect(overview).toHaveAttribute('data-open', 'false');
    });

    it('should apply custom className', () => {
      renderComponent({ className: 'custom-class' });
      const overview = screen.getByTestId('inventory-overview');
      expect(overview).toHaveClass('custom-class');
    });

    it('should render loading skeleton initially', () => {
      renderComponent();
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Component Edge Cases', () => {
    it('should handle missing building prop', () => {
      renderComponent({ building: undefined });
      expect(screen.getByText('Inventory Overview')).toBeInTheDocument();
    });

    it('should handle missing buildingId', () => {
      renderComponent({ buildingId: undefined });
      expect(screen.getByText('Inventory Overview')).toBeInTheDocument();
    });

    it('should handle missing organizationId', () => {
      renderComponent({ organizationId: undefined });
      expect(screen.getByText('Inventory Overview')).toBeInTheDocument();
    });
  });

  describe('Async Data Loading', () => {
    it('should transition from loading to loaded state', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('building-construction-date-card')).toBeInTheDocument();
      });
    });

    it('should display construction date when provided', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText(/2020-06-15/)).toBeInTheDocument();
      });
    });

    it('should show edit button after loading', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('edit-construction-date')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('edit-construction-date')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('edit-construction-date'));
      
      expect(screen.getByTestId('construction-date-input')).toBeInTheDocument();
      expect(screen.getByTestId('save-construction-date')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-edit-construction-date')).toBeInTheDocument();
    });

    it('should exit edit mode when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByTestId('edit-construction-date')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('edit-construction-date'));
      expect(screen.getByTestId('construction-date-input')).toBeInTheDocument();
      
      await user.click(screen.getByTestId('cancel-edit-construction-date'));
      
      expect(screen.queryByTestId('construction-date-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('edit-construction-date')).toBeInTheDocument();
    });
  });
});
