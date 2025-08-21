/**
 * Test Quality Validation Script for Koveo Gestion.
 * 
 * Validates test quality, effectiveness, and Quebec compliance standards.
 * Ensures all tests meet production-grade requirements for property management.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { coverageAutomation } from '../tests/utils/coverage-automation';

/**
 * Interface for test quality report data.
 */
interface TestQualityReport {
  overallScore: number;
  testCoverage: number;
  testQuality: number;
  quebecCompliance: number;
  performance: number;
  accessibility: number;
  recommendations: string[];
  failedValidations: string[];
  passedValidations: string[];
}

/**
 *
 */
interface TestFileAnalysis {
  file: string;
  testCount: number;
  assertionCount: number;
  quebecSpecificTests: number;
  mockUsage: number;
  qualityScore: number;
  issues: string[];
}

/**
 * Comprehensive test quality validation service for Quebec property management
 * compliance and development excellence standards.
 */
class TestQualityValidator {
  private projectRoot: string;
  private qualityThresholds: any;
  private quebecRequirements: string[];
  private passedValidations: string[] = [];
  private failedValidations: string[] = [];

  /**
   *
   */
  constructor() {
    this.projectRoot = process.cwd();
    this.qualityThresholds = {
      minCoverage: 95,
      minTestQuality: 85,
      minQuebecCompliance: 90,
      minPerformance: 80,
      minAccessibility: 85,
      maxTestExecutionTime: 30000, // 30 seconds
      minAssertionsPerTest: 2
    };
    this.quebecRequirements = [
      'français',
      'québécois',
      'Loi 25',
      'TPS',
      'TVQ',
      'courriel',
      'téléphone',
      'code postal',
      'règlement',
      'conformité'
    ];
  }

  /**
   * Runs comprehensive test quality validation with Quebec compliance checks.
   * @returns Promise<TestQualityReport> Complete quality validation report.
   */
  async validateTestQuality(): Promise<TestQualityReport> {
    console.warn('🔍 Starting comprehensive test quality validation...');
    console.warn('🇨🇦 Including Quebec property management compliance checks...\n');

    const report: TestQualityReport = {
      overallScore: 0,
      testCoverage: 0,
      testQuality: 0,
      quebecCompliance: 0,
      performance: 0,
      accessibility: 0,
      recommendations: [],
      failedValidations: [],
      passedValidations: []
    };

    try {
      // Reset validation arrays for each run
      this.passedValidations = [];
      this.failedValidations = [];
      
      // 1. Validate test coverage
      console.warn('📊 Validating test coverage...');
      report.testCoverage = await this.validateTestCoverage();
      
      // 2. Analyze test quality
      console.warn('🎯 Analyzing test quality...');
      report.testQuality = await this.analyzeTestQuality();
      
      // 3. Check Quebec compliance
      console.warn('🇨🇦 Checking Quebec compliance in tests...');
      report.quebecCompliance = await this.validateQuebecCompliance();
      
      // 4. Measure performance
      console.warn('⚡ Measuring test performance...');
      report.performance = await this.measureTestPerformance();
      
      // 5. Validate accessibility tests
      console.warn('♿ Validating accessibility test coverage...');
      report.accessibility = await this.validateAccessibilityTests();
      
      // 6. Set validation results
      report.passedValidations = [...this.passedValidations];
      report.failedValidations = [...this.failedValidations];
      
      // 7. Calculate overall score
      report.overallScore = this.calculateOverallScore(report);
      
      // 8. Generate recommendations
      report.recommendations = this.generateRecommendations(report);
      
      // 8. Output results
      this.outputValidationResults(report);
      
      // 9. Save detailed report
      await this.saveDetailedReport(report);
      
      return report;
      
    } catch (__error) {
      console.error('❌ Test quality validation failed:', error);
      throw error;
    }
  }

  /**
   * Validates test coverage against Quebec property management standards.
   */
  private async validateTestCoverage(): Promise<number> {
    try {
      // Run coverage analysis
      const coverageData = await coverageAutomation.runComprehensiveCoverage();
      
      const coverage = coverageData.coverageData.aggregate;
      let score = 0;
      let validations = 0;

      // Check each coverage metric
      if (coverage.statements >= this.qualityThresholds.minCoverage) {
        this.passedValidations.push(`✅ Statements coverage: ${coverage.statements}%`);
        score += 25;
      } else {
        this.failedValidations.push(`❌ Statements coverage below 95%: ${coverage.statements}%`);
      }
      validations++;

      if (coverage.branches >= 90) {
        this.passedValidations.push(`✅ Branches coverage: ${coverage.branches}%`);
        score += 25;
      } else {
        this.failedValidations.push(`❌ Branches coverage below 90%: ${coverage.branches}%`);
      }
      validations++;

      if (coverage.functions >= this.qualityThresholds.minCoverage) {
        this.passedValidations.push(`✅ Functions coverage: ${coverage.functions}%`);
        score += 25;
      } else {
        this.failedValidations.push(`❌ Functions coverage below 95%: ${coverage.functions}%`);
      }
      validations++;

      if (coverage.lines >= this.qualityThresholds.minCoverage) {
        this.passedValidations.push(`✅ Lines coverage: ${coverage.lines}%`);
        score += 25;
      } else {
        this.failedValidations.push(`❌ Lines coverage below 95%: ${coverage.lines}%`);
      }
      validations++;

      return score;
    } catch (__error) {
      this.failedValidations.push(`❌ Coverage validation failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Analyzes test quality including assertions, mocking, and best practices.
   */
  private async analyzeTestQuality(): Promise<number> {
    const testFiles = this.getAllTestFiles();
    const analyses: TestFileAnalysis[] = [];
    let totalScore = 0;

    for (const file of testFiles) {
      const analysis = await this.analyzeTestFile(file);
      analyses.push(analysis);
      totalScore += analysis.qualityScore;
    }

    const avgScore = testFiles.length > 0 ? totalScore / testFiles.length : 0;

    // Validate test quality standards
    if (avgScore >= this.qualityThresholds.minTestQuality) {
      this.passedValidations.push(`✅ Average test quality score: ${avgScore.toFixed(1)}`);
    } else {
      this.failedValidations.push(`❌ Test quality below 85%: ${avgScore.toFixed(1)}`);
    }

    // Check for specific quality issues
    const filesWithIssues = analyses.filter(a => a.issues.length > 0);
    if (filesWithIssues.length === 0) {
      this.passedValidations.push('✅ No critical test quality issues found');
    } else {
      this.failedValidations.push(`❌ ${filesWithIssues.length} files have test quality issues`);
    }

    return avgScore;
  }

  /**
   * Validates Quebec compliance requirements in test coverage.
   */
  private async validateQuebecCompliance(): Promise<number> {
    const testFiles = this.getAllTestFiles();
    let quebecTestCount = 0;
    let quebecFeatureCoverage = 0;
    const quebecFeatures = [
      'billing with Quebec taxes',
      'French language interface',
      'Law 25 compliance',
      'Quebec regulations',
      'Montreal specific features',
      'Quebec postal codes',
      'Quebec phone numbers'
    ];

    for (const file of testFiles) {
      const content = readFileSync(file, 'utf8');
      
      // Count Quebec-specific tests
      for (const requirement of this.quebecRequirements) {
        if (content.toLowerCase().includes(requirement.toLowerCase())) {
          quebecTestCount++;
          break;
        }
      }

      // Check feature coverage
      for (const feature of quebecFeatures) {
        if (content.toLowerCase().includes(feature.toLowerCase())) {
          quebecFeatureCoverage++;
        }
      }
    }

    const quebecCoveragePercent = testFiles.length > 0 ? 
      (quebecTestCount / testFiles.length) * 100 : 0;
    
    const featureCoveragePercent = quebecFeatures.length > 0 ? 
      (quebecFeatureCoverage / quebecFeatures.length) * 100 : 0;

    const overallQuebecScore = (quebecCoveragePercent + featureCoveragePercent) / 2;

    if (overallQuebecScore >= this.qualityThresholds.minQuebecCompliance) {
      this.passedValidations.push(`✅ Quebec compliance coverage: ${overallQuebecScore.toFixed(1)}%`);
    } else {
      this.failedValidations.push(`❌ Quebec compliance below 90%: ${overallQuebecScore.toFixed(1)}%`);
    }

    // Specific Quebec feature validations
    if (quebecTestCount > 0) {
      this.passedValidations.push(`✅ Quebec-specific tests found: ${quebecTestCount}`);
    } else {
      this.failedValidations.push('❌ No Quebec-specific tests found');
    }

    return overallQuebecScore;
  }

  /**
   * Measures test performance and execution efficiency.
   */
  private async measureTestPerformance(): Promise<number> {
    let performanceScore = 100;

    try {
      // Measure test execution time
      const startTime = Date.now();
      execSync('npm run test -- --passWithNoTests', { 
        stdio: 'pipe',
        timeout: this.qualityThresholds.maxTestExecutionTime
      });
      const executionTime = Date.now() - startTime;

      if (executionTime <= this.qualityThresholds.maxTestExecutionTime) {
        this.passedValidations.push(`✅ Test execution time: ${executionTime}ms`);
      } else {
        this.failedValidations.push(`❌ Tests taking too long: ${executionTime}ms`);
        performanceScore -= 30;
      }

      // Check for performance anti-patterns
      const testFiles = this.getAllTestFiles();
      let antiPatterns = 0;

      for (const file of testFiles) {
        const content = readFileSync(file, 'utf8');
        
        // Check for synchronous operations that should be async
        if (content.includes('setTimeout') && !content.includes('await')) {
          antiPatterns++;
        }
        
        // Check for excessive mocking
        const mockCount = (content.match(/jest\.mock/g) || []).length;
        if (mockCount > 10) {
          antiPatterns++;
        }
      }

      if (antiPatterns === 0) {
        this.passedValidations.push('✅ No performance anti-patterns detected');
      } else {
        this.failedValidations.push(`❌ ${antiPatterns} performance anti-patterns found`);
        performanceScore -= antiPatterns * 5;
      }

    } catch (__error) {
      this.failedValidations.push(`❌ Performance measurement failed: ${error.message}`);
      performanceScore = 0;
    }

    return Math.max(0, performanceScore);
  }

  /**
   * Validates accessibility test coverage for Quebec compliance.
   */
  private async validateAccessibilityTests(): Promise<number> {
    const testFiles = this.getAllTestFiles();
    const accessibilityTests = [
      'aria-label',
      'aria-describedby',
      'role=',
      'screen reader',
      'keyboard navigation',
      'focus management',
      'color contrast',
      'alt text',
      'tabindex'
    ];

    let accessibilityTestCount = 0;
    let filesWithA11yTests = 0;

    for (const file of testFiles) {
      const content = readFileSync(file, 'utf8');
      let fileHasA11yTests = false;

      for (const test of accessibilityTests) {
        if (content.toLowerCase().includes(test.toLowerCase())) {
          accessibilityTestCount++;
          fileHasA11yTests = true;
        }
      }

      if (fileHasA11yTests) {
        filesWithA11yTests++;
      }
    }

    const a11yCoverage = testFiles.length > 0 ? 
      (filesWithA11yTests / testFiles.length) * 100 : 0;

    if (a11yCoverage >= this.qualityThresholds.minAccessibility) {
      this.passedValidations.push(`✅ Accessibility test coverage: ${a11yCoverage.toFixed(1)}%`);
    } else {
      this.failedValidations.push(`❌ Accessibility coverage below 85%: ${a11yCoverage.toFixed(1)}%`);
    }

    if (accessibilityTestCount > 0) {
      this.passedValidations.push(`✅ Accessibility tests found: ${accessibilityTestCount}`);
    } else {
      this.failedValidations.push('❌ No accessibility tests found');
    }

    return a11yCoverage;
  }

  /**
   * Analyzes individual test file for quality metrics.
   * @param file
   */
  private async analyzeTestFile(file: string): Promise<TestFileAnalysis> {
    const content = readFileSync(file, 'utf8');
    const analysis: TestFileAnalysis = {
      file,
      testCount: 0,
      assertionCount: 0,
      quebecSpecificTests: 0,
      mockUsage: 0,
      qualityScore: 100,
      issues: []
    };

    // Count tests
    analysis.testCount = (content.match(/test\(|it\(/g) || []).length;
    
    // Count assertions
    analysis.assertionCount = (content.match(/expect\(/g) || []).length;
    
    // Count Quebec-specific content
    for (const requirement of this.quebecRequirements) {
      if (content.toLowerCase().includes(requirement.toLowerCase())) {
        analysis.quebecSpecificTests++;
      }
    }
    
    // Count mock usage
    analysis.mockUsage = (content.match(/jest\.mock|mockImplementation|mockReturnValue/g) || []).length;

    // Quality checks
    if (analysis.testCount === 0) {
      analysis.issues.push('No tests found in file');
      analysis.qualityScore -= 50;
    }

    if (analysis.assertionCount < analysis.testCount * this.qualityThresholds.minAssertionsPerTest) {
      analysis.issues.push('Insufficient assertions per test');
      analysis.qualityScore -= 20;
    }

    if (analysis.mockUsage > analysis.testCount * 3) {
      analysis.issues.push('Excessive mocking detected');
      analysis.qualityScore -= 15;
    }

    // Check for test organization
    if (!content.includes('describe(')) {
      analysis.issues.push('Tests not properly organized with describe blocks');
      analysis.qualityScore -= 10;
    }

    return analysis;
  }

  /**
   * Gets all test files in the project.
   */
  private getAllTestFiles(): string[] {
    const testDirs = ['tests/unit', 'tests/integration', 'tests/mobile', 'tests/api', 'tests/e2e'];
    const testFiles: string[] = [];

    for (const dir of testDirs) {
      const fullPath = join(this.projectRoot, dir);
      if (existsSync(fullPath)) {
        const files = this.getFilesRecursively(fullPath, ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']);
        testFiles.push(...files);
      }
    }

    return testFiles;
  }

  /**
   * Recursively gets files with specific extensions.
   * @param dir
   * @param extensions
   */
  private getFilesRecursively(dir: string, extensions: string[]): string[] {
    const files: string[] = [];
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath, extensions));
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Calculates overall quality score from individual metrics.
   * @param report
   */
  private calculateOverallScore(report: TestQualityReport): number {
    const weights = {
      testCoverage: 0.3,
      testQuality: 0.25,
      quebecCompliance: 0.25,
      performance: 0.1,
      accessibility: 0.1
    };

    return (
      report.testCoverage * weights.testCoverage +
      report.testQuality * weights.testQuality +
      report.quebecCompliance * weights.quebecCompliance +
      report.performance * weights.performance +
      report.accessibility * weights.accessibility
    );
  }

  /**
   * Generates actionable recommendations based on validation results.
   * @param report
   */
  private generateRecommendations(report: TestQualityReport): string[] {
    const recommendations: string[] = [];

    if (report.testCoverage < this.qualityThresholds.minCoverage) {
      recommendations.push('Augmenter la couverture des tests à 95% minimum');
      recommendations.push('Ajouter des tests pour les branches non couvertes');
    }

    if (report.quebecCompliance < this.qualityThresholds.minQuebecCompliance) {
      recommendations.push('Ajouter plus de tests spécifiques aux exigences québécoises');
      recommendations.push('Valider la conformité Loi 25 dans les tests');
      recommendations.push('Tester les calculs de taxes québécoises (TPS/TVQ)');
    }

    if (report.accessibility < this.qualityThresholds.minAccessibility) {
      recommendations.push('Améliorer la couverture des tests d\'accessibilité');
      recommendations.push('Ajouter des tests pour la navigation au clavier');
      recommendations.push('Valider les attributs ARIA dans les tests');
    }

    if (report.performance < this.qualityThresholds.minPerformance) {
      recommendations.push('Optimiser les temps d\'exécution des tests');
      recommendations.push('Réduire les mocks excessifs');
      recommendations.push('Paralléliser l\'exécution des tests');
    }

    if (report.testQuality < this.qualityThresholds.minTestQuality) {
      recommendations.push('Améliorer la qualité des assertions dans les tests');
      recommendations.push('Organiser les tests avec des describe blocks');
      recommendations.push('Réduire la complexité des tests');
    }

    return recommendations;
  }

  /**
   * Outputs validation results to console with color coding.
   * @param report
   */
  private outputValidationResults(report: TestQualityReport): void {
    console.warn('\n🏆 TEST QUALITY VALIDATION RESULTS');
    console.warn('=' .repeat(60));
    
    // Overall score
    const scoreColor = report.overallScore >= 90 ? '🟢' : 
                      report.overallScore >= 80 ? '🟡' : '🔴';
    console.warn(`${scoreColor} Overall Score: ${report.overallScore.toFixed(1)}%`);
    
    console.warn('\n📊 DETAILED METRICS:');
    console.warn(`   Test Coverage: ${report.testCoverage.toFixed(1)}%`);
    console.warn(`   Test Quality: ${report.testQuality.toFixed(1)}%`);
    console.warn(`   Quebec Compliance: ${report.quebecCompliance.toFixed(1)}%`);
    console.warn(`   Performance: ${report.performance.toFixed(1)}%`);
    console.warn(`   Accessibility: ${report.accessibility.toFixed(1)}%`);

    console.warn('\n✅ PASSED VALIDATIONS:');
    report.passedValidations.forEach(validation => console.warn(`   ${validation}`));

    if (report.failedValidations.length > 0) {
      console.warn('\n❌ FAILED VALIDATIONS:');
      report.failedValidations.forEach(validation => console.warn(`   ${validation}`));
    }

    if (report.recommendations.length > 0) {
      console.warn('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, i) => console.warn(`   ${i + 1}. ${rec}`));
    }

    console.warn('\n' + '=' .repeat(60));
    
    if (report.overallScore >= 95) {
      console.warn('🎉 EXCELLENT! Tests meet Quebec property management standards.');
    } else if (report.overallScore >= 85) {
      console.warn('👍 GOOD! Minor improvements needed for optimal quality.');
    } else {
      console.warn('⚠️  NEEDS IMPROVEMENT! Focus on recommendations above.');
    }
  }

  /**
   * Saves detailed validation report to file.
   * @param report
   */
  private async saveDetailedReport(report: TestQualityReport): Promise<void> {
    const reportPath = join(this.projectRoot, 'coverage', 'test-quality-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    const htmlReportPath = join(this.projectRoot, 'coverage', 'test-quality-report.html');
    const htmlContent = this.generateHTMLReport(report);
    writeFileSync(htmlReportPath, htmlContent);
    
    console.warn(`\n📄 Detailed reports saved:`);
    console.warn(`   JSON: ${reportPath}`);
    console.warn(`   HTML: ${htmlReportPath}`);
  }

  /**
   * Generates HTML report for test quality validation.
   * @param report
   */
  private generateHTMLReport(report: TestQualityReport): string {
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Koveo Gestion - Test Quality Report</title>
      <style>
        body { font-family: Inter, sans-serif; margin: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .score { font-size: 3rem; font-weight: bold; color: ${report.overallScore >= 90 ? '#10b981' : report.overallScore >= 80 ? '#f59e0b' : '#ef4444'}; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #1e40af; }
        .recommendations { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .validations { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .passed { background: #dcfce7; padding: 15px; border-radius: 8px; }
        .failed { background: #fee2e2; padding: 15px; border-radius: 8px; }
        ul { margin: 10px 0; padding-left: 20px; }
        h1, h2, h3 { color: #1e40af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏆 Koveo Gestion Test Quality Report</h1>
          <div class="score">${report.overallScore.toFixed(1)}%</div>
          <p>Rapport de qualité des tests - ${new Date().toLocaleDateString('fr-CA')}</p>
        </div>

        <div class="metrics">
          <div class="metric">
            <h3>Couverture</h3>
            <div class="metric-value">${report.testCoverage.toFixed(1)}%</div>
          </div>
          <div class="metric">
            <h3>Qualité</h3>
            <div class="metric-value">${report.testQuality.toFixed(1)}%</div>
          </div>
          <div class="metric">
            <h3>Conformité QC</h3>
            <div class="metric-value">${report.quebecCompliance.toFixed(1)}%</div>
          </div>
          <div class="metric">
            <h3>Performance</h3>
            <div class="metric-value">${report.performance.toFixed(1)}%</div>
          </div>
          <div class="metric">
            <h3>Accessibilité</h3>
            <div class="metric-value">${report.accessibility.toFixed(1)}%</div>
          </div>
        </div>

        ${report.recommendations.length > 0 ? `
        <div class="recommendations">
          <h3>💡 Recommandations</h3>
          <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="validations">
          <div class="passed">
            <h3>✅ Validations Réussies</h3>
            <ul>
              ${report.passedValidations.map(val => `<li>${val}</li>`).join('')}
            </ul>
          </div>
          
          ${report.failedValidations.length > 0 ? `
          <div class="failed">
            <h3>❌ Validations Échouées</h3>
            <ul>
              ${report.failedValidations.map(val => `<li>${val}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
    `;
  }

}

// Export singleton instance for use in other modules
export const testQualityValidator = new TestQualityValidator();

// Run validation if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testQualityValidator.validateTestQuality()
    .then(report => {
      console.warn(`\n🏆 Test quality validation completed with score: ${report.overallScore}%`);
      process.exit(report.overallScore >= 90 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test quality validation failed:', error);
      process.exit(1);
    });
}

export { TestQualityValidator };