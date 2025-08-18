import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { sessionConfig, setupAuthRoutes, requireAuth, requireRole, authorize } from './auth';
import { registerPermissionsRoutes } from './api/permissions';
import { registerOrganizationRoutes } from './api/organizations';
import { registerUserRoutes } from './api/users';
import { registerBuildingRoutes } from './api/buildings';
import { log } from './vite';
import { db } from './db';
import * as schema from '../shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { insertInvitationSchema } from '../shared/schema';
import crypto from 'crypto';
import { EmailService } from './services/email-service';
import { hashPassword } from './auth';
import { storage } from './storage';

// Import required tables from schema
const { invitations, users: schemaUsers, organizations, buildings, residences, invitationAuditLog } = schema;

// Initialize email service
const emailService = new EmailService();

// Utility functions for invitation management
/**
 *
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 *
 * @param token
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Rate limiting for invitations
const invitationRateLimit = new Map();
/**
 *
 * @param limit
 */
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
/**
 *
 * @param invitationId
 * @param action
 * @param performedBy
 * @param req
 * @param previousStatus
 * @param newStatus
 * @param details
 */
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
  
  // Register building API routes
  try {
    registerBuildingRoutes(app);
    log('✅ Building routes registered');
  } catch (error) {
    log(`❌ Building routes failed: ${error}`, 'error');
  }

  // Register residence API routes
  try {
    const { registerResidenceRoutes } = await import('./api/residences.js');
    registerResidenceRoutes(app);
    log('✅ Residence routes registered');
  } catch (error) {
    log(`❌ Residence routes failed: ${error}`, 'error');
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
          console.log('🔍 Current user:', currentUser?.id);
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
          
          // Check for existing pending invitation and delete if found
          const existingInvitation = await db.select({
            id: invitations.id,
            email: invitations.email,
            status: invitations.status,
            expiresAt: invitations.expiresAt,
            organizationId: invitations.organizationId
          })
            .from(invitations)
            .where(and(
              eq(invitations.email, email),
              eq(invitations.organizationId, organizationId),
              eq(invitations.status, 'pending'),
              gte(invitations.expiresAt, new Date())
            ))
            .limit(1);
            
          if (existingInvitation.length > 0) {
            // Delete existing invitation to replace with new one
            console.log(`🔄 Found existing invitation for ${email} in organization ${organizationId}, deleting...`);
            
            await db.delete(invitations)
              .where(and(
                eq(invitations.email, email),
                eq(invitations.organizationId, organizationId),
                eq(invitations.status, 'pending'),
                gte(invitations.expiresAt, new Date())
              ));
            
            // Create audit log for the deleted invitation
            await createInvitationAuditLog(
              existingInvitation[0].id,
              'deleted',
              currentUser.id,
              req,
              'pending',
              'deleted',
              { reason: 'replaced_with_new_invitation', email, organizationId }
            );
            
            console.log(`✅ Deleted existing invitation for ${email} in organization ${organizationId}`);
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
          
          // Send invitation email
          try {
            const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/accept-invitation?token=${token}`;
            
            // Get organization name
            const organization = await db.select({ name: organizations.name })
              .from(organizations)
              .where(eq(organizations.id, organizationId))
              .limit(1);
              
            const organizationName = organization[0]?.name || 'Your Organization';
            
            // Send email using email service
            await emailService.sendInvitationEmail(
              email,
              email.split('@')[0], // Use email prefix as name fallback
              token,
              organizationName,
              `${currentUser.firstName} ${currentUser.lastName}`,
              expiresAt,
              'en' // Default to English, could be made configurable
            );
            
            console.log(`✅ Invitation email sent successfully to ${email}`);
          } catch (emailError) {
            console.error('❌ Failed to send invitation email:', emailError);
            // Don't fail the entire request if email fails, just log it
          }
          
          // Return invitation data (no sensitive fields in return object)
          const safeInvitation = newInvitation;
          
          res.status(201).json({
            invitation: safeInvitation,
            message: 'Invitation created successfully',
            invitationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/register?invitation=${token}`
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

    // POST /api/invitations/validate - Validate invitation token
    app.post('/api/invitations/validate', async (req: any, res: any) => {
      try {
        const { token } = req.body;
        
        if (!token) {
          return res.status(400).json({
            message: 'Token is required',
            code: 'TOKEN_REQUIRED'
          });
        }

        // Find invitation by token hash (since we store hashed tokens)
        const tokenHash = hashToken(token);
        const invitation = await db.select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          organizationId: invitations.organizationId,
          buildingId: invitations.buildingId,
          expiresAt: invitations.expiresAt,
          invitedByUserId: invitations.invitedByUserId,
          personalMessage: invitations.personalMessage
        })
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);

        if (invitation.length === 0) {
          await createInvitationAuditLog(
            'unknown',
            'validation_failed',
            undefined,
            req,
            undefined,
            undefined,
            { reason: 'token_not_found', token: token.substring(0, 8) + '...' }
          );
          return res.status(404).json({
            message: 'Invalid invitation token',
            code: 'TOKEN_INVALID',
            isValid: false
          });
        }

        const invitationData = invitation[0];

        // Check if invitation has expired
        if (new Date() > invitationData.expiresAt) {
          await createInvitationAuditLog(
            invitationData.id,
            'validation_failed',
            undefined,
            req,
            invitationData.status,
            undefined,
            { reason: 'token_expired' }
          );
          return res.status(410).json({
            message: 'Invitation has expired',
            code: 'TOKEN_EXPIRED',
            isValid: false
          });
        }

        // Check if invitation is still pending
        if (invitationData.status !== 'pending') {
          await createInvitationAuditLog(
            invitationData.id,
            'validation_failed',
            undefined,
            req,
            invitationData.status,
            undefined,
            { reason: 'token_already_used' }
          );
          return res.status(409).json({
            message: 'Invitation has already been used',
            code: 'TOKEN_USED',
            isValid: false
          });
        }

        // Get organization and inviter information
        const organization = await db.select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, invitationData.organizationId))
          .limit(1);

        const inviter = await db.select({ 
          firstName: schemaUsers.firstName, 
          lastName: schemaUsers.lastName 
        })
          .from(schemaUsers)
          .where(eq(schemaUsers.id, invitationData.invitedByUserId))
          .limit(1);

        await createInvitationAuditLog(
          invitationData.id,
          'validation_success',
          undefined,
          req,
          invitationData.status,
          undefined,
          { email: invitationData.email }
        );

        res.json({
          isValid: true,
          invitation: invitationData,
          organizationName: organization[0]?.name || 'Koveo Gestion',
          inviterName: inviter[0] ? `${inviter[0].firstName} ${inviter[0].lastName}` : 'Administrator'
        });

      } catch (error) {
        console.error('Error validating invitation:', error);
        res.status(500).json({ 
          message: 'Failed to validate invitation',
          isValid: false 
        });
      }
    });

    // POST /api/invitations/accept/:token - Accept invitation and create user account
    app.post('/api/invitations/accept/:token', async (req: any, res: any) => {
      try {
        const { token } = req.params;
        const { password, firstName, lastName, phone, address, city, province, postalCode, language, dateOfBirth, dataCollectionConsent, marketingConsent, analyticsConsent, thirdPartyConsent, acknowledgedRights } = req.body;

        if (!token) {
          return res.status(400).json({
            message: 'Token is required',
            code: 'TOKEN_REQUIRED'
          });
        }

        if (!password || !firstName || !lastName) {
          return res.status(400).json({
            message: 'Password, first name, and last name are required',
            code: 'MISSING_REQUIRED_FIELDS'
          });
        }

        if (!dataCollectionConsent || !acknowledgedRights) {
          return res.status(400).json({
            message: 'Data collection consent and privacy rights acknowledgment are required',
            code: 'CONSENT_REQUIRED'
          });
        }

        // Find and validate invitation
        const tokenHash = hashToken(token);
        const invitation = await db.select()
          .from(invitations)
          .where(and(
            eq(invitations.tokenHash, tokenHash),
            eq(invitations.status, 'pending')
          ))
          .limit(1);

        if (invitation.length === 0) {
          await createInvitationAuditLog(
            'unknown',
            'acceptance_failed',
            undefined,
            req,
            undefined,
            undefined,
            { reason: 'token_not_found_or_used', token: token.substring(0, 8) + '...' }
          );
          return res.status(404).json({
            message: 'Invalid or expired invitation',
            code: 'INVALID_INVITATION'
          });
        }

        const invitationData = invitation[0];

        // Check if invitation has expired
        if (new Date() > invitationData.expiresAt) {
          await createInvitationAuditLog(
            invitationData.id,
            'acceptance_failed',
            undefined,
            req,
            invitationData.status,
            undefined,
            { reason: 'token_expired' }
          );
          return res.status(410).json({
            message: 'Invitation has expired',
            code: 'TOKEN_EXPIRED'
          });
        }

        // Check if user already exists
        const existingUser = await db.select().from(schemaUsers).where(eq(schemaUsers.email, invitationData.email)).limit(1);
        if (existingUser.length > 0) {
          return res.status(409).json({
            message: 'User with this email already exists',
            code: 'USER_EXISTS'
          });
        }

        // Create user with hashed password
        const { salt, hash } = hashPassword(password);
        const hashedPassword = `${salt}:${hash}`;

        const newUser = await storage.createUser({
          email: invitationData.email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          role: invitationData.role,
          phone: phone || '',
          address: address || '',
          city: city || '',
          province: province || 'QC',
          postalCode: postalCode || '',
          language: language || 'fr',
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          dataCollectionConsent,
          marketingConsent: marketingConsent || false,
          analyticsConsent: analyticsConsent || false,
          thirdPartyConsent: thirdPartyConsent || false,
          acknowledgedRights,
          consentDate: new Date()
        });

        // Create user-organization relationship
        await db.insert(schema.userOrganizations).values({
          userId: newUser.id,
          organizationId: invitationData.organizationId,
          isActive: true,
          canAccessAllOrganizations: false
        });

        // If invitation includes a building/residence assignment, create those relationships
        if (invitationData.buildingId && ['tenant', 'resident'].includes(invitationData.role)) {
          // For now, we'll just log this - residence assignment might need additional logic
          console.log(`User ${newUser.id} assigned to building ${invitationData.buildingId} for role ${invitationData.role}`);
        }

        // Mark invitation as accepted
        await db.update(invitations)
          .set({ 
            status: 'accepted',
            acceptedAt: new Date()
          })
          .where(eq(invitations.id, invitationData.id));

        await createInvitationAuditLog(
          invitationData.id,
          'accepted',
          newUser.id,
          req,
          'pending',
          'accepted',
          { 
            email: invitationData.email,
            userId: newUser.id,
            organizationId: invitationData.organizationId 
          }
        );

        // Return user data (without password)
        const { password: _, ...userData } = newUser;
        res.status(201).json({
          user: userData,
          message: 'Account created successfully',
          redirectTo: '/login'
        });

      } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ 
          message: 'Failed to create account',
          code: 'ACCOUNT_CREATION_FAILED'
        });
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