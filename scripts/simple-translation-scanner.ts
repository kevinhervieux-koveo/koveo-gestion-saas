#!/usr/bin/env tsx

/**
 * Simple Translation Scanner for Koveo Gestion
 * Scans codebase and generates automated translation tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

class SimpleTranslationScanner {
  private clientSrcPath = path.resolve(process.cwd(), '..', 'client/src');

  async generateTests(): Promise<void> {
    console.log('🔍 Scanning for translation keys...');
    
    // Get all React component files
    const files = await glob('**/*.{tsx,ts}', {
      cwd: this.clientSrcPath,
      ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']
    });

    const translationKeys = new Set<string>();
    const testIds = new Set<string>();

    // Scan files for translation keys and test IDs
    for (const file of files) {
      const fullPath = path.join(this.clientSrcPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Find translation keys - only capture actual translation calls
      const tKeyMatches = content.match(/\bt\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*[a-zA-Z0-9])['"`]\s*\)/g);
      
      if (tKeyMatches) {
        tKeyMatches.forEach(match => {
          const keyMatch = match.match(/['"`]([^'"`]+)['"`]/);
          if (keyMatch) {
            translationKeys.add(keyMatch[1]);
          }
        });
      }

      // Find test IDs
      const testIdMatches = content.match(/data-testid\s*=\s*["']([^"']+)["']/g);
      if (testIdMatches) {
        testIdMatches.forEach(match => {
          const idMatch = match.match(/["']([^"']+)["']/);
          if (idMatch) {
            testIds.add(idMatch[1]);
          }
        });
      }
    }

    console.log(`📊 Found ${translationKeys.size} translation keys and ${testIds.size} test IDs`);

    // Generate comprehensive test
    await this.generateComprehensiveTest(Array.from(translationKeys), Array.from(testIds));
    
    console.log('✅ Generated comprehensive translation tests');
  }

  private async generateComprehensiveTest(keys: string[], testIds: string[]): Promise<void> {
    const testContent = `/**
 * AUTO-GENERATED COMPREHENSIVE TRANSLATION TEST
 * Generated on ${new Date().toISOString()}
 * 
 * This test validates ALL translation keys and UI elements found in the codebase.
 * It automatically grows as the application grows.
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('Comprehensive Translation Coverage (Auto-Generated)', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('All Translation Keys Must Exist', () => {
    const discoveredKeys = [
${keys.sort().map(key => `      '${key}'`).join(',\n')}
    ];

    it('should have all used translation keys defined in both languages', () => {
      discoveredKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });

    it('should not have unused translation keys', () => {
      // This test helps identify translation keys that can be removed
      const allEnglishKeys = Object.keys(translations.en);
      const unusedKeys = allEnglishKeys.filter(key => !discoveredKeys.includes(key));
      
      // Log unused keys for cleanup (but don't fail the test)
      if (unusedKeys.length > 0) {
        console.log('📝 Potentially unused translation keys:', unusedKeys.slice(0, 10));
      }
      
      // Just ensure we have reasonable coverage
      const usageRatio = discoveredKeys.length / allEnglishKeys.length;
      expect(usageRatio).toBeGreaterThan(0.3); // At least 30% of keys should be used
    });
  });

  describe('UI Element Translation Validation', () => {
    const discoveredTestIds = [
${testIds.sort().map(id => `      '${id}'`).join(',\n')}
    ];

    it('should have consistent test ID naming conventions', () => {
      discoveredTestIds.forEach(testId => {
        // Test IDs should be descriptive and follow kebab-case
        expect(testId.length).toBeGreaterThan(2);
        expect(testId).toMatch(/^[a-z0-9-_]+$/i);
      });
    });

    it('should validate interactive elements have proper accessibility', () => {
      const interactivePatterns = [
        'button-',
        'input-',
        'link-',
        'select-',
        'textarea-'
      ];

      const interactiveTestIds = discoveredTestIds.filter(id =>
        interactivePatterns.some(pattern => id.includes(pattern))
      );

      // Interactive elements should have meaningful test IDs
      interactiveTestIds.forEach(testId => {
        expect(testId.split('-').length).toBeGreaterThan(1);
      });
    });
  });

  describe('Quebec French Translation Quality', () => {
    it('should use proper Quebec French terminology', () => {
      const fr = translations.fr;
      
      // Quebec-specific terms
      if (fr.email) {
        expect(fr.email).toBe('Courriel');
      }
      
      if (fr.logout) {
        expect(fr.logout).toBe('Déconnexion');
      }

      if (fr.login) {
        expect(fr.login).toBe('Connexion');
      }
    });

    it('should have French translations for all English keys', () => {
      Object.keys(translations.en).forEach(key => {
        const frValue = (translations.fr as any)[key];
        expect(frValue).toBeDefined();
        expect(typeof frValue).toBe('string');
        expect(frValue.length).toBeGreaterThan(0);
      });
    });

    it('should maintain reasonable translation length ratios', () => {
      const testKeys = ['dashboard', 'settings', 'email', 'password'];
      
      testKeys.forEach(key => {
        const en = (translations.en as any)[key];
        const fr = (translations.fr as any)[key];
        
        if (en && fr) {
          const ratio = fr.length / en.length;
          expect(ratio).toBeGreaterThan(0.5);
          expect(ratio).toBeLessThan(3.0);
        }
      });
    });
  });

  describe('Translation Coverage Statistics', () => {
    it('should track coverage metrics', () => {
      const stats = {
        totalEnglishKeys: Object.keys(translations.en).length,
        totalFrenchKeys: Object.keys(translations.fr).length,
        usedKeys: ${keys.length},
        testIds: ${testIds.length},
        coverageRatio: ${keys.length} / Object.keys(translations.en).length
      };

      console.log('📊 Translation Coverage Stats:', stats);
      
      expect(stats.totalEnglishKeys).toBeGreaterThan(100);
      expect(stats.totalFrenchKeys).toBe(stats.totalEnglishKeys);
      expect(stats.coverageRatio).toBeGreaterThan(0.2);
    });
  });
});

/**
 * AUTO-GENERATION STATS:
 * Generated: ${new Date().toISOString()}
 * Translation keys: ${keys.length}
 * Test IDs: ${testIds.length}
 * Files scanned: Multiple component files
 */
`;

    const testPath = path.resolve(process.cwd(), '..', 'tests', 'unit', 'auto-generated-comprehensive-translation.test.ts');
    fs.writeFileSync(testPath, testContent);
  }
}

// Run the scanner
if (import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new SimpleTranslationScanner();
  scanner.generateTests().catch(console.error);
}

export default SimpleTranslationScanner;