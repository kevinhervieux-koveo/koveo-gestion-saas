import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { testApp as app } from './test-app';
import { db } from '../db';
import { documents, users, organizations, buildings } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Document API Integration Tests', () => {
  const TEST_FILES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
  const TEST_PDF_PATH = path.join(TEST_FILES_DIR, 'test-document.pdf');
  const TEST_IMAGE_PATH = path.join(TEST_FILES_DIR, 'test-image.png');
  
  let testUser: any;
  let testOrganization: any;
  let testBuilding: any;
  let authCookie: string;
  let uploadedDocumentId: string;

  beforeAll(async () => {
    // Ensure test files exist
    if (!fs.existsSync(TEST_FILES_DIR)) {
      fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
    }

    // Create test PDF
    if (!fs.existsSync(TEST_PDF_PATH)) {
      const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n204\n%%EOF';
      fs.writeFileSync(TEST_PDF_PATH, pdfContent);
    }

    // Create test PNG
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
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

    // Create test organization
    const orgResult = await db.insert(organizations).values({
      name: 'Test Org for Documents',
      type: 'management_company',
      address: '123 Test St',
      city: 'Montreal',
      postalCode: 'H1H 1H1',
      email: 'testdocs@example.com',
    }).returning();
    testOrganization = orgResult[0];

    // Create test building
    const buildingResult = await db.insert(buildings).values({
      name: 'Test Building for Documents',
      address: '123 Test St',
      city: 'Montreal',
      postalCode: 'H1H 1H1',
      buildingType: 'apartment',
      totalUnits: 10,
      organizationId: testOrganization.id,
    }).returning();
    testBuilding = buildingResult[0];

    // Create test user
    const userResult = await db.insert(users).values({
      username: 'testdocuser',
      email: 'testdocuser@example.com',
      password: 'dummy-hash',
      firstName: 'Test',
      lastName: 'User',
      role: 'manager',
    }).returning();
    testUser = userResult[0];

    // Simulate login by creating a session
    const agent = request.agent(app);
    const loginRes = await agent
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'dummy', // This won't work with real auth, we need to mock the session
      });
    
    // For testing, we'll need to bypass auth or mock the session
    // Instead, we'll use the requireAuth middleware bypass for tests
  });

  afterAll(async () => {
    // Cleanup test data
    if (uploadedDocumentId) {
      await db.delete(documents).where(eq(documents.id, uploadedDocumentId));
    }
    if (testUser?.id) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
    if (testBuilding?.id) {
      await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    }
    if (testOrganization?.id) {
      await db.delete(organizations).where(eq(organizations.id, testOrganization.id));
    }

    // Cleanup test files
    if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
    if (fs.existsSync(TEST_IMAGE_PATH)) fs.unlinkSync(TEST_IMAGE_PATH);
  });

  describe('POST /api/documents - Document Upload', () => {
    it('should upload a PDF document successfully', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('x-test-user-id', testUser.id) // Mock auth header
        .attach('file', TEST_PDF_PATH)
        .field('name', 'Test PDF Document')
        .field('documentType', 'legal')
        .field('buildingId', testBuilding.id)
        .field('isVisibleToTenants', 'false');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', 'Test PDF Document');
      expect(response.body).toHaveProperty('documentType', 'legal');
      expect(response.body).toHaveProperty('filePath');
      expect(response.body.fileName).toContain('.pdf');
      
      uploadedDocumentId = response.body.id;
    });

    it('should upload an image document successfully', async () => {
      const response = await request(app)
        .post('/api/documents')
        .set('x-test-user-id', testUser.id)
        .attach('file', TEST_IMAGE_PATH)
        .field('name', 'Test Image Document')
        .field('documentType', 'maintenance')
        .field('buildingId', testBuilding.id);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.fileName).toContain('.png');
      expect(response.body.mimeType).toBe('image/png');
    });

    it('should reject file with invalid type', async () => {
      // Create a fake executable file
      const invalidPath = path.join(TEST_FILES_DIR, 'malicious.exe');
      fs.writeFileSync(invalidPath, 'fake exe content');

      const response = await request(app)
        .post('/api/documents')
        .set('x-test-user-id', testUser.id)
        .attach('file', invalidPath)
        .field('name', 'Malicious File')
        .field('documentType', 'other')
        .field('buildingId', testBuilding.id);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      fs.unlinkSync(invalidPath);
    });

    it('should reject file that is too large', async () => {
      // Create a large file (> 10MB)
      const largePath = path.join(TEST_FILES_DIR, 'large.pdf');
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'x'); // 11MB
      fs.writeFileSync(largePath, largeBuffer);

      const response = await request(app)
        .post('/api/documents')
        .set('x-test-user-id', testUser.id)
        .attach('file', largePath)
        .field('name', 'Large File')
        .field('documentType', 'other')
        .field('buildingId', testBuilding.id);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('size');

      fs.unlinkSync(largePath);
    });

    it('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/documents')
        .attach('file', TEST_PDF_PATH)
        .field('name', 'Unauthorized Upload')
        .field('documentType', 'other');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/documents/:id - Get Document', () => {
    beforeEach(async () => {
      // Ensure we have a document to test with
      if (!uploadedDocumentId) {
        const result = await db.insert(documents).values({
          name: 'Get Test Document',
          documentType: 'legal',
          filePath: 'test/path.pdf',
          fileName: 'test.pdf',
          buildingId: testBuilding.id,
          uploadedById: testUser.id,
        }).returning();
        uploadedDocumentId = result[0].id;
      }
    });

    it('should retrieve document by ID', async () => {
      const response = await request(app)
        .get(`/api/documents/${uploadedDocumentId}`)
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', uploadedDocumentId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('documentType');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await request(app)
        .get('/api/documents/nonexistent-id-12345')
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(404);
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/documents/${uploadedDocumentId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/documents/:id/file - Download Document', () => {
    let downloadTestDocId: string;
    let downloadTestFilePath: string;

    beforeEach(async () => {
      // Create a real document with actual file
      const testFilePath = path.join(process.cwd(), 'uploads', 'test-download.pdf');
      const testDir = path.dirname(testFilePath);
      
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      fs.copyFileSync(TEST_PDF_PATH, testFilePath);
      downloadTestFilePath = 'uploads/test-download.pdf';

      const result = await db.insert(documents).values({
        name: 'Download Test Document',
        documentType: 'legal',
        filePath: downloadTestFilePath,
        fileName: 'test-download.pdf',
        mimeType: 'application/pdf',
        fileSize: fs.statSync(testFilePath).size,
        buildingId: testBuilding.id,
        uploadedById: testUser.id,
      }).returning();
      
      downloadTestDocId = result[0].id;
    });

    afterEach(async () => {
      if (downloadTestDocId) {
        await db.delete(documents).where(eq(documents.id, downloadTestDocId));
      }
      if (downloadTestFilePath) {
        const fullPath = path.join(process.cwd(), downloadTestFilePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    });

    it('should download document file', async () => {
      const response = await request(app)
        .get(`/api/documents/${downloadTestDocId}/file`)
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('test-download.pdf');
      expect(response.body).toBeDefined();
    });

    it('should allow viewing document inline', async () => {
      const response = await request(app)
        .get(`/api/documents/${downloadTestDocId}/file?view=true`)
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('inline');
    });

    it('should return 404 for non-existent file', async () => {
      // Create document with non-existent file path
      const result = await db.insert(documents).values({
        name: 'Missing File Document',
        documentType: 'other',
        filePath: 'uploads/nonexistent.pdf',
        fileName: 'nonexistent.pdf',
        buildingId: testBuilding.id,
        uploadedById: testUser.id,
      }).returning();

      const response = await request(app)
        .get(`/api/documents/${result[0].id}/file`)
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(404);

      await db.delete(documents).where(eq(documents.id, result[0].id));
    });
  });

  describe('GET /api/documents - List Documents', () => {
    it('should list documents with filters', async () => {
      const response = await request(app)
        .get('/api/documents')
        .query({ buildingId: testBuilding.id })
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });

    it('should filter documents by type', async () => {
      const response = await request(app)
        .get('/api/documents')
        .query({ 
          buildingId: testBuilding.id,
          documentType: 'legal'
        })
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((doc: any) => {
        expect(doc.documentType).toBe('legal');
      });
    });
  });

  describe('DELETE /api/documents/:id - Delete Document', () => {
    it('should delete document successfully', async () => {
      // Create a document to delete
      const result = await db.insert(documents).values({
        name: 'Document to Delete',
        documentType: 'other',
        filePath: 'test/delete-me.pdf',
        fileName: 'delete-me.pdf',
        buildingId: testBuilding.id,
        uploadedById: testUser.id,
      }).returning();

      const docId = result[0].id;

      const response = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify deletion
      const checkDoc = await db.select().from(documents).where(eq(documents.id, docId));
      expect(checkDoc.length).toBe(0);
    });

    it('should return 404 when deleting non-existent document', async () => {
      const response = await request(app)
        .delete('/api/documents/nonexistent-doc-id')
        .set('x-test-user-id', testUser.id);

      expect(response.status).toBe(404);
    });
  });
});
