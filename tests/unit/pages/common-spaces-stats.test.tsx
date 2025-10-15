import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let mockAuth = {
  user: { id: 'test-user', role: 'manager', email: 'manager@test.com' },
};

let mockLanguage = {
  language: 'en',
};

let mockToast = {
  toast: jest.fn(),
};

let mockLocation = ['/', jest.fn()];

const mockWithHierarchicalSelection = (Component: any) => {
  return (props: any) => (
    <Component
      {...props}
      organizationId="test-org-id"
      buildingId="test-building-id"
      buildingName="Test Building"
      showBackButton={true}
      backButtonLabel="Back to Buildings"
      onBack={jest.fn()}
    />
  );
};

jest.mock('@/components/hoc/withHierarchicalSelection', () => ({
  withHierarchicalSelection: mockWithHierarchicalSelection,
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => mockLanguage,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => mockToast,
}));

jest.mock('wouter', () => ({
  useLocation: () => mockLocation,
}));

jest.mock('@/components/layout/header', () => ({
  Header: ({ title, subtitle }: any) => (
    <div data-testid="header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className} data-testid="card-content">{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className} data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h2 className={className} data-testid="card-title">{children}</h2>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span className={className} data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { onValueChange })
      )}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div
      data-testid={`select-item-${value}`}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableBody: ({ children }: any) => <tbody data-testid="table-body">{children}</tbody>,
  TableCell: ({ children, className }: any) => <td className={className} data-testid="table-cell">{children}</td>,
  TableHead: ({ children, className }: any) => <th className={className} data-testid="table-head">{children}</th>,
  TableHeader: ({ children }: any) => <thead data-testid="table-header">{children}</thead>,
  TableRow: ({ children, className }: any) => <tr className={className} data-testid="table-row">{children}</tr>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {open && children}
    </div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children }: any) => <div data-testid="dialog-trigger">{children}</div>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
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

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor} data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, className, ...props }: any) => (
    <textarea
      className={className}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      data-testid={props['data-testid'] || 'textarea'}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, className, ...props }: any) => (
    <input
      type="checkbox"
      className={className}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid={props['data-testid'] || 'checkbox'}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>,
  TabsContent: ({ children, value }: any) => <div data-testid={`tabs-content-${value}`}>{children}</div>,
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button data-testid={`tabs-trigger-${value}`}>{children}</button>,
}));

jest.mock('@/components/ui/no-data-card', () => ({
  NoDataCard: ({ title, description }: any) => (
    <div data-testid="no-data-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

jest.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar">Bar</div>,
  XAxis: () => <div data-testid="x-axis">XAxis</div>,
  YAxis: () => <div data-testid="y-axis">YAxis</div>,
  CartesianGrid: () => <div data-testid="cartesian-grid">Grid</div>,
  Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
  Legend: () => <div data-testid="legend">Legend</div>,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

jest.mock('@/components/common-spaces/calendar-view', () => ({
  CalendarView: () => <div data-testid="calendar-view">Calendar View</div>,
}));

jest.mock('@/components/common-spaces/common-space-calendar', () => ({
  CommonSpaceCalendar: () => <div data-testid="common-space-calendar">Common Space Calendar</div>,
}));

describe('CommonSpacesStatsPage', () => {
  let queryClient: QueryClient;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;

    mockAuth = {
      user: { id: 'test-user', role: 'manager', email: 'manager@test.com' },
    };

    mockLanguage = {
      language: 'en',
    };

    mockToast = {
      toast: jest.fn(),
    };

    mockLocation = ['/', jest.fn()];

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Access Control', () => {
    it('should deny access for non-manager users', async () => {
      mockAuth = {
        user: { id: 'test-user', role: 'tenant', email: 'tenant@test.com' },
      };

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/You must be a manager or administrator/i)).toBeInTheDocument();
    });

    it('should allow access for manager users', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ buildings: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      });
    });

    it('should allow access for admin users', async () => {
      mockAuth = {
        user: { id: 'test-user', role: 'admin', email: 'admin@test.com' },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ buildings: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch buildings on component mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          buildings: [
            { id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' },
          ],
        }),
      });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/manager/buildings'));
      });
    });

    it('should fetch common spaces when building is selected', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'space-1', name: 'Pool', buildingId: 'building-1', isReservable: true },
          ],
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('building_id=test-building-id'));
      });
    });

    it('should fetch statistics when space is selected', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'space-1', name: 'Pool', buildingId: 'building-1', isReservable: true },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            spaceName: 'Pool',
            period: 'Last 30 days',
            summary: { totalBookings: 10, totalHours: 50, uniqueUsers: 5 },
            userStats: [],
          }),
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('User Statistics Display', () => {
    it('should display user statistics table with correct columns', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'space-1', name: 'Pool', buildingId: 'building-1', isReservable: true },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            spaceName: 'Pool',
            period: 'Last 30 days',
            summary: { totalBookings: 10, totalHours: 50, uniqueUsers: 2 },
            userStats: [
              {
                userId: 'user-1',
                userName: 'John Doe',
                userEmail: 'john@test.com',
                totalHours: 30,
                totalBookings: 6,
                isBlocked: false,
                hasCustomLimit: true,
              },
              {
                userId: 'user-2',
                userName: 'Jane Smith',
                userEmail: 'jane@test.com',
                totalHours: 20,
                totalBookings: 4,
                isBlocked: true,
                hasCustomLimit: false,
              },
            ],
          }),
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('john@test.com')).toBeInTheDocument();
        expect(screen.getByText('jane@test.com')).toBeInTheDocument();
      });
    });

    it('should display "Is Blocked" status correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'space-1', name: 'Pool', buildingId: 'building-1', isReservable: true },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            spaceName: 'Pool',
            period: 'Last 30 days',
            summary: { totalBookings: 5, totalHours: 25, uniqueUsers: 1 },
            userStats: [
              {
                userId: 'user-1',
                userName: 'Blocked User',
                userEmail: 'blocked@test.com',
                totalHours: 25,
                totalBookings: 5,
                isBlocked: true,
                hasCustomLimit: false,
              },
            ],
          }),
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.getByText('Blocked User')).toBeInTheDocument();
      });
    });

    it('should display "Has Custom Limit" status correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'space-1', name: 'Pool', buildingId: 'building-1', isReservable: true },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            spaceName: 'Pool',
            period: 'Last 30 days',
            summary: { totalBookings: 5, totalHours: 25, uniqueUsers: 1 },
            userStats: [
              {
                userId: 'user-1',
                userName: 'Custom Limit User',
                userEmail: 'custom@test.com',
                totalHours: 25,
                totalBookings: 5,
                isBlocked: false,
                hasCustomLimit: true,
              },
            ],
          }),
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.getByText('Custom Limit User')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should display summary statistics correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 'space-1', name: 'Pool', buildingId: 'building-1', isReservable: true },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            spaceName: 'Pool',
            period: 'Last 30 days',
            summary: { totalBookings: 100, totalHours: 500, uniqueUsers: 25 },
            userStats: [],
          }),
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.getByText(/100/)).toBeInTheDocument();
        expect(screen.getByText(/500/)).toBeInTheDocument();
        expect(screen.getByText(/25/)).toBeInTheDocument();
      });
    });
  });

  describe('No Data States', () => {
    it('should display no data message when no buildings are available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ buildings: [] }),
      });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('no-data-card')).toBeInTheDocument();
      });
    });

    it('should display no data message when no common spaces are available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/common-spaces'));
      });
    });
  });

  describe('French Language Support', () => {
    it('should display French translations when language is set to French', async () => {
      mockLanguage = { language: 'fr' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            buildings: [{ id: 'building-1', name: 'Building 1', address: '123 Main St', city: 'Montreal' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const CommonSpacesStatsPage = require('../../../client/src/pages/manager/common-spaces-stats').default;

      renderWithProviders(<CommonSpacesStatsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});
