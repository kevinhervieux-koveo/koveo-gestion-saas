#!/bin/bash

# Quebec Property Management System - Security Testing Script
# Runs comprehensive security tests using Semgrep

set -e  # Exit on any error

echo "🔒 Quebec Property Management - Security Testing Suite"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if semgrep is installed
if ! command -v semgrep &> /dev/null; then
    echo -e "${RED}❌ Semgrep is not installed. Please install it first:${NC}"
    echo "   npm install -g semgrep"
    exit 1
fi

echo -e "${BLUE}ℹ️  Semgrep version: $(semgrep --version)${NC}"
echo ""

# Create reports directory
mkdir -p reports

# Run basic semgrep scan
echo -e "${YELLOW}🔍 Running Semgrep security scan...${NC}"
if semgrep --config=.semgrep.yml --json --quiet . > reports/semgrep-results.json; then
    echo -e "${GREEN}✅ Semgrep scan completed${NC}"
else
    echo -e "${RED}❌ Semgrep scan failed${NC}"
    exit 1
fi

# Run additional security rule sets
echo -e "${YELLOW}🔍 Running additional security checks...${NC}"

# OWASP Top 10 checks
if semgrep --config=p/owasp-top-ten --json --quiet . > reports/owasp-results.json 2>/dev/null; then
    echo -e "${GREEN}✅ OWASP Top 10 scan completed${NC}"
else
    echo -e "${YELLOW}⚠️  OWASP Top 10 scan skipped (rules not available)${NC}"
fi

# Security-focused checks
if semgrep --config=p/security-audit --json --quiet . > reports/security-audit-results.json 2>/dev/null; then
    echo -e "${GREEN}✅ Security audit scan completed${NC}"
else
    echo -e "${YELLOW}⚠️  Security audit scan skipped (rules not available)${NC}"
fi

# React/TypeScript specific security checks
if semgrep --config=p/react --json --quiet . > reports/react-security-results.json 2>/dev/null; then
    echo -e "${GREEN}✅ React security scan completed${NC}"
else
    echo -e "${YELLOW}⚠️  React security scan skipped (rules not available)${NC}"
fi

# Run Jest security tests
echo -e "${YELLOW}🧪 Running Jest security tests...${NC}"
if npm test -- tests/security/semgrep-security.test.js --verbose; then
    echo -e "${GREEN}✅ Security tests passed${NC}"
else
    echo -e "${RED}❌ Security tests failed${NC}"
    exit 1
fi

# Generate summary report
echo -e "${YELLOW}📊 Generating security summary...${NC}"

# Count issues by severity
CRITICAL_COUNT=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' reports/semgrep-results.json 2>/dev/null || echo "0")
WARNING_COUNT=$(jq '[.results[] | select(.extra.severity == "WARNING")] | length' reports/semgrep-results.json 2>/dev/null || echo "0")
INFO_COUNT=$(jq '[.results[] | select(.extra.severity == "INFO")] | length' reports/semgrep-results.json 2>/dev/null || echo "0")
TOTAL_COUNT=$(jq '[.results[]] | length' reports/semgrep-results.json 2>/dev/null || echo "0")

echo ""
echo -e "${BLUE}🔒 SECURITY SCAN SUMMARY${NC}"
echo "========================"
echo -e "Total Issues: ${TOTAL_COUNT}"
echo -e "🔴 Critical: ${CRITICAL_COUNT}"
echo -e "🟡 Warnings: ${WARNING_COUNT}"
echo -e "ℹ️  Info: ${INFO_COUNT}"
echo ""

# Check if critical issues exist
if [ "$CRITICAL_COUNT" -gt "0" ]; then
    echo -e "${RED}❌ CRITICAL SECURITY ISSUES FOUND!${NC}"
    echo -e "${RED}   Please review and fix all critical issues before deployment.${NC}"
    echo -e "${YELLOW}   Check reports/semgrep-results.json for detailed information.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ No critical security issues found${NC}"
fi

# Quebec Law 25 compliance check
LAW25_COUNT=$(jq '[.results[] | select(.extra.metadata.law25 or .extra.metadata.quebec_law25)] | length' reports/semgrep-results.json 2>/dev/null || echo "0")
echo -e "${BLUE}📋 Quebec Law 25 Compliance Items: ${LAW25_COUNT}${NC}"

# Property management specific checks
PROPERTY_COUNT=$(jq '[.results[] | select(.extra.metadata.domain == "property-management")] | length' reports/semgrep-results.json 2>/dev/null || echo "0")
echo -e "${BLUE}🏢 Property Management Security Items: ${PROPERTY_COUNT}${NC}"

echo ""
echo -e "${GREEN}✅ Security testing completed successfully!${NC}"
echo -e "${BLUE}📄 Reports saved in ./reports/ directory${NC}"

# List all generated reports
echo ""
echo "Generated reports:"
ls -la reports/*.json 2>/dev/null || echo "No JSON reports found"

echo ""
echo -e "${GREEN}🎉 Security validation complete for Quebec Property Management System${NC}"