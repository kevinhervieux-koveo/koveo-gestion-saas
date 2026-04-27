#!/usr/bin/env tsx
/**
 * DEPLOYMENT VALIDATION SCRIPT.
 *
 * This script should be run BEFORE every deployment to prevent
 * production errors like "Cannot GET /" from reaching users.
 *
 * Usage:
 *   npm run validate:deployment
 *   OR
 *   npx tsx scripts/deployment-validation.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 *
 */
interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  critical: boolean;
}

/**
 *
 */
class DeploymentValidator {
  private results: ValidationResult[] = [];
  private projectRoot: string;

  /**
   *
   */
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
  }

  /**
   *
   * @param test
   * @param status
   * @param message
   * @param critical
   */
  private addResult(
    test: string,
    status: 'PASS' | 'FAIL' | 'WARN',
    message: string,
    critical = false
  ) {
    this.results.push({ test, status, message, critical });

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    const prefix = critical ? '🚨 CRITICAL' : '';
    console.warn(`${icon} ${prefix} ${test}: ${message}`);
  }

  /**
   *
   */
  private async checkDatabaseConnection(): Promise<void> {
    console.warn('\n🔍 Checking database connection...');

    if (!process.env.DATABASE_URL) {
      this.addResult(
        'Database Configuration',
        'FAIL',
        'DATABASE_URL environment variable not set',
        true
      );
      return;
    }

    try {
      // Import and test database connection
      const { db } = await import('../server/db');
      await db.execute('SELECT 1');

      this.addResult('Database Connection', 'PASS', 'Database connection successful');
    } catch (error) {
      this.addResult('Database Connection', 'FAIL', `Database connection failed: ${error}`, true);
    }
  }

  /**
   *
   */
  private checkEnvironmentVariables(): void {
    console.warn('\n🔍 Checking environment variables...');

    const requiredVars = ['DATABASE_URL'];
    const optionalVars = ['PORT', 'NODE_ENV', 'FRONTEND_URL'];

    requiredVars.forEach((varName) => {
      if (process.env[varName]) {
        this.addResult(
          `Environment Variable: ${varName}`,
          'PASS',
          'Required environment variable is set'
        );
      } else {
        this.addResult(
          `Environment Variable: ${varName}`,
          'FAIL',
          `Required environment variable ${varName} is missing`,
          true
        );
      }
    });

    optionalVars.forEach((varName) => {
      if (process.env[varName]) {
        this.addResult(
          `Environment Variable: ${varName}`,
          'PASS',
          'Optional environment variable is set'
        );
      } else {
        this.addResult(
          `Environment Variable: ${varName}`,
          'WARN',
          `Optional environment variable ${varName} is not set`
        );
      }
    });
  }

  /**
   *
   */
  private checkPackageJson(): void {
    console.warn('\n🔍 Checking package.json configuration...');

    const packageJsonPath = path.resolve(this.projectRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      this.addResult('Package.json', 'FAIL', 'package.json file not found', true);
      return;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Check required scripts
      const requiredScripts = ['build', 'build:client', 'build:server', 'start'];
      let scriptsValid = true;

      requiredScripts.forEach((script) => {
        if (!packageJson.scripts || !packageJson.scripts[script]) {
          this.addResult(
            `Package Script: ${script}`,
            'FAIL',
            `Required script ${script} missing from package.json`,
            true
          );
          scriptsValid = false;
        }
      });

      if (scriptsValid) {
        this.addResult('Package Scripts', 'PASS', 'All required scripts are present');
      }

      // Check start script - accepts both production approaches:
      // 1. Direct execution: NODE_ENV=production node dist/index.js
      // 2. Via copied entry point: node server/index.js (where server/index.js is copied from dist/index.js)
      const startScript = packageJson.scripts?.start;
      if (
        startScript &&
        (startScript.includes('dist/index.js') ||
          (startScript.includes('server/index.js') &&
            fs.existsSync(path.resolve(this.projectRoot, 'server/index.js'))))
      ) {
        this.addResult('Start Script', 'PASS', 'Start script is production-ready');
      } else {
        this.addResult(
          'Start Script',
          'FAIL',
          'Start script is not configured for production - missing dist/index.js or server/index.js',
          true
        );
      }

      // Check critical dependencies
      const criticalDeps = ['express', 'drizzle-orm', '@neondatabase/serverless'];
      const missingDeps = criticalDeps.filter((dep) => !packageJson.dependencies?.[dep]);

      if (missingDeps.length === 0) {
        this.addResult('Critical Dependencies', 'PASS', 'All critical dependencies are present');
      } else {
        this.addResult(
          'Critical Dependencies',
          'FAIL',
          `Missing critical dependencies: ${missingDeps.join(', ')}`,
          true
        );
      }
    } catch (error) {
      this.addResult(
        'Package.json Parsing',
        'FAIL',
        `Failed to parse package.json: ${error}`,
        true
      );
    }
  }

  /**
   *
   */
  private checkBuildArtifacts(): void {
    console.warn('\n🔍 Checking build artifacts...');

    const buildPaths = [
      {
        path: path.resolve(this.projectRoot, 'server/public/index.html'),
        name: 'Client Build (index.html)',
        critical: true,
      },
      {
        path: path.resolve(this.projectRoot, 'server/public/assets'),
        name: 'Client Assets',
        critical: true,
      },
      {
        path: path.resolve(this.projectRoot, 'dist/index.js'),
        name: 'Server Build',
        critical: false,
      },
    ];

    buildPaths.forEach(({ path: buildPath, name, critical }) => {
      if (fs.existsSync(buildPath)) {
        // Additional validation for index.html
        if (name === 'Client Build (index.html)') {
          const indexContent = fs.readFileSync(buildPath, 'utf-8');
          if (indexContent.includes('<div id="root">') && indexContent.includes('</html>')) {
            this.addResult(name, 'PASS', 'Client build is valid');
          } else {
            this.addResult(
              name,
              'FAIL',
              'Client build is invalid - missing required HTML structure',
              critical
            );
          }
        } else if (name === 'Client Assets') {
          const assetFiles = fs.readdirSync(buildPath);
          const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
          const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

          if (jsFiles.length > 0 && cssFiles.length > 0) {
            this.addResult(
              name,
              'PASS',
              `Assets found: ${jsFiles.length} JS, ${cssFiles.length} CSS`
            );
          } else {
            this.addResult(name, 'FAIL', 'Missing required asset files', critical);
          }
        } else {
          // Server build
          const stats = fs.statSync(buildPath);
          if (stats.size > 1000) {
            // At least 1KB
            this.addResult(name, 'PASS', `Build file exists (${Math.round(stats.size / 1024)}KB)`);
          } else {
            this.addResult(name, 'FAIL', 'Build file is too small or empty', critical);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'production') {
          this.addResult(name, 'FAIL', `Build artifact missing: ${buildPath}`, critical);
        } else {
          this.addResult(name, 'WARN', `Build artifact missing (dev mode): ${buildPath}`);
        }
      }
    });
  }

  /**
   *
   */
  private async checkServerStartup(): Promise<void> {
    console.warn('\n🔍 Checking server startup capability...');

    try {
      // Import server modules to check for syntax errors
      await import('../server/routes.ts');
      this.addResult('Server Module Import', 'PASS', 'Server modules import successfully');

      // Check if main server file exists and is valid
      const serverIndexPath = path.resolve(this.projectRoot, 'server/index.ts');
      if (fs.existsSync(serverIndexPath)) {
        this.addResult('Server Entry Point', 'PASS', 'Server entry point exists');
      } else {
        this.addResult('Server Entry Point', 'FAIL', 'Server entry point missing', true);
      }
    } catch (error) {
      this.addResult('Server Startup', 'FAIL', `Server startup test failed: ${error}`, true);
    }
  }

  /**
   *
   */
  private checkSystemRequirements(): void {
    console.warn('\n🔍 Checking system requirements...');

    // Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    if (majorVersion >= 18) {
      this.addResult('Node.js Version', 'PASS', `Node.js ${nodeVersion} is supported`);
    } else {
      this.addResult(
        'Node.js Version',
        'FAIL',
        `Node.js ${nodeVersion} is too old (requires 18+)`,
        true
      );
    }

    // Memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    if (heapUsedMB < 512) {
      this.addResult('Memory Usage', 'PASS', `Memory usage is reasonable: ${heapUsedMB}MB`);
    } else {
      this.addResult('Memory Usage', 'WARN', `Memory usage is high: ${heapUsedMB}MB`);
    }

    // Port configuration
    const port = process.env.PORT || process.env.REPL_PORT || '8080';
    const portNum = parseInt(port, 10);

    if (portNum > 0 && portNum < 65536) {
      this.addResult('Port Configuration', 'PASS', `Port ${port} is valid`);
    } else {
      this.addResult('Port Configuration', 'FAIL', `Port ${port} is invalid`, true);
    }
  }

  /**
   *
   */
  private generateReport(): void {
    console.warn('\n' + '='.repeat(60));
    console.warn('📋 DEPLOYMENT VALIDATION REPORT');
    console.warn('='.repeat(60));

    const totalTests = this.results.length;
    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const warnings = this.results.filter((r) => r.status === 'WARN').length;
    const criticalFailures = this.results.filter((r) => r.status === 'FAIL' && r.critical).length;

    console.warn(`📊 Total Tests: ${totalTests}`);
    console.warn(`✅ Passed: ${passed}`);
    console.warn(`❌ Failed: ${failed}`);
    console.warn(`⚠️ Warnings: ${warnings}`);
    console.warn(`🚨 Critical Failures: ${criticalFailures}`);

    console.warn('\n📋 DEPLOYMENT RECOMMENDATION:');

    if (criticalFailures > 0) {
      console.warn('🚨 DEPLOYMENT BLOCKED: Critical issues must be resolved');
      console.warn('\n❌ Critical failures:');
      this.results
        .filter((r) => r.status === 'FAIL' && r.critical)
        .forEach((r) => console.warn(`   • ${r.test}: ${r.message}`));

      console.warn('\n🔧 Action Required: Fix critical issues before deployment');
      process.exit(1);
    } else if (failed > 0) {
      console.warn('⚠️ DEPLOYMENT RISKY: Some issues detected');
      console.warn('Consider fixing these issues before deployment:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => console.warn(`   • ${r.test}: ${r.message}`));

      process.exit(1);
    } else {
      console.warn('✅ DEPLOYMENT APPROVED: All critical checks passed');

      if (warnings > 0) {
        console.warn('\n⚠️ Warnings (non-blocking):');
        this.results
          .filter((r) => r.status === 'WARN')
          .forEach((r) => console.warn(`   • ${r.test}: ${r.message}`));
      }

      console.warn('\n🚀 Ready for deployment!');
      process.exit(0);
    }
  }

  /**
   *
   */
  async validate(): Promise<void> {
    console.warn('🚀 Starting deployment validation...');
    console.warn(`📍 Project root: ${this.projectRoot}`);
    console.warn(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.warn(`🕒 Timestamp: ${new Date().toISOString()}`);

    // Run all validation checks
    this.checkSystemRequirements();
    this.checkEnvironmentVariables();
    this.checkPackageJson();
    this.checkBuildArtifacts();
    await this.checkDatabaseConnection();
    await this.checkServerStartup();

    // Skip demo organization sync for deployment validation
    // This is handled separately and not critical for deployment
    console.warn('\n⏭️  Skipping demo organization sync validation (not critical for deployment)');

    // Generate final report
    this.generateReport();
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  validator.validate().catch((error) => {
    console.error('💥 Validation failed with error:', error);
    process.exit(1);
  });
}

export { DeploymentValidator };
