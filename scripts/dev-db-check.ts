#!/usr/bin/env tsx
/**
 * Development Database Quick Check
 * Fast validation for development workflow
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

const DEV_DB = process.env.DATABASE_URL;
const PROD_DB = process.env.DATABASE_URL_KOVEO;

interface QuickCheckResult {
  test: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fixCommand?: string;
}

class DevDatabaseChecker {
  private results: QuickCheckResult[] = [];

  constructor() {
    if (!DEV_DB || !PROD_DB) {
      console.error(chalk.red('❌ Missing database environment variables'));
      console.error('Required: DATABASE_URL and DATABASE_URL_KOVEO');
      process.exit(1);
    }
  }

  private execQuery(db: string, query: string): string {
    try {
      return execSync(`psql "${db}" -t -c "${query}"`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  private addResult(test: string, status: 'pass' | 'fail' | 'warn', message: string, fixCommand?: string) {
    this.results.push({ test, status, message, fixCommand });
    
    const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
    const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
    
    console.log(chalk[color](`  ${icon} ${test}: ${message}`));
    if (fixCommand) {
      console.log(chalk.gray(`    Fix: ${fixCommand}`));
    }
  }

  async quickConnectivityCheck(): Promise<void> {
    console.log(chalk.blue('🔌 Testing Database Connectivity'));
    
    try {
      this.execQuery(DEV_DB!, 'SELECT 1;');
      this.addResult('Development DB', 'pass', 'Connected successfully');
    } catch (error) {
      this.addResult('Development DB', 'fail', 'Connection failed', 'Check DATABASE_URL');
    }
    
    try {
      this.execQuery(PROD_DB!, 'SELECT 1;');
      this.addResult('Production DB', 'pass', 'Connected successfully');
    } catch (error) {
      this.addResult('Production DB', 'fail', 'Connection failed', 'Check DATABASE_URL_KOVEO');
    }
  }

  async quickSchemaCheck(): Promise<void> {
    console.log(chalk.blue('\n📋 Schema Quick Check'));
    
    try {
      // Check documents table exists
      const devDocs = this.execQuery(DEV_DB!, "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';");
      const prodDocs = this.execQuery(PROD_DB!, "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';");
      
      if (devDocs === '1' && prodDocs === '1') {
        this.addResult('Documents table', 'pass', 'Exists in both databases');
      } else {
        this.addResult('Documents table', 'fail', 'Missing in one or both databases', './sync-db.sh push');
      }
      
      // Check column counts
      const devColCount = parseInt(this.execQuery(DEV_DB!, "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'documents';"));
      const prodColCount = parseInt(this.execQuery(PROD_DB!, "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'documents';"));
      
      if (devColCount === prodColCount) {
        this.addResult('Column count', 'pass', `${devColCount} columns in both`);
      } else {
        this.addResult('Column count', 'fail', `Dev: ${devColCount}, Prod: ${prodColCount}`, './sync-db.sh push');
      }
      
      // Check data types match
      const devTypes = this.execQuery(DEV_DB!, "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents' ORDER BY ordinal_position;");
      const prodTypes = this.execQuery(PROD_DB!, "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents' ORDER BY ordinal_position;");
      
      if (devTypes === prodTypes) {
        this.addResult('Column types', 'pass', 'Data types match perfectly');
      } else {
        this.addResult('Column types', 'warn', 'Some type differences detected', './sync-test.sh fix');
      }
      
    } catch (error) {
      this.addResult('Schema check', 'fail', error.message, 'Check database connectivity');
    }
  }

  async quickDataCheck(): Promise<void> {
    console.log(chalk.blue('\n📊 Data Quick Check'));
    
    try {
      // Check document counts
      const devCount = parseInt(this.execQuery(DEV_DB!, 'SELECT COUNT(*) FROM documents;'));
      const prodCount = parseInt(this.execQuery(PROD_DB!, 'SELECT COUNT(*) FROM documents;'));
      
      this.addResult('Document counts', 'pass', `Dev: ${devCount}, Prod: ${prodCount}`);
      
      // Check for invalid document types
      const invalidTypes = parseInt(this.execQuery(DEV_DB!, `
        SELECT COUNT(*) FROM documents 
        WHERE document_type NOT IN ('regulations', 'financial', 'meeting_minutes', 'insurance', 'safety', 'maintenance', 'permit', 'inspection', 'lease', 'invoice');
      `));
      
      if (invalidTypes === 0) {
        this.addResult('Document types', 'pass', 'All types are valid');
      } else {
        this.addResult('Document types', 'warn', `${invalidTypes} invalid types found`, './sync-test.sh fix');
      }
      
      // Check for NULL timestamps
      const nullTimestamps = parseInt(this.execQuery(DEV_DB!, 'SELECT COUNT(*) FROM documents WHERE created_at IS NULL OR updated_at IS NULL;'));
      
      if (nullTimestamps === 0) {
        this.addResult('Timestamps', 'pass', 'All documents have timestamps');
      } else {
        this.addResult('Timestamps', 'fail', `${nullTimestamps} documents missing timestamps`, 'Manual data fix required');
      }
      
    } catch (error) {
      this.addResult('Data check', 'fail', error.message);
    }
  }

  async quickConstraintCheck(): Promise<void> {
    console.log(chalk.blue('\n🔒 Constraint Quick Check'));
    
    try {
      // Check unique constraints
      const devUnique = parseInt(this.execQuery(DEV_DB!, "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'UNIQUE';"));
      const prodUnique = parseInt(this.execQuery(PROD_DB!, "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'UNIQUE';"));
      
      if (devUnique === prodUnique) {
        this.addResult('Unique constraints', 'pass', `${devUnique} constraints in both`);
      } else {
        this.addResult('Unique constraints', 'warn', `Dev: ${devUnique}, Prod: ${prodUnique}`, './sync-test.sh fix');
      }
      
      // Check foreign keys
      const devFK = parseInt(this.execQuery(DEV_DB!, "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'FOREIGN KEY';"));
      const prodFK = parseInt(this.execQuery(PROD_DB!, "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'documents' AND constraint_type = 'FOREIGN KEY';"));
      
      if (devFK === prodFK) {
        this.addResult('Foreign keys', 'pass', `${devFK} foreign keys in both`);
      } else {
        this.addResult('Foreign keys', 'warn', `Dev: ${devFK}, Prod: ${prodFK}`, './sync-test.sh fix');
      }
      
    } catch (error) {
      this.addResult('Constraint check', 'fail', error.message);
    }
  }

  async runQuickCheck(): Promise<void> {
    console.log(chalk.blue('⚡ Quick Database Sync Check\n'));
    
    await this.quickConnectivityCheck();
    await this.quickSchemaCheck();
    await this.quickDataCheck();
    await this.quickConstraintCheck();
    
    this.printSummary();
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;
    
    console.log(chalk.blue('\n📈 Quick Check Summary:'));
    console.log(chalk.green(`✓ Passed: ${passed}`));
    if (warnings > 0) console.log(chalk.yellow(`⚠ Warnings: ${warnings}`));
    if (failed > 0) console.log(chalk.red(`✗ Failed: ${failed}`));
    
    if (failed === 0 && warnings === 0) {
      console.log(chalk.green('\n🎉 Databases are synchronized!'));
    } else if (failed === 0) {
      console.log(chalk.yellow('\n⚠ Minor issues detected, but databases are functional'));
      console.log(chalk.gray('💡 Run suggested fix commands to resolve warnings'));
    } else {
      console.log(chalk.red('\n❌ Critical issues detected'));
      console.log(chalk.gray('🔧 Run fix commands or contact support'));
      process.exit(1);
    }
  }
}

async function main() {
  const checker = new DevDatabaseChecker();
  await checker.runQuickCheck();
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('❌ Quick check failed:'), error.message);
    process.exit(1);
  });
}