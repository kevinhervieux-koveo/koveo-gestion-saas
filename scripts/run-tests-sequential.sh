#!/bin/bash

# Koveo Gestion - Complete Sequential Test Execution Script
# Runs ALL tests in logical order with proper error handling and reporting

set +e  # Don't exit on first failure, continue running all tests

# Check if we're in the correct working directory
if [ ! -f "package.json" ] || [ ! -d "tests" ]; then
    echo "❌ Error: Must be run from the project root directory (where package.json and tests/ exist)"
    exit 1
fi

echo "🧪 Koveo Gestion - Complete Sequential Test Suite"
echo "================================================="
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

# Function to run a test directory and track results
run_test_directory() {
    local test_name="$1"
    local test_path="$2"
    local description="$3"
    
    echo -e "${BLUE}📋 Running: ${description}${NC}"
    echo "   Path: $test_path"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if npx jest "$test_path" --passWithNoTests=false --maxWorkers=1 --verbose; then
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

# Function to run individual test file
run_test_file() {
    local test_name="$1"
    local test_file="$2"
    local description="$3"
    
    echo -e "${BLUE}📋 Running: ${description}${NC}"
    echo "   File: $test_file"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if npx jest "$test_file" --passWithNoTests=false --maxWorkers=1; then
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

echo "🚀 Starting Complete Test Execution (All 227+ test files)..."
echo ""

# Phase 1: Unit Tests - Core Schema and Validation
echo "Phase 1: Unit Tests - Schema and Validation"
echo "==========================================="
run_test_directory "Unit-Bills" "tests/unit/bills*" "Bills and payment validation tests"
run_test_directory "Unit-Budget" "tests/unit/budget/" "Budget calculation and logic tests"
run_test_directory "Unit-Calendar" "tests/unit/calendar/" "Calendar functionality tests"
run_test_directory "Unit-Communication" "tests/unit/communication/" "Communication functionality unit tests"
run_test_directory "Unit-Components" "tests/unit/components/" "UI component unit tests"
run_test_directory "Unit-Demands" "tests/unit/demands/" "Demands schema and workflow tests"
run_test_directory "Unit-Documents" "tests/unit/documents/" "Document management tests"
run_test_directory "Unit-i18n" "tests/unit/i18n/" "Internationalization unit tests"
run_test_directory "Unit-Invitation" "tests/unit/invitation/" "User invitation and registration tests"
run_test_directory "Unit-Security" "tests/unit/security/" "Security validation tests"
run_test_directory "Unit-Access-Control" "tests/unit/access-control/" "Access control and permissions tests"

# Phase 2: Unit Tests - Individual Files
echo "Phase 2: Unit Tests - Individual Components"
echo "==========================================="
run_test_file "Unit-Language" "tests/unit/language.test.tsx" "Language switching and validation"
run_test_file "Unit-Schema" "tests/unit/schema.test.ts" "Database schema validation"
run_test_file "Unit-Storage" "tests/unit/storage.test.ts" "Storage interface tests"
run_test_file "Unit-Hooks" "tests/unit/hooks.test.tsx" "React hooks testing"
run_test_file "Unit-SSL" "tests/unit/ssl-service.test.ts" "SSL certificate management"
run_test_file "Unit-User-API" "tests/unit/user-api.test.ts" "User API endpoint tests"
# Additional budget unit tests
run_test_file "Unit-Budget-Page-Fixed" "tests/unit/budget-page-comprehensive-fixed.test.tsx" "Budget page comprehensive unit tests (fixed)"
run_test_file "Unit-Budget-API-Focused" "tests/unit/api/budgets-focused.test.ts" "Budget API focused unit tests"
# Note: tests/unit/api/budgets.test.ts was retired (Task #597). Its valuable
# cases are now exercised against a real DB in
# tests/integration/budgets-investments-upsert.test.ts (Task #580).
run_test_file "Unit-Budget-Calculations" "tests/unit/utils/budgetCalculations.test.ts" "Budget calculation utility tests"

# Phase 3: Integration Tests
echo "Phase 3: Integration Tests"
echo "=========================="
run_test_directory "Integration-Auth" "tests/integration/auth/" "Authentication integration tests"
run_test_directory "Integration-Demo" "tests/integration/demo*" "Demo user functionality tests"
run_test_directory "Integration-Documents" "tests/integration/document*" "Document management integration tests"
run_test_directory "Integration-Building" "tests/integration/building*" "Building management integration tests"
run_test_directory "Integration-Invitation" "tests/integration/invitation/" "User invitation integration tests"
run_test_directory "Integration-Data" "tests/integration/data-modification/" "Data modification integration tests"
run_test_directory "Integration-Demands" "tests/integration/demands/" "Demands workflow integration tests"
run_test_directory "Integration-Deployment" "tests/integration/deployment/" "Deployment validation tests"

# Phase 4: Integration Tests - Individual Files
echo "Phase 4: Integration Tests - Individual Files"
echo "============================================="
run_test_file "Integration-Database-Sync" "tests/integration/database-sync.test.ts" "Database synchronization tests"
run_test_file "Integration-Session" "tests/integration/session-persistence.test.ts" "Session persistence tests"
run_test_file "Integration-User-Invitation" "tests/integration/user-invitation.test.ts" "User invitation flow tests"
# Communication integration tests
run_test_file "Integration-Communication-API" "tests/integration/communication-api.test.ts" "Communication API integration tests"
# Budget integration tests
# Note: Several legacy budget integration files were retired (Task #609); only
# the suites that actually live in tests/integration/ are listed below.
run_test_file "Integration-Budgets-Investments-Upsert" "tests/integration/budgets-investments-upsert.test.ts" "Budget investments upsert integration tests"
run_test_file "Integration-Budget-Graph-Consistency" "tests/integration/budget-graph-consistency.test.ts" "Budget graph consistency integration tests"
run_test_file "Integration-Budget-Page-Render" "tests/integration/budget-page-render.test.tsx" "Budget page render integration tests"

# Phase 5: Page Integration Tests
echo "Phase 5: Page Integration Tests"
echo "==============================="
run_test_directory "Page-Tests" "tests/pages/" "Page functionality tests"
# Note: Communication page test already covered in Unit-Communication directory

# Phase 6: i18n and Quebec Compliance Tests
echo "Phase 6: i18n and Quebec Compliance Tests"
echo "=========================================="
run_test_directory "i18n-Website" "tests/i18n/website/" "Website internationalization tests"
run_test_directory "i18n-Integration" "tests/i18n/" "i18n integration tests"
run_test_file "Translation-Detector" "tests/translation-detector.test.ts" "Translation detection and validation"

# Phase 7: Security Tests
echo "Phase 7: Security Tests"
echo "======================"
run_test_directory "Security-Tests" "tests/security/" "Security validation and permissions tests"

# Phase 8: API Tests
echo "Phase 8: API Tests"
echo "=================="
run_test_directory "API-Tests" "tests/api/" "API endpoint and translation tests"

# Phase 9: Deployment Tests
echo "Phase 9: Deployment Tests"
echo "========================="
run_test_directory "Deployment-Tests" "tests/deployment/" "Deployment validation and health checks"

# Phase 10: Website and UI Tests
echo "Phase 10: Website and UI Tests"
echo "============================="
run_test_directory "Website-Tests" "tests/website/" "Website functionality and UI consistency tests"

# Phase 11: Component Tests
echo "Phase 11: Component Tests"
echo "========================="
run_test_directory "Component-Tests" "tests/components/" "UI component integration tests"

# Phase 12: Utility and Performance Tests
echo "Phase 12: Utility and Performance Tests"
echo "======================================="
run_test_directory "Utils-Tests" "tests/utils/" "Utility function tests"
run_test_directory "Performance-Tests" "tests/performance/" "Performance and load tests"

# Phase 13: Root Level Test Files
echo "Phase 13: Root Level Test Files"
echo "==============================="
run_test_file "Demo-Organizations" "tests/demo-organizations.test.ts" "Demo organization functionality"

# Final Summary
echo ""
echo "🏁 Complete Test Execution Finished"
echo "==================================="
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

# Provide detailed feedback
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
elif [ $FAILED_TESTS -lt 5 ]; then
    echo -e "${YELLOW}⚠️  Minor issues detected (${FAILED_TESTS} failures)${NC}"
    echo -e "   Most tests are working correctly"
    exit 1
else
    echo -e "${RED}❌ Multiple test failures detected (${FAILED_TESTS} failures)${NC}"
    echo -e "   Review the failed tests above for details"
    exit 1
fi