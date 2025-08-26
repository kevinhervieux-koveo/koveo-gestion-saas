#!/usr/bin/env tsx
/**
 * Comprehensive fix for all _error and ___error references in the codebase.
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';

/**
 *
 * @param filePath
 */
async function fixErrorReferences(filePath: string): Promise<boolean> {
  let content = await fs.readFile(filePath, 'utf-8');
  const originalContent = content;

  // Fix all variations of error variable references
  // 1. Fix catch blocks with _error to _error
  content = content.replace(/catch\s*\(\s*_error\s*\)/g, 'catch (_error)');
  content = content.replace(/catch\s*\(\s*___error\s*\)/g, 'catch (_error)');

  // 2. Fix console references that use _error
  content = content.replace(/console\.(warn|error|log)\([^)]*_error[^)]*\)/g, (match) => {
    return match.replace(/_error/g, '_error');
  });

  // 3. Fix string interpolation and concatenation with _error
  content = content.replace(/\$\{_error\}/g, '${_error}');
  content = content.replace(/\+\s*_error/g, '+ _error');
  content = content.replace(/_error\s*\+/g, '_error +');

  // 4. Fix direct _error references in expressions
  content = content.replace(/\b__error\b(?![a-zA-Z0-9_])/g, '_error');

  // 5. Fix function parameters and destructuring
  content = content.replace(/\(\s*_error\s*\)/g, '(_error)');
  content = content.replace(/,\s*_error\s*\)/g, ', _error)');
  content = content.replace(/\(\s*[^,]+,\s*_error\s*\)/g, (match) => {
    return match.replace(/_error/, '_error');
  });

  // Only write if changes were made
  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

/**
 *
 */
async function main(): Promise<void> {
  console.warn('🔧 Fixing all _error references in codebase...');

  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    ignore: ['node_modules/**', 'dist/**', '.git/**', 'build/**'],
    cwd: process.cwd(),
  });

  let fixedFiles = 0;
  let totalFiles = 0;

  for (const file of files) {
    try {
      const wasFixed = await fixErrorReferences(file);
      if (wasFixed) {
        fixedFiles++;
      }
      totalFiles++;
    } catch (_error) {
      console.warn(`Failed to process file: ${file}`);
    }
  }

  console.warn(`✅ Processed ${totalFiles} files, fixed ${fixedFiles} files`);

  // Verify the fix
  const { exec } = await import('child_process');
  exec(
    'grep -rn "_error" . --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l',
    (_error, stdout) => {
      if (!_error) {
        const remaining = parseInt(stdout.trim());
        console.warn(`📊 Remaining _error references: ${remaining}`);
        if (remaining === 0) {
          console.warn('🎉 All _error references fixed!');
        }
      }
    }
  );
}

// Run the script
main().catch(console.error);
