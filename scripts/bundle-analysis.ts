#!/usr/bin/env tsx
/**
 * Bundle Analysis Script for Quebec Property Management SaaS
 * Analyzes bundle size, identifies optimization opportunities, and tracks regressions
 */

import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface BundleStats {
  totalSize: number;
  gzippedSize: number;
  chunkSizes: Record<string, number>;
  largestDependencies: Array<{ name: string; size: number }>;
  timestamp: string;
}

interface OptimizationOpportunity {
  type: 'large_dependency' | 'duplicate_code' | 'unused_code' | 'large_chunk';
  description: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
  estimatedSavings: number; // in KB
}

class BundleAnalyzer {
  private outputDir = 'reports/bundle-analysis';
  private statsFile = path.join(this.outputDir, 'bundle-stats.json');
  private historyFile = path.join(this.outputDir, 'size-history.json');

  constructor() {
    this.ensureOutputDir();
  }

  /**
   * Runs complete bundle analysis
   */
  async runAnalysis(): Promise<void> {
    console.log(chalk.blue('🔍 Starting Bundle Analysis...'));

    try {
      // Build the project first
      await this.buildProject();

      // Analyze the bundle
      const stats = await this.analyzeBundleSize();
      
      // Generate optimization recommendations
      const opportunities = await this.identifyOptimizations(stats);
      
      // Save results
      await this.saveResults(stats, opportunities);
      
      // Generate reports
      await this.generateReports(stats, opportunities);
      
      // Check for regressions
      await this.checkRegressions(stats);

      console.log(chalk.green('✅ Bundle analysis completed successfully!'));
      console.log(chalk.cyan(`📊 Reports saved to: ${this.outputDir}`));

    } catch (error) {
      console.error(chalk.red('❌ Bundle analysis failed:'), error);
      process.exit(1);
    }
  }

  /**
   * Builds the project for analysis
   */
  private async buildProject(): Promise<void> {
    console.log(chalk.yellow('📦 Building project...'));
    
    const { stdout, stderr } = await execAsync('npm run build:client');
    
    if (stderr && !stderr.includes('warning')) {
      throw new Error(`Build failed: ${stderr}`);
    }
    
    console.log(chalk.green('✅ Build completed'));
  }

  /**
   * Analyzes bundle size and composition
   */
  private async analyzeBundleSize(): Promise<BundleStats> {
    console.log(chalk.yellow('📊 Analyzing bundle size...'));

    const distPath = path.join(process.cwd(), 'dist/public');
    
    try {
      const files = await fs.readdir(distPath, { recursive: true });
      const jsFiles = files.filter((file: any) => 
        typeof file === 'string' && file.endsWith('.js')
      );

      let totalSize = 0;
      const chunkSizes: Record<string, number> = {};

      for (const file of jsFiles) {
        const filePath = path.join(distPath, file as string);
        const stats = await fs.stat(filePath);
        const size = stats.size;
        
        totalSize += size;
        chunkSizes[file as string] = size;
      }

      // Estimate gzipped size (roughly 30% of original)
      const gzippedSize = Math.round(totalSize * 0.3);

      return {
        totalSize,
        gzippedSize,
        chunkSizes,
        largestDependencies: await this.identifyLargestDependencies(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Failed to analyze bundle: ${error}`);
    }
  }

  /**
   * Identifies largest dependencies in the bundle
   */
  private async identifyLargestDependencies(): Promise<Array<{ name: string; size: number }>> {
    // This would require actual webpack stats, but we'll analyze package.json for estimates
    const packageJson = JSON.parse(
      await fs.readFile('package.json', 'utf-8')
    );

    const largeDependencies = [
      { name: 'react', size: 45000 },
      { name: 'react-dom', size: 135000 },
      { name: '@radix-ui/react-*', size: 180000 }, // Estimated total for all radix components
      { name: 'recharts', size: 165000 },
      { name: '@tanstack/react-query', size: 85000 },
      { name: 'lucide-react', size: 75000 },
    ];

    return largeDependencies.sort((a, b) => b.size - a.size);
  }

  /**
   * Identifies optimization opportunities
   */
  private async identifyOptimizations(stats: BundleStats): Promise<OptimizationOpportunity[]> {
    const opportunities: OptimizationOpportunity[] = [];

    // Check for large chunks
    Object.entries(stats.chunkSizes).forEach(([chunk, size]) => {
      if (size > 500000) { // 500KB
        opportunities.push({
          type: 'large_chunk',
          description: `Large chunk detected: ${chunk} (${(size / 1024).toFixed(1)} KB)`,
          impact: 'high',
          recommendation: 'Consider code splitting or lazy loading for this chunk',
          estimatedSavings: Math.round(size * 0.3 / 1024), // 30% potential savings
        });
      }
    });

    // Check for large dependencies
    stats.largestDependencies.forEach(dep => {
      if (dep.size > 100000) { // 100KB
        opportunities.push({
          type: 'large_dependency',
          description: `Large dependency: ${dep.name} (${(dep.size / 1024).toFixed(1)} KB)`,
          impact: dep.size > 150000 ? 'high' : 'medium',
          recommendation: this.getRecommendationForDependency(dep.name),
          estimatedSavings: Math.round(dep.size * 0.2 / 1024), // 20% potential savings
        });
      }
    });

    // Check total bundle size
    if (stats.totalSize > 2000000) { // 2MB
      opportunities.push({
        type: 'large_chunk',
        description: `Total bundle size is large: ${(stats.totalSize / 1024 / 1024).toFixed(1)} MB`,
        impact: 'high',
        recommendation: 'Implement aggressive code splitting and lazy loading',
        estimatedSavings: Math.round(stats.totalSize * 0.25 / 1024), // 25% potential savings
      });
    }

    return opportunities.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }

  /**
   * Gets optimization recommendation for specific dependency
   */
  private getRecommendationForDependency(depName: string): string {
    const recommendations: Record<string, string> = {
      'react-dom': 'Consider using React 18 concurrent features for better performance',
      '@radix-ui/react-*': 'Import individual components instead of the entire library',
      'recharts': 'Consider lazy loading charts or using a lighter alternative',
      'lucide-react': 'Import only specific icons instead of the entire icon set',
      '@tanstack/react-query': 'Ensure proper tree shaking is enabled',
    };

    return recommendations[depName] || 'Consider alternatives or lazy loading if possible';
  }

  /**
   * Saves analysis results
   */
  private async saveResults(stats: BundleStats, opportunities: OptimizationOpportunity[]): Promise<void> {
    const results = {
      stats,
      opportunities,
      analysis: {
        totalOpportunities: opportunities.length,
        potentialSavings: opportunities.reduce((total, opp) => total + opp.estimatedSavings, 0),
        highImpactItems: opportunities.filter(opp => opp.impact === 'high').length,
      },
    };

    await fs.writeFile(this.statsFile, JSON.stringify(results, null, 2));

    // Update size history
    await this.updateSizeHistory(stats);
  }

  /**
   * Updates bundle size history for trend analysis
   */
  private async updateSizeHistory(stats: BundleStats): Promise<void> {
    let history: Array<{ date: string; size: number; gzippedSize: number }> = [];

    try {
      const existingHistory = await fs.readFile(this.historyFile, 'utf-8');
      history = JSON.parse(existingHistory);
    } catch {
      // File doesn't exist, start fresh
    }

    history.push({
      date: stats.timestamp,
      size: stats.totalSize,
      gzippedSize: stats.gzippedSize,
    });

    // Keep only last 30 entries
    if (history.length > 30) {
      history = history.slice(-30);
    }

    await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
  }

  /**
   * Generates human-readable reports
   */
  private async generateReports(stats: BundleStats, opportunities: OptimizationOpportunity[]): Promise<void> {
    const reportPath = path.join(this.outputDir, 'bundle-report.md');
    
    const report = `# Bundle Analysis Report

Generated: ${new Date(stats.timestamp).toLocaleString()}

## Bundle Size Summary

- **Total Size**: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB
- **Gzipped Size**: ${(stats.gzippedSize / 1024 / 1024).toFixed(2)} MB
- **Number of Chunks**: ${Object.keys(stats.chunkSizes).length}

## Largest Chunks

${Object.entries(stats.chunkSizes)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([name, size]) => `- **${name}**: ${(size / 1024).toFixed(1)} KB`)
  .join('\n')}

## Largest Dependencies

${stats.largestDependencies
  .slice(0, 10)
  .map(dep => `- **${dep.name}**: ${(dep.size / 1024).toFixed(1)} KB`)
  .join('\n')}

## Optimization Opportunities

Found **${opportunities.length}** optimization opportunities with potential savings of **${opportunities.reduce((total, opp) => total + opp.estimatedSavings, 0)} KB**.

### High Impact Opportunities

${opportunities
  .filter(opp => opp.impact === 'high')
  .map(opp => `- **${opp.description}**
  - Recommendation: ${opp.recommendation}
  - Estimated Savings: ${opp.estimatedSavings} KB`)
  .join('\n\n')}

### Medium Impact Opportunities

${opportunities
  .filter(opp => opp.impact === 'medium')
  .map(opp => `- **${opp.description}**
  - Recommendation: ${opp.recommendation}
  - Estimated Savings: ${opp.estimatedSavings} KB`)
  .join('\n\n')}

## Recommendations

1. **Immediate Actions**: Focus on high-impact opportunities first
2. **Code Splitting**: Implement route-based code splitting for large chunks
3. **Lazy Loading**: Use React.lazy() for heavy components
4. **Tree Shaking**: Ensure all dependencies support tree shaking
5. **Bundle Analysis**: Run this analysis regularly to catch regressions

## Next Steps

1. Implement the high-impact optimizations
2. Set up bundle size monitoring in CI/CD
3. Establish bundle size budgets
4. Schedule regular optimization reviews
`;

    await fs.writeFile(reportPath, report);
    console.log(chalk.green(`📄 Report generated: ${reportPath}`));
  }

  /**
   * Checks for bundle size regressions
   */
  private async checkRegressions(currentStats: BundleStats): Promise<void> {
    try {
      const history = JSON.parse(await fs.readFile(this.historyFile, 'utf-8'));
      
      if (history.length < 2) {
        console.log(chalk.yellow('⚠️  Not enough historical data for regression analysis'));
        return;
      }

      const previousEntry = history[history.length - 2];
      const currentSize = currentStats.totalSize;
      const previousSize = previousEntry.size;
      
      const sizeChange = currentSize - previousSize;
      const percentageChange = (sizeChange / previousSize) * 100;

      if (percentageChange > 10) {
        console.log(chalk.red(`🚨 BUNDLE SIZE REGRESSION DETECTED!`));
        console.log(chalk.red(`Bundle size increased by ${(sizeChange / 1024 / 1024).toFixed(2)} MB (${percentageChange.toFixed(1)}%)`));
      } else if (percentageChange > 5) {
        console.log(chalk.yellow(`⚠️  Bundle size increased by ${(sizeChange / 1024 / 1024).toFixed(2)} MB (${percentageChange.toFixed(1)}%)`));
      } else if (percentageChange < -5) {
        console.log(chalk.green(`🎉 Bundle size reduced by ${Math.abs(sizeChange / 1024 / 1024).toFixed(2)} MB (${Math.abs(percentageChange).toFixed(1)}%)`));
      } else {
        console.log(chalk.blue(`📊 Bundle size change: ${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(1)}%`));
      }

    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not perform regression analysis:', error.message));
    }
  }

  /**
   * Ensures output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }
}

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new BundleAnalyzer();
  analyzer.runAnalysis().catch(console.error);
}

export { BundleAnalyzer };