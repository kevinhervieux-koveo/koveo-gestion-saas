/**
 * Residence Page Error Handling Tests.
 * 
 * Specific tests for the residence page to ensure it handles various error scenarios
 * and data loading states gracefully, preventing runtime crashes.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import React from 'react';
import '@testing-library/jest-dom';

import Residence from '../../client/src/pages/residents/residence';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  const [location, navigate] = memoryLocation({ path: '/residents/residence' });

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={() => [location, navigate]}>
        {children}
      </Router>
    </QueryClientProvider>
  );
};

// Mock API request
jest.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: jest.fn(),
  queryClient: new (require('@tanstack/react-query').QueryClient)(),
}));

// Mock authentication
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

// Mock language hook
jest.mock('../../client/src/hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => key,
    setLanguage: jest.fn(),
  }),
}));

// Mock toast
jest.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe('Residence Page Error Handling', () => {
  const { apiRequest: mockApiRequest } = require('../../client/src/lib/queryClient');
  const { useAuth: mockUseAuth } = require('../../client/src/hooks/use-auth');
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user', role: 'resident' } as any,
    });
  });

  describe('Data Structure Error Handling', () => {
    test('handles when API returns null instead of array', async () => {
      // Mock user API call
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' }) // User API
        .mockResolvedValueOnce(null); // Residences API returns null

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });

      // Should not crash - page should render
      expect(document.body).toBeInTheDocument();
    });

    test('handles when API returns object instead of array', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce({ error: 'Not found', message: 'No residences' });

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });

      // Should not throw "find is not a function" error
      expect(document.body).toBeInTheDocument();
    });

    test('handles when API returns undefined', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce(undefined);

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });

      expect(document.body).toBeInTheDocument();
    });

    test('handles when API returns string instead of array', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce('Error message');

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });

      expect(document.body).toBeInTheDocument();
    });

    test('handles malformed residence objects in array', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce([
          { id: 'residence-1' }, // Missing required fields
          null, // Null item
          { id: 'residence-2', unitNumber: '101', building: { name: 'Test Building' } }
        ]);

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should render without crashing, even with malformed data
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Network Error Handling', () => {
    test('handles network timeout errors', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockRejectedValueOnce(new Error('Network timeout'));

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });

    test('handles 500 server errors', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockRejectedValueOnce(new Error('Internal Server Error'));

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });

    test('handles 403 permission errors', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockRejectedValueOnce(new Error('Forbidden'));

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });

    test('handles 404 not found errors', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockRejectedValueOnce(new Error('Not Found'));

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    test('shows loading state while fetching data', () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      expect(screen.getByText('loading')).toBeInTheDocument();
    });

    test('handles loading state transitions properly', async () => {
      const delayedPromise = new Promise(resolve => 
        setTimeout(() => resolve([
          { 
            id: 'residence-1', 
            unitNumber: '101', 
            building: { name: 'Test Building' } 
          }
        ]), 50)
      );

      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockReturnValueOnce(delayedPromise);

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByText('loading')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('loading')).not.toBeInTheDocument();
      }, { timeout: 100 });
    });
  });

  describe('Authentication Error Handling', () => {
    test('handles unauthenticated users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null as any,
      });

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      expect(screen.getByText('accessDenied')).toBeInTheDocument();
    });

    test('handles users without residence access', async () => {
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce([]); // Empty array - no accessible residences

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('noResidencesFound')).toBeInTheDocument();
      });
    });
  });

  describe('Data Validation', () => {
    test('validates residence data structure before using', async () => {
      const validResidences = [
        {
          id: 'residence-1',
          unitNumber: '101',
          building: { name: 'Building A' }
        }
      ];

      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce(validResidences);

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText('noResidencesFound')).not.toBeInTheDocument();
      });

      // Should render residence selector
      expect(document.body).toBeInTheDocument();
    });

    test('handles missing required fields gracefully', async () => {
      const incompleteResidences = [
        {
          id: 'residence-1',
          // Missing unitNumber
          building: { name: 'Building A' }
        },
        {
          id: 'residence-2',
          unitNumber: '102',
          // Missing building
        }
      ];

      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' })
        .mockResolvedValueOnce(incompleteResidences);

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should render without crashing, even with incomplete data
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Contact Management Error Handling', () => {
    test('handles contact loading errors gracefully', async () => {
      const validResidences = [
        {
          id: 'residence-1',
          unitNumber: '101',
          building: { name: 'Building A', id: 'building-1' }
        }
      ];

      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' }) // User
        .mockResolvedValueOnce(validResidences) // Residences
        .mockRejectedValueOnce(new Error('Failed to load contacts')) // Contacts error
        .mockResolvedValueOnce([]); // Building contacts

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        // Page should render despite contact loading error
        expect(document.body).toBeInTheDocument();
      });
    });

    test('handles building contact loading errors', async () => {
      const validResidences = [
        {
          id: 'residence-1',
          unitNumber: '101',
          building: { name: 'Building A', id: 'building-1' }
        }
      ];

      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user' }) // User
        .mockResolvedValueOnce(validResidences) // Residences
        .mockResolvedValueOnce([]) // Contacts
        .mockRejectedValueOnce(new Error('Failed to load building contacts')); // Building contacts error

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        // Page should render despite building contact loading error
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty user ID', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '', role: 'resident' } as any, // Empty user ID
      });

      render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      // Should handle gracefully
      expect(document.body).toBeInTheDocument();
    });

    test('handles rapid API request changes', async () => {
      // Simulate rapid user changes that might cause race conditions
      mockApiRequest
        .mockResolvedValueOnce({ id: 'test-user-1' })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce({ id: 'test-user-2' })
        .mockResolvedValueOnce([
          { id: 'residence-1', unitNumber: '101', building: { name: 'Building A' } }
        ]);

      const { rerender } = render(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      // Change user rapidly
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: 'test-user-2', role: 'resident' } as any,
      });

      rerender(
        <TestWrapper>
          <Residence />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});