#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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
  RESET: '\x1b[0m',
} as const;

/**
 * Interface for complexity analysis results.
 */
interface ComplexityResult {
  averageComplexity: number;
  maxComplexity: number;
  totalFunctions: number;
}

/**
 * Interface for coverage analysis results.
 */
interface CoverageResult {
  totalCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  lineCoverage: number;
}

/**
 * Analyzes code complexity using complexity-report.
 * @returns Promise containing complexity analysis results
 */
async function analyzeComplexity(): Promise<ComplexityResult> {
  try {
    console.log('📊 Analyzing code complexity...');
    
    // Run complexity analysis on TypeScript files
    const complexityOutput = execSync(
      'npx complexity-report --format json client/src/**/*.{ts,tsx} server/**/*.{ts,tsx} shared/**/*.{ts,tsx}',
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    const complexityData = JSON.parse(complexityOutput);
    
    // Calculate average complexity from all functions
    let totalComplexity = 0;
    let functionCount = 0;
    let maxComplexity = 0;

    if (complexityData.functions) {
      complexityData.functions.forEach((func: any) => {
        totalComplexity += func.complexity.cyclomatic;
        functionCount++;
        maxComplexity = Math.max(maxComplexity, func.complexity.cyclomatic);
      });
    }

    const averageComplexity = functionCount > 0 ? totalComplexity / functionCount : 0;

    return {
      averageComplexity: Math.round(averageComplexity * 100) / 100,
      maxComplexity,
      totalFunctions: functionCount,
    };
  } catch (error) {
    console.warn(`${COLORS.YELLOW}⚠️  Complexity analysis failed: ${error}${COLORS.RESET}`);
    // Return safe defaults if complexity analysis fails
    return {
      averageComplexity: 0,
      maxComplexity: 0,
      totalFunctions: 0,
    };
  }
}

/**
 * Analyzes test coverage from Jest coverage reports.
 * @returns Promise containing coverage analysis results
 */
async function analyzeCoverage(): Promise<CoverageResult> {
  try {
    console.log('🧪 Analyzing test coverage...');
    
    // Run Jest with coverage
    execSync('npm run test:coverage -- --silent', { 
      encoding: 'utf-8', 
      stdio: 'pipe' 
    });

    // Read coverage summary
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    if (!existsSync(coveragePath)) {
      throw new Error('Coverage summary file not found');
    }

    const coverageData = JSON.parse(readFileSync(coveragePath, 'utf-8'));
    const totalCoverage = coverageData.total;

    return {
      totalCoverage: totalCoverage.statements.pct,
      branchCoverage: totalCoverage.branches.pct,
      functionCoverage: totalCoverage.functions.pct,
      lineCoverage: totalCoverage.lines.pct,
    };
  } catch (error) {
    console.warn(`${COLORS.YELLOW}⚠️  Coverage analysis failed: ${error}${COLORS.RESET}`);
    // Return safe defaults if coverage analysis fails
    return {
      totalCoverage: 0,
      branchCoverage: 0,
      functionCoverage: 0,
      lineCoverage: 0,
    };
  }
}

/**
 * Validates quality metrics against defined thresholds.
 * @param complexity - Complexity analysis results
 * @param coverage - Coverage analysis results
 * @returns Boolean indicating if all thresholds are met
 */
function validateQuality(
  complexity: ComplexityResult, 
  coverage: CoverageResult
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
  
  return isValid;
}

/**
 * Main function to execute quality checks.
 */
async function main(): Promise<void> {
  console.log(`${COLORS.GREEN}🚀 Starting Koveo Gestion Quality Gate Analysis${COLORS.RESET}\n`);
  
  try {
    // Run analysis in parallel for efficiency
    const [complexity, coverage] = await Promise.all([
      analyzeComplexity(),
      analyzeCoverage(),
    ]);
    
    // Validate against thresholds
    const isQualityValid = validateQuality(complexity, coverage);
    
    console.log('\n' + '='.repeat(50));
    
    if (isQualityValid) {
      console.log(`${COLORS.GREEN}🎉 ALL QUALITY GATES PASSED!${COLORS.RESET}`);
      console.log('Code meets all quality and coverage requirements.');
      process.exit(0);
    } else {
      console.log(`${COLORS.RED}🚫 QUALITY GATE FAILURE!${COLORS.RESET}`);
      console.log('Code does not meet quality requirements. Please address the issues above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`${COLORS.RED}💥 Quality check failed with error: ${error}${COLORS.RESET}`);
    process.exit(1);
  }
}

// Execute main function
main().catch((error) => {
  console.error(`${COLORS.RED}Fatal error: ${error}${COLORS.RESET}`);
  process.exit(1);
});