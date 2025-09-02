/**
 * Database Synchronization Tests
 * Ensures development and production databases have consistent schemas and functionality
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execSync } from 'child_process';

const DEV_DB = process.env.DATABASE_URL;
const PROD_DB = process.env.DATABASE_URL_KOVEO;

describe('Database Synchronization Tests', () => {
  beforeAll(() => {
    if (!DEV_DB || !PROD_DB) {
      throw new Error('Both DATABASE_URL and DATABASE_URL_KOVEO must be set');
    }
  });

  describe('Schema Consistency', () => {
    test('should have identical table structures', async () => {
      const schemaQuery = `
        SELECT 
          table_name, 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, ordinal_position;
      `;

      const devSchema = execSync(`psql "${DEV_DB}" -t -c "${schemaQuery}"`, { encoding: 'utf8' });
      const prodSchema = execSync(`psql "${PROD_DB}" -t -c "${schemaQuery}"`, { encoding: 'utf8' });

      expect(devSchema.trim()).toBe(prodSchema.trim());
    });

    test('should have identical constraint definitions', async () => {
      const constraintQuery = `
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name;
      `;

      const devConstraints = execSync(`psql "${DEV_DB}" -t -c "${constraintQuery}"`, { encoding: 'utf8' });
      const prodConstraints = execSync(`psql "${PROD_DB}" -t -c "${constraintQuery}"`, { encoding: 'utf8' });

      expect(devConstraints.trim()).toBe(prodConstraints.trim());
    });

    test('should have identical index definitions', async () => {
      const indexQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `;

      const devIndexes = execSync(`psql "${DEV_DB}" -t -c "${indexQuery}"`, { encoding: 'utf8' });
      const prodIndexes = execSync(`psql "${PROD_DB}" -t -c "${indexQuery}"`, { encoding: 'utf8' });

      expect(devIndexes.trim()).toBe(prodIndexes.trim());
    });

    test('should have identical foreign key relationships', async () => {
      const fkQuery = `
        SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
      `;

      const devFKs = execSync(`psql "${DEV_DB}" -t -c "${fkQuery}"`, { encoding: 'utf8' });
      const prodFKs = execSync(`psql "${PROD_DB}" -t -c "${fkQuery}"`, { encoding: 'utf8' });

      expect(devFKs.trim()).toBe(prodFKs.trim());
    });
  });

  describe('Required Tables Existence', () => {
    const requiredTables = [
      'documents',
      'users',
      'organizations',
      'buildings',
      'residences',
      'permissions',
      'ssl_certificates',
      'password_reset_tokens',
      'invitations',
      'bills'
    ];

    test.each(requiredTables)('should have %s table in both databases', async (tableName) => {
      const tableQuery = `SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}' AND table_schema = 'public';`;
      
      const devResult = execSync(`psql "${DEV_DB}" -t -c "${tableQuery}"`, { encoding: 'utf8' });
      const prodResult = execSync(`psql "${PROD_DB}" -t -c "${tableQuery}"`, { encoding: 'utf8' });

      expect(devResult.trim()).toBe('1');
      expect(prodResult.trim()).toBe('1');
    });
  });

  describe('Critical Unique Constraints', () => {
    const criticalConstraints = [
      { table: 'documents', constraint: 'documents_file_path_key' },
      { table: 'permissions', constraint: 'permissions_name_unique' },
      { table: 'ssl_certificates', constraint: 'ssl_certificates_domain_unique' },
      { table: 'password_reset_tokens', constraint: 'password_reset_tokens_token_unique' },
      { table: 'invitations', constraint: 'invitations_token_unique' },
      { table: 'bills', constraint: 'bills_bill_number_unique' }
    ];

    test.each(criticalConstraints)('should have $constraint constraint in both databases', async ({ table, constraint }) => {
      const constraintQuery = `
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = '${table}' 
          AND constraint_name = '${constraint}' 
          AND constraint_type = 'UNIQUE';
      `;
      
      const devResult = execSync(`psql "${DEV_DB}" -t -c "${constraintQuery}"`, { encoding: 'utf8' });
      const prodResult = execSync(`psql "${PROD_DB}" -t -c "${constraintQuery}"`, { encoding: 'utf8' });

      expect(devResult.trim()).toBe('1');
      expect(prodResult.trim()).toBe('1');
    });
  });

  describe('Documents Table Validation', () => {
    test('should have correct documents table structure in both databases', async () => {
      const documentsQuery = `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'documents' 
          AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;

      const devColumns = execSync(`psql "${DEV_DB}" -t -c "${documentsQuery}"`, { encoding: 'utf8' });
      const prodColumns = execSync(`psql "${PROD_DB}" -t -c "${documentsQuery}"`, { encoding: 'utf8' });

      expect(devColumns.trim()).toBe(prodColumns.trim());

      // Verify specific critical columns exist
      const columnCheck = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'documents' 
          AND column_name IN ('id', 'name', 'document_type', 'file_path', 'created_at', 'uploaded_by_id')
        ORDER BY column_name;
      `;

      const devCriticalColumns = execSync(`psql "${DEV_DB}" -t -c "${columnCheck}"`, { encoding: 'utf8' });
      const prodCriticalColumns = execSync(`psql "${PROD_DB}" -t -c "${columnCheck}"`, { encoding: 'utf8' });

      expect(devCriticalColumns.trim()).toBe(prodCriticalColumns.trim());
      expect(devCriticalColumns.trim()).toContain('created_at');
      expect(devCriticalColumns.trim()).toContain('document_type');
      expect(devCriticalColumns.trim()).toContain('file_path');
    });

    test('should not have legacy columns in documents table', async () => {
      const legacyColumnCheck = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'documents' 
          AND column_name IN ('upload_date', 'type', 'buildings', 'residence', 'tenant');
      `;

      const devLegacy = execSync(`psql "${DEV_DB}" -t -c "${legacyColumnCheck}"`, { encoding: 'utf8' });
      const prodLegacy = execSync(`psql "${PROD_DB}" -t -c "${legacyColumnCheck}"`, { encoding: 'utf8' });

      expect(devLegacy.trim()).toBe('');
      expect(prodLegacy.trim()).toBe('');
    });
  });

  describe('Database Connectivity', () => {
    test('should successfully connect to development database', async () => {
      const result = execSync(`psql "${DEV_DB}" -c "SELECT 1 as connection_test;"`, { encoding: 'utf8' });
      expect(result).toContain('connection_test');
    });

    test('should successfully connect to production database', async () => {
      const result = execSync(`psql "${PROD_DB}" -c "SELECT 1 as connection_test;"`, { encoding: 'utf8' });
      expect(result).toContain('connection_test');
    });

    test('should have correct database versions', async () => {
      const devVersion = execSync(`psql "${DEV_DB}" -t -c "SELECT version();"`, { encoding: 'utf8' });
      const prodVersion = execSync(`psql "${PROD_DB}" -t -c "SELECT version();"`, { encoding: 'utf8' });

      expect(devVersion).toContain('PostgreSQL');
      expect(prodVersion).toContain('PostgreSQL');
    });
  });
});