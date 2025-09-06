/**
 * @file Demand Submission Form Frontend Tests
 * @description Tests for the demand submission form component and validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock the hooks and utils
jest.mock('@/hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/toastUtils', () => ({
  toastUtils: {
    createSuccess: jest.fn(),
    createError: jest.fn(),
  },
}));

// Mock fetch with proper typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper to create proper Response mock
const createMockResponse = (data: any, ok: boolean = true, status: number = 200): Response => ({
  ok,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers(),
  redirected: false,
  statusText: ok ? 'OK' : 'Error',
  type: 'basic' as ResponseType,
  url: '',
  clone: jest.fn() as any,
  body: null,
  bodyUsed: false,
  arrayBuffer: jest.fn() as any,
  blob: jest.fn() as any,
  formData: jest.fn() as any,
  text: jest.fn() as any,
} as Response);

// Mock queryClient
const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Mock component data
const mockBuildings = [
  { id: 'building-1', name: 'Test Building 1' },
  { id: 'building-2', name: 'Test Building 2' },
];

const mockUser = {
  id: 'user-1',
  role: 'resident',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};

// We'll create a simplified test component that includes the form logic
const TestDemandForm = () => {
  const [isOpen, setIsOpen] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          status: 'submitted',
          buildingId: data.buildingId || undefined,
          residenceId: data.residenceId || undefined,
          assignationBuildingId: data.assignationBuildingId || undefined,
          assignationResidenceId: data.assignationResidenceId || undefined,
        }),
      });

      if (!response || !response.ok) {
        throw new Error('Failed to create demand');
      }

      setIsOpen(false);
    } catch (error) {
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-testid="demand-form-container">
      {isOpen && (
        <form
          data-testid="demand-form"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            const data = {
              type: formData.get('type'),
              buildingId: formData.get('buildingId'),
              description: formData.get('description'),
            };
            handleSubmit(data);
          }}
        >
          <div>
            <label htmlFor="type">Type</label>
            <select data-testid="input-type" name="type" required>
              <option value="">Select Type</option>
              <option value="maintenance">Maintenance</option>
              <option value="complaint">Complaint</option>
              <option value="information">Information</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="buildingId">Building</label>
            <select data-testid="input-building" name="buildingId">
              <option value="">Select Building</option>
              {mockBuildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description">Description</label>
            <textarea
              data-testid="input-description"
              name="description"
              placeholder="Describe your request in detail"
              required
              minLength={10}
              maxLength={2000}
            />
          </div>

          <button
            type="submit"
            data-testid="button-submit-demand"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Demand'}
          </button>
        </form>
      )}
      {!isOpen && <div data-testid="success-message">Demand created successfully!</div>}
    </div>
  );
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createMockQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('Demand Submission Form Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Form Rendering', () => {
    it('should render all required form fields', () => {
      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      expect(screen.getByTestId('demand-form')).toBeInTheDocument();
      expect(screen.getByTestId('input-type')).toBeInTheDocument();
      expect(screen.getByTestId('input-building')).toBeInTheDocument();
      expect(screen.getByTestId('input-description')).toBeInTheDocument();
      expect(screen.getByTestId('button-submit-demand')).toBeInTheDocument();
    });

    it('should render all demand type options', () => {
      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      expect(typeSelect).toHaveTextContent('Maintenance');
      expect(typeSelect).toHaveTextContent('Complaint');
      expect(typeSelect).toHaveTextContent('Information');
      expect(typeSelect).toHaveTextContent('Other');
    });

    it('should render building options', () => {
      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const buildingSelect = screen.getByTestId('input-building');
      expect(buildingSelect).toHaveTextContent('Test Building 1');
      expect(buildingSelect).toHaveTextContent('Test Building 2');
    });
  });

  describe('Form Validation', () => {
    it('should require type selection', async () => {
      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const submitButton = screen.getByTestId('button-submit-demand');
      const description = screen.getByTestId('input-description');

      await userEvent.type(description, 'Test description that is long enough');
      await userEvent.click(submitButton);

      // Form should not submit without type
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should require description', async () => {
      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.click(submitButton);

      // Form should not submit without description
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate minimum description length', async () => {
      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.type(description, 'Short'); // Less than 10 characters
      await userEvent.click(submitButton);

      // Form should not submit with short description
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should accept valid form data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const buildingSelect = screen.getByTestId('input-building');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.selectOptions(buildingSelect, 'building-1');
      await userEvent.type(description, 'This is a valid description that is long enough');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'maintenance',
          buildingId: 'building-1',
          description: 'This is a valid description that is long enough',
          status: 'submitted',
          residenceId: undefined,
          assignationBuildingId: undefined,
          assignationResidenceId: undefined,
        }),
      });
    });
  });

  describe('Form Submission', () => {
    it('should handle successful submission', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'complaint');
      await userEvent.type(description, 'This is a valid complaint description');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
    });

    it('should handle submission with optional building field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'information');
      await userEvent.type(description, 'Information request without specific building');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'information',
          buildingId: undefined,
          description: 'Information request without specific building',
          status: 'submitted',
          residenceId: undefined,
          assignationBuildingId: undefined,
          assignationResidenceId: undefined,
        }),
      });
    });

    it('should show loading state during submission', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100)
          )
      );

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'other');
      await userEvent.type(description, 'Test description for loading state');
      await userEvent.click(submitButton);

      expect(submitButton).toHaveTextContent('Creating...');
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
    });

    it('should handle submission errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.type(description, 'Test description for error handling');
      await userEvent.click(submitButton);

      await waitFor(() => {
        // Form should still be visible after error
        expect(screen.getByTestId('demand-form')).toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should handle server validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid demand data' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.type(description, 'Test description for server error');
      await userEvent.click(submitButton);

      await waitFor(() => {
        // Form should still be visible after server error
        expect(screen.getByTestId('demand-form')).toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Special Characters and Internationalization', () => {
    it('should handle French characters in description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.type(description, 'Réparation nécessaire avec caractères spéciaux: éàùç!');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'maintenance',
          buildingId: undefined,
          description: 'Réparation nécessaire avec caractères spéciaux: éàùç!',
          status: 'submitted',
          residenceId: undefined,
          assignationBuildingId: undefined,
          assignationResidenceId: undefined,
        }),
      });
    });

    it('should handle emojis and special symbols in description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.type(description, 'Description with emoji 🏠 and symbols @#$%^&*()');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith('/api/demands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'maintenance',
          buildingId: undefined,
          description: 'Description with emoji 🏠 and symbols @#$%^&*()',
          status: 'submitted',
          residenceId: undefined,
          assignationBuildingId: undefined,
          assignationResidenceId: undefined,
        }),
      });
    });
  });

  describe('Form Field Behavior', () => {
    it('should properly handle empty string conversion to undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      render(
        <TestWrapper>
          <TestDemandForm />
        </TestWrapper>
      );

      const typeSelect = screen.getByTestId('input-type');
      const buildingSelect = screen.getByTestId('input-building');
      const description = screen.getByTestId('input-description');
      const submitButton = screen.getByTestId('button-submit-demand');

      await userEvent.selectOptions(typeSelect, 'maintenance');
      await userEvent.selectOptions(buildingSelect, ''); // Select empty option
      await userEvent.type(description, 'Test description with empty building selection');
      await userEvent.click(submitButton);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/demands',
        expect.objectContaining({
          body: expect.stringContaining('"buildingId":undefined'),
        })
      );
    });

    it('should allow all demand types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'demand-1', status: 'submitted' }),
      });

      const demandTypes = ['maintenance', 'complaint', 'information', 'other'];

      for (const type of demandTypes) {
        render(
          <TestWrapper>
            <TestDemandForm />
          </TestWrapper>
        );

        const typeSelect = screen.getByTestId('input-type');
        const description = screen.getByTestId('input-description');
        const submitButton = screen.getByTestId('button-submit-demand');

        await userEvent.selectOptions(typeSelect, type);
        await userEvent.type(description, `Test ${type} description with sufficient length`);
        await userEvent.click(submitButton);

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/demands',
          expect.objectContaining({
            body: expect.stringContaining(`"type":"${type}"`),
          })
        );

        // Clean up for next iteration
        mockFetch.mockClear();
      }
    });
  });
});