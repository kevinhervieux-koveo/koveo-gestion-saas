#!/bin/bash
# CI/CD Pipeline with Comprehensive Budget Testing
# Professional property management platform - Full pipeline validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}================================================${NC}"
echo -e "${PURPLE}    CI/CD Pipeline with Budget Testing${NC}"
echo -e "${PURPLE}================================================${NC}"

# Stage 1: Code Quality Checks
echo -e "\n${BLUE}Stage 1: Code Quality Checks${NC}"
echo -e "${YELLOW}Running ESLint checks...${NC}"
npm run lint:check
echo -e "${GREEN}✓ Linting passed${NC}"

echo -e "${YELLOW}Running Prettier format checks...${NC}"
npm run format:check
echo -e "${GREEN}✓ Format checks passed${NC}"

# Stage 2: Budget-Specific Testing Gates
echo -e "\n${BLUE}Stage 2: Budget Testing Gates${NC}"
bash scripts/budget-test-suite.sh gates
echo -e "${GREEN}✓ Budget testing gates passed${NC}"

# Stage 3: Comprehensive Testing Suite
echo -e "\n${BLUE}Stage 3: Comprehensive Testing Suite${NC}"
echo -e "${YELLOW}Running full test suite...${NC}"
npm run test:comprehensive
echo -e "${GREEN}✓ Comprehensive tests passed${NC}"

# Stage 4: Security Validation
echo -e "\n${BLUE}Stage 4: Security Validation${NC}"
echo -e "${YELLOW}Running security checks...${NC}"
npm run security:check
echo -e "${GREEN}✓ Security checks passed${NC}"

# Stage 5: Database Integrity
echo -e "\n${BLUE}Stage 5: Database Integrity${NC}"
echo -e "${YELLOW}Running database integrity tests...${NC}"
npm run test:db-integrity
echo -e "${GREEN}✓ Database integrity validated${NC}"

# Stage 6: Build Validation
echo -e "\n${BLUE}Stage 6: Build Validation${NC}"
echo -e "${YELLOW}Running production build...${NC}"
npm run build
echo -e "${GREEN}✓ Production build successful${NC}"

# Stage 7: Deployment Readiness
echo -e "\n${BLUE}Stage 7: Deployment Validation${NC}"
echo -e "${YELLOW}Running deployment validation...${NC}"
npm run validate:deployment
echo -e "${GREEN}✓ Deployment validation passed${NC}"

# Final Summary
echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}    CI/CD Pipeline Completed Successfully${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Code quality checks passed${NC}"
echo -e "${GREEN}✓ Budget functionality validated${NC}"
echo -e "${GREEN}✓ All tests passed${NC}"
echo -e "${GREEN}✓ Security validated${NC}"
echo -e "${GREEN}✓ Database integrity confirmed${NC}"
echo -e "${GREEN}✓ Build successful${NC}"
echo -e "${GREEN}✓ Ready for deployment${NC}"

echo -e "\n${PURPLE}Deployment is approved and ready to proceed.${NC}"