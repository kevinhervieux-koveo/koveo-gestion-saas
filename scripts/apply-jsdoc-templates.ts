/**
 * @file Apply JSDoc Templates Script.
 * @description Automated script to apply JSDoc templates across the codebase.
 */

import { jsdocTemplates } from '../tools/jsdoc-templates';
import chalk from 'chalk';

/**
 * Main execution function for JSDoc template application.
 * @returns Promise that resolves when script completes.
 */
async function main(): Promise<void> {
  console.warn(chalk.blue('🏷️  Applying JSDoc Templates...'));
  console.warn(
    chalk.gray('   Generating documentation for React components, hooks, and utilities\n')
  );

  try {
    // Apply templates to React components
    console.warn(chalk.blue('📦 Processing React Components...'));
    const componentResult = await jsdocTemplates.bulkApplyTemplates(
      'client/src/components/**/*.{ts,tsx}',
      { maxFiles: 50 }
    );

    console.warn(
      chalk.green(
        `✅ Components: ${componentResult.filesProcessed} files, ${componentResult.templatesApplied} templates applied`
      )
    );

    // Apply templates to React hooks
    console.warn(chalk.blue('🪝 Processing React Hooks...'));
    const hooksResult = await jsdocTemplates.bulkApplyTemplates('client/src/hooks/**/*.{ts,tsx}', {
      maxFiles: 20,
    });

    console.warn(
      chalk.green(
        `✅ Hooks: ${hooksResult.filesProcessed} files, ${hooksResult.templatesApplied} templates applied`
      )
    );

    // Apply templates to utility functions
    console.warn(chalk.blue('🔧 Processing Utilities...'));
    const utilResult = await jsdocTemplates.bulkApplyTemplates('client/src/lib/**/*.{ts,tsx}', {
      maxFiles: 30,
    });

    console.warn(
      chalk.green(
        `✅ Utilities: ${utilResult.filesProcessed} files, ${utilResult.templatesApplied} templates applied`
      )
    );

    // Apply templates to API routes
    console.warn(chalk.blue('🌐 Processing API Routes...'));
    const apiResult = await jsdocTemplates.bulkApplyTemplates('server/routes/**/*.{ts,js}', {
      maxFiles: 30,
    });

    console.warn(
      chalk.green(
        `✅ API Routes: ${apiResult.filesProcessed} files, ${apiResult.templatesApplied} templates applied`
      )
    );

    // Apply templates to pages
    console.warn(chalk.blue('📄 Processing Pages...'));
    const pagesResult = await jsdocTemplates.bulkApplyTemplates('client/src/pages/**/*.{ts,tsx}', {
      maxFiles: 30,
    });

    console.warn(
      chalk.green(
        `✅ Pages: ${pagesResult.filesProcessed} files, ${pagesResult.templatesApplied} templates applied`
      )
    );

    // Summary
    const totalFiles =
      componentResult.filesProcessed +
      hooksResult.filesProcessed +
      utilResult.filesProcessed +
      apiResult.filesProcessed +
      pagesResult.filesProcessed;
    const totalTemplates =
      componentResult.templatesApplied +
      hooksResult.templatesApplied +
      utilResult.templatesApplied +
      apiResult.templatesApplied +
      pagesResult.templatesApplied;

    console.warn(chalk.blue('\n📊 JSDoc Template Application Summary:'));
    console.warn(chalk.green(`✅ Total files processed: ${totalFiles}`));
    console.warn(chalk.green(`✅ Total templates applied: ${totalTemplates}`));

    if (totalTemplates > 0) {
      console.warn(chalk.yellow('\n💡 Next steps:'));
      console.warn(chalk.gray('   1. Review generated JSDoc comments'));
      console.warn(chalk.gray('   2. Run "npm run lint:fix" to format documentation'));
      console.warn(chalk.gray('   3. Commit documentation improvements'));
    } else {
      console.warn(chalk.green('\n🎉 All files already have proper JSDoc documentation!'));
    }
  } catch (_error) {
    console.error(chalk.red('❌ JSDoc template application failed:'), _error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console._error);
}

export { main as applyJSDocTemplates };
