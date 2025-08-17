#!/usr/bin/env tsx
/**
 * @file AI Agent CLI
 * @description Command-line interface for AI agent tools and operations
 */

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { agentToolkit } from '../tools/ai-agent-toolkit';
import { contextManager } from '../tools/smart-context-manager';
import { workflowAssistant } from '../tools/intelligent-workflow-assistant';
import { agentDashboard } from '../tools/ai-agent-dashboard';

/**
 * Display formatted output
 */
function displayResult(title: string, data: any, format: 'json' | 'table' | 'summary' = 'summary'): void {
  console.log(chalk.blue.bold(`\n📊 ${title}\n`));
  
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
      break;
    case 'table':
      console.table(data);
      break;
    case 'summary':
    default:
      if (typeof data === 'string') {
        console.log(data);
      } else if (Array.isArray(data)) {
        data.forEach((item, index) => {
          console.log(chalk.gray(`${index + 1}.`), item);
        });
      } else {
        Object.entries(data).forEach(([key, value]) => {
          console.log(chalk.cyan(`${key}:`), value);
        });
      }
  }
  console.log();
}

/**
 * Health check command
 */
program
  .command('health')
  .description('Check overall project and agent health')
  .option('-q, --quick', 'Quick health check only')
  .option('-f, --format <format>', 'Output format (json|table|summary)', 'summary')
  .action(async (options) => {
    console.log(chalk.green('🔍 Running AI Agent Health Check...\n'));

    if (options.quick) {
      const quickCheck = await agentToolkit.quickHealthCheck();
      displayResult('Quick Health Check', {
        'Status': quickCheck.status.toUpperCase(),
        'Score': `${quickCheck.score}/100`,
        'Top Issues': quickCheck.topIssues.join(', ') || 'None'
      }, options.format);
    } else {
      const [health, codeAnalysis] = await Promise.all([
        agentToolkit.getProjectHealth(),
        agentToolkit.analyzeCode()
      ]);

      const summary = {
        'Overall Score': `${health.overallScore}/100`,
        'Code Quality': `${health.codeQuality}/100`,
        'Documentation': `${health.documentation}/100`,
        'Testing': `${health.testing}/100`,
        'Security': `${health.security}/100`,
        'Performance': `${health.performance}/100`,
        'TypeScript Errors': codeAnalysis.typeScriptErrors,
        'Lint Warnings': codeAnalysis.lintWarnings,
        'Test Coverage': `${codeAnalysis.testCoverage.toFixed(1)}%`
      };

      displayResult('Project Health Report', summary, options.format);

      if (health.issues.length > 0) {
        console.log(chalk.yellow.bold('⚠️ Issues Found:\n'));
        health.issues.slice(0, 5).forEach((issue, index) => {
          const severityColor = issue.severity === 'critical' ? chalk.red : 
                                issue.severity === 'high' ? chalk.red :
                                issue.severity === 'medium' ? chalk.yellow : chalk.blue;
          console.log(`${index + 1}. ${severityColor(issue.severity.toUpperCase())} - ${issue.description}`);
        });
        console.log();
      }
    }
  });

/**
 * Context command
 */
program
  .command('context')
  .description('Analyze and manage workspace context')
  .option('-s, --summary', 'Show context summary only')
  .option('-r, --recommendations [intent]', 'Get smart recommendations')
  .option('-u, --update <files...>', 'Update working set with files')
  .action(async (options) => {
    if (options.update) {
      contextManager.updateWorkingSet(options.update);
      console.log(chalk.green(`✅ Updated working set with ${options.update.length} files`));
      return;
    }

    if (options.recommendations) {
      const intent = typeof options.recommendations === 'string' ? options.recommendations : '';
      const recommendations = contextManager.getSmartRecommendations(intent);
      
      displayResult('Smart Recommendations', {
        'Priority Actions': recommendations.priority.length,
        'Exploratory Options': recommendations.exploratory.length,
        'Maintenance Tasks': recommendations.maintenance.length
      });

      if (recommendations.priority.length > 0) {
        console.log(chalk.red.bold('🔥 Priority Recommendations:\n'));
        recommendations.priority.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec.description} (${rec.relevance}% relevance)`);
        });
        console.log();
      }
    }

    if (options.summary || (!options.recommendations && !options.update)) {
      const summary = contextManager.generateContextSummary();
      displayResult('Workspace Context', JSON.parse(summary));
    }
  });

/**
 * Workflow command
 */
program
  .command('workflow')
  .description('Execute and manage workflows')
  .option('-l, --list', 'List available workflows')
  .option('-e, --execute <pattern>', 'Execute workflow pattern')
  .option('-d, --dry-run', 'Dry run mode')
  .option('-r, --recommend [context]', 'Get workflow recommendations')
  .action(async (options) => {
    if (options.list) {
      const report = JSON.parse(workflowAssistant.generateWorkflowReport());
      displayResult('Available Workflow Patterns', report.availablePatterns.map((p: any) => 
        `${p.name} - ${p.description} (${p.frequency})`
      ));
      return;
    }

    if (options.execute) {
      console.log(chalk.blue(`🚀 Executing workflow: ${options.execute}`));
      const result = await workflowAssistant.executeWorkflow(options.execute, options.dryRun);
      
      console.log(chalk[result.success ? 'green' : 'red'](result.summary));
      
      if (result.results.length > 0) {
        console.log(chalk.blue.bold('\n📋 Execution Results:\n'));
        result.results.forEach((res, index) => {
          const status = res.success ? chalk.green('✅') : chalk.red('❌');
          console.log(`${status} ${res.action}`);
          if (!res.success || options.dryRun) {
            console.log(chalk.gray(`   ${res.output.substring(0, 100)}...`));
          }
        });
      }
      return;
    }

    if (options.recommend) {
      const context = typeof options.recommend === 'string' ? { userIntent: options.recommend } : {};
      const recommendations = await workflowAssistant.recommendWorkflows(context);
      
      displayResult('Workflow Recommendations', {
        'Immediate': recommendations.immediate.length,
        'Scheduled': recommendations.scheduled.length,
        'Optional': recommendations.optional.length
      });

      ['immediate', 'scheduled', 'optional'].forEach(category => {
        const items = recommendations[category as keyof typeof recommendations];
        if (items.length > 0) {
          console.log(chalk.blue.bold(`\n${category.toUpperCase()} Workflows:\n`));
          items.forEach((item: any, index: number) => {
            console.log(`${index + 1}. ${item.description} (${item.confidence}% confidence, ~${item.estimatedTime}min)`);
          });
        }
      });
    }
  });

/**
 * Dashboard command
 */
program
  .command('dashboard')
  .description('Generate and manage AI agent dashboard')
  .option('-s, --save', 'Save dashboard HTML file')
  .option('-o, --open', 'Open dashboard in browser')
  .option('-d, --data', 'Export dashboard data as JSON')
  .option('-t, --trends [days]', 'Show trends for specified days', '7')
  .action(async (options) => {
    if (options.data) {
      const data = await agentDashboard.exportDashboardData();
      console.log(data);
      return;
    }

    if (options.trends) {
      const days = parseInt(options.trends);
      const trends = agentDashboard.getMetricsTrends(days);
      
      if (trends) {
        displayResult(`Trends (Last ${days} days)`, {
          'Project Health': `${trends.projectHealth.change > 0 ? '+' : ''}${trends.projectHealth.change.toFixed(1)} (${trends.projectHealth.trend})`,
          'Code Quality': `${trends.codeQuality.change > 0 ? '+' : ''}${trends.codeQuality.change.toFixed(1)} (${trends.codeQuality.trend})`,
          'Test Coverage': `${trends.testCoverage.change > 0 ? '+' : ''}${trends.testCoverage.change.toFixed(1)}% (${trends.testCoverage.trend})`
        });
      } else {
        console.log(chalk.yellow('⚠️ Insufficient data for trend analysis'));
      }
      return;
    }

    if (options.save || options.open) {
      console.log(chalk.blue('📊 Generating dashboard...'));
      const dashboardPath = await agentDashboard.saveDashboard();
      console.log(chalk.green(`✅ Dashboard saved to: ${dashboardPath}`));

      if (options.open) {
        const { execSync } = require('child_process');
        try {
          const command = process.platform === 'darwin' ? 'open' : 
                         process.platform === 'win32' ? 'start' : 'xdg-open';
          execSync(`${command} ${dashboardPath}`);
          console.log(chalk.green('🌐 Opening dashboard in browser...'));
        } catch (error) {
          console.log(chalk.yellow(`⚠️ Could not open browser automatically. Please open: ${dashboardPath}`));
        }
      }
    } else {
      // Show current metrics
      const metrics = await agentDashboard.collectMetrics();
      displayResult('Current Dashboard Metrics', {
        'Project Health': `${metrics.projectHealth.overallScore}/100`,
        'Code Quality': `${metrics.projectHealth.codeQuality}/100`,
        'Test Coverage': `${metrics.codeAnalysis.testCoverage.toFixed(1)}%`,
        'Working Files': metrics.workspaceContext.workingFiles,
        'Focus Area': metrics.workspaceContext.focusArea,
        'Priority Recommendations': metrics.recommendations.priority
      });
    }
  });

/**
 * Analyze command
 */
program
  .command('analyze')
  .description('Perform comprehensive project analysis')
  .option('-c, --code', 'Analyze code quality and complexity')
  .option('-i, --insights', 'Generate project insights')
  .option('-s, --suggestions', 'Get AI agent suggestions')
  .option('--export <file>', 'Export analysis to file')
  .action(async (options) => {
    const results: any = {};

    if (options.code || Object.keys(options).length === 1) {
      console.log(chalk.blue('🔍 Analyzing code...'));
      results.codeAnalysis = await agentToolkit.analyzeCode();
    }

    if (options.insights || Object.keys(options).length === 1) {
      console.log(chalk.blue('💡 Generating insights...'));
      results.insights = await workflowAssistant.generateProjectInsights();
    }

    if (options.suggestions || Object.keys(options).length === 1) {
      console.log(chalk.blue('🤖 Getting AI suggestions...'));
      results.suggestions = agentToolkit.generateAgentSuggestions();
    }

    if (options.export) {
      const exportData = await agentToolkit.exportAnalysis();
      fs.writeFileSync(options.export, exportData);
      console.log(chalk.green(`✅ Analysis exported to: ${options.export}`));
    } else {
      if (results.codeAnalysis) {
        displayResult('Code Analysis', {
          'Complexity': results.codeAnalysis.complexity,
          'Maintainability': `${results.codeAnalysis.maintainability}/100`,
          'TypeScript Errors': results.codeAnalysis.typeScriptErrors,
          'Lint Warnings': results.codeAnalysis.lintWarnings,
          'Test Coverage': `${results.codeAnalysis.testCoverage.toFixed(1)}%`
        });
      }

      if (results.insights) {
        const topInsights = results.insights.slice(0, 5);
        console.log(chalk.blue.bold('🔍 Top Project Insights:\n'));
        topInsights.forEach((insight: any, index: number) => {
          const severityColor = insight.severity === 'critical' ? chalk.red :
                                insight.severity === 'error' ? chalk.red :
                                insight.severity === 'warning' ? chalk.yellow : chalk.blue;
          console.log(`${index + 1}. ${severityColor(insight.category.toUpperCase())} - ${insight.title}`);
          console.log(chalk.gray(`   ${insight.description} (Impact: ${insight.impact})`));
        });
        console.log();
      }

      if (results.suggestions) {
        displayResult('AI Agent Suggestions', results.suggestions);
      }
    }
  });

/**
 * Quick command for common operations
 */
program
  .command('quick')
  .description('Quick operations and status checks')
  .option('--status', 'Show quick status overview')
  .option('--validate', 'Run quick validation')
  .option('--clean', 'Clean up and optimize')
  .action(async (options) => {
    if (options.status) {
      const [health, context] = await Promise.all([
        agentToolkit.quickHealthCheck(),
        contextManager.generateContextSummary()
      ]);

      const contextData = JSON.parse(context);
      
      console.log(chalk.blue.bold('⚡ Quick Status Overview\n'));
      console.log(chalk.cyan('Health:'), `${health.status.toUpperCase()} (${health.score}/100)`);
      console.log(chalk.cyan('Working Files:'), contextData.workingSet || 0);
      console.log(chalk.cyan('Focus Area:'), contextData.focusArea || 'general');
      console.log(chalk.cyan('Priority Items:'), contextData.topRecommendations?.length || 0);
      
      if (health.topIssues.length > 0) {
        console.log(chalk.yellow('\n⚠️ Top Issues:'));
        health.topIssues.forEach((issue: string) => console.log(`  • ${issue}`));
      }
      console.log();
    }

    if (options.validate) {
      console.log(chalk.blue('🔍 Running quick validation...'));
      const result = await workflowAssistant.executeWorkflow('pre-commit-validation', true);
      console.log(chalk[result.success ? 'green' : 'yellow'](result.summary));
    }

    if (options.clean) {
      console.log(chalk.blue('🧹 Cleaning up...'));
      contextManager.clearCache();
      console.log(chalk.green('✅ Context cache cleared'));
      
      // Could add more cleanup operations here
      console.log(chalk.green('✅ Cleanup completed'));
    }
  });

// Set up program
program
  .name('ai-agent')
  .description('AI Agent CLI for Koveo Gestion development')
  .version('1.0.0');

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}