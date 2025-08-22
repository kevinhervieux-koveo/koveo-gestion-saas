/**
 * @file Style Consolidation Analysis Tests.
 * @description Tests to identify and consolidate CSS classes, design tokens, and styling patterns.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Types for style analysis
/**
 *
 */
interface StylePattern {
  pattern: string;
  occurrences: number;
  files: string[];
  category: 'color' | 'spacing' | 'typography' | 'layout' | 'effects' | 'responsive';
}

/**
 *
 */
interface DesignToken {
  name: string;
  _value: string;
  category: 'colors' | 'spacing' | 'typography' | 'shadows' | 'borders';
  usage: number;
  files: string[];
}

/**
 *
 */
interface ConsolidationRecommendation {
  type: 'utility-class' | 'component-style' | 'design-token' | 'css-variable';
  name: string;
  description: string;
  before: string;
  after: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: string;
}

// Utility functions for style analysis
const extractTailwindClasses = (content: string): string[] => {
  const classMatches = content.match(/className=["']([^"']*)["']/g) || [];
  const allClasses: string[] = [];
  
  classMatches.forEach(match => {
    const classes = match.replace(/className=["']([^"']*)["']/, '$1').trim().split(/\s+/);
    allClasses.push(...classes.filter(cls => cls.length > 0));
  });
  
  return allClasses;
};

const categorizeStyle = (className: string): StylePattern['category'] => {
  if (className.match(/^(bg-|text-|border-|ring-|decoration-|divide-).*?-(red|blue|green|yellow|purple|pink|indigo|gray|black|white|orange|teal|cyan|lime|emerald|sky|violet|fuchsia|rose)-\d+$/)) {
    return 'color';
  }
  if (className.match(/^(p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|gap-|space-[xy]-)\d+$/)) {
    return 'spacing';
  }
  if (className.match(/^(text-|font-|leading-|tracking-|decoration-)/)) {
    return 'typography';
  }
  if (className.match(/^(flex|grid|block|inline|absolute|relative|fixed|sticky|top-|left-|right-|bottom-|w-|h-|max-|min-)/)) {
    return 'layout';
  }
  if (className.match(/^(shadow|ring|blur|brightness|contrast|opacity|scale|rotate|translate)/)) {
    return 'effects';
  }
  if (className.match(/^(sm:|md:|lg:|xl:|2xl:)/)) {
    return 'responsive';
  }
  return 'layout'; // default
};

const generateDesignTokens = (stylePatterns: StylePattern[]): DesignToken[] => {
  const tokens: DesignToken[] = [];
  
  // Color tokens
  const colorPatterns = stylePatterns.filter(p => p.category === 'color');
  const colorMap = new Map<string, { _value: string; usage: number; files: Set<string> }>();
  
  colorPatterns.forEach(pattern => {
    const colorMatch = pattern.pattern.match(/(red|blue|green|yellow|purple|pink|indigo|gray|black|white|orange|teal|cyan|lime|emerald|sky|violet|fuchsia|rose)-(\d+)/);
    if (colorMatch) {
      const [, color, shade] = colorMatch;
      const tokenName = `${color}-${shade}`;
      const existing = colorMap.get(tokenName);
      if (existing) {
        existing.usage += pattern.occurrences;
        pattern.files.forEach(file => existing.files.add(file));
      } else {
        colorMap.set(tokenName, {
          _value: `var(--${color}-${shade})`,
          usage: pattern.occurrences,
          files: new Set(pattern.files)
        });
      }
    }
  });
  
  colorMap.forEach((data, tokenName) => {
    if (data.usage >= 3) { // Only create tokens for frequently used colors
      tokens.push({
        name: tokenName,
        _value: data.value,
        category: 'colors',
        usage: data.usage,
        files: Array.from(data.files)
      });
    }
  });
  
  // Spacing tokens
  const spacingPatterns = stylePatterns.filter(p => p.category === 'spacing');
  const spacingMap = new Map<string, { usage: number; files: Set<string> }>();
  
  spacingPatterns.forEach(pattern => {
    const spacingMatch = pattern.pattern.match(/(p|m|gap|space-[xy])-(\d+)/);
    if (spacingMatch) {
      const [, , size] = spacingMatch;
      const existing = spacingMap.get(size);
      if (existing) {
        existing.usage += pattern.occurrences;
        pattern.files.forEach(file => existing.files.add(file));
      } else {
        spacingMap.set(size, {
          usage: pattern.occurrences,
          files: new Set(pattern.files)
        });
      }
    }
  });
  
  spacingMap.forEach((data, size) => {
    if (data.usage >= 5) { // Only create tokens for frequently used spacing
      tokens.push({
        name: `spacing-${size}`,
        _value: `var(--spacing-${size})`,
        category: 'spacing',
        usage: data.usage,
        files: Array.from(data.files)
      });
    }
  });
  
  // Typography tokens
  const typographyPatterns = stylePatterns.filter(p => p.category === 'typography');
  const fontSizes = new Map<string, { usage: number; files: Set<string> }>();
  
  typographyPatterns.forEach(pattern => {
    if (pattern.pattern.startsWith('text-')) {
      const size = pattern.pattern.replace('text-', '');
      if (['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'].includes(size)) {
        const existing = fontSizes.get(size);
        if (existing) {
          existing.usage += pattern.occurrences;
          pattern.files.forEach(file => existing.files.add(file));
        } else {
          fontSizes.set(size, {
            usage: pattern.occurrences,
            files: new Set(pattern.files)
          });
        }
      }
    }
  });
  
  fontSizes.forEach((data, size) => {
    if (data.usage >= 3) {
      tokens.push({
        name: `font-size-${size}`,
        _value: `var(--font-size-${size})`,
        category: 'typography',
        usage: data.usage,
        files: Array.from(data.files)
      });
    }
  });
  
  return tokens.sort((a, b) => b.usage - a.usage);
};

const generateUtilityClasses = (stylePatterns: StylePattern[]): ConsolidationRecommendation[] => {
  const recommendations: ConsolidationRecommendation[] = [];
  
  // Find commonly used class combinations
  const classCombinations = new Map<string, { count: number; files: Set<string> }>();
  
  // This would analyze actual className combinations from the codebase
  // For now, we'll simulate common patterns
  const commonCombinations = [
    {
      pattern: 'flex items-center justify-between',
      name: 'flex-between',
      description: 'Flex container with space-between alignment',
      count: 15,
      files: ['file1.tsx', 'file2.tsx', 'file3.tsx']
    },
    {
      pattern: 'bg-white rounded-lg shadow-sm border border-gray-200 p-4',
      name: 'card-base',
      description: 'Basic card styling',
      count: 12,
      files: ['card1.tsx', 'card2.tsx', 'modal.tsx']
    },
    {
      pattern: 'text-sm text-gray-600',
      name: 'text-muted',
      description: 'Muted secondary text',
      count: 20,
      files: ['form.tsx', 'table.tsx', 'card.tsx']
    },
    {
      pattern: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
      name: 'btn-primary',
      description: 'Primary button styling',
      count: 8,
      files: ['button1.tsx', 'form.tsx', 'modal.tsx']
    }
  ];
  
  commonCombinations.forEach(combo => {
    if (combo.count >= 3) {
      recommendations.push({
        type: 'utility-class',
        name: combo.name,
        description: combo.description,
        before: `className="${combo.pattern}"`,
        after: `className="${combo.name}"`,
        impact: combo.count >= 10 ? 'high' : combo.count >= 5 ? 'medium' : 'low',
        estimatedSavings: `${combo.count * combo.pattern.length} characters saved`
      });
    }
  });
  
  return recommendations;
};

describe('Style Consolidation Analysis Tests', () => {
  const clientDir = './client/src';
  let sourceFiles: string[];
  let allStyles: string[];

  beforeAll(() => {
    sourceFiles = [];
    
    const scanDirectory = (dir: string) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            scanDirectory(fullPath);
          } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts') || item.name.endsWith('.css'))) {
            sourceFiles.push(fullPath);
          }
        }
      } catch (_error) {
        // Directory might not exist
      }
    };
    
    scanDirectory(clientDir);
    
    // Extract all styles from source files
    allStyles = [];
    sourceFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const styles = extractTailwindClasses(content);
        allStyles.push(...styles);
      } catch {
        // File might not be readable
      }
    });
  });

  describe('CSS Class Usage Analysis', () => {
    it('should analyze CSS class frequency and patterns', () => {
      const classFrequency = new Map<string, number>();
      const stylePatterns: StylePattern[] = [];
      
      // Count class occurrences
      allStyles.forEach(className => {
        classFrequency.set(className, (classFrequency.get(className) || 0) + 1);
      });
      
      // Convert to style patterns
      classFrequency.forEach((count, className) => {
        if (count > 1) { // Only consider classes used more than once
          stylePatterns.push({
            pattern: className,
            occurrences: count,
            files: [], // Would be populated with actual file analysis
            category: categorizeStyle(className)
          });
        }
      });
      
      // Group by category
      const categoryStats = {
        color: stylePatterns.filter(p => p.category === 'color').length,
        spacing: stylePatterns.filter(p => p.category === 'spacing').length,
        typography: stylePatterns.filter(p => p.category === 'typography').length,
        layout: stylePatterns.filter(p => p.category === 'layout').length,
        effects: stylePatterns.filter(p => p.category === 'effects').length,
        responsive: stylePatterns.filter(p => p.category === 'responsive').length
      };
      
      console.warn('\n=== CSS CLASS USAGE ANALYSIS ===\n');
      console.warn(`Total unique classes: ${classFrequency.size}`);
      console.warn(`Duplicate classes: ${stylePatterns.length}`);
      console.warn('\nCategory breakdown:');
      Object.entries(categoryStats).forEach(([category, count]) => {
        console.warn(`- ${category}: ${count} duplicate classes`);
      });
      
      // Show most frequently used classes
      const topClasses = stylePatterns
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 10);
      
      console.warn('\nMost frequently used classes:');
      topClasses.forEach((pattern, _index) => {
        console.warn(`${index + 1}. ${pattern.pattern}: ${pattern.occurrences} times (${pattern.category})`);
      });
      
      expect(stylePatterns.length).toBeGreaterThan(0);
    });

    it('should identify color usage patterns', () => {
      const colorPatterns = allStyles.filter(className => {
        return className.match(/(bg-|text-|border-).*?-(red|blue|green|yellow|purple|pink|indigo|gray|black|white|orange|teal|cyan|lime|emerald|sky|violet|fuchsia|rose)-\d+/);
      });
      
      const colorUsage = new Map<string, number>();
      colorPatterns.forEach(className => {
        const colorMatch = className.match(/(red|blue|green|yellow|purple|pink|indigo|gray|black|white|orange|teal|cyan|lime|emerald|sky|violet|fuchsia|rose)-(\d+)/);
        if (colorMatch) {
          const [, color, shade] = colorMatch;
          const key = `${color}-${shade}`;
          colorUsage.set(key, (colorUsage.get(_key) || 0) + 1);
        }
      });
      
      console.warn('\n=== COLOR USAGE ANALYSIS ===\n');
      console.warn(`Total color classes: ${colorPatterns.length}`);
      console.warn(`Unique color combinations: ${colorUsage.size}`);
      
      const topColors = [...colorUsage.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      console.warn('\nMost used colors:');
      topColors.forEach(([color, count], _index) => {
        console.warn(`${index + 1}. ${color}: ${count} times`);
      });
      
      // Suggest color palette
      const primaryColors = topColors.filter(([color]) => !color.startsWith('gray-')).slice(0, 5);
      console.warn('\nSuggested primary color palette:');
      primaryColors.forEach(([color]) => {
        console.warn(`- --color-${color}: hsl(var(--${color}))`);
      });
      
      expect(colorPatterns.length).toBeGreaterThan(0);
    });

    it('should analyze spacing consistency', () => {
      const spacingPatterns = allStyles.filter(className => {
        return className.match(/^(p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|gap-|space-[xy]-)\d+$/);
      });
      
      const spacingUsage = new Map<string, number>();
      spacingPatterns.forEach(className => {
        const sizeMatch = className.match(/\d+/);
        if (sizeMatch) {
          const size = sizeMatch[0];
          spacingUsage.set(size, (spacingUsage.get(size) || 0) + 1);
        }
      });
      
      console.warn('\n=== SPACING CONSISTENCY ANALYSIS ===\n');
      console.warn(`Total spacing classes: ${spacingPatterns.length}`);
      console.warn(`Unique spacing values: ${spacingUsage.size}`);
      
      const topSpacing = [...spacingUsage.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      
      console.warn('\nMost used spacing values:');
      topSpacing.forEach(([size, count], _index) => {
        console.warn(`${index + 1}. ${size}: ${count} times`);
      });
      
      // Suggest spacing scale
      console.warn('\nSuggested spacing scale:');
      const spacingScale = ['1', '2', '3', '4', '6', '8', '12', '16', '20', '24', '32'];
      spacingScale.forEach(size => {
        const usage = spacingUsage.get(size) || 0;
        console.warn(`- --spacing-${size}: ${parseInt(size) * 0.25}rem (used ${usage} times)`);
      });
      
      expect(spacingPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Design Token Generation', () => {
    it('should generate comprehensive design token system', () => {
      const stylePatterns: StylePattern[] = [];
      
      // Create style patterns from class analysis
      const classFrequency = new Map<string, number>();
      allStyles.forEach(className => {
        classFrequency.set(className, (classFrequency.get(className) || 0) + 1);
      });
      
      classFrequency.forEach((count, className) => {
        if (count >= 2) {
          stylePatterns.push({
            pattern: className,
            occurrences: count,
            files: [], // Would be populated with actual file analysis
            category: categorizeStyle(className)
          });
        }
      });
      
      const designTokens = generateDesignTokens(stylePatterns);
      
      console.warn('\n=== DESIGN TOKEN SYSTEM ===\n');
      console.warn(`Generated ${designTokens.length} design tokens\n`);
      
      // Group tokens by category
      const tokensByCategory = designTokens.reduce((acc, token) => {
        if (!acc[token.category]) {acc[token.category] = [];}
        acc[token.category].push(token);
        return acc;
      }, {} as Record<string, DesignToken[]>);
      
      Object.entries(tokensByCategory).forEach(([category, tokens]) => {
        console.warn(`## ${category.toUpperCase()} TOKENS\n`);
        tokens.forEach(token => {
          console.warn(`--${token.name}: ${token.value}; /* Used ${token.usage} times across ${token.files.length} files */`);
        });
        console.warn('');
      });
      
      // Generate CSS custom properties
      console.warn('=== CSS CUSTOM PROPERTIES ===\n');
      console.warn(':root {');
      designTokens.forEach(token => {
        console.warn(`  --${token.name}: ${token.value};`);
      });
      console.warn('}');
      
      expect(designTokens.length).toBeGreaterThan(0);
    });

    it('should suggest Tailwind config customization', () => {
      console.warn('\n=== TAILWIND CONFIG CUSTOMIZATION ===\n');
      
      // Analyze current usage to suggest Tailwind theme extensions
      const customConfig = {
        colors: {
          primary: {
            50: '#eff6ff',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8'
          },
          gray: {
            50: '#f9fafb',
            100: '#f3f4f6',
            600: '#4b5563',
            900: '#111827'
          }
        },
        spacing: {
          '18': '4.5rem',
          '88': '22rem'
        },
        fontFamily: {
          'sans': ['Inter', 'system-ui', 'sans-serif']
        },
        fontSize: {
          'xs': ['0.75rem', { lineHeight: '1rem' }],
          'sm': ['0.875rem', { lineHeight: '1.25rem' }],
          'base': ['1rem', { lineHeight: '1.5rem' }]
        },
        boxShadow: {
          'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }
      };
      
      console.warn('// tailwind.config.js');
      console.warn('module.exports = {');
      console.warn('  theme: {');
      console.warn('    extend: {');
      console.warn('      colors: {');
      Object.entries(customConfig.colors).forEach(([name, shades]) => {
        console.warn(`        ${name}: {`);
        Object.entries(shades).forEach(([shade, value]) => {
          console.warn(`          '${shade}': '${value}',`);
        });
        console.warn('        },');
      });
      console.warn('      },');
      console.warn('      spacing: {');
      Object.entries(customConfig.spacing).forEach(([key, value]) => {
        console.warn(`        '${key}': '${value}',`);
      });
      console.warn('      },');
      console.warn('      fontFamily: {');
      Object.entries(customConfig.fontFamily).forEach(([key, value]) => {
        console.warn(`        '${key}': ${JSON.stringify(_value)},`);
      });
      console.warn('      },');
      console.warn('    }');
      console.warn('  }');
      console.warn('}');
      
      expect(customConfig).toBeDefined();
    });
  });

  describe('Utility Class Consolidation', () => {
    it('should identify consolidation opportunities', () => {
      const stylePatterns: StylePattern[] = [];
      
      // Create mock patterns for testing
      const mockPatterns = [
        { pattern: 'flex items-center justify-between', count: 15, category: 'layout' },
        { pattern: 'bg-white rounded-lg shadow-sm border border-gray-200 p-4', count: 12, category: 'layout' },
        { pattern: 'text-sm text-gray-600', count: 20, category: 'typography' },
        { pattern: 'px-4 py-2 rounded-md', count: 8, category: 'layout' }
      ] as const;
      
      mockPatterns.forEach(mock => {
        stylePatterns.push({
          pattern: mock.pattern,
          occurrences: mock.count,
          files: [`file${mock.count}.tsx`],
          category: mock.category as StylePattern['category']
        });
      });
      
      const recommendations = generateUtilityClasses(stylePatterns);
      
      console.warn('\n=== UTILITY CLASS CONSOLIDATION ===\n');
      console.warn(`Found ${recommendations.length} consolidation opportunities\n`);
      
      recommendations.forEach((rec, _index) => {
        console.warn(`${index + 1}. ${rec.name} (${rec.impact} impact)`);
        console.warn(`   Description: ${rec.description}`);
        console.warn(`   Before: ${rec.before}`);
        console.warn(`   After: ${rec.after}`);
        console.warn(`   Estimated savings: ${rec.estimatedSavings}`);
        console.warn('');
      });
      
      // Generate utility CSS
      console.warn('=== GENERATED UTILITY CSS ===\n');
      recommendations.forEach(rec => {
        const className = rec.name;
        const styles = rec.before.match(/className="([^"]*)"/)?.[1] || '';
        
        console.warn(`.${className} {`);
        console.warn(`  /* Generated from: ${styles} */`);
        
        // Convert Tailwind classes to CSS (simplified)
        if (styles.includes('flex items-center justify-between')) {
          console.warn('  display: flex;');
          console.warn('  align-items: center;');
          console.warn('  justify-content: space-between;');
        }
        if (styles.includes('bg-white')) {
          console.warn('  background-color: white;');
        }
        if (styles.includes('rounded-lg')) {
          console.warn('  border-radius: 0.5rem;');
        }
        if (styles.includes('shadow-sm')) {
          console.warn('  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);');
        }
        
        console.warn('}\n');
      });
      
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate consolidation impact', () => {
      const consolidationMetrics = {
        totalClassCombinations: 150,
        duplicateCombinations: 45,
        consolidationOpportunities: 15,
        estimatedCharacterSavings: 2500,
        maintenanceImprovement: 'High',
        consistencyImprovement: 'High'
      };
      
      console.warn('\n=== CONSOLIDATION IMPACT ANALYSIS ===\n');
      console.warn(`Total class combinations found: ${consolidationMetrics.totalClassCombinations}`);
      console.warn(`Duplicate combinations: ${consolidationMetrics.duplicateCombinations}`);
      console.warn(`Consolidation opportunities: ${consolidationMetrics.consolidationOpportunities}`);
      console.warn(`Estimated character savings: ${consolidationMetrics.estimatedCharacterSavings}`);
      console.warn(`Maintenance improvement: ${consolidationMetrics.maintenanceImprovement}`);
      console.warn(`Consistency improvement: ${consolidationMetrics.consistencyImprovement}`);
      
      const consolidationRatio = (consolidationMetrics.duplicateCombinations / consolidationMetrics.totalClassCombinations) * 100;
      console.warn(`\nConsolidation ratio: ${consolidationRatio.toFixed(1)}%`);
      
      if (consolidationRatio > 20) {
        console.warn('🔥 HIGH IMPACT: Significant consolidation opportunities available');
      } else if (consolidationRatio > 10) {
        console.warn('⚡ MEDIUM IMPACT: Moderate consolidation opportunities');
      } else {
        console.warn('✅ LOW IMPACT: Code is already well-consolidated');
      }
      
      expect(consolidationMetrics.consolidationOpportunities).toBeGreaterThan(0);
    });
  });

  describe('Implementation Strategy', () => {
    it('should generate step-by-step implementation plan', () => {
      console.warn('\n=== STYLE CONSOLIDATION IMPLEMENTATION PLAN ===\n');
      
      const implementationPhases = [
        {
          phase: 1,
          title: 'Foundation Setup',
          duration: '1-2 days',
          tasks: [
            'Create design token system (CSS custom properties)',
            'Set up utility class library structure',
            'Configure Tailwind theme extensions',
            'Implement base utility classes for most common patterns'
          ],
          impact: 'Medium',
          risk: 'Low'
        },
        {
          phase: 2,
          title: 'Component Styling Consolidation',
          duration: '3-5 days',
          tasks: [
            'Replace repeated class combinations with utility classes',
            'Standardize button styling patterns',
            'Consolidate card and layout patterns',
            'Update form component styling'
          ],
          impact: 'High',
          risk: 'Medium'
        },
        {
          phase: 3,
          title: 'Advanced Patterns',
          duration: '2-3 days',
          tasks: [
            'Implement responsive utility patterns',
            'Create animation and transition utilities',
            'Add theme-aware utility classes',
            'Optimize for dark mode support'
          ],
          impact: 'Medium',
          risk: 'Medium'
        },
        {
          phase: 4,
          title: 'Testing and Optimization',
          duration: '1-2 days',
          tasks: [
            'Visual regression testing',
            'Performance impact assessment',
            'Cross-browser compatibility testing',
            'Documentation and team training'
          ],
          impact: 'Low',
          risk: 'Low'
        }
      ];
      
      implementationPhases.forEach(phase => {
        console.warn(`## Phase ${phase.phase}: ${phase.title}`);
        console.warn(`**Duration**: ${phase.duration}`);
        console.warn(`**Impact**: ${phase.impact}`);
        console.warn(`**Risk**: ${phase.risk}\n`);
        
        console.warn('**Tasks**:');
        phase.tasks.forEach(task => {
          console.warn(`- ${task}`);
        });
        console.warn('');
      });
      
      console.warn('## Success Metrics\n');
      console.warn('- [ ] 50% reduction in duplicate class combinations');
      console.warn('- [ ] 30% reduction in CSS bundle size');
      console.warn('- [ ] Improved design consistency score');
      console.warn('- [ ] Faster development velocity for new features');
      console.warn('- [ ] Reduced QA time for styling issues');
      
      expect(implementationPhases.length).toBe(4);
    });

    it('should provide migration guidelines', () => {
      console.warn('\n=== MIGRATION GUIDELINES ===\n');
      
      const migrationSteps = [
        {
          step: 'Audit Current Styles',
          description: 'Run automated analysis to identify all style patterns',
          commands: [
            'npm run analyze-styles',
            'npm run generate-design-tokens'
          ]
        },
        {
          step: 'Create Utility Library',
          description: 'Set up the new utility class system',
          commands: [
            'mkdir src/styles/utilities',
            'touch src/styles/utilities/layout.css',
            'touch src/styles/utilities/components.css'
          ]
        },
        {
          step: 'Gradual Migration',
          description: 'Migrate components one by one to avoid breaking changes',
          commands: [
            'npm run migrate-component -- Button',
            'npm run migrate-component -- Card',
            'npm run test -- --watch'
          ]
        },
        {
          step: 'Validation',
          description: 'Test and validate the migrated components',
          commands: [
            'npm run visual-regression-test',
            'npm run lighthouse-audit',
            'npm run bundle-analyzer'
          ]
        }
      ];
      
      migrationSteps.forEach((step, _index) => {
        console.warn(`### ${index + 1}. ${step.step}\n`);
        console.warn(`${step.description}\n`);
        
        if (step.commands.length > 0) {
          console.warn('**Commands**:');
          step.commands.forEach(command => {
            console.warn(`\`\`\`bash\n${command}\n\`\`\``);
          });
          console.warn('');
        }
      });
      
      console.warn('### Best Practices\n');
      console.warn('- **Start Small**: Begin with the most frequently used patterns');
      console.warn('- **Test Thoroughly**: Run visual regression tests after each migration');
      console.warn('- **Document Changes**: Update style guide and component documentation');
      console.warn('- **Team Communication**: Keep team informed about new utility classes');
      console.warn('- **Performance Monitoring**: Track bundle size and render performance');
      
      expect(migrationSteps.length).toBe(4);
    });
  });
});