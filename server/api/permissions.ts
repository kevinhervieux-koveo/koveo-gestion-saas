import type { Express } from 'express';
import { permissions as permissionsConfig, checkPermission, getRolePermissions, PERMISSION_CATEGORIES } from '../../config';
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
  
  // Find the category for this permission
  let category = 'Other';
  for (const [categoryName, categoryPermissions] of Object.entries(PERMISSION_CATEGORIES)) {
    if (categoryPermissions.includes(permission as never)) {
      category = categoryName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      break;
    }
  }

  return {
    id: permission,
    name: permission,
    displayName: `${action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`,
    description: `Permission to ${action.replace(/_/g, ' ')} ${resourceType} resources`,
    resourceType: resource,
    action: action,
    category: category,
    isActive: true,
    createdAt: new Date().toISOString()
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
  app.get('/api/permissions', requireAuth, authorize('read:user'), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (___error) {
      console.error('Error fetching permissions:', _error);
      res.status(500).json({ message: 'Failed to fetch permissions' });
    }
  });

  // Get role-based permissions from database
  app.get('/api/role-permissions', requireAuth, authorize('read:user'), async (req, res) => {
    try {
      const rolePermissions = await storage.getRolePermissions();
      res.json(rolePermissions);
    } catch (___error) {
      console.error('Error fetching role permissions:', _error);
      res.status(500).json({ message: 'Failed to fetch role permissions' });
    }
  });

  // Get permissions matrix for admin dashboard
  app.get('/api/permissions-matrix', requireAuth, authorize('read:user'), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      const rolePermissions = await storage.getRolePermissions();
      
      // Group permissions by resource type
      const permissionsByResource = permissions.reduce((acc: unknown, permission: unknown) => {
        if (!acc[permission.resourceType]) {
          acc[permission.resourceType] = [];
        }
        acc[permission.resourceType].push(permission);
        return acc;
      }, {});

      // Create role matrix
      const roleMatrix = ['admin', 'manager', 'resident'].reduce((acc: any, role) => {
        acc[role] = rolePermissions
          .filter((rp: unknown) => rp.role === role)
          .map((rp: unknown) => rp.permissionId);
        return acc;
      }, {});

      res.json({
        permissionsByResource,
        roleMatrix,
        permissions,
        rolePermissions
      });
    } catch (___error) {
      console.error('Error fetching permissions matrix:', _error);
      res.status(500).json({ message: 'Failed to fetch permissions matrix' });
    }
  });

  // Get user-specific permissions (overrides)
  app.get('/api/user-permissions', requireAuth, authorize('read:user'), async (req, res) => {
    try {
      // For now, return empty array as user-specific permission overrides
      // would need to be implemented in the database schema
      // This is where you would query user_permissions table if it existed
      const userPermissions: unknown[] = [];
      
      res.json(userPermissions);
    } catch (___error) {
      console.error('Error fetching user permissions:', _error);
      res.status(500).json({ message: 'Failed to fetch user permissions' });
    }
  });

  // Grant permission to user
  app.post('/api/user-permissions', requireAuth, authorize('manage:user_roles'), async (req, res) => {
    try {
      const { userId, permissionId, reason } = req.body;
      
      if (!userId || !permissionId) {
        return res.status(400).json({ 
          message: 'userId and permissionId are required' 
        });
      }

      // Validate that the permission exists
      const allPermissions = new Set<string>();
      Object.values(permissionsConfig as any).forEach((rolePermissions: unknown) => {
        (rolePermissions as string[]).forEach(permission => allPermissions.add(permission));
      });
      
      if (!allPermissions.has(permissionId)) {
        return res.status(400).json({ 
          message: 'Invalid permission' 
        });
      }

      // TODO: Implement user permission override in database
      // For now, return success but note that this would need database schema changes
      res.status(501).json({ 
        message: 'User permission overrides not yet implemented',
        note: 'This feature requires additional database schema for user_permission_overrides table'
      });
      
    } catch (___error) {
      console.error('Error granting user permission:', _error);
      res.status(500).json({ message: 'Failed to grant user permission' });
    }
  });

  // Revoke permission from user
  app.delete('/api/user-permissions/:userId/:permissionId', requireAuth, authorize('manage:user_roles'), async (req, res) => {
    try {
      const { userId, permissionId } = req.params;
      
      // TODO: Implement user permission revocation in database
      res.status(501).json({ 
        message: 'User permission overrides not yet implemented',
        note: 'This feature requires additional database schema for user_permission_overrides table'
      });
      
    } catch (___error) {
      console.error('Error revoking user permission:', _error);
      res.status(500).json({ message: 'Failed to revoke user permission' });
    }
  });

  // Update role permissions (admin only)
  app.patch('/api/role-permissions/:role', requireAuth, authorize('manage:user_roles'), async (req, res) => {
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
        note: 'This feature requires implementing a mechanism to update permissions.json or move permissions to database'
      });
      
    } catch (___error) {
      console.error('Error updating role permissions:', _error);
      res.status(500).json({ message: 'Failed to update role permissions' });
    }
  });

  // Get permission categories for organization
  app.get('/api/permission-categories', requireAuth, authorize('read:user'), async (req, res) => {
    try {
      const categories = Object.entries(PERMISSION_CATEGORIES).map(([name, permissions]) => ({
        id: name.toLowerCase().replace(/_/g, '-'),
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        permissions: permissions.map(p => transformPermission(p)),
        count: permissions.length
      }));
      
      res.json(categories);
    } catch (___error) {
      console.error('Error fetching permission categories:', _error);
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

      const hasPermission = checkPermission(permissionsConfig as any, req.user!.role as any, permission as any);
      
      res.json({
        hasPermission,
        role: req.user!.role,
        permission,
        message: hasPermission ? 'Permission granted' : 'Permission denied'
      });
      
    } catch (___error) {
      console.error('Error validating permission:', _error);
      res.status(500).json({ message: 'Failed to validate permission' });
    }
  });
}