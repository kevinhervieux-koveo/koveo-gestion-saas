# Role-Based Access Control (RBAC) System Documentation

## Overview

The Koveo Gestion platform implements a comprehensive Role-Based Access Control (RBAC) system to manage user permissions and access across the property management platform. The system enforces strict authorization rules to ensure users can only access resources and perform actions appropriate to their role.

## User Roles

The system supports exactly **four user roles**, each with specific responsibilities and permissions:

### 1. Admin (Administrator)
**Role Level:** 4 (Highest)
**Purpose:** Full system administration and management

**Key Responsibilities:**
- System configuration and settings management
- User account management across all organizations
- Security and compliance oversight
- Global analytics and reporting
- Platform maintenance and updates

**Core Permissions:**
- All permissions from lower roles
- `delete:user` - Remove user accounts
- `manage:user_roles` - Change user roles
- `manage:security_settings` - Configure security policies
- `backup:system` - Create system backups
- `restore:system` - Restore from backups
- `manage:audit_logs` - Access and manage audit logs

### 2. Manager (Property Manager)
**Role Level:** 3
**Purpose:** Property and resident management

**Key Responsibilities:**
- Building and unit management
- Resident account management
- Financial operations (bills, budgets)
- Maintenance request oversight
- Document management
- Communication with residents

**Core Permissions:**
- All permissions from lower roles
- `create:user` - Create new user accounts
- `update:user` - Modify user information
- `create:building` - Add new buildings
- `update:building` - Modify building information
- `create:bill` - Generate bills
- `update:bill` - Modify bills
- `create:budget` - Create budgets
- `update:budget` - Modify budgets
- `manage:maintenance_request` - Handle maintenance requests
- `create:document` - Upload documents
- `create:notification` - Send notifications

### 3. Tenant (Locataire)
**Role Level:** 2
**Purpose:** Active property tenant with payment responsibilities

**Key Responsibilities:**
- Bill payment and tracking
- Maintenance request submission
- Document access for their unit
- Profile management
- Communication with property management

**Core Permissions:**
- All permissions from Resident role
- `pay:bill` - Make bill payments
- `view:payment_history` - Access payment records
- `create:payment_method` - Add payment methods
- `submit:complaint` - File complaints
- `view:lease` - Access lease documents

### 4. Resident (Résident)
**Role Level:** 1 (Base)
**Purpose:** Basic resident access (non-tenant occupants)

**Key Responsibilities:**
- View residence information
- Submit basic maintenance requests
- Access relevant documents
- View notifications
- Update personal profile

**Core Permissions:**
- `read:profile` - View own profile
- `update:profile` - Update personal information
- `read:residence` - View residence details
- `read:bill` - View bills (read-only)
- `read:maintenance_request` - View maintenance requests
- `create:maintenance_request` - Submit maintenance requests
- `update:own_maintenance_request` - Update own requests
- `read:document` - Access shared documents
- `read:notification` - View notifications

## Role Hierarchy

The system implements a strict hierarchical structure:

```
Admin (Level 4)
  └─> Manager (Level 3)
      └─> Tenant (Level 2)
          └─> Resident (Level 1)
```

Each role inherits all permissions from lower-level roles. For example:
- Admins have all permissions from Manager, Tenant, and Resident roles
- Managers have all permissions from Tenant and Resident roles
- Tenants have all permissions from the Resident role

## Implementation Details

### Configuration Files

**1. Permission Schema (`config/permissions-schema.ts`)**
```typescript
export const UserRole = z.enum(['admin', 'manager', 'tenant', 'resident']);
```

**2. Role Hierarchy (`config/index.ts`)**
```typescript
export const ROLE_HIERARCHY = {
  admin: 4,
  manager: 3,
  tenant: 2,
  resident: 1
} as const;
```

**3. Permissions Configuration (`config/permissions.json`)**
- Defines specific permissions for each role
- Maintained in JSON format for easy updates
- Validated against schema on startup

### Database Schema

**User Role Enum (`shared/schema.ts`)**
```typescript
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'tenant', 'resident']);
```

### Authentication Middleware

The system provides three levels of authentication/authorization:

1. **`requireAuth`** - Ensures user is authenticated
2. **`requireRole(['role1', 'role2'])`** - Checks if user has one of the specified roles
3. **`authorize('permission:name')`** - Verifies specific permission

### API Endpoints

All API endpoints are protected with appropriate role/permission checks:

```typescript
// Example: Only admins can delete users
router.delete('/users/:id', 
  requireAuth, 
  requireRole(['admin']), 
  deleteUser
);

// Example: Managers and above can create bills
router.post('/bills', 
  requireAuth, 
  authorize('create:bill'), 
  createBill
);
```

## Invitation System

The platform includes a comprehensive invitation system that respects role hierarchy:

### Role-Based Invitation Permissions
- **Admins** can invite: Admins, Managers, Tenants, Residents
- **Managers** can invite: Tenants, Residents
- **Tenants** cannot invite users
- **Residents** cannot invite users

### Invitation Features
- Customizable expiration period (1-30 days)
- Optional 2FA requirement
- Personal message inclusion
- Organization/building assignment
- Bulk invitation support (up to 20 at once)
- Audit logging for all invitations

## Security Considerations

### Session Management
- Sessions stored in PostgreSQL for persistence
- Role and permissions cached in session
- Automatic session invalidation on role change
- Configurable session timeout

### Permission Validation
- Runtime validation of all permission checks
- Type-safe permission definitions
- Audit logging for authorization failures
- Rate limiting on sensitive operations

### Best Practices
1. Always use the most restrictive role appropriate for the user
2. Regularly audit user roles and permissions
3. Implement additional checks for sensitive operations
4. Log all role changes and permission escalations
5. Review and update permissions as features evolve

## Testing

The RBAC system includes comprehensive test coverage:

- Unit tests for permission checking logic
- Integration tests for API endpoint authorization
- End-to-end tests for complete workflows
- Performance tests for permission validation

Test files:
- `tests/unit/auth/rbac.test.ts` - Core RBAC logic
- `tests/integration/api/rbac-endpoints.test.ts` - API authorization
- `tests/integration/invitation/rbac-system.test.ts` - Invitation permissions

## Migration Guide

When updating from previous role systems:

1. **Database Migration**: Run `npm run db:push` to update role enums
2. **User Role Mapping**: 
   - Previous "owner" roles → "tenant" or "manager" (based on context)
   - New "resident" role for non-tenant occupants
3. **Permission Review**: Audit existing user permissions
4. **Testing**: Verify all endpoints with each role

## Compliance

The RBAC system supports Quebec Law 25 compliance by:
- Implementing principle of least privilege
- Maintaining detailed audit logs
- Providing granular access controls
- Supporting data minimization requirements
- Enabling user consent management

## Future Enhancements

Planned improvements to the RBAC system:
- Dynamic permission assignment
- Temporary permission elevation
- Role delegation capabilities
- Custom role creation (Enterprise tier)
- API key-based authentication
- OAuth2/SAML integration