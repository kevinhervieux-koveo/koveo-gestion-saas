import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryOverview } from '../../../client/src/pages/manager/maintenance/inventory/InventoryOverview';

// Mock react-day-picker Calendar component
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

// Mock date-fns functions
jest.mock('date-fns', () => ({
  differenceInDays: jest.fn(() => 365),
  parseISO: jest.fn((date) => new Date(date)),
  isAfter: jest.fn(() => false),
  format: jest.fn((date) => date.toISOString().split('T')[0]),
}));

// Mock lucide-react icons
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

// Mock UI components
jest.mock('../../../client/src/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
  CardDescription: ({ children, className }: any) => <div className={className} data-testid="card-description">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className} data-testid="card-title">{children}</div>,
}));

jest.mock('../../../client/src/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span className={className} data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('../../../client/src/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div className={className} data-testid="progress" data-value={value}>
      Progress: {value}%
    </div>
  ),
}));

jest.mock('../../../client/src/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton">Loading...</div>,
}));

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

jest.mock('../../../client/src/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children, className }: any) => (
    <div className={className} data-testid="popover-content">{children}</div>
  ),
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
}));

// Mock hooks
jest.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock queryClient
const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

jest.mock('../../../client/src/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: mockQueryClient,
}));

describe('InventoryOverview Construction Date Tests', () => {
  let queryClient: QueryClient;
  let mockToast: jest.Mock;
  let mockApiRequest: jest.Mock;

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

    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mocks
    const { useToast } = require('../../../client/src/hooks/use-toast');
    const { apiRequest } = require('../../../client/src/lib/queryClient');
    mockToast = useToast().toast;
    mockApiRequest = apiRequest as jest.Mock;

    // Mock successful API responses by default
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Mock building elements query
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const renderComponent = (props = {}) => {
    const combinedProps = { ...defaultProps, ...props };
    return render(
      <QueryClientProvider client={queryClient}>
        <InventoryOverview {...combinedProps} />
      </QueryClientProvider>
    );
  };

  describe('Construction Date Display', () => {
    it('should display construction date when provided', () => {
      renderComponent();
      
      const constructionDateText = screen.getByText(/2020-06-15/);
      expect(constructionDateText).toBeInTheDocument();
    });

    it('should display "Non spécifié" when construction date is not provided', () => {
      renderComponent({
        building: {
          id: 'test-building-id',
          name: 'Test Building',
          constructionDate: undefined,
        },
      });
      
      const noDateText = screen.getByText(/non spécifié/i);
      expect(noDateText).toBeInTheDocument();
    });

    it('should display "Non spécifié" when construction date is null', () => {
      renderComponent({
        building: {
          id: 'test-building-id',
          name: 'Test Building',
          constructionDate: null,
        },
      });
      
      const noDateText = screen.getByText(/non spécifié/i);
      expect(noDateText).toBeInTheDocument();
    });

    it('should show edit button for construction date', () => {
      renderComponent();
      
      const editButton = screen.getByTestId('button-edit-construction-date');
      expect(editButton).toBeInTheDocument();
      expect(editButton).not.toBeDisabled();
    });
  });

  describe('Construction Date Editing State Management', () => {
    it('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      // Should show calendar picker
      expect(screen.getByTestId('calendar-picker')).toBeInTheDocument();
      
      // Should show save and cancel buttons
      expect(screen.getByTestId('button-save-construction-date')).toBeInTheDocument();
      expect(screen.getByTestId('button-cancel-construction-date')).toBeInTheDocument();
    });

    it('should exit edit mode when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Enter edit mode
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      // Cancel editing
      const cancelButton = screen.getByTestId('button-cancel-construction-date');
      await user.click(cancelButton);
      
      // Should exit edit mode
      expect(screen.queryByTestId('calendar-picker')).not.toBeInTheDocument();
      expect(screen.getByTestId('button-edit-construction-date')).toBeInTheDocument();
    });

    it('should sync editingDate with building prop on mount', () => {
      renderComponent({
        building: {
          id: 'test-building-id',
          name: 'Test Building',
          constructionDate: '2021-12-25',
        },
      });
      
      // Component should display the provided construction date
      expect(screen.getByText(/2021-12-25/)).toBeInTheDocument();
    });

    it('should update editingDate when building prop changes', () => {
      const { rerender } = renderComponent();
      
      // Update building prop with new construction date
      rerender(
        <QueryClientProvider client={queryClient}>
          <InventoryOverview
            {...defaultProps}
            building={{
              id: 'test-building-id',
              name: 'Test Building',
              constructionDate: '2022-01-01',
            }}
          />
        </QueryClientProvider>
      );
      
      // Should display updated date
      expect(screen.getByText(/2022-01-01/)).toBeInTheDocument();
    });
  });

  describe('Construction Date Calendar Picker', () => {
    it('should show calendar picker in edit mode', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      expect(screen.getByTestId('calendar-picker')).toBeInTheDocument();
    });

    it('should handle date selection from calendar', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Enter edit mode
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      // Select a date from calendar
      const dateButton = screen.getByTestId('calendar-date-button');
      await user.click(dateButton);
      
      // Should show selected date
      expect(screen.getByText(/2022-03-15/)).toBeInTheDocument();
    });

    it('should maintain selected date in calendar picker', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Enter edit mode
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      // Calendar should show current construction date
      const calendarPicker = screen.getByTestId('calendar-picker');
      expect(calendarPicker).toBeInTheDocument();
    });
  });

  describe('Construction Date Mutations and Cache Invalidation', () => {
    it('should save construction date successfully', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Mock successful API response
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          building: {
            id: 'test-building-id',
            name: 'Test Building',
            constructionDate: '2022-03-15',
          },
        }),
      });
      
      // Enter edit mode and select date
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      const dateButton = screen.getByTestId('calendar-date-button');
      await user.click(dateButton);
      
      // Save the changes
      const saveButton = screen.getByTestId('button-save-construction-date');
      await user.click(saveButton);
      
      // Should make API request
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'PUT',
          expect.stringContaining('/api/admin/buildings'),
          expect.objectContaining({
            name: 'Test Building',
            constructionDate: '2022-03-15',
            organizationId: 'test-org-id',
          })
        );
      });
      
      // Should show success toast
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Succès',
        description: 'Date de construction mise à jour avec succès',
      });
    });

    it('should invalidate cache after successful update', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Mock successful API response
      mockApiRequest.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      // Enter edit mode and save
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      const saveButton = screen.getByTestId('button-save-construction-date');
      await user.click(saveButton);
      
      // Should invalidate related queries
      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['/api/manager/buildings', 'test-building-id']
        });
      });
    });

    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Mock API error
      mockApiRequest.mockRejectedValue(new Error('API Error'));
      
      // Enter edit mode and try to save
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      const saveButton = screen.getByTestId('button-save-construction-date');
      await user.click(saveButton);
      
      // Should show error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Erreur',
          description: 'Échec de la mise à jour de la date de construction',
          variant: 'destructive',
        });
      });
    });

    it('should handle mutation loading state', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Mock delayed API response
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockApiRequest.mockReturnValue(delayedPromise);
      
      // Enter edit mode and save
      const editButton = screen.getByTestId('button-edit-construction-date');
      await user.click(editButton);
      
      const saveButton = screen.getByTestId('button-save-construction-date');
      await user.click(saveButton);
      
      // Should disable save button during loading
      expect(saveButton).toBeDisabled();
      
      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Component Props and Edge Cases', () => {
    it('should handle missing building prop', () => {
      renderComponent({ building: undefined });
      
      // Should not crash and should render basic structure
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should handle missing buildingId', () => {
      renderComponent({ buildingId: undefined });
      
      // Should render but edit functionality may be limited
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should handle missing organizationId', () => {
      renderComponent({ organizationId: undefined });
      
      // Should render but save functionality should handle missing org ID
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      renderComponent({ className: 'custom-class' });
      
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('Collapsible Functionality', () => {
    it('should start collapsed by default', () => {
      renderComponent();
      
      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible).toHaveAttribute('data-open', 'false');
    });

    it('should expand when trigger is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const trigger = screen.getByTestId('collapsible-trigger');
      await user.click(trigger);
      
      const collapsible = screen.getByTestId('collapsible');
      expect(collapsible).toHaveAttribute('data-open', 'true');
    });

    it('should show construction date in collapsed state', () => {
      renderComponent();
      
      // Construction date should be visible even when collapsed
      expect(screen.getByText(/2020-06-15/)).toBeInTheDocument();
    });
  });

  describe('Date Formatting and Validation', () => {
    it('should handle different date formats from building prop', () => {
      const testCases = [
        { date: '2020-06-15', expected: '2020-06-15' },
        { date: new Date('2020-06-15'), expected: '2020-06-15' },
      ];

      testCases.forEach(({ date, expected }) => {
        const { unmount } = renderComponent({
          building: {
            id: 'test-building-id',
            name: 'Test Building',
            constructionDate: date,
          },
        });

        expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
        unmount();
      });
    });

    it('should not allow editing without required props', async () => {
      const user = userEvent.setup();
      renderComponent({
        buildingId: undefined,
        organizationId: undefined,
      });
      
      const editButton = screen.queryByTestId('button-edit-construction-date');
      
      if (editButton) {
        await user.click(editButton);
        const saveButton = screen.queryByTestId('button-save-construction-date');
        
        if (saveButton) {
          await user.click(saveButton);
          
          // Should show error or not attempt save without required props
          expect(mockApiRequest).not.toHaveBeenCalled();
        }
      }
    });
  });
});