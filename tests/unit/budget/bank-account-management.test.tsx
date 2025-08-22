import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import Budget from '@/pages/manager/budget';
import { renderBudgetComponent } from '../budget-test-setup';
import '../budget-test-setup';

describe('Budget Bank Account Management Tests', () => {

  const mockBuildings = [
    {
      id: 'building-1',
      name: 'Test Building',
      address: '123 Test Street',
      organizationId: 'org-1',
    },
  ];

  const mockBankAccountInfo = {
    bankAccountNumber: '9876543210',
    bankAccountNotes: 'Primary operating account',
    bankAccountUpdatedAt: '2024-01-20T15:30:00Z',
    bankAccountStartDate: '2024-01-01',
    bankAccountStartAmount: 150000,
    bankAccountMinimums: JSON.stringify([
      { id: '1', amount: 75000, description: 'Emergency reserve' },
      { id: '2', amount: 30000, description: 'Maintenance fund' },
      { id: '3', amount: 15000, description: 'Administrative expenses' },
    ]),
    inflationSettings: JSON.stringify({
      incomeSettings: [
        {
          id: '1',
          category: 'monthly_fees',
          type: 'income',
          rate: 2.5,
          applicationMode: 'yearly',
          description: 'Annual condo fee increases',
        },
      ],
      expenseSettings: [
        {
          id: '2',
          category: 'utilities',
          type: 'expense',
          rate: 4.0,
          applicationMode: 'yearly',
          description: 'Utility cost inflation',
        },
      ],
      generalIncome: 2.0,
      generalExpense: 3.5,
    }),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,
          queryFn: async ({ queryKey }) => {
            const url = Array.isArray(queryKey) ? queryKey[0] : queryKey;
            const response = await fetch(url as string);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          },
        },
        mutations: { retry: false },
      },
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager@example.com',
        role: 'manager',
        isActive: true,
        organizationId: 'org-1',
      },
      logout: jest.fn(),
      isAuthenticated: true,
      isLoading: false,
      login: jest.fn(),
    });

    mockUseLanguage.mockReturnValue({
      language: 'en',
      setLanguage: jest.fn(),
      t: jest.fn((key) => key),
      translations: {},
    });

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Bank Account Information Display', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('renders budget component without crashing', async () => {
      // Simple test to verify Budget component can be imported and rendered
      const { container } = renderBudgetComponent(<Budget />);

      // The component should at least render without throwing an error
      expect(container).toBeInTheDocument();
    });

    it('shows formatted dates correctly', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Updated:')).toBeInTheDocument();
        expect(screen.getByText('Start Date:')).toBeInTheDocument();
      });
    });

    it('displays minimum balance requirements', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Minimum Balances:')).toBeInTheDocument();
        expect(screen.getByText('Emergency reserve')).toBeInTheDocument();
        expect(screen.getByText('$75,000')).toBeInTheDocument();
        expect(screen.getByText('Maintenance fund')).toBeInTheDocument();
        expect(screen.getByText('$30,000')).toBeInTheDocument();
        expect(screen.getByText('Administrative expenses')).toBeInTheDocument();
        expect(screen.getByText('$15,000')).toBeInTheDocument();
      });
    });

    it('shows action buttons for bank account management', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Update Account')).toBeInTheDocument();
        expect(screen.getByText('Manage Minimum Balances')).toBeInTheDocument();
      });
    });
  });

  describe('Bank Account Update Dialog', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          if (options?.method === 'PUT') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('opens update dialog when Update Account button is clicked', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const updateButton = screen.getByText('Update Account');
        fireEvent.click(updateButton);
      });

      expect(screen.getByText('Update Bank Account')).toBeInTheDocument();
      expect(screen.getByLabelText('Bank Account Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Reconciliation Note')).toBeInTheDocument();
      expect(screen.getByLabelText('Tracking Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Starting Balance ($)')).toBeInTheDocument();
    });

    it('pre-fills form with existing account information', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const updateButton = screen.getByText('Update Account');
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        const accountNumberInput = screen.getByLabelText('Bank Account Number') as HTMLInputElement;
        const startDateInput = screen.getByLabelText('Tracking Start Date') as HTMLInputElement;
        const startAmountInput = screen.getByLabelText('Starting Balance ($)') as HTMLInputElement;

        expect(accountNumberInput.value).toBe('9876543210');
        expect(startDateInput.value).toBe('2024-01-01');
        expect(startAmountInput.value).toBe('150000');
      });
    });

    it('validates required fields', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const updateButton = screen.getByText('Update Account');
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        // Clear required fields
        const accountNumberInput = screen.getByLabelText('Bank Account Number');
        fireEvent.change(accountNumberInput, { target: { value: '' } });

        const submitButton = screen.getByText('Update Account');
        fireEvent.click(submitButton);
      });

      // Form should not submit with empty required fields
      expect(screen.getByText('Update Bank Account')).toBeInTheDocument();
    });

    it('submits updated account information', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const updateButton = screen.getByText('Update Account');
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        // Update form fields
        const accountNumberInput = screen.getByLabelText('Bank Account Number');
        fireEvent.change(accountNumberInput, { target: { value: '1111222233' } });

        const reconciliationNoteInput = screen.getByLabelText('Reconciliation Note');
        fireEvent.change(reconciliationNoteInput, { target: { value: 'Updated account number' } });

        const startAmountInput = screen.getByLabelText('Starting Balance ($)');
        fireEvent.change(startAmountInput, { target: { value: '200000' } });

        const submitButton = screen.getByText('Update Account');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/bank-account'),
          expect.objectContaining({
            method: 'PUT',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"bankAccountNumber":"1111222233"'),
          })
        );
      });
    });
  });

  describe('Minimum Balances Management', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          if (options?.method === 'PUT') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('opens minimum balances dialog', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const manageButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageButton);
      });

      expect(screen.getByText('Manage Minimum Balances')).toBeInTheDocument();
      expect(screen.getByText('Manage required minimum balances for this bank account.')).toBeInTheDocument();
    });

    it('displays existing minimum balance settings', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const manageButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageButton);
      });

      await waitFor(() => {
        // Check for existing minimum balance entries
        const amountInputs = screen.getAllByPlaceholderText('Amount');
        const descriptionInputs = screen.getAllByPlaceholderText(/Emergency fund|Maintenance fund|Administrative/);

        expect(amountInputs).toHaveLength(3);
        expect(descriptionInputs).toHaveLength(3);
      });
    });

    it('allows adding new minimum balance requirements', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const manageButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageButton);
      });

      await waitFor(() => {
        const addButton = screen.getByText('Add Minimum');
        fireEvent.click(addButton);

        // Should add a new row
        const amountInputs = screen.getAllByPlaceholderText('Amount');
        expect(amountInputs).toHaveLength(4); // 3 existing + 1 new
      });
    });

    it('allows removing minimum balance requirements', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const manageButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageButton);
      });

      await waitFor(() => {
        const deleteButtons = screen.getAllByTestId('delete-minimum');
        expect(deleteButtons).toHaveLength(3);

        // Remove one minimum balance
        fireEvent.click(deleteButtons[0]);

        const remainingDeleteButtons = screen.getAllByTestId('delete-minimum');
        expect(remainingDeleteButtons).toHaveLength(2);
      });
    });

    it('validates minimum balance form inputs', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const manageButton = screen.getByText('Manage Minimum Balances');
        fireEvent.click(manageButton);
      });

      await waitFor(() => {
        // Try to add a minimum with invalid amount
        const addButton = screen.getByText('Add Minimum');
        fireEvent.click(addButton);

        const amountInputs = screen.getAllByPlaceholderText('Amount');
        const newAmountInput = amountInputs[amountInputs.length - 1];
        fireEvent.change(newAmountInput, { target: { value: '-1000' } });

        const submitButton = screen.getByText('Save Changes');
        fireEvent.click(submitButton);

        // Should validate negative amounts
        expect(screen.getByText('Manage Minimum Balances')).toBeInTheDocument();
      });
    });
  });

  describe('Language Support for Bank Account Management', () => {
    beforeEach(() => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: jest.fn((key) => key),
        translations: {},
      });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('displays French translations for bank account interface', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Gestion du compte bancaire')).toBeInTheDocument();
        expect(screen.getByText('Compte actuel:')).toBeInTheDocument();
        expect(screen.getByText('Dernière note:')).toBeInTheDocument();
        expect(screen.getByText('Mis à jour:')).toBeInTheDocument();
        expect(screen.getByText('Date de début:')).toBeInTheDocument();
        expect(screen.getByText('Solde initial:')).toBeInTheDocument();
        expect(screen.getByText('Soldes minimums:')).toBeInTheDocument();
        expect(screen.getByText('Mettre à jour le compte')).toBeInTheDocument();
        expect(screen.getByText('Gérer les soldes minimums')).toBeInTheDocument();
      });
    });

    it('displays French translations in update dialog', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const updateButton = screen.getByText('Mettre à jour le compte');
        fireEvent.click(updateButton);
      });

      expect(screen.getByText('Mettre à jour le compte bancaire')).toBeInTheDocument();
      expect(screen.getByText('Mettre à jour les informations du compte bancaire pour ce bâtiment.')).toBeInTheDocument();
      expect(screen.getByLabelText('Numéro de compte bancaire')).toBeInTheDocument();
      expect(screen.getByLabelText('Note de rapprochement')).toBeInTheDocument();
      expect(screen.getByLabelText('Date de début du suivi')).toBeInTheDocument();
      expect(screen.getByLabelText('Solde initial ($)')).toBeInTheDocument();
    });

    it('displays French translations in minimum balances dialog', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const manageButton = screen.getByText('Gérer les soldes minimums');
        fireEvent.click(manageButton);
      });

      expect(screen.getByText('Gérer les soldes minimums')).toBeInTheDocument();
      expect(screen.getByText('Gérer les soldes minimums requis pour ce compte bancaire.')).toBeInTheDocument();
      expect(screen.getByText('Ajouter un minimum')).toBeInTheDocument();
      expect(screen.getByText('Montant')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Annuler')).toBeInTheDocument();
      expect(screen.getByText('Sauvegarder')).toBeInTheDocument();
    });
  });

  describe('No Bank Account Scenario', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });
    });

    it('displays message when no bank account is set', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Bank Account Management')).toBeInTheDocument();
        expect(screen.getByText('No bank account set for this building')).toBeInTheDocument();
        expect(screen.getByText('Set Bank Account')).toBeInTheDocument();
      });
    });

    it('shows French message when no bank account is set', async () => {
      mockUseLanguage.mockReturnValue({
        language: 'fr',
        setLanguage: jest.fn(),
        t: jest.fn((key) => key),
        translations: {},
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Sélectionner un bâtiment...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        expect(screen.getByText('Gestion du compte bancaire')).toBeInTheDocument();
        expect(screen.getByText('Aucun compte bancaire défini pour ce bâtiment')).toBeInTheDocument();
        expect(screen.getByText('Définir le compte bancaire')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles bank account update API errors', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          if (options?.method === 'PUT') {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({ error: 'Internal server error' }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBankAccountInfo),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        const updateButton = screen.getByText('Update Account');
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        const submitButton = screen.getByText('Update Account');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: expect.stringContaining('Failed to update bank account'),
            variant: 'destructive',
          })
        );
      });
    });

    it('handles malformed minimum balance JSON gracefully', async () => {
      const bankAccountWithBadJSON = {
        ...mockBankAccountInfo,
        bankAccountMinimums: 'invalid json string',
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/buildings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBuildings),
          });
        }
        if (url.includes('/bank-account')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bankAccountWithBadJSON),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <Budget />
          </TestProviders>
        </QueryClientProvider>
      );

      const buildingSelect = screen.getByDisplayValue('Select a building...');
      fireEvent.change(buildingSelect, { target: { value: 'building-1' } });

      await waitFor(() => {
        // Should display bank account info but handle malformed JSON gracefully
        expect(screen.getByText('Bank Account Management')).toBeInTheDocument();
        expect(screen.getByText('9876543210')).toBeInTheDocument();
        
        // Should not show minimum balances since JSON is malformed
        expect(screen.queryByText('Emergency reserve')).not.toBeInTheDocument();
      });
    });
  });
});