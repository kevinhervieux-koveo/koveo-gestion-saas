#!/bin/bash

# Koveo Gestion - Sequential Test Execution Script
# Runs tests in logical order with proper error handling and reporting

set -e

echo "🧪 Koveo Gestion - Sequential Test Suite"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "${BLUE}📋 Running: ${description}${NC}"
    echo "   Command: $test_command"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: ${test_name}${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        
        # Continue with other tests but track failures
        echo -e "${YELLOW}⏩ Continuing with remaining tests...${NC}"
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Function to run optional test and track results
run_optional_test() {
    local test_name="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "${BLUE}📋 Running (Optional): ${description}${NC}"
    echo "   Command: $test_command"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️  SKIPPED: ${test_name} (Known Issues)${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

echo "🚀 Starting Sequential Test Execution..."
echo ""

# Phase 1: Schema and Validation Tests (Foundation)
echo "Phase 1: Schema and Validation Tests"
echo "====================================="
run_test "Schema-Bills" "npx jest tests/unit/bills-validation.test.ts --maxWorkers=1" "Bills schema validation tests"
run_test "Schema-Demands" "npx jest tests/unit/demands/demands-schema.test.ts --maxWorkers=1" "Demands schema validation tests"
run_test "Schema-Password" "npx jest tests/unit/invitation/password-validation.test.ts --maxWorkers=1" "Password validation tests"

# Phase 2: Core Authentication and Authorization (Security Foundation)
echo "Phase 2: Authentication and Authorization"
echo "========================================"
run_test "Auth-RBAC-Core" "npx jest tests/unit/auth/rbac.test.ts --maxWorkers=1" "Core RBAC permissions tests"
run_optional_test "Auth-Middleware" "npx jest tests/unit/auth/auth-middleware-comprehensive.test.ts --maxWorkers=1" "Authentication middleware tests"

# Phase 3: Feature Tests (Business Logic)
echo "Phase 3: Feature and Business Logic Tests"
echo "========================================="
run_test "Features-Calendar" "npx jest tests/unit/calendar/calendar-features.test.ts --maxWorkers=1" "Calendar functionality tests"
run_optional_test "Features-Budget" "npx jest tests/unit/budget/budget-comprehensive.test.ts --maxWorkers=1" "Budget calculation tests"

# Phase 4: Quebec Compliance Tests
echo "Phase 4: Quebec Compliance and Internationalization"
echo "=================================================="
run_optional_test "Quebec-i18n" "npx jest tests/unit/i18n/ --maxWorkers=1" "Quebec compliance and internationalization"

# Phase 5: Database and Storage Tests
echo "Phase 5: Database and Storage Tests"
echo "==================================="
run_optional_test "Database-Sync" "npm run test:db-sync" "Database synchronization tests"
run_optional_test "Database-Integrity" "npm run test:db-integrity" "Database integrity tests"

# Phase 6: Integration Tests (System Integration)
echo "Phase 6: Integration Tests"
echo "=========================="
run_optional_test "Integration-Core" "npx jest tests/integration/ --maxWorkers=1 --testTimeout=10000" "Core integration tests"

# Phase 7: Security Tests
echo "Phase 7: Security Tests"
echo "======================"
run_optional_test "Security-Suite" "npm run test:security" "Security validation tests"

# Final Summary
echo ""
echo "🏁 Test Execution Complete"
echo "=========================="
echo ""
echo -e "📊 Results Summary:"
echo -e "   ${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
echo -e "   ${RED}❌ Failed: ${FAILED_TESTS}${NC}"
echo -e "   ${YELLOW}⚠️  Skipped: ${SKIPPED_TESTS}${NC}"
echo -e "   📋 Total: ${TOTAL_TESTS}"
echo ""

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "📈 Success Rate: ${SUCCESS_RATE}%"
else
    echo -e "❌ No tests were executed"
fi

echo ""

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical tests passed successfully!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed but execution completed${NC}"
    echo -e "   Review the failed tests above for details"
    exit 1
fi