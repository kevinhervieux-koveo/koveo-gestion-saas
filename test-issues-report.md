# Test Issues Report

Generated: October 4, 2025

## Summary

**Current Test Status:**
- **Total Test Files:** 157
- **Test Suites Run:** 6 out of 167
- **Test Suites Failed:** 2
- **Test Suites Passed:** 4
- **Total Tests:** 230
- **Tests Failed:** 14
- **Tests Passed:** 216

## Critical Finding

⚠️ **Only 6 test suites ran out of 167 total** due to `bail: true` configuration in `jest.config.cjs` (line 126). This stops testing after the first failure, preventing discovery of all issues.

## Failed Test Suites

### 1. Communication Page Test Suite
**File:** `tests/unit/communication/communication-page.test.tsx`
**Status:** ❌ FAILED (14 tests failed)

#### Failed Tests:

1. **Notification Preferences Panel** (7 failures)
   - ❌ should render all 17 notification types
     - Issue: API call not being made (`GET /api/communication/preferences`)
     - Expected fetch to be called but received 0 calls
   
   - ❌ should render all 7 frequency options
     - Similar API call issue
   
   - ❌ should handle bulk actions for setting all preferences to same frequency
     - Bulk action functionality not working
   
   - ❌ should toggle notification preference enabled state
     - Toggle state management issue
   
   - ❌ should save notification preferences
     - Save functionality not working
   
   - ❌ should reset notification preferences
     - Reset functionality issue
   
   - ❌ should handle notification preferences API error
     - Error handling not working as expected

2. **General Communication Form** (3 failures)
   - ❌ should submit general communication form with correct data
     - Form submission not working
   
   - ❌ should handle organization filtering
     - Organization filter not functioning
   
   - ❌ should handle recipient role selection
     - Role selection issue

3. **Meeting Planning Form** (2 failures)
   - ❌ should submit meeting invitation with correct data
     - Meeting form submission failing
   
   - ❌ should handle invited roles selection for meetings
     - Multiple elements with text "all" found
     - TestingLibraryElementError: ambiguous element selection

4. **Loading States and Error Handling** (1 failure)
   - ❌ should handle network errors gracefully
     - Network error handling not working

5. **Form Reset and State Management** (1 failure)
   - ❌ should reset general communication form after successful submission
     - Form reset functionality broken

**Common Issues Identified:**
- API mock calls not being intercepted (`global.fetch` not being called)
- Form state management problems
- Duplicate element selection issues in tests
- Error handling not triggering as expected

### 2. API Budgets Test Suite
**File:** `tests/unit/api/budgets.test.ts`
**Status:** ❌ FAILED
**Details:** Limited information available due to bail configuration

## Additional Issues Found During Test Discovery

### 3. RBAC Buildings Residences Test
**File:** `tests/integration/rbac-buildings-residences.test.ts`
**Status:** ❌ COMPILE ERROR
**Error:**
```
TypeError: (0 , drizzle_orm_2.relations) is not a function
at shared/schemas/maintenance.ts:866:49
```

**Root Cause:** 
- Drizzle ORM `relations` function not properly imported or mocked
- Occurs when importing `shared/schema.ts` → `shared/schemas/maintenance.ts`
- Affects: `uniformatCodesRelations` definition

### 4. Document Management Comprehensive Test
**File:** `tests/integration/document-management-comprehensive.test.tsx`
**Status:** ❌ RUNTIME ERROR
**Error:**
```
TypeError: Cannot read properties of undefined (reading 'buildingId')
TypeError: Cannot read properties of undefined (reading 'residenceId')
```

**Root Cause:**
- `useParams()` from routing library returning undefined in tests
- Affects:
  - `client/src/pages/manager/BuildingDocuments.tsx:7`
  - `client/src/pages/manager/ResidenceDocuments.tsx:7`
- Missing proper route parameter mocking in test setup

## Configuration Issues

### Jest Configuration
**File:** `jest.config.cjs`

**Issue 1: Bail on First Failure**
- Line 126: `bail: true`
- Impact: Only 6 test suites run before stopping
- Recommendation: Disable for full test discovery

**Issue 2: Low Test Timeout**
- Line 114: `testTimeout: 8000` (8 seconds)
- Impact: Some integration tests may timeout
- Current timeout for integration tests: 20 seconds (override in package.json)

**Issue 3: Single Worker**
- Line 115: `maxWorkers: 1`
- Impact: Very slow test execution
- Recommendation: Use 50% or more workers for faster runs

## Passed Test Suites

✅ **tests/integration/budget-page-comprehensive.test.tsx**
- All tests passing
- React Query integration working correctly

✅ **tests/security/demo-security-bypass.test.ts**
- Security tests passing
- Query parameter and nested path bypass prevention working

## Recommendations

### Immediate Actions

1. **Disable Bail to Discover All Issues**
   ```bash
   npx jest --no-bail --passWithNoTests=false
   ```

2. **Fix Communication Page Test Issues**
   - Review API mocking setup in test file
   - Check if `global.fetch` is properly mocked
   - Fix duplicate element selection in tests

3. **Fix Drizzle ORM Relations Import**
   - Verify `drizzle-orm` is properly imported in `shared/schemas/maintenance.ts`
   - Check Jest module name mapping for drizzle-orm mocking

4. **Fix Router Parameter Mocking**
   - Add proper `useParams` mock in test setup
   - Provide route parameters in document management tests

### Long-term Improvements

1. **Update Jest Configuration**
   - Remove or make `bail` configurable
   - Increase `maxWorkers` for faster test runs
   - Review timeout settings

2. **Add Test Documentation**
   - Document how to run specific test suites
   - Document mocking strategies
   - Add troubleshooting guide

3. **Improve Test Coverage**
   - Currently only 6 of 167 test suites running
   - Many tests may have similar issues

## Commands to Run

### Run All Tests Without Bail
```bash
npx jest --no-bail --passWithNoTests=false --maxWorkers=50%
```

### Run Specific Test Suites
```bash
# Communication page tests only
npx jest tests/unit/communication/communication-page.test.tsx --no-bail

# Integration tests
npm run test:integration

# Unit tests only
npm run test:unit
```

### Run with Verbose Output
```bash
npx jest --verbose --no-bail --passWithNoTests=false
```

## Next Steps

1. Fix the 14 failing tests in Communication Page Test Suite
2. Resolve Drizzle ORM import issue in RBAC test
3. Fix useParams mocking in document management tests
4. Run full test suite without bail to discover remaining issues
5. Update Jest configuration for better performance
