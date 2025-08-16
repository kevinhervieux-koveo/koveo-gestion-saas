#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { storage } from '../server/storage';
import type { InsertImprovementSuggestion } from '../shared/schema';

/**
 * Quality check thresholds configuration.
 */
const THRESHOLDS = {
  MAX_COMPLEXITY: 10,
  MIN_COVERAGE: 90,
} as const;

/**
 * Colors for console output formatting.
 */
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
} as const;

/**
 * Interface for complexity analysis results.
 */
interface ComplexityResult {
  averageComplexity: number;
  maxComplexity: number;
  totalFunctions: number;
  complexFunctions: Array<{
    name: string;
    complexity: number;
    file: string;
  }>;
}

/**
 * Interface for coverage analysis results.
 */
interface CoverageResult {
  totalCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  lineCoverage: number;
  uncoveredFiles: string[];
}

/**
 * Interface for translation coverage analysis.
 */
interface TranslationCoverageResult {
  totalComponents: number;
  translatedComponents: number;
  coveragePercentage: number;
  missingTranslations: Array<{
    component: string;
    file: string;
    missingKeys: string[];
  }>;
}

/**
 * Interface for accessibility analysis.
 */
interface AccessibilityResult {
  totalComponents: number;
  accessibleComponents: number;
  coveragePercentage: number;
  missingAccessibility: Array<{
    component: string;
    file: string;
    issues: string[];
  }>;
}

/**
 * Interface for component coverage analysis.
 */
interface ComponentCoverageResult {
  totalComponents: number;
  testedComponents: number;
  coveragePercentage: number;
  untestedComponents: Array<{
    component: string;
    file: string;
    type: 'ui' | 'layout' | 'form' | 'page';
  }>;
}

/**
 * Interface for vulnerability analysis results.
 */
interface VulnerabilityResult {
  vulnerabilities: Array<{
    severity: 'critical' | 'high' | 'moderate' | 'low';
    title: string;
    module: string;
    url?: string;
  }>;
  totalVulnerabilities: number;
}

/**
 * Generates improvement suggestions based on analysis results.
 * @param complexity
 * @param coverage
 * @param vulnerabilities
 */
async function generateSuggestions(
  complexity: ComplexityResult,
  coverage: CoverageResult,
  vulnerabilities: VulnerabilityResult,
  translationCoverage: TranslationCoverageResult,
  accessibility: AccessibilityResult,
  componentCoverage: ComponentCoverageResult
): Promise<InsertImprovementSuggestion[]> {
  const suggestions: InsertImprovementSuggestion[] = [];

  // Complexity suggestions
  if (complexity.averageComplexity > THRESHOLDS.MAX_COMPLEXITY) {
    suggestions.push({
      title: 'High Average Code Complexity',
      description: `Average cyclomatic complexity (${complexity.averageComplexity.toFixed(2)}) exceeds threshold (${THRESHOLDS.MAX_COMPLEXITY}). Consider refactoring complex functions to improve maintainability.`,
      category: 'Code Quality',
      priority: 'High',
      status: 'New',
      filePath: null,
    });
  }

  // Add suggestions for highly complex functions
  complexity.complexFunctions
    .filter(func => func.complexity > THRESHOLDS.MAX_COMPLEXITY * 1.5)
    .slice(0, 3)
    .forEach(func => {
      suggestions.push({
        title: `Complex Function: ${func.name}`,
        description: `Function has complexity of ${func.complexity}. Consider breaking it into smaller, more focused functions.`,
        category: 'Code Quality',
        priority: func.complexity > THRESHOLDS.MAX_COMPLEXITY * 2 ? 'Critical' : 'High',
        status: 'New',
        filePath: func.file,
      });
    });

  // Coverage suggestions
  if (coverage.totalCoverage < THRESHOLDS.MIN_COVERAGE) {
    suggestions.push({
      title: 'Insufficient Test Coverage',
      description: `Test coverage (${coverage.totalCoverage.toFixed(1)}%) is below the minimum threshold (${THRESHOLDS.MIN_COVERAGE}%). Add more tests to ensure code reliability.`,
      category: 'Testing',
      priority: coverage.totalCoverage < 50 ? 'Critical' : 'High',
      status: 'New',
      filePath: null,
    });
  }

  // Add suggestions for uncovered files
  if (coverage.uncoveredFiles.length > 0) {
    coverage.uncoveredFiles.slice(0, 3).forEach(file => {
      suggestions.push({
        title: `Missing Tests: ${file.split('/').pop()}`,
        description: `This file lacks test coverage. Create unit tests to ensure functionality is properly validated.`,
        category: 'Testing',
        priority: 'Medium',
        status: 'New',
        filePath: file,
      });
    });
  }

  // Vulnerability suggestions
  const criticalVulns = vulnerabilities.vulnerabilities.filter(v => v.severity === 'critical');
  const highVulns = vulnerabilities.vulnerabilities.filter(v => v.severity === 'high');
  
  if (criticalVulns.length > 0) {
    suggestions.push({
      title: `${criticalVulns.length} Critical Security Vulnerabilities`,
      description: `Critical vulnerabilities detected in dependencies: ${criticalVulns.map(v => v.module).join(', ')}. Update packages immediately.`,
      category: 'Security',
      priority: 'Critical',
      status: 'New',
      filePath: 'package.json',
    });
  }

  if (highVulns.length > 0) {
    suggestions.push({
      title: `${highVulns.length} High Security Vulnerabilities`,
      description: `High-severity vulnerabilities found in: ${highVulns.map(v => v.module).join(', ')}. Review and update affected packages.`,
      category: 'Security',
      priority: 'High',
      status: 'New',
      filePath: 'package.json',
    });
  }

  // Documentation suggestions
  const jsDocErrors = await checkJSDocCoverage();
  if (jsDocErrors > 50) {
    suggestions.push({
      title: 'Insufficient JSDoc Documentation',
      description: `${jsDocErrors} functions/classes lack proper JSDoc documentation. Document public APIs for better maintainability.`,
      category: 'Documentation',
      priority: jsDocErrors > 100 ? 'High' : 'Medium',
      status: 'New',
      filePath: null,
    });
  }

  // Performance suggestions
  const buildTime = await checkBuildPerformance();
  if (buildTime > 30000) { // 30 seconds
    suggestions.push({
      title: 'Slow Build Performance',
      description: `Build time (${(buildTime / 1000).toFixed(1)}s) is excessive. Consider optimizing bundle size and build configuration.`,
      category: 'Performance',
      priority: buildTime > 60000 ? 'High' : 'Medium',
      status: 'New',
      filePath: 'vite.config.ts',
    });
  }

  // Translation coverage suggestions
  if (translationCoverage.coveragePercentage < 100) {
    suggestions.push({
      title: 'Incomplete Translation Coverage',
      description: `${translationCoverage.totalComponents - translationCoverage.translatedComponents} components lack proper translation support. This includes critical UI elements like sidebar navigation.`,
      category: 'Documentation',
      priority: translationCoverage.coveragePercentage < 80 ? 'High' : 'Medium',
      status: 'New',
      filePath: null,
    });
  }

  // Add specific translation issues
  translationCoverage.missingTranslations.slice(0, 5).forEach(missing => {
    suggestions.push({
      title: `Missing Translations: ${missing.component}`,
      description: `Component lacks translation keys: ${missing.missingKeys.join(', ')}. Ensure all user-facing text supports Quebec's bilingual requirements.`,
      category: 'Documentation',
      priority: missing.component.includes('sidebar') || missing.component.includes('navigation') ? 'High' : 'Medium',
      status: 'New',
      filePath: missing.file,
    });
  });

  // Accessibility suggestions
  if (accessibility.coveragePercentage < 95) {
    suggestions.push({
      title: 'Accessibility Compliance Issues',
      description: `${accessibility.totalComponents - accessibility.accessibleComponents} components lack proper accessibility features. Quebec Law 25 requires full accessibility compliance.`,
      category: 'Security',
      priority: 'High',
      status: 'New',
      filePath: null,
    });
  }

  // Component testing suggestions
  if (componentCoverage.coveragePercentage < 85) {
    suggestions.push({
      title: 'Insufficient Component Test Coverage',
      description: `${componentCoverage.totalComponents - componentCoverage.testedComponents} UI components lack proper test coverage. Critical user interfaces require comprehensive testing.`,
      category: 'Testing',
      priority: componentCoverage.coveragePercentage < 60 ? 'Critical' : 'High',
      status: 'New',
      filePath: null,
    });
  }

  // Add specific component testing issues for critical components
  componentCoverage.untestedComponents
    .filter(comp => comp.type === 'layout' || comp.component.includes('sidebar') || comp.component.includes('navigation'))
    .slice(0, 3)
    .forEach(comp => {
      suggestions.push({
        title: `Critical Component Needs Tests: ${comp.component}`,
        description: `This ${comp.type} component lacks test coverage. Layout and navigation components require thorough testing for user experience reliability.`,
        category: 'Testing',
        priority: 'High',
        status: 'New',
        filePath: comp.file,
      });
    });

  return suggestions;
}

/**
 * Checks JSDoc documentation coverage.
 */
async function checkJSDocCoverage(): Promise<number> {
  try {
    const output = execSync('npm run lint:check 2>&1 || true', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    const jsDocMatches = output.match(/jsdoc/gi) || [];
    return jsDocMatches.length;
  } catch {
    return 0;
  }
}

/**
 * Checks build performance.
 */
async function checkBuildPerformance(): Promise<number> {
  try {
    const startTime = Date.now();
    execSync('npm run build --silent', { 
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000 // 2 minute timeout
    });
    return Date.now() - startTime;
  } catch {
    return 0;
  }
}

/**
 * Analyzes code complexity using complexity-report.
 * @returns Promise containing complexity analysis results.
 */
async function analyzeComplexity(): Promise<ComplexityResult> {
  try {
    console.log('📊 Analyzing code complexity...');
    
    // Run complexity analysis on TypeScript files
    const complexityOutput = execSync(
      'npx complexity-report --format json client/src/**/*.{ts,tsx} server/**/*.{ts,tsx} shared/**/*.{ts,tsx} 2>/dev/null || true',
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    let complexityData;
    try {
      complexityData = JSON.parse(complexityOutput);
    } catch {
      // Fallback if complexity-report fails
      return {
        averageComplexity: 0,
        maxComplexity: 0,
        totalFunctions: 0,
        complexFunctions: [],
      };
    }
    
    // Calculate average complexity from all functions
    let totalComplexity = 0;
    let functionCount = 0;
    let maxComplexity = 0;
    const complexFunctions: ComplexityResult['complexFunctions'] = [];

    if (complexityData.functions) {
      complexityData.functions.forEach((func: any) => {
        const complexity = func.complexity?.cyclomatic || 0;
        totalComplexity += complexity;
        functionCount++;
        maxComplexity = Math.max(maxComplexity, complexity);
        
        if (complexity > THRESHOLDS.MAX_COMPLEXITY) {
          complexFunctions.push({
            name: func.name || 'anonymous',
            complexity,
            file: func.file || 'unknown',
          });
        }
      });
    }

    const averageComplexity = functionCount > 0 ? totalComplexity / functionCount : 0;

    return {
      averageComplexity: Math.round(averageComplexity * 100) / 100,
      maxComplexity,
      totalFunctions: functionCount,
      complexFunctions: complexFunctions.sort((a, b) => b.complexity - a.complexity),
    };
  } catch (error) {
    console.warn(`${COLORS.YELLOW}⚠️  Complexity analysis failed: ${error}${COLORS.RESET}`);
    return {
      averageComplexity: 0,
      maxComplexity: 0,
      totalFunctions: 0,
      complexFunctions: [],
    };
  }
}

/**
 * Analyzes test coverage from Jest coverage reports.
 * @returns Promise containing coverage analysis results.
 */
async function analyzeCoverage(): Promise<CoverageResult> {
  try {
    console.log('🧪 Analyzing test coverage...');
    
    // Run Jest with coverage
    execSync('npm run test:coverage -- --silent 2>/dev/null || true', { 
      encoding: 'utf-8', 
      stdio: 'pipe' 
    });

    // Read coverage summary
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    if (!existsSync(coveragePath)) {
      return {
        totalCoverage: 0,
        branchCoverage: 0,
        functionCoverage: 0,
        lineCoverage: 0,
        uncoveredFiles: [],
      };
    }

    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));
    const totalCoverage = coverageData.total;
    
    // Find files with low coverage
    const uncoveredFiles: string[] = [];
    Object.entries(coverageData).forEach(([file, data]: [string, any]) => {
      if (file !== 'total' && data.statements.pct < 50) {
        uncoveredFiles.push(file);
      }
    });

    return {
      totalCoverage: totalCoverage.statements.pct,
      branchCoverage: totalCoverage.branches.pct,
      functionCoverage: totalCoverage.functions.pct,
      lineCoverage: totalCoverage.lines.pct,
      uncoveredFiles,
    };
  } catch (error) {
    console.warn(`${COLORS.YELLOW}⚠️  Coverage analysis failed: ${error}${COLORS.RESET}`);
    return {
      totalCoverage: 0,
      branchCoverage: 0,
      functionCoverage: 0,
      lineCoverage: 0,
      uncoveredFiles: [],
    };
  }
}

/**
 * Analyzes translation coverage across all UI components.
 */
async function analyzeTranslationCoverage(): Promise<TranslationCoverageResult> {
  try {
    console.log('🌐 Analyzing translation coverage...');
    
    const componentFiles = execSync(
      'find client/src -name "*.tsx" -o -name "*.ts" | grep -E "(components|pages|layout)" | head -100',
      { encoding: 'utf-8' }
    ).trim().split('\n').filter(Boolean);
    
    const missingTranslations: TranslationCoverageResult['missingTranslations'] = [];
    let translatedComponents = 0;
    
    for (const file of componentFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const fileName = file.split('/').pop() || file;
        
        // Check for translation usage patterns
        const hasTranslationHook = content.includes('useLanguage') || content.includes('useTranslation');
        const hasHardcodedText = /['"](\w+\s+\w+.*?)['"]/g.test(content.replace(/import.*?;/g, ''));
        const hasNavigationText = content.includes('sidebar') || content.includes('navigation') || content.includes('menu');
        
        if (hasTranslationHook || !hasHardcodedText) {
          translatedComponents++;
        } else {
          const hardcodedMatches = content.match(/['"](\w+\s+\w+.*?)['"]/g) || [];
          const missingKeys = hardcodedMatches
            .filter(match => !/^(className|src|href|alt|id|data-|aria-)/.test(match.replace(/['"]/, '')))
            .slice(0, 5)
            .map(match => match.replace(/['"]/, ''));
          
          if (missingKeys.length > 0 || hasNavigationText) {
            missingTranslations.push({
              component: fileName.replace(/\.(tsx?|jsx?)$/, ''),
              file,
              missingKeys: missingKeys.length > 0 ? missingKeys : ['Navigation text needs translation'],
            });
          } else {
            translatedComponents++;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
    
    return {
      totalComponents: componentFiles.length,
      translatedComponents,
      coveragePercentage: Math.round((translatedComponents / componentFiles.length) * 100),
      missingTranslations,
    };
  } catch (error) {
    console.warn(`🌐 Translation analysis failed: ${error}`);
    return {
      totalComponents: 0,
      translatedComponents: 0,
      coveragePercentage: 0,
      missingTranslations: [],
    };
  }
}

/**
 * Analyzes accessibility compliance across components.
 */
async function analyzeAccessibility(): Promise<AccessibilityResult> {
  try {
    console.log('♿ Analyzing accessibility compliance...');
    
    const componentFiles = execSync(
      'find client/src -name "*.tsx" | grep -E "(components|pages)" | head -100',
      { encoding: 'utf-8' }
    ).trim().split('\n').filter(Boolean);
    
    const missingAccessibility: AccessibilityResult['missingAccessibility'] = [];
    let accessibleComponents = 0;
    
    for (const file of componentFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const fileName = file.split('/').pop() || file;
        
        // Check for accessibility patterns
        const hasAriaLabels = content.includes('aria-label') || content.includes('aria-describedby');
        const hasSemanticHTML = /<(button|nav|main|header|footer|section|article)/g.test(content);
        const hasInteractiveElements = /<(button|input|select|textarea)/g.test(content);
        const hasKeyboardHandlers = content.includes('onKeyDown') || content.includes('onKeyPress');
        
        const issues: string[] = [];
        
        if (hasInteractiveElements && !hasAriaLabels) {
          issues.push('Missing ARIA labels for interactive elements');
        }
        
        if (content.includes('<div') && content.includes('onClick') && !content.includes('role=')) {
          issues.push('Clickable divs need proper roles');
        }
        
        if (hasInteractiveElements && !hasKeyboardHandlers) {
          issues.push('Missing keyboard navigation support');
        }
        
        if (!hasSemanticHTML && content.includes('className')) {
          issues.push('Consider using semantic HTML elements');
        }
        
        if (issues.length === 0) {
          accessibleComponents++;
        } else {
          missingAccessibility.push({
            component: fileName.replace(/\.(tsx?|jsx?)$/, ''),
            file,
            issues,
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }
    
    return {
      totalComponents: componentFiles.length,
      accessibleComponents,
      coveragePercentage: Math.round((accessibleComponents / componentFiles.length) * 100),
      missingAccessibility,
    };
  } catch (error) {
    console.warn(`♿ Accessibility analysis failed: ${error}`);
    return {
      totalComponents: 0,
      accessibleComponents: 0,
      coveragePercentage: 0,
      missingAccessibility: [],
    };
  }
}

/**
 * Analyzes component test coverage.
 */
async function analyzeComponentCoverage(): Promise<ComponentCoverageResult> {
  try {
    console.log('🧩 Analyzing component test coverage...');
    
    const componentFiles = execSync(
      'find client/src -name "*.tsx" | grep -E "(components|pages|layout)" | head -100',
      { encoding: 'utf-8' }
    ).trim().split('\n').filter(Boolean);
    
    const testFiles = execSync(
      'find tests -name "*.test.tsx" -o -name "*.test.ts" 2>/dev/null || echo ""',
      { encoding: 'utf-8' }
    ).trim().split('\n').filter(Boolean);
    
    const testedComponentNames = new Set();
    
    // Extract component names from test files
    for (const testFile of testFiles) {
      try {
        const content = readFileSync(testFile, 'utf-8');
        const componentMatches = content.match(/describe\(['"]([^'"]+)['"],/g) || [];
        componentMatches.forEach(match => {
          const componentName = match.match(/describe\(['"]([^'"]+)['"],/)?.[1];
          if (componentName) {
            testedComponentNames.add(componentName.toLowerCase());
          }
        });
      } catch {
        // Skip files that can't be read
      }
    }
    
    const untestedComponents: ComponentCoverageResult['untestedComponents'] = [];
    let testedComponents = 0;
    
    for (const file of componentFiles) {
      const fileName = file.split('/').pop() || file;
      const componentName = fileName.replace(/\.(tsx?|jsx?)$/, '').toLowerCase();
      
      let componentType: 'ui' | 'layout' | 'form' | 'page' = 'ui';
      if (file.includes('/pages/')) componentType = 'page';
      else if (file.includes('/layout/') || componentName.includes('sidebar') || componentName.includes('header')) componentType = 'layout';
      else if (file.includes('/forms/') || componentName.includes('form')) componentType = 'form';
      
      if (testedComponentNames.has(componentName) || testedComponentNames.has(componentName.replace(/[\W]/g, ''))) {
        testedComponents++;
      } else {
        untestedComponents.push({
          component: fileName.replace(/\.(tsx?|jsx?)$/, ''),
          file,
          type: componentType,
        });
      }
    }
    
    return {
      totalComponents: componentFiles.length,
      testedComponents,
      coveragePercentage: Math.round((testedComponents / componentFiles.length) * 100),
      untestedComponents,
    };
  } catch (error) {
    console.warn(`🧩 Component coverage analysis failed: ${error}`);
    return {
      totalComponents: 0,
      testedComponents: 0,
      coveragePercentage: 0,
      untestedComponents: [],
    };
  }
}

/**
 * Analyzes security vulnerabilities using npm audit.
 * @returns Promise containing vulnerability analysis results.
 */
async function analyzeVulnerabilities(): Promise<VulnerabilityResult> {
  try {
    console.log('🔒 Analyzing security vulnerabilities...');
    
    const auditOutput = execSync('npm audit --json 2>/dev/null || true', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    let auditData;
    try {
      auditData = JSON.parse(auditOutput);
    } catch {
      return {
        vulnerabilities: [],
        totalVulnerabilities: 0,
      };
    }

    const vulnerabilities: VulnerabilityResult['vulnerabilities'] = [];
    
    if (auditData.vulnerabilities) {
      Object.values(auditData.vulnerabilities).forEach((vuln: any) => {
        if (vuln.severity && ['critical', 'high', 'moderate', 'low'].includes(vuln.severity)) {
          vulnerabilities.push({
            severity: vuln.severity,
            title: vuln.title || vuln.name || 'Unknown vulnerability',
            module: vuln.name || 'unknown',
            url: vuln.url,
          });
        }
      });
    }

    return {
      vulnerabilities: vulnerabilities.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      totalVulnerabilities: vulnerabilities.length,
    };
  } catch (error) {
    console.warn(`${COLORS.YELLOW}⚠️  Vulnerability analysis failed: ${error}${COLORS.RESET}`);
    return {
      vulnerabilities: [],
      totalVulnerabilities: 0,
    };
  }
}

/**
 * Validates quality metrics against defined thresholds.
 * @param complexity - Complexity analysis results.
 * @param coverage - Coverage analysis results.
 * @param vulnerabilities - Vulnerability analysis results.
 * @returns Boolean indicating if all thresholds are met.
 */
function validateQuality(
  complexity: ComplexityResult, 
  coverage: CoverageResult,
  vulnerabilities: VulnerabilityResult,
  translationCoverage: TranslationCoverageResult,
  accessibility: AccessibilityResult,
  componentCoverage: ComponentCoverageResult
): boolean {
  let isValid = true;
  
  console.log('\n🎯 Quality Gate Results:');
  console.log('=' .repeat(50));
  
  // Complexity validation
  console.log(`📊 Code Complexity:`);
  console.log(`   Average: ${complexity.averageComplexity} (threshold: ≤${THRESHOLDS.MAX_COMPLEXITY})`);
  console.log(`   Maximum: ${complexity.maxComplexity}`);
  console.log(`   Functions: ${complexity.totalFunctions}`);
  
  if (complexity.averageComplexity > THRESHOLDS.MAX_COMPLEXITY) {
    console.log(`${COLORS.RED}❌ COMPLEXITY THRESHOLD EXCEEDED!${COLORS.RESET}`);
    console.log(`   Average complexity (${complexity.averageComplexity}) exceeds maximum allowed (${THRESHOLDS.MAX_COMPLEXITY})`);
    isValid = false;
  } else {
    console.log(`${COLORS.GREEN}✅ Complexity within acceptable range${COLORS.RESET}`);
  }
  
  // Coverage validation
  console.log(`\n🧪 Test Coverage:`);
  console.log(`   Overall: ${coverage.totalCoverage}% (threshold: ≥${THRESHOLDS.MIN_COVERAGE}%)`);
  console.log(`   Branches: ${coverage.branchCoverage}%`);
  console.log(`   Functions: ${coverage.functionCoverage}%`);
  console.log(`   Lines: ${coverage.lineCoverage}%`);
  
  if (coverage.totalCoverage < THRESHOLDS.MIN_COVERAGE) {
    console.log(`${COLORS.RED}❌ COVERAGE THRESHOLD NOT MET!${COLORS.RESET}`);
    console.log(`   Coverage (${coverage.totalCoverage}%) below minimum required (${THRESHOLDS.MIN_COVERAGE}%)`);
    isValid = false;
  } else {
    console.log(`${COLORS.GREEN}✅ Coverage meets requirements${COLORS.RESET}`);
  }
  
  // Vulnerability validation
  console.log(`\n🔒 Security Vulnerabilities:`);
  const criticalCount = vulnerabilities.vulnerabilities.filter(v => v.severity === 'critical').length;
  const highCount = vulnerabilities.vulnerabilities.filter(v => v.severity === 'high').length;
  
  console.log(`   Critical: ${criticalCount}`);
  console.log(`   High: ${highCount}`);
  console.log(`   Total: ${vulnerabilities.totalVulnerabilities}`);
  
  if (criticalCount > 0) {
    console.log(`${COLORS.RED}❌ CRITICAL VULNERABILITIES FOUND!${COLORS.RESET}`);
    isValid = false;
  } else if (highCount > 0) {
    console.log(`${COLORS.YELLOW}⚠️  High vulnerabilities detected${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.GREEN}✅ No critical security issues${COLORS.RESET}`);
  }
  
  // Translation coverage validation
  console.log(`\n🌐 Translation Coverage:`);
  console.log(`   Components: ${translationCoverage.translatedComponents}/${translationCoverage.totalComponents} (${translationCoverage.coveragePercentage}%)`);
  console.log(`   Missing translations: ${translationCoverage.missingTranslations.length}`);
  
  if (translationCoverage.coveragePercentage < 100) {
    console.log(`${COLORS.YELLOW}⚠️  Translation gaps detected (including sidebar/navigation)${COLORS.RESET}`);
    if (translationCoverage.missingTranslations.some(m => m.component.includes('sidebar') || m.component.includes('navigation'))) {
      console.log(`${COLORS.RED}❌ Critical navigation components lack translation support${COLORS.RESET}`);
      isValid = false;
    }
  } else {
    console.log(`${COLORS.GREEN}✅ Full translation coverage achieved${COLORS.RESET}`);
  }
  
  // Accessibility validation
  console.log(`\n♿ Accessibility Compliance:`);
  console.log(`   Accessible components: ${accessibility.accessibleComponents}/${accessibility.totalComponents} (${accessibility.coveragePercentage}%)`);
  console.log(`   Accessibility issues: ${accessibility.missingAccessibility.length}`);
  
  if (accessibility.coveragePercentage < 95) {
    console.log(`${COLORS.RED}❌ ACCESSIBILITY COMPLIANCE ISSUES!${COLORS.RESET}`);
    console.log(`   Quebec Law 25 requires full accessibility compliance`);
    isValid = false;
  } else {
    console.log(`${COLORS.GREEN}✅ Accessibility requirements met${COLORS.RESET}`);
  }
  
  // Component testing validation
  console.log(`\n🧩 Component Test Coverage:`);
  console.log(`   Tested components: ${componentCoverage.testedComponents}/${componentCoverage.totalComponents} (${componentCoverage.coveragePercentage}%)`);
  console.log(`   Untested components: ${componentCoverage.untestedComponents.length}`);
  
  if (componentCoverage.coveragePercentage < 85) {
    console.log(`${COLORS.YELLOW}⚠️  Component test coverage below recommended threshold${COLORS.RESET}`);
    const criticalUntested = componentCoverage.untestedComponents.filter(c => 
      c.type === 'layout' || c.component.includes('sidebar') || c.component.includes('navigation')
    );
    if (criticalUntested.length > 0) {
      console.log(`${COLORS.RED}❌ Critical UI components lack test coverage${COLORS.RESET}`);
      isValid = false;
    }
  } else {
    console.log(`${COLORS.GREEN}✅ Component testing coverage adequate${COLORS.RESET}`);
  }
  
  return isValid;
}

/**
 * Main function to execute quality checks and save to database.
 */
async function main(): Promise<void> {
  console.log(`${COLORS.BLUE}🚀 Starting Koveo Gestion Pillar Framework Auditor${COLORS.RESET}\n`);
  
  try {
    // Get existing suggestions to avoid duplicates
    console.log('📋 Checking existing suggestions...');
    const existingSuggestions = await storage.getImprovementSuggestions();
    const existingTitles = new Set(
      existingSuggestions
        .filter(s => s.status === 'New' || s.status === 'Acknowledged')
        .map(s => s.title)
    );
    
    // Run analysis in parallel for efficiency
    const [complexity, coverage, vulnerabilities, translationCoverage, accessibility, componentCoverage] = await Promise.all([
      analyzeComplexity(),
      analyzeCoverage(),
      analyzeVulnerabilities(),
      analyzeTranslationCoverage(),
      analyzeAccessibility(),
      analyzeComponentCoverage(),
    ]);
    
    // Generate suggestions based on findings
    const allSuggestions = await generateSuggestions(complexity, coverage, vulnerabilities, translationCoverage, accessibility, componentCoverage);
    
    // Filter out suggestions that already exist (by title)
    const newSuggestions = allSuggestions.filter(
      suggestion => !existingTitles.has(suggestion.title)
    );
    
    // Save only new suggestions to database
    if (newSuggestions.length > 0) {
      console.log(`\n💾 Saving ${newSuggestions.length} new improvement suggestions to database...`);
      for (const suggestion of newSuggestions) {
        await storage.createImprovementSuggestion(suggestion);
        console.log(`   ✓ ${suggestion.title} (${suggestion.priority})`);
      }
    } else {
      console.log(`\n✅ No new suggestions to add. ${existingSuggestions.length} existing suggestions remain.`);
    }
    
    // Validate against thresholds
    const isQualityValid = validateQuality(complexity, coverage, vulnerabilities, translationCoverage, accessibility, componentCoverage);
    
    console.log('\n' + '='.repeat(50));
    
    const totalSuggestions = existingSuggestions.filter(
      s => s.status === 'New' || s.status === 'Acknowledged'
    ).length + newSuggestions.length;
    
    if (isQualityValid) {
      console.log(`${COLORS.GREEN}🎉 ALL QUALITY GATES PASSED!${COLORS.RESET}`);
      console.log(`Code meets all quality and coverage requirements.`);
      console.log(`${newSuggestions.length} new suggestions added (${totalSuggestions} total active).`);
      process.exit(0);
    } else {
      console.log(`${COLORS.RED}🚫 QUALITY GATE FAILURE!${COLORS.RESET}`);
      console.log(`Code does not meet quality requirements.`);
      console.log(`${newSuggestions.length} new issues found (${totalSuggestions} total require attention).`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`${COLORS.RED}💥 Auditor failed with error: ${error}${COLORS.RESET}`);
    process.exit(1);
  }
}

// Execute main function
main().catch((error) => {
  console.error(`${COLORS.RED}Fatal error: ${error}${COLORS.RESET}`);
  process.exit(1);
});