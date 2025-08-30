# AI Agent Tools

## Overview

This directory contains a comprehensive suite of tools designed to enhance the Replit AI agent's capabilities for development workflow automation, intelligent assistance, and project optimization.

## Tools Included

### 1. AI Agent Toolkit (`ai-agent-toolkit.ts`)

**Core functionality for AI agent operations**

Features:

- **Project Health Analysis**: Comprehensive scoring across code quality, documentation, testing, security, and performance
- **Code Analysis**: TypeScript error detection, lint warnings, test coverage, and maintainability scoring
- **Quick Health Checks**: Fast status assessments for immediate feedback
- **Smart Suggestions**: Context-aware recommendations for development improvements
- **Export Capabilities**: Full analysis export for reporting and tracking

Key Methods:

```typescript
const health = await agentToolkit.getProjectHealth();
const codeAnalysis = await agentToolkit.analyzeCode();
const quickCheck = await agentToolkit.quickHealthCheck();
const suggestions = agentToolkit.generateAgentSuggestions();
```

### 2. Smart Context Manager (`smart-context-manager.ts`)

**Intelligent workspace context management**

Features:

- **File Context Analysis**: Deep analysis of file relationships, dependencies, and importance
- **Working Set Management**: Smart tracking of current development focus
- **Related File Detection**: Automatic discovery of connected files
- **Smart Recommendations**: Context-aware suggestions for next actions
- **Focus Area Tracking**: Understanding of current development area

Key Methods:

```typescript
contextManager.updateWorkingSet(files, 'feature-development');
const recommendations = contextManager.getSmartRecommendations('testing');
const relatedFiles = contextManager.getRelatedFiles(currentFiles);
const summary = contextManager.generateContextSummary();
```

### 3. Intelligent Workflow Assistant (`intelligent-workflow-assistant.ts`)

**Advanced workflow automation and pattern detection**

Features:

- **Pattern Detection**: Automatic detection of development workflow patterns
- **Workflow Execution**: Automated execution of common development tasks
- **Project Insights**: AI-powered analysis of project architecture and quality
- **Smart Recommendations**: Workflow suggestions based on context and patterns
- **Validation Workflows**: Pre-commit checks, security audits, and quality validation

Key Methods:

```typescript
const suggestions = workflowAssistant.detectWorkflowPatterns(files, changes);
const result = await workflowAssistant.executeWorkflow('pre-commit-validation');
const insights = await workflowAssistant.generateProjectInsights();
const recommendations = await workflowAssistant.recommendWorkflows(context);
```

### 4. AI Agent Dashboard (`ai-agent-dashboard.ts`)

**Comprehensive monitoring and visualization**

Features:

- **Real-time Metrics**: Live project health and performance monitoring
- **Interactive Dashboard**: HTML dashboard with visual metrics and trends
- **Historical Tracking**: Metrics history and trend analysis
- **Performance Monitoring**: Agent efficiency and task completion tracking
- **System Status**: Resource usage and system health monitoring

Key Methods:

```typescript
const metrics = await agentDashboard.collectMetrics();
const dashboardPath = await agentDashboard.saveDashboard();
const trends = agentDashboard.getMetricsTrends(7);
const exportData = await agentDashboard.exportDashboardData();
```

## Command Line Interface

### CLI Tool (`../scripts/ai-agent-cli.ts`)

A comprehensive command-line interface for all AI agent tools.

#### Available Commands

```bash
# Health checks
npx tsx scripts/ai-agent-cli.ts health              # Comprehensive health check
npx tsx scripts/ai-agent-cli.ts health --quick      # Quick status check

# Context management
npx tsx scripts/ai-agent-cli.ts context --summary   # Show workspace context
npx tsx scripts/ai-agent-cli.ts context --recommendations  # Get smart recommendations

# Workflow operations
npx tsx scripts/ai-agent-cli.ts workflow --list     # List available workflows
npx tsx scripts/ai-agent-cli.ts workflow --execute pre-commit-validation
npx tsx scripts/ai-agent-cli.ts workflow --recommend

# Dashboard operations
npx tsx scripts/ai-agent-cli.ts dashboard --save    # Generate and save dashboard
npx tsx scripts/ai-agent-cli.ts dashboard --open    # Open dashboard in browser
npx tsx scripts/ai-agent-cli.ts dashboard --trends 7  # Show 7-day trends

# Analysis
npx tsx scripts/ai-agent-cli.ts analyze             # Full project analysis
npx tsx scripts/ai-agent-cli.ts analyze --export report.json  # Export analysis

# Quick operations
npx tsx scripts/ai-agent-cli.ts quick --status      # Quick status overview
npx tsx scripts/ai-agent-cli.ts quick --validate    # Quick validation
npx tsx scripts/ai-agent-cli.ts quick --clean       # Clean up and optimize
```

## Testing

### Test Suite (`../scripts/test-ai-agent-tools.ts`)

Comprehensive test and demonstration of all tools.

```bash
npx tsx scripts/test-ai-agent-tools.ts
```

This will run through all major features and display:

- Project health analysis
- Code quality assessment
- Context management
- Workflow detection
- Dashboard generation
- Smart recommendations

## Integration Examples

### 1. Pre-commit Workflow

```typescript
import { workflowAssistant } from './tools/intelligent-workflow-assistant';

// Automatically run validation before commits
const result = await workflowAssistant.executeWorkflow('pre-commit-validation');
if (!result.success) {
  console.log('❌ Pre-commit validation failed');
  process.exit(1);
}
```

### 2. Development Context Tracking

```typescript
import { contextManager } from './tools/smart-context-manager';

// Update context when working on features
contextManager.updateWorkingSet(
  ['client/src/components/FeatureForm.tsx', 'server/routes/features.ts', 'shared/schema.ts'],
  'feature-development'
);

// Get smart suggestions for next steps
const recommendations = contextManager.getSmartRecommendations('testing');
```

### 3. Continuous Health Monitoring

```typescript
import { agentToolkit } from './tools/ai-agent-toolkit';

// Quick health check during development
const health = await agentToolkit.quickHealthCheck();
if (health.status === 'critical') {
  console.warn('⚠️ Project health is critical, addressing issues...');
}
```

### 4. Dashboard Integration

```typescript
import { agentDashboard } from './tools/ai-agent-dashboard';

// Generate daily dashboard
const dashboardPath = await agentDashboard.saveDashboard();
console.log(`📊 Dashboard available at: ${dashboardPath}`);
```

## Configuration

### Environment Variables

- `AI_AGENT_LOG_LEVEL`: Set logging level (debug, info, warn, error)
- `AI_AGENT_CACHE_DIR`: Custom cache directory (default: `.ai-agent`)
- `AI_AGENT_DASHBOARD_PORT`: Custom port for dashboard server

### Workflow Patterns

The workflow assistant includes pre-configured patterns:

- `pre-commit-validation`: TypeScript check, linting, organization tests
- `dependency-audit`: Security audit, outdated package check, bundle analysis
- `documentation-sync`: Documentation coverage and API doc updates
- `performance-monitoring`: Bundle size analysis and performance checks
- `code-quality-enhancement`: Complexity analysis and unused code detection

## Best Practices

### 1. Regular Health Checks

Run health checks regularly to catch issues early:

```bash
npx tsx scripts/ai-agent-cli.ts health --quick
```

### 2. Context-Aware Development

Update working context when switching tasks:

```typescript
contextManager.updateWorkingSet(newFiles, 'bug-fixing');
```

### 3. Automated Workflows

Integrate workflows into your development process:

```bash
# Before committing
npx tsx scripts/ai-agent-cli.ts workflow --execute pre-commit-validation

# Weekly maintenance
npx tsx scripts/ai-agent-cli.ts workflow --execute dependency-audit
```

### 4. Dashboard Monitoring

Generate dashboards for project reviews:

```bash
npx tsx scripts/ai-agent-cli.ts dashboard --save --open
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Ensure all dependencies are installed
2. **Permission Errors**: Check file permissions for cache directory
3. **Dashboard Generation**: Ensure write permissions in project root
4. **Workflow Execution**: Check that required tools (eslint, tsc) are available

### Debug Mode

Enable debug logging:

```bash
AI_AGENT_LOG_LEVEL=debug npx tsx scripts/ai-agent-cli.ts health
```

## Contributing

When adding new tools or features:

1. Follow the existing patterns and interfaces
2. Add comprehensive JSDoc documentation
3. Include error handling and logging
4. Update this README with new features
5. Add tests to the test suite
6. Update the CLI interface if needed

## Dependencies

- `commander`: CLI framework
- `chalk`: Terminal styling
- `glob`: File pattern matching
- Built-in Node.js modules: `fs`, `path`, `child_process`

## Architecture

The tools are designed with:

- **Modularity**: Each tool can be used independently
- **Singleton Pattern**: Shared instances for consistency
- **Async/Await**: Modern async handling
- **Error Handling**: Comprehensive error management
- **Caching**: Intelligent caching for performance
- **Extensibility**: Easy to add new features and patterns
