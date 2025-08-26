#!/usr/bin/env tsx
/**
 * Fix incorrect variable references caused by automated unused variable fixes.
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';

/**
 *
 * @param filePath
 */
async function fixVariableReferences(filePath: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  let hasChanges = false;

  // Fix common incorrect references
  const fixes = [
    { from: /JSON\.stringify\(_data\)/g, to: 'JSON.stringify(data)' },
    { from: /JSON\.stringify\(_context\)/g, to: 'JSON.stringify(context)' },
    { from: /JSON\.stringify\(_options\)/g, to: 'JSON.stringify(options)' },
    { from: /JSON\.stringify\(_error\)/g, to: 'JSON.stringify(error)' },
    { from: /levels\[\s*_error\s*\]/g, to: 'levels.error' },
    { from: /_data\s*\?\s*_data/g, to: 'data ? data' },
    { from: /_context\s*\?\s*_context/g, to: 'context ? context' },
    { from: /_options\s*\?\s*_options/g, to: 'options ? options' },
    {
      from: /console\.warn\((_error|_data|_context|_options)\)/g,
      to: 'console.warn($1.replace("_", ""))',
    },
    // Fix specific context references that were over-replaced
    { from: /'context' is not defined/g, to: "'context' is not defined" },
    { from: /'data' is not defined/g, to: "'data' is not defined" },
    // Fix levels object references
    { from: /_error:\s*0/g, to: 'error: 0' },
  ];

  fixes.forEach((fix) => {
    if (fix.from.test(content)) {
      content = content.replace(fix.from, fix.to);
      hasChanges = true;
    }
  });

  // Fix specific patterns in JSDoc that shouldn't have underscores
  content = content.replace(/@param\s+_data\b/g, '@param data');
  content = content.replace(/@param\s+_context\b/g, '@param context');
  content = content.replace(/@param\s+_options\b/g, '@param options');

  // Only rewrite if we made changes
  if (hasChanges) {
    await fs.writeFile(filePath, content, 'utf-8');
    console.warn(`Fixed variable references in: ${filePath}`);
  }
}

/**
 *
 */
async function main(): Promise<void> {
  console.warn('🔧 Fixing incorrect variable references...');

  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
    cwd: process.cwd(),
  });

  let fixedFiles = 0;

  for (const file of files) {
    try {
      await fixVariableReferences(file);
      fixedFiles++;
    } catch (_error) {
      console.warn(`Failed to fix file: ${file}`);
    }
  }

  console.warn(`✅ Processed ${fixedFiles} files`);
}

// Run the script
main().catch(console.error);
