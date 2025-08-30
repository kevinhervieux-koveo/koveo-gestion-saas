/**
 * @file Intelligent Workflow Assistant.
 * @description Advanced workflow automation and intelligent assistance for AI agent.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';

/**
 * Workflow pattern interface defining automation rules.
 */
export interface WorkflowPattern {
  name: string;
  description: string;
  triggers: string[];
  actions: WorkflowAction[];
  conditions?: string[];
  frequency: 'once' | 'periodic' | 'onchange';
}

/**
 * Workflow action interface defining individual automation steps.
 */
export interface WorkflowAction {
  type: 'command' | 'file_operation' | 'validation' | 'notification' | 'analysis';
  description: string;
  payload: Record<string, unknown>;
  priority: number;
}

/**
 * Workflow suggestion interface for recommended automations.
 */
export interface WorkflowSuggestion {
  pattern: string;
  confidence: number;
  description: string;
  estimatedTime: number;
  benefits: string[];
  risks: string[];
}

/**
 * Project insight interface for analysis results.
 */
export interface ProjectInsight {
  category: 'architecture' | 'quality' | 'performance' | 'security' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  evidence: string[];
  recommendations: string[];
  impact: number;
}

/**
 * Intelligent Workflow Assistant for AI agent optimization.
 */
export class IntelligentWorkflowAssistant {
  private projectRoot: string;
  private workflowHistory: Map<string, Date> = new Map();
  private patterns: WorkflowPattern[] = [];

  /**
   * Initialize Intelligent Workflow Assistant.
   * @param projectRoot - The root directory of the project to assist.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.initializePatterns();
  }

  /**
   * Initialize common workflow patterns.
   */
  private initializePatterns(): void {
    this.patterns = [
      {
        name: 'pre-commit-validation',
        description: 'Run validation checks before committing code',
        triggers: ['git add', 'commit preparation'],
        frequency: 'onchange',
        actions: [
          {
            type: 'validation',
            description: 'Run TypeScript check',
            payload: { command: 'npx tsc --noEmit' },
            priority: 1,
          },
          {
            type: 'validation',
            description: 'Run linting',
            payload: { command: 'npx eslint . --max-warnings 0' },
            priority: 1,
          },
          {
            type: 'validation',
            description: 'Run organization tests',
            payload: { command: 'npx jest tests/organization --passWithNoTests' },
            priority: 2,
          },
        ],
      },
      {
        name: 'dependency-audit',
        description: 'Regular security and dependency auditing',
        triggers: ['weekly', 'package.json change'],
        frequency: 'periodic',
        actions: [
          {
            type: 'command',
            description: 'Security audit',
            payload: { command: 'npm audit --audit-level=moderate' },
            priority: 1,
          },
          {
            type: 'command',
            description: 'Check for outdated packages',
            payload: { command: 'npm outdated' },
            priority: 2,
          },
          {
            type: 'analysis',
            description: 'Analyze bundle size',
            payload: { target: 'dist/' },
            priority: 3,
          },
        ],
      },
      {
        name: 'documentation-sync',
        description: 'Keep documentation in sync with code changes',
        triggers: ['api changes', 'new features', 'schema updates'],
        frequency: 'onchange',
        actions: [
          {
            type: 'validation',
            description: 'Check documentation coverage',
            payload: { command: 'npx jest tests/organization/documentation-validation.test.ts' },
            priority: 1,
          },
          {
            type: 'file_operation',
            description: 'Update API documentation',
            payload: { pattern: 'docs/**/*.md' },
            priority: 2,
          },
        ],
      },
      {
        name: 'performance-monitoring',
        description: 'Monitor and optimize application performance',
        triggers: ['build changes', 'weekly'],
        frequency: 'periodic',
        actions: [
          {
            type: 'analysis',
            description: 'Analyze bundle size',
            payload: { target: 'dist/public' },
            priority: 1,
          },
          {
            type: 'validation',
            description: 'Check for performance anti-patterns',
            payload: { pattern: '**/*.{ts,tsx}' },
            priority: 2,
          },
        ],
      },
      {
        name: 'code-quality-enhancement',
        description: 'Continuous code quality improvement',
        triggers: ['daily', 'code changes'],
        frequency: 'periodic',
        actions: [
          {
            type: 'analysis',
            description: 'Analyze code complexity',
            payload: { tools: ['complexity-report'] },
            priority: 1,
          },
          {
            type: 'validation',
            description: 'Check for unused code',
            payload: { command: 'npx ts-unused-exports tsconfig.json' },
            priority: 2,
          },
        ],
      },
    ];
  }

  /**
   * Detect workflow patterns from current context.
   * @param currentFiles - Array of current file paths.
   * @param recentChanges - Array of recently changed file paths.
   * @returns Array of workflow suggestions based on detected patterns.
   */
  public detectWorkflowPatterns(
    currentFiles: string[],
    recentChanges: string[]
  ): WorkflowSuggestion[] {
    const suggestions: WorkflowSuggestion[] = [];

    // Analyze file patterns
    const hasTestFiles = currentFiles.some((f) => f.includes('.test.'));
    const hasComponentFiles = currentFiles.some((f) => f.includes('components/'));
    const hasSchemaChanges = recentChanges.some((f) => f.includes('schema'));
    const hasAPIChanges = recentChanges.some((f) => f.includes('routes') || f.includes('api'));

    // Test-related workflow
    if (hasComponentFiles && !hasTestFiles) {
      suggestions.push({
        pattern: 'create-missing-tests',
        confidence: 85,
        description: 'Create tests for components without test coverage',
        estimatedTime: 15,
        benefits: ['Improved test coverage', 'Better code reliability'],
        risks: ['Time investment', 'False positives in test detection'],
      });
    }

    // Documentation workflow
    if (hasAPIChanges || hasSchemaChanges) {
      suggestions.push({
        pattern: 'update-api-documentation',
        confidence: 90,
        description: 'Update API documentation for schema/route changes',
        estimatedTime: 10,
        benefits: ['Accurate documentation', 'Better developer experience'],
        risks: ['Documentation might become outdated quickly'],
      });
    }

    // Performance workflow
    const largeFiles = currentFiles.filter((f) => {
      try {
        const stats = fs.statSync(path.join(this.projectRoot, f));
        return stats.size > 50000; // Files larger than 50KB
      } catch {
        return false;
      }
    });

    if (largeFiles.length > 0) {
      suggestions.push({
        pattern: 'optimize-large-files',
        confidence: 70,
        description: 'Optimize or refactor large files for better maintainability',
        estimatedTime: 30,
        benefits: ['Better code organization', 'Improved performance'],
        risks: ['Potential breaking changes', 'Refactoring complexity'],
      });
    }

    // Security workflow
    if (recentChanges.some((f) => f.includes('auth') || f.includes('security'))) {
      suggestions.push({
        pattern: 'security-review',
        confidence: 95,
        description: 'Conduct security review for authentication/security changes',
        estimatedTime: 20,
        benefits: ['Enhanced security', 'Compliance assurance'],
        risks: ['False security alerts', 'Over-engineering'],
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Execute workflow pattern.
   * @param patternName The name of the workflow pattern to execute.
   * @param dryRun Whether to run in dry-run mode without executing actions.
   * @returns Promise resolving to execution results.
   */
  public async executeWorkflow(
    patternName: string,
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    results: Array<{ action: string; success: boolean; output: string }>;
    summary: string;
  }> {
    const pattern = this.patterns.find((p) => p.name === patternName);
    if (!pattern) {
      return {
        success: false,
        results: [],
        summary: `Workflow pattern '${patternName}' not found`,
      };
    }

    const results: Array<{ action: string; success: boolean; output: string }> = [];
    let overallSuccess = true;

    console.warn(`${dryRun ? '[DRY RUN] ' : ''}Executing workflow: ${pattern.description}`);

    for (const action of pattern.actions.sort((a, b) => a.priority - b.priority)) {
      try {
        console.warn(`${dryRun ? '[DRY RUN] ' : ''}Running: ${action.description}`);

        if (dryRun) {
          results.push({
            action: action.description,
            success: true,
            output: `[DRY RUN] Would execute: ${JSON.stringify(action.payload)}`,
          });
          continue;
        }

        let output = '';
        let success = true;

        switch (action.type) {
          case 'command':
            try {
              const command =
                action.payload && typeof action.payload === 'object' && 'command' in action.payload
                  ? (action.payload as { command: string }).command
                  : '';
              output = execSync(command, {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                stdio: 'pipe',
              });
            } catch (_error: unknown) {
              success = false;
              output = _error instanceof Error ? _error.message : 'Command failed';
            }
            break;

          case 'validation':
            try {
              const command =
                action.payload && typeof action.payload === 'object' && 'command' in action.payload
                  ? (action.payload as { command: string }).command
                  : '';
              output = execSync(command, {
                cwd: this.projectRoot,
                encoding: 'utf-8',
                stdio: 'pipe',
              });
            } catch (_error: unknown) {
              success = false;
              output =
                (_error as { stdout?: string }).stdout ||
                (_error instanceof Error ? _error.message : 'Command failed');
            }
            break;

          case 'analysis':
            output = await this.performAnalysis(action.payload);
            break;

          case 'file_operation':
            output = await this.performFileOperation(action.payload);
            break;

          default:
            output = `Unknown action type: ${action.type}`;
            success = false;
        }

        results.push({
          action: action.description,
          success,
          output: output.substring(0, 500), // Limit output length
        });

        if (!success) {
          overallSuccess = false;
        }
      } catch (_error: unknown) {
        results.push({
          action: action.description,
          success: false,
          output: _error instanceof Error ? _error.message : 'Action failed',
        });
        overallSuccess = false;
      }
    }

    // Record execution
    this.workflowHistory.set(patternName, new Date());

    const summary = `Workflow '${patternName}' ${overallSuccess ? 'completed successfully' : 'completed with errors'}. ${results.filter((r) => r.success).length}/${results.length} actions succeeded.`;

    return {
      success: overallSuccess,
      results,
      summary,
    };
  }

  /**
   * Perform analysis action.
   * @param payload The analysis payload containing target information.
   * @returns Promise resolving to analysis results string.
   */
  private async performAnalysis(payload: unknown): Promise<string> {
    if (
      payload &&
      typeof payload === 'object' &&
      'target' in payload &&
      typeof (payload as { target: string }).target === 'string'
    ) {
      // Analyze target directory/file
      const targetPath = path.join(this.projectRoot, (payload as { target: string }).target);
      if (!fs.existsSync(targetPath)) {
        return `Target not found: ${(payload as { target: string }).target}`;
      }

      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(targetPath, { recursive: true });
        const totalSize = files.reduce((size, file) => {
          try {
            const filePath = path.join(targetPath, file as string);
            return size + fs.statSync(filePath).size;
          } catch {
            return size;
          }
        }, 0);

        return `Directory analysis: ${files.length} files, ${Math.round(totalSize / 1024)}KB total`;
      } else {
        return `File analysis: ${Math.round(stats.size / 1024)}KB`;
      }
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'tools' in payload &&
      Array.isArray((payload as { tools: string[] }).tools)
    ) {
      // Run analysis tools
      const results: string[] = [];
      for (const tool of (payload as { tools: string[] }).tools) {
        try {
          const _output = execSync(`npx ${tool}`, {
            cwd: this.projectRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          results.push(`${tool}: Success`);
        } catch (_error: unknown) {
          results.push(
            `${tool}: ${_error instanceof Error ? _error.message.substring(0, 100) : 'Tool failed'}`
          );
        }
      }
      return results.join('; ');
    }

    return 'Analysis completed';
  }

  /**
   * Perform file operation.
   * @param payload - Operation configuration and parameters.
   * @returns Promise resolving to operation result message.
   */
  private async performFileOperation(payload: unknown): Promise<string> {
    if (
      payload &&
      typeof payload === 'object' &&
      'pattern' in payload &&
      typeof (payload as { pattern: string }).pattern === 'string'
    ) {
      const files = glob.sync((payload as { pattern: string }).pattern, {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**'],
      });

      return `Found ${files.length} files matching pattern: ${(payload as { pattern: string }).pattern}`;
    }

    return 'File operation completed';
  }

  /**
   * Generate project insights using AI-powered analysis.
   * @returns Promise resolving to array of project insights.
   */
  public async generateProjectInsights(): Promise<ProjectInsight[]> {
    const insights: ProjectInsight[] = [];

    // Architecture insights
    const componentFiles = glob.sync('client/src/components/**/*.tsx', {
      cwd: this.projectRoot,
    });

    const pageFiles = glob.sync('client/src/pages/**/*.tsx', {
      cwd: this.projectRoot,
    });

    if (componentFiles.length > pageFiles.length * 3) {
      insights.push({
        category: 'architecture',
        severity: 'info',
        title: 'Component-Heavy Architecture',
        description: 'High component-to-page ratio suggests good code reusability',
        evidence: [`${componentFiles.length} components vs ${pageFiles.length} pages`],
        recommendations: [
          'Continue componentization approach',
          'Consider component library documentation',
        ],
        impact: 20,
      });
    }

    // Quality insights
    try {
      const _tscOutput = execSync('npx tsc --noEmit --skipLibCheck', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (_error: unknown) {
      const errors = ((_error as { stdout?: string }).stdout || '').match(/error TS\d+:/g) || [];
      if (errors.length > 0) {
        insights.push({
          category: 'quality',
          severity: errors.length > 10 ? 'error' : 'warning',
          title: 'TypeScript Errors Detected',
          description: `${errors.length} TypeScript errors found in codebase`,
          evidence: [`${errors.length} TypeScript compilation errors`],
          recommendations: [
            'Fix TypeScript errors for better type safety',
            'Consider stricter TypeScript configuration',
          ],
          impact: errors.length * 5,
        });
      }
    }

    // Performance insights
    const distPath = path.join(this.projectRoot, 'dist');
    if (fs.existsSync(distPath)) {
      try {
        const files = fs.readdirSync(distPath, { recursive: true });
        let totalSize = 0;
        files.forEach((file) => {
          try {
            const filePath = path.join(distPath, file as string);
            totalSize += fs.statSync(filePath).size;
          } catch (_error) {
            // Error handled silently
          }
        });

        const sizeMB = totalSize / (1024 * 1024);
        if (sizeMB > 5) {
          insights.push({
            category: 'performance',
            severity: sizeMB > 10 ? 'warning' : 'info',
            title: 'Large Bundle Size',
            description: `Build output is ${sizeMB.toFixed(1)}MB`,
            evidence: [`Total bundle size: ${sizeMB.toFixed(1)}MB`],
            recommendations: [
              'Analyze bundle composition',
              'Consider code splitting',
              'Optimize large dependencies',
            ],
            impact: Math.round(sizeMB * 10),
          });
        }
      } catch (_error) {
        // Error handled silently
      }
    }

    // Security insights
    try {
      const auditOutput = execSync('npm audit --json', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const auditResult = JSON.parse(auditOutput);
      const highSeverity = auditResult.metadata?.vulnerabilities?.high || 0;
      const critical = auditResult.metadata?.vulnerabilities?.critical || 0;

      if (highSeverity > 0 || critical > 0) {
        insights.push({
          category: 'security',
          severity: critical > 0 ? 'critical' : 'error',
          title: 'Security Vulnerabilities Found',
          description: `${critical} critical and ${highSeverity} high severity vulnerabilities`,
          evidence: [`npm audit found ${critical + highSeverity} high-risk vulnerabilities`],
          recommendations: [
            'Run npm audit fix',
            'Update vulnerable dependencies',
            'Review security policies',
          ],
          impact: critical * 50 + highSeverity * 20,
        });
      }
    } catch (_error) {
      // Error handled silently
    }

    // Maintenance insights
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf-8')
    );
    const depCount =
      Object.keys(packageJson.dependencies || {}).length +
      Object.keys(packageJson.devDependencies || {}).length;

    if (depCount > 100) {
      insights.push({
        category: 'maintenance',
        severity: 'warning',
        title: 'High Dependency Count',
        description: `Project has ${depCount} dependencies`,
        evidence: [`${depCount} total dependencies in package.json`],
        recommendations: [
          'Audit unused dependencies',
          'Consider dependency consolidation',
          'Regular dependency updates',
        ],
        impact: Math.round(depCount / 10),
      });
    }

    return insights.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Smart workflow recommendation engine.
   * @param _context Context information for recommendations.
   * @param _context.recentFiles Array of recently modified files.
   * @param _context.userIntent User's stated intent or goal.
   * @param _context.projectPhase Current phase of the project.
   * @returns Promise resolving to categorized workflow suggestions.
   */
  public async recommendWorkflows(
    _context: {
      recentFiles?: string[];
      userIntent?: string;
      projectPhase?: string;
    } = {}
  ): Promise<{
    immediate: WorkflowSuggestion[];
    scheduled: WorkflowSuggestion[];
    optional: WorkflowSuggestion[];
  }> {
    const allSuggestions = this.detectWorkflowPatterns(
      _context.recentFiles || [],
      _context.recentFiles || []
    );

    // Add context-aware suggestions
    if (_context.userIntent?.toLowerCase().includes('deploy')) {
      allSuggestions.push({
        pattern: 'pre-deployment-checklist',
        confidence: 95,
        description: 'Run comprehensive pre-deployment validation',
        estimatedTime: 25,
        benefits: ['Reduced deployment issues', 'Better reliability'],
        risks: ['Deployment delays', 'False positives'],
      });
    }

    if (_context.projectPhase === 'development') {
      allSuggestions.push({
        pattern: 'development-quality-check',
        confidence: 80,
        description: 'Regular development quality validation',
        estimatedTime: 10,
        benefits: ['Early issue detection', 'Better code quality'],
        risks: ['Development slowdown'],
      });
    }

    return {
      immediate: allSuggestions.filter((s) => s.confidence >= 90),
      scheduled: allSuggestions.filter((s) => s.confidence >= 70 && s.confidence < 90),
      optional: allSuggestions.filter((s) => s.confidence < 70),
    };
  }

  /**
   * Generate workflow execution report.
   * @returns JSON string containing workflow execution report.
   */
  public generateWorkflowReport(): string {
    const report = {
      executedWorkflows: Array.from(this.workflowHistory.entries()).map(([name, date]) => ({
        name,
        lastExecuted: date.toISOString(),
        daysSince: Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      availablePatterns: this.patterns.map((p) => ({
        name: p.name,
        description: p.description,
        frequency: p.frequency,
      })),
    };

    return JSON.stringify(report, null, 2);
  }
}

// Export singleton instance
export const workflowAssistant = new IntelligentWorkflowAssistant();
