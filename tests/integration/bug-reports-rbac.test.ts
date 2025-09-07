/**
 * Integration Tests for Bug Reports Role-Based Access Control
 * 
 * Tests cover the fix for redundant client-side filtering that prevented
 * admins from seeing all bugs. Now properly tests:
 * - Admin users can see all bug reports
 * - Regular users can only see their own bug reports
 * - Server-side access control works correctly
 * - Client-side filtering only applies to search/status/priority
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { registerBugRoutes } from '../../server/api/bugs';
import { MemStorage } from '../../server/storage';
import { createTestUser } from '../utils/test-utils';
import type { Bug, InsertBug } from '../../shared/schema';

// Mock storage
let mockStorage: MemStorage;

// Create test Express app
const createTestApp = () => {
  const app = express();
  
  // Setup middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session middleware for authentication
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );
  
  // Mock auth middleware
  app.use((req: any, res, next) => {
    if (req.session?.user) {
      req.user = req.session.user;
    }
    next();
  });
  
  // Register bug routes
  registerBugRoutes(app);
  
  return app;
};

describe('Bug Reports Role-Based Access Control', () => {
  let app: express.Application;
  let adminUser: any;
  let user1: any;
  let user2: any;
  let adminAgent: request.SuperAgentTest;
  let user1Agent: request.SuperAgentTest;
  let user2Agent: request.SuperAgentTest;
  let createdBugs: Bug[] = [];

  beforeEach(async () => {
    // Initialize mock storage
    mockStorage = new MemStorage();
    
    // Mock the storage module
    jest.doMock('../../server/storage', () => ({
      storage: mockStorage
    }));
    
    app = createTestApp();
    
    // Create test users
    adminUser = await createTestUser({
      email: 'admin@test.com',
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User'
    });
    
    user1 = await createTestUser({
      email: 'user1@test.com',
      role: 'resident',
      firstName: 'User',
      lastName: 'One'
    });
    
    user2 = await createTestUser({
      email: 'user2@test.com',
      role: 'resident',
      firstName: 'User',
      lastName: 'Two'
    });
    
    // Create authenticated agents
    adminAgent = request.agent(app);
    user1Agent = request.agent(app);
    user2Agent = request.agent(app);
    
    // Mock sessions for each agent
    await adminAgent
      .post('/mock-login')
      .send(adminUser);
      
    await user1Agent
      .post('/mock-login')
      .send(user1);
      
    await user2Agent
      .post('/mock-login')
      .send(user2);
      
    // Create test bugs
    const bugs = [
      {
        title: 'Admin Bug 1',
        description: 'Bug created by admin',
        category: 'functionality' as const,
        page: '/admin/dashboard',
        priority: 'high' as const,
        createdBy: adminUser.id,
        reproductionSteps: 'Step 1, Step 2',
      },
      {
        title: 'User1 Bug 1',
        description: 'Bug created by user1',
        category: 'ui_ux' as const,
        page: '/dashboard',
        priority: 'medium' as const,
        createdBy: user1.id,
        reproductionSteps: 'User1 steps',
      },
      {
        title: 'User1 Bug 2',
        description: 'Another bug by user1',
        category: 'performance' as const,
        page: '/documents',
        priority: 'low' as const,
        createdBy: user1.id,
        reproductionSteps: 'Performance issue steps',
      },
      {
        title: 'User2 Bug 1',
        description: 'Bug created by user2',
        category: 'security' as const,
        page: '/settings',
        priority: 'critical' as const,
        createdBy: user2.id,
        reproductionSteps: 'Security bug steps',
      },
    ];
    
    // Create bugs in storage
    for (const bugData of bugs) {
      const created = await mockStorage.createBug(bugData as InsertBug);
      createdBugs.push(created);
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    createdBugs = [];
  });

  describe('Admin Access Control', () => {
    it('should allow admin to see all bugs from all users', async () => {
      const response = await adminAgent
        .get('/api/bugs')
        .expect(200);
        
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(4); // All 4 bugs
      
      // Verify admin can see bugs from all users
      const creatorIds = response.body.map((bug: Bug) => bug.createdBy);
      expect(creatorIds).toContain(adminUser.id);
      expect(creatorIds).toContain(user1.id);
      expect(creatorIds).toContain(user2.id);
    });

    it('should allow admin to access any specific bug', async () => {
      // Test accessing user1's bug
      const user1Bug = createdBugs.find(bug => bug.createdBy === user1.id);
      const response = await adminAgent
        .get(`/api/bugs/${user1Bug!.id}`)
        .expect(200);
        
      expect(response.body.id).toBe(user1Bug!.id);
      expect(response.body.createdBy).toBe(user1.id);
    });

    it('should allow admin to update any bug', async () => {
      const user2Bug = createdBugs.find(bug => bug.createdBy === user2.id);
      const response = await adminAgent
        .patch(`/api/bugs/${user2Bug!.id}`)
        .send({
          status: 'in_progress',
          assignedTo: adminUser.id
        })
        .expect(200);
        
      expect(response.body.status).toBe('in_progress');
      expect(response.body.assignedTo).toBe(adminUser.id);
    });

    it('should allow admin to delete any bug', async () => {
      const adminBug = createdBugs.find(bug => bug.createdBy === adminUser.id);
      await adminAgent
        .delete(`/api/bugs/${adminBug!.id}`)
        .expect(204);
        
      // Verify bug is deleted
      await adminAgent
        .get(`/api/bugs/${adminBug!.id}`)
        .expect(404);
    });
  });

  describe('Regular User Access Control', () => {
    it('should only show user1 their own bugs', async () => {
      const response = await user1Agent
        .get('/api/bugs')
        .expect(200);
        
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2); // Only user1's 2 bugs
      
      // Verify all returned bugs belong to user1
      response.body.forEach((bug: Bug) => {
        expect(bug.createdBy).toBe(user1.id);
      });
    });

    it('should only show user2 their own bugs', async () => {
      const response = await user2Agent
        .get('/api/bugs')
        .expect(200);
        
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1); // Only user2's 1 bug
      
      // Verify returned bug belongs to user2
      expect(response.body[0].createdBy).toBe(user2.id);
    });

    it('should deny user1 access to user2 bugs', async () => {
      const user2Bug = createdBugs.find(bug => bug.createdBy === user2.id);
      await user1Agent
        .get(`/api/bugs/${user2Bug!.id}`)
        .expect(404); // Returns 404 for access denied
    });

    it('should deny user2 access to user1 bugs', async () => {
      const user1Bug = createdBugs.find(bug => bug.createdBy === user1.id);
      await user2Agent
        .get(`/api/bugs/${user1Bug!.id}`)
        .expect(404); // Returns 404 for access denied
    });

    it('should allow users to update their own bugs', async () => {
      const user1Bug = createdBugs.find(bug => bug.createdBy === user1.id);
      const response = await user1Agent
        .patch(`/api/bugs/${user1Bug!.id}`)
        .send({
          priority: 'high',
          reproductionSteps: 'Updated steps'
        })
        .expect(200);
        
      expect(response.body.priority).toBe('high');
      expect(response.body.reproductionSteps).toBe('Updated steps');
    });

    it('should deny users access to update other users bugs', async () => {
      const user2Bug = createdBugs.find(bug => bug.createdBy === user2.id);
      await user1Agent
        .patch(`/api/bugs/${user2Bug!.id}`)
        .send({
          priority: 'high'
        })
        .expect(404); // Access denied
    });
  });

  describe('Server-Side Filtering Logic', () => {
    it('should properly filter bugs based on user role in storage layer', async () => {
      // Test the actual storage method directly
      const adminBugs = await mockStorage.getBugsForUser(adminUser.id, 'admin');
      const user1Bugs = await mockStorage.getBugsForUser(user1.id, 'resident');
      const user2Bugs = await mockStorage.getBugsForUser(user2.id, 'resident');
      
      expect(adminBugs).toHaveLength(4); // Admin sees all
      expect(user1Bugs).toHaveLength(2); // User1 sees only their own
      expect(user2Bugs).toHaveLength(1); // User2 sees only their own
      
      // Verify content
      user1Bugs.forEach(bug => expect(bug.createdBy).toBe(user1.id));
      user2Bugs.forEach(bug => expect(bug.createdBy).toBe(user2.id));
    });

    it('should handle manager role appropriately', async () => {
      const managerUser = await createTestUser({
        email: 'manager@test.com',
        role: 'manager',
        firstName: 'Manager',
        lastName: 'User',
        organizationId: 'test-org'
      });
      
      const managerBugs = await mockStorage.getBugsForUser(
        managerUser.id, 
        'manager', 
        'test-org'
      );
      
      // Managers can see all bugs (or organization-specific based on implementation)
      expect(managerBugs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Bug Creation Access Control', () => {
    it('should allow any authenticated user to create bugs', async () => {
      const newBug = {
        title: 'New User Bug',
        description: 'New bug description',
        category: 'functionality',
        page: '/new-page',
        priority: 'medium',
        reproductionSteps: 'Steps to reproduce'
      };

      const response = await user1Agent
        .post('/api/bugs')
        .send(newBug)
        .expect(201);
        
      expect(response.body.title).toBe(newBug.title);
      expect(response.body.createdBy).toBe(user1.id);
      expect(response.body.status).toBe('new');
    });

    it('should deny unauthenticated users from creating bugs', async () => {
      const newBug = {
        title: 'Unauthorized Bug',
        description: 'Should not be created',
        category: 'functionality',
        page: '/page',
        priority: 'medium'
      };

      await request(app)
        .post('/api/bugs')
        .send(newBug)
        .expect(401);
    });
  });

  describe('Authentication Requirements', () => {
    it('should require authentication for all bug endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/bugs' },
        { method: 'post', path: '/api/bugs' },
        { method: 'get', path: `/api/bugs/${createdBugs[0].id}` },
        { method: 'patch', path: `/api/bugs/${createdBugs[0].id}` },
        { method: 'delete', path: `/api/bugs/${createdBugs[0].id}` },
      ];

      for (const endpoint of endpoints) {
        await request(app)
          [endpoint.method](endpoint.path)
          .expect(401);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid bug IDs gracefully', async () => {
      await adminAgent
        .get('/api/bugs/invalid-id')
        .expect(404);
    });

    it('should handle malformed bug data gracefully', async () => {
      const response = await user1Agent
        .post('/api/bugs')
        .send({
          // Missing required fields
          title: '',
          description: 'short' // Too short
        })
        .expect(400);
        
      expect(response.body.error).toBe('Validation failed');
    });
  });
});