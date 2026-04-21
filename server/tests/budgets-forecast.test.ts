/**
 * @file Budget Forecast API Integration Tests
 * @description Integration tests for the forecast endpoint defensive error handling
 * 
 * Tests cover:
 * - Null/undefined amenities graceful handling
 * - Zero values properly honored for numeric overrides
 * - Database query errors caught and logged with stack traces
 * - Appropriate error responses (404, 500)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { db } from '../db';
import { buildings, bills, residences } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Create test Express app
const createTestApp = async (): Promise<Express> => {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware
  app.use((req: any, res, next) => {
    req.user = {
      id: 'test-user-id',
      role: 'admin',
      canAccessAllOrganizations: true,
      email: 'test@example.com',
    };
    next();
  });

  // Import and register budget routes
  const budgetRouter = (await import('../api/budgets')).default;
  app.use('/api/budgets', budgetRouter);

  return app;
};

describe('Budget Forecast API - Defensive Error Handling Tests', () => {
  let app: Express;
  let testBuildingId: string;
  let testBuildingWithNullAmenities: string;
  let testBuildingWithZeroValues: string;
  const originalConsoleError = console.error;
  const consoleErrorSpy = jest.fn();

  beforeAll(async () => {
    app = await createTestApp();

    // Spy on console.error to verify error logging with stack traces
    console.error = consoleErrorSpy;

    // Create test building with valid amenities
    const building1 = await db
      .insert(buildings)
      .values({
        name: 'Test Building - Valid Amenities',
        address: '123 Test St',
        city: 'TestCity',
        postalCode: 'H1A 1A1',
        organizationId: 'test-org-id',
        constructionDate: '2022-01-01',
        totalUnits: 10,
        totalFloors: 3,
        buildingType: 'condo',
        isActive: true,
        bankAccountStartAmount: '50000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.5',
        revenueInflationRate: '3.0',
        amenities: {
          emergencyFundMinimum: 5000,
          operatingCashMinimum: 5000,
          customBankFields: {
            reserveFund: 2000,
            maintenanceFund: 3000,
          },
          customRevenueLines: [
            { name: 'Parking Fees', amount: 500 },
          ],
          punctualRevenueGrowth: [],
        },
      })
      .returning();
    testBuildingId = building1[0].id;

    // Create test building with null amenities
    const building2 = await db
      .insert(buildings)
      .values({
        name: 'Test Building - Null Amenities',
        address: '456 Test St',
        city: 'TestCity',
        postalCode: 'H2B 2B2',
        organizationId: 'test-org-id',
        constructionDate: '2022-01-01',
        totalUnits: 10,
        totalFloors: 3,
        buildingType: 'apartment',
        isActive: true,
        bankAccountStartAmount: '50000',
        bankAccountMinimums: '10000',
        generalInflationRate: '2.5',
        revenueInflationRate: '3.0',
        amenities: null, // Explicitly null
      })
      .returning();
    testBuildingWithNullAmenities = building2[0].id;

    // Create test building with zero values
    const building3 = await db
      .insert(buildings)
      .values({
        name: 'Test Building - Zero Values',
        address: '789 Test St',
        city: 'TestCity',
        postalCode: 'H3C 3C3',
        organizationId: 'test-org-id',
        constructionDate: '2022-01-01',
        totalUnits: 10,
        totalFloors: 3,
        buildingType: 'rental',
        isActive: true,
        bankAccountStartAmount: '0', // Zero starting amount
        bankAccountMinimums: '0', // Zero minimums
        generalInflationRate: '0', // Zero inflation
        revenueInflationRate: '0', // Zero revenue inflation
        amenities: {
          emergencyFundMinimum: 0,
          operatingCashMinimum: 0,
          customBankFields: {},
          customRevenueLines: [],
          punctualRevenueGrowth: [],
        },
      })
      .returning();
    testBuildingWithZeroValues = building3[0].id;

    // Create a test bill for unplanned bills calculation
    await db.insert(bills).values({
      buildingId: testBuildingId,
      billNumber: 'TEST-FORECAST-001',
      title: 'Test Unique Bill',
      category: 'maintenance',
      vendor: 'Test Vendor',
      paymentType: 'unique', // Required for backward compatibility
      billType: 'unique',
      paymentStructure: 'single',
      costs: ['1000'], // Array of costs required
      totalAmount: '1000',
      startDate: '2024-01-15',
      status: 'paid',
    });
  });

  afterAll(async () => {
    // Restore original console.error
    console.error = originalConsoleError;

    // Clean up test data
    await db.delete(bills).where(eq(bills.buildingId, testBuildingId));
    await db.delete(buildings).where(eq(buildings.id, testBuildingId));
    await db.delete(buildings).where(eq(buildings.id, testBuildingWithNullAmenities));
    await db.delete(buildings).where(eq(buildings.id, testBuildingWithZeroValues));
  });

  beforeEach(() => {
    // Clear console.error spy before each test
    consoleErrorSpy.mockClear();
  });

  describe('Null/Undefined Amenities Handling', () => {
    it('should handle building with null amenities gracefully without crashing', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should return a successful response with forecast data
      expect(response.body).toHaveProperty('forecast');
      expect(Array.isArray(response.body.forecast)).toBe(true);
      
      // Verify amenities-related fields have safe defaults
      expect(response.body).toHaveProperty('parameters');
      expect(response.body.parameters).toHaveProperty('startingBalance');
      expect(response.body.parameters).toHaveProperty('minimumRequirement');
    });

    it('should handle building with undefined amenities object gracefully', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 6,
          viewType: 'month',
          bankAccountStartAmount: 25000,
        })
        .expect(200);

      // Should successfully process with request overrides
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.parameters.startingBalance).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing customBankFields gracefully', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should not crash when customBankFields is undefined
      expect(response.body).toHaveProperty('forecast');
      
      // Verify no errors were logged for missing customBankFields
      const configErrorLogs = consoleErrorSpy.mock.calls.filter((call: any) => 
        call.some((arg: any) => 
          typeof arg === 'string' && arg.includes('Error parsing extended config')
        )
      );
      expect(configErrorLogs.length).toBe(0);
    });

    it('should handle missing customRevenueLines gracefully', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should initialize customRevenueLines as empty array
      expect(response.body).toHaveProperty('forecast');
    });
  });

  describe('Zero Values Properly Honored', () => {
    it('should honor zero value for bankAccountStartAmount override', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
          bankAccountStartAmount: 0, // Explicitly set to zero
        })
        .expect(200);

      // Zero should be respected, not treated as falsy
      expect(response.body.parameters.startingBalance).toBe(0);
    });

    it('should honor zero value for bankAccountMinimums override', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
          bankAccountMinimums: 0, // Explicitly set to zero
        })
        .expect(200);

      // Zero minimum should be respected
      expect(response.body.parameters.minimumRequirement).toBe(0);
    });

    it('should honor zero value for generalInflationRate override', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
          generalInflationRate: 0, // Zero inflation
        })
        .expect(200);

      // Should process with zero inflation
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.parameters).toHaveProperty('generalInflationRate');
    });

    it('should honor zero value for revenueInflationRate override', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
          revenueInflationRate: 0, // Zero revenue inflation
        })
        .expect(200);

      // Should process with zero revenue inflation
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.parameters).toHaveProperty('revenueInflationRate');
    });

    it('should handle building with all zero values in database', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithZeroValues}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should process successfully with all zero defaults
      expect(response.body).toHaveProperty('forecast');
      expect(response.body.parameters.startingBalance).toBe(0);
      expect(response.body.parameters.minimumRequirement).toBe(0);
    });

    it('should honor zero value for unplannedBillsAmount override', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
          unplannedBillsAmount: 0, // Explicitly zero
        })
        .expect(200);

      // Zero unplanned bills should be respected
      expect(response.body).toHaveProperty('forecast');
    });
  });

  describe('Database Query Error Handling', () => {
    it('should return 404 for non-existent building', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post(`/api/budgets/${nonExistentId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(404);

      // Should return proper error message
      expect(response.body).toHaveProperty('_error', 'Building not found');
    });

    it('should catch and log database errors with stack trace', async () => {
      // Mock database error by using invalid building ID format
      const invalidId = 'invalid-uuid-format';
      
      const response = await request(app)
        .post(`/api/budgets/${invalidId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        });

      // Should either return 500 error or 404 depending on how the invalid ID is handled
      expect([404, 500]).toContain(response.status);

      // If it's a 500 error, verify error logging
      if (response.status === 500) {
        expect(response.body).toHaveProperty('_error');
        
        // Verify error was logged with stack trace
        const errorLogs = consoleErrorSpy.mock.calls.filter((call: any) => 
          call.some((arg: any) => 
            typeof arg === 'string' && 
            (arg.includes('Database error') || arg.includes('Stack trace'))
          )
        );
        expect(errorLogs.length).toBeGreaterThan(0);
      }
    });

    it('should return 500 with proper error message for database failures', async () => {
      // Temporarily mock db.query to simulate database error
      const originalDbQuery = db.query;
      (db as any).query = {
        buildings: {
          findFirst: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        },
      };

      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(500);

      // Restore original db.query
      (db as any).query = originalDbQuery;

      // Should return proper error message
      expect(response.body).toHaveProperty('_error', 'Failed to fetch building data');
      expect(response.body).toHaveProperty('message');
      
      // Verify error was logged with stack trace
      const errorLogs = consoleErrorSpy.mock.calls.filter((call: any) => 
        call.some((arg: any) => 
          typeof arg === 'string' && arg.includes('Database error fetching building')
        )
      );
      expect(errorLogs.length).toBeGreaterThan(0);

      // Verify stack trace was logged
      const stackTraceLogs = consoleErrorSpy.mock.calls.filter((call: any) => 
        call.some((arg: any) => 
          typeof arg === 'string' && arg.includes('Stack trace')
        )
      );
      expect(stackTraceLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation and Error Messages', () => {
    it('should provide informative error message for missing building', async () => {
      const response = await request(app)
        .post('/api/budgets/00000000-0000-0000-0000-000000000000/forecast')
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(404);

      expect(response.body._error).toBe('Building not found');
      expect(response.body._error).not.toContain('undefined');
      expect(response.body._error).not.toContain('null');
    });

    it('should not crash with malformed request data', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 'invalid', // Should fail validation
        });

      // Should return validation error, not 500
      expect([400, 422]).toContain(response.status);
    });

    it('should handle negative inflation rates within bounds', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
          generalInflationRate: -2.5, // Negative but within validation bounds
        })
        .expect(200);

      // Should process with negative inflation
      expect(response.body).toHaveProperty('forecast');
    });

    it('should handle extremely large period lengths with grace', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 360, // Maximum allowed (30 years)
          viewType: 'month',
        })
        .expect(200);

      // Should process large forecasts
      expect(response.body).toHaveProperty('forecast');
    });

    it('should reject period lengths exceeding maximum', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingId}/forecast`)
        .send({
          periodLength: 361, // Exceeds maximum
          viewType: 'month',
        });

      // Should fail validation
      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Edge Cases and Defensive Programming', () => {
    it('should handle empty customBankFields object', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithZeroValues}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      expect(response.body).toHaveProperty('forecast');
      expect(response.body.parameters.minimumRequirement).toBe(0);
    });

    it('should handle undefined emergencyFundMinimum gracefully', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should not crash with undefined emergency fund
      expect(response.body).toHaveProperty('forecast');
    });

    it('should handle undefined operatingCashMinimum gracefully', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should not crash with undefined operating cash
      expect(response.body).toHaveProperty('forecast');
    });

    it('should handle invalid amenities JSON structure gracefully', async () => {
      // Update building with invalid amenities structure
      await db
        .update(buildings)
        .set({
          amenities: { invalidField: 'invalid' } as any,
        })
        .where(eq(buildings.id, testBuildingWithNullAmenities));

      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should handle invalid structure and initialize defaults
      expect(response.body).toHaveProperty('forecast');

      // Restore null amenities for other tests
      await db
        .update(buildings)
        .set({
          amenities: null,
        })
        .where(eq(buildings.id, testBuildingWithNullAmenities));
    });

    it('should handle missing nested object properties', async () => {
      // Update building with partial amenities
      await db
        .update(buildings)
        .set({
          amenities: {
            emergencyFundMinimum: 5000,
            // Missing customBankFields, customRevenueLines, punctualRevenueGrowth
          } as any,
        })
        .where(eq(buildings.id, testBuildingWithNullAmenities));

      const response = await request(app)
        .post(`/api/budgets/${testBuildingWithNullAmenities}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should initialize missing nested objects
      expect(response.body).toHaveProperty('forecast');

      // Restore null amenities
      await db
        .update(buildings)
        .set({
          amenities: null,
        })
        .where(eq(buildings.id, testBuildingWithNullAmenities));
    });
  });

  describe('Historical Data Calculation Error Handling', () => {
    it('should handle buildings with no bills gracefully', async () => {
      // Create a building with no associated bills
      const buildingWithNoBills = await db
        .insert(buildings)
        .values({
          name: 'Building With No Bills',
          address: '999 Empty St',
          city: 'TestCity',
          postalCode: 'H9Z 9Z9',
          organizationId: 'test-org-id',
          constructionDate: '2023-01-01',
          totalUnits: 5,
          totalFloors: 2,
          buildingType: 'condo',
          isActive: true,
          bankAccountStartAmount: '30000',
        })
        .returning();

      const response = await request(app)
        .post(`/api/budgets/${buildingWithNoBills[0].id}/forecast`)
        .send({
          periodLength: 12,
          viewType: 'month',
        })
        .expect(200);

      // Should handle missing historical data
      expect(response.body).toHaveProperty('forecast');

      // Clean up
      await db.delete(buildings).where(eq(buildings.id, buildingWithNoBills[0].id));
    });
  });
});
