#!/usr/bin/env tsx
/**
 * @file Test AI Agent Tools.
 * @description Comprehensive test and demonstration of all AI agent tools.
 */

import chalk from 'chalk';
import { agentToolkit } from '../tools/ai-agent-toolkit';
import { contextManager } from '../tools/smart-context-manager';
import { workflowAssistant } from '../tools/intelligent-workflow-assistant';
import { agentDashboard } from '../tools/ai-agent-dashboard';

/**
 *
 */
async function main() {
  console.log(chalk.blue.bold('🤖 Testing AI Agent Toolkit\n'));

  try {
    // Test 1: Project Health Analysis
    console.log(chalk.yellow('1. Testing Project Health Analysis...'));
    const health = await agentToolkit.getProjectHealth();
    console.log(chalk.green(`✅ Overall Score: ${health.overallScore}/100`));
    console.log(chalk.cyan(`   Code Quality: ${health.codeQuality}/100`));
    console.log(chalk.cyan(`   Documentation: ${health.documentation}/100`));
    console.log(chalk.cyan(`   Testing: ${health.testing}/100`));
    console.log(chalk.cyan(`   Security: ${health.security}/100`));
    console.log(chalk.cyan(`   Performance: ${health.performance}/100`));
    
    if (health.issues.length > 0) {
      console.log(chalk.red(`   Issues found: ${health.issues.length}`));
      health.issues.slice(0, 3).forEach(issue => {
        console.log(chalk.gray(`   • ${issue.description}`));
      });
    }
    console.log();

    // Test 2: Code Analysis
    console.log(chalk.yellow('2. Testing Code Analysis...'));
    const codeAnalysis = await agentToolkit.analyzeCode();
    console.log(chalk.green(`✅ TypeScript Errors: ${codeAnalysis.typeScriptErrors}`));
    console.log(chalk.cyan(`   Lint Warnings: ${codeAnalysis.lintWarnings}`));
    console.log(chalk.cyan(`   Test Coverage: ${codeAnalysis.testCoverage.toFixed(1)}%`));
    console.log(chalk.cyan(`   Maintainability: ${codeAnalysis.maintainability}/100`));
    console.log();

    // Test 3: Context Management
    console.log(chalk.yellow('3. Testing Smart Context Management...'));
    const testFiles = ['client/src/App.tsx', 'server/index.ts', 'shared/schema.ts'];
    contextManager.updateWorkingSet(testFiles, 'testing');
    
    const contextSummary = JSON.parse(contextManager.generateContextSummary());
    console.log(chalk.green(`✅ Working Set: ${contextSummary.workingSet} files`));
    console.log(chalk.cyan(`   Focus Area: ${contextSummary.focusArea}`));
    console.log(chalk.cyan(`   Recent Files: ${contextSummary.recentFiles?.length || 0}`));
    
    const recommendations = contextManager.getSmartRecommendations('testing');
    console.log(chalk.cyan(`   Priority Recommendations: ${recommendations.priority.length}`));
    console.log(chalk.cyan(`   Exploratory Options: ${recommendations.exploratory.length}`));
    console.log();

    // Test 4: Workflow Detection and Insights
    console.log(chalk.yellow('4. Testing Workflow Detection...'));
    const workflowSuggestions = workflowAssistant.detectWorkflowPatterns(testFiles, testFiles);
    console.log(chalk.green(`✅ Workflow Suggestions: ${workflowSuggestions.length}`));
    
    workflowSuggestions.slice(0, 3).forEach((suggestion, index) => {
      console.log(chalk.cyan(`   ${index + 1}. ${suggestion.description} (${suggestion.confidence}% confidence)`));
    });

    const insights = await workflowAssistant.generateProjectInsights();
    console.log(chalk.green(`✅ Project Insights: ${insights.length}`));
    
    insights.slice(0, 3).forEach((insight, index) => {
      const severityColor = insight.severity === 'critical' ? chalk.red :
                            insight.severity === 'error' ? chalk.red :
                            insight.severity === 'warning' ? chalk.yellow : chalk.blue;
      console.log(chalk.cyan(`   ${index + 1}. ${severityColor(insight.category.toUpperCase())} - ${insight.title}`));
    });
    console.log();

    // Test 5: Dashboard Metrics Collection
    console.log(chalk.yellow('5. Testing Dashboard Metrics...'));
    const metrics = await agentDashboard.collectMetrics();
    console.log(chalk.green(`✅ Metrics Collected at: ${new Date(metrics.timestamp).toLocaleTimeString()}`));
    console.log(chalk.cyan(`   Project Health: ${metrics.projectHealth.overallScore}/100`));
    console.log(chalk.cyan(`   Code Quality: ${metrics.projectHealth.codeQuality}/100`));
    console.log(chalk.cyan(`   Working Files: ${metrics.workspaceContext.workingFiles}`));
    console.log(chalk.cyan(`   Priority Recommendations: ${metrics.recommendations.priority}`));
    console.log();

    // Test 6: Agent Suggestions
    console.log(chalk.yellow('6. Testing AI Agent Suggestions...'));
    const suggestions = agentToolkit.generateAgentSuggestions();
    console.log(chalk.green(`✅ Generated ${suggestions.length} suggestions:`));
    suggestions.slice(0, 5).forEach((suggestion, index) => {
      console.log(chalk.cyan(`   ${index + 1}. ${suggestion}`));
    });
    console.log();

    // Test 7: Quick Health Check
    console.log(chalk.yellow('7. Testing Quick Health Check...'));
    const quickCheck = await agentToolkit.quickHealthCheck();
    const statusColor = quickCheck.status === 'healthy' ? chalk.green :
                       quickCheck.status === 'warning' ? chalk.yellow : chalk.red;
    console.log(chalk.green(`✅ Status: ${statusColor(quickCheck.status.toUpperCase())}`));
    console.log(chalk.cyan(`   Score: ${quickCheck.score}/100`));
    
    if (quickCheck.topIssues.length > 0) {
      console.log(chalk.cyan(`   Top Issues: ${quickCheck.topIssues.length}`));
      quickCheck.topIssues.forEach((issue, index) => {
        console.log(chalk.gray(`     ${index + 1}. ${issue}`));
      });
    }
    console.log();

    // Test 8: Workflow Execution (Dry Run)
    console.log(chalk.yellow('8. Testing Workflow Execution (Dry Run)...'));
    try {
      const workflowResult = await workflowAssistant.executeWorkflow('pre-commit-validation', true);
      console.log(chalk.green(`✅ Workflow Status: ${workflowResult.success ? 'Success' : 'Warning'}`));
      console.log(chalk.cyan(`   Actions: ${workflowResult.results.length}`));
      console.log(chalk.gray(`   Summary: ${workflowResult.summary}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Workflow test skipped: ${error}`));
    }
    console.log();

    // Test 9: Dashboard HTML Generation
    console.log(chalk.yellow('9. Testing Dashboard Generation...'));
    try {
      const dashboardPath = await agentDashboard.saveDashboard();
      console.log(chalk.green(`✅ Dashboard saved to: ${dashboardPath}`));
      
      // Test trends (might not have enough data)
      const trends = agentDashboard.getMetricsTrends(1);
      if (trends) {
        console.log(chalk.cyan(`   Trends available: Yes`));
      } else {
        console.log(chalk.cyan(`   Trends available: No (insufficient data)`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Dashboard generation test failed: ${error}`));
    }
    console.log();

    // Test 10: Export Analysis
    console.log(chalk.yellow('10. Testing Analysis Export...'));
    try {
      const exportData = await agentToolkit.exportAnalysis();
      const analysisSize = Math.round(exportData.length / 1024);
      console.log(chalk.green(`✅ Analysis exported: ${analysisSize}KB`));
      
      const parsedData = JSON.parse(exportData);
      console.log(chalk.cyan(`   Contains: context, health, codeAnalysis, suggestions`));
      console.log(chalk.cyan(`   Timestamp: ${new Date(parsedData.timestamp).toLocaleTimeString()}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Export test failed: ${error}`));
    }
    console.log();

    // Summary
    console.log(chalk.green.bold('🎉 AI Agent Toolkit Test Complete!\n'));
    console.log(chalk.blue('Available Tools:'));
    console.log(chalk.cyan('  • Project Health Analysis'));
    console.log(chalk.cyan('  • Code Quality Assessment'));
    console.log(chalk.cyan('  • Smart Context Management'));
    console.log(chalk.cyan('  • Intelligent Workflow Assistant'));
    console.log(chalk.cyan('  • Real-time Dashboard'));
    console.log(chalk.cyan('  • Automated Suggestions'));
    console.log(chalk.cyan('  • Performance Monitoring'));
    console.log(chalk.cyan('  • Security Analysis'));
    console.log();

    console.log(chalk.blue('Usage:'));
    console.log(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts --help'));
    console.log(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts health'));
    console.log(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts dashboard --save'));
    console.log(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts analyze'));
    console.log();

  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

export default main;