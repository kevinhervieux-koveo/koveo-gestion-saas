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
  console.log(chalk.blue('🏷️  Applying JSDoc Templates...'));
  console.log(chalk.gray('   Generating documentation for React components, hooks, and utilities\n'));

  try {
    // Apply templates to React components
    console.log(chalk.blue('📦 Processing React Components...'));
    const componentResult = await jsdocTemplates.bulkApplyTemplates(
      'client/src/components/**/*.{ts,tsx}',
      { maxFiles: 50 }
    );
    
    console.log(chalk.green(`✅ Components: ${componentResult.filesProcessed} files, ${componentResult.templatesApplied} templates applied`));

    // Apply templates to React hooks
    console.log(chalk.blue('🪝 Processing React Hooks...'));
    const hooksResult = await jsdocTemplates.bulkApplyTemplates(
      'client/src/hooks/**/*.{ts,tsx}',
      { maxFiles: 20 }
    );
    
    console.log(chalk.green(`✅ Hooks: ${hooksResult.filesProcessed} files, ${hooksResult.templatesApplied} templates applied`));

    // Apply templates to utility functions
    console.log(chalk.blue('🔧 Processing Utilities...'));
    const utilResult = await jsdocTemplates.bulkApplyTemplates(
      'client/src/lib/**/*.{ts,tsx}',
      { maxFiles: 30 }
    );
    
    console.log(chalk.green(`✅ Utilities: ${utilResult.filesProcessed} files, ${utilResult.templatesApplied} templates applied`));

    // Apply templates to API routes
    console.log(chalk.blue('🌐 Processing API Routes...'));
    const apiResult = await jsdocTemplates.bulkApplyTemplates(
      'server/routes/**/*.{ts,js}',
      { maxFiles: 30 }
    );
    
    console.log(chalk.green(`✅ API Routes: ${apiResult.filesProcessed} files, ${apiResult.templatesApplied} templates applied`));

    // Apply templates to pages
    console.log(chalk.blue('📄 Processing Pages...'));
    const pagesResult = await jsdocTemplates.bulkApplyTemplates(
      'client/src/pages/**/*.{ts,tsx}',
      { maxFiles: 30 }
    );
    
    console.log(chalk.green(`✅ Pages: ${pagesResult.filesProcessed} files, ${pagesResult.templatesApplied} templates applied`));

    // Summary
    const totalFiles = componentResult.filesProcessed + hooksResult.filesProcessed + 
                      utilResult.filesProcessed + apiResult.filesProcessed + pagesResult.filesProcessed;
    const totalTemplates = componentResult.templatesApplied + hooksResult.templatesApplied + 
                          utilResult.templatesApplied + apiResult.templatesApplied + pagesResult.templatesApplied;

    console.log(chalk.blue('\n📊 JSDoc Template Application Summary:'));
    console.log(chalk.green(`✅ Total files processed: ${totalFiles}`));
    console.log(chalk.green(`✅ Total templates applied: ${totalTemplates}`));
    
    if (totalTemplates > 0) {
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(chalk.gray('   1. Review generated JSDoc comments'));
      console.log(chalk.gray('   2. Run "npm run lint:fix" to format documentation'));
      console.log(chalk.gray('   3. Commit documentation improvements'));
    } else {
      console.log(chalk.green('\n🎉 All files already have proper JSDoc documentation!'));
    }

  } catch (error) {
    console.error(chalk.red('❌ JSDoc template application failed:'), error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as applyJSDocTemplates };