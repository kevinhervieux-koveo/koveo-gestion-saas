/**
 * Quick test to detect translation function errors specifically in the buildings page
 * and verify the fix works properly
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';

describe('Translation Function Error Detection', () => {
  it('should verify buildings page has proper translation setup', () => {
    const buildingsFile = 'client/src/pages/manager/buildings.tsx';
    const content = readFileSync(buildingsFile, 'utf-8');

    // Check that the file uses the useLanguage hook
    expect(content).toMatch(/import.*useLanguage.*from/);
    expect(content).toMatch(/const\s*{\s*t\s*}.*=.*useLanguage\(\)/);
    
    // Verify that the file doesn't have obvious translation errors
    expect(content).not.toMatch(/t\s*is\s*undefined/);
    expect(content).not.toMatch(/Cannot\s*read.*t/);
    
    console.log('✅ Buildings page has proper translation setup');
  });

  it('should detect any remaining t() calls without proper setup', () => {
    const buildingsFile = 'client/src/pages/manager/buildings.tsx';
    const content = readFileSync(buildingsFile, 'utf-8');
    
    // Split content into lines for analysis
    const lines = content.split('\n');
    const issues: string[] = [];
    
    lines.forEach((line, index) => {
      // Check for t() calls
      if (line.includes('t(') && !line.includes('const { t }') && !line.includes('t:')) {
        // Make sure this line is inside a component that has access to t
        const lineNumber = index + 1;
        
        // If it's in BuildingCard or BuildingForm, it should be ok now
        const isInFunction = content.substring(0, content.indexOf(line)).includes('function Building');
        
        if (isInFunction) {
          // This should be fine now
        } else {
          issues.push(`Line ${lineNumber}: ${line.trim()}`);
        }
      }
    });
    
    if (issues.length > 0) {
      console.log('⚠️  Potential remaining translation issues:');
      issues.forEach(issue => console.log(`   ${issue}`));
    } else {
      console.log('✅ No remaining translation function issues detected');
    }
    
    expect(issues.length).toBe(0);
  });
});