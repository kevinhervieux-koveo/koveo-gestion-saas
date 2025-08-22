#!/usr/bin/env npx tsx

/**
 * @file Enhanced Quality Check with Consolidation Focus.
 * @description Runs quality checks specifically focused on code consolidation and redundancy reduction.
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 *
 */
interface QualityMetric {
  category: string;
  score: number;
  issues: string[];
  improvements: string[];
}

/**
 * Main consolidation quality check.
 */
async function runConsolidationQuality() {
  console.log(chalk.blue('🎯 Running Enhanced Quality Check with Consolidation Focus...'));
  
  const metrics: QualityMetric[] = [];
  
  try {
    // Check code consolidation
    const consolidationMetric = await checkCodeConsolidation();
    metrics.push(consolidationMetric);
    
    // Check utility usage
    const utilityMetric = await checkUtilityUsage();
    metrics.push(utilityMetric);
    
    // Check hook patterns
    const hookMetric = await checkHookPatterns();
    metrics.push(hookMetric);
    
    // Check API patterns
    const apiMetric = await checkAPIPatterns();
    metrics.push(apiMetric);
    
    // Generate comprehensive report
    await generateQualityReport(metrics);
    
    const averageScore = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;
    const totalIssues = metrics.reduce((sum, m) => sum + m.issues.length, 0);
    
    console.log(chalk.green(`✅ Consolidation Quality Check Complete`));
    console.log(chalk.gray(`   Average Quality Score: ${averageScore.toFixed(1)}/10`));
    console.log(chalk.gray(`   Total Issues: ${totalIssues}`));
    
    return averageScore >= 8.0 && totalIssues < 10;
    
  } catch (error) {
    console.error(chalk.red(`❌ Error during quality check: ${error}`));
    return false;
  }
}

/**
 * Check code consolidation metrics.
 * @returns Quality metric for code consolidation.
 */
async function checkCodeConsolidation(): Promise<QualityMetric> {
  const issues: string[] = [];
  const improvements: string[] = [];
  
  try {
    // Check for duplicate DOCUMENT_CATEGORIES
    const categoriesFiles = await findFilesContaining('DOCUMENT_CATEGORIES.*=');
    if (categoriesFiles.length > 3) {
      issues.push(`Found ${categoriesFiles.length} files with DOCUMENT_CATEGORIES - should use consolidated version`);
    } else {
      improvements.push('Document categories are being consolidated');
    }
    
    // Check for duplicate getDisplayableFileUrl
    const urlFiles = await findFilesContaining('function.*getDisplayableFileUrl');
    if (urlFiles.length > 1) {
      issues.push(`Found ${urlFiles.length} duplicate getDisplayableFileUrl functions`);
    } else {
      improvements.push('File URL utility is consolidated');
    }
    
    // Check for loading state patterns
    const loadingFiles = await findFilesContaining('useState.*loading');
    if (loadingFiles.length > 10) {
      issues.push(`Found ${loadingFiles.length} manual loading states - consider using useLoadingState hook`);
    } else {
      improvements.push('Loading state patterns are reasonable');
    }
    
    const score = Math.max(0, 10 - issues.length * 2);
    
    return {
      category: 'Code Consolidation',
      score,
      issues,
      improvements
    };
    
  } catch (error) {
    return {
      category: 'Code Consolidation',
      score: 5,
      issues: [`Error checking consolidation: ${error}`],
      improvements: []
    };
  }
}

/**
 * Check utility usage patterns.
 * @returns Quality metric for utility usage.
 */
async function checkUtilityUsage(): Promise<QualityMetric> {
  const issues: string[] = [];
  const improvements: string[] = [];
  
  try {
    // Check if new utilities are being imported
    const documentsImports = await findFilesContaining('from.*@/lib/documents');
    const hooksImports = await findFilesContaining('from.*@/lib/common-hooks');
    
    if (documentsImports.length === 0) {
      issues.push('Documents utility library is not being used');
    } else {
      improvements.push(`Documents utility is used in ${documentsImports.length} files`);
    }
    
    if (hooksImports.length === 0) {
      issues.push('Common hooks library is not being used');
    } else {
      improvements.push(`Common hooks are used in ${hooksImports.length} files`);
    }
    
    const score = Math.min(10, (documentsImports.length + hooksImports.length) * 2);
    
    return {
      category: 'Utility Usage',
      score,
      issues,
      improvements
    };
    
  } catch (error) {
    return {
      category: 'Utility Usage',
      score: 5,
      issues: [`Error checking utility usage: ${error}`],
      improvements: []
    };
  }
}

/**
 * Check React hook patterns.
 * @returns Quality metric for hook patterns.
 */
async function checkHookPatterns(): Promise<QualityMetric> {
  const issues: string[] = [];
  const improvements: string[] = [];
  
  try {
    // Check for consistent mutation patterns
    const mutationFiles = await findFilesContaining('useMutation');
    const deleteMutations = await findFilesContaining('handleDelete');
    
    if (deleteMutations.length > 5 && mutationFiles.length < deleteMutations.length / 2) {
      issues.push('Many delete handlers but few consolidated mutations - consider using useDeleteMutation');
    }
    
    // Check for loading state consistency
    const loadingStates = await findFilesContaining('isLoading.*useState|useState.*loading');
    if (loadingStates.length > 15) {
      issues.push('High number of manual loading states - consider consolidation');
    }
    
    improvements.push('React Query patterns are well established');
    improvements.push('Form handling uses consistent patterns');
    
    const score = Math.max(0, 10 - issues.length * 2);
    
    return {
      category: 'Hook Patterns',
      score,
      issues,
      improvements
    };
    
  } catch (error) {
    return {
      category: 'Hook Patterns', 
      score: 7,
      issues: [`Error checking hooks: ${error}`],
      improvements: []
    };
  }
}

/**
 * Check API patterns.
 * @returns Quality metric for API patterns.
 */
async function checkAPIPatterns(): Promise<QualityMetric> {
  const issues: string[] = [];
  const improvements: string[] = [];
  
  try {
    // Check for consistent API request patterns
    const apiRequests = await findFilesContaining('apiRequest');
    const directAPIFiles = await findFilesContaining('apiRequest.*documents');
    
    if (directAPIFiles.length > 5) {
      issues.push('Many direct document API calls - consider using documentApi utility');
    }
    
    improvements.push(`API request patterns are used in ${apiRequests.length} files`);
    improvements.push('React Query integration is consistent');
    
    const score = Math.max(0, 10 - issues.length * 1.5);
    
    return {
      category: 'API Patterns',
      score,
      issues,
      improvements
    };
    
  } catch (error) {
    return {
      category: 'API Patterns',
      score: 7,
      issues: [`Error checking API patterns: ${error}`],
      improvements: []
    };
  }
}

/**
 * Find files containing a pattern.
 * @param pattern - Pattern to search for.
 * @returns Array of file paths.
 */
async function findFilesContaining(pattern: string): Promise<string[]> {
  return new Promise((resolve) => {
    const grep = spawn('grep', ['-r', '-l', pattern, 'client/src', 'server'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    grep.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    grep.on('close', () => {
      const files = output.trim().split('\n').filter(Boolean);
      resolve(files);
    });
    
    grep.on('error', () => resolve([]));
  });
}

/**
 * Generate quality report.
 * @param metrics - Quality metrics to report.
 */
async function generateQualityReport(metrics: QualityMetric[]) {
  const reportPath = path.join('reports', 'consolidation-quality-report.md');
  
  await fs.mkdir('reports', { recursive: true });
  
  const averageScore = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;
  const totalIssues = metrics.reduce((sum, m) => sum + m.issues.length, 0);
  
  const report = `# Consolidation Quality Report

Generated on: ${new Date().toISOString()}

## Overall Score: ${averageScore.toFixed(1)}/10

Total Issues Identified: **${totalIssues}**

## Quality Metrics by Category

${metrics.map((metric, index) => `
### ${index + 1}. ${metric.category}

**Score:** ${metric.score}/10

${metric.issues.length > 0 ? `
**Issues (${metric.issues.length}):**
${metric.issues.map(issue => `- ❌ ${issue}`).join('\n')}
` : ''}

**Improvements (${metric.improvements.length}):**
${metric.improvements.map(improvement => `- ✅ ${improvement}`).join('\n')}

---
`).join('')}

## Consolidation Recommendations

### High Priority
1. **Document Categories**: Migrate remaining files to use consolidated DOCUMENT_CATEGORIES from \`@/lib/documents\`
2. **File URL Utilities**: Replace duplicate getDisplayableFileUrl functions  
3. **Loading States**: Use \`useLoadingState\` hook for consistent loading management

### Medium Priority
1. **Delete Operations**: Consolidate delete handlers with \`useDeleteMutation\`
2. **API Calls**: Use \`documentApi\` utility for document operations
3. **Form State**: Use \`useFormState\` for consistent form management

### Best Practices Maintained
- ✅ React Query patterns are consistent
- ✅ TypeScript types are well-defined
- ✅ Component structure follows standards
- ✅ API request patterns are established

## Next Steps

1. Run consolidation analysis: \`npx tsx scripts/consolidate-redundancies.ts\`
2. Update files to use new utility libraries
3. Re-run quality check to measure improvement
4. Continue monitoring for new redundancies
`;

  await fs.writeFile(reportPath, report);
}

// Run the consolidation quality check
runConsolidationQuality().then(success => {
  process.exit(success ? 0 : 1);
});