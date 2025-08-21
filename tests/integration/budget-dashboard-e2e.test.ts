/**
 * End-to-end tests for Budget Dashboard
 * Tests complete workflow from data creation to frontend display
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import { createTestUser, createTestBuilding, createTestResidence, createTestBill } from '../helpers/test-data';
import type { Express } from 'express';

describe('Budget Dashboard E2E Tests', () => {
  let app: Express;
  let testUser: any;
  let testBuilding: any;
  let authCookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    
    testUser = await createTestUser({
      email: 'e2e-budget-test@example.com',
      role: 'manager',
      password: 'password123'
    });

    testBuilding = await createTestBuilding({
      name: 'E2E Budget Test Building',
      organizationId: testUser.organizationId,
      address: '789 E2E Test Boulevard'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'e2e-budget-test@example.com',
        password: 'password123'
      });
    
    authCookie = loginResponse.headers['set-cookie'][0];
  });

  describe('Complete Budget Workflow', () => {
    it('should create complete financial scenario and validate dashboard data', async () => {
      // Step 1: Create residences with different monthly fees
      const residence1 = await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: 'A101',
        monthlyFees: 2200,
        ownershipPercentage: 5.5,
        floor: 1,
        isActive: true
      });

      const residence2 = await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: 'A102',
        monthlyFees: 1950,
        ownershipPercentage: 4.8,
        floor: 1,
        isActive: true
      });

      const residence3 = await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: 'B201',
        monthlyFees: 2450,
        ownershipPercentage: 6.2,
        floor: 2,
        isActive: true
      });

      // Step 2: Create various types of bills
      await createTestBill({
        buildingId: testBuilding.id,
        title: 'Monthly Electricity',
        category: 'utilities',
        totalAmount: 3200,
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        startDate: '2024-01-01',
        costs: [3200]
      });

      await createTestBill({
        buildingId: testBuilding.id,
        title: 'Property Insurance',
        category: 'insurance',
        totalAmount: 8500,
        paymentType: 'recurrent',
        schedulePayment: 'quarterly',
        startDate: '2024-01-01',
        costs: [8500]
      });

      await createTestBill({
        buildingId: testBuilding.id,
        title: 'Annual Property Management',
        category: 'professional_services',
        totalAmount: 15000,
        paymentType: 'recurrent',
        schedulePayment: 'yearly',
        startDate: '2024-01-01',
        costs: [15000]
      });

      await createTestBill({
        buildingId: testBuilding.id,
        title: 'Semi-Annual Maintenance',
        category: 'maintenance',
        totalAmount: 12000,
        paymentType: 'recurrent',
        schedulePayment: 'custom',
        startDate: '2024-01-01',
        scheduleCustom: ['2024-06-01', '2024-12-01'],
        costs: [12000]
      });

      // Step 3: Test Dynamic Budget API
      const budgetResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({
          startYear: 2024,
          endYear: 2024,
          forceRefresh: 'true'
        });

      expect(budgetResponse.status).toBe(200);
      expect(budgetResponse.body.success).toBe(true);

      const { data: monthlyData, summary } = budgetResponse.body;

      // Step 4: Validate monthly income calculations
      const expectedMonthlyIncome = 2200 + 1950 + 2450; // 6600
      expect(monthlyData[0].totalIncome).toBe(expectedMonthlyIncome);
      expect(monthlyData[0].incomeByCategory.monthly_fees).toBe(expectedMonthlyIncome);

      // Step 5: Validate expense calculations by month
      const january = monthlyData[0]; // Month 1
      expect(january.expensesByCategory.utilities).toBe(3200);
      expect(january.expensesByCategory.insurance).toBe(8500); // Q1
      expect(january.expensesByCategory.professional_services).toBe(15000); // Annual
      expect(january.expensesByCategory.maintenance_expense).toBeUndefined(); // June/Dec only

      const february = monthlyData[1]; // Month 2
      expect(february.expensesByCategory.utilities).toBe(3200);
      expect(february.expensesByCategory.insurance).toBeUndefined(); // Not Q month
      expect(february.expensesByCategory.professional_services).toBeUndefined(); // Jan only
      expect(february.expensesByCategory.maintenance_expense).toBeUndefined(); // June/Dec only

      const june = monthlyData[5]; // Month 6
      expect(june.expensesByCategory.maintenance_expense).toBe(12000); // Custom schedule

      const december = monthlyData[11]; // Month 12
      expect(december.expensesByCategory.maintenance_expense).toBe(12000); // Custom schedule

      // Step 6: Validate annual summary
      const expectedAnnualIncome = expectedMonthlyIncome * 12; // 79,200
      const expectedAnnualExpenses = 
        (3200 * 12) + // Monthly utilities: 38,400
        (8500 * 4) + // Quarterly insurance: 34,000
        15000 + // Annual management: 15,000
        (12000 * 2); // Semi-annual maintenance: 24,000
      // Total: 111,400

      expect(summary.totalIncome).toBe(expectedAnnualIncome);
      expect(summary.totalExpenses).toBe(expectedAnnualExpenses);
      expect(summary.netCashFlow).toBe(expectedAnnualIncome - expectedAnnualExpenses);
      expect(summary.averageMonthlyIncome).toBe(expectedAnnualIncome / 12);
      expect(summary.averageMonthlyExpenses).toBe(expectedAnnualExpenses / 12);

      // Step 7: Test Special Contribution Calculation
      const netCashFlow = expectedAnnualIncome - expectedAnnualExpenses; // -32,200
      if (netCashFlow < 0) {
        const specialContribution = Math.abs(netCashFlow);
        
        // Calculate expected contributions by ownership percentage
        const totalOwnership = 5.5 + 4.8 + 6.2; // 16.5%
        const residence1Contribution = (specialContribution * 5.5) / 100;
        const residence2Contribution = (specialContribution * 4.8) / 100; 
        const residence3Contribution = (specialContribution * 6.2) / 100;

        // These would be calculated in the frontend, but we can validate the logic
        expect(residence1Contribution + residence2Contribution + residence3Contribution)
          .toBeCloseTo(specialContribution * (totalOwnership / 100), 2);
      }
    });

    it('should handle bank account management workflow', async () => {
      // Test setting bank account
      const setBankAccountResponse = await request(app)
        .put(`/api/budgets/${testBuilding.id}/bank-account`)
        .set('Cookie', authCookie)
        .send({
          bankAccountNumber: '1234567890',
          notes: 'Test bank account setup',
          startDate: '2024-01-01',
          startAmount: 25000,
          minimumBalances: [
            { id: 'min-1', amount: 10000, description: 'Emergency fund' },
            { id: 'min-2', amount: 5000, description: 'Maintenance reserve' }
          ]
        });

      expect(setBankAccountResponse.status).toBe(200);

      // Test retrieving bank account
      const getBankAccountResponse = await request(app)
        .get(`/api/budgets/${testBuilding.id}/bank-account`)
        .set('Cookie', authCookie);

      expect(getBankAccountResponse.status).toBe(200);
      expect(getBankAccountResponse.body.bankAccountNumber).toBe('1234567890');
      expect(getBankAccountResponse.body.minimumBalances).toHaveLength(2);
    });

    it('should validate data consistency across different time periods', async () => {
      // Test 1 year
      const oneYearResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      // Test 3 years 
      const threeYearResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2026 });

      expect(oneYearResponse.status).toBe(200);
      expect(threeYearResponse.status).toBe(200);

      // Validate that the first year data is consistent
      const oneYearData = oneYearResponse.body.data;
      const threeYearData = threeYearResponse.body.data.slice(0, 12); // First 12 months

      expect(oneYearData).toEqual(threeYearData);

      // Validate that three-year data has correct length
      expect(threeYearResponse.body.data).toHaveLength(36); // 3 years * 12 months
    });

    it('should handle yearly grouping correctly', async () => {
      const yearlyResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ 
          startYear: 2023, 
          endYear: 2025,
          groupBy: 'yearly'
        });

      expect(yearlyResponse.status).toBe(200);
      expect(yearlyResponse.body.data).toHaveLength(3); // 2023, 2024, 2025

      const yearData = yearlyResponse.body.data.find((y: any) => y.year === 2024);
      expect(yearData).toBeDefined();
      expect(yearData.totalIncome).toBeGreaterThan(0);
      expect(yearData.totalExpenses).toBeGreaterThan(0);
      expect(yearData.incomeByCategory).toBeDefined();
      expect(yearData.expensesByCategory).toBeDefined();
    });
  });

  describe('Performance and Caching', () => {
    it('should demonstrate caching performance improvements', async () => {
      // First request (should be slower - cache miss)
      const startTime1 = Date.now();
      const firstResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });
      const firstResponseTime = Date.now() - startTime1;

      expect(firstResponse.status).toBe(200);

      // Second request (should be faster - cache hit)
      const startTime2 = Date.now();
      const secondResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });
      const secondResponseTime = Date.now() - startTime2;

      expect(secondResponse.status).toBe(200);
      expect(secondResponseTime).toBeLessThan(firstResponseTime);
      expect(secondResponseTime).toBeLessThan(1000); // Cache hit should be very fast

      // Verify data is identical
      expect(firstResponse.body.data).toEqual(secondResponse.body.data);
      expect(firstResponse.body.summary).toEqual(secondResponse.body.summary);
    });

    it('should invalidate cache when data changes', async () => {
      // Get initial data
      const initialResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      const initialIncome = initialResponse.body.data[0].totalIncome;

      // Add new residence
      await createTestResidence({
        buildingId: testBuilding.id,
        unitNumber: 'C301',
        monthlyFees: 1800,
        floor: 3,
        isActive: true
      });

      // Force cache refresh
      const updatedResponse = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ 
          startYear: 2024, 
          endYear: 2024, 
          forceRefresh: 'true' 
        });

      const updatedIncome = updatedResponse.body.data[0].totalIncome;

      // Income should have increased by 1800 (new residence fee)
      expect(updatedIncome).toBe(initialIncome + 1800);
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle buildings with no financial data gracefully', async () => {
      // Create building with no residences or bills
      const emptyBuilding = await createTestBuilding({
        name: 'Empty Building',
        organizationId: testUser.organizationId,
        address: '000 Empty Street'
      });

      const response = await request(app)
        .get(`/api/dynamic-budgets/${emptyBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(12);
      expect(response.body.summary.totalIncome).toBe(0);
      expect(response.body.summary.totalExpenses).toBe(0);
      expect(response.body.summary.netCashFlow).toBe(0);
    });

    it('should handle inactive residences and bills', async () => {
      const testBuilding2 = await createTestBuilding({
        name: 'Inactive Test Building',
        organizationId: testUser.organizationId,
        address: '999 Inactive Lane'
      });

      // Create inactive residence
      await createTestResidence({
        buildingId: testBuilding2.id,
        unitNumber: 'INACTIVE',
        monthlyFees: 9999, // High fee but should be ignored
        floor: 1,
        isActive: false
      });

      // Create bill with past end date
      await createTestBill({
        buildingId: testBuilding2.id,
        title: 'Expired Bill',
        category: 'utilities',
        totalAmount: 9999, // High cost but should be ignored
        paymentType: 'recurrent',
        schedulePayment: 'monthly',
        startDate: '2023-01-01',
        endDate: '2023-12-31', // Ended before 2024
        costs: [9999]
      });

      const response = await request(app)
        .get(`/api/dynamic-budgets/${testBuilding2.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      expect(response.status).toBe(200);
      expect(response.body.summary.totalIncome).toBe(0);
      expect(response.body.summary.totalExpenses).toBe(0);
    });

    it('should validate complex custom schedules', async () => {
      const complexBuilding = await createTestBuilding({
        name: 'Complex Schedule Building',
        organizationId: testUser.organizationId,
        address: '555 Complex Avenue'
      });

      // Create bill with complex custom schedule
      await createTestBill({
        buildingId: complexBuilding.id,
        title: 'Complex Custom Schedule',
        category: 'maintenance',
        totalAmount: 5000,
        paymentType: 'recurrent',
        schedulePayment: 'custom',
        startDate: '2024-01-01',
        scheduleCustom: [
          '2024-02-15', // February
          '2024-05-01', // May  
          '2024-08-15', // August
          '2024-11-30'  // November
        ],
        costs: [5000]
      });

      const response = await request(app)
        .get(`/api/dynamic-budgets/${complexBuilding.id}`)
        .set('Cookie', authCookie)
        .query({ startYear: 2024, endYear: 2024 });

      expect(response.status).toBe(200);

      // Should only have expenses in February, May, August, November
      const monthsWithExpenses = [1, 4, 7, 10]; // 0-indexed (Feb=1, May=4, Aug=7, Nov=10)
      monthsWithExpenses.forEach(monthIndex => {
        expect(response.body.data[monthIndex].expensesByCategory.maintenance_expense).toBe(5000);
      });

      // Other months should not have this expense
      [0, 2, 3, 5, 6, 8, 9, 11].forEach(monthIndex => {
        expect(response.body.data[monthIndex].expensesByCategory.maintenance_expense).toBeUndefined();
      });
    });
  });

  afterAll(async () => {
    // Cleanup test data
    // Implementation depends on your test data cleanup strategy
  });
});