#!/usr/bin/env tsx

/**
 * Automated Translation Validator
 * 
 * This script can be run automatically (via CI/CD or pre-commit hooks) to:
 * 1. Scan for new translation keys and test IDs
 * 2. Update auto-generated tests
 * 3. Generate validation reports
 * 4. Suggest improvements
 * 
 * Usage:
 * - npm run translation:validate  (basic validation)
 * - npm run translation:fix       (auto-fix missing keys)
 * - npm run translation:report    (generate full report)
 */

import SimpleTranslationScanner from './simple-translation-scanner.js';
import TranslationValidationReporter from './translation-validation-report.js';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationConfig {
  mode: 'validate' | 'fix' | 'report';
  autoGenerateTests: boolean;
  fixMissingKeys: boolean;
  minCoveragePercentage: number;
  minQualityScore: number;
}

class AutoTranslationValidator {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      mode: 'validate',
      autoGenerateTests: true,
      fixMissingKeys: false,
      minCoveragePercentage: 60,
      minQualityScore: 90,
      ...config
    };
  }

  async run(): Promise<boolean> {
    console.log('🤖 Starting automated translation validation...');
    
    try {
      // 1. Generate latest tests
      if (this.config.autoGenerateTests) {
        console.log('🧪 Updating auto-generated tests...');
        const scanner = new SimpleTranslationScanner();
        await scanner.generateTests();
      }

      // 2. Generate validation report
      console.log('📊 Generating validation report...');
      const reporter = new TranslationValidationReporter();
      const report = await reporter.generateReport();

      // 3. Check if validation passes
      const isValid = this.validateReport(report);

      // 4. Handle different modes
      switch (this.config.mode) {
        case 'fix':
          if (!isValid && this.config.fixMissingKeys) {
            await this.autoFixMissingKeys(report.details.missingKeys);
          }
          break;
        
        case 'report':
          this.generateSummaryReport(report);
          break;
        
        case 'validate':
        default:
          // Just validate and exit with appropriate code
          break;
      }

      return isValid;

    } catch (error) {
      console.error('❌ Translation validation failed:', error);
      return false;
    }
  }

  private validateReport(report: any): boolean {
    let isValid = true;
    const issues: string[] = [];

    if (report.summary.coveragePercentage < this.config.minCoveragePercentage) {
      issues.push(`Coverage ${report.summary.coveragePercentage}% below minimum ${this.config.minCoveragePercentage}%`);
      isValid = false;
    }

    if (report.summary.qualityScore < this.config.minQualityScore) {
      issues.push(`Quality score ${report.summary.qualityScore} below minimum ${this.config.minQualityScore}`);
      isValid = false;
    }

    if (report.summary.missingKeys > 0) {
      issues.push(`${report.summary.missingKeys} missing translation keys`);
      isValid = false;
    }

    if (report.quebec.complianceScore < 95) {
      issues.push(`Quebec French compliance ${report.quebec.complianceScore}% below 95%`);
      isValid = false;
    }

    if (isValid) {
      console.log('✅ All translation validation checks passed!');
    } else {
      console.log('❌ Translation validation issues found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return isValid;
  }

  private async autoFixMissingKeys(missingKeys: string[]): Promise<void> {
    if (missingKeys.length === 0) return;

    console.log(`🔧 Auto-fixing ${missingKeys.length} missing translation keys...`);

    const i18nPath = path.resolve(process.cwd(), '..', 'client/src/lib/i18n.ts');
    let content = fs.readFileSync(i18nPath, 'utf-8');

    // Generate reasonable default translations
    const newKeys = missingKeys.map(key => {
      const englishDefault = this.generateEnglishDefault(key);
      const frenchDefault = this.generateFrenchDefault(key, englishDefault);
      
      return {
        key,
        english: englishDefault,
        french: frenchDefault
      };
    });

    // Add to interface
    const interfaceInsertPoint = content.indexOf('}\n\nconst translations');
    if (interfaceInsertPoint > -1) {
      const newInterfaceKeys = newKeys.map(k => `  ${k.key}: string;`).join('\n');
      content = content.slice(0, interfaceInsertPoint) + 
                `  // Auto-generated keys\n${newInterfaceKeys}\n` +
                content.slice(interfaceInsertPoint);
    }

    // Add to English translations
    const enInsertPoint = content.indexOf('  },\n  fr: {');
    if (enInsertPoint > -1) {
      const newEnKeys = newKeys.map(k => `    ${k.key}: '${k.english}',`).join('\n');
      content = content.slice(0, enInsertPoint) + 
                `    // Auto-generated keys\n${newEnKeys}\n` +
                content.slice(enInsertPoint);
    }

    // Add to French translations
    const frInsertPoint = content.indexOf('  }\n};');
    if (frInsertPoint > -1) {
      const newFrKeys = newKeys.map(k => `    ${k.key}: '${k.french}',`).join('\n');
      content = content.slice(0, frInsertPoint) + 
                `    // Clés auto-générées\n${newFrKeys}\n` +
                content.slice(frInsertPoint);
    }

    fs.writeFileSync(i18nPath, content);
    console.log(`✅ Added ${missingKeys.length} missing translation keys`);
  }

  private generateEnglishDefault(key: string): string {
    // Convert camelCase to readable text
    const readable = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    return readable;
  }

  private generateFrenchDefault(key: string, english: string): string {
    // Basic English to French translation mapping
    const simpleTranslations: Record<string, string> = {
      'Document': 'Document',
      'Description': 'Description',
      'Title': 'Titre',
      'Filter': 'Filtrer',
      'Search': 'Rechercher',
      'Select': 'Sélectionner',
      'Optional': 'Optionnel',
      'Building': 'Bâtiment',
      'Organization': 'Organisation',
      'Residence': 'Résidence',
      'Category': 'Catégorie',
      'Occupancy': 'Occupation',
      'Parking': 'Stationnement',
      'Storage': 'Entreposage'
    };

    let french = english;
    Object.entries(simpleTranslations).forEach(([en, fr]) => {
      french = french.replace(new RegExp(en, 'gi'), fr);
    });

    return french;
  }

  private generateSummaryReport(report: any): void {
    const summaryPath = path.resolve(process.cwd(), '..', 'TRANSLATION_SUMMARY.md');
    
    const content = `# Translation Validation Summary

Generated: ${new Date().toISOString()}

## 📊 Overview
- **Files Scanned**: ${report.summary.totalFiles}
- **Translation Keys**: ${report.summary.totalTranslationKeys}
- **Test IDs**: ${report.summary.totalTestIds}
- **Coverage**: ${report.summary.coveragePercentage}%
- **Quality Score**: ${report.summary.qualityScore}/100

## 🎯 Status
${report.summary.qualityScore >= 90 ? '✅ EXCELLENT' : 
  report.summary.qualityScore >= 75 ? '⚠️ GOOD' : '❌ NEEDS IMPROVEMENT'}

## 🇫🇷 Quebec French Compliance
- **Score**: ${report.quebec.complianceScore}/100
- **Status**: ${report.quebec.complianceScore >= 95 ? '✅ Compliant' : '⚠️ Needs attention'}

## ♿ Accessibility
- **Coverage**: ${report.accessibility.coverageScore}/100
- **Interactive Elements**: ${report.accessibility.interactiveElementsCovered} with test IDs

## 🚨 Issues
${report.details.missingKeys.length > 0 ? 
  `### Missing Translation Keys (${report.details.missingKeys.length})\n${report.details.missingKeys.map(k => `- ${k}`).join('\n')}` :
  'No missing translation keys! 🎉'}

${report.quebec.issues.length > 0 ?
  `### Quebec French Issues\n${report.quebec.issues.map(i => `- ${i}`).join('\n')}` :
  'Quebec French compliance perfect! 🇫🇷'}

---
*This report is automatically generated. Run \`npm run translation:validate\` to update.*
`;

    fs.writeFileSync(summaryPath, content);
    console.log(`📝 Summary report saved to: ${summaryPath}`);
  }
}

// CLI interface
const args = process.argv.slice(2);
const mode = args.includes('--fix') ? 'fix' : 
             args.includes('--report') ? 'report' : 'validate';

const config: Partial<ValidationConfig> = {
  mode: mode as any,
  autoGenerateTests: !args.includes('--no-tests'),
  fixMissingKeys: args.includes('--fix'),
  minCoveragePercentage: parseInt(args.find(arg => arg.startsWith('--min-coverage='))?.split('=')[1] || '60'),
  minQualityScore: parseInt(args.find(arg => arg.startsWith('--min-quality='))?.split('=')[1] || '90')
};

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new AutoTranslationValidator(config);
  validator.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default AutoTranslationValidator;