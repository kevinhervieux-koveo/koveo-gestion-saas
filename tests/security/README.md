# SQL Injection Security Tests

This directory contains comprehensive SQL injection security tests for the Koveo Gestion property management system.

## Test Files

### `sql-injection.test.ts`

- **Full integration tests** that test API endpoints for SQL injection vulnerabilities
- Tests authentication, user management, invitation system, and suggestion endpoints
- Includes time-based, boolean-based, and second-order injection tests
- Tests error message information disclosure prevention

### `sql-injection-advanced.test.ts`

- **Advanced attack vector tests** including raw SQL usage, Unicode attacks, and database-specific functions
- Tests query scoping security and privilege escalation attempts
- Covers PostgreSQL-specific injection attempts and transaction-based attacks
- Tests input validation edge cases and column/table enumeration

### `sql-injection-unit.test.ts`

- **Unit tests** that focus on core database operations without full app setup
- Tests Drizzle ORM parameterized query protection
- Verifies safe handling of malicious input in basic CRUD operations
- Includes schema information protection and large payload handling tests

## Security Features Tested

### ✅ Parameterized Queries

- Drizzle ORM automatically uses parameterized queries
- All user input is safely escaped and treated as literal values
- No direct SQL string concatenation vulnerabilities

### ✅ Input Validation

- Email format validation prevents malicious email injections
- UUID validation rejects malformed input attempts
- Role enum validation prevents role manipulation

### ✅ Query Scoping

- User context-based access control prevents unauthorized data access
- Building and residence access is properly scoped by user permissions
- Organization-level access controls prevent cross-tenant data leakage

### ✅ Error Handling

- Database errors are sanitized and don't reveal internal structure
- Generic error messages prevent information disclosure
- No stack traces or query details exposed to attackers

### ✅ Advanced Protection

- Unicode injection attempts are safely handled
- Null byte injection is prevented
- Long payload attacks don't cause buffer overflows
- Time-based attacks don't cause application delays

## Attack Vectors Covered

1. **Basic SQL Injection**: `'; DROP TABLE users; --`
2. **Authentication Bypass**: `admin' OR '1'='1' --`
3. **Union-based Injection**: `' UNION SELECT * FROM users --`
4. **Boolean-based Blind**: `' AND (SELECT COUNT(*) FROM users) > 0 --`
5. **Time-based Blind**: `'; SELECT pg_sleep(5) --`
6. **Second-order Injection**: Stored payloads that execute later
7. **Schema Discovery**: `' UNION SELECT table_name FROM information_schema.tables --`
8. **Unicode Attacks**: `test\u0027 OR \u00271\u0027=\u00271`
9. **Privilege Escalation**: `'; UPDATE users SET role='admin' --`
10. **Database Functions**: `'; SELECT version(); --`

## Running the Tests

```bash
# Run all SQL injection tests
npm test -- --testPathPattern=sql-injection

# Run specific test files
npm test tests/security/sql-injection-unit.test.ts
npm test tests/security/sql-injection-advanced.test.ts

# Run with verbose output
npm test tests/security/sql-injection-unit.test.ts -- --verbose
```

## Test Results Interpretation

- **✅ Pass**: The application properly prevents the SQL injection attempt
- **❌ Fail**: A vulnerability was found and needs immediate attention
- **⚠️ Warning**: Unusual behavior that should be investigated

## Security Recommendations

1. **Continue using Drizzle ORM** - It provides excellent protection against SQL injection
2. **Maintain input validation** - Keep validating UUIDs, emails, and enum values
3. **Preserve query scoping** - The UserContext system prevents unauthorized access
4. **Monitor error messages** - Ensure they don't reveal sensitive information
5. **Regular testing** - Run these tests as part of CI/CD pipeline

## Quebec Law 25 Compliance

These tests help ensure compliance with Quebec's Law 25 privacy protection requirements by:

- Preventing unauthorized access to personal information
- Ensuring data access controls are properly enforced
- Protecting against data extraction attacks
- Maintaining audit trail integrity through secure database operations

## Continuous Monitoring

Consider running these tests:

- **Before each deployment** to catch any new vulnerabilities
- **After database schema changes** to ensure protection remains intact
- **When adding new API endpoints** to verify they're properly secured
- **During security audits** as part of comprehensive security assessment
