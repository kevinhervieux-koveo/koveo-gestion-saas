#!/usr/bin/env npx tsx

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { agentOrchestrator } from '../tools/enhanced-agent-orchestrator';
import { replitIntegration } from '../tools/replit-integration-enhancer';
import { agentToolkit } from '../tools/ai-agent-toolkit';
import { contextManager } from '../tools/smart-context-manager';

/**
 * Enhanced AI Agent CLI - Advanced tooling for Replit development.
 */

program
  .name('ai-agent')
  .description('Enhanced AI Agent CLI for Koveo Gestion development on Replit')
  .version('2.0.0');

/**
 * Start the enhanced agent orchestrator.
 */
program
  .command('start')
  .description('Start the enhanced AI agent orchestrator with real-time monitoring')
  .option('-p, --port <port>', 'WebSocket port for real-time monitoring', '8080')
  .option('-w, --watch', 'Enable intelligent file watching')
  .option('-d, --dashboard', 'Create monitoring dashboard')
  .action(async (options) => {
    console.log(chalk.blue.bold('🚀 Starting Enhanced AI Agent Orchestrator...\n'));
    
    const spinner = ora('Initializing agent orchestrator...').start();
    
    try {
      // Initialize the orchestrator
      await agentOrchestrator.performHealthCheck();
      spinner.succeed('Agent orchestrator initialized');
      
      // Enable file watching if requested
      if (options.watch) {
        agentOrchestrator.startIntelligentWatching();
        console.log(chalk.green('✅ Intelligent file watching enabled'));
      }
      
      // Create monitoring dashboard if requested
      if (options.dashboard) {
        const dashboardPath = replitIntegration.createMonitoringDashboard();
        console.log(chalk.green(`✅ Monitoring dashboard created at: ${dashboardPath}`));
      }
      
      console.log(chalk.yellow(`📡 WebSocket server running on port ${options.port}`));
      console.log(chalk.cyan('🔍 Real-time monitoring active'));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Shutting down agent orchestrator...'));
        agentOrchestrator.cleanup();
        process.exit(0);
      });
      
      // Keep the process running
      process.stdin.resume();
      
    } catch (error) {
      spinner.fail('Failed to start agent orchestrator');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Optimize Replit environment.
 */
program
  .command('optimize')
  .description('Optimize Replit environment for AI-assisted development')
  .option('--skip-build', 'Skip build optimization')
  .option('--skip-memory', 'Skip memory optimization')
  .action(async (options) => {
    console.log(chalk.blue.bold('⚡ Optimizing Replit Environment...\n'));
    
    const spinner = ora('Running environment optimization...').start();
    
    try {
      const result = await replitIntegration.optimizeEnvironment();
      spinner.succeed('Environment optimization completed');
      
      if (result.optimizations.length > 0) {
        console.log(chalk.green.bold('\n✅ Applied Optimizations:'));
        result.optimizations.forEach(opt => {
          console.log(chalk.green(`  • ${opt}`));
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log(chalk.yellow.bold('\n💡 Recommendations:'));
        result.recommendations.forEach(rec => {
          console.log(chalk.yellow(`  • ${rec}`));
        });
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.red.bold('\n⚠️ Warnings:'));
        result.warnings.forEach(warn => {
          console.log(chalk.red(`  • ${warn}`));
        });
      }
      
    } catch (error) {
      spinner.fail('Environment optimization failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Generate comprehensive environment report.
 */
program
  .command('report')
  .description('Generate comprehensive development environment report')
  .option('-f, --format <format>', 'Output format (text|json|html)', 'text')
  .option('-o, --output <file>', 'Save report to file')
  .action(async (options) => {
    console.log(chalk.blue.bold('📊 Generating Environment Report...\n'));
    
    const spinner = ora('Collecting environment data...').start();
    
    try {
      const [
        replitEnv,
        healthCheck,
        deploymentInfo,
        contextData
      ] = await Promise.all([
        replitIntegration.getEnvironment(),
        agentOrchestrator.performHealthCheck(),
        replitIntegration.getDeploymentInfo(),
        Promise.resolve({})
      ]);
      
      spinner.succeed('Environment data collected');
      
      let report: string;
      
      switch (options.format) {
        case 'json':
          report = JSON.stringify({
            timestamp: new Date().toISOString(),
            replit: replitEnv,
            health: healthCheck,
            deployment: deploymentInfo,
            context: contextData
          }, null, 2);
          break;
          
        case 'html':
          report = generateHTMLReport({
            replit: replitEnv,
            health: healthCheck,
            deployment: deploymentInfo,
            context: contextData
          });
          break;
          
        case 'text':
        default:
          report = generateTextReport({
            replit: replitEnv,
            health: healthCheck,
            deployment: deploymentInfo,
            context: contextData
          });
          break;
      }
      
      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(chalk.green(`✅ Report saved to: ${options.output}`));
      } else {
        console.log(report);
      }
      
    } catch (error) {
      spinner.fail('Failed to generate report');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Execute AI agent tasks interactively.
 */
program
  .command('task')
  .description('Execute AI agent tasks with interactive selection')
  .argument('[task]', 'Task to execute')
  .option('-p, --priority <priority>', 'Task priority (1-5)', '1')
  .option('-i, --interactive', 'Interactive task selection')
  .action(async (task, options) => {
    if (!task && !options.interactive) {
      console.error(chalk.red('Error: Specify a task or use --interactive flag'));
      process.exit(1);
    }
    
    if (options.interactive) {
      task = await interactiveTaskSelection();
    }
    
    console.log(chalk.blue.bold(`🎯 Executing Task: ${task}\n`));
    
    const spinner = ora('Queueing task...').start();
    
    try {
      const taskId = agentOrchestrator.queueTask(
        task,
        parseInt(options.priority),
        { source: 'cli' }
      );
      
      spinner.succeed(`Task queued with ID: ${taskId}`);
      console.log(chalk.green(`✅ Task "${task}" has been queued for execution`));
      console.log(chalk.gray(`Monitor progress at: http://localhost:8080`));
      
    } catch (error) {
      spinner.fail('Failed to queue task');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

/**
 * Smart context management.
 */
program
  .command('context')
  .description('Manage smart development context')
  .option('-a, --analyze', 'Analyze current workspace context')
  .option('-s, --suggest', 'Get context-aware suggestions')
  .option('-u, --update <files...>', 'Update working set with files')
  .option('-r, --reset', 'Reset context state')
  .action(async (options) => {
    if (options.reset) {
      contextManager.resetContext();
      console.log(chalk.green('✅ Context state reset'));
      return;
    }
    
    if (options.update) {
      contextManager.updateWorkingSet(options.update);
      console.log(chalk.green(`✅ Working set updated with ${options.update.length} files`));
      return;
    }
    
    if (options.analyze) {
      console.log(chalk.blue.bold('🔍 Analyzing Workspace Context...\n'));
      
      const spinner = ora('Analyzing workspace...').start();
      
      try {
        const analysis = await contextManager.analyzeWorkspace();
        spinner.succeed('Workspace analysis completed');
        
        console.log(chalk.cyan.bold('📊 Context Analysis:'));
        console.log(`Files analyzed: ${analysis.filesAnalyzed}`);
        console.log(`Working set size: ${analysis.workingSetSize}`);
        console.log(`Focus area: ${analysis.focusArea}`);
        console.log(`Complexity score: ${analysis.complexityScore}/100`);
        
        if (analysis.hotspots.length > 0) {
          console.log(chalk.yellow.bold('\n🔥 Complexity Hotspots:'));
          analysis.hotspots.forEach(hotspot => {
            console.log(chalk.yellow(`  • ${hotspot.file} (${hotspot.complexity})`));
          });
        }
        
      } catch (error) {
        spinner.fail('Workspace analysis failed');
        console.error(chalk.red('Error:'), error);
      }
    }
    
    if (options.suggest) {
      console.log(chalk.blue.bold('💡 Getting Context-Aware Suggestions...\n'));
      
      const spinner = ora('Generating suggestions...').start();
      
      try {
        const suggestions = await contextManager.getSmartRecommendations();
        spinner.succeed('Smart suggestions generated');
        
        suggestions.forEach((suggestion, index) => {
          console.log(chalk.green(`${index + 1}. ${suggestion.description}`));
          console.log(chalk.gray(`   Confidence: ${suggestion.confidence}%`));
          console.log(chalk.gray(`   Impact: ${suggestion.relevance}/10\n`));
        });
        
      } catch (error) {
        spinner.fail('Failed to generate suggestions');
        console.error(chalk.red('Error:'), error);
      }
    }
  });

/**
 * Development workflow automation.
 */
program
  .command('workflow')
  .description('Automated development workflow execution')
  .option('-t, --type <type>', 'Workflow type (pre-commit|security|quality|deploy)', 'quality')
  .option('-a, --auto', 'Run all applicable workflows automatically')
  .action(async (options) => {
    console.log(chalk.blue.bold(`🔄 Executing ${options.type} Workflow...\n`));
    
    const workflows = {
      'pre-commit': [
        'npm run lint:check',
        'npm run type-check',
        'npm test',
      ],
      'security': [
        'npm audit',
        'npm run security:check',
      ],
      'quality': [
        'npm run lint:check',
        'npm run format:check',
        'npm test -- --coverage',
        'npm run quality:check'
      ],
      'deploy': [
        'npm run lint:check',
        'npm test',
        'npm run build',
        'npm run validate:deploy'
      ]
    };
    
    const tasksToRun = workflows[options.type as keyof typeof workflows] || [];
    
    if (tasksToRun.length === 0) {
      console.error(chalk.red(`Error: Unknown workflow type: ${options.type}`));
      process.exit(1);
    }
    
    console.log(chalk.gray(`Workflow includes ${tasksToRun.length} tasks:`));
    tasksToRun.forEach((task, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${task}`));
    });
    console.log();
    
    for (const task of tasksToRun) {
      const taskId = agentOrchestrator.queueTask(task, 3, { 
        workflow: options.type,
        source: 'workflow_cli'
      });
      console.log(chalk.green(`✅ Queued: ${task} (ID: ${taskId})`));
    }
    
    console.log(chalk.cyan('\n📡 Monitor workflow execution at: http://localhost:8080'));
  });

/**
 * Interactive task selection.
 */
async function interactiveTaskSelection(): Promise<string> {
  const inquirer = (await import('inquirer')).default;
  
  const commonTasks = [
    'npm run lint:check',
    'npm run lint:fix',
    'npm test',
    'npm test -- --coverage',
    'npm run build',
    'npm run format',
    'npm run type-check',
    'npm run quality:check',
    'npm audit',
    'npm run db:push'
  ];
  
  const { selectedTask } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTask',
      message: 'Select a task to execute:',
      choices: [
        ...commonTasks,
        new inquirer.Separator(),
        'Custom command...'
      ]
    }
  ]);
  
  if (selectedTask === 'Custom command...') {
    const { customTask } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customTask',
        message: 'Enter custom command:',
        validate: (input: string) => input.trim().length > 0
      }
    ]);
    return customTask;
  }
  
  return selectedTask;
}

/**
 * Generate HTML report.
 * @param data
 */
function generateHTMLReport(data: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koveo Gestion - Development Environment Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; }
        .section { margin-bottom: 30px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .success { border-left: 4px solid #28a745; }
        .warning { border-left: 4px solid #ffc107; }
        .error { border-left: 4px solid #dc3545; }
        pre { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 6px; overflow-x: auto; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric { text-align: center; padding: 15px; background: white; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 24px; font-weight: bold; color: #2d3748; }
        .metric-label { font-size: 12px; color: #718096; text-transform: uppercase; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Koveo Gestion Development Environment Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    
    <div class="section">
        <h2>🔧 Environment Status</h2>
        <div class="card success">
            <h3>Replit Environment</h3>
            <p><strong>Repl ID:</strong> ${data.replit?.replId || 'Unknown'}</p>
            <p><strong>Status:</strong> ${data.replit?.isHosted ? 'Hosted' : 'Local'}</p>
            <p><strong>Mode:</strong> ${data.replit?.isDevelopment ? 'Development' : 'Production'}</p>
        </div>
    </div>
    
    <div class="section">
        <h2>📊 Metrics</h2>
        <div class="grid">
            <div class="metric">
                <div class="metric-value">${data.health?.system?.uptime || 0}s</div>
                <div class="metric-label">Uptime</div>
            </div>
            <div class="metric">
                <div class="metric-value">${Math.round(data.health?.system?.memory?.heapUsed / 1024 / 1024) || 0}MB</div>
                <div class="metric-label">Memory Usage</div>
            </div>
            <div class="metric">
                <div class="metric-value">${data.deployment?.status || 'Unknown'}</div>
                <div class="metric-label">Deployment</div>
            </div>
        </div>
    </div>
    
    <div class="section">
        <h2>📋 Environment Details</h2>
        <div class="card">
            <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate text report.
 * @param data
 */
function generateTextReport(data: any): string {
  return `
# Koveo Gestion Development Environment Report
Generated: ${new Date().toISOString()}

## 🔧 Environment Overview
- Repl ID: ${data.replit?.replId || 'Unknown'}
- Status: ${data.replit?.isHosted ? 'Hosted on Replit' : 'Local Development'}
- Mode: ${data.replit?.isDevelopment ? 'Development' : 'Production'}
- URL: ${data.replit?.replUrl || 'Not available'}

## 📊 System Metrics
- Uptime: ${data.health?.system?.uptime || 0} seconds
- Memory Usage: ${Math.round(data.health?.system?.memory?.heapUsed / 1024 / 1024) || 0}MB
- Node Version: ${data.health?.system?.nodeVersion || 'Unknown'}
- Platform: ${data.health?.system?.platform || 'Unknown'}

## 🚀 Deployment Status
- Status: ${data.deployment?.status || 'Unknown'}
- URL: ${data.deployment?.url || 'Not deployed'}
- Last Deployment: ${data.deployment?.lastDeployment || 'Never'}

## 📦 Project Configuration
- Package Manager: npm
- Scripts Available: ${data.health?.project?.scripts?.length || 0}
- Dependencies: ${data.health?.project?.dependencies?.length || 0}
- Dev Dependencies: ${data.health?.project?.devDependencies?.length || 0}

## 🔍 Context Analysis
- Working Files: ${data.context?.workingFiles?.length || 0}
- Focus Area: ${data.context?.focusArea || 'General'}
- Recent Activity: ${data.context?.recentActivity?.length || 0} events

## ✅ Capabilities
${data.replit?.capabilities?.map((cap: string) => `- ${cap}`) || []}

## 🔐 Secrets Status
${Object.entries(data.replit?.secrets || {}).map(([key, exists]) => `- ${exists ? '✅' : '❌'} ${key}`).join('\n')}

---
Report generated by Enhanced AI Agent CLI v2.0.0
`;
}

// Parse command line arguments
program.parse();