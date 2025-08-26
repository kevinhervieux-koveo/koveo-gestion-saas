/**
 * Simple Deployment Tests
 * 
 * Tests to ensure basic endpoints work without 500 errors
 */

import { describe, test, expect } from '@jest/globals';

describe('Simple Deployment Validation', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5000';

  describe('Basic Health Checks', () => {
    test('health endpoint should work', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('OK');
    });

    test('API health endpoint should work', async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('ok');
      expect(json.message).toBe('Koveo Gestion API is running');
    });

    test('features endpoint should work', async () => {
      const response = await fetch(`${baseUrl}/api/features`);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(Array.isArray(json)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should not return 500 for auth endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/auth/user`);
      // Should return 401 (unauthorized), not 500 (server error)
      expect(response.status).toBe(401);
    });

    test('should not return 500 for non-existent API endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/non-existent`);
      // Should return 404, not 500
      expect(response.status).toBe(404);
    });
  });
});