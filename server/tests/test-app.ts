/**
 * Test application setup
 * Creates a minimal Express app for integration testing
 */
import express from 'express';
import session from 'express-session';
import { registerRoutes } from '../routes';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export function createTestApp() {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add session middleware for tests
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));
  
  // Test authentication middleware - inject user into session AND req.user from x-test-user-id header
  app.use(async (req: any, res, next) => {
    const testUserId = req.headers['x-test-user-id'] as string;
    if (testUserId) {
      try {
        const userResult = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);
        if (userResult.length > 0) {
          const user = userResult[0];
          
          // Get user organizations to match what requireAuth does
          const { userOrganizations } = await import('@shared/schema');
          const { and } = await import('drizzle-orm');
          const userOrgs = await db.select().from(userOrganizations)
            .where(and(
              eq(userOrganizations.userId, user.id),
              eq(userOrganizations.isActive, true)
            ));
          
          const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            isActive: user.isActive,
          } as any;
          
          req.session.userId = user.id; // For requireAuth in server/auth.ts
          req.session.user = userData;
          
          // Set req.user with organizations like requireAuth does
          req.user = {
            ...user,
            organizations: userOrgs.map((uo) => uo.organizationId),
            canAccessAllOrganizations: userOrgs.some((uo) => uo.canAccessAllOrganizations),
          } as any;
        }
      } catch (error) {
        console.error('Error fetching test user:', error);
      }
    }
    next();
  });
  
  // Register all routes
  registerRoutes(app);
  
  return app;
}

export const testApp = createTestApp();
