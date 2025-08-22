import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

/**
 * Real-time development session data.
 */
export interface DevSession {
  id: string;
  startTime: Date;
  currentTask: string;
  progressStages: Array<{
    stage: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    metrics?: any;
  }>;
  files: {
    modified: string[];
    created: string[];
    deleted: string[];
  };
  testResults: {
    passed: number;
    failed: number;
    coverage: number;
  };
  lintResults: {
    errors: number;
    warnings: number;
    fixedIssues: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    buildTime: number;
    hotReloadTime: number;
  };
}

/**
 * AI Agent task execution result.
 */
export interface TaskResult {
  success: boolean;
  message: string;
  data?: any;
  duration: number;
  metrics?: {
    linesChanged: number;
    testsRun: number;
    issuesFixed: number;
    performanceImpact: number;
  };
}

/**
 * Enhanced AI Agent Orchestrator for Replit integration.
 * Provides real-time monitoring, intelligent task routing, and comprehensive development assistance.
 */
export class EnhancedAgentOrchestrator extends EventEmitter {
  private projectRoot: string;
  private currentSession: DevSession;
  private wsServer: WebSocketServer | null = null;
  private activeConnections: Set<WebSocket> = new Set();
  private taskQueue: Array<{ id: string; task: string; priority: number; context?: any }> = [];
  private isProcessing: boolean = false;

  /**
   *
   * @param projectRoot
   */
  constructor(projectRoot: string = process.cwd()) {
    super();
    this.projectRoot = projectRoot;
    this.currentSession = this.initializeSession();
    this.setupRealtimeMonitoring();
    this.startPerformanceTracking();
  }

  /**
   * Initialize a new development session.
   */
  private initializeSession(): DevSession {
    return {
      id: `session_${Date.now()}`,
      startTime: new Date(),
      currentTask: 'idle',
      progressStages: [],
      files: {
        modified: [],
        created: [],
        deleted: []
      },
      testResults: {
        passed: 0,
        failed: 0,
        coverage: 0
      },
      lintResults: {
        errors: 0,
        warnings: 0,
        fixedIssues: 0
      },
      performance: {
        memoryUsage: 0,
        cpuUsage: 0,
        buildTime: 0,
        hotReloadTime: 0
      }
    };
  }

  /**
   * Setup real-time monitoring with WebSocket server.
   */
  private setupRealtimeMonitoring(): void {
    // Create WebSocket server for real-time updates
    this.wsServer = new WebSocketServer({ port: 8080 });
    
    this.wsServer.on('connection', (ws) => {
      this.activeConnections.add(ws);
      
      // Send current session state immediately
      this.broadcastUpdate('session_state', this.currentSession);
      
      ws.on('close', () => {
        this.activeConnections.delete(ws);
      });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(data, ws);
        } catch (__error) {
          console.error('WebSocket message parse error:', __error);
        }
      });
    });

    console.log('🔗 Real-time monitoring server started on ws://localhost:8080');
  }

  /**
   * Handle incoming WebSocket messages for interactive control.
   * @param data
   * @param ws
   */
  private handleWebSocketMessage(data: any, ws: WebSocket): void {
    switch (data.type) {
      case 'request_health_check':
        this.performHealthCheck().then(result => {
          ws.send(JSON.stringify({ type: 'health_check_result', data: result }));
        });
        break;
      
      case 'request_task_execution':
        this.queueTask(data.task, data.priority || 1, data.context);
        break;
      
      case 'request_session_reset':
        this.resetSession();
        this.broadcastUpdate('session_reset', this.currentSession);
        break;
    }
  }

  /**
   * Broadcast updates to all connected clients.
   * @param type
   * @param data
   */
  private broadcastUpdate(type: string, data: unknown): void {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    
    this.activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Start continuous performance tracking.
   */
  private startPerformanceTracking(): void {
    setInterval(() => {
      this.updatePerformanceMetrics();
      this.broadcastUpdate('performance_update', this.currentSession.performance);
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update performance metrics.
   */
  private updatePerformanceMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      this.currentSession.performance.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Get CPU usage (simplified)
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        this.currentSession.performance.cpuUsage = Math.round(
          (endUsage.user + endUsage.system) / 10000
        );
      }, 100);
    } catch (__error) {
      console.warn('Performance tracking error:', __error);
    }
  }

  /**
   * Queue a task for execution with priority handling.
   * @param task
   * @param priority
   * @param context
   */
  public queueTask(task: string, priority: number = 1, context?: unknown): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.taskQueue.push({ id: taskId, task, priority, context });
    this.taskQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    this.broadcastUpdate('task_queued', { id: taskId, task, priority });
    
    if (!this.isProcessing) {
      this.processTaskQueue();
    }
    
    return taskId;
  }

  /**
   * Process the task queue sequentially.
   */
  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {return;}
    
    this.isProcessing = true;
    
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      
      this.currentSession.currentTask = task.task;
      this.broadcastUpdate('task_started', task);
      
      try {
        const result = await this.executeTask(task);
        this.broadcastUpdate('task_completed', { task, result });
        
        // Update session metrics
        this.updateSessionMetrics(result);
        
      } catch (__error) {
        const failureResult: TaskResult = {
          success: false,
          message: __error instanceof Error ? __error.message : 'Unknown error',
          duration: 0
        };
        
        this.broadcastUpdate('task_failed', { task, result: failureResult });
      }
    }
    
    this.currentSession.currentTask = 'idle';
    this.isProcessing = false;
  }

  /**
   * Execute a specific task with comprehensive monitoring.
   * @param task
   * @param task.id
   * @param task.task
   * @param task.context
   */
  private async executeTask(task: { id: string; task: string; context?: any }): Promise<TaskResult> {
    const startTime = Date.now();
    
    // Add stage tracking
    const stage: {
      stage: string;
      status: 'pending' | 'active' | 'completed' | 'failed';
      startTime: Date;
      endTime?: Date;
      metrics?: any;
    } = {
      stage: task.task,
      status: 'active',
      startTime: new Date()
    };
    
    this.currentSession.progressStages.push(stage);
    
    try {
      let result: TaskResult;
      
      // Route task to appropriate handler
      if (task.task.includes('lint') || task.task.includes('eslint')) {
        result = await this.executeLintTask(task);
      } else if (task.task.includes('test')) {
        result = await this.executeTestTask(task);
      } else if (task.task.includes('build')) {
        result = await this.executeBuildTask(task);
      } else if (task.task.includes('format')) {
        result = await this.executeFormatTask(task);
      } else {
        result = await this.executeGenericTask(task);
      }
      
      // Update stage status
      stage.status = result.success ? 'completed' : 'failed';
      stage.endTime = new Date();
      
      result.duration = Date.now() - startTime;
      return result;
      
    } catch (__error) {
      stage.status = 'failed';
      stage.endTime = new Date();
      
      throw __error;
    }
  }

  /**
   * Execute linting task with detailed reporting.
   * @param task
   */
  private async executeLintTask(task: unknown): Promise<TaskResult> {
    return new Promise((resolve) => {
      const process = spawn('npm', ['run', 'lint:check'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        // Parse ESLint output for metrics
        const errorMatches: string[] = output.match(/(\d+) error/g) || [];
        const warningMatches: string[] = output.match(/(\d+) warning/g) || [];
        
        const errors = errorMatches.reduce((sum: number, match: string) => {
          return sum + parseInt(match.match(/\d+/)?.[0] || '0');
        }, 0);
        
        const warnings = warningMatches.reduce((sum: number, match: string) => {
          return sum + parseInt(match.match(/\d+/)?.[0] || '0');
        }, 0);
        
        this.currentSession.lintResults.errors = errors;
        this.currentSession.lintResults.warnings = warnings;
        
        resolve({
          success: code === 0,
          message: code === 0 ? 'Linting passed' : `Linting failed with ${errors} errors, ${warnings} warnings`,
          data: { errors, warnings, output: output.slice(-1000) }, // Last 1000 chars
          duration: 0,
          metrics: {
            linesChanged: 0,
            testsRun: 0,
            issuesFixed: Math.max(0, (this.currentSession.lintResults.fixedIssues || 0) - (errors || 0)),
            performanceImpact: 0
          }
        });
      });
    });
  }

  /**
   * Execute test task with coverage reporting.
   * @param task
   */
  private async executeTestTask(task: unknown): Promise<TaskResult> {
    return new Promise((resolve) => {
      const process = spawn('npm', ['test', '--', '--coverage', '--passWithNoTests'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        // Parse Jest output
        const passedMatch = output.match(/(\d+) passed/);
        const failedMatch = output.match(/(\d+) failed/);
        const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)/);
        
        const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
        const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
        const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;
        
        this.currentSession.testResults = { passed, failed, coverage };
        
        resolve({
          success: code === 0,
          message: `Tests: ${passed} passed, ${failed} failed. Coverage: ${coverage.toFixed(1)}%`,
          data: { passed, failed, coverage },
          duration: 0,
          metrics: {
            linesChanged: 0,
            testsRun: passed + failed,
            issuesFixed: 0,
            performanceImpact: 0
          }
        });
      });
    });
  }

  /**
   * Execute build task with timing.
   * @param task
   */
  private async executeBuildTask(task: unknown): Promise<TaskResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const process = spawn('npm', ['run', 'build'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        const buildTime = Date.now() - startTime;
        this.currentSession.performance.buildTime = buildTime;
        
        resolve({
          success: code === 0,
          message: code === 0 ? `Build completed in ${buildTime}ms` : 'Build failed',
          data: { buildTime, output: output.slice(-500) },
          duration: buildTime
        });
      });
    });
  }

  /**
   * Execute format task.
   * @param task
   */
  private async executeFormatTask(task: unknown): Promise<TaskResult> {
    return new Promise((resolve) => {
      const process = spawn('npm', ['run', 'format'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      process.on('close', (code) => {
        resolve({
          success: code === 0,
          message: code === 0 ? 'Code formatted successfully' : 'Format failed',
          duration: 0
        });
      });
    });
  }

  /**
   * Execute generic shell command task.
   * @param task
   */
  private async executeGenericTask(task: unknown): Promise<TaskResult> {
    return new Promise((resolve) => {
      try {
        const output = execSync((task as any).task, {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 30000 // 30 seconds timeout
        });
        
        resolve({
          success: true,
          message: 'Command executed successfully',
          data: { output: output.slice(-500) },
          duration: 0
        });
      } catch (__error) {
        resolve({
          success: false,
          message: __error instanceof Error ? __error.message : 'Command failed',
          duration: 0
        });
      }
    });
  }

  /**
   * Update session metrics based on task result.
   * @param result
   */
  private updateSessionMetrics(result: TaskResult): void {
    if (result.metrics) {
      // Update file tracking would go here
      // This is a simplified version
    }
    
    this.broadcastUpdate('metrics_updated', {
      session: this.currentSession,
      latestResult: result
    });
  }

  /**
   * Perform comprehensive health check.
   */
  public async performHealthCheck(): Promise<any> {
    const healthData = {
      timestamp: new Date().toISOString(),
      session: this.currentSession,
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      },
      project: {
        packageJson: this.checkPackageJson(),
        dependencies: this.checkDependencies(),
        scripts: this.getAvailableScripts()
      },
      queue: {
        pending: this.taskQueue.length,
        processing: this.isProcessing,
        currentTask: this.currentSession.currentTask
      }
    };
    
    return healthData;
  }

  /**
   * Check package.json status.
   */
  private checkPackageJson(): any {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return {
          exists: true,
          name: packageJson.name,
          version: packageJson.version,
          scripts: Object.keys(packageJson.scripts || {}),
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {})
        };
      }
      return { exists: false };
    } catch (__error) {
      return { exists: false, error: __error instanceof Error ? __error.message : 'Unknown error' };
    }
  }

  /**
   * Check dependencies status.
   */
  private checkDependencies(): any {
    try {
      const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
      return {
        installed: fs.existsSync(nodeModulesPath),
        lastModified: fs.existsSync(nodeModulesPath) 
          ? fs.statSync(nodeModulesPath).mtime 
          : null
      };
    } catch (__error) {
      return { installed: false, error: __error instanceof Error ? __error.message : 'Unknown error' };
    }
  }

  /**
   * Get available npm scripts.
   */
  private getAvailableScripts(): string[] {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return Object.keys(packageJson.scripts || {});
      }
      return [];
    } catch (__error) {
      return [];
    }
  }

  /**
   * Reset current session.
   */
  public resetSession(): void {
    this.currentSession = this.initializeSession();
    this.taskQueue = [];
    this.isProcessing = false;
  }

  /**
   * Get current session data.
   */
  public getCurrentSession(): DevSession {
    return { ...this.currentSession };
  }

  /**
   * Cleanup resources.
   */
  public cleanup(): void {
    this.activeConnections.forEach(ws => ws.close());
    this.wsServer?.close();
    this.removeAllListeners();
  }

  /**
   * Start intelligent file watching for automatic task triggering.
   */
  public startIntelligentWatching(): void {
    const chokidar = require('chokidar');
    
    const watcher = chokidar.watch([
      path.join(this.projectRoot, 'client/src/**/*.{ts,tsx}'),
      path.join(this.projectRoot, 'server/**/*.ts'),
      path.join(this.projectRoot, 'shared/**/*.ts')
    ], {
      ignored: /node_modules|\.git|dist|build/,
      persistent: true
    });
    
    let debounceTimer: NodeJS.Timeout | null = null;
    
    watcher.on('change', (filePath: string) => {
      // Track file changes
      const relativePath = path.relative(this.projectRoot, filePath);
      if (!this.currentSession.files.modified.includes(relativePath)) {
        this.currentSession.files.modified.push(relativePath);
      }
      
      // Debounced automatic quality check
      if (debounceTimer) {clearTimeout(debounceTimer);}
      debounceTimer = setTimeout(() => {
        this.queueTask('npm run lint:check', 2, { trigger: 'file_change', file: relativePath });
      }, 2000);
      
      this.broadcastUpdate('file_changed', { file: relativePath });
    });
    
    console.log('🔍 Intelligent file watching started');
  }
}

// Export singleton instance
export const agentOrchestrator = new EnhancedAgentOrchestrator();