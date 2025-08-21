/**
 * @file Enhanced UI Component Redundancy Detection Tests.
 * @description Advanced analysis of UI component patterns, props, structures, and reusability opportunities.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

interface ComponentAnalysis {
  name: string;
  filePath: string;
  props: string[];
  hooks: string[];
  patterns: string[];
  complexity: number;
  similarComponents: string[];
}

interface RedundancyResult {
  componentName: string;
  redundancyScore: number;
  duplicatePatterns: string[];
  reusabilityOpportunity: 'high' | 'medium' | 'low';
  suggestedRefactor: string;
}

// Enhanced component analysis functions
const extractComponentInfo = (filePath: string, content: string): ComponentAnalysis | null => {
  const fileName = path.basename(filePath, '.tsx');
  
  // Extract component name
  const componentMatch = content.match(/(?:export\s+(?:default\s+)?(?:const|function)\s+(\w+)|(?:const|function)\s+(\w+).*?=.*?(?:React\.)?(?:FC|FunctionComponent))/);
  const componentName = componentMatch?.[1] || componentMatch?.[2] || fileName;
  
  if (componentName.startsWith('use') || !componentMatch) {
    return null; // Skip hooks and non-components
  }
  
  // Extract props
  const propsMatch = content.match(/(?:interface|type)\s+\w*Props.*?\{([^}]+)\}/s) || 
                     content.match(/\(\s*\{\s*([^}]+)\s*\}.*?:\s*(?:\w+Props|\{[^}]+\})/s);
  const propsContent = propsMatch?.[1] || '';
  const props = propsContent
    .split(/[,\n]/)
    .map(prop => prop.trim().split(/[?:]/)[0].trim())
    .filter(prop => prop && !prop.includes('//') && prop.length > 0);
  
  // Extract hooks used
  const hooksRegex = /use[A-Z]\w+/g;
  const hooks = [...new Set(content.match(hooksRegex) || [])];
  
  // Extract common patterns
  const patterns = [];
  
  // Form patterns
  if (content.includes('useForm') || content.includes('<form')) {
    patterns.push('form-handling');
  }
  
  // State management patterns
  if (content.includes('useState') || content.includes('useReducer')) {
    patterns.push('state-management');
  }
  
  // API patterns
  if (content.includes('useQuery') || content.includes('useMutation') || content.includes('fetch')) {
    patterns.push('api-integration');
  }
  
  // Modal/Dialog patterns
  if (content.includes('Dialog') || content.includes('Modal') || content.includes('isOpen')) {
    patterns.push('modal-dialog');
  }
  
  // List/Table patterns
  if (content.includes('map(') || content.includes('Table') || content.includes('List')) {
    patterns.push('list-rendering');
  }
  
  // Card patterns
  if (content.includes('Card') || content.match(/className.*card/)) {
    patterns.push('card-layout');
  }
  
  // Button patterns
  if (content.includes('Button') || content.includes('onClick')) {
    patterns.push('button-actions');
  }
  
  // Loading states
  if (content.includes('loading') || content.includes('Loading') || content.includes('Spinner')) {
    patterns.push('loading-states');
  }
  
  // Error handling
  if (content.includes('error') || content.includes('Error') || content.includes('try') || content.includes('catch')) {
    patterns.push('error-handling');
  }
  
  // Calculate complexity score
  const complexity = calculateComponentComplexity(content);
  
  return {
    name: componentName,
    filePath,
    props,
    hooks,
    patterns,
    complexity,
    similarComponents: []
  };
};

const calculateComponentComplexity = (content: string): number => {
  let score = 0;
  
  // Base complexity
  score += (content.match(/if\s*\(/g) || []).length * 1;
  score += (content.match(/\?\s*.*?\s*:/g) || []).length * 1;
  score += (content.match(/&&/g) || []).length * 0.5;
  score += (content.match(/useState|useReducer/g) || []).length * 2;
  score += (content.match(/useEffect/g) || []).length * 3;
  score += (content.match(/try\s*\{|catch\s*\(/g) || []).length * 2;
  score += (content.match(/\.map\s*\(/g) || []).length * 1;
  
  return Math.round(score);
};

const findSimilarComponents = (components: ComponentAnalysis[]): ComponentAnalysis[] => {
  return components.map(component => {
    const similar = components.filter(other => 
      other.name !== component.name &&
      (
        // Same patterns
        component.patterns.some(pattern => other.patterns.includes(pattern)) ||
        // Similar props (>50% overlap)
        (component.props.filter(prop => other.props.includes(prop)).length / Math.max(component.props.length, 1)) > 0.5 ||
        // Similar hooks
        component.hooks.filter(hook => other.hooks.includes(hook)).length >= 2
      )
    ).map(c => c.name);
    
    return {
      ...component,
      similarComponents: similar
    };
  });
};

const generateRedundancyReport = (components: ComponentAnalysis[]): RedundancyResult[] => {
  return components
    .filter(component => component.similarComponents.length > 0)
    .map(component => {
      const redundancyScore = Math.min(
        (component.similarComponents.length * 20) + 
        (component.patterns.length * 5) +
        (component.complexity * 2),
        100
      );
      
      const reusabilityOpportunity: 'high' | 'medium' | 'low' = 
        redundancyScore > 60 ? 'high' :
        redundancyScore > 30 ? 'medium' : 'low';
      
      const suggestedRefactor = generateRefactorSuggestion(component);
      
      return {
        componentName: component.name,
        redundancyScore,
        duplicatePatterns: component.patterns,
        reusabilityOpportunity,
        suggestedRefactor
      };
    })
    .sort((a, b) => b.redundancyScore - a.redundancyScore);
};

const generateRefactorSuggestion = (component: ComponentAnalysis): string => {
  if (component.patterns.includes('form-handling') && component.similarComponents.length > 2) {
    return `Create reusable FormComponent with configurable fields: ${component.props.filter(p => p.includes('field') || p.includes('value') || p.includes('error')).join(', ')}`;
  }
  
  if (component.patterns.includes('modal-dialog') && component.similarComponents.length > 1) {
    return `Extract BaseModal component with common props: ${component.props.filter(p => p.includes('open') || p.includes('close') || p.includes('title')).join(', ')}`;
  }
  
  if (component.patterns.includes('card-layout') && component.similarComponents.length > 2) {
    return `Create StandardCard component with slots: header, content, actions`;
  }
  
  if (component.patterns.includes('list-rendering') && component.similarComponents.length > 1) {
    return `Extract DataList component with configurable rendering: ${component.props.filter(p => p.includes('data') || p.includes('item')).join(', ')}`;
  }
  
  if (component.complexity > 15) {
    return `Break down complex component (complexity: ${component.complexity}) into smaller components`;
  }
  
  return `Consider extracting common patterns: ${component.patterns.slice(0, 3).join(', ')}`;
};

describe('Enhanced UI Component Redundancy Detection', () => {
  const clientDir = './client/src/components';
  let componentFiles: string[] = [];
  let componentAnalyses: ComponentAnalysis[] = [];

  beforeAll(() => {
    // Scan for component files
    const scanDirectory = (dir: string) => {
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
            scanDirectory(fullPath);
          } else if (item.isFile() && item.name.endsWith('.tsx') && !item.name.includes('.test.')) {
            componentFiles.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist
      }
    };
    
    scanDirectory(clientDir);
    
    // Analyze all components
    componentAnalyses = componentFiles
      .map(filePath => {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          return extractComponentInfo(filePath, content);
        } catch {
          return null;
        }
      })
      .filter((analysis): analysis is ComponentAnalysis => analysis !== null);
      
    // Find similar components
    componentAnalyses = findSimilarComponents(componentAnalyses);
  });

  describe('Component Structure Analysis', () => {
    it('should analyze all UI components and identify patterns', () => {
      console.log('\n=== COMPONENT STRUCTURE ANALYSIS ===\n');
      console.log(`Total components analyzed: ${componentAnalyses.length}`);
      
      // Group by patterns
      const patternGroups = new Map<string, ComponentAnalysis[]>();
      componentAnalyses.forEach(component => {
        component.patterns.forEach(pattern => {
          if (!patternGroups.has(pattern)) {
            patternGroups.set(pattern, []);
          }
          patternGroups.get(pattern)!.push(component);
        });
      });
      
      console.log('\nPattern distribution:');
      [...patternGroups.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([pattern, components]) => {
          console.log(`- ${pattern}: ${components.length} components`);
        });
      
      // Complexity analysis
      const complexityStats = {
        low: componentAnalyses.filter(c => c.complexity <= 5).length,
        medium: componentAnalyses.filter(c => c.complexity > 5 && c.complexity <= 15).length,
        high: componentAnalyses.filter(c => c.complexity > 15).length
      };
      
      console.log('\nComplexity distribution:');
      console.log(`- Low (≤5): ${complexityStats.low} components`);
      console.log(`- Medium (6-15): ${complexityStats.medium} components`);
      console.log(`- High (>15): ${complexityStats.high} components`);
      
      expect(componentAnalyses.length).toBeGreaterThan(0);
    });

    it('should identify components with similar patterns', () => {
      const componentsWithSimilar = componentAnalyses.filter(c => c.similarComponents.length > 0);
      
      console.log('\n=== SIMILAR COMPONENT PATTERNS ===\n');
      console.log(`Components with similar patterns: ${componentsWithSimilar.length}`);
      
      componentsWithSimilar
        .sort((a, b) => b.similarComponents.length - a.similarComponents.length)
        .slice(0, 10)
        .forEach(component => {
          console.log(`\n📦 ${component.name}`);
          console.log(`   File: ${component.filePath.replace('./client/src/', '')}`);
          console.log(`   Patterns: ${component.patterns.join(', ')}`);
          console.log(`   Similar to: ${component.similarComponents.slice(0, 3).join(', ')}${component.similarComponents.length > 3 ? '...' : ''}`);
          console.log(`   Complexity: ${component.complexity}`);
        });
      
      expect(componentsWithSimilar.length).toBeGreaterThan(0);
    });

    it('should analyze prop patterns and commonalities', () => {
      const allProps = componentAnalyses.flatMap(c => c.props);
      const propFrequency = new Map<string, number>();
      
      allProps.forEach(prop => {
        propFrequency.set(prop, (propFrequency.get(prop) || 0) + 1);
      });
      
      const commonProps = [...propFrequency.entries()]
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);
      
      console.log('\n=== PROP PATTERN ANALYSIS ===\n');
      console.log(`Total unique props: ${propFrequency.size}`);
      console.log(`Common props (used 3+ times): ${commonProps.length}`);
      
      console.log('\nMost common props:');
      commonProps.slice(0, 15).forEach(([prop, count]) => {
        console.log(`- ${prop}: ${count} components`);
      });
      
      // Suggest interface consolidation
      const interfaceSuggestions = [];
      if (propFrequency.get('className') && propFrequency.get('className')! > 5) {
        interfaceSuggestions.push('BaseProps with className');
      }
      if (propFrequency.get('children') && propFrequency.get('children')! > 5) {
        interfaceSuggestions.push('ContainerProps with children');
      }
      if ((propFrequency.get('onSubmit') || 0) + (propFrequency.get('onCancel') || 0) > 3) {
        interfaceSuggestions.push('FormActionProps with submit/cancel handlers');
      }
      
      if (interfaceSuggestions.length > 0) {
        console.log('\n💡 Suggested interface consolidation:');
        interfaceSuggestions.forEach(suggestion => {
          console.log(`- ${suggestion}`);
        });
      }
      
      expect(commonProps.length).toBeGreaterThan(0);
    });
  });

  describe('Redundancy Detection and Refactoring Opportunities', () => {
    it('should generate comprehensive redundancy report', () => {
      const redundancyResults = generateRedundancyReport(componentAnalyses);
      
      console.log('\n=== REDUNDANCY ANALYSIS REPORT ===\n');
      console.log(`Components with redundancy potential: ${redundancyResults.length}`);
      
      // Group by reusability opportunity
      const highOpportunity = redundancyResults.filter(r => r.reusabilityOpportunity === 'high');
      const mediumOpportunity = redundancyResults.filter(r => r.reusabilityOpportunity === 'medium');
      const lowOpportunity = redundancyResults.filter(r => r.reusabilityOpportunity === 'low');
      
      console.log(`- High reusability potential: ${highOpportunity.length}`);
      console.log(`- Medium reusability potential: ${mediumOpportunity.length}`);
      console.log(`- Low reusability potential: ${lowOpportunity.length}`);
      
      // Show top redundancy candidates
      console.log('\n🔥 TOP REDUNDANCY CANDIDATES:\n');
      redundancyResults.slice(0, 8).forEach((result, index) => {
        console.log(`${index + 1}. ${result.componentName}`);
        console.log(`   Redundancy Score: ${result.redundancyScore}/100`);
        console.log(`   Patterns: ${result.duplicatePatterns.join(', ')}`);
        console.log(`   Opportunity: ${result.reusabilityOpportunity.toUpperCase()}`);
        console.log(`   💡 Suggestion: ${result.suggestedRefactor}`);
        console.log('');
      });
      
      expect(redundancyResults.length).toBeGreaterThan(0);
    });

    it('should identify component extraction opportunities', () => {
      // Find patterns that appear in multiple components
      const patternComponents = new Map<string, string[]>();
      
      componentAnalyses.forEach(component => {
        component.patterns.forEach(pattern => {
          if (!patternComponents.has(pattern)) {
            patternComponents.set(pattern, []);
          }
          patternComponents.get(pattern)!.push(component.name);
        });
      });
      
      const extractionOpportunities = [...patternComponents.entries()]
        .filter(([_, components]) => components.length >= 3)
        .sort((a, b) => b[1].length - a[1].length);
      
      console.log('\n=== COMPONENT EXTRACTION OPPORTUNITIES ===\n');
      console.log(`Patterns suitable for extraction: ${extractionOpportunities.length}`);
      
      extractionOpportunities.forEach(([pattern, components]) => {
        console.log(`\n🧩 ${pattern.toUpperCase()} PATTERN`);
        console.log(`   Used in ${components.length} components`);
        console.log(`   Components: ${components.slice(0, 5).join(', ')}${components.length > 5 ? '...' : ''}`);
        
        // Generate extraction suggestion
        const suggestion = generateExtractionSuggestion(pattern, components);
        console.log(`   💡 Extraction: ${suggestion}`);
      });
      
      expect(extractionOpportunities.length).toBeGreaterThan(0);
    });

    it('should calculate overall codebase redundancy metrics', () => {
      const totalComponents = componentAnalyses.length;
      const componentsWithSimilar = componentAnalyses.filter(c => c.similarComponents.length > 0).length;
      const redundancyResults = generateRedundancyReport(componentAnalyses);
      
      const metrics = {
        totalComponents,
        componentsWithRedundancy: componentsWithSimilar,
        highOpportunityComponents: redundancyResults.filter(r => r.reusabilityOpportunity === 'high').length,
        averageComplexity: Math.round(componentAnalyses.reduce((sum, c) => sum + c.complexity, 0) / totalComponents),
        redundancyPercentage: Math.round((componentsWithSimilar / totalComponents) * 100),
        extractionOpportunities: [...new Set(componentAnalyses.flatMap(c => c.patterns))].length
      };
      
      console.log('\n=== CODEBASE REDUNDANCY METRICS ===\n');
      console.log(`📊 Overall Statistics:`);
      console.log(`   Total Components: ${metrics.totalComponents}`);
      console.log(`   Components with Redundancy: ${metrics.componentsWithRedundancy} (${metrics.redundancyPercentage}%)`);
      console.log(`   High-Priority Refactor Candidates: ${metrics.highOpportunityComponents}`);
      console.log(`   Average Complexity Score: ${metrics.averageComplexity}/100`);
      console.log(`   Unique Patterns Identified: ${metrics.extractionOpportunities}`);
      
      // Redundancy health assessment
      console.log('\n🏥 Codebase Health Assessment:');
      if (metrics.redundancyPercentage > 40) {
        console.log('   🔴 HIGH REDUNDANCY: Significant refactoring opportunities');
        console.log('   📈 Recommended: Start with high-priority components');
      } else if (metrics.redundancyPercentage > 20) {
        console.log('   🟡 MODERATE REDUNDANCY: Some consolidation beneficial');
        console.log('   ⚖️ Recommended: Focus on pattern extraction');
      } else {
        console.log('   🟢 LOW REDUNDANCY: Well-structured component base');
        console.log('   ✨ Recommended: Maintain current patterns');
      }
      
      // Provide actionable recommendations
      console.log('\n🎯 Action Items:');
      if (metrics.highOpportunityComponents > 0) {
        console.log(`   1. Refactor ${metrics.highOpportunityComponents} high-priority components`);
      }
      if (metrics.averageComplexity > 10) {
        console.log(`   2. Break down complex components (avg complexity: ${metrics.averageComplexity})`);
      }
      if (metrics.extractionOpportunities > 15) {
        console.log(`   3. Extract common patterns into reusable components`);
      }
      console.log(`   4. Consider creating design system components for repeated patterns`);
      
      expect(metrics.totalComponents).toBeGreaterThan(0);
    });
  });
});

// Helper function for extraction suggestions
const generateExtractionSuggestion = (pattern: string, components: string[]): string => {
  switch (pattern) {
    case 'form-handling':
      return `Create BaseForm component with validation, error handling, and submit logic`;
    case 'modal-dialog':
      return `Extract ModalWrapper with backdrop, close handling, and common styling`;
    case 'card-layout':
      return `Build CardComponent with header, content, actions, and variants`;
    case 'list-rendering':
      return `Create DataTable/List component with pagination, sorting, filtering`;
    case 'loading-states':
      return `Build LoadingWrapper component with skeleton states`;
    case 'error-handling':
      return `Extract ErrorBoundary/ErrorDisplay component`;
    case 'button-actions':
      return `Create ActionButton component with loading states and variants`;
    case 'api-integration':
      return `Build ApiWrapper hook with loading, error, and data states`;
    case 'state-management':
      return `Extract custom hooks for common state patterns`;
    default:
      return `Create reusable hook or component for ${pattern} pattern`;
  }
};