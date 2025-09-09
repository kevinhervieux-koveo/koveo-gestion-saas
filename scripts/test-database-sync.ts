#!/usr/bin/env tsx
/**
 * Database Synchronization Test Runner
 * Comprehensive testing suite for development and production database consistency
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

const DEV_DB = process.env.DATABASE_URL;
const PROD_DB = process.env.DATABASE_URL_KOVEO;

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  message?: string;
  duration?: number;
}

class DatabaseSyncTester {
  private results: TestResult[] = [];

  constructor() {
    if (!DEV_DB || !PROD_DB) {
      console.error(chalk.red('❌ Missing database environment variables'));
      console.error('Required: DATABASE_URL and DATABASE_URL_KOVEO');
      process.exit(1);
    }
  }

  private async runTest(name: string, testFn: () => Promise<void> | void): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(chalk.green(`  ✓ ${name} (${duration}ms)`));
      return { name, status: 'passed', duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(chalk.red(`  ✗ ${name} (${duration}ms)`));
      console.log(chalk.red(`    ${error.message}`));
      return { name, status: 'failed', message: error.message, duration };
    }
  }

  private execQuery(db: string, query: string, silent = true): string {
    try {
      return execSync(`psql "${db}" -t -c "${query}"`, { 
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit'
      });
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  async testSchemaConsistency(): Promise<void> {
    console.log(chalk.blue('\n🔍 Testing Schema Consistency'));

    // Test table structures
    await this.runTest('Table structures match', () => {
      const query = `
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, column_name;
      `;
      
      const devSchema = this.execQuery(DEV_DB!, query);
      const prodSchema = this.execQuery(PROD_DB!, query);
      
      if (devSchema.trim() !== prodSchema.trim()) {
        throw new Error('Table structures do not match between environments');
      }
    });

    // Test constraints
    await this.runTest('Constraints match', () => {
      const query = `
        SELECT tc.table_name, tc.constraint_type, 
               CASE WHEN tc.constraint_type = 'FOREIGN KEY' THEN kcu.column_name
                    WHEN tc.constraint_type = 'UNIQUE' THEN kcu.column_name
                    WHEN tc.constraint_type = 'PRIMARY KEY' THEN kcu.column_name
                    ELSE 'CHECK_CONSTRAINT' END as constraint_details
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
        ORDER BY tc.table_name, tc.constraint_type, constraint_details;
      `;
      
      const devConstraints = this.execQuery(DEV_DB!, query);
      const prodConstraints = this.execQuery(PROD_DB!, query);
      
      if (devConstraints.trim() !== prodConstraints.trim()) {
        throw new Error('Functional constraints do not match between environments');
      }
    });

    // Test indexes
    await this.runTest('Indexes match', () => {
      const query = `
        SELECT tablename, indexname
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;
      
      const devIndexes = this.execQuery(DEV_DB!, query);
      const prodIndexes = this.execQuery(PROD_DB!, query);
      
      if (devIndexes.trim() !== prodIndexes.trim()) {
        throw new Error('Indexes do not match between environments');
      }
    });

    this.results.push(...(await Promise.all([
      this.runTest('Table structures match', () => this.testTableStructures()),
      this.runTest('Constraints match', () => this.testConstraints()),
      this.runTest('Indexes match', () => this.testIndexes())
    ])));
  }

  private async testTableStructures(): Promise<void> {
    const query = `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, column_name;
    `;
    
    const devSchema = this.execQuery(DEV_DB!, query);
    const prodSchema = this.execQuery(PROD_DB!, query);
    
    if (devSchema.trim() !== prodSchema.trim()) {
      throw new Error('Table structures do not match between environments');
    }
  }

  private async testConstraints(): Promise<void> {
    const query = `
      SELECT tc.table_name, tc.constraint_type, 
             CASE WHEN tc.constraint_type = 'FOREIGN KEY' THEN kcu.column_name
                  WHEN tc.constraint_type = 'UNIQUE' THEN kcu.column_name
                  WHEN tc.constraint_type = 'PRIMARY KEY' THEN kcu.column_name
                  ELSE 'CHECK_CONSTRAINT' END as constraint_details
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' 
        AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_type, constraint_details;
    `;
    
    const devConstraints = this.execQuery(DEV_DB!, query);
    const prodConstraints = this.execQuery(PROD_DB!, query);
    
    if (devConstraints.trim() !== prodConstraints.trim()) {
      throw new Error('Functional constraints do not match between environments');
    }
  }

  private async testIndexes(): Promise<void> {
    const query = `
      SELECT tablename, indexname
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    
    const devIndexes = this.execQuery(DEV_DB!, query);
    const prodIndexes = this.execQuery(PROD_DB!, query);
    
    if (devIndexes.trim() !== prodIndexes.trim()) {
      throw new Error('Indexes do not match between environments');
    }
  }

  async testDocumentTable(): Promise<void> {
    console.log(chalk.blue('\n📄 Testing Document Table Specifics'));

    this.results.push(...(await Promise.all([
      this.runTest('Documents table exists in both databases', () => this.testDocumentsTableExists()),
      this.runTest('Documents table has correct structure', () => this.testDocumentsTableStructure()),
      this.runTest('Legacy columns removed from production', () => this.testLegacyColumnsRemoved()),
      this.runTest('Unique constraints on file_path', () => this.testFilePathUnique()),
      this.runTest('Foreign key relationships correct', () => this.testDocumentsForeignKeys())
    ])));
  }

  private async testDocumentsTableExists(): Promise<void> {
    const query = "SELECT 1 FROM information_schema.tables WHERE table_name = 'documents';";
    
    const devResult = this.execQuery(DEV_DB!, query);
    const prodResult = this.execQuery(PROD_DB!, query);
    
    if (devResult.trim() !== '1' || prodResult.trim() !== '1') {
      throw new Error('Documents table missing in one or both databases');
    }
  }

  private async testDocumentsTableStructure(): Promise<void> {
    const query = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'documents' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    const devStructure = this.execQuery(DEV_DB!, query);
    const prodStructure = this.execQuery(PROD_DB!, query);
    
    if (devStructure.trim() !== prodStructure.trim()) {
      throw new Error('Documents table structure differs between environments');
    }

    // Verify critical columns exist
    const criticalColumns = ['id', 'name', 'document_type', 'file_path', 'created_at', 'uploaded_by_id'];
    for (const column of criticalColumns) {
      if (!devStructure.includes(column) || !prodStructure.includes(column)) {
        throw new Error(`Critical column '${column}' missing from documents table`);
      }
    }
  }

  private async testLegacyColumnsRemoved(): Promise<void> {
    const query = `
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'documents' 
        AND column_name IN ('upload_date', 'type', 'buildings', 'residence', 'tenant');
    `;
    
    const prodLegacy = this.execQuery(PROD_DB!, query);
    
    if (prodLegacy.trim() !== '') {
      throw new Error('Legacy columns still exist in production documents table');
    }
  }

  private async testFilePathUnique(): Promise<void> {
    const query = `
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_name = 'documents' 
        AND constraint_name = 'documents_file_path_unique' 
        AND constraint_type = 'UNIQUE';
    `;
    
    const devUnique = this.execQuery(DEV_DB!, query);
    const prodUnique = this.execQuery(PROD_DB!, query);
    
    if (devUnique.trim() !== '1' || prodUnique.trim() !== '1') {
      throw new Error('file_path unique constraint missing in one or both databases');
    }
  }

  private async testDocumentsForeignKeys(): Promise<void> {
    const query = `
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'documents' AND constraint_type = 'FOREIGN KEY'
      ORDER BY constraint_name;
    `;
    
    const devFKs = this.execQuery(DEV_DB!, query);
    const prodFKs = this.execQuery(PROD_DB!, query);
    
    if (devFKs.trim() !== prodFKs.trim()) {
      throw new Error('Foreign key constraints differ between environments');
    }
  }

  async testDataIntegrity(): Promise<void> {
    console.log(chalk.blue('\n🔒 Testing Data Integrity'));

    this.results.push(...(await Promise.all([
      this.runTest('Document data preserved in production', () => this.testDocumentDataPreserved()),
      this.runTest('No orphaned documents', () => this.testNoOrphanedDocuments()),
      this.runTest('Valid document types only', () => this.testValidDocumentTypes()),
      this.runTest('All documents have timestamps', () => this.testDocumentTimestamps())
    ])));
  }

  private async testDocumentDataPreserved(): Promise<void> {
    const query = "SELECT COUNT(*) FROM documents WHERE created_at IS NOT NULL;";
    const prodCount = parseInt(this.execQuery(PROD_DB!, query).trim());
    
    if (prodCount < 10) {
      throw new Error(`Expected at least 10 migrated documents, found ${prodCount}`);
    }
  }

  private async testNoOrphanedDocuments(): Promise<void> {
    // Test that all documents with building_id reference valid buildings
    const query = `
      SELECT COUNT(*) FROM documents d
      LEFT JOIN buildings b ON d.building_id = b.id
      WHERE d.building_id IS NOT NULL AND b.id IS NULL;
    `;
    
    const devOrphans = parseInt(this.execQuery(DEV_DB!, query).trim());
    const prodOrphans = parseInt(this.execQuery(PROD_DB!, query).trim());
    
    if (devOrphans > 0 || prodOrphans > 0) {
      throw new Error(`Found orphaned documents with invalid building references: dev=${devOrphans}, prod=${prodOrphans}`);
    }
  }

  private async testValidDocumentTypes(): Promise<void> {
    const validTypes = [
      'bylaw', 'financial', 'maintenance', 'legal', 'meeting_minutes', 'insurance', 
      'contracts', 'permits', 'inspection', 'lease', 'correspondence', 'utilities', 'other',
      'attachment', 'screenshot', 'evidence', 'supporting_document',
      'regulations', 'safety', 'test', 'invoice'
    ];
    const typeList = validTypes.map(t => `'${t}'`).join(',');
    
    const query = `
      SELECT COUNT(*) FROM documents 
      WHERE document_type NOT IN (${typeList});
    `;
    
    const devInvalid = parseInt(this.execQuery(DEV_DB!, query).trim());
    const prodInvalid = parseInt(this.execQuery(PROD_DB!, query).trim());
    
    if (devInvalid > 0 || prodInvalid > 0) {
      throw new Error(`Found documents with invalid types: dev=${devInvalid}, prod=${prodInvalid}`);
    }
  }

  private async testDocumentTimestamps(): Promise<void> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(created_at) as with_created_at,
        COUNT(updated_at) as with_updated_at
      FROM documents;
    `;
    
    const devResult = this.execQuery(DEV_DB!, query).trim().split('|').map(s => parseInt(s.trim()));
    const prodResult = this.execQuery(PROD_DB!, query).trim().split('|').map(s => parseInt(s.trim()));
    
    if (devResult[0] !== devResult[1] || devResult[0] !== devResult[2]) {
      throw new Error('Some documents missing timestamps in development');
    }
    
    if (prodResult[0] !== prodResult[1] || prodResult[0] !== prodResult[2]) {
      throw new Error('Some documents missing timestamps in production');
    }
  }

  async testConnectivity(): Promise<void> {
    console.log(chalk.blue('\n🔌 Testing Database Connectivity'));

    this.results.push(...(await Promise.all([
      this.runTest('Development database connection', () => this.testDevConnection()),
      this.runTest('Production database connection', () => this.testProdConnection()),
      this.runTest('Database versions compatible', () => this.testDatabaseVersions())
    ])));
  }

  private async testDevConnection(): Promise<void> {
    const result = this.execQuery(DEV_DB!, 'SELECT 1 as test;');
    if (!result.includes('1')) {
      throw new Error('Cannot connect to development database');
    }
  }

  private async testProdConnection(): Promise<void> {
    const result = this.execQuery(PROD_DB!, 'SELECT 1 as test;');
    if (!result.includes('1')) {
      throw new Error('Cannot connect to production database');
    }
  }

  private async testDatabaseVersions(): Promise<void> {
    const devVersion = this.execQuery(DEV_DB!, 'SELECT version();');
    const prodVersion = this.execQuery(PROD_DB!, 'SELECT version();');
    
    if (!devVersion.includes('PostgreSQL') || !prodVersion.includes('PostgreSQL')) {
      throw new Error('One or both databases are not PostgreSQL');
    }
  }

  async runAllTests(): Promise<void> {
    console.log(chalk.blue('🧪 Starting Database Synchronization Tests\n'));

    await this.testConnectivity();
    await this.testSchemaConsistency();
    await this.testDocumentTable();
    await this.testDataIntegrity();

    this.printSummary();
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const total = this.results.length;

    console.log(chalk.blue('\n📊 Test Summary'));
    console.log(chalk.green(`✓ Passed: ${passed}`));
    
    if (failed > 0) {
      console.log(chalk.red(`✗ Failed: ${failed}`));
      console.log(chalk.red('\nFailed Tests:'));
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(chalk.red(`  - ${r.name}: ${r.message}`)));
    }
    
    console.log(chalk.blue(`📈 Total: ${passed}/${total} tests passed`));
    
    if (failed === 0) {
      console.log(chalk.green('\n🎉 All database synchronization tests passed!'));
      console.log(chalk.green('✅ Development and production databases are properly synchronized'));
    } else {
      console.log(chalk.red('\n❌ Some tests failed - databases may not be properly synchronized'));
      process.exit(1);
    }
  }
}

async function main() {
  const tester = new DatabaseSyncTester();
  await tester.runAllTests();
}

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('❌ Test runner failed:'), error.message);
    process.exit(1);
  });
}