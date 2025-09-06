#!/usr/bin/env tsx

/**
 * Translation Validation and Reporting System
 * 
 * Provides comprehensive reporting on:
 * 1. Translation coverage across all components
 * 2. Missing translations and their impact
 * 3. Translation quality metrics for Quebec French
 * 4. UI element accessibility coverage
 * 5. Automated suggestions for improvements
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface TranslationReport {
  summary: {
    totalFiles: number;
    totalTranslationKeys: number;
    totalTestIds: number;
    coveragePercentage: number;
    missingKeys: number;
    qualityScore: number;
  };
  details: {
    usedKeys: string[];
    missingKeys: string[];
    testIds: string[];
    fileBreakdown: Record<string, {
      translationKeys: number;
      testIds: number;
      coverage: number;
    }>;
  };
  quebec: {
    complianceScore: number;
    issues: string[];
    suggestions: string[];
  };
  accessibility: {
    coverageScore: number;
    elementsWithoutTestIds: number;
    interactiveElementsCovered: number;
  };
}

class TranslationValidationReporter {
  private clientSrcPath = path.resolve(process.cwd(), '..', 'client/src');
  private translationsPath = path.resolve(this.clientSrcPath, 'lib/i18n.ts');

  async generateReport(): Promise<TranslationReport> {
    console.log('🔍 Generating comprehensive translation validation report...');

    // Load existing translations
    const { englishKeys, frenchKeys } = await this.loadTranslations();

    // Scan all component files
    const files = await glob('**/*.{tsx,ts}', {
      cwd: this.clientSrcPath,
      ignore: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}']
    });

    const usedKeys = new Set<string>();
    const testIds = new Set<string>();
    const fileBreakdown: Record<string, any> = {};

    // Analyze each file
    for (const file of files) {
      const fullPath = path.join(this.clientSrcPath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      const fileKeys = this.extractTranslationKeys(content);
      const fileTestIds = this.extractTestIds(content);

      fileKeys.forEach(key => usedKeys.add(key));
      fileTestIds.forEach(id => testIds.add(id));

      fileBreakdown[file] = {
        translationKeys: fileKeys.length,
        testIds: fileTestIds.length,
        coverage: this.calculateFileCoverage(content, fileKeys.length)
      };
    }

    // Calculate missing keys
    const missingKeys = Array.from(usedKeys).filter(key => !englishKeys.has(key));

    // Calculate coverage
    const coveragePercentage = englishKeys.size > 0 
      ? (usedKeys.size / englishKeys.size) * 100 
      : 0;

    // Analyze Quebec compliance
    const quebecAnalysis = this.analyzeQuebecCompliance(frenchKeys);

    // Analyze accessibility
    const accessibilityAnalysis = this.analyzeAccessibility(Array.from(testIds));

    const report: TranslationReport = {
      summary: {
        totalFiles: files.length,
        totalTranslationKeys: usedKeys.size,
        totalTestIds: testIds.size,
        coveragePercentage: Math.round(coveragePercentage * 100) / 100,
        missingKeys: missingKeys.length,
        qualityScore: this.calculateQualityScore(usedKeys.size, missingKeys.length, quebecAnalysis.complianceScore)
      },
      details: {
        usedKeys: Array.from(usedKeys).sort(),
        missingKeys: missingKeys.sort(),
        testIds: Array.from(testIds).sort(),
        fileBreakdown
      },
      quebec: quebecAnalysis,
      accessibility: accessibilityAnalysis
    };

    this.printReport(report);
    this.saveReport(report);
    
    return report;
  }

  private async loadTranslations(): Promise<{ englishKeys: Set<string>, frenchKeys: Map<string, string> }> {
    const content = fs.readFileSync(this.translationsPath, 'utf-8');
    
    // Extract English keys from interface
    const interfaceMatch = content.match(/export interface Translations \{([\s\S]*?)\}/);
    const englishKeys = new Set<string>();
    
    if (interfaceMatch) {
      const keyMatches = interfaceMatch[1].match(/(\w+):\s*string;/g);
      if (keyMatches) {
        keyMatches.forEach(match => {
          const key = match.split(':')[0].trim();
          englishKeys.add(key);
        });
      }
    }

    // Extract French translations
    const frenchSection = content.match(/fr:\s*\{([\s\S]*?)\}\s*\};/);
    const frenchKeys = new Map<string, string>();
    
    if (frenchSection) {
      const frenchMatches = frenchSection[1].match(/(\w+):\s*['"`]([^'"`]*?)['"`]/g);
      if (frenchMatches) {
        frenchMatches.forEach(match => {
          const [key, value] = match.split(':').map(s => s.trim());
          frenchKeys.set(key, value.slice(1, -1)); // Remove quotes
        });
      }
    }

    return { englishKeys, frenchKeys };
  }

  private extractTranslationKeys(content: string): string[] {
    const matches = content.match(/\bt\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*[a-zA-Z0-9])['"`]\s*\)/g);
    if (!matches) return [];

    return matches.map(match => {
      const keyMatch = match.match(/['"`]([^'"`]+)['"`]/);
      return keyMatch ? keyMatch[1] : '';
    }).filter(key => key.length > 0);
  }

  private extractTestIds(content: string): string[] {
    const matches = content.match(/data-testid\s*=\s*["']([^"']+)["']/g);
    if (!matches) return [];

    return matches.map(match => {
      const idMatch = match.match(/["']([^"']+)["']/);
      return idMatch ? idMatch[1] : '';
    }).filter(id => id.length > 0);
  }

  private calculateFileCoverage(content: string, translationKeysCount: number): number {
    // Estimate based on hardcoded strings vs translation usage
    const hardcodedStringMatches = content.match(/['"`][A-Z][a-zA-Z\s]{5,}['"`]/g) || [];
    const totalTextElements = hardcodedStringMatches.length + translationKeysCount;
    
    return totalTextElements > 0 ? (translationKeysCount / totalTextElements) * 100 : 100;
  }

  private analyzeQuebecCompliance(frenchKeys: Map<string, string>) {
    let complianceScore = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for common Quebec French violations
    frenchKeys.forEach((value, key) => {
      const lowerValue = value.toLowerCase();
      
      // Check for anglicisms
      if (lowerValue.includes('email')) {
        issues.push(`"${key}": Contains "email" instead of "courriel"`);
        complianceScore -= 2;
      }

      if (lowerValue.includes('login')) {
        issues.push(`"${key}": Contains "login" instead of "connexion"`);
        complianceScore -= 2;
      }

      if (lowerValue.includes('logout')) {
        issues.push(`"${key}": Contains "logout" instead of "déconnexion"`);
        complianceScore -= 2;
      }

      // Check for proper accents
      if (lowerValue.includes('a') && key.includes('management') && !lowerValue.includes('à')) {
        suggestions.push(`Consider using proper accents in "${key}"`);
      }
    });

    // Add positive suggestions
    if (complianceScore > 90) {
      suggestions.push('Excellent Quebec French compliance!');
    } else if (complianceScore > 75) {
      suggestions.push('Good Quebec French usage with minor improvements needed');
    } else {
      suggestions.push('Significant Quebec French improvements needed');
    }

    return {
      complianceScore: Math.max(0, complianceScore),
      issues,
      suggestions
    };
  }

  private analyzeAccessibility(testIds: string[]) {
    const interactivePatterns = ['button-', 'input-', 'link-', 'select-', 'textarea-'];
    const interactiveElements = testIds.filter(id =>
      interactivePatterns.some(pattern => id.includes(pattern))
    );

    // Estimate coverage based on naming conventions
    const wellNamedElements = testIds.filter(id => {
      const parts = id.split('-');
      return parts.length >= 2 && parts.every(part => part.length > 1);
    });

    const coverageScore = testIds.length > 0 
      ? (wellNamedElements.length / testIds.length) * 100 
      : 0;

    return {
      coverageScore: Math.round(coverageScore * 100) / 100,
      elementsWithoutTestIds: 0, // Would need DOM analysis to calculate
      interactiveElementsCovered: interactiveElements.length
    };
  }

  private calculateQualityScore(usedKeys: number, missingKeys: number, quebecScore: number): number {
    const coverageWeight = 0.4;
    const completenessWeight = 0.3;
    const quebecWeight = 0.3;

    const coverageScore = usedKeys > 0 ? Math.min(100, (usedKeys / 100) * 100) : 0;
    const completenessScore = usedKeys > 0 ? Math.max(0, 100 - (missingKeys / usedKeys) * 100) : 0;

    return Math.round(
      (coverageScore * coverageWeight +
       completenessScore * completenessWeight +
       quebecScore * quebecWeight) * 100
    ) / 100;
  }

  private printReport(report: TranslationReport): void {
    console.log('\n📊 TRANSLATION VALIDATION REPORT');
    console.log('================================');
    
    console.log('\n📈 SUMMARY');
    console.log(`📁 Files scanned: ${report.summary.totalFiles}`);
    console.log(`🔑 Translation keys found: ${report.summary.totalTranslationKeys}`);
    console.log(`🏷️  Test IDs found: ${report.summary.totalTestIds}`);
    console.log(`📊 Coverage: ${report.summary.coveragePercentage}%`);
    console.log(`❌ Missing keys: ${report.summary.missingKeys}`);
    console.log(`⭐ Quality score: ${report.summary.qualityScore}/100`);

    if (report.details.missingKeys.length > 0) {
      console.log('\n🚨 MISSING TRANSLATION KEYS:');
      report.details.missingKeys.slice(0, 10).forEach(key => {
        console.log(`  - ${key}`);
      });
      if (report.details.missingKeys.length > 10) {
        console.log(`  ... and ${report.details.missingKeys.length - 10} more`);
      }
    }

    console.log('\n🇫🇷 QUEBEC FRENCH COMPLIANCE');
    console.log(`Score: ${report.quebec.complianceScore}/100`);
    if (report.quebec.issues.length > 0) {
      console.log('Issues:');
      report.quebec.issues.slice(0, 5).forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }

    console.log('\n♿ ACCESSIBILITY COVERAGE');
    console.log(`Score: ${report.accessibility.coverageScore}/100`);
    console.log(`Interactive elements with test IDs: ${report.accessibility.interactiveElementsCovered}`);

    console.log('\n🎯 TOP 10 FILES BY TRANSLATION USAGE:');
    const sortedFiles = Object.entries(report.details.fileBreakdown)
      .sort(([,a], [,b]) => b.translationKeys - a.translationKeys)
      .slice(0, 10);

    sortedFiles.forEach(([file, stats]) => {
      console.log(`  - ${file}: ${stats.translationKeys} keys, ${stats.testIds} test IDs`);
    });
  }

  private saveReport(report: TranslationReport): void {
    const reportPath = path.resolve(process.cwd(), '..', 'translation-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${reportPath}`);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const reporter = new TranslationValidationReporter();
  reporter.generateReport().catch(console.error);
}

export default TranslationValidationReporter;