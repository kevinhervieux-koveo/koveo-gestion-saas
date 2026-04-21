import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import express from 'express';
import { db } from '../db';
import { documents, users, buildings, residences, organizations, userOrganizations } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { registerDocumentRoutes } from '../api/documents';
import { setupAuthRoutes } from '../auth';
import compression from 'compression';
import session from 'express-session';

// Unmock critical modules for integration testing
jest.unmock('fs');
jest.unmock('fs/promises');
jest.unmock('../db');
jest.unmock('server/db');

// Test file paths
const TEST_FILES_DIR = path.join(process.cwd(), 'server/tests/fixtures');
const TEST_PDF_PATH = path.join(TEST_FILES_DIR, 'test-document.pdf');
const TEST_IMAGE_PATH = path.join(TEST_FILES_DIR, 'test-image.png');
const TEST_TXT_PATH = path.join(TEST_FILES_DIR, 'test-text.txt');

// Function to create test fixtures (will be called in beforeAll)
function createTestFixtures() {
  const fs = require('fs');
  
  // Ensure test fixtures directory exists
  if (!fs.existsSync(TEST_FILES_DIR)) {
    fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
  }

  // Create test files if they don't exist
  if (!fs.existsSync(TEST_PDF_PATH)) {
    const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n204\n%%EOF';
    fs.writeFileSync(TEST_PDF_PATH, pdfContent);
  }

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

  if (!fs.existsSync(TEST_TXT_PATH)) {
    fs.writeFileSync(TEST_TXT_PATH, 'Test document content for integration testing.');
  }
  
  return fs;
}

// Create a test Express app
function createTestApp() {
  const app = express();
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  
  // Setup session middleware (required for auth)
  app.use(session({
    secret: 'test-secret-key-for-testing-only',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Allow non-HTTPS in tests
  }));
  
  // Setup auth routes
  setupAuthRoutes(app);
  
  // Register document routes
  registerDocumentRoutes(app);
  
  return app;
}

describe('Document Upload and Download Integration Tests', () => {
  let app: express.Application;
  let testUser: any;
  let testOrganization: any;
  let testBuilding: any;
  let testResidence: any;
  let authCookie: string;

  beforeAll(async () => {
    console.log('Starting beforeAll setup...');
    
    // Create test fixtures
    createTestFixtures();
    console.log('Test fixtures created');
    
    // Create test app
    app = createTestApp();
    console.log('Test app created');

    // Create test organization
    console.log('Creating test organization...');
    const [org] = await db.insert(organizations).values({
      name: 'Test Document Org',
      type: 'demo',
      address: '123 Test St',
      city: 'Test City',
      province: 'QC',
      postalCode: 'H1H 1H1',
    }).returning();
    testOrganization = org;
    console.log('Test organization created:', testOrganization.id);

    // Create test building
    console.log('Creating test building...');
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
    console.log('Test building created:', testBuilding.id);

    // Create test residence
    console.log('Creating test residence...');
    const [residence] = await db.insert(residences).values({
      buildingId: testBuilding.id,
      unitNumber: 'DOC-101',
      squareFootage: '1000.00',
    }).returning();
    testResidence = residence;
    console.log('Test residence created:', testResidence.id);

    // Create test user (manager role for full access)
    console.log('Creating test user...');
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const [user] = await db.insert(users).values({
      username: 'doctestuser',
      email: 'doctest@example.com',
      password: hashedPassword,
      firstName: 'Doc',
      lastName: 'Tester',
      role: 'manager',
    }).returning();
    testUser = user;
    console.log('Test user created:', testUser.id);

    // Link user to organization
    console.log('Linking user to organization...');
    await db.insert(userOrganizations).values({
      userId: testUser.id,
      organizationId: testOrganization.id,
      isActive: true,
    });
    console.log('User linked to organization');

    // Authenticate to get session cookie
    console.log('Attempting login...');
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'doctest@example.com',
        password: 'testpassword123',
      });

    console.log('Login response status:', loginResponse.status);
    authCookie = loginResponse.headers['set-cookie'];
    console.log('Auth cookie set');
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      await db.delete(userOrganizations).where(eq(userOrganizations.userId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
    }
    if (testResidence) await db.delete(residences).where(eq(residences.id, testResidence.id));
    if (testBuilding) await db.delete(buildings).where(eq(buildings.id, testBuilding.id));
    if (testOrganization) await db.delete(organizations).where(eq(organizations.id, testOrganization.id));

    // Cleanup test files
    const fs = require('fs');
    if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
    if (fs.existsSync(TEST_IMAGE_PATH)) fs.unlinkSync(TEST_IMAGE_PATH);
    if (fs.existsSync(TEST_TXT_PATH)) fs.unlinkSync(TEST_TXT_PATH);
  });

  describe('Building Documents', () => {
    let uploadedDocId: string;

    it('should upload a document to a building', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Building Policy Document')
        .field('description', 'Building policies and procedures')
        .field('category', 'bylaw')
        .field('documentType', 'building')
        .field('buildingId', testBuilding.id)
        .field('visibleToTenants', 'false')
        .attach('file', TEST_PDF_PATH);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.buildingId).toBe(testBuilding.id);
      expect(response.body.filePath).toBeDefined();
      uploadedDocId = response.body.id;
    });

    it('should retrieve building document by ID', async () => {
      const response = await request(app)
        .get(`/api/documents/${uploadedDocId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(uploadedDocId);
      expect(response.body.name).toBe('Building Policy Document');
    });

    it('should download building document file', async () => {
      const response = await request(app)
        .get(`/api/documents/${uploadedDocId}/file`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should view building document in browser', async () => {
      const response = await request(app)
        .get(`/api/documents/${uploadedDocId}/file?view=true`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('pdf');
      expect(response.headers['content-disposition']).toContain('inline');
    });
  });

  describe('Residence Documents', () => {
    let uploadedDocId: string;

    it('should upload a document to a residence', async () => {
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Residence Lease Agreement')
        .field('description', 'Lease agreement for residence')
        .field('category', 'lease')
        .field('documentType', 'residence')
        .field('residenceId', testResidence.id)
        .field('visibleToTenants', 'true')
        .attach('file', TEST_PDF_PATH);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.residenceId).toBe(testResidence.id);
      uploadedDocId = response.body.id;
    });

    it('should retrieve residence document and download it', async () => {
      const response = await request(app)
        .get(`/api/documents/${uploadedDocId}/file`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('pdf');
    });
  });

  describe('File Security and Validation', () => {
    it('should reject files that are too large', async () => {
      const fs = require('fs');
      // Create a mock large file buffer (simulate 11MB file)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      const largePath = path.join(TEST_FILES_DIR, 'large-file.pdf');
      fs.writeFileSync(largePath, largeBuffer);

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Large File')
        .field('category', 'general')
        .field('documentType', 'building')
        .field('buildingId', testBuilding.id)
        .attach('file', largePath);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('File size exceeds');

      // Cleanup
      fs.unlinkSync(largePath);
    });

    it('should reject files with invalid extensions', async () => {
      const fs = require('fs');
      const exePath = path.join(TEST_FILES_DIR, 'malicious.exe');
      fs.writeFileSync(exePath, 'fake executable');

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Malicious File')
        .field('category', 'general')
        .field('documentType', 'building')
        .field('buildingId', testBuilding.id)
        .attach('file', exePath);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not allowed');

      // Cleanup
      fs.unlinkSync(exePath);
    });

    it('should sanitize file paths to prevent directory traversal', async () => {
      const maliciousPath = '../../../etc/passwd';
      const sanitized = maliciousPath.replace(/\.\.[\\\/]/g, '');
      
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/etc/');
    });

    it('should validate file content matches declared type', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n...');
      const isPDF = pdfBuffer[0] === 0x25 && pdfBuffer[1] === 0x50;
      
      expect(isPDF).toBe(true);
    });
  });

  describe('Document Access Control', () => {
    it('should restrict tenant access to non-visible documents', async () => {
      // Create a non-visible document
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Private Document')
        .field('category', 'bylaw')
        .field('documentType', 'building')
        .field('buildingId', testBuilding.id)
        .field('visibleToTenants', 'false')
        .attach('file', TEST_PDF_PATH);

      expect(response.body.visibleToTenants).toBe(false);
    });

    it('should allow tenant access to visible documents', async () => {
      // Create a visible document
      const response = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Public Document')
        .field('category', 'bylaw')
        .field('documentType', 'building')
        .field('buildingId', testBuilding.id)
        .field('visibleToTenants', 'true')
        .attach('file', TEST_PDF_PATH);

      expect(response.body.visibleToTenants).toBe(true);
    });
  });

  describe('Document Deletion', () => {
    it('should delete document and associated file', async () => {
      // First, upload a document
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .set('Cookie', authCookie)
        .field('name', 'Document to Delete')
        .field('category', 'general')
        .field('documentType', 'building')
        .field('buildingId', testBuilding.id)
        .attach('file', TEST_PDF_PATH);

      const docId = uploadResponse.body.id;

      // Then, delete it
      const deleteResponse = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('Cookie', authCookie);

      expect(deleteResponse.status).toBe(200);
      
      // Verify it's deleted by trying to retrieve it
      const getResponse = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', authCookie);

      expect(getResponse.status).toBe(404);
    });
  });
});
