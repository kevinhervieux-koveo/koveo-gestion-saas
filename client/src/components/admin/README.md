# Admin Components

## Overview

This directory contains components specifically designed for administrators with full system access. These components handle user management, organizational oversight, and system-wide administrative functions with comprehensive RBAC integration.

## Components

### UserListComponent (`user-list.tsx`)
**Purpose**: Comprehensive user management with bulk operations and role assignments

**Key Features**:
- Bulk user selection and actions (activate, deactivate, delete)
- Inline user editing with role and organization changes
- Password reset email functionality
- Real-time status updates and activity tracking
- Advanced filtering and search capabilities
- Responsive table design with mobile support

**Props**:
```typescript
interface UserListComponentProps {
  users: User[];                               // Array of user objects
  selectedUsers: Set<string>;                  // Set of selected user IDs
  onSelectionChange: (users: Set<string>) => void;  // Selection change handler
  onBulkAction: (action: string, userIds: string[]) => void;  // Bulk action handler
  isLoading?: boolean;                         // Loading state indicator
}
```

**Usage**:
```typescript
import { UserListComponent } from '@/components/admin/user-list';

<UserListComponent
  users={userList}
  selectedUsers={selectedUserIds}
  onSelectionChange={handleSelection}
  onBulkAction={handleBulkAction}
  isLoading={isLoadingUsers}
/>
```

### InvitationManagement (`invitation-management.tsx`)
**Purpose**: Complete user invitation lifecycle management

**Key Features**:
- Invitation status tracking (pending, expired, accepted, cancelled)
- Resend invitation functionality with rate limiting
- Invitation link generation and sharing
- Bulk invitation actions
- Expiration date management and automatic cleanup
- Organization-scoped invitation controls

**Props**:
```typescript
interface InvitationManagementProps {
  invitations: Invitation[];                   // Array of invitation objects
  onSendReminder: (invitationId: string) => void;  // Reminder send handler
  onRefresh: () => void;                       // Data refresh handler
  isLoading?: boolean;                         // Loading state indicator
}
```

**Status Management**:
- **Pending**: Invitation sent, awaiting user response
- **Expired**: Invitation exceeded expiration date
- **Accepted**: User successfully registered via invitation
- **Cancelled**: Invitation cancelled by administrator
- **Failed**: Invitation delivery failed (email bounce, etc.)

## Administrative Patterns

### Role-Based Access Control
All admin components enforce strict RBAC:

```typescript
const { user, hasRole, hasPermission } = useAuth();

// Role verification
if (!hasRole('admin')) {
  return <AccessDenied />;
}

// Permission-specific checks
if (!hasPermission('manage:users')) {
  return <InsufficientPermissions />;
}
```

### Bulk Operations
Standardized bulk action pattern:

```typescript
const handleBulkAction = async (action: string, userIds: string[]) => {
  try {
    setIsProcessing(true);
    
    switch (action) {
      case 'activate':
        await bulkActivateUsers(userIds);
        break;
      case 'deactivate':
        await bulkDeactivateUsers(userIds);
        break;
      case 'delete':
        await bulkDeleteUsers(userIds);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Refresh data and clear selection
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    setSelectedUsers(new Set());
    
    toast({
      title: 'Success',
      description: `${action} completed for ${userIds.length} users`,
    });
  } catch (error) {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setIsProcessing(false);
  }
};
```

### Data Mutations
Consistent mutation handling with optimistic updates:

```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await apiRequest('PUT', `/api/users/${userId}`, data);
    return response.json();
  },
  onSuccess: () => {
    // Invalidate related queries
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    
    toast({
      title: 'Success',
      description: 'User updated successfully',
    });
  },
  onError: (error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  },
});
```

## Quebec Compliance

### Data Privacy (Law 25)
- User consent tracking for data collection
- Right to deletion implementation
- Data portability support
- Audit trail for all administrative actions
- Secure data transmission and storage

### Accessibility (WCAG 2.1 AA)
- Screen reader compatible table navigation
- Keyboard-only operation support
- High contrast mode compatibility
- Focus management for complex interactions

### Language Requirements
- Bilingual interface (French/English)
- Legal text in appropriate language
- Cultural considerations for administrative processes

## Security Considerations

### Administrative Actions
- Two-factor authentication for sensitive operations
- Action confirmation dialogs for destructive operations
- Audit logging for all administrative changes
- Session timeout for idle administrators

### Data Protection
- Encrypted data transmission
- Secure password handling
- PII masking in administrative interfaces
- Role-based data access restrictions

### RBAC Implementation
- Granular permission checks
- Organization-scoped access controls
- Dynamic permission evaluation
- Audit trail for permission changes

## Performance Optimization

### Large Dataset Handling
- Virtual scrolling for user lists
- Server-side pagination and filtering
- Debounced search operations
- Optimistic updates for better UX

### Caching Strategy
- React Query for server state management
- Intelligent cache invalidation
- Background data refetching
- Stale-while-revalidate patterns

### Bundle Optimization
- Lazy loading for admin-only features
- Code splitting by administrative function
- Dynamic imports for heavy components
- Tree shaking for unused utilities

## Testing Strategy

### Unit Tests
```typescript
describe('UserListComponent', () => {
  it('should render user list correctly', () => {
    // Test component rendering
  });
  
  it('should handle bulk selection', () => {
    // Test selection logic
  });
  
  it('should enforce RBAC permissions', () => {
    // Test access control
  });
});
```

### Integration Tests
```typescript
describe('User Management Integration', () => {
  it('should complete full user lifecycle', async () => {
    // Test create -> invite -> activate -> manage -> deactivate
  });
  
  it('should handle invitation expiration', async () => {
    // Test time-based invitation logic
  });
});
```

### Accessibility Tests
```typescript
describe('Admin Accessibility', () => {
  it('should support keyboard navigation', () => {
    // Test keyboard-only interaction
  });
  
  it('should provide screen reader support', () => {
    // Test ARIA labels and structure
  });
});
```

## Error Handling

### User-Friendly Messages
- Clear error descriptions for administrators
- Actionable error resolution steps
- Context-aware help and documentation
- Progressive error disclosure

### Recovery Strategies
- Automatic retry for transient failures
- Graceful degradation for partial failures
- Rollback capabilities for bulk operations
- Data consistency verification

## Monitoring and Analytics

### Administrative Metrics
- User creation and activation rates
- Invitation acceptance rates
- Administrative action frequency
- Error rates and resolution times

### Performance Monitoring
- Component render times
- API response times
- User interaction patterns
- Resource utilization

## Development Guidelines

### Adding New Admin Components
1. Implement strict RBAC from the start
2. Include comprehensive error handling
3. Add audit logging for all actions
4. Test with large datasets
5. Verify Quebec compliance requirements

### Modifying Existing Components
1. Maintain backward compatibility
2. Update related test suites
3. Consider performance impact
4. Review security implications
5. Update documentation

### Code Review Checklist
- [ ] RBAC properly implemented
- [ ] Error handling comprehensive
- [ ] Accessibility standards met
- [ ] Performance considerations addressed
- [ ] Quebec compliance verified
- [ ] Tests updated and passing
- [ ] Documentation updated