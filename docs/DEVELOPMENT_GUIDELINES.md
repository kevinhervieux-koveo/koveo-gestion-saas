# Koveo Gestion Development Guidelines

## Table of Contents
1. [Code Organization and Structure](#code-organization-and-structure)
2. [Import Patterns and Module Boundaries](#import-patterns-and-module-boundaries)
3. [TypeScript Standards](#typescript-standards)
4. [Error Handling Patterns](#error-handling-patterns)
5. [JSDoc Documentation Standards](#jsdoc-documentation-standards)
6. [Component Architecture](#component-architecture)
7. [Testing Guidelines](#testing-guidelines)
8. [Quebec Law 25 Compliance](#quebec-law-25-compliance)
9. [Performance Best Practices](#performance-best-practices)
10. [Development Workflow](#development-workflow)

## Code Organization and Structure

### Directory Structure
```
client/src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (shadcn/ui)
│   ├── common/         # Shared business components
│   ├── forms/          # Form-specific components
│   └── [domain]/       # Domain-specific components
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries and helpers
├── pages/              # Page-level components
├── types/              # TypeScript type definitions
├── utils/              # Pure utility functions
└── styles/             # CSS and styling files

server/
├── api/                # API route handlers
├── auth/               # Authentication logic
├── controllers/        # Business logic controllers
├── db/                 # Database queries and utilities
├── middleware/         # Express middleware
├── policies/           # Business policies and rules
├── services/           # Business services
├── types/              # Server-side TypeScript types
└── utils/              # Server utility functions

shared/
├── schemas/            # Drizzle schemas organized by domain
├── config/             # Shared configuration
└── data/               # Shared data structures
```

### File Naming Conventions
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useUserProfile.ts`)
- **Utilities**: camelCase (e.g., `stringHelpers.ts`)
- **Types**: PascalCase (e.g., `UserTypes.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)

## Import Patterns and Module Boundaries

### Import Order and Standards
1. **External libraries first** (React, third-party packages)
2. **Internal absolute imports** (using `@/` aliases)
3. **Relative imports** (only for local files in same directory)
4. **Type-only imports** (use `import type`)

```typescript
// ✅ Correct import pattern
import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { User, InsertUser } from '@shared/schema';
import './LocalComponent.css';

// ❌ Incorrect - mixing relative and absolute
import { Button } from '../../components/ui/button';
import { useToast } from '@/hooks/use-toast';
```

### Path Aliases
- `@/` - Points to `client/src/`
- `@shared/` - Points to `shared/`
- `@assets/` - Points to `attached_assets/`

### Module Boundaries
- **Client-only modules**: Never import server code in client
- **Shared modules**: Use `@shared/` for types and schemas
- **API contracts**: Define in shared schemas
- **UI components**: Should not contain business logic

## TypeScript Standards

### Type Definitions
```typescript
// ✅ Prefer interfaces for object shapes
interface UserProfileProps {
  user: User;
  onSave: (user: InsertUser) => Promise<void>;
  isLoading?: boolean;
}

// ✅ Use type aliases for unions and computed types
type UserRole = 'admin' | 'manager' | 'tenant' | 'resident';
type UserWithRole = User & { role: UserRole };

// ✅ Use generic constraints appropriately
interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
}
```

### Type Safety Best Practices
- **Always type function parameters and return values**
- **Use strict TypeScript settings**
- **Avoid `any` - use `unknown` instead**
- **Use type guards for runtime validation**
- **Prefer type-only imports when possible**

```typescript
// ✅ Type guard example
function isUser(value: unknown): value is User {
  return typeof value === 'object' && 
         value !== null && 
         'id' in value && 
         'email' in value;
}

// ✅ Proper error handling with types
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

## Error Handling Patterns

### Client-Side Error Handling
```typescript
// ✅ Standardized error handling hook
export function useApiMutation<T = unknown>(options: {
  mutationFn: () => Promise<T>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: T) => void;
  queryKeysToInvalidate?: string[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (data) => {
      if (options.successMessage) {
        toast({ description: options.successMessage });
      }
      options.onSuccess?.(data);
      options.queryKeysToInvalidate?.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    onError: (error) => {
      // Handle demo restrictions first
      if (handleDemoRestrictionError(error)) return;
      
      toast({
        title: 'Error',
        description: options.errorMessage || 'An error occurred',
        variant: 'destructive'
      });
    }
  });
}
```

### Server-Side Error Handling
```typescript
// ✅ Standardized API error responses
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ✅ Error middleware pattern
export function createApiHandler<T>(
  handler: (req: Request, res: Response) => Promise<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler(req, res);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error); // Let error middleware handle it
    }
  };
}
```

## JSDoc Documentation Standards

### Function Documentation
```typescript
/**
 * Validates and processes a user invitation with proper error handling.
 * Checks token validity, user permissions, and organization constraints.
 * 
 * @param invitationToken - The invitation token to validate
 * @param userRole - The role to assign to the invited user
 * @returns Promise resolving to the validated invitation data
 * @throws {ValidationError} When token is invalid or expired
 * @throws {AuthorizationError} When user lacks permission to create invitation
 * 
 * @example
 * ```typescript
 * try {
 *   const invitation = await validateInvitation(token, 'manager');
 *   console.log('Invitation valid:', invitation.email);
 * } catch (error) {
 *   handleApiError(error);
 * }
 * ```
 */
async function validateInvitation(
  invitationToken: string,
  userRole: UserRole
): Promise<ValidatedInvitation> {
  // Implementation...
}
```

### Component Documentation
```typescript
/**
 * User profile management component with Quebec Law 25 compliance.
 * Handles user data display, editing, and privacy consent management.
 * 
 * @component
 * @param props - Component props
 * @param props.userId - ID of the user to display/edit
 * @param props.isEditable - Whether the profile can be edited
 * @param props.onSave - Callback when profile is saved
 * @param props.onPrivacyUpdate - Callback when privacy settings change
 * 
 * @example
 * ```tsx
 * <UserProfile
 *   userId="123"
 *   isEditable={true}
 *   onSave={(user) => console.log('User saved:', user)}
 *   onPrivacyUpdate={(settings) => logPrivacyChange(settings)}
 * />
 * ```
 */
export function UserProfile({ userId, isEditable, onSave, onPrivacyUpdate }: UserProfileProps) {
  // Implementation...
}
```

## Component Architecture

### Component Design Principles
1. **Single Responsibility**: Each component should have one clear purpose
2. **Composition over Inheritance**: Use composition patterns
3. **Props Interface**: Clear, typed props with defaults
4. **Error Boundaries**: Wrap components with error boundaries
5. **Performance**: Use React.memo, useMemo, useCallback appropriately

### Form Components Pattern
```typescript
// ✅ Standardized form pattern
interface FormProps<T> {
  initialData?: Partial<T>;
  onSubmit: (data: T) => Promise<void>;
  isLoading?: boolean;
  validationSchema: z.ZodSchema<T>;
}

export function StandardForm<T>({ 
  initialData, 
  onSubmit, 
  isLoading, 
  validationSchema 
}: FormProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(validationSchema),
    defaultValues: initialData
  });

  const handleSubmit = async (data: T) => {
    try {
      await onSubmit(data);
      toast({ description: 'Saved successfully' });
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

## Testing Guidelines

### Unit Testing Standards
```typescript
// ✅ Component testing pattern
describe('UserProfile', () => {
  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  };

  it('should display user information correctly', () => {
    render(<UserProfile userId="1" />);
    
    expect(screen.getByTestId('text-user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('text-user-email')).toHaveTextContent('test@example.com');
  });

  it('should handle save operation', async () => {
    const mockSave = jest.fn();
    render(<UserProfile userId="1" onSave={mockSave} isEditable />);
    
    await user.click(screen.getByTestId('button-save'));
    
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Test',
      lastName: 'User'
    }));
  });
});
```

### Test Data Management
- **Use factories for test data**: Create reusable test data builders
- **Mock external dependencies**: Database, APIs, external services
- **Test user interactions**: Use Testing Library patterns
- **Test accessibility**: Include a11y tests

## Quebec Law 25 Compliance

### Data Handling Requirements
```typescript
// ✅ Privacy-compliant data handling
interface UserDataWithConsent {
  user: User;
  privacyConsent: {
    dataCollection: boolean;
    dataProcessing: boolean;
    dataSharing: boolean;
    consentDate: Date;
  };
}

// ✅ Data retention tracking
interface DataRetentionPolicy {
  category: 'personal' | 'business' | 'audit';
  retentionPeriod: number; // in days
  autoDelete: boolean;
  requiresConsent: boolean;
}
```

### Audit Trail Requirements
- **Log all data access**: Who, what, when, why
- **Track consent changes**: Full history of privacy settings
- **Secure data deletion**: Implement right to be forgotten
- **Data export**: Provide user data portability

## Performance Best Practices

### Client-Side Optimization
```typescript
// ✅ Optimized component patterns
const ExpensiveComponent = React.memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map(item => ({ ...item, processed: true }));
  }, [data]);

  const handleUpdate = useCallback((id: string) => {
    onUpdate(id);
  }, [onUpdate]);

  return (
    <div>
      {processedData.map(item => (
        <Item key={item.id} data={item} onUpdate={handleUpdate} />
      ))}
    </div>
  );
});
```

### Query Optimization
- **Use React Query patterns**: Proper caching and invalidation
- **Implement pagination**: For large data sets
- **Batch API calls**: Reduce network requests
- **Optimize database queries**: Use proper indexes and joins

## Development Workflow

### Code Review Checklist
- [ ] All imports follow standardized patterns
- [ ] TypeScript types are properly defined
- [ ] JSDoc comments are comprehensive
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] Quebec Law 25 compliance is maintained
- [ ] Performance considerations are addressed
- [ ] Accessibility requirements are met

### Pre-commit Requirements
1. **Linting**: ESLint rules pass
2. **Type checking**: TypeScript compilation succeeds
3. **Testing**: All tests pass
4. **Formatting**: Prettier formatting applied
5. **Security**: No sensitive data committed

### Git Commit Conventions
```
feat: add user profile management with Law 25 compliance
fix: resolve TypeScript error in error handling middleware
docs: update development guidelines for component architecture
refactor: standardize import patterns across auth components
test: add comprehensive tests for user invitation flow
```

## Troubleshooting Common Issues

### TypeScript Errors
- **Check import paths**: Ensure correct alias usage
- **Verify type definitions**: Ensure all types are properly exported
- **Update dependencies**: Check for version compatibility

### Performance Issues
- **Check React DevTools**: Identify unnecessary re-renders
- **Analyze bundle size**: Use webpack-bundle-analyzer
- **Profile database queries**: Check query execution times

### Build Issues
- **Clear cache**: Delete node_modules and reinstall
- **Check dependencies**: Ensure all required packages are installed
- **Verify configuration**: Check vite.config.ts and tsconfig.json

---

*This document is maintained by the Koveo Gestion development team and should be updated as patterns evolve.*