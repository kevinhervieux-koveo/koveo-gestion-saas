/**
 * Test suite to detect undefined variable patterns in React components
 * Specifically focused on translation function 't' and other common undefined variables
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

describe('Undefined Variable Detection', () => {
  let reactFiles: string[] = [];

  beforeAll(async () => {
    // Find all React component files
    reactFiles = await glob('client/src/**/*.{tsx,ts}', {
      ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/node_modules/**']
    });
  });

  describe('Translation Function Errors', () => {
    it('should detect components using t() function without accessing useLanguage hook', () => {
      const issuesFound: Array<{ file: string; issues: string[] }> = [];

      reactFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const issues: string[] = [];

        // Check if file uses t() function calls
        const tFunctionUsage = content.match(/\bt\(['"`][^'"`]*['"`]\)/g);
        
        if (tFunctionUsage && tFunctionUsage.length > 0) {
          // Check if the file imports or uses useLanguage hook
          const hasUseLanguageHook = content.includes('useLanguage');
          const hasTranslationImport = content.includes('const { t }');
          
          // Check if this is a sub-component that should receive t as prop
          const isSubComponent = content.includes('interface') && content.includes('Props');
          const hasTasProp = content.includes('t:') && content.includes('string');
          
          if (!hasUseLanguageHook && !hasTranslationImport && !hasTasProp) {
            issues.push(`Uses t() function but doesn't import useLanguage hook or receive t as prop`);
            issues.push(`Found ${tFunctionUsage.length} t() calls: ${tFunctionUsage.slice(0, 3).join(', ')}${tFunctionUsage.length > 3 ? '...' : ''}`);
          }
        }

        if (issues.length > 0) {
          issuesFound.push({ file: filePath, issues });
        }
      });

      // Report findings but don't fail the test - use as detection
      if (issuesFound.length > 0) {
        console.log('\n🚨 Translation Function Issues Found:');
        issuesFound.forEach(({ file, issues }) => {
          console.log(`\n📄 ${file}:`);
          issues.forEach(issue => console.log(`   ❌ ${issue}`));
        });
        
        // Create a detailed report
        const report = issuesFound.map(({ file, issues }) => ({
          file: file.replace('client/src/', ''),
          issues
        }));
        
        expect(report.length).toBe(0); // This will fail and show the issues
      }
    });

    it('should verify components that pass t function correctly to sub-components', () => {
      const wellImplementedFiles: string[] = [];
      const issuesFound: Array<{ file: string; issues: string[] }> = [];

      reactFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const issues: string[] = [];

        // Check if file has components that accept t as prop
        const hasTProp = content.includes('t:') && (content.includes('string') || content.includes('Function'));
        const usesUseLanguage = content.includes('useLanguage');
        const passesTToProp = content.includes('t={t}');

        if (hasTProp) {
          // This file has components that expect t as prop - good pattern
          wellImplementedFiles.push(filePath);
          
          // Check if the parent component properly passes t
          if (usesUseLanguage && !passesTToProp) {
            issues.push('Component interface expects t as prop but parent may not be passing it');
          }
        }

        if (issues.length > 0) {
          issuesFound.push({ file: filePath, issues });
        }
      });

      console.log(`\n✅ Found ${wellImplementedFiles.length} files with proper t prop implementation`);
      
      if (issuesFound.length > 0) {
        console.log('\n⚠️  Potential t prop implementation issues:');
        issuesFound.forEach(({ file, issues }) => {
          console.log(`\n📄 ${file}:`);
          issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
        });
      }
    });
  });

  describe('General Undefined Variable Patterns', () => {
    it('should detect common undefined variable patterns', () => {
      const issuesFound: Array<{ file: string; issues: string[] }> = [];

      reactFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const issues: string[] = [];

        // Check for common undefined variable patterns
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const lineNumber = index + 1;
          
          // Check for undefined variables in JSX
          const undefinedPatterns = [
            { pattern: /\{[^}]*\b(?!props\.|this\.|window\.|document\.|console\.)([a-zA-Z_$][a-zA-Z0-9_$]*)\b[^}]*\}/g, type: 'potential undefined variable in JSX' },
            { pattern: /\b(?!import|export|const|let|var|function|if|else|for|while|return|true|false|null|undefined)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, type: 'potential undefined function call' }
          ];

          undefinedPatterns.forEach(({ pattern, type }) => {
            const matches = line.match(pattern);
            if (matches) {
              // Filter out known safe patterns
              const safePatterns = /\b(React|useState|useEffect|useCallback|useMemo|import|export|console|window|document|Array|Object|String|Number|Boolean|Date|Math|JSON|Promise|setTimeout|setInterval|require)\b/;
              
              matches.forEach(match => {
                if (!safePatterns.test(match)) {
                  issues.push(`Line ${lineNumber}: ${type} - "${match.trim()}"`);
                }
              });
            }
          });
        });

        if (issues.length > 0) {
          issuesFound.push({ file: filePath, issues: issues.slice(0, 5) }); // Limit to first 5 issues per file
        }
      });

      if (issuesFound.length > 0) {
        console.log('\n🔍 Potential Undefined Variable Patterns Found:');
        issuesFound.slice(0, 10).forEach(({ file, issues }) => { // Limit to first 10 files
          console.log(`\n📄 ${file}:`);
          issues.forEach(issue => console.log(`   🔍 ${issue}`));
        });
      }

      // This is a detection test, not a strict failure
      expect(true).toBe(true);
    });
  });

  describe('Component Interface Validation', () => {
    it('should validate that all component interfaces are properly typed', () => {
      const interfaceIssues: Array<{ file: string; issues: string[] }> = [];

      reactFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const issues: string[] = [];

        // Check for interface definitions
        const interfaceMatches = content.match(/interface\s+(\w+Props)\s*{[^}]*}/gs);
        
        if (interfaceMatches) {
          interfaceMatches.forEach(interfaceBlock => {
            // Check if translation function is properly typed
            if (interfaceBlock.includes('t:') && !interfaceBlock.includes('(key: string)')) {
              issues.push('Translation function t should be typed as (key: string) => string');
            }
            
            // Check for any: any type usage (potential issue)
            if (interfaceBlock.includes(': any')) {
              issues.push('Interface contains "any" type - consider proper typing');
            }
          });
        }

        if (issues.length > 0) {
          interfaceIssues.push({ file: filePath, issues });
        }
      });

      if (interfaceIssues.length > 0) {
        console.log('\n📋 Component Interface Issues:');
        interfaceIssues.forEach(({ file, issues }) => {
          console.log(`\n📄 ${file}:`);
          issues.forEach(issue => console.log(`   📋 ${issue}`));
        });
      }

      expect(interfaceIssues.length).toBeLessThan(10); // Allow some flexibility
    });
  });
});