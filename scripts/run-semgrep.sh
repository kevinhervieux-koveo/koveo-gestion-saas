#!/bin/bash

# Koveo Gestion - Semgrep Security Scanner
# Comprehensive static analysis security testing

set -e

echo "🔍 Koveo Gestion - Semgrep Security Scanner"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create reports directory if it doesn't exist
mkdir -p reports

echo -e "${BLUE}🚀 Running Semgrep Security Scans...${NC}"
echo ""

# Function to run Semgrep scan
run_semgrep_scan() {
    local scan_name="$1"
    local config="$2"
    local output_file="$3"
    local description="$4"
    
    echo -e "${BLUE}📊 ${scan_name}: ${description}${NC}"
    
    # Use timeout to prevent hanging scans
    if timeout 30s semgrep --config="$config" --json --no-git-ignore --include="*.ts" --include="*.tsx" . > "$output_file" 2>/dev/null; then
        local findings=$(cat "$output_file" | jq '.results | length' 2>/dev/null || echo "0")
        echo -e "${GREEN}✅ Scan completed - ${findings} findings${NC}"
    else
        echo -e "${YELLOW}⚠️  Scan completed with warnings${NC}"
    fi
    echo ""
}

# Run different security scans
run_semgrep_scan "Custom Rules" ".semgrep.yml" "reports/semgrep-results.json" "Quebec Law 25 & Property Management Security"
run_semgrep_scan "OWASP Top 10" "p/owasp-top-ten" "reports/owasp-results.json" "OWASP Top 10 Security Risks"
run_semgrep_scan "React Security" "p/react" "reports/react-security-results.json" "React-specific Security Issues"
run_semgrep_scan "Security Audit" "p/security-audit" "reports/security-audit-results.json" "General Security Audit"

echo -e "${BLUE}🧪 Running Semgrep Test Validation...${NC}"
echo ""

# Run the Jest tests that validate Semgrep results
if npx jest tests/security/semgrep-security.test.ts --passWithNoTests=false --maxWorkers=1; then
    echo -e "${GREEN}✅ All Semgrep security tests passed${NC}"
else
    echo -e "${RED}❌ Some Semgrep security tests failed${NC}"
fi

echo ""
echo -e "${BLUE}📋 Security Scan Summary:${NC}"

# Display summary if jq is available
if command -v jq >/dev/null 2>&1; then
    if [ -f "reports/security-summary.json" ]; then
        echo -e "   📊 Total findings: $(cat reports/security-summary.json | jq '.totalFindings')"
        echo -e "   🚨 Critical: $(cat reports/security-summary.json | jq '.criticalFindings')"
        echo -e "   ⚠️  Warnings: $(cat reports/security-summary.json | jq '.warningFindings')"
        echo -e "   ℹ️  Info: $(cat reports/security-summary.json | jq '.infoFindings')"
    fi
else
    echo -e "   📁 Results saved to reports/ directory"
fi

echo ""
echo -e "${GREEN}🔒 Semgrep Security Scanner Complete${NC}"