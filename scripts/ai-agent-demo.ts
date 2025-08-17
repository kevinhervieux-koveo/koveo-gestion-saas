#!/usr/bin/env npx tsx

import chalk from 'chalk';
import { agentOrchestrator } from '../tools/enhanced-agent-orchestrator';
import { replitIntegration } from '../tools/replit-integration-enhancer';
import { agentToolkit } from '../tools/ai-agent-toolkit';

/**
 * AI Agent Toolkit Demonstration
 * Showcases the enhanced capabilities of the AI agent tooling system
 */

async function runDemo() {
  console.log(chalk.blue.bold('🚀 AI Agent Toolkit Enhanced Demonstration\n'));
  
  try {
    // 1. Environment Analysis
    console.log(chalk.cyan('1. 🔍 Analyzing Replit Environment...'));
    const environment = replitIntegration.getEnvironment();
    if (environment) {
      console.log(chalk.green(`   ✅ Repl ID: ${environment.replId}`));
      console.log(chalk.green(`   ✅ Capabilities: ${environment.capabilities.join(', ')}`));
      console.log(chalk.green(`   ✅ Databases: ${environment.databases.length} connected`));
    } else {
      console.log(chalk.yellow('   ⚠️ Replit environment not detected'));
    }
    
    // 2. Health Check
    console.log(chalk.cyan('\n2. 🏥 Running Health Check...'));
    const health = await agentOrchestrator.performHealthCheck();
    console.log(chalk.green(`   ✅ System uptime: ${Math.round(health.system.uptime)}s`));
    console.log(chalk.green(`   ✅ Memory usage: ${Math.round(health.system.memory.heapUsed / 1024 / 1024)}MB`));
    console.log(chalk.green(`   ✅ Queue status: ${health.queue.pending} tasks pending`));
    
    // 3. Project Analysis
    console.log(chalk.cyan('\n3. 📊 Analyzing Project Health...'));
    const projectHealth = await agentToolkit.getProjectHealth();
    console.log(chalk.green(`   ✅ Overall Score: ${projectHealth.overallScore}/100`));
    console.log(chalk.green(`   ✅ Code Quality: ${projectHealth.codeQuality}/100`));
    console.log(chalk.green(`   ✅ Documentation: ${projectHealth.documentation}/100`));
    console.log(chalk.green(`   ✅ Testing: ${projectHealth.testing}/100`));
    
    // 4. Environment Optimization
    console.log(chalk.cyan('\n4. ⚡ Running Environment Optimization...'));
    const optimization = await replitIntegration.optimizeEnvironment();
    
    if (optimization.optimizations.length > 0) {
      console.log(chalk.green('   ✅ Applied Optimizations:'));
      optimization.optimizations.forEach(opt => {
        console.log(chalk.green(`      • ${opt}`));
      });
    }
    
    if (optimization.recommendations.length > 0) {
      console.log(chalk.yellow('   💡 Recommendations:'));
      optimization.recommendations.forEach(rec => {
        console.log(chalk.yellow(`      • ${rec}`));
      });
    }
    
    // 5. Task Execution Demo
    console.log(chalk.cyan('\n5. 🎯 Demonstrating Task Execution...'));
    const taskId = agentOrchestrator.queueTask('echo "Hello from AI Agent!"', 1, { demo: true });
    console.log(chalk.green(`   ✅ Task queued with ID: ${taskId}`));
    
    // 6. Dashboard Creation
    console.log(chalk.cyan('\n6. 📊 Creating Monitoring Dashboard...'));
    const dashboardPath = replitIntegration.createMonitoringDashboard();
    console.log(chalk.green(`   ✅ Dashboard created at: ${dashboardPath}`));
    
    // 7. Generate Report
    console.log(chalk.cyan('\n7. 📋 Generating Environment Report...'));
    const report = replitIntegration.generateEnvironmentReport();
    console.log(chalk.green('   ✅ Report generated successfully'));
    console.log(chalk.gray('   Preview:'));
    console.log(chalk.gray(report.split('\n').slice(0, 10).join('\n') + '...'));
    
    // Final Summary
    console.log(chalk.blue.bold('\n🎉 Demo Complete! Summary:'));
    console.log(chalk.white('   • Enhanced Agent Orchestrator initialized with real-time monitoring'));
    console.log(chalk.white('   • Replit environment analyzed and optimized'));
    console.log(chalk.white('   • Project health assessed with detailed metrics'));
    console.log(chalk.white('   • Interactive monitoring dashboard created'));
    console.log(chalk.white('   • Task execution system demonstrated'));
    console.log(chalk.white('   • Comprehensive environment report generated'));
    
    console.log(chalk.blue.bold('\n🔗 Next Steps:'));
    console.log(chalk.cyan('   • Start real-time monitoring: npx tsx scripts/enhanced-ai-agent-cli.ts start --watch --dashboard'));
    console.log(chalk.cyan('   • Open dashboard: open replit-dashboard.html'));
    console.log(chalk.cyan('   • Run interactive CLI: npx tsx scripts/enhanced-ai-agent-cli.ts task --interactive'));
    console.log(chalk.cyan('   • Generate reports: npx tsx scripts/enhanced-ai-agent-cli.ts report --format html'));
    
    console.log(chalk.green.bold('\n✨ AI Agent Toolkit Enhanced - Ready for Advanced Development Assistance!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Demo interrupted'));
  agentOrchestrator.cleanup();
  process.exit(0);
});

// Run demo
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };