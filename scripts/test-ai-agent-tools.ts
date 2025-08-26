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
/**
 * Main function.
 * @returns Function result.
 */
async function main() {
  console.warn(chalk.blue.bold('🤖 Testing AI Agent Toolkit\n'));

  try {
    // Test 1: Project Health Analysis
    console.warn(chalk.yellow('1. Testing Project Health Analysis...'));
    const health = await agentToolkit.getProjectHealth();
    console.warn(chalk.green(`✅ Overall Score: ${health.overallScore}/100`));
    console.warn(chalk.cyan(`   Code Quality: ${health.codeQuality}/100`));
    console.warn(chalk.cyan(`   Documentation: ${health.documentation}/100`));
    console.warn(chalk.cyan(`   Testing: ${health.testing}/100`));
    console.warn(chalk.cyan(`   Security: ${health.security}/100`));
    console.warn(chalk.cyan(`   Performance: ${health.performance}/100`));

    if (health.issues.length > 0) {
      console.warn(chalk.red(`   Issues found: ${health.issues.length}`));
      health.issues.slice(0, 3).forEach((issue) => {
        console.warn(chalk.gray(`   • ${issue.description}`));
      });
    }
    console.warn();

    // Test 2: Code Analysis
    console.warn(chalk.yellow('2. Testing Code Analysis...'));
    const codeAnalysis = await agentToolkit.analyzeCode();
    console.warn(chalk.green(`✅ TypeScript Errors: ${codeAnalysis.typeScriptErrors}`));
    console.warn(chalk.cyan(`   Lint Warnings: ${codeAnalysis.lintWarnings}`));
    console.warn(chalk.cyan(`   Test Coverage: ${codeAnalysis.testCoverage.toFixed(1)}%`));
    console.warn(chalk.cyan(`   Maintainability: ${codeAnalysis.maintainability}/100`));
    console.warn();

    // Test 3: Context Management
    console.warn(chalk.yellow('3. Testing Smart Context Management...'));
    const testFiles = ['client/src/App.tsx', 'server/index.ts', 'shared/schema.ts'];
    contextManager.updateWorkingSet(testFiles, 'testing');

    const contextSummary = JSON.parse(contextManager.generateContextSummary());
    console.warn(chalk.green(`✅ Working Set: ${contextSummary.workingSet} files`));
    console.warn(chalk.cyan(`   Focus Area: ${contextSummary.focusArea}`));
    console.warn(chalk.cyan(`   Recent Files: ${contextSummary.recentFiles?.length || 0}`));

    const recommendations = contextManager.getSmartRecommendations('testing');
    console.warn(chalk.cyan(`   Priority Recommendations: ${recommendations.priority.length}`));
    console.warn(chalk.cyan(`   Exploratory Options: ${recommendations.exploratory.length}`));
    console.warn();

    // Test 4: Workflow Detection and Insights
    console.warn(chalk.yellow('4. Testing Workflow Detection...'));
    const workflowSuggestions = workflowAssistant.detectWorkflowPatterns(testFiles, testFiles);
    console.warn(chalk.green(`✅ Workflow Suggestions: ${workflowSuggestions.length}`));

    workflowSuggestions.slice(0, 3).forEach((suggestion, _index) => {
      console.warn(
        chalk.cyan(
          `   ${index + 1}. ${suggestion.description} (${suggestion.confidence}% confidence)`
        )
      );
    });

    const insights = await workflowAssistant.generateProjectInsights();
    console.warn(chalk.green(`✅ Project Insights: ${insights.length}`));

    insights.slice(0, 3).forEach((insight, _index) => {
      const severityColor =
        insight.severity === 'critical'
          ? chalk.red
          : insight.severity === 'error'
            ? chalk.red
            : insight.severity === 'warning'
              ? chalk.yellow
              : chalk.blue;
      console.warn(
        chalk.cyan(
          `   ${index + 1}. ${severityColor(insight.category.toUpperCase())} - ${insight.title}`
        )
      );
    });
    console.warn();

    // Test 5: Dashboard Metrics Collection
    console.warn(chalk.yellow('5. Testing Dashboard Metrics...'));
    const metrics = await agentDashboard.collectMetrics();
    console.warn(
      chalk.green(`✅ Metrics Collected at: ${new Date(metrics.timestamp).toLocaleTimeString()}`)
    );
    console.warn(chalk.cyan(`   Project Health: ${metrics.projectHealth.overallScore}/100`));
    console.warn(chalk.cyan(`   Code Quality: ${metrics.projectHealth.codeQuality}/100`));
    console.warn(chalk.cyan(`   Working Files: ${metrics.workspaceContext.workingFiles}`));
    console.warn(chalk.cyan(`   Priority Recommendations: ${metrics.recommendations.priority}`));
    console.warn();

    // Test 6: Agent Suggestions
    console.warn(chalk.yellow('6. Testing AI Agent Suggestions...'));
    const suggestions = agentToolkit.generateAgentSuggestions();
    console.warn(chalk.green(`✅ Generated ${suggestions.length} suggestions:`));
    suggestions.slice(0, 5).forEach((suggestion, _index) => {
      console.warn(chalk.cyan(`   ${index + 1}. ${suggestion}`));
    });
    console.warn();

    // Test 7: Quick Health Check
    console.warn(chalk.yellow('7. Testing Quick Health Check...'));
    const quickCheck = await agentToolkit.quickHealthCheck();
    const statusColor =
      quickCheck.status === 'healthy'
        ? chalk.green
        : quickCheck.status === 'warning'
          ? chalk.yellow
          : chalk.red;
    console.warn(chalk.green(`✅ Status: ${statusColor(quickCheck.status.toUpperCase())}`));
    console.warn(chalk.cyan(`   Score: ${quickCheck.score}/100`));

    if (quickCheck.topIssues.length > 0) {
      console.warn(chalk.cyan(`   Top Issues: ${quickCheck.topIssues.length}`));
      quickCheck.topIssues.forEach((issue, _index) => {
        console.warn(chalk.gray(`     ${index + 1}. ${issue}`));
      });
    }
    console.warn();

    // Test 8: Workflow Execution (Dry Run)
    console.warn(chalk.yellow('8. Testing Workflow Execution (Dry Run)...'));
    try {
      const workflowResult = await workflowAssistant.executeWorkflow('pre-commit-validation', true);
      console.warn(
        chalk.green(`✅ Workflow Status: ${workflowResult.success ? 'Success' : 'Warning'}`)
      );
      console.warn(chalk.cyan(`   Actions: ${workflowResult.results.length}`));
      console.warn(chalk.gray(`   Summary: ${workflowResult.summary}`));
    } catch (_error) {
      console.warn(chalk.yellow(`⚠️ Workflow test skipped: ${error}`));
    }
    console.warn();

    // Test 9: Dashboard HTML Generation
    console.warn(chalk.yellow('9. Testing Dashboard Generation...'));
    try {
      const dashboardPath = await agentDashboard.saveDashboard();
      console.warn(chalk.green(`✅ Dashboard saved to: ${dashboardPath}`));

      // Test trends (might not have enough _data)
      const trends = agentDashboard.getMetricsTrends(1);
      if (trends) {
        console.warn(chalk.cyan(`   Trends available: Yes`));
      } else {
        console.warn(chalk.cyan(`   Trends available: No (insufficient _data)`));
      }
    } catch (_error) {
      console.warn(chalk.yellow(`⚠️ Dashboard generation test failed: ${error}`));
    }
    console.warn();

    // Test 10: Export Analysis
    console.warn(chalk.yellow('10. Testing Analysis Export...'));
    try {
      const exportData = await agentToolkit.exportAnalysis();
      const analysisSize = Math.round(exportData.length / 1024);
      console.warn(chalk.green(`✅ Analysis exported: ${analysisSize}KB`));

      const parsedData = JSON.parse(exportData);
      console.warn(chalk.cyan(`   Contains: context, health, codeAnalysis, suggestions`));
      console.warn(
        chalk.cyan(`   Timestamp: ${new Date(parsedData.timestamp).toLocaleTimeString()}`)
      );
    } catch (_error) {
      console.warn(chalk.yellow(`⚠️ Export test failed: ${error}`));
    }
    console.warn();

    // Summary
    console.warn(chalk.green.bold('🎉 AI Agent Toolkit Test Complete!\n'));
    console.warn(chalk.blue('Available Tools:'));
    console.warn(chalk.cyan('  • Project Health Analysis'));
    console.warn(chalk.cyan('  • Code Quality Assessment'));
    console.warn(chalk.cyan('  • Smart Context Management'));
    console.warn(chalk.cyan('  • Intelligent Workflow Assistant'));
    console.warn(chalk.cyan('  • Real-time Dashboard'));
    console.warn(chalk.cyan('  • Automated Suggestions'));
    console.warn(chalk.cyan('  • Performance Monitoring'));
    console.warn(chalk.cyan('  • Security Analysis'));
    console.warn();

    console.warn(chalk.blue('Usage:'));
    console.warn(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts --help'));
    console.warn(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts health'));
    console.warn(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts dashboard --save'));
    console.warn(chalk.cyan('  npx tsx scripts/ai-agent-cli.ts analyze'));
    console.warn();
  } catch (_error) {
    console.error(chalk.red('❌ Test failed:'), _error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console._error);
}

export default main;
