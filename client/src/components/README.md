# Components Directory

## Overview

This directory contains all React components for the Koveo Gestion application, organized by functionality and responsibility. All components follow consistent patterns for TypeScript, accessibility, and documentation.

## Directory Structure

```text
components/
├── admin/              # Admin-specific components
├── auth/               # Authentication components
├── dashboard/          # Dashboard and initialization components
├── filter-sort/        # Advanced filtering and sorting system
├── forms/              # Form components (centralized)
├── layout/             # Layout and navigation components
├── roadmap/            # Roadmap and feature management
├── ssl/                # SSL certificate management
└── ui/                 # Base UI components (shadcn/ui)
```

## Component Categories

### Admin Components (`admin/`)

- **invitation-management.tsx** - User invitation lifecycle management
- **user-list.tsx** - Comprehensive User Management with bulk operations
- **permission-matrix.tsx** - Role-based permission visualization

### Authentication (`auth/`)

- **registration-wizard.tsx** - Multi-step user registration flow
- **login-form.tsx** - User authentication interface

### Dashboard Components (`dashboard/`)

- **initialization-wizard.tsx** - Project setup and onboarding
- **metrics-display.tsx** - Key performance indicators
- **activity-feed.tsx** - Real-time system updates

### Form Components (`forms/`)

All form components are centralized for reusability:

- **feature-form.tsx** - Feature planning and development
- **organization-form.tsx** - Quebec-compliant organization management
- **user-form.tsx** - User creation and editing
- **invitation-form.tsx** - User invitation system

### Layout Components (`layout/`)

- **header.tsx** - Page headers with mobile menu integration
- **sidebar.tsx** - Navigation with role-based access
- **mobile-menu.tsx** - Responsive navigation overlay

### Roadmap Components (`roadmap/`)

- **feature-board.tsx** - Kanban-style feature management
- **actionable-items-panel.tsx** - Task breakdown and tracking
- **roadmap-timeline.tsx** - Visual development timeline

## Documentation Standards

### Component Documentation

All components must include:

```typescript
/**
 * @fileoverview Brief component description
 *
 * Detailed explanation of component purpose, functionality, and integration.
 * Include any special considerations for Quebec compliance, accessibility, etc.
 *
 * @author Koveo Gestion Team
 * @version 1.0.0
 */

/**
 * Props for the ComponentName component
 *
 * @interface ComponentNameProps
 * @property {Type} propName - Description of the prop
 */
interface ComponentNameProps {
  // Props definition
}
```

### Code Examples

Each component directory should include usage examples:

```typescript
// Basic usage
<ComponentName
  prop1="value1"
  prop2={value2}
  onAction={handleAction}
/>

// Advanced usage with all props
<ComponentName
  prop1="value1"
  prop2={value2}
  prop3={complexValue}
  onAction={handleAction}
  onError={handleError}
  className="custom-styles"
/>
```

## Development Guidelines

### Props and TypeScript

- All props must be properly typed with interfaces
- Use optional props sparingly and provide sensible defaults
- Document complex prop types with JSDoc comments
- Prefer composition over configuration

### Accessibility

- All interactive elements must have proper ARIA labels
- Support keyboard navigation
- Include focus management for modals and forms
- Test with screen readers

### Quebec Compliance

- Support French and English languages
- Follow WCAG 2.1 AA accessibility standards
- Respect Law 25 privacy requirements
- Use proper Canadian formatting (dates, postal codes, etc.)

### State Management

- Use React Query for server state
- Use local state for UI-only concerns
- Avoid prop drilling - use context for shared state
- Follow the single responsibility principle

### Testing

- Unit tests for business logic
- Integration tests for user interactions
- Accessibility tests for compliance
- Visual regression tests for UI consistency

## Common Patterns

### Form Components

All form components follow this pattern:

- Zod schema validation
- React Hook Form integration
- Mutation handling with optimistic updates
- Error handling with toast notifications
- Loading states and disabled controls

### Data Components

Components that fetch data use:

- React Query for data fetching
- Loading and error states
- Skeleton components for loading UI
- Proper cache invalidation

### Modal Components

Dialog components include:

- Proper focus management
- Keyboard event handling (ESC to close)
- Backdrop click handling
- Accessible titles and descriptions

## Performance Considerations

- Use React.memo for expensive renders
- Implement proper key props for lists
- Lazy load heavy components
- Optimize bundle size with dynamic imports
- Use proper dependency arrays in hooks

## Migration and Updates

When updating components:

1. Update TypeScript types first
2. Run tests to ensure compatibility
3. Update documentation and examples
4. Consider backward compatibility
5. Update related components that depend on changes

## Quality Standards

All components must:

- Pass TypeScript compilation
- Have proper JSDoc documentation
- Include unit tests with 80%+ coverage
- Follow accessibility guidelines
- Support responsive design
- Work in both light and dark themes
