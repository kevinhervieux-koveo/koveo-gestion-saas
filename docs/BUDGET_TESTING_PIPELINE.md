# Budget Testing Pipeline Documentation

## Overview
This document outlines the comprehensive budget testing suite integrated into the CI/CD pipeline for the professional property management platform.

## Budget Testing Implementation

### 1. Test Scripts Created

#### `scripts/budget-test-suite.sh`
- **Purpose**: Comprehensive budget testing execution
- **Commands**:
  - `bash scripts/budget-test-suite.sh unit` - Run budget unit tests only
  - `bash scripts/budget-test-suite.sh integration` - Run budget integration tests only
  - `bash scripts/budget-test-suite.sh comprehensive` - Run comprehensive budget tests
  - `bash scripts/budget-test-suite.sh coverage` - Run budget coverage tests
  - `bash scripts/budget-test-suite.sh gates` - Run pre-deployment budget gates
  - `bash scripts/budget-test-suite.sh all` - Run complete budget test suite

#### `scripts/ci-cd-budget-pipeline.sh`
- **Purpose**: Full CI/CD pipeline with budget testing integration
- **Stages**:
  1. Code quality checks (lint, format)
  2. Budget testing gates
  3. Comprehensive testing suite
  4. Security validation
  5. Database integrity
  6. Build validation
  7. Deployment readiness

#### `scripts/budget-test-watcher.sh`
- **Purpose**: Development mode file watcher for budget tests
- **Features**: Automatically runs budget tests when budget-related files change

### 2. Required .replit Configuration Updates

Since the .replit file cannot be edited directly, here are the workflows that should be added:

```toml
# Budget Testing Suite Workflows
[[workflows.workflow]]
name = "Budget Unit Tests"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash scripts/budget-test-suite.sh unit"

[[workflows.workflow]]
name = "Budget Integration Tests"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash scripts/budget-test-suite.sh integration"

[[workflows.workflow]]
name = "Budget Comprehensive Tests"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash scripts/budget-test-suite.sh comprehensive"

[[workflows.workflow]]
name = "Budget Coverage Tests"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash scripts/budget-test-suite.sh coverage"

[[workflows.workflow]]
name = "Pre-Deployment Budget Gates"
author = "agent"
mode = "sequential"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Budget Unit Tests"

[[workflows.workflow.tasks]]
task = "workflow.run" 
args = "Budget Integration Tests"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Budget Coverage Tests"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "echo 'Budget test gates passed - deployment ready'"

[[workflows.workflow]]
name = "Complete Budget Test Suite"
author = "agent"
mode = "sequential"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash scripts/budget-test-suite.sh all"

[[workflows.workflow]]
name = "CI/CD Pipeline with Budget Tests"
author = "agent"
mode = "sequential"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "bash scripts/ci-cd-budget-pipeline.sh"
```

### 3. Test Coverage Requirements

#### Global Coverage Thresholds
- Branches: 85%
- Functions: 90%
- Lines: 90%
- Statements: 90%

#### Budget-Specific Coverage Thresholds
- Branches: 90%
- Functions: 95%
- Lines: 95%
- Statements: 95%

### 4. Test Execution Commands

#### Individual Budget Tests
```bash
# Unit tests for budget functionality
npm run test:unit -- tests/unit/api/budgets-focused.test.ts tests/unit/utils/budgetCalculations.test.ts tests/unit/budget-page-comprehensive-fixed.test.tsx

# Real-DB coverage for the upsert path (replaces the retired
# tests/unit/api/budgets.test.ts shell — see Task #597 / Task #580):
npm run test:integration -- tests/integration/budgets-investments-upsert.test.ts

# Integration tests for budget forecasting
npm run test:integration -- tests/integration/budgets.forecast.test.ts

# Comprehensive budget tests with custom config
npx jest --config jest.budget.config.js

# Budget coverage tests
npx jest --config jest.budget.config.js --coverage
```

#### Pipeline Commands
```bash
# Run pre-deployment budget gates
bash scripts/budget-test-suite.sh gates

# Run complete budget test suite
bash scripts/budget-test-suite.sh all

# Run full CI/CD pipeline with budget tests
bash scripts/ci-cd-budget-pipeline.sh

# Start budget test watcher for development
bash scripts/budget-test-watcher.sh
```

### 5. Pre-Deployment Gates

The budget testing pipeline includes mandatory pre-deployment gates:

1. **Budget Unit Tests**: Must pass all budget calculation and API tests
2. **Budget Integration Tests**: Must pass budget forecasting integration tests
3. **Budget Coverage Tests**: Must meet 90% coverage threshold for budget files
4. **Code Quality**: Must pass linting and formatting checks
5. **Security Validation**: Must pass security checks
6. **Build Validation**: Must successfully build for production

### 6. File Monitoring

Budget test watcher monitors these file patterns:
- `server/api/budgets.ts`
- `server/utils/budgetCalculations.ts`
- `client/src/pages/manager/budget.tsx`
- `client/src/components/**/budget*.tsx`
- `client/src/components/**/Budget*.tsx`
- All budget test files

### 7. Integration with Existing Pipeline

The budget testing suite integrates with existing npm scripts:
- Leverages existing `test:unit` and `test:integration` commands
- Uses custom `jest.budget.config.js` for focused testing
- Integrates with `test:comprehensive` for full validation
- Works with existing security and validation scripts

## Usage Instructions

### For Development
```bash
# Start budget test watcher
bash scripts/budget-test-watcher.sh
```

### For CI/CD
```bash
# Run pre-deployment validation
bash scripts/budget-test-suite.sh gates

# Run complete pipeline
bash scripts/ci-cd-budget-pipeline.sh
```

### For Manual Testing
```bash
# Test specific budget functionality
bash scripts/budget-test-suite.sh unit
bash scripts/budget-test-suite.sh integration
bash scripts/budget-test-suite.sh coverage
```

## Benefits

1. **Focused Testing**: Budget-specific test configuration isolates budget functionality
2. **Coverage Assurance**: Higher coverage thresholds for critical budget features
3. **Pre-Deployment Safety**: Mandatory gates prevent deployment of broken budget features
4. **Developer Productivity**: File watcher provides immediate feedback during development
5. **CI/CD Integration**: Seamless integration with existing pipeline infrastructure

## Maintenance

- Update `config/budget-test-config.json` when adding new budget test files
- Modify `jest.budget.config.js` for budget-specific test configuration changes
- Update file patterns in `budget-test-watcher.sh` when adding new budget components