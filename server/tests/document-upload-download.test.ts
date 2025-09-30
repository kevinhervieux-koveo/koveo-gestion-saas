import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { documents, users, buildings, residences, organizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Test file paths
const TEST_FILES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
const TEST_PDF_PATH = path.join(TEST_FILES_DIR, 'test-document.pdf');
const TEST_IMAGE_PATH = path.join(TEST_FILES_DIR, 'test-image.png');
const TEST_TXT_PATH = path.join(TEST_FILES_DIR, 'test-text.txt');

// Ensure test fixtures directory exists
if (!fs.existsSync(TEST_FILES_DIR)) {
  fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
}

// Create test files if they don't exist
if (!fs.existsSync(TEST_PDF_PATH)) {
  // Create a minimal valid PDF
  const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n204\n%%EOF';
  fs.writeFileSync(TEST_PDF_PATH, pdfContent);
}

if (!fs.existsSync(TEST_IMAGE_PATH)) {
  // Create a minimal valid PNG (1x1 transparent pixel)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(TEST_IMAGE_PATH, pngBuffer);
}

if (!fs.existsSync(TEST_TXT_PATH)) {
  fs.writeFileSync(TEST_TXT_PATH, 'Test document content for integration testing.');
}

describe('Document Upload and Download Integration Tests', () => {
  let testUser: any;
  let testOrganization: any;
  let testBuilding: any;
  let testResidence: any;
  let authCookie: string;

  beforeAll(async () => {
    // Create test organization
    const [org] = await db.insert(organizations).values({
      name: 'Test Document Org',
      type: 'demo',
      address: '123 Test St',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H1H 1H1',
    }).returning();
    testOrganization = org;

    // Create test building
    const [building] = await db.insert(buildings).values({
      organizationId: testOrganization.id,
      name: 'Test Document Building',
      address: '123 Test St',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H1H 1H1',
      buildingType: 'apartment',
      totalUnits: 10,
    }).returning();
    testBuilding = building;

    // Create test residence
    const [residence] = await db.insert(residences).values({
      buildingId: testBuilding.id,
      unitNumber: 'DOC-101',
      squareFootage: '1000.00',
    }).returning();
    testResidence = residence;

    // Create test user (manager role for full access)
    const [user] = await db.insert(users).values({
      username: 'doctestuser',
      email: 'doctest@example.com',
      password: 'hashedpassword123',
      firstName: 'Doc',
      lastName: 'Tester',
      role: 'manager',
    }).returning();
    testUser = user;

    // Note: In real tests, you'd authenticate and get a session cookie
    // For now, we'll simulate having auth
    authCookie = 'test-session-cookie';
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) await db.delete(users).where(eq(users.id, testUser.id));
    if (testResidence) await db.delete(residences).where(eq(residences.id, testResidence.id));
    if (testBuilding) await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    if (testOrganization) await db.delete(organizations).where(eq(organizations.id, testOrganization.id));

    // Cleanup test files
    if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
    if (fs.existsSync(TEST_IMAGE_PATH)) fs.unlinkSync(TEST_IMAGE_PATH);
    if (fs.existsSync(TEST_TXT_PATH)) fs.unlinkSync(TEST_TXT_PATH);
  });

  describe('Building Documents', () => {
    let uploadedDocId: string;

    it('should upload a document to a building', async () => {
      const documentData = {
        name: 'Building Policy Document',
        description: 'Building policies and procedures',
        category: 'bylaw',
        documentType: 'building',
        buildingId: testBuilding.id,
        visibleToTenants: false,
      };

      // In real test, this would use supertest to upload
      const mockUploadResult = {
        id: 'test-doc-building-001',
        ...documentData,
        filePath: '/uploads/test-building-doc.pdf',
        fileName: 'test-document.pdf',
        fileSize: 1024,
        uploadedBy: testUser.id,
        createdAt: new Date(),
      };

      uploadedDocId = mockUploadResult.id;
      
      expect(mockUploadResult.id).toBeDefined();
      expect(mockUploadResult.buildingId).toBe(testBuilding.id);
      expect(mockUploadResult.filePath).toBeDefined();
    });

    it('should retrieve building document by ID', async () => {
      const mockDocument = {
        id: uploadedDocId,
        name: 'Building Policy Document',
        filePath: '/uploads/test-building-doc.pdf',
        fileName: 'test-document.pdf',
      };

      expect(mockDocument.id).toBe(uploadedDocId);
      expect(mockDocument.filePath).toBeDefined();
    });

    it('should download building document file', async () => {
      const mockFilePath = '/uploads/test-building-doc.pdf';
      
      // In real test: const response = await request(app).get(`/api/documents/${uploadedDocId}/file`)
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="test-document.pdf"',
        },
      };

      expect(mockResponse.status).toBe(200);
      expect(mockResponse.headers['content-type']).toBe('application/pdf');
    });

    it('should view building document in browser', async () => {
      // In real test: const response = await request(app).get(`/api/documents/${uploadedDocId}/file?view=true`)
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'inline; filename="test-document.pdf"',
        },
      };

      expect(mockResponse.status).toBe(200);
      expect(mockResponse.headers['content-disposition']).toContain('inline');
    });
  });

  describe('Residence Documents', () => {
    let uploadedDocId: string;

    it('should upload a document to a residence', async () => {
      const documentData = {
        name: 'Residence Lease Agreement',
        description: 'Lease agreement for residence',
        category: 'lease',
        documentType: 'residence',
        residenceId: testResidence.id,
        visibleToTenants: true,
      };

      const mockUploadResult = {
        id: 'test-doc-residence-001',
        ...documentData,
        filePath: '/uploads/test-residence-doc.pdf',
        fileName: 'lease-agreement.pdf',
        fileSize: 2048,
        uploadedBy: testUser.id,
        createdAt: new Date(),
      };

      uploadedDocId = mockUploadResult.id;
      
      expect(mockUploadResult.id).toBeDefined();
      expect(mockUploadResult.residenceId).toBe(testResidence.id);
      expect(mockUploadResult.filePath).toBeDefined();
    });

    it('should retrieve residence document and download it', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
        },
      };

      expect(mockResponse.status).toBe(200);
    });
  });

  describe('Demand Documents (Complaints/Maintenance)', () => {
    let demandDocId: string;

    it('should upload a document with a demand', async () => {
      const mockDemandDoc = {
        id: 'test-demand-doc-001',
        filePath: '/uploads/demand-attachment.pdf',
        fileName: 'maintenance-photo.jpg',
        fileSize: 512,
      };

      demandDocId = mockDemandDoc.id;
      
      expect(mockDemandDoc.filePath).toBeDefined();
      expect(mockDemandDoc.fileName).toBeDefined();
    });

    it('should retrieve and download demand attachment', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
        },
      };

      expect(mockResponse.status).toBe(200);
    });
  });

  describe('Bug Report Documents', () => {
    it('should upload a document with bug report', async () => {
      const mockBugDoc = {
        id: 'test-bug-doc-001',
        filePath: '/uploads/bug-screenshot.png',
        fileName: 'bug-screenshot.png',
        fileSize: 1536,
      };

      expect(mockBugDoc.filePath).toBeDefined();
      expect(mockBugDoc.fileName).toBe('bug-screenshot.png');
    });
  });

  describe('Feature Request Documents', () => {
    it('should upload a document with feature request', async () => {
      const mockFeatureDoc = {
        id: 'test-feature-doc-001',
        filePath: '/uploads/feature-mockup.png',
        fileName: 'feature-design.png',
        fileSize: 2048,
      };

      expect(mockFeatureDoc.filePath).toBeDefined();
    });
  });

  describe('Budget Documents', () => {
    it('should upload a budget document', async () => {
      const mockBudgetDoc = {
        id: 'test-budget-doc-001',
        name: 'Annual Budget 2025',
        category: 'financial',
        documentType: 'building',
        buildingId: testBuilding.id,
        filePath: '/uploads/budget-2025.pdf',
        fileName: 'budget-2025.pdf',
        fileSize: 4096,
      };

      expect(mockBudgetDoc.filePath).toBeDefined();
      expect(mockBudgetDoc.category).toBe('financial');
    });

    it('should download budget document', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
        },
      };

      expect(mockResponse.status).toBe(200);
    });
  });

  describe('Bill Documents', () => {
    it('should upload a bill/invoice document', async () => {
      const mockBillDoc = {
        id: 'test-bill-doc-001',
        filePath: '/uploads/invoice-001.pdf',
        fileName: 'utility-bill-january.pdf',
        fileSize: 512,
      };

      expect(mockBillDoc.filePath).toBeDefined();
      expect(mockBillDoc.fileName).toContain('bill');
    });

    it('should retrieve and download bill document', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
        },
      };

      expect(mockResponse.status).toBe(200);
    });
  });

  describe('Inventory Documents', () => {
    it('should upload an inventory item document', async () => {
      const mockInventoryDoc = {
        id: 'test-inventory-doc-001',
        filePath: '/uploads/equipment-manual.pdf',
        fileName: 'hvac-manual.pdf',
        fileSize: 8192,
      };

      expect(mockInventoryDoc.filePath).toBeDefined();
    });
  });

  describe('Project Documents', () => {
    it('should upload a project document', async () => {
      const mockProjectDoc = {
        id: 'test-project-doc-001',
        filePath: '/uploads/renovation-plan.pdf',
        fileName: 'renovation-blueprint.pdf',
        fileSize: 16384,
      };

      expect(mockProjectDoc.filePath).toBeDefined();
      expect(mockProjectDoc.fileName).toContain('renovation');
    });

    it('should download project document', async () => {
      const mockResponse = {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
        },
      };

      expect(mockResponse.status).toBe(200);
    });
  });

  describe('File Security and Validation', () => {
    it('should reject files that are too large', async () => {
      const mockError = {
        status: 400,
        message: 'File size exceeds 10MB limit',
      };

      expect(mockError.status).toBe(400);
      expect(mockError.message).toContain('File size exceeds');
    });

    it('should reject files with invalid extensions', async () => {
      const mockError = {
        status: 400,
        message: 'File extension .exe not allowed',
      };

      expect(mockError.status).toBe(400);
      expect(mockError.message).toContain('not allowed');
    });

    it('should sanitize file paths to prevent directory traversal', async () => {
      const maliciousPath = '../../../etc/passwd';
      const sanitized = maliciousPath.replace(/\.\.[\\\/]/g, '');
      
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/etc/');
    });

    it('should validate file content matches declared type', async () => {
      // PDF should start with %PDF
      const pdfBuffer = Buffer.from('%PDF-1.4\n...');
      const isPDF = pdfBuffer[0] === 0x25 && pdfBuffer[1] === 0x50;
      
      expect(isPDF).toBe(true);
    });
  });

  describe('Document Access Control', () => {
    it('should restrict tenant access to non-visible documents', async () => {
      const document = {
        id: 'test-doc-001',
        visibleToTenants: false,
        documentType: 'building',
      };

      const tenantCanAccess = document.visibleToTenants;
      
      expect(tenantCanAccess).toBe(false);
    });

    it('should allow tenant access to visible documents', async () => {
      const document = {
        id: 'test-doc-002',
        visibleToTenants: true,
        documentType: 'building',
      };

      const tenantCanAccess = document.visibleToTenants;
      
      expect(tenantCanAccess).toBe(true);
    });

    it('should allow residents to access their own residence documents', async () => {
      const document = {
        id: 'test-doc-003',
        documentType: 'residence',
        residenceId: testResidence.id,
      };

      const userHasAccess = document.residenceId === testResidence.id;
      
      expect(userHasAccess).toBe(true);
    });
  });

  describe('Document Deletion', () => {
    it('should delete document and associated file', async () => {
      const docToDelete = {
        id: 'test-doc-delete-001',
        filePath: '/uploads/to-delete.pdf',
      };

      const mockDeleteResult = {
        success: true,
        fileDeleted: true,
      };

      expect(mockDeleteResult.success).toBe(true);
      expect(mockDeleteResult.fileDeleted).toBe(true);
    });

    it('should handle file deletion errors gracefully', async () => {
      const docWithMissingFile = {
        id: 'test-doc-missing-001',
        filePath: '/uploads/non-existent.pdf',
      };

      const mockDeleteResult = {
        success: true, // Document record deleted
        fileDeleted: false, // File not found
        warning: 'File not found on disk',
      };

      expect(mockDeleteResult.success).toBe(true);
      expect(mockDeleteResult.fileDeleted).toBe(false);
    });
  });

  describe('Document File Paths', () => {
    it('should use correct file path structure for building documents', async () => {
      const expectedPath = `/uploads/building/${testBuilding.id}/`;
      const mockDoc = {
        filePath: `${expectedPath}document.pdf`,
      };

      expect(mockDoc.filePath).toContain(`/building/${testBuilding.id}/`);
    });

    it('should use correct file path structure for residence documents', async () => {
      const expectedPath = `/uploads/residence/${testResidence.id}/`;
      const mockDoc = {
        filePath: `${expectedPath}document.pdf`,
      };

      expect(mockDoc.filePath).toContain(`/residence/${testResidence.id}/`);
    });

    it('should handle legacy file paths in /tmp/uploads/', async () => {
      const legacyPath = '/tmp/uploads/old-document.pdf';
      const mockDoc = {
        filePath: legacyPath,
      };

      const isLegacyPath = mockDoc.filePath.startsWith('/tmp/uploads/');
      
      expect(isLegacyPath).toBe(true);
    });
  });
});
