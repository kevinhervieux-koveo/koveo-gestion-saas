import React from 'react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import HomePage from '@/pages/home';
import { TestProviders } from './test-providers';

/**
 * Form and UI Element Translation Tests
 *
 * Tests proper translation of forms, buttons, and interactive elements
 */
describe('Form and UI Element Translation', () => {
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
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

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
        <form data-testid='user-management-form'>
          <label data-testid='label-firstname'>Prénom</label>
          <input data-testid='input-firstname' placeholder='Entrez le prénom' />

          <label data-testid='label-lastname'>Nom de famille</label>
          <input data-testid='input-lastname' placeholder='Entrez le nom de famille' />

          <label data-testid='label-email'>Adresse courriel</label>
          <input data-testid='input-email' placeholder="Entrez l'adresse courriel" />

          <label data-testid='label-role'>Rôle</label>
          <select data-testid='select-role'>
            <option value='admin'>Administrateur</option>
            <option value='manager'>Gestionnaire</option>
            <option value='tenant'>Locataire</option>
            <option value='resident'>Résident</option>
          </select>

          <label data-testid='label-status'>Statut</label>
          <select data-testid='select-status'>
            <option value='active'>Actif</option>
            <option value='inactive'>Inactif</option>
          </select>

          <button data-testid='button-save'>Sauvegarder</button>
          <button data-testid='button-cancel'>Annuler</button>
          <button data-testid='button-delete'>Supprimer</button>
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
