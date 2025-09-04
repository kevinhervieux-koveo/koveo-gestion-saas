# Demo User Security Implementation

This document outlines the comprehensive security system implemented to ensure demo users have proper view-only access and cannot perform destructive operations.

## Overview

The demo user security system enforces different levels of access:

- **Regular Demo Users** (`@demo.com`): Full access within Demo organization
- **Open Demo Users** (`@opendemo.com`): View-only access, cannot modify any data
- **Regular Users**: Full access within their assigned organizations

## Security Components

### 1. Backend Security (RBAC)

#### Functions in `server/rbac.ts`:

- `isOpenDemoUser(userId)`: Identifies Open Demo users
- `canUserPerformWriteOperation(userId, action)`: Checks write permissions
- `getUserAccessibleOrganizations(userId)`: Gets accessible organizations

#### Middleware in `server/middleware/demo-security.ts`:

- `enforceDemoSecurity()`: General write operation restrictions
- `enforceFileUploadSecurity()`: File upload restrictions
- `enforceBulkOperationSecurity()`: Bulk operation restrictions
- `enforceExportSecurity()`: Data export restrictions

### 2. Error Handling

#### Elegant Error Messages

All restriction errors include:

- **Bilingual support** (English/French)
- **User-friendly language** (no technical jargon)
- **Clear explanations** of demo limitations
- **Contact information** for full accounts
- **Consistent structure** across all endpoints

Example error response:

```json
{
  "success": false,
  "code": "DEMO_RESTRICTED",
  "title": "Demo Mode - View Only",
  "message": "This is a demonstration account with view-only access.",
  "messageEn": "This is a demonstration account with view-only access.",
  "messageFr": "Ceci est un compte de démonstration avec accès en consultation seulement.",
  "suggestion": "Contact us for a full account to make changes.",
  "contact": "Contact our team to get started with your own workspace."
}
```

### 3. Restricted Operations

#### Open Demo Users Cannot:

- **Create** users, buildings, residences, documents
- **Update** any existing data
- **Delete** any records
- **Upload** files or documents
- **Perform bulk operations** (import/export)
- **Modify** their own profile or organization
- **Access admin functions**

#### Open Demo Users Can:

- **View** all data they have access to
- **Search and filter** content
- **Download** existing documents
- **Navigate** the application
- **Use read-only features**

## Test Suite

### 1. Security Tests

#### `tests/security/demo-users-validation.test.ts`

- Validates demo user data integrity
- Ensures no admin users in demo organizations
- Verifies realistic Quebec names and email patterns
- Checks role restrictions

#### `tests/security/comprehensive-demo-user-security.test.ts`

- End-to-end API security tests
- Tests all CRUD operations restrictions
- Validates error message quality
- Tests security edge cases and bypass attempts

#### `tests/integration/demo-user-ui-restrictions.test.tsx`

- Frontend UI restriction tests
- Error message display validation
- Accessibility and user experience tests
- Progressive disclosure testing

### 2. Test Runner

#### `tests/security/demo-security-test-runner.ts`

- Comprehensive test execution
- Security status reporting
- Critical failure detection
- Recommendations for security issues

Run all demo security tests:

```bash
tsx tests/security/demo-security-test-runner.ts
```

## Implementation Checklist

### Backend Security ✅

- [x] RBAC functions for demo user identification
- [x] Write operation permission checks
- [x] Middleware for API endpoint protection
- [x] Elegant error message system
- [x] Bilingual error support

### Frontend Security ✅

- [x] UI component restrictions
- [x] Button disable/hide logic
- [x] Error message display
- [x] Demo restriction banners
- [x] Accessibility considerations

### Testing ✅

- [x] Database validation tests
- [x] API endpoint security tests
- [x] UI restriction tests
- [x] Error handling tests
- [x] Edge case and bypass tests
- [x] Comprehensive test runner

### Security Monitoring ✅

- [x] Attempt logging for violations
- [x] User activity tracking
- [x] Security audit trails
- [x] Performance monitoring for demo users

## Security Patterns

### 1. Defense in Depth

Security is enforced at multiple layers:

1. **Database level**: User role validation
2. **API middleware**: Route-level restrictions
3. **Business logic**: Function-level checks
4. **Frontend**: UI component restrictions

### 2. Fail-Safe Defaults

- Unknown users default to restricted access
- Missing permissions default to deny
- Errors default to restrictive responses
- Failed checks default to view-only mode

### 3. User Experience Priority

- Clear, non-technical error messages
- Consistent restriction patterns
- Helpful guidance for upgrading
- Maintained functionality for allowed actions

## Monitoring and Alerts

### Security Violation Logging

All restricted actions are logged with:

```
🚫 Open Demo user {userId} ({email}) attempted restricted action: {method} {path}
```

### Metrics Tracked

- Number of restriction violations per user
- Most commonly attempted restricted actions
- Error message effectiveness (user feedback)
- Demo user engagement patterns

## Maintenance

### Regular Security Reviews

1. **Monthly**: Review demo user activity logs
2. **Quarterly**: Update test coverage for new features
3. **Before releases**: Run full security test suite
4. **After incidents**: Review and strengthen restrictions

### Adding New Restrictions

When adding new features:

1. Add RBAC checks to backend functions
2. Apply middleware to new API endpoints
3. Update frontend components with restrictions
4. Add corresponding security tests
5. Update error messages if needed

## Troubleshooting

### Common Issues

1. **Tests failing**: Check database connectivity and demo organizations
2. **UI not restricting**: Verify auth context and user role detection
3. **API allowing writes**: Check middleware application order
4. **Error messages not showing**: Verify frontend error handling

### Debug Commands

```bash
# Check demo user data
npm run db:studio

# Test specific security function
tsx -e "import { isOpenDemoUser } from './server/rbac'; console.log(await isOpenDemoUser('user-id'))"

# Run specific test suite
npm test tests/security/demo-users-validation.test.ts

# Check middleware application
grep -r "enforceDemoSecurity" server/
```

## Security Contact

For security concerns related to demo user restrictions:

1. Review test results in the security test runner
2. Check application logs for violation patterns
3. Verify user organization assignments
4. Escalate critical failures immediately

---

This security system ensures demo users can explore the full application functionality while maintaining data integrity and preventing unauthorized modifications.
