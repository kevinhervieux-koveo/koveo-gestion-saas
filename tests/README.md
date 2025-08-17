# Testing Infrastructure

## Overview
This directory contains comprehensive test suites for the Koveo Gestion platform, including unit tests, integration tests, and specialized organization validation tests.

## Test Structure

### Unit Tests (`/unit`)
- **auth/**: Authentication and RBAC system tests
- **db/**: Database query scoping and permissions tests
- **language.test.tsx**: Language switching and internationalization
- **utils.test.ts**: Utility function tests
- **feature-management.test.ts**: Feature status and roadmap functionality

### Integration Tests (`/integration`)
- Full workflow tests
- API endpoint integration
- Database transaction tests

### End-to-End Tests (`/e2e`)
- Complete user journey tests
- Multi-role interaction scenarios
- Invitation flow testing

### Organization Tests (`/organization`)
Special test suite for validating project structure and documentation:

#### 1. `project-structure.test.ts`
- Validates directory structure
- Checks configuration files
- Ensures naming conventions
- Detects duplicate files
- Verifies build outputs

#### 2. `documentation-validation.test.ts`
- Detects documentation redundancies
- Validates internal links
- Checks markdown formatting
- Ensures completeness
- Validates code examples

#### 3. `error-detection.test.ts`
- Finds broken imports
- Detects circular dependencies
- Identifies TypeScript issues
- Checks for security problems
- Validates API consistency

#### 4. `documentation-improvement.test.ts`
- Calculates readability scores
- Tracks documentation coverage
- Suggests improvements
- Monitors update frequency
- Generates quality reports

### Mobile Tests (`/mobile`)
- Responsive design validation
- Touch interaction testing
- Mobile-specific features
- Performance on mobile devices

### Routing Tests (`/routing`)
- Route validation
- Navigation testing
- Access control verification
- Removed route detection

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Organization validation
npx jest tests/organization

# Specific test file
npx jest tests/organization/project-structure.test.ts
```

### Test Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Organization Validation

The organization tests provide continuous validation of project health:

### Running Organization Validation
```bash
# Run all organization tests
npx jest tests/organization --no-coverage

# Generate validation report
tsx scripts/validate-organization.ts
```

### Validation Metrics
- **Structure**: 75% pass rate (12/16 tests)
- **Documentation**: 40% pass rate (4/10 tests)
- **Error Detection**: 60% pass rate (9/15 tests)
- **Improvement**: 71% pass rate (5/7 tests)
- **Overall**: 62.5% pass rate (30/48 tests)

### Key Issues Found
1. Missing server directories
2. Duplicate sidebar component
3. Inconsistent file naming (6 files)
4. Broken documentation links (3)
5. Code blocks without language specs (9)
6. Excessive use of 'any' type (49 instances)
7. Unused imports (126)

## Test Configuration

### Jest Configuration
- **Test Environment**: jsdom for browser testing
- **Coverage**: Configured for client, server, and shared code
- **Transform**: TypeScript via ts-jest
- **Setup Files**: 
  - `tests/setup.ts`: Mock browser APIs
  - `tests/polyfills.js`: Node.js polyfills

### Test Patterns
- Test files: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Coverage excludes: node_modules, dist, type definitions

## Best Practices

### Writing Tests
1. Use descriptive test names
2. Follow AAA pattern (Arrange, Act, Assert)
3. Mock external dependencies
4. Test edge cases
5. Keep tests isolated and independent

### Organization Tests
1. Run weekly for continuous validation
2. Fix critical issues immediately
3. Track improvement metrics over time
4. Use suggestions for continuous improvement
5. Update tests as project evolves

## Continuous Improvement

### Weekly Tasks
1. Run full organization validation
2. Review and fix failing tests
3. Update documentation based on suggestions
4. Clean up unused imports and 'any' types

### Monthly Tasks
1. Review test coverage metrics
2. Update test documentation
3. Refactor tests for maintainability
4. Add tests for new features

## Reports

### Generated Reports
- `ORGANIZATION_VALIDATION_REPORT.md`: Comprehensive validation results
- `coverage/index.html`: Test coverage report
- `docs/IMPROVEMENT_REPORT.md`: Documentation improvement tracking

### Metrics Tracked
- Test pass rates
- Documentation readability scores
- Code quality metrics
- Coverage percentages
- Issue counts by category

## Contributing

When adding new tests:
1. Place in appropriate directory
2. Follow existing naming conventions
3. Update this README
4. Ensure tests are deterministic
5. Add to relevant test suite