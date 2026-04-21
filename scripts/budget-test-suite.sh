#!/bin/bash
# Budget Testing Suite for CI/CD Pipeline
# Professional property management platform - Budget functionality validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COVERAGE_THRESHOLD=85
BUDGET_COVERAGE_THRESHOLD=90

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Budget Testing Suite Started${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to run budget unit tests
run_budget_unit_tests() {
    echo -e "\n${YELLOW}Running Budget Unit Tests...${NC}"
    
    npm run test:unit -- \
        tests/unit/api/budgets.test.ts \
        tests/unit/utils/budgetCalculations.test.ts \
        tests/unit/budget-page-comprehensive.test.tsx \
        --verbose \
        --passWithNoTests=false
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Budget unit tests passed${NC}"
    else
        echo -e "${RED}✗ Budget unit tests failed${NC}"
        exit 1
    fi
}

# Function to run budget integration tests
run_budget_integration_tests() {
    echo -e "\n${YELLOW}Running Budget Integration Tests...${NC}"
    
    npm run test:integration -- \
        tests/integration/budgets.forecast.test.ts \
        --testTimeout=20000 \
        --passWithNoTests=false
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Budget integration tests passed${NC}"
    else
        echo -e "${RED}✗ Budget integration tests failed${NC}"
        exit 1
    fi
}

# Function to run comprehensive budget tests
run_budget_comprehensive_tests() {
    echo -e "\n${YELLOW}Running Comprehensive Budget Tests...${NC}"
    
    npx jest --config jest.budget.config.js --verbose
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Comprehensive budget tests passed${NC}"
    else
        echo -e "${RED}✗ Comprehensive budget tests failed${NC}"
        exit 1
    fi
}

# Function to run budget coverage tests
run_budget_coverage_tests() {
    echo -e "\n${YELLOW}Running Budget Coverage Tests...${NC}"
    
    npx jest --config jest.budget.config.js \
        --coverage \
        --coverageReporters=text \
        --coverageReporters=lcov \
        --coverageReporters=html \
        --coverageDirectory=coverage/budget \
        --coverageThreshold="{\"global\":{\"branches\":${BUDGET_COVERAGE_THRESHOLD},\"functions\":${BUDGET_COVERAGE_THRESHOLD},\"lines\":${BUDGET_COVERAGE_THRESHOLD},\"statements\":${BUDGET_COVERAGE_THRESHOLD}}}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Budget coverage tests passed (${BUDGET_COVERAGE_THRESHOLD}% threshold)${NC}"
    else
        echo -e "${RED}✗ Budget coverage tests failed - coverage below ${BUDGET_COVERAGE_THRESHOLD}%${NC}"
        exit 1
    fi
}

# Function to validate budget test results
validate_budget_results() {
    echo -e "\n${YELLOW}Validating Budget Test Results...${NC}"
    
    # Check if coverage reports exist
    if [ -d "coverage/budget" ]; then
        echo -e "${GREEN}✓ Budget coverage reports generated${NC}"
    else
        echo -e "${RED}✗ Budget coverage reports missing${NC}"
        exit 1
    fi
    
    # Check if test results XML exists
    if [ -f "coverage/budget/budget-test-results.xml" ]; then
        echo -e "${GREEN}✓ Budget test results XML generated${NC}"
    else
        echo -e "${YELLOW}! Budget test results XML not found (non-critical)${NC}"
    fi
}

# Main execution based on command line arguments
case "${1:-all}" in
    "unit")
        run_budget_unit_tests
        ;;
    "integration")
        run_budget_integration_tests
        ;;
    "comprehensive")
        run_budget_comprehensive_tests
        ;;
    "coverage")
        run_budget_coverage_tests
        validate_budget_results
        ;;
    "gates"|"pre-deployment")
        echo -e "\n${BLUE}Running Pre-Deployment Budget Gates...${NC}"
        run_budget_unit_tests
        run_budget_integration_tests
        run_budget_coverage_tests
        validate_budget_results
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}   Budget Gates Passed - Deploy Ready${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;
    "all"|*)
        echo -e "\n${BLUE}Running Complete Budget Test Suite...${NC}"
        run_budget_unit_tests
        run_budget_integration_tests
        run_budget_comprehensive_tests
        run_budget_coverage_tests
        validate_budget_results
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}  Budget Test Suite Completed Successfully${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;
esac

echo -e "\n${BLUE}Budget testing suite execution completed.${NC}"