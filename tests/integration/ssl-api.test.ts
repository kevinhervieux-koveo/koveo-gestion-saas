import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import { sslCertificates, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('SSL API Integration', () => {
  let app: express.Application;
  let _server: unknown;
  let adminUser: { id: string; email: string; role: string; };
  let testCertificateId: string;
  let authCookie: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    _server = await registerRoutes(app);

    // Create test admin user
    const [user] = await db.insert(users).values({
      email: 'ssl-admin@test.com',
      password: 'hashedpassword123',
      firstName: 'SSL',
      lastName: 'Admin',
      role: 'admin',
      language: 'en'
    }).returning();
    
    adminUser = user;

    // Create test SSL certificate
    const [certificate] = await db.insert(sslCertificates).values({
      domain: 'test.example.com',
      certificateData: 'mock-certificate-data',
      privateKey: 'mock-private-key',
      issuer: 'Let\'s Encrypt Authority X3',
      subject: 'CN=test.example.com',
      serialNumber: '1234567890ABCDEF',
      fingerprint: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
      validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
      status: 'active',
      autoRenew: true,
      renewalAttempts: 0,
      maxRenewalAttempts: 3,
      dnsProvider: 'cloudflare',
      createdBy: adminUser.id
    }).returning();

    testCertificateId = certificate.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testCertificateId) {
      await db.delete(sslCertificates).where(eq(sslCertificates.id, testCertificateId));
    }
    if (adminUser?.id) {
      await db.delete(users).where(eq(users.id, adminUser.id));
    }
  });

  beforeEach(async () => {
    // Login as admin user for authenticated tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ssl-admin@test.com',
        password: 'hashedpassword123'
      });

    if (loginResponse.headers['set-cookie']) {
      authCookie = loginResponse.headers['set-cookie'][0];
    }
  });

  describe('GET /api/ssl/:domain', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/ssl/test.example.com');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');
    });

    it('should return 403 for non-admin users', async () => {
      // Create regular user
      const [regularUser] = await db.insert(users).values({
        email: 'regular@test.com',
        password: 'hashedpassword123',
        firstName: 'Regular',
        lastName: 'User',
        role: 'tenant',
        language: 'en'
      }).returning();

      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular@test.com',
          password: 'hashedpassword123'
        });

      const regularAuthCookie = loginResponse.headers['set-cookie'][0];

      const response = await request(app)
        .get('/api/ssl/test.example.com')
        .set('Cookie', regularAuthCookie);

      expect(response.status).toBe(403);
      
      // Clean up
      await db.delete(users).where(eq(users.id, regularUser.id));
    });

    it('should return certificate information for valid domain', async () => {
      const response = await request(app)
        .get('/api/ssl/test.example.com')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body._data).toMatchObject({
        domain: 'test.example.com',
        issuer: 'Let\'s Encrypt Authority X3',
        subject: 'CN=test.example.com',
        status: 'active',
        autoRenew: true
      });
      expect(response.body.data.certificateStatus).toMatchObject({
        isValid: true,
        statusLabel: expect.any(String)
      });
    });

    it('should return 404 for non-existent domain', async () => {
      const response = await request(app)
        .get('/api/ssl/nonexistent.example.com')
        .set('Cookie', authCookie);

      expect(response.status).toBe(404);
      expect(response.body._error).toBe('Not Found');
    });

    it('should return 400 for invalid domain format', async () => {
      const response = await request(app)
        .get('/api/ssl/invalid..domain')
        .set('Cookie', authCookie);

      expect(response.status).toBe(400);
      expect(response.body._error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid domain format');
    });
  });

  describe('GET /api/ssl', () => {
    it('should return all certificates for admin users', async () => {
      const response = await request(app)
        .get('/api/ssl')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body._data)).toBe(true);
      expect(response.body.count).toBeGreaterThanOrEqual(1);
      
      const certificate = response.body.data.find((cert: unknown) => cert.domain === 'test.example.com');
      expect(certificate).toBeDefined();
      expect(certificate.certificateStatus).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      // Create regular user
      const [regularUser] = await db.insert(users).values({
        email: 'regular2@test.com',
        password: 'hashedpassword123',
        firstName: 'Regular',
        lastName: 'User',
        role: 'tenant',
        language: 'en'
      }).returning();

      // Login as regular user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular2@test.com',
          password: 'hashedpassword123'
        });

      const regularAuthCookie = loginResponse.headers['set-cookie'][0];

      const response = await request(app)
        .get('/api/ssl')
        .set('Cookie', regularAuthCookie);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Insufficient permissions to view all SSL certificates');
      
      // Clean up
      await db.delete(users).where(eq(users.id, regularUser.id));
    });
  });

  describe('GET /api/ssl/:domain/status', () => {
    it('should return detailed certificate status', async () => {
      const response = await request(app)
        .get('/api/ssl/test.example.com/status')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body._data).toMatchObject({
        domain: 'test.example.com',
        status: 'active',
        autoRenew: true,
        isValid: true,
        warnings: expect.any(Array)
      });
    });

    it('should include expiry warnings for certificates expiring soon', async () => {
      // Create certificate expiring soon
      const [expiringCert] = await db.insert(sslCertificates).values({
        domain: 'expiring.example.com',
        certificateData: 'mock-certificate-data',
        privateKey: 'mock-private-key',
        issuer: 'Let\'s Encrypt Authority X3',
        subject: 'CN=expiring.example.com',
        serialNumber: '1234567890ABCDEF2',
        fingerprint: 'BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE',
        validFrom: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        validTo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        status: 'expiring',
        autoRenew: true,
        renewalAttempts: 0,
        maxRenewalAttempts: 3,
        createdBy: adminUser.id
      }).returning();

      const response = await request(app)
        .get('/api/ssl/expiring.example.com/status')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.data.isExpiring).toBe(true);
      expect(response.body.data.warnings.length).toBeGreaterThan(0);
      expect(response.body.data.warnings[0]).toContain('expires in');

      // Clean up
      await db.delete(sslCertificates).where(eq(sslCertificates.id, expiringCert.id));
    });
  });
});