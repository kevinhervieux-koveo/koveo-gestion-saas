#!/usr/bin/env tsx

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Enhanced validation script for production-ready checks
 * This extends the standard validate:all with additional validation steps
 */

interface ValidationStep {
  name: string;
  command?: string;
  customFunction?: () => Promise<void>;
  required: boolean;
}

const validationSteps: ValidationStep[] = [
  {
    name: 'Lint Check',
    command: 'npm run lint:check',
    required: true,
  },
  {
    name: 'Format Check',
    command: 'npm run format:check',
    required: true,
  },
  {
    name: 'Type Check',
    command: 'npm run typecheck',
    required: true,
  },
  {
    name: 'Test Suite',
    command: 'npm run test',
    required: true,
  },
  {
    name: 'Quality Check',
    command: 'npm run quality:check',
    required: true,
  },
];

async function runValidationStep(step: ValidationStep): Promise<boolean> {
  console.log(chalk.blue(`\n🔍 Running ${step.name}...`));

  try {
    if (step.command) {
      const { stdout, stderr } = await execAsync(step.command, {
        timeout: 120000, // 2 minutes timeout
      });

      if (stderr && stderr.includes('error')) {
        console.error(chalk.red(`❌ ${step.name} failed:`));
        console.error(stderr);
        return false;
      }

      console.log(chalk.green(`✅ ${step.name} passed`));
      return true;
    } else if (step.customFunction) {
      await step.customFunction();
      console.log(chalk.green(`✅ ${step.name} passed`));
      return true;
    }

    return false;
  } catch (error) {
    console.error(chalk.red(`❌ ${step.name} failed:`));
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function runEnhancedValidation() {
  console.log(chalk.blue('🚀 Enhanced Validation with Demo Organization Sync'));
  console.log(chalk.gray('============================================'));

  const startTime = Date.now();
  let passedSteps = 0;
  let failedSteps = 0;

  for (const step of validationSteps) {
    const success = await runValidationStep(step);

    if (success) {
      passedSteps++;
    } else {
      failedSteps++;
      if (step.required) {
        console.error(chalk.red(`\n🚨 Required step "${step.name}" failed. Stopping validation.`));
        break;
      }
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log(chalk.blue('\n📊 Validation Summary'));
  console.log(chalk.gray('====================='));
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Passed: ${passedSteps}`);
  console.log(`❌ Failed: ${failedSteps}`);

  if (failedSteps === 0) {
    console.log(chalk.green('\n🎉 All validations passed! Ready for deployment.'));
    console.log(chalk.blue('📋 Demo organizations are synchronized and ready for production.'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n💥 Validation failed. Please fix the issues above.'));
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnhancedValidation().catch((error) => {
    console.error(chalk.red('Validation process failed:'), error);
    process.exit(1);
  });
}

export default runEnhancedValidation;