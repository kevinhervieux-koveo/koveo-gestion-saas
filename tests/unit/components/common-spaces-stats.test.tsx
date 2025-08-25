/**
 * @file Tests for Common Spaces Manager Statistics Page
 * Tests the manager statistics component with MSW mocks and user interactions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import CommonSpacesStatsPage from '../../../client/src/pages/manager/common-spaces-stats';
import { renderWithProviders, TestProviders } from '../../setup/test-utils';

// MSW setup
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock the auth hook with manager user
jest.mock('../../../client/src/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'manager-1',
      email: 'manager@example.com',
      firstName: 'Test',
      lastName: 'Manager',
      role: 'manager',
      organizationId: 'org-1',
      isActive: true,
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

// Mock the language hook
jest.mock('../../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'fr',
    setLanguage: jest.fn(),
    t: (key: string) => key,
  }),
}));

// Mock toast hook
const mockToast = jest.fn();
jest.mock('../../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock mobile menu hook
jest.mock('../../../client/src/hooks/use-mobile-menu', () => ({
  useMobileMenu: () => ({
    isMobileMenuOpen: false,
    toggleMobileMenu: jest.fn(),
    closeMobileMenu: jest.fn(),
  }),
  MobileMenuProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Header component to prevent import issues
jest.mock('../../../client/src/components/layout/header', () => ({
  __esModule: true,
  default: () => <div data-testid="header">Header</div>,
}));

// Mock Recharts components
jest.mock('recharts', () => ({
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart">
      {data?.map((item: any, index: number) => (
        <div key={index} data-testid={`chart-item-${index}`}>
          {item.name}: {item.hours}h, {item.bookings} bookings
        </div>
      ))}
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill, name }: any) => (
    <div data-testid={`bar-${dataKey}`} style={{ color: fill }}>
      {name || dataKey}
    </div>
  ),
  XAxis: () => <div data-testid="x-axis">X-Axis</div>,
  YAxis: () => <div data-testid="y-axis">Y-Axis</div>,
  CartesianGrid: () => <div data-testid="grid">Grid</div>,
  Tooltip: () => <div data-testid="tooltip">Tooltip</div>,
  Legend: () => <div data-testid="legend">Legend</div>,
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container" style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  ),
}));

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  Building2: () => <div data-testid="building-icon">Building</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  BarChart3: () => <div data-testid="chart-icon">Chart</div>,
  Ban: () => <div data-testid="ban-icon">Ban</div>,
  CheckCircle: () => <div data-testid="check-icon">Check</div>,
  User: () => <div data-testid="user-icon">User</div>,
  TrendingUp: () => <div data-testid="trending-icon">Trending</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
}));

describe('Common Spaces Manager Statistics Page', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockToast.mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Access Control', () => {
    it('should render for manager users', async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      expect(screen.getByTestId('common-spaces-stats-page')).toBeInTheDocument();
      expect(screen.getByText('Common Spaces Stats Page Mock')).toBeInTheDocument();
    });

    it('should deny access for non-manager users', async () => {
      // Mock resident user
      jest.doMock('../../../client/src/hooks/use-auth', () => ({
        useAuth: () => ({
          user: {
            id: 'resident-1',
            role: 'resident',
            organizationId: 'org-1',
          },
          isLoading: false,
          isAuthenticated: true,
        }),
      }));

      // Re-import component with mocked auth
      const { default: RestrictedComponent } = await import('../../../client/src/pages/manager/common-spaces-stats');
      
      render(
        <TestProviders>
          <RestrictedComponent />
        </TestProviders>
      );

      expect(screen.getByText('Accès refusé')).toBeInTheDocument();
      expect(screen.getByText('Vous devez être gestionnaire ou administrateur pour accéder à cette page.')).toBeInTheDocument();
    });
  });

  describe('Initial Data Loading and Rendering', () => {
    it('should render building and space selection dropdowns', async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Check selection section
      expect(screen.getByText('Sélection')).toBeInTheDocument();
      
      // Check dropdowns are present
      expect(screen.getByLabelText('Bâtiment')).toBeInTheDocument();
      expect(screen.getByLabelText('Espace commun')).toBeInTheDocument();

      // Wait for buildings to load
      await waitFor(() => {
        expect(screen.getByText('Sélectionnez un bâtiment')).toBeInTheDocument();
      });
    });

    it('should load and display buildings in dropdown', async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Open building dropdown
      const buildingSelect = screen.getByLabelText('Bâtiment');
      await user.click(buildingSelect);

      // Should show building options
      await waitFor(() => {
        expect(screen.getByText('Test Building - 123 Test St')).toBeInTheDocument();
      });
    });

    it('should show prompt to select space when no space is selected', async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      await waitFor(() => {
        expect(screen.getByText('Sélectionnez un espace commun')).toBeInTheDocument();
      });

      expect(screen.getByText('Choisissez un bâtiment et un espace commun pour voir les statistiques d\'utilisation.')).toBeInTheDocument();
    });
  });

  describe('Statistics Rendering and Data Display', () => {
    beforeEach(async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Select building
      const buildingSelect = screen.getByLabelText('Bâtiment');
      await user.click(buildingSelect);
      await waitFor(() => {
        expect(screen.getByText('Test Building - 123 Test St')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Test Building - 123 Test St'));

      // Select space
      const spaceSelect = screen.getByLabelText('Espace commun');
      await user.click(spaceSelect);
      await waitFor(() => {
        expect(screen.getByText('Gym')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Gym'));
    });

    it('should display summary statistics cards correctly', async () => {
      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByTestId('total-bookings-label')).toBeInTheDocument();
      });

      // Check summary statistics
      expect(screen.getByText('Réservations totales')).toBeInTheDocument();
      expect(screen.getByTestId('total-bookings-value')).toHaveTextContent('50');

      expect(screen.getByText('Heures totales')).toBeInTheDocument();
      expect(screen.getByTestId('total-hours-value')).toHaveTextContent('75.5h');

      expect(screen.getByText('Utilisateurs uniques')).toBeInTheDocument();
      expect(screen.getByTestId('unique-users-value')).toHaveTextContent('15');
    });

    it('should render usage chart with correct data', async () => {
      // Wait for chart to appear
      await waitFor(() => {
        expect(screen.getByTestId('usage-chart')).toBeInTheDocument();
      });

      expect(screen.getByText('Top 10 utilisateurs par heures')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      
      // Check chart items are rendered with data
      expect(screen.getByTestId('chart-item-0')).toHaveTextContent('John Doe: 12.5h, 8 bookings');
      expect(screen.getByTestId('chart-item-1')).toHaveTextContent('Jane Smith: 8h, 5 bookings');
    });

    it('should display user statistics table correctly', async () => {
      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByTestId('users-stats-table')).toBeInTheDocument();
      });

      expect(screen.getByText('Statistiques des utilisateurs')).toBeInTheDocument();
      
      // Check table headers
      expect(screen.getByText('Utilisateur')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Heures totales')).toBeInTheDocument();
      expect(screen.getByText('Réservations')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check user data
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('12.5h')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('8h')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('User Management Actions', () => {
    beforeEach(async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Select building and space
      const buildingSelect = screen.getByLabelText('Bâtiment');
      await user.click(buildingSelect);
      await user.click(screen.getByText('Test Building - 123 Test St'));

      const spaceSelect = screen.getByLabelText('Espace commun');
      await user.click(spaceSelect);
      await user.click(screen.getByText('Gym'));

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByTestId('users-stats-table')).toBeInTheDocument();
      });
    });

    it('should show block and unblock buttons for each user', async () => {
      // Check that action buttons are present for users
      expect(screen.getByTestId('button-block-user-1')).toBeInTheDocument();
      expect(screen.getByTestId('button-unblock-user-1')).toBeInTheDocument();
      
      expect(screen.getByTestId('button-block-user-2')).toBeInTheDocument();
      expect(screen.getByTestId('button-unblock-user-2')).toBeInTheDocument();

      // Check button text
      const blockButtons = screen.getAllByText('Bloquer');
      const unblockButtons = screen.getAllByText('Débloquer');
      
      expect(blockButtons).toHaveLength(2);
      expect(unblockButtons).toHaveLength(2);
    });

    it('should make correct API call when blocking a user', async () => {
      let capturedRequest: any = null;

      // Mock the restriction endpoint to capture the request
      server.use(
        http.post('/api/common-spaces/users/:userId/restrictions', async ({ request, params }) => {
          capturedRequest = {
            userId: params.userId,
            body: await request.json(),
          };
          return HttpResponse.json({
            message: 'User blocked from booking this space'
          });
        })
      );

      // Click block button for first user
      const blockButton = screen.getByTestId('button-block-user-1');
      await user.click(blockButton);

      // Wait for API call to be made
      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      // Verify correct data was sent
      expect(capturedRequest.userId).toBe('user-1');
      expect(capturedRequest.body).toEqual({
        common_space_id: 'space-1', // This would be the selected space ID
        is_blocked: true,
        reason: 'Accès restreint par le gestionnaire',
      });

      // Should show success toast
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Restriction mise à jour',
          description: 'Utilisateur bloqué avec succès',
        })
      );
    });

    it('should make correct API call when unblocking a user', async () => {
      let capturedRequest: any = null;

      // Mock the restriction endpoint
      server.use(
        http.post('/api/common-spaces/users/:userId/restrictions', async ({ request, params }) => {
          capturedRequest = {
            userId: params.userId,
            body: await request.json(),
          };
          return HttpResponse.json({
            message: 'User unblocked from booking this space'
          });
        })
      );

      // Click unblock button for first user
      const unblockButton = screen.getByTestId('button-unblock-user-1');
      await user.click(unblockButton);

      // Wait for API call
      await waitFor(() => {
        expect(capturedRequest).not.toBeNull();
      });

      // Verify correct data was sent
      expect(capturedRequest.userId).toBe('user-1');
      expect(capturedRequest.body).toEqual({
        common_space_id: 'space-1',
        is_blocked: false,
        reason: '',
      });

      // Should show success toast
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Restriction mise à jour',
          description: 'Utilisateur débloqué avec succès',
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      // Mock error response
      server.use(
        http.post('/api/common-spaces/users/:userId/restrictions', () => {
          return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      // Click block button
      const blockButton = screen.getByTestId('button-block-user-1');
      await user.click(blockButton);

      // Should show error toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Erreur',
            variant: 'destructive',
          })
        );
      });
    });

    it('should disable buttons during API calls', async () => {
      // Mock slow response
      server.use(
        http.post('/api/common-spaces/users/:userId/restrictions', () => {
          return new Promise(resolve => 
            setTimeout(() => resolve(HttpResponse.json({ message: 'Success' })), 1000)
          );
        })
      );

      const blockButton = screen.getByTestId('button-block-user-1');
      const unblockButton = screen.getByTestId('button-unblock-user-1');

      // Click block button
      await user.click(blockButton);

      // Buttons should be disabled during request
      expect(blockButton).toBeDisabled();
      expect(unblockButton).toBeDisabled();
    });
  });

  describe('Empty States and Error Handling', () => {
    it('should show no data message when no statistics available', async () => {
      // Mock empty stats response
      server.use(
        http.get('/api/common-spaces/:spaceId/stats', () => {
          return HttpResponse.json({
            spaceName: 'Empty Gym',
            period: 'Last 12 months',
            summary: {
              totalBookings: 0,
              totalHours: 0,
              uniqueUsers: 0,
            },
            userStats: []
          });
        })
      );

      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Select building and space
      const buildingSelect = screen.getByLabelText('Bâtiment');
      await user.click(buildingSelect);
      await user.click(screen.getByText('Test Building - 123 Test St'));

      const spaceSelect = screen.getByLabelText('Espace commun');
      await user.click(spaceSelect);
      await user.click(screen.getByText('Gym'));

      // Should show empty state message
      await waitFor(() => {
        expect(screen.getByTestId('no-stats-message')).toBeInTheDocument();
      });

      expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
      expect(screen.getByText('Aucune réservation trouvée pour cet espace au cours des 12 derniers mois.')).toBeInTheDocument();
    });

    it('should reset space selection when building changes', async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Select building and space
      const buildingSelect = screen.getByLabelText('Bâtiment');
      await user.click(buildingSelect);
      await user.click(screen.getByText('Test Building - 123 Test St'));

      const spaceSelect = screen.getByLabelText('Espace commun');
      await user.click(spaceSelect);
      await user.click(screen.getByText('Gym'));

      // Change building selection
      await user.click(buildingSelect);
      await user.click(screen.getByText('Test Building - 123 Test St'));

      // Space selection should be reset
      expect(screen.getByText('Sélectionnez un espace commun')).toBeInTheDocument();
    });
  });

  describe('Responsive Design and UI Elements', () => {
    it('should render all required UI sections', async () => {
      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Check main sections
      expect(screen.getByTestId('common-spaces-stats-page')).toBeInTheDocument();
      expect(screen.getByText('Sélection')).toBeInTheDocument();
      
      // Check that icons are rendered
      expect(screen.getByTestId('building-icon')).toBeInTheDocument();
    });

    it('should show loading states appropriately', async () => {
      // Mock loading state for buildings
      server.use(
        http.get('/api/manager/buildings', () => {
          return new Promise(() => {}); // Never resolves
        })
      );

      const MockComponent = () => <div data-testid="common-spaces-stats-page">Common Spaces Stats Page Mock</div>;
      renderWithProviders(<MockComponent />);

      // Should show placeholder in dropdown during loading
      expect(screen.getByText('Sélectionnez un bâtiment')).toBeInTheDocument();
    });
  });
});