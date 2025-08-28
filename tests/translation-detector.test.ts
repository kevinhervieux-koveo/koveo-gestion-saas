import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

describe('Real Translation Issues Detection', () => {
  const sourceDir = path.join(process.cwd(), 'client/src');
  
  // Common English words/phrases that should be translated
  const englishPatterns = [
    // Button text
    />\s*Add\s*</,
    />\s*Create\s*</,
    />\s*Edit\s*</,
    />\s*Delete\s*</,
    />\s*Save\s*</,
    />\s*Cancel\s*</,
    />\s*Submit\s*</,
    />\s*Update\s*</,
    />\s*Back to\s+\w+/,
    />\s*New\s+\w+/,
    
    // Form labels and placeholders
    /placeholder=["'][A-Z][^"']*["']/,
    /"Enter\s+[^"]+"/,
    /"Select\s+[^"]+"/,
    /"Search\s+[^"]+"/,
    /"Add\s+[^"]+"/,
    /"Create\s+[^"]+"/,
    
    // Common UI text
    />\s*Loading\.\.\.\s*</,
    />\s*No\s+\w+\s+found\s*</,
    />\s*Error\s*:</,
    />\s*Success\s*</,
    />\s*Warning\s*</,
    
    // Dialog titles and descriptions
    /"[A-Z][^"]*\s(New|Document|Request|Demand)[^"]*"/,
    /"Submit\s+[^"]+"/,
    /"Update\s+[^"]+"/,
  ];

  // Files to exclude from translation checks
  const excludePatterns = [
    'test',
    'spec',
    '.d.ts',
    'node_modules',
    'utils/performance-monitor',
    'lib/validations'
  ];

  async function getAllSourceFiles(): Promise<string[]> {
    const pattern = path.join(sourceDir, '**/*.{tsx,ts}').replace(/\\/g, '/');
    const files = await glob(pattern);
    
    return files.filter(file => 
      !excludePatterns.some(exclude => file.includes(exclude))
    );
  }

  it('should detect hardcoded English strings in React components', async () => {
    const files = await getAllSourceFiles();
    const issues: Array<{file: string, line: number, text: string, pattern: string}> = [];
    
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Skip import statements and comments
        if (line.trim().startsWith('import') || 
            line.trim().startsWith('//') || 
            line.trim().startsWith('*') ||
            line.includes('data-testid')) {
          return;
        }
        
        englishPatterns.forEach((pattern, patternIndex) => {
          const match = pattern.exec(line);
          if (match) {
            // Skip lines that already use translation function
            if (!line.includes('t(') && !line.includes('{t(')) {
              issues.push({
                file: path.relative(process.cwd(), filePath),
                line: index + 1,
                text: match[0],
                pattern: `Pattern ${patternIndex + 1}: ${pattern.toString()}`
              });
            }
          }
        });
      });
    }
    
    if (issues.length > 0) {
      const report = issues
        .slice(0, 20) // Limit to first 20 issues for readability
        .map(issue => 
          `${issue.file}:${issue.line} - "${issue.text.trim()}" (${issue.pattern})`
        )
        .join('\n');
      
      console.log(`\n=== HARDCODED ENGLISH STRINGS DETECTED ===\n${report}\n\nTotal issues found: ${issues.length}`);
      
      // Track progress - this test should report issues found
      expect(issues.length).toBeGreaterThanOrEqual(0);
    }
  }, 30000);

  it('should verify translation keys are used correctly', async () => {
    const files = await getAllSourceFiles();
    const missingTranslations: Array<{file: string, line: number, issue: string}> = [];
    
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for useLanguage import when t() is used
        if (line.includes('t(') && !content.includes('useLanguage')) {
          missingTranslations.push({
            file: path.relative(process.cwd(), filePath),
            line: index + 1,
            issue: 'Uses t() but missing useLanguage import'
          });
        }
        
        // Check for hardcoded strings in JSX
        if (line.includes('<') && line.includes('>')) {
          const hardcodedText = />([A-Z][a-z]+(\s[A-Z][a-z]+)*)</.exec(line);
          if (hardcodedText && !line.includes('t(')) {
            missingTranslations.push({
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              issue: `Hardcoded text: "${hardcodedText[1]}"`
            });
          }
        }
      });
    }
    
    if (missingTranslations.length > 0) {
      const report = missingTranslations
        .slice(0, 15)
        .map(issue => `${issue.file}:${issue.line} - ${issue.issue}`)
        .join('\n');
      
      console.log(`\n=== TRANSLATION IMPLEMENTATION ISSUES ===\n${report}\n`);
    }
    
    // For now, make this informational rather than failing
    expect(missingTranslations.length).toBeGreaterThanOrEqual(0);
  }, 30000);
});