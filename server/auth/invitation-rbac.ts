import { Request, Response, NextFunction } from 'express';
import { eq, and, or, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@shared/schema';
import { permissions, checkPermission, hasRoleOrHigher } from '../../config';
// Note: createInvitationAuditLog will be defined locally or imported when needed
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

/**
 * Security alert levels for invitation system monitoring.
 */
export enum SecurityAlertLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Interface for security alert data.
 */
export interface SecurityAlert {
  level: SecurityAlertLevel;
  type: string;
  description: string;
  userId?: string;
  ipAddress?: string;
  metadata?: any;
}

/**
 * Rate limiting configuration for invitation operations.
 */
const RATE_LIMITS = {
  CREATE_INVITATION: { count: 10, window: 3600000 }, // 10 per hour
  BULK_INVITATION: { count: 3, window: 3600000 }, // 3 per hour
  VALIDATION_ATTEMPTS: { count: 20, window: 300000 }, // 20 per 5 minutes
  ACCEPT_ATTEMPTS: { count: 5, window: 3600000 }, // 5 per hour
};

/**
 * In-memory rate limiting store (in production, use Redis).
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Enhanced security monitoring for invitation operations.
 * Tracks suspicious activities and generates alerts.
 */
export class InvitationSecurityMonitor {
  private static alertCallbacks: ((alert: SecurityAlert) => void)[] = [];

  /**
   * Register callback for security alerts.
   * @param callback
   */
  static onAlert(callback: (alert: SecurityAlert) => void) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Trigger a security alert.
   * @param alert
   */
  static async triggerAlert(alert: SecurityAlert) {
    console.warn(`🚨 SECURITY ALERT [${alert.level.toUpperCase()}]: ${alert.type}`, {
      description: alert.description,
      userId: alert.userId,
      ipAddress: alert.ipAddress,
      metadata: alert.metadata
    });

    // Execute alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (_error) {
        console.error('Error in security alert callback:', _error);
      }
    });

    // Log security alert to database
    try {
      await db.insert(schema.invitationAuditLog).values({
        invitationId: alert.metadata?.invitationId || null,
        action: 'security_alert',
        performedBy: alert.userId || null,
        ipAddress: alert.ipAddress,
        userAgent: alert.metadata?.userAgent,
        details: {
          alertLevel: alert.level,
          alertType: alert.type,
          description: alert.description,
          metadata: alert.metadata
        },
        previousStatus: null,
        newStatus: null
      });
    } catch (_error) {
      console.error('Failed to log security alert:', _error);
    }
  }

  /**
   * Monitor invitation access patterns for suspicious activity.
   * @param userId
   * @param action
   * @param ipAddress
   * @param userAgent
   * @param metadata
   */
  static async monitorInvitationAccess(
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: any
  ) {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const windowStart = now - (5 * 60 * 1000); // 5 minutes

    // Count recent actions
    const recentActions = await db.select({ count: sql<number>`count(*)` })
      .from(schema.invitationAuditLog)
      .where(and(
        eq(schema.invitationAuditLog.performedBy, userId),
        eq(schema.invitationAuditLog.action, action),
        gte(schema.invitationAuditLog.timestamp, new Date(windowStart))
      ));

    const actionCount = recentActions[0]?.count || 0;

    // Check for suspicious patterns
    if (actionCount > 10) {
      await this.triggerAlert({
        level: SecurityAlertLevel.HIGH,
        type: 'excessive_invitation_actions',
        description: `User ${userId} performed ${actionCount} ${action} actions in 5 minutes`,
        userId,
        ipAddress,
        metadata: { action, count: actionCount, userAgent, ...metadata }
      });
    }

    // Check for failed invitation validations
    if (action === 'validation_failed' && actionCount > 5) {
      await this.triggerAlert({
        level: SecurityAlertLevel.MEDIUM,
        type: 'multiple_validation_failures',
        description: `User ${userId} had ${actionCount} failed token validations`,
        userId,
        ipAddress,
        metadata: { action, count: actionCount, userAgent, ...metadata }
      });
    }

    // Monitor IP-based patterns
    if (ipAddress) {
      const ipActions = await db.select({ count: sql<number>`count(*)` })
        .from(schema.invitationAuditLog)
        .where(and(
          eq(schema.invitationAuditLog.ipAddress, ipAddress),
          eq(schema.invitationAuditLog.action, action),
          gte(schema.invitationAuditLog.timestamp, new Date(windowStart))
        ));

      const ipActionCount = ipActions[0]?.count || 0;
      
      if (ipActionCount > 20) {
        await this.triggerAlert({
          level: SecurityAlertLevel.CRITICAL,
          type: 'ip_based_attack',
          description: `IP ${ipAddress} performed ${ipActionCount} ${action} actions in 5 minutes`,
          ipAddress,
          metadata: { action, count: ipActionCount, userAgent, ...metadata }
        });
      }
    }
  }
}

/**
 * Rate limiting middleware for invitation operations.
 * @param maxRequests
 * @param windowMs
 */
export function rateLimitInvitations(maxRequests: number, windowMs: number = 3600000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.user?.id || req.ip}:${req.method}:${req.path}`;
    const now = Date.now();
    
    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (current.count >= maxRequests) {
      // Log rate limit exceeded
      InvitationSecurityMonitor.monitorInvitationAccess(
        req.user?.id || 'anonymous',
        'rate_limit_exceeded',
        req.ip,
        req.get('User-Agent'),
        { path: req.path, method: req.method }
      );

      return res.status(429).json({
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }
    
    current.count++;
    next();
  };
}

/**
 * Database-level permission validation for invitation operations.
 */
export class InvitationPermissionValidator {
  /**
   * Validate if user can invite based on role hierarchy and organization context.
   * @param inviterId
   * @param inviterRole
   * @param targetRole
   * @param organizationId
   * @param buildingId
   */
  static async validateInvitePermission(
    inviterId: string,
    inviterRole: string,
    targetRole: string,
    organizationId?: string,
    buildingId?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    // Admin can invite anyone
    if (inviterRole === 'admin') {
      return { valid: true };
    }

    // Check role hierarchy
    if (!hasRoleOrHigher(inviterRole as any, 'manager')) {
      return { valid: false, reason: 'Insufficient role privileges to invite users' };
    }

    // Manager restrictions: can invite managers and admins within their organization
    if (inviterRole === 'manager') {
      // Managers can only invite managers and admins
      if (!['manager', 'admin'].includes(targetRole)) {
        return { valid: false, reason: 'Managers can only invite managers and admins' };
      }

      // Organization validation - managers can only invite within their organization
      if (organizationId) {
        // Check if the inviter belongs to the specified organization
        const inviterOrganization = await db.select()
          .from(schema.users)
          .leftJoin(schema.buildings, eq(schema.buildings.organizationId, organizationId))
          .leftJoin(schema.residences, eq(schema.residences.buildingId, schema.buildings.id))
          .leftJoin(schema.userResidences, eq(schema.userResidences.residenceId, schema.residences.id))
          .where(and(
            eq(schema.users.id, inviterId),
            eq(schema.userResidences.userId, inviterId)
          ))
          .limit(1);

        if (inviterOrganization.length === 0) {
          return { valid: false, reason: 'Managers can only invite users to their own organization' };
        }
      } else {
        return { valid: false, reason: 'Organization ID is required for manager invitations' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate if user can manage specific invitation.
   * @param userId
   * @param userRole
   * @param invitationId
   */
  static async validateInvitationManagement(
    userId: string,
    userRole: string,
    invitationId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    // Admin can manage any invitation
    if (userRole === 'admin') {
      return { valid: true };
    }

    // Get invitation details
    const [invitation] = await db.select()
      .from(schema.invitations)
      .where(eq(schema.invitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      return { valid: false, reason: 'Invitation not found' };
    }

    // Users can only manage their own invitations
    if (invitation.invitedByUserId !== userId) {
      return { valid: false, reason: 'Can only manage own invitations' };
    }

    return { valid: true };
  }

  /**
   * Validate bulk invitation operation.
   * @param inviterId
   * @param inviterRole
   * @param invitations
   */
  static async validateBulkInvitation(
    inviterId: string,
    inviterRole: string,
    invitations: { role: string; organizationId?: string; buildingId?: string }[]
  ): Promise<{ valid: boolean; reason?: string; invalidInvitations?: number[] }> {
    const invalidInvitations: number[] = [];

    for (let i = 0; i < invitations.length; i++) {
      const invitation = invitations[i];
      const validation = await this.validateInvitePermission(
        inviterId,
        inviterRole,
        invitation.role,
        invitation.organizationId,
        invitation.buildingId
      );

      if (!validation.valid) {
        invalidInvitations.push(i);
      }
    }

    if (invalidInvitations.length > 0) {
      return {
        valid: false,
        reason: `${invalidInvitations.length} invitations violate permission rules`,
        invalidInvitations
      };
    }

    return { valid: true };
  }
}

/**
 * Enhanced RBAC middleware specifically for invitation operations.
 * Combines role-based permissions with context-aware validation.
 * @param action
 * @param options
 * @param options.validateContext
 * @param options.requireOwnership
 * @param options.allowSelfAccess
 * @param options.auditAction
 */
export function requireInvitationPermission(
  action: string,
  options: {
    validateContext?: boolean;
    requireOwnership?: boolean;
    allowSelfAccess?: boolean;
    auditAction?: string;
  } = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check basic permission
      const hasPermission = checkPermission(permissions, req.user.role as any, action as any);
      
      if (!hasPermission) {
        await InvitationSecurityMonitor.triggerAlert({
          level: SecurityAlertLevel.MEDIUM,
          type: 'permission_denied',
          description: `User ${req.user.id} (${req.user.role}) attempted unauthorized action: ${action}`,
          userId: req.user.id,
          ipAddress: req.ip,
          metadata: { action, path: req.path, method: req.method }
        });

        return res.status(403).json({
          message: 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
          required: action,
          userRole: req.user.role
        });
      }

      // Context-aware validation for specific operations
      if (options.validateContext && req.body) {
        if (action === 'create:invitation') {
          const { role, organizationId, buildingId } = req.body;
          const validation = await InvitationPermissionValidator.validateInvitePermission(
            req.user.id,
            req.user.role,
            role,
            organizationId,
            buildingId
          );

          if (!validation.valid) {
            await InvitationSecurityMonitor.triggerAlert({
              level: SecurityAlertLevel.HIGH,
              type: 'context_permission_violation',
              description: `User ${req.user.id} violated context permission: ${validation.reason}`,
              userId: req.user.id,
              ipAddress: req.ip,
              metadata: { action, reason: validation.reason, targetRole: role }
            });

            return res.status(403).json({
              message: validation.reason || 'Context permission denied',
              code: 'CONTEXT_PERMISSION_DENIED'
            });
          }
        }

        if (action === 'bulk:invitation') {
          const { invitations } = req.body;
          const validation = await InvitationPermissionValidator.validateBulkInvitation(
            req.user.id,
            req.user.role,
            invitations
          );

          if (!validation.valid) {
            return res.status(403).json({
              message: validation.reason || 'Bulk invitation permission denied',
              code: 'BULK_PERMISSION_DENIED',
              invalidInvitations: validation.invalidInvitations
            });
          }
        }
      }

      // Ownership validation for management operations
      if (options.requireOwnership && req.params.id) {
        const validation = await InvitationPermissionValidator.validateInvitationManagement(
          req.user.id,
          req.user.role,
          req.params.id
        );

        if (!validation.valid) {
          return res.status(403).json({
            message: validation.reason || 'Not authorized to manage this invitation',
            code: 'OWNERSHIP_REQUIRED'
          });
        }
      }

      // Monitor invitation access
      await InvitationSecurityMonitor.monitorInvitationAccess(
        req.user.id,
        options.auditAction || action,
        req.ip,
        req.get('User-Agent'),
        { path: req.path, method: req.method }
      );

      next();
    } catch (error) {
      console.error('Invitation RBAC error:', error);
      return res.status(500).json({
        message: 'Permission validation failed',
        code: 'RBAC_ERROR'
      });
    }
  };
}

/**
 * Enhanced audit logging for invitation operations.
 * @param invitationId
 * @param action
 * @param performedBy
 * @param req
 * @param previousStatus
 * @param newStatus
 * @param details
 */
export async function createEnhancedInvitationAuditLog(
  invitationId: string,
  action: string,
  performedBy: string | null,
  req: Request,
  previousStatus?: string,
  newStatus?: string,
  details?: any
) {
  try {
    // Get additional context
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const referrer = req.get('Referer');
    const forwardedFor = req.get('X-Forwarded-For');

    // Enhanced details with security context
    const enhancedDetails = {
      ...details,
      security: {
        ipAddress,
        userAgent,
        referrer,
        forwardedFor,
        timestamp: new Date().toISOString(),
        sessionId: req.sessionID
      }
    };

    // Create audit log entry
    await db.insert(schema.invitationAuditLog).values([{
      invitationId,
      action,
      performedBy,
      ipAddress,
      userAgent,
      details: enhancedDetails,
      previousStatus: previousStatus as any,
      newStatus: newStatus as any
    }]);

    // Log to console for immediate visibility
    console.warn(`📋 INVITATION AUDIT: ${action}`, {
      invitationId,
      performedBy,
      ipAddress,
      action,
      previousStatus,
      newStatus
    });

  } catch (error) {
    console.error('Failed to create enhanced audit log:', error);
  }
}

/**
 * Delegation and inheritance middleware for invitation permissions.
 * Allows temporary permission elevation based on organizational hierarchy.
 * @param baseAction
 */
export function withPermissionInheritance(baseAction: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Check if user has direct permission
      const hasDirectPermission = checkPermission(permissions, req.user.role as any, baseAction as any);
      
      if (hasDirectPermission) {
        return next();
      }

      // Check for delegated permissions based on organizational context
      if (req.body?.organizationId || req.params.organizationId) {
        const orgId = req.body?.organizationId || req.params.organizationId;
        
        // Check if user has elevated permissions in this organization
        const userOrgRole = await db.select()
          .from(schema.users)
          .leftJoin(schema.buildings, eq(schema.buildings.organizationId, orgId))
          .leftJoin(schema.residences, eq(schema.residences.buildingId, schema.buildings.id))
          .leftJoin(schema.userResidences, eq(schema.userResidences.residenceId, schema.residences.id))
          .where(and(
            eq(schema.users.id, req.user.id),
            eq(schema.userResidences.relationshipType, 'owner')
          ))
          .limit(1);

        // Owners in an organization get elevated permissions for tenant management
        if (userOrgRole.length > 0 && baseAction === 'create:invitation') {
          const validation = await InvitationPermissionValidator.validateInvitePermission(
            req.user.id,
            'manager', // Temporarily elevate to manager permissions
            req.body?.role,
            orgId,
            req.body?.buildingId
          );

          if (validation.valid) {
            // Log permission inheritance
            await createEnhancedInvitationAuditLog(
              req.body?.invitationId || 'unknown',
              'permission_inherited',
              req.user.id,
              req,
              undefined,
              undefined,
              { baseAction, inheritedLevel: 'manager', reason: 'organizational_owner' }
            );

            return next();
          }
        }
      }

      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: baseAction,
        userRole: req.user.role
      });

    } catch (error) {
      console.error('Permission inheritance error:', error);
      return res.status(500).json({
        message: 'Permission validation failed',
        code: 'INHERITANCE_ERROR'
      });
    }
  };
}

// Initialize security monitoring
InvitationSecurityMonitor.onAlert((alert) => {
  // In production, you might want to:
  // - Send alerts to security team
  // - Log to external monitoring service
  // - Trigger automated responses
  console.log(`🔔 Security Alert Handler: ${alert.type} - ${alert.description}`);
});