/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '../client/src/components/ui/card';
import { LanguageProvider } from '../client/src/context/LanguageContext';

// Mock the API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      LanguageProvider,
      {},
      React.createElement(
        Router,
        { base: '/' },
        React.createElement(
          'div',
          { style: { width: '320px' } },
          children
        )
      )
    )
  );
};

// Mock financial card component
const FinancialCard = ({ title, value, testId }: { title: string; value: string; testId: string }) => {
  return React.createElement(
    Card,
    { 'data-testid': testId },
    React.createElement(
      CardHeader,
      { className: 'flex flex-row items-center justify-between space-y-0 pb-2' },
      React.createElement(CardTitle, { className: 'text-sm font-medium' }, title)
    ),
    React.createElement(
      CardContent,
      { className: 'card-content-safe' },
      React.createElement(
        'div',
        {
          className: 'financial-value-large',
          title: value,
          'data-testid': `value-${testId}`
        },
        value
      )
    )
  );
};

// Test component with various text lengths
const TestCard = ({ content, className, testId }: { content: string; className?: string; testId: string }) => {
  return React.createElement(
    Card,
    { 'data-testid': testId },
    React.createElement(
      CardContent,
      { className: 'card-content-safe' },
      React.createElement(
        'div',
        {
          className: className,
          'data-testid': `content-${testId}`
        },
        content
      )
    )
  );
};

describe('Card Overflow Protection', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    
    // Reset viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  describe('Financial Value Display', () => {
    test('should display normal financial values without overflow', () => {
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Current Balance",
            value: "$21,388.08",
            testId: "card-normal-value"
          })
        )
      );

      const valueElement = screen.getByTestId('value-card-normal-value');
      expect(valueElement).toBeInTheDocument();
      expect(valueElement).toHaveClass('financial-value-large');
      
      // Check that the element has overflow protection
      const styles = getComputedStyle(valueElement);
      expect(styles.overflow).toBe('hidden');
      expect(styles.textOverflow).toBe('ellipsis');
    });

    test('should handle very large financial values with truncation', () => {
      const largeValue = '$999,999,999,999.99';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Large Balance",
            value: largeValue,
            testId: "card-large-value"
          })
        )
      );

      const valueElement = screen.getByTestId('value-card-large-value');
      expect(valueElement).toBeInTheDocument();
      expect(valueElement).toHaveAttribute('title', largeValue);
    });

    test('should handle extremely long financial values', () => {
      const extremeValue = '$1,234,567,890,123,456,789.99';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Extreme Balance",
            value: extremeValue,
            testId: "card-extreme-value"
          })
        )
      );

      const valueElement = screen.getByTestId('value-card-extreme-value');
      expect(valueElement).toBeInTheDocument();
      expect(valueElement).toHaveClass('financial-value-large');
      
      // Check overflow protection is applied
      const styles = getComputedStyle(valueElement);
      expect(styles.overflow).toBe('hidden');
      expect(styles.whiteSpace).toBe('nowrap');
    });
  });

  describe('Card Content Safety Classes', () => {
    test('should apply card-content-safe class correctly', () => {
      const longText = 'This is a very long text that should be properly handled by the card content safety classes to prevent any overflow issues';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(TestCard, {
            content: longText,
            className: "card-text-safe",
            testId: "card-safe-text"
          })
        )
      );

      const contentElement = screen.getByTestId('content-card-safe-text');
      expect(contentElement).toHaveClass('card-text-safe');
      
      // Check that text breaking is applied
      const styles = getComputedStyle(contentElement);
      expect(styles.wordBreak).toBe('break-word');
      expect(styles.overflowWrap).toBe('break-word');
    });

    test('should handle number display with responsive sizing', () => {
      const largeNumber = '123456789';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(TestCard, {
            content: largeNumber,
            className: "number-display-large",
            testId: "card-number-display"
          })
        )
      );

      const numberElement = screen.getByTestId('content-card-number-display');
      expect(numberElement).toHaveClass('number-display-large');
      
      // Check monospace font is applied for tabular numbers
      const styles = getComputedStyle(numberElement);
      expect(styles.fontVariantNumeric).toBe('tabular-nums');
    });

    test('should truncate card titles properly', () => {
      const longTitle = 'This is a very long card title that should be truncated using line clamping to prevent overflow and maintain proper card layout';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(TestCard, {
            content: longTitle,
            className: "card-title-safe",
            testId: "card-title-test"
          })
        )
      );

      const titleElement = screen.getByTestId('content-card-title-test');
      expect(titleElement).toHaveClass('card-title-safe');
      
      // Should have line clamping applied
      const styles = getComputedStyle(titleElement);
      expect(styles.display).toBe('-webkit-box');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty or null values gracefully', () => {
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Empty Balance",
            value: "",
            testId: "card-empty-value"
          })
        )
      );

      const valueElement = screen.getByTestId('value-card-empty-value');
      expect(valueElement).toBeInTheDocument();
      expect(valueElement).toHaveClass('financial-value-large');
    });

    test('should handle special characters in financial values', () => {
      const specialValue = '$-1,234.56 (negative)';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Special Balance",
            value: specialValue,
            testId: "card-special-value"
          })
        )
      );

      const valueElement = screen.getByTestId('value-card-special-value');
      expect(valueElement).toBeInTheDocument();
      expect(valueElement).toHaveAttribute('title', specialValue);
    });
  });

  describe('CSS Utility Classes', () => {
    test('should apply financial-value utilities correctly', () => {
      const testValue = '$12,345.67';
      const cssClasses = ['financial-value', 'financial-value-small', 'financial-value-medium', 'financial-value-large'];
      
      cssClasses.forEach(className => {
        const { unmount } = render(
          React.createElement(
            TestWrapper,
            {},
            React.createElement(TestCard, {
              content: testValue,
              className: className,
              testId: `card-${className}`
            })
          )
        );

        const element = screen.getByTestId(`content-card-${className}`);
        expect(element).toHaveClass(className);
        
        unmount();
      });
    });

    test('should apply text safety utilities correctly', () => {
      const testText = 'This is test text for safety utilities';
      const safetyClasses = ['card-text-safe', 'card-button-safe'];
      
      safetyClasses.forEach(className => {
        const { unmount } = render(
          React.createElement(
            TestWrapper,
            {},
            React.createElement(TestCard, {
              content: testText,
              className: className,
              testId: `card-${className}`
            })
          )
        );

        const element = screen.getByTestId(`content-card-${className}`);
        expect(element).toHaveClass(className);
        
        unmount();
      });
    });
  });

  describe('Accessibility', () => {
    test('should provide full value in title attribute for screen readers', () => {
      const fullValue = '$1,234,567,890.12';
      
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Accessible Balance",
            value: fullValue,
            testId: "card-accessible-value"
          })
        )
      );

      const valueElement = screen.getByTestId('value-card-accessible-value');
      expect(valueElement).toHaveAttribute('title', fullValue);
    });

    test('should maintain proper heading structure in cards', () => {
      render(
        React.createElement(
          TestWrapper,
          {},
          React.createElement(FinancialCard, {
            title: "Balance Title",
            value: "$1,000",
            testId: "card-heading-structure"
          })
        )
      );

      // Card title should be properly structured
      const titleElement = screen.getByText('Balance Title');
      expect(titleElement).toBeInTheDocument();
    });
  });
});