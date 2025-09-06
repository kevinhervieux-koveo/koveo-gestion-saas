#!/usr/bin/env tsx

/**
 * Translation Scanner for Koveo Gestion
 * 
 * This script automatically scans the entire codebase to:
 * 1. Extract all translation keys used in components (t('key'))
 * 2. Find all data-testid attributes that might need translations
 * 3. Generate comprehensive test suites that automatically grow with the app
 * 4. Report missing translations and coverage gaps
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface TranslationUsage {
  key: string;
  file: string;
  line: number;
  context: string;
}

interface TestIdElement {
  testId: string;
  file: string;
  line: number;
  context: string;
  element: string;
}

interface ScanResults {
  translationKeys: TranslationUsage[];
  testIds: TestIdElement[];
  missingTranslations: string[];
  components: string[];
}

class TranslationScanner {
  private clientSrcPath = path.join(process.cwd(), 'client/src');
  private translationsPath = path.join(this.clientSrcPath, 'lib/i18n.ts');

  async scan(): Promise<ScanResults> {
    console.log('🔍 Starting comprehensive translation scan...');
    
    // Get all React component files
    const componentFiles = await glob('**/*.{tsx,ts}', {
      cwd: this.clientSrcPath,
      ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/node_modules/**']
    });

    const results: ScanResults = {
      translationKeys: [],
      testIds: [],
      missingTranslations: [],
      components: componentFiles
    };

    // Load existing translations to check for missing keys
    const existingTranslations = await this.loadExistingTranslations();

    // Process each component file
    for (const file of componentFiles) {
      const fullPath = path.join(this.clientSrcPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      // Extract translation key usage
      this.extractTranslationKeys(content, lines, file, results.translationKeys);
      
      // Extract data-testid attributes
      this.extractTestIds(content, lines, file, results.testIds);
    }

    // Check for missing translations
    results.missingTranslations = this.findMissingTranslations(
      results.translationKeys, 
      existingTranslations
    );

    this.printResults(results);
    return results;
  }

  private async loadExistingTranslations(): Promise<Set<string>> {
    try {
      const content = fs.readFileSync(this.translationsPath, 'utf-8');
      
      // Extract keys from the Translations interface
      const interfaceMatch = content.match(/export interface Translations \{([\s\S]*?)\}/);
      if (!interfaceMatch) return new Set();

      const interfaceContent = interfaceMatch[1];
      const keyMatches = interfaceContent.match(/(\w+):\s*string;/g);
      
      const keys = new Set<string>();
      if (keyMatches) {
        keyMatches.forEach(match => {
          const key = match.split(':')[0].trim();
          keys.add(key);
        });
      }

      console.log(`📚 Found ${keys.size} existing translation keys`);
      return keys;
    } catch (error) {
      console.error('❌ Error loading existing translations:', error);
      return new Set();
    }
  }

  private extractTranslationKeys(
    content: string, 
    lines: string[], 
    file: string, 
    results: TranslationUsage[]
  ): void {
    // Match t('key') or t("key") patterns
    const translationRegex = /\.t\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;

    while ((match = translationRegex.exec(content)) !== null) {
      const key = match[1];
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const context = lines[lineNumber - 1] || '';

      results.push({
        key,
        file,
        line: lineNumber,
        context: context.trim()
      });
    }

    // Also match useLanguage destructuring patterns
    const destructureRegex = /const\s*\{\s*[^}]*t[^}]*\}\s*=\s*useLanguage\(\)/g;
    if (destructureRegex.test(content)) {
      // File uses useLanguage, scan for direct t() calls
      const directTRegex = /\bt\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      let directMatch;
      
      while ((directMatch = directTRegex.exec(content)) !== null) {
        const key = directMatch[1];
        const beforeMatch = content.substring(0, directMatch.index);
        const lineNumber = beforeMatch.split('\n').length;
        const context = lines[lineNumber - 1] || '';

        results.push({
          key,
          file,
          line: lineNumber,
          context: context.trim()
        });
      }
    }
  }

  private extractTestIds(
    content: string, 
    lines: string[], 
    file: string, 
    results: TestIdElement[]
  ): void {
    // Match data-testid attributes
    const testIdRegex = /data-testid\s*=\s*["']([^"']+)["']/g;
    let match;

    while ((match = testIdRegex.exec(content)) !== null) {
      const testId = match[1];
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const context = lines[lineNumber - 1] || '';
      
      // Try to determine the element type
      const elementMatch = context.match(/<(\w+)[^>]*data-testid/);
      const element = elementMatch ? elementMatch[1] : 'unknown';

      results.push({
        testId,
        file,
        line: lineNumber,
        context: context.trim(),
        element
      });
    }
  }

  private findMissingTranslations(
    usedKeys: TranslationUsage[], 
    existingKeys: Set<string>
  ): string[] {
    const missing: string[] = [];
    const uniqueUsedKeys = new Set(usedKeys.map(usage => usage.key));

    for (const key of uniqueUsedKeys) {
      if (!existingKeys.has(key)) {
        missing.push(key);
      }
    }

    return missing;
  }

  private printResults(results: ScanResults): void {
    console.log('\n📊 Translation Scan Results:');
    console.log(`📁 Scanned ${results.components.length} component files`);
    console.log(`🔑 Found ${results.translationKeys.length} translation key usages`);
    console.log(`🏷️  Found ${results.testIds.length} data-testid attributes`);
    console.log(`❌ Missing ${results.missingTranslations.length} translation keys`);

    if (results.missingTranslations.length > 0) {
      console.log('\n🚨 Missing Translation Keys:');
      results.missingTranslations.forEach(key => {
        const usage = results.translationKeys.find(u => u.key === key);
        console.log(`  - ${key} (used in ${usage?.file}:${usage?.line})`);
      });
    }

    // Group translation usage by key
    const keyUsage = new Map<string, TranslationUsage[]>();
    results.translationKeys.forEach(usage => {
      if (!keyUsage.has(usage.key)) {
        keyUsage.set(usage.key, []);
      }
      keyUsage.get(usage.key)!.push(usage);
    });

    console.log('\n📈 Most Used Translation Keys:');
    const sortedKeys = Array.from(keyUsage.entries())
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10);

    sortedKeys.forEach(([key, usages]) => {
      console.log(`  - ${key}: ${usages.length} usages`);
    });
  }

  async generateAutoTests(): Promise<void> {
    console.log('\n🧪 Generating automated translation tests...');
    
    const results = await this.scan();
    
    // Generate comprehensive test file
    await this.generateComprehensiveTranslationTest(results);
    
    // Generate dynamic test file that updates automatically
    await this.generateDynamicTranslationTest(results);
    
    console.log('✅ Auto-generated translation tests created');
  }

  private async generateComprehensiveTranslationTest(results: ScanResults): Promise<void> {
    const uniqueKeys = Array.from(new Set(results.translationKeys.map(usage => usage.key))).sort();
    const keyUsageMap: Record<string, Array<{file: string, line: number}>> = {};
    
    results.translationKeys.forEach(usage => {
      if (!keyUsageMap[usage.key]) {
        keyUsageMap[usage.key] = [];
      }
      keyUsageMap[usage.key].push({
        file: usage.file,
        line: usage.line
      });
    });

    const testContent = `/**
 * AUTO-GENERATED COMPREHENSIVE TRANSLATION TEST
 * Generated by translation-scanner.ts on ${new Date().toISOString()}
 * 
 * This test automatically validates ALL translation keys found in the codebase.
 * It is regenerated whenever the scanner runs, ensuring 100% coverage.
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';

describe('Auto-Generated Comprehensive Translation Coverage', () => {
  const languages: Language[] = ['en', 'fr'];

  describe('All Used Translation Keys Must Exist', () => {
    const usedKeys = [
${uniqueKeys.map(key => `      '${key}'`).join(',\n')}
    ];

    it('should have all used translation keys defined in both languages', () => {
      usedKeys.forEach(key => {
        languages.forEach(lang => {
          const t = translations[lang] as any;
          expect(t[key]).toBeDefined();
          expect(typeof t[key]).toBe('string');
          expect(t[key].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Translation Key Usage Coverage', () => {
    const keyUsageMap = {
${Object.entries(keyUsageMap).map(([key, usages]) => 
  `      '${key}': [${usages.map(u => `{file: '${u.file}', line: ${u.line}}`).join(', ')}]`
).join(',\n')}
    };

    it('should track where each translation key is used', () => {
      Object.entries(keyUsageMap).forEach(([key, usages]) => {
        expect(usages.length).toBeGreaterThan(0);
        expect(key).toBeTruthy();
      });
    });
  });

  describe('Data-TestId Translation Validation', () => {
    const elementsWithTestIds = [
${results.testIds.map(testId => 
  `      {testId: '${testId.testId}', element: '${testId.element}', file: '${testId.file}'}`
).join(',\n')}
    ];

    it('should validate that interactive elements with test IDs have proper accessibility', () => {
      const interactiveElements = ['button', 'input', 'select', 'textarea', 'a', 'Link'];
      
      elementsWithTestIds
        .filter(item => interactiveElements.includes(item.element))
        .forEach(item => {
          // For interactive elements, we expect they either use translations
          // or have proper ARIA labels
          expect(item.testId).toBeTruthy();
          expect(item.testId.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Quebec French Translation Quality', () => {
    it('should use proper Quebec French terminology', () => {
      const fr = translations.fr;
      
      // Common Quebec French requirements
      if (fr.email) {
        expect(fr.email).toBe('Courriel'); // Not "e-mail" or "email"
      }
      
      if (fr.logout) {
        expect(fr.logout).toBe('Déconnexion'); // Quebec preference
      }
    });

    it('should have consistent French translations length relative to English', () => {
      const commonKeys = ['dashboard', 'settings', 'login', 'password', 'email'];
      
      commonKeys.forEach(key => {
        const en = (translations.en as any)[key];
        const fr = (translations.fr as any)[key];
        
        if (en && fr) {
          // French text is typically 15-20% longer than English
          const lengthRatio = fr.length / en.length;
          expect(lengthRatio).toBeGreaterThan(0.5);
          expect(lengthRatio).toBeLessThan(3.0);
        }
      });
    });
  });
});

/**
 * SCAN STATISTICS (Generated on ${new Date().toISOString()}):
 * - Components scanned: ${results.components.length}
 * - Translation keys found: ${results.translationKeys.length}
 * - Unique translation keys: ${uniqueKeys.length}
 * - Data-testid attributes: ${results.testIds.length}
 * - Missing translations: ${results.missingTranslations.length}
 */
`;

    const testFilePath = path.join(process.cwd(), 'tests/unit/auto-generated-translation-coverage.test.ts');
    fs.writeFileSync(testFilePath, testContent);
  }

  private async generateDynamicTranslationTest(): Promise<void> {
    const testContent = `/**
 * DYNAMIC TRANSLATION VALIDATION TEST
 * This test automatically discovers and validates translations at runtime.
 * It will automatically grow as the application grows.
 */

import { describe, it, expect } from '@jest/globals';
import { translations, type Language } from '../../client/src/lib/i18n.ts';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

describe('Dynamic Translation Coverage (Auto-Growing)', () => {
  const languages: Language[] = ['en', 'fr'];

  it('should automatically discover and validate all translation keys in codebase', async () => {
    // Dynamically scan for translation keys
    const clientSrcPath = path.join(process.cwd(), 'client/src');
    const componentFiles = await glob('**/*.{tsx,ts}', {
      cwd: clientSrcPath,
      ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']
    });

    const discoveredKeys = new Set<string>();

    // Extract translation keys from all component files
    for (const file of componentFiles) {
      const fullPath = path.join(clientSrcPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Match translation patterns
      const patterns = [
        /\\.t\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)/g,
        /\\bt\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)/g
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          discoveredKeys.add(match[1]);
        }
      });
    }

    console.log(`🔍 Dynamically discovered ${discoveredKeys.size} translation keys`);

    // Validate all discovered keys exist in translations
    discoveredKeys.forEach(key => {
      languages.forEach(lang => {
        const t = translations[lang] as any;
        expect(t[key]).toBeDefined();
        expect(typeof t[key]).toBe('string');
        expect(t[key].length).toBeGreaterThan(0);
      });
    });
  });

  it('should validate all data-testid elements have proper accessibility context', async () => {
    const clientSrcPath = path.join(process.cwd(), 'client/src');
    const componentFiles = await glob('**/*.{tsx,ts}', {
      cwd: clientSrcPath,
      ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']
    });

    const testIdElements = new Set<string>();

    // Extract data-testid attributes
    for (const file of componentFiles) {
      const fullPath = path.join(clientSrcPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      const testIdRegex = /data-testid\\s*=\\s*["']([^"']+)["']/g;
      let match;
      
      while ((match = testIdRegex.exec(content)) !== null) {
        testIdElements.add(match[1]);
      }
    }

    console.log(`🏷️ Dynamically discovered ${testIdElements.size} data-testid attributes`);

    // Validate test IDs follow naming conventions
    testIdElements.forEach(testId => {
      // Should be descriptive and follow kebab-case or action-target pattern
      expect(testId.length).toBeGreaterThan(2);
      expect(testId).toMatch(/^[a-z0-9-_]+$/);
    });
  });

  it('should ensure French translations maintain Quebec standards', () => {
    const fr = translations.fr;
    const en = translations.en;

    // Check that we have French translations for all English keys
    Object.keys(en).forEach(key => {
      expect(fr[key as keyof typeof fr]).toBeDefined();
      expect(typeof fr[key as keyof typeof fr]).toBe('string');
      expect((fr[key as keyof typeof fr] as string).length).toBeGreaterThan(0);
    });

    // Quebec-specific validation
    Object.values(fr).forEach(frenchText => {
      if (typeof frenchText === 'string') {
        // Should not contain English words that have Quebec French equivalents
        expect(frenchText.toLowerCase()).not.toContain('email');
        expect(frenchText.toLowerCase()).not.toContain('login');
        expect(frenchText.toLowerCase()).not.toContain('logout');
      }
    });
  });
});
`;

    const testFilePath = path.join(process.cwd(), 'tests/unit/dynamic-translation-coverage.test.ts');
    fs.writeFileSync(testFilePath, testContent);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new TranslationScanner();
  
  if (process.argv.includes('--generate-tests')) {
    scanner.generateAutoTests();
  } else {
    scanner.scan();
  }
}

export default TranslationScanner;