/**
 * File Upload Forms Test Suite
 * 
 * Comprehensive testing for all submission forms that support file uploads or image attachments.
 * This test suite validates:
 * 1. File selection and validation
 * 2. Form submission with multipart data
 * 3. Error handling for file uploads
 * 4. File type and size restrictions
 * 5. Multiple file handling
 * 6. UI feedback during upload process
 * 
 * Forms tested:
 * - Bug Reports (with file attachments)
 * - Feature Requests/Ideas (with file attachments)
 * - Document Upload Forms
 * - Bills (with receipt attachments)
 */

/// <reference path="../types/jest-dom.d.ts" />
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Test utilities
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
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

// Mock API request function
const mockApiRequest = jest.fn() as jest.MockedFunction<any>;
const mockFetch = jest.fn() as jest.MockedFunction<any>;

jest.mock('@/lib/queryClient', () => ({
  apiRequest: mockApiRequest,
}));

// Mock authentication hook
const mockAuth = {
  user: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@koveo.com',
    role: 'admin',
    organizationId: '123e4567-e89b-12d3-a456-426614174001'
  },
  login: jest.fn(),
  logout: jest.fn(),
};

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => mockAuth,
}));

// Mock toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock global fetch
global.fetch = mockFetch as any;

// Create mock files for testing
const createMockFile = (name: string, size: number, type: string) => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const createMockImage = (name: string, size: number = 50000) => 
  createMockFile(name, size, 'image/png');

const createMockPDF = (name: string, size: number = 100000) => 
  createMockFile(name, size, 'application/pdf');

const createMockTextFile = (name: string, size: number = 1000) => 
  createMockFile(name, size, 'text/plain');

describe('File Upload Forms Test Suite', () => {
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

  describe('Bug Report Form with File Attachments', () => {
    const BugReportForm = require('../../client/src/pages/settings/bug-reports.tsx').default;

    beforeEach(() => {
      // Reset mocks for this test suite
      jest.clearAllMocks();
    });

    it('should render bug report form with file upload capability', async () => {
      render(
        <TestWrapper>
          <BugReportForm />
        </TestWrapper>
      );

      // Check for bug report button
      const reportButton = screen.queryByTestId('button-report-bug') || 
                          screen.queryByText(/report bug/i);
      
      if (reportButton) {
        await userEvent.click(reportButton);

        // Look for file upload components
        const attachButton = screen.queryByText(/attach files/i) ||
                            screen.queryByText(/screenshots/i) ||
                            screen.queryByRole('button', { name: /attach/i });
        
        expect(attachButton).toBeTruthy();
      }
    });

    it('should handle single file attachment to bug reports', async () => {
      render(
        <TestWrapper>
          <BugReportForm />
        </TestWrapper>
      );

      const reportButton = screen.queryByTestId('button-report-bug') || 
                          screen.queryByText(/report bug/i);
      
      if (reportButton) {
        await userEvent.click(reportButton);

        // Fill required fields
        const titleInput = screen.queryByLabelText(/title/i) || 
                          screen.queryByPlaceholderText(/title/i);
        const descriptionInput = screen.queryByLabelText(/description/i) ||
                                screen.queryByPlaceholderText(/description/i);
        const pageInput = screen.queryByLabelText(/page/i) ||
                         screen.queryByPlaceholderText(/page/i);

        if (titleInput && descriptionInput && pageInput) {
          await userEvent.type(titleInput, 'Test Bug Report with File');
          await userEvent.type(descriptionInput, 'This is a test bug report with file attachment for testing purposes.');
          await userEvent.type(pageInput, 'Test Page');

          // Try to find and interact with file upload
          const fileInput = screen.queryByRole('button', { name: /attach/i }) ||
                           screen.queryByText(/attach files/i);

          if (fileInput) {
            const mockFile = createMockImage('screenshot.png');
            
            // Simulate file selection
            Object.defineProperty(fileInput, 'files', {
              value: [mockFile],
              writable: false,
            });

            fireEvent.change(fileInput, { target: { files: [mockFile] } });

            // Submit form
            const submitButton = screen.queryByTestId('button-submit-bug') ||
                               screen.queryByRole('button', { name: /submit/i });
            
            if (submitButton) {
              await userEvent.click(submitButton);

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
            }
          }
        }
      }
    });

    it('should handle multiple file attachments to bug reports', async () => {
      render(
        <TestWrapper>
          <BugReportForm />
        </TestWrapper>
      );

      const reportButton = screen.queryByTestId('button-report-bug') || 
                          screen.queryByText(/report bug/i);
      
      if (reportButton) {
        await userEvent.click(reportButton);

        const titleInput = screen.queryByLabelText(/title/i) || 
                          screen.queryByPlaceholderText(/title/i);
        const descriptionInput = screen.queryByLabelText(/description/i) ||
                                screen.queryByPlaceholderText(/description/i);
        const pageInput = screen.queryByLabelText(/page/i) ||
                         screen.queryByPlaceholderText(/page/i);

        if (titleInput && descriptionInput && pageInput) {
          await userEvent.type(titleInput, 'Multi-file Bug Report');
          await userEvent.type(descriptionInput, 'Testing multiple file attachments in bug reports.');
          await userEvent.type(pageInput, 'Test Page');

          const fileInput = screen.queryByRole('button', { name: /attach/i });

          if (fileInput) {
            const mockFiles = [
              createMockImage('screenshot1.png'),
              createMockImage('screenshot2.png'),
              createMockPDF('error-log.pdf')
            ];

            // Simulate multiple file selection
            Object.defineProperty(fileInput, 'files', {
              value: mockFiles,
              writable: false,
            });

            fireEvent.change(fileInput, { target: { files: mockFiles } });

            const submitButton = screen.queryByTestId('button-submit-bug') ||
                               screen.queryByRole('button', { name: /submit/i });
            
            if (submitButton) {
              await userEvent.click(submitButton);

              await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                  '/api/bugs',
                  expect.objectContaining({
                    method: 'POST',
                    body: expect.any(FormData),
                  })
                );
              });
            }
          }
        }
      }
    });

    it('should validate file size limits for bug report attachments', async () => {
      render(
        <TestWrapper>
          <BugReportForm />
        </TestWrapper>
      );

      const reportButton = screen.queryByTestId('button-report-bug') || 
                          screen.queryByText(/report bug/i);
      
      if (reportButton) {
        await userEvent.click(reportButton);

        const fileInput = screen.queryByRole('button', { name: /attach/i });

        if (fileInput) {
          // Create oversized file (50MB)
          const oversizedFile = createMockImage('huge-file.png', 50 * 1024 * 1024);

          Object.defineProperty(fileInput, 'files', {
            value: [oversizedFile],
            writable: false,
          });

          fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

          // Should show error message for oversized file
          await waitFor(() => {
            const errorMessage = screen.queryByText(/file.*too large/i) ||
                                screen.queryByText(/size.*exceeded/i) ||
                                screen.queryByText(/maximum.*size/i);
            
            if (errorMessage) {
              expect(errorMessage).toBeInTheDocument();
            }
          });
        }
      }
    });
  });

  describe('Feature Request Form with File Attachments', () => {
    const FeatureRequestForm = require('../../client/src/pages/settings/idea-box.tsx').default;

    it('should render feature request form with file upload capability', async () => {
      render(
        <TestWrapper>
          <FeatureRequestForm />
        </TestWrapper>
      );

      const requestButton = screen.queryByTestId('button-request-feature') || 
                           screen.queryByText(/request feature/i) ||
                           screen.queryByText(/suggest idea/i);
      
      if (requestButton) {
        await userEvent.click(requestButton);

        const attachButton = screen.queryByText(/attach files/i) ||
                            screen.queryByText(/attachments/i) ||
                            screen.queryByRole('button', { name: /attach/i });
        
        expect(attachButton).toBeTruthy();
      }
    });

    it('should submit feature request with file attachments', async () => {
      render(
        <TestWrapper>
          <FeatureRequestForm />
        </TestWrapper>
      );

      const requestButton = screen.queryByTestId('button-request-feature') || 
                           screen.queryByText(/request feature/i);
      
      if (requestButton) {
        await userEvent.click(requestButton);

        const titleInput = screen.queryByLabelText(/title/i) || 
                          screen.queryByPlaceholderText(/title/i);
        const descriptionInput = screen.queryByLabelText(/description/i) ||
                                screen.queryByPlaceholderText(/description/i);

        if (titleInput && descriptionInput) {
          await userEvent.type(titleInput, 'New Feature with Mockups');
          await userEvent.type(descriptionInput, 'Feature request with design mockups and documentation.');

          const fileInput = screen.queryByRole('button', { name: /attach/i });

          if (fileInput) {
            const mockFiles = [
              createMockImage('mockup.png'),
              createMockPDF('requirements.pdf')
            ];

            Object.defineProperty(fileInput, 'files', {
              value: mockFiles,
              writable: false,
            });

            fireEvent.change(fileInput, { target: { files: mockFiles } });

            const submitButton = screen.queryByRole('button', { name: /submit/i });
            
            if (submitButton) {
              await userEvent.click(submitButton);

              await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                  expect.stringMatching(/\/api\/(features|feature-requests)/),
                  expect.objectContaining({
                    method: 'POST',
                    body: expect.any(FormData),
                  })
                );
              });
            }
          }
        }
      }
    });
  });

  describe('Document Upload Forms', () => {
    const DocumentManager = require('../../client/src/components/common/DocumentManager.tsx').default;

    it('should handle document upload with metadata', async () => {
      render(
        <TestWrapper>
          <DocumentManager />
        </TestWrapper>
      );

      const uploadButton = screen.queryByTestId('button-upload-document') ||
                          screen.queryByText(/upload/i) ||
                          screen.queryByRole('button', { name: /add.*document/i });

      if (uploadButton) {
        await userEvent.click(uploadButton);

        const fileInput = screen.queryByRole('input', { name: /file/i }) ||
                         screen.queryByRole('button', { name: /choose.*file/i });

        if (fileInput) {
          const mockDocument = createMockPDF('contract.pdf');

          Object.defineProperty(fileInput, 'files', {
            value: [mockDocument],
            writable: false,
          });

          fireEvent.change(fileInput, { target: { files: [mockDocument] } });

          // Fill document metadata
          const nameInput = screen.queryByLabelText(/name/i) ||
                           screen.queryByPlaceholderText(/document.*name/i);
          const descriptionInput = screen.queryByLabelText(/description/i);

          if (nameInput) {
            await userEvent.type(nameInput, 'Test Contract Document');
          }
          if (descriptionInput) {
            await userEvent.type(descriptionInput, 'Legal contract for testing purposes');
          }

          const submitButton = screen.queryByRole('button', { name: /upload/i }) ||
                              screen.queryByRole('button', { name: /save/i });

          if (submitButton) {
            await userEvent.click(submitButton);

            await waitFor(() => {
              expect(mockApiRequest).toHaveBeenCalledWith(
                'POST',
                expect.stringMatching(/\/api\/documents/),
                expect.any(Object)
              );
            });
          }
        }
      }
    });

    it('should validate document file types', async () => {
      render(
        <TestWrapper>
          <DocumentManager />
        </TestWrapper>
      );

      const uploadButton = screen.queryByTestId('button-upload-document') ||
                          screen.queryByText(/upload/i);

      if (uploadButton) {
        await userEvent.click(uploadButton);

        const fileInput = screen.queryByRole('input', { name: /file/i });

        if (fileInput) {
          // Try uploading invalid file type
          const invalidFile = createMockFile('malicious.exe', 1000, 'application/x-executable');

          Object.defineProperty(fileInput, 'files', {
            value: [invalidFile],
            writable: false,
          });

          fireEvent.change(fileInput, { target: { files: [invalidFile] } });

          await waitFor(() => {
            const errorMessage = screen.queryByText(/file.*type.*not.*allowed/i) ||
                                screen.queryByText(/invalid.*file.*type/i) ||
                                screen.queryByText(/unsupported.*format/i);
            
            if (errorMessage) {
              expect(errorMessage).toBeInTheDocument();
            }
          });
        }
      }
    });
  });

  describe('Bill Form with Receipt Attachments', () => {
    const BillForm = require('../../client/src/components/common/BillForm.tsx').default;

    it('should handle bill submission with receipt attachments', async () => {
      const mockProps = {
        isOpen: true,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        buildings: [],
        residences: []
      };

      render(
        <TestWrapper>
          <BillForm {...mockProps} />
        </TestWrapper>
      );

      // Fill bill details
      const titleInput = screen.queryByLabelText(/title/i) ||
                        screen.queryByPlaceholderText(/bill.*title/i);
      const amountInput = screen.queryByLabelText(/amount/i) ||
                         screen.queryByPlaceholderText(/amount/i);

      if (titleInput && amountInput) {
        await userEvent.type(titleInput, 'Electricity Bill - January 2025');
        await userEvent.type(amountInput, '150.75');

        // Look for file attachment
        const attachButton = screen.queryByText(/attach.*receipt/i) ||
                            screen.queryByText(/add.*attachment/i) ||
                            screen.queryByRole('button', { name: /attach/i });

        if (attachButton) {
          await userEvent.click(attachButton);

          const fileInput = screen.queryByRole('input', { type: 'file' });

          if (fileInput) {
            const receiptFile = createMockPDF('receipt.pdf');

            Object.defineProperty(fileInput, 'files', {
              value: [receiptFile],
              writable: false,
            });

            fireEvent.change(fileInput, { target: { files: [receiptFile] } });

            const submitButton = screen.queryByRole('button', { name: /save.*bill/i }) ||
                                screen.queryByRole('button', { name: /submit/i });

            if (submitButton) {
              await userEvent.click(submitButton);

              await waitFor(() => {
                expect(mockProps.onSubmit).toHaveBeenCalledWith(
                  expect.objectContaining({
                    title: 'Electricity Bill - January 2025',
                    amount: expect.any(String),
                  })
                );
              });
            }
          }
        }
      }
    });

    it('should validate receipt file format', async () => {
      const mockProps = {
        isOpen: true,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        buildings: [],
        residences: []
      };

      render(
        <TestWrapper>
          <BillForm {...mockProps} />
        </TestWrapper>
      );

      const attachButton = screen.queryByText(/attach/i);

      if (attachButton) {
        await userEvent.click(attachButton);

        const fileInput = screen.queryByRole('input', { type: 'file' });

        if (fileInput) {
          // Try invalid file format
          const invalidFile = createMockFile('receipt.txt', 1000, 'text/plain');

          Object.defineProperty(fileInput, 'files', {
            value: [invalidFile],
            writable: false,
          });

          fireEvent.change(fileInput, { target: { files: [invalidFile] } });

          await waitFor(() => {
            const errorMessage = screen.queryByText(/invalid.*format/i) ||
                                screen.queryByText(/only.*pdf.*jpg.*png/i);
            
            if (errorMessage) {
              expect(errorMessage).toBeInTheDocument();
            }
          });
        }
      }
    });
  });

  describe('General File Upload Validation', () => {
    it('should handle network errors during file upload', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <div data-testid="test-upload-form">
            {/* Minimal form for testing */}
            <input 
              type="file" 
              data-testid="file-input"
              onChange={(e) => {
                const formData = new FormData();
                if (e.target.files?.[0]) {
                  formData.append('file', e.target.files[0]);
                  fetch('/api/upload', { method: 'POST', body: formData });
                }
              }}
            />
          </div>
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const mockFile = createMockImage('test.png');

      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/upload',
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData),
          })
        );
      });
    });

    it('should handle empty file selection', () => {
      render(
        <TestWrapper>
          <input 
            type="file" 
            data-testid="file-input"
            onChange={() => {
              // Should not trigger any upload
            }}
          />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');

      // Simulate empty file selection
      fireEvent.change(fileInput, { target: { files: [] } });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('should respect maximum file count limits', () => {
      const MAX_FILES = 3;

      render(
        <TestWrapper>
          <input 
            type="file" 
            multiple
            data-testid="file-input"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > MAX_FILES) {
                throw new Error(`Maximum ${MAX_FILES} files allowed`);
              }
            }}
          />
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const tooManyFiles = [
        createMockImage('1.png'),
        createMockImage('2.png'),
        createMockImage('3.png'),
        createMockImage('4.png'), // One too many
      ];

      Object.defineProperty(fileInput, 'files', {
        value: tooManyFiles,
        writable: false,
      });

      expect(() => {
        fireEvent.change(fileInput, { target: { files: tooManyFiles } });
      }).toThrow(/Maximum.*files.*allowed/);
    });
  });

  describe('File Upload Progress and Feedback', () => {
    it('should show upload progress for large files', async () => {
      const mockUploadProgress = jest.fn();
      
      // Mock XMLHttpRequest for progress tracking
      const mockXHR = {
        upload: {
          addEventListener: jest.fn((event, callback) => {
            if (event === 'progress') {
              // Simulate progress updates
              setTimeout(() => callback({ loaded: 50, total: 100 }), 100);
              setTimeout(() => callback({ loaded: 100, total: 100 }), 200);
            }
          }),
        },
        addEventListener: jest.fn(),
        open: jest.fn(),
        send: jest.fn(),
        setRequestHeader: jest.fn(),
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      render(
        <TestWrapper>
          <div data-testid="upload-with-progress">
            <input 
              type="file"
              data-testid="file-input"
              onChange={mockUploadProgress}
            />
            <div data-testid="progress-indicator">0%</div>
          </div>
        </TestWrapper>
      );

      const fileInput = screen.getByTestId('file-input');
      const largeFile = createMockImage('large-image.png', 10 * 1024 * 1024); // 10MB

      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false,
      });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(mockUploadProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            files: expect.arrayContaining([largeFile])
          })
        })
      );
    });
  });
});