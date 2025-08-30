# Configuration Files

## Overview

This directory contains centralized configuration files that define application-wide settings, constants, and structures. These files serve as the single source of truth for various aspects of the application.

## Files

### Navigation Configuration (`navigation.ts`)

**Purpose**: Centralized navigation structure and role-based access control

**Key Features**:

- Single source of truth for all navigation items
- Type-safe navigation definitions with TypeScript interfaces
- Role hierarchy configuration and permission checking
- Filtered navigation based on user roles
- Icon and route definitions for all menu items

**Usage**:

```typescript
import { getFilteredNavigation, hasRoleOrHigher } from '@/config/navigation';

// Get navigation for current user
const userNavigation = getFilteredNavigation(user?.role);

// Check permissions
const canAccess = hasRoleOrHigher(user?.role, 'admin');
```

**Structure**:

- `NavigationItem`: Individual menu items with href, icon, and optional role requirements
- `NavigationSection`: Grouped navigation sections (Admin, Manager, Residents, Settings)
- `NAVIGATION_CONFIG`: Complete navigation structure array
- `ROLE_HIERARCHY`: Permission levels (tenant=1, resident=1, manager=2, admin=3)

**Benefits**:

- **Consistency**: All navigation references use the same configuration
- **Maintainability**: Changes to navigation structure happen in one place
- **Type Safety**: TypeScript interfaces prevent configuration errors
- **Permission Control**: Centralized role-based access control
- **Documentation**: Self-documenting navigation structure

## Adding New Configuration

When adding new configuration files:

1. **Follow Naming Convention**: Use descriptive names like `[feature].ts` or `[domain]-config.ts`
2. **Export Types**: Define and export TypeScript interfaces for type safety
3. **Document Purpose**: Include JSDoc comments explaining the configuration's purpose
4. **Provide Examples**: Include usage examples in comments or README
5. **Centralize Constants**: Move scattered constants from components to config files

## Best Practices

### Type Safety

```typescript
// Define clear interfaces
export interface ConfigSection {
  name: string;
  key: string;
  enabled: boolean;
}

// Use const assertions for immutable data
export const CONFIG = {
  api: {
    timeout: 5000,
    retries: 3,
  } as const,
};
```

### Documentation

```typescript
/**
 * Application-wide theme configuration.
 * Controls colors, spacing, and visual elements.
 */
export const THEME_CONFIG = {
  // Configuration object
};
```

### Validation

```typescript
// Include validation functions where appropriate
export function validateConfig(config: AppConfig): boolean {
  // Validation logic
  return true;
}
```

## Integration with Components

Components should import configuration rather than defining constants inline:

```typescript
// ❌ Avoid: Constants in components
const MENU_ITEMS = [
  { name: 'Home', href: '/' },
  // ...
];

// ✅ Preferred: Import from config
import { NAVIGATION_CONFIG } from '@/config/navigation';
```

This approach ensures:

- Consistency across the application
- Single point of truth for changes
- Better testability and maintainability
- Easier debugging and troubleshooting
