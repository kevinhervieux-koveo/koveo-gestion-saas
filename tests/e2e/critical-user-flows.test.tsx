/**
 * End-to-End Tests for Critical Quebec Property Management User Flows.
 * 
 * Tests complete user journeys through the Koveo Gestion platform,
 * ensuring Quebec compliance and property management requirements.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'wouter/memory';
import { LanguageProvider } from '@/hooks/use-language';
import App from '@/App';

// Mock fetch for API calls
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Critical Quebec Property Management User Flows', () => {
  let queryClient: QueryClient;
  let user: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    user = userEvent.setup();
    mockFetch.mockClear();
  });

  const renderWithProviders = (initialRoute = '/') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  describe('Quebec Property Manager Complete Workflow', () => {
    test('Property manager can complete full building management flow', async () => {
      // Mock authentication
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '1',
            firstName: 'Marie',
            lastName: 'Dubois',
            email: 'marie@koveo.ca',
            role: 'manager',
            language: 'fr'
          })
        })
      );

      // Mock buildings data
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: '1',
              name: 'Résidence Les Érables',
              address: '123 Rue Sherbrooke, Montréal, QC',
              units: 24,
              status: 'operational'
            }
          ])
        })
      );

      renderWithProviders('/manager/buildings');

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText(/Résidence Les Érables/i)).toBeInTheDocument();
      });

      // Test Quebec French interface
      expect(screen.getByText(/Immeubles/i)).toBeInTheDocument();
      expect(screen.getByText(/Statut/i)).toBeInTheDocument();

      // Navigate to building details
      const buildingLink = screen.getByText('Résidence Les Érables');
      await user.click(buildingLink);

      // Test building management features
      await waitFor(() => {
        expect(screen.getByText(/Unités/i)).toBeInTheDocument();
      });
    });

    test('Property manager can handle maintenance requests in Quebec French', async () => {
      // Mock maintenance requests
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: '1',
              title: 'Réparation de plomberie',
              description: 'Fuite dans la salle de bain de l\'unité 3A',
              priority: 'high',
              status: 'submitted',
              quebecCompliance: true
            }
          ])
        })
      );

      renderWithProviders('/manager/demands');

      await waitFor(() => {
        expect(screen.getByText(/Demandes/i)).toBeInTheDocument();
        expect(screen.getByText(/Réparation de plomberie/i)).toBeInTheDocument();
      });

      // Test Quebec compliance features
      expect(screen.getByText(/Priorité/i)).toBeInTheDocument();
      expect(screen.getByText(/Statut/i)).toBeInTheDocument();

      // Update maintenance request status
      const statusButton = screen.getByRole('button', { name: /modifier le statut/i });
      await user.click(statusButton);

      // Mock status update
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );

      const inProgressOption = screen.getByText(/en cours/i);
      await user.click(inProgressOption);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/maintenance-requests/1'),
          expect.objectContaining({
            method: 'PUT',
            body: expect.stringContaining('in_progress')
          })
        );
      });
    });
  });

  describe('Quebec Tenant Self-Service Flow', () => {
    test('Tenant can submit maintenance request with Quebec compliance', async () => {
      // Mock tenant authentication
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '2',
            firstName: 'Pierre',
            lastName: 'Leblanc',
            email: 'pierre@example.ca',
            role: 'tenant',
            language: 'fr'
          })
        })
      );

      renderWithProviders('/residents/demands');

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(/Mes demandes/i)).toBeInTheDocument();
      });

      // Click create new request
      const createButton = screen.getByRole('button', { name: /nouvelle demande/i });
      await user.click(createButton);

      // Fill out maintenance request form
      const titleInput = screen.getByLabelText(/titre/i);
      await user.type(titleInput, 'Problème de chauffage');

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, 'Le chauffage ne fonctionne pas dans le salon');

      const prioritySelect = screen.getByLabelText(/priorité/i);
      await user.selectOptions(prioritySelect, 'high');

      // Test Quebec compliance validation
      expect(screen.getByText(/loi 25/i)).toBeInTheDocument();

      // Mock form submission
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '2',
            title: 'Problème de chauffage',
            status: 'submitted'
          })
        })
      );

      const submitButton = screen.getByRole('button', { name: /soumettre/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/demande soumise avec succès/i)).toBeInTheDocument();
      });
    });

    test('Tenant can view building information with Quebec regulations', async () => {
      // Mock building data
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: '1',
            name: 'Résidence Les Érables',
            address: '123 Rue Sherbrooke, Montréal, QC',
            quebecRegulations: {
              smokingPolicy: 'Interdiction de fumer dans tous les espaces communs',
              noisePolicy: 'Heures de silence: 22h00 à 7h00',
              law25Compliance: true
            }
          })
        })
      );

      renderWithProviders('/residents/building');

      await waitFor(() => {
        expect(screen.getByText(/Mon immeuble/i)).toBeInTheDocument();
        expect(screen.getByText(/Résidence Les Érables/i)).toBeInTheDocument();
      });

      // Test Quebec regulations display
      expect(screen.getByText(/Règlements québécois/i)).toBeInTheDocument();
      expect(screen.getByText(/Interdiction de fumer/i)).toBeInTheDocument();
      expect(screen.getByText(/Loi 25/i)).toBeInTheDocument();
    });
  });

  describe('Quebec Financial Management Flow', () => {
    test('Manager can process Quebec-compliant billing', async () => {
      // Mock billing data
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: '1',
              amount: 1250.00,
              type: 'condo_fees',
              dueDate: '2024-01-15',
              quebecTaxes: {
                gst: 62.50,
                qst: 124.38
              },
              status: 'sent'
            }
          ])
        })
      );

      renderWithProviders('/manager/bills');

      await waitFor(() => {
        expect(screen.getByText(/Factures/i)).toBeInTheDocument();
      });

      // Test Quebec tax calculations
      expect(screen.getByText(/TPS/i)).toBeInTheDocument();
      expect(screen.getByText(/TVQ/i)).toBeInTheDocument();
      expect(screen.getByText(/62,50/)).toBeInTheDocument();
      expect(screen.getByText(/124,38/)).toBeInTheDocument();

      // Create new bill
      const createBillButton = screen.getByRole('button', { name: /nouvelle facture/i });
      await user.click(createBillButton);

      // Fill bill form with Quebec compliance
      const amountInput = screen.getByLabelText(/montant/i);
      await user.type(amountInput, '1500.00');

      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'condo_fees');

      // Test Quebec tax auto-calculation
      await waitFor(() => {
        expect(screen.getByDisplayValue(/75.00/)).toBeInTheDocument(); // GST
        expect(screen.getByDisplayValue(/149.25/)).toBeInTheDocument(); // QST
      });

      // Mock bill creation
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: '2', status: 'created' })
        })
      );

      const saveBillButton = screen.getByRole('button', { name: /sauvegarder/i });
      await user.click(saveBillButton);

      await waitFor(() => {
        expect(screen.getByText(/facture créée avec succès/i)).toBeInTheDocument();
      });
    });
  });

  describe('Quebec Compliance & Documentation Flow', () => {
    test('Complete Law 25 compliance documentation workflow', async () => {
      renderWithProviders('/owner/documentation');

      await waitFor(() => {
        expect(screen.getByText(/Documentation/i)).toBeInTheDocument();
      });

      // Test Law 25 compliance section
      expect(screen.getByText(/Loi 25/i)).toBeInTheDocument();
      expect(screen.getByText(/Protection des renseignements personnels/i)).toBeInTheDocument();

      // Navigate to compliance checklist
      const complianceLink = screen.getByText(/Liste de vérification Loi 25/i);
      await user.click(complianceLink);

      // Mock compliance data
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            dataInventory: true,
            privacyPolicy: true,
            consentMechanisms: false,
            securityMeasures: true,
            incidentResponse: false
          })
        })
      );

      await waitFor(() => {
        expect(screen.getByText(/Inventaire des données/i)).toBeInTheDocument();
        expect(screen.getByText(/Complété/i)).toBeInTheDocument();
      });

      // Update compliance status
      const consentCheckbox = screen.getByLabelText(/Mécanismes de consentement/i);
      await user.click(consentCheckbox);

      // Mock status update
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ updated: true })
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/compliance'),
          expect.objectContaining({
            method: 'PUT'
          })
        );
      });
    });
  });

  describe('Quality Assurance & Metrics Flow', () => {
    test('Quality metrics tracking with Quebec compliance validation', async () => {
      renderWithProviders('/owner/quality');

      await waitFor(() => {
        expect(screen.getByText(/Assurance qualité/i)).toBeInTheDocument();
      });

      // Test metrics display
      expect(screen.getByText(/Couverture de tests/i)).toBeInTheDocument();
      expect(screen.getByText(/Vulnérabilités de sécurité/i)).toBeInTheDocument();
      expect(screen.getByText(/Score de conformité québécoise/i)).toBeInTheDocument();

      // Mock metrics data
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              metricType: 'quebec_compliance_score',
              _value: '87.5',
              timestamp: new Date().toISOString(),
              quebecSpecific: true
            }
          ])
        })
      );

      // Trigger metrics refresh
      const refreshButton = screen.getByRole('button', { name: /actualiser/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText(/87,5%/)).toBeInTheDocument();
      });

      // Test metric validation
      const validateButton = screen.getByRole('button', { name: /valider/i });
      await user.click(validateButton);

      // Mock validation response
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isValid: true,
            accuracy: 92.5,
            quebecComplianceNotes: ['Score conforme aux exigences québécoises']
          })
        })
      );

      await waitFor(() => {
        expect(screen.getByText(/Validation réussie/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multi-language Support Flow', () => {
    test('Complete language switching with Quebec French validation', async () => {
      renderWithProviders('/');

      // Test initial French interface
      expect(screen.getByText(/Tableau de bord/i)).toBeInTheDocument();

      // Switch to English
      const languageToggle = screen.getByRole('button', { name: /english/i });
      await user.click(languageToggle);

      await waitFor(() => {
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      });

      // Switch back to French
      const frenchToggle = screen.getByRole('button', { name: /français/i });
      await user.click(frenchToggle);

      await waitFor(() => {
        expect(screen.getByText(/Tableau de bord/i)).toBeInTheDocument();
      });

      // Test Quebec French validation
      expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
      expect(screen.getByText(/courriel/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling & Recovery Flows', () => {
    test('Network error recovery with Quebec user messaging', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders('/manager/buildings');

      await waitFor(() => {
        expect(screen.getByText(/Erreur de connexion/i)).toBeInTheDocument();
        expect(screen.getByText(/Veuillez réessayer/i)).toBeInTheDocument();
      });

      // Test retry functionality
      const retryButton = screen.getByRole('button', { name: /réessayer/i });
      
      // Mock successful retry
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      );

      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.queryByText(/Erreur de connexion/i)).not.toBeInTheDocument();
      });
    });

    test('Form validation errors with Quebec compliance messages', async () => {
      renderWithProviders('/residents/demands');

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /soumettre/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Ce champ est requis/i)).toBeInTheDocument();
      });

      // Test Quebec privacy validation
      const personalDataCheckbox = screen.getByLabelText(/données personnelles/i);
      await user.click(personalDataCheckbox);

      expect(screen.getByText(/Conformité Loi 25/i)).toBeInTheDocument();
    });
  });
});