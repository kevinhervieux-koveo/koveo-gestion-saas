/**
 * @file Capital Investments CRUD Operations Integration Tests
 * @description Comprehensive tests for capital investments endpoints with mode filters and database operations
 */

import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { sql } from '../../server/db';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

// Import the actual budget router
import budgetRouter from '../../server/api/budgets';

// Test types
interface TestBuilding {
  id: string;
  organizationId: string;
  name: string;
}

interface TestUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'demo_manager';
  organizations?: string[];
}

interface TestOrganization {
  id: string;
  name: string;
  domain: string;
}

interface TestCapitalInvestment {
  id: string;
  buildingId: string;
  title: string;
  description: string;
  amount: number;
  targetDate: string;
  urgency: 'not_urgent' | 'urgent' | 'suggested';
  type: 'auto_generated' | 'custom';
  ownershipType: 'residences' | 'owner';
  category: string;
}

// Extend Express Request type for authentication
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'manager' | 'demo_manager' | 'tenant' | 'resident';
  organizations?: string[];
  email?: string;
  username?: string;
}

describe('Capital Investments CRUD Integration Tests', () => {
  let app: express.Application;
  let testOrg: TestOrganization;
  let testUser: TestUser;
  let testBuilding: TestBuilding;
  
  // Test data cleanup tracking
  const createdIds = {
    organizations: [] as string[],
    users: [] as string[],
    buildings: [] as string[],
    capitalInvestments: [] as string[],
  };

  beforeAll(async () => {
    // Create Express app with all necessary middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Set up session middleware
    app.use(session({
      secret: 'test-secret-capital-investments',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Create test organization
    testOrg = {
      id: uuidv4(),
      name: 'Capital Investments Test Org',
      domain: 'capital-test.com',
    };

    await sql`
      INSERT INTO organizations (id, name, domain, created_at, updated_at)
      VALUES (${testOrg.id}, ${testOrg.name}, ${testOrg.domain}, NOW(), NOW())
    `;
    createdIds.organizations.push(testOrg.id);

    // Create test user
    testUser = {
      id: uuidv4(),
      username: 'capital-test-user',
      email: 'capital-test@example.com',
      role: 'admin',
    };

    await sql`
      INSERT INTO users (id, username, email, role, created_at, updated_at)
      VALUES (${testUser.id}, ${testUser.username}, ${testUser.email}, ${testUser.role}, NOW(), NOW())
    `;
    createdIds.users.push(testUser.id);

    // Create test building
    testBuilding = {
      id: uuidv4(),
      organizationId: testOrg.id,
      name: 'Capital Investments Test Building',
    };

    await sql`
      INSERT INTO buildings (
        id, organization_id, name, address, city, province, postal_code, 
        building_type, total_units, created_at, updated_at
      )
      VALUES (
        ${testBuilding.id}, ${testBuilding.organizationId}, ${testBuilding.name}, 
        '789 Capital Street', 'Montreal', 'QC', 'H3C 3C3',
        'apartment', 40, NOW(), NOW()
      )
    `;
    createdIds.buildings.push(testBuilding.id);

    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = {
        id: testUser.id,
        role: testUser.role,
        organizations: [testOrg.id],
        email: testUser.email,
        username: testUser.username,
      };
      next();
    });

    app.use('/api/budgets', budgetRouter);
  }, 30000);

  afterEach(async () => {
    // Clean up capital investments after each test
    if (createdIds.capitalInvestments.length > 0) {
      await sql`DELETE FROM capital_investments WHERE id = ANY(${createdIds.capitalInvestments})`;
      createdIds.capitalInvestments.length = 0;
    }
  }, 15000);

  afterAll(async () => {
    // Final cleanup
    if (createdIds.buildings.length > 0) {
      await sql`DELETE FROM buildings WHERE id = ANY(${createdIds.buildings})`;
    }
    if (createdIds.users.length > 0) {
      await sql`DELETE FROM users WHERE id = ANY(${createdIds.users})`;
    }
    if (createdIds.organizations.length > 0) {
      await sql`DELETE FROM organizations WHERE id = ANY(${createdIds.organizations})`;
    }
  }, 15000);

  describe('Capital Investments CREATE Operations', () => {
    it('should create urgent capital investment successfully', async () => {
      const urgentInvestment = {
        title: 'Emergency Roof Repair',
        description: 'Urgent roof leak repair needed immediately',
        amount: 75000,
        targetDate: '2024-08-15',
        urgency: 'urgent',
        type: 'custom',
        ownershipType: 'residences',
        category: 'emergency_repair',
      };

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/capital-investments`)
        .send(urgentInvestment);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('capitalInvestment');
      
      const created = response.body.capitalInvestment;
      expect(created).toHaveProperty('id');
      expect(created.buildingId).toBe(testBuilding.id);
      expect(created.title).toBe(urgentInvestment.title);
      expect(created.urgency).toBe(urgentInvestment.urgency);
      expect(parseFloat(created.amount)).toBe(urgentInvestment.amount);

      createdIds.capitalInvestments.push(created.id);

      // Verify database storage
      const dbCheck = await sql`
        SELECT * FROM capital_investments WHERE id = ${created.id}
      `;
      
      expect(dbCheck).toHaveLength(1);
      expect(dbCheck[0].title).toBe(urgentInvestment.title);
      expect(dbCheck[0].urgency).toBe(urgentInvestment.urgency);
    });

    it('should create suggested capital investment with auto-generated type', async () => {
      const suggestedInvestment = {
        title: 'Elevator Modernization',
        description: 'Upgrade elevator system for better efficiency',
        amount: 125000,
        targetDate: '2025-03-01',
        urgency: 'suggested',
        type: 'auto_generated',
        ownershipType: 'residences',
        category: 'improvement',
      };

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/capital-investments`)
        .send(suggestedInvestment);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      const created = response.body.capitalInvestment;
      expect(created.type).toBe('auto_generated');
      expect(created.urgency).toBe('suggested');
      
      createdIds.capitalInvestments.push(created.id);
    });

    it('should validate required fields and reject invalid data', async () => {
      const invalidInvestment = {
        // Missing required title
        amount: -5000, // Invalid negative amount
        urgency: 'invalid_urgency', // Invalid enum value
        targetDate: 'invalid-date-format',
      };

      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/capital-investments`)
        .send(invalidInvestment);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('_error');
      expect(response.body._error).toContain('validation');
    });
  });

  describe('Capital Investments READ Operations', () => {
    beforeEach(async () => {
      // Create test data for read operations
      const testInvestments = [
        {
          id: uuidv4(),
          title: 'Urgent Plumbing Fix',
          amount: 25000,
          urgency: 'urgent',
          targetDate: '2024-09-01',
          type: 'custom',
        },
        {
          id: uuidv4(),
          title: 'Suggested HVAC Upgrade',
          amount: 80000,
          urgency: 'suggested',
          targetDate: '2025-05-01',
          type: 'auto_generated',
        },
        {
          id: uuidv4(),
          title: 'Non-urgent Landscaping',
          amount: 15000,
          urgency: 'not_urgent',
          targetDate: '2025-08-01',
          type: 'custom',
        },
      ];

      for (const investment of testInvestments) {
        await sql`
          INSERT INTO capital_investments (
            id, building_id, title, amount, target_date, urgency, type, 
            ownership_type, category, created_at, updated_at
          )
          VALUES (
            ${investment.id}, ${testBuilding.id}, ${investment.title}, ${investment.amount},
            ${investment.targetDate}, ${investment.urgency}, ${investment.type},
            'residences', 'maintenance', NOW(), NOW()
          )
        `;
        createdIds.capitalInvestments.push(investment.id);
      }
    });

    it('should retrieve all capital investments for building', async () => {
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('capitalInvestments');
      expect(Array.isArray(response.body.capitalInvestments)).toBe(true);
      expect(response.body.capitalInvestments).toHaveLength(3);
      
      // Verify structure of returned investments
      const investments = response.body.capitalInvestments;
      investments.forEach((investment: any) => {
        expect(investment).toHaveProperty('id');
        expect(investment).toHaveProperty('title');
        expect(investment).toHaveProperty('amount');
        expect(investment).toHaveProperty('urgency');
        expect(investment).toHaveProperty('type');
        expect(['urgent', 'suggested', 'not_urgent']).toContain(investment.urgency);
        expect(['custom', 'auto_generated']).toContain(investment.type);
      });
    });

    it('should filter capital investments by urgency mode', async () => {
      const urgentResponse = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments`)
        .query({ mode: 'urgent' });

      expect(urgentResponse.status).toBe(200);
      const urgentInvestments = urgentResponse.body.capitalInvestments;
      expect(urgentInvestments).toHaveLength(1);
      expect(urgentInvestments[0].urgency).toBe('urgent');
      expect(urgentInvestments[0].title).toBe('Urgent Plumbing Fix');

      const suggestedResponse = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments`)
        .query({ mode: 'suggested' });

      expect(suggestedResponse.status).toBe(200);
      const suggestedInvestments = suggestedResponse.body.capitalInvestments;
      expect(suggestedInvestments).toHaveLength(2); // Should include 'suggested' and 'not_urgent'
      suggestedInvestments.forEach((investment: any) => {
        expect(['suggested', 'not_urgent']).toContain(investment.urgency);
      });
    });

    it('should retrieve specific capital investment by ID', async () => {
      const allInvestments = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments`);
      
      const firstInvestment = allInvestments.body.capitalInvestments[0];
      
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments/${firstInvestment.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('capitalInvestment');
      expect(response.body.capitalInvestment.id).toBe(firstInvestment.id);
      expect(response.body.capitalInvestment.title).toBe(firstInvestment.title);
    });

    it('should return 404 for non-existent investment', async () => {
      const nonExistentId = uuidv4();
      const response = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error', 'Capital investment not found');
    });
  });

  describe('Capital Investments UPDATE Operations', () => {
    let testInvestmentId: string;

    beforeEach(async () => {
      // Create a test investment for update operations
      testInvestmentId = uuidv4();
      await sql`
        INSERT INTO capital_investments (
          id, building_id, title, description, amount, target_date, urgency, 
          type, ownership_type, category, created_at, updated_at
        )
        VALUES (
          ${testInvestmentId}, ${testBuilding.id}, 'Original Title', 'Original description',
          50000, '2024-12-01', 'suggested', 'custom', 'residences', 'maintenance', NOW(), NOW()
        )
      `;
      createdIds.capitalInvestments.push(testInvestmentId);
    });

    it('should update capital investment successfully', async () => {
      const updateData = {
        title: 'Updated Investment Title',
        description: 'Updated investment description',
        amount: 75000,
        targetDate: '2025-01-15',
        urgency: 'urgent',
        category: 'emergency_repair',
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/capital-investments/${testInvestmentId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('capitalInvestment');
      
      const updated = response.body.capitalInvestment;
      expect(updated.title).toBe(updateData.title);
      expect(updated.description).toBe(updateData.description);
      expect(parseFloat(updated.amount)).toBe(updateData.amount);
      expect(updated.urgency).toBe(updateData.urgency);

      // Verify database was updated
      const dbCheck = await sql`
        SELECT * FROM capital_investments WHERE id = ${testInvestmentId}
      `;
      
      const dbInvestment = dbCheck[0];
      expect(dbInvestment.title).toBe(updateData.title);
      expect(parseFloat(dbInvestment.amount)).toBe(updateData.amount);
      expect(dbInvestment.urgency).toBe(updateData.urgency);
    });

    it('should handle partial updates correctly', async () => {
      const partialUpdate = {
        title: 'Partially Updated Title',
        amount: 60000,
        // Other fields should remain unchanged
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/capital-investments/${testInvestmentId}`)
        .send(partialUpdate);

      expect(response.status).toBe(200);
      
      const updated = response.body.capitalInvestment;
      expect(updated.title).toBe(partialUpdate.title);
      expect(parseFloat(updated.amount)).toBe(partialUpdate.amount);
      expect(updated.urgency).toBe('suggested'); // Should remain unchanged
      expect(updated.type).toBe('custom'); // Should remain unchanged
    });

    it('should validate update data and reject invalid updates', async () => {
      const invalidUpdate = {
        amount: -10000, // Negative amount should be rejected
        urgency: 'invalid_urgency',
        targetDate: 'not-a-date',
      };

      const response = await request(app)
        .put(`/api/budgets/${testBuilding.id}/capital-investments/${testInvestmentId}`)
        .send(invalidUpdate);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('_error');
    });
  });

  describe('Capital Investments DELETE Operations', () => {
    let testInvestmentId: string;

    beforeEach(async () => {
      // Create a test investment for delete operations
      testInvestmentId = uuidv4();
      await sql`
        INSERT INTO capital_investments (
          id, building_id, title, amount, target_date, urgency, type, 
          ownership_type, category, created_at, updated_at
        )
        VALUES (
          ${testInvestmentId}, ${testBuilding.id}, 'Investment to Delete', 30000,
          '2024-11-01', 'not_urgent', 'custom', 'residences', 'improvement', NOW(), NOW()
        )
      `;
      createdIds.capitalInvestments.push(testInvestmentId);
    });

    it('should delete capital investment successfully', async () => {
      const response = await request(app)
        .delete(`/api/budgets/${testBuilding.id}/capital-investments/${testInvestmentId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Capital investment deleted successfully');

      // Verify it was deleted from database
      const dbCheck = await sql`
        SELECT * FROM capital_investments WHERE id = ${testInvestmentId}
      `;
      
      expect(dbCheck).toHaveLength(0);

      // Remove from cleanup tracking since it's already deleted
      const index = createdIds.capitalInvestments.indexOf(testInvestmentId);
      if (index > -1) {
        createdIds.capitalInvestments.splice(index, 1);
      }
    });

    it('should return 404 when deleting non-existent investment', async () => {
      const nonExistentId = uuidv4();
      const response = await request(app)
        .delete(`/api/budgets/${testBuilding.id}/capital-investments/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error', 'Capital investment not found');
    });
  });

  describe('Capital Investments Impact on Forecasts', () => {
    beforeEach(async () => {
      // Create test capital investments with different urgencies
      const investments = [
        {
          id: uuidv4(),
          title: 'Urgent Foundation Repair',
          amount: 100000,
          urgency: 'urgent',
          targetDate: '2024-10-01',
        },
        {
          id: uuidv4(),
          title: 'Suggested Parking Lot Repaving',
          amount: 45000,
          urgency: 'suggested',
          targetDate: '2025-04-01',
        },
        {
          id: uuidv4(),
          title: 'Future Pool Installation',
          amount: 200000,
          urgency: 'not_urgent',
          targetDate: '2026-06-01',
        },
      ];

      for (const investment of investments) {
        await sql`
          INSERT INTO capital_investments (
            id, building_id, title, amount, target_date, urgency, type,
            ownership_type, category, created_at, updated_at
          )
          VALUES (
            ${investment.id}, ${testBuilding.id}, ${investment.title}, ${investment.amount},
            ${investment.targetDate}, ${investment.urgency}, 'auto_generated',
            'residences', 'improvement', NOW(), NOW()
          )
        `;
        createdIds.capitalInvestments.push(investment.id);
      }
    });

    it('should include urgent capital investments in forecast calculations', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          capitalInvestmentMode: 'urgent',
          bankAccountStartAmount: 500000,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('capitalInvestments');
      expect(Array.isArray(response.body.capitalInvestments)).toBe(true);
      
      // Should only include urgent investments
      const urgentInvestments = response.body.capitalInvestments;
      expect(urgentInvestments).toHaveLength(1);
      expect(urgentInvestments[0].urgency).toBe('urgent');
      expect(urgentInvestments[0].title).toBe('Urgent Foundation Repair');
    });

    it('should include suggested and urgent investments in suggested mode', async () => {
      const response = await request(app)
        .post(`/api/budgets/${testBuilding.id}/forecast`)
        .send({
          capitalInvestmentMode: 'suggested',
          bankAccountStartAmount: 500000,
        });

      expect(response.status).toBe(200);
      
      const investments = response.body.capitalInvestments;
      expect(investments).toHaveLength(2); // urgent + suggested, not not_urgent
      
      const urgencies = investments.map((inv: any) => inv.urgency);
      expect(urgencies).toContain('urgent');
      expect(urgencies).toContain('suggested');
      expect(urgencies).not.toContain('not_urgent');
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should enforce foreign key constraint to buildings', async () => {
      const invalidBuildingId = uuidv4();
      const investment = {
        title: 'Invalid Building Investment',
        amount: 50000,
        targetDate: '2024-12-01',
        urgency: 'urgent',
        type: 'custom',
        ownershipType: 'residences',
        category: 'maintenance',
      };

      const response = await request(app)
        .post(`/api/budgets/${invalidBuildingId}/capital-investments`)
        .send(investment);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('_error', 'Building not found');
    });

    it('should handle concurrent modifications gracefully', async () => {
      // Create a test investment
      const testId = uuidv4();
      await sql`
        INSERT INTO capital_investments (
          id, building_id, title, amount, target_date, urgency, type,
          ownership_type, category, created_at, updated_at
        )
        VALUES (
          ${testId}, ${testBuilding.id}, 'Concurrent Test', 50000,
          '2024-12-01', 'suggested', 'custom', 'residences', 'maintenance', NOW(), NOW()
        )
      `;
      createdIds.capitalInvestments.push(testId);

      // Attempt concurrent updates
      const update1 = { title: 'Concurrent Update 1', amount: 60000 };
      const update2 = { title: 'Concurrent Update 2', amount: 70000 };

      const [response1, response2] = await Promise.all([
        request(app)
          .put(`/api/budgets/${testBuilding.id}/capital-investments/${testId}`)
          .send(update1),
        request(app)
          .put(`/api/budgets/${testBuilding.id}/capital-investments/${testId}`)
          .send(update2),
      ]);

      // Both should succeed (last write wins)
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify final state
      const finalState = await request(app)
        .get(`/api/budgets/${testBuilding.id}/capital-investments/${testId}`);

      expect(finalState.status).toBe(200);
      // Title should be from one of the updates
      expect(['Concurrent Update 1', 'Concurrent Update 2']).toContain(
        finalState.body.capitalInvestment.title
      );
    });
  });
});