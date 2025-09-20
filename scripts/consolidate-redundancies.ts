#!/usr/bin/env npx tsx

/**
 * @file Consolidation script for redundancies.
 * @description Identifies and helps consolidate redundant code patterns across the codebase.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import * as glob from 'fast-glob';

/**
 *
 */
interface RedundancyPattern {
  type: 'function' | 'constant' | 'interface' | 'component';
  pattern: string;
  files: string[];
  suggestions: string;
}

/**
 * Main consolidation analysis function.
 */
async function runConsolidationAnalysis() {
  console.warn(chalk.blue('🔍 Running Redundancy Consolidation Analysis...'));

  const redundancies: RedundancyPattern[] = [];

  try {
    // Check for DOCUMENT_CATEGORIES redundancy
    const documentCategoriesFiles = await findFilesWithPattern('DOCUMENT_CATEGORIES.*=');
    if (documentCategoriesFiles.length > 1) {
      redundancies.push({
        type: 'constant',
        pattern: 'DOCUMENT_CATEGORIES',
        files: documentCategoriesFiles,
        suggestions:
          'Consolidate into client/src/lib/documents.ts - already created with BUILDING_DOCUMENT_CATEGORIES, RESIDENCE_DOCUMENT_CATEGORIES, and GENERAL_DOCUMENT_CATEGORIES',
      });
    }

    // Check for getDisplayableFileUrl function redundancy
    const fileUrlFiles = await findFilesWithPattern('function.*getDisplayableFileUrl');
    if (fileUrlFiles.length > 1) {
      redundancies.push({
        type: 'function',
        pattern: 'getDisplayableFileUrl',
        files: fileUrlFiles,
        suggestions: 'Use consolidated getDisplayableFileUrl from client/src/lib/documents.ts',
      });
    }

    // Check for loading state patterns
    const loadingStateFiles = await findFilesWithPattern(
      'useState.*[Ll]oading|isLoading.*useState'
    );
    if (loadingStateFiles.length > 5) {
      redundancies.push({
        type: 'function',
        pattern: 'Loading State Management',
        files: loadingStateFiles.slice(0, 10), // Show first 10
        suggestions: 'Use useLoadingState hook from client/src/lib/common-hooks.ts',
      });
    }

    // Check for delete handler patterns
    const deleteHandlerFiles = await findFilesWithPattern('handleDelete.*=|const.*handleDelete');
    if (deleteHandlerFiles.length > 3) {
      redundancies.push({
        type: 'function',
        pattern: 'Delete Handlers',
        files: deleteHandlerFiles.slice(0, 8), // Show first 8
        suggestions: 'Use useDeleteMutation hook from client/src/lib/common-hooks.ts',
      });
    }

    // Generate consolidation report
    await generateConsolidationReport(redundancies);

    console.warn(chalk.green(`✅ Consolidation Analysis Complete`));
    console.warn(chalk.gray(`   Found ${redundancies.length} consolidation opportunities`));
    console.warn(chalk.gray(`   Report saved to: reports/consolidation-report.md`));

    return redundancies.length === 0;
  } catch (_error) {
    console.error(chalk.red(`❌ Error during consolidation analysis: ${_error}`));
    return false;
  }
}

/**
 * Find files with a specific pattern.
 * @param pattern - The pattern to search for.
 * @returns Array of file paths containing the pattern.
 */
async function findFilesWithPattern(pattern: string): Promise<string[]> {
  try {
    // Use fast-glob to find files, then search content for pattern
    const allFiles = await glob.glob(['client/src/**/*.{ts,tsx,js,jsx}', 'server/**/*.{ts,js}'], 
      { absolute: true, onlyFiles: true });
    
    const matchingFiles: string[] = [];
    const regex = new RegExp(pattern, 'i');
    
    for (const file of allFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        if (regex.test(content)) {
          matchingFiles.push(file);
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return matchingFiles;
  } catch (_error) {
    console.warn(`Could not search for pattern ${pattern}: ${_error}`);
    return [];
  }
}

/**
 * Generate a consolidation report.
 * @param redundancies - Array of redundancy patterns found.
 */
async function generateConsolidationReport(redundancies: RedundancyPattern[]) {
  const reportPath = path.join('reports', 'consolidation-report.md');

  // Ensure reports directory exists
  await fs.mkdir('reports', { recursive: true });

  const report = `# Code Consolidation Report

Generated on: ${new Date().toISOString()}

## Summary

Found **${redundancies.length}** consolidation opportunities across the codebase.

## Redundancy Patterns

${redundancies
  .map(
    (redundancy, _index) => `
### ${_index + 1}. ${redundancy.pattern} (${redundancy.type})

**Files affected:** ${redundancy.files.length}
${redundancy.files.map((file) => `- \`${file}\``).join('\n')}

**Consolidation suggestion:**
${redundancy.suggestions}

---
`
  )
  .join('')}

## Recommended Actions

1. **Document Categories**: Replace all DOCUMENT_CATEGORIES with imports from \`client/src/lib/documents.ts\`
2. **File URL Utilities**: Replace duplicate getDisplayableFileUrl functions with the consolidated version
3. **Loading States**: Migrate loading state management to use the \`useLoadingState\` hook
4. **Delete Handlers**: Consolidate delete operations using the \`useDeleteMutation\` hook

## Next Steps

1. Run \`npm run analyze:consolidate\` to see current status
2. Update files to use consolidated utilities
3. Remove redundant code
4. Run tests to ensure functionality is preserved
`;

  await fs.writeFile(reportPath, report);
}

// Run the analysis
runConsolidationAnalysis().then((success) => {
  process.exit(success ? 0 : 1);
});
