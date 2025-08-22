#!/usr/bin/env npx tsx

/**
 * @file Feature Completeness Validation Script.
 * @description Validates that all features are properly implemented with tests, docs, and scripts.
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface FeatureValidation {
  feature: string;
  hasImplementation: boolean;
  hasTests: boolean;
  hasDocumentation: boolean;
  hasScripts: boolean;
  completeness: number;
  missingComponents: string[];
}

/**
 * Main feature validation function.
 */
async function validateFeatureCompleteness() {
  console.log(chalk.blue('🔍 Validating Feature Completeness...'));
  
  const features = [
    'Document Management',
    'User Management',
    'Building Management', 
    'SSL Management',
    'RBAC System',
    'Billing & Budgets',
    'Maintenance Requests',
    'AI Integration',
    'Multi-language Support',
    'Security & Compliance',
    'Notification System',
    'Audit Logging'
  ];
  
  const validations: FeatureValidation[] = [];
  
  for (const feature of features) {
    const validation = await validateSingleFeature(feature);
    validations.push(validation);
  }
  
  await generateFeatureValidationReport(validations);
  
  const incompleteFeatures = validations.filter(v => v.completeness < 80);
  const averageCompleteness = validations.reduce((sum, v) => sum + v.completeness, 0) / validations.length;
  
  console.log(chalk.green(`✅ Feature Validation Complete`));
  console.log(chalk.gray(`   Average Completeness: ${averageCompleteness.toFixed(1)}%`));
  console.log(chalk.gray(`   Features needing attention: ${incompleteFeatures.length}`));
  
  return incompleteFeatures.length === 0 && averageCompleteness >= 85;
}

/**
 * Validate a single feature.
 * @param featureName - Name of the feature to validate
 * @returns Feature validation result
 */
async function validateSingleFeature(featureName: string): Promise<FeatureValidation> {
  const searchTerms = getFeatureSearchTerms(featureName);
  
  const hasImplementation = await checkImplementation(searchTerms);
  const hasTests = await checkTests(searchTerms);
  const hasDocumentation = await checkDocumentation(searchTerms);
  const hasScripts = await checkScripts(searchTerms);
  
  const components = [hasImplementation, hasTests, hasDocumentation, hasScripts];
  const completeness = (components.filter(Boolean).length / components.length) * 100;
  
  const missingComponents: string[] = [];
  if (!hasImplementation) missingComponents.push('Implementation');
  if (!hasTests) missingComponents.push('Tests');
  if (!hasDocumentation) missingComponents.push('Documentation');
  if (!hasScripts) missingComponents.push('Scripts');
  
  return {
    feature: featureName,
    hasImplementation,
    hasTests,
    hasDocumentation,
    hasScripts,
    completeness,
    missingComponents
  };
}

/**
 * Get search terms for a feature.
 * @param featureName - Feature name
 * @returns Array of search terms
 */
function getFeatureSearchTerms(featureName: string): string[] {
  const termMap: Record<string, string[]> = {
    'Document Management': ['document', 'upload', 'file'],
    'User Management': ['user', 'auth', 'login', 'invitation'],
    'Building Management': ['building', 'residence', 'property'],
    'SSL Management': ['ssl', 'certificate', 'tls'],
    'RBAC System': ['rbac', 'role', 'permission'],
    'Billing & Budgets': ['bill', 'budget', 'payment', 'financial'],
    'Maintenance Requests': ['maintenance', 'demand', 'repair'],
    'AI Integration': ['ai', 'agent', 'llm'],
    'Multi-language Support': ['i18n', 'language', 'locale'],
    'Security & Compliance': ['security', 'law25', 'compliance'],
    'Notification System': ['notification', 'email', 'alert'],
    'Audit Logging': ['audit', 'log', 'tracking']
  };
  
  return termMap[featureName] || [featureName.toLowerCase().replace(/\s+/g, '-')];
}

/**
 * Check if feature has implementation files.
 * @param searchTerms - Terms to search for
 * @returns True if implementation exists
 */
async function checkImplementation(searchTerms: string[]): Promise<boolean> {
  for (const term of searchTerms) {
    const files = await findFiles([
      `client/src/**/*${term}*`,
      `server/**/*${term}*`,
      `shared/**/*${term}*`
    ]);
    
    if (files.length > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if feature has test files.
 * @param searchTerms - Terms to search for
 * @returns True if tests exist
 */
async function checkTests(searchTerms: string[]): Promise<boolean> {
  for (const term of searchTerms) {
    const files = await findFiles([
      `tests/**/*${term}*.test.*`,
      `tests/**/*${term}*.spec.*`,
      `**/*${term}*.test.*`,
      `**/*${term}*.spec.*`
    ]);
    
    if (files.length > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if feature has documentation.
 * @param searchTerms - Terms to search for
 * @returns True if documentation exists
 */
async function checkDocumentation(searchTerms: string[]): Promise<boolean> {
  for (const term of searchTerms) {
    // Check for documentation files
    const files = await findFiles([
      `docs/**/*${term}*`,
      `**/*${term}*.md`,
      `**/README.md`
    ]);
    
    if (files.length > 0) {
      // Check if the term is mentioned in documentation
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          if (content.toLowerCase().includes(term.toLowerCase())) {
            return true;
          }
        } catch {
          // Continue checking other files
        }
      }
    }
  }
  
  return false;
}

/**
 * Check if feature has supporting scripts.
 * @param searchTerms - Terms to search for
 * @returns True if scripts exist
 */
async function checkScripts(searchTerms: string[]): Promise<boolean> {
  try {
    const scriptsDir = await fs.readdir('scripts');
    
    for (const term of searchTerms) {
      const hasScript = scriptsDir.some(script => 
        script.toLowerCase().includes(term.toLowerCase())
      );
      
      if (hasScript) {
        return true;
      }
    }
  } catch {
    // Scripts directory doesn't exist or can't be read
  }
  
  return false;
}

/**
 * Find files matching patterns.
 * @param patterns - File patterns to search
 * @returns Array of matching files
 */
async function findFiles(patterns: string[]): Promise<string[]> {
  const allFiles: string[] = [];
  
  for (const pattern of patterns) {
    try {
      const { spawn } = await import('child_process');
      const files = await new Promise<string[]>((resolve) => {
        const find = spawn('find', ['.', '-path', './node_modules', '-prune', '-o', '-name', pattern, '-print'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        find.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        find.on('close', () => {
          const fileList = output.trim().split('\n').filter(f => f && !f.includes('node_modules'));
          resolve(fileList);
        });
        
        find.on('error', () => resolve([]));
      });
      
      allFiles.push(...files);
    } catch {
      // Continue with next pattern
    }
  }
  
  return [...new Set(allFiles)];
}

/**
 * Generate feature validation report.
 * @param validations - Feature validation results
 */
async function generateFeatureValidationReport(validations: FeatureValidation[]) {
  const reportPath = path.join('reports', 'feature-completeness-report.md');
  
  await fs.mkdir('reports', { recursive: true });
  
  const averageCompleteness = validations.reduce((sum, v) => sum + v.completeness, 0) / validations.length;
  const completeFeatures = validations.filter(v => v.completeness === 100);
  const incompleteFeatures = validations.filter(v => v.completeness < 80);
  
  const report = `# Feature Completeness Validation Report

Generated on: ${new Date().toISOString()}

## Executive Summary

**Overall Completeness:** ${averageCompleteness.toFixed(1)}%

- ✅ **Complete Features:** ${completeFeatures.length}/${validations.length}
- ⚠️  **Needs Attention:** ${incompleteFeatures.length}
- 📊 **Average Score:** ${averageCompleteness.toFixed(1)}/100

## Feature Completeness Details

${validations
  .sort((a, b) => b.completeness - a.completeness)
  .map((validation, index) => `
### ${index + 1}. ${validation.feature}

**Completeness:** ${validation.completeness.toFixed(0)}% ${validation.completeness === 100 ? '✅' : validation.completeness >= 75 ? '⚠️' : '❌'}

| Component | Status |
|-----------|--------|
| Implementation | ${validation.hasImplementation ? '✅ Yes' : '❌ No'} |
| Tests | ${validation.hasTests ? '✅ Yes' : '❌ No'} |
| Documentation | ${validation.hasDocumentation ? '✅ Yes' : '❌ No'} |
| Scripts | ${validation.hasScripts ? '✅ Yes' : '❌ No'} |

${validation.missingComponents.length > 0 ? `**Missing:** ${validation.missingComponents.join(', ')}` : '**Status:** Complete ✨'}

---
`).join('')}

## Recommendations

### Features Needing Attention

${incompleteFeatures.map(feature => `
#### ${feature.feature} (${feature.completeness.toFixed(0)}%)
- Missing: ${feature.missingComponents.join(', ')}
- **Action:** ${generateRecommendation(feature)}
`).join('')}

### Quality Improvements

1. **Documentation**: Ensure all features have proper documentation in the \`docs/\` directory
2. **Testing**: Add comprehensive tests for features missing test coverage
3. **Scripts**: Create utility scripts for manual operations and maintenance
4. **Monitoring**: Implement monitoring for feature usage and performance

### Command Enhancement Suggestions

Based on the analysis, consider adding these commands:
- \`npm run features:validate\` - Validate feature completeness
- \`npm run features:test\` - Run feature-specific tests
- \`npm run features:docs\` - Generate feature documentation
- \`npm run consolidate:analysis\` - Run consolidation analysis

## Platform Strengths

The Koveo Gestion platform shows excellent implementation across core areas:

${completeFeatures.map(feature => `- ✅ **${feature.feature}**: Complete implementation with all components`).join('\n')}

## Next Steps

1. Address incomplete features by adding missing components
2. Enhance existing commands to cover all features
3. Implement automated feature validation in CI/CD
4. Create feature-specific documentation and examples
`;

  await fs.writeFile(reportPath, report);
}

/**
 * Generate recommendation for incomplete feature.
 * @param feature - Feature validation result
 * @returns Recommendation string
 */
function generateRecommendation(feature: FeatureValidation): string {
  const missing = feature.missingComponents;
  
  if (missing.includes('Implementation')) {
    return 'Implement core functionality first, then add tests and documentation';
  } else if (missing.includes('Tests')) {
    return 'Add comprehensive test coverage for existing implementation';
  } else if (missing.includes('Documentation')) {
    return 'Create documentation in docs/ directory with usage examples';
  } else if (missing.includes('Scripts')) {
    return 'Add utility scripts for maintenance and operations';
  }
  
  return 'Review and enhance existing components';
}

// Run the validation
validateFeatureCompleteness().then(success => {
  process.exit(success ? 0 : 1);
});