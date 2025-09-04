/**
 * File Upload End-to-End Test Suite
 * 
 * Complete end-to-end testing of file upload workflows across all forms.
 * This test suite simulates real user interactions with file uploads:
 * 1. Full form submission workflows with files
 * 2. User interface feedback during upload
 * 3. File viewing and downloading after upload
 * 4. Error handling and user notifications
 * 5. Cross-browser compatibility scenarios
 * 6. Mobile device file selection
 */

/// <reference path="../types/jest-dom.d.ts" />
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Test utilities and setup
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock functions
const mockApiRequest = jest.fn();
const mockFetch = jest.fn();
const mockToast = jest.fn();

jest.mock('@/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@koveo.com',
      role: 'admin',
    },
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

global.fetch = mockFetch;

// File creation utilities
const createMockFile = (name: string, size: number, type: string, content?: string) => {
  const file = new File([content || 'mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('File Upload End-to-End Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiRequest.mockResolvedValue({ id: 'test-id', success: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-id', success: true }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Complete Bug Report Workflow with Files', () => {
    it('should complete full bug report submission with multiple attachments', async () => {
      const BugReportPage = require('../../client/src/pages/settings/bug-reports.tsx').default;
      
      // Mock successful responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            id: 'bug-123',
            title: 'Complete Bug Report',
            attachmentCount: 3,
            attachments: [
              { id: 'att-1', name: 'screenshot.png', size: 50000 },
              { id: 'att-2', name: 'error-log.txt', size: 2000 },
              { id: 'att-3', name: 'config.json', size: 1500 }
            ]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([
            { 
              id: 'bug-123',
              title: 'Complete Bug Report',
              attachmentCount: 3,
              attachments: [
                { id: 'att-1', name: 'screenshot.png', size: 50000 },
                { id: 'att-2', name: 'error-log.txt', size: 2000 },
                { id: 'att-3', name: 'config.json', size: 1500 }
              ]
            }
          ])
        });

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportPage />
        </TestWrapper>
      );

      // Step 1: Open bug report form
      const reportButton = await screen.findByTestId('button-report-bug');
      await user.click(reportButton);

      // Step 2: Fill in required form fields
      const titleInput = screen.getByLabelText(/title/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const pageInput = screen.getByLabelText(/page/i);
      
      await user.type(titleInput, 'Complete Bug Report');
      await user.type(descriptionTextarea, 'This is a comprehensive bug report with multiple file attachments including screenshots, logs, and configuration files.');
      await user.type(pageInput, 'Settings Page');

      // Step 3: Select category and priority
      const categorySelect = screen.getByLabelText(/category/i);
      const prioritySelect = screen.getByLabelText(/priority/i);
      
      await user.selectOptions(categorySelect, 'functionality');
      await user.selectOptions(prioritySelect, 'high');

      // Step 4: Add reproduction steps
      const stepsTextarea = screen.getByLabelText(/steps to reproduce/i);
      await user.type(stepsTextarea, 'Step 1: Navigate to Settings\nStep 2: Click on Advanced Options\nStep 3: Observe the error');

      // Step 5: Attach multiple files
      const fileInput = screen.getByRole('button', { name: /attach files/i });
      await user.click(fileInput);

      const hiddenFileInput = screen.getByRole('input', { type: 'file', hidden: true });
      const mockFiles = [
        createMockFile('screenshot.png', 50000, 'image/png'),
        createMockFile('error-log.txt', 2000, 'text/plain'),
        createMockFile('config.json', 1500, 'application/json')
      ];

      Object.defineProperty(hiddenFileInput, 'files', {
        value: mockFiles,
        writable: false,
      });

      fireEvent.change(hiddenFileInput, { target: { files: mockFiles } });

      // Step 6: Verify files are displayed
      await waitFor(() => {
        expect(screen.getByText('screenshot.png')).toBeInTheDocument();
        expect(screen.getByText('error-log.txt')).toBeInTheDocument();
        expect(screen.getByText('config.json')).toBeInTheDocument();
      });

      // Step 7: Submit the form
      const submitButton = screen.getByRole('button', { name: /submit bug report/i });
      await user.click(submitButton);

      // Step 8: Verify submission with multipart form data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/bugs',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
            credentials: 'include',
          })
        );
      });

      // Step 9: Verify success notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Bug created',
            description: expect.stringContaining('successfully'),
          })
        );
      });

      // Step 10: Verify bug appears in list with attachment count
      await waitFor(() => {
        expect(screen.getByText('Complete Bug Report')).toBeInTheDocument();
        expect(screen.getByText('3 files')).toBeInTheDocument();
      });
    });

    it('should handle upload progress feedback', async () => {
      const BugReportPage = require('../../client/src/pages/settings/bug-reports.tsx').default;
      
      // Mock XMLHttpRequest for progress tracking
      const mockXHR = {
        upload: {
          addEventListener: jest.fn((event, callback) => {
            if (event === 'progress') {
              setTimeout(() => callback({ loaded: 25, total: 100 }), 50);
              setTimeout(() => callback({ loaded: 50, total: 100 }), 100);
              setTimeout(() => callback({ loaded: 75, total: 100 }), 150);
              setTimeout(() => callback({ loaded: 100, total: 100 }), 200);
            }
          }),
        },
        addEventListener: jest.fn((event, callback) => {
          if (event === 'load') {
            setTimeout(() => callback({ target: { response: '{"success": true}' } }), 250);
          }
        }),
        open: jest.fn(),
        send: jest.fn(),
        setRequestHeader: jest.fn(),
        readyState: 4,
        status: 200,
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportPage />
        </TestWrapper>
      );

      const reportButton = await screen.findByTestId('button-report-bug');
      await user.click(reportButton);

      // Fill minimum required fields
      await user.type(screen.getByLabelText(/title/i), 'Bug with Progress');
      await user.type(screen.getByLabelText(/description/i), 'Testing upload progress feedback.');
      await user.type(screen.getByLabelText(/page/i), 'Test Page');

      // Attach a large file
      const fileInput = screen.getByRole('button', { name: /attach files/i });
      await user.click(fileInput);

      const hiddenFileInput = screen.getByRole('input', { type: 'file', hidden: true });
      const largeFile = createMockFile('large-image.png', 10 * 1024 * 1024, 'image/png'); // 10MB

      Object.defineProperty(hiddenFileInput, 'files', {
        value: [largeFile],
        writable: false,
      });

      fireEvent.change(hiddenFileInput, { target: { files: [largeFile] } });

      const submitButton = screen.getByRole('button', { name: /submit bug report/i });
      await user.click(submitButton);

      // Verify progress indicators appear
      await waitFor(() => {
        const progressIndicators = screen.queryAllByText(/uploading|progress|\d+%/i);
        expect(progressIndicators.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Feature Request with Design Files Workflow', () => {
    it('should handle feature request with design mockups and documentation', async () => {
      const IdeaBoxPage = require('../../client/src/pages/settings/idea-box.tsx').default;
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 
          id: 'feature-456',
          title: 'UI Redesign Feature',
          attachmentCount: 2
        })
      });

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <IdeaBoxPage />
        </TestWrapper>
      );

      // Open feature request form
      const requestButton = await screen.findByRole('button', { name: /request feature|suggest idea/i });
      await user.click(requestButton);

      // Fill form fields
      await user.type(screen.getByLabelText(/title/i), 'UI Redesign Feature');
      await user.type(screen.getByLabelText(/description/i), 'Complete UI overhaul with modern design patterns and improved user experience.');

      // Select category
      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'ui_ux');

      // Attach design files
      const fileInput = screen.getByRole('button', { name: /attach files/i });
      await user.click(fileInput);

      const hiddenInput = screen.getByRole('input', { type: 'file', hidden: true });
      const designFiles = [
        createMockFile('mockup.png', 75000, 'image/png'),
        createMockFile('requirements.pdf', 120000, 'application/pdf')
      ];

      Object.defineProperty(hiddenInput, 'files', {
        value: designFiles,
        writable: false,
      });

      fireEvent.change(hiddenInput, { target: { files: designFiles } });

      // Submit request
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/(features|feature-requests)/),
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/created|submitted/i),
        })
      );
    });
  });

  describe('Document Upload and Management Workflow', () => {
    it('should complete document upload with categorization and permissions', async () => {
      const DocumentManager = require('../../client/src/components/common/DocumentManager.tsx').default;
      
      mockApiRequest.mockResolvedValue({
        id: 'doc-789',
        name: 'Policy Document',
        filePath: 'general/policy-document.pdf',
        isVisibleToTenants: true
      });

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DocumentManager />
        </TestWrapper>
      );

      // Open upload dialog
      const uploadButton = screen.getByRole('button', { name: /upload|add document/i });
      await user.click(uploadButton);

      // Fill document metadata
      await user.type(screen.getByLabelText(/name/i), 'Policy Document');
      await user.type(screen.getByLabelText(/description/i), 'Company policy document for all residents');

      // Set document type
      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'policy');

      // Set visibility permissions
      const visibilityCheckbox = screen.getByLabelText(/visible to tenants/i);
      await user.click(visibilityCheckbox);

      // Upload file
      const fileInput = screen.getByRole('input', { type: 'file' });
      const policyDoc = createMockFile('policy-document.pdf', 500000, 'application/pdf');

      Object.defineProperty(fileInput, 'files', {
        value: [policyDoc],
        writable: false,
      });

      fireEvent.change(fileInput, { target: { files: [policyDoc] } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /upload|save/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/documents',
          expect.objectContaining({
            name: 'Policy Document',
            description: 'Company policy document for all residents',
            documentType: 'policy',
            isVisibleToTenants: true
          })
        );
      });
    });

    it('should handle document viewing after upload', async () => {
      const DocumentManager = require('../../client/src/components/common/DocumentManager.tsx').default;
      
      // Mock document list with uploaded document
      mockApiRequest.mockResolvedValue([
        {
          id: 'doc-123',
          name: 'Uploaded Document',
          filePath: 'general/uploaded-document.pdf',
          fileName: 'uploaded-document.pdf',
          fileSize: '250000',
          attachments: [
            { id: 'att-1', name: 'uploaded-document.pdf', size: 250000 }
          ]
        }
      ]);

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DocumentManager />
        </TestWrapper>
      );

      // Wait for document to appear in list
      await waitFor(() => {
        expect(screen.getByText('Uploaded Document')).toBeInTheDocument();
      });

      // Click view button
      const viewButton = screen.getByRole('button', { name: /view/i });
      await user.click(viewButton);

      // Verify view action (opening in new tab/window)
      expect(window.open).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/documents\/doc-123\/file/),
        '_blank'
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors during upload', async () => {
      const BugReportPage = require('../../client/src/pages/settings/bug-reports.tsx').default;
      
      mockFetch.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportPage />
        </TestWrapper>
      );

      const reportButton = await screen.findByTestId('button-report-bug');
      await user.click(reportButton);

      // Fill form and attach file
      await user.type(screen.getByLabelText(/title/i), 'Network Error Test');
      await user.type(screen.getByLabelText(/description/i), 'Testing network error handling.');
      await user.type(screen.getByLabelText(/page/i), 'Test Page');

      const fileInput = screen.getByRole('button', { name: /attach files/i });
      await user.click(fileInput);

      const hiddenInput = screen.getByRole('input', { type: 'file', hidden: true });
      const testFile = createMockFile('test.png', 10000, 'image/png');

      Object.defineProperty(hiddenInput, 'files', {
        value: [testFile],
        writable: false,
      });

      fireEvent.change(hiddenInput, { target: { files: [testFile] } });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Verify error notification
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: expect.stringContaining('Network error'),
            variant: 'destructive',
          })
        );
      });
    });

    it('should handle file corruption detection', async () => {
      const DocumentManager = require('../../client/src/components/common/DocumentManager.tsx').default;
      
      mockApiRequest.mockRejectedValue({
        message: 'File appears to be corrupted or invalid format'
      });

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DocumentManager />
        </TestWrapper>
      );

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      await user.type(screen.getByLabelText(/name/i), 'Corrupted File Test');
      
      const fileInput = screen.getByRole('input', { type: 'file' });
      const corruptedFile = createMockFile('corrupted.pdf', 50000, 'application/pdf', 'invalid pdf content');

      Object.defineProperty(fileInput, 'files', {
        value: [corruptedFile],
        writable: false,
      });

      fireEvent.change(fileInput, { target: { files: [corruptedFile] } });

      const submitButton = screen.getByRole('button', { name: /upload/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: expect.stringContaining('corrupted'),
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Mobile and Cross-Platform Compatibility', () => {
    it('should handle mobile file selection', async () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
        configurable: true,
      });

      const BugReportPage = require('../../client/src/pages/settings/bug-reports.tsx').default;

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportPage />
        </TestWrapper>
      );

      const reportButton = await screen.findByTestId('button-report-bug');
      await user.click(reportButton);

      // Verify mobile-friendly file input
      const fileButton = screen.getByRole('button', { name: /attach files/i });
      expect(fileButton).toHaveAttribute('accept', expect.stringMatching(/image|pdf|text/));

      // Test camera integration on mobile
      const hiddenInput = screen.getByRole('input', { type: 'file', hidden: true });
      expect(hiddenInput).toHaveAttribute('capture', 'environment'); // Should allow camera capture
    });

    it('should handle drag and drop file upload', async () => {
      const DocumentManager = require('../../client/src/components/common/DocumentManager.tsx').default;

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DocumentManager />
        </TestWrapper>
      );

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await user.click(uploadButton);

      // Find drag and drop area
      const dropZone = screen.getByText(/drag.*drop|drop.*files/i).closest('div');
      expect(dropZone).toBeInTheDocument();

      // Simulate drag and drop
      const mockFile = createMockFile('dropped-file.pdf', 100000, 'application/pdf');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(mockFile);

      fireEvent.dragOver(dropZone!, { dataTransfer });
      fireEvent.drop(dropZone!, { dataTransfer });

      // Verify file was added
      await waitFor(() => {
        expect(screen.getByText('dropped-file.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide proper accessibility attributes for file uploads', async () => {
      const BugReportPage = require('../../client/src/pages/settings/bug-reports.tsx').default;

      render(
        <TestWrapper>
          <BugReportPage />
        </TestWrapper>
      );

      const reportButton = await screen.findByTestId('button-report-bug');
      await userEvent.click(reportButton);

      const fileButton = screen.getByRole('button', { name: /attach files/i });
      
      // Check accessibility attributes
      expect(fileButton).toHaveAttribute('aria-describedby');
      expect(fileButton).toHaveAttribute('tabindex', '0');
      
      // Check for screen reader support
      const srText = screen.getByText(/screenshots.*error logs.*console outputs/i);
      expect(srText).toBeInTheDocument();
    });

    it('should provide clear upload status feedback', async () => {
      const BugReportPage = require('../../client/src/pages/settings/bug-reports.tsx').default;

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BugReportPage />
        </TestWrapper>
      );

      const reportButton = await screen.findByTestId('button-report-bug');
      await user.click(reportButton);

      // Add required fields
      await user.type(screen.getByLabelText(/title/i), 'Accessibility Test');
      await user.type(screen.getByLabelText(/description/i), 'Testing upload feedback.');
      await user.type(screen.getByLabelText(/page/i), 'Test Page');

      // Attach file
      const fileButton = screen.getByRole('button', { name: /attach files/i });
      await user.click(fileButton);

      const hiddenInput = screen.getByRole('input', { type: 'file', hidden: true });
      const testFile = createMockFile('test.png', 25000, 'image/png');

      Object.defineProperty(hiddenInput, 'files', {
        value: [testFile],
        writable: false,
      });

      fireEvent.change(hiddenInput, { target: { files: [testFile] } });

      // Verify file status display
      await waitFor(() => {
        expect(screen.getByText('Selected files (1):')).toBeInTheDocument();
        expect(screen.getByText('test.png')).toBeInTheDocument();
      });

      // Submit and check for status updates
      const submitButton = screen.getByRole('button', { name: /submit/i });
      expect(submitButton).not.toBeDisabled();

      await user.click(submitButton);

      // Button should show loading state
      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /submitting|uploading/i });
        expect(loadingButton).toBeDisabled();
      });
    });
  });
});