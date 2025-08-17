# Page Organization Guide

## Overview

This guide establishes the standards for organizing page components in the Koveo Gestion application to ensure maintainability, scalability, and clear role-based access patterns.

## Directory Structure

All page components must be located in `client/src/pages/` and organized according to the following structure:

```
client/src/pages/
├── admin/                 # Admin-only pages (full system access)
├── manager/               # Manager pages (building/organization management)
├── owner/                 # Property owner pages (ownership features)
├── residents/             # Resident/tenant pages (residence-specific)
├── auth/                  # Authentication pages (login, registration, etc.)
├── settings/              # Settings pages (user preferences, configurations)
├── home.tsx              # Public landing page
└── not-found.tsx         # 404 error page
```

## Role-Based Access Patterns

### Admin Pages (`admin/`)
- **Access**: Admin users only
- **Purpose**: System-wide administration, user management, global settings
- **Examples**: `organizations.tsx`, `permissions.tsx`, `quality.tsx`

### Manager Pages (`manager/`)
- **Access**: Manager and Admin users
- **Purpose**: Building and organization management, financial oversight
- **Examples**: `buildings.tsx`, `bills.tsx`, `budget.tsx`

### Owner Pages (`owner/`)
- **Access**: Property owners, Managers, and Admins
- **Purpose**: Property ownership features, investment tracking
- **Examples**: `dashboard.tsx`, `roadmap.tsx`

### Residents Pages (`residents/`)
- **Access**: Residents, Tenants, and higher roles
- **Purpose**: Residence-specific features, community interaction
- **Examples**: `dashboard.tsx`, `building.tsx`, `demands.tsx`

### Auth Pages (`auth/`)
- **Access**: Unauthenticated users primarily
- **Purpose**: Authentication flows, registration, password reset
- **Examples**: `login.tsx`, `invitation-acceptance.tsx`

### Settings Pages (`settings/`)
- **Access**: All authenticated users
- **Purpose**: User preferences, account settings, application configuration
- **Examples**: `settings.tsx`, `bug-reports.tsx`, `idea-box.tsx`

## Naming Conventions

### File Naming
- Use **kebab-case** for new files: `user-management.tsx`, `bug-reports.tsx`
- Existing **camelCase** files are acceptable during transition: `organizations.tsx`
- Always use `.tsx` extension for React components

### Component Naming
- Use **PascalCase** for component names: `UserManagement`, `BugReports`
- Default export should match the primary purpose: `export default function UserManagement()`

## Page Component Standards

### Required Elements
Each page component must include:

1. **Default Export**: `export default function PageName()`
2. **Proper JSDoc**: Document purpose, access requirements, and key features
3. **Role-Based Access**: Implement appropriate permission checks
4. **Consistent Layout**: Use shared layout components where applicable

### Example Template
```tsx
/**
 * User Management Page
 * 
 * Allows managers and admins to view and manage users within their organization.
 * Implements role-based access control and organization-level restrictions.
 */

import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/layout/header';

export default function UserManagement() {
  const { user, hasPermission } = useAuth();

  // Role-based access check
  if (!hasPermission('manage:users')) {
    return <div>Access denied</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header 
        title="User Management" 
        subtitle="Manage users within your organization"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Page content */}
      </div>
    </div>
  );
}
```

## Anti-Patterns to Avoid

### ❌ Duplicate Pages
Don't create the same page in multiple role directories:
```
admin/suggestions.tsx
owner/suggestions.tsx          # ❌ Duplicate
admin/suggestions-with-filter.tsx
owner/suggestions-with-filter.tsx  # ❌ Duplicate
```

### ❌ Orphaned Pages
Don't place role-specific pages in the root directory:
```
pages/pillars.tsx              # ❌ Should be in admin/ or owner/
pages/user-profile.tsx         # ❌ Should be in settings/
```

### ❌ Mixed Concerns
Don't mix different access patterns in the same directory:
```
admin/login.tsx                # ❌ Auth pages should be in auth/
manager/home.tsx               # ❌ Public pages should be in root
```

## Migration Guidelines

### For Existing Duplicate Pages
1. **Identify the primary role** that should own the page
2. **Move the page** to the appropriate role directory
3. **Update imports** in App.tsx and other files
4. **Remove duplicate** files from other directories
5. **Update tests** to reflect new location

### For Orphaned Pages
1. **Determine appropriate role directory** based on access requirements
2. **Move the file** to the correct location
3. **Update all imports** throughout the application
4. **Verify routing** in App.tsx

## Router Registration

All pages must be properly registered in `client/src/App.tsx`:

```tsx
// Role-based route groups
<Route path="/admin/*" component={AdminRoutes} />
<Route path="/manager/*" component={ManagerRoutes} />
<Route path="/owner/*" component={OwnerRoutes} />
<Route path="/residents/*" component={ResidentsRoutes} />
<Route path="/auth/*" component={AuthRoutes} />
<Route path="/settings/*" component={SettingsRoutes} />

// Root pages
<Route path="/" component={HomePage} />
<Route path="/*" component={NotFound} />
```

## Testing Requirements

### Page Organization Tests
- All pages must be in the correct role directory
- No duplicate page files across roles
- Proper naming conventions followed
- Valid React component structure

### Integration Tests
- Pages properly accessible based on user role
- Routing works correctly for all page locations
- Permission checks function as expected

## Quality Gates

Before merging any page-related changes:

1. **Run page organization tests**: `npm run test:page-organization`
2. **Verify routing works**: Manual testing of all affected routes
3. **Check permissions**: Ensure role-based access is correct
4. **Update documentation**: If adding new pages or changing structure

## Continuous Improvement

This organization structure will evolve as the application grows. Regular reviews should assess:

- **New role requirements**: Do we need additional role directories?
- **Page consolidation**: Can similar pages be merged?
- **Access pattern changes**: Do role responsibilities need adjustment?
- **Performance impact**: Are there too many files in any directory?

## Tools and Automation

### Available Scripts
- `npm run test:page-organization` - Validate page organization
- `npm run lint:pages` - Check page naming conventions  
- `npm run validate:routes` - Verify router registration

### IDE Integration
Configure your IDE to:
- Auto-suggest correct directories for new pages
- Warn about potential duplicates
- Validate naming conventions

---

**Last Updated**: August 17, 2025
**Next Review**: September 2025