/**
 * Document and Bill Management Test Suite
 * Tests all data modification functionality for documents and bills
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../test-utils/providers';
import { mockApiRequest } from '../../test-utils/api-mocks';

// Mock document upload component
const MockDocumentUploadForm = ({ onSuccess }: any) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      await mockApiRequest('POST', '/api/documents', formData);
      onSuccess?.();
    } catch (error) {
      console.error('Document upload error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="document-upload-form">
      <input 
        type="file" 
        name="file" 
        accept=".pdf,.doc,.docx,.jpg,.png"
        data-testid="input-document-file"
        required
      />
      <input 
        name="name" 
        placeholder="Document Name" 
        data-testid="input-document-name"
        required
      />
      <textarea 
        name="description" 
        placeholder="Description" 
        data-testid="textarea-document-description"
      />
      <select name="category" data-testid="select-document-category" required>
        <option value="">Select Category</option>
        <option value="financial">Financial</option>
        <option value="legal">Legal</option>
        <option value="maintenance">Maintenance</option>
        <option value="insurance">Insurance</option>
        <option value="other">Other</option>
      </select>
      <select name="buildingId" data-testid="select-building-id">
        <option value="">Building Level</option>
        <option value="building-1">Building 1</option>
        <option value="building-2">Building 2</option>
      </select>
      <select name="residenceId" data-testid="select-residence-id">
        <option value="">Residence Level</option>
        <option value="residence-1">Unit 101</option>
        <option value="residence-2">Unit 102</option>
      </select>
      <label>
        <input 
          type="checkbox" 
          name="visibleToTenants" 
          data-testid="checkbox-visible-to-tenants"
        />
        Visible to Tenants
      </label>
      <button type="submit" data-testid="button-upload-document">
        Upload Document
      </button>
    </form>
  );
};

const MockDocumentEditForm = ({ document, onSuccess }: any) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    try {
      await mockApiRequest('PUT', `/api/documents/${document.id}`, data);
      onSuccess?.();
    } catch (error) {
      console.error('Document update error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="document-edit-form">
      <input 
        name="name" 
        placeholder="Document Name" 
        defaultValue={document?.name || ''}
        data-testid="input-document-name"
        required
      />
      <textarea 
        name="description" 
        placeholder="Description" 
        defaultValue={document?.description || ''}
        data-testid="textarea-document-description"
      />
      <select name="category" defaultValue={document?.category || ''} data-testid="select-document-category" required>
        <option value="financial">Financial</option>
        <option value="legal">Legal</option>
        <option value="maintenance">Maintenance</option>
        <option value="insurance">Insurance</option>
        <option value="other">Other</option>
      </select>
      <button type="submit" data-testid="button-update-document">
        Update Document
      </button>
    </form>
  );
};

const MockBillForm = ({ bill, onSuccess }: any) => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    
    const finalData = {
      ...data,
      amount: Number(data.amount),
      dueDate: new Date(data.dueDate as string)
    };
    
    try {
      const url = bill ? `/api/bills/${bill.id}` : '/api/bills';
      const method = bill ? 'PUT' : 'POST';
      await mockApiRequest(method, url, finalData);
      onSuccess?.();
    } catch (error) {
      console.error('Bill form error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="bill-form">
      <input 
        name="billNumber" 
        placeholder="Bill Number" 
        defaultValue={bill?.billNumber || ''}
        data-testid="input-bill-number"
        required
      />
      <input 
        name="amount" 
        type="number" 
        step="0.01" 
        min="0"
        placeholder="Amount" 
        defaultValue={bill?.amount || ''}
        data-testid="input-bill-amount"
        required
      />
      <input 
        name="dueDate" 
        type="date" 
        defaultValue={bill?.dueDate?.split('T')[0] || ''}
        data-testid="input-due-date"
        required
      />
      <select name="type" defaultValue={bill?.type || ''} data-testid="select-bill-type" required>
        <option value="">Select Type</option>
        <option value="monthly_fee">Monthly Fee</option>
        <option value="special_assessment">Special Assessment</option>
        <option value="utilities">Utilities</option>
        <option value="parking">Parking</option>
        <option value="storage">Storage</option>
        <option value="other">Other</option>
      </select>
      <select name="status" defaultValue={bill?.status || 'sent'} data-testid="select-bill-status">
        <option value="sent">Sent</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select name="residenceId" defaultValue={bill?.residenceId || ''} data-testid="select-residence-id" required>
        <option value="">Select Residence</option>
        <option value="residence-1">Unit 101</option>
        <option value="residence-2">Unit 102</option>
      </select>
      <textarea 
        name="description" 
        placeholder="Description (optional)" 
        defaultValue={bill?.description || ''}
        data-testid="textarea-bill-description"
      />
      <button type="submit" data-testid="button-submit-bill">
        {bill ? 'Update Bill' : 'Create Bill'}
      </button>
    </form>
  );
};

const mockDocument = {
  id: 'test-document-id',
  name: 'Test Document.pdf',
  description: 'Test document description',
  category: 'financial',
  visibleToTenants: false,
  buildingId: 'building-1'
};

const mockBill = {
  id: 'test-bill-id',
  billNumber: 'BILL-001',
  amount: 1500.00,
  dueDate: '2025-12-31T00:00:00.000Z',
  type: 'monthly_fee',
  status: 'sent',
  residenceId: 'residence-1',
  description: 'Monthly condo fee'
};

describe('Document and Bill Management', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      status: 200
    });
  });

  describe('Document Management', () => {
    it('should upload a new document successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockDocumentUploadForm onSuccess={onSuccess} />
        </TestProviders>
      );

      // Create a mock file
      const file = new File(['test content'], 'test-document.pdf', { type: 'application/pdf' });

      // Fill out document upload form
      const fileInput = screen.getByTestId('input-document-file');
      await user.upload(fileInput, file);

      await user.type(screen.getByTestId('input-document-name'), 'Monthly Financial Report');
      await user.type(screen.getByTestId('textarea-document-description'), 'Monthly financial report for December 2025');
      await user.selectOptions(screen.getByTestId('select-document-category'), 'financial');
      await user.selectOptions(screen.getByTestId('select-building-id'), 'building-1');
      await user.click(screen.getByTestId('checkbox-visible-to-tenants'));

      // Submit form
      await user.click(screen.getByTestId('button-upload-document'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/documents', expect.any(FormData));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should edit document metadata successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockDocumentEditForm document={mockDocument} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Verify form is pre-populated
      expect(screen.getByDisplayValue('Test Document.pdf')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test document description')).toBeInTheDocument();

      // Modify document details
      const nameInput = screen.getByTestId('input-document-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Document Name.pdf');

      const descriptionInput = screen.getByTestId('textarea-document-description');
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Updated document description');

      await user.selectOptions(screen.getByTestId('select-document-category'), 'legal');

      // Submit form
      await user.click(screen.getByTestId('button-update-document'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/documents/${mockDocument.id}`, expect.objectContaining({
          name: 'Updated Document Name.pdf',
          description: 'Updated document description',
          category: 'legal'
        }));
      });
    });

    it('should validate document upload requirements', async () => {
      render(
        <TestProviders>
          <MockDocumentUploadForm />
        </TestProviders>
      );

      // Try to submit without file
      await user.click(screen.getByTestId('button-upload-document'));

      // Form should not submit due to HTML5 validation
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('should handle document upload errors', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Upload failed'));

      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockDocumentUploadForm onSuccess={onSuccess} />
        </TestProviders>
      );

      // Create a mock file and fill form
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByTestId('input-document-file'), file);
      await user.type(screen.getByTestId('input-document-name'), 'Test Document');
      await user.selectOptions(screen.getByTestId('select-document-category'), 'financial');

      // Submit form
      await user.click(screen.getByTestId('button-upload-document'));

      // onSuccess should not be called due to error
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Bill Management', () => {
    it('should create a new bill successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBillForm onSuccess={onSuccess} />
        </TestProviders>
      );

      // Fill out bill creation form
      await user.type(screen.getByTestId('input-bill-number'), 'BILL-002');
      await user.type(screen.getByTestId('input-bill-amount'), '2000.00');
      await user.type(screen.getByTestId('input-due-date'), '2025-12-31');
      await user.selectOptions(screen.getByTestId('select-bill-type'), 'special_assessment');
      await user.selectOptions(screen.getByTestId('select-bill-status'), 'sent');
      await user.selectOptions(screen.getByTestId('select-residence-id'), 'residence-2');
      await user.type(screen.getByTestId('textarea-bill-description'), 'Special assessment for building repairs');

      // Submit form
      await user.click(screen.getByTestId('button-submit-bill'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/bills', expect.objectContaining({
          billNumber: 'BILL-002',
          amount: 2000.00,
          type: 'special_assessment',
          status: 'sent',
          residenceId: 'residence-2',
          description: 'Special assessment for building repairs'
        }));
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should edit an existing bill successfully', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBillForm bill={mockBill} onSuccess={onSuccess} />
        </TestProviders>
      );

      // Verify form is pre-populated
      expect(screen.getByDisplayValue('BILL-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2025-12-31')).toBeInTheDocument();

      // Modify bill details
      const amountInput = screen.getByTestId('input-bill-amount');
      await user.clear(amountInput);
      await user.type(amountInput, '1750.00');

      await user.selectOptions(screen.getByTestId('select-bill-status'), 'paid');

      // Submit form
      await user.click(screen.getByTestId('button-submit-bill'));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', `/api/bills/${mockBill.id}`, expect.objectContaining({
          amount: 1750.00,
          status: 'paid'
        }));
      });
    });

    it('should validate bill amount is positive', async () => {
      render(
        <TestProviders>
          <MockBillForm />
        </TestProviders>
      );

      // Try to enter negative amount
      await user.type(screen.getByTestId('input-bill-amount'), '-100');
      
      // HTML5 validation should prevent negative values
      const amountInput = screen.getByTestId('input-bill-amount');
      expect(amountInput).toHaveAttribute('min', '0');
    });

    it('should handle all bill types correctly', async () => {
      const billTypes = ['monthly_fee', 'special_assessment', 'utilities', 'parking', 'storage', 'other'];
      
      for (const billType of billTypes) {
        const onSuccess = vi.fn();

        render(
          <TestProviders>
            <MockBillForm onSuccess={onSuccess} />
          </TestProviders>
        );

        await user.type(screen.getByTestId('input-bill-number'), `BILL-${billType.toUpperCase()}`);
        await user.type(screen.getByTestId('input-bill-amount'), '1000.00');
        await user.type(screen.getByTestId('input-due-date'), '2025-12-31');
        await user.selectOptions(screen.getByTestId('select-bill-type'), billType);
        await user.selectOptions(screen.getByTestId('select-residence-id'), 'residence-1');

        await user.click(screen.getByTestId('button-submit-bill'));

        await waitFor(() => {
          expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/bills', expect.objectContaining({
            type: billType
          }));
        });
      }
    });

    it('should handle bill creation errors', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Bill creation failed'));

      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockBillForm onSuccess={onSuccess} />
        </TestProviders>
      );

      // Fill out valid form
      await user.type(screen.getByTestId('input-bill-number'), 'BILL-ERROR');
      await user.type(screen.getByTestId('input-bill-amount'), '1500.00');
      await user.type(screen.getByTestId('input-due-date'), '2025-12-31');
      await user.selectOptions(screen.getByTestId('select-bill-type'), 'monthly_fee');
      await user.selectOptions(screen.getByTestId('select-residence-id'), 'residence-1');

      // Submit form
      await user.click(screen.getByTestId('button-submit-bill'));

      // onSuccess should not be called due to error
      await waitFor(() => {
        expect(onSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Document Categories and Permissions', () => {
    it('should handle all document categories', async () => {
      const categories = ['financial', 'legal', 'maintenance', 'insurance', 'other'];
      
      for (const category of categories) {
        render(
          <TestProviders>
            <MockDocumentEditForm document={{ ...mockDocument, category }} />
          </TestProviders>
        );

        const categorySelect = screen.getByTestId('select-document-category');
        expect(categorySelect).toHaveValue(category);
      }
    });

    it('should toggle tenant visibility correctly', async () => {
      const onSuccess = vi.fn();

      render(
        <TestProviders>
          <MockDocumentUploadForm onSuccess={onSuccess} />
        </TestProviders>
      );

      const visibilityCheckbox = screen.getByTestId('checkbox-visible-to-tenants');
      
      // Initially unchecked
      expect(visibilityCheckbox).not.toBeChecked();
      
      // Click to check
      await user.click(visibilityCheckbox);
      expect(visibilityCheckbox).toBeChecked();
      
      // Click to uncheck
      await user.click(visibilityCheckbox);
      expect(visibilityCheckbox).not.toBeChecked();
    });
  });

  describe('Date and Number Validation', () => {
    it('should validate due date format', async () => {
      render(
        <TestProviders>
          <MockBillForm />
        </TestProviders>
      );

      const dueDateInput = screen.getByTestId('input-due-date');
      expect(dueDateInput).toHaveAttribute('type', 'date');
    });

    it('should validate amount format with decimals', async () => {
      render(
        <TestProviders>
          <MockBillForm />
        </TestProviders>
      );

      const amountInput = screen.getByTestId('input-bill-amount');
      expect(amountInput).toHaveAttribute('step', '0.01');
      expect(amountInput).toHaveAttribute('type', 'number');
    });
  });

  describe('Form State Management', () => {
    it('should preserve form data during validation errors', async () => {
      render(
        <TestProviders>
          <MockBillForm />
        </TestProviders>
      );

      // Fill partial form
      await user.type(screen.getByTestId('input-bill-number'), 'BILL-PARTIAL');
      await user.type(screen.getByTestId('input-bill-amount'), '1000.00');

      // Try to submit incomplete form
      await user.click(screen.getByTestId('button-submit-bill'));

      // Form data should be preserved
      expect(screen.getByDisplayValue('BILL-PARTIAL')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    });
  });
});