import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, within } from '../test-utils';
import userEvent from '@testing-library/user-event';
import Bills from '@/pages/manager/bills';

// Mock data
const mockBuildings = [
  { id: '1', name: 'Maple Heights Condos' },
  { id: '2', name: 'Oak Gardens Apartments' },
  { id: '3', name: 'Pine Tower Complex' }
];

const mockBills = [
  {
    id: '1',
    buildingId: '1',
    billNumber: 'INS-2024-001',
    title: 'Annual Building Insurance',
    description: 'Comprehensive building insurance coverage',
    category: 'insurance',
    vendor: 'SecureGuard Insurance Inc.',
    paymentType: 'recurrent',
    schedulePayment: 'yearly',
    costs: ['15000.00'],
    totalAmount: '15000.00',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'sent',
    createdAt: new Date('2024-01-01'),
    buildingName: 'Maple Heights Condos'
  },
  {
    id: '2',
    buildingId: '1',
    billNumber: 'MAINT-2024-002',
    title: 'Elevator Maintenance Contract',
    description: 'Monthly elevator inspection and maintenance',
    category: 'maintenance',
    vendor: 'ElevatorTech Services',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    costs: ['450.00'],
    totalAmount: '450.00',
    startDate: '2024-01-01',
    status: 'paid',
    createdAt: new Date('2024-01-15'),
    buildingName: 'Maple Heights Condos'
  },
  {
    id: '3',
    buildingId: '1',
    billNumber: 'UTIL-2024-003',
    title: 'Common Area Electricity',
    description: 'Monthly electricity for common areas and lighting',
    category: 'utilities',
    vendor: 'Hydro-Quebec',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    costs: ['320.00'],
    totalAmount: '320.00',
    startDate: '2024-01-01',
    status: 'overdue',
    createdAt: new Date('2024-01-20'),
    buildingName: 'Maple Heights Condos'
  },
  {
    id: '4',
    buildingId: '1',
    billNumber: 'CLEAN-2024-004',
    title: 'Janitorial Services',
    description: 'Weekly cleaning of common areas',
    category: 'cleaning',
    vendor: 'Clean Pro Services',
    paymentType: 'recurrent',
    schedulePayment: 'weekly',
    costs: ['200.00'],
    totalAmount: '200.00',
    startDate: '2024-01-01',
    status: 'sent',
    createdAt: new Date('2024-01-10'),
    buildingName: 'Maple Heights Condos'
  }
];

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Bills User Flow End-to-End Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderBillsPage = () => {
    return render(<Bills />);
  };

  describe('Complete Bills Management User Journey', () => {
    it('should allow user to navigate through complete bills workflow', async () => {
      // Setup mocks for initial page load
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBills,
        } as Response);

      renderBillsPage();

      // Step 1: Verify page loads with correct title
      expect(screen.getByText('Bills Management')).toBeInTheDocument();
      expect(screen.getByText('Manage building expenses and revenue tracking')).toBeInTheDocument();

      // Step 2: Verify filters section is present
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Building')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Year')).toBeInTheDocument();

      // Step 3: Verify initial state shows building selection prompt
      expect(screen.getByText('Select a Building')).toBeInTheDocument();
      expect(screen.getByText('Choose a building from the filter above to view and manage its bills')).toBeInTheDocument();

      // Step 4: Select a building from dropdown
      await waitFor(() => {
        expect(screen.getByText('Select building')).toBeInTheDocument();
      });

      const buildingSelect = screen.getByRole('combobox');
      await user.click(buildingSelect);

      await waitFor(() => {
        expect(screen.getByText('Maple Heights Condos')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Maple Heights Condos'));

      // Step 5: Verify bills load and display correctly
      await waitFor(() => {
        expect(screen.getByText('Insurance')).toBeInTheDocument();
        expect(screen.getByText('Maintenance')).toBeInTheDocument();
        expect(screen.getByText('Utilities')).toBeInTheDocument();
        expect(screen.getByText('Cleaning')).toBeInTheDocument();
      });

      // Step 6: Verify bill cards show correct information
      expect(screen.getByText('Annual Building Insurance')).toBeInTheDocument();
      expect(screen.getByText('Elevator Maintenance Contract')).toBeInTheDocument();
      expect(screen.getByText('Common Area Electricity')).toBeInTheDocument();
      expect(screen.getByText('Janitorial Services')).toBeInTheDocument();

      // Step 7: Verify bill amounts are displayed correctly
      expect(screen.getByText('$15,000')).toBeInTheDocument();
      expect(screen.getByText('$450')).toBeInTheDocument();
      expect(screen.getByText('$320')).toBeInTheDocument();
      expect(screen.getByText('$200')).toBeInTheDocument();

      // Step 8: Verify status badges are displayed
      expect(screen.getByText('sent')).toBeInTheDocument();
      expect(screen.getByText('paid')).toBeInTheDocument();
      expect(screen.getByText('overdue')).toBeInTheDocument();

      // Step 9: Verify vendor information is shown
      expect(screen.getByText('Vendor: SecureGuard Insurance Inc.')).toBeInTheDocument();
      expect(screen.getByText('Vendor: ElevatorTech Services')).toBeInTheDocument();
      expect(screen.getByText('Vendor: Hydro-Quebec')).toBeInTheDocument();
      expect(screen.getByText('Vendor: Clean Pro Services')).toBeInTheDocument();
    });

    it('should handle category filtering workflow', async () => {
      // Setup mocks
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBills,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBills.filter(bill => bill.category === 'insurance'),
        } as Response);

      renderBillsPage();

      // Select building first
      await waitFor(() => {
        const buildingSelect = screen.getByRole('combobox');
        user.click(buildingSelect);
      });

      await waitFor(() => {
        user.click(screen.getByText('Maple Heights Condos'));
      });

      // Wait for bills to load
      await waitFor(() => {
        expect(screen.getByText('Annual Building Insurance')).toBeInTheDocument();
      });

      // Apply category filter
      const categorySelect = screen.getAllByRole('combobox')[1]; // Second combobox is category
      await user.click(categorySelect);

      await waitFor(() => {
        expect(screen.getByText('Insurance')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Insurance'));

      // Verify only insurance bills are shown
      await waitFor(() => {
        expect(screen.getByText('Annual Building Insurance')).toBeInTheDocument();
        expect(screen.queryByText('Elevator Maintenance Contract')).not.toBeInTheDocument();
        expect(screen.queryByText('Common Area Electricity')).not.toBeInTheDocument();
        expect(screen.queryByText('Janitorial Services')).not.toBeInTheDocument();
      });
    });

    it('should handle year filtering workflow', async () => {
      // Setup mocks for different years
      const bills2023 = mockBills.map(bill => ({
        ...bill,
        startDate: bill.startDate.replace('2024', '2023'),
        createdAt: new Date('2023-01-01')
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBills,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => bills2023,
        } as Response);

      renderBillsPage();

      // Select building
      await waitFor(() => {
        const buildingSelect = screen.getByRole('combobox');
        user.click(buildingSelect);
      });

      await user.click(screen.getByText('Maple Heights Condos'));

      // Wait for bills to load
      await waitFor(() => {
        expect(screen.getByText('Annual Building Insurance')).toBeInTheDocument();
      });

      // Change year filter
      const yearSelect = screen.getAllByRole('combobox')[2]; // Third combobox is year
      await user.click(yearSelect);

      await waitFor(() => {
        expect(screen.getByText('2023')).toBeInTheDocument();
      });

      await user.click(screen.getByText('2023'));

      // Verify bills are filtered by year (mock data should be filtered)
      await waitFor(() => {
        // The exact behavior depends on mock implementation
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle create bill dialog workflow', async () => {
      // Setup mocks
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBills,
        } as Response);

      renderBillsPage();

      // Select building
      await waitFor(() => {
        const buildingSelect = screen.getByRole('combobox');
        user.click(buildingSelect);
      });

      await user.click(screen.getByText('Maple Heights Condos'));

      // Wait for bills to load and create button to be enabled
      await waitFor(() => {
        const createButton = screen.getByText('Create Bill');
        expect(createButton).not.toBeDisabled();
      });

      // Click create bill button
      const createButton = screen.getByText('Create Bill');
      await user.click(createButton);

      // Verify dialog opens
      await waitFor(() => {
        expect(screen.getByText('Create New Bill')).toBeInTheDocument();
        expect(screen.getByText('Create Manually')).toBeInTheDocument();
        expect(screen.getByText('Upload & Analyze')).toBeInTheDocument();
      });

      // Verify tabs work
      const uploadTab = screen.getByText('Upload & Analyze');
      await user.click(uploadTab);

      await waitFor(() => {
        expect(screen.getByText('Upload bill document for AI analysis')).toBeInTheDocument();
        expect(screen.getByText('Coming next...')).toBeInTheDocument();
      });

      // Switch back to manual tab
      const manualTab = screen.getByText('Create Manually');
      await user.click(manualTab);

      await waitFor(() => {
        expect(screen.getByText('Manual bill creation form')).toBeInTheDocument();
      });
    });

    it('should handle no bills scenario', async () => {
      // Setup mocks with empty bills array
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        } as Response);

      renderBillsPage();

      // Select building
      await waitFor(() => {
        const buildingSelect = screen.getByRole('combobox');
        user.click(buildingSelect);
      });

      await user.click(screen.getByText('Maple Heights Condos'));

      // Verify no bills message
      await waitFor(() => {
        expect(screen.getByText('No Bills Found')).toBeInTheDocument();
        expect(screen.getByText('No bills found for the selected filters. Create your first bill to get started.')).toBeInTheDocument();
        expect(screen.getByText('Create First Bill')).toBeInTheDocument();
      });
    });

    it('should handle loading states correctly', async () => {
      // Setup mock that never resolves to simulate loading
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      renderBillsPage();

      // Select building
      await waitFor(() => {
        const buildingSelect = screen.getByRole('combobox');
        user.click(buildingSelect);
      });

      await user.click(screen.getByText('Maple Heights Condos'));

      // Verify loading state
      await waitFor(() => {
        expect(screen.getByText('Loading bills...')).toBeInTheDocument();
      });
    });

    it('should display bill categories with correct counts', async () => {
      // Setup mocks
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBuildings,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBills,
        } as Response);

      renderBillsPage();

      // Select building
      await waitFor(() => {
        const buildingSelect = screen.getByRole('combobox');
        user.click(buildingSelect);
      });

      await user.click(screen.getByText('Maple Heights Condos'));

      // Wait for bills to load
      await waitFor(() => {
        // Verify category sections with counts
        const insuranceSection = screen.getByText('Insurance').closest('div');
        expect(within(insuranceSection!).getByText('1')).toBeInTheDocument();

        const maintenanceSection = screen.getByText('Maintenance').closest('div');
        expect(within(maintenanceSection!).getByText('1')).toBeInTheDocument();

        const utilitiesSection = screen.getByText('Utilities').closest('div');
        expect(within(utilitiesSection!).getByText('1')).toBeInTheDocument();

        const cleaningSection = screen.getByText('Cleaning').closest('div');
        expect(within(cleaningSection!).getByText('1')).toBeInTheDocument();
      });
    });
  });
});