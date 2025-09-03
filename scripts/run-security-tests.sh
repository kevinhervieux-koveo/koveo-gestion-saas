#!/bin/bash

# Koveo Gestion - Security Test Suite
# Runs comprehensive security validation tests

set +e  # Don't exit on first failure

echo "🔒 Koveo Gestion - Security Test Suite"
echo "======================================"
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

# Function to run security test
run_security_test() {
    local test_name="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "${BLUE}🔍 Running: ${description}${NC}"
    echo "   Command: $test_command"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: ${test_name}${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: ${test_name}${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

echo "🚀 Starting Security Test Execution..."
echo ""

# Security Test Categories
run_security_test "Security-Permissions" "npx jest tests/security/database-permissions.test.ts --passWithNoTests=false --maxWorkers=1" "Database permissions and access control"
run_security_test "Security-Demo-User" "npx jest tests/security/comprehensive-demo-user-security.test.ts --passWithNoTests=false --maxWorkers=1" "Demo user security restrictions"
run_security_test "Security-Headers" "npx jest tests/unit/security/security-headers.test.ts --passWithNoTests=false --maxWorkers=1" "Security headers validation"
run_security_test "Security-Auth" "npx jest tests/unit/auth/ --passWithNoTests=false --maxWorkers=1" "Authentication security tests"
run_security_test "Security-RBAC" "npx jest tests/unit/auth/rbac-comprehensive.test.ts --passWithNoTests=false --maxWorkers=1" "Role-based access control security"

# Quebec Law 25 Compliance
run_security_test "Quebec-Law25" "npx jest tests/unit/i18n/quebec-compliance.test.ts --passWithNoTests=false --maxWorkers=1" "Quebec Law 25 compliance validation"

# Data Protection Tests
run_security_test "Data-Protection" "npx jest tests/unit/documents/document-security.test.ts --passWithNoTests=false --maxWorkers=1" "Document security and data protection"

# Final Summary
echo ""
echo "🏁 Security Test Execution Complete"
echo "==================================="
echo ""
echo -e "📊 Security Results Summary:"
echo -e "   ${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
echo -e "   ${RED}❌ Failed: ${FAILED_TESTS}${NC}"
echo -e "   📋 Total: ${TOTAL_TESTS}"
echo ""

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "📈 Security Success Rate: ${SUCCESS_RATE}%"
else
    echo -e "❌ No security tests were executed"
fi

echo ""

# Security-specific exit codes
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🔒 All security tests passed - System is secure!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Security issues detected (${FAILED_TESTS} failures)${NC}"
    echo -e "   ${RED}🚨 IMMEDIATE ATTENTION REQUIRED${NC}"
    echo -e "   Review security test failures above"
    exit 1
fi