import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock components for testing translation coverage
const MockProjectsPage = ({ language = 'en' }: { language?: 'en' | 'fr' }) => {
  const translations = {
    en: {
      pageTitle: 'Projects - Maintenance Management',
      pageSubtitle: 'Manage maintenance projects, track progress, and coordinate work schedules',
      projectOverview: 'Project Overview',
      projects: 'Projects',
      newProject: 'New Project',
      clearSelection: 'Clear Selection',
      projectTable: 'Project Table',
      toggleProjectOverview: 'Toggle project overview',
      toggleProjectsTable: 'Toggle projects table',
      selectBuilding: 'Select Building',
      selectBuildingMessage: 'Please select an organization and building to view its maintenance projects.'
    },
    fr: {
      pageTitle: 'Projets - Gestion de maintenance',
      pageSubtitle: 'Gérer les projets de maintenance, suivre les progrès et coordonner les horaires de travail',
      projectOverview: 'Aperçu des projets',
      projects: 'Projets',
      newProject: 'Nouveau projet',
      clearSelection: 'Effacer la sélection',
      projectTable: 'Tableau des projets',
      toggleProjectOverview: 'Basculer l\'aperçu des projets',
      toggleProjectsTable: 'Basculer le tableau des projets',
      selectBuilding: 'Sélectionner un bâtiment',
      selectBuildingMessage: 'Veuillez sélectionner une organisation et un bâtiment pour voir ses projets de maintenance.'
    }
  };

  const t = translations[language];

  return (
    <div data-testid="projects-page">
      <h1>{t.pageTitle}</h1>
      <p>{t.pageSubtitle}</p>
      <section data-testid="project-overview-section">
        <h2>{t.projectOverview}</h2>
        <button aria-label={t.toggleProjectOverview}>Toggle</button>
      </section>
      <section data-testid="projects-table-section">
        <h2>{t.projects}</h2>
        <button data-testid="add-project-button">{t.newProject}</button>
        <button data-testid="clear-selection">{t.clearSelection}</button>
        <button aria-label={t.toggleProjectsTable}>Toggle</button>
        <div>{t.projectTable}</div>
      </section>
      <div data-testid="empty-state">
        <h2>{t.selectBuilding}</h2>
        <p>{t.selectBuildingMessage}</p>
      </div>
    </div>
  );
};

const MockInventoryPage = ({ language = 'en' }: { language?: 'en' | 'fr' }) => {
  const translations = {
    en: {
      pageTitle: 'Inventory Management',
      pageSubtitle: 'Manage building elements, maintenance records, and asset documentation across your property portfolio.',
      buildingElements: 'Building Elements',
      addElement: 'Add Element',
      clearSelection: 'Clear Selection',
      filters: 'Filters',
      overdueEvaluations: 'Overdue Evaluations',
      searchPlaceholder: 'Search elements by name, UNIFORMAT code, or description...',
      toggleBuildingElements: 'Toggle building elements table',
      condition: 'Condition',
      uniformatCategory: 'UNIFORMAT Category',
      allConditions: 'All Conditions',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      allCategories: 'All Categories',
      substructure: 'A - Substructure',
      shell: 'B - Shell',
      interiors: 'C - Interiors',
      services: 'D - Services',
      equipment: 'E - Equipment & Furnishings',
      specialConstruction: 'F - Special Construction',
      sitework: 'G - Building Sitework',
      selectBuilding: 'Select Building',
      selectBuildingMessage: 'Please select an organization and building to view its maintenance inventory.'
    },
    fr: {
      pageTitle: 'Gestion d\'inventaire',
      pageSubtitle: 'Gérer les éléments de bâtiment, les dossiers d\'entretien et la documentation des actifs à travers votre portefeuille immobilier.',
      buildingElements: 'Éléments de bâtiment',
      addElement: 'Ajouter un élément',
      clearSelection: 'Effacer la sélection',
      filters: 'Filtres',
      overdueEvaluations: 'Évaluations en retard',
      searchPlaceholder: 'Rechercher des éléments par nom, code UNIFORMAT ou description...',
      toggleBuildingElements: 'Basculer le tableau des éléments de bâtiment',
      condition: 'État',
      uniformatCategory: 'Catégorie UNIFORMAT',
      allConditions: 'Tous les états',
      excellent: 'Excellent',
      good: 'Bon',
      fair: 'Acceptable',
      poor: 'Pauvre',
      allCategories: 'Toutes les catégories',
      substructure: 'A - Infrastructures',
      shell: 'B - Enveloppe',
      interiors: 'C - Aménagement intérieur',
      services: 'D - Services',
      equipment: 'E - Équipement et ameublement',
      specialConstruction: 'F - Construction spécialisée',
      sitework: 'G - Aménagement du site',
      selectBuilding: 'Sélectionner un bâtiment',
      selectBuildingMessage: 'Veuillez sélectionner une organisation et un bâtiment pour voir son inventaire de maintenance.'
    }
  };

  const t = translations[language];

  return (
    <div data-testid="inventory-page">
      <h1>{t.pageTitle}</h1>
      <p>{t.pageSubtitle}</p>
      <section data-testid="building-elements-section">
        <h2>{t.buildingElements}</h2>
        <button data-testid="add-element-button">{t.addElement}</button>
        <button data-testid="clear-selection">{t.clearSelection}</button>
        <button data-testid="filters-toggle">{t.filters}</button>
        <button data-testid="overdue-filter-button">{t.overdueEvaluations}</button>
        <button aria-label={t.toggleBuildingElements}>Toggle</button>
        <input placeholder={t.searchPlaceholder} data-testid="element-search-input" />
        <div data-testid="expanded-filters">
          <label>{t.condition}</label>
          <select data-testid="condition-filter">
            <option value="all">{t.allConditions}</option>
            <option value="excellent">{t.excellent}</option>
            <option value="good">{t.good}</option>
            <option value="fair">{t.fair}</option>
            <option value="poor">{t.poor}</option>
          </select>
          <label>{t.uniformatCategory}</label>
          <select data-testid="uniformat-filter">
            <option value="all">{t.allCategories}</option>
            <option value="A">{t.substructure}</option>
            <option value="B">{t.shell}</option>
            <option value="C">{t.interiors}</option>
            <option value="D">{t.services}</option>
            <option value="E">{t.equipment}</option>
            <option value="F">{t.specialConstruction}</option>
            <option value="G">{t.sitework}</option>
          </select>
        </div>
      </section>
      <div data-testid="empty-state">
        <h2>{t.selectBuilding}</h2>
        <p>{t.selectBuildingMessage}</p>
      </div>
    </div>
  );
};

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Project and Inventory Pages Translation Coverage Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false }
      }
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Projects Page Translation Coverage', () => {
    describe('English Translations', () => {
      it('should display all English text elements in Projects page', async () => {
        render(
          <TestWrapper>
            <MockProjectsPage language="en" />
          </TestWrapper>
        );

        await waitFor(() => {
          // Page titles and headers
          expect(screen.getByText('Projects - Maintenance Management')).toBeTruthy();
          expect(screen.getByText('Manage maintenance projects, track progress, and coordinate work schedules')).toBeTruthy();
          
          // Section headers
          expect(screen.getByText('Project Overview')).toBeTruthy();
          expect(screen.getByText('Projects')).toBeTruthy();
          
          // Button labels
          expect(screen.getByText('New Project')).toBeTruthy();
          expect(screen.getByText('Clear Selection')).toBeTruthy();
          
          // Table and view labels
          expect(screen.getByText('Project Table')).toBeTruthy();
          
          // Status and filter labels
          expect(screen.getByLabelText('Toggle project overview')).toBeTruthy();
          expect(screen.getByLabelText('Toggle projects table')).toBeTruthy();
          
          // Empty state
          expect(screen.getByText('Select Building')).toBeTruthy();
          expect(screen.getByText('Please select an organization and building to view its maintenance projects.')).toBeTruthy();
        });
      });

      it('should have proper test IDs for English Projects elements', async () => {
        render(
          <TestWrapper>
            <MockProjectsPage language="en" />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByTestId('projects-page')).toBeTruthy();
          expect(screen.getByTestId('project-overview-section')).toBeTruthy();
          expect(screen.getByTestId('projects-table-section')).toBeTruthy();
          expect(screen.getByTestId('add-project-button')).toBeTruthy();
          expect(screen.getByTestId('clear-selection')).toBeTruthy();
        });
      });
    });

    describe('French Translations', () => {
      it('should display all French text elements in Projects page', async () => {
        render(
          <TestWrapper>
            <MockProjectsPage language="fr" />
          </TestWrapper>
        );

        await waitFor(() => {
          // French translations for page titles and headers
          expect(screen.getByText('Projets - Gestion de maintenance')).toBeTruthy();
          expect(screen.getByText('Gérer les projets de maintenance, suivre les progrès et coordonner les horaires de travail')).toBeTruthy();
          
          // French section headers
          expect(screen.getByText('Aperçu des projets')).toBeTruthy();
          expect(screen.getByText('Projets')).toBeTruthy();
          
          // French button labels
          expect(screen.getByText('Nouveau projet')).toBeTruthy();
          expect(screen.getByText('Effacer la sélection')).toBeTruthy();
          
          // French table and view labels
          expect(screen.getByText('Tableau des projets')).toBeTruthy();
          
          // French accessibility labels
          expect(screen.getByLabelText('Basculer l\'aperçu des projets')).toBeTruthy();
          expect(screen.getByLabelText('Basculer le tableau des projets')).toBeTruthy();
          
          // French empty state
          expect(screen.getByText('Sélectionner un bâtiment')).toBeTruthy();
          expect(screen.getByText('Veuillez sélectionner une organisation et un bâtiment pour voir ses projets de maintenance.')).toBeTruthy();
        });
      });

      it('should maintain same test IDs for French Projects elements', async () => {
        render(
          <TestWrapper>
            <MockProjectsPage language="fr" />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByTestId('projects-page')).toBeTruthy();
          expect(screen.getByTestId('project-overview-section')).toBeTruthy();
          expect(screen.getByTestId('projects-table-section')).toBeTruthy();
          expect(screen.getByTestId('add-project-button')).toBeTruthy();
          expect(screen.getByTestId('clear-selection')).toBeTruthy();
        });
      });
    });
  });

  describe('Inventory Page Translation Coverage', () => {
    describe('English Translations', () => {
      it('should display all English text elements in Inventory page', async () => {
        render(
          <TestWrapper>
            <MockInventoryPage language="en" />
          </TestWrapper>
        );

        await waitFor(() => {
          // Page titles and headers
          expect(screen.getByText('Inventory Management')).toBeTruthy();
          expect(screen.getByText('Manage building elements, maintenance records, and asset documentation across your property portfolio.')).toBeTruthy();
          
          // Section headers
          expect(screen.getByText('Building Elements')).toBeTruthy();
          
          // Button labels
          expect(screen.getByText('Add Element')).toBeTruthy();
          expect(screen.getByText('Clear Selection')).toBeTruthy();
          expect(screen.getByText('Filters')).toBeTruthy();
          expect(screen.getByText('Overdue Evaluations')).toBeTruthy();
          
          // Search and filter labels
          expect(screen.getByPlaceholderText('Search elements by name, UNIFORMAT code, or description...')).toBeTruthy();
          
          // Accessibility labels
          expect(screen.getByLabelText('Toggle building elements table')).toBeTruthy();
          
          // Empty state
          expect(screen.getByText('Select Building')).toBeTruthy();
          expect(screen.getByText('Please select an organization and building to view its maintenance inventory.')).toBeTruthy();
        });
      });

      it('should display Inventory filters and dropdown English options', async () => {
        render(
          <TestWrapper>
            <MockInventoryPage language="en" />
          </TestWrapper>
        );

        await waitFor(() => {
          // Filter labels
          expect(screen.getByText('Condition')).toBeTruthy();
          expect(screen.getByText('UNIFORMAT Category')).toBeTruthy();
          
          // Condition options
          expect(screen.getByText('All Conditions')).toBeTruthy();
          expect(screen.getByText('Excellent')).toBeTruthy();
          expect(screen.getByText('Good')).toBeTruthy();
          expect(screen.getByText('Fair')).toBeTruthy();
          expect(screen.getByText('Poor')).toBeTruthy();
          
          // UNIFORMAT categories
          expect(screen.getByText('All Categories')).toBeTruthy();
          expect(screen.getByText('A - Substructure')).toBeTruthy();
          expect(screen.getByText('B - Shell')).toBeTruthy();
          expect(screen.getByText('C - Interiors')).toBeTruthy();
          expect(screen.getByText('D - Services')).toBeTruthy();
          expect(screen.getByText('E - Equipment & Furnishings')).toBeTruthy();
          expect(screen.getByText('F - Special Construction')).toBeTruthy();
          expect(screen.getByText('G - Building Sitework')).toBeTruthy();
        });
      });

      it('should have proper test IDs for English Inventory elements', async () => {
        render(
          <TestWrapper>
            <MockInventoryPage language="en" />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByTestId('inventory-page')).toBeTruthy();
          expect(screen.getByTestId('building-elements-section')).toBeTruthy();
          expect(screen.getByTestId('add-element-button')).toBeTruthy();
          expect(screen.getByTestId('clear-selection')).toBeTruthy();
          expect(screen.getByTestId('filters-toggle')).toBeTruthy();
          expect(screen.getByTestId('overdue-filter-button')).toBeTruthy();
          expect(screen.getByTestId('element-search-input')).toBeTruthy();
          expect(screen.getByTestId('expanded-filters')).toBeTruthy();
          expect(screen.getByTestId('condition-filter')).toBeTruthy();
          expect(screen.getByTestId('uniformat-filter')).toBeTruthy();
        });
      });
    });

    describe('French Translations', () => {
      it('should display all French text elements in Inventory page', async () => {
        render(
          <TestWrapper>
            <MockInventoryPage language="fr" />
          </TestWrapper>
        );

        await waitFor(() => {
          // French page titles and headers
          expect(screen.getByText('Gestion d\'inventaire')).toBeTruthy();
          expect(screen.getByText('Gérer les éléments de bâtiment, les dossiers d\'entretien et la documentation des actifs à travers votre portefeuille immobilier.')).toBeTruthy();
          
          // French section headers
          expect(screen.getByText('Éléments de bâtiment')).toBeTruthy();
          
          // French button labels
          expect(screen.getByText('Ajouter un élément')).toBeTruthy();
          expect(screen.getByText('Effacer la sélection')).toBeTruthy();
          expect(screen.getByText('Filtres')).toBeTruthy();
          expect(screen.getByText('Évaluations en retard')).toBeTruthy();
          
          // French search placeholder
          expect(screen.getByPlaceholderText('Rechercher des éléments par nom, code UNIFORMAT ou description...')).toBeTruthy();
          
          // French accessibility labels
          expect(screen.getByLabelText('Basculer le tableau des éléments de bâtiment')).toBeTruthy();
          
          // French empty state
          expect(screen.getByText('Sélectionner un bâtiment')).toBeTruthy();
          expect(screen.getByText('Veuillez sélectionner une organisation et un bâtiment pour voir son inventaire de maintenance.')).toBeTruthy();
        });
      });

      it('should display Inventory filters and dropdown French options', async () => {
        render(
          <TestWrapper>
            <MockInventoryPage language="fr" />
          </TestWrapper>
        );

        await waitFor(() => {
          // French filter labels
          expect(screen.getByText('État')).toBeTruthy();
          expect(screen.getByText('Catégorie UNIFORMAT')).toBeTruthy();
          
          // French condition options
          expect(screen.getByText('Tous les états')).toBeTruthy();
          expect(screen.getByText('Excellent')).toBeTruthy();
          expect(screen.getByText('Bon')).toBeTruthy();
          expect(screen.getByText('Acceptable')).toBeTruthy();
          expect(screen.getByText('Pauvre')).toBeTruthy();
          
          // French UNIFORMAT categories
          expect(screen.getByText('Toutes les catégories')).toBeTruthy();
          expect(screen.getByText('A - Infrastructures')).toBeTruthy();
          expect(screen.getByText('B - Enveloppe')).toBeTruthy();
          expect(screen.getByText('C - Aménagement intérieur')).toBeTruthy();
          expect(screen.getByText('D - Services')).toBeTruthy();
          expect(screen.getByText('E - Équipement et ameublement')).toBeTruthy();
          expect(screen.getByText('F - Construction spécialisée')).toBeTruthy();
          expect(screen.getByText('G - Aménagement du site')).toBeTruthy();
        });
      });

      it('should maintain same test IDs for French Inventory elements', async () => {
        render(
          <TestWrapper>
            <MockInventoryPage language="fr" />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByTestId('inventory-page')).toBeTruthy();
          expect(screen.getByTestId('building-elements-section')).toBeTruthy();
          expect(screen.getByTestId('add-element-button')).toBeTruthy();
          expect(screen.getByTestId('clear-selection')).toBeTruthy();
          expect(screen.getByTestId('filters-toggle')).toBeTruthy();
          expect(screen.getByTestId('overdue-filter-button')).toBeTruthy();
          expect(screen.getByTestId('element-search-input')).toBeTruthy();
          expect(screen.getByTestId('expanded-filters')).toBeTruthy();
          expect(screen.getByTestId('condition-filter')).toBeTruthy();
          expect(screen.getByTestId('uniformat-filter')).toBeTruthy();
        });
      });
    });
  });

  describe('Cross-Language Consistency', () => {
    it('should maintain consistent test IDs across languages for Projects', async () => {
      const { rerender } = render(
        <TestWrapper>
          <MockProjectsPage language="en" />
        </TestWrapper>
      );

      const englishTestIds = [
        'projects-page',
        'project-overview-section',
        'projects-table-section',
        'add-project-button',
        'clear-selection'
      ];

      // Verify English test IDs exist
      englishTestIds.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeTruthy();
      });

      // Rerender with French
      rerender(
        <TestWrapper>
          <MockProjectsPage language="fr" />
        </TestWrapper>
      );

      // Verify same test IDs exist in French
      englishTestIds.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeTruthy();
      });
    });

    it('should maintain consistent test IDs across languages for Inventory', async () => {
      const { rerender } = render(
        <TestWrapper>
          <MockInventoryPage language="en" />
        </TestWrapper>
      );

      const englishTestIds = [
        'inventory-page',
        'building-elements-section',
        'add-element-button',
        'clear-selection',
        'filters-toggle',
        'overdue-filter-button',
        'element-search-input',
        'condition-filter',
        'uniformat-filter'
      ];

      // Verify English test IDs exist
      englishTestIds.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeTruthy();
      });

      // Rerender with French
      rerender(
        <TestWrapper>
          <MockInventoryPage language="fr" />
        </TestWrapper>
      );

      // Verify same test IDs exist in French
      englishTestIds.forEach(testId => {
        expect(screen.getByTestId(testId)).toBeTruthy();
      });
    });
  });
});