# Page Routing Management Guide for Koveo Gestion

## Overview
This document provides comprehensive guidelines for managing pages and routing in the Koveo Gestion application. It addresses the routing issues we encountered (like the persistent /admin/dashboard problem) and provides best practices to prevent similar issues in the future.

## Table of Contents
1. [Application Routing Architecture](#application-routing-architecture)
2. [Page Structure](#page-structure)
3. [Route Categories](#route-categories)
4. [Adding New Pages](#adding-new-pages)
5. [Removing Pages](#removing-pages)
6. [Common Issues and Solutions](#common-issues-and-solutions)
7. [Testing Routes](#testing-routes)
8. [Build Cache Management](#build-cache-management)

## Application Routing Architecture

### Client-Side Routing
- **Framework**: Wouter (lightweight React router)
- **Main Router**: `client/src/App.tsx`
- **Route Protection**: Authentication-based via `useAuth` hook
- **Lazy Loading**: Pages use optimized loaders with memory cleanup

### Server-Side Handling
- **API Routes**: `/api/*` handled by Express in `server/routes.ts`
- **Client Routes**: All non-API routes serve the React SPA via Vite

## Page Structure

```
client/src/pages/
├── admin/           # Admin-only pages
├── auth/            # Authentication pages (login, invitation)
├── manager/         # Manager role pages
├── owner/           # Owner role pages
├── residents/       # Resident/Tenant pages
├── settings/        # Settings pages
├── home.tsx         # Public landing page
├── not-found.tsx    # 404 page
└── pillars.tsx      # Legacy page
```

## Route Categories

### Public Routes (No Authentication Required)
```typescript
/ - Home page
/login - Login page
/accept-invitation - Invitation acceptance page
```

### Protected Routes (Authentication Required)

#### Admin Routes
```typescript
/admin/organizations - Organization management
/admin/documentation - Documentation management
/admin/roadmap - Product roadmap
/admin/quality - Quality assurance
/admin/suggestions - User suggestions
/admin/permissions - RBAC permissions
/admin/user-management - User management
```

#### Owner Routes
```typescript
/owner/dashboard - Owner dashboard
/owner/documentation - Documentation access
/owner/pillars - Pillar framework
/owner/roadmap - Roadmap access
/owner/quality - Quality metrics
/owner/suggestions - Suggestions
/owner/permissions - Permissions view
```

#### Manager Routes
```typescript
/manager/buildings - Building management
/manager/residences - Residence management
/manager/budget - Budget management
/manager/bills - Bill management
/manager/demands - Maintenance requests
/manager/user-management - User management (shared with admin)
```

#### Resident Routes
```typescript
/dashboard - Main dashboard (default after login)
/residents/residence - Residence details
/residents/building - Building information
/residents/demands - Maintenance requests
```

#### Settings Routes
```typescript
/settings/settings - User settings
/settings/bug-reports - Bug reporting
/settings/idea-box - Feature suggestions
```

## Adding New Pages

### Step 1: Create the Page Component
```typescript
// client/src/pages/[role]/[page-name].tsx
import { useAuth } from '@/hooks/use-auth';

export default function NewPage() {
  const { user } = useAuth();
  
  return (
    <div className="container mx-auto p-6">
      {/* Page content */}
    </div>
  );
}
```

### Step 2: Add Lazy Loader in App.tsx
```typescript
// In client/src/App.tsx - Add after other lazy loaders
const NewPage = createOptimizedLoader(
  () => import('@/pages/[role]/[page-name]'),
  '[role]-[page-name]',
  { enableMemoryCleanup: true }
);
```

### Step 3: Add Route in Router Component
```typescript
// In client/src/App.tsx - Router component
<Route path='/[role]/[page-name]' component={NewPage} />
```

### Step 4: Update Sidebar Navigation
```typescript
// In client/src/components/layout/sidebar.tsx
{
  label: 'New Page',
  path: '/[role]/[page-name]',
  icon: IconComponent,
  roles: ['admin', 'owner'] // Specify allowed roles
}
```

### Step 5: Clear Build Cache
```bash
# After adding new routes, always clear cache
rm -rf client/dist
npm run build
```

## Removing Pages

### Critical Steps When Removing Pages

1. **Remove Route from App.tsx**
   - Delete the Route component
   - Remove the lazy loader constant

2. **Remove from Sidebar Navigation**
   - Delete the navigation item from sidebar.tsx

3. **Delete Page Component File**
   - Remove the actual page file from pages directory

4. **Clear ALL Build Caches**
   ```bash
   # This is CRITICAL to prevent cached routes from persisting
   rm -rf client/dist
   rm -rf .vite
   rm -rf node_modules/.vite
   npm run build
   ```

5. **Verify Removal**
   - Check that no references remain in compiled JavaScript
   - Test that the route returns 404

## Common Issues and Solutions

### Issue 1: Removed Route Still Accessible
**Problem**: Page still loads after being removed from source code
**Cause**: Cached JavaScript bundles in client/dist
**Solution**: 
```bash
# Complete cache clear procedure
rm -rf client/dist
rm -rf .vite
rm -rf node_modules/.vite
npm run build
```

### Issue 2: Route Not Found After Adding
**Problem**: New route returns 404
**Cause**: Route not properly registered or build not updated
**Solution**: 
- Verify route is added in App.tsx
- Check that component export is default
- Rebuild the application

### Issue 3: Permission Issues
**Problem**: Users can't access routes they should
**Cause**: RBAC misconfiguration
**Solution**: 
- Check role assignments in sidebar.tsx
- Verify user role in database
- Review RBAC rules in server/rbac.ts

## Testing Routes

### Manual Testing Checklist
- [ ] Route loads correctly when accessed directly
- [ ] Navigation from sidebar works
- [ ] Authentication redirects work properly
- [ ] Role-based access is enforced
- [ ] Page title updates correctly
- [ ] Back/forward browser navigation works

### Automated Testing
See `tests/routing/` directory for automated route tests

## Build Cache Management

### Development Build Cache
```bash
# Location of dev caches
.vite/                    # Vite dev server cache
node_modules/.vite/       # Dependency pre-bundling cache
```

### Production Build Cache
```bash
# Location of production builds
client/dist/              # Production build output
client/dist/assets/       # Bundled JavaScript and CSS
```

### When to Clear Cache
1. After removing any route or page
2. When routes behave unexpectedly
3. After major routing refactors
4. When deploying to production

### Cache Clear Commands
```bash
# Development cache clear
rm -rf .vite node_modules/.vite

# Production cache clear  
rm -rf client/dist

# Complete cache reset
rm -rf .vite node_modules/.vite client/dist
npm run build
```

## Best Practices

1. **Always use TypeScript** for type safety in routes
2. **Implement lazy loading** for better performance
3. **Test routes after changes** both manually and with automated tests
4. **Clear caches completely** when removing routes
5. **Document route changes** in commit messages
6. **Use consistent naming** for routes and components
7. **Group routes by role** for better organization
8. **Implement proper redirects** for deprecated routes
9. **Monitor build output** for unexpected route references
10. **Version control review** before deploying route changes

## Troubleshooting Commands

```bash
# Check what routes are in the build
grep -r "/admin/dashboard" client/dist/

# Find all route definitions
grep -r "Route path=" client/src/

# List all page components
find client/src/pages -name "*.tsx"

# Check sidebar navigation items
grep -r "path:" client/src/components/layout/sidebar.tsx

# Force rebuild with clean cache
rm -rf client/dist .vite node_modules/.vite && npm run build
```

## Migration Guide for Route Changes

When migrating routes (e.g., /admin/dashboard to /owner/dashboard):

1. **Create new route first** - Add new component and route
2. **Add redirect from old route** - Temporary backward compatibility
3. **Update all references** - Sidebar, links, redirects
4. **Test both routes work** - Ensure smooth transition
5. **Remove old route** - Delete component and route
6. **Clear all caches** - Prevent old route from persisting
7. **Deploy and monitor** - Watch for 404s or issues

## Conclusion

Proper route management is critical for application stability. The most common issue is cached JavaScript files serving removed routes. Always follow the complete cache clearing procedure when removing routes, and implement the automated tests to catch routing issues early.