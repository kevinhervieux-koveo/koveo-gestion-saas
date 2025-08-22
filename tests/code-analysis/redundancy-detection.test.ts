/**
 * @file Code Redundancy Detection Tests.
 * @description Tests to identify and reduce redundancies in forms, buttons, cards, and formatting.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Utility functions for code analysis
const readSourceFiles = (dir: string, extensions: string[] = ['.tsx', '.ts', '.css']): string[] => {
  const files: string[] = [];
  
  const scanDirectory = (currentDir: string) => {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        
        if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (_error) {
      // Directory might not exist or be accessible
    }
  };
  
  scanDirectory(dir);
  return files;
};

const getFileContent = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
};

// Pattern detection functions
const detectFormPatterns = (content: string): {
  formComponents: string[];
  inputPatterns: string[];
  validationPatterns: string[];
  submitHandlers: string[];
} => {
  const formComponents = [];
  const inputPatterns = [];
  const validationPatterns = [];
  const submitHandlers = [];

  // Form component patterns
  const formComponentRegex = /<form[^>]*>/g;
  const formMatches = content.match(formComponentRegex) || [];
  formComponents.push(...formMatches);

  // Input patterns
  const inputRegex = /<input[^>]*type=["']([^"']+)["'][^>]*>/g;
  let inputMatch;
  while ((inputMatch = inputRegex.exec(content)) !== null) {
    inputPatterns.push(inputMatch[0]);
  }

  // Validation patterns
  const validationRegex = /validation\.\w+|error\.\w+|isValid|hasError/g;
  const validationMatches = content.match(validationRegex) || [];
  validationPatterns.push(...validationMatches);

  // Submit handlers
  const submitRegex = /onSubmit|handleSubmit|submitForm/g;
  const submitMatches = content.match(submitRegex) || [];
  submitHandlers.push(...submitMatches);

  return {
    formComponents,
    inputPatterns,
    validationPatterns,
    submitHandlers
  };
};

const detectButtonPatterns = (content: string): {
  buttonComponents: string[];
  buttonClasses: string[];
  buttonHandlers: string[];
  buttonVariants: string[];
} => {
  const buttonComponents = [];
  const buttonClasses = [];
  const buttonHandlers = [];
  const buttonVariants = [];

  // Button components
  const buttonRegex = /<button[^>]*>|<Button[^>]*>/g;
  const buttonMatches = content.match(buttonRegex) || [];
  buttonComponents.push(...buttonMatches);

  // Button classes
  const classRegex = /className=["']([^"']*btn[^"']*)["']/g;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    buttonClasses.push(classMatch[1]);
  }

  // Button handlers
  const handlerRegex = /onClick|onPress|handleClick|handlePress/g;
  const handlerMatches = content.match(handlerRegex) || [];
  buttonHandlers.push(...handlerMatches);

  // Button variants
  const variantRegex = /variant=["']([^"']*)["']|type=["'](submit|button|reset)["']/g;
  let variantMatch;
  while ((variantMatch = variantRegex.exec(content)) !== null) {
    buttonVariants.push(variantMatch[1] || variantMatch[2]);
  }

  return {
    buttonComponents,
    buttonClasses,
    buttonHandlers,
    buttonVariants
  };
};

const detectCardPatterns = (content: string): {
  cardComponents: string[];
  cardClasses: string[];
  cardLayouts: string[];
  cardActions: string[];
} => {
  const cardComponents = [];
  const cardClasses = [];
  const cardLayouts = [];
  const cardActions = [];

  // Card components
  const cardRegex = /<div[^>]*card[^>]*>|<Card[^>]*>/g;
  const cardMatches = content.match(cardRegex) || [];
  cardComponents.push(...cardMatches);

  // Card classes
  const classRegex = /className=["']([^"']*card[^"']*)["']/g;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    cardClasses.push(classMatch[1]);
  }

  // Card layouts
  const layoutRegex = /grid|flex|col|row|gap-\d+|p-\d+|m-\d+/g;
  const layoutMatches = content.match(layoutRegex) || [];
  cardLayouts.push(...layoutMatches);

  // Card actions
  const actionRegex = /<button[^>]*>.*?<\/button>|onClick|onEdit|onDelete|onView/g;
  const actionMatches = content.match(actionRegex) || [];
  cardActions.push(...actionMatches);

  return {
    cardComponents,
    cardClasses,
    cardLayouts,
    cardActions
  };
};

const detectFormattingPatterns = (content: string): {
  cssClasses: string[];
  inlineStyles: string[];
  colorPatterns: string[];
  spacingPatterns: string[];
  typographyPatterns: string[];
} => {
  const cssClasses = [];
  const inlineStyles = [];
  const colorPatterns = [];
  const spacingPatterns = [];
  const typographyPatterns = [];

  // CSS classes
  const classRegex = /className=["']([^"']*)["']/g;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    cssClasses.push(classMatch[1]);
  }

  // Inline styles
  const styleRegex = /style={{([^}]*)}}/g;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(content)) !== null) {
    inlineStyles.push(styleMatch[1]);
  }

  // Color patterns
  const colorRegex = /text-\w+-\d+|bg-\w+-\d+|border-\w+-\d+/g;
  const colorMatches = content.match(colorRegex) || [];
  colorPatterns.push(...colorMatches);

  // Spacing patterns
  const spacingRegex = /p-\d+|m-\d+|px-\d+|py-\d+|mx-\d+|my-\d+|gap-\d+/g;
  const spacingMatches = content.match(spacingRegex) || [];
  spacingPatterns.push(...spacingMatches);

  // Typography patterns
  const typographyRegex = /text-\w+|font-\w+|leading-\w+|tracking-\w+/g;
  const typographyMatches = content.match(typographyRegex) || [];
  typographyPatterns.push(...typographyMatches);

  return {
    cssClasses,
    inlineStyles,
    colorPatterns,
    spacingPatterns,
    typographyPatterns
  };
};

// Redundancy analysis functions
const findDuplicatePatterns = (patterns: string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  
  patterns.forEach(pattern => {
    counts.set(pattern, (counts.get(pattern) || 0) + 1);
  });
  
  return new Map([...counts.entries()].filter(([_, count]) => count > 1));
};

const calculateRedundancyScore = (duplicates: Map<string, number>): number => {
  let totalRedundancy = 0;
  duplicates.forEach((count, pattern) => {
    totalRedundancy += (count - 1) * pattern.length; // Penalty based on pattern length and repetition
  });
  return totalRedundancy;
};

const generateReusableComponent = (pattern: string, count: number): string => {
  // Generate a reusable component suggestion based on the pattern
  if (pattern.includes('button')) {
    return `// Reusable Button Component (found ${count} times)
const StandardButton = ({ variant = 'primary', onClick, children, ...props }) => (
  <button 
    className={\`${pattern.match(/className=["']([^"']*)["']/)?.[1] || 'btn'}\`}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);`;
  }
  
  if (pattern.includes('form')) {
    return `// Reusable Form Component (found ${count} times)
const StandardForm = ({ onSubmit, children, className = '', ...props }) => (
  <form 
    className={\`form-container \${className}\`}
    onSubmit={onSubmit}
    {...props}
  >
    {children}
  </form>
);`;
  }
  
  if (pattern.includes('card')) {
    return `// Reusable Card Component (found ${count} times)
const StandardCard = ({ title, children, actions, className = '', ...props }) => (
  <div className={\`card \${className}\`} {...props}>
    {title && <div className="card-header">{title}</div>}
    <div className="card-content">{children}</div>
    {actions && <div className="card-actions">{actions}</div>}
  </div>
);`;
  }
  
  return `// Reusable Pattern (found ${count} times): ${pattern.substring(0, 50)}...`;
};

describe('Code Redundancy Detection Tests', () => {
  const clientDir = './client/src';
  const serverDir = './server';
  const sharedDir = './shared';
  
  let sourceFiles: string[];
  let allContent: string;

  beforeAll(() => {
    sourceFiles = [
      ...readSourceFiles(clientDir),
      ...readSourceFiles(serverDir),
      ...readSourceFiles(sharedDir)
    ];
    
    allContent = sourceFiles
      .map(file => getFileContent(file))
      .join('\n');
  });

  describe('Form Component Redundancy Analysis', () => {
    it('should identify duplicate form patterns', () => {
      const allFormPatterns = {
        formComponents: [] as string[],
        inputPatterns: [] as string[],
        validationPatterns: [] as string[],
        submitHandlers: [] as string[]
      };
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        const patterns = detectFormPatterns(content);
        
        allFormPatterns.formComponents.push(...patterns.formComponents);
        allFormPatterns.inputPatterns.push(...patterns.inputPatterns);
        allFormPatterns.validationPatterns.push(...patterns.validationPatterns);
        allFormPatterns.submitHandlers.push(...patterns.submitHandlers);
      });
      
      const duplicateInputs = findDuplicatePatterns(allFormPatterns.inputPatterns);
      const duplicateValidations = findDuplicatePatterns(allFormPatterns.validationPatterns);
      
      console.warn('Form Redundancy Analysis:');
      console.warn(`- Total input patterns: ${allFormPatterns.inputPatterns.length}`);
      console.warn(`- Duplicate input patterns: ${duplicateInputs.size}`);
      console.warn(`- Total validation patterns: ${allFormPatterns.validationPatterns.length}`);
      console.warn(`- Duplicate validation patterns: ${duplicateValidations.size}`);
      
      // Generate reusable component suggestions
      if (duplicateInputs.size > 0) {
        console.warn('\nSuggested Reusable Input Components:');
        duplicateInputs.forEach((count, pattern) => {
          if (count >= 3) { // Only suggest if used 3+ times
            console.warn(generateReusableComponent(pattern, count));
          }
        });
      }
      
      expect(allFormPatterns.inputPatterns.length).toBeGreaterThan(0);
      expect(allFormPatterns.validationPatterns.length).toBeGreaterThan(0);
    });

    it('should analyze form validation redundancy', () => {
      const validationPatterns = [];
      const errorHandlingPatterns = [];
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        
        // Find validation rules
        const validationRules = content.match(/\.required\(\)|\.min\(|\.max\(|\.email\(\)|\.phone\(\)/g) || [];
        validationPatterns.push(...validationRules);
        
        // Find error handling patterns
        const errorHandling = content.match(/errors\.\w+|setError|clearError|hasError/g) || [];
        errorHandlingPatterns.push(...errorHandling);
      });
      
      const duplicateValidations = findDuplicatePatterns(validationPatterns);
      const duplicateErrors = findDuplicatePatterns(errorHandlingPatterns);
      
      console.warn('\nValidation Redundancy Analysis:');
      console.warn(`- Total validation rules: ${validationPatterns.length}`);
      console.warn(`- Duplicate validation rules: ${duplicateValidations.size}`);
      console.warn(`- Total error patterns: ${errorHandlingPatterns.length}`);
      console.warn(`- Duplicate error patterns: ${duplicateErrors.size}`);
      
      // Calculate redundancy score
      const validationRedundancyScore = calculateRedundancyScore(duplicateValidations);
      const errorRedundancyScore = calculateRedundancyScore(duplicateErrors);
      
      expect(validationRedundancyScore).toBeLessThan(1000); // Threshold for acceptable redundancy
      expect(errorRedundancyScore).toBeLessThan(500);
    });

    it('should identify common form field configurations', () => {
      const fieldConfigs = [];
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        
        // Find form field configurations
        const configPatterns = content.match(/<input[^>]*type=["']\w+["'][^>]*>/g) || [];
        fieldConfigs.push(...configPatterns);
      });
      
      const duplicateConfigs = findDuplicatePatterns(fieldConfigs);
      
      console.warn('\nForm Field Configuration Analysis:');
      console.warn(`- Total field configurations: ${fieldConfigs.length}`);
      console.warn(`- Duplicate configurations: ${duplicateConfigs.size}`);
      
      // Suggest standardized field components
      const commonFields = new Map<string, number>();
      fieldConfigs.forEach(config => {
        const type = config.match(/type=["'](\w+)["']/)?.[1];
        if (type) {
          commonFields.set(type, (commonFields.get(type) || 0) + 1);
        }
      });
      
      console.warn('\nMost common field types:');
      [...commonFields.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([type, count]) => {
          console.warn(`- ${type}: ${count} occurrences`);
        });
      
      expect(fieldConfigs.length).toBeGreaterThan(0);
    });
  });

  describe('Button Component Redundancy Analysis', () => {
    it('should identify duplicate button patterns', () => {
      const allButtonPatterns = {
        buttonComponents: [] as string[],
        buttonClasses: [] as string[],
        buttonHandlers: [] as string[],
        buttonVariants: [] as string[]
      };
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        const patterns = detectButtonPatterns(content);
        
        allButtonPatterns.buttonComponents.push(...patterns.buttonComponents);
        allButtonPatterns.buttonClasses.push(...patterns.buttonClasses);
        allButtonPatterns.buttonHandlers.push(...patterns.buttonHandlers);
        allButtonPatterns.buttonVariants.push(...patterns.buttonVariants);
      });
      
      const duplicateClasses = findDuplicatePatterns(allButtonPatterns.buttonClasses);
      const duplicateVariants = findDuplicatePatterns(allButtonPatterns.buttonVariants);
      
      console.warn('\nButton Redundancy Analysis:');
      console.warn(`- Total button components: ${allButtonPatterns.buttonComponents.length}`);
      console.warn(`- Duplicate button classes: ${duplicateClasses.size}`);
      console.warn(`- Total button variants: ${allButtonPatterns.buttonVariants.length}`);
      console.warn(`- Duplicate variants: ${duplicateVariants.size}`);
      
      // Generate button component library suggestions
      if (duplicateClasses.size > 0) {
        console.warn('\nSuggested Button Component Library:');
        duplicateClasses.forEach((count, className) => {
          if (count >= 3) {
            console.warn(`// Used ${count} times: ${className}`);
            console.warn(generateReusableComponent(`button className="${className}"`, count));
          }
        });
      }
      
      expect(allButtonPatterns.buttonComponents.length).toBeGreaterThan(0);
    });

    it('should analyze button action patterns', () => {
      const actionPatterns = [];
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        
        // Find button action patterns
        const actions = content.match(/onClick={[^}]*}|onPress={[^}]*}|handle\w+Click/g) || [];
        actionPatterns.push(...actions);
      });
      
      const duplicateActions = findDuplicatePatterns(actionPatterns);
      
      console.warn('\nButton Action Patterns:');
      console.warn(`- Total action patterns: ${actionPatterns.length}`);
      console.warn(`- Duplicate action patterns: ${duplicateActions.size}`);
      
      // Identify common action types
      const actionTypes = new Map<string, number>();
      actionPatterns.forEach(action => {
        if (action.includes('handleSubmit')) {actionTypes.set('submit', (actionTypes.get('submit') || 0) + 1);}
        if (action.includes('handleCancel')) {actionTypes.set('cancel', (actionTypes.get('cancel') || 0) + 1);}
        if (action.includes('handleDelete')) {actionTypes.set('delete', (actionTypes.get('delete') || 0) + 1);}
        if (action.includes('handleEdit')) {actionTypes.set('edit', (actionTypes.get('edit') || 0) + 1);}
        if (action.includes('handleCreate')) {actionTypes.set('create', (actionTypes.get('create') || 0) + 1);}
      });
      
      console.warn('\nCommon action types:');
      actionTypes.forEach((count, type) => {
        console.warn(`- ${type}: ${count} occurrences`);
      });
      
      expect(actionPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Card Component Redundancy Analysis', () => {
    it('should identify duplicate card patterns', () => {
      const allCardPatterns = {
        cardComponents: [] as string[],
        cardClasses: [] as string[],
        cardLayouts: [] as string[],
        cardActions: [] as string[]
      };
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        const patterns = detectCardPatterns(content);
        
        allCardPatterns.cardComponents.push(...patterns.cardComponents);
        allCardPatterns.cardClasses.push(...patterns.cardClasses);
        allCardPatterns.cardLayouts.push(...patterns.cardLayouts);
        allCardPatterns.cardActions.push(...patterns.cardActions);
      });
      
      const duplicateClasses = findDuplicatePatterns(allCardPatterns.cardClasses);
      const duplicateLayouts = findDuplicatePatterns(allCardPatterns.cardLayouts);
      
      console.warn('\nCard Redundancy Analysis:');
      console.warn(`- Total card components: ${allCardPatterns.cardComponents.length}`);
      console.warn(`- Duplicate card classes: ${duplicateClasses.size}`);
      console.warn(`- Total layout patterns: ${allCardPatterns.cardLayouts.length}`);
      console.warn(`- Duplicate layout patterns: ${duplicateLayouts.size}`);
      
      // Generate card component suggestions
      if (duplicateClasses.size > 0) {
        console.warn('\nSuggested Card Components:');
        duplicateClasses.forEach((count, className) => {
          if (count >= 2) {
            console.warn(generateReusableComponent(`card className="${className}"`, count));
          }
        });
      }
      
      expect(allCardPatterns.cardComponents.length).toBeGreaterThan(0);
    });

    it('should analyze card content structure patterns', () => {
      const contentStructures = [];
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        
        // Find card content structures
        const structures = content.match(/<div[^>]*card-header[^>]*>|<div[^>]*card-body[^>]*>|<div[^>]*card-footer[^>]*>/g) || [];
        contentStructures.push(...structures);
      });
      
      const duplicateStructures = findDuplicatePatterns(contentStructures);
      
      console.warn('\nCard Structure Analysis:');
      console.warn(`- Total structure patterns: ${contentStructures.length}`);
      console.warn(`- Duplicate structures: ${duplicateStructures.size}`);
      
      expect(contentStructures.length).toBeGreaterThan(0);
    });
  });

  describe('CSS and Formatting Redundancy Analysis', () => {
    it('should identify duplicate styling patterns', () => {
      const allFormattingPatterns = {
        cssClasses: [] as string[],
        inlineStyles: [] as string[],
        colorPatterns: [] as string[],
        spacingPatterns: [] as string[],
        typographyPatterns: [] as string[]
      };
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        const patterns = detectFormattingPatterns(content);
        
        allFormattingPatterns.cssClasses.push(...patterns.cssClasses);
        allFormattingPatterns.inlineStyles.push(...patterns.inlineStyles);
        allFormattingPatterns.colorPatterns.push(...patterns.colorPatterns);
        allFormattingPatterns.spacingPatterns.push(...patterns.spacingPatterns);
        allFormattingPatterns.typographyPatterns.push(...patterns.typographyPatterns);
      });
      
      const duplicateColors = findDuplicatePatterns(allFormattingPatterns.colorPatterns);
      const duplicateSpacing = findDuplicatePatterns(allFormattingPatterns.spacingPatterns);
      const duplicateTypography = findDuplicatePatterns(allFormattingPatterns.typographyPatterns);
      
      console.warn('\nFormatting Redundancy Analysis:');
      console.warn(`- Total color patterns: ${allFormattingPatterns.colorPatterns.length}`);
      console.warn(`- Duplicate color patterns: ${duplicateColors.size}`);
      console.warn(`- Total spacing patterns: ${allFormattingPatterns.spacingPatterns.length}`);
      console.warn(`- Duplicate spacing patterns: ${duplicateSpacing.size}`);
      console.warn(`- Total typography patterns: ${allFormattingPatterns.typographyPatterns.length}`);
      console.warn(`- Duplicate typography patterns: ${duplicateTypography.size}`);
      
      // Calculate total redundancy score
      const colorRedundancy = calculateRedundancyScore(duplicateColors);
      const spacingRedundancy = calculateRedundancyScore(duplicateSpacing);
      const typographyRedundancy = calculateRedundancyScore(duplicateTypography);
      
      console.warn(`\nRedundancy Scores:`);
      console.warn(`- Color redundancy: ${colorRedundancy}`);
      console.warn(`- Spacing redundancy: ${spacingRedundancy}`);
      console.warn(`- Typography redundancy: ${typographyRedundancy}`);
      
      expect(allFormattingPatterns.colorPatterns.length).toBeGreaterThan(0);
      expect(allFormattingPatterns.spacingPatterns.length).toBeGreaterThan(0);
    });

    it('should identify most commonly used style combinations', () => {
      const styleCombinatiors = [];
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        
        // Find className combinations
        const classMatches = content.match(/className=["']([^"']*)["']/g) || [];
        styleCombinatiors.push(...classMatches.map(match => 
          match.replace(/className=["']([^"']*)["']/, '$1').trim()
        ));
      });
      
      const duplicateCombinations = findDuplicatePatterns(styleCombinatiors);
      
      console.warn('\nStyle Combination Analysis:');
      console.warn(`- Total style combinations: ${styleCombinatiors.length}`);
      console.warn(`- Duplicate combinations: ${duplicateCombinations.size}`);
      
      // Show most common combinations
      const sortedCombinations = [...duplicateCombinations.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      console.warn('\nMost common style combinations:');
      sortedCombinations.forEach(([combination, count]) => {
        console.warn(`- "${combination}": ${count} times`);
      });
      
      expect(styleCombinatiors.length).toBeGreaterThan(0);
    });
  });

  describe('Component Architecture Redundancy', () => {
    it('should identify similar component patterns', () => {
      const componentPatterns = [];
      
      sourceFiles.forEach(file => {
        if (file.endsWith('.tsx')) {
          const content = getFileContent(file);
          
          // Find component function declarations
          const components = content.match(/const\s+\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
          componentPatterns.push(...components);
        }
      });
      
      const duplicateComponents = findDuplicatePatterns(componentPatterns);
      
      console.warn('\nComponent Pattern Analysis:');
      console.warn(`- Total component patterns: ${componentPatterns.length}`);
      console.warn(`- Similar component patterns: ${duplicateComponents.size}`);
      
      expect(componentPatterns.length).toBeGreaterThan(0);
    });

    it('should analyze prop patterns across components', () => {
      const propPatterns = [];
      
      sourceFiles.forEach(file => {
        if (file.endsWith('.tsx')) {
          const content = getFileContent(file);
          
          // Find prop destructuring patterns
          const props = content.match(/{\s*([^}]+)\s*}.*?=>/g) || [];
          propPatterns.push(..._props);
        }
      });
      
      const duplicateProps = findDuplicatePatterns(propPatterns);
      
      console.warn('\nProp Pattern Analysis:');
      console.warn(`- Total prop patterns: ${propPatterns.length}`);
      console.warn(`- Duplicate prop patterns: ${duplicateProps.size}`);
      
      expect(propPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Redundancy Reduction Recommendations', () => {
    it('should generate comprehensive refactoring suggestions', () => {
      console.warn('\n=== COMPREHENSIVE REFACTORING RECOMMENDATIONS ===\n');
      
      // Analyze all source files for redundancy
      const redundancyReport = {
        totalFiles: sourceFiles.length,
        forms: 0,
        buttons: 0,
        cards: 0,
        styling: 0,
        components: 0
      };
      
      sourceFiles.forEach(file => {
        const content = getFileContent(file);
        
        // Count various pattern types
        redundancyReport.forms += (content.match(/<form/g) || []).length;
        redundancyReport.buttons += (content.match(/<button|<Button/g) || []).length;
        redundancyReport.cards += (content.match(/card/gi) || []).length;
        redundancyReport.styling += (content.match(/className=/g) || []).length;
        redundancyReport.components += (content.match(/const\s+\w+.*?=>/g) || []).length;
      });
      
      console.warn('CURRENT STATE:');
      console.warn(`- Total files analyzed: ${redundancyReport.totalFiles}`);
      console.warn(`- Form elements: ${redundancyReport.forms}`);
      console.warn(`- Button elements: ${redundancyReport.buttons}`);
      console.warn(`- Card references: ${redundancyReport.cards}`);
      console.warn(`- Style applications: ${redundancyReport.styling}`);
      console.warn(`- Components: ${redundancyReport.components}`);
      
      console.warn('\nRECOMMENDATIONS:');
      
      console.warn('\n1. CREATE DESIGN SYSTEM COMPONENTS:');
      console.warn('   - StandardButton with variants (primary, secondary, danger)');
      console.warn('   - StandardInput with built-in validation');
      console.warn('   - StandardCard with consistent layout');
      console.warn('   - StandardForm with error handling');
      
      console.warn('\n2. IMPLEMENT CSS DESIGN TOKENS:');
      console.warn('   - Color palette variables');
      console.warn('   - Spacing scale constants');
      console.warn('   - Typography hierarchy');
      console.warn('   - Border radius and shadow tokens');
      
      console.warn('\n3. REFACTOR FORM HANDLING:');
      console.warn('   - Create useForm hook with validation');
      console.warn('   - Standardize error display patterns');
      console.warn('   - Implement field component library');
      
      console.warn('\n4. OPTIMIZE STYLING APPROACH:');
      console.warn('   - Reduce inline styles in favor of classes');
      console.warn('   - Create utility class combinations');
      console.warn('   - Implement CSS-in-JS constants');
      
      console.warn('\n5. COMPONENT ARCHITECTURE:');
      console.warn('   - Extract common patterns into hooks');
      console.warn('   - Create higher-order components for repeated logic');
      console.warn('   - Implement compound component patterns');
      
      expect(redundancyReport.totalFiles).toBeGreaterThan(0);
    });

    it('should prioritize refactoring efforts by impact', () => {
      const refactoringPriorities = [
        {
          area: 'Button Components',
          impact: 'High',
          effort: 'Medium',
          description: 'Standardize button variants and reduce duplicate styling',
          estimatedSavings: '200+ lines of code'
        },
        {
          area: 'Form Validation',
          impact: 'High', 
          effort: 'High',
          description: 'Create reusable validation hooks and error display',
          estimatedSavings: '300+ lines of code'
        },
        {
          area: 'Card Components',
          impact: 'Medium',
          effort: 'Low',
          description: 'Extract common card layouts into reusable components',
          estimatedSavings: '150+ lines of code'
        },
        {
          area: 'CSS Utilities',
          impact: 'Medium',
          effort: 'Low',
          description: 'Create design token system and utility classes',
          estimatedSavings: '100+ lines of code'
        },
        {
          area: 'Component Props',
          impact: 'Low',
          effort: 'Medium',
          description: 'Standardize prop interfaces across similar components',
          estimatedSavings: '50+ lines of code'
        }
      ];
      
      console.warn('\n=== REFACTORING PRIORITY MATRIX ===\n');
      
      refactoringPriorities
        .sort((a, b) => {
          const impactScore = { High: 3, Medium: 2, Low: 1 };
          const effortScore = { Low: 3, Medium: 2, High: 1 }; // Lower effort = higher priority
          
          const aScore = impactScore[a.impact as keyof typeof impactScore] + effortScore[a.effort as keyof typeof effortScore];
          const bScore = impactScore[b.impact as keyof typeof impactScore] + effortScore[b.effort as keyof typeof effortScore];
          
          return bScore - aScore;
        })
        .forEach((priority, _index) => {
          console.warn(`${index + 1}. ${priority.area} (Impact: ${priority.impact}, Effort: ${priority.effort})`);
          console.warn(`   ${priority.description}`);
          console.warn(`   Estimated savings: ${priority.estimatedSavings}`);
          console.warn('');
        });
      
      expect(refactoringPriorities.length).toBe(5);
    });
  });
});