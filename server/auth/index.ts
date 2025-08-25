/**
 * Enhanced Authentication and Authorization Module.
 *
 * Provides comprehensive RBAC, security monitoring, and audit logging
 * for the Koveo Gestion property management system.
 */

// Export existing auth functionality
export {
  sessionConfig,
  hashPassword,
  verifyPassword,
  requireAuth,
  requireRole,
  authorize,
  setupAuthRoutes,
} from '../auth';

// Export enhanced invitation RBAC
export {
  InvitationSecurityMonitor,
  InvitationPermissionValidator,
  rateLimitInvitations,
  requireInvitationPermission,
  createEnhancedInvitationAuditLog,
  withPermissionInheritance,
  SecurityAlertLevel,
  type SecurityAlert,
} from './invitation-rbac';
