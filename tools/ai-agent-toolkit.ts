/**
 * @file AI Agent Toolkit.
 * @description Enhanced tooling for Replit AI agent development and workflow optimization.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';

/**
 * Agent context interface for project state tracking.
 */
export interface AgentContext {
  projectRoot: string;
  currentBranch: string;
  lastCommit: string;
  workingFiles: string[];
  activeFeatures: string[];
  pendingTasks: string[];
}

/**
 * Code analysis interface for quality metrics.
 */
export interface CodeAnalysis {
  complexity: number;
  maintainability: number;
  testCoverage: number;
  typeScriptErrors: number;
  lintWarnings: number;
  suggestions: string[];
}

/**
 * Project health interface for comprehensive assessment.
 */
export interface ProjectHealth {
  overallScore: number;
  codeQuality: number;
  documentation: number;
  testing: number;
  security: number;
  performance: number;
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    file?: string;
    line?: number;
    solution?: string;
  }>;
}

/**
 * AI Agent Toolkit for enhanced development workflow.
 */
export class AIAgentToolkit {
  private projectRoot: string;
  private _context: AgentContext;

  /**
   * Initialize AI Agent Toolkit.
   * @param projectRoot - The root directory of the project to analyze.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.context = this.loadContext();
  }

  /**
   * Load current project context.
   */
  private loadContext(): AgentContext {
    const gitBranch = this.getGitBranch();
    const lastCommit = this.getLastCommit();
    const workingFiles = this.getWorkingFiles();
    
    return {
      projectRoot: this.projectRoot,
      currentBranch: gitBranch,
      lastCommit,
      workingFiles,
      activeFeatures: this.getActiveFeatures(),
      pendingTasks: this.getPendingTasks()
    };
  }

  /**
   * Get current git branch.
   */
  private getGitBranch(): string {
    try {
      return execSync('git branch --show-current', { 
        encoding: 'utf-8', 
        cwd: this.projectRoot 
      }).trim();
    } catch {
      return 'main';
    }
  }

  /**
   * Get last commit hash.
   */
  private getLastCommit(): string {
    try {
      return execSync('git rev-parse HEAD', { 
        encoding: 'utf-8', 
        cwd: this.projectRoot 
      }).trim().substring(0, 8);
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get currently modified files.
   */
  private getWorkingFiles(): string[] {
    try {
      const output = execSync('git status --porcelain', { 
        encoding: 'utf-8', 
        cwd: this.projectRoot 
      });
      return output.split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3).trim());
    } catch {
      return [];
    }
  }

  /**
   * Extract active features from ROADMAP and issues.
   */
  private getActiveFeatures(): string[] {
    const features: string[] = [];
    
    // Check ROADMAP.md
    const roadmapPath = path.join(this.projectRoot, 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      const content = fs.readFileSync(roadmapPath, 'utf-8');
      const inProgressMatch = content.match(/## In Progress\s*\n([\s\S]*?)(?=\n##|$)/i);
      if (inProgressMatch) {
        const items = inProgressMatch[1].match(/- \[.\] (.+)/g) || [];
        features.push(...items.map(item => item.replace(/- \[.\] /, '')));
      }
    }

    return features;
  }

  /**
   * Extract pending tasks from TODO comments and issues.
   */
  private getPendingTasks(): string[] {
    const tasks: string[] = [];
    
    try {
      const files = glob.sync('**/*.{ts,tsx,js,jsx,md}', {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'coverage/**']
      });

      files.forEach(file => {
        const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf-8');
        const todoMatches = content.match(/TODO:?\s*(.+)/gi) || [];
        tasks.push(...todoMatches.map(match => 
          `${file}: ${match.replace(/TODO:?\s*/i, '')}`
        ));
      });
    } catch (_error) {
      console.warn('Error scanning for TODOs:', _error);
    }

    return tasks;
  }

  /**
   * Analyze code quality and complexity.
   */
  public async analyzeCode(): Promise<CodeAnalysis> {
    const analysis: CodeAnalysis = {
      complexity: 0,
      maintainability: 0,
      testCoverage: 0,
      typeScriptErrors: 0,
      lintWarnings: 0,
      suggestions: []
    };

    try {
      // TypeScript errors
      const tscOutput = execSync('npx tsc --noEmit --skipLibCheck', { 
        encoding: 'utf-8', 
        cwd: this.projectRoot 
      });
      analysis.typeScriptErrors = (tscOutput.match(/error TS\d+:/g) || []).length;
    } catch (_error: unknown) {
      const errorOutput = (_error as any).stdout || (_error as any).message;
      analysis.typeScriptErrors = (errorOutput.match(/error TS\d+:/g) || []).length;
    }

    try {
      // Lint warnings
      const lintOutput = execSync('npx eslint . --format json', { 
        encoding: 'utf-8', 
        cwd: this.projectRoot 
      });
      const lintResults = JSON.parse(lintOutput);
      analysis.lintWarnings = lintResults.reduce((total: number, file: any) => 
        total + (file.warningCount || 0) + (file.errorCount || 0), 0);
    } catch (_error: unknown) {
      try {
        const errorOutput = (_error as any).stdout || '';
        if (errorOutput) {
          const lintResults = JSON.parse(errorOutput);
          analysis.lintWarnings = lintResults.reduce((total: number, file: any) => 
            total + (file.warningCount || 0) + (file.errorCount || 0), 0);
        }
      } catch {
        analysis.lintWarnings = 0;
      }
    }

    // Calculate complexity based on file count and structure
    const sourceFiles = glob.sync('**/*.{ts,tsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', '**/*.test.*']
    });

    analysis.complexity = Math.min(100, sourceFiles.length * 2);
    analysis.maintainability = Math.max(0, 100 - analysis.typeScriptErrors - analysis.lintWarnings);

    // Test coverage (if available)
    const coveragePath = path.join(this.projectRoot, 'coverage', 'lcov-report', 'index.html');
    if (fs.existsSync(coveragePath)) {
      try {
        const coverageContent = fs.readFileSync(coveragePath, 'utf-8');
        const coverageMatch = coverageContent.match(/(\d+(?:\.\d+)?)%/);
        if (coverageMatch) {
          analysis.testCoverage = parseFloat(coverageMatch[1]);
        }
      } catch {
        analysis.testCoverage = 0;
      }
    }

    // Generate suggestions
    if (analysis.typeScriptErrors > 0) {
      analysis.suggestions.push(`Fix ${analysis.typeScriptErrors} TypeScript errors`);
    }
    if (analysis.lintWarnings > 10) {
      analysis.suggestions.push(`Address ${analysis.lintWarnings} linting issues`);
    }
    if (analysis.testCoverage < 70) {
      analysis.suggestions.push('Improve test coverage (currently ' + analysis.testCoverage + '%)');
    }

    return analysis;
  }

  /**
   * Get overall project health score.
   */
  public async getProjectHealth(): Promise<ProjectHealth> {
    const codeAnalysis = await this.analyzeCode();
    
    const health: ProjectHealth = {
      overallScore: 0,
      codeQuality: Math.max(0, 100 - codeAnalysis.typeScriptErrors * 5 - codeAnalysis.lintWarnings),
      documentation: await this.calculateDocumentationScore(),
      testing: codeAnalysis.testCoverage,
      security: await this.calculateSecurityScore(),
      performance: await this.calculatePerformanceScore(),
      issues: []
    };

    // Calculate overall score
    health.overallScore = Math.round(
      (health.codeQuality + health.documentation + health.testing + health.security + health.performance) / 5
    );

    // Generate issues
    if (health.codeQuality < 70) {
      health.issues.push({
        severity: 'high',
        category: 'Code Quality',
        description: 'Code quality score is below acceptable threshold',
        solution: 'Fix TypeScript errors and lint warnings'
      });
    }

    if (health.testing < 60) {
      health.issues.push({
        severity: 'medium',
        category: 'Testing',
        description: 'Test coverage is insufficient',
        solution: 'Add more unit and integration tests'
      });
    }

    if (health.documentation < 50) {
      health.issues.push({
        severity: 'medium',
        category: 'Documentation',
        description: 'Documentation coverage is low',
        solution: 'Add more documentation and improve existing docs'
      });
    }

    return health;
  }

  /**
   * Calculate documentation score.
   */
  private async calculateDocumentationScore(): Promise<number> {
    const mdFiles = glob.sync('**/*.md', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**']
    });

    const sourceFiles = glob.sync('**/*.{ts,tsx}', {
      cwd: this.projectRoot,
      ignore: ['node_modules/**', 'dist/**', '**/*.test.*']
    });

    if (sourceFiles.length === 0) {return 100;}

    let documentedFiles = 0;
    sourceFiles.forEach(file => {
      const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf-8');
      if (content.includes('/**') || content.includes('//')) {
        documentedFiles++;
      }
    });

    const docRatio = documentedFiles / sourceFiles.length;
    const mdFileBonus = Math.min(mdFiles.length * 10, 30);
    
    return Math.min(100, docRatio * 70 + mdFileBonus);
  }

  /**
   * Calculate security score.
   */
  private async calculateSecurityScore(): Promise<number> {
    let score = 100;
    const issues: string[] = [];

    try {
      // Check for common security issues
      const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**']
      });

      files.forEach(file => {
        const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf-8');
        
        // Check for hardcoded secrets
        if (/api[_-]?key\s*=\s*["'][^"']+["']/i.test(content)) {
          score -= 20;
          issues.push(`Potential hardcoded API key in ${file}`);
        }

        // Check for eval usage
        if (/\beval\s*\(/i.test(content)) {
          score -= 15;
          issues.push(`Dangerous eval() usage in ${file}`);
        }

        // Check for innerHTML usage
        if (/\.innerHTML\s*=/i.test(content)) {
          score -= 10;
          issues.push(`Potential XSS vulnerability in ${file}`);
        }
      });

      // Check for package vulnerabilities
      try {
        execSync('npm audit --audit-level=high --json', { 
          cwd: this.projectRoot,
          stdio: 'pipe'
        });
      } catch (_error: unknown) {
        try {
          // Use child_process result instead of eval-like parsing
          const auditOutput = execSync('npm audit --audit-level=high --json', { 
            cwd: this.projectRoot,
            encoding: 'utf-8'
          });
          const auditResult = JSON.parse(auditOutput);
          const vulnCount = auditResult.metadata?.vulnerabilities?.total || 0;
          score -= Math.min(vulnCount * 5, 30);
        } catch {
          score -= 5; // Penalty for audit failure
        }
      }

    } catch (_error) {
      score -= 5; // Penalty for security check failure
    }

    return Math.max(0, score);
  }

  /**
   * Calculate performance score.
   */
  private async calculatePerformanceScore(): Promise<number> {
    let score = 100;

    try {
      // Check bundle size if build exists
      const distPath = path.join(this.projectRoot, 'dist');
      if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath, { recursive: true });
        let totalSize = 0;
        
        files.forEach(file => {
          const filePath = path.join(distPath, file as string);
          if (fs.statSync(filePath).isFile()) {
            totalSize += fs.statSync(filePath).size;
          }
        });

        const sizeMB = totalSize / (1024 * 1024);
        if (sizeMB > 10) {score -= 20;}
        else if (sizeMB > 5) {score -= 10;}
      }

      // Check for performance anti-patterns
      const files = glob.sync('**/*.{ts,tsx}', {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**', '**/*.test.*']
      });

      files.forEach(file => {
        const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf-8');
        
        // Check for console statements in production code
        if (/console\.log/g.test(content) && !file.includes('test')) {
          score -= 2;
        }

        // Check for inefficient loops
        if (/for.*in.*for.*in/g.test(content)) {
          score -= 5;
        }
      });

    } catch (_error) {
      score -= 5; // Penalty for performance check failure
    }

    return Math.max(0, score);
  }

  /**
   * Generate AI agent development suggestions.
   */
  public generateAgentSuggestions(): string[] {
    const suggestions: string[] = [];

    // Context-aware suggestions
    if (this.context.workingFiles.length > 5) {
      suggestions.push('Consider breaking down large changes into smaller commits');
    }

    if (this.context.pendingTasks.length > 10) {
      suggestions.push('High number of TODOs detected - prioritize task completion');
    }

    if (this.context.activeFeatures.length > 3) {
      suggestions.push('Multiple active features - consider focusing on fewer items');
    }

    // Tool-specific suggestions
    suggestions.push('Run organization validation tests before major changes');
    suggestions.push('Use the project health check to identify improvement areas');
    suggestions.push('Update documentation when adding new features');
    suggestions.push('Run security audit regularly');

    return suggestions;
  }

  /**
   * Export current context and analysis.
   */
  public async exportAnalysis(): Promise<string> {
    const health = await this.getProjectHealth();
    const codeAnalysis = await this.analyzeCode();
    const suggestions = this.generateAgentSuggestions();

    const report = {
      timestamp: new Date().toISOString(),
      _context: this.context,
      health,
      codeAnalysis,
      suggestions
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Quick health check for AI agent.
   */
  public async quickHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    topIssues: string[];
  }> {
    const health = await this.getProjectHealth();
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (health.overallScore < 70) {status = 'warning';}
    if (health.overallScore < 50) {status = 'critical';}

    const topIssues = health.issues
      .filter(issue => issue.severity === 'high' || issue.severity === 'critical')
      .map(issue => issue.description)
      .slice(0, 3);

    return {
      status,
      score: health.overallScore,
      topIssues
    };
  }
}

// Export singleton instance
export const agentToolkit = new AIAgentToolkit();