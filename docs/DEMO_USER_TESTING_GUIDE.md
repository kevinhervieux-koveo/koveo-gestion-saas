# Demo User Security Testing Guide

## Overview

This guide explains the automated testing system for demo user restrictions in the Koveo Gestion platform. The testing suite ensures that demo users maintain view-only access and cannot perform any write operations.

## Test Files

### 1. `tests/security/automated-demo-restrictions.test.ts`
**Primary automated validation suite**

- **Endpoint Discovery**: Automatically discovers all API endpoints in the codebase
- **Write Operation Detection**: Identifies which endpoints perform write operations
- **Demo User Testing**: Validates that demo users cannot perform write operations
- **Security Report Generation**: Creates comprehensive security analysis reports
- **Regression Testing**: Ensures demo security remains intact across updates

### 2. `tests/security/demo-user-comprehensive-validation.test.ts`
**Detailed scenario testing**

- **Role-based Testing**: Tests all demo user roles (demo_manager, demo_tenant, demo_resident)
- **Operation-specific Tests**: Validates restrictions for create, update, delete operations
- **Edge Case Testing**: Tests concurrent requests, malformed data, permission escalation
- **File Operation Testing**: Validates upload/download restrictions
- **Read Access Validation**: Ensures demo users can still view data appropriately

### 3. `scripts/validate-demo-security.ts`
**Manual validation script**

- **Database Validation**: Checks demo user configuration in database
- **Role Assignment Validation**: Verifies demo users are properly assigned to demo organizations
- **Write Restriction Validation**: Confirms all demo users have write restrictions
- **Security Report**: Generates summary reports of demo user security status

## Key Security Validations

### 1. Write Operation Restrictions
Demo users are prevented from:
- Creating new records (organizations, buildings, residences, documents, users)
- Updating existing records (including their own profiles)
- Deleting any records
- Uploading files or documents
- Performing bulk operations
- Exporting data

### 2. Permission Escalation Prevention
Demo users cannot:
- Change their own roles
- Create admin users
- Assign users to organizations
- Modify security settings
- Access administrative functions

### 3. Data Integrity Protection
- Demo users can only view data within their assigned demo organization
- All write operations return 403 Forbidden with `DEMO_RESTRICTED` code
- Concurrent requests maintain security restrictions
- Malformed requests still respect demo restrictions

## Running the Tests

### Automated Test Suite
```bash
npm test tests/security/automated-demo-restrictions.test.ts
npm test tests/security/demo-user-comprehensive-validation.test.ts
```

### Manual Validation Script
```bash
npx tsx scripts/validate-demo-security.ts
```

### All Security Tests
```bash
npm test tests/security/
```

## Test Reports

### Automated Discovery Report
The automated test generates detailed reports showing:
- **Total API Endpoints**: Number of discovered endpoints
- **Write Operations**: Endpoints that modify data
- **Read Operations**: Endpoints that only view data
- **Authentication Status**: Which endpoints require authentication
- **Security Coverage**: Percentage of endpoints with proper demo restrictions

### Security Analysis Report
Generated at `reports/demo-security-analysis.json`:
```json
{
  "totalEndpoints": 45,
  "writeOperations": 28,
  "readOperations": 17,
  "authenticatedEndpoints": 42,
  "unauthenticatedEndpoints": 3,
  "criticalEndpoints": 12,
  "demoSecurityCoverage": {
    "endpoints": 45,
    "writeOpsNeedingRestriction": 28
  }
}
```

## Demo User Detection

### Open Demo Organization
Demo users are identified by membership in the "Open Demo" organization:
- **Organization Type**: `demo`
- **Special Properties**: View-only access, restricted write operations
- **User Roles**: `demo_manager`, `demo_tenant`, `demo_resident`

### RBAC Functions
- `isOpenDemoUser(userId)`: Checks if user belongs to Open Demo organization
- `canUserPerformWriteOperation(userId, action)`: Validates write operation permissions
- Demo security middleware: Automatically applied to all write endpoints

## Adding New Endpoints

### Automatic Detection
When new API endpoints are added:

1. **Discovery**: The automated test will detect new endpoints on next run
2. **Classification**: Endpoints are automatically classified as read or write operations
3. **Validation**: Write operations are automatically tested for demo restrictions
4. **Reporting**: Missing restrictions are reported in test output

### Security Compliance
For new write endpoints:

1. **Apply Authentication**: Use `requireAuth` middleware
2. **Apply Demo Security**: Demo security middleware is applied globally
3. **Test Coverage**: Run automated tests to validate restrictions
4. **Update Tests**: Add specific test cases if needed for complex endpoints

## Maintenance

### Regular Validation
- Run tests before each release
- Execute manual validation script weekly
- Review security reports for new endpoints
- Update test cases for new business logic

### Monitoring
The tests will alert you to:
- New endpoints without proper restrictions
- Changes in demo user behavior
- Security vulnerabilities in demo access
- Permission escalation attempts

### Troubleshooting

#### Test Failures
1. **Demo Organization Missing**: Create "Open Demo" organization
2. **Demo Users Not Found**: Create demo users with proper roles
3. **Write Operations Not Blocked**: Check demo security middleware application
4. **Database Connection Issues**: Verify database configuration

#### Security Issues
1. **Unblocked Write Operations**: Review middleware application
2. **Permission Escalation**: Check role assignment logic
3. **Data Access Violations**: Validate RBAC implementation

## Integration with CI/CD

### Pre-commit Hooks
```bash
npx tsx scripts/validate-demo-security.ts
```

### Build Pipeline
```yaml
- name: Validate Demo Security
  run: |
    npm test tests/security/automated-demo-restrictions.test.ts
    npx tsx scripts/validate-demo-security.ts
```

### Quality Gates
- All demo security tests must pass
- Security report must show 100% coverage for write operations
- No unblocked write operations for demo users

## Best Practices

1. **Always Test New Endpoints**: Run automated tests after adding new API endpoints
2. **Validate Role Changes**: Test demo restrictions after modifying user roles
3. **Monitor Security Reports**: Review generated reports for security insights
4. **Document New Restrictions**: Update this guide when adding new security measures
5. **Regular Audits**: Periodically run comprehensive validation scripts

## Quebec Law 25 Compliance

Demo user restrictions support Quebec Law 25 compliance by:
- **Data Protection**: Preventing unauthorized data modifications
- **Access Control**: Maintaining proper access restrictions
- **Audit Trail**: Logging all restriction violations
- **Privacy Protection**: Ensuring demo users cannot access sensitive data inappropriately