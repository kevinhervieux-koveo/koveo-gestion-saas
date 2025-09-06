/**
 * Document Upload, Download, and AI Analysis Integration Tests
 * 
 * Comprehensive testing suite for the standardized document management system
 * with AI analysis functionality. Tests validate:
 * 
 * 1. Document Upload Operations
 *    - File upload with new filePath, fileName, fileSize structure
 *    - Multipart form handling
 *    - File validation and security checks
 *    - Database record creation with correct column names
 * 
 * 2. Document Download Operations
 *    - Secure file serving
 *    - Access control validation
 *    - Proper headers and content disposition
 * 
 * 3. AI Analysis Integration
 *    - Gemini AI document analysis
 *    - AI results storage in database
 *    - Analysis metadata handling
 *    - Error handling for AI failures
 * 
 * 4. Cross-Form Document Handling
 *    - Bills document upload/download
 *    - Demands file attachments
 *    - Bug report file attachments
 *    - Feature request attachments
 *    - Document management uploads
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { db } from '../../server/db';
import { bills, demands, bugs, featureRequests, documents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Mock authentication middleware
const mockAuth = {
  user: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@koveo.com',
    role: 'admin',
    organizationId: '123e4567-e89b-12d3-a456-426614174001'
  }
};

jest.mock('../../server/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = mockAuth.user;
    next();
  }
}));

// Mock Gemini AI service
const mockGeminiAnalysis = {
  isAiAnalyzed: true,
  aiAnalysisData: {
    extractedText: 'Sample document text content',
    keyFindings: ['Important finding 1', 'Important finding 2'],
    documentType: 'invoice',
    confidence: 0.95,
    analysisTimestamp: new Date().toISOString()
  }
};

jest.mock('../../server/services/geminiService', () => ({
  geminiService: {
    analyzeDocument: jest.fn().mockResolvedValue(mockGeminiAnalysis)
  }
}));

jest.mock('../../server/services/gemini-bill-analyzer', () => ({
  geminiBillAnalyzer: {
    analyzeBillDocument: jest.fn().mockResolvedValue(mockGeminiAnalysis.aiAnalysisData)
  }
}));

// Test utilities
const createTestFile = (name: string, content: string = 'test content', mimeType: string = 'text/plain') => {
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
};

const createTestImageFile = (name: string = 'test-image.png') => {
  // Create a minimal PNG file (1x1 pixel)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
    0x60, 0x82
  ]);
  
  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, name);
  fs.writeFileSync(filePath, pngData);
  return filePath;
};

describe('Document Upload, Download, and AI Analysis Integration Tests', () => {
  const app = require('../../server/index').app;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Clean up test data
    await db.delete(bills).where(eq(bills.createdBy, mockAuth.user.id));
    await db.delete(demands).where(eq(demands.submitterId, mockAuth.user.id));
    await db.delete(bugs).where(eq(bugs.createdBy, mockAuth.user.id));
    await db.delete(featureRequests).where(eq(featureRequests.createdBy, mockAuth.user.id));
    await db.delete(documents).where(eq(documents.uploadedById, mockAuth.user.id));
  });

  afterEach(async () => {
    // Clean up test files
    const testDir = path.join(__dirname, 'test-files');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Document Upload Operations', () => {
    it('should upload bill document with standardized column structure', async () => {
      // First create a bill
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      const billId = billResponse.body.id;

      // Upload document to the bill
      const testImagePath = createTestImageFile('bill-receipt.png');
      
      const uploadResponse = await request(app)
        .post(`/api/bills/${billId}/upload-document`)
        .attach('document', testImagePath)
        .expect(200);

      // Verify response contains AI analysis
      expect(uploadResponse.body.message).toContain('uploaded and analyzed successfully');
      expect(uploadResponse.body.bill.isAiAnalyzed).toBe(true);
      expect(uploadResponse.body.bill.aiAnalysisData).toBeDefined();

      // Verify database record uses new column structure
      const updatedBill = await db.select()
        .from(bills)
        .where(eq(bills.id, billId))
        .limit(1);

      expect(updatedBill).toHaveLength(1);
      expect(updatedBill[0].filePath).toBeDefined();
      expect(updatedBill[0].filePath).toContain('bill-receipt.png');
      expect(updatedBill[0].fileName).toBe('bill-receipt.png');
      expect(updatedBill[0].fileSize).toBeGreaterThan(0);
      expect(updatedBill[0].isAiAnalyzed).toBe(true);
      expect(updatedBill[0].aiAnalysisData).toBeDefined();
    });

    it('should handle demand file upload with new structure', async () => {
      const demandData = {
        type: 'maintenance',
        description: 'Testing demand with file attachment',
        buildingId: '123e4567-e89b-12d3-a456-426614174001'
      };

      const testImagePath = createTestImageFile('demand-attachment.png');
      
      const response = await request(app)
        .post('/api/demands')
        .field('type', demandData.type)
        .field('description', demandData.description)
        .field('buildingId', demandData.buildingId)
        .attach('file', testImagePath)
        .expect(200);

      // Verify database record has correct file information
      const createdDemand = await db.select()
        .from(demands)
        .where(eq(demands.id, response.body.id))
        .limit(1);

      expect(createdDemand).toHaveLength(1);
      expect(createdDemand[0].filePath).toBeDefined();
      expect(createdDemand[0].fileName).toBe('demand-attachment.png');
      expect(createdDemand[0].fileSize).toBeGreaterThan(0);
    });

    it('should handle bug report file upload with standardized structure', async () => {
      const bugData = {
        title: 'Test Bug Report',
        description: 'Testing bug report with file attachment',
        category: 'ui_ux',
        priority: 'medium'
      };

      const testImagePath = createTestImageFile('bug-screenshot.png');
      
      const response = await request(app)
        .post('/api/bugs')
        .field('title', bugData.title)
        .field('description', bugData.description)
        .field('category', bugData.category)
        .field('priority', bugData.priority)
        .attach('file', testImagePath)
        .expect(200);

      // Verify database record uses new column names
      const createdBug = await db.select()
        .from(bugs)
        .where(eq(bugs.id, response.body.id))
        .limit(1);

      expect(createdBug).toHaveLength(1);
      expect(createdBug[0].filePath).toBeDefined();
      expect(createdBug[0].fileName).toBe('bug-screenshot.png');
      expect(createdBug[0].fileSize).toBeGreaterThan(0);
    });

    it('should validate file size limits during upload', async () => {
      // Create a large test file (over 25MB)
      const largeFilePath = createTestFile('large-file.txt', 'x'.repeat(26 * 1024 * 1024)); // 26MB
      
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      // Attempt to upload large file should fail
      await request(app)
        .post(`/api/bills/${billResponse.body.id}/upload-document`)
        .attach('document', largeFilePath)
        .expect(413); // Payload Too Large
    });
  });

  describe('Document Download Operations', () => {
    it('should download bill documents with proper headers', async () => {
      // Create bill with document
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Bill for Download',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['150.00'],
        totalAmount: '150.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      const testImagePath = createTestImageFile('download-test.png');
      
      await request(app)
        .post(`/api/bills/${billResponse.body.id}/upload-document`)
        .attach('document', testImagePath)
        .expect(200);

      // Test document download
      const downloadResponse = await request(app)
        .get(`/api/bills/${billResponse.body.id}/download-document`)
        .expect(200);

      // Verify headers
      expect(downloadResponse.headers['content-disposition']).toContain('attachment');
      expect(downloadResponse.headers['content-disposition']).toContain('download-test.png');
      expect(downloadResponse.headers['content-type']).toBe('application/octet-stream');
    });

    it('should handle download of non-existent documents', async () => {
      // Create bill without document
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Bill Without Document',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      // Attempt to download non-existent document
      await request(app)
        .get(`/api/bills/${billResponse.body.id}/download-document`)
        .expect(404);
    });
  });

  describe('AI Analysis Integration', () => {
    it('should analyze uploaded documents with Gemini AI', async () => {
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'AI Analysis Test Bill',
        category: 'utilities',
        paymentType: 'unique',
        costs: ['200.00'],
        totalAmount: '200.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      const testPdfPath = createTestFile('invoice.pdf', 'Sample PDF invoice content', 'application/pdf');
      
      const uploadResponse = await request(app)
        .post(`/api/bills/${billResponse.body.id}/upload-document`)
        .attach('document', testPdfPath)
        .expect(200);

      // Verify AI analysis was performed
      expect(uploadResponse.body.bill.isAiAnalyzed).toBe(true);
      expect(uploadResponse.body.bill.aiAnalysisData).toBeDefined();
      expect(uploadResponse.body.bill.aiAnalysisData.extractedText).toBeDefined();
      expect(uploadResponse.body.bill.aiAnalysisData.confidence).toBeGreaterThan(0);

      // Verify database record contains AI analysis
      const updatedBill = await db.select()
        .from(bills)
        .where(eq(bills.id, billResponse.body.id))
        .limit(1);

      expect(updatedBill[0].isAiAnalyzed).toBe(true);
      expect(updatedBill[0].aiAnalysisData).toBeDefined();
    });

    it('should handle AI analysis failures gracefully', async () => {
      // Mock AI service to fail
      const mockGeminiService = require('../../server/services/gemini-bill-analyzer').geminiBillAnalyzer;
      mockGeminiService.analyzeBillDocument.mockRejectedValueOnce(new Error('AI service unavailable'));

      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'AI Failure Test Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      const testImagePath = createTestImageFile('ai-fail-test.png');
      
      const uploadResponse = await request(app)
        .post(`/api/bills/${billResponse.body.id}/upload-document`)
        .attach('document', testImagePath)
        .expect(200);

      // Document should still upload successfully even if AI fails
      expect(uploadResponse.body.message).toContain('uploaded');
      expect(uploadResponse.body.bill.filePath).toBeDefined();
      expect(uploadResponse.body.bill.fileName).toBe('ai-fail-test.png');
      expect(uploadResponse.body.bill.isAiAnalyzed).toBe(false); // AI failed
      expect(uploadResponse.body.bill.aiAnalysisData).toBeNull();
    });
  });

  describe('Cross-Form Compatibility', () => {
    it('should maintain consistent file structure across all forms', async () => {
      const testImagePath = createTestImageFile('consistency-test.png');
      
      // Test different form types with same file structure
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Consistency Test Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      // Create and upload to bill
      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      await request(app)
        .post(`/api/bills/${billResponse.body.id}/upload-document`)
        .attach('document', testImagePath)
        .expect(200);

      // Create demand with file
      const demandResponse = await request(app)
        .post('/api/demands')
        .field('type', 'maintenance')
        .field('description', 'Consistency test demand')
        .field('buildingId', '123e4567-e89b-12d3-a456-426614174001')
        .attach('file', testImagePath)
        .expect(200);

      // Create bug report with file
      const bugResponse = await request(app)
        .post('/api/bugs')
        .field('title', 'Consistency Test Bug')
        .field('description', 'Testing file structure consistency')
        .field('category', 'functionality')
        .field('priority', 'low')
        .attach('file', testImagePath)
        .expect(200);

      // Verify all records have consistent file structure
      const [billRecord] = await db.select().from(bills).where(eq(bills.id, billResponse.body.id));
      const [demandRecord] = await db.select().from(demands).where(eq(demands.id, demandResponse.body.id));
      const [bugRecord] = await db.select().from(bugs).where(eq(bugs.id, bugResponse.body.id));

      // All should have filePath, fileName, fileSize columns
      expect(billRecord.filePath).toBeDefined();
      expect(billRecord.fileName).toBe('consistency-test.png');
      expect(billRecord.fileSize).toBeGreaterThan(0);

      expect(demandRecord.filePath).toBeDefined();
      expect(demandRecord.fileName).toBe('consistency-test.png');
      expect(demandRecord.fileSize).toBeGreaterThan(0);

      expect(bugRecord.filePath).toBeDefined();
      expect(bugRecord.fileName).toBe('consistency-test.png');
      expect(bugRecord.fileSize).toBeGreaterThan(0);
    });

    it('should validate file types consistently across forms', async () => {
      const invalidFilePath = createTestFile('test.exe', 'executable content', 'application/x-executable');
      
      // All forms should reject executable files
      const billData = {
        buildingId: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Bill',
        category: 'maintenance',
        paymentType: 'unique',
        costs: ['100.00'],
        totalAmount: '100.00',
        startDate: '2024-01-01',
        status: 'draft'
      };

      const billResponse = await request(app)
        .post('/api/bills')
        .send(billData)
        .expect(200);

      // Should reject invalid file type
      await request(app)
        .post(`/api/bills/${billResponse.body.id}/upload-document`)
        .attach('document', invalidFilePath)
        .expect(400);

      // Same for demands
      await request(app)
        .post('/api/demands')
        .field('type', 'maintenance')
        .field('description', 'Test demand')
        .field('buildingId', '123e4567-e89b-12d3-a456-426614174001')
        .attach('file', invalidFilePath)
        .expect(400);

      // Same for bugs
      await request(app)
        .post('/api/bugs')
        .field('title', 'Test Bug')
        .field('description', 'Test description')
        .field('category', 'functionality')
        .field('priority', 'low')
        .attach('file', invalidFilePath)
        .expect(400);
    });
  });
});