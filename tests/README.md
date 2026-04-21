# Financial Overview Testing Suite

This directory contains comprehensive tests for the Financial Overview page to ensure it works correctly now and in the future.

## Test Structure

```
tests/
├── unit/
│   └── financial-overview-calculations.test.ts  # Unit tests for calculations
├── integration/
│   └── financial-overview-api.test.ts           # API integration tests
└── e2e/
    └── financial-overview.spec.md               # End-to-end test specification
```

## Running Tests

### Unit Tests
Tests mathematical calculations and logic:
```bash
npm run test:unit tests/unit/financial-overview-calculations.test.ts
```

### Integration Tests
Tests API endpoints and data flow:
```bash
npm run test:integration tests/integration/financial-overview-api.test.ts
```

### All Tests
Run the complete test suite:
```bash
npm test
```

## Test Coverage

### Unit Tests (`financial-overview-calculations.test.ts`)
Validates:
- ✅ Period length conversion (years ↔ months)
- ✅ Fiscal year start month detection
- ✅ Project cost calculation logic
- ✅ Project date matching algorithms
- ✅ Forecast data aggregation
- ✅ Filter state management
- ✅ X-axis label filtering
- ✅ Data visibility toggles

### Integration Tests (`financial-overview-api.test.ts`)
Validates:
- ✅ Forecast API returns correct data structure
- ✅ Period length parameters work correctly (12, 24, 60 months, etc.)
- ✅ Project filtering via projectIds parameter
- ✅ Project costs appear in correct months
- ✅ Balance calculations include project costs
- ✅ Fiscal year start year/month parameters
- ✅ Error handling for invalid inputs
- ✅ Maximum period validation (360 months)

### E2E Tests (`financial-overview.spec.md`)
Manual test scenarios for:
- ✅ Page load and initialization
- ✅ Building selection
- ✅ Time period filters (all options)
- ✅ Fiscal year selection
- ✅ Project inclusion/exclusion
- ✅ Chart data visibility toggles
- ✅ X-axis fiscal year labels
- ✅ Tooltip display
- ✅ Project date calculations
- ✅ Multiple projects aggregation
- ✅ Error handling
- ✅ Performance with large datasets
- ✅ Mobile responsiveness
- ✅ Browser compatibility

## Key Test Scenarios

### 1. Default Behavior
```typescript
// Verify page loads with correct defaults
expect(filters.viewType).toBe('month');
expect(filters.periodLength).toBe(12);
expect(futureProjection).toBe('12months');
```

### 2. Project Impact on Forecast
```typescript
// Project with plannedStartDate: "2026-06-30", cost: $80,000
// Should appear in June 2026 as capital investment
const juneData = forecast.find(m => m.year === 2026 && m.month === 6);
expect(juneData.capitalInvestment).toBe(80000);
```

### 3. Period Conversion
```typescript
// 5 years = 60 months
const yearlyView = { viewType: 'year', periodLength: 5 };
const expectedMonths = 5 * 12; // 60
expect(expectedMonths).toBe(60);
```

### 4. Fiscal Year Labels
```typescript
// Only fiscal year start months show labels
const fiscalStartMonth = 4; // April
const visibleLabels = months.filter(m => m === fiscalStartMonth);
expect(visibleLabels).toEqual([4]); // Only April
```

## Adding New Tests

### For New Features
1. Add unit tests in `unit/financial-overview-calculations.test.ts`
2. Add API tests in `integration/financial-overview-api.test.ts`
3. Add E2E scenarios in `e2e/financial-overview.spec.md`

### Test Writing Guidelines
- **Be specific**: Test one thing per test case
- **Use descriptive names**: `should include project costs in correct month`
- **Cover edge cases**: Empty data, boundary values, errors
- **Keep tests independent**: Each test should work standalone
- **Mock external dependencies**: Use test data, not real API calls

## Continuous Integration

These tests should run on:
- ✅ Every pull request
- ✅ Before production deployment
- ✅ After schema changes
- ✅ Weekly scheduled runs

## Debugging Failed Tests

### Common Issues

**Test fails: "toBeInTheDocument is not defined"**
- Install testing library matchers: `@testing-library/jest-dom`

**Test fails: "Network error"**
- Check test database is running
- Verify test user has correct permissions

**Test fails: "Timeout exceeded"**
- Increase timeout for slow operations
- Check for infinite loops in code

**Test fails: "Expected X but got Y"**
- Log actual vs expected values
- Check test data matches expectations
- Verify calculations are correct

## Performance Benchmarks

Target performance metrics:
- **Unit tests**: Complete in <1 second
- **Integration tests**: Complete in <5 seconds per test
- **Full test suite**: Complete in <30 seconds

## Test Data

### Required Test Buildings
- Building 1: Financial year starts January 1
- Building 2: Financial year starts April 1

### Required Test Projects
- Project A: plannedStartDate set, cost $80,000
- Project B: Only financialYear set, cost $50,000
- Project C: No dates, cost $30,000

## Maintenance

### Monthly
- ✅ Review test coverage
- ✅ Update for new features
- ✅ Remove obsolete tests

### After Major Changes
- ✅ Update API tests if endpoints change
- ✅ Update unit tests if calculations change
- ✅ Update E2E specs if UI changes

## Success Criteria

All tests must:
- ✅ Pass consistently (>99% reliability)
- ✅ Run quickly (<30 seconds total)
- ✅ Provide clear error messages
- ✅ Cover critical user paths
- ✅ Prevent regressions

---

**Last Updated**: 2025-01-22
**Maintained By**: Development Team
**Next Review**: 2025-02-22
