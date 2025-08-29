import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import React from 'react';

// Components to test
import ResidenceDocuments from '../../client/src/pages/residents/ResidenceDocuments';
import BuildingDocuments from '../../client/src/pages/residents/BuildingDocuments';
import ManagerBuildingDocuments from '../../client/src/pages/manager/BuildingDocuments';
import ManagerResidenceDocuments from '../../client/src/pages/manager/ResidenceDocuments';

// Mock API requests
const mockApiRequest = jest.fn();
jest.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  queryClient: {
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  },
}));

// Mock hooks
const mockUseAuth = jest.fn();
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock wouter navigation
const mockNavigate = jest.fn();
jest.mock('wouter', () => ({
  useLocation: () => ['/', mockNavigate],
  Router: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Demo test data
const demoTenantUser = {
  id: 'tenant-demo-123',
  email: 'tenant@demo.com',
  firstName: 'Demo',
  lastName: 'Tenant',
  role: 'tenant',
};

const demoManagerUser = {
  id: 'manager-demo-456',
  email: 'manager@demo.com',
  firstName: 'Demo',
  lastName: 'Manager',
  role: 'manager',
};

const demoBuildingData = {
  id: 'building-demo-789',
  name: 'Demo Building',
  address: '123 Test Street',
  city: 'Demo City',
  province: 'QC',
  organizationId: 'org-demo-123',
};

const demoResidenceData = {
  id: 'residence-demo-101',
  unitNumber: '101',
  buildingId: 'building-demo-789',
  bedrooms: 2,
  bathrooms: 1,
  squareFootage: 850,
};

const demoBuildingDocuments = [
  {
    id: 'doc-building-1',
    name: 'Building Rules and Regulations',
    type: 'policies',
    uploadDate: '2024-01-15T10:00:00Z',
    fileName: 'building-rules.pdf',
    fileUrl: 'https://demo-storage/building-rules.pdf',
    fileSize: '2.5 MB',
    mimeType: 'application/pdf',
    uploadedBy: 'manager-demo-456',
    isVisibleToTenants: true,
    documentCategory: 'policies',
    entityType: 'building',
    entityId: 'building-demo-789',
  },
  {
    id: 'doc-building-2',
    name: 'Building Financial Report',
    type: 'financial',
    uploadDate: '2024-02-01T14:30:00Z',
    fileName: 'financial-report-2024.pdf',
    fileUrl: 'https://demo-storage/financial-report.pdf',
    fileSize: '1.2 MB',
    mimeType: 'application/pdf',
    uploadedBy: 'manager-demo-456',
    isVisibleToTenants: false,
    documentCategory: 'financial',
    entityType: 'building',
    entityId: 'building-demo-789',
  },
];

const demoResidenceDocuments = [
  {
    id: 'doc-residence-1',
    name: 'Lease Agreement',
    type: 'lease',
    uploadDate: '2024-01-10T09:00:00Z',
    fileName: 'lease-agreement-101.pdf',
    fileUrl: 'https://demo-storage/lease-101.pdf',
    fileSize: '3.1 MB',
    mimeType: 'application/pdf',
    uploadedBy: 'manager-demo-456',
    isVisibleToTenants: true,
    documentCategory: 'lease',
    entityType: 'residence',
    entityId: 'residence-demo-101',
  },
  {
    id: 'doc-residence-2',
    name: 'Maintenance History',
    type: 'maintenance',
    uploadDate: '2024-02-15T11:15:00Z',
    fileName: 'maintenance-log-101.pdf',
    fileUrl: 'https://demo-storage/maintenance-101.pdf',
    fileSize: '0.8 MB',
    mimeType: 'application/pdf',
    uploadedBy: 'manager-demo-456',
    isVisibleToTenants: false,
    documentCategory: 'maintenance',
    entityType: 'residence',
    entityId: 'residence-demo-101',
  },
];

// Import providers
import { LanguageProvider } from '../../client/src/hooks/use-language';
import { AuthProvider } from '../../client/src/hooks/use-auth';
import { MobileMenuProvider } from '../../client/src/hooks/use-mobile-menu';

// Test providers wrapper
function TestProviders({
  children,
  userRole = 'tenant',
}: {
  children: React.ReactNode;
  userRole?: 'tenant' | 'manager';
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MobileMenuProvider>
          <Router>
            <AuthProvider>{children}</AuthProvider>
          </Router>
        </MobileMenuProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('Document Management - Comprehensive Testing with Demo Users', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.confirm for delete operations
    global.confirm = jest.fn(() => true);

    // Mock window.open for downloads
    global.open = jest.fn();

    // Mock URL search params
    delete (window as any).location;
    window.location = {
      search: '?residenceId=residence-demo-101',
      pathname: '/residents/residence/documents',
    } as any;

    // Set default auth mock
    mockUseAuth.mockReturnValue({
      user: demoTenantUser,
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tenant User - Residents Residence Documents Page', () => {
    it('should display only tenant-visible documents for demo tenant user', async () => {
      // Set tenant user
      mockUseAuth.mockReturnValue({
        user: demoTenantUser,
        isLoading: false,
      });

      // Mock API calls
      mockApiRequest
        .mockResolvedValueOnce(demoTenantUser) // auth/user
        .mockResolvedValueOnce(demoResidenceData) // residence data
        .mockResolvedValueOnce({ documents: demoResidenceDocuments }); // documents

      render(
        <TestProviders userRole='tenant'>
          <ResidenceDocuments />
        </TestProviders>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('text-documents-title')).toBeInTheDocument();
      });

      // Should show only documents visible to tenants
      expect(screen.getByText('Lease Agreement')).toBeInTheDocument();
      expect(screen.queryByText('Maintenance History')).not.toBeInTheDocument();

      // Should display correct subtitle for tenants
      expect(screen.getByText('Documents available to tenants')).toBeInTheDocument();

      // Should not show Add Document button for tenants
      expect(screen.queryByTestId('button-add-document')).not.toBeInTheDocument();
    });

    it('should allow tenant to download visible documents', async () => {
      // Set tenant user
      mockUseAuth.mockReturnValue({
        user: demoTenantUser,
        isLoading: false,
      });

      mockApiRequest
        .mockResolvedValueOnce(demoTenantUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ documents: demoResidenceDocuments });

      render(
        <TestProviders userRole='tenant'>
          <ResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Lease Agreement')).toBeInTheDocument();
      });

      // Click download button
      const downloadButton = screen.getByTestId('button-download-doc-residence-1');
      await user.click(downloadButton);

      // Should open document URL
      expect(global.open).toHaveBeenCalledWith('https://demo-storage/lease-101.pdf', '_blank');
    });

    it('should show appropriate message when no documents are available to tenants', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoTenantUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ documents: [] });

      render(
        <TestProviders userRole='tenant'>
          <ResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('No Documents Found')).toBeInTheDocument();
      });

      expect(
        screen.getByText('No documents are currently available to tenants for this residence.')
      ).toBeInTheDocument();
    });
  });

  describe('Tenant User - Residents Building Documents Page', () => {
    it('should display building documents visible to tenants', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoTenantUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments });

      render(
        <TestProviders userRole='tenant'>
          <BuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Building Rules and Regulations')).toBeInTheDocument();
      });

      // Should show only tenant-visible documents
      expect(screen.getByText('Building Rules and Regulations')).toBeInTheDocument();
      expect(screen.queryByText('Building Financial Report')).not.toBeInTheDocument();
    });

    it('should allow filtering documents by category', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoTenantUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments });

      render(
        <TestProviders userRole='tenant'>
          <BuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('select-document-category')).toBeInTheDocument();
      });

      // Test category filtering
      const categorySelect = screen.getByTestId('select-document-category');
      await user.selectOptions(categorySelect, 'policies');

      // Should still show the document since it matches the filter
      expect(screen.getByText('Building Rules and Regulations')).toBeInTheDocument();
    });

    it('should allow searching documents by name', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoTenantUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments });

      render(
        <TestProviders userRole='tenant'>
          <BuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('input-search-documents')).toBeInTheDocument();
      });

      // Test search functionality
      const searchInput = screen.getByTestId('input-search-documents');
      await user.type(searchInput, 'Rules');

      // Should show matching document
      expect(screen.getByText('Building Rules and Regulations')).toBeInTheDocument();
    });
  });

  describe('Manager User - Manager Building Documents Page', () => {
    it('should display all documents for manager with full controls', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments });

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('text-documents-title')).toBeInTheDocument();
      });

      // Should show all documents including manager-only ones
      expect(screen.getByText('Building Rules and Regulations')).toBeInTheDocument();
      expect(screen.getByText('Building Financial Report')).toBeInTheDocument();

      // Should show Add Document button for managers
      expect(screen.getByTestId('button-add-document')).toBeInTheDocument();

      // Should show edit and delete buttons
      expect(screen.getByTestId('button-edit-doc-building-1')).toBeInTheDocument();
      expect(screen.getByTestId('button-delete-doc-building-1')).toBeInTheDocument();
    });

    it('should allow manager to create new document', async () => {
      const newDocument = {
        id: 'doc-new-123',
        name: 'New Building Policy',
        type: 'policies',
        uploadDate: '2024-03-01T10:00:00Z',
        isVisibleToTenants: true,
        documentCategory: 'policies',
        entityType: 'building',
        entityId: 'building-demo-789',
      };

      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments })
        .mockResolvedValueOnce(newDocument); // Create document response

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      // Fill out the form
      await user.type(screen.getByTestId('input-document-name'), 'New Building Policy');
      await user.selectOptions(screen.getByTestId('select-document-type'), 'policies');
      await user.type(
        screen.getByTestId('textarea-document-description'),
        'New policy document for the building'
      );
      await user.click(screen.getByTestId('checkbox-visible-to-tenants'));

      // Submit the form
      await user.click(screen.getByTestId('button-submit-document'));

      // Verify API call was made
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/documents', {
          name: 'New Building Policy',
          type: 'policies',
          description: 'New policy document for the building',
          isVisibleToTenants: true,
          documentType: 'building',
          buildingId: 'building-demo-789',
          uploadedBy: 'manager-demo-456',
        });
      });
    });

    it('should allow manager to upload file with document', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments })
        .mockResolvedValueOnce({ id: 'doc-new-123' })
        .mockResolvedValueOnce({}); // File upload response

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      // Create a mock file
      const file = new File(['test content'], 'test-policy.pdf', { type: 'application/pdf' });

      // Fill out the form
      await user.type(screen.getByTestId('input-document-name'), 'Test Policy Document');
      await user.selectOptions(screen.getByTestId('select-document-type'), 'policies');
      await user.upload(screen.getByTestId('input-file-upload'), file);

      // Submit the form
      await user.click(screen.getByTestId('button-submit-document'));

      // Verify document creation and file upload API calls
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/documents', expect.any(Object));
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/documents/doc-new-123/upload',
          expect.any(FormData)
        );
      });
    });

    it('should allow manager to edit document', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments })
        .mockResolvedValueOnce({ ...demoBuildingDocuments[0], name: 'Updated Building Rules' });

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-edit-doc-building-1')).toBeInTheDocument();
      });

      // Click edit button
      await user.click(screen.getByTestId('button-edit-doc-building-1'));

      // Modify the document name
      const nameInput = screen.getByTestId('input-edit-document-name');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Building Rules');

      // Change visibility
      await user.click(screen.getByTestId('checkbox-edit-visible-to-tenants'));

      // Submit the changes
      await user.click(screen.getByTestId('button-update-document'));

      // Verify API call was made
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('PUT', '/api/documents/doc-building-1', {
          name: 'Updated Building Rules',
          type: 'policies',
          isVisibleToTenants: false,
        });
      });
    });

    it('should allow manager to delete document', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments })
        .mockResolvedValueOnce({}); // Delete response

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-delete-doc-building-1')).toBeInTheDocument();
      });

      // Click delete button
      await user.click(screen.getByTestId('button-delete-doc-building-1'));

      // Verify confirmation dialog and API call
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete this document?'
        );
        expect(mockApiRequest).toHaveBeenCalledWith(
          'DELETE',
          '/api/documents/doc-building-1?type=building'
        );
      });
    });
  });

  describe('Manager User - Manager Residence Documents Page', () => {
    it('should display residence documents with full management controls', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoResidenceDocuments });

      // Mock URL params for residence ID
      window.location = {
        search: '?residenceId=residence-demo-101',
        pathname: '/manager/residences/documents',
      } as any;

      render(
        <TestProviders userRole='manager'>
          <ManagerResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Unit 101 Documents')).toBeInTheDocument();
      });

      // Should show all documents including private ones
      expect(screen.getByText('Lease Agreement')).toBeInTheDocument();
      expect(screen.getByText('Maintenance History')).toBeInTheDocument();

      // Should show management controls
      expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      expect(screen.getByTestId('button-edit-doc-residence-1')).toBeInTheDocument();
      expect(screen.getByTestId('button-delete-doc-residence-1')).toBeInTheDocument();
    });

    it('should show building context information', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoResidenceDocuments });

      render(
        <TestProviders userRole='manager'>
          <ManagerResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Unit 101')).toBeInTheDocument();
      });

      // Should show building information
      expect(screen.getByText('Demo Building')).toBeInTheDocument();
      expect(screen.getByText('123 Test Street, Demo City, QC')).toBeInTheDocument();
      expect(screen.getByText('2 bedrooms • 1 bathrooms • 850 sq ft')).toBeInTheDocument();
    });

    it('should allow manager to create residence-specific document', async () => {
      const newResidenceDocument = {
        id: 'doc-residence-new',
        name: 'Move-in Inspection',
        type: 'inspection',
        isVisibleToTenants: true,
      };

      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoResidenceDocuments })
        .mockResolvedValueOnce(newResidenceDocument);

      render(
        <TestProviders userRole='manager'>
          <ManagerResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      // Fill out the form
      await user.type(screen.getByTestId('input-document-name'), 'Move-in Inspection');
      await user.selectOptions(screen.getByTestId('select-document-type'), 'inspection');
      await user.click(screen.getByTestId('checkbox-visible-to-tenants'));

      // Submit the form
      await user.click(screen.getByTestId('button-submit-document'));

      // Verify API call was made with residence-specific data
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/documents', {
          name: 'Move-in Inspection',
          type: 'inspection',
          isVisibleToTenants: true,
          documentType: 'resident',
          residenceId: 'residence-demo-101',
          uploadedBy: 'manager-demo-456',
        });
      });
    });

    it('should navigate back to residences list', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoResidenceDocuments });

      render(
        <TestProviders userRole='manager'>
          <ManagerResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-back')).toBeInTheDocument();
      });

      // Click back button
      await user.click(screen.getByTestId('button-back'));

      // Verify navigation was called
      expect(mockNavigate).toHaveBeenCalledWith('/manager/residences');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestProviders userRole='tenant'>
          <ResidenceDocuments />
        </TestProviders>
      );

      // Should still render the component without crashing
      await waitFor(() => {
        expect(screen.getByText('Loading documents...')).toBeInTheDocument();
      });
    });

    it('should handle missing residence ID', async () => {
      // Clear URL params
      window.location = {
        search: '',
        pathname: '/manager/residences/documents',
      } as any;

      render(
        <TestProviders userRole='manager'>
          <ManagerResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByText('Residence ID Required')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Please provide a residence ID to view documents.')
      ).toBeInTheDocument();
    });

    it('should validate required fields in document creation', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments });

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      // Try to submit without filling required fields
      await user.click(screen.getByTestId('button-submit-document'));

      // Should not make API call due to validation
      expect(mockApiRequest).not.toHaveBeenCalledWith('POST', '/api/documents', expect.any(Object));
    });

    it('should handle file upload errors', async () => {
      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments })
        .mockResolvedValueOnce({ id: 'doc-new-123' })
        .mockRejectedValueOnce(new Error('File upload failed'));

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      // Fill out the form
      await user.type(screen.getByTestId('input-document-name'), 'Test Document');
      await user.selectOptions(screen.getByTestId('select-document-type'), 'policies');
      await user.upload(screen.getByTestId('input-file-upload'), file);

      // Submit the form
      await user.click(screen.getByTestId('button-submit-document'));

      // Should handle the upload error gracefully
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/documents', expect.any(Object));
        expect(mockApiRequest).toHaveBeenCalledWith(
          'POST',
          '/api/documents/doc-new-123/upload',
          expect.any(FormData)
        );
      });
    });
  });

  describe('Document Categories and Types', () => {
    it('should support all building document categories', async () => {
      const buildingCategories = [
        'policies',
        'financial',
        'legal',
        'maintenance',
        'insurance',
        'meeting_minutes',
        'notices',
        'other',
      ];

      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoBuildingDocuments });

      render(
        <TestProviders userRole='manager'>
          <ManagerBuildingDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      const typeSelect = screen.getByTestId('select-document-type');

      // Check that all categories are available
      for (const category of buildingCategories) {
        expect(screen.getByRole('option', { name: new RegExp(category, 'i') })).toBeInTheDocument();
      }
    });

    it('should support all residence document categories', async () => {
      const residenceCategories = [
        'lease',
        'inspection',
        'maintenance',
        'legal',
        'insurance',
        'financial',
        'communication',
        'photos',
        'other',
      ];

      mockApiRequest
        .mockResolvedValueOnce(demoManagerUser)
        .mockResolvedValueOnce(demoResidenceData)
        .mockResolvedValueOnce({ buildings: [demoBuildingData] })
        .mockResolvedValueOnce({ documents: demoResidenceDocuments });

      render(
        <TestProviders userRole='manager'>
          <ManagerResidenceDocuments />
        </TestProviders>
      );

      await waitFor(() => {
        expect(screen.getByTestId('button-add-document')).toBeInTheDocument();
      });

      // Click Add Document button
      await user.click(screen.getByTestId('button-add-document'));

      // Check that all categories are available
      for (const category of residenceCategories) {
        expect(screen.getByRole('option', { name: new RegExp(category, 'i') })).toBeInTheDocument();
      }
    });
  });
});
