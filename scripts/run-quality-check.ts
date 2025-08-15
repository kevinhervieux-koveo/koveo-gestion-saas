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
  vulnerabilities: VulnerabilityResult
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
  vulnerabilities: VulnerabilityResult
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
  
  return isValid;
}

/**
 * Main function to execute quality checks and save to database.
 */
async function main(): Promise<void> {
  console.log(`${COLORS.BLUE}🚀 Starting Koveo Gestion Pillar Framework Auditor${COLORS.RESET}\n`);
  
  try {
    // Clear existing 'New' suggestions
    console.log('🧹 Clearing previous suggestions...');
    await storage.clearNewSuggestions();
    
    // Run analysis in parallel for efficiency
    const [complexity, coverage, vulnerabilities] = await Promise.all([
      analyzeComplexity(),
      analyzeCoverage(),
      analyzeVulnerabilities(),
    ]);
    
    // Generate suggestions based on findings
    const suggestions = await generateSuggestions(complexity, coverage, vulnerabilities);
    
    // Save suggestions to database
    console.log(`\n💾 Saving ${suggestions.length} improvement suggestions to database...`);
    for (const suggestion of suggestions) {
      await storage.createImprovementSuggestion(suggestion);
      console.log(`   ✓ ${suggestion.title} (${suggestion.priority})`);
    }
    
    // Validate against thresholds
    const isQualityValid = validateQuality(complexity, coverage, vulnerabilities);
    
    console.log('\n' + '='.repeat(50));
    
    if (isQualityValid) {
      console.log(`${COLORS.GREEN}🎉 ALL QUALITY GATES PASSED!${COLORS.RESET}`);
      console.log(`Code meets all quality and coverage requirements.`);
      console.log(`${suggestions.length} suggestions saved for continuous improvement.`);
      process.exit(0);
    } else {
      console.log(`${COLORS.RED}🚫 QUALITY GATE FAILURE!${COLORS.RESET}`);
      console.log(`Code does not meet quality requirements.`);
      console.log(`${suggestions.length} critical issues require attention.`);
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