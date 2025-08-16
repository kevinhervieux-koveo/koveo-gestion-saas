# Koveo Gestion Permissions System

A comprehensive Role-Based Access Control (RBAC) system for the Quebec property management SaaS platform.

## Overview

This permissions system provides granular access control for all features and data entities in Koveo Gestion. It supports four user roles with hierarchical permissions:

- **Admin** (101 permissions): Full system access
- **Manager** (62 permissions): Property management operations
- **Owner** (40 permissions): Property owner operations  
- **Tenant** (13 permissions): Basic resident operations

## Files

- `permissions.json` - Main permissions configuration
- `permissions-schema.ts` - Zod validation schemas and utility functions
- `validate-permissions.ts` - Validation utilities for the permissions file
- `test-permissions.ts` - Test suite for the permissions system
- `index.ts` - Main exports and utilities

## Usage

### Basic Permission Checking

```typescript
import { permissions, checkPermission } from '@/config';

// Check if a user has a specific permission
const canReadBills = checkPermission(permissions, 'admin', 'read:bill');
const canDeleteUsers = checkPermission(permissions, 'tenant', 'delete:user');

console.log(canReadBills); // true
console.log(canDeleteUsers); // false
```

### Getting Role Permissions

```typescript
import { getRolePermissions } from '@/config';

// Get all permissions for a role
const adminPermissions = getRolePermissions(permissions, 'admin');
console.log(ownerPermissions); // ['read:user', 'update:profile', ...]
```

### Role Hierarchy Checking

```typescript
import { hasRoleOrHigher } from '@/config';

// Check if user role meets minimum requirement
const canAccess = hasRoleOrHigher('admin', 'manager'); // true
const cannotAccess = hasRoleOrHigher('tenant', 'admin'); // false
```

### Permission Categories

```typescript
import { PERMISSION_CATEGORIES } from '@/config';

// Access permissions by category
const financialPerms = PERMISSION_CATEGORIES.FINANCIAL_MANAGEMENT;
const userMgmtPerms = PERMISSION_CATEGORIES.USER_MANAGEMENT;
```

## Permission Naming Convention

All permissions follow the pattern: `{action}:{resource}`

### Actions
- `read` - View/retrieve data
- `create` - Add new records
- `update` - Modify existing records
- `delete` - Remove records
- `manage` - Administrative control
- `approve` - Authorization/approval
- `assign` - Assignment operations
- `export` - Data export
- `access` - Feature access

### Resources
- `user`, `organization`, `building`, `residence`
- `bill`, `budget`, `maintenance_request`, `document`
- `feature`, `actionable_item`, `notification`
- `ai_analysis`, `analytics`, `system_settings`

## Validation

### Validate Permissions File

```bash
cd config
npx tsx validate-permissions.ts
```

### Run Tests

```bash
cd config
npx tsx test-permissions.ts
```

### Programmatic Validation

```typescript
import { validatePermissions } from '@/config';

const validation = validatePermissions(permissionsData);
if (validation.success) {
  console.log('Valid permissions:', validation.data);
} else {
  console.error('Validation errors:', validation.error.issues);
}
```

## Role Descriptions

### Admin
- Complete system administration
- User and organization management
- Security and backup operations
- Performance monitoring
- All development framework features

### Manager  
- Property and building management
- Financial operations (bills, budgets)
- Maintenance request coordination
- Document management
- Analytics and reporting

### Owner
- Property oversight
- Budget management
- Maintenance requests
- Document access
- Basic analytics

### Tenant
- Profile management
- View personal bills and budgets
- Create maintenance requests
- Basic AI assistant access
- Notification management

## Adding New Permissions

1. Add the permission to `permissions.json` for appropriate roles
2. Update the `PermissionAction` enum in `permissions-schema.ts`
3. Add to relevant `PERMISSION_CATEGORIES` if applicable
4. Run validation: `npx tsx test-permissions.ts`

## Security Notes

- Permissions are enforced at the API level
- Frontend components should check permissions for UI rendering
- Database queries should include role-based filtering
- All permission changes require validation before deployment

## Testing

The permissions system includes comprehensive tests:

✅ Schema validation  
✅ Role completeness  
✅ Permission hierarchy  
✅ Specific permission checks  
✅ Critical permission verification

Run tests regularly when modifying permissions to ensure system integrity.