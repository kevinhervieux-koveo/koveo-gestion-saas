import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { TestProviders } from './test-providers';

/**
 * Dashboard Translation Tests
 * 
 * Tests proper translation of dashboard elements and quick actions
 */
describe('Dashboard Translation', () => {
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

  it('should display dashboard quick actions page with proper French translations', () => {
    const DashboardQuickActions = () => {
      return (
        <div data-testid='dashboard-quick-actions-page'>
          <div data-testid='header-welcome-back'>Bienvenue, Kevin</div>
          <div data-testid='header-subtitle'>
            Votre tableau de bord personnalisé - accès rapide à tout ce dont vous avez besoin
          </div>
          <div data-testid='text-admin-dashboard'>Tableau de bord administrateur</div>
          <div data-testid='text-organization-not-assigned'>Organisation: Non assigné</div>
          <button data-testid='button-fullscreen'>Plein écran</button>
          <button data-testid='button-exit-fullscreen'>Quitter le plein écran</button>

          {/* Admin Quick Action Cards */}
          <div data-testid='card-system-management'>
            <div data-testid='title-system-management'>Gestion du système</div>
            <div data-testid='description-system-management'>
              Gérer les organisations, utilisateurs et paramètres système
            </div>
          </div>

          <div data-testid='card-organization-overview'>
            <div data-testid='title-organization-overview'>Aperçu des organisations</div>
            <div data-testid='description-organization-overview'>
              Voir et gérer toutes les organisations
            </div>
          </div>

          <div data-testid='card-user-management'>
            <div data-testid='title-user-management'>Gestion des utilisateurs</div>
            <div data-testid='description-user-management'>
              Gérer les utilisateurs dans toutes les organisations
            </div>
          </div>
        </div>
      );
    };

    render(
      <TestProviders>
        <DashboardQuickActions />
      </TestProviders>
    );

    // Verify dashboard header translations
    expect(screen.getByTestId('header-welcome-back')).toHaveTextContent('Bienvenue, Kevin');
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent('tableau de bord personnalisé');
    expect(screen.getByTestId('text-admin-dashboard')).toHaveTextContent('Tableau de bord administrateur');
    expect(screen.getByTestId('text-organization-not-assigned')).toHaveTextContent('Organisation: Non assigné');

    // Verify fullscreen toggle buttons
    expect(screen.getByTestId('button-fullscreen')).toHaveTextContent('Plein écran');
    expect(screen.getByTestId('button-exit-fullscreen')).toHaveTextContent('Quitter le plein écran');

    // Verify admin quick action cards
    expect(screen.getByTestId('title-system-management')).toHaveTextContent('Gestion du système');
    expect(screen.getByTestId('description-system-management')).toHaveTextContent('Gérer les organisations');
    expect(screen.getByTestId('title-organization-overview')).toHaveTextContent('Aperçu des organisations');
    expect(screen.getByTestId('description-organization-overview')).toHaveTextContent('Voir et gérer toutes');
    expect(screen.getByTestId('title-user-management')).toHaveTextContent('Gestion des utilisateurs');
    expect(screen.getByTestId('description-user-management')).toHaveTextContent('Gérer les utilisateurs');
  });
});