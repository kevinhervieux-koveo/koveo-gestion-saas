import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Manager Pages Layout Consistency', () => {
  const managerPagesPath = join(process.cwd(), 'client', 'src', 'pages', 'manager');
  
  const managerPages = [
    'buildings.tsx',
    'budget.tsx', 
    'bills.tsx',
    'common-spaces-stats.tsx',
    'user-management.tsx',
    'residences.tsx',
    'demands.tsx'
  ];

  describe('Layout Structure Requirements', () => {
    managerPages.forEach(pageFile => {
      it(`${pageFile} should use flex-1 layout instead of min-h-screen`, () => {
        const filePath = join(managerPagesPath, pageFile);
        let content: string;
        
        try {
          content = readFileSync(filePath, 'utf8');
        } catch (error) {
          console.log(`Skipping ${pageFile} - file not found`);
          return;
        }

        // Check for problematic min-h-screen usage in main return statements
        const minHeightScreenMatches = content.match(/<div className=['"][^'"]*min-h-screen[^'"]*['"][^>]*>/g);
        
        if (minHeightScreenMatches) {
          console.log(`❌ ${pageFile} still uses min-h-screen:`, minHeightScreenMatches);
          expect(minHeightScreenMatches.length).toBe(0);
        }

        // Check for correct flex-1 layout structure
        const hasCorrectLayout = content.includes("className='flex-1 flex flex-col overflow-hidden'") ||
                                content.includes('className="flex-1 flex flex-col overflow-hidden"');
        
        expect(hasCorrectLayout).toBe(true);
        console.log(`✅ ${pageFile} uses correct layout structure`);
      });
    });
  });

  describe('Sidebar Compatibility', () => {
    it('budget page should not break sidebar layout', () => {
      const budgetPath = join(managerPagesPath, 'budget.tsx');
      const content = readFileSync(budgetPath, 'utf8');
      
      // Should not use min-h-screen in main return
      const hasMinHeightInMain = content.includes("return (\n    <div className='min-h-screen");
      expect(hasMinHeightInMain).toBe(false);
      
      // Should use proper layout structure
      const hasCorrectLayout = content.includes("className='flex-1 flex flex-col overflow-hidden'");
      expect(hasCorrectLayout).toBe(true);
    });

    it('common spaces stats page should not break sidebar layout', () => {
      const commonSpacesPath = join(managerPagesPath, 'common-spaces-stats.tsx');
      const content = readFileSync(commonSpacesPath, 'utf8');
      
      // Should not use min-h-screen in main return
      const hasMinHeightInMain = content.includes("return (\n    <div className='min-h-screen");
      expect(hasMinHeightInMain).toBe(false);
      
      // Should use proper layout structure  
      const hasCorrectLayout = content.includes("className='flex-1 flex flex-col overflow-hidden'");
      expect(hasCorrectLayout).toBe(true);
    });

    it('user management page should not break sidebar layout', () => {
      const userMgmtPath = join(managerPagesPath, 'user-management.tsx');
      const content = readFileSync(userMgmtPath, 'utf8');
      
      // Should not use min-h-screen in main return
      const hasMinHeightInMain = content.includes("return (\n    <div className='flex flex-col min-h-screen");
      expect(hasMinHeightInMain).toBe(false);
      
      // Should use proper layout structure
      const hasCorrectLayout = content.includes("className='flex-1 flex flex-col overflow-hidden'");
      expect(hasCorrectLayout).toBe(true);
    });
  });

  describe('Regression Prevention', () => {
    it('should detect if any manager page tries to use full screen layout', () => {
      let pagesWithIssues: string[] = [];
      
      managerPages.forEach(pageFile => {
        try {
          const filePath = join(managerPagesPath, pageFile);
          const content = readFileSync(filePath, 'utf8');
          
          // Look for problematic patterns that break sidebar
          const problematicPatterns = [
            'min-h-screen',
            'h-screen',
            'fixed inset-0',
            'absolute inset-0'
          ];
          
          const hasProblematicPattern = problematicPatterns.some(pattern => {
            // Only flag main container divs, not nested ones
            const regex = new RegExp(`return \\([\\s\\S]*?<div[^>]*${pattern}[^>]*>`, 'g');
            return regex.test(content);
          });
          
          if (hasProblematicPattern) {
            pagesWithIssues.push(pageFile);
          }
        } catch (error) {
          // Skip files that don't exist
        }
      });
      
      if (pagesWithIssues.length > 0) {
        console.log('❌ Pages with layout issues:', pagesWithIssues);
      }
      
      expect(pagesWithIssues).toHaveLength(0);
    });
  });
});