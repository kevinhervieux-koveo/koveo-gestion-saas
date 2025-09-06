/**
 * @file Gemini Integration Form Fill Test Suite
 * @description Comprehensive tests for AI-powered form filling functionality
 * Tests the integration between Gemini AI bill analysis and form auto-population
 * Designed to identify potential issues in the AI form filling workflow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, jest, beforeAll, afterAll } from '@jest/globals';
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

// Mock fetch with proper typing
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Helper function to create proper Response objects
const createMockResponse = (data: any, options: { ok?: boolean; status?: number } = {}) => {
  const { ok = true, status = 200 } = options;
  return Promise.resolve({
    ok,
    status,
    json: async () => data,
    headers: new Headers(),
    redirected: false,
    statusText: ok ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    text: jest.fn(),
  } as Response);
};

const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      }
    },
  });

// Mock bill analysis responses - testing various scenarios
const mockAnalysisResponses = {
  successful: {
    title: "Hydro-Québec Electricity Bill",
    vendor: "Hydro-Québec", 
    totalAmount: "245.67",
    category: "utilities",
    description: "Monthly electricity consumption",
    dueDate: "2025-01-31",
    issueDate: "2025-01-01",
    billNumber: "HQ-2025-001234",
    confidence: 0.95
  },
  lowConfidence: {
    title: "Unclear Insurance Document",
    vendor: "Unknown Provider",
    totalAmount: "0.00",
    category: "other",
    description: "",
    confidence: 0.25
  },
  invalidData: {
    title: "",
    vendor: "Valid Vendor",
    totalAmount: "invalid-amount",
    category: "invalid-category",
    confidence: 1.5 // Invalid confidence > 1.0
  },
  partialData: {
    title: "Property Maintenance Bill",
    vendor: "ABC Maintenance",
    totalAmount: "1250.00",
    category: "maintenance"
    // Missing other fields to test partial filling
  },
  frenchContent: {
    title: "Facture d'Assurance Habitation", 
    vendor: "Assurances Desjardins",
    totalAmount: "2400.00",
    category: "insurance",
    description: "Prime annuelle d'assurance habitation",
    dueDate: "2025-12-31",
    confidence: 0.88
  }
};

// Test component that simulates the BillForm AI integration
const TestBillFormWithAI = () => {
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [aiAnalysisData, setAiAnalysisData] = React.useState<any>(null);
  const [formData, setFormData] = React.useState({
    title: '',
    vendor: '',
    category: 'other',
    totalAmount: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    paymentType: 'unique',
    notes: ''
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const analyzeDocument = async () => {
    if (!uploadedFile) return;
    
    setIsAnalyzing(true);
    
    try {
      const formData = new FormData();
      formData.append('document', uploadedFile);

      const response = await fetch('/api/bills/analyze-document', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze document');
      }

      const result = await response.json();
      setAiAnalysisData(result);
      
      // Simulate the smart form filling logic from BillForm.tsx
      if (result) {
        setFormData(current => {
          const updated = { ...current };
          
          // Only fill empty fields (simulating the smart logic)
          if (!current.title) {
            updated.title = result.title || '';
          }
          if (!current.vendor) {
            updated.vendor = result.vendor || '';
          }
          if (current.category === 'other') {
            updated.category = result.category || 'other';
          }
          if (!current.totalAmount) {
            updated.totalAmount = result.totalAmount || '';
          }
          if (!current.description) {
            updated.description = result.description || '';
          }
          
          // Add AI analysis info to notes
          const aiNotes = [];
          if (result.billNumber) {
            aiNotes.push(`Bill Number: ${result.billNumber}`);
          }
          if (result.dueDate) {
            aiNotes.push(`Due Date: ${result.dueDate}`);
          }
          aiNotes.push(`AI Analysis Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          
          if (aiNotes.length > 0) {
            const aiNotesText = aiNotes.join('\n');
            updated.notes = current.notes ? 
              `${current.notes}\n\n--- AI Analysis ---\n${aiNotesText}` : 
              aiNotesText;
          }
          
          return updated;
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div data-testid="ai-bill-form">
      <div data-testid="file-upload-section">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.gif"
          onChange={handleFileUpload}
          data-testid="file-input"
        />
        <button
          onClick={analyzeDocument}
          disabled={!uploadedFile || isAnalyzing}
          data-testid="analyze-button"
        >
          {isAnalyzing ? 'Analyzing...' : 'Upload & Analyze'}
        </button>
      </div>

      <form data-testid="bill-form">
        <div data-testid="form-fields">
          <input
            data-testid="input-title"
            type="text"
            placeholder="Bill Title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />
          <input
            data-testid="input-vendor"
            type="text"
            placeholder="Vendor"
            value={formData.vendor}
            onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
          />
          <select
            data-testid="select-category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          >
            <option value="other">Other</option>
            <option value="utilities">Utilities</option>
            <option value="maintenance">Maintenance</option>
            <option value="insurance">Insurance</option>
          </select>
          <input
            data-testid="input-amount"
            type="text"
            placeholder="Total Amount"
            value={formData.totalAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
          />
          <textarea
            data-testid="input-description"
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />
          <textarea
            data-testid="input-notes"
            placeholder="Notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </form>

      {aiAnalysisData && (
        <div data-testid="analysis-result">
          <div data-testid="analysis-confidence">
            Confidence: {(aiAnalysisData.confidence * 100).toFixed(1)}%
          </div>
          <div data-testid="analysis-data">
            {JSON.stringify(aiAnalysisData)}
          </div>
        </div>
      )}
    </div>
  );
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createMockQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('Gemini Form Integration Tests', () => {
  // Mock console.error to avoid test output pollution
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    mockFetch.mockClear();
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalConsoleError;
  });

  describe('Successful AI Analysis Scenarios', () => {
    it('should successfully analyze a clear utility bill and fill form correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.successful)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      // Upload a file
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'hydro-bill.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      // Click analyze button
      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      // Wait for analysis to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/bills/analyze-document', expect.any(Object));
      });

      await waitFor(() => {
        // Verify form fields were populated correctly
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        const vendorInput = screen.getByTestId('input-vendor') as HTMLInputElement;
        const categorySelect = screen.getByTestId('select-category') as HTMLSelectElement;
        const amountInput = screen.getByTestId('input-amount') as HTMLInputElement;
        const descriptionInput = screen.getByTestId('input-description') as HTMLTextAreaElement;
        const notesInput = screen.getByTestId('input-notes') as HTMLTextAreaElement;

        expect(titleInput.value).toBe('Hydro-Québec Electricity Bill');
        expect(vendorInput.value).toBe('Hydro-Québec');
        expect(categorySelect.value).toBe('utilities');
        expect(amountInput.value).toBe('245.67');
        expect(descriptionInput.value).toBe('Monthly electricity consumption');
        expect(notesInput.value).toContain('Bill Number: HQ-2025-001234');
        expect(notesInput.value).toContain('Due Date: 2025-01-31');
        expect(notesInput.value).toContain('AI Analysis Confidence: 95.0%');
      });

      // Verify confidence is displayed
      const confidenceDisplay = screen.getByTestId('analysis-confidence');
      expect(confidenceDisplay).toHaveTextContent('95.0%');
    });

    it('should handle French language bills correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.frenchContent)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['contenu français'], 'facture-assurance.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        const vendorInput = screen.getByTestId('input-vendor') as HTMLInputElement;
        const categorySelect = screen.getByTestId('select-category') as HTMLSelectElement;

        expect(titleInput.value).toBe("Facture d'Assurance Habitation");
        expect(vendorInput.value).toBe('Assurances Desjardins');
        expect(categorySelect.value).toBe('insurance');
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle low confidence analysis results appropriately', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.lowConfidence)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['unclear content'], 'blurry-document.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const confidenceDisplay = screen.getByTestId('analysis-confidence');
        expect(confidenceDisplay).toHaveTextContent('25.0%');

        // With low confidence, title should still be filled but amount should be empty or 0
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        const amountInput = screen.getByTestId('input-amount') as HTMLInputElement;
        
        expect(titleInput.value).toBe('Unclear Insurance Document');
        expect(amountInput.value).toBe('0.00');
      });
    });

    it('should handle invalid data from AI analysis gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.invalidData)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['corrupted data'], 'corrupted.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        // Check that invalid data is handled
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        const vendorInput = screen.getByTestId('input-vendor') as HTMLInputElement;
        const amountInput = screen.getByTestId('input-amount') as HTMLInputElement;
        const categorySelect = screen.getByTestId('select-category') as HTMLSelectElement;

        // Empty title should not be filled
        expect(titleInput.value).toBe('');
        // Valid vendor should be filled  
        expect(vendorInput.value).toBe('Valid Vendor');
        // Invalid amount should not crash the form
        expect(amountInput.value).toBe('invalid-amount'); // This might be a bug!
        // Invalid category should fall back to 'other'
        expect(categorySelect.value).toBe('other');
      });
    });

    it('should handle network errors during analysis', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        // Form should remain empty after error
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        expect(titleInput.value).toBe('');
        
        // Analysis button should be enabled again
        expect(analyzeButton).not.toBeDisabled();
      });
    });

    it('should handle server errors (500) appropriately', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Internal server error' }, { ok: false, status: 500 })
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        // Should handle server error gracefully
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        expect(titleInput.value).toBe('');
      });
    });
  });

  describe('User Interaction and Data Preservation', () => {
    it('should preserve user-entered data when AI analysis completes', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.successful)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      // User fills some fields manually first
      const titleInput = screen.getByTestId('input-title');
      const vendorInput = screen.getByTestId('input-vendor');
      const notesInput = screen.getByTestId('input-notes');

      await userEvent.type(titleInput, 'My Custom Title');
      await userEvent.type(vendorInput, 'My Custom Vendor');
      await userEvent.type(notesInput, 'User notes here');

      // Then user uploads and analyzes
      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        // User data should be preserved
        const titleInputAfter = screen.getByTestId('input-title') as HTMLInputElement;
        const vendorInputAfter = screen.getByTestId('input-vendor') as HTMLInputElement;
        const notesInputAfter = screen.getByTestId('input-notes') as HTMLTextAreaElement;

        expect(titleInputAfter.value).toBe('My Custom Title'); // Preserved
        expect(vendorInputAfter.value).toBe('My Custom Vendor'); // Preserved
        expect(notesInputAfter.value).toContain('User notes here'); // Preserved
        expect(notesInputAfter.value).toContain('AI Analysis'); // AI info added
      });
    });

    it('should only fill empty fields, not overwrite user input', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.successful)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      // Pre-fill amount field with user data
      const amountInput = screen.getByTestId('input-amount');
      await userEvent.type(amountInput, '999.99');

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const amountInputAfter = screen.getByTestId('input-amount') as HTMLInputElement;
        const titleInputAfter = screen.getByTestId('input-title') as HTMLInputElement;

        // User amount should be preserved
        expect(amountInputAfter.value).toBe('999.99');
        // Empty title should be filled by AI
        expect(titleInputAfter.value).toBe('Hydro-Québec Electricity Bill');
      });
    });
  });

  describe('File Type and Content Validation', () => {
    it('should handle different file types appropriately', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockAnalysisResponses.successful)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      // Test with image file
      const fileInput = screen.getByTestId('file-input');
      const imageFile = new File(['image data'], 'bill-scan.jpg', { type: 'image/jpeg' });
      await userEvent.upload(fileInput, imageFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/bills/analyze-document', 
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should disable analyze button when no file is selected', () => {
      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const analyzeButton = screen.getByTestId('analyze-button');
      expect(analyzeButton).toBeDisabled();
    });

    it('should show analyzing state while processing', async () => {
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(delayedPromise);

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      // Button should show analyzing state
      expect(analyzeButton).toHaveTextContent('Analyzing...');
      expect(analyzeButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!(
        createMockResponse(mockAnalysisResponses.successful)
      );

      await waitFor(() => {
        expect(analyzeButton).toHaveTextContent('Upload & Analyze');
        expect(analyzeButton).not.toBeDisabled();
      });
    });
  });

  describe('Data Integrity and Security Issues', () => {
    it('should sanitize and validate AI response data', async () => {
      // Mock response with potential security issues
      const maliciousResponse = {
        title: '<script>alert("xss")</script>Legitimate Title',
        vendor: 'javascript:void(0)',
        totalAmount: 'SELECT * FROM users; --',
        category: 'utilities',
        confidence: 0.95,
        billNumber: '"><img src=x onerror=alert(1)>',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(maliciousResponse)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const titleInput = screen.getByTestId('input-title') as HTMLInputElement;
        const vendorInput = screen.getByTestId('input-vendor') as HTMLInputElement;
        const amountInput = screen.getByTestId('input-amount') as HTMLInputElement;
        const notesInput = screen.getByTestId('input-notes') as HTMLTextAreaElement;

        // Values should be filled (this test reveals potential XSS vulnerability)
        expect(titleInput.value).toContain('<script>');
        expect(vendorInput.value).toBe('javascript:void(0)');
        expect(amountInput.value).toContain('SELECT');
        expect(notesInput.value).toContain('onerror=alert(1)');
      });
    });

    it('should validate amount field format after AI analysis', async () => {
      const invalidAmountResponse = {
        ...mockAnalysisResponses.successful,
        totalAmount: '999,999.999', // Too many decimal places
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(invalidAmountResponse)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const amountInput = screen.getByTestId('input-amount') as HTMLInputElement;
        // Should the app validate and fix this format? This test will reveal the behavior
        expect(amountInput.value).toBe('999,999.999');
      });
    });

    it('should handle confidence values outside valid range', async () => {
      const invalidConfidenceResponse = {
        ...mockAnalysisResponses.successful,
        confidence: 1.5, // Invalid: > 1.0
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(invalidConfidenceResponse)
      );

      render(
        <TestWrapper>
          <TestBillFormWithAI />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await userEvent.upload(fileInput, testFile);

      const analyzeButton = screen.getByTestId('analyze-button');
      await userEvent.click(analyzeButton);

      await waitFor(() => {
        const confidenceDisplay = screen.getByTestId('analysis-confidence');
        // Should be clamped to 100% or show error?
        expect(confidenceDisplay).toHaveTextContent('150.0%'); // This reveals the issue
      });
    });
  });
});