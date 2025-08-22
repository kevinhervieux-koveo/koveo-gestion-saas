/**
 * @file AI Agent Dashboard.
 * @description Comprehensive dashboard and monitoring system for AI agent operations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { agentToolkit } from './ai-agent-toolkit';
import { contextManager } from './smart-context-manager';
import { workflowAssistant } from './intelligent-workflow-assistant';

/**
 * Dashboard metrics interface for tracking project health and performance.
 */
export interface DashboardMetrics {
  timestamp: string;
  projectHealth: {
    overallScore: number;
    codeQuality: number;
    documentation: number;
    testing: number;
    security: number;
    performance: number;
  };
  codeAnalysis: {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    typeScriptErrors: number;
    lintWarnings: number;
  };
  workspaceContext: {
    workingFiles: number;
    focusArea: string;
    recentActivity: string[];
  };
  recommendations: {
    priority: number;
    exploratory: number;
    maintenance: number;
  };
  insights: Array<{
    category: string;
    severity: string;
    title: string;
    impact: number;
  }>;
}

/**
 * Agent performance metrics for session tracking.
 */
export interface AgentPerformance {
  sessionsToday: number;
  averageSessionDuration: number;
  tasksCompleted: number;
  errorRate: number;
  userSatisfaction: number;
  efficiency: number;
}

/**
 * System status interface for monitoring infrastructure health.
 */
export interface SystemStatus {
  status: 'optimal' | 'good' | 'warning' | 'critical';
  uptime: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  lastBackup: string;
}

/**
 * AI Agent Dashboard for comprehensive monitoring and control.
 */
export class AIAgentDashboard {
  private projectRoot: string;
  private metricsHistory: DashboardMetrics[] = [];
  private sessionStart: Date;

  /**
   * Initialize AI Agent Dashboard.
   * @param projectRoot - The root directory of the project to monitor.
   */
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.sessionStart = new Date();
    this.loadMetricsHistory();
  }

  /**
   * Load historical metrics.
   */
  private loadMetricsHistory(): void {
    const historyPath = path.join(this.projectRoot, '.ai-agent', 'metrics-history.json');
    if (fs.existsSync(historyPath)) {
      try {
        const data = fs.readFileSync(historyPath, 'utf-8');
        this.metricsHistory = JSON.parse(_data);
      } catch (_error) {
        console.warn('Failed to load metrics history:', _error);
        this.metricsHistory = [];
      }
    }
  }

  /**
   * Save metrics to history.
   */
  private saveMetricsHistory(): void {
    const historyDir = path.join(this.projectRoot, '.ai-agent');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    const historyPath = path.join(historyDir, 'metrics-history.json');
    // Keep only last 100 entries
    const limitedHistory = this.metricsHistory.slice(-100);
    fs.writeFileSync(historyPath, JSON.stringify(limitedHistory, null, 2));
  }

  /**
   * Collect current metrics.
   * @returns Promise resolving to current dashboard metrics.
   */
  public async collectMetrics(): Promise<DashboardMetrics> {
    const [projectHealth, codeAnalysis, workspaceContext, recommendations, insights] = await Promise.all([
      agentToolkit.getProjectHealth(),
      agentToolkit.analyzeCode(),
      this.getWorkspaceContext(),
      this.getRecommendations(),
      workflowAssistant.generateProjectInsights()
    ]);

    const metrics: DashboardMetrics = {
      timestamp: new Date().toISOString(),
      projectHealth: {
        overallScore: projectHealth.overallScore,
        codeQuality: projectHealth.codeQuality,
        documentation: projectHealth.documentation,
        testing: projectHealth.testing,
        security: projectHealth.security,
        performance: projectHealth.performance
      },
      codeAnalysis: {
        complexity: codeAnalysis.complexity,
        maintainability: codeAnalysis.maintainability,
        testCoverage: codeAnalysis.testCoverage,
        typeScriptErrors: codeAnalysis.typeScriptErrors,
        lintWarnings: codeAnalysis.lintWarnings
      },
      workspaceContext: {
        workingFiles: workspaceContext.workingFiles,
        focusArea: workspaceContext.focusArea,
        recentActivity: workspaceContext.recentActivity
      },
      recommendations: {
        priority: recommendations.priority.length,
        exploratory: recommendations.exploratory.length,
        maintenance: recommendations.maintenance.length
      },
      insights: insights.map(insight => ({
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        impact: insight.impact
      }))
    };

    this.metricsHistory.push(metrics);
    this.saveMetricsHistory();

    return metrics;
  }

  /**
   * Get workspace context summary.
   * @returns Promise resolving to workspace context data.
   */
  private async getWorkspaceContext(): Promise<{
    workingFiles: number;
    focusArea: string;
    recentActivity: string[];
  }> {
    const context = JSON.parse(contextManager.generateContextSummary());
    
    return {
      workingFiles: context.workingSet || 0,
      focusArea: context.focusArea || 'general',
      recentActivity: context.recentFiles?.map((f: { path: string }) => f.path).slice(0, 5) || []
    };
  }

  /**
   * Get recommendations summary.
   * @returns Promise resolving to categorized recommendations.
   */
  private async getRecommendations(): Promise<{
    priority: Array<{ type: string; description: string }>;
    exploratory: Array<{ type: string; description: string }>;
    maintenance: Array<{ type: string; description: string }>;
  }> {
    return contextManager.getSmartRecommendations();
  }

  /**
   * Generate real-time dashboard HTML.
   * @returns Promise resolving to HTML string for dashboard.
   */
  public async generateDashboardHTML(): Promise<string> {
    const metrics = await this.collectMetrics();
    const agentPerformance = this.calculateAgentPerformance();
    const systemStatus = this.getSystemStatus();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent Dashboard - Koveo Gestion</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #fff; line-height: 1.6; }
        .dashboard { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 2.5rem; color: #00ff88; margin-bottom: 10px; }
        .header .subtitle { color: #888; font-size: 1.1rem; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 20px; }
        .metric-card h3 { color: #00ff88; margin-bottom: 15px; font-size: 1.2rem; }
        .metric-value { font-size: 2rem; font-weight: bold; margin-bottom: 10px; }
        .metric-value.good { color: #00ff88; }
        .metric-value.warning { color: #ffaa00; }
        .metric-value.error { color: #ff4444; }
        .metric-detail { color: #ccc; font-size: 0.9rem; }
        .progress-bar { width: 100%; height: 8px; background: #333; border-radius: 4px; margin: 10px 0; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .progress-fill.good { background: linear-gradient(90deg, #00ff88, #00cc66); }
        .progress-fill.warning { background: linear-gradient(90deg, #ffaa00, #ff8800); }
        .progress-fill.error { background: linear-gradient(90deg, #ff4444, #cc0000); }
        .insights-section { margin-top: 30px; }
        .insights-list { display: flex; flex-direction: column; gap: 10px; }
        .insight-item { background: #1a1a1a; border-left: 4px solid #00ff88; padding: 15px; border-radius: 0 8px 8px 0; }
        .insight-item.warning { border-left-color: #ffaa00; }
        .insight-item.error { border-left-color: #ff4444; }
        .insight-item.critical { border-left-color: #ff0000; }
        .insight-title { font-weight: bold; margin-bottom: 5px; }
        .insight-category { font-size: 0.8rem; color: #888; text-transform: uppercase; }
        .recommendations { margin-top: 30px; }
        .recommendations-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .recommendation-card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 15px; }
        .recommendation-priority { color: #ff4444; font-weight: bold; }
        .recommendation-exploratory { color: #ffaa00; font-weight: bold; }
        .recommendation-maintenance { color: #00ff88; font-weight: bold; }
        .status-indicator { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .status-optimal { background: #00ff88; }
        .status-good { background: #00aa66; }
        .status-warning { background: #ffaa00; }
        .status-critical { background: #ff4444; }
        .timestamp { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
        .auto-refresh { position: fixed; top: 20px; right: 20px; background: #333; padding: 10px; border-radius: 8px; font-size: 0.8rem; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>🤖 AI Agent Dashboard</h1>
            <p class="subtitle">Koveo Gestion - Real-time Agent Monitoring & Control</p>
        </div>

        <div class="auto-refresh">
            <span class="status-indicator status-optimal"></span>
            Auto-refresh: Active
        </div>

        <!-- System Status -->
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>System Status</h3>
                <div class="metric-value ${systemStatus.status === 'optimal' ? 'good' : systemStatus.status === 'warning' ? 'warning' : 'error'}">
                    <span class="status-indicator status-${systemStatus.status}"></span>
                    ${systemStatus.status.toUpperCase()}
                </div>
                <div class="metric-detail">Uptime: ${Math.floor(systemStatus.uptime / 3600)}h ${Math.floor((systemStatus.uptime % 3600) / 60)}m</div>
            </div>

            <div class="metric-card">
                <h3>Project Health</h3>
                <div class="metric-value ${metrics.projectHealth.overallScore >= 80 ? 'good' : metrics.projectHealth.overallScore >= 60 ? 'warning' : 'error'}">
                    ${metrics.projectHealth.overallScore}/100
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${metrics.projectHealth.overallScore >= 80 ? 'good' : metrics.projectHealth.overallScore >= 60 ? 'warning' : 'error'}" 
                         style="width: ${metrics.projectHealth.overallScore}%"></div>
                </div>
                <div class="metric-detail">Overall project health score</div>
            </div>

            <div class="metric-card">
                <h3>Code Quality</h3>
                <div class="metric-value ${metrics.codeAnalysis.typeScriptErrors === 0 && metrics.codeAnalysis.lintWarnings < 10 ? 'good' : metrics.codeAnalysis.typeScriptErrors > 0 ? 'error' : 'warning'}">
                    ${metrics.codeAnalysis.typeScriptErrors} TS Errors
                </div>
                <div class="metric-detail">${metrics.codeAnalysis.lintWarnings} lint warnings | Maintainability: ${metrics.codeAnalysis.maintainability}/100</div>
            </div>

            <div class="metric-card">
                <h3>Test Coverage</h3>
                <div class="metric-value ${metrics.codeAnalysis.testCoverage >= 80 ? 'good' : metrics.codeAnalysis.testCoverage >= 60 ? 'warning' : 'error'}">
                    ${metrics.codeAnalysis.testCoverage.toFixed(1)}%
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${metrics.codeAnalysis.testCoverage >= 80 ? 'good' : metrics.codeAnalysis.testCoverage >= 60 ? 'warning' : 'error'}" 
                         style="width: ${metrics.codeAnalysis.testCoverage}%"></div>
                </div>
                <div class="metric-detail">Test coverage percentage</div>
            </div>

            <div class="metric-card">
                <h3>Agent Performance</h3>
                <div class="metric-value ${agentPerformance.efficiency >= 80 ? 'good' : agentPerformance.efficiency >= 60 ? 'warning' : 'error'}">
                    ${agentPerformance.efficiency.toFixed(1)}%
                </div>
                <div class="metric-detail">Session efficiency | ${agentPerformance.tasksCompleted} tasks completed</div>
            </div>

            <div class="metric-card">
                <h3>Workspace Context</h3>
                <div class="metric-value good">
                    ${metrics.workspaceContext.workingFiles}
                </div>
                <div class="metric-detail">Working files | Focus: ${metrics.workspaceContext.focusArea}</div>
            </div>
        </div>

        <!-- Detailed Metrics -->
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Security & Performance</h3>
                <div class="metric-detail">
                    Security Score: ${metrics.projectHealth.security}/100<br>
                    Performance Score: ${metrics.projectHealth.performance}/100<br>
                    Documentation Score: ${metrics.projectHealth.documentation}/100
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${(metrics.projectHealth.security + metrics.projectHealth.performance + metrics.projectHealth.documentation) / 3 >= 80 ? 'good' : 'warning'}" 
                         style="width: ${(metrics.projectHealth.security + metrics.projectHealth.performance + metrics.projectHealth.documentation) / 3}%"></div>
                </div>
            </div>

            <div class="metric-card">
                <h3>Recommendations</h3>
                <div class="metric-detail">
                    <span class="recommendation-priority">Priority: ${metrics.recommendations.priority}</span><br>
                    <span class="recommendation-exploratory">Exploratory: ${metrics.recommendations.exploratory}</span><br>
                    <span class="recommendation-maintenance">Maintenance: ${metrics.recommendations.maintenance}</span>
                </div>
            </div>
        </div>

        <!-- Project Insights -->
        <div class="insights-section">
            <h3 style="color: #00ff88; margin-bottom: 15px;">🔍 Project Insights</h3>
            <div class="insights-list">
                ${metrics.insights.slice(0, 8).map(insight => `
                    <div class="insight-item ${insight.severity}">
                        <div class="insight-category">${insight.category}</div>
                        <div class="insight-title">${insight.title}</div>
                        <div class="metric-detail">Impact Score: ${insight.impact}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Recent Activity -->
        <div class="insights-section">
            <h3 style="color: #00ff88; margin-bottom: 15px;">📁 Recent Activity</h3>
            <div class="insights-list">
                ${metrics.workspaceContext.recentActivity.map(file => `
                    <div class="insight-item">
                        <div class="insight-title">${file}</div>
                        <div class="insight-category">recent file</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="timestamp">
            Last updated: ${new Date(metrics.timestamp).toLocaleString()}<br>
            Session duration: ${Math.floor((Date.now() - this.sessionStart.getTime()) / 60000)} minutes
        </div>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>`;
  }

  /**
   * Calculate agent performance metrics.
   * @returns Agent performance metrics object.
   */
  private calculateAgentPerformance(): AgentPerformance {
    const sessionDuration = (Date.now() - this.sessionStart.getTime()) / 1000 / 60; // minutes
    const recentMetrics = this.metricsHistory.slice(-10);
    
    // Calculate efficiency based on health improvements
    let efficiency = 75; // Base efficiency
    if (recentMetrics.length > 1) {
      const latest = recentMetrics[recentMetrics.length - 1];
      const previous = recentMetrics[recentMetrics.length - 2];
      
      const healthImprovement = latest.projectHealth.overallScore - previous.projectHealth.overallScore;
      efficiency += Math.max(-25, Math.min(25, healthImprovement * 2));
    }

    return {
      sessionsToday: 1, // Simplified for demo
      averageSessionDuration: sessionDuration,
      tasksCompleted: Math.floor(sessionDuration / 5), // Estimate based on time
      errorRate: 5, // Simplified calculation
      userSatisfaction: 85, // Would come from user feedback
      efficiency: Math.max(0, Math.min(100, efficiency))
    };
  }

  /**
   * Get system status.
   * @returns Current system status metrics.
   */
  private getSystemStatus(): SystemStatus {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    let status: SystemStatus['status'] = 'optimal';
    if (memoryPercentage > 80) {status = 'warning';}
    if (memoryPercentage > 95) {status = 'critical';}

    return {
      status,
      uptime,
      memoryUsage: memoryPercentage,
      diskUsage: 45, // Simplified - would need actual disk check
      networkLatency: 12, // Simplified - would need actual network check
      lastBackup: new Date().toISOString()
    };
  }

  /**
   * Export dashboard data as JSON.
   * @returns Promise resolving to JSON string of dashboard data.
   */
  public async exportDashboardData(): Promise<string> {
    const metrics = await this.collectMetrics();
    const performance = this.calculateAgentPerformance();
    const systemStatus = this.getSystemStatus();

    return JSON.stringify({
      metrics,
      performance,
      systemStatus,
      history: this.metricsHistory.slice(-20) // Last 20 entries
    }, null, 2);
  }

  /**
   * Save dashboard HTML to file.
   * @returns Promise resolving to file path where dashboard was saved.
   */
  public async saveDashboard(): Promise<string> {
    const html = await this.generateDashboardHTML();
    const dashboardPath = path.join(this.projectRoot, '.ai-agent', 'dashboard.html');
    
    const dir = path.dirname(dashboardPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(dashboardPath, html);
    return dashboardPath;
  }

  /**
   * Get metrics trends.
   * @param days
   */
  /**
   * Get metrics trends over specified time period.
   * @param days - Number of days to analyze trends for.
   * @returns Trends data or null if insufficient data.
   */
  public getMetricsTrends(days: number = 7): {
    projectHealth: { change: number; trend: string };
    codeQuality: { change: number; trend: string };
    testCoverage: { change: number; trend: string };
  } | null {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const recentMetrics = this.metricsHistory.filter(m => 
      new Date(m.timestamp) > cutoff
    );

    if (recentMetrics.length < 2) {return null;}

    const first = recentMetrics[0];
    const last = recentMetrics[recentMetrics.length - 1];

    return {
      projectHealth: {
        change: last.projectHealth.overallScore - first.projectHealth.overallScore,
        trend: last.projectHealth.overallScore > first.projectHealth.overallScore ? 'improving' : 'declining'
      },
      codeQuality: {
        change: last.codeAnalysis.maintainability - first.codeAnalysis.maintainability,
        trend: last.codeAnalysis.maintainability > first.codeAnalysis.maintainability ? 'improving' : 'declining'
      },
      testCoverage: {
        change: last.codeAnalysis.testCoverage - first.codeAnalysis.testCoverage,
        trend: last.codeAnalysis.testCoverage > first.codeAnalysis.testCoverage ? 'improving' : 'declining'
      }
    };
  }
}

// Export singleton instance
export const agentDashboard = new AIAgentDashboard();