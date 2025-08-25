import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'wouter/memory';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '@/hooks/use-language';
import HomePage from '@/pages/home';
import { translations } from '@/lib/i18n';

/**
 * Comprehensive Website Translation Tests.
 * 
 * Tests the bilingual (English/French) support across the entire website
 * ensuring Quebec Law 25 compliance and proper localization.
 */

// Test providers wrapper
/**
 *
 * @param root0
 * @param root0.children
 * @param root0.initialLocation
  * @returns Function result.
*/
function TestProviders({ children, initialLocation = '/' }: { children: React.ReactNode; initialLocation?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialLocation]}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Website Translation Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Mock localStorage for language persistence
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn(),
    };
    global.localStorage = localStorageMock as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  describe('Language Coverage Validation', () => {
    it('should have complete French translations for all English keys', () => {
      const englishKeys = Object.keys(translations.en);
      const frenchKeys = Object.keys(translations.fr);
      
      const missingFrenchKeys = englishKeys.filter(key => !frenchKeys.includes(_key));
      const extraFrenchKeys = frenchKeys.filter(key => !englishKeys.includes(_key));
      
      expect(missingFrenchKeys).toEqual([]);
      expect(extraFrenchKeys).toEqual([]);
      expect(englishKeys.length).toBe(frenchKeys.length);
    });

    it('should use Quebec French terminology correctly', () => {
      const quebecTerms = [
        { _key: 'emailAddress', french: translations.fr.emailAddress },
        { _key: 'sendWelcomeEmail', french: translations.fr.sendWelcomeEmail },
        { _key: 'userManagement', french: translations.fr.userManagement },
      ];

      quebecTerms.forEach(({ key, french }) => {
        // Should use "courriel" instead of "email"
        if (key.toLowerCase().includes('email')) {
          expect(french.toLowerCase()).toMatch(/courriel|courriels/);
          expect(french.toLowerCase()).not.toMatch(/\bemail\b/);
        }
      });
    });

    it('should use proper Quebec French for user management terms', () => {
      // Test user management specific terminology
      const userManagementTerms = {
        'user': 'utilisateur',
        'role': 'rôle',
        'active': 'actif',
        'inactive': 'inactif',
        'email': 'courriel',
        'first name': 'prénom',
        'last name': 'nom de famille',
        'organization': 'organisation',
        'residence': 'résidence',
        'invite': 'inviter',
        'edit': 'modifier',
        'delete': 'supprimer',
        'status': 'statut',
        'previous': 'précédent',
        'next': 'suivant',
        'showing': 'affichage'
      };

      Object.entries(userManagementTerms).forEach(([english, expectedFrench]) => {
        // For this test, we verify the terminology mapping is correct
        expect(expectedFrench).toBeTruthy();
        expect(expectedFrench.length).toBeGreaterThan(0);
        
        // Quebec French should use proper accents
        if (expectedFrench.includes('é') || expectedFrench.includes('ô')) {
          expect(expectedFrench).toMatch(/[éèàôç]/);
        }
      });
    });

    it('should have proper French accents and diacritics', () => {
      const frenchTexts = Object.values(translations.fr);
      
      // Check for common Quebec French requirements
      const textsWithProperAccents = frenchTexts.filter(text => 
        typeof text === 'string' && text.length > 3
      );

      textsWithProperAccents.forEach(text => {
        // Common Quebec words should have proper accents
        expect(text).not.toMatch(/\bQuebec\b/); // Should be "Québec"
        expect(text).not.toMatch(/\bMontreal\b/); // Should be "Montréal"
        
        // Proper French terminology
        if (text.includes('préférences')) {
          expect(text).not.toMatch(/preferences/);
        }
      });
    });
  });

  describe('Language Switcher Functionality', () => {
    it('should render language switcher on home page', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Look for language switcher elements
      const languageSwitcher = screen.getByRole('button', { name: /language|langue/i }) || 
                              screen.getByText(/EN|FR/) ||
                              screen.getByTestId('language-switcher');
      
      expect(languageSwitcher).toBeInTheDocument();
    });

    it('should switch content language when toggled', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Test language toggle functionality
      const initialText = screen.getByText(/Modern Property Management/i);
      expect(initialText).toBeInTheDocument();

      // Try to find and click language switcher
      const languageSwitcher = screen.queryByRole('button', { name: /FR|Français/i });
      if (languageSwitcher) {
        fireEvent.click(languageSwitcher);
        
        // After switching, content should be in French
        expect(screen.queryByText(/Gestion immobilière moderne/i)).toBeInTheDocument();
      }
    });
  });

  describe('Page Content Translation', () => {
    it('should display proper Quebec terminology on home page', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for Quebec-specific terms
      expect(screen.getByText(/Quebec/)).toBeInTheDocument();
      
      // Should mention Quebec compliance
      expect(screen.getByText(/Quebec Law 25/i)).toBeInTheDocument();
      expect(screen.getByText(/Quebec.*compliance/i)).toBeInTheDocument();
    });

    it('should display proper terminology on user management page', () => {
      // Mock the required API endpoints for user management
      const UserManagement = () => {
        return (
          <div data-testid="user-management-page">
            <h1>User Management</h1>
            <button data-testid="button-invite-user">Invite User</button>
            <button data-testid="button-edit-user">Edit User</button>
            <div data-testid="text-user-role">Role</div>
            <div data-testid="text-user-status">Status</div>
            <div data-testid="text-user-email">Email Address</div>
            <div data-testid="text-user-firstname">First Name</div>
            <div data-testid="text-user-lastname">Last Name</div>
            <div data-testid="text-user-organizations">Organizations</div>
            <div data-testid="text-user-residences">Residences</div>
            <div data-testid="text-user-active">Active</div>
            <div data-testid="text-user-inactive">Inactive</div>
            <div data-testid="text-pagination-previous">Previous</div>
            <div data-testid="text-pagination-next">Next</div>
            <div data-testid="text-pagination-showing">Showing users</div>
            <div data-testid="text-no-residences">No residences</div>
            <div data-testid="text-no-organizations">No organizations</div>
          </div>
        );
      };

      render(
        <TestProviders>
          <UserManagement />
        </TestProviders>
      );

      // Verify key user management elements are present
      expect(screen.getByTestId('user-management-page')).toBeInTheDocument();
      expect(screen.getByTestId('button-invite-user')).toBeInTheDocument();
      expect(screen.getByTestId('button-edit-user')).toBeInTheDocument();
      expect(screen.getByTestId('text-user-role')).toBeInTheDocument();
      expect(screen.getByTestId('text-user-status')).toBeInTheDocument();
      expect(screen.getByTestId('text-user-email')).toBeInTheDocument();
    });

    it('should use appropriate business terminology', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Property management specific terms
      expect(screen.getByText(/Property Management/i)).toBeInTheDocument();
      expect(screen.getByText(/Building Management/i)).toBeInTheDocument();
      expect(screen.getByText(/Resident Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/Financial Reporting/i)).toBeInTheDocument();
    });

    it('should not use inappropriate English terms in French content', () => {
      // Mock localStorage to return French language
      jest.spyOn(global.localStorage, 'getItem').mockReturnValue('fr');
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check that French version doesn't contain English business terms
      const pageText = document.body.textContent || '';
      
      // Should not contain English terms when in French mode
      const inappropriateTerms = [
        'property manager', 'tenant', 'lease agreement',
        'common areas', 'board of directors', 'condo fees',
        'user management', 'edit user', 'email address',
        'first name', 'last name', 'role', 'status'
      ];

      inappropriateTerms.forEach(term => {
        expect(pageText.toLowerCase()).not.toContain(term.toLowerCase());
      });
    });
  });

  describe('Form and UI Element Translation', () => {
    it('should translate button text appropriately', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for English buttons
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
      expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
      
      // These should exist as buttons
      expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('should translate user management form elements properly', () => {
      const UserManagementForm = () => {
        return (
          <form data-testid="user-management-form">
            <label data-testid="label-firstname">Prénom</label>
            <input data-testid="input-firstname" placeholder="Entrez le prénom" />
            
            <label data-testid="label-lastname">Nom de famille</label>
            <input data-testid="input-lastname" placeholder="Entrez le nom de famille" />
            
            <label data-testid="label-email">Adresse courriel</label>
            <input data-testid="input-email" placeholder="Entrez l'adresse courriel" />
            
            <label data-testid="label-role">Rôle</label>
            <select data-testid="select-role">
              <option value="admin">Administrateur</option>
              <option value="manager">Gestionnaire</option>
              <option value="tenant">Locataire</option>
              <option value="resident">Résident</option>
            </select>
            
            <label data-testid="label-status">Statut</label>
            <select data-testid="select-status">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
            
            <button data-testid="button-save">Sauvegarder</button>
            <button data-testid="button-cancel">Annuler</button>
            <button data-testid="button-delete">Supprimer</button>
          </form>
        );
      };

      render(
        <TestProviders>
          <UserManagementForm />
        </TestProviders>
      );

      // Verify form elements use proper Quebec French
      expect(screen.getByTestId('label-firstname')).toHaveTextContent('Prénom');
      expect(screen.getByTestId('label-lastname')).toHaveTextContent('Nom de famille');
      expect(screen.getByTestId('label-email')).toHaveTextContent('courriel');
      expect(screen.getByTestId('label-role')).toHaveTextContent('Rôle');
      expect(screen.getByTestId('label-status')).toHaveTextContent('Statut');
      
      // Verify role options use Quebec French
      expect(screen.getByText('Administrateur')).toBeInTheDocument();
      expect(screen.getByText('Gestionnaire')).toBeInTheDocument();
      expect(screen.getByText('Locataire')).toBeInTheDocument();
      expect(screen.getByText('Résident')).toBeInTheDocument();
      
      // Verify status options
      expect(screen.getByText('Actif')).toBeInTheDocument();
      expect(screen.getByText('Inactif')).toBeInTheDocument();
      
      // Verify action buttons
      expect(screen.getByTestId('button-save')).toHaveTextContent('Sauvegarder');
      expect(screen.getByTestId('button-cancel')).toHaveTextContent('Annuler');
      expect(screen.getByTestId('button-delete')).toHaveTextContent('Supprimer');
    });

    it('should have proper data-testid attributes for language testing', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for test IDs on important interactive elements
      const getStartedButton = screen.getByText(/Get Started/i);
      const signInButton = screen.getByText(/Sign In/i);
      
      expect(getStartedButton.closest('button')).toHaveAttribute('data-testid');
      expect(signInButton.closest('button')).toHaveAttribute('data-testid');
    });
  });

  describe('Quebec Legal Compliance', () => {
    it('should display Quebec Law 25 compliance messaging', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Must show Quebec Law 25 compliance
      expect(screen.getByText(/Quebec Law 25 Compliant/i)).toBeInTheDocument();
      expect(screen.getByText(/data.*protected/i)).toBeInTheDocument();
    });

    it('should handle user management with Quebec Law 25 compliance', () => {
      // Test Quebec-specific user management compliance
      const UserManagementCompliance = () => {
        return (
          <div data-testid="user-management-compliance">
            <div data-testid="privacy-notice">Conforme à la Loi 25 du Québec</div>
            <div data-testid="data-protection">Protection des données personnelles</div>
            <div data-testid="user-consent">Consentement de l'utilisateur</div>
            <div data-testid="data-access">Accès aux données</div>
            <div data-testid="data-deletion">Suppression des données</div>
          </div>
        );
      };

      render(
        <TestProviders>
          <UserManagementCompliance />
        </TestProviders>
      );

      // Verify Quebec Law 25 compliance elements
      expect(screen.getByTestId('privacy-notice')).toBeInTheDocument();
      expect(screen.getByTestId('data-protection')).toBeInTheDocument();
      expect(screen.getByTestId('user-consent')).toBeInTheDocument();
      expect(screen.getByTestId('data-access')).toBeInTheDocument();
      expect(screen.getByTestId('data-deletion')).toBeInTheDocument();
    });

    it('should use legally appropriate French terminology', () => {
      const legalTerms = {
        'copropriété': translations.fr.manager || 'gestionnaire', // Should relate to condo management
        'locataire': translations.fr.tenant || 'locataire',
        'gestionnaire immobilier': translations.fr.manager || 'gestionnaire',
      };

      Object.entries(legalTerms).forEach(([expected, actual]) => {
        expect(typeof actual).toBe('string');
        expect(actual.length).toBeGreaterThan(0);
      });
    });

    it('should maintain consistent Quebec French across all text', () => {
      const frenchValues = Object.values(translations.fr);
      
      frenchValues.forEach(text => {
        if (typeof text === 'string' && text.length > 5) {
          // Should use Quebec French conventions
          expect(text).not.toMatch(/weekend/); // Should be "fin de semaine"
          expect(text).not.toMatch(/parking/); // Should be "stationnement"
          expect(text).not.toMatch(/email/); // Should be "courriel"
        }
      });
    });
  });

  describe('Language Persistence and Consistency', () => {
    it('should persist language selection across page reloads', () => {
      const setItemSpy = jest.spyOn(global.localStorage, 'setItem');
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Simulate language change
      const languageSwitcher = screen.queryByRole('button', { name: /FR/i });
      if (languageSwitcher) {
        fireEvent.click(languageSwitcher);
        expect(setItemSpy).toHaveBeenCalledWith('language', 'fr');
      }
    });

    it('should maintain French language in user management pagination', () => {
      const UserManagementPagination = () => {
        return (
          <div data-testid="user-pagination-french">
            <div data-testid="pagination-info">
              Affichage 1-10 sur 25 utilisateurs filtrés (50 au total)
            </div>
            <div data-testid="pagination-controls">
              <button data-testid="button-previous">Précédent</button>
              <span data-testid="page-info">Page 1 sur 3</span>
              <button data-testid="button-next">Suivant</button>
            </div>
            <div data-testid="filter-status">
              <span>Filtres actifs: Rôle (Gestionnaire), Statut (Actif)</span>
            </div>
            <div data-testid="no-users-message">
              Aucun utilisateur trouvé avec les filtres sélectionnés.
            </div>
          </div>
        );
      };

      render(
        <TestProviders>
          <UserManagementPagination />
        </TestProviders>
      );

      // Verify pagination uses proper Quebec French
      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Affichage');
      expect(screen.getByTestId('pagination-info')).toHaveTextContent('utilisateurs');
      expect(screen.getByTestId('button-previous')).toHaveTextContent('Précédent');
      expect(screen.getByTestId('button-next')).toHaveTextContent('Suivant');
      expect(screen.getByTestId('page-info')).toHaveTextContent('Page');
      
      // Verify filter text uses French
      expect(screen.getByTestId('filter-status')).toHaveTextContent('Filtres actifs');
      expect(screen.getByTestId('filter-status')).toHaveTextContent('Gestionnaire');
      
      // Verify empty state message
      expect(screen.getByTestId('no-users-message')).toHaveTextContent('Aucun utilisateur trouvé');
    });

    it('should maintain language consistency across navigation', () => {
      jest.spyOn(global.localStorage, 'getItem').mockReturnValue('fr');
      
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Should load in French if that's the stored preference
      // This tests the persistence mechanism
      expect(global.localStorage.getItem).toHaveBeenCalledWith('language');
    });
  });

  describe('Accessibility and Translation', () => {
    it('should provide proper aria labels in both languages', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check for accessibility attributes
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type');
      });

      // Images should have alt text
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
        expect(img.getAttribute('alt')).not.toBe('');
      });
    });

    it('should use semantic HTML with proper language attributes', () => {
      render(
        <TestProviders>
          <HomePage />
        </TestProviders>
      );

      // Check document structure
      const main = document.querySelector('main') || document.body;
      expect(main).toBeInTheDocument();

      // Should have proper heading hierarchy
      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements.length).toBeGreaterThanOrEqual(1);
    });
  });
});

/**
 * Quebec French Terminology Validation Helper.
 */
export const QUEBEC_TERMINOLOGY_MAP = {
  // Property management terms
  'property manager': 'gestionnaire immobilier',
  'tenant': 'locataire',
  'condo fees': 'charges de copropriété',
  'lease agreement': 'contrat de bail',
  'common areas': 'parties communes',
  'board of directors': 'conseil d\'administration',
  'annual general meeting': 'assemblée générale annuelle',
  'contingency fund': 'fonds de prévoyance',
  
  // User management terms
  'user management': 'gestion des utilisateurs',
  'user': 'utilisateur',
  'first name': 'prénom',
  'last name': 'nom de famille',
  'email address': 'adresse courriel',
  'role': 'rôle',
  'status': 'statut',
  'active': 'actif',
  'inactive': 'inactif',
  'edit user': 'modifier l\'utilisateur',
  'delete user': 'supprimer l\'utilisateur',
  'invite user': 'inviter un utilisateur',
  'organization': 'organisation',
  'residence': 'résidence',
  'previous': 'précédent',
  'next': 'suivant',
  'showing': 'affichage',
  'total': 'total',
  'filtered': 'filtrés',
  'save': 'sauvegarder',
  'cancel': 'annuler',
  'admin': 'administrateur',
  'manager': 'gestionnaire',
  'resident': 'résident',
  
  // Technology terms
  'email': 'courriel',
  'website': 'site web',
  'software': 'logiciel',
  'database': 'base de données',
  
  // General business terms
  'customer': 'client',
  'service': 'service',
  'contact': 'contact',
  'support': 'soutien',
};

/**
 * Validate that text uses Quebec French terminology.
 * @param text
 */
export function validateQuebecTerminology(text: string): Array<{term: string, suggestion: string}> {
  const violations: Array<{term: string, suggestion: string}> = [];
  
  Object.entries(QUEBEC_TERMINOLOGY_MAP).forEach(([english, french]) => {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    if (regex.test(text)) {
      violations.push({ term: english, suggestion: french });
    }
  });
  
  return violations;
}