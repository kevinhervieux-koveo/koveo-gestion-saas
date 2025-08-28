#!/usr/bin/env tsx

/**
 * Safe Validation Script
 * Runs validation without affecting production database
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

// Set safe environment variables
process.env.NODE_ENV = 'test';
process.env.SKIP_DB_OPERATIONS = 'true';
delete process.env.DATABASE_URL; // Remove production database URL for safety

interface ValidationStep {
  name: string;
  command?: string;
  customFunction?: () => Promise<void>;
  required: boolean;
}

const validationSteps: ValidationStep[] = [
  {
    name: 'TypeScript Check',
    command: 'npx tsc --noEmit --skipLibCheck',
    required: true,
  },
  {
    name: 'Frontend Build Test',
    command: 'npm run build:client',
    required: true,
  },
];

async function runValidationStep(step: ValidationStep): Promise<boolean> {
  console.log(chalk.blue(`\n🔍 Running ${step.name}...`));

  try {
    if (step.command) {
      const env = {
        ...process.env,
        NODE_ENV: 'test',
        SKIP_DB_OPERATIONS: 'true',
        DATABASE_URL: undefined,
      };

      const { stdout, stderr } = await execAsync(step.command, {
        timeout: 120000,
        env,
      });

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

async function runSafeValidation() {
  console.log(chalk.blue('🛡️  Safe Validation (Production Database Protected)'));
  console.log(chalk.gray('==================================================='));
  console.log(chalk.yellow('⚠️  DATABASE_URL removed for safety'));
  console.log(chalk.yellow('⚠️  Running in test mode to prevent production changes\n'));

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

  console.log(chalk.blue('\n📊 Safe Validation Summary'));
  console.log(chalk.gray('==========================='));
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✅ Passed: ${passedSteps}`);
  console.log(`❌ Failed: ${failedSteps}`);

  if (failedSteps === 0) {
    console.log(chalk.green('\n🎉 All safe validations passed!'));
    console.log(chalk.blue('✅ Core functionality validated without database risks'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n💥 Validation failed. Please fix the issues above.'));
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSafeValidation().catch((error) => {
    console.error(chalk.red('Safe validation process failed:'), error);
    process.exit(1);
  });
}

export default runSafeValidation;