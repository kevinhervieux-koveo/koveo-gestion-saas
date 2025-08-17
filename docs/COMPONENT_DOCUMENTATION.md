# Koveo Gestion Component Documentation

## Table of Contents

- [Layout Components](#layout-components)
- [Form Components](#form-components)
- [UI Components](#ui-components)
- [Admin Components](#admin-components)
- [Dashboard Components](#dashboard-components)
- [Page Components](#page-components)
- [Utility Components](#utility-components)

## Layout Components

### AppLayout (`client/src/components/layout/AppLayout.tsx`)
**Purpose**: Main application layout wrapper with authentication and routing

**Props**:
```typescript
interface AppLayoutProps {
  children: React.ReactNode;
}
```

**Features**:
- Session management and authentication checks
- Language provider setup (French/English)
- Query client configuration for TanStack Query
- Global toast notifications setup

**Usage**:
```typescript
<AppLayout>
  <YourPageContent />
</AppLayout>
```

### Sidebar (`client/src/components/layout/sidebar.tsx`)
**Purpose**: Navigation sidebar with role-based menu items

**Features**:
- Role-based navigation (Admin, Manager, Tenant, Resident)
- Organization-aware menu filtering
- Collapsible menu sections
- Active route highlighting

**Navigation Structure**:
- **Admin**: Full access to all features
- **Manager**: Organization and building management
- **Tenant**: Residence and maintenance focus
- **Resident**: Basic tenant features

### Header (`client/src/components/layout/Header.tsx`)
**Purpose**: Top navigation bar with user info and actions

**Features**:
- User profile display
- Logout functionality
- Organization context display
- Language switching (if enabled)

## Form Components

### All form components are located in `client/src/components/forms/`

### LoginForm (`client/src/components/forms/LoginForm.tsx`)
**Purpose**: User authentication form

**Validation**:
```typescript
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});
```

**Features**:
- Form validation with Zod
- Error handling and display
- Loading states during authentication

### UserForm (`client/src/components/forms/UserForm.tsx`)
**Purpose**: Create and edit user accounts

**Props**:
```typescript
interface UserFormProps {
  user?: User;
  onSuccess: () => void;
  organizationId?: string;
}
```

**Validation Schema**:
```typescript
const userSchema = insertUserSchema.extend({
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});
```

### OrganizationForm (`client/src/components/forms/OrganizationForm.tsx`)
**Purpose**: Create and manage organizations

**Features**:
- Organization type selection (Normal, Demo, Koveo)
- Contact information management
- Address and location details

### BuildingForm (`client/src/components/forms/BuildingForm.tsx`)
**Purpose**: Building creation and management

**Validation**:
```typescript
const buildingSchema = insertBuildingSchema.extend({
  totalUnits: z.number().min(1, "Must have at least 1 unit")
});
```

### ResidenceForm (`client/src/components/forms/ResidenceForm.tsx`)
**Purpose**: Individual residence unit management

**Features**:
- Unit number and floor assignment
- Square footage and room count
- Building association

### MaintenanceRequestForm (`client/src/components/forms/MaintenanceRequestForm.tsx`)
**Purpose**: Submit and manage maintenance requests

**Categories**:
- Plumbing
- Electrical
- HVAC
- Structural
- Other

**Priority Levels**:
- Low, Medium, High, Urgent

### BillForm (`client/src/components/forms/BillForm.tsx`)
**Purpose**: Financial billing management

**Bill Types**:
- Condo Fees
- Special Assessment
- Utility Bills
- Other Charges

### DocumentUploadForm (`client/src/components/forms/DocumentUploadForm.tsx`)
**Purpose**: Document upload and categorization

**Features**:
- File upload with validation
- Category assignment
- Access control (public/private)
- Organization/building/residence association

### InvitationForm (`client/src/components/forms/InvitationForm.tsx`)
**Purpose**: User invitation system

**Features**:
- Role-based invitations
- Organization and residence assignment
- Email validation
- Audit logging

## UI Components

### All UI components follow Shadcn/ui patterns in `client/src/components/ui/`

### Button (`client/src/components/ui/button.tsx`)
**Purpose**: Standardized button component with variants

**Variants**:
- `default`: Primary action button
- `destructive`: Delete/remove actions
- `outline`: Secondary actions
- `secondary`: Alternative styling
- `ghost`: Minimal styling
- `link`: Link-style button

### Card (`client/src/components/ui/card.tsx`)
**Purpose**: Content container with consistent styling

**Components**:
- `Card`: Main container
- `CardHeader`: Title and description area
- `CardContent`: Main content area
- `CardFooter`: Action area

### DataTable (`client/src/components/ui/data-table.tsx`)
**Purpose**: Sortable, filterable data display

**Features**:
- Column sorting
- Row selection
- Pagination
- Global search
- Custom column renderers

### Dialog (`client/src/components/ui/dialog.tsx`)
**Purpose**: Modal dialogs for forms and confirmations

**Components**:
- `Dialog`: Root component
- `DialogTrigger`: Opens dialog
- `DialogContent`: Modal content
- `DialogHeader`: Title area
- `DialogFooter`: Action buttons

### Form (`client/src/components/ui/form.tsx`)
**Purpose**: Form wrapper with validation display

**Features**:
- React Hook Form integration
- Zod validation support
- Error message display
- Field-level validation

### Badge (`client/src/components/ui/badge.tsx`)
**Purpose**: Status indicators and labels

**Variants**:
- `default`: Standard badge
- `secondary`: Muted styling
- `destructive`: Error states
- `outline`: Outlined badge

## Admin Components

### UserManagement (`client/src/components/admin/UserManagement.tsx`)
**Purpose**: Complete user administration interface

**Features**:
- User listing with search and filtering
- Role management
- Account activation/deactivation
- Bulk operations

### OrganizationManagement (`client/src/components/admin/OrganizationManagement.tsx`)
**Purpose**: Organization oversight for admin users

**Features**:
- Organization creation and editing
- Type management (Normal, Demo, Koveo)
- Statistics and metrics display

### SystemSettings (`client/src/components/admin/SystemSettings.tsx`)
**Purpose**: Platform-wide configuration management

**Settings Categories**:
- Authentication settings
- Email configuration
- Feature flags
- Maintenance mode

### PermissionsManager (`client/src/components/admin/PermissionsManager.tsx`)
**Purpose**: Role-based access control management

**Features**:
- Role definition and editing
- Permission assignment
- Access level configuration
- Organization-specific overrides

## Dashboard Components

### DashboardCard (`client/src/components/dashboard/DashboardCard.tsx`)
**Purpose**: Metric display card for dashboards

**Props**:
```typescript
interface DashboardCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}
```

### StatisticsOverview (`client/src/components/dashboard/StatisticsOverview.tsx`)
**Purpose**: High-level metrics display

**Metrics**:
- User counts by role
- Active maintenance requests
- Outstanding bills
- Recent activity

### ActivityFeed (`client/src/components/dashboard/ActivityFeed.tsx`)
**Purpose**: Recent system activity display

**Activity Types**:
- User registrations
- Maintenance requests
- Bill payments
- Document uploads

### NotificationCenter (`client/src/components/dashboard/NotificationCenter.tsx`)
**Purpose**: User notification management

**Features**:
- Real-time notifications
- Mark as read functionality
- Notification filtering
- Bulk actions

## Page Components

Page components are located in `client/src/pages/` and represent full page views.

### AdminDashboard (`client/src/pages/admin/dashboard.tsx`)
**Purpose**: Main admin overview page

**Features**:
- System-wide statistics
- User activity monitoring
- Organization metrics
- Quick action links

### UserPermissions (`client/src/pages/admin/permissions.tsx`)
**Purpose**: User permission management interface

**Features**:
- User search and selection
- Role assignment
- Permission level adjustment
- Audit trail viewing

### Roadmap (`client/src/pages/admin/roadmap.tsx`)
**Purpose**: Platform development roadmap display

**Features**:
- Feature status tracking
- Release planning
- User feedback integration
- Progress visualization

### BuildingDashboard (`client/src/pages/buildings/dashboard.tsx`)
**Purpose**: Building-specific management interface

**Features**:
- Building statistics
- Residence overview
- Maintenance tracking
- Financial summaries

### ResidenceDashboard (`client/src/pages/residences/dashboard.tsx`)
**Purpose**: Individual residence management

**Features**:
- Unit details
- Resident information
- Maintenance history
- Billing records

## Utility Components

### LoadingSpinner (`client/src/components/ui/loading-spinner.tsx`)
**Purpose**: Loading state indicator

**Variants**:
- Small, medium, large sizes
- Different animation styles
- Custom color options

### ErrorBoundary (`client/src/components/ErrorBoundary.tsx`)
**Purpose**: Error handling and display

**Features**:
- Graceful error recovery
- Error reporting
- Fallback UI display
- Development vs production behavior

### ProtectedRoute (`client/src/components/ProtectedRoute.tsx`)
**Purpose**: Route access control

**Props**:
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
}
```

### LanguageProvider (`client/src/components/LanguageProvider.tsx`)
**Purpose**: Internationalization support

**Features**:
- French/English language switching
- Dynamic text loading
- Quebec compliance support
- User preference persistence

## Component Architecture Patterns

### Form Pattern
All forms follow a consistent pattern:
1. Zod schema for validation
2. React Hook Form for form management
3. Shadcn/ui form components
4. TanStack Query for mutations
5. Toast notifications for feedback

### Data Fetching Pattern
Data components use:
1. TanStack Query for server state
2. Loading and error states
3. Optimistic updates where appropriate
4. Cache invalidation on mutations

### Permission Pattern
Protected components check:
1. User authentication status
2. Required role permissions
3. Organization context
4. Resource ownership

### Styling Pattern
All components use:
1. Tailwind CSS for styling
2. CSS variables for theming
3. Responsive design patterns
4. Dark mode support (where implemented)

## Testing Guidelines

Each component should have:
1. Unit tests for logic
2. Integration tests for user flows
3. Accessibility tests
4. Visual regression tests (where applicable)

## Performance Considerations

Components implement:
1. React.memo for expensive renders
2. Lazy loading for route components
3. Debounced search inputs
4. Virtual scrolling for large lists
5. Image optimization and caching