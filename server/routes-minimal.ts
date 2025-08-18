import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { sessionConfig, setupAuthRoutes, requireAuth, requireRole, authorize } from './auth';
import { registerPermissionsRoutes } from './api/permissions';
import { registerOrganizationRoutes } from './api/organizations';
import { registerUserRoutes } from './api/users';
import { log } from './vite';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { insertInvitationSchema } from '../shared/schema';
import crypto from 'crypto';

// Import required tables from schema
const { invitations, users: schemaUsers, organizations, buildings, residences, invitationAuditLog } = schema;

// Utility functions for invitation management
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Rate limiting for invitations
const invitationRateLimit = new Map();
function rateLimitInvitations(limit: number) {
  return (req: any, res: any, next: any) => {
    const userId = req.user?.id;
    const key = `invitation_${userId}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    if (!invitationRateLimit.has(key)) {
      invitationRateLimit.set(key, { count: 0, resetTime: now + windowMs });
    }

    const userLimit = invitationRateLimit.get(key);
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + windowMs;
    }

    if (userLimit.count >= limit) {
      return res.status(429).json({
        message: 'Too many invitation requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    userLimit.count++;
    next();
  };
}

// Audit logging function
async function createInvitationAuditLog(
  invitationId: string,
  action: string,
  performedBy?: string,
  req?: any,
  previousStatus?: string,
  newStatus?: string,
  details?: any
) {
  try {
    await db.insert(invitationAuditLog).values({
      invitationId,
      action,
      performedBy,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get('User-Agent'),
      details,
      previousStatus: previousStatus as any,
      newStatus: newStatus as any,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Core routes registration with essential functionality.
 * @param app
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  try {
    app.use(sessionConfig);
    log('✅ Session middleware configured');
  } catch (error) {
    log(`❌ Session setup failed: ${error}`, 'error');
  }
  
  // Setup authentication routes
  try {
    setupAuthRoutes(app);
    log('✅ Auth routes registered');
  } catch (error) {
    log(`❌ Auth routes failed: ${error}`, 'error');
  }
  
  // Register permissions API routes
  try {
    registerPermissionsRoutes(app);
    log('✅ Permissions routes registered');
  } catch (error) {
    log(`❌ Permissions routes failed: ${error}`, 'error');
  }
  
  // Register organization API routes
  try {
    registerOrganizationRoutes(app);
    log('✅ Organization routes registered');
  } catch (error) {
    log(`❌ Organization routes failed: ${error}`, 'error');
  }
  
  // Register user API routes
  try {
    registerUserRoutes(app);
    log('✅ User routes registered');
  } catch (error) {
    log(`❌ User routes failed: ${error}`, 'error');
  }
  
  // Register invitation routes
  try {
    // POST /api/invitations - Create single invitation
    app.post('/api/invitations', 
      requireAuth, 
      authorize('create:user'),
      rateLimitInvitations(10),
      async (req: any, res: any) => {
        try {
          console.log('📥 Single invitation route reached with data:', req.body);
          const currentUser = req.user;
          const invitationData = req.body;
          
          // Validate request data
          const validation = insertInvitationSchema.safeParse(invitationData);
          if (!validation.success) {
            console.error('❌ Validation failed:', validation.error.issues);
            console.error('📝 Raw input data:', invitationData);
            return res.status(400).json({
              message: 'Invalid invitation data',
              errors: validation.error.issues
            });
          }
          
          const { email, role, organizationId, buildingId, residenceId, personalMessage } = validation.data;
          
          // Role-based access control for roles
          if (currentUser.role === 'manager' && ['admin', 'manager'].includes(role as string)) {
            return res.status(403).json({
              message: 'Managers can only invite tenants and residents',
              code: 'INSUFFICIENT_ROLE_PERMISSIONS'
            });
          }

          // Validate residence assignment for tenants and residents
          if (['tenant', 'resident'].includes(role as string)) {
            // Only require residence if a specific building is selected
            if (buildingId && buildingId !== 'none' && !residenceId) {
              return res.status(400).json({
                message: 'Residence must be assigned for tenants and residents when a building is selected',
                code: 'RESIDENCE_REQUIRED'
              });
            }
          }

          // Check if user already exists
          const existingUser = await db.select().from(schemaUsers).where(eq(schemaUsers.email, email)).limit(1);
          if (existingUser.length > 0) {
            return res.status(409).json({
              message: 'User with this email already exists',
              code: 'USER_EXISTS'
            });
          }
          
          // Check for existing pending invitation
          const existingInvitation = await db.select({
            id: invitations.id,
            email: invitations.email,
            status: invitations.status,
            expiresAt: invitations.expiresAt
          })
            .from(invitations)
            .where(and(
              eq(invitations.email, email),
              eq(invitations.status, 'pending'),
              gte(invitations.expiresAt, new Date())
            ))
            .limit(1);
            
          if (existingInvitation.length > 0) {
            return res.status(409).json({
              message: 'Active invitation already exists for this email',
              code: 'INVITATION_EXISTS'
            });
          }
          
          // Generate secure token
          const token = generateSecureToken();
          const tokenHash = hashToken(token);
          
          // Set expiration (7 days from now)
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          
          // Create invitation
          const invitationContext = {
            organizationId,
            buildingId: buildingId === 'none' ? null : buildingId,
            residenceId: ['tenant', 'resident'].includes(role as string) ? residenceId : null
          };

          const [newInvitation] = await db.insert(invitations).values({
            email,
            token,
            tokenHash,
            role: role as any,
            invitedByUserId: currentUser.id,
            organizationId,
            buildingId: buildingId === 'none' ? null : buildingId,
            expiresAt,
            personalMessage,
            invitationContext,
          }).returning({
            id: invitations.id,
            email: invitations.email,
            role: invitations.role,
            status: invitations.status,
            organizationId: invitations.organizationId,
            buildingId: invitations.buildingId,
            invitedByUserId: invitations.invitedByUserId,
            createdAt: invitations.createdAt,
            expiresAt: invitations.expiresAt,
            personalMessage: invitations.personalMessage
          });
          
          // Create audit log
          await createInvitationAuditLog(
            newInvitation.id,
            'created',
            currentUser.id,
            req,
            undefined,
            'pending',
            { email, role, organizationId, buildingId, residenceId }
          );
          
          // Return invitation data (no sensitive fields in return object)
          const safeInvitation = newInvitation;
          
          res.status(201).json({
            invitation: safeInvitation,
            message: 'Invitation created successfully',
            invitationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/accept-invitation?token=${token}`
          });
          
        } catch (error) {
          console.error('Error creating invitation:', error);
          res.status(500).json({ message: 'Failed to create invitation' });
        }
      }
    );

    // GET /api/invitations - List invitations
    app.get('/api/invitations', requireAuth, authorize('read:user'), async (req: any, res: any) => {
      try {
        const invitationList = await db.select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          organizationId: invitations.organizationId,
          buildingId: invitations.buildingId,
          invitedByUserId: invitations.invitedByUserId,
          createdAt: invitations.createdAt,
          expiresAt: invitations.expiresAt,
          personalMessage: invitations.personalMessage
        }).from(invitations);
        res.json(invitationList);
      } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ message: 'Failed to fetch invitations' });
      }
    });

    log('✅ Invitation routes registered');
  } catch (error) {
    log(`❌ Invitation routes failed: ${error}`, 'error');
  }
  
  // Test route
  app.get('/test', (req, res) => {
    res.json({ message: 'Application running successfully' });
  });

  // Health check endpoints
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (req, res) => {
    res.json({ status: 'ready' });
  });

  // Create and return HTTP server
  const server = createServer(app);
  return server;
}