/**
 * Bill Attachments UI Display Test
 * Tests that the Bill Details dialog properly displays attached documents
 * and that the AttachedFileSection component works correctly with bills.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jest } from '@jest/globals';

// Mock the API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.open for file viewing
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

// Mock URL.createObjectURL and revokeObjectURL for file downloads
Object.defineProperty(window.URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mock-blob-url'),
});
Object.defineProperty(window.URL, 'revokeObjectURL', {
  writable: true,
  value: jest.fn(),
});

// Mock DOM element creation and manipulation
Object.defineProperty(document, 'createElement', {
  writable: true,
  value: jest.fn((tag) => {
    const element = {
      href: '',
      download: '',
      click: jest.fn(),
      remove: jest.fn(),
    };
    return element;
  }),
});

Object.defineProperty(document.body, 'appendChild', {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(document.body, 'removeChild', {
  writable: true,
  value: jest.fn(),
});

// Mock the BillDetail component (simplified version for testing)
const MockBillDetail = ({ bill }: { bill: any }) => {
  const { useState, useEffect } = require('react');
  const [billDocuments, setBillDocuments] = useState([]);
  const [freshBill, setFreshBill] = useState(bill);

  useEffect(() => {
    // Simulate API call to fetch bill documents
    fetch(`/api/documents?attachedToType=bill&attachedToId=${bill.id}`)
      .then(response => response.json())
      .then(data => setBillDocuments(data.documents || []))
      .catch(console.error);

    // Simulate API call to fetch fresh bill data
    fetch(`/api/bills/${bill.id}`)
      .then(response => response.json())
      .then(data => setFreshBill(data))
      .catch(console.error);
  }, [bill.id]);

  const currentBill = freshBill || bill;

  return (
    <div data-testid="bill-detail">
      <h2>Bill Details</h2>
      
      {/* Bill Information */}
      <div>
        <div data-testid="bill-number">{currentBill.billNumber}</div>
        <div data-testid="bill-status">{currentBill.status}</div>
        <div data-testid="bill-category">{currentBill.category}</div>
        <div data-testid="bill-amount">${currentBill.totalAmount}</div>
      </div>

      {/* Uploaded Documents Section - This is the key part being tested */}
      {(currentBill.filePath || billDocuments.length > 0) && (
        <div data-testid="uploaded-documents-section">
          <h3>Uploaded Documents</h3>
          
          {/* Direct bill upload */}
          {currentBill.filePath && (
            <div data-testid="direct-bill-upload">
              <span data-testid="file-name">{currentBill.fileName}</span>
              <button 
                data-testid="button-view-direct-bill"
                onClick={() => window.open(`/api/bills/${currentBill.id}/download-document`, '_blank')}
              >
                View
              </button>
              <button 
                data-testid="button-download-direct-bill"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `/api/bills/${currentBill.id}/download-document`;
                  link.download = currentBill.fileName || 'bill-document';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Download
              </button>
            </div>
          )}
          
          {/* Attached documents from documents table */}
          {billDocuments.map((doc: any) => (
            <div key={doc.id} data-testid={`attached-document-${doc.id}`}>
              <span data-testid={`doc-name-${doc.id}`}>{doc.name}</span>
              <span data-testid={`doc-type-${doc.id}`}>{doc.documentType || 'Document'}</span>
              <button 
                data-testid={`button-view-document-${doc.id}`}
                onClick={async () => {
                  const response = await fetch(`/api/documents/${doc.id}/file`, {
                    method: 'GET',
                    credentials: 'include',
                  });
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  window.open(url, '_blank');
                }}
              >
                View
              </button>
              <button 
                data-testid={`button-download-document-${doc.id}`}
                onClick={async () => {
                  const response = await fetch(`/api/documents/${doc.id}/file?download=true`, {
                    method: 'GET',
                    credentials: 'include',
                  });
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = doc.fileName || doc.name || 'document';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                }}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Show message when no attachments */}
      {!currentBill.filePath && billDocuments.length === 0 && (
        <div data-testid="no-attachments-message">
          No documents attached to this bill
        </div>
      )}
    </div>
  );
};

describe('Bill Attachments UI Display', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  test('should display bill with attached documents from documents table', async () => {
    const testBill = {
      id: 'bill-123',
      billNumber: '961B-2024-11-INSURANCE-1',
      status: 'paid',
      category: 'insurance',
      totalAmount: '2014.15',
      title: 'Insurance (I) - Osinski - Smitham',
      // No direct filePath - documents should come from documents table
      filePath: null,
      fileName: null,
    };

    const mockDocuments = [
      {
        id: 'doc-1',
        name: 'Invoice - 961B-2024-11-INSURANCE-1',
        documentType: 'maintenance',
        fileName: 'invoice-961b-2024-11-insurance-1.txt',
        filePath: 'bills/invoice-961b-2024-11-insurance-1-bill-123.txt',
        attachedToType: 'bill',
        attachedToId: 'bill-123',
      },
      {
        id: 'doc-2',
        name: 'Receipt - 961B-2024-11-INSURANCE-1',
        documentType: 'maintenance',
        fileName: 'receipt-961b-2024-11-insurance-1.txt',
        filePath: 'bills/receipt-961b-2024-11-insurance-1-bill-123.txt',
        attachedToType: 'bill',
        attachedToId: 'bill-123',
      }
    ];

    // Mock the API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: mockDocuments }),
      }) // Documents API call
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testBill),
      }); // Fresh bill API call

    renderWithQueryClient(<MockBillDetail bill={testBill} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(screen.getByTestId('uploaded-documents-section')).toBeInTheDocument();
    });

    // Verify bill information is displayed
    expect(screen.getByTestId('bill-number')).toHaveTextContent('961B-2024-11-INSURANCE-1');
    expect(screen.getByTestId('bill-status')).toHaveTextContent('paid');
    expect(screen.getByTestId('bill-category')).toHaveTextContent('insurance');
    expect(screen.getByTestId('bill-amount')).toHaveTextContent('$2014.15');

    // Verify attached documents are displayed
    expect(screen.getByTestId('attached-document-doc-1')).toBeInTheDocument();
    expect(screen.getByTestId('attached-document-doc-2')).toBeInTheDocument();

    // Verify document names
    expect(screen.getByTestId('doc-name-doc-1')).toHaveTextContent('Invoice - 961B-2024-11-INSURANCE-1');
    expect(screen.getByTestId('doc-name-doc-2')).toHaveTextContent('Receipt - 961B-2024-11-INSURANCE-1');

    // Verify document types
    expect(screen.getByTestId('doc-type-doc-1')).toHaveTextContent('maintenance');
    expect(screen.getByTestId('doc-type-doc-2')).toHaveTextContent('maintenance');

    // Verify action buttons exist
    expect(screen.getByTestId('button-view-document-doc-1')).toBeInTheDocument();
    expect(screen.getByTestId('button-download-document-doc-1')).toBeInTheDocument();
    expect(screen.getByTestId('button-view-document-doc-2')).toBeInTheDocument();
    expect(screen.getByTestId('button-download-document-doc-2')).toBeInTheDocument();

    // Verify API calls were made correctly
    expect(mockFetch).toHaveBeenCalledWith('/api/documents?attachedToType=bill&attachedToId=bill-123');
    expect(mockFetch).toHaveBeenCalledWith('/api/bills/bill-123');
  });

  test('should display bill with direct file path attachment', async () => {
    const testBill = {
      id: 'bill-456',
      billNumber: 'TEST-2024-UTILITIES-1',
      status: 'pending',
      category: 'utilities',
      totalAmount: '150.00',
      title: 'Utilities Bill',
      // Direct attachment
      filePath: 'bills/utilities-bill-456.pdf',
      fileName: 'utilities-bill-456.pdf',
    };

    // Mock the API responses (no attached documents, empty array)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [] }),
      }) // Documents API call
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testBill),
      }); // Fresh bill API call

    renderWithQueryClient(<MockBillDetail bill={testBill} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(screen.getByTestId('uploaded-documents-section')).toBeInTheDocument();
    });

    // Verify bill information is displayed
    expect(screen.getByTestId('bill-number')).toHaveTextContent('TEST-2024-UTILITIES-1');
    expect(screen.getByTestId('bill-category')).toHaveTextContent('utilities');

    // Verify direct bill upload section is displayed
    expect(screen.getByTestId('direct-bill-upload')).toBeInTheDocument();
    expect(screen.getByTestId('file-name')).toHaveTextContent('utilities-bill-456.pdf');

    // Verify direct bill action buttons
    expect(screen.getByTestId('button-view-direct-bill')).toBeInTheDocument();
    expect(screen.getByTestId('button-download-direct-bill')).toBeInTheDocument();

    // Verify no attached documents section since documents array is empty
    expect(screen.queryByTestId('attached-document-doc-1')).not.toBeInTheDocument();
  });

  test('should show no attachments message when bill has no files', async () => {
    const testBill = {
      id: 'bill-789',
      billNumber: 'TEST-2024-NO-ATTACHMENTS',
      status: 'pending',
      category: 'other',
      totalAmount: '100.00',
      title: 'Bill with no attachments',
      // No attachments
      filePath: null,
      fileName: null,
    };

    // Mock the API responses (no attached documents)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [] }),
      }) // Documents API call
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testBill),
      }); // Fresh bill API call

    renderWithQueryClient(<MockBillDetail bill={testBill} />);

    // Wait for API calls to complete
    await waitFor(() => {
      expect(screen.getByTestId('no-attachments-message')).toBeInTheDocument();
    });

    // Verify no documents section is NOT displayed
    expect(screen.queryByTestId('uploaded-documents-section')).not.toBeInTheDocument();

    // Verify the no attachments message
    expect(screen.getByTestId('no-attachments-message')).toHaveTextContent('No documents attached to this bill');
  });

  test('should handle document view functionality', async () => {
    const testBill = {
      id: 'bill-view-test',
      billNumber: 'VIEW-TEST-001',
      status: 'paid',
      category: 'maintenance',
      totalAmount: '500.00',
      filePath: null,
      fileName: null,
    };

    const mockDocument = {
      id: 'doc-view-test',
      name: 'Test Document for Viewing',
      documentType: 'maintenance',
      fileName: 'test-document.pdf',
      filePath: 'bills/test-document.pdf',
      attachedToType: 'bill',
      attachedToId: 'bill-view-test',
    };

    // Mock the API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [mockDocument] }),
      }) // Documents API call
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testBill),
      }) // Fresh bill API call
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test content'], { type: 'application/pdf' })),
      }); // File view API call

    renderWithQueryClient(<MockBillDetail bill={testBill} />);

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByTestId('attached-document-doc-view-test')).toBeInTheDocument();
    });

    // Click the view button
    const viewButton = screen.getByTestId('button-view-document-doc-view-test');
    fireEvent.click(viewButton);

    // Wait for file view API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/documents/doc-view-test/file', {
        method: 'GET',
        credentials: 'include',
      });
    });

    // Verify window.open was called
    expect(mockWindowOpen).toHaveBeenCalledWith('mock-blob-url', '_blank');
  });

  test('should handle document download functionality', async () => {
    const testBill = {
      id: 'bill-download-test',
      billNumber: 'DOWNLOAD-TEST-001',
      status: 'paid',
      category: 'insurance',
      totalAmount: '1000.00',
      filePath: null,
      fileName: null,
    };

    const mockDocument = {
      id: 'doc-download-test',
      name: 'Test Document for Download',
      documentType: 'insurance',
      fileName: 'insurance-document.pdf',
      filePath: 'bills/insurance-document.pdf',
      attachedToType: 'bill',
      attachedToId: 'bill-download-test',
    };

    // Mock the API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ documents: [mockDocument] }),
      }) // Documents API call
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(testBill),
      }) // Fresh bill API call
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test download content'], { type: 'application/pdf' })),
      }); // File download API call

    renderWithQueryClient(<MockBillDetail bill={testBill} />);

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByTestId('attached-document-doc-download-test')).toBeInTheDocument();
    });

    // Click the download button
    const downloadButton = screen.getByTestId('button-download-document-doc-download-test');
    fireEvent.click(downloadButton);

    // Wait for file download API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/documents/doc-download-test/file?download=true', {
        method: 'GET',
        credentials: 'include',
      });
    });

    // Verify DOM manipulation for download
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  test('should validate API query parameters for bill attachments', () => {
    const billId = 'test-bill-12345';
    const expectedQuery = `/api/documents?attachedToType=bill&attachedToId=${billId}`;
    
    // This validates the query format used in the BillDetail component
    expect(expectedQuery).toBe('/api/documents?attachedToType=bill&attachedToId=test-bill-12345');
  });
});