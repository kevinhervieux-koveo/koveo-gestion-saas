/**
 * Continuous Test Coverage Monitoring for Koveo Gestion.
 * 
 * Provides real-time monitoring of test coverage, effectiveness tracking,
 * and automated alerts for Quebec property management compliance.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { coverageAutomation } from '../tests/utils/coverage-automation';
import { TestQualityValidator } from './test-quality-validator';

/**
 * Interface for coverage monitoring alerts.
 */
interface CoverageAlert {
  type: 'coverage_drop' | 'quality_decline' | 'quebec_compliance' | 'performance_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: string;
  resolved: boolean;
}

/**
 * Interface for monitoring metrics data.
 */
interface MonitoringMetrics {
  timestamp: string;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
    overall: number;
  };
  quality: {
    testQuality: number;
    quebecCompliance: number;
    performance: number;
    accessibility: number;
  };
  trends: {
    coverageChange: number;
    qualityChange: number;
    quebecComplianceChange: number;
  };
  alerts: CoverageAlert[];
}

/**
 * Interface for monitoring configuration.
 */
interface MonitoringConfig {
  coverageThresholds: {
    critical: number;
    warning: number;
    target: number;
  };
  quebecComplianceThreshold: number;
  performanceThreshold: number;
  qualityThreshold: number;
  monitoringInterval: number;
  alertRetention: number;
  reportFrequency: number;
}

/**
 * Continuous monitoring service for test coverage and quality metrics
 * with Quebec property management compliance tracking.
 */
class CoverageMonitoringService {
  private config: MonitoringConfig;
  private projectRoot: string;
  private dataDir: string;
  private isMonitoring: boolean = false;
  private validator: TestQualityValidator;

  /**
   * Creates a new coverage monitoring service instance.
   */
  constructor() {
    this.projectRoot = process.cwd();
    this.dataDir = join(this.projectRoot, 'coverage', 'monitoring');
    this.validator = new TestQualityValidator();
    
    this.config = {
      coverageThresholds: {
        critical: 80,
        warning: 90,
        target: 95
      },
      quebecComplianceThreshold: 90,
      performanceThreshold: 80,
      qualityThreshold: 85,
      monitoringInterval: 300000, // 5 minutes
      alertRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
      reportFrequency: 24 * 60 * 60 * 1000 // 24 hours
    };

    this.ensureDataDirectory();
  }

  /**
   * Starts continuous coverage monitoring with Quebec compliance tracking.
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('⏰ Coverage monitoring is already running');
      return;
    }

    console.warn('🚀 Starting continuous coverage monitoring for Koveo Gestion...');
    console.warn('🇨🇦 Including Quebec property management compliance tracking\n');
    
    this.isMonitoring = true;

    // Initial baseline collection
    await this.collectBaseline();

    // Start monitoring loop
    this.monitoringLoop();

    // Schedule daily reports
    this.scheduleDailyReports();

    console.warn('✅ Coverage monitoring started successfully');
    console.warn(`📊 Collecting metrics every ${this.config.monitoringInterval / 1000} seconds`);
    console.warn(`📧 Daily reports generated every ${this.config.reportFrequency / (60 * 60 * 1000)} hours\n`);
  }

  /**
   * Stops continuous monitoring.
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    console.warn('⏹️  Coverage monitoring stopped');
  }

  /**
   * Collects baseline metrics for comparison.
   */
  private async collectBaseline(): Promise<void> {
    console.warn('📋 Collecting baseline metrics...');
    
    try {
      const metrics = await this.collectCurrentMetrics();
      const baselinePath = join(this.dataDir, 'baseline.json');
      writeFileSync(baselinePath, JSON.stringify(metrics, null, 2));
      
      console.warn('✅ Baseline metrics collected and saved');
    } catch (error) {
      console.error('❌ Failed to collect baseline:', error);
    }
  }

  /**
   * Main monitoring loop that runs continuously.
   */
  private async monitoringLoop(): Promise<void> {
    while (this.isMonitoring) {
      try {
        console.warn(`🔍 [${new Date().toLocaleTimeString()}] Collecting metrics...`);
        
        // Collect current metrics
        const metrics = await this.collectCurrentMetrics();
        
        // Analyze trends and detect issues
        const alerts = await this.analyzeMetricsAndGenerateAlerts(metrics);
        metrics.alerts = alerts;
        
        // Save metrics
        await this.saveMetrics(metrics);
        
        // Process alerts
        if (alerts.length > 0) {
          await this.processAlerts(alerts);
        }
        
        // Clean up old data
        await this.cleanupOldData();
        
        console.warn(`✅ [${new Date().toLocaleTimeString()}] Metrics collected successfully`);
        
        if (alerts.length > 0) {
          console.warn(`⚠️  ${alerts.length} alerts generated`);
        }
        
      } catch (error) {
        console.error(`❌ [${new Date().toLocaleTimeString()}] Monitoring error:`, error);
      }
      
      // Wait for next collection interval
      await this.sleep(this.config.monitoringInterval);
    }
  }

  /**
   * Collects current coverage and quality metrics.
   */
  private async collectCurrentMetrics(): Promise<MonitoringMetrics> {
    // Run comprehensive coverage analysis
    const coverageData = await coverageAutomation.runComprehensiveCoverage();
    
    // Run quality validation
    const qualityReport = await this.validator.validateTestQuality();
    
    // Calculate trends
    const trends = await this.calculateTrends(coverageData, qualityReport);
    
    const aggregateCoverage = coverageData.coverageData.aggregate;
    const overallCoverage = aggregateCoverage ? 
      (aggregateCoverage.statements + aggregateCoverage.branches + aggregateCoverage.functions + aggregateCoverage.lines) / 4 : 0;

    const metrics: MonitoringMetrics = {
      timestamp: new Date().toISOString(),
      coverage: {
        statements: aggregateCoverage?.statements || 0,
        branches: aggregateCoverage?.branches || 0,
        functions: aggregateCoverage?.functions || 0,
        lines: aggregateCoverage?.lines || 0,
        overall: Math.round(overallCoverage * 100) / 100
      },
      quality: {
        testQuality: qualityReport.testQuality || 0,
        quebecCompliance: qualityReport.quebecCompliance || 0,
        performance: qualityReport.performance || 0,
        accessibility: qualityReport.accessibility || 0
      },
      trends,
      alerts: []
    };

    return metrics;
  }

  /**
   * Analyzes metrics and generates alerts for issues.
   * @param metrics
   */
  private async analyzeMetricsAndGenerateAlerts(metrics: MonitoringMetrics): Promise<CoverageAlert[]> {
    const alerts: CoverageAlert[] = [];

    // Coverage threshold alerts
    if (metrics.coverage.overall < this.config.coverageThresholds.critical) {
      alerts.push({
        type: 'coverage_drop',
        severity: 'critical',
        message: `Test coverage critically low: ${metrics.coverage.overall.toFixed(1)}%`,
        details: { coverage: metrics.coverage },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    } else if (metrics.coverage.overall < this.config.coverageThresholds.warning) {
      alerts.push({
        type: 'coverage_drop',
        severity: 'medium',
        message: `Test coverage below warning threshold: ${metrics.coverage.overall.toFixed(1)}%`,
        details: { coverage: metrics.coverage },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }

    // Quebec compliance alerts
    if (metrics.quality.quebecCompliance < this.config.quebecComplianceThreshold) {
      alerts.push({
        type: 'quebec_compliance',
        severity: 'high',
        message: `Quebec compliance tests below threshold: ${metrics.quality.quebecCompliance.toFixed(1)}%`,
        details: { quebecCompliance: metrics.quality.quebecCompliance },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }

    // Performance alerts
    if (metrics.quality.performance < this.config.performanceThreshold) {
      alerts.push({
        type: 'performance_issue',
        severity: 'medium',
        message: `Test performance below threshold: ${metrics.quality.performance.toFixed(1)}%`,
        details: { performance: metrics.quality.performance },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }

    // Quality decline alerts
    if (metrics.quality.testQuality < this.config.qualityThreshold) {
      alerts.push({
        type: 'quality_decline',
        severity: 'medium',
        message: `Test quality below threshold: ${metrics.quality.testQuality.toFixed(1)}%`,
        details: { testQuality: metrics.quality.testQuality },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }

    // Trend-based alerts
    if (metrics.trends.coverageChange < -5) {
      alerts.push({
        type: 'coverage_drop',
        severity: 'high',
        message: `Significant coverage drop detected: ${metrics.trends.coverageChange.toFixed(1)}%`,
        details: { trend: metrics.trends.coverageChange },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }

    if (metrics.trends.quebecComplianceChange < -10) {
      alerts.push({
        type: 'quebec_compliance',
        severity: 'critical',
        message: `Quebec compliance declining rapidly: ${metrics.trends.quebecComplianceChange.toFixed(1)}%`,
        details: { trend: metrics.trends.quebecComplianceChange },
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }

    return alerts;
  }

  /**
   * Calculates trends from historical data.
   * @param coverageData
   * @param qualityReport
   */
  private async calculateTrends(coverageData: any, qualityReport: any): Promise<any> {
    const historicalPath = join(this.dataDir, 'historical.json');
    let historical = [];
    
    if (existsSync(historicalPath)) {
      historical = JSON.parse(readFileSync(historicalPath, 'utf8'));
    }

    if (historical.length === 0) {
      return {
        coverageChange: 0,
        qualityChange: 0,
        quebecComplianceChange: 0
      };
    }

    const latest = historical[historical.length - 1];
    const aggregateCoverage = coverageData.coverageData.aggregate;
    const currentCoverage = aggregateCoverage ? 
      (aggregateCoverage.statements + aggregateCoverage.branches + aggregateCoverage.functions + aggregateCoverage.lines) / 4 : 0;

    return {
      coverageChange: currentCoverage - (latest.coverage?.overall || 0),
      qualityChange: (qualityReport.testQuality || 0) - (latest.quality?.testQuality || 0),
      quebecComplianceChange: (qualityReport.quebecCompliance || 0) - (latest.quality?.quebecCompliance || 0)
    };
  }

  /**
   * Processes and handles generated alerts.
   * @param alerts
   */
  private async processAlerts(alerts: CoverageAlert[]): Promise<void> {
    for (const alert of alerts) {
      // Log alert to console
      const severityIcon = {
        low: '💙',
        medium: '🟡',
        high: '🟠',
        critical: '🔴'
      }[alert.severity];
      
      console.warn(`${severityIcon} [${alert.type.toUpperCase()}] ${alert.message}`);
      
      // Save alert to file
      await this.saveAlert(alert);
      
      // Send notifications for critical alerts
      if (alert.severity === 'critical') {
        await this.sendCriticalAlert(alert);
      }
    }
  }

  /**
   * Saves alert to persistent storage.
   * @param alert
   */
  private async saveAlert(alert: CoverageAlert): Promise<void> {
    const alertsPath = join(this.dataDir, 'alerts.json');
    let alerts = [];
    
    if (existsSync(alertsPath)) {
      alerts = JSON.parse(readFileSync(alertsPath, 'utf8'));
    }
    
    alerts.push(alert);
    writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
  }

  /**
   * Sends critical alert notifications.
   * @param alert
   */
  private async sendCriticalAlert(alert: CoverageAlert): Promise<void> {
    console.warn('🚨 CRITICAL ALERT DETECTED!');
    console.warn('📧 Notification would be sent to development team');
    console.warn(`   Alert: ${alert.message}`);
    console.warn(`   Time: ${alert.timestamp}`);
    
    // In a real implementation, this would send emails, Slack messages, etc.
  }

  /**
   * Saves metrics to persistent storage.
   * @param metrics
   */
  private async saveMetrics(metrics: MonitoringMetrics): Promise<void> {
    // Save to historical data
    const historicalPath = join(this.dataDir, 'historical.json');
    let historical = [];
    
    if (existsSync(historicalPath)) {
      historical = JSON.parse(readFileSync(historicalPath, 'utf8'));
    }
    
    historical.push(metrics);
    
    // Keep only last 100 data points
    if (historical.length > 100) {
      historical = historical.slice(-100);
    }
    
    writeFileSync(historicalPath, JSON.stringify(historical, null, 2));
    
    // Save current metrics
    const currentPath = join(this.dataDir, 'current.json');
    writeFileSync(currentPath, JSON.stringify(metrics, null, 2));
  }

  /**
   * Schedules daily report generation.
   */
  private scheduleDailyReports(): void {
    setInterval(async () => {
      if (this.isMonitoring) {
        await this.generateDailyReport();
      }
    }, this.config.reportFrequency);
  }

  /**
   * Generates comprehensive daily report.
   */
  private async generateDailyReport(): Promise<void> {
    console.warn('📊 Generating daily coverage report...');
    
    try {
      const historicalPath = join(this.dataDir, 'historical.json');
      if (!existsSync(historicalPath)) {
        console.warn('⚠️  No historical data available for report');
        return;
      }
      
      const historical = JSON.parse(readFileSync(historicalPath, 'utf8'));
      const last24Hours = historical.filter((metric: any) => {
        const metricTime = new Date(metric.timestamp).getTime();
        const now = Date.now();
        return now - metricTime <= 24 * 60 * 60 * 1000;
      });
      
      if (last24Hours.length === 0) {
        console.warn('⚠️  No data from last 24 hours');
        return;
      }
      
      const report = this.generateReportSummary(last24Hours);
      const reportPath = join(this.dataDir, `daily-report-${new Date().toISOString().split('T')[0]}.html`);
      
      writeFileSync(reportPath, this.generateDailyReportHTML(report));
      
      console.warn(`✅ Daily report generated: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Failed to generate daily report:', error);
    }
  }

  /**
   * Generates report summary from historical data.
   * @param data
   */
  private generateReportSummary(data: MonitoringMetrics[]): any {
    if (data.length === 0) {return {};}
    
    const latest = data[data.length - 1];
    const oldest = data[0];
    
    return {
      period: {
        start: oldest.timestamp,
        end: latest.timestamp,
        dataPoints: data.length
      },
      current: latest,
      trends: {
        coverage: latest.coverage.overall - oldest.coverage.overall,
        quality: latest.quality.testQuality - oldest.quality.testQuality,
        quebecCompliance: latest.quality.quebecCompliance - oldest.quality.quebecCompliance
      },
      alerts: data.reduce((acc, metric) => acc + metric.alerts.length, 0),
      avgCoverage: data.reduce((acc, metric) => acc + metric.coverage.overall, 0) / data.length
    };
  }

  /**
   * Generates HTML daily report.
   * @param report
   */
  private generateDailyReportHTML(report: any): string {
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Koveo Gestion - Daily Coverage Report</title>
      <style>
        body { font-family: Inter, sans-serif; margin: 20px; background: #f8fafc; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; }
        .header { text-align: center; margin-bottom: 30px; color: #1e40af; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric { padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center; }
        .trend-up { color: #10b981; }
        .trend-down { color: #ef4444; }
        .chart { height: 200px; background: #f1f5f9; border-radius: 8px; margin: 20px 0; display: flex; align-items: center; justify-content: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Koveo Gestion Daily Coverage Report</h1>
          <p>Rapport quotidien - ${new Date().toLocaleDateString('fr-CA')}</p>
        </div>
        
        <div class="metrics">
          <div class="metric">
            <h3>Couverture Actuelle</h3>
            <div style="font-size: 2rem; font-weight: bold;">${report.current?.coverage.overall.toFixed(1) || 0}%</div>
            <div class="${report.trends?.coverage >= 0 ? 'trend-up' : 'trend-down'}">
              ${report.trends?.coverage >= 0 ? '↗' : '↘'} ${Math.abs(report.trends?.coverage || 0).toFixed(1)}%
            </div>
          </div>
          
          <div class="metric">
            <h3>Conformité Québécoise</h3>
            <div style="font-size: 2rem; font-weight: bold;">${report.current?.quality.quebecCompliance.toFixed(1) || 0}%</div>
            <div class="${report.trends?.quebecCompliance >= 0 ? 'trend-up' : 'trend-down'}">
              ${report.trends?.quebecCompliance >= 0 ? '↗' : '↘'} ${Math.abs(report.trends?.quebecCompliance || 0).toFixed(1)}%
            </div>
          </div>
          
          <div class="metric">
            <h3>Alertes Générées</h3>
            <div style="font-size: 2rem; font-weight: bold;">${report.alerts || 0}</div>
            <div>Dernières 24h</div>
          </div>
          
          <div class="metric">
            <h3>Couverture Moyenne</h3>
            <div style="font-size: 2rem; font-weight: bold;">${report.avgCoverage?.toFixed(1) || 0}%</div>
            <div>Sur la période</div>
          </div>
        </div>
        
        <div class="chart">
          <p>📈 Graphique de tendance (intégration future)</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Cleans up old monitoring data.
   */
  private async cleanupOldData(): Promise<void> {
    const cutoffTime = Date.now() - this.config.alertRetention;
    
    // Clean up old alerts
    const alertsPath = join(this.dataDir, 'alerts.json');
    if (existsSync(alertsPath)) {
      const alerts = JSON.parse(readFileSync(alertsPath, 'utf8'));
      const recentAlerts = alerts.filter((alert: CoverageAlert) => 
        new Date(alert.timestamp).getTime() > cutoffTime
      );
      writeFileSync(alertsPath, JSON.stringify(recentAlerts, null, 2));
    }
  }

  /**
   * Ensures monitoring data directory exists.
   */
  private ensureDataDirectory(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Utility function for async sleep.
   * @param ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets current monitoring status and statistics.
   */
  async getMonitoringStatus(): Promise<any> {
    const currentPath = join(this.dataDir, 'current.json');
    if (!existsSync(currentPath)) {
      return { status: 'not_initialized' };
    }
    
    const current = JSON.parse(readFileSync(currentPath, 'utf8'));
    const alertsPath = join(this.dataDir, 'alerts.json');
    const alerts = existsSync(alertsPath) ? JSON.parse(readFileSync(alertsPath, 'utf8')) : [];
    
    return {
      status: this.isMonitoring ? 'running' : 'stopped',
      lastUpdate: current.timestamp,
      metrics: current,
      activeAlerts: alerts.filter((alert: CoverageAlert) => !alert.resolved).length,
      totalAlerts: alerts.length
    };
  }
}

// Export singleton instance
export const coverageMonitor = new CoverageMonitoringService();

// Run monitoring if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'start') {
    coverageMonitor.startMonitoring().catch(console.error);
  } else if (command === 'stop') {
    coverageMonitor.stopMonitoring();
    process.exit(0);
  } else if (command === 'status') {
    coverageMonitor.getMonitoringStatus().then(status => {
      console.warn('📊 Monitoring Status:', JSON.stringify(status, null, 2));
      process.exit(0);
    });
  } else {
    console.warn('Usage: npm run coverage:monitor [start|stop|status]');
    process.exit(1);
  }
}