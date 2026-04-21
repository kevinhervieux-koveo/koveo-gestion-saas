#!/bin/bash
# Budget Test Watcher for Development
# Continuously monitors budget-related files and runs tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Budget Test Watcher Started${NC}"
echo -e "${YELLOW}Monitoring budget-related files for changes...${NC}"

# Files to watch for budget functionality
BUDGET_FILES=(
    "server/api/budgets.ts"
    "server/utils/budgetCalculations.ts"
    "client/src/pages/manager/budget.tsx"
    "client/src/components/**/budget*.tsx"
    "client/src/components/**/Budget*.tsx"
    "tests/unit/api/budgets.test.ts"
    "tests/unit/utils/budgetCalculations.test.ts"
    "tests/unit/budget-page-comprehensive.test.tsx"
    "tests/integration/budgets.forecast.test.ts"
)

# Function to run budget tests on file change
run_budget_tests_on_change() {
    echo -e "\n${YELLOW}Files changed - running budget tests...${NC}"
    
    # Run quick budget unit tests first
    npm run test:unit -- \
        tests/unit/api/budgets.test.ts \
        tests/unit/utils/budgetCalculations.test.ts \
        --silent \
        --passWithNoTests=false
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Budget unit tests passed${NC}"
        
        # Run comprehensive budget tests if unit tests pass
        npx jest --config jest.budget.config.js --silent
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ All budget tests passed${NC}"
        else
            echo -e "${RED}✗ Some budget tests failed${NC}"
        fi
    else
        echo -e "${RED}✗ Budget unit tests failed${NC}"
    fi
    
    echo -e "${BLUE}Watching for changes...${NC}"
}

# Initial test run
echo -e "${YELLOW}Running initial budget test suite...${NC}"
bash scripts/budget-test-suite.sh all

# Watch for file changes
if command -v inotifywait > /dev/null; then
    # Use inotifywait if available (Linux)
    while inotifywait -r -e modify,create,delete \
        server/api/ \
        server/utils/ \
        client/src/pages/manager/ \
        client/src/components/ \
        tests/unit/ \
        tests/integration/ \
        --include=".*budget.*|.*Budget.*|budgets.*" \
        2>/dev/null; do
        run_budget_tests_on_change
    done
elif command -v fswatch > /dev/null; then
    # Use fswatch if available (macOS)
    fswatch -o \
        server/api/ \
        server/utils/ \
        client/src/pages/manager/ \
        client/src/components/ \
        tests/unit/ \
        tests/integration/ | while read; do
        run_budget_tests_on_change
    done
else
    # Fallback polling method
    echo -e "${YELLOW}File watchers not available, using polling mode...${NC}"
    
    while true; do
        sleep 5
        
        # Check if any budget files have been modified in the last 5 seconds
        RECENT_CHANGES=$(find server/api/ server/utils/ client/src/ tests/ \
            -name "*budget*" -o -name "*Budget*" -o -name "budgets*" \
            -newermt '5 seconds ago' 2>/dev/null | head -1)
        
        if [ ! -z "$RECENT_CHANGES" ]; then
            run_budget_tests_on_change
        fi
    done
fi