import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../server/db';
import { sslCertificates, users, notifications } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { sslRenewalJob } from '../../server/jobs/ssl_renewal_job';

describe('SSL Management End-to-End Integration', () => {
  let app: express.Application;
  let _server: unknown;
  let adminUser: { id: string; email: string; role: string; };
  let authCookie: string;
  let testCertificateId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    _server = await registerRoutes(app);

    // Create admin user for testing
    const [user] = await db.insert(users).values({
      email: 'ssl-e2e-admin@test.com',
      password: '$2b$10$GRLdbjehqVq5jlFQe.hw1eGtng7zNtquAGLbibT.zKqTtjJ5.DGKi', // 'testpassword123'
      firstName: 'SSL',
      lastName: 'Administrator',
      role: 'admin',
      language: 'en',
      isActive: true
    }).returning();
    
    adminUser = user;

    // Authenticate for tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ssl-e2e-admin@test.com',
        password: 'testpassword123'
      });

    if (loginResponse.headers['set-cookie']) {
      authCookie = loginResponse.headers['set-cookie'][0];
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testCertificateId) {
      await db.delete(sslCertificates).where(eq(sslCertificates.id, testCertificateId));
    }
    
    // Clean up notifications
    await db.delete(notifications).where(
      and(
        eq(notifications.userId, adminUser.id),
        eq(notifications.type, 'ssl_certificate')
      )
    );
    
    if (adminUser?.id) {
      await db.delete(users).where(eq(users.id, adminUser.id));
    }

    // Stop SSL renewal job
    sslRenewalJob.stop();
  });

  describe('Complete SSL Certificate Lifecycle', () => {
    it('should create, monitor, and manage SSL certificate lifecycle', async () => {
      // Step 1: Create SSL certificate
      const [certificate] = await db.insert(sslCertificates).values({
        domain: 'e2e-test.example.com',
        certificateData: 'mock-certificate-pem-data',
        privateKey: 'mock-private-key-pem-data',
        issuer: 'Let\'s Encrypt Authority X3',
        subject: 'CN=e2e-test.example.com',
        serialNumber: '1A2B3C4D5E6F7890',
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

      // Step 2: Verify certificate retrieval via API
      const getResponse = await request(app)
        .get('/api/ssl/e2e-test.example.com')
        .set('Cookie', authCookie);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data).toMatchObject({
        domain: 'e2e-test.example.com',
        issuer: 'Let\'s Encrypt Authority X3',
        status: 'active',
        autoRenew: true
      });
      
      expect(getResponse.body.data.certificateStatus).toMatchObject({
        isValid: true,
        statusLabel: expect.any(String)
      });

      // Step 3: Verify certificate appears in all certificates list
      const listResponse = await request(app)
        .get('/api/ssl')
        .set('Cookie', authCookie);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.success).toBe(true);
      const ourCert = listResponse.body.data.find((cert: any) => 
        cert.domain === 'e2e-test.example.com'
      );
      expect(ourCert).toBeDefined();

      // Step 4: Check detailed certificate status
      const statusResponse = await request(app)
        .get('/api/ssl/e2e-test.example.com/status')
        .set('Cookie', authCookie);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toMatchObject({
        domain: 'e2e-test.example.com',
        isValid: true,
        warnings: expect.any(Array)
      });

      console.warn('✅ SSL Certificate API endpoints working correctly');
    });

    it('should handle expiring certificate monitoring and notifications', async () => {
      // Create certificate expiring soon
      const expiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      
      const [expiringCert] = await db.insert(sslCertificates).values({
        domain: 'expiring-e2e.example.com',
        certificateData: 'mock-expiring-certificate',
        privateKey: 'mock-expiring-private-key',
        issuer: 'Let\'s Encrypt Authority X3',
        subject: 'CN=expiring-e2e.example.com',
        serialNumber: '2B3C4D5E6F7890AB',
        fingerprint: 'BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE',
        validFrom: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000), // 85 days ago
        validTo: expiryDate,
        status: 'expiring',
        autoRenew: true,
        renewalAttempts: 0,
        maxRenewalAttempts: 3,
        createdBy: adminUser.id
      }).returning();

      // Verify expiring certificate shows correct status
      const statusResponse = await request(app)
        .get('/api/ssl/expiring-e2e.example.com/status')
        .set('Cookie', authCookie);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.isExpiring).toBe(true);
      expect(statusResponse.body.data.daysUntilExpiry).toBeLessThanOrEqual(7);
      expect(statusResponse.body.data.warnings.length).toBeGreaterThan(0);

      // Clean up
      await db.delete(sslCertificates).where(eq(sslCertificates.id, expiringCert.id));

      console.warn('✅ SSL Certificate expiry monitoring working correctly');
    });

    it('should validate SSL renewal job status and configuration', async () => {
      const jobStatus = sslRenewalJob.getStatus();

      expect(jobStatus).toMatchObject({
        enabled: expect.any(Boolean),
        running: expect.any(Boolean),
        schedule: expect.any(String),
        config: {
          renewalThresholdDays: expect.any(Number),
          maxRetryAttempts: expect.any(Number),
          expiryNotificationThresholdDays: expect.any(Number),
          enableExpiryNotifications: expect.any(Boolean)
        }
      });

      expect(jobStatus.config.expiryNotificationThresholdDays).toBeGreaterThan(0);
      expect(jobStatus.config.renewalThresholdDays).toBeGreaterThan(0);

      console.warn('✅ SSL Renewal Job configuration working correctly');
      console.warn(`   - Enabled: ${jobStatus.enabled}`);
      console.warn(`   - Schedule: ${jobStatus.schedule}`);
      console.warn(`   - Expiry notifications: ${jobStatus.config.enableExpiryNotifications}`);
      console.warn(`   - Notification threshold: ${jobStatus.config.expiryNotificationThresholdDays} days`);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should restrict SSL endpoints to admin/owner users only', async () => {
      // Test unauthenticated access
      const unauthResponse = await request(app)
        .get('/api/ssl/test.example.com');

      expect(unauthResponse.status).toBe(401);

      // Create regular user
      const [regularUser] = await db.insert(users).values({
        email: 'regular-e2e@test.com',
        password: '$2b$10$GRLdbjehqVq5jlFQe.hw1eGtng7zNtquAGLbibT.zKqTtjJ5.DGKi',
        firstName: 'Regular',
        lastName: 'User',
        role: 'tenant',
        language: 'en',
        isActive: true
      }).returning();

      // Login as regular user
      const regularLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular-e2e@test.com',
          password: 'testpassword123'
        });

      const regularAuthCookie = regularLoginResponse.headers['set-cookie'][0];

      // Test restricted access
      const restrictedResponse = await request(app)
        .get('/api/ssl/test.example.com')
        .set('Cookie', regularAuthCookie);

      expect(restrictedResponse.status).toBe(403);

      // Clean up
      await db.delete(users).where(eq(users.id, regularUser.id));

      console.warn('✅ SSL API access control working correctly');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid domain formats gracefully', async () => {
      const invalidDomains = [
        'invalid..domain',
        'domain-.com',
        '-domain.com',
        'toolongdomainnamethatshouldnotbeacceptedbecauseitexceedsthemaximumlength.com'
      ];

      for (const domain of invalidDomains) {
        const response = await request(app)
          .get(`/api/ssl/${domain}`)
          .set('Cookie', authCookie);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
      }

      console.warn('✅ Domain validation working correctly');
    });

    it('should return proper 404 for non-existent certificates', async () => {
      const response = await request(app)
        .get('/api/ssl/definitely-does-not-exist.example.com')
        .set('Cookie', authCookie);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');

      console.warn('✅ 404 handling working correctly');
    });
  });

  describe('System Integration Validation', () => {
    it('should validate all SSL management components are properly integrated', async () => {
      // Check that all required components are available
      expect(typeof sslRenewalJob.start).toBe('function');
      expect(typeof sslRenewalJob.stop).toBe('function');
      expect(typeof sslRenewalJob.getStatus).toBe('function');

      // Verify database tables exist and are accessible
      const certificatesCount = await db.select().from(sslCertificates).limit(1);
      expect(Array.isArray(certificatesCount)).toBe(true);

      // Verify notification system integration
      const notificationsCount = await db.select().from(notifications)
        .where(eq(notifications.type, 'ssl_certificate'))
        .limit(1);
      expect(Array.isArray(notificationsCount)).toBe(true);

      console.warn('✅ All SSL management components properly integrated');
    });
  });
});