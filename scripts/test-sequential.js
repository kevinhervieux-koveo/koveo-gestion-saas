#!/usr/bin/env node

/**
 * Koveo Gestion - Sequential Test Runner (Node.js version)
 * Runs all tests in logical sequence to avoid timeouts
 */

import { spawn } from 'child_process';
import { createWriteStream } from 'fs';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

const testPhases = [
  {
    name: '🏗️  Foundation Tests',
    groups: [
      { name: 'Schema Validation', pattern: 'tests/unit/schema.test.ts tests/unit/form-validation.test.ts', timeout: 10000 },
      { name: 'Core Utils', pattern: 'tests/unit/utils.test.ts tests/unit/storage.test.ts', timeout: 10000 }
    ]
  },
  {
    name: '🧪 Unit Tests',
    groups: [
      { name: 'Authentication & Authorization', pattern: 'tests/unit/auth/', timeout: 15000 },
      { name: 'Database Operations', pattern: 'tests/unit/db/', timeout: 15000 },
      { name: 'Demands Management', pattern: 'tests/unit/demands/', timeout: 15000 },
      { name: 'Budget Management', pattern: 'tests/unit/budget/', timeout: 20000 },
      { name: 'Services & Hooks', pattern: 'tests/unit/hooks/ tests/unit/*-service.test.ts', timeout: 15000 }
    ]
  },
  {
    name: '🎨 UI Component Tests',
    groups: [
      { name: 'Core Components', pattern: 'tests/unit/components/', timeout: 20000 },
      { name: 'Dashboard Components', pattern: 'tests/unit/dashboard-components.test.tsx tests/unit/ui-components.test.tsx', timeout: 20000 },
      { name: 'Page Components', pattern: 'tests/unit/buildings-page.test.tsx tests/unit/bills-components.test.tsx', timeout: 20000 },
      { name: 'Registration Flow', pattern: 'tests/unit/invitation/', timeout: 25000 }
    ]
  },
  {
    name: '🔗 Integration Tests',
    groups: [
      { name: 'API Integration', pattern: 'tests/integration/', timeout: 25000 },
      { name: 'API Endpoints', pattern: 'tests/api/', timeout: 20000 }
    ]
  },
  {
    name: '🔒 Security & Compliance',
    groups: [
      { name: 'Security Tests', pattern: 'tests/security/', timeout: 20000 },
      { name: 'Quebec Compliance', pattern: 'tests/unit/i18n/quebec-compliance.test.ts tests/unit/quebec-business-logic.test.ts', timeout: 15000 },
      { name: 'Language Validation', pattern: 'tests/unit/i18n/ tests/unit/language-validation.test.ts', timeout: 15000 }
    ]
  },
  {
    name: '⚡ Performance & Quality',
    groups: [
      { name: 'Performance Tests', pattern: 'tests/performance/', timeout: 30000 },
      { name: 'Code Analysis', pattern: 'tests/code-analysis/', timeout: 30000 },
      { name: 'Quality Metrics', pattern: 'tests/unit/quality-metrics.test.ts', timeout: 15000 }
    ]
  },
  {
    name: '🌐 End-to-End Tests',
    groups: [
      { name: 'System Tests', pattern: 'tests/system/', timeout: 35000 },
      { name: 'E2E Tests', pattern: 'tests/e2e/', timeout: 40000 },
      { name: 'Mobile Tests', pattern: 'tests/mobile/', timeout: 25000 },
      { name: 'UI Tests', pattern: 'tests/ui/', timeout: 30000 }
    ]
  }
];

function runTest(groupName, pattern, timeout) {
  return new Promise((resolve, reject) => {
    console.log(`\n${colors.blue}🏃 Running ${groupName}...${colors.reset}`);
    console.log('----------------------------------------');

    const args = [
      '--', 
      ...pattern.split(' '),
      `--testTimeout=${timeout}`,
      '--maxWorkers=1',
      '--passWithNoTests'
    ];

    const jest = spawn('npm', ['run', 'jest', ...args], {
      stdio: 'inherit',
      shell: true
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✅ ${groupName} completed successfully${colors.reset}`);
        resolve();
      } else {
        console.log(`${colors.red}❌ ${groupName} failed${colors.reset}`);
        reject(new Error(`Test group ${groupName} failed with code ${code}`));
      }
    });

    jest.on('error', (error) => {
      console.log(`${colors.red}❌ ${groupName} error: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
}

async function runSequentialTests() {
  console.log(`${colors.yellow}🚀 Starting Sequential Test Suite...${colors.reset}`);
  console.log('========================================');

  const results = [];
  
  try {
    for (let i = 0; i < testPhases.length; i++) {
      const phase = testPhases[i];
      console.log(`\n${colors.yellow}PHASE ${i + 1}: ${phase.name}${colors.reset}`);
      
      for (const group of phase.groups) {
        await runTest(group.name, group.pattern, group.timeout);
        results.push({ phase: phase.name, group: group.name, status: 'passed' });
      }
    }

    console.log(`\n${colors.green}🎉 All test phases completed successfully!${colors.reset}`);
    console.log('========================================');
    console.log(`${colors.blue}📊 Test Summary:${colors.reset}`);
    
    testPhases.forEach((phase, index) => {
      console.log(`• Phase ${index + 1}: ${phase.name} ✅`);
    });
    
    console.log(`\n${colors.green}🚀 Your Koveo Gestion test suite is solid!${colors.reset}`);
    
  } catch (error) {
    console.log(`\n${colors.red}💥 Test suite failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSequentialTests();
}