/**
 * @file Smart Context Manager.
 * @description Intelligent context management for AI agent workflow optimization.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 *
 */
export interface FileContext {
  path: string;
  type: 'component' | 'page' | 'utility' | 'config' | 'test' | 'documentation';
  lastModified: Date;
  size: number;
  dependencies: string[];
  exports: string[];
  imports: string[];
  complexity: number;
  importance: number;
}

/**
 *
 */
export interface WorkspaceContext {
  recentFiles: FileContext[];
  relatedFiles: FileContext[];
  suggestedFiles: FileContext[];
  workingSet: string[];
  focusArea: string;
}

/**
 *
 */
export interface ContextSuggestion {
  type: 'file' | 'directory' | 'pattern' | 'feature';
  description: string;
  relevance: number;
  action: string;
  files?: string[];
}

/**
 * Smart Context Manager for AI agent workflow optimization.
 */
export class SmartContextManager {
  private projectRoot: string;
  private fileCache: Map<string, FileContext> = new Map();
  private workspaceContext: WorkspaceContext;

  /**
   *
   * @param projectRoot
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.workspaceContext = this.initializeContext();
  }

  /**
   * Initialize workspace context.
   */
  private initializeContext(): WorkspaceContext {
    return {
      recentFiles: [],
      relatedFiles: [],
      suggestedFiles: [],
      workingSet: [],
      focusArea: 'general'
    };
  }

  /**
   * Analyze file and extract context information.
   * @param filePath
   */
  private analyzeFile(filePath: string): FileContext {
    const fullPath = path.join(this.projectRoot, filePath);
    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    const context: FileContext = {
      path: filePath,
      type: this.determineFileType(filePath, content),
      lastModified: stats.mtime,
      size: stats.size,
      dependencies: this.extractDependencies(content),
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      complexity: this.calculateComplexity(content),
      importance: this.calculateImportance(filePath, content)
    };

    this.fileCache.set(filePath, context);
    return context;
  }

  /**
   * Determine file type based on path and content.
   * @param filePath
   * @param content
   */
  private determineFileType(filePath: string, content: string): FileContext['type'] {
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {return 'test';}
    if (filePath.endsWith('.md') || filePath.includes('docs/')) {return 'documentation';}
    if (filePath.includes('config') || filePath.includes('.config.')) {return 'config';}
    if (filePath.includes('pages/') || filePath.includes('app/')) {return 'page';}
    if (filePath.includes('components/')) {return 'component';}
    if (filePath.includes('lib/') || filePath.includes('utils/')) {return 'utility';}
    
    // Analyze content for more specific typing
    if (content.includes('export default function') || content.includes('export const')) {
      if (content.includes('return <') || content.includes('jsx')) {return 'component';}
      return 'utility';
    }
    
    return 'utility';
  }

  /**
   * Extract file dependencies.
   * @param content
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      if (!match[1].startsWith('.')) {
        dependencies.push(match[1]);
      }
    }

    return [...new Set(dependencies)];
  }

  /**
   * Extract exports from file.
   * @param content
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Named exports
    const namedExportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Default export
    if (/export\s+default/g.test(content)) {
      exports.push('default');
    }

    // Export destructuring
    const destructureRegex = /export\s+\{\s*([^}]+)\s*\}/g;
    while ((match = destructureRegex.exec(content)) !== null) {
      const items = match[1].split(',').map(item => item.trim());
      exports.push(...items);
    }

    return [...new Set(exports)];
  }

  /**
   * Extract imports from file.
   * @param content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+\{([^}]+)\}\s+from/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const items = match[1].split(',').map(item => item.trim());
      imports.push(...items);
    }

    // Default imports
    const defaultImportRegex = /import\s+(\w+)\s+from/g;
    while ((match = defaultImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return [...new Set(imports)];
  }

  /**
   * Calculate file complexity score.
   * @param content
   */
  private calculateComplexity(content: string): number {
    let complexity = 0;
    
    // Count functions
    complexity += (content.match(/function\s+\w+/g) || []).length * 2;
    complexity += (content.match(/const\s+\w+\s*=/g) || []).length;
    
    // Count control structures
    complexity += (content.match(/if\s*\(/g) || []).length;
    complexity += (content.match(/for\s*\(/g) || []).length;
    complexity += (content.match(/while\s*\(/g) || []).length;
    complexity += (content.match(/switch\s*\(/g) || []).length;
    
    // Count classes and interfaces
    complexity += (content.match(/class\s+\w+/g) || []).length * 3;
    complexity += (content.match(/interface\s+\w+/g) || []).length;
    
    return complexity;
  }

  /**
   * Calculate file importance score.
   * @param filePath
   * @param content
   */
  private calculateImportance(filePath: string, content: string): number {
    let importance = 0;
    
    // Base importance by type
    if (filePath.includes('index.')) {importance += 20;}
    if (filePath.includes('app.') || filePath.includes('main.')) {importance += 30;}
    if (filePath.includes('config')) {importance += 15;}
    if (filePath.includes('schema')) {importance += 25;}
    if (filePath.includes('route')) {importance += 20;}
    
    // Content-based importance
    if (content.includes('export default')) {importance += 10;}
    importance += this.extractExports(content).length * 2;
    
    // Size penalty for very large files
    if (content.length > 10000) {importance -= 5;}
    if (content.length > 20000) {importance -= 10;}
    
    return Math.max(0, importance);
  }

  /**
   * Get files related to current working set.
   * @param targetFiles
   */
  public getRelatedFiles(targetFiles: string[]): FileContext[] {
    const related: Map<string, FileContext> = new Map();
    
    targetFiles.forEach(filePath => {
      const context = this.getFileContext(filePath);
      if (!context) {return;}
      
      // Find files that import from or export to this file
      const allFiles = this.getAllFileContexts();
      
      allFiles.forEach(fileContext => {
        if (fileContext.path === filePath) {return;}
        
        // Check imports/exports relationship
        const hasRelation = 
          fileContext.imports.some(imp => context.exports.includes(imp)) ||
          context.imports.some(imp => fileContext.exports.includes(imp)) ||
          this.sharesDependencies(context, fileContext);
        
        if (hasRelation) {
          related.set(fileContext.path, fileContext);
        }
      });
    });
    
    return Array.from(related.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);
  }

  /**
   * Check if two files share dependencies.
   * @param file1
   * @param file2
   */
  private sharesDependencies(file1: FileContext, file2: FileContext): boolean {
    const shared = file1.dependencies.filter(dep => file2.dependencies.includes(dep));
    return shared.length >= 2; // At least 2 shared dependencies
  }

  /**
   * Get file context (cached or analyze).
   * @param filePath
   */
  public getFileContext(filePath: string): FileContext | null {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }
    
    const fullPath = path.join(this.projectRoot, filePath);
    if (!fs.existsSync(fullPath)) {return null;}
    
    return this.analyzeFile(filePath);
  }

  /**
   * Get all file contexts.
   */
  private getAllFileContexts(): FileContext[] {
    const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', 'coverage/**']
    });
    
    return files.map(file => this.getFileContext(file)).filter(Boolean) as FileContext[];
  }

  /**
   * Suggest files to work on based on current context.
   * @param currentFiles
   * @param intent
   */
  public suggestNextFiles(currentFiles: string[], intent: string = ''): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];
    
    if (currentFiles.length === 0) {
      // Starting point suggestions
      suggestions.push({
        type: 'file',
        description: 'Start with the main application entry point',
        relevance: 90,
        action: 'review',
        files: ['server/index.ts', 'client/src/main.tsx', 'client/src/App.tsx']
      });
      
      suggestions.push({
        type: 'directory',
        description: 'Review shared schemas and types',
        relevance: 85,
        action: 'analyze',
        files: ['shared/schema.ts']
      });
    } else {
      // Context-based suggestions
      const relatedFiles = this.getRelatedFiles(currentFiles);
      
      if (relatedFiles.length > 0) {
        suggestions.push({
          type: 'file',
          description: 'Review related files for context',
          relevance: 80,
          action: 'review',
          files: relatedFiles.slice(0, 3).map(f => f.path)
        });
      }
      
      // Intent-based suggestions
      if (intent.toLowerCase().includes('test')) {
        const testFiles = this.findTestFiles(currentFiles);
        if (testFiles.length > 0) {
          suggestions.push({
            type: 'file',
            description: 'Review or create tests for current files',
            relevance: 85,
            action: 'test',
            files: testFiles
          });
        }
      }
      
      if (intent.toLowerCase().includes('document')) {
        suggestions.push({
          type: 'file',
          description: 'Update or create documentation',
          relevance: 75,
          action: 'document',
          files: ['README.md', 'docs/']
        });
      }
    }
    
    // High-importance files suggestions
    const allFiles = this.getAllFileContexts();
    const highImportanceFiles = allFiles
      .filter(f => f.importance > 25 && !currentFiles.includes(f.path))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3);
    
    if (highImportanceFiles.length > 0) {
      suggestions.push({
        type: 'file',
        description: 'Review high-importance files',
        relevance: 70,
        action: 'review',
        files: highImportanceFiles.map(f => f.path)
      });
    }
    
    return suggestions.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Find test files for given source files.
   * @param sourceFiles
   */
  private findTestFiles(sourceFiles: string[]): string[] {
    const testFiles: string[] = [];
    
    sourceFiles.forEach(file => {
      const baseName = file.replace(/\.(ts|tsx|js|jsx)$/, '');
      const dir = path.dirname(file);
      
      // Look for co-located tests
      const testPatterns = [
        `${baseName}.test.ts`,
        `${baseName}.test.tsx`,
        `${baseName}.spec.ts`,
        `${baseName}.spec.tsx`,
        `tests/${file.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts')}`,
        `tests/unit/${path.basename(baseName)}.test.ts`
      ];
      
      testPatterns.forEach(pattern => {
        const fullPath = path.join(this.projectRoot, pattern);
        if (fs.existsSync(fullPath)) {
          testFiles.push(pattern);
        }
      });
    });
    
    return testFiles;
  }

  /**
   * Update workspace context with new files.
   * @param files
   * @param focusArea
   */
  public updateWorkingSet(files: string[], focusArea?: string): void {
    this.workspaceContext.workingSet = [...new Set([...this.workspaceContext.workingSet, ...files])];
    
    if (focusArea) {
      this.workspaceContext.focusArea = focusArea;
    }
    
    // Update recent files
    const fileContexts = files.map(f => this.getFileContext(f)).filter(Boolean) as FileContext[];
    this.workspaceContext.recentFiles = [
      ...fileContexts,
      ...this.workspaceContext.recentFiles.filter(f => !files.includes(f.path))
    ].slice(0, 10);
    
    // Update related files
    this.workspaceContext.relatedFiles = this.getRelatedFiles(this.workspaceContext.workingSet);
  }

  /**
   * Get smart file recommendations for AI agent.
   * @param intent
   * @param context
   */
  public getSmartRecommendations(intent: string = '', context: string = ''): {
    priority: ContextSuggestion[];
    exploratory: ContextSuggestion[];
    maintenance: ContextSuggestion[];
  } {
    const allSuggestions = this.suggestNextFiles(this.workspaceContext.workingSet, intent);
    
    return {
      priority: allSuggestions.filter(s => s.relevance >= 80),
      exploratory: allSuggestions.filter(s => s.relevance >= 60 && s.relevance < 80),
      maintenance: allSuggestions.filter(s => s.relevance < 60)
    };
  }

  /**
   * Generate context summary for AI agent.
   */
  public generateContextSummary(): string {
    const summary = {
      workingSet: this.workspaceContext.workingSet.length,
      focusArea: this.workspaceContext.focusArea,
      recentFiles: this.workspaceContext.recentFiles.slice(0, 5).map(f => ({
        path: f.path,
        type: f.type,
        importance: f.importance
      })),
      topRecommendations: this.getSmartRecommendations().priority.slice(0, 3)
    };
    
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Clear context cache.
   */
  public clearCache(): void {
    this.fileCache.clear();
    this.workspaceContext = this.initializeContext();
  }
}

// Export singleton instance
export const contextManager = new SmartContextManager();