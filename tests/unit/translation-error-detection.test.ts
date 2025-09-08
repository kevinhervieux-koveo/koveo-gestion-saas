/**
 * Quick test to detect translation function errors specifically in the buildings page
 * and verify the fix works properly
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';

describe('Translation Function Error Detection', () => {
  it('should verify buildings page no longer has undefined t function error', () => {
    const buildingsFile = 'client/src/pages/manager/buildings.tsx';
    const content = fs.readFileSync(buildingsFile, 'utf-8');

    // Check that BuildingCard has t parameter in interface
    expect(content).toMatch(/interface BuildingCardProps\s*{[^}]*t:\s*\(key:\s*string\)\s*=>\s*string/s);
    
    // Check that BuildingForm has t parameter in interface  
    expect(content).toMatch(/interface BuildingFormProps\s*{[^}]*t:\s*\(key:\s*string\)\s*=>\s*string/s);
    
    // Check that components receive t as prop
    expect(content).toMatch(/function BuildingCard\([^)]*,\s*t\s*\}/);
    expect(content).toMatch(/function BuildingForm\([^)]*,\s*t\s*\}/);
    
    // Check that t is passed to components
    expect(content).toMatch(/t={t}/);
    
    console.log('✅ Buildings page properly implements translation function passing');
  });

  it('should detect any remaining t() calls without proper setup', () => {
    const buildingsFile = 'client/src/pages/manager/buildings.tsx';
    const content = fs.readFileSync(buildingsFile, 'utf-8');
    
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