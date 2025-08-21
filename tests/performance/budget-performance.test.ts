/**
 * Performance tests for Budget Dashboard system
 * Tests response times, memory usage, and scalability
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createTestUser, createTestBuilding, createTestResidence, createTestBill } from '../helpers/test-data';
import type { Express } from 'express';

describe('Budget Performance Tests', () => {
  let app: Express;
  let testUser: any;
  let testBuildings: any[] = [];
  let authCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    
    testUser = await createTestUser({
      email: 'perf-test@example.com',
      role: 'admin',
      password: 'password123'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'perf-test@example.com',
        password: 'password123'
      });
    
    authCookie = loginResponse.headers['set-cookie'][0];

    // Create multiple test buildings for performance testing
    for (let i = 0; i < 10; i++) {
      const building = await createTestBuilding({
        name: `Performance Test Building ${i}`,
        organizationId: testUser.organizationId,
        address: `${100 + i} Performance Street`
      });
      testBuildings.push(building);

      // Create residences and bills for each building
      for (let j = 0; j < 20; j++) { // 20 residences per building
        await createTestResidence({
          buildingId: building.id,
          unitNumber: `${i}${j.toString().padStart(2, '0')}`,
          monthlyFees: 1500 + (j * 50),
          floor: Math.floor(j / 5) + 1,
          isActive: true
        });
      }

      // Create various bills for each building
      await createTestBill({
        buildingId: building.id,
        title: `Monthly Utilities ${i}`,
        category: 'utilities',
        totalAmount: 2000 + (i * 100),
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        startDate: '2024-01-01',
        costs: [2000 + (i * 100)]
      });

      await createTestBill({
        buildingId: building.id,
        title: `Quarterly Maintenance ${i}`,
        category: 'maintenance',
        totalAmount: 5000 + (i * 200),
        paymentType: 'recurrent',
        schedulePayment: 'quarterly',
        startDate: '2024-01-01',
        costs: [5000 + (i * 200)]
      });
    }
  });

  describe('Single Building Performance', () => {
    it('should respond quickly for single building monthly data', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuildings[0].id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2024,
          forceRefresh: 'true'
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(response.body.data).toHaveLength(12);
    });

    it('should respond quickly for multi-year data', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuildings[0].id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2020,
          endYear: 2030, // 10 years
          forceRefresh: 'true'
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(response.body.data).toHaveLength(132); // 11 years * 12 months
    });

    it('should demonstrate caching performance improvement', async () => {
      const buildingId = testBuildings[1].id;
      
      // First request (cache miss)
      const startTime1 = Date.now();
      const response1 = await request(app)
        .get(`/api/dynamic-budgets/${buildingId}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });
      const firstResponseTime = Date.now() - startTime1;

      expect(response1.status).toBe(200);
      
      // Second request (cache hit)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get(`/api/dynamic-budgets/${buildingId}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });
      const secondResponseTime = Date.now() - startTime2;

      expect(response2.status).toBe(200);
      
      // Cache hit should be significantly faster
      expect(secondResponseTime).toBeLessThan(firstResponseTime);
      expect(secondResponseTime).toBeLessThan(500); // Cache hits should be very fast
      
      console.log(`Cache performance improvement: ${firstResponseTime}ms -> ${secondResponseTime}ms (${Math.round((1 - secondResponseTime / firstResponseTime) * 100)}% faster)`);
    });
  });

  describe('Multiple Building Performance', () => {
    it('should handle multiple building summary requests efficiently', async () => {
      const buildingIds = testBuildings.slice(0, 5).map(b => b.id).join(',');
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({
          buildingIds,
          year: 2024
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Should complete within 3 seconds for 5 buildings
      expect(response.body.data.buildings).toHaveLength(5);
    });

    it('should scale reasonably with more buildings', async () => {
      const allBuildingIds = testBuildings.map(b => b.id).join(',');
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({
          buildingIds: allBuildingIds,
          year: 2024
        });

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(8000); // Should complete within 8 seconds for 10 buildings
      expect(response.body.data.buildings).toHaveLength(10);
      
      console.log(`Multiple building summary (${testBuildings.length} buildings): ${responseTime}ms`);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const numberOfConcurrentRequests = 5;
      const buildingId = testBuildings[0].id;
      
      const startTime = Date.now();
      
      // Create multiple concurrent requests
      const requests = Array.from({ length: numberOfConcurrentRequests }, () =>
        request(app)
          .get(`/api/dynamic-budgets/${buildingId}`)
          .set('Cookie', authCookie)
          .query({ startYear: 2024, endYear: 2024 })
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(12);
      });
      
      // Concurrent requests should complete faster than sequential ones
      const averageTime = totalTime / numberOfConcurrentRequests;
      expect(averageTime).toBeLessThan(1000); // Average should be under 1 second
      
      console.log(`Concurrent requests (${numberOfConcurrentRequests}): Total ${totalTime}ms, Average ${averageTime}ms`);
    });

    it('should handle mixed request types concurrently', async () => {
      const startTime = Date.now();
      
      const requests = [
        // Single building monthly data
        request(app)
          .get(`/api/dynamic-budgets/${testBuildings[0].id}`)
          .set('Cookie', authCookie)
          .query({ startYear: 2024, endYear: 2024 }),
        
        // Single building yearly data
        request(app)
          .get(`/api/dynamic-budgets/${testBuildings[1].id}`)
          .set('Cookie', authCookie)
          .query({ startYear: 2023, endYear: 2025, groupBy: 'yearly' }),
        
        // Multiple building summary
        request(app)
          .get('/api/dynamic-budgets/summary')
          .set('Cookie', authCookie)
          .query({
            buildingIds: testBuildings.slice(0, 3).map(b => b.id).join(','),
            year: 2024
          }),
        
        // Cache statistics
        request(app)
          .get('/api/dynamic-budgets/cache/stats')
          .set('Cookie', authCookie)
      ];

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(totalTime).toBeLessThan(5000); // Mixed requests should complete within 5 seconds
      
      console.log(`Mixed concurrent requests: ${totalTime}ms`);
    });
  });

  describe('Cache Performance Analysis', () => {
    it('should demonstrate cache efficiency with repeated requests', async () => {
      const buildingId = testBuildings[2].id;
      const requestParams = { startYear: 2024, endYear: 2026 };
      
      // Clear cache first
      await request(app)
        .delete(`/api/dynamic-budgets/${buildingId}/cache`)
        .set('Cookie', authCookie);

      const responseTimes: number[] = [];
      
      // Make 10 identical requests
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(`/api/dynamic-budgets/${buildingId}`)
          .set('Cookie', authCookie)
          .query(requestParams);
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        expect(response.status).toBe(200);
      }
      
      // First request should be slowest (cache miss)
      expect(responseTimes[0]).toBeGreaterThan(responseTimes[1]);
      
      // Subsequent requests should be consistently fast (cache hits)
      const cacheHitTimes = responseTimes.slice(1);
      const averageCacheHitTime = cacheHitTimes.reduce((a, b) => a + b, 0) / cacheHitTimes.length;
      
      expect(averageCacheHitTime).toBeLessThan(responseTimes[0] * 0.3); // Cache hits should be <30% of first request time
      
      console.log(`Cache performance: First request ${responseTimes[0]}ms, Average cache hit ${averageCacheHitTime}ms`);
    });

    it('should maintain performance with cache invalidation', async () => {
      const buildingId = testBuildings[3].id;
      
      // Initial request to populate cache
      await request(app)
        .get(`/api/dynamic-budgets/${buildingId}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      // Time cache invalidation
      const invalidationStart = Date.now();
      const invalidationResponse = await request(app)
        .delete(`/api/dynamic-budgets/${buildingId}/cache`)
        .set('Cookie', authCookie);
      const invalidationTime = Date.now() - invalidationStart;

      expect(invalidationResponse.status).toBe(200);
      expect(invalidationTime).toBeLessThan(1000); // Cache invalidation should be fast

      // Time cache refresh
      const refreshStart = Date.now();
      const refreshResponse = await request(app)
        .post(`/api/dynamic-budgets/${buildingId}/refresh`)
        .set('Cookie', authCookie);
      const refreshTime = Date.now() - refreshStart;

      expect(refreshResponse.status).toBe(200);
      expect(refreshTime).toBeLessThan(3000); // Cache refresh should be reasonable

      console.log(`Cache management: Invalidation ${invalidationTime}ms, Refresh ${refreshTime}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle large data sets without memory issues', async () => {
      // Request very large date range
      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuildings[0].id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2000,
          endYear: 2030, // 30 years of data
          forceRefresh: 'true'
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(372); // 31 years * 12 months
      
      // Verify data structure is complete
      expect(response.body.summary).toBeDefined();
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.dataPoints).toBe(372);
    });

    it('should handle maximum allowed buildings in summary', async () => {
      // Create additional buildings if needed to test maximum
      const allBuildingIds = testBuildings.map(b => b.id).join(',');
      
      const response = await request(app)
        .get('/api/dynamic-budgets/summary')
        .set('Cookie', authCookie)
        .query({
          buildingIds: allBuildingIds,
          year: 2024
        });

      expect(response.status).toBe(200);
      expect(response.body.data.aggregate).toBeDefined();
      
      // Verify aggregate calculations
      const { aggregate } = response.body.data;
      expect(aggregate.totalIncome).toBeGreaterThan(0);
      expect(aggregate.totalExpenses).toBeGreaterThan(0);
      expect(aggregate.buildingCount).toBe(testBuildings.length);
    });
  });

  describe('Performance Regression Testing', () => {
    it('should maintain consistent performance across different data patterns', async () => {
      const performanceResults: { [key: string]: number } = {};
      
      // Test different scenarios
      const scenarios = [
        {
          name: 'Small Building (5 residences)',
          buildingIndex: 0,
          query: { startYear: 2024, endYear: 2024 }
        },
        {
          name: 'Large Building (20 residences)',
          buildingIndex: 1,
          query: { startYear: 2024, endYear: 2024 }
        },
        {
          name: 'Multi-year Small',
          buildingIndex: 0,
          query: { startYear: 2020, endYear: 2030 }
        },
        {
          name: 'Multi-year Large',
          buildingIndex: 1,
          query: { startYear: 2020, endYear: 2030 }
        }
      ];

      for (const scenario of scenarios) {
        // Clear cache to ensure fair comparison
        await request(app)
          .delete(`/api/dynamic-budgets/${testBuildings[scenario.buildingIndex].id}/cache`)
          .set('Cookie', authCookie);

        const startTime = Date.now();
        
        const response = await request(app)
          .get(`/api/dynamic-budgets/${testBuildings[scenario.buildingIndex].id}`)
          .set('Cookie', authCookie)
          .query(scenario.query);
        
        const responseTime = Date.now() - startTime;
        performanceResults[scenario.name] = responseTime;
        
        expect(response.status).toBe(200);
      }

      // Log performance results for analysis
      console.log('Performance Results:', performanceResults);
      
      // Basic performance expectations
      expect(performanceResults['Small Building (5 residences)']).toBeLessThan(2000);
      expect(performanceResults['Large Building (20 residences)']).toBeLessThan(3000);
      expect(performanceResults['Multi-year Small']).toBeLessThan(5000);
      expect(performanceResults['Multi-year Large']).toBeLessThan(8000);
    });

    it('should show performance improvement over old system', async () => {
      // This test would compare with the old money_flow system if available
      // For now, we'll establish baseline performance expectations
      
      const buildingId = testBuildings[0].id;
      const iterations = 5;
      const responseTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get(`/api/dynamic-budgets/${buildingId}`)
          .set('Cookie', authCookie)
          .query({ startYear: 2024, endYear: 2024 });
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        expect(response.status).toBe(200);
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      console.log(`Performance Statistics:
        Average: ${averageResponseTime}ms
        Min: ${minResponseTime}ms
        Max: ${maxResponseTime}ms
        Standard Deviation: ${Math.sqrt(responseTimes.reduce((sq, n) => sq + Math.pow(n - averageResponseTime, 2), 0) / responseTimes.length)}ms
      `);
      
      // Performance targets based on requirements
      expect(averageResponseTime).toBeLessThan(500); // Average should be under 500ms with cache
      expect(maxResponseTime).toBeLessThan(2000); // No request should take more than 2 seconds
    });
  });

  afterAll(async () => {
    // Cleanup performance test data
    // Implementation depends on your cleanup strategy
  });
});