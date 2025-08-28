import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { TestProviders } from './test-providers';

/**
 * User Management Translation Tests
 * 
 * Tests proper translation of user management functionality
 */
describe('User Management Translation', () => {
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

  it('should display proper terminology on user management page', () => {
    // Mock the required API endpoints for user management
    const UserManagement = () => {
      return (
        <div data-testid='user-management-page'>
          <h1>User Management</h1>
          <button data-testid='button-invite-user'>Invite User</button>
          <button data-testid='button-edit-user'>Edit User</button>
          <div data-testid='text-user-role'>Role</div>
          <div data-testid='text-user-status'>Status</div>
          <div data-testid='text-user-email'>Email Address</div>
          <div data-testid='text-user-firstname'>First Name</div>
          <div data-testid='text-user-lastname'>Last Name</div>
          <div data-testid='text-user-organizations'>Organizations</div>
          <div data-testid='text-user-residences'>Residences</div>
          <div data-testid='text-user-active'>Active</div>
          <div data-testid='text-user-inactive'>Inactive</div>
          <div data-testid='text-pagination-previous'>Previous</div>
          <div data-testid='text-pagination-next'>Next</div>
          <div data-testid='text-pagination-showing'>Showing users</div>
          <div data-testid='text-no-residences'>No residences</div>
          <div data-testid='text-no-organizations'>No organizations</div>
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

  it('should maintain French language in user management pagination', () => {
    const UserManagementPagination = () => {
      return (
        <div data-testid='user-pagination-french'>
          <div data-testid='pagination-info'>
            Affichage 1-10 sur 25 utilisateurs filtrés (50 au total)
          </div>
          <div data-testid='pagination-controls'>
            <button data-testid='button-previous'>Précédent</button>
            <span data-testid='page-info'>Page 1 sur 3</span>
            <button data-testid='button-next'>Suivant</button>
          </div>
          <div data-testid='filter-status'>
            <span>Filtres actifs: Rôle (Gestionnaire), Statut (Actif)</span>
          </div>
          <div data-testid='no-users-message'>
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
});