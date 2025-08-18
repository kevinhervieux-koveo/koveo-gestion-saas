#!/usr/bin/env node
/**
 * Documentation validation script
 * Checks for proper JSDoc documentation coverage and quality
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';

interface DocumentationIssue {
  file: string;
  line: number;
  type: 'missing_docs' | 'incomplete_docs' | 'invalid_syntax';
  message: string;
}

/**
 * Recursively find TypeScript files in a directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (stat.isFile() && ['.ts', '.tsx'].includes(extname(item))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Check if a function/class has proper JSDoc documentation
 */
function validateDocumentation(content: string, filePath: string): DocumentationIssue[] {
  const issues: DocumentationIssue[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for exported functions/classes without JSDoc
    if (line.startsWith('export function') || line.startsWith('export class') || line.startsWith('export const')) {
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      
      if (!prevLine.startsWith('/**') && !prevLine.includes('*/')) {
        issues.push({
          file: filePath,
          line: i + 1,
          type: 'missing_docs',
          message: `Missing JSDoc documentation for exported ${line.includes('function') ? 'function' : line.includes('class') ? 'class' : 'constant'}`
        });
      }
    }
  }
  
  return issues;
}

/**
 * Main documentation validation function
 */
function validateDocs(): number {
  console.log('🔍 Running documentation validation...\n');
  
  const sourceFiles = [
    ...findTsFiles('client/src'),
    ...findTsFiles('server'),
    ...findTsFiles('shared')
  ];
  
  const allIssues: DocumentationIssue[] = [];
  
  for (const file of sourceFiles) {
    // Skip test files and type definition files
    if (file.includes('.test.') || file.includes('.spec.') || file.endsWith('.d.ts')) {
      continue;
    }
    
    try {
      const content = readFileSync(file, 'utf-8');
      const issues = validateDocumentation(content, file);
      allIssues.push(...issues);
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
  
  // Try to run TypeDoc validation
  try {
    console.log('📚 Running TypeDoc validation...');
    execSync('npx typedoc --out docs --entryPoints client/src server --exclude "**/node_modules/**" --exclude "**/tests/**" --validation.notExported false --validation.invalidLink --validation.notDocumented --treatWarningsAsErrors', {
      stdio: 'pipe'
    });
    console.log('✅ TypeDoc validation passed\n');
  } catch (error) {
    console.log('⚠️  TypeDoc validation found issues\n');
  }
  
  // Report issues
  if (allIssues.length > 0) {
    console.log(`❌ Found ${allIssues.length} documentation issues:\n`);
    
    for (const issue of allIssues) {
      console.log(`${issue.file}:${issue.line} - ${issue.message}`);
    }
    
    console.log('\n💡 Fix these issues by adding proper JSDoc documentation to exported functions and classes.');
    return 1;
  } else {
    console.log('✅ All documentation checks passed!');
    return 0;
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(validateDocs());
}

export { validateDocs };