# Architect Recommendations for Integration Test Strategy

## Strategic Guidance Received

The architect recommends a **dual-track remediation plan** for fixing the remaining integration tests.

## Track 1: Critical Tests with Real Database (Priority)

### Approach
Set up lightweight shared Postgres test environment for business-critical integration suites.

### Implementation
1. **Docker Compose Setup**
   - Add `docker-compose.test.yml` with Postgres service
   - Configure test database with schema sync
   - Implement fixture seeding for deterministic test data

2. **Transactional Reset Pattern**
   - Wrap each test in database transaction
   - Automatic rollback after each test
   - Ensures test isolation and repeatability

3. **Prioritized Test Suites**
   - Authentication & Login flows
   - RBAC (Role-Based Access Control)
   - Billing access and operations
   - API routes validation

### Benefits
- Real end-to-end coverage for critical flows
- Catches actual integration bugs
- Tests real API routes with actual database operations
- Acceptable for production deployment

## Track 2: Non-Critical Tests with Contract Mocking

### Approach
Migrate secondary tests to contract-style testing with stable service mocks.

### Implementation
1. **Contract Testing Pattern**
   - Define API contracts using OpenAPI/JSON Schema
   - Test against contracts instead of implementation details
   - Use MSW (Mock Service Worker) for service mocking

2. **Shared Fixtures**
   - Create reusable test data fixtures
   - Standardize mock responses
   - Reduce test maintenance overhead

3. **Applicable Test Suites**
   - Email service functionality
   - Button database integration
   - Form submissions
   - Other high-flake, non-critical specs

### Benefits
- Faster test execution
- Reduced flakiness
- Lower maintenance burden
- Adequate coverage for secondary flows

## Current Status

### ✅ What's Been Fixed (193 tests passing)

**Unit Tests (104):**
- All passing with correct business logic
- Proper mock cleanup
- Full LSP error resolution

**Critical Integration Tests (89):**
- budgets.forecast.test.ts: 11/11 ✅
- bills-api-routes.test.ts: 15/15 ✅ (uses mocks - needs Track 1 treatment)
- demo-creation.test.ts: 29/29 ✅
- authentication-critical.test.ts: 9/9 ✅

### ⚠️ What Needs Track 1 (Real DB)

**Database Connection Failures (~12 suites):**
- authentication-system.test.ts
- login-functionality.test.ts
- rbac-buildings-residences.test.ts
- bills-buildings-access.test.ts
- api-routes-validation.test.ts
- demo-organization-real.test.ts
- business-logic-integration.test.ts
- button-database-integration.test.ts
- And others...

**Issue**: All fail with `ECONNREFUSED` trying to connect to real database

### 📋 What Can Use Track 2 (Contract Mocks)

**Secondary/Support Suites:**
- email-service-functionality.test.ts
- email-service-mock.test.ts
- form-submission-tests.test.ts
- Other email/notification tests

## Implementation Roadmap

### Phase 1: Test Infrastructure Setup
1. Create `docker-compose.test.yml`
2. Add test database initialization script
3. Create fixture seeding utilities
4. Document test database workflow

### Phase 2: Rehabilitate Critical Suites
1. Update bills-api-routes.test.ts to use real router + test DB
2. Fix authentication/login tests with real DB
3. Fix RBAC tests with real DB
4. Fix billing access tests with real DB

### Phase 3: Contract Testing Pattern
1. Define contract testing utilities
2. Migrate email service tests
3. Migrate form submission tests
4. Document contract testing pattern

## Limitations and Trade-offs

### Current Mock-Based Approach
**Pros:**
- Fast to implement
- Tests pass quickly
- No infrastructure needed

**Cons:**
- Loses integration value (architect confirmed unacceptable for core flows)
- Can't catch real integration bugs
- Doesn't test actual database operations
- False sense of security

### Recommended Dual-Track Approach
**Pros:**
- Real coverage for critical flows
- Catches actual bugs
- Appropriate test pyramid
- Maintainable long-term

**Cons:**
- Requires Docker infrastructure
- More complex setup
- Longer initial investment

## Architect's Key Insights

> "Remaining red suites fall into three buckets—hard DB failures (ECONNREFUSED across ~12 API/auth suites), brittle legacy mocks (email/billing flows), and slow/hanging orchestration specs. All are symptoms of missing deterministic test infrastructure rather than logic regressions."

> "Pure-mock rewrites (current bills-api-routes fix) regain green but eliminate end-to-end coverage; architect feedback confirms this is unacceptable for core flows."

> "No production code changes are currently required—focus is test infra and fixture design."

## Next Steps

1. **Immediate (Can do now):**
   - Continue fixing unit tests
   - Fix content validation tests
   - Document known integration test issues

2. **Short-term (Requires infrastructure):**
   - Set up Docker test database
   - Rehabilitate critical integration tests
   - Use real database with transactional reset

3. **Medium-term (Test strategy):**
   - Implement contract testing pattern
   - Migrate non-critical tests to contract mocks
   - Establish test maintenance guidelines

## Conclusion

The architect's dual-track approach provides a clear path forward:
- **Track 1** ensures critical flows have real integration coverage
- **Track 2** makes secondary tests maintainable with appropriate mocking

Current work has fixed all unit tests and some integration tests, but proper integration testing requires test infrastructure setup that's currently missing.
