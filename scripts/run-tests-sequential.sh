#!/bin/bash

# Koveo Gestion - Sequential Test Runner
# Runs all tests in logical sequence to avoid timeouts

set -e  # Exit on any error

echo "🚀 Starting Sequential Test Suite..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run test group with error handling
run_test_group() {
    local group_name="$1"
    local test_pattern="$2"
    local timeout="$3"
    
    echo -e "\n${BLUE}🏃 Running $group_name...${NC}"
    echo "----------------------------------------"
    
    if npx jest $test_pattern --testTimeout=$timeout --maxWorkers=1 --passWithNoTests; then
        echo -e "${GREEN}✅ $group_name completed successfully${NC}"
    else
        echo -e "${RED}❌ $group_name failed${NC}"
        exit 1
    fi
}

# 1. Foundation Tests (Schema, Core Logic)
echo -e "\n${YELLOW}🏗️  PHASE 1: Foundation Tests${NC}"
run_test_group "Schema Validation" "tests/unit/schema.test.ts tests/unit/form-validation.test.ts" "10000"
run_test_group "Core Utils" "tests/unit/utils.test.ts tests/unit/storage.test.ts" "10000"

# 2. Unit Tests (Services, Business Logic)
echo -e "\n${YELLOW}🧪 PHASE 2: Unit Tests${NC}"
run_test_group "Authentication & Authorization" "tests/unit/auth/" "15000"
run_test_group "Database Operations" "tests/unit/db/" "15000"
run_test_group "Demands Management" "tests/unit/demands/" "15000"
run_test_group "Budget Management" "tests/unit/budget/" "20000"
run_test_group "Hooks & Services" "tests/unit/hooks/ tests/unit/*-service.test.ts" "15000"

# 3. Component Tests
echo -e "\n${YELLOW}🎨 PHASE 3: UI Component Tests${NC}"
run_test_group "Core Components" "tests/unit/components/" "20000"
run_test_group "Dashboard Components" "tests/unit/dashboard-components.test.tsx tests/unit/ui-components.test.tsx" "20000"
run_test_group "Page Components" "tests/unit/buildings-page.test.tsx tests/unit/bills-components.test.tsx" "20000"
run_test_group "User Registration" "tests/unit/invitation/" "25000"

# 4. API Integration Tests  
echo -e "\n${YELLOW}🔗 PHASE 4: Integration Tests${NC}"
run_test_group "API Integration" "tests/integration/" "25000"
run_test_group "API Endpoints" "tests/api/" "20000"

# 5. Security & Compliance Tests
echo -e "\n${YELLOW}🔒 PHASE 5: Security & Compliance${NC}"
run_test_group "Security Tests" "tests/security/" "20000"
run_test_group "Quebec Compliance" "tests/unit/i18n/quebec-compliance.test.ts tests/unit/quebec-business-logic.test.ts" "15000"
run_test_group "Language Validation" "tests/unit/i18n/ tests/unit/language-validation.test.ts" "15000"

# 6. Performance & Quality Tests
echo -e "\n${YELLOW}⚡ PHASE 6: Performance & Quality${NC}"
run_test_group "Performance Tests" "tests/performance/" "30000"
run_test_group "Code Analysis" "tests/code-analysis/" "30000"
run_test_group "Quality Metrics" "tests/unit/quality-metrics.test.ts" "15000"

# 7. System & E2E Tests
echo -e "\n${YELLOW}🌐 PHASE 7: End-to-End Tests${NC}"
run_test_group "System Tests" "tests/system/" "35000"
run_test_group "E2E Tests" "tests/e2e/" "40000"

# 8. Specialized Tests
echo -e "\n${YELLOW}🎯 PHASE 8: Specialized Tests${NC}"
run_test_group "Mobile Tests" "tests/mobile/" "25000"
run_test_group "UI Tests" "tests/ui/" "30000"
run_test_group "Routing Tests" "tests/routing/" "15000"

echo -e "\n${GREEN}🎉 All test phases completed successfully!${NC}"
echo "========================================"
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "• Foundation Tests ✅"
echo "• Unit Tests ✅"
echo "• Component Tests ✅"
echo "• Integration Tests ✅"
echo "• Security & Compliance ✅"
echo "• Performance & Quality ✅"
echo "• End-to-End Tests ✅"
echo "• Specialized Tests ✅"
echo ""
echo -e "${GREEN}🚀 Your Koveo Gestion test suite is solid!${NC}"