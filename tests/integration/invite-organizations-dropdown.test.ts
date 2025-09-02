import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

describe('Invite Form Organizations Dropdown', () => {
  const baseUrl = 'http://localhost:5000';
  let authCookie: string;

  beforeAll(async () => {
    // Login to get authentication cookie
    const loginResponse = await request(baseUrl)
      .post('/api/auth/login')
      .send({
        email: 'kevin.hervieux@koveo-gestion.com',
        password: 'admin123'
      });

    if (loginResponse.status === 200) {
      const cookies = loginResponse.headers['set-cookie'];
      authCookie = cookies?.find((cookie: string) => 
        cookie.includes('koveo.sid')
      )?.split(';')[0] || '';
    }
  });

  describe('Organizations API Endpoints', () => {
    it('should successfully fetch organizations from /api/organizations', async () => {
      const response = await request(baseUrl)
        .get('/api/organizations')
        .set('Cookie', authCookie);

      console.log('Organizations API response:', response.status, response.body);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Validate organization structure
      response.body.forEach((org: any) => {
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
        expect(org).toHaveProperty('type');
        expect(typeof org.id).toBe('string');
        expect(typeof org.name).toBe('string');
        expect(org.id.trim()).not.toBe('');
        expect(org.name.trim()).not.toBe('');
      });
    });

    it('should successfully fetch organizations from /api/users/me/organizations', async () => {
      // This is the endpoint the invite form uses
      const response = await request(baseUrl)
        .get('/api/users/me/organizations')
        .set('Cookie', authCookie);

      console.log('User organizations API response:', response.status, response.body);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Validate organization structure matches invite form expectations
      response.body.forEach((org: any) => {
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
        expect(org).toHaveProperty('type');
        expect(typeof org.id).toBe('string');
        expect(typeof org.name).toBe('string');
        expect(org.id.trim()).not.toBe('');
        expect(org.name.trim()).not.toBe('');
      });
      
      console.log('✅ /api/users/me/organizations endpoint now working correctly');
    });

    it('should validate organizations data structure matches invite form expectations', async () => {
      const response = await request(baseUrl)
        .get('/api/organizations')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      
      // Check that the data structure matches what the invite form expects
      const organizations = response.body;
      
      organizations.forEach((org: any) => {
        // These are the fields the invite form filter function checks
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
        expect(org).toHaveProperty('type');
        
        // Validate against invite form's getFilteredOrganizations logic
        const isValid = org && 
          typeof org === 'object' &&
          org.id && 
          typeof org.id === 'string' &&
          org.id.trim() !== '' &&
          org.name && 
          typeof org.name === 'string' &&
          org.name.trim() !== '';
          
        expect(isValid).toBe(true);
      });
      
      console.log('✅ Organizations data structure is valid for invite form');
    });
  });

  describe('Invite Form Frontend Integration', () => {
    it('should check which organizations are available for different user roles', async () => {
      const response = await request(baseUrl)
        .get('/api/organizations')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      
      const organizations = response.body;
      console.log('Available organizations:', organizations.map((org: any) => ({
        name: org.name,
        type: org.type,
        id: org.id
      })));
      
      // Verify expected organizations exist
      const orgNames = organizations.map((org: any) => org.name);
      expect(orgNames).toContain('Koveo');
      expect(orgNames).toContain('Demo');
      
      console.log('✅ Expected organizations are present in database');
    });

    it('should validate admin user can access all organizations', async () => {
      // Test current user info
      const userResponse = await request(baseUrl)
        .get('/api/auth/user')
        .set('Cookie', authCookie);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.role).toBe('admin');
      
      // Test organizations access
      const orgsResponse = await request(baseUrl)
        .get('/api/organizations')
        .set('Cookie', authCookie);

      expect(orgsResponse.status).toBe(200);
      expect(orgsResponse.body.length).toBeGreaterThan(0);
      
      console.log('✅ Admin user has access to organizations');
    });
  });

  describe('Root Cause Analysis', () => {
    it('should document the missing endpoint issue', async () => {
      // Document the issue clearly
      const missingEndpoint = '/api/users/me/organizations';
      const workingEndpoint = '/api/organizations';
      
      console.log('🔍 ROOT CAUSE ANALYSIS:');
      console.log(`❌ Invite form calls: ${missingEndpoint} (missing)`);
      console.log(`✅ Working endpoint: ${workingEndpoint}`);
      console.log('📝 SOLUTION: Add missing endpoint or update invite form');
      
      // This test documents the issue for fixing
      expect(true).toBe(true);
    });
  });
});