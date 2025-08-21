import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import Bills from '@/pages/manager/bills';

// Mock the API calls
const mockBuildings = [
  { id: '1', name: 'Building A' },
  { id: '2', name: 'Building B' }
];

const mockBills = [
  {
    id: '1',
    buildingId: '1',
    billNumber: 'INS-2024-001',
    title: 'Building Insurance Premium',
    description: 'Annual building insurance coverage',
    category: 'insurance',
    vendor: 'SecureGuard Insurance',
    paymentType: 'recurrent',
    schedulePayment: 'yearly',
    costs: ['12000.00'],
    totalAmount: '12000.00',
    startDate: '2024-01-01',
    status: 'sent',
    createdAt: new Date(),
    buildingName: 'Building A'
  },
  {
    id: '2',
    buildingId: '1',
    billNumber: 'MAINT-2024-002',
    title: 'Elevator Maintenance',
    description: 'Monthly elevator inspection and maintenance',
    category: 'maintenance',
    vendor: 'ElevatorTech Services',
    paymentType: 'recurrent',
    schedulePayment: 'monthly',
    costs: ['450.00'],
    totalAmount: '450.00',
    startDate: '2024-01-01',
    status: 'paid',
    createdAt: new Date(),
    buildingName: 'Building A'
  }
];

// Mock the fetch function
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('Bills Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(<Bills />);
  };

  it('should render the bills page with correct title', () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    renderComponent();

    expect(screen.getByText('Bills Management')).toBeInTheDocument();
    expect(screen.getByText('Manage building expenses and revenue tracking')).toBeInTheDocument();
  });

  it('should render filters section', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Building')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Year')).toBeInTheDocument();
    });
  });

  it('should show building selection prompt when no building is selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Select a Building')).toBeInTheDocument();
      expect(screen.getByText('Choose a building from the filter above to view and manage its bills')).toBeInTheDocument();
    });
  });

  it('should display bills grouped by category when building is selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    // Select a building
    await waitFor(() => {
      const buildingSelect = screen.getByRole('combobox');
      fireEvent.click(buildingSelect);
    });

    // Wait for bills to load and display
    await waitFor(() => {
      expect(screen.getByText('Insurance')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
    });
  });

  it('should show correct bill information in cards', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    // Select building and wait for bills
    await waitFor(() => {
      expect(screen.getByText('Building Insurance Premium')).toBeInTheDocument();
      expect(screen.getByText('Elevator Maintenance')).toBeInTheDocument();
      expect(screen.getByText('$12,000')).toBeInTheDocument();
      expect(screen.getByText('$450')).toBeInTheDocument();
    });
  });

  it('should display bill status badges correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('sent')).toBeInTheDocument();
      expect(screen.getByText('paid')).toBeInTheDocument();
    });
  });

  it('should show create bill button when building is selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText('Create Bill');
      expect(createButton).toBeInTheDocument();
      expect(createButton).not.toBeDisabled();
    });
  });

  it('should disable create bill button when no building is selected', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response);

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText('Create Bill');
      expect(createButton).toBeDisabled();
    });
  });

  it('should filter bills by category when category filter is applied', async () => {
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

    renderComponent();

    // Wait for initial load then apply filter
    await waitFor(() => {
      expect(screen.getByText('Building Insurance Premium')).toBeInTheDocument();
    });

    // Apply category filter
    const categorySelect = screen.getAllByRole('combobox')[1]; // Second combobox is category
    fireEvent.click(categorySelect);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Insurance'));
    });

    // Verify only insurance bills are shown
    await waitFor(() => {
      expect(screen.getByText('Building Insurance Premium')).toBeInTheDocument();
      expect(screen.queryByText('Elevator Maintenance')).not.toBeInTheDocument();
    });
  });

  it('should show no bills message when no bills exist', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No Bills Found')).toBeInTheDocument();
      expect(screen.getByText('No bills found for the selected filters. Create your first bill to get started.')).toBeInTheDocument();
    });
  });

  it('should open create bill dialog when create button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText('Create Bill');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Create New Bill')).toBeInTheDocument();
      expect(screen.getByText('Create Manually')).toBeInTheDocument();
      expect(screen.getByText('Upload & Analyze')).toBeInTheDocument();
    });
  });

  it('should handle loading state correctly', () => {
    mockFetch
      .mockImplementationOnce(() => new Promise(() => {})); // Never resolves to simulate loading

    renderComponent();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display bill vendor information when available', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Vendor: SecureGuard Insurance')).toBeInTheDocument();
      expect(screen.getByText('Vendor: ElevatorTech Services')).toBeInTheDocument();
    });
  });

  it('should display payment type information', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildings,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockBills,
      } as Response);

    renderComponent();

    await waitFor(() => {
      const paymentTypes = screen.getAllByText('recurrent');
      expect(paymentTypes.length).toBeGreaterThan(0);
    });
  });
});