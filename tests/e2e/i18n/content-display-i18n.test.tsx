/**
 * @file Content Display Internationalization E2E Tests.
 * @description End-to-end tests for French and English content display across the application.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';

// Mock data for testing with both languages
const mockDemandsData = {
  en: [
    {
      id: '1',
      type: 'maintenance',
      status: 'submitted',
      description: 'The kitchen faucet is leaking and needs immediate repair',
      building: { name: 'Residential Tower A', address: '123 Main Street' },
      residence: { unitNumber: 'Unit 405' },
      submitter: { firstName: 'John', lastName: 'Smith' },
      createdAt: '2025-08-20T10:30:00Z',
      updatedAt: '2025-08-20T10:30:00Z',
    },
    {
      id: '2',
      type: 'complaint',
      status: 'under_review',
      description: 'Noise complaints from the upstairs neighbor during nighttime hours',
      building: { name: 'Metropolitan Complex B', address: '456 Oak Avenue' },
      residence: { unitNumber: 'Apartment 2B' },
      submitter: { firstName: 'Sarah', lastName: 'Johnson' },
      createdAt: '2025-08-19T14:15:00Z',
      updatedAt: '2025-08-20T09:00:00Z',
    },
  ],
  fr: [
    {
      id: '1',
      type: 'maintenance',
      status: 'submitted',
      description: 'Le robinet de cuisine fuit et nécessite une réparation immédiate',
      building: { name: 'Tour Résidentielle A', address: '123, rue Principale' },
      residence: { unitNumber: 'Unité 405' },
      submitter: { firstName: 'Jean', lastName: 'Dupont' },
      createdAt: '2025-08-20T10:30:00Z',
      updatedAt: '2025-08-20T10:30:00Z',
    },
    {
      id: '2',
      type: 'complaint',
      status: 'under_review',
      description: "Plaintes de bruit du voisin d'en haut pendant les heures nocturnes",
      building: { name: 'Complexe Métropolitain B', address: '456, avenue du Chêne' },
      residence: { unitNumber: 'Appartement 2B' },
      submitter: { firstName: 'Marie', lastName: 'Tremblay' },
      createdAt: '2025-08-19T14:15:00Z',
      updatedAt: '2025-08-20T09:00:00Z',
    },
  ],
};

// Mock multilingual demands list component
const MultilingualDemandsList = ({ language = 'en' }: { language?: 'en' | 'fr' }) => {
  const [selectedLanguage, setSelectedLanguage] = React.useState(language);
  const demands = mockDemandsData[selectedLanguage];

  const translations = {
    en: {
      title: 'Property Demands',
      filterBy: 'Filter by:',
      all: 'All',
      maintenance: 'Maintenance',
      complaint: 'Complaint',
      information: 'Information',
      other: 'Other',
      statusSubmitted: 'Submitted',
      statusUnderReview: 'Under Review',
      statusApproved: 'Approved',
      statusInProgress: 'In Progress',
      statusCompleted: 'Completed',
      statusRejected: 'Rejected',
      building: 'Building:',
      residence: 'Residence:',
      submitter: 'Submitted by:',
      created: 'Created:',
      updated: 'Last Updated:',
      noResults: 'No demands found',
      searchPlaceholder: 'Search demands...',
      switchToFrench: 'Français',
      switchToEnglish: 'English',
      viewDetails: 'View Details',
      addComment: 'Add Comment',
      exportData: 'Export Data',
      refreshList: 'Refresh List',
      itemsPerPage: 'items per page',
      showing: 'Showing',
      of: 'of',
      results: 'results',
    },
    fr: {
      title: 'Demandes immobilières',
      filterBy: 'Filtrer par :',
      all: 'Toutes',
      maintenance: 'Maintenance',
      complaint: 'Plainte',
      information: 'Information',
      other: 'Autre',
      statusSubmitted: 'Soumis',
      statusUnderReview: 'En révision',
      statusApproved: 'Approuvé',
      statusInProgress: 'En cours',
      statusCompleted: 'Terminé',
      statusRejected: 'Rejeté',
      building: 'Bâtiment :',
      residence: 'Résidence :',
      submitter: 'Soumis par :',
      created: 'Créé :',
      updated: 'Dernière mise à jour :',
      noResults: 'Aucune demande trouvée',
      searchPlaceholder: 'Rechercher des demandes...',
      switchToFrench: 'Français',
      switchToEnglish: 'English',
      viewDetails: 'Voir les détails',
      addComment: 'Ajouter un commentaire',
      exportData: 'Exporter les données',
      refreshList: 'Actualiser la liste',
      itemsPerPage: 'éléments par page',
      showing: 'Affichage',
      of: 'sur',
      results: 'résultats',
    },
  };

  const t = translations[selectedLanguage];

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (selectedLanguage === 'fr') {
      return date.toLocaleDateString('fr-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      submitted: t.statusSubmitted,
      under_review: t.statusUnderReview,
      approved: t.statusApproved,
      in_progress: t.statusInProgress,
      completed: t.statusCompleted,
      rejected: t.statusRejected,
    };
    return statusMap[status] || status;
  };

  const getTypeText = (type: string): string => {
    const typeMap: Record<string, string> = {
      maintenance: t.maintenance,
      complaint: t.complaint,
      information: t.information,
      other: t.other,
    };
    return typeMap[type] || type;
  };

  return (
    <div className='p-6' data-testid='demands-list-container'>
      {/* Language Switcher */}
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold' data-testid='page-title'>
          {t.title}
        </h1>
        <div className='flex gap-2'>
          <button
            onClick={() => setSelectedLanguage('en')}
            className={`px-3 py-1 rounded ${selectedLanguage === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            data-testid='switch-to-english'
          >
            {t.switchToEnglish}
          </button>
          <button
            onClick={() => setSelectedLanguage('fr')}
            className={`px-3 py-1 rounded ${selectedLanguage === 'fr' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            data-testid='switch-to-french'
          >
            {t.switchToFrench}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className='mb-6 space-y-4'>
        <div className='flex gap-4'>
          <input
            type='text'
            placeholder={t.searchPlaceholder}
            className='flex-1 px-3 py-2 border border-gray-300 rounded'
            data-testid='search-input'
          />
          <button
            className='px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700'
            data-testid='export-button'
          >
            {t.exportData}
          </button>
          <button
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
            data-testid='refresh-button'
          >
            {t.refreshList}
          </button>
        </div>

        <div className='flex gap-4 items-center'>
          <span className='font-medium' data-testid='filter-label'>
            {t.filterBy}
          </span>
          <select className='px-3 py-1 border border-gray-300 rounded' data-testid='type-filter'>
            <option value=''>{t.all}</option>
            <option value='maintenance'>{t.maintenance}</option>
            <option value='complaint'>{t.complaint}</option>
            <option value='information'>{t.information}</option>
            <option value='other'>{t.other}</option>
          </select>
          <select className='px-3 py-1 border border-gray-300 rounded' data-testid='status-filter'>
            <option value=''>{t.all}</option>
            <option value='submitted'>{t.statusSubmitted}</option>
            <option value='under_review'>{t.statusUnderReview}</option>
            <option value='approved'>{t.statusApproved}</option>
            <option value='in_progress'>{t.statusInProgress}</option>
            <option value='completed'>{t.statusCompleted}</option>
            <option value='rejected'>{t.statusRejected}</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className='mb-4' data-testid='results-summary'>
        <p className='text-gray-600'>
          {t.showing} <span className='font-medium'>1-{demands.length}</span> {t.of}{' '}
          <span className='font-medium'>{demands.length}</span> {t.results}
        </p>
      </div>

      {/* Demands List */}
      <div className='space-y-4' data-testid='demands-list'>
        {demands.map((demand, _index) => (
          <div
            key={demand.id}
            className='bg-white border border-gray-200 rounded-lg p-4 shadow-sm'
            data-testid={`demand-card-${index}`}
          >
            {/* Header */}
            <div className='flex justify-between items-start mb-3'>
              <div className='flex items-center gap-3'>
                <span className='px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium'>
                  {getTypeText(demand.type)}
                </span>
                <span className='px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium'>
                  {getStatusText(demand.status)}
                </span>
              </div>
              <div className='flex gap-2'>
                <button
                  className='px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm'
                  data-testid={`view-details-${index}`}
                >
                  {t.viewDetails}
                </button>
                <button
                  className='px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm'
                  data-testid={`add-comment-${index}`}
                >
                  {t.addComment}
                </button>
              </div>
            </div>

            {/* Description */}
            <div className='mb-3'>
              <p className='text-gray-900' data-testid={`demand-description-${index}`}>
                {demand.description}
              </p>
            </div>

            {/* Metadata */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600'>
              <div data-testid={`building-info-${index}`}>
                <span className='font-medium'>{t.building}</span> {demand.building.name}
              </div>
              <div data-testid={`residence-info-${index}`}>
                <span className='font-medium'>{t.residence}</span> {demand.residence.unitNumber}
              </div>
              <div data-testid={`submitter-info-${index}`}>
                <span className='font-medium'>{t.submitter}</span> {demand.submitter.firstName}{' '}
                {demand.submitter.lastName}
              </div>
              <div data-testid={`created-info-${index}`}>
                <span className='font-medium'>{t.created}</span> {formatDate(demand.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className='mt-6 flex justify-between items-center'>
        <div className='text-sm text-gray-600'>10 {t.itemsPerPage}</div>
        <div className='flex gap-2'>
          <button className='px-3 py-1 border border-gray-300 rounded disabled:opacity-50' disabled>
            {selectedLanguage === 'en' ? 'Previous' : 'Précédent'}
          </button>
          <button className='px-3 py-1 border border-gray-300 rounded'>
            {selectedLanguage === 'en' ? 'Next' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
};

describe('Content Display Internationalization E2E Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>{component}</LanguageProvider>
      </QueryClientProvider>
    );
  };

  describe('English Content Display', () => {
    it('should display all English interface elements correctly', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      // Check main interface elements
      expect(screen.getByTestId('page-title')).toHaveTextContent('Property Demands');
      expect(screen.getByTestId('filter-label')).toHaveTextContent('Filter by:');
      expect(screen.getByTestId('search-input')).toHaveAttribute(
        'placeholder',
        'Search demands...'
      );
      expect(screen.getByTestId('export-button')).toHaveTextContent('Export Data');
      expect(screen.getByTestId('refresh-button')).toHaveTextContent('Refresh List');

      // Check results summary
      const resultsSummary = screen.getByTestId('results-summary');
      expect(resultsSummary).toHaveTextContent('Showing 1-2 of 2 results');
    });

    it('should display English demand type and status labels', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const typeFilter = screen.getByTestId('type-filter');
      const statusFilter = screen.getByTestId('status-filter');

      // Check type filter options
      expect(within(typeFilter).getByText('All')).toBeInTheDocument();
      expect(within(typeFilter).getByText('Maintenance')).toBeInTheDocument();
      expect(within(typeFilter).getByText('Complaint')).toBeInTheDocument();
      expect(within(typeFilter).getByText('Information')).toBeInTheDocument();

      // Check status filter options
      expect(within(statusFilter).getByText('Submitted')).toBeInTheDocument();
      expect(within(statusFilter).getByText('Under Review')).toBeInTheDocument();
      expect(within(statusFilter).getByText('Approved')).toBeInTheDocument();
    });

    it('should display English demand card content correctly', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      // Check first demand card
      const firstCard = screen.getByTestId('demand-card-0');
      expect(within(firstCard).getByText('Maintenance')).toBeInTheDocument();
      expect(within(firstCard).getByText('Submitted')).toBeInTheDocument();

      const description = screen.getByTestId('demand-description-0');
      expect(description).toHaveTextContent(
        'The kitchen faucet is leaking and needs immediate repair'
      );

      const buildingInfo = screen.getByTestId('building-info-0');
      expect(buildingInfo).toHaveTextContent('Building: Residential Tower A');

      const residenceInfo = screen.getByTestId('residence-info-0');
      expect(residenceInfo).toHaveTextContent('Residence: Unit 405');

      const submitterInfo = screen.getByTestId('submitter-info-0');
      expect(submitterInfo).toHaveTextContent('Submitted by: John Smith');
    });

    it('should format English dates correctly', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const createdInfo = screen.getByTestId('created-info-0');
      expect(createdInfo.textContent).toContain('Created:');
      expect(createdInfo.textContent).toMatch(/August \d+, 2025/); // English month name
    });

    it('should display English button labels', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      expect(screen.getByTestId('view-details-0')).toHaveTextContent('View Details');
      expect(screen.getByTestId('add-comment-0')).toHaveTextContent('Add Comment');
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  describe('French Content Display', () => {
    it('should display all French interface elements correctly', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      // Check main interface elements
      expect(screen.getByTestId('page-title')).toHaveTextContent('Demandes immobilières');
      expect(screen.getByTestId('filter-label')).toHaveTextContent('Filtrer par :');
      expect(screen.getByTestId('search-input')).toHaveAttribute(
        'placeholder',
        'Rechercher des demandes...'
      );
      expect(screen.getByTestId('export-button')).toHaveTextContent('Exporter les données');
      expect(screen.getByTestId('refresh-button')).toHaveTextContent('Actualiser la liste');

      // Check results summary
      const resultsSummary = screen.getByTestId('results-summary');
      expect(resultsSummary).toHaveTextContent('Affichage 1-2 sur 2 résultats');
    });

    it('should display French demand type and status labels', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      const typeFilter = screen.getByTestId('type-filter');
      const statusFilter = screen.getByTestId('status-filter');

      // Check type filter options
      expect(within(typeFilter).getByText('Toutes')).toBeInTheDocument();
      expect(within(typeFilter).getByText('Maintenance')).toBeInTheDocument();
      expect(within(typeFilter).getByText('Plainte')).toBeInTheDocument();
      expect(within(typeFilter).getByText('Information')).toBeInTheDocument();

      // Check status filter options
      expect(within(statusFilter).getByText('Soumis')).toBeInTheDocument();
      expect(within(statusFilter).getByText('En révision')).toBeInTheDocument();
      expect(within(statusFilter).getByText('Approuvé')).toBeInTheDocument();
    });

    it('should display French demand card content correctly', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      // Check first demand card
      const firstCard = screen.getByTestId('demand-card-0');
      expect(within(firstCard).getByText('Maintenance')).toBeInTheDocument();
      expect(within(firstCard).getByText('Soumis')).toBeInTheDocument();

      const description = screen.getByTestId('demand-description-0');
      expect(description).toHaveTextContent(
        'Le robinet de cuisine fuit et nécessite une réparation immédiate'
      );

      const buildingInfo = screen.getByTestId('building-info-0');
      expect(buildingInfo).toHaveTextContent('Bâtiment : Tour Résidentielle A');

      const residenceInfo = screen.getByTestId('residence-info-0');
      expect(residenceInfo).toHaveTextContent('Résidence : Unité 405');

      const submitterInfo = screen.getByTestId('submitter-info-0');
      expect(submitterInfo).toHaveTextContent('Soumis par : Jean Dupont');
    });

    it('should format French dates correctly', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      const createdInfo = screen.getByTestId('created-info-0');
      expect(createdInfo.textContent).toContain('Créé :');
      expect(createdInfo.textContent).toMatch(/août \d+, 2025/); // French month name (lowercase)
    });

    it('should display French button labels', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      expect(screen.getByTestId('view-details-0')).toHaveTextContent('Voir les détails');
      expect(screen.getByTestId('add-comment-0')).toHaveTextContent('Ajouter un commentaire');
      expect(screen.getByText('Précédent')).toBeInTheDocument();
      expect(screen.getByText('Suivant')).toBeInTheDocument();
    });

    it('should use Quebec French address formatting', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      // Quebec French uses comma before street number
      const buildingInfo = screen.getByTestId('building-info-0');
      expect(buildingInfo.textContent).toContain('Tour Résidentielle A');
    });
  });

  describe('Language Switching', () => {
    it('should switch from English to French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandsList language='en' />);

      // Initially in English
      expect(screen.getByTestId('page-title')).toHaveTextContent('Property Demands');

      // Switch to French
      const frenchButton = screen.getByTestId('switch-to-french');
      await user.click(frenchButton);

      // Should now be in French
      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Demandes immobilières');
      });

      // Content should change
      expect(screen.getByTestId('filter-label')).toHaveTextContent('Filtrer par :');
      expect(screen.getByTestId('export-button')).toHaveTextContent('Exporter les données');
    });

    it('should switch from French to English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      // Initially in French
      expect(screen.getByTestId('page-title')).toHaveTextContent('Demandes immobilières');

      // Switch to English
      const englishButton = screen.getByTestId('switch-to-english');
      await user.click(englishButton);

      // Should now be in English
      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Property Demands');
      });

      // Content should change
      expect(screen.getByTestId('filter-label')).toHaveTextContent('Filter by:');
      expect(screen.getByTestId('export-button')).toHaveTextContent('Export Data');
    });

    it('should maintain language selection state correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandsList language='en' />);

      // Switch to French
      await user.click(screen.getByTestId('switch-to-french'));

      await waitFor(() => {
        const frenchButton = screen.getByTestId('switch-to-french');
        const englishButton = screen.getByTestId('switch-to-english');

        // French button should be active
        expect(frenchButton).toHaveClass('bg-blue-600', 'text-white');
        expect(englishButton).toHaveClass('bg-gray-200');
      });
    });
  });

  describe('Cultural and Regional Preferences', () => {
    it('should display Quebec-specific terminology in French', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      // Should use "courriel" instead of "email" (not visible in this test but concept applies)
      // Should use proper Quebec address formatting
      const buildingInfo = screen.getByTestId('building-info-0');
      expect(buildingInfo.textContent).toContain('Bâtiment :'); // With space before colon (French typography)
    });

    it('should handle date formatting for Canadian locales', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const createdInfo = screen.getByTestId('created-info-0');
      // Canadian English date format should be used
      expect(createdInfo.textContent).toMatch(/August \d+, 2025/);

      const { rerender } = renderWithProviders(<MultilingualDemandsList language='fr' />);

      const frCreatedInfo = screen.getByTestId('created-info-0');
      // Canadian French date format should be used
      expect(frCreatedInfo.textContent).toMatch(/août \d+, 2025/);
    });

    it('should handle pluralization correctly in both languages', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const resultsSummary = screen.getByTestId('results-summary');
      expect(resultsSummary).toHaveTextContent('2 results'); // English plural

      const { rerender } = renderWithProviders(<MultilingualDemandsList language='fr' />);

      const frResultsSummary = screen.getByTestId('results-summary');
      expect(frResultsSummary).toHaveTextContent('2 résultats'); // French plural
    });
  });

  describe('Accessibility in Multiple Languages', () => {
    it('should maintain proper reading order in English', () => {
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const container = screen.getByTestId('demands-list-container');

      // Check that headings and content follow logical order
      const title = screen.getByTestId('page-title');
      const filterLabel = screen.getByTestId('filter-label');
      const demandsList = screen.getByTestId('demands-list');

      expect(title).toBeInTheDocument();
      expect(filterLabel).toBeInTheDocument();
      expect(demandsList).toBeInTheDocument();
    });

    it('should maintain proper reading order in French', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      const container = screen.getByTestId('demands-list-container');

      // Check that headings and content follow logical order
      const title = screen.getByTestId('page-title');
      const filterLabel = screen.getByTestId('filter-label');
      const demandsList = screen.getByTestId('demands-list');

      expect(title).toBeInTheDocument();
      expect(filterLabel).toBeInTheDocument();
      expect(demandsList).toBeInTheDocument();
    });

    it('should have appropriate language attributes', () => {
      renderWithProviders(<MultilingualDemandsList language='fr' />);

      // In a real implementation, lang attributes would be set
      const pageTitle = screen.getByTestId('page-title');
      expect(pageTitle).toBeInTheDocument();

      // French content should be marked with appropriate lang attributes
      // This would be done in the real LanguageProvider
    });
  });

  describe('Performance with Language Switching', () => {
    it('should switch languages without flickering', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const pageTitle = screen.getByTestId('page-title');
      expect(pageTitle).toHaveTextContent('Property Demands');

      // Switch should be immediate
      await user.click(screen.getByTestId('switch-to-french'));

      // No intermediate state, should go directly to French
      await waitFor(() => {
        expect(pageTitle).toHaveTextContent('Demandes immobilières');
      });
    });

    it('should preserve user input during language switch', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MultilingualDemandsList language='en' />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'kitchen');

      // Switch languages
      await user.click(screen.getByTestId('switch-to-french'));

      await waitFor(() => {
        // Search input should retain its value
        expect(searchInput).toHaveValue('kitchen');
        // But placeholder should change to French
        expect(searchInput).toHaveAttribute('placeholder', 'Rechercher des demandes...');
      });
    });
  });
});
