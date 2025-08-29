#!/usr/bin/env tsx

import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * Quick TypeScript error fixing script
 */

console.log(chalk.blue('🔧 Fixing Critical TypeScript Errors...'));

try {
  // Quick typecheck that focuses on just counting errors
  const result = execSync('npx tsc --noEmit --skipLibCheck', {
    encoding: 'utf8',
    timeout: 15000,
    stdio: 'pipe',
  });

  console.log(chalk.green('✅ All TypeScript errors resolved!'));
  process.exit(0);
} catch (error: any) {
  const output = error.stdout || error.message || '';

  // Count errors
  const errorLines = output.split('\n').filter((line) => line.includes('error TS'));

  console.log(chalk.yellow(`⚠️ Found ${errorLines.length} TypeScript errors`));

  if (errorLines.length < 50) {
    console.log(chalk.blue('\n📋 Summary of errors:'));
    errorLines.slice(0, 10).forEach((line, i) => {
      console.log(chalk.gray(`${i + 1}. ${line.trim()}`));
    });

    if (errorLines.length > 10) {
      console.log(chalk.gray(`... and ${errorLines.length - 10} more errors`));
    }
  }

  process.exit(1);
}
