import type { Express } from 'express';
// Database-based permissions system - no config files needed
import { requireAuth, authorize } from '../auth';
import { storage } from '../storage';

/**
 * Transform a permission string into a structured permission object.
 * @param permission - Permission string in format "action:resource".
 * @returns Structured permission object with metadata.
 */
/**
 * TransformPermission function.
 * @param permission
 * @returns Function result.
 */
function transformPermission(permission: string) {
  const [action, resource] = permission.split(':');
  const resourceType = resource.replace(/_/g, ' ');

  // Determine category based on resource type
  let category = 'Other';
  const categoryMap: { [key: string]: string } = {
    users: 'User Management',
    organizations: 'Organization Management',
    buildings: 'Building Management',
    residences: 'Residence Management',
    bills: 'Financial Management',
    budgets: 'Financial Management',
    maintenance_requests: 'Maintenance Management',
    documents: 'Document Management',
    notifications: 'Communication',
    features: 'System Features',
    reports: 'Reports & Analytics',
  };
  category = categoryMap[resource] || 'Other';

  return {
    id: permission,
    name: permission,
    displayName: `${action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
    description: `Permission to ${action.replace(/_/g, ' ')} ${resourceType} resources`,
    resourceType: resource,
    action: action,
    category: category,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Register all RBAC permissions management API routes.
 * @param app - Express application instance.
 */
/**
 * RegisterPermissionsRoutes function.
 * @param app
 * @returns Function result.
 */
export function registerPermissionsRoutes(app: Express) {
  // Get all system permissions from database
  app.get('/api/permissions', requireAuth, authorize('read:users'), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error: any) {
      console.error('❌ Error fetching permissions:', error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  });

  // Get role-based permissions from database
  app.get('/api/role-permissions', requireAuth, authorize('read:users'), async (req, res) => {
    try {
      const rolePermissions = await storage.getRolePermissions();
      res.json(rolePermissions);
    } catch (error: any) {
      console.error('❌ Error fetching role permissions:', error);
      res.status(500).json({ message: 'Failed to fetch role permissions' });
    }
  });

  // Get permissions matrix for admin dashboard
  app.get('/api/permissions-matrix', requireAuth, authorize('read:users'), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      const rolePermissions = await storage.getRolePermissions();

      // Group permissions by resource type
      const permissionsByResource = permissions.reduce((acc: any, permission: any) => {
        if (!acc[permission.resourceType]) {
          acc[permission.resourceType] = [];
        }
        acc[permission.resourceType].push(permission);
        return acc;
      }, {});

      // Create role matrix (correct hierarchy: admin-manager-resident-tenant)
      const roleMatrix = ['admin', 'manager', 'resident', 'tenant'].reduce((acc: any, role) => {
        acc[role] = rolePermissions
          .filter((rp: any) => rp.role === role)
          .map((rp: any) => rp.permissionId);
        return acc;
      }, {});

      res.json({
        permissionsByResource,
        roleMatrix,
        permissions,
        rolePermissions,
      });
      res.status(500).json({ message: 'Failed to fetch permissions matrix' });
    }
  });

  // Get user-specific permissions (overrides)
  app.get('/api/user-permissions', requireAuth, authorize('read:users'), async (req, res) => {
    try {
      const userPermissions = await storage.getUserPermissions();
      res.json(userPermissions);
      res.status(500).json({ message: 'Failed to fetch user permissions' });
    }
  });

  // Grant permission to user
  app.post(
    '/api/user-permissions',
    requireAuth,
    authorize('manage_permissions:users'),
    async (req, res) => {
      try {
        const { userId, permissionId, reason } = req.body;

        if (!userId || !permissionId) {
          return res.status(400).json({
            message: 'userId and permissionId are required',
          });
        }

        // Validate that the permission exists in database
        const permission = await storage
          .getPermissions()
          .then((perms) => perms.find((p) => p.id === permissionId || p.name === permissionId));

        if (!permission) {
          return res.status(400).json({
            message: 'Invalid permission',
          });
        }

        // TODO: Implement user permission override in database
        // For now, return success but note that this would need database schema changes
        res.status(501).json({
          message: 'User permission overrides not yet implemented',
          note: 'This feature requires additional database schema for user_permission_overrides table',
        });
        res.status(500).json({ message: 'Failed to grant user permission' });
      }
    }
  );

  // Revoke permission from user
  app.delete(
    '/api/user-permissions/:userId/:permissionId',
    requireAuth,
    authorize('manage:user_roles'),
    async (req, res) => {
      try {
        const { userId, permissionId } = req.params;

        // TODO: Implement user permission revocation in database
        res.status(501).json({
          message: 'User permission overrides not yet implemented',
          note: 'This feature requires additional database schema for user_permission_overrides table',
        });
        res.status(500).json({ message: 'Failed to revoke user permission' });
      }
    }
  );

  // Update role permissions (admin only)
  app.patch(
    '/api/role-permissions/:role',
    requireAuth,
    authorize('manage:user_roles'),
    async (req, res) => {
      try {
        const { role } = req.params;
        const { permissions } = req.body;

        if (!['admin', 'manager', 'tenant', 'resident'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role' });
        }

        if (!Array.isArray(permissions)) {
          return res.status(400).json({ message: 'Permissions must be an array' });
        }

        // TODO: Implement role permission updates
        // This would require updating the permissions.json file or moving to database
        res.status(501).json({
          message: 'Role permission updates not yet implemented',
          note: 'This feature requires implementing a mechanism to update permissions.json or move permissions to database',
        });
        res.status(500).json({ message: 'Failed to update role permissions' });
      }
    }
  );

  // Get permission categories for organization
  app.get('/api/permission-categories', requireAuth, authorize('read:users'), async (req, res) => {
    try {
      // Generate categories based on database permissions
      const permissions = await storage.getPermissions();
      const categoryMap: { [key: string]: any[] } = {};

      permissions.forEach((permission) => {
        const categoryName =
          {
            users: 'User Management',
            organizations: 'Organization Management',
            buildings: 'Building Management',
            residences: 'Residence Management',
            bills: 'Financial Management',
            budgets: 'Financial Management',
            maintenance_requests: 'Maintenance Management',
            documents: 'Document Management',
            notifications: 'Communication',
            features: 'System Features',
            reports: 'Reports & Analytics',
          }[permission.resourceType] || 'Other';

        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = [];
        }
        categoryMap[categoryName].push(permission);
      });

      const categories = Object.entries(categoryMap).map(([name, perms]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        permissions: perms,
        count: perms.length,
      }));

      res.json(categories);
      res.status(500).json({ message: 'Failed to fetch permission categories' });
    }
  });

  // Validate user has specific permission
  app.post('/api/permissions/validate', requireAuth, async (req, res) => {
    try {
      const { permission } = req.body;

      if (!permission) {
        return res.status(400).json({ message: 'Permission is required' });
      }

      // Check permission via database
      const rolePermissions = await storage.getRolePermissions();
      const hasPermission = rolePermissions.some(
        (rp: any) =>
          rp.role === req.user!.role && rp.permission && rp.permission.name === permission
      );

      res.json({
        hasPermission,
        role: req.user!.role,
        permission,
        message: hasPermission ? 'Permission granted' : 'Permission denied',
      });
      res.status(500).json({ message: 'Failed to validate permission' });
    }
  });
}
