#!/usr/bin/env npx tsx

/**
 * @file Redundancy Analysis Script (deprecated stub).
 * @description This script previously executed the Jest suites under
 * `tests/code-analysis/` (`redundancy-detection.test.ts`,
 * `ui-component-redundancy.test.ts`, `style-consolidation.test.ts`)
 * to surface duplicate UI patterns and style consolidation
 * opportunities. That entire test tree was removed in a prior cleanup,
 * leaving the script with nothing to execute. The npm entry point
 * (`npm run analyze:redundancy`) is preserved as a no-op so existing
 * docs and muscle memory keep working; if redundancy analysis is
 * resurrected, replace this stub with a real runner pointed at the
 * new suites.
 */

import chalk from 'chalk';

const NOTICE = [
  '🔍 Redundancy Analysis Pipeline',
  '',
  'The Jest suites this script used to run (tests/code-analysis/*) were',
  'removed and have not been replaced. Nothing to analyse — exiting cleanly.',
  '',
  'If redundancy analysis is brought back, update scripts/run-redundancy-analysis.ts',
  'to point at the new suites.',
].join('\n');

if (import.meta.url === `file://${process.argv[1]}`) {
  console.warn(chalk.yellow(NOTICE));
  process.exit(0);
}

export { NOTICE };
