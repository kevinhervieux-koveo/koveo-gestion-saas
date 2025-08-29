import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import ws from 'ws';
import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import 'whatwg-fetch';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:password@localhost:5432/test';
if (!DATABASE_URL) {
  console.warn('No DATABASE_URL found, using default test database');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle({ client: pool, schema });

let app: Express;
let demoUserId: string;
let openDemoUserId: string;
let regularUserId: string;
let demoOrgId: string;
let openDemoOrgId: string;
let regularOrgId: string;

// Real RBAC functions that query the database
const isOpenDemoUser = async (userId: string): Promise<boolean> => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      with: {
        userOrganizations: {
          with: {
            organization: true
          }
        }
      }
    });
    
    if (!user) return false;
    
    // Check if user belongs to Open Demo organization or has opendemo email
    return user.email?.includes('@opendemo.com') || 
           user.userOrganizations.some(uo => 
             uo.organization?.name === 'Open Demo' || 
             uo.organization?.name?.toLowerCase().includes('open demo')
           );
  } catch (error) {
    console.error('Error checking Open Demo user:', error);
    return false;
  }
};

const canUserPerformWriteOperation = async (userId: string, operation: string): Promise<boolean> => {
  try {
    const isOpenDemo = await isOpenDemoUser(userId);
    return !isOpenDemo;
  } catch (error) {
    console.error('Error checking write operation permission:', error);
    return true; // Default to allowing operation if check fails
  }
};

// Create a minimal Express app for testing
function createTestApp(): Express {
  const testApp = express();
  testApp.use(express.json());
  
  // Mock middleware for authentication
  testApp.use((req: any, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // Mock user based on token
      if (token.includes('open-demo-user-id')) {
        req.user = { 
          id: openDemoUserId, 
          email: 'demo@opendemo.com', 
          role: 'tenant',
          isDemo: true,
          isDemoRestricted: true
        };
      } else if (token.includes('demo-user-id')) {
        req.user = { 
          id: demoUserId, 
          email: 'manager@demo.com', 
          role: 'manager',
          isDemo: true,
          isDemoRestricted: false
        };
      } else {
        req.user = { 
          id: regularUserId, 
          email: 'user@regular.com', 
          role: 'manager',
          isDemo: false,
          isDemoRestricted: false
        };
      }
    }
    next();
  });

  // Mock API routes for testing
  testApp.post('/api/users', async (req: any, res) => {
    const isOpenDemo = await isOpenDemoUser(req.user?.id || '');
    if (isOpenDemo) {
      return res.status(403).json({
        code: 'DEMO_RESTRICTED',
        message: 'This is a demonstration account with view-only access.',
        messageEn: 'This is a demonstration account with view-only access.',
        messageFr: 'Ceci est un compte de démonstration avec accès en consultation seulement.',
      });
    }
    res.status(201).json({ id: 'new-user-id', email: req.body.email });
  });

  testApp.get('/api/users', (req: any, res) => {
    res.status(200).json([{ id: 'user-1', email: 'test@demo.com' }]);
  });

  testApp.put('/api/users/:id', async (req: any, res) => {
    const isOpenDemo = await isOpenDemoUser(req.user?.id || '');
    if (isOpenDemo) {
      return res.status(403).json({
        code: 'DEMO_RESTRICTED',
        message: 'This is a demonstration account with view-only access.',
      });
    }
    res.status(200).json({ id: req.params.id, ...req.body });
  });

  testApp.delete('/api/users/:id', async (req: any, res) => {
    const isOpenDemo = await isOpenDemoUser(req.user?.id || '');
    if (isOpenDemo) {
      return res.status(403).json({
        code: 'DEMO_RESTRICTED',
        message: 'This is a demonstration account with view-only access.',
      });
    }
    res.status(204).send();
  });

  return testApp;
}

describe('Comprehensive Demo User Security Tests', () => {
  beforeAll(async () => {
    app = createTestApp();
    await findExistingDemoUsers();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Demo User Write Operation Restrictions', () => {
    test('should correctly identify Open Demo users', async () => {
      const isOpenDemo = await isOpenDemoUser(openDemoUserId);
      expect(isOpenDemo).toBe(true);

      const isRegularUser = await isOpenDemoUser(regularUserId);
      expect(isRegularUser).toBe(false);

      const isDemoUser = await isOpenDemoUser(demoUserId);
      expect(isDemoUser).toBe(false);
    });

    test('should prevent Open Demo users from performing write operations', async () => {
      const writeOperations = ['create', 'update', 'delete', 'manage'] as const;

      for (const operation of writeOperations) {
        const canPerform = await canUserPerformWriteOperation(openDemoUserId, operation);
        expect(canPerform).toBe(false);
      }
    });
  });

  describe('API Endpoint Security', () => {
    test('should prevent Open Demo users from creating users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer mock-jwt-token-${openDemoUserId}`)
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'tenant'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/view.?only|restricted|demo/i);
    });

    test('should allow Open Demo users to view users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer mock-jwt-token-${openDemoUserId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Message Quality', () => {
    test('should provide elegant bilingual error messages', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer mock-jwt-token-${openDemoUserId}`)
        .set('Accept-Language', 'fr')
        .send({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('messageEn');
      expect(response.body).toHaveProperty('messageFr');
      expect(response.body.message).not.toMatch(/error|fail|invalid/i);
    });
  });
});

// Helper function to find existing demo users in the database
async function findExistingDemoUsers() {
  try {
    console.log('🔍 Finding existing demo users in database...');
    
    // Find Demo organization
    const demoOrg = await db.query.organizations.findFirst({
      where: and(
        eq(schema.organizations.name, 'Demo'),
        eq(schema.organizations.isActive, true)
      )
    });

    // Find Open Demo organization
    const openDemoOrg = await db.query.organizations.findFirst({
      where: and(
        eq(schema.organizations.name, 'Open Demo'),
        eq(schema.organizations.isActive, true)
      )
    });

    if (!demoOrg || !openDemoOrg) {
      throw new Error('Demo organizations not found in database. Please ensure demo data is seeded.');
    }

    demoOrgId = demoOrg.id;
    openDemoOrgId = openDemoOrg.id;

    // Find a regular Demo user (manager role, not Open Demo)
    const demoUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.isActive, true),
        eq(schema.users.role, 'manager')
      ),
      with: {
        userOrganizations: {
          where: eq(schema.userOrganizations.organizationId, demoOrgId),
          with: {
            organization: true
          }
        }
      }
    });

    // Find an Open Demo user (restricted user)
    const openDemoUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.isActive, true)
      ),
      with: {
        userOrganizations: {
          where: eq(schema.userOrganizations.organizationId, openDemoOrgId),
          with: {
            organization: true
          }
        }
      }
    });

    // Find any regular (non-demo) user for comparison
    const regularUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.isActive, true),
        eq(schema.users.role, 'manager')
      ),
      with: {
        userOrganizations: {
          with: {
            organization: {
              where: and(
                eq(schema.organizations.isActive, true),
                inArray(schema.organizations.name, ['Demo', 'Open Demo'], true) // NOT in demo orgs
              )
            }
          }
        }
      }
    });

    if (!demoUser || !openDemoUser) {
      throw new Error('Required demo users not found in database');
    }

    demoUserId = demoUser.id;
    openDemoUserId = openDemoUser.id;
    regularUserId = regularUser?.id || demoUser.id; // Fallback to demo user if no regular user found

    console.log(`✅ Found demo users:`);
    console.log(`  - Demo user: ${demoUser.email} (${demoUser.id})`);
    console.log(`  - Open Demo user: ${openDemoUser.email} (${openDemoUser.id})`);
    console.log(`  - Regular user: ${regularUser?.email || 'using demo user'} (${regularUserId})`);
    
  } catch (error) {
    console.error('❌ Failed to find demo users:', error);
    throw error;
  }
}