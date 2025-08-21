/**
 * Integration tests for Dynamic Budget API endpoints
 * Tests API functionality, data integrity, and error handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createTestUser, createTestBuilding, createTestResidence, createTestBill } from '../helpers/test-data';
import { db } from '../../server/db';
import type { Express } from 'express';

describe('Dynamic Budgets API', () => {
  let app: Express;
  let testUser: any;
  let testBuilding: any;
  let authCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    
    // Create test user and building
    testUser = await createTestUser({
      email: 'budget-test@example.com',
      role: 'admin',
      password: 'password123'
    });

    testBuilding = await createTestBuilding({
      name: 'Budget Test Building',
      organizationId: testUser.organizationId,
      address: '123 Test Street',
      city: 'Test City'
    });

    // Login to get auth cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'budget-test@example.com',
        password: 'password123'
      });
    
    authCookie = loginResponse.headers['set-cookie'][0];
  });

  afterAll(async () => {
    // Cleanup test data
    await db.execute(`DELETE FROM users WHERE email = 'budget-test@example.com'`);
    // Additional cleanup...
  });

  beforeEach(async () => {
    // Clear cache before each test
    await request(app)
      .delete(`/api/dynamic-budgets/${testBuilding.id}/cache`)
      .set('Cookie', authCookie);
  });

  describe('GET /api/dynamic-budgets/:buildingId', () => {
    it('should return financial data for a building', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2024,
          groupBy: 'monthly'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.summary).toBeDefined();
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.buildingId).toBe(testBuilding.id);
    });

    it('should return yearly grouped data when requested', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2023,
          endYear: 2025,
          groupBy: 'yearly'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(3); // Max 3 years
      
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('year');
        expect(response.body.data[0]).toHaveProperty('totalIncome');
        expect(response.body.data[0]).toHaveProperty('totalExpenses');
      }
    });

    it('should handle force refresh parameter', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2024,
          forceRefresh: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.body.meta.cached).toBe(false);
    });

    it('should return 404 for non-existent building', async () => {
      const response = await request(app)
        .get('/api/dynamic-budgets/non-existent-building')
        .set('Cookie', authCookie);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`);

      expect(response.status).toBe(401);
    });

    it('should validate year range parameters', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2023 // End year before start year
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid year range');
    });

    it('should reject excessively large date ranges', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2000,
          endYear: 2050 // 50 years (exceeds 30-year limit)
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Date range too large');
    });
  });

  describe('GET /api/dynamic-budgets/summary', () => {
    let testBuilding2: any;

    beforeAll(async () => {
      testBuilding2 = await createTestBuilding({
        name: 'Budget Test Building 2',
        organizationId: testUser.organizationId,
        address: '456 Test Avenue',
        city: 'Test City'
      });
    });

    it('should return summary for multiple buildings', async () => {
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({
          buildingIds: `${testBuilding.id},${testBuilding2.id}`,
          year: 2024
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.buildings).toBeInstanceOf(Array);
      expect(response.body.data.aggregate).toBeDefined();
      expect(response.body.meta.requestedBuildings).toBe(2);
    });

    it('should handle missing buildingIds parameter', async () => {
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({ year: 2024 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing building IDs');
    });

    it('should handle excessive number of buildings', async () => {
      const manyBuildingIds = Array.from({ length: 60 }, (_, i) => `building-${i}`).join(',');
      
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({
          buildingIds: manyBuildingIds,
          year: 2024
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid building count');
    });

    it('should handle mix of valid and invalid building IDs', async () => {
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({
          buildingIds: `${testBuilding.id},invalid-building-id`,
          year: 2024
        });

      expect(response.status).toBe(200);
      expect(response.body.data.failed).toBeDefined();
      expect(response.body.meta.successfulBuildings).toBe(1);
      expect(response.body.meta.failedBuildings).toBe(1);
    });
  });

  describe('Cache Management Endpoints', () => {
    it('should allow cache invalidation by admin/manager', async () => {
      const response = await request(app)
        .delete(`/api/dynamic-budgets/${testBuilding.id}/cache`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Cache invalidated');
    });

    it('should allow cache refresh by admin/manager', async () => {
      const response = await request(app)
        .post(`/api/dynamic-budgets/${testBuilding.id}/refresh`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Cache refreshed');
    });

    it('should provide cache statistics for admin', async () => {
      const response = await request(app)
        .get('/api/dynamic-budgets/cache/stats')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveProperty('totalEntries');
      expect(response.body.data).toHaveProperty('expiredEntries');
    });
  });

  describe('Data Accuracy with Real Data', () => {
    beforeAll(async () => {
      // Create test residences with monthly fees
      await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: '101',
        monthlyFees: 1800,
        floor: 1,
        isActive: true
      });

      await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: '102', 
        monthlyFees: 1650,
        floor: 1,
        isActive: true
      });

      // Create test bills
      await createTestBill({
        buildingId: testBuilding.id,
        title: 'Monthly Utilities',
        category: 'utilities',
        totalAmount: 2500,
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        startDate: '2024-01-01',
        costs: [2500]
      });

      await createTestBill({
        buildingId: testBuilding.id,
        title: 'Quarterly Insurance',
        category: 'insurance',
        totalAmount: 6000,
        paymentType: 'recurrent',
        schedulePayment: 'quarterly',
        startDate: '2024-01-01',
        costs: [6000]
      });
    });

    it('should calculate accurate financial data with real test data', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2024,
          forceRefresh: 'true'
        });

      expect(response.status).toBe(200);
      
      const { data, summary } = response.body;
      
      // Verify monthly data structure
      expect(data).toHaveLength(12);
      
      const firstMonth = data[0];
      expect(firstMonth).toHaveProperty('year', 2024);
      expect(firstMonth).toHaveProperty('month', 1);
      
      // Income should be sum of all residence monthly fees
      expect(firstMonth.totalIncome).toBe(3450); // 1800 + 1650
      expect(firstMonth.incomeByCategory.monthly_fees).toBe(3450);
      
      // Expenses should include utilities + quarterly insurance (Q1)
      expect(firstMonth.totalExpenses).toBeGreaterThan(2500); // At least utilities
      expect(firstMonth.expensesByCategory.utilities).toBe(2500);
      
      // Verify quarterly pattern for insurance
      const quarterMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct (0-indexed)
      quarterMonths.forEach(monthIndex => {
        expect(data[monthIndex].expensesByCategory.insurance).toBe(6000);
      });
      
      // Non-quarter months should not have insurance charges
      [1, 2, 4, 5, 7, 8, 10, 11].forEach(monthIndex => {
        expect(data[monthIndex].expensesByCategory.insurance).toBeUndefined();
      });
      
      // Verify annual summary
      expect(summary.totalIncome).toBe(41400); // 3450 * 12
      expect(summary.totalExpenses).toBe(54000); // (2500 * 12) + (6000 * 4)
      expect(summary.netCashFlow).toBe(-12600); // 41400 - 54000
    });

    it('should handle edge cases in real data', async () => {
      // Create residence with zero monthly fees
      await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: '103',
        monthlyFees: 0,
        floor: 1,
        isActive: true
      });

      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2024,
          forceRefresh: 'true'
        });

      expect(response.status).toBe(200);
      
      // Income should still be the same (zero fees don't contribute)
      expect(response.body.data[0].totalIncome).toBe(3450);
    });
  });

  describe('Performance Testing', () => {
    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2020,
          endYear: 2030 // 10 years of data
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(response.body.data).toHaveLength(132); // 11 years * 12 months
    });

    it('should cache results effectively', async () => {
      // First request (cache miss)
      const firstResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      expect(firstResponse.status).toBe(200);
      
      // Second request (cache hit)
      const startTime = Date.now();
      const secondResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      const cacheResponseTime = Date.now() - startTime;
      
      expect(secondResponse.status).toBe(200);
      expect(cacheResponseTime).toBeLessThan(1000); // Cache hits should be very fast
      expect(secondResponse.body.meta.cached).toBe(true);
      
      // Verify data consistency
      expect(secondResponse.body.data).toEqual(firstResponse.body.data);
      expect(secondResponse.body.summary).toEqual(firstResponse.body.summary);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking database connection failures
      // Implementation depends on your database setup
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 'invalid',
          endYear: 'also-invalid'
        });

      expect(response.status).toBe(400);
    });

    it('should handle server errors gracefully', async () => {
      // Test with invalid building ID that causes server error
      const response = await request(app)
        .get('/api/dynamic-budgets/invalid-uuid-format')
        .set('Cookie', authCookie);

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
});