#!/usr/bin/env npx tsx

import chalk from 'chalk';
import { agentOrchestrator } from '../tools/enhanced-agent-orchestrator';
import { replitIntegration } from '../tools/replit-integration-enhancer';
import { agentToolkit } from '../tools/ai-agent-toolkit';

/**
 * AI Agent Toolkit Demonstration
 * Showcases the enhanced capabilities of the AI agent tooling system.
 */

/**
 *
 */
/**
 * RunDemo function.
 * @returns Function result.
 */
async function runDemo() {
  console.warn(chalk.blue.bold('🚀 AI Agent Toolkit Enhanced Demonstration\n'));

  try {
    // 1. Environment Analysis
    console.warn(chalk.cyan('1. 🔍 Analyzing Replit Environment...'));
    const environment = replitIntegration.getEnvironment();
    if (environment) {
      console.warn(chalk.green(`   ✅ Repl ID: ${environment.replId}`));
      console.warn(chalk.green(`   ✅ Capabilities: ${environment.capabilities.join(', ')}`));
      console.warn(chalk.green(`   ✅ Databases: ${environment.databases.length} connected`));
    } else {
      console.warn(chalk.yellow('   ⚠️ Replit environment not detected'));
    }

    // 2. Health Check
    console.warn(chalk.cyan('\n2. 🏥 Running Health Check...'));
    const health = await agentOrchestrator.performHealthCheck();
    console.warn(chalk.green(`   ✅ System uptime: ${Math.round(health.system.uptime)}s`));
    console.warn(
      chalk.green(
        `   ✅ Memory usage: ${Math.round(health.system.memory.heapUsed / 1024 / 1024)}MB`
      )
    );
    console.warn(chalk.green(`   ✅ Queue status: ${health.queue.pending} tasks pending`));

    // 3. Project Analysis
    console.warn(chalk.cyan('\n3. 📊 Analyzing Project Health...'));
    const projectHealth = await agentToolkit.getProjectHealth();
    console.warn(chalk.green(`   ✅ Overall Score: ${projectHealth.overallScore}/100`));
    console.warn(chalk.green(`   ✅ Code Quality: ${projectHealth.codeQuality}/100`));
    console.warn(chalk.green(`   ✅ Documentation: ${projectHealth.documentation}/100`));
    console.warn(chalk.green(`   ✅ Testing: ${projectHealth.testing}/100`));

    // 4. Environment Optimization
    console.warn(chalk.cyan('\n4. ⚡ Running Environment Optimization...'));
    const optimization = await replitIntegration.optimizeEnvironment();

    if (optimization.optimizations.length > 0) {
      console.warn(chalk.green('   ✅ Applied Optimizations:'));
      optimization.optimizations.forEach((opt) => {
        console.warn(chalk.green(`      • ${opt}`));
      });
    }

    if (optimization.recommendations.length > 0) {
      console.warn(chalk.yellow('   💡 Recommendations:'));
      optimization.recommendations.forEach((rec) => {
        console.warn(chalk.yellow(`      • ${rec}`));
      });
    }

    // 5. Task Execution Demo
    console.warn(chalk.cyan('\n5. 🎯 Demonstrating Task Execution...'));
    const taskId = agentOrchestrator.queueTask('echo "Hello from AI Agent!"', 1, { demo: true });
    console.warn(chalk.green(`   ✅ Task queued with ID: ${taskId}`));

    // 6. Dashboard Creation
    console.warn(chalk.cyan('\n6. 📊 Creating Monitoring Dashboard...'));
    const dashboardPath = replitIntegration.createMonitoringDashboard();
    console.warn(chalk.green(`   ✅ Dashboard created at: ${dashboardPath}`));

    // 7. Generate Report
    console.warn(chalk.cyan('\n7. 📋 Generating Environment Report...'));
    const report = replitIntegration.generateEnvironmentReport();
    console.warn(chalk.green('   ✅ Report generated successfully'));
    console.warn(chalk.gray('   Preview:'));
    console.warn(chalk.gray(report.split('\n').slice(0, 10).join('\n') + '...'));

    // Final Summary
    console.warn(chalk.blue.bold('\n🎉 Demo Complete! Summary:'));
    console.warn(
      chalk.white('   • Enhanced Agent Orchestrator initialized with real-time monitoring')
    );
    console.warn(chalk.white('   • Replit environment analyzed and optimized'));
    console.warn(chalk.white('   • Project health assessed with detailed metrics'));
    console.warn(chalk.white('   • Interactive monitoring dashboard created'));
    console.warn(chalk.white('   • Task execution system demonstrated'));
    console.warn(chalk.white('   • Comprehensive environment report generated'));

    console.warn(chalk.blue.bold('\n🔗 Next Steps:'));
    console.warn(
      chalk.cyan(
        '   • Start real-time monitoring: npx tsx scripts/enhanced-ai-agent-cli.ts start --watch --dashboard'
      )
    );
    console.warn(chalk.cyan('   • Open dashboard: open replit-dashboard.html'));
    console.warn(
      chalk.cyan(
        '   • Run interactive CLI: npx tsx scripts/enhanced-ai-agent-cli.ts task --interactive'
      )
    );
    console.warn(
      chalk.cyan(
        '   • Generate reports: npx tsx scripts/enhanced-ai-agent-cli.ts report --format html'
      )
    );

    console.warn(
      chalk.green.bold(
        '\n✨ AI Agent Toolkit Enhanced - Ready for Advanced Development Assistance!'
      )
    );
  } catch (_error) {
    console.error(chalk.red('❌ Demo failed:'), _error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.warn(chalk.yellow('\n🛑 Demo interrupted'));
  agentOrchestrator.cleanup();
  process.exit(0);
});

// Run demo
if (require.main === module) {
  runDemo().catch(console._error);
}

export { runDemo };
