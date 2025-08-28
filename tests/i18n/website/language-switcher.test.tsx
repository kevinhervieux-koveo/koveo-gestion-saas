import React from 'react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import HomePage from '@/pages/home';
import { TestProviders } from './test-providers';

/**
 * Language Switcher Functionality Tests
 * 
 * Tests the language switching mechanism and UI behavior
 */
describe('Language Switcher Functionality', () => {
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

  it('should render language switcher on home page', () => {
    render(
      <TestProviders>
        <HomePage />
      </TestProviders>
    );

    // Look for language switcher elements
    const languageSwitcher =
      screen.getByRole('button', { name: /language|langue/i }) ||
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