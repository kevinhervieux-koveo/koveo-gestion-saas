# Layout Components

## Overview

This directory contains layout and navigation components that provide the structural foundation for the Koveo Gestion application. These components handle responsive design, accessibility, and consistent user experience across all pages.

## Components

### Header (`header.tsx`)

**Purpose**: Page header with title, subtitle, and workspace status

**Features**:

- Mobile menu integration with safe context access
- Workspace status indicator with active state
- Responsive design for mobile and desktop
- Internationalization support

**Props**:

```typescript
interface HeaderProps {
  title: string; // Main page title
  subtitle?: string; // Optional descriptive subtitle
}
```

**Usage**:

```typescript
import { Header } from '@/components/layout/header';

<Header
  title="Dashboard"
  subtitle="Overview of your property management system"
/>
```

### Sidebar (`sidebar.tsx`)

**Purpose**: Main navigation with role-based menu items

**Features**:

- Role-based navigation with centralized permission checks
- Expandable menu sections for organization
- Mobile overlay with keyboard navigation (ESC key)
- Active route highlighting and breadcrumbs
- User profile section with logout functionality
- Responsive design with mobile menu support
- Consolidated navigation configuration from `/config/navigation.ts`

**Props**:

```typescript
interface SidebarProps {
  isMobileMenuOpen?: boolean; // Mobile menu visibility
  onMobileMenuClose?: () => void; // Close handler for mobile
}
```

**Navigation Structure** (from centralized config):

- **Admin**: Full system access (organizations, documentation, quality, permissions)
- **Manager**: Building and organization management (buildings, residences, budget, bills, demands)
- **Residents**: Residence-specific features (residence, building, demands) - accessible to tenant/resident roles
- **Settings**: User preferences and configurations (settings, bug reports, idea box)

**Configuration**: All navigation items are defined in `/config/navigation.ts` for consistency and maintainability.

### Mobile Menu Integration

Both Header and Sidebar work together to provide responsive navigation:

1. Header displays mobile menu button on small screens
2. Button toggles sidebar overlay visibility
3. Sidebar handles mobile state and keyboard events
4. Body scroll is prevented when mobile menu is open
5. ESC key closes mobile menu for accessibility

## Architecture Patterns

### Context Safety

Components use safe context access patterns:

```typescript
// Safe mobile menu context access
let toggleMobileMenu: (() => void) | undefined;
try {
  const mobileMenu = useMobileMenu();
  toggleMobileMenu = mobileMenu.toggleMobileMenu;
} catch {
  // Gracefully handle missing context
  toggleMobileMenu = undefined;
}
```

### Role-Based Rendering

Navigation items are conditionally rendered based on user roles:

```typescript
const { user, hasRole } = useAuth();

// Role-specific navigation
{hasRole('admin') && (
  <NavItem to="/admin/users" icon={Users}>
    User Management
  </NavItem>
)}
```

### Mobile-First Design

Components prioritize mobile experience:

- Touch-friendly interactive areas (44px minimum)
- Proper focus management for keyboard navigation
- Responsive typography and spacing
- Optimized for one-handed mobile use

## Accessibility Standards

### Keyboard Navigation

- TAB key navigates through all interactive elements
- ENTER/SPACE activates buttons and links
- ESC key closes mobile menu and modals
- Arrow keys navigate menu items where appropriate

### Screen Reader Support

- Proper heading hierarchy (h1, h2, h3)
- ARIA labels for all interactive elements
- Semantic HTML structure (nav, main, header)
- Skip links for main content access

### Focus Management

- Visible focus indicators on all interactive elements
- Focus trapping in mobile menu overlay
- Focus restoration when modals close
- Logical tab order throughout interface

## Quebec Compliance

### Language Support

- Full French and English translation support
- Proper language attributes (lang="fr" / lang="en")
- Cultural considerations for navigation patterns
- RTL support preparation for future expansion

### Accessibility Requirements

- WCAG 2.1 AA compliance for government accessibility
- Color contrast ratios meet Quebec standards
- Text scaling support up to 200%
- High contrast mode compatibility

## Responsive Design

### Breakpoints

- **Mobile**: < 768px (single column, overlay menu)
- **Tablet**: 768px - 1024px (adapted layouts)
- **Desktop**: > 1024px (full sidebar navigation)

### Mobile Optimizations

- Collapsible navigation with overlay
- Touch-optimized interactive areas
- Swipe gestures for menu interaction
- Optimized font sizes and spacing

### Desktop Features

- Persistent sidebar navigation
- Hover states and animations
- Keyboard shortcuts support
- Multi-column layouts where appropriate

## Performance Considerations

### Code Splitting

- Lazy load heavy navigation components
- Dynamic imports for admin-only features
- Optimize bundle size for mobile users

### State Management

- Minimal re-renders with React.memo
- Efficient context updates
- Local state for UI-only concerns

### Accessibility Performance

- Debounced search in navigation
- Virtualized long menu lists
- Optimized screen reader announcements

## Testing Strategy

### Unit Tests

- Component rendering with various props
- Role-based navigation visibility
- Mobile menu state management
- Keyboard event handling

### Integration Tests

- Navigation flow between pages
- Mobile menu overlay behavior
- Context provider integration
- Authentication state changes

### Accessibility Tests

- Screen reader compatibility
- Keyboard navigation flows
- Focus management verification
- Color contrast validation

## Development Guidelines

### Adding New Navigation Items

1. Update navigation configuration
2. Add proper role checks
3. Include internationalization keys
4. Test mobile responsive behavior
5. Verify accessibility compliance

### Modifying Layout Structure

1. Consider impact on existing pages
2. Test responsive behavior thoroughly
3. Update documentation and examples
4. Verify Quebec compliance requirements
5. Test with screen readers

### Performance Optimization

1. Use React.memo for expensive renders
2. Implement proper key props for lists
3. Optimize image assets and icons
4. Consider lazy loading for heavy components

## Common Issues and Solutions

### Mobile Menu Not Closing

- Ensure onMobileMenuClose prop is provided
- Check event propagation in menu items
- Verify ESC key event listener setup

### Navigation Context Errors

- Wrap components in proper context providers
- Use safe context access patterns
- Handle missing context gracefully

### Role-Based Access Issues

- Verify user authentication state
- Check role assignment correctness
- Test permission changes in real-time

### Responsive Layout Problems

- Test on actual devices, not just browser resize
- Check viewport meta tag configuration
- Verify CSS media queries are working
