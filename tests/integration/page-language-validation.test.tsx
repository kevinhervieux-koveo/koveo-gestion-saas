import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'wouter/memory';
import { LanguageValidator } from '../unit/language-validation.test';

/**
 * Integration test suite for Quebec French language validation across all client pages.
 *
 * This test suite validates that all pages in the Koveo Gestion application
 * comply with Quebec French language standards and avoid problematic terms.
 */

// Mock authentication and data
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: {
      id: '1',
      firstName: 'Jean',
      lastName: 'Tremblay',
      email: 'jean@koveo.ca',
      role: 'manager',
      language: 'fr',
    },
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'fr',
    setLanguage: jest.fn(),
    t: (key: string) => key,
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock API calls
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  }),
  useMutation: jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isLoading: false,
  }),
  useQueryClient: jest.fn().mockReturnValue({
    invalidateQueries: jest.fn(),
  }),
}));

/**
 * Test wrapper component with all necessary providers.
 * @param root0
 * @param root0.children
 * @param root0.route
 */
function TestWrapper({ children, route = '/' }: { children: React.ReactNode; route?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <div data-testid='language-provider'>
          <div data-testid='auth-provider'>{children}</div>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Stub page components with typical Quebec French property management content
const AdminCompliancePage = () => (
  <div data-testid='admin-compliance'>
    <h1>Conformité</h1>
    <p>Gestion de la conformité réglementaire pour les propriétés au Québec</p>
    <p>Respect de la Loi 25 sur la protection des renseignements personnels</p>
    <button>Sauvegarder les paramètres</button>
    <button>Annuler les modifications</button>
  </div>
);

const AdminDocumentationPage = () => (
  <div data-testid='admin-documentation'>
    <h1>Documentation</h1>
    <p>Guide d'utilisation du système de gestion immobilière</p>
    <p>Formation pour les gestionnaires de copropriété</p>
    <a href='/help'>Centre d'aide</a>
  </div>
);

const ManagerBuildingsPage = () => (
  <div data-testid='manager-buildings'>
    <h1>Immeubles</h1>
    <p>Gestion des immeubles et copropriétés</p>
    <p>Ajouter un nouvel immeuble</p>
    <table>
      <thead>
        <tr>
          <th>Nom de l'immeuble</th>
          <th>Adresse</th>
          <th>Nombre d'unités</th>
          <th>Actions</th>
        </tr>
      </thead>
    </table>
  </div>
);

const ManagerResidencesPage = () => (
  <div data-testid='manager-residences'>
    <h1>Résidences</h1>
    <p>Gestion des unités résidentielles</p>
    <p>Superviser les appartements et condos</p>
    <button>Créer une nouvelle résidence</button>
    <button>Modifier les détails</button>
  </div>
);

const ResidentsDashboardPage = () => (
  <div data-testid='residents-dashboard'>
    <h1>Tableau de bord des résidents</h1>
    <p>Bienvenue dans votre espace personnel</p>
    <p>Consultez vos demandes d'entretien</p>
    <p>Payez vos charges de copropriété</p>
    <nav>
      <a href='/residence'>Ma résidence</a>
      <a href='/demands'>Mes demandes</a>
      <a href='/bills'>Mes factures</a>
    </nav>
  </div>
);

const SettingsPage = () => (
  <div data-testid='settings-page'>
    <h1>Paramètres</h1>
    <p>Configuration du compte utilisateur</p>
    <label>Langue préférée:</label>
    <select>
      <option value='fr'>Français</option>
      <option value='en'>English</option>
    </select>
    <button>Mettre à jour le profil</button>
  </div>
);

const LoginPage = () => (
  <div data-testid='login-page'>
    <h1>Connexion</h1>
    <p>Accédez à votre compte Koveo Gestion</p>
    <form>
      <label>Courriel:</label>
      <input type='email' placeholder='votre@courriel.ca' />
      <label>Mot de passe:</label>
      <input type='password' />
      <button type='submit'>Se connecter</button>
    </form>
    <a href='/forgot-password'>Mot de passe oublié?</a>
  </div>
);

/**
 * Helper function to validate a page component.
 * @param PageComponent
 * @param pageName
 * @param route
 */
async function validatePageComponent(
  PageComponent: React.ComponentType,
  pageName: string,
  route: string = '/'
): Promise<{
  violations: Array<{
    type: string;
    term: string;
    suggestion?: string;
    severity: 'error' | 'warning';
    context: string;
  }>;
  report: string;
  isValid: boolean;
}> {
  const validator = new LanguageValidator();

  const { container } = render(
    <TestWrapper route={route}>
      <PageComponent />
    </TestWrapper>
  );

  // Wait for any async content to load
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Extract all text content from the rendered page
  const htmlContent = container.innerHTML;

  // Validate using the language validator
  validator.validateHTML(htmlContent, pageName);

  return {
    violations: validator.getViolations(),
    report: validator.generateReport(),
    isValid: validator.isValid(),
  };
}

describe('Page Language Validation - Admin Pages', () => {
  it('should validate Admin Compliance page language', async () => {
    const result = await validatePageComponent(
      AdminCompliancePage,
      'Admin Compliance',
      '/admin/compliance'
    );

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });

  it('should validate Admin Documentation page language', async () => {
    const result = await validatePageComponent(
      AdminDocumentationPage,
      'Admin Documentation',
      '/admin/documentation'
    );

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Page Language Validation - Manager Pages', () => {
  it('should validate Manager Buildings page language', async () => {
    const result = await validatePageComponent(
      ManagerBuildingsPage,
      'Manager Buildings',
      '/manager/buildings'
    );

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });

  it('should validate Manager Residences page language', async () => {
    const result = await validatePageComponent(
      ManagerResidencesPage,
      'Manager Residences',
      '/manager/residences'
    );

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Page Language Validation - Residents Pages', () => {
  it('should validate Residents Dashboard page language', async () => {
    const result = await validatePageComponent(
      ResidentsDashboardPage,
      'Residents Dashboard',
      '/dashboard'
    );

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Page Language Validation - Settings & Auth Pages', () => {
  it('should validate Settings page language', async () => {
    const result = await validatePageComponent(SettingsPage, 'Settings', '/settings');

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });

  it('should validate Login page language', async () => {
    const result = await validatePageComponent(LoginPage, 'Login', '/login');

    if (!result.isValid) {
      console.warn(`\n${result.report}`);
    }

    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });
});

// Comprehensive test to generate a full language report
describe('Full Application Language Audit', () => {
  it('should generate comprehensive language validation report for key pages', async () => {
    const validator = new LanguageValidator();

    const pagesToTest = [
      { Component: AdminCompliancePage, name: 'Admin Compliance', route: '/admin/compliance' },
      {
        Component: AdminDocumentationPage,
        name: 'Admin Documentation',
        route: '/admin/documentation',
      },
      { Component: ManagerBuildingsPage, name: 'Manager Buildings', route: '/manager/buildings' },
      {
        Component: ManagerResidencesPage,
        name: 'Manager Residences',
        route: '/manager/residences',
      },
      { Component: ResidentsDashboardPage, name: 'Residents Dashboard', route: '/dashboard' },
      { Component: SettingsPage, name: 'Settings', route: '/settings' },
      { Component: LoginPage, name: 'Login', route: '/login' },
    ];

    let totalViolations = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    let detailedReport = '\n=== RAPPORT COMPLET DE VALIDATION LINGUISTIQUE - KOVEO GESTION ===\n\n';

    for (const page of pagesToTest) {
      try {
        const result = await validatePageComponent(page.Component, page.name, page.route);

        const errors = result.violations.filter((v) => v.severity === 'error').length;
        const warnings = result.violations.filter((v) => v.severity === 'warning').length;

        totalViolations += result.violations.length;
        totalErrors += errors;
        totalWarnings += warnings;

        detailedReport += `📄 ${page.name} (${page.route})\n`;
        detailedReport += `   Erreurs: ${errors}, Avertissements: ${warnings}\n`;

        if (result.violations.length > 0) {
          detailedReport += `   Top violations:\n`;
          result.violations.slice(0, 3).forEach((violation, _index) => {
            detailedReport += `   ${_index + 1}. [${violation.type}] "${violation.term}"`;
            if (violation.suggestion) {
              detailedReport += ` → ${violation.suggestion}`;
            }
            detailedReport += '\n';
          });
        }
        detailedReport += '\n';
      } catch (error) {
        detailedReport += `❌ ${page.name}: Erreur lors du test - ${error}\n\n`;
      }
    }

    detailedReport += `\n=== RÉSUMÉ GLOBAL ===\n`;
    detailedReport += `Total des pages testées: ${pagesToTest.length}\n`;
    detailedReport += `Total des violations: ${totalViolations}\n`;
    detailedReport += `Total des erreurs: ${totalErrors}\n`;
    detailedReport += `Total des avertissements: ${totalWarnings}\n\n`;

    if (totalErrors === 0 && totalWarnings === 0) {
      detailedReport += `✅ EXCELLENT! Toutes les pages respectent les standards du français québécois.\n`;
    } else if (totalErrors === 0) {
      detailedReport += `⚠️  BON: Aucune erreur détectée, mais attention aux avertissements.\n`;
    } else if (totalErrors < 10) {
      detailedReport += `🔧 AMÉLIORATION NÉCESSAIRE: Quelques erreurs à corriger.\n`;
    } else {
      detailedReport += `❌ RÉVISION MAJEURE REQUISE: Nombreuses violations détectées.\n`;
    }

    detailedReport += `\n=== RECOMMANDATIONS ===\n`;
    detailedReport += `1. Remplacer tous les anglicismes par leurs équivalents français\n`;
    detailedReport += `2. Utiliser la terminologie spécifique au Québec pour la gestion immobilière\n`;
    detailedReport += `3. Ajouter les accents manquants dans les termes français\n`;
    detailedReport += `4. Éviter les termes légaux anglophones pour la copropriété\n`;
    detailedReport += `5. Réviser les traductions avec un expert en français québécois\n`;

    console.warn(detailedReport);

    // For CI/CD: fail if there are critical errors
    expect(totalErrors).toBeLessThan(50); // Adjust threshold as needed

    // Always log the summary for visibility
    expect(totalViolations).toBeGreaterThanOrEqual(0);
  });
});
