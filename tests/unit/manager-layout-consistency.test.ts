import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Protected Pages Layout Consistency', () => {
  const pagesPath = join(process.cwd(), 'client', 'src', 'pages');
  
  // Protected pages that use sidebar layout (should use flex-1 structure)
  const protectedPages = [
    // Manager pages
    { path: 'manager/buildings.tsx', name: 'Manager Buildings' },
    { path: 'manager/budget.tsx', name: 'Manager Budget' }, 
    { path: 'manager/bills.tsx', name: 'Manager Bills' },
    { path: 'manager/common-spaces-stats.tsx', name: 'Manager Common Spaces Stats' },
    { path: 'manager/user-management.tsx', name: 'Manager User Management' },
    { path: 'manager/residences.tsx', name: 'Manager Residences' },
    { path: 'manager/demands.tsx', name: 'Manager Demands' },
    
    // Dashboard pages
    { path: 'dashboard/calendar.tsx', name: 'Dashboard Calendar' },
    
    // Residents pages  
    { path: 'residents/common-spaces.tsx', name: 'Residents Common Spaces' },
    { path: 'residents/my-calendar.tsx', name: 'Residents My Calendar' }
  ];

  // Public pages that should use min-h-screen (full page layout)
  const publicPages = [
    'home.tsx',
    'pricing.tsx',
    'features.tsx',
    'terms-of-service.tsx',
    'privacy-policy.tsx',
    'story.tsx',
    'security.tsx',
    'not-found.tsx',
    'auth/login.tsx',
    'auth/forgot-password.tsx',
    'auth/invitation-acceptance.tsx',
    'auth/reset-password.tsx'
  ];

  describe('Protected Pages Layout Structure', () => {
    protectedPages.forEach(({ path, name }) => {
      it(`${name} should use flex-1 layout for sidebar compatibility`, () => {
        const filePath = join(pagesPath, path);
        let content: string;
        
        try {
          content = readFileSync(filePath, 'utf8');
        } catch (error) {
          console.log(`Skipping ${path} - file not found`);
          return;
        }

        // Check for problematic min-h-screen usage in main return statements
        const minHeightScreenMatches = content.match(/<div className=['"][^'"]*min-h-screen[^'"]*['"][^>]*>/g);
        
        if (minHeightScreenMatches) {
          console.log(`❌ ${path} still uses min-h-screen:`, minHeightScreenMatches);
          expect(minHeightScreenMatches.length).toBe(0);
        }

        // Check for correct flex-1 layout structure
        const hasCorrectLayout = content.includes("className='flex-1 flex flex-col overflow-hidden'") ||
                                content.includes('className="flex-1 flex flex-col overflow-hidden"');
        
        expect(hasCorrectLayout).toBe(true);
        console.log(`✅ ${path} uses correct layout structure`);
      });
    });
  });

  describe('Public Pages Layout Structure', () => {
    publicPages.forEach(pageFile => {
      it(`${pageFile} should correctly use min-h-screen for full page layout`, () => {
        const filePath = join(pagesPath, pageFile);
        let content: string;
        
        try {
          content = readFileSync(filePath, 'utf8');
        } catch (error) {
          console.log(`Skipping ${pageFile} - file not found`);
          return;
        }

        // Public pages should use min-h-screen since they don't have sidebar
        const hasMinHeight = content.includes('min-h-screen');
        expect(hasMinHeight).toBe(true);
        console.log(`✅ ${pageFile} correctly uses min-h-screen for full page layout`);
      });
    });
  });

  describe('Sidebar Compatibility Verification', () => {
    it('all protected pages should not break sidebar layout', () => {
      let pagesWithIssues: string[] = [];
      
      protectedPages.forEach(({ path, name }) => {
        try {
          const filePath = join(pagesPath, path);
          const content = readFileSync(filePath, 'utf8');
          
          // Should not use min-h-screen in main return
          const hasMinHeightInMain = content.includes("return (\n    <div className='min-h-screen") ||
                                    content.includes("return (\n      <div className='min-h-screen");
          
          // Should use proper layout structure
          const hasCorrectLayout = content.includes("className='flex-1 flex flex-col overflow-hidden'") ||
                                  content.includes('className="flex-1 flex flex-col overflow-hidden"');
          
          if (hasMinHeightInMain || !hasCorrectLayout) {
            pagesWithIssues.push(name);
            console.log(`❌ ${name} has layout issues - min-h-screen: ${hasMinHeightInMain}, correct layout: ${hasCorrectLayout}`);
          } else {
            console.log(`✅ ${name} uses correct sidebar-compatible layout`);
          }
        } catch (error) {
          console.log(`Skipping ${path} - file not found`);
        }
      });
      
      expect(pagesWithIssues).toHaveLength(0);
    });
  });

  describe('Regression Prevention', () => {
    it('should detect layout incompatibilities in protected pages', () => {
      let pagesWithIssues: string[] = [];
      
      protectedPages.forEach(({ path, name }) => {
        try {
          const filePath = join(pagesPath, path);
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
            pagesWithIssues.push(name);
          }
        } catch (error) {
          // Skip files that don't exist
        }
      });
      
      if (pagesWithIssues.length > 0) {
        console.log('❌ Protected pages with layout issues:', pagesWithIssues);
      }
      
      expect(pagesWithIssues).toHaveLength(0);
    });

    it('should verify public pages maintain full-screen layout', () => {
      let pagesWithIssues: string[] = [];
      
      publicPages.forEach(pageFile => {
        try {
          const filePath = join(pagesPath, pageFile);
          const content = readFileSync(filePath, 'utf8');
          
          // Public pages should have min-h-screen
          const hasMinHeightScreen = content.includes('min-h-screen');
          
          if (!hasMinHeightScreen) {
            pagesWithIssues.push(pageFile);
          }
        } catch (error) {
          // Skip files that don't exist
        }
      });
      
      if (pagesWithIssues.length > 0) {
        console.log('❌ Public pages missing full-screen layout:', pagesWithIssues);
      }
      
      expect(pagesWithIssues).toHaveLength(0);
    });
  });
});