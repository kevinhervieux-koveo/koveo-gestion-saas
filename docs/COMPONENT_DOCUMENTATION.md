# Koveo Gestion Component Documentation

This comprehensive guide documents all 73 React components in the Koveo Gestion application, providing detailed descriptions, TypeScript interfaces, usage examples, and implementation patterns.

## Table of Contents

- [Layout Components](#layout-components)
- [Form Components](#form-components)
- [UI Components](#ui-components)
- [Admin Components](#admin-components)
- [Dashboard Components](#dashboard-components)
- [Authentication Components](#authentication-components)
- [Specialized Components](#specialized-components)
- [Component Integration Patterns](#component-integration-patterns)
- [Testing Strategy](#testing-strategy)
- [Accessibility Standards](#accessibility-standards)

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

**Complete Implementation Example**:
```typescript
// App.tsx - Main application setup
import { AppLayout } from '@/components/layout/AppLayout';
import { BrowserRouter } from 'wouter';

function App() {
  return (
    <AppLayout>
      <BrowserRouter>
        <Routes />
      </BrowserRouter>
    </AppLayout>
  );
}

// Routes.tsx - Route configuration
import { Route, Switch } from 'wouter';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { LoginPage } from '@/pages/auth/LoginPage';

export function Routes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/" component={DashboardPage} />
    </Switch>
  );
}

// Protected route example
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
```

**Advanced Usage with Context**:
```typescript
// Custom layout for specific sections
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div className="flex h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </AppLayout>
  );
}

// Page implementation with layout
export function AdminUsersPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">User Management</h1>
        <UsersTable />
      </div>
    </AdminLayout>
  );
}
```

### Sidebar (`client/src/components/layout/sidebar.tsx`)
**Purpose**: Navigation sidebar with role-based menu items

**Key Features**:
- **Role-Based Navigation**: Customized menu items based on user permissions
- **Organization-Aware Filtering**: Context-sensitive menu options
- **Collapsible Sections**: Space-efficient navigation with expandable categories
- **Active Route Highlighting**: Visual indication of current page location
- **Quebec Compliance**: Bilingual menu labels and accessibility standards

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

This section documents all form components located in `client/src/components/forms/`. These components handle user input, validation, and data submission throughout the application.

### Key Form Features
- **Zod Validation**: Type-safe runtime validation for all form inputs
- **React Hook Form**: Performant form state management with minimal re-renders
- **Quebec Compliance**: Bilingual error messages and Canadian address formats
- **Accessibility**: WCAG 2.1 AA compliant form controls and error handling

### OrganizationForm (`client/src/components/forms/organization-form.tsx`)
**Purpose**: Comprehensive organization creation and management form optimized for Quebec property management companies

**Props Interface**:
```typescript
interface OrganizationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Core Features**:
- **Quebec Address Validation**: Automatic postal code format validation (H0H 0H0 pattern)
- **Organization Types**: Support for Normal, Demo, and Koveo organization classifications
- **Canadian Standards**: Province defaults to Quebec (QC) with full Canadian address support
- **Contact Management**: Phone, email, and website validation with optional fields
- **Registration Tracking**: Support for Quebec business registration numbers

**Advanced Validation Schema**:
```typescript
const formSchema = insertOrganizationSchema.extend({
  name: z.string().min(1, "Organization name is required").max(200),
  type: z.string().min(1, "Organization type must be selected"),
  address: z.string().min(1, "Address is required").max(300),
  city: z.string().min(1, "City is required").max(100),
  province: z.string().default('QC'), // Defaults to Quebec
  postalCode: z.string()
    .regex(/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, 'Invalid Canadian postal code format (e.g., H1A 1A1)'),
  phone: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal('')),
  website: z.string().url("Invalid website URL").optional().or(z.literal(''))
});
```

**User Experience Enhancements**:
- Real-time validation feedback with bilingual error messages
- Auto-formatting for postal codes and phone numbers
- Smart defaults for Quebec-based organizations
- Accessibility-compliant form controls with proper labeling

### FeatureForm (`client/src/components/forms/feature-form.tsx`)
**Purpose**: Feature creation and management form for roadmap system

**Features**:
- Feature title and description
- Priority and status selection
- Category assignment
- Release date planning
- Roadmap visibility toggle
- Quebec compliance considerations

**Form Fields**:
- Title (required, max 200 characters)
- Description (optional, detailed explanation)
- Category (feature, enhancement, bug_fix, maintenance)
- Priority (low, medium, high, critical)
- Status (planning, in_progress, completed, cancelled)
- Target release date
- Roadmap visibility
- Quebec compliance flag

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

### OrganizationsCard (`client/src/components/admin/organizations-card.tsx`)
**Purpose**: Organization management interface with full CRUD operations

**Props**:
```typescript
interface OrganizationsCardProps {
  className?: string;
}
```

**Features**:
- Organization listing with cards display
- Create, edit, view, and delete operations
- Organization type badges (Normal, Demo, Koveo)
- Contact information display (phone, email, website)
- Quebec-specific address handling
- Confirmation dialogs for destructive actions

**Usage**:
```typescript
<OrganizationsCard className="w-full" />
```

### SendInvitationDialog (`client/src/components/admin/send-invitation-dialog.tsx`)
**Purpose**: User invitation system with single and bulk invitation support

**Features**:
- Single user invitation with role assignment
- Bulk invitation processing (up to 20 users)
- Organization and residence assignment
- Role-based validation (tenant/resident require residence)
- Personal message customization
- Expiry date configuration (1-30 days)
- 2FA requirement toggle
- Quebec compliance considerations

**Validation Schema**:
```typescript
const invitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'tenant', 'resident']),
  organizationId: z.string().min(1),
  buildingId: z.string().optional(),
  residenceId: z.string().optional(),
  personalMessage: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(7),
  requires2FA: z.boolean().default(false)
});
```

### UserList (`client/src/components/admin/user-list.tsx`)
**Purpose**: User management interface with table display and bulk operations

**Props**:
```typescript
interface UserListComponentProps {
  users: User[];
  selectedUsers: Set<string>;
  onSelectionChange: (selection: Set<string>) => void;
  onBulkAction: (action: string, data?: any) => Promise<void>;
  isLoading?: boolean;
}
```

**Features**:
- Tabular user display with avatars
- Multi-select functionality with checkboxes
- Individual user actions (edit, activate/deactivate, delete)
- Role and status management
- User search and filtering
- Responsive table design

### InvitationManagement (`client/src/components/admin/invitation-management.tsx`)
**Purpose**: Invitation tracking and management interface

**Props**:
```typescript
interface InvitationManagementProps {
  invitations: Invitation[];
  onSendReminder: (invitationId: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}
```

**Features**:
- Invitation status tracking (pending, accepted, expired, cancelled)
- Reminder sending functionality
- Invitation link copying
- Cancellation and reactivation
- Expiry date monitoring
- Security level indicators

**Invitation Status Types**:
- `pending`: Awaiting user acceptance
- `accepted`: Successfully registered
- `expired`: Past expiration date
- `cancelled`: Manually cancelled

### BulkActionsBar (`client/src/components/admin/bulk-actions-bar.tsx`)
**Purpose**: Bulk operations interface for selected items

**Props**:
```typescript
interface BulkActionsBarProps {
  selectedCount: number;
  onBulkAction: (action: string, data?: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}
```

**Available Actions**:
- User activation/deactivation
- Role changes (with confirmation)
- Password reset email sending
- Welcome email sending
- User deletion (with confirmation)
- Data export functionality

**Action Types**:
```typescript
type BulkActionType =
  | 'activate'
  | 'deactivate'
  | 'change_role'
  | 'send_password_reset'
  | 'delete'
  | 'export'
  | 'send_welcome_email';
```

## Dashboard Components

### WorkspaceStatus (`client/src/components/dashboard/workspace-status.tsx`)
**Purpose**: Real-time workspace monitoring and health display

**Features**:
- Component health status tracking
- Performance metrics visualization
- Error detection and reporting
- Pillar methodology integration
- Real-time status updates

**Status Indicators**:
- Green: All systems operational
- Yellow: Minor issues detected
- Red: Critical problems requiring attention
- Gray: Component offline or initializing

### QualityMetrics (`client/src/components/dashboard/quality-metrics.tsx`)
**Purpose**: Code quality and system metrics dashboard

**Metrics Displayed**:
- Code coverage percentages
- Testing pass/fail rates
- Performance benchmarks
- Security audit results
- Documentation completeness
- Quebec compliance scores

**Features**:
- Interactive charts and graphs
- Historical trend analysis
- Drill-down capabilities
- Export functionality
- Automated threshold alerts

### PillarFramework (`client/src/components/dashboard/pillar-framework.tsx`)
**Purpose**: Pillar methodology status and management interface

**Framework Components**:
- Quality assurance pillar
- Testing pillar
- Security pillar
- Performance pillar
- Documentation pillar
- Quebec compliance pillar

**Features**:
- Pillar health monitoring
- Configuration management
- Status reporting
- Progress tracking
- Framework validation

### DevelopmentConsole (`client/src/components/dashboard/development-console.tsx`)
**Purpose**: Developer tools and debugging interface

**Console Features**:
- Real-time log viewing
- Command execution
- System diagnostics
- Performance profiling
- Error analysis
- Database monitoring

**Tools Available**:
- SQL query executor
- Cache management
- Session monitoring
- API testing
- Component inspector

### InitializationWizard (`client/src/components/dashboard/initialization-wizard.tsx`)
**Purpose**: System setup and configuration wizard

**Wizard Steps**:
1. Database connection verification
2. Environment variable validation
3. Service health checks
4. Pillar framework initialization
5. Quebec compliance setup
6. User role configuration

**Features**:
- Step-by-step guidance
- Automated validation
- Error resolution assistance
- Configuration backup
- Progress persistence

### ReplitAiMonitoring (`client/src/components/dashboard/replit-ai-monitoring.tsx`)
**Purpose**: AI system monitoring and performance tracking

**Monitoring Capabilities**:
- AI model performance metrics
- Request/response tracking
- Error rate monitoring
- Usage analytics
- Cost tracking
- Performance optimization

**AI Metrics**:
- Response time analysis
- Accuracy measurements
- Token usage statistics
- Model health status
- Integration performance

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

## Authentication Components

### Registration Wizard Steps

#### TokenValidationStep (`client/src/components/auth/steps/token-validation-step.tsx`)
**Purpose**: Validates invitation tokens during user registration

**Props**:
```typescript
interface WizardStepProps {
  data: any;
  onDataChange: (data: any) => void;
  onValidationChange: (isValid: boolean) => void;
}
```

**Features**:
- Automatic token validation from URL parameters
- Invitation details display (role, organization, inviter)
- Expiry date validation
- Error handling for invalid/expired tokens
- Security verification

**Token Validation Data**:
```typescript
interface TokenValidationData {
  token: string;
  email: string;
  role: string;
  organizationName: string;
  inviterName: string;
  expiresAt: string;
  isValid: boolean;
  error?: string;
}
```

#### ProfileCompletionStep (`client/src/components/auth/steps/profile-completion-step.tsx`)
**Purpose**: Collects user profile information for Quebec property management

**Features**:
- Personal information collection (name, phone, address)
- Quebec-specific address validation
- Bilingual language selection (French/English)
- Phone number validation (Canadian format)
- Date of birth collection
- Privacy compliance notifications (Law 25)

**Profile Data Structure**:
```typescript
interface ProfileCompletionData {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  province: string; // Defaults to 'QC'
  postalCode: string;
  language: string; // 'fr' or 'en'
  dateOfBirth: string;
  isValid: boolean;
}
```

#### PasswordCreationStep (`client/src/components/auth/steps/password-creation-step.tsx`)
**Purpose**: Secure password creation with Quebec compliance standards

**Features**:
- Password strength validation
- Password confirmation matching
- Real-time strength indicator
- Quebec Law 25 compliance messaging
- Security best practices display
- Toggle password visibility

**Security Standards**:
- Minimum 8 characters
- Mixed case letters required
- Numbers and special characters
- No common passwords
- Quebec data protection compliance

### PasswordStrengthIndicator (`client/src/components/auth/password-strength-indicator.tsx`)
**Purpose**: Visual password strength feedback component

**Features**:
- Real-time strength calculation
- Color-coded strength levels (weak, medium, strong)
- Specific improvement suggestions
- Quebec security standard compliance
- Animated progress display

## Utility Components

### UI Component Library (`client/src/components/ui/`)
Complete Shadcn/ui component library including:

#### Core UI Components
- **Button** (`button.tsx`): Customizable buttons with variants
- **Card** (`card.tsx`): Container components for content sections
- **Dialog** (`dialog.tsx`): Modal dialogs for forms and confirmations
- **Form** (`form.tsx`): Form wrapper with validation display
- **Input** (`input.tsx`): Text input with validation styling
- **Select** (`select.tsx`): Dropdown selection component
- **Table** (`table.tsx`): Data table with sorting and filtering
- **Textarea** (`textarea.tsx`): Multi-line text input
- **Checkbox** (`checkbox.tsx`): Boolean selection component
- **Radio Group** (`radio-group.tsx`): Single selection from multiple options

#### Advanced UI Components
- **Avatar** (`avatar.tsx`): User profile images with fallbacks
- **Badge** (`badge.tsx`): Status and category indicators
- **Breadcrumb** (`breadcrumb.tsx`): Navigation path display
- **Calendar** (`calendar.tsx`): Date picker and calendar display
- **Carousel** (`carousel.tsx`): Image and content sliders
- **Drawer** (`drawer.tsx`): Slide-out navigation panels
- **Popover** (`popover.tsx`): Contextual information display
- **Resizable** (`resizable.tsx`): Adjustable panel layouts
- **Separator** (`separator.tsx`): Visual content dividers
- **Skeleton** (`skeleton.tsx`): Loading state placeholders
- **Slider** (`slider.tsx`): Range selection component
- **Toast** (`toast.tsx`): Notification messages
- **Toggle** (`toggle.tsx`): Binary state switching

### Usage Pattern for UI Components
All UI components follow consistent patterns:

```typescript
// Import pattern
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Usage with proper TypeScript support
<Button variant="default" size="medium" onClick={handleClick}>
  Action
</Button>

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

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

## Additional Components

### Layout and Navigation Components

#### ErrorBoundary (`client/src/components/ErrorBoundary.tsx`)
**Purpose**: Application-wide error handling and graceful degradation

**Features**:
- Catches JavaScript errors in component tree
- Displays user-friendly error messages
- Development vs production error display
- Error reporting to logging services
- Fallback UI for broken components

#### ProtectedRoute (`client/src/components/ProtectedRoute.tsx`)
**Purpose**: Route-level access control with RBAC integration

**Props**:
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'tenant' | 'resident';
  requiredPermission?: string;
  organizationContext?: boolean;
}
```

**Features**:
- Role-based route protection
- Permission-level access control
- Organization context validation
- Automatic redirect to login
- Loading states during auth checks

#### LanguageProvider (`client/src/components/LanguageProvider.tsx`)
**Purpose**: Quebec bilingual support system

**Features**:
- French/English language switching
- Context-aware translations
- User preference persistence
- Quebec Law 25 compliance messaging
- Dynamic text loading

**Language Context**:
```typescript
interface LanguageContextType {
  language: 'fr' | 'en';
  setLanguage: (lang: 'fr' | 'en') => void;
  t: (key: string, params?: Record<string, string>) => string;
}
```

### Specialized Components

#### LoadingSpinner (`client/src/components/ui/loading-spinner.tsx`)
**Purpose**: Consistent loading state indicators

**Variants**:
- Size: small (16px), medium (24px), large (32px)
- Type: spinner, dots, pulse, skeleton
- Theme: light, dark, primary, secondary

**Usage**:
```typescript
<LoadingSpinner size="medium" variant="spinner" />
```

#### DataTable (`client/src/components/ui/data-table.tsx`)
**Purpose**: Advanced data display with sorting, filtering, and pagination

**Features**:
- Column sorting (ascending/descending)
- Global and column-specific filtering
- Pagination with customizable page sizes
- Row selection (single/multiple)
- Export functionality (CSV, PDF)
- Responsive design
- Virtual scrolling for large datasets

**Table Configuration**:
```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  pagination?: boolean;
  sorting?: boolean;
  filtering?: boolean;
  selection?: 'single' | 'multiple' | 'none';
  onSelectionChange?: (selection: T[]) => void;
}
```

### Hook Components and Utilities

#### useToast Hook Integration
All components use consistent toast notifications:

```typescript
import { useToast } from '@/hooks/use-toast';

const { toast } = useToast();

// Success notification
toast({
  title: "Success",
  description: "Operation completed successfully",
});

// Error notification
toast({
  title: "Error",
  description: "Operation failed",
  variant: "destructive",
});
```

#### useLanguage Hook Integration
Bilingual support across all components:

```typescript
import { useLanguage } from '@/hooks/use-language';

const { t, language } = useLanguage();

// Translated text
<h1>{t('welcome_message')}</h1>

// Conditional language content
{language === 'fr' ? 'Français' : 'English'}
```

## Performance Considerations

Components implement:
1. **React.memo** for expensive renders and pure components
2. **Lazy loading** for route components and heavy modals
3. **Debounced inputs** for search and filter components
4. **Virtual scrolling** for large data lists (500+ items)
5. **Image optimization** with lazy loading and caching
6. **Code splitting** at route and feature levels
7. **Memoized calculations** for complex computations
8. **Optimistic updates** for better user experience

## Testing Strategy

### Component Testing Approach
Each component category follows specific testing patterns:

#### Form Components
- Input validation testing
- Error state handling
- Submit behavior verification
- Accessibility compliance

#### Admin Components
- Permission-based rendering
- Bulk action functionality
- Data manipulation verification
- Error boundary testing

#### UI Components
- Visual regression testing
- Interaction behavior
- Responsive design validation
- Theme switching compatibility

#### Authentication Components
- Security flow validation
- Token handling verification
- Error state testing
- Quebec compliance checks

### Test Utilities
```typescript
// Component testing helper
import { renderWithProviders } from '@/test-utils';

// Render component with all necessary providers
const { getByRole, getByText } = renderWithProviders(
  <YourComponent />,
  {
    authUser: mockUser,
    language: 'fr',
    organization: mockOrg
  }
);
```

## Accessibility Standards

All components maintain WCAG 2.1 AA compliance:

1. **Keyboard Navigation**: Full tab support and focus management
2. **Screen Reader Support**: Proper ARIA labels and descriptions
3. **Color Contrast**: Minimum 4.5:1 ratio for text
4. **Focus Indicators**: Visible focus states for all interactive elements
5. **Alternative Text**: Images and icons with descriptive alt text
6. **Form Labels**: Proper association between labels and inputs
7. **Error Announcements**: Screen reader accessible error messages

### Quebec Accessibility Requirements
- **Bilingual Support**: All content available in French and English
- **Cultural Considerations**: Quebec-specific terminology and formats
- **Legal Compliance**: AODA and Quebec accessibility legislation adherence

## Specialized Components

### Layout Components

#### Header (`client/src/components/layout/header.tsx`)
**Purpose**: Main application header with navigation and user controls

**Features**:
- User profile dropdown
- Organization context display
- Navigation breadcrumbs
- Notification indicators
- Language switcher
- Logout functionality

**Responsive Design**:
- Mobile hamburger menu
- Collapsible navigation
- Touch-friendly controls
- Accessible keyboard navigation

#### Sidebar (`client/src/components/layout/sidebar.tsx`)
**Purpose**: Application sidebar navigation with role-based menus

**Navigation Structure**:
- **Admin**: Full system access
  - User management
  - Organization settings
  - System configuration
  - Analytics dashboard
- **Manager**: Organization management
  - Building oversight
  - Financial reports
  - Maintenance coordination
- **Tenant**: Property management
  - Residence details
  - Maintenance requests
  - Bill management
- **Resident**: Basic access
  - Personal information
  - Service requests
  - Community notices

**Features**:
- Collapsible sections
- Active route highlighting
- Role-based visibility
- Quick action buttons
- Search functionality

### Utility and Specialized Components

#### FilterSort (`client/src/components/filter-sort/FilterSort.tsx`)
**Purpose**: Advanced filtering and sorting interface for data tables

**Filter Types**:
- Text search with debouncing
- Date range selection
- Category filtering
- Status filtering
- Custom field filters

**Sort Options**:
- Multiple column sorting
- Ascending/descending toggle
- Custom sort functions
- Persistent sort preferences

#### ActionableItemsPanel (`client/src/components/roadmap/actionable-items-panel.tsx`)
**Purpose**: Project management and task tracking interface

**Features**:
- Task creation and editing
- Status tracking (planning, in-progress, completed)
- Priority assignment
- Due date management
- Assignment to team members
- Progress visualization

**Item Types**:
- Feature development
- Bug fixes
- Enhancement requests
- Maintenance tasks
- Documentation updates

#### SslCertificateInfo (`client/src/components/ssl/SslCertificateInfo.tsx`)
**Purpose**: SSL certificate status and management display

**Information Displayed**:
- Certificate validity period
- Issuer information
- Domain coverage
- Renewal status
- Security level indicators

**Features**:
- Automatic renewal monitoring
- Expiry warnings
- Certificate chain validation
- Security recommendations

## Component Integration Patterns

### State Management Integration
Components integrate with multiple state management systems:

```typescript
// TanStack Query for server state
const { data, isLoading, error } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => fetchUsers(filters)
});

// React Hook Form for form state
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: initialData
});

// React Context for global state
const { user, permissions } = useAuth();
const { language, t } = useLanguage();
```

### Error Handling Patterns
Consistent error handling across all components:

```typescript
// Component-level error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <SomeComponent />
</ErrorBoundary>

// Hook-based error handling
const { mutate, error, isPending } = useMutation({
  mutationFn: updateUser,
  onError: (error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive'
    });
  }
});
```

### Loading State Patterns
Standardized loading states across the application:

```typescript
// Skeleton loading for content
{isLoading ? (
  <Skeleton className="h-4 w-full" />
) : (
  <div>{content}</div>
)}

// Spinner loading for actions
<Button disabled={isPending}>
  {isPending && <LoadingSpinner size="small" />}
  Save Changes
</Button>
```

## Component Documentation Standards

### JSDoc Comments
All public components include comprehensive JSDoc:

```typescript
/**
 * User management interface with bulk operations support.
 *
 * @component
 * @param {User[]} users - Array of user objects to display
 * @param {Set<string>} selectedUsers - Set of selected user IDs
 * @param {Function} onSelectionChange - Callback for selection changes
 * @param {Function} onBulkAction - Callback for bulk operations
 * @param {boolean} [isLoading=false] - Loading state indicator
 *
 * @example
 * ```tsx
 * <UserList
 *   users={users}
 *   selectedUsers={selection}
 *   onSelectionChange={setSelection}
 *   onBulkAction={handleBulkAction}
 *   isLoading={isProcessing}
 * />
 * ```
 */
```

### TypeScript Interface Documentation
Comprehensive type definitions with descriptions:

```typescript
interface UserListProps {
  /** Array of user objects to display in the table */
  users: User[];
  /** Set of currently selected user IDs */
  selectedUsers: Set<string>;
  /** Callback function called when user selection changes */
  onSelectionChange: (selection: Set<string>) => void;
  /** Callback function for handling bulk operations */
  onBulkAction: (action: string, data?: any) => Promise<void>;
  /** Optional loading state indicator */
  isLoading?: boolean;
}
```

