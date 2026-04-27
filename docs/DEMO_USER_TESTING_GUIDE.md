# Demo User Security Testing Guide

## Overview

This guide explains the automated testing system for demo user restrictions in the Koveo Gestion platform. The testing suite ensures that demo users maintain view-only access and cannot perform any write operations.

## Test Coverage

The original aggregated demo-restriction suites and the standalone
`validate-demo-security` CLI script that this guide once described have
been retired and replaced by per-feature suites that live alongside the
rest of the integration and unit test trees.

The current demo-user testing coverage is exercised through the regular
Jest run, with the same conceptual breakdown as before:

- **Automated endpoint discovery / restriction validation** — exercised
  by the integration suites under `tests/integration/` that exercise the
  demo-security middleware against every authenticated API surface.
- **Detailed scenario testing** — exercised by the per-role and
  per-operation suites under `tests/integration/` and `tests/unit/`,
  covering create / update / delete restrictions, file uploads, and
  edge cases such as concurrent requests and permission escalation.
- **Manual validation** — replaced by the same Jest-based suites; the
  standalone CLI script is no longer needed.

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

### Demo-focused Jest run
```bash
npx jest -t "demo"
```

### Full security test directory
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
npx jest -t "demo-security"
```

### Build Pipeline
```yaml
- name: Validate Demo Security
  run: npx jest -t "demo-security"
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