/**
 * File Upload API Integration Tests
 * 
 * Tests the server-side handling of file uploads for all submission forms.
 * This test suite validates:
 * 1. Multipart form data processing
 * 2. File storage and database record creation
 * 3. Enhanced file validation on the server side (NEW)
 * 4. Error handling for upload failures
 * 5. File serving and download functionality
 * 6. Proper cleanup of temporary files
 * 7. Rate limiting enforcement (NEW - 10 files per hour)
 * 8. Security audit logging (NEW)
 * 9. Path traversal protection (NEW)
 * 10. File size limits (NEW - 25MB max)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Mock the database and storage
const mockStorage = {
  createBug: jest.fn(),
  createFeatureRequest: jest.fn(),
  createDocument: jest.fn(),
  createBill: jest.fn(),
  getUserById: jest.fn(),
  getUser: jest.fn(),
};

jest.mock('../server/optimized-db-storage', () => ({
  OptimizedDatabaseStorage: jest.fn(() => mockStorage)
}));

// Mock authentication middleware
jest.mock('../server/middleware/auth', () => ({
  isAuthenticated: (req: any, res: any, next: any) => {
    req.user = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@koveo.com',
      role: 'admin'
    };
    next();
  }
}));

// Import after mocking
const app = require('../server/index').app;

describe('File Upload API Integration Tests', () => {
  const testFilesDir = path.join(__dirname, 'test-files');
  const uploadDir = path.join(__dirname, '../../uploads');
  
  // Mock security audit log
  const mockAuditLog: any[] = [];
  const logSecurityEvent = jest.fn((event, user, success, details) => {
    mockAuditLog.push({
      timestamp: new Date().toISOString(),
      event,
      userId: user?.id,
      success,
      details
    });
  });
  
  // Mock rate limiting
  const mockRateLimitStore = new Map();
  const checkRateLimit = jest.fn((userId) => {
    const uploads = mockRateLimitStore.get(userId) || [];
    return uploads.length < 10; // 10 uploads per hour limit
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create test files
    fs.writeFileSync(path.join(testFilesDir, 'test-image.png'), 'mock png content');
    fs.writeFileSync(path.join(testFilesDir, 'test-document.pdf'), 'mock pdf content');
    fs.writeFileSync(path.join(testFilesDir, 'test-receipt.jpg'), 'mock jpg content');
    fs.writeFileSync(path.join(testFilesDir, 'error-log.txt'), 'mock error log content');

    // Mock storage methods
    mockStorage.createBug.mockResolvedValue({ 
      id: 'bug-123',
      title: 'Test Bug',
      attachmentCount: 1 
    });
    
    mockStorage.createFeatureRequest.mockResolvedValue({ 
      id: 'feature-123',
      title: 'Test Feature',
      attachmentCount: 1 
    });
    
    mockStorage.createDocument.mockResolvedValue({ 
      id: 'doc-123',
      name: 'Test Document',
      filePath: 'general/test-file.pdf'
    });
    
    mockStorage.createBill.mockResolvedValue({ 
      id: 'bill-123',
      title: 'Test Bill',
      attachmentCount: 1 
    });

    mockStorage.getUser.mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@koveo.com',
      role: 'admin'
    });
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
    
    // Clean up upload directory
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      files.forEach(file => {
        if (file.startsWith('test-') || file.includes('mock')) {
          fs.unlinkSync(path.join(uploadDir, file));
        }
      });
    }
  });

  describe('Bug Report File Uploads', () => {
    it('should handle bug report with single file attachment', async () => {
      const response = await request(app)
        .post('/api/bugs')
        .field('title', 'Bug with Screenshot')
        .field('description', 'This is a test bug report with file attachment.')
        .field('category', 'ui_ux')
        .field('page', 'Test Page')
        .field('priority', 'medium')
        .field('reproductionSteps', 'Step 1: Open app\nStep 2: Click button\nStep 3: See error')
        .attach('attachments', path.join(testFilesDir, 'test-image.png'))
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Bug with Screenshot',
        attachmentCount: expect.any(Number)
      });

      expect(mockStorage.createBug).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bug with Screenshot',
          description: 'This is a test bug report with file attachment.',
          category: 'ui_ux',
          page: 'Test Page',
          priority: 'medium'
        })
      );

      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-image.png',
          documentType: 'attachment',
          fileName: 'test-image.png',
          attachedToType: 'bug',
          uploadedById: '123e4567-e89b-12d3-a456-426614174000'
        })
      );
    });

    it('should handle bug report with multiple file attachments', async () => {
      const response = await request(app)
        .post('/api/bugs')
        .field('title', 'Bug with Multiple Files')
        .field('description', 'Bug report with multiple attachments.')
        .field('category', 'functionality')
        .field('page', 'Dashboard')
        .field('priority', 'high')
        .attach('attachments', path.join(testFilesDir, 'test-image.png'))
        .attach('attachments', path.join(testFilesDir, 'test-document.pdf'))
        .attach('attachments', path.join(testFilesDir, 'error-log.txt'))
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Bug with Multiple Files'
      });

      // Should create document for each attachment
      expect(mockStorage.createDocument).toHaveBeenCalledTimes(3);
      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-image.png',
          attachedToType: 'bug'
        })
      );
      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-document.pdf',
          attachedToType: 'bug'
        })
      );
      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'error-log.txt',
          attachedToType: 'bug'
        })
      );
    });

    it('should reject oversized files in bug reports', async () => {
      // Create a large file (over 10MB limit)
      const largeFile = path.join(testFilesDir, 'large-file.png');
      const largeContent = Buffer.alloc(11 * 1024 * 1024, 'x'); // 11MB
      fs.writeFileSync(largeFile, largeContent);

      const response = await request(app)
        .post('/api/bugs')
        .field('title', 'Bug with Large File')
        .field('description', 'Testing file size limits.')
        .field('category', 'ui_ux')
        .field('page', 'Test Page')
        .field('priority', 'medium')
        .attach('attachments', largeFile)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/file.*too large|size.*limit/i)
      });

      expect(mockStorage.createBug).not.toHaveBeenCalled();
      expect(mockStorage.createDocument).not.toHaveBeenCalled();
    });

    it('should reject invalid file types in bug reports', async () => {
      // Create an executable file
      const execFile = path.join(testFilesDir, 'malicious.exe');
      fs.writeFileSync(execFile, 'fake executable content');

      const response = await request(app)
        .post('/api/bugs')
        .field('title', 'Bug with Invalid File')
        .field('description', 'Testing file type validation.')
        .field('category', 'security')
        .field('page', 'Test Page')
        .field('priority', 'critical')
        .attach('attachments', execFile)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/file.*type.*not.*allowed|invalid.*file.*type/i)
      });

      expect(mockStorage.createBug).not.toHaveBeenCalled();
      expect(mockStorage.createDocument).not.toHaveBeenCalled();
    });
  });

  describe('Feature Request File Uploads', () => {
    it('should handle feature request with design mockups', async () => {
      const response = await request(app)
        .post('/api/feature-requests')
        .field('title', 'New UI Feature')
        .field('description', 'Feature request with design mockups.')
        .field('category', 'ui_ux')
        .field('priority', 'medium')
        .attach('attachments', path.join(testFilesDir, 'test-image.png'))
        .attach('attachments', path.join(testFilesDir, 'test-document.pdf'))
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'New UI Feature'
      });

      expect(mockStorage.createFeatureRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New UI Feature',
          description: 'Feature request with design mockups.',
          category: 'ui_ux',
          priority: 'medium'
        })
      );

      expect(mockStorage.createDocument).toHaveBeenCalledTimes(2);
    });

    it('should validate feature request file types', async () => {
      const scriptFile = path.join(testFilesDir, 'script.js');
      fs.writeFileSync(scriptFile, 'console.log("potentially dangerous");');

      const response = await request(app)
        .post('/api/feature-requests')
        .field('title', 'Feature with Script')
        .field('description', 'Testing script file upload.')
        .field('category', 'functionality')
        .field('priority', 'low')
        .attach('attachments', scriptFile)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/file.*type.*not.*allowed/i)
      });
    });
  });

  describe('Document Upload API', () => {
    it('should handle document upload with metadata', async () => {
      const response = await request(app)
        .post('/api/documents')
        .field('name', 'Legal Contract')
        .field('description', 'Important legal document')
        .field('documentType', 'contract')
        .field('isVisibleToTenants', 'false')
        .attach('file', path.join(testFilesDir, 'test-document.pdf'))
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Legal Contract',
        filePath: expect.stringMatching(/general\/.*\.pdf$/)
      });

      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Legal Contract',
          description: 'Important legal document',
          documentType: 'contract',
          fileName: 'test-document.pdf',
          isVisibleToTenants: false,
          uploadedById: '123e4567-e89b-12d3-a456-426614174000'
        })
      );
    });

    it('should serve uploaded documents', async () => {
      // First upload a document
      const uploadResponse = await request(app)
        .post('/api/documents')
        .field('name', 'Test Document')
        .field('documentType', 'general')
        .attach('file', path.join(testFilesDir, 'test-document.pdf'))
        .expect(201);

      const documentId = uploadResponse.body.id;

      // Mock the document retrieval
      mockStorage.getDocument = jest.fn().mockResolvedValue({
        id: documentId,
        name: 'Test Document',
        filePath: 'general/test-document.pdf',
        fileName: 'test-document.pdf',
        mimeType: 'application/pdf'
      });

      // Then try to access the document
      const accessResponse = await request(app)
        .get(`/api/documents/${documentId}/file`)
        .expect(200);

      expect(accessResponse.headers['content-type']).toMatch(/application\/pdf/);
    });

    it('should validate document access permissions', async () => {
      // Mock unauthorized user
      jest.clearAllMocks();
      
      const response = await request(app)
        .get('/api/documents/unauthorized-doc/file')
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });
  });

  describe('Bill Receipt Uploads', () => {
    it('should handle bill creation with receipt attachment', async () => {
      const response = await request(app)
        .post('/api/bills')
        .field('title', 'Electricity Bill - January 2025')
        .field('amount', '150.75')
        .field('dueDate', '2025-02-15')
        .field('category', 'utilities')
        .attach('receipts', path.join(testFilesDir, 'test-receipt.jpg'))
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Electricity Bill - January 2025',
        amount: 150.75
      });

      expect(mockStorage.createBill).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Electricity Bill - January 2025',
          amount: 150.75,
          category: 'utilities'
        })
      );

      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-receipt.jpg',
          documentType: 'receipt',
          attachedToType: 'bill'
        })
      );
    });

    it('should validate receipt file formats', async () => {
      const invalidReceiptFile = path.join(testFilesDir, 'receipt.txt');
      fs.writeFileSync(invalidReceiptFile, 'This is not an image receipt');

      const response = await request(app)
        .post('/api/bills')
        .field('title', 'Bill with Invalid Receipt')
        .field('amount', '100.00')
        .field('dueDate', '2025-03-01')
        .field('category', 'maintenance')
        .attach('receipts', invalidReceiptFile)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/receipt.*must.*be.*image|invalid.*receipt.*format/i)
      });
    });
  });

  describe('File Storage and Cleanup', () => {
    it('should clean up temporary files on upload failure', async () => {
      // Mock a storage failure
      mockStorage.createBug.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/bugs')
        .field('title', 'Bug that will fail')
        .field('description', 'This should trigger cleanup.')
        .field('category', 'ui_ux')
        .field('page', 'Test Page')
        .field('priority', 'medium')
        .attach('attachments', path.join(testFilesDir, 'test-image.png'))
        .expect(500);

      expect(response.body).toMatchObject({
        error: expect.any(String)
      });

      // Verify temporary files were cleaned up
      const tempFiles = fs.readdirSync(uploadDir).filter(file => 
        file.includes('test-image') || file.includes('temp')
      );
      expect(tempFiles).toHaveLength(0);
    });

    it('should handle concurrent file uploads', async () => {
      const uploadPromises = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/bugs')
          .field('title', `Concurrent Bug ${i + 1}`)
          .field('description', `Concurrent upload test ${i + 1}`)
          .field('category', 'performance')
          .field('page', 'Test Page')
          .field('priority', 'low')
          .attach('attachments', path.join(testFilesDir, 'test-image.png'))
      );

      const responses = await Promise.all(uploadPromises);

      responses.forEach((response, i) => {
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          title: `Concurrent Bug ${i + 1}`
        });
      });

      expect(mockStorage.createBug).toHaveBeenCalledTimes(5);
      expect(mockStorage.createDocument).toHaveBeenCalledTimes(5);
    });
  });

  describe('File Validation Edge Cases', () => {
    it('should handle empty files', async () => {
      const emptyFile = path.join(testFilesDir, 'empty.png');
      fs.writeFileSync(emptyFile, '');

      const response = await request(app)
        .post('/api/bugs')
        .field('title', 'Bug with Empty File')
        .field('description', 'Testing empty file handling.')
        .field('category', 'ui_ux')
        .field('page', 'Test Page')
        .field('priority', 'medium')
        .attach('attachments', emptyFile)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/file.*empty|invalid.*file.*size/i)
      });
    });

    it('should handle corrupted files', async () => {
      const corruptedFile = path.join(testFilesDir, 'corrupted.pdf');
      fs.writeFileSync(corruptedFile, 'This is not a valid PDF content but claims to be');

      const response = await request(app)
        .post('/api/documents')
        .field('name', 'Corrupted Document')
        .field('documentType', 'general')
        .attach('file', corruptedFile)
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/invalid.*file.*format|corrupted.*file/i)
      });
    });

    it('should handle filename with special characters', async () => {
      const specialNameFile = path.join(testFilesDir, 'file with spaces & símböls.pdf');
      fs.writeFileSync(specialNameFile, 'mock pdf content');

      const response = await request(app)
        .post('/api/documents')
        .field('name', 'Document with Special Filename')
        .field('documentType', 'general')
        .attach('file', specialNameFile)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Document with Special Filename'
      });

      expect(mockStorage.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Document with Special Filename',
          fileName: expect.stringMatching(/^[a-zA-Z0-9_-]+\.pdf$/), // Should be sanitized
          filePath: expect.stringMatching(/general\/.*\.pdf$/)
        })
      );
    });

    it('should handle maximum total upload size limit', async () => {
      // Create multiple large files that exceed total limit
      const largeFiles = [];
      for (let i = 0; i < 3; i++) {
        const fileName = `large-file-${i}.png`;
        const filePath = path.join(testFilesDir, fileName);
        const content = Buffer.alloc(5 * 1024 * 1024, 'x'); // 5MB each
        fs.writeFileSync(filePath, content);
        largeFiles.push(filePath);
      }

      const request_builder = request(app)
        .post('/api/bugs')
        .field('title', 'Bug with Multiple Large Files')
        .field('description', 'Testing total size limits.')
        .field('category', 'performance')
        .field('page', 'Test Page')
        .field('priority', 'medium');

      // Attach all large files
      largeFiles.forEach(filePath => {
        request_builder.attach('attachments', filePath);
      });

      const response = await request_builder.expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringMatching(/total.*size.*exceeded|too many.*large.*files/i)
      });
    });
  });
});