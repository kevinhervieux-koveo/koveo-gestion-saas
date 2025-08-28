import React from 'react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import HomePage from '@/pages/home';
import { TestProviders } from './test-providers';

/**
 * Page Content Translation Tests
 * 
 * Tests proper translation of page-specific content
 */
describe('Page Content Translation', () => {
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
      'property manager',
      'tenant',
      'lease agreement',
      'common areas',
      'board of directors',
      'condo fees',
      'user management',
      'edit user',
      'email address',
      'first name',
      'last name',
      'role',
      'status',
    ];

    inappropriateTerms.forEach((term) => {
      expect(pageText.toLowerCase()).not.toContain(term.toLowerCase());
    });
  });
});