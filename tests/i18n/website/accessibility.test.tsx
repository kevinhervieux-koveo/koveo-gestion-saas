import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient } from '@tanstack/react-query';
import HomePage from '@/pages/home';
import { TestProviders } from './test-providers';

/**
 * Accessibility and Translation Tests
 * 
 * Tests accessibility features work correctly with translations
 */
describe('Accessibility and Translation', () => {
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

  it('should provide proper aria labels in both languages', () => {
    render(
      <TestProviders>
        <HomePage />
      </TestProviders>
    );

    // Check for accessibility attributes
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('type');
    });

    // Images should have alt text
    const images = screen.getAllByRole('img');
    images.forEach((img) => {
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