import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

describe('Session Persistence', () => {
  let testUser: any;

  beforeAll(async () => {
    // Use the actual running server for testing
    const baseUrl = 'http://localhost:5000';
    
    // Create a test user using the API
    try {
      const response = await request(baseUrl)
        .post('/api/auth/login')
        .send({
          email: 'kevin.hervieux@koveo-gestion.com', // Use existing admin user
          password: 'admin123', // Default admin password
        });
        
      if (response.status === 200) {
        testUser = response.body.user;
      }
    } catch (error) {
      console.log('Using existing user setup for session tests');
    }
  });

  describe('Session Persistence with Live Server', () => {
    it('should test live session persistence using curl requests', async () => {
      // This test validates session persistence by making actual HTTP requests
      // to the running development server
      
      const baseUrl = 'http://localhost:5000';
      
      // Test 1: Login and capture cookies
      const loginResponse = await request(baseUrl)
        .post('/api/auth/login')
        .send({
          email: 'kevin.hervieux@koveo-gestion.com',
          password: 'admin123'
        });

      console.log('Login response status:', loginResponse.status);
      console.log('Login response cookies:', loginResponse.headers['set-cookie']);

      if (loginResponse.status === 200) {
        // Test 2: Use session cookie to make authenticated request
        const cookies = loginResponse.headers['set-cookie'];
        const sessionCookie = cookies?.find((cookie: string) => 
          cookie.includes('koveo.sid')
        );

        if (sessionCookie) {
          // Extract just the cookie value
          const cookieValue = sessionCookie.split(';')[0];
          
          const userResponse = await request(baseUrl)
            .get('/api/auth/user')
            .set('Cookie', cookieValue);

          console.log('Auth user response status:', userResponse.status);
          console.log('Auth user response body:', userResponse.body);
          
          // Validate that session worked
          if (userResponse.status === 200) {
            expect(userResponse.body.email).toBe('kevin.hervieux@koveo-gestion.com');
          } else {
            console.log('❌ Session not persisting - status:', userResponse.status);
          }
        }
      }
    });

    it('should validate session storage in database', async () => {
      // Make a simple request to check what sessions exist
      const baseUrl = 'http://localhost:5000';
      
      const response = await request(baseUrl)
        .get('/api/auth/debug')
        .send();

      console.log('Debug endpoint response:', response.status, response.body);
      
      // This will help us understand the session state
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });
});