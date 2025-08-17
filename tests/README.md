# Tests Directory

## Overview

This directory contains all test files for the Koveo Gestion project, organized by test type and functionality.

## Test Structure

```text
tests/
├── organization/          # Project organization validation tests
├── routing/              # Route validation and navigation tests
├── unit/                 # Unit tests for individual components and functions
├── integration/          # Integration tests for API endpoints and workflows
└── e2e/                  # End-to-end tests for complete user flows
```

## Test Suites

### Organization Tests (`organization/`)
Validates project structure, documentation quality, and code organization:
- **project-structure.test.ts** - Directory structure and naming conventions
- **documentation-validation.test.ts** - Documentation quality and consistency
- **error-detection.test.ts** - Common errors and anti-patterns
- **documentation-improvement.test.ts** - Continuous improvement metrics

### Routing Tests (`routing/`)
Ensures proper route configuration and navigation:
- **route-validation.test.ts** - Route definition validation
- **navigation.test.tsx** - Navigation component testing
- **removed-routes.test.tsx** - Prevention of removed route regression

### Unit Tests (`unit/`)
Test individual components and functions in isolation:
- Component testing with React Testing Library
- Utility function testing
- Business logic validation

### Integration Tests (`integration/`)
Test interactions between different parts of the system:
- API endpoint testing
- Database integration testing
- Service integration validation

### End-to-End Tests (`e2e/`)
Test complete user workflows:
- User authentication flows
- Property management workflows
- Quebec compliance scenarios

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Organization validation
npx jest tests/organization --no-coverage

# Routing tests
npx jest tests/routing --no-coverage

# Unit tests only
npx jest tests/unit

# Integration tests
npx jest tests/integration

# E2E tests
npx jest tests/e2e
```

### Test Coverage
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
npm run test:coverage:open
```

## Test Guidelines

### Writing Tests
- Use descriptive test names that explain the expected behavior
- Group related tests using `describe` blocks
- Use `beforeEach` and `afterEach` for setup and cleanup
- Mock external dependencies appropriately
- Aim for 80%+ test coverage

### Test Data
- Use factory functions for creating test data
- Avoid hardcoded values when possible
- Clean up test data after each test
- Use meaningful test data that reflects real usage

### Organization Tests
- Tests are automatically run to validate project organization
- Results are generated in `ORGANIZATION_VALIDATION_REPORT.md`
- Address failing tests promptly to maintain project quality

## Test Configuration

Test configuration is managed in:
- `jest.config.js` - Main Jest configuration
- `package.json` - Test scripts and dependencies
- Individual test files for specific setup needs

## Quality Standards

All tests must:
- Pass consistently in CI/CD environment
- Have clear, descriptive names
- Include appropriate error scenarios
- Maintain good performance (fast execution)
- Follow established coding standards