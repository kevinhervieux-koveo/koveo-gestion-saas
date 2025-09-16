/**
 * Integration Tests for Hierarchical Storage System
 *
 * Tests the complete hierarchical storage system including:
 * - Document upload with correct directory structure
 * - File retrieval through hierarchical paths
 * - Cross-component integration (upload config + storage + file resolver)
 * - End-to-end workflow from upload to download
 * - Migration compatibility and backward compatibility
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { 
  generateStorageDirectory,
  mapLegacyDocumentType,
  normalizeUserRole,
  validateUploadContext,
  type UploadContext
} from '../../shared/config/upload-config';

// Mock file system for testing
const mockFs = {
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  },
  existsSync: jest.fn(),
  createWriteStream: jest.fn(),
  createReadStream: jest.fn()
};

// Mock database for testing
const mockDb = {
  execute: jest.fn(),
  query: jest.fn(),
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

// Mock storage service
const mockStorage = {
  createDocument: jest.fn(),
  getDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getUserDocuments: jest.fn(),
  moveToQuarantine: jest.fn(),
  restoreFromQuarantine: jest.fn()
};

// Test users with different roles and contexts
const testUsers = {
  admin: {
    id: 'admin-user-123',
    role: 'admin',
    email: 'admin@test.com',
    organizationId: 'org-123'
  },
  manager: {
    id: 'manager-user-123',
    role: 'manager',
    email: 'manager@test.com',
    organizationId: 'org-123'
  },
  demoManager: {
    id: 'demo-manager-123',
    role: 'demo_manager',
    email: 'demo.manager@test.com',
    organizationId: 'org-demo'
  },
  resident: {
    id: 'resident-user-123',
    role: 'resident',
    email: 'resident@test.com',
    organizationId: 'org-123',
    buildingId: 'building-456',
    residenceId: 'residence-789'
  },
  tenant: {
    id: 'tenant-user-123',
    role: 'tenant',
    email: 'tenant@test.com',
    organizationId: 'org-123',
    buildingId: 'building-456',
    residenceId: 'residence-789'
  }
};

// Test file data
const testFile = {
  originalname: 'test-document.pdf',
  mimetype: 'application/pdf',
  size: 1024 * 1024, // 1MB
  buffer: Buffer.from('PDF test content'),
  filename: 'test-document-123.pdf'
};

// Helper function to simulate document upload
const simulateDocumentUpload = async (user: any, uploadType: string, file: any, additionalContext: any = {}) => {
  const context: UploadContext = {
    type: uploadType as any,
    organizationId: user.organizationId,
    buildingId: user.buildingId,
    residenceId: user.residenceId,
    userRole: user.role,
    userId: user.id,
    ...additionalContext
  };

  // Validate upload context
  const isValid = validateUploadContext(context, user.role);
  if (!isValid) {
    throw new Error('Upload context validation failed');
  }

  // Generate storage directory
  const storageDir = generateStorageDirectory(context);
  
  // Create full file path
  const fileName = `${Date.now()}-${file.originalname}`;
  const filePath = path.join(storageDir, fileName);

  // Simulate file system operations
  await mockFs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await mockFs.promises.writeFile(filePath, file.buffer);

  // Create document record
  const document = {
    id: `doc-${Date.now()}`,
    name: file.originalname,
    filePath: filePath,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedById: user.id,
    uploadedAt: new Date(),
    documentType: mapLegacyDocumentType(uploadType),
    organizationId: user.organizationId,
    buildingId: user.buildingId,
    residenceId: user.residenceId,
    isQuarantined: false,
    isVisibleToTenants: true
  };

  await mockStorage.createDocument(document);
  return document;
};

// Helper function to simulate file retrieval
const simulateFileRetrieval = async (user: any, documentId: string) => {
  const document = await mockStorage.getDocument(documentId);
  if (!document) {
    throw new Error('Document not found');
  }

  // Check quarantine status
  if (document.isQuarantined || document.filePath.includes('_quarantine_')) {
    throw new Error('Document quarantined');
  }

  // Check access permissions (simplified ACL)
  const hasAccess = checkUserDocumentAccess(user, document);
  if (!hasAccess) {
    throw new Error('Access denied');
  }

  // Check file existence
  const fullFilePath = path.join(process.cwd(), 'uploads', document.filePath);
  const fileExists = mockFs.existsSync(fullFilePath);
  if (!fileExists) {
    throw new Error('File not found on disk');
  }

  // Return file content
  const fileContent = await mockFs.promises.readFile(fullFilePath);
  return {
    document,
    fileContent,
    filePath: fullFilePath
  };
};

// Simplified ACL check
const checkUserDocumentAccess = (user: any, document: any): boolean => {
  const normalizedRole = normalizeUserRole(user.role);

  // Admin access
  if (normalizedRole === 'admin') return true;

  // Manager access to organization documents
  if (normalizedRole === 'manager') {
    return document.organizationId === user.organizationId;
  }

  // Resident access to their building/residence documents
  if (normalizedRole === 'resident') {
    return document.organizationId === user.organizationId &&
           (document.buildingId === user.buildingId || document.residenceId === user.residenceId);
  }

  // Tenant access to visible documents in their residence
  if (normalizedRole === 'tenant') {
    return document.isVisibleToTenants &&
           document.organizationId === user.organizationId &&
           (document.buildingId === user.buildingId || document.residenceId === user.residenceId);
  }

  return false;
};

describe('Hierarchical Storage System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockFs.promises.mkdir.mockResolvedValue(undefined);
    mockFs.promises.writeFile.mockResolvedValue(undefined);
    mockFs.promises.readFile.mockResolvedValue(Buffer.from('test file content'));
    mockFs.existsSync.mockReturnValue(true);

    mockStorage.createDocument.mockImplementation(async (doc) => ({ ...doc, id: `doc-${Date.now()}` }));
    mockStorage.getDocument.mockImplementation(async (id) => ({
      id,
      name: 'test-document.pdf',
      filePath: 'documents/org_org-123/building_building-456/residence_residence-789/role_tenant/user_tenant-user-123/test-document.pdf',
      uploadedById: 'tenant-user-123',
      organizationId: 'org-123',
      buildingId: 'building-456',
      residenceId: 'residence-789',
      isQuarantined: false,
      isVisibleToTenants: true
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('End-to-End Document Upload and Retrieval', () => {
    it('should handle complete document upload workflow for tenant', async () => {
      const user = testUsers.tenant;
      
      // Upload document
      const uploadedDoc = await simulateDocumentUpload(user, 'documents', testFile);
      
      // Verify storage directory structure
      expect(uploadedDoc.filePath).toMatch(/^documents\/org_org-123\/building_building-456\/residence_residence-789\/role_tenant\/user_tenant-user-123\//);
      
      // Verify document was created
      expect(mockStorage.createDocument).toHaveBeenCalledWith(expect.objectContaining({
        name: testFile.originalname,
        uploadedById: user.id,
        organizationId: user.organizationId,
        buildingId: user.buildingId,
        residenceId: user.residenceId
      }));

      // Retrieve document
      const retrievedFile = await simulateFileRetrieval(user, uploadedDoc.id);
      
      expect(retrievedFile.document.id).toBe(uploadedDoc.id);
      expect(retrievedFile.fileContent).toBeDefined();
    });

    it('should handle complete document upload workflow for manager', async () => {
      const user = testUsers.manager;
      
      // Upload document at building level
      const uploadedDoc = await simulateDocumentUpload(user, 'buildings', testFile, {
        buildingId: 'building-456'
      });
      
      // Verify storage directory structure (no user directory for manager)
      expect(uploadedDoc.filePath).toMatch(/^buildings\/org_org-123\/building_building-456\/role_manager\//);
      expect(uploadedDoc.filePath).not.toMatch(/user_/); // No user directory for manager
      
      // Manager should be able to retrieve their uploaded document
      const retrievedFile = await simulateFileRetrieval(user, uploadedDoc.id);
      expect(retrievedFile.document.id).toBe(uploadedDoc.id);
    });

    it('should handle complete document upload workflow for demo manager', async () => {
      const user = testUsers.demoManager;
      
      // Upload document
      const uploadedDoc = await simulateDocumentUpload(user, 'documents', testFile);
      
      // Verify role normalization in storage path
      expect(uploadedDoc.filePath).toMatch(/role_manager/); // demo_manager → manager
      expect(uploadedDoc.filePath).not.toMatch(/role_demo_manager/);
      
      // Verify document type mapping
      expect(uploadedDoc.documentType).toBe('documents'); // Should be mapped correctly
    });

    it('should handle resident uploading to their residence', async () => {
      const user = testUsers.resident;
      
      // Upload document
      const uploadedDoc = await simulateDocumentUpload(user, 'residences', testFile);
      
      // Verify storage directory structure includes user directory for resident
      expect(uploadedDoc.filePath).toMatch(/^residences\/org_org-123\/building_building-456\/residence_residence-789\/role_resident\/user_resident-user-123\//);
      
      // Resident should be able to retrieve their own document
      const retrievedFile = await simulateFileRetrieval(user, uploadedDoc.id);
      expect(retrievedFile.document.id).toBe(uploadedDoc.id);
    });
  });

  describe('Legacy Document Type Mapping Integration', () => {
    it('should map legacy document types during upload', async () => {
      const user = testUsers.manager;
      const legacyTypes = ['contracts', 'financial', 'insurance', 'legal', 'meeting_minutes'];
      
      for (const legacyType of legacyTypes) {
        const uploadedDoc = await simulateDocumentUpload(user, legacyType, testFile);
        
        // Should be mapped to 'documents' type
        expect(uploadedDoc.documentType).toBe('documents');
        
        // Storage directory should use mapped type
        expect(uploadedDoc.filePath).toMatch(/^documents\//);
      }
    });

    it('should preserve allowed document types', async () => {
      const user = testUsers.manager;
      const allowedTypes = ['bills', 'buildings', 'residences', 'bugs', 'features', 'documents', 'maintenance'];
      
      for (const allowedType of allowedTypes) {
        const uploadedDoc = await simulateDocumentUpload(user, allowedType, testFile);
        
        // Should preserve the type
        expect(uploadedDoc.documentType).toBe(allowedType);
        
        // Storage directory should use original type
        expect(uploadedDoc.filePath).toMatch(new RegExp(`^${allowedType}\\/`));
      }
    });
  });

  describe('Access Control Integration', () => {
    it('should enforce tenant access restrictions', async () => {
      const tenant = testUsers.tenant;
      const manager = testUsers.manager;
      
      // Manager uploads a document marked as not visible to tenants
      const managerDoc = await simulateDocumentUpload(manager, 'documents', testFile);
      managerDoc.isVisibleToTenants = false;
      
      // Update document in mock storage
      mockStorage.getDocument.mockResolvedValueOnce(managerDoc);
      
      // Tenant should not be able to access it
      await expect(simulateFileRetrieval(tenant, managerDoc.id)).rejects.toThrow('Access denied');
    });

    it('should allow tenant access to visible documents in their residence', async () => {
      const tenant = testUsers.tenant;
      
      // Create a document visible to tenants
      const visibleDoc = await simulateDocumentUpload(testUsers.manager, 'documents', testFile);
      visibleDoc.isVisibleToTenants = true;
      visibleDoc.organizationId = tenant.organizationId;
      visibleDoc.buildingId = tenant.buildingId;
      
      mockStorage.getDocument.mockResolvedValueOnce(visibleDoc);
      
      // Tenant should be able to access it
      const retrievedFile = await simulateFileRetrieval(tenant, visibleDoc.id);
      expect(retrievedFile.document.id).toBe(visibleDoc.id);
    });

    it('should prevent cross-organization access', async () => {
      const userA = { ...testUsers.tenant, organizationId: 'org-A' };
      const userB = { ...testUsers.tenant, organizationId: 'org-B' };
      
      // User A uploads a document
      const docA = await simulateDocumentUpload(userA, 'documents', testFile);
      
      mockStorage.getDocument.mockResolvedValueOnce(docA);
      
      // User B should not be able to access it
      await expect(simulateFileRetrieval(userB, docA.id)).rejects.toThrow('Access denied');
    });
  });

  describe('Quarantine System Integration', () => {
    it('should handle quarantine flag blocking access', async () => {
      const user = testUsers.admin;
      
      // Create a document and mark it as quarantined
      const quarantinedDoc = await simulateDocumentUpload(user, 'documents', testFile);
      quarantinedDoc.isQuarantined = true;
      
      mockStorage.getDocument.mockResolvedValueOnce(quarantinedDoc);
      
      // Even admin should not be able to retrieve quarantined documents
      await expect(simulateFileRetrieval(user, quarantinedDoc.id)).rejects.toThrow('Document quarantined');
    });

    it('should detect quarantine by file path', async () => {
      const user = testUsers.admin;
      
      // Create a document with quarantine path
      const pathQuarantinedDoc = await simulateDocumentUpload(user, 'documents', testFile);
      pathQuarantinedDoc.filePath = 'uploads/_quarantine_2025-09-16T13-03-05-559Z/directories/documents/test.pdf';
      pathQuarantinedDoc.isQuarantined = false; // Flag not set, but path indicates quarantine
      
      mockStorage.getDocument.mockResolvedValueOnce(pathQuarantinedDoc);
      
      // Should be blocked due to quarantine path
      await expect(simulateFileRetrieval(user, pathQuarantinedDoc.id)).rejects.toThrow('Document quarantined');
    });

    it('should handle quarantine workflow', async () => {
      const user = testUsers.manager;
      
      // Upload normal document
      const normalDoc = await simulateDocumentUpload(user, 'documents', testFile);
      expect(normalDoc.isQuarantined).toBe(false);
      
      // Simulate quarantine operation
      await mockStorage.moveToQuarantine(normalDoc.id);
      
      // Mock the quarantined document
      const quarantinedDoc = { ...normalDoc, isQuarantined: true };
      mockStorage.getDocument.mockResolvedValueOnce(quarantinedDoc);
      
      // Should not be accessible
      await expect(simulateFileRetrieval(user, normalDoc.id)).rejects.toThrow('Document quarantined');
      
      // Simulate restore from quarantine
      await mockStorage.restoreFromQuarantine(normalDoc.id);
      const restoredDoc = { ...normalDoc, isQuarantined: false };
      mockStorage.getDocument.mockResolvedValueOnce(restoredDoc);
      
      // Should be accessible again
      const retrievedFile = await simulateFileRetrieval(user, normalDoc.id);
      expect(retrievedFile.document.id).toBe(normalDoc.id);
    });
  });

  describe('Storage Path Structure Validation', () => {
    it('should create correct directory hierarchy for all user roles', async () => {
      const testCases = [
        {
          user: testUsers.admin,
          uploadType: 'documents',
          expectedPattern: /^documents\/org_org-123\/role_admin\//
        },
        {
          user: testUsers.manager,
          uploadType: 'buildings',
          context: { buildingId: 'building-456' },
          expectedPattern: /^buildings\/org_org-123\/building_building-456\/role_manager\//
        },
        {
          user: testUsers.resident,
          uploadType: 'residences',
          expectedPattern: /^residences\/org_org-123\/building_building-456\/residence_residence-789\/role_resident\/user_resident-user-123\//
        },
        {
          user: testUsers.tenant,
          uploadType: 'documents',
          expectedPattern: /^documents\/org_org-123\/building_building-456\/residence_residence-789\/role_tenant\/user_tenant-user-123\//
        }
      ];

      for (const testCase of testCases) {
        const uploadedDoc = await simulateDocumentUpload(
          testCase.user, 
          testCase.uploadType, 
          testFile, 
          testCase.context || {}
        );
        
        expect(uploadedDoc.filePath).toMatch(testCase.expectedPattern);
      }
    });

    it('should not include uploads prefix in generated paths', async () => {
      const user = testUsers.tenant;
      
      const uploadedDoc = await simulateDocumentUpload(user, 'documents', testFile);
      
      // Should not start with 'uploads/'
      expect(uploadedDoc.filePath.startsWith('uploads/')).toBe(false);
      
      // Should not contain duplicate uploads
      expect(uploadedDoc.filePath).not.toMatch(/uploads.*uploads/);
    });

    it('should handle missing context gracefully', async () => {
      const userWithMinimalContext = {
        id: 'minimal-user',
        role: 'admin',
        email: 'minimal@test.com'
        // Missing organizationId
      };
      
      const uploadedDoc = await simulateDocumentUpload(userWithMinimalContext, 'documents', testFile);
      
      // Should use default organization
      expect(uploadedDoc.filePath).toMatch(/^documents\/org_default\/role_admin\//);
    });
  });

  describe('File System Operations', () => {
    it('should create directory structure recursively', async () => {
      const user = testUsers.tenant;
      
      await simulateDocumentUpload(user, 'documents', testFile);
      
      // Should create directories recursively
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('documents/org_org-123/building_building-456/residence_residence-789/role_tenant/user_tenant-user-123'),
        { recursive: true }
      );
    });

    it('should write file content to correct location', async () => {
      const user = testUsers.tenant;
      
      await simulateDocumentUpload(user, 'documents', testFile);
      
      // Should write file with correct path and content
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/documents\/org_org-123.*\.pdf$/),
        testFile.buffer
      );
    });

    it('should handle file system errors gracefully', async () => {
      const user = testUsers.tenant;
      
      // Mock file system error
      mockFs.promises.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(simulateDocumentUpload(user, 'documents', testFile)).rejects.toThrow('Permission denied');
    });
  });

  describe('Migration Compatibility', () => {
    it('should work with existing file paths during migration', async () => {
      const user = testUsers.admin;
      
      // Mock existing document with old path format
      const existingDoc = {
        id: 'existing-doc-123',
        name: 'existing-document.pdf',
        filePath: 'uploads/documents/old-structure/existing-document.pdf', // Old format
        uploadedById: user.id,
        organizationId: user.organizationId,
        isQuarantined: false,
        isVisibleToTenants: true
      };
      
      mockStorage.getDocument.mockResolvedValueOnce(existingDoc);
      
      // Should still be accessible (backward compatibility)
      const retrievedFile = await simulateFileRetrieval(user, existingDoc.id);
      expect(retrievedFile.document.id).toBe(existingDoc.id);
    });

    it('should handle mixed path formats', async () => {
      const user = testUsers.manager;
      
      // Test documents with different path formats
      const pathFormats = [
        'documents/org_org-123/role_manager/new-format.pdf', // New format
        'uploads/documents/org-123/old-format.pdf', // Old format with uploads prefix
        'documents/legacy-format.pdf' // Very old format
      ];
      
      for (const filePath of pathFormats) {
        const doc = {
          id: `doc-${Date.now()}`,
          name: 'test.pdf',
          filePath,
          uploadedById: user.id,
          organizationId: user.organizationId,
          isQuarantined: false,
          isVisibleToTenants: true
        };
        
        mockStorage.getDocument.mockResolvedValueOnce(doc);
        
        // Should handle all formats
        await expect(simulateFileRetrieval(user, doc.id)).resolves.toBeDefined();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent uploads', async () => {
      const user = testUsers.manager;
      
      // Simulate multiple concurrent uploads
      const uploadPromises = Array.from({ length: 10 }, (_, i) => 
        simulateDocumentUpload(user, 'documents', {
          ...testFile,
          originalname: `document-${i}.pdf`
        })
      );
      
      const results = await Promise.all(uploadPromises);
      
      expect(results).toHaveLength(10);
      results.forEach((doc, i) => {
        expect(doc.name).toBe(`document-${i}.pdf`);
        expect(doc.filePath).toMatch(/^documents\/org_org-123\/role_manager\//);
      });
    });

    it('should generate unique file paths for same-named files', async () => {
      const user = testUsers.tenant;
      
      // Upload same file multiple times
      const upload1 = await simulateDocumentUpload(user, 'documents', testFile);
      const upload2 = await simulateDocumentUpload(user, 'documents', testFile);
      
      // Should have different file paths (timestamp-based uniqueness)
      expect(upload1.filePath).not.toBe(upload2.filePath);
      expect(upload1.filePath).toMatch(/\d+-test-document\.pdf$/);
      expect(upload2.filePath).toMatch(/\d+-test-document\.pdf$/);
    });
  });
});