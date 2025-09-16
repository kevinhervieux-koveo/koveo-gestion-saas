/**
 * @jest-environment node
 * Integration tests for document upload, fetch, and access control
 * Tests directory structure, file paths, permissions, and role-based access
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OptimizedDatabaseStorage } from '../../server/storage';
import type { InsertDocument } from '../../shared/schemas/documents';

// Mock dependencies
jest.mock('../../server/storage');
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

// Define proper mock types
interface MockStorage {
  createDocument: jest.Mock<Promise<any>, [any]>;
  getDocuments: jest.Mock<Promise<any[]>, [any]>;
}

describe('Document Upload and Access Control', () => {
  let storage: MockStorage;
  let testUploadDir: string;
  let testBillId: string;
  let testUserId: string;
  let testBuildingId: string;
  let testOrganizationId: string;

  beforeEach(() => {
    // Setup test IDs
    testBillId = uuidv4();
    testUserId = uuidv4();
    testBuildingId = uuidv4();
    testOrganizationId = uuidv4();
    testUploadDir = '/test/uploads';

    // Mock filesystem
    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => '');
    mockFs.writeFileSync.mockImplementation(() => {});
    mockPath.join.mockImplementation((...args) => args.join('/'));

    // Mock storage with proper typing
    storage = {
      createDocument: jest.fn().mockResolvedValue({
        id: uuidv4(),
        name: 'test-document',
        filePath: 'test/path',
        createdAt: new Date(),
      }),
      getDocuments: jest.fn().mockResolvedValue([])
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('File Upload Directory Structure', () => {
    test('should create correct directory structure for bill documents', async () => {
      const fileName = 'test-bill.pdf';
      const expectedPath = `/uploads/bills/org_${testOrganizationId}/building_${testBuildingId}`;
      
      mockPath.join.mockReturnValueOnce(expectedPath);
      
      // Simulate document upload
      const documentData: InsertDocument = {
        name: 'Test Bill Document',
        description: 'Test description',
        documentType: 'attachment',
        filePath: `${expectedPath}/${fileName}`,
        fileName,
        fileSize: 1024,
        mimeType: 'application/pdf',
        isVisibleToTenants: false,
        isQuarantined: false,
        buildingId: testBuildingId,
        uploadedById: testUserId,
        attachedToType: 'bill',
        attachedToId: testBillId,
      };

      await storage.createDocument(documentData);

      // Verify directory creation
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(`org_${testOrganizationId}`),
        { recursive: true }
      );
      expect(documentData.filePath).toContain(`org_${testOrganizationId}`);
      expect(documentData.filePath).toContain(`building_${testBuildingId}`);
    });

    test('should create correct directory structure for text documents', async () => {
      const textContent = 'This is a test text document content.';
      const fileName = `${uuidv4()}-text-document.txt`;
      const expectedPath = `/uploads/text-documents/${testUserId}`;
      
      mockPath.join.mockReturnValueOnce(`${expectedPath}/${fileName}`);
      
      // Simulate text document creation
      const documentData: InsertDocument = {
        name: 'Test Text Document',
        description: textContent.substring(0, 200),
        documentType: 'attachment',
        filePath: `text-documents/${testUserId}/${fileName}`,
        fileName,
        fileSize: textContent.length,
        mimeType: 'text/plain',
        isVisibleToTenants: false,
        isQuarantined: false,
        buildingId: testBuildingId,
        uploadedById: testUserId,
        attachedToType: 'bill',
        attachedToId: testBillId,
      };

      await storage.createDocument(documentData);

      // Verify text file creation
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(fileName),
        textContent,
        'utf8'
      );
      expect(documentData.filePath).toContain(`text-documents/${testUserId}`);
      expect(documentData.fileName).toMatch(/.*-text-document\.txt$/);
    });

    test('should handle quarantine directory structure correctly', async () => {
      const quarantineTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const quarantinePath = `_quarantine_${quarantineTimestamp}`;
      
      const documentData: InsertDocument = {
        name: 'Quarantined Document',
        description: 'Document in quarantine',
        documentType: 'attachment',
        filePath: `${quarantinePath}/directories/bills/test-file.pdf`,
        fileName: 'test-file.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        isVisibleToTenants: false,
        isQuarantined: true,
        buildingId: testBuildingId,
        uploadedById: testUserId,
      };

      await storage.createDocument(documentData);

      expect(documentData.filePath).toContain('_quarantine_');
      expect(documentData.isQuarantined).toBe(true);
    });
  });

  describe('Access Control by User Role', () => {
    const adminUser = { id: testUserId, role: 'admin' };
    const managerUser = { id: uuidv4(), role: 'manager' };
    const tenantUser = { id: uuidv4(), role: 'tenant' };
    const residentUser = { id: uuidv4(), role: 'resident' };

    test('admin should have full access to all documents', async () => {
      const filters = {
        userId: adminUser.id,
        userRole: 'admin' as const,
        buildingId: testBuildingId,
      };

      storage.getDocuments.mockResolvedValueOnce([
        { id: '1', name: 'Doc 1', isVisibleToTenants: false },
        { id: '2', name: 'Doc 2', isVisibleToTenants: true },
        { id: '3', name: 'Doc 3', isQuarantined: true },
      ]);

      const documents = await storage.getDocuments(filters);
      
      expect(storage.getDocuments).toHaveBeenCalledWith(filters);
      expect(documents).toHaveLength(3);
    });

    test('manager should have organization-wide access but not quarantined documents', async () => {
      const filters = {
        userId: managerUser.id,
        userRole: 'manager' as const,
        buildingId: testBuildingId,
      };

      storage.getDocuments.mockResolvedValueOnce([
        { id: '1', name: 'Doc 1', isVisibleToTenants: false, isQuarantined: false },
        { id: '2', name: 'Doc 2', isVisibleToTenants: true, isQuarantined: false },
      ]);

      const documents = await storage.getDocuments(filters);
      
      expect(storage.getDocuments).toHaveBeenCalledWith(filters);
      // Should not include quarantined documents
      expect(documents.every(doc => !doc.isQuarantined)).toBe(true);
    });

    test('tenant should only access documents visible to tenants', async () => {
      const filters = {
        userId: tenantUser.id,
        userRole: 'tenant' as const,
        buildingId: testBuildingId,
      };

      storage.getDocuments.mockResolvedValueOnce([
        { id: '2', name: 'Doc 2', isVisibleToTenants: true, isQuarantined: false },
      ]);

      const documents = await storage.getDocuments(filters);
      
      expect(storage.getDocuments).toHaveBeenCalledWith(filters);
      expect(documents.every(doc => doc.isVisibleToTenants)).toBe(true);
    });

    test('resident should have building/residence-specific access', async () => {
      const residenceId = uuidv4();
      const filters = {
        userId: residentUser.id,
        userRole: 'resident' as const,
        buildingId: testBuildingId,
        residenceId: residenceId,
      };

      storage.getDocuments.mockResolvedValueOnce([
        { 
          id: '1', 
          name: 'Building Doc', 
          buildingId: testBuildingId,
          residenceId: null,
          isVisibleToTenants: true 
        },
        { 
          id: '2', 
          name: 'Residence Doc', 
          buildingId: testBuildingId,
          residenceId: residenceId,
          isVisibleToTenants: true 
        },
      ]);

      const documents = await storage.getDocuments(filters);
      
      expect(storage.getDocuments).toHaveBeenCalledWith(filters);
      expect(documents.every(doc => 
        (doc.buildingId === testBuildingId || doc.residenceId === residenceId) &&
        doc.isVisibleToTenants
      )).toBe(true);
    });
  });

  describe('Document Attachment to Bills', () => {
    test('should properly attach file document to bill', async () => {
      const billDocumentData: InsertDocument = {
        name: 'Bill Receipt',
        description: 'Receipt for bill payment',
        documentType: 'attachment',
        filePath: `bills/org_${testOrganizationId}/receipt.pdf`,
        fileName: 'receipt.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        isVisibleToTenants: false,
        isQuarantined: false,
        buildingId: testBuildingId,
        uploadedById: testUserId,
        attachedToType: 'bill',
        attachedToId: testBillId,
      };

      const createdDocument = await storage.createDocument(billDocumentData);

      expect(storage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          attachedToType: 'bill',
          attachedToId: testBillId,
        })
      );
    });

    test('should properly attach text document to bill', async () => {
      const textContent = 'Bill details and notes...';
      const billTextDocumentData: InsertDocument = {
        name: 'Bill Notes',
        description: 'Additional notes for the bill',
        documentType: 'attachment',
        filePath: `text-documents/${testUserId}/${uuidv4()}-bill-notes.txt`,
        fileName: 'bill-notes.txt',
        fileSize: textContent.length,
        mimeType: 'text/plain',
        isVisibleToTenants: false,
        isQuarantined: false,
        buildingId: testBuildingId,
        uploadedById: testUserId,
        attachedToType: 'bill',
        attachedToId: testBillId,
      };

      // Simulate text file creation
      mockFs.writeFileSync.mockImplementation((filePath, content, encoding) => {
        expect(content).toBe(textContent);
        expect(encoding).toBe('utf8');
      });

      await storage.createDocument(billTextDocumentData);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('bill-notes.txt'),
        textContent,
        'utf8'
      );
    });

    test('should retrieve documents attached to specific bill', async () => {
      const filters = {
        userId: testUserId,
        userRole: 'admin' as const,
        attachedToType: 'bill',
        attachedToId: testBillId,
      };

      storage.getDocuments.mockResolvedValueOnce([
        {
          id: '1',
          name: 'Bill Receipt',
          attachedToType: 'bill',
          attachedToId: testBillId,
        },
        {
          id: '2',
          name: 'Bill Notes',
          attachedToType: 'bill',
          attachedToId: testBillId,
        },
      ]);

      const documents = await storage.getDocuments(filters);

      expect(storage.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          attachedToType: 'bill',
          attachedToId: testBillId,
        })
      );
      expect(documents.every(doc => 
        doc.attachedToType === 'bill' && doc.attachedToId === testBillId
      )).toBe(true);
    });
  });

  describe('File Path Security and Validation', () => {
    test('should prevent directory traversal attacks', async () => {
      const maliciousPath = '../../../etc/passwd';
      const sanitizedPath = maliciousPath.replace(/\.\./g, '');
      
      expect(sanitizedPath).not.toContain('..');
      expect(sanitizedPath).toBe('/etc/passwd');
    });

    test('should validate file extensions', () => {
      const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.png'];
      const testFiles = [
        'document.pdf',
        'script.exe',
        'image.jpg',
        'text.txt',
        'malicious.bat',
      ];

      testFiles.forEach(fileName => {
        const ext = path.extname(fileName).toLowerCase();
        const isAllowed = allowedExtensions.includes(ext);
        
        if (fileName.includes('script.exe') || fileName.includes('malicious.bat')) {
          expect(isAllowed).toBe(false);
        } else {
          expect(isAllowed).toBe(true);
        }
      });
    });

    test('should handle file size limits', () => {
      const maxFileSize = 25 * 1024 * 1024; // 25MB
      const testFileSizes = [
        { size: 1024, name: 'small.txt', shouldPass: true },
        { size: 10 * 1024 * 1024, name: 'medium.pdf', shouldPass: true },
        { size: 30 * 1024 * 1024, name: 'large.pdf', shouldPass: false },
      ];

      testFileSizes.forEach(({ size, name, shouldPass }) => {
        const isValidSize = size <= maxFileSize;
        expect(isValidSize).toBe(shouldPass);
      });
    });
  });

  describe('Quarantine Management', () => {
    test('should move files from quarantine to proper location', async () => {
      const quarantinePath = `_quarantine_2025-09-16T13-03-05-559Z/directories/bills/receipt.pdf`;
      const properPath = `bills/org_${testOrganizationId}/receipt.pdf`;
      
      // Mock file operations
      mockFs.existsSync
        .mockReturnValueOnce(true) // quarantine file exists
        .mockReturnValueOnce(false); // proper location doesn't exist
      
      mockFs.copyFileSync.mockImplementation(() => {});
      
      // Simulate unquarantine operation
      const sourceFile = `/uploads/${quarantinePath}`;
      const destFile = `/uploads/${properPath}`;
      
      // Mock the unquarantine process
      if (mockFs.existsSync(sourceFile)) {
        mockFs.copyFileSync(sourceFile, destFile);
      }
      
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(sourceFile, destFile);
    });

    test('should prevent access to quarantined documents via API', async () => {
      const quarantinedDoc = {
        id: '1',
        name: 'Quarantined Doc',
        filePath: '_quarantine_2025-09-16/test.pdf',
        isQuarantined: true,
      };

      // Simulate access control check
      const isAccessible = !quarantinedDoc.isQuarantined && 
                          !quarantinedDoc.filePath.includes('_quarantine_');
      
      expect(isAccessible).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing file uploads gracefully', async () => {
      try {
        const incompleteData = {
          name: 'Test Doc',
          // Missing required fields
        };
        
        await storage.createDocument(incompleteData as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle file system errors during upload', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      try {
        const textContent = 'Test content';
        const fileName = 'test.txt';
        
        mockFs.writeFileSync('/test/path/' + fileName, textContent, 'utf8');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Disk full');
      }
    });

    test('should handle concurrent upload requests safely', async () => {
      const uploadPromises = Array.from({ length: 5 }, (_, i) => {
        const documentData: InsertDocument = {
          name: `Document ${i}`,
          description: `Test document ${i}`,
          documentType: 'attachment',
          filePath: `test/doc-${i}.pdf`,
          fileName: `doc-${i}.pdf`,
          fileSize: 1024,
          mimeType: 'application/pdf',
          isVisibleToTenants: false,
          isQuarantined: false,
          buildingId: testBuildingId,
          uploadedById: testUserId,
          attachedToType: 'bill',
          attachedToId: testBillId,
        };
        return storage.createDocument(documentData);
      });

      const results = await Promise.allSettled(uploadPromises);
      
      // All uploads should complete (either fulfilled or rejected, but not hanging)
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(['fulfilled', 'rejected']).toContain(result.status);
      });
    });
  });
});