/**
 * @file JSDoc Templates and Auto-generation System.
 * @description Comprehensive JSDoc templates and automation for consistent documentation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * JSDoc template interface for different code patterns.
 */
export interface JSDocTemplate {
  pattern: RegExp;
  template: (_match: RegExpMatchArray, _context: TemplateContext) => string;
  description: string;
}

/**
 * Context information for template generation.
 */
export interface TemplateContext {
  fileName: string;
  fileType: 'component' | 'hook' | 'utility' | 'api' | 'type';
  imports: string[];
  exports: string[];
}

/**
 * JSDoc Template Generator for automated documentation.
 */
export class JSDocTemplateGenerator {
  private projectRoot: string;
  private templates: Map<string, JSDocTemplate> = new Map();

  /**
   * Initialize JSDoc Template Generator.
   * @param projectRoot - The root directory of the project.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.initializeTemplates();
  }

  /**
   * Initialize all JSDoc templates.
   */
  private initializeTemplates(): void {
    // React Component Template
    this.templates.set('react-component', {
      pattern: /export\s+(?:function|const)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)\s*=>\s*{|\(\s*\{([^}]+)\}\s*:\s*([^)]+)\))/g,
      template: (match, _context) => {
        const componentName = match[1];
        const props = match[2]?.split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean) || [];
        
        let jsdoc = `/**\n * ${componentName} component.\n`;
        
        if (props.length > 0) {
          jsdoc += ` * @param props - Component props.\n`;
          props.forEach(prop => {
            jsdoc += ` * @param props.${prop} - ${this.generatePropDescription(prop)}.\n`;
          });
        }
        
        jsdoc += ` * @returns JSX element.\n */\n`;
        return jsdoc;
      },
      description: 'Template for React functional components'
    });

    // React Hook Template
    this.templates.set('react-hook', {
      pattern: /export\s+(?:function|const)\s+(use\w+)\s*(?:=\s*)?(?:\([^)]*\)\s*(?:=>\s*{|{))/g,
      template: (match, _context) => {
        const hookName = match[1];
        return `/**\n * ${hookName} custom hook.\n * @returns Hook return value.\n */\n`;
      },
      description: 'Template for React custom hooks'
    });

    // API Route Handler Template
    this.templates.set('api-handler', {
      pattern: /(?:router\.|app\.)(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s+)?\(?(\w+)\s*,\s*(\w+)\)?\s*=>/g,
      template: (match, _context) => {
        const method = match[1].toUpperCase();
        const route = match[2];
        const reqParam = match[3] || 'req';
        const resParam = match[4] || 'res';
        
        return `/**\n * ${method} ${route} - API endpoint handler.\n * @param ${reqParam} - Express request object.\n * @param ${resParam} - Express response object.\n * @returns Promise resolving to API response.\n */\n`;
      },
      description: 'Template for Express API route handlers'
    });

    // Utility Function Template
    this.templates.set('utility-function', {
      pattern: /export\s+(?:function|const)\s+(\w+)\s*(?:=\s*)?(?:\(([^)]*)\)\s*(?::\s*([^{=]+))?\s*(?:=>\s*{|{))/g,
      template: (match, _context) => {
        const functionName = match[1];
        const params = match[2]?.split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean) || [];
        const returnType = match[3]?.trim();
        
        let jsdoc = `/**\n * ${this.generateFunctionDescription(functionName)}.\n`;
        
        if (params.length > 0) {
          params.forEach(param => {
            jsdoc += ` * @param ${param} - ${this.generateParamDescription(param)}.\n`;
          });
        }
        
        if (returnType && returnType !== 'void') {
          jsdoc += ` * @returns ${this.generateReturnDescription(returnType, functionName)}.\n`;
        }
        
        jsdoc += ` */\n`;
        return jsdoc;
      },
      description: 'Template for utility functions'
    });

    // Type/Interface Template
    this.templates.set('type-definition', {
      pattern: /export\s+(?:interface|type)\s+(\w+)/g,
      template: (match, _context) => {
        const typeName = match[1];
        return `/**\n * ${typeName} type definition.\n */\n`;
      },
      description: 'Template for TypeScript types and interfaces'
    });

    // Class Template
    this.templates.set('class-definition', {
      pattern: /export\s+class\s+(\w+)/g,
      template: (match, _context) => {
        const className = match[1];
        return `/**\n * ${className} class.\n */\n`;
      },
      description: 'Template for class definitions'
    });

    // Method Template
    this.templates.set('class-method', {
      pattern: /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*{/g,
      template: (match, _context) => {
        const methodName = match[1];
        const params = match[2]?.split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean) || [];
        const returnType = match[3]?.trim();
        
        if (methodName === 'constructor') {
          let jsdoc = `  /**\n   * Initialize ${context.fileName} instance.\n`;
          if (params.length > 0) {
            params.forEach(param => {
              jsdoc += `   * @param ${param} - ${this.generateParamDescription(param)}.\n`;
            });
          }
          jsdoc += `   */\n`;
          return jsdoc;
        }
        
        let jsdoc = `  /**\n   * ${this.generateMethodDescription(methodName)}.\n`;
        
        if (params.length > 0) {
          params.forEach(param => {
            if (param && param !== 'this') {
              jsdoc += `   * @param ${param} - ${this.generateParamDescription(param)}.\n`;
            }
          });
        }
        
        if (returnType && returnType !== 'void') {
          jsdoc += `   * @returns ${this.generateReturnDescription(returnType, methodName)}.\n`;
        }
        
        jsdoc += `   */\n`;
        return jsdoc;
      },
      description: 'Template for class methods'
    });
  }

  /**
   * Generate contextual description for component props.
   * @param propName - Name of the prop to describe.
   * @returns Generated description string.
   */
  private generatePropDescription(propName: string): string {
    const propDescriptions: Record<string, string> = {
      // Event handlers
      onSuccess: 'Callback function called when operation succeeds',
      onError: 'Callback function called when operation fails',
      onCancel: 'Callback function called when operation is cancelled',
      onSubmit: 'Callback function called when form is submitted',
      onClick: 'Callback function called when element is clicked',
      onChange: 'Callback function called when value changes',
      onSelect: 'Callback function called when item is selected',
      onClose: 'Callback function called when component closes',
      onOpen: 'Callback function called when component opens',
      
      // State indicators
      isLoading: 'Boolean indicating if operation is in progress',
      isDisabled: 'Boolean indicating if element is disabled',
      isVisible: 'Boolean indicating if element is visible',
      isActive: 'Boolean indicating if element is active',
      isSelected: 'Boolean indicating if element is selected',
      
      // Common props
      children: 'React children elements',
      className: 'CSS class name for styling',
      style: 'Inline styles object',
      title: 'Title text for the element',
      label: 'Label text for the element',
      placeholder: 'Placeholder text for input elements',
      
      // IDs and references
      buildingId: 'Unique identifier for the building',
      userId: 'Unique identifier for the user',
      organizationId: 'Unique identifier for the organization',
      residenceId: 'Unique identifier for the residence',
      billId: 'Unique identifier for the bill',
      
      // Data objects
      _data: 'Data object for the component',
      config: 'Configuration object',
      _options: 'Options object for customization',
      settings: 'Settings configuration object',
      
      // Collections
      items: 'Array of items to display',
      list: 'List of data items',
      rows: 'Array of row data',
      columns: 'Array of column definitions'
    };

    return propDescriptions[propName] || `${propName} parameter`;
  }

  /**
   * Generate contextual description for function parameters.
   * @param paramName - Name of the parameter to describe.
   * @returns Generated description string.
   */
  private generateParamDescription(paramName: string): string {
    const paramDescriptions: Record<string, string> = {
      req: 'Express request object',
      res: 'Express response object',
      next: 'Express next middleware function',
      id: 'Unique identifier',
      _data: 'Data object to process',
      _options: 'Configuration options',
      config: 'Configuration object',
      _params: 'Parameters object',
      query: 'Query parameters',
      body: 'Request body data',
      headers: 'HTTP headers object',
      payload: 'Data payload',
      callback: 'Callback function',
      _error: 'Error object',
      _result: 'Operation result',
      _value: 'Value to process',
      _key: 'Key identifier',
      path: 'File or URL path',
      url: 'URL string',
      filename: 'Name of the file',
      content: 'Content data'
    };

    return paramDescriptions[paramName] || `${paramName} parameter`;
  }

  /**
   * Generate contextual description for functions.
   * @param functionName - Name of the function to describe.
   * @returns Generated description string.
   */
  private generateFunctionDescription(functionName: string): string {
    // Convert camelCase to sentence
    const words = functionName.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
    
    // Common function patterns
    if (functionName.startsWith('get')) {return `Get ${words.substring(4)}`;}
    if (functionName.startsWith('set')) {return `Set ${words.substring(4)}`;}
    if (functionName.startsWith('create')) {return `Create ${words.substring(7)}`;}
    if (functionName.startsWith('update')) {return `Update ${words.substring(7)}`;}
    if (functionName.startsWith('delete')) {return `Delete ${words.substring(7)}`;}
    if (functionName.startsWith('fetch')) {return `Fetch ${words.substring(6)}`;}
    if (functionName.startsWith('load')) {return `Load ${words.substring(5)}`;}
    if (functionName.startsWith('save')) {return `Save ${words.substring(5)}`;}
    if (functionName.startsWith('validate')) {return `Validate ${words.substring(9)}`;}
    if (functionName.startsWith('parse')) {return `Parse ${words.substring(6)}`;}
    if (functionName.startsWith('format')) {return `Format ${words.substring(7)}`;}
    if (functionName.startsWith('calculate')) {return `Calculate ${words.substring(10)}`;}
    if (functionName.startsWith('generate')) {return `Generate ${words.substring(9)}`;}
    if (functionName.startsWith('transform')) {return `Transform ${words.substring(10)}`;}
    if (functionName.startsWith('handle')) {return `Handle ${words.substring(7)}`;}
    if (functionName.startsWith('process')) {return `Process ${words.substring(8)}`;}
    if (functionName.startsWith('check')) {return `Check ${words.substring(6)}`;}
    if (functionName.startsWith('verify')) {return `Verify ${words.substring(7)}`;}
    if (functionName.startsWith('find')) {return `Find ${words.substring(5)}`;}
    if (functionName.startsWith('search')) {return `Search ${words.substring(7)}`;}
    if (functionName.startsWith('filter')) {return `Filter ${words.substring(7)}`;}
    if (functionName.startsWith('sort')) {return `Sort ${words.substring(5)}`;}
    if (functionName.startsWith('map')) {return `Map ${words.substring(4)}`;}
    if (functionName.startsWith('reduce')) {return `Reduce ${words.substring(7)}`;}
    if (functionName.startsWith('build')) {return `Build ${words.substring(6)}`;}
    if (functionName.startsWith('render')) {return `Render ${words.substring(7)}`;}
    if (functionName.startsWith('init')) {return `Initialize ${words.substring(5)}`;}
    if (functionName.startsWith('setup')) {return `Setup ${words.substring(6)}`;}
    if (functionName.startsWith('cleanup')) {return `Cleanup ${words.substring(8)}`;}
    if (functionName.startsWith('reset')) {return `Reset ${words.substring(6)}`;}
    if (functionName.startsWith('clear')) {return `Clear ${words.substring(6)}`;}
    if (functionName.startsWith('add')) {return `Add ${words.substring(4)}`;}
    if (functionName.startsWith('remove')) {return `Remove ${words.substring(7)}`;}
    if (functionName.startsWith('toggle')) {return `Toggle ${words.substring(7)}`;}
    if (functionName.startsWith('enable')) {return `Enable ${words.substring(7)}`;}
    if (functionName.startsWith('disable')) {return `Disable ${words.substring(8)}`;}
    if (functionName.startsWith('start')) {return `Start ${words.substring(6)}`;}
    if (functionName.startsWith('stop')) {return `Stop ${words.substring(5)}`;}
    if (functionName.startsWith('pause')) {return `Pause ${words.substring(6)}`;}
    if (functionName.startsWith('resume')) {return `Resume ${words.substring(7)}`;}

    return `${words.charAt(0).toUpperCase() + words.slice(1)} function`;
  }

  /**
   * Generate contextual description for method names.
   * @param methodName - Name of the method to describe.
   * @returns Generated description string.
   */
  private generateMethodDescription(methodName: string): string {
    return this.generateFunctionDescription(methodName);
  }

  /**
   * Generate contextual description for return types.
   * @param returnType - The return type string.
   * @param functionName - The function name for context.
   * @returns Generated description string.
   */
  private generateReturnDescription(returnType: string, functionName: string): string {
    const cleanType = returnType.replace(/Promise<|>|\s/g, '');
    
    if (returnType.includes('Promise')) {
      if (cleanType === 'void') {return 'Promise that resolves when operation completes';}
      if (cleanType === 'boolean') {return 'Promise resolving to boolean result';}
      if (cleanType === 'string') {return 'Promise resolving to string result';}
      if (cleanType === 'number') {return 'Promise resolving to numeric result';}
      if (cleanType.includes('[]')) {return 'Promise resolving to array of results';}
      return `Promise resolving to ${cleanType}`;
    }
    
    if (returnType.includes('boolean')) {return 'Boolean result';}
    if (returnType.includes('string')) {return 'String result';}
    if (returnType.includes('number')) {return 'Numeric result';}
    if (returnType.includes('[]')) {return 'Array result';}
    if (returnType.includes('JSX.Element')) {return 'JSX element';}
    if (returnType.includes('ReactNode')) {return 'React node element';}
    if (returnType.includes('void')) {return 'No return value';}
    
    return `${returnType} result`;
  }

  /**
   * Apply JSDoc templates to a file.
   * @param filePath - Path to the file to process.
   * @returns Promise resolving to number of templates applied.
   */
  public async applyTemplates(filePath: string): Promise<number> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Determine file type
    const fileType = this.determineFileType(filePath, content);
    
    const _context: TemplateContext = {
      fileName,
      fileType,
      imports: this.extractImports(content),
      exports: this.extractExports(content)
    };

    let updatedContent = content;
    let templatesApplied = 0;

    // Apply templates in order
    for (const [_templateName, template] of this.templates.entries()) {
      const matches = Array.from(content.matchAll(template.pattern));
      
      for (const match of matches) {
        // Check if JSDoc already exists before this match
        const beforeMatch = updatedContent.substring(0, updatedContent.indexOf(match[0]));
        const lastJSDocStart = beforeMatch.lastIndexOf('/**');
        const lastJSDocEnd = beforeMatch.lastIndexOf('*/');
        
        // Skip if JSDoc already exists
        if (lastJSDocStart > lastJSDocEnd) {
          continue;
        }

        const jsdoc = template.template(match, _context);
        const matchIndex = updatedContent.indexOf(match[0]);
        
        updatedContent = updatedContent.substring(0, matchIndex) + 
                        jsdoc + 
                        updatedContent.substring(matchIndex);
        
        templatesApplied++;
      }
    }

    // Write updated content if changes were made
    if (templatesApplied > 0) {
      fs.writeFileSync(filePath, updatedContent);
    }

    return templatesApplied;
  }

  /**
   * Determine file type based on path and content.
   * @param filePath - Path to the file.
   * @param content - File content.
   * @returns File type classification.
   */
  private determineFileType(filePath: string, content: string): TemplateContext['fileType'] {
    if (filePath.includes('hooks/') || /use\w+/.test(content)) {return 'hook';}
    if (filePath.includes('components/') || content.includes('JSX.Element')) {return 'component';}
    if (filePath.includes('routes/') || filePath.includes('api/')) {return 'api';}
    if (content.includes('export interface') || content.includes('export type')) {return 'type';}
    return 'utility';
  }

  /**
   * Extract import statements from content.
   * @param content - File content to analyze.
   * @returns Array of import statements.
   */
  private extractImports(content: string): string[] {
    const importMatches = content.match(/import.*from.*['"`].*['"`];?/g);
    return importMatches || [];
  }

  /**
   * Extract export statements from content.
   * @param content - File content to analyze.
   * @returns Array of export statements.
   */
  private extractExports(content: string): string[] {
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|const|class|interface|type)\s+\w+/g);
    return exportMatches || [];
  }

  /**
   * Bulk apply templates to multiple files.
   * @param pattern - Glob pattern for files to process.
   * @param options - Processing options.
   * @param options.exclude
   * @param options.maxFiles
   * @param options.dryRun
   * @param _options
   * @param _options.exclude
   * @param _options.maxFiles
   * @param _options.dryRun
   * @returns Promise resolving to processing summary.
   */
  public async bulkApplyTemplates(
    pattern: string = '**/*.{ts,tsx}',
    _options: {
      exclude?: string[];
      maxFiles?: number;
      dryRun?: boolean;
    } = {}
  ): Promise<{
    filesProcessed: number;
    templatesApplied: number;
    skippedFiles: string[];
  }> {
    const { exclude = ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.d.ts'], maxFiles = 100, dryRun = false } = options;
    
    const files = glob.sync(pattern, {
      cwd: this.projectRoot,
      ignore: exclude
    }).slice(0, maxFiles);

    let filesProcessed = 0;
    let totalTemplatesApplied = 0;
    const skippedFiles: string[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.projectRoot, file);
        
        if (!dryRun) {
          const templatesApplied = await this.applyTemplates(filePath);
          totalTemplatesApplied += templatesApplied;
        }
        
        filesProcessed++;
      } catch (_error) {
        skippedFiles.push(file);
      }
    }

    return {
      filesProcessed,
      templatesApplied: totalTemplatesApplied,
      skippedFiles
    };
  }

  /**
   * Generate VSCode snippets for JSDoc templates.
   * @returns VSCode snippets configuration.
   */
  public generateVSCodeSnippets(): Record<string, unknown> {
    return {
      "React Component JSDoc": {
        "prefix": "jsdoc-component",
        "body": [
          "/**",
          " * $1 component.",
          " * @param props - Component props.",
          " * @param props.$2 - $3.",
          " * @returns JSX element.",
          " */"
        ],
        "description": "JSDoc template for React components"
      },
      "Function JSDoc": {
        "prefix": "jsdoc-function",
        "body": [
          "/**",
          " * $1.",
          " * @param $2 - $3.",
          " * @returns $4.",
          " */"
        ],
        "description": "JSDoc template for functions"
      },
      "API Handler JSDoc": {
        "prefix": "jsdoc-api",
        "body": [
          "/**",
          " * $1 $2 - API endpoint handler.",
          " * @param req - Express request object.",
          " * @param res - Express response object.",
          " * @returns Promise resolving to API response.",
          " */"
        ],
        "description": "JSDoc template for API handlers"
      },
      "Class Method JSDoc": {
        "prefix": "jsdoc-method",
        "body": [
          "/**",
          " * $1.",
          " * @param $2 - $3.",
          " * @returns $4.",
          " */"
        ],
        "description": "JSDoc template for class methods"
      }
    };
  }
}

// Export singleton instance
export const jsdocTemplates = new JSDocTemplateGenerator();