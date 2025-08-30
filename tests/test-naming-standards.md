# Test File Naming Standards

## Naming Convention Rules

### 1. File Extension

- **Required**: All test files must use `.test.ts` extension
- **Forbidden**: `.spec.ts`, `.test.js`, `.spec.js`

### 2. Naming Format

- **Pattern**: `{feature-name}.test.ts`
- **Case**: kebab-case (lowercase with hyphens)
- **Length**: Descriptive but concise (max 50 characters)

### 3. Directory Structure

#### Unit Tests (`tests/unit/`)

- Test individual functions, classes, or components
- **Pattern**: `unit/{domain}/{feature}.test.ts`
- **Examples**:
  - `unit/auth/rbac.test.ts`
  - `unit/storage/database.test.ts`
  - `unit/ai/form-mapping.test.ts`

#### Integration Tests (`tests/integration/`)

- Test component interactions and API integrations
- **Pattern**: `integration/{domain}/{feature}.test.ts`
- **Examples**:
  - `integration/api/rbac-endpoints.test.ts`
  - `integration/quality/system-integration.test.ts`

#### End-to-End Tests (`tests/e2e/`)

- Test complete user workflows
- **Pattern**: `e2e/{workflow-name}.test.ts`
- **Examples**:
  - `e2e/ssl-management.test.ts`
  - `e2e/user-registration-flow.test.ts`

#### Organization Tests (`tests/organization/`)

- Test project structure and documentation
- **Pattern**: `organization/{aspect}.test.ts`
- **Examples**:
  - `organization/documentation-validation.test.ts`
  - `organization/project-structure.test.ts`

### 4. Subdirectory Guidelines

#### When to Create Subdirectories

- **Domain grouping**: When 3+ related test files exist
- **Feature complexity**: For complex features with multiple test aspects
- **Logical separation**: Different testing concerns for same domain

#### Recommended Subdirectories

```plaintext
tests/
├── unit/
│   ├── ai/                 # AI-related functionality
│   ├── auth/              # Authentication and authorization
│   ├── db/                # Database operations
│   ├── ssl/               # SSL certificate management
│   └── storage/           # Data storage operations
├── integration/
│   ├── api/               # API endpoint testing
│   ├── ai/                # AI system integration
│   ├── invitation/        # User invitation system
│   └── quality/           # Quality system integration
└── e2e/
    ├── invitation/        # User invitation workflows
    └── ssl/               # SSL management workflows
```

### 5. Naming Examples

#### ✅ Good Examples

- `user-management.test.ts` - Clear feature name
- `auth/rbac.test.ts` - Scoped with domain
- `api/user-endpoints.test.ts` - API-specific with scope
- `ssl-certificate-renewal.test.ts` - Descriptive workflow

#### ❌ Bad Examples

- `test1.test.ts` - Non-descriptive
- `UserManagement.test.ts` - PascalCase (should be kebab-case)
- `user_management.test.ts` - snake_case (should be kebab-case)
- `really-long-descriptive-test-file-name-that-is-too-verbose.test.ts` - Too long

## Current Compliance Status

### ✅ Compliant Files (Examples)

- `unit/auth/rbac.test.ts`
- `integration/api/rbac-endpoints.test.ts`
- `organization/documentation-validation.test.ts`
- `e2e/ssl-management.test.ts` (recently moved)

### ⚠️ Minor Issues Addressed

- Moved `ssl-management-e2e.test.ts` from `integration/` to `e2e/`
- All files consistently use `.test.ts` extension
- Directory structure follows logical organization

## Maintenance Guidelines

### Adding New Tests

1. Choose appropriate directory based on test type
2. Use kebab-case naming convention
3. Create subdirectories when 3+ related files exist
4. Follow domain-based organization

### Reviewing Test Structure

- Ensure test files are in correct directories
- Verify naming follows conventions
- Check for opportunities to create subdirectories
- Maintain consistent organization patterns

## Benefits of This Standard

- **Discoverability**: Easy to find tests for specific features
- **Organization**: Logical grouping reduces cognitive load
- **Consistency**: Uniform naming aids navigation
- **Maintainability**: Clear structure supports long-term maintenance
