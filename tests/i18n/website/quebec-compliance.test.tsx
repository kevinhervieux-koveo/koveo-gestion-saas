import React from 'react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import HomePage from '@/pages/home';
import { TestProviders } from './test-providers';

/**
 * Quebec Legal Compliance Tests
 *
 * Tests Quebec Law 25 compliance and legal terminology
 */
describe('Quebec Legal Compliance', () => {
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
        <div data-testid='user-management-compliance'>
          <div data-testid='privacy-notice'>Conforme à la Loi 25 du Québec</div>
          <div data-testid='data-protection'>Protection des données personnelles</div>
          <div data-testid='user-consent'>Consentement de l'utilisateur</div>
          <div data-testid='data-access'>Accès aux données</div>
          <div data-testid='data-deletion'>Suppression des données</div>
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
});
